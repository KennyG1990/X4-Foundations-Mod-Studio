import { SECTOR_GRAPH, getSector, getConnectedSectors, canTravelBetween } from './sector_graph.mjs';
import { createRPGPilot, getRPGPilot, travelRPGSector } from './sqlite_db.mjs';

console.log('============================================================');
console.log('🧪 UNIT TEST SUITE: PHASE 1 SECTOR GRAPH & JUMPGATE TOPOLOGY');
console.log('============================================================');

const TEST_ID = 'test_pilot_phase1';
const TEST_NAME = 'Test Pilot Alpha';

// TEST 1: VERIFY SECTOR GRAPH DATA
console.log('\n[1/4] Verifying Sector Graph Topology...');
const sectors = Object.keys(SECTOR_GRAPH);
console.log(`✅ Total Sector Nodes: ${sectors.length} sectors registered.`);
if (sectors.length < 5) throw new Error('Sector graph missing required sectors!');

// TEST 2: JUMPGATE CONNECTIVITY
console.log('\n[2/4] Verifying Jumpgate Connection Rules...');
const canJumpDirect = canTravelBetween('argon_prime', 'the_reach');
console.log(`✅ Direct Jump (Argon Prime -> The Reach): ${canJumpDirect}`);
if (!canJumpDirect) throw new Error('Valid jumpgate connection failed!');

const canJumpInvalid = canTravelBetween('argon_prime', 'matrix_451');
console.log(`🔒 Invalid Jump (Argon Prime -> Matrix #451): ${canJumpInvalid} (Expected: false)`);
if (canJumpInvalid) throw new Error('Invalid jumpgate allowed bypass!');

// TEST 3: PILOT NAVIGATION VALIDATION
console.log('\n[3/4] Testing Pilot Jumpgate Navigation...');
createRPGPilot(TEST_ID, TEST_NAME, 'Argon', 'explorer');

const validTravel = travelRPGSector(TEST_ID, 'the_reach');
console.log(`✅ Valid Navigation Result: ${validTravel.ok} | Sector: ${validTravel.sector}`);
if (!validTravel.ok) throw new Error('Valid travel failed!');

const invalidTravel = travelRPGSector(TEST_ID, 'matrix_451');
console.log(`🔒 Invalid Navigation Result: ${invalidTravel.ok} | Error: "${invalidTravel.error}"`);
if (invalidTravel.ok) throw new Error('Invalid travel succeeded when it should be blocked!');

// TEST 4: THREAT LEVEL RETRIEVAL
console.log('\n[4/4] Verifying Sector Threat Levels & Stations...');
const secMatrix = getSector('matrix_451');
console.log(`✅ Matrix #451 Threat: ${secMatrix.threat.name} | Stations: ${secMatrix.stations.map(s => s.name).join(', ')}`);

console.log('\n============================================================');
console.log('✅ PHASE 1 SECTOR GRAPH & JUMPGATE TEST SUITE PASSED');
console.log('============================================================');
