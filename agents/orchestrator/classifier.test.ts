import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runClassifier } from './classifier.js';
import type { WatcherEvent } from '../watcher/schema/event.js';
import type { CustomerProfile } from '../watcher/customer-profile/types.js';
import { SCHEMA_VERSION } from '../watcher/customer-profile/types.js';
import { __resetDefaultClientForTests } from './rules/llm-tagger.js';

function makeEvent(id: string, title: string, summary = ''): WatcherEvent {
  return {
    id,
    source: 'riksdagen',
    type: 'sfs',
    title,
    url: `https://example.test/${id}`,
    published_at: '2026-05-01T00:00:00.000Z',
    raw: { summary },
    fetched_at: '2026-05-01T00:00:00.000Z',
  };
}

function makeProfile(orgnr: string): CustomerProfile {
  return {
    company_identity: {
      company_registration_number:
        orgnr as CustomerProfile['company_identity']['company_registration_number'],
    },
    business_activity: {},
    tax_profile: {
      is_vat_registered: true,
      is_employer_registered: false,
      pays_salary_to_owner: true,
      excise_tax_categories: [],
    },
    accounting_reporting_profile: {},
    governance_profile: { is_audit_required: false },
    employment_profile: { employee_count: 0 },
    gdpr_profile: { processes_personal_data: true },
    workplace_safety_profile: {},
    cyber_nis2_profile: {},
    meta: { schema_version: SCHEMA_VERSION },
  };
}

function makeMockLlmClient(
  responsesByEventId: Record<string, string>,
): { client: Anthropic; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async (args: { messages: { content: string }[] }) => {
    const userContent = args.messages[0].content;
    let text = '["okand"]';
    // Matcha mot URL: en exakt — `https://example.test/<id>\n` — så att event-ID:n
    // som är prefix till varandra (t.ex. 'e-llm' vs 'e-llm-okand') inte krockar.
    for (const [eventId, response] of Object.entries(responsesByEventId)) {
      if (userContent.includes(`https://example.test/${eventId}\n`)) {
        text = response;
        break;
      }
    }
    return {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 100,
        output_tokens: 10,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    };
  });

  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

describe('runClassifier — LLM fallback integration', () => {
  let workDir: string;
  let eventsPath: string;
  let outputPath: string;
  let vaultDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'classifier-llm-'));
    eventsPath = path.join(workDir, 'events.jsonl');
    outputPath = path.join(workDir, 'classifications.jsonl');
    vaultDir = path.join(workDir, 'vault');
    await mkdir(vaultDir, { recursive: true });
    await writeFile(
      path.join(vaultDir, '556677-8899.json'),
      JSON.stringify(makeProfile('556677-8899')),
    );
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
    __resetDefaultClientForTests();
    vi.restoreAllMocks();
  });

  it('anropar LLM endast för events där keyword gav okand', async () => {
    const events = [
      makeEvent('e1-keyword-hit', 'Inkomstskattelag (2026:1)'), // → bolagsskatt via keyword
      makeEvent('e2-okand', 'Förordning (2026:391) om bistånd'),
      makeEvent('e3-okand', 'Lag (2026:88) om något obegripligt'),
    ];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client, create } = makeMockLlmClient({
      'e2-okand': '["bolagsskatt"]',
      'e3-okand': '["okand"]',
    });

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
    });

    expect(create).toHaveBeenCalledTimes(2); // bara e2 och e3
    expect(result.llm_calls).toBe(2);
    expect(result.by_method.deterministic).toBe(1); // e1
    expect(result.by_method.llm).toBe(1); // e2
    expect(result.by_method['llm-okand']).toBe(1); // e3
  });

  it('cachar LLM-resultat per event över flera customers', async () => {
    await writeFile(
      path.join(vaultDir, '888888-1111.json'),
      JSON.stringify(makeProfile('888888-1111')),
    );

    const events = [makeEvent('e-shared', 'Förordning (2026:99) ovanlig')];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client, create } = makeMockLlmClient({
      'e-shared': '["bolagsskatt"]',
    });

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
    });

    expect(create).toHaveBeenCalledTimes(1); // ETT anrop, inte 2
    expect(result.llm_calls).toBe(1);
    expect(result.processed).toBe(2); // 1 event × 2 customers
  });

  it('andra körning gör inga LLM-anrop alls (skipped_existing)', async () => {
    const events = [makeEvent('e-rerun', 'Förordning (2026:1) okand')];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client: client1, create: create1 } = makeMockLlmClient({
      'e-rerun': '["bolagsskatt"]',
    });
    const first = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client1,
    });
    expect(create1).toHaveBeenCalledTimes(1);
    expect(first.processed).toBe(1);

    const { client: client2, create: create2 } = makeMockLlmClient({
      'e-rerun': '["bolagsskatt"]',
    });
    const second = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client2,
    });

    expect(create2).toHaveBeenCalledTimes(0); // INGA LLM-anrop
    expect(second.llm_calls).toBe(0);
    expect(second.skipped_existing).toBe(1);
    expect(second.processed).toBe(0);
  });

  it('skriver method-fältet korrekt till classifications.jsonl', async () => {
    const events = [
      makeEvent('e-det', 'Inkomstskattelag (2026:1)'),
      makeEvent('e-llm', 'Förordning (2026:2) tagad av LLM'),
      makeEvent('e-llm-okand', 'Förordning (2026:3) okand också efter LLM'),
    ];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client } = makeMockLlmClient({
      'e-llm': '["moms"]',
      'e-llm-okand': '["okand"]',
    });

    await runClassifier({ eventsPath, outputPath, vaultDir, llmClient: client });

    const lines = (await readFile(outputPath, 'utf8')).trim().split('\n');
    const byEvent = Object.fromEntries(
      lines.map((l) => {
        const c = JSON.parse(l) as { event_id: string; method: string; tags: string[] };
        return [c.event_id, c];
      }),
    );

    expect(byEvent['e-det'].method).toBe('deterministic');
    expect(byEvent['e-llm'].method).toBe('llm');
    expect(byEvent['e-llm'].tags).toEqual(['moms']);
    expect(byEvent['e-llm-okand'].method).toBe('llm-okand');
    expect(byEvent['e-llm-okand'].tags).toEqual(['okand']);
  });

  it('disableLlm=true gör inga LLM-anrop ens vid okand', async () => {
    const events = [makeEvent('e-okand', 'Förordning (2026:1) okand')];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client, create } = makeMockLlmClient({});

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
      disableLlm: true,
    });

    expect(create).toHaveBeenCalledTimes(0);
    expect(result.llm_calls).toBe(0);
    expect(result.by_method.deterministic).toBe(1);
  });

  it('aggregerar usage och cost över anrop', async () => {
    const events = [
      makeEvent('e1', 'Förordning (2026:1) okand'),
      makeEvent('e2', 'Förordning (2026:2) okand'),
    ];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client } = makeMockLlmClient({
      e1: '["bolagsskatt"]',
      e2: '["moms"]',
    });

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
    });

    expect(result.llm_calls).toBe(2);
    expect(result.llm_usage.input_tokens).toBe(200); // 2 × 100
    expect(result.llm_usage.output_tokens).toBe(20); // 2 × 10
    expect(result.llm_cost_usd).toBeGreaterThan(0);
    expect(result.llm_cost_usd).toBeLessThan(0.01);
  });
});
