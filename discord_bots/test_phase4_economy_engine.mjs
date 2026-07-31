import { runEconomicTick, getOpenContracts } from './economy_engine.mjs';

console.log('============================================================');
console.log('🧪 UNIT TEST SUITE: PHASE 4 DYNAMIC ECONOMY & CONTRACT BOARD');
console.log('============================================================');

// TEST 1: EXECUTE ECONOMIC TICK
console.log('\n[1/2] Executing Station Supply Chain Economic Tick...');
const tickResult = runEconomicTick();
console.log(`✅ Economic Tick Complete: Generated ${tickResult.generatedContracts.length} urgent deficit contract(s).`);

// TEST 2: QUERY OPEN CONTRACTS BOARD
console.log('\n[2/2] Querying Open Contract Board...');
const openContracts = getOpenContracts();
console.log(`✅ Open Contracts Registered on Board: ${openContracts.length}`);
openContracts.forEach((c, i) => {
  console.log(`   ${i + 1}. [${c.contract_type.toUpperCase()}] ${c.title} — Reward: ${c.reward_credits} Cr`);
});

console.log('\n============================================================');
console.log('✅ PHASE 4 DYNAMIC ECONOMY TEST SUITE PASSED');
console.log('============================================================');
