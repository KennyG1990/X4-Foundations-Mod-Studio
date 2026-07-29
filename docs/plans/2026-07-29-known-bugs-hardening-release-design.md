# B108 known-bugs hardening release — reconciled design

## Decision

Ship the confirmed defects as four bounded implementation batches in one public X4 Forge Studio release:

1. **Mutation identity and integrity:** require an explicit workspace or source path for every deploy,
   run the full project validator on the compatible legacy deploy route, and make guarded file writes
   atomic with request-local receipts.
2. **Credential and client-state hygiene:** remove the session token from discovery records, move the
   GitHub credential out of browser storage into a server-owned write-only store, remove two placebo
   auto-sync controls, and preserve the last-known-good workspace cache when a quota write fails.
3. **Cross-file validation and parser boundaries:** parse Lua registrations from the Lua AST, add the
   proven indexed payload-key contract from `wiregate.py`, and add measured input/entity/depth limits
   without rejecting the live X4 corpus.
4. **Dependency and CI closure:** remediate the current six npm advisories, add a quality workflow, and
   prove the historical route-test flake before treating it as fixed.

The batches remain separately testable and reviewable, but versioning, packaging, installed-host proof,
OpenVSX publication, and the final source commit happen once at the end.

## Why this design

The alternative of one undifferentiated patch makes a failed gate difficult to localize and couples
credential work to deploy/file-write correctness. Stopping after only FB-12/13/14 would leave confirmed
credential exposure and false controls in the public product, contrary to the requested scope. Separate
micro-releases would multiply Antigravity reloads and registry publications without improving isolation;
the same isolation is obtained with batch-specific tests before a single release candidate.

## Reconciliation results that govern scope

- **FB-12 is narrower than reported.** `deploy-verify` already uses an explicit `path` or submitted
  `workspace` correctly. The defect is the third branch that silently falls back to the singleton
  `activeWorkspace`. All current UI callers can submit an explicit workspace; the Playtest panel is the
  one caller that currently sends `{}` when its optional path field is blank.
- **FB-13 must remain compatible.** BACKLOG B97 records a live caller of `/api/agent/deploy`; returning
  410 would break working tooling. The route stays supported and retains its deprecation response, but
  receives the same full `runProjectValidation` write gate as `deploy-verify`.
- **FB-14 has existing infrastructure to reuse.** `workspaceState.atomicWriteJson` already establishes
  the repository's temp-plus-rename posture. Generalize it for text/bytes; do not create a parallel
  transaction convention. The global `lastWriteReceipt` has no legitimate owner and is removed.
- **FB-15 is not reproduced.** `App.tsx` checks `localWorkspaceDirtyRef.current` before the version
  adoption branch. Kimi quoted the inner adoption branch without its controlling guard. A focused
  regression test must preserve this behavior, but no product fix is authorized for a defect that is
  absent.
- **FB-16 is a real credential exposure.** The extension already owns its sidecar token in memory and
  external agents have named, scoped `x4fk_` keys. Discovery needs port, PID, time, cwd, mode, and version;
  it does not need a session credential.
- **FB-17 reuses the server-owned-secret posture.** The app already stores AI keys server-side and returns
  status booleans only. GitHub gets a separate atomic, owner-restricted credential store because its token
  has different callers and lifecycle. Browser migration is one-way: submit a legacy token once, delete it
  from localStorage, and never return it from the API. GitHub proxy routes are session-token-only so a
  scoped external agent cannot spend the user's GitHub authority.
- **FB-18 is removed, not activated.** The controls have no consumer. Wiring them to `deploy-verify` would
  silently turn an inert checkbox into automatic writes to the game. Both the Playtest and Source Control
  placebo toggles are deleted.
- **FB-19 is a one-line destructive fallback.** A failed `localStorage.setItem` leaves the prior value
  intact; the catch block then deletes that valid cache. Remove the deletion and test last-known-good
  preservation. The server remains authoritative.
- **FB-20 is current.** `.github/workflows` has synchronization workflows but no code-quality workflow.
- **FB-21 is current but Kimi's package details drifted.** The live audit is six advisories (three high,
  one moderate, two low), all reporting fixes available. Remediation is driven by the live lockfile and a
  post-update audit, not the stale proposed versions.
- **FB-22 is partly false and partly valid hardening.** `findCatDatArchives` scans only the root plus one
  `extensions/<id>` level; it is not unbounded recursion. `fast-xml-parser` 5.8 already applies entity and
  nesting limits, but the project relies on defaults. Make entity budgets explicit. Add a 64 MiB catalog
  manifest limit (the largest live X4 catalog measured here is 32,695,220 bytes), safe offset/entry bounds,
  and a 64 MiB/256-depth XML import boundary. Do not disable normal XML entities used by X4 schemas.
- **FB-7, FB-8, FB-9, and FB-10 are not defects in this unit.** They are documentation/product-policy or
  operational items. The MCP server is intentionally exposed through a copy-config command rather than
  silently editing another tool's settings. They leave this defect ledger instead of being “fixed.”

## Security and network boundary

GitHub actions remain explicit button-driven operations. The server credential is never returned, logged,
or placed in a discovery record. Credential status/store/delete endpoints accept only the Studio session
token. Existing GitHub request surfaces receive deterministic request limits (file count and total payload
for pushes, response-size bound for loads, fixed 50-commit history) and reject over-limit input before a
network request. Disconnect deletes the stored credential. No AI spending surface changes.

## Stop boundary

Stop when the confirmed FB-2/12/13/14/16/17/18/19/20/21 and the valid subset of FB-22 are closed and
evidenced in the installed public artifact. Do not absorb unrelated BACKLOG work (including B94-B98),
feature requests from the old addendum, cosmetic FB-6, mod packaging policy, MCP product strategy, or a
replacement for the intentional active-workspace model.
