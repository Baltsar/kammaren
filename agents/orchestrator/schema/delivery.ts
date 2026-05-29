import { createHash } from 'node:crypto';

export type DeliveryChannel = 'telegram';

/**
 * Persistent leveransrad i `deliveries.jsonl`. Innehåller AVSIKTLIGT
 * INGET `chat_id` — append-only-loggen committas till publik repo och
 * får inte läcka Telegram-användar-ID (pseudonymisering enligt
 * PRIVACY.md § 3.4).
 *
 * Behöver du hämta deliveries för en specifik kund: gå via
 * `classifications.jsonl` (`Classification.customer_orgnr`) → mappa till
 * `classification_id` → filtrera deliveries på `classification_id`.
 */
export type Delivery = {
  id: string;
  classification_id: string;
  channel: DeliveryChannel;
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
