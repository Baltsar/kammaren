import { createHash } from 'node:crypto';

export type DeliveryChannel = 'telegram';

export type Delivery = {
  id: string;
  classification_id: string;
  channel: DeliveryChannel;
  chat_id: string;
  message_id: number;
  sent_at: string;
};

/**
 * Deterministiskt id per (classification, kanal). Gör det möjligt att
 * lägga till t.ex. e-post senare utan att kollidera mot Telegram-rader.
 */
export function makeDeliveryId(classificationId: string, channel: DeliveryChannel): string {
  return createHash('sha256').update(`${classificationId}:${channel}`).digest('hex').slice(0, 16);
}
