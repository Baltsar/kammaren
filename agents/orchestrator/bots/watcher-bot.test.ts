/**
 * Smoke test: createWatcherBot ska kunna skapas med en fake-token
 * utan att försöka prata med Telegram-API:et. Botens hela
 * meddelande-logik testas i watcher-bot.lib.test.ts; här verifierar
 * vi bara att command-handlers binds.
 */

import { describe, expect, it } from 'vitest';
import { createWatcherBot } from './watcher-bot.js';
import { createVerifierBot } from './verifier-bot.js';

const FAKE_TOKEN = '1234567890:fake-token-for-tests-only';

describe('bot factories', () => {
  it('createWatcherBot returns a Bot instance without throwing', () => {
    const bot = createWatcherBot(FAKE_TOKEN);
    expect(bot).toBeDefined();
    expect(typeof bot.start).toBe('function');
    expect(typeof bot.stop).toBe('function');
  });

  it('createVerifierBot returns a Bot instance without throwing', () => {
    const bot = createVerifierBot(FAKE_TOKEN);
    expect(bot).toBeDefined();
    expect(typeof bot.start).toBe('function');
  });
});
