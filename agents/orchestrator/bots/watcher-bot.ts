/**
 * Watcher-bot — commands /start, /help, /status, /pause, /resume,
 * /legal, /forget. Mottar inte text utöver kommandon (utom under
 * /forget-bekräftelsen då vi väntar på "RADERA").
 *
 * Token via env: TELEGRAM_BOT_TOKEN (DELAS med agents/orchestrator/
 * delivery.ts — Watcher-notiserna går från samma bot som hanterar
 * commands för konsistent avsändar-id i Telegram-klienten).
 *
 * Deploy: Railway long-running worker. Lokalt: `bun run bot:watcher`.
 */

import '../../../src/load-env.js';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bot, type Context } from 'grammy';
import type { SupabaseClient } from '@supabase/supabase-js';
import { gdprDelete } from '../cli.js';
import {
  list as listProfiles,
  patch as patchProfile,
  read as readProfile,
} from '../../watcher/customer-profile/store.js';
import type { CustomerProfile } from '../../watcher/customer-profile/types.js';
import type { Classification } from '../schema/classification.js';
import type { Delivery } from '../schema/delivery.js';
import {
  FORGET_CONFIRM_TOKEN,
  FORGET_TIMEOUT_MS,
  buildForgetAlreadyDeletedMessage,
  buildForgetCompletedMessage,
  buildForgetExpiredMessage,
  buildForgetPromptMessage,
  buildHelpMessage,
  buildLegalMessage,
  buildNotRegisteredMessage,
  buildPauseMessage,
  buildResumeMessage,
  buildStartRegisteredMessage,
  buildStartUnregisteredMessage,
  buildStatusMessage,
  buildUnknownMessage,
} from './watcher-bot.lib.js';

const TOKEN_ENV = 'TELEGRAM_BOT_TOKEN';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DELIVERIES_PATH = path.resolve(here, '..', 'data', 'deliveries.jsonl');
const DEFAULT_CLASSIFICATIONS_PATH = path.resolve(here, '..', 'data', 'classifications.jsonl');

export type WatcherBotDeps = {
  /** Inject SupabaseClient (för tester). Default: env-backed singleton i store.ts. */
  supabaseClient?: SupabaseClient;
  deliveriesPath?: string;
  classificationsPath?: string;
  now?: () => Date;
};

type ForgetPending = { orgnr: string; expiresAt: number };

function storeOpts(client?: SupabaseClient) {
  return client ? { client } : undefined;
}

async function findProfileByChatId(
  chatId: string,
  client?: SupabaseClient,
): Promise<CustomerProfile | null> {
  const orgnrs = await listProfiles(storeOpts(client));
  for (const orgnr of orgnrs) {
    const profile = await readProfile(orgnr, storeOpts(client));
    if (profile?.telegram_chat_id === chatId && !profile.meta?.deleted_at) {
      return profile;
    }
  }
  return null;
}

async function loadJsonl<T>(filePath: string): Promise<T[]> {
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
    } catch {
      // best-effort, hoppa över skitrader
    }
  }
  return out;
}

/**
 * Räknar deliveries för en given orgnr genom att gå
 * classifications → classification_id → deliveries.
 *
 * Tidigare matchade vi på `delivery.chat_id` men det fältet ligger inte
 * längre i loggen (publik repo, se PRIVACY.md § 3.4). Joinen via
 * classifications kostar en extra fil-läsning men sparar PII-läckan.
 */
function deliveryStatsForOrgnr(
  deliveries: Delivery[],
  classifications: Classification[],
  orgnr: string,
): { count: number; lastAt: Date | null } {
  const orgnrClassificationIds = new Set(
    classifications
      .filter((c) => c.customer_orgnr === orgnr)
      .map((c) => c.id),
  );
  let count = 0;
  let lastAt: Date | null = null;
  for (const delivery of deliveries) {
    if (!orgnrClassificationIds.has(delivery.classification_id)) continue;
    count += 1;
    const sent = new Date(delivery.sent_at);
    if (!lastAt || sent > lastAt) lastAt = sent;
  }
  return { count, lastAt };
}

async function reply(ctx: Context, text: string): Promise<void> {
  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

export function createWatcherBot(token: string, deps: WatcherBotDeps = {}): Bot {
  const bot = new Bot(token);
  const now = deps.now ?? (() => new Date());
  const supabaseClient = deps.supabaseClient;
  const deliveriesPath = deps.deliveriesPath ?? DEFAULT_DELIVERIES_PATH;
  const classificationsPath = deps.classificationsPath ?? DEFAULT_CLASSIFICATIONS_PATH;
  const pendingDeletes = new Map<string, ForgetPending>();

  function getPending(chatId: string): ForgetPending | null {
    const pending = pendingDeletes.get(chatId);
    if (!pending) return null;
    if (pending.expiresAt < now().getTime()) {
      pendingDeletes.delete(chatId);
      return null;
    }
    return pending;
  }

  bot.command('start', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const profile = await findProfileByChatId(chatId, supabaseClient);
    if (profile) {
      await reply(ctx, buildStartRegisteredMessage(profile));
    } else {
      await reply(ctx, buildStartUnregisteredMessage(chatId));
    }
  });

  bot.command('help', async (ctx) => {
    await reply(ctx, buildHelpMessage());
  });

  bot.command('status', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const profile = await findProfileByChatId(chatId, supabaseClient);
    if (!profile) {
      await reply(ctx, buildNotRegisteredMessage());
      return;
    }
    const [deliveries, classifications] = await Promise.all([
      loadJsonl<Delivery>(deliveriesPath),
      loadJsonl<Classification>(classificationsPath),
    ]);
    const stats = deliveryStatsForOrgnr(
      deliveries,
      classifications,
      profile.company_identity.company_registration_number,
    );
    await reply(
      ctx,
      buildStatusMessage({
        profile,
        deliveryCount: stats.count,
        lastDeliveryAt: stats.lastAt,
        now: now(),
      }),
    );
  });

  bot.command('pause', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const profile = await findProfileByChatId(chatId, supabaseClient);
    if (!profile) {
      await reply(ctx, buildNotRegisteredMessage());
      return;
    }
    const wasPaused = profile.is_paused === true;
    if (!wasPaused) {
      await patchProfile(
        profile.company_identity.company_registration_number,
        { is_paused: true },
        storeOpts(supabaseClient),
      );
    }
    await reply(ctx, buildPauseMessage(wasPaused));
  });

  bot.command('resume', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const profile = await findProfileByChatId(chatId, supabaseClient);
    if (!profile) {
      await reply(ctx, buildNotRegisteredMessage());
      return;
    }
    const wasActive = profile.is_paused !== true;
    if (!wasActive) {
      await patchProfile(
        profile.company_identity.company_registration_number,
        { is_paused: false },
        storeOpts(supabaseClient),
      );
    }
    await reply(ctx, buildResumeMessage(wasActive));
  });

  bot.command('legal', async (ctx) => {
    await reply(ctx, buildLegalMessage());
  });

  bot.command('forget', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const profile = await findProfileByChatId(chatId, supabaseClient);
    if (!profile) {
      await reply(ctx, buildNotRegisteredMessage());
      return;
    }
    const orgnr = profile.company_identity.company_registration_number;
    pendingDeletes.set(chatId, {
      orgnr,
      expiresAt: now().getTime() + FORGET_TIMEOUT_MS,
    });
    await reply(ctx, buildForgetPromptMessage(orgnr));
  });

  bot.on('message:text', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const text = ctx.message.text;

    // /forget-bekräftelse i sin egen state-machine. Andra commands
    // hanteras tidigare i pipelinen (bot.command-handlers körs först).
    const pending = getPending(chatId);
    if (pending) {
      if (text === FORGET_CONFIRM_TOKEN) {
        const result = await gdprDelete(
          pending.orgnr,
          supabaseClient ? { supabaseClient } : undefined,
        );
        pendingDeletes.delete(chatId);
        if (result.status === 'not_found') {
          await reply(ctx, buildForgetAlreadyDeletedMessage());
        } else {
          await reply(ctx, buildForgetCompletedMessage());
        }
        return;
      }
      // pending finns men de skrev inte RADERA → låt det ligga kvar
      // tills timeout, men berätta vad vi väntar på.
      await reply(ctx, buildForgetPromptMessage(pending.orgnr));
      return;
    }

    // Kontrollera om en tidigare pending har gått ut
    if (pendingDeletes.has(chatId)) {
      pendingDeletes.delete(chatId);
      await reply(ctx, buildForgetExpiredMessage());
      return;
    }

    await reply(ctx, buildUnknownMessage());
  });

  return bot;
}

async function main(): Promise<void> {
  const token = process.env[TOKEN_ENV];
  if (!token) {
    console.error(`[watcher-bot] ${TOKEN_ENV} saknas i env`);
    process.exit(1);
  }

  const bot = createWatcherBot(token);
  const stop = (): void => {
    console.log('[watcher-bot] stänger ner...');
    void bot.stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  console.log('[watcher-bot] startar long-polling...');
  await bot.start();
}

function isMainEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainEntrypoint()) {
  void main();
}
