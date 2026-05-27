/**
 * Bygger notifikationsmeddelande för Telegram MarkdownV2.
 *
 * Designvalet (VIB-258): brutal minimalism. Notisen är två rader text +
 * en URL-knapp — titel + källa, ingenting mer. AI-genererad boilerplate
 * (severity-emoji, kategorier, per-notis-disclaimer, "läs hos källan"-länk)
 * är borta. Den enda gång ett disclaimer-element återinför sig är när
 * forbidden-word-validatorn slår till — då lägger vi in EN rad mellan
 * titel och källa: "_Informationstjänst, ej rådgivning._"
 *
 * Legal-foundation: per-notis-disclaimer ersätts av en gångs-disclaimer
 * vid /start, /legal och TERMS som användaren accepterar under signup.
 *
 * MarkdownV2 är finkänsligt: oescapeade special-tecken i fritext ger
 * 400 Bad Request från Telegram. Vi escapar all dynamisk text och
 * lägger format-markörer (`*`, `_`) som rå Markdown runt om.
 *
 * Spec: https://core.telegram.org/bots/api#markdownv2-style
 */

import type { Classification } from '../schema/classification.js';
import type { WatcherEvent } from '../../watcher/schema/event.js';

// Specialtecken som måste escapas i MarkdownV2-fritext (utanför URL-parens).
// Backslash hanteras separat eftersom det måste vara först — annars dubbel-escapas övriga.
const MARKDOWN_V2_SPECIALS = /[_*[\]()~`>#+\-=|{}.!]/g;

/**
 * Förbjudna ord i title/summary — om något detekteras lägger vi en
 * disclaimer-rad i notisen. Listan speglar mur-förstärkning #5: vi ska
 * aldrig kommunicera i rådgivande eller tidsstressande ton.
 *
 * "sista dag" är två ord och matchas som substring efter `toLowerCase`.
 */
export const FORBIDDEN_WORDS: ReadonlyArray<string> = [
  'rekommenderar',
  'bör',
  'viktigt',
  'kritiskt',
  'akut',
  'måste',
  'deadline',
  'sista dag',
  'imorgon',
  'snart',
];

export type InlineUrlButton = { text: string; url: string };
export type InlineKeyboardMarkup = { inline_keyboard: InlineUrlButton[][] };

export type FormattedNotification = {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
};

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
 * Returnerar true om någon `texts` innehåller något av FORBIDDEN_WORDS
 * (case-insensitive substring-match). Används för att avgöra om
 * notisen ska få en disclaimer-rad som safety net när LLM glider in i
 * rådgivande språk.
 */
export function detectForbiddenWords(...texts: ReadonlyArray<string>): boolean {
  const blob = texts.map((t) => t.toLowerCase()).join(' ');
  return FORBIDDEN_WORDS.some((word) => blob.includes(word));
}

/**
 * Mänsklig label för en käll-identifierare. Visas direkt i notisen
 * under titeln. Default-fallback returnerar raw source så vi aldrig
 * skickar tom källa.
 */
export function sourceLabel(source: WatcherEvent['source']): string {
  switch (source) {
    case 'skv':
      return 'Skatteverket';
    case 'riksdagen':
      return 'Riksdagen';
    default:
      return source;
  }
}

/**
 * Bygger Telegram-meddelandet för en (relevant) classification.
 * Returnerar text (MarkdownV2-formatterad) plus reply_markup med en
 * URL-knapp som pekar på event.url.
 *
 * Kastar Error om event.url saknas — URL-knappen kräver en länk.
 */
export function formatNotification(
  classification: Classification,
  event: WatcherEvent,
): FormattedNotification {
  if (!event.url || event.url.trim().length === 0) {
    throw new Error(
      `formatNotification: event.url saknas för event ${event.id} — URL-knappen kräver en länk`,
    );
  }

  const lines: string[] = [`*${escapeMarkdownV2(event.title)}*`];

  if (detectForbiddenWords(event.title, classification.summary)) {
    lines.push('_Informationstjänst, ej rådgivning\\._');
  }

  lines.push(sourceLabel(event.source));

  return {
    text: lines.join('\n'),
    replyMarkup: {
      inline_keyboard: [[{ text: '📄 Öppna', url: event.url }]],
    },
  };
}
