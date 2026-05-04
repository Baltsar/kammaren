/**
 * LlmClient — provider-agnostisk abstraktion för LLM-tagging av events.
 *
 * Två providers idag: berget (default, EU-hosted Mistral) och anthropic
 * (kvar för framtida fallback). Båda returnerar redan-validerade tags
 * (hallucination-guard ligger i parse-tags.ts och anropas av varje provider).
 *
 * Provider väljs via env LLM_PROVIDER eller explicit i makeLlmClient().
 * Cost rapporteras alltid i EUR — Anthropic-clienten gör USD→EUR-konvertering.
 */

import type { WatcherEvent } from '../../watcher/schema/event.js';
import type { Tag } from '../rules/categories.js';

export type LlmProvider = 'berget' | 'anthropic';

export type LlmTagResult = {
  tags: Tag[];
  /** 'llm' = minst en giltig icke-okand kategori; 'llm-okand' = fallback. */
  outcome: 'llm' | 'llm-okand';
  cost_eur: number;
  provider: LlmProvider;
  model: string;
};

export interface LlmClient {
  tagEvent(event: WatcherEvent): Promise<LlmTagResult>;
}

export type MakeLlmClientOptions = {
  provider?: LlmProvider;
  apiKey?: string;
  model?: string;
};

/**
 * Skapar en LlmClient. Provider väljs i prioritetsordning:
 *   1. opts.provider
 *   2. process.env.LLM_PROVIDER
 *   3. 'berget' (default)
 *
 * Lazy-import av provider-modul så att man kan köra utan att ha den andra
 * SDK:n installerad — viktigt för testbarhet och cold-start latency.
 */
export async function makeLlmClient(opts: MakeLlmClientOptions = {}): Promise<LlmClient> {
  const provider: LlmProvider =
    opts.provider ?? (process.env.LLM_PROVIDER as LlmProvider | undefined) ?? 'berget';

  if (provider === 'berget') {
    const { makeBergetClient } = await import('./berget-client.js');
    return makeBergetClient({ apiKey: opts.apiKey, model: opts.model });
  }

  if (provider === 'anthropic') {
    const { makeAnthropicClient } = await import('./anthropic-client.js');
    return makeAnthropicClient({ apiKey: opts.apiKey, model: opts.model });
  }

  throw new Error(`[llm] unknown LLM_PROVIDER: ${provider}`);
}
