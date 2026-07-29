import { getReferenceCorpus } from '../src/lib/referenceCorpus';
import { suggestReferences } from '../src/lib/referenceSuggestions';

const root = process.env.X4_REFERENCE_ROOT || './data/x4-unpacked';
const corpus = getReferenceCorpus(root, true);
const macroSourceFiles = corpus.sourceFiles.filter((file) => file.toLowerCase().endsWith('index/macros.xml'));
const requiredFactions = ['fallensplit', 'kaori', 'holyorderfanatic', 'loanshark', 'trinity'];
const checks = [
  { name: 'exact faction count', pass: corpus.factions.length === 32, detail: String(corpus.factions.length) },
  ...requiredFactions.map((id) => ({ name: `faction ${id}`, pass: corpus.factions.some((faction) => faction.id === id), detail: '' })),
  { name: 'riptide absent', pass: !corpus.factions.some((faction) => faction.id === 'riptide'), detail: '' },
  { name: 'base macro index discovered', pass: macroSourceFiles.includes('index/macros.xml'), detail: macroSourceFiles.join(', ') },
  { name: 'base ship macro indexed', pass: corpus.references.macros.has('ship_arg_l_destroyer_01_a_macro'), detail: String(corpus.references.macros.size) },
  { name: 'base station macro indexed', pass: corpus.references.macros.has('defence_arg_tube_01_macro'), detail: String(corpus.references.macros.size) },
  { name: 'DLC macro provenance preserved', pass: corpus.symbols.some((symbol) => symbol.kind === 'macro' && /^ego_dlc_/.test(symbol.source) && /^extensions\/ego_dlc_/i.test(symbol.path)), detail: String(corpus.symbols.filter((symbol) => symbol.kind === 'macro' && /^ego_dlc_/.test(symbol.source)).length) },
  { name: 'canonical jobs indexed', pass: corpus.jobs.length > 1000 && corpus.references.jobs.has('dummy_job'), detail: String(corpus.jobs.length) },
  { name: 'canonical AI scripts indexed', pass: corpus.aiScripts.length > 100 && corpus.references.aiScripts.has('boarding.pod'), detail: String(corpus.aiScripts.length) },
  { name: 'ware prefix suggestion', pass: suggestReferences(corpus, { kind: 'ware', query: 'energyc', limit: 10 })[0]?.label === 'energycells', detail: suggestReferences(corpus, { kind: 'ware', query: 'energyc', limit: 3 }).map(item => item.label).join(', ') },
];

for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` (${check.detail})` : ''}`);
console.log(`[reference-corpus-check] ${checks.filter((check) => check.pass).length}/${checks.length} PASS; sources=${corpus.sourceFiles.length} wares=${corpus.wares.length} jobs=${corpus.jobs.length} aiscripts=${corpus.aiScripts.length} sectors=${corpus.sectors.length} macros=${corpus.references.macros.size}`);
process.exit(checks.every((check) => check.pass) ? 0 : 1);
