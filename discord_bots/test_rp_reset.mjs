import { createRPGPilot, getRPGPilot, generateResetCode, resetRPGPilot } from './sqlite_db.mjs';

console.log('============================================================');
console.log('🧪 UNIT TEST SUITE: /rp-reset CONFIRMATION CODE & CHARACTER WIPE');
console.log('============================================================');

const TEST_ID = 'test_reset_pilot_123';
const TEST_NAME = 'Pilot Reset Test';

// TEST 1: CREATE PILOT
console.log('\n[1/4] Creating Test Character...');
createRPGPilot(TEST_ID, TEST_NAME, 'Paranid', 'explorer');
const pilot = getRPGPilot(TEST_ID);
console.log(`✅ Character Created: Faction=${pilot.faction}, Sector=${pilot.current_sector}`);

// TEST 2: GENERATE RESET CONFIRMATION CODE
console.log('\n[2/4] Generating 4-Digit Reset Confirmation Code...');
const code = generateResetCode(TEST_ID);
console.log(`✅ Reset Confirmation Code Generated: [ ${code} ]`);
if (!code || code.length !== 4) throw new Error('Failed to generate valid 4-digit code!');

// TEST 3: ATTEMPT RESET WITH INCORRECT CODE
console.log('\n[3/4] Testing Reset Attempt with Incorrect Code...');
const badRes = resetRPGPilot(TEST_ID, '9999');
console.log(`🔒 Incorrect Code Result: ok=${badRes.ok} | Error: "${badRes.error}"`);
if (badRes.ok) throw new Error('Reset succeeded with incorrect code!');

// TEST 4: CONFIRM RESET WITH CORRECT CODE
console.log('\n[4/4] Confirming Character Reset with Correct Code...');
const goodRes = resetRPGPilot(TEST_ID, code);
console.log(`✅ Correct Code Result: ok=${goodRes.ok} | Message: "${goodRes.message}"`);
if (!goodRes.ok) throw new Error('Reset failed with valid code!');

const wipedPilot = getRPGPilot(TEST_ID);
console.log(`✅ Pilot Deleted Status: ${wipedPilot === undefined ? 'Verified Deleted' : 'Failed'}`);
if (wipedPilot !== undefined) throw new Error('Pilot character still exists in database!');

console.log('\n============================================================');
console.log('🎉 /rp-reset CONFIRMATION CODE TEST SUITE PASSED');
console.log('============================================================');
