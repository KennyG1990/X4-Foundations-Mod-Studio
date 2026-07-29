/**
 * Byte/character spans for XML elements without reserializing the document.
 * Offsets index the original JavaScript string, so slicing preserves every byte
 * (for UTF-8 ASCII markup boundaries) outside the edited element exactly.
 */
export interface XmlElementSourceSpan {
  path: string;
  tag: string;
  start: number;
  end: number;
}

interface OpenElement extends XmlElementSourceSpan {
  childCounts: Map<string, number>;
}

function tokenEnd(xml: string, start: number): number {
  let quote = '';
  for (let i = start + 1; i < xml.length; i++) {
    const ch = xml[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return i + 1;
  }
  return xml.length;
}

export function indexXmlElementSpans(xml: string): Map<string, XmlElementSourceSpan> {
  const spans = new Map<string, XmlElementSourceSpan>();
  const stack: OpenElement[] = [];
  let cursor = 0;
  while (cursor < xml.length) {
    const start = xml.indexOf('<', cursor);
    if (start < 0) break;
    if (xml.startsWith('<!--', start)) {
      const end = xml.indexOf('-->', start + 4);
      cursor = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', start)) {
      const end = xml.indexOf(']]>', start + 9);
      cursor = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<?', start)) {
      const end = xml.indexOf('?>', start + 2);
      cursor = end < 0 ? xml.length : end + 2;
      continue;
    }
    if (xml.startsWith('<!', start)) {
      cursor = tokenEnd(xml, start);
      continue;
    }
    const end = tokenEnd(xml, start);
    const token = xml.slice(start, end);
    const close = token.match(/^<\s*\/\s*([A-Za-z_][\w:.-]*)/);
    if (close) {
      const tag = close[1];
      let index = stack.length - 1;
      while (index >= 0 && stack[index].tag !== tag) index--;
      if (index >= 0) {
        const open = stack[index];
        stack.length = index;
        const completed = { path: open.path, tag: open.tag, start: open.start, end };
        spans.set(open.path, completed);
      }
      cursor = end;
      continue;
    }
    const open = token.match(/^<\s*([A-Za-z_][\w:.-]*)/);
    if (!open) {
      cursor = end;
      continue;
    }
    const tag = open[1];
    const parent = stack[stack.length - 1];
    const ordinal = parent ? (parent.childCounts.get(tag) || 0) : 0;
    if (parent) parent.childCounts.set(tag, ordinal + 1);
    const path = parent ? `${parent.path}/${tag}[${ordinal}]` : `${tag}[0]`;
    const entry: OpenElement = { path, tag, start, end, childCounts: new Map() };
    if (/\/\s*>$/.test(token)) spans.set(path, { path, tag, start, end });
    else stack.push(entry);
    cursor = end;
  }
  return spans;
}

export function xmlElementSemanticPath(element: Element): string {
  const parts: string[] = [];
  let cursor: Element | null = element;
  while (cursor) {
    let ordinal = 0;
    const parent = cursor.parentElement;
    if (parent) {
      for (const sibling of Array.from((parent as any).childNodes || []) as any[]) {
        if (sibling === cursor) break;
        if (sibling?.nodeType === 1 && sibling.tagName === cursor.tagName) ordinal++;
      }
    }
    parts.push(`${cursor.tagName}[${ordinal}]`);
    cursor = parent;
  }
  return parts.reverse().join('/');
}

export function runXmlSourceSpanSelftest(): { allPassed: boolean; passed: number; total: number; checks: Array<{ name: string; pass: boolean }> } {
  const xml = `<?xml version="1.0"?><mdscript><cues><!-- before --><cue name="A"><actions><set_value name="$a" exact="1" /></actions></cue><cue name="AA"><actions><do_if value="$x"><set_value name="$b" exact="2" /></do_if></actions></cue></cues></mdscript>`;
  const spans = indexXmlElementSpans(xml);
  const checks = [
    { name: 'cue_substring_names_have_distinct_spans', pass: spans.has('mdscript[0]/cues[0]/cue[0]') && spans.has('mdscript[0]/cues[0]/cue[1]') },
    { name: 'self_closing_action_exact', pass: xml.slice(spans.get('mdscript[0]/cues[0]/cue[0]/actions[0]/set_value[0]')!.start, spans.get('mdscript[0]/cues[0]/cue[0]/actions[0]/set_value[0]')!.end) === '<set_value name="$a" exact="1" />' },
    { name: 'nested_action_span_exact', pass: xml.slice(spans.get('mdscript[0]/cues[0]/cue[1]/actions[0]/do_if[0]')!.start, spans.get('mdscript[0]/cues[0]/cue[1]/actions[0]/do_if[0]')!.end).startsWith('<do_if') },
    { name: 'comment_does_not_shift_identity', pass: spans.get('mdscript[0]/cues[0]/cue[0]')!.start === xml.indexOf('<cue name="A">') },
  ];
  return { allPassed: checks.every(check => check.pass), passed: checks.filter(check => check.pass).length, total: checks.length, checks };
}
