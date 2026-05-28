/**
 * Customer-profile store — Supabase-backed (eu-north-1 Stockholm).
 *
 * Tidigare implementation lagrade per-kund-JSON i `vault/customers/<orgnr>.json`.
 * Repot är publikt + AGPL-3.0, så filerna läckte PII (telegram_chat_id,
 * orgnr, consent-stämplar) på GitHub. Lösning: flytta till Supabase Pro
 * i eu-north-1 (Stockholm) bakom RLS deny-all för anon/authenticated.
 * service_role bypassar RLS — läses bara serverside via env.
 *
 * API-yta är identisk med fil-versionen för bakåtkompat: `read`, `exists`,
 * `upsert`, `patch`, `list`, `remove`. Ny helper: `listActiveCustomers()`
 * som filtrerar bort paused och soft-deleted i SQL.
 *
 * Lazy client init: env läses först vid första anropet så imports
 * inte kraschar i tester utan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
 *
 * GDPR-radering: `remove()` är HARD DELETE FROM customer_profiles
 * WHERE orgnr = $1. Soft-delete via `deleted_at` finns kvar som kolumn
 * men vi använder den inte — operatörens preferens är riktig DELETE.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  assertOrgNumber,
  SCHEMA_VERSION,
  type CustomerProfile,
  type CustomerProfilePatch,
  type OrgNumber,
} from './types.js';

export type StoreOptions = {
  /** Inject SupabaseClient (för tester). Default: env-backed singleton. */
  client?: SupabaseClient;
};

type CustomerRow = {
  orgnr: string;
  company_name: string | null;
  contact_email: string | null;
  telegram_chat_id: string | null;
  consent_terms_accepted_at: string | null;
  consent_privacy_accepted_at: string | null;
  consent_b2b_acknowledged_at: string | null;
  is_paused: boolean | null;
  deleted_at: string | null;
  business_activity: Record<string, unknown> | null;
  tax_profile: Record<string, unknown> | null;
  accounting_reporting_profile: Record<string, unknown> | null;
  governance_profile: Record<string, unknown> | null;
  employment_profile: Record<string, unknown> | null;
  gdpr_profile: Record<string, unknown> | null;
  workplace_safety_profile: Record<string, unknown> | null;
  cyber_nis2_profile: Record<string, unknown> | null;
  schema_version: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CustomerRowUpsert = Omit<CustomerRow, 'created_at' | 'updated_at'>;

const TABLE = 'customer_profiles';

let cachedClient: SupabaseClient | null = null;

function buildClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error(
      'SUPABASE_URL saknas i env. Sätt SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY innan customer-profile store används.',
    );
  }
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY saknas i env. Service-role-nyckeln läses bara serverside; aldrig i klienten.',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
}

function getClient(options?: StoreOptions): SupabaseClient {
  if (options?.client) return options.client;
  if (!cachedClient) cachedClient = buildClient();
  return cachedClient;
}

/** För tester: tvinga ny client-uppslagning nästa anrop. */
export function __resetClientForTests(): void {
  cachedClient = null;
}

function emptyObject(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value ?? {};
}

function rowToProfile(row: CustomerRow): CustomerProfile {
  const companyIdentity: Record<string, unknown> = {
    company_registration_number: row.orgnr as OrgNumber,
  };
  if (row.company_name !== null && row.company_name !== undefined) {
    companyIdentity.company_name = row.company_name;
  }
  if (row.contact_email !== null && row.contact_email !== undefined) {
    companyIdentity.contact_email = row.contact_email;
  }

  return {
    company_identity: companyIdentity as CustomerProfile['company_identity'],
    business_activity: emptyObject(row.business_activity),
    tax_profile: emptyObject(row.tax_profile),
    accounting_reporting_profile: emptyObject(row.accounting_reporting_profile),
    governance_profile: emptyObject(row.governance_profile),
    employment_profile: emptyObject(row.employment_profile),
    gdpr_profile: emptyObject(row.gdpr_profile),
    workplace_safety_profile: emptyObject(row.workplace_safety_profile),
    cyber_nis2_profile: emptyObject(row.cyber_nis2_profile),
    telegram_chat_id: row.telegram_chat_id,
    consent_terms_accepted_at: row.consent_terms_accepted_at,
    consent_privacy_accepted_at: row.consent_privacy_accepted_at,
    consent_b2b_acknowledged_at: row.consent_b2b_acknowledged_at,
    is_paused: row.is_paused === null ? undefined : row.is_paused,
    meta: {
      schema_version: row.schema_version ?? SCHEMA_VERSION,
      profile_last_updated_at: row.updated_at ?? undefined,
      ...(row.deleted_at ? { deleted_at: row.deleted_at } : {}),
    },
  };
}

function profileToRow(orgnr: string, profile: CustomerProfile): CustomerRowUpsert {
  const identity = profile.company_identity as Record<string, unknown>;
  const companyName =
    typeof identity.company_name === 'string' ? (identity.company_name as string) : null;
  const contactEmail =
    typeof identity.contact_email === 'string' ? (identity.contact_email as string) : null;
  const schemaVersion = profile.meta?.schema_version ?? SCHEMA_VERSION;
  return {
    orgnr,
    company_name: companyName,
    contact_email: contactEmail,
    telegram_chat_id: profile.telegram_chat_id ?? null,
    consent_terms_accepted_at: profile.consent_terms_accepted_at ?? null,
    consent_privacy_accepted_at: profile.consent_privacy_accepted_at ?? null,
    consent_b2b_acknowledged_at: profile.consent_b2b_acknowledged_at ?? null,
    is_paused: profile.is_paused === undefined ? false : profile.is_paused,
    deleted_at: profile.meta?.deleted_at ?? null,
    business_activity: profile.business_activity ?? {},
    tax_profile: profile.tax_profile ?? {},
    accounting_reporting_profile: profile.accounting_reporting_profile ?? {},
    governance_profile: profile.governance_profile ?? {},
    employment_profile: profile.employment_profile ?? {},
    gdpr_profile: profile.gdpr_profile ?? {},
    workplace_safety_profile: profile.workplace_safety_profile ?? {},
    cyber_nis2_profile: profile.cyber_nis2_profile ?? {},
    schema_version: schemaVersion,
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
// arrays och primitiver ersätter. Identiska semantik som fil-versionen
// hade så befintliga `patch()`-anropare beter sig oförändrat.
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
    },
  };
}

export async function read(
  orgnr: string,
  options?: StoreOptions,
): Promise<CustomerProfile | null> {
  assertOrgNumber(orgnr);
  const client = getClient(options);
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('orgnr', orgnr)
    .maybeSingle<CustomerRow>();

  if (error) {
    throw new Error(`Supabase read(${orgnr}) misslyckades: ${error.message}`);
  }
  if (!data) return null;
  return rowToProfile(data);
}

export async function exists(orgnr: string, options?: StoreOptions): Promise<boolean> {
  assertOrgNumber(orgnr);
  const client = getClient(options);
  const { data, error } = await client
    .from(TABLE)
    .select('orgnr')
    .eq('orgnr', orgnr)
    .maybeSingle<{ orgnr: string }>();

  if (error) {
    throw new Error(`Supabase exists(${orgnr}) misslyckades: ${error.message}`);
  }
  return data !== null;
}

export async function upsert(
  orgnr: string,
  profile: CustomerProfile,
  options?: StoreOptions,
): Promise<CustomerProfile> {
  assertOrgNumber(orgnr);
  if (profile.company_identity.company_registration_number !== orgnr) {
    throw new Error(
      `orgnr mismatch: parameter "${orgnr}" vs payload "${profile.company_identity.company_registration_number}".`,
    );
  }

  const client = getClient(options);
  const row = profileToRow(orgnr, profile);
  const { data, error } = await client
    .from(TABLE)
    .upsert(row, { onConflict: 'orgnr' })
    .select('*')
    .single<CustomerRow>();

  if (error || !data) {
    throw new Error(
      `Supabase upsert(${orgnr}) misslyckades: ${error?.message ?? 'okänt fel'}`,
    );
  }
  return rowToProfile(data);
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
      `orgnr mismatch in patch: parameter "${orgnr}" vs payload "${partial.company_identity.company_registration_number}".`,
    );
  }

  const current = (await read(orgnr, options)) ?? emptyProfile(orgnr as OrgNumber);
  const merged = deepMerge(
    current as unknown as Record<string, unknown>,
    partial as Record<string, unknown>,
  ) as unknown as CustomerProfile;
  merged.company_identity.company_registration_number = orgnr as OrgNumber;
  merged.meta = {
    ...merged.meta,
    schema_version: merged.meta?.schema_version ?? SCHEMA_VERSION,
  };

  return upsert(orgnr, merged, options);
}

export async function list(options?: StoreOptions): Promise<OrgNumber[]> {
  const client = getClient(options);
  const { data, error } = await client
    .from(TABLE)
    .select('orgnr')
    .order('orgnr', { ascending: true })
    .returns<{ orgnr: string }[]>();

  if (error) {
    throw new Error(`Supabase list() misslyckades: ${error.message}`);
  }
  return (data ?? []).map((row) => row.orgnr as OrgNumber);
}

/**
 * Returnerar profiler som ska få notiser i delivery-pipen:
 * inte raderade (deleted_at IS NULL) och inte pausade (is_paused = false).
 * Delivery-pipen kör per kund baserat på classifications.jsonl, men för
 * fler kanaler / scheduled tasks i framtiden vill vi kunna iterera kund-
 * uppslagningen i SQL i stället för att läsa varje rad manuellt.
 */
export async function listActiveCustomers(
  options?: StoreOptions,
): Promise<CustomerProfile[]> {
  const client = getClient(options);
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .is('deleted_at', null)
    .eq('is_paused', false)
    .order('orgnr', { ascending: true })
    .returns<CustomerRow[]>();

  if (error) {
    throw new Error(`Supabase listActiveCustomers() misslyckades: ${error.message}`);
  }
  return (data ?? []).map(rowToProfile);
}

/**
 * GDPR hard delete: DELETE FROM customer_profiles WHERE orgnr = $1.
 * Returnerar true om en rad togs bort, false om ingen rad fanns.
 * Append-only-loggar (classifications.jsonl, deliveries.jsonl) berörs inte.
 */
export async function remove(orgnr: string, options?: StoreOptions): Promise<boolean> {
  assertOrgNumber(orgnr);
  const client = getClient(options);
  const { data, error } = await client
    .from(TABLE)
    .delete()
    .eq('orgnr', orgnr)
    .select('orgnr')
    .returns<{ orgnr: string }[]>();

  if (error) {
    throw new Error(`Supabase remove(${orgnr}) misslyckades: ${error.message}`);
  }
  return (data ?? []).length > 0;
}
