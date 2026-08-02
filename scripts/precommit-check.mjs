import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const watchedFiles = [
  {
    label: "server.ts",
    env: "X4_GUARD_SERVER_TS",
    relPath: "server.ts",
    minLines: 5100,
    minBytes: 240000,
  },
  {
    label: "src/lib/mdSemantics.ts",
    env: "X4_GUARD_MD_SEMANTICS_TS",
    relPath: "src/lib/mdSemantics.ts",
    minLines: 530,
    minBytes: 30000,
  },
];

function resolveGuardPath(spec) {
  const override = process.env[spec.env];
  if (!override) return path.join(root, spec.relPath);
  return path.isAbsolute(override) ? override : path.join(root, override);
}

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

function runTypecheck() {
  console.log("[precommit] npm run typecheck");
  const result = spawnSync("npm run typecheck", {
    cwd: root,
    shell: true,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`typecheck failed with exit ${result.status ?? "unknown"}`);
  }
}

function checkLargeFiles() {
  if (process.env.X4_ALLOW_SIZE_GUARD_BYPASS === "1") {
    console.warn("[precommit] X4_ALLOW_SIZE_GUARD_BYPASS=1 set; skipping large-file sanity checks.");
    return;
  }

  for (const spec of watchedFiles) {
    const filePath = resolveGuardPath(spec);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${spec.label} missing at ${filePath}`);
    }
    const text = fs.readFileSync(filePath, "utf8");
    const lines = lineCount(text);
    const bytes = Buffer.byteLength(text, "utf8");
    console.log(`[precommit] ${spec.label}: ${lines} lines, ${bytes} bytes`);
    if (lines < spec.minLines || bytes < spec.minBytes) {
      throw new Error(
        `${spec.label} looks suspiciously truncated: ${lines} lines / ${bytes} bytes; expected at least ${spec.minLines} lines / ${spec.minBytes} bytes. ` +
          "If this is intentional, rerun with X4_ALLOW_SIZE_GUARD_BYPASS=1 or commit with --no-verify."
      );
    }
  }
}

// B32 (2026-07-12): recurring-mistake tripwire. A JSX expression-container comment as the
// FIRST thing inside `return (` breaks the compile — shipped twice in two days (07-11
// GuidedRail, 07-12 GlobalSearch) because a banked lesson is not a recall mechanism.
// Extensible home: add future mechanical-mistake patterns to TRIPWIRES.
const TRIPWIRES = [
  {
    name: "jsx-comment-before-root",
    pattern: /return\s*\(\s*\{\s*\/\*/,
    message: "JSX comment as the first thing inside `return (` — move it above the return; it breaks the compile (banked 07-11, recurred 07-12).",
  },
];

function walkSources(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSources(full, out);
    else if (/\.(tsx|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function checkTripwires() {
  const files = walkSources(path.join(root, "src"), []);
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const trip of TRIPWIRES) {
      if (trip.pattern.test(text)) {
        hits.push(`${path.relative(root, file)}: [${trip.name}] ${trip.message}`);
      }
    }
  }
  console.log(`[precommit] tripwires: ${TRIPWIRES.length} pattern(s) over ${files.length} source files — ${hits.length} hit(s)`);
  if (hits.length > 0) {
    throw new Error(`tripwire hit(s):\n  ${hits.join("\n  ")}`);
  }
}

// B30 (2026-07-12): canon lives in three in-repo mirrors (CLAUDE.md/AGENTS.md/GEMINI.md),
// synced by hand — the exact drift class that let an agent work a full session without
// the workflow (2026-07-09). Byte-identical or the commit blocks.
const CANON_MIRRORS = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"];

function checkMirrorDrift() {
  const contents = CANON_MIRRORS.map((name) => {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) throw new Error(`canon mirror missing: ${name}`);
    return { name, text: fs.readFileSync(p, "utf8") };
  });
  const drifted = contents.filter((c) => c.text !== contents[0].text).map((c) => c.name);
  console.log(`[precommit] canon mirrors: ${CANON_MIRRORS.join(" = ")} — ${drifted.length === 0 ? "identical" : "DRIFTED"}`);
  if (drifted.length > 0) {
    throw new Error(
      `canon mirror drift: ${drifted.join(", ")} differ(s) from ${contents[0].name}. ` +
        "Edit ONE canon and copy it to the other two — a decree without all mirrors updated is a future agent's landmine."
    );
  }
}

// B64-T2 (2026-07-19): the e2e verdict logic IS the gate — a broken verdict is a
// false-green (the worst failure mode). Guard it here so an edit to run-e2e.mjs can
// never silently break how PASS/FAIL is decided.
function checkE2eVerdict() {
  console.log("[precommit] e2e verdict selftest");
  const result = spawnSync("node scripts/run-e2e.mjs --selftest", { cwd: root, shell: true, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`e2e verdict selftest failed with exit ${result.status ?? "unknown"}`);
}

function checkProductCopy() {
  console.log("[precommit] shipped product-copy guard");
  const result = spawnSync("npm run test:product-copy", { cwd: root, shell: true, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`product-copy guard failed with exit ${result.status ?? "unknown"}`);
}

function checkDurableWriters() {
  console.log("[precommit] durable writer inventory");
  const result = spawnSync("npm run test:writers", { cwd: root, shell: true, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`durable writer inventory failed with exit ${result.status ?? "unknown"}`);
}

function checkCapabilityContracts() {
  for (const command of ["npm run test:capabilities", "npm run test:mcp-capabilities"]) {
    console.log(`[precommit] ${command}`);
    const result = spawnSync(command, { cwd: root, shell: true, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status ?? "unknown"}`);
  }
}

function checkActionReceiptCoverage() {
  console.log("[precommit] action-receipt coverage audit");
  const result = spawnSync("npm run test:action-receipt-coverage", {
    cwd: root,
    shell: true,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`action-receipt coverage audit failed with exit ${result.status ?? "unknown"}`);
  }
}

try {
  checkTripwires();
  checkMirrorDrift();
  checkE2eVerdict();
  checkProductCopy();
  checkDurableWriters();
  checkCapabilityContracts();
  checkActionReceiptCoverage();
  runTypecheck();
  checkLargeFiles();
  console.log("[precommit] OK");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[precommit] BLOCKED: ${message}`);
  process.exit(1);
}
