import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { WatcherEvent } from '../schema/event.js';

export async function appendEvents(jsonlPath: string, events: WatcherEvent[]): Promise<void> {
  if (events.length === 0) return;
  await mkdir(dirname(jsonlPath), { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await appendFile(jsonlPath, lines, 'utf8');
}
