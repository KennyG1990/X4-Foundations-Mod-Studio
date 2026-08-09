/**
 * gen-changelog.mjs — B60 (2026-07-17): generate vscode-extension/CHANGELOG.md so the Open VSX
 * "Changes" tab is never empty and stays current with ONE small human step per release.
 *
 * Committed version bumps and their dates are derived automatically from git (the commits that
 * changed the `version` field in vscode-extension/package.json). A published version that was
 * released before its corrective bump was committed is retained by the reserved `_published`
 * date ledger in `release-notes.json`. The USER-FACING text for every version comes from the
 * curated note arrays (plain language, for modders — not engineers); a version with no curated
 * entry falls back to a cleaned-up commit subject when git provides one.
 *
 * Per release: add a `"<version>": ["plain bullet", ...]` block to release-notes.json. For the
 * exceptional publish-before-commit flow, also add `"<version>": "YYYY-MM-DD"` under the
 * reserved `_published` object. The generator validates that metadata and merges exact versions.
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
const SUPPORTED_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isSupportedVersion(version) {
  return typeof version === "string" && SUPPORTED_VERSION_RE.test(version);
}

function isCalendarDate(date) {
  if (typeof date !== "string" || !ISO_DATE_RE.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function compareVersionsDesc(a, b) {
  const aParts = a.version.split(".").map(Number);
  const bParts = b.version.split(".").map(Number);
  for (let i = 0; i < aParts.length; i++) {
    if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i];
  }
  return a.version.localeCompare(b.version);
}

function sortReleases(releases) {
  return releases
    .filter((release) => release && isSupportedVersion(release.version))
    .sort(compareVersionsDesc);
}

/** Turn a conventional-commit subject into something a non-engineer can read. */
export function humanizeSubject(subject) {
  let s = String(subject || "").trim();
  s = s.replace(/^[a-z]+(\([^)]*\))?:\s*/i, ""); // drop "feat(scope): " / "chore: "
  s = s.replace(/\bB\d+[a-z]?\b/g, "").replace(/\s{2,}/g, " ").trim(); // drop internal ticket codes
  s = s.replace(/^[—–-]\s*/, "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Maintenance and fixes.";
}

/** Pure: supported releases → deterministic newest-first CHANGELOG.md markdown. Testable in isolation. */
export function buildChangelog(releases) {
  const lines = [
    "# What's New in X4 Forge Studio",
    "",
    "The latest changes, newest first. (This page is generated automatically — see",
    "`release-notes.json` to edit the wording.)",
    "",
  ];
  for (const r of sortReleases(releases)) {
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

/** Read release-notes.json; missing or malformed JSON leaves an empty document for fallback behavior. */
function readReleaseNotesDocument() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "release-notes.json"), "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** Curated note arrays are content authority; underscore-prefixed metadata is not note content. */
function loadCuratedNotes(raw = readReleaseNotesDocument()) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith("_") && Array.isArray(v)) out[k] = v;
  return out;
}

/**
 * Validate and read the exceptional publish-before-commit date ledger.
 * Invalid metadata is rejected instead of silently acquiring an invented date.
 */
export function parsePublishedLedger(raw) {
  if (raw?._published === undefined) return [];
  const ledger = raw._published;
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    throw new Error("_published must be an object mapping x.y.z versions to YYYY-MM-DD dates");
  }
  return Object.entries(ledger).map(([version, date]) => {
    if (!isSupportedVersion(version)) {
      throw new Error(`_published version is not supported x.y.z semver: ${version}`);
    }
    if (!isCalendarDate(date)) {
      throw new Error(`_published date for ${version} is not a valid YYYY-MM-DD calendar date: ${date}`);
    }
    return { version, date, source: "published" };
  });
}

function loadPublishedReleases(raw = readReleaseNotesDocument()) {
  return parsePublishedLedger(raw);
}

/** Merge exact versions from git, the published ledger, and the working tree. */
export function mergeReleases(gitReleases, publishedReleases, workingReleases, notes = {}) {
  const byVersion = new Map();
  for (const release of [...gitReleases, ...publishedReleases, ...workingReleases]) {
    if (!release || !isSupportedVersion(release.version)) continue;
    const previous = byVersion.get(release.version);
    const published = release.source === "published" || previous?.source === "published";
    const date = release.source === "published"
      ? release.date
      : previous?.source === "published"
        ? previous.date
        : (release.date ?? previous?.date);
    const changes = Array.isArray(notes[release.version]) && notes[release.version].length
      ? notes[release.version]
      : (Array.isArray(release.changes) && release.changes.length
        ? release.changes
        : (previous?.changes || []));
    byVersion.set(release.version, {
      ...previous,
      ...release,
      version: release.version,
      date,
      changes,
      source: published ? "published" : (release.source || previous?.source),
    });
  }
  return sortReleases([...byVersion.values()]).map(({ source, ...release }) => release);
}

/** Read committed git bump points. Each entry: {version, date, sha, changes[]}. */
function readCommittedReleases(notes) {
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
  releases.reverse(); // newest-first for the working-tree range calculation
  return releases;
}

/** Read the current package version when it is ahead of the newest committed bump. */
function readWorkingTreeRelease(notes, newestCommitted) {
  try {
    const workingVersion = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, "package.json"), "utf8")).version;
    if (!workingVersion || (newestCommitted && workingVersion === newestCommitted.version)) return null;
    const since = newestCommitted ? `${newestCommitted.sha}..HEAD` : "HEAD";
    const subjects = git(`log --no-merges --format=%s ${since}`).split("\n").filter(Boolean);
    const filtered = subjects.filter((s) => !isReleaseNoise(s));
    const curated = notes[workingVersion];
    return {
      version: workingVersion,
      date: new Date().toISOString().slice(0, 10),
      sha: "(uncommitted)",
      source: "working",
      changes: curated && curated.length
        ? curated
        : ((filtered.length ? filtered : subjects).map(humanizeSubject).filter(Boolean).length
          ? (filtered.length ? filtered : subjects).map(humanizeSubject)
          : ["Maintenance and fixes."]),
    };
  } catch { /* no working package.json / git edge — committed history is enough */ }
  return null;
}

/** Read git, published-ledger, and working-tree releases into one deterministic list. */
function readReleasesFromGit() {
  const document = readReleaseNotesDocument();
  const notes = loadCuratedNotes(document);
  const committed = readCommittedReleases(notes);
  const working = readWorkingTreeRelease(notes, committed[0]);
  const published = loadPublishedReleases(document);
  return mergeReleases(committed, published, working ? [working] : [], notes);
}

/* ------------------------------------------------------------------ *
 * Selftest — pure builder and release-source merge fixtures (no git needed).
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

  const committedVersion = "0.0.66";
  const intermediateVersion = committedVersion.replace(/\d+$/, (n) => String(Number(n) + 1));
  const workingVersion = intermediateVersion.replace(/\d+$/, (n) => String(Number(n) + 1));
  const publishedDate = "2026-08-09";
  const fixtureNotes = {
    [workingVersion]: ["Corrective working-tree release."],
    [intermediateVersion]: ["Published before its corrective commit."],
    [committedVersion]: ["Committed release."],
  };
  const fixtureGit = [{
    version: committedVersion,
    date: "2026-08-08",
    sha: "sha-66",
    changes: ["Git fallback that curated notes replace."],
  }];
  const fixturePublished = parsePublishedLedger({
    _published: { [intermediateVersion]: publishedDate },
  });
  const fixtureWorking = [{
    version: workingVersion,
    date: publishedDate,
    sha: "(uncommitted)",
    source: "working",
    changes: fixtureNotes[workingVersion],
  }];
  const merged = mergeReleases(fixtureGit, fixturePublished, fixtureWorking, fixtureNotes);
  const mergedMd = buildChangelog(merged);
  const headings = mergedMd.split("\n").filter((line) => line.startsWith("## "));
  ok(
    "published_intermediate_inserted_with_exact_date_and_notes",
    mergedMd.includes(`## ${intermediateVersion} — ${publishedDate}`)
      && mergedMd.includes(`- ${fixtureNotes[intermediateVersion][0]}`),
  );

  const laterGit = [
    ...fixtureGit,
    {
      version: intermediateVersion,
      date: "2026-08-10",
      sha: "sha-67",
      changes: ["Later git fallback must not replace curated content."],
    },
  ];
  const dedupedMd = buildChangelog(mergeReleases(laterGit, fixturePublished, fixtureWorking, fixtureNotes));
  const intermediateHeadings = dedupedMd
    .split("\n")
    .filter((line) => line === `## ${intermediateVersion} — ${publishedDate}`);
  ok(
    "published_intermediate_deduplicates_later_git_bump",
    intermediateHeadings.length === 1
      && !dedupedMd.includes("Later git fallback must not replace curated content."),
  );

  let firstMalformedError = "";
  let secondMalformedError = "";
  for (const setError of [
    (error) => { firstMalformedError = error.message; },
    (error) => { secondMalformedError = error.message; },
  ]) {
    try {
      parsePublishedLedger({ _published: { [intermediateVersion]: "2026-02-30" } });
    } catch (error) {
      setError(error);
    }
  }
  ok(
    "malformed_published_ledger_rejected_deterministically",
    firstMalformedError === secondMalformedError
      && firstMalformedError === `_published date for ${intermediateVersion} is not a valid YYYY-MM-DD calendar date: 2026-02-30`,
  );

  ok(
    "reserved_metadata_is_not_a_changelog_version",
    !mergedMd.includes("##_published") && !loadCuratedNotes({ _published: fixturePublished })._published,
  );
  ok(
    "supported_semver_order",
    headings.slice(0, 3).map((line) => line.split(" ")[1]).join(" > ")
      === `${workingVersion} > ${intermediateVersion} > ${committedVersion}`,
  );

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
