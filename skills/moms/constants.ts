/**
 * skills/moms/constants.ts
 *
 * Alla momssatser och BAS-konton för 2026.
 * Noll hårdkodade siffror i calculate.ts — allt läses härifrån.
 *
 * Källor:
 *   - Mervärdesskattelagen (ML) 7 kap 1 § (momssatser)
 *   - ML 3 kap (undantag från momsplikt — 0%)
 *   - ML 1 kap 2 § (omvänd skattskyldighet)
 *   - BAS 2026 kontoplan (konton 2610-2634)
 *   - SKV: "Mervärdesskatt (moms)" — skatteverket.se
 */

export const MOMS_CONSTANTS_2026 = {

  // ═══ MOMSSATSER (ML 7 kap 1 §) ═══════════════════════════════════════════
  // Decimaler för beräkning. Input anges som heltal (25, 12, 6, 0).

  RATES: {
    STANDARD:  0.25,   // 25% — generell momssats          (ML 7:1 första stycket)
    REDUCED_1: 0.12,   // 12% — livsmedel, hotell, restaurang (ML 7:1 andra stycket)
    REDUCED_2: 0.06,   //  6% — böcker, persontransport, kultur (ML 7:1 tredje stycket)
    ZERO:      0.00,   //  0% — sjukvård, utbildning, bank/finans, export (ML 3 kap)
  },

  // Giltiga satser som heltal (används i validering)
  VALID_RATES: [0, 6, 12, 25] as const,

  // Omsättningsgräns: ≤ 120 000 kr/år kan ansöka om befrielse (ML 9 d kap)
  OMSATTNINGSGRNS_MOMSFRI: 120_000,

  // ═══ INKOMSTÅR ════════════════════════════════════════════════════════════
  INKOMSTAR: 2026,

} as const;

// ═══ BAS 2026 — UTGÅENDE MOMS ════════════════════════════════════════════════
// Konton för att redovisa utgående moms (kreditposter vid försäljning)
// Nyckel = momssats som heltal (25, 12, 6, 0)
// Värde = BAS-kontonummer som heltal
//
// OBS: 0 → 0 (ingen utgående moms att redovisa — momsbefriad transaktion)

export const BAS_UTGAENDE: Record<number, number> = {
   0: 0,      // Momsbefriad — inget utgående momskonto (ML 3 kap)
   6: 2630,   // BAS 2026: Utgående moms 6%
  12: 2620,   // BAS 2026: Utgående moms 12%
  25: 2610,   // BAS 2026: Utgående moms 25%
};

// ═══ BAS 2026 — OMVÄND SKATTSKYLDIGHET ═══════════════════════════════════════
// Köparen redovisar momsen. Konton för utgående moms omvänd skattskyldighet.
// (ML 1 kap 2 §)
//
// OBS: 0% används ej vid omvänd skattskyldighet (ingen moms att redovisa)

export const BAS_REVERSE_CHARGE: Record<number, number> = {
   6: 2634,   // BAS 2026: Utgående moms omvänd skattskyldighet 6%
  12: 2624,   // BAS 2026: Utgående moms omvänd skattskyldighet 12%
  25: 2614,   // BAS 2026: Utgående moms omvänd skattskyldighet 25%
};

export type MomsConstants = typeof MOMS_CONSTANTS_2026;

// ═══ KONTROLLSUMMA VID IMPORT ════════════════════════════════════════════════
// Verifierar att VALID_RATES ⊆ BAS_UTGAENDE.
// Kör direkt vid import — stoppar omedelbart om constants.ts är inkomplett.

for (const rate of MOMS_CONSTANTS_2026.VALID_RATES) {
  if (!(rate in BAS_UTGAENDE)) {
    throw new Error(
      `KRITISKT: BAS_UTGAENDE saknar konto för momssats ${rate}%. ` +
      `constants.ts är inkomplett — kontrollera BAS_UTGAENDE.`,
    );
  }
}
