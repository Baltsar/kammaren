import { describe, expect, it } from 'vitest';
import type { CustomerProfile } from '../../watcher/customer-profile/types.js';
import {
  buildForgetCompletedMessage,
  buildForgetPromptMessage,
  buildHelpMessage,
  buildLegalMessage,
  buildNotRegisteredMessage,
  buildPauseMessage,
  buildResumeMessage,
  buildStartRegisteredMessage,
  buildStartUnregisteredMessage,
  buildStatusMessage,
  buildUnknownMessage,
  buildWelcomeAfterOnboardMessage,
  escapeHtml,
  formatTimeAgoSv,
} from './watcher-bot.lib.js';

const ORG = '556677-8899';

function makeProfile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    company_identity: {
      company_registration_number: ORG as CustomerProfile['company_identity']['company_registration_number'],
      company_name: 'Testbolaget AB',
    },
    business_activity: {},
    tax_profile: { is_vat_registered: true, is_employer_registered: false },
    accounting_reporting_profile: {},
    governance_profile: {},
    employment_profile: {},
    gdpr_profile: {},
    workplace_safety_profile: {},
    cyber_nis2_profile: {},
    telegram_chat_id: '999',
    consent_terms_accepted_at: '2026-05-04T00:00:00.000Z',
    consent_privacy_accepted_at: '2026-05-04T00:00:00.000Z',
    consent_b2b_acknowledged_at: '2026-05-04T00:00:00.000Z',
    meta: {
      schema_version: '1.2.0',
      profile_last_updated_at: '2026-05-04T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('watcher-bot.lib', () => {
  describe('escapeHtml', () => {
    it('escapes HTML entities', () => {
      expect(escapeHtml('<a&b>')).toBe('&lt;a&amp;b&gt;');
    });
  });

  describe('formatTimeAgoSv', () => {
    const now = new Date('2026-05-05T12:00:00.000Z');

    it('returns "just nu" for very recent times', () => {
      expect(formatTimeAgoSv(now, new Date('2026-05-05T11:59:50.000Z'))).toBe('just nu');
    });

    it('returns minutes', () => {
      expect(formatTimeAgoSv(now, new Date('2026-05-05T11:55:00.000Z'))).toBe('5 min sen');
    });

    it('returns singular hour', () => {
      expect(formatTimeAgoSv(now, new Date('2026-05-05T11:00:00.000Z'))).toBe('1 timme sen');
    });

    it('returns plural hours', () => {
      expect(formatTimeAgoSv(now, new Date('2026-05-05T05:00:00.000Z'))).toBe('7 timmar sen');
    });

    it('returns singular day', () => {
      expect(formatTimeAgoSv(now, new Date('2026-05-04T12:00:00.000Z'))).toBe('1 dag sen');
    });

    it('returns plural days', () => {
      expect(formatTimeAgoSv(now, new Date('2026-05-02T12:00:00.000Z'))).toBe('3 dagar sen');
    });

    it('returns months', () => {
      expect(formatTimeAgoSv(now, new Date('2026-02-05T12:00:00.000Z'))).toBe('2 månader sen');
    });

    it('handles future dates as "just nu"', () => {
      expect(formatTimeAgoSv(now, new Date('2030-01-01T00:00:00.000Z'))).toBe('just nu');
    });
  });

  describe('buildHelpMessage', () => {
    it('lists all commands and support email', () => {
      const msg = buildHelpMessage();
      expect(msg).toContain('/start');
      expect(msg).toContain('/status');
      expect(msg).toContain('/pause');
      expect(msg).toContain('/resume');
      expect(msg).toContain('/legal');
      expect(msg).toContain('/forget');
      expect(msg).toContain('info@kammaren.nu');
    });
  });

  describe('buildStartUnregisteredMessage', () => {
    it('includes chat_id and onboarding URL', () => {
      const msg = buildStartUnregisteredMessage('123456');
      expect(msg).toContain('<code>123456</code>');
      expect(msg).toContain('kammaren.nu/watcher/start');
    });
  });

  describe('buildStartRegisteredMessage', () => {
    it('shows registered date and prompts /status', () => {
      const msg = buildStartRegisteredMessage(makeProfile());
      expect(msg).toContain('redan registrerad');
      expect(msg).toContain('2026-05-04');
      expect(msg).toContain('/status');
    });
  });

  describe('buildStatusMessage', () => {
    const now = new Date('2026-05-05T12:00:00.000Z');

    it('renders profile fields and last delivery', () => {
      const msg = buildStatusMessage({
        profile: makeProfile(),
        deliveryCount: 7,
        lastDeliveryAt: new Date('2026-05-04T12:00:00.000Z'),
        now,
      });
      expect(msg).toContain('Testbolaget AB');
      expect(msg).toContain('556677-8899');
      expect(msg).toContain('Momsregistrerad: ja');
      expect(msg).toContain('Arbetsgivare: nej');
      expect(msg).toContain('Total levererade: 7');
      expect(msg).toContain('1 dag sen');
    });

    it('shows "inga ännu" when no delivery yet', () => {
      const msg = buildStatusMessage({
        profile: makeProfile(),
        deliveryCount: 0,
        lastDeliveryAt: null,
        now,
      });
      expect(msg).toContain('Senaste notis: inga ännu');
      expect(msg).toContain('Total levererade: 0');
    });

    it('flags paused state', () => {
      const msg = buildStatusMessage({
        profile: makeProfile({ is_paused: true }),
        deliveryCount: 3,
        lastDeliveryAt: new Date('2026-05-04T12:00:00.000Z'),
        now,
      });
      expect(msg).toContain('Notiser pausade');
      expect(msg).toContain('/resume');
    });

    it('falls back to "(okänt)" for missing company_name', () => {
      const profile = makeProfile();
      delete (profile.company_identity as Record<string, unknown>).company_name;
      const msg = buildStatusMessage({
        profile,
        deliveryCount: 0,
        lastDeliveryAt: null,
        now,
      });
      expect(msg).toContain('Bolag: (okänt)');
    });
  });

  describe('buildPauseMessage / buildResumeMessage', () => {
    it('differentiates first-time pause from already-paused', () => {
      expect(buildPauseMessage(false)).toContain('Notiser pausade');
      expect(buildPauseMessage(true)).toContain('redan pausade');
    });

    it('differentiates first-time resume from already-active', () => {
      expect(buildResumeMessage(false)).toContain('återupptagna');
      expect(buildResumeMessage(true)).toContain('redan aktiva');
    });
  });

  describe('buildLegalMessage', () => {
    it('links to TERMS, PRIVACY, source, and B2B disclaimer', () => {
      const msg = buildLegalMessage();
      expect(msg).toContain('kammaren.nu/watcher/terms');
      expect(msg).toContain('kammaren.nu/watcher/privacy');
      expect(msg).toContain('github.com/Baltsar/kammaren');
      expect(msg).toContain('aktiebolag i näringsverksamhet');
      expect(msg).toContain('Ej rådgivning');
    });
  });

  describe('buildForgetPromptMessage', () => {
    it('includes orgnr and confirm token', () => {
      const msg = buildForgetPromptMessage(ORG);
      expect(msg).toContain(ORG);
      expect(msg).toContain('RADERA');
      expect(msg).toContain('oåterkalleligt');
    });
  });

  describe('buildForgetCompletedMessage', () => {
    it('confirms deletion', () => {
      expect(buildForgetCompletedMessage()).toContain('Raderad');
    });
  });

  describe('buildNotRegisteredMessage', () => {
    it('points unregistered users back to onboarding', () => {
      const msg = buildNotRegisteredMessage();
      expect(msg).toContain('inte registrerad');
      expect(msg).toContain('kammaren.nu/watcher/start');
    });
  });

  describe('buildUnknownMessage', () => {
    it('hints at /help', () => {
      expect(buildUnknownMessage()).toContain('/help');
    });
  });

  describe('buildWelcomeAfterOnboardMessage', () => {
    it('mentions /help and Stockholm cron-tid', () => {
      const msg = buildWelcomeAfterOnboardMessage();
      expect(msg).toContain('Onboarding klar');
      expect(msg).toContain('06:00');
      expect(msg).toContain('/help');
    });
  });
});
