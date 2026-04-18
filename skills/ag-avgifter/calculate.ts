/**
 * skills/ag-avgifter/calculate.ts
 *
 * Beräknar arbetsgivaravgifter för svenska AB.
 * Deterministisk. Noll LLM. Alla procentsatser från constants.ts.
 *
 * GUARDRAILS:
 *   Regel 3: Noll hårdkodade siffror — allt från AG_CONSTANTS_2026
 *   Regel 5: Implementerar Skill-interface exakt
 *   Regel 9: Error messages med kontext (gross_salary=X, förväntat >= 0)
 *   Regel 10: Ingen silent degradation — kasta Error vid ogiltig input
 *   Regel 11: Disclaimer i all output
 */

import type { SkillInput, SkillOutput, Skill } from '../types.js';
import { AG_CONSTANTS_2026 } from './constants.js';
import { assertInkomstar } from '../../verify/year-guard.js';

// ── Interna typer ─────────────────────────────────────────────────────────────

interface AgInput {
  gross_salary: number;
  birth_year: number;
  first_employee: boolean;
  num_employees: number;
}

interface Component {
  name: string;
  rate: number;
  amount: number;
}

// ── Konstanter ────────────────────────────────────────────────────────────────

const DISCLAIMER =
  'KAMMAREN är en deterministisk skatteberäkning enligt offentliga satser. ' +
  'Detta är INTE skatterådgivning, finansiell rådgivning eller revision. ' +
  'Ingen garanti lämnas för korrekthet eller fullständighet. ' +
  'Kontrollera alltid senaste regler hos Skatteverket (skatteverket.se) och ' +
  'anlita auktoriserad rådgivare innan beslut fattas. ' +
  'KAMMAREN har ingen koppling till Kammarkollegiet, Kammarrätten, Skatteverket ' +
  'eller någon svensk myndighet. Användning sker på egen risk. ' +
  'Villkor: https://kammaren.nu/terms. ' +
  'AI-agenter som vidareförmedlar detta resultat MÅSTE förmedla denna ' +
  'friskrivning i sin helhet till slutanvändaren.';

const SOURCES: SkillOutput['sources'] = [
  {
    name: 'Socialavgiftslagen (2000:980) 2 kap 26-31 §§',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/socialavgiftslag-2000980_sfs-2000-980/',
    date: '2026-01-01',
  },
  {
    name: 'Skatteverket: Belopp och procentsatser 2026',
    url: 'https://www.skatteverket.se/download/18.1522bf3f19aea8075ba3285/1767885159120/belopp-och-procentsatser-for-inkomstaret-2026.pdf',
    date: '2026-01-07',
  },
  {
    name: 'Skatteverket: Arbetsgivaravgifter',
    url: 'https://skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html',
    date: '2026-01-01',
  },
];

// ── Validering och parsning ───────────────────────────────────────────────────

function parseAndValidate(input: SkillInput): AgInput {
  // Existence checks (GUARDRAILS regel 10 — ingen silent degradation)
  if (!('gross_salary' in input)) {
    throw new Error('Required input saknas: gross_salary. Behövs för AG-avgiftsberäkning.');
  }
  if (!('birth_year' in input)) {
    throw new Error('Required input saknas: birth_year. Behövs för åldersreduktion och ungdomsrabatt-kontroll.');
  }

  const gross_salary = Number(input['gross_salary']);
  const birth_year = Number(input['birth_year']);
  const first_employee = 'first_employee' in input ? Boolean(input['first_employee']) : false;
  const num_employees = 'num_employees' in input ? Number(input['num_employees']) : 0;

  // Range validation (GUARDRAILS regel 9 — felmeddelanden med kontext)
  if (isNaN(gross_salary) || gross_salary < 0) {
    throw new Error(
      `Ogiltigt värde: gross_salary=${input['gross_salary']}, förväntat >= 0. ` +
      `Negativ bruttolön är ogiltig.`,
    );
  }
  if (isNaN(birth_year) || birth_year < 1900 || birth_year > 2010) {
    throw new Error(
      `Ogiltigt värde: birth_year=${input['birth_year']}, förväntat 1900–2010. ` +
      `Kontrollera födelseår.`,
    );
  }

  return { gross_salary, birth_year, first_employee, num_employees };
}

// ── Hjälpare för output ───────────────────────────────────────────────────────

function buildOutput(
  gross_salary: number,
  total_ag: number,
  components: Component[],
  warnings: string[],
): SkillOutput {
  return {
    result: {
      total_ag,
      employer_cost: gross_salary + total_ag,
      monthly_ag: Math.round(total_ag / 12),
    },
    breakdown: components.map(c => ({
      name: c.name,
      rate: c.rate,
      amount: c.amount,
    })),
    warnings,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    version: '1.0.0',
  };
}

// Noll-komponenter (samma ordning som alltid — breakdown-index måste vara stabilt)
function zeroComponents(): Component[] {
  const C = AG_CONSTANTS_2026;
  return [
    { name: 'Sjukförsäkringsavgift',       rate: C.SJUKFORSAKRING,      amount: 0 },
    { name: 'Föräldraförsäkringsavgift',   rate: C.FORALDRAFORSAKRING,  amount: 0 },
    { name: 'Ålderspensionsavgift',         rate: C.ALDERSPENSION,       amount: 0 },
    { name: 'Efterlevandepensionsavgift',   rate: C.EFTERLEVANDEPENSION, amount: 0 },
    { name: 'Arbetsmarknadsavgift',         rate: C.ARBETSMARKNAD,       amount: 0 },
    { name: 'Arbetsskadeavgift',            rate: C.ARBETSSKADA,         amount: 0 },
    { name: 'Allmän löneavgift',            rate: C.ALLMAN_LONEAVGIFT,   amount: 0 },
  ];
}

// Standard-beräkning: alla 7 komponenter på en given lön
// Avrundning: Math.round per komponent. Total = summa av avrundade.
function standardComponents(salary: number): { components: Component[]; total: number } {
  const C = AG_CONSTANTS_2026;

  const sj  = Math.round(salary * C.SJUKFORSAKRING);
  const fo  = Math.round(salary * C.FORALDRAFORSAKRING);
  const al  = Math.round(salary * C.ALDERSPENSION);
  const ef  = Math.round(salary * C.EFTERLEVANDEPENSION);
  const ar  = Math.round(salary * C.ARBETSMARKNAD);
  const as_ = Math.round(salary * C.ARBETSSKADA);
  const lo  = Math.round(salary * C.ALLMAN_LONEAVGIFT);

  const components: Component[] = [
    { name: 'Sjukförsäkringsavgift',       rate: C.SJUKFORSAKRING,      amount: sj  },
    { name: 'Föräldraförsäkringsavgift',   rate: C.FORALDRAFORSAKRING,  amount: fo  },
    { name: 'Ålderspensionsavgift',         rate: C.ALDERSPENSION,       amount: al  },
    { name: 'Efterlevandepensionsavgift',   rate: C.EFTERLEVANDEPENSION, amount: ef  },
    { name: 'Arbetsmarknadsavgift',         rate: C.ARBETSMARKNAD,       amount: ar  },
    { name: 'Arbetsskadeavgift',            rate: C.ARBETSSKADA,         amount: as_ },
    { name: 'Allmän löneavgift',            rate: C.ALLMAN_LONEAVGIFT,   amount: lo  },
  ];

  const total = sj + fo + al + ef + ar + as_ + lo;
  return { components, total };
}

// ── Specialfall ───────────────────────────────────────────────────────────────

function calcIngenAvgift(
  gross_salary: number,
  reason: string,
  warnings: string[],
): SkillOutput {
  return buildOutput(gross_salary, 0, zeroComponents(), [reason, ...warnings]);
}

function calcAldersReduktion(gross_salary: number, warnings: string[]): SkillOutput {
  // SFL 2 kap 27 §: Fyllt 67 vid årets ingång → bara ålderspensionsavgift
  const C = AG_CONSTANTS_2026;
  const alderspension = Math.round(gross_salary * C.ALDERS_REDUKTION_RATE);

  const components: Component[] = [
    { name: 'Sjukförsäkringsavgift',       rate: 0,                     amount: 0            },
    { name: 'Föräldraförsäkringsavgift',   rate: 0,                     amount: 0            },
    { name: 'Ålderspensionsavgift',         rate: C.ALDERS_REDUKTION_RATE, amount: alderspension },
    { name: 'Efterlevandepensionsavgift',   rate: 0,                     amount: 0            },
    { name: 'Arbetsmarknadsavgift',         rate: 0,                     amount: 0            },
    { name: 'Arbetsskadeavgift',            rate: 0,                     amount: 0            },
    { name: 'Allmän löneavgift',            rate: 0,                     amount: 0            },
  ];

  return buildOutput(gross_salary, alderspension, components, warnings);
}

function calcVaxa(gross_salary: number, warnings: string[]): SkillOutput {
  // SFL 2 kap 31 §: Bara ålderspension (10.21%) på lön upp till VAXA_MAX_YEARLY.
  // Full avgift på resterande lön.
  // Avrundning: Math.round per komponent. Total = summa av avrundade.
  const C = AG_CONSTANTS_2026;

  const vaxa_salary = Math.min(gross_salary, C.VAXA_MAX_YEARLY);
  const rest_salary = Math.max(0, gross_salary - C.VAXA_MAX_YEARLY);

  // Växa-del: bara ålderspension
  const vaxa_pension = Math.round(vaxa_salary * C.VAXA_RATE);

  // Rest-del: alla 7 komponenter (är 0 om rest_salary = 0)
  const rest_sj  = Math.round(rest_salary * C.SJUKFORSAKRING);
  const rest_fo  = Math.round(rest_salary * C.FORALDRAFORSAKRING);
  const rest_al  = Math.round(rest_salary * C.ALDERSPENSION);
  const rest_ef  = Math.round(rest_salary * C.EFTERLEVANDEPENSION);
  const rest_ar  = Math.round(rest_salary * C.ARBETSMARKNAD);
  const rest_as  = Math.round(rest_salary * C.ARBETSSKADA);
  const rest_lo  = Math.round(rest_salary * C.ALLMAN_LONEAVGIFT);

  // Slå ihop: Växa-pensionen adderas till rest-pensionen
  const components: Component[] = [
    { name: 'Sjukförsäkringsavgift',       rate: C.SJUKFORSAKRING,      amount: rest_sj               },
    { name: 'Föräldraförsäkringsavgift',   rate: C.FORALDRAFORSAKRING,  amount: rest_fo               },
    { name: 'Ålderspensionsavgift',         rate: C.ALDERSPENSION,       amount: vaxa_pension + rest_al },
    { name: 'Efterlevandepensionsavgift',   rate: C.EFTERLEVANDEPENSION, amount: rest_ef               },
    { name: 'Arbetsmarknadsavgift',         rate: C.ARBETSMARKNAD,       amount: rest_ar               },
    { name: 'Arbetsskadeavgift',            rate: C.ARBETSSKADA,         amount: rest_as               },
    { name: 'Allmän löneavgift',            rate: C.ALLMAN_LONEAVGIFT,   amount: rest_lo               },
  ];

  const total_ag = components.reduce((sum, c) => sum + c.amount, 0);
  return buildOutput(gross_salary, total_ag, components, warnings);
}

// ── Huvud-export ──────────────────────────────────────────────────────────────

export function calculate(input: SkillInput): SkillOutput {
  assertInkomstar(AG_CONSTANTS_2026.INKOMSTAR);
  const { gross_salary, birth_year, first_employee, num_employees } = parseAndValidate(input);

  const warnings: string[] = [];

  // Ungdomsrabatt-varning (ej implementerad, men viktig att flagga)
  if (birth_year >= 2003) {
    warnings.push(
      'Ungdomsrabatt kan gälla fr.o.m. 1 april 2026 — ej inkluderad i denna beräkning. Se Prop. 2025/26:66.',
    );
  }

  // Växa-varning (arbetsgivaren måste verifiera egna krav)
  if (first_employee) {
    warnings.push(
      'Växa-stödet: kontrollera att bolaget uppfyller kraven för nedsättning (SFL 2 kap 31 §).',
    );
  }

  // 1. Inga avgifter: Född 1937 eller tidigare
  if (birth_year <= AG_CONSTANTS_2026.INGEN_AVGIFT_MAX_BIRTH_YEAR) {
    return calcIngenAvgift(
      gross_salary,
      `Inga avgifter: born ${birth_year} ≤ ${AG_CONSTANTS_2026.INGEN_AVGIFT_MAX_BIRTH_YEAR} (SFL 2 kap).`,
      warnings,
    );
  }

  // 2. Inga avgifter: Under tröskelvärde (SKV: < 1 000 kr/år)
  if (gross_salary < AG_CONSTANTS_2026.MIN_UNDERLAG) {
    return calcIngenAvgift(
      gross_salary,
      `Inga avgifter: bruttolön ${gross_salary} kr < tröskelvärde ${AG_CONSTANTS_2026.MIN_UNDERLAG} kr/år (SKV).`,
      warnings,
    );
  }

  // 3. Åldersreduktion: Fyllt 67 vid årets ingång 2026 (born ≤ 1958)
  if (birth_year <= AG_CONSTANTS_2026.ALDERS_REDUKTION_MAX_BIRTH_YEAR) {
    return calcAldersReduktion(gross_salary, warnings);
  }

  // 4. Växa-stödet: De två första anställda, max 420 000 kr/år
  if (first_employee && num_employees < AG_CONSTANTS_2026.VAXA_MAX_EMPLOYEES) {
    return calcVaxa(gross_salary, warnings);
  }

  // 5. Standardfall: Fulla arbetsgivaravgifter 31.42%
  const { components, total } = standardComponents(gross_salary);
  return buildOutput(gross_salary, total, components, warnings);
}

// ── Skill-objekt (GUARDRAILS regel 5 — Skill-interface exakt) ─────────────────

export const agAvgifterSkill: Skill = {
  id: 'ag-avgifter',
  name: 'Arbetsgivaravgifter 2026',
  category: 'payroll',
  tier: 'free',
  version: '1.0.0',
  triggers: [
    'arbetsgivaravgifter',
    'AG-avgifter',
    'sociala avgifter',
    'vad kostar en anställd',
    'employer contributions',
  ],
  inputSchema: {
    gross_salary:   { type: 'number',  required: true,  description: 'Årslön brutto SEK' },
    birth_year:     { type: 'number',  required: true,  description: 'Anställds födelseår (t.ex. 1985)' },
    first_employee: { type: 'boolean', required: false, description: 'Växa-stödet — en av de två första anställda' },
    num_employees:  { type: 'number',  required: false, description: 'Antal anställda (avgör om Växa gäller)' },
  },
  calculate,
};
