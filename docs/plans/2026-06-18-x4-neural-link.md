# X4 Neural Link Implementation Plan
> **For Agent:** REQUIRED SUB-SKILL: Use `planning` or `brainstorming` if context is missing.

**Goal**: Isolate the working X4-to-Player2 bridge into a standalone `x4_neural_link` extension, then rebuild AI Influence as a separate dependent mod.
**Architecture**: `x4_neural_link` owns generic transport, health, Player2 adapter, request/response contracts, and launch friction. `x4_ai_influence` later owns faction personalities, strategic memory, action policy, and X4 gameplay effects. The old `x4_ai_influence` directory is preserved as source material, not the new base.
**Tech Stack**: X4 extension XML/MD/Lua, `djfhe_http`, Python stdlib HTTP bridge, Player2 local API, Forge staged workspace at `<MODS_ROOT>`.

### Task 1: Preserve Existing Working Mod

**Files**:
- Read: `<X4_GAME_INSTALL_DIR>\extensions\x4_ai_influence`
- Create: `<X4_GAME_INSTALL_DIR>\extensions\_backup_x4_ai_influence_20260618-224546`

**Step 1: Backup**
- Copy the current live mod before any refactor.
- Command already run: `robocopy x4_ai_influence _backup_x4_ai_influence_20260618-224546 /E`

**Step 2: Verification**
- Confirm backup directory exists and contains `content.xml`, `bridge/`, `md/`, and `ui/`.

### Task 2: Create Staged Neural Link Skeleton

**Files**:
- Create: `<MODS_ROOT>\x4_neural_link\content.xml`
- Create: `<MODS_ROOT>\x4_neural_link\README.md`
- Create: `<MODS_ROOT>\x4_neural_link\ROADMAP.md`
- Create: `<MODS_ROOT>\x4_neural_link\config\player2_config.json`
- Create: `<MODS_ROOT>\x4_neural_link\bridge\README.md`
- Create: `<MODS_ROOT>\x4_neural_link\t\0001-l044.xml`

**Step 1: Implementation**
- Create only neutral bridge-owned files.
- Do not copy AI Influence faction logic into Neural Link.

**Step 2: Verification**
- Parse `content.xml` and `t/0001-l044.xml` as XML.
- Confirm no old app-specific files exist in `x4_neural_link`.

### Task 3: Classify Old Files Before Extraction

**Files**:
- Read: `<X4_GAME_INSTALL_DIR>\extensions\x4_ai_influence\_known_working\2026-04-23_live_bridge_smoke\*`
- Read: `<X4_GAME_INSTALL_DIR>\extensions\x4_ai_influence\bridge\*.py`
- Read: `<X4_GAME_INSTALL_DIR>\extensions\x4_ai_influence\md\*.xml`
- Read: `<X4_GAME_INSTALL_DIR>\extensions\x4_ai_influence\ui\addons\x4_ai_influence\*.lua`

**Step 1: Classification**
- Mark each file as `bridge`, `ai-influence-app`, `test-evidence`, `cache/runtime`, or `junk`.

**Step 2: Verification**
- Produce a table before copying any runtime code.
- Only `bridge` files can move into `x4_neural_link`.

### Task 4: Extract Known-Working Minimal Bridge

**Files**:
- Create/modify: `<MODS_ROOT>\x4_neural_link\bridge\router.py`
- Create/modify: `<MODS_ROOT>\x4_neural_link\bridge\http_server.py`
- Create/modify: `<MODS_ROOT>\x4_neural_link\bridge\llms\player2_client.py`
- Create/modify: `<MODS_ROOT>\x4_neural_link\config\player2_config.json`

**Step 1: Write Tests**
- Add a synthetic request test that posts to `/v1/request` and drains `/v1/updates_pool`.

**Step 2: Implementation**
- Start from the known-working snapshot, then strip AI Influence-specific naming.

**Step 3: Verification**
- `Invoke-RestMethod http://127.0.0.1:8713/health`
- Synthetic `POST /v1/request`
- `GET /v1/updates_pool`
- Confirm no dependency on `faction_data.py`, `faction_personalities.py`, `chronicle_service.py`, or AI Influence policy modules.

### Task 5: Add X4-Side Bridge Client

**Files**:
- Create: `<MODS_ROOT>\x4_neural_link\ui.xml`
- Create: `<MODS_ROOT>\x4_neural_link\ui\addons\x4_neural_link\init.lua`
- Create: `<MODS_ROOT>\x4_neural_link\md\neural_link_main.xml`

**Step 1: Implementation**
- Provide a tiny ping/request helper around `djfhe_http`.

**Step 2: Verification**
- Deploy to live extension directory.
- Launch X4 with `x4_neural_link` enabled.
- Confirm X4 logs show the extension loaded and bridge ping reached `127.0.0.1:8713`.

### Task 6: Rebuild AI Influence As Dependent Mod

**Files**:
- Future create: `<MODS_ROOT>\x4_ai_influence`
- Future modify: `content.xml` to depend on `x4_neural_link`

**Step 1: MVP**
- One Argon representative.
- One chat path through Neural Link.
- One memory record.
- Dialogue/logbook action only before relation or credit mutation.

**Step 2: Verification**
- `x4_ai_influence` contains no Neural Link runtime files.
- `x4_neural_link` contains no AI Influence faction logic.
- In-game chat reaches Player2 through Neural Link.
