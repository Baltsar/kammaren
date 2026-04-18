/**
 * skills/bolagsskatt/calculate.ts
 *
 * Beräknar bolagsskatt för svenska AB.
 * Deterministisk. Noll LLM. Alla siffror från constants.ts.
 *
 * GUARDRAILS:
 *   Regel 3: Noll hårdkodade siffror — allt från BOLAGSSKATT_CONSTANTS_2026
 *   Regel 5: Implementerar Skill-interface exakt
 *   Regel 9: Error messages med kontext
 *   Regel 10: Ingen silent degradation — kasta Error vid ogiltig input
 *   Regel 11: Disclaimer i all output
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * BERÄKNINGSORDNING (IL-referens per steg):
 *
 *   1. Återföring av fonder äldre än PFOND_MAX_AR år → adderas till adj
 *      (IL 30 kap 7 §: fond återförs senast inkomstår Y+6)
 *
 *   2. Schablonintäkt på IB (ALLA fonder INKLUSIVE de som återförs)
 *      (IL 30 kap 6a §: fondbelopp × statslåneräntan 30 nov föregående år)
 *
 *   3. Underskottsavdrag: min(underskott, max(0, adj)) → subtraheras
 *      (IL 40 kap: avdrag max = current adjusted result, ej negativt)
 *
 *   4. Periodiseringsfond ny avsättning:
 *      - Max = Math.floor(max(0, adj) × PFOND_MAX_ANDEL)  [konservativ floor]
 *      - Blockeras om befintliga_fonder.length ≥ PFOND_MAX_ANTAL  (före recovery)
 *      - Cappas med warning om begärd > max
 *      (IL 30 kap 5 §, 30 kap 7 §)
 *
 *   5. Skattepliktig vinst = max(0, adj_final)
 *
 *   6. Bolagsskatt = Math.round(skattepliktig_vinst × SKATTESATS)
 *      (IL 65 kap 10 §: 20.6%)
 *
 *   7. Resultat efter skatt = adj_final − bolagsskatt  (kan vara negativt)
 *
 *   8. Underskott att rulla = adj_final < 0 ? −adj_final : 0
 *      (IL 40 kap)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import type { SkillInput, SkillOutput, Skill } from '../types.js';
import { BOLAGSSKATT_CONSTANTS_2026 } from '../../constants/loader.js';
import { assertInkomstar } from '../../verify/year-guard.js';

// ── Interna typer ─────────────────────────────────────────────────────────────

interface FondPost {
  year: number;
  amount: number;
}

interface BolagsskattInput {
  taxable_profit: number;
  periodiseringsfond_avsattning: number;
  befintliga_fonder: FondPost[];
  underskott_foregaende_ar: number;
}

// ── Konstanter ────────────────────────────────────────────────────────────────

const DISCLAIMER =
  'KAMMAREN Skatteoptimering är ett beräkningsverktyg. ' +
  'Resultaten baseras på offentliga regler och de uppgifter du anger. ' +
  'Detta utgör inte skatte- eller juridisk rådgivning. ' +
  'Konsultera alltid en auktoriserad redovisningskonsult innan du fattar beslut.';

const SOURCES: SkillOutput['sources'] = [
  {
    name: 'Inkomstskattelagen (1999:1229) 65 kap 10 §',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/',
    date: '2026-01-01',
  },
  {
    name: 'Inkomstskattelagen (1999:1229) 30 kap — Periodiseringsfonder',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/',
    date: '2026-01-01',
  },
  {
    name: 'Inkomstskattelagen (1999:1229) 40 kap — Underskottsavdrag',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/',
    date: '2026-01-01',
  },
  {
    name: 'Skatteverket: Belopp och procentsatser 2026',
    url: 'https://www.skatteverket.se/download/18.1522bf3f19aea8075ba3285/1767885159120/belopp-och-procentsatser-for-inkomstaret-2026.pdf',
    date: '2026-01-07',
  },
];

// ── Validering och parsning ───────────────────────────────────────────────────

function parseAndValidate(input: SkillInput): BolagsskattInput {
  if (!('taxable_profit' in input)) {
    throw new Error('Required input saknas: taxable_profit. Behövs för bolagsskattberäkning.');
  }

  const taxable_profit = Number(input['taxable_profit']);
  const periodiseringsfond_avsattning = 'periodiseringsfond_avsattning' in input
    ? Number(input['periodiseringsfond_avsattning'])
    : 0;
  const underskott_foregaende_ar = 'underskott_foregaende_ar' in input
    ? Number(input['underskott_foregaende_ar'])
    : 0;

  if (isNaN(taxable_profit)) {
    throw new Error(
      `Ogiltigt värde: taxable_profit=${input['taxable_profit']}, förväntat tal.`,
    );
  }
  if (isNaN(periodiseringsfond_avsattning) || periodiseringsfond_avsattning < 0) {
    throw new Error(
      `Ogiltigt värde: periodiseringsfond_avsattning=${input['periodiseringsfond_avsattning']}, förväntat >= 0.`,
    );
  }
  if (isNaN(underskott_foregaende_ar) || underskott_foregaende_ar < 0) {
    throw new Error(
      `Ogiltigt värde: underskott_foregaende_ar=${input['underskott_foregaende_ar']}, förväntat >= 0.`,
    );
  }

  // befintliga_fonder tillåts som (a) array direkt, (b) JSON-sträng, eller (c) tom.
  let befintliga_fonder: FondPost[] = [];
  if ('befintliga_fonder' in input && input['befintliga_fonder'] !== '' && input['befintliga_fonder'] !== null) {
    const rawInput = input['befintliga_fonder'];
    let parsed: unknown;
    if (Array.isArray(rawInput)) {
      parsed = rawInput;
    } else if (typeof rawInput === 'string') {
      try {
        parsed = JSON.parse(rawInput);
      } catch (err) {
        throw new Error(
          `Ogiltigt värde: befintliga_fonder=${rawInput}. ` +
          `Förväntat JSON-array-sträng, t.ex. '[{"year":2023,"amount":100000}]'. ` +
          (err instanceof Error ? err.message : ''),
        );
      }
    } else {
      throw new Error(
        `Ogiltigt värde: befintliga_fonder måste vara en array eller JSON-sträng. Fick ${typeof rawInput}.`,
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error('befintliga_fonder måste vara en array.');
    }
    befintliga_fonder = parsed.map((f: unknown) => {
      if (
        typeof f !== 'object' || f === null ||
        typeof (f as Record<string, unknown>)['year'] !== 'number' ||
        typeof (f as Record<string, unknown>)['amount'] !== 'number'
      ) {
        throw new Error(
          `Ogiltig fondpost: ${JSON.stringify(f)}. Förväntat {year: number, amount: number}.`,
        );
      }
      return {
        year: (f as { year: number; amount: number }).year,
        amount: (f as { year: number; amount: number }).amount,
      };
    });
  }

  return { taxable_profit, periodiseringsfond_avsattning, befintliga_fonder, underskott_foregaende_ar };
}

// ── Huvud-export ──────────────────────────────────────────────────────────────

export function calculate(input: SkillInput): SkillOutput {
  assertInkomstar(BOLAGSSKATT_CONSTANTS_2026.INKOMSTAR);
  const {
    taxable_profit,
    periodiseringsfond_avsattning,
    befintliga_fonder,
    underskott_foregaende_ar,
  } = parseAndValidate(input);

  const C = BOLAGSSKATT_CONSTANTS_2026;
  const warnings: string[] = [];
  const breakdown: Record<string, number | string>[] = [];

  breakdown.push({
    step: '0',
    name: 'Skattemässigt resultat (input)',
    amount: taxable_profit,
  });

  // ── Steg 1: Återföring av fonder äldre än PFOND_MAX_AR år ─────────────────
  // En fond från år Y ska återföras i inkomstår Y + PFOND_MAX_AR.
  // Tröskelvärde: year ≤ INKOMSTAR − PFOND_MAX_AR
  const recoveryThreshold = C.INKOMSTAR - C.PFOND_MAX_AR; // 2026 − 6 = 2020
  const fonderAterfora = befintliga_fonder.filter(f => f.year <= recoveryThreshold);
  const aterforing = fonderAterfora.reduce((sum, f) => sum + f.amount, 0);

  if (aterforing > 0) {
    const years = fonderAterfora.map(f => f.year).sort().join(', ');
    warnings.push(
      `Obligatorisk återföring: ${fonderAterfora.length} fond(er) från år ${years} ` +
      `≥ ${C.PFOND_MAX_AR} år gamla. Totalt ${aterforing} kr (IL 30 kap 7 §).`,
    );
    breakdown.push({
      step: '1',
      name: `Återföring av fond(er) från ${years} (IL 30 kap 7 §)`,
      amount: aterforing,
    });
  }

  let adj = taxable_profit + aterforing;

  // ── Steg 2: Schablonintäkt på IB (ALLA fonder, inklusive de som återförs) ─
  const ibFonderTotal = befintliga_fonder.reduce((sum, f) => sum + f.amount, 0);
  const schablonintakt = Math.round(ibFonderTotal * C.STATSLANERANTAN);

  if (schablonintakt > 0) {
    breakdown.push({
      step: '2',
      name: `Schablonintäkt (${ibFonderTotal} kr IB × ${C.STATSLANERANTAN * 100}%) (IL 30 kap 6a §)`,
      amount: schablonintakt,
    });
    adj += schablonintakt;
  }

  // ── Steg 3: Underskottsavdrag (IL 40 kap) ─────────────────────────────────
  const underskottsavdrag = Math.min(underskott_foregaende_ar, Math.max(0, adj));
  const kvarvarande_underskott = underskott_foregaende_ar - underskottsavdrag;

  if (underskottsavdrag > 0) {
    breakdown.push({
      step: '3',
      name: 'Underskottsavdrag (IL 40 kap)',
      amount: -underskottsavdrag,
    });
    adj -= underskottsavdrag;
  }

  // ── Steg 4: Periodiseringsfond ny avsättning ───────────────────────────────
  // Max = Math.floor(max(0, adj) × PFOND_MAX_ANDEL)  [konservativ: floor]
  // Max-antal kontroll: befintliga_fonder.length FÖRE recovery (konservativt)
  const maxPfond = Math.max(0, Math.floor(adj * C.PFOND_MAX_ANDEL));
  const antalFonderForeRecovery = befintliga_fonder.length;

  let actualAvsattning = 0;

  if (antalFonderForeRecovery >= C.PFOND_MAX_ANTAL) {
    // Max-antal uppnått — ingen ny avsättning möjlig
    const oldestYear = fonderAterfora.length > 0
      ? Math.min(...fonderAterfora.map(f => f.year))
      : undefined;
    warnings.push(
      `${antalFonderForeRecovery} periodiseringsfonder finns redan (PFOND_MAX_ANTAL=${C.PFOND_MAX_ANTAL}). ` +
      `Ingen ny avsättning möjlig.` +
      (oldestYear !== undefined ? ` Fond från ${oldestYear} ska återföras (IL 30 kap 7 §).` : ''),
    );
  } else if (periodiseringsfond_avsattning > 0) {
    if (periodiseringsfond_avsattning > maxPfond) {
      warnings.push(
        `Begärd avsättning ${periodiseringsfond_avsattning} kr överstiger max 25% (${maxPfond} kr). ` +
        `Cappat till ${maxPfond} kr. (IL 30 kap 5 §)`,
      );
      actualAvsattning = maxPfond;
    } else {
      actualAvsattning = periodiseringsfond_avsattning;
    }
  }

  if (actualAvsattning > 0) {
    breakdown.push({
      step: '4',
      name: 'Periodiseringsfond ny avsättning (IL 30 kap 5 §)',
      amount: -actualAvsattning,
    });
    adj -= actualAvsattning;
  }

  // ── Steg 5–8: Skatt ───────────────────────────────────────────────────────
  const skattepliktig_vinst = Math.max(0, adj);
  const underskott_att_rulla = adj < 0 ? -adj : 0;
  const bolagsskatt = Math.round(skattepliktig_vinst * C.SKATTESATS);
  const resultat_efter_skatt = adj - bolagsskatt;
  const skatteeffekt_pfond = actualAvsattning > 0
    ? Math.round(actualAvsattning * C.SKATTESATS)
    : 0;

  breakdown.push({
    step: '5',
    name: `Bolagsskatt (${C.SKATTESATS * 100}%) (IL 65 kap 10 §)`,
    amount: -bolagsskatt,
  });

  // ── Bygg result ───────────────────────────────────────────────────────────
  const result: Record<string, number | string> = {
    skattepliktig_vinst,
    bolagsskatt,
    resultat_efter_skatt,
    periodiseringsfond_avdrag: actualAvsattning,
    aterforing,
    schablonintakt,
    underskottsavdrag,
  };

  if (skatteeffekt_pfond > 0) {
    result['skatteeffekt_pfond'] = skatteeffekt_pfond;
  }
  if (underskott_att_rulla > 0) {
    result['underskott_att_rulla'] = underskott_att_rulla;
  }
  if (kvarvarande_underskott > 0) {
    result['kvarvarande_underskott'] = kvarvarande_underskott;
  }

  return {
    result,
    breakdown,
    warnings,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    version: '1.0.0',
  };
}

// ── Skill-objekt (GUARDRAILS regel 5 — Skill-interface exakt) ─────────────────

export const bolagsskattSkill: Skill = {
  id: 'bolagsskatt',
  name: 'Bolagsskatt 2026',
  category: 'tax',
  tier: 'free',
  version: '1.0.0',
  triggers: [
    'bolagsskatt',
    'corporate tax',
    'skatt på vinst',
    'hur mycket skatt betalar bolaget',
    'periodiseringsfond',
  ],
  inputSchema: {
    taxable_profit: {
      type: 'number',
      required: true,
      description: 'Skattemässigt resultat (SEK, kan vara negativt)',
    },
    periodiseringsfond_avsattning: {
      type: 'number',
      required: false,
      description: 'Önskad ny periodiseringsfond-avsättning (SEK, 0 = ingen)',
    },
    befintliga_fonder: {
      type: 'string',
      required: false,
      description: 'JSON-array med befintliga fonder: [{year:number,amount:number}]',
    },
    underskott_foregaende_ar: {
      type: 'number',
      required: false,
      description: 'Ackumulerat underskott från tidigare år (SEK)',
    },
  },
  calculate,
};
