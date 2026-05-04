/**
 * Anthropic LlmClient-implementation.
 *
 * Logiken flyttad oförändrad från agents/orchestrator/rules/llm-tagger.ts
 * (Haiku 4.5 + cache_control ephemeral system-prompt + hallucination-guard).
 * Skillnad mot tidigare: returnerar LlmTagResult med cost_eur (USD→EUR
 * konvertering sker här) istället för att exponera token-usage uppåt.
 *
 * Används bara när LLM_PROVIDER=anthropic. Default-providern är Berget.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  ALL_CATEGORIES,
  UNKNOWN_TAG,
  type Category,
} from '../rules/categories.js';
import type { LlmClient, LlmTagResult } from './client.js';
import { parseAndFilterTags } from './parse-tags.js';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;
const SUMMARY_LIMIT = 1500;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Haiku 4.5 priser per 1M tokens (USD).
 * Cache read = 0.1×, cache write (5min ephemeral) = 1.25×.
 */
const HAIKU_PRICE_INPUT_PER_M = 1.0;
const HAIKU_PRICE_OUTPUT_PER_M = 5.0;
const HAIKU_PRICE_CACHE_WRITE_PER_M = HAIKU_PRICE_INPUT_PER_M * 1.25;
const HAIKU_PRICE_CACHE_READ_PER_M = HAIKU_PRICE_INPUT_PER_M * 0.1;

/** Uppdatera vid behov, senast verifierat 2026-05-04. */
const USD_TO_EUR = 0.92;

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

export function estimateAnthropicCostEur(usage: AnthropicUsage): number {
  const usd =
    (usage.input_tokens * HAIKU_PRICE_INPUT_PER_M) / 1_000_000 +
    (usage.output_tokens * HAIKU_PRICE_OUTPUT_PER_M) / 1_000_000 +
    (usage.cache_creation_input_tokens * HAIKU_PRICE_CACHE_WRITE_PER_M) / 1_000_000 +
    (usage.cache_read_input_tokens * HAIKU_PRICE_CACHE_READ_PER_M) / 1_000_000;
  return usd * USD_TO_EUR;
}

export type MakeAnthropicClientOptions = {
  apiKey?: string;
  model?: string;
  /** Inject SDK för tester. Default: lazy från ANTHROPIC_API_KEY. */
  sdk?: Anthropic;
};

export function makeAnthropicClient(opts: MakeAnthropicClientOptions = {}): LlmClient {
  const model = opts.model ?? DEFAULT_MODEL;
  let sdk: Anthropic | null = opts.sdk ?? null;

  function getSdk(): Anthropic | null {
    if (sdk) return sdk;
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    sdk = new Anthropic({ apiKey });
    return sdk;
  }

  return {
    async tagEvent(event: WatcherEvent): Promise<LlmTagResult> {
      const c = getSdk();
      if (!c) {
        console.warn(
          `[llm-tagger] ANTHROPIC_API_KEY saknas — hoppar över LLM för ${event.id}`,
        );
        return {
          tags: [UNKNOWN_TAG],
          outcome: 'llm-okand',
          cost_eur: 0,
          provider: 'anthropic',
          model,
        };
      }

      let response: Anthropic.Message;
      try {
        response = await c.messages.create(
          {
            model,
            max_tokens: MAX_TOKENS,
            system: buildSystemPrompt(),
            messages: [{ role: 'user', content: buildUserPrompt(event) }],
          },
          { timeout: REQUEST_TIMEOUT_MS },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[llm-tagger] anrop misslyckades för ${event.id}: ${msg}`);
        return {
          tags: [UNKNOWN_TAG],
          outcome: 'llm-okand',
          cost_eur: 0,
          provider: 'anthropic',
          model,
        };
      }

      const usage: AnthropicUsage = {
        input_tokens: response.usage.input_tokens ?? 0,
        output_tokens: response.usage.output_tokens ?? 0,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      };
      const cost_eur = estimateAnthropicCostEur(usage);

      const text = extractText(response.content);
      const validTags = parseAndFilterTags(text, event.id);

      if (validTags.length === 0) {
        console.warn(`[llm-tagger] ingen giltig kategori i response för ${event.id}: ${text}`);
        return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', cost_eur, provider: 'anthropic', model };
      }

      const onlyOkand = validTags.length === 1 && validTags[0] === UNKNOWN_TAG;
      if (onlyOkand) {
        return { tags: [UNKNOWN_TAG], outcome: 'llm-okand', cost_eur, provider: 'anthropic', model };
      }

      const withoutOkand = validTags.filter((t): t is Category => t !== UNKNOWN_TAG);
      return { tags: withoutOkand, outcome: 'llm', cost_eur, provider: 'anthropic', model };
    },
  };
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

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text') return block.text;
  }
  return '';
}
