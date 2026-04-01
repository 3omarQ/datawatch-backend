import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookChannel } from './channels/webhook.channel';
import { NotificationEvent } from './events/notification.event';
import { EXECUTION_DONE, EXECUTION_FAILED, EXECUTION_DIFF } from '../events/event-names';
import { NotificationType } from '../generated/prisma/enums';
import { MAX_NOTIFICATIONS_PER_USER } from './constants';
import { ExecutionDiffEvent, ExecutionDoneEvent, ExecutionFailedEvent } from 'src/events/executions.events';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { EmailService } from 'src/auth/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly webhookChannel: WebhookChannel,
        private readonly emailService: EmailService,
  ) {}

  @OnEvent(EXECUTION_DONE)
  async onExecutionDone(event: ExecutionDoneEvent) {
    const job = await this.fetchJob(event.jobId);
    if (!job?.notifyOnFinish) return;

    await this.notify(new NotificationEvent(
      event.userId,
      event.jobId,
      event.executionId,
      NotificationType.EXECUTION_DONE,
      `Job "${job.datapoint.name}" completed`,
      `Execution finished successfully.`,
    ));
  }

  @OnEvent(EXECUTION_FAILED)
  async onExecutionFailed(event: ExecutionFailedEvent) {
    const job = await this.fetchJob(event.jobId);
    if (!job?.notifyOnFail) return;

    await this.notify(new NotificationEvent(
      event.userId,
      event.jobId,
      event.executionId,
      NotificationType.EXECUTION_FAILED,
      `Job "${job.datapoint.name}" failed`,
      event.reason,
    ));
  }

  @OnEvent(EXECUTION_DIFF)
  async onExecutionDiff(event: ExecutionDiffEvent) {
    const job = await this.fetchJob(event.jobId);
    if (!job?.notifyOnDiff) return;

    await this.notify(new NotificationEvent(
      event.userId,
      event.jobId,
      event.executionId,
      NotificationType.EXECUTION_DIFF,
      `Change detected in "${job.datapoint.name}"`,
      `The scraped content has changed since the last run.`,
    ));
  }

  async getByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_NOTIFICATIONS_PER_USER,
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async notify(event: NotificationEvent) {
    const notification = await this.saveNotification(event);
    await this.trimOldNotifications(event.userId);
    this.gateway.pushToUser(event.userId, notification);
    await this.maybeSendWebhook(event);
    await this.maybeEmailUser(event);
  }

  private async saveNotification(event: NotificationEvent) {
    return this.prisma.notification.create({
      data: {
        userId: event.userId,
        jobId: event.jobId,
        executionId: event.executionId,
        type: event.type,
        title: event.title,
        body: event.body,
      },
    });
  }
  
  private async maybeEmailUser(event: NotificationEvent) {
    const user = await this.prisma.user.findUnique({
      where: { id: event.userId },
      select: { email: true, name: true, notifyByEmail: true },
    });
    if (!user?.notifyByEmail) return;
    await this.emailService.sendNotificationEmail(
      user.email,
      user.name,
      event.title,
      event.body,
      event.jobId,
    );
  }
  private async maybeSendWebhook(event: NotificationEvent) {
    if (!event.jobId) return;
    const job = await this.prisma.job.findUnique({
      where: { id: event.jobId },
      select: { webhookUrl: true },
    });
    if (!job?.webhookUrl) return;
    await this.webhookChannel.send(event, job.webhookUrl);
  }

  private async trimOldNotifications(userId: string) {
    const oldest = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_NOTIFICATIONS_PER_USER,
      select: { id: true },
    });

    if (oldest.length === 0) return;

    await this.prisma.notification.deleteMany({
      where: { id: { in: oldest.map((n) => n.id) } },
    });
  }

  private async fetchJob(jobId: string) {
    return this.prisma.job.findUnique({
      where: { id: jobId },
      include: { datapoint: true },
    });
  }
}