/**
 * verify/golden-cases/regelversion.cases.ts
 *
 * DOKUMENTATION av vilka regelversioner vi antar — inte ett test av optimize().
 * Körs mot TAX_CONSTANTS_2026 DIREKT (inte via optimize eller någon skill).
 *
 * TOLKNING: Om dessa assertions failar vet vi att vår constants.ts
 * inte matchar lagen som vi tror. ÄNDRA INGENTING. RAPPORTERA AVVIKELSEN.
 *
 * Källor:
 *   - Prop. 2025/26:1 (Budgetpropositionen för inkomståret 2026)
 *   - IL 57 kap (Inkomstskattelagen — fåmansföretag och 3:12-regler)
 *   - SCB (IBB 2025 = 80,600 kr, publicerat aug 2024)
 */

import type { GoldenCase } from '../framework.js';

export const REGELVERSION_CASES: GoldenCase[] = [
  {
    name: "Förenklingsregel: 4 × IBB",
    description:
      "Takbelopp för förenklingsregeln = 4 × IBB för inkomståret. " +
      "3:12-regler använder IBB från föregående kalenderår (IBB 2025 = 80,600). " +
      "Fåmansföretagare som inte uppfyller löneuttagskravet använder detta tak.",
    input: {},
    assertions: [
      {
        field: "BASE_AMOUNT",
        expected: 322_400,   // HANDBERÄKNAT: 4 × 80,600 = 322,400
        tolerance: 0,        // Exakt — regelbestämd multipel, inga ören
        source: "IL 57 kap 11 § efter Prop. 2025/26:1",
        formula: "4 × IBB_3_12 = 4 × 80600 = 322400",
      },
    ],
  },

  {
    name: "Lönespärr: 8 × IBB",
    description:
      "Ägarens kontanta lön måste överstiga 8 × IBB för att det lönebaserade " +
      "utrymmet (50% av löneunderlaget) ska beaktas vid beräkning av gränsbeloppet. " +
      "IBB för 3:12-ändamål = IBB 2025 = 80,600.",
    input: {},
    assertions: [
      {
        field: "SALARY_DEDUCTION",
        expected: 644_800,   // HANDBERÄKNAT: 8 × 80,600 = 644,800
        tolerance: 0,        // Exakt — regelbestämd multipel
        source: "IL 57 kap 16 § efter Prop. 2025/26:1",
        formula: "8 × IBB_3_12 = 8 × 80600 = 644800",
      },
    ],
  },

  {
    name: "IBB för 3:12 = föregående års IBB = 80,600",
    description:
      "3:12-reglerna specificerar att det är IBB för det FÖREGÅENDE inkomståret som " +
      "ska användas — alltså IBB 2025 = 80,600, INTE IBB 2026 = 83,400. " +
      "Denna distinktion är kritisk: fel IBB ger fel gränsbelopp och fel lönespärr.",
    input: {},
    assertions: [
      {
        field: "IBB_3_12",
        expected: 80_600,    // HANDBERÄKNAT: IBB 2025 per SCB (publicerat aug 2024)
        tolerance: 0,        // Exakt — publicerat belopp
        source: "IL 57 kap 4 §, IBB 2025",
        formula: "IBB 2025 = 80600 per SCB (IBB 2026 = 83400 — används EJ för 3:12)",
      },
    ],
  },
];
