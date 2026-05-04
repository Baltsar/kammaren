/**
 * Bygger notifikationsmeddelande för Telegram MarkdownV2.
 *
 * MarkdownV2 är finkänsligt: oescapeade special-tecken i fritext ger
 * 400 Bad Request från Telegram. Vi escapar all dynamisk text och
 * lägger format-markörer (`*`, `_`, `[label](url)`) som rå Markdown
 * runt om — markörerna själva escapas inte.
 *
 * Spec: https://core.telegram.org/bots/api#markdownv2-style
 */

import type { Classification, Severity } from '../schema/classification.js';
import type { WatcherEvent } from '../../watcher/schema/event.js';

const SEVERITY_EMOJI: Record<Severity, string> = {
  action_required: '⚠️',
  warning: '📌',
  info: 'ℹ️',
};

// Specialtecken som måste escapas i MarkdownV2-fritext (utanför URL-parens).
// Backslash hanteras separat eftersom det måste vara först — annars dubbel-escapas övriga.
const MARKDOWN_V2_SPECIALS = /[_*[\]()~`>#+\-=|{}.!]/g;

/**
 * Escapar fritext för Telegram MarkdownV2. Använd på alla värden som
 * kommer från event/classification innan de injectas i mall.
 */
export function escapeMarkdownV2(text: string): string {
  // Backslash först — annars infogar de övriga regex-bytena `\` som
  // sedan blir dubbel-escapade.
  return text.replace(/\\/g, '\\\\').replace(MARKDOWN_V2_SPECIALS, '\\$&');
}

/**
 * URL inom `[label](url)` har egna escape-regler — endast `)` och `\`
 * måste prefixas. Vi escapar även `(` defensivt så Telegrams parser
 * inte gör snedsteg om URL har balanserade parenteser.
 */
function escapeUrlForMarkdownV2(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
}

/**
 * Bygger Telegram-meddelandet för en (relevant) classification.
 * Returnerar en MarkdownV2-formatterad sträng som kan skickas direkt
 * via `bot.api.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' })`.
 */
export function formatNotification(
  classification: Classification,
  event: WatcherEvent,
): string {
  const emoji = SEVERITY_EMOJI[classification.severity];
  const title = escapeMarkdownV2(event.title);
  const tags = escapeMarkdownV2(classification.tags.join(', '));
  const severity = escapeMarkdownV2(classification.severity);
  const summary = escapeMarkdownV2(classification.summary || '(ingen sammanfattning)');
  const url = escapeUrlForMarkdownV2(event.url);

  return [
    '📋 *Skatte\\- eller regulatorisk uppdatering*',
    '',
    `*${title}*`,
    '',
    `_Kategori:_ ${tags}`,
    `_Allvar:_ ${emoji} ${severity}`,
    '',
    summary,
    '',
    `🔗 [Läs hos källan](${url})`,
  ].join('\n');
}
