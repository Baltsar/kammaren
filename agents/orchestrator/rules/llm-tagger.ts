/**
 * LLM-tagger — fallback för events som keyword-classifiern inte kunde tagga.
 *
 * Tunn shim ovanpå LlmClient-abstraktionen i ../llm/. Provider väljs via env
 * LLM_PROVIDER (default: berget). Hallucination-guard sköts av providern.
 *
 * Anropas endast när tagEvent() returnerar exakt ['okand'] för en event.
 */

import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  makeLlmClient,
  type LlmClient,
  type LlmTagResult,
} from '../llm/client.js';
import type { Tag } from './categories.js';

export type LlmTaggerResult = {
  tags: Tag[];
  /** 'llm' = LLM gav minst en giltig icke-okand kategori; 'llm-okand' = fallback. */
  outcome: 'llm' | 'llm-okand';
  cost_eur: number;
  provider: LlmTagResult['provider'];
  model: string;
};

let defaultClient: LlmClient | null = null;

async function getDefaultClient(): Promise<LlmClient> {
  if (defaultClient) return defaultClient;
  defaultClient = await makeLlmClient();
  return defaultClient;
}

export async function tagWithLlm(
  event: WatcherEvent,
  client?: LlmClient,
): Promise<LlmTaggerResult> {
  const c = client ?? (await getDefaultClient());
  const result = await c.tagEvent(event);
  return {
    tags: result.tags,
    outcome: result.outcome,
    cost_eur: result.cost_eur,
    provider: result.provider,
    model: result.model,
  };
}

/** Test-only — clear cached default client. Inte exporterad i produktion. */
export function __resetDefaultClientForTests(): void {
  defaultClient = null;
}
