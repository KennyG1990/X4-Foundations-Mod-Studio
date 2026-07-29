import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!DISCORD_TOKEN) {
  console.error('❌ ERROR: DISCORD_TOKEN is missing from environment or .env.local!');
  process.exit(1);
}

// ANTI-SPAM TIMERS:
const USER_COOLDOWN_MS = 10 * 60 * 1000;   // 10 minutes per user
const GLOBAL_COOLDOWN_MS = 2 * 60 * 1000;  // 2 minutes global server-wide

let lastGlobalResponseTime = 0;
const userCooldowns = new Map();

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not set in .env.local! Get your free key at https://aistudio.google.com/');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Load documentation context for Gemini
let forgeDocsContext = '';
try {
  const readme = fs.readFileSync('README.md', 'utf-8');
  forgeDocsContext = `X4 FORGE DOCUMENTATION SUMMARY:\n${readme.slice(0, 4000)}`;
} catch (e) {
  forgeDocsContext = 'X4 Forge is an open-source visual IDE and extension for modding X4 Foundations.';
}

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
  const isHelpChannel = channelName.includes('help');
  const isBugChannel = channelName.includes('bug-reports');
  const isFeatureChannel = channelName.includes('feature-requests');

  // Process message if mentioned or posted in support channels
  if (isMentioned || isHelpChannel || isBugChannel || isFeatureChannel) {
    const now = Date.now();

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

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      if (isMentioned) {
        await message.reply('⚠️ Please set your `GEMINI_API_KEY` in `.env.local` to enable AI support responses! Get a free key at https://aistudio.google.com/');
      }
      return;
    }

    // Update cooldown timestamps
    lastGlobalResponseTime = now;
    userCooldowns.set(message.author.id, now);

    try {
      await message.channel.sendTyping();

      const systemPrompt = `STRICT MANDATE FOR FORGE CONCIERGE:
You are Forge Concierge, an automated technical support assistant strictly dedicated to X4 Forge (the X4 Foundations modding studio).

STRICT SCOPE BOUNDARIES:
1. You are strictly restricted to answering technical support questions about X4 Forge, X4 Foundations modding, Mission Director (MD) scripts, AI scripts, XML patching, and studio errors.
2. REJECT ALL OFF-TOPIC CONVERSATION, personal questions, casual chat, small talk (e.g. food/dinner, weather, jokes, general knowledge unrelated to X4/X4 Forge).
3. If a user asks anything off-topic, reply strictly with:
   "I am Forge Concierge, an automated assistant dedicated exclusively to X4 Forge technical support, bug reports, and feature requests. Please keep questions focused on X4 Forge and modding."

DOCUMENTATION CONTEXT:
${forgeDocsContext}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question (${message.author.username} in #${channelName}):\n${message.content}` }] }
        ]
      });

      const replyText = response.text || 'I analyzed your request, but could not generate a response.';
      
      // Handle Discord 2000-char limit
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
      if (isMentioned) {
        await message.reply('Sorry, I encountered an issue processing your query with Gemini.');
      }
    }
  }
});

client.login(DISCORD_TOKEN);
