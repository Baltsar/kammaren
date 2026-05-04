/**
 * Tester för rules/llm-tagger.ts — den tunna shimmen ovanpå LlmClient.
 *
 * Provider-specifika tester ligger i ../llm/anthropic-client.test.ts och
 * ../llm/berget-client.test.ts. Här testar vi bara att shimmen delegerar
 * korrekt och att default-clienten lazy-konstrueras via env.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import type { LlmClient, LlmTagResult } from '../llm/client.js';
import { __resetDefaultClientForTests, tagWithLlm } from './llm-tagger.js';

function makeEvent(title: string): WatcherEvent {
  return {
    id: 'evt-' + Buffer.from(title).toString('hex').slice(0, 8),
    source: 'riksdagen',
    type: 'sfs',
    title,
    url: 'https://example.test/sfs',
    published_at: '2026-05-01T00:00:00.000Z',
    raw: { summary: '' },
    fetched_at: '2026-05-01T00:00:00.000Z',
  };
}

function makeMockClient(result: LlmTagResult): {
  client: LlmClient;
  tagEvent: ReturnType<typeof vi.fn>;
} {
  const tagEvent = vi.fn(async () => result);
  return { client: { tagEvent }, tagEvent };
}

describe('tagWithLlm shim', () => {
  afterEach(() => {
    __resetDefaultClientForTests();
    vi.restoreAllMocks();
  });

  it('delegerar till injicerad LlmClient och returnerar mappad shape', async () => {
    const { client, tagEvent } = makeMockClient({
      tags: ['bolagsskatt'],
      outcome: 'llm',
      cost_eur: 0.0001,
      provider: 'berget',
      model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
    });
    const event = makeEvent('Inkomstskattelag (2026:1)');

    const result = await tagWithLlm(event, client);

    expect(tagEvent).toHaveBeenCalledOnce();
    expect(tagEvent).toHaveBeenCalledWith(event);
    expect(result.tags).toEqual(['bolagsskatt']);
    expect(result.outcome).toBe('llm');
    expect(result.cost_eur).toBe(0.0001);
    expect(result.provider).toBe('berget');
    expect(result.model).toBe('mistralai/Mistral-Small-3.2-24B-Instruct-2506');
  });

  it('delegerar llm-okand-resultat oförändrat', async () => {
    const { client } = makeMockClient({
      tags: ['okand'],
      outcome: 'llm-okand',
      cost_eur: 0,
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    });

    const result = await tagWithLlm(makeEvent('Något obegripligt'), client);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
  });

  it('default-clienten faller tillbaka till okand när varken Berget eller Anthropic key finns', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalProvider = process.env.LLM_PROVIDER;
    const originalBerget = process.env.BERGET_API_KEY;
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    delete process.env.BERGET_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.LLM_PROVIDER = 'berget';

    try {
      const result = await tagWithLlm(makeEvent('Test'));
      expect(result.tags).toEqual(['okand']);
      expect(result.outcome).toBe('llm-okand');
      expect(result.cost_eur).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BERGET_API_KEY saknas'),
      );
    } finally {
      if (originalProvider !== undefined) process.env.LLM_PROVIDER = originalProvider;
      else delete process.env.LLM_PROVIDER;
      if (originalBerget !== undefined) process.env.BERGET_API_KEY = originalBerget;
      if (originalAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = originalAnthropic;
    }
  });
});
