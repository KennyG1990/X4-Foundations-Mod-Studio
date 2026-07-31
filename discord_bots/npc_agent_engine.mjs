import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { getSector } from './sector_graph.mjs';
import { getNPCMemory, recordNPCMemory } from './sqlite_db.mjs';

dotenv.config({ path: path.resolve('.env.local') });
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const NPC_PROFILES = {
  // ARGON PRIME
  commander_haddon: {
    id: 'commander_haddon',
    name: 'Commander Haddon',
    species: 'Argon',
    role: 'Argon Federal Fleet Security Commander',
    location: 'argon_prime',
    stationId: 'argon_prime_wharf',
    personality: 'Duty-bound, stern, vigilant against pirate incursions and Xenon fleets, demands proper licensing.',
    knowledge: {
      marketTruth: 'Argon Prime Wharves are short on Hull Parts for destroyer production.',
      secret: 'Authorizing covert bounty payouts for pirate destruction in Heretic\'s End.',
      rumor: 'Suspects Teladi brokers are funneling wares to border anarchy posts.'
    }
  },
  supervisor_miller: {
    id: 'supervisor_miller',
    name: 'Supervisor Miller',
    species: 'Argon',
    role: 'Ore Processing Logistics Director',
    location: 'argon_prime',
    stationId: 'argon_prime_refinery',
    personality: 'Pragmatic, overworked, focused on raw mineral throughput and refinery quotas.',
    knowledge: {
      marketTruth: 'Paying premium rates for high-purity Ore shipments from Asteroid Belt.',
      secret: 'Hiding a secret ore stash reserved for emergency fleet production.',
      rumor: 'Claims Kha\'ak scouting clusters were spotted near The Reach.'
    }
  },

  // THE REACH
  engineer_vance: {
    id: 'engineer_vance',
    name: 'Chief Engineer Vance',
    species: 'Argon',
    role: 'Sol-Tech Solar Array Operations Chief',
    location: 'the_reach',
    stationId: 'reach_solar_array',
    personality: 'Technical genius, obsessed with solar grid efficiency, friendly to freighter pilots.',
    knowledge: {
      marketTruth: 'Energy cell stockpiles are maxed out; selling at discount rates.',
      secret: 'Developing experimental solar shield recharging technology.',
      rumor: 'Heard rumors that pirate marauders are planning a raid on convoy routes.'
    }
  },

  // GRAND EXCHANGE I
  nisa_teladi: {
    id: 'nisa_teladi',
    name: 'Nisa t\' Tkr',
    species: 'Teladi',
    role: 'Senior Trade Broker & Commodity Specialist',
    location: 'grand_exchange_1',
    stationId: 'teladi_trading_station',
    personality: 'Shrewd, profit-calculating, polite yet transactional, obsessed with credit margins and Nividium value.',
    knowledge: {
      marketTruth: 'Nividium prices are surging due to Paranid Quantum Tube shortages.',
      secret: 'Financing an illegal black market supply line to Freeport 7 in Heretic\'s End.',
      rumor: 'Hears rumors of an intact Xenon Data Vault deep in Matrix #451.'
    }
  },
  vault_keeper_trim: {
    id: 'vault_keeper_trim',
    name: 'Vault Keeper Trim t\' Fff',
    species: 'Teladi',
    role: 'Grand Exchange Nividium Reserve Custodian',
    location: 'grand_exchange_1',
    stationId: 'teladi_nividium_vault',
    personality: 'Paranoid, protective of banking vaults, distrustful of armed mercenaries.',
    knowledge: {
      marketTruth: 'Teladi Banking Guild offers 2% daily interest on deposited savings.',
      secret: 'Knows the access protocol for emergency credit liquidity reserves.',
      rumor: 'Believes Paranid spies are trying to infiltrate Teladi data networks.'
    }
  },

  // EIGHTEEN BILLION
  manager_bili: {
    id: 'manager_bili',
    name: 'Manager Bili t\' Sss',
    species: 'Teladi',
    role: 'Microchip Fabrication Complex Director',
    location: 'eighteen_billion',
    stationId: 'microchip_fab_01',
    personality: 'Corporate bureaucrat, meticulous with production schedules, values bulk contracts.',
    knowledge: {
      marketTruth: 'Silicon shortages are slowing down microchip fabrication lines.',
      secret: 'Contracting independent miners directly for off-the-books silicon deliveries.',
      rumor: 'Warns that Xenon raiding parties have entered Second Flash.'
    }
  },

  // SECOND FLASH
  high_priest_karras: {
    id: 'high_priest_karras',
    name: 'High Priest Karras',
    species: 'Paranid',
    role: 'Trinity Quantum Synthesis Overseer',
    location: 'second_flash',
    stationId: 'paranid_quantum_complex',
    personality: 'Philosophical, arrogant, speaks in mathematical paradigms, demands reverence for Paranid engineering.',
    knowledge: {
      marketTruth: 'Quantum tube production requires steady supplies of refined microchips.',
      secret: 'Synthesizing advanced military shielding components for Paranid capital ships.',
      rumor: 'Claims an ancient jumpgate anomaly is active near Matrix #451.'
    }
  },
  vond_split: {
    id: 'vond_split',
    name: 'Vond k\' Rnn',
    species: 'Split',
    role: 'Vanguard Mercenary & Xenon Specialist',
    location: 'second_flash',
    stationId: 'paranid_quantum_complex',
    personality: 'Aggressive, honor-driven, respects combat prowess, despises cowardice.',
    knowledge: {
      marketTruth: 'Xenon K Destroyers are active near the Matrix #451 jumpgate.',
      secret: 'Holds a decrypted security keycard for Xenon Data Vault Alpha.',
      rumor: 'Claims a Split fleet is preparing a raid on Heretic\'s End.'
    }
  },

  // HERETIC'S END
  captain_silas: {
    id: 'captain_silas',
    name: 'Captain Silas',
    species: 'Human / Outlaw',
    role: 'Freeport 7 Anarchy Syndicate Boss',
    location: 'heretics_end',
    stationId: 'freeport_7',
    personality: 'Cynical, cunning, friendly to smugglers, hostile to Argon security forces.',
    knowledge: {
      marketTruth: 'Buys stolen or contraband wares at high black market rates.',
      secret: 'Operating a hidden repair dock for outlaw and pirate vessels.',
      rumor: 'Reports that Argon military escorts are hunting border smugglers.'
    }
  },

  // MATRIX #451
  xenon_core_alpha: {
    id: 'xenon_core_alpha',
    name: 'Corrupted Core Alpha',
    species: 'Xenon AI Entity',
    role: 'Vault Sub-Routine Logic Core',
    location: 'matrix_451',
    stationId: 'xenon_data_vault_alpha',
    personality: 'Cold, algorithmic, glitching with fragmented historical records and threat calculations.',
    knowledge: {
      marketTruth: 'Data Vault Alpha contains 1000 Cr encryption keys and legacy schematics.',
      secret: 'Vulnerable to /hack codebreaking attacks.',
      rumor: 'Processing signals from unknown deep-space Xenon hive nodes.'
    }
  }
};

export async function generateNPCDialogue(npcId, playerProfile, playerMessage) {
  const npc = NPC_PROFILES[npcId];
  if (!npc) return { ok: false, error: 'Unknown NPC identity.' };

  const sector = getSector(npc.location);
  const memory = getNPCMemory(playerProfile.userId || 'guest', npcId);

  const memoryContext = memory ? `PAST INTERACTION HISTORY WITH THIS PLAYER: Trust Score: ${memory.trust_score}. Memory Summary: "${memory.memory_summary}".` : 'FIRST TIME MEETING THIS PLAYER.';

  const systemInstruction = `
You are portraying ${npc.name}, a ${npc.species} ${npc.role} located at ${sector?.name || npc.location}.
PERSONALITY: ${npc.personality}
${memoryContext}

STRICT BOUNDARIES OF TRUTH & KNOWLEDGE:
- You ONLY know what a ${npc.role} in your position could plausibly know.
- What you believe to be true: ${npc.knowledge.marketTruth}
- Rumors you have heard: ${npc.knowledge.rumor}
- Your hidden secret (do NOT reveal unless trust is extremely high): ${npc.knowledge.secret}

PHYSICAL STATE INVARIANTS:
- You CANNOT give away free credits, ships, or cargo that do not exist in the world engine.
- You speak in character, concise (2-4 sentences max), suited for a Discord space game.
  `;

  let replyText = '';

  if (!ai) {
    replyText = `[${npc.name}]: "Profit-opportunity presents itself, pilot. ${npc.knowledge.marketTruth} Speak your business quickly."`;
  } else {
    try {
      const prompt = `Player Pilot (${playerProfile.username}, Faction: ${playerProfile.faction || 'Argon'}, Career: ${playerProfile.archetype || 'Trader'}) says: "${playerMessage}"`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 200
        }
      });
      replyText = response.text?.trim() || `[${npc.name}]: "State your business, pilot."`;
    } catch (e) {
      replyText = `[${npc.name}]: "Comms static... ${npc.knowledge.marketTruth}"`;
    }
  }

  // Record interaction memory in database
  if (playerProfile.userId) {
    const updatedTrust = (memory?.trust_score || 0) + 1;
    recordNPCMemory(playerProfile.userId, npcId, updatedTrust, `Spoke about: ${playerMessage.slice(0, 50)}`);
  }

  return {
    ok: true,
    npcName: npc.name,
    reply: replyText
  };
}
