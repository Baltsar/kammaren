/**
 * SIE4 Import Safety — Duplicate detection + staging + manifest
 *
 * VIB-115: Dedup layer ON TOP of sie4-parser.ts.
 * Zero LLM. Deterministic. Atomic writes (GUARDRAILS regel 4).
 */

import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from './config.js';
import type { Verification } from './sie4-parser.js';

// ── Types ────────────────────────────────────────────────────────────────

export type DuplicateStatus = 'EXAKT_DUBBLETT' | 'POTENTIELL_DUBBLETT' | 'NY';

export interface DuplicateResult {
  series: string;
  number: number;
  date: string;
  description: string;
  verHash: string;
  status: DuplicateStatus;
  matchedImportDate?: string;
  matchedFileHash?: string;
}

export interface DuplicateReport {
  fileHash: string;
  fileAlreadyImported: boolean;
  previousImportDate?: string;
  results: DuplicateResult[];
  stats: {
    total: number;
    ny: number;
    exakt: number;
    potentiell: number;
  };
}

export interface ManifestVerification {
  hash: string;
  series: string;
  number: number;
  date: string;
  totalAbsAmount: number;
}

export interface ManifestEntry {
  fileHash: string;
  importedAt: string;
  orgNumber: string;
  sourceProgram: string;
  verificationsImported: number;
  verificationsSkipped: number;
  verifications: ManifestVerification[];
}

export interface Manifest {
  version: number;
  entries: ManifestEntry[];
}

// ── Constants ────────────────────────────────────────────────────────────

const MANIFEST_PATH = resolve(ROOT, 'vault/imports/manifest.json');

// ── Functions ────────────────────────────────────────────────────────────

/**
 * Hash the raw SIE4 file bytes. Used for exact file-level dedup.
 */
export function hashSIE4File(filePath: string): string {
  const raw = readFileSync(filePath);
  return 'sha256:' + createHash('sha256').update(raw).digest('hex');
}

/**
 * Hash a single verification canonically.
 * Canonical form: series|number|date|sorted(account:amount)|description
 * Sorting transactions ensures order-independence.
 */
export function hashVerification(ver: Verification): string {
  const txParts = ver.transactions
    .map(tx => `${tx.account}:${tx.amount}`)
    .sort()
    .join('|');
  const canonical = `${ver.series}|${ver.number}|${ver.date}|${txParts}|${ver.description}`;
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}

/**
 * Load manifest from vault/imports/manifest.json.
 * Returns empty manifest if file doesn't exist.
 */
export function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 1, entries: [] };
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

/**
 * Check for duplicates at file-level and verification-level.
 *
 * - EXAKT_DUBBLETT: verification hash matches a previously imported verification
 * - POTENTIELL_DUBBLETT: same date + same total absolute amount, but different hash
 * - NY: no match found
 *
 * If the entire file hash already exists in the manifest,
 * all verifications are marked EXAKT_DUBBLETT and fileAlreadyImported=true.
 */
export function checkDuplicates(
  verifications: Verification[],
  fileHash: string,
  manifest: Manifest,
): DuplicateReport {
  // File-level check: has this exact file been imported before?
  const existingEntry = manifest.entries.find(e => e.fileHash === fileHash);
  if (existingEntry) {
    return {
      fileHash,
      fileAlreadyImported: true,
      previousImportDate: existingEntry.importedAt,
      results: verifications.map(ver => ({
        series: ver.series,
        number: ver.number,
        date: ver.date,
        description: ver.description,
        verHash: hashVerification(ver),
        status: 'EXAKT_DUBBLETT' as const,
        matchedImportDate: existingEntry.importedAt,
        matchedFileHash: existingEntry.fileHash,
      })),
      stats: {
        total: verifications.length,
        ny: 0,
        exakt: verifications.length,
        potentiell: 0,
      },
    };
  }

  // Build lookup maps from all manifest entries
  const verHashMap = new Map<string, { importedAt: string; fileHash: string }>();
  const dateAmountMap = new Map<string, { importedAt: string; fileHash: string }>();

  for (const entry of manifest.entries) {
    for (const mVer of entry.verifications) {
      verHashMap.set(mVer.hash, {
        importedAt: entry.importedAt,
        fileHash: entry.fileHash,
      });
      const key = `${mVer.date}|${mVer.totalAbsAmount}`;
      if (!dateAmountMap.has(key)) {
        dateAmountMap.set(key, {
          importedAt: entry.importedAt,
          fileHash: entry.fileHash,
        });
      }
    }
  }

  // Check each verification
  const results: DuplicateResult[] = [];
  let ny = 0;
  let exakt = 0;
  let potentiell = 0;

  for (const ver of verifications) {
    const verHash = hashVerification(ver);
    const totalAbsAmount = ver.transactions.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0,
    );
    const dateAmountKey = `${ver.date}|${totalAbsAmount}`;

    if (verHashMap.has(verHash)) {
      const match = verHashMap.get(verHash)!;
      results.push({
        series: ver.series,
        number: ver.number,
        date: ver.date,
        description: ver.description,
        verHash,
        status: 'EXAKT_DUBBLETT',
        matchedImportDate: match.importedAt,
        matchedFileHash: match.fileHash,
      });
      exakt++;
    } else if (dateAmountMap.has(dateAmountKey)) {
      const match = dateAmountMap.get(dateAmountKey)!;
      results.push({
        series: ver.series,
        number: ver.number,
        date: ver.date,
        description: ver.description,
        verHash,
        status: 'POTENTIELL_DUBBLETT',
        matchedImportDate: match.importedAt,
        matchedFileHash: match.fileHash,
      });
      potentiell++;
    } else {
      results.push({
        series: ver.series,
        number: ver.number,
        date: ver.date,
        description: ver.description,
        verHash,
        status: 'NY',
      });
      ny++;
    }
  }

  return {
    fileHash,
    fileAlreadyImported: false,
    results,
    stats: { total: verifications.length, ny, exakt, potentiell },
  };
}

/**
 * Write manifest atomically (GUARDRAILS regel 4: temp + rename).
 */
export function writeManifest(manifest: Manifest): void {
  const dir = dirname(MANIFEST_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tmpPath = `${MANIFEST_PATH}.tmp`;
  const content = JSON.stringify(manifest, null, 2);
  writeFileSync(tmpPath, content, 'utf-8');

  // Verify JSON integrity before committing
  JSON.parse(readFileSync(tmpPath, 'utf-8'));

  renameSync(tmpPath, MANIFEST_PATH);
}

/**
 * Get the manifest file path (for testing).
 */
export function getManifestPath(): string {
  return MANIFEST_PATH;
}
