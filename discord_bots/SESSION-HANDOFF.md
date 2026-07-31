# SESSION HANDOFF: Discord Space MUD & GitHub Sync System

---

## 1. Project Overview & Active Engine State
- **Project**: X4 Discord Space MUD (`F:\DEV_ENV\projects\discord_bots`)
- **Status**: **VERIFIED** — Production Upgrades, Extended NPC Roster, & `/rp-reset` Confirmation Flow ONLINE.
- **Bot Engine**: Dual-client process `sqlite_bot.mjs` running `Forge Concierge#3242` and `X4AILive#2651` in background task `task-3468`.

---

## 2. Key Architecture & Modules
- **`/rp-reset` Confirmation Flow**: Two-step character deletion. Running `/rp-reset` generates a 5-minute 4-digit code (`code`). Player confirms with `/rp-reset code: <code>` to permanently wipe character and start fresh with `/rp-start`.
- [npc_agent_engine.mjs](file:///F:/DEV_ENV/projects/discord_bots/npc_agent_engine.mjs): Complete 10-NPC roster covering all sector station facilities with Gemini AI prompt constraints & episodic memory recall.
- [sqlite_db.mjs](file:///F:/DEV_ENV/projects/discord_bots/sqlite_db.mjs): SQLite persistence engine with `npc_memories` table, `player_faction_standing` matrix (-100 to +100), wallet, bank, research locks, and `resetRPGPilot` deletion logic.
- [sector_graph.mjs](file:///F:/DEV_ENV/projects/discord_bots/sector_graph.mjs): Sector graph nodes (`Argon Prime`, `The Reach`, `Grand Exchange I`, `Eighteen Billion`, `Second Flash`, `Heretic's End`, `Matrix #451`), connected jumpgates, threat levels, and station services.
- [tactical_combat_engine.mjs](file:///F:/DEV_ENV/projects/discord_bots/tactical_combat_engine.mjs): 3 range bands (Long, Medium, Close) and targetable subsystems (`engines`, `shields`, `weapons`, `hull`).
- [economy_engine.mjs](file:///F:/DEV_ENV/projects/discord_bots/economy_engine.mjs): Dynamic economic production ticks & automated station deficit contract board (`/contracts`).
- [sqlite_bot.mjs](file:///F:/DEV_ENV/projects/discord_bots/sqlite_bot.mjs): Dual Discord client integration with Discord Thread auto-spawning for `/talk` and `/rp-hunt`.

---

## 3. Verification Test Suite Commands
- Character Reset Test Suite: `node test_rp_reset.mjs` (PASSED)
- Production Upgrades Test Suite: `node test_production_upgrades.mjs` (PASSED)
- Master Verification Test Suite: `node test_northstar_suite.mjs` (All 5 phases PASSED)
