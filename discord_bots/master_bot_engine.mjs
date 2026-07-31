import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('data/unified_bot_db.json');
const TRIVIA_PATH = path.resolve('data/trivia_questions.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('⚠️ Could not load data/unified_bot_db.json:', e.message);
  }
  return { users: {}, market: {}, duels: {}, vaults: {} };
}

function saveDB(db) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('❌ Could not save data/unified_bot_db.json:', e);
  }
}

export function getUser(userId, username = 'Pilot') {
  const db = loadDB();
  if (!db.users[userId]) {
    db.users[userId] = {
      userId,
      username,
      credits: 250,
      bank: 0,
      dailyStreak: 0,
      lastDaily: 0,
      lastMine: 0,
      upgrades: { cooldownReducerMinutes: 0, triviaMultiplier: 1.0, hazardShield: false },
      rpg: null,
      marketPortfolio: { energy_cells: 0, nividium: 0, microchips: 0, quantum_tubes: 0 },
      vaultStats: { solved: 0, attempts: 0 }
    };
    saveDB(db);
  }
  return db.users[userId];
}

// ----------------------------------------------------
// 1. ECONOMY, BANKING & SHOP
// ----------------------------------------------------
export function claimDaily(userId, username) {
  const db = loadDB();
  const u = getUser(userId, username);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const TWO_DAYS = 48 * 60 * 60 * 1000;

  if (now - u.lastDaily < ONE_DAY) {
    const remainingHours = Math.ceil((ONE_DAY - (now - u.lastDaily)) / (60 * 60 * 1000));
    return { ok: false, error: `Daily reward already claimed! Try again in ~${remainingHours} hours.` };
  }

  let streak = u.dailyStreak || 0;
  if (now - u.lastDaily > TWO_DAYS) streak = 1;
  else streak += 1;

  const bonus = Math.min(streak * 25, 250);
  const reward = 100 + bonus;

  u.credits += reward;
  u.dailyStreak = streak;
  u.lastDaily = now;
  db.users[userId] = u;
  saveDB(db);

  return { ok: true, reward, streak, totalCredits: u.credits };
}

export function depositBank(userId, amount) {
  const db = loadDB();
  const u = getUser(userId);
  if (amount <= 0 || u.credits < amount) return { ok: false, error: 'Insufficient credits in wallet.' };
  u.credits -= amount;
  u.bank += amount;
  db.users[userId] = u;
  saveDB(db);
  return { ok: true, credits: u.credits, bank: u.bank };
}

export function withdrawBank(userId, amount) {
  const db = loadDB();
  const u = getUser(userId);
  if (amount <= 0 || u.bank < amount) return { ok: false, error: 'Insufficient credits in bank.' };
  u.bank -= amount;
  u.credits += amount;
  db.users[userId] = u;
  saveDB(db);
  return { ok: true, credits: u.credits, bank: u.bank };
}

export function runMiningExpedition(userId) {
  const db = loadDB();
  const u = getUser(userId);
  const now = Date.now();
  const MINE_COOLDOWN = 60 * 60 * 1000;

  if (now - u.lastMine < MINE_COOLDOWN) {
    const remainingMin = Math.ceil((MINE_COOLDOWN - (now - u.lastMine)) / (60 * 1000));
    return { ok: false, error: `Ships refueling! Next expedition in ~${remainingMin} minutes.` };
  }

  const sectors = ['Grand Exchange I', "Heretic's End", 'Black Hole Sun', 'Trinity Sanctum', 'Asteroid Belt'];
  const sector = sectors[Math.floor(Math.random() * sectors.length)];
  const roll = Math.random();

  let yieldText = '';
  let earnedCredits = 0;

  if (roll > 0.85) {
    earnedCredits = 350;
    yieldText = `💎 **Jackpot Strike in ${sector}!** Discovered a rich Nividium vein (+${earnedCredits} Cr)!`;
  } else if (roll > 0.3) {
    earnedCredits = 140;
    yieldText = `⛏️ **Successful Sweep in ${sector}!** Harvested Silicon & Ore payload (+${earnedCredits} Cr).`;
  } else {
    if (u.upgrades?.hazardShield) {
      earnedCredits = 60;
      yieldText = `🛡️ **Pirate Ambush in ${sector}!** Deflector Shielding repelled attackers (+${earnedCredits} Cr).`;
    } else {
      earnedCredits = 0;
      yieldText = `💥 **Kha'ak Ambush in ${sector}!** Escort fighters repelled invaders, payload lost (0 Cr).`;
    }
  }

  u.credits += earnedCredits;
  u.lastMine = now;
  db.users[userId] = u;
  saveDB(db);
  return { ok: true, yieldText, earnedCredits, totalCredits: u.credits };
}

// ----------------------------------------------------
// 2. LORE TRIVIA & BETTING
// ----------------------------------------------------
export function getRandomTriviaQuestion() {
  try {
    if (fs.existsSync(TRIVIA_PATH)) {
      const qList = JSON.parse(fs.readFileSync(TRIVIA_PATH, 'utf-8'));
      if (qList.length) {
        return qList[Math.floor(Math.random() * qList.length)];
      }
    }
  } catch (e) {}
  return { id: 't1', question: 'Which faction worships the Three-Fold Path?', options: ['Paranid', 'Teladi', 'Argon', 'Split'], correctIndex: 0, explanation: 'Paranid religion revolves around geometry.' };
}

// ----------------------------------------------------
// 3. PERSISTENT X4 MUD RPG
// ----------------------------------------------------
export const ARCHETYPES = {
  trader: { name: 'Teladi Trade Master', cargoBonus: 20, marginBonus: 0.1, desc: '+20% Cargo Hold, +10% Profit' },
  bounty: { name: 'Split Vanguard Hunter', damageBonus: 0.15, salvageBonus: 0.25, desc: '+15% Damage, +25% Salvage' },
  explorer: { name: 'Argon Pioneer Explorer', energyDiscount: 0.3, desc: '-30% Jumpgate Cost' }
};

export const SHIPS = {
  S: { name: 'Discoverer S-Class Fighter', cost: 0, laserDmg: 30, shields: 120, hull: 100 },
  M: { name: 'Cerberus M-Class Frigate', cost: 2500, laserDmg: 75, shields: 350, hull: 280 },
  L: { name: 'Behemoth L-Class Destroyer', cost: 10000, laserDmg: 200, shields: 1200, hull: 950 },
  XL: { name: 'Asgard XL-Class Battleship', cost: 50000, laserDmg: 600, shields: 4000, hull: 3500 }
};

export function startRPG(userId, username, faction, archetype) {
  const db = loadDB();
  const u = getUser(userId, username);
  if (u.rpg) return { ok: false, error: 'Pilot character already created!' };

  const pClass = ARCHETYPES[archetype] || ARCHETYPES.trader;
  const ship = SHIPS.S;

  u.rpg = {
    faction,
    archetype,
    shipClass: 'S',
    shields: ship.shields,
    maxShields: ship.shields,
    hull: ship.hull,
    maxHull: ship.hull,
    currentSector: 'argon_prime',
    kills: 0
  };

  db.users[userId] = u;
  saveDB(db);
  return { ok: true, rpg: u.rpg };
}

export function travelRPG(userId, targetSector) {
  const db = loadDB();
  const u = getUser(userId);
  if (!u.rpg) return { ok: false, error: 'No RPG character! Run /rp-start first.' };

  const validSectors = ['argon_prime', 'the_reach', 'grand_exchange_1', 'heretics_end', 'matrix_451'];
  if (!validSectors.includes(targetSector)) return { ok: false, error: 'Invalid sector destination.' };

  u.rpg.currentSector = targetSector;
  db.users[userId] = u;
  saveDB(db);
  return { ok: true, sector: targetSector, rpg: u.rpg };
}

export function huntRPG(userId) {
  const db = loadDB();
  const u = getUser(userId);
  if (!u.rpg) return { ok: false, error: 'No RPG character! Run /rp-start first.' };

  const ship = SHIPS[u.rpg.shipClass] || SHIPS.S;
  const enemy = u.rpg.currentSector === 'matrix_451' ? 'Xenon K Destroyer Wing' : 'Pirate Marauder Harrier';
  const dmg = Math.round(ship.laserDmg * (1 + (ARCHETYPES[u.rpg.archetype]?.damageBonus || 0)));

  const isWin = dmg >= 35;
  let salvage = 0;
  let text = '';

  if (isWin) {
    salvage = Math.round(180 * (1 + (ARCHETYPES[u.rpg.archetype]?.salvageBonus || 0)));
    u.credits += salvage;
    u.rpg.kills += 1;
    text = `💥 **VICTORY!** Your ${ship.name} engaged ${enemy}, dealing ${dmg} laser damage! Hostile destroyed! (+${salvage} Cr salvaged)`;
  } else {
    u.rpg.shields = Math.max(0, u.rpg.shields - 25);
    text = `⚠️ **RETREAT!** Engaged ${enemy}. Shielding absorbed hostile fire (-25 SHD). Total Shields: ${u.rpg.shields}/${u.rpg.maxShields}.`;
  }

  db.users[userId] = u;
  saveDB(db);
  return { ok: true, isWin, text, salvage, rpg: u.rpg };
}

// ----------------------------------------------------
// 4. TELADI COMMODITY MARKET
// ----------------------------------------------------
export function getMarketPrices() {
  const db = loadDB();
  if (!db.market.prices || Date.now() - (db.market.lastUpdate || 0) > 30 * 60 * 1000) {
    db.market = {
      lastUpdate: Date.now(),
      prices: {
        energy_cells: Math.floor(Math.random() * 15) + 8,       // 8 - 22 Cr
        nividium: Math.floor(Math.random() * 250) + 250,        // 250 - 500 Cr
        microchips: Math.floor(Math.random() * 100) + 120,      // 120 - 220 Cr
        quantum_tubes: Math.floor(Math.random() * 150) + 180    // 180 - 330 Cr
      }
    };
    saveDB(db);
  }
  return db.market.prices;
}

export function buyMarketWare(userId, wareId, qty) {
  const prices = getMarketPrices();
  const unitPrice = prices[wareId];
  if (!unitPrice) return { ok: false, error: 'Unknown commodity ware.' };

  const totalCost = unitPrice * qty;
  const db = loadDB();
  const u = getUser(userId);

  if (u.credits < totalCost) return { ok: false, error: `Requires ${totalCost} Cr. Wallet: ${u.credits} Cr.` };

  u.credits -= totalCost;
  u.marketPortfolio[wareId] = (u.marketPortfolio[wareId] || 0) + qty;
  db.users[userId] = u;
  saveDB(db);

  return { ok: true, wareId, qty, totalCost, unitPrice, remainingCredits: u.credits };
}

export function sellMarketWare(userId, wareId, qty) {
  const prices = getMarketPrices();
  const unitPrice = prices[wareId];
  if (!unitPrice) return { ok: false, error: 'Unknown commodity ware.' };

  const db = loadDB();
  const u = getUser(userId);
  const owned = u.marketPortfolio[wareId] || 0;

  if (owned < qty) return { ok: false, error: `You only own ${owned} units of ${wareId}.` };

  const totalEarned = unitPrice * qty;
  u.marketPortfolio[wareId] -= qty;
  u.credits += totalEarned;
  db.users[userId] = u;
  saveDB(db);

  return { ok: true, wareId, qty, totalEarned, unitPrice, totalCredits: u.credits };
}

// ----------------------------------------------------
// 5. XENON VAULT CODEBREAKING (/hack)
// ----------------------------------------------------
export function attemptXenonVaultHack(userId, guess) {
  const db = loadDB();
  const u = getUser(userId);

  if (!db.vaults[userId] || db.vaults[userId].solved) {
    // Generate new 4-hex code (e.g. A4F9)
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    db.vaults[userId] = { targetCode: code, attemptsLeft: 6, solved: false };
  }

  const session = db.vaults[userId];
  const guessClean = guess.toUpperCase().trim();

  if (guessClean.length !== 4) return { ok: false, error: 'Code must be exactly 4 hexadecimal characters (e.g., A4F9).' };

  session.attemptsLeft -= 1;

  if (guessClean === session.targetCode) {
    session.solved = true;
    u.credits += 1000;
    u.vaultStats.solved += 1;
    db.users[userId] = u;
    db.vaults[userId] = session;
    saveDB(db);
    return { ok: true, solved: true, reward: 1000, code: session.targetCode, totalCredits: u.credits };
  }

  let correctPos = 0;
  for (let i = 0; i < 4; i++) {
    if (guessClean[i] === session.targetCode[i]) correctPos++;
  }

  if (session.attemptsLeft <= 0) {
    session.solved = true; // reset
    db.vaults[userId] = session;
    saveDB(db);
    return { ok: true, solved: false, failed: true, code: session.targetCode };
  }

  db.vaults[userId] = session;
  saveDB(db);
  return { ok: true, solved: false, correctPos, attemptsLeft: session.attemptsLeft };
}

// ----------------------------------------------------
// 6. SERVER LEADERBOARD
// ----------------------------------------------------
export function getLeaderboard() {
  const db = loadDB();
  const allUsers = Object.values(db.users);

  const topNetWorth = [...allUsers]
    .sort((a, b) => (b.credits + b.bank) - (a.credits + a.bank))
    .slice(0, 5);

  const topBounty = [...allUsers]
    .filter(u => u.rpg)
    .sort((a, b) => (b.rpg?.kills || 0) - (a.rpg?.kills || 0))
    .slice(0, 5);

  return { topNetWorth, topBounty };
}
