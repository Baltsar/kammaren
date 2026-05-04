import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exists, list, patch, read, remove, upsert } from './store.js';
import type { CustomerProfile } from './types.js';
import { SCHEMA_VERSION, hasFullConsent } from './types.js';

const ORG = '559123-4567';
const ORG_2 = '556677-8899';

function makeProfile(orgnr: string): CustomerProfile {
  return {
    company_identity: {
      company_registration_number: orgnr as CustomerProfile['company_identity']['company_registration_number'],
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

describe('customer-profile store', () => {
  let vaultDir: string;
  let opts: { vaultDir: string };

  beforeEach(async () => {
    vaultDir = await mkdtemp(join(tmpdir(), 'kammaren-vault-'));
    opts = { vaultDir };
  });

  afterEach(async () => {
    await rm(vaultDir, { recursive: true, force: true });
  });

  describe('orgnr validation', () => {
    it('rejects malformed orgnr', async () => {
      await expect(read('123', opts)).rejects.toThrow(/Invalid organisationsnummer/);
      await expect(exists('5591234567', opts)).rejects.toThrow(/Invalid organisationsnummer/);
      await expect(remove('abc-defg', opts)).rejects.toThrow(/Invalid organisationsnummer/);
    });

    it('accepts canonical XXXXXX-XXXX format', async () => {
      expect(await read(ORG, opts)).toBeNull();
      expect(await exists(ORG, opts)).toBe(false);
    });
  });

  describe('upsert', () => {
    it('creates new profile and stamps meta', async () => {
      const result = await upsert(ORG, makeProfile(ORG), opts);
      expect(result.meta.schema_version).toBe(SCHEMA_VERSION);
      expect(result.meta.profile_last_updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(await exists(ORG, opts)).toBe(true);
    });

    it('writes pretty-printed JSON to disk', async () => {
      await upsert(ORG, makeProfile(ORG), opts);
      const raw = await readFile(join(vaultDir, `${ORG}.json`), 'utf8');
      expect(raw).toContain('\n  "company_identity"');
      expect(raw.endsWith('\n')).toBe(true);
    });

    it('rejects orgnr/payload mismatch', async () => {
      await expect(upsert(ORG, makeProfile(ORG_2), opts)).rejects.toThrow(/orgnr mismatch/);
    });

    it('replaces existing profile fully', async () => {
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
    it('creates profile from empty when patching unknown orgnr', async () => {
      const result = await patch(ORG, { tax_profile: { is_vat_registered: true } }, opts);
      expect(result.company_identity.company_registration_number).toBe(ORG);
      expect(result.tax_profile).toEqual({ is_vat_registered: true });
      expect(result.meta.schema_version).toBe(SCHEMA_VERSION);
    });

    it('deep-merges nested objects', async () => {
      await upsert(ORG, makeProfile(ORG), opts);
      await patch(ORG, { tax_profile: { is_vat_registered: true } }, opts);
      await patch(ORG, { tax_profile: { vat_reporting_frequency: 'quarterly' } }, opts);

      const stored = await read(ORG, opts);
      expect(stored?.tax_profile).toEqual({
        is_vat_registered: true,
        vat_reporting_frequency: 'quarterly',
      });
    });

    it('replaces arrays rather than appending', async () => {
      await patch(ORG, { business_activity: { sni_codes: [{ code: '62.010', is_primary: true }] } }, opts);
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

    it('updates profile_last_updated_at on every patch', async () => {
      const first = await patch(ORG, { tax_profile: { is_vat_registered: true } }, opts);
      await new Promise((r) => setTimeout(r, 5));
      const second = await patch(ORG, { tax_profile: { is_vat_registered: false } }, opts);
      expect(second.meta.profile_last_updated_at).not.toBe(first.meta.profile_last_updated_at);
    });

    it('rejects orgnr mismatch in patch payload', async () => {
      await expect(
        patch(ORG, { company_identity: { company_registration_number: ORG_2 } }, opts),
      ).rejects.toThrow(/orgnr mismatch/);
    });

    it('preserves orgnr when patching company_identity with other fields', async () => {
      const result = await patch(
        ORG,
        { company_identity: { company_name: 'Exempelbolaget AB' } },
        opts,
      );
      expect(result.company_identity.company_registration_number).toBe(ORG);
      expect(result.company_identity.company_name).toBe('Exempelbolaget AB');
    });
  });

  describe('list', () => {
    it('returns empty array when vault dir missing', async () => {
      expect(await list({ vaultDir: join(vaultDir, 'nope') })).toEqual([]);
    });

    it('returns sorted orgnrs and ignores non-orgnr files', async () => {
      await upsert(ORG_2, makeProfile(ORG_2), opts);
      await upsert(ORG, makeProfile(ORG), opts);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(join(vaultDir, 'README.md'), 'noise', 'utf8');
      await writeFile(join(vaultDir, 'not-an-orgnr.json'), '{}', 'utf8');

      expect(await list(opts)).toEqual([ORG_2, ORG]);
    });
  });

  describe('remove', () => {
    it('deletes existing profile and returns true', async () => {
      await upsert(ORG, makeProfile(ORG), opts);
      expect(await remove(ORG, opts)).toBe(true);
      expect(await exists(ORG, opts)).toBe(false);
    });

    it('returns false when profile does not exist', async () => {
      expect(await remove(ORG, opts)).toBe(false);
    });
  });

  describe('round-trip', () => {
    it('reads back what was written', async () => {
      const profile = makeProfile(ORG);
      profile.business_activity = { high_level_sector: 'information_communication' };
      profile.tax_profile = { is_vat_registered: true };
      const written = await upsert(ORG, profile, opts);
      const readBack = await read(ORG, opts);
      expect(readBack).toEqual(written);
    });
  });

  describe('consent flags (legal-foundation)', () => {
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

    it('uppdaterar enbart valda consent-fält via patch', async () => {
      const ts = '2026-05-04T12:00:00.000Z';
      await upsert(ORG, makeProfile(ORG), opts);
      await patch(ORG, { consent_terms_accepted_at: ts }, opts);

      const stored = await read(ORG, opts);
      expect(stored?.consent_terms_accepted_at).toBe(ts);
      expect(stored?.consent_privacy_accepted_at).toBeUndefined();
      expect(stored?.consent_b2b_acknowledged_at).toBeUndefined();
    });

    it('hasFullConsent returnerar true endast när alla tre är satta', () => {
      const ts = '2026-05-04T12:00:00.000Z';
      const base = makeProfile(ORG);

      expect(hasFullConsent(base)).toBe(false);
      expect(
        hasFullConsent({ ...base, consent_terms_accepted_at: ts }),
      ).toBe(false);
      expect(
        hasFullConsent({
          ...base,
          consent_terms_accepted_at: ts,
          consent_privacy_accepted_at: ts,
        }),
      ).toBe(false);
      expect(
        hasFullConsent({
          ...base,
          consent_terms_accepted_at: ts,
          consent_privacy_accepted_at: ts,
          consent_b2b_acknowledged_at: ts,
        }),
      ).toBe(true);
    });

    it('hasFullConsent returnerar false om någon flagga är tom sträng eller null', () => {
      const ts = '2026-05-04T12:00:00.000Z';
      const base = makeProfile(ORG);

      expect(
        hasFullConsent({
          ...base,
          consent_terms_accepted_at: ts,
          consent_privacy_accepted_at: '',
          consent_b2b_acknowledged_at: ts,
        }),
      ).toBe(false);
      expect(
        hasFullConsent({
          ...base,
          consent_terms_accepted_at: ts,
          consent_privacy_accepted_at: null,
          consent_b2b_acknowledged_at: ts,
        }),
      ).toBe(false);
    });
  });
});
