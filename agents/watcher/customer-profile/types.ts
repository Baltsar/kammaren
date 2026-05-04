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
  meta?: Partial<ProfileMeta>;
};

export const SCHEMA_VERSION = '1.0.0';
