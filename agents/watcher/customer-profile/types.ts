export const ORG_NUMBER_PATTERN = /^\d{6}-\d{4}$/;

export type OrgNumber = string & { readonly __brand: 'OrgNumber' };

export function isOrgNumber(value: string): value is OrgNumber {
  return ORG_NUMBER_PATTERN.test(value);
}

export function assertOrgNumber(value: string): asserts value is OrgNumber {
  if (!ORG_NUMBER_PATTERN.test(value)) {
    throw new Error(
      `Invalid organisationsnummer: "${value}". Expected format XXXXXX-XXXX.`,
    );
  }
}

export type SourceConfidence =
  | 'verified_registry'
  | 'user_reported'
  | 'inferred'
  | 'mixed_verified_and_user_reported'
  | 'unknown';

export type CompanyIdentity = {
  company_registration_number: OrgNumber;
} & Record<string, unknown>;

export type ProfileMeta = {
  schema_version: string;
  profile_last_updated_at?: string;
  profile_completeness_pct?: number;
  source_confidence?: SourceConfidence;
  // Sätts av GDPR-CLI:s `delete`-subkommando. Profil-filen behålls
  // (för append-only-loggar att referera till) men identitets-fält
  // nullas och delivery-pipen skip:ar via consent-gaten.
  deleted_at?: string;
};

export type CustomerProfile = {
  company_identity: CompanyIdentity;
  business_activity: Record<string, unknown>;
  tax_profile: Record<string, unknown>;
  accounting_reporting_profile: Record<string, unknown>;
  governance_profile: Record<string, unknown>;
  employment_profile: Record<string, unknown>;
  gdpr_profile: Record<string, unknown>;
  workplace_safety_profile: Record<string, unknown>;
  cyber_nis2_profile: Record<string, unknown>;
  // Telegram-mottagare för leveranser. null/undefined = mottagaren har
  // inte bundit sin bot ännu, leverans hoppas över. Hanteras top-level
  // tills vi har fler kanaler (e-post, SMS) — då bryter vi ut.
  // Optional för bakåtkompat med befintliga profil-filer som saknar
  // fältet; delivery-pipen behandlar undefined och null lika.
  telegram_chat_id?: string | null;
  // Tre samtycken som måste vara satta innan delivery levererar något:
  // TERMS, PRIVACY och B2B-positioneringen i TERMS § 9. Värdet är
  // ISO-8601-tidsstämpel när användaren bekräftade. null/undefined =
  // ej bekräftat → delivery skip:ar med "no consent"-log.
  consent_terms_accepted_at?: string | null;
  consent_privacy_accepted_at?: string | null;
  consent_b2b_acknowledged_at?: string | null;
  // Notis-paus styrd av användaren via /pause-kommandot. true = pausad,
  // false/undefined = aktiv. Optional för bakåtkompat med 1.1.0-filer.
  is_paused?: boolean;
  meta: ProfileMeta;
};

export type CustomerProfilePatch = {
  company_identity?: Partial<CompanyIdentity> & Record<string, unknown>;
  business_activity?: Record<string, unknown>;
  tax_profile?: Record<string, unknown>;
  accounting_reporting_profile?: Record<string, unknown>;
  governance_profile?: Record<string, unknown>;
  employment_profile?: Record<string, unknown>;
  gdpr_profile?: Record<string, unknown>;
  workplace_safety_profile?: Record<string, unknown>;
  cyber_nis2_profile?: Record<string, unknown>;
  telegram_chat_id?: string | null;
  consent_terms_accepted_at?: string | null;
  consent_privacy_accepted_at?: string | null;
  consent_b2b_acknowledged_at?: string | null;
  is_paused?: boolean;
  meta?: Partial<ProfileMeta>;
};

/**
 * Returnerar true om alla tre consent-fält har en icke-tom ISO-tidsstämpel.
 * Delivery-pipen anropar denna före varje leverans — saknas något fält
 * loggar vi "no consent" och hoppar över notisen.
 */
export function hasFullConsent(profile: CustomerProfile): boolean {
  return (
    typeof profile.consent_terms_accepted_at === 'string' &&
    profile.consent_terms_accepted_at.length > 0 &&
    typeof profile.consent_privacy_accepted_at === 'string' &&
    profile.consent_privacy_accepted_at.length > 0 &&
    typeof profile.consent_b2b_acknowledged_at === 'string' &&
    profile.consent_b2b_acknowledged_at.length > 0
  );
}

export const SCHEMA_VERSION = '1.2.0';
