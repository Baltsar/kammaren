/**
 * Berget AI LlmClient — EU-hosted Mistral-Small via OpenAI-kompatibel API.
 *
 * Använder strict JSON schema response_format med ALL_CATEGORIES enum för
 * structured output. Hallucination-guard kvar som belt-and-suspenders i fall
 * SDK:n eller modellen läcker fritext (parse-tags.ts delas med Anthropic).
 *
 * Pris: Mistral-Small €0.30/M tokens (in+out samma pris). Cost rapporteras
 * direkt i EUR — ingen valuta-konvertering nödvändig.
 *
 * Krasch-säker: timeout, rate-limit, malformed JSON eller saknad API-nyckel
 * → returnerar {tags:['okand'], outcome:'llm-okand', cost_eur:0}.
 */

import OpenAI from 'openai';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  ALL_CATEGORIES,
  UNKNOWN_TAG,
  type Category,
} from '../rules/categories.js';
import type { LlmClient, LlmTagResult } from './client.js';
import { parseAndFilterTags } from './parse-tags.js';

const BERGET_BASE_URL = 'https://api.berget.ai/v1';
const DEFAULT_MODEL = 'mistralai/Mistral-Small-3.2-24B-Instruct-2506';
const MAX_TOKENS = 256;
const SUMMARY_LIMIT = 1500;
const REQUEST_TIMEOUT_MS = 30_000;

/** Mistral-Small @ €0.30 per 1M tokens (in+out samma pris). */
const MISTRAL_SMALL_PRICE_PER_M_EUR = 0.3;

type BergetUsage = {
  prompt_tokens: number;
  completion_tokens: number;
};

export function estimateBergetCostEur(usage: BergetUsage): number {
  const total = usage.prompt_tokens + usage.completion_tokens;
  return (total * MISTRAL_SMALL_PRICE_PER_M_EUR) / 1_000_000;
}

export type MakeBergetClientOptions = {
  apiKey?: string;
  model?: string;
  /** Inject SDK för tester. Default: lazy från BERGET_API_KEY. */
  sdk?: OpenAI;
};

const TAGS_JSON_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'tags',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['tags'],
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'string',
            enum: [...ALL_CATEGORIES, UNKNOWN_TAG] as string[],
          },
        },
      },
    },
  },
};

export function makeBergetClient(opts: MakeBergetClientOptions = {}): LlmClient {
  const model = opts.model ?? process.env.LLM_MODEL ?? DEFAULT_MODEL;
  let sdk: OpenAI | null = opts.sdk ?? null;

  function getSdk(): OpenAI | null {
    if (sdk) return sdk;
    const apiKey = opts.apiKey ?? process.env.BERGET_API_KEY;
    if (!apiKey) return null;
    sdk = new OpenAI({ apiKey, baseURL: BERGET_BASE_URL, timeout: REQUEST_TIMEOUT_MS });
    return sdk;
  }

  return {
    async tagEvent(event: WatcherEvent): Promise<LlmTagResult> {
      const c = getSdk();
      if (!c) {
        console.warn(
          `[llm-tagger] BERGET_API_KEY saknas — hoppar över LLM för ${event.id}`,
        );
        return {
          tags: [UNKNOWN_TAG],
          outcome: 'llm-okand',
          cost_eur: 0,
          provider: 'berget',
          model,
        };
      }

      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await c.chat.completions.create({
          model,
          max_tokens: MAX_TOKENS,
          response_format: TAGS_JSON_SCHEMA,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(event) },
          ],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[llm-tagger] anrop misslyckades för ${event.id}: ${msg}`);
        return {
          tags: [UNKNOWN_TAG],
          outcome: 'llm-okand',
          cost_eur: 0,
          provider: 'berget',
          model,
        };
      }

      const usage: BergetUsage = {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
      };
      const cost_eur = estimateBergetCostEur(usage);

      const text = response.choices[0]?.message?.content ?? '';
      const validTags = extractAndValidateTags(text, event.id);

      if (validTags.length === 0) {
        console.warn(`[llm-tagger] ingen giltig kategori i response för ${event.id}: ${text}`);
        return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', cost_eur, provider: 'berget', model };
      }

      const onlyOkand = validTags.length === 1 && validTags[0] === UNKNOWN_TAG;
      if (onlyOkand) {
        return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', cost_eur, provider: 'berget', model };
      }

      const withoutOkand = validTags.filter((t): t is Category => t !== UNKNOWN_TAG);
      return { tags: withoutOkand, outcome: 'llm', cost_eur, provider: 'berget', model };
    },
  };
}

function extractAndValidateTags(raw: string, eventId: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return parseAndFilterTags(raw, eventId);
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'tags' in parsed &&
    Array.isArray((parsed as { tags: unknown }).tags)
  ) {
    return parseAndFilterTags((parsed as { tags: unknown[] }).tags, eventId);
  }

  return parseAndFilterTags(raw, eventId);
}

function buildSystemPrompt(): string {
  const categoryList = ALL_CATEGORIES.map((c) => `  - ${c}`).join('\n');
  return `Du klassificerar svenska regulatoriska händelser (lagar, förordningar, föreskrifter från Riksdagen och Skatteverket) mot ett fast set kategorier som påverkar svenska aktiebolag.

Tillgängliga kategorier:
${categoryList}
  - okand

Regler:
1. Returnera ENDAST ett JSON-objekt på formatet {"tags": [...]}, inget annat. Inga prosabeskrivningar, ingen markdown, inga kommentarer.
2. Använd endast kategorier från listan ovan. Hitta inte på nya.
3. Flera kategorier är tillåtet om händelsen rör flera områden.
4. Om händelsen inte berör aktiebolag (t.ex. djurskydd, vapen, fiske, körkort), returnera {"tags": ["irrelevant_for_ab"]}.
5. Om du genuint inte kan avgöra kategori utifrån informationen, returnera {"tags": ["okand"]}.
6. Returnera aldrig en tom array — minst en kategori (eller "okand").

Exempel på korrekt output:
{"tags": ["bolagsskatt"]}
{"tags": ["moms", "anstallning"]}
{"tags": ["irrelevant_for_ab"]}
{"tags": ["okand"]}`;
}

function buildUserPrompt(event: WatcherEvent): string {
  const summary = extractSummary(event.raw).slice(0, SUMMARY_LIMIT);
  return `Titel: ${event.title}
URL: ${event.url}
Sammanfattning:
${summary || '(saknas)'}

Klassificera mot kategorierna ovan. Returnera JSON-objekt {"tags": [...]}.`;
}

function extractSummary(raw: Record<string, unknown>): string {
  const summary = raw['summary'];
  return typeof summary === 'string' ? summary : '';
}
