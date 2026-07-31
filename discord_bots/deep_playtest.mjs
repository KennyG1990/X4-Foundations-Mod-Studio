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

console.log('============================================================');
console.log('🤖 DEEP MULTI-TURN AUTONOMOUS PLAYTEST & UX EVALUATION');
console.log('============================================================');

const AGENT_ID = 'antigravity_concierge_777';
const AGENT_NAME = '🤖 Antigravity AI Pilot';

// TURN 1: START TECH RESEARCH
console.log('\n▶️ TURN 1: Initializing Tech Research...');
const busyCheck = checkResearchBusy(AGENT_ID);
if (!busyCheck.busy) {
  const researchRes = startResearchProject(AGENT_ID, 'plasma_array');
  if (researchRes.ok) {
    console.log(`✅ Started Research: ${researchRes.tech.name} (${researchRes.durationMin}m duration).`);
  } else {
    console.log(`ℹ️ Research: ${researchRes.error}`);
  }
} else {
  console.log(`🔬 Currently Researching: ${busyCheck.techName} (${busyCheck.minRemaining}m left). Action lock active!`);
}

// TURN 2: ATTEMPT BUSY ACTION LOCK CHECK
console.log('\n▶️ TURN 2: Testing Action Lock Enforcement...');
const lockedHunt = executeRPGHunt(AGENT_ID);
if (!lockedHunt.ok) {
  console.log(`🔒 EXPECTED BEHAVIOR: Action blocked during research! ("${lockedHunt.error}")`);
} else {
  console.log(`⚠️ WARNING: Action allowed during research! Combat log:\n${lockedHunt.text}`);
}

// TURN 3: XENON DATA VAULT CODEBREAK HACK
console.log('\n▶️ TURN 3: Xenon Data Vault Cyber Hack Attempt...');
const hackResult1 = executeCodebreakHack(AGENT_ID, 'A1B2');
console.log(`🔍 Hack Attempt 1 (A1B2): ${hackResult1.error || (hackResult1.solved ? 'CRACKED!' : `${hackResult1.correctPos}/4 correct positions. ${hackResult1.attemptsLeft} attempts left.`)}`);

const hackResult2 = executeCodebreakHack(AGENT_ID, 'F4E9');
console.log(`🔍 Hack Attempt 2 (F4E9): ${hackResult2.error || (hackResult2.solved ? 'CRACKED!' : `${hackResult2.correctPos}/4 correct positions. ${hackResult2.attemptsLeft} attempts left.`)}`);

// TURN 4: HIGH-RISK SECTOR NAVIGATION TO MATRIX #451
console.log('\n▶️ TURN 4: Deep Sector Exploration (Matrix #451)...');
const navRes = travelRPGSector(AGENT_ID, 'matrix_451');
if (navRes.ok) {
  console.log(`🛰️ Arrived in dangerous Xenon sector: MATRIX #451!`);
} else {
  console.log(`ℹ️ Navigation: ${navRes.error}`);
}

// TURN 5: BANK DEPOSIT & INTEREST EVALUATION
console.log('\n▶️ TURN 5: Galactic Financial Savings & Interest...');
const depositRes = executeBankDeposit(AGENT_ID, 200);
if (depositRes.ok) {
  console.log(`🏦 Deposited 200 Cr into Galactic Bank. Wallet: ${depositRes.credits} Cr | Savings: ${depositRes.bank} Cr (Earning 2% daily interest)`);
} else {
  console.log(`ℹ️ Bank Deposit: ${depositRes.error}`);
}

console.log('\n============================================================');
console.log('✅ DEEP PLAYTEST COMPLETE — EVALUATION GENERATED');
console.log('============================================================');
