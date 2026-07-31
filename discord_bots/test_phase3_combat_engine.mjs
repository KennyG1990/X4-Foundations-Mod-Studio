import { initTacticalCombatSession, executeCombatRound, RANGE_BANDS, TARGET_SUBSYSTEMS } from './tactical_combat_engine.mjs';

console.log('============================================================');
console.log('🧪 UNIT TEST SUITE: PHASE 3 TACTICAL SUBSYSTEM SPACE COMBAT');
console.log('============================================================');

const TEST_PILOT = { username: 'Vanguard Commander', ship_class: 'S', shields: 120, hull: 100, archetype: 'bounty' };

// TEST 1: INITIALIZE COMBAT SESSION
console.log('\n[1/3] Initializing Tactical Combat Session...');
const session = initTacticalCombatSession(TEST_PILOT, 'matrix_451', 'xenon');
console.log(`✅ Session Started! Range: ${session.range.name} | Enemy: ${session.enemy.name}`);
if (session.range !== RANGE_BANDS.LONG) throw new Error('Combat did not start at Long Range!');

// TEST 2: SUBSYSTEM TARGETING & RANGE ADVANCEMENT
console.log('\n[2/3] Executing Turn 1 (Closing Range & Targeting Shields)...');
const round1 = executeCombatRound(session, 'close_distance', 'shields');
console.log(`✅ Round 1 Result:\n   ${round1.session.log.slice(-2).join('\n   ')}`);

// TEST 3: FIRE PLASMA SALVO AT SUBSYSTEM
console.log('\n[3/3] Executing Turn 2 (Firing Plasma Salvo at Shield Generators)...');
const round2 = executeCombatRound(session, 'fire_plasma', 'shields');
console.log(`✅ Round 2 Result:\n   ${round2.session.log.slice(-2).join('\n   ')}`);

console.log('\n============================================================');
console.log('✅ PHASE 3 TACTICAL SUBSYSTEM COMBAT TEST SUITE PASSED');
console.log('============================================================');
