import type { CustomerProfile } from '../../watcher/customer-profile/types.js';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import type { Severity } from '../schema/classification.js';
import { IRRELEVANT_TAG, type Tag } from './categories.js';
import { hasActionKeyword } from './event-tagger.js';

type CustomerFlags = {
  is_vat_registered: boolean;
  is_employer_registered: boolean;
  has_employees: boolean;
  has_owner_salary: boolean;
  is_audit_required: boolean;
  publishes_annual_report: boolean;
  has_excise_tax: boolean;
  processes_personal_data: boolean;
};

function readBool(section: Record<string, unknown> | undefined, key: string): boolean {
  return section?.[key] === true;
}

function readNumber(section: Record<string, unknown> | undefined, key: string): number {
  const v = section?.[key];
  return typeof v === 'number' ? v : 0;
}

function readArray(section: Record<string, unknown> | undefined, key: string): unknown[] {
  const v = section?.[key];
  return Array.isArray(v) ? v : [];
}

export function extractFlags(profile: CustomerProfile): CustomerFlags {
  const tax = profile.tax_profile;
  const employment = profile.employment_profile;
  const accounting = profile.accounting_reporting_profile;
  const governance = profile.governance_profile;
  const gdpr = profile.gdpr_profile;

  return {
    is_vat_registered: readBool(tax, 'is_vat_registered'),
    is_employer_registered: readBool(tax, 'is_employer_registered'),
    has_employees:
      readNumber(employment, 'employee_count') > 0 ||
      readNumber(accounting, 'avg_employees_year_1') > 0,
    has_owner_salary: readBool(tax, 'pays_salary_to_owner'),
    is_audit_required: readBool(governance, 'is_audit_required'),
    publishes_annual_report: readBool(accounting, 'publishes_annual_report'),
    has_excise_tax: readArray(tax, 'excise_tax_categories').length > 0,
    processes_personal_data: readBool(gdpr, 'processes_personal_data'),
  };
}

const TAG_RULES: ReadonlyArray<{
  tag: Tag;
  rule: string;
  matches: (flags: CustomerFlags) => boolean;
}> = [
  {
    tag: 'moms',
    rule: 'tax_profile.is_vat_registered',
    matches: (f) => f.is_vat_registered,
  },
  {
    tag: 'arbetsgivare',
    rule: 'tax_profile.is_employer_registered OR employment.employee_count>0',
    matches: (f) => f.is_employer_registered || f.has_employees,
  },
  {
    tag: 'ag-avgifter',
    rule: 'tax_profile.is_employer_registered OR pays_salary_to_owner',
    matches: (f) => f.is_employer_registered || f.has_owner_salary,
  },
  {
    tag: 'anstallning',
    rule: 'employment.employee_count>0',
    matches: (f) => f.has_employees,
  },
  {
    tag: 'arbetsmiljo',
    rule: 'employment.employee_count>0',
    matches: (f) => f.has_employees,
  },
  {
    tag: 'k10',
    rule: 'tax_profile.pays_salary_to_owner',
    matches: (f) => f.has_owner_salary,
  },
  {
    tag: 'bolagsskatt',
    rule: 'always (every AB pays bolagsskatt)',
    matches: () => true,
  },
  {
    tag: 'arsredovisning',
    rule: 'always (every AB files annual report)',
    matches: () => true,
  },
  {
    tag: 'revisionsplikt',
    rule: 'governance.is_audit_required',
    matches: (f) => f.is_audit_required,
  },
  {
    tag: 'gdpr',
    rule: 'gdpr.processes_personal_data',
    matches: (f) => f.processes_personal_data,
  },
  {
    tag: 'punktskatt',
    rule: 'tax_profile.excise_tax_categories not empty',
    matches: (f) => f.has_excise_tax,
  },
];

export type CustomerMatchResult = {
  relevant: boolean;
  severity: Severity;
  matched_rules: string[];
  summary: string;
};

export function matchCustomer(
  event: WatcherEvent,
  tags: Tag[],
  profile: CustomerProfile,
): CustomerMatchResult {
  const flags = extractFlags(profile);
  const tagSet = new Set(tags);
  const onlyUnknown = tags.length === 1 && tags[0] === 'okand';
  const onlyIrrelevant = tags.length === 1 && tags[0] === IRRELEVANT_TAG;

  // If event has positive categories AND irrelevant_for_ab, ignore the irrelevant tag.
  if (tagSet.has(IRRELEVANT_TAG) && tagSet.size > 1) {
    tagSet.delete(IRRELEVANT_TAG);
  }

  const matched: { tag: Tag; rule: string }[] = [];
  if (!onlyUnknown && !onlyIrrelevant) {
    for (const entry of TAG_RULES) {
      if (tagSet.has(entry.tag) && entry.matches(flags)) {
        matched.push({ tag: entry.tag, rule: `${entry.tag}: ${entry.rule}` });
      }
    }
  }

  const relevant = matched.length > 0;
  const severity: Severity = !relevant
    ? 'info'
    : hasActionKeyword(event)
      ? 'action_required'
      : 'info';

  const matched_rules = onlyIrrelevant
    ? [IRRELEVANT_TAG]
    : matched.map((m) => m.rule);

  const summary = relevant
    ? `Berör ${matched.map((m) => m.tag).join(', ')} — ${event.title}`.slice(0, 240)
    : onlyUnknown
      ? `Okänd kategori, kräver granskning — ${event.title}`.slice(0, 240)
      : onlyIrrelevant
        ? `Berör inte aktiebolag — ${event.title}`.slice(0, 240)
        : `Ej relevant för kundprofil — ${event.title}`.slice(0, 240);

  return {
    relevant,
    severity,
    matched_rules,
    summary,
  };
}
