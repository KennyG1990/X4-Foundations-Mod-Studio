import { defineConfig } from '@playwright/test';
import * as os from 'node:os';
import * as path from 'node:path';

export default defineConfig({
  testDir: '.',
  outputDir: path.join(os.tmpdir(), `x4forge-e2e-flake-policy-${process.pid}`),
  fullyParallel: false,
  workers: 1,
  timeout: 10_000,
  projects: [{ name: 'policy-fixture' }],
});
