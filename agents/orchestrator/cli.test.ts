import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gdprDelete, gdprExport, main } from './cli.js';
import type { Classification, Severity } from './schema/classification.js';
import { makeClassificationId } from './schema/classification.js';
import { makeDeliveryId } from './schema/delivery.js';
import type { Delivery } from './schema/delivery.js';
import type { CustomerProfile } from '../watcher/customer-profile/types.js';
import { SCHEMA_VERSION } from '../watcher/customer-profile/types.js';
import {
  __resetClientForTests,
  read as readProfile,
} from '../watcher/customer-profile/store.js';
import { makeFakeSupabase } from '../watcher/customer-profile/fake-supabase.js';

const ORG = '556677-8899';
const ORG_OTHER = '888888-1111';

function makeProfile(orgnr: string): CustomerProfile {
  return {
    company_identity: {
      company_registration_number:
        orgnr as CustomerProfile['company_identity']['company_registration_number'],
    },
    business_activity: {},
    tax_profile: {},
    accounting_reporting_profile: {},
    governance_profile: {},
    employment_profile: {},
    gdpr_profile: {},
    workplace_safety_profile: {},
    cyber_nis2_profile: {},
    telegram_chat_id: '999',
    consent_terms_accepted_at: '2026-05-04T00:00:00.000Z',
    consent_privacy_accepted_at: '2026-05-04T00:00:00.000Z',
    consent_b2b_acknowledged_at: '2026-05-04T00:00:00.000Z',
    meta: { schema_version: SCHEMA_VERSION },
  };
}

function makeClassification(
  eventId: string,
  orgnr: string,
  severity: Severity = 'warning',
): Classification {
  return {
    id: makeClassificationId(eventId, orgnr),
    event_id: eventId,
    customer_orgnr: orgnr,
    relevant: true,
    severity,
    tags: ['moms'],
    matched_rules: ['moms: tax.is_vat_registered'],
    summary: 'Berör moms — Test',
    classified_at: '2026-05-04T12:00:00.000Z',
    method: 'deterministic',
  };
}

async function writeJsonl(filePath: string, rows: object[]): Promise<void> {
  await writeFile(filePath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

describe('gdprExport', () => {
  let workDir: string;
  let classificationsPath: string;
  let deliveriesPath: string;
  let supa: ReturnType<typeof makeFakeSupabase>;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'cli-export-'));
    classificationsPath = path.join(workDir, 'classifications.jsonl');
    deliveriesPath = path.join(workDir, 'deliveries.jsonl');
    supa = makeFakeSupabase();
    __resetClientForTests();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('returnerar profile + filtrerade classifications + matchande deliveries', async () => {
    supa.insertProfile(makeProfile(ORG));
    const c1 = makeClassification('e1', ORG);
    const c2 = makeClassification('e2', ORG_OTHER); // ska inte med
    const c3 = makeClassification('e3', ORG);
    await writeJsonl(classificationsPath, [c1, c2, c3]);

    const d1: Delivery = {
      id: makeDeliveryId(c1.id, 'telegram'),
      classification_id: c1.id,
      channel: 'telegram',
      chat_id: '999',
      message_id: 1,
      sent_at: '2026-05-04T13:00:00.000Z',
    };
    const dOther: Delivery = {
      id: makeDeliveryId(c2.id, 'telegram'),
      classification_id: c2.id,
      channel: 'telegram',
      chat_id: '111',
      message_id: 2,
      sent_at: '2026-05-04T13:00:00.000Z',
    };
    await writeJsonl(deliveriesPath, [d1, dOther]);

    const result = await gdprExport(ORG, {
      classificationsPath,
      deliveriesPath,
      supabaseClient: supa.client,
    });

    expect(result.orgnr).toBe(ORG);
    expect(result.profile?.company_identity.company_registration_number).toBe(ORG);
    expect(result.classifications.map((c) => c.id)).toEqual([c1.id, c3.id]);
    expect(result.deliveries.map((d) => d.id)).toEqual([d1.id]);
    expect(result.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returnerar tom struktur när profilen saknas', async () => {
    await writeJsonl(classificationsPath, []);
    await writeJsonl(deliveriesPath, []);

    const result = await gdprExport(ORG, {
      classificationsPath,
      deliveriesPath,
      supabaseClient: supa.client,
    });

    expect(result.profile).toBeNull();
    expect(result.classifications).toEqual([]);
    expect(result.deliveries).toEqual([]);
  });

  it('hanterar saknade jsonl-filer (ENOENT) som tomma', async () => {
    supa.insertProfile(makeProfile(ORG));

    const result = await gdprExport(ORG, {
      classificationsPath: path.join(workDir, 'nope.jsonl'),
      deliveriesPath: path.join(workDir, 'also-nope.jsonl'),
      supabaseClient: supa.client,
    });

    expect(result.profile).not.toBeNull();
    expect(result.classifications).toEqual([]);
    expect(result.deliveries).toEqual([]);
  });
});

describe('gdprDelete (HARD DELETE)', () => {
  let supa: ReturnType<typeof makeFakeSupabase>;

  beforeEach(() => {
    supa = makeFakeSupabase();
    __resetClientForTests();
  });

  it('hard-deletar profilen och returnerar status=deleted med rows_deleted=1', async () => {
    supa.insertProfile(makeProfile(ORG));

    const result = await gdprDelete(ORG, { supabaseClient: supa.client });

    expect(result.status).toBe('deleted');
    expect(result.rows_deleted).toBe(1);
    expect(result.deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Profilen finns inte längre — riktigt DELETE, inte soft.
    const stored = await readProfile(ORG, { client: supa.client });
    expect(stored).toBeNull();
  });

  it('returnerar not_found med rows_deleted=0 när profilen saknas', async () => {
    const result = await gdprDelete(ORG, { supabaseClient: supa.client });
    expect(result.status).toBe('not_found');
    expect(result.rows_deleted).toBe(0);
  });

  it('är idempotent — andra delete returnerar not_found', async () => {
    supa.insertProfile(makeProfile(ORG));

    const first = await gdprDelete(ORG, { supabaseClient: supa.client });
    expect(first.status).toBe('deleted');

    const second = await gdprDelete(ORG, { supabaseClient: supa.client });
    expect(second.status).toBe('not_found');
    expect(second.rows_deleted).toBe(0);
  });
});

describe('main (argv routing)', () => {
  let workDir: string;
  let classificationsPath: string;
  let deliveriesPath: string;
  let supa: ReturnType<typeof makeFakeSupabase>;
  let stdout: ReturnType<typeof vi.fn>;
  let stderr: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'cli-main-'));
    classificationsPath = path.join(workDir, 'classifications.jsonl');
    deliveriesPath = path.join(workDir, 'deliveries.jsonl');
    supa = makeFakeSupabase();
    __resetClientForTests();
    stdout = vi.fn();
    stderr = vi.fn();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('kör export-subkommando och skriver giltig JSON till stdout', async () => {
    supa.insertProfile(makeProfile(ORG));
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG)]);
    await writeJsonl(deliveriesPath, []);

    const code = await main(
      ['export', ORG],
      { stdout, stderr },
      { classificationsPath, deliveriesPath, supabaseClient: supa.client },
    );

    expect(code).toBe(0);
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledOnce();
    const printed = stdout.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(printed);
    expect(parsed.orgnr).toBe(ORG);
    expect(parsed.profile.company_identity.company_registration_number).toBe(ORG);
    expect(parsed.classifications).toHaveLength(1);
  });

  it('kör delete-subkommando och returnerar exit 0 vid lyckad hard delete', async () => {
    supa.insertProfile(makeProfile(ORG));

    const code = await main(
      ['delete', ORG],
      { stdout, stderr },
      { supabaseClient: supa.client },
    );

    expect(code).toBe(0);
    const printed = stdout.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(printed);
    expect(parsed.status).toBe('deleted');
    // Operatören vill se "deleted N rows" som confirmation.
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('deleted 1 rows'));
  });

  it('returnerar exit 1 vid delete på okänd orgnr', async () => {
    const code = await main(
      ['delete', ORG],
      { stdout, stderr },
      { supabaseClient: supa.client },
    );
    expect(code).toBe(1);
    const printed = stdout.mock.calls[0]?.[0] as string;
    expect(JSON.parse(printed).status).toBe('not_found');
  });

  it('skriver USAGE och returnerar 0 vid `help`', async () => {
    const code = await main(['help'], { stdout, stderr });
    expect(code).toBe(0);
    expect(stdout.mock.calls[0]?.[0]).toContain('Användning');
  });

  it('returnerar exit 2 om subkommando saknar orgnr', async () => {
    const code = await main(['export'], { stdout, stderr });
    expect(code).toBe(2);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Missing orgnr'));
  });

  it('returnerar exit 2 vid okänt subkommando', async () => {
    const code = await main(['weirdcmd', ORG], { stdout, stderr });
    expect(code).toBe(2);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unknown subcommand'));
  });

  it('returnerar exit 1 om orgnr har felaktigt format', async () => {
    const code = await main(
      ['export', '12345'],
      { stdout, stderr },
      { supabaseClient: supa.client },
    );
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Error:'));
  });
});
