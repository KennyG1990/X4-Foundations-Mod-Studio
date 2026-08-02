# GitHub Feature Ledger Projection

Status: VERIFIED — GitHub projection and repository documentation validated 2026-08-02
Lane: FULL

## PLAN

- Bounded unit: project the already-reconciled Kimi and capability-convergence programs plus B111–B114 and the
  post-Kimi research queue into non-duplicate GitHub Issues.
- Assumptions: repository plans remain implementation/evidence authority; GitHub is the visible execution ledger.
- In scope: preserve/update `#9`–`#21`; create one Kimi parent, only its two unfinished children, B111–B114 issues,
  one queued research issue, and an evidence-backed completed record for the already-verified Nexus/Steam Release
  Center; persist the tracker-policy reversal in the three agent mirrors.
- Out of scope: code, tests, releases, issue closure for incomplete work, game/mod/config writes, provider/network
  execution beyond the authorized GitHub issue writes, and Notion/Drive mutation.
- Risks: duplicate issues, overwriting original requirements, falsely closing partial work, tracker/repository drift.
- Rollback: original `#9`–`#21` bodies were captured before mutation and can be restored with the same API; newly
  created issues can be closed as superseded if reconciliation later finds a duplicate.
- Acceptance: one owner record per scoped feature/program; original issue bodies byte-preserved as prefixes; one
  replaceable ledger marker per `#9`–`#21`; new issues resolve with correct parent/status/boundary; every incomplete
  issue remains open; only evidence-backed `#37` is closed as completed; repository mirrors remain byte-identical;
  GitHub readback passes.
- Negative path: exact-topic searches must find no pre-existing Kimi, R18/R21, B111–B114 or post-Kimi issue before
  creation; idempotent ledger markers must occur exactly once after update.
- Evidence: GitHub issues `#9`–`#21` and `#29`–`#37`; connector readback results retained in the task transcript.

## BASELINE

- Revision: `4e23d2cd9283fee64941384d5e35a1b0d4bc4356 == origin/main == remote main`.
- Existing changes: unrelated `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`, deleted Discord/data files,
  issue templates and historical screenshots were present and are excluded from this task.
- GitHub: `#9`–`#21` were open with no Forge implementation-ledger marker. Duplicate searches for all proposed new
  titles/topics returned zero results. Historical Discord mirror duplicates are separate from this scope.
- Close-time recheck on 2026-08-02: local `main`, `HEAD`, `origin/main` and live `ls-remote` still resolved to
  `4e23d2cd9283fee64941384d5e35a1b0d4bc4356`; no file was staged. SHA-256 baselines were captured for every unrelated
  dirty path so the post-commit audit can prove they were preserved.
- Machine state: Ken reported Antigravity open, X4 stopped and the machine quiet. This task required no computer
  control, rendered-host interaction, game interaction or E2E run.

## RECONCILE

- Reused the Kimi reconciled matrix, B115 dependency plan, ROADMAP closes, current handoff and live issue bodies.
- Drive and Notion are mirrors of the same convergence package, not separate feature programs.
- Kimi's nineteen verified recommendations remain checklist entries rather than nineteen retrospective issues; only
  R18 and R21 receive executable child issues.
- Capability-map delta: no product-capability delta. This task changes tracking policy and feature visibility only.
- Plan change: Ken's GitHub-ledger instruction supersedes the written MD-only/no-third-party-tracker rule. Repository
  Markdown remains authoritative, while GitHub becomes the synchronized public execution projection.
- Close reconciliation: the prior handoff's task-owned list omitted `ROADMAP.md` even though the explicit acceptance
  contract requires an append-only verified close and an exact eight-file commit. The close restores `ROADMAP.md` to
  the owned set; no unrelated backlog or evidence path is added.

## IMPLEMENT

- Created Kimi parent `#29`, R18 `#30`, R21 `#31`, B111 `#32`, B112 `#33`, B113 `#34`, B114 `#35`, queued
  post-Kimi research `#36`, and verified/closed Nexus+Steam Release Center `#37`.
- Appended replaceable `forge-implementation-ledger` blocks to existing initiative `#9` and children `#10`–`#21`.
- Preserved every original issue body and kept all incomplete issues open.
- Updated the three agent-policy mirrors and the two authoritative program plans with the GitHub projection contract.

## VALIDATE

- GitHub issue readback through the connected integration: PASS.
  - `#9`–`#21` are open. Every body contains exactly one start marker and one end marker, the original requirement
    content remains as a non-empty prefix, and the replaceable block is the trailing body section.
  - `#29` is open with exactly 21 recommendation rows: 19 checked, with only R18 and R21 unchecked. It links `#30`,
    `#31` and related `#32`–`#37` work.
  - `#30`–`#36` are open. `#37` alone is closed with `state_reason=completed` and cites the B109/Open VSX 0.0.59
    evidence boundary.
  - Exact-topic duplicate searches found one expected owner for each new scope. The R18 search also returned parent
    `#29` because its checklist links child `#30`; it did not reveal a second feature owner. No repair write was needed.
- Mirror equality: PASS. `AGENTS.md`, `CLAUDE.md` and `GEMINI.md` are each 35,301 bytes with SHA-256
  `5AB37EBDC5AD8C6D44DF17AFCDFA5AEF33461650BAAFBC6311FBBA5974B3D02D`.
- Initial `git diff --check` over the task-owned paths: PASS, exit 0. Git emitted only informational configured
  LF-to-CRLF working-copy warnings.
- Required gate on 2026-08-02: `npm run precommit:check` PASS, exit 0, 130.3 seconds. It covered 26/26 verdict
  selftests, product-copy guard, 14/14 writer-audit selftests and live inventory, durable-write 8/8, eleven
  capabilities / 291 literal routes / one registrar / ten MCP aliases, MCP read=5/write=9/deploy=10, typecheck,
  canon-mirror parity, size guards and tripwires.
- Negative checks: no duplicate owner; no duplicate/missing marker; no incomplete issue closed; no GitHub repair;
  no unrelated staged path. Final exact-file staging and remote parity remain operational gates after this durable
  close record; a failure there must downgrade the task report rather than this projection evidence.
- Final close-document check before staging: PASS. Exact eight-path `git diff --check` exited 0; the new task plan
  had no trailing whitespace or pending markers; every task file ended with a newline; ROADMAP was append-only at
  28 additions / 0 deletions; no path was staged; and all 22 unrelated dirty-path state/size/SHA-256 baselines were
  byte-identical to capture.

## REVIEW

- One owner per scoped feature/program: done and evidenced by exact-topic searches and issue readback.
- Original `#9`–`#21` requirements retained with one replaceable trailing marker block: done and evidenced.
- Incomplete work remains open: done for `#9`–`#21` and `#29`–`#36`.
- Evidence-backed completed Release Center: done; only `#37` is closed/completed.
- Kimi parent truth: done; 19/21 checked with R18/R21 still incomplete and linked to `#30`/`#31`.
- Repository evidence authority and synchronized GitHub policy: done in the three byte-identical mirrors and both
  program plans.
- Durable close records: done in this plan, the append-only ROADMAP entry and the overwritten session handoff.
- Product/runtime scope: unchanged. No source, tests, API, schema, dependency, release, provider, credential,
  installed product, game, mod or standing configuration was mutated.
- Fresh-eyes finding: the stale seven-file handoff boundary and the pre-`#37` “all remain open” sentence were
  inconsistent with the explicit acceptance contract. Both are corrected before staging.

## CLOSE

- Status: VERIFIED for the GitHub projection, repository policy/docs and required precommit gate.
- No product capability-map delta. GitHub is a synchronized execution projection; repository plans, validation
  evidence, ROADMAP closes and AARs remain authoritative.
- Deliberately unchanged: product code and behavior; all incomplete issue states; W3 and every later feature unit;
  game/mod/config/release/provider/credential surfaces; unrelated dirty files.
- Final operational boundary: stage exactly the eight authorized paths, commit
  `docs: synchronize GitHub feature ledgers`, push `origin/main`, and prove `HEAD == origin/main == ls-remote`.
  The user-facing task status remains non-VERIFIED until those gates pass.

## AAR

- Triggers: the external GitHub writes followed a commentary acceptance contract and existing program plans, but this
  task-level repository record was written afterward rather than before the first issue write. Close reconciliation
  also corrected the stale seven-file handoff boundary and the acceptance sentence that predated `#37`.
- Reconciliation change: the initial write set omitted the separately scoped, already-verified Nexus/Steam Release
  Center. Duplicate search found no owner issue, so `#37` was added and closed with B109 evidence.
- Sustain: duplicate-first search, parent checklist with only unfinished children, prefix-preserving marker updates.
- Improve work/approach: create the task-level repository record before the first external write even when the source
  feature plans already exist; derive the final owned-file set directly from the acceptance contract before writing
  the handoff.
- Improve tools: the connector updates issues one at a time and search results may include parent references or pull
  requests; exact fetch/readback remains required. Read-only wrapper attempts hit a PowerShell pipeline syntax error,
  an unavailable `TextEncoder`, and one JavaScript quoting error; each failed before mutation and was corrected. A
  deliberately stricter whole-file whitespace scan then found historical `ROADMAP.md:4890`; byte comparison proved
  it identical to `HEAD` and outside the task diff, so the changed-line oracle stayed authoritative and unrelated
  history was not “cleaned.” The first commit wrapper allowed only 60 seconds, killed Git while its precommit hook
  was still running, and left three hook children to finish independently. `HEAD` stayed unchanged, the exact index
  survived, no lock remained, and the children exited without intervention; retry uses a five-minute wrapper. A
  subsequent PowerShell precedence error reduced the live remote hash to its first character in a wrapper assertion;
  it did not change Git state, and the corrected check uses an anchored 40-hex regex.
- Highest-risk evidenced weakness: repository and GitHub can drift unless each implementation close updates both.
- Project lesson: GitHub is a synchronized projection; repository evidence remains the success authority. No
  external StarForge AAR ledger was changed under this exact task-owned-file authorization.
