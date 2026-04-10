/**
 * skills/k10/calculate.ts
 *
 * Beräknar K10-gränsbelopp för fåmansföretagare (3:12-reglerna).
 * Deterministisk. Noll LLM. Alla konstanter från K10_CONSTANTS_2026.
 * Fristående — importerar ALDRIG från andra skills.
 *
 * GUARDRAILS:
 *   Regel 3: Noll hårdkodade siffror — allt från K10_CONSTANTS_2026
 *   Regel 5: Implementerar Skill-interface exakt
 *   Regel 9: Error messages med kontext
 *   Regel 10: Ingen silent degradation — kasta Error vid ogiltig input
 *   Regel 11: Disclaimer i all output
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * BERÄKNINGSLOGIK (Prop. 2025/26:1 — ADDITIV FORMEL fr.o.m. 2026):
 *
 *   De tidigare alternativa beräkningsmetoderna (förenklingsregel /
 *   huvudregel) ersätts av en ENHETLIG ADDITIV beräkning:
 *
 *   1. GRUNDBELOPP (IL 57 kap 11 §)
 *      grundbelopp = FORENKLING_BELOPP × ägarandel_decimal
 *
 *   2. KAPITALBASERAT UTRYMME (IL 57 kap 12 §)
 *      omk = round(anskaffningsvarde × ägarandel_decimal)
 *      kapitalbaserat = round(omk × KAPITALBASERAT_FAKTOR)
 *      KAPITALBASERAT_FAKTOR = SLR + 9% = 2.55% + 9.00% = 11.55%
 *
 *   3. LÖNEBASERAT UTRYMME (IL 57 kap 16 §)
 *      om ägarandel_decimal < LONEBASERAT_MIN_AGARANDEL (4%):
 *        lonebaserat = 0  [4%-spärr]
 *      annars:
 *        underlag = max(0, total_lonesumma − LONESPARR_BELOPP)
 *        fore_tak = round(underlag × LONEBASERAT_ANDEL)
 *        tak_50x  = LONEBASERAT_TAK_MULTIPEL × eigen_lon
 *        lonebaserat = min(fore_tak, tak_50x)
 *
 *   4. SPARAT UTRYMME (IL 57 kap 10 §)
 *      sparat_uppraknat = round(sparat_utrymme × (1 + UPPRAKNINGSFAKTOR))
 *      [UPPRAKNINGSFAKTOR = 0 — slopad 2026]
 *
 *   5. GRÄNSBELOPP — ADDITIV
 *      gransbelopp = grundbelopp + kapitalbaserat + lonebaserat + sparat_uppraknat
 *
 *   Avrundning: Math.round() till hela kronor per steg.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import type { SkillInput, SkillOutput, Skill } from '../types.js';
import { K10_CONSTANTS_2026 } from '../../constants/loader.js';
import { assertInkomstar } from '../../verify/year-guard.js';

// ── Interna typer ─────────────────────────────────────────────────────────────

interface K10Input {
  anskaffningsvarde: number;
  agarandel_procent: number;    // 0.01–100
  total_lonesumma: number;
  eigen_lon: number;
  sparat_utrymme: number;
  inkomstar: number;
}

// ── Konstanter ────────────────────────────────────────────────────────────────

const DISCLAIMER =
  'KAMMAREN Skatteoptimering är ett beräkningsverktyg. ' +
  'Resultaten baseras på offentliga regler och de uppgifter du anger. ' +
  'Detta utgör inte skatte- eller juridisk rådgivning. ' +
  'Konsultera alltid en auktoriserad redovisningskonsult innan du fattar beslut.';

const SOURCES: SkillOutput['sources'] = [
  {
    name: 'Inkomstskattelagen (1999:1229) 57 kap — Fåmansföretag',
    url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/',
    date: '2026-01-01',
  },
  {
    name: 'Prop. 2025/26:1 — Nya 3:12-regler (additiv formel)',
    url: 'https://www.regeringen.se/rattsliga-dokument/proposition/2025/09/prop.-202526-1/',
    date: '2025-09-18',
  },
  {
    name: 'Skatteverket: Belopp och procentsatser 2026',
    url: 'https://www.skatteverket.se/download/18.1522bf3f19aea8075ba3285/1767885159120/belopp-och-procentsatser-for-inkomstaret-2026.pdf',
    date: '2026-01-07',
  },
];

// ── Validering och parsning ───────────────────────────────────────────────────

function parseAndValidate(input: SkillInput): K10Input {
  if (!('anskaffningsvarde' in input)) {
    throw new Error('Required input saknas: anskaffningsvarde. Anskaffningsvärde för aktierna (SEK).');
  }
  if (!('agarandel_procent' in input)) {
    throw new Error('Required input saknas: agarandel_procent. Ägarandel i procent (0.01–100).');
  }

  const anskaffningsvarde    = Number(input['anskaffningsvarde']);
  const agarandel_procent    = Number(input['agarandel_procent']);
  const total_lonesumma      = 'total_lonesumma' in input ? Number(input['total_lonesumma']) : 0;
  const eigen_lon             = 'eigen_lon' in input ? Number(input['eigen_lon']) : 0;
  const sparat_utrymme       = 'sparat_utrymme' in input ? Number(input['sparat_utrymme']) : 0;
  const inkomstar            = 'inkomstar' in input ? Number(input['inkomstar']) : K10_CONSTANTS_2026.INKOMSTAR;

  if (isNaN(anskaffningsvarde) || anskaffningsvarde < 0) {
    throw new Error(
      `Ogiltigt värde: anskaffningsvarde=${input['anskaffningsvarde']}, förväntat >= 0.`,
    );
  }
  if (isNaN(agarandel_procent) || agarandel_procent <= 0 || agarandel_procent > 100) {
    throw new Error(
      `Ogiltigt värde: agarandel_procent=${input['agarandel_procent']}, förväntat > 0 och <= 100. ` +
      `Noll ägarandel är ogiltigt — minst en andel måste ägas.`,
    );
  }
  if (isNaN(total_lonesumma) || total_lonesumma < 0) {
    throw new Error(
      `Ogiltigt värde: total_lonesumma=${input['total_lonesumma']}, förväntat >= 0.`,
    );
  }
  if (isNaN(eigen_lon) || eigen_lon < 0) {
    throw new Error(
      `Ogiltigt värde: eigen_lon=${input['eigen_lon']}, förväntat >= 0.`,
    );
  }
  if (isNaN(sparat_utrymme) || sparat_utrymme < 0) {
    throw new Error(
      `Ogiltigt värde: sparat_utrymme=${input['sparat_utrymme']}, förväntat >= 0.`,
    );
  }

  return { anskaffningsvarde, agarandel_procent, total_lonesumma, eigen_lon, sparat_utrymme, inkomstar };
}

// ── Huvud-export ──────────────────────────────────────────────────────────────

export function calculate(input: SkillInput): SkillOutput {
  assertInkomstar(K10_CONSTANTS_2026.INKOMSTAR);
  const { anskaffningsvarde, agarandel_procent, total_lonesumma, eigen_lon, sparat_utrymme } =
    parseAndValidate(input);

  const C = K10_CONSTANTS_2026;
  const warnings: string[] = [];
  const breakdown: Record<string, number | string>[] = [];
  const agarandel_decimal = agarandel_procent / 100;

  // ── Steg 1: Grundbelopp (IL 57 kap 11 §) ─────────────────────────────
  // Ersätter förenklingsregeln. Del av additiv formel — konkurrerar ej.
  const grundbelopp = Math.round(C.FORENKLING_BELOPP * agarandel_decimal);
  breakdown.push({
    step: '1',
    name: `Grundbelopp (${C.FORENKLING_BELOPP} × ${agarandel_procent}%) (IL 57:11)`,
    amount: grundbelopp,
  });

  // ── Steg 2: Kapitalbaserat utrymme (IL 57 kap 12 §) ──────────────────
  // Ny 2026: kapitalbaserat = anskaffningsvärde × ägarandel × (SLR + 9%)
  // = omk × KAPITALBASERAT_FAKTOR (0.1155)
  const omk = Math.round(anskaffningsvarde * agarandel_decimal);
  const kapitalbaserat = Math.round(omk * C.KAPITALBASERAT_FAKTOR);
  breakdown.push({
    step: '2',
    name: `Kapitalbaserat (${anskaffningsvarde}×${agarandel_procent}%×${C.KAPITALBASERAT_FAKTOR * 100}%) (IL 57:12)`,
    amount: kapitalbaserat,
  });

  // ── Steg 3: Lönebaserat utrymme (IL 57 kap 16 §) ─────────────────────
  let lonebaserat_underlag = 0;
  let lonebaserat_fore_tak = 0;
  let tak_50x = 0;
  let lonebaserat = 0;

  if (agarandel_decimal < C.LONEBASERAT_MIN_AGARANDEL) {
    warnings.push(
      `4%-spärr: ägarandel ${agarandel_procent}% < ${C.LONEBASERAT_MIN_AGARANDEL * 100}%. ` +
      `Inget lönebaserat utrymme (IL 57 kap 16 §).`,
    );
    breakdown.push({ step: '3', name: '4%-spärr → lönebaserat = 0 (IL 57:16)', amount: 0 });
  } else {
    lonebaserat_underlag = Math.max(0, total_lonesumma - C.LONESPARR_BELOPP);
    lonebaserat_fore_tak = Math.round(lonebaserat_underlag * C.LONEBASERAT_ANDEL);
    tak_50x = C.LONEBASERAT_TAK_MULTIPEL * eigen_lon;

    if (lonebaserat_underlag === 0) {
      warnings.push(
        `Lönesumma ${total_lonesumma} kr under lönespärr ${C.LONESPARR_BELOPP} kr. ` +
        `Inget lönebaserat utrymme (IL 57 kap 16 §).`,
      );
      lonebaserat = 0;
    } else if (tak_50x > 0 && lonebaserat_fore_tak > tak_50x) {
      warnings.push(
        `50x-tak: lönebaserat cappat från ${lonebaserat_fore_tak} kr ` +
        `till ${tak_50x} kr (50 × ${eigen_lon} kr ägarens lön) (IL 57:16).`,
      );
      lonebaserat = tak_50x;
    } else {
      lonebaserat = lonebaserat_fore_tak;
    }

    breakdown.push({
      step: '3',
      name: `Lönebaserat utrymme (${total_lonesumma}−${C.LONESPARR_BELOPP})×50%${lonebaserat < lonebaserat_fore_tak ? ` cappat till 50x${eigen_lon}` : ''} (IL 57:16)`,
      amount: lonebaserat,
    });
  }

  // ── Steg 4: Sparat utrymme (IL 57 kap 10 §) ──────────────────────────
  // UPPRAKNINGSFAKTOR = 0 (slopad fr.o.m. 2026, se constants.ts)
  const sparat_uppraknat = Math.round(sparat_utrymme * (1 + C.UPPRAKNINGSFAKTOR));
  if (sparat_uppraknat > 0) {
    breakdown.push({
      step: '4',
      name: `Sparat utrymme (nominellt, uppräkning slopad 2026) (IL 57:10)`,
      amount: sparat_uppraknat,
    });
  }

  // ── Steg 5: Gränsbelopp — ADDITIV formel (Prop. 2025/26:1) ───────────
  const gransbelopp = grundbelopp + kapitalbaserat + lonebaserat + sparat_uppraknat;
  breakdown.push({
    step: '5',
    name: `Gränsbelopp = ${grundbelopp} + ${kapitalbaserat} + ${lonebaserat} + ${sparat_uppraknat} sparat`,
    amount: gransbelopp,
  });

  warnings.push(
    `Gränsbelopp: grundbelopp ${grundbelopp} kr + kapitalbaserat ${kapitalbaserat} kr ` +
    `+ lönebaserat ${lonebaserat} kr + sparat ${sparat_uppraknat} kr = ${gransbelopp} kr.`,
  );

  return {
    result: {
      grundbelopp,
      kapitalbaserat,
      lonebaserat_underlag,
      lonebaserat_fore_tak,
      tak_50x,
      lonebaserat,
      sparat_uppraknat,
      gransbelopp,
    },
    breakdown,
    warnings,
    sources: SOURCES,
    disclaimer: DISCLAIMER,
    version: '1.0.0',
  };
}

// ── Skill-objekt (GUARDRAILS regel 5 — Skill-interface exakt) ─────────────────

export const k10Skill: Skill = {
  id: 'k10',
  name: 'K10 Gränsbelopp 2026',
  category: 'tax',
  tier: 'free',
  version: '1.0.0',
  triggers: [
    'K10',
    'gränsbelopp',
    'utdelningsutrymme',
    'grundbelopp',
    'kapitalbaserat utrymme',
    'lönebaserat utrymme',
  ],
  inputSchema: {
    anskaffningsvarde: {
      type: 'number',
      required: true,
      description: 'Anskaffningsvärde för aktierna (SEK)',
    },
    agarandel_procent: {
      type: 'number',
      required: true,
      description: 'Ägarandel i procent (0.01–100)',
    },
    total_lonesumma: {
      type: 'number',
      required: false,
      description: 'Total kontant lönesumma i bolaget inkl. dotterbolag (SEK)',
    },
    eigen_lon: {
      type: 'number',
      required: false,
      description: 'Ägarens egna kontanta bruttolön (SEK)',
    },
    sparat_utrymme: {
      type: 'number',
      required: false,
      description: 'Sparat gränsbelopp från föregående år (SEK)',
    },
    inkomstar: {
      type: 'number',
      required: false,
      description: 'Inkomstår (default 2026)',
    },
  },
  calculate,
};
