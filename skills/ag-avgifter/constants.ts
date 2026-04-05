/**
 * skills/ag-avgifter/constants.ts
 *
 * Alla procentsatser och trösklar för arbetsgivaravgifter 2026.
 * Noll hårdkodade siffror i calculate.ts — allt läses härifrån.
 *
 * Källor:
 *   - SFL 2 kap 26-31 §§ (Socialavgiftslagen 2000:980)
 *   - Lag (1994:1920) om allmän löneavgift
 *   - SKV PDF 2026-01-07: "Belopp och procentsatser för inkomståret 2026"
 *   - Ekosnurra, Fortnox (korsreferens)
 *   - Prop. 2025/26:66 (ungdomsrabatt, ej implementerad)
 */

export const AG_CONSTANTS_2026 = {

  // ═══ DELPOSTER (SFL 2 kap 26 §) ═══════════════════════════════════════════
  // Verifierat: SKV PDF 2026-01-07, Ekosnurra, Fortnox

  SJUKFORSAKRING:        0.0355,   // 3.55%  — SFL 2 kap 26 § punkt 1
  FORALDRAFORSAKRING:    0.0200,   // 2.00%  — SFL 2 kap 26 § punkt 2
  ALDERSPENSION:         0.1021,   // 10.21% — SFL 2 kap 26 § punkt 3
  EFTERLEVANDEPENSION:   0.0030,   // 0.30%  — SFL 2 kap 26 § punkt 4
  ARBETSMARKNAD:         0.0264,   // 2.64%  — SFL 2 kap 26 § punkt 5
  ARBETSSKADA:           0.0010,   // 0.10%  — SFL 2 kap 26 § punkt 6
  ALLMAN_LONEAVGIFT:     0.1262,   // 12.62% — Lag (1994:1920) om allmän löneavgift

  // Aggregerade poster
  EGENTLIGA_AG:          0.1880,   // 18.80% = TOTAL - ALLMAN_LONEAVGIFT
  TOTAL_RATE:            0.3142,   // 31.42% = summa alla delposter

  // ═══ ÅLDERSREDUKTION (SFL 2 kap 27 §) ════════════════════════════════════
  // Fyllt 67 vid årets ingång → bara ålderspensionsavgift
  // OBS: Åldersgräns HÖJD från 66 till 67 fr.o.m. 2026.
  // 2026: born 1958 eller tidigare → reduktion

  ALDERS_REDUKTION_RATE:          0.1021,   // 10.21% (enbart ålderspension)
  ALDERS_REDUKTION_MAX_BIRTH_YEAR: 1958,    // Fyllt 67 vid 2026-01-01

  // Born 1937 eller tidigare → INGA avgifter alls (SFL 2 kap)
  INGEN_AVGIFT_MAX_BIRTH_YEAR:    1937,

  // ═══ VÄXA-STÖDET (SFL 2 kap 31 §) ═══════════════════════════════════════
  // DE TVÅ FÖRSTA anställda (ändrat 2026 från "första" till "två första")
  // Max 35 000 kr/mån = 420 000 kr/år per person
  // Nedsatt till bara ålderspensionsavgift (10.21%) upp till taket

  VAXA_RATE:         0.1021,   // 10.21% (bara ålderspension)
  VAXA_MAX_MONTHLY:  35_000,   // 35 000 kr/mån
  VAXA_MAX_YEARLY:   420_000,  // 35 000 × 12 = 420 000 kr/år
  VAXA_MAX_EMPLOYEES: 2,       // Gäller de två första anställda

  // ═══ TRÖSKELVÄRDE ═════════════════════════════════════════════════════════
  // SKV: Ingen arbetsgivaravgift om total ersättning < 1 000 kr/år

  MIN_UNDERLAG: 1_000,         // 1 000 kr/år

  // ═══ INKOMSTÅR ════════════════════════════════════════════════════════════
  INKOMSTAR: 2026,

  // ═══ UNGDOMSRABATT (EJ IMPLEMENTERAD) ════════════════════════════════════
  // Prop. 2025/26:66, Lag (2026:100)
  // 20.81% på lön ≤ 25 000 kr/mån, för anställda 19-23 år (born 2003-2007)
  // Gäller 1 april 2026 – 30 september 2027.
  // Kräver datumlogik. Ej inkluderad i v1. Fasad till v2.

} as const;

export type AgConstants = typeof AG_CONSTANTS_2026;

// ═══ KONTROLLSUMMA VID IMPORT ════════════════════════════════════════════════
// Körs direkt vid import. Om delposter inte summerar till TOTAL_RATE
// är constants.ts korrupt — stoppa omedelbart.

const DELPOST_SUMMA =
  AG_CONSTANTS_2026.SJUKFORSAKRING +
  AG_CONSTANTS_2026.FORALDRAFORSAKRING +
  AG_CONSTANTS_2026.ALDERSPENSION +
  AG_CONSTANTS_2026.EFTERLEVANDEPENSION +
  AG_CONSTANTS_2026.ARBETSMARKNAD +
  AG_CONSTANTS_2026.ARBETSSKADA +
  AG_CONSTANTS_2026.ALLMAN_LONEAVGIFT;

if (Math.abs(DELPOST_SUMMA - AG_CONSTANTS_2026.TOTAL_RATE) > 0.0001) {
  throw new Error(
    `KRITISKT: AG-avgifter delpostsumma (${DELPOST_SUMMA.toFixed(4)}) ` +
    `matchar inte TOTAL_RATE (${AG_CONSTANTS_2026.TOTAL_RATE}). ` +
    `constants.ts är korrupt — kontrollera procentsatserna.`,
  );
}

const EGENTLIGA_CHECK = AG_CONSTANTS_2026.TOTAL_RATE - AG_CONSTANTS_2026.ALLMAN_LONEAVGIFT;

if (Math.abs(EGENTLIGA_CHECK - AG_CONSTANTS_2026.EGENTLIGA_AG) > 0.0001) {
  throw new Error(
    `KRITISKT: EGENTLIGA_AG (${AG_CONSTANTS_2026.EGENTLIGA_AG}) ` +
    `matchar inte TOTAL_RATE - ALLMAN_LONEAVGIFT (${EGENTLIGA_CHECK.toFixed(4)}). ` +
    `constants.ts är korrupt.`,
  );
}
