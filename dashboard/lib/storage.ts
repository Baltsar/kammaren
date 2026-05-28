/**
 * Storage-lager för dashboardens onboarding-flöde.
 *
 * Tidigare commitade vi en JSON-fil per kund till `vault/customers/`
 * via Octokit. Repot är publikt + AGPL-3.0 — så PII (telegram_chat_id,
 * orgnr, consent-stämplar) läckte ut på GitHub. Nu skriver vi i stället
 * en rad i `customer_profiles` på Supabase EU (Stockholm) bakom RLS
 * deny-all + service-role-bypass.
 *
 * commitProfile är en alias för upsertProfile som behåller den
 * tidigare exporten så `app/api/onboard/route.ts` inte behöver röras
 * mer än felmeddelandet.
 */

import { createServiceRoleClient } from './supabase';
import type { OnboardInput } from './validation';

export type CustomerProfileFile = {
  company_identity: {
    company_registration_number: string;
    company_name: string;
    contact_email?: string;
  };
  business_activity: Record<string, unknown>;
  tax_profile: Record<string, unknown>;
  accounting_reporting_profile: Record<string, unknown>;
  governance_profile: Record<string, unknown>;
  employment_profile: Record<string, unknown>;
  gdpr_profile: Record<string, unknown>;
  workplace_safety_profile: Record<string, unknown>;
  cyber_nis2_profile: Record<string, unknown>;
  telegram_chat_id: string;
  consent_terms_accepted_at: string;
  consent_privacy_accepted_at: string;
  consent_b2b_acknowledged_at: string;
  is_paused: boolean;
  meta: {
    schema_version: string;
    profile_last_updated_at: string;
  };
};

export const SCHEMA_VERSION = '1.2.0';
const TABLE = 'customer_profiles';

export function buildProfilePayload(
  input: OnboardInput,
  now: Date = new Date(),
): CustomerProfileFile {
  const ts = now.toISOString();
  return {
    company_identity: {
      company_registration_number: input.orgnr,
      company_name: input.company_name,
      contact_email: input.email,
    },
    business_activity: {},
    tax_profile: {
      is_vat_registered: input.business_profile.is_vat_registered,
      is_employer_registered: input.business_profile.is_employer_registered,
      pays_salary_to_owner: input.business_profile.pays_salary_to_owner,
    },
    accounting_reporting_profile: {
      publishes_annual_report: input.business_profile.publishes_annual_report,
      revenue_over_40msek: input.business_profile.revenue_over_40msek,
    },
    governance_profile: {
      is_audit_required: input.business_profile.has_more_than_3_employees,
    },
    employment_profile: {
      has_more_than_3_employees: input.business_profile.has_more_than_3_employees,
    },
    gdpr_profile: {
      processes_personal_data: input.business_profile.processes_personal_data,
    },
    workplace_safety_profile: {},
    cyber_nis2_profile: {},
    telegram_chat_id: input.telegram_chat_id,
    consent_terms_accepted_at: ts,
    consent_privacy_accepted_at: ts,
    consent_b2b_acknowledged_at: ts,
    is_paused: false,
    meta: {
      schema_version: SCHEMA_VERSION,
      profile_last_updated_at: ts,
    },
  };
}

export type CommitResult = {
  status: 'created' | 'already_exists';
  orgnr: string;
};

function profileToRow(profile: CustomerProfileFile): Record<string, unknown> {
  return {
    orgnr: profile.company_identity.company_registration_number,
    company_name: profile.company_identity.company_name,
    contact_email: profile.company_identity.contact_email ?? null,
    business_activity: profile.business_activity,
    tax_profile: profile.tax_profile,
    accounting_reporting_profile: profile.accounting_reporting_profile,
    governance_profile: profile.governance_profile,
    employment_profile: profile.employment_profile,
    gdpr_profile: profile.gdpr_profile,
    workplace_safety_profile: profile.workplace_safety_profile,
    cyber_nis2_profile: profile.cyber_nis2_profile,
    telegram_chat_id: profile.telegram_chat_id,
    consent_terms_accepted_at: profile.consent_terms_accepted_at,
    consent_privacy_accepted_at: profile.consent_privacy_accepted_at,
    consent_b2b_acknowledged_at: profile.consent_b2b_acknowledged_at,
    is_paused: profile.is_paused,
    schema_version: profile.meta.schema_version,
  };
}

export async function profileExists(orgnr: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('orgnr')
    .eq('orgnr', orgnr)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase profileExists(${orgnr}) misslyckades: ${error.message}`);
  }
  return data !== null;
}

export async function upsertProfile(
  profile: CustomerProfileFile,
): Promise<CommitResult> {
  const orgnr = profile.company_identity.company_registration_number;

  // Idempotens: om profil finns sedan tidigare, returnera utan att
  // skriva. Att reonboarda en befintlig kund kräver explicit /forget
  // först. Vi gör en explicit existens-koll i stället för upsert med
  // ignoreDuplicates eftersom vi behöver kunna returnera olika status
  // till klienten.
  if (await profileExists(orgnr)) {
    return { status: 'already_exists', orgnr };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).insert(profileToRow(profile));
  if (error) {
    throw new Error(`Supabase upsertProfile(${orgnr}) misslyckades: ${error.message}`);
  }
  return { status: 'created', orgnr };
}

/**
 * Backwards-compat alias så route.ts inte behöver bytas i samma commit.
 * Borttagen i framtida cleanup.
 */
export const commitProfile = upsertProfile;

export async function readProfileFromStore(
  orgnr: string,
): Promise<CustomerProfileFile | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('orgnr', orgnr)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase readProfile(${orgnr}) misslyckades: ${error.message}`);
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    company_identity: {
      company_registration_number: row.orgnr as string,
      company_name: (row.company_name as string) ?? '',
      contact_email: (row.contact_email as string | undefined) ?? undefined,
    },
    business_activity: (row.business_activity as Record<string, unknown>) ?? {},
    tax_profile: (row.tax_profile as Record<string, unknown>) ?? {},
    accounting_reporting_profile: (row.accounting_reporting_profile as Record<string, unknown>) ?? {},
    governance_profile: (row.governance_profile as Record<string, unknown>) ?? {},
    employment_profile: (row.employment_profile as Record<string, unknown>) ?? {},
    gdpr_profile: (row.gdpr_profile as Record<string, unknown>) ?? {},
    workplace_safety_profile: (row.workplace_safety_profile as Record<string, unknown>) ?? {},
    cyber_nis2_profile: (row.cyber_nis2_profile as Record<string, unknown>) ?? {},
    telegram_chat_id: (row.telegram_chat_id as string) ?? '',
    consent_terms_accepted_at: (row.consent_terms_accepted_at as string) ?? '',
    consent_privacy_accepted_at: (row.consent_privacy_accepted_at as string) ?? '',
    consent_b2b_acknowledged_at: (row.consent_b2b_acknowledged_at as string) ?? '',
    is_paused: (row.is_paused as boolean) ?? false,
    meta: {
      schema_version: (row.schema_version as string) ?? SCHEMA_VERSION,
      profile_last_updated_at: (row.updated_at as string) ?? new Date().toISOString(),
    },
  };
}

/**
 * Backwards-compat alias så `/api/profile/[orgnr]/route.ts` fortsätter fungera.
 */
export const readProfileFromGithub = readProfileFromStore;
