/**
 * IDE capability broker. Forge owns every X4-semantic decision; companion
 * extensions may add generic XML ergonomics but never change Forge validity.
 * This module is pure so its policy can be self-tested outside the IDE host.
 */

export interface IdeCapabilityInput {
  installedExtensionIds: string[];
  xmlAssociationsEnabled: boolean;
  backendState: 'stopped' | 'managed' | 'attached';
}

export interface CompanionCapability {
  id: string;
  name: string;
  installed: boolean;
  contribution: string;
}

export interface IdeCapabilityReport {
  semanticAuthority: 'X4 Forge';
  backendState: IdeCapabilityInput['backendState'];
  native: string[];
  companions: CompanionCapability[];
  xmlAssociations: { enabled: boolean; effective: boolean; explanation: string };
}

const KNOWN_COMPANIONS: Array<Omit<CompanionCapability, 'installed'>> = [
  {
    id: 'redhat.vscode-xml',
    name: 'XML (Red Hat)',
    contribution: 'generic XML formatting, navigation, symbols, and opt-in XSD associations',
  },
  {
    id: 'dotjoshjohnson.xml',
    name: 'XML Tools',
    contribution: 'generic XML formatting and navigation',
  },
  {
    id: 'fabianlauer.vs-code-xml-format',
    name: 'XML Format',
    contribution: 'generic XML formatting',
  },
];

export function detectIdeCapabilities(input: IdeCapabilityInput): IdeCapabilityReport {
  const installed = new Set(input.installedExtensionIds.map(id => id.toLowerCase()));
  const companions = KNOWN_COMPANIONS.map(companion => ({
    ...companion,
    installed: installed.has(companion.id),
  }));
  const associationConsumer = companions.some(companion => companion.installed && companion.id === 'redhat.vscode-xml');
  return {
    semanticAuthority: 'X4 Forge',
    backendState: input.backendState,
    native: [
      'X4 context completion',
      'X4 hover documentation',
      'X4 deterministic diagnostics',
      'MD cue definitions and references',
      'project validation in Problems',
    ],
    companions,
    xmlAssociations: {
      enabled: input.xmlAssociationsEnabled,
      effective: input.xmlAssociationsEnabled && associationConsumer,
      explanation: input.xmlAssociationsEnabled
        ? associationConsumer
          ? 'Opt-in XSD associations are available to the installed XML language server; Forge remains the X4 diagnostic authority.'
          : 'Opt-in XSD associations are enabled, but no supported XML language server is installed to consume them.'
        : 'Opt-in XSD associations are off. Companion extensions may still format XML; Forge remains the only X4 diagnostic authority.',
    },
  };
}

export function formatIdeCapabilityReport(report: IdeCapabilityReport): string[] {
  const installed = report.companions.filter(item => item.installed);
  return [
    `semantic authority: ${report.semanticAuthority}`,
    `backend: ${report.backendState}`,
    `native providers: ${report.native.join(', ')}`,
    `companion XML extensions: ${installed.length ? installed.map(item => `${item.name} (${item.id})`).join(', ') : 'none detected'}`,
    `XML associations: ${report.xmlAssociations.explanation}`,
  ];
}

export function runCapabilitySelftest(): { allPassed: boolean; passed: number; total: number; checks: Array<{ name: string; pass: boolean }> } {
  const checks: Array<{ name: string; pass: boolean }> = [];
  const ok = (name: string, pass: boolean) => checks.push({ name, pass });
  const bare = detectIdeCapabilities({ installedExtensionIds: [], xmlAssociationsEnabled: false, backendState: 'managed' });
  ok('forge_is_semantic_authority_without_companion', bare.semanticAuthority === 'X4 Forge');
  ok('native_completion_always_reported', bare.native.includes('X4 context completion'));
  ok('associations_off_without_opt_in', !bare.xmlAssociations.effective);

  const supplemented = detectIdeCapabilities({
    installedExtensionIds: ['REDHAT.VSCODE-XML'],
    xmlAssociationsEnabled: true,
    backendState: 'attached',
  });
  ok('companion_detection_is_case_insensitive', supplemented.companions.some(item => item.id === 'redhat.vscode-xml' && item.installed));
  ok('associations_effective_with_consumer', supplemented.xmlAssociations.effective);
  ok('companion_does_not_replace_authority', supplemented.semanticAuthority === 'X4 Forge');
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runCapabilitySelftest();
  console.log(`capabilities selftest: ${result.passed}/${result.total} allPassed=${result.allPassed}`);
  for (const check of result.checks) if (!check.pass) console.log('FAIL', check.name);
  process.exit(result.allPassed ? 0 : 1);
}
