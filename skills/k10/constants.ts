/**
 * skills/k10/constants.ts
 *
 * Alla konstanter för K10-gränsbeloppsberäkning 2026.
 * Noll hårdkodade siffror i calculate.ts — allt läses härifrån.
 *
 * KORSVERIFIERAT mot skills/tax-optimizer/constants.ts (TAX_CONSTANTS_2026):
 *   IBB_3_12             = 80 600 ✓ (TAX_CONSTANTS_2026.IBB_3_12)
 *   FORENKLING_BELOPP    = 322 400 ✓ (TAX_CONSTANTS_2026.BASE_AMOUNT)
 *   LONESPARR_BELOPP     = 644 800 ✓ (TAX_CONSTANTS_2026.SALARY_DEDUCTION)
 *   LONEBASERAT_ANDEL    = 0.50   ✓ (TAX_CONSTANTS_2026.SALARY_BASED_SHARE)
 *   LONEBASERAT_TAK_MULTIPEL = 50 ✓ (TAX_CONSTANTS_2026.SALARY_SPACE_CAP_FACTOR)
 *   OMKOSTNADSBELOPP_RATE_ADDON = 0.09 ✓ (TAX_CONSTANTS_2026.OMKOSTNADSBELOPP_RATE_ADDON)
 *   OMKOSTNADSBELOPP_THRESHOLD  = 100 000 ✓ (TAX_CONSTANTS_2026.OMKOSTNADSBELOPP_THRESHOLD)
 *
 * ⚠ AVVIKELSE RAPPORTERAD (spec vs tax-constants-2026.ts):
 *   Spec angav UPPRAKNINGSFAKTOR = 5.55% (statslåneränta 2.55% + 3.00%).
 *   tax-constants-2026.ts: "Uppräkningsränta: SLOPAD från 2026. Sparat utrymme nominellt."
 *   → UPPRAKNINGSFAKTOR satt till 0. Sparat utrymme förs över utan uppräkning.
 *   Källa: TAX_CONSTANTS_2026 (auktoritativ), kommentar under DIVIDEND_TAX_RATE.
 *
 * Källor:
 *   - IL 57 kap 4 § (IBB för 3:12)
 *   - IL 57 kap 10 § (sparat utrymme)
 *   - IL 57 kap 11 § (förenklingsregel, Prop. 2025/26:1)
 *   - IL 57 kap 12 § (omkostnadsbelopp inkl. 9%-tillägg)
 *   - IL 57 kap 16 § (lönebaserat utrymme, Prop. 2025/26:1)
 */

export const K10_CONSTANTS_2026 = {

  // ═══ IBB FÖR 3:12 (IL 57 kap 4 §) ══════════════════════════════════════
  // IBB = Inkomstbasbelopp för FÖREGÅENDE år (IBB 2025 = 80 600)
  // OBS: IBB 2026 = 83 400 — används EJ för 3:12-reglerna
  IBB_3_12: 80_600,

  // ═══ FÖRENKLINGSREGEL (IL 57 kap 11 §, Prop. 2025/26:1) ═════════════════
  FORENKLING_MULTIPEL: 4,           // 4 × IBB
  FORENKLING_BELOPP:   322_400,     // 4 × 80 600 = 322 400

  // ═══ LÖNESPÄRR (IL 57 kap 16 §, Prop. 2025/26:1) ════════════════════════
  LONESPARR_MULTIPEL: 8,            // 8 × IBB
  LONESPARR_BELOPP:   644_800,      // 8 × 80 600 = 644 800

  // ═══ LÖNEBASERAT UTRYMME (IL 57 kap 16 §) ═══════════════════════════════
  LONEBASERAT_ANDEL:          0.50, // 50% av (löner - spärr)
  LONEBASERAT_TAK_MULTIPEL:   50,   // Max 50 × ägarens kontanta lön
  LONEBASERAT_MIN_AGARANDEL:  0.04, // 4%-spärr: < 4% → inget lönebaserat

  // ═══ OMKOSTNADSBELOPP — 9%-TILLÄGG (IL 57 kap 12 §) ═════════════════════
  // Bekräftat: TAX_CONSTANTS_2026.OMKOSTNADSBELOPP_RATE_ADDON = 0.09
  // Om propägarens (scaled) omkostnadsbelopp > THRESHOLD:
  //   tillägg = RATE_ADDON × (omkostnad - THRESHOLD)
  // Ny additiv 2026 (Prop. 2025/26:1): kapitalbaserat = anskaffningsvärde
  // × ägarandel × (statslåneränta + 9 procentenheter)
  // SLR 30 nov 2025: 2.55% (riksgalden.se). Faktor: 2.55% + 9.00% = 11.55%
  STATSLANERANTAN:              0.0255,    // SLR 30 nov 2025 (riksgalden.se)
  KAPITALBASERAT_RANTETILLAGG:  0.09,      // 9 procentenheter (IL 57 kap 12 §)
  KAPITALBASERAT_FAKTOR:        0.1155,    // STATSLANERANTAN + RANTETILLAGG

  // ═══ SPARAT UTRYMME — UPPRÄKNING (IL 57 kap 10 §) ═══════════════════════
  // ⚠ UPPRÄKNINGSRÄNTAN ÄR SLOPAD FR.O.M. 2026
  // Källa: TAX_CONSTANTS_2026: "Uppräkningsränta: SLOPAD från 2026. Sparat utrymme nominellt."
  // Sparat utrymme förs över till nästa år utan uppräkning (nominellt).
  UPPRAKNINGSFAKTOR: 0,             // 0% — slopad 2026

  INKOMSTAR: 2026,

} as const;

export type K10Constants = typeof K10_CONSTANTS_2026;

// ═══ KONTROLLSUMMOR VID IMPORT ════════════════════════════════════════════════

const C = K10_CONSTANTS_2026;

if (C.FORENKLING_BELOPP !== C.FORENKLING_MULTIPEL * C.IBB_3_12) {
  throw new Error(
    `KRITISKT: FORENKLING_BELOPP (${C.FORENKLING_BELOPP}) ≠ ` +
    `${C.FORENKLING_MULTIPEL} × IBB_3_12 (${C.FORENKLING_MULTIPEL * C.IBB_3_12}). ` +
    `constants.ts är korrupt.`,
  );
}
if (C.LONESPARR_BELOPP !== C.LONESPARR_MULTIPEL * C.IBB_3_12) {
  throw new Error(
    `KRITISKT: LONESPARR_BELOPP (${C.LONESPARR_BELOPP}) ≠ ` +
    `${C.LONESPARR_MULTIPEL} × IBB_3_12 (${C.LONESPARR_MULTIPEL * C.IBB_3_12}). ` +
    `constants.ts är korrupt.`,
  );
}
if (Math.abs(C.KAPITALBASERAT_FAKTOR - (C.STATSLANERANTAN + C.KAPITALBASERAT_RANTETILLAGG)) > 1e-10) {
  throw new Error(
    `KRITISKT: KAPITALBASERAT_FAKTOR (${C.KAPITALBASERAT_FAKTOR}) ≠ ` +
    `STATSLANERANTAN (${C.STATSLANERANTAN}) + RANTETILLAGG (${C.KAPITALBASERAT_RANTETILLAGG}) ` +
    `= ${C.STATSLANERANTAN + C.KAPITALBASERAT_RANTETILLAGG}. constants.ts är korrupt.`,
  );
}
