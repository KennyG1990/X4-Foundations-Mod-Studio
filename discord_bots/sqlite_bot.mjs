import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  PermissionFlagsBits
} from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';

import {
  getOrCreateUser,
  claimDailyReward,
  executeBankDeposit,
  executeBankWithdraw,
  executeMiningExpedition,
  createRPGPilot,
  getRPGPilot,
  generateResetCode,
  resetRPGPilot,
  travelRPGSector,
  executeRPGHunt,
  updateMarketPrices,
  buyCommodity,
  sellCommodity,
  executeCodebreakHack,
  queryLeaderboards,
  runAIAgentTurn,
  startResearchProject,
  checkResearchBusy,
  getPendingResearchDMs,
  markResearchDMNotified,
  RESEARCH_TECHS,
  ARCHETYPES,
  SHIPS
} from './sqlite_db.mjs';

import { getRandomTriviaQuestion } from './master_bot_engine.mjs';
import { syncGitHubIssuesToDiscord } from './github_sync.mjs';
import { getSector, SECTOR_GRAPH } from './sector_graph.mjs';
import { generateNPCDialogue, NPC_PROFILES } from './npc_agent_engine.mjs';
import { runEconomicTick, getOpenContracts } from './economy_engine.mjs';

dotenv.config({ path: path.resolve('.env.local') });
dotenv.config();

const tokenForge = process.env.DISCORD_TOKEN;
const tokenAiLive = process.env.AILIVE_DISCORD_TOKEN;

if (!tokenForge && !tokenAiLive) {
  console.error('❌ Missing DISCORD_TOKEN / AILIVE_DISCORD_TOKEN environment variable.');
  process.exit(1);
}

// UNIFIED SLASH COMMAND DEFINITIONS
const commands = [
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim free daily Credits & streak bonus'),
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Inspect wallet Credits, bank savings, and streak'),
  new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Place a credit wager for the upcoming Trivia Tournament session')
    .addIntegerOption(opt => opt.setName('bet').setDescription('Credit wager amount for 2x payouts').setRequired(true)),
  new SlashCommandBuilder()
    .setName('mine')
    .setDescription('Dispatch a virtual ship on a sector mining expedition'),
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
    .setName('contracts')
    .setDescription('Inspect station supply deficit freight and bounty contracts'),
  new SlashCommandBuilder()
    .setName('talk')
    .setDescription('Speak with a localized station NPC character')
    .addStringOption(opt => opt.setName('npc').setDescription('NPC identity').setRequired(true).addChoices(
      { name: 'Nisa t\' Tkr (Teladi Broker @ Grand Exchange)', value: 'nisa_teladi' },
      { name: 'Commander Haddon (Argon Fleet Security @ Argon Prime)', value: 'commander_haddon' },
      { name: 'Supervisor Miller (Ore Processing @ Argon Prime)', value: 'supervisor_miller' },
      { name: 'Chief Vance (Sol-Tech Solar Array @ The Reach)', value: 'engineer_vance' },
      { name: 'Vault Keeper Trim (Nividium Depot @ Grand Exchange)', value: 'vault_keeper_trim' },
      { name: 'Manager Bili (Microchip Fab @ Eighteen Billion)', value: 'manager_bili' },
      { name: 'High Priest Karras (Quantum Complex @ Second Flash)', value: 'high_priest_karras' },
      { name: 'Vond k\' Rnn (Split Mercenary @ Second Flash)', value: 'vond_split' },
      { name: 'Captain Silas (Freeport Syndicate Boss @ Heretic\'s End)', value: 'captain_silas' },
      { name: 'Corrupted Core Alpha (Xenon Vault Entity @ Matrix #451)', value: 'xenon_core_alpha' }
    ))
    .addStringOption(opt => opt.setName('message').setDescription('Your in-character dialogue message').setRequired(true)),
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
    .setDescription('Jump to an adjacent X4 sector node')
    .addStringOption(opt => opt.setName('sector').setDescription('Target sector ID').setRequired(true).addChoices(
      { name: 'Argon Prime (Argon HQ • Safe)', value: 'argon_prime' },
      { name: 'The Reach (Industrial Belt • Patrol)', value: 'the_reach' },
      { name: 'Grand Exchange I (Teladi Trade Hub • Safe)', value: 'grand_exchange_1' },
      { name: 'Eighteen Billion (High-Tech Fab • Safe)', value: 'eighteen_billion' },
      { name: 'Second Flash (Paranid Plant • Patrol)', value: 'second_flash' },
      { name: 'Heretic\'s End (Frontier • Contested)', value: 'heretics_end' },
      { name: 'Matrix #451 (Danger: Xenon Sector)', value: 'matrix_451' }
    )),
  new SlashCommandBuilder()
    .setName('rp-hunt')
    .setDescription('Engage sector hostiles in retro MUD turn-based space combat'),
  new SlashCommandBuilder()
    .setName('research')
    .setDescription('Commit your character to a Tech Research project')
    .addStringOption(opt => opt.setName('tech').setDescription('Technology to research').setRequired(true).addChoices(
      { name: '💥 Heavy Plasma Cannon Array (+35% Laser Dmg) [30m • 500 Cr]', value: 'plasma_array' },
      { name: '⚡ High-Output Shield Matrix (+25% Shield HP) [45m • 750 Cr]', value: 'shield_overclock' },
      { name: '🧪 Quantum Tube Synthesis (+20% Market Profit) [60m • 1200 Cr]', value: 'quantum_synthesis' },
      { name: '🛠️ Nanite Repair Drones (+20 Shield Auto-Heal) [90m • 2000 Cr]', value: 'repair_drones' }
    )),
  new SlashCommandBuilder()
    .setName('hack')
    .setDescription('Crack an abandoned Xenon Data Vault 4-digit hex code for 1000 Cr')
    .addStringOption(opt => opt.setName('code').setDescription('4-character hex code (e.g. A4F9)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top Net Worth pilots and top Bounty Hunters'),
  new SlashCommandBuilder()
    .setName('role')
    .setDescription('Toggle notification roles or check rank badges')
    .addStringOption(opt => opt.setName('type').setDescription('Notification role to toggle').setRequired(true).addChoices(
      { name: 'Trivia Alerts (@Trivia Contender)', value: 'trivia' },
      { name: 'Galaxy Events (@Galaxy Pioneer)', value: 'galaxy' }
    )),
  new SlashCommandBuilder()
    .setName('rp-reset')
    .setDescription('Delete your current pilot character to start fresh')
    .addStringOption(opt => opt.setName('code').setDescription('4-digit confirmation code to confirm character deletion').setRequired(false)),
  new SlashCommandBuilder()
    .setName('ai-turn')
    .setDescription('Trigger a turn for the AI Agent Pilot (Antigravity AI Concierge)')
].map(cmd => cmd.toJSON());

const activeClients = [];
let sessionWagers = {};

// AUTO-CREATE ROLES & ROLE-GATED CHANNELS
async function ensureGuildInfrastructure(guild) {
  let triviaRole = guild.roles.cache.find(r => r.name === 'Trivia Contender');
  if (!triviaRole) {
    try {
      triviaRole = await guild.roles.create({ name: 'Trivia Contender', color: 15844367, mentionable: true });
    } catch (e) {}
  }

  let galaxyRole = guild.roles.cache.find(r => r.name === 'Galaxy Pioneer');
  if (!galaxyRole) {
    try {
      galaxyRole = await guild.roles.create({ name: 'Galaxy Pioneer', color: 3447003, mentionable: true });
    } catch (e) {}
  }

  let triviaChannel = guild.channels.cache.find(c => c.name === 'trivia-arena');
  if (!triviaChannel) {
    try {
      triviaChannel = await guild.channels.create({
        name: 'trivia-arena',
        type: ChannelType.GuildText,
        topic: '🎮 Automated X4 Lore Trivia Arena — Requires @Trivia Contender role to access!',
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: triviaRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });
    } catch (e) {}
  }

  let galaxyChannel = guild.channels.cache.find(c => c.name === 'galaxy-game');
  if (!galaxyChannel) {
    try {
      galaxyChannel = await guild.channels.create({
        name: 'galaxy-game',
        type: ChannelType.GuildText,
        topic: '🌌 Persistent X4 Sector Empire MUD RPG — Shared real-time world across Forge & AiLive servers!',
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: galaxyRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });
    } catch (e) {}
  }

  let welcomeChannel = guild.channels.cache.find(c => c.name === '🚀-welcome' || c.name === 'welcome' || c.name === 'start-here');
  if (welcomeChannel) {
    try {
      const msgs = await welcomeChannel.messages.fetch({ limit: 10 }).catch(() => null);
      const existingIntro = msgs ? msgs.find(m => m.embeds && m.embeds[0]?.title?.includes('WELCOME TO THE X4 COMMUNITY HUB')) : null;

      const introEmbed = new EmbedBuilder()
        .setTitle('🚀 WELCOME TO THE X4 COMMUNITY HUB & SIMULATION')
        .setColor(3447003)
        .setDescription(
          `Welcome to **${guild.name}**! Choose your roles below to unlock exclusive role-gated community features and interactive games:\n\n` +
          '🌐 **SINGLE UNIFIED PERSISTENT UNIVERSE**\n' +
          'The **Galaxy RP Simulation is one single, persistent world shared in real-time between both the X4 Forge Studio and x4 AiLive Discord servers**!\n' +
          'Your pilot character, credits, bank savings, tech research, and market inventory seamlessly follow you across both servers!\n\n' +
          '🏆 **`@Trivia Contender` Role** ➡️ Unlocks **#trivia-arena**\n' +
          '• Automated hourly X4 lore trivia tournaments.\n' +
          '• Place wagers with `/trivia bet: <amount>` for **2x credit payouts**.\n' +
          '• Receive 10-minute betting alerts before each show starts!\n\n' +
          '🌌 **`@Galaxy Pioneer` Role** ➡️ Unlocks **#galaxy-game**\n' +
          '• Access the shared persistent X4 Sector Empire MUD RPG.\n' +
          '• `/rp-start` create character & choose faction alignment.\n' +
          '• Jump sectors with `/rp-nav`, fight Xenon in `/rp-hunt`, talk to NPCs with `/talk`, check `/contracts`, & trade in `/market`!'
        )
        .setFooter({ text: 'Click the buttons below to toggle your roles anytime!' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('toggle_trivia_role').setLabel('🏆 Grab @Trivia Contender Role').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('toggle_galaxy_role').setLabel('🌌 Grab @Galaxy Pioneer Role').setStyle(ButtonStyle.Success)
      );

      if (existingIntro) {
        await existingIntro.edit({ embeds: [introEmbed], components: [row] });
      } else {
        await welcomeChannel.send({ embeds: [introEmbed], components: [row] });
      }
    } catch (e) {}
  }

  return { triviaRole, galaxyRole, triviaChannel, galaxyChannel };
}

// SETUP BOT INSTANCE
async function setupBotInstance(botToken, botName) {
  if (!botToken) return;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ]
  });

  client.once('clientReady', async (c) => {
    console.log(`🤖 ${botName} is ONLINE as ${c.user.tag}`);

    try {
      const rest = new REST({ version: '10' }).setToken(botToken);
      await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
      console.log(`✅ Registered Commands for ${c.user.tag}`);

      for (const guild of client.guilds.cache.values()) {
        await ensureGuildInfrastructure(guild);
      }
    } catch (e) {
      console.error(`❌ Startup error for ${botName}:`, e);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith('toggle_')) {
      const guild = interaction.guild;
      const member = interaction.member;
      const { triviaRole, galaxyRole } = await ensureGuildInfrastructure(guild);

      if (interaction.customId === 'toggle_trivia_role' && triviaRole) {
        if (member.roles.cache.has(triviaRole.id)) {
          await member.roles.remove(triviaRole);
          return interaction.reply({ content: '🔕 Removed **@Trivia Contender** role.', flags: 64 });
        } else {
          await member.roles.add(triviaRole);
          return interaction.reply({ content: '🏆 Granted **@Trivia Contender** role!', flags: 64 });
        }
      }
      if (interaction.customId === 'toggle_galaxy_role' && galaxyRole) {
        if (member.roles.cache.has(galaxyRole.id)) {
          await member.roles.remove(galaxyRole);
          return interaction.reply({ content: '🔕 Removed **@Galaxy Pioneer** role.', flags: 64 });
        } else {
          await member.roles.add(galaxyRole);
          return interaction.reply({ content: '🌌 Granted **@Galaxy Pioneer** role!', flags: 64 });
        }
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, user, guild } = interaction;

    try {
      if (commandName === 'talk') {
        const npcId = interaction.options.getString('npc');
        const msgText = interaction.options.getString('message');
        const pilot = getRPGPilot(user.id);
        const playerProfile = { userId: user.id, username: user.username, faction: pilot?.faction || 'Argon', archetype: pilot?.archetype || 'trader' };

        await interaction.deferReply();
        const dlg = await generateNPCDialogue(npcId, playerProfile, msgText);

        const embed = new EmbedBuilder()
          .setTitle(`💬 Subspace Comms: ${dlg.npcName}`)
          .setColor(3447003)
          .setDescription(dlg.reply)
          .setFooter({ text: `Subspace Comms • Pilot: @${user.username}` });

        // Auto-spawn Discord Thread if in a public channel
        if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
          try {
            const thread = await interaction.channel.threads.create({
              name: `💬 RP: @${user.username} with ${dlg.npcName}`,
              autoArchiveDuration: 60,
              reason: 'Interactive NPC Dialogue Scene'
            });
            await thread.send({ content: `📡 **Subspace Link Established with ${dlg.npcName}** for <@${user.id}>:`, embeds: [embed] });
            await interaction.editReply({ content: `💬 Dialogue opened in dedicated thread: ${thread.url}` });
            return;
          } catch (e) {
            // Fallback to channel reply if thread creation fails
          }
        }

        await interaction.editReply({ embeds: [embed] });

      } else if (commandName === 'contracts') {
        const openContracts = getOpenContracts();
        const embed = new EmbedBuilder()
          .setTitle('📜 Galactic Station Supply Deficit Contracts')
          .setColor(15844367)
          .setDescription(
            openContracts.map((c, i) => `**${i + 1}. [${c.contract_type.toUpperCase()}]** ${c.title}\n💰 Reward: **+${c.reward_credits} Cr** | Target Ware: \`${c.target_ware}\``).join('\n\n') || 'No open station deficit contracts at this moment.'
          )
          .setFooter({ text: 'Contracts update every 30 minutes based on real station supply deficits!' });

        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'rp-nav') {
        const targetSecId = interaction.options.getString('sector');
        const res = travelRPGSector(user.id, targetSecId);
        if (!res.ok) return interaction.reply({ content: res.error, flags: 64 });

        const secNode = res.sectorInfo;
        const embed = new EmbedBuilder()
          .setTitle(`🛰️ Jumpgate Travel Complete: ${secNode.name}`)
          .setColor(secNode.threat.color)
          .setDescription(
            `Arrived safely in **${secNode.name}**!\n\n` +
            `🏛️ **Controlling Faction**: ${secNode.faction}\n` +
            `🛡️ **Threat Level**: ${secNode.threat.name}\n` +
            `📜 **Description**: ${secNode.description}\n\n` +
            `🏢 **Station Facilities**:\n` + secNode.stations.map(s => `• **${s.name}** (\`${s.type}\`)`).join('\n')
          );
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'rp-reset') {
        const inputCode = interaction.options.getString('code');
        const pilot = getRPGPilot(user.id);
        if (!pilot) return interaction.reply({ content: '⛔ You do not have an active pilot character to delete.', flags: 64 });

        if (!inputCode) {
          const code = generateResetCode(user.id);
          const embed = new EmbedBuilder()
            .setTitle('⚠️ CONFIRM CHARACTER DELETION')
            .setColor(15548997)
            .setDescription(
              `Are you sure you want to delete your **${pilot.faction} ${ARCHETYPES[pilot.archetype]?.name || pilot.archetype}** pilot?\n\n` +
              `🚨 **WARNING**: Character deletion is **PERMANENT** and cannot be undone!`
            )
            .addFields(
              { name: '🔑 Your Confirmation Code', value: `\`\`\`${code}\`\`\``, inline: false },
              { name: '📝 How to Confirm', value: `Run \`/rp-reset code: ${code}\` to permanently delete your character and start fresh with \`/rp-start\`.`, inline: false }
            )
            .setFooter({ text: 'This confirmation code expires in 5 minutes.' });
          return interaction.reply({ embeds: [embed], flags: 64 });
        }

        const res = resetRPGPilot(user.id, inputCode);
        if (!res.ok) return interaction.reply({ content: res.error, flags: 64 });

        const embed = new EmbedBuilder()
          .setTitle('🗑️ Pilot Character Wiped')
          .setColor(5763719)
          .setDescription(res.message);
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'rp-start') {
        const faction = interaction.options.getString('faction');
        const archetype = interaction.options.getString('archetype');
        const res = createRPGPilot(user.id, user.username, faction, archetype);
        if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle(`🚀 Pilot Character Created: ${user.username}`)
          .setColor(5763719)
          .setDescription(`**Faction**: ${faction}\n**Career**: ${ARCHETYPES[archetype]?.name}\n**Starting Ship**: Discoverer S-Class Fighter\n**Location**: Argon Prime`)
          .setFooter({ text: 'Use /rp-nav to travel, /rp-hunt to fight, /talk for NPCs, and /rp-profile for stats!' });
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'rp-profile') {
        const pilot = getRPGPilot(user.id);
        if (!pilot) return interaction.reply({ content: 'No character profile! Run `/rp-start` to create one.', flags: 64 });
        const u = getOrCreateUser(user.id, user.username);
        const busyCheck = checkResearchBusy(user.id);
        const ship = SHIPS[pilot.ship_class] || SHIPS.S;
        const sec = getSector(pilot.current_sector);

        const embed = new EmbedBuilder()
          .setTitle(`👨‍✈️ Pilot Profile: ${user.username}`)
          .setColor(sec ? sec.threat.color : 3447003)
          .addFields(
            { name: '🏛️ Faction', value: pilot.faction, inline: true },
            { name: '🌟 Career Archetype', value: ARCHETYPES[pilot.archetype]?.name || pilot.archetype, inline: true },
            { name: '🚀 Ship Class', value: ship.name, inline: true },
            { name: '💳 Wallet', value: `${u.credits} Cr`, inline: true },
            { name: '🛡️ Shield / Hull', value: `${pilot.shields}/${pilot.max_shields} SHD | ${pilot.hull}/${pilot.max_hull} HUL`, inline: true },
            { name: '📍 Sector', value: sec ? `${sec.name} (${sec.threat.name})` : pilot.current_sector, inline: true },
            { name: '🔬 Status', value: busyCheck.busy ? `🔬 Researching **${busyCheck.techName}** (~${busyCheck.minRemaining}m left)` : '🟢 Available', inline: true }
          );
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'rp-hunt') {
        const res = executeRPGHunt(user.id);
        if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle('⚔️ Sector Space Combat Log')
          .setColor(res.isWin ? 5763719 : 15548997)
          .setDescription(res.text);
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'hack') {
        const code = interaction.options.getString('code');
        const res = executeCodebreakHack(user.id, code);
        if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });

        if (res.solved && !res.failed) {
          await interaction.reply({ content: `🎉 **CYBER-VAULT CRACKED!** You deciphered code **${res.code}** and extracted **+${res.reward} Cr** from the Xenon Vault!` });
        } else if (res.failed) {
          await interaction.reply({ content: `💥 **SECURITY LOCKDOWN!** Vault key locked out (Code was **${res.code}**). A new Vault encryption key has been generated.` });
        } else {
          await interaction.reply({ content: `🔍 **Hack Attempt (${code.toUpperCase()})**: **${res.correctPos} / 4** characters in exact position. Remaining attempts: **${res.attemptsLeft}**.` });
        }

      } else if (commandName === 'daily') {
        const res = claimDailyReward(user.id, user.username);
        if (!res.ok) return interaction.reply({ content: `⏱️ ${res.error}`, flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle('🎁 Daily Reward Claimed')
          .setColor(5763719)
          .addFields(
            { name: '💰 Reward', value: `+${res.reward} Credits`, inline: true },
            { name: '🔥 Streak', value: `${res.streak} Day(s)`, inline: true },
            { name: '💳 Total Balance', value: `${res.totalCredits} Cr`, inline: true }
          );
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'balance') {
        const u = getOrCreateUser(user.id, user.username);
        const busyCheck = checkResearchBusy(user.id);
        const embed = new EmbedBuilder()
          .setTitle(`💳 ${user.username}'s Wallet & Account Balance`)
          .setColor(3447003)
          .addFields(
            { name: '👛 Wallet Credits', value: `${u.credits} Cr`, inline: true },
            { name: '🏦 Bank Savings', value: `${u.bank} Cr`, inline: true },
            { name: '🔬 Research Status', value: busyCheck.busy ? `🔬 Researching **${busyCheck.techName}** (~${busyCheck.minRemaining}m left)` : '🟢 Available for Action', inline: false }
          );
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'mine') {
        const res = executeMiningExpedition(user.id);
        if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle('🚀 Sector Mining Expedition Result')
          .setColor(res.earnedCredits > 0 ? 5763719 : 15548997)
          .setDescription(res.yieldText)
          .addFields({ name: '💳 Wallet Balance', value: `${res.totalCredits} Cr` });
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'bank') {
        const action = interaction.options.getString('action');
        const amount = interaction.options.getInteger('amount');
        const res = action === 'deposit' ? executeBankDeposit(user.id, amount) : executeBankWithdraw(user.id, amount);
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
        const prices = updateMarketPrices();
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
        const res = action === 'buy' ? buyCommodity(user.id, ware, qty) : sellCommodity(user.id, ware, qty);
        if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle(`📈 Commodity Trade Execution (${action.toUpperCase()})`)
          .setColor(res.ok ? 5763719 : 15548997)
          .setDescription(`Successfully ${action === 'buy' ? 'purchased' : 'sold'} **${res.qty} units** of **${res.wareId.replace('_', ' ').toUpperCase()}** @ ${res.unitPrice} Cr / unit.`)
          .addFields({ name: '💳 Total Wallet Balance', value: `${res.totalCredits} Cr` });
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'research') {
        const techId = interaction.options.getString('tech');
        const res = startResearchProject(user.id, techId);
        if (!res.ok) return interaction.reply({ content: `⛔ ${res.error}`, flags: 64 });
        const embed = new EmbedBuilder()
          .setTitle('🔬 Research Project Initialized')
          .setColor(3447003)
          .setDescription(`Started research on **${res.tech.name}**!\n⏱️ **Duration**: ${res.durationMin} Minutes\n📜 **Capability**: ${res.tech.desc}`);
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'leaderboard') {
        const { topNetWorth, topBounty } = queryLeaderboards();
        const embed = new EmbedBuilder()
          .setTitle('🏆 X4 Galactic Leaderboards')
          .setColor(15844367)
          .addFields(
            { name: '💰 Top Net Worth Pilots', value: topNetWorth.map((u, i) => `**${i + 1}.** ${u.username} — ${u.net_worth} Cr`).join('\n') || 'None.' },
            { name: '⚔️ Top Bounty Hunters', value: topBounty.map((u, i) => `**${i + 1}.** ${u.username} — ${u.kills} Kills`).join('\n') || 'None.' }
          );
        await interaction.reply({ embeds: [embed] });

      } else if (commandName === 'ai-turn') {
        const res = runAIAgentTurn();
        await interaction.reply({ content: `🤖 **AI Agent Turn Triggered!** ${res.aiName} played a turn:\n${res.huntRes.text}\n**AI Net Worth**: ${res.netWorth} Cr.` });
      }
    } catch (err) {
      console.error('⚠️ Interaction error caught:', err);
    }
  });

  await client.login(botToken);
  activeClients.push(client);
}

async function bootAllBots() {
  if (tokenForge) await setupBotInstance(tokenForge, 'Forge Concierge Bot');
  if (tokenAiLive) await setupBotInstance(tokenAiLive, 'x4 AiLive Assistant Bot');

  setInterval(() => {
    syncGitHubIssuesToDiscord(activeClients).catch(e => console.warn('⚠️ GitHub sync error:', e.message));
  }, 2 * 60 * 1000);

  // Economic tick loop every 30 minutes
  setInterval(() => {
    runEconomicTick();
  }, 30 * 60 * 1000);

  console.log('🌐 North Star Specification Engine (Phases 1-5) ONLINE!');
}

bootAllBots().catch(console.error);
