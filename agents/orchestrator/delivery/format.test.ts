import { describe, expect, it } from 'vitest';
import type { Classification } from '../schema/classification.js';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  FORBIDDEN_WORDS,
  detectForbiddenWords,
  escapeMarkdownV2,
  formatNotification,
} from './format.js';

function makeClassification(overrides: Partial<Classification> = {}): Classification {
  return {
    id: 'abc123',
    event_id: 'evt-1',
    customer_orgnr: '556677-8899',
    relevant: true,
    severity: 'action_required',
    tags: ['moms'],
    matched_rules: ['moms: tax.is_vat_registered'],
    summary: 'Berör moms — testfall utan rådgivande språk',
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

describe('detectForbiddenWords', () => {
  it('flaggar varje förbjudet ord (case-insensitive) i title eller summary', () => {
    // Sanity: listan ska innehålla de 10 orden som mur-förstärkning #5 kräver.
    expect(FORBIDDEN_WORDS).toEqual([
      'rekommenderar',
      'bör',
      'viktigt',
      'kritiskt',
      'akut',
      'måste',
      'deadline',
      'sista dag',
      'imorgon',
      'snart',
    ]);

    for (const word of FORBIDDEN_WORDS) {
      // Mixed-case substring i en längre mening — ska fortfarande träffa.
      const sentence = `Lorem ipsum ${word.toUpperCase()} dolor sit amet`;
      expect(detectForbiddenWords(sentence)).toBe(true);
    }
  });

  it('returnerar false för text utan förbjudna ord', () => {
    expect(detectForbiddenWords('Lag om moms publicerades 2026-05-01')).toBe(false);
    expect(detectForbiddenWords('Information från Skatteverket om periodisering')).toBe(false);
  });

  it('flaggar när förbjudet ord finns i någon av flera texter', () => {
    expect(detectForbiddenWords('Helt neutral title', 'summary med viktigt här')).toBe(true);
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
      makeClassification({ summary: 'Berör moms (sats 25%) — neutral text' }),
      makeEvent(),
    );
    expect(msg).toContain('Berör moms \\(sats 25%\\) — neutral text');
  });

  it('returnerar en sträng med alla obligatoriska delar', () => {
    const msg = formatNotification(
      makeClassification({
        severity: 'action_required',
        tags: ['moms'],
        summary: 'Test summary utan rådgivning',
      }),
      makeEvent({ title: 'Test title', url: 'https://example.test' }),
    );
    expect(msg).toContain('Skatte');
    expect(msg).toContain('Test title');
    expect(msg).toContain('Kategori');
    expect(msg).toContain('moms');
    expect(msg).toContain('Allvar');
    expect(msg).toContain('action\\_required');
    expect(msg).toContain('Test summary utan rådgivning');
    expect(msg).toContain('Läs hos källan');
    expect(msg).toContain('https://example.test');
  });

  describe('legal-foundation footer', () => {
    it('inkluderar alltid båda obligatoriska disclaimer-rader', () => {
      const msg = formatNotification(makeClassification(), makeEvent());
      expect(msg).toContain('⚠️ Informationsnotis — ej rådgivning');
      expect(msg).toContain('Verifiera alltid mot primärkälla');
      expect(msg).toContain('🤖 AI\\-genererad klassificering — kan innehålla fel');
    });

    it('inkluderar event.url som klickbar länk i disclaimer-footer', () => {
      const msg = formatNotification(
        makeClassification(),
        makeEvent({ url: 'https://riksdagen.se/sfs/2026:1234' }),
      );
      // URL ska ligga både som visningstext (escapad) och i (...)-target.
      expect(msg).toContain('https://riksdagen\\.se/sfs/2026:1234');
    });

    it('kastar Error om event.url saknas', () => {
      // Tom URL → vi nekar leverans hellre än att skicka utan primärkälla.
      expect(() =>
        formatNotification(makeClassification(), makeEvent({ url: '' })),
      ).toThrow(/primärkälla är obligatorisk/);
    });

    it('kastar Error om event.url är endast whitespace', () => {
      expect(() =>
        formatNotification(makeClassification(), makeEvent({ url: '   ' })),
      ).toThrow(/primärkälla är obligatorisk/);
    });
  });

  describe('auto-warning vid förbjudna ord', () => {
    it('lägger till OBS-rad om title innehåller förbjudet ord', () => {
      const msg = formatNotification(
        makeClassification({ summary: 'Neutral sammanfattning' }),
        makeEvent({ title: 'Viktigt meddelande från Skatteverket' }),
      );
      expect(msg).toContain('OBS: Detta är information, inte rådgivning');
    });

    it('lägger till OBS-rad om summary innehåller förbjudet ord', () => {
      const msg = formatNotification(
        makeClassification({ summary: 'Du bör kontrollera din deklaration' }),
        makeEvent(),
      );
      expect(msg).toContain('OBS: Detta är information, inte rådgivning');
    });

    it('hoppar över OBS-rad när varken title eller summary har förbjudet ord', () => {
      const msg = formatNotification(
        makeClassification({ summary: 'Lag publicerades 2026-05-01' }),
        makeEvent({ title: 'SFS 2026:1234 om moms' }),
      );
      expect(msg).not.toContain('OBS: Detta är information');
    });

    it.each(FORBIDDEN_WORDS)(
      'flaggar individuellt förbjudet ord "%s" i title',
      (word) => {
        const msg = formatNotification(
          makeClassification({ summary: 'Neutral text' }),
          makeEvent({ title: `Text med ${word} i titeln` }),
        );
        expect(msg).toContain('OBS: Detta är information, inte rådgivning');
      },
    );
  });
});
