import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDelivery } from './delivery.js';
import type { Classification, Severity } from './schema/classification.js';
import { makeClassificationId } from './schema/classification.js';
import type { Delivery } from './schema/delivery.js';
import { makeDeliveryId } from './schema/delivery.js';
import type { CustomerProfile } from '../watcher/customer-profile/types.js';
import { SCHEMA_VERSION } from '../watcher/customer-profile/types.js';
import type { WatcherEvent } from '../watcher/schema/event.js';

function makeEvent(id: string, title: string): WatcherEvent {
  return {
    id,
    source: 'riksdagen',
    type: 'sfs',
    title,
    url: `https://example.test/${id}`,
    published_at: '2026-05-01T00:00:00.000Z',
    raw: {},
    fetched_at: '2026-05-01T00:00:00.000Z',
  };
}

function makeProfile(orgnr: string, chatId: string | null = null): CustomerProfile {
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
    telegram_chat_id: chatId,
    meta: { schema_version: SCHEMA_VERSION },
  };
}

function makeClassification(
  eventId: string,
  orgnr: string,
  severity: Severity,
  relevant = true,
): Classification {
  return {
    id: makeClassificationId(eventId, orgnr),
    event_id: eventId,
    customer_orgnr: orgnr,
    relevant,
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

const ORG = '556677-8899';
const ORG_2 = '888888-1111';

describe('runDelivery', () => {
  let workDir: string;
  let eventsPath: string;
  let classificationsPath: string;
  let deliveriesPath: string;
  let vaultDir: string;
  let send: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'delivery-'));
    eventsPath = path.join(workDir, 'events.jsonl');
    classificationsPath = path.join(workDir, 'classifications.jsonl');
    deliveriesPath = path.join(workDir, 'deliveries.jsonl');
    vaultDir = path.join(workDir, 'vault');
    await mkdir(vaultDir, { recursive: true });
    // Default: lyckad send som returnerar deterministisk message_id.
    send = vi.fn(async () => ({ message_id: 100 }));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('skickar för relevant + severity=action_required', async () => {
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [
      makeClassification('e1', ORG, 'action_required'),
    ]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.attempted).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('skickar för relevant + severity=warning', async () => {
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG, 'warning')]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.sent).toBe(1);
  });

  it('hoppar över severity=info (skipped_severity++)', async () => {
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG, 'info')]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.skipped_severity).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('hoppar över relevant=false oavsett severity', async () => {
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [
      makeClassification('e1', ORG, 'action_required', false),
    ]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.skipped_severity).toBe(1);
  });

  it('hoppar över när telegram_chat_id är null + loggar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG, 'action_required')]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, null)));

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.skipped_no_chat_id).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(ORG));
  });

  it('idempotens — andra körning på samma classification skickar inget', async () => {
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG, 'action_required')]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    const first = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });
    expect(first.sent).toBe(1);
    expect(send).toHaveBeenCalledOnce();

    const second = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).toHaveBeenCalledOnce(); // fortfarande bara ett anrop
    expect(second.sent).toBe(0);
    expect(second.skipped_existing).toBe(1);
  });

  it('en kund-krasch stoppar inte nästa kund', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [
      makeClassification('e1', ORG, 'action_required'),
      makeClassification('e1', ORG_2, 'action_required'),
    ]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '111')));
    await writeFile(path.join(vaultDir, `${ORG_2}.json`), JSON.stringify(makeProfile(ORG_2, '222')));

    let calls = 0;
    send = vi.fn(async (chatId: string) => {
      calls += 1;
      if (chatId === '111') throw new Error('Bad Request: chat not found');
      return { message_id: 200 + calls };
    });

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(1);
    expect(err).toHaveBeenCalled();
  });

  it('hoppar över om kund-profil saknas (orphan classification)', async () => {
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG, 'action_required')]);
    // Inga profil-filer skrivna.

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.skipped_no_customer).toBe(1);
  });

  it('hoppar över om event saknas (orphan classification utan event)', async () => {
    await writeJsonl(eventsPath, []);
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG, 'action_required')]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).not.toHaveBeenCalled();
    // Vi räknar saknat event som "no_customer"-kategorisering hade varit fel —
    // separat räknare så vi kan se om watcher tappat events.
    expect(result.skipped_no_event).toBe(1);
  });

  it('appendar Delivery-objekt med rätt fält till deliveries.jsonl', async () => {
    const now = () => new Date('2026-05-04T15:30:00.000Z');
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    const c = makeClassification('e1', ORG, 'action_required');
    await writeJsonl(classificationsPath, [c]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    send = vi.fn(async () => ({ message_id: 4242 }));

    await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
      now,
    });

    const written = (await readFile(deliveriesPath, 'utf8')).trim().split('\n');
    expect(written).toHaveLength(1);
    const delivery = JSON.parse(written[0]) as Delivery;

    expect(delivery).toEqual({
      id: makeDeliveryId(c.id, 'telegram'),
      classification_id: c.id,
      channel: 'telegram',
      chat_id: '999',
      message_id: 4242,
      sent_at: '2026-05-04T15:30:00.000Z',
    });
  });

  it('skickar formatterat MarkdownV2-meddelande inkluderande titel och URL', async () => {
    await writeJsonl(eventsPath, [
      makeEvent('e1', 'Förordning (2026:1) om moms'),
    ]);
    await writeJsonl(classificationsPath, [makeClassification('e1', ORG, 'action_required')]);
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).toHaveBeenCalledOnce();
    const [chatId, message] = send.mock.calls[0] as [string, string];
    expect(chatId).toBe('999');
    expect(message).toContain('Förordning \\(2026:1\\) om moms');
    expect(message).toContain('https://example.test/e1');
    expect(message).toContain('⚠️');
  });

  it('hanterar tom classifications.jsonl utan att krascha', async () => {
    await writeJsonl(eventsPath, []);
    await writeFile(classificationsPath, '');

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(result.attempted).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('hoppar över trasiga JSON-rader i classifications.jsonl och loggar warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await writeJsonl(eventsPath, [makeEvent('e1', 'Lag om moms')]);
    await writeFile(
      classificationsPath,
      `not-json\n${JSON.stringify(makeClassification('e1', ORG, 'action_required'))}\n`,
    );
    await writeFile(path.join(vaultDir, `${ORG}.json`), JSON.stringify(makeProfile(ORG, '999')));

    const result = await runDelivery({
      eventsPath,
      classificationsPath,
      deliveriesPath,
      vaultDir,
      send,
    });

    expect(send).toHaveBeenCalledOnce();
    expect(result.sent).toBe(1);
    expect(warn).toHaveBeenCalled();
  });
});
