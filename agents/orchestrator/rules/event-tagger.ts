import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  ACTION_KEYWORDS,
  CATEGORY_KEYWORDS,
  UNKNOWN_TAG,
  type Tag,
} from './categories.js';

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o');
}

function extractSummary(raw: Record<string, unknown>): string {
  const summary = raw['summary'];
  return typeof summary === 'string' ? summary : '';
}

export function buildHaystack(event: WatcherEvent): string {
  return normalize([event.title, event.url, extractSummary(event.raw)].join(' '));
}

export function tagEvent(event: WatcherEvent): Tag[] {
  const haystack = buildHaystack(event);
  const matched: Tag[] = [];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(normalize(kw)))) {
      matched.push(category as Tag);
    }
  }
  return matched.length > 0 ? matched : [UNKNOWN_TAG];
}

export function hasActionKeyword(event: WatcherEvent): boolean {
  const haystack = buildHaystack(event);
  return ACTION_KEYWORDS.some((kw) => haystack.includes(normalize(kw)));
}
