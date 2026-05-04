import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { list, read } from '../watcher/customer-profile/store.js';
import type { CustomerProfile } from '../watcher/customer-profile/types.js';
import { loadExistingIds } from '../watcher/poller/dedupe.js';
import type { WatcherEvent } from '../watcher/schema/event.js';
import { matchCustomer } from './rules/customer-matcher.js';
import { tagEvent } from './rules/event-tagger.js';
import { type Classification, makeClassificationId } from './schema/classification.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_PATH = path.resolve(here, '..', 'watcher', 'data', 'events.jsonl');
const CLASSIFICATIONS_PATH = path.resolve(here, 'data', 'classifications.jsonl');

export type RunClassifierResult = {
  processed: number;
  skipped: number;
  relevant: number;
  irrelevant: number;
  unknown_only: number;
  skipped_existing: number;
  skipped_broken_profile: number;
  events_loaded: number;
  customers_loaded: number;
  by_severity: { info: number; warning: number; action_required: number };
};

export type RunClassifierOptions = {
  eventsPath?: string;
  outputPath?: string;
  vaultDir?: string;
  now?: () => Date;
};

function emptyResult(): RunClassifierResult {
  return {
    processed: 0,
    skipped: 0,
    relevant: 0,
    irrelevant: 0,
    unknown_only: 0,
    skipped_existing: 0,
    skipped_broken_profile: 0,
    events_loaded: 0,
    customers_loaded: 0,
    by_severity: { info: 0, warning: 0, action_required: 0 },
  };
}

async function loadEvents(eventsPath: string): Promise<WatcherEvent[]> {
  const events: WatcherEvent[] = [];
  let raw: string;
  try {
    raw = await readFile(eventsPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return events;
    throw err;
  }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as WatcherEvent);
    } catch (err) {
      console.warn(`[classifier] skipping malformed event line: ${(err as Error).message}`);
    }
  }
  return events;
}

async function loadCustomers(
  vaultDir: string | undefined,
): Promise<{ customers: CustomerProfile[]; broken: number }> {
  const orgnrs = await list(vaultDir ? { vaultDir } : undefined);
  const customers: CustomerProfile[] = [];
  let broken = 0;

  for (const orgnr of orgnrs) {
    try {
      const profile = await read(orgnr, vaultDir ? { vaultDir } : undefined);
      if (profile) customers.push(profile);
      else broken += 1;
    } catch (err) {
      broken += 1;
      console.error(
        `[classifier] skipping broken profile ${orgnr}: ${(err as Error).message}`,
      );
    }
  }

  return { customers, broken };
}

function getOrgnr(profile: CustomerProfile): string | null {
  const orgnr = profile.company_identity?.company_registration_number;
  return typeof orgnr === 'string' ? orgnr : null;
}

export async function runClassifier(
  options: RunClassifierOptions = {},
): Promise<RunClassifierResult> {
  const eventsPath = options.eventsPath ?? EVENTS_PATH;
  const outputPath = options.outputPath ?? CLASSIFICATIONS_PATH;
  const now = options.now ?? (() => new Date());
  const result = emptyResult();

  const [events, customerLoad, existing] = await Promise.all([
    loadEvents(eventsPath),
    loadCustomers(options.vaultDir),
    loadExistingIds(outputPath),
  ]);

  result.events_loaded = events.length;
  result.customers_loaded = customerLoad.customers.length;
  result.skipped_broken_profile += customerLoad.broken;

  const lines: string[] = [];

  for (const event of events) {
    const tags = tagEvent(event);
    const onlyUnknown = tags.length === 1 && tags[0] === 'okand';

    for (const profile of customerLoad.customers) {
      const orgnr = getOrgnr(profile);
      if (!orgnr) {
        result.skipped_broken_profile += 1;
        continue;
      }

      const id = makeClassificationId(event.id, orgnr);
      if (existing.has(id)) {
        result.skipped_existing += 1;
        continue;
      }

      let match;
      try {
        match = matchCustomer(event, tags, profile);
      } catch (err) {
        result.skipped_broken_profile += 1;
        console.error(
          `[classifier] skipping ${orgnr} for event ${event.id}: ${(err as Error).message}`,
        );
        continue;
      }

      const classification: Classification = {
        id,
        event_id: event.id,
        customer_orgnr: orgnr,
        relevant: match.relevant,
        severity: match.severity,
        tags,
        matched_rules: match.matched_rules,
        summary: match.summary,
        classified_at: now().toISOString(),
        method: 'deterministic',
      };

      result.processed += 1;
      if (match.relevant) result.relevant += 1;
      else result.irrelevant += 1;
      if (onlyUnknown) result.unknown_only += 1;
      result.by_severity[match.severity] += 1;

      existing.add(id);
      lines.push(JSON.stringify(classification));
    }
  }

  if (lines.length > 0) {
    await appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  }

  result.skipped = result.skipped_existing + result.skipped_broken_profile;

  if (result.unknown_only > 0) {
    console.log(
      `[classifier] ${result.unknown_only} event×kund-par fick endast 'okand'-tag — kandidater för LLM-fallback`,
    );
  }

  return result;
}
