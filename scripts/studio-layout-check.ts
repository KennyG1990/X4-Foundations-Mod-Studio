import { runStudioLayoutSelftest } from '../src/lib/studioLayout';

const result = runStudioLayoutSelftest();
for (const check of result.checks) {
  console.log(`[studio-layout] ${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}
if (!result.ok) process.exitCode = 1;

