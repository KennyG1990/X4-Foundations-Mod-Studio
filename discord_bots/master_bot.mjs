import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import {
  getUser,
  claimDaily,
  depositBank,
  withdrawBank,
  runMiningExpedition,
  getRandomTriviaQuestion,
  startRPG,
  travelRPG,
  huntRPG,
  getMarketPrices,
  buyMarketWare,
  sellMarketWare,
  attemptXenonVaultHack,
  getLeaderboard,
  ARCHETYPES,
  SHIPS
} from './master_bot_engine.mjs';

dotenv.config({ path: path.resolve('.env.local') });
dotenv.config();

const token = process.env.DISCORD_TOKEN || process.env.AILIVE_DISCORD_TOKEN;

if (!token) {
  console.error('❌ Missing DISCORD_TOKEN / AILIVE_DISCORD_TOKEN environment variable.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// UNIFIED MASTER SLASH COMMAND DEFINITIONS
const commands = [
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
    .setName('market')
    .setDescription('View live Teladi Commodity Exchange market prices'),
  new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Buy or sell Teladi market commodities')
    .addStringOption(opt => opt.setName('action').setDescription('buy or sell').setRequired(true).addChoices({ name: 'buy', value: 'buy' }, { name: 'sell', value: 'sell' }))
    .addStringOption(opt => opt.setName('ware').setDescription('Commodity ware').setRequired(true).addChoices(
      { name: 'Nividium', value: 'nividium' },
      { name: 'Energy Cells', value: 'energy_cells' },
      { name: 'Microchips', value: 'microchips' },
      { name: 'Quantum Tubes', value: 'quantum_tubes' }
    ))
    .addIntegerOption(opt => opt.setName('quantity').setDescription('Units quantity').setRequired(true)),
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
    .setDescription('Engage sector hostiles in retro MUD turn-based space combat'),
  new SlashCommandBuilder()
    .setName('hack')
    .setDescription('Crack an abandoned Xenon Data Vault 4-digit hex code for 1000 Cr')
    .addStringOption(opt => opt.setName('code').setDescription('4-character hex code (e.g. A4F9)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top Net Worth pilots and top Bounty Hunters')
].map(cmd => cmd.toJSON());

client.once('clientReady', async (c) => {
  console.log(`🤖 Unified Master Discord Bot is ONLINE as ${c.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
    console.log('✅ Registered UNIFIED Master Slash Commands successfully!');
  } catch (e) {
    console.error('❌ Failed to register slash commands:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  try {
    if (commandName === 'daily') {
      const res = claimDaily(user.id, user.username);
      if (!res.ok) return interaction.reply({ content: `⏱️ ${res.error}`, flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle('🎁 Daily Reward Claimed!')
        .setColor(5763719)
        .addFields(
          { name: '💰 Reward', value: `+${res.reward} Credits`, inline: true },
          { name: '🔥 Streak', value: `${res.streak} Day(s)`, inline: true },
          { name: '💳 Total Balance', value: `${res.totalCredits} Cr`, inline: true }
        );
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'balance') {
      const u = getUser(user.id, user.username);
      const embed = new EmbedBuilder()
        .setTitle(`💳 ${user.username}'s Wallet & Account Balance`)
        .setColor(3447003)
        .addFields(
          { name: '👛 Wallet Credits', value: `${u.credits} Cr`, inline: true },
          { name: '🏦 Bank Savings', value: `${u.bank} Cr`, inline: true },
          { name: '🔥 Daily Streak', value: `${u.dailyStreak} Days`, inline: true }
        );
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'trivia') {
      const q = getRandomTriviaQuestion();
      const bet = interaction.options.getInteger('bet') || 0;
      const embed = new EmbedBuilder()
        .setTitle(`🛰️ X4 Foundations Lore Trivia`)
        .setColor(15844367)
        .setDescription(`**${q.question}**\n\n` + q.options.map((opt, idx) => `**${idx + 1}.** ${opt}`).join('\n'))
        .setFooter({ text: bet > 0 ? `Wager: ${bet} Cr • Correct Payout: ${bet * 2} Cr` : 'Reward: +75 Cr' });
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'mine') {
      const res = runMiningExpedition(user.id);
      if (!res.ok) return interaction.reply({ content: `⏱️ ${res.error}`, flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle('🚀 Sector Mining Expedition Result')
        .setColor(res.earnedCredits > 0 ? 5763719 : 15548997)
        .setDescription(res.yieldText)
        .addFields({ name: '💳 Wallet Balance', value: `${res.totalCredits} Cr` });
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'bank') {
      const action = interaction.options.getString('action');
      const amount = interaction.options.getInteger('amount');
      const res = action === 'deposit' ? depositBank(user.id, amount) : withdrawBank(user.id, amount);
      if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle(`🏦 Galactic Bank ${action === 'deposit' ? 'Deposit' : 'Withdrawal'}`)
        .setColor(3447003)
        .addFields(
          { name: '👛 Wallet Balance', value: `${res.credits} Cr`, inline: true },
          { name: '🏦 Bank Balance (2% Daily Interest)', value: `${res.bank} Cr`, inline: true }
        );
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'market') {
      const prices = getMarketPrices();
      const embed = new EmbedBuilder()
        .setTitle('📈 Teladi Commodity Exchange Prices')
        .setColor(10181046)
        .addFields(
          { name: '💎 Nividium', value: `${prices.nividium} Cr / unit`, inline: true },
          { name: '⚡ Energy Cells', value: `${prices.energy_cells} Cr / unit`, inline: true },
          { name: '⚙️ Microchips', value: `${prices.microchips} Cr / unit`, inline: true },
          { name: '🧪 Quantum Tubes', value: `${prices.quantum_tubes} Cr / unit`, inline: true }
        )
        .setFooter({ text: 'Prices update every 30 minutes! Use /trade action: buy/sell' });
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'trade') {
      const action = interaction.options.getString('action');
      const ware = interaction.options.getString('ware');
      const qty = interaction.options.getInteger('quantity');
      const res = action === 'buy' ? buyMarketWare(user.id, ware, qty) : sellMarketWare(user.id, ware, qty);
      if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle(`📈 Commodity Trade Execution (${action.toUpperCase()})`)
        .setColor(res.ok ? 5763719 : 15548997)
        .setDescription(`Successfully ${action === 'buy' ? 'purchased' : 'sold'} **${res.qty} units** of **${res.wareId.replace('_', ' ').toUpperCase()}** @ ${res.unitPrice} Cr / unit.`)
        .addFields({ name: '💳 Total Wallet Balance', value: `${res.remainingCredits || res.totalCredits} Cr` });
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'rp-start') {
      const faction = interaction.options.getString('faction');
      const archetype = interaction.options.getString('archetype');
      const res = startRPG(user.id, user.username, faction, archetype);
      if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle(`🚀 Pilot Character Created: ${user.username}`)
        .setColor(5763719)
        .setDescription(`**Faction**: ${faction}\n**Career**: ${ARCHETYPES[archetype]?.name}\n**Starting Ship**: Discoverer S-Class Fighter\n**Location**: Argon Prime`)
        .setFooter({ text: 'Use /rp-nav to travel, /rp-hunt to fight, and /rp-profile for stats!' });
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'rp-profile') {
      const u = getUser(user.id, user.username);
      if (!u.rpg) return interaction.reply({ content: 'No character profile! Run `/rp-start` to create one.', flags: 64 });
      const ship = SHIPS[u.rpg.shipClass] || SHIPS.S;
      const embed = new EmbedBuilder()
        .setTitle(`👨‍✈️ Pilot Profile: ${user.username}`)
        .setColor(3447003)
        .addFields(
          { name: '🏛️ Faction', value: u.rpg.faction, inline: true },
          { name: '🌟 Career Archetype', value: ARCHETYPES[u.rpg.archetype]?.name || u.rpg.archetype, inline: true },
          { name: '🚀 Ship Class', value: ship.name, inline: true },
          { name: '💳 Wallet', value: `${u.credits} Cr`, inline: true },
          { name: '🛡️ Shield / Hull', value: `${u.rpg.shields}/${u.rpg.maxShields} SHD | ${u.rpg.hull}/${u.rpg.maxHull} HUL`, inline: true },
          { name: '📍 Sector', value: u.rpg.currentSector.replace('_', ' ').toUpperCase(), inline: true },
          { name: '⚔️ Kills', value: `${u.rpg.kills} Confirmed Kills`, inline: true }
        );
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'rp-nav') {
      const sector = interaction.options.getString('sector');
      const res = travelRPG(user.id, sector);
      if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      await interaction.reply({ content: `🛰️ **Jumpgate Travel Complete**: Arrived safely in **${sector.replace('_', ' ').toUpperCase()}**!` });

    } else if (commandName === 'rp-hunt') {
      const res = huntRPG(user.id);
      if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
      const embed = new EmbedBuilder()
        .setTitle('⚔️ Sector Space Combat Log')
        .setColor(res.isWin ? 5763719 : 15548997)
        .setDescription(res.text);
      await interaction.reply({ embeds: [embed] });

    } else if (commandName === 'hack') {
      const code = interaction.options.getString('code');
      const res = attemptXenonVaultHack(user.id, code);
      if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });

      if (res.solved && !res.failed) {
        await interaction.reply({ content: `🎉 **CYBER-VAULT CRACKED!** You deciphered code **${res.code}** and extracted **+${res.reward} Cr** from the Xenon Vault!` });
      } else if (res.failed) {
        await interaction.reply({ content: `💥 **SECURITY LOCKDOWN!** Vault key locked out (Code was **${res.code}**). A new Vault encryption key has been generated.` });
      } else {
        await interaction.reply({ content: `🔍 **Hack Attempt (${code.toUpperCase()})**: **${res.correctPos} / 4** characters in exact position. Remaining attempts: **${res.attemptsLeft}**.` });
      }

    } else if (commandName === 'leaderboard') {
      const { topNetWorth, topBounty } = getLeaderboard();
      const embed = new EmbedBuilder()
        .setTitle('🏆 X4 Galactic Leaderboards')
        .setColor(15844367)
        .addFields(
          {
            name: '💰 Top Net Worth Pilots',
            value: topNetWorth.map((u, i) => `**${i + 1}.** ${u.username} — ${u.credits + u.bank} Cr`).join('\n') || 'None recorded yet.',
            inline: false
          },
          {
            name: '⚔️ Top Bounty Hunters (Kills)',
            value: topBounty.map((u, i) => `**${i + 1}.** ${u.username} — ${u.rpg.kills} Kills`).join('\n') || 'None recorded yet.',
            inline: false
          }
        );
      await interaction.reply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('⚠️ Interaction error caught:', err);
  }
});

client.login(token);
