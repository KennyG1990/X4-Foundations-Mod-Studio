/** Span-preserving AST for the X4 MD/AI dotted expression-chain subset. */

export type ExpressionSegmentKind = 'root' | 'property' | 'variable-selector' | 'dynamic-selector' | 'list-selector';

export interface ExpressionSegmentAst {
  kind: ExpressionSegmentKind;
  raw: string;
  name: string;
  start: number;
  end: number;
  optional: boolean;
}

export interface ExpressionChainAst {
  kind: 'chain';
  raw: string;
  start: number;
  end: number;
  root: ExpressionSegmentAst;
  segments: ExpressionSegmentAst[];
}

const CHAIN_RE = /(@?)(\$[A-Za-z_]\w*|[A-Za-z_]\w*)((?:\.(?:\$[A-Za-z_]\w*|\{[^}\n]*\}|\[[^\]\n]*\]|[A-Za-z_]\w*\??))+)/g;
const SEGMENT_RE = /\.(\$[A-Za-z_]\w*|\{[^}\n]*\}|\[[^\]\n]*\]|[A-Za-z_]\w*\??)/g;

function segmentKind(raw: string): ExpressionSegmentKind {
  if (raw.startsWith('$')) return 'variable-selector';
  if (raw.startsWith('{')) return 'dynamic-selector';
  if (raw.startsWith('[')) return 'list-selector';
  return 'property';
}

export function parseExpressionChains(textInput: string): ExpressionChainAst[] {
  const text = String(textInput || '');
  const chains: ExpressionChainAst[] = [];
  CHAIN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHAIN_RE.exec(text)) !== null) {
    const rootStart = match.index + match[1].length;
    const rootRaw = match[2];
    const segments: ExpressionSegmentAst[] = [];
    SEGMENT_RE.lastIndex = 0;
    let segment: RegExpExecArray | null;
    while ((segment = SEGMENT_RE.exec(match[3])) !== null) {
      const raw = segment[1];
      const start = rootStart + rootRaw.length + segment.index + 1;
      segments.push({
        kind: segmentKind(raw), raw, name: raw.replace(/\?$/, '').toLowerCase(),
        start, end: start + raw.length, optional: raw.endsWith('?'),
      });
    }
    chains.push({
      kind: 'chain', raw: match[0], start: match.index, end: CHAIN_RE.lastIndex,
      root: { kind: 'root', raw: rootRaw, name: rootRaw.replace(/^\$/, '').toLowerCase(), start: rootStart, end: rootStart + rootRaw.length, optional: false },
      segments,
    });
  }
  return chains;
}

export function expressionChainAt(text: string, offset: number): ExpressionChainAst | null {
  return parseExpressionChains(text).find(chain => offset >= chain.start && offset <= chain.end) || null;
}

export function runExpressionAstSelftest() {
  const checks: Array<{ name: string; pass: boolean }> = [];
  const ok = (name: string, pass: boolean) => checks.push({ name, pass });
  const text = `<do_if value="$ship.owner.relationto.{faction.argon} and $list.[$index].exists?"/>`;
  const chains = parseExpressionChains(text);
  ok('two_chains_parsed', chains.length === 2);
  ok('root_span_exact', text.slice(chains[0].root.start, chains[0].root.end) === '$ship');
  ok('properties_preserve_order', chains[0].segments.slice(0, 2).map(segment => segment.name).join(',') === 'owner,relationto');
  ok('dynamic_selector_classified', chains[0].segments[2]?.kind === 'dynamic-selector');
  ok('list_selector_classified', chains[1].segments[0]?.kind === 'list-selector');
  ok('optional_property_retained', chains[1].segments[1]?.optional === true && chains[1].segments[1]?.name === 'exists');
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}

