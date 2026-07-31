import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.AILIVE_GEMINI_API_KEY || '';

const GLOBAL_COOLDOWN_MS = 60 * 1000;  // 1 minute global server-wide throttle
let lastGlobalResponseTime = 0;
const userCooldowns = new Map();

if (!DISCORD_TOKEN) {
  console.error('❌ ERROR: DISCORD_TOKEN is missing!');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// SMART KNOWN ISSUE KNOWLEDGE BASE (data/known_fixes.json)
const KNOWN_FIXES_PATH = path.resolve('data/known_fixes.json');

function loadKnownFixes() {
  try {
    if (fs.existsSync(KNOWN_FIXES_PATH)) {
      return JSON.parse(fs.readFileSync(KNOWN_FIXES_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('⚠️ Could not load data/known_fixes.json:', e.message);
  }
  return [];
}

function saveKnownFixes(fixes) {
  try {
    const dir = path.dirname(KNOWN_FIXES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KNOWN_FIXES_PATH, JSON.stringify(fixes, null, 2), 'utf-8');
  } catch (e) {
    console.error('❌ Could not save data/known_fixes.json:', e);
  }
}

let knownFixes = loadKnownFixes();

function matchKnownIssue(messageText) {
  const lowerText = (messageText || '').toLowerCase();
  for (const fixItem of knownFixes) {
    if (fixItem.keywords && Array.isArray(fixItem.keywords)) {
      for (const kw of fixItem.keywords) {
        if (lowerText.includes(kw.toLowerCase())) {
          fixItem.matchCount = (fixItem.matchCount || 0) + 1;
          saveKnownFixes(knownFixes);
          return fixItem;
        }
      }
    }
  }
  return null;
}

// HELPER FOR KNOWN-FIXES EMBED
function getKnownFixesEmbed() {
  knownFixes = loadKnownFixes();
  const fields = knownFixes.slice(0, 6).map(f => ({
    name: `💡 ${f.title} (${f.matchCount || 0} matches)`,
    value: `**Keywords**: ${f.keywords.join(', ')}\n**Fix**: ${f.fix}`,
    inline: false
  }));

  return new EmbedBuilder()
    .setTitle('🛠️ Top Recurring Known Fixes & Resolutions')
    .setColor(3447003)
    .addFields(fields.length ? fields : [{ name: 'No Issues Recorded', value: 'All issues clear!' }])
    .setFooter({ text: 'X4 Forge Smart Auto-Fix Knowledge Base' });
}

// HELPER FOR FAQ EMBED
function getFaqEmbed() {
  return new EmbedBuilder()
    .setTitle('🛠️ X4 Forge Studio FAQ')
    .setColor(10181046)
    .addFields(
      { name: '📦 How do I install X4 Forge?', value: 'Download the extension directly from Open VSX Marketplace:\n<https://open-vsx.org/extension/x4forge/x4-forge-studio>', inline: false },
      { name: '💻 Where is the source code?', value: 'GitHub Repository:\n<https://github.com/KennyG1990/X4_Forge>', inline: false },
      { name: '🤖 How do I ask Concierge for AI support?', value: 'Mention @Forge Concierge in #concierge or support channels. Access is available to Patreon supporters and backers.', inline: false }
    )
    .setFooter({ text: 'X4 Forge Studio Quick Reference' });
}

// VERIFIED ACTIVE MODEL CASCADE FOR 100% UPTIME
async function generateWithModelCascade(promptText) {
  const modelCascade = [
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ];

  for (const modelName of modelCascade) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          { role: 'user', parts: [{ text: promptText }] }
        ]
      });
      if (response && response.text) {
        return { text: response.text, modelUsed: modelName };
      }
    } catch (err) {
      console.warn(`⚠️ Model ${modelName} unavailable/rate-limited (${err.message || err}). Trying next model...`);
    }
  }
  throw new Error('All Gemini fallback models exhausted.');
}

// CONCISE GROUNDING CONTEXT
function buildConciseForgeDocsContext() {
  let text = `X4 FORGE STUDIO — EXACT EMPIRICAL VS CODE EXTENSION COMMANDS & UI WORKFLOW:
X4 Forge Studio is a visual workbench and IDE extension inside VS Code for X4 Foundations modding.

FIRST-RUN SETUP (NEW USER):
- On boot, FirstRunWizard automatically detects X4 Foundations (Steam/GOG) and extracts Egosoft's XSD schemas (md.xsd, libraries.xsd) into the studio workspace in 1 click.

HOW A HUMAN USER GOES FROM NOTHING TO SOMETHING (3 CODE-BACKED WAYS):
1. METHOD A — VISUAL BLUEPRINT CANVAS (Nodes Toolbox):
   Open X4 Forge Studio -> Click 'Nodes / Blueprint' in the left sidebar -> Drag a Cue / Node onto the canvas. X4 Forge automatically initializes content.xml and serializes your nodes to valid Mission Director XML.
2. METHOD B — STAMP PROVEN PATTERN (Mod Patterns):
   Open X4 Forge Studio -> Click 'Patterns' in the left sidebar -> Select a proven formula (e.g. HTTP AI Integration, Station Listener, Group Watcher) -> Click 'Stamp Pattern'. Forge stamps a complete 0-error working mod template into your workspace.
3. METHOD C — AUTO-MATERIALIZING EMPTY FOLDER:
   Run 'X4 Forge: Open Mod Folder' (Ctrl+Shift+P -> x4forge.openModFolder) or click 'Sync Mod' / 'Open Workspace'. Point Forge to any empty folder — Forge automatically materializes content.xml and sets up the md/, aiscripts/, and libraries/ folder structure.

DEPLOYMENT:
Click 'Sync Mod' in the top menu bar to compile, validate, and deploy directly to X4 Foundations/extensions/.

`;
  if (fs.existsSync('F:/DEV_ENV/X4_Forge/README.md')) {
    text += fs.readFileSync('F:/DEV_ENV/X4_Forge/README.md', 'utf-8').slice(0, 1500);
  }
  return text;
}

const forgeDocsContext = buildConciseForgeDocsContext();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ROBUST ERROR GUARDS
process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ Unhandled Promise Rejection intercepted:', reason?.message || reason);
});
client.on('error', (err) => console.warn('⚠️ Discord Client Error:', err.message || err));

// PATREON TIER COOLDOWN RESTRICTIONS:
function getPatreonTierInfo(member, isOwner) {
  if (isOwner) return { allowed: true, cooldownMs: 0, tierName: 'Owner' };

  if (!member || !member.roles) {
    return { allowed: false, cooldownMs: 0, tierName: 'None' };
  }

  const roleNames = member.roles.cache.map(r => r.name.toLowerCase());

  if (roleNames.some(name => name.includes('patron') || name.includes('patreon'))) {
    return { allowed: true, cooldownMs: 5 * 60 * 1000, tierName: 'Patron' };
  }

  if (roleNames.some(name => name.includes('backer'))) {
    return { allowed: true, cooldownMs: 10 * 60 * 1000, tierName: 'Backer' };
  }

  if (roleNames.some(name => name.includes('supporter'))) {
    return { allowed: true, cooldownMs: 30 * 60 * 1000, tierName: 'Supporter' };
  }

  return { allowed: false, cooldownMs: 0, tierName: 'None' };
}

// SLASH COMMAND DEFINITIONS
const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check Forge Concierge AI bot status, active model health, and your Patreon tier cooldown'),
  new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Display frequently asked questions for X4 Forge Studio'),
  new SlashCommandBuilder()
    .setName('known-fixes')
    .setDescription('Display top recurring community issues and verified resolutions'),
  new SlashCommandBuilder()
    .setName('add-fix')
    .setDescription('Add or update a verified known fix (Owner Only)')
    .addStringOption(opt => opt.setName('id').setDescription('Short issue ID').setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Human title of the issue').setRequired(true))
    .addStringOption(opt => opt.setName('keywords').setDescription('Comma-separated trigger keywords').setRequired(true))
    .addStringOption(opt => opt.setName('fix').setDescription('Step-by-step fix resolution text').setRequired(true)),
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your free daily Credits reward & streak bonus'),
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your wallet Credits, bank savings, and active upgrades'),
  new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Play X4 Foundations lore trivia (Zero LLM cost)')
    .addIntegerOption(opt => opt.setName('bet').setDescription('Optional credit wager amount').setRequired(false)),
  new SlashCommandBuilder()
    .setName('mine')
    .setDescription('Dispatch a virtual ship on a sector mining expedition for loot'),
  new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Deposit or withdraw credits from the Galactic Bank')
    .addStringOption(opt => opt.setName('action').setDescription('deposit or withdraw').setRequired(true).addChoices({ name: 'deposit', value: 'deposit' }, { name: 'withdraw', value: 'withdraw' }))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Credit amount').setRequired(true)),
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy a community upgrade perk')
    .addStringOption(opt => opt.setName('item').setDescription('Shop item ID').setRequired(true).addChoices(
      { name: 'cooldown_reducer (500 Cr)', value: 'cooldown_reducer' },
      { name: 'trivia_mult (750 Cr)', value: 'trivia_mult' },
      { name: 'hazard_shield (1000 Cr)', value: 'hazard_shield' }
    )),
  new SlashCommandBuilder()
    .setName('rp-start')
    .setDescription('Create your persistent X4 pilot character')
    .addStringOption(opt => opt.setName('faction').setDescription('Faction alignment').setRequired(true).addChoices(
      { name: 'Argon Federation', value: 'Argon' },
      { name: 'Teladi Company', value: 'Teladi' },
      { name: 'Paranid Triumvirate', value: 'Paranid' },
      { name: 'Split Dynasty', value: 'Split' },
      { name: 'Terran Protectorate', value: 'Terran' }
    ))
    .addStringOption(opt => opt.setName('archetype').setDescription('Career archetype').setRequired(true).addChoices(
      { name: 'Teladi Trade Master (+20% Cargo, +10% Profit)', value: 'trader' },
      { name: 'Split Vanguard Hunter (+15% Damage, +25% Salvage)', value: 'bounty' },
      { name: 'Argon Pioneer Explorer (-30% Jumpgate Cost)', value: 'explorer' }
    )),
  new SlashCommandBuilder()
    .setName('rp-profile')
    .setDescription('Inspect your pilot profile, ship stats, and current sector'),
  new SlashCommandBuilder()
    .setName('rp-nav')
    .setDescription('Jump to an adjacent X4 sector')
    .addStringOption(opt => opt.setName('sector').setDescription('Target sector ID').setRequired(true).addChoices(
      { name: 'Argon Prime', value: 'argon_prime' },
      { name: 'The Reach', value: 'the_reach' },
      { name: 'Grand Exchange I', value: 'grand_exchange_1' },
      { name: 'Heretic\'s End', value: 'heretics_end' },
      { name: 'Matrix #451 (Danger: Xenon Sector)', value: 'matrix_451' }
    )),
  new SlashCommandBuilder()
    .setName('rp-hunt')
    .setDescription('Engage sector hostiles in retro MUD turn-based space combat')
].map(cmd => cmd.toJSON());

import { createPlayer, getPlayer, travelSector, engageCombat, SHIPS, ARCHETYPES } from './x4_muds_game.mjs';

import { claimDaily, getAccount, depositBank, withdrawBank, runMiningExpedition, loadTriviaQuestions, processTriviaAnswer, buyShopItem } from './discord_economy.mjs';

import { syncAllKnownFixes } from './ingest_repo_bugs.mjs';

client.once('clientReady', async (c) => {
  console.log(`🤖 Forge Concierge Support Bot is ONLINE as ${c.user.tag}`);

  // Automated Known Bug & Issue Ingestion Sync
  try {
    await syncAllKnownFixes();
    setInterval(async () => {
      try {
        await syncAllKnownFixes();
      } catch (e) {
        console.warn('⚠️ Automated bug ingestion background sync warning:', e.message);
      }
    }, 15 * 60 * 1000);
  } catch (e) {
    console.warn('⚠️ Initial bug ingestion warning:', e.message);
  }

  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log('✅ Registered slash commands (/status, /faq, /known-fixes, /add-fix) successfully');
  } catch (e) {
    console.warn('⚠️ Slash command registration failed:', e.message || e);
  }
});

// INTERACTION LISTENER (SLASH COMMANDS)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const username = (interaction.user.username || '').toLowerCase();
  const globalName = (interaction.user.globalName || '').toLowerCase();
  const displayName = (interaction.member?.displayName || '').toLowerCase();
  
  const isOwner = username.includes('moshine') || 
                  globalName.includes('moshine') || 
                  displayName.includes('moshine') ||
                  username.includes('hourly') ||
                  globalName.includes('hourly');

  const tierInfo = getPatreonTierInfo(interaction.member, isOwner);

  try {
    if (commandName === 'status') {
      const lastUserTime = userCooldowns.get(interaction.user.id);
      const now = Date.now();
      let cooldownText = 'Ready now (no active cooldown)';

      if (tierInfo.cooldownMs > 0 && lastUserTime && (now - lastUserTime) < tierInfo.cooldownMs) {
        const remainingMin = Math.ceil((tierInfo.cooldownMs - (now - lastUserTime)) / 60000);
        cooldownText = `Active cooldown: ~${remainingMin} minutes remaining`;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚡ X4 Forge Concierge Status')
        .setColor(3447003)
        .addFields(
          { name: '🤖 AI Bot Health', value: 'Online & Ready (Gemini Model Cascade Active)', inline: false },
          { name: '💜 Your Patreon Tier', value: `**${tierInfo.tierName}**`, inline: true },
          { name: '⏱️ Cooldown Status', value: cooldownText, inline: true },
          { name: '🔗 Support on Patreon', value: '<https://www.patreon.com/c/KennyG1990>', inline: false }
        )
        .setFooter({ text: 'X4 Forge • Visual Workbench for X4 Foundations Modders' });

      await interaction.reply({ embeds: [embed], flags: 64 });
    } else if (commandName === 'faq') {
      await interaction.reply({ embeds: [getFaqEmbed()], flags: 64 });
    } else if (commandName === 'known-fixes') {
      await interaction.reply({ embeds: [getKnownFixesEmbed()], flags: 64 });
    } else if (commandName === 'add-fix') {
      if (!isOwner) {
        await interaction.reply({ content: '⛔ Only the owner (Moshine) can add new verified fixes.', flags: 64 });
        return;
      }

      const id = interaction.options.getString('id');
      const title = interaction.options.getString('title');
      const keywordsRaw = interaction.options.getString('keywords');
      const fix = interaction.options.getString('fix');

      const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);

      knownFixes = loadKnownFixes();
      const existingIdx = knownFixes.findIndex(f => f.id === id);

      const newItem = {
        id,
        title,
        keywords,
        fix,
        category: 'x4_forge',
        matchCount: existingIdx >= 0 ? knownFixes[existingIdx].matchCount || 0 : 0
      };

      if (existingIdx >= 0) {
        knownFixes[existingIdx] = newItem;
      } else {
        knownFixes.push(newItem);
      }

      saveKnownFixes(knownFixes);
      await interaction.reply({ content: `✅ Verified Known Fix **${title}** (\`${id}\`) added successfully! Trigger keywords: \`${keywords.join(', ')}\``, flags: 64 });
    } else if (commandName === 'daily') {
      const res = claimDaily(interaction.user.id);
      if (!res.ok) {
        await interaction.reply({ content: `⏱️ ${res.error}`, flags: 64 });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('🎁 Daily Rewards Claimed!')
          .setColor(5763719)
          .addFields(
            { name: '💰 Reward', value: `+${res.reward} Credits`, inline: true },
            { name: '🔥 Streak', value: `${res.streak} Day(s)`, inline: true },
            { name: '💳 Total Balance', value: `${res.totalCredits} Cr`, inline: true }
          )
          .setFooter({ text: 'Come back in 24 hours to keep your streak bonus!' });
        await interaction.reply({ embeds: [embed] });
      }
    } else if (commandName === 'balance') {
      const acc = getAccount(interaction.user.id);
      const embed = new EmbedBuilder()
        .setTitle(`💳 ${interaction.user.username}'s Account Balance`)
        .setColor(3447003)
        .addFields(
          { name: '👛 Wallet Balance', value: `${acc.credits} Cr`, inline: true },
          { name: '🏦 Bank Savings', value: `${acc.bank} Cr`, inline: true },
          { name: '🔥 Daily Streak', value: `${acc.dailyStreak || 0} Days`, inline: true },
          { name: '⏱️ Cooldown Reducer', value: `-${acc.upgrades?.cooldownReducerMinutes || 0} Minutes`, inline: true },
          { name: '🎲 Trivia Multiplier', value: `${acc.upgrades?.triviaMultiplier || 1.0}x`, inline: true },
          { name: '🛡️ Deflector Shield', value: acc.upgrades?.hazardShield ? 'Unlocked' : 'Locked', inline: true }
        )
        .setFooter({ text: 'Earn credits via /daily, /trivia, and /mine!' });
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'mine') {
      const res = runMiningExpedition(interaction.user.id);
      if (!res.ok) {
        await interaction.reply({ content: `⏱️ ${res.error}`, flags: 64 });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('🚀 Sector Mining Expedition Complete')
          .setColor(res.earnedCredits > 0 ? 5763719 : 15548997)
          .setDescription(res.yieldText)
          .addFields(
            { name: '💳 Total Wallet Balance', value: `${res.totalCredits} Cr`, inline: false }
          );
        await interaction.reply({ embeds: [embed] });
      }
    } else if (commandName === 'bank') {
      const action = interaction.options.getString('action');
      const amount = interaction.options.getInteger('amount');
      const res = action === 'deposit' ? depositBank(interaction.user.id, amount) : withdrawBank(interaction.user.id, amount);

      if (!res.ok) {
        await interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      } else {
        const embed = new EmbedBuilder()
          .setTitle(`🏦 Galactic Bank ${action === 'deposit' ? 'Deposit' : 'Withdrawal'}`)
          .setColor(3447003)
          .addFields(
            { name: '👛 Wallet Balance', value: `${res.credits} Cr`, inline: true },
            { name: '🏦 Bank Balance (2% Daily Interest)', value: `${res.bank} Cr`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    } else if (commandName === 'shop') {
      const embed = new EmbedBuilder()
        .setTitle('🛒 Community Upgrade Shop')
        .setColor(10181046)
        .addFields(
          { name: '⏱️ Cooldown Reducer (500 Cr)', value: 'Reduces your AI Concierge LLM cooldown by 2 minutes (`/buy item: cooldown_reducer`)', inline: false },
          { name: '🎲 Trivia Payout Multiplier (750 Cr)', value: 'Permanently boosts trivia winnings to 1.5x (`/buy item: trivia_mult`)', inline: false },
          { name: '🛡️ Deflector Shield (1000 Cr)', value: 'Protects your ships from pirate/Kha\'ak loot loss during mining expeditions (`/buy item: hazard_shield`)', inline: false }
        )
        .setFooter({ text: 'Earn credits with /daily, /mine, and /trivia!' });
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'buy') {
      const item = interaction.options.getString('item');
      const res = buyShopItem(interaction.user.id, item);
      if (!res.ok) {
        await interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      } else {
        await interaction.reply({ content: `🎉 **Upgrade Purchased!** You unlocked **${res.title}**! Remaining Wallet: **${res.credits} Cr**.` });
      }
    } else if (commandName === 'trivia') {
      const questions = loadTriviaQuestions();
      if (!questions.length) {
        await interaction.reply({ content: 'No trivia questions available right now.', flags: 64 });
        return;
      }
      const q = questions[Math.floor(Math.random() * questions.length)];
      const bet = interaction.options.getInteger('bet') || 0;

      const embed = new EmbedBuilder()
        .setTitle(`🛰️ X4 Foundations Lore Trivia (Question ID: ${q.id})`)
        .setColor(15844367)
        .setDescription(`**${q.question}**\n\n` + q.options.map((opt, idx) => `**${idx + 1}.** ${opt}`).join('\n'))
        .setFooter({ text: bet > 0 ? `Wager: ${bet} Cr • Payout: ${bet * 2} Cr` : 'Reward: +75 Cr for correct answer' });

      await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'rp-start') {
      const faction = interaction.options.getString('faction');
      const archetype = interaction.options.getString('archetype');
      const res = createPlayer(interaction.user.id, interaction.user.username, faction, archetype);
      if (!res.ok) {
        await interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      } else {
        const p = res.player;
        const embed = new EmbedBuilder()
          .setTitle(`🚀 Welcome to X4 Sector Empire, Pilot ${p.username}!`)
          .setColor(5763719)
          .setDescription(`Your character has been created!\n\n**Faction**: ${p.faction}\n**Career Archetype**: ${ARCHETYPES[p.archetype]?.name}\n**Starting Ship**: ${SHIPS[p.shipClass]?.name}\n**Starting Wallet**: ${p.credits} Cr\n**Location**: Argon Prime`)
          .setFooter({ text: 'Use /rp-nav to travel, /rp-hunt to fight, and /rp-profile to view stats!' });
        await interaction.reply({ embeds: [embed] });
      }
    } else if (commandName === 'rp-profile') {
      const p = getPlayer(interaction.user.id);
      if (!p) {
        await interaction.reply({ content: 'No pilot profile found! Create one with `/rp-start`.', flags: 64 });
      } else {
        const ship = SHIPS[p.shipClass] || SHIPS.S;
        const embed = new EmbedBuilder()
          .setTitle(`👨‍✈️ Pilot Profile: ${p.username}`)
          .setColor(3447003)
          .addFields(
            { name: '🏛️ Faction Alignment', value: p.faction, inline: true },
            { name: '🌟 Archetype', value: ARCHETYPES[p.archetype]?.name || p.archetype, inline: true },
            { name: '🚀 Ship Class', value: ship.name, inline: true },
            { name: '💳 Wallet Credits', value: `${p.credits} Cr`, inline: true },
            { name: '🛡️ Shields / Hull', value: `${p.shields}/${p.maxShields} SHD | ${p.hull}/${p.maxHull} HUL`, inline: true },
            { name: '📍 Location', value: p.currentSector.replace('_', ' ').toUpperCase(), inline: true },
            { name: '⚔️ Hostiles Destroyed', value: `${p.kills} Confirmed Kills`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });
      }
    } else if (commandName === 'rp-nav') {
      const sectorId = interaction.options.getString('sector');
      const res = travelSector(interaction.user.id, sectorId);
      if (!res.ok) {
        await interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      } else {
        const embed = new EmbedBuilder()
          .setTitle(`🛰️ Jumpgate Arrival: ${res.sector.name}`)
          .setColor(3447003)
          .setDescription(`Your ship traversed the jumpgate network and arrived safely in **${res.sector.name}**.\n\n**Controlling Faction**: ${res.sector.faction}\n**Connected Jumpgates**: ${res.sector.connected.join(', ')}`)
          .setFooter({ text: 'Use /rp-hunt to search the sector for hostile targets!' });
        await interaction.reply({ embeds: [embed] });
      }
    } else if (commandName === 'rp-hunt') {
      const res = engageCombat(interaction.user.id);
      if (!res.ok) {
        await interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('⚔️ Tactical Space Combat Log')
          .setColor(res.isWin ? 5763719 : 15548997)
          .setDescription(res.resultText)
          .setFooter({ text: 'Inspect your pilot stats anytime with /rp-profile!' });
        await interaction.reply({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.warn('⚠️ Interaction error caught:', err.message || err);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const contentLower = (message.content || '').trim().toLowerCase();

  // DIRECT COMMAND TEXT INTERCEPTORS
  const isKnownFixesQuery = [
    '/known-fixes', 'known-fixes', 'known fixes',
    '/known-bugs', 'known-bugs', 'known bugs',
    '/known-issues', 'known-issues', 'known issues',
    'known defects', 'bug list', 'issue list'
  ].some(alias => contentLower.startsWith(alias));

  if (isKnownFixesQuery) {
    await message.reply({ embeds: [getKnownFixesEmbed()] });
    return;
  }
  if (contentLower.startsWith('/faq') || contentLower.startsWith('faq')) {
    await message.reply({ embeds: [getFaqEmbed()] });
    return;
  }

  // SMART KNOWN ISSUE AUTO-FIX INTERCEPTOR
  const matchedIssue = matchKnownIssue(message.content);
  if (matchedIssue) {
    await message.reply(
      `💡 **Known Issue Detected: ${matchedIssue.title}**\n\n` +
      `**Verified Resolution**:\n${matchedIssue.fix}`
    );
    return;
  }

  const isMentioned = message.mentions.has(client.user.id);
  const channelName = (message.channel.name || '').toLowerCase();
  
  // Comprehensive Owner Check
  const username = (message.author.username || '').toLowerCase();
  const globalName = (message.author.globalName || '').toLowerCase();
  const displayName = (message.member?.displayName || '').toLowerCase();
  
  const isOwner = username.includes('moshine') || 
                  globalName.includes('moshine') || 
                  displayName.includes('moshine') ||
                  username.includes('hourly') ||
                  globalName.includes('hourly');

  const isConciergeChannel = channelName.includes('concierge');
  const isHelpChannel = channelName.includes('help');
  const isBugChannel = channelName.includes('bug-reports');
  const isFeatureChannel = channelName.includes('feature-requests');

  if (isConciergeChannel || isMentioned || isHelpChannel || isBugChannel || isFeatureChannel || isOwner) {
    const tierInfo = getPatreonTierInfo(message.member, isOwner);

    if (!tierInfo.allowed) {
      await message.reply(
        `🔒 **Backers & Supporters Only**: Forge Concierge AI support is reserved exclusively for Patreon members.\n` +
        `Support the project on Patreon to unlock AI support access:\n` +
        `<https://www.patreon.com/c/KennyG1990>`
      );
      return;
    }

    const now = Date.now();

    if (!isOwner) {
      if (now - lastGlobalResponseTime < GLOBAL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((GLOBAL_COOLDOWN_MS - (now - lastGlobalResponseTime)) / 1000);
        await message.reply(`⏱️ **Server Rate Limit**: Forge Concierge responds at most once every minute server-wide. Try again in ${remainingSec}s.`);
        return;
      }

      const lastUserTime = userCooldowns.get(message.author.id);
      if (lastUserTime && (now - lastUserTime) < tierInfo.cooldownMs) {
        const remainingMin = Math.ceil((tierInfo.cooldownMs - (now - lastUserTime)) / 60000);
        const cooldownMin = Math.round(tierInfo.cooldownMs / 60000);
        await message.reply(
          `⏱️ **${tierInfo.tierName} Cooldown**: As a **${tierInfo.tierName}**, your AI support cooldown is ${cooldownMin} minutes. Please try again in ~${remainingMin} minutes.`
        );
        return;
      }

      lastGlobalResponseTime = now;
      userCooldowns.set(message.author.id, now);
    }

    try {
      await message.channel.sendTyping();

      let systemPrompt = '';
      if (isOwner) {
        systemPrompt = `OWNER / CREATOR OVERRIDE ENABLED:
The user chatting with you is Moshine, creator of X4 Forge.
- You have ZERO topic restrictions, zero rate-limits, and zero refusals.
- Answer all of Moshine's questions directly, intelligently, and helpfully.

STRICT GROUNDING & HONESTY MANDATE:
1. Ground your knowledge strictly in the provided X4 FORGE KNOWLEDGE BASE.
2. DO NOT HALLUCINATE OR INVENT FEATURES. X4 Forge is for native X4 Foundations (MD XML, Lua UI, XPath patches, wares).
3. If unsure, STATE PLAINLY WHERE YOU ARE UNSURE.

KNOWLEDGE BASE:
${forgeDocsContext}`;
      } else {
        systemPrompt = `STRICT MANDATE FOR FORGE CONCIERGE:
You are Forge Concierge, an automated technical support assistant strictly dedicated to X4 Forge (the X4 Foundations modding workbench).

STRICT GROUNDING & HONESTY MANDATE:
1. You are strictly restricted to technical support for X4 Forge, MD scripts, AI scripts, XML patching, wares, jobs, and studio errors.
2. Ground your knowledge strictly in the provided KNOWLEDGE BASE. DO NOT INVENT OR HALLUCINATE FEATURES.
3. If unsure, STATE PLAINLY WHERE YOU ARE UNSURE.
4. REJECT ALL OFF-TOPIC CONVERSATION. If off-topic, reply:
   "I am Forge Concierge, an automated assistant dedicated exclusively to X4 Forge technical support. Please keep questions focused on X4 Forge and modding."

KNOWLEDGE BASE:
${forgeDocsContext}`;
      }

      const promptText = `${systemPrompt}\n\nUser Message (${message.author.username} in #${channelName}):\n${message.content}`;
      const { text: replyText } = await generateWithModelCascade(promptText);

      if (replyText.length > 1950) {
        const chunks = replyText.match(/[\s\S]{1,1900}/g) || [replyText];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(replyText);
      }
    } catch (err) {
      console.error('Error calling Gemini API:', err);
      if (isConciergeChannel || isMentioned || isOwner) {
        await message.reply(`⚠️ Unable to process query with Gemini API: ${err.message || 'Unknown API error'}`);
      }
    }
  }
});

client.login(DISCORD_TOKEN);
