import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __setOnboardRatelimiterForTests,
  getClientIp,
  getOnboardRatelimiter,
  type LimiterLike,
} from './ratelimit';

describe('ratelimit / getClientIp', () => {
  it('prefers first IP in x-forwarded-for', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.5, 198.51.100.1',
    });
    expect(getClientIp(headers)).toBe('203.0.113.5');
  });

  it('trims whitespace from x-forwarded-for parts', () => {
    const headers = new Headers({
      'x-forwarded-for': '  203.0.113.42  , 198.51.100.7',
    });
    expect(getClientIp(headers)).toBe('203.0.113.42');
  });

  it('falls back to x-real-ip when x-forwarded-for missing', () => {
    const headers = new Headers({ 'x-real-ip': '203.0.113.99' });
    expect(getClientIp(headers)).toBe('203.0.113.99');
  });

  it('returns "unknown" when no IP headers are present', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});

describe('ratelimit / no-op fallback', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    }
    if (originalToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    }
    __setOnboardRatelimiterForTests(null);
    vi.restoreAllMocks();
  });

  it('returnerar en no-op-limiter när Upstash env-vars saknas och loggar warning', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __setOnboardRatelimiterForTests(null);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const limiter = getOnboardRatelimiter();
    const result = await limiter.limit('onboard:203.0.113.5');

    expect(result.success).toBe(true);
    expect(result.limit).toBe(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('UPSTASH_REDIS_REST_URL'));
  });

  it('cachar limitern över flera anrop (lazy singleton)', () => {
    __setOnboardRatelimiterForTests(null);
    const first = getOnboardRatelimiter();
    const second = getOnboardRatelimiter();
    expect(first).toBe(second);
  });
});

describe('ratelimit / injected fake limiter (route-policy contract)', () => {
  afterEach(() => {
    __setOnboardRatelimiterForTests(null);
  });

  it('en injicerad limiter kontrollerar success/limit/remaining/reset', async () => {
    let calls = 0;
    const fake: LimiterLike = {
      limit: vi.fn(async (key: string) => {
        calls += 1;
        return {
          success: calls <= 3,
          limit: 3,
          remaining: Math.max(0, 3 - calls),
          reset: Date.now() + 60_000,
        };
      }),
    };
    __setOnboardRatelimiterForTests(fake);

    const limiter = getOnboardRatelimiter();
    expect(limiter).toBe(fake);

    const r1 = await limiter.limit('onboard:1.2.3.4');
    const r2 = await limiter.limit('onboard:1.2.3.4');
    const r3 = await limiter.limit('onboard:1.2.3.4');
    const r4 = await limiter.limit('onboard:1.2.3.4');

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(fake.limit).toHaveBeenCalledTimes(4);
  });
});
