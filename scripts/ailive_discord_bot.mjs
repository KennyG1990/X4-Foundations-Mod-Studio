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

client.once('clientReady', (c) => {
  console.log(`🤖 x4 AiLive Community Assistant is ONLINE as ${c.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots (including self)
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
    const now = Date.now();

    // Rate limits only apply to general community members, NOT Moshine
    if (!isOwner) {
      if (now - lastGlobalResponseTime < GLOBAL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((GLOBAL_COOLDOWN_MS - (now - lastGlobalResponseTime)) / 1000);
        await message.reply(`⏱️ **Server Rate Limit**: x4 AiLive Assistant responds at most once every 2 minutes across the server. Try again in ${remainingSec}s.`);
        return;
      }

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
