#!/usr/bin/env tsx

import { runXsdValidateSelftest } from '../src/lib/xsdValidate';
import {
  buildScriptPropertyIndex,
  runScriptPropertiesSelftest,
  SCRIPT_PROPERTIES_FIXTURE,
} from '../src/lib/scriptProperties';
import { runExpressionSuggestSelftest } from '../src/lib/expressionSuggest';
import { runReferenceLanguageSelftest } from '../src/lib/referenceLanguage';
import { runReferenceLiteralLintSelftest } from '../src/lib/referenceLint';
import { runExpressionAstSelftest } from '../src/lib/expressionAst';
import { runProjectSymbolsSelftest } from '../src/lib/projectSymbols';
import { runDiffSimulatorSelftest } from '../src/lib/diffSimulator';
import { runReferenceOverlaySelftest } from '../src/lib/referenceOverlay';
import { runReferenceSuggestionsSelftest } from '../src/lib/referenceSuggestions';
import { runReferenceBindingsSelftest } from '../src/lib/referenceBindings';
import { runXPathCompletionSelftest } from '../src/lib/xpathCompletion';
import { runBulkCorpusTransformSelftest } from '../src/lib/bulkCorpusTransform';
import { runModDoctorReferenceSelftest } from '../src/lib/modDoctor';

const scriptPropertyIndex = buildScriptPropertyIndex(SCRIPT_PROPERTIES_FIXTURE);

const suites = [
  ['xsd-model', runXsdValidateSelftest()],
  ['scriptproperties', runScriptPropertiesSelftest()],
  ['expression-suggest', runExpressionSuggestSelftest(scriptPropertyIndex)],
  ['expression-ast', runExpressionAstSelftest()],
  ['project-symbols', runProjectSymbolsSelftest(scriptPropertyIndex)],
  ['diff-simulator', runDiffSimulatorSelftest()],
  ['reference-overlay', runReferenceOverlaySelftest()],
  ['reference-language', runReferenceLanguageSelftest()],
  ['reference-suggestions', runReferenceSuggestionsSelftest()],
  ['reference-bindings', runReferenceBindingsSelftest()],
  ['xpath-completion', runXPathCompletionSelftest()],
  ['bulk-corpus-transform', runBulkCorpusTransformSelftest()],
  ['mod-doctor-reference', runModDoctorReferenceSelftest()],
  ['reference-literals', runReferenceLiteralLintSelftest()],
] as const;

let passed = 0;
let total = 0;
for (const [name, suite] of suites) {
  passed += suite.passed;
  total += suite.total;
  console.log(`${name}: ${suite.passed}/${suite.total} ${suite.allPassed ? 'PASS' : 'FAIL'}`);
  for (const check of suite.checks) if (!check.pass) console.log(`  FAIL ${check.name}: ${'detail' in check ? check.detail || '' : ''}`);
}
console.log(`schema-intelligence: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`);
process.exit(passed === total ? 0 : 1);
