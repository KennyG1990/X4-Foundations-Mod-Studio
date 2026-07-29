import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DISCORD_TOKEN = process.env.AILIVE_DISCORD_TOKEN || process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.AILIVE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// ANTI-SPAM TIMERS (for general community users):
const USER_COOLDOWN_MS = 10 * 60 * 1000;   // 10 minutes per user
const GLOBAL_COOLDOWN_MS = 2 * 60 * 1000;  // 2 minutes global server-wide

let lastGlobalResponseTime = 0;
const userCooldowns = new Map();

if (!DISCORD_TOKEN) {
  console.error('❌ ERROR: DISCORD_TOKEN is missing!');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || '' });

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
  
  // Owner check (Moshine gets full unrestricted access and zero cooldowns)
  const isOwner = message.author.username.toLowerCase().includes('moshine');

  const isConciergeChannel = channelName.includes('concierge');
  const isHelpChannel = channelName.includes('help');
  const isBugChannel = channelName.includes('bug-reports');
  const isFeatureChannel = channelName.includes('feature-requests');
  const isNpcChatter = channelName.includes('npc-chatter');

  if (isConciergeChannel || isMentioned || isHelpChannel || isBugChannel || isFeatureChannel || isNpcChatter || isOwner) {
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
        const remainingMin = Math.ceil((USER_COOLDOWN_MS - (lastUserTime)) / 60000);
        await message.reply(`⏱️ **User Rate Limit**: You can only ask 1 question every 10 minutes. Please try again in ~${remainingMin} minutes.`);
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
- Answer all of Moshine's questions directly, intelligently, and helpfully with full capability.`;
      } else {
        systemPrompt = `SYSTEM MANDATE FOR X4 AILIVE COMMUNITY ASSISTANT:
You are the official AI assistant for x4 AiLive (the LLM-powered dynamic NPC AI & diplomacy mod for X4 Foundations).

MOD OVERVIEW:
x4 AiLive brings reactive LLM NPC dialogue, dynamic faction diplomacy, intelligent order sets, knowledge-gated trade, and espionage arcs to X4 Foundations. It is a native X4 extension installed in X4 Foundations/extensions/.

STRICT SCOPE BOUNDARIES:
1. You answer technical, gameplay, installation (X4 extensions folder), and feature questions about the x4 AiLive mod for X4 Foundations.
2. REJECT ALL OFF-TOPIC CONVERSATION, personal questions, casual chat, small talk.
3. If a user asks anything off-topic, reply strictly with:
   "I am the x4 AiLive Assistant, dedicated exclusively to x4 AiLive gameplay, mod support, bug reports, and feature requests. Please keep questions focused on x4 AiLive and X4 Foundations."`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Message (${message.author.username} in #${channelName}):\n${message.content}` }] }
        ]
      });

      const replyText = response.text || 'I analyzed your request, but could not generate a response.';
      
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
        await message.reply('Sorry, I encountered an issue processing your query with Gemini.');
      }
    }
  }
});

client.login(DISCORD_TOKEN);
