import { refreshReferenceManifest, runReferenceManifestSelftest } from '../src/lib/referenceManifest';

const root = process.argv[2]?.trim();
const selftest = await runReferenceManifestSelftest();
for (const check of selftest.checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
if (!selftest.pass) process.exitCode = 1;

if (root) {
  const started = Date.now();
  const summary = await refreshReferenceManifest(root);
  console.log(JSON.stringify({ ...summary, elapsedMs: Date.now() - started }, null, 2));
}
