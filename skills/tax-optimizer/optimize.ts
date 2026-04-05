/**
 * tax-optimizer — Deterministisk beräkningsmotor
 *
 * Noll LLM. Ren matematik. Alla siffror från constants.ts.
 * Stöder grundavdrag, jobbskatteavdrag, lönstrategier, 50x-cap,
 * omkostnadsbelopp, iterativ P-fond, och kommun-lookup.
 *
 * Migrerad från TAX-OPTIMIZER/ repo 2026-03-14.
 */

import type { SkillInput, SkillOutput } from '../types.js';
import { TAX_CONSTANTS_2026, type TaxConstants } from './constants.js';
import { resolveRates, type ResolvedRates } from './kommun-skattesatser.js';

// ── Internal interfaces ─────────────────────────────────────────────────

interface TaxOptimizerInput {
  profit_before_salary: number;
  liquid_assets: number;
  total_payroll_others: number;
  owner_salary_taken: number;
  external_income: number;
  kommun: string;
  church_member: boolean;
  municipal_tax_rate_override?: number;
  saved_dividend_space: number;
  is_holding_company: boolean;
  has_working_relatives: boolean;
  num_owners: number;
  salary_strategy: 'sgi' | 'pension' | 'balanced';
  planned_downtime_within_3_years: boolean;
  omkostnadsbelopp?: number;
  is_over_66?: boolean;
  safety_buffer?: number;
}

interface TaxBreakdown {
  grundavdrag: number;
  kommunalskatt: number;
  begravningsavgift: number;
  kyrkoavgift: number;
  statlig_skatt: number;
  gross_tax: number;
  jobbskatteavdrag: number;
  net_tax: number;
}

interface SalaryScenario {
  salary: number;
  net_salary: number;
  total_in_pocket: number;
  note: string;
}

interface PfondScenario {
  amount: number;
  tax_deferred: number;
  reversal_year: number;
  net_effect_5yr: number;
}

interface RetainScenario {
  amount: number;
  tax_paid_now: number;
  available_for_investment: number;
}

interface TaxOptimizerOutput {
  recommended_salary: number;
  employer_fees: number;
  total_salary_cost: number;
  salary_income_tax: number;
  net_salary: number;
  tax_breakdown: TaxBreakdown;
  salary_scenarios: {
    sgi: SalaryScenario;
    pension: SalaryScenario;
    balanced: SalaryScenario;
  };
  base_amount: number;
  salary_based_space: number;
  total_dividend_space: number;
  recommended_dividend: number;
  safety_buffer: number;
  recommended_dividend_after_buffer: number;
  dividend_tax: number;
  net_dividend: number;
  saved_space_next_year: number;
  dividend_cap_reason: 'space' | 'equity' | 'liquidity';
  remaining_profit: number;
  corporate_tax: number;
  free_equity: number;
  surplus_after_dividend: number;
  pfond_scenario: PfondScenario;
  pfond_recommended: boolean;
  retain_scenario: RetainScenario;
  omkostnadsbelopp_tillagg: number;
  total_in_pocket: number;
  effective_tax_rate: number;
  tax_saved_vs_all_salary: number;
  warnings: string[];
  blockers: string[];
  disclaimer: string;
  constants_version: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n);
}

// ── Grundavdrag (under 66, SKV 433) ─────────────────────────────────────

function grundavdrag(income: number, PBB: number): number {
  if (income <= 0) return 0;
  const b1 = 0.99 * PBB;
  const b2 = 2.72 * PBB;
  const b3 = 3.11 * PBB;
  const b4 = 7.88 * PBB;
  if (income <= b1) return Math.min(Math.round(0.423 * PBB), income);
  if (income <= b2) return Math.round(0.423 * PBB + 0.20 * (income - b1));
  if (income <= b3) return Math.round(0.77 * PBB);
  if (income <= b4) {
    return Math.max(
      Math.round(0.423 * PBB),
      Math.round(0.77 * PBB - 0.10 * (income - b3)),
    );
  }
  return Math.round(0.294 * PBB);
}

// ── Jobbskatteavdrag (under 66, SKV 433) ────────────────────────────────

function jobbskatteavdrag(
  income: number,
  grundavdragAmount: number,
  KI: number,
  PBB: number,
): number {
  if (income <= 0) return 0;
  const AI = income;
  const GA = grundavdragAmount;
  const b1 = 0.91 * PBB;
  const b2 = 3.24 * PBB;
  const b3 = 8.08 * PBB;
  let jsa: number;
  if (AI <= b1) {
    jsa = (AI - GA) * KI;
  } else if (AI <= b2) {
    jsa = (0.91 * PBB + 0.3874 * (AI - b1) - GA) * KI;
  } else if (AI <= b3) {
    jsa = (1.813 * PBB + 0.251 * (AI - b2) - GA) * KI;
  } else {
    jsa = (3.027 * PBB - GA) * KI;
  }
  return Math.max(0, Math.round(jsa));
}

// ── Full income tax model ───────────────────────────────────────────────

function calculateIncomeTax(
  income: number,
  rates: ResolvedRates,
  c: TaxConstants,
): TaxBreakdown {
  if (income <= 0) {
    return {
      grundavdrag: 0,
      kommunalskatt: 0,
      begravningsavgift: 0,
      kyrkoavgift: 0,
      statlig_skatt: 0,
      gross_tax: 0,
      jobbskatteavdrag: 0,
      net_tax: 0,
    };
  }
  const GA = grundavdrag(income, c.PBB);
  const taxable = Math.max(0, income - GA);
  const kommunalskatt = round(taxable * rates.KI);
  const begravningsavgift = round(taxable * rates.burial);
  const kyrkoavgift = round(taxable * rates.church);
  const statlig_skatt = round(
    Math.max(0, taxable - c.SKIKTGRANS) * c.STATE_TAX_RATE,
  );
  const gross_tax =
    kommunalskatt + begravningsavgift + kyrkoavgift + statlig_skatt;
  const jsa = jobbskatteavdrag(income, GA, rates.KI, c.PBB);
  const jsa_capped = Math.min(jsa, kommunalskatt);
  const net_tax = Math.max(0, gross_tax - jsa_capped);
  return {
    grundavdrag: GA,
    kommunalskatt,
    begravningsavgift,
    kyrkoavgift,
    statlig_skatt,
    gross_tax,
    jobbskatteavdrag: jsa_capped,
    net_tax,
  };
}

// ── Marginal income tax ─────────────────────────────────────────────────

function salaryIncomeTax(
  salary: number,
  externalIncome: number,
  rates: ResolvedRates,
  c: TaxConstants,
): { marginalTax: number; totalBreakdown: TaxBreakdown } {
  const totalBreakdown = calculateIncomeTax(externalIncome + salary, rates, c);
  const externalBreakdown = calculateIncomeTax(externalIncome, rates, c);
  const marginalTax = totalBreakdown.net_tax - externalBreakdown.net_tax;
  return { marginalTax, totalBreakdown };
}

// ── Salary strategy targets ─────────────────────────────────────────────

function getSalaryTargets(c: TaxConstants) {
  return {
    sgi: c.SGI_MAX,
    pension: c.PENSION_MAX_GROSS,
    balanced: c.BRYTPUNKT,
  };
}

// ── Build salary scenario ───────────────────────────────────────────────

function buildSalaryScenario(
  targetSalary: number,
  externalIncome: number,
  profit: number,
  rates: ResolvedRates,
  c: TaxConstants,
  note: string,
  computeDividendNetFn: (salary: number) => number,
): SalaryScenario {
  const maxAffordable = round(profit / (1 + c.EMPLOYER_FEE_RATE));
  const adjustedTarget = Math.max(0, targetSalary - externalIncome);
  const salary = Math.max(0, Math.min(adjustedTarget, maxAffordable));
  const { marginalTax } = salaryIncomeTax(salary, externalIncome, rates, c);
  const net_salary = salary - marginalTax;
  const netDividend = computeDividendNetFn(salary);
  return {
    salary,
    net_salary,
    total_in_pocket: net_salary + netDividend,
    note,
  };
}

// ── P-fond iteration ────────────────────────────────────────────────────

function computePfondAmount(
  remainingProfit: number,
  totalDividendSpace: number,
  liquidAssets: number,
  c: TaxConstants,
): number {
  let pfond = 0;
  for (let i = 0; i < 10; i++) {
    const taxableAfterPfond = remainingProfit - pfond;
    const corpTax = round(taxableAfterPfond * c.CORP_TAX_RATE);
    const freeEq = taxableAfterPfond - corpTax;
    const dividend = Math.max(
      0,
      round(Math.min(totalDividendSpace, freeEq, liquidAssets)),
    );
    const pretaxForDiv =
      dividend > 0 ? round(dividend / (1 - c.CORP_TAX_RATE)) : 0;
    const newPfond = Math.min(
      round(remainingProfit * c.PFOND_MAX_SHARE),
      Math.max(0, remainingProfit - pretaxForDiv),
    );
    if (Math.abs(newPfond - pfond) < 1) break;
    pfond = newPfond;
  }
  return pfond;
}

// ── Compute dividend net for a given salary ─────────────────────────────

function computeDividendNet(
  salary: number,
  input: TaxOptimizerInput,
  c: TaxConstants,
): number {
  const employerFees = round(salary * c.EMPLOYER_FEE_RATE);
  const totalCost = salary + employerFees;
  const remainingProfit = input.profit_before_salary - totalCost;
  if (remainingProfit <= 0) return 0;

  const totalPayroll = salary + input.total_payroll_others;
  let salaryBasedSpace = round(
    Math.max(0, c.SALARY_BASED_SHARE * (totalPayroll - c.SALARY_DEDUCTION)),
  );
  salaryBasedSpace = Math.min(salaryBasedSpace, c.SALARY_SPACE_CAP_FACTOR * salary);

  const baseAmount = c.BASE_AMOUNT;
  const omkostnadsbelopp = input.omkostnadsbelopp ?? 25_000;
  const omkostnadsTillagg = Math.max(
    0,
    round(
      (omkostnadsbelopp - c.OMKOSTNADSBELOPP_THRESHOLD) *
        (c.SLR + c.OMKOSTNADSBELOPP_RATE_ADDON),
    ),
  );
  const totalDividendSpace =
    baseAmount +
    salaryBasedSpace +
    omkostnadsTillagg +
    input.saved_dividend_space;

  let pfondAmount = 0;
  if (input.planned_downtime_within_3_years) {
    pfondAmount = computePfondAmount(
      remainingProfit,
      totalDividendSpace,
      input.liquid_assets,
      c,
    );
  }

  const taxableAfterPfond = remainingProfit - pfondAmount;
  const corporateTax = round(taxableAfterPfond * c.CORP_TAX_RATE);
  const freeEquity = taxableAfterPfond - corporateTax;

  const recommendedDividend = Math.max(
    0,
    round(Math.min(totalDividendSpace, freeEquity, input.liquid_assets)),
  );
  const dividendTax = round(recommendedDividend * c.DIVIDEND_TAX_RATE);
  return recommendedDividend - dividendTax;
}

// ── Optimizer: main ─────────────────────────────────────────────────────

function optimize(
  input: TaxOptimizerInput,
  constants: TaxConstants = TAX_CONSTANTS_2026,
): TaxOptimizerOutput {
  const c = constants;
  const warnings: string[] = [];
  const blockers: string[] = [];

  const rates = resolveRates(
    input.kommun,
    input.church_member,
    input.municipal_tax_rate_override,
  );

  if (input.is_holding_company) {
    blockers.push('MVP stöder inte koncernstrukturer. Kontakta rådgivare.');
  }
  if (input.num_owners > 1) {
    blockers.push('MVP stöder enbart enägare-AB. Kontakta rådgivare.');
  }
  if (input.profit_before_salary < 0) {
    blockers.push('Bolaget går med förlust. Ingen optimering möjlig.');
  }
  if (input.is_over_66) {
    blockers.push(
      'MVP stöder ej förhöjt grundavdrag (66+). Kontakta rådgivare.',
    );
  }
  if (input.has_working_relatives) {
    warnings.push(
      'Närståenderegeln kan påverka beräkningen. Kontakta rådgivare.',
    );
  }
  if (input.total_payroll_others > 0) {
    warnings.push('B2C MVP: Optimerad för ensamkonsulter utan anställda.');
  }

  if (blockers.length > 0) {
    return zeroedOutput(blockers, warnings, c);
  }

  // STEP 1: SALARY
  const targets = getSalaryTargets(c);
  const maxAffordable = round(
    input.profit_before_salary / (1 + c.EMPLOYER_FEE_RATE),
  );
  const chosenTarget = targets[input.salary_strategy];
  const adjustedTarget = Math.max(0, chosenTarget - input.external_income);
  const salary = Math.max(
    0,
    round(Math.min(adjustedTarget, maxAffordable)),
  );
  const employerFees = round(salary * c.EMPLOYER_FEE_RATE);
  const totalSalaryCost = salary + employerFees;
  const { marginalTax: salaryTax, totalBreakdown: taxBreakdown } =
    salaryIncomeTax(salary, input.external_income, rates, c);
  const netSalary = salary - salaryTax;

  const dividendNetFn = (s: number) => computeDividendNet(s, input, c);
  const salaryScenarios = {
    sgi: buildSalaryScenario(
      targets.sgi,
      input.external_income,
      input.profit_before_salary,
      rates,
      c,
      'Maximerar SGI (sjukpenninggrundande inkomst). 10 × PBB.',
      dividendNetFn,
    ),
    pension: buildSalaryScenario(
      targets.pension,
      input.external_income,
      input.profit_before_salary,
      rates,
      c,
      'Maximerar pensionsgrundande inkomst (PGI). Ger max allmän pension.',
      dividendNetFn,
    ),
    balanced: buildSalaryScenario(
      targets.balanced,
      input.external_income,
      input.profit_before_salary,
      rates,
      c,
      'Lön upp till brytpunkten. Balans mellan skatt och trygghet.',
      dividendNetFn,
    ),
  };

  // STEP 2: DIVIDEND SPACE
  const totalPayroll = salary + input.total_payroll_others;
  let salaryBasedSpace = round(
    Math.max(0, c.SALARY_BASED_SHARE * (totalPayroll - c.SALARY_DEDUCTION)),
  );
  salaryBasedSpace = Math.min(salaryBasedSpace, c.SALARY_SPACE_CAP_FACTOR * salary);
  const baseAmount = c.BASE_AMOUNT;
  const omkostnadsbelopp = input.omkostnadsbelopp ?? 25_000;
  const omkostnadsTillagg = Math.max(
    0,
    round(
      (omkostnadsbelopp - c.OMKOSTNADSBELOPP_THRESHOLD) *
        (c.SLR + c.OMKOSTNADSBELOPP_RATE_ADDON),
    ),
  );
  const totalDividendSpace =
    baseAmount +
    salaryBasedSpace +
    omkostnadsTillagg +
    input.saved_dividend_space;
  const remainingProfit = input.profit_before_salary - totalSalaryCost;

  // STEP 3: P-FOND
  let appliedPfond = 0;
  let pfondRecommended = false;
  if (input.planned_downtime_within_3_years && remainingProfit > 0) {
    appliedPfond = computePfondAmount(
      remainingProfit,
      totalDividendSpace,
      input.liquid_assets,
      c,
    );
    pfondRecommended = appliedPfond > 0;
  }

  // STEP 4: CORPORATE TAX & EQUITY
  const taxableAfterPfond = remainingProfit - appliedPfond;
  const corporateTax = round(taxableAfterPfond * c.CORP_TAX_RATE);
  const freeEquity = taxableAfterPfond - corporateTax;

  // STEP 5: THREE-CAP DIVIDEND
  let recommendedDividend: number;
  let capReason: 'space' | 'equity' | 'liquidity';
  if (
    totalDividendSpace <= freeEquity &&
    totalDividendSpace <= input.liquid_assets
  ) {
    recommendedDividend = totalDividendSpace;
    capReason = 'space';
  } else if (
    freeEquity <= totalDividendSpace &&
    freeEquity <= input.liquid_assets
  ) {
    recommendedDividend = freeEquity;
    capReason = 'equity';
  } else {
    recommendedDividend = input.liquid_assets;
    capReason = 'liquidity';
  }
  recommendedDividend = Math.max(0, round(recommendedDividend));

  if (
    recommendedDividend > input.liquid_assets &&
    capReason !== 'liquidity'
  ) {
    warnings.push(
      'Utdelningen överstiger tillgänglig kassa. Risk för likviditetsbrist.',
    );
  }

  const safetyBuffer = input.safety_buffer ?? 0;
  const recommendedDividendAfterBuffer = Math.max(
    0,
    recommendedDividend - safetyBuffer,
  );
  const dividendTax = round(recommendedDividend * c.DIVIDEND_TAX_RATE);
  const netDividend = recommendedDividend - dividendTax;
  const savedSpaceNextYear = Math.max(
    0,
    totalDividendSpace - recommendedDividend,
  );

  // STEP 6: SURPLUS
  const surplusAfterDividend = Math.max(0, freeEquity - recommendedDividend);

  let scenarioPfondAmount: number;
  if (input.planned_downtime_within_3_years) {
    scenarioPfondAmount = appliedPfond;
  } else {
    const pfondMax = round(remainingProfit * c.PFOND_MAX_SHARE);
    const pretaxSurplus = round(
      surplusAfterDividend / (1 - c.CORP_TAX_RATE),
    );
    scenarioPfondAmount = Math.min(pretaxSurplus, pfondMax);
  }
  const pfondTaxDeferred = round(scenarioPfondAmount * c.CORP_TAX_RATE);
  const reversalYear = new Date().getFullYear() + c.PFOND_REVERSAL_YEARS;
  const discountFactor =
    1 - 1 / Math.pow(1 + c.PFOND_DISCOUNT_RATE, c.PFOND_REVERSAL_YEARS);
  const pfondNetEffect = round(pfondTaxDeferred * discountFactor);

  const retainAmount = surplusAfterDividend;
  const retainTaxPaid = round(
    (surplusAfterDividend / (1 - c.CORP_TAX_RATE)) * c.CORP_TAX_RATE,
  );

  // TOTALS
  const totalInPocket = netSalary + netDividend;
  const totalTaxPaid =
    salaryTax + employerFees + corporateTax + dividendTax;
  const effectiveTaxRate =
    input.profit_before_salary > 0
      ? totalTaxPaid / input.profit_before_salary
      : 0;

  const allSalarySalary = round(
    input.profit_before_salary / (1 + c.EMPLOYER_FEE_RATE),
  );
  const { marginalTax: allSalaryTax } = salaryIncomeTax(
    allSalarySalary,
    input.external_income,
    rates,
    c,
  );
  const allSalaryNet = allSalarySalary - allSalaryTax;
  const taxSavedVsAllSalary =
    allSalaryNet > 0 ? totalInPocket - allSalaryNet : 0;

  return {
    recommended_salary: salary,
    employer_fees: employerFees,
    total_salary_cost: totalSalaryCost,
    salary_income_tax: salaryTax,
    net_salary: netSalary,
    tax_breakdown: taxBreakdown,
    salary_scenarios: salaryScenarios,
    base_amount: baseAmount,
    salary_based_space: salaryBasedSpace,
    total_dividend_space: totalDividendSpace,
    recommended_dividend: recommendedDividend,
    safety_buffer: safetyBuffer,
    recommended_dividend_after_buffer: recommendedDividendAfterBuffer,
    dividend_tax: dividendTax,
    net_dividend: netDividend,
    saved_space_next_year: savedSpaceNextYear,
    dividend_cap_reason: capReason,
    remaining_profit: remainingProfit,
    corporate_tax: corporateTax,
    free_equity: freeEquity,
    surplus_after_dividend: surplusAfterDividend,
    pfond_scenario: {
      amount: scenarioPfondAmount,
      tax_deferred: pfondTaxDeferred,
      reversal_year: reversalYear,
      net_effect_5yr: pfondNetEffect,
    },
    pfond_recommended: pfondRecommended,
    retain_scenario: {
      amount: retainAmount,
      tax_paid_now: retainTaxPaid,
      available_for_investment: retainAmount,
    },
    omkostnadsbelopp_tillagg: omkostnadsTillagg,
    total_in_pocket: totalInPocket,
    effective_tax_rate: Math.round(effectiveTaxRate * 10000) / 10000,
    tax_saved_vs_all_salary: taxSavedVsAllSalary,
    warnings,
    blockers,
    disclaimer: DISCLAIMER,
    constants_version: c.VERSION,
  };
}

// ── Zeroed output (for blockers) ────────────────────────────────────────

function zeroedOutput(
  blockers: string[],
  warnings: string[],
  c: TaxConstants,
): TaxOptimizerOutput {
  const zeroBreakdown: TaxBreakdown = {
    grundavdrag: 0,
    kommunalskatt: 0,
    begravningsavgift: 0,
    kyrkoavgift: 0,
    statlig_skatt: 0,
    gross_tax: 0,
    jobbskatteavdrag: 0,
    net_tax: 0,
  };
  const zeroScenario: SalaryScenario = {
    salary: 0,
    net_salary: 0,
    total_in_pocket: 0,
    note: '',
  };
  return {
    recommended_salary: 0,
    employer_fees: 0,
    total_salary_cost: 0,
    salary_income_tax: 0,
    net_salary: 0,
    tax_breakdown: zeroBreakdown,
    salary_scenarios: {
      sgi: zeroScenario,
      pension: zeroScenario,
      balanced: zeroScenario,
    },
    base_amount: 0,
    salary_based_space: 0,
    total_dividend_space: 0,
    recommended_dividend: 0,
    safety_buffer: 0,
    recommended_dividend_after_buffer: 0,
    dividend_tax: 0,
    net_dividend: 0,
    saved_space_next_year: 0,
    dividend_cap_reason: 'space',
    remaining_profit: 0,
    corporate_tax: 0,
    free_equity: 0,
    surplus_after_dividend: 0,
    pfond_scenario: {
      amount: 0,
      tax_deferred: 0,
      reversal_year: 0,
      net_effect_5yr: 0,
    },
    pfond_recommended: false,
    retain_scenario: {
      amount: 0,
      tax_paid_now: 0,
      available_for_investment: 0,
    },
    omkostnadsbelopp_tillagg: 0,
    total_in_pocket: 0,
    effective_tax_rate: 0,
    tax_saved_vs_all_salary: 0,
    warnings,
    blockers,
    disclaimer: DISCLAIMER,
    constants_version: c.VERSION,
  };
}

const DISCLAIMER =
  'KAMMAREN Skatteoptimering är ett beräkningsverktyg. ' +
  'Resultaten baseras på offentliga regler och de uppgifter du anger. ' +
  'Detta utgör inte skatte- eller juridisk rådgivning. ' +
  'Konsultera alltid en auktoriserad redovisningskonsult innan du fattar beslut.';

const SOURCES = [
  {
    name: 'IL 57 kap (3:12-reglerna)',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/',
    date: '2026-03-14',
  },
  {
    name: 'Skatteverket: Inkomstbasbelopp',
    url: 'https://www.skatteverket.se/privat/skatter/beloppochprocent/inkomstbasbelopp.4.5fc8c94513259a4ba1d800027610.html',
    date: '2026-03-14',
  },
  {
    name: 'Skatteverket: Arbetsgivaravgifter',
    url: 'https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html',
    date: '2026-03-14',
  },
];

// ── SkillInput → SkillOutput adapter ────────────────────────────────────

const REQUIRED_FIELDS: Array<{ key: string; type: 'number' | 'boolean' }> = [
  { key: 'revenue', type: 'number' },
  { key: 'costs', type: 'number' },
  { key: 'municipal_tax_rate', type: 'number' },
  { key: 'church_member', type: 'boolean' },
  { key: 'saved_dividend_space', type: 'number' },
  { key: 'num_owners', type: 'number' },
];

export function calculate(input: SkillInput): SkillOutput {
  // A. Validate required inputs — throw with ALL missing fields
  const missing: string[] = [];
  for (const { key, type } of REQUIRED_FIELDS) {
    if (input[key] === undefined || input[key] === null) {
      missing.push(`${key} (${type})`);
    } else if (typeof input[key] !== type) {
      missing.push(`${key} (förväntat ${type}, fick ${typeof input[key]})`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `tax-optimizer: Saknade eller felaktiga fält: ${missing.join(', ')}`,
    );
  }

  const revenue = input.revenue as number;
  const costs = input.costs as number;
  const municipalTaxRate = input.municipal_tax_rate as number;
  const churchMember = input.church_member as boolean;
  const savedDividendSpace = input.saved_dividend_space as number;
  const numOwners = input.num_owners as number;
  const kommun = (input.kommun as string) || '';
  const salaryStrategy =
    (input.salary_strategy as 'sgi' | 'pension' | 'balanced') || 'balanced';
  const profitBeforeSalary = revenue - costs;

  // B. Map to TaxOptimizerInput and call optimize()
  const optimizerInput: TaxOptimizerInput = {
    profit_before_salary: profitBeforeSalary,
    liquid_assets: (input.liquid_assets as number) ?? profitBeforeSalary,
    total_payroll_others: (input.total_payroll_others as number) ?? 0,
    owner_salary_taken: (input.owner_salary_taken as number) ?? 0,
    external_income: (input.external_income as number) ?? 0,
    kommun,
    church_member: churchMember,
    municipal_tax_rate_override: municipalTaxRate,
    saved_dividend_space: savedDividendSpace,
    is_holding_company: (input.is_holding_company as boolean) ?? false,
    has_working_relatives: (input.has_working_relatives as boolean) ?? false,
    num_owners: numOwners,
    salary_strategy: salaryStrategy,
    planned_downtime_within_3_years:
      (input.planned_downtime_within_3_years as boolean) ?? false,
    omkostnadsbelopp: input.omkostnadsbelopp as number | undefined,
    is_over_66: input.is_over_66 as boolean | undefined,
    safety_buffer: input.safety_buffer as number | undefined,
  };

  const r = optimize(optimizerInput);

  // C. Wrap in SkillOutput
  const result: Record<string, number | string> = {
    optimal_lon: r.recommended_salary,
    arbetsgivaravgifter: r.employer_fees,
    total_lonekostnad: r.total_salary_cost,
    inkomstskatt_lon: r.salary_income_tax,
    netto_lon: r.net_salary,
    utdelningsutrymme: r.total_dividend_space,
    rekommenderad_utdelning: r.recommended_dividend,
    utdelningsskatt: r.dividend_tax,
    netto_utdelning: r.net_dividend,
    bolagsskatt: r.corporate_tax,
    total_netto: r.total_in_pocket,
    effektiv_skattesats: `${(r.effective_tax_rate * 100).toFixed(2)}%`,
    skattebesparing_vs_enbart_lon: r.tax_saved_vs_all_salary,
    utdelningsbegransning: r.dividend_cap_reason,
    sparat_utrymme_nasta_ar: r.saved_space_next_year,
  };

  const breakdown: Record<string, number | string>[] = [
    {
      steg: '1. Löneberäkning',
      lon: r.recommended_salary,
      arbetsgivaravgifter: r.employer_fees,
      total_kostnad: r.total_salary_cost,
      strategi: salaryStrategy,
    },
    {
      steg: '2. Inkomstskatt',
      grundavdrag: r.tax_breakdown.grundavdrag,
      kommunalskatt: r.tax_breakdown.kommunalskatt,
      begravningsavgift: r.tax_breakdown.begravningsavgift,
      kyrkoavgift: r.tax_breakdown.kyrkoavgift,
      statlig_skatt: r.tax_breakdown.statlig_skatt,
      jobbskatteavdrag: r.tax_breakdown.jobbskatteavdrag,
      nettoskatt: r.tax_breakdown.net_tax,
    },
    {
      steg: '3. Utdelningsutrymme',
      grundbelopp: r.base_amount,
      lonebaserat: r.salary_based_space,
      omkostnadsbelopp_tillagg: r.omkostnadsbelopp_tillagg,
      sparat_fran_tidigare: savedDividendSpace,
      totalt: r.total_dividend_space,
    },
    {
      steg: '4. Bolagsskatt',
      kvarstaende_vinst: r.remaining_profit,
      bolagsskatt: r.corporate_tax,
      fritt_eget_kapital: r.free_equity,
    },
    {
      steg: '5. Utdelning',
      rekommenderad: r.recommended_dividend,
      skatt: r.dividend_tax,
      netto: r.net_dividend,
      begransning: r.dividend_cap_reason,
    },
    {
      steg: '6. Totalt',
      netto_lon: r.net_salary,
      netto_utdelning: r.net_dividend,
      totalt_i_fickan: r.total_in_pocket,
    },
  ];

  // Add scenario-specific warnings
  const skillWarnings = [...r.warnings, ...r.blockers];
  const totalPayroll =
    r.recommended_salary + (optimizerInput.total_payroll_others ?? 0);
  if (totalPayroll < TAX_CONSTANTS_2026.SALARY_DEDUCTION) {
    skillWarnings.push(
      `Lönen understiger ${TAX_CONSTANTS_2026.SALARY_DEDUCTION_FACTOR}×IBB (${TAX_CONSTANTS_2026.SALARY_DEDUCTION} SEK). Lönebaserat utdelningsutrymme = 0.`,
    );
  }

  return {
    result,
    breakdown,
    warnings: skillWarnings,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    version: '2026-03-14-v1',
  };
}
