import type { Bot } from 'grammy';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetDefaultClientForTests, sendTelegram } from './telegram.js';

type MockBot = { api: { sendMessage: ReturnType<typeof vi.fn> } };

function makeMockBot(messageId = 42): { client: Bot; sendMessage: ReturnType<typeof vi.fn> } {
  const sendMessage = vi.fn(async () => ({ message_id: messageId }));
  const client = { api: { sendMessage } } as unknown as Bot;
  return { client, sendMessage };
}

describe('sendTelegram', () => {
  afterEach(() => {
    __resetDefaultClientForTests();
    vi.restoreAllMocks();
  });

  it('anropar bot.api.sendMessage med chatId, meddelande och parse_mode=MarkdownV2', async () => {
    const { client, sendMessage } = makeMockBot();

    await sendTelegram('123456789', '*hej*', { client });

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      '123456789',
      '*hej*',
      expect.objectContaining({ parse_mode: 'MarkdownV2' }),
    );
  });

  it('returnerar message_id från Telegrams response', async () => {
    const { client } = makeMockBot(987654321);

    const result = await sendTelegram('123', 'msg', { client });

    expect(result).toEqual({ message_id: 987654321 });
  });

  it('hoppar över link-preview för att hålla notisen kompakt', async () => {
    const { client, sendMessage } = makeMockBot();

    await sendTelegram('123', 'msg', { client });

    const opts = sendMessage.mock.calls[0][2] as Record<string, unknown>;
    // disable_notification ska inte sättas (vi vill ju notifiera).
    // link_preview_options.is_disabled = true gör att stora preview inte tar över.
    expect(opts.link_preview_options).toEqual({ is_disabled: true });
  });

  it('propagerar fel uppåt så delivery kan logga och fortsätta med nästa kund', async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error('Bad Request: chat not found');
    });
    const client = { api: { sendMessage } } as unknown as Bot;

    await expect(sendTelegram('999', 'msg', { client })).rejects.toThrow(
      /chat not found/,
    );
  });

  it('kastar tydligt fel när varken client eller token finns', async () => {
    const original = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    __resetDefaultClientForTests();

    try {
      await expect(sendTelegram('123', 'msg')).rejects.toThrow(
        /TELEGRAM_BOT_TOKEN/,
      );
    } finally {
      if (original !== undefined) process.env.TELEGRAM_BOT_TOKEN = original;
    }
  });

  it('chatId kan vara numerisk sträng — Telegram-API tar både string och number', async () => {
    // I våra profiler lagrar vi chat_id som string. Verifiera att vi inte
    // tvångskonverterar till number (som skulle överflöda för >2^53).
    const { client, sendMessage } = makeMockBot();
    await sendTelegram('-100123456789', 'msg', { client });
    expect(sendMessage).toHaveBeenCalledWith(
      '-100123456789',
      'msg',
      expect.anything(),
    );
  });
});
