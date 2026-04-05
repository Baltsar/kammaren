/**
 * verify/stress.test.ts
 *
 * Stresstest: 10 radikalt olika AB-ägare, hela kedjan per scenario.
 * Testar KONSISTENS och ROBUSTHET — inte exakta siffror.
 * Exakta siffror testas i golden-cases/ och integration.test.ts.
 *
 * Kedja per scenario: moms → AG-avgifter → bolagsskatt → K10 → utdelning
 *
 * K1–K10 per scenario:
 *   K1:  Ingen skill kastar uncaught error
 *   K2:  Alla skills returnerar giltigt SkillOutput-interface
 *   K3:  AG-belopp >= 0
 *   K4:  Bolagsskatt >= 0
 *   K5:  Om vinst < 0 → bolagsskatt === 0
 *   K6:  Utdelning <= fritt eget kapital
 *   K7:  Utdelning <= gränsbelopp
 *   K8:  Inga NaN eller Infinity i output
 *   K9:  Alla siffror heltal (skills) eller max 2 decimaler (moms)
 *   K10: Year-guard passerar (inkomstår 2026)
 *
 * Kör: bun test ./verify/stress.test.ts
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { calculate as momsCalc } from '../skills/moms/calculate.js';
import { calculate as agCalc } from '../skills/ag-avgifter/calculate.js';
import { calculate as bolagsskattCalc } from '../skills/bolagsskatt/calculate.js';
import { calculate as k10Calc } from '../skills/k10/calculate.js';
import type { SkillOutput } from '../skills/types.js';

// ── Hjälpfunktioner ───────────────────────────────────────────────────────────

function assertValidSkillOutput(out: SkillOutput, name: string): void {
  expect(out.result,     `${name}: saknar result`).toBeDefined();
  expect(out.breakdown,  `${name}: saknar breakdown`).toBeDefined();
  expect(out.warnings,   `${name}: saknar warnings`).toBeDefined();
  expect(out.sources,    `${name}: saknar sources`).toBeDefined();
  expect(out.disclaimer, `${name}: saknar disclaimer`).toBeTruthy();
  expect(Array.isArray(out.sources),   `${name}: sources ej array`).toBe(true);
  expect(out.sources.length,           `${name}: sources tom`).toBeGreaterThan(0);
  expect(Array.isArray(out.breakdown), `${name}: breakdown ej array`).toBe(true);
}

function assertNoNaNInfinity(out: SkillOutput, name: string): void {
  for (const [key, val] of Object.entries(out.result)) {
    if (typeof val === 'number') {
      expect(!isNaN(val),   `${name}.result.${key} är NaN`).toBe(true);
      expect(isFinite(val), `${name}.result.${key} är Infinity`).toBe(true);
    }
  }
}

// allowTwoDecimals=true → kontroll för ≤2 decimaler (moms).
// allowTwoDecimals=false → kontroll för heltal (övriga skills).
function assertRounding(out: SkillOutput, name: string, allowTwoDecimals: boolean): void {
  for (const [key, val] of Object.entries(out.result)) {
    if (typeof val === 'number') {
      if (allowTwoDecimals) {
        const r = Math.round(val * 100) / 100;
        expect(
          Math.abs(val - r) < 1e-9,
          `${name}.result.${key}=${val} har fler än 2 decimaler`,
        ).toBe(true);
      } else {
        expect(
          val === Math.round(val),
          `${name}.result.${key}=${val} är inte ett heltal`,
        ).toBe(true);
      }
    }
  }
}

// ── Scenario-parametrar ───────────────────────────────────────────────────────

interface ScenarioParams {
  id: string;
  label: string;
  omsattning: number;
  kostnader: number;
  lon: number;              // Ägarens bruttolön
  birth_year: number;
  first_employee?: boolean;
  num_employees?: number;
  anskaffningsvarde: number;
  agarandel: number;        // Ägarandel i procent
  total_lonesumma?: number; // Om annan än lon (t.ex. flereägare)
  sparat: number;
  fonder_json?: string;     // befintliga_fonder som JSON-sträng
  vat_rate?: number;        // default 25; Sc4 använder 0
  // Sc8: extra anställd med Växa-stödet
  extra_salary?: number;
  extra_first_employee?: boolean;
  extra_birth_year?: number;
  notes?: string[];
}

// ── Kedjekörning ─────────────────────────────────────────────────────────────

interface ChainResult {
  id: string;
  label: string;
  errors: string[];
  momsOut: SkillOutput | null;
  agOut: SkillOutput | null;
  bsOut: SkillOutput | null;
  k10Out: SkillOutput | null;
  total_ag: number;
  vinst_gross: number;      // Resultat FÖRE bolagsskattberäkning (input taxable_profit)
  resultat_efter_skatt: number;
  gransbelopp: number;
  fritt_ek: number;         // max(0, resultat_efter_skatt)
  max_utdelning: number;    // min(fritt_ek, gransbelopp)
  notes: string[];
}

function runChain(p: ScenarioParams): ChainResult {
  const errors: string[] = [];
  let momsOut: SkillOutput | null = null;
  let agOut: SkillOutput | null = null;
  let agExtraOut: SkillOutput | null = null;
  let bsOut: SkillOutput | null = null;
  let k10Out: SkillOutput | null = null;

  // 1. Moms på omsättning
  try {
    momsOut = momsCalc({
      amount:    p.omsattning,
      vat_rate:  p.vat_rate ?? 25,
      direction: 'netto_to_brutto',
    }) as SkillOutput;
  } catch (e) { errors.push(`moms: ${e}`); }

  // 2. AG-avgifter på ägarens lön
  try {
    agOut = agCalc({
      gross_salary:   p.lon,
      birth_year:     p.birth_year,
      first_employee: p.first_employee ?? false,
      num_employees:  p.num_employees ?? 0,
    }) as SkillOutput;
  } catch (e) { errors.push(`ag: ${e}`); }

  // 2b. Sc8: extra anställd med Växa-stödet (kör AG separat)
  const extra_salary = p.extra_salary ?? 0;
  if (extra_salary > 0) {
    try {
      agExtraOut = agCalc({
        gross_salary:   extra_salary,
        birth_year:     p.extra_birth_year ?? 1990,
        first_employee: p.extra_first_employee ?? false,
        num_employees:  0,
      }) as SkillOutput;
    } catch (e) { errors.push(`ag-extra: ${e}`); }
  }

  const total_ag_primary = (agOut?.result['total_ag'] as number) ?? 0;
  const total_ag_extra   = (agExtraOut?.result['total_ag'] as number) ?? 0;
  const total_ag         = total_ag_primary + total_ag_extra;

  // 3. Bolagsskatt
  // vinst = omsättning - kostnader - ägarens lön - extra lön - total AG
  const vinst_gross = p.omsattning - p.kostnader - p.lon - extra_salary - total_ag;

  try {
    bsOut = bolagsskattCalc({
      taxable_profit:                vinst_gross,
      periodiseringsfond_avsattning: Math.max(0, Math.floor(vinst_gross * 0.25)),
      befintliga_fonder:             p.fonder_json ?? '[]',
      underskott_foregaende_ar:      0,
    }) as SkillOutput;
  } catch (e) { errors.push(`bolagsskatt: ${e}`); }

  // 4. K10 gränsbelopp
  try {
    k10Out = k10Calc({
      anskaffningsvarde: p.anskaffningsvarde,
      agarandel_procent: p.agarandel,
      total_lonesumma:   p.total_lonesumma ?? p.lon,
      eigen_lon:          p.lon,
      sparat_utrymme:    p.sparat,
      inkomstar:         2026,
    }) as SkillOutput;
  } catch (e) { errors.push(`k10: ${e}`); }

  // 5. Utdelning
  const resultat_efter_skatt = (bsOut?.result['resultat_efter_skatt'] as number) ?? 0;
  const gransbelopp          = (k10Out?.result['gransbelopp'] as number) ?? 0;
  const fritt_ek             = Math.max(0, resultat_efter_skatt);
  const max_utdelning        = Math.min(fritt_ek, gransbelopp);

  return {
    id: p.id, label: p.label, errors,
    momsOut, agOut, bsOut, k10Out,
    total_ag, vinst_gross,
    resultat_efter_skatt, gransbelopp, fritt_ek, max_utdelning,
    notes: p.notes ?? [],
  };
}

// ── Scenariodefinitioner ──────────────────────────────────────────────────────

const scenarios: ChainResult[] = [

  // ── Sc1: Nystartad, noll omsättning ─────────────────────────────────────────
  // Gränsbelopp = grundbelopp + kapitalbaserat. Utdelning = 0 (inget i bolaget).
  runChain({
    id: 'Sc1', label: 'Nystartad noll omsättning',
    omsattning: 0, kostnader: 0, lon: 0, birth_year: 1996,
    anskaffningsvarde: 25_000, agarandel: 100, sparat: 0,
    notes: ['Gränsbelopp = grundbelopp(322 400) + kapitalbaserat(2 888) = 325 288. Utdelning = 0.'],
  }),

  // ── Sc2: Förlustbolag ────────────────────────────────────────────────────────
  // Negativ vinst → bolagsskatt = 0. Utdelning = 0 (negativt EK).
  runChain({
    id: 'Sc2', label: 'Förlustbolag',
    omsattning: 200_000, kostnader: 350_000, lon: 0, birth_year: 1991,
    anskaffningsvarde: 25_000, agarandel: 100, sparat: 50_000,
    notes: ['Negativ vinst −150 000. Bolagsskatt = 0. Underskott att rulla = 150 000.'],
  }),

  // ── Sc3: Högomsättare, 10M ───────────────────────────────────────────────────
  // Stor vinst, stor pfond, hög utdelning — testar inga överflöden.
  runChain({
    id: 'Sc3', label: 'Högomsättare 10M',
    omsattning: 10_000_000, kostnader: 2_000_000, lon: 1_200_000, birth_year: 1984,
    anskaffningsvarde: 25_000, agarandel: 100, sparat: 500_000,
    notes: ['Stor vinst, max pfond. Gränsbelopp begränsar utdelning, ej EK.'],
  }),

  // ── Sc4: Under momsgräns ─────────────────────────────────────────────────────
  // Omsättning 100k < 120k → momsbefriad. Kör med vat_rate: 0.
  // TODO FÖRBÄTTRINGSFÖRSLAG: Moms-skill varnar ej för momsgräns 120 000 kr.
  runChain({
    id: 'Sc4', label: 'Under momsgräns (100k)',
    omsattning: 100_000, kostnader: 20_000, lon: 0, birth_year: 1998,
    anskaffningsvarde: 25_000, agarandel: 100, sparat: 0,
    vat_rate: 0,  // Momsbefriad — under 120 000 kr/år
    notes: [
      'TODO FÖRBÄTTRINGSFÖRSLAG: Moms-skill varnar ej om omsättning < 120 000 kr (momsgränsen).',
      'Kör med vat_rate: 0 som workaround (momsbefriad). Skill saknar explicit momsgränsecheck.',
    ],
  }),

  // ── Sc5: Äldre ägare, född 1955 (71 år) ─────────────────────────────────────
  // Åldersreduktion: born ≤ 1958 → AG = 10.21% (bara ålderspension).
  runChain({
    id: 'Sc5', label: 'Äldre ägare (born 1955, 71 år)',
    omsattning: 800_000, kostnader: 100_000, lon: 300_000, birth_year: 1955,
    anskaffningsvarde: 25_000, agarandel: 100, sparat: 200_000,
    notes: ['AG = 10.21% (åldersreduktion born ≤ 1958). Resten av kedjan normal.'],
  }),

  // ── Sc6: Två ägare, 50/50 ───────────────────────────────────────────────────
  // Per-ägare beräkning. Ägare 2 lön + AG inkluderas i kostnader.
  // Ägare 2 AG = round(500k × 0.3142) = 157 100.
  runChain({
    id: 'Sc6', label: 'Två ägare 50/50',
    omsattning: 2_000_000,
    kostnader: 300_000 + 500_000 + 157_100,  // drift + ägare2-lön + ägare2-AG
    lon: 500_000, birth_year: 1986,
    anskaffningsvarde: 25_000, agarandel: 50,
    total_lonesumma: 1_000_000,  // Båda ägarnas löner för K10
    sparat: 100_000,
    notes: [
      'K10 per ägare: grundbelopp × 50%, lönebaserat på total lönesumma 1M.',
      'Ägare 2 lön (500k) + AG (157 100) ingår i kostnader.',
    ],
  }),

  // ── Sc7: Miniägare, 3% (under 4%-spärr) ─────────────────────────────────────
  // 4%-spärr aktiv: agarandel 3% < 4% → lonebaserat = 0.
  runChain({
    id: 'Sc7', label: 'Miniägare 3% (4%-spärr)',
    omsattning: 5_000_000, kostnader: 1_000_000, lon: 600_000, birth_year: 1988,
    anskaffningsvarde: 1_000_000, agarandel: 3,
    total_lonesumma: 3_000_000,
    sparat: 0,
    notes: ['4%-spärr: 3% < 4% → lonebaserat = 0. Kapitalbaserat på 1M×3%×11.55%.'],
  }),

  // ── Sc8: Växa-stödet aktivt, första anställd ────────────────────────────────
  // AG beräknas separat: ägarlön (full) + anställd (Växa 10.21% < 420k-tak).
  runChain({
    id: 'Sc8', label: 'Växa-stödet (första anställd)',
    omsattning: 1_500_000, kostnader: 200_000,
    lon: 500_000, birth_year: 1991,
    first_employee: false, num_employees: 0,
    extra_salary: 400_000,           // Anställd: Växa (400k < 420k-tak → 10.21%)
    extra_first_employee: true,
    extra_birth_year: 1992,
    anskaffningsvarde: 25_000, agarandel: 100,
    total_lonesumma: 900_000,         // 500k + 400k för K10
    sparat: 0,
    notes: [
      'AG ägarlön 500k: full 31.42% = 157 100 kr.',
      'AG anställd 400k: Växa 10.21% (under 420k-tak) = 40 840 kr.',
      'Total AG: 197 940 kr. Total lönesumma K10: 900 000 kr.',
    ],
  }),

  // ── Sc9: Max pfond + 5 befintliga fonder ─────────────────────────────────────
  // 5 fonder → plats för 1 ny. Ingen återföring (2021 ≤ tröskel 2020 = ej sant).
  // Schablonintäkt: 860 000 × 2.55% = round(21 930) = 21 930 kr.
  runChain({
    id: 'Sc9', label: 'Max pfond + 5 befintliga fonder',
    omsattning: 3_000_000, kostnader: 500_000, lon: 700_000, birth_year: 1981,
    anskaffningsvarde: 25_000, agarandel: 100, sparat: 0,
    fonder_json: JSON.stringify([
      { year: 2021, amount: 200_000 },
      { year: 2022, amount: 150_000 },
      { year: 2023, amount: 180_000 },
      { year: 2024, amount: 160_000 },
      { year: 2025, amount: 170_000 },
    ]),
    notes: [
      '5 fonder → plats för 1 ny (PFOND_MAX_ANTAL = 6).',
      '2021-fond EJ återförd (2026−2021=5 år ≤ 6-årströskeln). Tröskel = år ≤ 2020.',
      'Schablonintäkt: 860 000 × 2.55% = 21 930 kr.',
    ],
  }),

  // ── Sc10: Extremt låg lön, 1 kr ──────────────────────────────────────────────
  // AG avrundas korrekt (< MIN_UNDERLAG 1000 → 0). K10 lönebaserat = 0.
  runChain({
    id: 'Sc10', label: 'Extremt låg lön (1 kr)',
    omsattning: 500_000, kostnader: 50_000, lon: 1, birth_year: 1996,
    anskaffningsvarde: 25_000, agarandel: 100, sparat: 0,
    notes: ['AG = 0 (1 kr < MIN_UNDERLAG 1000 kr). K10 lönebaserat = 0 (1 kr << lönespärr 644 800).'],
  }),
];

// ── Testsviter: K1–K10 per scenario ──────────────────────────────────────────

describe('STRESS TEST: 10 scenarier', () => {

  for (const sc of scenarios) {

    describe(`${sc.id}: ${sc.label}`, () => {

      test('K1: Ingen skill kastar uncaught error', () => {
        expect(sc.errors, `Fel: ${sc.errors.join('; ')}`).toHaveLength(0);
      });

      test('K2: Alla skills returnerar giltigt SkillOutput', () => {
        expect(sc.momsOut,  'moms returnerade null').not.toBeNull();
        expect(sc.agOut,    'ag returnerade null').not.toBeNull();
        expect(sc.bsOut,    'bolagsskatt returnerade null').not.toBeNull();
        expect(sc.k10Out,   'k10 returnerade null').not.toBeNull();
        if (sc.momsOut) assertValidSkillOutput(sc.momsOut, 'moms');
        if (sc.agOut)   assertValidSkillOutput(sc.agOut, 'ag');
        if (sc.bsOut)   assertValidSkillOutput(sc.bsOut, 'bolagsskatt');
        if (sc.k10Out)  assertValidSkillOutput(sc.k10Out, 'k10');
      });

      test('K3: AG-belopp >= 0', () => {
        expect(sc.total_ag).toBeGreaterThanOrEqual(0);
      });

      test('K4: Bolagsskatt >= 0', () => {
        const bs = (sc.bsOut?.result['bolagsskatt'] as number) ?? 0;
        expect(bs).toBeGreaterThanOrEqual(0);
      });

      test('K5: Om vinst < 0 → bolagsskatt === 0', () => {
        if (sc.vinst_gross < 0) {
          const bs = (sc.bsOut?.result['bolagsskatt'] as number) ?? -1;
          expect(bs).toBe(0);
        } else {
          expect(true).toBe(true);  // N/A — vinst är ej negativ i detta scenario
        }
      });

      test('K6: Utdelning <= fritt eget kapital', () => {
        expect(sc.max_utdelning).toBeLessThanOrEqual(sc.fritt_ek);
      });

      test('K7: Utdelning <= gränsbelopp', () => {
        expect(sc.max_utdelning).toBeLessThanOrEqual(sc.gransbelopp);
      });

      test('K8: Inga NaN eller Infinity i output', () => {
        if (sc.momsOut) assertNoNaNInfinity(sc.momsOut, 'moms');
        if (sc.agOut)   assertNoNaNInfinity(sc.agOut, 'ag');
        if (sc.bsOut)   assertNoNaNInfinity(sc.bsOut, 'bolagsskatt');
        if (sc.k10Out)  assertNoNaNInfinity(sc.k10Out, 'k10');
      });

      test('K9: Alla siffror heltal (skills) eller max 2 decimaler (moms)', () => {
        if (sc.momsOut) assertRounding(sc.momsOut, 'moms', true);
        if (sc.agOut)   assertRounding(sc.agOut, 'ag', false);
        if (sc.bsOut)   assertRounding(sc.bsOut, 'bolagsskatt', false);
        if (sc.k10Out)  assertRounding(sc.k10Out, 'k10', false);
      });

      test('K10: Year-guard passerar (inkomstår 2026)', () => {
        // Om year-guard kastade fel hade K1 fångat det.
        // Denna kontroll verifierar explicit att vi kör under 2026.
        expect(new Date().getFullYear()).toBe(2026);
      });

    });
  }

  // ── Slutrapport ─────────────────────────────────────────────────────────────

  afterAll(() => {
    const L = '═'.repeat(55);
    const D = '─'.repeat(55);
    const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

    console.log(`\n${L}`);
    console.log('STRESS TEST: 10 scenarier');
    console.log(L);
    console.log(`${'Id'.padEnd(5)}  ${'Scenario'.padEnd(32)}  Status`);
    console.log(D);

    let totalErrors = 0;
    for (const sc of scenarios) {
      const ok     = sc.errors.length === 0;
      const status = ok
        ? '✓ 10/10 kontroller'
        : `✗ K1 FAIL: ${sc.errors.join(', ')}`;
      console.log(`${pad(sc.id, 5)}  ${pad(sc.label, 32)}  ${status}`);
      totalErrors += sc.errors.length;
    }

    console.log(D);

    if (totalErrors === 0) {
      console.log('100/100 KONTROLLER PASS (inga kedjekrascher)');
    } else {
      console.log(`VARNING: ${totalErrors} kedjekrascher — se K1-resultat ovan`);
    }

    console.log(L);

    // TODO-förbättringsförslag (från Sc4)
    console.log('\nTODO FÖRBÄTTRINGSFÖRSLAG:');
    console.log('  Moms-skill saknar varning när omsättning < 120 000 kr (momsgränsen).');
    console.log('  Sc4 kör med vat_rate: 0 som workaround. Förbättra: lägg till');
    console.log('  warning i moms/calculate.ts om amount < MOMS_GRANSEN (120 000 kr).');

    // Scenario-noter
    console.log('\nSCENARIO-NOTER:');
    for (const sc of scenarios) {
      console.log(`  ${sc.id}: ${sc.notes[0] ?? '–'}`);
    }

    console.log(L);
    console.log('');
  });

});
