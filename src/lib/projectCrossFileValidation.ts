/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P5 - project-level cross-file validation.
 *
 * The P0 project model can already answer "does this signal_cue resolve across
 * files?" This layer adds the next contract: MD <-> Lua event wiring and
 * content.xml dependency diagnostics over the same ExtensionProject envelope.
 */

import {
  addFile,
  buildContentXml,
  classifyPath,
  createProject,
  indexCueReferences,
  validateProjectStructure,
  type ExtensionProject,
} from './extensionProject';
import { parseModManifest, type ModDependency, type ModManifest } from './modDependencyGraph';
import { classifyCueRef } from './cueLineage';
import { normPath } from './xmlLite';
import { parse } from 'luaparse';
import { DOMParser } from '@xmldom/xmldom';
import { stripLuaComments } from './luaStaticAnalysis';

export type ProjectCrossFileFindingCode =
  | 'project.structure'
  | 'cue.unresolved'
  | 'md_lua.missing_register'
  | 'lua_md.missing_listener'
  | 'md_lua.payload_collision'
  | 'md_lua.payload_missing_writer'
  | 'md_lua.payload_unused_writer'
  | 'dep.missing_content_xml'
  | 'dep.duplicate'
  | 'dep.self'
  | 'md.signal_library'
  | 'md.run_actions_nonlibrary';

export interface ProjectCrossFileFinding {
  code: ProjectCrossFileFindingCode;
  severity: 'error' | 'warning' | 'info';
  file?: string;
  event?: string;
  dependencyId?: string;
  detail: string;
}

export interface ProjectEventRef {
  event: string;
  file: string;
  /**
   * True when the Lua event name is built dynamically (string concatenation, e.g.
   * `RegisterEvent(NS .. suffix, …)` / `"log_" .. category`) — `event` is then the
   * literal PREFIX, and matching must be prefix-based, not exact (ROADMAP AAR item #2).
   */
  prefix?: boolean;
}

export interface ProjectUiEventRef {
  namespace: string;
  control: string;
  event: string;
  file: string;
  /** True when the control name is dynamic (concat / trailing underscore) — see ProjectEventRef.prefix. */
  prefix?: boolean;
}

export interface ProjectCrossFileValidationResult {
  ok: boolean;
  summary: {
    files: number;
    findings: number;
    errors: number;
    structuralErrors: number;
    unresolvedCueRefs: number;
    mdLuaMissingRegisters: number;
    luaMdMissingListeners: number;
    payloadContractErrors: number;
    dependencies: number;
  };
  findings: ProjectCrossFileFinding[];
  cueIndex: ReturnType<typeof indexCueReferences>;
  mdLua: {
    raised: ProjectEventRef[];
    registered: ProjectEventRef[];
    emitted: ProjectUiEventRef[];
    listened: ProjectUiEventRef[];
    missingRegisters: ProjectEventRef[];
    missingListeners: ProjectUiEventRef[];
    payload: {
      reads: Array<{ key: string; scope: 'global' | 'verb'; file: string; destination: string; branch?: string }>;
      writes: Array<{ key: string; file: string }>;
    };
  };
  deps: {
    manifest: ModManifest | null;
    dependencies: ModDependency[];
  };
}

// normPath: shared via xmlLite (audit R2).

function stripMdLiteral(value: string | undefined): string {
  const raw = String(value || '').trim();
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function parseAttr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1];
}

function parseMdRaisedLuaEvents(content: string, file: string): ProjectEventRef[] {
  const out: ProjectEventRef[] = [];
  const re = /<raise_lua_event\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content || '')) !== null) {
    const event = stripMdLiteral(parseAttr(m[0], 'name'));
    if (event) out.push({ event, file });
  }
  return out;
}

function parseMdUiListeners(content: string, file: string): ProjectUiEventRef[] {
  const out: ProjectUiEventRef[] = [];
  const re = /<event_ui_triggered\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content || '')) !== null) {
    const namespace = stripMdLiteral(parseAttr(m[0], 'screen'));
    const control = stripMdLiteral(parseAttr(m[0], 'control'));
    if (namespace && control) out.push({ namespace, control, event: `${namespace}.${control}`, file });
  }
  return out;
}

function parseLuaLocalStrings(content: string): Map<string, string> {
  const vars = new Map<string, string>();
  const re = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content || '')) !== null) vars.set(m[1], m[2]);
  return vars;
}

/** True when the source right after `endIndex` continues with a Lua `..` concatenation. */
function continuesWithConcat(content: string, endIndex: number): boolean {
  return /^\s*\.\./.test((content || '').slice(endIndex, endIndex + 8));
}

function walkLuaAst(node: any, visit: (node: any) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range' || key === 'comments' || key === 'tokens' || key === 'globals') continue;
    if (Array.isArray(value)) value.forEach(item => walkLuaAst(item, visit));
    else if (value && typeof value === 'object') walkLuaAst(value, visit);
  }
}

function luaIdentifier(node: any): string | null {
  return node?.type === 'Identifier' && typeof node.name === 'string' ? node.name : null;
}

function luaStringPrefix(node: any, strings: Map<string, string>): { value: string; prefix: boolean } | null {
  if (!node) return null;
  if (node.type === 'StringLiteral' && typeof node.value === 'string') return { value: node.value, prefix: false };
  if (node.type === 'Identifier') {
    const value = strings.get(node.name);
    return value === undefined ? null : { value, prefix: false };
  }
  if (node.type === 'BinaryExpression' && node.operator === '..') {
    const left = luaStringPrefix(node.left, strings);
    if (!left) return null;
    const right = luaStringPrefix(node.right, strings);
    return right
      ? { value: left.value + right.value, prefix: left.prefix || right.prefix }
      : { value: left.value, prefix: true };
  }
  return null;
}

function parseLuaRegisteredEvents(content: string, file: string): ProjectEventRef[] {
  let ast: any;
  try {
    ast = parse(content || '', { comments: false, locations: true, ranges: true, scope: true, luaVersion: '5.2', encodingMode: 'pseudo-latin1' });
  } catch {
    return [];
  }

  const strings = new Map<string, string>();
  const registrars = new Set<string>(['RegisterEvent']);
  walkLuaAst(ast, node => {
    if (node.type !== 'LocalStatement' && node.type !== 'AssignmentStatement') return;
    (node.variables || []).forEach((variable: any, index: number) => {
      const name = luaIdentifier(variable);
      const init = (node.init || [])[index];
      if (!name || !init) return;
      if (init.type === 'StringLiteral' && typeof init.value === 'string') strings.set(name, init.value);
      const sourceName = luaIdentifier(init);
      if (sourceName && registrars.has(sourceName)) registrars.add(name);
    });
  });

  // Simple wrappers are common and deterministic: local function reg(event, fn)
  // RegisterEvent(event, fn) end. Record which wrapper parameter becomes the event name.
  const wrappers = new Map<string, number>();
  walkLuaAst(ast, node => {
    if (node.type !== 'FunctionDeclaration') return;
    const wrapperName = luaIdentifier(node.identifier);
    if (!wrapperName) return;
    const params = (node.parameters || []).map(luaIdentifier);
    walkLuaAst(node.body || [], child => {
      if (child.type !== 'CallExpression' || !registrars.has(luaIdentifier(child.base) || '')) return;
      const eventParam = luaIdentifier((child.arguments || [])[0]);
      const index = params.indexOf(eventParam);
      if (index >= 0) wrappers.set(wrapperName, index);
    });
  });

  const out: ProjectEventRef[] = [];
  const seen = new Set<string>();
  walkLuaAst(ast, node => {
    if (node.type !== 'CallExpression') return;
    const callee = luaIdentifier(node.base);
    if (!callee) return;
    const argIndex = registrars.has(callee) ? 0 : wrappers.get(callee);
    if (argIndex === undefined) return;
    const value = luaStringPrefix((node.arguments || [])[argIndex], strings);
    if (!value?.value) return;
    const key = `${value.value}\0${value.prefix}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ event: value.value, file, ...(value.prefix ? { prefix: true } : {}) });
  });
  return out;
}

interface PayloadReadSite { file: string; destination: string; branch?: string }
interface PayloadWriteSite { file: string }

/** Port of the observed x4_ai_influence wiregate invariant, scoped to its exact protocol shapes. */
function validateIndexedPayloadContract(mdFiles: ExtensionProject['files'], luaFiles: ExtensionProject['files']): {
  findings: ProjectCrossFileFinding[];
  reads: Array<{ key: string; scope: 'global' | 'verb'; file: string; destination: string; branch?: string }>;
  writes: Array<{ key: string; file: string }>;
} {
  const reads = new Map<string, { global: PayloadReadSite[]; verb: PayloadReadSite[] }>();
  const writes = new Map<string, PayloadWriteSite[]>();
  const readPattern = /param3\.\{'\$([A-Za-z][A-Za-z0-9_]*)'\s*\+\s*\$si\}/g;
  const writePattern = /payload\[\s*["']([A-Za-z][A-Za-z0-9_]*)["']\s*\.\.\s*payload\.n\s*\]/g;

  for (const file of luaFiles) {
    const code = stripLuaComments(file.content || '');
    let match: RegExpExecArray | null;
    while ((match = writePattern.exec(code)) !== null) {
      const sites = writes.get(match[1]) || [];
      sites.push({ file: file.path });
      writes.set(match[1], sites);
    }
  }
  for (const file of mdFiles) {
    if (!(file.content || '').includes('param3')) continue;
    let doc: Document;
    try { doc = new DOMParser().parseFromString(file.content || '', 'text/xml') as unknown as Document; }
    catch { continue; }
    const elements = Array.from(doc.getElementsByTagName('*')) as Element[];
    for (const element of elements) {
      const attrs = Array.from(element.attributes || []);
      for (const attr of attrs) {
        let match: RegExpExecArray | null;
        readPattern.lastIndex = 0;
        while ((match = readPattern.exec(attr.value || '')) !== null) {
          let branch: string | undefined;
          let parent = element.parentNode as Element | null;
          while (parent) {
            if (parent.nodeType === 1 && (parent.tagName === 'do_if' || parent.tagName === 'do_elseif') && /\$sv\s*==/.test(parent.getAttribute('value') || '')) {
              branch = parent.getAttribute('value') || undefined;
              break;
            }
            parent = parent.parentNode as Element | null;
          }
          const bucket = reads.get(match[1]) || { global: [], verb: [] };
          bucket[branch ? 'verb' : 'global'].push({ file: file.path, destination: element.getAttribute('name') || `<${element.tagName}>`, ...(branch ? { branch } : {}) });
          reads.set(match[1], bucket);
        }
      }
    }
  }

  // Do not infer a protocol from a generic use of `payload` or `param3`; at least one exact
  // indexed key shape must exist somewhere in the project.
  if (reads.size === 0 && writes.size === 0) return { findings: [], reads: [], writes: [] };
  const findings: ProjectCrossFileFinding[] = [];
  for (const key of new Set([...reads.keys(), ...writes.keys()])) {
    const read = reads.get(key) || { global: [], verb: [] };
    const write = writes.get(key) || [];
    if (read.global.length && read.verb.length) {
      findings.push({
        code: 'md_lua.payload_collision', severity: 'error', file: read.verb[0].file,
        detail: `Indexed payload key "${key}<n>" is read globally (${read.global.map(site => site.destination).join(', ')}) and inside a verb branch (${read.verb.map(site => site.destination).join(', ')}). A global slot belongs to every step and cannot be reused by one verb.`,
      });
    }
    if ((read.global.length || read.verb.length) && !write.length) {
      findings.push({
        code: 'md_lua.payload_missing_writer', severity: 'error', file: [...read.global, ...read.verb][0].file,
        detail: `MD reads indexed payload key "${key}<n>", but no project Lua file writes payload["${key}" .. payload.n].`,
      });
    }
    if (write.length && !(read.global.length || read.verb.length)) {
      findings.push({
        code: 'md_lua.payload_unused_writer', severity: 'error', file: write[0].file,
        detail: `Lua writes indexed payload key "${key}<n>", but no project MD file reads param3.{'$${key}' + $si}.`,
      });
    }
  }
  return {
    findings,
    reads: [...reads.entries()].flatMap(([key, sites]) => [
      ...sites.global.map(site => ({ key, scope: 'global' as const, ...site })),
      ...sites.verb.map(site => ({ key, scope: 'verb' as const, ...site })),
    ]),
    writes: [...writes.entries()].flatMap(([key, sites]) => sites.map(site => ({ key, ...site }))),
  };
}

function parseLuaUiEmits(content: string, file: string): ProjectUiEventRef[] {
  const out: ProjectUiEventRef[] = [];
  const vars = parseLuaLocalStrings(content);
  const arg = `(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))`;
  const re = new RegExp(`\\bAddUITriggeredEvent\\s*\\(\\s*${arg}\\s*,\\s*${arg}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content || '')) !== null) {
    const namespace = m[1] || m[2] || vars.get(m[3] || '') || '';
    const control = m[4] || m[5] || vars.get(m[6] || '') || '';
    // Dynamic control name: literal followed by `..` concat (e.g. "log_" .. category),
    // or a trailing-underscore literal — the literal is only the event-name PREFIX.
    const prefix = (continuesWithConcat(content, re.lastIndex) || /_$/.test(control)) || undefined;
    if (namespace && control) out.push({ namespace, control, event: `${namespace}.${control}`, file, ...(prefix ? { prefix } : {}) });
  }
  return out;
}

function findContentManifest(project: ExtensionProject): ModManifest | null {
  const content = (project.files || []).find(f => normPath(f.path).toLowerCase() === 'content.xml');
  return content ? parseModManifest(project.id || 'project', content.content || '') : null;
}

export function validateProjectCrossFile(project: ExtensionProject): ProjectCrossFileValidationResult {
  const files = Array.isArray(project?.files) ? project.files : [];
  const structure = validateProjectStructure(project);
  const cueIndex = indexCueReferences(project);
  const findings: ProjectCrossFileFinding[] = [];

  for (const issue of structure) {
    findings.push({
      code: 'project.structure',
      severity: issue.severity,
      file: issue.path,
      detail: issue.detail,
    });
  }
  for (const ref of cueIndex.unresolved) {
    findings.push({
      code: 'cue.unresolved',
      severity: 'error',
      file: ref.file,
      detail: `Unresolved cue reference "${ref.ref}".`,
    });
  }

  const mdFiles = files.filter(f => f.kind === 'md' || classifyPath(f.path) === 'md');
  const luaFiles = files.filter(f => f.kind === 'lua' || f.kind === 'ui' || classifyPath(f.path) === 'lua');
  const raised = mdFiles.flatMap(f => parseMdRaisedLuaEvents(f.content || '', f.path));
  const listened = mdFiles.flatMap(f => parseMdUiListeners(f.content || '', f.path));
  const registered = luaFiles.flatMap(f => parseLuaRegisteredEvents(f.content || '', f.path));
  const emitted = luaFiles.flatMap(f => parseLuaUiEmits(f.content || '', f.path));
  const payload = validateIndexedPayloadContract(mdFiles, luaFiles);
  findings.push(...payload.findings);

  const registeredEvents = new Set(registered.map(r => r.event));
  const listenedEvents = new Set(listened.map(r => r.event));
  // Dynamic (concat-built) names match by PREFIX: `RegisterEvent(NS .. x)` with literal
  // prefix "ai_influence." satisfies any raised event starting with it, and a dynamic
  // emit "ai_influence.log_" is satisfied by ANY MD listener with that prefix
  // (ROADMAP AAR #2: aic_uix.lua `log_<category>` false-positived the exact match).
  const registeredPrefixes = registered.filter(r => r.prefix).map(r => r.event);
  const listenedList = [...listenedEvents];
  const missingRegisters = raised.filter(r => !registeredEvents.has(r.event)
    && !registeredPrefixes.some(p => r.event.startsWith(p)));
  const missingListeners = emitted.filter(r => r.prefix
    ? !listenedList.some(e => e.startsWith(r.event))
    : !listenedEvents.has(r.event));

  for (const event of missingRegisters) {
    findings.push({
      code: 'md_lua.missing_register',
      severity: 'error',
      file: event.file,
      event: event.event,
      detail: `MD raises Lua event "${event.event}" but no project Lua file registers it.`,
    });
  }
  for (const event of missingListeners) {
    findings.push({
      code: 'lua_md.missing_listener',
      // A dynamic (prefix) emit with no matching listener is suspicious but can be
      // legitimately handled by fully-dynamic listeners the static scan can't see —
      // warning, not error (honest per the determinism-scope doctrine).
      severity: event.prefix ? 'warning' : 'error',
      file: event.file,
      event: event.event,
      detail: event.prefix
        ? `Lua emits dynamically-named UI events with prefix "${event.event}…" but no project MD file listens for any event with that prefix.`
        : `Lua emits UI event "${event.event}" but no project MD file listens for it.`,
    });
  }

  const manifest = findContentManifest(project);
  if (!manifest) {
    findings.push({
      code: 'dep.missing_content_xml',
      severity: 'error',
      file: 'content.xml',
      detail: 'No parseable content.xml manifest is present.',
    });
  } else {
    const seen = new Set<string>();
    for (const dep of manifest.deps) {
      const key = dep.id.toLowerCase();
      if (key === manifest.id.toLowerCase()) {
        findings.push({
          code: 'dep.self',
          severity: 'error',
          file: 'content.xml',
          dependencyId: dep.id,
          detail: `content.xml declares a dependency on itself (${dep.id}).`,
        });
      }
      if (seen.has(key)) {
        findings.push({
          code: 'dep.duplicate',
          severity: 'warning',
          file: 'content.xml',
          dependencyId: dep.id,
          detail: `content.xml declares dependency "${dep.id}" more than once.`,
        });
      }
      seen.add(key);
    }
  }

  // X4 engine semantic the XSD can't express: you SIGNAL cues, you RUN_ACTIONS libraries.
  // signal_cue / signal_cue_instantly aimed at a <library> errors in-game ("Signalled cue …
  // has no corresponding library"); run_actions aimed at a non-library cue is also wrong.
  {
    const kindByQName = new Map<string, 'library' | 'cue'>();
    for (const f of mdFiles) {
      const script = (f.content!.match(/<mdscript\b[^>]*\bname\s*=\s*"([^"]+)"/i)?.[1] || '').toLowerCase();
      const re = /<(cue|library)\b[^>]*\bname\s*=\s*"([^"]+)"/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.content!)) !== null) {
        kindByQName.set(`${script}.${m[2].toLowerCase()}`, m[1].toLowerCase() === 'library' ? 'library' : 'cue');
      }
    }
    // ONE classifier for all resolvers (audit A2).
    const qnameOf = (ref: string, ownScript: string): string | null => {
      const c = classifyCueRef(ref);
      if (c.kind === 'cross') return `${c.script.toLowerCase()}.${c.cue.toLowerCase()}`;
      if (c.kind === 'local') return `${ownScript.toLowerCase()}.${c.cue.toLowerCase()}`;
      return null; // keyword/external → can't resolve statically; don't flag
    };
    for (const f of mdFiles) {
      const ownScript = f.content!.match(/<mdscript\b[^>]*\bname\s*=\s*"([^"]+)"/i)?.[1] || '';
      let m: RegExpExecArray | null;
      const sigRe = /<signal_cue(?:_instantly)?\b[^>]*\bcue\s*=\s*"([^"]+)"/gi;
      while ((m = sigRe.exec(f.content!)) !== null) {
        if (kindByQName.get(qnameOf(m[1], ownScript) || '') === 'library') {
          findings.push({ code: 'md.signal_library', severity: 'error', file: f.path,
            detail: `signal_cue targets the <library> "${m[1]}". Libraries are invoked via <run_actions ref="…"> (with purpose="run_actions"), not signalled — X4 errors with "Signalled cue … has no corresponding library".` });
        }
      }
      const raRe = /<run_actions\b[^>]*\bref\s*=\s*"([^"]+)"/gi;
      while ((m = raRe.exec(f.content!)) !== null) {
        if (kindByQName.get(qnameOf(m[1], ownScript) || '') === 'cue') {
          findings.push({ code: 'md.run_actions_nonlibrary', severity: 'warning', file: f.path,
            detail: `run_actions ref "${m[1]}" resolves to a <cue>, not a <library>. <run_actions> targets a library declared with purpose="run_actions".` });
        }
      }
    }
  }

  const errors = findings.filter(f => f.severity === 'error').length;
  return {
    ok: errors === 0,
    summary: {
      files: files.length,
      findings: findings.length,
      errors,
      structuralErrors: structure.filter(i => i.severity === 'error').length,
      unresolvedCueRefs: cueIndex.unresolved.length,
      mdLuaMissingRegisters: missingRegisters.length,
      luaMdMissingListeners: missingListeners.length,
      payloadContractErrors: payload.findings.filter(f => f.severity === 'error').length,
      dependencies: manifest?.deps.length || 0,
    },
    findings,
    cueIndex,
    mdLua: { raised, registered, emitted, listened, missingRegisters, missingListeners, payload: { reads: payload.reads, writes: payload.writes } },
    deps: { manifest, dependencies: manifest?.deps || [] },
  };
}

function fixtureProject(): ExtensionProject {
  let project = createProject('ai_influence', 'AI Influence');
  project = addFile(project, {
    path: 'content.xml',
    kind: 'content',
    content: buildContentXml({
      id: 'ai_influence',
      name: 'AI Influence',
      deps: [{ id: 'djfhe_http', optional: true }],
    }),
  });
  project = addFile(project, {
    path: 'md/main.xml',
    kind: 'md',
    content: `<mdscript name="Main"><cues><cue name="Start"><actions><run_actions ref="md.Contract.Call_chat" /></actions></cue></cues></mdscript>`,
  });
  project = addFile(project, {
    path: 'md/contract.xml',
    kind: 'md',
    content: `<mdscript name="Contract"><cues>
      <library name="Call_chat" purpose="run_actions"><actions><raise_lua_event name="'ai_influence.chat'" param="table[prompt=$prompt]" /></actions></library>
      <cue name="On_chat_response"><conditions><event_ui_triggered screen="'ai_influence'" control="'chat.response'" /></conditions></cue>
    </cues></mdscript>`,
  });
  project = addFile(project, {
    path: 'ui/chat.lua',
    kind: 'lua',
    content: `local NS = "ai_influence"
RegisterEvent("ai_influence.chat", function(_, payload) end)
AddUITriggeredEvent(NS, "chat.response", { reply = "ok" })`,
  });
  return project;
}

export function runProjectCrossFileSelftest() {
  const checks: { name: string; pass: boolean; detail?: unknown }[] = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, detail });

  const good = validateProjectCrossFile(fixtureProject());
  ok('valid_project_has_no_errors', good.ok, good.findings);
  ok('indexes_md_to_lua_raise_and_register', good.mdLua.raised.some(e => e.event === 'ai_influence.chat') && good.mdLua.registered.some(e => e.event === 'ai_influence.chat'), good.mdLua);
  ok('indexes_lua_to_md_emit_and_listener', good.mdLua.emitted.some(e => e.event === 'ai_influence.chat.response') && good.mdLua.listened.some(e => e.event === 'ai_influence.chat.response'), good.mdLua);
  ok('reports_content_dependencies', good.deps.dependencies.some(d => d.id === 'djfhe_http' && d.optional), good.deps);

  const noLuaRegister: ExtensionProject = {
    ...fixtureProject(),
    files: fixtureProject().files.map(f => f.path === 'ui/chat.lua' ? { ...f, content: 'local NS = "ai_influence"\nAddUITriggeredEvent(NS, "chat.response", {})' } : f),
  };
  const missingRegister = validateProjectCrossFile(noLuaRegister);
  ok('flags_md_raise_without_lua_register', !missingRegister.ok && missingRegister.findings.some(f => f.code === 'md_lua.missing_register' && f.event === 'ai_influence.chat'), missingRegister.findings);

  const noMdListener: ExtensionProject = {
    ...fixtureProject(),
    files: fixtureProject().files.map(f => f.path === 'md/contract.xml' ? { ...f, content: f.content!.replace(/<cue name="On_chat_response">[\s\S]*?<\/cue>/, '') } : f),
  };
  const missingListener = validateProjectCrossFile(noMdListener);
  ok('flags_lua_emit_without_md_listener', !missingListener.ok && missingListener.findings.some(f => f.code === 'lua_md.missing_listener' && f.event === 'ai_influence.chat.response'), missingListener.findings);

  // Dynamic (concat) Lua event names are PREFIXES, not exact names (AAR #2 fix).
  const dynamicEmit: ExtensionProject = addFile(addFile(fixtureProject(), {
    path: 'ui/uix.lua',
    kind: 'lua',
    content: `local NS = "ai_influence"\nAddUITriggeredEvent(NS, "log_" .. category, payload)`,
  }), {
    path: 'md/news.xml',
    kind: 'md',
    content: `<mdscript name="News"><cues><cue name="OnNews"><conditions><event_ui_triggered screen="'ai_influence'" control="'log_galaxynews'" /></conditions></cue></cues></mdscript>`,
  });
  const dyn = validateProjectCrossFile(dynamicEmit);
  ok('dynamic_concat_emit_matches_listener_by_prefix',
    !dyn.findings.some(f => f.code === 'lua_md.missing_listener' && String(f.event).startsWith('ai_influence.log_')),
    dyn.findings);
  const dynamicNoListener: ExtensionProject = addFile(fixtureProject(), {
    path: 'ui/uix.lua',
    kind: 'lua',
    content: `local NS = "ai_influence"\nAddUITriggeredEvent(NS, "log_" .. category, payload)`,
  });
  const dynMiss = validateProjectCrossFile(dynamicNoListener);
  ok('dynamic_emit_with_no_prefix_listener_is_warning_not_error',
    dynMiss.findings.some(f => f.code === 'lua_md.missing_listener' && f.severity === 'warning' && f.event === 'ai_influence.log_')
    && !dynMiss.findings.some(f => f.code === 'lua_md.missing_listener' && f.severity === 'error'),
    dynMiss.findings);
  // Dynamic RegisterEvent prefix satisfies raised events under it.
  const dynamicRegister: ExtensionProject = {
    ...fixtureProject(),
    files: fixtureProject().files.map(f => f.path === 'ui/chat.lua' ? {
      ...f,
      content: `local NS = "ai_influence"\nRegisterEvent("ai_influence." .. channel, handler)\nAddUITriggeredEvent(NS, "chat.response", { reply = "ok" })`,
    } : f),
  };
  const dynReg = validateProjectCrossFile(dynamicRegister);
  ok('dynamic_concat_register_satisfies_raised_event_by_prefix',
    !dynReg.findings.some(f => f.code === 'md_lua.missing_register'),
    dynReg.findings);

  const commentedRegister: ExtensionProject = {
    ...fixtureProject(),
    files: fixtureProject().files.map(f => f.path === 'ui/chat.lua' ? {
      ...f,
      content: `-- RegisterEvent("ai_influence.chat", handler)\nlocal NS = "ai_influence"\nAddUITriggeredEvent(NS, "chat.response", {})`,
    } : f),
  };
  const commentResult = validateProjectCrossFile(commentedRegister);
  ok('register_event_text_in_a_comment_is_not_a_registration',
    commentResult.findings.some(f => f.code === 'md_lua.missing_register' && f.event === 'ai_influence.chat'),
    commentResult.mdLua.registered);

  const aliasedRegister: ExtensionProject = {
    ...fixtureProject(),
    files: fixtureProject().files.map(f => f.path === 'ui/chat.lua' ? {
      ...f,
      content: `local NS = "ai_influence"\nlocal reg = RegisterEvent\nreg("ai_influence.chat", handler)\nAddUITriggeredEvent(NS, "chat.response", {})`,
    } : f),
  };
  const aliasResult = validateProjectCrossFile(aliasedRegister);
  ok('simple_register_event_alias_is_resolved_from_the_ast',
    !aliasResult.findings.some(f => f.code === 'md_lua.missing_register'), aliasResult.mdLua.registered);

  const wrappedRegister: ExtensionProject = {
    ...fixtureProject(),
    files: fixtureProject().files.map(f => f.path === 'ui/chat.lua' ? {
      ...f,
      content: `local NS = "ai_influence"\nlocal function reg(event, handler) RegisterEvent(event, handler) end\nreg("ai_influence.chat", handler)\nAddUITriggeredEvent(NS, "chat.response", {})`,
    } : f),
  };
  const wrapperResult = validateProjectCrossFile(wrappedRegister);
  ok('simple_register_event_wrapper_is_resolved_from_the_ast',
    !wrapperResult.findings.some(f => f.code === 'md_lua.missing_register'), wrapperResult.mdLua.registered);

  const payloadCollision = addFile(addFile(fixtureProject(), {
    path: 'ui/orders.lua', kind: 'lua',
    content: `payload["g" .. payload.n] = station\npayload["w" .. payload.n] = ware`,
  }), {
    path: 'md/orders.xml', kind: 'md',
    content: `<mdscript name="Orders"><cues><cue name="Resolve"><actions>
      <set_value name="$station" exact="event.param3.{'$g' + $si}"/>
      <do_if value="$sv == 'wing'"><set_value name="$group" exact="event.param3.{'$g' + $si}"/></do_if>
      <set_value name="$ware" exact="event.param3.{'$w' + $si}"/>
    </actions></cue></cues></mdscript>`,
  });
  const collisionResult = validateProjectCrossFile(payloadCollision);
  ok('indexed_payload_global_and_verb_collision_is_an_error',
    collisionResult.findings.some(f => f.code === 'md_lua.payload_collision' && f.severity === 'error'),
    collisionResult.findings);
  ok('indexed_payload_evidence_preserves_reader_scope',
    collisionResult.mdLua.payload.reads.some(read => read.key === 'g' && read.scope === 'global')
      && collisionResult.mdLua.payload.reads.some(read => read.key === 'g' && read.scope === 'verb'),
    collisionResult.mdLua.payload.reads);

  const payloadGap = addFile(addFile(fixtureProject(), {
    path: 'ui/orders.lua', kind: 'lua', content: `payload["q_key" .. payload.n] = value`,
  }), {
    path: 'md/orders.xml', kind: 'md',
    content: `<mdscript name="Orders"><cues><cue name="Resolve"><actions><set_value name="$station" exact="event.param3.{'$g_key' + $si}"/></actions></cue></cues></mdscript>`,
  });
  const gapResult = validateProjectCrossFile(payloadGap);
  ok('indexed_payload_read_without_writer_is_an_error', gapResult.findings.some(f => f.code === 'md_lua.payload_missing_writer'), gapResult.findings);
  ok('indexed_payload_write_without_reader_is_an_error', gapResult.findings.some(f => f.code === 'md_lua.payload_unused_writer'), gapResult.findings);
  ok('indexed_payload_evidence_accepts_identifier_keys',
    gapResult.mdLua.payload.reads.some(read => read.key === 'g_key') && gapResult.mdLua.payload.writes.some(write => write.key === 'q_key'),
    gapResult.mdLua.payload);

  const brokenCue = addFile(fixtureProject(), {
    path: 'md/broken.xml',
    kind: 'md',
    content: '<mdscript name="Broken"><cues><cue name="Start"><actions><signal_cue cue="md.Contract.Nope" /></actions></cue></cues></mdscript>',
  });
  const unresolved = validateProjectCrossFile(brokenCue);
  ok('keeps_unresolved_cross_file_cue_diagnostic', !unresolved.ok && unresolved.findings.some(f => f.code === 'cue.unresolved'), unresolved.findings);

  // signal_cue aimed at a <library> is the in-game "no corresponding library" error.
  const signalLibrary = addFile(fixtureProject(), {
    path: 'md/bad_signal.xml',
    kind: 'md',
    content: '<mdscript name="Bad"><cues><cue name="Go"><actions><signal_cue cue="md.Contract.Call_chat" /></actions></cue></cues></mdscript>',
  });
  const sigLib = validateProjectCrossFile(signalLibrary);
  ok('flags_signal_cue_targeting_library', !sigLib.ok && sigLib.findings.some(f => f.code === 'md.signal_library'), sigLib.findings);

  // run_actions aimed at a plain <cue> (not a library) is the inverse mistake.
  const runActionsCue = addFile(fixtureProject(), {
    path: 'md/bad_run.xml',
    kind: 'md',
    content: '<mdscript name="BadRun"><cues><cue name="Go"><actions><run_actions ref="md.Contract.On_chat_response" /></actions></cue></cues></mdscript>',
  });
  const raCue = validateProjectCrossFile(runActionsCue);
  ok('flags_run_actions_targeting_nonlibrary', raCue.findings.some(f => f.code === 'md.run_actions_nonlibrary' && f.severity === 'warning'), raCue.findings);

  const duplicateDeps = addFile(fixtureProject(), {
    path: 'content.xml',
    kind: 'content',
    content: buildContentXml({ id: 'ai_influence', name: 'AI Influence', deps: [
      { id: 'djfhe_http', optional: true },
      { id: 'djfhe_http', optional: false },
    ] }),
  });
  const dup = validateProjectCrossFile(duplicateDeps);
  ok('flags_duplicate_dependency', dup.findings.some(f => f.code === 'dep.duplicate' && f.severity === 'warning'), dup.findings);

  const passed = checks.filter(c => c.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
