import { describe, expect, it } from 'vitest';
import type { Classification } from '../schema/classification.js';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import { escapeMarkdownV2, formatNotification } from './format.js';

function makeClassification(overrides: Partial<Classification> = {}): Classification {
  return {
    id: 'abc123',
    event_id: 'evt-1',
    customer_orgnr: '556677-8899',
    relevant: true,
    severity: 'action_required',
    tags: ['moms'],
    matched_rules: ['moms: tax.is_vat_registered'],
    summary: 'Berör moms — Test',
    classified_at: '2026-05-04T12:00:00.000Z',
    method: 'deterministic',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<WatcherEvent> = {}): WatcherEvent {
  return {
    id: 'evt-1',
    source: 'riksdagen',
    type: 'sfs',
    title: 'Lag om moms',
    url: 'https://example.test/sfs',
    published_at: '2026-05-01T00:00:00.000Z',
    raw: {},
    fetched_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('escapeMarkdownV2', () => {
  it('escapes alla 18 special-tecken som Telegram kräver i fritext', () => {
    // Alla tecken Telegram kräver escape för i MarkdownV2 utanför kodblock.
    const specials = '_*[]()~`>#+-=|{}.!';
    expect(escapeMarkdownV2(specials)).toBe(
      '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!',
    );
  });

  it('rör inte vanlig text utan special-tecken', () => {
    expect(escapeMarkdownV2('Hej världen åäö')).toBe('Hej världen åäö');
    expect(escapeMarkdownV2('')).toBe('');
  });

  it('escapar backslash så att rå \\ inte tolkas som escape-prefix', () => {
    expect(escapeMarkdownV2('a\\b')).toBe('a\\\\b');
  });

  it('escapar SFS-titlar med parenteser och punkt korrekt', () => {
    // Realistisk titel — formatet "Förordning (2026:1234) om något."
    expect(escapeMarkdownV2('Förordning (2026:1234) om moms.')).toBe(
      'Förordning \\(2026:1234\\) om moms\\.',
    );
  });
});

describe('formatNotification', () => {
  it('inkluderar emoji ⚠️ för severity=action_required', () => {
    const msg = formatNotification(makeClassification({ severity: 'action_required' }), makeEvent());
    expect(msg).toContain('⚠️');
    expect(msg).toContain('action\\_required');
  });

  it('inkluderar emoji 📌 för severity=warning', () => {
    const msg = formatNotification(makeClassification({ severity: 'warning' }), makeEvent());
    expect(msg).toContain('📌');
    expect(msg).toContain('warning');
  });

  it('inkluderar emoji ℹ️ för severity=info', () => {
    const msg = formatNotification(makeClassification({ severity: 'info' }), makeEvent());
    expect(msg).toContain('ℹ️');
    expect(msg).toContain('info');
  });

  it('inkluderar escaped event-titel', () => {
    const msg = formatNotification(
      makeClassification(),
      makeEvent({ title: 'Förordning (2026:1) om moms' }),
    );
    expect(msg).toContain('*Förordning \\(2026:1\\) om moms*');
  });

  it('inkluderar tags joined med komma och escaped', () => {
    const msg = formatNotification(
      makeClassification({ tags: ['moms', 'arbetsgivare'] }),
      makeEvent(),
    );
    expect(msg).toContain('moms, arbetsgivare');
  });

  it('inkluderar URL som inline link med escapad URL', () => {
    const msg = formatNotification(
      makeClassification(),
      makeEvent({ url: 'https://example.test/path?id=1' }),
    );
    // Label inom [], URL inom () — special chars i URL escapas per MarkdownV2-link-regler.
    expect(msg).toContain('[Läs hos källan]');
    expect(msg).toContain('https://example.test/path?id=1');
  });

  it('escapar parenteser i URL så att link-parsern inte stängs för tidigt', () => {
    const msg = formatNotification(
      makeClassification(),
      makeEvent({ url: 'https://example.test/(parens)' }),
    );
    // Parentes inuti URL måste escapas med backslash.
    expect(msg).toContain('https://example.test/\\(parens\\)');
  });

  it('hanterar saknad summary defensivt utan att krascha', () => {
    // summary kan saknas vid trasig classification — visa fallback.
    const c = makeClassification({ summary: '' });
    const msg = formatNotification(c, makeEvent());
    expect(msg).toBeTypeOf('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('escapar special-tecken i summary', () => {
    const msg = formatNotification(
      makeClassification({ summary: 'Berör moms (sats 25%) — viktigt!' }),
      makeEvent(),
    );
    expect(msg).toContain('Berör moms \\(sats 25%\\) — viktigt\\!');
  });

  it('returnerar en sträng med alla obligatoriska delar', () => {
    const msg = formatNotification(
      makeClassification({
        severity: 'action_required',
        tags: ['moms'],
        summary: 'Test summary',
      }),
      makeEvent({ title: 'Test title', url: 'https://example.test' }),
    );
    expect(msg).toContain('Skatte');
    expect(msg).toContain('Test title');
    expect(msg).toContain('Kategori');
    expect(msg).toContain('moms');
    expect(msg).toContain('Allvar');
    expect(msg).toContain('action\\_required');
    expect(msg).toContain('Test summary');
    expect(msg).toContain('Läs hos källan');
    // URL inom (...) — endast ')' och '\\' kräver escape per Telegram-spec.
    // '.' i URL ska INTE escapas, så här ser vi domänen oförändrad.
    expect(msg).toContain('https://example.test');
  });
});
