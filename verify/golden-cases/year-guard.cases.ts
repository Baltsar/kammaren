import { describe, test, expect } from 'bun:test';
import { assertInkomstar } from '../year-guard.js';

describe('year-guard', () => {
  test('2026 matchar 2026 → inget error', () => {
    expect(() => assertInkomstar(2026, 2026)).not.toThrow();
  });

  test('2026 matchar inte 2027 → error', () => {
    expect(() => assertInkomstar(2026, 2027)).toThrow(
      /Regler för inkomstår 2027 är inte tillgängliga/,
    );
  });

  test('2026 matchar inte 2025 → error', () => {
    expect(() => assertInkomstar(2026, 2025)).toThrow(
      /Regler för inkomstår 2025 är inte tillgängliga/,
    );
  });
});
