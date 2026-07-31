import { NPC_PROFILES, generateNPCDialogue } from './npc_agent_engine.mjs';

console.log('============================================================');
console.log('🧪 UNIT TEST SUITE: PHASE 2 BOUNDED NPC BELIEF & LLM DIALOGUE');
console.log('============================================================');

const TEST_PLAYER = { username: 'Pilot Moshine', faction: 'Argon', archetype: 'trader' };

async function runTests() {
  // TEST 1: NPC PROFILES
  console.log('\n[1/3] Verifying NPC Profiles...');
  const npcs = Object.keys(NPC_PROFILES);
  console.log(`✅ Total Active NPCs: ${npcs.length} registered.`);
  if (npcs.length < 3) throw new Error('Missing required NPC profiles!');

  // TEST 2: TELADI BROKER DIALOGUE
  console.log('\n[2/3] Generating Dialogue for Teladi Broker (Nisa t\' Tkr)...');
  const res1 = await generateNPCDialogue('nisa_teladi', TEST_PLAYER, 'What commodities are hot in Grand Exchange right now?');
  console.log(`✅ Response from ${res1.npcName}:\n   ${res1.reply}`);

  // TEST 3: SPLIT MERCENARY DIALOGUE
  console.log('\n[3/3] Generating Dialogue for Split Mercenary (Vond k\' Rnn)...');
  const res2 = await generateNPCDialogue('vond_split', TEST_PLAYER, 'Have you seen any Xenon activity near Matrix #451?');
  console.log(`✅ Response from ${res2.npcName}:\n   ${res2.reply}`);

  console.log('\n============================================================');
  console.log('✅ PHASE 2 BOUNDED NPC BELIEF TEST SUITE PASSED');
  console.log('============================================================');
}

runTests().catch(err => {
  console.error('❌ Phase 2 Test Failed:', err);
  process.exit(1);
});
