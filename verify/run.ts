/**
 * verify/run.ts — Verifieringsrunner
 *
 * Kör: bun run verify/run.ts <skill-namn>
 *
 * Exempel:
 *   bun run verify/run.ts regelversion   → 3/3 PASS om constants.ts matchar lagen
 *   bun run verify/run.ts ag-avgifter    → "not implemented yet" (golden cases klara)
 *
 * Lägg till en skill: lägg in fn i SKILLS-registret nedan.
 */

import chalk from 'chalk';
import { verify } from './framework.js';
import type { GoldenCase } from './framework.js';
import { REGELVERSION_CASES } from './golden-cases/regelversion.cases.js';
import { AG_AVGIFTER_CASES } from './golden-cases/ag-avgifter.cases.js';
import { MOMS_CASES } from './golden-cases/moms.cases.js';
import { BOLAGSSKATT_CASES } from './golden-cases/bolagsskatt.cases.js';
import { K10_CASES } from './golden-cases/k10.cases.js';
import { TAX_CONSTANTS_2026 } from '../constants/loader.js';
import { calculate as agAvgifterCalc } from '../skills/ag-avgifter/calculate.js';
import { calculate as momsCalc } from '../skills/moms/calculate.js';
import { calculate as bolagsskattCalc } from '../skills/bolagsskatt/calculate.js';
import { calculate as k10Calc } from '../skills/k10/calculate.js';

// ── Skill-register ───────────────────────────────────────────────────────────
//
// fn = undefined → skill är inte implementerad ännu
// Lägg till fn när skillen byggs:
//
//   import { calculate } from '../skills/ag-avgifter/calculate.js';
//   'ag-avgifter': { cases: AG_AVGIFTER_CASES, fn: calculate },

interface SkillEntry {
  cases: GoldenCase[];
  fn?: (input: Record<string, number | string | boolean>) => unknown;
}

const SKILLS: Record<string, SkillEntry> = {
  regelversion: {
    cases: REGELVERSION_CASES,
    // Kör mot TAX_CONSTANTS_2026 direkt — inte via optimize.
    // Input ignoreras. Vi inspekterar om constants.ts matchar lagen.
    fn: () => TAX_CONSTANTS_2026,
  },

  'ag-avgifter': {
    cases: AG_AVGIFTER_CASES,
    fn: agAvgifterCalc,
  },

  moms: {
    cases: MOMS_CASES,
    fn: momsCalc,
  },

  bolagsskatt: {
    cases: BOLAGSSKATT_CASES,
    fn: bolagsskattCalc,
  },

  k10: {
    cases: K10_CASES,
    fn: k10Calc,
  },
};

// ── CLI ──────────────────────────────────────────────────────────────────────

const skillName = process.argv[2];

if (!skillName) {
  console.error(chalk.yellow('\nUsage: bun run verify/run.ts <skill-namn>'));
  console.error(chalk.gray('Tillgängliga: ' + Object.keys(SKILLS).join(', ')));
  process.exit(1);
}

const skill = SKILLS[skillName];

if (!skill) {
  console.error(chalk.red(`\nOkänd skill: ${skillName}`));
  console.error(chalk.gray('Tillgängliga: ' + Object.keys(SKILLS).join(', ')));
  process.exit(1);
}

if (!skill.fn) {
  const totalAssertions = skill.cases.reduce((sum, c) => sum + c.assertions.length, 0);
  console.log(
    chalk.yellow(
      `\n${skillName}: 0/${totalAssertions} PASS — skill not implemented yet.\n` +
        `Golden cases ready. Build the skill.\n`,
    ),
  );
  process.exit(0);
}

const report = verify(skillName, skill.cases, skill.fn);
process.exit(report.failed > 0 ? 1 : 0);
