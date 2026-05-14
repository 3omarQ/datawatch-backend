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

type NotificationJob = NonNullable<
  Awaited<ReturnType<NotificationsService['fetchJob']>>
>;

type ExecutionNotificationConfig<TEvent> = {
  enabled: (job: NotificationJob) => boolean;
  type: NotificationType;
  title: (job: NotificationJob) => string;
  body: (event: TEvent) => string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly webhookChannel: WebhookChannel,
    private readonly emailService: EmailService,
  ) { }

  @OnEvent(EXECUTION_DONE)
  async onExecutionDone(event: ExecutionDoneEvent) {
    await this.notifyFromExecutionEvent(event, {
      enabled: (job) => job.notifyOnFinish,
      type: NotificationType.EXECUTION_DONE,
      title: (job) => `Job "${job.datapoint.name}" completed`,
      body: () => 'Execution finished successfully.',
    });
  }

  @OnEvent(EXECUTION_FAILED)
  async onExecutionFailed(event: ExecutionFailedEvent) {
    await this.notifyFromExecutionEvent(event, {
      enabled: (job) => job.notifyOnFail,
      type: NotificationType.EXECUTION_FAILED,
      title: (job) => `Job "${job.datapoint.name}" failed`,
      body: (failedEvent) => failedEvent.reason,
    });
  }

  @OnEvent(EXECUTION_DIFF)
  async onExecutionDiff(event: ExecutionDiffEvent) {
    await this.notifyFromExecutionEvent(event, {
      enabled: (job) => job.notifyOnDiff,
      type: NotificationType.EXECUTION_DIFF,
      title: (job) => `Change detected in "${job.datapoint.name}"`,
      body: () => 'The scraped content has changed since the last run.',
    });
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

  private async notifyFromExecutionEvent<TEvent extends ExecutionDoneEvent | ExecutionFailedEvent | ExecutionDiffEvent>(
    event: TEvent,
    config: ExecutionNotificationConfig<TEvent>,
  ) {
    const job = await this.fetchJob(event.jobId);
    if (!job || !config.enabled(job)) return;

    await this.dispatchNotification(new NotificationEvent(
      event.userId,
      event.jobId,
      event.executionId,
      config.type,
      config.title(job),
      config.body(event),
    ));
  }

  private async dispatchNotification(event: NotificationEvent) {
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
