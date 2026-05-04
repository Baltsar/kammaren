import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runClassifier } from './classifier.js';
import type { WatcherEvent } from '../watcher/schema/event.js';
import type { CustomerProfile } from '../watcher/customer-profile/types.js';
import { SCHEMA_VERSION } from '../watcher/customer-profile/types.js';
import type { LlmClient, LlmTagResult } from './llm/client.js';
import { __resetDefaultClientForTests } from './rules/llm-tagger.js';
import type { Tag } from './rules/categories.js';

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

/**
 * Mockar LlmClient direkt — provider-specifika anrop testas i
 * llm/anthropic-client.test.ts och llm/berget-client.test.ts.
 */
function makeMockLlmClient(
  responsesByEventId: Record<string, Tag[]>,
): { client: LlmClient; tagEvent: ReturnType<typeof vi.fn> } {
  const tagEvent = vi.fn(async (event: WatcherEvent): Promise<LlmTagResult> => {
    const tags = responsesByEventId[event.id] ?? (['okand'] as Tag[]);
    const onlyOkand = tags.length === 1 && tags[0] === 'okand';
    return {
      tags,
      outcome: onlyOkand ? 'llm-okand' : 'llm',
      cost_eur: 0.0001,
      provider: 'berget',
      model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
    };
  });

  return { client: { tagEvent }, tagEvent };
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

    const { client, tagEvent } = makeMockLlmClient({
      'e2-okand': ['bolagsskatt'],
      'e3-okand': ['okand'],
    });

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
    });

    expect(tagEvent).toHaveBeenCalledTimes(2); // bara e2 och e3
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

    const { client, tagEvent } = makeMockLlmClient({
      'e-shared': ['bolagsskatt'],
    });

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
    });

    expect(tagEvent).toHaveBeenCalledTimes(1); // ETT anrop, inte 2
    expect(result.llm_calls).toBe(1);
    expect(result.processed).toBe(2); // 1 event × 2 customers
  });

  it('andra körning gör inga LLM-anrop alls (skipped_existing)', async () => {
    const events = [makeEvent('e-rerun', 'Förordning (2026:1) okand')];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client: client1, tagEvent: tagEvent1 } = makeMockLlmClient({
      'e-rerun': ['bolagsskatt'],
    });
    const first = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client1,
    });
    expect(tagEvent1).toHaveBeenCalledTimes(1);
    expect(first.processed).toBe(1);

    const { client: client2, tagEvent: tagEvent2 } = makeMockLlmClient({
      'e-rerun': ['bolagsskatt'],
    });
    const second = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client2,
    });

    expect(tagEvent2).toHaveBeenCalledTimes(0); // INGA LLM-anrop
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
      'e-llm': ['moms'],
      'e-llm-okand': ['okand'],
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

    const { client, tagEvent } = makeMockLlmClient({});

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
      disableLlm: true,
    });

    expect(tagEvent).toHaveBeenCalledTimes(0);
    expect(result.llm_calls).toBe(0);
    expect(result.by_method.deterministic).toBe(1);
  });

  it('aggregerar cost_eur över anrop', async () => {
    const events = [
      makeEvent('e1', 'Förordning (2026:1) okand'),
      makeEvent('e2', 'Förordning (2026:2) okand'),
    ];
    await writeFile(eventsPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const { client } = makeMockLlmClient({
      e1: ['bolagsskatt'],
      e2: ['moms'],
    });

    const result = await runClassifier({
      eventsPath,
      outputPath,
      vaultDir,
      llmClient: client,
    });

    expect(result.llm_calls).toBe(2);
    // Mock returnerar cost_eur=0.0001 per anrop → 0.0002 total
    expect(result.llm_cost_eur).toBeCloseTo(0.0002, 6);
  });
});
