/**
 * GDPR-CLI för Watcher Cloud.
 *
 * Två subkommandon (manuell argv-parsing — inga extra deps):
 *
 *   bun run gdpr export <orgnr>   → JSON till stdout med profile,
 *                                    classifications och deliveries
 *                                    för orgnr (artikel 15 GDPR).
 *   bun run gdpr delete <orgnr>   → HARD DELETE FROM customer_profiles
 *                                    WHERE orgnr = $1 via Supabase store.
 *                                    Append-only-loggar (classifications,
 *                                    deliveries) bevaras enligt
 *                                    behandlingsregistret (30 dagar) men
 *                                    profilen försvinner direkt.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  read as readProfile,
  remove as removeProfile,
} from '../watcher/customer-profile/store.js';
import type { CustomerProfile } from '../watcher/customer-profile/types.js';
import type { Classification } from './schema/classification.js';
import type { Delivery } from './schema/delivery.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CLASSIFICATIONS_PATH = path.resolve(here, 'data', 'classifications.jsonl');
const DEFAULT_DELIVERIES_PATH = path.resolve(here, 'data', 'deliveries.jsonl');

export type CliPaths = {
  classificationsPath?: string;
  deliveriesPath?: string;
  /** Inject SupabaseClient (för tester). Default: env-backed singleton. */
  supabaseClient?: SupabaseClient;
};

export type ExportResult = {
  orgnr: string;
  exported_at: string;
  profile: CustomerProfile | null;
  classifications: Classification[];
  deliveries: Delivery[];
};

export type DeleteResult = {
  orgnr: string;
  deleted_at: string;
  status: 'deleted' | 'not_found';
  rows_deleted: number;
};

async function loadJsonl<T>(filePath: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: T[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // Tysta — CLI är best-effort, malformade rader ignoreras precis
      // som i delivery.ts.
    }
  }
  return out;
}

function storeOpts(paths: CliPaths) {
  return paths.supabaseClient ? { client: paths.supabaseClient } : undefined;
}

export async function gdprExport(
  orgnr: string,
  paths: CliPaths = {},
): Promise<ExportResult> {
  const classificationsPath = paths.classificationsPath ?? DEFAULT_CLASSIFICATIONS_PATH;
  const deliveriesPath = paths.deliveriesPath ?? DEFAULT_DELIVERIES_PATH;

  const profile = await readProfile(orgnr, storeOpts(paths));
  const allClassifications = await loadJsonl<Classification>(classificationsPath);
  const allDeliveries = await loadJsonl<Delivery>(deliveriesPath);

  const classifications = allClassifications.filter((c) => c.customer_orgnr === orgnr);
  const classificationIds = new Set(classifications.map((c) => c.id));
  const deliveries = allDeliveries.filter((d) => classificationIds.has(d.classification_id));

  return {
    orgnr,
    exported_at: new Date().toISOString(),
    profile,
    classifications,
    deliveries,
  };
}

export async function gdprDelete(
  orgnr: string,
  paths: CliPaths = {},
): Promise<DeleteResult> {
  const removed = await removeProfile(orgnr, storeOpts(paths));
  return {
    orgnr,
    deleted_at: new Date().toISOString(),
    status: removed ? 'deleted' : 'not_found',
    rows_deleted: removed ? 1 : 0,
  };
}

const USAGE = `KAMMAREN GDPR-CLI

Användning:
  bun run gdpr export <orgnr>   Exporterar profile + classifications + deliveries som JSON.
  bun run gdpr delete <orgnr>   HARD DELETE FROM customer_profiles WHERE orgnr = $1.

orgnr-format: XXXXXX-XXXX (svensk organisationsnummer)`;

export type CliIo = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

export async function main(
  argv: ReadonlyArray<string>,
  io: CliIo = defaultIo,
  paths: CliPaths = {},
): Promise<number> {
  const [subcommand, orgnr] = argv;

  if (!subcommand || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    io.stdout(USAGE);
    return 0;
  }

  if (!orgnr) {
    io.stderr(`Missing orgnr argument for "${subcommand}".`);
    io.stderr(USAGE);
    return 2;
  }

  try {
    if (subcommand === 'export') {
      const result = await gdprExport(orgnr, paths);
      io.stdout(JSON.stringify(result, null, 2));
      return 0;
    }
    if (subcommand === 'delete') {
      const result = await gdprDelete(orgnr, paths);
      io.stdout(JSON.stringify(result, null, 2));
      io.stderr(`deleted ${result.rows_deleted} rows`);
      return result.status === 'not_found' ? 1 : 0;
    }
    io.stderr(`Unknown subcommand: "${subcommand}".`);
    io.stderr(USAGE);
    return 2;
  } catch (err) {
    io.stderr(`Error: ${(err as Error).message}`);
    return 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith('cli.ts');

if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
