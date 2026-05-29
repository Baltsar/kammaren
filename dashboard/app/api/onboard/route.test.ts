/**
 * Route-test för /api/onboard.
 *
 * Fokus: rate-limit-mekaniken (429 + Retry-After-header). Storage- och
 * Telegram-anrop mockas — vi testar inte happy-path-formatet här, det
 * är validation.ts + luhn.ts som täcker den ytan.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setOnboardRatelimiterForTests,
  type LimiterLike,
} from '../../../lib/ratelimit';

// Mocka storage + telegram så vi inte rör Supabase / Telegram-API:et.
// OBS: route.ts importerar via @/lib/... men vitest matchar moduler på
// både alias och relativ path eftersom mock-key:n följer den faktiska
// import-strängen från konsumenten. Vi mockar därför båda formerna.
vi.mock('@/lib/storage', () => ({
  buildProfilePayload: vi.fn((input: { orgnr: string; telegram_chat_id: string }) => ({
    company_identity: { company_registration_number: input.orgnr },
    telegram_chat_id: input.telegram_chat_id,
  })),
  commitProfile: vi.fn(async () => ({ status: 'created' as const })),
}));

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: vi.fn(async () => ({ ok: true, message_id: 1 })),
  WELCOME_MESSAGE: 'välkomst',
}));

const VALID_BODY = {
  email: 'test@example.com',
  telegram_chat_id: '123456789',
  // Giltig orgnr (5566778899 har 55XXXX-prefix för AB, valid Luhn)
  orgnr: '556677-8899',
  company_name: 'Testbolaget AB',
  business_profile: {
    is_vat_registered: true,
    is_employer_registered: false,
    processes_personal_data: false,
    has_more_than_3_employees: false,
    revenue_over_40msek: false,
    pays_salary_to_owner: false,
    publishes_annual_report: true,
  },
  consent: { terms: true, privacy: true, b2b: true },
};

function makeRequest(body: unknown, ip = '203.0.113.5'): Request {
  return new Request('http://localhost/api/onboard', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('/api/onboard rate-limit', () => {
  beforeEach(() => {
    // Default: token saknas → välkomst-notisen skippas (vi vill inte
    // röra Telegram-mocken i fail-fast-testen).
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  afterEach(() => {
    __setOnboardRatelimiterForTests(null);
    vi.clearAllMocks();
  });

  it('returnerar 429 + Retry-After-header när limitern säger nej', async () => {
    const reset = Date.now() + 30_000;
    const fake: LimiterLike = {
      limit: vi.fn(async () => ({
        success: false,
        limit: 3,
        remaining: 0,
        reset,
      })),
    };
    __setOnboardRatelimiterForTests(fake);

    // Dynamisk import efter att mocken är på plats.
    const { POST } = await import('./route');
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');

    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toContain('För många');

    // Limitern ska ha sett identifier:n med onboard:-prefix.
    expect(fake.limit).toHaveBeenCalledWith(expect.stringContaining('onboard:'));
  });

  it('släpper igenom 201 när limitern säger ja (fresh IP)', async () => {
    const fake: LimiterLike = {
      limit: vi.fn(async () => ({
        success: true,
        limit: 3,
        remaining: 2,
        reset: Date.now() + 60_000,
      })),
    };
    __setOnboardRatelimiterForTests(fake);

    const { POST } = await import('./route');
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(201);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('rate-limit kollas FÖRE JSON-parsing — skickar 429 även med trasig body', async () => {
    const fake: LimiterLike = {
      limit: vi.fn(async () => ({
        success: false,
        limit: 3,
        remaining: 0,
        reset: Date.now() + 10_000,
      })),
    };
    __setOnboardRatelimiterForTests(fake);

    const { POST } = await import('./route');
    const bad = new Request('http://localhost/api/onboard', {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.1' },
      body: 'not-json',
    });

    const res = await POST(bad);
    expect(res.status).toBe(429); // inte 400 — limit har företräde
  });

  it('Retry-After är minst 1 sekund även när reset redan passerat', async () => {
    const fake: LimiterLike = {
      limit: vi.fn(async () => ({
        success: false,
        limit: 3,
        remaining: 0,
        reset: Date.now() - 1000, // redan utgånget
      })),
    };
    __setOnboardRatelimiterForTests(fake);

    const { POST } = await import('./route');
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });
});
