import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadExistingIds } from '../watcher/poller/dedupe.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLASSIFICATIONS_PATH = path.resolve(here, 'data', 'classifications.jsonl');
const DELIVERIES_PATH = path.resolve(here, 'data', 'deliveries.jsonl');

export type RunDeliveryResult = {
  sent: number;
  skipped: number;
};

export async function runDelivery(): Promise<RunDeliveryResult> {
  // Validate I/O paths even though no deliveries are produced yet.
  await loadExistingIds(CLASSIFICATIONS_PATH);
  await loadExistingIds(DELIVERIES_PATH);
  return { sent: 0, skipped: 0 };
}
