import { callHost } from './host';

/**
 * Send a system notification.
 * Requires: notification permission.
 */
export function send(title: string, body: string): void {
  callHost('cognia_notification_send', JSON.stringify({ title, body }));
}
