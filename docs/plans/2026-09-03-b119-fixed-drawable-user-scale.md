# B119 — Fixed-Drawable X4 User-Scale Equivalence

Date: 2026-09-03
Lane: FULL
Status: `VERIFIED`

## PLAN

- **Bounded unit:** at the existing X4 windowed drawable, capture the shipped `pipeline_test` UI at the current user
  UI scale, change X4's own Game Settings UI-scale slider by exactly one supported `0.1` step, capture the same UI,
  drive Forge's existing user-scale control to the same two values, compare geometric ratios, then restore X4.
- **Assumptions:** prior receipts report user scale `1.0`, effective Helper scale `1.2527777777777778`, and drawable
  `2544x1353`. X4's current slider value must be observed before mutation; if it differs, that observation supersedes
  the assumption. The configured `pipeline_test` extension auto-opens after UI load and is a disposable UI-only
  fixture, not a production mod.
- **Authority:** X4 9.00 shipped `ui/addons/ego_gameoptions/gameoptions.lua` calls
  `C.GetUIScaleFactorRange()`, reads `C.GetUIScaleFactor()`, uses `0.1` steps, and commits through
  `C.SetUIScaleFactor()`. Forge's installed source editor and the shipped Helper resolution scale remain the preview
  authorities. The running game remains experience truth.
- **In scope:** exact profile backup/hashes; X4 launch and Game Settings interaction; one baseline and one changed-scale
  screenshot of the same fixture at a fixed drawable; current-session failure search; matching Forge profile exports;
  geometry-ratio comparison; restoration and readback.
- **Out of scope:** changing resolution, fullscreen/borderless state, editing the fixture, testing a second menu,
  calibrating keep-outs, changing renderer code, deploying another mod, and publishing OpenVSX.
- **Risks / authorization:** an extreme UI scale could make controls hard to reach; X4 may rewrite profile files and
  normal logs while applying the setting. The user explicitly authorized running X4 and computer use. Only one
  supported `0.1` step is allowed. No terminal UI automation, authentication, security setting, or unrelated app is
  in scope.
- **Rollback/checkpoint:** repository checkpoint
  `0534c3e61f39ad1e29c7711979b6047fc010fbbd` is pushed with local/tracking/direct-remote parity. Exact profile copies
  live at `C:\Users\Moshi\AppData\Local\Temp\x4-b119-ui-scale-baseline-20260903-0545`; baseline `config.xml` is
  `3,939` bytes / `E490A6D12A9677447B1D5B6E42838F5E38F187BADB6DED3145124C00C213C159`, and baseline `uidata.xml` is
  `292,572` bytes / `61A2E66CF35348E569723044295EC5425F52935DEF91BB3B26836F9F7A3F6402`. Restore the original scale through
  X4 first; use the copied profile only if normal restoration fails, with X4 stopped and exact path/hash checks.
- **Acceptance criteria:**
  1. X4 reports/visibly selects the baseline user-scale value and retains the same drawable at both values.
  2. Exactly one `0.1` user-scale step changes the same fixture's frame/control geometry in X4.
  3. Forge at the matching drawable and user-scale values changes the same projected geometry by the same ratio,
     within `1%` ratio error and the brief's few-pixel tolerance on shared measurable edges.
  4. X4 is restored to the original user-scale value and closes cleanly.
  5. The fixture remains `5,488` bytes / `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`;
     no current-session frame/view/Lua failure is present.
- **Required validation:** screenshots from the real X4 window and installed Forge; drawable/border measurement;
  deterministic image-edge measurements; exact fixture hash; current-session log signature census; profile
  restoration readback. Negative path: if slider value, drawable, or exact source/profile identity cannot be proved,
  preserve evidence and leave brief row 3 `PARTIAL`.
- **Evidence:** `dev-docs/b119-x4-ui-pipeline-smoke/user-scale-20260903/`, this task record, `BACKLOG.md`, and
  `SESSION-HANDOFF.md`.

## BASELINE

- X4 executable: `9.0.0.0`, `55,412,768` bytes,
  `19750A6563889A970F434B5566EB396C6B2DC29FF814BD3E336F838176AD6891`.
- `config.xml` records `fullscreen=false` and `borderless=false`; it has no explicit textual UI-scale field at the
  baseline. The storage owner may therefore be C++/profile state rather than a plainly named XML element.
- Installed Forge sidecar PID `47500` listens on `127.0.0.1:52236`. X4 is stopped. `pipeline_test.lua` matches the
  accepted fixture hash above. Unrelated repository changes remain outside this unit.

## RECONCILE

- Existing X4 Game Settings and Forge profile controls are reused. No duplicate scale path or helper script is added.
- Existing game-options code is the exact write semantics; the earlier resolution-derived evidence is insufficient
  because it did not exercise `C.SetUIScaleFactor` at one drawable.
- No capability-map delta. This unit validates an existing B119 control rather than adding capability.

## IMPLEMENT

- No product, test, mod-source, game-source, resolution, or release byte changed. The existing shipped X4 setting,
  installed Forge profile control, and already deployed `pipeline_test` fixture were exercised as-is.
- X4 visibly reported baseline user scale `1.0`. Its inner slider arrow advanced exactly one shipped `0.1` step and
  confirmation retained `1.1`. Forge then rendered/exported the same exact source at user scales `1.0` and `1.1`
  with drawable `2544x1353`; the corresponding effective Helper scales were `1.2527777777777778` and
  `1.3780555555555558`.
- X4 and Forge were both restored to user scale `1.0`. The workspace and deployed copies of `pipeline_test.lua` and
  `content.xml` remain byte-identical at the baseline hashes.

## VALIDATE

- **Real X4 setting:** screenshots prove `1.0`, confirmed `1.1`, and restored `1.0`. Window captures stayed
  `2546x1385`, containing the same `2544x1353` drawable plus window chrome.
- **Forge geometry:** non-black panel bounds changed from `x=940..1602, y=403..605` (`663x203`) to
  `x=907..1635, y=376..597` (`729x222`). Width ratio `1.099547511` differs from the requested `1.1` by `0.041135%`;
  height ratio `1.093596059` differs by `0.582176%`. Both pass the declared `1%` tolerance.
- **X4 geometry:** primary button width changed `659 -> 723` (`1.097116844`), secondary button `654 -> 721`
  (`1.102446483`), and input field `656 -> 723` (`1.102134146`). Their errors versus `1.1` are `0.262105%`,
  `0.222408%`, and `0.194013%`.
- **Forge/X4 equivalence:** the Forge width ratio differs from the three X4 ratios by only `0.221061%`, `0.263651%`,
  and `0.235245%`. After the observed one-pixel side border and 31-pixel title offset, corresponding control edges
  differ by at most four horizontal and three vertical pixels. Criterion 3 passes directly at one fixed drawable.
- **Identity/restoration:** workspace and deployed Lua are both `5,488` bytes / `C1D9CD...718E`; both manifests are
  `367` bytes / `23A7E9...5034`. X4 process count is zero. X4 and Forge visibly read `1.0` after restoration.
- **Runtime negative:** scoped debuglog census is zero for `DisplayView`/view-setup failure, Lua runtime/traceback, and
  owned `pipeline_test` failure signatures. Existing unsigned-mod signature warnings and unrelated AI Influence/missing
  loadout `[=ERROR=]` markers remain baseline noise and are not relabeled.
- **Machine-readable receipt:**
  `dev-docs/b119-x4-ui-pipeline-smoke/user-scale-20260903/fixed-drawable-user-scale-receipt.json` plus eight retained
  PNGs in that directory.

## REVIEW

- Requirement 1, visible setting and fixed drawable: `DONE`.
- Requirement 2, exactly one real X4 `0.1` step changes the fixture: `DONE`.
- Requirement 3, matching Forge ratio within `1%` and shared edges within a few pixels: `DONE`.
- Requirement 4, restored X4 and clean close: `DONE`.
- Requirement 5, exact fixture identity and no owned current-session frame/Lua failure: `DONE`.
- Fresh-eyes limit: this proves the scale-control contract for one exact drawable/source pair. It does not prove all
  widget types, complete three-menu parity, all keep-out contexts, or universal X4 frame acceptance.

## CLOSE

- **Bounded status:** `VERIFIED`. Original brief row 3 advances from `PARTIAL` to `VERIFIED`; the full brief is now
  `4/6 VERIFIED / 2/6 PARTIAL`. Overall B119 remains `IN_PROGRESS / PARTIAL` because rows 2 and 5 are still open.
- **No capability-map delta:** this strengthens the evidence for an existing Source Editor scale control; it adds no
  new product capability.
- **Suggested commit title:** `docs(ui-editor): verify fixed-drawable UI scaling`.

## AAR

- **Sustain:** isolate one factor at a time, retain exact source/profile hashes, compare multiple independent controls,
  and restore both game and editor before close.
- **Improve work/approach:** the first slider click hit the far-right track/glyph and staged `1.8`; the value was not
  confirmed. Using the inner arrow produced the intended single `0.1` step, which was visibly read back before capture.
- **Improve tools:** the installed Forge export handler displayed `exported one image/png` when accessibility invocation
  ran even though no native Save As completion or file existed. Physical activation plus exact file/hash readback was
  required. This is a real false-success product gap and is not treated as successful export evidence by itself.
- **Highest-risk evidenced weakness:** a scale comparison that changes drawable and user scale together cannot identify
  which factor is correct. Fixed-drawable paired captures are now the required pattern.
