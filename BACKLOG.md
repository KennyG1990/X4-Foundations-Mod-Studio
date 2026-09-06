# X4 Forge — BACKLOG (open work ONLY)

> Workflow v2 records policy: this file stays SMALL — spec'd / in-progress items with states and owners.
> Sessions START here. Closing an item MOVES it into ROADMAP.md as a dated, verification-cited entry.
> States: `spec'd` · `in_progress` · `blocked` · `parked`. Owner is whoever picks it up (agent or Ken).

## P0 — Active

### B119 · X4 UI editor — linter-first real layout port `in_progress` (P0, GitHub #41)

Port, do not invent: the full program will use X4 9.00's shipped `helper.lua` / `widget_fullscreen.lua`, preserve real
Lua calls and multi-file source fidelity, add keep-out overlays, and keep game proof authoritative. The first bounded
unit is the higher-value referee: a source-backed linter for every known silent frame/layout trap, wired through the
existing Lua analyzer, project validator, package/export/deploy diagnostics, IDE Problems, and UIBuilder. Corpus
reconciliation corrected the original severity boundary: literal `24+` columns block; `13-23` warn and require game
verification because official X4 9.00 contains 13-column tables. Dynamic shapes say `not statically verified`; clean
output says only `No known rule violated` and `Not verified in game`.
Plan: `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`. Source-first renderer design:
`docs/plans/2026-08-10-b119-x4-ui-editor-source-first-design.md`. Owner: GitHub #41.
The final dogfood fixture is the supplied `C:\Users\Moshi\Desktop\# AI Influence mod UI design\design_handoff_ai_influence`
bundle. All twelve reference images (`00` plus `1a`-`1j`) must be visually inspected and the finished Forge must author
the real X4 Lua rather than porting the HTML/CSS prototype. Build recommended screen `1b` first, then the remaining
comm-link, confirmation-gate, and hub screens. Compare Forge output to the 2560x1440 references, preserve the measured
conversation-wheel/NPC keep-outs, and require deployed X4 screenshots before any 1:1 claim.
**Original-brief audit 2026-09-05 — 5/6 VERIFIED / 1/6 PARTIAL:** exact hand-written Lua round-trip, all eleven
linter trap families including pre-export `addTable(24)` rejection, deploy-bound `Not verified in game` truth, and the
fixed-drawable X4 user-scale contract are `VERIFIED`. All four keep-out contexts now also have installed, non-null,
independently toggleable Canvas geometry with exact source/target/truth retention. At unchanged drawable `2544x1353`, Forge width changed
`663 -> 729` (`1.09955x`) while three X4 controls changed `659 -> 723`, `654 -> 721`, and `656 -> 723`; ratio disagreement
is only `0.22-0.26%`, and corresponding edges are within `4x3` pixels. X4 and Forge were restored to scale `1.0`, exact
workspace/deployed fixture hashes remain equal, and current owned frame/Lua failure signatures are zero. Three complete-
menu column/row/wrap/truncation comparisons remain the sole `PARTIAL` brief row. Full matrix, receipt, and AAR:
`docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md` and
`docs/plans/2026-09-03-b119-fixed-drawable-user-scale.md`. The installed export status can announce success before
native Save As/file completion; repair that false-success wording before release. Next unit is the first complete-menu
census. No release is claimed.
Scale checkpoint `3367c6846431b0ac85b1ab8081ce8a9657ded45d` has exact local/tracking/direct-remote parity. GitHub #41
comment `5525209644`, Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Google Current Status revision
`ANLCKQne8OZbPRb6PHRufzwKLfOLH_yusLOGNaGOZWrm2Mz1LvS0zORn0mWt1LL1aiEtm0C9T448JOcLMBrxp3lttyQAiHPnSCID-JbAycdV`
were written and read back. The first Drive append crossed a paragraph boundary incorrectly; the accepted revision
contains a separate `HEADING_2` and restored preceding `NORMAL_TEXT` paragraph.
**Four-context keep-out unit 2026-09-05 — BOUNDED VERIFIED / FULL B119 PARTIAL:** retained X4 9.00
first-person, cockpit-conversation, map-open, and fullscreen-menu captures now back exact issued MESSAGES and shared
top-level-strip polygons through the existing Session -> Paint -> Canvas authority. Structural clones, wrong contexts,
stale projections, and disabled members refuse; the three measured guides remain unchanged and no INFORMATION rectangle
was invented. Fresh-eyes review also reproduced and repaired the installed stale-parent-snapshot race: the mounted
source -> target matrix now reaches `13/13`, `rendered/current`, with one exact Canvas/export identity. The exact private
package `vscode-extension/x4-forge-studio-0.0.70-b119-four-context-snapshot-order-20260905.vsix` is installed with zero
missing/mismatched payload files; SHA-256
`737A755251BCD1B71D05C53F9040B7B631423D0BDE41F7AAD649C8B5FE40EA9E`. Installed interaction passed all four
preset buttons and all seven applicable checkbox mutations (`4+1+1+1`), with every native Canvas hash changing on
disable and restoring exactly on re-enable while source identity and `Not verified in game` stayed stable. Focused
matrices, typecheck, exact lint, build/stage/probe, complete precommit, installed oracles `134/134`, and full serial e2e
`106/106` with `treeGone=true` pass. Original-brief row 5 is `VERIFIED`; full record and twenty retained PNGs:
`docs/plans/2026-09-03-b119-four-context-keepouts.md`.
Projection close: source checkpoint `8b97ea556a13a638dd7db157883687dc79a9d6ce`, GitHub #41 comment
`5550124777`, Notion owner read back `In Progress / Partial`, and Google Current Status tab `t.0` read back at
revision `ANLCKQmmV5DbvTyHnpcg-W_JJbmRqZvOZF7Dt_eETxHSKsR8BCnBACfrINJDNbgKRxChLcCD-r3RMZMVK_ozoeJH_ZCYMSEeY1iKtAf7vEQY`.
**UI-only end-to-end smoke 2026-08-28 — ONE-PROFILE X4 VERIFIED / FULL B119 PARTIAL:** Forge compiled,
linted, project-validated, guarded-wrote, dry-deployed, and actually deployed the dedicated four-file `pipeline_test`
mod. X4 9.00 visibly rendered the generated frame at the configured `2544x1353` drawable profile; both buttons were
clicked, the repaired full-height editbox visibly accepted `b119test`, and the standard close removed the panel. The
current-session debuglog has zero frame-setup, zero-height editbox, nil-`onCloseElement`, or reserved-scrollbar
diagnostics. Source-backed repair adds `x4-ui.editbox-height-minimum`, preserves authored editbox height, emits the
shipped close callback, and disables reservation on its fixed-width table. The live run also exposed first-deploy
recovery's cross-volume `EXDEV` assumption; the existing recovery owner now copy-verifies before removal and restores
exactly on removal/receipt failure. Live rollback removed only `pipeline_test`, replay returned
`RECOVERY_ALREADY_USED`, and the 44-entry extensions census equals the pre-state minus that one root. Evidence:
`dev-docs/b119-x4-ui-pipeline-smoke/in-game-20260828/repaired/`. Final authority gates passed under bundled Node
`24.19.0`: durable writers `14/14` plus `8/8`, action-receipt coverage `82` routes / `56` surfaces, complete
precommit, and refreshed Graphify `9867` nodes / `24697` edges / `322` communities. A second profile, complete
shipped-layout parity,
Forge/X4 pixel comparison, and AI Influence reconstruction remain open, so B119 stays
`in_progress / PARTIAL`; GitHub #41 remains open. Source checkpoint
`474eab7e1e1881344c7cdf138a8f0993c1061948` is pushed with local/tracking/direct-remote parity; GitHub comment
`5449987062` and the Notion owner page were written and read back. The Google Docs trusted-read bridge's Windows path,
UTF-8 runtime, and ConPTY receipt defects are repaired with `11/11` owner checks and a real exact-receipt probe; the
canonical Drive status document was revision-locked, updated, and read back without bypassing the bridge.
**Exact deploy-bound confirmation 2026-08-28 — BOUNDED VERIFIED / FULL B119 PARTIAL:** the existing
deploy/runtime owner now persists and reconstructs the exact deployed regular-tree fingerprint. The existing global
experience-confirmation owner carries an optional X4 UI snapshot that verifies externally only when workspace/source,
successful deploy timestamp/path/fingerprint, target identity, clean readiness, and normalized drawable/UI-scale profile
all still match explicit human confirmation. Internal preview/session receipts remain `gameVerified:false` and generic
confirmation cannot promote an unmatched UI snapshot. Fresh-eyes review corrected generic-confirmation preservation and
parent/child snapshot-lifecycle races. Verification-owner tests, runtime adapter `44/44`, SourceEditor matrices,
typecheck, bounded lint, diff hygiene, and Graphify `9931/24845/327` are green. Route integration is `491/491`, runtime
oracles are `134/134`, final serial e2e is `104/104` with zero flaky results and `treeGone=true`, complete precommit is
green, and production build emits `1,848` modules. The first full e2e remains retained red evidence at `103 + 1 flaky`;
exact `3/3` and one controlled unchanged `104/104` retry cleared the host gate. Writer governance passes `14/14 + 8/8`;
capability candidate `25af9c77...ccfae` added only the new source boundary and final audit passes `12/297/1/11`; action
receipts remain `82` routes / `56` surfaces. Source checkpoint
`ff1e26f509d81e3b4c87b63eebdc2bfe73afcbe8` is pushed with local/tracking/direct-remote parity and zero B119 staged
residue. GitHub #41 host-close comment `5451702392`, the Notion owner page, and Drive revision
`AIroW35I6fub9etyYoDD299v49jAQeCtdxtSzd5SFIrGKhkiYwRyDhB3vOxFGKuda5PLLeUje2liSYyjDa3VkWPLJyLspPBjYwtKr7ZTMXRE`
were written and read back with the issue open. The unchanged exact four-file / `6,338`-byte `pipeline_test` package
then passed Forge dry-run/apply and real X4 9.00 at a second configured `1920x1080` / default-scale profile: both
buttons responded, the second highlighted, the editbox accepted `b119`, close removed the panel, and the scoped
debuglog oracle found zero frame/view refusal, zero-height editbox, nil close callback, reserved scrollbar, or Lua
runtime error. Against the prior `2544x1353` profile, measured first-button width/height scaling is within `0.65%` of
the drawable-height ratio. One-use recovery restored the absent target, replay returned
`RECOVERY_ALREADY_USED`, extensions returned `44 -> 43`, touched profile files match exact pre-run hashes, and all
process/port containment checks pass. Evidence:
`dev-docs/b119-x4-ui-pipeline-smoke/in-game-20260828/second-profile/runtime-receipt.json`. Dynamic
`Helper.scaleX` / `Helper.scaleY` geometry remains unavailable in Forge receipts, so this proves real-X4 scaling and
the UI-only pipeline, not exact Forge-versus-X4 parity. Full B119 remains `in_progress / PARTIAL`; no OpenVSX release
is claimed. Second-profile record checkpoint `d5dcc80284e6c1dac2326871cd106fc9a5119d2a` is pushed with
local/tracking/direct-remote parity. GitHub #41 comment `5455192771`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive revision
`AIroW35ORAD2b16wtqsH8JNjJ03uib5jxFvleX03tDcvhkOVlZmEgQmddPsyOveZSskE7fp54ySMVePGX8lvtV7cve4MvkxLj-v86YevGGag`
were written and read back; the issue remains open.
**Source-proven numeric frame geometry 2026-08-28 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The existing call-model
and layout-program owners now retain and independently revalidate a deliberately closed numeric-expression grammar from
exact Lua source, then resolve it only through profile-pinned Helper constants and bound `scaleX` / `scaleY` results.
The unchanged real `pipeline_test.lua` is byte-identical at SHA-256 `C1D9CD85...718E`; Forge now projects exact frame
facts `695/322/530/436` at `1920x1080` scale `1` and `940.5/404/663/545` at `2544x1353` scale `1.25`, with both
program/evidence pairs valid. Preview samples cannot override these facts, `scaleFont` cannot become geometry, and the
mutation matrix rejects unknown/reassigned/conditional/unsupported/non-finite, source-range, structural, schema, and
same-context decoy forgeries. Final focused gates are Call Model `72/72`, Layout `641/641`, Scene `153/153` with
MENU/HUB/COMM `3/3`; runtime oracles are `134/134`; controlled bundled-Node E2E is `104/104` with zero flakes and
`treeGone=true`; complete precommit, full lint (zero errors), and the `1,848`-module production build pass. The first
default-Node E2E remains retained red evidence after a retry and later `0xC0000409` incomplete report. Record:
`docs/plans/2026-08-28-b119-source-proven-numeric-geometry.md`. This closes the prior dynamic-frame-fact gap, not exact
Forge/X4 pixel parity, arbitrary C++ acceptance, remaining brief coverage, AI Influence reconstruction, or OpenVSX
release. B119 and GitHub #41 remain `in_progress / PARTIAL`.
Source checkpoint `13af741735fb4309996292037c41223b853052eb` is pushed with exact
local/tracking/direct-remote parity. GitHub #41 comment `5458587855`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive revision
`AIroW34vaIbo_BkljAW6-Et0lTWBHdAk1cEJujn4fuHgb38zN9PXQzfgeOjPtSMMt17rhizxVjqhN6vGLQ2u06QWlUuKyd8oXu2GRsmnSEzr`
were written and read back with the issue open and the full-B119 PARTIAL boundary intact.
**Source-proven table/widget geometry 2026-08-28 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The existing preview
pipeline now carries its already validated X4 9.00 corpus into the layout program, recognizes only shipped
`Helper.headerRowCenteredProperties`, and source-pins the header font, size, y offset, minimum row height, centered
alignment, and `container_subsection_header` color. Per-cell minimum text height now comes from finalized colspan width,
scaled Zekton metrics, wrap layout, and Helper floors; Scene no longer double-scales that already-final value at non-unit
scale. The exact unchanged `pipeline_test.lua` remains SHA-256
`C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`. Exact table heights are `160` at
`1920x1080 / scale 1` and `202` at `2544x1353 / scale 1.25`; downstream evidence is one frame, one table, six rows,
twelve cells, six widgets, eight texts, ninety-nine glyphs, and fifty-six explicit gaps. The exact synthetic
`container_subsection_header -> azure_dark_alpha_26` mapping retains `224` base colors / `804` mappings and closes five
color-only gaps without changing production. Focused Layout `641/641`, Preview `103/103`, Scene `154/154`, MENU/HUB/COMM
`3/3`, TypeScript, bounded lint, diff hygiene, and complete precommit are green; the final commit hook repeated the same
precommit authority. The accepted unchanged full E2E `104/104` and `1,848`-module production build remain retained
evidence. Source commit `188d5c02363d3a25dd818b32401c7e0bd2cad34b` is pushed with exact local/tracking/direct-remote
parity. GitHub #41 comment `5460008598`, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive revision
`AIroW36lt84Fqx6FIveaiTHVv9nd8X-o6l9iFOYppQWhdkjZFUA81qeRoHdAReUfyo4bN7CTowAQzIt_QcnW94fJ05flKFDe3w19meoxANUN`
were written and read back with the issue open. The rendered Forge canvas now shares the centered table, row order,
spans, headers, status, buttons, and editbox region with retained X4 evidence, but still has a large frame outline and
missing X4 background/alpha composition. Complete linter-table reconciliation, broader shipped Helper/widget coverage,
pixel parity, AI Influence reconstruction, installed-extension proof, and OpenVSX release remain open; B119 stays
`in_progress / PARTIAL` and every internal preview remains `Not verified in game`.
**Source-calibrated editbox-height lint 2026-08-29 — BOUNDED VERIFIED / FULL B119 PARTIAL:** Reopening the supplied
linter table confirmed all eleven requested defect families already exist with positive, safe-negative,
dynamic/unresolved, and real-failure coverage. The unchanged official X4 9.00 census then reproduced one overbroad
post-smoke rule: `81/81/0` files produced `25` applicable fatal `x4-ui.editbox-height-minimum` findings, all for omitted
height in shipped source. Exact `helper.lua` reconciliation proves positive row peers affect row height only, while
table default cell properties and displayed-hotkey minimum handling are the modeled descriptor-height paths. Omitted
call-specific height is now a visible nonblocking warning; literal zero remains a conservative blocking error; positive
static height stays clean; dynamic height stays `Not statically verified`. Final corpus is `81/81/0`, applicable fatal
`0`, warnings `31`; linter is `118/118`, project/IDE Problems `11/11`, direct package-readiness parity passes, isolated
oracles are `134/134`, full lint has zero errors, build is `1,848` modules, and complete precommit passed directly and
in the commit hook. Source commit `60dbb0a93fd9e6b7faf466218f0101d748627434` is pushed with exact three-way parity.
GitHub #41 comment `5460382092`, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive revision
`AIroW36P8KYF1ZNNxZJdRU5PSzdZFmgZXoaTQQcYCNFfSl3DB7YL9fHA41Mstl0lcmMPNEdjKbc9JrGW_Eu1nNZCMGbi1h9aOD_kQkUF3hzu`
were written and read back with the issue open. Table-default/hotkey modeling, exact pixel parity, general C++ frame
acceptance, full AI Influence reconstruction, installed-extension proof, and OpenVSX release remain open; B119 stays
`in_progress / PARTIAL` and every internal preview remains `Not verified in game`.
**Editbox descriptor-height source port 2026-08-30 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The existing call-model,
kernel/program, linter, Scene, source-edit, and integration owners now port shipped
X4 9.00 simple editbox defaults, complex hotkey defaults, direct hotkey overrides, `initTableCell` ordering, and
displayed-hotkey minimum height. Button hotkeys are separated by source proof; `setIcon`/`setIcon2` preserve identity
only for tracked buttons, and invalid editbox chains remain explicit gaps/warnings. Independent focused validation is
`1,189/1,189` (CallModel `89`, Kernel `34`, Program `648`, Lint `140`, Scene `174`, SourceEdits `83`, integration
`21`); downstream PreviewPipeline `105/105`, PaintPlan `175/175`, CanvasRenderer `129/129`, typecheck, and exact-path
lint are green with zero errors. Direct `setHotkey` now honors the shipped property-table override order; valid unported
`x`/`y` remain source-linked partial gaps, and Scene rejects dropped/forged gaps plus mismatched normalized property
names. The final official corpus is repeatable at `81/81/0`,
`7,669,552` bytes, applicable fatal `0`, warnings `29`, unverified `70`, truncated `26`, gaps `13,681`. The forecast
`31 -> 26` was rejected: five real displayed-hotkey positives clean while faithful button/editbox attribution restores
three legitimate warnings, for exact net `31 -> 29`. A fresh two-pass retry against installed 0.0.70 proved `F:` healthy
and the configured sidecar/corpus connection sound; the earlier timeout was readiness timing, not storage. After the
operator supplied the machine gate, isolated oracles passed `134/134`; exact tracked serial E2E passed `103/103` with
complete process ownership, teardown, and zero remaining PIDs; complete precommit and the `1,848`-module production
build passed; Graphify refreshed to `10,029` nodes / `25,198` edges / `317` communities; protected live roots and
configured ports remained unchanged.
Fresh Scene review also closed three pair-valid evidence escapes: forged facts for omitted properties, materialized
transitions from dynamic properties, and unavailable/arbitrary-extra descriptor facts. The causal receipts were
`156/163 -> 163/163`, `163/168 -> 168/168`, and `168/172 -> 172/172`; per-kind keys and own-key/source-property
reciprocity preserve explicit `0`, `false`, and empty strings while rejecting forged provenance.
Source commit `2443399ffdb46dbaca4eef784396cce4e68bcd02` is pushed with exact local/tracking/direct-remote parity.
GitHub #41 comment `5469712047`, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive revision
`AIroW34i2k73hJ1YmnKtELjTFYTbDYMJBeWky7pZhoZnk8ti3ebnd1g4dUZYbAskwjckN61_0wEJUNpe09v8CsFimJDC-PMiFIDcxdH_okmc`
were written and read back with the issue open. Record:
`docs/plans/2026-08-29-b119-editbox-descriptor-height-source-port.md`. Frame/background parity, keep-outs, AI Influence
reconstruction, installed-extension proof, OpenVSX publication, and final two-profile Forge/X4 comparison remain open;
overall B119 stays `in_progress / PARTIAL` and preview remains `Not verified in game`.
**Frame background-composition source port 2026-08-30 — SPECIFIED / IN PROGRESS:** retained X4 and Forge images plus
the exact deployed `pipeline_test.lua` reproduce the remaining large-outline mismatch. Shipped `helper.lua` proves the
frame owns three complex texture layers (`background`, `background2`, `overlay`) whose empty icon deactivates paint;
`blurBackground` is a separate game-compositor request. `pipeline_test` calls none of the texture setters, so its three
layers are exactly inactive. Forge currently turns a nonvisual Helper-runtime availability gap into a full-frame
`unavailable-node` boundary. The bounded port will carry the exact layer/default/backdrop facts through the existing
CallModel -> LayoutProgram -> Scene -> PaintPlan -> Canvas path, retain all machine-readable diagnostics, preserve
diagnostic-map behavior, and remove only the invented source-composition boundary. Baseline focused suites are
`1,320/1,320`. The ten-file candidate reached `1,326/1,326` but the independent 2026-08-31 audit rejected it:
Scene rejects new setters, `properties.icon` overrides are dropped, blur=false restores the false outline, two widget
source pins are wrong, and the second-profile/content trace checks are incomplete. Both prior workers are closed;
the first corrective batch passed `1,340/1,340` but a second review found F-6: normalized/unknown frame option keys
could deactivate a texture that Helper would retain. F-6 is now independently reviewed and reproduced at focused
`1,344/1,344` plus all 19 existing UI entrypoints, including the configured widget-source check with zero skips.
All workers are closed. Current-snapshot corpus (`81/81/0`), oracles (`134/134`), typecheck/lint/precommit/build, and
structured serial E2E (`103/103`, complete ownership/teardown) pass. Workspace/state/config and retained Lua hashes
are unchanged, but the broader installed-data checksum is non-clean while a runtime-debug snapshot keeps updating;
full installed-data parity is not claimed. Operator correction/readback on 2026-08-31 confirms Forge is already mounted
on `52900`; a second preview server is not inherently required. That process serves installed extension `0.0.70`
(`D27EDFA...3437`), while the reviewed candidate build is `124459D...F27B`, so the existing pixels prove the installed
baseline rather than the candidate. Next acceptance step is a reversible candidate install/reload into the existing
Forge host, then mounted visual inspection. No parallel-launch workaround or visual acceptance is claimed. HEAD remains
`bd38ec6` with an empty index. The first clean detached-worktree package,
`vscode-extension/x4-forge-studio-0.0.70-b119-019fea10.vsix` (`32746D...E789C`), passed its package gates but omitted the
installed release-showcase surface and is superseded for installation. The release-surface-preserving candidate is
`vscode-extension/x4-forge-studio-0.0.70-b119-release-surface-019fea10.vsix`: final-byte inspection passed `2,107` entries /
`71,561,839` unpacked bytes / `26,281,304` archive bytes, SHA-256
`19C547BE9633F102444113F805351764D6CCD7CC7635A6F2FABCA7E37E4E1D09`, with embedded reviewed server `124459D...F27B`.
Its staged-product probe is `16/16`, inspector negative matrix `13/13`, all `2,081` application files match the reviewed
candidate, and all `15/15` showcase assets match installed. The disposable worktree is removed and the running `52900`
host is unchanged. The artifact is not installed or published; explicit installed-extension write/reload authorization
remains the next gate. The earlier package
checkpoint was written/read back as GitHub #41 comment `5489961230`, in the existing Notion owner, and in Google Current
Status tab `t.0` at revision `AIroW36mAKtRPswKCXzEXeCA0CjLqXJBm2EKPdzV2umkk8z0PRJEMQJy4dNrv5VWOdzoNFLG1_weadJ5tI7Bc3QiZHkeu9ZhcJ-CWs6At1Z2`;
all three remain explicitly `PARTIAL / Not verified in game`. Plan:
`docs/plans/2026-08-30-b119-frame-background-composition-source-port.md`. No game/mod/config/corpus write or parity claim
is authorized. Read-only install preflight found that the superseded scoped VSIX was a whole-extension replacement: `1,987`
payload files matched, `103` differed or were missing, and `18` installed extras were absent. The release-surface candidate
preserves the fifteen showcase assets and matching manifest, but still has `98` byte-different same-path files plus three
paths on each side. A temporary acceptance install therefore still requires a complete extension-folder plus registry backup
and cannot be the OpenVSX release artifact. Evidence is
`dev-docs/b119-x4-ui-pipeline-smoke/frame-composition-runtime-20260831/records/release-surface-package/receipt.json`. This
correction is read back as GitHub #41 comment `5490092216`, in the existing Notion owner, and in Drive tab `t.0` revision
`AIroW37d-IsKbJ6-mkmA1InI3tzjZWXoX8rSU0OZlVP8hNdUYr4lagkHtsJ4kPNv6twFuSa9ngEJU0SifYbgH41ISTygPWjQ1y_tJ3FHsVWv`.
The superseding release-surface checkpoint is read back as GitHub #41 comment `5490501378`, Notion edit
`2026-09-01T07:33:38.746Z`, and Drive tab `t.0` revision
`ANLCKQlnw-0h1u2Pv_Hony7A8gbnTUV9UxLzUKvdJ7RWeVbBgxaFeeIfYE4OISquE74UGWKb9XJ5QQ78828MdNiK3rWSpt99DwgMzixkAvC_`;
the three updated paragraphs, four native links, and existing date chip were verified. All records remain PARTIAL.
**Installed green2/source-materialization checkpoint 2026-09-01 — BOUNDED VERIFIED / FULL B119 PARTIAL:** exact package
`x4-forge-studio-0.0.70-b119-source-materialization-green2-019fea10.vsix` is installed and mounted through the single
managed sidecar on `60956` / PID `38296`; installed server SHA-256 `626C6517...67314` matches the inspected package.
Fresh read-only import of configured `x4_ai_influence` materializes `ui.xml` and all seven registered Lua sources,
including 568,069-byte `aic_uix.lua`, and returns `source-owned`, editable, shippable authority. The old persisted
workspace remains intentionally untouched and therefore still shows its historical omission. Strict configured Scene
census passes `176/176`, but it exposes the remaining fidelity gap: MENU produces 3 widgets / 5 texts / 7 glyphs,
HUB and COMM produce zero widgets and zero texts. This is installed pipeline and source-round-trip progress, not
three-menu pixel parity or game proof. Next is a causal visible-operation gap receipt and one shipped-source port;
OpenVSX, AI Influence reconstruction, keep-outs, and final X4 comparison remain open.
The exact source checkpoint is committed and pushed at `71828d9c99383dea5da89b5c56d15575839f4f88`; local HEAD,
`origin/main`, and direct remote `main` matched at readback. The partial projection is synchronized and read back at
GitHub #41 comment `5503331754`, the existing Notion owner page's installed source-materialization section, and Drive
tab `t.0` revision `AIroW36RDRS6r8agSVm85k-cm_eTPmdWhnXT6l_qtFAUYt9t74oSmZ7bk2Z0tRsKaWgzrp1cnxcphhEmJHu-IFWzHmV9oAqsNqq6wvHSBiAW`.
Drive's file-backed trusted read found no protected controls; the current heading/status/hash and native GitHub/Notion
links were re-read after the revision-guarded update. No OpenVSX, game, mod, canvas, or release state changed.
B119 remains `in_progress / PARTIAL / Not verified in game`.
**Local `Helper.scaleFont` wrapper checkpoint 2026-09-02 — SOURCE + PACKAGE VERIFIED / INSTALLED ACCEPTANCE
REVERTED / FULL B119 PARTIAL:** the existing LayoutProgram now carries only the exact configured guarded local wrapper
through the shipped Helper scale law and preserves the widget descriptor's separate second scale pass. Independent
review first forced binding-collision, builtin-rebinding, literal-equivalence, and causal-negative repairs. The final
zero-write audit then exposed environment-authority escapes: `29` attacks reproduced across the fail-first sequence,
including `_G`/`_ENV` member/index writes, uncertain dynamic keys, `rawset`, `rawget`, and `_ENV` replacement. The
fail-closed repair leaves `39` probes as authority-unavailable (`33`) or explicitly unsupported model shapes (`6`),
with no known font leakage; final LayoutProgram is `705/705`, zero skips. Strict Scene remains `176/176` with
MENU/HUB/COMM `3/3`; corpus is `81/81/0` with zero fatal findings. Full precommit and the `1,848`-module build pass.
Superseding exact VSIX `x4-forge-studio-0.0.70-b119-font-authority-019fea10.vsix` is `26,283,699` bytes, SHA-256
`3C3F9FC16C269A43D91B5C298A3D6E48A1BD0800DDCD90A7E1AB80096E9FDE9F`; staged probe is `16/16`, inspector
selftest `13/13`, final inspector `2,107` entries / `71,568,514` unpacked bytes, all `15/15` showcase assets and the
native SQLite binding are present. The embedded browser asset is `index-BQaOS9Gd.js`, SHA-256
`93F4A3BDC45B346C00E13FBEEDAD69F150C974066C24FB9F8BC0DDE7073E6A9C`. The earlier same-version install of the
superseded package failed before replacement after `1,099` `EPERM` rename retries because active Antigravity processes
held the native payload; that operation remains safely `REVERTED`. The installed `2,106`-file tree, registry, protected
config, and protected state are byte-identical to the retained backup, and the running host still serves old browser
asset `77473900...E015`; the new asset is unmounted. Full IDE shutdown and a reversible install/visual inspection are
required. No OpenVSX, mod/game, or new X4 acceptance result is claimed; B119 remains
`in_progress / PARTIAL / Not verified in game`.
Source checkpoint `7aa5b9d50fd91eede47ab28fd96fada0b163d936` is pushed with exact local/tracking/direct-remote
parity. GitHub #41 comment `5507614879`, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a` at
`2026-09-02T09:44:45.771Z`, and Google Current Status revision
`AIroW34DU6xn-NC50YIedCZy5EIcoGLThl-pxkEMaLd-UwQAXpF1mRISy9ICP58Fblsq2movES5ILGuMoSoq27rjQpAEc7SxbpN8e4Amy_qa`
were written and read back. All remain `PARTIAL / Not verified in game` and identify the superseding candidate as
unmounted; the issue remains open.
**Canonical Source Editor + live UI-only pipeline checkpoint 2026-09-02 — BOUNDED VERIFIED / FULL B119 PARTIAL:**
installed Antigravity `0.0.70` now serves reviewed frontend SHA-256
`AA930AAE011DA57B185FB570857EEEC8902FAFAD116C1F6EE773663762482BD2`. The exact
`ui/pipeline_test.lua -> menu.createFrame` target is source-owned, editable, and shippable with 36 canonical entries;
no-corpus and forged raw/enriched/issued provenance remain locked. `OpenMenu` and `RemoveScript` are recognized X4
globals, while only parser-derived numeric-expression omission and exact shipped
`Helper.headerRowCenteredProperties` enrichment may reconcile. Forge previews at `1280x720 / scale 1` and
`2560x1440 / scale 1.4` retain `Not verified in game`. Exact dry-run/apply deployed the four-file UI-only mod with
workspace/staging/game hashes equal. X4 9.00 rendered the same 5,488-byte Lua at configured windowed `2544x1353`;
both buttons responded, native edit-box input worked, standard close removed the panel, and X4 exited cleanly. Scoped
fixture errors and view-setup failures are zero; the watcher remains `not_seen` because the silent fixture has no boot
marker. Focused suites, `134/134` oracles, build, two exact E2E shards `52/52 + 52/52`, and complete precommit pass;
the unsharded Windows `0xC0000409` receipt stays red. Source commit
`bc686eb47cad5dc42243dedf482f85b57bfcc5c7` is pushed with exact local/tracking/direct-remote parity. Record:
`docs/plans/2026-09-02-b119-canonical-source-editor-game-pipeline.md`. GitHub #41 comment `5510457342`, Notion owner
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive revision
`ANLCKQnNd6iVCfBusgAjOMlguoEO653tWFSs8Q3fX6V7orjHuejYVMNMMkDikxHbKrmiDnRYQryRXfi6PjNVXbETgO6-UZDapHeYBUSN6Rsh`
were written and read back; Graphify completed at `10,122 / 25,488 / 312`. Exact same-profile pixel parity, complete
Helper/widget and keep-out coverage, AI Influence reconstruction, release acceptance, and OpenVSX remain open, so
B119 and GitHub #41 stay `in_progress / PARTIAL`.
**AI Influence `1b` visual reconciliation 2026-08-19 — REPRODUCED GUIDE CONFLICT:** The source pixels were re-opened
and immutable hashes/dimensions are frozen in the plan. Forge's existing cockpit preset projects the measured guides to
`y=1134.72`, `y=1065.6`, and `x=1699.84` at `2560x1440`; the supplied `1b` choice/input geometry intersects all three.
Because these are guides rather than complete native polygons, this proves a design risk, not exact occlusion. Dogfood
must preserve a literal-mock render and a minimal clear variant with the preset enabled; deployed X4 decides which
native regions exist in that exact state. Never silently move the mock or claim both pixel identity and clearance.
**Full host-gate acceptance 2026-08-21 — `104/104`, commit checkpoint unlocked:** The retained global Node `24.15.0`
full-suite deaths remain honest red host evidence (`0xC0000409`, incomplete/no report). An immediate no-output death
also exposed a receipt serializer contradiction; exact native Luna repaired only `scripts/run-e2e.mjs`, moving the
causal verdict selftest `54/55 -> 55/55`, final hash
`836D690243CB822ADC310BCE2FE16253100C8BAB3D96E4241D2569D1115747A2`, with fresh zero-write audit `CLEAN`. The already
installed Node `24.19.0` / libuv `1.52.1` was then selected only through process-local `PATH`; the exact serial suite
passed `104/104` with verified receipt `48CDE7843...1E5D0`, complete discovery/terminal parity, child-close,
`treeGone=true`, zero residue, free live/ephemeral ports, X4 absent, and exact `.studio-state` / `data` / `config.json`
pre/post content parity. Complete precommit and production build pass under that runtime. Graphify is refreshed to
`9665` nodes / `24226` edges / `327` communities. This clears the B119 code checkpoint for explicit-path commit/push
and unlocks isolated AI Influence dogfood authoring. It does not prove engine frame acceptance: deployment and X4
screenshots remain open, and overall B119 stays `PARTIAL / Not verified in game`.
The exact 35-path executable checkpoint is committed and pushed at
`505253ba4fa40c75fcb252945229841766685a05`; post-push readback proved `origin/main == HEAD` and zero staged paths.
**AI Influence `1b` Canvas dogfood checkpoint 2026-08-21 — FOCUSED/MOUNTED VERIFIED, VISUAL PARITY PARTIAL:** The
isolated source-first dogfood consumed exact real-source samples but exposed two Canvas-only false refusals that
headless Scene/Paint checks missed: the use-site range was incorrectly required to contain its separate literal
declaration, and alias text `TOK.plate` was incorrectly required to equal the declaration's table-literal text. Two
causal fail-first receipts (`115/116`, then `116/117`) authorize only the bounded Canvas repair. Final production and
selftest SHA-256 are `5318E9B4...A56E3D` / `33447245...C3DC9`; worker/coordinator Canvas is `117/117`, driver variants
render `39/38` UI primitives with exact `12/12` and `9/9` sample consumption, and fresh zero-write Luna audit is
`CLEAN`. Rebuilt mounted production selects exact safe source `37FAE9C8...7A4F` / `menu.display`, canonical core/color,
`2560x1440` scale `1`, and nine samples; keep-outs off is `rendered/current` with `3,686,400` non-transparent/non-black
pixels and permanent `Not verified in game`. Full serial E2E is `104/104` at receipt SHA-256
`553B20B3...82D44`; precommit/build and live-root/port/X4 containment pass; graphify is `9666/24230/319`. Visual review
remains explicitly partial: this fixture appears mainly as a gray full-frame plate and red lower strip, not the supplied
AI Influence composition. Remaining B119 work is source/sample reconstruction for mockup fidelity, real mod deploy-byte
identity, C++ frame acceptance, and player-visible X4 screenshots. Overall status stays `PARTIAL / Not verified in game`.
The bounded Canvas repair is committed and pushed at `4c480418e0bb4095d0bd5935a3767b29cdd0e0f8`; readback proved
`origin/main == HEAD` and an empty index while preserving every unrelated dirty path. The partial checkpoint was read
back at GitHub #41 comment `5367932527`; the owner issue remains open.
**AI Influence `1b` source-composition checkpoint 2026-08-21 — HOST VERIFIED / VISUAL RECONSTRUCTION PARTIAL:** The
mounted `Source preview canvas` was the existing diagnostic-map presentation: later opaque gap/unavailable rectangles
erased source-proven tints and exact Zekton glyphs. A causal real-paint fail-first was `118/119`; the existing Canvas now
supports explicit `diagnostic-map | source-composition`, keeps diagnostic-map as the default, and SourceEditor alone
selects source composition. Final Canvas is `119/119`, SourceEditor color `12/12`, EditorSession `7/7`, Paint `165/165`,
Preview `102/102`, Scene `139/139`, with typecheck/lint/build green. Mounted exact `aic_menu.lua -> menu.display` at
`2560x1440` scale `1` is canonical/canonical and `rendered/current`: source text and cyan/green/amber colors survive,
red diagnostics are zero, keep-outs remain advisory, and `Not verified in game` remains permanent. Visual parity is
still red: `3,209,776 / 3,686,400` pixels remain unavailable-gray and the composition does not match supplied `1b`.
Full serial E2E passed `104/104`; precommit passed twice under Node `24.19.0`; graphify refreshed to
`9689/24281/301`; process/port/X4 containment is clean. Implementation commit
`ace6d46f286593443f4fa2dc6fe0b5f6938d4d88` is pushed with remote parity. Next work is truthful diagnostic
presentation plus exact reference reconstruction, then real deploy/X4 acceptance when Ken is awake. Overall B119 stays
`PARTIAL / Not verified in game`; GitHub #41 remains open and exact comment `5369110625` was read back.
**AI Influence `1b` non-dominating diagnostics checkpoint 2026-08-21 — HOST VERIFIED / RECONSTRUCTION PARTIAL:** A
real Paint-family fail-first was `119/120`: source-composition and diagnostic-map both painted uncovered diagnostic
interior `(1,1)` opaquely red and source-composition emitted no boundary. The existing Canvas now strokes clipped
uncovered diagnostic fragments only in source-composition; diagnostic-map remains opaque/default. Final Canvas is
`120/120`; SourceEditor `12/12`, EditorSession `7/7`, Paint `165/165`, Preview `102/102`, Scene `139/139`,
typecheck/lint/build all pass. Mounted exact `aic_menu.lua -> menu.display`, canonical/canonical, `2560x1440` scale `1`
is `rendered/current`: exact opaque unavailable-gray fell from `3,209,776` pixels to `0`, `3,094,646` pixels are
transparent, source colors/text remain, advisory guides project at `x=0.664`, `y=0.74`, and `y=0.788`, and console
errors are zero. All twelve supplied design images plus the vanilla reference were visually inspected. The result is no
longer gray-dominated but still does not match `1b`'s exact hierarchy/composition. Serial E2E passed `104/104`, complete
precommit passed, graphify is `9690/24284/305`, and process/port/X4 containment is clean. Implementation commit
`5a1b922f5344421927e4033522b2b217257788d3` is pushed with local/origin/remote parity. Next work is exact
source/sample reconstruction, followed by the separately gated deploy/X4 proof. Overall B119 remains
`PARTIAL / Not verified in game`; GitHub #41 stays open and exact checkpoint comment `5369666471` was read back.
**AI Influence `1b` Zekton SDF checkpoint 2026-08-21 — HOST VERIFIED / RECONSTRUCTION PARTIAL:** Shipped
`material_library.xml`, `xu_ui_unlit_sdf.xml`, and `ui_unlit_sdf.frag.glsl` prove that Zekton uses
`smoothstep(0.4, 0.6, 1.0 - raw)` with `ALPHA8_ANARK`, while Forge incorrectly staged raw A8 bytes as final alpha.
Causal reds were FontMetrics `10/11` and Canvas `120/121`; the bounded four-file port now passes `11/11` and
`121/121` plus SourceEditor `12/12`, EditorSession `7/7`, Paint `165/165`, Preview `102/102`, and Scene `139/139`.
Mounted exact `aic_menu.lua -> menu.display` is canonical/canonical, `2560x1440`, `rendered/current`, and permanently
`Not verified in game`: tinted atlas rectangles are gone, readable tinted glyph silhouettes remain, exact opaque
unavailable-gray/red are zero, and measured keep-outs still project. Full serial E2E passed `104/104`; build,
precommit twice, graph `9697/24296/309`, process/port/X4 containment, and frozen hashes pass. Implementation commit
`479e21cb07451ae8d0f43e874d20fc10059ce9c9` is pushed with three-way parity. This is not GPU sampling, complete `1b`
composition, deploy-byte, C++ frame, or player-visible proof. Next work remains exact source/sample reconstruction,
then the separately gated real deploy/X4 comparison. Overall B119 remains `PARTIAL / Not verified in game`; GitHub #41
stays open and exact checkpoint comment `5370579401` was written and read back.
**Source-canonical partial edit checkpoint 2026-08-21 — HOST VERIFIED / GAME TRUTH OPEN:** The existing source-edit
owner now privately replays the exact loader-issued canonical color authority across scalar and structural reparses.
Scalar `partial` programs are actionable only with a nonempty all-applied operation stream; partial catalogs still
issue no structural entries. Exact structural colors use the layout owner's closed schema and remap eleven nested
source-literal locations. Real AI Influence in-memory public CAS applied `addTable.x 330 -> 600`, reissued ready source
authority at SHA-256 `9F9E8681...BF1B`, and left the real mod byte-identical. Final focused tests are Layout `622/622`
and Source Edits `74/74`; six adjacent UI suites, typecheck, exact lint, build, oracle integration `134/134`, and
precommit pass. The first tracked full E2E attempt died fail-closed with Windows `0xC0000409`; one targeted `1/1`
boundary check and one controlled retry passed `103/103`, complete receipt `5CE76552...41391`, with clean teardown and
unchanged live-state hashes. Fresh review found no P0-P2 production defect; both P3 proof findings were corrected.
No mod/game/corpus/config write occurred. Commit `743ef85f1d451a8f32c42670e716bffea215cb7d` is pushed with three-way
parity; GitHub #41 comment `5374884567`, Notion, and Drive were written and read back. Exact `1b` reconstruction,
deploy-byte identity, C++ frame acceptance, and player-visible X4 proof remain open. Overall B119 is
`PARTIAL / Not verified in game`; GitHub #41 remains open.
**Source-linked geometry and structural-authoring checkpoint 2026-08-22 — HOST VERIFIED / GAME TRUTH OPEN:** The
existing source owner now issues bounded frame/display block insertion for real assigned-row, multi-table sources,
accepts only direct allow-listed X4 UI construction calls, and requires byte-local CAS, complete reparse, exact
call/operation/owner/kernel-ledger correspondence, and reissued authority. SourceEditor mounts that action and a
separate source-linked Scene geometry panel; the isolated final `BF22DF42...40E44` source renders exactly `17`
height/width diagnostics with exact ranges and `nodeId` owners while retaining
`Layout evidence only · Not verified in game`. Wrapped-text placement and table-background applicability now follow
the shipped source boundary: empty `backgroundID` retains the descriptor fact but emits no Paint fill. Mounted visual
evidence is inspected; focused suites, oracle `134/134`, controlled tracked E2E `103/103` receipt
`E14FB1E3...4B67`, full precommit, production build, graphify `9816/24550/303`, teardown, and live-root parity pass.
Default Node `24.15.0` remains valid red host evidence and the controlled Node `24.19.0` gate remains authoritative.
Exact design parity, real deploy bytes, C++ acceptance, and player-visible X4 proof remain open, so B119 stays
`PARTIAL / Not verified in game` and GitHub #41 remains open. Implementation commit
`959eb680125395148bd5ec969d01ce9685d94cc6` is pushed with local/origin/remote parity; GitHub #41 comment
`5379470924`, Notion, and Drive revision `AIroW35k...F4CF` were written and read back.
**Final mounted-source export checkpoint 2026-08-22 — HOST/EXPORT VERIFIED / GAME TRUTH OPEN:** Read-only parity found
the mounted final source at `BF22DF42...40E44` while both static candidates still held older `C0FC458D...2BC4B`.
Forge's existing package owner emitted exact `BF22DF42...40E44`; a fresh complete 42-file isolated candidate differs
from the prior validated candidate at exactly `aic_menu.lua`. Full `validate:mod` is `VALID`, exit `0`, with zero
errors/warnings and 24 informational static gaps; the real source remains exact `4253D9BD...47DD7`, port/process/game
containment is clean, and receipts are under `dev-docs/b119-ai-influence-dogfood/final-export-validation/`. The candidate
is ready for the separately authorized real-mod deploy/X4 gate. B119 remains `PARTIAL / Not verified in game`.
**P6 Canvas audit rejection 2026-08-19 — FINDINGS / correction active:** The first colour-bearing Canvas candidate is
focused-green at `100/100`, Stage-B `25/25`, production/selftest
`490F430673C51957751A3113C68046A10C811F355A349FDDBC2C064AB119DBB3` /
`CB8D89BEE59294BE7E28BE9CD6171B160ADF8F9AA31784448A50A993AE69D4C2`, with Paint `165/165`, Preview `102/102`,
Scene `139/139`, typecheck, exact lint, and diff hygiene green. Fresh zero-write Luna
`01a019d2-fc1c-7223-b008-ee7a2403ab69` nevertheless reproduced three high producer/consumer mismatches: Canvas admits
impossible string/full-location source pins, omits `sourcePath` from containment, and accepts same-ID mapping provenance
that Scene refuses. Duplicate/reassigned tint facts are also not independently causal-tested. Production now stays
frozen while the two Canvas files receive exact tests-first red coverage and the narrow three-validator repair. The
historical implementation is permanently non-clean because the durable fail-first receipt does not cover all 25 final
Stage-B rows. P7 editor wiring, broad/rendered Forge, mod writes, deploy, and X4 remain locked; overall B119 remains
`PARTIAL / Not verified in game`.
**P6 correction receipt 2026-08-19 — valid red / production repair authorized:** The first correction attempt is
discarded as non-causal because four of six row markers were false and the worker edited production before coordinator
review. The coordinator interrupted it and recovered exact frozen production `490F4306...19DBB3` from the retained
patch preimage. Corrected tests-only selftest `F401AE90...E4351` now gives exact Canvas `107/113`, Stage-B `32/38`, with
six real `mutationApplied=true` reds: string/full-location pins, declaration/channel/key `sourcePath` drift, and same-ID
mapping provenance all incorrectly complete the full render under old production. The exact three-validator repair is
authorized in the two Canvas files; final focused/coupled green plus a fresh zero-write audit remain mandatory. The
premature edit and invalid first receipt are permanent AAR triggers, not erasable history.
**P6 final acceptance 2026-08-19 — FOCUSED VERIFIED / CLEAN:** Replacement Luna
`01a01a8e-7caf-7b61-b62b-0f3cd927616d` produced final Canvas production/selftest
`C7B277D7A471C77A352A184881015E1F3C5C867CE1443108D84CE965D2278B94` /
`FC493F3B263C9A1340A3E2BB264DAFBFDDBB9043CCB265C16343797CAC9CAE9C`. Worker and coordinator passed Canvas
`113/113` (Stage-B `38/38`), Paint `165/165`, Preview `102/102`, Scene `139/139`, typecheck, exact lint, diff hygiene,
and hashes. Fresh zero-write Luna `01a01a94-1779-7d80-965a-cae9d3278d53` returned `CLEAN`, changed no files, preserved
the exact 56-entry / 2,279-byte status digest `A6449981...273A2`, and independently supported every corrected authority,
structural-clone, quantization, withheld-tint, no-colour, and game-truth boundary. P6 is accepted only at focused scope;
its historical receipt defects remain in the AAR. P7 configured colour loading through the existing SourceEditor and
EditorSession owners is now active; browser/package/deploy/X4 remain open and overall B119 remains
`PARTIAL / Not verified in game`.
**P7 revised fail-first 2026-08-19 — `4/19`, implementation authorized:** Production remains exact at SourceEditor
`B085A0A5...5C3C2` and EditorSession `20B74290...AF0`; tests-only are `6213F20B...11D05` /
`09C75353...6D86B`. Existing matrices, typecheck, exact lint, and diff hygiene are green. SourceEditor is `1/12` with
eleven reds across shared-signal dual loading, dual/core-only classification, independent color failure states, hostile
envelopes, request lifecycle, and visible color status. EditorSession is `3/7` with four reds across selected/sampled
owners, catalog/final outcomes, and one-descriptor TOCTOU capture; its facade proves catalog/sample readiness but old
production reads color evidence zero times and emits zero final color owners. Invalid-color no-color degradation,
color-without-core refusal, and game truth are already green. The original SourceEditor Proxy oracle is impossible as
written: safe own-data reflection cannot distinguish a transparent Proxy without invoking traps. Correct that test only
to require one detached descriptor snapshot, zero `get` reads, exact inner identities, transparent-facade admission, and
safe refusal of accessor/inherited/decorated/clone/reassigned/throwing-reflection forms. Coordinator reproduction kept
the same `4/19` census: current production performs eight direct `get` reads and never reaches the intended reflection
boundary, so the revised row is genuinely causal. Implement only the two declared production owners, run every focused
dependency, and require a fresh zero-write audit.
**P7 audit-proof candidate 2026-08-19 — focused green, mounted gate pending:** Production hashes remain SourceEditor
`F4CF7F87...9D662` / `3A90005C...8F5E4` and EditorSession `990B1338...E8213` / `A7FCAAE1...CAC29`. Worker and
coordinator pass SourceEditor `12/12`, Session baseline/P7 `7/7` + `7/7`, CorpusAssets `39/39`, Preview `102/102`,
Paint `165/165`, Canvas `113/113`, Scene `139/139`, typecheck, exact lint, and diff hygiene. Exact core survives an
independently aborted colour branch; transparent/hostile/reflection and one-descriptor authority proofs are green. Two
P7 fixture spans changed `2` -> `1` because the old rows overlapped the expected button cell; expected owners/counts were
not weakened. Sample binding now tracks target plus sample catalog so colour resolution cannot falsely stale layout
samples. Fresh zero-write Luna `01a01af6-6d38-7870-ab01-a4b64912ce08` preserved every hash and gate but rejected strict
acceptance: the tests do not prove concurrent rejected-branch isolation, a revoked Proxy, exact projection/owner/tint
counts, or mounted reload/abort/cleanup behavior. Production stays frozen. Strengthen the two selftests and add one
focused existing-host Playwright lifecycle spec without a new dependency or production hook, then require coordinator
green and another zero-write `CLEAN`. Broad build/install/deploy/X4 remain locked; overall B119 stays
`PARTIAL / Not verified in game`.
Those four test-proof gaps are now implemented in test hashes SourceEditor `59D66E77...F1812`, Session
`71356DBE...C8FED`, and new Playwright `136F6136...D831`; both production hashes remain exact. SourceEditor is `12/12`,
Session is `7/7 + 7/7`, typecheck/exact lint/diff hygiene pass. The loader test requires real overlap plus one rejected
branch, the hostile matrix includes a revoked proxy, and selected/sampled fixtures separately lock exact
`1/1/1/4/4/6/13/32` frame/table/row/cell/widget/text/fact/tint cardinalities and owner multiplicities with mutation
sensitivity. Static review corrected two mounted-oracle false paths without changing production: colour status/detail
are now mandatory exactly-once visible signals, and controlled HTTP 503 assertions use the loader's actual fixed
non-success-response detail rather than an intentionally unparsed body marker. The real-app `ui-designer` Playwright
lifecycle spec is authored but unexecuted pending the mandatory machine-state ask. P7 remains `PARTIAL / candidate`;
no broad/build/install/deploy/X4 gate is unlocked yet.
**P7 second audit 2026-08-19 — FINDINGS / three tests-first corrections active:** Zero-write Luna
`01a01b37-d15d-7cf2-9a16-0be108ffb162` preserved all five hashes, `HEAD == origin/main`, 58 porcelain rows, zero staged
paths, and every focused/type/lint/diff green. It rejected acceptance because the current transport throw is caught into
a fulfilled CorpusAssets failure and cannot distinguish `Promise.all` from `Promise.allSettled`; Paint tint signatures
do not bind exact command `ownerId`; and generation-three unmount does not directly observe cleanup abort before manual
route settlement. Three disjoint exact native Luna owners now correct only SourceEditor production/selftest
(`01a01b44-847d-7ec1-a810-4519dd068fe1`), EditorSession selftest
(`01a01b44-8589-7f02-855f-b31449727aaf`), and the mounted Playwright spec
(`01a01b44-86c4-7dd3-8784-af365ee125f2`). Playwright remains locked behind the machine-state answer. Require combined
focused green and another zero-write audit before promotion; production, broad, installed, deploy, mod, and X4 truth
remain unverified.
**P7 post-correction audit 2026-08-19 — one owner-fallback FINDING remains:** SourceEditor `12/12`, Session `7/7`,
typecheck, exact five-file lint, diff hygiene, the independent `Promise.all` mutant, reflection/game truth, and mounted
signal-cleanup static review passed. Zero-write Luna `01a01b57-696b-7172-ba36-0f8a82c19204` still rejected Session
acceptance because the exact test helper used `command.nodeId ?? command.id`; deleting the real `nodeId` and forging
`id` to an expected owner could pass. The same Session selftest owner is now removing that fallback and adding selected
and sampled delete-`nodeId` mutants that preserve `id`, tint data, cardinality, and the legacy colour-only oracle.
Production is frozen. Require combined static green plus another zero-write audit; Playwright and every broader/live
gate remain locked.
**P7 second post-correction audit 2026-08-19 — preservation oracle still FINDINGS:** Fresh zero-write Luna
`01a01b6a-4ba3-7291-9365-68ab44d3a2db` accepted strict `nodeId` extraction, static owner maps, all focused gates, and
the prior loader/mounted/reflection/game-truth proofs. It rejected the delete-`nodeId` receipt because that mutant first
overwrote `command.id`, then called the value preserved. The same Session test owner must snapshot and retain the real
original own `id`, delete only `nodeId`, preserve tint data/cardinality/colour multiplicity, and prove the legacy fallback
honestly. Production and every runtime/broad gate remain frozen.
**P7 final static checkpoint 2026-08-19 — CLEAN / mounted gate pending:** The corrected Session selftest now preserves
the real geometry-prefixed `id`, deletes only `nodeId`, and correctly observes that the real selected/sampled fixtures do
not satisfy the legacy fallback. A separate honest fixture whose original `id === nodeId` proves the old fallback escape
without manufacturing mutation evidence. Host-native SourceEditor `12/12`, EditorSession `7/7`, typecheck, exact
five-file ESLint, and exact diff hygiene pass. Frozen hashes are SourceEditor
`335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57` /
`3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD`, EditorSession
`990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213` /
`751E520F77EA28E1635A3CD87D63BF6ACFB721942FCA3B610E79A4D2F8DFC7AC`, and mounted spec
`E9D745F18813DFFBFBBC604F67CF603F2B1A0E48BEA635F57DDA1A249BB52DB2`. Final zero-write Luna
`01a01b8a-9132-7a61-92bd-d327e947700b` returned `CLEAN`, changed no files, preserved all hashes, 58 porcelain rows,
zero staged paths, and found no authority or test-causality defect. This promotes only the static P7 candidate. The
focused mounted Playwright spec, ephemeral-stack containment, rendered Forge, broad/package/install/deploy, AI
Influence dogfood, and X4 remain open; product truth remains `Not verified in game`.
**Mounted-harness isolation repair 2026-08-19 — FOCUSED VERIFIED / CLEAN:** Read-only reconciliation proved that the
ephemeral API redirected state/config/discovery but left `X4_DATA_DIR` on this checkout's live `data/` root; the mounted
spec's workspace seed would therefore write recovery/action-receipt/history records outside its sandbox. Luna
`01a01c17-1ae3-7b43-9721-61dcc0a5054c` captured the causal missing-`X4_DATA_DIR` red and changed only
`playwright.config.ts` plus new `scripts/e2e-ephemeral-environment.selftest.ts`. Final hashes are
`E53CBC377066A77E30306A3E384598E2064B889F0B2F9A4B1150B5C8E0843A41` /
`DDC899A834FB7E15B20C2FA9503E77D436AC76262D6624805EB8602762A662B5`; worker/coordinator focused gates pass, and
zero-write Luna `01a01c1e-1cb0-7761-bf22-1dfe8b16c003` returned `CLEAN`. Ken supplied the machine gate. The corrected
lifecycle-aware mounted oracle reached signal IDs `5` and `6` as separate live one-request groups. Cross-layer
reconciliation found this is expected: `main.tsx` derives one `createAbortDeadline` signal per API request before calling
the test observer, while frozen SourceEditor static coverage proves one shared upstream signal. The attempted
owner-transport production repair was falsified by unchanged mounted behavior and fully `REVERTED`; SourceEditor
production/selftest are restored to their exact accepted hashes and `12/12`. Test owner
`01a01c5d-11e9-70c3-b5fa-cbad6bf2b1cc` is now replacing the false identity oracle with the causal contract: exactly two
distinct live request-deadline signals, both aborted on unmount before manual settlement. Exact static/mounted rerun,
containment readback, and a fresh zero-write audit are required before
broad/package/install/dogfood/deploy/X4. `Not verified in game`. Readback:
GitHub #41 comment `5348802753`, Notion reverse-sync property, Drive revision
`AIroW34XpQzBJ5NRIzi9GCDV97S8idXzYqEdJo5jgBbhA6avhPuNrZnFDbj_NfKeK0pP4aXsfotYXFqGjp710FS--upL0orCwd8VErzIcOKS`.
**P7 mounted acceptance 2026-08-19 — FOCUSED VERIFIED / CLEAN:** Final mounted spec
`5ABE7E0235FC41EAD822AC07CF59B403761ADAB2573C764D3DF67B3B1D63AC3E` passed the isolated verdict-parsed run `1/1`.
Receipt `95BD5006AD61E8E16CDDD3B7C66B090634A7DED00E0D2A684052B52ED37B9714` records complete lifecycle teardown,
`treeGone=true`, and no remaining PIDs. It causally proves both distinct request-deadline signals abort on Blueprint
unmount before manual settlement while static coverage owns the shared upstream signal. Coordinator focused gates pass;
zero-write Luna `01a01c7a-34f9-78c1-ab77-61707af2ce94` returned `CLEAN` with exact 59-entry/2,387-byte worktree parity,
zero staged paths, and no false-green blocker. P7 is accepted and broad runtime-oracle/full-E2E/precommit/build/rendered-host
validation is active. Dogfood, deploy, and X4 remain pending; `Not verified in game`.
**Broad oracle fail-first 2026-08-19 — `132/134`, correction active:** Runtime discovery found 134 current oracles; only
`lua-static-selftest` and `project-orchestration-selftest` (`12/14`) were red. Both still encode `addTable(13)` as fatal,
contradicting the accepted source-backed policy: 13-23 warning/unbisected, 24+ blocking. Luna
`01a01c83-fdbc-70d3-bdbb-65890016f6e1` owns only those two selftest modules and must add separate 13-warning and
24-error package/static rows without changing linter behavior. Require focused green and runtime `134/134`; full E2E is
paused. Overall status remains `PARTIAL / Not verified in game`.
The two-file correction candidate is focused-green at Lua `31/31`, orchestration `15/15`, typecheck, zero-error exact
lint, diff hygiene, and worker/coordinator isolated runtime `134/134`. Final hashes are
`04F5820CA77B429626E110EC561E34587207821B7A9F420139B70918990A496E` /
`3376624C5B55B3C9AE0F56ECA7DD06B967012D228B1A5B0134CA8E9698A303AB`; expected worktree authority is now
61/2,454/`A04DB722...A771F`, zero staged. Zero-write Luna `01a01c95-618e-74e3-9f1d-5cf339bf10f9` is auditing; full E2E
remains locked pending `CLEAN`.
Audit `01a01c95-618e-74e3-9f1d-5cf339bf10f9` returned `CLEAN`: no writes, exact hashes/status, focused gates, and
runtime-index `134/134`. The oracle gate is accepted; full serial E2E is active. `Not verified in game`.
**Full E2E fail-first 2026-08-20 — `102/103`, tests-only correction active:** The only red repeated on retry at
`project-browser.spec.ts:203`: a fresh isolated data root correctly returned reference-manifest `scanning`, while the old
test required immediate `ready`. Receipt `D106E146...C7A2`; lifecycle/teardown and complete live-root content parity are
green. Production is not stuck. Luna `01a01cab-4297-77a0-af08-9028c642f2b4` owns only that spec and must prove strict
ready/scanning/stale shape plus project-browser independence, without waiting, timeout changes, quarantine, or production
edits. Full E2E remains failed and locked pending focused green, review, and zero-write audit.
The one-spec candidate is focused 3/3 structured green at
`3E8E8966164E30E0557A9E8F36FF4997F3C6D9FB2E8C2DECD22CE8344DF9E2BC`; typecheck, zero-error exact lint, diff
hygiene, teardown, and 62-entry status containment pass. Coordinator first hit a rejected Windows 3221226505/no-report
launch, then obtained receipt `C9ADC7DD...FA504`. Zero-write audit `01a01cb3-5172-7812-b275-ed55c0bf38c0` is active;
full E2E remains locked pending `CLEAN`.
**Post-restart audit replacement 2026-08-20 — CLEAN:** The pre-restart audit supplied no terminal verdict and was
`not_found` after restart. Fresh native Luna `01a01d16-ae78-7ec2-9247-4afa0e297116` returned `CLEAN` with zero writes,
exact candidate hash, 62 status entries, zero staged paths, `HEAD == origin/main`, hostile public-contract review green,
and fresh-runtime cap `4`; the coordinator captured and immediately closed the terminal worker. The tests-only
correction is focused/audit accepted. Serial full E2E is unlocked only after a fresh machine-state answer; broad
precommit/build/rendered-host, dogfood, deploy, and X4 remain pending. `Not verified in game`.
**Full-suite host failure and rendered-host reconciliation 2026-08-20 — PARTIAL:** Ken supplied the fresh machine gate.
Two exact 104-test serial runs died without structured reports—first after test 18 with Windows `3221226505`, then after
test 22 when the isolated backend disappeared and connection-refused failures cascaded. Receipts
`7F1E29C5...C0E1280` / `B50DCB02...6DC86` remain red; no third broad retry is allowed. The exact dense block at the
second boundary passes `2/2` in isolation with receipt `6B9CB5D...C9742A`; typecheck, zero-error lint, runtime oracles
`134/134`, and production build pass. Isolated rendered production inspection proves the permanent game-truth state,
linter/keep-out/canonical-source surfaces, and fail-closed preview behavior, but also reproduces a stale corpus `Reload`
response after server readiness. Luna `01a0225b-8c20-7be2-b798-b1c41e1ec0c3` owns only SourceEditor production plus its
mounted spec for a causal `cache: no-store` tests-first repair. Full E2E, precommit, AI Influence dogfood, deploy, and X4
remain open; overall B119 is `PARTIAL / Not verified in game`.
The Reload repair is focused-accepted at SourceEditor/mounted-spec hashes `A05F47E6...59813` / `D15C6F42...77E3`:
causal `0/1` (`[null,null]`) became structured mounted `1/1`, receipt `1EBC966B...266F`, with exact live-root parity,
typecheck/lint/diff/build green, and no process residue. First broad precommit then exposed one pre-existing registry gap:
`x4UiScene.selftest.ts` has a unique-temp reparse containment fixture whose exact raw calls are not in
`config/durable-writers.json`; scanner fingerprint is consequently stale. One-manifest-only fixture registration is
active. Scene code, the Reload repair, audit policy, and all real roots are frozen. Full E2E remains red and game truth
remains `Not verified in game`.
The writer manifest is accepted at `AC0240CF...E4CF14`; Scene stays exact and `139/139`, writer selftest/audit is green,
and extension durable-write is `8/8`. Precommit then exposed the required reviewed-authority coupling: routes remain
exactly `82`, surfaces move `55 -> 56` for only `filesystem-writer:src/lib/x4UiScene.selftest.ts`, and 16 later
filesystem surfaces change only their indexed writer `sourceRef`. Guarded candidate generation/promotion plus the single
policy-bundle SHA pin is active in two exact owners; no route, capability, permission, production writer, or test change
is authorized. Full E2E remains failed and X4 remains `Not verified in game`.
Reviewed promotion is complete: manifest `DBF9366E...548FA`, policy pin `07BAA23E...6D27`, and exact three-count selftest
`220B6DD6...C417`; policy bundle is `18/18`, package candidate/promotion is `57/57 + 23/23`, and the complete precommit
gate is green. This does not clear the two retained full-E2E no-report host deaths; no third broad retry is authorized.
No commit/push, AI Influence dogfood write, deploy, or X4 run follows while that required method is red. Overall B119
remains `PARTIAL / Not verified in game`.
**Checkpoint 2026-08-17 (current):** exact 52-path B119 checkpoint
`77138741a9f470e2c6c37c2d6857688dd1e2b13e` remains committed and pushed with `origin/main == HEAD`; the accepted
post-checkpoint source-first delta is still uncommitted inside an exact 45-entry dirty-worktree baseline. Layout passes
`565/565`, Preview `94/94`, Paint `138/138`, and Scene default/strict `136/136` each. Fresh zero-write auditor
`01a00ea1-1ceb-7ad0-9b37-0360caa26e31` returned `CLEAN`: every protected hash and status entry stayed exact, hostile
owner/origin/Proxy/accessor matrices stayed closed, typecheck/lint/diff hygiene passed, and the configured file-backed
MENU/HUB/COMM census executed `3/3` in both modes. All three exact editor sessions now reach non-refused Paint with
zero preview gaps and `canRender=true`; every surface still says `Not verified in game` / `gameVerified=false`.
Batch 8A call-statement/deletion provenance is also accepted at
`E0842D11D156764917DC36740294D43FA7CBCC75089C4B4187E17190DBF4CD4C` /
`7CDB2CA96D5E545E1DAB4CDF44FF874CA507066373C8DBE818E43EBB3977D432`. Fresh zero-write auditor
`01a00eed-8a23-7080-93cd-4217a691df66` returned `CLEAN`: call model `57/57`, hostile boundary probes `10/10`,
SourceEdits `34/34`, Layout `565/565`, lint `112/112`, Scene default/strict `136/136` with configured census `3/3`,
Preview `94/94`, Paint `138/138`, workspace/session owners, typecheck, exact ESLint, diff hygiene, hashes, NUL/newline
checks, and before/after 45-entry containment all passed with no audit writes.

Batch 8B round one is now `FINDINGS / REJECTED / correction active` at SourceEdits production/selftest
`4A2A3DE1E0DA89AF39799BBBC5DF248126B58013CC3750853F1E88FE8DA3EF6F` /
`05C14B3B61E9FF673F1E80D2DBE39D097EA60B99099AA635D55FE7C3AC4BD37B`. Fresh zero-write auditor
`01a00f3e-f4e6-76f0-a8fb-5dbbfe602da9` preserved exact hashes and 47-entry containment and passed the existing
SourceEdits `62/62` plus every coupled focused gate, but reproduced six blockers: receiver spelling substituted for
table/frame identity; foreign-owner payloads were accepted; nested unrelated `print()` / `foo()` calls escaped both
insertion and deletion; successful authority remained caller-mutable; fallback-display could not transition to the
first-row anchor; and fluent `addRow(...)[1]:createText(...)` insertion falsely refused on derived owner identities.
The correction remains tests-first in the same two files and requires exact owner/ancestry binding, complete executable-
call coverage, immutable success authority, causal anchor transition, and owner-relative row/cell/invocation remapping.
The rejected hashes must not be promoted; a new zero-write `CLEAN` is mandatory.

Batch 8B round two is also `FINDINGS / REJECTED / correction active` at SourceEdits production/selftest
`E074705A76469F64E5833329B5A6DB7D8479C78F3B6D3839303AFEABB8C3347A` /
`090A572AAAD5DDDC6629FCD207C8D0FE0B13CE61A77C903BAB739D427ECAD430`. The owner and coordinator reproduced
SourceEdits `62/62` plus causal `16/16`, every coupled focused gate, typecheck, exact pair ESLint, diff hygiene, and
47-entry containment. Fresh zero-write auditor `01a00fbb-2c42-7f61-beb9-cbaf727bd260` still returned `FINDINGS`:
function-literal bodies can hide executable calls; identity remapping rewrites ordinary user strings such as
`@row:999999`; successful results freeze caller-owned nested objects; changed source content retains stale `bytes`
metadata; first-row owner matching omits `frameId`; and the F3-F6 tests do not independently prove their stated
contracts. Reconciliation therefore extends the correction only to the existing SourceEdits and WorkspaceSource
owners: the two SourceEdits files plus `x4UiWorkspaceSource.ts` / `.selftest.ts`. Current status is exactly 47; if both
currently clean WorkspaceSource files are intentionally changed, the truthful final containment is exactly 49. The
round-two hashes remain rejected until causal tests fail first, all findings close, coordinator review passes, and a
new fresh zero-write audit returns `CLEAN`.

Batch 8B round three is likewise `FINDINGS / REJECTED / correction active`. The rejected integrated hashes are
SourceEdits production/selftest
`F83C11B3E997F205C409CE889355A7785A3CBACB4CAEEDB0D77C363A0FDD6918` /
`83C63057A2487C4ECE4941A9419F6CBD1E951790B66C62B6CB837F46B0862DBC` and WorkspaceSource production/selftest
`B56B7A1ADD1AFD52EAFDBC077AF747DD93148CA9A62DAEDFC89CAD096D0F813E` /
`358F0C7837C42B13097EB0D053C0100F8AFEBF1595C19FC855619E5E2D311CFE`. Coordinator reproduction passed prior
SourceEdits `62/62`, causal `18/18`, aggregate `12/12`, WorkspaceSource `5/5`, all coupled focused suites, typecheck,
exact four-file ESLint/diff hygiene, and exact 49-entry containment. Fresh zero-write auditor
`01a0100d-17ef-7ab2-94b3-ce34ef9645c5` still returned `FINDINGS`: raw executable-shape matching falsely refuses inert
table strings containing `foo()`-like text; a generic `{kind, origin, path}` heuristic can normalize arbitrary user
records; deep freeze skips non-enumerable and symbol-owned nested data; and the F6 oracle omits operation metadata plus
kernel `stateBefore` / `stateAfter` from retained-ledger equality. The auditor changed nothing and preserved every hash
and status entry. WorkspaceSource's byte metadata, absent-metadata, Unicode, graph-detachment, and caller-mutation
contracts passed independent probes and are now frozen. The next tests-first correction is restricted again to the two
SourceEdits files; status must remain exactly 49 and another fresh zero-write `CLEAN` is mandatory.

Batch 8B round eight is the current `FINDINGS / REJECTED / correction active` boundary after rounds four through seven
closed narrower correspondence defects. SourceEdits production/selftest
`8E37F18D2E4F0D2E79666CFC1F572DE598BD1BE50080CFC2529589C867139E79` /
`E0F7A257A158E61D440EC49EC0CF185FEE566B9AD7BA8EA85F995161C1332BAE` passed all prior matrices, the new audit
`10/10`, producer-kernel `63/63`, every coupled focused gate, typecheck, exact ESLint, diff/byte hygiene, frozen
WorkspaceSource parity, and exact 49-entry containment. Fresh zero-write auditor
`01a011f7-206a-70b3-ad17-0824cc581eb0` nevertheless reproduced a high false-acceptance seam: retained property,
handler, and alias records can change producer-owned payload fields while the complete-record comparator still returns
equal. Five independent mutations covered property value/path, handler path/context, and alias value. Exact native Luna
`01a01212-e38e-7f12-93d7-9536a6bf2bf2` now owns only the two SourceEdits files for a tests-first, producer-schema-aware
full-record comparison. Its tests-only receipt kept production exact and captured 16 causal reds across a separate
28-row retained-payload matrix; every row proved baseline and mutation application with no throw, while all previous
matrices remained green. The repair checkpoint now has the original matrix `28/28` and expanded permanent matrix
`43/43` green (property 23, handler 12, alias 8), after correcting exact parent-path remapping exposed by 103 temporary
round-seven regressions. Final production/selftest hashes are
`CA4DFD33245A5EE04451E9038AE97A3A342CA5A8DB1C53E1F5215FFC1AF12BB0` /
`D1DB935DFCB43C4DB4FF108950A00A69D043DC5CDEEFEE56479073BD1307FBD9`. Worker and coordinator reproduced every
focused/coupled gate, typecheck, exact lint, diff/byte hygiene, frozen WorkspaceSource parity, and exact 49-entry
containment. Fresh zero-write native Luna `01a01240-6c6c-72d0-9a00-ab9723d3f265` returned `CLEAN` with zero writes. It
preserved exact HEAD/origin, status 49, all four accepted/frozen hashes, and the worktree digest; independently proved
two real-producer public deletion positives with reparse, exact CAS, byte locality, provenance restoration, and `4/4/0`
call/operation/gap counts; passed a separate `5→4` call, `5→4` operation, `22→19` complete-record stream; and passed
hostile retained/boundary matrices `47/47` and `12/12` with one caught Proxy `getPrototypeOf` trap and no other trap or
getter. Supplemental zero-write auditor `01a01254-6064-72c3-b0ca-05137b761e05` agreed on code review, hashes,
containment, and focused selftests but could not run its independent apply harness because of transport/selector
errors; this is a supplemental audit limitation, not a product finding. Batch 8B is `FOCUSED VERIFIED / ACCEPTED`.

The exact real-source receipts are MENU Layout `16 samples (11/5), 66/27 operations, 1/4/9/88 geometry, 95 gaps`,
Scene `1/4/2/16/3/5/7` with `137` diagnostics, Paint `203/165`; HUB Layout `11 (9/2), 18/11, 1/2/2/4, 16`, Scene
`1/2/2/4/0/0/0` with `29`, Paint `44/35`; COMM Layout `5 (5/0), 14/12, 1/1/1/3, 11`, Scene
`1/1/1/3/0/0/0` with `22`, Paint `34/28`. This is faithful layout-preview evidence, not C++ frame acceptance or game
proof. The active tests-first unit is Batch 8C manual screenshot-calibrated keep-outs through the existing
`x4UiKeepOuts` → EditorSession → Paint → Canvas chain—not a parallel overlay system. It must preserve exact screenshot
bounds/hash/profile, normalized points, advisory-only behavior, and `Not verified in game`. Broad/rendered Forge,
deploy, and game gates remain locked. Overall B119 remains
`IN_PROGRESS / PARTIAL / Not verified in game`.

**Checkpoint 2026-08-17 — Batch 8C.1 candidate PARTIAL:** Native Luna
`01a0127c-145a-70a1-9d2c-7a4cc1fb214c` changed only the six documented KeepOuts/EditorSession/PaintPlan production and
selftest owners. Causal matrix moved `6/6` red to `6/6` green; coordinator reproduction passed KeepOuts `17/17`,
but those reds cover only the calibration seam; no Session/Paint end-to-end row was captured red before production
changed. Coordinator reproduction passed EditorSession, Paint `143/143`, Preview `94/94`, typecheck, exact ESLint, and
diff hygiene. The coupled Canvas selftest
is `65/70`: all five failures cascade from one literal-trace mismatch at operation 365 (`expected setFillStyle
#ef4444`, `actual save`) even though rendering succeeds with exact 73 commands and 403 operations. Batch 8C.1 is not
accepted and React controls remain frozen while zero-write auditor `01a012fa-45f9-7371-a895-cd84d13ed486` classifies
oracle versus product cause and audits issuance/context/duplicate authority. External Batch 8B readbacks are GitHub #41
comment `5322307397`, Drive revision `AIroW37jpAOMfCUlSFwOXv_uXS1YYM94MujBar8ureU3U5V06iBJpgWyL2cVfNYsUaiQOAonke94ZCJD-LRJsAjmq6AOtu_0NPuAZQGa1F2m`,
and the Notion B119 page. Overall truth remains `PARTIAL / Not verified in game`.
**Audit rejection and plan delta 2026-08-18:** Zero-write Luna `01a012fa-45f9-7371-a895-cd84d13ed486` returned
`FINDINGS`, with status count 52 and all six hashes unchanged. It reproduced group-wide duplicate failure, wrong
built-in application context, valid manual Paint rejected by Canvas's built-in-only validator, and the legacy no-entry
Paint bypass. It separately proved the five Canvas reds are one pre-existing stale literal-golden cascade at gap command
order 58, not a production regression. Correction is sequential and tests-first: Session/Paint authority, then Canvas
manual-command validation plus independent literal-golden maintenance, then all focused gates and a fresh zero-write
CLEAN. React, broad, installed-host, deploy, and game work remains frozen.
**Correction re-audit 2026-08-18 — FINDINGS:** The four prior findings and stale Canvas oracle are now causally closed:
Session `1/1`, Paint `148/148`, Canvas `75/75`, KeepOuts `17/17`, Preview `94/94`, typecheck/lint/diff all pass. Fresh
zero-write Luna `01a01333-16a3-7371-b5bf-3e53046749da` proved 12 safely-known duplicate cases / 26 occurrences all
refuse with no authority, but observed transparent Proxy containers accepted by Session and Paint. Next is a bounded
tests-first Session/Paint-only correction using browser-safe structured-clone admissibility after accessor guards;
Canvas/KeepOuts/React/broad/game remain frozen pending a fresh CLEAN.
**Proxy contradiction and reconciled correction 2026-08-18:** The strict attempt stopped before production with Session
`3/6` and Paint `150/152`; production hashes remain exact. Portable browser JavaScript cannot simultaneously guarantee
transparent-Proxy identification, zero getter reads, and nonblocking malformed peers. The documented replacement is
detached one-boundary descriptor consumption, not a fake Proxy detector: Session snapshots each candidate before
duplicate/calibration logic; Paint captures exact issued entry/projection identities once and materializes only those
captured values; no caller or Proxy reference reaches downstream authority. New causal TOCTOU rows, facade detachment,
post-call mutation, accessor/trap, and prior authority controls must all pass before a fresh zero-write CLEAN. Canvas,
KeepOuts, React, broad, installed-host, deploy, and game remain frozen.
**Batch 8C.1 final acceptance 2026-08-18 — CLEAN:** The detached-snapshot production repair is Session
`20B7429079DA6C7297A505667C07C1FDD015827839BB468C4412402E7E7D5AF0` and Paint
`4F1F783526D201EBAF1CE0156592CF27924EF40B47EE004446880FB62BF870B5`. A tests-only follow-up closed the first
re-audit's sole remaining oracle gap: every accepted facade/TOCTOU row now enforces an exact zero-get five-field Proxy
trap vector, and both tests reject five synthetic census perturbations while accepting the real vector. Final selftests
are `49C10D546016338A2E482D26D0B48187B0CD53366A7F9D3EC2F0EF613DC6F518` and
`E221AC858AE9FE47C75EC2844DFB0DBD113AD3A7E4D69F073164DA82CE4A7AC8`. Coordinator reproduction passed Session
`7/7`, Paint `153/153` (`14/14` causal), CanvasRenderer `75/75`, KeepOuts `17/17`, Preview `94/94`, typecheck, exact
lint, and diff hygiene. Final zero-write Luna `01a013a2-01a8-7f82-ae3e-66c9d2555399` returned `CLEAN`, changed no
files, and preserved all hashes plus the exact 54-entry status digest. Batch 8C.2 is now active in only the existing
`X4UiSourceEditor.tsx/.selftest.tsx` owner: add session-local manual polygon controls that feed the accepted Session API,
show refusal/provenance, explicitly enable/remove entries, never alter Lua/workspace bytes, and retain `Not verified in
game`. Broad, installed-host, deploy, and X4 gates remain open; overall B119 remains `PARTIAL / Not verified in game`.
**Batch 8C.2 fresh-audit rejection 2026-08-18 — FINDINGS / correction active:** The focused-green React candidate at
`8FF6C50835EE0C6DE1397AA1EDFF1CE480B25B407294BB07A2941DA2EFDC0AA8` / `2F15ED9B12797581B30E765DDBC474C7D8088ABF08D149349BF10EF14C74D79D`
is rejected. Zero-write Luna `01a013de-066a-7172-8006-a450058ce543` preserved all ten supplied hashes,
`HEAD=origin/main=77138741a9f470e2c6c37c2d6857688dd1e2b13e`, and the exact 56-entry status digest
`9EC85F3E3CF4B1010D3CAA68FCE0E438A22FC035FDDDC0D3C1DDD47B363DF2BD`, but independently reproduced row aliasing:
local enablement is keyed by stable ID, so enabling one duplicate checks both rows and toggling its sibling clears the
first. The selftest's historical fail-first hashes are also ambiguously labelled as though current. Original Luna owner
`01a013b5-007b-7da1-ba20-b03b260f5c5e` is correcting only the two React files tests-first: local state must be keyed by
immutable row ID, Session IDs must be derived only after duplicate/parse validation, sibling toggles/removals must be
independent, and historical receipts must be labelled without fabricating a self-referential current hash. Batch 8C.2
remains unaccepted; widget paint is read-only reconciliation only; broad/deploy/X4 gates remain locked.
**Batch 8C.2 final acceptance 2026-08-18 — CLEAN:** Tests-first correction changed only the React owner pair. Final
production/selftest hashes are `B085A0A542D6B17E287DE52CB19452D2E75D67ACA15454274D61D20C3E85C3C2` and
`9FF34E6471C045CB4FC7F3A2CEAF94391548967D8E5BFE2F20D8994F79EFE3ED`. Local enablement is now keyed by immutable
row ID, while the Session boundary derives stable IDs only from parse-valid, unambiguous, enabled rows. Coordinator
reproduction and fresh zero-write Luna `01a013ff-fca7-7c50-bb49-4aba524aee30` passed the component plus Session
`7/7`, Paint `153/153`, CanvasRenderer `75/75`, KeepOuts `17/17`, Preview `94/94`, typecheck, exact lint/diff, and
independent valid/duplicate/malformed/edit/toggle/removal probes. All supplied hashes, `HEAD=origin/main=77138741...`,
and the exact 56-entry status digest remained unchanged. Batch 8C is focused-accepted; widget paint is now the active
unit, and broad/deploy/X4 gates remain open with `Not verified in game` authoritative.
**Widget-paint source reconciliation 2026-08-18 — SPECIFIED:** Read-only source audit corrected the earlier overly broad
color boundary. X4 9.00 ships `libraries/colors.xml` SHA-256
`6A57FE660D546F5144206581A40194CE13D0D11478B584A46467F0AAE715B883` (72,950 bytes) and `libraries/colors.xsd`
SHA-256 `F0D31824E00227EFF6288B084E29346C5AA9D2694BFB0D62D6008EE3DBD879DF` (7,981 bytes): 224 base colors and
804 one-hop mappings form a complete default-theme graph with zero invalid references. Default flat fills and source
literal TOK colors are therefore statically derivable. The current effective C++ map, personal overrides, profiles,
daltonization, glow/material rendering, and active/hover/selection state remain runtime truth. The sequential owner graph
is tests-first CallModel color provenance, CorpusAssets default-map loading, LayoutProgram resolution, then Scene,
Paint, Canvas, and preview/editor integration; no downstream owner starts from an unaccepted upstream candidate.
Native Luna `01a01611-35b0-72c3-86ec-b1e730b5a118` now owns only the CallModel production/selftest pair. Baseline is
`57/57`; it must capture permanent causal color-expression reds before production, then return exact focused/coupled
tests, type/lint/diff containment, and final hashes for a fresh zero-write audit.
**P1 first candidate 2026-08-18 — REJECTED / AUDIT ACTIVE:** Fail-first was `57/65`; final synthetic CallModel is
`65/65`, with LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint, and diff check green.
Actual hashes are production `D314F111E95385D57BF039A85C65360000551EB83C2BCA6B53FCA472FB4DB6B0` and selftest
`C7ABAC0785184B533251EFCB3A0635A2B4C7302F994F324FA269404FF7F8E3FA`; the worker receipt accidentally omitted the
production hash's final `0`. Coordinator real-source probing rejects the candidate: direct stable `TOK.member` colors
remain unresolved in all three production menus (`15/50/27` TOK uses in menu/hub/comm). Fresh zero-write Luna
`01a0162c-5b40-74b2-9ec9-b90b938ecbaf` is auditing that release-blocking mechanism plus hidden/non-enumerable public
evidence, lexical shadowing/mutation, source exactness, freeze, and JSON closure before correction.
**P1 independent audit 2026-08-18 — FINDINGS / correction active:** The auditor matched every candidate hash and green
gate, changed no files, and reproduced three P1 blockers: all `11/35/20` direct TOK members in menu/hub/comm remain
unresolved; hidden non-enumerable projection evidence can drift from the frozen serialized sidecar; and the selftest
explicitly treats `validAlias` as negative while calling hidden omission serializable. Direct BOM-prefixed CallModel input
is a separate P2 boundary already contained by the source-bundle parser sentinel and is not correction scope. Original
Luna `01a01611-35b0-72c3-86ec-b1e730b5a118` is active again tests-first in the same two files: make the sidecar the sole
closed authority and resolve stable inline/alias/TOK member/static-index literals with declaration/channel provenance.
**P1 correction candidate 2026-08-18 — AUDIT ACTIVE:** Causal correction reds were `64/68`; the corrected candidate is
CallModel `68/68`, LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint, and diff hygiene
green at production/selftest SHA-256
`35A75178A444232D0EB41F0D8A65CDEDFFCC15A224467C35AAB121A2BF19EC6C` /
`6DD840BB51E381EB754AB0440C06DBB4BBC846E632CC20FE55FCEEC752323E4B`. Coordinator public-API census over the real
menu/hub/comm sources is respectively `23/15/11`, `56/50/35`, and `29/27/20` for total/TOK-bearing/direct TOK color
expressions. Hub resolves `35/35` and comm `20/20`. Menu resolves all nine declared direct values and correctly leaves
exactly two `TOK.header` uses unresolved at lines 728 and 731 because the `TOK` declaration at lines 211-223 has no
`header` member. The old menu `11/11` acceptance was impossible and is replaced by `9/9 declared + 2/2 exact
undeclared fail-closed`. Independent authority probes find ordinary projections, one frozen/plain/serializable sidecar,
exact use/declaration/channel ranges, and no runtime/default/effective color fields. Fresh zero-write Luna
`01a01654-41a8-7db0-8b9f-8bee0a5d4b43` is the final P1 acceptance gate; P2 remains locked until `CLEAN`.
**P1 final acceptance 2026-08-18 — FOCUSED VERIFIED / CLEAN:** Fresh zero-write Luna
`01a01654-41a8-7db0-8b9f-8bee0a5d4b43` independently preserved both exact hashes, changed no files, and returned
`CLEAN`. CallModel `68/68`, LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint,
diff hygiene, real-source census, authority/freeze/JSON/provenance checks, and hostile alias/mutation/Color shadowing all
pass. P1 is accepted at focused scope. It remains `Not verified in game`; P2 configured-corpus color evidence is now the
active bounded owner.
Native Luna `01a01665-4e66-7712-856a-c4fb35e37b74` owns only
`src/lib/x4UiCorpusAssets.ts` and `src/lib/x4UiCorpusAssets.selftest.ts` for P2. Baseline hashes are
`F08195B48B858F4721A50CA946FA73672F87FD87C923CE5DFBD9D18F32BEC4D2` /
`33D12EF151CDB0163E9AB7CB61E20861C9041733763AF0F994CEB45EE0277F53`, baseline `28/28`. It must preserve the
existing six-asset result shape and configured reference APIs while adding a distinct opt-in canonical-default color
result; LayoutProgram remains frozen until causal red/green, real 224/804 corpus proof, coupled gates, hashes,
containment, and fresh zero-write audit are complete.
**P2 final acceptance 2026-08-18 — FOCUSED VERIFIED / CLEAN:** Production/selftest are
`FFC90BE312FFC3ACA728C039A00F6FE410F291EFBC49C3DF6D9775E24606D818` /
`AB57AE45BCBFB13D8B8A26D02425E4D25297E48874B74831C6F750D707326609`. Fresh audit found and the owner corrected
three real defects tests-first: malformed XML declarations, unbound XSD schema roots, and legacy Lua UTF-8 error-contract
drift (`36/39` red, then `39/39` green). Coupled CallModel `68/68`, EditorSession `7/7`, PreviewPipeline `94/94`, Scene
`136/136`, PaintPlan `153/153`, CanvasRenderer `75/75`, typecheck, exact lint, and diff hygiene pass. The configured-
corpus public loader independently returns the exact pinned 224 base colors / 804 mappings with issued authority and
permanent `canonical-default-only` / `Not verified in game`. Final zero-write Luna
`01a01787-dd5b-7301-ae6d-ed97a1ea72f1` returned `CLEAN`, preserved both hashes and all 56 status entries, and removed its
unique Scene temp fixture. P2 is accepted; P3 LayoutProgram typed color resolution is now the active serial owner.
**P3 first candidate 2026-08-19 — REJECTED / CORRECTION ACTIVE:** Tests-first old `565/565` plus new `4/18` green became
LayoutProgram `583/583`, with every listed coupled/static gate green at production/selftest
`1761BBE388C16FA80C49DE6A1F8D26EAA558221CEBE142B2EFC1C97904DB093A` /
`E6FC8E440953DA665A7E9C748D4AAD8477AADDD4E8093A87C67064FC2D7CEFFA`. Coordinator real-source readback rejects it:
Helper defaults are `row_background`, `text_normal`, and `icon_normal`, while production/tests invent
`cell_background_default` / `icon_default` and use `text_inactive`; the invented IDs are absent from real colors.xml.
The synthetic oracle checks only known status and therefore masks the source mismatch. Fresh zero-write Luna
`01a01860-ac30-73a2-8aef-edfed9e884a5` returned `FINDINGS` with zero writes despite Layout `583/583`, CallModel `68/68`,
CorpusAssets `39/39`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact lint, and diff hygiene all passing. It also
reproduced unrelated non-color gap suppression, semantic color forgeries passing the pure evidence-pair schema, a
throwing `model.colorExpressions` container escaping typed refusal, and a mutation test that inspects the original
program. Genuine 224/804 P2 evidence over the three real menus produced no selected-target color facts; local expansion
self-refused on evidence-catalog reciprocity. The separate downstream audit found PreviewPipeline omits the sixth color-
evidence input and Scene both accepts unissued no-color structural pairs and rejects known color facts; those remain
separate locked owners. Original P3 Luna `01a0179d-1fe2-7962-a07a-d1632e0aebcc` is correcting only the LayoutProgram
pair tests-first. The canonical raw `git status --porcelain=v1 -z` receipt remains exactly 56 entries / 2,279 bytes /
`A644998111590D20DF8AED18DBC79C98F8D78946BED5CA1D8E691EAD861273A2`; the auditor's larger newline-normalized byte
count was not worktree drift. Scene remains locked; overall B119 remains `PARTIAL / Not verified in game`.
**P3 final acceptance 2026-08-19 — FOCUSED VERIFIED / CLEAN:** The tests-first correction retained the rejected
production hash through `579/603` with exactly 24 causal reds, then added a second real-source reciprocity regression at
`603/604` before reaching LayoutProgram `604/604`. Final production/selftest hashes are
`F2E877693DAD16ACF59846E26FEC2BDE8FCE7C69AC1D86623A2F3109D5CD6D17` /
`758C622CF0289F231AF710B9EC8EEB86AAC12773F4B2D1A79757F5B0A03353B8`. Exact shipped defaults/pins, separate Lua-
percent/XML-byte alpha domains, loader-issued P2 admission, color-only gap suppression, hostile sidecar access,
semantic schema closure, actual post-mutation reruns, and ledger-reciprocal expansion catalogs are now causal. The
coordinator reproduced LayoutProgram `604/604`, CallModel `68/68`, CorpusAssets `39/39`, SourceEdits `62/62`, Lint
`112/112`, typecheck, exact two-file ESLint, and diff hygiene. Fresh zero-write Luna
`01a018bf-ac7d-77d1-aae8-0e85571516b0` returned `CLEAN`; its independent no-temp real-corpus probe loaded the genuine
224/804 graph and reproduced MENU `7/35/76/1/25`, HUB `6/10/8/1/1`, COMM `5/14/7/1/2`, zero selected-target known
colors, and valid reciprocal pairs. A coordinated cloned-pair forgery remains structurally valid but fails
`isIssuedX4UiLayoutEvidencePair`, proving the intended semantic-versus-issuance boundary. The audit's first OS-temp
probe was abandoned after the app hid a mandatory approval; zero matching artifacts remained and the no-temp probe
succeeded. P3 is accepted. The active bounded unit is now existing-chain color-authority wiring through SourceEditor ->
EditorSession -> PreviewPipeline plus a disjoint Scene issuance/color-fact consumer repair. Paint/Canvas/editor rendering,
broad host gates, deploy, and game truth remain locked; overall B119 remains `PARTIAL / Not verified in game`.
**P4 final acceptance 2026-08-19 — FOCUSED VERIFIED / CLEAN:** Scene now requires the genuine
`isIssuedX4UiLayoutEvidencePair` boundary before structural traversal, so a coordinated semantic-valid cloned pair and a
hostile descriptor getter both refuse before geometry. Issued P3 colours project as typed, detached facts to exact table,
cell, button/editbox/icon, direct-text, and `setText`/`setText2` owners while retaining raw Lua-percent versus XML-byte
alpha domains, provenance, expression, source/pin/sample identity, and permanent `Not verified in game`. Known base tint
removes only its legacy unavailable-base-colour gap; material/texture/glow, runtime state, C++ map/profile/daltonization,
font-raster, and game-frame uncertainty remain explicit. Mapped unavailable colours now receive exact owner-linked paint
gaps without invented RGBA. Initial fail-first was `136/138`; the fresh-audit correction reproduced `137/139` before
final `139/139`. Final production/selftest hashes are
`FE85C52848C7643EA6B5195FCA4C4270E7036F763BE756CB48327D599050BF99` /
`34A4D496C968366A18DB6023D2F6BD91F50C2C1A066F6D75BC0944F49FF35C8F`. Coordinator Scene, typecheck, exact ESLint,
and diff gates passed; final fresh zero-write Luna `01a01938-d17c-76a2-9e17-d910b66e9e80` returned `CLEAN` with no
findings or writes. Reconciliation proved P5 cannot be publicly tested yet: Paint accepts only Preview-issued Scenes,
while Preview omits LayoutProgram's sixth colour-authority input. The active bounded prerequisite is P4.5 Preview colour
ingress, followed serially by Paint, Canvas, configured SourceEditor/EditorSession loading, broad gates, deploy, and X4.
Overall B119 remains `PARTIAL / Not verified in game`.
**P4.5 final acceptance 2026-08-19 — FOCUSED VERIFIED / CLEAN:** Preview now safely captures the optional loader-issued
colour authority as an own data value and forwards that exact identity only as LayoutProgram argument six. An issued
synthetic authority with the pinned 224-base / 804-mapping shape reaches exact raw-domain LayoutProgram facts, every P4
Scene owner, and Preview's existing private Paint authority; omitted evidence preserves no-colour behavior. Structural
clones, forged/mutated/stale/unissued values, accessors, inherited/symbol fields, and a Proxy cannot become authority or
execute hostile observation. Baseline `94/94` plus new tests against unchanged production produced exactly four reds at
`98/102`; final Preview `102/102`, Scene `139/139`, LayoutProgram `604/604`, typecheck, exact ESLint, and diff hygiene
passed. Final production/selftest hashes are `CF429EB982BED6C424DCB778AC7D184EBABDA4C9330364DAC12431BCA223CA82` /
`5D85E9810C9776B87D24A8EFFF6AF57740534998E0D4AC8C7B3EEABEFA328324`. Fresh zero-write Luna
`01a01955-12ed-73a2-9c8e-06b8a4130d8b` returned `CLEAN` with no findings or writes. P5 Paint base-tint projection is now
the active serial owner; Canvas, configured loading, broad host gates, deploy, and X4 remain locked. Overall B119 remains
`PARTIAL / Not verified in game`.
**P5 final acceptance 2026-08-19 — FOCUSED VERIFIED / CLEAN:** Paint now consumes only the exact P4.5 Preview-issued
colour Scene and projects all ten owner-linked facts as immutable `base-preview-tint` payloads. Geometry retains every
table/cell/button/editbox/icon/text fact; each glyph carries its exact parent primary/secondary text tint. Raw Lua-
percent and canonical-XML-byte alpha domains, full provenance, source identity, and residual runtime/material/state/
glow/C++/font/game diagnostics remain separate. Colour-bearing plans stay `partial` and `Not verified in game`; omitted
colour keeps the previous command shape. Baseline `153/153` plus tests-first expansion produced exactly six reds at
`159/165`; final Paint `165/165`, Preview `102/102`, Scene `139/139`, typecheck, exact ESLint, and diff hygiene passed.
Final production/selftest hashes are `9FDBE53D68F516DD36670ABC1DF75F65611F81C3EA34E99BEA546EE905005A85` /
`A0680C4B1B748695EE59BB63858B11A7693D3721CE2F09BB8C101E46B46799BF`. Fresh zero-write Luna
`01a0198b-0877-76e2-b229-988ca8ce9e7b` returned `CLEAN` with no findings or writes. P6 Canvas is now the active serial
owner. Its current `70/75` is a stale trace-oracle cascade from two accepted P4 diagnostics, not tint-render proof; P6
must first correct that oracle with production frozen, then capture genuine colour-path reds. Configured loading, broad
host gates, deploy, and X4 remain locked. Overall B119 remains `PARTIAL / Not verified in game`.
**Checkpoint 2026-08-14 (historical):** Batch 7D remains `FINDINGS / correction active`; broad and game gates are locked.
Round four passed the focused editor families at `41/41 + 10/10 + 2/2 + 29/29 + 8/8 + 27/27`, source edits `34/34`,
preview `89/89`, linter `112/112`, typecheck, and exact lint. Its hashes
`E2B2D665...5D6392` / `74A48DA0...1B21DB` / unchanged UIBuilder `7132FBDC...32B0A` are rejected after fresh zero-write
audit `01a002bd-1b13-7a11-8aaf-d8df3ae0e5bc` found an untested stale event-handler seam. An old E stage/apply callback
can run after live context/draft R, erase R state or apply E authority, then mislabel the result as R. The first resumed
Round-five lane stopped with zero writes after a hung Agent Brain recall and missing native-Luna runtime proof. Correctly
routed native Luna `01a00365-95a3-7be3-9f9a-3f6d5acac624` then captured all 72 new stale-handler rows red and returned
candidate hashes `C7D1ABB7...E96294F2` / `0D061E8D...F3CEB7D`; coordinator reran every old/new editor family,
typecheck, exact lint, and frozen UIBuilder green. Fresh hostile zero-write audit
`01a00378-8f7b-7883-a2ec-a30b1cb72e4c` rejected the pair with two causal apply-callback escapes: reentrant parent
`flushSync` state can be overwritten by the old unconditional pending update, and same-context/same-submission
fulfillment or rejection can clear a newer staged draft. All hashes remained exact and the auditor wrote nothing.
Round-six native Luna `01a0038b-4666-7171-b39c-32f761da501c` is tests-first in the same two files; UIBuilder remains
frozen. A fresh `CLEAN` is required before precommit/oracle/E2E/build/rendered Forge or X4 testing. Live read-only Antigravity evidence
does confirm the saved unpacked corpus root and browser loader resolve the exact Helper/widget/Zekton asset hashes.
Coordinator real-source census then found a separate critical blocker: all three exact acceptance targets currently
return `canRender=false`. Menu refuses on non-unique source-bound local invocation identity; hub and comm refuse on an
over-strict direct-layer `sourceLiteral`/location relation. Green `542/542` synthetic layout tests did not cover these
shipping shapes. A disjoint layout-program tests-first correction is now required in parallel with source-editor Round
5. That correction is coordinator-green at `548/548` and closes all three layout-program refusals: the exact live menu,
hub, and comm programs now return `partial`. The same production session census exposed the next cross-owner blocker:
Scene independently rejects each issued pair as `malformed-structure`, leaving all three `canRender=false`. Scene native
Luna `01a00352-510b-71a0-9841-fc54c1e6e92b` reproduced exact `model-order` and `row-reciprocal` failures and returned a
two-file candidate at `ADE6C8E6...49CE5C3` / `9C021463...2C80707`; coordinator reran Scene `122/122`, typecheck, and
exact lint green. Scene auditor `01a00381-f62a-7a11-92cb-20c5009174b8` found no causal defect across 72 hostile probes
and accepted real hub/comm geometry, but correctly withheld `CLEAN` because the concurrent layout dependency changed
mid-audit and its snapshot caught temporary layout-test type errors. Those errors are now fixed; a zero-write parity
rerun against stabilized layout hashes returned `CLEAN`: Scene `122/122`, full typecheck, exact lint, all 72 hostile
outcomes, and all four dependency hashes passed. Scene is focused-accepted; source editor and layout still require their
own fresh audits and exact three-menu census before rendered Forge starts.
The exact session-issued sample path further separates the failures: hub and comm materialize 2/2/4 and 1/1/3
table/row/cell nodes respectively before Scene rejects them, while menu self-refuses in layout validation on a
conditional `setColSpan` `cellId` relation after 16 accepted samples are consumed. Fresh zero-write audit
`01a00353-6779-70e3-a4bf-743157508f31` independently reproduced the exact `malformed-profile` failure at line 726 /
model order 219 after a corrected consumer-aware `span=6` rerun; the invalid blanket `span=80` harness remains discarded.
Both hashes and all 548 prior checks remained exact. The resulting `549/549` candidate at
`EE6A58C1...C61AA3` / `A9295A27...C1016` is rejected. Fresh zero-write audit
`01a003a1-f051-7c32-98b9-f98382a7211a` preserved hashes and passed typecheck/lint plus hostile `11/11`, but exact sampled
`aic_menu` still self-refuses. Its direct positive is causally wrong: the expected 12-column `ct` materializes while the
conditional `setColSpan` closes over the earlier 4-column `tt`. Tests-first native Luna
`01a003bc-cf99-7913-bff4-d1b9ced8e455` owns the same two files and must bind exact issued source ownership without a
source/index special case or weakened schema, then pass live three-menu census and a fresh hostile audit.
That repair reached a genuine `548/549` fail-first and a coordinator-green `550/550` candidate at
`AE6C49A4...BAE30A` / `11E5CE76...E7BC12`, but two independent zero-write paths rejected it. Native Luna
`01a0076a-f9ab-7c41-a395-b2f8f9b6478e` then captured the five reproduced mechanisms plus three exact ledger-order
controls as eight causal reds (`550/558`, fixtures `8/8`, zero throws) before changing production. The current candidate
is coordinator-green at `558/558`, typecheck, exact lint, and zero hostile acceptance, with hashes
`9B7A4836...051210` / `9F8F3B27...FA444C`. It independently resolves deferred table/row/cell owners, binds source
receiver/result identities, orders reciprocal ledgers, and consumes final Helper/kernel `reserveScrollBar` state.
Coordinator reproduction caught and corrected one stale worker receipt: the final test edit initially introduced
`TS2367`; a tests-only predicate rewrite restored typecheck without changing the 558 checks or production hash. Fresh
zero-write Luna audit `01a00796-c378-7d80-bcad-452cd290213b` rejected the candidate at the real-source gate. With the
canonical configured corpus, exact installed/workspace sources, `1920x1080`, UI scale 1, and consumer-aware samples,
all three sessions still return `canRender=false`. Menu self-refuses because a program cell operation source reference
does not identify its owning cell. Hub and comm emit `partial` programs (18 and 14 operations; geometry `2/2/4` and
`1/1/3`) but strict Scene refuses both as `malformed-structure`; paint is not reached. The hostile matrix refused
cross-cell substitution, forged earlier-sibling ownership, and reversed table/row/cell ledgers without throws, and
zero-write/hash parity held. No rendered Forge or game gate unlocks until a tests-first correction makes all three
exact sessions reach paint with `canRender=true` and a new audit returns `CLEAN`.
Follow-up zero-write audit `01a007cf-8266-7df3-a083-e1a9af631564` narrows menu to a high-confidence producer owner-
identity mismatch: `operation.cellId` resolves to a cell whose identity is absent or differs from its emitted source
reference. Exact operation fields remain unknown. Hub/comm first Scene stages remain unknown because
`validateProgramStructure` discards the stage; their producer-versus-Scene split is provisionally `60% / 40%` and must
be instrumented before repair. The post-checkpoint sequence is tests-first and serial: menu owner binding, then exact
hub/comm structure mismatch. Ken confirmed the machine quiet at the Antigravity-running/X4-stopped process baseline and
ordered the exact partial checkpoint commit; 28 excluded dirty entries remain untouched.
That first precommit run stopped before staging on capability authority. Two bounded guard fixes pass direct selftests
`7/7` and `11/11`, typecheck, and diff checks. Ken then authorized exact candidate
`C2B4AE641B0C849F2348E8241BAEEEA5F64BA49213CCD6E34E2E4B6323F227C5`; native Luna promoted it into
`config/forge-route-dispositions.json`, and the final manifest hash matches the candidate. Its only semantic additions
are four route-source entries and public `GET /api/agent/x4-ui-integration-selftest`; capability/MCP/dynamic signatures
remain unchanged. `npm run test:capabilities`, typecheck, manifest diff hygiene, and the complete machine-state-authorized
`npm run precommit:check` now pass. The exact checkpoint is 52 paths and retains all 28 exclusions. GitHub #41 comment
`5304942931` and guarded Drive revision `78` are read back; the two prior Notion write receipts remain absent from a
fresh all-comments read, so Notion stays `PARTIAL / UNVERIFIED` and no third blind write is authorized.
Source-editor Round six has
now reached causal fail-first with production frozen: 82 named reds cover all eight reentrant authority fields, every
prior receipt state, fulfillment/rejection, draft-only callback drift, and repeated-updater idempotence; its independent
control remains `4/4`. Its bounded candidate is focused-green at `5154A1BB...7D004` / `B5702729...04A81`: all prior
matrices plus Round-six `64/64 + 16/16 + 2/2`, exact lint, source edits `34/34`, preview `89/89`, linter `112/112`, and
editor session pass; UIBuilder remains frozen. Fresh zero-write auditor `01a0039d-838e-78d3-8ddf-fdb2ef061e68`
returned `CLEAN`: it changed no files, preserved source-editor/selftest/UIBuilder hashes, and passed reentrant `64/64`,
draft-only `16/16`, settlement `2/2`, acknowledgement `24/24`, callback-acknowledgement `9/9`, the complete selftest,
and exact lint. Source-editor Round six is focused-accepted. Full repository typecheck is green after the concurrent
layout test's narrowing errors were cleared.
Unsampled `partial` status is not render-readiness evidence.
Even if the active exact layout audit and three-menu session census are clean, B119 does not close at the first game
smoke: source-canonical visual manipulation/direct-call insertion, manual calibration UI, shipped-source button/edit-
box/icon paint, exact deploy-confirm truth integration, and three screenshot parity comparisons remain required.
**Checkpoint 2026-08-17 — Batch 8B round seven rejected:** SourceEdits candidate
`509D8477...9B881F` / `06628B88...F7D4C` passes every declared focused suite through round seven `125/125`, Scene
`136/136 + configured 3/3`, Preview `94/94`, Paint `138/138`, typecheck, lint, and diff hygiene, but fresh zero-write
auditor `01a01160-a980-7b23-a1f6-64dd37839b1c` returned `FINDINGS`. A valid `createText` deletion falsely refuses
`reparse-provenance-drift` because the comparator subtracts removed relevant calls while the producer's `call.order` is
global across calls, properties, handlers, and aliases. Kernel `stateBefore/stateAfter` also lack complete closed
producer-schema validation. The exact 49-entry worktree and frozen WorkspaceSource hashes were preserved. The next
tests-first correction owns only the SourceEdits production/selftest pair; Batch 8C, keep-out calibration, broad gates,
deploy, and game proof remain locked. Truth remains `Not verified in game`.
**Checkpoint 2026-08-11:** Current continuation is `IN_PROGRESS / PARTIAL`. The source-correct linter now passes
112/112: row-budget evidence uses Helper's actual maximum cell geometry, `affectRowHeight=false` contributes exactly
one, unknown UI scale and auto-frame boundaries produce gaps instead of raw-unit warnings, and the measured 24+
whole-frame refusal plus every existing trap remain intact. Its corpus harness remains 12/12; the configured public
manifest census remains 81/81 reads, zero read failures, zero unexplained/applicable fatal findings, six trusted-official
online-call findings marked not applicable, six warnings, 70 unverified files, 22 bounded-detail truncations, and
13,123 bounded gaps. Analyzer -> project validation -> flat diagnostics -> existing IDE Problems passes 7/7 plus
11/11 mapper checks, and package/export/deploy artifact-ID parity passes 9/9 plus independent resolver probes.

The ordered raw-source/CAS bundle is accepted; the source-ported layout kernel is 29/29; shipped Zekton `.abc` plus
1024x2048 A8 DDS decoding is 10/10 with provisional metric interpretation; the call model is 46/46; keep-outs are
16/16 with only y=.788, y=.74, and x=.664 measured. The configured-corpus browser loader is 23/23 and binds exact
Helper/widget/font hashes through existing `/api/reference/*` endpoints; the live endpoint is unavailable after the
power outage and was not restarted. The ordered layout program is focused-accepted at 80/80 with exact-range samples,
renderer-ready descriptor facts, exact direct scaling, exact local-helper/Helper-alias expansion, immutable target
isolation, and permanent `Not verified in game`.

The imported-workspace source adapter is now focused-green: it reuses `ModWorkspace.passthroughFiles`, preserves
generated-file shadowing, and performs accepted source edits through a second exact CAS without a parallel source
store. Its focused/source/lint and independent source/shadow/stale/identity probes pass; repository-wide typecheck now
passes after Batch 4C settled.

Batch 4D is focused-accepted at call model `46/46` and layout program `80/80`, with kernel `29/29`, linter `112/112`,
source/corpus regressions, typecheck, and targeted lint green. It recognizes only the exact production
`local Helper = rawget(_G, "Helper")` idiom and bounded same-file local helpers; shadowing, dynamic keys, conflicting
reassignment, loops, unsupported calls/returns, recursion, and limit overflow remain non-applied. Installed/workspace
hashes for all three acceptance Lua files match. The deterministic selected/sample census reports menu direct/root/
expanded/sampleable/selected tables or invocations as `4/36/23/13/7`, hub `2/9/7/2/0`, and comm `1/8/6/1/0`; none of
the seven selected menu tables is applied, and every model still reaches the 128-gap cap.

Batch 5A is focused-accepted at font `10/10`, text `8/8`, corpus `28/28`, with exact pinned hashes and zero-warning
targeted lint; it projects shipped-Zekton glyph quads without browser fonts, while wrap/truncation remains provisional
until game parity. The layout program plus separate evidence authority is independently CLEAN at `109/109`, superseding
the earlier `84/84` producer. Batch 6A remains active and `PARTIAL`. Its eighth-audit `108/108` scene candidate was
rejected for 50/121 source-valid per-field refusals, selected-expansion refusal, blocked-addRow misclassification, weak
creator-fact reconciliation, non-exact gap ordering, and undetected removal of a real no-op operation. Reconciliation
therefore split the correction: first add a producer-issued complete call/gap manifest to the accepted layout-program
owner, then make scene validation consume that authority instead of re-deriving it.
The first embedded-manifest attempt reached `92/92` but failed independent audit because coordinated mirrored rewrites
still validated. The corrected contract uses a separate frozen producer authority and explicitly does not claim that an
unsigned self-contained JSON clone can authenticate coherent replacement of both trusted inputs.
The second attempt reached `101/101` but also failed independent audit: expansion ledgers and reciprocal node membership
were not paired, reachability mapping was open, freeze was mislabeled as origin authentication, and the permanent
rejected-family test allowed unresolved substitutes. Deep-freeze is now explicitly immutability-only; producer origin is
an internal call-path boundary, not serialized data.
The third attempt reached `105/105` and passed 123 independent substantive attacks but exposed one malformed-node throw.
The final fail-first correction moved `105/109` to `109/109`; the independent audit returned CLEAN with 28/28 malformed
node attacks failing closed, all 71 core and 52 selected-expansion attacks rejected, and intact positive families green.
Producer authority 8A's structural checkpoint was independently accepted, but the later scene audit reopened its
consumer-completeness boundary. The first Scene 8B candidate reached `115/115` but was contract-rejected: it still
reconstructed gap categories from reason strings; pair-valid creator/frame/table/cell mutations changed visible output,
geometry, or provenance; a source-incomplete no-op setColSpan compatibility form was accepted; and 77 bare-program calls
across 31 negative blocks stopped at the wrapper gate. The two-file correction reached `117/117`, preserved the exact
`122 generated / 121 retained / 110 unresolved / 11 rejected` matrix, and passed every focused dependency/type/lint
gate, but the fresh independent audit returned `FINDINGS`. With unchanged authority and a pair-valid result, coherent
operation/node mutations and secondary-text/source/affect facts can still alter scene output. All four intact scaled
creator kinds falsely refuse because raw height is compared directly with finalized scaled height. Omitted-width overflow
is also inconsistent: shipped Helper returns `-10`, the producer clamps to `0`, and the scene recomputes `-10`, accepting
only text through a compatibility exception. AST census further found 79 negative calls across 32 blocks that stop at the
pair boundary instead of their named scene check. Candidate hashes are
`6F7623123EEA79E8D41DF94EE0093F3ABDFAC8EE9FF159DAA124EA6F2FD4E2EF` and
`5CED7BE87648CA08165052DF09A45449034793E6DC19CB66CC3C22B78AC01453`; they are rejected. The next bounded work is
sequential. Producer 8A.1 reached local `121/121`: authority schema v2 binds complete operation/node snapshots, uses
cycle-safe exact structural comparison, and preserves Helper's exact negative omitted width. Its hashes are
`0C1BF98C36C9F9C8E4FF0EE8AB37D5450FA086AE4F5DCFE4BB605874E72E4FFB` and
`2D2DC516F608DC65D486C275D62EC7A9C8CAC695F34ED8E1A4636A44A7E7C55C`; a targeted independent audit rejected them.
Malformed/non-JSON one-sided program-root/profile mutations and coordinated malformed operation/node snapshots can still
return pair-valid because the complete program and snapshots are compared without closed recursive schema validation.
Scene 8B.1 was frozen with its partial edits preserved. The next bounded work is producer-only closed-schema validation
plus permanent regressions for every reproduced case, followed by producer re-audit, then resumed scene scaling,
negative-width partial geometry, and pair-valid oracle repair. Scene 8B remains `PARTIAL`; Batch 6B/6C must not start
until another independent four-hash audit returns CLEAN.
The frozen scene hashes are `73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. An intermediate correction reached `117/117`,
but the latest state after new scaled/four-kind overflow fixtures was interrupted before a result; those hashes are not
acceptance evidence.
Producer 8A.2 is now locally green at `172/172` after exactly 50 new regressions first moved `121/171`; focused
dependencies, typecheck, and owned lint pass. Candidate hashes are
`85B57D010BE2408455CC17866DF486B852AEE63B4B860DB94BB94D0CE64FA1B9` and
`BFFAE765C98591AA01724FE879CC09B2276D1311930E8726831D96F8288BAC60`. Independent re-audit returned `FINDINGS`.
It confirmed that all original 15 root and 37 coordinated operation/node attacks are now closed, but intact producer
`fontsize/editBox` semantics, full local parameter/result identities, nil literals, and a legitimate kernel groupIndex
can falsely refuse. Coordinated malformed row-group/diagnostic, provenance, value/reference/gap/failure union,
transition, height, and metadata-property shapes can still return pair-valid. Cross-owner scene integration is red at
`104/119` with 15 failures: 13 valid producer cases falsely refuse on real `metadata.semantics` fields such as
`fontsize` and edit-box data, and two unfinished scene scaling/negative-width cases remain red. These hashes are
rejected. Producer 8A.3 exact-schema repair is assigned with fail-first regressions for every finding; Scene 8B.1
remains frozen until correction and fresh re-audit. The complete 8A.3 matrix is now installed: against unchanged 8A.2
production it exited `1` at `179/195`, reproducing 16 intended false-accept/false-refusal cases before the validator
repair. The repaired producer candidate is `205/205`; focused dependencies, typecheck, and owned lint pass. Coordinator
read-only scene integration is `117/119` with all 13 producer-schema false refusals closed and only the two frozen 8B.1
behaviors remaining. Candidate hashes are `956E00392EF26854B1B6AC52759E9C6C4AA8A312A4F181F1C66FCF3C8F17683F` and
`78F768A48F420B3C000C2FCA4FF82DE1094A6DF1A2A62986448D0EA12ECF5BE3`. No 8A.3 candidate is accepted yet; fresh
independent producer re-audit returned `FINDINGS`. All prior attack matrices remained closed with zero throws, but 17
of 157 successfully executed malformed cases stayed pair-valid: seven impossible value-member discriminants, four
impossible kernel states, one rejected-transition continuity drift, and five property/source identity drifts. The
candidate hashes are rejected. Producer 8A.4 is assigned with fail-first regressions for all 17; Scene 8B.1 stays frozen
pending correction and another independent `CLEAN` audit. The 8A.4 permanent matrix is installed and fails first at
`208/225`, exit `1`, with exactly the intended 17 cross-field escapes; positive signature/kernel/source censuses remain
green. The repaired 8A.4 candidate is `225/225`; all focused dependencies, typecheck, owned lint/diff, and frozen scene
classification pass. Candidate hashes are `513557DFA4DEE70162A43E6EEDF57DAB07A1A815D1090D5814D312DE284B476E` and
`33CD3D5784E2457356F769C573B631B833B79A936EBDC506BC46E69392F1EEED`. Fresh independent emitted-invariant audit
returned `FINDINGS`; these hashes are rejected. All prior 17 corrections and all earlier attack matrices remained
closed, but 38 of 154 successfully executed malformed cases returned pair-valid: 14 impossible successful profiles,
four impossible kernel states, eight call-model-unemitted value signatures, and 12 parameter/local-result/property/
literal identity drifts. Producer 8A.5 is assigned with fail-first regressions for all 38 plus emitted-positive guards.
Its fail-first checkpoint is exact at `228/266`, exit `1`: all prior 225 checks plus three new positives are green,
exactly the 38 intended assertions are red, zero validator calls throw, and the production hash is unchanged. Production
repair first reached `267/267`, but coordinator review found that the direct-literal test covers a property instead of
the audited operation argument, the complete normalized profile is still not authority-bound, the truth-grade positive
blesses one-sided profile drift, and expanded source identity remains static-status-only. The `267/267` hashes are
unaccepted. Coordinator-review fail-first is now `269/281`, exit `1`, with exactly 12 intended reds: three direct
arguments, five valid-profile drifts, two recomputed parameter identities, one local-result identity, and one non-static
expanded-source identity; all other 269 checks are green. The review-corrected candidate is coordinator focused-green at
`281/281`; all focused dependencies, typecheck/lint/diff, and frozen scene `117/119` classification pass. Exact hashes
are `0E0DB9645655AD02087B785B9282B22434B02CF4544479DD923ACA4AEFD91989` and
`FECD2E138BE4C8CD001AAF891C54B36F50017C8E94853721D2D19C81602AAF4A`. Fresh independent four-hash audit is required;
the candidate is not accepted and Scene 8B.1 remains frozen. The active audit has now reproduced a source-backed
local-identity completeness/order defect: `11/15` focused one-sided authority mutations remain pair-valid, including
function/invocation/parameter reordering, removal of an unconsumed function/invocation pair, parameter cardinality or
containment drift, altered unconsumed invocation text, and an extra source-shaped invocation. The original 38 and the
13 coordinator-review mutations now all refuse with zero throws. A second P1 gap accepts four coordinated kernel/table
snapshot drifts (`uiScale`, `scrollbarWidth`, kernel `frameWidth`, and table `frameWidth`) while the original profile is
unchanged. The `281/281` hashes are rejected; final audit counts and the exact 8A.6 fail-first correction contract are
now fixed by the completed report: `193` malformed probes, `178` refused, `15` pair-valid, zero throws. Producer-only
8A.6 Phase 1 is coordinator-accepted at exactly `285/300`, exit `1`: all prior 281 checks and four malformed local
controls green, exactly the 11 local-identity and four profile-correlation attacks red, and zero throws. Production and
Scene are unchanged; the selftest hash is
`78A33FB00032BE65D0EABA58F978A11422AA15281603C530C89CE8A1ABECE8C8`. Phase 2 now adds the exact detached
program-side local-identity ledger plus profile-to-kernel/table reconciliation. Its first candidate reached `302/302`
but is coordinator-rejected: five coordinated owner-topology mutations still pair-validate when a table points to no
frame, its owning frame loses width, reciprocal `frame.tableIds` is removed/forged, or `table.frameId` is deleted while
owner-derived state remains. The five permanent fail-first regressions are now coordinator-accepted at exact `302/307`,
exit `1`, with all existing 302 green, zero throws, production unchanged at `046E6E1F...`, and selftest
`B578959049861FA8FA571C6900D6B276FA640FE28D1BFEA2AB794D00030375B2`. Repair reciprocal frame/table/state ownership
only after the remaining owner-path consistency review. Scene 8B.1 remains frozen pending a fresh independent `CLEAN`
audit.
Owner-path review has now reproduced five additional pair-valid internal contradictions: coherent same-width frame
reassignment despite the original addTable receiver, mismatched operation frame/table owners, table identity parent
drift, a known table listed by a second non-owner frame, and reversed owning-frame table order. A duplicate child ID
already refuses. Add exactly these five tests without production edits and capture `302/312`, exit `1`, before the
topology/source-relation repair.
The final Phase 2A.1 oracle is coordinator-accepted at exact `302/312`, exit `1`: all existing 302 checks green,
exactly ten owner assertions red, zero throws, production unchanged at `046E6E1F...`, selftest
`DF840B851CB0DDEC61479325FACD4DA60FD0A2A5965524BAC78851530A7DDE44`, and Scene hashes unchanged. Phase 2B may now
repair exact ordered reciprocal topology plus addTable receiver/result and operation-owner consistency, followed by a
fresh independent audit.
Phase 2B is now coordinator focused-green at producer `313/313`, all focused dependencies/type/lint/diff green, and
frozen Scene exactly `117/119`. Candidate hashes are `766F24C11EF572DF603EFB31F3091A327B4B95AFA7505EED1A365D1A5837032E`
and `AD74133867DC07D82AFF94C982AB2E8AC524CE7DE363EFD18769792F010A51E5`. These hashes are rejected: a coordinator
read-only probe coherently assigned the ownerless unresolved `addTable` operation to its unresolved frame across both
program and authority operation/frame ledgers, deep-froze both artifacts, and still received pair-valid while the table
remained ownerless. An exact all-kind follow-up then reproduced 42 coherent extra-owner injections and 20 coherent
required-owner removals that still validate after mirrored ledgers and deep freeze. The missing boundary is exact
per-call owner shape and parent-chain reciprocity, not one ownerless special case. Five coherent sibling reassignments
also remain pair-valid across frame creation/display, width setter, row creation, and cell specialization, proving exact
call receiver/result identity must bind every owner-bearing operation. The completed independent audit confirmed these
families and returned the additional findings below. Producer-only tests-first correction and another fresh `CLEAN`
audit are required before Scene can resume.
The rejection is synchronized and read back at GitHub #41 comment `5267795155`, the canonical Notion page, and Drive
revision `AIroW34qrzuZ10l7F3_287sctfd8d4yKkLymKs4QxDvW_VfaP9e7lj3MJqDLdzCc-zHHIEGUfIYXav8ulerISXXIERZdYnQYxEAusoIBGsd_`.
The independent audit has now returned `FINDINGS`: original fresh census `55 / 5 / 50 / 0`, positive `8/8`, plus five
independently confirmed identical-sibling reassignments for combined independent `60 / 5 / 55 / 0`. It found four
bounded defects: per-kind owner shape, ordered row/cell ancestry plus call identity reciprocity, profile inputs that can
produce self-invalid successes (and empty provenance), and local-parameter lexical order/overlap. Producer-only 8A.7 is
specified tests-first across those exact families. Scene stays frozen until correction and another independent `CLEAN`.
The completed audit and dispatched 8A.7 Phase 1 are synchronized/read back at GitHub #41 comment `5267970111`, the
canonical Notion page, and Drive revision
`AIroW36kKuND40K1JA-1sdqq5Q7v-aExBFJEpkkTvuZ0m3zh0rqF84xg9ucs2hgGlfiHQ7329ixfqw5rLp1GLVVBA4aC1ZBQF7tV7YFO-fSx`.
The first tests-only checkpoint reported `315/407` with historical `313/313`, two controls green, 92 reds, zero throws,
and only the selftest changed to `33C672EA494FC4633B4B9B1A187509FED873FEE33A46DA85232F08A9D0F12EF7`. Coordinator
proof parsing rejected it: `creator receiver drift` had `fixtureReady=false` and identical before/after `row[1]`
receiver identities, so one red was fixture failure rather than a demonstrated validator escape. A tests-only correction
is active; production and Scene remain frozen. Production repair cannot start until exact `315/407` is reproduced with
all 92 red fixtures ready, zero throws, 94 unique 8A.7 names, both controls green, and forbidden hashes unchanged.
That corrected Phase 1 is now coordinator-accepted at selftest
`F53D5F58F88914DBDEC48344EE35BAE44173E04751D5FE600083421C951724A5`: exact `315/407`, historical `313/313`,
92 genuine reds, two controls green, 94 unique names, zero unready fixtures, and zero throws. The creator receiver now
proves distinct `row[1]` to `row[3]` identity drift. Typecheck, targeted lint, and hygiene checks pass; producer and Scene
hashes remain unchanged. Phase 2 may now repair only `src/lib/x4UiLayoutProgram.ts` against this accepted oracle; Scene
stays frozen pending all-green producer evidence and a fresh independent audit.
The accepted checkpoint is synchronized/read back at GitHub #41 comment `5268427188`, Notion comment
`3ba4618e-d15b-8116-bf66-001d5f5117fc`, and Drive revision
`AIroW34XFHNcEwyJVzil1Wxd8Vf7W5-_fCzQ19bDoPXWigBexEBkjx_PYbTDONLShXlpAhhOfcfJHXleJuPLFBDUihbT-4bJgxAZUxQKaxEt`.
Phase 2 is coordinator focused-green but not accepted. Only production changed, to
`685E714F16F1B1962562860DCAD5512404B659700339B3F20B36DFF247E822BE`; the accepted selftest and frozen Scene
hashes remain exact. Producer is `407/407`, every focused dependency is green, typecheck/lint pass, and Scene remains
exactly `117/119` with its two known geometry failures. Fresh independent audit is active over the prior malformed/
positive censuses, applied row/cell parent-field removals, and the source-review concern that profile ingress and pair
validation still duplicate rather than share their exact pin predicate. Candidate stays unaccepted; Scene stays frozen.
That audit returned `FINDINGS`; production `685E714F...` is rejected. Intended states were `12/12` accepted. Of 137
independent inconsistent copied states, 100 declined, 37 remained pair-valid, and zero threw: 31 non-applied/mixed-owner
cases plus six applied row/cell ancestry/bounds cases. Four extra-key profile-pin inputs also return successful wrappers
whose untouched issued pairs decline. Next is tests-only: install exactly 41 causally proved regressions and reproduce
`407/448`, exit `1`, with production and Scene byte-identical. Then repair exact branch owners, complete bounded
materialized ancestry, and one shared exact profile normalizer/predicate. Scene stays frozen pending a fresh `CLEAN`.
Rejection and Phase 3A dispatch are synchronized/read back at GitHub #41 comment `5269030352`, Notion comment
`3ba4618e-d15b-815c-b8e7-001d757fa725`, and Drive revision
`AIroW35jdTuJjaxLzjqOdDXvhXSMYuvVV7mMBo6klwiklgOcvTdLi67Kw5sGJEERX7RMEE4Go9wHyLu-cbHfE9B1H0zpXV7anMtjHXjET0_u`.
The first tests-only checkpoint reached aggregate `407/448` at selftest `A2125E0963FDEFFFD74BA3496CC9E1F230DC5BAA4D9E02A59E0D47B1E12FFEAA`
but is rejected: all four profile assertions require both the current non-refused invalid-pair behavior and the future
refused behavior through one contradictory `fixtureReady` predicate, so they can never turn green after repair. A
tests-only truth-table correction is active; production and Scene remain frozen.
The corrected Phase 3A oracle is now coordinator-accepted at selftest
`6287289F02F80DA9E21A6020AFC8ACDA0ED0F1ADE189F3575E6FFE5CC47A99A1`: exact `407/448`, prior `407/407` green,
41 causal reds, family counts `20 / 4 / 3 / 4 / 6 / 4`, 41 unique names, zero unready fixtures, and zero throws. The four
profile truth tables now remain red for current partial/self-invalid output and become green only for refused/no-pair
output. Production stays rejected at `685E...`; Scene hashes stay frozen. Phase 3B may now repair production only.
Accepted Phase 3A is synchronized/read back at GitHub #41 comment `5269285042`, Notion comment
`3ba4618e-d15b-8101-9c76-001d367906f3`, and Drive revision
`AIroW34F5AdCFhxM0kWLqxHZ5m5o9DfaGk04SHMMpW50RdhTF0oC34oQPwkTjwVk6OuE5_FIXgfL9VWOZB0ZnKWHRCFvLPQDwIAyWpMYinBR`.
Phase 3B production-only candidate is focused-green at
`DDE9CCA8A8B945710D61103F93E4134EEFA79A246F1830679859A11ED0ACFAD4`; frozen test/Scene hashes are unchanged.
Worker and coordinator both reproduce producer `448/448`, dependency baselines, typecheck/lint, and exact Scene
`117/119` with only the two frozen 8B.1 geometry failures. The repair closes branch-exact owner/identity, complete
materialized ancestry/kernel-slot binding, exact profile ingress, local-invocation ledger binding, and non-refused wrapper
self-validation while preserving legitimate partial branches. That focused-green result was not acceptance; Phase 3C
rejected the candidate on the late cross-field relationships below. Scene remains frozen; B119 remains `PARTIAL / Not
verified in game`.
Phase 3C returned `FINDINGS`; production candidate `DDE9CCA8...` is rejected. Exact audit: intended `12/12` accepted;
prior inconsistent census `137/137` declined; late matrix `64` total with `2` intended-valid accepted, `47` inconsistent
declined, `15` inconsistent still accepted, and zero exceptions. Reproduced residuals are local-invocation occurrence
binding `1`, row `groupIndex` slot binding `3`, table `numColumns`/kernel columns parity `2`, and conditional/unreachable
owner shape `9`. Hashes stayed unchanged and the reviewer wrote nothing. Phase 3D is test-only: install the `15` causal
regressions with production and Scene frozen; expected fail-first gate is `448/463`, with family counts `1 / 3 / 2 / 9`.
The first review turn's false-positive content-filter failure is recorded as an AAR trigger. Candidate remains
unaccepted pending test-oracle installation and production repair. Rejection/next-unit projection is read back at
GitHub #41 comment `5270062709`, Notion comment `3ba4618e-d15b-81d1-90e4-001d4f445131`, and Drive revision
`AIroW36LL_hXQuwKnmg3sXth4_PhKT_GJBka7qzzvL-i1o0cQSI5za4ZHs-Cy9Y5fQzA2WSiYt_3KCKmsdfxZA5k0EhrubQpSbmXUFt5-dP1`.
Phase 3D test-only oracle is accepted after independent `CLEAN` audit at selftest SHA-256
`C00658FDD98E8ADE5B69A0984B257AA863F524600968A13E5035E5B6A955232A`. Exact gate is `448/463`, exit `1`: all
historical `448` green, exactly `15` unique causal reds in families `1 / 3 / 2 / 9`, zero unready fixtures, zero checker
exceptions, and typecheck/lint/hygiene clean. Production and Scene hashes remain frozen. The worker's first 15-red shape
was rejected before acceptance because two readiness proofs were weak; corrected exact fixtures and an independent
detail audit close that evidence gap. Phase 3E is now production-only against this immutable oracle; Scene stays frozen
pending `463/463` plus a fresh independent `CLEAN` audit.
Phase 3E candidate `D6A5EB24750DA3CE4E6D351E925D19FC1A98936B59EBE5715FE4B24DE212EDC8` was produced by native
Luna worker `019ff1e6-df0c-71e0-831a-4a482169bfb4` with `src/lib/x4UiLayoutProgram.ts` as its sole write. Coordinator
reproduced exact `463/463`, all historical `448/448`, Phase 3D `15/15`, zero unready fixtures/exceptions, every focused
dependency baseline, typecheck/lint, frozen hashes, and unchanged Scene `117/119`. This remains a candidate: independent
It entered Phase 3F review under `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff725-b713-73a1-b5b8-aa8c09f6c858`; the final `FINDINGS` are below. Initial over-broad predicates and coordinator
evidence-script corrections are documented as AAR triggers in the durable plan.
Phase 3F returned `FINDINGS`: intended positives remain `12/12`, prior attacks are `137/137` declined, and the late matrix
is `2` valid accepted plus `62` inconsistent declined, but fresh probes found `40/96` blocked-owner mutations accepted
across `setColSpan`, `createButton`, `setText`, `setText2`, and `createEditBox`, plus `9/10` direct local-invocation
substitutions accepted outside `createText`. Candidate `D6A5EB...` is rejected as a close but retained as the unaccepted
base. Phase 3G is test-only: add all `49` exact causal regressions to the frozen selftest and require `463/512`, with only
the new `40 / 9` families red, before any generalized Phase 3H production repair. Scene remains frozen.
Phase 3G worker `019ff1e6-df0c-71e0-831a-4a482169bfb4` produced selftest-only candidate
`16CD456BDCB133EF5CFF9E834FF5F21D472F163BC087D71A9B855FA768724DD5`. Coordinator reproduced exact `463/512`:
historical `463/463` green, all `49` new states red, unique `40 / 9` coverage, zero unready fixtures/exceptions, dependencies
and frozen hashes exact. Independent reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff74a-f23b-70c3-8581-51ab8b76054f`, returned `CLEAN`: exact byte reconstruction of the prior `C006...` oracle,
complete causal `40 / 9` coverage, no historical change, no writes. Phase 3G selftest `16CD456...` is accepted and frozen.
Phase 3H is now production-only to reach `512/512` through evidence-derived owner shapes and generalized direct-occurrence
binding, followed by a fresh independent all-kind copied-state audit. Scene remains frozen.
Accepted Phase 3G is synchronized/read back at GitHub #41 comment `5271329467`, Notion comment
`3ba4618e-d15b-81e2-b13b-001d8163a9fd`, and Drive revision
`AIroW35YQmaJ04Y0YO1NnJk6IzJyA3qKkqhAW7zJWFPnetHku09OFRJITjUcILAUAHsDv5VjZqYDEjcw846y4AHZTUIIYG-tpYBFwpo2l83p`.
Phase 3H is active under native Luna worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff753-f2c7-7c72-b70f-46f01a32255e`, with production-only write ownership. Selftest and Scene are immutable; require
`512/512` plus a fresh independent all-kind copied-state audit before acceptance.
Phase 3H candidate is `B98D1BA4FE864892932656ED856453BC4E20642AA08C4DC4C2D7A211893FAB4C`; coordinator reproduced exact
`512/512`, all focused gates, immutable hashes, and unchanged Scene `117/119`. It generalizes owner evidence through exact
emitted identities/ancestry and local occurrence through sample/expansion context. Independent Phase 3I reviewer
`019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission `019ff76b-e18d-73a2-8ec6-4b7313eace7c`, is rerunning prior matrices
and attacking metadata steering, expansion/sample exemptions, and prefix-similar operation IDs. Candidate is not accepted.
Phase 3I resumed after one classifier interruption under submission `019ff77c-d3f2-7961-9c2a-3ae2be3505cd` and returned
`FINDINGS` with no writes and exact hashes. All prior matrices remain green, but coherent sibling provenance substitutions
were accepted for five operation kinds, three non-descendant expansion substitutions were accepted, and one same-operation
sampled-source substitution was accepted. The green Phase 3G summary also loses passing-check detail and reports its 49
fixtures as unready/unknown. Phase 3H hash `B98D1BA4...FAB4C` is rejected. Phase 3J is test-only: freeze production/Scene,
preserve all 512 historical checks, repair detail retention, and add exactly eleven checks with exact fail-first result
`514/523`: nine new red (`owner-provenance 5 / occurrence-context 4`) plus two green negative controls. Require an
independent oracle audit before any Phase 3K production repair. Do not resume Scene.
Phase 3I rejection/Phase 3J contract is synchronized/read back at GitHub #41 comment `5272077132`, Notion comment
`3ba4618e-d15b-8146-a341-001d31063ca1`, and Drive revision
`AIroW36RAplrt75Vyj9vXey-Hi89PlXVotAYcg8Xpu7v-XwC0B8_GNZ_PBleOtDBmm2oeJ4kSYAWNXIKoWthv58d4HKdxhQ3z-Wq_RebH2bM`.
Phase 3J is active under native Luna producer `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff78a-09b1-7012-bba8-2e3b664e822f`, with only `src/lib/x4UiLayoutProgram.selftest.ts` writable. Require exact
`514/523`, preserved Phase 3G detail, frozen production/Scene hashes, coordinator reproduction, and independent audit.
First candidate selftest `DEAEB64D...C6A884` reached top-level `514/523` but is not accepted: sampled direction was
reversed, Phase 3J historicalGreen printed `463`, and familyCounts printed all `6 / 5` cases instead of `5 / 4` reds.
Targeted test-only correction is active under submission `019ff7a3-8c8a-7881-ba45-371e1c556434`; all frozen boundaries
and exact acceptance counts remain unchanged.
Corrected selftest candidate is `51BE901FE7CF8F8985879245AC10799ED305CEE6B297764224439368175D03F2`. Coordinator
reproduced exact `514/523`, historical `512/512`, nine reds, two controls, Phase 3G `40 / 9`, Phase 3J failed `5 / 4`
and all-case `6 / 5`, exact sampled `getA -> getB`, focused gates, and immutable production/Scene. Independent audit is
active under reviewer submission `019ff7a9-3cac-79f3-ae50-7e214787a2f1`; Phase 3K remains locked pending `CLEAN`.
Independent Phase 3J audit returned `FINDINGS` with exact hashes/no writes and reconstructed prior hash `16CD456...`
exactly. Candidate `51BE901F...D03F2` is rejected: addTable's green control installs tableB as its receiver instead of
frameB, and the supplied `sampleWidth` belongs to a separate dynamic addTable rather than the mutated createText. Correct
only those two fixtures while retaining exact `514/523`, nine reds/two controls, `5 / 4` failed families, `6 / 5` all
cases, historical `512/512`, and frozen production/Scene. Require another independent audit before Phase 3K.
Phase 3J rejection/correction contract is synchronized/read back at GitHub #41 comment `5272537693`, Notion comment
`3ba4618e-d15b-8107-be3e-001df5bd1c62`, and Drive revision
`AIroW36vk_BGi_rN9DhU-OaarSq5q_F8L7Nbfy1z1HQR3FJTaLW9QAdow9Ncfg61BJbZaBSiIPzRdGpZsvw5ValoAUVotsIUoa_GpZ2_5j5N`.
Two-fixture test-only correction is active under producer submission `019ff7b4-9206-7c12-bcdb-d1881da20ed4`; only the
selftest is writable. Correct addTable frame/table identity and exact sample-to-createText linkage without changing
`514/523`, names, summaries, production, or Scene; then require a second independent audit.
Corrected candidate selftest is `66A61597AC4342FC84A165DEFA20583A7FBE612040AAF7CCE6DDAF74AA66BD96`; coordinator
reproduced exact counts and corrected causal proofs. AddTable now binds frameB receiver/tableB result and declines for the
uniqueness rule; sampleWidth is an exact consumed createText fontsize consumer with valid sampled/unsampled baselines.
Second independent audit is active under submission `019ff7c6-7527-7130-aea5-3d2cd3768a9d`; Phase 3K stays locked.
Second independent audit returned `CLEAN` with exact hashes and no writes. Phase 3J selftest `66A61597...66BD96` is
accepted and immutable: exact `514/523`, prior hash `16CD456...` reconstructed byte-for-byte, all eleven fixtures causal,
and focused gates exact. Phase 3K is production-only in `src/lib/x4UiLayoutProgram.ts`: add detached source-call binding
evidence for receiver/result/semantics/local-result occurrences, reach exact `523/523`, preserve Scene `117/119`, then pass
a fresh all-kind independent Phase 3L audit. Do not edit tests or resume Scene.
Accepted Phase 3J/Phase 3K contract is synchronized/read back at GitHub #41 comment `5272904725`, Notion comment
`3ba4618e-d15b-8174-8241-001dc87622d4`, and Drive revision
`AIroW34Zemne4Qpfb5mAO8GvYNUx_NIRRqe2k_YOmFYByP-anMYCL3We9OQlQB05IPbCr6b-tADYb8jHWzB30nMbO2fh5INoRV_v2VgUTQxZ`.
Phase 3K is active under producer submission `019ff7d8-2392-76c0-806d-88050f2306a3`; only production is writable. Require
detached source-call binding, exact `523/523`, frozen selftest/Scene, and a fresh Phase 3L all-kind audit before acceptance.
Phase 3K candidate production hash is `D14F4D8929FD237074AA63E379B9AA7DA3A93D96D1CF9637D5E02CBE21668DFB`.
Coordinator reproduced exact `523/523`, all focused dependency gates, and frozen Scene `117/119`; selftest/Scene hashes
remain exact. Authority schema v3 now carries ordered detached call-metadata bindings. Candidate is not accepted: Phase 3L
read-only all-kind/binding-mutation audit is active under submission `019ff7e4-8ced-7a21-861a-d3f30a00efa9`.
Phase 3L returned `CLEAN`, exact hashes, no writes: positives `12/12`, historical `137/137`, late `2 + 62`, owner
`96/96`, local occurrence `10/10`, and fresh binding mutations `101/101`, all with zero exceptions. Accept and freeze
production `D14F4D8929FD237074AA63E379B9AA7DA3A93D96D1CF9637D5E02CBE21668DFB`. Resume only the existing Scene
8B.1 worker to close finalized scaled-height and Helper-negative omitted-width geometry from `117/119` to `119/119`,
then require fresh read-only acceptance before Batch 6A closes.
Scene 8B.1 resumed under submission `019ff803-fef3-7a01-99d0-6b3af879b16c`; only the two Scene files are writable.
Accepted producer/selftest are frozen. Accepted Phase 3K/active Scene state is read back at GitHub `5273323633`, Notion
`3ba4618e-d15b-8124-8d8d-001d8b7f1f74`, and Drive revision `AIroW36YVnFWA00-5H6iCYWHVUShS2sQSqwUaeUbfxqWeeJ_Eaz607CFBmuBsMJZangEKNpQvX7m7YEEAO5pIuyZaJiKDxxAK81zKKLr2id2`.
Scene candidate reached `119/119` at source `B4A05BC8...B7842` and selftest `26C12C36...F0D0`; all focused gates and
independent four-kind behavior probes passed. Fresh audit still returned `FINDINGS`: the permanent Scene oracle does not
assert finalized-height provenance links or every exact `-10` / `source-pinned-default` / Helper `5372-5388` Scene link.
Production behavior is source-correct and unchanged except diagnostic cleanup. Correct only the Scene selftest, preserve
all production hashes, and require another fresh read-only `CLEAN` audit before accepting Batch 6A.
Scene 8B.2 selftest-only correction is active under submission `019ff827-c0b9-7850-86b7-916119e0ce7e`; require exact
`119/119`, non-no-op provenance controls, frozen production/producer hashes, coordinator reproduction, and fresh audit.
Scene 8B.2 is accepted at selftest `934B6E68557E357F7F62BC4097184EFDAC1FEABA3E63CCDF62BB9CB94B9CA63A` with Scene
production `B4A05BC87BDE5D497199A4D7649A59D3F3B489C291DCCCC5F63167479EAB7842` and both accepted producer hashes
unchanged. Coordinator gates passed Scene `119/119`, producer `523/523`, typecheck, and owned ESLint. Independent
submission `019ff832-2fb5-7c43-ba84-0d12dd2df1cd` returned `CLEAN`, zero writes, all four exact height links, all four
exact Helper-negative-width links, and twelve non-no-op pair-refusal controls. Batch 6A is focused-accepted. Next bounded
unit: implement the specified pure `x4UiPreviewPipeline.ts/.selftest.ts` Batch 6B only; no React/Canvas/browser/game work.
Overall B119 remains `PARTIAL / Not verified in game`.
Accepted Batch 6A is synchronized/read back at GitHub #41 comment `5273815148`, Notion comment
`3ba4618e-d15b-81d7-8e7d-001d66b9e6ec`, and Drive revision
`AIroW34aKGsxvrEt4y5KsHUG4ZVUULaB6QZMlbkiTKeNr7bch85Vi9QItPQ4hQS2go2C2m-jQfThShrba37lFOsI48aznWnC4etNy87kB2ui`.
Batch 6B is active under native Luna submission `019ff83b-94b8-71a0-ad8e-e0758f989f48`. Only the two new pure
`x4UiPreviewPipeline.ts/.selftest.ts` files are writable; require the documented fail-first, source-pinned profile and
selection/lint/program/Scene matrix, all focused gates, frozen dependency hashes, and fresh no-write audit.
Fail-first is recorded: absent production caused exact `ERR_MODULE_NOT_FOUND`, exit `1`; first-draft local typing repair
and full selftest expansion are active.
First candidate hashes are pipeline `A9182F898C3AE32BD502BAA4F6B87CC948BD1176C7A11899277EC3F31A9CF020` and
selftest `9402B866DF9ABE2F352D22EFB3F06E700F83FE9E8EA8953A50F391D06231FE2F`. Worker/coordinator focused gates are
green at pipeline `35/35`, Scene `119/119`, producer `523/523`, linter `112/112`, every remaining declared owner,
typecheck, and owned ESLint. Fresh reviewer `019ff863-39af-7fd3-a62d-bbaf97c2d13c` returned `FINDINGS`, not acceptance:
text-height grade promotion and a fabricated malformed-input `widgetPort` are production defects; canonical Scene,
independent partial Scene, successful path-selection, exact blocking-lint durability, and call-model equivalence need
permanent oracle coverage. Correction submission `019ff871-ab55-7c70-94cf-06abfc8971ef` is active within the same two
files. Require fail-first, full focused rerun, frozen hashes, coordinator reproduction, and a new no-write `CLEAN` audit.
Correction fail-first was `40/50`, exit `1`, against unchanged production; corrected pipeline/selftest are now `50/50`
at hashes `7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D` and
`C578C93B5C36E136C8CCEC23CA699DCAE19232B33A47D33BE910D74B13065016`. Coordinator reproduced all declared focused
owners and gates with frozen Batch 6A hashes exact. Fresh no-write re-audit
`019ff890-ff54-70d2-b4e5-f7d7e44e3c7e` is active; it must resolve canonical projected-program/partial-Scene semantics and
the detached call-model equivalence oracle. Do not accept Batch 6B without `CLEAN`.
Re-audit returned `FINDINGS`, zero writes. Canonical projected-program/partial-Scene behavior is valid but exact identity,
pin, and nonempty geometry facts must become pass conditions. Raw workspace models contain optional `undefined` members
and are correctly refused by the strict JSON producer, so the false raw-success equivalence requirement is replaced by an
exact JSON-domain normalization contract: omit only undefined object members, preserve all defined bytes/order/identity,
prove input unchanged and direct-normalized output equals pipeline output, retain the raw refusal as boundary evidence,
and prove no parser/model builder is used. Final correction stays in the same two files and still requires fresh `CLEAN`.
Final correction changed only the selftest to
`DDFAD0F2929B617353B22494A8C2540D4A495A34036F52E2EAC7C0B423A9F538`; production remains
`7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D`. Pipeline is now `57/57`; canonical and
normalization predicates include seven non-no-op controls, and all focused gates reproduce green. Final no-write audit
`019ff8ae-8ecf-78a0-aa1f-17c6d3025c5e` is active. Accept/synchronize Batch 6B only on `CLEAN`.
That final audit returned `CLEAN`, zero writes. It causally closed both re-audit findings and all six earlier findings:
the canonical predicate now owns exact authority/pin/geometry facts, and static plus dynamic call-model handoffs prove the
bounded JSON-domain normalization contract with raw refusal preserved and seven non-no-op controls. Coordinator
reproduced pipeline `57/57`, Scene `119/119`, producer `523/523`, call model `46/46`, kernel `29/29`, corpus `28/28`,
font `10/10`, text `8/8`, source/workspace `PASS`, keep-outs `16/16`, linter `112/112`, typecheck, zero-warning owned
ESLint, exact frozen hashes, and clean boundary/hygiene scans. Batch 6B is focused-accepted. Next bounded unit is the
specified pure Batch 6C paint plan; browser/React/editor/deploy/game truth remain open and overall B119 remains
`PARTIAL / Not verified in game`.
Accepted Batch 6B is synchronized and read back at GitHub #41 comment `5274809846`, Notion comment
`3bb4618e-d15b-8137-b63f-001d412db698`, and Drive revision
`AIroW34Gt_rL0bVF3JcVCp9NV4gy4dJU-zQfsh850pwXMLwGDTFM-5ihI_pyNVSzBqwgC7riCNENd2fnRU6vAbFTF2b0VwQtB-Jboy9V0zP4`.
Batch 6C is now the active bounded unit. Its only writable implementation paths are the absent
`src/lib/x4UiPaintPlan.ts` and `src/lib/x4UiPaintPlan.selftest.ts`; all accepted owners above are frozen. Require a
pre-production fail-first, exact Scene/atlas/keep-out composition contract, every declared focused gate, frozen-hash
readback, coordinator reproduction, and a fresh no-write `CLEAN` audit before focused acceptance.
Native Luna submission `019ff8c2-3a98-7af3-b6d3-ce97b5f22e18` owns this exact two-file unit. The first required receipt is
the selftest import failing with `ERR_MODULE_NOT_FOUND` while production is absent; no production candidate is accepted
without that fail-first.
Fail-first is now captured: exact `npx.cmd tsx src/lib/x4UiPaintPlan.selftest.ts` exited `1` with
`ERR_MODULE_NOT_FOUND`, and only the owned selftest existed. Production implementation and the full oracle expansion are
active within the same two-file boundary.
First-draft review reproduced four non-acceptance gaps before a green count: accepted `programStatus=projected` /
`Scene.status=partial` was falsely refused; accepted negative Scene coordinates were conflated with unsafe dimensions;
the 0.74 option-stack guide was misused for the required 0.788 wheel guide; and only glyph blits, not all drawable
geometry, crossed the clip path. Synthetic regular-to-bold relabelling was also rejected as detached font evidence.
Corrections are active in the same two files; require source-derived bold evidence, partial cell/widget/glyph clips, and
multi-frame layer/z/source-order predicates before candidate review.
The corrected Batch 6C candidate is coordinator-reproduced at paint plan `31/31`, Scene `119/119`, font `10/10`, text
`8/8`, corpus `28/28`, keep-outs `16/16`, preview `57/57`, source/workspace `PASS`, typecheck, zero-warning owned ESLint,
clean boundary scan, and exact frozen dependency hashes. Candidate hashes are production
`887294D0EF42D7A05504FABE62A82F78859485AD38015400FCB70E323E2F4FC9` and selftest
`BA634F665DDF7ABCE6C9E4FD83B69412E559FD8220013C374EFF9E945022D94D`. This is not accepted: send both exact hashes
to a fresh no-write reviewer and require `CLEAN` before Batch 6C focused acceptance or downstream editor integration.
The fresh audit `019ff8f0-825a-7e91-adc5-3517603c1832` returned `FINDINGS`, zero writes: `78/78` probes executed,
`71` inconsistent inputs, `20` correctly refused, `51` incorrectly accepted, `7/7` valid controls, and zero throws.
The rejected hashes stayed exact. Reproduced defects cover reciprocal ancestry/clipping/frame ownership, complete
text-layout/glyph continuity, Scene source and selection closure, keep-out closed domains, source-bound ordering, exact
gap source links, nested false truth/paint fields, and positive drawable dimensions. Resume the same two-file Luna unit
tests-first; capture every reproduced family red before production repair, preserve frozen dependencies and valid
controls, rerun all focused gates and coordinator readback, then require another independent no-write `CLEAN`. The
Windows long-command/syntax setup failures were excluded from evidence and are an AAR trigger. Overall B119 remains
`PARTIAL / Not verified in game`; no downstream editor integration is authorized from the rejected candidate.
Tests-first checkpoint is captured before production repair: the expanded paint suite ran `34/85`, with exactly `51`
intended reds, zero unready fixtures, and zero validator throws. Production repair is now active only in the same owned
paint-plan source; all 51 causal predicates must remain and turn green without regressing valid controls.
The first production pass is rejected at `14/85`: its broad Scene JSON/schema gate refused valid baseline, clip, and
keep-out controls along with the 51 malformed cases. Correction is active; a refusal-only false green is unacceptable.
Narrowing reached `85/85` with all 51 mutations refused and zero fixture/throw errors, but the worker reported only three
valid controls. Resolve the required `7/7` audit-control mapping before treating this as a stable candidate.
That discrepancy is closed. The repaired candidate is paint `85/85`: `51/51` malformed mutations refused, three refusal
controls green, seven named intended-valid controls `7/7`, zero unready fixtures, and zero throws. Exact hashes are
production `D7C901D3A52F0489766E590A43417EC5039F2D1414C41DB57E9CAFF524A0BE3B` and selftest
`E2B1F6022C338DD94542CB1911A6B5FEB4D514F40B93429AA74DE169052F9556`. Coordinator reproduced every focused
dependency, typecheck, owned ESLint, hashes, and boundary/hygiene scans. This is still not accepted: require a fresh
no-write adversarial audit, including coherent valid-SHA/source substitutions and empty/source-only selection shapes.
The coordinator's first combined lint/hash wrapper failed at PowerShell parse time and is excluded; smaller reruns pass.
Fresh no-write audit `019ff939-a3b2-75c2-82e8-74d2d1747d04` has passed the exact hash stop-gate and is active. Wait for
its full adversarial verdict; do not start editor integration from the local green suite.
That audit returned `FINDINGS`, zero writes. The original `51/51` malformed matrix and `7/7` positives remain closed,
but 41 new probes found ten accepted inconsistent mechanisms: arbitrary valid SHA/coherent file-path attribution,
five missing layout comparisons, open preview entry schemas, equal-offset gap reorder, and absent distinct-frame-layer
coverage. Exact rejected hashes stayed unchanged. The correction expands sequentially to exactly six files: Scene must
preserve line `sourceCodePointRange`; preview pipeline must issue private `WeakMap`-backed source authority at its exact
selected-source chokepoint; paint must require that authority and close the five comparisons; its fixture must use real
frame-option layers and an independent expected order. Tests-first red/green receipts, all focused gates, exact hashes,
coordinator reproduction, and another no-write `CLEAN` audit are mandatory. Overall B119 stays
`PARTIAL / Not verified in game`; editor integration remains forbidden.
Native Luna submission `019ff950-deb9-75a2-9f83-b45640d828f4` is active on that exact sequential six-file correction.
Wait for Phase S/P/C red-before-production receipts and the final focused candidate; no other owner may change.
Phase S fail-first: Scene `119/120`, exit `1`, exactly the missing line `sourceCodePointRange` preservation predicate red;
its missing/malformed/altered negatives pass. Scene production repair is now active.
Phase S final is Scene `120/120`, exit `0`. Phase P preview-authority tests-only work is active; preview production remains
frozen until its red receipt.
Phase P fail-first: preview `63/66`, exit `1`, with exactly the three authority-positive controls red; all negative clone,
rewrite, reorder, evidence, and alias checks pass. Private issuance production repair is active.
Phase P final is preview `66/66`, exit `0`, with all issued-authority positives and clone/refusal/rewrite/reorder/evidence/
alias negatives green. Phase C pre-production is `87/94`, exactly seven named reds; paint source is still untouched while
the real distinct-layer fixture predicate is captured.
The fixture-only distinct-layer correction is causal at paint `88/95`, exit `1`; all prior 51 negatives and 7 positives
pass, with exactly seven authority/layout/source reds remaining. Paint production repair is now active.
Phase C focused final is paint `95/95`, exit `0`; all new and prior mutation/positive counts are green, and issued preview
authority is mandatory with no compatibility fallback. Coordinator reproduction passed Scene `120/120`, preview `66/66`,
paint `95/95`, producer `523/523`, call model `46/46`, kernel `29/29`, corpus `28/28`, font `10/10`, text `8/8`,
keep-outs `16/16`, linter `112/112`, source/workspace `PASS`, typecheck, six-file zero-warning ESLint, frozen hashes, and
boundary/diff/hygiene scans. Exact six-file candidate hashes are Scene
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`, Scene selftest
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`, preview
`ABCB9AEF1C155B9CE572A9A57B3D2E9336125F81F5B9841F2C18FD9AEFAF1927`, preview selftest
`A829DE930284E45A968670056FFA7D9EE8F0EC514475A28C8FF8C11D2EA78412`, paint
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, and paint selftest
`494D5F9041D8F89019254DCF3D0A1894BF2E55E661FCA08FFB045CFB71F45B06`. The candidate is not accepted: a fresh no-write
`CLEAN` audit remains mandatory before editor integration. Overall B119 stays `PARTIAL / Not verified in game`.
That audit submission `019ff975-8297-7e01-9609-c024be9e94b0` returned `FINDINGS`, zero writes and zero hash drift. All
focused gates stayed green, but 15 independent probes found six accepted mutations that changed paint output: cell
geometry, drawable/profile width, frame layer/order, reciprocal table/frame ownership, coordinated glyph/layout `x`, and
coordinated glyph/layout code point. A seventh non-allowlisted table `zOrder=-10` mutation was accepted without changing
this fixture's output and must also refuse. The issued-result identity gate correctly rejects clones, source rewrites, preview
aliases, gap reorder, and altered-profile cross-pairing, but its stored Scene evidence is incomplete. The exact candidate
hashes above are rejected. The next tests-first unit owns only preview source/selftest plus paint selftest: bind a normalized
complete issued Scene, allowlisting only root projected-to-partial status and exact node `clipRect` test variations, while
keeping paint/Scene production and all accepted owners frozen. Require causal red/green, all focused gates, hashes/scans,
coordinator reproduction, and another no-write `CLEAN`. Editor integration remains forbidden; overall B119 remains
`PARTIAL / Not verified in game`.
The third rejection/correction contract is synchronized and read back at GitHub #41 comment `5276263923`, Notion
comment `3bb4618e-d15b-81b7-a7e9-001db08a7aa0`, and Drive revision
`AIroW35QBDlqjglRZDowCYgKgl8BedpYyAKE_V8QaEkUa9ESYVKNVXKWHTPDKuujZsRCZWFmJu217bu_KaYVpl8rZVezLB-NYBCSx0bl6o2A`.
Tests-only Phase T is coordinator-accepted as the required fail-first receipt. Authoritative-host preview is exact
`66/74`, exit `1`; public paint is exact `95/103`, exit `1`; all prior 161 checks remain green and the same eight causal
issued-Scene mutations are red with zero unready fixtures or exceptions. Protected hashes are preview
`ABCB9AEF...F1927` / selftest `FC64FB87...037E7`, paint `315E6E42...DB2E` / selftest `2D11721B...593B9`, and Scene
`B11E4C64...88334` / selftest `C4CE51D6...70F8E`. Production repair may now change only
`src/lib/x4UiPreviewPipeline.ts`; all tests and other production owners are frozen. Require exact preview `74/74`, paint
`103/103`, complete focused host gates and hashes, coordinator reproduction, then a fresh no-write `CLEAN` audit before
editor integration. B119 remains `PARTIAL / Not verified in game`.
The first production pass is rejected at preview `53/74`, paint fixture `1/3`, hash `44ECBA7F...7134C`; its sentinel
follow-up is rejected at preview `72/74`, paint `97/103`, hash `3A8EF3E3...3F54`. All eight attacks now refuse, but the
established JSON-clone/clip/partial positives require optional object `undefined` to normalize as absent. Omit only
those own object properties; undefined array slots and all other malformed/lossy shapes still refuse. Remove the
sentinel and logging. Then, with production green and frozen, repair the Phase T tests' 11 readonly TypeScript errors
and one unused-local lint warning mechanically without changing any predicate or count. All five frozen hashes remain
exact until their explicitly sequenced test-only phase.
The rejection/next contract are synchronized and read back at GitHub #41 comment `5271062148`, Notion comment
`3ba4618e-d15b-8112-babc-001d285cab77`, and Drive revision
`AIroW34QwWm_rC-S2McCvoclRWZVoTGTr9nGlvXR4Qf_dP0jw06b5AQa1b-XQjtY_XoOz-YfBBhVu3FfUW6XHboRimW3x4mYctsEMq-F_ujh`.
The final production-only normalization candidate is focused-runtime green and coordinator-reproduced at preview
`74/74`, paint `103/103`, and Phase T `8/8`, with zero unready fixtures/exceptions and all valid controls preserved.
Preview production is frozen at `317DB32A...12E`; the five protected paint/Scene/test hashes remain exact, and the
sentinel/debug/output-token experiment is gone. This is not acceptance yet: Luna submission
`019ff9f1-a0cb-7fd0-b69b-51fb8f14de38` may mechanically edit only the two Phase T selftests to clear eleven readonly
TypeScript errors and one unused-local lint warning without changing runtime behavior. Require typecheck, six-file
zero-warning ESLint, exact focused/hash reproduction, and a fresh no-write `CLEAN` audit before editor integration.
B119 remains `PARTIAL / Not verified in game`.
The sequenced test-only cleanup is complete and authoritative-host reproduced: preview `74/74`, paint `103/103`, Phase
T `8/8`, prior malformed `51/51`, authority controls `3/3`, valid controls `7/7`, typecheck exit `0`, and six-file
zero-warning ESLint exit `0`. Production hashes remain preview `317DB32A...12E`, paint `315E6E42...DB2E`, and Scene
`B11E4C64...88334`; mechanically corrected selftests are preview `24E3C669...F87`, paint `BCD2AB87...643`, and Scene
`C4CE51D6...F8E`. Fresh no-write Luna audit `019ffa06-d1e9-70a0-8f60-1166714c20df` is active. Only `CLEAN` permits
Batch 6C focused acceptance and the specified Canvas-adapter Batch 6D. Overall B119 remains
`PARTIAL / Not verified in game`.
That audit returned `FINDINGS`, zero writes. All six hashes and focused gates remained exact, but source review found a
P2 prototype-boundary escape: authority snapshots only own properties while paint reads inherited optional `rect`,
`zOrder`, `outerRect`, `naturalRect`, and `clipRect`. Batch 6C is rejected and Batch 6D remains locked. Next exact unit is
tests-first runtime reproduction plus the narrowest own-property-only Scene-consumption correction at the existing
preview/paint seam, followed by the complete focused matrix, typecheck/lint/hash readback, coordinator host reproduction,
and another independent no-write `CLEAN`. B119 remains `PARTIAL / Not verified in game`.
That correction is now a focused-green candidate. Fail-first paint was `104/109` with five causal inherited-field reds
and one green custom-prototype refusal; final preview is `74/74` and paint `109/109`, including unchanged `51/51`,
`3/3`, `7/7`, Phase T `8/8`, and prototype boundary `6/6`. Typecheck and exact six-file zero-warning ESLint pass.
Paint hashes are production `300DD9AD...ED15` and selftest `900ED6D6...91F6`; preview/Scene hashes remain frozen.
Fresh no-write audit `019ffbbd-e29f-72b3-a7cb-515c9be51693` is active over every inherited optional Scene field. Batch 6D
remains locked until `CLEAN`; B119 remains `PARTIAL / Not verified in game`.
That audit returned `FINDINGS`, zero writes, despite every focused gate remaining green. The five-field fix is rejected:
paint checks the issued own-property snapshot but then consumes the original prototype-bearing Scene. Additional P1/P2
families cover hierarchy/ownership/layer, table/view/widget optionals, font/layout, source/provenance/gaps/identity, and
inherited input `keepOuts`/`selection`. Next exact unit is tests-first closed-domain materialization: private issuance
must return a deeply frozen recursively own-property/null-prototype Scene only after authority succeeds, paint must use
only that Scene, and optional wrapper inputs must be own-only inheritance-free copies. Then rerun every focused/static/hash
gate and require another independent no-write `CLEAN`. Batch 6D remains locked; B119 remains
`PARTIAL / Not verified in game`.
The closed-domain candidate is now coordinator-host green. Fail-first preview was `74/89` with materializer `0/15`;
paint was `117/127` with `10` causal closed-domain reds and no fixture/exception failures. Final preview is `89/89`
(`15/15` closed domain) and paint `127/127` (`18/18` closed domain), preserving all old `103/103`, `51/51`, `3/3`,
`7/7`, Phase T `8/8`, and prototype `6/6` counters. Typecheck and exact six-file lint pass. Four candidate hashes are
preview `F1D7062E...B0759` / `31B8EC41...AF99`, paint `0FBF2928...CBDF` / `43F266F2...E303`; Scene is frozen. A fresh
full-boundary zero-write audit is required before Batch 6C acceptance or Canvas Batch 6D. B119 remains
`PARTIAL / Not verified in game`.
Fresh no-write audit `019ffbf7-d938-7022-b26d-7516ca1ae66f` returned `CLEAN`, zero writes, exact six-hash/status parity,
and independently reproduced preview `89/89`, paint `127/127`, typecheck, lint, full authority trace, corpus gate, and
all `15 + 18` causal closed-domain oracles. Batch 6C is focused `VERIFIED`; Canvas Batch 6D is unlocked. Browser/editor,
deploy, and in-game truth remain open, so B119 remains `PARTIAL / Not verified in game`.
Accepted Batch 6C is synchronized and read back at GitHub #41 comment `5285331097`, Notion comment
`3bb4618e-d15b-81e2-93c3-001d06d2ba02`, and Drive revision
`AIroW35VX58JivbT3O7MSGFQxOELaadevCdJZ_aYdz0iaDmcrrqJt8NjqGzZGHmnPrPoCMYBVPHJPYXepVHexfgHsTrTxzKdDHylpyZMzhKD`.
The first Drive append returned an internal connector error without mutation; fresh readback plus one bounded
end-of-segment retry succeeded. Batch 6D implementation is active in the two planned Canvas adapter files only.
Coordinator review rejected the first Canvas `31/31` candidate. Its correction matrix was `35/43` with eight causal
reds: three order attacks, callback changes to glyph `x=5 -> 6`, alpha `255 -> 0`, and drawable `100 -> 101`, plus two
caller-target commit traces. Batch 6D now enforces a complete global `0..N-1` order set and per-layer monotonicity while
explicitly not claiming unavailable producer-origin authentication. The renderer will return a renderer-owned composite
surface only on success, never mutate a caller target, detach operations/A8 bytes before callbacks, and recheck the
original result/corpus before success. Candidate remains rejected until focused green plus a fresh no-write audit.
The corrected renderer reached `44/44` with every focused/type/lint/hash gate green, but fresh zero-write audit
`019ffcda-c87a-70c1-8fa2-22d0c2c693ce` returned `FINDINGS`: callback mutation checks omit dimension accessors,
`putImageData`, and successful paint callbacks; refusal tests do not prove zero pre-refusal factory/draw work; order and
overlay assertions inspect plans/receipts more than emitted traces; and nested receipt freezing is incompletely
enumerated. Production is frozen at `5C16F57B...13C703`; the next tests-only unit expands those causal oracles, preserves
all prior checks/hashes, then requires coordinator reproduction and a fresh independent `CLEAN` before editor
integration. B119 remains `PARTIAL / Not verified in game`.
The rejection is synchronized/read back at GitHub #41 comment `5286605053`, Notion comment
`3bb4618e-d15b-8195-b49b-001d0acdfa34`, and Drive revision
`AIroW37Nv-kjq4KuJv-naRl8B443x3GLEIQxSTRvOqLObCgcDSH4zgWKU5aaQjBLDw4fOIbd4iXQnFJjjKEZcCj4Oo4DIVGBjzDRnwyhUTnq`.
The tests-only correction now passes exact Canvas `65/65` with families `44 / 7 / 6 / 3 / 2 / 3`; coordinator also
reproduced every focused dependency, typecheck, owned ESLint, hashes, and hygiene. Production remains frozen at
`5C16F57B...13C703`; selftest is `98F5AF68...BD10`. Fresh no-write audit
`019ffd0e-2b2b-7250-a161-8c445b68ea37` is active. Editor integration remains locked pending `CLEAN`.
That audit returned `FINDINGS`, zero writes, with all fourteen hashes and every declared gate exact. A cross-layer
background/glyph order swap still renders because validation checks only a contiguous set plus per-layer monotonicity,
while painting ignores the conflicting order fields; the emitted-trace oracle is implementation-shaped and atlas pixel
coverage observes only one alpha byte. The retained factory-surface probe exposed an ownership-documentation gap, not a
caller-target API: factory returns are renderer-owned allocations and the renderer accepts no mounted target. Next is a
two-file tests-first correction: causal flattened-order red, invalid-target-option zero-allocation control, literal trace
goldens, complete regular/bold RGBA assertions, then the narrow order validator fix and explicit allocator contract.
Editor integration remains locked pending a fresh independent `CLEAN`; B119 remains
`PARTIAL / Not verified in game`.
The initial two-file repair is rejected despite a reported `69/69`: its Canvas fixture rewrote the real paint result's
orders into flattened layer order before rendering, so the stricter renderer rejects the actual `x4UiPaintPlan` output.
Reconciliation found the producer assigns one interleaved construction counter and only later groups commands into four
paint layers. The necessary correction is now four-file tests-first: paint must issue final flattened indices after
grouping; Canvas must consume the raw result with no test normalization; diagnostics/keep-out identity, all existing
semantics, and frozen upstream hashes remain exact. Initial audit bookkeeping is read back at GitHub `5288798450`,
Notion `3bb4618e-d15b-81cd-baf3-001dc72c7b26`, and Drive
`AIroW36kfUW0iJlIbnjJhFdQxeMrfNqfYJcyeOzIMuXTPHPRUPD0lYL7tnXRz8tVrgPP9tYBhDMtMKF80PrK8Nc88UnjEBKI94dKgf9roCQQ`.
Require causal paint/Canvas reds, full focused green, and a fresh independent four-file `CLEAN` before editor work.
The corrected scope is also read back at GitHub `5288853384`, Notion
`3bc4618e-d15b-81cb-9a11-001de2b56048`, and Drive
`AIroW37W_qKgcYSMJxasJf45EQh3r8mqDYzSW8LUH_Qg6ueMbjkC9nY5bY_VZrY6ZqLxZJroktf4BmIJAg8QQU6YB6N16CfJSIyv46zvEigD`.
The four-file correction is focused-accepted after causal fail-first, final focused evidence, and a fresh independent
`CLEAN`. Paint was `130/131` with historical
`127/127` green and only raw flattened order red; Canvas was `69/70`, refusing the raw production result before any
allocation or draw. Final coordinator reproduction is paint `131/131`, Canvas `70/70`, preview `89/89`, Scene
`120/120`, every other focused owner green at its declared count, source/workspace `PASS`, typecheck, exact lint, and
diff hygiene. Accepted hashes are paint `1C75A614...A8731` / selftest `95116519...18BEF`, Canvas production unchanged
`4B126345...816D4`, and Canvas selftest `AF9096E7...26FB7`. Fresh zero-write audit
`019ffe3f-c8f9-7ee3-a5ea-d99e89d6563c` changed no files, preserved all eight hashes, reran the complete focused matrix,
and passed `11/11` independent raw-chain attacks including `0..66` order, zero-activity cross-layer/target refusal,
coherent same-layer render, `403` literal trace operations, all regular/bold RGBA bytes, and frozen game truth. Batch 6D
is accepted; source-first React/editor Batch 7A is active. B119 remains `PARTIAL / Not verified in game`.
The acceptance receipt is synchronized/read back at GitHub `5289048407`, Notion
`3bc4618e-d15b-81fe-b0c4-001dbb1f0a11`, and Drive revision
`AIroW36a6u47PpYCnkkIJyLHJ6dti1Xtg0ERB2HFyYyNcKeis-czmFt5JejaQQYTTx5P0Occ0DJa5XzWnKtPQCX_XkVro2lbz-iYtNsEEm69`.
Batch 7A is focused-accepted after the first audit's seven finding families, two bounded corrections, and the final
shared-ID keep-out repair. Final session/editor/UIBuilder hashes are `9A2DBAF6...01E6F4`, `638E0448...95BEBC`,
`7962F476...9CCB2`, `2A14C3BB...4D945`, and `E2E47C43...72FA69`. All 16 focused suites, typecheck, exact five-file
zero-warning lint, diff/boundary scans, and fresh zero-write audit `019ffee7-8866-79c1-8cd7-fe68f7ddbd04` are green;
all 13 hashes matched and the audit returned `CLEAN` with no findings. Batch 7B and Batch 7C first candidates were
rejected by zero-write audit `019fff95-ca11-7523-81ef-1beca66c71f7` despite all 17 focused suites/typecheck/exact lint:
source authority forgery/clones, malformed nested-model throws, malformed/prototype sample inputs, and profile/program-
stale samples remained. The first focused-green 7C correction was also rejected by coordinator review because the
two-argument public reconcile call still accepted a coherent forged target catalog.

The tests-first corrections have causal receipts and complete coordinator greens, but the combined corrected candidate
was rejected by fresh zero-write audit `01a000b5-dad3-7a22-ba50-12aaa5093c17`. Batch 7B hashes are
`A151628B...A1E2E1` / `550B8D57...F7BBA`; corrected Batch 7C hashes are `3B76B896...E0F9F`,
`01841353...E9755`, `C34E96B3...120C98`, and `1E1769AB...14143B`; UIBuilder remains
`E2E47C43...72FA69`. All 17 focused suites, repository typecheck, exact six-file zero-warning lint,
diff/whitespace/unsafe-cast scans, and all 14 frozen hashes stayed green; the sample authority matrix also passed `52/52`.
Those greens did not cover four source-edit failures: wrong-literal retarget through forged call evidence, actionable
`undefined`/`NaN`/`Infinity`, a forged refused program remaining editable, and throwing outer accessors escaping
containment. The original two-file Batch 7B owner reproduced all four families and produced candidate hashes
`6B1624DA...B69663` / `D08E9462...E2D9E`, but fresh zero-write audit
`01a00130-274a-7141-bf81-21d77e71c81b` rejected them with all 14 hashes unchanged. Structural greens still allowed a
coherent deeply frozen workspace/source/program/evidence clone to authorize mutation, `partial` programs to remain
actionable, reordered call/evidence ledgers to match, and nested request/accessor/proxy shapes to cross or observe the
public boundary. Batch 7B is therefore expanded only to three sequential exact-owner units: private layout-program
pair issuance, private workspace/source pair issuance, then a projected-only/order-exact source-edit consumer with an
issued-catalog plus primitive apply boundary. No signer, second model, renderer, persistence owner, or game surface is
added. Batch 7C stays frozen, the combined boundary remains unaccepted, and Batch 7D remains blocked pending causal
fail-first receipts, focused integration greens, and a fresh hostile `CLEAN` audit.
The two producer issuance dependencies are now focused-green candidates: layout fail-first `523/531`, final `531/531`,
hashes `77097F6B...25E8D0` / `CDD94A81...EE0046`; workspace-source missing-export fail-first, final PASS at 126 call
sites / 130 executions, hashes `8D4B00CE...C9B109` / `F3EA3525...37123A`. Coordinator typecheck, exact four-file lint,
diff hygiene, clone/cross-pair/proxy/accessor review, and forbidden-owner scan pass. The original two-file source-edit
owner produced candidate `6BE0A7F5...67CF2C` / `153AE281...A2B55` with positional fail-first, final `33/33`, all 17
focused owners, typecheck, and exact lint green. Coordinator review rejected it before audit: its mutated-model rows
replace the frozen source with an unissued clone, so they stop at workspace issuance and do not causally test the named
  ledger predicate. The prior auditor confirmed the omitted case was `X4UiCallModel.records`. Layout 7B-A.1 is now a
  focused-accepted dependency: fail-first preserved production `77097F6B...25E8D0` at `531/542`, with all eleven new
  complete-model checks red; final production/selftest hashes are `6D16A261...FA7484` / `8431C305...AE3BC` at
  `542/542`. Coordinator independently passed the layout suite, repository typecheck, exact two-file ESLint, diff hygiene,
  and exact source-edit/workspace hash parity. The private record accepts a structurally equal frozen complete-model clone
  but rejects reordered `calls`, reordered `records`, wrong literals, additions/removals, sparse/non-JSON/cyclic/custom
  data, cross-model content, and pair proxies; public program/evidence JSON is unchanged. Source-edit 7B-C.1 is active and
  owns only its production/selftest pair. It must first reproduce exact issued-model attacks against the canonical issued
  workspace/source, then enforce the new producer predicate at discovery and apply. No downstream UI is authorized yet.
Source-edit 7B-C.1 reproduced the exact missing behavior before production changed: reversed `calls`, reversed `records`,
same-call wrong literal, added record, and removed record were each projected through the real layout producer; each exact
issued altered pair was combined with the exact canonical workspace/source, issued 12 editable entries, and accepted a
mutating apply. Fail-first production remained `6BE0A7F5...67CF2C`; test hash was `48256F83...B8E5B`, exit `1`. Final
candidate hashes are `C90FFC54...BD2D9` / `50FA05F0...86F65` at `34/34`; all five rows now lock with zero editable
entries and refuse apply without mutation. Coordinator independently passed all 17 focused owners, repository typecheck,
exact six-file zero-warning lint, whitespace/diff/unsafe scans, corrected zero-caller census, and all 16 frozen hashes.
Fresh no-write hostile auditor `01a001ea-351c-77e3-915b-d98817ab9b60` passed every declared family except one
coordinator-supplied profile-cross oracle. It observed that a second legitimately issued projection of the exact same
complete model/source hash/target at another `uiScale` remained editable. Follow-up proved all 12 literal/range pairs,
source/call provenance, byte locality, untouched records, and reparse behavior were identical. No current-profile
authority exists in the four-argument 7B API, so another valid profile is not objectively foreign there. This is a
missing future 7D session-freshness binding and an overstrict/mis-scoped 7B audit oracle, not a demonstrated source-edit
authority defect. Corrected-scope zero-write auditor `01a0020e-14cb-70e2-ac63-fada7020cd17` then returned `CLEAN` with
all 17 focused owners, typecheck, exact six-file lint, source-authority/provenance `58/58`, frozen 7C/session/UI truth
`9/9`, no-fatal corpus census, and all 16 hashes unchanged. Its two valid profiles exposed identical 12-entry source-
literal identity/range/provenance and both completed the same byte-local edit; all forged, cross-model/source/target,
malformed, stale-CAS, accessor, proxy, and partial/refused cases remained non-authoritative. Batch 7B/7C is accepted at
the focused boundary. Batch 7D is unblocked and owns the exact current-session profile/program binding and drift-clearing
UI integration; it may modify only its declared three React files.
Direct-call insertion/deletion remains deferred until complete statement/anchor provenance exists. B119 remains
`PARTIAL / Not verified in game` pending Batch 7D, broad gates, rendered browser, package/deploy, C++ acceptance, and
in-game gates.
Batch 7D first produced a tests-first three-file candidate with 41 new assertions green, but coordinator review rejected
it before audit: UIBuilder returned closure acceptance before the functional updater proved live-current workspace CAS,
so a newer workspace could be preserved while the child installed a false accepted receipt. The correction reproduced
seven exact reds with first-candidate production frozen, then replaced synchronous acceptance with exact parent
readback: E remains pending, R alone accepts, and newer N remains untouched with typed `stale-parent-workspace` refusal.
Corrected hashes are `82DFB6DB...7A878`, `EC448373...F42F8A`, and `C2378669...62BFD5`. Worker and coordinator passed prior
7D `41/41`, parent-CAS `10/10`, pending SSR `2/2`, all eight focused dependencies, typecheck, exact lint, hygiene, and
frozen hashes. The corrected candidate remains unaccepted pending a fresh independent zero-write hostile `CLEAN` audit;
broad/rendered/deploy/game gates remain locked.
Fresh zero-write auditor `01a00250-c881-7820-a273-f9f03e00ca96` returned `FINDINGS` despite all eighteen focused suites,
full owner census, integration `7/7`, typecheck, exact lint, and independent parent/scalar/source matrices passing. The
`changed:false` branch still installed `Accepted no-op` before parent acknowledgement, so stale live workspace N could
be preserved while the child reported success against rendered E. The same three-file tests-first correction is active:
both changed and no-op submissions remain pending until an exact attempt-bound parent acknowledgement; no-op E-to-E
cannot self-accept from identity alone, N must refuse typed stale, and the functional updater remains pure. The audit
order's 63-character layout hash was a coordinator typo; the unchanged canonical hash is
`6D16A261043F54E10BC519124B55C6862E3A4009314BDED27E9A970EE0FA7484`. Broad gates remain locked.
This checkpoint is synchronized/read back at GitHub #41 comment `5290634571`, Notion comment
`3bc4618e-d15b-81bc-ab21-001dbed9fc9d`, and Drive revision
`AIroW37ORCYwemt1rD9CUx6i4hRFVi8xiwgXyDTuCQFbjRqS2GRL7LMDiZm6cLHWkcMQs49z4dgq8F3nYueoxh_fvIKi7IgNqdlKCKEKLUDZ`.
The later round-two rejection and issuance-boundary correction are synchronized/read back at GitHub #41 comment
`5296548001`, Notion comment `3bc4618e-d15b-81dd-8296-001d2637385a`, and Drive revision
`AIroW34TLCQVbsXzcBWUvza_Jtwgih4nauJlb-3Zecc3ENWrRXXUQL96Mp51BqBE-NZbCGdn8t5EXZghOMO63JkRLljOnFGeu40QJouA98ge`.
The corrected-scope 7B/7C acceptance and Batch 7D activation are synchronized/read back at GitHub #41 comment
`5298323330`, Notion comment `3bc4618e-d15b-81a1-ab3c-001dc866896e`, and Drive revision
`AIroW37NNOR--wcHWt3qDTrSBXf9NTn4fGwTKOE0PWyrVBodAccprsIZzy9Ac3eM-v74jvXQo57bdy4J-IKa2Nq1s0Z1a2icRtxvhRWXdVFI`.
Accepted Phase 3D is synchronized/read back at GitHub #41 comment `5270316387`, Notion comment
`3ba4618e-d15b-81ee-8cf1-001dcdff9a38`, and Drive revision
`AIroW35if-Cx5nsXoSQKHGAk7VDKAHLtFXhDPfEDUa2XxouivSpcjbVX22n0EwjskWclE29rTeQln1DBqDztQCWbPdr3bvLFIqwGDVQbi332`.
Broad precommit/oracle/E2E/build, installed Antigravity rendering/Problems inspection,
Canvas/source-edit integration, exact deploy hash, and in-game acceptance remain open; no focused preview is engine
proof.

**B119 zero-write deploy rehearsal checkpoint 2026-08-22 — HOST VERIFIED / REAL WRITE GATED:** Source-order review
reproduced that `POST /api/agent/deploy-verify {dryRun:true}` staged the workspace before returning `Nothing was
written`. Exact native Luna moved staging and game-directory creation below the dry-run return and expanded route
integration to fingerprint both targets, reject preview `stagingPath`, and prove normal deploy still writes staging.
Route integration is `489/489`; writer ownership is unchanged and its reconciled inventory passes `14/14`; complete
precommit passed twice, production build passed, and Graphify is `9820/24553/305`. Executable commit
`049205626107416b8da6f4ddb66bb5b77f214417` contains exactly `server.ts`, `scripts/route-integration.mjs`, and
`config/durable-writers.json`.

The corrected isolated preview resolved exact `x4_ai_influence`, targeted
`G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\x4_ai_influence`, returned no staging path, and planned
`0` additions / `43` managed writes / `39` deletions / `6` preserved roots. Candidate, standing staging, installed
extension, real-source menu, and installed menu fingerprints were identical before and after; port `3300`, all harness
ports, X4, Graphify, and native-worker census are clean. Full receipt and recovery gate:
`dev-docs/b119-ai-influence-dogfood/final-export-validation/`. No real mod/game byte changed.

**B119 isolated actual deploy/rollback checkpoint 2026-08-22 — VERIFIED IN ISOLATION / REAL WRITE GATED:** A
byte-identical scratch installed target actually deployed to `87` files / `16` directories / `10,815,054` bytes /
`cc8978ea...edfd8`, then history recovery restored exact `126 / 18 / 11,262,072 / a9046192...eb295` and rejected
replay with `409 RECOVERY_ALREADY_USED`. The first run exposed a real audit defect: successful history recorded zero
deletions/preserved roots even though preview and disk proved `39 / 6`. Exact native Luna
`01a0294e-322c-7f91-87bc-31f3629dd1ae` repaired only `server.ts`, route integration, and the registered writer
fingerprint by returning the existing request-local planner effect on successful deploy. Final route integration is
`491/491`; typecheck, focused lint, writer `14/14 + 8/8`, full precommit, production build, and Graphify
`9820/24553/312` pass. The post-repair AI Influence rerun proved response/history/recovery/tree equality at
`0 / 43 / 39 / 6`, exact rollback, one-use refusal, zero live-root drift, zero listeners, and X4 absent.
The executable repair is committed and pushed at `6f569e37ffc35da198796ca2adcafa3e1d6493b3`, with exact local,
tracking, and direct remote parity. The first commit-hook MCP child exited `3221226505`; its isolated rerun passed and
the complete hook retry passed before the commit was created.

The earlier `10,829,099 / ab8894...` independent prediction is superseded: it incorrectly preserved the installed
`14,250`-byte README even though the authoritative planner overwrites it with Forge's generated `205`-byte README. The
approved menu and generated README are the two changed resulting files; `85` stay byte-identical and `39` are removed.
Receipts are under `isolated-deploy-rehearsal-r1/evidence/`. No real mod/game byte changed.

Next unit is the explicit real-write gate, not more preview work: present the exact target, 39-file deletion census,
whole-tree recovery authority, and frame-refusal/UI-reload risk; wait for literal operator `go`; then deploy and inspect
X4. Overall B119 remains `PARTIAL / Not verified in game`; GitHub #41 stays open.

External projection readback: GitHub #41 comment `5380523328` contains both pushed commits and the exact isolated
deploy/rollback boundary; the Notion owner page contains and read back the same commit hashes, `0 / 43 / 39 / 6`,
`Not verified in game`, and literal-`go` gate. Drive remains explicitly partial because its required trusted-read bridge
rejects the Windows workspace path; no bypass was attempted. Receipt:
`dev-docs/b119-ai-influence-dogfood/final-export-validation/isolated-deploy-rehearsal-r1/evidence/external-sync-receipt.json`.

**B119 current `pipeline_test` pre-deploy checkpoint 2026-08-22 — VERIFIED bounded package validation / PARTIAL source-first geometry:** staged root `dev-docs/b119-x4-ui-pipeline-smoke/` and exact id `pipeline_test` contain only `content.xml` (`367`, `696c5c...`), `ui.xml` (`273`, `655331...`), and `ui/pipeline_test.lua` (`5378`, `b8f4c1...`) for six UI widgets; Forge readiness, Mod Doctor, lifecycle, and linter gates are green (`0` errors, `0` warnings, `33` explicit gaps), and one external validator run returned `VALID` with receipt `b0bf7a6e17e8a6522afe1355f262b1d761cfec07edeea21776edd0fc42e507bf`. Default-driver profiles at UI scale `1` and `1.4` exit with `canRender=true` and counts `1/1/6/12`, but geometry remains unusable with zero widgets/texts, so no frame/button capture is claimed. No real target was written, literal `go` has not been received, and overall B119 remains `IN_PROGRESS / PARTIAL / Not verified in game`; full evidence is appended to the plan and handoff.**

**B119 `pipeline_test` fresh-audit checkpoint 2026-08-22 — FOCUSED GATES VERIFIED / HOST GATES PENDING:** a fresh audit reproduced and repaired valid-whitespace Scene refusal plus forged edit-box-inset acceptance. Independent bundled-Node results are Scene `152/152`, PaintPlan `175/175`, CanvasRenderer `129/129`, whole-repository TypeScript green, exact twelve-file ESLint green, and B119 diff hygiene green. Package bytes and the one-instance validator receipt remain unchanged; both real targets remain absent. Antigravity is observed open and X4 absent, but complete precommit/build/oracle/E2E await the required human machine-quiet answer, and materialization/deploy await literal `go`. Overall B119 remains `IN_PROGRESS / PARTIAL / Not verified in game`.**

**B119 runtime-host reconciliation 2026-08-28:** Antigravity now has X4 Forge `0.0.70`; its installed server is
`D27EDFA7...3437` / `3,508,512` bytes, while the freshly validated current-checkout build is
`64FE71D0...E121` / `3,509,970` bytes. They are not byte-identical, so current-checkout `dist/server.cjs` remains the
runtime authority for this smoke and will reuse the existing Antigravity global-storage config through
`X4_CONFIG_DIR` without changing IDE settings.**

**B119 `pipeline_test` host-gate checkpoint 2026-08-28 — HOST VERIFIED / REAL WRITE AUTHORIZED:** The operator
supplied the exact gate answer: Antigravity open, X4 not running, machine quiet, and literal `go`. Under bundled Node
`24.19.0`, complete precommit, production build, official runtime-index oracle sweep `134/134`, serial isolated E2E
`104/104`, and full ESLint all exit `0`; ESLint reports `0` errors / `592` existing warnings. The E2E verdict receipt
is `07A5BE43...7B39`, proves child-close with `treeGone=true`, and left live/ephemeral ports and persisted config
unchanged. A direct oracle script invocation without its required server reproduced `0/133` fetch failures; the
official owner then passed `134/134`, so this is recorded as harness-invocation evidence rather than hidden. Both real
`pipeline_test` targets were still absent after validation. Explicit-path commit/push is next, followed by Forge-owner
materialization, deploy-verify dry-run/apply, exact-byte containment, and X4 truth. Overall B119 remains
`IN_PROGRESS / PARTIAL / Not verified in game` until the game supplies visible acceptance.**

**B119 same-profile Forge/X4 checkpoint 2026-09-02 — BOUNDED VERIFIED / PIXEL PARITY PARTIAL:** The installed
Antigravity host visibly renders one current bitmap for exact `ui/pipeline_test.lua -> menu.createFrame` at canonical
core/color authority and profile `2544x1353 / scale 1`. The exact four-file package independently renders in X4 9.00
at the same drawable profile; both buttons respond, the edit box accepts native key `a`, standard close removes the
panel, and the scoped log contains zero owned runtime or view-setup errors. Screenshot-space frame, button, row, and
edit-box geometry agrees after the Forge host's approximately `1.515x` display resampling, including `54.49` predicted
versus approximately `55` observed edit-box pixels. This corroborates proportional layout, not native pixel equality
or Zekton glyph parity.

The direct sidecar browser retained an initial refusal after exact reselection, but the supported installed host and a
causal mounted diagnostic both rendered and replaced exactly one canvas. No production lifecycle defect was reproduced
and no implementation/test change was retained. A temporary hardcoded `127.0.0.1:50239` test proxy was rejected; the
portable ephemeral variant remained unavailable while its fresh corpus manifest stayed `idle` for 30 seconds, then all
experimental edits were removed. Restored-tree gates pass: Source Editor P7 `12/12`, UI integration `21/21`,
TypeScript, exact ESLint, serial E2E `1/1`, `treeGone=true`, and ports `3100/3101` stopped. Full receipt:
`dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/same-profile-comparison.md`. Native installed-canvas
attributes/export, exact pixel comparison, complete Helper/widget coverage, AI Influence reconstruction, release
acceptance, and OpenVSX remain open; B119 and GitHub #41 stay `IN_PROGRESS / PARTIAL`.

The parent close rerun independently passed integration `21/21`, Source Editor P7 `12/12`, TypeScript, exact lint, and
mounted E2E `1/1`. No E2E listener remains; inert `%TEMP%\\x4forge-e2e-state-27916` was retained after exact cleanup
was rejected by host policy. No implementation, installed extension, mod, game, or release byte changed.

Durable sync is read back: repository checkpoint `27c1470ecd5179e8e40f9184e89c2df320ce698b`; open GitHub #41
comment `5512448232`; Notion owner still `In Progress / Partial`; Google Current Status revision
`ANLCKQnsxhUytocioHZoSZ9nBJM6LYlVGnu4fP12TgwXXEYIXv8VYVSmlEsZ2ONWb82TTAFecuEXEUd0mSx2inNNzbUj97FOTABQRY1qRxhw`.

**B119 native preview PNG checkpoint 2026-09-02 — VERIFIED INSTALLED EXPORT / PROFILE-SEMANTICS DEFECT
REPRODUCED:** The Source Editor exports only its already-mounted current `HTMLCanvasElement` as one deterministic
`image/png` and displays exact source digest, target, profile, effective UI scale, native dimensions, and literal
`Not verified in game`. Empty/refused/stale/non-DOM/malformed/mismatched/superseded and serialization-failure paths
refuse without false success. Fresh-eyes review reproduced and fixed a medium asynchronous race where distinct source
identities could share one sanitized filename on a reused canvas: callback completion now compares the exact issued
identity key. Source Editor selftest and P7 `12/12`, whole-repository TypeScript, exact three-file ESLint, focused E2E
`2/2`, durable-authority promotion, complete isolated precommit, production build, extension build, package inspection,
and probe `16/16` pass. Reversible Antigravity install is byte-matched to reviewed VSIX
`377B555B...35A21`; its current-only export is exactly `2544x1353`, `84,189` bytes, SHA-256
`473173A5...A076B` at entered scale `1`.

Native comparison disproved the prior same-profile assumption: that Forge image is `529` pixels wide while X4 is
`666`. Shipped `targetsystem.lua` states that `C.GetUIScale(false)` practically combines the user scale with the
resolution factor; for height `1353`, `1353/1080 = 1.252777...`. Re-entering that effective scale produced a second
installed-host PNG exactly `2544x1353`, `90,917` bytes, whose non-black panel is `663x203` at `x=940..1602`; X4 is
approximately `666` pixels wide and centered at `x=939..1604`. The residual width error is `3` pixels (`0.45%`). This
strongly validates the ported geometry and isolates a misleading profile-control contract: Forge consumes effective
`Helper.uiScale` while the UI presents it like X4's user scale option. Next is a bounded semantic correction that
derives/displays effective scale without redefining the layout kernel, followed by fresh installed/X4 comparison.
Overall B119 and GitHub #41 remain `IN_PROGRESS / PARTIAL`; exact glyph parity, complete Helper/widget coverage,
release acceptance, and OpenVSX remain open.

Durable projection readback is complete: checkpoint `1799dc6145e39a35c7e6f816da793fc691b53df0` has exact local,
tracking, and direct-remote parity; GitHub #41 comment `5514694526` contains the bounded verified/overall partial
boundary; Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` remains `In Progress / Partial` with the commit,
comment, and `1.252777...` result; Google Current Status revision
`ANLCKQnPV2tiWmIsxqdSqFY7Da7kUB6J0Vy4fh6H79AaVrF0TARj2mfS1QqH4NkY5724ZZDrMx2d5lqfuHVtVdYJUD6svM1BaIqew2yYe290`
contains one `HEADING_2` plus eight exact checkpoint paragraphs. X4 UI quick-reference card 25 records the user-scale
versus effective-scale trap; file SHA-256 is `6DF79A06976F26CC78EACECBE09F8FE5D17B2CAE43B44D7DC36F03AB2E5040DC`.

**B119 scale-control correction 2026-09-02 — SPECIFIED:** Exact source and Graphify reconciliation found no reason to
change the downstream profile contract: `profile.uiScale` remains effective `Helper.uiScale`. The bounded Source Editor
unit will expose derived user scale × drawable height / 1080 plus an explicit custom-effective fallback, relabel PNG
metadata/identity, and add causal pure/component/E2E negatives. It must preserve `Not verified in game`, then pass
package/install/native export and fresh X4 comparison before close. Full contract is appended to
`docs/plans/2026-09-02-b119-canonical-source-editor-game-pipeline.md`; overall B119 remains `IN_PROGRESS / PARTIAL`.

**B119 scale/cache checkpoint 2026-09-02 — IMPLEMENTED / FOCUSED PARTIAL:** The Source Editor now distinguishes X4
user scale from effective `Helper.uiScale`, derives the latter from drawable height, and exports deterministic
`effective-scale` evidence. A private renderer session retains at most eight detached canonical Zekton RGBA expansions
while still allocating fresh Canvas surfaces/ImageData. Canvas is `140/140`; Session is `8/8`; Source Editor/P7,
TypeScript, exact lint, Graphify, and complete precommit are green. The original repeated-render timeout is repaired:
the unchanged scale scenario passes `1/1` in `53.6 s`. One complete `3/3` browser receipt remains unavailable because
the Windows child exited `0xC0000409` after two passing scenarios and before the third result; no timeout/assertion was
weakened. Next is reversible package/install proof and a fresh `2544x1353 / user scale 1` Forge-to-X4 comparison.
Overall B119 and GitHub #41 remain `IN_PROGRESS / PARTIAL`; OpenVSX remains blocked.

**B119 native Zekton pen-advance checkpoint 2026-09-02 — BOUNDED VERIFIED / FULL B119 PARTIAL:** A guarded native X4
oracle proved all `36/36` width/height vectors and identified the prior compressed text cause: for the pinned shipped
Zekton 9.00 corpus, native pen width is `sum(horizontalBearing + advance) * size / 32`, while unwrapped height remains
`lineMetrics.outer * size / 32`. The existing FontMetrics/TextLayout chain now derives that width once, preserves both
raw fields, applies bearing once to bitmap placement, and refuses impossible composite geometry. FontMetrics `15/15`,
TextLayout `12/12`, every downstream UI entrypoint, TypeScript, exact lint, Graphify, complete precommit, production
build, extension stage/build/package inspection, and probe `16/16` pass.

The reviewed `26,288,585`-byte VSIX (`55031D...938F`) is installed in Antigravity with exact critical-byte parity and
a complete rollback backup. Its exact current `2544x1353 / user scale 1 / effective scale 1.252777...` PNG moves the
first button-label extent from `97-98` to `108-109` pixels versus fresh X4 `108-109`; the second moves from `95-96` to
`104-105` versus X4 `106`. Fresh X4 accepted both buttons, native edit-box input/focus retention, standard close, and
clean exit with zero owned runtime/view/Lua failures. All four final Lua copies remain `5,488` bytes /
`C1D9CD...2718E`, with no probe marker and X4 stopped.

The complete unchanged Source Editor browser suite now passes `3/3` in `1.9m`, child exit `0`, structured receipt
complete, `treeGone=true`, and clear ports `3100/3101`; this supersedes the earlier incomplete `2/3` receipt for current
acceptance without erasing it. Full evidence is in
`dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/`. Universal C++ frame acceptance, full
`helper.lua`/`widget_fullscreen.lua` and keep-out coverage, exact shader/alpha identity, arbitrary Lua, AI Influence
reconstruction, release acceptance, and OpenVSX remain open. Preview still says `Not verified in game`; B119 and
GitHub #41 remain `IN_PROGRESS / PARTIAL`.

Durable readback is complete: source checkpoint `0194d62e811305797bf8c18ac68158f035adc8d6` has exact local,
tracking, and direct-remote parity; GitHub #41 comment `5518404390`; Notion owner
`3b84618e-d15b-8190-821e-c0eb96f43d5a` remains `In Progress / Partial`; and Google Current Status revision
`ANLCKQnz-cGm-CH7Hg9hWcOGNdURH9xZ03PCCFwYQWPASmiyEr0CVP705Ov9ur9vngPDMFleaJ9yW8FeUTW2j7MKMRekmuhQywOOIqpiXzde`
contains the exact bounded/full boundary. UI quick-reference card 26, the capability-map delta, and the project AAR
record the native `.abc` pen-advance lesson.

**B119 installed Studio workspace-authority checkpoint 2026-09-02 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The
installed extension reproduced the cross-workspace failure as `WORKSPACE_ID_CONFLICT`: the target ID was in the JSON
body while the prior ID remained in `x-workspace-id`. One copied-header owner now replaces the stale authority (or
removes it for default fallback), while startup additionally requires an exact valid response echo before mutating the
extension handle/global state. Causal selftests, extension/root TypeScript, exact lint, Graphify
`10,172/25,586/330`, strict configured Scene `176/176` with MENU/HUB/COMM `3/3`, complete precommit, the
`1,848`-module build, package inspector `13/13`, and staged probe `16/16` pass. Final VSIX SHA-256 is
`132FB260D8CADBF90CC2120C581D1D73D22C78E097775999A4FE756927AEE04A`; installed extension bytes match. An installed
cross-target AI-to-Pipeline switch succeeded, its compiled handler window is identical in the final package, and the
final sidecar accepted a temporary AI-bound read key at HTTP `200` while retaining `403 / WORKSPACE_BINDING_MISMATCH`
for Pipeline; the keys were revoked. Two clean final-package restarts bound and accepted the current Pipeline Studio
tab. Both workspace JSONs and the exact Mod Workspace/loose-build/game trees remain byte-identical; X4 is absent.
The current persisted AI workspace is still historical source, so next is a backed-up paired-CAS import of the current
configured mod and a new three-menu gap census. Three-menu fidelity, AI reconstruction, final Forge/X4 comparison,
release acceptance, and OpenVSX remain open; B119 and GitHub #41 stay `IN_PROGRESS / PARTIAL`.
Durable projection readback is complete: checkpoint `104fa24ee21c9be135014f77f10bbff87452b789` has exact
local/tracking/direct-remote parity; GitHub #41 comment `5519542967`; Notion owner
`3b84618e-d15b-8190-821e-c0eb96f43d5a` remains `In Progress / Partial`; and Google Current Status tab `t.0` is at
revision `AIroW357C_UGd302aKKSXBH8TxCjQtwshU69T33JkZOtN2vnczFFByE5KSL_n2YXQmhArdAS1D26Inu5HqxrZOkp8hfrotvx2E6seWQ-k7uD`.
The Drive trusted read found zero protected controls and final readback shows one peer heading plus eight body paragraphs.

**B119 current AI workspace import checkpoint 2026-09-03 — BOUNDED VERIFIED / DYNAMIC-TEXT UNIT SPECIFIED:** The
configured `x4_ai_influence` source is now persisted in `x4 AiLive` through one byte-exact backup, read-only import,
same-read content/snapshot CAS, immutable dry-run, committed guarded write, and durable recovery receipt
`ar_c554bd122712fed927e34f59cf9b8839b54d082a08811ade869348184376cf2f`. MENU/HUB/COMM source pins exactly match
disk; Pipeline Test, source mod, loose build, and game target remain outside the write surface; X4 is absent. Strict
Scene is `176/176` and executes all `3/3` current sources. A live-corpus in-memory causal test reproduced COMM at
`0` widgets and proved that replacing only its dynamic title expression yields the title plus both buttons (`3`
widgets / `52` glyphs) while the real Lua SHA remains unchanged. The next documented unit narrowly permits opaque
preview-only **string** samples for ordinary call-shaped text, while retaining hard rejection for C++/Helper and all
numeric/boolean calls. Overall B119 and GitHub #41 remain `IN_PROGRESS / PARTIAL / Not verified in game`; no OpenVSX
publish is authorized by this checkpoint.

Durable projection is read back: repository checkpoint `b6f2be9d41cc367da568c533c9071742d42bcc5b`; GitHub #41
comment `5520171578`; Notion owner unchanged at `In Progress / Partial`; Google Current Status revision
`AIroW37mol_WtZzxMvoIK0a0Lvd3aX3IpD6XMPhdb7_ceDfIGPrN8fN2sDhzOAFNIkwzHccOyk63vzRM2mwEd9ivtabZPNXgy3Q5NA8L4lfJ`.

**B119 opaque dynamic-text sample checkpoint 2026-09-03 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The existing
source-bound preview catalog now issues opaque user-supplied values for ordinary call-shaped text only when the value
is dynamic/unknown and the requested type is exactly string; Forge still does not execute Lua, and numeric/boolean,
`C.*`, and `Helper.*` calls remain excluded. Configured Layout is `706/706` with zero skips, EditorSession is `8/8 +
7/7`, strict Scene is `176/176` with MENU/HUB/COMM `3/3`, exact-path lint/type/diff gates pass, and full precommit ends
`OK`. With the actual configured Zekton descriptor (`outer=52`), supplying COMM lines `505-506` restores the title at
`1298x22 @ 32,27` plus DOSSIER/END at `279x25 @ 1332/1613,27`; the unsupplied state remains honestly zero-widget.
Source SHA `88FAB05A...63511`, clean mod HEAD `4c0a422`, and `Not verified in game` remain unchanged. Next is an exact
package/install/native Forge preview checkpoint, then controlled deploy/X4 comparison; OpenVSX remains deferred and
GitHub #41 stays open.

Opaque-sample durable sync is read back: source checkpoint `817490d9234305b86754ecedb08eea0cd149d5e7` has exact
local/tracking/direct-remote parity; GitHub #41 comment `5521085100` exists with the issue open; Notion owner
`3b84618e-d15b-8190-821e-c0eb96f43d5a` remains `In Progress / Partial`; and Google Current Status tab `t.0` is at
revision `ANLCKQlD-Zec95PyKUeZzzv92wc_HokmnRBmXgZ3FQrC5iXutq3uRlOu477v3JMUURoZgVWazRF8XGKfwndWAfjB8RiXkeMBYKJW1RfA_zLa`

**B119 packaged opaque-preview install checkpoint 2026-09-03 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The exact
`bb68a34` candidate was rebuilt in an isolated `C:` clone after a first package read reproduced an `F:` disk surprise
removal and left a fail-closed invalid ZIP. The accepted VSIX is `26,288,744` bytes /
`B4CB6BAE032BDBAEFA9CE4451A35EDF3293015C99CF46DF4E66DFF7B7FE19C98`, passes staged probe `16/16`, inspector
selftest `13/13`, and package inspection (`2,107` entries / `71,587,579` unpacked bytes). A byte-complete installed
backup is retained. Antigravity's GUI-style install arguments reproduced an exit-0 no-op; its Electron CLI then
performed the same-version replacement, with zero package/install payload mismatches. Fresh installed PID `54088` and
sidecar PID `47500` serve exact JS/CSS hashes on `127.0.0.1:52236`; root/reference return `200`, protected unauthenticated
config returns `401`, both persisted workspace hashes are unchanged, and X4 is absent. Installed current-COMM visual
inspection, deploy identity, native X4 comparison, original-brief audit, release acceptance, and OpenVSX remain open;
B119 and GitHub #41 stay `IN_PROGRESS / PARTIAL / Not verified in game`.
with the exact checkpoint heading and body read back.

**B119 current COMM Forge/X4 checkpoint 2026-09-03 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The installed
`817490d` Source Editor selected exact current `aic_comm.lua -> comm.display` at SHA-256 `88FAB05A...63511`, accepted
only its issued opaque title sample, and exported the mounted `2544x1353 / user 1 / effective 1.252777...` canvas as
`96,514` bytes / `263A8F6A...C9CD`. Forge deployed the unchanged configured AI Influence tree with a ready whole-tree
recovery; source and game COMM remain `27,481` bytes / `88FAB05A...63511`. Fresh X4 opened the compact panel through
`Speak to AI`, expanded the exact COMM, transitioned through DOSSIER, closed normally, and exited with zero
view-setup, COMM-failure, or Lua-traceback signatures. Against the exact drawable crop, shared title/button bounds are
within `5` horizontal and `2` vertical pixels; idle blue is `[0,60,102]` in Forge versus approximately `[0,57,102]`
in X4. This verifies the current-source static header path and real engine acceptance, not the runtime-built COMM body,
three-menu wrap/truncation parity, complete Helper/widget/keep-out coverage, AI Influence reconstruction, release
acceptance, or OpenVSX. Overall B119 and GitHub #41 remain `IN_PROGRESS / PARTIAL`; preview remains
`Not verified in game`. Evidence: `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260903/`.

**B119 three real-menu pixel-parity checkpoint 2026-09-05 — ORIGINAL BRIEF 6/6 VERIFIED / FULL B119 IN PROGRESS:**
Forge authored, guarded, staged, deployed, and rendered exact `ui/pipeline_test.lua` (`13,202` bytes /
`E75DEF8C...8EC0`) for three separately registered X4 menus at one exact `2544x1353`, user-scale `1.0`, effective-scale
`1.252777...` profile. X4 visibly accepted A/B/C and completed `A -> B -> C -> A` with zero scoped view/Lua failure
signatures. The closed receipt accepts `125` column/row/button/wrap/overflow features with maximum normalized delta
`3 px <= 5 px`; wrapped baselines and visible truncated strings match exactly, while a `6 px` perturbation is rejected.
Installed package parity, focused suites, typecheck/lint/build/probe, runtime oracles `134/134`, serial E2E `106/106`,
and six-image human review pass. This closes the sole remaining literal brief row, not the release program: twelve-image
AI Influence reconstruction, native Save As false-success repair, release acceptance, and OpenVSX remain open. Preview
still says `Not verified in game`; exact deploy plus X4 remains authority. Exact record:
`docs/plans/2026-09-03-b119-three-menu-pixel-parity.md`.

**B119 linter-first dogfood and `0.0.71` release checkpoint 2026-09-06 — RELEASE ARTIFACT UNIT VERIFIED / FULL B119
PARTIAL:** The implemented source-backed linter passes direct selftest `140/140`, including clean, warning, blocking
`addTable(24)`, whole-frame, and conversation-close symptom coverage. Final VSIX
`vscode-extension/x4-forge-studio-0.0.71.vsix` is `26,296,414` bytes / SHA-256
`3143296C72B5A8B6A526148CA98048FA340FA534BB41A1D890F930DA69FB054B`; package inspection is `2,107` archive entries /
`2,105` payload files, and installed parity is exact for those payload files aside from the expected IDE
`.vsixmanifest` extra. Installed runtime oracles pass `134/134` at port `56347` with `X4_FORGE_TIMEOUT_MS=90000`;
serial E2E passes `106/106` with `treeGone=true`; production build, stage/probe `16/16`, precommit, and Graphify
`10,396/26,075/336` pass/refresh. The final install backup remains at
`C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-0.0.71-final-install-backup-20260906T024434135Z`.

At `2026-09-06T06:59:36Z`, OpenVSX returned HTTP `200` for version `0.0.71`, `/versions` contained `0.0.71`, and
the independently downloaded artifact from the public version URL matched the local VSIX exactly by size and SHA-256.
At `2026-09-06T07:08:17Z`, `/latest` also returned `0.0.71` with the same public download URL. The earlier `0.0.70`
result was transient indexing lag that resolved, not a publish failure or remaining blocker. The AI Influence census
remains `PARTIAL / IN_PROGRESS`: exact cross-menu few-pixel game parity, exact scale correlation beyond bounded
fixtures, and full twelve-image reconstruction/current in-game validation remain open;
`Not verified in game` and no universal Helper/widget parity claim remain. Full record:
`docs/plans/2026-09-05-b119-ai-influence-visual-dogfood.md` and
`dev-docs/b119-ai-influence-dogfood/visual-release-20260905/CENSUS.md`. No capability-map delta.

**B119 deterministic-math `0.0.72` checkpoint 2026-09-06 — BOUNDED VERIFIED / FULL B119 PARTIAL:** The existing
source evaluator now admits only closed `math.floor/ceil/min/max` calls and fails closed when source-visible aliases,
wrappers, dynamic global reads, control-flow merges, mutations, or opaque escapes can invalidate math authority.
Focused gates pass at call model `102/102`, layout `721 passed + 1 standing skip`, linter `140/140`, typecheck/lint,
runtime oracles `134/134`, serial E2E `106/106`, production build, complete precommit, and staged probe `16/16`.
Installed Antigravity `0.0.72` exactly matches all `2,105` package payload files and, for exact current
`aic_menu.lua -> menu.display`, exposes `19` owner-issued samples and `33` branch boundaries. The causal sample replay
transitions to one current `2560x1440` Canvas when `_choiceY=979` is issued, visibly rendering only the static edit
box plus `SEND` and `END`; omitted runtime content remains absent and `Not verified in game`. OpenVSX `/latest`, the
direct version endpoint, and an independent download all prove `0.0.72`; public/local bytes are `26,303,425` with
SHA-256 `5C6B2C20C42E93359DED03DBF199F00C1C858AFCC579388F10F94818CDDEA4B0`. Full current-path twelve-reference AI
Influence reconstruction and universal engine acceptance remain open; overall B119 stays `IN_PROGRESS / PARTIAL`.
Full record: `docs/plans/2026-09-02-b119-canonical-source-editor-game-pipeline.md`. No capability-map delta.

### B115 · Forge Capability Convergence `in_progress` (P0, PRIORITY OVERRIDE)

Ken explicitly promoted GitHub initiative #9 and child requests #10–#21 above the active R13 close on 2026-07-31.
This is a bounded extension program, not a Forge rewrite: reuse the existing validator, workspace registry/CAS,
artifact/release pipeline, runtime watcher, Agent API, MCP shim, built-in harness, and UI shells. W0–W2B are now
`VERIFIED`; the next bounded unit is W3 transaction/receipt authority, which must be reconciled and specified before
implementation. Full contract, phases, gates and native-capability disposition:
`docs/plans/2026-07-31-capability-convergence.md`.

**Hard gates:** W7 X4 engine merge-law is now `VERIFIED`; W8-W9 Effective Tree authority and the broader B115
program remain open. No source-writing rebase or network-driven update automation before the Phase 2 review stop and
recorded Ken decisions; no public release without explicit release authorization and all applicable packaged/installed
gates.

**W0–W1 checkpoint (2026-08-01): `VERIFIED` through B116.** The canonical eleven-capability registry, exact route/MCP
disposition oracle, constrained preview/validation adapters, CLI discovery, live MCP narrowing, Agent Bridge contract
state, and input-before-authority/spend negatives are implemented. The final current-source gates include 347/347
route integration, 129/129 runtime oracles, 82/82 reference integration, 94/94 isolated E2E, exact r2 VSIX inspection,
7/7 installed-file parity, and a real Antigravity extension-host/rendered close-remount profile. W2 is unlocked as the
next bounded specification. Full close: `docs/plans/2026-07-31-capability-convergence.md`.

**Combined installed gate (2026-08-01): attempt 1 `FAILED`; B116 remediation `VERIFIED`.** The first package exposed a
multi-minute renderer stall. B116 replaced unchanged full-snapshot polling with conditional summary polling, preserved
truthful pause/resume and workspace authority, and closed the exact installed boundary: VSIX SHA-256
`C5B46B44FC60AB804B5B8E561C2C41DD1B3DFB466801A5FAC6098361737A8565`, installed parity 7/7, Bridge close 173 ms,
remount to Connected with 11 capabilities in 3,031 ms, stable real extension-host PID, zero new unresponsive events,
and no five-second sampled or traced Forge stall. Attempt-1 evidence remains in
`docs/plans/2026-08-01-b115-r13-installed-gate.md`; verified remediation is in
`docs/plans/2026-08-01-b116-installed-renderer-profile.md`. No public publish occurred.

**W2A close (2026-08-01): `VERIFIED` through B117.** Exact v4 authority, deny-by-default enforcement, finite
read/write/deploy presets, Studio-only sensitive routes, workspace-mode parity, caller-key provider isolation,
candidate promotion and truthful Agent Bridge copy crossed 378/378 routes, 129/129 oracles, 94/94 full E2E, staged
probe 16/16, VSIX inspection 13/13, 2,089-file installed parity and real Antigravity rendering. B64-SEC5 remains a
separate Ken-gated full-Studio-bearer boundary. Evidence:
`docs/plans/2026-08-01-b117-exact-agent-route-authority.md`.

**W2B close (2026-08-01): `VERIFIED` through B118.** Exact contract-only key restrictions, protected caller-effective
discovery, monotonic MCP projection, strict creation envelopes and shared Studio/native receipt verification crossed
73/73 key, 400/400 route, 129/129 oracle, 5/5 focused browser, 96/96 full E2E, staged/package, 2,089-file installed
parity and real Antigravity guidance gates. Existing preset records remain compatible; no parallel permission engine
or dispatcher was added. W3 receipts, B64-SEC5 and generic built-in-harness dispatch remain separate. Evidence:
`docs/plans/2026-08-01-b118-effective-agent-authority.md`.

**W3A checkpoint (2026-08-02): `VERIFIED`.** One strict `forge.action-receipt.v1` schema, deterministic operation and
content identity, contained atomic store, complete lifecycle/recovery truth, and exact fail-soft Agent History
projection substrate crossed 116/116 focused checks, 73/73 history checks, 130/130 runtime oracles, 400/400 routes
against a fresh production bundle, and all static/governance/build gates. No production mutation path consumes the
receipt yet; W3B integration and W3C surface parity remain.
Evidence: `docs/plans/2026-08-02-w3-action-receipt-authority.md`.

**W3B0 checkpoint (2026-08-02): `VERIFIED`.** The reviewed coverage oracle classifies all 82 current non-GET routes
and 48 durable/host/browser/database surfaces, rejects semantic and inventory drift, and resolves exact W3A prepare
input or stable refusal without invoking a handler. Candidate/promotion, 400/400 fresh-bundle routes, 130/130 isolated
runtime oracles, precommit, and Graphify are green. No production mutation emits a receipt yet; W3B1 addressed-state
integration is next. Evidence: `docs/plans/2026-08-02-w3b0-action-receipt-coverage.md`.

**W3B1 continuation (2026-08-04): `IN_PROGRESS / PARTIAL`.** Workspace replace/merge remain the committed 2/5
checkpoint. Workspace-create is now the runtime-green third route: its 16/16 focused adapter plus fresh production
build and external HTTP harness passed 443/443, including receipt reopen/hash readback, replay/conflict, distinct
client identity, registry deltas, compensation truth, and redaction. Teardown removed the task temp root, left ports
3000/3001/3100/3101 free, and preserved the exact dirty-worktree fingerprint. The replacement E2E repair retains its
strict terminal-report inspector and 35/35 runner selftest. Its process safety foundation now adds bounded Windows/
POSIX command capture with fail-closed dispatch (30/30), monotonic repeated-snapshot ownership, reparented-child
seeding, exact PID-reuse reporting, and disappearance proof (30/30), on top of the 37/37 parser and sanitized real-
WMIC readback. Its pure descendant-first termination planner passes 21/21, including a 50,000-row iterative chain.
The pure two-plan recheck now passes 18/18: it validates and clones exact planner results, requires monotonic captured
identity, fails closed on hostile/malformed shapes, and authorizes one stable target only when an immediate second
 plan has no new child and retains the same first PID+creation token. The bounded async wrapper now passes 10/10 with
 injected no-process snapshots: first-gone, stable target, new-child/target-loss replanning, second-gone, invalid input,
 and both capture/plan failure layers. The exact Windows command adapter passes 6/6 with argument-array-only
 `taskkill.exe /PID <pid> /F`, no `/T`, bounded output/time, sanitized failures, and explicit POSIX identity-
 insufficient refusal. The finite disappearance executor passes 8/8: every command follows an immediate stable
 two-snapshot identity recheck, new descendants force replanning, exact identities are commanded at most once, and
  success requires a later fresh `treeGone` observation. Fresh-eyes review corrected a well-behaved-proxy acceptance
  gap before this foundation was accepted. A new thin spawned-ownership sampler passes 8/8 five consecutive times:
  it derives the exact root creation token from the accepted bounded snapshot, captures the initial closure, advances
  monotonic ownership through the accepted repeated owner, preserves reparented children, and refuses reused occupants.
  The runner lifecycle now wires that sampler and the disappearance executor under an independent outer timer,
  terminal-report grace, single settlement, and listener/timer cleanup. Its no-process oracle passes 12/12 five times;
  runner policy/completion checks pass 46/46; and the fake-child integration oracle passes 7/7 five times without
  launching a process. The full static bundle and typecheck pass; lint remains 0 errors / 592 warnings. The full
  isolated E2E supervision lifecycle is now `VERIFIED`: exact 96/96 with child-close, `treeGone=true`, schema-v2
  receipt reopen/content verification, and containment proof; ports 3100/3101 closed, ephemeral state removed, and
  `npm run precommit:check` OK. This lifecycle close does not prove snapshot-restore or bulk-apply route semantics.
  W3 remains `PARTIAL` at 3/5: route-specific finalization/compensation/fault-injection and real-child
  receipt/restore/bulk acceptance remain open.
Evidence:
`docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`.

**W7 X4 engine merge-law checkpoint (2026-08-05): `VERIFIED`.** X4 9.00 build `611726` / Steam `23660954`, run
`w7_20260805_a97e2186_03`: 11/11 markers, 9/9 semantic cases, 898 focused assertions, schema 143/143, particle
544/544, diff overlay 60/60 over 176 official diff files, routes 443/443, oracle 131/131, precommit OK, E2E 96/96,
package probe 16/16, installed Antigravity schema/corpus/validator proof, and no Failed to fetch. Reconciled code
routes diff-rooted MD/AI through merged diff+domain schemas and skips them in dedicated validators. Evidence:
`docs/plans/2026-08-04-x4-merge-law-oracle.md`. W8-W9 Effective Tree and the broader B115 program remain
open.

### B110 · Kimi R1-R21 execution program `in_progress` (P1, DURABLE LEDGER)

The complete recommendation set is now reconciled instead of living in the deleted KNOWN-BUGS addendum.
Current verdict: R1–R17 plus R19–R20 VERIFIED; R18 PARTIAL; R21 OPEN.
Execute only as bounded workflow tasks in the recorded order—never as a sweeping
cleanup—and update each row after every implementation. Ledger:
`docs/plans/2026-07-29-kimi-recommendations-ledger.md`.

**Closed bounded units:** R3 uniform API failure envelope, R9 uniform timeout policy, R10 managed-sidecar
parent-death/orphan prevention, R19 packaged-VSIX clean-runner CI, and R20 fail-closed flake policy — VERIFIED
2026-07-30; see ROADMAP and their task plans. R1+R16 shared validation rules are also VERIFIED on exact-SHA public
Quality; see `docs/plans/2026-07-30-project-rules-schema.md`. R6 deterministic diagnostic guidance and guarded exact
suppression is VERIFIED in `docs/plans/2026-07-30-diagnostic-guidance-suppression-ui.md` and Open VSX 0.0.60.
**Closed validation-truth unit:** R2 content-addressed last-green validation baselines and new/resolved warning delta
is VERIFIED in `docs/plans/2026-07-30-validation-delta-baselines.md`, installed/published as Open VSX 0.0.61, with
public-byte parity and exact-SHA Quality `30592259549`.
**Newly closed bounded units:** R7 durable-writer discipline and R11/R14 conflict/recovery are `VERIFIED` on
2026-07-31. R7 has full route/oracle/E2E/staged/package/precommit evidence. Public-parity 0.0.62 is installed in
normal Antigravity, where a real disposable 409, destructive overwrite recovery, exact restore, and replay refusal
were visibly proven. See their plans and ROADMAP closes.

**Closed architecture unit:** R8 request-addressed identity + R17 true multi-workspace are `VERIFIED` on
2026-07-31. A bounded atomic registry owns immutable IDs and per-record CAS; Studio tabs and agent keys carry
explicit authority; duplicate names, migration/restart, history/recovery/readiness isolation, and denial paths are
green. Stable Open VSX 0.0.63 is installed/rendered in Antigravity and its 17,907,329 public bytes exactly match the
inspected local VSIX. Evidence: `docs/plans/2026-07-31-workspace-authority.md`.

**R13 close:** one scheduler for continuous polling is `VERIFIED` through B116. Summary-first transfer, conditional
full-snapshot adoption, truthful pause/resume, paired workspace authority, installed parity, real extension-host CPU
profiling, and rendered close/remount are green on the exact r2 package. Running-game LIVE experience remains the
separate B114 gate; no public publish occurred. Evidence:
`docs/plans/2026-07-31-continuous-polling-scheduler.md`.

**Post-Kimi authorized research program (queued; do not start before R1-R21 close):** reconcile
`F:\Downskies\X4 Foundations Modding Tooling Research for IDE Extension Opportunities.md` and
`F:\Downskies\X4 Foundations Modding Tooling — Market Workflow & IDE-Opportunity Research.md` against the live
Forge capability map and current community landscape. Separate outdated-tool replacement opportunities from
high-rated-tool workflow patterns; challenge each against existing Forge infrastructure, then specify/implement only
bounded improvements with stronger design and current evidence.

### B111 · Remove duplicate header action strip `spec'd` (P1, user screenshot 2026-07-31)

**[REPRODUCED]** `App.tsx` renders persistent Sync Mod, AI Engine, Agent API, Report Bug, Studio Settings, and Reset
buttons immediately beside a hamburger menu containing the same actions. Responsive hiding changes how many copies
are visible but does not remove the duplicate ownership. Reconcile the few non-duplicated header controls, retain one
discoverable action owner at every width, preserve keyboard/automation action IDs, and visually prove no capability
was lost. User evidence: `codex-clipboard-c6ed74fe-82fb-4a8c-818b-88b500d6ad65.png`.

### B112 · Diagnostic explanations and navigation parity `spec'd` (P1, user screenshots 2026-07-31)

**[REPRODUCED]** `XSD_UNKNOWN_ELEMENT` currently explains itself with generic text ("deterministic project check")
instead of explaining what `<diff>` means, likely schema-routing/root-document causes, evidence, and bounded repairs.
Canvas shows `PAN TO TERMINAL` only when `PackageDiagnostic.nodeId` resolves; file/line/sourceRef diagnostics receive no
navigation fallback. Reconcile diagnostic provenance through source spans/import mapping, upgrade deterministic
code-specific explanations, and give every locatable finding an honest action (focus node, open file/line, or say why
it cannot be located). Do not fabricate a node match. User evidence: `codex-clipboard-2ef3aa7f-2080-4497-9d2f-0c592278b0bb.png`,
`codex-clipboard-4cdff066-788b-4dc8-a237-274d9ad4da73.png`, and
`codex-clipboard-30a8d251-044f-4fe7-a890-6e7e8ea71142.png`.

### B113 · Reconcile Playtest "Ingame File Syncer" with Deploy + Verify `spec'd` (P1, user screenshot 2026-07-31)

**[REPRODUCED copy contradiction; behavior not yet runtime-proven]** the card says it writes directly to the live X4
extensions folder, labels `modWorkspacePath` as a staging workspace, and exposes both `Save XML` (`saveToDirectory`)
and `Deploy + Verify`. Trace the actual target and safety/validation guarantees of both paths. Remove or relabel any
redundant/unsafe action; one user intent must have one clear path, and direct live writes must never bypass the
deploy/verify contract. User evidence: `codex-clipboard-c40c246d-0b6f-4ecf-a054-a774d33b99a0.png`.

### B114 · Re-certify LIVE game telemetry after architecture changes `spec'd` (P0 experience gate)

The R13 scheduler migration owns source/runtime regression proof, but completion also needs an actual running-game
experience gate: LIVE must leave "connecting", report the real debuglog/bridge state, map firing cues to green badges,
map attributed errors to red X badges, and stop cleanly when disabled. No cues/log/game means `PARTIAL`, not proof.
Preserve the user's canvas and use a scratch/probe mod or reversible fixture. User evidence:
`codex-clipboard-a1ee7438-fe58-44e4-8147-734d7b331751.png`.

### B98 · Deploy fails EBUSY whenever X4 is running — copying byte-identical files `in_progress` (P0, TOP)

**[REPRODUCED 2026-07-26 by the mod agent, traced in source not guessed]** A real in-game verification
of mod change #298 failed:

```
EBUSY: resource busy or locked, copyfile
  '…\.x4_ai_influence.x4forge-next-…\lua3p\luasocket\core.dll' -> '…\x4_ai_influence\lua3p\luasocket\core.dll'
locked-root rollback also failed: EBUSY … (the SAME file)
```

**Chain:** `rename(targetPath, backup)` fails → `isLockedRootRenameError` → true →
`replaceLockedDeploymentInPlace` → `synchronizeRegularTree` copies **every** file including unchanged
ones → EBUSY on the one file Windows will not let anyone overwrite. **This is a defect in the B83
fallback I shipped.**

**Why that file:** `lua3p/luasocket/core.dll` is the LuaSocket NATIVE DLL. X4 loads it via
`require("socket.core")`, so Windows holds an exclusive handle for the whole game session. It is a
vendored third-party binary that never changes between deploys. The agent measured every file by
opening it ReadWrite/None: **1 of 49 is locked** — `luasocket/core.dll`. Even `luasec/ssl.dll` is free
(SSL only initialises on an HTTPS call).

**Impact — this is the B96 unlock.** Today: close X4 → deploy → relaunch → load save (~4 min of pure
loading) per change. With this fixed: deploy → F11 → `/refreshmd` → `/reloadui`, game never closes.
The in-game reload path already works; only the deploy blocks.

**Fix:** in `synchronizeRegularTree`, skip the copy when the destination is already byte-identical —
size first (cheap reject), then content hash. Identical file → no copy → no EBUSY. The rollback path
uses the same function, so this fixes both halves of the reported error. It is also simply correct:
copying a byte-identical file is pure waste on every deploy, locked or not.

**MUST NOT BREAK (the agent's constraints, all four kept):**
1. A file that genuinely DIFFERS and is locked must still **fail loudly**. Never silently skip a write
   that was actually needed — that converts a visible EBUSY into an invisible stale deployment, which
   is strictly worse.
2. `verifyExpectedFiles` must still run and still pass. A skipped file is correct *because* it is
   identical; verification confirms that rather than being bypassed.
3. **Never mtime alone** — copies do not preserve it reliably. Size + hash.
4. **No exclude list, no `.forgekeep`.** Excluding `core.dll` risks it being DELETED; `.forgekeep`
   means "do not delete", not "do not overwrite". Content-identity is the right axis.

**Acceptance (the agent's test):** with X4 running and a save loaded, change exactly one file
(`ui/addons/ai_influence_chat/aic_uix.lua`), deploy → **must succeed with X4 still running**; the
changed file's hash in `G:` matches the workspace; `core.dll` untouched. Negative: make `core.dll`
genuinely differ, deploy with X4 running → must FAIL with a clear error, never silently skip.

### B97 · `/api/agent/deploy` — deprecate in the RESPONSE, do not retire `spec'd` (P1)

The agent is a live caller and hit it minutes ago for a real 409. Retiring it silently breaks working
tooling mid-session. Keep it functional; add `deprecated: true` + the replacement route to the
response body so callers learn while things still work.

### B94 · Phantom string ids — first approach FALSIFIED, still open `spec'd` (P0)

**ATTEMPTED AND REVERTED 2026-07-26.** The obvious heuristic — *inside a list literal that already
contains a KNOWN faction id, an unknown sibling token is a phantom* — was implemented, measured, and
**failed on both sides**:
- **False positive on the real mod:** it flagged `broker` in `md/ai_influence_chat.xml`. Real lists
  mix faction ids with role/tag tokens, so "has a known faction neighbour" does NOT prove the
  position is a faction position. The project's bar is zero false positives on the real corpus.
- **It still missed the target.** `riptide` lives inside an XML attribute as `&apos;`-escaped text,
  which the expression masker treats differently than a bare list literal.

Reverted rather than shipped: a lint that cries wolf is worse than no lint (same reason B62e was
rejected). **What the next attempt must handle:** entity-escaped attribute payloads, and a
position-proving signal stronger than a known neighbour — e.g. the MD property/parameter the list is
being assigned to, which the scriptproperties model can type. Order ids still need a canonical set
established first; do not invent one.

### B94-original · the incident evidence (kept)

**[REPRODUCED 2026-07-25 by the mod agent]** It poisoned one file with all seven defect classes that
have really shipped here. The validator now catches **five**: unknown property (`$st.manager`), wrong
property name (`ware.{}.avgprice`), undeclared attribute (`recursive="true"`), `<delay>` inside
`<actions>`, and `@` combined with `?`. Result: `ok:false, scriptPropertyWarnings: 3, schemaErrors: 5`.
**Its two misses are the same class:** string literals sitting in ID positions — `'riptide'` (phantom
faction in a list literal) and `order="AutoTrade"` / `"AutoMine"` (phantom order ids). `referenceWarnings: 0`.

**Why they slip through:** `referenceLint.ts` matches `faction.<id>` / `ware.<id>` chains and a few
explicit attributes. A bare quoted string is invisible to it — to the schema `'riptide'` is just a
string; to the game it is a reference that resolves to nothing.

**Bounded repair, cry-wolf-safe (this project's bar is 0 false positives on the real corpus):**
1. **List-literal heuristic for factions** — inside a list literal that already contains ≥1 KNOWN
   faction id, an unknown token of the same shape is a phantom. High precision because the list
   itself proves the position is a faction position. Catches `riptide`.
2. **Order ids** — needs a canonical order set first. Establish where it comes from (aiscript file
   names in the unpacked corpus vs. a declared list) BEFORE linting; do not invent one.

**Acceptance:** the agent's poisoned fixture flags `riptide` and both order ids; **all 15 real MD files
of `x4_ai_influence` and a representative vanilla MD sample produce zero new warnings**; findings carry
file, line and suggestions.

### B95 · debug-watcher `runtimeErrors` false positive — the one runtime signal, and it lies `spec'd` (P0)

**[REPRODUCED]** `debug-watcher/brief` reports `runtimeErrors: true` on `x4_ai_influence` because the
mod's own debug lines carry an `[=ERROR=]` prefix and the watcher pattern-matches them. The agent
discovered this itself, worked around it, and **now ignores the field entirely and greps the log
directly** — so the Forge's only runtime signal is not merely wrong, it is retired by its user.

**Bounded repair:** distinguish ENGINE-emitted errors from mod-authored log text. The engine's own
error lines have a known shape; a `debug_text` line authored by the mod does not become an error
because it contains the word. Ship with the mod's own marker convention excluded, and report *why* a
line was classified as an error so the next false positive is diagnosable rather than discovered.

**Acceptance:** the real `x4_ai_influence` debuglog reports `runtimeErrors: false` when only its own
`[=ERROR=]`-prefixed debug lines are present; a genuine engine error still reports true; the response
names the matched line for each error counted.

### B96 · The runtime frontier — where the agent's time actually goes `spec'd` (P1, the biggest prize)

The agent's closing point, and it is not on anyone's list: **everything the Forge does stops at
deploy.** Its real loop is deploy → launch X4 → load save → play → grep debuglog → discover it did not
work → repeat, at **20+ minutes per iteration**, and that is where nearly all its time goes. The static
side is now nearly solved; the runtime side is untouched.

Wanted, in its words: *"your cue never fired"*, *"this cue errored 40 times"*, *"this script was
dropped"*. It rates a trustworthy debug-watcher as **worth more than every remaining backlog item
combined**. B95 is the precondition — a signal nobody trusts cannot be built on. Carriers that already
exist: `debug-watcher/brief`, `logTelemetry.ts`, `cueLineage.ts`, `luaRuntimeLog.ts`. Needs its own
reconcile and design pass; do not start it as a drive-by.

### B97 · `/api/agent/deploy` — deprecate in the RESPONSE, do not retire `spec'd` (P2)

Correcting B87 #1 with a hard data point from the agent: **it is a live caller of that route** and hit
it minutes ago for a real 409. Silently retiring it would break working tooling mid-session with no
warning. Keep the route functional and add a `deprecated: true` field plus the replacement route name
to the response body, so callers learn while things still work rather than when they stop.

**Also from the agent, and it settles B87 #3:** per-node editing is **promote, not remove** — but not
now. Building it on non-deterministic ids (77 of 225 stable) and 77% opaque `rawXml` blobs would ship
something that *looks* safe and silently clobbers, which is worse than today's obviously-lossy
whole-file rewrite. Leave the client-side implementation alone, invest nothing in it, and **stop
describing it as an agent capability** — agents cannot reach it, so the description is the only
actually misleading part. B90 → B91 delivers the real thing.

> **B83 (locked deployed-mod root) and B84 (deploy format toggle) both CLOSED VERIFIED 2026-07-25 → ROADMAP.**
> Deployment on Windows works with the mod folder held, and the author now chooses loose vs CAT/DAT.
> Four follow-up decisions are Ken's, listed in B85 below.

> **B93 (the 10-item user-friction brief) CLOSED VERIFIED 2026-07-25 → ROADMAP, shipped as 0.0.43.**
> All ten items implemented across three waves. **B82 is CLOSED by wave 3** (XML well-formedness now
> runs first, as an error, inside the shared validator). **B81 is CLOSED by wave 1's sibling work?
> NO — B81 remains OPEN**: `/api/fs/read` still resolves the deployment root. Wave 1 delivered
> discovery, error honesty, `validate {root,path}` and `status`; the read-root selector is still
> the reporter's #1 and is still specified below.

### ⭐ MOD-AGENT BRIEF 2026-07-25 — decomposed into B88–B92, ordered by evidence not excitement

Source: the `x4_ai_influence` agent (49 files, ~350 KB Lua, 15 MD scripts), ranked by incident.
**Its own audit found per-node editing prevents 3 of its 10 real defects; six were semantic
(wrong property names, phantom ids) and two were Lua.** That ordering is kept below. Three of its
claims were verified against this codebase before scheduling — one was wrong, and one of its asks
already exists and PASSES.

**VERIFIED TRUE — `/api/fs/read` resolves the wrong root.** Already filed as **B81**; the agent's
report is independent confirmation from the critical path, so B81 is promoted to the top of P0.

**VERIFIED WRONG — "there is ZERO static checking on Lua".** Six Lua modules exist
(`luaStaticAnalysis.ts`, `luaMdBinding.ts`, `luaLogicBlocks.ts`, `luaStalenessCheck.ts`,
`luaRuntimeLog.ts`, `luaSnippets.ts`), `analyzeLuaFiles` is imported and called in `server.ts`,
and the MD↔Lua cross-check (`mdLuaMissingRegisters` / `luaMdMissingListeners`) is already in
`projectCrossFileValidation.ts`. The real gap is **WIRING and COVERAGE**, not absence — which makes
B90 much cheaper than the brief assumes. Do not rebuild what exists (workflow rule 3).

**ALREADY EXISTS AND PASSES — "the one test that would convince me".**
`POST /api/agent/round-trip-check` run against the real mod on 2026-07-25 returned
`strictLossless: true` — 49 files in, 45 out, **0 dropped, 0 passthrough mismatches, 0 modeled byte
changes**, 27 passthrough byte-verified. **`md/ai_influence_diplomacy.xml` — the exact file named —
is in `modeledByteIdentical`**, i.e. it round-tripped THROUGH the node model and came back
byte-for-byte. Comments survive today. The 4 `omittedPreserved` (`docs/ROADMAP.md`, both DLLs,
`aic_uix.lua`) are disk-referenced, which is why they deployed hash-identical.
**⚠ What that does NOT prove:** that editing ONE node preserves the OTHER nodes' bytes. Round-trip
fidelity of an unedited file tests the serializer; the edit path is untested. B91 owns that.

### B88 · `POST /api/fs/write` validates the incoming bytes and returns findings `spec'd` (P0)

**Motivating incidents (agent-reported, 3 of its 10 defects):** `$st.manager` is not a property, so
an NPC-census guard never fired and the census was **silently always empty**; `ware.{$id}.avgprice`
should be `averageprice` and was used as a **divisor**; `recursive="true"` is not declared on
`find_ship_by_true_owner`. Unknown MD properties evaluate to null with no engine error — nothing
downstream catches them. The Forge already indexes 258 scriptproperty datatypes; validation just
runs as a **separate POST over an agent-assembled payload**, so bytes land first and are judged later.

**Bounded repair:** run the EXISTING validation stack (well-formedness → schema → scriptproperty
chains) over the incoming bytes inside `writeWorkspaceFileGuarded`, return findings in the write
response, and accept `strict:true` to REJECT the write instead of warning. Reuse
`runProjectValidation`; add no second validator (B82 is converging these — sequence B82 first or
share its helper).

**Acceptance:** a write of a file using `$st.manager` returns a scriptproperty finding; the same
write with `strict:true` returns 4xx and **writes zero bytes** (assert on disk); a clean write is
unchanged in status and body shape; `averageprice` passes and `avgprice` flags; per-write latency
stays bounded on a 295 KB file; existing `/api/fs/write` callers keep working. Side benefit to
assert: the ledger's write row then carries its own verdict.

### B89 · Lua gate — wire and extend what already exists `spec'd` (P0)

**Motivating incidents:** an ambiguous `\]` escape in the HTTP transport (would have broken the
Player2 connection for every user), and `HydrateWorldEvents` silently dropping a field on reload,
**leaking fog-of-war secrets the player should never see**. ~350 KB of the mod is Lua.

**RECONCILE FIRST (mandatory):** `luaStaticAnalysis.ts` + `analyzeLuaFiles` and the MD↔Lua binding
counters already exist. Establish by reading the code and running it: what does `analyzeLuaFiles`
actually check, is it reachable from `runProjectValidation` or only from one endpoint, and are the
binding counters surfaced as findings or only as numbers? Build only the delta.

**Bounded repair (expected delta):** (a) a syntax-only parse gate (`luac -p` equivalent, or a
pure-JS Lua parser — no new heavy dependency without a decision); (b) surface
`mdLuaMissingRegisters` / `luaMdMissingListeners` as real diagnostics on the validate path, so every
MD `raise_lua_event` has a Lua listener and every `RegisterAddon`/`RegisterEvent` has an MD caller.
**Related, already specified: B72** (GetComponentData semantics) — do not duplicate it.

**Acceptance:** the ambiguous-escape shape fails the syntax gate; a `raise_lua_event` with no
listener is an error with file and event name; the real `aic_uix.lua` (295 KB) produces **zero false
positives** — the cry-wolf bar this project holds; runtime on 350 KB stays bounded.

### B90 · Node edit fidelity — prove the EDIT path before building on it `spec'd` (P1, gates B91)

The agent would "trade the entire per-node feature for a byte-fidelity guarantee", because its
rationale comments are load-bearing documentation. Round-trip of unedited files already passes
(above). **This unit tests the thing that is actually unproven: edit one node, re-serialize, and
compare every OTHER byte.**

**Acceptance — the agent's four identity-breaking fixtures, by hash:** (a) a cue containing only
self-closing actions; (b) a cue whose name is a substring of another cue's name in the same file;
(c) two byte-identical action blocks in different cues; (d) a file with a comment as the first child
of `<cue>`. Plus the real 23,125-byte `md/ai_influence_diplomacy.xml`: edit one node, assert every
byte outside that node's span is identical and the surrounding comments are intact. A tidy fixture
finds none of these — use the real file.

**Decision this unit produces:** whether per-node editing needs byte-span splicing, or whether the
existing serializer is already exact enough. Do not build B91 before this answers.

### B91 · Per-node editing API — only if B90 says the edit path is safe `spec'd` (P1)

Design constraints taken from the brief, all four non-negotiable:
1. **Byte-span splicing** — the importer records `[start,end)` per node; an edit re-serializes only
   that node and splices, so every other byte is provably identical.
2. **Semantic paths at the API boundary**, not opaque ids:
   `md/ai_influence_diplomacy.xml#Diplomacy_Referee/Check_Terms/do_if[0]`. Ordinals scoped to
   (parent, tag) so inserting an element cannot renumber unrelated siblings. Keep opaque ids
   internally; accept and RETURN paths — it also makes the ledger legible.
3. **`dry_run` on every mutation returning the exact unified diff.** This is what replaces the
   agent's anchor assertions; without it the API is not trustworthy.
4. **Refuse rather than clobber on unmodelled nodes.** 77% of this mod's nodes are `custom_xml_*`
   rawXml blobs; a property edit there could only swap the whole subtree. That must be a hard ERROR
   naming why the node is unmodelled — **silent blob replacement is the original bug wearing the
   fix's uniform.**

**Node identity:** derivation is the DEFAULT (works on vanilla files and other people's mods with no
writes); a comment marker is an OPTIONAL OVERRIDE written only when a cue rename must survive — not
on all 225 nodes, which would add permanent git-diff noise. Note self-closing elements have no
"inside" to host a marker, which is why marker-only identity fails for the most numerous node class.

### B92 · Transactional multi-edit `spec'd` (P2)

N edits across M files, atomic, one ledger row. The agent's `#296` change touched **9 sites across
4 files**; as 9 independent calls a failure at call 5 leaves the mod in neither the old nor the new
design — and MD fails silently, so the damage may not surface until an in-game test.

**Explicit NON-GOAL across B91/B92 (the agent asked for this twice):** do NOT remove file authoring
in favour of nodes. A mechanical sweep — one faction-list string across 9 sites — is strictly faster
and safer as one text pass. Both paths stay, chosen per task. This is not a migration.

### B87 · QOL / redundancy pass — decide what the Forge should STOP doing `spec'd`

Opened 2026-07-25 from Ken's observation that the agent API has no node verbs and that some Forge
features look redundant. Read-only recon done that day; **nothing removed yet, deliberately.**

**Evidence gathered (verify again before acting — see the hazard below):**
1. **Surgical Execute is the ONLY node-verb surface and it is client-side.** `AgentRuntimeApi`
   (`addNode` / `updateNodeProperty` / `updateWidget` / `execute(cmd)`) has 3 uses, all inside
   `AgentBridge.tsx`, and no HTTP route exposes it — so an external agent cannot reach it. Two
   coherent directions, and they are opposites: **promote** it to real per-node endpoints
   (`POST/PATCH /api/agent/workspace/nodes/:id`) so agents can edit granularly instead of
   replacing the whole `nodes[]` array, or **remove** it as a half-feature nobody can automate.
   Ken's call; do not split the difference.
2. **Five overlapping build/deploy routes**: `/api/agent/compile`, `/api/agent/package` (the API's
   own text calls it "Alias of compile"), `/api/agent/project/package`, `/api/agent/artifact/build`,
   `/api/agent/deploy`. Consolidation candidate with a real deprecation path.
3. **`/api/agent/deploy` already self-declares `deprecated: true`** (`server.ts:8493`) with the
   comment "should use deploy-verify. Converge the UI, then retire this route." That is the
   cheapest, best-evidenced removal in the list.

**⚠ HAZARD — the reason this is not a drive-by.** B64-U3 proved that a static audit of this
codebase can cite a DISABLED render path: the finding was real in the old renderer and a no-op in
the live one. Any removal here must be re-grounded against the LIVE path (running app + real route
callers) before deleting, or the pass ships no-ops and breaks something real. Deleting features has
blast radius that adding them does not.

**Suggested shape:** one unit per candidate, smallest first (the self-declared deprecated route),
each with a caller census before removal and a full gate run after. Not a single sweeping "cleanup".

### B86-follow-ons · Agent Action Ledger — deferred slices `spec'd`

Opened 2026-07-25 from the B86 close. The ledger itself is VERIFIED → ROADMAP; these are the pieces
deliberately left out of that bounded unit:
1. **Whole-state "step back to here"** (true Photoshop behaviour). B86 ships per-entry revert, which is what
   the acceptance criteria specified. Multi-file state-step-back needs CAS conflict handling for the case
   where the workspace has moved on since that row, and deserves its own reconcile.
2. **Blob garbage collection on rotation.** Rows rotate out at the size cap, but their blobs are currently
   only bounded by hash dedup — a very long-lived install could retain blobs whose rows are gone. Add a sweep
   that drops blobs unreferenced by any retained segment.
3. **Live tail.** The panel polls on open and on Refresh. A push/stream would help during long agent runs.
4. **Ledger for the IDE extension surface.** Today the panel is app-side only; the extension could read the
   same endpoint.

### B85 · Deploy-format follow-ups needing Ken's decision `spec'd`

Opened 2026-07-25 out of the B84 close. None block deployment; all four are judgement calls, not defects:
1. **Confirm the `loose` default.** B84 changed the shipped default from catalog (0.0.36–0.0.40) to loose.
   Rationale in ROADMAP; reversible by flipping `DEFAULT_DEPLOY_FORMAT`.
2. **`.claude/settings.local.json`** is excluded as development metadata, so a deployed mod has 48 files where
   its workspace has 49. Decide whether agent config is shippable mod content.
3. **`x4_ai_influence/.forgekeep` lists `config`, `README.md`, `docs`** — all built by the mod, so the hints are
   now reported no-ops on every deploy. Removing those three lines clears the warning. Likely a workaround for
   catalog mode burying them, which the toggle makes unnecessary.
4. **`.mcp.json` in the deployed folder** (the `claude-brain` registration) is not mod content, so correct
   stale-removal deletes it on every deploy. Adding it to `.forgekeep` preserves it properly.

### B82 · Project validation omits XML well-formedness — malformed MD passes until deploy `spec'd`

**[REPRODUCED 2026-07-25]** `x4_ai_influence/md/ai_influence_diplomacy.xml` opened a
`<do_elseif>` and closed `</do_else>`. `POST /api/agent/project/validate` reported zero structural/schema
errors, while `/api/agent/deploy-verify` rejected the emitted file through its separate
`checkXmlWellformed` stage before writing anything. This is not explained by Claude's mistaken
`kind:"markdown"`: `runProjectValidation` already falls back to `classifyPath(f.path)` for MD routing.
The gap is architectural—`validateXmlAgainstSchema` scans tags but does not enforce paired XML structure,
and the shared project validator never calls `checkXmlWellformed`.

**Bounded repair:** make `runProjectValidation` apply the existing deterministic XML well-formedness engine
to every textual `.xml` project file before XSD/domain lints. Surface specific error diagnostics with file,
line, XML rule, and summary count through the existing flat diagnostics/capsules/editor projections. Refactor
deploy-verify to consume the shared result or a shared helper so malformed XML is not governed by two drifting
implementations. Do not weaken the deploy gate during convergence.

**Acceptance:** inline and `fromPath` project validation both reject mismatched, unclosed, and stray closing
tags as errors; the exact `do_elseif`/`do_else` fixture flags at the source line; legal self-closing elements
and tag-looking text inside comments remain clean; malformed files produce continuous editor/agent diagnostics
before Compile/Deploy; deploy still refuses and writes zero files; clean representative MD/AI/library/diff/t XML
has zero new false positives; route/oracle/e2e/type/lint/precommit gates pass using scratch data only.

### B81 · `/api/fs/read` and `/api/fs/write` resolve different roots — stale read-modify-write hazard `spec'd` (P0 — TOP OF QUEUE)

**PROMOTED 2026-07-25.** Independently re-reported by the `x4_ai_influence` agent as its **#1** pain:
"`/api/fs/read` returns the DEPLOYMENT, not the WORKSPACE… patch #2 silently clobbers patch #1. I
work around it by reading disk directly with Python — which means the Forge is NOT the authority on
reads, and my reads are invisible to the ledger. This is in my path on **every** edit."
Two consequences beyond the original filing: the Forge loses authority over the read side entirely,
and every bypassed read is missing from the B86 action history. The agent's requested shape matches
the existing spec below — `root=workspace|deployment`, defaulting to **workspace**, and it asks for
one addition: **error when the requested root does not contain the file, rather than silently
falling through to the other root** (silent fallback is what makes the bug invisible).

**[REPRODUCED 2026-07-25]** With both directory roles configured, `GET /api/fs/read?path=...`
resolves `filesystemPath || modWorkspacePath` (`server.ts:3214`), while `POST /api/fs/write` always
resolves `modWorkspacePath` (`server.ts:3310`). An agent can therefore read the deployed G: copy and
write a derived patch into the F: source copy; when the two differ, a later read-modify-write can silently
clobber newer workspace content. Claude encountered exactly this contract while validating
`x4_ai_influence` and correctly worked around it by reading the workspace from disk, writing through Forge,
then verifying from disk.

**Bounded repair:** extend `/api/fs/read` with the same explicit `root=workspace|filesystem` selector used
by `/api/fs/list`, carry source identity through `DirectoryExplorer` and `LibraryConfigurator`, and make
agent-facing editable reads explicitly select `workspace`. Preserve or deliberately migrate the legacy
unqualified behavior only after its two current UI callers are covered; never silently change one side of
the contract. Update the agent schema/purpose text so read-modify-write examples name the root.

**Acceptance:** fixtures with the same relative file in both roots return the selected bytes; a workspace
read followed by `/api/fs/write` operates on one root; filesystem reads remain read-only; invalid selectors,
traversal, and junction escapes reject; legacy UI behavior is covered explicitly; route/e2e/oracle/type/
precommit gates pass. No real workspace, deployed mod, or game directory is used for validation.

### B77 · Something in the ordinary gate flow rewrites ignored historical PNG evidence `spec'd`
**NEW EVIDENCE 2026-07-25 — the mechanism that made this look mysterious is now [REPRODUCED]:**
`.git/hooks/post-commit` contains a `graphify-hook-start`/`-end` block that **launches a graphify rebuild in
the background after every commit** (`[graphify hook] launching background rebuild`, log
`~/.cache/graphify-rebuild.log`). So graph refresh runs *automatically* — nobody has to type
`graphify update .`, which is why the PNG churn kept appearing with no one admitting to running it, and why
"don't run graphify" was never sufficient protection.
**Still unexplained [HYPOTHESIS]:** both tracked `0.0.35-*.png` files also changed bytes MID-session
(`-live` 82,251 → 82,206; `-startup` 127,514 → 127,513) at a point where **no commit had yet been made**, so
the post-commit hook cannot account for that particular change on its own. A stale background rebuild from an
earlier commit, or a second writer, remains possible.
**Next step:** copy the two images to a fixture dir, then (a) make a trivial commit and diff after the hook's
background rebuild completes, and (b) run each gate alone and diff after each. Fix the ignore rule so
`*.png` is genuinely read-only. Do NOT stage or revert the two tracked files until the writer is proven.
Observed twice during the B76 final audit: `graphify update .` changed the byte size/hash and timestamp of
two tracked `vscode-extension/evidence/0.0.35-*.png` files even though `.graphifyignore` contains `*.png`.
Reproduce on copied fixture images outside user evidence, identify the graphify/tooling writer, make ignore
rules truly read-only, then restore the two tracked files only with an explicitly authorized cleanup action.
The original bytes are restored during authorized 0.0.37 release prep; root-cause reproduction/fix remains open.

### B72 · Lua GetComponentData semantics lint — close the blind spot that let a 12k-error bug pass validation `spec'd`
Motivated 2026-07-21: x4_ai_influence's aic_uix.lua fed the `"sector"` property (returns the sector NAME
string — vanilla menu_map.lua:9302 pairs "sectorid"+"sector" as id+name) into ConvertStringToLuaID →
component 0 → ~255 engine errors per tick, 12,765 in one session. Forge validation was green: the XSD/
scriptproperties corpus covers MD expressions, not Lua C-API property semantics. House-pattern slice:
(1) harvest the vanilla ui/ lua corpus (vanilla-ui-harvest infra exists) into a GetComponentData property
table — name → return kind (string/id/component/table), grounded per-property on observed vanilla usage;
(2) lint mod lua for misuse patterns: id-conversion applied to name-returning properties, GetComponentData
on GetContained* enumeration results without an IsValidComponent guard, cdata fed back without conversion;
(3) selftest oracle: the aic_uix.lua pre-fix pattern must flag, the post-fix version must pass, vanilla
menu_map.lua must produce zero false positives. Surface in project/validate beside scriptProperties.

### B71 · Graph-lint FALSE POSITIVE: "ILLEGAL INSTANTIATE / NO EVENT CONDITION" on cues whose events sit inside <check_any> `spec'd`
Found 2026-07-21 during x4_ai_influence Phase-0 warning classification. Studio canvas diagnostics flag
`Speak_menu` (ai_influence_conversation.xml:68) and `Sync_on_load` (ai_influence_worldsync.xml:83) as
ILLEGAL INSTANTIATE + NO EVENT CONDITION, but both cues have valid event conditions (`event_game_started`/
`event_game_loaded`, `event_conversation_next_section`/`..returned..`) nested inside `<check_any>` — legal
MD the game loads fine, and the agent-API `project/validate` correctly does NOT flag them. The graph
model's event-condition detector only looks at direct children of `<conditions>`. Fix: recurse into
`check_any`/`check_all` wrappers when deciding whether an instantiate cue has an event condition.
Acceptance: import x4_ai_influence → those two diagnostics disappear; a truly conditionless
instantiate cue still flags.

### B70 · Game-dir agent litter — ATTRIBUTED 2026-07-20: the SEPARATE Forge Agent Harness extension, NOT this app
Ken found `PLAN.md` / `SCRATCHPAD.md` / `todos.json` / `evidence_ledger.json` (session
`forge-1783998383822-6g6h7kbw`, 2026-07-13) plus a full `.forge/` state tree (activity 07-09→07-16)
INSIDE `G:\...\X4 Foundations\extensions\`. **Attribution (evidence-based):** grep of THIS codebase =
zero writers of those artifact names; grep of `kennyg.forge-agent-1.0.0` (the standalone Forge Agent
Harness IDE extension, installed in Antigravity + VS Code) hits `out/harness/loop.js` /
`backgroundRunner.js` / `extension.js` — the harness writes its governance artifacts into whatever
IDE workspace folder is open, and on 07-13 that was the live game extensions dir. Harmless to X4
(it only scans content.xml subdirs). **The workspace-root guard/redirect fix belongs in the
kennyg.forge-agent PROJECT, not this repo** — carry it there (refuse or redirect artifacts when the
workspace root is a game dir). **X4 Forge's own bounded slice (this repo, optional):** walkaround/
health-card warning when known harness-litter filenames are detected in a configured game extensions
dir ("agent artifacts in your game folder — clean up"). Existing litter cleanup = Ken-gated
(game-dir write gate), pending his move-vs-delete word.

### B69 · Inspector raw-XML box → real code editor — `spec'd` (low-pri, from the B68 dogfood thread)
The PropertiesInspector "RAW CUE XML" field is a plain `<textarea rows={6}>` (`PropertiesInspector.tsx:270`) — no
syntax highlighting, no X4 schema IntelliSense, no line numbers — while the main editor is CodeMirror with all of
that. Raw XML (the case that needs a real editor most) gets the weakest surface. **Fix:** swap that textarea for the
existing `CodeMirrorField` component (reuse, no new infra) for the rawXml case. Headless-buildable (tsc+vite+e2e),
EYEBALL-gated (Ken's screen) to close. Bigger alt (deferred): edit raw nodes in the main editor via two-way sync
(B57s5 territory — riskier). No functional impact; pure editing-UX quality.

### B65 · Cold-start onboarding — B65-1 + 1b ✅ VERIFIED LIVE 2026-07-19 → ROADMAP; follow-ons B65-2..5 deferred
**B65-1 (self-rescuing schema row + teach panel) + B65-1b (full 40-XSD tree-preserving harvest) SHIPPED + VERIFIED LIVE**
(amber→Extract→green, 402 events / 40 domains, e2e 19/19). Visual validation CAUGHT + fixed a shim regression (packed
md/md.xsd shim's `../../../` include overshoots the harvest tree → 382 events; fixed by skipping shim duplicates so
md→real libraries/md.xsd → 402). Files: gameDetectRoutes.ts, DirectorySettingsModal.tsx. B66 own-unpacker REJECTED.
**DEFERRED follow-ons:** B65-2 wizard failure-branch parity (canHarvestSchemas=false + error phase get the teach panel,
not a dead-end; FirstRunWizard.tsx) · B65-3 re-entry gap (App.tsx:442 auto-open + persistent "finish setup" banner) ·
B65-4 raw-error→settings deep-link (server.ts:212 / health card) · B65-5 shared `<SchemaRecovery>` component (DRY once
wizard + modal share the panel). Plan: `docs/plans/2026-07-19-onboarding-schema-coldstart.md`.
Real Discord user hit `md.xsd / common.xsd not found at this path` and couldn't recover. **Planned TWICE**
(two independent agents, same grounded brief) + reconciled against the live install. Full plan:
`docs/plans/2026-07-19-onboarding-schema-coldstart.md`. **Convergence:** both passes independently agreed on
root cause + first unit + validation. **Reality-check catch:** both recommended Egosoft's first-party
`XRCatTool.exe` in the game root — FALSIFIED (the real 9.00 install has only .cat/.dat + X4.exe; NO first-party
unpacker). Corrected → community unpacker (Ken used the X4 Unpacker Suite, `<X4_UNPACKED_DIR>\x4unpackersuiteV1`).
- **Root cause:** every schema-setup failure branch (canHarvestSchemas=false, harvest 422, not-found, dismissed
  wizard, raw error) funnels into ONE inert surface — the DirectorySettingsModal schema row (:244), which only
  DIAGNOSES, never TREATS. Harvest capability exists but only the wizard calls it; the reliable unpack-and-point
  method (discoverXsd, works) is surfaced nowhere but a tooltip.
- **B65-1 (FIRST unit):** make the DirectorySettingsModal schema row SELF-RESCUING — add an in-place "Extract
  schemas from my game install" button (reuses POST /api/agent/setup/harvest-schemas) + an inline unpack teach
  panel (on 422 / no game path) + honest states. ONE file (DirectorySettingsModal.tsx), no backend change, additive.
- **Deferred follow-ons:** B65-2 wizard failure-branch parity · B65-3 re-entry gap (App.tsx:442 + persistent "finish
  setup" banner) · B65-4 raw-error→settings deep-link (server.ts:212) · B65-5 shared `<SchemaRecovery>` component.
  OUT/gated: first-party one-click unpack (child-process spawn — hazard sweep + Ken gate); shipping any XSD (illegal).
- **KEN DECISIONS before build:** (1) approve the direction; (2) NAME the community unpacker to recommend (+ the
  tool-agnostic "any extractor, point at root" floor stays regardless). **Validation:** typecheck/lint + harvest
  contract + VISUAL/live DOM (3 states) + negative path (no false-green) — EXPERIENCE-gated, visual validation required.

### B67 · Live-dogfood Forge findings (from the B-INGAME session, 2026-07-20) — `spec'd`
Surfaced while validating the real deployed mod live through the Forge (dogfooding). All are FORGE bugs/quality, not mod:
- **B67-1 · bridge-health "false-negative" — RETRACTED / FALSIFIED (reconcile 2026-07-20).** Read the code: the check is
  CORRECT. `:8713/health` returns `{ok:true, player2:{ok:true}, metrics:{...}}`; `normalizeBridgeLiveState` sets
  `bridgeUp = health.ok===true` → true → healthCard renders "pass/Bridge UP". The "Not running" I saw was the walkaround
  snapshot from EARLIER (bridge genuinely down then) — I compared a stale screenshot to a later live curl (a timestamp
  conflation, the "AI has no sense of time" trap). NO bug. Possible-but-UNREPRODUCED sub-item: whether the walkaround
  re-polls the 10s liveBridge cache on a down→up transition (mild display staleness) — do NOT chase without a fresh repro.
- **B67-2 · validator over-warns on imported RAW cues — DOWNGRADED to UNREPRODUCED / code-contradicted (read-only reconcile 2026-07-20).**
  Original claim: after LOAD MOD PROJECT of x4_ai_influence, Editor Diagnostics flagged its cues ("no event/condition or
  action nodes wired", "no namespace") — "likely false positives". Reconcile (no live repro yet) says the code contradicts
  this for the cues I named:
  - The two exact message strings live ONLY in `src/types.ts` (canvas graph validator): `:1520` wiring-info fires only when
    a cue resolves to 0 conditions AND 0 actions AND 0 sub-cues; `:1544` namespace-info fires only when `properties.namespace`
    is empty. [REPRODUCED: code]
  - `src/lib/xmlParser.ts:163` defaults `namespace` to `"this"` for EVERY imported cue/library when the attr is absent → the
    namespace lint **cannot fire on any imported cue**. [REPRODUCED: code]
  - Ground truth in `aic_contracts.xml`: `OnAccepted` is a `<library>` with a full `<actions>` block (importer wires it via
    `out_act`, so actionNodes>0 → wiring lint can't fire); `Registry` has `<event_game_loaded/>` + an action + `namespace="this"`
    → trips neither lint. [REPRODUCED: source]
  - Conclusion: the recalled symptom is very likely a stale/misattributed UI observation (same class as B67-1 — a remembered
    screenshot the code disproves). NOT treated as a confirmed bug; NO fix made (would be a fix built on an unreproduced,
    code-contradicted symptom — the exact anti-rationalization trap).
  - Only-if-reproduced next step (fresh/authorized session, needs the running Forge + MACHINE-STATE ASK — the import path may
    touch Ken's canvas): LOAD MOD PROJECT of x4_ai_influence, read the ACTUAL diagnostics on `OnAccepted`/`Registry`, and only
    if a warning genuinely appears, decide library-node exemption. Do NOT chase without that live repro.
- **B67-3 · "Failed to fetch" in LOAD MOD PROJECT + Agent Brief:** intermittent fetch failures during import on the
  INSTALLED (pre-P1) extension — the object-index build synchronously blocks the old sidecar (exactly what B64-P1's
  stale-while-revalidate in 0.0.30 fixes). Partly "update the install to 0.0.30", but verify the import dialog's own
  fetch has a graceful degrade/retry rather than a bare "Failed to fetch".
- **Also pending validation (now doable at the machine):** B64-U2 (deploy-fail color — isolate a scratch deploy, drive a
  failing deploy, confirm rose) · B56/B57 IDE-native eyeball batches (install 0.0.30, drive Problems panel / IntelliSense
  / cue nav / MCP / adopt in the IDE).

### B64 · Audit-driven hardening batch — `spec'd` (SPECIFIED 2026-07-18) · security-first, one unit at a time
Source: a four-sweep read-only audit (security · data/perf · UI/a11y · tests/config/arch), every finding
file:line-cited + confidence-labelled. Full acceptance contracts: `docs/plans/2026-07-18-audit-hardening.md`.
Ordering law (Ken 2026-07-18): SECURITY FIRST, then agent's choice. Each unit ships a Ken-approval brief
(change/files/risks/validation) BEFORE code. Reconcile already done — see the plan's reconciliation summary.
- **SECURITY (build order):** SEC1 ✅ VERIFIED (run_command scope fix; oracle 20/20 + live 403 drill) · SEC2 ✅
  VERIFIED (.env.example security/spend/dir vars) · SEC3 ✅ VERIFIED (config.json parse hardening; oracle 12/12) —
  all 2026-07-18, headless, e2e 19/19, → ROADMAP. SEC4 ✅ VERIFIED (dollar-aware spend attribution, EXTENDS B25,
  additive+default-off, oracle 13/13; **Ken-review the pricing table before treating as shipped spend policy**).
  **SEC5 (Origin/Referer spend-spoof) — VERIFIED as a real gap by code inspection, DEFERRED to Ken** (closing it
  changes the deliberate app-UI-origin isolation → needs explicit sign-off + a mechanism choice). SEC6 session-token
  rotation + SEC7 plaintext AI keys = **deferred** (low urgency / accepted-risk). **Security block DONE; now PERF.**
- **PERF (agent's choice):** P1 ✅ (stale-while-revalidate object index) · P2 ✅ (memoize getReferenceSets by index
  generation; consumers proven non-mutating) · P4 ✅ (cold-boot loose-XML digest stamps catch nested user-root edits)
  — all VERIFIED 2026-07-19, headless, e2e 19/19, → ROADMAP. **DEFERRED (reconciled):** **P1b** truly non-blocking
  build (worker/chunked-async; large ripple) · **P2b** thread one DOM per file across the ~8 lints (signature ripple)
  · **P3 DEFERRED w/ rationale** — the audit symptom is rapid DISTINCT edits, which only a delay-debounce fixes, and
  that risks lost-write/disk-memory-divergence in the ADR-F1/SPEC-#66-scarred persistence path; the safe dirty-check
  slice doesn't address the symptom. Revisit in fresh context with crash-consistency tests if the write-amplification
  ever bites. **PERF BLOCK DONE (P1/P2/P4 shipped; P1b/P2b/P3 deferred).**
- **CHEAP UX (eyeball-validated 2026-07-19 via computer-use — Ken unblocked Forge visual validation):**
  - **U1** ◐ DORMANT — error toasts persist + role=alert (code-correct), but the app raises NO error-kind toasts
    (all `toast()` are info); no live trigger. **OPEN DECISION (Ken):** route `window.alert`→error-kind? (judgment call).
  - **U2** ◐ CODE-VERIFIED, live component (GuidedRail) — amber→rose deploy-fail. NOT live-driven (deploy = write-gate
    to the real mod-staging dir). **OPEN DECISION (Ken):** isolate modWorkspacePath→scratch and drive a failing deploy, or accept code-verified.
  - **U3** ✗ NO-OP / FALSIFIED — the markers are in the OLD renderer; `CODEMIRROR_EDITOR=true` (CodePreview.tsx:29)
    makes CodeMirror default → dead code (live: 0 markers). CodeMirror shows no per-line severity markers; live severity
    indicators already have text labels. Audit C-A11Y-4 FALSIFIED for the live app; U3 = harmless dead-path polish. → ROADMAP.
  - **U4** Beginner Customize dead-end (verify-first, not started; re-ground against live path first).
- **A11Y:** **A1 ✅ VERIFIED LIVE** (accessible confirm/prompt dialog — role=dialog/aria-modal/Escape/focus-trap/restore
  proven in the live DOM via computer-use; RECONCILE: no shared shell → re-scoped to the DialogHost dialog) 2026-07-19 →
  ROADMAP. **A1b (deferred):** shared `<Modal>` primitive + migrate the ~10 bespoke feature modals (each eyeball-gated).
  A2 Canvas keyboard nav (heavy, eyeball) · A3 sub-11px typography (deferred, design-led).
  **⚠️ DURABLE LESSON (2026-07-19):** the audit's UI/a11y findings were STATIC and can cite DISABLED render paths (U3
  proved it) — **re-ground A1b/A2/U4 against the LIVE render path (CodeMirror + real components) BEFORE building**, else
  we ship no-ops. **NEXT buildable: re-ground the a11y items, or ARCH1** (server.ts extraction, its own session).
- **TEST/ARCH:** T2 ✅ (e2e verdict from JSON report + precommit guard) · T1 ✅ slice (route-integration harness
  `npm run test:routes`, 13/13 — auth/scope/run_command-negatives/path-containment; SEC1 now a PERMANENT guard) —
  both VERIFIED 2026-07-19, headless, → ROADMAP. **NEW: T1b** (deploy dry-run + validate-with-fixture-schema +
  extension smoke — needs a bundled fixture; deferred). **ARCH1 — RECONCILE-DEFERRED (decision 2026-07-19, rule 3.5):** extraction pattern proven
  (`registerXxxRoutes(app, deps)` per src/server/*.ts); ready candidate = the AI keys/usage trio (server.ts:1935/1945/8184
  → `src/server/aiRoutes.ts`, deps: setStoredAiKey/aiKeyStatus + a spendMeter snapshot closure). NOT cut now: value is
  marginal per single extraction (8347→~8250 lines) + the cleanest candidate is security-relevant (key storage + origin
  gating) — the god-file reduction deserves a DEDICATED focused pass (several extractions, one fresh session), not one
  drive-by 14-units-deep. Do it as its own session with full tsc+sweep+e2e per extraction. **PRODUCT:** X1 finish-or-remove
  Google OAuth (Ken decision).
- **NOT re-opened (already tracked):** 3 RED oracles (env-only), e2e stdout-parse (B17), 13 machine literals (B41).
- **VISUAL VALIDATION UNBLOCKED (Ken, 2026-07-19):** the Forge UI can now be driven headlessly via computer-use — start
  Vite + an isolated sidecar (see the eyeball-session method: Vite 8800 + sidecar 8801, isolated X4_STATE/DATA dirs, known
  token), open the Browser pane, validate via DOM (`read_page` + `javascript_tool`; screenshots wedge — B28). This is how
  A1 was VERIFIED and U3 was falsified. The OLD "eyeball blocked by textinputhost" note is SUPERSEDED for the Forge web UI.
  (IN-GAME validation of x4_ai_influence is still desktop-blocked — that's X4 itself, not the Forge UI.)
- **B64-FINDING (2026-07-19, from Ken's Google-AI screenshot):** Google's AI Overview describes X4 Forge but OVERCLAIMS
  ("edit sector maps"/"design station blueprints") — reconcile confirmed those are GOOGLE'S hallucination, NOT our copy
  (extension README has zero such claims; manifest description is accurate/modest). Two small OPEN items: (a) verify +
  fix a possible mojibaked em-dash (`â€"` vs `—`) in the package.json `description` [HYPOTHESIS — read the raw bytes first];
  (b) optional: richer store README with an explicit "what it does / what's on the roadmap" so the AI summarizes fact not
  guess (ties to B59d anti-hallucination). Neither started; both small; Ken's call.

### B60 · Automated + readable extension CHANGELOG — ✅ VERIFIED 2026-07-17 → ROADMAP
Open VSX "Changes" tab is LIVE and human-readable (confirmed served for 0.0.17). Automated:
`scripts/gen-changelog.mjs` derives the version list/dates/order from git; the USER-FACING text
per version comes from curated `release-notes.json` (plain language for modders) with a
humanized-commit-subject fallback; selftest 8/8; ships via `.vscodeignore`; `npm run changelog`
in the publish flow. Publish-before-commit adopted (structurally fixes version-lag: committed
version == published version). One human step per release = add a plain-English block to
release-notes.json.

### B41 · VS Code / Antigravity extension PoC — ✅ VERIFIED (both IDEs) 2026-07-15 → ROADMAP
Install-tested LIVE in desktop VS Code AND Antigravity (Ken authorized both installs): VSIX
installs, autoOpen launches the studio, the real UI renders in the webview over a managed
per-IDE sidecar (dynamic ports :62647 / :52030), representative edit→validate→compile→package
completes in each, Workspace Trust gate proven in Antigravity. VSIX 2092 files/16.77MB, inspected
clean. Standalone :3000 untouched. Evidence: `vscode-extension/evidence/VALIDATION.md`.
**Open (Ken, not blocking the tech result):** private-beta cohorts + go/no-go
(`vscode-extension/BETA-TEST-SCRIPT.md`); commit-of-this-branch decision.
**Residuals (bounded):** genericize server.ts baked default paths before ANY tester
distribution (13 machine literals ship in every build); optional X4_DATA_DIR seam so the
sidecar stops writing data/ into its install dir; port to main the 3 product/infra fixes
(prod token injection, db createRequire, e2e 127.0.0.1 pinning) — main already committed the
B34–B37 delta this session as ff38642.

### B42 · Agent key manager (scoped, expiring keys) + parity passes + ext icon — ✅ VERIFIED 2026-07-15 → ROADMAP
Named scoped expiring agent keys (read/write/deploy · 1h/24h/7d/30d/never · sha256-at-rest ·
one-time reveal · revoke · audit), AgentBridge AGENT KEYS tab, extension "Create Agent Key"
command, key-mgmt session-token-only. Oracle 18/18; e2e 19/19; sweep 79/81; full security
matrix + full key lifecycle proven LIVE in Antigravity (create→reveal→terminal use→scope
403→revoke→terminal 401). Parity: 19/19 surface engines 200 + visual panel passes. Icon
shipped; VSIX 0.0.2. Evidence: `vscode-extension/evidence/VALIDATION.md`.
**Open (Ken):** commit-of-branch decision; port the auth change + fixes to main. **Residual
(bounded):** attach-mode has no session credential, so the "Create Agent Key" command only
works against an owned sidecar (documented in the command's message).

### B43 · Gold-standard sidecar debugging (VS Code + Antigravity) — ✅ VERIFIED 2026-07-15 → ROADMAP
`x4forge.debug` (off/inspect/inspect-brk) spawns the sidecar under `--inspect` + auto-attaches the
IDE Node debugger. Proven LIVE in BOTH IDEs (debug toolbar active; Antigravity Call Stack "X4 Forge
Sidecar RUNNING"; VS Code "Debugger listening on ws://" + debug status). Source-level TS via
`x4forge.forgeRoot`; committed `.vscode/launch.json` for the controller. Default off = zero behavior
change (touched only vscode-extension/). VSIX 0.0.3, both IDEs. Evidence: `vscode-extension/evidence/VALIDATION.md`.

### B44 · Git-derived live version in the header — ✅ VERIFIED 2026-07-15 → ROADMAP
Header `v{__APP_VERSION__}` is now `major.minor.<git-commit-count>` (baked at build time), so it
moves with every commit and updates when users update the extension; tooltip `__APP_BUILD__` =
short SHA + commit date + dirty flag. Graceful fallback to package.json version if git absent.
`vite.config.ts` + `src/vite-env.d.ts` + one App.tsx attribute. Live-proven header "v1.0.213".

### B45 · Directory-save no longer gated on schema — ✅ VERIFIED 2026-07-15 → ROADMAP
`POST /api/schema/config` was 400-gated on schemaDir containing md.xsd+common.xsd, which
blocked saving the workspace/filesystem/game paths whenever the schema was absent/incomplete.
Now paths save independently; schema is validated + REPORTED (amber "saved, schema pending"),
never a hard gate. Server + DirectorySettingsModal. Live-proven: workspace-only save persists;
valid schema still loads (unpacked libraries → 402 events/807 actions). tsc/e2e 19/19.

### B46 · Full-corpus schema/reference validation — Phases 1–2 ✅ VERIFIED 2026-07-16; Phase 3 reference-set slice ◐ PARTIAL 2026-07-23
**Phase 1 (multi-schema loader) SHIPPED:** `src/lib/schemaRegistry.ts` — discovers EVERY *.xsd
under the configured schema folder + game folder (bounded walk mirroring B51, base-over-DLC),
resolves transitive include chains, builds lazy per-domain indexes via the existing
`buildSchemaIndex`; `GET /api/agent/schema-registry` (+`?domain=` +`?refresh=1`), TTL registry
cache (cold walk 25.6s first-touch → 14ms cached). Oracle `schema-registry-selftest` 11/11
(synthetic: include chain, junk degrade, missing include, DLC preference). LIVE vs the real
unpacked 9.00: **40 domains** (incl. addon/coreaddon/cutscenes found in subdirs), 48 DLC dupes
shadowed, 0 unresolved includes; md 1507 / factions 1354 / gamestarts 1417 / parameters 1556 /
diff 4 elements. tsc/lint/precommit 0 · e2e 19/19 · sweep 82/85 (3 reds A/B-proven env-only).
MD path + getAiSchemaIndex untouched (validation behavior unchanged this phase BY DESIGN).
**Phase 2 ✅ VERIFIED 2026-07-16 → ROADMAP:** file→schema routing shipped corpus-proven
(factions/gamestarts/addon/diff proven on 124 vanilla files → 0 findings; coreaddon
warning-capped, no corpus instances). The P2 hand-off note RESOLVED: the 2 md-audit findings
were include-blind loader false positives (md/md.xsd is a zero-declaration include shim);
`expandIncludeChain` fix flipped `md_generator_zero_findings` green (sweep 83/86, e2e 19/19).
CORPUS-FALSIFIED and corrected in-flight: wares/jobs must NOT route to libraries.xsd (26,835
vanilla findings) → diff-wrapper-only; invented `<language id>` t-check removed (26/74 vanilla
omit it). **P2 residual (`spec'd`, small):** palette `loadSchemaLibrary` (xsdParser) is still
include-blind — 382 events instead of 402 on unpacked-ROOT configs (pointing at `libraries/`
works). Same `expandIncludeChain` treatment; verify palette count 402 after.
**Phase 3 reference-set slice ◐ PARTIAL 2026-07-23:** B73 shipped a configurable, cached,
read-only base+official-DLC corpus for factions, wares, sectors/macros, and scriptproperties;
public APIs expose it and project validation consumes canonical sets plus project-owned definitions.
This closes the high-value ID-reference slice. The original broader 9,884-file SQLite index and
example-retrieval/prompt-delivery scope remain `spec'd`. B73 close: ROADMAP +
`docs/plans/2026-07-23-reference-corpus-api.md`. Original plan:
`docs/plans/2026-07-15-full-corpus-validation.md`.

### B55 · Validation-driven agent loop — Phase 1 ◐ PARTIAL 2026-07-16 → ROADMAP; Phases 2–3 `spec'd`
**Phase 1 SHIPPED (composite-validator repair loop):** `src/lib/agentLoop.ts` (oracle 12/12) +
generate phase-4 rewiring — the full validator stack (incl. B46P2 routing) now DRIVES retries/
halts/completion; clean first pass = 0 repair calls (live-proven with Ken's openrouter key,
2 real generates, spend metered); honest `repair` reporting; quick-fix hints in repair prompts.
Also fixed live: invalid openrouter default model id; async selftests now awaited by the
registry. Gates: tsc 0 · sweep 84/87 (same env reds) · e2e 19/19. **◐ residual:** repair-path
live-fire not yet observed (both live generations validated clean); self-reports via the
`repair` field when it happens. **Phase 2 (`spec'd`):** deterministic vanilla-example retrieval
into prompts (budgeted, corpus-bytes-only; share B46P3's index). **Phase 3 (`spec'd`,
Ken-gated):** architect/editor split + evidence-gated done + causal A/B harness.
Plan: `docs/plans/2026-07-16-validation-driven-agent-loop.md`.

### B56 · IDE-native Forge — Phase A (unit-0+s1–s5) ◐ BUILT 2026-07-17 → ROADMAP; eyeball batch OPEN
Overnight build complete and machine-validated (oracles diagnosticsMap 10/10 · modFolder 15/15
· langContext 10/10 · langService 12/12 · live drills incl. full stdio MCP session with scope/
auth negatives · sweep 85/88 · e2e 19/19 ×3 · both tsc 0 · VSIX integrity w/ mcp/ shipped).
**◐ OPEN = Ken's IDE eyeball batch** (click-by-click scripts in SESSION-HANDOFF): Problems
panel render · open-mod-folder flow · IntelliSense feel · MCP config paste into a real agent ·
(opt-in) association behavior with Red Hat XML. **Residuals (`spec'd`):** precise-children
index mode for completions (current child lists are suppression-built, over-inclusive) ·
two-way folder editing (gated on drift telemetry) · lemminx corpus-proof (IDE-gated; assoc
writer stays default-off) · EmmyLua stubs · **s6** native diff/SCM/matchers (demand-driven).
Build deltas + full record: plan header + ROADMAP. Plan:
`docs/plans/2026-07-17-ide-native-forge.md`.

### B57 · IDE-native Forge, Phase B — s1–s5 ◐ BUILT 2026-07-17 → ROADMAP; eyeball batch OPEN
All five slices machine-validated same-day (agentBrief 12/12 · langNav 10/10 · 8-tool stdio
MCP session w/ author_check draft loop + capsule parity + readiness contract · import→CAS
adopt + 409 negative · sweep 86/89 · e2e 19/19 · both tsc 0) and EYES-validated in the
browser (deep links land on Diagnostics/Playtest; adopted workspace live on canvas,
byte-faithful; honest PACKAGE: WARN header). PLAN CHANGE recorded: CodeActions rescoped out
(quick-fixes are canvas-level). **◐ OPEN = Ken's IDE batch** (scripts in SESSION-HANDOFF):
AGENTS.md flow, proof-in-editor, nav/squiggle feel, adopt prompt. Two-way stays DEFAULT-OFF
until its own telemetry says otherwise. **Residuals (`spec'd`):** s6 bucket (EmmyLua stubs ·
lemminx corpus proof · formatter-drift guard · precise-children mode). Renames stay excluded.
Plan: `docs/plans/2026-07-17-ide-native-forge-phase-b.md`.

### B58 · Community patch — ◐ BUILT 2026-07-17 → ROADMAP (f deferred); reconcile collapsed two
RECONCILED-EXISTS: e (debuglog onboarding — healthCard.ts already ships the exact launch-string
warning) · b's ENGINE (Doctor + overrideMap element-level contested/winner + dep graph #66 —
Ken's memory confirmed). Patch scope: **b-projection** (MCP check_conflicts + IDE Problems
mapping over the EXISTING engine) → **d** (one custom_gamestart recipe over existing machinery)
→ **a** ✅ (arc + war templates, oracle 33/33, picker EYES-seen) → **c** ✅ (save-impact facts
in PROOF, drilled) · **d** ✅ (Custom Game Start template — reconciled INTO the beyond-canvas
family, routed-validated 0 findings) · **b** ✅ (projection drilled via fixture + stdio) ·
**f `spec'd`, DEFERRED** (MD element reference into the reference surface — next session) ·
patrol template deferred (aiscript-side). Plan: `docs/plans/2026-07-17-community-patch.md`.

### B58-research · Community gap map — RESEARCHED 2026-07-17
Web sweep of Egosoft/Steam/Nexus/Reddit-adjacent sources: newcomer wall + story-SDK wish (our
exact lane) · debug-iteration pain (mostly out-shipped by us; onboarding gap) · cross-mod diff
conflicts (best practice exists, verification doesn't — strong unbuilt fit) · save-game anxiety
(lintable patterns only; the modified flag is engine-side) · content wishes ≈ template SKUs ·
X4CodeComplete/CodeDebug ecosystem overlap (stay friendly, stay differentiated). DECISION MENU
(a–f, effort/impact rated, recommended default order e→d→b→a→c→f):
`docs/research/2026-07-17-community-gap-map.md`. Nothing scheduled until Ken picks.

### B62 · Community round-3 features — b/c ✅ SHIPPED; a/d/e falsified-or-covered; f/g need Ken decisions (RECONCILE-EXHAUSTED)
Research + menu: `docs/research/2026-07-17-community-gap-map-round3.md`. The workflow's reconcile-first
discipline culled the menu down to what could ship cry-wolf-safe:
- **b ✅ SHIPPED** (t-file reference integrity, oracle 13/13, corpus-clean 12930 refs, 0.0.25) → ROADMAP.
- **c ✅ SHIPPED** (migration/deprecation linter, oracle 11/11, corpus-clean 399/399, 0.0.23) → ROADMAP.
- **a REJECTED** (content.xml language-completeness "won't launch" = corpus myth; real mods ship 0–2 langs).
- **d REJECTED** (auto-deps already built — externalApiRegistry + generateContentXML).
- **e REJECTED** (corpus-falsified: 345 vanilla macros are defined-but-NOT-indexed — characters/decorations/
  zones/test — so "not in index/macros.xml" is not an error signal; a simple orphan lint cry-wolfs on 345.
  A cry-wolf-safe version would restrict to ship/station macro CLASSES + verify that subset — SPECULATIVE,
  own reconcile, DEFERRED).
- **f DEFERRED (Ken decision)** — version*100 encoding ALREADY DONE (extensionProject.ts:159 + modCompiler.ts:74);
  folder + zip distributable exist (B9). New part = Steam Workshop cat/dat build + upload → needs Egosoft's
  external WorkshopTool.exe (or a binary-format reimpl) AND is a PUBLISH side-effect surface. Spec + Ken go.
- **g DEFERRED** — visual diff-patch sel builder; UI-heavy + blocked by the textinputhost computer-use issue.
- **B62b phase 2 deferred:** per-language coverage matrix + free-page-ID allocator + reserved-registry collision.
**Net:** the clean buildable-now backend-lint work of round 3 is EXHAUSTED (b, c shipped; a/d/e don't survive
reconcile); f/g are non-lint surfaces needing Ken's decision. Future rounds → new research sweep.

### B61 · Content validation for un-schema'd domains (jobs et al.) — inc 1+2 + phase 3 ✅ VERIFIED 2026-07-17 → ROADMAP
jobs linter (inc1 engine + inc2 wired, 0.0.22) + **phase 3 wares linter ✅ (wired, oracle 14/14,
corpus-clean 1397/1397, 0.0.24)** all done. Remaining un-schema'd domains (god.xml, ships.xml, loadouts)
are lower-demand — same pattern if ever pulled, but not scheduled.
**increment 2 ✅ (2026-07-17, published 0.0.22):** jobs linter WIRED into the live validator —
`jobsLint` layer in projectValidation.ts (advisory WARNING, never flips `ok`), `getJobsVocabulary()`
in server.ts (base + `ego_dlc_*` merged, cached, reference-set factions), threaded into all 4
runProjectValidation call sites; findings flow to the validate response + capsules + IDE Problems panel.
tsc/lint 0 · oracle 18/18 · LIVE endpoint proof (jobs.* warnings from the corpus-configured server) ·
sweep 88/91 · e2e 19/19. **phase 3 (SPECIFIED):** wares.xml content lint — same corpus-grounded pattern
(price/economy vocabulary); jobs is the proven template. Minor deferred: per-file flat `filePath` (mods
have one jobs.xml so canonical label is fine); promoting jobs into CORPUS_PROVEN_DOMAINS is unnecessary
(the linter is its own advisory layer, already WARNING). Historical spec below.
### B61 · (superseded — increment 1) content validation reconcile
Ken directed this off the B59d honest limit ("we need a schema for that — follow the workflow") and
authorized the build ("auto mode"). **increment 1 ✅ (2026-07-17):** `src/lib/jobsContentLint.ts` pure
vocabulary-injected linter + oracle `jobs-content-lint-selftest` 14/14; CRY-WOLF BAR MET (all 604 real
vanilla jobs lint clean, 0 false positives); negative path exact; sweep 88/91 (new oracle green, 3
pre-existing env reds). Corpus-grounded (learns 11 classes/13 orders/5 sizes from vanilla), NOT a fake
XSD; advisory, faction checks skip without a reference set. **UNWIRED on purpose** (off the validate
path — no user-facing change, no publish, avoids e2e/collision with the parallel codex + Antigravity-Gemini
sessions). **increment 2 (SPECIFIED, next):** wire the linter into the live validator — route jobs.xml
(the null route, schemaRouting.ts:70) to the linter, thread reference-set factions, surface findings as
WARNING capsules (one currency: validate/MCP/IDE), add `/api/agent/jobs-lint` GET + MCP tool if warranted;
promote jobs to CORPUS_PROVEN_DOMAINS only after re-running the 604-clean proof server-side; then e2e (clean
machine window) + publish (user-facing → changelog entry). Phase 3 = wares.xml (same pattern). Ground:
`<X4_UNPACKED_CORPUS>\libraries\jobs.xml`.

### B59 · Community patch ROUND 2 — a/b/c/d ✅ ALL BUILT 2026-07-17 → ROADMAP (Ken's goal a→b→c→d COMPLETE)
**a ✅ Patch-day readiness · b ✅ galaxy reconcile+jobs starter · c ✅ UI-Extensions guide · d ✅ anti-hallucination copy** — old-vs-new selector drift (patchReadiness.ts oracle 10/10 +
endpoint + MCP check_patch_readiness; live two-corpus proof vs real unpacked 9.00; 0.0.18
published). **b ✅** galaxy tab = read-only viewer (sector authoring DEFERRED #64 P2); shipped custom_patrol_job
jobs starter (oracle 36/36, picker EYES-seen, 0.0.19). **c ✅** reconcile found no raw-Lua carrier →
codegen starter DEFERRED; shipped grounded kuertee UI-Extensions compat wiki topic
(`luaui_kuertee_compat`, HUD & LUA, EYES-seen, e2e 19/19, 0.0.20 published). **d ✅** Ken-approved
anti-hallucination copy grounded in the real repair loop → shipped to README + store blurb + new
Reference wiki tab (`reference_ai_anti_hallucination`, EYES-seen, e2e 19/19, 0.0.21 published); Ken's
directive off it spun out **B61** (above). Research + menu:
`docs/research/2026-07-17-community-gap-map-round2.md`. Original research kept below.
Demand-side + author-workflow sweep: Nexus demand = conversions/overhauls/AI-tweaks (asset
side OUT of scope; the XML layer of overhauls IS ours — GALAXY tab must be reconciled first)
· the patch-day mod-breakage cycle is structural and untooled (→ two-corpus selector-drift
"patch-day readiness" — carriers exist: registry multi-root + overrideMap selector eval +
cat/dat) · the UI ecosystem runs through kuertee's UI Extensions framework (→
dependency-declaring compatible starter; ground from his repo) · "AI-made mods = one large
LLM hallucination" is the community verdict — our validator-driven loop is the counter-story
(positioning copy = Ken-voiced). MENU a–d, default order a→b(reconcile)→c→d:
`docs/research/2026-07-17-community-gap-map-round2.md`. Nothing scheduled until Ken picks.

### B47 · Walkaround: neural-link bridge de-escalated to optional — ✅ VERIFIED 2026-07-15 → ROADMAP
Ken: the bridge is x4_ai_influence-specific (ADR-F3 "optional, never a dependency"), but the
startup walkaround warned amber "bridge DOWN" for EVERY mod. Now labeled "(optional)", a down
bridge reports neutral (unknown/grey) with copy naming its actual scope, never a warn, and no
longer counts toward "N items worth a look". healthCard.ts + oracle check pinning the negative.
Live-proven: counter 2→1, row grey with the optional copy. Oracle 9/9, tsc 0, precommit 0.

### B48 · Retire the hand-rolled code editor (Monaco swap + real-estate) — `spec'd` (SPECIFIED 2026-07-15)
Reconcile shrank the "heart surgery": the whole editor = ONE component (CodePreview.tsx, 1,255
lines, one mount in App.tsx, ~20-prop contract; shared state touches only App+itself). Phase 1
= swap the text/diff CORE for Monaco inside the existing shell (chrome/apply/CAS wiring intact,
BOTH shells benefit); Phase 2 = collapse-by-default for canvas real estate + extension-native
"Open in IDE editor" bridge. Plan: `docs/plans/2026-07-15-editor-replacement.md`. Fresh session.

### B49 · Marketplace — ✅ PUBLISHED to Open VSX (2026-07-16) → ROADMAP; MS Marketplace still gated
**LIVE:** `x4forge.x4-forge-studio v0.0.4`, MIT, pre-release, at
https://open-vsx.org/extension/x4forge/x4-forge-studio — auto-updates in Antigravity/Cursor/
Windsurf/VSCodium. Namespace `x4forge` claimed; token in `.env.local` (OVSX_PAT); README/LICENSE/
manifest finalized; bundle PII-clean. **UPDATE LOOP:** commit → bump version → `npm run package`
(vsce --pre-release) → `ovsx publish <vsix> -p $OVSX_PAT` (Ken-authorized each time). **STILL
OPEN (not blocking):** MS Marketplace — blocked on Azure DevOps org requiring a subscription
(their gate); revisit when Ken wants stock-VS-Code reach. Flip pre-release→stable via a normal
(non-`--pre-release`) package+publish when ready.

### B49-old · Marketplace readiness prep (superseded by the publish above)
VERIFIED: Antigravity pulls from **Open VSX** → dual-registry publish. **DONE 2026-07-16:**
① machine-path genericize — runtime defaults now empty/harvest-dir (xsdParser), fixtures+
placeholders scrubbed of usernames/drives; client bundle 0 traces; server.cjs remaining =
generic VDF fixtures + public mod-name provenance (assessed OK). Stranger-machine sim: bare
staged app boots 200, gamePath '', health verdict honestly `blocked`→wizard. ② liveBridge
better-sqlite3 static import → lazy degrade (portability crash killed). Sweep on BARE install
78/81 — expression-suggest 0/0 red is HONEST now (old G:\ default silently loaded Ken's real
schema; configured instances stay green). **Ken's part:** MS publisher account + Open VSX
namespace + license choice + beta-vs-prerelease call. Then: package.json publisher/repo/
keywords finalize → `vsce publish` + `ovsx publish` (each Ken-authorized). Plan:
`docs/plans/2026-07-15-marketplace-readiness.md`.

### B50 · Activity-bar launcher icon (click-to-run) — ✅ VERIFIED 2026-07-16 (Ken eyeball confirmed) → ROADMAP
Icon renders in the Activity Bar rail + launcher opens with working buttons — confirmed live on
Ken's screen 2026-07-16 (the only residual). Full implementation record in ROADMAP.

### B48 Phase 2 · Canvas real-estate (collapse-default) + lazy editor — ✅ VERIFIED 2026-07-16 (e2e 19/19)
Code pane starts COLLAPSED by default (canvas +164px wider live-measured), last choice persists
(localStorage `x4_forge_code_collapsed`); the CodeMirror chunk is a lazy `React.lazy`/Suspense
import (own 358KB/gz118 asset) NOT fetched until the pane is first opened — canvas-only sessions
never download it (verified: chunkLoaded=false while collapsed). Editor + persistent top bar +
all chrome intact; expand/collapse/persist drilled live. FOUND+FIXED live: the collapsed drawer
stayed full-width because the top-bar's intrinsic width defeated the aside's inline width via
flex min-content — `min-w-0` + `overflow-x-hidden` fixed it (300px collapsed confirmed). e2e:
experience-mode spec updated (Expert now opens the editor via the pull-tab, since collapsed-default).

### B53 · X4_DATA_DIR seam — runtime data survives extension updates — ◐ IMPLEMENTED 2026-07-16
`data/` (agent keys, AI keys, AI spend meter, api-registry, harvested schemas) was cwd-relative =
wiped on every extension update (like config.json was pre-B51). New `src/lib/dataDir.ts`
(`resolveDataDir`/`dataPath`, honors `X4_DATA_DIR`, NOT coupled to X4_STATE_DIR); 8 call sites
migrated (server.ts ×3, xsdParser ×2, aiKeyStore, gameDetectRoutes, validationRoutes); extension
passes `X4_DATA_DIR=<globalStorage>/data`. Oracle `data-dir-selftest` 4/4. Live-proven: a booted
sidecar wrote agent-keys.json into X4_DATA_DIR, not cwd.

### B48 · Real editor engine (CodeMirror 6) replaces hand-rolled CodePreview — Phase 1 ◐ IMPLEMENTED 2026-07-16
Swapped the transparent-textarea/pre editor + custom line-diff for CodeMirror 6 (`CodeMirrorField.tsx`),
behind flag `CODEMIRROR_EDITOR` (old renderer kept as fallback). Editable editor + read-only split
(MergeView) / unified (unifiedMergeView) diff; XML highlighting + line numbers native; chrome
(tabs, 7 toolbar btns, status bar, minimap, editable-badge, apply/save pills) PRESERVED. Decision:
CodeMirror not Monaco (CSP/worker-clean for the webview; both shells benefit). **VERIFIED live:**
editor mounts, edits flow to draft (DRAFT-MODIFIED flips), diff MergeView renders, syntax
highlight + gutter + status bar confirmed via DOM + screenshot; tsc 0. Bundle +360KB (lazy-load =
Phase 2 polish). **Open:** e2e (running), extension repackage, Phase 2 (collapse-default real
estate + optional native-IDE-tab bridge). Plan: `docs/plans/2026-07-15-editor-replacement.md`.

### B51 · Schema discovery (recursive, subdir-aware, multi-XSD) + config persistence — ◐ IMPLEMENTED 2026-07-16
Fixes reported bugs: (1) schema scanner only looked top-level for md.xsd/common.xsd, so pointing
it at an unpacked game (`…\X4 unpacked 9.00`) found nothing; now `discoverXsd` finds XSDs in
subdirs (md/, libraries/, aiscripts/), prefers base game over DLC copies, recurses as fallback.
(2) aiscripts.xsd now discovered + wired into `getAiSchemaIndex` (ai_schema loads from the game).
(3) directory settings didn't persist across extension updates — config.json now honors
`X4_CONFIG_DIR` (extension → globalStorage), NOT the throwaway state dir. Oracle
`schema-discovery-selftest` 9/9. **LIVE-PROVEN** against the real unpacked game: md_schema "1339
elements", ai_schema pass, config persists. Caught+fixed a self-inflicted e2e regression
(configPath fell back to X4_STATE_DIR which e2e sets). Plan/decision: this entry + capability-map.

### B52 · In-app bug reporter → GitHub Issues — ✅ VERIFIED 2026-07-16 (e2e 19/19) → ROADMAP; ships in next release after Ken commits
Ken's decision: reports land in KennyG1990/X4_Forge **Issues** tab; entry point must be obvious.
Built secret-free: header **REPORT BUG** button (amber, both modes — verified visible in Beginner
default) → modal (title/steps/attach-details with the exact context SHOWN to the user) → opens a
**prefilled github.com/…/issues/new?labels=bug** page the user submits themselves; COPY REPORT
clipboard fallback; secret redaction (x4fk_/64-hex/Bearer → [redacted]); URL-length truncation
with full-body clipboard rescue. Engine `src/lib/bugReport.ts` + oracle `bug-report-selftest`
**10/10** (served live). Manifest gains repository+bugs URLs (store "Report Issue" link). LIVE
drill: empty-title blocked ✓, filled report produced the exact prefilled URL (title/body/label/env
verified) ✓, context visible ✓, screenshot taken. Plan: `docs/plans/2026-07-16-bug-reporter.md`.

### B54 · Sidecar auto-restart watchdog — ✅ VERIFIED 2026-07-16 (live kill-drill in Antigravity) → ROADMAP
DRILL PASSED (Ken-authorized, agent-driven): 0.0.11 installed + window reloaded (header v1.0.222)
→ sidecar :55430 killed by port-PID at 19:55:43 → watchdog respawned on :53143 within seconds,
status bar updated, the OPEN studio panel re-pointed itself (badge "managed sidecar on port
53143"), canvas + workspace intact; old port confirmed dead, new port HTTP 200. Published
stable 0.0.11.
Root cause of the 20:56 sidecar death: **the agent's own broad `Stop-Process` sweep** (filter
matched `node dist\server.cjs` — the "extension" marker lives in the CWD, not the command line;
exit 4294967295 = externally terminated). [REPRODUCED by timeline + filter analysis.] Procedural
fix banked (port-PID kills only — in handoff hazards). Product fix: the extension now
AUTO-RESTARTS an unexpectedly-dead sidecar (capped 3 per 5min with linear backoff; deliberate
stops exempt via the existing stoppingDeliberately flag; boot crash-loops degrade to the old
error) and RELOADS the open studio panel against the new port+token (without this the iframe
still points at the dead backend). extension.ts only; VSIX 0.0.11 packaged, watchdog verified
in the compiled extension.js. **Open gate (one drill):** install 0.0.11, open studio, kill the
sidecar PID from a terminal → panel comes back on its own + "restarted automatically" toast +
log line "auto-restarting (attempt 1/3)".

## P1 — Safety / architecture

### B101 · Rehydrate virtual graph-node tabs after extension-host restart `spec'd` (P1)

Installed B100 proof found one bounded lifecycle residual: `x4forge-node:` documents are intentionally
memory-backed, so Antigravity may restore a virtual URI before the restarted provider has reconstructed
its entry. The user sees a transient missing-document state until the graph node is selected again.
Persist only a safe selection descriptor (workspace identity + node IDs + token), never editable XML as
a second source of truth; on activation, ask the live Studio to rebuild the document from its current
graph, refuse stale descriptors, and retain B100's structural/stale/opaque save guards. Acceptance:
leave node tabs open, restart extensions, observe valid tabs rehydrate without a manual reselect; a
changed workspace refuses the old token; no virtual payload survives as an independent authority.

### B1 · Workspace sync-trust slice — ✅ CLOSED 2026-07-09 → ROADMAP (badge verified live; residual: badge clipping polish → B13)
### B1-old spec (kept for context) — `done`
The mutable-singleton + integer-version sync has caused two incident classes (e2e clobber; the 2026-07-09
stale-canvas overwrite). Full redesign is B2; this slice makes staleness VISIBLE and self-healing.
**Scope:** server computes a content hash of the active workspace and returns it from `GET /api/agent/workspace`
(and bumps it on every write); client compares its canvas hash each poll; on mismatch-with-no-local-edits it
adopts (version gate stays as tiebreak), on mismatch-with-local-edits it shows a visible badge
("Canvas differs from server — Adopt server / Keep mine") instead of deciding silently.
**Acceptance:** oracle for the hash (stable across key order, sensitive to node/property change); simulated
divergence shows the badge; adopt button converges; tsc/sweep green.

### B2 · Sync protocol replacement (ADR-F1) — ✅ ALL SLICES CLOSED (s1–2 07-09/07-10, s3 2026-07-12) → ROADMAP
Slice 3 closed 07-12: persistence + chokepoint + legacy gate + park-on-switch; acceptance proven live
(zero-client restart survival ×2; blank-client incident reproduction → dead). Residuals folded into B26
(guard self-check + RESET-button audit + guard-removal decision). B12 tabs ride the parked-state map.

### B3 · Console health probe — ✅ CLOSED 2026-07-09 → ROADMAP (Ken's live drill: closed the Web window →
respawned ~60s; closed the API window → respawned; both verified from the agent side, app + API answering)

### B25 · AI spend meter + daily cap — ✅ CLOSED 2026-07-11 → ROADMAP (oracle 7/7, sweep 70/70;
GET /api/ai/usage live; cap-trip proven by oracle, not by spending)

## P2 — Committed audit work (deferred by budget)

### B4 · R3: quick-fix graph mutations — ✅ CLOSED 2026-07-09 → ROADMAP (oracle 20/20, headless compile-legal
proof; ◐ residual: in-UI eyeball of the new cards at Ken's next session)
### B4-old spec (kept for context) — `done`
Extend `QuickFixDescriptor` ops with graph mutations (`add_node` / `add_link`); make modFixes'
"cue has no trigger" ADVICE a MECHANICAL one-click fix (adds + wires an event node); fold the 💡 advice
block into the 🔧 apply block; retire `modFixes.ts` + its selftest once absorbed.
**Acceptance:** quick-fixes oracle covers add_node/add_link paths; a triggerless cue on a scratch workspace
gets a working one-click fix (validated by compile + crossfile); modFixes selftest removed from the sweep
with its checks migrated.

### B5 · Sidebar Properties Inspector extraction — ✅ CLOSED 2026-07-10 → ROADMAP (flipped by B15's fix; suite 11/11)

### B15 · canvas-interactions RED — ✅ CLOSED 2026-07-10 → ROADMAP (root cause: B1 adoption poll vs the
spec's POST-only isolation; GET isolation ported with capture-first toggles; suite 11/11, spec 3× green)

### B6 · xmldom scan — ✅ CLOSED 2026-07-09 → ROADMAP (DOM-first with regex degrade; 8 new oracle checks; real mod compiles clean)

### B7 · Small fixes pair — ✅ CLOSED 2026-07-09 → ROADMAP (drift verdict + wizard checklist, both verified live)
(a) `computeModDrift` excludes tool-owned metadata (`.studio-mod-id`, `.forgekeep`) from the VERDICT
(still listed, never "drifted" alone). (b) Compile wizard renders the deploy-verify checklist card in the
wizard's result step (verdict currently hides in the Playtest tab).
**Acceptance:** drift on the real mod reports `identical`; wizard confirm shows per-stage rows incl.
source-sync; a stale-canvas 409 renders the failure row, not a toast.

## P3 — Release track (parked: Ken's call on timing)

### B8 · G5: packaged installable build — `parked`
Single artifact a non-dev installs (Electron or single-binary + static bundle); includes G6 residuals
(README, support docs, release assets). Production mode already exists (API_ONLY + static serving +
run_command gated out).

### B9 · One-click distributable — ✅ CLOSED 2026-07-10 → ROADMAP (zero-dep zip engine, 21/21 oracle,
independent-extractor verified, gate blocks red builds, Playtest button live)

## P3.5 — Vision v2: barrier-to-entry track (ADR-F2, ratified 2026-07-11)

> Direction: "the UE5 editor for X4" — TTFM (Time To First Mod) is the north-star metric.
> Full plan + sequencing rationale: `docs/plans/2026-07-11-vision-v2-ue5-editor.md`. Items below
> are Phase 1/2 (buildable now); Phase 3 rides B2s3/B8; Phase 4 starts with the B24 spike.

### B18 · First-run setup wizard + game autodetect — ✅ VERIFIED 2026-07-16 (visuals SEEN + fresh-boot acceptance on scratch) → ROADMAP
Both open gates closed 2026-07-16 on an ISOLATED scratch instance (X4_STATE/CONFIG/DATA_DIR →
scratchpad; game dir read-only): wizard visuals eyeballed via Claude-in-Chrome screenshots (modal,
detect card, proposal rows, buttons all render); full zero-typing auto-setup run end-to-end in
~15s (<2min bar) — detect→harvest 3 XSDs from real cat/dat→apply→reload → walkaround flipped
"2 blocking" → "nothing blocking", md 1507 elems + ai 1488 + 2333 scriptprops loaded from the
wizard's own writes. BONUS: the eyeball CAUGHT a real B53 coupling bug (proposal.xsdSchemaPath
was cwd-based while harvest writes to dataPath → extension auto-setup would point config at an
empty, update-wiped dir) — fixed in gameDetectRoutes.ts, live re-proven. **Residual (minor):**
GOG detect branch still unverified (no GOG install available); ships in 0.0.10.

### B27 · Selftest index endpoint — ✅ CLOSED 2026-07-11 → ROADMAP (sweep 71/71 via runtime index;
acceptance diff caught 2 census errors incl. a nested-path oracle NO prior method ever swept)

### B19 · Template → in-game guided rail — s1 ◐ (07-11) · s2a+s2b ✅ CLOSED 2026-07-12 → ROADMAP
s2a: server `verdict` field (oracle 9/9) — rail + Playtest render it, TTFM gated on true loaded_clean.
s2b: beyond-canvas templates (price patch / t-file / HUD button, oracle 23/23) + the two coupling
fixes (onboarding empty-in-every-domain; rail mounts on any-domain content). **Open (game-gated):**
rail-to-game EXPERIENCE + template stamps → in-game batch. **Acceptance (final):** a non-author tester
ships welcome-message to a running game on on-screen guidance alone.

### B33 · RESET → template picker — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
(dead starter cue removed from BLANK_WORKSPACE; RESET→picker proven live; sweep 75/75, e2e 12/12)

### B37 · Beginner and Expert workspace shell — ✅ VERIFIED 2026-07-16 (Ken eyeball closed the last gate) → ROADMAP
Both shells confirmed rendering correctly live on Ken's screen 2026-07-16 — the only open gate
(the in-app screenshot transport had timed out on four captures; every machine-checkable layer was
already green: tsc/sweep 80/80/e2e 19/19/build/precommit/DOM+interaction drills). Full acceptance
contract: `docs/plans/2026-07-14-beginner-expert-workspace.md`.

### B38 · Playtest Deploy and Prove — `SPECIFIED` (implementation waits behind the B34-B37 commit point)
Consolidate the existing deploy-verify, watcher verdict, cue liveness, FORGE-WATCH/FORGE-STATE, source
navigation, and artifact surfaces into one deterministic proof session. Fix the reproduced blank-path Playtest
deploy bug (it currently omits the visible workspace), and let file-load evidence prove data-only mods are seen.
Exact current-workspace/game-target confirmation is mandatory; validation uses a purpose-built scratch workspace,
not an unsafe automatic clone. Full acceptance record: `docs/plans/2026-07-15-deploy-and-prove.md`.

### B20 · TTFM instrumentation — ✅ CLOSED 2026-07-11 → ROADMAP (oracle 9/9, sweep 68/68, e2e 12/12;
report panel deferred until the first real funnel completes)

### B21 · MD action-frequency census — ✅ CLOSED 2026-07-11 → ROADMAP (oracle 12/12; live corpus:
106,437 instances, top-52 actions = 90% of usage, curated already 41.4% of instances)

### B22 · Pattern browser — s1 ◐ (07-11) · s2 ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Mid-canvas stamping live (oracle 16/16 incl. a caught cue-name-collision defect; stamp→undo drill
green). Card unification deferred → B13 batch 2.

### B28 · Browser-pane wedge — ◐ CLOSED-RECLASSIFIED 2026-07-12 (workflow v3, PARTIAL) → ROADMAP
Ours (Vite watch gaps killing evals) fixed via B29/B26; the tool's (screenshot/stale-frame/click-desync
in the pane's capture path) banked with workarounds — no buildable Forge unit remains. Escalate
upstream if it persists across sessions.

### B29 · Header horizontal overflow — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Fits at 1280 AND 1920 (DOM-rect drills, 0 clipped controls); conflict card promoted to a fixed
sync-status layer (unclippable by construction); live-409 negative path proven at 1280; e2e 12/12,
sweep 73/73. Bonus: found+fixed the B2s3 Vite watch-ignore gap (persistence writes were
full-reloading every client) and closed the Keep-mine residual end-to-end. Note: label-restore
threshold min-[2150px] is a measured constant — re-measure if the header gains features.

### B23 · Installer unpark decision package — `blocked` (Phase 3; KEN GATE, after Phase 1 lands)
When TTFM-in-app measured ≤15 min: present B8 unpark w/ funnel evidence; Electron-vs-single-binary
ADR at unpark. Until then B8 stays parked.

### B24 · Live game-state inspector — SPIKE ✅ CLOSED 2026-07-11 → **ADR-F3** (StarForge decisions.md);
slices spec'd below
**B24s1 · FORGE-STATE parser + Inspector panel** — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) →
ROADMAP (oracle 12/12; endpoint + panel DOM-proven against a synthetic fixture; in-game emission →
in-game batch). **B24s2 · probe-extension generator** — ◐ IMPLEMENTED 2026-07-13 → ROADMAP: generator
(`forgeProbe.ts`) + oracle 9/9 + read-only `/api/agent/probe/preview` all VERIFIED (probe compiles to 0
errors, read-only invariant enforced, round-trips the parser; also fixed a latent B24s1 `\"`-vs-`&quot;`
emit bug). **◐ residual = the deploy + in-game confirmation** (write gate + game session, Ken). Periodic
heartbeat needs a `checkinterval` emit the compiler lacks (further follow-up). Constraints (binding):
optional, read-only, zero impact absent; bridge = lessons only.

## P4 — Depth / UX long tail

### B10 · curated action semantics — slice 1 ✅ CLOSED 2026-07-11 → ROADMAP (**91.5%** of observed
usage curated; oracle 50/50). Remaining = OPTIONAL-DEPTH / DEMAND-DRIVEN NOTES (NOT queued agent work):
- **tags beyond the top 52** — demand-driven; the top 52 already cover 90% of real usage.
- **xsdParser `structural`-category rider** (B21 worst-pick) — `classifyFromGroup` labels structural
  child-elements (param/text/owner/position/rotation/safepos/match/replace) `'action'`, so they enter
  `schemaLibrary.actions` and the census's `actionTags` filter (server.ts ~7552). Fix = add a `structural`
  category; census/palette/explain exclude it. **Reconciled 2026-07-13 — why it's NOT force-built:** (1) its
  ACCEPTANCE (live census/palette stop showing these) needs the LIVE game schema + corpus loaded = Ken's
  configured install, so not cleanly agent-verifiable here; (2) it's a schema-layer change feeding
  palette/templates/validation — real blast radius, deserves fresh context, not a marathon tail;
  (3) the user-visible symptom is ALREADY handled (B10s1 curated these kind 'other' in mdSemantics). SPEC'd
  for a future session with the schema loaded. Blast-radius readers to check first: `schemaLibraryToTemplates`
  (schemaTypes.ts:81), the action/control_flow split (xsdParser.ts:291), census `actionTags` (server.ts:7552).

### B11 · aiscripts visually editable — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED — ALREADY EXISTED; stale entry)
Reconcile + live drill proved the full chain has existed since #65 + the AIScriptEditor: guarded
byte-faithful import → editable AIBehaviorScript model → the editor's visual pipeline edits it (UI field
edit → model updated, drill-proven). The "no visual surface beyond code view" claim was stale. No code
written — the workflow's redundant-infrastructure rule in action.

### B12 · Multi-workspace switcher — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
(parked-state optgroup in the header select; non-destructive round-trip proven via the real user flow;
tab-strip chrome deliberately out of scope — switch-without-loss was the substance)
· RESIDUAL CLOSED 2026-07-13: domain-aware `contentSummary` replaces "0 nodes" for beyond-canvas parked
states (oracle 11/11, live-verified). Standing-hazard sweep also run same day (clean + 1 dead-wipe
foot-gun removed) → ROADMAP.

### B13 · QoL batch — batch 1 ✅ (07-12) · batch 2 ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Batch 2: override-map→Diff→Patch pre-target (event+mailbox, mount-race caught+fixed) · HUD-button
3-step wiki guide · StarterCard unification (B22s2 deferral closed). All drills live; suite green.

### B17 · e2e gate hygiene — ✅ CLOSED 2026-07-11 → ROADMAP (green/red/no-tests all verified; Node-bump
probe ◐ Ken-gated machine change)

### B26 · workspace-guard restore self-check — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Restore-verify marker + wrapper red-on-FAIL (negative path drilled); api-selftest 6/6 covers all gate
branches; RESET audited clean (CAS + parks); runtime-writes audit found+fixed a 2nd vite gap (data/**).
Guard KEPT until B31. Residual note: verify line can race the libuv crash → B31 moves it in-process.

### B31 · Ephemeral e2e server state — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
Suite 12/12 ×2 on its own per-run stack; guard + all workspace route-mocks DELETED; live workspace
untouched with no restore ever running; acceptance literal (0 interceptions). e2e no longer needs the
machine-state ask. Bonus: the libuv crash didn't reproduce off the shared server (3 runs).

### B16 · run_command async-job mode — ✅ CLOSED 2026-07-09 → ROADMAP (dogfood-verified: app answered in 7ms mid-job)

### B14 · Staleness-era leftovers — ✅ FULLY DISPOSITIONED 2026-07-12 (all remaining lines Ken/game-gated)
KEN-GATED: XPath match counts (lib = dependency DECISION, local-npm-only posture) · golden round-trip
corpus (needs Ken's mod paths) · P-C/P-D mod profiles (stale spec — keep-or-drop call). GAME-GATED:
T1.3 runtime ftable loader. T4.3 "canvas arrow" → CLOSED (already resolved by substitution in the 37th
pass: the PropertiesInspector's contextual Lua↔MD binding panel; live-drilled 07-12 → ROADMAP).

### B32 · Recurring-mistake tripwires — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
TRIPWIRES table in precommit-check.mjs (runs before typecheck, named messages); negative drill BLOCKED
exit 1, green tree exit 0. Add future mechanical-mistake patterns to the table.

### B30 · Mirror-drift gate — ✅ CLOSED 2026-07-12 (workflow v3, VERIFIED) → ROADMAP
(precommit byte-compares the 3 in-repo mirrors; deliberate-divergence drill BLOCKED exit 1; green now.
The GLOBAL <DEV_ENV>\CLAUDE.md copy remains Ken's named canon-lag item — outside this repo's gate.)

### B63 · Community round-4 features (ecosystem/overhaul gaps) — A1 ✅ SHIPPED; A2/A3/C1 open, B1 PILLAR (Ken decision)
Research (pre-culled, 2 agents triangulated): `docs/research/2026-07-18-community-gap-map-round4.md`.
- **A1 ✅ SHIPPED** (factions.xml relations lint: value bounds [-1,1] + unknown-target-faction, oracle 11/11,
  corpus-clean 232 relations, 0.0.27) → ROADMAP.
- **A2 OPEN** — god.xml station-placement lint (matchextension="false" gotcha + macro resolution; COMPLETELY
  uncovered; needs the object index for macro refs). Strong next lint, reconcile-first.
- **B1 (Ken decision) — BULK PARAMETRIC TRANSFORMS pillar**: select-by-rule → multiply/set property → emit
  <diff> (X4_Customizer's domain; the 3rd pillar author/validate/TRANSFORM). Highest impact, multi-unit
  (rule engine + selection UI + emit); composes with synthesizePatch + the validators. NEEDS A SPEC + Ken go.
- **A3** loadout slot-fit (needs slot-count from ship macros; heavier). **C1** computed balance stats (DPS/
  margin/slot tables; analysis value-add). CULLED-OUT (already covered): derive-diff-from-two-files
  (synthesizePatch exists), IntelliSense, sector editor (#64), cat/dat pack (B62f-adjacent).

### B63 round-4 continued — A2 (god.xml) REJECTED by reconcile; B1 pillar + object-index-maps prereq open
**A2 REJECTED (corpus-falsified):** god.xml matchextension="false" is omitted by 495/496 vanilla locations (mod convention, not a rule) → cry-wolf; macro-resolution can't work either — only 18/151 god.xml macros are in index/macros.xml, the other 133 are sector/zone/cluster macros in maps/ which the object index (x4ObjectIndex scans index/*.xml only) doesn't include → would flag 133/151 vanilla macros. **PREREQ for a safe god.xml lint: extend x4ObjectIndex to also index maps/ sector/zone/cluster macros** (a bounded infra unit; also improves reference pickers + liveFixes macro-existence broadly). Then god.xml macro-resolution becomes clean (0-bar). **B1 (bulk-transform pillar) remains the strategic next-big-thing (Ken decision).** Round-4 net so far: A1 factions ✅; A2 falsified; a/d/e (round-3) falsified/covered — the EASY lint wins are genuinely mined.
