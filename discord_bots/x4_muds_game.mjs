import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('data/x4_rpg_database.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('⚠️ Could not load data/x4_rpg_database.json:', e.message);
  }
  return { players: {}, sectors: {} };
}

function saveDB(db) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('❌ Could not save data/x4_rpg_database.json:', e);
  }
}

export const ARCHETYPES = {
  trader: { name: 'Teladi Trade Master', cargoBonus: 20, marginBonus: 0.1, desc: '+20% Cargo Hold, +10% Trade Profit' },
  bounty: { name: 'Split Vanguard Hunter', damageBonus: 0.15, salvageBonus: 0.25, desc: '+15% Turret Damage, +25% Combat Salvage' },
  explorer: { name: 'Argon Pioneer Explorer', energyCostDiscount: 0.3, desc: '-30% Jumpgate Fuel Cost' }
};

export const SHIPS = {
  S: { name: 'Discoverer S-Class', cost: 0, cargoMax: 50, laserDmg: 25, shields: 100, hull: 100 },
  M: { name: 'Cerberus M-Class Frigate', cost: 2500, cargoMax: 150, laserDmg: 65, shields: 300, hull: 250 },
  L: { name: 'Behemoth L-Class Destroyer', cost: 10000, cargoMax: 500, laserDmg: 180, shields: 1000, hull: 850 },
  XL: { name: 'Asgard XL-Class Battleship', cost: 50000, cargoMax: 1500, laserDmg: 500, shields: 3500, hull: 3000 }
};

export function getPlayer(userId) {
  const db = loadDB();
  return db.players[userId] || null;
}

export function createPlayer(userId, username, faction = 'Argon', archetype = 'trader') {
  const db = loadDB();
  if (db.players[userId]) {
    return { ok: false, error: 'Pilot character already exists!' };
  }

  const pClass = ARCHETYPES[archetype] || ARCHETYPES.trader;
  const ship = SHIPS.S;

  const player = {
    userId,
    username,
    faction,
    archetype,
    shipClass: 'S',
    credits: 500,
    currentSector: 'argon_prime',
    shields: ship.shields,
    maxShields: ship.shields,
    hull: ship.hull,
    maxHull: ship.hull,
    cargoMax: ship.cargoMax + (pClass.cargoBonus || 0),
    inventory: {},
    kills: 0
  };

  db.players[userId] = player;
  saveDB(db);
  return { ok: true, player };
}

export function getSector(sectorId) {
  const db = loadDB();
  return db.sectors[sectorId] || null;
}

export function travelSector(userId, targetSectorId) {
  const db = loadDB();
  const player = db.players[userId];
  if (!player) return { ok: false, error: 'Character not created! Run /rp-start first.' };

  const currentSec = db.sectors[player.currentSector];
  if (!currentSec || !currentSec.connected.includes(targetSectorId)) {
    return { ok: false, error: `No direct jumpgate connection from ${currentSec?.name || 'unknown'} to target sector.` };
  }

  player.currentSector = targetSectorId;
  db.players[userId] = player;
  saveDB(db);

  const destSec = db.sectors[targetSectorId];
  return { ok: true, sector: destSec, player };
}

export function engageCombat(userId) {
  const db = loadDB();
  const player = db.players[userId];
  if (!player) return { ok: false, error: 'Character not created! Run /rp-start first.' };

  const ship = SHIPS[player.shipClass] || SHIPS.S;
  const targetName = player.currentSector === 'matrix_451' ? 'Xenon P Corvette' : 'Kha’ak Ravager Drone';

  const playerDmg = Math.round(ship.laserDmg * (1 + (ARCHETYPES[player.archetype]?.damageBonus || 0)));
  const enemyHp = 120;
  const enemyDmg = 30;

  const isWin = playerDmg >= 40;
  let resultText = '';
  let lootCredits = 0;

  if (isWin) {
    lootCredits = Math.round(150 * (1 + (ARCHETYPES[player.archetype]?.salvageBonus || 0)));
    player.credits += lootCredits;
    player.kills += 1;
    resultText = `💥 **VICTORY!** Your ${ship.name} fired primary turrets, dealing ${playerDmg} damage to ${targetName}! Enemy destroyed! (+${lootCredits} Cr salvaged)`;
  } else {
    player.shields = Math.max(0, player.shields - enemyDmg);
    resultText = `⚠️ **RETREAT!** Encountered ${targetName}. Enemy laser fire penetrated shields (-${enemyDmg} Shield HP). Total Shields remaining: ${player.shields}/${player.maxShields}.`;
  }

  db.players[userId] = player;
  saveDB(db);
  return { ok: true, isWin, resultText, lootCredits, player };
}
