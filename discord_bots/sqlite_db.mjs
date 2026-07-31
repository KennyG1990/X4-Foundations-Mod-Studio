import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SECTOR_GRAPH, getSector, canTravelBetween, getConnectedSectors, getSectorStations } from './sector_graph.mjs';

const DB_DIR = path.resolve('data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const dbPath = path.resolve(DB_DIR, 'galaxy_database.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initialize SQLite Schema with Research Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    is_ai INTEGER DEFAULT 0,
    credits INTEGER DEFAULT 250,
    bank INTEGER DEFAULT 0,
    daily_streak INTEGER DEFAULT 0,
    last_daily INTEGER DEFAULT 0,
    last_mine INTEGER DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS rpg_pilots (
    user_id TEXT PRIMARY KEY,
    faction TEXT,
    archetype TEXT,
    ship_class TEXT DEFAULT 'S',
    shields INTEGER,
    max_shields INTEGER,
    hull INTEGER,
    max_hull INTEGER,
    current_sector TEXT DEFAULT 'argon_prime',
    kills INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
  );

  CREATE TABLE IF NOT EXISTS market_inventory (
    user_id TEXT,
    ware_id TEXT,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, ware_id)
  );

  CREATE TABLE IF NOT EXISTS market_prices (
    ware_id TEXT PRIMARY KEY,
    price INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS vault_sessions (
    user_id TEXT PRIMARY KEY,
    target_code TEXT,
    attempts_left INTEGER DEFAULT 6,
    solved INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS research_projects (
    user_id TEXT PRIMARY KEY,
    tech_id TEXT,
    started_at INTEGER,
    duration_ms INTEGER,
    completed INTEGER DEFAULT 0,
    dm_notified INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS unlocked_techs (
    user_id TEXT,
    tech_id TEXT,
    unlocked_at INTEGER,
    PRIMARY KEY(user_id, tech_id)
  );

  CREATE TABLE IF NOT EXISTS npc_memories (
    user_id TEXT,
    npc_id TEXT,
    trust_score INTEGER DEFAULT 0,
    memory_summary TEXT,
    last_interaction INTEGER,
    PRIMARY KEY(user_id, npc_id)
  );

  CREATE TABLE IF NOT EXISTS player_faction_standing (
    user_id TEXT PRIMARY KEY,
    argon INTEGER DEFAULT 0,
    teladi INTEGER DEFAULT 0,
    paranid INTEGER DEFAULT 0,
    split INTEGER DEFAULT 0,
    terran INTEGER DEFAULT 0,
    pirate INTEGER DEFAULT 0,
    xenon INTEGER DEFAULT -100
  );
`);

// Prepared Statements
const stmtGetUser = db.prepare('SELECT * FROM users WHERE user_id = ?');
const stmtInsertUser = db.prepare('INSERT INTO users (user_id, username, is_ai, credits, bank, daily_streak, last_daily, last_mine, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const stmtUpdateCredits = db.prepare('UPDATE users SET credits = ?, bank = ? WHERE user_id = ?');
const stmtUpdateDaily = db.prepare('UPDATE users SET credits = ?, daily_streak = ?, last_daily = ? WHERE user_id = ?');
const stmtUpdateMine = db.prepare('UPDATE users SET credits = ?, last_mine = ? WHERE user_id = ?');

const stmtGetPilot = db.prepare('SELECT * FROM rpg_pilots WHERE user_id = ?');
const stmtInsertPilot = db.prepare('INSERT INTO rpg_pilots (user_id, faction, archetype, ship_class, shields, max_shields, hull, max_hull, current_sector, kills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const stmtUpdatePilotSector = db.prepare('UPDATE rpg_pilots SET current_sector = ? WHERE user_id = ?');
const stmtUpdatePilotCombat = db.prepare('UPDATE rpg_pilots SET shields = ?, kills = ? WHERE user_id = ?');

const stmtGetMarketPrice = db.prepare('SELECT * FROM market_prices WHERE ware_id = ?');
const stmtUpsertMarketPrice = db.prepare('INSERT INTO market_prices (ware_id, price, updated_at) VALUES (?, ?, ?) ON CONFLICT(ware_id) DO UPDATE SET price=excluded.price, updated_at=excluded.updated_at');

const stmtGetInventory = db.prepare('SELECT * FROM market_inventory WHERE user_id = ? AND ware_id = ?');
const stmtUpsertInventory = db.prepare('INSERT INTO market_inventory (user_id, ware_id, quantity) VALUES (?, ?, ?) ON CONFLICT(user_id, ware_id) DO UPDATE SET quantity=excluded.quantity');

const stmtGetVault = db.prepare('SELECT * FROM vault_sessions WHERE user_id = ?');
const stmtUpsertVault = db.prepare('INSERT INTO vault_sessions (user_id, target_code, attempts_left, solved) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET target_code=excluded.target_code, attempts_left=excluded.attempts_left, solved=excluded.solved');

const stmtGetActiveResearch = db.prepare('SELECT * FROM research_projects WHERE user_id = ? AND completed = 0');
const stmtStartResearch = db.prepare('INSERT INTO research_projects (user_id, tech_id, started_at, duration_ms, completed, dm_notified) VALUES (?, ?, ?, ?, 0, 0) ON CONFLICT(user_id) DO UPDATE SET tech_id=excluded.tech_id, started_at=excluded.started_at, duration_ms=excluded.duration_ms, completed=0, dm_notified=0');
const stmtCompleteResearch = db.prepare('UPDATE research_projects SET completed = 1 WHERE user_id = ?');
const stmtMarkDMNotified = db.prepare('UPDATE research_projects SET dm_notified = 1 WHERE user_id = ?');

const stmtGetUnlockedTech = db.prepare('SELECT * FROM unlocked_techs WHERE user_id = ? AND tech_id = ?');
const stmtGetUnlockedTechs = db.prepare('SELECT * FROM unlocked_techs WHERE user_id = ?');
const stmtInsertUnlockedTech = db.prepare('INSERT INTO unlocked_techs (user_id, tech_id, unlocked_at) VALUES (?, ?, ?) ON CONFLICT(user_id, tech_id) DO NOTHING');

export function getOrCreateUser(userId, username = 'Pilot', isAi = false) {
  let user = stmtGetUser.get(userId);
  if (!user) {
    stmtInsertUser.run(userId, username, isAi ? 1 : 0, 250, 0, 0, 0, 0, Date.now());
    user = stmtGetUser.get(userId);
  }
  return user;
}

export function claimDailyReward(userId, username) {
  const u = getOrCreateUser(userId, username);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const TWO_DAYS = 48 * 60 * 60 * 1000;

  if (now - u.last_daily < ONE_DAY) {
    const hoursLeft = Math.ceil((ONE_DAY - (now - u.last_daily)) / (60 * 60 * 1000));
    return { ok: false, error: `Daily reward already claimed! Try again in ~${hoursLeft} hours.` };
  }

  let streak = u.daily_streak || 0;
  if (now - u.last_daily > TWO_DAYS) streak = 1;
  else streak += 1;

  const bonus = Math.min(streak * 25, 250);
  const reward = 100 + bonus;
  const newCredits = u.credits + reward;

  stmtUpdateDaily.run(newCredits, streak, now, userId);
  return { ok: true, reward, streak, totalCredits: newCredits };
}

export function executeBankDeposit(userId, amount) {
  const u = getOrCreateUser(userId);
  if (amount <= 0 || u.credits < amount) return { ok: false, error: 'Insufficient credits in wallet.' };

  const newCredits = u.credits - amount;
  const newBank = u.bank + amount;
  stmtUpdateCredits.run(newCredits, newBank, userId);
  return { ok: true, credits: newCredits, bank: newBank };
}

export function executeBankWithdraw(userId, amount) {
  const u = getOrCreateUser(userId);
  if (amount <= 0 || u.bank < amount) return { ok: false, error: 'Insufficient credits in bank.' };

  const newBank = u.bank - amount;
  const newCredits = u.credits + amount;
  stmtUpdateCredits.run(newCredits, newBank, userId);
  return { ok: true, credits: newCredits, bank: newBank };
}

// RESEARCH TECH TREE CATALOG
export const RESEARCH_TECHS = {
  plasma_array: {
    id: 'plasma_array',
    name: '💥 Heavy Plasma Cannon Array',
    durationMin: 30,
    cost: 500,
    desc: 'Increases all laser turret damage by +35% in MUD space combat.'
  },
  shield_overclock: {
    id: 'shield_overclock',
    name: '⚡ High-Output Shield Matrix',
    durationMin: 45,
    cost: 750,
    desc: 'Increases maximum ship shield HP by +25%.'
  },
  quantum_synthesis: {
    id: 'quantum_synthesis',
    name: '🧪 Quantum Tube Synthesis',
    durationMin: 60,
    cost: 1200,
    desc: 'Increases Teladi Commodity Market sell profits by +20%.'
  },
  repair_drones: {
    id: 'repair_drones',
    name: '🛠️ Nanite Repair Drones',
    durationMin: 90,
    cost: 2000,
    desc: 'Automatically restores 20 Shield HP after every combat hunt.'
  }
};

export function checkResearchBusy(userId) {
  const active = stmtGetActiveResearch.get(userId);
  if (!active) return { busy: false };

  const now = Date.now();
  const elapsed = now - active.started_at;
  if (elapsed < active.duration_ms) {
    const minRemaining = Math.ceil((active.duration_ms - elapsed) / (60 * 1000));
    const tech = RESEARCH_TECHS[active.tech_id];
    return { busy: true, minRemaining, techName: tech?.name || active.tech_id };
  } else {
    // Finished! Mark completed & unlock
    stmtCompleteResearch.run(userId);
    stmtInsertUnlockedTech.run(userId, active.tech_id, now);
    return { busy: false, justFinished: true, techId: active.tech_id };
  }
}

export function startResearchProject(userId, techId) {
  const busyCheck = checkResearchBusy(userId);
  if (busyCheck.busy) {
    return { ok: false, error: `🔬 Character busy researching **${busyCheck.techName}**! Finishes in ~${busyCheck.minRemaining} minutes.` };
  }

  const tech = RESEARCH_TECHS[techId];
  if (!tech) return { ok: false, error: 'Invalid technology selection.' };

  const alreadyUnlocked = stmtGetUnlockedTech.get(userId, techId);
  if (alreadyUnlocked) return { ok: false, error: `You have already unlocked **${tech.name}**!` };

  const u = getOrCreateUser(userId);
  if (u.credits < tech.cost) return { ok: false, error: `Requires ${tech.cost} Cr. Wallet: ${u.credits} Cr.` };

  const durationMs = tech.durationMin * 60 * 1000;
  stmtUpdateCredits.run(u.credits - tech.cost, u.bank, userId);
  stmtStartResearch.run(userId, techId, Date.now(), durationMs);

  return { ok: true, tech, durationMin: tech.durationMin, remainingCredits: u.credits - tech.cost };
}

export function getPendingResearchDMs() {
  const finished = db.prepare('SELECT * FROM research_projects WHERE completed = 1 AND dm_notified = 0').all();
  return finished;
}

export function markResearchDMNotified(userId) {
  stmtMarkDMNotified.run(userId);
}

export function executeMiningExpedition(userId) {
  const busyCheck = checkResearchBusy(userId);
  if (busyCheck.busy) {
    return { ok: false, error: `🔬 Character locked in research lab working on **${busyCheck.techName}**! (~${busyCheck.minRemaining}m left)` };
  }

  const u = getOrCreateUser(userId);
  const now = Date.now();
  const MINE_COOLDOWN = 60 * 60 * 1000;

  if (now - u.last_mine < MINE_COOLDOWN) {
    const minLeft = Math.ceil((MINE_COOLDOWN - (now - u.last_mine)) / (60 * 1000));
    return { ok: false, error: `Ships refueling! Next expedition in ~${minLeft} minutes.` };
  }

  const sectors = ['Grand Exchange I', "Heretic's End", 'Black Hole Sun', 'Trinity Sanctum', 'Asteroid Belt'];
  const sector = sectors[Math.floor(Math.random() * sectors.length)];
  const roll = Math.random();

  let earnedCredits = 0;
  let yieldText = '';

  if (roll > 0.85) {
    earnedCredits = 350;
    yieldText = `💎 **Jackpot Strike in ${sector}!** Discovered a rich Nividium vein (+${earnedCredits} Cr)!`;
  } else if (roll > 0.3) {
    earnedCredits = 140;
    yieldText = `⛏️ **Successful Sweep in ${sector}!** Harvested Silicon & Ore payload (+${earnedCredits} Cr).`;
  } else {
    earnedCredits = 0;
    yieldText = `💥 **Kha'ak Ambush in ${sector}!** Escort fighters repelled invaders, payload lost (0 Cr).`;
  }

  const newCredits = u.credits + earnedCredits;
  stmtUpdateMine.run(newCredits, now, userId);
  return { ok: true, yieldText, earnedCredits, totalCredits: newCredits };
}

// PERSISTENT RPG PILOT ENGINE
export const ARCHETYPES = {
  trader: { name: 'Teladi Trade Master', desc: '+20% Cargo Hold, +10% Profit' },
  bounty: { name: 'Split Vanguard Hunter', desc: '+15% Damage, +25% Salvage' },
  explorer: { name: 'Argon Pioneer Explorer', desc: '-30% Jumpgate Cost' }
};

export const SHIPS = {
  S: { name: 'Discoverer S-Class Fighter', laserDmg: 30, shields: 120, hull: 100 },
  M: { name: 'Cerberus M-Class Frigate', laserDmg: 75, shields: 350, hull: 280 },
  L: { name: 'Behemoth L-Class Destroyer', laserDmg: 200, shields: 1200, hull: 950 },
  XL: { name: 'Asgard XL-Class Battleship', laserDmg: 600, shields: 4000, hull: 3500 }
};

export function createRPGPilot(userId, username, faction, archetype) {
  getOrCreateUser(userId, username);
  let pilot = stmtGetPilot.get(userId);
  if (pilot) return { ok: false, error: 'Pilot character already exists!' };

  const ship = SHIPS.S;
  stmtInsertPilot.run(userId, faction, archetype, 'S', ship.shields, ship.shields, ship.hull, ship.hull, 'argon_prime', 0);
  pilot = stmtGetPilot.get(userId);
  return { ok: true, pilot };
}

export function getRPGPilot(userId) {
  return stmtGetPilot.get(userId);
}

const stmtDeletePilot = db.prepare('DELETE FROM rpg_pilots WHERE user_id = ?');
const resetConfirmCodes = new Map();

export function generateResetCode(userId) {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  resetConfirmCodes.set(userId, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
  return code;
}

export function resetRPGPilot(userId, inputCode) {
  const pilot = stmtGetPilot.get(userId);
  if (!pilot) return { ok: false, error: 'No pilot character exists to reset!' };

  const pending = resetConfirmCodes.get(userId);
  if (!pending || Date.now() > pending.expiresAt) {
    return { ok: false, error: 'Reset confirmation code expired or not requested! Run `/rp-reset` without a code first to get a confirmation code.' };
  }

  if (pending.code !== inputCode.toString().trim()) {
    return { ok: false, error: `❌ Incorrect confirmation code! Enter code **${pending.code}** to confirm character deletion.` };
  }

  stmtDeletePilot.run(userId);
  resetConfirmCodes.delete(userId);
  return { ok: true, message: '🗑️ Character deleted successfully! You may now run `/rp-start` to create a new pilot.' };
}

export function travelRPGSector(userId, targetSector) {
  const busyCheck = checkResearchBusy(userId);
  if (busyCheck.busy) {
    return { ok: false, error: `🔬 Character locked in research lab working on **${busyCheck.techName}**! (~${busyCheck.minRemaining}m left)` };
  }

  const pilot = stmtGetPilot.get(userId);
  if (!pilot) return { ok: false, error: 'No pilot character! Run /rp-start first.' };

  const currentSec = pilot.current_sector || 'argon_prime';
  if (currentSec === targetSector) {
    return { ok: false, error: `You are already in **${getSector(targetSector)?.name || targetSector}**!` };
  }

  const isConnected = canTravelBetween(currentSec, targetSector);
  if (!isConnected) {
    const connected = getConnectedSectors(currentSec).map(s => `• **${s.name}** (\`${s.id}\`)`).join('\n');
    return {
      ok: false,
      error: `⛔ Direct jumpgate to **${targetSector}** unavailable from **${getSector(currentSec)?.name || currentSec}**!\n\n**Connected Jumpgates**:\n${connected}`
    };
  }

  const targetNode = getSector(targetSector);
  stmtUpdatePilotSector.run(targetSector, userId);
  return { ok: true, sector: targetSector, sectorInfo: targetNode };
}


export function executeRPGHunt(userId) {
  const busyCheck = checkResearchBusy(userId);
  if (busyCheck.busy) {
    return { ok: false, error: `🔬 Character locked in research lab working on **${busyCheck.techName}**! (~${busyCheck.minRemaining}m left)` };
  }

  const u = getOrCreateUser(userId);
  const pilot = stmtGetPilot.get(userId);
  if (!pilot) return { ok: false, error: 'No pilot character! Run /rp-start first.' };

  const hasPlasma = stmtGetUnlockedTech.get(userId, 'plasma_array');
  const hasShieldMatrix = stmtGetUnlockedTech.get(userId, 'shield_overclock');
  const hasRepairDrones = stmtGetUnlockedTech.get(userId, 'repair_drones');

  const ship = SHIPS[pilot.ship_class] || SHIPS.S;
  const enemy = pilot.current_sector === 'matrix_451' ? 'Xenon K Destroyer Wing' : 'Pirate Marauder Harrier';
  
  let dmgMult = pilot.archetype === 'bounty' ? 1.15 : 1.0;
  if (hasPlasma) dmgMult += 0.35; // Tech upgrade!

  const dmg = Math.round(ship.laserDmg * dmgMult);
  const isWin = dmg >= 35;
  let salvage = 0;
  let text = '';

  let maxShields = ship.shields;
  if (hasShieldMatrix) maxShields = Math.round(maxShields * 1.25);

  if (isWin) {
    salvage = Math.round(180 * (pilot.archetype === 'bounty' ? 1.25 : 1.0));
    let curShields = pilot.shields;
    if (hasRepairDrones) curShields = Math.min(maxShields, curShields + 20); // Repair drones!

    stmtUpdateCredits.run(u.credits + salvage, u.bank, userId);
    stmtUpdatePilotCombat.run(curShields, pilot.kills + 1, userId);
    text = `💥 **VICTORY!** Your ${ship.name} engaged ${enemy}, dealing ${dmg} laser damage! Hostile destroyed! (+${salvage} Cr salvaged)` + (hasRepairDrones ? ' 🛠️ Repair drones restored +20 SHD!' : '');
  } else {
    const newShields = Math.max(0, pilot.shields - 25);
    stmtUpdatePilotCombat.run(newShields, pilot.kills, userId);
    text = `⚠️ **RETREAT!** Engaged ${enemy}. Shielding absorbed hostile fire (-25 SHD). Total Shields: ${newShields}/${maxShields}.`;
  }

  return { ok: true, isWin, text, salvage, pilot: stmtGetPilot.get(userId) };
}

export function updateMarketPrices() {
  const now = Date.now();
  const wares = [
    { id: 'nividium', min: 250, max: 500 },
    { id: 'energy_cells', min: 8, max: 22 },
    { id: 'microchips', min: 120, max: 220 },
    { id: 'quantum_tubes', min: 180, max: 330 }
  ];

  const currentPrices = {};
  wares.forEach(w => {
    const row = stmtGetMarketPrice.get(w.id);
    if (!row || now - row.updated_at > 30 * 60 * 1000) {
      const price = Math.floor(Math.random() * (w.max - w.min)) + w.min;
      stmtUpsertMarketPrice.run(w.id, price, now);
      currentPrices[w.id] = price;
    } else {
      currentPrices[w.id] = row.price;
    }
  });
  return currentPrices;
}

export function buyCommodity(userId, wareId, qty) {
  const busyCheck = checkResearchBusy(userId);
  if (busyCheck.busy) {
    return { ok: false, error: `🔬 Character locked in research lab working on **${busyCheck.techName}**! (~${busyCheck.minRemaining}m left)` };
  }

  const prices = updateMarketPrices();
  const unitPrice = prices[wareId];
  if (!unitPrice) return { ok: false, error: 'Unknown ware.' };

  const u = getOrCreateUser(userId);
  const cost = unitPrice * qty;
  if (u.credits < cost) return { ok: false, error: `Requires ${cost} Cr. Wallet: ${u.credits} Cr.` };

  const currentInv = stmtGetInventory.get(userId, wareId);
  const newQty = (currentInv ? currentInv.quantity : 0) + qty;

  stmtUpdateCredits.run(u.credits - cost, u.bank, userId);
  stmtUpsertInventory.run(userId, wareId, newQty);
  return { ok: true, wareId, qty, unitPrice, cost, totalCredits: u.credits - cost };
}

export function sellCommodity(userId, wareId, qty) {
  const busyCheck = checkResearchBusy(userId);
  if (busyCheck.busy) {
    return { ok: false, error: `🔬 Character locked in research lab working on **${busyCheck.techName}**! (~${busyCheck.minRemaining}m left)` };
  }

  const prices = updateMarketPrices();
  let unitPrice = prices[wareId];
  if (!unitPrice) return { ok: false, error: 'Unknown ware.' };

  const hasQuantumSynth = stmtGetUnlockedTech.get(userId, 'quantum_synthesis');
  if (hasQuantumSynth) unitPrice = Math.round(unitPrice * 1.2); // +20% Profit Bonus!

  const currentInv = stmtGetInventory.get(userId, wareId);
  const owned = currentInv ? currentInv.quantity : 0;
  if (owned < qty) return { ok: false, error: `You only own ${owned} units of ${wareId}.` };

  const earned = unitPrice * qty;
  const u = getOrCreateUser(userId);
  const newCredits = u.credits + earned;

  stmtUpdateCredits.run(newCredits, u.bank, userId);
  stmtUpsertInventory.run(userId, wareId, owned - qty);
  return { ok: true, wareId, qty, unitPrice, earned, totalCredits: newCredits };
}

export function executeCodebreakHack(userId, guess) {
  let session = stmtGetVault.get(userId);
  if (!session || session.solved) {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    stmtUpsertVault.run(userId, code, 6, 0);
    session = stmtGetVault.get(userId);
  }

  const guessClean = guess.toUpperCase().trim();
  if (guessClean.length !== 4) return { ok: false, error: 'Code must be 4 hex chars (e.g. A4F9).' };

  const attemptsLeft = session.attempts_left - 1;

  if (guessClean === session.target_code) {
    stmtUpsertVault.run(userId, session.target_code, attemptsLeft, 1);
    const u = getOrCreateUser(userId);
    stmtUpdateCredits.run(u.credits + 1000, u.bank, userId);
    return { ok: true, solved: true, reward: 1000, code: session.target_code };
  }

  if (attemptsLeft <= 0) {
    stmtUpsertVault.run(userId, session.target_code, 0, 1);
    return { ok: true, solved: false, failed: true, code: session.target_code };
  }

  let correctPos = 0;
  for (let i = 0; i < 4; i++) {
    if (guessClean[i] === session.target_code[i]) correctPos++;
  }

  stmtUpsertVault.run(userId, session.target_code, attemptsLeft, 0);
  return { ok: true, solved: false, correctPos, attemptsLeft };
}

export function queryLeaderboards() {
  const topNetWorth = db.prepare('SELECT username, is_ai, (credits + bank) as net_worth FROM users ORDER BY net_worth DESC LIMIT 5').all();
  const topBounty = db.prepare('SELECT u.username, u.is_ai, p.kills FROM rpg_pilots p JOIN users u ON p.user_id = u.user_id ORDER BY p.kills DESC LIMIT 5').all();
  return { topNetWorth, topBounty };
}

export function runAIAgentTurn() {
  const AI_AGENT_ID = 'AI_ANTIGRAVITY_PILOT';
  const AI_AGENT_NAME = '🤖 Antigravity AI Concierge';

  const aiUser = getOrCreateUser(AI_AGENT_ID, AI_AGENT_NAME, true);
  let pilot = getRPGPilot(AI_AGENT_ID);

  if (!pilot) {
    createRPGPilot(AI_AGENT_ID, AI_AGENT_NAME, 'Teladi', 'trader');
    pilot = getRPGPilot(AI_AGENT_ID);
  }

  claimDailyReward(AI_AGENT_ID, AI_AGENT_NAME);
  const huntRes = executeRPGHunt(AI_AGENT_ID);

  const updatedUser = getOrCreateUser(AI_AGENT_ID);
  if (updatedUser.credits > 500) {
    executeBankDeposit(AI_AGENT_ID, 250);
  }

  return { ok: true, aiName: AI_AGENT_NAME, huntRes, netWorth: updatedUser.credits + updatedUser.bank };
}

// NPC MEMORY & REPUTATION ENGINE
const stmtGetNPCMemory = db.prepare('SELECT * FROM npc_memories WHERE user_id = ? AND npc_id = ?');
const stmtUpsertNPCMemory = db.prepare('INSERT INTO npc_memories (user_id, npc_id, trust_score, memory_summary, last_interaction) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, npc_id) DO UPDATE SET trust_score=excluded.trust_score, memory_summary=excluded.memory_summary, last_interaction=excluded.last_interaction');
const stmtGetFactionStanding = db.prepare('SELECT * FROM player_faction_standing WHERE user_id = ?');
const stmtInsertFactionStanding = db.prepare('INSERT INTO player_faction_standing (user_id, argon, teladi, paranid, split, terran, pirate, xenon) VALUES (?, 0, 0, 0, 0, 0, 0, -100) ON CONFLICT(user_id) DO NOTHING');

export function getNPCMemory(userId, npcId) {
  return stmtGetNPCMemory.get(userId, npcId);
}

export function recordNPCMemory(userId, npcId, trustScore, summary) {
  stmtUpsertNPCMemory.run(userId, npcId, trustScore, summary, Date.now());
}

export function getFactionStanding(userId) {
  stmtInsertFactionStanding.run(userId);
  return stmtGetFactionStanding.get(userId);
}

