import { describe, expect, it } from 'vitest';
import { formatOrgnr, normalizeOrgnr, validateOrgnr } from './luhn';

describe('luhn / orgnr-validation', () => {
  describe('normalizeOrgnr', () => {
    it('strips whitespace and dashes', () => {
      expect(normalizeOrgnr('556677-8899')).toBe('5566778899');
      expect(normalizeOrgnr(' 556677-8899 ')).toBe('5566778899');
      expect(normalizeOrgnr('556677 8899')).toBe('5566778899');
    });
  });

  describe('formatOrgnr', () => {
    it('formats 10 digits to XXXXXX-XXXX', () => {
      expect(formatOrgnr('5566778899')).toBe('556677-8899');
    });

    it('passes through if not 10 digits', () => {
      expect(formatOrgnr('12345')).toBe('12345');
    });
  });

  describe('validateOrgnr', () => {
    it('accepts valid AB orgnr 556677-8899', () => {
      const result = validateOrgnr('556677-8899');
      expect(result).toEqual({ ok: true, canonical: '556677-8899' });
    });

    it('accepts valid orgnr without dash', () => {
      const result = validateOrgnr('5566778899');
      expect(result).toEqual({ ok: true, canonical: '556677-8899' });
    });

    it('rejects malformed length', () => {
      expect(validateOrgnr('12345')).toEqual({ ok: false, reason: 'format' });
      expect(validateOrgnr('12345678901')).toEqual({ ok: false, reason: 'format' });
    });

    it('rejects non-canonical dash position', () => {
      expect(validateOrgnr('55667-78899')).toEqual({ ok: false, reason: 'format' });
    });

    it('rejects bad luhn checksum', () => {
      // 556677-8898 → ändra sista siffran
      expect(validateOrgnr('556677-8898')).toEqual({ ok: false, reason: 'luhn' });
    });

    it('rejects non-AB (third digit < 2)', () => {
      // 551677-... third digit is 1 → not AB. Använder en luhn-valid kombo.
      // Bygg via beräkning så testen håller över tid:
      const digits = '5516770000';
      // Kontrollera att luhn skulle returnerat ett annat värde och hitta rätt sista siffra
      const candidate = computeWithLuhn(digits.slice(0, 9));
      expect(validateOrgnr(candidate)).toEqual({ ok: false, reason: 'not_ab' });
    });

    it('rejects non-numeric input', () => {
      expect(validateOrgnr('abcdef-ghij')).toEqual({ ok: false, reason: 'format' });
    });
  });
});

function computeWithLuhn(nineDigits: string): string {
  for (let last = 0; last < 10; last += 1) {
    const candidate = `${nineDigits}${last}`;
    let sum = 0;
    for (let i = 0; i < candidate.length; i += 1) {
      const d = candidate.charCodeAt(i) - 48;
      if (i % 2 === 0) {
        const dd = d * 2;
        sum += dd > 9 ? dd - 9 : dd;
      } else {
        sum += d;
      }
    }
    if (sum % 10 === 0) return candidate;
  }
  throw new Error('no luhn-valid candidate (impossible)');
}
