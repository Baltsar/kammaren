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

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bot, type Context } from 'grammy';
import { gdprDelete } from '../cli.js';
import {
  list as listProfiles,
  patch as patchProfile,
  read as readProfile,
} from '../../watcher/customer-profile/store.js';
import type { CustomerProfile } from '../../watcher/customer-profile/types.js';
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

export type WatcherBotDeps = {
  vaultDir?: string;
  deliveriesPath?: string;
  now?: () => Date;
};

type ForgetPending = { orgnr: string; expiresAt: number };

async function findProfileByChatId(
  chatId: string,
  vaultDir?: string,
): Promise<CustomerProfile | null> {
  const orgnrs = await listProfiles(vaultDir ? { vaultDir } : undefined);
  for (const orgnr of orgnrs) {
    const profile = await readProfile(orgnr, vaultDir ? { vaultDir } : undefined);
    if (profile?.telegram_chat_id === chatId && !profile.meta?.deleted_at) {
      return profile;
    }
  }
  return null;
}

async function loadDeliveries(deliveriesPath: string): Promise<Delivery[]> {
  let raw: string;
  try {
    raw = await readFile(deliveriesPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: Delivery[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Delivery);
    } catch {
      // best-effort, hoppa över skitrader
    }
  }
  return out;
}

function deliveryStatsForChat(
  deliveries: Delivery[],
  chatId: string,
): { count: number; lastAt: Date | null } {
  let count = 0;
  let lastAt: Date | null = null;
  for (const delivery of deliveries) {
    if (delivery.chat_id !== chatId) continue;
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
  const vaultDir = deps.vaultDir;
  const deliveriesPath = deps.deliveriesPath ?? DEFAULT_DELIVERIES_PATH;
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
    const profile = await findProfileByChatId(chatId, vaultDir);
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
    const profile = await findProfileByChatId(chatId, vaultDir);
    if (!profile) {
      await reply(ctx, buildNotRegisteredMessage());
      return;
    }
    const deliveries = await loadDeliveries(deliveriesPath);
    const stats = deliveryStatsForChat(deliveries, chatId);
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
    const profile = await findProfileByChatId(chatId, vaultDir);
    if (!profile) {
      await reply(ctx, buildNotRegisteredMessage());
      return;
    }
    const wasPaused = profile.is_paused === true;
    if (!wasPaused) {
      await patchProfile(
        profile.company_identity.company_registration_number,
        { is_paused: true },
        vaultDir ? { vaultDir } : undefined,
      );
    }
    await reply(ctx, buildPauseMessage(wasPaused));
  });

  bot.command('resume', async (ctx) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const profile = await findProfileByChatId(chatId, vaultDir);
    if (!profile) {
      await reply(ctx, buildNotRegisteredMessage());
      return;
    }
    const wasActive = profile.is_paused !== true;
    if (!wasActive) {
      await patchProfile(
        profile.company_identity.company_registration_number,
        { is_paused: false },
        vaultDir ? { vaultDir } : undefined,
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
    const profile = await findProfileByChatId(chatId, vaultDir);
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
        const result = await gdprDelete(pending.orgnr, vaultDir ? { vaultDir } : undefined);
        pendingDeletes.delete(chatId);
        if (result.status === 'already_deleted') {
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

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void main();
}
