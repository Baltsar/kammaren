/**
 * api/test-local.ts — Lokal testrunner utan vercel dev
 *
 * Anropar handler direkt med mock req/res.
 * Kör: tsx api/test-local.ts
 */

import handler from './verify.js';

// ── Mock req/res ──────────────────────────────────────────────────────────────

function mockRes() {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  return {
    _statusCode: () => statusCode,
    _headers: () => headers,
    setHeader(k: string, v: string) { headers[k] = v; return this; },
    status(code: number) { statusCode = code; return this; },
    json(data: unknown) {
      console.log(`HTTP ${statusCode}`);
      console.log(JSON.stringify(data, null, 2));
    },
    end() { console.log(`HTTP ${statusCode} (empty)`); },
  };
}

function mockReq(method: string, body?: unknown) {
  return { method, body } as any;
}

// ── Tester ────────────────────────────────────────────────────────────────────

const SEPARATOR = '═'.repeat(60);

async function run() {
  console.log('\n' + SEPARATOR);
  console.log('TEST 1 — LIST (GET)');
  console.log(SEPARATOR);
  await handler(mockReq('GET'), mockRes() as any);

  console.log('\n' + SEPARATOR);
  console.log('TEST 2 — CALCULATE (POST, inget expected)');
  console.log(SEPARATOR);
  await handler(
    mockReq('POST', {
      skill: 'ag-avgifter',
      input: { gross_salary: 500000, birth_year: 1990, first_employee: false, num_employees: 0 },
    }),
    mockRes() as any,
  );

  console.log('\n' + SEPARATOR);
  console.log('TEST 3 — VERIFY PASS');
  console.log(SEPARATOR);
  await handler(
    mockReq('POST', {
      skill: 'ag-avgifter',
      input: { gross_salary: 500000, birth_year: 1990, first_employee: false, num_employees: 0 },
      expected: { total_ag: 157100 },
    }),
    mockRes() as any,
  );

  console.log('\n' + SEPARATOR);
  console.log('TEST 4 — VERIFY FAIL (fel expected)');
  console.log(SEPARATOR);
  await handler(
    mockReq('POST', {
      skill: 'ag-avgifter',
      input: { gross_salary: 500000, birth_year: 1990, first_employee: false, num_employees: 0 },
      expected: { total_ag: 160000 },
    }),
    mockRes() as any,
  );

  console.log('\n' + SEPARATOR);
  console.log('TEST 5 — UNKNOWN SKILL');
  console.log(SEPARATOR);
  await handler(
    mockReq('POST', { skill: 'faktura', input: {} }),
    mockRes() as any,
  );

  console.log('\n' + SEPARATOR);
  console.log('TEST 6 — BAD INPUT (negativ lön)');
  console.log(SEPARATOR);
  await handler(
    mockReq('POST', {
      skill: 'ag-avgifter',
      input: { gross_salary: -100, birth_year: 1990, first_employee: false, num_employees: 0 },
    }),
    mockRes() as any,
  );

  console.log('\n' + SEPARATOR);
  console.log('BONUS — MOMS CALCULATE');
  console.log(SEPARATOR);
  await handler(
    mockReq('POST', {
      skill: 'moms',
      input: { amount: 10000, vat_rate: 25, direction: 'netto_to_brutto' },
    }),
    mockRes() as any,
  );
}

run().catch(e => {
  console.error('TEST CRASH:', e);
  process.exit(1);
});
