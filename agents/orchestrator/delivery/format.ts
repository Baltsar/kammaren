/**
 * Bygger notifikationsmeddelande för Telegram MarkdownV2.
 *
 * MarkdownV2 är finkänsligt: oescapeade special-tecken i fritext ger
 * 400 Bad Request från Telegram. Vi escapar all dynamisk text och
 * lägger format-markörer (`*`, `_`, `[label](url)`) som rå Markdown
 * runt om — markörerna själva escapas inte.
 *
 * Spec: https://core.telegram.org/bots/api#markdownv2-style
 *
 * Legal-foundation (VIB-260): varje notis avslutas med två obligatoriska
 * disclaimer-rader (info-tjänst-flagga + AI-flagga) och en auto-varning
 * om title eller summary innehåller "rådgivande" språk. event.url är
 * obligatorisk — saknas den kastar vi för att aldrig leverera utan
 * primärkällans länk.
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
 * Förbjudna ord i title/summary — om något detekteras lägger vi en
 * auto-varning i footer. Listan speglar mur-förstärkning #5: vi ska
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
 * Returnerar true om `texts` innehåller något av FORBIDDEN_WORDS
 * (case-insensitive substring-match). Används för att avgöra om
 * notisen ska få en extra "OBS"-varning utöver standard-disclaimer.
 */
export function detectForbiddenWords(...texts: ReadonlyArray<string>): boolean {
  const blob = texts.map((t) => t.toLowerCase()).join(' ');
  return FORBIDDEN_WORDS.some((word) => blob.includes(word));
}

/**
 * Bygger Telegram-meddelandet för en (relevant) classification.
 * Returnerar en MarkdownV2-formatterad sträng som kan skickas direkt
 * via `bot.api.sendMessage(chatId, msg, { parse_mode: 'MarkdownV2' })`.
 *
 * Kastar Error om event.url saknas — primärkällans länk är obligatorisk
 * för att uppfylla informationstjänst-positioneringen i TERMS § 10.
 */
export function formatNotification(
  classification: Classification,
  event: WatcherEvent,
): string {
  if (!event.url || event.url.trim().length === 0) {
    throw new Error(
      `formatNotification: event.url saknas för event ${event.id} — primärkälla är obligatorisk`,
    );
  }

  const emoji = SEVERITY_EMOJI[classification.severity];
  const title = escapeMarkdownV2(event.title);
  const tags = escapeMarkdownV2(classification.tags.join(', '));
  const severity = escapeMarkdownV2(classification.severity);
  const summary = escapeMarkdownV2(classification.summary || '(ingen sammanfattning)');
  const url = escapeUrlForMarkdownV2(event.url);
  const urlAsText = escapeMarkdownV2(event.url);

  const lines: string[] = [
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
    '',
    `⚠️ Informationsnotis — ej rådgivning\\. Verifiera alltid mot primärkälla: [${urlAsText}](${url})`,
    '🤖 AI\\-genererad klassificering — kan innehålla fel\\.',
  ];

  if (detectForbiddenWords(event.title, classification.summary)) {
    lines.push(
      'OBS: Detta är information, inte rådgivning\\. Klicka för att verifiera mot källan\\.',
    );
  }

  return lines.join('\n');
}
