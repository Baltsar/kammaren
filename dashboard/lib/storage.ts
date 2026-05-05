import { Octokit } from '@octokit/rest';
import type { OnboardInput } from './validation';

const GITHUB_OWNER = process.env.GITHUB_OWNER ?? 'Baltsar';
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'kammaren';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'main';

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
  sha?: string;
};

function getOctokit(): Octokit {
  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error('GITHUB_PAT saknas i env');
  return new Octokit({ auth: token });
}

function profilePath(orgnr: string): string {
  return `vault/customers/${orgnr}.json`;
}

export async function profileExistsOnGithub(orgnr: string): Promise<boolean> {
  const octokit = getOctokit();
  try {
    await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: GITHUB_BRANCH,
      path: profilePath(orgnr),
    });
    return true;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return false;
    throw err;
  }
}

export async function commitProfile(
  profile: CustomerProfileFile,
): Promise<CommitResult> {
  const octokit = getOctokit();
  const orgnr = profile.company_identity.company_registration_number;
  const path = profilePath(orgnr);

  // Idempotens: om filen redan finns, returnera utan att skriva. Att
  // reonboarda en befintlig kund kräver explicit /forget först.
  const exists = await profileExistsOnGithub(orgnr);
  if (exists) {
    return { status: 'already_exists', orgnr };
  }

  const content = Buffer.from(`${JSON.stringify(profile, null, 2)}\n`, 'utf8').toString(
    'base64',
  );

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    path,
    message: `watcher: onboard ${orgnr}`,
    content,
    committer: {
      name: 'KAMMAREN Watcher',
      email: 'info@kammaren.nu',
    },
    author: {
      name: 'KAMMAREN Watcher',
      email: 'info@kammaren.nu',
    },
  });

  return {
    status: 'created',
    orgnr,
    sha: data.commit.sha,
  };
}

export async function readProfileFromGithub(
  orgnr: string,
): Promise<CustomerProfileFile | null> {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: GITHUB_BRANCH,
      path: profilePath(orgnr),
    });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
      return null;
    }
    const decoded = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(decoded) as CustomerProfileFile;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}
