import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeFakeSupabase } from './fake-supabase.js';
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

    it('returnerar orgnrs', async () => {
      await upsert(ORG_2, makeProfile(ORG_2), opts);
      await upsert(ORG, makeProfile(ORG), opts);
      const got = await list(opts);
      expect(got).toContain(ORG);
      expect(got).toContain(ORG_2);
    });
  });

  describe('listActiveCustomers', () => {
    it('filtrerar bort raderade och pausade profiler', async () => {
      await upsert(ORG, makeProfile(ORG), opts);

      const paused = makeProfile(ORG_2);
      paused.is_paused = true;
      await upsert(ORG_2, paused, opts);

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
  });
});
