/**
 * Svensk organisationsnummer-validering.
 *
 * Format: XXXXXX-XXXX (10 siffror, valfri bindestreck efter sjätte).
 * Sista siffran är Luhn-kontrollsumma över de första nio.
 *
 * Bolagsverket-regler: aktiebolag har tredje siffran ≥ 2.
 * (Övriga juridiska personer har andra spann; vi accepterar dem
 *  också men flaggar dem som "ej AB" i UI:t separat.)
 */

const DIGITS_PATTERN = /^\d{10}$/;
const FORMATTED_PATTERN = /^\d{6}-\d{4}$/;

export type OrgnrValidation =
  | { ok: true; canonical: string }
  | { ok: false; reason: 'format' | 'luhn' | 'not_ab' };

export function normalizeOrgnr(input: string): string {
  return input.replace(/[\s-]/g, '');
}

export function formatOrgnr(rawDigits: string): string {
  if (!DIGITS_PATTERN.test(rawDigits)) return rawDigits;
  return `${rawDigits.slice(0, 6)}-${rawDigits.slice(6)}`;
}

function luhnIsValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const charCode = digits.charCodeAt(i) - 48;
    if (charCode < 0 || charCode > 9) return false;
    if (i % 2 === 0) {
      const doubled = charCode * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += charCode;
    }
  }
  return sum % 10 === 0;
}

export function validateOrgnr(input: string): OrgnrValidation {
  const trimmed = input.trim();
  const digits = normalizeOrgnr(trimmed);

  if (!DIGITS_PATTERN.test(digits)) return { ok: false, reason: 'format' };
  if (trimmed.includes('-') && !FORMATTED_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'format' };
  }

  if (!luhnIsValid(digits)) return { ok: false, reason: 'luhn' };

  // AB-detektion: tredje siffran ≥ 2 enligt Bolagsverkets numreringsplan.
  // Vi varnar men blockerar inte — användaren kan fortfarande vara
  // ekonomisk förening eller annan juridisk person som vill bevaka.
  // (Watcher-tjänsten är B2B-only enligt TERMS § 9, vi rekommenderar
  // fortsatt AB; enforcement görs vid consent-bekräftelsen.)
  if (Number(digits[2]) < 2) return { ok: false, reason: 'not_ab' };

  return { ok: true, canonical: formatOrgnr(digits) };
}
