import { NPC_PROFILES, generateNPCDialogue } from './npc_agent_engine.mjs';
import { getNPCMemory, getFactionStanding } from './sqlite_db.mjs';
import { SECTOR_GRAPH } from './sector_graph.mjs';

console.log('============================================================');
console.log('🧪 UNIT TEST SUITE: PRODUCTION UPGRADES & EXTENDED ROSTER');
console.log('============================================================');

const TEST_ID = 'test_pilot_prod_upgrades';
const TEST_NAME = 'Pilot Moshine';

async function runProdTests() {
  // TEST 1: EXPANDED NPC COVERAGE
  console.log('\n[1/3] Verifying Complete NPC Roster Across All Stations...');
  const npcs = Object.keys(NPC_PROFILES);
  console.log(`✅ Total Registered Sector NPCs: ${npcs.length}`);
  if (npcs.length < 10) throw new Error(`NPC roster insufficient! Got ${npcs.length}, expected >= 10.`);

  // TEST 2: EPISODIC PLAYER-NPC MEMORY
  console.log('\n[2/3] Testing Player-NPC Episodic Memory Persistence...');
  const player = { userId: TEST_ID, username: TEST_NAME, faction: 'Teladi', archetype: 'trader' };
  
  // Turn 1
  await generateNPCDialogue('nisa_teladi', player, 'I want to trade 50 units of Nividium.');
  const mem1 = getNPCMemory(TEST_ID, 'nisa_teladi');
  console.log(`✅ Memory Recorded (Turn 1): Trust = ${mem1.trust_score} | Summary = "${mem1.memory_summary}"`);
  if (!mem1 || mem1.trust_score < 1) throw new Error('NPC memory failed to record!');

  // Turn 2 (Recall in prompt)
  const dlg2 = await generateNPCDialogue('nisa_teladi', player, 'Do you remember my Nividium trade offer?');
  console.log(`✅ Dialogue Response (Turn 2): ${dlg2.reply}`);

  // TEST 3: FACTION STANDING REPUTATION MATRIX
  console.log('\n[3/3] Testing Faction Standing Reputation Matrix...');
  const standings = getFactionStanding(TEST_ID);
  console.log(`✅ Faction Standings: Argon=${standings.argon}, Teladi=${standings.teladi}, Xenon=${standings.xenon}`);
  if (standings.xenon !== -100) throw new Error('Default Xenon hostile standing incorrect!');

  console.log('\n============================================================');
  console.log('🎉 ALL PRODUCTION UPGRADES & EXTENDED ROSTER TESTS PASSED');
  console.log('============================================================');
}

runProdTests().catch(err => {
  console.error('❌ Production Upgrade Test Failed:', err);
  process.exit(1);
});
