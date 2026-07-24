#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { DEFAULT_X4_REFERENCE_ROOT } from '../src/lib/xsdParser';
import { discoverOfficialDlcOrder, resolveEffectiveReferenceDocument } from '../src/lib/referenceOverlay';

const root = path.resolve(process.env.X4_REFERENCE_ROOT || DEFAULT_X4_REFERENCE_ROOT);
const dlcs = discoverOfficialDlcOrder(root);

function walkXml(dir: string, out: string[]): void {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walkXml(absolute, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) out.push(absolute);
  }
}

function isDiff(file: string): boolean {
  try {
    const head = fs.readFileSync(file, 'utf8').slice(0, 65536).replace(/<!--[\s\S]*?-->/g, '');
    return /<(?!\?|!)diff\b/i.test(head);
  } catch { return false; }
}

const relativePaths = new Set<string>();
const sourceFiles: string[] = [];
for (const dlc of dlcs) {
  const files: string[] = [];
  walkXml(dlc.root, files);
  for (const file of files) {
    if (!isDiff(file)) continue;
    sourceFiles.push(file);
    relativePaths.add(path.relative(dlc.root, file).replace(/\\/g, '/'));
  }
}

const before = new Map(sourceFiles.map(file => {
  const stat = fs.statSync(file);
  return [file, `${stat.size}|${stat.mtimeMs}`];
}));

let available = 0;
let errors = 0;
let warnings = 0;
let infos = 0;
const errorSamples: string[] = [];
const warningSamples: string[] = [];
const started = Date.now();
const allTargets = [...relativePaths].sort();
const startAt = Math.max(0, Number(process.env.X4_DIFF_START || 0));
const requestedLimit = Number(process.env.X4_DIFF_LIMIT || allTargets.length);
const targets = allTargets.slice(startAt, startAt + Math.max(1, requestedLimit));
for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
  const relative = targets[targetIndex];
  const targetStarted = Date.now();
  console.log(`[${startAt + targetIndex + 1}/${allTargets.length}] ${relative}`);
  const effective = resolveEffectiveReferenceDocument(root, relative, true);
  if (effective.available) available++;
  for (const finding of effective.findings) {
    if (finding.severity === 'error') errors++;
    else if (finding.severity === 'warning') warnings++;
    else infos++;
    const sample = `${finding.severity.toUpperCase()} ${finding.source}:${relative} ${finding.code} ${finding.message}`;
    if (finding.severity === 'error' && errorSamples.length < 30) errorSamples.push(sample);
    else if (finding.severity === 'warning' && warningSamples.length < 20) warningSamples.push(sample);
  }
  const targetElapsed = Date.now() - targetStarted;
  if (targetElapsed >= 1000) console.log(`  slow target: ${targetElapsed}ms`);
}

let mutated = 0;
for (const [file, signature] of before) {
  const stat = fs.statSync(file);
  if (`${stat.size}|${stat.mtimeMs}` !== signature) mutated++;
}

console.log(`root: ${root}`);
console.log(`official DLC order: ${dlcs.map(dlc => dlc.id).join(' -> ')}`);
console.log(`official diff files: ${sourceFiles.length}; unique targets: ${relativePaths.size}; tested targets: ${targets.length}; effective targets: ${available}`);
console.log(`findings: errors=${errors} warnings=${warnings} info=${infos}; source mutations=${mutated}; elapsed=${Date.now() - started}ms`);
for (const sample of errorSamples) console.log(sample);
for (const sample of warningSamples) console.log(sample);

const pass = errors === 0 && mutated === 0 && available === targets.length;
console.log(`diff-overlay-corpus: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
