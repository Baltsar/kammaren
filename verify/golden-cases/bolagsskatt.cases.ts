/**
 * verify/golden-cases/bolagsskatt.cases.ts
 *
 * Handberäknade golden cases för bolagsskatt skill.
 * GUARDRAILS regel 2: cases skrivs FÖRE implementationen.
 *
 * ─── BOLAGSSKATT 2026 ───────────────────────────────────────────────────────
 *
 *   Skattesats:       20.6%  (IL 65 kap 10 §)
 *   Pfond max:        25%    (IL 30 kap 5 §)
 *   Pfond max antal:  6      (IL 30 kap 7 §)
 *   Pfond max år:     6      (IL 30 kap 7 §)
 *   Schablonintäkt:   fondbelopp IB × 2.55% (IL 30 kap 6a §)
 *   Statslåneränta:   2.55%  (30 nov 2025, SKV PDF 2026-01-07)
 *
 * ─── BERÄKNINGSORDNING ──────────────────────────────────────────────────────
 *
 *   1. Återföring av fonder äldre än 6 år (year ≤ 2026−6 = 2020)
 *   2. Schablonintäkt på IB (ALLA fonder INNAN återföring)
 *   3. Underskottsavdrag (max = current adjusted result, ej negativt)
 *   4. Pfond: max 25% av resultat efter steg 1−3
 *      Max-antal kontroll: count BEFORE recovery (konservativ tolkning)
 *   5. Skattepliktig vinst = max(0, adj − pfond)
 *   6. Bolagsskatt = Math.round(skattepliktig_vinst × 0.206)
 *   7. Resultat efter skatt = (adj − pfond) − bolagsskatt
 *
 * ─── AVRUNDNING ─────────────────────────────────────────────────────────────
 *
 *   Math.round() till hela kronor på bolagsskatt och schablonintäkt.
 *   Pfond max: Math.floor (konservativ, kan inte avsätta mer än tillåtet).
 *
 * ─── AVVIKELSER FRÅN SPEC ───────────────────────────────────────────────────
 *
 *   Case 7: Spec angav bolagsskatt: 206000.
 *     Korrekt: aterforing (50000) + schablonintäkt (7650) adderas.
 *     bolagsskatt = round(1057650 × 0.206) = 217877.
 *
 *   Case 8: Spec angav skattepliktig_vinst: 600000, bolagsskatt: 123600.
 *     Korrekt: schablonintäkt på IB 180000 × 0.0255 = 4590 adderas.
 *     skattepliktig_vinst = 604590, bolagsskatt = 124546.
 *
 *   Case 9: Spec angav resultat_efter_skatt: 395162.
 *     Korrekt: resultat = adj − bolagsskatt = 508925 − 104838 = 404087.
 *     Spec beräknade 500000 − 104838 (glömde schablonintäkten).
 *
 *   Motivering: BERÄKNINGSORDNINGEN i spec-promten är explicit (steg 1−2).
 *   Case 12 (som spec markerade som "svårast") visar korrekt ordning.
 *
 * ─── INDATA ─────────────────────────────────────────────────────────────────
 *
 *   befintliga_fonder kodas som JSON-sträng (SkillInput stöder ej arrayer).
 *   calculate.ts parsar med JSON.parse().
 */

import type { GoldenCase } from '../framework.js';

export const BOLAGSSKATT_CASES: GoldenCase[] = [

  // ── Case 1: Grundfall — 500k vinst, inga avdrag ──────────────────────────
  {
    name: '500k vinst, inga avdrag',
    description: 'Standardfall. Full bolagsskatt 20.6% på 500 000 kr.',
    input: {
      taxable_profit: 500_000,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.skattepliktig_vinst',
        expected: 500_000,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: 'Inga avdrag → 500000',
      },
      {
        field: 'result.bolagsskatt',
        expected: 103_000,       // HANDBERÄKNAT: round(500000 × 0.206) = 103000
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '500000 × 0.206 = 103000',
      },
      {
        field: 'result.resultat_efter_skatt',
        expected: 397_000,       // HANDBERÄKNAT: 500000 − 103000 = 397000
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '500000 − 103000 = 397000',
      },
    ],
  },

  // ── Case 2: 1M vinst, inga avdrag ────────────────────────────────────────
  {
    name: '1M vinst, inga avdrag',
    description: 'Full bolagsskatt 20.6% på 1 000 000 kr.',
    input: {
      taxable_profit: 1_000_000,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.bolagsskatt',
        expected: 206_000,       // HANDBERÄKNAT: round(1000000 × 0.206) = 206000
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '1000000 × 0.206 = 206000',
      },
      {
        field: 'result.resultat_efter_skatt',
        expected: 794_000,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '1000000 − 206000 = 794000',
      },
    ],
  },

  // ── Case 3: Noll vinst ────────────────────────────────────────────────────
  {
    name: 'Noll vinst',
    description: 'Taxable profit = 0. Ingen skatt.',
    input: {
      taxable_profit: 0,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.skattepliktig_vinst',
        expected: 0,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '0 → 0',
      },
      {
        field: 'result.bolagsskatt',
        expected: 0,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '0 × 0.206 = 0',
      },
    ],
  },

  // ── Case 4: Förlust ───────────────────────────────────────────────────────
  {
    name: 'Förlust − 200k (rullas)',
    description:
      'Negativt resultat → bolagsskatt = 0. ' +
      'Underskottet rullas till nästa år (IL 40 kap).',
    input: {
      taxable_profit: -200_000,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.skattepliktig_vinst',
        expected: 0,             // max(0, −200000) = 0
        tolerance: 0,
        source: 'IL 65 kap 10 § — negativt underlag ger noll skatt',
        formula: 'max(0, −200000) = 0',
      },
      {
        field: 'result.bolagsskatt',
        expected: 0,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '0 × 0.206 = 0',
      },
      {
        field: 'result.resultat_efter_skatt',
        expected: -200_000,      // Ekonomiskt resultat, kan vara negativt
        tolerance: 0,
        source: 'IL 40 kap — underskott rullas',
        formula: '−200000 − 0 = −200000',
      },
      {
        field: 'result.underskott_att_rulla',
        expected: 200_000,       // HANDBERÄKNAT: −(−200000) = 200000
        tolerance: 0,
        source: 'IL 40 kap',
        formula: '|−200000| = 200000',
      },
    ],
  },

  // ── Case 5: Periodiseringsfond — max avsättning 25% ──────────────────────
  {
    name: 'Pfond: max avsättning 25% av 1M',
    description:
      '1M vinst, avsätter 250k (= exakt 25%). ' +
      'Bolagsskatt på 750k. Skatteeffekt = uppskjuten skatt på 250k.',
    input: {
      taxable_profit: 1_000_000,
      periodiseringsfond_avsattning: 250_000,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.periodiseringsfond_avdrag',
        expected: 250_000,       // Exakt 25% → accepterat
        tolerance: 0,
        source: 'IL 30 kap 5 §',
        formula: '25% × 1000000 = 250000',
      },
      {
        field: 'result.skattepliktig_vinst',
        expected: 750_000,       // HANDBERÄKNAT: 1000000 − 250000 = 750000
        tolerance: 0,
        source: 'IL 30 kap 5 §',
        formula: '1000000 − 250000 = 750000',
      },
      {
        field: 'result.bolagsskatt',
        expected: 154_500,       // HANDBERÄKNAT: round(750000 × 0.206) = 154500
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '750000 × 0.206 = 154500',
      },
      {
        field: 'result.skatteeffekt_pfond',
        expected: 51_500,        // HANDBERÄKNAT: round(250000 × 0.206) = 51500
        tolerance: 0,
        source: 'IL 30 kap 5 § — uppskjuten skatt',
        formula: '250000 × 0.206 = 51500',
      },
    ],
  },

  // ── Case 6: Periodiseringsfond — överstiger 25%, cappas ─────────────────
  {
    name: 'Pfond: 300k begärs, cappas till 250k (25%)',
    description:
      '1M vinst, begär 300k men max är 25% = 250k. ' +
      'Skill ska cappa och ge warning.',
    input: {
      taxable_profit: 1_000_000,
      periodiseringsfond_avsattning: 300_000,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.periodiseringsfond_avdrag',
        expected: 250_000,       // HANDBERÄKNAT: floor(1000000 × 0.25) = 250000. Cappad från 300000.
        tolerance: 0,
        source: 'IL 30 kap 5 § — max 25% av överskott',
        formula: 'min(300000, floor(1000000 × 0.25)) = min(300000, 250000) = 250000',
      },
      {
        field: 'result.skattepliktig_vinst',
        expected: 750_000,
        tolerance: 0,
        source: 'IL 30 kap 5 §',
        formula: '1000000 − 250000 = 750000',
      },
      {
        field: 'result.bolagsskatt',
        expected: 154_500,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '750000 × 0.206 = 154500',
      },
    ],
  },

  // ── Case 7: 6 fonder redan — ingen ny avsättning ─────────────────────────
  {
    name: 'Pfond: 6 fonder befintliga → ingen ny avsättning',
    description:
      '6 periodiseringsfonder befintliga (räknade FÖRE återföring — konservativ tolkning). ' +
      'Max-antal uppnått → periodiseringsfond_avdrag = 0. ' +
      '2020-fonden återförs obligatoriskt (år 6). ' +
      'OBS: Spec angav bolagsskatt 206000 (glömde aterforing + schablonintäkt). ' +
      'Korrekt: aterforing=50000 + schablonintäkt=7650 adderas till adj.',
    input: {
      taxable_profit: 1_000_000,
      periodiseringsfond_avsattning: 100_000,
      befintliga_fonder: '[{"year":2020,"amount":50000},{"year":2021,"amount":50000},{"year":2022,"amount":50000},{"year":2023,"amount":50000},{"year":2024,"amount":50000},{"year":2025,"amount":50000}]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.periodiseringsfond_avdrag',
        expected: 0,             // Max-antal uppnått (6 st FÖRE recovery)
        tolerance: 0,
        source: 'IL 30 kap 7 § — max 6 fonder',
        formula: 'count(befintliga) = 6 ≥ PFOND_MAX_ANTAL → ingen ny',
      },
      {
        field: 'result.aterforing',
        expected: 50_000,        // HANDBERÄKNAT: 2020-fonden ≥ 6 år (2026−2020=6) → återförs
        tolerance: 0,
        source: 'IL 30 kap 7 § — återföring efter 6 år',
        formula: '2026 − 2020 = 6 ≥ PFOND_MAX_AR → aterforing = 50000',
      },
      {
        field: 'result.schablonintakt',
        expected: 7_650,         // HANDBERÄKNAT: 300000 × 0.0255 = 7650 (IB = alla 6 fonder)
        tolerance: 0,
        source: 'IL 30 kap 6a §, statslåneränta 2.55%',
        formula: '(50000×6) × 0.0255 = 300000 × 0.0255 = 7650',
      },
      {
        field: 'result.bolagsskatt',
        expected: 217_876,       // HANDBERÄKNAT: round(1057650 × 0.206) = round(217875.9) = 217876
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: 'round(1057650 × 0.206) = round(217875.9) = 217876',
      },
    ],
  },

  // ── Case 8: Fond återförs obligatoriskt (>6 år) ───────────────────────────
  {
    name: 'Återföring av fond >6 år',
    description:
      '2019-fond obligatorisk återföring (2026−2019=7 > 6). ' +
      '2023-fond kvar (3 år). ' +
      'Schablonintäkt på IB = (100000+80000) × 0.0255 = 4590. ' +
      'OBS: Spec angav skattepliktig_vinst=600000 (glömde schablonintäkten). ' +
      'Korrekt: 500000 + 100000 + 4590 = 604590.',
    input: {
      taxable_profit: 500_000,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[{"year":2019,"amount":100000},{"year":2023,"amount":80000}]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.aterforing',
        expected: 100_000,       // HANDBERÄKNAT: 2019-fond, 7 år > 6 → återförs
        tolerance: 0,
        source: 'IL 30 kap 7 §',
        formula: '2026 − 2019 = 7 ≥ PFOND_MAX_AR → aterforing = 100000',
      },
      {
        field: 'result.schablonintakt',
        expected: 4_590,         // HANDBERÄKNAT: IB=(100000+80000)=180000. round(180000 × 0.0255) = 4590
        tolerance: 0,
        source: 'IL 30 kap 6a §, statslåneränta 2.55%',
        formula: '(100000+80000) × 0.0255 = 180000 × 0.0255 = 4590',
      },
      {
        field: 'result.skattepliktig_vinst',
        expected: 604_590,       // HANDBERÄKNAT: 500000 + 100000 + 4590 = 604590
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '500000 + 100000 + 4590 = 604590',
      },
      {
        field: 'result.bolagsskatt',
        expected: 124_546,       // HANDBERÄKNAT: round(604590 × 0.206) = round(124545.54) = 124546
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: 'round(604590 × 0.206) = round(124545.54) = 124546',
      },
    ],
  },

  // ── Case 9: Schablonintäkt på befintliga fonder ────────────────────────────
  {
    name: 'Schablonintäkt på fonder (IL 30 kap 6a §)',
    description:
      'Fonder [2023:200000, 2024:150000] ger schablonintäkt 350000×0.0255=8925. ' +
      'OBS: Spec angav resultat_efter_skatt=395162 (= 500000−104838). ' +
      'Korrekt: adj=508925 → resultat=508925−104838=404087.',
    input: {
      taxable_profit: 500_000,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[{"year":2023,"amount":200000},{"year":2024,"amount":150000}]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.schablonintakt',
        expected: 8_925,         // HANDBERÄKNAT: (200000+150000) × 0.0255 = 350000 × 0.0255 = 8925
        tolerance: 0,
        source: 'IL 30 kap 6a §, statslåneränta 2.55%',
        formula: '350000 × 0.0255 = 8925',
      },
      {
        field: 'result.skattepliktig_vinst',
        expected: 508_925,       // HANDBERÄKNAT: 500000 + 8925 = 508925
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '500000 + 8925 = 508925',
      },
      {
        field: 'result.bolagsskatt',
        expected: 104_839,       // HANDBERÄKNAT: round(508925 × 0.206) = round(104838.55) = 104839
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: 'round(508925 × 0.206) = round(104838.55) = 104839',
      },
      {
        field: 'result.resultat_efter_skatt',
        expected: 404_086,       // HANDBERÄKNAT: 508925 − 104839 = 404086
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '508925 − 104839 = 404086',
      },
    ],
  },

  // ── Case 10: Underskottsavdrag ─────────────────────────────────────────────
  {
    name: 'Underskottsavdrag: 300k kvittas mot 500k vinst',
    description:
      'Underskott 300k från föregående år. Kvittas fullt mot 500k vinst. ' +
      'Skatt på kvarvarande 200k.',
    input: {
      taxable_profit: 500_000,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 300_000,
    },
    assertions: [
      {
        field: 'result.underskottsavdrag',
        expected: 300_000,       // Hela underskottet ryms mot 500k
        tolerance: 0,
        source: 'IL 40 kap',
        formula: 'min(300000, 500000) = 300000',
      },
      {
        field: 'result.skattepliktig_vinst',
        expected: 200_000,       // HANDBERÄKNAT: 500000 − 300000 = 200000
        tolerance: 0,
        source: 'IL 40 kap + IL 65 kap 10 §',
        formula: '500000 − 300000 = 200000',
      },
      {
        field: 'result.bolagsskatt',
        expected: 41_200,        // HANDBERÄKNAT: round(200000 × 0.206) = 41200
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '200000 × 0.206 = 41200',
      },
      {
        field: 'result.resultat_efter_skatt',
        expected: 158_800,       // HANDBERÄKNAT: 200000 − 41200 = 158800
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '200000 − 41200 = 158800',
      },
    ],
  },

  // ── Case 11: Underskott STÖRRE än vinst ────────────────────────────────────
  {
    name: 'Underskott 500k > vinst 200k (rest rullas)',
    description:
      'Underskott 500k men bara 200k vinst. ' +
      'Avdraget cappas till 200k. Rest 300k rullas vidare.',
    input: {
      taxable_profit: 200_000,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 500_000,
    },
    assertions: [
      {
        field: 'result.underskottsavdrag',
        expected: 200_000,       // HANDBERÄKNAT: min(500000, 200000) = 200000
        tolerance: 0,
        source: 'IL 40 kap — avdrag max = current adj',
        formula: 'min(500000, 200000) = 200000',
      },
      {
        field: 'result.skattepliktig_vinst',
        expected: 0,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '200000 − 200000 = 0',
      },
      {
        field: 'result.bolagsskatt',
        expected: 0,
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '0 × 0.206 = 0',
      },
      {
        field: 'result.kvarvarande_underskott',
        expected: 300_000,       // HANDBERÄKNAT: 500000 − 200000 = 300000
        tolerance: 0,
        source: 'IL 40 kap — resterande underskott rullas',
        formula: '500000 − 200000 = 300000',
      },
    ],
  },

  // ── Case 12: Kombinerat — alla regler ─────────────────────────────────────
  {
    name: 'Kombinerat: vinst + pfond + underskott + återföring + schablon',
    description:
      '1M vinst. Fonder: [2019:100000, 2024:200000]. Underskott: 150000. Pfond: 200000. ' +
      'Steg 1: Återföring 2019-fond = 100000. ' +
      'Steg 2: Schablonintäkt IB=(100000+200000)=300000 × 0.0255 = 7650. ' +
      'Steg 3: adj=1107650. Underskott=150000. adj=957650. ' +
      'Steg 4: max_pfond=floor(957650×0.25)=239412. Begärd=200000<239412 → OK. ' +
      'Steg 5: adj=757650. Bolagsskatt=round(757650×0.206)=round(156075.9)=156076.',
    input: {
      taxable_profit: 1_000_000,
      periodiseringsfond_avsattning: 200_000,
      befintliga_fonder: '[{"year":2019,"amount":100000},{"year":2024,"amount":200000}]',
      underskott_foregaende_ar: 150_000,
    },
    assertions: [
      {
        field: 'result.aterforing',
        expected: 100_000,       // HANDBERÄKNAT: 2019-fond återförs (2026−2019=7≥6)
        tolerance: 0,
        source: 'IL 30 kap 7 §',
        formula: '2026 − 2019 = 7 ≥ 6 → aterforing = 100000',
      },
      {
        field: 'result.schablonintakt',
        expected: 7_650,         // HANDBERÄKNAT: IB=(100000+200000)=300000. round(300000×0.0255)=7650
        tolerance: 0,
        source: 'IL 30 kap 6a §, statslåneränta 2.55%',
        formula: '300000 × 0.0255 = 7650',
      },
      {
        field: 'result.underskottsavdrag',
        expected: 150_000,
        tolerance: 0,
        source: 'IL 40 kap',
        formula: 'min(150000, 1107650) = 150000',
      },
      {
        field: 'result.periodiseringsfond_avdrag',
        expected: 200_000,       // 200000 < max(239412) → OK
        tolerance: 0,
        source: 'IL 30 kap 5 §',
        formula: 'min(200000, floor(957650×0.25)) = min(200000, 239412) = 200000',
      },
      {
        field: 'result.skattepliktig_vinst',
        expected: 757_650,       // HANDBERÄKNAT: 957650 − 200000 = 757650
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '957650 − 200000 = 757650',
      },
      {
        field: 'result.bolagsskatt',
        expected: 156_076,       // HANDBERÄKNAT: round(757650 × 0.206) = round(156075.9) = 156076
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: 'round(757650 × 0.206) = round(156075.9) = 156076',
      },
      {
        field: 'result.resultat_efter_skatt',
        expected: 601_574,       // HANDBERÄKNAT: 757650 − 156076 = 601574
        tolerance: 0,
        source: 'IL 65 kap 10 §',
        formula: '757650 − 156076 = 601574',
      },
    ],
  },

  // ── Case 13: Precisionskontroll — 1 kr vinst ─────────────────────────────
  {
    name: 'Precisionskontroll: 1 kr vinst',
    description:
      '1 × 0.206 = 0.206 → Math.round(0.206) = 0. ' +
      'Bolagsskatt = 0 (avrundas ned).',
    input: {
      taxable_profit: 1,
      periodiseringsfond_avsattning: 0,
      befintliga_fonder: '[]',
      underskott_foregaende_ar: 0,
    },
    assertions: [
      {
        field: 'result.bolagsskatt',
        expected: 0,             // HANDBERÄKNAT: round(1 × 0.206) = round(0.206) = 0
        tolerance: 0,
        source: 'IL 65 kap 10 § — Math.round(0.206) = 0',
        formula: 'round(1 × 0.206) = 0',
      },
    ],
  },
];
