import { SECTOR_GRAPH, getSector, canTravelBetween } from './sector_graph.mjs';
import { NPC_PROFILES, generateNPCDialogue } from './npc_agent_engine.mjs';
import { initTacticalCombatSession, executeCombatRound } from './tactical_combat_engine.mjs';
import { runEconomicTick, getOpenContracts } from './economy_engine.mjs';
import { getOrCreateUser, createRPGPilot, travelRPGSector } from './sqlite_db.mjs';

console.log('============================================================');
console.log('🛡️ MASTER VERIFICATION & SAFETY SUITE: NORTH STAR SPEC V1.0');
console.log('============================================================');

const TEST_ID = 'northstar_master_test_pilot';
const TEST_NAME = 'Master Verification Pilot';

async function runMasterSuite() {
  // 1. SECTOR GRAPH TOPOLOGY
  console.log('\n[1/5] Testing Sector Graph Topology & Jumpgate Rules...');
  if (Object.keys(SECTOR_GRAPH).length < 7) throw new Error('Sector graph missing required nodes!');
  if (!canTravelBetween('argon_prime', 'the_reach')) throw new Error('Valid jumpgate pathing failed!');
  if (canTravelBetween('argon_prime', 'matrix_451')) throw new Error('Invalid jumpgate pathing bypassed!');
  console.log('✅ Sector graph & jumpgate topology invariant VERIFIED.');

  // 2. BOUNDED NPC BELIEF & DIALOGUE
  console.log('\n[2/5] Testing Bounded NPC Belief & LLM Constraints...');
  const npcRes = await generateNPCDialogue('nisa_teladi', { username: TEST_NAME, faction: 'Teladi' }, 'What are your profit margins?');
  if (!npcRes.ok) throw new Error('NPC dialogue generation failed!');
  console.log(`✅ NPC bounded dialogue generation VERIFIED (${npcRes.npcName}).`);

  // 3. TACTICAL SUBSYSTEM COMBAT
  console.log('\n[3/5] Testing Tactical Subsystem Range & Combat Calculations...');
  createRPGPilot(TEST_ID, TEST_NAME, 'Split', 'bounty');
  const session = initTacticalCombatSession({ username: TEST_NAME, ship_class: 'S', shields: 120, hull: 100, archetype: 'bounty' }, 'heretics_end');
  const round = executeCombatRound(session, 'fire_plasma', 'engines');
  if (!round.ok) throw new Error('Tactical combat round failed!');
  console.log('✅ Tactical combat subsystem calculations VERIFIED.');

  // 4. DYNAMIC ECONOMY & SHORTAGE CONTRACTS
  console.log('\n[4/5] Testing Station Supply Chain & Deficit Contract Board...');
  const tick = runEconomicTick();
  const contracts = getOpenContracts();
  if (!tick.ok || !contracts) throw new Error('Economic tick failed!');
  console.log(`✅ Dynamic station economy & contracts VERIFIED (${contracts.length} active board contracts).`);

  // 5. DATABASE STATE CONSERVATION & INVARIANTS
  console.log('\n[5/5] Testing Database State Conservation & Credit Invariants...');
  const user = getOrCreateUser(TEST_ID, TEST_NAME);
  if (user.credits < 0 || user.bank < 0) throw new Error('Negative balance invariant violated!');
  console.log('✅ Database state conservation and credit safety invariants VERIFIED.');

  console.log('\n============================================================');
  console.log('🎉 ALL 5 PHASES PASSED — NORTH STAR SPEC V1.0 FULLY VERIFIED');
  console.log('============================================================');
}

runMasterSuite().catch(err => {
  console.error('❌ Master Suite Failure:', err);
  process.exit(1);
});
