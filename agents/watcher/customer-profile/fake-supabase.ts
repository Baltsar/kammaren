/**
 * In-memory Supabase-shim för tester.
 *
 * Bara testkod ska importera detta — produktionskod använder
 * @supabase/supabase-js direkt via env. Filen följer .ts (inte .test.ts)
 * eftersom flera tester delar den.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { SCHEMA_VERSION, type CustomerProfile, type OrgNumber } from './types.js';

export type FakeRow = {
  orgnr: string;
  company_name: string | null;
  contact_email: string | null;
  telegram_chat_id: string | null;
  consent_terms_accepted_at: string | null;
  consent_privacy_accepted_at: string | null;
  consent_b2b_acknowledged_at: string | null;
  is_paused: boolean | null;
  deleted_at: string | null;
  business_activity: Record<string, unknown>;
  tax_profile: Record<string, unknown>;
  accounting_reporting_profile: Record<string, unknown>;
  governance_profile: Record<string, unknown>;
  employment_profile: Record<string, unknown>;
  gdpr_profile: Record<string, unknown>;
  workplace_safety_profile: Record<string, unknown>;
  cyber_nis2_profile: Record<string, unknown>;
  schema_version: string;
  created_at: string;
  updated_at: string;
};

export type FakeSupabase = {
  client: SupabaseClient;
  rows: Map<string, FakeRow>;
  insertProfile: (profile: CustomerProfile) => void;
};

function profileToRow(profile: CustomerProfile): FakeRow {
  const identity = profile.company_identity as Record<string, unknown>;
  const orgnr = String(identity.company_registration_number);
  const ts = new Date().toISOString();
  return {
    orgnr,
    company_name:
      typeof identity.company_name === 'string' ? (identity.company_name as string) : null,
    contact_email:
      typeof identity.contact_email === 'string' ? (identity.contact_email as string) : null,
    telegram_chat_id: profile.telegram_chat_id ?? null,
    consent_terms_accepted_at: profile.consent_terms_accepted_at ?? null,
    consent_privacy_accepted_at: profile.consent_privacy_accepted_at ?? null,
    consent_b2b_acknowledged_at: profile.consent_b2b_acknowledged_at ?? null,
    is_paused: profile.is_paused ?? false,
    deleted_at: profile.meta?.deleted_at ?? null,
    business_activity: profile.business_activity ?? {},
    tax_profile: profile.tax_profile ?? {},
    accounting_reporting_profile: profile.accounting_reporting_profile ?? {},
    governance_profile: profile.governance_profile ?? {},
    employment_profile: profile.employment_profile ?? {},
    gdpr_profile: profile.gdpr_profile ?? {},
    workplace_safety_profile: profile.workplace_safety_profile ?? {},
    cyber_nis2_profile: profile.cyber_nis2_profile ?? {},
    schema_version: profile.meta?.schema_version ?? SCHEMA_VERSION,
    created_at: ts,
    updated_at: ts,
  };
}

export function makeFakeSupabase(initialRows: FakeRow[] = []): FakeSupabase {
  const rows = new Map<string, FakeRow>();
  for (const row of initialRows) rows.set(row.orgnr, row);

  function nowIso(): string {
    return new Date().toISOString();
  }

  function rowFromInsert(input: Record<string, unknown>): FakeRow {
    const orgnr = String(input.orgnr);
    const existing = rows.get(orgnr);
    const created_at = existing?.created_at ?? nowIso();
    return {
      orgnr,
      company_name: (input.company_name as string | null) ?? null,
      contact_email: (input.contact_email as string | null) ?? null,
      telegram_chat_id: (input.telegram_chat_id as string | null) ?? null,
      consent_terms_accepted_at:
        (input.consent_terms_accepted_at as string | null) ?? null,
      consent_privacy_accepted_at:
        (input.consent_privacy_accepted_at as string | null) ?? null,
      consent_b2b_acknowledged_at:
        (input.consent_b2b_acknowledged_at as string | null) ?? null,
      is_paused: (input.is_paused as boolean | null) ?? false,
      deleted_at: (input.deleted_at as string | null) ?? null,
      business_activity: (input.business_activity as Record<string, unknown>) ?? {},
      tax_profile: (input.tax_profile as Record<string, unknown>) ?? {},
      accounting_reporting_profile:
        (input.accounting_reporting_profile as Record<string, unknown>) ?? {},
      governance_profile: (input.governance_profile as Record<string, unknown>) ?? {},
      employment_profile: (input.employment_profile as Record<string, unknown>) ?? {},
      gdpr_profile: (input.gdpr_profile as Record<string, unknown>) ?? {},
      workplace_safety_profile:
        (input.workplace_safety_profile as Record<string, unknown>) ?? {},
      cyber_nis2_profile: (input.cyber_nis2_profile as Record<string, unknown>) ?? {},
      schema_version: (input.schema_version as string | null) ?? SCHEMA_VERSION,
      created_at,
      updated_at: nowIso(),
    };
  }

  function from(table: string): unknown {
    if (table !== 'customer_profiles') {
      throw new Error(`fake-supabase: unexpected table "${table}"`);
    }

    type Filter = { type: 'eq' | 'is'; column: string; value: unknown };
    type Mode =
      | { kind: 'select'; columns: string }
      | { kind: 'upsert'; payload: Record<string, unknown> }
      | { kind: 'delete' };

    const filters: Filter[] = [];
    let mode: Mode = { kind: 'select', columns: '*' };
    let selectAfter = false;

    function matches(row: FakeRow): boolean {
      for (const f of filters) {
        const lhs = (row as unknown as Record<string, unknown>)[f.column];
        if (f.type === 'eq' && lhs !== f.value) return false;
        if (f.type === 'is' && f.value === null && lhs !== null) return false;
      }
      return true;
    }

    function applyFilters(): FakeRow[] {
      return Array.from(rows.values()).filter(matches);
    }

    const builder: Record<string, unknown> = {
      select(columns = '*') {
        if (mode.kind === 'select') (mode as { columns: string }).columns = columns;
        selectAfter = true;
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push({ type: 'eq', column, value });
        return builder;
      },
      is(column: string, value: unknown) {
        filters.push({ type: 'is', column, value });
        return builder;
      },
      order(_c: string, _o?: Record<string, unknown>) {
        return builder;
      },
      returns() {
        return builder;
      },
      upsert(payload: Record<string, unknown>, _opts?: Record<string, unknown>) {
        mode = { kind: 'upsert', payload };
        return builder;
      },
      delete() {
        mode = { kind: 'delete' };
        return builder;
      },
      async maybeSingle() {
        const matched = applyFilters();
        if (matched.length === 0) return { data: null, error: null };
        if (matched.length > 1) {
          return {
            data: null,
            error: { message: 'multiple rows returned for maybeSingle' },
          };
        }
        return { data: matched[0], error: null };
      },
      async single() {
        if (mode.kind === 'upsert') {
          const row = rowFromInsert(mode.payload);
          rows.set(row.orgnr, row);
          return { data: row, error: null };
        }
        const matched = applyFilters();
        if (matched.length === 0) return { data: null, error: { message: 'no rows' } };
        return { data: matched[0], error: null };
      },
      then(
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        if (mode.kind === 'upsert') {
          const row = rowFromInsert(mode.payload);
          rows.set(row.orgnr, row);
          return Promise.resolve({ data: [row], error: null }).then(onFulfilled, onRejected);
        }
        if (mode.kind === 'delete') {
          const matched = applyFilters();
          for (const row of matched) rows.delete(row.orgnr);
          const returned = selectAfter ? matched.map((r) => ({ orgnr: r.orgnr })) : null;
          return Promise.resolve({ data: returned, error: null }).then(onFulfilled, onRejected);
        }
        const matched = applyFilters();
        return Promise.resolve({ data: matched, error: null }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    client: { from } as unknown as SupabaseClient,
    rows,
    insertProfile(profile: CustomerProfile) {
      rows.set(
        String((profile.company_identity as { company_registration_number: OrgNumber })
          .company_registration_number),
        profileToRow(profile),
      );
    },
  };
}
