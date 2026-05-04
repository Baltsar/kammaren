import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  __resetDefaultClientForTests,
  estimateLlmCostUsd,
  tagWithLlm,
} from './llm-tagger.js';

function makeEvent(title: string, summary = ''): WatcherEvent {
  return {
    id: 'evt-' + Buffer.from(title).toString('hex').slice(0, 8),
    source: 'riksdagen',
    type: 'sfs',
    title,
    url: 'https://example.test/sfs',
    published_at: '2026-05-01T00:00:00.000Z',
    raw: { summary },
    fetched_at: '2026-05-01T00:00:00.000Z',
  };
}

type MockResponse = {
  text: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

function makeMockClient(
  response: MockResponse | (() => MockResponse | Promise<MockResponse>) | Error,
): { client: Anthropic; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async () => {
    if (response instanceof Error) throw response;
    const r = typeof response === 'function' ? await response() : response;
    return {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5',
      content: [{ type: 'text', text: r.text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: r.input_tokens ?? 100,
        output_tokens: r.output_tokens ?? 10,
        cache_creation_input_tokens: r.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: r.cache_read_input_tokens ?? 0,
      },
    };
  });

  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

describe('tagWithLlm', () => {
  afterEach(() => {
    __resetDefaultClientForTests();
    vi.restoreAllMocks();
  });

  it('returnerar parsed tags och method=llm för giltiga kategorier', async () => {
    const { client, create } = makeMockClient({ text: '["bolagsskatt"]' });
    const event = makeEvent('Inkomstskattelag (2026:1234)', 'Ändringar i bolagsskatt.');

    const result = await tagWithLlm(event, client);

    expect(result.tags).toEqual(['bolagsskatt']);
    expect(result.outcome).toBe('llm');
    expect(create).toHaveBeenCalledOnce();
  });

  it('hanterar flera kategorier', async () => {
    const { client } = makeMockClient({ text: '["moms", "anstallning"]' });
    const event = makeEvent('Lag om moms och anställning');

    const result = await tagWithLlm(event, client);

    expect(result.tags.sort()).toEqual(['anstallning', 'moms']);
    expect(result.outcome).toBe('llm');
  });

  it('returnerar llm-okand när LLM svarar ["okand"]', async () => {
    const { client } = makeMockClient({ text: '["okand"]' });
    const event = makeEvent('Något obegripligt');

    const result = await tagWithLlm(event, client);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
  });

  it('filtrerar bort hallucinerade kategorier och loggar warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeMockClient({
      text: '["bolagsskatt", "skatteflykt", "moms"]',
    });
    const event = makeEvent('Test');

    const result = await tagWithLlm(event, client);

    expect(result.tags.sort()).toEqual(['bolagsskatt', 'moms']);
    expect(result.outcome).toBe('llm');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('hallucinated category: skatteflykt'),
    );
  });

  it('returnerar llm-okand vid malformed JSON', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeMockClient({ text: 'detta är prosa, inte json' });
    const event = makeEvent('Test');

    const result = await tagWithLlm(event, client);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('extraherar JSON-array även om LLM inkluderar prosa runt', async () => {
    const { client } = makeMockClient({
      text: 'Här är min klassning: ["gdpr"] som matchar.',
    });
    const event = makeEvent('Dataskyddslag');

    const result = await tagWithLlm(event, client);

    expect(result.tags).toEqual(['gdpr']);
    expect(result.outcome).toBe('llm');
  });

  it('returnerar llm-okand vid tom array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeMockClient({ text: '[]' });
    const event = makeEvent('Test');

    const result = await tagWithLlm(event, client);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('faller tillbaka till llm-okand vid SDK-fel (timeout/rate-limit)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeMockClient(new Error('Request timeout'));
    const event = makeEvent('Test');

    const result = await tagWithLlm(event, client);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(result.usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('anrop misslyckades'),
    );
  });

  it('returnerar llm-okand när ANTHROPIC_API_KEY saknas och ingen klient injiceras', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    __resetDefaultClientForTests();

    try {
      const event = makeEvent('Test');
      const result = await tagWithLlm(event);

      expect(result.tags).toEqual(['okand']);
      expect(result.outcome).toBe('llm-okand');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ANTHROPIC_API_KEY saknas'),
      );
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('rapporterar usage-tokens korrekt från response', async () => {
    const { client } = makeMockClient({
      text: '["bolagsskatt"]',
      input_tokens: 50,
      output_tokens: 5,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 0,
    });
    const event = makeEvent('Test');

    const result = await tagWithLlm(event, client);

    expect(result.usage).toEqual({
      input_tokens: 50,
      output_tokens: 5,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 0,
    });
  });

  it('skickar prompt med cache_control på system-prompt', async () => {
    const { client, create } = makeMockClient({ text: '["bolagsskatt"]' });
    const event = makeEvent('Inkomstskattelag');

    await tagWithLlm(event, client);

    const args = create.mock.calls[0][0];
    expect(args.model).toBe('claude-haiku-4-5');
    expect(Array.isArray(args.system)).toBe(true);
    expect(args.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('trunkerar summary till 1500 tecken i user-prompt', async () => {
    const longSummary = 'a'.repeat(5000);
    const { client, create } = makeMockClient({ text: '["okand"]' });
    const event = makeEvent('Test', longSummary);

    await tagWithLlm(event, client);

    const args = create.mock.calls[0][0];
    const userContent = args.messages[0].content as string;
    // 1500 'a' + de andra delarna av prompten — summary-delen ska vara cappad
    expect(userContent).toContain('a'.repeat(1500));
    expect(userContent).not.toContain('a'.repeat(1501));
  });
});

describe('estimateLlmCostUsd', () => {
  it('beräknar cost mot Haiku 4.5 priser', () => {
    // 1M input @ $1, 1M output @ $5 → $6
    const cost = estimateLlmCostUsd({
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBeCloseTo(6.0, 5);
  });

  it('cache read kostar 0.1× input', () => {
    const cost = estimateLlmCostUsd({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.1, 5);
  });

  it('cache write kostar 1.25× input', () => {
    const cost = estimateLlmCostUsd({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBeCloseTo(1.25, 5);
  });

  it('typisk 10-event körning landar runt $0.0X', () => {
    // ~10 anrop × ~250 input + ~15 output, första cachar 200 tokens, övriga läser cache
    const cost = estimateLlmCostUsd({
      input_tokens: 500, // små per-event prompts efter första
      output_tokens: 150,
      cache_creation_input_tokens: 250,
      cache_read_input_tokens: 2250, // 9 reads
    });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });
});
