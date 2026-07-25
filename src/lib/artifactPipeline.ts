/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Disk-backed artifact planning for arbitrary X4 extensions.
 *
 * Browser/workspace size limits must never become packaging limits. Generated
 * paths carry their bytes in memory; every other included source file is
 * represented by path + hashes and streamed/copied from disk when materialized.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type ArtifactDisposition = 'generated' | 'source-copy';

export interface ArtifactEntry {
  path: string;
  disposition: ArtifactDisposition;
  reason: string;
  size: number;
  sha256: string;
  mtimeMs?: number;
  sourcePath?: string;
  content?: string | Buffer;
  catalogLoose?: boolean;
}

export interface ArtifactExcludedEntry {
  path: string;
  reason: string;
  rule: string;
}

export interface ArtifactRules {
  exclude: string[];
  runtimeOwned: string[];
  catalogLoose: string[];
}

export interface ArtifactPlan {
  ok: boolean;
  sourceRoot: string;
  entries: ArtifactEntry[];
  excluded: ArtifactExcludedEntry[];
  runtimeOwned: ArtifactExcludedEntry[];
  rules: ArtifactRules;
  errors: string[];
  totals: {
    generatedFiles: number;
    sourceCopyFiles: number;
    includedBytes: number;
    excludedEntries: number;
    runtimeOwnedEntries: number;
  };
}

export interface ArtifactBuildResult {
  ok: boolean;
  targetRoot: string;
  written: number;
  bytes: number;
  errors: string[];
}

export interface ArtifactVerificationResult {
  ok: boolean;
  checked: number;
  errors: string[];
}

export interface BuildArtifactPlanOptions {
  sourceRoot: string;
  generatedFiles?: Record<string, string | Buffer>;
  rules?: Partial<ArtifactRules>;
}

const UNIVERSAL_EXCLUDES = [
  '.git/**',
  '.hg/**',
  '.svn/**',
  '.claude/**',
  '.kilo/**',
  '.forge/**',
  '.forge-builds/**',
  '.snapshots/**',
  '.studio-mod-id',
  '.forgekeep',
  'node_modules/**',
  '.forgeartifact.json',
];

function sha256Buffer(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function hashArtifactFile(filePath: string, algorithm: 'sha256' | 'md5' = 'sha256'): string {
  const hash = crypto.createHash(algorithm);
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (read <= 0) break;
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function comparisonKey(relativePath: string): string {
  return relativePath.toLocaleLowerCase('en-US');
}

function safeRelativePath(rawPath: string): string | null {
  const forward = String(rawPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!forward || /^[a-zA-Z]:\//.test(forward)) return null;
  const parts = forward.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globRegex(patternInput: string): RegExp | null {
  let pattern = String(patternInput || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!pattern || pattern.includes('\0') || pattern.split('/').includes('..')) return null;
  if (pattern.endsWith('/')) pattern += '**';
  const rootAlso = pattern.endsWith('/**');
  let source = '';
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index++;
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegex(char);
    }
  }
  if (rootAlso) {
    const root = pattern.slice(0, -3);
    return new RegExp(`^(?:${escapeRegex(root)}(?:/.*)?)$`, 'i');
  }
  return new RegExp(`^${source}$`, 'i');
}

function matchingRule(relativePath: string, rules: string[]): string | null {
  for (const rule of rules) {
    const matcher = globRegex(rule);
    if (matcher?.test(relativePath)) return rule;
  }
  return null;
}

export function artifactPathMatches(relativePath: string, rules: string[]): boolean {
  return matchingRule(relativePath.replace(/\\/g, '/').replace(/^\/+/, ''), rules) !== null;
}

function normalizeRules(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function loadProjectRules(sourceRoot: string, errors: string[]): ArtifactRules {
  const rules: ArtifactRules = { exclude: [], runtimeOwned: [], catalogLoose: [] };
  const configPath = path.join(sourceRoot, '.forgeartifact.json');
  if (!fs.existsSync(configPath)) return rules;
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    rules.exclude = normalizeRules(parsed.exclude);
    rules.runtimeOwned = normalizeRules(parsed.runtimeOwned);
    rules.catalogLoose = normalizeRules(parsed.catalogLoose);
    for (const [kind, patterns] of Object.entries(rules)) {
      for (const pattern of patterns) {
        if (!globRegex(pattern)) errors.push(`Invalid ${kind} rule in .forgeartifact.json: ${pattern}`);
      }
    }
  } catch (error) {
    errors.push(`Could not parse .forgeartifact.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  return rules;
}

function mergeRules(sourceRoot: string, provided: Partial<ArtifactRules> | undefined, errors: string[]): ArtifactRules {
  const project = loadProjectRules(sourceRoot, errors);
  return {
    exclude: Array.from(new Set([...UNIVERSAL_EXCLUDES, ...project.exclude, ...normalizeRules(provided?.exclude)])),
    runtimeOwned: Array.from(new Set([...project.runtimeOwned, ...normalizeRules(provided?.runtimeOwned)])),
    catalogLoose: Array.from(new Set([...project.catalogLoose, ...normalizeRules(provided?.catalogLoose)])),
  };
}

function inside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Build a complete ownership plan without reading source files into memory. */
export function buildArtifactPlan(options: BuildArtifactPlanOptions): ArtifactPlan {
  const sourceRoot = path.resolve(String(options.sourceRoot || ''));
  const errors: string[] = [];
  const entries: ArtifactEntry[] = [];
  const excluded: ArtifactExcludedEntry[] = [];
  const runtimeOwned: ArtifactExcludedEntry[] = [];
  if (!options.sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    errors.push(`Artifact source root does not exist or is not a directory: ${sourceRoot}`);
  }
  const rules = mergeRules(sourceRoot, options.rules, errors);
  const generated = new Map<string, ArtifactEntry>();
  const occupied = new Map<string, string>();

  for (const [rawPath, content] of Object.entries(options.generatedFiles || {})) {
    const relativePath = safeRelativePath(rawPath);
    if (!relativePath) {
      errors.push(`Unsafe generated artifact path: ${rawPath}`);
      continue;
    }
    const key = comparisonKey(relativePath);
    const prior = occupied.get(key);
    if (prior && prior !== relativePath) {
      errors.push(`Generated artifact paths collide after case normalization: ${prior} and ${relativePath}`);
      continue;
    }
    const bytes = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf8');
    const entry: ArtifactEntry = {
      path: relativePath,
      disposition: 'generated',
      reason: 'claimed by compiler output',
      size: bytes,
      sha256: sha256Buffer(content),
      content,
      catalogLoose: Boolean(matchingRule(relativePath, rules.catalogLoose)),
    };
    occupied.set(key, relativePath);
    generated.set(key, entry);
  }

  const walk = (absoluteDir: string, relativeDir: string): void => {
    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      errors.push(`Could not enumerate ${relativeDir || '.'}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    for (const child of children) {
      const relativePath = relativeDir ? `${relativeDir}/${child.name}` : child.name;
      const absolutePath = path.join(absoluteDir, child.name);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(absolutePath);
      } catch (error) {
        errors.push(`Could not inspect ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      if (stat.isSymbolicLink()) {
        errors.push(`Symbolic link or reparse-point entry is not allowed in an artifact source: ${relativePath}`);
        continue;
      }

      const excludeRule = matchingRule(relativePath, rules.exclude);
      const runtimeRule = matchingRule(relativePath, rules.runtimeOwned);
      if (excludeRule) {
        excluded.push({ path: stat.isDirectory() ? `${relativePath}/**` : relativePath, reason: excludeRule.startsWith('.') || excludeRule.startsWith('node_modules') ? 'universal development metadata exclusion' : 'project exclusion', rule: excludeRule });
        continue;
      }
      if (runtimeRule) {
        runtimeOwned.push({ path: stat.isDirectory() ? `${relativePath}/**` : relativePath, reason: 'project runtime-owned path', rule: runtimeRule });
        continue;
      }
      if (stat.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }
      if (!stat.isFile()) {
        errors.push(`Unsupported filesystem entry type in artifact source: ${relativePath}`);
        continue;
      }

      const safe = safeRelativePath(relativePath);
      if (!safe) {
        errors.push(`Unsafe source artifact path: ${relativePath}`);
        continue;
      }
      const key = comparisonKey(safe);
      const prior = occupied.get(key);
      if (prior && prior !== safe) {
        errors.push(`Artifact source paths collide after case normalization: ${prior} and ${safe}`);
        continue;
      }
      if (generated.has(key)) continue;
      occupied.set(key, safe);
      try {
        entries.push({
          path: safe,
          disposition: 'source-copy',
          reason: 'source file not claimed by a compiler output',
          size: stat.size,
          sha256: hashArtifactFile(absolutePath),
          mtimeMs: stat.mtimeMs,
          sourcePath: absolutePath,
          catalogLoose: Boolean(matchingRule(safe, rules.catalogLoose)),
        });
      } catch (error) {
        errors.push(`Could not hash source artifact ${safe}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  if (errors.length === 0 || fs.existsSync(sourceRoot)) walk(sourceRoot, '');
  entries.push(...generated.values());
  entries.sort((left, right) => left.path.localeCompare(right.path));
  excluded.sort((left, right) => left.path.localeCompare(right.path));
  runtimeOwned.sort((left, right) => left.path.localeCompare(right.path));

  return {
    ok: errors.length === 0,
    sourceRoot,
    entries,
    excluded,
    runtimeOwned,
    rules,
    errors,
    totals: {
      generatedFiles: entries.filter(entry => entry.disposition === 'generated').length,
      sourceCopyFiles: entries.filter(entry => entry.disposition === 'source-copy').length,
      includedBytes: entries.reduce((sum, entry) => sum + entry.size, 0),
      excludedEntries: excluded.length,
      runtimeOwnedEntries: runtimeOwned.length,
    },
  };
}

/** Materialize a plan into a new/empty scratch directory and verify every written hash. */
export function materializeArtifact(plan: ArtifactPlan, targetRootInput: string): ArtifactBuildResult {
  const targetRoot = path.resolve(targetRootInput);
  const errors = [...plan.errors];
  if (!plan.ok) return { ok: false, targetRoot, written: 0, bytes: 0, errors };
  if (inside(targetRoot, plan.sourceRoot) || inside(plan.sourceRoot, targetRoot)) {
    errors.push(`Artifact target must not overlap its source root: ${targetRoot}`);
    return { ok: false, targetRoot, written: 0, bytes: 0, errors };
  }
  if (fs.existsSync(targetRoot)) {
    let existing: string[] = [];
    try { existing = fs.readdirSync(targetRoot); } catch { existing = ['<unreadable>']; }
    if (existing.length > 0) {
      errors.push(`Artifact target must be new or empty: ${targetRoot}`);
      return { ok: false, targetRoot, written: 0, bytes: 0, errors };
    }
  } else {
    fs.mkdirSync(targetRoot, { recursive: true });
  }

  let written = 0;
  let bytes = 0;
  for (const entry of plan.entries) {
    const destination = path.resolve(targetRoot, ...entry.path.split('/'));
    if (!inside(destination, targetRoot) || destination === targetRoot) {
      errors.push(`Artifact entry escaped target root: ${entry.path}`);
      break;
    }
    try {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (entry.disposition === 'generated') {
        if (entry.content === undefined) throw new Error('generated content is missing');
        fs.writeFileSync(destination, entry.content);
      } else {
        if (!entry.sourcePath || !fs.existsSync(entry.sourcePath)) throw new Error('planned source file is missing');
        const sourceStat = fs.lstatSync(entry.sourcePath);
        if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) throw new Error('planned source is no longer a regular file');
        const currentHash = hashArtifactFile(entry.sourcePath);
        if (currentHash !== entry.sha256) throw new Error(`source changed after planning (${entry.sha256} -> ${currentHash})`);
        fs.copyFileSync(entry.sourcePath, destination);
      }
      const destinationStat = fs.statSync(destination);
      const destinationHash = hashArtifactFile(destination);
      if (destinationStat.size !== entry.size || destinationHash !== entry.sha256) {
        throw new Error(`destination verification mismatch (size ${destinationStat.size}/${entry.size}, hash ${destinationHash}/${entry.sha256})`);
      }
      written++;
      bytes += destinationStat.size;
    } catch (error) {
      errors.push(`Failed to materialize ${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }
  return { ok: errors.length === 0 && written === plan.entries.length, targetRoot, written, bytes, errors };
}

/** Verify that an artifact contains exactly the planned included files and bytes. */
export function verifyMaterializedArtifact(plan: ArtifactPlan, targetRootInput: string): ArtifactVerificationResult {
  const targetRoot = path.resolve(targetRootInput);
  const errors: string[] = [];
  const actual = new Map<string, string>();
  const walk = (absoluteDir: string, relativeDir: string): void => {
    for (const child of fs.readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relativePath = relativeDir ? `${relativeDir}/${child.name}` : child.name;
      const absolutePath = path.join(absoluteDir, child.name);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        errors.push(`Artifact contains a symbolic link or reparse-point entry: ${relativePath}`);
      } else if (stat.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (stat.isFile()) {
        actual.set(comparisonKey(relativePath), relativePath);
      } else {
        errors.push(`Artifact contains an unsupported filesystem entry: ${relativePath}`);
      }
    }
  };
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    return { ok: false, checked: 0, errors: [`Artifact target does not exist: ${targetRoot}`] };
  }
  walk(targetRoot, '');
  let checked = 0;
  const planned = new Set(plan.entries.map(entry => comparisonKey(entry.path)));
  for (const entry of plan.entries) {
    const actualPath = actual.get(comparisonKey(entry.path));
    if (!actualPath) {
      errors.push(`Artifact is missing planned file: ${entry.path}`);
      continue;
    }
    const absolutePath = path.join(targetRoot, ...actualPath.split('/'));
    const stat = fs.statSync(absolutePath);
    const hash = hashArtifactFile(absolutePath);
    if (stat.size !== entry.size) errors.push(`Artifact size mismatch for ${entry.path}: ${stat.size} != ${entry.size}`);
    if (hash !== entry.sha256) errors.push(`Artifact hash mismatch for ${entry.path}: ${hash} != ${entry.sha256}`);
    checked++;
  }
  for (const [key, actualPath] of actual) {
    if (!planned.has(key)) errors.push(`Artifact contains unplanned file: ${actualPath}`);
  }
  return { ok: errors.length === 0 && checked === plan.entries.length, checked, errors };
}
