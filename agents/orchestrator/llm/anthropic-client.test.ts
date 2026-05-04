import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import { estimateAnthropicCostEur, makeAnthropicClient } from './anthropic-client.js';

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

function makeMockSdk(
  response: MockResponse | (() => MockResponse | Promise<MockResponse>) | Error,
): { sdk: Anthropic; create: ReturnType<typeof vi.fn> } {
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

  const sdk = { messages: { create } } as unknown as Anthropic;
  return { sdk, create };
}

describe('anthropic-client tagEvent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returnerar parsed tags och outcome=llm för giltiga kategorier', async () => {
    const { sdk, create } = makeMockSdk({ text: '["bolagsskatt"]' });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Inkomstskattelag (2026:1234)', 'Ändringar i bolagsskatt.');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['bolagsskatt']);
    expect(result.outcome).toBe('llm');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-haiku-4-5');
    expect(result.cost_eur).toBeGreaterThan(0);
    expect(create).toHaveBeenCalledOnce();
  });

  it('hanterar flera kategorier', async () => {
    const { sdk } = makeMockSdk({ text: '["moms", "anstallning"]' });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Lag om moms och anställning');

    const result = await client.tagEvent(event);

    expect(result.tags.sort()).toEqual(['anstallning', 'moms']);
    expect(result.outcome).toBe('llm');
  });

  it('returnerar llm-okand när LLM svarar ["okand"]', async () => {
    const { sdk } = makeMockSdk({ text: '["okand"]' });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Något obegripligt');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
  });

  it('filtrerar bort hallucinerade kategorier och loggar warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = makeMockSdk({
      text: '["bolagsskatt", "skatteflykt", "moms"]',
    });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.tags.sort()).toEqual(['bolagsskatt', 'moms']);
    expect(result.outcome).toBe('llm');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('hallucinated category: skatteflykt'),
    );
  });

  it('returnerar llm-okand vid malformed JSON', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = makeMockSdk({ text: 'detta är prosa, inte json' });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('extraherar JSON-array även om LLM inkluderar prosa runt', async () => {
    const { sdk } = makeMockSdk({
      text: 'Här är min klassning: ["gdpr"] som matchar.',
    });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Dataskyddslag');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['gdpr']);
    expect(result.outcome).toBe('llm');
  });

  it('returnerar llm-okand vid tom array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = makeMockSdk({ text: '[]' });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('faller tillbaka till llm-okand vid SDK-fel (timeout/rate-limit)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = makeMockSdk(new Error('Request timeout'));
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(result.cost_eur).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('anrop misslyckades'),
    );
  });

  it('returnerar llm-okand när ANTHROPIC_API_KEY saknas och ingen sdk injiceras', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const client = makeAnthropicClient();
      const event = makeEvent('Test');
      const result = await client.tagEvent(event);

      expect(result.tags).toEqual(['okand']);
      expect(result.outcome).toBe('llm-okand');
      expect(result.cost_eur).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ANTHROPIC_API_KEY saknas'),
      );
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('skickar prompt med cache_control på system-prompt', async () => {
    const { sdk, create } = makeMockSdk({ text: '["bolagsskatt"]' });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Inkomstskattelag');

    await client.tagEvent(event);

    const args = create.mock.calls[0][0];
    expect(args.model).toBe('claude-haiku-4-5');
    expect(Array.isArray(args.system)).toBe(true);
    expect(args.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('respekterar custom model via opts', async () => {
    const { sdk, create } = makeMockSdk({ text: '["okand"]' });
    const client = makeAnthropicClient({ sdk, model: 'claude-sonnet-4-6' });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.model).toBe('claude-sonnet-4-6');
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
  });

  it('trunkerar summary till 1500 tecken i user-prompt', async () => {
    const longSummary = 'a'.repeat(5000);
    const { sdk, create } = makeMockSdk({ text: '["okand"]' });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Test', longSummary);

    await client.tagEvent(event);

    const args = create.mock.calls[0][0];
    const userContent = args.messages[0].content as string;
    expect(userContent).toContain('a'.repeat(1500));
    expect(userContent).not.toContain('a'.repeat(1501));
  });

  it('rapporterar cost_eur baserat på token-usage och USD→EUR', async () => {
    const { sdk } = makeMockSdk({
      text: '["bolagsskatt"]',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    const client = makeAnthropicClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    // 1M input @ $1 + 1M output @ $5 = $6 USD → $6 × 0.92 = €5.52
    expect(result.cost_eur).toBeCloseTo(5.52, 4);
  });
});

describe('estimateAnthropicCostEur', () => {
  it('beräknar cost i EUR mot Haiku 4.5 priser med USD→EUR-konvertering', () => {
    // 1M input @ $1, 1M output @ $5 → $6 USD × 0.92 = €5.52
    const cost = estimateAnthropicCostEur({
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBeCloseTo(5.52, 4);
  });

  it('cache read kostar 0.1× input', () => {
    // 1M cache_read @ $0.10 → $0.10 × 0.92 = €0.092
    const cost = estimateAnthropicCostEur({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.092, 5);
  });

  it('cache write kostar 1.25× input', () => {
    // 1M cache_write @ $1.25 → $1.25 × 0.92 = €1.15
    const cost = estimateAnthropicCostEur({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBeCloseTo(1.15, 4);
  });

  it('typisk 10-event körning landar under €0.01', () => {
    const cost = estimateAnthropicCostEur({
      input_tokens: 500,
      output_tokens: 150,
      cache_creation_input_tokens: 250,
      cache_read_input_tokens: 2250,
    });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });
});
