/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B118 — one response-verification contract shared by the Forge Studio and its
 * native VS Code/Antigravity shell. A client must not expose a newly minted
 * plaintext key until the server confirms the requested immutable authority.
 */

export type AgentKeyAuthorityMode = 'preset' | 'exact';

export interface RequestedAgentKeyAuthority {
  authorityMode: AgentKeyAuthorityMode;
  capabilityIdentities?: readonly string[];
  allowedEffects?: readonly string[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function uniqueStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return null;
  if (new Set(value).size !== value.length) return null;
  return [...value];
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => right[index] === value);
}

/**
 * Preset responses without an explicit mode remain accepted for old Forge
 * servers, but exact authority always requires an explicit exact-mode receipt.
 */
export function createdAgentKeyMatchesRequestedAuthority(
  requested: RequestedAgentKeyAuthority,
  record: unknown,
): boolean {
  if (!isRecord(record) || typeof record.id !== 'string' || record.id.length === 0) return false;
  if (record.authorityMode !== undefined && record.authorityMode !== 'preset' && record.authorityMode !== 'exact') {
    return false;
  }
  const receivedMode = record.authorityMode === undefined ? 'preset' : record.authorityMode;
  if (requested.authorityMode === 'preset') {
    return receivedMode === 'preset' && record.capabilityConstraint === undefined;
  }
  if (record.authorityMode !== 'exact' || !isRecord(record.capabilityConstraint) ||
      JSON.stringify(Object.keys(record.capabilityConstraint).sort()) !==
        JSON.stringify(['allowedEffects', 'capabilityIdentities'])) return false;
  const actualIdentities = uniqueStringArray(record.capabilityConstraint.capabilityIdentities);
  const actualEffects = uniqueStringArray(record.capabilityConstraint.allowedEffects);
  const expectedIdentities = uniqueStringArray(requested.capabilityIdentities);
  const expectedEffects = uniqueStringArray(requested.allowedEffects);
  return actualIdentities !== null && actualEffects !== null &&
    expectedIdentities !== null && expectedEffects !== null &&
    sameStringArray(actualIdentities, expectedIdentities) &&
    sameStringArray(actualEffects, expectedEffects);
}

export function runAgentKeyCreationContractSelftest(): {
  allPassed: boolean;
  passed: number;
  total: number;
  checks: Array<{ name: string; pass: boolean }>;
} {
  const exact: RequestedAgentKeyAuthority = {
    authorityMode: 'exact',
    capabilityIdentities: ['project.validate@1'],
    allowedEffects: ['read', 'analyze'],
  };
  const checks = [
    {
      name: 'exact canonical receipt accepted',
      pass: createdAgentKeyMatchesRequestedAuthority(exact, {
        id: 'key_exact',
        authorityMode: 'exact',
        capabilityConstraint: {
          capabilityIdentities: ['project.validate@1'],
          allowedEffects: ['read', 'analyze'],
        },
      }),
    },
    {
      name: 'broader preset receipt rejected for exact request',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, { id: 'key_broad', authorityMode: 'preset' }),
    },
    {
      name: 'missing exact response mode rejected',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, {
        id: 'key_legacy_exact',
        capabilityConstraint: {
          capabilityIdentities: ['project.validate@1'],
          allowedEffects: ['read', 'analyze'],
        },
      }),
    },
    {
      name: 'substituted identity rejected',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, {
        id: 'key_substituted',
        authorityMode: 'exact',
        capabilityConstraint: {
          capabilityIdentities: ['workspace.compile@1'],
          allowedEffects: ['read', 'analyze'],
        },
      }),
    },
    {
      name: 'expanded effect receipt rejected',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, {
        id: 'key_expanded',
        authorityMode: 'exact',
        capabilityConstraint: {
          capabilityIdentities: ['project.validate@1'],
          allowedEffects: ['read', 'analyze', 'write'],
        },
      }),
    },
    {
      name: 'duplicate receipt values rejected',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, {
        id: 'key_duplicate',
        authorityMode: 'exact',
        capabilityConstraint: {
          capabilityIdentities: ['project.validate@1', 'project.validate@1'],
          allowedEffects: ['read', 'analyze'],
        },
      }),
    },
    {
      name: 'current preset receipt accepted',
      pass: createdAgentKeyMatchesRequestedAuthority({ authorityMode: 'preset' }, { id: 'key_preset', authorityMode: 'preset' }),
    },
    {
      name: 'legacy preset receipt accepted',
      pass: createdAgentKeyMatchesRequestedAuthority({ authorityMode: 'preset' }, { id: 'key_legacy_preset' }),
    },
    {
      name: 'preset receipt cannot carry a constraint',
      pass: !createdAgentKeyMatchesRequestedAuthority({ authorityMode: 'preset' }, {
        id: 'key_preset_constraint',
        authorityMode: 'preset',
        capabilityConstraint: { capabilityIdentities: [], allowedEffects: [] },
      }),
    },
    {
      name: 'exact receipt rejects extra constraint fields',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, {
        id: 'key_extra_constraint',
        authorityMode: 'exact',
        capabilityConstraint: {
          capabilityIdentities: ['project.validate@1'],
          allowedEffects: ['read', 'analyze'],
          ignored: true,
        },
      }),
    },
    {
      name: 'explicit invalid response mode rejected',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, {
        id: 'key_bad_mode',
        authorityMode: 'future',
        capabilityConstraint: {
          capabilityIdentities: ['project.validate@1'],
          allowedEffects: ['read', 'analyze'],
        },
      }),
    },
    {
      name: 'missing record id rejected',
      pass: !createdAgentKeyMatchesRequestedAuthority(exact, {
        authorityMode: 'exact',
        capabilityConstraint: {
          capabilityIdentities: ['project.validate@1'],
          allowedEffects: ['read', 'analyze'],
        },
      }),
    },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
