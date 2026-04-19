/**
 * Telegram adapter — Grammy bot → handleMessage
 *
 * ⚠️  WIP — beror på ../chat-handler.ts som är ej färdig i publika repot
 *     (kräver agents/ceo/SOUL.md m.fl.). Boten startar men kraschar vid
 *     första meddelandet. Kör inte mot en publik Telegram-bot utan
 *     operatörsmedvetenhet — ingen autentisering, alla som hittar botens
 *     @-namn kan interagera.
 */

import '../load-env.js';
import { Bot } from 'grammy';
import { handleMessage } from '../chat-handler.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN saknas i .env');
  process.exit(1);
}

const bot = new Bot(token);

bot.command('start', (ctx) =>
  ctx.reply('Hej! Jag är Falk, din AI-drivna VD-assistent. Skriv din fråga.'),
);

bot.on('message:text', async (ctx) => {
  const userId = String(ctx.from.id);
  try {
    const res = await handleMessage({ message: ctx.message.text, userId });
    await ctx.reply(res.text, {
      reply_markup: res.actions
        ? {
            inline_keyboard: [
              res.actions.map((a) => ({
                text: a.label,
                callback_data: a.action,
              })),
            ],
          }
        : undefined,
    });
  } catch (err) {
    console.error('Fel vid hantering:', err);
    await ctx.reply('Ett fel uppstod. Försök igen.');
  }
});

bot.on('callback_query:data', async (ctx) => {
  const userId = String(ctx.from.id);
  const action = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();
  try {
    const res = await handleMessage({ message: action, userId });
    await ctx.reply(res.text);
  } catch (err) {
    console.error('Fel vid callback:', err);
    await ctx.reply('Ett fel uppstod. Försök igen.');
  }
});

// Graceful shutdown
const stop = () => {
  console.log('Stänger ner bot...');
  bot.stop();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

console.log('Telegram-bot startar...');
bot.start();
