import { NotificationType } from "src/generated/prisma/enums";

export class NotificationEvent {
  constructor(
    public readonly userId: string,
    public readonly jobId: string,
    public readonly executionId: string,
    public readonly type: NotificationType,
    public readonly title: string,
    public readonly body: string,
    //public readonly webhookUrl: string | null,
  ) {}
}