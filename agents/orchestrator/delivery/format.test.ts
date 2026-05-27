import { describe, expect, it } from 'vitest';
import type { Classification } from '../schema/classification.js';
import type { WatcherEvent } from '../../watcher/schema/event.js';
import {
  FORBIDDEN_WORDS,
  detectForbiddenWords,
  escapeMarkdownV2,
  formatNotification,
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

describe('formatNotification', () => {
  it('returnerar text + replyMarkup som separata fält', () => {
    const result = formatNotification(makeClassification(), makeEvent());
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('replyMarkup');
    expect(typeof result.text).toBe('string');
  });

  it('renderar titeln bold och MarkdownV2-escapad', () => {
    const { text } = formatNotification(
      makeClassification(),
      makeEvent({ title: 'Posta pappersdeklarationen senast 22 april' }),
    );
    expect(text).toContain('*Posta pappersdeklarationen senast 22 april*');
  });

  it('escapar parenteser och kolon i SFS-titlar inom bold-markörerna', () => {
    const { text } = formatNotification(
      makeClassification(),
      makeEvent({ title: 'Vapenförordning (2026:409)' }),
    );
    expect(text).toContain('*Vapenförordning \\(2026:409\\)*');
  });

  it('visar "Skatteverket" som källa-rad när event.source = "skv"', () => {
    const { text } = formatNotification(
      makeClassification(),
      makeEvent({ source: 'skv' }),
    );
    expect(text).toContain('Skatteverket');
  });

  it('visar "Riksdagen" som källa-rad när event.source = "riksdagen"', () => {
    const { text } = formatNotification(
      makeClassification(),
      makeEvent({ source: 'riksdagen' }),
    );
    expect(text).toContain('Riksdagen');
  });

  it('returnerar inline_keyboard med en URL-knapp "📄 Öppna" som pekar på event.url', () => {
    const { replyMarkup } = formatNotification(
      makeClassification(),
      makeEvent({ url: 'https://riksdagen.se/sfs/2026:1234' }),
    );
    expect(replyMarkup).toEqual({
      inline_keyboard: [[{ text: '📄 Öppna', url: 'https://riksdagen.se/sfs/2026:1234' }]],
    });
  });

  it('inkluderar inte URL:en som rå text i meddelandet — den ligger bara i knappen', () => {
    const { text } = formatNotification(
      makeClassification(),
      makeEvent({ url: 'https://example.test/unique-url-abc' }),
    );
    expect(text).not.toContain('https://example.test/unique-url-abc');
  });

  describe('boilerplate-rensning', () => {
    it('inkluderar inte den gamla "Skatte- eller regulatorisk uppdatering"-headern', () => {
      const { text } = formatNotification(makeClassification(), makeEvent());
      expect(text).not.toContain('Skatte');
      expect(text).not.toContain('regulatorisk');
    });

    it('inkluderar inte "Kategori:"-raden', () => {
      const { text } = formatNotification(
        makeClassification({ tags: ['moms', 'arbetsgivare'] }),
        makeEvent(),
      );
      expect(text).not.toContain('Kategori');
    });

    it('inkluderar inte "Allvar:"-raden eller severity-emoji som ⚠️ 📌 ℹ️', () => {
      const { text } = formatNotification(
        makeClassification({ severity: 'action_required' }),
        makeEvent(),
      );
      expect(text).not.toContain('Allvar');
      expect(text).not.toContain('⚠️');
      expect(text).not.toContain('📌');
      expect(text).not.toContain('ℹ️');
    });

    it('inkluderar inte "🔗 Läs hos källan"-inline-länken', () => {
      const { text } = formatNotification(makeClassification(), makeEvent());
      expect(text).not.toContain('Läs hos källan');
      expect(text).not.toContain('🔗');
    });

    it('inkluderar inte per-notis-disclaimer-raderna ("Informationsnotis", "AI-genererad")', () => {
      const { text } = formatNotification(makeClassification(), makeEvent());
      expect(text).not.toContain('Informationsnotis');
      expect(text).not.toContain('Verifiera alltid mot primärkälla');
      expect(text).not.toContain('AI-genererad');
      expect(text).not.toContain('AI\\-genererad');
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
    it('lägger till disclaimer-raden när title innehåller förbjudet ord', () => {
      const { text } = formatNotification(
        makeClassification({ summary: 'Neutral text' }),
        makeEvent({ title: 'Viktigt meddelande från Skatteverket' }),
      );
      expect(text).toContain('_Informationstjänst, ej rådgivning\\._');
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

  describe('layout', () => {
    it('formatet är exakt 2 rader (titel + källa) vid neutral input', () => {
      // Brutal minimalism: ingen tom rad i message-bodyn. Knappen
      // renderas separat via reply_markup och behöver ingen visuell spacing.
      const { text } = formatNotification(
        makeClassification({ summary: 'Neutral text' }),
        makeEvent({ title: 'SFS 2026:1234 om moms', source: 'riksdagen' }),
      );
      const lines = text.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('*SFS 2026:1234 om moms*');
      expect(lines[1]).toBe('Riksdagen');
    });

    it('lägger disclaimer-raden mellan titel och källa när forbidden word triggras', () => {
      // _Informationstjänst, ej rådgivning._ ska komma direkt efter titeln så
      // läsaren ser kontexten innan källan.
      const { text } = formatNotification(
        makeClassification({ summary: 'Neutral text' }),
        makeEvent({ title: 'Viktigt meddelande', source: 'skv' }),
      );
      const lines = text.split('\n');
      expect(lines[0]).toBe('*Viktigt meddelande*');
      expect(lines[1]).toBe('_Informationstjänst, ej rådgivning\\._');
      expect(lines[2]).toBe('Skatteverket');
    });
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
