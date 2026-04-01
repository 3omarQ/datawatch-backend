import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { INotificationChannel } from '../interfaces/notification-channel.interface';
import { NotificationEvent } from '../events/notification.event';
import { WEBHOOK_TIMEOUT_MS, WEBHOOK_MAX_RETRIES } from '../constants';
@Injectable()
export class WebhookChannel implements INotificationChannel {
  private readonly logger = new Logger(WebhookChannel.name);

  async send(event: NotificationEvent, url: string): Promise<void> {
    const payload = this.buildPayload(event);
    await this.postWithRetry(url, payload);
  }

  private buildPayload(event: NotificationEvent) {
    return {
      type: event.type,
      title: event.title,
      body: event.body,
      jobId: event.jobId,
      executionId: event.executionId,
      timestamp: new Date().toISOString(),
    };
  }

  private async postWithRetry(url: string, payload: object, attempt = 1): Promise<void> {
    try {
      await axios.post(url, payload, { timeout: WEBHOOK_TIMEOUT_MS });
      this.logger.log(`Webhook delivered to ${url}`);
    } catch (error) {
      if (attempt < WEBHOOK_MAX_RETRIES) {
        this.logger.warn(`Webhook attempt ${attempt} failed, retrying...`);
        await this.postWithRetry(url, payload, attempt + 1);
      } else {
        this.logger.error(`Webhook failed after ${WEBHOOK_MAX_RETRIES} attempts: ${url}`);
      }
    }
  }
}