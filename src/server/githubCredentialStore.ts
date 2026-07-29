/**
 * Server-owned GitHub credential storage.
 *
 * The browser may write, query configured status, and delete the credential; only
 * same-process GitHub proxy code can read the value. This removes the PAT/OAuth token
 * from localStorage and API responses while preserving the existing local-app trust model.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { atomicWriteJson } from '../lib/workspaceState';
import { dataPath } from '../lib/dataDir';

export const GITHUB_CREDENTIAL_MAX_CHARS = 2048;

export interface GithubCredentialStore {
  configured(): boolean;
  get(): string;
  set(token: string): void;
  clear(): void;
}

export function createGithubCredentialStore(file = dataPath('github-credential.json')): GithubCredentialStore {
  const read = (): string => {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return typeof parsed?.token === 'string' ? parsed.token : '';
    } catch {
      return '';
    }
  };

  return {
    configured: () => read().length > 0,
    get: read,
    set(token: string) {
      const value = String(token || '').trim();
      if (!value) throw new Error('GitHub credential must not be empty.');
      if (value.length > GITHUB_CREDENTIAL_MAX_CHARS) {
        throw new Error(`GitHub credential exceeds ${GITHUB_CREDENTIAL_MAX_CHARS} characters.`);
      }
      atomicWriteJson(file, { version: 1, token: value, updatedAt: new Date().toISOString() });
      try { fs.chmodSync(file, 0o600); } catch { /* Windows may not honor POSIX mode bits */ }
    },
    clear() {
      fs.rmSync(file, { force: true });
    },
  };
}

export function runGithubCredentialStoreSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-github-credential-'));
  const file = path.join(dir, 'credential.json');
  try {
    const store = createGithubCredentialStore(file);
    ok('new store reports unconfigured', store.configured() === false);
    store.set('  ghp_selftest  ');
    ok('stored credential is available only to server code', store.get() === 'ghp_selftest');
    ok('status is boolean and does not expose the value', store.configured() === true);
    const disk = fs.readFileSync(file, 'utf8');
    ok('credential file contains no browser-storage metadata', !/localStorage|x4_github_pat/.test(disk));
    let oversizedRejected = false;
    try { store.set('x'.repeat(GITHUB_CREDENTIAL_MAX_CHARS + 1)); } catch { oversizedRejected = true; }
    ok('oversized credential is rejected', oversizedRejected);
    ok('rejected update preserves previous credential', store.get() === 'ghp_selftest');
    store.clear();
    ok('disconnect deletion removes the credential', !fs.existsSync(file) && !store.configured());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
