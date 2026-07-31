/** Atomic/rollback-safe file replacement for extension-owned workspace artifacts. */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface DurableFileEntry {
  file: string;
  data: string | Buffer;
}

interface DurableWriteHooks {
  /** Test-only seam invoked immediately before each staged file is promoted. */
  beforePromote?: (index: number, target: string) => void;
  /** Test-only seams for proving that rollback failures preserve recovery bytes. */
  beforeRollbackRemove?: (index: number, target: string) => void;
  beforeRollbackRestore?: (index: number, target: string) => void;
}

interface StagedEntry extends DurableFileEntry {
  temp: string;
  backup: string;
  existed: boolean;
  movedOld: boolean;
  promoted: boolean;
}

function siblingName(file: string, role: "tmp" | "backup"): string {
  return path.join(path.dirname(file), `.${path.basename(file)}.x4forge-${role}-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`);
}

/**
 * Replace one or more related files. Every complete replacement is staged first. If any
 * promotion fails, already-promoted files are removed and all previous files are restored.
 */
export function replaceFileSetAtomically(entries: DurableFileEntry[], hooks: DurableWriteHooks = {}): void {
  if (!entries.length) return;
  const identities = new Set<string>();
  const staged: StagedEntry[] = entries.map(entry => {
    const file = path.resolve(entry.file);
    const identity = process.platform === "win32" ? file.toLocaleLowerCase("en-US") : file;
    if (identities.has(identity)) throw new Error(`Duplicate durable file target: ${file}`);
    identities.add(identity);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const existed = fs.existsSync(file);
    if (existed && fs.lstatSync(file).isSymbolicLink()) throw new Error(`Refusing to replace a symbolic-link target: ${file}`);
    return { file, data: entry.data, temp: siblingName(file, "tmp"), backup: siblingName(file, "backup"), existed, movedOld: false, promoted: false };
  });

  let committed = false;
  try {
    for (const entry of staged) {
      fs.writeFileSync(entry.temp, entry.data, typeof entry.data === "string" ? { encoding: "utf8", flag: "wx" } : { flag: "wx" });
    }
    for (const entry of staged) {
      if (!entry.existed) continue;
      fs.renameSync(entry.file, entry.backup);
      entry.movedOld = true;
    }
    for (let index = 0; index < staged.length; index++) {
      const entry = staged[index];
      hooks.beforePromote?.(index, entry.file);
      fs.renameSync(entry.temp, entry.file);
      entry.promoted = true;
    }
    committed = true;
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (let index = staged.length - 1; index >= 0; index--) {
      const entry = staged[index];
      try {
        if (entry.promoted && fs.existsSync(entry.file)) {
          hooks.beforeRollbackRemove?.(index, entry.file);
          fs.rmSync(entry.file, { force: true });
        }
      }
      catch (rollbackError) { rollbackErrors.push(`remove ${entry.file}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`); }
      try {
        if (entry.movedOld && fs.existsSync(entry.backup)) {
          hooks.beforeRollbackRestore?.(index, entry.file);
          fs.renameSync(entry.backup, entry.file);
        }
      } catch (rollbackError) {
        rollbackErrors.push(`restore ${entry.file}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
    }
    const detail = error instanceof Error ? error.message : String(error);
    if (rollbackErrors.length) throw new Error(`Durable file replacement failed (${detail}); rollback also failed: ${rollbackErrors.join("; ")}`);
    throw error;
  } finally {
    for (const entry of staged) {
      try { if (fs.existsSync(entry.temp)) fs.rmSync(entry.temp, { force: true }); } catch { /* temp cleanup only */ }
      // Backups are disposable only after every promotion committed. On any failed
      // transaction, rollback normally consumes them; an unconsumed backup is recovery data.
      try { if (committed && fs.existsSync(entry.backup)) fs.rmSync(entry.backup, { force: true }); } catch { /* safe orphan */ }
    }
  }
}

export function atomicWriteFile(file: string, data: string | Buffer, hooks: DurableWriteHooks = {}): void {
  replaceFileSetAtomically([{ file, data }], hooks);
}

export function runDurableWriteSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass: !!pass, detail });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "x4forge-ext-durable-"));
  try {
    const first = path.join(root, "AGENTS.md");
    const second = path.join(root, "X4_NOTES.md");
    fs.writeFileSync(first, "old agents", "utf8");
    fs.writeFileSync(second, "old notes", "utf8");
    let failureReported = false;
    try {
      replaceFileSetAtomically([
        { file: first, data: "new agents" },
        { file: second, data: "new notes" },
      ], { beforePromote: index => { if (index === 1) throw new Error("injected second promotion failure"); } });
    } catch (error) { failureReported = /injected second promotion failure/.test(String(error)); }
    ok("pair_failure_reported", failureReported);
    ok("pair_failure_restores_both_previous_files", fs.readFileSync(first, "utf8") === "old agents" && fs.readFileSync(second, "utf8") === "old notes");
    ok("pair_failure_leaves_no_transaction_litter", fs.readdirSync(root).every(name => !name.includes(".x4forge-tmp-") && !name.includes(".x4forge-backup-")));

    let rollbackFailureReported = false;
    try {
      replaceFileSetAtomically([
        { file: first, data: "newer agents" },
        { file: second, data: "newer notes" },
      ], {
        beforePromote: index => { if (index === 1) throw new Error("injected promotion failure"); },
        beforeRollbackRemove: index => { if (index === 0) throw new Error("injected rollback remove failure"); },
        beforeRollbackRestore: index => { if (index === 0) throw new Error("injected rollback restore failure"); },
      });
    } catch (error) { rollbackFailureReported = /rollback also failed/.test(String(error)); }
    const preservedBackup = fs.readdirSync(root).find(name => name.startsWith(".AGENTS.md.x4forge-backup-"));
    ok("rollback_failure_is_explicit", rollbackFailureReported);
    ok("rollback_failure_preserves_known_good_backup", !!preservedBackup && fs.readFileSync(path.join(root, preservedBackup), "utf8") === "old agents");
    if (preservedBackup) fs.rmSync(path.join(root, preservedBackup), { force: true });
    fs.writeFileSync(first, "old agents", "utf8");
    fs.writeFileSync(second, "old notes", "utf8");

    replaceFileSetAtomically([{ file: first, data: "committed agents" }, { file: second, data: "committed notes" }]);
    ok("pair_success_commits_both", fs.readFileSync(first, "utf8") === "committed agents" && fs.readFileSync(second, "utf8") === "committed notes");
    atomicWriteFile(path.join(root, "PROOF.md"), "proof");
    ok("single_file_atomic_roundtrip", fs.readFileSync(path.join(root, "PROOF.md"), "utf8") === "proof");

    let duplicateRejected = false;
    try { replaceFileSetAtomically([{ file: first, data: "a" }, { file: first.toUpperCase(), data: "b" }]); } catch (error) { duplicateRejected = /Duplicate/.test(String(error)); }
    ok("duplicate_target_rejected", process.platform !== "win32" || duplicateRejected);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}

if (typeof require !== "undefined" && require.main === module) {
  const result = runDurableWriteSelftest();
  console.log(`durableWrite selftest: ${result.passed}/${result.total} allPassed=${result.allPassed}`);
  for (const check of result.checks) if (!check.pass) console.log("FAIL", check.name, check.detail || "");
  process.exit(result.pass ? 0 : 1);
}
