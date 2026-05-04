import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadExistingIds } from '../watcher/poller/dedupe.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_PATH = path.resolve(here, '..', 'watcher', 'data', 'events.jsonl');
const CLASSIFICATIONS_PATH = path.resolve(here, 'data', 'classifications.jsonl');

export type RunClassifierResult = {
  processed: number;
  skipped: number;
};

export async function runClassifier(): Promise<RunClassifierResult> {
  // Validate I/O paths even though no classifications are produced yet.
  await loadExistingIds(EVENTS_PATH);
  await loadExistingIds(CLASSIFICATIONS_PATH);
  return { processed: 0, skipped: 0 };
}
