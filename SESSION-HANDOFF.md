# X4 Forge session handoff — 2026-07-29 · B108 PARTIAL / 0.0.58 PUBLIC / CI CORRECTION

## One-line state

The task baseline was `7c0bd24`; three non-overlapping external bot commits advanced `origin/main` to `c512920`,
then external docs commit `2e9f74f` captured the already-written B108 ROADMAP close from the shared worktree and
was pushed. It captured no B108 source. B108 is VERIFIED and
X4 Forge Studio 0.0.58 is public. Route stability passed 10/10 at 175/175;
oracles 114/114; full e2e 43/43; real corpus 14/14; reference API 81/81; particles 544/544; audit is zero;
precommit is green. Installed Antigravity visibly runs 0.0.58 with a live managed sidecar, and real discovery
records are token-free after the upgrade migration. OpenVSX's 17,812,396-byte public VSIX exactly matches the
installed/tested package at SHA-256 `4E703F203B32DBB7A9EDFB7C1A27705175371B638EEC17B68744F4D9A69F1009`.
The release source commit is pushed at `dd452f0` and `origin/main == HEAD` was proved. Its first public Quality
run failed because the workflow omitted `npm ci --prefix vscode-extension`; the corrective workflow is now the
only open B108 gate.

## Active bounded unit

- Plan/record: `docs/plans/2026-07-29-known-bugs-hardening-release.md`.
- Implemented FB-2/12/13/14/16/17/18/19/20/21 and the valid FB-22 bounds. Their source/focused defects are
  removed from `KNOWN-BUGS.md`; the oracle determinism defect found during validation is also repaired and removed.
- Stop boundary remains unrelated B94-B98, addendum/MCP strategy, and real game/mod mutation.

## Validation state

- PASS: audit 0 vulnerabilities; typecheck; lint 0 errors (550 existing warnings); production build.
- PASS focused: workspace 14/14, GitHub store 7/7, cache 4/4, cross-file 19/19, CAT/DAT 15/15,
  XML limits 4/4, agent keys 22/22, discovery 16/16 including live-PID legacy credential migration.
- PASS route stability: 10/10 consecutive runs, 175/175 assertions each; dynamic ports, isolated state,
  teardown and temp-root cleanup verified.
- PASS oracle sweep: 114/114 after repairing the synthetic reference fixture's external configuration dependency.
- PASS e2e: 43/43 structured verdict; disposable ports stopped and live state hashes unchanged.
- PASS live schema/catalog acceptance: corpus 14/14, largest CAT 364,527 entries, reference API 81/81,
  schema particles 544/544.
- PASS build/package: root build; extension stage/build; staged probe 6/6; 0.0.58 VSIX package inspection.
- PASS installed product: rendered version 0.0.58, rebuilt Studio v1.0.348, live sidecar port 58753/PID 16676,
  public schema response, token-free real discovery files. Evidence is under `vscode-extension/evidence/0.0.58/`.
- PASS public artifact: exact OpenVSX 0.0.58 metadata/download and local/public SHA-256 parity.
- PASS final local: graph refresh, audit, lint, full oracle rerun, precommit, source commit, push, and remote equality.
- FAILED public Quality run 30498947479: clean runner lacked extension `@types/vscode`. PENDING corrective
  install-both-lockfiles commit and green public rerun.
- Antigravity and the 0.0.57 sidecar were active at baseline. Do not run state-touching validation until Ken
  answers whether Forge/X4 are running and the machine is quiet.
- Latest read-only state: no X4 process, one unique Antigravity X4 Forge window, sidecar listening on 65072.
  This does not prove the IDE is idle or authorize replacing the installed extension.

## Baseline / ownership

The task began clean at `7c0bd24eb1effa2faaa66248d533cb2ffbbbbaa5`. Before the B108 source commit,
`HEAD == origin/main == 2e9f74f`; earlier bot/workflow files do not overlap B108. `2e9f74f` accidentally includes
the B108 ROADMAP close because the external agent staged that shared file during this task. Every remaining
worktree change is B108-owned; the final commit brings implementation and evidence into agreement with that
already-pushed durable close.

## Hot files / next command

- Run `npm ci --prefix vscode-extension` plus root typecheck, commit the workflow correction, push, and require its
  public Quality run to pass. Then clear `KNOWN-BUGS.md`, restore VERIFIED close wording, and reprove remote equality.

## Hazards / dead theories

- FB-15 remains disproved by the dirty guard. Archive discovery is already bounded. Legacy deploy has a B97
  caller and was hardened rather than retired. Auto-sync controls were removed, not activated.
- ESLint 10/React Hooks 7 add repo-wide recommended rules; the config deliberately retains the prior enforced
  contract. Treat a future compiler-rule migration as separate work.
- CI must stay Windows-based with the 600-warning ceiling. FB-20 requires 10 local route runs and at least 5/5
  consecutive green before the new gate is trusted.
- Module execution alone does not invoke exported selftests; call the exported `run*Selftest` function.

## Commit question

The detailed B108 source commit is pushed. Do not call shipment complete until the corrective clean Windows CI
run passes; the first public run exposed a dependency-install blind spot that local state masked.
