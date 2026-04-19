/**
 * CLI adapter — REPL → handleMessage
 *
 * ⚠️  WIP — beror på ../chat-handler.ts som är ej färdig i publika repot
 *     (kräver agents/ceo/SOUL.md m.fl.). REPL startar men kraschar vid
 *     första frågan tills agent-filerna är på plats.
 */

import '../load-env.js';
import { createInterface } from 'node:readline';
import { handleMessage } from '../chat-handler.js';

let closed = false;

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.on('close', () => { closed = true; });

const PROMPT = 'KAMMAREN > ';

function ask(): void {
  if (closed) return;
  rl.question(PROMPT, async (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'exit' || trimmed === 'quit') {
      console.log('Hej då!');
      rl.close();
      return;
    }

    try {
      const res = await handleMessage({ message: trimmed, userId: 'cli' });
      console.log('\n' + res.text + '\n');
    } catch (err) {
      console.error('Fel:', err instanceof Error ? err.message : err);
    }

    ask();
  });
}

console.log('KAMMAREN — CEO-agent CLI');
console.log('Skriv "exit" för att avsluta.\n');
ask();
