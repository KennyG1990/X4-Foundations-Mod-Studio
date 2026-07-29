import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
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
  let text = '';
  if (fs.existsSync('README.md')) {
    text += fs.readFileSync('README.md', 'utf-8').slice(0, 1500);
  }
  return text || 'X4 Forge is a visual workbench and IDE for X4 Foundations modding (MD XML, Lua UI, XML patching).';
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

client.once('clientReady', (c) => {
  console.log(`🤖 Forge Concierge Support Bot is ONLINE as ${c.user.tag}`);
});

// PATREON TIER COOLDOWN RESTRICTIONS:
// Owner: 0 cooldown, unrestricted
// Patreon ($5/mo): 5 minute cooldown
// Backer ($3/mo): 10 minute cooldown
// Supporter ($1/mo): 30 minute cooldown
// Non-backer: No access
function getPatreonTierInfo(member, isOwner) {
  if (isOwner) return { allowed: true, cooldownMs: 0, tierName: 'Owner' };

  if (!member || !member.roles) {
    return { allowed: false, cooldownMs: 0, tierName: 'None' };
  }

  const roleNames = member.roles.cache.map(r => r.name.toLowerCase());

  if (roleNames.some(name => name.includes('patreon'))) {
    return { allowed: true, cooldownMs: 5 * 60 * 1000, tierName: 'Patreon' };
  }

  if (roleNames.some(name => name.includes('backer'))) {
    return { allowed: true, cooldownMs: 10 * 60 * 1000, tierName: 'Backer' };
  }

  if (roleNames.some(name => name.includes('supporter'))) {
    return { allowed: true, cooldownMs: 30 * 60 * 1000, tierName: 'Supporter' };
  }

  return { allowed: false, cooldownMs: 0, tierName: 'None' };
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

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
