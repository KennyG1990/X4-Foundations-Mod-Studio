/**
 * Remove only reproducible X4 Forge build, package, and test output.
 *
 * Deliberately preserved: node_modules, config/secrets, data/, .studio-state/,
 * graphify-out/, source, documentation, and tracked release evidence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const literalTargets = [
  'dist',
  'server.js',
  '.tmp_installed_validation',
  '.playwright-mcp',
  'test-results',
  'playwright-report',
  'blob-report',
  'coverage',
  'vscode-extension/app',
  'vscode-extension/out',
];

function contained(relativePath) {
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Cleanup target escapes or equals the repository root: ${relativePath}`);
  }
  return target;
}

function filesIn(relativeDir, predicate) {
  const dir = contained(relativeDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && predicate(entry.name))
    .map(entry => path.join(relativeDir, entry.name));
}

function measure(target) {
  if (!fs.existsSync(target)) return { files: 0, bytes: 0 };
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return { files: 1, bytes: stat.size };
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      const measured = measure(child);
      files += measured.files;
      bytes += measured.bytes;
    } else {
      files += 1;
      bytes += fs.lstatSync(child).size;
    }
  }
  return { files, bytes };
}

const dynamicTargets = [
  ...filesIn('vscode-extension', name => name.endsWith('.vsix')),
  ...filesIn('vscode-extension/evidence', name => name.endsWith('.log')),
];
const targets = [...new Set([...literalTargets, ...dynamicTargets])]
  .map(relativePath => ({ relativePath, target: contained(relativePath) }))
  .filter(item => fs.existsSync(item.target));

let totalFiles = 0;
let totalBytes = 0;
const failures = [];
for (const item of targets) {
  const measured = measure(item.target);
  totalFiles += measured.files;
  totalBytes += measured.bytes;
  console.log(`${dryRun ? 'would remove' : 'removing'} ${item.relativePath} (${measured.files} files, ${measured.bytes} bytes)`);
  if (!dryRun) {
    try {
      fs.rmSync(item.target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ relativePath: item.relativePath, message });
      console.error(`failed ${item.relativePath}: ${message}`);
    }
  }
}

console.log(`${dryRun ? 'dry run' : 'cleaned'}: ${targets.length} targets, ${totalFiles} files, ${totalBytes} bytes, ${failures.length} failures`);

if (failures.length > 0) {
  console.error('Cleanup completed with failures:');
  for (const failure of failures) console.error(`- ${failure.relativePath}: ${failure.message}`);
  process.exitCode = 1;
}
