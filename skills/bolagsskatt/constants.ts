/**
 * skills/bolagsskatt/constants.ts
 *
 * Alla skattesatser och parametrar för bolagsskatt 2026.
 * Noll hårdkodade siffror i calculate.ts — allt läses härifrån.
 *
 * Källor:
 *   - IL 65 kap 10 § (bolagsskattesats 20.6%)
 *   - IL 30 kap 5 § (periodiseringsfond max 25%)
 *   - IL 30 kap 6a § (schablonintäkt = fondbelopp × statslåneränta)
 *   - IL 30 kap 7 § (max 6 fonder, max 6 år)
 *   - SKV PDF 2026-01-07: statslåneränta 30 nov 2025 = 2.55%
 */

export const BOLAGSSKATT_CONSTANTS_2026 = {

  // ═══ BOLAGSSKATTESATS (IL 65 kap 10 §) ═══════════════════════════════════
  SKATTESATS: 0.206,                  // 20.6% — alla AB oavsett storlek

  // ═══ PERIODISERINGSFOND (IL 30 kap) ══════════════════════════════════════
  PFOND_MAX_ANDEL: 0.25,              // 25% av överskott (IL 30 kap 5 §)
  PFOND_MAX_ANTAL: 6,                 // Max 6 fonder per bolag (IL 30 kap 7 §)
  PFOND_MAX_AR:    6,                 // Fond återförs senast år 6 (IL 30 kap 7 §)

  // ═══ SCHABLONINTÄKT (IL 30 kap 6a §) ═════════════════════════════════════
  // Schablonintäkt = fondbelopp IB × statslåneräntan 30 november föregående år
  // Statslåneränta 30 nov 2025: 2.55% (källa: SKV PDF 2026-01-07)
  STATSLANERANTAN: 0.0255,            // 2.55%

  // ═══ INKOMSTÅR ════════════════════════════════════════════════════════════
  INKOMSTAR: 2026,

} as const;

export type BolagsskattConstants = typeof BOLAGSSKATT_CONSTANTS_2026;

// ═══ KONTROLLSUMMA VID IMPORT ════════════════════════════════════════════════
// Verifierar att skattesatsen är rimlig (5%–40%) som en sanity check.
// Kör direkt vid import.

const C = BOLAGSSKATT_CONSTANTS_2026;
if (C.SKATTESATS < 0.05 || C.SKATTESATS > 0.40) {
  throw new Error(
    `KRITISKT: SKATTESATS=${C.SKATTESATS} är utanför rimligt intervall [0.05, 0.40]. ` +
    `constants.ts är korrupt — kontrollera bolagsskattesatsen.`,
  );
}
if (C.PFOND_MAX_ANDEL <= 0 || C.PFOND_MAX_ANDEL > 0.5) {
  throw new Error(
    `KRITISKT: PFOND_MAX_ANDEL=${C.PFOND_MAX_ANDEL} är utanför rimligt intervall (0, 0.5]. ` +
    `constants.ts är korrupt.`,
  );
}
