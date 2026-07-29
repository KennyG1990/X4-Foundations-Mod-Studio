@echo off
title X4 Forge - Discord Support Bot Daemon
echo Starting Forge Concierge 24/7 Discord Support Bot (Gemini 2.0 Flash)...
cd /d "%~dp0"
node scripts/forge_discord_bot.mjs
pause
