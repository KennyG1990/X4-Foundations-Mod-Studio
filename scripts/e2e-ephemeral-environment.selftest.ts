import { strict as assert } from 'node:assert';
import * as path from 'node:path';

import playwrightConfig from '../playwright.config';

type ConfigSurface = {
  webServer?: unknown;
};

type WebServerSurface = {
  env?: unknown;
};

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function requireEnv(env: Record<string, unknown>, name: string): string {
  const value = env[name];
  if (typeof value !== 'string') {
    assert.fail(`${name} must be defined in the API webServer environment`);
  }
  assert.notEqual(value, '', `${name} must not be empty in the API webServer environment`);
  return value;
}

const config = playwrightConfig as ConfigSurface;
assert.ok(Array.isArray(config.webServer), 'Playwright config must expose a webServer array');
const apiServer = config.webServer[0] as WebServerSurface | undefined;
assert.ok(apiServer && typeof apiServer === 'object', 'Playwright config must expose its API webServer entry');
assert.ok(apiServer.env && typeof apiServer.env === 'object', 'API webServer must expose its environment');

const env = apiServer.env as Record<string, unknown>;
const mutableNames = ['X4_STATE_DIR', 'X4_CONFIG_DIR', 'X4_DATA_DIR', 'X4FORGE_DISCOVERY_DIR'];
const mutablePaths = Object.fromEntries(mutableNames.map(name => [name, requireEnv(env, name)]));
const stateRoot = path.resolve(mutablePaths.X4_STATE_DIR);
const liveDataPath = path.resolve(process.cwd(), 'data');

for (const name of mutableNames) {
  const value = mutablePaths[name];
  assert.ok(path.isAbsolute(value), `${name} must be absolute`);
  assert.ok(isContained(stateRoot, path.resolve(value)), `${name} must be contained in X4_STATE_DIR`);
}

assert.notEqual(path.resolve(mutablePaths.X4_DATA_DIR), liveDataPath, 'X4_DATA_DIR must not be the live repository data path');

const referenceRoot = env.X4_REFERENCE_ROOT;
if (referenceRoot !== undefined) {
  if (typeof referenceRoot !== 'string') {
    assert.fail('X4_REFERENCE_ROOT must be a string when configured');
  }
  assert.ok(path.isAbsolute(referenceRoot), 'X4_REFERENCE_ROOT must be absolute when configured');
  assert.ok(!isContained(stateRoot, path.resolve(referenceRoot)), 'X4_REFERENCE_ROOT must remain external to X4_STATE_DIR');
}

console.log('e2e ephemeral environment containment selftest passed');
