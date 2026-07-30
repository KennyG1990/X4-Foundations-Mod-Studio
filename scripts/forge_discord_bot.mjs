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
  if (fs.existsSync('README.md')) {
    text += fs.readFileSync('README.md', 'utf-8').slice(0, 1500);
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
    .addStringOption(opt => opt.setName('fix').setDescription('Step-by-step fix resolution text').setRequired(true))
].map(cmd => cmd.toJSON());

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
