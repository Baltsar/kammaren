/**
 * verify/golden-cases/moms.cases.ts
 *
 * Handberäknade golden cases för moms skill.
 * GUARDRAILS regel 2: cases skrivs FÖRE implementationen.
 *
 * ─── MOMSSATSER 2026 (ML 7 kap 1 §) ────────────────────────────────────────
 *
 *   25%  — generell momssats                (ML 7:1 första stycket)
 *   12%  — livsmedel, hotell, restaurang    (ML 7:1 andra stycket)
 *    6%  — böcker, persontransport, kultur  (ML 7:1 tredje stycket)
 *    0%  — sjukvård, utbildning, export     (ML 3 kap)
 *
 * ─── FORMLER ────────────────────────────────────────────────────────────────
 *
 *   netto → brutto: brutto = netto × (1 + rate)
 *   brutto → netto: netto = brutto / (1 + rate)
 *   brutto → moms:  moms = brutto - netto
 *
 *   Moms av priset (SKV-benämning):
 *     25% moms = 25/125 = 20.00% av priset
 *     12% moms = 12/112 = 10.71% av priset  (SKV anger 10.74% avrundat)
 *      6% moms =  6/106 =  5.66% av priset
 *
 * ─── AVRUNDNING ─────────────────────────────────────────────────────────────
 *
 *   2 decimaler (ören). Math.round(x * 100) / 100.
 *   Moms-belopp avrundas INTE till hela kronor.
 *   Tolerans: 0.01 kr på öresbelopp.
 *
 * ─── BAS-KONTON ─────────────────────────────────────────────────────────────
 *
 *   OBS: bas_konto_utgaende returneras som TAL (2610, 2620 etc),
 *   inte sträng. Orsak: ramverkets Assertion.expected är number.
 *
 *   Utgående moms:       25% → 2610, 12% → 2620, 6% → 2630
 *   Omvänd skattskyldighet: 25% → 2614, 12% → 2624, 6% → 2634
 */

import type { GoldenCase } from '../framework.js';

export const MOMS_CASES: GoldenCase[] = [
  // ── Case 1: 25% netto → brutto ───────────────────────────────────────────
  {
    name: "25% moms: 10000 netto → brutto",
    description: "Standardfall. 25% på 10 000 kr netto.",
    input: { amount: 10000, vat_rate: 25, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.netto",
        expected: 10000,     // input
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "netto = input",
      },
      {
        field: "result.moms",
        expected: 2500,      // HANDBERÄKNAT: round2(10000 × 0.25) = 2500.00
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "10000 × 0.25 = 2500",
      },
      {
        field: "result.brutto",
        expected: 12500,     // HANDBERÄKNAT: 10000 + 2500 = 12500
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "10000 + 2500 = 12500",
      },
    ],
  },

  // ── Case 2: 25% brutto → netto ───────────────────────────────────────────
  {
    name: "25% moms: 12500 brutto → netto",
    description: "Omräkning brutto till netto. Invers av case 1.",
    input: { amount: 12500, vat_rate: 25, direction: "brutto_to_netto" },
    assertions: [
      {
        field: "result.netto",
        expected: 10000,     // HANDBERÄKNAT: round2(12500 / 1.25) = round2(10000) = 10000
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "12500 / 1.25 = 10000",
      },
      {
        field: "result.moms",
        expected: 2500,      // HANDBERÄKNAT: round2(12500 - 10000) = 2500
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "12500 - 10000 = 2500",
      },
      {
        field: "result.brutto",
        expected: 12500,     // input
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "brutto = input",
      },
    ],
  },

  // ── Case 3: 12% netto → brutto ───────────────────────────────────────────
  {
    name: "12% moms: 10000 netto → brutto",
    description: "Reducerad momssats 12% (livsmedel, hotell, restaurang).",
    input: { amount: 10000, vat_rate: 12, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.netto",
        expected: 10000,
        tolerance: 0.01,
        source: "ML 7:1 andra stycket",
        formula: "netto = input",
      },
      {
        field: "result.moms",
        expected: 1200,      // HANDBERÄKNAT: round2(10000 × 0.12) = 1200.00
        tolerance: 0.01,
        source: "ML 7:1 andra stycket",
        formula: "10000 × 0.12 = 1200",
      },
      {
        field: "result.brutto",
        expected: 11200,     // HANDBERÄKNAT: 10000 + 1200 = 11200
        tolerance: 0.01,
        source: "ML 7:1 andra stycket",
        formula: "10000 + 1200 = 11200",
      },
    ],
  },

  // ── Case 4: 6% netto → brutto ────────────────────────────────────────────
  {
    name: "6% moms: 10000 netto → brutto",
    description: "Reducerad momssats 6% (böcker, tidskrifter, persontransport, kultur).",
    input: { amount: 10000, vat_rate: 6, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.netto",
        expected: 10000,
        tolerance: 0.01,
        source: "ML 7:1 tredje stycket",
        formula: "netto = input",
      },
      {
        field: "result.moms",
        expected: 600,       // HANDBERÄKNAT: round2(10000 × 0.06) = 600.00
        tolerance: 0.01,
        source: "ML 7:1 tredje stycket",
        formula: "10000 × 0.06 = 600",
      },
      {
        field: "result.brutto",
        expected: 10600,     // HANDBERÄKNAT: 10000 + 600 = 10600
        tolerance: 0.01,
        source: "ML 7:1 tredje stycket",
        formula: "10000 + 600 = 10600",
      },
    ],
  },

  // ── Case 5: 0% moms ──────────────────────────────────────────────────────
  {
    name: "0% moms: 10000 netto → brutto",
    description: "Momsbefriad transaktion (sjukvård, utbildning, bank/finans, export).",
    input: { amount: 10000, vat_rate: 0, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.netto",
        expected: 10000,
        tolerance: 0.01,
        source: "ML 3 kap — undantagen från momsplikt",
        formula: "netto = input",
      },
      {
        field: "result.moms",
        expected: 0,         // HANDBERÄKNAT: 10000 × 0 = 0
        tolerance: 0,
        source: "ML 3 kap",
        formula: "10000 × 0 = 0",
      },
      {
        field: "result.brutto",
        expected: 10000,     // HANDBERÄKNAT: 10000 + 0 = 10000
        tolerance: 0.01,
        source: "ML 3 kap",
        formula: "10000 + 0 = 10000",
      },
    ],
  },

  // ── Case 6: 1 kr netto — precisionskontroll ören ────────────────────────
  {
    name: "25% moms: 1 kr netto (öres-precision)",
    description:
      "Moms avrundas INTE till hela kronor. " +
      "1 × 0.25 = 0.25 kr moms ska returneras som 0.25, inte 0.",
    input: { amount: 1, vat_rate: 25, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.netto",
        expected: 1,
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "netto = 1",
      },
      {
        field: "result.moms",
        expected: 0.25,      // HANDBERÄKNAT: round2(1 × 0.25) = 0.25
        tolerance: 0.01,
        source: "ML 7:1 — moms anges i ören",
        formula: "round2(1 × 0.25) = 0.25",
      },
      {
        field: "result.brutto",
        expected: 1.25,      // HANDBERÄKNAT: round2(1 + 0.25) = 1.25
        tolerance: 0.01,
        source: "ML 7:1 första stycket",
        formula: "round2(1 + 0.25) = 1.25",
      },
    ],
  },

  // ── Case 7: 99 kr brutto, 12% — avrundningskontroll ─────────────────────
  {
    name: "12% moms: 99 kr brutto → netto (avrundningskontroll)",
    description:
      "99 / 1.12 = 88.3928... → round2 = 88.39. " +
      "Moms = 99 - 88.39 = 10.61. Verifierar ören-avrundning.",
    input: { amount: 99, vat_rate: 12, direction: "brutto_to_netto" },
    assertions: [
      {
        field: "result.netto",
        expected: 88.39,     // HANDBERÄKNAT: round2(99 / 1.12) = round2(88.3928...) = 88.39
        tolerance: 0.01,
        source: "ML 7:1 andra stycket",
        formula: "round2(99 / 1.12) = round2(88.3928...) = 88.39",
      },
      {
        field: "result.moms",
        expected: 10.61,     // HANDBERÄKNAT: round2(99 - 88.39) = round2(10.61) = 10.61
        tolerance: 0.01,
        source: "ML 7:1 andra stycket",
        formula: "round2(99 - 88.39) = 10.61",
      },
      {
        field: "result.brutto",
        expected: 99,        // input
        tolerance: 0.01,
        source: "ML 7:1 andra stycket",
        formula: "brutto = input = 99",
      },
    ],
  },

  // ── Case 8: Ogiltig momssats → ERROR ─────────────────────────────────────
  {
    name: "Ogiltig momssats → ERROR",
    description:
      "Momssats 15% finns inte 2026. " +
      "Giltiga satser: 25, 12, 6, 0. Skill MÅSTE kasta Error.",
    input: { amount: 10000, vat_rate: 15, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.moms",
        expected: 0,
        tolerance: 0,
        source: "ML 7 kap — momssatser 2026: 25, 12, 6, 0",
        expect_error: true,
      },
    ],
  },

  // ── Case 9: Negativt belopp → ERROR ──────────────────────────────────────
  {
    name: "Negativt belopp → ERROR",
    description: "Negativt amount är ogiltig input. Skill MÅSTE kasta Error.",
    input: { amount: -100, vat_rate: 25, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.moms",
        expected: 0,
        tolerance: 0,
        source: "GUARDRAILS regel 10 — ingen silent degradation",
        expect_error: true,
      },
    ],
  },

  // ── Case 10: Noll belopp ──────────────────────────────────────────────────
  {
    name: "Noll belopp",
    description: "0 kr är giltigt. Netto = moms = brutto = 0.",
    input: { amount: 0, vat_rate: 25, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.netto",
        expected: 0,         // HANDBERÄKNAT: 0 × 1.25 → netto = 0
        tolerance: 0,
        source: "ML 7:1 första stycket",
        formula: "0 × 0.25 = 0",
      },
      {
        field: "result.moms",
        expected: 0,
        tolerance: 0,
        source: "ML 7:1 första stycket",
        formula: "0 × 0.25 = 0",
      },
      {
        field: "result.brutto",
        expected: 0,
        tolerance: 0,
        source: "ML 7:1 första stycket",
        formula: "0 + 0 = 0",
      },
    ],
  },

  // ── Case 11: BAS-konto 25% → 2610 ────────────────────────────────────────
  {
    name: "BAS-konton: 25% → 2610",
    description:
      "Utgående moms 25% bokförs på konto 2610 (BAS 2026). " +
      "bas_konto_utgaende returneras som tal, inte sträng.",
    input: { amount: 10000, vat_rate: 25, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.bas_konto_utgaende",
        expected: 2610,      // BAS 2026: Utgående moms 25%
        tolerance: 0,
        source: "BAS 2026 kontoplan",
      },
    ],
  },

  // ── Case 12: BAS-konto 12% → 2620 ────────────────────────────────────────
  {
    name: "BAS-konton: 12% → 2620",
    description: "Utgående moms 12% bokförs på konto 2620 (BAS 2026).",
    input: { amount: 10000, vat_rate: 12, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.bas_konto_utgaende",
        expected: 2620,      // BAS 2026: Utgående moms 12%
        tolerance: 0,
        source: "BAS 2026 kontoplan",
      },
    ],
  },

  // ── Case 13: BAS-konto 6% → 2630 ─────────────────────────────────────────
  {
    name: "BAS-konton: 6% → 2630",
    description: "Utgående moms 6% bokförs på konto 2630 (BAS 2026).",
    input: { amount: 10000, vat_rate: 6, direction: "netto_to_brutto" },
    assertions: [
      {
        field: "result.bas_konto_utgaende",
        expected: 2630,      // BAS 2026: Utgående moms 6%
        tolerance: 0,
        source: "BAS 2026 kontoplan",
      },
    ],
  },

  // ── Case 14: Omvänd skattskyldighet ──────────────────────────────────────
  {
    name: "Omvänd skattskyldighet (reverse charge)",
    description:
      "Omvänd skattskyldighet (ML 1 kap 2 §): säljaren tar ingen utgående moms. " +
      "Köparen redovisar momsen. Brutto = netto. " +
      "reverse_charge_vat = beloppet köparen ska redovisa.",
    input: {
      amount: 10000,
      vat_rate: 25,
      direction: "netto_to_brutto",
      reverse_charge: true,
    },
    assertions: [
      {
        field: "result.netto",
        expected: 10000,
        tolerance: 0.01,
        source: "ML 1 kap 2 §",
        formula: "netto = input (reverse charge)",
      },
      {
        field: "result.moms",
        expected: 0,         // HANDBERÄKNAT: säljaren fakturerar utan moms
        tolerance: 0,
        source: "ML 1 kap 2 § — köparen redovisar momsen",
        formula: "moms = 0 (reverse charge)",
      },
      {
        field: "result.brutto",
        expected: 10000,     // HANDBERÄKNAT: brutto = netto (ingen påslag)
        tolerance: 0.01,
        source: "ML 1 kap 2 §",
        formula: "brutto = netto = 10000",
      },
      {
        field: "result.reverse_charge_vat",
        expected: 2500,      // HANDBERÄKNAT: round2(10000 × 0.25) = 2500
        tolerance: 0.01,
        source: "ML 1 kap 2 §, BAS 2614",
        formula: "round2(10000 × 0.25) = 2500",
      },
      {
        field: "result.bas_konto_utgaende",
        expected: 2614,      // BAS 2026: Omvänd skattskyldighet 25%
        tolerance: 0,
        source: "BAS 2026 — konto 2614 Utgående moms omvänd skattskyldighet 25%",
      },
    ],
  },
];
