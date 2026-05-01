import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pollSkv, type SkvPollStats } from './skv.js';
import { pollRiksdagen } from './riksdagen.js';
import { loadExistingIds, filterNew } from './dedupe.js';
import { appendEvents } from './writer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WATCHER_DIR = path.resolve(here, '..');
const JSONL_PATH = path.join(WATCHER_DIR, 'data', 'events.jsonl');

export type RunWatcherResult = {
  skv: number;
  riksdagen: number;
  total: number;
  skv_feeds: SkvPollStats;
};

export async function runWatcher(): Promise<RunWatcherResult> {
  const existingIds = await loadExistingIds(JSONL_PATH);

  const [skvResult, riksdagenEvents] = await Promise.all([pollSkv(), pollRiksdagen()]);

  const newSkv = filterNew(skvResult.events, existingIds);

  const idsAfterSkv = new Set(existingIds);
  for (const event of newSkv) idsAfterSkv.add(event.id);
  const newRiksdagen = filterNew(riksdagenEvents, idsAfterSkv);

  const all = [...newSkv, ...newRiksdagen];
  await appendEvents(JSONL_PATH, all);

  return {
    skv: newSkv.length,
    riksdagen: newRiksdagen.length,
    total: all.length,
    skv_feeds: skvResult.stats,
  };
}

const isMain = (import.meta as unknown as { main?: boolean }).main === true;

if (isMain) {
  runWatcher()
    .then((result) => {
      console.log(result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[watcher] runWatcher crashed:', err);
      process.exit(1);
    });
}
