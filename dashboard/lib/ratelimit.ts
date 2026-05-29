/**
 * Upstash-baserad rate-limit-factory för dashboard-API:er.
 *
 * Pre-alfa-säkerhetshärdning: /api/onboard hade noll skydd mot
 * spam/enumeration. Med en sliding window 3 req per IP per 24h tar vi
 * bort den enklaste DoS-vektorn utan att blockera riktiga användare —
 * en operatör onboardar typiskt en gång, inte tre, från samma IP.
 *
 * Mönster lånat från root api/verify.ts (samma idiomatiska Upstash-
 * setup, samma env-vars). Lazy singleton: instantierar inte klienten
 * vid module-load, bara vid första anropet — viktigt för att Next.js
 * build-tiden inte ska krascha utan env-vars.
 *
 * Saknas UPSTASH_REDIS_REST_URL eller UPSTASH_REDIS_REST_TOKEN i envet
 * faller vi tillbaks på en no-op-limiter som alltid släpper igenom.
 * Det förhindrar att lokal utveckling och Vercel preview-deploys
 * (utan Upstash-binding) kraschar — men i produktion ska båda env-vars
 * vara satta och då aktiveras den riktiga limiten.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export type LimiterLike = {
  limit: (identifier: string) => Promise<LimitResult>;
};

const ONBOARD_PREFIX = 'kammaren:rl:onboard';
const ONBOARD_REQUESTS = 3;
const ONBOARD_WINDOW = '24 h';

let onboardLimiter: LimiterLike | null = null;
let warned = false;

function makeNoopLimiter(): LimiterLike {
  return {
    limit: async (): Promise<LimitResult> => ({
      success: true,
      limit: ONBOARD_REQUESTS,
      remaining: ONBOARD_REQUESTS,
      reset: Date.now() + 24 * 60 * 60 * 1000,
    }),
  };
}

function hasUpstashEnv(): boolean {
  return (
    typeof process.env.UPSTASH_REDIS_REST_URL === 'string' &&
    process.env.UPSTASH_REDIS_REST_URL.length > 0 &&
    typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string' &&
    process.env.UPSTASH_REDIS_REST_TOKEN.length > 0
  );
}

/**
 * Returnerar (och cachar) en sliding-window-limiter på 3 onboardings
 * per IP per 24h. Använd från /api/onboard innan validering. Lazy så
 * att modulen kan importeras under build utan Upstash-env.
 */
export function getOnboardRatelimiter(): LimiterLike {
  if (onboardLimiter) return onboardLimiter;

  if (!hasUpstashEnv()) {
    if (!warned) {
      console.warn(
        '[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN saknas — ' +
          '/api/onboard körs UTAN rate-limit. Sätt env-vars i Vercel innan första ' +
          'riktiga onboarding.',
      );
      warned = true;
    }
    onboardLimiter = makeNoopLimiter();
    return onboardLimiter;
  }

  const redis = Redis.fromEnv();
  onboardLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(ONBOARD_REQUESTS, ONBOARD_WINDOW),
    analytics: false,
    prefix: ONBOARD_PREFIX,
  });
  return onboardLimiter;
}

/**
 * Test-helper: rensa cachen mellan test-fall + injicera fake-limiter.
 * Får aldrig kallas från app-kod.
 */
export function __setOnboardRatelimiterForTests(limiter: LimiterLike | null): void {
  onboardLimiter = limiter;
  warned = false;
}

/**
 * Extrahera klient-IP från request-headers. Vercel sätter
 * `x-forwarded-for`; bakom andra reverse-proxy kan `x-real-ip` finnas.
 * Faller tillbaks på "unknown" så vi alltid får en deterministisk nyckel
 * (en hel IP-pool grupperas då tillsammans — fortfarande en spärr).
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first && first.length > 0) return first;
  }
  const real = headers.get('x-real-ip');
  if (real && real.length > 0) return real;
  return 'unknown';
}
