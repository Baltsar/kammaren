import { readFile } from 'node:fs/promises';
import type { WatcherEvent } from '../schema/event.js';

export function filterNew(events: WatcherEvent[], existingIds: Set<string>): WatcherEvent[] {
  return events.filter((event) => !existingIds.has(event.id));
}

export async function loadExistingIds(jsonlPath: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let content: string;
  try {
    content = await readFile(jsonlPath, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ids;
    throw err;
  }
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as { id?: unknown };
      if (typeof obj.id === 'string') ids.add(obj.id);
    } catch (err) {
      console.warn('[watcher][dedupe] skipping malformed JSONL line:', err);
    }
  }
  return ids;
}
