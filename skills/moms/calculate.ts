/**
 * skills/moms/calculate.ts
 *
 * Beräknar mervärdesskatt (moms) för svenska AB.
 * Deterministisk. Noll LLM. Alla satser och konton från constants.ts.
 *
 * GUARDRAILS:
 *   Regel 3: Noll hårdkodade siffror — allt från MOMS_CONSTANTS_2026 / BAS_UTGAENDE / BAS_REVERSE_CHARGE
 *   Regel 5: Implementerar Skill-interface exakt
 *   Regel 9: Error messages med kontext (amount=X, vat_rate=Y)
 *   Regel 10: Ingen silent degradation — kasta Error vid ogiltig input
 *   Regel 11: Disclaimer i all output
 */

import type { SkillInput, SkillOutput, Skill } from '../types.js';
import { MOMS_CONSTANTS_2026, BAS_UTGAENDE, BAS_REVERSE_CHARGE } from './constants.js';
import { assertInkomstar } from '../../verify/year-guard.js';

// ── Interna typer ─────────────────────────────────────────────────────────────

interface MomsInput {
  amount: number;
  vat_rate: number;          // heltal: 25, 12, 6, 0
  direction: string;         // "netto_to_brutto" | "brutto_to_netto"
  reverse_charge: boolean;
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
    name: 'Mervärdesskattelagen (2023:200) 7 kap 1 §',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/mervardesskattlag-2023200_sfs-2023-200/',
    date: '2026-01-01',
  },
  {
    name: 'Mervärdesskattelagen (2023:200) 1 kap 2 § — Omvänd skattskyldighet',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/mervardesskattlag-2023200_sfs-2023-200/',
    date: '2026-01-01',
  },
  {
    name: 'Skatteverket: Mervärdesskatt (moms)',
    url: 'https://skatteverket.se/foretag/moms/momssatser.4.18e1b10334ebe8bc80003502.html',
    date: '2026-01-01',
  },
  {
    name: 'BAS 2026 kontoplan — konton 2610-2634',
    url: 'https://www.bas.se/kontoplan/',
    date: '2026-01-01',
  },
];

// ── Hjälpare ──────────────────────────────────────────────────────────────────

// Avrundning till 2 decimaler (ören). Math.round(x * 100) / 100.
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

// ── Validering och parsning ───────────────────────────────────────────────────

function parseAndValidate(input: SkillInput): MomsInput {
  // Existence checks (GUARDRAILS regel 10)
  if (!('amount' in input)) {
    throw new Error('Required input saknas: amount. Behövs för momsberäkning.');
  }
  if (!('vat_rate' in input)) {
    throw new Error('Required input saknas: vat_rate. Giltiga värden: 25, 12, 6, 0.');
  }
  if (!('direction' in input)) {
    throw new Error(
      'Required input saknas: direction. ' +
      'Giltiga värden: "netto_to_brutto", "brutto_to_netto".',
    );
  }

  const amount = Number(input['amount']);
  const vat_rate = Number(input['vat_rate']);
  const direction = String(input['direction']);
  const reverse_charge = 'reverse_charge' in input ? Boolean(input['reverse_charge']) : false;

  // Range validation (GUARDRAILS regel 9 — felmeddelanden med kontext)
  if (isNaN(amount) || amount < 0) {
    throw new Error(
      `Ogiltigt värde: amount=${input['amount']}, förväntat >= 0. ` +
      `Negativt belopp är ogiltigt.`,
    );
  }

  const validRates = [...MOMS_CONSTANTS_2026.VALID_RATES];
  if (!validRates.includes(vat_rate as 0 | 6 | 12 | 25)) {
    throw new Error(
      `Ogiltig momssats: vat_rate=${input['vat_rate']}. ` +
      `Giltiga satser 2026: ${validRates.join(', ')}.`,
    );
  }

  if (direction !== 'netto_to_brutto' && direction !== 'brutto_to_netto') {
    throw new Error(
      `Ogiltigt värde: direction="${input['direction']}". ` +
      `Giltiga värden: "netto_to_brutto", "brutto_to_netto".`,
    );
  }

  return { amount, vat_rate, direction, reverse_charge };
}

// ── Beräkningslogik ───────────────────────────────────────────────────────────

function calcReverseCharge(
  amount: number,
  vat_rate: number,
  rate_decimal: number,
  warnings: string[],
): SkillOutput {
  // ML 1 kap 2 §: Säljaren fakturerar utan moms. Köparen redovisar momsen.
  // netto = amount, moms = 0, brutto = netto
  const netto = amount;
  const moms = 0;
  const brutto = amount;
  const reverse_charge_vat = round2(amount * rate_decimal);

  // Konto: BAS_REVERSE_CHARGE gäller bara icke-noll satser
  const bas = vat_rate > 0
    ? BAS_REVERSE_CHARGE[vat_rate] ?? 0
    : 0;

  const result: Record<string, number | string> = {
    netto,
    moms,
    brutto,
    bas_konto_utgaende: bas,
    reverse_charge_vat,
  };

  return {
    result,
    breakdown: [
      { name: 'Momsunderlag (netto)',                rate: rate_decimal, amount: netto },
      { name: `Omvänd skattskyldighet ${vat_rate}%`, rate: rate_decimal, amount: reverse_charge_vat },
    ],
    warnings,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    version: '1.0.0',
  };
}

function calcNettoToBrutto(
  amount: number,
  vat_rate: number,
  rate_decimal: number,
  warnings: string[],
): SkillOutput {
  // netto → brutto: moms = round2(netto × rate), brutto = round2(netto + moms)
  const netto = amount;
  const moms = round2(netto * rate_decimal);
  const brutto = round2(netto + moms);
  const bas = BAS_UTGAENDE[vat_rate] ?? 0;

  return {
    result: { netto, moms, brutto, bas_konto_utgaende: bas },
    breakdown: [
      { name: 'Momsunderlag (netto)', rate: rate_decimal, amount: netto },
      { name: `Moms ${vat_rate}%`,   rate: rate_decimal, amount: moms  },
    ],
    warnings,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    version: '1.0.0',
  };
}

function calcBruttoToNetto(
  amount: number,
  vat_rate: number,
  rate_decimal: number,
  warnings: string[],
): SkillOutput {
  // brutto → netto: netto = round2(brutto / (1 + rate)), moms = round2(brutto − netto)
  const brutto = amount;
  const netto = round2(brutto / (1 + rate_decimal));
  const moms = round2(brutto - netto);
  const bas = BAS_UTGAENDE[vat_rate] ?? 0;

  return {
    result: { netto, moms, brutto, bas_konto_utgaende: bas },
    breakdown: [
      { name: 'Ingångspris (brutto)',  rate: rate_decimal, amount: brutto },
      { name: `Moms ${vat_rate}% av priset`, rate: rate_decimal, amount: moms },
    ],
    warnings,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    version: '1.0.0',
  };
}

// ── Huvud-export ──────────────────────────────────────────────────────────────

export function calculate(input: SkillInput): SkillOutput {
  assertInkomstar(MOMS_CONSTANTS_2026.INKOMSTAR);
  const { amount, vat_rate, direction, reverse_charge } = parseAndValidate(input);

  const rate_decimal = vat_rate / 100;
  const warnings: string[] = [];

  if (reverse_charge) {
    return calcReverseCharge(amount, vat_rate, rate_decimal, warnings);
  }

  if (direction === 'netto_to_brutto') {
    return calcNettoToBrutto(amount, vat_rate, rate_decimal, warnings);
  }

  // direction === 'brutto_to_netto'
  return calcBruttoToNetto(amount, vat_rate, rate_decimal, warnings);
}

// ── Skill-objekt (GUARDRAILS regel 5 — Skill-interface exakt) ─────────────────

export const momsSkill: Skill = {
  id: 'moms',
  name: 'Moms 2026',
  category: 'vat',
  tier: 'free',
  version: '1.0.0',
  triggers: [
    'moms',
    'mervärdesskatt',
    'beräkna moms',
    'netto till brutto',
    'brutto till netto',
    'vad är momsen',
    'VAT',
  ],
  inputSchema: {
    amount:         { type: 'number',  required: true,  description: 'Beloppet att beräkna moms på (SEK)' },
    vat_rate:       { type: 'number',  required: true,  description: 'Momssats som heltal: 25, 12, 6 eller 0' },
    direction:      { type: 'string',  required: true,  description: '"netto_to_brutto" eller "brutto_to_netto"' },
    reverse_charge: { type: 'boolean', required: false, description: 'Omvänd skattskyldighet (ML 1 kap 2 §)' },
  },
  calculate,
};
