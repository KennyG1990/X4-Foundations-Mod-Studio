/** Deterministic MD/AI variable-symbol and datatype inference. */

import { resolveExpressionState } from './expressionSuggest';
import { parseExpressionChains } from './expressionAst';
import type { ScriptPropertyIndex } from './scriptProperties';

export interface ProjectVariableSymbol {
  name: string;
  type: string;
  filePath: string;
  line: number;
  sourceTag: string;
  confidence: 'schema' | 'expression' | 'name';
}

export interface ProjectSymbolIndex {
  variables: ProjectVariableSymbol[];
  byFile: Map<string, Map<string, string>>;
  variableTypesFor(filePath: string): Record<string, string>;
}

const TAG_RE = /<([A-Za-z_][\w.-]*)\b([^<>]*?)\/?\s*>/g;
const ATTR_RE = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function normalizedVariable(raw: string): string | null {
  const match = /^\$?([A-Za-z_][\w]*)$/.exec(String(raw || '').trim());
  return match ? `$${match[1]}` : null;
}

function attributesOf(raw: string): Map<string, string> {
  const attrs = new Map<string, string>();
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(raw)) !== null) attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? '');
  return attrs;
}

function tagDatatype(tag: string, available: Set<string>): string | null {
  const normalized = tag.toLowerCase().replace(/^(?:find|create|get|select)_/, '');
  const candidates = [
    normalized,
    normalized.replace(/s$/, ''),
    normalized.split('_')[0],
    normalized.includes('station') ? 'station' : '',
    normalized.includes('ship') ? 'ship' : '',
    normalized.includes('faction') ? 'faction' : '',
    normalized.includes('sector') ? 'sector' : '',
    normalized.includes('object') ? 'object' : '',
    normalized.includes('component') ? 'component' : '',
  ].filter(Boolean);
  return candidates.find(candidate => available.has(candidate)) || null;
}

function inferredExpressionType(expression: string, index: ScriptPropertyIndex, variableTypes: Record<string, string>): string | null {
  const value = expression.trim();
  if (/^(?:true|false)$/i.test(value)) return index.model.datatypes.has('boolean') ? 'boolean' : null;
  if (/^-?\d+(?:\.\d+)?[f]?$/i.test(value)) return index.model.datatypes.has('number') ? 'number' : index.model.datatypes.has('integer') ? 'integer' : null;
  if (/^'[^']*'$/.test(value)) return index.model.datatypes.has('string') ? 'string' : null;
  const direct = variableTypes[value] || variableTypes[value.toLowerCase()];
  if (direct) return direct;
  const chains = parseExpressionChains(value);
  const chain = chains.find(candidate => candidate.start === 0 && candidate.end === value.length);
  if (!chain) return null;
  const state = resolveExpressionState(`${value}.`, value.length + 1, index, { variableTypes });
  return state?.valid && state.datatype ? state.datatype : null;
}

export function buildProjectSymbols(
  files: Array<{ path: string; content?: string }>,
  index: ScriptPropertyIndex,
): ProjectSymbolIndex {
  const variables: ProjectVariableSymbol[] = [];
  const byFile = new Map<string, Map<string, string>>();
  const available = new Set(index.model.datatypes.keys());
  for (const file of files) {
    if (typeof file.content !== 'string') continue;
    const symbols = new Map<string, string>();
    byFile.set(file.path, symbols);
    const pending: Array<{ name: string; expression: string; line: number; tag: string }> = [];
    TAG_RE.lastIndex = 0;
    let line = 1;
    let lastOffset = 0;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = TAG_RE.exec(file.content)) !== null) {
      for (let offset = lastOffset; offset < tagMatch.index; offset++) if (file.content.charCodeAt(offset) === 10) line++;
      const tagLine = line;
      for (let offset = tagMatch.index; offset < TAG_RE.lastIndex; offset++) if (file.content.charCodeAt(offset) === 10) line++;
      lastOffset = TAG_RE.lastIndex;
      const tag = tagMatch[1].toLowerCase();
      const attrs = attributesOf(tagMatch[2]);
      const name = normalizedVariable(attrs.get('name') || '');
      if (!name) continue;
      const exact = attrs.get('exact') || attrs.get('value') || attrs.get('default');
      if ((tag === 'set_value' || tag === 'add_value' || tag === 'param') && exact) {
        pending.push({ name, expression: exact, line: tagLine, tag });
        continue;
      }
      if (/^(?:find|create|get|select)_/.test(tag)) {
        const type = tagDatatype(tag, available);
        if (type) {
          symbols.set(name, type);
          variables.push({ name, type, filePath: file.path, line: tagLine, sourceTag: tag, confidence: 'schema' });
        }
      }
    }
    // Resolve assignments repeatedly so `$owner = $ship.owner` can consume a type
    // learned from an earlier declaration without constructing a control-flow graph.
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      const variableTypes = Object.fromEntries([...symbols].flatMap(([name, type]) => [[name, type], [name.slice(1).toLowerCase(), type]]));
      for (const assignment of pending) {
        const type = inferredExpressionType(assignment.expression, index, variableTypes);
        if (!type || symbols.get(assignment.name) === type) continue;
        symbols.set(assignment.name, type); changed = true;
        const existing = variables.find(symbol => symbol.filePath === file.path && symbol.name === assignment.name);
        const next = { name: assignment.name, type, filePath: file.path, line: assignment.line, sourceTag: assignment.tag, confidence: 'expression' as const };
        if (existing) Object.assign(existing, next); else variables.push(next);
      }
      if (!changed) break;
    }
  }
  return {
    variables,
    byFile,
    variableTypesFor(filePath: string) {
      const local = byFile.get(filePath) || new Map();
      return Object.fromEntries([...local].flatMap(([name, type]) => [[name, type], [name.slice(1).toLowerCase(), type], [name.toLowerCase(), type]]));
    },
  };
}

export function runProjectSymbolsSelftest(index: ScriptPropertyIndex) {
  const files = [{ path: 'md/test.xml', content: `<actions>
    <find_ship name="$target"/>
    <set_value name="$targetname" exact="$target.name"/>
    <set_value name="$fac" exact="faction.argon"/>
  </actions>` }];
  const result = buildProjectSymbols(files, index);
  const types = result.variableTypesFor('md/test.xml');
  const checks = [
    { name: 'find_ship_declares_ship', pass: types.$target === 'ship' },
    { name: 'typed_return_infers_assignment', pass: types.$targetname === 'string' },
    { name: 'dynamic_keyword_infers_faction', pass: types.$fac === 'faction' },
    { name: 'symbols_have_source_spans', pass: result.variables.every(symbol => symbol.line > 0 && !!symbol.sourceTag) },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
