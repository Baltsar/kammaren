/**
 * LLM-tagger — fallback för events som keyword-classifiern inte kunde tagga.
 *
 * Anropas endast när tagEvent() returnerar exakt ['okand'] för en event.
 * Returnerar samma kategorier som keyword-pathen (importerade från
 * categories.ts — single source of truth, framtida ändringar görs där).
 *
 * Krasch-säker: timeout, rate-limit, malformed JSON eller hallucinerade
 * kategorier faller tillbaka till ['okand'] med method 'llm-okand'.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import { ALL_CATEGORIES, UNKNOWN_TAG, type Category, type Tag } from './categories.js';

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;
const SUMMARY_LIMIT = 1500;
const REQUEST_TIMEOUT_MS = 30_000;

export type LlmUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

export type LlmTaggerResult = {
  tags: Tag[];
  /** 'llm' = LLM gav minst en giltig icke-okand kategori; 'llm-okand' = fallback. */
  outcome: 'llm' | 'llm-okand';
  usage: LlmUsage;
};

const ZERO_USAGE: LlmUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

/**
 * Haiku 4.5 priser per 1M tokens (USD).
 * Cache read = 0.1×, cache write (5min ephemeral) = 1.25×.
 * Kalla in mot llm-tagger.test.ts om priset ändras.
 */
const HAIKU_PRICE_INPUT_PER_M = 1.0;
const HAIKU_PRICE_OUTPUT_PER_M = 5.0;
const HAIKU_PRICE_CACHE_WRITE_PER_M = HAIKU_PRICE_INPUT_PER_M * 1.25;
const HAIKU_PRICE_CACHE_READ_PER_M = HAIKU_PRICE_INPUT_PER_M * 0.1;

export function estimateLlmCostUsd(usage: LlmUsage): number {
  const input = (usage.input_tokens * HAIKU_PRICE_INPUT_PER_M) / 1_000_000;
  const output = (usage.output_tokens * HAIKU_PRICE_OUTPUT_PER_M) / 1_000_000;
  const cacheWrite =
    (usage.cache_creation_input_tokens * HAIKU_PRICE_CACHE_WRITE_PER_M) / 1_000_000;
  const cacheRead =
    (usage.cache_read_input_tokens * HAIKU_PRICE_CACHE_READ_PER_M) / 1_000_000;
  return input + output + cacheWrite + cacheRead;
}

let defaultClient: Anthropic | null = null;

function getDefaultClient(): Anthropic | null {
  if (defaultClient) return defaultClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  defaultClient = new Anthropic({ apiKey });
  return defaultClient;
}

function buildSystemPrompt(): Anthropic.TextBlockParam[] {
  const categoryList = ALL_CATEGORIES.map((c) => `  - ${c}`).join('\n');
  const text = `Du klassificerar svenska regulatoriska händelser (lagar, förordningar, föreskrifter från Riksdagen och Skatteverket) mot ett fast set kategorier som påverkar svenska aktiebolag.

Tillgängliga kategorier:
${categoryList}
  - okand

Regler:
1. Returnera ENDAST en JSON-array av strängar, inget annat. Inga prosabeskrivningar, ingen markdown, inga kommentarer.
2. Använd endast kategorier från listan ovan. Hitta inte på nya.
3. Flera kategorier är tillåtet om händelsen rör flera områden.
4. Om händelsen inte berör aktiebolag (t.ex. djurskydd, vapen, fiske, körkort), returnera ["irrelevant_for_ab"].
5. Om du genuint inte kan avgöra kategori utifrån informationen, returnera ["okand"].
6. Returnera aldrig en tom array — minst en kategori (eller "okand").

Exempel på korrekt output:
["bolagsskatt"]
["moms", "anstallning"]
["irrelevant_for_ab"]
["okand"]`;

  return [
    {
      type: 'text',
      text,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

function buildUserPrompt(event: WatcherEvent): string {
  const summary = extractSummary(event.raw).slice(0, SUMMARY_LIMIT);
  return `Titel: ${event.title}
URL: ${event.url}
Sammanfattning:
${summary || '(saknas)'}

Klassificera mot kategorierna ovan. Returnera JSON-array.`;
}

function extractSummary(raw: Record<string, unknown>): string {
  const summary = raw['summary'];
  return typeof summary === 'string' ? summary : '';
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set<string>([
  ...ALL_CATEGORIES,
  UNKNOWN_TAG,
]);

function parseAndFilterTags(raw: string, eventId: string): Tag[] {
  const trimmed = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }

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

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text') return block.text;
  }
  return '';
}

export async function tagWithLlm(
  event: WatcherEvent,
  client?: Anthropic,
): Promise<LlmTaggerResult> {
  const c = client ?? getDefaultClient();
  if (!c) {
    console.warn(
      `[llm-tagger] ANTHROPIC_API_KEY saknas — hoppar över LLM för ${event.id}`,
    );
    return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', usage: ZERO_USAGE };
  }

  let response: Anthropic.Message;
  try {
    response = await c.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: buildUserPrompt(event) }],
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[llm-tagger] anrop misslyckades för ${event.id}: ${msg}`);
    return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', usage: ZERO_USAGE };
  }

  const usage: LlmUsage = {
    input_tokens: response.usage.input_tokens ?? 0,
    output_tokens: response.usage.output_tokens ?? 0,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
  };

  const text = extractText(response.content);
  const validTags = parseAndFilterTags(text, event.id);

  if (validTags.length === 0) {
    console.warn(`[llm-tagger] ingen giltig kategori i response för ${event.id}: ${text}`);
    return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', usage };
  }

  const onlyOkand = validTags.length === 1 && validTags[0] === UNKNOWN_TAG;
  if (onlyOkand) {
    return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', usage };
  }

  const withoutOkand = validTags.filter((t): t is Category => t !== UNKNOWN_TAG);
  return { tags: withoutOkand, outcome: 'llm', usage };
}

/** Test-only — clear cached default client. Inte exporterad i produktion. */
export function __resetDefaultClientForTests(): void {
  defaultClient = null;
}
