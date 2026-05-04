import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, open } from 'node:fs/promises';
import { runWatcher, type RunWatcherResult } from '../watcher/poller/index.js';
import { runClassifier, type RunClassifierResult } from './classifier.js';
import { runDelivery, type RunDeliveryResult } from './delivery.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(here, 'data');
const CLASSIFICATIONS_PATH = path.join(DATA_DIR, 'classifications.jsonl');
const DELIVERIES_PATH = path.join(DATA_DIR, 'deliveries.jsonl');

type StepFailure = { error: string };

export type PipelineResult = {
  watcher: RunWatcherResult | StepFailure;
  classifier: RunClassifierResult | StepFailure;
  delivery: RunDeliveryResult | StepFailure;
};

export async function runPipeline(): Promise<PipelineResult> {
  await ensureDataFiles();
  const watcher = await runStep('watcher', runWatcher);
  const classifier = await runStep('classifier', runClassifier);
  const delivery = await runStep('delivery', runDelivery);
  return { watcher, classifier, delivery };
}

async function runStep<T>(name: string, fn: () => Promise<T>): Promise<T | StepFailure> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] ${name} step failed:`, err);
    return { error: message };
  }
}

async function ensureDataFiles(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  for (const p of [CLASSIFICATIONS_PATH, DELIVERIES_PATH]) {
    const handle = await open(p, 'a');
    await handle.close();
  }
}

const isMain = (import.meta as unknown as { main?: boolean }).main === true;

if (isMain) {
  runPipeline()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[pipeline] runPipeline crashed:', err);
      process.exit(1);
    });
}
