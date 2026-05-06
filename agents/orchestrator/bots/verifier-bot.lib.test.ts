import { describe, expect, it } from 'vitest';
import { buildVerifierMessage, escapeHtml } from './verifier-bot.lib.js';

describe('verifier-bot.lib', () => {
  describe('escapeHtml', () => {
    it('escapes &, <, >', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
      expect(escapeHtml('<tag>')).toBe('&lt;tag&gt;');
      expect(escapeHtml('mixed <a&b>')).toBe('mixed &lt;a&amp;b&gt;');
    });

    it('passes through normal text untouched', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
      expect(escapeHtml('123-4567')).toBe('123-4567');
    });
  });

  describe('buildVerifierMessage', () => {
    it('returns chat_id wrapped in <code> and points back to browser tab', () => {
      const msg = buildVerifierMessage('544123218');
      expect(msg).toContain('<code>544123218</code>');
      expect(msg).toContain('Välkommen till KAMMAREN Watcher');
      expect(msg).toContain('webbläsarfliken');
    });

    it('contains no URL or anchor tag', () => {
      const msg = buildVerifierMessage('544123218');
      expect(msg).not.toContain('http');
      expect(msg).not.toContain('<a href');
      expect(msg).not.toContain('kammaren.nu');
    });

    it('escapes hostile chat_id', () => {
      const msg = buildVerifierMessage('<script>');
      expect(msg).toContain('<code>&lt;script&gt;</code>');
      expect(msg).not.toContain('<script>');
    });
  });
});
