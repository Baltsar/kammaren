import { afterEach, describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import { ALL_CATEGORIES } from '../rules/categories.js';
import { estimateBergetCostEur, makeBergetClient } from './berget-client.js';

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
  /** Mistral returnerar struktured JSON via response_format=json_schema. */
  content: string;
  prompt_tokens?: number;
  completion_tokens?: number;
};

function makeMockSdk(
  response: MockResponse | (() => MockResponse | Promise<MockResponse>) | Error,
): { sdk: OpenAI; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async () => {
    if (response instanceof Error) throw response;
    const r = typeof response === 'function' ? await response() : response;
    return {
      id: 'chatcmpl_test',
      object: 'chat.completion',
      model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: r.content },
        },
      ],
      usage: {
        prompt_tokens: r.prompt_tokens ?? 200,
        completion_tokens: r.completion_tokens ?? 20,
        total_tokens: (r.prompt_tokens ?? 200) + (r.completion_tokens ?? 20),
      },
    };
  });

  const sdk = { chat: { completions: { create } } } as unknown as OpenAI;
  return { sdk, create };
}

describe('berget-client tagEvent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returnerar parsed tags och outcome=llm för giltig kategori', async () => {
    const { sdk } = makeMockSdk({ content: '{"tags":["bolagsskatt"]}' });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Inkomstskattelag (2026:1234)', 'Ändringar i bolagsskatt.');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['bolagsskatt']);
    expect(result.outcome).toBe('llm');
    expect(result.provider).toBe('berget');
    expect(result.model).toBe('mistralai/Mistral-Small-3.2-24B-Instruct-2506');
    expect(result.cost_eur).toBeGreaterThan(0);
  });

  it('hanterar flera kategorier', async () => {
    const { sdk } = makeMockSdk({ content: '{"tags":["moms","anstallning"]}' });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Lag om moms och anställning');

    const result = await client.tagEvent(event);

    expect(result.tags.sort()).toEqual(['anstallning', 'moms']);
    expect(result.outcome).toBe('llm');
  });

  it('returnerar llm-okand när modellen svarar {"tags":["okand"]}', async () => {
    const { sdk } = makeMockSdk({ content: '{"tags":["okand"]}' });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Något obegripligt');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
  });

  it('skickar JSON schema med ALL_CATEGORIES enum + okand och strict=true', async () => {
    const { sdk, create } = makeMockSdk({ content: '{"tags":["bolagsskatt"]}' });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Test');

    await client.tagEvent(event);

    const args = create.mock.calls[0][0];
    expect(args.model).toBe('mistralai/Mistral-Small-3.2-24B-Instruct-2506');
    expect(args.response_format).toBeDefined();
    expect(args.response_format.type).toBe('json_schema');
    expect(args.response_format.json_schema.name).toBe('tags');
    expect(args.response_format.json_schema.strict).toBe(true);

    const enumValues = args.response_format.json_schema.schema.properties.tags.items.enum;
    for (const cat of ALL_CATEGORIES) {
      expect(enumValues).toContain(cat);
    }
    expect(enumValues).toContain('okand');
  });

  it('filtrerar bort hallucinerade kategorier (belt-and-suspenders)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // strict mode borde teoretiskt blockera detta, men vi vill ha skydd om
    // SDK:n eller modellen någon gång läcker fritext.
    const { sdk } = makeMockSdk({
      content: '{"tags":["bolagsskatt","skatteflykt","moms"]}',
    });
    const client = makeBergetClient({ sdk });
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
    const { sdk } = makeMockSdk({ content: 'inte json alls' });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returnerar llm-okand vid tom tags-array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = makeMockSdk({ content: '{"tags":[]}' });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('faller tillbaka till llm-okand vid SDK-fel (timeout/rate-limit/network)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = makeMockSdk(new Error('Request timeout'));
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.tags).toEqual(['okand']);
    expect(result.outcome).toBe('llm-okand');
    expect(result.cost_eur).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('anrop misslyckades'),
    );
  });

  it('returnerar llm-okand när BERGET_API_KEY saknas och ingen sdk injiceras', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = process.env.BERGET_API_KEY;
    delete process.env.BERGET_API_KEY;

    try {
      const client = makeBergetClient();
      const event = makeEvent('Test');
      const result = await client.tagEvent(event);

      expect(result.tags).toEqual(['okand']);
      expect(result.outcome).toBe('llm-okand');
      expect(result.cost_eur).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BERGET_API_KEY saknas'),
      );
    } finally {
      if (original !== undefined) process.env.BERGET_API_KEY = original;
    }
  });

  it('respekterar custom model via opts', async () => {
    const { sdk, create } = makeMockSdk({ content: '{"tags":["okand"]}' });
    const client = makeBergetClient({ sdk, model: 'meta-llama/Llama-3.3-70B-Instruct' });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    expect(result.model).toBe('meta-llama/Llama-3.3-70B-Instruct');
    expect(create.mock.calls[0][0].model).toBe('meta-llama/Llama-3.3-70B-Instruct');
  });

  it('trunkerar summary till 1500 tecken i user-prompt', async () => {
    const longSummary = 'a'.repeat(5000);
    const { sdk, create } = makeMockSdk({ content: '{"tags":["okand"]}' });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Test', longSummary);

    await client.tagEvent(event);

    const args = create.mock.calls[0][0];
    const userMsg = args.messages.find(
      (m: { role: string }) => m.role === 'user',
    ) as { content: string };
    expect(userMsg.content).toContain('a'.repeat(1500));
    expect(userMsg.content).not.toContain('a'.repeat(1501));
  });

  it('rapporterar cost_eur baserat på prompt+completion tokens', async () => {
    const { sdk } = makeMockSdk({
      content: '{"tags":["bolagsskatt"]}',
      prompt_tokens: 1_000_000,
      completion_tokens: 0,
    });
    const client = makeBergetClient({ sdk });
    const event = makeEvent('Test');

    const result = await client.tagEvent(event);

    // Mistral-Small €0.30/M (in+out samma pris) → 1M prompt = €0.30
    expect(result.cost_eur).toBeCloseTo(0.3, 4);
  });
});

describe('estimateBergetCostEur', () => {
  it('beräknar cost i EUR mot Mistral-Small @ €0.30/M', () => {
    // 1M total → €0.30
    const cost = estimateBergetCostEur({ prompt_tokens: 500_000, completion_tokens: 500_000 });
    expect(cost).toBeCloseTo(0.3, 4);
  });

  it('typisk 30-event körning ligger under €0.05', () => {
    // 30 anrop × ~250 prompt + ~15 completion = ~7950 tokens
    const cost = estimateBergetCostEur({ prompt_tokens: 7500, completion_tokens: 450 });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.05);
  });

  it('hanterar 0 tokens utan att krasha', () => {
    const cost = estimateBergetCostEur({ prompt_tokens: 0, completion_tokens: 0 });
    expect(cost).toBe(0);
  });
});
