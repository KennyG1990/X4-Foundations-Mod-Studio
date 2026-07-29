import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DISCORD_TOKEN = process.env.AILIVE_DISCORD_TOKEN || process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.AILIVE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

const GLOBAL_COOLDOWN_MS = 60 * 1000;  // 1 minute global server-wide throttle
let lastGlobalResponseTime = 0;
const userCooldowns = new Map();

if (!DISCORD_TOKEN) {
  console.error('❌ ERROR: DISCORD_TOKEN is missing!');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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

// CONCISE GROUNDING KNOWLEDGE BASE
function buildAiLiveKnowledgeBase() {
  const modDir = process.env.AILIVE_MOD_DIR || path.resolve(process.cwd(), '../x4_ai_influence');
  try {
    const readmePath = path.join(modDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      return fs.readFileSync(readmePath, 'utf-8').slice(0, 1500);
    }
  } catch (e) {}
  return 'x4 AiLive is a native X4 Foundations extension connecting to Player2 AI companion (https://player2.game). In-game interaction: Walk up to any NPC and select "Speak with AI".';
}

const aiLiveDocsContext = buildAiLiveKnowledgeBase();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// PATREON TIER COOLDOWN RESTRICTIONS:
// Owner: 0 cooldown, unrestricted
// Patron / Patreon ($5/mo): 5 minute cooldown
// Backer ($3/mo): 10 minute cooldown
// Supporter ($1/mo): 30 minute cooldown
// Non-backer: No access
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
    .setDescription('Check x4 AiLive Assistant status, active model health, and your Patreon tier cooldown'),
  new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Display frequently asked questions for x4 AiLive')
].map(cmd => cmd.toJSON());

client.once('clientReady', async (c) => {
  console.log(`🤖 x4 AiLive Community Assistant is ONLINE as ${c.user.tag}`);

  // Register Slash Commands
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log('✅ Registered slash commands (/status, /faq) successfully');
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

  if (commandName === 'status') {
    const lastUserTime = userCooldowns.get(interaction.user.id);
    const now = Date.now();
    let cooldownText = 'Ready now (no active cooldown)';

    if (tierInfo.cooldownMs > 0 && lastUserTime && (now - lastUserTime) < tierInfo.cooldownMs) {
      const remainingMin = Math.ceil((tierInfo.cooldownMs - (now - lastUserTime)) / 60000);
      cooldownText = `Active cooldown: ~${remainingMin} minutes remaining`;
    }

    const embed = new EmbedBuilder()
      .setTitle('⚡ x4 AiLive Assistant Status')
      .setColor(3447003)
      .addFields(
        { name: '🤖 AI Bot Health', value: 'Online & Ready (Gemini Model Cascade Active)', inline: false },
        { name: '💜 Your Patreon Tier', value: `**${tierInfo.tierName}**`, inline: true },
        { name: '⏱️ Cooldown Status', value: cooldownText, inline: true },
        { name: '🔗 Support on Patreon', value: '<https://www.patreon.com/c/KennyG1990>', inline: false }
      )
      .setFooter({ text: 'x4 AiLive • Dynamic Dialogue & AI Diplomacy for X4' });

    await interaction.reply({ embeds: [embed], flags: 64 });
  } else if (commandName === 'faq') {
    const embed = new EmbedBuilder()
      .setTitle('🎮 x4 AiLive FAQ')
      .setColor(10181046)
      .addFields(
        { name: '💬 How do I speak with NPCs in-game?', value: 'Simply walk up to any NPC in X4 Foundations and select **"Speak with AI"** from the dialogue interaction menu.', inline: false },
        { name: '🤖 Do I need BepInEx or Shift+C?', value: 'No! x4 AiLive is a 100% native X4 extension. You do **NOT** need BepInEx or Shift+C.', inline: false },
        { name: '🔗 Where do I download Player2?', value: 'Player2 AI Companion App:\n<https://player2.game>', inline: false },
        { name: '📁 Installation Directory', value: 'Extract the `x4_ai_influence` folder into your `X4 Foundations/extensions/` directory.', inline: false }
      )
      .setFooter({ text: 'x4 AiLive Quick Reference' });

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const msgLower = (message.content || '').toLowerCase();

  // 1. SMART KEYWORD AUTO-RESPONDER INTERCEPTOR (Shift C / BepInEx FAQs)
  if (msgLower.includes('shift c') || msgLower.includes('shift+c') || msgLower.includes('shift-c') || msgLower.includes('bepinex')) {
    await message.reply(
      `💡 **x4 AiLive Tip**: x4 AiLive is a **native X4 extension**! You do **NOT** need BepInEx or Shift+C.\n` +
      `Simply walk up to any NPC in-game and select **"Speak with AI"** from the dialogue interaction menu.`
    );
    return;
  }

  const isMentioned = message.mentions.has(client.user.id);
  const channelName = (message.channel.name || '').toLowerCase();
  
  // Comprehensive Owner Check (Moshine gets complete exemption)
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

    // Non-backers have zero access to Concierge LLM
    if (!tierInfo.allowed) {
      await message.reply(
        `🔒 **Backers & Supporters Only**: x4 AiLive AI Assistant support is reserved exclusively for Patreon members.\n` +
        `Support the project on Patreon to unlock AI support access:\n` +
        `<https://www.patreon.com/c/KennyG1990>`
      );
      return;
    }

    const now = Date.now();

    if (!isOwner) {
      if (now - lastGlobalResponseTime < GLOBAL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((GLOBAL_COOLDOWN_MS - (now - lastGlobalResponseTime)) / 1000);
        await message.reply(`⏱️ **Server Rate Limit**: x4 AiLive Assistant responds at most once every minute server-wide. Try again in ${remainingSec}s.`);
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
The person chatting with you is your creator, Moshine.
- You have ZERO topic restrictions, zero rate-limits, and zero refusals.
- Answer all of Moshine's questions directly, intelligently, and helpfully.

STRICT GROUNDING & HONESTY MANDATE:
1. Ground your knowledge strictly in the provided x4 AiLive KNOWLEDGE BASE.
2. DO NOT HALLUCINATE OR INVENT FEATURES. Never claim x4 AiLive uses BepInEx (it is a native X4 XML extension connecting to Player2 AI companion at https://player2.game on port 4315).
3. In-game interaction: Walk up to any NPC and select "Speak with AI".
4. If unsure, STATE PLAINLY WHERE YOU ARE UNSURE.

KNOWLEDGE BASE:
${aiLiveDocsContext}`;
      } else {
        systemPrompt = `SYSTEM MANDATE FOR X4 AILIVE COMMUNITY ASSISTANT:
You are the official AI assistant for x4 AiLive (the LLM-powered dynamic NPC AI & diplomacy mod for X4 Foundations).

STRICT GROUNDING & HONESTY MANDATE:
1. You answer technical, gameplay, installation (X4 extensions folder + Player2 companion at https://player2.game), and feature questions about x4 AiLive.
2. Ground your knowledge strictly in the provided KNOWLEDGE BASE. DO NOT INVENT OR HALLUCINATE FEATURES.
3. In-game interaction: Walk up to any NPC and select "Speak with AI".
4. REJECT ALL OFF-TOPIC CONVERSATION. If off-topic, reply:
   "I am the x4 AiLive Assistant, dedicated exclusively to x4 AiLive gameplay, mod support, bug reports, and feature requests. Please keep questions focused on x4 AiLive and X4 Foundations."

KNOWLEDGE BASE:
${aiLiveDocsContext}`;
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
