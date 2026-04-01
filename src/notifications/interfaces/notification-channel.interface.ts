import { NotificationEvent } from "../events/notification.event";

export interface INotificationChannel {
  send(event: NotificationEvent, url:string): Promise<void>;
}