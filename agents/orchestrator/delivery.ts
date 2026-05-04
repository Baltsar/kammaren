/**
 * Delivery — skickar relevanta classifications som Telegram-notiser.
 *
 * Filtrerar bort severity=info och relevant=false, slår upp event och
 * kund-profil, formaterar MarkdownV2-meddelande och kallar `send` med
 * `(chatId, message)`. Idempotent via deterministisk
 * `delivery_id = sha256(classification_id + ':telegram').slice(0,16)`
 * — andra körningen läser tidigare delivery_ids och hoppar över.
 *
 * Krasch-säker: en misslyckad leverans (Telegram 400, profil-fel,
 * orphan-classification) loggas men stoppar inte nästa kund.
 */

import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read as readProfile } from '../watcher/customer-profile/store.js';
import type { CustomerProfile } from '../watcher/customer-profile/types.js';
import { hasFullConsent } from '../watcher/customer-profile/types.js';
import { loadExistingIds } from '../watcher/poller/dedupe.js';
import type { WatcherEvent } from '../watcher/schema/event.js';
import { formatNotification } from './delivery/format.js';
import { sendTelegram } from './delivery/telegram.js';
import type { Classification } from './schema/classification.js';
import type { Delivery } from './schema/delivery.js';
import { makeDeliveryId } from './schema/delivery.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_PATH = path.resolve(here, '..', 'watcher', 'data', 'events.jsonl');
const CLASSIFICATIONS_PATH = path.resolve(here, 'data', 'classifications.jsonl');
const DELIVERIES_PATH = path.resolve(here, 'data', 'deliveries.jsonl');

export type SendFn = (chatId: string, message: string) => Promise<{ message_id: number }>;

export type DeliveryOptions = {
  eventsPath?: string;
  classificationsPath?: string;
  deliveriesPath?: string;
  vaultDir?: string;
  now?: () => Date;
  /** Inject Telegram-skick för tester. Default: agents/orchestrator/delivery/telegram.sendTelegram. */
  send?: SendFn;
};

export type RunDeliveryResult = {
  attempted: number;
  sent: number;
  skipped_existing: number;
  skipped_severity: number;
  skipped_no_chat_id: number;
  skipped_no_customer: number;
  skipped_no_event: number;
  skipped_no_consent: number;
  errors: number;
};

function emptyResult(): RunDeliveryResult {
  return {
    attempted: 0,
    sent: 0,
    skipped_existing: 0,
    skipped_severity: 0,
    skipped_no_chat_id: 0,
    skipped_no_customer: 0,
    skipped_no_event: 0,
    skipped_no_consent: 0,
    errors: 0,
  };
}

async function loadJsonl<T>(filePath: string, label: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: T[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch (err) {
      console.warn(`[delivery] skipping malformed ${label} line: ${(err as Error).message}`);
    }
  }
  return out;
}

function chatIdFor(profile: CustomerProfile): string | null {
  const id = profile.telegram_chat_id;
  if (typeof id === 'string' && id.length > 0) return id;
  return null;
}

function shouldDeliver(classification: Classification): boolean {
  if (!classification.relevant) return false;
  return classification.severity === 'action_required' || classification.severity === 'warning';
}

const defaultSend: SendFn = async (chatId, message) => sendTelegram(chatId, message);

export async function runDelivery(
  options: DeliveryOptions = {},
): Promise<RunDeliveryResult> {
  const eventsPath = options.eventsPath ?? EVENTS_PATH;
  const classificationsPath = options.classificationsPath ?? CLASSIFICATIONS_PATH;
  const deliveriesPath = options.deliveriesPath ?? DELIVERIES_PATH;
  const now = options.now ?? (() => new Date());
  const send = options.send ?? defaultSend;
  const result = emptyResult();

  const [events, classifications, existing] = await Promise.all([
    loadJsonl<WatcherEvent>(eventsPath, 'event'),
    loadJsonl<Classification>(classificationsPath, 'classification'),
    loadExistingIds(deliveriesPath),
  ]);

  const eventById = new Map<string, WatcherEvent>();
  for (const event of events) eventById.set(event.id, event);

  const profileCache = new Map<string, CustomerProfile | null>();
  async function getProfile(orgnr: string): Promise<CustomerProfile | null> {
    if (profileCache.has(orgnr)) return profileCache.get(orgnr) ?? null;
    let profile: CustomerProfile | null = null;
    try {
      profile = await readProfile(orgnr, options.vaultDir ? { vaultDir: options.vaultDir } : undefined);
    } catch (err) {
      console.error(
        `[delivery] kunde inte läsa profil för ${orgnr}: ${(err as Error).message}`,
      );
    }
    profileCache.set(orgnr, profile);
    return profile;
  }

  const lines: string[] = [];

  for (const classification of classifications) {
    if (!shouldDeliver(classification)) {
      result.skipped_severity += 1;
      continue;
    }

    result.attempted += 1;

    const deliveryId = makeDeliveryId(classification.id, 'telegram');
    if (existing.has(deliveryId)) {
      result.skipped_existing += 1;
      continue;
    }

    const event = eventById.get(classification.event_id);
    if (!event) {
      console.warn(
        `[delivery] saknat event ${classification.event_id} för classification ${classification.id} — hoppar över`,
      );
      result.skipped_no_event += 1;
      continue;
    }

    const profile = await getProfile(classification.customer_orgnr);
    if (!profile) {
      console.warn(
        `[delivery] saknad kund-profil för ${classification.customer_orgnr} — hoppar över`,
      );
      result.skipped_no_customer += 1;
      continue;
    }

    if (!hasFullConsent(profile)) {
      console.warn(
        `[delivery] no consent för ${classification.customer_orgnr} — hoppar över ${classification.id}`,
      );
      result.skipped_no_consent += 1;
      continue;
    }

    const chatId = chatIdFor(profile);
    if (!chatId) {
      console.warn(
        `[delivery] no chat_id for ${classification.customer_orgnr} — hoppar över ${classification.id}`,
      );
      result.skipped_no_chat_id += 1;
      continue;
    }

    let message: string;
    try {
      message = formatNotification(classification, event);
    } catch (err) {
      console.error(
        `[delivery] kunde inte formattera meddelande för ${classification.id}: ${(err as Error).message}`,
      );
      result.errors += 1;
      continue;
    }

    let sendResult: { message_id: number };
    try {
      sendResult = await send(chatId, message);
    } catch (err) {
      console.error(
        `[delivery] sendTelegram misslyckades för ${classification.customer_orgnr} (${classification.id}): ${(err as Error).message}`,
      );
      result.errors += 1;
      continue;
    }

    const delivery: Delivery = {
      id: deliveryId,
      classification_id: classification.id,
      channel: 'telegram',
      chat_id: chatId,
      message_id: sendResult.message_id,
      sent_at: now().toISOString(),
    };

    existing.add(deliveryId);
    lines.push(JSON.stringify(delivery));
    result.sent += 1;
  }

  if (lines.length > 0) {
    await appendFile(deliveriesPath, `${lines.join('\n')}\n`, 'utf8');
  }

  return result;
}
