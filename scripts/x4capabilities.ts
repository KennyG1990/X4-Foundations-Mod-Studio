#!/usr/bin/env node
/**
 * Read-only capability discovery for humans and external agents.
 * This intentionally does not dispatch capabilities or mint authority.
 */

import crypto from 'crypto';
import {
  buildForgeCapabilityContract,
  findForgeCapability,
  validateForgeCapabilityRegistry,
} from '../src/lib/forgeCapabilities';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function usage(): void {
  console.log('Usage: npm run capabilities -- [--json] [capability.id[@version]]');
  console.log('Lists the canonical Forge capability contract. This command is read-only.');
}

const args = process.argv.slice(2);
const json = args.includes('--json');
const help = args.includes('--help') || args.includes('-h');
const unknownFlags = args.filter(arg => arg.startsWith('-') && !['--json', '--help', '-h'].includes(arg));
const ids = args.filter(arg => !arg.startsWith('-'));

if (help) {
  usage();
  process.exit(0);
}

if (unknownFlags.length || ids.length > 1) {
  console.error(`Invalid capability arguments: ${[...unknownFlags, ...ids.slice(1)].join(', ')}`);
  usage();
  process.exit(2);
}

const errors = validateForgeCapabilityRegistry();
if (errors.length) {
  console.error(`Forge capability registry is invalid:\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exit(1);
}

const contract = buildForgeCapabilityContract(sha256);
const selector = ids[0];
const match = selector?.match(/^(.+?)(?:@(\d+))?$/);
const selectedId = match?.[1];
const selectedVersion = match?.[2] ? Number(match[2]) : 1;
const selected = selectedId ? findForgeCapability(selectedId, selectedVersion) : undefined;
if (ids[0] && !selected) {
  console.error(`Unknown Forge capability or descriptor version: ${ids[0]}`);
  process.exit(2);
}

if (json) {
  console.log(JSON.stringify(selected
    ? { schemaVersion: contract.schemaVersion, contractHash: contract.contractHash, capability: selected }
    : contract, null, 2));
  process.exit(0);
}

console.log(`Forge capability contract ${contract.schemaVersion}`);
console.log(`SHA-256 ${contract.contractHash}`);
console.log('Metadata describes current access/effects; server policy remains authoritative.');
const rows = selected ? [selected] : contract.capabilities;
for (const capability of rows) {
  const api = capability.apiBindings.map(binding => `${binding.method} ${binding.path}`).join(', ');
  const summarize = (projections: typeof capability.surfaces.mcp) => projections.length
    ? projections.map(projection => `${projection.id}[${projection.status}]`).join(', ')
    : 'none';
  console.log(`\n${capability.id}@${capability.version} — ${capability.title}`);
  console.log(`  API: ${api}`);
  console.log(`  agent scopes: ${capability.access.agentScopes.join(', ') || 'none'}; public: ${capability.access.public}`);
  console.log(`  effects: ${capability.effects.join(', ')}; confirmation: ${capability.confirmation}`);
  console.log(`  UI: ${summarize(capability.surfaces.ui)}; CLI: ${summarize(capability.surfaces.cli)}; MCP: ${summarize(capability.surfaces.mcp)}`);
  console.log(`  harness: ${summarize(capability.surfaces.builtInHarness)}; external: ${summarize(capability.surfaces.externalAgents)}`);
}
