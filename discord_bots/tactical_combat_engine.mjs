import { SHIPS } from './sqlite_db.mjs';
import { getSector } from './sector_graph.mjs';

export const RANGE_BANDS = {
  LONG: { name: '📡 Long Sensor Range (15km)', hitChance: 0.5, missileBonus: 1.5 },
  MEDIUM: { name: '⚔️ Medium Plasma Range (5km)', hitChance: 0.85, laserBonus: 1.0 },
  CLOSE: { name: '💥 Close Dogfight / Boarding (1km)', hitChance: 0.95, criticalBonus: 1.4 }
};

export const TARGET_SUBSYSTEMS = {
  hull: { name: '🚀 Main Hull', desc: 'Direct structural damage to destroy target.' },
  engines: { name: '🔥 Main Engines', desc: 'Disables enemy maneuver and prevents escape.' },
  shields: { name: '⚡ Shield Generators', desc: 'Collapse enemy shield regeneration.' },
  weapons: { name: '💥 Weapon Turrets', desc: 'Reduce enemy incoming laser firepower.' }
};

export function initTacticalCombatSession(playerPilot, sectorId, targetType = 'pirate') {
  const isXenon = sectorId === 'matrix_451' || targetType === 'xenon';
  const sector = getSector(sectorId);
  const threatMult = sector ? sector.threat.riskMultiplier : 1.0;

  const enemy = isXenon ? {
    name: 'Xenon K Heavy Destroyer',
    shields: Math.round(300 * threatMult),
    maxShields: Math.round(300 * threatMult),
    hull: Math.round(250 * threatMult),
    maxHull: Math.round(250 * threatMult),
    laserDmg: Math.round(45 * threatMult),
    enginesOk: true,
    weaponsOk: true
  } : {
    name: 'Pirate Marauder Harrier',
    shields: 100,
    maxShields: 100,
    hull: 90,
    maxHull: 90,
    laserDmg: 25,
    enginesOk: true,
    weaponsOk: true
  };

  const ship = SHIPS[playerPilot.ship_class] || SHIPS.S;

  return {
    turn: 1,
    range: RANGE_BANDS.LONG,
    sectorId,
    player: {
      name: playerPilot.username || 'Pilot',
      shields: playerPilot.shields || ship.shields,
      maxShields: ship.shields,
      hull: playerPilot.hull || ship.hull,
      maxHull: ship.hull,
      laserDmg: ship.laserDmg,
      archetype: playerPilot.archetype
    },
    enemy,
    subsystemTarget: 'hull',
    log: [`⚔️ Tactical Encounter Started in ${sector?.name || sectorId} at ${RANGE_BANDS.LONG.name}!`]
  };
}

export function executeCombatRound(session, playerAction, targetSubsystem = 'hull') {
  session.subsystemTarget = targetSubsystem;
  const { player, enemy, range } = session;
  let roundLog = [];

  // PLAYER ACTION
  if (playerAction === 'fire_plasma') {
    let hitRoll = Math.random();
    if (hitRoll < range.hitChance) {
      let baseDmg = player.laserDmg * (player.archetype === 'bounty' ? 1.15 : 1.0);
      if (range === RANGE_BANDS.CLOSE) baseDmg *= 1.3;

      baseDmg = Math.round(baseDmg);

      if (targetSubsystem === 'shields') {
        enemy.shields = Math.max(0, enemy.shields - Math.round(baseDmg * 1.5));
        roundLog.push(`✅ Direct hit on enemy Shield Generators! Shields depleted to ${enemy.shields}/${enemy.maxShields}.`);
      } else if (targetSubsystem === 'engines') {
        enemy.hull = Math.max(0, enemy.hull - Math.round(baseDmg * 0.8));
        enemy.enginesOk = false;
        roundLog.push(`🔥 Engines targeted! Enemy main thrusters severely damaged.`);
      } else if (targetSubsystem === 'weapons') {
        enemy.hull = Math.max(0, enemy.hull - Math.round(baseDmg * 0.8));
        enemy.weaponsOk = false;
        enemy.laserDmg = Math.round(enemy.laserDmg * 0.5);
        roundLog.push(`💥 Weapon turrets targeted! Enemy firepower reduced by 50%.`);
      } else {
        if (enemy.shields > 0) {
          const sDmg = Math.min(enemy.shields, baseDmg);
          enemy.shields -= sDmg;
          const overflow = baseDmg - sDmg;
          if (overflow > 0) enemy.hull = Math.max(0, enemy.hull - overflow);
          roundLog.push(`💥 Hit enemy for ${baseDmg} damage! (Shields: ${enemy.shields}, Hull: ${enemy.hull})`);
        } else {
          enemy.hull = Math.max(0, enemy.hull - baseDmg);
          roundLog.push(`💥 Direct Hull Hit for ${baseDmg} damage! (Hull: ${enemy.hull}/${enemy.maxHull})`);
        }
      }
    } else {
      roundLog.push(`❌ Plasma salvo missed due to distance (${range.name}).`);
    }
  } else if (playerAction === 'close_distance') {
    if (range === RANGE_BANDS.LONG) session.range = RANGE_BANDS.MEDIUM;
    else if (range === RANGE_BANDS.MEDIUM) session.range = RANGE_BANDS.CLOSE;
    roundLog.push(`🚀 Advanced position to ${session.range.name}!`);
  }

  // CHECK ENEMY DESTRUCTION
  if (enemy.hull <= 0) {
    const salvage = Math.round(200 * (player.archetype === 'bounty' ? 1.25 : 1.0));
    roundLog.push(`🎉 **VICTORY!** ${enemy.name} destroyed! Salvaged +${salvage} Cr.`);
    session.log.push(...roundLog);
    return { ok: true, isFinished: true, isWin: true, salvage, session };
  }

  // ENEMY COUNTER-ATTACK
  if (enemy.weaponsOk) {
    let eDmg = Math.round(enemy.laserDmg * (Math.random() * 0.4 + 0.8));
    if (player.shields > 0) {
      const sDmg = Math.min(player.shields, eDmg);
      player.shields -= sDmg;
      const overflow = eDmg - sDmg;
      if (overflow > 0) player.hull = Math.max(0, player.hull - overflow);
      roundLog.push(`⚠️ Enemy retaliated dealing ${eDmg} damage! (Your Shields: ${player.shields}, Hull: ${player.hull})`);
    } else {
      player.hull = Math.max(0, player.hull - eDmg);
      roundLog.push(`⚠️ Enemy Hull Hit! Your Hull: ${player.hull}/${player.maxHull}`);
    }
  }

  session.turn += 1;
  session.log.push(...roundLog);
  return { ok: true, isFinished: false, session };
}
