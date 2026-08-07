/**
 * gen-changelog.mjs — B60 (2026-07-17): generate vscode-extension/CHANGELOG.md so the Open VSX
 * "Changes" tab is never empty and stays current with ONE small human step per release.
 *
 * The version list, dates, and ordering are derived automatically from git (the commits that
 * changed the `version` field in vscode-extension/package.json). The USER-FACING text for each
 * version comes from the curated `release-notes.json` (plain language, for modders — not
 * engineers). A version with no curated entry falls back to a cleaned-up commit subject.
 *
 * Per release: add a `"<version>": ["plain bullet", ...]` block to release-notes.json. That's it.
 *
 * Publish-before-commit (the intended flow): bump package.json, run this, publish — the bumped
 * working-tree version is emitted as the top entry, exactly matching what ships. Then commit.
 *
 * Run: `npm run changelog`. The pure `buildChangelog()` is unit-tested via `--selftest`.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // .../vscode-extension
const REPO_ROOT = path.dirname(EXT_ROOT); // worktree root (git pathspecs are relative to here)
const PKG_REL = "vscode-extension/package.json";

/** Turn a conventional-commit subject into something a non-engineer can read. */
export function humanizeSubject(subject) {
  let s = String(subject || "").trim();
  s = s.replace(/^[a-z]+(\([^)]*\))?:\s*/i, ""); // drop "feat(scope): " / "chore: "
  s = s.replace(/\bB\d+[a-z]?\b/g, "").replace(/\s{2,}/g, " ").trim(); // drop internal ticket codes
  s = s.replace(/^[—–-]\s*/, "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Maintenance and fixes.";
}

/** Pure: releases (newest-first) → CHANGELOG.md markdown. Testable in isolation. */
export function buildChangelog(releases) {
  const lines = [
    "# What's New in X4 Forge Studio",
    "",
    "The latest changes, newest first. (This page is generated automatically — see",
    "`release-notes.json` to edit the wording.)",
    "",
  ];
  for (const r of releases) {
    lines.push(`## ${r.version}${r.date ? ` — ${r.date}` : ""}`);
    lines.push("");
    const changes = r.changes && r.changes.length ? r.changes : ["(no recorded changes)"];
    for (const c of changes) lines.push(`- ${c}`);
    lines.push("");
  }
  return `${lines.join("\n").replace(/\r\n?/g, "\n").replace(/\n+$/g, "")}\n`;
}

/** Subjects that are pure version-bump bookkeeping — the version header already conveys them. */
function isReleaseNoise(subject) {
  return /^chore\(release\)/i.test(subject) || /^\s*bump (the )?extension/i.test(subject);
}

function git(args) {
  return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** Version string in package.json AT a given commit (null if unreadable/absent). */
function versionAt(sha) {
  try {
    const txt = git(`show ${sha}:${PKG_REL}`);
    return JSON.parse(txt).version || null;
  } catch {
    return null;
  }
}

/** Curated plain-English notes: { "<version>": ["bullet", ...] }. Missing file = all fallback. */
function loadCuratedNotes() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "release-notes.json"), "utf8"));
    const out = {};
    for (const [k, v] of Object.entries(raw)) if (!k.startsWith("_") && Array.isArray(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** Read git → releases[] (newest-first). Each entry: {version, date, sha, changes[]}. */
function readReleasesFromGit() {
  const notes = loadCuratedNotes();
  // Commits that touched the manifest, OLDEST first, with date.
  const raw = git(`log --reverse --format=%H%x1f%cs -- ${PKG_REL}`);
  const touches = raw
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [sha, date] = l.split("\x1f");
      return { sha, date };
    });

  // Bump points: where the version value changed vs the previous touch.
  const bumps = [];
  let prevVersion = null;
  for (const t of touches) {
    const v = versionAt(t.sha);
    if (v && v !== prevVersion) {
      bumps.push({ ...t, version: v });
      prevVersion = v;
    }
  }

  // For each bump, collect the subjects in (prevBump, thisBump] — what shipped in this version.
  const releases = [];
  for (let i = 0; i < bumps.length; i++) {
    const cur = bumps[i];
    const prev = bumps[i - 1];
    const range = prev ? `${prev.sha}..${cur.sha}` : cur.sha;
    let subjects = [];
    try {
      subjects = git(`log --no-merges --format=%s ${range}`).split("\n").filter(Boolean);
    } catch {
      subjects = [];
    }
    // Curated plain-English notes win; else humanize the real commit subjects (never empty).
    const curated = notes[cur.version];
    const filtered = subjects.filter((s) => !isReleaseNoise(s));
    const changes = curated && curated.length
      ? curated
      : (filtered.length ? filtered : subjects).map(humanizeSubject);
    releases.push({ version: cur.version, date: cur.date, sha: cur.sha, changes });
  }
  releases.reverse(); // newest-first for the changelog

  // Publish-time exactness: if the WORKING TREE version is ahead of the newest committed bump
  // (i.e. run right after `npm version`/manual bump, before the bump is committed), emit a
  // correct top entry for it from newestCommittedBump..HEAD — the exact feature HEAD being
  // packaged. This is what keeps future releases from lagging a cycle behind their features.
  try {
    const workingVersion = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "package.json"), "utf8")).version;
    const newestCommitted = releases[0];
    if (workingVersion && (!newestCommitted || workingVersion !== newestCommitted.version)) {
      const since = newestCommitted ? `${newestCommitted.sha}..HEAD` : "HEAD";
      const subjects = git(`log --no-merges --format=%s ${since}`).split("\n").filter(Boolean);
      const filtered = subjects.filter((s) => !isReleaseNoise(s));
      const curated = notes[workingVersion];
      releases.unshift({
        version: workingVersion,
        date: new Date().toISOString().slice(0, 10),
        sha: "(uncommitted)",
        changes: curated && curated.length
          ? curated
          : ((filtered.length ? filtered : subjects).map(humanizeSubject).filter(Boolean).length
            ? (filtered.length ? filtered : subjects).map(humanizeSubject)
            : ["Maintenance and fixes."]),
      });
    }
  } catch { /* no working package.json / git edge — committed history is enough */ }
  return releases;
}

/* ------------------------------------------------------------------ *
 * Selftest — pure builder against a fixture (no git needed).
 * ------------------------------------------------------------------ */
function selftest() {
  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, pass, detail });

  const md = buildChangelog([
    { version: "0.0.16", date: "2026-07-17", changes: ["New mod starters and a conflict checker."] },
    { version: "0.0.15", date: "2026-07-17", changes: ["Live error checking while you type."] },
  ]);
  ok("has_title", md.startsWith("# What's New"));
  ok("newest_first", md.indexOf("## 0.0.16") < md.indexOf("## 0.0.15"));
  ok("version_header_with_date", md.includes("## 0.0.16 — 2026-07-17"));
  ok("plain_line_present", md.includes("- New mod starters and a conflict checker."));
  const mdBytes = Buffer.from(md, "utf8");
  ok("terminal_byte_is_lf", mdBytes[mdBytes.length - 1] === 0x0a);
  ok("no_terminal_double_lf", mdBytes[mdBytes.length - 2] !== 0x0a);
  ok("no_carriage_returns", !md.includes("\r"));
  ok("deterministic_output", buildChangelog([
    { version: "0.0.16", date: "2026-07-17", changes: ["New mod starters and a conflict checker."] },
    { version: "0.0.15", date: "2026-07-17", changes: ["Live error checking while you type."] },
  ]) === md);

  // humanizer: strips conventional-commit prefix + internal Bxx codes, capitalizes
  ok("humanize_strips_prefix", humanizeSubject("feat(community): B58 patch — new starters") === "Patch — new starters");
  ok("humanize_chore", humanizeSubject("chore(release): bump extension to v0.0.16") === "Bump extension to v0.0.16");
  ok("humanize_empty_fallback", humanizeSubject("feat(x): B99") === "Maintenance and fixes.");
  ok("release_noise_helper", isReleaseNoise("chore(release): Bump extension to v0.0.16") && !isReleaseNoise("feat(x): y"));

  const passed = checks.filter((c) => c.pass).length;
  const allPassed = passed === checks.length;
  console.log(`gen-changelog selftest: ${passed}/${checks.length} allPassed=${allPassed}`);
  for (const c of checks) if (!c.pass) console.log("FAIL", c.name, c.detail || "");
  process.exit(allPassed ? 0 : 1);
}

// --- entry ---
if (process.argv.includes("--selftest")) {
  selftest();
} else {
  const releases = readReleasesFromGit();
  const md = buildChangelog(releases);
  const out = path.join(EXT_ROOT, "CHANGELOG.md");
  fs.writeFileSync(out, md, "utf8");
  console.log(`[gen-changelog] wrote ${path.relative(REPO_ROOT, out)} — ${releases.length} version(s), newest ${releases[0]?.version || "?"}`);
}
