# X4 Forge original pending-issues implementation status report

Report status: VERIFIED snapshot; the implementation program is `IN_PROGRESS / PARTIAL`
Snapshot refreshed: 2026-08-02 23:28 America/New_York; GitHub readback through 2026-08-03T03:23Z
Scope: canonical pending owners `#8`, `#9`-`#22`, and `#29`-`#36`, plus duplicate mirrors `#23`-`#27`

Product boundary correction (owner, 2026-08-02, after this snapshot): X4 Forge is solely the installed
Antigravity/VS Code IDE extension. Its bundled Studio panel and managed sidecar are parts of the extension, not a
standalone web app. Forge has no end-user CLI product. Accordingly, this report's older CLI/all-surface language is
superseded: `#30`/Kimi R18 is an owner-rejected direction to disposition without implementation, and W3C/W13/W21
target the extension experience plus internal sidecar/harness proof only.

Native capability correction (owner, 2026-08-03, after this snapshot): the planned external analysis-provider,
external bridge, imported/side-by-side result, and optional-referee direction is rejected. Accepted X4 capabilities
must be implemented natively in Forge or superseded by stronger native Forge behavior. The authoritative
capability-to-owner matrix is in
`docs/plans/2026-08-02-pending-feature-implementation-program.md`; `#18` remains open until every row is natively
implemented and proven through the installed extension where applicable.

## Direct answer

The original request—to plan, implement, validate, document, and synchronize all pending X4 Forge issues, including
real Antigravity extension proof where applicable—is **not complete**.

- Live GitHub readback shows **22/23 canonical cutoff owner issues still open**. `#30` is now closed as
  **not planned** after the owner rejected an end-user CLI product; it is not counted as implemented. No canonical
  implementation issue in the cutoff pending set is fully closed as a delivered feature.
- The corrected execution order has **one fully closed implementation unit (W3A)** and one fully closed no-code
  disposition unit (K30D). W3B0 is also verified, but it is a prerequisite slice of still-open W3B unit 2, not
  completion of that unit.
- A rough effort-weighted estimate is **8-15% of the post-ledger implementation program complete (60% confidence)**.
  This estimate is deliberately broad: W7-W21 include larger engine, Effective Tree, rule/evidence, runtime, native
  capability, UI, and live-X4 surfaces than the completed receipt foundation.
- The earlier W0-W2B capability/authority foundation, 19/21 Kimi recommendations, and Release Center were already
  verified before this post-ledger implementation sequence. They are real delivered infrastructure, but they do not
  close the pending owner issues below.

## What is complete

### 1. GitHub feature-ledger prerequisite — VERIFIED

- Existing issues `#9`-`#21` received one non-destructive implementation-ledger block; `#29`-`#37` were created as
  bounded owners/projections; incomplete work stayed open and verified Release Center `#37` alone closed completed.
- Repository Markdown remains implementation/evidence authority and GitHub is the public execution projection.
- Readback, duplicate search, mirror parity, precommit, exact staging, commit, push, and remote parity passed.
- Evidence: `docs/plans/2026-08-01-github-feature-ledgers.md`; repository close commit
  `35c36cc97d0b26623dca79f3d37df63144ee6669`.

### 2. Capability and authority prerequisites — VERIFIED before this sequence

- **W0-W1 / B116:** one canonical eleven-capability contract, route/MCP governance, constrained adapters, package/
  install parity, and real rendered Antigravity close/remount proof. That earlier checkpoint also included legacy
  command-line discovery support; under the corrected product boundary it is internal/unsupported and receives no
  further product work.
- **W2A / B117:** exact deny-by-default route authority and finite read/write/deploy presets, including staged,
  installed, and rendered Antigravity proof.
- **W2B / B118:** actor-effective key/capability authority, exact MCP list/call parity, and Studio/native mint receipt
  verification, including package/install/rendered proof.
- Evidence: `docs/plans/2026-08-01-b116-installed-renderer-profile.md`,
  `docs/plans/2026-08-01-b117-exact-agent-route-authority.md`, and
  `docs/plans/2026-08-01-b118-effective-agent-authority.md`.

### 3. W3A durable action-receipt foundation — VERIFIED

- Strict `forge.action-receipt.v1` schema, deterministic operation/full-authority/content identity, exact resource
  facts, lifecycle/rollback truth, contained atomic durable storage, stable refusal, corruption/traversal negatives,
  and optional non-authoritative terminal Agent History projection.
- Evidence: 116/116 receipt checks, 73/73 history checks, 130/130 runtime oracles, 400/400 fresh-bundle routes, and
  all declared writer/capability/MCP/static/build gates.
- Boundary: no production mutation consumed a receipt.
- Evidence: `docs/plans/2026-08-02-w3-action-receipt-authority.md`; implementation commit
  `bec8247a84a2267d9429f5bef67fc7c8ab5c6411`.

### 4. W3B0 reviewed receipt-coverage authority — VERIFIED

- One reviewed fail-closed manifest covers all 82 current non-GET routes and 48 durable/host/browser/database
  surfaces, with exact effects, scope, owner, source anchor, policy, history disposition, and W3B integration batch.
- Pure resolution produces exact W3A prepare input or stable refusal without invoking a handler. Candidate generation
  is separate from exact hash-pinned promotion; precommit rejects route/effect/writer/semantic drift.
- Evidence: engine 98/98; candidate/promotion 57/57 + 23/23; manifest SHA-256
  `e7a1426590e64bca7c184f7adb0c77fbee5c00be02773624dfe92294dca279a7`; routes 400/400; runtime 130/130; all
  declared governance/static/build/precommit gates; Graphify 4,249 / 10,210 / 178.
- GitHub `#19` and `#20` read back open/`PARTIAL` with exact W3B0 plan/commit links. Report reconciliation then found
  parent `#9` still claimed W3 was unspecified; only its replaceable ledger block was refreshed to W3A/W3B0 truth and
  read back byte-exact, open/`PARTIAL`, with one marker pair and the same exact commit/plan links.
- Boundary: no production mutation emitted or consumed a receipt, and no visible extension receipt surface exists.
- Evidence: `docs/plans/2026-08-02-w3b0-action-receipt-coverage.md`; implementation commit
  `d247400bf399ef52efed081a058757eaec42c025`.

### 5. W3B1 addressed-state integration — PARTIAL / IN_PROGRESS

- The installed extension-managed sidecar now uses authoritative receipts for workspace replace and merge. Exact
  retry, changed-fact conflict, paired CAS/recovery, failed stale/body attempts, dry run, and no change are route
  proven; focused counts are 25/25 service, 23/23 transaction, 119/119 receipt/store, and 426/426 routes.
- Boundary: this is 2/5 W3B1a routes, not W3B1 completion. Workspace create, snapshot restore, bulk transform,
  W3B1a E2E, every W3B1b-d owner, and visible W3C extension proof remain open.
- Evidence: `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`; checkpoint commit/push pending at this report
  update.

### 6. Other verified work represented in the original ledger

- Kimi parent `#29`: R1-R17 and R19-R20 are verified; **19/21 implemented**. R18 is explicitly rejected by the
  product owner because Forge has no CLI product; R21 remains to be implemented in the IDE extension. The parent
  now records 20/21 final dispositions and remains open only for R21.
- Release Center `#37`: verified and closed `completed`; Nexus and Steam remain separate guided flows with installed
  Antigravity/public-byte proof. This issue is outside the pending cutoff because it was already complete.
- Root-alignment bug `#22`: current source appears implemented, but its required current-byte revalidation and issue
  close have not happened, so it remains open and is not counted complete.

## What is not complete

### Canonical owner issue status

Live connector readback confirmed every issue in this table is still open except `#30`, which is closed
`not planned` by explicit owner disposition.

| Owner | Current implementation truth | Remaining documented unit |
|---|---|---|
| `#8` | Requirement recovered; no compact graph toggle implementation | U8 after W3, 50+ cue and wide/narrow Antigravity proof |
| `#9` | Parent PARTIAL; W0-W2B/W3A/W3B0 foundations only | All remaining W3-W21 child closes and final convergence |
| `#10` | PARTIAL/disconnected rule infrastructure | W10-W11 governed packs, interpreter, transactional fixes |
| `#11` | PARTIAL/non-authoritative readers and diff simulation | W7 engine law, W8 profiles, W9 Effective Tree/provenance |
| `#12` | PARTIAL subset forensics | W14 unified structural/behavioral Forensics Center |
| `#13` | PARTIAL schemas/corpus/readiness | W8 profiles plus W15 Compatibility Lab/migration manifests |
| `#14` | PARTIAL watcher/telemetry | W12 runtime oracle and real-X4 `#35` evidence |
| `#15` | PARTIAL corpus/validators/templates | W16 completeness service and cross-file scaffolding |
| `#16` | PARTIAL XML/diff/recovery infrastructure | W17 read-only semantic comparison; W19 write path after review |
| `#17` | PARTIAL local discovery/registry | W8 profile authority; W20 opt-in upstream intelligence after review |
| `#18` | SPECIFIED native no-gap contract; no native no-gap close yet | Native implementations through mapped `#10`-`#17`/`#20` owners, then W6/W21 installed-extension no-gap proof; no external provider, external runtime, or compared results |
| `#19` | PARTIAL; W3A/W3B0 verified and W3B1 replace/merge route-green | Remaining W3B1-W3C plus W21 installed-extension native convergence/task proof |
| `#20` | PARTIAL; W3A/W3B0 verified and W3B1 replace/merge route-green | Remaining W3B1-W3B3 mutation receipts, W3C surfaces, W4 reproducibility |
| `#21` | PARTIAL/disconnected graph/corpus pieces | W10 evidence schema and W13 governed evidence graph/query surfaces |
| `#22` | Source appears implemented; durable close absent | U22 current-byte root/alias/traversal proof and issue close |
| `#29` | PARTIAL, 19 verified + R18 rejected | Close `#31` R21, then parent checklist/close |
| `#30` | CLOSED `not planned`; owner rejected the CLI product direction | No remaining implementation; preserve the no-code disposition |
| `#31` | OPEN; curated shim exists, native lifecycle absent | K31 secret-backed opt-in enable/disable/revoke and installed proof |
| `#32` | SPECIFIED/reproduced only | U32 one action owner at all breakpoints, wide/narrow rendered proof |
| `#33` | SPECIFIED/reproduced only | U33 rule-specific explanations and honest node/file/import navigation |
| `#34` | SPECIFIED/copy contradiction reproduced | U34 one guarded deploy authority, isolated and rendered proof |
| `#35` | SPECIFIED/P0; source partial | Real running-X4 LIVE cue/error/stop experience proof |
| `#36` | QUEUED behind `#29` | Research reconciliation, accepts/rejects, approved nonduplicate proposals |

### Remaining dependency-ordered implementation

1. **Finish W3:** W3B1 addressed state; W3B2 artifacts/deployments; W3B3 existing AI/network/process/GitHub effects;
   W3C installed-extension Studio/history/native-control/MCP projection with internal sidecar/harness proof; U22
   proof-and-close. No standalone web or CLI projection.
2. **Wave 2:** W4 reproducible artifact/release truth; W5 native community-capability contract; K31; U8; U32-U34.
   The old external-provider/adapter W5-W6 direction is owner-rejected. W6 is now the native no-gap
   acceptance gate and closes only after its mapped Forge engines exist.
3. **Wave 3:** W7 controlled X4 merge-law oracle; W8 immutable profiles; W9 Effective Tree; W10 rule/evidence packs;
   W11 fix interpreter; W12 runtime oracle; W13 evidence graph; U35 real-X4 experience gate.
4. **Wave 4:** W14 Forensics Center; W15 Compatibility Lab; W16 completeness/scaffolding; W17 read-only semantic
   comparison; W18 product-surface exposure.
5. **Mandatory decision stop:** source-writing rebase and opt-in upstream network behavior require explicit recorded
   authorization after Phase 2 evidence review.
6. **Wave 5:** W19 reviewed staged rebase; W20 upstream intelligence; W6 native no-gap acceptance; W21 final
   installed-extension parity across embedded Studio, native IDE controls, optional MCP, and internal sidecar/harness
   proof; then child and `#9` closes. No external analysis provider, external process/result, or comparison panel.
7. **Wave 6:** close `#29` after K31, run `#36` research, and create only separately approved nonduplicate
   follow-ups.
8. **Duplicate bookkeeping:** `#23`/`#26` mirror `#8`, `#24`/`#27` mirror `#9`, and `#25` mirrors `#22`; all five
   remain open and still need the recorded duplicate disposition after their canonical owner is sufficiently detailed.

## Antigravity and X4 validation truth

- **Already proven in Antigravity:** W0-W2B package/install parity and rendered host behavior from the earlier B116,
  B117, and B118 closes.
- **Not applicable to W3A/W3B0:** those slices add substrate and policy only; they create no visible extension control.
  A screenshot would not prove their contract.
- **Still unproven:** production receipt rendering/history links, installed extension receipt parity, K31 native MCP
  lifecycle, U8/U32/U33/U34 visible UX, W21 full extension parity, and `#35` LIVE badges. K30 terminal/CLI proof is
  removed because that product surface was rejected.
- **Running X4:** X4 was off during this sequence. Therefore `#35` and any current-session engine/experience claim
  remain incomplete by contract.

## Current checkpoint and evidence authority

- W3B0 implementation HEAD and remote main matched at
  `d247400bf399ef52efed081a058757eaec42c025` before this report delta.
- The authoritative program is `docs/plans/2026-08-02-pending-feature-implementation-program.md`.
- Verified history is `ROADMAP.md`; open work is `BACKLOG.md`; current transfer is `SESSION-HANDOFF.md`.
- Live GitHub readback source: connected GitHub issue fetches for `#8`-`#37`; `#30` is closed with reason
  `not_planned`, canonical `#8`, `#9`-`#22`, `#29`, and `#31`-`#36` remain open; duplicate `#23`-`#27` remain open;
  `#37` is closed with reason `completed`.
- Parent `#9` final readback at 2026-08-03T02:28:21Z matched the submitted W3A/W3B0 body exactly and remained open.

## Review conclusion

- **Done and evidenced:** ledger prerequisite; W0-W2B prior foundations; W3A; W3B0; Kimi 19/21; Release Center `#37`.
- **Partial:** every canonical pending issue with existing substrate but unmet acceptance behavior or proof.
- **Not started beyond specification/reconciliation:** substantial portions of `#8`, `#10`-`#18`, `#21`,
  `#31`-`#36`, and W4-W21 as detailed above. `#30` is deliberately not planned, not unfinished implementation.
- **Program final status:** `IN_PROGRESS / PARTIAL`, not `VERIFIED`.

Report validation: source plan reconciled; repository close records read; current GitHub state fetched; issue counts and
dependencies checked; no product code, issue state, game/mod, extension install, provider, credential, or release
behavior changed by producing this report.

AAR outcome: triggered by reconciliation. The status audit found parent `#9` lagging the verified W3A/W3B0 child
truth; its single replaceable block was corrected and read back without changing issue state. No product risk delta.
The report preserves the program AAR's central lesson: a successful ledger or foundation checkpoint is not delivery
of the requested implementation.
