/**
 * verify/framework.ts — Verifieringsramverk
 *
 * Oberoende kontroll av skill-output mot handberäknade golden cases.
 *
 * KRITISK REGEL: verify() importerar ALDRIG beräkningslogik.
 * Den tar en svart-låda-funktion och jämför output mot
 * HANDBERÄKNADE expected-värden.
 */

import chalk from 'chalk';

export interface GoldenCase {
  name: string;
  description: string;
  // Arrays/objekt tillåts för strukturerad input (matchar SkillInput).
  input: Record<string, number | string | boolean | unknown[] | Record<string, unknown>>;
  assertions: Assertion[];
}

export interface Assertion {
  field: string;       // dot-notation: "result.total_ag"
  expected: number;
  tolerance: number;   // 0 = exakt, 1 = ±1 kr öresavrundning
  source: string;      // lagrum eller SKV-referens — ALLTID obligatoriskt
  formula?: string;    // visa matten: "500000 × 0.3142 = 157100"
  expect_error?: true; // om caset förväntar sig att skillFn kastar Error
}

export interface VerificationReport {
  skill: string;
  timestamp: string;
  totalCases: number;
  totalAssertions: number;
  passed: number;
  failed: number;
  failures: {
    caseName: string;
    field: string;
    expected: number;
    actual: number;
    difference: number;
    tolerance: number;
    source: string;
    formula?: string;
  }[];
}

/**
 * Extraherar ett värde ur ett objekt via dot-notation.
 * Exempel: "result.total_ag" → obj.result.total_ag
 */
function getField(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/**
 * Kör golden cases mot en skill-funktion och returnerar en verifieringsrapport.
 *
 * @param skill   - Skill-namn (för rapporten)
 * @param cases   - Handberäknade golden cases
 * @param skillFn - Svart-låda. verify() vet ingenting om dess interna logik.
 */
export function verify(
  skill: string,
  cases: GoldenCase[],
  skillFn: (input: Record<string, number | string | boolean | unknown[] | Record<string, unknown>>) => unknown,
): VerificationReport {
  const report: VerificationReport = {
    skill,
    timestamp: new Date().toISOString(),
    totalCases: cases.length,
    totalAssertions: cases.reduce((sum, c) => sum + c.assertions.length, 0),
    passed: 0,
    failed: 0,
    failures: [],
  };

  console.log(`\n${chalk.bold.white(`Verifierar: ${skill}`)}`);
  console.log(chalk.gray('─'.repeat(60)));

  for (const goldenCase of cases) {
    console.log(`\n  ${chalk.bold(goldenCase.name)}`);
    if (goldenCase.description) {
      console.log(`  ${chalk.gray(goldenCase.description)}`);
    }

    let output: unknown;
    let threwError = false;
    let errorMessage = '';

    try {
      output = skillFn(goldenCase.input);
    } catch (err) {
      threwError = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    for (const assertion of goldenCase.assertions) {
      const sourceLabel = chalk.cyan(`[${assertion.source}]`);
      const formulaLabel = assertion.formula ? chalk.gray(` // ${assertion.formula}`) : '';

      // ── Expect-error case ────────────────────────────────────────────────
      if (assertion.expect_error) {
        if (threwError) {
          report.passed++;
          console.log(
            `    ${chalk.green('✓')} ${assertion.field} — ERROR kastad som förväntat ${sourceLabel}`,
          );
        } else {
          report.failed++;
          report.failures.push({
            caseName: goldenCase.name,
            field: assertion.field,
            expected: assertion.expected,
            actual: 0,
            difference: 0,
            tolerance: assertion.tolerance,
            source: assertion.source,
            formula: assertion.formula,
          });
          console.log(
            `    ${chalk.red('✗')} ${assertion.field} — FÖRVÄNTAT FEL men inget kastades ${sourceLabel}`,
          );
        }
        continue;
      }

      // ── Normal numeric case ──────────────────────────────────────────────
      if (threwError) {
        report.failed++;
        report.failures.push({
          caseName: goldenCase.name,
          field: assertion.field,
          expected: assertion.expected,
          actual: NaN,
          difference: NaN,
          tolerance: assertion.tolerance,
          source: assertion.source,
          formula: assertion.formula,
        });
        console.log(
          `    ${chalk.red('✗')} ${assertion.field} — KASTADE FEL: ${errorMessage} ${sourceLabel}`,
        );
        continue;
      }

      const raw = getField(output, assertion.field);
      const actual = typeof raw === 'number' ? raw : NaN;
      const diff = Math.abs(actual - assertion.expected);
      const pass = !isNaN(actual) && diff <= assertion.tolerance;

      if (pass) {
        report.passed++;
        console.log(
          `    ${chalk.green('✓')} ${assertion.field} = ${actual}` +
            ` (förväntat ${assertion.expected}) ${sourceLabel}${formulaLabel}`,
        );
      } else {
        report.failed++;
        const diffStr = isNaN(actual)
          ? `fält ej hittat i output`
          : `diff=${diff} (tolerans=${assertion.tolerance})`;
        console.log(
          `    ${chalk.red('✗')} ${assertion.field}` +
            ` — faktiskt=${isNaN(actual) ? 'undefined' : actual}` +
            `, förväntat=${assertion.expected}, ${diffStr} ${sourceLabel}${formulaLabel}`,
        );
        report.failures.push({
          caseName: goldenCase.name,
          field: assertion.field,
          expected: assertion.expected,
          actual,
          difference: diff,
          tolerance: assertion.tolerance,
          source: assertion.source,
          formula: assertion.formula,
        });
      }
    }
  }

  // ── Sammanfattning ───────────────────────────────────────────────────────
  const { passed, failed, totalAssertions } = report;
  console.log('\n' + chalk.gray('─'.repeat(60)));
  if (failed === 0) {
    console.log(chalk.green.bold(`✓ ${passed}/${totalAssertions} PASS — ${skill}\n`));
  } else {
    console.log(
      chalk.red.bold(
        `✗ ${passed}/${totalAssertions} PASS — ${skill} — ${failed} MISSLYCKADE\n`,
      ),
    );
  }

  return report;
}
