/**
 * verify/golden-cases/ag-avgifter.cases.ts
 *
 * Handberäknade golden cases för ag-avgifter skill.
 * GUARDRAILS regel 2: cases skrivs FÖRE implementationen.
 *
 * ─── PROCENTSATSER AG-AVGIFTER INKOMSTÅRET 2026 (SFL 2 kap 26 §) ────────────
 *
 *   Sjukförsäkringsavgift:          3.55%   (SFL 2 kap 26 § punkt 1)
 *   Föräldraförsäkringsavgift:      2.00%   (SFL 2 kap 26 § punkt 2)
 *   Ålderspensionsavgift:          10.21%   (SFL 2 kap 26 § punkt 3)
 *   Efterlevandepensionsavgift:     0.30%   (SFL 2 kap 26 § punkt 4)
 *   Arbetsmarknadsavgift:           2.64%   (SFL 2 kap 26 § punkt 5)
 *   Arbetsskadeavgift:              0.10%   (SFL 2 kap 26 § punkt 6)
 *   Allmän löneavgift:             12.62%   (Lag 1994:1920 om allmän löneavgift)
 *   ─────────────────────────────────────
 *   TOTAL:                         31.42%
 *
 *   Kontroll: 3.55+2.00+10.21+0.30+2.64+0.10+12.62 = 31.42 ✓
 *   Egentliga AG-avgifter (exkl allmän löneavgift): 31.42-12.62 = 18.80 ✓
 *   Källa: SKV PDF 2026-01-07, Ekosnurra, Fortnox
 *
 * ─── REDUKTIONSREGLER ───────────────────────────────────────────────────────
 *
 *   Åldersreduktion (SFL 2 kap 27 §):
 *     Fyllt 67 vid årets ingång → born 1958 eller tidigare.
 *     OBS: Åldersgräns HÖJD från 66 till 67 fr.o.m. 2026.
 *     Endast ålderspensionsavgift 10.21% kvarstår.
 *
 *   Växa-stödet (SFL 2 kap 31 §):
 *     DE TVÅ FÖRSTA anställda, max 35 000 kr/mån = 420 000 kr/år.
 *     Nedsatt till 10.21% (bara ålderspension) upp till taket.
 *     Full avgift på lön över taket.
 *
 *   Tröskelvärde:
 *     Ingen avgift om bruttolön < 1000 kr/år (SKV).
 *
 * ─── AVRUNDNING ─────────────────────────────────────────────────────────────
 *
 *   Math.round() per delpost. Total = summa av avrundade delposter.
 *   Tolerans: 1 kr på slutbelopp, 0 kr på exakta multiplar och nollor.
 *
 * ─── BREAKDOWN-INDEX ────────────────────────────────────────────────────────
 *
 *   breakdown[0] = Sjukförsäkringsavgift     (3.55%)
 *   breakdown[1] = Föräldraförsäkringsavgift (2.00%)
 *   breakdown[2] = Ålderspensionsavgift      (10.21%)
 *   breakdown[3] = Efterlevandepensionsavgift (0.30%)
 *   breakdown[4] = Arbetsmarknadsavgift      (2.64%)
 *   breakdown[5] = Arbetsskadeavgift         (0.10%)
 *   breakdown[6] = Allmän löneavgift         (12.62%)
 */

import type { GoldenCase } from '../framework.js';

export const AG_AVGIFTER_CASES: GoldenCase[] = [
  // ── Case 1: Standard 500k — full breakdown ───────────────────────────────
  {
    name: "AG standard: 500k lön",
    description: "Full arbetsgivaravgift 31.42% på bruttolön 500,000 kr. Verifierar alla 7 delposter.",
    input: { gross_salary: 500_000, birth_year: 1990, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 157_100,  // HANDBERÄKNAT: 500000 × 0.3142 = 157100.00
        tolerance: 1,
        source: "SFL 2 kap 26 §",
        formula: "500000 × 0.3142 = 157100",
      },
      {
        field: "breakdown.0.amount",
        expected: 17_750,   // HANDBERÄKNAT: 500000 × 0.0355 = 17750.00
        tolerance: 1,
        source: "SFL 2 kap 26 § p1 — Sjukförsäkringsavgift 3.55%",
        formula: "500000 × 0.0355 = 17750",
      },
      {
        field: "breakdown.1.amount",
        expected: 10_000,   // HANDBERÄKNAT: 500000 × 0.0200 = 10000.00
        tolerance: 1,
        source: "SFL 2 kap 26 § p2 — Föräldraförsäkringsavgift 2.00%",
        formula: "500000 × 0.0200 = 10000",
      },
      {
        field: "breakdown.2.amount",
        expected: 51_050,   // HANDBERÄKNAT: 500000 × 0.1021 = 51050.00
        tolerance: 1,
        source: "SFL 2 kap 26 § p3 — Ålderspensionsavgift 10.21%",
        formula: "500000 × 0.1021 = 51050",
      },
      {
        field: "breakdown.3.amount",
        expected: 1_500,    // HANDBERÄKNAT: 500000 × 0.0030 = 1500.00
        tolerance: 1,
        source: "SFL 2 kap 26 § p4 — Efterlevandepensionsavgift 0.30%",
        formula: "500000 × 0.0030 = 1500",
      },
      {
        field: "breakdown.4.amount",
        expected: 13_200,   // HANDBERÄKNAT: 500000 × 0.0264 = 13200.00
        tolerance: 1,
        source: "SFL 2 kap 26 § p5 — Arbetsmarknadsavgift 2.64%",
        formula: "500000 × 0.0264 = 13200",
      },
      {
        field: "breakdown.5.amount",
        expected: 500,      // HANDBERÄKNAT: 500000 × 0.0010 = 500.00
        tolerance: 1,
        source: "SFL 2 kap 26 § p6 — Arbetsskadeavgift 0.10%",
        formula: "500000 × 0.0010 = 500",
      },
      {
        field: "breakdown.6.amount",
        expected: 63_100,   // HANDBERÄKNAT: 500000 × 0.1262 = 63100.00
        tolerance: 1,
        source: "Lag 1994:1920 — Allmän löneavgift 12.62%",
        formula: "500000 × 0.1262 = 63100",
      },
    ],
  },

  // ── Case 2: Standard 1M ──────────────────────────────────────────────────
  {
    name: "AG standard: 1M lön",
    description: "Full arbetsgivaravgift 31.42% på bruttolön 1,000,000 kr.",
    input: { gross_salary: 1_000_000, birth_year: 1990, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 314_200,  // HANDBERÄKNAT: 1000000 × 0.3142 = 314200.00
        tolerance: 1,
        source: "SFL 2 kap 26 §",
        formula: "1000000 × 0.3142 = 314200",
      },
    ],
  },

  // ── Case 3: Noll lön ─────────────────────────────────────────────────────
  {
    name: "AG noll lön",
    description:
      "Bruttolön 0 kr → arbetsgivaravgift 0 kr. " +
      "Träffar MIN_UNDERLAG-gränsen (0 < 1000 kr/år).",
    input: { gross_salary: 0, birth_year: 1990, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 0,        // HANDBERÄKNAT: 0 × 0.3142 = 0 (även MIN_UNDERLAG)
        tolerance: 0,
        source: "SFL 2 kap 26 §",
        formula: "0 × 0.3142 = 0",
      },
    ],
  },

  // ── Case 4: Åldersreduktion — born 1958 ─────────────────────────────────
  {
    name: "AG åldersreduktion: född 1958",
    description:
      "Fyllt 67 vid årets ingång 2026 = born 1958 eller tidigare. " +
      "Åldersgräns HÖJD från 66 till 67 fr.o.m. 2026. " +
      "Bara ålderspensionsavgift 10.21% kvarstår, alla övriga = 0.",
    input: { gross_salary: 500_000, birth_year: 1958, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 51_050,   // HANDBERÄKNAT: 500000 × 0.1021 = 51050.00
        tolerance: 1,
        source: "SFL 2 kap 27 §, fyllt 67 vid årets ingång 2026",
        formula: "500000 × 0.1021 = 51050 (enbart ålderspensionsavgift)",
      },
      {
        field: "breakdown.2.amount",
        expected: 51_050,   // HANDBERÄKNAT: ålderspension = hela beloppet
        tolerance: 1,
        source: "SFL 2 kap 27 §",
        formula: "500000 × 0.1021 = 51050",
      },
      {
        field: "breakdown.0.amount",
        expected: 0,        // Sjukförsäkringsavgift = 0 vid åldersreduktion
        tolerance: 0,
        source: "SFL 2 kap 27 § — sjukförsäkringsavgift faller bort",
        formula: "Åldersreduktion aktiv → 0",
      },
    ],
  },

  // ── Case 5: Växa-stödet — under tak ─────────────────────────────────────
  {
    name: "AG Växa-stödet: under tak",
    description:
      "Växa-stödet: en av de två första anställda. " +
      "Bruttolön 300,000 kr/år < tak 420,000 kr/år (35,000 kr/mån). " +
      "Hela lönen under tak → bara ålderspensionsavgift 10.21%.",
    input: { gross_salary: 300_000, birth_year: 1990, first_employee: true, num_employees: 1 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 30_630,   // HANDBERÄKNAT: 300000 × 0.1021 = 30630.00
        tolerance: 1,
        source: "SFL 2 kap 31 §, max 35000 kr/mån = 420000 kr/år",
        formula: "300000 × 0.1021 = 30630 (Växa, hela lönen under 420k-tak)",
      },
    ],
  },

  // ── Case 6: Växa-stödet — över tak ──────────────────────────────────────
  {
    name: "AG Växa-stödet: över tak",
    description:
      "Växa-stödet: en av de två första anställda. " +
      "Bruttolön 500,000 kr/år > tak 420,000 kr/år. " +
      "Växa på 420,000 (10.21%) + full avgift på 80,000 (31.42%).",
    input: { gross_salary: 500_000, birth_year: 1990, first_employee: true, num_employees: 1 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 68_018,   // HANDBERÄKNAT:
                            //   Växa-del:    420000 × 0.1021 = 42882
                            //   Rest-del:     80000 × 0.3142 = 25136
                            //   Totalt:                        68018
        tolerance: 1,
        source: "SFL 2 kap 31 §",
        formula: "420000 × 0.1021 + 80000 × 0.3142 = 42882 + 25136 = 68018",
      },
    ],
  },

  // ── Case 7: Negativ lön (edge case) ─────────────────────────────────────
  {
    name: "AG negativ lön (edge case)",
    description:
      "Negativ bruttolön är ogiltig input. " +
      "Skill MÅSTE kasta Error (GUARDRAILS regel 10 — ingen silent degradation).",
    input: { gross_salary: -1, birth_year: 1990, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 0,        // Inte tillämpligt — förväntar Error
        tolerance: 0,
        source: "GUARDRAILS regel 10 — ingen silent degradation",
        expect_error: true,
      },
    ],
  },

  // ── Case 8: Precisionskontroll — 1 kr ────────────────────────────────────
  {
    name: "AG precisionskontroll: 1 kr",
    description:
      "Bruttolön 1 kr < MIN_UNDERLAG (1000 kr/år) → inga avgifter. " +
      "Även om rounding: Math.round(1 × 0.3142) = 0.",
    input: { gross_salary: 1, birth_year: 1990, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 0,        // HANDBERÄKNAT: 1 < MIN_UNDERLAG → 0 (även Math.round(0.3142) = 0)
        tolerance: 0,
        source: "SKV: Ingen AG-avgift om bruttolön < 1000 kr/år",
        formula: "1 < 1000 (MIN_UNDERLAG) → 0",
      },
    ],
  },

  // ── Case 9: Under tröskelvärde — 999 kr ──────────────────────────────────
  {
    name: "AG under 1000 kr — ingen avgift",
    description:
      "Bruttolön 999 kr/år = just under tröskelvärdet 1000 kr/år. " +
      "Ingen arbetsgivaravgift ska tas ut.",
    input: { gross_salary: 999, birth_year: 1990, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 0,        // HANDBERÄKNAT: 999 < 1000 (MIN_UNDERLAG) → 0
        tolerance: 0,
        source: "SKV: Ingen AG-avgift om bruttolön < 1000 kr/år",
        formula: "999 < 1000 (MIN_UNDERLAG) → 0",
      },
    ],
  },

  // ── Case 10: Åldersgräns — born 1959 (FULL avgift) ───────────────────────
  {
    name: "AG åldersgräns: född 1959 (full avgift)",
    description:
      "Född 1959 = fyllt 66 år vid 2026-01-01. " +
      "Åldersgränsen för reduktion är 67 år (born ≤ 1958). " +
      "Born 1959 → FULL avgift 31.42%. " +
      "Verifierar att gränsen är korrekt vid 1958, INTE 1959.",
    input: { gross_salary: 500_000, birth_year: 1959, first_employee: false, num_employees: 0 },
    assertions: [
      {
        field: "result.total_ag",
        expected: 157_100,  // HANDBERÄKNAT: 500000 × 0.3142 = 157100
        tolerance: 1,
        source: "SFL 2 kap 26 §, born 1959 = 66 år, EJ 67 → full avgift",
        formula: "500000 × 0.3142 = 157100 (ingen reduktion)",
      },
    ],
  },
];
