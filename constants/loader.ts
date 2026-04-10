/**
 * constants/loader.ts
 *
 * Single source of truth för alla svenska skattekonstanter.
 * Alla värden läses från constants/2026.json — noll hårdkodade siffror här.
 *
 * Exporterar:
 *   - getConstants(year) — raw JSON-access
 *   - CURRENT_YEAR       — innevarande inkomstår
 *   - AG_CONSTANTS_2026  — arbetsgivaravgifter (samma shape som skills/ag-avgifter/constants.ts)
 *   - MOMS_CONSTANTS_2026, BAS_UTGAENDE, BAS_REVERSE_CHARGE
 *   - BOLAGSSKATT_CONSTANTS_2026
 *   - K10_CONSTANTS_2026
 *   - TAX_CONSTANTS_2026 + TaxConstants type
 */

import data2026 from './2026.json';

// ── Year guard ────────────────────────────────────────────────────────────────

export type TaxYear = 2026;
export const CURRENT_YEAR: TaxYear = 2026;

export function getConstants(year: TaxYear) {
  if (year === 2026) return data2026;
  throw new Error(
    `KAMMAREN: Regler för inkomstår ${year} inte tillgängliga. ` +
    `Skapa constants/${year}.json och verifiera mot Skatteverkets tabeller.`,
  );
}

// Kortnamn för intern användning
const c = data2026;

// ── AG-AVGIFTER ───────────────────────────────────────────────────────────────
// Samma shape som skills/ag-avgifter/constants.ts AG_CONSTANTS_2026

export const AG_CONSTANTS_2026 = {
  SJUKFORSAKRING:                   c.arbetsgivaravgifter.delposter.sjukforsakring.value,
  FORALDRAFORSAKRING:               c.arbetsgivaravgifter.delposter.foraldraforsakring.value,
  ALDERSPENSION:                    c.arbetsgivaravgifter.delposter.alderspension.value,
  EFTERLEVANDEPENSION:              c.arbetsgivaravgifter.delposter.efterlevandepension.value,
  ARBETSMARKNAD:                    c.arbetsgivaravgifter.delposter.arbetsmarknad.value,
  ARBETSSKADA:                      c.arbetsgivaravgifter.delposter.arbetsskada.value,
  ALLMAN_LONEAVGIFT:                c.arbetsgivaravgifter.delposter.allman_loneavgift.value,
  EGENTLIGA_AG:                     c.arbetsgivaravgifter.delposter.egentliga_ag.value,
  TOTAL_RATE:                       c.arbetsgivaravgifter.total.value,
  ALDERS_REDUKTION_RATE:            c.arbetsgivaravgifter.aldersreduktion.rate,
  ALDERS_REDUKTION_MAX_BIRTH_YEAR:  c.arbetsgivaravgifter.aldersreduktion.max_birth_year,
  INGEN_AVGIFT_MAX_BIRTH_YEAR:      c.arbetsgivaravgifter.ingen_avgift.max_birth_year,
  VAXA_RATE:                        c.arbetsgivaravgifter.vaxa_stodet.rate,
  VAXA_MAX_MONTHLY:                 c.arbetsgivaravgifter.vaxa_stodet.max_monthly,
  VAXA_MAX_YEARLY:                  c.arbetsgivaravgifter.vaxa_stodet.max_yearly,
  VAXA_MAX_EMPLOYEES:               c.arbetsgivaravgifter.vaxa_stodet.max_employees,
  MIN_UNDERLAG:                     c.arbetsgivaravgifter.min_underlag.value,
  INKOMSTAR:                        c.inkomstar,
} as const;

export type AgConstants = typeof AG_CONSTANTS_2026;

// ── KONTROLLSUMMA AG (körs vid import) ────────────────────────────────────────
{
  const d = c.arbetsgivaravgifter.delposter;
  const sum =
    d.sjukforsakring.value +
    d.foraldraforsakring.value +
    d.alderspension.value +
    d.efterlevandepension.value +
    d.arbetsmarknad.value +
    d.arbetsskada.value +
    d.allman_loneavgift.value;
  if (Math.abs(sum - c.arbetsgivaravgifter.total.value) > 0.0001) {
    throw new Error(
      `KRITISKT: 2026.json AG-delposter summerar till ${sum.toFixed(4)} ` +
      `men total.value = ${c.arbetsgivaravgifter.total.value}. JSON är korrupt.`,
    );
  }
}

// ── MOMS ──────────────────────────────────────────────────────────────────────
// Samma shape som skills/moms/constants.ts

export const MOMS_CONSTANTS_2026 = {
  RATES: {
    STANDARD:  c.moms.satser.standard.value,
    REDUCED_1: c.moms.satser.reducerad_1.value,
    REDUCED_2: c.moms.satser.reducerad_2.value,
    ZERO:      c.moms.satser.noll.value,
  },
  VALID_RATES: [0, 6, 12, 25] as const,
  OMSATTNINGSGRNS_MOMSFRI: c.moms.omsattningsgrans_momsfri.value,
  INKOMSTAR: c.inkomstar,
} as const;

export type MomsConstants = typeof MOMS_CONSTANTS_2026;

// BAS-konton — Record<number, number> för att matcha befintlig calculate.ts usage
const _bas_u = c.moms.bas_utgaende as Record<string, number>;
const _bas_r = c.moms.bas_reverse_charge as Record<string, number>;

export const BAS_UTGAENDE: Record<number, number> = {
   0: _bas_u['0'] ?? 0,
   6: _bas_u['6'],
  12: _bas_u['12'],
  25: _bas_u['25'],
};

export const BAS_REVERSE_CHARGE: Record<number, number> = {
   6: _bas_r['6'],
  12: _bas_r['12'],
  25: _bas_r['25'],
};

// ── KONTROLLSUMMA MOMS (körs vid import) ─────────────────────────────────────
for (const rate of MOMS_CONSTANTS_2026.VALID_RATES) {
  if (!(rate in BAS_UTGAENDE)) {
    throw new Error(
      `KRITISKT: BAS_UTGAENDE saknar konto för momssats ${rate}%. 2026.json är inkomplett.`,
    );
  }
}

// ── BOLAGSSKATT ───────────────────────────────────────────────────────────────
// Samma shape som skills/bolagsskatt/constants.ts

export const BOLAGSSKATT_CONSTANTS_2026 = {
  SKATTESATS:       c.bolagsskatt.skattesats.value,
  PFOND_MAX_ANDEL:  c.bolagsskatt.periodiseringsfond.max_avsattning.value,
  PFOND_MAX_ANTAL:  c.bolagsskatt.periodiseringsfond.max_antal_fonder.value,
  PFOND_MAX_AR:     c.bolagsskatt.periodiseringsfond.max_ar.value,
  STATSLANERANTAN:  c.statslanerantan.nov_30_2025.value,
  INKOMSTAR:        c.inkomstar,
} as const;

export type BolagsskattConstants = typeof BOLAGSSKATT_CONSTANTS_2026;

// ── K10 ───────────────────────────────────────────────────────────────────────
// Samma shape som skills/k10/constants.ts

export const K10_CONSTANTS_2026 = {
  IBB_3_12:                     c.basbelopp.ibb_for_312.value,
  FORENKLING_MULTIPEL:          c.treslagregeln_312.grundbelopp_multipel.value,
  FORENKLING_BELOPP:            c.treslagregeln_312.grundbelopp_belopp.value,
  LONESPARR_MULTIPEL:           c.treslagregeln_312.lonesparr_multipel.value,
  LONESPARR_BELOPP:             c.treslagregeln_312.lonesparr_belopp.value,
  LONEBASERAT_ANDEL:            c.treslagregeln_312.lonebaserat_andel.value,
  LONEBASERAT_TAK_MULTIPEL:     c.treslagregeln_312.lonebaserat_tak_multipel.value,
  LONEBASERAT_MIN_AGARANDEL:    c.treslagregeln_312.lonebaserat_min_agarandel.value,
  STATSLANERANTAN:              c.statslanerantan.nov_30_2025.value,
  KAPITALBASERAT_RANTETILLAGG:  c.treslagregeln_312.kapitalbaserat_rantetillagg.value,
  KAPITALBASERAT_FAKTOR:        c.treslagregeln_312.kapitalbaserat_faktor.value,
  UPPRAKNINGSFAKTOR:            c.treslagregeln_312.upprakningsranta_sparat.value,
  INKOMSTAR:                    c.inkomstar,
} as const;

export type K10Constants = typeof K10_CONSTANTS_2026;

// ── KONTROLLSUMMA K10 (körs vid import) ──────────────────────────────────────
{
  const K = K10_CONSTANTS_2026;
  if (K.FORENKLING_BELOPP !== K.FORENKLING_MULTIPEL * K.IBB_3_12) {
    throw new Error(
      `KRITISKT: FORENKLING_BELOPP (${K.FORENKLING_BELOPP}) ≠ ` +
      `${K.FORENKLING_MULTIPEL} × IBB_3_12 (${K.FORENKLING_MULTIPEL * K.IBB_3_12}). ` +
      `2026.json är korrupt.`,
    );
  }
  if (K.LONESPARR_BELOPP !== K.LONESPARR_MULTIPEL * K.IBB_3_12) {
    throw new Error(
      `KRITISKT: LONESPARR_BELOPP (${K.LONESPARR_BELOPP}) ≠ ` +
      `${K.LONESPARR_MULTIPEL} × IBB_3_12 (${K.LONESPARR_MULTIPEL * K.IBB_3_12}). ` +
      `2026.json är korrupt.`,
    );
  }
  if (Math.abs(K.KAPITALBASERAT_FAKTOR - (K.STATSLANERANTAN + K.KAPITALBASERAT_RANTETILLAGG)) > 1e-10) {
    throw new Error(
      `KRITISKT: KAPITALBASERAT_FAKTOR (${K.KAPITALBASERAT_FAKTOR}) ≠ ` +
      `SLR (${K.STATSLANERANTAN}) + tillägg (${K.KAPITALBASERAT_RANTETILLAGG}) ` +
      `= ${K.STATSLANERANTAN + K.KAPITALBASERAT_RANTETILLAGG}. 2026.json är korrupt.`,
    );
  }
}

// ── TAX_CONSTANTS_2026 ────────────────────────────────────────────────────────
// Samma shape som skills/tax-optimizer/constants.ts

export const TAX_CONSTANTS_2026 = {
  // 3:12
  IBB_3_12:                 c.basbelopp.ibb_for_312.value,
  BASE_AMOUNT_FACTOR:       c.treslagregeln_312.grundbelopp_multipel.value,
  BASE_AMOUNT:              c.treslagregeln_312.grundbelopp_belopp.value,
  SALARY_DEDUCTION_FACTOR:  c.treslagregeln_312.lonesparr_multipel.value,
  SALARY_DEDUCTION:         c.treslagregeln_312.lonesparr_belopp.value,
  SALARY_BASED_SHARE:       c.treslagregeln_312.lonebaserat_andel.value,
  SALARY_SPACE_CAP_FACTOR:  c.treslagregeln_312.lonebaserat_tak_multipel.value,

  // Basbelopp & inkomstskatt
  PBB:                      c.basbelopp.prisbasbelopp.value,
  IBB_CURRENT:              c.basbelopp.inkomstbasbelopp.value,
  SKIKTGRANS:               c.inkomstskatt.skiktgrans.value,
  BRYTPUNKT:                c.inkomstskatt.brytpunkt_under_66.value,
  STATE_TAX_RATE:           c.inkomstskatt.statlig_skatt.value,

  // Bolagsskatt
  CORP_TAX_RATE:            c.bolagsskatt.skattesats.value,

  // Utdelning
  DIVIDEND_TAX_RATE:        c.treslagregeln_312.utdelning_kapitalskatt.value,

  // AG-avgifter
  EMPLOYER_FEE_RATE:        c.arbetsgivaravgifter.total.value,

  // Periodiseringsfond
  PFOND_MAX_SHARE:          c.bolagsskatt.periodiseringsfond.max_avsattning.value,
  PFOND_REVERSAL_YEARS:     c.bolagsskatt.periodiseringsfond.max_ar.value,
  PFOND_DISCOUNT_RATE:      c.bolagsskatt.pfond_diskonteringsranta.value,

  // Trädabolag
  DORMANT_PERIOD_YEARS:     c.bolagsskatt.tradabolag_karenstid_ar.value,

  // Begravning & kyrka
  BURIAL_FEE_DEFAULT:       c.inkomstskatt.begravningsavgift_snitt.value,
  CHURCH_TAX_DEFAULT:       c.kyrkoavgift.snitt_fallback.value,

  // Statslåneränta & 3:12 kapital
  SLR:                          c.statslanerantan.nov_30_2025.value,
  OMKOSTNADSBELOPP_RATE_ADDON:  c.treslagregeln_312.kapitalbaserat_rantetillagg.value,
  OMKOSTNADSBELOPP_THRESHOLD:   c.treslagregeln_312.omkostnadsbelopp_threshold.value,

  // Trygghet
  SGI_MAX:             c.sgi.max.value,
  PENSION_MAX_GROSS:   c.pension.pension_max_gross.value,
  PGI_MAX:             c.pension.pgi_max.value,

  // Grundavdrag
  GA_FLOOR_FACTOR:  c.grundavdrag.floor_factor.value,
  GA_LOW_FACTOR:    c.grundavdrag.low_factor.value,
  GA_MAX_FACTOR:    c.grundavdrag.max_factor.value,

  // Meta
  VERSION: '2026-06',
  SOURCE: 'constants/2026.json via Skatteverket PDF 2026-01-07',
} as const;

export type TaxConstants = typeof TAX_CONSTANTS_2026;
