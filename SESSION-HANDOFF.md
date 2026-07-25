# X4 Forge session handoff — 2026-07-25 public 0.0.40 + B81 root-asymmetry note

## One-line state

X4 Forge Studio 0.0.40 is public, byte-verified, committed, and pushed at `8f7ecba`; B81 and B82 are SPECIFIED after live agent work reproduced cross-root read/write asymmetry and malformed XML passing project validation until deploy.

## Verified release state

- Open VSX base and exact-version endpoints report stable 0.0.40.
- Public and local VSIX are byte-identical: 17,813,559 bytes, SHA-256 `10E7E0E8D367A7CDA01E209DCC0DAB700102A26C38131E38760AFAFFFB3E244A`.
- `HEAD`, `origin/main`, and `origin/HEAD` are `8f7ecba` (`feat(projects): browse workspace and deployed mods with lazy disclosure trees`).
- B79/B80 are VERIFIED: retained panels rebind to the current sidecar; Load Mod Project preserves workspace/filesystem identity and renders lazy IDE-style disclosure trees.
- Installed Antigravity visual acceptance is complete; Ken reported the user experience worked perfectly.

## New reproduced hazard — B81

- `GET /api/fs/read?path=...` resolves `filesystemPath || modWorkspacePath`.
- `POST /api/fs/write` resolves only `modWorkspacePath`.
- With both roots configured, a read-modify-write agent can read stale deployed bytes from G: and overwrite newer source bytes in F:.
- Current workaround used successfully by Claude: read workspace bytes directly, write through Forge, verify workspace bytes directly.
- Durable specification and acceptance contract are in `BACKLOG.md` B81.

## New reproduced validation gap — B82

- A mismatched `<do_elseif>...</do_else>` in `md/ai_influence_diplomacy.xml` passed `/api/agent/project/validate` with zero structural/schema errors.
- `/api/agent/deploy-verify` independently called `checkXmlWellformed`, rejected the emitted file, and wrote zero deployment files.
- The payload's incorrect `kind:"markdown"` is not the cause because MD validation also routes by `classifyPath(file.path)`.
- The shared `runProjectValidation` engine lacks the well-formedness pass; deploy owns a separate implementation.
- Durable specification and acceptance contract are in `BACKLOG.md` B82.

## First resume action

Implement B82 first because malformed XML currently escapes continuous validation: move the existing deterministic well-formedness check into the shared project-validation result and make deploy consume it without weakening its write barrier. Then implement B81 against isolated same-name fixtures. Neither task may touch the real workspace or deployment during validation.

## Boundaries and hazards

- Do not run `graphify update .`; B77 remains open because graph refresh can mutate historical PNG evidence.
- Do not stage, restore, or commit the unrelated tracked byte churn in `vscode-extension/evidence/0.0.35-runtime-copy-live.png` and `0.0.35-runtime-copy-startup.png` without separately identifying its owner.
- The B81 note does not authorize writes to the real Mod Workspace, Filesystem/deployment, X4 game directory, or standing configuration.
- Mild Forge lag remains observed but not causally reproduced; treat it as a separate measurement task if persistent.

## Eyeball queue

None for this documentation-only note. B81 implementation will require real UI proof only if its caller wiring changes visible browsing behavior.

## AAR outcome

Triggered by two reproduced cross-layer contracts. Sustain: Claude verified its payload before filing one false Forge bug, then deploy's independent gate prevented malformed XML from shipping. Improve: one shared validation engine must own deterministic XML structure, and agent API examples must name root ownership. Highest-risk weakness: continuous validation can currently display zero errors for XML that the deploy gate later rejects.

## Commit point

Documentation-only close title: `docs(backlog): record root asymmetry and XML validation gap`.
