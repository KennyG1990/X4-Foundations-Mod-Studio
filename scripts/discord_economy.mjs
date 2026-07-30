import fs from 'fs';
import path from 'path';

const ECONOMY_PATH = path.resolve('data/discord_economy.json');
const TRIVIA_PATH = path.resolve('data/trivia_questions.json');

function loadEconomy() {
  try {
    if (fs.existsSync(ECONOMY_PATH)) {
      return JSON.parse(fs.readFileSync(ECONOMY_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('⚠️ Could not load data/discord_economy.json:', e.message);
  }
  return {};
}

function saveEconomy(data) {
  try {
    const dir = path.dirname(ECONOMY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ECONOMY_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('❌ Could not save data/discord_economy.json:', e);
  }
}

export function loadTriviaQuestions() {
  try {
    if (fs.existsSync(TRIVIA_PATH)) {
      return JSON.parse(fs.readFileSync(TRIVIA_PATH, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

export function getAccount(userId) {
  const db = loadEconomy();
  if (!db[userId]) {
    db[userId] = {
      userId,
      credits: 100,
      bank: 0,
      dailyStreak: 0,
      lastDaily: 0,
      lastMine: 0,
      upgrades: {
        cooldownReducerMinutes: 0,
        triviaMultiplier: 1.0,
        hazardShield: false
      }
    };
    saveEconomy(db);
  }
  return db[userId];
}

export function claimDaily(userId) {
  const db = loadEconomy();
  const acc = getAccount(userId);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const TWO_DAYS = 48 * 60 * 60 * 1000;

  if (now - acc.lastDaily < ONE_DAY) {
    const remainingHours = Math.ceil((ONE_DAY - (now - acc.lastDaily)) / (60 * 60 * 1000));
    return { ok: false, error: `Daily reward already claimed! Try again in ~${remainingHours} hours.` };
  }

  let streak = acc.dailyStreak || 0;
  if (now - acc.lastDaily > TWO_DAYS) {
    streak = 1;
  } else {
    streak += 1;
  }

  const bonus = Math.min(streak * 25, 250);
  const reward = 100 + bonus;

  acc.credits += reward;
  acc.dailyStreak = streak;
  acc.lastDaily = now;
  db[userId] = acc;
  saveEconomy(db);

  return { ok: true, reward, streak, totalCredits: acc.credits };
}

export function depositBank(userId, amount) {
  const db = loadEconomy();
  const acc = getAccount(userId);

  if (amount <= 0 || acc.credits < amount) {
    return { ok: false, error: 'Insufficient credits in wallet to deposit.' };
  }

  acc.credits -= amount;
  acc.bank += amount;
  db[userId] = acc;
  saveEconomy(db);

  return { ok: true, credits: acc.credits, bank: acc.bank };
}

export function withdrawBank(userId, amount) {
  const db = loadEconomy();
  const acc = getAccount(userId);

  if (amount <= 0 || acc.bank < amount) {
    return { ok: false, error: 'Insufficient credits in Galactic Bank savings.' };
  }

  acc.bank -= amount;
  acc.credits += amount;
  db[userId] = acc;
  saveEconomy(db);

  return { ok: true, credits: acc.credits, bank: acc.bank };
}

export function runMiningExpedition(userId) {
  const db = loadEconomy();
  const acc = getAccount(userId);
  const now = Date.now();
  const MINE_COOLDOWN = 60 * 60 * 1000; // 1 hour

  if (now - acc.lastMine < MINE_COOLDOWN) {
    const remainingMin = Math.ceil((MINE_COOLDOWN - (now - acc.lastMine)) / (60 * 1000));
    return { ok: false, error: `Ships are refueling! Next sector expedition available in ~${remainingMin} minutes.` };
  }

  const sectors = ['Grand Exchange I', "Heretic's End", 'Black Hole Sun', 'Trinity Sanctum', 'Asteroid Belt'];
  const sector = sectors[Math.floor(Math.random() * sectors.length)];
  const roll = Math.random();

  let yieldText = '';
  let earnedCredits = 0;

  if (roll > 0.85) {
    earnedCredits = 300;
    yieldText = `💎 **Jackpot Strike in ${sector}!** Discovered a rich Nividium vein! (+${earnedCredits} Cr)`;
  } else if (roll > 0.3) {
    earnedCredits = 120;
    yieldText = `⛏️ **Successful Sweep in ${sector}!** Harvested Silicon & Ore payload (+${earnedCredits} Cr).`;
  } else {
    if (acc.upgrades?.hazardShield) {
      earnedCredits = 50;
      yieldText = `🛡️ **Pirate Ambush in ${sector}!** Your upgraded Deflector Shield repelled the attack! Scrappers salvaged (+${earnedCredits} Cr).`;
    } else {
      earnedCredits = 0;
      yieldText = `💥 **Kha'ak Ambush in ${sector}!** Escort fighters repelled invaders, but payload was dumped (0 Cr earned).`;
    }
  }

  acc.credits += earnedCredits;
  acc.lastMine = now;
  db[userId] = acc;
  saveEconomy(db);

  return { ok: true, yieldText, earnedCredits, totalCredits: acc.credits };
}

export function processTriviaAnswer(userId, questionId, selectedIndex, wager = 0) {
  const questions = loadTriviaQuestions();
  const q = questions.find(item => item.id === questionId);
  if (!q) return { ok: false, error: 'Question not found.' };

  const db = loadEconomy();
  const acc = getAccount(userId);

  if (wager > 0 && acc.credits < wager) {
    return { ok: false, error: 'Insufficient credits for this wager.' };
  }

  const isCorrect = selectedIndex === q.correctIndex;
  const mult = acc.upgrades?.triviaMultiplier || 1.0;

  let payout = 0;
  if (isCorrect) {
    payout = Math.round((wager > 0 ? wager * 2 : 75) * mult);
    acc.credits += payout;
  } else if (wager > 0) {
    acc.credits -= wager;
  }

  db[userId] = acc;
  saveEconomy(db);

  return {
    ok: true,
    isCorrect,
    correctOption: q.options[q.correctIndex],
    explanation: q.explanation,
    payout,
    wager,
    totalCredits: acc.credits
  };
}

export function buyShopItem(userId, itemId) {
  const db = loadEconomy();
  const acc = getAccount(userId);

  if (itemId === 'cooldown_reducer') {
    const cost = 500;
    if (acc.credits < cost) return { ok: false, error: `Requires ${cost} Cr. You have ${acc.credits} Cr.` };
    acc.credits -= cost;
    acc.upgrades.cooldownReducerMinutes = (acc.upgrades.cooldownReducerMinutes || 0) + 2;
    db[userId] = acc;
    saveEconomy(db);
    return { ok: true, title: '⏱️ Concierge Cooldown Reducer (+2m)', credits: acc.credits };
  }

  if (itemId === 'trivia_mult') {
    const cost = 750;
    if (acc.credits < cost) return { ok: false, error: `Requires ${cost} Cr. You have ${acc.credits} Cr.` };
    if (acc.upgrades.triviaMultiplier >= 1.5) return { ok: false, error: 'Trivia Multiplier upgrade already maxed!' };
    acc.credits -= cost;
    acc.upgrades.triviaMultiplier = 1.5;
    db[userId] = acc;
    saveEconomy(db);
    return { ok: true, title: '🎲 Trivia Payout Multiplier (1.5x)', credits: acc.credits };
  }

  if (itemId === 'hazard_shield') {
    const cost = 1000;
    if (acc.credits < cost) return { ok: false, error: `Requires ${cost} Cr. You have ${acc.credits} Cr.` };
    if (acc.upgrades.hazardShield) return { ok: false, error: 'Hazard Shield already unlocked!' };
    acc.credits -= cost;
    acc.upgrades.hazardShield = true;
    db[userId] = acc;
    saveEconomy(db);
    return { ok: true, title: '🛡️ Expedition Deflector Shielding', credits: acc.credits };
  }

  return { ok: false, error: 'Unknown shop item.' };
}
