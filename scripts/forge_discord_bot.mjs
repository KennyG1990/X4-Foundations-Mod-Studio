import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.AILIVE_GEMINI_API_KEY || '';

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

// DYNAMIC CODEBASE & DOCUMENTATION SCANNER FOR GROUNDING
function buildCodebaseKnowledgeBase() {
  const sections = [];

  // 1. Read Documentation
  if (fs.existsSync('README.md')) {
    sections.push(`=== README.md ===\n${fs.readFileSync('README.md', 'utf-8').slice(0, 3500)}`);
  }
  if (fs.existsSync('ROADMAP.md')) {
    sections.push(`=== ROADMAP.md ===\n${fs.readFileSync('ROADMAP.md', 'utf-8').slice(0, 2500)}`);
  }
  if (fs.existsSync('BACKLOG.md')) {
    sections.push(`=== BACKLOG.md ===\n${fs.readFileSync('BACKLOG.md', 'utf-8').slice(0, 1500)}`);
  }

  // 2. Scan Codebase Files & API Endpoints
  sections.push('=== LIVE CODEBASE ARCHITECTURE & API ROUTES ===');
  
  const targetFiles = [
    'server.ts',
    'src/types.ts',
    'src/lib/modCompiler.ts',
    'src/lib/xmlParser.ts',
    'src/lib/mdSemantics.ts',
    'src/lib/nativeEditor.ts'
  ];

  for (const filePath of targetFiles) {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Extract exported interfaces, functions, and API routes
      const signatures = fileContent
        .split('\n')
        .filter(line => {
          const l = line.trim();
          return l.startsWith('export ') ||
                 l.startsWith('app.get(') ||
                 l.startsWith('app.post(') ||
                 l.startsWith('function ') ||
                 l.startsWith('interface ') ||
                 l.startsWith('type ');
        })
        .slice(0, 45)
        .join('\n');

      sections.push(`--- File: ${filePath} ---\n${signatures}`);
    }
  }

  return sections.join('\n\n');
}

const forgeDocsContext = buildCodebaseKnowledgeBase();

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

client.on('messageCreate', async (message) => {
  // Ignore messages from bots (including self)
  if (message.author.bot) return;

  const isMentioned = message.mentions.has(client.user.id);
  const channelName = (message.channel.name || '').toLowerCase();
  
  // Comprehensive Owner Check (Moshine gets complete exemption on both servers)
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

    // Rate limits and scope gates ONLY apply to general community members, NOT Moshine
    if (!isOwner) {
      // 1. Check Global 2-Minute Server Cooldown
      if (now - lastGlobalResponseTime < GLOBAL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((GLOBAL_COOLDOWN_MS - (now - lastGlobalResponseTime)) / 1000);
        await message.reply(`⏱️ **Server Rate Limit**: Forge Concierge responds at most once every 2 minutes across the server. Try again in ${remainingSec}s.`);
        return;
      }

      // 2. Check 10-Minute Per-User Cooldown
      const lastUserTime = userCooldowns.get(message.author.id);
      if (lastUserTime && (now - lastUserTime) < USER_COOLDOWN_MS) {
        const remainingMin = Math.ceil((USER_COOLDOWN_MS - (now - lastUserTime)) / 60000);
        await message.reply(`⏱️ **User Rate Limit**: You can only ask 1 tech support question every 10 minutes. Please try again in ~${remainingMin} minutes.`);
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
The user chatting with you is Moshine, the creator and maintainer of X4 Forge.
- You have ZERO topic restrictions, zero rate-limits, and zero refusals when talking to Moshine.
- Answer all of Moshine's questions directly, intelligently, and helpfully with full capability.

STRICT GROUNDING & HONESTY MANDATE:
1. Ground your knowledge strictly in the provided CODEBASE & DOCUMENTATION KNOWLEDGE BASE.
2. DO NOT HALLUCINATE OR INVENT FEATURES. Never claim X4 Forge uses BepInEx (it is for native X4 Foundations extensions, MD XML, Lua UI, XPath patches, wares, and jobs).
3. If you are unsure or if a feature/API is not explicitly present in the codebase or docs, STATE PLAINLY WHERE YOU ARE UNSURE rather than making up answers.

AUTHENTICATED KNOWLEDGE BASE (DOCS + CODEBASE EXPORTS):
${forgeDocsContext}`;
      } else {
        systemPrompt = `STRICT MANDATE FOR FORGE CONCIERGE:
You are Forge Concierge, an automated technical support assistant strictly dedicated to X4 Forge (the X4 Foundations modding workbench).

STRICT GROUNDING & HONESTY MANDATE:
1. You are strictly restricted to technical support for X4 Forge, Mission Director (MD) scripts, AI scripts, XML patching, wares, jobs, and studio errors.
2. Ground your knowledge strictly in the provided CODEBASE & DOCUMENTATION KNOWLEDGE BASE. DO NOT INVENT OR HALLUCINATE FEATURES.
3. If you cannot accurately answer a question or are unsure based on the code/docs, STATE PLAINLY WHERE YOU ARE UNSURE.
4. REJECT ALL OFF-TOPIC CONVERSATION (food, weather, jokes, general knowledge unrelated to X4/X4 Forge). If off-topic, reply:
   "I am Forge Concierge, an automated assistant dedicated exclusively to X4 Forge technical support. Please keep questions focused on X4 Forge and modding."

AUTHENTICATED KNOWLEDGE BASE (DOCS + CODEBASE EXPORTS):
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
