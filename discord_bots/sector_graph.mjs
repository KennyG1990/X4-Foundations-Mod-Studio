export const THREAT_LEVELS = {
  SAFE: { name: '🟢 Safe System', riskMultiplier: 1.0, salvageBonus: 1.0, color: 5763719 },
  PATROL: { name: '🔵 Patrol Zone', riskMultiplier: 1.2, salvageBonus: 1.2, color: 3447003 },
  CONTESTED: { name: '🟡 Contested Sector', riskMultiplier: 1.8, salvageBonus: 1.6, color: 15844367 },
  DANGER: { name: '🔴 Xenon Danger Zone', riskMultiplier: 2.8, salvageBonus: 2.5, color: 15548997 }
};

export const SECTOR_GRAPH = {
  argon_prime: {
    id: 'argon_prime',
    name: 'Argon Prime',
    faction: 'Argon Federation',
    threat: THREAT_LEVELS.SAFE,
    description: 'The historic capital of the Argon Federation. Home to heavily guarded wharves and trade routes.',
    connections: ['the_reach', 'heretics_end'],
    stations: [
      { id: 'argon_prime_wharf', name: 'Argon Federal Wharf', type: 'wharf', services: ['shipyard', 'repair', 'market'] },
      { id: 'argon_prime_refinery', name: 'Argon Ore Processing Plant', type: 'refinery', services: ['market', 'mining_buy'] }
    ]
  },
  the_reach: {
    id: 'the_reach',
    name: 'The Reach',
    faction: 'Argon Federation',
    threat: THREAT_LEVELS.PATROL,
    description: 'A sprawling industrial sector with dense asteroid belts and frequent merchant convoys.',
    connections: ['argon_prime', 'grand_exchange_1'],
    stations: [
      { id: 'reach_solar_array', name: 'Sol-Tech Solar Power Plant', type: 'solar', services: ['market'] }
    ]
  },
  grand_exchange_1: {
    id: 'grand_exchange_1',
    name: 'Grand Exchange I',
    faction: 'Teladi Company',
    threat: THREAT_LEVELS.SAFE,
    description: 'The bustling trade epicenter of the Teladi Company. High liquidity, rich markets, and financial brokers.',
    connections: ['the_reach', 'eighteen_billion', 'heretics_end'],
    stations: [
      { id: 'teladi_trading_station', name: 'Teladi Galactic Exchange Station', type: 'trading_hub', services: ['bank', 'market', 'contracts'] },
      { id: 'teladi_nividium_vault', name: 'Grand Exchange Nividium Depot', type: 'depot', services: ['market'] }
    ]
  },
  eighteen_billion: {
    id: 'eighteen_billion',
    name: 'Eighteen Billion',
    faction: 'Teladi Company',
    threat: THREAT_LEVELS.SAFE,
    description: 'A mega-corporate Teladi sector packed with high-tech component fabrication facilities.',
    connections: ['grand_exchange_1', 'second_flash'],
    stations: [
      { id: 'microchip_fab_01', name: 'Eighteen Billion Microchip Complex', type: 'fab', services: ['market'] }
    ]
  },
  second_flash: {
    id: 'second_flash',
    name: 'Second Flash',
    faction: 'Paranid Triumvirate',
    threat: THREAT_LEVELS.PATROL,
    description: 'Sacred Paranid space defined by geometric station superstructures and quantum tube synthesis.',
    connections: ['eighteen_billion', 'matrix_451'],
    stations: [
      { id: 'paranid_quantum_complex', name: 'Trinity Quantum Synthesis Plant', type: 'high_tech', services: ['market', 'research_lab'] }
    ]
  },
  heretics_end: {
    id: 'heretics_end',
    name: "Heretic's End",
    faction: 'Independent / Contested',
    threat: THREAT_LEVELS.CONTESTED,
    description: 'An unstable frontier system where pirate clans ambush unescorted freighters and mining convoys.',
    connections: ['argon_prime', 'grand_exchange_1', 'matrix_451'],
    stations: [
      { id: 'freeport_7', name: 'Freeport 7 Anarchy Station', type: 'anarchy_post', services: ['black_market', 'repair'] }
    ]
  },
  matrix_451: {
    id: 'matrix_451',
    name: 'Matrix #451',
    faction: 'Xenon AI Swarm',
    threat: THREAT_LEVELS.DANGER,
    description: 'A hostile, uncolonized Xenon system containing corrupt Data Vaults, ancient tech relics, and deadly patrols.',
    connections: ['heretics_end', 'second_flash'],
    stations: [
      { id: 'xenon_data_vault_alpha', name: 'Xenon Vault Facility Alpha', type: 'data_vault', services: ['hack_vault'] }
    ]
  }
};

export function getSector(sectorId) {
  return SECTOR_GRAPH[sectorId] || null;
}

export function getConnectedSectors(sectorId) {
  const sec = getSector(sectorId);
  if (!sec) return [];
  return sec.connections.map(id => SECTOR_GRAPH[id]).filter(Boolean);
}

export function canTravelBetween(fromSectorId, toSectorId) {
  const sec = getSector(fromSectorId);
  if (!sec) return false;
  return sec.connections.includes(toSectorId);
}

export function getSectorStations(sectorId) {
  const sec = getSector(sectorId);
  return sec ? sec.stations : [];
}
