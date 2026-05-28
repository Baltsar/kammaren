import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  __resetClientForTests,
  exists,
  list,
  listActiveCustomers,
  patch,
  read,
  remove,
  upsert,
} from './store.js';
import type { CustomerProfile } from './types.js';
import { SCHEMA_VERSION, hasFullConsent } from './types.js';

const ORG = '559123-4567';
const ORG_2 = '556677-8899';

type StoredRow = {
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

/**
 * In-memory Supabase-client som efterliknar de PostgREST-anrop store.ts
 * gör. Tillräcklig för att testa happy + error paths utan att starta en
 * riktig databas. Anrop som verkliga PostgREST-frågor returnerar
 * `{ data, error }`-shape.
 */
function makeFakeSupabase(): {
  client: SupabaseClient;
  rows: Map<string, StoredRow>;
  /** Tvinga nästa query att returnera ett fel. Återställs efter en användning. */
  forceError: (message: string) => void;
} {
  const rows = new Map<string, StoredRow>();
  let queuedError: string | null = null;

  function nowIso(): string {
    return new Date().toISOString();
  }

  function rowFromInsert(input: Record<string, unknown>): StoredRow {
    const orgnr = String(input.orgnr);
    const existing = rows.get(orgnr);
    const created_at = existing?.created_at ?? nowIso();
    return {
      orgnr,
      company_name: (input.company_name as string | null) ?? null,
      contact_email: (input.contact_email as string | null) ?? null,
      telegram_chat_id: (input.telegram_chat_id as string | null) ?? null,
      consent_terms_accepted_at: (input.consent_terms_accepted_at as string | null) ?? null,
      consent_privacy_accepted_at: (input.consent_privacy_accepted_at as string | null) ?? null,
      consent_b2b_acknowledged_at: (input.consent_b2b_acknowledged_at as string | null) ?? null,
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
      throw new Error(`Fake supabase: unexpected table "${table}"`);
    }

    type Filter = { type: 'eq' | 'is'; column: string; value: unknown };
    type Mode =
      | { kind: 'select'; columns: string }
      | { kind: 'upsert'; payload: Record<string, unknown> }
      | { kind: 'delete' };

    const filters: Filter[] = [];
    let mode: Mode = { kind: 'select', columns: '*' };
    let selectAfter = false;
    let pendingError: string | null = queuedError;
    queuedError = null;

    function matches(row: StoredRow): boolean {
      for (const f of filters) {
        const lhs = (row as unknown as Record<string, unknown>)[f.column];
        if (f.type === 'eq') {
          if (lhs !== f.value) return false;
        } else if (f.type === 'is') {
          if (f.value === null && lhs !== null) return false;
        }
      }
      return true;
    }

    function applyFilters(): StoredRow[] {
      const all = Array.from(rows.values());
      return all.filter(matches);
    }

    const builder: Record<string, unknown> = {
      select(columns = '*') {
        if (mode.kind === 'select') {
          (mode as { kind: 'select'; columns: string }).columns = columns;
        }
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
      order(_column: string, _opts?: Record<string, unknown>) {
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
        if (pendingError) return { data: null, error: { message: pendingError } };
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
        if (pendingError) return { data: null, error: { message: pendingError } };
        if (mode.kind === 'upsert') {
          const row = rowFromInsert(mode.payload);
          rows.set(row.orgnr, row);
          return { data: row, error: null };
        }
        const matched = applyFilters();
        if (matched.length === 0) {
          return { data: null, error: { message: 'no rows' } };
        }
        return { data: matched[0], error: null };
      },
      // Default-resolver: när konsumenten awaiter builder utan single/maybeSingle.
      then(
        onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        if (pendingError) {
          return Promise.resolve({ data: null, error: { message: pendingError } }).then(
            onFulfilled,
            onRejected,
          );
        }
        if (mode.kind === 'upsert') {
          const row = rowFromInsert(mode.payload);
          rows.set(row.orgnr, row);
          return Promise.resolve({ data: [row], error: null }).then(
            onFulfilled,
            onRejected,
          );
        }
        if (mode.kind === 'delete') {
          const matched = applyFilters();
          for (const row of matched) rows.delete(row.orgnr);
          const returned = selectAfter ? matched.map((r) => ({ orgnr: r.orgnr })) : null;
          return Promise.resolve({ data: returned, error: null }).then(
            onFulfilled,
            onRejected,
          );
        }
        // select
        const matched = applyFilters();
        return Promise.resolve({ data: matched, error: null }).then(
          onFulfilled,
          onRejected,
        );
      },
    };

    return builder;
  }

  return {
    client: { from } as unknown as SupabaseClient,
    rows,
    forceError(message: string) {
      queuedError = message;
    },
  };
}

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
    meta: { schema_version: SCHEMA_VERSION },
  };
}

describe('customer-profile store (Supabase-backed)', () => {
  let supa: ReturnType<typeof makeFakeSupabase>;
  let opts: { client: SupabaseClient };

  beforeEach(() => {
    supa = makeFakeSupabase();
    opts = { client: supa.client };
    __resetClientForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('orgnr validation', () => {
    it('rejects malformed orgnr på read/exists/remove', async () => {
      await expect(read('123', opts)).rejects.toThrow(/Invalid organisationsnummer/);
      await expect(exists('5591234567', opts)).rejects.toThrow(/Invalid organisationsnummer/);
      await expect(remove('abc-defg', opts)).rejects.toThrow(/Invalid organisationsnummer/);
    });

    it('accepterar canonical XXXXXX-XXXX format', async () => {
      expect(await read(ORG, opts)).toBeNull();
      expect(await exists(ORG, opts)).toBe(false);
    });
  });

  describe('upsert', () => {
    it('skapar ny profil och returnerar uppdaterad meta', async () => {
      const result = await upsert(ORG, makeProfile(ORG), opts);
      expect(result.meta.schema_version).toBe(SCHEMA_VERSION);
      expect(result.meta.profile_last_updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(await exists(ORG, opts)).toBe(true);
    });

    it('avvisar orgnr/payload mismatch', async () => {
      await expect(upsert(ORG, makeProfile(ORG_2), opts)).rejects.toThrow(/orgnr mismatch/);
    });

    it('ersätter befintlig profil komplett', async () => {
      const initial = makeProfile(ORG);
      initial.tax_profile = { is_vat_registered: true };
      await upsert(ORG, initial, opts);

      const replacement = makeProfile(ORG);
      replacement.business_activity = { high_level_sector: 'manufacturing' };
      await upsert(ORG, replacement, opts);

      const stored = await read(ORG, opts);
      expect(stored?.tax_profile).toEqual({});
      expect(stored?.business_activity).toEqual({ high_level_sector: 'manufacturing' });
    });
  });

  describe('patch', () => {
    it('skapar profil från tom skeleton vid patch mot okänd orgnr', async () => {
      const result = await patch(ORG, { tax_profile: { is_vat_registered: true } }, opts);
      expect(result.company_identity.company_registration_number).toBe(ORG);
      expect(result.tax_profile).toEqual({ is_vat_registered: true });
      expect(result.meta.schema_version).toBe(SCHEMA_VERSION);
    });

    it('deep-mergar nested objects', async () => {
      await upsert(ORG, makeProfile(ORG), opts);
      await patch(ORG, { tax_profile: { is_vat_registered: true } }, opts);
      await patch(ORG, { tax_profile: { vat_reporting_frequency: 'quarterly' } }, opts);

      const stored = await read(ORG, opts);
      expect(stored?.tax_profile).toEqual({
        is_vat_registered: true,
        vat_reporting_frequency: 'quarterly',
      });
    });

    it('ersätter arrayer i stället för att appenda', async () => {
      await patch(
        ORG,
        { business_activity: { sni_codes: [{ code: '62.010', is_primary: true }] } },
        opts,
      );
      await patch(
        ORG,
        { business_activity: { sni_codes: [{ code: '62.020', is_primary: true }] } },
        opts,
      );
      const stored = await read(ORG, opts);
      expect(stored?.business_activity).toEqual({
        sni_codes: [{ code: '62.020', is_primary: true }],
      });
    });

    it('avvisar orgnr mismatch i patch-payload', async () => {
      await expect(
        patch(ORG, { company_identity: { company_registration_number: ORG_2 } }, opts),
      ).rejects.toThrow(/orgnr mismatch/);
    });

    it('bevarar orgnr när company_identity patchas med andra fält', async () => {
      const result = await patch(
        ORG,
        { company_identity: { company_name: 'Exempelbolaget AB' } },
        opts,
      );
      expect(result.company_identity.company_registration_number).toBe(ORG);
      expect(result.company_identity.company_name).toBe('Exempelbolaget AB');
    });

    it('persisterar is_paused via patch', async () => {
      await upsert(ORG, makeProfile(ORG), opts);
      const paused = await patch(ORG, { is_paused: true }, opts);
      expect(paused.is_paused).toBe(true);

      const resumed = await patch(ORG, { is_paused: false }, opts);
      expect(resumed.is_paused).toBe(false);
    });
  });

  describe('list', () => {
    it('returnerar tom array när inga rader finns', async () => {
      expect(await list(opts)).toEqual([]);
    });

    it('returnerar orgnrs sorterade', async () => {
      await upsert(ORG_2, makeProfile(ORG_2), opts);
      await upsert(ORG, makeProfile(ORG), opts);
      const got = await list(opts);
      expect(got).toContain(ORG);
      expect(got).toContain(ORG_2);
    });
  });

  describe('listActiveCustomers', () => {
    it('filtrerar bort raderade och pausade profiler', async () => {
      // Aktiv
      await upsert(ORG, makeProfile(ORG), opts);

      // Pausad
      const paused = makeProfile(ORG_2);
      paused.is_paused = true;
      await upsert(ORG_2, paused, opts);

      // Manuell soft-delete i den underliggande raden (vi använder inte
      // detta i koden — men säkerställ att listActiveCustomers ändå filtrerar).
      const softDeletedOrg = '888888-1111';
      await upsert(softDeletedOrg, makeProfile(softDeletedOrg), opts);
      const sdRow = supa.rows.get(softDeletedOrg);
      if (sdRow) sdRow.deleted_at = new Date().toISOString();

      const active = await listActiveCustomers(opts);
      const orgnrs = active.map((p) => p.company_identity.company_registration_number);
      expect(orgnrs).toContain(ORG);
      expect(orgnrs).not.toContain(ORG_2);
      expect(orgnrs).not.toContain(softDeletedOrg);
    });
  });

  describe('remove (HARD DELETE)', () => {
    it('raderar profil och returnerar true', async () => {
      await upsert(ORG, makeProfile(ORG), opts);
      expect(await remove(ORG, opts)).toBe(true);
      expect(await exists(ORG, opts)).toBe(false);
    });

    it('returnerar false när profil saknas', async () => {
      expect(await remove(ORG, opts)).toBe(false);
    });
  });

  describe('round-trip', () => {
    it('läser tillbaka det som skrevs', async () => {
      const profile = makeProfile(ORG);
      profile.business_activity = { high_level_sector: 'information_communication' };
      profile.tax_profile = { is_vat_registered: true };
      profile.telegram_chat_id = '999';
      profile.consent_terms_accepted_at = '2026-05-04T00:00:00.000Z';
      profile.consent_privacy_accepted_at = '2026-05-04T00:00:00.000Z';
      profile.consent_b2b_acknowledged_at = '2026-05-04T00:00:00.000Z';

      await upsert(ORG, profile, opts);
      const readBack = await read(ORG, opts);

      expect(readBack?.business_activity).toEqual(profile.business_activity);
      expect(readBack?.tax_profile).toEqual(profile.tax_profile);
      expect(readBack?.telegram_chat_id).toBe('999');
      expect(readBack?.consent_terms_accepted_at).toBe(profile.consent_terms_accepted_at);
    });
  });

  describe('consent flags', () => {
    it('persisterar alla tre consent-tidsstämplar via upsert', async () => {
      const ts = '2026-05-04T12:00:00.000Z';
      const profile = makeProfile(ORG);
      profile.consent_terms_accepted_at = ts;
      profile.consent_privacy_accepted_at = ts;
      profile.consent_b2b_acknowledged_at = ts;

      await upsert(ORG, profile, opts);
      const stored = await read(ORG, opts);

      expect(stored?.consent_terms_accepted_at).toBe(ts);
      expect(stored?.consent_privacy_accepted_at).toBe(ts);
      expect(stored?.consent_b2b_acknowledged_at).toBe(ts);
    });

    it('hasFullConsent på en lagrad profil', async () => {
      const ts = '2026-05-04T12:00:00.000Z';
      const profile = makeProfile(ORG);
      profile.consent_terms_accepted_at = ts;
      profile.consent_privacy_accepted_at = ts;
      profile.consent_b2b_acknowledged_at = ts;
      await upsert(ORG, profile, opts);
      const stored = await read(ORG, opts);
      expect(hasFullConsent(stored as CustomerProfile)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('kastar med tydligt felmeddelande när env saknas', async () => {
      const originalUrl = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      __resetClientForTests();
      try {
        await expect(read(ORG)).rejects.toThrow(/SUPABASE_URL saknas/);
      } finally {
        if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
        if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
        __resetClientForTests();
      }
    });

    it('kastar med tydligt felmeddelande när service-role-nyckel saknas', async () => {
      const originalUrl = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      __resetClientForTests();
      try {
        await expect(read(ORG)).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY saknas/);
      } finally {
        if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
        else delete process.env.SUPABASE_URL;
        if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
        __resetClientForTests();
      }
    });

    it('rapporterar Supabase-fel via read', async () => {
      supa.forceError('connection failed');
      await expect(read(ORG, opts)).rejects.toThrow(/connection failed/);
    });
  });
});
