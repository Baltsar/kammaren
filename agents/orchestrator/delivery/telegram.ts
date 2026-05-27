/**
 * Telegram-leveransadapter — wrappar grammy `Bot.api.sendMessage` med
 * lazy default-klient och dependency injection för tester.
 *
 * Designvalet att bygga klienten lazy gör att process som inte skickar
 * ett enda meddelande (t.ex. CI-körningar utan severity-träffar) slipper
 * öppna en HTTP-koppling till Telegram. Samma DI-mönster som llm-tagger.
 */

import { Bot } from 'grammy';
import type { InlineKeyboardMarkup } from './format.js';

export type SendTelegramOptions = {
  /** Inject grammy Bot för tester. Default: lazy från TELEGRAM_BOT_TOKEN. */
  client?: Bot;
  /** Override token (mest för tester med riktig Bot-instans). */
  token?: string;
  /** Telegram inline_keyboard — t.ex. URL-knapp under meddelandet. */
  replyMarkup?: InlineKeyboardMarkup;
};

export type SendTelegramResult = {
  message_id: number;
};

let defaultClient: Bot | null = null;

function getDefaultClient(token?: string): Bot | null {
  if (defaultClient) return defaultClient;
  const t = token ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!t) return null;
  defaultClient = new Bot(t);
  return defaultClient;
}

/**
 * Skickar `message` (MarkdownV2-formatterat) till `chatId` via Telegram.
 *
 * `chatId` lagras som string i kundprofiler för att inte trunkeras vid
 * gruppchattar (>2^53). Telegrams API accepterar både string och number.
 *
 * Kastar vid Telegram-API-fel — caller (delivery.ts) loggar och fortsätter
 * med nästa kund.
 */
export async function sendTelegram(
  chatId: string,
  message: string,
  options: SendTelegramOptions = {},
): Promise<SendTelegramResult> {
  const client = options.client ?? getDefaultClient(options.token);
  if (!client) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN saknas — sätt i .env eller skicka in `client`/`token` i opts.',
    );
  }

  const apiOptions: Parameters<typeof client.api.sendMessage>[2] = {
    parse_mode: 'MarkdownV2',
    link_preview_options: { is_disabled: true },
  };
  if (options.replyMarkup) {
    apiOptions.reply_markup = options.replyMarkup;
  }

  const response = await client.api.sendMessage(chatId, message, apiOptions);

  return { message_id: response.message_id };
}

/** Test-only — clear cached default client. Inte exporterad i produktion. */
export function __resetDefaultClientForTests(): void {
  defaultClient = null;
}
