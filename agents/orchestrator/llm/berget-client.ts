/**
 * Berget AI LlmClient — placeholder, faktisk implementation i nästa commit.
 *
 * Skapas redan här för att client.ts ska kompilera mellan commits.
 * Den verkliga OpenAI-SDK-baserade implementationen kommer i commit 3.
 */

import { UNKNOWN_TAG } from '../rules/categories.js';
import type { LlmClient, LlmTagResult } from './client.js';

export type MakeBergetClientOptions = {
  apiKey?: string;
  model?: string;
};

export function makeBergetClient(_opts: MakeBergetClientOptions = {}): LlmClient {
  return {
    async tagEvent(_event): Promise<LlmTagResult> {
      throw new Error('[llm] berget-client not yet implemented');
    },
  };
}
