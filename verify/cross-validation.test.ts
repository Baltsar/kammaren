/**
 * verify/cross-validation.test.ts
 *
 * Korsvaliderar tax-optimizer vs k10-skill.
 * Båda beräknar gränsbelopp (utdelningsutrymme / gransbelopp).
 * Hittar avvikelser. Fixar ingenting — rapporterar bara.
 *
 * Kör: bun test ./verify/cross-validation.test.ts
 *
 * ─── UPPDATERAT EFTER K10-FIX (Prop. 2025/26:1) ───────────────────────────────
 *
 * K10 använder nu additiv formel:
 *   gransbelopp = grundbelopp + kapitalbaserat + lönebaserat + sparat
 *
 * Tax-optimizer saknar kapitalbaserat-komponenten (omk × 11.55%) helt
 * när omk ≤ 100 000 kr (threshold-baserad). För default omk=25 000 kr:
 *   tax-opt kapitalbaserat = 0 (under threshold)
 *   K10     kapitalbaserat = round(25 000 × 0.1155) = 2 888
 *
 * Förväntad kvarstående skillnad: K10 är 2 888 kr HÖGRE per scenario (omk=25k).
 * Grundlogiken (additiv) matchar nu. Fixas i tax-optimizer separat.
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { calculate as taxOptCalc } from '../skills/tax-optimizer/optimize.js';
import { calculate as k10Calc } from '../skills/k10/calculate.js';
import type { SkillInput } from '../skills/types.js';

// ── Typer ─────────────────────────────────────────────────────────────────────

interface CrossResult {
  scenario: string;
  taxOpt_lon: number;
  taxOpt_utdelningsutrymme: number;
  k10_gransbelopp: number;
  diff: number;       // taxOpt − k10 (NaN = ej jämförbart)
  match: boolean;
  rotor: string;
}

const results: CrossResult[] = [];

// ── Konstanter (speglar skills/tax-optimizer/constants.ts) ───────────────────

const BASE_AMOUNT   = 322_400;   // 4 × IBB_3_12
const SLR           = 0.0255;
const RATE_ADDON    = 0.09;
const DEFAULT_OMK   = 25_000;    // tax-optimizer default om ej angivet
// K10 kapitalbaserat för omk=25k: round(25 000 × 0.1155) = 2 888
const K10_KAPITALBASERAT_25K = 2_888;

// ── Hjälpfunktion: kör ett scenario och lagra resultat ───────────────────────

function runScenario(
  label: string,
  taxInput: SkillInput,
  k10Overrides: {
    total_lonesumma?: number;
    eigen_lon?: number;
  } = {},
  rotor = '',
): CrossResult {
  const taxOut = taxOptCalc(taxInput);
  const lon         = taxOut.result['optimal_lon'] as number;
  const utdelnings  = taxOut.result['utdelningsutrymme'] as number;

  const totalPayrollOthers = (taxInput['total_payroll_others'] as number) ?? 0;
  const savedSpace          = (taxInput['saved_dividend_space'] as number) ?? 0;
  const omk                 = (taxInput['omkostnadsbelopp'] as number) ?? DEFAULT_OMK;

  const k10Input: SkillInput = {
    anskaffningsvarde:  omk,
    agarandel_procent:  100,
    total_lonesumma:    k10Overrides.total_lonesumma ?? (lon + totalPayrollOthers),
    eigen_lon:           k10Overrides.eigen_lon ?? lon,
    sparat_utrymme:     savedSpace,
    inkomstar:          2026,
  };

  const k10Out = k10Calc(k10Input);
  const gransbelopp = k10Out.result['gransbelopp'] as number;

  const diff  = utdelnings - gransbelopp;
  const match = diff === 0;

  const r: CrossResult = {
    scenario: label,
    taxOpt_lon: lon,
    taxOpt_utdelningsutrymme: utdelnings,
    k10_gransbelopp: gransbelopp,
    diff,
    match,
    rotor,
  };
  results.push(r);
  return r;
}

// ── Basinput (gemensamt för alla jämförbara scenarion) ───────────────────────

const BASE: SkillInput = {
  municipal_tax_rate: 0.32,
  church_member:      false,
  num_owners:         1,
  saved_dividend_space: 0,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Korsvalidering: tax-optimizer vs k10', () => {

  // ── Sc1: Lön under lönespärr ──────────────────────────────────────────
  //
  //   salary=400 000 (< lönespärr 644 800), omk=25k
  //   tax-opt: BASE(322 400) + salaryBasedSpace(0) + omk_tillagg(0) = 322 400
  //   K10 ny:  grundbelopp(322 400) + kapitalbaserat(2 888) + lonebaserat(0) = 325 288
  //   diff: −2 888 (K10 högre med kapitalbaserat-komponenten)
  test('Sc1: lön under lönespärr → diff −2 888 (K10 kapitalbaserat)', () => {
    const r = runScenario(
      'Sc1: Lön < lönespärr (400 000 kr, SGI)',
      { ...BASE, revenue: 525_680, costs: 0, salary_strategy: 'sgi' },
      {},
      'Grundlogik matchar (additiv). diff = K10 kapitalbaserat (2 888). tax-opt har ej kapitalbaserat för omk<100k.',
    );

    expect(r.taxOpt_lon).toBe(400_000);
    expect(r.taxOpt_utdelningsutrymme).toBe(BASE_AMOUNT);
    expect(r.k10_gransbelopp).toBe(BASE_AMOUNT + K10_KAPITALBASERAT_25K);  // 325 288
    expect(r.diff).toBe(-K10_KAPITALBASERAT_25K);  // −2 888
    expect(r.match).toBe(false);
  });

  // ── Sc2: Lön strax över lönespärr ────────────────────────────────────
  //
  //   salary=673 038 (> lönespärr), omk=25k
  //   salaryBasedSpace = round(0.5 × (673 038 − 644 800)) = 14 119
  //   tax-opt: 322 400 + 14 119 = 336 519
  //   K10 ny:  322 400 + 2 888 + 14 119 = 339 407
  //   diff: −2 888 (K10 kapitalbaserat)
  test('Sc2: lön strax över lönespärr → diff −2 888 (K10 kapitalbaserat)', () => {
    const r = runScenario(
      'Sc2: Pension-lön 673 038 (strax över lönespärr)',
      { ...BASE, revenue: 884_507, costs: 0, salary_strategy: 'pension' },
      {},
      'Lönebaserat matchar i båda (14 119). diff = K10 kapitalbaserat (2 888 för omk=25k).',
    );

    expect(r.taxOpt_lon).toBe(673_038);
    expect(r.taxOpt_utdelningsutrymme).toBe(336_519);
    expect(r.k10_gransbelopp).toBe(339_407);   // 322 400 + 2 888 + 14 119
    expect(r.diff).toBe(-2_888);
    expect(r.match).toBe(false);
  });

  // ── Sc3: Integrationsscenario — lön 660 000, sparat 150 000 ──────────
  //
  //   salary=660 000, saved=150 000, omk=25k
  //   salaryBasedSpace = round(0.5 × (660 000 − 644 800)) = 7 600
  //   tax-opt: 322 400 + 7 600 + 0 + 150 000 = 480 000
  //   K10 ny:  322 400 + 2 888 + 7 600 + 150 000 = 482 888
  //   diff: −2 888
  test('Sc3: integrationsscenario lön 660 000 + sparat 150 000 → diff −2 888', () => {
    const r = runScenario(
      'Sc3: Balanced 660 000 kr + sparat 150 000 kr',
      { ...BASE, revenue: 1_067_372, costs: 200_000, salary_strategy: 'balanced', saved_dividend_space: 150_000 },
      {},
      'Sparat räknas in lika. Lönebaserat matchar (7 600). diff = K10 kapitalbaserat (2 888).',
    );

    expect(r.taxOpt_lon).toBe(660_000);
    expect(r.taxOpt_utdelningsutrymme).toBe(480_000);
    expect(r.k10_gransbelopp).toBe(482_888);   // 322 400 + 2 888 + 7 600 + 150 000
    expect(r.diff).toBe(-2_888);
    expect(r.match).toBe(false);
  });

  // ── Sc4: Noll intäkt, sparat 200 000 ─────────────────────────────────
  //
  //   salary=0, saved=200 000, omk=25k
  //   tax-opt: 322 400 + 0 + 0 + 200 000 = 522 400
  //   K10 ny:  322 400 + 2 888 + 0 + 200 000 = 525 288
  //   diff: −2 888
  test('Sc4: noll intäkt sparat 200 000 → diff −2 888', () => {
    const r = runScenario(
      'Sc4: Noll intäkt, sparat 200 000 kr',
      { ...BASE, revenue: 0, costs: 0, salary_strategy: 'balanced', saved_dividend_space: 200_000 },
      {},
      'Lönebaserat=0 i båda. Sparat matchar. diff = K10 kapitalbaserat (2 888).',
    );

    expect(r.taxOpt_lon).toBe(0);
    expect(r.taxOpt_utdelningsutrymme).toBe(522_400);
    expect(r.k10_gransbelopp).toBe(525_288);   // 322 400 + 2 888 + 0 + 200 000
    expect(r.diff).toBe(-2_888);
    expect(r.match).toBe(false);
  });

  // ── Sc5: 50x-tak med övriga anställda ────────────────────────────────
  //
  //   salary=10 000, total_payroll_others=1 990 000, omk=25k
  //   salaryBasedSpace_uncapped = round(0.5 × (2 000 000 − 644 800)) = 677 600
  //   capped = min(677 600, 50 × 10 000) = 500 000
  //   tax-opt: 322 400 + 500 000 + 0 + 0 = 822 400
  //   K10 ny:  322 400 + 2 888 + 500 000 + 0 = 825 288
  //   diff: −2 888
  //
  //   TIDIGARE (gammal K10): diff = +297 400 (max-formel gav 525 000).
  //   NU (ny K10 additiv):   diff = −2 888 (kapitalbaserat).
  test('Sc5: 50x-tak med övriga anställda → diff −2 888 (FÖRBÄTTRAT från +297 400)', () => {
    const r = runScenario(
      'Sc5: 50x-tak (lön 10 000, 1 990 000 kr andra)',
      { ...BASE, revenue: 13_142, costs: 0, salary_strategy: 'sgi', total_payroll_others: 1_990_000 },
      {},
      'Additiv formel matchar nu. 50x-cap = 500 000 lika i båda. diff = K10 kapitalbaserat (2 888). Förbättring: −297 400 → −2 888.',
    );

    expect(r.taxOpt_lon).toBe(10_000);
    expect(r.taxOpt_utdelningsutrymme).toBe(822_400);
    expect(r.k10_gransbelopp).toBe(825_288);   // 322 400 + 2 888 + 500 000
    expect(r.diff).toBe(-2_888);
    expect(r.match).toBe(false);
  });

  // ── Sc6: 4%-spärr — K10 kan, tax-optimizer kan ej ─────────────────────
  //
  //   K10: 3% ägare, anskaffningsvärde=100 000, total_lonesumma=1 000 000
  //   4%-spärr: agarandel(0.03) < 0.04 → lonebaserat=0
  //   grundbelopp    = round(322 400 × 0.03) = 9 672
  //   kapitalbaserat = round(round(100 000 × 0.03) × 0.1155) = round(3 000 × 0.1155) = round(346.5) = 347
  //   gransbelopp    = 9 672 + 347 = 10 019
  //
  //   tax-optimizer: stöder ej partiell ägarandel (enägare-MVP).
  test('Sc6: K10 hanterar 4%-spärr (3% ägare) — tax-optimizer ej jämförbar', () => {
    const k10Input: SkillInput = {
      anskaffningsvarde: 100_000,
      agarandel_procent: 3,
      total_lonesumma:   1_000_000,
      eigen_lon:          30_000,
      sparat_utrymme:    0,
      inkomstar:         2026,
    };

    const k10Out = k10Calc(k10Input);
    const gransbelopp = k10Out.result['gransbelopp'] as number;
    const warnings    = k10Out.warnings as string[];

    // grundbelopp = round(322 400 × 0.03) = 9 672
    // kapitalbaserat = round(round(100 000 × 0.03) × 0.1155) = round(3 000 × 0.1155) = round(346.5) = 347
    // gransbelopp = 9 672 + 347 = 10 019
    expect(gransbelopp).toBe(10_019);
    expect(warnings.some(w => /4%-spärr/.test(w))).toBe(true);

    results.push({
      scenario:                'Sc6: 4%-spärr (3% ägare, 100k anskaffning)',
      taxOpt_lon:              NaN,
      taxOpt_utdelningsutrymme: NaN,
      k10_gransbelopp:         gransbelopp,
      diff:                    NaN,
      match:                   false,
      rotor:                   'INKOMPATIBEL: tax-optimizer är enägare-MVP (100%). K10 stöder 0.01–100%. 4%-spärr → lonebaserat=0, gränsbelopp=10 019 (grundbelopp 9 672 + kapitalbaserat 347).',
    });
  });

  // ── Rapport ──────────────────────────────────────────────────────────────
  afterAll(() => {
    const comparables  = results.filter(r => !isNaN(r.diff));
    const matches      = comparables.filter(r => r.match);
    const mismatches   = comparables.filter(r => !r.match);
    const incompatible = results.filter(r => isNaN(r.diff));

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║       KORSVALIDERING: tax-optimizer vs k10-skill                    ║');
    console.log('║       Gränsbelopp (utdelningsutrymme / gransbelopp) 2026            ║');
    console.log('║       K10 uppdaterad: additiv formel (Prop. 2025/26:1)              ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    for (const r of results) {
      if (isNaN(r.diff)) {
        console.log(`  ⚠ INKOMPAT  ${r.scenario}`);
        console.log(`               k10: ${r.k10_gransbelopp.toLocaleString('sv-SE').padStart(7)} kr`);
      } else if (r.match) {
        console.log(`  ✓ MATCH     ${r.scenario}`);
        console.log(`               tax-opt: ${String(r.taxOpt_utdelningsutrymme).padStart(7)}  k10: ${String(r.k10_gransbelopp).padStart(7)}  diff: 0`);
      } else {
        const sign = r.diff > 0 ? '+' : '';
        console.log(`  ~ KÄND DIFF ${r.scenario}`);
        console.log(`               tax-opt: ${String(r.taxOpt_utdelningsutrymme).padStart(7)}  k10: ${String(r.k10_gransbelopp).padStart(7)}  diff: ${sign}${r.diff.toLocaleString('sv-SE')}`);
      }
      console.log(`               ${r.rotor}`);
    }

    console.log('\n─────────────────────────────────────────────────────────────────────');
    console.log(`  Jämförbara: ${comparables.length}  MATCH: ${matches.length}  KÄND DIFF: ${mismatches.length}  INKOMPAT: ${incompatible.length}`);

    console.log('\n  STATUS EFTER K10-FIX:');
    console.log('');
    console.log('  [✓] Grundlogik nu identisk (additiv vs additiv)');
    console.log('      Tidigare: tax-opt additivt, K10 max() → stora avvikelser (+7 600 → +297 400)');
    console.log('      Nu: båda additivt → skillnad reducerad till konstant 2 888 kr');
    console.log('');
    console.log('  [~] KVARSTÅENDE KÄND SKILLNAD — kapitalbaserat-komponenten');
    console.log(`      K10 (ny, korrekt): kapitalbaserat = omk × (SLR+9%) = 25 000 × 11.55% = 2 888 kr`);
    console.log(`      tax-optimizer: kapitalbaserat = max(0, (omk−100 000) × ${((SLR + RATE_ADDON) * 100).toFixed(2)}%)`);
    console.log(`                     = max(0, (25 000−100 000) × 11.55%) = 0 kr (under threshold)`);
    console.log(`      → K10 ger 2 888 kr mer. Fixas i tax-optimizer separat.`);
    console.log('');
    console.log('  [3] INFO — 4%-spärr saknas i tax-optimizer (MVP)');
    console.log('      K10 implementerar LONEBASERAT_MIN_AGARANDEL=4%. Modelleras ej i tax-optimizer.');
    console.log('─────────────────────────────────────────────────────────────────────\n');
  });

});
