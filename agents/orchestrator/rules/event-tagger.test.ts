import { describe, expect, it } from 'vitest';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import type { CustomerProfile } from '../../watcher/customer-profile/types.js';
import { SCHEMA_VERSION } from '../../watcher/customer-profile/types.js';
import { tagEvent } from './event-tagger.js';
import { matchCustomer } from './customer-matcher.js';

function makeEvent(title: string, summary = ''): WatcherEvent {
  return {
    id: 'test-' + Buffer.from(title).toString('hex').slice(0, 8),
    source: 'riksdagen',
    type: 'sfs',
    title,
    url: 'https://example.test/',
    published_at: '2026-05-01T00:00:00.000Z',
    raw: { summary },
    fetched_at: '2026-05-01T00:00:00.000Z',
  };
}

function makeProfile(overrides: {
  is_vat_registered?: boolean;
  is_employer_registered?: boolean;
  has_employees?: number;
  pays_salary_to_owner?: boolean;
  processes_personal_data?: boolean;
}): CustomerProfile {
  return {
    company_identity: {
      company_registration_number:
        '556677-8899' as CustomerProfile['company_identity']['company_registration_number'],
    },
    business_activity: {},
    tax_profile: {
      is_vat_registered: overrides.is_vat_registered ?? false,
      is_employer_registered: overrides.is_employer_registered ?? false,
      pays_salary_to_owner: overrides.pays_salary_to_owner ?? false,
      excise_tax_categories: [],
    },
    accounting_reporting_profile: {},
    governance_profile: { is_audit_required: false },
    employment_profile: { employee_count: overrides.has_employees ?? 0 },
    gdpr_profile: { processes_personal_data: overrides.processes_personal_data ?? false },
    workplace_safety_profile: {},
    cyber_nis2_profile: {},
    meta: { schema_version: SCHEMA_VERSION },
  };
}

describe('event-tagger — broadened SFS keywords', () => {
  it('tags Vapenförordning as irrelevant_for_ab', () => {
    const tags = tagEvent(makeEvent('Vapenförordning (2026:409)'));
    expect(tags).toContain('irrelevant_for_ab');
    expect(tags).not.toContain('okand');
  });

  it('tags Vapenlag as irrelevant_for_ab', () => {
    const tags = tagEvent(makeEvent('Vapenlag (2026:408)'));
    expect(tags).toContain('irrelevant_for_ab');
  });

  it('tags Inkomstskattelag as bolagsskatt', () => {
    const tags = tagEvent(makeEvent('Inkomstskattelag (2026:1234)'));
    expect(tags).toContain('bolagsskatt');
  });

  it('tags Mervärdesskattelag as moms', () => {
    const tags = tagEvent(makeEvent('Mervärdesskattelag (2026:42)'));
    expect(tags).toContain('moms');
  });

  it('tags Lag om anställningsskydd as anstallning', () => {
    const tags = tagEvent(makeEvent('Lag om anställningsskydd (2026:111)'));
    expect(tags).toContain('anstallning');
  });

  it('tags Arbetsmiljölag as arbetsmiljo', () => {
    const tags = tagEvent(makeEvent('Arbetsmiljölag (2026:200)'));
    expect(tags).toContain('arbetsmiljo');
  });

  it('tags Bokföringslag as arsredovisning', () => {
    const tags = tagEvent(makeEvent('Bokföringslag (2026:55)'));
    expect(tags).toContain('arsredovisning');
  });

  it('tags Dataskyddslag as gdpr', () => {
    const tags = tagEvent(makeEvent('Dataskyddslag (2026:99)'));
    expect(tags).toContain('gdpr');
  });
});

describe('customer-matcher — irrelevant_for_ab handling', () => {
  it('marks pure irrelevant_for_ab events as not relevant without entering okand-stack', () => {
    const event = makeEvent('Vapenförordning (2026:409)');
    const tags = tagEvent(event);
    const result = matchCustomer(event, tags, makeProfile({ is_vat_registered: true }));

    expect(result.relevant).toBe(false);
    expect(result.matched_rules).toEqual(['irrelevant_for_ab']);
    expect(result.summary).toContain('Berör inte aktiebolag');
  });

  it('keeps positive categories when event matches both irrelevant_for_ab and a positive category', () => {
    const event = makeEvent('Vapenlag (2026:408) — ändring i inkomstskattelag för vapenhandel');
    const tags = tagEvent(event);
    expect(tags).toContain('bolagsskatt');
    expect(tags).toContain('irrelevant_for_ab');

    const result = matchCustomer(event, tags, makeProfile({}));
    expect(result.relevant).toBe(true);
    expect(result.matched_rules.some((r) => r.startsWith('bolagsskatt:'))).toBe(true);
    expect(result.matched_rules).not.toContain('irrelevant_for_ab');
  });
});
