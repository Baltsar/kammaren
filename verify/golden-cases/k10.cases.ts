/**
 * verify/golden-cases/k10.cases.ts
 *
 * Handberäknade golden cases för K10 gränsbeloppsberäkning.
 * GUARDRAILS regel 2: cases skrivs FÖRE implementationen.
 *
 * ─── K10 / 3:12-REGLER 2026 (Prop. 2025/26:1) — ADDITIV FORMEL ──────────────
 *
 *   IBB för 3:12 = IBB 2025 = 80 600 kr (IL 57 kap 4 §)
 *   Grundbelopp = 4 × IBB × ägarandel (IL 57 kap 11 §) — ersätter förenklingsregeln
 *   Kapitalbaserat = anskaffningsvärde × ägarandel × (SLR + 9%) = × 11.55% (IL 57 kap 12 §)
 *   Lönespärr = 8 × IBB = 644 800 kr (IL 57 kap 16 §)
 *   Lönebaserat = 50% × max(0, löner − spärr), max 50 × ägarens lön (IL 57:16)
 *   4%-spärr: ägarandel < 4% → inget lönebaserat (IL 57:16)
 *
 *   GRÄNSBELOPP (ADDITIV) = grundbelopp + kapitalbaserat + lönebaserat + sparat
 *
 * ─── UPPRÄKNING SLOPAD 2026 ──────────────────────────────────────────────────
 *
 *   UPPRAKNINGSFAKTOR = 0. Sparat utrymme förs över nominellt (ingen uppräkning).
 *   Källa: tax-constants-2026.ts: "Uppräkningsränta: SLOPAD från 2026."
 *
 *   OBS: Prop. handberäkningar i specen använde 5.55% uppräkning — AVVIKELSE.
 *   Korrekt: 0% per auktoritativ källa.
 *   Berörda cases: 4 (sparat 200k → 200 000, ej 211 100) och 7 (100k → 100 000, ej 105 550).
 *
 * ─── AVVIKELSE FRÅN GAMMAL LOGIK ─────────────────────────────────────────────
 *
 *   Gammal logik (2025): max(förenklingsregel, omkostnadsbelopp + lönebaserat)
 *   Ny logik (2026):     grundbelopp + kapitalbaserat + lönebaserat + sparat (ADDITIV)
 *
 *   Ny i result: grundbelopp, kapitalbaserat
 *   Borttaget ur result: forenklingsregel, omkostnadsbelopp, huvudregel_total,
 *                         anvand_forenkling, vald_regel
 *
 * ─── FORMLER ─────────────────────────────────────────────────────────────────
 *
 *   grundbelopp        = round(FORENKLING_BELOPP × agarandel_decimal)
 *   omk                = round(anskaffningsvarde × agarandel_decimal)
 *   kapitalbaserat     = round(omk × 0.1155)      [SLR 2.55% + 9%]
 *   lonebaserat_underlag = max(0, total_lonesumma − 644 800)
 *   lonebaserat_fore_tak = round(lonebaserat_underlag × 0.50)
 *   tak_50x            = 50 × eigen_lon
 *   lonebaserat        = min(lonebaserat_fore_tak, tak_50x)
 *                        (= 0 om ägarandel < 4%)
 *   sparat_uppraknat   = round(sparat_utrymme × (1 + 0))  = sparat_utrymme
 *   gransbelopp        = grundbelopp + kapitalbaserat + lonebaserat + sparat_uppraknat
 *
 * ─── AVRUNDNING ─────────────────────────────────────────────────────────────
 *
 *   Math.round() till hela kronor per steg.
 *   Nyckelavrundar: round(25000 × 0.1155) = round(2887.5) = 2 888
 *
 * ─── RESULT-FÄLT ─────────────────────────────────────────────────────────────
 *
 *   grundbelopp, kapitalbaserat,
 *   lonebaserat_underlag, lonebaserat_fore_tak, tak_50x, lonebaserat,
 *   sparat_uppraknat, gransbelopp
 */

import type { GoldenCase } from '../framework.js';

export const K10_CASES: GoldenCase[] = [

  // ── Case 1: Grundbelopp + kapitalbaserat, inga löner ───────────────────
  {
    name: 'Grundfall: 25k anskaffning, 100%, inga löner, inget sparat',
    description:
      'Standardfall nystartat AB. Grundbelopp = 322 400. ' +
      'Kapitalbaserat = round(25 000 × 0.1155) = round(2 887.5) = 2 888. ' +
      'Gränsbelopp = 322 400 + 2 888 = 325 288.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 100,
      total_lonesumma: 0,
      eigen_lon: 0,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.grundbelopp',
        expected: 322_400,          // HANDBERÄKNAT: 322 400 × 1.00 = 322 400
        tolerance: 0,
        source: 'IL 57 kap 11 §, Prop. 2025/26:1',
        formula: '322 400 × 1.00 = 322 400',
      },
      {
        field: 'result.kapitalbaserat',
        expected: 2_888,             // HANDBERÄKNAT: round(25 000 × 1.00 × 0.1155) = round(2 887.5) = 2 888
        tolerance: 0,
        source: 'IL 57 kap 12 §, Prop. 2025/26:1',
        formula: 'round(25 000 × 1.00 × 0.1155) = round(2 887.5) = 2 888',
      },
      {
        field: 'result.lonebaserat',
        expected: 0,
        tolerance: 0,
        source: 'IL 57 kap 16 § — inga löner',
        formula: 'total_lonesumma=0 → lonebaserat=0',
      },
      {
        field: 'result.gransbelopp',
        expected: 325_288,           // HANDBERÄKNAT: 322 400 + 2 888 + 0 + 0 = 325 288
        tolerance: 0,
        source: 'IL 57 kap 11-12 §, Prop. 2025/26:1',
        formula: '322 400 + 2 888 + 0 + 0 = 325 288',
      },
    ],
  },

  // ── Case 2: Höga löner — lönebaserat dominerar ─────────────────────────
  {
    name: 'Höga löner: 1.5M lönesumma, 660k ägarens lön',
    description:
      'Löner 1 500k > spärr 644 800. Lönebaserat = (1 500 000 − 644 800) × 0.50 = 427 600. ' +
      'Tak 50 × 660 000 = 33M → ej bindande. ' +
      'Gränsbelopp = 322 400 + 2 888 + 427 600 = 752 888.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 100,
      total_lonesumma: 1_500_000,
      eigen_lon: 660_000,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.grundbelopp',
        expected: 322_400,
        tolerance: 0,
        source: 'IL 57 kap 11 §',
        formula: '322 400 × 1.00 = 322 400',
      },
      {
        field: 'result.kapitalbaserat',
        expected: 2_888,
        tolerance: 0,
        source: 'IL 57 kap 12 §',
        formula: 'round(25 000 × 0.1155) = 2 888',
      },
      {
        field: 'result.lonebaserat_underlag',
        expected: 855_200,           // HANDBERÄKNAT: 1 500 000 − 644 800 = 855 200
        tolerance: 0,
        source: 'IL 57 kap 16 §',
        formula: '1 500 000 − 644 800 = 855 200',
      },
      {
        field: 'result.lonebaserat',
        expected: 427_600,           // HANDBERÄKNAT: 855 200 × 0.50 = 427 600 (tak 33M → ej bindande)
        tolerance: 0,
        source: 'IL 57 kap 16 §',
        formula: '855 200 × 0.50 = 427 600',
      },
      {
        field: 'result.gransbelopp',
        expected: 752_888,           // HANDBERÄKNAT: 322 400 + 2 888 + 427 600 + 0 = 752 888
        tolerance: 0,
        source: 'IL 57 kap 11-16 §, Prop. 2025/26:1',
        formula: '322 400 + 2 888 + 427 600 + 0 = 752 888',
      },
    ],
  },

  // ── Case 3: Lönesumma strax över spärr (integrationsscenario) ──────────
  {
    name: 'Löner strax över spärr (660k): lönebaserat 7 600',
    description:
      'Integrationsscenario: total_lonesumma=660 000, eigen_lon=660 000. ' +
      'Underlag = 660 000 − 644 800 = 15 200. ' +
      'Lönebaserat = round(15 200 × 0.50) = 7 600. Tak 50 × 660 000 = 33M ej bindande. ' +
      'Gränsbelopp = 322 400 + 2 888 + 7 600 = 332 888.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 100,
      total_lonesumma: 660_000,
      eigen_lon: 660_000,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.lonebaserat_underlag',
        expected: 15_200,            // HANDBERÄKNAT: 660 000 − 644 800 = 15 200
        tolerance: 0,
        source: 'IL 57 kap 16 §',
        formula: '660 000 − 644 800 = 15 200',
      },
      {
        field: 'result.lonebaserat',
        expected: 7_600,             // HANDBERÄKNAT: round(15 200 × 0.50) = 7 600
        tolerance: 0,
        source: 'IL 57 kap 16 §',
        formula: 'round(15 200 × 0.50) = 7 600',
      },
      {
        field: 'result.gransbelopp',
        expected: 332_888,           // HANDBERÄKNAT: 322 400 + 2 888 + 7 600 + 0 = 332 888
        tolerance: 0,
        source: 'IL 57 kap 11-16 §',
        formula: '322 400 + 2 888 + 7 600 + 0 = 332 888',
      },
    ],
  },

  // ── Case 4: Sparat utrymme — nominellt (ingen uppräkning) ──────────────
  {
    name: 'Sparat utrymme 200k (UPPRAKNINGSFAKTOR=0, slopad 2026)',
    description:
      'Sparat 200k förs över nominellt. UPPRAKNINGSFAKTOR = 0 fr.o.m. 2026. ' +
      'OBS: Spec angav 211 100 (5.55%). Korrekt: 200 000 (0%). ' +
      'Källa: tax-constants-2026.ts: "Uppräkningsränta: SLOPAD från 2026." ' +
      'Gränsbelopp = 322 400 + 2 888 + 0 + 200 000 = 525 288.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 100,
      total_lonesumma: 0,
      eigen_lon: 0,
      sparat_utrymme: 200_000,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.sparat_uppraknat',
        expected: 200_000,           // HANDBERÄKNAT: 200 000 × (1 + 0) = 200 000 (nominellt)
        tolerance: 0,
        source: 'IL 57 kap 10 §, Prop. 2025/26:1 — uppräkning slopad',
        formula: '200 000 × (1 + 0%) = 200 000 (nominellt)',
      },
      {
        field: 'result.grundbelopp',
        expected: 322_400,
        tolerance: 0,
        source: 'IL 57 kap 11 §',
        formula: '322 400 × 1.00 = 322 400',
      },
      {
        field: 'result.kapitalbaserat',
        expected: 2_888,
        tolerance: 0,
        source: 'IL 57 kap 12 §',
        formula: 'round(25 000 × 0.1155) = 2 888',
      },
      {
        field: 'result.gransbelopp',
        expected: 525_288,           // HANDBERÄKNAT: 322 400 + 2 888 + 0 + 200 000 = 525 288
        tolerance: 0,
        source: 'IL 57 kap 10-12 §',
        formula: '322 400 + 2 888 + 0 + 200 000 = 525 288',
      },
    ],
  },

  // ── Case 5: 50x-tak begränsar lönebaserat ─────────────────────────────
  {
    name: '50x-tak är bindande: 10k ägarens lön, 2M total lönesumma',
    description:
      'Lönebaserat före tak = (2 000 000 − 644 800) × 0.50 = 677 600. ' +
      'Tak = 50 × 10 000 = 500 000 < 677 600 → cappat. ' +
      'Gränsbelopp = 322 400 + 2 888 + 500 000 = 825 288.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 100,
      total_lonesumma: 2_000_000,
      eigen_lon: 10_000,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.lonebaserat_fore_tak',
        expected: 677_600,           // HANDBERÄKNAT: (2 000 000 − 644 800) × 0.50 = 1 355 200 × 0.50 = 677 600
        tolerance: 0,
        source: 'IL 57 kap 16 §',
        formula: '(2 000 000 − 644 800) × 0.50 = 677 600',
      },
      {
        field: 'result.tak_50x',
        expected: 500_000,           // HANDBERÄKNAT: 50 × 10 000 = 500 000
        tolerance: 0,
        source: 'IL 57 kap 16 § — max 50 × ägarens lön',
        formula: '50 × 10 000 = 500 000',
      },
      {
        field: 'result.lonebaserat',
        expected: 500_000,           // HANDBERÄKNAT: min(677 600, 500 000) = 500 000 (tak bindande)
        tolerance: 0,
        source: 'IL 57 kap 16 §',
        formula: 'min(677 600, 500 000) = 500 000',
      },
      {
        field: 'result.gransbelopp',
        expected: 825_288,           // HANDBERÄKNAT: 322 400 + 2 888 + 500 000 + 0 = 825 288
        tolerance: 0,
        source: 'IL 57 kap 11-16 §',
        formula: '322 400 + 2 888 + 500 000 + 0 = 825 288',
      },
    ],
  },

  // ── Case 6: 4%-spärr — ägarandel 3% ──────────────────────────────────
  {
    name: '4%-spärr: ägarandel 3% → inget lönebaserat',
    description:
      '3% < 4%-spärren. Lönebaserat = 0 oavsett lönesumma. ' +
      'Grundbelopp = round(322 400 × 0.03) = 9 672. ' +
      'Kapitalbaserat = round(25 000 × 0.03 × 0.1155) = round(86.625) = 87. ' +
      'Gränsbelopp = 9 672 + 87 = 9 759.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 3,
      total_lonesumma: 2_000_000,
      eigen_lon: 500_000,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.grundbelopp',
        expected: 9_672,             // HANDBERÄKNAT: round(322 400 × 0.03) = round(9 672.0) = 9 672
        tolerance: 0,
        source: 'IL 57 kap 11 §',
        formula: 'round(322 400 × 0.03) = 9 672',
      },
      {
        field: 'result.kapitalbaserat',
        expected: 87,                // HANDBERÄKNAT: round(round(25 000 × 0.03) × 0.1155) = round(750 × 0.1155) = round(86.625) = 87
        tolerance: 0,
        source: 'IL 57 kap 12 §',
        formula: 'round(750 × 0.1155) = round(86.625) = 87',
      },
      {
        field: 'result.lonebaserat',
        expected: 0,                 // HANDBERÄKNAT: 4%-spärr → 0
        tolerance: 0,
        source: 'IL 57 kap 16 § — ägarandel < 4%',
        formula: '3% < 4% → lonebaserat = 0',
      },
      {
        field: 'result.gransbelopp',
        expected: 9_759,             // HANDBERÄKNAT: 9 672 + 87 + 0 + 0 = 9 759
        tolerance: 0,
        source: 'IL 57 kap 11-16 §',
        formula: '9 672 + 87 + 0 + 0 = 9 759',
      },
    ],
  },

  // ── Case 7: Delat ägande 50/50 — med sparat ───────────────────────────
  {
    name: 'Delat ägande 50% med sparat 100k (nominellt)',
    description:
      'Ägarandel 50%. Grundbelopp = round(322 400 × 0.50) = 161 200. ' +
      'Kapitalbaserat = round(round(25 000 × 0.50) × 0.1155) = round(12 500 × 0.1155) = round(1 443.75) = 1 444. ' +
      'Lönebaserat = (1 000 000 − 644 800) × 0.50 = 177 600. Tak 25M ej bindande. ' +
      'Sparat = 100 000 (nominellt, 0% uppräkning). ' +
      'OBS: Spec angav sparat 105 550 (5.55%). Korrekt: 100 000 (0%). ' +
      'Gränsbelopp = 161 200 + 1 444 + 177 600 + 100 000 = 440 244.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 50,
      total_lonesumma: 1_000_000,
      eigen_lon: 500_000,
      sparat_utrymme: 100_000,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.grundbelopp',
        expected: 161_200,           // HANDBERÄKNAT: round(322 400 × 0.50) = 161 200
        tolerance: 0,
        source: 'IL 57 kap 11 §',
        formula: 'round(322 400 × 0.50) = 161 200',
      },
      {
        field: 'result.kapitalbaserat',
        expected: 1_444,             // HANDBERÄKNAT: round(round(25 000 × 0.50) × 0.1155) = round(1 443.75) = 1 444
        tolerance: 0,
        source: 'IL 57 kap 12 §',
        formula: 'round(12 500 × 0.1155) = round(1 443.75) = 1 444',
      },
      {
        field: 'result.sparat_uppraknat',
        expected: 100_000,           // HANDBERÄKNAT: 100 000 × (1 + 0) = 100 000 (nominellt)
        tolerance: 0,
        source: 'IL 57 kap 10 §, uppräkning slopad 2026',
        formula: '100 000 × (1 + 0%) = 100 000',
      },
      {
        field: 'result.lonebaserat',
        expected: 177_600,           // HANDBERÄKNAT: (1 000 000 − 644 800) × 0.50 = 355 200 × 0.50 = 177 600
        tolerance: 0,
        source: 'IL 57 kap 16 §',
        formula: '(1 000 000 − 644 800) × 0.50 = 177 600',
      },
      {
        field: 'result.gransbelopp',
        expected: 440_244,           // HANDBERÄKNAT: 161 200 + 1 444 + 177 600 + 100 000 = 440 244
        tolerance: 0,
        source: 'IL 57 kap 10-16 §',
        formula: '161 200 + 1 444 + 177 600 + 100 000 = 440 244',
      },
    ],
  },

  // ── Case 8: Högt anskaffningsvärde 500k — stor kapitalbaserat ──────────
  {
    name: 'Högt anskaffningsvärde 500k: kapitalbaserat 57 750',
    description:
      'anskaffningsvärde 500k, 100%. ' +
      'Kapitalbaserat = round(500 000 × 0.1155) = round(57 750) = 57 750. ' +
      'Gäller hela beloppet — ingen tröskel i ny formel. ' +
      'Gränsbelopp = 322 400 + 57 750 + 0 + 0 = 380 150.',
    input: {
      anskaffningsvarde: 500_000,
      agarandel_procent: 100,
      total_lonesumma: 0,
      eigen_lon: 0,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.kapitalbaserat',
        expected: 57_750,            // HANDBERÄKNAT: round(500 000 × 0.1155) = round(57 750) = 57 750
        tolerance: 0,
        source: 'IL 57 kap 12 §, Prop. 2025/26:1',
        formula: 'round(500 000 × 1.00 × 0.1155) = 57 750',
      },
      {
        field: 'result.grundbelopp',
        expected: 322_400,
        tolerance: 0,
        source: 'IL 57 kap 11 §',
        formula: '322 400 × 1.00 = 322 400',
      },
      {
        field: 'result.gransbelopp',
        expected: 380_150,           // HANDBERÄKNAT: 322 400 + 57 750 + 0 + 0 = 380 150
        tolerance: 0,
        source: 'IL 57 kap 11-12 §',
        formula: '322 400 + 57 750 + 0 + 0 = 380 150',
      },
    ],
  },

  // ── Case 9: Noll ägarandel → ERROR ───────────────────────────────────
  {
    name: 'Noll ägarandel → ERROR',
    description: 'agarandel_procent = 0. Ogiltig input. Skill MÅSTE kasta Error.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 0,
      total_lonesumma: 0,
      eigen_lon: 0,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.gransbelopp',
        expected: 0,
        tolerance: 0,
        source: 'GUARDRAILS regel 10 — ingen silent degradation',
        expect_error: true,
      },
    ],
  },

  // ── Case 10: Negativ lönesumma → ERROR ───────────────────────────────
  {
    name: 'Negativ lönesumma → ERROR',
    description: 'total_lonesumma = −1. Ogiltig input. Skill MÅSTE kasta Error.',
    input: {
      anskaffningsvarde: 25_000,
      agarandel_procent: 100,
      total_lonesumma: -1,
      eigen_lon: 0,
      sparat_utrymme: 0,
      inkomstar: 2026,
    },
    assertions: [
      {
        field: 'result.gransbelopp',
        expected: 0,
        tolerance: 0,
        source: 'GUARDRAILS regel 10 — ingen silent degradation',
        expect_error: true,
      },
    ],
  },
];
