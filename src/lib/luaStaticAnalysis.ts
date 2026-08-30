/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic Lua static analysis for Extension Doctor.
 *
 * Layer 1: baseline Lua hygiene from luaparse (syntax + undefined globals).
 * Layer 2: Forge-native X4 rules for engine/runtime hazards.
 *
 * Globals are intentionally deterministic: a fixed seed of Lua/X4 globals plus
 * global definitions discovered from the scanned installed Lua files. AI can
 * suggest candidates later, but those suggestions must not silently enter this
 * allowlist.
 */

import { parse } from 'luaparse';
import { buildX4UiCallModel, type X4UiSourceLocation } from './x4UiCallModel';
import { lintX4UiCallModel, type X4UiLintFinding, type X4UiLintResult } from './x4UiLint';

/**
 * Strip Lua comments so source-pattern rules match CODE, not prose. Without this the
 * djfhe/package.path rules false-positive on the very warning comments that tell authors
 * NOT to write those patterns (e.g. aic_uix.lua documents the hazard in a `--` comment).
 * Removes long-bracket block comments (--[[ ]], --[=[ ]=]) then line comments. Not
 * string-literal aware, which is fine here: real `require(...)` / `package.path` code has no
 * leading `--`, so only commentary is removed.
 */
export function stripLuaComments(src: string): string {
  let s = src.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ');
  s = s.replace(/--[^\n]*/g, ' ');
  return s;
}

export interface LuaFileInput {
  rel: string;
  text: string;
  source: 'loose' | 'packed';
  sourcePath: string;
  extension: { folder: string; id: string; name?: string };
}

export interface LuaStaticFinding {
  layer: 'baseline' | 'x4';
  severity: 'error' | 'warning' | 'info';
  code: string;
  rel: string;
  message: string;
  symbol?: string;
  line?: number;
  column?: number;
  source: 'loose' | 'packed';
  sourcePath: string;
  /** Structured X4 UI rule context retained for richer consumers. */
  cause?: string;
  failureMode?: string;
  evidenceBoundary?: string;
  nextAction?: string;
}

export interface LuaStaticX4UiFileResult {
  rel: string;
  source: 'loose' | 'packed';
  sourcePath: string;
  /** The pure per-file result; gap details are intentionally not flattened. */
  result: X4UiLintResult;
}

export interface LuaStaticX4UiSummary {
  filesAnalyzed: number;
  errorCount: number;
  warningCount: number;
  verificationGapCount: number;
  filesWithErrors: number;
  filesWithWarnings: number;
  cleanCount: number;
  unverifiedCount: number;
  truncatedCount: number;
}

export interface LuaStaticAnalysisResult {
  filesScanned: number;
  globalAllowlistSize: number;
  findings: LuaStaticFinding[];
  x4UiResults: LuaStaticX4UiFileResult[];
  x4UiSummary: LuaStaticX4UiSummary;
}

const LUA_STANDARD_GLOBALS = new Set([
  '_G', '_VERSION',
  'assert', 'collectgarbage', 'dofile', 'error', 'getfenv', 'getmetatable', 'ipairs',
  'load', 'loadfile', 'loadstring', 'module', 'next', 'pairs', 'pcall', 'print',
  'rawequal', 'rawget', 'rawset', 'require', 'select', 'setfenv', 'setmetatable',
  'tonumber', 'tostring', 'type', 'unpack', 'xpcall',
  'coroutine', 'debug', 'io', 'math', 'os', 'package', 'string', 'table'
]);

const X4_ENGINE_GLOBALS = new Set([
  'AddUITriggeredEvent', 'DebugError', 'DebugText', 'GetCurTime', 'GetNPCBlackboard',
  'GetPlayerID', 'Helper', 'IsValidWidgetElement', 'OnlineGetUserItemAmount',
  'OnlineGetUserItems', 'RegisterEvent', 'RemoveEvent', 'SetNPCBlackboard',
  'SetScript', 'SignalObject', 'TraceBack', 'ffi', 'json', 'widgetSystem'
]);

const RESTRICTED_X4_UI_CALLS = [
  { name: 'OnlineGetUserItemAmount', pattern: /\bOnlineGetUserItemAmount\s*\(/ },
  { name: 'OnlineGetUserItems', pattern: /\bOnlineGetUserItems\b/ }
];

const X4_UI_MODELED_CALL_NAMES = new Set([
  'createFrameHandle', 'addTable', 'setColWidthPercent', 'setColWidth', 'addRow',
  'setColSpan', 'display', 'OpenMenu', 'setText', 'setText2', 'createText', 'createEditBox',
  'setDefaultCellProperties', 'setDefaultComplexCellProperties', 'setHotkey'
]);

const X4_UI_VERIFICATION_SUMMARY_CODE = 'x4-ui.verification-gap';
const X4_UI_TRUNCATION_CODE = 'x4-ui.truncated-evidence';

function walkAst(node: any, visit: (node: any) => void) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range' || key === 'comments' || key === 'tokens' || key === 'globals') continue;
    if (Array.isArray(value)) {
      for (const item of value) walkAst(item, visit);
    } else if (value && typeof value === 'object') {
      walkAst(value, visit);
    }
  }
}

function globalNameFromExpression(expr: any): string | null {
  if (!expr) return null;
  if (expr.type === 'Identifier') return expr.name;
  if (expr.type === 'MemberExpression') return globalNameFromExpression(expr.base);
  return null;
}

function parseLua(text: string) {
  return parse(text, {
    comments: false,
    locations: true,
    ranges: true,
    scope: true,
    luaVersion: '5.2'
  });
}

function normalizeLuaFile(file: LuaFileInput): LuaFileInput {
  // Official X4 Lua files can begin with one decoded UTF-8 BOM. Remove only that
  // marker once so every analyzer layer sees the same source without shifting lines.
  if (file.text.charCodeAt(0) !== 0xFEFF) return file;
  return { ...file, text: file.text.slice(1) };
}

function collectGlobalDefinitions(files: LuaFileInput[]): Set<string> {
  const defs = new Set<string>();
  for (const file of files) {
    let ast: any;
    try { ast = parseLua(file.text); } catch { continue; }
    walkAst(ast, node => {
      if (node.type === 'AssignmentStatement') {
        for (const variable of node.variables || []) {
          const name = globalNameFromExpression(variable);
          if (name) defs.add(name);
        }
      }
      if (node.type === 'FunctionDeclaration' && !node.isLocal) {
        const name = globalNameFromExpression(node.identifier);
        if (name) defs.add(name);
      }
    });
  }
  return defs;
}

function callNameFromAst(node: any): string | undefined {
  if (!node || node.type !== 'CallExpression') return undefined;
  const base = node.base;
  if (!base) return undefined;
  if (base.type === 'Identifier') return base.name;
  if (base.type === 'MemberExpression') return base.identifier?.name;
  if (base.type === 'IndexExpression' && base.index?.type === 'StringLiteral') return base.index.value;
  return undefined;
}

function containsModeledX4UiCall(ast: any): boolean {
  let found = false;
  walkAst(ast, node => {
    if (found || node.type !== 'CallExpression') return;
    const name = callNameFromAst(node);
    if (name && X4_UI_MODELED_CALL_NAMES.has(name)) found = true;
  });
  return found;
}

function isUiLikelyLua(file: LuaFileInput, ast?: any): boolean {
  const rel = file.rel.replace(/\\/g, '/').toLowerCase();
  if (!rel.endsWith('.lua')) return false;
  if (rel.startsWith('ui/') || rel.startsWith('subst_lua/')) return true;
  return ast ? containsModeledX4UiCall(ast) : false;
}

function fallbackUiLocation(file: LuaFileInput): X4UiSourceLocation {
  const lines = file.text.split(/\r?\n/);
  return {
    file: file.rel,
    sourcePath: file.sourcePath,
    start: { line: 1, column: 0, offset: 0 },
    end: {
      line: lines.length,
      column: lines[lines.length - 1]?.length || 0,
      offset: file.text.length
    }
  };
}

function x4UiFindingLocation(file: LuaFileInput, finding: X4UiLintFinding): X4UiSourceLocation {
  return finding.location || finding.source || fallbackUiLocation(file);
}

function x4UiSummaryLocation(file: LuaFileInput, result: X4UiLintResult, category?: string): X4UiSourceLocation {
  const gap = result.verificationGaps.find(item => !category || item.category === category);
  if (gap) return gap.location;
  const finding = result.findings.find(item => !category || item.category === category);
  return finding ? x4UiFindingLocation(file, finding) : fallbackUiLocation(file);
}

function x4UiFindingMessage(finding: X4UiLintFinding): string {
  return `${finding.message} Failure mode: ${finding.failureMode} Next action: ${finding.nextAction}`;
}

function makeX4UiFinding(
  file: LuaFileInput,
  code: string,
  severity: LuaStaticFinding['severity'],
  location: X4UiSourceLocation,
  message: string,
  cause: string,
  failureMode: string,
  evidenceBoundary: string,
  nextAction: string
): LuaStaticFinding {
  return {
    layer: 'x4',
    severity,
    code,
    rel: file.rel,
    message,
    line: location.start.line,
    column: location.start.column,
    source: file.source,
    sourcePath: file.sourcePath,
    cause,
    failureMode,
    evidenceBoundary,
    nextAction
  };
}

function projectX4UiResult(file: LuaFileInput, result: X4UiLintResult): LuaStaticFinding[] {
  const projected: LuaStaticFinding[] = [];
  const seen = new Set<string>();
  const add = (finding: LuaStaticFinding): void => {
    const key = [finding.code, finding.severity, finding.rel, finding.line || 0, finding.column || 0].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    projected.push(finding);
  };

  for (const finding of result.findings) {
    if (finding.severity !== 'error' && finding.severity !== 'warning') continue;
    const location = x4UiFindingLocation(file, finding);
    add(makeX4UiFinding(
      file,
      finding.code,
      finding.severity,
      location,
      x4UiFindingMessage(finding),
      finding.cause,
      finding.failureMode,
      finding.evidenceBoundary,
      finding.nextAction
    ));
  }

  if (!result.isStaticallyVerified) {
    const location = x4UiSummaryLocation(file, result);
    add(makeX4UiFinding(
      file,
      X4_UI_VERIFICATION_SUMMARY_CODE,
      'info',
      location,
      `${file.rel}: ${result.summary}. Detailed bounded X4 UI verification gaps remain in the structured per-file result. Failure mode: The complete static UI path is not proven safe; no in-game or render acceptance is claimed. Next action: Resolve the bounded static gap or verify this UI boundary in-game.`,
      `The X4 UI analysis reported ${result.verificationGapCount} bounded verification gap(s)${result.parsed ? '' : ' and did not complete parsing'}.`,
      'The complete static UI path is not proven safe; no in-game or render acceptance is claimed.',
      'Only source-located literal, resolved, non-truncated call-model facts are treated as proof.',
      'Resolve the bounded static gap or verify this UI boundary in-game.'
    ));
  }

  if (result.hasTruncatedEvidence || result.verificationGapsTruncated) {
    const location = x4UiSummaryLocation(file, result, 'truncated');
    add(makeX4UiFinding(
      file,
      X4_UI_TRUNCATION_CODE,
      'info',
      location,
      `${file.rel}: X4 UI verification evidence was truncated. Not statically verified. Detailed bounded gaps remain in the structured per-file result. Failure mode: Unseen bounded evidence may affect this result, so a clean static conclusion would be false. Next action: Reduce dynamic or unsupported UI evidence, then rerun analysis and verify the remaining boundary in-game.`,
      'The bounded X4 UI verification-gap list reached its cap.',
      'Unseen bounded evidence may affect this result, so a clean static conclusion would be false.',
      'The per-file result retains the bounded gap list and its truncation flag; it does not claim complete evidence.',
      'Reduce dynamic or unsupported UI evidence, then rerun analysis and verify the remaining boundary in-game.'
    ));
  }

  return projected;
}

function addX4UiResult(
  file: LuaFileInput,
  result: X4UiLintResult,
  results: LuaStaticX4UiFileResult[],
  summary: LuaStaticX4UiSummary,
  findings: LuaStaticFinding[]
): void {
  results.push({ rel: file.rel, source: file.source, sourcePath: file.sourcePath, result });
  summary.filesAnalyzed += 1;
  summary.errorCount += result.errorCount;
  summary.warningCount += result.warningCount;
  summary.verificationGapCount += result.verificationGapCount;
  if (result.hasErrors) summary.filesWithErrors += 1;
  if (result.hasWarnings) summary.filesWithWarnings += 1;
  if (result.status === 'clean') summary.cleanCount += 1;
  if (!result.isStaticallyVerified) summary.unverifiedCount += 1;
  if (result.hasTruncatedEvidence || result.verificationGapsTruncated) summary.truncatedCount += 1;
  findings.push(...projectX4UiResult(file, result));
}

// Hallucinated X4 UI functions: plausible-looking names that DO NOT exist in the engine, so any
// Lua calling them cannot run. Curated from the invented API LLMs (and the old UIBuilder template)
// emit. Kept conservative — only names confirmed not to be real X4 functions — to avoid false flags.
const FICTIONAL_UI_API = [
  'RegisterLayout', 'AddUITrigger', 'RemoveAllUITriggers', 'SignalCue', 'OpenUIFrame',
  'UpdateProgressBarValue', 'CreateCoroutine',
];

/**
 * X4 STANDALONE-MENU UI CONTRACT — the deterministic "schema" a custom menu's Lua MUST satisfy to
 * actually RENDER in-game. Every item was paid for in live debugging of the AI-Influence chat
 * window (which took hours to render). Encode it so the Forge validates UI elements against a
 * known-working configuration instead of building blind. The UIBuilder generates code to this
 * schema; analyzeLuaFiles() enforces the crisply-detectable items (see `ref` codes).
 *
 * Ground truth: SirNukes `simple_menu/Standalone_Menu.lua` + the live fix where `Helper` was nil at
 * file load, got cached, so registerMenu never ran and the frame never displayed.
 */
export const X4_STANDALONE_MENU_SCHEMA = {
  description: 'A custom standalone X4 menu renders only if its Lua satisfies all of these.',
  requires: [
    { id: 'name',       must: 'menu table has a unique `name` field (OpenMenu(name) matches menu.name)', enforced: 'lua.menu_never_opened (name+open)' },
    { id: 'onShowMenu', must: 'defines menu.onShowMenu — the engine calls it after OpenMenu',           enforced: 'lua.menu_never_opened' },
    { id: 'frame',      must: 'builds the frame via Helper.createFrameHandle(menu, ...) + frame:display()', enforced: 'lua.fictional_ui_api (no fake builders)' },
    { id: 'registered', must: 'inserts the menu into _G.Menus AND calls Helper.registerMenu(menu)',      enforced: 'doc (timing not statically enforced yet)' },
    { id: 'opened',     must: 'opened via OpenMenu(name, nil, nil, true) somewhere in the addon',        enforced: 'lua.menu_never_opened' },
    { id: 'lazyHelper', must: 'reads the global Helper LAZILY (rawget(_G,"Helper")) at use time — never caches the file-load value, which is nil', enforced: 'lua.helper_cached_at_load' },
  ],
  forbids: [
    { id: 'fictionalApi',       mustNot: 'call hallucinated UI functions (RegisterLayout, AddUITrigger, OpenUIFrame, ...)', enforced: 'lua.fictional_ui_api' },
    { id: 'helperCachedAtLoad', mustNot: '`local Helper = Helper` at file scope without a lazy refetch — Helper is nil at menu-file load, so registerMenu never runs and display() bails (the window never renders)', enforced: 'lua.helper_cached_at_load' },
  ],
} as const;

export function analyzeLuaFiles(files: LuaFileInput[]): LuaStaticAnalysisResult {
  const normalizedFiles = files.map(normalizeLuaFile);
  const allow = new Set([...LUA_STANDARD_GLOBALS, ...X4_ENGINE_GLOBALS, ...collectGlobalDefinitions(normalizedFiles)]);
  const findings: LuaStaticFinding[] = [];
  const x4UiResults: LuaStaticX4UiFileResult[] = [];
  const x4UiSummary: LuaStaticX4UiSummary = {
    filesAnalyzed: 0,
    errorCount: 0,
    warningCount: 0,
    verificationGapCount: 0,
    filesWithErrors: 0,
    filesWithWarnings: 0,
    cleanCount: 0,
    unverifiedCount: 0,
    truncatedCount: 0
  };

  for (const file of normalizedFiles) {
    const relLower = file.rel.toLowerCase();
    let ast: any;
    try {
      ast = parseLua(file.text);
    } catch (error) {
      findings.push({
        layer: 'baseline',
        severity: 'error',
        code: 'lua.syntax_error',
        rel: file.rel,
        message: `Lua parser error in ${file.rel}: ${error?.message || 'syntax error'}`,
        line: error?.line,
        column: error?.column,
        source: file.source,
        sourcePath: file.sourcePath
      });
      if (isUiLikelyLua(file)) {
        const x4UiResult = lintX4UiCallModel(buildX4UiCallModel({
          rel: file.rel,
          text: file.text,
          sourcePath: file.sourcePath
        }));
        addX4UiResult(file, x4UiResult, x4UiResults, x4UiSummary, findings);
      }
      continue;
    }

    const seenGlobals = new Set<string>();
    for (const g of ast.globals || []) {
      const name = g?.name;
      if (!name || allow.has(name) || seenGlobals.has(name)) continue;
      seenGlobals.add(name);
      findings.push({
        layer: 'baseline',
        severity: 'info',
        code: 'lua.undefined_global',
        rel: file.rel,
        message: `${file.rel} references global "${name}" that is not in the deterministic Lua/X4 allowlist and is not defined by scanned Lua files.`,
        symbol: name,
        line: g?.loc?.start?.line,
        column: g?.loc?.start?.column,
        source: file.source,
        sourcePath: file.sourcePath
      });
      if (seenGlobals.size >= 8) break;
    }

    if (relLower.endsWith('.lua') && relLower.startsWith('ui/')) {
      for (const fn of RESTRICTED_X4_UI_CALLS) {
        if (!fn.pattern.test(file.text)) continue;
        findings.push({
          layer: 'x4',
          severity: 'error',
          code: 'lua.restricted_online_call',
          rel: file.rel,
          message: `Calls or patches restricted UI function ${fn.name} from ${file.rel}. X4 can abort online user-item calls from non-verified sources; later menu errors are likely cascade symptoms.`,
          symbol: fn.name,
          source: file.source,
          sourcePath: file.sourcePath
        });
      }
    }

    if (relLower.endsWith('.lua')) {
      // Match against comment-stripped source so a warning COMMENT mentioning these patterns
      // doesn't trip the rule (the false-positive that flagged a clean aic_uix.lua).
      const codeText = stripLuaComments(file.text);
      // The provider extension itself (djfhe_http) legitimately requires its own client from its
      // internal modules (e.g. djfhe/http/request.lua) — that is NOT the consumer hazard. Exempt
      // it by OWNING extension id (not by path), so a consumer that wrongly vendors djfhe still flags.
      const ownerId = (file.extension?.id || file.extension?.folder || '').toLowerCase();
      const isDjfheProvider = ownerId === 'djfhe_http';
      // djfhe_http hazard: requiring the INTERNAL client module poisons djfhe's own module
      // cache and breaks its 50ms update loop FOREVER ("loop or previous error loading module
      // 'djfhe.http.client'"). Consumers must require only "djfhe.http.request" and drive it
      // with the fluent Request.new(METHOD):setUrl():setBody():send(callback) API.
      if (!isDjfheProvider && /require\s*\(\s*['"]djfhe\.http\.client['"]\s*\)/.test(codeText)) {
        findings.push({
          layer: 'x4', severity: 'error', code: 'lua.djfhe_internal_require', rel: file.rel,
          message: `${file.rel} requires djfhe's INTERNAL module "djfhe.http.client". This poisons djfhe's module cache and breaks its update loop every tick. Require only "djfhe.http.request" and use Request.new(M):setUrl():setBody():send(cb).`,
          symbol: 'djfhe.http.client', source: file.source, sourcePath: file.sourcePath
        });
      }
      // A broad "extensions/?.lua" on package.path can shadow or create require-loops for
      // OTHER extensions' modules (it contributed to the djfhe cache poisoning above). Add
      // only the specific dependency path, e.g. "extensions/<dep>/lua/?.lua".
      if (/extensions\/\?\.lua/.test(codeText)) {
        findings.push({
          layer: 'x4', severity: 'warning', code: 'lua.broad_package_path', rel: file.rel,
          message: `${file.rel} adds a broad "extensions/?.lua" to package.path, which can shadow or create require-loops for other extensions. Add only the specific dependency path (e.g. "extensions/<dep>/lua/?.lua").`,
          source: file.source, sourcePath: file.sourcePath
        });
      }
      // UI validator (1/2): hallucinated X4 UI API that cannot run.
      for (const fn of FICTIONAL_UI_API) {
        if (new RegExp('\\b' + fn + '\\s*\\(').test(codeText)) {
          findings.push({
            layer: 'x4', severity: 'error', code: 'lua.fictional_ui_api', rel: file.rel,
            message: `${file.rel} calls "${fn}(...)", which is not a real X4 function — it cannot run. Use the verified menu API: Helper.createFrameHandle, OpenMenu(name), AddUITriggeredEvent, frame:display().`,
            symbol: fn, source: file.source, sourcePath: file.sourcePath
          });
        }
      }
    }

    if (isUiLikelyLua(file, ast)) {
      const x4UiResult = lintX4UiCallModel(buildX4UiCallModel({
        rel: file.rel,
        text: file.text,
        sourcePath: file.sourcePath
      }));
      addX4UiResult(file, x4UiResult, x4UiResults, x4UiSummary, findings);
    }
  }

  // UI validator (2/2) — validate against the KNOWN-WORKING menu configuration. A standalone X4
  // window renders ONLY when opened by the engine function OpenMenu(name), which then calls
  // onShowMenu -> createFrameHandle -> frame:display(). A menu that builds a frame but is never
  // opened won't appear (the exact bug that cost hours). Cross-file per addon, because the
  // OpenMenu call often lives in a sibling controller lua, not the menu file itself.
  // (Ref config: SirNukes simple_menu/Standalone_Menu.lua.)
  const byExt = new Map<string, LuaFileInput[]>();
  for (const f of normalizedFiles) {
    if (!f.rel.toLowerCase().endsWith('.lua')) continue;
    const key = (file => (file.extension?.id || file.extension?.folder || ''))(f).toLowerCase();
    (byExt.get(key) || byExt.set(key, []).get(key)!).push(f);
  }
  for (const group of byExt.values()) {
    const coded = group.map(f => ({ f, code: stripLuaComments(f.text) }));
    const opensSomewhere = coded.some(({ code }) => /\bOpenMenu\s*\(/.test(code));
    for (const { f, code } of coded) {
      const buildsMenu = /createFrameHandle\s*\(/.test(code) || /\bonShowMenu\b/.test(code) || /\bregisterMenu\s*\(/.test(code);
      if (buildsMenu && !opensSomewhere) {
        findings.push({
          layer: 'x4', severity: 'error', code: 'lua.menu_never_opened', rel: f.rel,
          message: `${f.rel} builds a menu (createFrameHandle/onShowMenu/registerMenu) but no Lua in this addon calls OpenMenu(name). X4 renders a standalone menu ONLY when the engine function OpenMenu(name) opens it (which then calls onShowMenu). Add menu.open() -> OpenMenu(menu.name, ...). Ref: SirNukes simple_menu/Standalone_Menu.lua.`,
          source: f.source, sourcePath: f.sourcePath
        });
      }
      // Schema rule (lazyHelper): a menu file that CACHES the global Helper at file load
      // (`local Helper = Helper`) without ever re-reading it lazily. Helper is nil when a menu
      // file first executes, so the cached value stays nil → Helper.registerMenu never runs and
      // display() bails on `if not Helper`. The window never renders. THE bug that cost hours.
      // Fix: `local Helper = rawget(_G,"Helper")` + re-fetch at use time. (X4_STANDALONE_MENU_SCHEMA)
      if (buildsMenu) {
        const cachesHelperAtLoad = /local\s+Helper\s*=\s*Helper\b/.test(code);
        const lazyHelper = /rawget\s*\(\s*_G\s*,\s*['"]Helper['"]\s*\)/.test(code);
        if (cachesHelperAtLoad && !lazyHelper) {
          findings.push({
            layer: 'x4', severity: 'error', code: 'lua.helper_cached_at_load', rel: f.rel,
            message: `${f.rel} caches the global Helper at file load (\`local Helper = Helper\`). Helper is nil when a menu file first loads, so registerMenu never runs and display() bails — the window never renders. Read Helper lazily: \`local Helper = rawget(_G,"Helper")\` and re-fetch at use time. Ref: AI-Influence chat-window fix + SirNukes Standalone_Menu deferred Init.`,
            source: f.source, sourcePath: f.sourcePath
          });
        }
      }
    }

  }

  return {
    filesScanned: files.length,
    globalAllowlistSize: allow.size,
    findings,
    x4UiResults,
    x4UiSummary
  };
}

export function runLuaStaticAnalysisSelftest(): { pass: boolean; checks: { name: string; pass: boolean; detail?: string }[] } {
  const files: LuaFileInput[] = [
    {
      rel: 'ui/good.lua',
      text: 'local x = 1\nHelper.foo(x)\nfunction MyGlobal.ok() return true end\n',
      source: 'loose',
      sourcePath: 'good'
      , extension: { folder: 'good', id: 'good' }
    },
    {
      rel: 'ui/bad.lua',
      text: 'local amount = OnlineGetUserItemAmount("paint")\nMissingGlobalCall()\n',
      source: 'packed',
      sourcePath: 'ext_01.cat',
      extension: { folder: 'bad', id: 'bad' }
    },
    {
      rel: 'ui/broken.lua',
      text: 'function nope(\n',
      source: 'loose',
      sourcePath: 'broken',
      extension: { folder: 'broken', id: 'broken' }
    },
    {
      rel: 'ui/djfhe_bad.lua',
      text: 'local c = require("djfhe.http.client")\npackage.path = package.path .. ";extensions/?.lua"\n',
      source: 'loose',
      sourcePath: 'djfhe_bad',
      extension: { folder: 'djfhe_bad', id: 'djfhe_bad' }
    },
    {
      // Mirrors aic_uix.lua: the hazards appear ONLY inside a warning comment. Must NOT flag.
      rel: 'ui/djfhe_comment.lua',
      text: '-- Do NOT require("djfhe.http.client") and do NOT add a broad "extensions/?.lua" to package.path.\n--[[ block: require("djfhe.http.client") / extensions/?.lua ]]\nlocal Request = require("djfhe.http.request")\n',
      source: 'loose',
      sourcePath: 'djfhe_comment',
      extension: { folder: 'djfhe_comment', id: 'djfhe_comment' }
    },
    {
      // The PROVIDER's own internal module legitimately requires its client → must NOT flag.
      rel: 'lua/djfhe/http/request.lua',
      text: 'local Client = require("djfhe.http.client")\nreturn Client\n',
      source: 'loose',
      sourcePath: 'djfhe_http_provider',
      extension: { folder: 'djfhe_http', id: 'djfhe_http' }
    },
    {
      // UI validator: builds a menu frame but NOTHING in this addon opens it via OpenMenu -> the
      // window will never render. This is the exact bug class (must flag).
      rel: 'ui/menu_noopen.lua',
      text: 'local menu = { name = "M" }\nfunction menu.onShowMenu() menu.frame = Helper.createFrameHandle(menu, {}); menu.frame:display() end\nif Helper then Helper.registerMenu(menu) end\nreturn menu\n',
      source: 'loose', sourcePath: 'noopenmod',
      extension: { folder: 'noopenmod', id: 'noopenmod' }
    },
    {
      // The KNOWN-WORKING config (matches the live-fixed AI-Influence chat window): a menu file
      // that reads Helper LAZILY (rawget) + a sibling controller that opens it via OpenMenu.
      rel: 'ui/menu.lua',
      text: 'local Helper = rawget(_G, "Helper")\nlocal function refreshHelper() if not Helper then Helper = rawget(_G, "Helper") end return Helper end\nlocal menu = { name = "Good" }\nfunction menu.onShowMenu() refreshHelper(); menu.frame = Helper.createFrameHandle(menu, {}); menu.frame:display() end\nfunction menu.ensureRegistered() refreshHelper(); if Helper then Helper.registerMenu(menu) end end\nreturn menu\n',
      source: 'loose', sourcePath: 'openmod',
      extension: { folder: 'openmod', id: 'openmod' }
    },
    {
      rel: 'ui/ctrl.lua',
      text: 'local function open() if OpenMenu then OpenMenu("Good", nil, nil, true) end end\nRegisterEvent("x.open", open)\n',
      source: 'loose', sourcePath: 'openmod',
      extension: { folder: 'openmod', id: 'openmod' }
    },
    {
      // BROKEN against the schema: caches Helper at file load (the hours-long bug). It IS opened
      // (sibling controller), so this isolates lua.helper_cached_at_load from menu_never_opened.
      rel: 'ui/menu_cached.lua',
      text: 'local Helper = Helper\nlocal menu = { name = "C" }\nfunction menu.onShowMenu() menu.frame = Helper.createFrameHandle(menu, {}); menu.frame:display() end\nif Helper then Helper.registerMenu(menu) end\nreturn menu\n',
      source: 'loose', sourcePath: 'cachedmod',
      extension: { folder: 'cachedmod', id: 'cachedmod' }
    },
    {
      rel: 'ui/cached_ctrl.lua',
      text: 'local function open() if OpenMenu then OpenMenu("C", nil, nil, true) end end\nRegisterEvent("c.open", open)\n',
      source: 'loose', sourcePath: 'cachedmod',
      extension: { folder: 'cachedmod', id: 'cachedmod' }
    },
    {
      // Hallucinated X4 UI API that cannot run (must flag).
      rel: 'ui/fake.lua',
      text: 'RegisterLayout("ui/x.xml")\nAddUITrigger("b", "on_click", function() end)\n',
      source: 'loose', sourcePath: 'fakemod',
      extension: { folder: 'fakemod', id: 'fakemod' }
    }
  ];
  const result = analyzeLuaFiles(files);
  const has = (code: string, pred?: (f: LuaStaticFinding) => boolean) =>
    result.findings.some(f => f.code === code && (!pred || pred(f)));
  const checks = [
    { name: 'syntax_error_detected', pass: has('lua.syntax_error', f => f.rel === 'ui/broken.lua') },
    { name: 'restricted_x4_call_detected', pass: has('lua.restricted_online_call', f => f.rel === 'ui/bad.lua' && f.layer === 'x4' && f.severity === 'error') },
    { name: 'undefined_global_detected', pass: has('lua.undefined_global', f => f.symbol === 'MissingGlobalCall' && f.layer === 'baseline') },
    { name: 'x4_seed_global_not_flagged', pass: !result.findings.some(f => f.code === 'lua.undefined_global' && f.symbol === 'Helper') },
    { name: 'scanned_global_definition_not_flagged', pass: !result.findings.some(f => f.code === 'lua.undefined_global' && f.symbol === 'MyGlobal') },
    { name: 'djfhe_internal_require_detected', pass: has('lua.djfhe_internal_require', f => f.rel === 'ui/djfhe_bad.lua' && f.layer === 'x4' && f.severity === 'error') },
    { name: 'broad_package_path_detected', pass: has('lua.broad_package_path', f => f.rel === 'ui/djfhe_bad.lua' && f.severity === 'warning') },
    { name: 'djfhe_internal_require_NOT_flagged_in_comment', pass: !has('lua.djfhe_internal_require', f => f.rel === 'ui/djfhe_comment.lua') },
    { name: 'broad_package_path_NOT_flagged_in_comment', pass: !has('lua.broad_package_path', f => f.rel === 'ui/djfhe_comment.lua') },
    // A4: the djfhe_http provider's own internal require is exempt; the consumer (djfhe_bad.lua) still flags.
    { name: 'djfhe_provider_internal_require_exempt', pass: !has('lua.djfhe_internal_require', f => f.rel === 'lua/djfhe/http/request.lua') },
    { name: 'djfhe_consumer_internal_require_still_flagged', pass: has('lua.djfhe_internal_require', f => f.rel === 'ui/djfhe_bad.lua' && f.severity === 'error') },
    // UI validator vs the known-working menu config:
    { name: 'ui_menu_never_opened_flagged', pass: has('lua.menu_never_opened', f => f.rel === 'ui/menu_noopen.lua' && f.severity === 'error') },
    { name: 'ui_menu_with_OpenMenu_not_flagged', pass: !has('lua.menu_never_opened', f => f.rel === 'ui/menu.lua') },
    { name: 'ui_fictional_api_flagged', pass: has('lua.fictional_ui_api', f => f.rel === 'ui/fake.lua' && f.symbol === 'RegisterLayout' && f.severity === 'error') },
    { name: 'ui_real_api_not_flagged_as_fictional', pass: !has('lua.fictional_ui_api', f => f.rel === 'ui/menu.lua') },
    // Schema rule (lazyHelper): caching Helper at file load is the hours-long bug — must flag;
    // the lazy-rawget known-working menu must NOT flag.
    { name: 'ui_helper_cached_at_load_flagged', pass: has('lua.helper_cached_at_load', f => f.rel === 'ui/menu_cached.lua' && f.severity === 'error') },
    { name: 'ui_lazy_helper_not_flagged', pass: !has('lua.helper_cached_at_load', f => f.rel === 'ui/menu.lua') },
    { name: 'ui_cached_menu_isolated_from_never_opened', pass: !has('lua.menu_never_opened', f => f.rel === 'ui/menu_cached.lua') }
  ];

  const focusedFile = (rel: string, text: string, id = 'focused'): LuaFileInput => ({
    rel,
    text,
    source: 'loose',
    sourcePath: `${id}:${rel}`,
    extension: { folder: id, id }
  });
  const cleanUiText = [
    "local menu = { name = 'M', layer = 1 }",
    'local frame = Helper.createFrameHandle(menu, { layer = 1 })',
    'local table = frame:addTable(12)',
    "OpenMenu('M', nil, nil, true)",
    ''
  ].join('\n');
  const warningUiText = cleanUiText.replace('frame:addTable(12)', 'frame:addTable(13)');
  const errorUiText = cleanUiText.replace('frame:addTable(12)', 'frame:addTable(24)');
  const dynamicUiText = [
    "local menu = { name = 'M', layer = 1 }",
    'local frame = Helper.createFrameHandle(menu, { layer = 1 })',
    'local count = getCount()',
    'local table = frame:addTable(count)',
    "OpenMenu('M', nil, nil, true)",
    ''
  ].join('\n');
  const truncationUiText = Array.from({ length: 180 }, (_, index) =>
    `local table${index} = frame${index}:addTable(count${index})`
  ).join('\n');

  const bomValidAnalysis = analyzeLuaFiles([
    focusedFile('scripts/bom_valid.lua', '\uFEFFlocal value = 1\nreturn value\n', 'bom-valid')
  ]);
  const bomInvalidAnalysis = analyzeLuaFiles([
    focusedFile('scripts/bom_invalid.lua', '\uFEFFfunction nope(\n', 'bom-invalid')
  ]);
  const bomUiAnalysis = analyzeLuaFiles([
    focusedFile('ui/bom_too_many_columns.lua', `\uFEFF${warningUiText}`, 'bom-ui')
  ]);
  const nonBomUiAnalysis = analyzeLuaFiles([
    focusedFile('ui/bom_too_many_columns.lua', warningUiText, 'bom-ui')
  ]);

  const cleanUiAnalysis = analyzeLuaFiles([focusedFile('ui/clean12.lua', cleanUiText, 'clean12')]);
  const warningUiAnalysis = analyzeLuaFiles([focusedFile('ui/warning_columns.lua', warningUiText, 'warning13')]);
  const errorUiAnalysis = analyzeLuaFiles([focusedFile('ui/too_many_columns.lua', errorUiText, 'error24')]);
  const dynamicUiAnalysis = analyzeLuaFiles([focusedFile('ui/dynamic_count.lua', dynamicUiText, 'dynamic')]);
  const mixedUiAnalysis = analyzeLuaFiles([focusedFile('ui/error_and_gap.lua', [
    "local menu = { name = 'M', layer = 1 }",
    'local frame = Helper.createFrameHandle(menu, { layer = 1 })',
    'local fatalTable = frame:addTable(24)',
    'local count = getCount()',
    'local dynamicTable = frame:addTable(count)',
    "OpenMenu('M', nil, nil, true)",
    ''
  ].join('\n'), 'mixed')]);
  const brokenUiAnalysis = analyzeLuaFiles([focusedFile('ui/broken_ui.lua', 'function nope(\n', 'broken-ui')]);
  const truncationUiAnalysis = analyzeLuaFiles([focusedFile('ui/truncated.lua', truncationUiText, 'truncated')]);
  const nonUiAnalysis = analyzeLuaFiles([
    focusedFile('scripts/regular.lua', 'local value = math.abs(-1)\nreturn value\n', 'non-ui')
  ]);
  const outsideUiAnalysis = analyzeLuaFiles([
    focusedFile('lua/outside_ui.lua', cleanUiText, 'outside-ui')
  ]);

  const cleanUiResult = cleanUiAnalysis.x4UiResults[0]?.result;
  const warningUiResult = warningUiAnalysis.x4UiResults[0]?.result;
  const errorUiResult = errorUiAnalysis.x4UiResults[0]?.result;
  const errorUiFinding = errorUiAnalysis.findings.find(finding =>
    finding.rel === 'ui/too_many_columns.lua' && finding.code === 'x4-ui.add-table-column-limit'
  );
  const dynamicUiResult = dynamicUiAnalysis.x4UiResults[0]?.result;
  const mixedUiResult = mixedUiAnalysis.x4UiResults[0]?.result;
  const brokenUiResult = brokenUiAnalysis.x4UiResults[0]?.result;
  const truncationUiResult = truncationUiAnalysis.x4UiResults[0]?.result;
  const dynamicSummaryFindings = dynamicUiAnalysis.findings.filter(finding =>
    finding.rel === 'ui/dynamic_count.lua' && finding.code === X4_UI_VERIFICATION_SUMMARY_CODE
  );
  const truncationSummaryFindings = truncationUiAnalysis.findings.filter(finding =>
    finding.rel === 'ui/truncated.lua' && finding.code === X4_UI_VERIFICATION_SUMMARY_CODE
  );
  const truncationFindings = truncationUiAnalysis.findings.filter(finding =>
    finding.rel === 'ui/truncated.lua' && finding.code === X4_UI_TRUNCATION_CODE
  );
  const bomUiFinding = bomUiAnalysis.findings.find(finding =>
    finding.layer === 'x4' && finding.code === 'x4-ui.add-table-column-limit'
  );
  const nonBomUiFinding = nonBomUiAnalysis.findings.find(finding =>
    finding.layer === 'x4' && finding.code === 'x4-ui.add-table-column-limit'
  );

  checks.push(
    {
      name: 'bom_prefixed_valid_lua_has_no_syntax_error',
      pass: !bomValidAnalysis.findings.some(finding => finding.code === 'lua.syntax_error')
    },
    {
      name: 'bom_prefixed_invalid_lua_still_has_syntax_error',
      pass: bomInvalidAnalysis.findings.some(finding =>
        finding.code === 'lua.syntax_error' && finding.rel === 'scripts/bom_invalid.lua')
    },
    {
      name: 'bom_prefixed_x4_ui_warning_matches_non_bom_line',
      pass: bomUiFinding?.code === nonBomUiFinding?.code
        && bomUiFinding?.severity === 'warning'
        && nonBomUiFinding?.severity === 'warning'
        && bomUiFinding?.line === nonBomUiFinding?.line
        && bomUiFinding?.line === 3
        && bomUiFinding?.column === nonBomUiFinding?.column
        && !bomUiAnalysis.findings.some(finding => finding.code === 'lua.syntax_error')
    },
    {
      name: 'x4_ui_clean_12_column_structured_summary',
      pass: cleanUiResult?.summary === 'No known rule violated'
        && cleanUiResult.status === 'clean'
        && cleanUiResult.isStaticallyVerified
        && !cleanUiResult.hasErrors
        && !cleanUiResult.hasWarnings
        && cleanUiAnalysis.x4UiSummary.cleanCount === 1
        && !cleanUiAnalysis.findings.some(finding =>
          finding.rel === 'ui/clean12.lua' && finding.layer === 'x4'
            && (finding.severity === 'error' || finding.severity === 'warning'))
    },
    {
      name: 'x4_ui_add_table_13_is_warning_and_not_clean',
      pass: warningUiResult?.status === 'warnings'
        && warningUiResult.summary === 'Known X4 UI warning reported'
        && warningUiResult.warningCount === 1
        && warningUiResult.hasWarnings
        && !warningUiResult.hasErrors
        && warningUiResult.isStaticallyVerified
        && warningUiAnalysis.x4UiSummary.warningCount === 1
        && warningUiAnalysis.x4UiSummary.errorCount === 0
        && warningUiAnalysis.findings.some(finding =>
          finding.rel === 'ui/warning_columns.lua' && finding.code === 'x4-ui.add-table-column-limit'
            && finding.severity === 'warning'
            && finding.message.includes('13-23')
            && finding.message.includes('valid 13-column tables')
            && !finding.message.includes('ENTIRE frame'))
    },
    {
      name: 'x4_ui_add_table_24_is_blocking_with_structured_cause',
      pass: errorUiResult?.status === 'errors'
        && errorUiResult.summary === 'Known X4 UI rule violated'
        && errorUiResult.hasErrors === true
        && errorUiResult.errorCount === 1
        && !errorUiResult.hasWarnings
        && errorUiResult.isStaticallyVerified
        && errorUiFinding?.severity === 'error'
        && errorUiFinding.line === 3
        && errorUiFinding.column !== undefined
        && errorUiFinding.message.includes('12 passed / 24 failed / 13-23 unbisected')
        && errorUiFinding.failureMode?.includes('conversation-open') === true
        && errorUiFinding.failureMode?.includes('ENTIRE frame') === true
        && errorUiFinding.cause?.includes('measured mod refusal boundary') === true
        && errorUiFinding.evidenceBoundary?.includes('13-23 unbisected') === true
        && errorUiFinding.evidenceBoundary?.includes('valid 13-column tables') === true
        && errorUiFinding.nextAction?.includes('twelve or fewer') === true
    },
    {
      name: 'x4_ui_dynamic_count_unverified_summary_only',
      pass: dynamicUiResult?.summary === 'Not statically verified'
        && dynamicUiResult.status === 'not-statically-verified'
        && dynamicUiResult.hasVerificationGaps
        && !dynamicUiResult.isStaticallyVerified
        && !dynamicUiResult.hasErrors
        && !dynamicUiResult.hasWarnings
        && dynamicSummaryFindings.length === 1
        && dynamicSummaryFindings[0].severity === 'info'
        && dynamicUiAnalysis.x4UiSummary.unverifiedCount === 1
    },
    {
      name: 'x4_ui_errors_and_gaps_remain_independent',
      pass: mixedUiResult?.hasErrors === true
        && mixedUiResult.hasVerificationGaps
        && !mixedUiResult.isStaticallyVerified
        && mixedUiResult.status === 'not-statically-verified'
        && mixedUiAnalysis.findings.some(finding =>
          finding.rel === 'ui/error_and_gap.lua' && finding.code === 'x4-ui.add-table-column-limit'
            && finding.severity === 'error')
        && mixedUiAnalysis.findings.filter(finding =>
          finding.rel === 'ui/error_and_gap.lua' && finding.code === X4_UI_VERIFICATION_SUMMARY_CODE
            && finding.severity === 'info').length === 1
    },
    {
      name: 'x4_ui_parse_failure_cannot_be_clean',
      pass: brokenUiResult?.parsed === false
        && brokenUiResult.summary === 'Not statically verified'
        && brokenUiResult.hasVerificationGaps
        && !brokenUiResult.isStaticallyVerified
        && brokenUiAnalysis.x4UiSummary.cleanCount === 0
    },
    {
      name: 'x4_ui_truncation_is_distinct_and_structured',
      pass: truncationUiResult?.hasTruncatedEvidence === true
        && truncationUiResult.verificationGapsTruncated
        && truncationUiResult.status === 'not-statically-verified'
        && !truncationUiResult.isStaticallyVerified
        && truncationSummaryFindings.length === 1
        && truncationFindings.length === 1
        && truncationSummaryFindings[0].severity === 'info'
        && truncationFindings[0].severity === 'info'
        && truncationUiAnalysis.x4UiSummary.truncatedCount === 1
    },
    {
      name: 'non_ui_lua_skips_x4_ui_analysis',
      pass: nonUiAnalysis.x4UiResults.length === 0
        && nonUiAnalysis.x4UiSummary.filesAnalyzed === 0
    },
    {
      name: 'out_of_folder_ui_signal_is_analyzed',
      pass: outsideUiAnalysis.x4UiResults.length === 1
        && outsideUiAnalysis.x4UiResults[0].rel === 'lua/outside_ui.lua'
        && outsideUiAnalysis.x4UiResults[0].result.summary === 'No known rule violated'
    },
    {
      name: 'x4_ui_analysis_is_deterministic',
      pass: JSON.stringify(analyzeLuaFiles([
        focusedFile('ui/clean12.lua', cleanUiText, 'repeat'),
        focusedFile('ui/warning_columns.lua', warningUiText, 'repeat'),
        focusedFile('ui/too_many_columns.lua', errorUiText, 'repeat')
      ])) === JSON.stringify(analyzeLuaFiles([
        focusedFile('ui/clean12.lua', cleanUiText, 'repeat'),
        focusedFile('ui/warning_columns.lua', warningUiText, 'repeat'),
        focusedFile('ui/too_many_columns.lua', errorUiText, 'repeat')
      ]))
    }
  );
  return { pass: checks.every(c => c.pass), checks };
}
