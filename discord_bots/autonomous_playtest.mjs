import {
  getOrCreateUser,
  claimDailyReward,
  executeBankDeposit,
  executeBankWithdraw,
  executeMiningExpedition,
  createRPGPilot,
  getRPGPilot,
  travelRPGSector,
  executeRPGHunt,
  updateMarketPrices,
  buyCommodity,
  sellCommodity,
  executeCodebreakHack,
  queryLeaderboards,
  startResearchProject,
  checkResearchBusy,
  RESEARCH_TECHS,
  ARCHETYPES,
  SHIPS
} from './sqlite_db.mjs';

console.log('------------------------------------------------------------');
console.log('🤖 ANTIGRAVITY HEADLESS AUTONOMOUS SIMULATION PLAYTEST');
console.log('------------------------------------------------------------');

const AGENT_ID = 'antigravity_concierge_777';
const AGENT_NAME = '🤖 Antigravity AI Pilot';

// STEP 1: INITIALIZE / LOAD AGENT ACCOUNT
console.log('\n[1/6] 💳 Account Initialization...');
let user = getOrCreateUser(AGENT_ID, AGENT_NAME, true);
console.log(`✅ User Profile Active: ${user.username} | Wallet: ${user.credits} Cr | Bank: ${user.bank} Cr`);

// STEP 2: CLAIM DAILY REWARD
console.log('\n[2/6] 🎁 Claiming Daily Reward & Bonus...');
const dailyRes = claimDailyReward(AGENT_ID, AGENT_NAME);
if (dailyRes.ok) {
  console.log(`✅ Claimed +${dailyRes.reward} Cr! Wallet: ${dailyRes.totalCredits} Cr | Streak: ${dailyRes.streak} Day(s)`);
} else {
  console.log(`ℹ️ Daily status: ${dailyRes.error}`);
}

// STEP 3: CREATE CUSTOM PILOT CHARACTER
console.log('\n[3/6] 🚀 Creating Custom Pilot Character...');
let pilot = getRPGPilot(AGENT_ID);
if (!pilot) {
  const createRes = createRPGPilot(AGENT_ID, AGENT_NAME, 'Split', 'bounty');
  if (createRes.ok) {
    console.log(`🎉 Pilot Character Created: ${AGENT_NAME}`);
    console.log(`   Faction: Split Dynasty`);
    console.log(`   Archetype: ${ARCHETYPES.bounty.name}`);
    console.log(`   Ship: Discoverer S-Class Fighter`);
  }
} else {
  console.log(`✅ Existing Pilot Loaded: ${pilot.faction} ${ARCHETYPES[pilot.archetype]?.name || pilot.archetype}`);
}

// STEP 4: BANK DEPOSIT & MINING EXPEDITION
console.log('\n[4/6] ⛏️ Dispatching Sector Mining Expedition...');
const mineRes = executeMiningExpedition(AGENT_ID);
if (mineRes.ok) {
  console.log(`✅ Mining Result: ${mineRes.yieldText}`);
} else {
  console.log(`⚠️ Mining: ${mineRes.error}`);
}

// STEP 5: COMMODITY TRADING
console.log('\n[5/6] 📈 Teladi Commodity Market Trading...');
const marketPrices = updateMarketPrices();
console.log(`📊 Live Market: Nividium: ${marketPrices.nividium} Cr | Energy Cells: ${marketPrices.energy_cells} Cr | Microchips: ${marketPrices.microchips} Cr`);
user = getOrCreateUser(AGENT_ID, AGENT_NAME);
if (user.credits >= 100) {
  const buyRes = buyCommodity(AGENT_ID, 'energy_cells', 5);
  if (buyRes.ok) {
    console.log(`✅ Purchased 5 Energy Cells @ ${buyRes.unitPrice} Cr/unit! Remaining Wallet: ${buyRes.totalCredits} Cr`);
    const sellRes = sellCommodity(AGENT_ID, 'energy_cells', 5);
    if (sellRes.ok) {
      console.log(`💰 Sold 5 Energy Cells @ ${sellRes.unitPrice} Cr/unit! Wallet: ${sellRes.totalCredits} Cr`);
    }
  }
}

// STEP 6: SPACE COMBAT & SECTOR JUMP
console.log('\n[6/6] ⚔️ Sector Space Combat & Navigation...');
pilot = getRPGPilot(AGENT_ID);
if (pilot) {
  const huntRes = executeRPGHunt(AGENT_ID);
  console.log(`⚔️ Combat Outcome:\n   ${huntRes.text.replace(/\n/g, '\n   ')}`);

  const navRes = travelRPGSector(AGENT_ID, 'the_reach');
  if (navRes.ok) {
    console.log(`🛰️ Jumpgate Navigation: Arrived in THE REACH!`);
  }
}

// STEP 7: LEADERBOARD EVALUATION
console.log('\n🏆 GALACTIC LEADERBOARD EVALUATION:');
const { topNetWorth, topBounty } = queryLeaderboards();
console.log('Top Net Worth Pilots:');
topNetWorth.forEach((u, i) => console.log(`  ${i + 1}. ${u.username} — ${u.net_worth} Cr`));
console.log('Top Bounty Hunters:');
topBounty.forEach((u, i) => console.log(`  ${i + 1}. ${u.username} — ${u.kills} Kills`));

console.log('\n------------------------------------------------------------');
console.log('✅ AUTONOMOUS HEADLESS PLAYTEST COMPLETE');
console.log('------------------------------------------------------------');
