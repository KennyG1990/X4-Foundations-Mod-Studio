# X4 Forge Studio OpenVSX marketplace story refresh

Status: VERIFIED
Lane: FULL
Date: 2026-08-08

## PLAN

- **Bounded unit:** replace the packaged extension README's long AI-defence-led page with a concise,
  outcome-led explanation of X4 Forge; improve the existing manifest-generated command, setting, launcher,
  description, and discovery metadata; cut the next stable OpenVSX release; then prove the public page and
  installed Antigravity package show those exact validated bytes.
- **User outcome:** a mod author should understand within the opening screen what Forge is, why it is useful,
  how it differs from a normal editor, and how to start. The page should sound ambitious and professional
  without presenting planned work as shipped.
- **Authoritative references:** the current packaged `vscode-extension/README.md` and `package.json`; verified
  shipped behavior in root `README.md`, `ROADMAP.md`, capability map, release notes, and installed-release
  records; `vscode-extension/PUBLISHING.md`; OpenVSX package/API readback.
- **Assumptions:** OpenVSX Details is sourced from packaged `README.md`. Its Features tab is generated from
  real VS Code manifest contributions and cannot be replaced with a free-form marketing page. Improving it
  therefore means improving truthful existing contributions, not registering fake commands or views.
- **In scope:** marketplace README; extension short description, keywords/categories when justified, existing
  command titles, launcher copy, existing setting descriptions, UTF-8 copy repair, stable version metadata,
  curated/generated changelog, package/release evidence, installed screenshots, release records, one GitHub
  owner issue, exact commit/push/public parity.
- **Out of scope:** Forge runtime behavior, new commands/views/settings, fake manifest contributions, a website,
  Microsoft Marketplace, pre-release publishing, standalone app/CLI, game or mod writes, W3B1b implementation,
  new screenshots made from unverified mock UI, or claims about documented but unfinished capabilities.
- **Risks and authorization boundaries:** publishing permanently occupies a version and is explicitly requested.
  The OpenVSX token remains memory-only and must never be printed or persisted. A marketing overclaim is a
  product defect. Any failed package, installed-host, public-parity, secret, stable-channel, scope, or precommit
  gate stops publication or close.
- **Rollback/checkpoint:** before upload, discard the candidate and retain public/installed `0.0.65`. After a
  successful upload, never retry that version; verify exact public disposition and recover only through a newer
  version if necessary. Preserve every pre-existing dirty path and the parked W3B1b plans.
- **Evidence locations:** this record; `vscode-extension/evidence/0.0.66-marketplace-release-validation.md`;
  installed Details/Features screenshots under `vscode-extension/evidence/2026-08-08-marketplace-refresh/`;
  public manifest/README/API readback; `ROADMAP.md`; `SESSION-HANDOFF.md`; GitHub owner issue `#38`.

## RECONCILED DESIGN

Three viable approaches were compared:

1. **README-only:** fastest and materially improves Details, but leaves the Features tab's real metadata terse.
2. **README plus truthful manifest polish (selected):** improves the persuasive narrative and the generated
   Features sections while preserving the actual contribution surface.
3. **Screenshot-heavy campaign:** visually richer, but adds asset curation, privacy review, package weight, and a
   faster-staling representation of an actively changing Studio. It is not required for this bounded release.

The selected page structure is: outcome-led hero; concise value proposition; shipped capability pillars;
deterministic trust boundary; one end-to-end workflow; beginner/existing-mod/power-user fit; three-step start;
honest requirements, local-first privacy, limitations, and support. AI remains optional and subordinate to Forge's
deterministic engine instead of dominating the opening argument.

## ACCEPTANCE CONTRACT

1. The first screen answers: what Forge is, what pain it removes, and the first action to take. The copy is
   exciting but concrete, scannable, and substantially shorter than the current page's repeated AI argument.
2. Every feature claim maps to currently verified native extension behavior. No inspected third-party product,
   future program item, unsupported editor promise, or invented capability appears.
3. The README accurately covers visual and native authoring, X4-grounded completion/reference data, whole-project
   deterministic validation, diff-patch safety, conflict analysis, packaging/deployment/recovery, and optional AI.
   It states that X4 remains the runtime authority and that schema-valid does not mean behavior-perfect.
4. OpenVSX's generated Features tab remains structurally honest: only existing commands, settings, view container,
   view, and activation behavior are described. User-facing labels become clearer without changing command IDs or
   runtime semantics. Manifest text contains no mojibake.
5. Package/lock/release-note/generated changelog versions equal `0.0.66`. Curated notes comprehensively describe
   the marketplace and metadata improvement in modder-facing language; generated changelog is deterministic and
   ends in exactly one LF.
6. JSON parse, UTF-8/mojibake scan, link/heading checks, changed-copy claim audit, extension typecheck/build, root
   build, fresh stage, package inspection, stable-channel check, secret scan, and staged-app probe all pass.
7. The exact candidate is installed in Antigravity and the real rendered Details and Features tabs are inspected.
   Screenshots show readable copy/metadata and installed version `0.0.66`; the installed package matches candidate
   critical bytes and does not alter standing Forge config or user mod/game data.
8. The exact stable VSIX is uploaded once. OpenVSX latest/exact metadata, public README, public manifest, and public
   download all report the new version/content; public and local archive size/SHA-256 match.
9. Required close records, capability-map delta decision, AAR, owner issue, exact staging, precommit, commit/push,
   and `HEAD == origin/main == remote main` all close without staging unrelated dirty files.

## REQUIRED VALIDATION AND NEGATIVE PATHS

- **Copy/metadata:** parse package JSON; reject mojibake, placeholder text, unsupported claims, broken relative
  anchors, duplicated AI argument, fake contributions, or an overlong/opaque short description.
- **Build/package:** release-note generator selftest and generation; root production build; fresh staged app;
  extension build; stable VSIX package; package inspector; staged sidecar probe; archive content/hash readback.
- **Installed UI:** real Antigravity extension page, Details and Features tabs, installed version and package hashes.
- **Release:** exact-version preflight `404`; load `OVSX_PAT` without output; publish once; verify metadata, README,
  manifest, download, and hash parity. Never use `--pre-release`.
- **Containment:** no game/mod/config writes; no secret in package or logs; no mutation of public `0.0.65`; no
  unrelated dirty path staged or changed; parked W3 records remain separate.
- **Close:** full `npm run precommit:check`; exact diff review; GitHub marker/state readback; commit/push/remote parity.

## BASELINE

- Repository `HEAD`, `origin/main`, and fetched remote main are `7729a9dea5a49ad76019ca1ca92abdc7b6c0f294`.
- Public and installed stable extension is `0.0.65`; OpenVSX reports more than ten thousand downloads. Its short
  description contains literal mojibake and the packaged README devotes most of its opening to defending AI.
- The manifest already contributes ten commands, eight settings, one view container, one view, and two activation
  events. The Features tab is therefore not actually empty; it is a technical inventory whose labels currently do
  little to communicate user outcomes.
- Twenty-three pre-existing dirty/untracked paths plus two parked W3 plan paths are recorded in the session handoff
  and remain outside this task.
- GitHub issue `#38` is the single public owner for this bounded marketplace refresh.

## RECONCILE

- Reuse the existing packaged README, manifest contributions, changelog generator, stage/build/inspect/probe
  scripts, OpenVSX namespace, and installed-validation procedure. Do not add a parallel marketing or release system.
- Root `README.md` provides a current verified capability inventory, but is too broad for a marketplace landing
  page. The extension README should distill it, not duplicate it wholesale.
- Existing command IDs and runtime behavior remain stable. Only their user-facing labels/copy may change.
- Capability-map delta is expected to be none: this release communicates existing capability more accurately and
  changes no Forge execution contract.

## IMPLEMENT

- Native Luna changed only the five bounded package-copy surfaces: the extension README, package and
  lock metadata, curated release notes, and generated changelog. The README now leads with the native
  authoring-to-evidence workflow, shipped capability pillars, deterministic trust boundary, audience
  fit, three-step start, and honest requirements/privacy/limits. AI is optional and subordinate.
- Existing manifest contributions were renamed in place for clarity. Counts, IDs, activation events,
  engines, dependencies, and runtime semantics are unchanged; no fake Features contribution was added.
- Stable metadata and release notes were advanced to `0.0.66`; all three manifest mojibake sequences
  were repaired. Six deterministic changelog bullets describe the marketplace and metadata changes.
- The exact built candidate was installed in Antigravity, uploaded once to OpenVSX, and publicly
  read back. Rendered evidence and machine-readable results are in
  `vscode-extension/evidence/0.0.66-marketplace-release-validation.md`.

## VALIDATE

- Copy/claim checks, JSON/UTF-8/version/contribution parity, link checks, typecheck, extension build,
  root production build, fresh staging, stable packaging, package inspection, secret scan, and staged
  app probe pass. The candidate is 18,113,327 bytes at SHA-256
  `6B3A5C032976046EE2A44BB5F67BC205A61368146E77E8621116EC4B70526763`.
- The first full `npm run precommit:check` passed `[precommit] OK`, exit `0`, in 535.9 seconds. The
  final synchronized run after durable close records also passed `[precommit] OK`, exit `0`, in
  496.2 seconds; config/test-result hashes stayed unchanged and ephemeral listener count is zero.
- Antigravity reports installed `0.0.66`; the rendered Details, Features/Commands, and Changelog pages
  show the new content. Candidate and installed README/changelog/controller/server hashes match. The
  managed sidecar runs the installed server on port `57339`; standing `config.json` is byte-identical.
- OpenVSX exact-version preflight was `404`; upload returned success exactly once. After bounded
  propagation, exact/latest metadata report downloadable `0.0.66`; public archive size/hash, README
  hash, manifest description/version/contribution counts, and rendered Overview/Changes all match.
- Negative paths pass: no pre-release, duplicate upload, fake contribution, secret, game/mod/config
  write, candidate drift, unrelated staging, or listener leak. The initial propagation `404` was not
  misreported as public success and did not trigger republish.

## REVIEW

- **Done and evidenced:** the opening answers what Forge is, why it matters, and how to start; shipped
  authoring, reference intelligence, validation, patch/conflict/release, recovery, and optional-AI
  boundaries are represented; the real Features inventory is clearer; installed and public surfaces
  render correctly; the comprehensive changelog is public; archive parity is exact.
- **Deliberately unchanged:** command IDs, setting keys/defaults, activation behavior, runtime code,
  contribution counts, extension architecture, mod/game data, and the parked W3B1b work.
- **External/deferred:** OpenVSX's unverified `x4forge` namespace banner is owned by `#39`.
  VSCE's ambiguous historical bare-number autolinks are owned by `#40`. Antigravity's old one-line
  gallery summary remains a host cache even though installed/public manifests and rendered Details
  are current; it is not package-byte authority.
- Fresh-eyes review found no unsupported product claim or prohibited source-product reference. The
  copy is longer in total because it now describes the real product breadth, but its first screen is
  shorter, outcome-led, and scannable instead of spending the opening on an AI defence.

## CLOSE

- Status: VERIFIED. The exact intended paths are ready for the release commit; the commit containing
  this close record is pushed and its hash/readback is recorded on GitHub owner `#38`.
- Capability-map delta: none.
- Suggested commit title: `release: sharpen the X4 Forge marketplace story and publish 0.0.66`.

## AAR

- **Triggers:** several ad hoc PowerShell probes needed correction; the package-inspector alias needed
  its positional VSIX argument; the native implementation worker was interrupted after its bounded
  edits; browser setup needed a longer timeout; OpenVSX propagation exceeded the first poll; package
  review discovered historical autolinking and public review exposed namespace trust friction.
- **Sustain:** validate claims against shipped owners; install the exact candidate before upload;
  compare candidate, installed, and public hashes; upload one immutable version only once; inspect
  real rendered Details, Features, Changelog, Overview, and Changes surfaces.
- **Improve work/approach:** use result arrays for PowerShell loop output, invoke artifact inspectors
  directly with their required argument, and distinguish accepted upload from publicly readable state.
- **Improve tools:** `#40` owns a package-level guard for ambiguous changelog links; `#39` owns
  OpenVSX namespace verification. Treat Antigravity gallery header text as cache, not package truth.
- **Highest-risk observed weakness:** the OpenVSX publisher warning reduces public trust despite exact
  archive identity; `#39` is the bounded risk-reduction unit.
- Project-specific lesson is recorded in the X4 Forge AAR ledger; no global AAR delta.
