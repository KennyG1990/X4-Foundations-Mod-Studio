import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArtifactPlan, hashArtifactFile, type ArtifactEntry } from './artifactPipeline';

export type ProjectFileState = 'source' | 'synchronized-generated' | 'generated-only' | 'conflict';

export interface ProjectFileInventoryEntry {
  path: string;
  disposition: 'generated' | 'source-copy';
  state: ProjectFileState;
  size: number;
  sha256: string;
  diskSha256?: string;
  text: boolean;
  openable: boolean;
  materializable: boolean;
  reason: string;
}

export interface ProjectFileInventory {
  ok: boolean;
  sourceAvailable: boolean;
  entries: ProjectFileInventoryEntry[];
  excludedCount: number;
  errors: string[];
}

function bufferLooksText(sample: Buffer): boolean {
  if (sample.length === 0) return true;
  if (sample.length >= 2 && ((sample[0] === 0xff && sample[1] === 0xfe) || (sample[0] === 0xfe && sample[1] === 0xff))) return true;
  let controls = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controls++;
  }
  return controls / sample.length < 0.08;
}

function diskLooksText(filePath: string): boolean {
  const stat = fs.statSync(filePath);
  const length = Math.min(stat.size, 16 * 1024);
  if (!length) return true;
  const sample = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  try { fs.readSync(fd, sample, 0, length, 0); } finally { fs.closeSync(fd); }
  return bufferLooksText(sample);
}

function entryText(entry: ArtifactEntry, diskPath: string | null): boolean {
  if (diskPath && fs.existsSync(diskPath)) return diskLooksText(diskPath);
  if (typeof entry.content === 'string') return !entry.content.includes('\0');
  if (Buffer.isBuffer(entry.content)) return bufferLooksText(entry.content.subarray(0, 16 * 1024));
  return false;
}

export function buildProjectFileInventory(sourceRootInput: string | null, generatedFiles: Record<string, string | Buffer>): ProjectFileInventory {
  const sourceAvailable = Boolean(sourceRootInput && fs.existsSync(sourceRootInput) && fs.statSync(sourceRootInput).isDirectory());
  let entries: ArtifactEntry[];
  let excludedCount = 0;
  let errors: string[] = [];
  if (sourceAvailable) {
    const plan = buildArtifactPlan({ sourceRoot: sourceRootInput!, generatedFiles });
    entries = plan.entries;
    excludedCount = plan.excluded.length;
    errors = plan.errors;
  } else {
    entries = Object.entries(generatedFiles).map(([filePath, content]) => ({
      path: filePath,
      disposition: 'generated' as const,
      reason: 'claimed by compiler output',
      size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf8'),
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      content,
    })).sort((left, right) => left.path.localeCompare(right.path));
  }

  const inventory = entries.map((entry): ProjectFileInventoryEntry => {
    const diskPath = sourceAvailable ? path.join(sourceRootInput!, ...entry.path.split('/')) : null;
    const diskExists = Boolean(diskPath && fs.existsSync(diskPath) && fs.lstatSync(diskPath).isFile() && !fs.lstatSync(diskPath).isSymbolicLink());
    const diskSha256 = diskExists ? hashArtifactFile(diskPath!) : undefined;
    const text = entryText(entry, diskExists ? diskPath : null);
    const state: ProjectFileState = entry.disposition === 'source-copy'
      ? 'source'
      : !diskExists
        ? 'generated-only'
        : diskSha256 === entry.sha256
          ? 'synchronized-generated'
          : 'conflict';
    return {
      path: entry.path,
      disposition: entry.disposition,
      state,
      size: entry.size,
      sha256: entry.sha256,
      ...(diskSha256 ? { diskSha256 } : {}),
      text,
      openable: diskExists && text,
      // A conflict must be compared/reconciled, never presented to any caller as a
      // writeable materialization target. Only a genuinely absent generated file is safe.
      materializable: entry.disposition === 'generated' && text && state === 'generated-only',
      reason: entry.reason,
    };
  });
  return { ok: errors.length === 0, sourceAvailable, entries: inventory, excludedCount, errors };
}

export function runProjectFileInventorySelftest(): { pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-file-inventory-'));
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const record = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
  try {
    fs.mkdirSync(path.join(root, 'libraries'), { recursive: true });
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    fs.writeFileSync(path.join(root, 'content.xml'), '<content/>');
    fs.writeFileSync(path.join(root, 'libraries', 'wares.xml'), '<diff/>');
    fs.writeFileSync(path.join(root, 'assets', 'payload.bin'), Buffer.from([0, 1, 2, 3]));
    fs.writeFileSync(path.join(root, '.git', 'config'), 'excluded');
    const generated = {
      'content.xml': '<content/>',
      'libraries/wares.xml': '<diff><replace sel="/wares/@x">1</replace></diff>',
      'md/generated.xml': '<mdscript/>',
    };
    const inventory = buildProjectFileInventory(root, generated);
    const byPath = new Map(inventory.entries.map(entry => [entry.path, entry]));
    record('development metadata excluded', !byPath.has('.git/config') && inventory.excludedCount > 0);
    record('arbitrary binary retained but not text-openable', byPath.get('assets/payload.bin')?.text === false && byPath.get('assets/payload.bin')?.openable === false);
    record('missing generated file is materializable', byPath.get('md/generated.xml')?.state === 'generated-only' && byPath.get('md/generated.xml')?.materializable === true);
    record('different generated bytes are an explicit non-materializable conflict',
      byPath.get('libraries/wares.xml')?.state === 'conflict'
      && byPath.get('libraries/wares.xml')?.materializable === false);
    record('byte-identical generated bytes are synchronized', byPath.get('content.xml')?.state === 'synchronized-generated');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return { pass: checks.every(check => check.pass), checks };
}
