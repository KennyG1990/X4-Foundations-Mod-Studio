/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B93.1 — instance discovery.
 *
 * The sidecar's port changes every launch (observed: 3000, 62148, 57950, 49208, 60855) and nothing
 * on disk told anyone what it was. External agents were reduced to scanning up to 40 ports at the
 * start of every session to find the tool they were about to use. The token file made it worse: it
 * is written to `process.cwd()`, which for the PACKAGED sidecar is `app/` inside the extension
 * install directory — unfindable in practice, and it never carried the port anyway.
 *
 * This writes one well-known record per running instance:
 *
 *   ~/.x4forge/instances/<pid>.json   { port, token, pid, startedAt, cwd, mode }
 *   ~/.x4forge/latest.json            a copy of the most recently started instance
 *
 * Deliberate choices:
 *  - PER-USER HOME, never a mod/game/workspace directory. This file carries a credential; writing
 *    it anywhere near shipped content is how secrets end up in a mod archive (and the B70 class of
 *    litter-in-the-game-folder incident).
 *  - 0600 where the platform honours it.
 *  - Records whose process is dead are pruned on startup, so a crashed instance can never send a
 *    caller to a port that is now something else entirely.
 *  - `latest.json` is a convenience for the common single-instance case; `instances/` remains the
 *    truth when the standalone app and a sidecar run at once.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

export interface InstanceRecord {
  port: number;
  token: string;
  pid: number;
  startedAt: string;
  cwd: string;
  /** 'standalone' = the dev/prod app; 'sidecar' = spawned by the IDE extension. */
  mode: string;
  version?: string;
}

export function discoveryRoot(): string {
  // X4FORGE_DISCOVERY_DIR exists so tests never touch the real user profile.
  const override = process.env.X4FORGE_DISCOVERY_DIR?.trim();
  return override ? path.resolve(override) : path.join(os.homedir(), '.x4forge');
}

export function instancesDir(): string { return path.join(discoveryRoot(), 'instances'); }
export function latestPath(): string { return path.join(discoveryRoot(), 'latest.json'); }
export function instancePath(pid: number): string { return path.join(instancesDir(), `${pid}.json`); }

/** True when a pid is still running. Used to drop records left by a crashed instance. */
export function pidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    // EPERM means the process exists but belongs to someone else — still alive.
    return error?.code === 'EPERM';
  }
}

function writeRestricted(target: string, contents: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, { encoding: 'utf8', mode: 0o600 });
  // writeFileSync's mode only applies at creation; enforce it on an existing file too.
  try { fs.chmodSync(target, 0o600); } catch { /* platform may not support it */ }
}

/**
 * Remove records whose process is gone, so discovery cannot point at a dead port.
 *
 * `latest.json` is pruned too. A reader that trusts it blindly — which is the whole point of a
 * well-known path — would otherwise be sent to a port that is now closed or, worse, owned by
 * something else entirely. Observed for real: a test harness on 8972 published here, exited, and
 * left a record advertising a dead port.
 */
export function pruneDeadInstances(): number {
  let pruned = 0;
  try {
    const dir = instancesDir();
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json')) continue;
        const pid = Number(name.replace(/\.json$/, ''));
        if (pidAlive(pid)) continue;
        try { fs.rmSync(path.join(dir, name), { force: true }); pruned++; } catch { /* best effort */ }
      }
    }
    const latestFile = latestPath();
    if (fs.existsSync(latestFile)) {
      let stale = true;
      try { stale = !pidAlive(JSON.parse(fs.readFileSync(latestFile, 'utf8'))?.pid); } catch { stale = true; }
      if (stale) {
        const survivors = listInstances();
        if (survivors.length) writeRestricted(latestFile, JSON.stringify(survivors[0], null, 2));
        else { fs.rmSync(latestFile, { force: true }); pruned++; }
      }
    }
  } catch { /* discovery must never break startup */ }
  return pruned;
}

/** List live instances, newest first. */
export function listInstances(): InstanceRecord[] {
  const out: InstanceRecord[] = [];
  try {
    const dir = instancesDir();
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as InstanceRecord;
        if (rec && typeof rec.port === 'number' && pidAlive(rec.pid)) out.push(rec);
      } catch { /* a torn record must not hide the others */ }
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

/**
 * Publish this instance. Returns the paths written so startup can log them — an agent that can
 * read the log then knows where to look without being told.
 */
export function publishInstance(record: InstanceRecord): { instanceFile: string; latestFile: string } | null {
  try {
    pruneDeadInstances();
    const body = JSON.stringify(record, null, 2);
    const instanceFile = instancePath(record.pid);
    writeRestricted(instanceFile, body);
    const latestFile = latestPath();
    writeRestricted(latestFile, body);
    return { instanceFile, latestFile };
  } catch {
    // Discovery is a convenience: never let it stop the server from starting.
    return null;
  }
}

/** Remove this instance's record on shutdown. `latest.json` is repointed if it named us. */
export function unpublishInstance(pid: number): void {
  try {
    fs.rmSync(instancePath(pid), { force: true });
    const remaining = listInstances();
    if (!remaining.length) {
      fs.rmSync(latestPath(), { force: true });
      return;
    }
    let latest: InstanceRecord | null = null;
    try { latest = JSON.parse(fs.readFileSync(latestPath(), 'utf8')); } catch { latest = null; }
    if (!latest || latest.pid === pid) writeRestricted(latestPath(), JSON.stringify(remaining[0], null, 2));
  } catch { /* shutdown must not throw */ }
}

export function runInstanceDiscoverySelftest(): { pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass: !!pass, detail });
  const saved = process.env.X4FORGE_DISCOVERY_DIR;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-discovery-selftest-'));
  try {
    process.env.X4FORGE_DISCOVERY_DIR = scratch;

    const mine: InstanceRecord = {
      port: 54321, token: 'selftest-token', pid: process.pid,
      startedAt: new Date(0).toISOString(), cwd: scratch, mode: 'standalone',
    };
    const written = publishInstance(mine);
    ok('publishes an instance record', !!written && fs.existsSync(written.instanceFile));
    ok('mirrors it to latest.json', fs.existsSync(latestPath()));

    const latest = JSON.parse(fs.readFileSync(latestPath(), 'utf8'));
    ok('latest carries the port', latest.port === 54321, String(latest.port));
    ok('latest carries the token', latest.token === 'selftest-token');
    ok('discovery lives OUTSIDE any mod/game directory', !/extensions|X4 Foundations/i.test(discoveryRoot()), discoveryRoot());

    if (process.platform !== 'win32') {
      const mode = fs.statSync(latestPath()).mode & 0o777;
      ok('record is owner-only (0600)', mode === 0o600, mode.toString(8));
    } else {
      ok('record is owner-only (0600) [posix-only assertion]', true, 'skipped on win32');
    }

    // A stale latest.json is the dangerous case: callers trust the well-known path blindly.
    writeRestricted(latestPath(), JSON.stringify({ ...mine, pid: 999999998, port: 8972 }, null, 2));
    pruneDeadInstances();
    const afterStale = JSON.parse(fs.readFileSync(latestPath(), 'utf8'));
    ok('a stale latest.json is repointed at a live instance', afterStale.pid === process.pid, `pid=${afterStale.pid}`);

    // A record from a dead process must never be served to a caller.
    const deadPid = 999999999;
    writeRestricted(instancePath(deadPid), JSON.stringify({ ...mine, pid: deadPid, port: 9 }, null, 2));
    ok('a dead instance is not listed', !listInstances().some(r => r.pid === deadPid));
    const pruned = pruneDeadInstances();
    ok('a dead instance is pruned from disk', pruned >= 1 && !fs.existsSync(instancePath(deadPid)), `pruned=${pruned}`);
    ok('the live instance survives pruning', fs.existsSync(instancePath(process.pid)));

    // A torn record must not hide healthy ones.
    writeRestricted(path.join(instancesDir(), '123456789.json'), '{"port":');
    ok('a torn record does not break listing', listInstances().some(r => r.pid === process.pid));

    unpublishInstance(process.pid);
    ok('shutdown removes the record', !fs.existsSync(instancePath(process.pid)));
    ok('shutdown clears latest when nothing is left', !fs.existsSync(latestPath()));
  } finally {
    if (saved === undefined) delete process.env.X4FORGE_DISCOVERY_DIR; else process.env.X4FORGE_DISCOVERY_DIR = saved;
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  return { pass: checks.every(c => c.pass), checks };
}
