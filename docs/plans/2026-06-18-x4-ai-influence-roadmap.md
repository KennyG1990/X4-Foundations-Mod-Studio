# X4 AI Influence Roadmap Implementation Plan
> **For Agent:** REQUIRED SUB-SKILL: Use `planning` or `brainstorming` if context is missing.

**Goal**: Rebuild AI Influence as a Forge-authored gameplay mod that depends on `x4_neural_link` for Player2 communication.
**Architecture**: AI Influence owns faction actors, memory, strategic policy, UI, and safe X4 action execution. Neural Link owns the generic Player2 bridge and must not contain AI Influence gameplay logic. X4 remains authoritative; the LLM can propose only bounded dialogue/actions.
**Tech Stack**: X4 MD/Lua/UI, Forge staged workspace, Neural Link bridge contract, Player2 local API, external JSON/SQLite memory.

### Task 1: Product Roadmap

**Files**:
- Create: `<MODS_ROOT>\x4_ai_influence\ROADMAP.md`
- Create: `<MODS_ROOT>\x4_ai_influence\README.md`

**Step 1: Document Product Boundary**
- State that the old live `x4_ai_influence` folder is reference material only.
- State that new AI Influence depends on `x4_neural_link`.
- Define the hard rule: LLM thinks/speaks, AI Influence validates, X4 acts.

**Step 2: Verification**
- Read the roadmap and confirm it does not assign bridge transport ownership to AI Influence.

### Task 2: MVP Configuration

**Files**:
- Create: `<MODS_ROOT>\x4_ai_influence\config\mod_config.json`
- Create: `<MODS_ROOT>\x4_ai_influence\config\action_whitelist.json`

**Step 1: Implementation**
- Add Administrator Nerra as the first representative.
- Disable relation, credit, and autonomous diplomacy actions by default.
- Enable only dialogue/memory/logbook/status for MVP.

**Step 2: Verification**
- Parse both JSON files.
- Confirm disabled risky actions remain disabled.

### Task 3: Future Manifest

**Files**:
- Future create: `<MODS_ROOT>\x4_ai_influence\content.xml`

**Step 1: Implementation**
- Add hard dependency on `x4_neural_link`.
- Do not include Neural Link bridge runtime files.

**Step 2: Verification**
- XML parses.
- X4 sees dependency in extension list.

### Task 4: First Playable Slice

**Files**:
- Future create: `<MODS_ROOT>\x4_ai_influence\md\ai_influence_main.xml`
- Future create: `<MODS_ROOT>\x4_ai_influence\ui\addons\x4_ai_influence\chat.lua`

**Step 1: Stub UI**
- Open chat with Administrator Nerra.
- Send message.
- Show stub response.

**Step 2: Neural Link Integration**
- Send bounded request to Neural Link.
- Render returned Player2 response.

**Step 3: Verification**
- In-game message reaches Player2 through Neural Link.
- Timeout/offline state produces safe fallback.
- No game-state mutation occurs.

### Task 5: Memory and Safe Actions

**Files**:
- Future create: `<MODS_ROOT>\x4_ai_influence\config\memory_schema.json`
- Future create: `<MODS_ROOT>\x4_ai_influence\config\prompt_templates.json`

**Step 1: Memory MVP**
- Store one summarized interaction.
- Retrieve it on later conversation.

**Step 2: Action MVP**
- Support logbook entry only.
- Keep relation/credit disabled until separately verified.

**Step 3: Verification**
- Close/reopen chat and ask about prior discussion.
- Confirm logbook write only happens after validation.
