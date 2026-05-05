/**
 * Tunn Telegram Bot API-klient — bara sendMessage. Vi pullar inte in
 * grammy i dashboard/-bundlen (boten kör på Railway, dashboard på
 * Vercel). En enda fetch räcker för välkomst-notisen.
 */

const TELEGRAM_API = 'https://api.telegram.org';

export type SendMessageResult = {
  ok: true;
  message_id: number;
} | {
  ok: false;
  error: string;
};

export async function sendTelegramMessage(args: {
  token: string;
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
}): Promise<SendMessageResult> {
  const { token, chatId, text, parseMode = 'HTML' } = args;
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        link_preview_options: { is_disabled: true },
      }),
    });
    const json = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
    if (!json.ok || !json.result) {
      return { ok: false, error: json.description ?? 'unknown' };
    }
    return { ok: true, message_id: json.result.message_id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const WELCOME_MESSAGE = [
  '✅ Onboarding klar! Du är registrerad för KAMMAREN Watcher.',
  'Du får din första notis vid nästa körning (06:00 Stockholm).',
  'Skriv /help för commands.',
].join('\n');
