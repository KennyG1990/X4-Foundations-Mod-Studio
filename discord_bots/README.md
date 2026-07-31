# 🚂 Discord Support & Gamification Bots — Railway Deployment Guide

This directory (`F:\DEV_ENV\projects\discord_bots`) contains the **standalone, private Discord bots & gamification engine** for `Forge Concierge` and `x4 AiLive`.

---

## ☁️ 1-Click Railway Deployment Instructions

1. **GitHub Repository**: Create a private GitHub repo (e.g. `KennyG1990/discord_bots`) and push this `discord_bots` directory:
   ```bash
   cd F:\DEV_ENV\projects\discord_bots
   git init
   git add .
   git commit -m "feat: initial railway discord bot deployment"
   git remote add origin https://github.com/KennyG1990/discord_bots.git
   git push -u origin main
   ```
2. **Railway Project**:
   - Go to [Railway.app](https://railway.app) dashboard.
   - Click **+ New Project** -> **Deploy from GitHub repo**.
   - Select your private `discord_bots` repository.
3. **Environment Variables**:
   In Railway's **Variables** tab, add your environment secrets:
   - `DISCORD_TOKEN`
   - `AILIVE_DISCORD_TOKEN`
   - `GEMINI_API_KEY`
4. **Deploy**:
   Railway will automatically run `nixpacks` and launch both bots 24/7/365 in the cloud!
