# X4 Forge & x4 AiLive — Discord Economy, Trivia & Persistent MUD RPG Guide

This document records the **Zero-LLM Discord Gamification, Trivia, and Persistent MUD RPG Subsystem** operating across both Discord servers (`Forge Concierge#3242` and `X4AILive#2651`).

---

## ⛔ Operator Protocol Rule
> **SESSION-HANDOFF.md Rule**: This feature documentation lives exclusively in `docs/DISCORD_BOTS_AND_GAMES.md` to keep `SESSION-HANDOFF.md` 100% pristine for Codex agent release validation.

---

## 🎮 Subsystem 1: Zero-LLM Discord Economy & Trivia

All economy, trivia, daily rewards, and shop mechanics operate locally with **$0 API cost** and instant responses.

### Commands:
- `/daily`: Claim free daily Credits (`+100 Cr`) with streak multipliers (`Day 7 = 500 Cr`).
- `/balance`: View wallet credits, bank savings, streak, and active upgrades.
- `/trivia [bet: N]`: Play X4 lore trivia. Optional credit wagers pay out **2x** for correct answers.
- `/mine`: Dispatch a virtual ship on a sector mining expedition for loot and rare wares.
- `/bank [action: deposit/withdraw] [amount: N]`: Save credits and earn **2% daily interest**.
- `/shop` / `/buy [item]`: Purchase **Concierge Cooldown Reducers**, **Trivia Multipliers**, and **Expedition Deflector Shields**.

---

## 🌌 Subsystem 2: X4 Sector Empire (Persistent Text-Based MUD RPG)

Inspired by classic 90s/2000s BBS door games (*TradeWars 2015*, *Solar Realms Elite*, *Legend of the Red Dragon*), set in the X4 Foundations universe!

### Core Commands:
- `/rp-start [faction] [archetype]`: Create your persistent pilot profile.
  - **Factions**: Argon, Teladi, Paranid, Split, Terran.
  - **Archetypes**:
    - *Teladi Trade Master* (+20% Cargo Hold, +10% Profit)
    - *Split Vanguard Hunter* (+15% Damage, +25% Combat Salvage)
    - *Argon Pioneer Explorer* (-30% Jumpgate Fuel Cost)
- `/rp-profile`: Inspect your ship class, shield/hull integrity, credit balance, and confirmed kills.
- `/rp-nav [sector]`: Jump through connected gates (*Argon Prime*, *The Reach*, *Grand Exchange I*, *Heretic's End*, *Matrix #451*).
- `/rp-hunt`: Engage sector hostiles (Xenon drone wings, Pirate Marauders) in retro turn-based space combat with ASCII terminal logs and credit salvage.

---

## 🛠️ Code Structure
- **Engine Logic**: [`scripts/discord_economy.mjs`](file:///F:/DEV_ENV/X4_Forge/scripts/discord_economy.mjs) & [`scripts/x4_muds_game.mjs`](file:///F:/DEV_ENV/X4_Forge/scripts/x4_muds_game.mjs).
- **Persistent Databases**: `data/discord_economy.json`, `data/trivia_questions.json`, `data/x4_rpg_database.json`.
- **Discord Bot Handlers**: [`scripts/forge_discord_bot.mjs`](file:///F:/DEV_ENV/X4_Forge/scripts/forge_discord_bot.mjs) & [`scripts/ailive_discord_bot.mjs`](file:///F:/DEV_ENV/X4_Forge/scripts/ailive_discord_bot.mjs).
