import { mkdir, readFile, writeFile, readdir, unlink, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  assertOrgNumber,
  ORG_NUMBER_PATTERN,
  SCHEMA_VERSION,
  type CustomerProfile,
  type CustomerProfilePatch,
  type OrgNumber,
} from './types.js';

const DEFAULT_VAULT_DIR = resolve(process.cwd(), 'vault', 'customers');

export type StoreOptions = {
  /** Override vault directory. Defaults to <cwd>/vault/customers. */
  vaultDir?: string;
};

function resolveVaultDir(options?: StoreOptions): string {
  return options?.vaultDir ?? DEFAULT_VAULT_DIR;
}

function profilePath(orgnr: string, options?: StoreOptions): string {
  return join(resolveVaultDir(options), `${orgnr}.json`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyProfile(orgnr: OrgNumber): CustomerProfile {
  return {
    company_identity: { company_registration_number: orgnr },
    business_activity: {},
    tax_profile: {},
    accounting_reporting_profile: {},
    governance_profile: {},
    employment_profile: {},
    gdpr_profile: {},
    workplace_safety_profile: {},
    cyber_nis2_profile: {},
    meta: {
      schema_version: SCHEMA_VERSION,
      profile_last_updated_at: nowIso(),
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

// CONTRACT: deep-merge per JSON Merge Patch (RFC 7396) — objects merge,
// arrays and primitives replace. Keeps `sni_codes[]` from accumulating duplicates.
function deepMerge<T extends Record<string, unknown>>(target: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(resolve(path, '..'), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  const { rename } = await import('node:fs/promises');
  await rename(tmp, path);
}

export async function read(
  orgnr: string,
  options?: StoreOptions,
): Promise<CustomerProfile | null> {
  assertOrgNumber(orgnr);
  const path = profilePath(orgnr, options);
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as CustomerProfile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function exists(orgnr: string, options?: StoreOptions): Promise<boolean> {
  assertOrgNumber(orgnr);
  return pathExists(profilePath(orgnr, options));
}

export async function upsert(
  orgnr: string,
  profile: CustomerProfile,
  options?: StoreOptions,
): Promise<CustomerProfile> {
  assertOrgNumber(orgnr);
  if (profile.company_identity.company_registration_number !== orgnr) {
    throw new Error(
      `orgnr mismatch: filename "${orgnr}" vs payload "${profile.company_identity.company_registration_number}".`,
    );
  }
  const next: CustomerProfile = {
    ...profile,
    meta: {
      ...profile.meta,
      schema_version: profile.meta?.schema_version ?? SCHEMA_VERSION,
      profile_last_updated_at: nowIso(),
    },
  };
  await writeJson(profilePath(orgnr, options), next);
  return next;
}

export async function patch(
  orgnr: string,
  partial: CustomerProfilePatch,
  options?: StoreOptions,
): Promise<CustomerProfile> {
  assertOrgNumber(orgnr);
  if (
    partial.company_identity?.company_registration_number !== undefined &&
    partial.company_identity.company_registration_number !== orgnr
  ) {
    throw new Error(
      `orgnr mismatch in patch: filename "${orgnr}" vs payload "${partial.company_identity.company_registration_number}".`,
    );
  }
  const current = (await read(orgnr, options)) ?? emptyProfile(orgnr as OrgNumber);
  const merged = deepMerge(current as unknown as Record<string, unknown>, partial as Record<string, unknown>) as unknown as CustomerProfile;
  merged.company_identity.company_registration_number = orgnr as OrgNumber;
  merged.meta = {
    ...merged.meta,
    schema_version: merged.meta?.schema_version ?? SCHEMA_VERSION,
    profile_last_updated_at: nowIso(),
  };
  await writeJson(profilePath(orgnr, options), merged);
  return merged;
}

export async function list(options?: StoreOptions): Promise<OrgNumber[]> {
  const dir = resolveVaultDir(options);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter((stem) => ORG_NUMBER_PATTERN.test(stem))
    .sort() as OrgNumber[];
}

export async function remove(orgnr: string, options?: StoreOptions): Promise<boolean> {
  assertOrgNumber(orgnr);
  try {
    await unlink(profilePath(orgnr, options));
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}
