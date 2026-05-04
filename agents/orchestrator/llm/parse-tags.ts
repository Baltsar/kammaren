/**
 * Hallucination-guard delad mellan LLM-providers.
 *
 * Båda providers anropar parseAndFilterTags() med rå LLM-output (sträng eller
 * redan-parsead JSON). Output är en sträng-array filtrerad mot ALL_CATEGORIES
 * + 'okand'. Belt-and-suspenders även när providern använder strict JSON
 * schema mode (Berget) — om SDK:n eller modellen någon gång läcker fritext
 * fångas det här.
 */

import {
  ALL_CATEGORIES,
  UNKNOWN_TAG,
  type Tag,
} from '../rules/categories.js';

const VALID_CATEGORIES: ReadonlySet<string> = new Set<string>([
  ...ALL_CATEGORIES,
  UNKNOWN_TAG,
]);

export function parseAndFilterTags(raw: string | unknown[], eventId: string): Tag[] {
  const parsed = typeof raw === 'string' ? extractJsonArray(raw) : raw;
  if (!Array.isArray(parsed)) return [];

  const valid: Tag[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    if (VALID_CATEGORIES.has(item)) {
      valid.push(item as Tag);
    } else {
      console.warn(`[llm-tagger] hallucinated category: ${item} (event ${eventId})`);
    }
  }
  return valid;
}

function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
