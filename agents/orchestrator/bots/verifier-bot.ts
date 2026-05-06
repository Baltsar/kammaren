/**
 * Verifier-bot — @kammarenverifyBOT
 *
 * Single-purpose: returnerar användarens Telegram chat_id så hen kan
 * klistra in det i webb-onboardingen på kammaren.nu/watcher/start.
 * Ingen state, ingen vault-skrivning, inga andra commands.
 *
 * Token via env: TELEGRAM_BOT_TOKEN_VERIFIER (separat från
 * TELEGRAM_BOT_TOKEN som driver delivery + watcher-bot).
 *
 * Deploy: Railway long-running worker. Lokalt: `bun run bot:verifier`.
 */

import '../../../src/load-env.js';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Bot, type Context } from 'grammy';
import { buildVerifierMessage } from './verifier-bot.lib.js';

const TOKEN_ENV = 'TELEGRAM_BOT_TOKEN_VERIFIER';
const DEFAULT_ONBOARD_URL = 'https://kammaren.nu/watcher/start';

async function sendVerifyMessage(ctx: Context, onboardUrl: string): Promise<void> {
  if (!ctx.chat) return;
  const text = buildVerifierMessage(String(ctx.chat.id), onboardUrl);
  await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

export function createVerifierBot(
  token: string,
  onboardUrl: string = DEFAULT_ONBOARD_URL,
): Bot {
  const bot = new Bot(token);

  bot.command('start', (ctx) => sendVerifyMessage(ctx, onboardUrl));

  // Verifier-boten har inga andra commands. Allt annat → samma /start-svar.
  bot.on('message', (ctx) => sendVerifyMessage(ctx, onboardUrl));

  return bot;
}

async function main(): Promise<void> {
  const token = process.env[TOKEN_ENV];
  if (!token) {
    console.error(`[verifier-bot] ${TOKEN_ENV} saknas i env`);
    process.exit(1);
  }

  const bot = createVerifierBot(token);
  const stop = (): void => {
    console.log('[verifier-bot] stänger ner...');
    void bot.stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  console.log('[verifier-bot] startar long-polling...');
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
