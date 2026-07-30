/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic, non-AI explanations for the shared project-diagnostic currency.
 * The message remains the precise finding; this layer explains the validator class
 * and the safest next action without inventing game/runtime facts.
 */

export interface ExplainableDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code?: string;
  domain?: string;
  filePath?: string;
  message: string;
}

export interface DiagnosticExplanation {
  code: string;
  title: string;
  why: string;
  impact: string;
  next: string;
  basis: string;
  deterministic: true;
}

type Guidance = Omit<DiagnosticExplanation, 'code' | 'deterministic'>;

const GUIDANCE: Array<{ matches: (code: string) => boolean; value: Guidance }> = [
  {
    matches: code => code.startsWith('rules.'),
    value: {
      title: 'Project rule contract is invalid',
      why: 'The root forge.rules.json declaration failed its strict versioned policy checks.',
      impact: 'All warning suppressions are disabled and full-project validation fails closed until the rules file is valid.',
      next: 'Open forge.rules.json and correct the named property, scope, review date, or declared evidence contract.',
      basis: 'forge.rules.json v1 policy engine',
    },
  },
  {
    matches: code => /^(xsd\.|schema\.)/.test(code),
    value: {
      title: 'Game schema rejected this structure',
      why: 'The XML element, attribute, value, or placement does not satisfy the routed X4 game schema (XSD).',
      impact: 'X4 may reject the document or ignore the affected structure.',
      next: 'Jump to the file and align the named element or attribute with the schema diagnostic.',
      basis: 'routed X4 XSD validation',
    },
  },
  {
    matches: code => code.startsWith('scriptproperty.'),
    value: {
      title: 'Script-property chain is not proven',
      why: 'A segment or function in the expression was not found in the loaded scriptproperties vocabulary.',
      impact: 'Unknown X4 script properties commonly evaluate to null without a useful runtime error, so conditions can silently never fire.',
      next: 'Use the suggested canonical segment, or suppress only this exact known-good chain after runtime review.',
      basis: 'X4 scriptproperties.xml index',
    },
  },
  {
    matches: code => /^(reference\.|jobs\.|wares\.|factions\.|god\.)/.test(code),
    value: {
      title: 'Referenced game object is unresolved',
      why: 'The identifier was not found in the loaded vanilla/DLC reference corpus for this domain.',
      impact: 'The reference may resolve to nothing in game or may depend on content not declared by the mod.',
      next: 'Check the exact identifier, required DLC dependency, and the source file named by the finding.',
      basis: 'canonical X4 object/reference indexes',
    },
  },
  {
    matches: code => /^(lua_md\.|contract\.)/.test(code),
    value: {
      title: 'MD and Lua do not agree',
      why: 'The deterministic bridge scan found a listener, event, payload key, or contract declared on only one side.',
      impact: 'The UI or script handoff can fail silently even when both files are individually valid.',
      next: 'Compare the exact event/key in the named MD and Lua sources and make both sides use the same contract.',
      basis: 'MD-Lua AST and indexed-payload cross-file analysis',
    },
  },
  {
    matches: code => /^(cue\.|crossfile\.|project\.cue)/.test(code),
    value: {
      title: 'Cross-file cue relationship is broken',
      why: 'A cue definition, signal, reset, cancel, or reference does not resolve consistently across the project.',
      impact: 'The dependent cue path cannot execute as authored.',
      next: 'Jump to the source and align the referenced cue name with an included definition.',
      basis: 'full-project cue index',
    },
  },
  {
    matches: code => /^(diff\.|post-apply\.|patch\.)/.test(code),
    value: {
      title: 'XML patch is unsafe or ineffective',
      why: 'The selector failed, matched ambiguously, or produced an invalid document after deterministic application.',
      impact: 'The patch may do nothing, affect the wrong node, or leave X4 with invalid merged XML.',
      next: 'Inspect the selector against the routed vanilla file and review the post-apply finding before release.',
      basis: 'vanilla-backed diff simulation and post-apply validation',
    },
  },
  {
    matches: code => /^(aiscript\.|order_param\.)/.test(code),
    value: {
      title: 'AI-script order contract is inconsistent',
      why: 'An order parameter, datatype, or AI-script structure does not match the known X4 contract.',
      impact: 'The order can receive the wrong value, fail to start, or behave differently from its UI declaration.',
      next: 'Align the parameter name, datatype, and reader with the canonical order and AI-script definitions.',
      basis: 'AI Script XSD and order-parameter cross-file lint',
    },
  },
  {
    matches: code => code.startsWith('tfile.'),
    value: {
      title: 'Text reference or translation is incomplete',
      why: 'A page/id reference is missing or the language files do not cover the same text keys.',
      impact: 'Players can see raw placeholders, missing labels, or inconsistent translations.',
      next: 'Add or align the named page/id across the required t-files.',
      basis: 'project t-file reference and coverage indexes',
    },
  },
  {
    matches: code => code.startsWith('migration.'),
    value: {
      title: 'Version-sensitive pattern detected',
      why: 'The source uses a construct tracked as deprecated, renamed, or behaviorally changed across X4 versions.',
      impact: 'It may work on one game version and fail or warn on another.',
      next: 'Review the named construct against the target X4 version before replacing or explicitly accepting it.',
      basis: 'version migration lint registry',
    },
  },
  {
    matches: code => code.startsWith('validation.'),
    value: {
      title: 'A required validation layer was unavailable',
      why: 'The backend could not load or inspect one of the declared schema, corpus, property, or disk-file inputs.',
      impact: 'This is not evidence that the project is clean; part of the referee did not run.',
      next: 'Restore the named validator input or file, then rerun full-project validation.',
      basis: 'full-project validation availability gates',
    },
  },
];

function genericGuidance(diagnostic: ExplainableDiagnostic): Guidance {
  const severity = diagnostic.severity === 'error' ? 'blocking error' : diagnostic.severity === 'warning' ? 'review warning' : 'informational finding';
  return {
    title: 'Project validator finding',
    why: `A deterministic project check emitted this ${severity}; no more specific explanation is registered for this code yet.`,
    impact: diagnostic.severity === 'error'
      ? 'The shared validation verdict remains blocked until the finding is resolved.'
      : 'The project may still build, but the named condition should be reviewed before release.',
    next: 'Use the exact finding message, file, and source reference as the authoritative repair target.',
    basis: 'shared full-project diagnostic',
  };
}

export function explainDiagnostic(diagnostic: ExplainableDiagnostic): DiagnosticExplanation {
  const code = String(diagnostic.code || 'project.finding').trim() || 'project.finding';
  const selected = GUIDANCE.find(entry => entry.matches(code))?.value || genericGuidance(diagnostic);
  return { code, ...selected, deterministic: true };
}

export function runDiagnosticExplainSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: unknown }> = [];
  const check = (name: string, pass: unknown, detail?: unknown) => checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  const make = (code: string, severity: ExplainableDiagnostic['severity'] = 'warning') => explainDiagnostic({ code, severity, message: 'fixture' });
  check('scriptproperty names silent-null impact', /null/i.test(make('scriptproperty.unknown').impact));
  check('rules name fail-closed behavior', /disabled/i.test(make('rules.review_overdue').impact));
  check('xsd guidance names schema', /schema/i.test(make('xsd.invalid').why));
  check('bridge guidance names both sides', /both sides/i.test(make('lua_md.missing_listener').next));
  check('patch guidance names post-apply', /post-apply/i.test(make('diff.selector_missing').next));
  check('unavailable validator is not called clean', /not evidence.*clean/i.test(make('validation.md_schema_unavailable').impact));
  const fallback = make('future.unregistered', 'error');
  check('unknown code degrades honestly', /no more specific explanation/i.test(fallback.why), fallback);
  check('all explanations carry deterministic provenance', make('xsd.invalid').deterministic && make('rules.invalid_value').deterministic && fallback.deterministic);
  const passed = checks.filter(item => item.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
