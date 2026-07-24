#!/usr/bin/env node
/**
 * Release guard: removed product identities must not re-enter shipped Forge surfaces.
 * The checker itself is intentionally outside every scanned root.
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const requested = process.argv.slice(2);
const roots = (requested.length ? requested : [
  '.env.example',
  'server.ts',
  'src',
  'vscode-extension/src',
  'vscode-extension/mcp',
  'vscode-extension/package.json',
  'vscode-extension/release-notes.json',
]).map(value => path.resolve(repoRoot, value));

const banned = [
  /neural[ _-]?link/i,
  /x4_neural_link/i,
  /validateModFolder/,
  /Validate Mod Folder/i,
  /x4forge\.modFolder/,
];
const textExtensions = new Set(['.cjs', '.css', '.html', '.js', '.json', '.mjs', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml', '']);
const ignoredNames = new Set(['node_modules', '.git', 'evidence']);
const findings = [];

function visit(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredNames.has(entry.name)) continue;
      visit(path.join(target, entry.name));
    }
    return;
  }
  if (!stat.isFile() || !textExtensions.has(path.extname(target).toLowerCase())) return;
  const text = fs.readFileSync(target, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (banned.some(pattern => pattern.test(line))) {
      findings.push(`${path.relative(repoRoot, target)}:${index + 1}: ${line.trim()}`);
    }
  });
}

roots.forEach(visit);
if (findings.length) {
  console.error(`PRODUCT COPY CHECK FAILED (${findings.length} banned mention(s))`);
  findings.forEach(finding => console.error(finding));
  process.exit(1);
}
console.log(`PRODUCT COPY CHECK PASS (${roots.length} shipped root(s), 0 banned mentions)`);
