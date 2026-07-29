# Community XML-patch follow-ups — candidate isolation, transform bundles, and data-only readiness

Task: B104 + B105 + B106
Lane: FULL
Status: **VERIFIED — implemented, installed-host validated, and published as Open VSX 0.0.56 on 2026-07-29**

## PLAN

### Bounded unit

Repair three user-reported XML patch workflow defects against the shipped 0.0.55 code and the original
B99/B100 contracts. Implement and validate the fixes as independently reviewable batches. Publishing is
not part of this unit unless separately authorized.

### Authoritative references

- User screenshots and quoted XML from 2026-07-29.
- `src/components/XMLPatchSystem.tsx`, `BulkTransformPanel.tsx`.
- `src/lib/bulkCorpusTransform.ts`, `modCompiler.ts`.
- `src/server/bulkTransformRoutes.ts`.
- B99 plan: `docs/plans/2026-07-26-bulk-corpus-transform.md`.
- B100 patch-only regression: `tests/e2e/native-authoring.spec.ts`.
- X4's own `<diff>` grammar and configured unpacked corpus remain the implementation authority.

### In scope

1. Prevent a target file from ever displaying or synthesizing against another file's edited candidate.
2. Extend one bulk plan to contain multiple numeric selector/operation rows and apply them atomically.
3. Stop an inert legacy MD file from forcing a placebo cue into a valid data-only extension.

### Out of scope

- Hard-coded shield, hull, ship, ware, or faction rules.
- Arbitrary scripting/eval inside transform expressions.
- Changes to X4's diff grammar.
- Automatic deletion of source-owned MD files.
- Publishing or changing the installed extension without separate authorization.

### Risks and authorization boundaries

- A mismatched base/candidate pair can generate a patch against the wrong document; B104 is P0.
- Multi-operation plans can partially rebalance a file unless match and apply semantics are atomic.
- Silently deleting an empty MD file could destroy intentional source; B106 may only offer explicit cleanup.
- Vanilla corpus and installed game directories remain read-only. Tests use isolated fixtures.

### Rollback/checkpoint

Implementation must remain one workspace mutation after one checkpoint. A failed preview, stale plan, or
validation finding produces zero workspace changes. This specification is documentation-only and can be
reverted by removing its backlog/plan entries.

## BASELINE

- Revision: `f3ef800`, public/installed X4 Forge Studio 0.0.55.
- Existing unrelated changes preserved: two modified 0.0.35 screenshots, untracked `KNOWN-BUGS.md`, and
  `.tmp-b102-validation/`.
- The previous release commit and `origin/main` matched before triage.

## RECONCILE

### B104 — edited candidate belongs to the wrong target

**Status: REPRODUCED, 99% confidence.** The screenshot shows an asset macro in **Base XML** and a complete
`<wares>` document in **Edited XML**. The source explains the exact transition:

1. `targetFile` changes while `baseFileContent` still contains target A.
2. The seeding effect sees `dtSeededFor !== targetFile`, copies target A into `dtEdited`, and records target B
   as seeded.
3. The fetch effect clears the base and loads target B.
4. When target B arrives, `dtSeededFor === targetFile`, so the correct target B content is not copied into the
   candidate.

No current test changes the target while the Diff-to-Patch pane is mounted. The existing test covers only the
default `libraries/wares.xml` path, so it could not catch this cross-target state leak.

### B105 — one bulk plan cannot change several related values

**Status: REPRODUCED CONTRACT LIMITATION, 100% confidence.** `BulkTransformRule` contains one `selector`, one
`operation`, and one `operand`; the UI owns one corresponding row. The original B99 scope deliberately shipped
that v1 contract. Changing recharge `max/rate/delay/disruptionstability` and hull `max` therefore requires five
separate previews/applies and cannot be proven atomic as one rebalance.

This is a requested extension, not a failure to meet B99's written v1 acceptance.

### B106 — placebo cue workaround for a data-only mod

**Status: REPRODUCED EDGE CASE, 100% confidence in current behavior; 85% confidence it explains the user's
exact session.** A current focused production-function probe returned:

- patch-only workspace with no MD file: zero readiness findings;
- the same valid patch plus an empty legacy `mdOriginal`: package-blocking error, “Compiled MD package has no
  cue nodes,” even though the message itself states the extension can load.

B100 already fixed new libraries/assets/XML-patch-only projects: they emit no fake MD and need no cue. The
remaining edge is an imported or pre-fix project that still contains an inert MD document. The screenshot names
`md/x4_cheaper_energy.xml`, which supports that explanation. An older installed Forge version is the remaining
15% alternative.

No ADR conflicts were found. Existing corpus, diff simulation, guarded workspace mutation, and patch-only domain
detection are reused; no parallel compiler or validator is warranted.

Capability-map delta: B99 has a cross-target candidate isolation defect and only single-operation bulk rules;
B100's clean patch-only fix remains true but does not cover legacy empty MD files.

## DOCUMENTED IMPLEMENTATION CONTRACT

### B104 — target-keyed Diff-to-Patch session

- Separate picker query text from the committed/resolved target.
- Couple `{targetFile, sourceSignature, baseXml, editedXml, dirty}` in one target-keyed state object instead of
  independently mutable strings.
- Cancel the previous fetch and reject any response whose request token/target no longer matches.
- Seed edited XML only from the successful response for that same target.
- Clear or disable synthesis while the next target is unresolved.
- Never silently discard a dirty candidate: preserve a per-target draft or require an explicit discard action.
- Include the target and source signature in the synthesis request/response check.

### B105 — generic multi-operation transform bundle

Replace the one-rule shape with a bounded bundle:

```ts
type BulkTransformBundle = {
  pathPrefix: string;
  operations: Array<{
    id: string;
    selector: string;
    operation: 'multiply' | 'add' | 'set' | 'round' | 'min' | 'max' | 'clamp';
    operand: number | [number, number];
    rounding?: 'none' | 'round' | 'floor' | 'ceil';
    roundingIncrement?: number;
  }>;
  maxFiles: number;
};
```

- Bound operation count (proposed maximum 16), reject duplicate selectors, and retain no-eval numeric policy.
- A file with zero matching operations is skipped. A file matching only part of the required bundle, or any
  ambiguous/nonnumeric operation, is an error; it must never receive a partial rebalance.
- Simulate the combined diff for every matched file, not five independent green fragments.
- Plan/rule hashes, conflicts, provenance, rerun ownership, preview, ledger summary, and stale-plan checks include
  every operation.
- Apply all generated blocks in one checkpointed workspace mutation.
- UI uses add/duplicate/remove operation rows and an expandable file-by-field preview. No shield-specific labels.

### B106 — honest data-only readiness

- Keep new patch-only behavior: no generated MD and no cue requirement.
- Reclassify an inert MD document with no `<cue>` or `<library>` as a warning, not a package-blocking error.
- Add a separate error only when the entire extension has no effective authored output in any domain.
- Diagnostic copy must state: data-only mods do not need a cue; remove/exclude the unused MD file instead of
  adding a placebo cue. A real MD mod should add a cue/library.
- Offer explicit removal/exclusion only when the exact inert file is identified; never silently delete
  source-owned bytes.

## ACCEPTANCE CONTRACT

### B104

1. Load target A, edit it, then select target B: both pane labels and both XML roots belong to B before synthesis
   is enabled; A never appears under B.
2. Delay A's HTTP response until after B resolves: the late A response is ignored.
3. Type a partial target path and then choose a suggestion: no intermediate response becomes committed content.
4. Switching away from a dirty candidate preserves its draft or requires explicit discard.
5. Synthesis refuses a target/source-signature mismatch with zero workspace mutation.

### B105

1. A shield fixture changes five selectors in one plan: recharge `@max`, `@rate`, `@delay`,
   `@disruptionstability`, and hull `@max`.
2. Preview shows all five old/new values per matched file and simulates one combined diff.
3. Apply emits five replace operations in the one mirrored target diff file and makes one undo checkpoint.
4. Reapplying the identical bundle is idempotent and produces no duplicate blocks.
5. Missing one required selector, duplicate selectors, ambiguity, nonnumeric input, conflict, stale corpus/workspace,
   cap breach, or one failed simulation blocks the entire bundle with zero writes.

### B106

1. Pure XML-patch/wares/jobs/assets projects compile with no MD file and no cue finding.
2. Valid data-only output plus an inert legacy MD file receives a remediation warning, not an error.
3. A genuinely empty extension remains blocked by a specific empty-extension error.
4. A real MD document with malformed XML or invalid structure remains an error; the exception does not weaken XSD
   or well-formedness validation.
5. UI copy explicitly says not to add a placebo cue to a data-only mod.

## REQUIRED VALIDATION FOR IMPLEMENTATION

1. Static/typecheck and focused pure selftests.
2. Component/e2e race test with delayed out-of-order effective-file responses.
3. Bulk engine and route tests for five-operation atomic preview/apply, conflicts, stale plans, and idempotence.
4. Patch-only/legacy-empty-MD/empty-extension/real-MD severity matrix through `validatePackageReadiness`, compile,
   and full project validation.
5. Full isolated `npm run test:e2e`, judged by its structured verdict; verify ephemeral ports stop.
6. Production build, staged extension probe, local VSIX install, and real Antigravity visual interaction.
7. Negative proof that vanilla/game roots remain byte-identical and no preview writes workspace state.

## IMPLEMENTATION — 2026-07-29

- **B104:** replaced independently mutable base/candidate state with a target-keyed session, abort/request-token
  guards, per-target dirty drafts, source-signature checks at synthesis and adoption, and server-side canonical
  revision verification. Added a delayed out-of-order response regression test.
- **B105:** retained the legacy one-rule API shape while adding a generic 1–16 operation bundle. Every file is
  evaluated as a unit, partial matches are errors, one combined X4 diff is simulated, and one guarded mutation
  owns all emitted field patches. The UI now adds/duplicates/removes operation rows and expands per-file changes.
- **B106:** split real modeled MD from inert imported MD. Real modeled MD without an entry point remains an error;
  inert legacy MD in a data-only mod is a remediation warning; a genuinely empty extension has a separate error.

## VALIDATION — VERIFIED RELEASE

- `npm run typecheck` -> PASS after one fixture correction (missing required `x`/`y` test-node fields).
- `npm run lint` -> PASS, 0 errors; 540 pre-existing warning-class findings remain.
- `npm run test:schema-intelligence` -> PASS, 143/143 including 15/15 bulk-transform checks.
- `npm run build` -> PASS, production client and `dist/server.cjs` generated.
- `npm run precommit:check` -> PASS, including verdict selftest 10/10, product-copy guard, typecheck, and truncation guards.
- `git diff --check` -> PASS aside from line-ending notices.
- `npm run test:e2e` -> **PASS 34/34** by the structured JSON verdict. New rendered cases prove the five-field
  bundle, atomic apply/undo, data-only severity matrix, and target-switch/out-of-order response isolation.
- The first full run failed 3/34 after its isolated Vite process disappeared. Trace review showed aborted requests,
  not a product assertion. A disposable stack probe stayed healthy for 12 seconds, the exact first test passed under
  direct Playwright and the official wrapper, then the one justified full rerun passed 34/34. This is a triggered
  AAR, not hidden flake evidence.
- Ephemeral ports 3100/3101 and diagnostic ports 3110/3111 were absent after teardown; live ports 3000/3001 were
  absent before and after. No live workspace, game, deployed mod, or unpacked corpus was mutated.
- Production build, extension staging/build, and staged sidecar probe -> PASS 6/6. Local VSIX 0.0.56 packaged at
  17,794,689 bytes, SHA-256 `AF431B2E577BBEB865CAC45943BC4A29EEF97B5B07B5B46299102D376A8E5D11`.
- Antigravity CLI install -> PASS for `x4forge.x4-forge-studio@0.0.56`; the existing host was reloaded and the saved
  Forge canvas reopened. The first automatic webview restoration showed Antigravity's generic editor-recovery
  screen; `Try Again` restored the same canvas and the Studio then rendered normally.
- Real installed-host UI -> PASS: XML Patching opened in the existing Studio; switching the target updated the patch
  target rather than retaining `libraries/wares.xml`; Bulk Transform visibly accepted a second operation and showed
  `2/16` without applying to the workspace.
- Installed sidecar -> PASS: XPath synthesis selftest green; bulk corpus transform 15/15; artifact pipeline proves
  patch-only has no MD readiness error, emits no synthetic MD file, retains its library diff, inert legacy MD is
  warning-only, real modeled MD without an entry point remains an error, and a genuinely empty extension remains
  blocked.
- Open VSX publish -> PASS. Version-specific metadata exposed 0.0.56 after the normal propagation delay. The public
  17,794,689-byte VSIX is byte-identical to the installed/tested artifact at SHA-256
  `AF431B2E577BBEB865CAC45943BC4A29EEF97B5B07B5B46299102D376A8E5D11`.

## REVIEW

- User report 1 -> done and root-caused as B104.
- User report 2 -> done and scoped as B105 without hard-coded shield rules.
- Placebo cue report -> done; B100 remains valid, legacy empty-MD severity gap scoped as B106.
- Fresh-eyes diff review found one cosmetic regression (the Apply busy icon lost `animate-spin`); it was restored
  before the final build/package. No contract or safety defect remained in the reviewed diff.

## CLOSE

- Status: **VERIFIED** — all declared implementation, negative-path, isolated runtime, packaged-product,
  installed-host, visible UI, and public-distribution gates passed.
- Remaining work: none for B104/B105/B106. The transient Antigravity webview recovery and e2e process-loss
  observability are recorded as tool/host follow-ups, not release blockers.
- Suggested commit title: `fix(xml-patching): isolate target candidates, bundle atomic transforms, and remove placebo-cue pressure`.

## AAR

- Triggered: reconciliation split one old “cue requirement” report into a closed B100 path and a still-live legacy
  MD severity edge; one inline TypeScript probe failed from PowerShell quoting before the literal-script retry.
- Sustain: screenshots plus source-state ordering produced an exact root cause; the production readiness function
  separated current behavior from historical assumptions.
- Improve work/approach: distinguish “fixed for new projects” from “migrated for old projects” in acceptance.
- Improve tools: use literal script arguments for focused TypeScript probes on Windows; do not embed XML quoting in
  a one-line `-e` string.
- Highest-risk evidenced weakness: B104 can pair different documents and still enable synthesis. Fix target identity
  before expanding bulk transforms.
- Project lesson banked in the X4 Forge AAR ledger.
- Implementation trigger: the first new B106 test fixture omitted mandatory graph coordinates and failed typecheck;
  adding `x`/`y` fixed the fixture without changing product behavior. Sustain strict typecheck after every batch.
- Runtime trigger: the first full e2e lost its isolated Vite process after the first canvas boot, reproducing the
  historical harness failure class. Trace inspection, an independently managed two-process/browser probe, and the
  exact first test separated harness/process loss from product behavior before the full rerun. The final structured
  verdict is green 34/34; keep process-loss diagnosis ahead of retries.
- Installed/release triggers: Antigravity's first post-reload webview restoration required its ordinary `Try Again`
  recovery action before the saved canvas rendered. Two PowerShell evidence probes also used an invalid direct pipe
  after a `foreach`/`try` block; the stable pattern is to assign the block result before piping. Open VSX accepted the
  upload immediately but exposed the version-specific endpoint only after propagation; no duplicate publish was
  attempted. Public hash parity proves users receive the same artifact that passed the installed-host checks.
