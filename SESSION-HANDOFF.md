# Session handoff — B119 X4 UI editor source-first renderer and linter

Date: 2026-08-21
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL — Not verified in game`

## Session-start brief

- Project: X4 Forge B119, faithful 2D X4 UI source-first editor. Port shipped `helper.lua` /
  `widget_fullscreen.lua`; preserve real Lua calls; keep the linter and deploy/game gate authoritative.
- Eyeball queue: Forge's isolated rendered production surface has been inspected. AI Influence dogfood authoring is next;
  deployment and X4 experience proof remain Ken-gated. The permanent product state is `Not verified in game` until X4
  renders the deployed bytes.
- Commit question: the executable B119 checkpoint is committed and pushed at
  `505253ba4fa40c75fcb252945229841766685a05`; readback proved `origin/main == HEAD` and zero staged paths immediately
  afterward. This handoff, backlog, and the two B119 plans are the separate documentation-close checkpoint. Preserve
  every unrelated dirty path.

## Latest continuation checkpoint — full host gate green; commit checkpoint unlocked

- Ken's unattended machine gate: Antigravity running, X4 stopped, machine quiet. No subagent remains open; ports
  3000/3001/3100/3101/3200 are free and X4 is absent.
- B119 SourceEditor `Reload` now sends `cache: 'no-store'` through the existing bounded corpus transport. Causal mounted
  fail-first was exact `[null,null]` versus required `["no-store","no-store"]`; final SourceEditor/mounted hashes are
  `A05F47E6B117225D35EB69255C9EA215334B67C2C7FF31BB26D5C04D13059813` /
  `D15C6F4295E93D1929615329AA219317DBB2AC0D27AFA983EE2BA9EEF1B277E3`.
- Coordinator mounted receipt is structured `1/1` green at SHA-256
  `1EBC966BFD93FDCBAD550F1C8AB1B2B2DED32C6FE5EA8CB30DC5424A2E47266F`; lifecycle complete, `treeGone=true`, no
  remaining PID, exact `.studio-state`/`data`/`config.json` pre/post content parity. SourceEditor matrices, typecheck,
  exact lint/diff, and rebuilt production bundle pass.
- The first precommit exposed an unregistered Scene unique-temp reparse fixture. Its honest reviewed chain is now exact:
  durable writers `AC0240CF553F505CC8F4C85A55792D16C2C39558B23546757CA954B4B8E4CF14`; reviewed coverage
  `DBF9366E62302D925BFD1A6BCD049B830B86DCC5AA7CE69E777C130A7C8548FA`; policy pin
  `07BAA23E5E33B3C94E61FEA907DB8C940A64D45199FF2DC9F756A330276C6D27`; policy selftest
  `220B6DD6F5D4CF038EDB03C32CFDB2CB8EE761BFCBB265BA61ABA4AEA93DC417`.
- Guarded candidate promotion changed zero routes (`82`), added only
  `filesystem-writer:src/lib/x4UiScene.selftest.ts`, moved reviewed surfaces `55 -> 56`, and shifted 16 later writer
  references by index only. Candidate envelope `ffab715c...15076c` was removed after verified promotion. Policy bundle
  is `18/18`; package candidate/promotion is `57/57 + 23/23`.
- The retained global Node `24.15.0` no-report deaths are host-runtime evidence, not erased history: the exact full suite
  died with Windows `0xC0000409`, including one immediate pre-discovery death. Isolated `continuous-polling` passed
  `39/39` and the exact first four-spec prefix passed `48/48`, each with complete lifecycle teardown.
- That immediate death exposed a deterministic receipt contradiction: empty stdout serialized `totalTests=0` with
  `noTests=false`. Exact native Luna repaired only `scripts/run-e2e.mjs`; causal selftests went `54/55 -> 55/55`, final
  file SHA-256 is `836D690243CB822ADC310BCE2FE16253100C8BAB3D96E4241D2569D1115747A2`, and fresh zero-write Luna audit
  `01a022b0-13a9-7a92-a4df-34472b6f1cc7` returned `CLEAN`.
- The machine already contained Node `24.19.0` / libuv `1.52.1`. With only a process-local `PATH` prepend, the exact
  full E2E suite passed `104/104` in 8.5 minutes. Verified receipt SHA-256 is
  `48CDE7843D32C997AF8369D8F4B601A71D149966C3CC2F6B7172CDBB0511E5D0`; discovery/terminal counts are both `104`,
  lifecycle is complete, `treeGone=true`, zero PIDs remain, all ephemeral/live ports are free, X4 is absent, and the
  canonical live `.studio-state` / `data` / `config.json` receipts are byte-identical before and after.
- Complete `npm run precommit:check` under Node `24.19.0` is green: verdict selftest `55/55`, lifecycle/product copy,
  writers `14/14` plus extension `8/8`, capabilities/MCP, action receipts `82/56`, typecheck, and size guards all pass.
  Production build is green. The code graph was refreshed to `9665` nodes / `24226` edges / `327` communities; the
  attempted unsupported `graphify update --max-workers 2` option failed before execution, then the real refresh passed
  at below-normal priority and left no graphify process.
- Isolated rendered production proof is complete for permanent `Not verified in game`, linter, canonical-source,
  fail-closed preview, and measured keep-outs. The stopped disposable 3200 fixture remains at
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-prod-3200` because exact deletion was blocked before execution;
  do not shell-hop to remove it.
- Pre-full-run worktree authority was 83 unstaged status paths / 3,842 UTF-8 status bytes / SHA-256
  `8066F4ED9EBFBE9B3FAD2422E0D9DA517B56990320B49F3699C06E63D87629D6`, zero staged, and it was exact after the run.
  The explicit 35-path implementation stage contained only reconciled B119 source/config/test files; cached diff hygiene
  passed before commit. Commit hook precommit passed again and launched a background graph refresh which completed with
  no remaining graphify process. After this documentation write, stage only the four B119 records, inspect the cached
  diff, commit, push, and prove `origin/main == HEAD`.
- Overall status: `IN_PROGRESS / PARTIAL — Not verified in game`. Authoritative detail and AAR are appended to
  `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`; no capability-map delta.

## First action on resume

Build the AI Influence `1b` literal-reference and keep-out-safe variants inside an isolated Forge workspace from the
already-inspected 2560x1440 references. Use real X4 Lua calls and the configured unpacked corpus. Do not write the live
mod, game extension directory, standing config, or launch X4 without Ken's explicit write-gate response. Preserve the
permanent `Not verified in game` state and treat deployed X4 screenshots as the authority.

## Latest continuation checkpoint — P7 promoted, broad validation active

- Ken supplied the machine gate on 2026-08-19: Antigravity open, X4 stopped, machine quiet.
- P7 SourceEditor/session plus the mounted lifecycle and E2E data-isolation boundary are `FOCUSED VERIFIED / CLEAN`.
- Final mounted spec hash: `5ABE7E0235FC41EAD822AC07CF59B403761ADAB2573C764D3DF67B3B1D63AC3E`.
- Frozen mounted receipt: `test-results/e2e-verdict.json`
  `95BD5006AD61E8E16CDDD3B7C66B090634A7DED00E0D2A684052B52ED37B9714`, generated
  `2026-08-19T23:58:12.183Z`, `1/1` expected, lifecycle complete, `treeGone=true`, no remaining PIDs.
- Accepted production/focused hashes remain SourceEditor
  `335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57` /
  `3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD` and EditorSession
  `990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213` /
  `751E520F77EA28E1635A3CD87D63BF6ACFB721942FCA3B610E79A4D2F8DFC7AC`.
- Coordinator gates pass: SourceEditor `12/12`, EditorSession `7/7`, E2E containment selftest, typecheck, exact
  seven-file ESLint, and exact diff hygiene. Fresh zero-write Luna `01a01c7a-34f9-78c1-ab77-61707af2ce94` returned
  `CLEAN` with no files changed.
- Exact worktree authority is 59 NUL entries / 2,387 bytes /
  `E7F3756DF0BD50D7D8CC5A117550604F394EB0647F4BA8E3E1642F8FCC781EDA`, zero staged, and
  `HEAD == origin/main == 77138741a9f470e2c6c37c2d6857688dd1e2b13e`. Preserve every unrelated dirty path.
- Next exact unit: run the isolated runtime-oracle gate, then serial full E2E, precommit, production build/package,
  and real rendered Forge visual inspection. Only after those pass: dogfood every AI Influence reference, preserve both
  literal and keep-out-clear `1b` variants, deploy exact bytes, and validate in X4.
- Overall truth remains `IN_PROGRESS / PARTIAL — Not verified in game`.

Broad-oracle update: runtime discovery contains 134 current oracles. The first run was `132/134`; only
`lua-static-selftest` and `project-orchestration-selftest` (`12/14`) failed. Their fixtures still expect
`addTable(13)` to block even though accepted production correctly warns at 13-23 and blocks at 24+. This is
`[REPRODUCED]` stale selftest authority. Luna `01a01c83-fdbc-70d3-bdbb-65890016f6e1` owns only
`src/lib/luaStaticAnalysis.ts` and `src/lib/projectOrchestration.ts`; require explicit 13-warning and 24-error rows plus
runtime `134/134`. Do not start full E2E until it returns and coordinator review passes.

Correction candidate is now worker/coordinator green: Lua `31/31`, orchestration `15/15`, typecheck, zero-error exact
lint, diff hygiene, and isolated runtime index `134/134`. Final hashes are
`04F5820CA77B429626E110EC561E34587207821B7A9F420139B70918990A496E` /
`3376624C5B55B3C9AE0F56ECA7DD06B967012D228B1A5B0134CA8E9698A303AB`. Exact current worktree is 61 NUL entries /
2,454 bytes / `A04DB7221CBF0B85E7AA36ADA33A53646BB12792B8289BA6D1C92E23874A771F`, zero staged; the two new owners explain
the count change. Zero-write audit `01a01c95-618e-74e3-9f1d-5cf339bf10f9` is active. Full E2E remains locked until it
returns `CLEAN`.

The audit returned `CLEAN` with no writes and independently passed focused gates plus runtime-index `134/134`. The broad
oracle gate is accepted. Capture full live-root/worktree receipts, then run exactly `npm run test:e2e` serially and parse
`test-results/e2e-verdict.json`; verify teardown, ports, X4 absence, and persistence parity afterward.

Full E2E ran and is `FAILED REQUIRED METHOD`: 102/103, one repeated project-browser failure because the test required
manifest `ready` but the fresh isolated data root correctly returned `scanning`. Receipt
`D106E146E500EF65A869534B4DC7A3B44480E9F9A869D5EEE0CB87A78933C7A2`; lifecycle complete/tree gone. Studio/data/config
content receipts and worktree status are exact before/after. Production is not stuck; the old live-data leak masked an
invalid immediate-readiness assumption. Tests-only owner `01a01cab-4297-77a0-af08-9028c642f2b4` is correcting only
`tests/e2e/project-browser.spec.ts`. Require strict status-shape coverage, focused green, review, and zero-write audit
before rerunning the 103-test suite.

The one-spec candidate hash is `3E8E8966164E30E0557A9E8F36FF4997F3C6D9FB2E8C2DECD22CE8344DF9E2BC`. Worker and coordinator focused
structured runs are 3/3 green; coordinator receipt `C9ADC7DD7F96840BB1610CA7016B60FE9056FA3C9560769734553AEF212FA504`,
tree gone. A prior coordinator launch exited 3221226505 before any structured report and remains a rejected AAR event.
Current status is 62/2,491/`F59E6635628F79E43B7F91BF4677C5C4385172CFF7B0BCBA0BCE9EC5995706E5`, zero staged.
Zero-write audit `01a01cb3-5172-7812-b275-ed55c0bf38c0` is active; rerun full E2E only after `CLEAN`.

Post-restart replacement audit Pauli `01a01d16-ae78-7ec2-9247-4afa0e297116` returned `CLEAN` with zero writes, exact
candidate hash, `HEAD == origin/main`, 62 status entries, zero staged paths, diff/hostile contract review green, and
fresh-runtime cap `4`. The coordinator captured the terminal receipt and immediately closed the worker with terminal
`completed` previous status. The one-spec correction is accepted at focused/audit scope. Next exact action is the
serial full-E2E rerun plus teardown/live-root parity, after a fresh answer to the mandatory machine-state ask. Overall
B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

## Current accepted boundary

- Batch 8A call-model statement/deletion provenance is accepted at production/selftest
  `E0842D11D156764917DC36740294D43FA7CBCC75089C4B4187E17190DBF4CD4C` /
  `7CDB2CA96D5E545E1DAB4CDF44FF874CA507066373C8DBE818E43EBB3977D432`, CallModel `57/57`.
- The source-first Layout → Scene → Preview → Paint/session path is focused-accepted. Exact configured MENU/HUB/COMM
  sessions reach non-refused Paint, zero Preview gaps, and `canRender=true`, but remain
  `Not verified in game` / `gameVerified=false`.
- Accepted production/selftest hashes:
  - EditorSession: `3B76B8962E5423BED24EC6FFE1B3CC7362DEC81F16D1A3857DB3C2D7426E0F9F` /
    `97CAF17EB7C7498C81492A0BF29CADB3BE2EACF6370A8756BF2C473E05FDC60C`;
  - Layout: `334BBD62869559385537E610BEBD1B8FCBE24F5515357FE1C4C20EA674669A42` /
    `595AFA93EEE1893D591798F73F49D09717650BC06853D01E9FD4EBB15C070C0D`;
  - Preview: `CF429EB982BED6C424DCB778AC7D184EBABDA4C9330364DAC12431BCA223CA82` /
    `5D85E9810C9776B87D24A8EFFF6AF57740534998E0D4AC8C7B3EEABEFA328324`;
  - Paint: `9FDBE53D68F516DD36670ABC1DF75F65611F81C3EA34E99BEA546EE905005A85` /
    `A0680C4B1B748695EE59BB63858B11A7693D3721CE2F09BB8C101E46B46799BF`;
  - Scene: `FE85C52848C7643EA6B5195FCA4C4270E7036F763BE756CB48327D599050BF99` /
    `34A4D496C968366A18DB6023D2F6BD91F50C2C1A066F6D75BC0944F49FF35C8F`.
- P1 color-call provenance is accepted at CallModel production/selftest
  `35A75178A444232D0EB41F0D8A65CDEDFFCC15A224467C35AAB121A2BF19EC6C` /
  `6DD840BB51E381EB754AB0440C06DBB4BBC846E632CC20FE55FCEEC752323E4B`, `68/68`.
- P2 configured canonical-default colors are accepted at CorpusAssets production/selftest
  `FFC90BE312FFC3ACA728C039A00F6FE410F291EFBC49C3DF6D9775E24606D818` /
  `AB57AE45BCBFB13D8B8A26D02425E4D25297E48874B74831C6F750D707326609`, `39/39`. The public loader returns the exact
  pinned real-corpus 224 base colors / 804 mappings with issued authority and permanent `Not verified in game`.
- P3 typed LayoutProgram colours are accepted at production/selftest
  `F2E877693DAD16ACF59846E26FEC2BDE8FCE7C69AC1D86623A2F3109D5CD6D17` /
  `758C622CF0289F231AF710B9EC8EEB86AAC12773F4B2D1A79757F5B0A03353B8`, `604/604`.
- P4 Scene issuance/colour ownership is accepted at production/selftest
  `FE85C52848C7643EA6B5195FCA4C4270E7036F763BE756CB48327D599050BF99` /
  `34A4D496C968366A18DB6023D2F6BD91F50C2C1A066F6D75BC0944F49FF35C8F`, `139/139`. It rejects semantic-valid but
  unissued pairs before geometry/getters, retains exact known and unavailable colour ownership, and keeps all residual
  material/state/glow/C++/font/game uncertainty. Final zero-write Luna
  `01a01938-d17c-76a2-9e17-d910b66e9e80` returned `CLEAN` with no findings or writes.
- P4.5 Preview colour ingress is accepted at production/selftest
  `CF429EB982BED6C424DCB778AC7D184EBABDA4C9330364DAC12431BCA223CA82` /
  `5D85E9810C9776B87D24A8EFFF6AF57740534998E0D4AC8C7B3EEABEFA328324`, `102/102`. It forwards only the exact safely
  captured loader-issued authority, produces genuine colour-bearing Preview-to-Paint authority, and rejects structural
  copies/hostile forms. Final zero-write Luna `01a01955-12ed-73a2-9c8e-06b8a4130d8b` returned `CLEAN`.
- P5 Paint base-tint projection is accepted at production/selftest
  `9FDBE53D68F516DD36670ABC1DF75F65611F81C3EA34E99BEA546EE905005A85` /
  `A0680C4B1B748695EE59BB63858B11A7693D3721CE2F09BB8C101E46B46799BF`, `165/165`. Its tests-first receipt was
  `159/165` with exactly six causal reds against frozen production. It retains all ten exact owners and raw alpha
  domains, projects parent text tint to glyphs, keeps residual diagnostics and partial game truth, and preserves the
  no-colour command shape. Final zero-write Luna `01a0198b-0877-76e2-b229-988ca8ce9e7b` returned `CLEAN`.
- P6 Canvas tint rendering is focused-accepted at production/selftest
  `C7B277D7A471C77A352A184881015E1F3C5C867CE1443108D84CE965D2278B94` /
  `FC493F3B263C9A1340A3E2BB264DAFBFDDBB9043CCB265C16343797CAC9CAE9C`, Canvas `113/113`, Stage-B `38/38`. Worker and
  coordinator also passed Paint `165/165`, Preview `102/102`, Scene `139/139`, typecheck, exact lint, and diff hygiene.
  Fresh zero-write Luna `01a01a94-1779-7d80-965a-cae9d3278d53` returned `CLEAN` with no writes and exact 56-entry
  status parity. Browser/package/deploy/X4 remain open.
- P6 correction tests are now frozen at `F401AE90628E26D261AEBD0D4C785B247ED6C022E0086765F04EF334C0BE4351` against
  exact old production `490F430673C51957751A3113C68046A10C811F355A349FDDBC2C064AB119DBB3`. Authoritative fail-first is `107/113`,
  Stage-B `32/38`, with exactly six `mutationApplied=true` reds for the three audited validator families. An earlier
  invalid-marker run led the worker to edit production before review; the coordinator interrupted it and restored the
  frozen hash byte-for-byte. Preserve that non-clean incident in the AAR.
- P7 authoritative fail-first keeps production exact at SourceEditor `B085A0A5...5C3C2` and EditorSession
  `20B74290...AF0`; tests-only are `ABFB4C59...94339` / `09C75353...6D86B`. New matrix is SourceEditor `1/12` plus
  Session `3/7`, exactly `4/19` green and fifteen behavioral reds. Existing matrices, typecheck, exact lint, and diff
  hygiene pass. The sampled descriptor facade is ready and reports zero production color reads plus no final owners;
  no production test hook is needed.
- Exact configured receipts at 1920×1080, UI scale 1:
  - MENU: Layout `16 samples (11/5), 66/27 operations, 1/4/9/88, 95 gaps`; Scene
    `1/4/2/16/3/5/7`, 141 diagnostics; Paint `207/169`;
  - HUB: `11 (9/2), 18/11, 1/2/2/4, 16`; Scene `1/2/2/4/0/0/0`, 31; Paint `46/37`;
  - COMM: `5 (5/0), 14/12, 1/1/1/3, 11`; Scene `1/1/1/3/0/0/0`, 23; Paint `35/29`.

## Current worktree containment

- HEAD/origin remain `77138741a9f470e2c6c37c2d6857688dd1e2b13e`.
- Exact status inventory at the P2 audit boundary is 56 entries. The correction and zero-write audit preserved that count.
- Preserve every unrelated modification, deletion, and untracked file. In particular, do not touch the Discord/data/docs
  deletions, VS Code evidence, `test-results/.last-run.json`, `.claude/`, `Note for Kimi.md`,
  `REFACTOR-PLAN.md`, `mermaid-diagram.png`, or `target.name`. Two accidental zero-byte probe files were confirmed
  absent after bounded cleanup; do not recreate them.
- Frozen WorkspaceSource production/selftest:
  `B56B7A1ADD1AFD52EAFDBC077AF747DD93148CA9A62DAEDFC89CAD096D0F813E` (29809 bytes) /
  `358F0C7837C42B13097EB0D053C0100F8AFEBF1595C19FC855619E5E2D311CFE` (30141 bytes).

## Active unit — Batch 8B round-eight rejection / round-nine correction active

The round-eight SourceEdits candidate is rejected, not accepted:

- production `8E37F18D2E4F0D2E79666CFC1F572DE598BD1BE50080CFC2529589C867139E79`, 219299 bytes;
- selftest `E0F7A257A158E61D440EC49EC0CF185FEE566B9AD7BA8EA85F995161C1332BAE`, 341593 bytes;
- both NUL-free, CR-free, final LF present; exact dirty status 49.

The correction closed the round-seven valid-deletion/global-order and kernel-state defects. Worker and coordinator
gates passed SourceEdits prior `62/62`, round-two `18/18`, round-three `12/12`, round-four `31/31`, round-five
`95/95`, round-six `97/97`, round-seven `125/125`, audit `10/10`, producer-kernel `63/63`, every coupled focused gate,
typecheck, exact pair ESLint, diff hygiene, byte shape, frozen WorkspaceSource hashes, and exact 49-entry containment.
Those greens are still insufficient.

Fresh zero-write native Luna auditor `01a011f7-206a-70b3-ad17-0824cc581eb0` returned `FINDINGS` without changing any
byte. A file-free producer-shaped public-path deletion proved reparse, exact workspace CAS, and `4/4/0` retained
calls/operations/gaps, but five coherent retained-record mutations still compared equal:

1. property `value.expression` drift;
2. property `path` drift;
3. handler `path` drift;
4. handler `context.reachability` drift; and
5. alias `value.expression` drift.

High acceptance blocker: `structuralCompleteRecordIdentityAfterSplice()` compares only the common identity/order shell
for non-call records. It omits the producer-owned property payload (`path`, `value`, `owner`, `assignment`, `context`),
handler payload (`path`, `value`, `functionSource`, `bodySource`, `parameters`, `context`), and alias payload (`value`,
`aliasKind`, `context`). The Proxy boundary was independently measured at exactly one `getPrototypeOf` trap and zero
getters; no avoidable browser-language alternative was found, so it is recorded but is not this acceptance blocker.
Earlier inline/base64 harness failures were non-evidence and wrote nothing.

## Completed focused unit — Batch 8B round-nine accepted

Exact native `luna_executor` Meitner `01a01212-e38e-7f12-93d7-9536a6bf2bf2` completed a candidate in only:

- `src/lib/x4UiSourceEdits.ts`;
- `src/lib/x4UiSourceEdits.selftest.ts`.

All other files remained frozen during code work. The correction was tests-first against the exact rejected hashes above:

Tests-first evidence is now captured with production still exactly `8E37...39E79`: the separate retained-payload matrix
has 28 named rows, 16 causal reds, and 12 rows already rejected by prior guards. Every row reached `baseline=true`,
`mutationApplied=true`, and `threw=false`; each red was specifically `comparator=true`. All prior SourceEdits matrices
remained green at `34/34`, `1/1`, `62/62`, `18/18`, `12/12`, `31/31`, `95/95`, `97/97`, `125/125`, `10/10`, and
`63/63`. Only the selftest changed before that receipt; there was no blocker.

Interim repair checkpoint: the original matrix is now `28/28` green and the expanded permanent matrix is `43/43`
(property 23, handler 12, alias 8). The first strict normalization exposed 103 round-seven regressions because
source-derived complete-record paths were not remapped at their exact parent field path; schema-path handling was
corrected and SourceEdits now exits 0 with every prior matrix still green. A temporary broad diagnostic hit Windows
exit `0xC0000409`; it was removed, narrower diagnostics were used, and no production debug output remains.

Final candidate production/selftest are
`CA4DFD33245A5EE04451E9038AE97A3A342CA5A8DB1C53E1F5215FFC1AF12BB0` (224786 bytes) /
`D1DB935DFCB43C4DB4FF108950A00A69D043DC5CDEEFEE56479073BD1307FBD9` (356324 bytes). Worker and coordinator both
reproduced the complete SourceEdits matrix, including retained payload `43/43`, plus WorkspaceSource `5/5`,
SourceBundle, EditorSession, CallModel `57/57`, Layout `565/565`, lint `112/112`, Scene `136/136` with configured census
`3/3`, Preview `94/94`, Paint `138/138`, typecheck, exact pair ESLint, diff hygiene, frozen dependency hashes, NUL/CR/LF
shape, exact status 49, and two-file implementation containment. The permanent rows cover producer fields, missing/
extra/wrong/undefined shapes, coherent drift, a second path/name positive, and accessor/prototype/cycle/symbol/
non-enumerable boundaries. Proxy behavior remains fail-closed with one `getPrototypeOf` trap and zero getter reads.

Fresh zero-write native Luna auditor McClintock `01a01240-6c6c-72d0-9a00-ab9723d3f265` returned `CLEAN` and changed no
file. It preserved HEAD/origin parity, exact status 49, digest
`49CD893BB8085161CA5C37BB249C8E273E6B7D9CBC111E731233104C11A212AC`, both accepted SourceEdits hashes, and both
frozen WorkspaceSource hashes. Independent public deletion positives covered two distinct real producer paths and
layouts with exact CAS, byte-local edits, complete reparse, restored provenance, and `4 calls / 4 operations / 0 gaps`.
Its independent retained stream moved `5→4` calls, `5→4` operations, and `22→19` complete records. Hostile retained
payload and boundary matrices passed `47/47` and `12/12`; a hostile Proxy caused exactly one caught `getPrototypeOf`
trap and no other trap or getter. Every focused/coupled gate repeated green. Batch 8B is therefore
`FOCUSED VERIFIED / ACCEPTED`; overall B119 remains `IN_PROGRESS / PARTIAL / Not verified in game`.

Supplemental zero-write auditor Halley `01a01254-6064-72c3-b0ca-05137b761e05` agreed on code review, hashes, inventory,
and focused selftests, but its independent public-apply/hostile harness did not execute because of transport/selector
errors. That is an audit-harness limitation, not a product finding and not contradictory evidence; McClintock supplied
the complete mandatory CLEAN receipt.

## Active unit — Batch 8C manual keep-out calibration

Batch 8B is accepted. Reconciliation for manual keep-out calibration is complete:

- extend the existing `x4UiKeepOuts` → EditorSession → Paint → Canvas chain; do not create a parallel overlay system;
- `calibrateKeepOutPolygon()` and `projectKeepOut()` already exist, and Canvas already draws polygons;
- current blockers are built-in-only admission in EditorSession and built-in-only revalidation in Paint;
- the design record additionally requires retaining exact screenshot drawable bounds with hash/profile and normalized
  user-drawn points;
- then mount the manual polygon controls in the existing `X4UiSourceEditor` keep-out section.

Widget paint, deploy-confirm identity, broad gates, installed-host proof, and three in-game screenshot comparisons remain
later units. Preview remains `Not verified in game`.

Batch 8C.1 has a six-file candidate from native Luna Parfit `01a0127c-145a-70a1-9d2c-7a4cc1fb214c`:

- KeepOuts production/selftest `0325012641209481DFAE32E55933B76F1F163A2FDD2A5538F377623B49723301` /
  `E91CE59288A1EC67B19EDE64BD90FD59F5AC5701EAEDF64BE0612A52CD1D9822`;
- EditorSession production/selftest `379356DC830B1EF1EA46AAAACF4A709A6B5D3024BA5A812471BCA6868B844099` /
  `29563E78EAFE2FA3F5C14C559FF0E5EFF2CE53DB862DE43A727CB64206453D01`;
- PaintPlan production/selftest `26228E25C83023004822C58B02AF7B72D78E003B092739BEB4AE261AEBEBBFD6` /
  `774A7CEF63CE19E75BBC626848A62BEB0429F04C5B01AAD95C4F2FF7FA2E187E`.

The worker recorded causal fail-first `6/6` red and final `6/6` green. The exact pre-production hashes were KeepOuts
`3715EB1380A2913FD41BAE756493DA1B388CB65EF8B7C3A6C199061343860C8F`, EditorSession
`3B76B8962E5423BED24EC6FFE1B3CC7362DEC81F16D1A3857DB3C2D7426E0F9F`, and PaintPlan
`711388F4B66F53DCE31F6E33CFF83B125C967B81822003CAF074447258D964FB`. Those six reds covered only the
`calibrateKeepOutPolygon()` seam; no Session/Paint end-to-end row was captured red before production changed.
Coordinator reproduction passed KeepOuts `17/17`, EditorSession, Paint `143/143`, Preview `94/94`, typecheck, exact
six-file ESLint, and diff hygiene. Canvas is not green:
`65/70`, with five trace/oracle checks cascading from one operation-365 mismatch (`expected setFillStyle #ef4444`,
`actual save`) while the render itself succeeds with exact 73 commands and 403 expected/actual operations. Batch 8C.1
therefore remains `PARTIAL / CANDIDATE`, and Batch 8C.2 React controls are frozen. Zero-write native auditor Lagrange
`01a012fa-45f9-7371-a895-cd84d13ed486` is classifying oracle-versus-product cause and auditing the authority boundary.

Coordinator review has already reproduced two plan-level defects in the candidate. Duplicate manual stable IDs currently
leave the first occurrence successful and paintable; the corrected contract refuses every occurrence and paints none.
Built-ins currently carry the evidence-origin `entry.context`; the corrected contract uses the selected preset as the
application context and proves preset membership, while manual context must exactly equal the issued entry context.
Zero-write audit `01a012fa-45f9-7371-a895-cd84d13ed486` returned `FINDINGS`, with all six hashes exact and status count
52 unchanged. It confirmed both defects, proved the five Canvas reds are a pre-existing stale literal-golden cascade,
and found two additional defects: production Canvas rejects valid manual polygon commands because it permits only
built-in IDs/contexts, and Paint retains a legacy no-entry built-in bypass. Correction is sequential: Session/Paint
authority first; then the Canvas production/selftest pair for calibrated manual command validation and separate
literal-golden maintenance. React controls remain frozen until coupled focused green plus a fresh zero-write CLEAN.

The sequential correction is now focused green and closes all four prior findings, but fresh zero-write auditor Pasteur
`01a01333-16a3-7371-b5bf-3e53046749da` returned `FINDINGS`, zero writes, status count 54 unchanged. Its public hostile
matrix proved 12 safely-known duplicate cases / 26 occurrences all refuse with no authority and reproduced all focused
gates green. It then observed transparent Proxy containers accepted by Session manual calibrations and Paint issued
keep-outs. The strict correction stopped before production: Session `3/6` and Paint `150/152` proved that portable
browser JavaScript cannot unconditionally identify a transparent Proxy while also preserving zero getter reads and
nonblocking malformed peers. Production remains exact. The reconciled tests-first correction now requires detached
one-boundary descriptor snapshots: Session snapshots each candidate before duplicate/calibration work; Paint captures
the exact issued entry/projection identities once and materializes only those captured values. Transparent Proxies are
untrusted data facades, never retained authority; throwing traps refuse, accessors remain uninvoked, and new causal
TOCTOU rows must fail before production and pass after repair. Canvas remains frozen at
`CF7AFAF3...E9A8AC2` / `B45116AB...1C6228F`; React and broad/game work remain locked.

Batch 8C.1 is now `FOCUSED VERIFIED / ACCEPTED`. The detached-snapshot production repair is exact at Session
`20B7429079DA6C7297A505667C07C1FDD015827839BB468C4412402E7E7D5AF0` and Paint
`4F1F783526D201EBAF1CE0156592CF27924EF40B47EE004446880FB62BF870B5`. A tests-only follow-up closed the fresh
audit's sole oracle gap by enforcing exact zero-get trap vectors in every accepted facade/TOCTOU row and proving six-part
oracle sensitivity; final selftests are `49C10D546016338A2E482D26D0B48187B0CD53366A7F9D3EC2F0EF613DC6F518` and
`E221AC858AE9FE47C75EC2844DFB0DBD113AD3A7E4D69F073164DA82CE4A7AC8`. Coordinator gates pass Session `7/7`, Paint
`153/153` with causal `14/14`, CanvasRenderer `75/75`, KeepOuts `17/17`, Preview `94/94`, typecheck, exact lint, and
diff hygiene. Final zero-write Luna `01a013a2-01a8-7f82-ae3e-66c9d2555399` returned `CLEAN`, changed no files, and
preserved the 54-entry status digest `82a0d89d8ba0208e9aa75dadeeb327d4773a79922ace04059e380b72c52d117b`.

Batch 8C.2 React controls are `FINDINGS / correction active`. The rejected focused-green candidate hashes are
`8FF6C50835EE0C6DE1397AA1EDFF1CE480B25B407294BB07A2941DA2EFDC0AA8` and
`2F15ED9B12797581B30E765DDBC474C7D8088ABF08D149349BF10EF14C74D79D`. Fresh zero-write Luna
`01a013de-066a-7172-8006-a450058ce543` reproduced that local enablement is keyed by stable ID: enabling one duplicate
checks both rows, and toggling the sibling clears the first. It also found ambiguous historical fail-first hash labels.
The original exact Luna owner `01a013b5-007b-7da1-ba20-b03b260f5c5e` owns only
`src/components/X4UiSourceEditor.tsx` and `src/components/X4UiSourceEditor.selftest.tsx` for the tests-first correction.
Local explicit enablement must be keyed by immutable `rowId`; only the Session input may derive stable IDs after
duplicate/parse validation; toggles/removals must preserve sibling state; no Lua/workspace bytes may change; and
`Not verified in game` remains permanent. Read-only Luna `01a013ee-8dc8-7292-a1d8-c44281fadb9d` is independently
reconciling the later widget-paint source/asset boundary and may not write.

Batch 8C.2 is now `FOCUSED VERIFIED / ACCEPTED`. The final React production/selftest hashes are
`B085A0A542D6B17E287DE52CB19452D2E75D67ACA15454274D61D20C3E85C3C2` and
`9FF34E6471C045CB4FC7F3A2CEAF94391548967D8E5BFE2F20D8994F79EFE3ED`. Coordinator reproduction and fresh
zero-write Luna `01a013ff-fca7-7c50-bb49-4aba524aee30` passed every component/coupled suite, typecheck, exact lint and
diff hygiene, plus independent valid/duplicate/malformed/edit/toggle/removal probes. The auditor changed no files and
preserved `HEAD=origin/main=77138741a9f470e2c6c37c2d6857688dd1e2b13e`, all supplied hashes, and the exact
56-entry digest `9EC85F3E3CF4B1010D3CAA68FCE0E438A22FC035FDDDC0D3C1DDD47B363DF2BD`. Batch 8C is complete at focused scope;
overall B119 remains `PARTIAL / Not verified in game`.

The widget-paint source reconciliation is complete and read-only. It corrected the first audit's claim that all
`Color[...]` values were unavailable: configured X4 9.00 supplies exact default-theme data in `libraries/colors.xml`
(`6A57FE660D546F5144206581A40194CE13D0D11478B584A46467F0AAE715B883`, 72,950 bytes) and its schema
(`F0D31824E00227EFF6288B084E29346C5AA9D2694BFB0D62D6008EE3DBD879DF`, 7,981 bytes). The graph contains 224
unique base colors and 804 unique one-hop mappings with zero invalid references. Source-literal TOK tables are also
exact source facts. Do not merge alpha domains: XML values are 0-255, while Helper text conversion treats Lua table
alpha as 0-100. Default flat colors are now implementable; current C++ map/profile overrides, daltonization, runtime
widget state, materials, textures, glow, and C++ text metrics remain unavailable. Sequential owners are CallModel,
CorpusAssets, LayoutProgram, Scene, Paint, Canvas, then preview/editor integration.

## Added end-to-end visual fixture

Ken added `C:\Users\Moshi\Desktop\# AI Influence mod UI design\design_handoff_ai_influence` as the required
post-editor dogfood suite. The coordinator read its README and visually inspected `00-brief.png`, the vanilla WebP,
and every `1a`-`1j` PNG. The HTML is reference-only; production must be authored through the completed Forge as real
Helper/widget Lua. Start with recommended `1b`: retain its left state rail, bottom-anchored transcript/choice/input
plates, clear NPC centre, and untouched native-wheel band. Then build the other comm-link, confirmation-gate, and hub
screens. Forge screenshot comparison is layout evidence only; deployed X4 screenshots remain the 1:1 authority.

### Visual-source freeze and `1b` conflict — 2026-08-19

The coordinator re-opened the source pixels, including `1b` and the vanilla reference, and froze all source hashes and
dimensions in the B119 plan. Read-only graph/source reconciliation proved Forge already exposes the exact
cockpit-conversation guides (`y=0.788`, `y=0.740`, `x=0.664`) through KeepOuts -> Session -> Paint -> Canvas. At
`2560x1440`, the supplied `1b` choice plate visibly spans `y=1065.6` and `y=1134.72`, while its input dock crosses
`x=1699.84` at input-bar height. This is a reproduced guide intersection, not proof of the native region's full shape.
Build the literal mock with the preset enabled to retain the conflict evidence, then a minimal clear variant; only the
exact deployed comm-link state can decide whether X4 suppresses or relocates those native elements. Do not silently
shift the mock or claim both pixel identity and keep-out clearance.

## External records

- GitHub owner issue: #41.
- The `1b` guide-intersection checkpoint is synchronized and read back at GitHub #41 comment `5347871212`. Notion
  accepted comment `3c14618e-d15b-815e-968b-001d3fd913c1`; its comments reader remained stale, while the
  schema-confirmed `Reverse Sync Result` property read back the exact projected coordinates and pending gates. Drive
  used required revision
  `AIroW34ec3tH_2d7m2zQDfMCm8rxh5dZp1CK8EbCPjrq4507c_TrVbTtqXFH7G4KeMGSC7OYBgz5ZhE4621LDPzvuG_Yz_MnmpuYTWq8Rnux`
  and returned/read back revision
  `AIroW35HtnX_2zZyHPLJwj9JIih8FTNVwLDSx2NZsJFb-l4bzsQD3tIkHbViIOHKLsZCeNFWPN8t5FDokUpSJvyQjEEcjHvQ3ayDbyb-JXKc`;
  heading range `90605..90667` is exact and the paragraph is `HEADING_2` through `90668`.
- GitHub #41 comment `5325902538` contains the accepted Batch 8C.2 checkpoint, `colors.xml` correction, and AI
  Influence visual fixture; comment-list readback matched the marker.
- Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a` has the same appended checkpoint on readback.
- Drive document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` already contained the equivalent checkpoint when a
  revision-guarded duplicate append correctly refused stale revision
  `AIroW37jpAOMfCUlSFwOXv_uXS1YYM94MujBar8ureU3U5V06iBJpgWyL2cVfNYsUaiQOAonke94ZCJD-LRJsAjmq6AOtu_0NPuAZQGa1F2m`.
  Latest readback revision is
  `AIroW35htNShVtqjBP-APPvLVxqgt9xPZ21vUJirHYM3TWYOyHnh6Uml5EEL8BM9DBiPxZpMPT4ST3YHnO5U8Y72I6Q-k7rTz9SEVThlHGig`;
  no duplicate entry was written.
- P1 final acceptance / P2 start is synchronized and read back at GitHub #41 comment `5333191082`, the same Notion
  page, and the same Drive document. Drive used required revision
  `AIroW35htNShVtqjBP-APPvLVxqgt9xPZ21vUJirHYM3TWYOyHnh6Uml5EEL8BM9DBiPxZpMPT4ST3YHnO5U8Y72I6Q-k7rTz9SEVThlHGig`
  and returned/read back revision
  `AIroW36kbsNOqwpPsO6YTAqqGIUkQIXeOih56K-iaaNEI_1Vd9Jn-vqgTak39AoOfe5MrJnPI8gS_ZJjHu0ycvZWZvs9l_QufySQXDkR0z5K`.
- P2 final acceptance / P3 start is synchronized and read back at GitHub #41 comment `5336353351`, the same Notion
  page, and the same Drive document. Drive used required revision
  `AIroW36kbsNOqwpPsO6YTAqqGIUkQIXeOih56K-iaaNEI_1Vd9Jn-vqgTak39AoOfe5MrJnPI8gS_ZJjHu0ycvZWZvs9l_QufySQXDkR0z5K`
  and returned/read back revision
  `AIroW36RIv2QVsgzStdLH9ZqydKHYVBuImPMIZMzhZmt04L8-d0tfZePQo6qYoYLDjilbuW3inrkGL5hOr-p7jn4ZlYxulyOgoQCFkoNLKbD`.

## First action on resume

P4 Scene issuance and typed colour ownership is `FOCUSED VERIFIED / CLEAN` at production/selftest
`FE85C52848C7643EA6B5195FCA4C4270E7036F763BE756CB48327D599050BF99` /
`34A4D496C968366A18DB6023D2F6BD91F50C2C1A066F6D75BC0944F49FF35C8F`. Fail-first was `136/138`; the first audit
found incomplete provenance/unavailable-owner proof, correction reproduced `137/139`, and final is `139/139` plus
typecheck, exact ESLint, and diff hygiene. Final fresh audit `01a01938-d17c-76a2-9e17-d910b66e9e80` is `CLEAN`.

The canonical pre-colour worktree receipt remains raw `git status --porcelain=v1 -z`: 56 entries, 2,279 bytes, SHA-256
`A644998111590D20DF8AED18DBC79C98F8D78946BED5CA1D8E691EAD861273A2`; refresh it before the next commit boundary.
P5 Paint is `FOCUSED VERIFIED / CLEAN` at `9FDBE5...5A85` / `A0680C...9BF`, final `165/165`, with fresh audit CLEAN.
P6 is `FOCUSED VERIFIED / CLEAN` at `C7B277D7...278B94` / `FC493F3B...9CAE9C`; preserve its honest historical receipt
gap and premature-edit recovery. Implement P7 tests-first only in `src/components/X4UiSourceEditor.tsx/.selftest.tsx`
and `src/lib/x4UiEditorSession.ts/.selftest.ts`. Start from exact frozen hashes in the P7 plan. Reuse the existing core
and colour corpus loaders over the same bounded transport/signal; retain distinct authorities and legacy core-only
custom-loader compatibility; expose separate colour status/failure without erasing usable core geometry; and pass the
exact loader-issued colour authority unchanged through both Session Preview projections. Missing/malformed colour must
degrade to no-colour, never false canonical tint. The first SourceEditor hostile-envelope oracle was contradictory:
portable safe descriptor reflection cannot distinguish a transparent Proxy without invoking traps. Correct the test
only while production stays frozen: require one detached own-data snapshot, zero `get` reads, exact inner identities,
transparent-facade admission, and refusal of accessor/inherited/decorated/clone/reassigned/throwing-reflection forms.
Coordinator reproduction accepted the revised causal receipt: SourceEditor selftest `6213F20B...11D05`, Session
`09C75353...6D86B`, SourceEditor `1/12`, Session `3/7`, aggregate `4/19`; both production hashes, prior matrices,
typecheck, exact lint, and diff hygiene remained exact/green. Production implementation is now authorized only in the
two declared owners. Then run the full focused/coupled matrix and a fresh zero-write audit. Broad host gates, mod writes,
deploy, and X4 remain locked.

P7 now has a coordinator-reproduced focused-green but audit-rejected candidate at SourceEditor `F4CF7F87...9D662` /
`3A90005C...8F5E4` and EditorSession `990B1338...E8213` / `A7FCAAE1...CAC29`. Exact focused counts are SourceEditor
`12/12`, Session baseline/P7 `7/7` + `7/7`, CorpusAssets `39/39`, Preview `102/102`, Paint `165/165`, Canvas `113/113`,
and Scene `139/139`; typecheck, exact lint, and diff hygiene pass. Preserve the two justified fixture-only colspan
corrections and the target+sample-catalog binding key. A fresh zero-write Luna must challenge authority, colour-abort,
sample-drift, and test-strength boundaries before P7 acceptance. The first correction handoff exposed a worker defect:
the Luna owner attempted nested Sol-Luna routing and waited on approval; runtime metadata reproduced it, and an interrupt
returned the patch to the same owner without delegation. Broad host gates, mod writes, deploy, and X4 remain locked.

That fresh zero-write audit is complete: Luna `01a01af6-6d38-7870-ab01-a4b64912ce08` returned `FINDINGS`, changed no
files, preserved all hashes/57 unstaged rows/gates, and found four proof gaps rather than a demonstrated production
defect. Current tests do not causally prove concurrent dual-loader rejection isolation; include no revoked
`Proxy.revocable` case; assert owner presence instead of exact projection/owner/tint counts; and never mount the React
component across delayed Reload, abort/rejection, and cleanup. `graphify` failed before execution with
`Failed to canonicalize script path`; direct source inspection supplied the findings. The immediate bounded unit keeps
both production hashes frozen, strengthens `X4UiSourceEditor.selftest.tsx` and `x4UiEditorSession.selftest.ts`, and adds
one focused `tests/e2e/` Playwright lifecycle spec using the existing Vite host—no DOM dependency or production test
hook. Capture controlled overlap/rejection, revoked-proxy refusal, exact count/mutation sensitivity, and real mounted
late-generation/cleanup behavior. Then rerun focused gates and require a new zero-write `CLEAN` before P7 acceptance.

The tests-first correction is now authored by exact native Luna `01a01b0b-6f60-7c82-93ba-d7282939cab4`. Test hashes
are SourceEditor `59D66E77...F1812`, Session `71356DBE...C8FED`, and corrected real-app Playwright
`136F6136...D831`; production remains byte-frozen at SourceEditor `F4CF7F87...9D662` and EditorSession
`990B1338...E8213`. SourceEditor P7 is `12/12`, Session baseline/P7 is `7/7 + 7/7`, and typecheck, exact three-file
ESLint, and diff hygiene pass. The loader oracle now proves overlap plus rejected-branch isolation; a revoked Proxy is
contained; selected and sampled span-1 paths separately lock exact `1 frame / 1 table / 1 row / 4 cells / 4 widgets /
6 texts / 13 facts / 32 tints` plus complete owner multiplicities and duplicate/drift rejection. The Playwright spec
seeds the real Forge, navigates to `ui-designer`, exercises Reload and the actual status/detail/game-truth DOM, then
unmounts with work pending. Static review found and corrected two test-oracle defects through exact native Luna
`01a01b2b-76a7-7532-9ba5-e09245275442`: colour status/detail were optional, and the first strengthening expected a
marker from an HTTP 503 body that `readStatus()` intentionally does not parse. The final test requires both colour
signals exactly once and visible, then requires exact unavailable status plus the public fixed status-http detail.
It is deliberately unexecuted until the exact machine-state ask. An intermediate typecheck found the installed
Playwright API lacks the attempted `exact` option; final anchored/string assertions typecheck.
After machine confirmation: run only `node scripts/run-e2e.mjs tests/e2e/x4-ui-source-editor.spec.ts`, verify the
ephemeral 3100/3101 stack stops and the live workspace stays untouched, reproduce focused gates/hashes, then dispatch a
fresh zero-write audit. Do not claim P7 accepted before all of those pass.

A newer zero-write audit supersedes that immediate promotion sequence. Luna
`01a01b37-d15d-7cf2-9a16-0be108ffb162` returned `FINDINGS` with zero writes: the green loader row never produces an
actual rejected loader promise because CorpusAssets normalizes transport throws; the Session Paint signature omits
exact command `ownerId`; and the generation-three mounted check cannot observe the cleanup abort before its own route
settlement. All five hashes, `HEAD == origin/main` at `77138741`, 58 porcelain rows, zero staged paths, SourceEditor
`12/12`, Session P7 `7/7`, typecheck, exact lint, and diff hygiene were preserved. Three disjoint native Luna corrections
are active: `01a01b44-847d-7ec1-a810-4519dd068fe1` owns only SourceEditor production/selftest,
`01a01b44-8589-7f02-855f-b31449727aaf` owns only EditorSession selftest, and
`01a01b44-86c4-7dd3-8784-af365ee125f2` owns only the mounted spec. Review those patches, run combined non-Playwright
focused gates, and require a new zero-write audit before attempting the machine-gated mounted run. Do not start broad,
installed, mod, deploy, or X4 gates first.

The first post-correction audit is also `FINDINGS`, not a promotion. Final static candidate hashes before its finding
were SourceEditor `335AB14E...CE57` / `3E8FD64C...4CCD`, frozen Session production `990B1338...E8213`, Session test
`A86B49ED...DD9B`, and mounted spec `E9D745F1...52DB2`. SourceEditor `12/12`, Session `7/7`, typecheck, exact lint,
diff hygiene, the auditor's `Promise.all` mutant, reflection/game truth, and mounted cleanup static review passed.
Auditor `01a01b57-696b-7172-ba36-0f8a82c19204` found that Session test helpers still accepted
`command.nodeId ?? command.id`, allowing deletion of the true `nodeId` plus a forged expected `id`. Same owner
`01a01b44-8589-7f02-855f-b31449727aaf` is correcting only the Session selftest with selected/sampled delete-`nodeId`
mutants and a causal legacy-fallback receipt. After it finishes, rerun the exact five-file static gate and dispatch a
new zero-write audit. Do not run Playwright or broader gates first.

The next fresh auditor `01a01b6a-4ba3-7291-9365-68ab44d3a2db` also returned `FINDINGS` with zero writes. It confirmed
strict `nodeId` extraction, static expected owners, every focused gate, and all non-Session P7 proofs, but found that the
delete-`nodeId` mutation manufactured `command.id` before claiming it was preserved. The Session selftest owner is
correcting that receipt now: preserve the original own `id` exactly, delete only `nodeId`, retain tint data/cardinality/
colour multiplicity, and prove the old fallback without manufacturing evidence. Rerun the combined five-file gate and
one more zero-write audit before any mounted run.

Do not claim game verification before the focused widget batches and machine-state ask. Blank native waits are non-
terminal; do not interrupt or infer failure from elapsed time. Current AAR triggers include the P2 XML/XSD/error-contract
defects, quote-fragile inline probes, the LayoutProgram selftest's roughly 50 MB success output, the hidden child approval
that stalled an OS-temp audit probe before a successful no-temp retry, failing Windows `graphify affected/path` commands
while `graphify explain/query` remained usable, the Scene temporary-fixture prompt conflict, the safely refused stale
Drive revision, and the discarded first XML census that targeted the wrong root.

The first P1 candidate is rejected despite its complete focused green receipt. Fail-first `57/65` became CallModel
`65/65`; LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint, and diff check also pass.
Actual candidate hashes are production `D314F111E95385D57BF039A85C65360000551EB83C2BCA6B53FCA472FB4DB6B0` and selftest
`C7ABAC0785184B533251EFCB3A0635A2B4C7302F994F324FA269404FF7F8E3FA`; the worker report dropped the production
hash's trailing `0`. Coordinator public-model probes against the real menu/hub/comm sources found `15/50/27` TOK uses,
with direct stable `TOK.member` values still `unresolved`; no downstream public channel facts can recover those literals
without reparsing source. Zero-write Luna `01a0162c-5b40-74b2-9ec9-b90b938ecbaf` is auditing the complete candidate.
Do not start P2 or accept the synthetic suite until that audit returns and P1 is corrected.

The audit returned `FINDINGS` with zero writes. It reproduced all three P1 blockers, exact direct-TOK counts
`11/35/20`, the hidden/non-enumerable duplicate authority, and the weakened `validAlias`/serialization assertions.
Positive inline/symbolic/shadow/mutation/source-range behavior remains worth preserving. A direct UTF-16 BOM passed to
CallModel itself is a P2 concern; the existing source-bundle parser sentinel contains the active path, so it is deferred
rather than silently expanding P1. Original Luna `01a01611-35b0-72c3-86ec-b1e730b5a118` has the tests-first correction:
remove all projection-owned hidden color evidence, make `model.colorExpressions` the sole closed serialized authority,
and resolve stable inline/local-alias/`TOK.member`/`TOK["member"]` values with exact use, declaration, and channel facts.
The correction candidate hashes are production
`35A75178A444232D0EB41F0D8A65CDEDFFCC15A224467C35AAB121A2BF19EC6C` and selftest
`6DD840BB51E381EB754AB0440C06DBB4BBC846E632CC20FE55FCEEC752323E4B`. Correction fail-first was `64/68`; coordinator
reproduction is CallModel `68/68`, LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint,
and diff hygiene green. Real-source total/TOK/direct counts are menu `23/15/11`, hub `56/50/35`, and comm `29/27/20`.
Hub resolves `35/35`, comm `20/20`, and menu resolves every declared direct value `9/9`; the remaining two are exact
fail-closed `TOK.header` uses at lines 728 and 731, absent from the `TOK` declaration at lines 211-223. The previous
menu `11/11` requirement was impossible and is superseded by `9/9 declared + 2/2 exact undeclared fail-closed`.
Coordinator authority/provenance probes are green. Fresh zero-write Luna `01a01654-41a8-7db0-8b9f-8bee0a5d4b43`
returned `CLEAN`, changed no files, and preserved both exact hashes. It independently passed CallModel `68/68`,
LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint/diff hygiene, the adjusted
real-source census, closed authority/freeze/JSON/provenance probes, and hostile alias/mutation/Color shadowing cases.
P1 is `FOCUSED VERIFIED / ACCEPTED`; overall B119 remains `PARTIAL / Not verified in game`. P2 configured-corpus color
evidence is now active under the documented non-breaking opt-in boundary. Native Luna
`01a01665-4e66-7712-856a-c4fb35e37b74` owns only `src/lib/x4UiCorpusAssets.ts/.selftest.ts`; starting hashes are
`F08195B48B858F4721A50CA946FA73672F87FD87C923CE5DFBD9D18F32BEC4D2` /
`33D12EF151CDB0163E9AB7CB61E20861C9041733763AF0F994CEB45EE0277F53`, baseline `28/28`. Require causal fail-first,
exact real 224/804 configured-corpus evidence, non-breaking coupled consumers, final hashes/containment, and a fresh
zero-write audit before P3.

## P7 final static checkpoint — 2026-08-19

The Session owner corrected the preservation receipt without touching production. Real selected/sampled paint commands
retain their exact geometry-prefixed original `id`; deleting only `nodeId` preserves that `id`, tint data, cardinality,
and non-owner colour multiplicity, and the legacy fallback is honestly false because real `id !== nodeId`. A separate
static control begins with original `id === nodeId`, deletes only `nodeId`, and proves legacy acceptance plus strict
rejection. Host-native gates pass: SourceEditor `12/12`, EditorSession `7/7`, `npm run typecheck`, exact five-file
ESLint, and exact five-file `git diff --check`. Final hashes:

- SourceEditor production/selftest: `335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57` /
  `3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD`;
- EditorSession production/selftest: `990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213` /
  `751E520F77EA28E1635A3CD87D63BF6ACFB721942FCA3B610E79A4D2F8DFC7AC`;
- mounted spec: `E9D745F18813DFFBFBBC604F67CF603F2B1A0E48BEA635F57DDA1A249BB52DB2`.

Final zero-write Luna `01a01b8a-9132-7a61-92bd-d327e947700b` returned `CLEAN`: exact hashes, HEAD/origin parity,
58 porcelain rows, zero staged paths, focused tests, owner/mutant causality, loader seam, no production `nodeId -> id`
fallback, permanent game-truth boundary, and mounted abort assertions all passed review. P7 is static-clean only.

The previous instruction to start with the machine-state ask is superseded by a reproduced harness-isolation defect.
`playwright.config.ts` redirected state/config/discovery but not `X4_DATA_DIR`; the mounted spec's
`POST /api/agent/workspace` seed writes recovery, action-receipt, and history state through `dataPath()`, which therefore
resolved into this checkout's live `data/` root. Do not run Playwright until the repair below is independently accepted.

Exact native Luna `01a01c17-1ae3-7b43-9721-61dcc0a5054c` captured a causal config-selftest red—
`X4_DATA_DIR must be defined in the API webServer environment`—then changed only `playwright.config.ts` and new
`scripts/e2e-ephemeral-environment.selftest.ts`. The candidate sets `X4_DATA_DIR` to
`path.join(E2E_STATE_DIR, 'data')`; its final hashes are `E53CBC377066A77E30306A3E384598E2064B889F0B2F9A4B1150B5C8E0843A41` /
`DDC899A834FB7E15B20C2FA9503E77D436AC76262D6624805EB8602762A662B5`. Worker and coordinator both pass the
focused selftest, typecheck, exact two-file ESLint, and diff hygiene; Playwright/E2E was not run. Fresh zero-write Luna
`01a01c1e-1cb0-7761-bf22-1dfe8b16c003` returned `CLEAN`, changed no files, preserved both hashes and zero staged paths,
and passed the same four gates. It confirmed the `dataPath()` containment contract and judged an additional explicit
`os.tmpdir()` assertion optional strengthening, not a release gap, because the actual config already constructs that
per-process root.

Ken then supplied the machine gate: Antigravity open, X4 stopped, machine quiet. The exact mounted command ran and
returned authoritative `0 passed / 1 failed / 0 flaky / 1 bad-result`, child exit `1`. The failure at mounted-spec line
281 observed two status fetches under the manual generation-three label but two `AbortSignal` identities. Receipt hash is
`63CA15C9604E684516C756B69C1E5099C045FD54BADB4D84E6C9FE4C57D5EE53` at
`2026-08-19T23:26:16.9958005Z`. Cleanup and isolation passed: `treeGone=true`, no remaining PIDs, all four ports free,
no X4 process, zero staged paths, and exact pre/post parity for `.studio-state`, `config.json`, and full `data/`. The
complete current worktree census is 59 entries / 2,387 bytes /
`E7F3756DF0BD50D7D8CC5A117550604F394EB0647F4BA8E3E1642F8FCC781EDA`.

Luna `01a01c5d-11e9-70c3-b5fa-cbad6bf2b1cc` corrected the mounted oracle without touching production. Current test hash
is `C810FDAA7AF5901F3F057E75794F9058BD22A53EC9950DD1ACD924E2D2E01496`. Its causal ten-second poll retained two live
one-request groups, signal IDs `5` and `6`, and no same-signal pair. Cross-layer reconciliation then found the exact cause
in `src/main.tsx:34-160`: Forge startup captures the init-script observer as `originalFetch`, installs `customFetch`, and
creates a distinct `createAbortDeadline(upstreamSignal, deadlineMs).signal` for every API request before delegating. The
test therefore observes legitimate per-request deadline derivatives, not SourceEditor's shared upstream signal.

The attempted SourceEditor owner-transport repair by Luna `01a01c69-cb53-76b0-bfae-fb794e3518c0` was falsified by an
unchanged mounted red and fully `REVERTED`. Production/selftest are restored exactly to
`335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57` /
`3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD`; SourceEditor is `12/12`, typecheck/ESLint/diff
pass, and no production delta remains. The same mounted-test owner `01a01c5d-11e9-70c3-b5fa-cbad6bf2b1cc` is resumed
for the final test-only correction: require exactly two distinct live deadline-signal IDs before unmount, freeze that
cohort, then require both abort before route settlement. Existing static coverage remains authority for one shared
upstream SourceEditor signal. Require exact mounted green, cleanup/live-root parity, and fresh zero-write audit. Broad,
build/install, AI Influence mod writes, deploy, and X4 remain locked. Overall B119 remains
`PARTIAL / Not verified in game`.

Isolation-checkpoint external readback is complete: GitHub #41 comment `5348802753`; Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a` exact `Reverse Sync Result`; and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW34XpQzBJ5NRIzi9GCDV97S8idXzYqEdJo5jgBbhA6avhPuNrZnFDbj_NfKeK0pP4aXsfotYXFqGjp710FS--upL0orCwd8VErzIcOKS`,
with the new `HEADING_2` at `91675..91747`. Repository Markdown remains authoritative.

AAR delta: the coordinator initially reran focused checks through the sandbox mirror, noticed the project host-truth
violation from the resolved path, discarded that as authority, and repeated hashes/selftests/typecheck/lint/diff checks
host-native. A Google Docs partial-field refresh had an unmatched parenthesis in its field mask and returned HTTP 400;
the no-write failure was replaced by the successful full indexed document read before any external mutation.

External checkpoint synchronization is complete with readback:

- GitHub #41 comment `5347454408` contains the P7 static-clean/mounted-pending checkpoint and was read back exactly.
- Notion accepted comment ID `3c14618e-d15b-814a-9d69-001d190c9b03`; its comments reader continued returning a
  pre-write discussion snapshot, so no duplicate comment was posted. The schema-confirmed text property
  `Reverse Sync Result` was updated instead and read back as
  `P7 static CLEAN at five-file frozen hashes; mounted Playwright, broad/install, AI Influence dogfood, deploy, and X4
  remain pending; Not verified in game`.
- Drive appended the equivalent heading/body under required revision
  `AIroW34pUzWukpvgsk9Qv5OVdfpbAsma3UhA2etwamLgJJfmSdpATPCWOTEmbct9GlBtBWfyiz7Rv96XKCHgK-IVpa4h6lHQBioPXRpYJCaX`.
  Readback revision is
  `AIroW34ec3tH_2d7m2zQDfMCm8rxh5dZp1CK8EbCPjrq4507c_TrVbTtqXFH7G4KeMGSC7OYBgz5ZhE4621LDPzvuG_Yz_MnmpuYTWq8Rnux`;
  the heading is `HEADING_2` at index 89070 and the final authority sentence is present.

Tool AAR: attempting to fetch the returned Notion comment ID as a page correctly returned `object_not_found`; comment
IDs are not page IDs. The durable fallback was a schema-read, minimal property update, and page-property readback.
