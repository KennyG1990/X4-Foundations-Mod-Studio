import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "config", "durable-writers.json");
const sourceRoots = [path.join(root, "src"), path.join(root, "vscode-extension", "src"), path.join(root, "vscode-extension", "mcp")];
const topLevelSources = [path.join(root, "server.ts")];

const CALL_PATTERNS = {
  writeFileSync: /\b(?:fs\.)?writeFileSync\s*\(/g,
  appendFileSync: /\b(?:fs\.)?appendFileSync\s*\(/g,
  renameSync: /\b(?:fs\.)?renameSync\s*\(/g,
  copyFileSync: /\b(?:fs\.)?copyFileSync\s*\(/g,
  mkdirSync: /\b(?:fs\.)?mkdirSync\s*\(/g,
  rmSync: /\b(?:fs\.)?rmSync\s*\(/g,
  unlinkSync: /\b(?:fs\.)?unlinkSync\s*\(/g,
  chmodSync: /\b(?:fs\.)?chmodSync\s*\(/g,
  writeSync: /\b(?:fs\.)?writeSync\s*\(/g,
  createWriteStream: /\b(?:fs\.)?createWriteStream\s*\(/g,
  writeFileAsync: /\b(?:fsp|fs\.promises)\.writeFile\s*\(/g,
  appendFileAsync: /\b(?:fsp|fs\.promises)\.appendFile\s*\(/g,
  renameAsync: /\b(?:fsp|fs\.promises)\.rename\s*\(/g,
  copyFileAsync: /\b(?:fsp|fs\.promises)\.copyFile\s*\(/g,
  mkdirAsync: /\b(?:fsp|fs\.promises)\.mkdir\s*\(/g,
  rmAsync: /\b(?:fsp|fs\.promises)\.rm\s*\(/g,
  unlinkAsync: /\b(?:fsp|fs\.promises)\.unlink\s*\(/g,
  chmodAsync: /\b(?:fsp|fs\.promises)\.chmod\s*\(/g,
  mkdtempSync: /\b(?:fs\.)?mkdtempSync\s*\(/g,
  mkdtempAsync: /\b(?:fsp|fs\.promises)\.mkdtemp\s*\(/g,
  symlinkSync: /\b(?:fs\.)?symlinkSync\s*\(/g,
  linkSync: /\b(?:fs\.)?linkSync\s*\(/g,
  cpSync: /\b(?:fs\.)?cpSync\s*\(/g,
  cpAsync: /\b(?:fsp|fs\.promises)\.cp\s*\(/g,
  truncateSync: /\b(?:fs\.)?truncateSync\s*\(/g,
  truncateAsync: /\b(?:fsp|fs\.promises)\.truncate\s*\(/g,
};

const HOST_STORE_PATTERNS = {
  localStorageSet: /\blocalStorage\.setItem\s*\(/g,
  localStorageRemove: /\blocalStorage\.removeItem\s*\(/g,
  sessionStorageSet: /\bsessionStorage\.setItem\s*\(/g,
  sessionStorageRemove: /\bsessionStorage\.removeItem\s*\(/g,
  globalStateUpdate: /\b(?:context\.)?globalState\.update\s*\(/g,
  workspaceStateUpdate: /\b(?:context\.)?workspaceState\.update\s*\(/g,
  secretStore: /\b(?:context\.)?secrets\.store\s*\(/g,
  secretDelete: /\b(?:context\.)?secrets\.delete\s*\(/g,
};

const BROWSER_OUTPUT_PATTERNS = {
  showSaveFilePicker: /\.showSaveFilePicker\b/g,
  createWritable: /\.createWritable\s*\(/g,
  anchorDownload: /\.download\s*=/g,
};

const ALLOWED_CATEGORIES = new Set([
  "authoritative-atomic",
  "append-ledger",
  "verified-tree-transaction",
  "verified-release-export",
  "isolated-artifact-stage",
  "sqlite-transaction",
  "ephemeral-atomic",
  "extension-workspace-atomic",
  "retention-cleanup",
  "fixture-only",
  "mixed",
  "browser-cache",
  "browser-preference",
  "browser-session",
  "browser-file-output",
  "extension-global-state",
]);

function walk(dir, output) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "out" || entry.name === "staged-app") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (/\.(?:ts|tsx|mjs|cjs)$/.test(entry.name)) output.push(full);
  }
  return output;
}

function relative(file) { return path.relative(root, file).replace(/\\/g, "/"); }

function countMatches(text, pattern) {
  pattern.lastIndex = 0;
  let count = 0;
  while (pattern.exec(text)) count++;
  return count;
}

function fingerprintForParts(parts) {
  return crypto.createHash("sha256").update(parts.sort().join("\n")).digest("hex");
}

function canonicalizeEol(text) {
  return text.replace(/\r\n?/g, "\n");
}

function collectSourceMatches(file, text, patterns, fingerprintParts) {
  const calls = {};
  for (const [name, pattern] of Object.entries(patterns)) {
    const count = countMatches(text, pattern);
    if (count) calls[name] = count;
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      fingerprintParts.push(`${relative(file)}:${name}:${text.slice(Math.max(0, match.index - 40), Math.min(text.length, match.index + 240)).replace(/\s+/g, " ")}`);
    }
  }
  return calls;
}

function scanSourceText(file, rawText) {
  const text = canonicalizeEol(rawText);
  const fingerprintParts = [];
  const calls = collectSourceMatches(file, text, CALL_PATTERNS, fingerprintParts);
  const hostCalls = collectSourceMatches(file, text, HOST_STORE_PATTERNS, fingerprintParts);
  const browserCalls = collectSourceMatches(file, text, BROWSER_OUTPUT_PATTERNS, fingerprintParts);
  return { calls, hostCalls, browserCalls, fingerprintParts };
}

export function scanSources() {
  const files = [...topLevelSources, ...sourceRoots.flatMap(dir => walk(dir, []))];
  const writers = [];
  const hostStores = [];
  const browserOutputs = [];
  const fingerprintParts = [];
  for (const file of files) {
    const scanned = scanSourceText(file, fs.readFileSync(file, "utf8"));
    fingerprintParts.push(...scanned.fingerprintParts);
    const { calls, hostCalls, browserCalls } = scanned;
    if (Object.keys(calls).length) writers.push({ file: relative(file), calls });
    if (Object.keys(hostCalls).length) hostStores.push({ file: relative(file), calls: hostCalls });
    if (Object.keys(browserCalls).length) browserOutputs.push({ file: relative(file), calls: browserCalls });
  }
  const dbFile = path.join(root, "src", "lib", "db.ts");
  const dbText = canonicalizeEol(fs.readFileSync(dbFile, "utf8"));
  const database = {
    file: relative(dbFile),
    mutationStatements: countMatches(dbText, /\b(?:INSERT(?:\s+OR\s+IGNORE)?\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE|CREATE\s+TABLE|VACUUM)\b/gi),
    transactionCalls: countMatches(dbText, /\.transaction\s*\(/g),
    statementRuns: countMatches(dbText, /\.run\s*\(/g),
    execCalls: countMatches(dbText, /\.exec\s*\(/g),
    pragmaCalls: countMatches(dbText, /\.pragma\s*\(/g),
  };
  return {
    sourceFingerprint: fingerprintForParts(fingerprintParts),
    writers: writers.sort((a, b) => a.file.localeCompare(b.file)),
    hostStores: hostStores.sort((a, b) => a.file.localeCompare(b.file)),
    browserOutputs: browserOutputs.sort((a, b) => a.file.localeCompare(b.file)),
    database,
  };
}

function stableCalls(value) {
  return Object.fromEntries(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
}

export function auditManifest(manifest, current) {
  const errors = [];
  if (manifest?.version !== 1) errors.push("manifest version must be 1");
  if (manifest?.sourceFingerprint !== current.sourceFingerprint) errors.push(`writer source fingerprint changed; declared=${manifest?.sourceFingerprint || "missing"} actual=${current.sourceFingerprint}`);
  if (!Array.isArray(manifest?.writers)) errors.push("writers must be an array");
  const entries = Array.isArray(manifest?.writers) ? manifest.writers : [];
  const declared = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.file !== "string" || !entry.file) { errors.push("writer entry missing file"); continue; }
    if (declared.has(entry.file)) errors.push(`duplicate writer entry: ${entry.file}`);
    declared.set(entry.file, entry);
    if (!Array.isArray(entry.categories) || !entry.categories.length) errors.push(`${entry.file}: categories required`);
    else for (const category of entry.categories) if (!ALLOWED_CATEGORIES.has(category)) errors.push(`${entry.file}: unknown category ${category}`);
    if (!Array.isArray(entry.owners) || !entry.owners.length || entry.owners.some(owner => typeof owner !== "string" || !owner.trim())) errors.push(`${entry.file}: owners required`);
    if (typeof entry.rationale !== "string" || entry.rationale.trim().length < 12) errors.push(`${entry.file}: rationale required`);
    if (typeof entry.failureContract !== "string" || entry.failureContract.trim().length < 12) errors.push(`${entry.file}: failureContract required`);
    if (!entry.calls || typeof entry.calls !== "object" || !Object.keys(entry.calls).length) errors.push(`${entry.file}: calls required`);
  }

  const actual = new Map(current.writers.map(entry => [entry.file, entry]));
  for (const [file, found] of actual) {
    const entry = declared.get(file);
    if (!entry) { errors.push(`unregistered writer source: ${file} ${JSON.stringify(found.calls)}`); continue; }
    if (JSON.stringify(stableCalls(entry.calls)) !== JSON.stringify(stableCalls(found.calls))) {
      errors.push(`${file}: raw call counts changed; declared=${JSON.stringify(stableCalls(entry.calls))} actual=${JSON.stringify(stableCalls(found.calls))}`);
    }
  }
  for (const file of declared.keys()) if (!actual.has(file)) errors.push(`stale writer entry: ${file}`);

  const declaredHost = new Map();
  if (!Array.isArray(manifest?.hostStores)) errors.push("hostStores must be an array");
  for (const entry of Array.isArray(manifest?.hostStores) ? manifest.hostStores : []) {
    if (!entry || typeof entry.file !== "string" || !entry.file) { errors.push("host-store entry missing file"); continue; }
    if (declaredHost.has(entry.file)) errors.push(`duplicate host-store entry: ${entry.file}`);
    declaredHost.set(entry.file, entry);
    if (!Array.isArray(entry.categories) || !entry.categories.length) errors.push(`${entry.file}: host-store categories required`);
    else for (const category of entry.categories) if (!ALLOWED_CATEGORIES.has(category)) errors.push(`${entry.file}: unknown category ${category}`);
    if (!Array.isArray(entry.owners) || !entry.owners.length || entry.owners.some(owner => typeof owner !== "string" || !owner.trim())) errors.push(`${entry.file}: host-store owners required`);
    if (typeof entry.rationale !== "string" || entry.rationale.trim().length < 12) errors.push(`${entry.file}: host-store rationale required`);
    if (typeof entry.failureContract !== "string" || entry.failureContract.trim().length < 12) errors.push(`${entry.file}: host-store failureContract required`);
  }
  const actualHost = new Map((current.hostStores || []).map(entry => [entry.file, entry]));
  for (const [file, found] of actualHost) {
    const entry = declaredHost.get(file);
    if (!entry) { errors.push(`unregistered host-store source: ${file} ${JSON.stringify(found.calls)}`); continue; }
    if (JSON.stringify(stableCalls(entry.calls)) !== JSON.stringify(stableCalls(found.calls))) {
      errors.push(`${file}: host-store call counts changed; declared=${JSON.stringify(stableCalls(entry.calls))} actual=${JSON.stringify(stableCalls(found.calls))}`);
    }
  }
  for (const file of declaredHost.keys()) if (!actualHost.has(file)) errors.push(`stale host-store entry: ${file}`);

  const declaredBrowser = new Map();
  if (!Array.isArray(manifest?.browserOutputs)) errors.push("browserOutputs must be an array");
  for (const entry of Array.isArray(manifest?.browserOutputs) ? manifest.browserOutputs : []) {
    if (!entry || typeof entry.file !== "string" || !entry.file) { errors.push("browser-output entry missing file"); continue; }
    if (declaredBrowser.has(entry.file)) errors.push(`duplicate browser-output entry: ${entry.file}`);
    declaredBrowser.set(entry.file, entry);
    if (!Array.isArray(entry.categories) || !entry.categories.length) errors.push(`${entry.file}: browser-output categories required`);
    else for (const category of entry.categories) if (!ALLOWED_CATEGORIES.has(category)) errors.push(`${entry.file}: unknown category ${category}`);
    if (!Array.isArray(entry.owners) || !entry.owners.length || entry.owners.some(owner => typeof owner !== "string" || !owner.trim())) errors.push(`${entry.file}: browser-output owners required`);
    if (typeof entry.rationale !== "string" || entry.rationale.trim().length < 12) errors.push(`${entry.file}: browser-output rationale required`);
    if (typeof entry.failureContract !== "string" || entry.failureContract.trim().length < 12) errors.push(`${entry.file}: browser-output failureContract required`);
    if (!entry.calls || typeof entry.calls !== "object" || !Object.keys(entry.calls).length) errors.push(`${entry.file}: browser-output calls required`);
  }
  const actualBrowser = new Map((current.browserOutputs || []).map(entry => [entry.file, entry]));
  for (const [file, found] of actualBrowser) {
    const entry = declaredBrowser.get(file);
    if (!entry) { errors.push(`unregistered browser-output source: ${file} ${JSON.stringify(found.calls)}`); continue; }
    if (JSON.stringify(stableCalls(entry.calls)) !== JSON.stringify(stableCalls(found.calls))) {
      errors.push(`${file}: browser-output call counts changed; declared=${JSON.stringify(stableCalls(entry.calls))} actual=${JSON.stringify(stableCalls(found.calls))}`);
    }
  }
  for (const file of declaredBrowser.keys()) if (!actualBrowser.has(file)) errors.push(`stale browser-output entry: ${file}`);

  const db = manifest?.database;
  if (!db || db.file !== current.database.file) errors.push(`database inventory missing for ${current.database.file}`);
  else {
    if (!ALLOWED_CATEGORIES.has(db.category) || db.category !== "sqlite-transaction") errors.push("database category must be sqlite-transaction");
    if (!Array.isArray(db.owners) || !db.owners.length) errors.push("database owners required");
    if (typeof db.failureContract !== "string" || db.failureContract.trim().length < 12) errors.push("database failureContract required");
    const countKeys = ["mutationStatements", "transactionCalls", "statementRuns", "execCalls", "pragmaCalls"];
    for (const key of countKeys) {
      if (db[key] !== current.database[key]) errors.push(`database ${key} changed; declared=${db[key]} actual=${current.database[key]}`);
    }
  }
  return errors;
}

function selftest() {
  const base = {
    version: 1,
    sourceFingerprint: "fixture-fingerprint",
    writers: [{ file: "a.ts", calls: { writeFileSync: 1 }, categories: ["authoritative-atomic"], owners: ["save"], rationale: "atomic settings owner", failureContract: "failure preserves prior bytes" }],
    hostStores: [{ file: "ui.ts", calls: { localStorageSet: 1 }, categories: ["browser-preference"], owners: ["preference save"], rationale: "browser preference cache", failureContract: "failure keeps current in-memory preference" }],
    browserOutputs: [{ file: "export.ts", calls: { anchorDownload: 1 }, categories: ["browser-file-output"], owners: ["verified export"], rationale: "browser file export handoff", failureContract: "failure preserves the source artifact" }],
    database: { file: "db.ts", category: "sqlite-transaction", owners: ["cache"], failureContract: "transaction rollback", mutationStatements: 2, transactionCalls: 1, statementRuns: 3, execCalls: 1, pragmaCalls: 1 },
  };
  const current = { sourceFingerprint: "fixture-fingerprint", writers: [{ file: "a.ts", calls: { writeFileSync: 1 } }], hostStores: [{ file: "ui.ts", calls: { localStorageSet: 1 } }], browserOutputs: [{ file: "export.ts", calls: { anchorDownload: 1 } }], database: { file: "db.ts", mutationStatements: 2, transactionCalls: 1, statementRuns: 3, execCalls: 1, pragmaCalls: 1 } };
  const checks = [];
  const ok = (name, pass, detail = "") => checks.push({ name, pass: !!pass, detail });
  ok("valid_manifest", auditManifest(base, current).length === 0, auditManifest(base, current).join("; "));
  ok("unregistered_source_rejected", auditManifest(base, { ...current, writers: [...current.writers, { file: "new.ts", calls: { renameSync: 1 } }] }).some(error => error.includes("unregistered")));
  ok("call_count_delta_rejected", auditManifest(base, { ...current, writers: [{ file: "a.ts", calls: { writeFileSync: 2 } }] }).some(error => error.includes("counts changed")));
  ok("source_fingerprint_delta_rejected", auditManifest(base, { ...current, sourceFingerprint: "changed" }).some(error => error.includes("source fingerprint changed")));
  ok("unknown_category_rejected", auditManifest({ ...base, writers: [{ ...base.writers[0], categories: ["magic"] }] }, current).some(error => error.includes("unknown category")));
  ok("missing_owner_rejected", auditManifest({ ...base, writers: [{ ...base.writers[0], owners: [] }] }, current).some(error => error.includes("owners required")));
  ok("missing_failure_contract_rejected", auditManifest({ ...base, writers: [{ ...base.writers[0], failureContract: "" }] }, current).some(error => error.includes("failureContract")));
  ok("stale_entry_rejected", auditManifest({ ...base, writers: [...base.writers, { ...base.writers[0], file: "gone.ts" }] }, current).some(error => error.includes("stale writer")));
  ok("unregistered_host_store_rejected", auditManifest(base, { ...current, hostStores: [...current.hostStores, { file: "new-ui.ts", calls: { localStorageSet: 1 } }] }).some(error => error.includes("unregistered host-store")));
  ok("host_store_delta_rejected", auditManifest(base, { ...current, hostStores: [{ file: "ui.ts", calls: { localStorageSet: 2 } }] }).some(error => error.includes("host-store call counts changed")));
  ok("unregistered_browser_output_rejected", auditManifest(base, { ...current, browserOutputs: [...current.browserOutputs, { file: "new-export.ts", calls: { createWritable: 1 } }] }).some(error => error.includes("unregistered browser-output")));
  ok("browser_output_delta_rejected", auditManifest(base, { ...current, browserOutputs: [{ file: "export.ts", calls: { anchorDownload: 2 } }] }).some(error => error.includes("browser-output call counts changed")));
  ok("stale_browser_output_rejected", auditManifest({ ...base, browserOutputs: [...base.browserOutputs, { ...base.browserOutputs[0], file: "gone-export.ts" }] }, current).some(error => error.includes("stale browser-output")));
  ok("database_delta_rejected", auditManifest(base, { ...current, database: { ...current.database, transactionCalls: 2 } }).some(error => error.includes("database transactionCalls changed")));
  const fixtureFile = path.join(root, "synthetic-durable-writer-eol-fixture.ts");
  const fixtureLf = [
    "const prefix = '0123456789012345678901234567890123456789';",
    "const target = 'out';",
    "fs.writeFileSync(target, 'payload');",
    ...Array.from({ length: 24 }, (_, index) => `const suffix${index} = '${"x".repeat(32)}';`),
  ].join("\n");
  const fixtureCrlf = fixtureLf.replace(/\n/g, "\r\n");
  const fixtureCr = fixtureLf.replace(/\n/g, "\r");
  const lfFingerprint = fingerprintForParts(scanSourceText(fixtureFile, fixtureLf).fingerprintParts);
  const crlfFingerprint = fingerprintForParts(scanSourceText(fixtureFile, fixtureCrlf).fingerprintParts);
  const crFingerprint = fingerprintForParts(scanSourceText(fixtureFile, fixtureCr).fingerprintParts);
  const currentFiles = [...topLevelSources, ...sourceRoots.flatMap(dir => walk(dir, []))];
  const currentLfParts = [];
  const currentCrlfParts = [];
  for (const file of currentFiles) {
    const rawText = fs.readFileSync(file, "utf8");
    currentLfParts.push(...scanSourceText(file, rawText).fingerprintParts);
    currentCrlfParts.push(...scanSourceText(file, rawText.replace(/\r\n?|\n/g, "\r\n")).fingerprintParts);
  }
  const currentLfFingerprint = fingerprintForParts(currentLfParts);
  const currentCrlfFingerprint = fingerprintForParts(currentCrlfParts);
  ok("lf_crlf_fingerprint_invariance", lfFingerprint === crlfFingerprint && lfFingerprint === crFingerprint && currentLfFingerprint === currentCrlfFingerprint, `syntheticLf=${lfFingerprint} syntheticCrlf=${crlfFingerprint} syntheticLoneCr=${crFingerprint} currentLf=${currentLfFingerprint} currentCrlf=${currentCrlfFingerprint}`);
  return { pass: checks.every(check => check.pass), checks };
}

const args = new Set(process.argv.slice(2));
if (args.has("--print-current")) {
  console.log(JSON.stringify(scanSources(), null, 2));
} else if (args.has("--selftest")) {
  const result = selftest();
  for (const check of result.checks) console.log(`${check.pass ? "ok" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  console.log(`[durable-writer audit selftest] ${result.checks.filter(check => check.pass).length}/${result.checks.length}`);
  process.exit(result.pass ? 0 : 1);
} else {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); }
  catch (error) { console.error(`[durable-writer audit] could not read ${relative(manifestPath)}: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
  const current = scanSources();
  const errors = auditManifest(manifest, current);
  if (errors.length) {
    console.error(`[durable-writer audit] FAILED (${errors.length})`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`[durable-writer audit] PASS — ${current.writers.length} raw filesystem source(s), ${current.hostStores.length} host-store source(s), ${current.browserOutputs.length} browser-output source(s), ${current.database.mutationStatements} SQLite mutation statement(s), ${current.database.transactionCalls} transaction(s), ${current.database.statementRuns} run(s), ${current.database.execCalls} exec(s), ${current.database.pragmaCalls} pragma(s)`);
}
