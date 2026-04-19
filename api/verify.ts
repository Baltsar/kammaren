/**
 * api/verify.ts — Verification-as-a-Service
 *
 * Tre lägen:
 *   GET  /api/verify          → LIST: tillgängliga skills + schemas
 *   POST /api/verify (+ expected) → VERIFY: PASS/FAIL + diff
 *   POST /api/verify (ingen expected) → CALCULATE: result + breakdown + sources
 *
 * KAMMAREN kör samma deterministiska motor som backas av 258 assertions.
 * Källkod: github.com/Baltsar/kammaren
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SkillInput, SkillOutput } from '../skills/types.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── Rate limiter (60 req/min per IP) ─────────────────────────────────────────
// Kräver UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN i Vercel env vars.
// I dev/preview/lokalt körs utan rate limit om envet saknas.
// I produktion (VERCEL_ENV === 'production') fail-closed: kasta vid module-
// load så Vercel surfar 500 istället för tyst släppa trafik förbi limiten.
// Skälet: PRIVACY.md utlovar rate-limiting (art. 6.1.f GDPR) — koden måste
// upprätthålla det löftet, inte bara referera till det.

const IS_PROD = process.env['VERCEL_ENV'] === 'production';
const HAS_UPSTASH =
  !!process.env['UPSTASH_REDIS_REST_URL'] &&
  !!process.env['UPSTASH_REDIS_REST_TOKEN'];

if (IS_PROD && !HAS_UPSTASH) {
  throw new Error(
    'Rate limiting krävs i produktion: sätt UPSTASH_REDIS_REST_URL och ' +
    'UPSTASH_REDIS_REST_TOKEN i Vercel env vars. PRIVACY.md utlovar ' +
    'rate-limiting — koden måste upprätthålla det löftet.',
  );
}

let ratelimit: Ratelimit | null = null;

if (HAS_UPSTASH) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: false,
    prefix: 'kammaren:rl',
  });
}

async function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse,
): Promise<boolean> {
  if (!ratelimit) return true; // ingen begränsning utan Redis

  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown';

  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);

  if (!success) {
    res.status(429).json({
      error: 'Too many requests',
      message: `Limit: ${limit} requests per minute. Retry-After: ${Math.ceil((reset - Date.now()) / 1000)}s`,
      retry_after_seconds: Math.ceil((reset - Date.now()) / 1000),
    });
    return false;
  }

  return true;
}

// ── CORS ──────────────────────────────────────────────────────────────────────

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Skill-register ────────────────────────────────────────────────────────────

const ALLOWED_SKILLS = ['ag-avgifter', 'moms', 'bolagsskatt', 'k10'] as const;
type SkillName = typeof ALLOWED_SKILLS[number];

// Skill metadata for GET /api/verify
const SKILL_METADATA: Record<SkillName, {
  description: string;
  input_fields: Record<string, string>;
  result_fields: Record<string, string>;
  source: string;
  assertions: string;
}> = {
  'ag-avgifter': {
    description: 'Arbetsgivaravgifter 2026 — SFL 2 kap 26–31 §§',
    input_fields: {
      gross_salary:   'number (required) — Årslön brutto SEK',
      birth_year:     'number (required) — Anställds födelseår, t.ex. 1985',
      first_employee: 'boolean (optional) — Växa-stödet: en av de två första anställda',
      num_employees:  'number (optional) — Antal anställda, avgör om Växa gäller',
    },
    result_fields: {
      total_ag:      'Total arbetsgivaravgift SEK',
      employer_cost: 'Total lönekostnad för arbetsgivaren (lön + avgift)',
      monthly_ag:    'Månadsavgift avrundad till närmaste krona',
    },
    source: 'SFL 2 kap 26 §',
    assertions: '19/19 PASS',
  },
  moms: {
    description: 'Moms 2026 — Mervärdesskattelagen (ML)',
    input_fields: {
      amount:         'number (required) — Beloppet SEK',
      vat_rate:       'number (required) — Momssats som heltal: 25, 12, 6 eller 0',
      direction:      'string (required) — "netto_to_brutto" eller "brutto_to_netto"',
      reverse_charge: 'boolean (optional) — Omvänd skattskyldighet ML 1 kap 2 §',
    },
    result_fields: {
      netto:                 'Nettobelopp SEK',
      moms:                  'Momsbelopp SEK',
      brutto:                'Bruttobelopp SEK',
      bas_konto_utgaende:    'BAS-konto för utgående moms',
      reverse_charge_vat:    'Momsbelopp vid omvänd skattskyldighet',
    },
    source: 'ML 7 kap 1–3 §§',
    assertions: '34/34 PASS',
  },
  bolagsskatt: {
    description: 'Bolagsskatt 2026 — Inkomstskattelagen (IL)',
    input_fields: {
      taxable_profit:                'number (required) — Skattemässigt resultat SEK (kan vara negativt)',
      periodiseringsfond_avsattning: 'number (optional) — Ny periodiseringsfond-avsättning SEK',
      befintliga_fonder:             'array|string (optional) — [{year:number, amount:number}] (array eller JSON-sträng)',
      underskott_foregaende_ar:      'number (optional) — Ackumulerat underskott från tidigare år SEK',
    },
    result_fields: {
      skattepliktig_vinst:           'Skattemässig vinst efter justeringar',
      bolagsskatt:                   'Slutlig bolagsskatt 20.6%',
      resultat_efter_skatt:          'Nettoresultat efter skatt',
      periodiseringsfond_avdrag:     'Genomförd periodiseringsfond-avsättning',
      aterforing:                    'Återföring av äldre fonder',
      schablonintakt:                'Schablonintäkt på befintliga fonder 72% × IBB',
      underskottsavdrag:             'Utnyttjat underskottsavdrag',
    },
    source: 'IL 65 kap 10 §',
    assertions: '46/46 PASS',
  },
  k10: {
    description: 'K10 Gränsbelopp 2026 — Inkomstskattelagen 57 kap (3:12-reglerna)',
    input_fields: {
      anskaffningsvarde:  'number (required) — Anskaffningsvärde för aktierna SEK',
      agarandel_procent:  'number (required) — Ägarandel i procent 0.01–100',
      total_lonesumma:    'number (optional) — Total kontant lönesumma inkl. dotterbolag SEK',
      egen_lon:           'number (optional) — Ägarens egna bruttolön SEK (alias: eigen_lon)',
      sparat_utrymme:     'number (optional) — Sparat gränsbelopp från föregående år SEK',
      indexupprakning:    'boolean (optional) — Uppräkna sparat utrymme med SBR-ränta',
    },
    result_fields: {
      grundbelopp:              'Årets grundbelopp (2,75 × IBB × ägarandel)',
      kapitalbaserat:           'Kapitalbaserat utrymme (anskaffningsvärde × 9.19%)',
      lonebaserat_underlag:     'Lönebaserat underlag (50% av totala löner)',
      lonebaserat_fore_tak:     'Lönebaserat utrymme × ägarandel före takregel',
      tak_50x:                  'Takregel 50 × ägarens lön',
      lonebaserat:              'Slutligt lönebaserat utrymme (efter tak)',
      sparat_uppraknat:         'Uppräknat sparat utrymme',
      gransbelopp:              'Totalt gränsbelopp (utdelningsutrymme till 20%)',
    },
    source: 'IL 57 kap 11 §',
    assertions: '34/34 PASS',
  },
};

// ── Ladda calculate-funktion dynamiskt ───────────────────────────────────────

async function loadCalculate(skill: SkillName): Promise<(input: SkillInput) => SkillOutput> {
  switch (skill) {
    case 'ag-avgifter':
      return (await import('../skills/ag-avgifter/calculate.js')).calculate;
    case 'moms':
      return (await import('../skills/moms/calculate.js')).calculate;
    case 'bolagsskatt':
      return (await import('../skills/bolagsskatt/calculate.js')).calculate;
    case 'k10':
      return (await import('../skills/k10/calculate.js')).calculate;
  }
}

// ── Diff-jämförelse ───────────────────────────────────────────────────────────

interface DiffEntry {
  expected: unknown;
  actual: unknown;
  delta: number | null;
}

function buildDiff(
  expected: Record<string, unknown>,
  actual: Record<string, number | string>,
): { diff: Record<string, DiffEntry>; pass: boolean } {
  const diff: Record<string, DiffEntry> = {};
  let pass = true;

  for (const [key, expectedVal] of Object.entries(expected)) {
    const actualVal = actual[key];

    if (actualVal === undefined) {
      diff[key] = { expected: expectedVal, actual: 'MISSING', delta: null };
      pass = false;
    } else if (typeof expectedVal === 'number' && typeof actualVal === 'number') {
      const delta = actualVal - expectedVal;
      if (Math.abs(delta) > 0.01) {
        diff[key] = { expected: expectedVal, actual: actualVal, delta };
        pass = false;
      }
    } else if (actualVal !== expectedVal) {
      diff[key] = { expected: expectedVal, actual: actualVal, delta: null };
      pass = false;
    }
  }

  return { diff, pass };
}

// ── Legal metadata (obligatorisk i alla svar) ────────────────────────────────

const LEGAL = {
  operator: 'KAMMAREN (privat open source-projekt)',
  contact: 'info@kammaren.nu',
  jurisdiction: 'Sverige',
  nature:
    'Deterministisk skatteberäkning. Ej skatterådgivning, finansiell rådgivning ' +
    'eller revision enligt någon svensk eller EU-rättslig definition.',
  warranty: 'Ingen garanti. Tjänsten tillhandahålls "as is".',
  not_affiliated_with: [
    'Kammarkollegiet',
    'Kammarrätten',
    'Skatteverket',
    'någon annan svensk myndighet',
  ],
  effective_date: '2026-01-01',
  legislation_as_of: '2026-04-18',
  terms_url: 'https://kammaren.nu/terms',
  privacy_url: 'https://kammaren.nu/privacy',
  source_code: 'https://github.com/Baltsar/kammaren',
  license: 'AGPL-3.0-or-later',
  disclaimer_relay_required: true,
  privacy_notice:
    'IP-adress loggas i max 24h för rate-limiting (60 req/min, art. 6.1.f GDPR, ' +
    'Upstash Redis EU-Frankfurt). Inga payloads loggas. Se privacy_url för art. 13 GDPR.',
} as const;

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleGet(res: VercelResponse): void {
  res.status(200).json({
    skills: SKILL_METADATA,
    engine_version: '2026.1',
    total_assertions: '258 interna regressionstest godkända (testar inte juridisk korrekthet)',
    usage: {
      list:      'GET /api/verify',
      calculate: 'POST /api/verify  { skill, input }',
      verify:    'POST /api/verify  { skill, input, expected }',
    },
    docs: 'https://kammaren.nu/api',
    effective_date: LEGAL.effective_date,
    legislation_as_of: LEGAL.legislation_as_of,
    legal: LEGAL,
  });
}

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = req.body as {
    skill?: string;
    input?: SkillInput;
    expected?: Record<string, unknown>;
  };

  const { skill, input, expected } = body ?? {};

  // Validate required fields
  if (!skill) {
    res.status(400).json({ error: 'Missing required field: skill', allowed: ALLOWED_SKILLS });
    return;
  }
  if (!input || typeof input !== 'object') {
    res.status(400).json({ error: 'Missing required field: input (object)' });
    return;
  }
  if (!ALLOWED_SKILLS.includes(skill as SkillName)) {
    res.status(400).json({ error: `Unknown skill: ${skill}`, allowed: ALLOWED_SKILLS });
    return;
  }

  // Load skill
  let calculate: (input: SkillInput) => SkillOutput;
  try {
    calculate = await loadCalculate(skill as SkillName);
  } catch {
    res.status(500).json({ error: `Failed to load skill: ${skill}` });
    return;
  }

  // Run calculation
  let result: SkillOutput;
  try {
    result = calculate(input);
  } catch (e) {
    res.status(400).json({
      error: 'Calculation failed',
      message: (e as Error).message,
    });
    return;
  }

  // Determine mode
  const hasExpected =
    expected !== undefined &&
    expected !== null &&
    typeof expected === 'object' &&
    Object.keys(expected).length > 0;

  let status: 'CALCULATED' | 'PASS' | 'FAIL' = 'CALCULATED';
  let diff: Record<string, DiffEntry> | undefined;

  if (hasExpected) {
    const comparison = buildDiff(expected!, result.result);
    diff = comparison.diff;
    status = comparison.pass ? 'PASS' : 'FAIL';
  }

  res.status(200).json({
    status,
    skill,
    input,
    ...(hasExpected ? { expected } : {}),
    actual: result.result,
    breakdown: result.breakdown,
    sources: result.sources,
    ...(hasExpected ? { diff } : {}),
    warnings: result.warnings,
    disclaimer: result.disclaimer,
    engine_version: '2026.1',
    effective_date: LEGAL.effective_date,
    legislation_as_of: LEGAL.legislation_as_of,
    constants_source: 'kammaren.nu/api/constants/2026',
    legal: LEGAL,
    timestamp: new Date().toISOString(),
  });
}

// ── Huvud-handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const allowed = await checkRateLimit(req, res);
  if (!allowed) return;

  if (req.method === 'GET') {
    handleGet(res);
    return;
  }

  if (req.method === 'POST') {
    await handlePost(req, res);
    return;
  }

  res.status(405).json({ error: 'Method not allowed', allowed: ['GET', 'POST'] });
}
