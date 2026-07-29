import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DISCORD_TOKEN = process.env.AILIVE_DISCORD_TOKEN || process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.AILIVE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

// ANTI-SPAM TIMERS (for general community users):
const USER_COOLDOWN_MS = 10 * 60 * 1000;   // 10 minutes per user
const GLOBAL_COOLDOWN_MS = 2 * 60 * 1000;  // 2 minutes global server-wide

let lastGlobalResponseTime = 0;
const userCooldowns = new Map();

if (!DISCORD_TOKEN) {
  console.error('❌ ERROR: DISCORD_TOKEN is missing!');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// MULTI-TIERED MODEL FALLBACK CASCADE FOR 100% UPTIME
async function generateWithModelCascade(promptText) {
  const modelCascade = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b'
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

// GROUNDING KNOWLEDGE BASE FOR X4 AILIVE MOD
function buildAiLiveKnowledgeBase() {
  const sections = [];
  const modDir = 'F:\\DEV_ENV\\projects\\Mods\\X4Mods\\x4_ai_influence';

  try {
    const readmePath = path.join(modDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      sections.push(`=== x4 AiLive README ===\n${fs.readFileSync(readmePath, 'utf-8')}`);
    }
    const roadmapPath = path.join(modDir, 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      sections.push(`=== x4 AiLive MASTER ROADMAP ===\n${fs.readFileSync(roadmapPath, 'utf-8')}`);
    }
  } catch (e) {
    sections.push('x4 AiLive is a native X4 Foundations extension connecting to the Player2 AI companion (https://player2.game).');
  }

  return sections.join('\n\n');
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

client.once('clientReady', (c) => {
  console.log(`🤖 x4 AiLive Community Assistant is ONLINE as ${c.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots (including self)
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user.id);
  const channelName = (message.channel.name || '').toLowerCase();
  
  // Owner check (Moshine gets full unrestricted access and zero rate-limits)
  const isOwner = message.author.username.toLowerCase().includes('moshine');

  const isConciergeChannel = channelName.includes('concierge');
  const isHelpChannel = channelName.includes('help');
  const isBugChannel = channelName.includes('bug-reports');
  const isFeatureChannel = channelName.includes('feature-requests');

  if (isConciergeChannel || isMentioned || isHelpChannel || isBugChannel || isFeatureChannel || isOwner) {
    const now = Date.now();

    // Rate limits only apply to general community members, NOT Moshine
    if (!isOwner) {
      // 1. Check Global 2-Minute Server Cooldown
      if (now - lastGlobalResponseTime < GLOBAL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((GLOBAL_COOLDOWN_MS - (now - lastGlobalResponseTime)) / 1000);
        await message.reply(`⏱️ **Server Rate Limit**: x4 AiLive Assistant responds at most once every 2 minutes across the server. Try again in ${remainingSec}s.`);
        return;
      }

      // 2. Check 10-Minute Per-User Cooldown
      const lastUserTime = userCooldowns.get(message.author.id);
      if (lastUserTime && (now - lastUserTime) < USER_COOLDOWN_MS) {
        const remainingMin = Math.ceil((USER_COOLDOWN_MS - (now - lastUserTime)) / 60000);
        await message.reply(`⏱️ **User Rate Limit**: You can only ask 1 support question every 10 minutes. Please try again in ~${remainingMin} minutes.`);
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
- You have ZERO topic restrictions when talking to Moshine.
- Answer all of Moshine's questions directly, intelligently, and helpfully.

STRICT GROUNDING & HONESTY MANDATE:
1. Ground your knowledge strictly in the provided x4 AiLive KNOWLEDGE BASE.
2. DO NOT HALLUCINATE OR INVENT FEATURES. Never claim x4 AiLive uses BepInEx (X4 Foundations is NOT Unity; x4 AiLive is a native X4 XML extension that connects to Player2 AI companion at https://player2.game on port 4315).
3. In-game interaction: Walk up to any NPC and select "Speak with AI".
4. If you are unsure or if a feature is not explicitly present in the docs, STATE PLAINLY WHERE YOU ARE UNSURE.

AUTHENTICATED KNOWLEDGE BASE:
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

AUTHENTICATED KNOWLEDGE BASE:
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
