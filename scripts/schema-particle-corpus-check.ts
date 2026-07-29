/** Real-corpus cry-wolf gate for ordered XSD particles (read-only). */
import fs from 'node:fs';
import path from 'node:path';
import { discoverSchemaRegistry, getDomainIndex } from '../src/lib/schemaRegistry';
import { validateXmlAgainstSchema } from '../src/lib/xsdValidate';

const root = path.resolve(process.argv[2] || process.env.X4_REFERENCE_ROOT || './data/x4-unpacked');
if (!fs.existsSync(root)) throw new Error(`Corpus root not found: ${root}`);

const registry = discoverSchemaRegistry(path.join(root, 'libraries'));
const indexes = new Map(['md', 'aiscripts'].map(domain => {
  const info = registry.domains.find(candidate => candidate.domain === domain);
  if (!info) throw new Error(`Schema domain not found: ${domain}`);
  return [domain, getDomainIndex(info)] as const;
}));

const files: Array<{ domain: 'md' | 'aiscripts'; file: string }> = [];
const walk = (dir: string, domain: 'md' | 'aiscripts') => {
  if (!fs.existsSync(dir)) return;
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) files.push({ domain, file: full });
    }
  }
};

walk(path.join(root, 'md'), 'md');
walk(path.join(root, 'aiscripts'), 'aiscripts');
const extensions = path.join(root, 'extensions');
if (fs.existsSync(extensions)) {
  for (const entry of fs.readdirSync(extensions, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^ego_dlc_/i.test(entry.name)) continue;
    walk(path.join(extensions, entry.name, 'md'), 'md');
    walk(path.join(extensions, entry.name, 'aiscripts'), 'aiscripts');
  }
}

const particleCodes = new Set(['XSD_CHILD_ORDER', 'XSD_CHILD_CARDINALITY']);
const failures: Array<{ file: string; line?: number; code?: string; message: string }> = [];
const timings: Array<{ file: string; bytes: number; ms: number }> = [];
const limit = Math.max(0, Number(process.env.X4_PARTICLE_LIMIT || 0));
files.sort((a, b) => fs.statSync(b.file).size - fs.statSync(a.file).size || a.file.localeCompare(b.file));
const selected = limit ? files.slice(0, limit) : files;
const sweepStarted = performance.now();
for (const [index, item] of selected.entries()) {
  const content = fs.readFileSync(item.file, 'utf8');
  const started = performance.now();
  const findings = validateXmlAgainstSchema(content, indexes.get(item.domain)!, {
    domain: item.domain,
    filePath: path.relative(root, item.file).replace(/\\/g, '/'),
    reportUnknownElements: true,
    strictStructure: true,
  });
  timings.push({ file: path.relative(root, item.file).replace(/\\/g, '/'), bytes: Buffer.byteLength(content), ms: performance.now() - started });
  for (const finding of findings) {
    if (finding.code && particleCodes.has(finding.code)) failures.push({
      file: finding.filePath || item.file,
      line: finding.line,
      code: finding.code,
      message: finding.message,
    });
  }
  if ((index + 1) % 25 === 0) console.error(`[schema-particle-corpus] ${index + 1}/${selected.length}`);
}

console.log(JSON.stringify({
  root,
  discoveredFiles: files.length,
  checkedFiles: selected.length,
  elapsedMs: Math.round(performance.now() - sweepStarted),
  particleFailures: failures.length,
  slowest: timings.sort((a, b) => b.ms - a.ms).slice(0, 12),
  sample: failures.slice(0, 50),
}, null, 2));
process.exit(failures.length ? 1 : 0);
