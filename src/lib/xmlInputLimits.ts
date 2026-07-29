/** Explicit project XML import budgets; large enough for real X4 files, finite for hostile input. */
export const MAX_PROJECT_XML_BYTES = 64 * 1024 * 1024;
export const MAX_PROJECT_XML_DEPTH = 256;
export const SAFE_XML_ENTITY_OPTIONS = {
  enabled: true,
  maxEntitySize: 10_000,
  maxExpansionDepth: 32,
  maxTotalExpansions: 10_000,
  maxExpandedLength: 1_000_000,
  maxEntityCount: 1_000,
};

export function assertXmlInputWithinLimits(
  xml: string,
  limits: { maxBytes?: number; maxDepth?: number } = {},
): void {
  const maxBytes = limits.maxBytes ?? MAX_PROJECT_XML_BYTES;
  const maxDepth = limits.maxDepth ?? MAX_PROJECT_XML_DEPTH;
  const bytes = new TextEncoder().encode(xml || '').byteLength;
  if (bytes > maxBytes) throw new Error(`XML input is ${bytes} bytes; the import limit is ${maxBytes} bytes.`);

  // Strip constructs that may legally contain '<' before counting actual element tags.
  const structural = (xml || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  let depth = 0;
  const tags = structural.match(/<\/?[A-Za-z_][^>]*>/g) || [];
  for (const tag of tags) {
    if (/^<\//.test(tag)) depth = Math.max(0, depth - 1);
    else {
      depth += 1;
      if (depth > maxDepth) throw new Error(`XML nesting exceeds the ${maxDepth}-element import limit.`);
      if (/\/\s*>$/.test(tag)) depth -= 1;
    }
  }
}

export function runXmlInputLimitsSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  try { assertXmlInputWithinLimits('<a><b/></a>', { maxBytes: 64, maxDepth: 2 }); ok('normal XML passes explicit budgets', true); }
  catch (error) { ok('normal XML passes explicit budgets', false, String(error)); }
  let oversized = false;
  try { assertXmlInputWithinLimits('<a>123456789</a>', { maxBytes: 8 }); } catch { oversized = true; }
  ok('oversized XML is rejected', oversized);
  let deep = false;
  try { assertXmlInputWithinLimits('<a><b><c/></b></a>', { maxDepth: 2 }); } catch { deep = true; }
  ok('deep XML is rejected', deep);
  try { assertXmlInputWithinLimits('<a><!-- <fake> --><![CDATA[<fake>]]><b/></a>', { maxDepth: 2 }); ok('comment and CDATA pseudo-tags do not count', true); }
  catch (error) { ok('comment and CDATA pseudo-tags do not count', false, String(error)); }
  return { pass: checks.every(check => check.pass), allPassed: checks.every(check => check.pass), checks };
}
