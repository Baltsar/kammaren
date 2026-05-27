import { describe, expect, it } from 'vitest';
import type { Classification } from '../schema/classification.js';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  FORBIDDEN_WORDS,
  detectForbiddenWords,
  escapeMarkdownV2,
  formatNotification,
  formatSwedishShortDate,
  sourceLabel,
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
    summary: 'Berör moms — neutral sammanfattning',
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
  it('escapar alla 18 special-tecken som Telegram kräver i fritext', () => {
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
    expect(escapeMarkdownV2('Förordning (2026:1234) om moms.')).toBe(
      'Förordning \\(2026:1234\\) om moms\\.',
    );
  });

  it('rör inte editorial-acccent ▎ eller middle-dot · eller pil ↗', () => {
    // Dessa unicode-tecken är inte i MarkdownV2-spec-listan och ska
    // släppas igenom oförändrat. Annars bryts den editorial-grafiken.
    expect(escapeMarkdownV2('▎')).toBe('▎');
    expect(escapeMarkdownV2('·')).toBe('·');
    expect(escapeMarkdownV2('↗')).toBe('↗');
  });
});

describe('detectForbiddenWords', () => {
  it('flaggar varje förbjudet ord (case-insensitive) i title eller summary', () => {
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

describe('sourceLabel', () => {
  it('mappar "skv" till "Skatteverket"', () => {
    expect(sourceLabel('skv')).toBe('Skatteverket');
  });

  it('mappar "riksdagen" till "Riksdagen"', () => {
    expect(sourceLabel('riksdagen')).toBe('Riksdagen');
  });
});

describe('formatSwedishShortDate', () => {
  it('formaterar mittenmånad utan ledande nolla — "15 apr"', () => {
    expect(formatSwedishShortDate('2026-04-15T00:00:00.000Z')).toBe('15 apr');
  });

  it('formaterar siffra utan padding — "3 dec"', () => {
    expect(formatSwedishShortDate('2026-12-03T12:00:00.000Z')).toBe('3 dec');
  });

  it('hanterar januari', () => {
    expect(formatSwedishShortDate('2026-01-22T00:00:00.000Z')).toBe('22 jan');
  });

  it('hanterar december (sista månaden i array-index 11)', () => {
    expect(formatSwedishShortDate('2026-12-31T00:00:00.000Z')).toBe('31 dec');
  });

  it('använder UTC-datum — deterministisk oavsett TZ', () => {
    // 2026-04-15T00:00:00Z är fortfarande den 15 i UTC men kan vara 14
    // i västra tidszoner. Vi vill att output är samma var koden än kör.
    expect(formatSwedishShortDate('2026-04-15T00:00:00.000Z')).toBe('15 apr');
  });

  it('returnerar tom sträng för ogiltigt datum', () => {
    expect(formatSwedishShortDate('not-a-date')).toBe('');
    expect(formatSwedishShortDate('')).toBe('');
  });

  it('mappar alla 12 månader till svensk kortform', () => {
    const expected = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    for (let m = 0; m < 12; m++) {
      const month = String(m + 1).padStart(2, '0');
      expect(formatSwedishShortDate(`2026-${month}-15T00:00:00.000Z`)).toBe(`15 ${expected[m]}`);
    }
  });
});

describe('formatNotification', () => {
  it('returnerar text + replyMarkup som separata fält', () => {
    const result = formatNotification(makeClassification(), makeEvent());
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('replyMarkup');
    expect(typeof result.text).toBe('string');
  });

  describe('editorial layout', () => {
    it('rad 1 = pelar-accent + bold titel (▎ *<title>*)', () => {
      const { text } = formatNotification(
        makeClassification(),
        makeEvent({ title: 'Posta pappersdeklarationen senast 22 april' }),
      );
      const lines = text.split('\n');
      expect(lines[0]).toBe('▎ *Posta pappersdeklarationen senast 22 april*');
    });

    it('rad 2 = italic meta med källa + datum (_<source>  ·  <date>_)', () => {
      const { text } = formatNotification(
        makeClassification(),
        makeEvent({
          title: 'Lag om moms',
          source: 'skv',
          published_at: '2026-04-22T00:00:00.000Z',
        }),
      );
      const lines = text.split('\n');
      expect(lines[1]).toBe('_Skatteverket  ·  22 apr_');
    });

    it('exakt 2 rader text vid neutral input — knappen ligger separat i reply_markup', () => {
      const { text } = formatNotification(
        makeClassification({ summary: 'Neutral text' }),
        makeEvent({ title: 'SFS 2026:1234 om moms', source: 'riksdagen' }),
      );
      expect(text.split('\n')).toHaveLength(2);
    });

    it('escapar parenteser och kolon i SFS-titlar inom bold-markörerna', () => {
      const { text } = formatNotification(
        makeClassification(),
        makeEvent({ title: 'Vapenförordning (2026:409)' }),
      );
      expect(text).toContain('▎ *Vapenförordning \\(2026:409\\)*');
    });

    it('utelämnar datum-segmentet när published_at är ogiltigt — meta blir bara _<source>_', () => {
      const { text } = formatNotification(
        makeClassification(),
        makeEvent({ source: 'skv', published_at: 'bogus' }),
      );
      const lines = text.split('\n');
      expect(lines[1]).toBe('_Skatteverket_');
    });

    it('utelämnar datum-segmentet när published_at är tom sträng', () => {
      const { text } = formatNotification(
        makeClassification(),
        makeEvent({ source: 'riksdagen', published_at: '' }),
      );
      const lines = text.split('\n');
      expect(lines[1]).toBe('_Riksdagen_');
    });
  });

  describe('inline_keyboard', () => {
    it('returnerar inline_keyboard med en URL-knapp "Öppna ↗" som pekar på event.url', () => {
      const { replyMarkup } = formatNotification(
        makeClassification(),
        makeEvent({ url: 'https://riksdagen.se/sfs/2026:1234' }),
      );
      expect(replyMarkup).toEqual({
        inline_keyboard: [[{ text: 'Öppna ↗', url: 'https://riksdagen.se/sfs/2026:1234' }]],
      });
    });

    it('inkluderar inte URL:en som rå text i meddelandet — den lever bara i knappen', () => {
      const { text } = formatNotification(
        makeClassification(),
        makeEvent({ url: 'https://example.test/unique-url-abc' }),
      );
      expect(text).not.toContain('https://example.test/unique-url-abc');
    });

    it('byter "📄"-emoji mot pil-suffix — knapptext är "Öppna ↗"', () => {
      const { replyMarkup } = formatNotification(makeClassification(), makeEvent());
      const button = replyMarkup.inline_keyboard[0][0];
      expect(button.text).toBe('Öppna ↗');
      expect(button.text).not.toContain('📄');
    });
  });

  describe('boilerplate-rensning (oförändrat från PR #20)', () => {
    it('inkluderar inte gamla headers/disclaimer-block', () => {
      const { text } = formatNotification(makeClassification(), makeEvent());
      expect(text).not.toContain('Skatte- eller');
      expect(text).not.toContain('regulatorisk');
      expect(text).not.toContain('Kategori');
      expect(text).not.toContain('Allvar');
      expect(text).not.toContain('Läs hos källan');
      expect(text).not.toContain('Informationsnotis');
      expect(text).not.toContain('AI-genererad');
    });

    it('inkluderar inte severity-emoji ⚠️ 📌 ℹ️', () => {
      const { text } = formatNotification(
        makeClassification({ severity: 'action_required' }),
        makeEvent(),
      );
      expect(text).not.toContain('⚠️');
      expect(text).not.toContain('📌');
      expect(text).not.toContain('ℹ️');
    });

    it('inkluderar inte classification.summary i meddelandet', () => {
      const { text } = formatNotification(
        makeClassification({ summary: 'Unik summary 12345 ska inte synas' }),
        makeEvent(),
      );
      expect(text).not.toContain('Unik summary 12345');
    });
  });

  describe('forbidden-word safety net', () => {
    it('lägger till disclaimer-raden MELLAN titel och meta när title innehåller förbjudet ord', () => {
      const { text } = formatNotification(
        makeClassification({ summary: 'Neutral text' }),
        makeEvent({
          title: 'Viktigt meddelande',
          source: 'skv',
          published_at: '2026-04-22T00:00:00.000Z',
        }),
      );
      const lines = text.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('▎ *Viktigt meddelande*');
      expect(lines[1]).toBe('_Informationstjänst, ej rådgivning\\._');
      expect(lines[2]).toBe('_Skatteverket  ·  22 apr_');
    });

    it('lägger till disclaimer-raden när summary innehåller förbjudet ord', () => {
      const { text } = formatNotification(
        makeClassification({ summary: 'Du bör kontrollera din deklaration' }),
        makeEvent({ title: 'Neutral title' }),
      );
      expect(text).toContain('_Informationstjänst, ej rådgivning\\._');
    });

    it('hoppar över disclaimer-raden när varken title eller summary har förbjudet ord', () => {
      const { text } = formatNotification(
        makeClassification({ summary: 'Lag publicerades 2026-05-01' }),
        makeEvent({ title: 'SFS 2026:1234 om moms' }),
      );
      expect(text).not.toContain('Informationstjänst');
    });

    it.each(FORBIDDEN_WORDS)(
      'flaggar individuellt förbjudet ord "%s" i title',
      (word) => {
        const { text } = formatNotification(
          makeClassification({ summary: 'Neutral text' }),
          makeEvent({ title: `Text med ${word} i titeln` }),
        );
        expect(text).toContain('_Informationstjänst, ej rådgivning\\._');
      },
    );
  });

  describe('input-validering', () => {
    it('kastar Error om event.url saknas — knappen behöver en URL', () => {
      expect(() =>
        formatNotification(makeClassification(), makeEvent({ url: '' })),
      ).toThrow(/url/i);
    });

    it('kastar Error om event.url är endast whitespace', () => {
      expect(() =>
        formatNotification(makeClassification(), makeEvent({ url: '   ' })),
      ).toThrow(/url/i);
    });
  });
});
