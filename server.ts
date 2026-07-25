/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import zlib from "zlib";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createEmptySchemaLibrary, loadSchemaLibrary, readXsdConfig, resolveXsdConfig, runSchemaDiscoverySelftest, writeXsdConfig, type ResolvedXsdConfig } from "./src/lib/xsdParser";

// Import types & helpers from the frontend shared file
import {
  generateMDXML,
  generateUIIndexXML,
  generateUILuaScript,
  validateModWorkspace,
  X4_FACTIONS,
  X4_SHIP_MACROS,
  X4_STATION_MACROS,
  X4_SOUND_EFFECTS,
  NODE_TEMPLATES,
  PRESETS,
  ModWorkspace,
  PatchBlock,
  sanitizeWorkspace,
  type AIBehaviorScript
} from "./src/types";
import {
  toSafeModId,
  toTFileName,
  generateContentXML,
  compileScriptToXML,
  namespaceAiScriptName,
  compileWaresXML,
  compileJobsXML,
  compileTFileXML,
  compileDiffDocument
} from "./src/lib/modCompiler";
import { runModDoctor } from "./src/lib/modDoctor";
import { buildX4ObjectIndex, filterX4ObjectIndex, runObjectIndexSelftest, type X4ObjectIndex } from "./src/lib/x4ObjectIndex";
import { runProposalReviewSelftest } from "./src/lib/proposalReview";
import { runIntentCheckSelftest, type IntentRequirement, type IntentCheckSpec } from "./src/lib/intentCheck";
import { runBlueprintSelftest } from "./src/lib/modBlueprint";
import { runArchitectLoopSelftest } from "./src/lib/architectLoop";
import { runCanvasInteractionSelftest } from "./src/lib/canvasInteractions";
import { runLiveLogNavSelftest } from "./src/lib/liveLogNav";
import { runWaresJobsRoundtripSelftest, parseWaresXml, parseJobsXml } from "./src/lib/waresJobsParser";
import { runAiScriptRoundtripSelftest, parseAiScriptXml } from "./src/lib/aiScriptParser";
import { runLuaMdBindingSelftest } from "./src/lib/luaMdBinding";
import { runPositionPickerSelftest } from "./src/lib/positionPicker";
import { debugScan as catDatDebugScan, extractBaseGameFile as catDatExtractBaseGameFile, extractEntries as catDatExtractEntries, findCatDatArchives, parseCat, readEntryBytes, readEntryText, runCatDatSelftest } from "./src/lib/x4CatDat";
import { buildSchemaIndex, validateXmlAgainstSchema, runXsdValidateSelftest, type SchemaIndex } from "./src/lib/xsdValidate";
import { runReferenceLanguageSelftest } from "./src/lib/referenceLanguage";
import { isSameOrDescendant, runPathRolesSelftest, validateDirectoryRoles, validateProtectedWriteTargets, type DirectoryField } from "./src/lib/pathRoles";
import { parseXMLToWorkspace, extractTopLevelCueXml } from "./src/lib/xmlParser";
import type { SchemaLibrary } from "./src/lib/schemaTypes";
import { generateHttpGlueLua, generateContractMdScript, validateContract, runContractGlueSelftest, type IntegrationContract } from "./src/lib/contractGlue";
import { runFileBridgeTransportSelftest } from "./src/lib/fileBridgeTransport";
import { LUA_SNIPPETS, runLuaSnippetSelftest } from "./src/lib/luaSnippets";
import { runLuaLogicBlocksSelftest } from "./src/lib/luaLogicBlocks";
import { analyzeLuaFiles, runLuaStaticAnalysisSelftest, type LuaFileInput } from "./src/lib/luaStaticAnalysis";
import { runLuaRuntimeLogSelftest } from "./src/lib/luaRuntimeLog";
import { runCueLineageSelftest } from "./src/lib/cueLineage";
import { runSemanticsSelftest, listSemantics, semanticsForNode, getElementSemantics } from "./src/lib/mdSemantics";
import { computeActionCensus, runActionCensusSelftest } from "./src/lib/actionCensus";
import { createSpendMeter, estimateCallUsd, runAiSpendMeterSelftest } from "./src/lib/aiSpendMeter";
import { runModPatternsSelftest } from "./src/lib/modPatterns";
import { runExplainSelftest, explainWorkspace } from "./src/lib/mdExplain";
import { runCriticSelftest, critiqueWorkspace } from "./src/lib/mdCritic";
import { runXmlWellformedSelftest, checkXmlWellformed } from "./src/lib/xmlWellformed";
import { runVanillaUiReferenceSelftest, profileMenuLua, deriveSchemaEvidence } from "./src/lib/vanillaUiReference";
import { runSimulateSelftest, simulateWorkspace } from "./src/lib/mdSimulate";
import { runPortSemanticsSelftest } from "./src/lib/portSemantics";
import { runFriendlyNamesSelftest } from "./src/lib/mdFriendlyNames";
import { runNodeToolboxSelftest } from "./src/lib/nodeToolbox";
import { buildReadinessStages, runReadinessSelftest } from "./src/lib/readiness";
import { runExperienceModeSelftest } from "./src/lib/experienceMode";
import { runCompileSelftest } from "./src/lib/mdCompileSelftest";
import { runModTemplatesSelftest } from "./src/lib/modTemplates";
import { runCompositeBlocksSelftest } from "./src/lib/compositeBlocks";
import { runAutoLayoutSelftest } from "./src/lib/mdAutoLayout"; // port-semantics layer (50th pass)
import { validateNodesAgainstSchema, summarizeByNode, runNodeDiagnosticsSelftest, type NodeSchemaView } from "./src/lib/nodeDiagnostics";
import { runNodeAlignSelftest } from "./src/lib/nodeAlign";
import { runLiveFixesSelftest } from "./src/lib/liveFixes";
import { runLogTelemetrySelftest, parseLogTelemetry } from "./src/lib/logTelemetry";
import { runUiWidgetValidateSelftest } from "./src/lib/uiWidgetValidate";
import { runUILayoutSelftest } from "./src/lib/uiLayout";
import { runUiCompilerSelftest } from "./src/lib/uiCompilerSelftest";
import { analyzeOverrides, runOverrideMapSelftest, simulateLoadOrder } from "./src/lib/overrideMap";
import { analyzeModDependencies, runModDependencyGraphSelftest, parseModManifest, type ModManifest } from "./src/lib/modDependencyGraph";
import { buildMergedGalaxyMap, runGalaxyMapSelftest, type GalaxyMapSource } from "./src/lib/galaxyMap";
import { classifyPath, indexCueReferences, runExtensionProjectSelftest, buildContentXml, type ExtensionProject } from "./src/lib/extensionProject";
import { getAiSchemaIndex, getScriptPropertyIndex, registerValidationAgentRoutes } from "./src/server/validationRoutes";
import { getCanonicalReferenceSets, initializeReferenceCorpus, registerReferenceRoutes, startCanonicalReferenceManifest } from "./src/server/referenceRoutes";
import { computeModDrift, fingerprintModFolder, flattenProjectValidation, getSchemaIndex, loadProjectFromDisk, runProjectValidation } from "./src/server/projectValidation";
import { buildRemediationCapsules, runAgentLoopSelftest, runRepairLoop, type LoopDiagnostic } from "./src/lib/agentLoop";
import { assessSourceSync, hashFolderFingerprint, runCompileFidelitySelftest } from "./src/lib/compileFidelity";
import { workspaceContentHash, runWorkspaceIdentitySelftest } from "./src/lib/workspaceIdentity";
import { publishInstance, unpublishInstance, latestPath, runInstanceDiscoverySelftest } from "./src/lib/instanceDiscovery";
import { buildReleasePlan, buildZip, runModDistributionSelftest } from "./src/lib/modDistribution";
import { aiKeyStatus, getStoredAiKey, setStoredAiKey } from "./src/server/aiKeyStore";
import { runModDriftSelftest } from "./src/lib/modDrift";
import { assessLuaStaleness, injectLuaVersionMarker, runLuaStalenessSelftest } from "./src/lib/luaStalenessCheck";
import { registerGithubRoutes } from "./src/server/githubRoutes";
import { registerGameDetectRoutes } from "./src/server/gameDetectRoutes";
import { runGameDetectSelftest } from "./src/lib/gameDetect";
import { runTtfmSelftest } from "./src/lib/ttfm";
import { runLiveCanvasTelemetrySelftest } from "./src/lib/liveCanvasTelemetry";
import { runBridgeLiveStateSelftest } from "./src/lib/bridgeLiveState";
import { getBridgeLiveState } from "./src/server/liveBridge";
import { parseForgeWatches, runForgeWatchSelftest } from "./src/lib/forgeWatch";
import { parseForgeState, runForgeStateSelftest } from "./src/lib/forgeState";
import { buildProbeWorkspace, runForgeProbeSelftest, DEFAULT_PROBE_TOPICS } from "./src/lib/forgeProbe";
import { computeWatcherVerdict, runWatcherVerdictSelftest } from "./src/lib/watcherVerdict";
import { suggestExpression, runExpressionSuggestSelftest } from "./src/lib/expressionSuggest";
import { listQuickFixes, runWorkspaceQuickFixesSelftest } from "./src/lib/workspaceQuickFixes";
import { buildHealthCard, runHealthCardSelftest } from "./src/lib/healthCard";
import { runModRecipesSelftest } from "./src/lib/modRecipes";
import { runReferenceCorpusSelftest } from "./src/lib/referenceCorpus";
import { runReferenceLiteralLintSelftest } from "./src/lib/referenceLint";
import { parse as luaParse } from "luaparse";
import { registerNpcIdentityProbeRoutes } from "./src/server/npcIdentityProbe";
import { registerSelftests } from "./src/server/selftestRegistry";
import { createAgentKeyStore, scopeAllows, runAgentKeysSelftest, AGENT_KEY_TTLS, AGENT_KEY_PREFIX, type AgentKeyScope } from "./src/lib/agentKeys";
// B86 — agent action ledger: a skimmable record of what agents actually did.
import {
  ledgerRouteKind, describeAction, lineDelta, unifiedDiff, looksBinary, filterRows, revertibility,
  compactDiagnostics, MAX_DIFFABLE_BYTES, type LedgerRow, type LedgerKind,
} from "./src/lib/agentHistory";
import { AgentHistoryStore } from "./src/lib/agentHistoryStore";
import { runAgentHistorySelftest } from "./src/lib/agentHistory.selftest";
import { runBugReportSelftest } from "./src/lib/bugReport";
import { buildArtifactPlan, hashArtifactFile, materializeArtifact, verifyMaterializedArtifact, type ArtifactPlan } from "./src/lib/artifactPipeline";
import { materializeCatalogArtifact } from "./src/lib/artifactPackager";
import { dataPath, runDataDirSelftest } from "./src/lib/dataDir";
import { discoverSchemaRegistry, getDomainIndex, runSchemaRegistrySelftest, schemaFilesSignature } from "./src/lib/schemaRegistry";
import { routeProjectFile, runSchemaRoutingSelftest, validateRoutedFiles } from "./src/lib/schemaRouting";
import { attributesFor, completeChildren, hoverFor, runLangServiceSelftest } from "./src/lib/langService";
import { buildAgentsMd, buildNotesMd, runAgentBriefSelftest } from "./src/lib/agentBrief";
import { analyzePatchReadiness, runPatchReadinessSelftest } from "./src/lib/patchReadiness";
import { runJobsContentLintSelftest, learnJobsVocabularyMerged, type JobsVocabulary } from "./src/lib/jobsContentLint";
import { runMigrationLintSelftest } from "./src/lib/migrationLint";
import { runWaresContentLintSelftest, learnWaresVocabulary, type WaresVocabulary } from "./src/lib/waresContentLint";
import { runTFileLintSelftest, buildModTextIndex, lintTextReferences } from "./src/lib/tFileLint";
import { runFactionsLintSelftest, lintFactionRelations } from "./src/lib/factionsLint";
import { runGodLintSelftest, lintGodMacros } from "./src/lib/godLint";
import { readActiveState, writeActiveState, parkState, listParked, readParked, runWorkspaceStateSelftest } from "./src/lib/workspaceState";
import { createAgentProject, createProjectFile, generateAgentProject, packageAgentProject, runProjectOrchestrationSelftest } from "./src/lib/projectOrchestration";
import { runProjectCrossFileSelftest, validateProjectCrossFile } from "./src/lib/projectCrossFileValidation";
import {
  runExternalApiRegistrySelftest,
  EXTERNAL_API_REGISTRY,
  validateApiDefinition,
  mergeRegistries,
  setActiveRegistry,
  getActiveRegistry,
  deriveApiDefinition,
  type ApiDefinition,
  type ApiOrigin,
} from "./src/lib/externalApiRegistry";
import { synthesizePatch, runXpathSynthSelftest } from "./src/lib/xpathSynth";
import * as xpathLib from "xpath";
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import {
  isDbAvailable, openStudioDb, bindGamePath, dbSelfTest,
  cacheObjectIndex as dbCacheObjectIndex,
  readAllObjects as dbReadAllObjects,
  objectIndexCounts as dbObjectIndexCounts,
  sourcesUnchanged as dbSourcesUnchanged,
  recordSourceStamps as dbRecordSourceStamps,
  getDbMeta, setDbMeta,
  type StudioDb, type SourceStamp
} from "./src/lib/db";

dotenv.config();
// Also load .env.local (Vite convention) so values like GITHUB_CLIENT_ID and GEMINI_API_KEY
// placed there are visible to the server. .env.local takes precedence.
dotenv.config({ path: '.env.local', override: true });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TOKEN_FILE = path.join(process.cwd(), ".studio-api-token");
/** B93.5: reported by GET /api/agent/status so callers can tell a restart from a stale read. */
const SERVER_STARTED_AT = new Date().toISOString();

function loadStudioApiToken(): string {
  if (process.env.STUDIO_API_TOKEN?.trim()) {
    return process.env.STUDIO_API_TOKEN.trim();
  }
  try {
    const existing = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (existing) {
      return existing;
    }
  } catch {
    // First run on this checkout; create a local-only token below.
  }
  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(TOKEN_FILE, token, { encoding: "utf8" });
  return token;
}

const STUDIO_API_TOKEN = loadStudioApiToken();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function injectStudioToken(html: string): string {
  const tokenScript = `<script>window.__STUDIO_API_TOKEN__=${JSON.stringify(STUDIO_API_TOKEN)};</script>`;
  return html.replace("</head>", `  ${tokenScript}\n  </head>`);
}

function loadCurrentSchemaLibrary(): SchemaLibrary {
  try {
    const resolved = resolveXsdConfig();
    // B51: load from the DISCOVERED absolute paths (the game keeps md.xsd/common.xsd in
    // subdirectories, so a naive schemaDir + 'md.xsd' join misses them). loadSchemaLibrary
    // honors absolute file paths. Guard when neither resolved yet → empty library, not a throw.
    const schemaPaths = [resolved.mdXsdPath, resolved.commonXsdPath].filter(p => p && fs.existsSync(p));
    if (!schemaPaths.length) {
      return createEmptySchemaLibrary(
        `md.xsd / common.xsd not found under the configured schema or game path (searched "${resolved.schemaDir}"${resolved.x4GamePath ? ` and "${resolved.x4GamePath}"` : ''}).`,
      );
    }
    const library = loadSchemaLibrary(resolved.schemaDir, schemaPaths);
    console.log(`[AI-STUDIO] Loaded XSD schema library: ${library.events.length} events, ${library.conditions.length} conditions, ${library.actions.length} actions (md=${resolved.mdXsdPath}).`);
    return library;
  } catch (error) {
    const message = errorMessage(error);
    console.warn(`[AI-STUDIO] XSD schema library unavailable: ${message}`);
    return createEmptySchemaLibrary(message);
  }
}

let schemaLibrary: SchemaLibrary = loadCurrentSchemaLibrary();
let schemaTemplatesByTag = new Map(schemaLibrary.templates.map(template => [template.xmlTag, template]));
let objectIndexCache: { key: string; builtAt: number; index: X4ObjectIndex } | null = null;
// B64-P1: in-flight guard for the stale-while-revalidate background refresh — dedupes
// concurrent expired-cache hits into a single rebuild (Node is single-threaded, so this
// is a boolean, not a lock). Holds the cacheKey currently being refreshed.
let objectIndexRefreshing: string | null = null;

// SQLite cache (mirror-write stage — see src/lib/db.ts). Lazily opened once;
// null when better-sqlite3 isn't installed or the DB can't be opened. All uses
// are best-effort: a cache failure must never break the in-memory path.
let studioDb: StudioDb | null | undefined; // undefined = not attempted yet
function getStudioDb(): StudioDb | null {
  if (studioDb !== undefined) return studioDb;
  studioDb = isDbAvailable().available ? openStudioDb() : null;
  if (studioDb) console.log(`[studio-db] SQLite cache active at ${studioDb.path}`);
  return studioDb;
}

function reloadSchemaLibrary(): SchemaLibrary {
  schemaLibrary = loadCurrentSchemaLibrary();
  schemaTemplatesByTag = new Map(schemaLibrary.templates.map(template => [template.xmlTag, template]));
  objectIndexCache = null;
  return schemaLibrary;
}

app.use(express.json({ limit: "5mb" }));

// Enable CORS only for this app's same-port localhost origins.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`
  ]);
  if (origin && allowedOrigins.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-ai-provider, x-custom-api-key");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to verify the app session token for all /api/* routes.
// Read-only diagnostic GET endpoints that expose no secrets and no mutation.
// Public so localhost dev/verification tooling can reach them without the token.
const PUBLIC_READONLY_GETS = new Set<string>([
  "/agent/schema",
  "/agent/schema-registry",
  "/agent/lang/complete",
  "/agent/lang/attrs",
  "/agent/lang/hover",
  "/agent/md-audit",
  "/agent/xsd-debug",
  "/agent/catdat-debug",
  "/agent/round-trip-selftest",
  "/agent/patch-audit",
  "/agent/diagnostics",
  "/agent/api-selftest",
  "/agent/log-selftest",
  "/agent/reference-selftest",
  "/agent/type-probe",
  "/agent/selftest",
  "/agent/db-selftest",
  "/agent/contract-selftest",
  "/agent/file-bridge-transport-selftest",
  "/agent/contract-glue-sample",
  "/agent/lua-snippets",
  "/agent/lua-logic-blocks-selftest",
  "/agent/lua-static-selftest",
  "/agent/cue-lineage-selftest",
  "/agent/semantics-selftest",
  "/agent/semantics",
  "/agent/explain-selftest",
  "/agent/critic-selftest",
  "/agent/xml-wellformed-selftest",
  "/agent/vanilla-ui-selftest",
  "/agent/vanilla-ui-harvest",
  "/agent/node-diagnostics-selftest",
  "/agent/node-align-selftest",
  "/agent/simulate-selftest",
  "/agent/port-semantics-selftest",
  "/agent/friendly-names-selftest",
  "/agent/compile-selftest",
  "/agent/mod-templates-selftest",
  "/agent/composite-blocks-selftest",
  "/agent/auto-layout-selftest",
  "/agent/log-telemetry-selftest",
  "/agent/log-file-selftest",
  "/agent/ui-widget-validate-selftest",
  "/agent/ui-layout-selftest",
  "/agent/xpath-synth-selftest",
  "/agent/live-fixes-selftest",
  "/agent/external-api-registry",
  "/agent/mod-dependency-graph",
  "/agent/npc-identity-probe/selftest",
  "/agent/scriptproperties-selftest",
  "/agent/aiscript-lint-selftest",
  "/agent/scriptproperties-status",
  "/agent/md-pitfall-selftest",
  "/agent/expression-suggest-selftest",
  "/reference/status",
  "/reference/manifest",
  "/reference/coverage",
  "/reference/factions",
  "/reference/wares",
  "/reference/sectors",
  "/reference/scriptproperties",
  "/reference/file",
  "/reference/search",
  "/reference/selftest",
]);

// B42: named, scoped, expiring agent keys (src/lib/agentKeys). The boot session token
// keeps full, unscoped power and is the ONLY credential that can manage keys.
const AGENT_KEYS_FILE = dataPath("agent-keys.json"); // B53: survives extension updates via X4_DATA_DIR
const agentKeyStore = createAgentKeyStore({ file: AGENT_KEYS_FILE });

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === "GET" && PUBLIC_READONLY_GETS.has(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token." });
  }

  const token = authHeader.substring(7);
  if (token === STUDIO_API_TOKEN) {
    // B86: record WHO acted, never WHAT they authenticated with. Only the actor kind and a
    // human label are ever attached; the token itself never leaves this function.
    (req as any).__actor = { kind: 'studio', label: 'Studio UI' };
    return next(); // session token: full power, unchanged fast path
  }

  // B42: agent keys — verify hash, expiry, revocation, then enforce scope (deny-by-default).
  if (token.startsWith(AGENT_KEY_PREFIX)) {
    const v = agentKeyStore.verify(token);
    if (!v.ok) {
      return res.status(401).json({ error: `Unauthorized: agent key ${v.reason || "invalid"}.` });
    }
    if (!scopeAllows(v.scope as AgentKeyScope, req.method, req.path)) {
      return res.status(403).json({
        error: `Forbidden: key "${v.label}" has scope "${v.scope}" — this route needs a higher scope (or the studio session token for key management).`,
        code: "insufficient_scope",
        scope: v.scope,
      });
    }
    agentKeyStore.touch(v.id!);
    (req as any).__actor = { kind: 'agent', label: v.label || 'unnamed key' };
    return next();
  }

  return res.status(401).json({ error: "Unauthorized: Invalid token." });
}

app.use("/api", authMiddleware);

// ---------------------------------------------------------------------------
// B86 — AGENT ACTION LEDGER capture.
//
// One middleware over an explicit allowlist (LEDGER_ROUTES). Read-only traffic never reaches
// it. The ONLY hot-path work is reading the target file's previous bytes for an fs/write —
// everything else (diffing, blob writes, summarising, appending) runs on 'finish', after the
// response has already gone out.
//
// Nothing in here may fail, delay, or alter the underlying request: a broken ledger must never
// break the work it records, so every step is wrapped and faults are counted, not thrown.
// ---------------------------------------------------------------------------
const agentHistoryStore = new AgentHistoryStore();

function ledgerActor(req: express.Request): { kind: 'agent' | 'studio'; label: string } {
  const actor = (req as any).__actor;
  return actor && actor.kind ? actor : { kind: 'studio', label: 'Studio UI' };
}

function ledgerMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  let kind: LedgerKind | null = null;
  try {
    // Mounted under app.use("/api", …), so req.path is MOUNT-RELATIVE ("/fs/write"). The
    // allowlist is written as full paths because that is what a reader can verify against the
    // route definitions, so rebuild the full path here rather than storing half-paths.
    kind = ledgerRouteKind(req.method, `${req.baseUrl || ''}${req.path}`);
  } catch { kind = null; }
  if (!kind) return next();

  const startedAt = Date.now();
  const fullPath = `${req.baseUrl || ''}${req.path}`;
  let before: { text?: string; bytes: number; binary: boolean; existed: boolean } | null = null;
  // B86.1: snapshot the canvas node ids BEFORE the call, so a workspace-replacing action can
  // report which nodes it actually changed rather than "all of them".
  let nodesBefore: Map<string, string> | null = null;
  // The app auto-syncs the canvas to POST /api/agent/workspace on a 300ms debounce after every
  // edit, so recording each one would bury the history in "Replaced the working canvas" rows —
  // precisely the uselessness this panel exists to avoid. Hash the workspace before and after
  // and drop the row when nothing actually changed.
  let workspaceHashBefore = '';
  if (kind === 'workspace' || kind === 'generate') {
    try {
      nodesBefore = new Map((activeWorkspace?.nodes || []).map((n: any) => [String(n.id), JSON.stringify(n)]));
      workspaceHashBefore = workspaceContentHash(sanitizeWorkspace(activeWorkspace));
    } catch { nodesBefore = null; }
  }

  // Hot-path work, deliberately minimal and only for edits: without the pre-write bytes there
  // is no diff and no undo. Oversized files are hashed by size only, never read into memory.
  if (kind === 'edit') {
    try {
      const requested = String((req.body as any)?.path || '');
      const resolvedRoot = resolveXsdConfig().modWorkspacePath;
      if (requested && resolvedRoot) {
        const target = path.resolve(resolvedRoot, requested);
        if (target.startsWith(path.resolve(resolvedRoot)) && fs.existsSync(target) && fs.statSync(target).isFile()) {
          const size = fs.statSync(target).size;
          if (size <= MAX_DIFFABLE_BYTES) {
            const buffer = fs.readFileSync(target);
            const binary = looksBinary(buffer);
            before = { text: binary ? undefined : buffer.toString('utf8'), bytes: size, binary, existed: true };
          } else {
            before = { bytes: size, binary: true, existed: true };
          }
        }
      }
    } catch { before = null; }
  }

  // Capture the response body without changing it — the summaries need the parsed payload.
  let captured: any = null;
  const originalJson = res.json.bind(res);
  (res as any).json = (body: any) => { captured = body; return originalJson(body); };

  res.on('finish', () => {
    try {
      const files: string[] = [];
      let lines: { added: number; removed: number } | undefined;
      let beforeBlob: string | undefined;
      let afterBlob: string | undefined;
      let diffBlob: string | undefined;
      let binary = false;
      let bytes: { before?: number; after?: number } | undefined;

      if (kind === 'edit') {
        const requested = String((req.body as any)?.path || '');
        if (requested) files.push(requested);
        const after = (req.body as any)?.content;
        const afterText = typeof after === 'string' ? after : undefined;
        binary = !!before?.binary || (afterText === undefined && after !== undefined);
        bytes = { before: before?.bytes, after: afterText !== undefined ? Buffer.byteLength(afterText, 'utf8') : undefined };
        if (res.statusCode < 400 && !binary && afterText !== undefined) {
          lines = lineDelta(before?.text ?? '', afterText);
          if (before?.text !== undefined) {
            beforeBlob = agentHistoryStore.putBlob(before.text);
            diffBlob = agentHistoryStore.putBlob(unifiedDiff(before.text, afterText, requested));
          }
          afterBlob = agentHistoryStore.putBlob(afterText);
        }
      } else if (kind === 'deploy') {
        const deployed = captured?.deployedPath;
        if (deployed) files.push(String(deployed));
      } else if (kind === 'revert') {
        // The handler records which files it restored; capture still happens here.
        for (const file of ((req as any).__revertFiles || [])) files.push(String(file));
      }

      // B86.1: diagnostics. A row saying "1 error" without naming it is the failure mode this
      // panel exists to prevent, so the findings are captured and the erroring files become the
      // row's files (which also makes the file filter work for validation rows).
      let diagnosticsBlob: string | undefined;
      let diagnosticsCount: number | undefined;
      if (kind === 'validate' || kind === 'compile') {
        const diagnostics = compactDiagnostics(captured);
        if (diagnostics.length) {
          diagnosticsBlob = agentHistoryStore.putBlob(JSON.stringify(diagnostics, null, 2));
          diagnosticsCount = diagnostics.length;
          for (const d of diagnostics) {
            if (d.severity === 'error' && d.filePath && !files.includes(d.filePath)) files.push(d.filePath);
          }
        }
      }

      // B86.1: which canvas nodes did this touch? Rows become clickable so a reader can jump
      // straight to the node an action changed.
      let touchedNodes: Array<{ id: string; label?: string }> | undefined;
      try {
        const current: any[] = (activeWorkspace?.nodes || []) as any[];
        if (nodesBefore) {
          const changed = current.filter(n => nodesBefore!.get(String(n.id)) !== JSON.stringify(n));
          const removed = [...nodesBefore.keys()].filter(id => !current.some(n => String(n.id) === id));
          touchedNodes = [
            ...changed.map(n => ({ id: String(n.id), label: String(n.label || n.xmlTag || n.id) })),
            ...removed.map(id => ({ id, label: 'removed node' })),
          ].slice(0, 50);
        } else if (diagnosticsBlob || kind === 'edit') {
          // Diagnostics and file edits point at cues by name/file; match them to live nodes.
          const needles = new Set<string>();
          for (const f of files) {
            const base = String(f).replace(/\\/g, '/').split('/').pop() || '';
            if (base) needles.add(base.replace(/\.[^.]+$/, '').toLowerCase());
          }
          const flat = Array.isArray(captured?.flat) ? captured.flat : [];
          for (const d of flat) if (d?.sourceRef) needles.add(String(d.sourceRef).toLowerCase());
          const matched = current.filter(n => {
            const label = String(n.label || '').toLowerCase();
            const script = String(n.properties?.mdScript || n.mdScript || '').toLowerCase();
            return (label && needles.has(label)) || (script && needles.has(script));
          });
          if (matched.length) touchedNodes = matched.slice(0, 50).map(n => ({ id: String(n.id), label: String(n.label || n.id) }));
        }
      } catch { touchedNodes = undefined; }

      // A workspace sync that changed nothing is not an action worth a row.
      if (kind === 'workspace' && workspaceHashBefore) {
        let after = '';
        try { after = workspaceContentHash(sanitizeWorkspace(activeWorkspace)); } catch { after = ''; }
        if (after && after === workspaceHashBefore) return;
      }

      const described = describeAction({
        kind, status: res.statusCode, body: captured, request: req.body, files, lines, binary, bytes,
        revertOfTitle: (req as any).__revertOfTitle,
        routePath: fullPath,
        nodes: touchedNodes,
      });
      const rule = revertibility(kind, described.outcome, !!beforeBlob);
      const row: LedgerRow = {
        id: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
        ts: new Date().toISOString(),
        agent: ledgerActor(req),
        kind,
        title: described.title,
        files,
        outcome: described.outcome,
        durationMs: Date.now() - startedAt,
        ...(bytes && (bytes.before !== undefined || bytes.after !== undefined) ? { bytes } : {}),
        ...(lines ? { lines } : {}),
        ...(beforeBlob ? { beforeBlob } : {}),
        ...(afterBlob ? { afterBlob } : {}),
        ...(diffBlob ? { diffBlob } : {}),
        ...(binary ? { binary } : {}),
        ...(diagnosticsBlob ? { diagnosticsBlob, diagnosticsCount } : {}),
        ...(touchedNodes && touchedNodes.length ? { nodes: touchedNodes } : {}),
        revertible: rule.revertible,
        ...(rule.reason ? { revertReason: rule.reason } : {}),
        ...((req as any).__revertOf ? { revertOf: (req as any).__revertOf } : {}),
      };
      agentHistoryStore.append(row);
    } catch {
      // Swallowed BY DESIGN. The response has already been sent; a ledger fault must not
      // surface as a request failure. The store counts its own faults for the panel.
      agentHistoryStore.failures++;
    }
  });

  return next();
}

app.use("/api", ledgerMiddleware);

// ---------------------------------------------------------------------------
// B42: agent-key management (SESSION TOKEN ONLY — scopeAllows denies /agent/keys
// to every agent key, so anything that reaches these handlers used the session token).
// ---------------------------------------------------------------------------
app.get("/api/agent/keys", (_req, res) => {
  agentKeyStore.prune();
  return res.json({ keys: agentKeyStore.list(), ttls: Object.keys(AGENT_KEY_TTLS) });
});

app.post("/api/agent/keys", (req, res) => {
  const label = String(req.body?.label || "").trim();
  const scope = String(req.body?.scope || "") as AgentKeyScope;
  const ttlName = String(req.body?.ttl || "");
  if (!label) return res.status(400).json({ error: "Missing 'label'." });
  if (!["read", "write", "deploy"].includes(scope)) {
    return res.status(400).json({ error: "Invalid 'scope' — use read | write | deploy." });
  }
  if (!(ttlName in AGENT_KEY_TTLS)) {
    return res.status(400).json({ error: `Invalid 'ttl' — use ${Object.keys(AGENT_KEY_TTLS).join(" | ")}.` });
  }
  const { token, record } = agentKeyStore.create(label, scope, AGENT_KEY_TTLS[ttlName]);
  const { tokenHash: _hidden, ...safe } = record;
  // The plaintext token appears in THIS response only — it is never persisted or listed.
  return res.json({ token, record: { ...safe, hashPrefix: record.tokenHash.slice(0, 8) } });
});

app.post("/api/agent/keys/revoke", (req, res) => {
  const id = String(req.body?.id || "");
  if (!id) return res.status(400).json({ error: "Missing 'id'." });
  const done = agentKeyStore.revoke(id);
  return done
    ? res.json({ ok: true, id })
    : res.status(404).json({ error: "No such active key (already revoked or unknown id)." });
});

type CompiledFileManifest = Record<string, string>;

type ServerDiagnostic = {
  severity: "error" | "warning" | "info";
  category: string;
  code: string;
  domain: string;
  filePath: string;
  line?: number;
  nodeId?: string;
  message: string;
  sourceRef?: { kind: string; id?: string; label?: string };
};

type PatchDiagnosticBlock = Pick<PatchBlock, "id" | "sel" | "targetFile" | "includeInBuild"> & {
  selector?: string;
};

type LastDeployInfo = {
  modId: string;
  workspaceName: string;
  /** Exact sanitized workspace content compiled for this deploy (B36 freshness proof). */
  workspaceHash: string;
  deployedAt: string;
  stagingPath?: string;
  deployedPath?: string;
};

let lastDeployInfo: LastDeployInfo | null = null;
type ArtifactBuildReport = {
  mode: 'loose' | 'catalog';
  sourceRoot: string;
  targetRoot: string;
  includedFiles: number;
  includedBytes: number;
  generatedFiles: number;
  sourceCopyFiles: number;
  excluded: ArtifactPlan['excluded'];
  runtimeOwned: ArtifactPlan['runtimeOwned'];
  outputFiles: number;
  catalogVolumes: number;
  verified: boolean;
  /**
   * B84: relative paths of native binaries in the deployed plan. Catalog mode buries these
   * inside ext_NN.dat where the OS cannot LoadLibrary them, which silently kills any mod
   * that loads native code (lived: x4_ai_influence's luasocket/luasec DLLs). Recorded here
   * so the deploy result can SAY so instead of leaving the author to discover it in-game.
   */
  nativeBinaries: string[];
  /**
   * B84: soft `.forgekeep` keep-hints that named a path the build actually manages. The
   * build won; these are reported so the author learns their hint is a no-op instead of
   * assuming the deployed copy was left alone.
   */
  preservationOverrides: string[];
};
let lastArtifactReport: ArtifactBuildReport | null = null;
/** B84: filled by `replaceValidatedDeployment`, read when the artifact report is built. */
let lastPreservationOverrides: string[] = [];

/**
 * B84 — deployment packaging format. `loose` writes every file to disk as a file (the
 * long-standing behavior, what X4 mod folders look like in the wild, and the only mode in
 * which native binaries load). `catalog` packs the payload into ext_NN.cat/.dat.
 */
type DeployFormat = 'loose' | 'catalog';
const DEPLOY_FORMATS: readonly DeployFormat[] = ['loose', 'catalog'] as const;
const DEFAULT_DEPLOY_FORMAT: DeployFormat = 'loose';

function normalizeDeployFormat(value: unknown): DeployFormat | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  return (DEPLOY_FORMATS as readonly string[]).includes(text) ? (text as DeployFormat) : null;
}

function isNativeBinaryPath(relativePath: string): boolean {
  return /\.(dll|so|dylib)$/i.test(relativePath);
}

// A flat shape, not a discriminated union: this project compiles without strictNullChecks,
// where boolean-literal discriminants do not narrow reliably.
type DeployFormatResolution = {
  ok: boolean;
  format: DeployFormat;
  source: 'request' | 'config' | 'default';
  error?: string;
  value?: string;
};

/**
 * Request override -> persisted config -> `loose`. An explicit BAD request value is an
 * error (the caller asked for something that does not exist and must not silently get
 * something else). A bad PERSISTED value fails soft to the default — a corrupt config.json
 * must never brick deployment (same principle as the SEC3 config-parse hardening).
 */
function resolveDeployFormat(requested: unknown): DeployFormatResolution {
  if (requested !== undefined && requested !== null && String(requested).trim() !== '') {
    const normalized = normalizeDeployFormat(requested);
    if (!normalized) {
      return {
        ok: false,
        format: DEFAULT_DEPLOY_FORMAT,
        source: 'request',
        error: `Unknown deploy format "${String(requested)}". Use "loose" or "catalog".`,
        value: String(requested),
      };
    }
    return { ok: true, format: normalized, source: 'request' };
  }
  let stored: unknown;
  try { stored = (readXsdConfig() as any)?.deployFormat; } catch { stored = undefined; }
  const storedFormat = normalizeDeployFormat(stored);
  if (storedFormat) return { ok: true, format: storedFormat, source: 'config' };
  return { ok: true, format: DEFAULT_DEPLOY_FORMAT, source: 'default' };
}

/**
 * B84 — the plain-language account of what a deploy actually wrote. The author should never
 * have to infer packaging from a file listing; every deploy says what it produced and what
 * that means for them.
 */
function describeDeployFormat(format: DeployFormat, report: ArtifactBuildReport | null) {
  const natives = report?.nativeBinaries || [];
  const overrides = report?.preservationOverrides || [];
  const overrideNote = overrides.length
    ? [
        `${overrides.length} ".forgekeep" entry(ies) name paths this mod actually builds ` +
        `(${overrides.slice(0, 5).join(', ')}${overrides.length > 5 ? `, +${overrides.length - 5} more` : ''}), ` +
        `so the freshly built version was deployed and the keep-hint had no effect. Remove them from ` +
        `.forgekeep — keep-hints are for files the build does NOT produce, like an external bridge folder.`,
      ]
    : [];
  if (format === 'catalog') {
    const volumes = report?.catalogVolumes ?? 0;
    const packed = report?.includedFiles ?? 0;
    const loose = report?.outputFiles ?? 0;
    const summary =
      `Packed as CAT/DAT: ${packed} file(s) were packed into ${volumes} catalog volume(s) ` +
      `(ext_NN.cat + ext_NN.dat) alongside ${loose} loose file(s). X4 reads the archive normally, ` +
      `but the packed files no longer exist individually on disk — you cannot open, diff, or hand-edit ` +
      `them in the deployed folder.`;
    const warnings = natives.length
      ? [
          `${natives.length} native binary file(s) were packed INTO the archive: ${natives.slice(0, 5).join(', ')}` +
          `${natives.length > 5 ? `, +${natives.length - 5} more` : ''}. Windows cannot load a DLL from inside ` +
          `a .cat/.dat, so any feature that depends on them will fail at runtime with no error in the game log. ` +
          `Deploy as loose files if this mod loads native code.`,
        ]
      : [];
    return { mode: format, summary, warnings: [...warnings, ...overrideNote] };
  }
  const written = report?.outputFiles ?? report?.includedFiles ?? 0;
  return {
    mode: format,
    summary:
      `Deployed as loose files: ${written} file(s) written directly into the mod folder. ` +
      `Every file is readable, diffable, and hand-editable on disk, and native binaries load normally. ` +
      `This is the format most X4 mods ship in.`,
    warnings: overrideNote,
  };
}

function activeBuildWorkspace(workspaceInput: unknown): ModWorkspace {
  const sanitized = sanitizeWorkspace(workspaceInput);
  return {
    ...sanitized,
    nodes: (sanitized.nodes || []).filter(n => n.includeInBuild !== false),
    uiWidgets: (sanitized.uiWidgets || []).filter(w => w.includeInBuild !== false),
    aiScripts: (sanitized.aiScripts || []).filter(s => s.includeInBuild !== false),
    wares: (sanitized.wares || []).filter(w => w.includeInBuild !== false),
    jobs: (sanitized.jobs || []).filter(j => j.includeInBuild !== false),
    tFiles: (sanitized.tFiles || []).filter(t => t.includeInBuild !== false),
    xmlPatches: (sanitized.xmlPatches || []).filter(p => p.includeInBuild !== false)
  };
}

/**
 * Namespace the mod's OWN AI scripts (and the job <task script> references that point to
 * them) with the mod id, so two studio-made mods don't ship colliding generic filenames
 * like aiscripts/hunter.escort.behavior.xml — a real cross-mod conflict the Extension
 * Doctor flags. Base-game script refs (move.*, order.*, etc.) are NOT the mod's own and
 * are left untouched. `ws` is a fresh sanitized copy, so mutating it here is safe.
 */
function namespaceModAiScripts(ws: ModWorkspace, modId: string): void {
  const scripts = ws.aiScripts || [];
  if (!scripts.length) return;
  // #65: imported scripts (namespaced:true) keep their FINAL name — never re-prefix a
  // foreign-namespaced script with this workspace's modId. Authored scripts get prefixed
  // and then flagged final (idempotent). Job task-refs that point at an own script that
  // actually got renamed are updated to match.
  const renames = new Map<string, string>();
  for (const s of scripts) {
    if (!s.name) continue;
    const final = namespaceAiScriptName(s.name, modId, s.namespaced === true);
    if (final !== s.name) renames.set(s.name, final);
    s.name = final;
    s.namespaced = true;
  }
  for (const job of ws.jobs || []) {
    if (job.taskScript && renames.has(job.taskScript)) {
      job.taskScript = renames.get(job.taskScript)!;
    }
  }
}

function buildWorkspaceFileManifest(workspaceInput: unknown, options: { includePassthrough?: boolean } = {}): { modId: string; files: CompiledFileManifest } {
  const ws = activeBuildWorkspace(workspaceInput);
  const modId = effectiveModId(ws);
  namespaceModAiScripts(ws, modId);
  const files: CompiledFileManifest = {};
  const settings = ws.compileSettings || { md: true, ui: true, ai: true, library: true, translations: true, patches: true };

  files["content.xml"] = contentXmlFor(modId, ws);
  files["README.md"] = `# ${ws.name || modId}\n\nGenerated by X4 Forge.\n\nInstall location:\n\n\`\`\`\nX4 Foundations/extensions/${modId}/\n\`\`\`\n\nRuntime reload during development: save files, then run \`refreshmd\` in X4's debug command input.\n`;
  
  if (settings.md) {
    // MULTI-SCRIPT export: group cue nodes by their owning file stem (tagged on import) and emit
    // one <mdscript> per file at its original path, with its original <mdscript name>. Single-
    // script and freshly-built mods (cues without a stem) fall back to one file at the mod id.
    const cueNodes = (ws.nodes || []).filter((n: any) => n.type === 'cue');
    const subCueIds = new Set((ws.links || []).filter((l: any) => l.sourcePortId === 'out_sub').map((l: any) => l.targetNodeId));
    const stems = Array.from(new Set(cueNodes
      .map((c: any) => c.properties?.mdFileStem)
      .filter((s: any) => typeof s === 'string' && /^[\w.-]+$/.test(s))));
    if (stems.length > 0) {
      for (const stem of stems) {
        const topCueIds = cueNodes
          .filter((c: any) => c.properties?.mdFileStem === stem && !subCueIds.has(c.id))
          .map((c: any) => c.id);
        const scriptName = cueNodes.find((c: any) => c.properties?.mdFileStem === stem)?.properties?.mdScript || String(stem);
        files[`md/${stem}.xml`] = generateMDXML(ws, topCueIds, scriptName);
      }
      // Cues with no stem (newly created in-canvas) → emit under the mod id.
      const orphanTop = cueNodes.filter((c: any) => !c.properties?.mdFileStem && !subCueIds.has(c.id)).map((c: any) => c.id);
      if (orphanTop.length > 0) files[`md/${modId}.xml`] = generateMDXML(ws, orphanTop);
    } else {
      const mdStem = (ws.mdFileStem && /^[\w.-]+$/.test(ws.mdFileStem)) ? ws.mdFileStem : modId;
      files[`md/${mdStem}.xml`] = generateMDXML(ws);
    }
  }

  if (settings.ui && ws.uiWidgets?.length) {
    // X4-correct UI packaging: an extension-root ui.xml index registering a Lua
    // entry point under ui/. (The legacy md_ui_layouts/<id>_ui.xml used a
    // non-standard <ui_menu> schema X4 ignores; it is no longer packaged but is
    // still available as a design-time descriptor via generateUIXML.)
    files["ui.xml"] = generateUIIndexXML(ws, modId);
    files[`ui/${modId}.lua`] = generateUILuaScript(ws, modId);
  }

  if (settings.ai) {
    for (const script of ws.aiScripts || []) {
      const fileName = script.name.endsWith(".xml") ? script.name : `${script.name}.xml`;
      files[`aiscripts/${fileName}`] = compileScriptToXML(script);
    }
  }

  if (settings.library) {
    if (ws.wares?.length) {
      files["libraries/wares.xml"] = compileWaresXML(ws.wares);
    }
    if (ws.jobs?.length) {
      files["libraries/jobs.xml"] = compileJobsXML(ws.jobs);
    }
  }

  if (settings.translations) {
    for (const tFile of ws.tFiles || []) {
      files[`t/${toTFileName(tFile)}`] = compileTFileXML(tFile);
    }
  }

  if (settings.patches && ws.xmlPatches?.length) {
    const patchesByFile: Record<string, PatchBlock[]> = {};
    ws.xmlPatches.forEach((patch) => {
      const file = patch.targetFile || "libraries/wares.xml";
      if (!patchesByFile[file]) {
        patchesByFile[file] = [];
      }
      patchesByFile[file].push(patch);
    });

    for (const [filePath, filePatches] of Object.entries(patchesByFile)) {
      files[filePath] = compileDiffDocument(filePatches, filePath);
    }
  }

  // Passthrough files preserved from an imported mod. Generated output always
  // wins a path collision so the studio's modeled domains stay authoritative.
  for (const pf of (options.includePassthrough === false ? [] : (ws.passthroughFiles || []))) {
    if (!pf || typeof pf.path !== 'string') continue;
    const rel = pf.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rel || rel.includes('..')) continue;
    if (pf.omitted || pf.content === undefined) continue; // tracked-not-loaded: preserved on disk, never overwrite with empty
    if (files[rel] === undefined) {
      files[rel] = pf.content;
    }
  }

  applyOriginalModeledFiles(ws, files);

  return { modId, files };
}

function summarizeWorkspaceDomains(ws: ModWorkspace) {
  return {
    nodes: ws.nodes?.length || 0,
    links: ws.links?.length || 0,
    uiWidgets: ws.uiWidgets?.length || 0,
    tFiles: ws.tFiles?.length || 0,
    aiScripts: ws.aiScripts?.length || 0,
    wares: ws.wares?.length || 0,
    jobs: ws.jobs?.length || 0,
    xmlPatches: ws.xmlPatches?.length || 0
  };
}

type GameLogIssue = {
  severity: "error" | "warning";
  lineNumber: number;
  text: string;
  matchesActiveMod: boolean;
  sourceRef?: { kind: string; file?: string; line?: number; label?: string };
};

function uniqueExistingParentCandidates(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths
    .filter(Boolean)
    .map(candidate => path.normalize(candidate))
    .filter(candidate => {
      const key = candidate.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function findDebugLogCandidates(): string[] {
  const resolved = resolveXsdConfig();
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const docs = home ? path.join(home, "Documents", "Egosoft", "X4") : "";
  const candidates = [
    // User-configured log path takes priority.
    resolved.x4LogPath || "",
    path.join(process.cwd(), "debuglog.txt"),
    path.join(process.cwd(), "uidata.log"),
    resolved.x4GamePath ? path.join(resolved.x4GamePath, "debuglog.txt") : "",
    resolved.x4GamePath ? path.join(resolved.x4GamePath, "uidata.log") : ""
  ];

  if (docs && fs.existsSync(docs)) {
    try {
      for (const profileName of fs.readdirSync(docs)) {
        const profilePath = path.join(docs, profileName);
        if (fs.existsSync(profilePath) && fs.statSync(profilePath).isDirectory()) {
          candidates.push(path.join(profilePath, "debuglog.txt"));
          candidates.push(path.join(profilePath, "uidata.log"));
        }
      }
    } catch {
      // Candidate discovery is best-effort; callers still get explicit paths checked.
    }
  }

  return uniqueExistingParentCandidates(candidates);
}

function readTail(filePath: string, maxBytes: number): string {
  const stat = fs.statSync(filePath);
  const bytesToRead = Math.min(stat.size, maxBytes);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf8");
}

/**
 * Map an X4 log line back to a Studio source reference where possible. X4 errors
 * commonly name the MD script and a line, e.g. "* Error in MD script
 * 'sector_bounty_hunter' ... line 18" or "(md.Foo.Cue): ...". Deterministic, no AI.
 */
function mapLogLineToSourceRef(text: string): { kind: string; file?: string; line?: number; label?: string } | undefined {
  const scriptQuoted = text.match(/(?:md script|script)\s+'([\w.-]+)'/i)?.[1]
    || text.match(/\bmd\.([\w]+)\b/i)?.[1];
  const lineNo = text.match(/\bline\s+(\d+)/i)?.[1];
  const cue = text.match(/cue\s+'([\w.-]+)'/i)?.[1];
  if (scriptQuoted) {
    const base = scriptQuoted.replace(/^md\./i, '');
    return { kind: 'md_file', file: `md/${base}.xml`, line: lineNo ? Number(lineNo) : undefined, label: cue ? `cue ${cue}` : undefined };
  }
  return undefined;
}

function analyzeGameLog(tail: string, modIds: string[]): { issues: GameLogIssue[]; tailLines: string[] } {
  // Match against a SET of candidate identifiers, not one. A hand-authored mod's real
  // extension folder/content id (e.g. "ai_influence_test") can differ from the id the
  // Studio derives from the display name (toSafeModId("AI Influence Test Mod") =
  // "ai_influence_test_mod"). Matching only the derived id silently misses the mod's real
  // log lines → a dangerous false "all clear". So we test every candidate.
  const mods = Array.from(new Set((modIds || []).map(m => (m || '').toLowerCase()).filter(m => m.length >= 3)));
  const lines = tail.split(/\r?\n/).filter(line => line.trim().length > 0);
  const baseLine = Math.max(1, lines.length - 1);
  const issuePattern = /\b(error|warning|failed|exception|invalid|not allowed|rejected|could not|unable to)\b/i;
  const issues = lines
    .map((text, index) => ({ text, index }))
    .filter(({ text }) => issuePattern.test(text))
    .map(({ text, index }) => ({
      severity: /\b(warning|warn)\b/i.test(text) && !/\berror\b/i.test(text) ? "warning" as const : "error" as const,
      lineNumber: baseLine + index,
      text,
      matchesActiveMod: mods.length > 0 && mods.some(m => text.toLowerCase().includes(m)),
      sourceRef: mapLogLineToSourceRef(text)
    }));

  return {
    issues,
    tailLines: lines.slice(-120)
  };
}

interface LogHypothesis {
  code: 'djfhe_require' | 'truncated_or_malformed' | 'signal_library' | 'duplicate_addon' | 'code_never_ran';
  confidence: 'high' | 'medium';
  evidence: string;
  explanation: string;
  suggestion: string;
}

type DebugTimelineKind = "deploy" | "file_load" | "marker" | "cue" | "issue" | "runtime_fault";

type DebugTimelineItem = {
  kind: DebugTimelineKind;
  severity: "info" | "warning" | "error";
  label: string;
  lineNumber?: number;
  evidence: string;
};

type ExpectedDebugStep = {
  step: string;
  seen: boolean;
  evidence?: string;
};

/**
 * Deterministic root-cause layer over the live log. NOT an AI guess — a fixed
 * symptom→cause table plus a markersSeen signal. Each hypothesis is something a
 * named log pattern justifies. `markersSeen` distinguishes "X4 merely READ the mod's
 * files" (file-IO/signature lines only) from "the mod's own code actually RAN" (a
 * non-file-IO line mentioning the mod, e.g. a DebugError marker) — the exact inference
 * that found the refreshmd chat-window bug ("UI registered but MD never fired").
 */
function deriveLogDiagnosis(tail: string, modIds: string[], activeIssues: { severity: string; text: string }[]): { filesLoaded: boolean; markersSeen: boolean; hypotheses: LogHypothesis[] } {
  const mods = (modIds || []).map(m => (m || '').toLowerCase()).filter(m => m.length >= 3);
  // BOUNDED + substring-only. Runs on every 4s watcher poll over a 256KB tail, so it must be
  // cheap and free of regex backtracking: cap to the last 400 lines and use indexOf checks.
  const lines = String(tail || '').split(/\r?\n/).slice(-400);
  const lc = lines.map(l => l.toLowerCase());
  const modLineIdx = lines.map((_, i) => i).filter(i => mods.some(m => lc[i].includes(m)));
  const isFileLoadLine = (x: string) => x.includes('[fileio') || x.includes('signature') || x.includes('loading extension') || x.includes(".xml'") || x.includes(".lua'");
  const filesLoaded = modLineIdx.length > 0;
  const markersSeen = modLineIdx.some(i => !isFileLoadLine(lc[i]));
  const findLine = (pred: (x: string) => boolean) => { for (let i = 0; i < lines.length; i++) if (pred(lc[i])) return lines[i]; return ''; };
  const hyp: LogHypothesis[] = [];
  let m = '';
  if ((m = findLine(x => x.includes('loop or previous error loading module') || (x.includes('module') && x.includes('not found')) || x.includes('no such module')))) {
    hyp.push({ code: 'djfhe_require', confidence: 'high', evidence: m.trim().slice(0, 200),
      explanation: 'A Lua require failed or poisoned the module cache.',
      suggestion: 'Require only "djfhe.http.request" LAZILY at call time; never require "djfhe.http.client" and never add a broad "extensions/?.lua" to package.path.' });
  }
  if ((m = findLine(x => x.includes("couldn't find end of start tag") || x.includes('unexpected end of') || x.includes('premature end') || x.includes('not well-formed') || x.includes('xml parse')))) {
    hyp.push({ code: 'truncated_or_malformed', confidence: 'high', evidence: m.trim().slice(0, 200),
      explanation: 'A deployed XML file is truncated or malformed.',
      suggestion: 'Re-deploy from the host (Forge), verify byte length via extension-file. Stale/truncated sandbox-mount bytes are the usual cause.' });
  }
  if ((m = findLine(x => x.includes('has no corresponding library')))) {
    hyp.push({ code: 'signal_library', confidence: 'high', evidence: m.trim().slice(0, 200),
      explanation: 'A signal_cue targeted a <library>.',
      suggestion: 'Invoke libraries with <run_actions ref="..."> (purpose="run_actions"), not signal_cue.' });
  }
  if ((m = findLine(x => (x.includes('registered already') || x.includes('duplicate') || x.includes('already exists')) && (x.includes('addon') || x.includes('extension') || x.includes('menu') || x.includes('cue') || x.includes(' id'))))) {
    hyp.push({ code: 'duplicate_addon', confidence: 'medium', evidence: m.trim().slice(0, 200),
      explanation: 'A duplicate addon/extension is loaded — usually a stale sibling folder (e.g. <id>_mod).',
      suggestion: 'Confirm the deployed folder name matches what X4 loads; remove the orphan via extension-doctor / delete-dir.' });
  }
  const hasRealActiveError = activeIssues.some(i => i.severity === 'error' && !i.text.toLowerCase().includes('signature'));
  if (filesLoaded && !markersSeen && !hasRealActiveError) {
    hyp.push({ code: 'code_never_ran', confidence: 'medium', evidence: 'mod files appear in the log, but no mod-authored marker line does',
      explanation: 'X4 read the mod files but no mod code (script/Lua marker) ran — a trigger likely never fired.',
      suggestion: 'If you reloaded with refreshmd, a cue gated on <event_game_loaded> will NOT fire — use a conditionless cue, or load a save. Confirm your [MARKER] DebugError lines appear once it runs.' });
  }
  return { filesLoaded, markersSeen, hypotheses: hyp };
}

/**
 * Deterministic state model for the live feedback loop. Pure function so it can
 * be unit-tested with synthetic log content.
 */
function computeGameStates(args: { tail: string; modIds: string[]; deployed: boolean; stale: boolean }) {
  const { tail, modIds, deployed, stale } = args;
  const { issues } = analyzeGameLog(tail, modIds);
  const active = issues.filter(i => i.matchesActiveMod);
  const mods = (modIds || []).map(m => (m || '').toLowerCase()).filter(m => m.length >= 3);
  const seenByX4 = mods.some(m => tail.toLowerCase().includes(m));
  const runtimeErrors = active.some(i => i.severity === 'error');
  return {
    deployed,                                   // a Studio deploy happened
    seenByX4: seenByX4 && !stale,               // the (fresh) log mentions the extension id
    loadedCleanly: seenByX4 && !stale && !runtimeErrors,
    runtimeErrors,
    activeIssueCount: active.length
  };
}

// Cue/library names the DEPLOYED mod defines — read straight from its md/*.xml on disk. Lets the
// watcher report CUE LIVENESS (are the mod's cues actually firing in the log?) independent of whether
// the mod prints its own name or emits debug markers. This is the signal that catches a silently-dead
// cue (e.g. an event handler that isn't instantiate="true", or one whose body skips on a bad read) —
// exactly the class of bug the error-grep + markersSeen heuristics miss.
function collectDeployedModCueNames(modId: string): string[] {
  const resolved = resolveXsdConfig();
  const names = new Set<string>();
  const roots = [resolved.filesystemPath, resolved.modWorkspacePath].filter(Boolean) as string[];
  const re = /<(?:cue|library)\b[^>]*\bname\s*=\s*"([^"]+)"/g;
  const readMdDir = (mdDir: string): boolean => {
    let files: string[] = [];
    try { files = fs.readdirSync(mdDir).filter(f => f.toLowerCase().endsWith(".xml")); } catch { return false; }
    for (const f of files.slice(0, 60)) {
      try {
        const txt = fs.readFileSync(path.join(mdDir, f), "utf8");
        let m: RegExpExecArray | null; re.lastIndex = 0;
        while ((m = re.exec(txt))) { if (m[1] && m[1].length >= 2) names.add(m[1]); }
      } catch { /* skip unreadable file */ }
    }
    return files.length > 0;
  };
  // The watcher modId (content.xml id, e.g. "ai_influence") often differs from the deployed FOLDER
  // name (e.g. "x4_ai_influence"). Try the obvious folder variants, then a bounded name-contains scan.
  const bare = modId.toLowerCase().replace(/^x4_/, "");
  const candidates = Array.from(new Set([modId, `x4_${modId}`, `${modId}_mod`, bare]));
  for (const root of roots) {
    for (const folder of candidates) {
      readMdDir(path.join(root, folder, "md"));
      if (names.size > 0) return Array.from(names);
    }
    try {
      for (const entry of fs.readdirSync(root)) {
        if (entry.toLowerCase().includes(bare)) {
          readMdDir(path.join(root, entry, "md"));
          if (names.size > 0) return Array.from(names);
        }
      }
    } catch { /* root unreadable */ }
  }
  return Array.from(names);
}

// The mod's own LOG MARKER(s) — mods print under an arbitrary prefix (e.g. `DebugError("[AICHAT][UIX] …")`),
// NOT their extension id, so an id-grep never sees them. Scan the deployed mod's Lua for the bracket prefix
// used in DebugError/print calls so the watcher can recognise the mod's lines (and the errors next to them).
function collectModLogMarkers(modId: string): string[] {
  // Audit A8: dir resolution deduped — findDeployedModDir owns the candidate logic.
  const markers = new Set<string>();
  const callRe = /(?:DebugError|print)\s*\(\s*["'`]\s*\[([A-Za-z][A-Za-z0-9_]{3,})\]/g;
  for (const f of collectModLuaFiles(modId)) {
    let m: RegExpExecArray | null; callRe.lastIndex = 0;
    while ((m = callRe.exec(f.source))) markers.add(m[1].toLowerCase());
  }
  return Array.from(markers);
}

/** Resolve the deployed folder for a mod id (same candidate logic as the marker scan). */
function findDeployedModDir(modId: string): string {
  const resolved = resolveXsdConfig();
  const roots = [resolved.filesystemPath, resolved.modWorkspacePath].filter(Boolean) as string[];
  const bare = modId.toLowerCase().replace(/^x4_/, "");
  const candidates = Array.from(new Set([modId, `x4_${modId}`, `${modId}_mod`, bare]));
  for (const root of roots) {
    for (const folder of candidates) {
      const d = path.join(root, folder);
      try { if (fs.statSync(d).isDirectory()) return d; } catch { /* */ }
    }
    try {
      for (const ent of fs.readdirSync(root)) {
        if (ent.toLowerCase().includes(bare)) {
          const d = path.join(root, ent);
          if (fs.statSync(d).isDirectory()) return d;
        }
      }
    } catch { /* */ }
  }
  return "";
}

/** The deployed mod's ui *.lua files (path relative to mod dir + source), for staleness checks. */
function collectModLuaFiles(modId: string): { path: string; source: string; absPath: string }[] {
  const modDir = findDeployedModDir(modId);
  if (!modDir) return [];
  const out: { path: string; source: string; absPath: string }[] = [];
  const scan = (dir: string, depth: number) => {
    if (depth > 4 || out.length >= 50) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.slice(0, 300)) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) scan(full, depth + 1);
      else if (/\.lua$/i.test(e.name)) {
        try { out.push({ path: path.relative(modDir, full).replace(/\\/g, "/"), source: fs.readFileSync(full, "utf8"), absPath: full }); } catch { /* skip */ }
      }
    }
  };
  scan(path.join(modDir, "ui"), 0);
  return out;
}

// A REAL engine/Lua fault signature — phrases the ENGINE emits, not text a mod author chose to print.
// Crucial in X4: mods can only log via DebugError (which the engine stamps "[=ERROR=]"), so the "[=ERROR=]"
// prefix and the bare word "error" appear on the mod's BENIGN heartbeat too and cannot be the signal. A
// genuine fault carries one of these distinctive engine strings instead.
const ENGINE_FAULT_SIG = /invalid argument|got cdata|cannot run actions|error in (md|ai) (cue|script)|attempt to (call|index)|stack traceback|a nil value|no corresponding library|couldn't find end|not well-formed|premature end|unknown (parameter|keyword)|failed to (load|run|parse|compile)/i;

// Attribute genuine engine faults to the mod by PROXIMITY to its own log markers: a
// "GetComponentData(): Invalid argument … got cdata" thrown inside the mod's UIX reader is logged with no
// cue/mod name, but right next to a "[AICHAT][UIX] …" line. Count only fault-signature lines adjacent to a
// marker (the marker line itself is the mod's benign info, excluded) → precise RED, no heartbeat noise.
function countModRuntimeErrors(tail: string, markers: string[]): { count: number; markerLines: number; samples: string[] } {
  if (!markers.length) return { count: 0, markerLines: 0, samples: [] };
  const lines = String(tail || "").split(/\r?\n/).slice(-2000);
  const lc = lines.map(l => l.toLowerCase());
  const markerIdx = new Set<number>();
  for (let i = 0; i < lines.length; i++) if (markers.some(m => lc[i].includes(m))) markerIdx.add(i);
  if (!markerIdx.size) return { count: 0, markerLines: 0, samples: [] };
  const samples: string[] = [];
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (markerIdx.has(i)) continue;            // the mod's own marker line = benign info, never the fault
    if (!ENGINE_FAULT_SIG.test(lines[i])) continue;
    let near = false;
    for (let d = -3; d <= 3; d++) if (markerIdx.has(i + d)) { near = true; break; }
    if (near) { count++; if (samples.length < 6) samples.push(lines[i].trim().slice(0, 200)); }
  }
  return { count, markerLines: markerIdx.size, samples };
}

function getGameLogStatus(modIdInput?: string) {
  const raw = String(modIdInput || lastDeployInfo?.workspaceName || activeWorkspace.name || '');
  const modId = toSafeModId(raw); // primary id for display
  // Candidate identifiers the log line might actually use — covers the display name, its
  // space/underscore forms, and the common display-name→folder-id drift (a trailing "_mod"
  // that the real extension folder doesn't have). Matching any of these avoids false all-clear.
  const bareId = modId.replace(/_mod$/, '');
  // The mod's OWN log marker(s), scanned from its Lua (e.g. "aichat" from `DebugError("[AICHAT][UIX] …")`).
  // This is what X4 actually prints — mods log under a prefix, not their extension id — so matching it is
  // how the watcher recognises the mod's lines + the errors next to them. (Ken: "it's looking for ai_influence".)
  const modMarkers = collectModLogMarkers(modId);
  const modIds = Array.from(new Set([
    modId,
    raw.toLowerCase().trim(),
    raw.toLowerCase().trim().replace(/\s+/g, '_'),
    bareId,
    // X4's log uses the DEPLOYED FOLDER id, which is often the metadata name with an `x4_` prefix
    // (e.g. metadata "AI Influence" → folder "x4_ai_influence").
    `x4_${modId}`,
    `x4_${bareId}`,
    // NOTE: deliberately NOT including the mod's DebugError marker (e.g. "aichat") here. X4 emits EVERY
    // mod DebugError line as "[=ERROR=] … [AICHAT][UIX] …" — the only log channel a mod has — so matching
    // the marker in this generic error grep flags the mod's normal heartbeat as 34 false "errors". The
    // marker is used for liveness (markersSeen) and precise runtime-fault attribution below, not here.
  ].filter(s => s && s.length >= 3)));
  const candidates = findDebugLogCandidates();
  const selectedLogPath = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  const relevantLastDeploy = lastDeployInfo?.modId === modId ? lastDeployInfo : null;

  if (!selectedLogPath) {
    return {
      status: "no_log",
      modId,
      summary: "No debuglog.txt or uidata.log file was found in the known X4 log locations.",
      selectedLogPath: "",
      checkedPaths: candidates,
      lastDeploy: relevantLastDeploy,
      issues: [],
      tailLines: []
    };
  }

  const stat = fs.statSync(selectedLogPath);
  const tail = readTail(selectedLogPath, 256 * 1024);
  const { issues, tailLines } = analyzeGameLog(tail, modIds);
  // CUE-CORRELATED ERRORS — tie each X4 error line back to the mod CUE that threw it (the error
  // line names the cue, e.g. "Error in MD cue ...worldsync.Tick: Cannot run actions of library
  // ...Do_sync"). This is the RED signal: which of the mod's own cues are failing, by name.
  // NOTE: we deliberately do NOT treat cue-SILENCE as a fault — a healthy mod that doesn't print
  // debug markers logs nothing, so "0 cues seen" is normal and must never raise a false "inert".
  const modCueNames = collectDeployedModCueNames(modId);
  const cueTelemetry = modCueNames.length ? parseLogTelemetry(tail, modCueNames).cues : [];
  const erroringCues = cueTelemetry.filter(c => c.errors > 0).sort((a, b) => b.errors - a.errors);
  const firingCues = cueTelemetry.filter(c => c.hits > 0 && c.errors === 0).sort((a, b) => b.hits - a.hits);
  const cueLiveness = {
    totalCues: modCueNames.length,
    erroringCount: erroringCues.length,
    firingCount: firingCues.length,
    // RED — cues with errors in the log (clickable → navigate to the node).
    erroring: erroringCues.slice(0, 16).map(c => ({ name: c.name, errors: c.errors, hits: c.hits, lastLineNo: c.lastLineNo })),
    // GREEN — cues observed firing cleanly.
    firing: firingCues.slice(0, 16).map(c => ({ name: c.name, hits: c.hits })),
  };
  // RUNTIME (Lua) ERRORS — the mod's own DebugError/print marker (e.g. "[AICHAT][UIX]") tags its lines,
  // but a Lua engine error it triggers (e.g. "GetComponentData(): Invalid argument … got cdata") is logged
  // as a bare [=ERROR=] line that names NO cue and NO mod. Attribute [=ERROR=] lines that sit right next to
  // the mod's marker lines to the mod → this is the RED Ken wanted (errors the cue-grep alone can't see).
  const runtime = countModRuntimeErrors(tail, modMarkers);
  // LUA STALENESS (#7, RC-killer class) — compare the RESIDENT Lua version the game
  // logged at boot (FORGE-LUAV marker) against the current on-disk file. X4 quickload
  // does NOT reload ui/*.lua, so a mismatch means the MD and Lua halves are running
  // different versions — full restart required. Honest tri-state when uninstrumented.
  const luaStaleness = assessLuaStaleness(collectModLuaFiles(modId).map(f => ({ path: f.path, source: f.source })), tail);
  // BENIGN LOG NOISE — X4 logs "[error] [FileIO] Failed to verify the file signature for file … (error: 14)"
  // for EVERY unsigned loose mod file at load. It's harmless (the mod still loads in modified mode) and
  // PERMANENT for any dev mod, so counting it would pin the watcher red forever. A file that's actually broken
  // surfaces as an XML-parse / cue error instead (still caught). Exclude signature-verification noise from RED.
  const BENIGN_LOG_NOISE = /verify the file signature/i;
  const activeIssues = issues.filter(issue => issue.matchesActiveMod);
  const signatureNotices = activeIssues.filter(issue => BENIGN_LOG_NOISE.test(issue.text));
  const activeErrors = activeIssues.filter(issue => issue.severity === "error" && !BENIGN_LOG_NOISE.test(issue.text));
  const activeWarnings = activeIssues.filter(issue => issue.severity === "warning" && !BENIGN_LOG_NOISE.test(issue.text));
  const logUpdatedAt = stat.mtime.toISOString();
  const staleForLastDeploy = Boolean(relevantLastDeploy?.deployedAt && new Date(logUpdatedAt).getTime() < new Date(relevantLastDeploy.deployedAt).getTime());

  let status: "stale" | "errors" | "warnings" | "clean" = "clean";
  if (staleForLastDeploy) status = "stale";
  else if (activeErrors.length > 0) status = "errors";
  else if (activeWarnings.length > 0) status = "warnings";

  const baseSummary = status === "stale"
    ? "A log file was found, but it has not changed since the last Studio deploy."
    : status === "errors"
      ? `${activeErrors.length} active-mod error(s) found in recent X4 log output.`
      : status === "warnings"
        ? `${activeWarnings.length} active-mod warning(s) found in recent X4 log output.`
        : `No recent X4 errors or warnings mentioning "${modId}" were found in the tailed log.`;
  // Per-cue ERRORS are the real RED signal — a cue throwing in the log is a fault regardless of the
  // mod-name grep. Escalate to errors and name the failing cues. Cue SILENCE is NOT a fault.
  if (cueLiveness.erroringCount > 0 && status !== "stale") status = "errors";
  // Runtime Lua errors adjacent to the mod's marker are RED too, even when no cue is named.
  if (runtime.count > 0 && status !== "stale") status = "errors";
  // Resident-Lua staleness is at least a WARNING — the mod halves are running mismatched versions.
  if (luaStaleness.restartRequired && status === "clean") status = "warnings";
  const runtimeNote = runtime.count > 0
    ? ` ✗ ${runtime.count} runtime error(s) logged next to the mod's "${modMarkers.join('/')}" marker (likely the mod's Lua): ${runtime.samples.slice(0, 2).join(' | ')}`
    : "";
  const cueNote = cueLiveness.erroringCount > 0
    ? ` ✗ ${cueLiveness.erroringCount} of the mod's cues are THROWING ERRORS: ${cueLiveness.erroring.map(c => `${c.name}(${c.errors})`).join(', ')}.`
    : cueLiveness.firingCount > 0
      ? ` ${cueLiveness.firingCount} of the mod's cues are firing cleanly.`
      : cueLiveness.totalCues > 0
        ? ` (No cue activity for this mod in the tail — a healthy mod that emits no debug markers logs nothing, so this alone is not a fault.)`
        : "";
  const staleNote = luaStaleness.restartRequired ? ` ${luaStaleness.summary}` : "";
  const summary = baseSummary + cueNote + runtimeNote + staleNote;

  const states = computeGameStates({ tail, modIds, deployed: Boolean(relevantLastDeploy), stale: staleForLastDeploy });

  return {
    status,
    modId,
    summary,
    cueLiveness,
    // Mod runtime (Lua) errors detected by marker-proximity — RED even when no cue is named.
    modMarkers,
    modRuntime: { markersSeen: runtime.markerLines > 0, markerLines: runtime.markerLines, errorCount: runtime.count, samples: runtime.samples },
    // Resident-vs-disk Lua version check (#7). unknown_* verdicts are honest, not faults.
    luaStaleness,
    // Explicit pipeline states: Compiled -> Deployed -> Seen by X4 -> Loaded cleanly -> Runtime errors.
    states,
    selectedLogPath,
    checkedPaths: candidates,
    logUpdatedAt,
    logBytes: stat.size,
    lastDeploy: relevantLastDeploy,
    // Benign: unsigned-file signature notices X4 logs at load for every loose mod file (not a fault).
    signatureNotices: signatureNotices.length,
    counts: {
      allIssues: issues.length,
      activeIssues: activeIssues.length,
      activeErrors: activeErrors.length,
      activeWarnings: activeWarnings.length
    },
    issues: activeIssues.slice(-50),
    recentGlobalIssues: issues.slice(-20),
    // Deterministic root-cause layer: named hypotheses + markersSeen (did the mod's own code run?).
    // Pass the mod's DebugError marker alongside the ids so "markers seen" reflects the mod actually
    // logging (its "[AICHAT][UIX] …" lines), even though the marker is kept out of the error grep above.
    diagnosis: deriveLogDiagnosis(tail, [...modIds, ...modMarkers], activeIssues),
    tailLines
  };
}

function classifyTimelineLine(line: string, lineNumber: number, modIds: string[], markers: string[], cueNames: string[]): DebugTimelineItem | null {
  const raw = String(line || "").trim();
  if (!raw) return null;
  const lc = raw.toLowerCase();
  const modHit = modIds.some(m => m && lc.includes(m.toLowerCase()));
  const markerHit = markers.find(m => m && lc.includes(m.toLowerCase()));
  const cueHit = cueNames.find(c => c && new RegExp(`(^|[^A-Za-z0-9_])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9_]|$)`).test(raw));
  const isFileLoad = lc.includes("[fileio") || lc.includes("signature") || lc.includes("loading extension") || lc.includes(".xml'") || lc.includes(".lua'");
  const isIssue = /\b(error|warning|failed|exception|invalid|not allowed|rejected|could not|unable to)\b/i.test(raw);

  if (ENGINE_FAULT_SIG.test(raw) && (markerHit || cueHit || modHit)) {
    return { kind: "runtime_fault", severity: "error", label: "Runtime fault", lineNumber, evidence: raw.slice(0, 240) };
  }
  if (cueHit && isIssue) {
    return { kind: "cue", severity: /warn/i.test(raw) && !/error/i.test(raw) ? "warning" : "error", label: `Cue ${cueHit}`, lineNumber, evidence: raw.slice(0, 240) };
  }
  if (cueHit) {
    return { kind: "cue", severity: "info", label: `Cue ${cueHit}`, lineNumber, evidence: raw.slice(0, 240) };
  }
  if (markerHit) {
    return { kind: "marker", severity: isIssue ? "warning" : "info", label: `[${markerHit.toUpperCase()}] marker`, lineNumber, evidence: raw.slice(0, 240) };
  }
  if (modHit && isFileLoad) {
    return { kind: "file_load", severity: "info", label: "Mod file seen by X4", lineNumber, evidence: raw.slice(0, 240) };
  }
  if (modHit && isIssue && !/verify the file signature/i.test(raw)) {
    return { kind: "issue", severity: /warn/i.test(raw) && !/error/i.test(raw) ? "warning" : "error", label: "Active-mod issue", lineNumber, evidence: raw.slice(0, 240) };
  }
  return null;
}

function buildDebugWatcherBrief(modIdInput?: string, expectedInput: string[] = []) {
  const status: any = getGameLogStatus(modIdInput);
  if (!status.selectedLogPath || !fs.existsSync(status.selectedLogPath)) {
    return {
      ok: status.status !== "error",
      status,
      brief: status.summary || "No X4 debug log found.",
      // B19s2: the ONE server-computed answer to "loaded and clean?" — no client guessing.
      verdict: computeWatcherVerdict({ hasLog: false, logFresh: false, hasDeploy: Boolean(status.lastDeploy), changedSinceDeploy: false, markersSeen: false, cuesActive: false, errorCount: 0 }),
      timeline: [],
      expectedChain: [],
      sinceDeploy: { hasDeploy: Boolean(status.lastDeploy), changedSinceDeploy: false, summary: "No readable log to compare with deploy state." },
      artifact: `Debug Watcher Brief\nStatus: ${status.status}\nSummary: ${status.summary || ""}\n`
    };
  }

  const modId = status.modId || toSafeModId(String(modIdInput || ""));
  const bareId = String(modId).replace(/_mod$/, "");
  const raw = String(modIdInput || lastDeployInfo?.workspaceName || activeWorkspace.name || "");
  const modIds = Array.from(new Set([
    modId,
    raw.toLowerCase().trim(),
    raw.toLowerCase().trim().replace(/\s+/g, "_"),
    bareId,
    `x4_${modId}`,
    `x4_${bareId}`,
  ].filter(s => s && s.length >= 3)));
  const markers = Array.isArray(status.modMarkers) ? status.modMarkers : collectModLogMarkers(modId);
  const cueNames = collectDeployedModCueNames(modId);
  const tail = readTail(status.selectedLogPath, 256 * 1024);
  const lines = tail.split(/\r?\n/).filter(l => l.trim().length > 0);
  const baseLine = Math.max(1, lines.length - 399);
  const timeline = lines.slice(-400)
    .map((line, i) => classifyTimelineLine(line, baseLine + i, modIds, markers, cueNames))
    .filter(Boolean)
    .slice(-80) as DebugTimelineItem[];

  const firedCueNames = new Set<string>((status.cueLiveness?.firing || []).map((c: any) => String(c.name)));
  const errorCueNames = new Set<string>((status.cueLiveness?.erroring || []).map((c: any) => String(c.name)));
  const searchableEvidence = [
    ...timeline.map(t => `${t.label} ${t.evidence}`),
    ...(status.modMarkers || []),
  ].join("\n").toLowerCase();
  const expectedChain: ExpectedDebugStep[] = expectedInput
    .map(s => String(s || "").trim())
    .filter(Boolean)
    .map(step => {
      const bare = step.replace(/^(cue|marker):/i, "").trim();
      const seen = firedCueNames.has(bare) || errorCueNames.has(bare) || searchableEvidence.includes(bare.toLowerCase());
      const ev = timeline.find(t => t.evidence.toLowerCase().includes(bare.toLowerCase()) || t.label.toLowerCase().includes(bare.toLowerCase()));
      return { step, seen, evidence: ev?.evidence };
    });

  const logTime = status.logUpdatedAt ? new Date(status.logUpdatedAt).getTime() : 0;
  const deployTime = status.lastDeploy?.deployedAt ? new Date(status.lastDeploy.deployedAt).getTime() : 0;
  const changedSinceDeploy = Boolean(deployTime && logTime && logTime >= deployTime);
  const sinceDeploy = {
    hasDeploy: Boolean(status.lastDeploy),
    changedSinceDeploy,
    deployedAt: status.lastDeploy?.deployedAt,
    logUpdatedAt: status.logUpdatedAt,
    summary: !status.lastDeploy
      ? "No Studio deploy metadata is available for this mod."
      : changedSinceDeploy
        ? "The log has changed since the last Studio deploy; current findings are relevant to this deploy window."
        : "The log has not changed since the last Studio deploy; findings may be stale."
  };

  const topEvidence = [
    ...(status.cueLiveness?.erroring || []).map((c: any) => `Cue error: ${c.name} (${c.errors})`),
    ...(status.modRuntime?.samples || []).map((s: string) => `Runtime: ${s}`),
    ...(status.diagnosis?.hypotheses || []).map((h: any) => `Hypothesis ${h.code}: ${h.explanation}`),
    ...timeline.slice(-8).map(t => `${t.kind}: ${t.evidence}`),
  ].slice(0, 16);

  const artifact = [
    "Debug Watcher Brief",
    `Mod: ${modId}`,
    `Status: ${status.status}`,
    `Summary: ${status.summary || ""}`,
    `Log: ${status.selectedLogPath || ""}`,
    `Updated: ${status.logUpdatedAt || ""}`,
    `Deploy: ${status.lastDeploy?.deployedAt || "none"}`,
    `Since deploy: ${sinceDeploy.summary}`,
    "",
    "Expected Chain:",
    ...(expectedChain.length ? expectedChain.map(s => `${s.seen ? "PASS" : "MISS"} ${s.step}${s.evidence ? ` :: ${s.evidence}` : ""}`) : ["(none configured)"]),
    "",
    "Evidence:",
    ...(topEvidence.length ? topEvidence : ["No high-signal evidence in the current tail."]),
  ].join("\n");

  // B19s2: single server-computed verdict — kills the rail's (and agents') field guessing.
  const attributedErrors =
    Number(status.modRuntime?.errorCount || 0) +
    Number(status.cueLiveness?.erroringCount || 0) +
    Number(status.counts?.activeErrors || 0);
  const verdict = computeWatcherVerdict({
    hasLog: true,
    logFresh: Boolean(logTime && (Date.now() - logTime) < 120_000),
    hasDeploy: Boolean(status.lastDeploy),
    changedSinceDeploy,
    markersSeen: Boolean(status.modRuntime?.markersSeen),
    cuesActive: Boolean((status.cueLiveness?.firingCount || 0) > 0 || (status.cueLiveness?.erroringCount || 0) > 0),
    errorCount: attributedErrors,
  });

  return {
    ok: status.status !== "error",
    status,
    brief: status.summary || "",
    verdict,
    timeline,
    expectedChain,
    sinceDeploy,
    evidence: topEvidence,
    artifact,
  };
}

/**
 * Invalidation stamps for the SQLite-cached object index: every .cat archive
 * (game root + extension subfolders + mod workspace) plus the top-level mtimes
 * of the scan roots. Cheap to collect; catches archive/install changes. Deeply
 * nested loose-XML edits may not bump these — the warm path still fully
 * rebuilds every 60 s, so staleness is bounded to cold boots after such edits.
 */
function collectObjectIndexStamps(resolved: ReturnType<typeof resolveXsdConfig>): SourceStamp[] {
  const stamps: SourceStamp[] = [];
  const stat = (p: string) => { try { return Math.floor(fs.statSync(p).mtimeMs); } catch { return null; } };
  const addCats = (dir: string) => {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.toLowerCase().endsWith('.cat')) continue;
        const p = path.join(dir, f);
        const m = stat(p);
        if (m !== null) stamps.push({ path: p, mtime: m });
      }
    } catch { /* root missing */ }
  };
  if (resolved.x4GamePath) {
    addCats(resolved.x4GamePath);
    const extDir = path.join(resolved.x4GamePath, 'extensions');
    try {
      for (const sub of fs.readdirSync(extDir)) addCats(path.join(extDir, sub));
    } catch { /* no extensions dir */ }
    const extM = stat(extDir);
    if (extM !== null) stamps.push({ path: extDir, mtime: extM });
  }
  // B64-P4: the stamps above (.cat files + top-level dir mtimes) miss a NESTED loose-XML edit
  // under a user-editable root — editing mod/libraries/jobs.xml bumps neither a .cat nor the
  // root's own mtime, so a restarted process would restore a STALE SQLite index until the 60s
  // TTL. Add a bounded loose-XML digest (newest .xml mtime + file count) per USER root so a
  // nested edit/add/remove flips a stamp and forces a rebuild. Only the user-editable roots are
  // deep-walked (the vanilla game tree is read-only and huge — its .cat stamps suffice); the
  // walk is depth- and budget-capped and skips heavy asset dirs, so it stays cold-boot-cheap.
  const looseXmlDigest = (root: string): { newest: number; count: number } => {
    let newest = 0, count = 0, budget = 20000;
    const walk = (dir: string, depth: number) => {
      if (depth > 12 || budget <= 0) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (budget <= 0) break;
        if (e.isDirectory()) {
          if (/^(node_modules|\.git|\.snapshots|assets|textures|videos|music|sounds|shadergl|particles)$/i.test(e.name)) continue;
          walk(path.join(dir, e.name), depth + 1);
        } else if (e.name.toLowerCase().endsWith('.xml')) {
          budget--; count++;
          const m = stat(path.join(dir, e.name));
          if (m !== null && m > newest) newest = m;
        }
      }
    };
    walk(root, 0);
    return { newest, count };
  };
  for (const root of [resolved.modWorkspacePath, resolved.filesystemPath]) {
    if (!root) continue;
    addCats(root);
    const m = stat(root);
    if (m !== null) stamps.push({ path: root, mtime: m });
    const d = looseXmlDigest(root);
    stamps.push({ path: `${root}::loosexml-newest`, mtime: d.newest });
    stamps.push({ path: `${root}::loosexml-count`, mtime: d.count });
  }
  return stamps;
}

function getObjectIndex(): X4ObjectIndex {
  const resolved = resolveXsdConfig();
  const roots = [
    resolved.x4GamePath ? path.join(resolved.x4GamePath, "libraries") : "",
    resolved.x4GamePath ? path.join(resolved.x4GamePath, "assets") : "",
    resolved.x4GamePath ? path.join(resolved.x4GamePath, "extensions") : "",
    // B63: maps/ holds the galaxy/cluster/sector/zone macro DEFINITIONS that god.xml, jobs, etc.
    // reference by macro= — index them so those references resolve (was 133/151 god.xml macros absent).
    resolved.x4GamePath ? path.join(resolved.x4GamePath, "maps") : "",
    resolved.modWorkspacePath || "",
    resolved.filesystemPath || ""
  ];
  const cacheKey = JSON.stringify({ roots, indexerVersion: 6, schemaLoaded: schemaLibrary.loaded, schemaCounts: {
    events: schemaLibrary.events.length,
    conditions: schemaLibrary.conditions.length,
    actions: schemaLibrary.actions.length,
    controlFlow: schemaLibrary.controlFlow.length
  }});

  if (objectIndexCache && objectIndexCache.key === cacheKey && Date.now() - objectIndexCache.builtAt < 60_000) {
    return objectIndexCache.index;
  }

  // B64-P1 STALE-WHILE-REVALIDATE: cache present + SAME key but past the 60s TTL → return
  // the stale index IMMEDIATELY and refresh in the background (deduped by objectIndexRefreshing).
  // After the first cold build, no user request ever pays a synchronous rebuild. (Node is
  // single-threaded, so the background rebuild still occupies the loop when it runs — the
  // freeze is decoupled from request latency + deduped, not eliminated; a truly non-blocking
  // build via a worker thread is P1b.) A CHANGED cacheKey (config changed) cannot serve a
  // stale index for a different config, so it falls through to the blocking rebuild below.
  if (objectIndexCache && objectIndexCache.key === cacheKey) {
    if (objectIndexRefreshing !== cacheKey) {
      objectIndexRefreshing = cacheKey;
      const staleResolved = resolved, staleRoots = roots;
      setImmediate(() => {
        try { rebuildObjectIndexNow(staleResolved, staleRoots, cacheKey); }
        catch (err) { console.warn('[object-index] background refresh failed (kept stale copy):', err); }
        finally { if (objectIndexRefreshing === cacheKey) objectIndexRefreshing = null; }
      });
    }
    return objectIndexCache.index;
  }

  // COLD-BOOT FAST PATH (SQLite stage 3): if this process has never built the
  // index, the cached copy was built with the same cacheKey, and every source
  // stamp matches, restore from the DB instead of re-decoding 60+ archives.
  if (!objectIndexCache) {
    try {
      const db = getStudioDb();
      if (db) {
        bindGamePath(db, resolved.x4GamePath || "");
        const metaRaw = getDbMeta(db, 'object_index_meta');
        if (metaRaw) {
          const meta = JSON.parse(metaRaw);
          const stamps = collectObjectIndexStamps(resolved);
          if (meta.cacheKey === cacheKey && stamps.length > 0 && dbSourcesUnchanged(db, stamps)) {
            const rows = dbReadAllObjects(db);
            if (rows.length > 0) {
              const restored: X4ObjectIndex = {
                generatedAt: meta.generatedAt,
                roots: meta.roots || [],
                scannedFiles: meta.scannedFiles || 0,
                skippedFiles: meta.skippedFiles || 0,
                truncated: !!meta.truncated,
                packedArchives: meta.packedArchives || 0,
                packedEntriesScanned: meta.packedEntriesScanned || 0,
                counts: meta.counts || {},
                items: rows.map(r => ({
                  kind: r.kind as any, id: r.id, name: r.name,
                  sourceFile: r.source_file || '', detail: r.detail || undefined
                }))
              };
              objectIndexCache = { key: cacheKey, builtAt: Date.now(), index: restored };
              console.log(`[studio-db] object index restored from SQLite cache (${rows.length} rows, no archive decode).`);
              return restored;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[studio-db] cold-boot restore failed, falling back to full build:', err);
    }
  }

  return rebuildObjectIndexNow(resolved, roots, cacheKey);
}

// B64-P1: the synchronous build + in-memory cache set + SQLite mirror-write, extracted so
// BOTH the blocking cold-build path and the stale-while-revalidate background refresh share
// one code path (no drift). Updates objectIndexCache under `cacheKey` and returns the index.
function rebuildObjectIndexNow(resolved: ResolvedXsdConfig, roots: string[], cacheKey: string): X4ObjectIndex {
  const schemaElements = [
    ...schemaLibrary.events.map(element => ({ tag: element.tag, category: "md_event" })),
    ...schemaLibrary.conditions.map(element => ({ tag: element.tag, category: "md_condition" })),
    ...schemaLibrary.actions.map(element => ({ tag: element.tag, category: "md_action" })),
    ...schemaLibrary.controlFlow.map(element => ({ tag: element.tag, category: "md_control_flow" }))
  ];
  // Roots that may hold packed .cat/.dat archives: the game install (base
  // 01.cat..NN.cat + extensions/<dlc>/ext_NN.cat) and the mod workspace.
  const catDatRoots = [resolved.x4GamePath || "", resolved.modWorkspacePath || ""].filter(Boolean);
  const index = buildX4ObjectIndex(roots, schemaElements, catDatRoots);
  objectIndexCache = { key: cacheKey, builtAt: Date.now(), index };

  // Mirror-write into the SQLite cache + record invalidation stamps and the
  // restore metadata the cold-boot fast path needs (best-effort; in-memory
  // remains authoritative for this process).
  try {
    const db = getStudioDb();
    if (db) {
      bindGamePath(db, resolved.x4GamePath || "");
      dbCacheObjectIndex(db, index.items.map(it => ({
        kind: it.kind, id: it.id, name: it.name,
        source_file: it.sourceFile || null, detail: it.detail ?? null
      })), index.generatedAt);
      const stamps = collectObjectIndexStamps(resolved);
      dbRecordSourceStamps(db, stamps);
      setDbMeta(db, 'object_index_meta', JSON.stringify({
        cacheKey,
        generatedAt: index.generatedAt,
        roots: index.roots,
        scannedFiles: index.scannedFiles,
        skippedFiles: index.skippedFiles,
        truncated: index.truncated,
        packedArchives: index.packedArchives,
        packedEntriesScanned: index.packedEntriesScanned,
        counts: index.counts
      }));
    }
  } catch (err) {
    console.warn('[studio-db] object-index mirror-write failed (ignored):', err);
  }

  return index;
}

// getSchemaIndex moved to src/server/projectValidation.ts (stage-2 modularization);
// imported above so every existing call site keeps working unchanged.

// AI schema index (with cat/dat harvest fallback), order-param types, and the
// scriptproperty index live in src/server/validationRoutes.ts — stage 1 of the
// server modularization (module owns its services + routes; server.ts composes).

/**
 * Real XSD-backed validation of the generated package. Validates the MD file and
 * any AI script files against the parsed md.xsd/common.xsd element/attribute
 * index. Returns ModDoctor-shaped diagnostics so they merge with heuristic ones.
 */
// B64-P2: reference sets are derived by walking the whole object index (tens of thousands of
// items) and were rebuilt ~2× per validate (project/validate + getJobsVocabulary). Memoize by
// the index identity (generatedAt changes on every rebuild, incl. the P1 background refresh), so
// a validate that already has a warm index pays the O(N) walk ONCE per index generation, not per
// call. Consumers never mutate the returned sets (factionsLint/godLint/projectValidation all copy
// via `new Set([...])`; xsdValidate only `.has()`-reads — verified 2026-07-18), so sharing the
// cached sets is safe.
/** Canonical reference sets from the configured unpacked root (never mod/workspace data). */
function getReferenceSets(): { macros: Set<string>; wares: Set<string>; factions: Set<string>; sectors: Set<string> } {
  const { macros, wares, factions, sectors } = getCanonicalReferenceSets();
  return { macros, wares, factions, sectors };
}

// B61: the learned jobs vocabulary (classes/orders/sizes) is expensive-ish to build (parse the ~15k-line
// vanilla jobs.xml + DLC diffs) but stable per game root — cache it keyed by root signature. Factions
// come from the object index and are (re)attached fresh each call so faction checks turn on as soon as
// the index is ready (and never with a stale set). Learns from OFFICIAL content only (base + ego_dlc_*);
// arbitrary mods are excluded so a mod's own typo can never "teach" the linter to accept it.
let _jobsVocabBaseCache: { key: string; classes: Set<string>; orders: Set<string>; sizes: Set<string> } | null = null;
function getJobsVocabulary(): JobsVocabulary | undefined {
  let key = "";
  let roots: string[] = [];
  try {
    const r = resolveXsdConfig();
    key = `${r.schemaDir || ""}|${r.x4GamePath || ""}`;
    roots = [r.schemaDir, r.x4GamePath].filter((x): x is string => !!x);
  } catch { return undefined; }

  if (!_jobsVocabBaseCache || _jobsVocabBaseCache.key !== key) {
    const readBase = (root: string, rel: string): string | null => {
      const loose = path.join(root, ...rel.split("/"));
      try { if (fs.existsSync(loose) && fs.statSync(loose).isFile()) return fs.readFileSync(loose, "utf8"); } catch { /* fall through to packed */ }
      try { return catDatExtractBaseGameFile(root, rel)?.text ?? null; } catch { return null; }
    };
    const xmls: string[] = [];
    for (const root of roots) {
      const base = readBase(root, "libraries/jobs.xml");
      if (!base) continue;
      xmls.push(base);
      try {
        const extDir = path.join(root, "extensions");
        if (fs.existsSync(extDir)) {
          for (const dir of fs.readdirSync(extDir)) {
            if (!/^ego_dlc_/i.test(dir)) continue; // official DLC only — never arbitrary mods
            const dlcJobs = path.join(extDir, dir, "libraries", "jobs.xml");
            try { if (fs.existsSync(dlcJobs)) xmls.push(fs.readFileSync(dlcJobs, "utf8")); } catch { /* skip one DLC */ }
          }
        }
      } catch { /* no extensions dir on this root */ }
      break; // first root that yields a base jobs.xml wins
    }
    if (!xmls.length) { _jobsVocabBaseCache = null; return undefined; }
    const learned = learnJobsVocabularyMerged(xmls);
    if (!learned.classes.size || !learned.orders.size) { _jobsVocabBaseCache = null; return undefined; } // parse failed / empty — degrade honestly
    _jobsVocabBaseCache = { key, classes: learned.classes, orders: learned.orders, sizes: learned.sizes };
  }

  const factions = (() => { try { const f = getReferenceSets().factions; return f.size ? f : undefined; } catch { return undefined; } })();
  return { classes: _jobsVocabBaseCache.classes, orders: _jobsVocabBaseCache.orders, sizes: _jobsVocabBaseCache.sizes, factions };
}

// B61 phase 3: learned wares vocabulary (transports/tags/groups), cached by game-root signature.
// Official content only (base + ego_dlc_*) — a mod's own typo must never teach the linter.
let _waresVocabCache: { key: string; vocab: WaresVocabulary } | null = null;
function getWaresVocabulary(): WaresVocabulary | undefined {
  let key = "";
  let roots: string[] = [];
  try {
    const r = resolveXsdConfig();
    key = `${r.schemaDir || ""}|${r.x4GamePath || ""}`;
    roots = [r.schemaDir, r.x4GamePath].filter((x): x is string => !!x);
  } catch { return undefined; }
  if (_waresVocabCache && _waresVocabCache.key === key) return _waresVocabCache.vocab;

  const readBase = (root: string, rel: string): string | null => {
    const loose = path.join(root, ...rel.split("/"));
    try { if (fs.existsSync(loose) && fs.statSync(loose).isFile()) return fs.readFileSync(loose, "utf8"); } catch { /* fall through */ }
    try { return catDatExtractBaseGameFile(root, rel)?.text ?? null; } catch { return null; }
  };
  const xmls: string[] = [];
  for (const root of roots) {
    const base = readBase(root, "libraries/wares.xml");
    if (!base) continue;
    xmls.push(base);
    try {
      const extDir = path.join(root, "extensions");
      if (fs.existsSync(extDir)) {
        for (const dir of fs.readdirSync(extDir)) {
          if (!/^ego_dlc_/i.test(dir)) continue;
          const dlc = path.join(extDir, dir, "libraries", "wares.xml");
          try { if (fs.existsSync(dlc)) xmls.push(fs.readFileSync(dlc, "utf8")); } catch { /* skip */ }
        }
      }
    } catch { /* no extensions dir */ }
    break;
  }
  if (!xmls.length) { _waresVocabCache = null; return undefined; }
  const merged: WaresVocabulary = { transports: new Set(), tags: new Set(), groups: new Set() };
  for (const xml of xmls) {
    const v = learnWaresVocabulary(xml);
    v.transports.forEach(x => merged.transports.add(x));
    v.tags.forEach(x => merged.tags.add(x));
    v.groups.forEach(x => merged.groups.add(x));
  }
  if (!merged.transports.size) { _waresVocabCache = null; return undefined; } // parse failed / empty — honest degrade
  _waresVocabCache = { key, vocab: merged };
  return merged;
}

/**
 * True iff `child` is the same path as `root` or lives strictly inside it.
 * Uses a separator-anchored boundary so a sibling like `/mods/myMod-secret`
 * does NOT pass containment for root `/mods/myMod` (a bare startsWith prefix
 * check would wrongly accept it — the classic path-traversal edge case).
 */
function isPathWithin(child: string, root: string): boolean {
  return isSameOrDescendant(child, root);
}

/** Resolve a strict child path and reject traversal or junction escape. */
function resolvePathInside(root: string, ...segments: string[]): string | null {
  const candidate = path.resolve(root, ...segments.map(segment => String(segment)));
  if (path.resolve(root) === candidate || !isPathWithin(candidate, root)) return null;
  return candidate;
}

/** Resolve an XML patch target's base content from loose files or packed archives. */
function resolvePatchBaseContent(targetFile: string): { content: string; source: 'loose' | 'packed'; sourcePath: string } | null {
  const normalized = path.normalize(targetFile);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) return null;
  const resolved = resolveXsdConfig();
  // Prefer the BASE-GAME file (what a <diff> patch actually applies against) over
  // the mod's own output. Order: game loose -> packed base game -> mod workspace.
  const looseGame: string[] = [];
  if (resolved.x4GamePath) looseGame.push(path.join(resolved.x4GamePath, targetFile));
  for (const p of looseGame) {
    try { if (fs.existsSync(p) && fs.statSync(p).isFile()) return { content: fs.readFileSync(p, 'utf8'), source: 'loose', sourcePath: p }; } catch { /* */ }
  }
  if (resolved.x4GamePath) {
    try {
      const packed = catDatExtractBaseGameFile(resolved.x4GamePath, targetFile);
      if (packed) return { content: packed.text, source: 'packed', sourcePath: `${packed.catPath} :: ${packed.name}` };
    } catch { /* */ }
  }
  // Fallbacks: enabled extensions, then the mod workspace (cross-mod patching).
  const fallbacks: string[] = [];
  if (resolved.x4GamePath) {
    const extPath = path.join(resolved.x4GamePath, 'extensions');
    try {
      if (fs.existsSync(extPath) && fs.statSync(extPath).isDirectory()) {
        for (const ext of fs.readdirSync(extPath)) fallbacks.push(path.join(extPath, ext, targetFile));
      }
    } catch { /* ignore */ }
  }
  if (resolved.modWorkspacePath) fallbacks.push(path.join(resolved.modWorkspacePath, targetFile));
  for (const p of fallbacks) {
    try { if (fs.existsSync(p) && fs.statSync(p).isFile()) return { content: fs.readFileSync(p, 'utf8'), source: 'loose', sourcePath: p }; } catch { /* */ }
  }
  return null;
}

/**
 * Server-side XML-patch diagnostics: resolve each patch's target base file
 * (loose or packed) and sanity-check the selector's root against the base file's
 * root element. Full XPath match-counting runs client-side; this surfaces the
 * highest-value server-checkable issues into /api/agent/compile and Mod Doctor.
 */
function runPatchDiagnostics(ws: { xmlPatches?: PatchDiagnosticBlock[] }): ServerDiagnostic[] {
  const out: ServerDiagnostic[] = [];
  const patches: PatchDiagnosticBlock[] = (ws.xmlPatches || []).filter(p => p.includeInBuild !== false);
  if (!patches.length) return out;
  const baseCache = new Map<string, ReturnType<typeof resolvePatchBaseContent>>();
  for (const patch of patches) {
    const targetFile = (patch.targetFile || 'libraries/wares.xml').replace(/\\/g, '/');
    if (!baseCache.has(targetFile)) baseCache.set(targetFile, resolvePatchBaseContent(targetFile));
    const base = baseCache.get(targetFile)!;
    if (!base) {
      out.push({
        severity: 'warning', category: 'schema', code: 'patch.target_unresolved', domain: 'xml_patches',
        filePath: targetFile, sourceRef: { kind: 'xml_patch', id: patch.id },
        message: `Patch target "${targetFile}" was not found in loose files or packed .cat/.dat archives. XPath selectors can't be validated and the patch may fail silently in-game.`
      });
      continue;
    }
    // Root-element sanity check: the selector's first segment should match the
    // base file's root (or a <diff> wrapper).
    const sel = String(patch.sel || patch.selector || '').trim();
    const firstSeg = sel.replace(/^\/+/, '').split(/[/[]/)[0]?.toLowerCase();
    const rootMatch = base.content.match(/<\s*([a-zA-Z_][\w.-]*)/);
    const root = rootMatch ? rootMatch[1].toLowerCase() : '';
    if (firstSeg && root && root !== 'diff' && root !== firstSeg && !base.content.toLowerCase().includes(`<${firstSeg}`)) {
      out.push({
        severity: 'warning', category: 'schema', code: 'patch.selector_root_mismatch', domain: 'xml_patches',
        filePath: targetFile, sourceRef: { kind: 'xml_patch', id: patch.id },
        message: `Patch selector "${sel}" starts with "/${firstSeg}" but the ${base.source} base file "${targetFile}" has root <${root}> and no <${firstSeg}> element — the selector will match nothing.`
      });
    } else {
      out.push({
        severity: 'info', category: 'schema', code: 'patch.target_resolved', domain: 'xml_patches',
        filePath: targetFile, sourceRef: { kind: 'xml_patch', id: patch.id },
        message: `Patch target "${targetFile}" resolved from ${base.source} base file. Selector root looks consistent; run the in-editor XPath preview for exact match counts.`
      });
    }
  }
  return out;
}

// Server-persisted active workspace (in-memory, preloaded with the Escort project)
const DEFAULT_WORKSPACE: ModWorkspace = {
  id: "workspace_default",
  name: "Player_Elite_Escort",
  version: "1.2.0",
  author: "EliteModder",
  description: "Automatically equips the user playership with heavy wing escorts on game entry.",
  nodes: [
    {
      id: "cue_0",
      type: "cue",
      label: "Mission Cue",
      xmlTag: "cue",
      x: 100,
      y: 100,
      properties: {
        name: "Escort_Trigger_Cue",
        instantiate: "true",
        namespace: "this",
        state: "active"
      },
      propertiesSchema: NODE_TEMPLATES[0].propertiesSchema,
      inputs: NODE_TEMPLATES[0].inputs,
      outputs: NODE_TEMPLATES[0].outputs
    },
    {
      id: "event_0",
      type: "event",
      label: "Event: Game Started",
      xmlTag: "event_cue_signalled",
      x: 100,
      y: 400,
      properties: { cue: "md.Setup.Start" },
      propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_cue_signalled')].propertiesSchema,
      inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_cue_signalled')].inputs,
      outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_cue_signalled')].outputs
    },
    {
      id: "action_0",
      type: "action",
      label: "Spawn Ship",
      xmlTag: "create_ship",
      x: 450,
      y: 150,
      properties: {
        name: "$MyHeavyEscort",
        macro: "ship_arg_s_fighter_01_a_macro (Elite Vanguard)",
        faction: "player",
        sector: "player.sector",
        coords: "0,500,-1000"
      },
      propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'create_ship')].propertiesSchema,
      inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'create_ship')].inputs,
      outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'create_ship')].outputs
    }
  ],
  links: [
    { id: "l0", sourceNodeId: "cue_0", sourcePortId: "out_cond", targetNodeId: "event_0", targetPortId: "in_cond" },
    { id: "l1", sourceNodeId: "cue_0", sourcePortId: "out_act", targetNodeId: "action_0", targetPortId: "in_act" }
  ],
  uiWidgets: [
    { id: "w_0", type: "window", x: 100, y: 100, w: 420, h: 300, label: "Escort Fleet Terminal", properties: {} },
    { id: "w_1", type: "header", x: 120, y: 140, w: 380, h: 40, label: "TACTICAL FLIGHT OPS", properties: {} },
    { id: "w_2", type: "progressbar", x: 120, y: 200, w: 380, h: 30, label: "Escort Integrity", properties: { value: 92, progressColor: "#00ccff" } }
  ],
  uiTheme: {
    backgroundColor: "#111827",
    borderColor: "#06b6d4",
    accentColor: "#0891b2",
    opacity: 0.9,
    showIcons: true
  }
};

let activeWorkspace: ModWorkspace = JSON.parse(JSON.stringify(DEFAULT_WORKSPACE));
// Track version counter to help with client-side merge prompts
// P0 2026-07-09: Date.now() seed, NOT 1 — a restart-reset counter closed the client's
// "adopt server workspace when version > stored" gate forever (browser localStorage held a
// higher number from before the restart), silently pinning the canvas to an ancient graph.
// A monotonic-across-restarts seed keeps the adoption gate working after every restart.
let workspaceVersion = Date.now();

// B2 slice 3 (ADR-F1): the active workspace survives restarts on disk. A restart with a
// blank client attached clobbered real state on 2026-07-11 — the in-memory singleton is a
// counted incident class, not a style choice.
// B31s1: X4_STATE_DIR lets an EPHEMERAL instance (e2e, drills) keep its own persisted
// state without touching this checkout's — isolation by construction, not by restore.
const STUDIO_STATE_DIR = process.env.X4_STATE_DIR?.trim()
  ? path.resolve(process.env.X4_STATE_DIR.trim())
  : path.join(process.cwd(), ".studio-state");
// Legacy (no-expectedHead) writes are only auto-accepted on true first contact: a fresh
// install where nothing was ever persisted and nothing has been written this run.
let hadPersistedStateAtBoot = false;
let anyCommitSinceBoot = false;
{
  const saved = readActiveState(STUDIO_STATE_DIR);
  if (saved) {
    activeWorkspace = saved.workspace as ModWorkspace;
    // Monotonic across restarts: never fall below what clients already saw.
    workspaceVersion = Math.max(Date.now(), saved.version + 1);
    hadPersistedStateAtBoot = true;
    console.log(`[state] restored persisted workspace "${activeWorkspace.name}" (v${saved.version}, saved ${saved.savedAt})`);
  }
}

/**
 * B2s3 chokepoint: every REAL writer of the active workspace commits through here so
 * persistence and park-on-switch can't be bypassed. (The selftest save/restore swap is
 * the deliberate exception — test-scoped, restores in the same request.)
 * Loading a DIFFERENT mod parks the previous state instead of destroying it.
 */
function commitActiveWorkspace(next: ModWorkspace, origin: string): void {
  const nameSwitched = Boolean(next?.name && activeWorkspace?.name && next.name !== activeWorkspace.name);
  if (nameSwitched) {
    // Don't park the pristine boot sample — parking is for real prior work only.
    const isPristineDefault = JSON.stringify(activeWorkspace) === JSON.stringify(DEFAULT_WORKSPACE);
    if (!isPristineDefault) {
      parkState(STUDIO_STATE_DIR, {
        workspace: activeWorkspace,
        version: workspaceVersion,
        savedAt: new Date().toISOString(),
        origin: `parked-on-switch:${origin}`,
      });
    }
  }
  activeWorkspace = next;
  workspaceVersion++;
  anyCommitSinceBoot = true;
  try {
    writeActiveState(STUDIO_STATE_DIR, {
      workspace: activeWorkspace,
      version: workspaceVersion,
      savedAt: new Date().toISOString(),
      origin,
    });
  } catch (e) {
    // Persistence failure must never fail the write itself — but say it loudly.
    console.error("[state] could not persist active workspace:", e);
  }
}

// -----------------------------------------------------
// Helper to call generateContent with retry and fallback model capability
// to handle temporary 503 Spikes in Demand / UNAVAILABLE errors.
// -----------------------------------------------------
async function generateContentWithRetry(ai: any, params: any, maxRetries = 2) {
  const modelsToTry = [params.model, "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const modelsList = Array.from(new Set(modelsToTry.filter(Boolean)));
  
  let lastError: any = null;
  
  for (const modelName of modelsList) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AI-STUDIO] Trying generation on model: ${modelName} (attempt ${attempt}/${maxRetries})`);
        const response = await ai.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (error) {
        lastError = error;
        const errMessage = error.message || "";
        const errString = JSON.stringify(error) || "";
        const is503 = errMessage.includes("503") || 
                      errMessage.toLowerCase().includes("unavailable") || 
                      errMessage.toLowerCase().includes("high demand") || 
                      errString.includes("503") || 
                      errString.toLowerCase().includes("unavailable") ||
                      errString.toLowerCase().includes("high demand");
                      
        console.error(`[AI-STUDIO] Error with model ${modelName} on attempt ${attempt}:`, error);
        
        if (is503) {
          if (attempt < maxRetries) {
            const delay = attempt * 1200;
            console.log(`[AI-STUDIO] Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else {
            console.warn(`[AI-STUDIO] Model ${modelName} failed after max retries.`);
          }
        } else {
          // If we encounter a critical non-503 failure (e.g. incorrect parameter or permissions),
          // skip to trying the fallback model immediately.
          break;
        }
      }
    }
  }
  
  throw lastError || new Error("All model options and retries failed.");
}

// -----------------------------------------------------
// Unified Multi-Provider AI Endpoint Controller (Gemini, Claude, OpenAI)
// Plays direct native fetch proxy requests to protect backend secrets.
// -----------------------------------------------------
// Security (Track B): the server's own .env provider keys may only back requests that
// came from the app UI in the browser (Origin/Referer = the app's localhost origins).
// External clients (scripts, agents, other local processes) must supply their own key
// via x-custom-api-key — they hold the studio token, but that authorizes workspace
// access, not spending the user's provider credits.
// Audit #3: key management endpoints — write-only set, boolean-only status. Values
// never travel back to the browser. Authed like every non-allowlisted route.
app.post("/api/ai/keys", (req, res) => {
  try {
    const { provider, key } = req.body || {};
    const status = setStoredAiKey(String(provider || ""), String(key ?? ""));
    return res.json({ success: true, status });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || "Failed to store key." });
  }
});

app.get("/api/ai/keys/status", (_req, res) => {
  return res.json({ status: aiKeyStatus() });
});

function isAppUiRequest(req: express.Request): boolean {
  const appOrigins = new Set([
    "http://localhost:3000", "http://127.0.0.1:3000",
    `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`
  ]);
  const origin = (req.headers.origin as string) || "";
  if (appOrigins.has(origin)) return true;
  const referer = (req.headers.referer as string) || "";
  for (const o of appOrigins) {
    if (referer.startsWith(o + "/") || referer === o) return true;
  }
  return false;
}

// B25: the spend meter — every paid call passes this chokepoint; a runaway day
// soft-stops at AI_DAILY_CALL_CAP total calls (default 300, 0 disables). Usage
// persists in data/ai-usage.json; GET /api/ai/usage is the readout.
const AI_DAILY_CALL_CAP = Number(process.env.AI_DAILY_CALL_CAP ?? 300);
// B64-SEC4: OPTIONAL dollar backstop (estimated). 0/unset = disabled = legacy behavior.
const AI_DAILY_USD_CAP = Number(process.env.AI_DAILY_USD_CAP ?? 0);
const AI_USAGE_FILE = dataPath("ai-usage.json"); // B53
const aiSpendMeter = createSpendMeter(
  {
    load: () => { try { return fs.readFileSync(AI_USAGE_FILE, "utf8"); } catch { return null; } },
    save: (t) => { try { fs.mkdirSync(path.dirname(AI_USAGE_FILE), { recursive: true }); fs.writeFileSync(AI_USAGE_FILE, t, "utf8"); } catch { /* best-effort */ } },
  },
  AI_DAILY_CALL_CAP,
  undefined,
  AI_DAILY_USD_CAP,
);

async function callMultiProviderAI(
  req: express.Request,
  systemInstruction: string,
  prompt: string,
  responseFormat: "json" | "text" = "text",
  jsonSchema?: any
): Promise<string> {
  const provider = (req.headers["x-ai-provider"] as string) || "gemini";
  {
    const gate = aiSpendMeter.check(provider);
    if (!gate.allowed) {
      aiSpendMeter.recordRefusal(provider);
      if (gate.stoppedBy === 'usd') {
        throw new Error(`Daily AI spend cap reached (~$${gate.usdToday.toFixed(2)}/$${gate.usdCap.toFixed(2)} estimated). This is the runaway-DOLLAR backstop — raise AI_DAILY_USD_CAP (or set 0 to disable) and restart if today's spend is intentional.`);
      }
      throw new Error(`Daily AI call cap reached (${gate.usedToday}/${gate.cap}). This is the runaway-spend backstop — raise AI_DAILY_CALL_CAP (or set 0 to disable) and restart if today's use is intentional.`);
    }
    aiSpendMeter.record(provider);
  }
  const customKeyHeader = (req.headers["x-custom-api-key"] as string) || "";
  const envFallbackAllowed = isAppUiRequest(req);
  // Hard server-side timeout: a hung provider must not leave the client spinning forever.
  const AI_TIMEOUT_MS = 120_000;
  const NO_KEY_MSG = "No API key for this request. App-UI requests use the configured provider settings; external/agent requests must supply their own key via the x-custom-api-key header (the server's .env keys are reserved for the app UI).";
  // Audit #3 (2026-07-10): keys live SERVER-SIDE now (data/ai-keys.json via the AI
  // Providers modal). Precedence: explicit header (agents + one legacy round) → stored
  // key (app-UI only — agents don't spend the user's credits) → .env (app-UI only).
  const storedKey = envFallbackAllowed ? getStoredAiKey(provider) : "";
  const customKey = customKeyHeader || storedKey;
  const model = (req.headers["x-ai-model"] as string) || "";
  const reasoning = (req.headers["x-ai-reasoning"] as string) || "none";
  // B64-SEC4: attribute a coarse estimated USD cost to this call (per-provider rollup in
  // data/ai-usage.json, readable via GET /api/ai/usage). Estimate only — a runaway-dollar
  // backstop, not accounting: input≈chars/4, output≈the ~4k per-call budget cap.
  try {
    const estInTokens = Math.ceil((systemInstruction.length + prompt.length) / 4);
    aiSpendMeter.recordCost(provider, estimateCallUsd(model, estInTokens, 4000));
  } catch { /* metering is best-effort, never fatal */ }

  if (provider === "claude") {
    const claudeKey = customKey || (envFallbackAllowed ? process.env.ANTHROPIC_API_KEY : undefined);
    if (!claudeKey) {
      throw new Error(envFallbackAllowed ? "Anthropic API key is not configured. Please supply your API Key in the AI Providers settings modal." : NO_KEY_MSG);
    }

    const finalModel = model || "claude-3-5-sonnet-latest";
    let finalPrompt = prompt;
    if (responseFormat === "json") {
      finalPrompt = `${prompt}\n\nCRITICAL: Return ONLY a raw, fully valid JSON object fitting this schema specifications: ${JSON.stringify(jsonSchema || {})}. Do NOT wrap the JSON inside markdown blocks or include any extra conversational text! Only output valid JSON!`;
    }

    const bodyPayload: any = {
      model: finalModel,
      system: systemInstruction,
      messages: [
        { role: "user", content: finalPrompt }
      ]
    };

    // If user requested active thinking level, configure budget_tokens
    if (reasoning !== "none" && (finalModel.includes("3-7") || finalModel.includes("4-") || finalModel.includes("thinking") || reasoning === "extra_high" || reasoning === "high")) {
      let budget = 2048;
      if (reasoning === "low") budget = 1024;
      else if (reasoning === "medium") budget = 2048;
      else if (reasoning === "high") budget = 4096;
      else if (reasoning === "extra_high") budget = 8192;

      bodyPayload.thinking = {
        type: "enabled",
        budget_tokens: budget
      };
      bodyPayload.max_tokens = budget + 4000;
    } else {
      bodyPayload.max_tokens = 4000;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS)
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Anthropic Claude API returned error code ${response.status}`);
    }

    let textOut = data?.content?.[0]?.text || "";
    // Clean codeblock wraps if returned
    if (textOut.trim().startsWith("```")) {
      textOut = textOut.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    }
    return textOut.trim();

  } else if (provider === "openai") {
    const openaiKey = customKey || (envFallbackAllowed ? process.env.OPENAI_API_KEY : undefined);
    if (!openaiKey) {
      throw new Error(envFallbackAllowed ? "OpenAI API key is not configured. Please supply your API Key in the AI Providers settings modal." : NO_KEY_MSG);
    }

    const finalModel = model || "gpt-4o";
    let finalPrompt = prompt;
    if (responseFormat === "json") {
      finalPrompt = `${prompt}\n\nCRITICAL: Return ONLY a raw, fully valid JSON object fitting this schema specifications: ${JSON.stringify(jsonSchema || {})}. Do NOT wrap the JSON inside markdown blocks or include any extra conversational text! Only output valid JSON!`;
    }

    const bodyPayload: any = {
      model: finalModel,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: finalPrompt }
      ],
      response_format: responseFormat === "json" ? { type: "json_object" } : undefined
    };

    // Custom reasoning levels for o-models / reasoning
    if (reasoning !== "none" && (finalModel.startsWith("o") || finalModel.includes("reasoning"))) {
      let effort: "low" | "medium" | "high" = "medium";
      if (reasoning === "low") effort = "low";
      else if (reasoning === "medium") effort = "medium";
      else if (reasoning === "high" || reasoning === "extra_high") effort = "high";

      bodyPayload.reasoning_effort = effort;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS)
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `OpenAI API returned error code ${response.status}`);
    }

    let textOut = data?.choices?.[0]?.message?.content || "";
    // Clean codeblock wraps if returned
    if (textOut.trim().startsWith("```")) {
      textOut = textOut.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    }
    return textOut.trim();

  } else if (provider === "openrouter") {
    const openrouterKey = customKey || (envFallbackAllowed ? (process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY) : undefined);
    if (!openrouterKey) {
      throw new Error(envFallbackAllowed ? "OpenRouter API key is not configured. Please supply your API Key in the AI Providers settings modal." : NO_KEY_MSG);
    }

    // B55P1: "google/gemini-2.1-flash" is not a valid OpenRouter id (live-reproduced 500,
    // 2026-07-16, catalog-checked) — a keyed request with no x-ai-model header always failed.
    const finalModel = model || "google/gemini-2.5-flash";
    let finalPrompt = prompt;
    if (responseFormat === "json") {
      finalPrompt = `${prompt}\n\nCRITICAL: Return ONLY a raw, fully valid JSON object fitting this schema specifications: ${JSON.stringify(jsonSchema || {})}. Do NOT wrap the JSON inside markdown blocks or include any extra conversational text! Only output valid JSON!`;
    }

    const bodyPayload: any = {
      model: finalModel,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: finalPrompt }
      ],
      response_format: responseFormat === "json" ? { type: "json_object" } : undefined
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ai.studio/build",
        "X-Title": "AI Studio Build"
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS)
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `OpenRouter API returned error code ${response.status}`);
    }

    let textOut = data?.choices?.[0]?.message?.content || "";
    if (textOut.trim().startsWith("```")) {
      textOut = textOut.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    }
    return textOut.trim();

  } else {
    // Default to Google Gemini API (standard model schema)
    const geminiKey = customKey || (envFallbackAllowed ? process.env.GEMINI_API_KEY : undefined);
    if (!geminiKey || geminiKey === "MY_GEMINI_API_KEY") {
      throw new Error(envFallbackAllowed ? "Gemini API key is not configured. Please supply your API Key in the AI Providers settings modal to enable cognitive assistance." : NO_KEY_MSG);
    }

    const finalModel = model || "gemini-3.5-flash";

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
        // Server-side cap so a hung Gemini call can't spin the client forever.
        timeout: AI_TIMEOUT_MS
      }
    });

    const config: any = {
      systemInstruction,
      temperature: responseFormat === "json" ? 0.3 : 0.7,
    };

    if (reasoning !== "none") {
      // Set thinking budget or custom instructions
      let extraInstructions = "";
      if (reasoning === "low") extraInstructions = "\n(Optimize for brief, straightforward, direct responses with light analysis)";
      else if (reasoning === "medium") extraInstructions = "\n(Employ steady logical step-by-step thinking processes for accuracy)";
      else if (reasoning === "high") extraInstructions = "\n(Utilize deep internal multi-step reasoning before outputting details)";
      else if (reasoning === "extra_high") extraInstructions = "\n(Maximize comprehensive logical thinking effort and address all latent edge cases)";
      
      config.systemInstruction = `${systemInstruction}${extraInstructions}`;
    }

    if (responseFormat === "json") {
      config.responseMimeType = "application/json";
      config.responseSchema = jsonSchema;
    }

    const response = await generateContentWithRetry(ai, {
      model: finalModel,
      contents: prompt,
      config
    });

    return response.text || "";
  }
}

// -----------------------------------------------------
// 1. ORIGINAL GEMINI CHAT CHOTBOT API
// -----------------------------------------------------
app.post("/api/gemini", async (req, res) => {
  const { prompt, currentWorkspace, diagnostics } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt parameter." });
  }

  try {
    const systemInstruction = `You are an elite X4: Foundations XML & Mission Director MD scripting expert and workspace coordinator.
Help the player write clean, functional scripts, design layouts, and troubleshoot diagnostics.

Your response MUST be a JSON object that satisfies the following JSON Schema:
{
  "type": "object",
  "required": ["text"],
  "properties": {
    "text": {
      "type": "string",
      "description": "Explanations, answers, recommendations or instructions. Use markdown formatting to render clean lists and scan-friendly code blocks."
    },
    "actionRequired": {
      "type": "boolean",
      "description": "Set to true if the user asked you to adjust/fix properties, toggle options, or modify components, and you are providing the corrected workspace."
    },
    "proposedWorkspace": {
      "type": "object",
      "description": "The complete, updated ModWorkspace object with the proposed edits applied. Keep all other nodes, links, and widgets intact."
    }
  }
}

If the player has validation warnings/errors or requests a change, you should analyze the issue, explain the fix in 'text', set 'actionRequired' to true, and provide the updated workspace in 'proposedWorkspace' (e.g., setting 'includeInBuild: false' on UI widgets, altering node properties, etc.). Otherwise, keep 'actionRequired' false and omit 'proposedWorkspace'.`;
    
    let finalPrompt = prompt;
    if (currentWorkspace) {
      finalPrompt = `You are helping the player analyze, fix, or write script code within the context of their active visual node-graph workspace and list of active XML schema diagnostics.

[Active Workspace Context]:
- Name: "${currentWorkspace.name}"
- Description: "${currentWorkspace.description || "No description provided."}"
- Nodes: ${JSON.stringify(currentWorkspace.nodes?.map((n: any) => ({ id: n.id, label: n.label, type: n.type, xmlTag: n.xmlTag, properties: n.properties })) || [])}
- Links/Connections: ${JSON.stringify(currentWorkspace.links || [])}
- UI Widgets: ${JSON.stringify(currentWorkspace.uiWidgets || [])}

[Live XML Schema Diagnostics (Errors / Warnings)]:
${diagnostics && diagnostics.length > 0 ? JSON.stringify(diagnostics, null, 2) : "0 Errors, 0 Warnings. Everything currently compiles and validates successfully!"}

[User Query / Direct Instructions]:
"${prompt}"

Please respond accurately to the user query using the above active workspace state and diagnostics as key context. If they are asking you to fix a warning or error, analyze which node or property is violating rules and tell them exactly how they can adjust those parameters!`;
    }

    const schema = {
      type: Type.OBJECT,
      required: ["text"],
      properties: {
        text: { type: Type.STRING, description: "Detailed response text, explanations or guidelines." },
        actionRequired: { type: Type.BOOLEAN, description: "True if you are proposing one or more automated fixes such as toggling options/attributes on nodes or widgets." },
        proposedWorkspace: {
          type: Type.OBJECT,
          description: "The complete updated ModWorkspace object. You MUST preserve the existing nodes, UI widgets, and links, but make the requested changes (like setting includeInBuild to false for specific widgets, changing properties on a node, etc.)."
        }
      }
    };

    const responseText = await callMultiProviderAI(req, systemInstruction, finalPrompt, "json", schema);
    
    try {
      const parsed = JSON.parse(responseText.trim());
      return res.json({
        text: parsed.text || "",
        actionRequired: !!parsed.actionRequired,
        proposedWorkspace: parsed.proposedWorkspace || null
      });
    } catch {
      return res.json({ text: responseText, actionRequired: false, proposedWorkspace: null });
    }
  } catch (error) {
    console.error("Multi-Provider chat routing error: ", error);
    return res.status(500).json({ error: error.message || "Failed to trigger AI compilation." });
  }
});

/**
 * POST /api/gemini/analyze
 * Analyzes the visual graph workspace and returns a structured, plain-English summary breakdown.
 */
app.post("/api/gemini/analyze", async (req, res) => {
  const { workspace } = req.body;
  if (!workspace) {
    return res.status(400).json({ error: "Missing workspace in request body." });
  }

  try {
    const systemInstruction = `You are a cognitive script compiler and narrative designer for X4: Foundations' Egosoft Mission Director (MD) codebase.
Your task is to analyze the provided visual graph workspace representing an X4 mod. Explain in plain English how the logic flows, what events are triggered, what actions are taken, and registry of any entities created (ships, stations, sounds, UI widgets, etc.).
Be highly precise and translate technical terms to clear logical human outcomes. Avoid overly technical jargon, make it friendly, descriptive, and clean. Ensure to outline safety warnings if any logical flaws exist (like disconnected nodes or triggers with no actions).`;

    const prompt = `Analyze this X4 Foundations ModWorkspace: ${JSON.stringify(workspace)}`;
    const schema = {
      type: Type.OBJECT,
      required: ["summary", "triggerCondition", "flowSteps", "entityRegistry", "tacticalInsights"],
      properties: {
        summary: {
          type: Type.STRING,
          description: "A high-level 1-2 sentence overview of what this script actually accomplishes in plain English."
        },
        triggerCondition: {
          type: Type.STRING,
          description: "Clear explanation of how the script triggers in the game (e.g. game start, entering slot, sector change, etc.)."
        },
        flowSteps: {
          type: Type.ARRAY,
          description: "Step-by-step logical progression of the cues and links in the node network. Detail the links / connections between nodes in clear sequential order.",
          items: {
            type: Type.OBJECT,
            required: ["nodeId", "nodeLabel", "xmlTag", "plainEnglishAction", "sequenceOrder"],
            properties: {
              nodeId: { type: Type.STRING },
              nodeLabel: { type: Type.STRING },
              xmlTag: { type: Type.STRING },
              plainEnglishAction: { type: Type.STRING, description: "A highly descriptive sentence explaining what this specific node does and what settings it uses." },
              sequenceOrder: { type: Type.INTEGER, description: "Sequential order of execution start from 1" }
            }
          }
        },
        entityRegistry: {
          type: Type.ARRAY,
          description: "List of all physical or auditory assets created/spawned or customized by this script, including HUD UI widgets designed.",
          items: {
            type: Type.OBJECT,
            required: ["name", "type", "detail"],
            properties: {
              name: { type: Type.STRING, description: "Variables name or reference, e.g. $MyHeavyEscort, UI Frame 1, Sound: alarm_red" },
              type: { type: Type.STRING, description: "e.g., Ship, Station, UI Widget, Sound, State" },
              detail: { type: Type.STRING, description: "Specification details, like macros, faction settings, dimensions, colors, or values." }
            }
          }
        },
        tacticalInsights: {
          type: Type.ARRAY,
          description: "3 highly valuable recommendations, tips, or potential logic safety bugs about this visual script layout.",
          items: {
            type: Type.STRING
          }
        }
      }
    };

    const textOutput = await callMultiProviderAI(req, systemInstruction, prompt, "json", schema);
    const analysisResult = JSON.parse(textOutput.trim());
    return res.json({ analysis: analysisResult });

  } catch (error) {
    console.error("AI script analysis request error: ", error);
    return res.status(500).json({ error: error.message || "Failed to analyze mod script using AI." });
  }
});

/**
 * POST /api/gemini/analyze-log
 * Analyzes copy-pasted or uploaded debug.log contents, matches errors, logs, or cue warnings
 * with the visual script workspace, and generates direct 1-click playtest auto-fixes.
 */
app.post("/api/gemini/analyze-log", async (req, res) => {
  const { workspace, logs } = req.body;
  if (!workspace || !logs) {
    return res.status(400).json({ error: "Missing workspace or logs in request body." });
  }

  try {
    const systemInstruction = `You are a legendary senior game engine compiler and Mission Director (MD) debugger for X4: Foundations (Egosoft).
Your job is to analyze the user's modding game logs (such as debug.log or custom terminal traces) in context with their visual node workspace.
You must find and correlate issues mentioned in the logs to the specific nodes in the workspace.
For each correlated issue, explain the cause in clear plain English, cite the effect on the game, recommend a detailed playbook action, and provide a 1-click JSON "autoFix" structure to update a node property in the editor when applicable.

Validation / Correlation Rules:
- Under 'affectedNodeId', specify the ID of the node that caused or is corresponding to the error (e.g., matching a cue name to the node's 'name' property, or a sound/ship action).
- If 'autoFix' is generated, set type: 'update_node_property', nodeId to the ID of that node, propertyKey to the property key (like 'instantiate', 'faction', 'macro', etc.), and propertyValue to the corrected value.
- If no node perfectly matches, or it's a general game load log, leave affectedNodeId empty and omit the autoFix field.
- Be supportive, knowledgeable, and provide awesome expert playtester tips.`;

    const prompt = `Here is the current visual workspace:
${JSON.stringify({
  name: workspace.name,
  description: workspace.description,
  nodes: workspace.nodes.map((n: any) => ({ id: n.id, type: n.type, label: n.label, properties: n.properties, xmlTag: n.xmlTag })),
  links: workspace.links
})}

Here is the log segment uploaded by the user / playtester:
-----
${logs}
-----

Analyze this trace and return the structured issues diagnostics and suggestions.`;

    const schema = {
      type: Type.OBJECT,
      required: ["parsedLogsCount", "issues", "summaryOfGameMDReload"],
      properties: {
        parsedLogsCount: {
          type: Type.INTEGER,
          description: "Estimated number of distinct MD script errors/warnings parsed from logs"
        },
        summaryOfGameMDReload: {
          type: Type.STRING,
          description: "Brief human diagnosis summarizing the current playtest session reload state in X4."
        },
        issues: {
          type: Type.ARRAY,
          description: "Array of distinct warning/error issues found with actionable solutions.",
          items: {
            type: Type.OBJECT,
            required: ["id", "severity", "title", "errorLogSnippet", "explanation", "impact", "suggestedAction"],
            properties: {
              id: { type: Type.STRING, description: "Unique ID for identifying issue e.g. err_1" },
              severity: { type: Type.STRING, description: "Must be 'error' or 'warning'" },
              title: { type: Type.STRING, description: "Short descriptive title of the issue" },
              errorLogSnippet: { type: Type.STRING, description: "The exact line or relevant segment from user's logs" },
              explanation: { type: Type.STRING, description: "Why the Egosoft engine threw this warning/error" },
              impact: { type: Type.STRING, description: "How this impacts the gameplay experience or script execution" },
              suggestedAction: { type: Type.STRING, description: "Clear instructions of how the player should fix this manually inside or outside" },
              affectedNodeId: { type: Type.STRING, description: "Optional. The exact node ID from the workspace suffering from this issue." },
              autoFix: {
                type: Type.OBJECT,
                description: "Optional. Provide a 1-click auto-repair payload for the editor if applicable.",
                properties: {
                  type: { type: Type.STRING, description: "Must be 'update_node_property'" },
                  nodeId: { type: Type.STRING },
                  propertyKey: { type: Type.STRING, description: "Name of property to change on node" },
                  propertyValue: { type: Type.STRING, description: "The new corrected value for property" }
                }
              }
            }
          }
        }
      }
    };

    const textOutput = await callMultiProviderAI(req, systemInstruction, prompt, "json", schema);
    const parsedOutput = JSON.parse(textOutput.trim());
    return res.json({ analysis: parsedOutput });

  } catch (error) {
    console.error("AI log analysis error: ", error);
    return res.status(500).json({ error: error.message || "Failed to analyze X4 reload logs via AI compiler." });
  }
});


// -----------------------------------------------------
// 2. EXTERNAL AI AGENT DEVELOPMENT API ENDPOINTS
// -----------------------------------------------------

/**
 * GET /api/agent/schema
 * Exposes core constants, valid selection macro values, structural boundaries, and base templates.
 * Extremely helpful for AI agents to understand exactly what values are valid before making updates.
 */
// B46/B74 multi-schema registry — prefer the canonical unpacked reference-root libraries,
// falling back to the legacy schema/game paths, with per-domain include chains;
// ?domain=<name> lazily builds that one domain's element index.
app.get("/api/agent/schema-registry", (req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const referenceLibraries = path.join(resolved.x4ReferenceRoot, "libraries");
    const useReferenceSchemas = fs.existsSync(referenceLibraries);
    const schemaDir = useReferenceSchemas ? referenceLibraries : resolved.schemaDir || "";
    const registry = discoverSchemaRegistry(
      schemaDir,
      useReferenceSchemas ? undefined : resolved.x4GamePath || undefined,
      { refresh: req.query.refresh === "1", ...(useReferenceSchemas ? { signature: schemaFilesSignature(referenceLibraries) } : {}) },
    );
    const wanted = typeof req.query.domain === "string" ? req.query.domain.toLowerCase() : "";
    const body: Record<string, unknown> = {
      roots: registry.roots,
      domainCount: registry.domains.length,
      domains: registry.domains.map(d => ({
        domain: d.domain,
        file: d.path,
        sizeBytes: d.sizeBytes,
        includes: d.includes.map(p => path.basename(p)),
        missingIncludes: d.missingIncludes,
        shadowedCopies: d.shadowedCopies,
      })),
    };
    if (wanted) {
      const info = registry.domains.find(d => d.domain === wanted);
      if (!info) return res.status(404).json({ ...body, error: `Unknown schema domain: ${wanted}` });
      const index = getDomainIndex(info);
      body.domainIndex = {
        domain: info.domain,
        loaded: index.loaded,
        elementCount: index.elementCount,
        sourceFiles: index.sourceFiles,
        sampleElements: Array.from(index.elements.keys()).slice(0, 25),
      };
    }
    return res.json(body);
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "schema-registry failed" });
  }
});

app.get("/api/agent/schema", (req, res) => {
  const currentConfig = readXsdConfig();
  const resolvedConfig = resolveXsdConfig();
  return res.json({
    api_version: "2026-06-10.agent.v2",
    description: "X4 Forge external agent contract. Use this to inspect supported workspace domains, valid values, compile outputs, and protected API routes before modifying the studio.",
    auth: {
      read_only_schema_is_public: true,
      protected_routes: "Mutation and workspace routes require Authorization: Bearer <token>; explicitly allowlisted read-only reference/diagnostic GETs are public on localhost.",
      token_sources_for_local_agents: [
        "Read process.env.STUDIO_API_TOKEN when the server was started with one.",
        "Otherwise read the gitignored .studio-api-token file in the project root.",
        "The browser app receives the same token via injected window.__STUDIO_API_TOKEN__."
      ],
      curl_header: "Authorization: Bearer $(Get-Content .studio-api-token)"
    },
    workspace_contract: {
      required_root_fields: ["id", "name", "version", "author", "description", "nodes", "links", "uiWidgets", "uiTheme"],
      optional_domain_fields: ["tFiles", "aiScripts", "wares", "jobs", "xmlPatches"],
      domains: {
        mission_director: {
          fields: ["nodes", "links"],
          output: "md/<modId>.xml",
          node_types: ["cue", "event", "condition", "action", "variable", "comment"],
          link_ports: {
            cue_conditions: "cue.out_cond -> event_or_condition.in_cond",
            cue_actions: "cue.out_act -> first_action.in_act",
            action_chain: "action.out_next -> next_action.in_act",
            child_cues: "cue.out_sub -> child_cue.in_flow"
          }
        },
        ui_layout: {
          fields: ["uiWidgets", "uiTheme"],
          outputs: ["ui.xml", "ui/<modId>.lua"],
          note: "X4-correct UI packaging: an extension-root ui.xml <addon><environment type=menus> index registering a Lua entry point under ui/. The legacy non-standard md_ui_layouts/<id>_ui.xml is no longer packaged.",
          widget_types: ["window", "table", "button", "text", "progressbar", "dropdown", "header", "input", "chat"],
          theme_fields: ["backgroundColor", "borderColor", "accentColor", "opacity", "showIcons"]
        },
        translations: {
          field: "tFiles",
          output: "t/<fileName>",
          shape: {
            languageId: "string, e.g. 44",
            fileName: "string, e.g. 0001-l044.xml",
            pages: [{ id: "string", title: "optional string", items: [{ id: "string", value: "string", description: "optional string" }] }]
          }
        },
        ai_scripts: {
          field: "aiScripts",
          output: "aiscripts/<script.name>.xml",
          action_commands: ["move_to", "flee", "shoot", "dock_at", "wait", "find_objects", "custom_xml"],
          param_types: ["object", "number", "boolean", "ware", "faction"],
          attention_levels: ["high", "low"]
        },
        libraries: {
          fields: ["wares", "jobs"],
          outputs: ["libraries/wares.xml", "libraries/jobs.xml"],
          ware_transport_types: ["container", "liquid", "solid", "energy"],
          job_ship_classes: ["fighter", "corvette", "destroyer", "carrier", "freighter"]
        },
        xml_patches: {
          field: "xmlPatches",
          output: "<patch.targetFile>",
          actions: ["add", "replace", "remove"],
          common_targets: ["libraries/ship_macros.xml", "libraries/sound_library.xml", "libraries/wares.xml", "libraries/jobs.xml"]
        },
        object_index: {
          endpoint: "/api/agent/object-index",
          purpose: "Search local loose XML and packed .cat/.dat game/mod data for ships, station macros, wares, factions, sounds, jobs, AI scripts, generic macros, and schema-derived MD elements.",
          query: {
            q: "optional text search over id, name, detail, and sourceFile",
            kind: "optional kind filter: all | ship | station | ware | faction | sound | job | aiscript | md_element | macro",
            limit: "optional result cap, max 2000"
          },
          note: "Indexes loose XML from configured paths AND decodes packed .cat/.dat archives (base game + DLC extensions) for catalog macros (index/macros.xml), factions, wares, jobs, and sounds. Response includes packedArchives and packedEntriesScanned counters."
        },
        canonical_reference: {
          rootSetting: "X4_REFERENCE_ROOT environment variable or config.x4ReferenceRoot (Directory Settings)",
          purpose: "Read-only canonical IDs and script-property documentation from a loose/unpacked X4 root, merged as base plus every present official ego_dlc_* source.",
          endpoints: ["/api/reference/factions", "/api/reference/wares", "/api/reference/sectors", "/api/reference/scriptproperties", "/api/reference/file", "/api/reference/search"],
          note: "Unlike the Object Browser, canonical validation sets never include mod workspace or arbitrary extension data. Faction category/isreal are documented derived authoring fields; source records the first defining base/DLC file.",
        },
        package_manifest: {
          always_outputs: ["content.xml", "README.md"],
          conditional_outputs: ["md/<modId>.xml", "ui.xml", "ui/<modId>.lua", "aiscripts/*.xml", "libraries/wares.xml", "libraries/jobs.xml", "t/*.xml", "<xmlPatch.targetFile>"]
        },
        mod_doctor: {
          purpose: "Package-wide diagnostics for agents and the Studio UI.",
          coverage: ["content.xml metadata", "Mission Director graph/XML", "UI layout dimensions and runtime-risk warnings", "AI script names/actions/params", "wares price and production invariants", "jobs required fields and task references", "translation language/page/item ids", "XML patch selectors/actions/content", "compile settings and includeInBuild exclusions"],
          diagnostic_fields: ["severity", "message", "category", "code", "domain", "filePath", "nodeId", "sourceRef"]
        }
      },
      minimal_workspace: sanitizeWorkspace({ name: "My_AI_Mod", nodes: [], links: [], uiWidgets: [] })
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/agent/schema",
        auth: false,
        purpose: "Fetch this agent contract, valid constants, schema templates, endpoint catalog, and workspace domain descriptions."
      },
      {
        method: "GET",
        path: "/api/agent/workspace",
        auth: true,
        purpose: "Read the active studio workspace plus version counter."
      },
      {
        method: "GET",
        path: "/api/reference/factions",
        auth: false,
        purpose: "List canonical base+DLC faction IDs, localized names, first-definition source, and derived category/isreal authoring metadata. Use ?refresh=1 to force a cache rebuild."
      },
      {
        method: "GET",
        path: "/api/reference/wares",
        auth: false,
        purpose: "List canonical base+DLC ware IDs, localized names, group, tags, and first-definition source."
      },
      {
        method: "GET",
        path: "/api/reference/sectors",
        auth: false,
        purpose: "List sector macro IDs and localized display names from base+DLC map macro files."
      },
      {
        method: "GET",
        path: "/api/reference/scriptproperties?datatype=faction",
        auth: false,
        purpose: "List scriptproperties.xml keyword/datatype properties and function-like selectors with name, result documentation, and result type."
      },
      {
        method: "GET",
        path: "/api/reference/file?path=libraries/factions.xml",
        auth: false,
        purpose: "Read one raw file beneath the configured unpacked reference root; absolute paths, traversal, directories, and symlink escapes are rejected."
      },
      {
        method: "GET",
        path: "/api/reference/search?q=argon&kind=faction",
        auth: false,
        purpose: "Search canonical faction, ware, sector, and script-property records."
      },
      {
        method: "POST",
        path: "/api/agent/workspace",
        auth: true,
        body: { workspace: "ModWorkspace", expectedHead: "workspaceHash from GET (content CAS; 409 head_conflict on mismatch)", expectedVersion: "optional number (optimistic concurrency; 409 on mismatch)", force: "optional boolean — deliberate last-writer-wins overwrite", dryRun: "optional boolean (validate + return diagnostics without applying)" },
        purpose: "Replace the active studio workspace and bump the version if changed. Writes with NEITHER expectedHead NOR expectedVersion NOR force are rejected 409 legacy_write_rejected (GET first, send its workspaceHash as expectedHead). Loading a workspace with a different name PARKS the previous state (see /workspace/parked).",
        example: "POST {\"workspace\":{...},\"expectedHead\":\"ab12...\"} -> 409 {error:'head_conflict'} if stale, else 200 {applied,version,workspaceHash,diagnosticsSummary}"
      },
      {
        method: "POST",
        path: "/api/agent/workspace/merge",
        auth: true,
        body: { changes: "partial top-level ModWorkspace fields to merge (JSON-merge-patch)", expectedHead: "workspaceHash from GET (content CAS)", expectedVersion: "optional number", force: "optional boolean", dryRun: "optional boolean" },
        purpose: "Granular edit: merge only the provided top-level fields into the active workspace. Same CAS/force rules as POST /api/agent/workspace.",
        example: "POST {\"changes\":{\"version\":\"2.0.0\"},\"expectedHead\":\"ab12...\"}"
      },
      {
        method: "GET",
        path: "/api/agent/workspace/parked",
        auth: true,
        purpose: "B2s3: list states parked when a different mod was loaded (park-on-switch keeps prior work instead of destroying it)."
      },
      {
        method: "POST",
        path: "/api/agent/workspace/restore-parked",
        auth: true,
        body: { name: "workspace name as listed by /workspace/parked" },
        purpose: "Switch back to a parked state; the current state is parked first, so restores are never destructive."
      },
      {
        method: "GET",
        path: "/api/agent/diagnostics",
        auth: false,
        purpose: "Read-only current diagnostics for the active workspace (Mod Doctor + XSD + patch checks) with a severity summary."
      },
      {
        method: "POST",
        path: "/api/agent/compile",
        auth: true,
        body: { workspace: "optional ModWorkspace; defaults to active workspace" },
        purpose: "Compile every supported workspace domain into an in-memory file manifest without writing to disk."
      },
      {
        method: "POST",
        path: "/api/agent/package",
        auth: true,
        body: { workspace: "optional ModWorkspace; defaults to active workspace" },
        purpose: "Alias of compile for agents that want a package/file-manifest vocabulary."
      },
      {
        method: "POST",
        path: "/api/agent/artifact/build",
        auth: true,
        body: { workspace: "optional ModWorkspace; defaults to active workspace", format: "loose | catalog (default catalog)" },
        purpose: "Build and hash-verify a complete disk-backed artifact under <Mod Workspace>/.forge-builds without writing to the installed game."
      },
      {
        method: "GET",
        path: "/api/agent/round-trip-selftest",
        auth: false,
        purpose: "Run the compiler/import faithfulness selftest, including byte-fidelity checks for unchanged MD, content.xml, README, and t-files."
      },
      {
        method: "POST",
        path: "/api/agent/round-trip-check",
        auth: true,
        body: { root: "workspace | filesystem (optional for legacy callers)", path: "mod folder under the selected configured root" },
        purpose: "Import a real mod folder, compile it to an in-memory manifest, and report lossless/strictLossless status, dropped files, omitted preserved files, and modeled byte changes."
      },
      {
        method: "POST",
        path: "/api/agent/project/create",
        auth: true,
        body: { meta: "content/project metadata: id, name, version, author, description, deps" },
        purpose: "Create a stateless multi-file ExtensionProject with content.xml already authored."
      },
      {
        method: "POST",
        path: "/api/agent/project/file/create",
        auth: true,
        body: { project: "ExtensionProject", file: "{ path, kind?, content? }" },
        purpose: "Return a new ExtensionProject with one file added/replaced and path-kind classified."
      },
      {
        method: "POST",
        path: "/api/agent/project/generate",
        auth: true,
        body: { spec: "ProjectGenerationSpec; default kind ai_influence_starter" },
        purpose: "Generate a bounded multi-file AI Influence starter project: content.xml, MD, contract Lua/MD, and ai_influence_chat.lua."
      },
      {
        method: "POST",
        path: "/api/agent/project/package",
        auth: true,
        body: { project: "ExtensionProject" },
        purpose: "Validate and return a file manifest for a multi-file ExtensionProject without mutating active workspace."
      },
      {
        method: "POST",
        path: "/api/agent/project/validate-crossfile",
        auth: true,
        body: { project: "ExtensionProject" },
        purpose: "Project-level diagnostics for structure, cross-file cue refs, MD-to-Lua RegisterEvent coverage, Lua-to-MD event_ui_triggered coverage, and content.xml dependency sanity."
      },
      {
        method: "POST",
        path: "/api/agent/deploy",
        auth: true,
        body: { workspace: "optional ModWorkspace; defaults to active workspace" },
        purpose: "Compile and write the package into configured Mod Workspace and/or X4 game extensions paths."
      },
      {
        method: "GET",
        path: "/api/agent/game-log/status?modId=<optionalModId>",
        auth: true,
        purpose: "Read recent X4 debuglog.txt/uidata.log output, classify active-mod errors or warnings, and report whether the log is stale relative to the last Studio deploy."
      },
      {
        method: "GET",
        path: "/api/agent/debug-watcher/brief?modId=<optionalModId>&expect=<commaSeparatedCueOrMarkerNames>",
        auth: true,
        purpose: "Headless debug watcher report for agents: active-mod status, timeline, expected-chain pass/miss, since-deploy freshness, and copyable evidence artifact."
      },
      {
        method: "POST",
        path: "/api/agent/npc-identity-probe/parse-log",
        auth: true,
        body: { logPath: "optional explicit debuglog.txt/uidata.log path; omitted = latest discovered X4 log", targetName: "optional NPC name filter", limit: "optional latest-reading cap" },
        purpose: "Parse deterministic A3b runtime NPC probe lines: raw runtime id, idcode, name, owner, source line, and log source path. No AI provider involved."
      },
      {
        method: "POST",
        path: "/api/agent/npc-identity-probe/parse-save",
        auth: true,
        body: { savePath: "explicit .xml, .xml.gz, or .gz save path", targetName: "optional NPC name filter" },
        purpose: "Read an X4 save file read-only and extract structural person/character candidate blocks near the target name, including explicit save-side ids when present."
      },
      {
        method: "POST",
        path: "/api/agent/npc-identity-probe/correlate",
        auth: true,
        body: { beforeLogReading: "NpcProbeReading", afterLogReading: "NpcProbeReading", beforeSavePath: "path", afterSavePath: "path", targetName: "string", threshold: "optional number; default 0.75" },
        purpose: "Correlate before/after runtime probe readings against before/after save XML candidates using fixed scoring rules and return a machine-readable identity recommendation."
      },
      {
        method: "GET",
        path: "/api/agent/npc-identity-probe/selftest",
        auth: false,
        purpose: "Synthetic deterministic selftest for A3b parsing, gzip save parsing, stable save-id detection, duplicate-name ambiguity, and malformed gzip errors."
      },
      {
        method: "GET",
        path: "/api/agent/object-index?q=<optional>&kind=<optional>&limit=<optional>",
        auth: true,
        purpose: "Search local X4 loose XML data and schema elements for object ids external agents can use in generated mods."
      },
      {
        method: "POST",
        path: "/api/agent/generate",
        auth: true,
        body: { prompt: "string", currentWorkspace: "optional ModWorkspace", diagnostics: "optional XMLDiagnostic[]" },
        purpose: "Ask the server-side AI provider to generate/edit a workspace. Current implementation mainly edits MD graph and UI domains while preserving other existing domains."
      },
      {
        method: "GET",
        path: "/api/schema/library",
        auth: true,
        purpose: "Read the loaded XSD-derived MD schema library."
      },
      {
        method: "GET",
        path: "/api/schema/config",
        auth: true,
        purpose: "Read configured X4 game path, mod workspace path, filesystem path, and XSD schema path."
      },
      {
        method: "POST",
        path: "/api/schema/config",
        auth: true,
        purpose: "Update directory settings and reload md.xsd/common.xsd."
      },
      {
        method: "GET",
        path: "/api/fs/list",
        auth: true,
        purpose: "List a configured project root. Optional ?root=workspace|filesystem selects it explicitly; no selector preserves the legacy filesystem-first response."
      },
      {
        method: "GET",
        path: "/api/fs/read?path=<relativePath>",
        auth: true,
        purpose: "Read a file under the configured filesystem/mod workspace root."
      },
      {
        method: "POST",
        path: "/api/fs/write",
        auth: true,
        body: { path: "relative path under configured root", content: "string" },
        purpose: "Write a file under the configured filesystem/mod workspace root."
      },
      {
        method: "POST",
        path: "/api/fs/create",
        auth: true,
        body: { name: "relative name", type: "directory or file" },
        purpose: "Create a file or directory under the configured filesystem/mod workspace root."
      },
      {
        method: "GET",
        path: "/api/fs/snapshots?modId=<modId>",
        auth: true,
        purpose: "List package snapshots for a compiled mod."
      },
      {
        method: "POST",
        path: "/api/fs/restore-snapshot",
        auth: true,
        body: { modId: "string", snapshotName: "string" },
        purpose: "Restore a snapshot into the active server workspace."
      },
      {
        method: "POST",
        path: "/api/github/*",
        auth: true,
        purpose: "GitHub load, push, create, device-flow, and commits endpoints used by the SOURCE panel."
      }
    ],
    current_state: {
      workspace_version: workspaceVersion,
      active_workspace_domains: summarizeWorkspaceDomains(activeWorkspace),
      config: {
        has_x4_game_path: Boolean(currentConfig.x4GamePath),
        has_mod_workspace_path: Boolean(currentConfig.modWorkspacePath),
        has_filesystem_path: Boolean(currentConfig.filesystemPath),
        has_xsd_schema_path: Boolean(currentConfig.xsdSchemaPath),
        resolved_md_xsd: resolvedConfig.mdExists,
        resolved_common_xsd: resolvedConfig.commonExists
      },
      last_deploy: lastDeployInfo
    },
    constants: {
      factions: X4_FACTIONS,
      ship_macros: X4_SHIP_MACROS,
      station_macros: X4_STATION_MACROS,
      sound_effects: X4_SOUND_EFFECTS,
    },
    node_templates: NODE_TEMPLATES,
    schema_library_loaded: schemaLibrary.loaded,
    schema_counts: {
      events: schemaLibrary.events.length,
      conditions: schemaLibrary.conditions.length,
      actions: schemaLibrary.actions.length,
      control_flow: schemaLibrary.controlFlow.length,
    },
    schema_node_templates: schemaLibrary.templates,
    presets_list: Object.keys(PRESETS).map(key => ({
      id: key,
      name: PRESETS[key].name,
      desc: PRESETS[key].desc
    })),
    compile_response_shape: {
      success: "boolean",
      modId: "safe extension folder id",
      files: "Record<relativePath,string> containing every generated package file",
      legacy_files: {
        mission_director_xml: "same content as files['md/<modId>.xml']",
        ui_index_xml: "same content as files['ui.xml'] when UI widgets exist"
      },
      diagnostics: "Mod Doctor package-wide diagnostics with optional code, domain, filePath, nodeId, and sourceRef metadata",
      file_count: "number"
    },
    game_log_status_shape: {
      status: "no_log | stale | clean | warnings | errors",
      modId: "safe extension folder id used for active-mod line matching",
      selectedLogPath: "debuglog.txt or uidata.log path when found",
      checkedPaths: "candidate paths searched",
      lastDeploy: "last successful Studio deploy metadata when available",
      counts: "issue counters for all tailed issues and active-mod issues",
      issues: "recent errors/warnings whose text mentions the active mod id",
      recentGlobalIssues: "recent errors/warnings from the log tail, even when not matched to the active mod",
      tailLines: "last log lines used for UI/runtime inspection"
    },
    object_index_shape: {
      generatedAt: "ISO timestamp for index build",
      roots: "existing roots scanned",
      scannedFiles: "number of XML files scanned",
      skippedFiles: "number of unreadable or too-large files skipped",
      truncated: "true if scan hit safety cap",
      counts: "counts by object kind",
      items: "array of { id, name, kind, sourceFile, detail }"
    }
  });
});

app.get("/api/schema/library", (req, res) => {
  return res.json(schemaLibrary);
});

function directoryRoleIssues(resolved: ResolvedXsdConfig) {
  return validateDirectoryRoles({
    x4GamePath: resolved.x4GamePath,
    x4ReferenceRoot: resolved.x4ReferenceRoot,
    modWorkspacePath: resolved.modWorkspacePath,
    filesystemPath: resolved.filesystemPath,
  });
}

/** Block writes through an old unsafe config even if it predates save-time validation. */
function rejectUnsafeDevelopmentWrite(res: express.Response, resolved: ResolvedXsdConfig, fields: DirectoryField[]): boolean {
  const writableFields = fields.filter((field): field is 'modWorkspacePath' | 'filesystemPath' =>
    field === 'modWorkspacePath' || field === 'filesystemPath'
  );
  const issue = [
    ...directoryRoleIssues(resolved),
    ...validateProtectedWriteTargets({
      x4GamePath: resolved.x4GamePath,
      x4ReferenceRoot: resolved.x4ReferenceRoot,
      modWorkspacePath: resolved.modWorkspacePath,
      filesystemPath: resolved.filesystemPath,
    }, writableFields),
  ].find(candidate => fields.includes(candidate.field));
  if (!issue) return false;
  res.status(409).json({
    success: false,
    code: issue.code,
    error: `Write blocked by directory safety: ${issue.message}`,
    issue,
  });
  return true;
}

app.get("/api/schema/config", (req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const issues = directoryRoleIssues(resolved);
    // B84: the EFFECTIVE deploy format (persisted or defaulted) so the toggle renders the
    // truth rather than guessing from a possibly-absent config key.
    const effectiveFormat = resolveDeployFormat(undefined);
    return res.json({
      config: readXsdConfig(),
      resolved,
      deployFormat: { format: effectiveFormat.format, source: effectiveFormat.source, options: [...DEPLOY_FORMATS] },
      directorySafety: {
        safe: issues.length === 0,
        issues,
      },
      schema_counts: {
        events: schemaLibrary.events.length,
        conditions: schemaLibrary.conditions.length,
        actions: schemaLibrary.actions.length,
        control_flow: schemaLibrary.controlFlow.length,
      },
      loaded: schemaLibrary.loaded,
      error: schemaLibrary.error
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to read schema config." });
  }
});

app.post("/api/schema/config", (req, res) => {
  try {
    // B84: `schemaDir` used to be written UNCONDITIONALLY, so any partial update that omitted
    // it silently blanked the configured schema path. Absence now preserves the existing value
    // (matching every other field here); an explicit empty string still clears it.
    const schemaDir = req.body?.schemaDir !== undefined ? String(req.body.schemaDir || '').trim() : undefined;
    const gamePath = req.body?.x4GamePath !== undefined ? String(req.body.x4GamePath || '').trim() : undefined;
    const modWorkspacePath = req.body?.modWorkspacePath !== undefined ? String(req.body.modWorkspacePath || '').trim() : undefined;
    const filesystemPath = req.body?.filesystemPath !== undefined ? String(req.body.filesystemPath || '').trim() : undefined;
    const referenceRoot = req.body?.x4ReferenceRoot !== undefined ? String(req.body.x4ReferenceRoot || '').trim() : undefined;
    // B84: the deploy-format toggle persists here beside the directory roles. An explicit
    // unknown value is rejected — the caller must not silently get a format it did not ask for.
    let deployFormat: DeployFormat | undefined;
    if (req.body?.deployFormat !== undefined) {
      const normalized = normalizeDeployFormat(req.body.deployFormat);
      if (!normalized) {
        return res.status(400).json({
          success: false,
          code: 'UNKNOWN_DEPLOY_FORMAT',
          error: `Unknown deploy format "${String(req.body.deployFormat)}". Use "loose" or "catalog".`,
        });
      }
      deployFormat = normalized;
    }

    // Paths save INDEPENDENTLY of schema validity. The schema directory is validated and
    // REPORTED, never a hard gate — you can save just the workspace/filesystem/game paths
    // with no schema (or an incomplete one). Schema-aware validation simply stays degraded
    // until md.xsd + common.xsd resolve. (Previously an unsatisfied schema 400'd the whole
    // save, blocking the other paths — the exact foot-gun this removes.)
    const nextConfig = {
      ...readXsdConfig(),
      ...(gamePath !== undefined ? { x4GamePath: gamePath } : {}),
      ...(modWorkspacePath !== undefined ? { modWorkspacePath } : {}),
      ...(filesystemPath !== undefined ? { filesystemPath } : {}),
      ...(referenceRoot !== undefined ? { x4ReferenceRoot: referenceRoot } : {}),
      ...(deployFormat !== undefined ? { deployFormat } : {}),
      ...(schemaDir !== undefined ? { xsdSchemaPath: schemaDir } : {}),
      schemaFiles: ['md.xsd', 'common.xsd']
    };
    const resolved = resolveXsdConfig(nextConfig);
    const directoryIssues = directoryRoleIssues(resolved);
    if (directoryIssues.length > 0) {
      return res.status(400).json({
        success: false,
        error: directoryIssues[0].message,
        code: directoryIssues[0].code,
        issues: directoryIssues,
        resolved,
      });
    }
    writeXsdConfig(nextConfig);
    const library = reloadSchemaLibrary();
    const manifest = startCanonicalReferenceManifest(true);
    const schemaComplete = !!(resolved.mdExists && resolved.commonExists);
    const schemaWarning = schemaComplete
      ? null
      : schemaDir
        ? `Paths saved. Schema directory "${schemaDir}" is missing md.xsd and/or common.xsd, so schema-aware validation stays disabled until that resolves.`
        : `Paths saved. No schema directory is set, so schema-aware validation stays disabled until you point one at a folder containing md.xsd + common.xsd.`;
    return res.json({
      success: true,
      saved: true,
      directorySafety: { safe: true, issues: [] },
      schemaComplete,
      schemaWarning,
      config: nextConfig,
      resolved,
      schema_counts: {
        events: library.events.length,
        conditions: library.conditions.length,
        actions: library.actions.length,
        control_flow: library.controlFlow.length,
      },
      loaded: library.loaded,
      error: library.error,
      manifest,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update schema config." });
  }
});

function includeFilesystemEntry(name: string): boolean {
  if (name.startsWith('.') && name !== '.snapshots') return false;
  return name !== 'node_modules' && name !== 'dist';
}

// Helper for scanning filesystem recursively. This remains the compatibility
// response for existing Files/Library consumers; the project browser opts into
// the bounded shallow form below.
function scanDirectory(dir: string, baseDir: string): any[] {
  const items: any[] = [];
  try {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (!includeFilesystemEntry(entry.name)) continue;
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          kind: 'directory',
          path: relativePath,
          children: scanDirectory(fullPath, baseDir)
        });
      } else {
        items.push({
          name: entry.name,
          kind: 'file',
          path: relativePath
        });
      }
    }
  } catch (err) {
    console.warn(`Error scanning directory ${dir}:`, err);
  }
  
  return items.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function inspectShallowDirectory(dir: string, baseDir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => includeFilesystemEntry(entry.name));

  const items = entries.map(entry => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (!entry.isDirectory()) {
      return { name: entry.name, kind: 'file', path: relativePath };
    }

    let visibleChildren: fs.Dirent[] = [];
    let readable = true;
    try {
      visibleChildren = fs.readdirSync(fullPath, { withFileTypes: true })
        .filter(child => includeFilesystemEntry(child.name));
    } catch {
      // Keep a disclosure control for unreadable directories. Expanding it
      // produces the specific request error without breaking sibling browsing.
      readable = false;
    }
    return {
      name: entry.name,
      kind: 'directory',
      path: relativePath,
      hasChildren: readable ? visibleChildren.length > 0 : true,
      childCount: readable ? visibleChildren.length : undefined,
      hasContent: visibleChildren.some(child => child.isFile() && child.name.toLowerCase() === 'content.xml'),
      hasPacked: visibleChildren.some(child => child.isFile() && /\.(?:cat|dat)$/i.test(child.name)),
    };
  });

  return items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

type ProjectSourceRoot = 'workspace' | 'filesystem';

function parseProjectSourceRoot(value: unknown): { root?: ProjectSourceRoot; error?: string } {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return {};
  if (raw === 'workspace' || raw === 'filesystem') return { root: raw };
  return { error: `Invalid project root "${raw}". Expected "workspace" or "filesystem".` };
}

function configuredProjectRoot(resolved: ReturnType<typeof resolveXsdConfig>, root: ProjectSourceRoot): string | undefined {
  return root === 'workspace' ? resolved.modWorkspacePath : resolved.filesystemPath;
}

// Server Filesystem list endpoint
app.get("/api/fs/list", (req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const selection = parseProjectSourceRoot(req.query.root);
    if (selection.error) return res.status(400).json({ error: selection.error });
    const depth = String(req.query.depth ?? '').trim();
    const relativePath = String(req.query.path ?? '').trim();
    if (depth && depth !== '1') {
      return res.status(400).json({ error: 'Unsupported list depth. Expected depth=1 for shallow project browsing.' });
    }
    if ((depth || relativePath) && !selection.root) {
      return res.status(400).json({ error: 'Shallow project browsing requires root="workspace" or root="filesystem".' });
    }
    if (relativePath && !depth) {
      return res.status(400).json({ error: 'A project list path requires depth=1.' });
    }
    const rootPath = selection.root
      ? configuredProjectRoot(resolved, selection.root)
      : resolved.filesystemPath || resolved.modWorkspacePath;
    if (!rootPath) {
      return res.json([]);
    }
    if (!fs.existsSync(rootPath)) {
      return res.json([]);
    }
    if (depth === '1') {
      const requestedPath = path.resolve(rootPath, relativePath || '.');
      if (!isPathWithin(requestedPath, rootPath)) {
        return res.status(403).json({ error: 'Forbidden: Directory traversal detected.' });
      }
      const relativeSegments = path.relative(rootPath, requestedPath).split(path.sep).filter(Boolean);
      if (relativeSegments.some(segment => !includeFilesystemEntry(segment))) {
        return res.status(403).json({ error: 'Forbidden: Hidden or development directories are not browsable.' });
      }
      if (!fs.existsSync(requestedPath)) {
        return res.status(404).json({ error: 'Directory not found.' });
      }
      const realRoot = fs.realpathSync(rootPath);
      const realRequested = fs.realpathSync(requestedPath);
      if (!isPathWithin(realRequested, realRoot)) {
        return res.status(403).json({ error: 'Forbidden: Directory escapes the configured project root.' });
      }
      if (!fs.statSync(realRequested).isDirectory()) {
        return res.status(400).json({ error: 'Requested project path is not a directory.' });
      }
      return res.json(inspectShallowDirectory(realRequested, realRoot));
    }
    const tree = scanDirectory(rootPath, rootPath);
    return res.json(tree);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list filesystem." });
  }
});

// Server Filesystem read endpoint
app.get("/api/fs/read", (req, res) => {
  try {
    const relativePath = String(req.query.path || '').trim();
    if (!relativePath) {
      return res.status(400).json({ error: "Missing path parameter." });
    }
    const resolved = resolveXsdConfig();
    const rootPath = resolved.filesystemPath || resolved.modWorkspacePath;
    if (!rootPath) {
      return res.status(400).json({ error: "No filesystem/workspace path configured." });
    }
    const safePath = path.resolve(rootPath, relativePath);
    if (!isPathWithin(safePath, rootPath)) {
      return res.status(403).json({ error: "Forbidden: Directory traversal detected." });
    }
    
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: "File not found." });
    }
    
    const content = fs.readFileSync(safePath, 'utf8');
    return res.json({ content });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to read file." });
  }
});

// Server base target file resolver for XML patch preview/validation
app.get("/api/patch/base-content", (req, res) => {
  try {
    const targetFile = String(req.query.targetFile || '').trim();
    if (!targetFile) {
      return res.status(400).json({ error: "Missing targetFile parameter." });
    }
    const normalized = path.normalize(targetFile);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      return res.status(400).json({ error: "Forbidden: Invalid targetFile path." });
    }

    const resolved = resolveXsdConfig();
    const pathsToCheck: string[] = [];

    // Check workspace path
    if (resolved.modWorkspacePath) {
      pathsToCheck.push(path.join(resolved.modWorkspacePath, targetFile));
    }
    // Check main game path
    if (resolved.x4GamePath) {
      pathsToCheck.push(path.join(resolved.x4GamePath, targetFile));
      // Check extensions folder
      const extPath = path.join(resolved.x4GamePath, 'extensions');
      if (fs.existsSync(extPath) && fs.statSync(extPath).isDirectory()) {
        try {
          const extensions = fs.readdirSync(extPath);
          for (const ext of extensions) {
            pathsToCheck.push(path.join(extPath, ext, targetFile));
          }
        } catch {
          // Ignore
        }
      }
    }

    for (const p of pathsToCheck) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const content = fs.readFileSync(p, 'utf8');
        return res.json({ content, sourcePath: p, source: 'loose' });
      }
    }

    // Loose lookup failed — fall back to decoding the base-game .cat/.dat archives.
    if (resolved.x4GamePath) {
      try {
        const packed = catDatExtractBaseGameFile(resolved.x4GamePath, targetFile);
        if (packed) {
          return res.json({
            content: packed.text,
            sourcePath: `${packed.catPath} :: ${packed.name}`,
            source: 'packed',
            note: 'Extracted from packed base-game .cat/.dat archives. DLC additions are not merged into this preview.'
          });
        }
      } catch {
        // fall through to 404
      }
    }

    return res.status(404).json({ error: `File '${targetFile}' not found in loose files or packed game archives (.cat/.dat).`, isPacked: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to find target base file." });
  }
});

// Server Filesystem write endpoint
/**
 * B86: THE single guarded workspace-write path. Extracted so that `/api/fs/write` and the
 * history "Revert to here" action share one implementation — a revert must replay through the
 * same validation and containment as any other write, never poke files behind the guards.
 * Returns false having ALREADY sent an error response; true means the bytes are on disk.
 */
function writeWorkspaceFileGuarded(res: express.Response, relativePath: string, content: any): boolean {
  if (!relativePath) {
    res.status(400).json({ error: "Missing path parameter." });
    return false;
  }
  const resolved = resolveXsdConfig();
  const rootPath = resolved.modWorkspacePath;
  if (!rootPath) {
    res.status(400).json({ error: "No Mod Workspace Folder configured." });
    return false;
  }
  if (rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return false;

  const safePath = path.resolve(rootPath, relativePath);
  if (!isPathWithin(safePath, rootPath)) {
    res.status(403).json({ error: "Forbidden: Directory traversal detected." });
    return false;
  }

  const dir = path.dirname(safePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(safePath, content, 'utf8');
  return true;
}

app.post("/api/fs/write", (req, res) => {
  try {
    if (!writeWorkspaceFileGuarded(res, String(req.body?.path || '').trim(), req.body?.content ?? '')) return;
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to write file." });
  }
});

// ---------------------------------------------------------------------------
// B86 — AGENT ACTION LEDGER surface.
//
// Rows carry summaries and references only; payloads live behind an explicit /raw fetch. This
// is an activity log with undo, NOT version control — git remains the authoritative history of
// the workspace, and the panel says so.
// ---------------------------------------------------------------------------
/**
 * B93.5 — "where am I?" in one call.
 *
 * Every session previously re-derived the same facts: which port, which workspace, what is deployed
 * versus what is in source, when the last deploy happened, whether the canvas is stale. That was
 * four or five calls plus a disk walk, and `/status`, `/drift` and `/state` were all genuinely 404.
 * Everything below is state the server already holds; this just stops withholding it.
 */
app.get("/api/agent/status", (_req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const ws = activeWorkspace;
    const sourceDir = typeof (ws as any)?.sourceStamp?.dir === 'string' ? (ws as any).sourceStamp.dir : '';

    // Is the canvas stale relative to the folder it was imported from? This is the exact question
    // deploy answers with a hard block, so the caller should be able to ask it BEFORE deploying.
    let sourceSync: { known: boolean; inSync?: boolean; detail: string } = { known: false, detail: 'This workspace was not imported from a folder, so there is nothing to compare.' };
    if (sourceDir) {
      try {
        if (!fs.existsSync(sourceDir)) {
          sourceSync = { known: true, inSync: false, detail: `The imported source folder no longer exists: ${sourceDir}` };
        } else {
          const current = hashFolderFingerprint(fingerprintModFolder(sourceDir));
          const stamped = String((ws as any).sourceStamp?.hash || '');
          sourceSync = current === stamped
            ? { known: true, inSync: true, detail: `Canvas matches ${sourceDir}.` }
            : {
                known: true,
                inSync: false,
                detail: `The folder changed after this canvas imported it. Re-import with POST /api/agent/mod-folder/import {"root":"workspace","path":"${path.basename(sourceDir)}"} and deploy the returned workspace, or call deploy-verify with {"autoReimport": true}.`,
              };
        }
      } catch (error: any) {
        sourceSync = { known: false, detail: `Could not compare against the source folder: ${error?.message || error}` };
      }
    }

    return res.json({
      ok: true,
      port: PORT,
      pid: process.pid,
      mode: process.env.X4_FORGE_MODE?.trim() || (process.env.X4_DATA_DIR ? 'sidecar' : 'standalone'),
      startedAt: SERVER_STARTED_AT,
      discoveryFile: latestPath(),
      workspace: {
        name: ws?.name,
        id: ws?.id,
        version: workspaceVersion,
        contentHash: (() => { try { return workspaceContentHash(sanitizeWorkspace(ws)); } catch { return undefined; } })(),
        nodes: (ws?.nodes || []).length,
        sourceFolder: sourceDir || undefined,
      },
      sourceSync,
      roots: {
        modWorkspacePath: resolved.modWorkspacePath || null,
        filesystemPath: resolved.filesystemPath || null,
        x4GamePath: resolved.x4GamePath || null,
        referenceRoot: resolved.x4ReferenceRoot || null,
        schemaDir: resolved.schemaDir || null,
      },
      lastDeploy: lastDeployInfo || null,
      deployFormat: (() => { const r = resolveDeployFormat(undefined); return { format: r.format, source: r.source }; })(),
      readiness: {
        schemaLoaded: !!schemaLibrary.loaded,
        schemaElements: schemaLibrary.events.length + schemaLibrary.actions.length + schemaLibrary.conditions.length,
        referenceCorpus: (() => { try { const s = getReferenceSets(); return { factions: s?.factions?.size ?? 0, wares: s?.wares?.size ?? 0 }; } catch { return null; } })(),
      },
      history: (() => { try { const rows = agentHistoryStore.readAll(); return { entries: rows.length, lastAction: rows.length ? rows[rows.length - 1].title : null, failures: agentHistoryStore.failures }; } catch { return null; } })(),
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'status failed' });
  }
});

app.get("/api/agent/history", (req, res) => {
  try {
    const rows = filterRows(agentHistoryStore.readAll(), {
      kind: req.query.kind ? String(req.query.kind) : undefined,
      outcome: req.query.outcome ? String(req.query.outcome) : undefined,
      file: req.query.file ? String(req.query.file) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    });
    return res.json({
      ok: true,
      rows,
      total: rows.length,
      // A silently broken ledger should be visible, not merely absent.
      ledgerFailures: agentHistoryStore.failures,
      lastFailure: agentHistoryStore.lastFailure || undefined,
      note: 'Activity log with undo — not version control. Git remains the authoritative history of this workspace.',
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'Failed to read history.' });
  }
});

/** Payload bytes, deliberately behind an explicit action so rows stay small. */
app.get("/api/agent/history/:id/raw", (req, res) => {
  try {
    const row = agentHistoryStore.find(String(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: 'No such history entry.' });
    const which = String(req.query.which || 'diff');
    const ref = which === 'before' ? row.beforeBlob
      : which === 'after' ? row.afterBlob
      : which === 'diagnostics' ? row.diagnosticsBlob
      : row.diffBlob;
    if (!ref) return res.status(404).json({ ok: false, error: `This entry has no stored "${which}" payload.` });
    const blob = agentHistoryStore.readBlob(ref);
    if (!blob) return res.status(410).json({ ok: false, error: 'The stored payload has been rotated out of history.' });
    return res.json({ ok: true, id: row.id, which, bytes: blob.length, content: blob.toString('utf8') });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'Failed to read payload.' });
  }
});

app.post("/api/agent/history/:id/revert", (req, res) => {
  try {
    const row = agentHistoryStore.find(String(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: 'No such history entry.' });
    const rule = revertibility(row.kind, row.outcome, !!row.beforeBlob);
    if (!rule.revertible) {
      return res.status(409).json({ ok: false, code: 'NOT_REVERTIBLE', error: rule.reason });
    }
    const previous = agentHistoryStore.readBlob(row.beforeBlob!);
    if (!previous) {
      return res.status(410).json({ ok: false, error: 'The previous content has been rotated out of history and can no longer be restored.' });
    }
    const target = row.files[0];
    // Tell the capture middleware what this revert touched, so the new entry is complete.
    (req as any).__revertOf = row.id;
    (req as any).__revertOfTitle = row.title;
    (req as any).__revertFiles = [target];
    // Same guarded write path as /api/fs/write — validation and containment still apply.
    if (!writeWorkspaceFileGuarded(res, target, previous.toString('utf8'))) return;
    return res.json({ ok: true, revertedTo: row.id, file: target, bytes: previous.length });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'Revert failed.' });
  }
});

// Server Filesystem create endpoint
app.post("/api/fs/create", (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Missing name parameter." });
    }
    const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const resolved = resolveXsdConfig();
    const rootPath = resolved.modWorkspacePath;
    if (!rootPath) {
      return res.status(400).json({ error: "No Mod Workspace Folder configured." });
    }
    if (rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;
    
    const safePath = path.resolve(rootPath, cleanName);
    if (!isPathWithin(safePath, rootPath)) {
      return res.status(403).json({ error: "Forbidden: Directory traversal detected." });
    }
    
    if (fs.existsSync(safePath)) {
      return res.status(400).json({ error: "Target already exists." });
    }
    
    if (type === 'directory') {
      fs.mkdirSync(safePath, { recursive: true });
    } else {
      const dir = path.dirname(safePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(safePath, '', 'utf8');
    }
    
    return res.json({ success: true, path: cleanName });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create resource." });
  }
});

// Server Filesystem snapshots list endpoint
app.get("/api/fs/snapshots", (req, res) => {
  try {
    const modId = String(req.query.modId || '').trim();
    if (!modId) {
      return res.status(400).json({ error: "Missing modId parameter." });
    }
    const resolved = resolveXsdConfig();
    const modWorkspacePath = resolved.modWorkspacePath;
    if (!modWorkspacePath) {
      return res.json([]);
    }
    const modDir = resolvePathInside(modWorkspacePath, modId);
    if (!modDir) return res.status(403).json({ error: "Forbidden: modId escapes the Mod Workspace Folder." });
    
    // Read the unique mod ID from .studio-mod-id in staging mod folder
    const modIdFile = path.join(modDir, '.studio-mod-id');
    let currentModUniqueId = '';
    if (fs.existsSync(modIdFile)) {
      currentModUniqueId = fs.readFileSync(modIdFile, 'utf8').trim();
    }

    const snapDir = path.join(modDir, '.snapshots');
    if (!fs.existsSync(snapDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(snapDir).filter(name => name.startsWith('snapshot_') && name.endsWith('.json'));
    const list = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(snapDir, file), 'utf8');
        const parsed = JSON.parse(content);
        return {
          id: file,
          name: parsed.name || file.replace('snapshot_', '').replace('.json', '').replace(/-/g, ':'),
          timestamp: parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : new Date(fs.statSync(path.join(snapDir, file)).mtime).toLocaleString(),
          workspace: parsed.workspace || parsed,
          modId: parsed.modId
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Filter snapshots to only return those matching the current mod's unique ID
    const filteredList = list.filter((item: any) => !currentModUniqueId || item.modId === currentModUniqueId);

    filteredList.sort((a, b) => b.id.localeCompare(a.id));
    return res.json(filteredList);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list snapshots." });
  }
});

// Server Filesystem save snapshot endpoint
app.post("/api/fs/snapshot", (req, res) => {
  try {
    const { modId, workspace, name } = req.body;
    if (!modId || !workspace) {
      return res.status(400).json({ error: "Missing modId or workspace." });
    }
    const resolved = resolveXsdConfig();
    const modWorkspacePath = resolved.modWorkspacePath;
    if (!modWorkspacePath) {
      return res.status(400).json({ error: "No mod workspace path configured." });
    }
    if (rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;
    const modDir = resolvePathInside(modWorkspacePath, modId);
    if (!modDir) return res.status(403).json({ error: "Forbidden: modId escapes the Mod Workspace Folder." });
    if (!fs.existsSync(modDir)) {
      fs.mkdirSync(modDir, { recursive: true });
    }

    const modIdFile = path.join(modDir, '.studio-mod-id');
    let modUniqueId = '';
    if (fs.existsSync(modIdFile)) {
      modUniqueId = fs.readFileSync(modIdFile, 'utf8').trim();
    }
    if (!modUniqueId) {
      modUniqueId = `mod_${crypto.randomBytes(8).toString('hex')}`;
      fs.writeFileSync(modIdFile, modUniqueId, 'utf8');
    }

    const snapDir = path.join(modDir, '.snapshots');
    if (!fs.existsSync(snapDir)) {
      fs.mkdirSync(snapDir, { recursive: true });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(
      path.join(snapDir, `snapshot_${stamp}.json`),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        name: name || `Snapshot_${stamp}`,
        modId: modUniqueId,
        workspace
      }, null, 2),
      'utf8'
    );

    // Prune oldest snapshots beyond 30 limit
    const names = fs.readdirSync(snapDir).filter(n => n.startsWith('snapshot_') && n.endsWith('.json'));
    names.sort();
    const MAX_SNAPSHOTS = 30;
    for (let i = 0; i < names.length - MAX_SNAPSHOTS; i++) {
      fs.unlinkSync(path.join(snapDir, names[i]));
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save snapshot." });
  }
});

// Server Filesystem restore snapshot endpoint
app.post("/api/fs/restore-snapshot", (req, res) => {
  try {
    const { modId, snapshotName } = req.body;
    if (!modId || !snapshotName) {
      return res.status(400).json({ error: "Missing modId or snapshotName parameter." });
    }
    const resolved = resolveXsdConfig();
    const modWorkspacePath = resolved.modWorkspacePath;
    if (!modWorkspacePath) {
      return res.status(400).json({ error: "No mod workspace path configured." });
    }
    if (rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;
    const snapDir = resolvePathInside(modWorkspacePath, modId, '.snapshots');
    const snapFile = snapDir ? resolvePathInside(snapDir, snapshotName) : null;
    if (!snapFile) return res.status(403).json({ error: "Forbidden: snapshot path escapes the Mod Workspace Folder." });
    if (!fs.existsSync(snapFile)) {
      return res.status(404).json({ error: "Snapshot not found." });
    }
    const content = fs.readFileSync(snapFile, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed.workspace) {
      return res.status(400).json({ error: "Invalid snapshot format." });
    }
    
    commitActiveWorkspace(parsed.workspace, 'restore-snapshot');

    return res.json({ success: true, workspace: activeWorkspace });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to restore snapshot." });
  }
});

// Server Filesystem delete snapshot endpoint
app.post("/api/fs/delete-snapshot", (req, res) => {
  try {
    const { modId, snapshotName } = req.body;
    if (!modId || !snapshotName) {
      return res.status(400).json({ error: "Missing modId or snapshotName parameter." });
    }
    const resolved = resolveXsdConfig();
    const modWorkspacePath = resolved.modWorkspacePath;
    if (!modWorkspacePath) {
      return res.status(400).json({ error: "No mod workspace path configured." });
    }
    if (rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;
    const snapDir = resolvePathInside(modWorkspacePath, modId, '.snapshots');
    const snapFile = snapDir ? resolvePathInside(snapDir, snapshotName) : null;
    if (!snapFile) return res.status(403).json({ error: "Forbidden: snapshot path escapes the Mod Workspace Folder." });
    if (fs.existsSync(snapFile)) {
      fs.unlinkSync(snapFile);
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to delete snapshot." });
  }
});

// Remove a mod directory (undeploy / clean an orphan) from the configured roots — the deploy
// path can create folders, so there must be a safe way to remove them. Scoped exactly like
// fs/write: relative path only, must stay strictly inside a root, never deletes the root itself.
app.post("/api/fs/delete-dir", (req, res) => {
  try {
    const relativePath = String(req.body?.path || '').trim();
    if (!relativePath) return res.status(400).json({ error: "Missing path parameter." });
    const normalized = path.normalize(relativePath);
    if (path.isAbsolute(normalized) || normalized.startsWith('..') || normalized === '' || normalized === '.') {
      return res.status(400).json({ error: "Invalid path." });
    }
    const resolved = resolveXsdConfig();
    const roots = [resolved.modWorkspacePath].filter((r): r is string => Boolean(r));
    if (rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;
    const removed: string[] = [];
    for (const root of roots) {
      const rootAbs = path.resolve(root);
      const abs = path.resolve(rootAbs, normalized);
      if (abs === rootAbs || !isPathWithin(abs, rootAbs)) continue; // never delete a root or follow a junction outside it
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
        fs.rmSync(abs, { recursive: true, force: true });
        removed.push(abs);
      }
    }
    return res.json({ success: true, removed });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to delete directory." });
  }
});

app.get("/api/schema/element/:tag", (req, res) => {
  const tag = req.params.tag;
  const element = [
    ...schemaLibrary.events,
    ...schemaLibrary.conditions,
    ...schemaLibrary.actions,
    ...schemaLibrary.controlFlow
  ].find(item => item.tag === tag);

  if (!element) {
    return res.status(404).json({ error: `Schema element not found: ${tag}` });
  }
  return res.json(element);
});

/**
 * GET /api/agent/workspace
 * Retrieves the currently active, synchronized workspace state.
 */
// B1 sync-trust: content hash of the active workspace, cached per version so the 3s
// client poll never re-stringifies a 200KB workspace needlessly.
let cachedWorkspaceHash: { version: number; hash: string } | null = null;
function activeWorkspaceHash(): string {
  if (!cachedWorkspaceHash || cachedWorkspaceHash.version !== workspaceVersion) {
    cachedWorkspaceHash = { version: workspaceVersion, hash: workspaceContentHash(sanitizeWorkspace(activeWorkspace)) };
  }
  return cachedWorkspaceHash.hash;
}

app.get("/api/agent/workspace", (req, res) => {
  return res.json({
    workspace: activeWorkspace,
    version: workspaceVersion,
    // B1: lets the client DETECT canvas↔server divergence instead of trusting the bare
    // version counter (the stale-canvas incident class). Hash both sides post-sanitize.
    workspaceHash: activeWorkspaceHash(),
    lastUpdated: new Date().toISOString()
  });
});

type FullWorkspaceValidation = {
  diagnostics: ServerDiagnostic[];
  validation: ReturnType<typeof runProjectValidation>;
  diskSkipped: Array<{ path: string; reason: string }>;
};

function diagnosticCategory(code: string): string {
  if (/^(xsd\.|schema\.|project\.)/.test(code)) return "syntax";
  if (/^(reference\.|scriptproperty\.|tfile\.|jobs\.|wares\.|factions\.|god\.)/.test(code)) return "references";
  return "egosoft";
}

/**
 * One validation chokepoint for canvas, API agents, packaging, readiness, and deploy.
 * The generated manifest is validated as a complete X4 project; callers no longer
 * assemble narrower doctor/XSD subsets that can disagree with project validation.
 */
function runFullWorkspaceValidation(ws: ModWorkspace, built?: { modId: string; files: CompiledFileManifest }): FullWorkspaceValidation {
  const { modId, files } = built || buildWorkspaceFileManifest(ws);
  const projectFiles = new Map<string, ExtensionProject['files'][number]>(
    Object.entries(files).map(([filePath, content]) => [filePath.toLowerCase(), {
      path: filePath,
      kind: classifyPath(filePath),
      content: String(content),
    }]),
  );
  let diskSkipped: Array<{ path: string; reason: string }> = [];
  const sourceDir = typeof (ws as any)?.sourceStamp?.dir === 'string' ? (ws as any).sourceStamp.dir : '';
  if (sourceDir && fs.existsSync(sourceDir)) {
    const diskLoad = loadProjectFromDisk(sourceDir, modId);
    diskSkipped = diskLoad.skipped;
    for (const file of diskLoad.project.files) {
      if (!projectFiles.has(file.path.toLowerCase())) projectFiles.set(file.path.toLowerCase(), file);
    }
  }
  const project: ExtensionProject = {
    id: modId,
    name: ws.name || modId,
    files: [...projectFiles.values()],
  };
  const references = (() => { try { return getReferenceSets(); } catch { return undefined; } })();
  const validation = runProjectValidation(project, {
    references,
    jobsVocabulary: getJobsVocabulary(),
    waresVocabulary: getWaresVocabulary(),
  });
  const hasMd = project.files.some((file) => file.kind === "md" || classifyPath(file.path) === "md");
  const hasAiScript = project.files.some((file) => file.kind === "aiscript" || classifyPath(file.path) === "aiscript");
  const firstMdPath = project.files.find((file) => file.kind === "md" || classifyPath(file.path) === "md")?.path;
  const firstAiScriptPath = project.files.find((file) => file.kind === "aiscript" || classifyPath(file.path) === "aiscript")?.path;
  const firstXmlPath = project.files.find((file) => /\.xml$/i.test(file.path))?.path || "project";
  const unavailable: ServerDiagnostic[] = [];
  const warnUnavailable = (code: string, message: string, filePath = firstXmlPath) => unavailable.push({
    severity: "warning", category: "egosoft", code, domain: "validation", filePath, message,
  });
  if (hasMd && !validation.schema.mdAvailable) warnUnavailable("validation.md_schema_unavailable", "Mission Director schema validation is unavailable; this is not a clean MD structure result.", firstMdPath || firstXmlPath);
  if (hasAiScript && !validation.schema.aiscriptAvailable) warnUnavailable("validation.aiscript_schema_unavailable", "AI Script schema validation is unavailable; this is not a clean AI Script structure result.", firstAiScriptPath || firstXmlPath);
  if ((hasMd || hasAiScript) && !validation.scriptProperties.available) warnUnavailable("validation.scriptproperties_unavailable", "scriptproperties.xml is unavailable; script-expression properties and functions were not checked.", firstMdPath || firstAiScriptPath || firstXmlPath);
  if (!validation.references.available) warnUnavailable("validation.reference_corpus_unavailable", "The canonical X4 reference corpus is unavailable; faction, ware, sector, and macro IDs were not checked.");
  for (const skipped of diskSkipped) warnUnavailable('validation.disk_file_skipped', `Disk-backed validation skipped ${skipped.path}: ${skipped.reason}. The artifact still includes the file, so this is not a clean validation result.`, skipped.path);
  const combined: ServerDiagnostic[] = [
    ...unavailable,
    ...runModDoctor(ws, files, modId).map((finding): ServerDiagnostic => ({
      severity: finding.severity,
      category: finding.category || "egosoft",
      code: finding.code || "doctor.finding",
      domain: finding.domain || "project",
      filePath: finding.filePath || "project",
      line: finding.line,
      nodeId: finding.nodeId,
      message: finding.message,
      sourceRef: finding.sourceRef,
    })),
    ...runPatchDiagnostics(ws),
    ...flattenProjectValidation(validation).map((finding): ServerDiagnostic => ({
      severity: finding.severity,
      category: diagnosticCategory(finding.code || "project.validation"),
      code: finding.code || "project.validation",
      domain: finding.filePath ? classifyPath(finding.filePath) : "project",
      filePath: finding.filePath || "project",
      line: finding.line,
      message: finding.message,
      sourceRef: finding.sourceRef ? { kind: "project", label: finding.sourceRef } : undefined,
    })),
  ];
  const seen = new Set<string>();
  const diagnostics = combined.filter((d) => {
    const key = [d.severity, d.code, d.filePath, d.line || 0, d.nodeId || "", d.message].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { diagnostics, validation, diskSkipped };
}

/** Compute the same full diagnostic set used by compile and agents. */
function computeWorkspaceDiagnostics(ws: ModWorkspace): ServerDiagnostic[] {
  const { modId, files } = buildWorkspaceFileManifest(ws);
  return runFullWorkspaceValidation(ws, { modId, files }).diagnostics;
}

function summarizeDiagnostics(diags: any[]) {
  return {
    total: diags.length,
    errors: diags.filter(d => d.severity === 'error').length,
    warnings: diags.filter(d => d.severity === 'warning').length,
    info: diags.filter(d => d.severity === 'info').length
  };
}

/**
 * Shared mutation handler with optimistic concurrency + dry-run.
 * @param incoming   either a full workspace or (when merge) a partial set of top-level fields
 * @param opts.merge JSON-merge-patch semantics over the active workspace
 */
function applyWorkspaceMutation(incoming: any, opts: { expectedVersion?: number; expectedHead?: string; dryRun?: boolean; merge?: boolean; force?: boolean }): { status: number; body: any } {
  if (!incoming || typeof incoming !== 'object') {
    return { status: 400, body: { error: "Missing or invalid workspace payload." } };
  }
  // B2 slice 3: ADR-F1's legacy-write deprecation round ENDS here. A write that names
  // neither expectedHead nor expectedVersion is blind last-writer-wins — the exact
  // mechanism of the 2026-07-11 boot-blank clobber. It now requires an explicit
  // `force:true` (a deliberate human/agent choice), except on true first contact
  // (fresh install: nothing persisted, nothing written this run). Dry runs stay open.
  const isLegacyWrite = !(typeof opts.expectedHead === 'string' && opts.expectedHead.length > 0)
    && typeof opts.expectedVersion !== 'number';
  const firstContact = !hadPersistedStateAtBoot && !anyCommitSinceBoot;
  if (isLegacyWrite && !opts.force && !opts.dryRun && !firstContact) {
    return {
      status: 409,
      body: {
        error: 'legacy_write_rejected',
        message: "Blind write rejected: no expectedHead/expectedVersion supplied. GET /api/agent/workspace first and send its workspaceHash as expectedHead (CAS), or pass force:true to deliberately overwrite (last-writer-wins).",
        currentHead: activeWorkspaceHash(),
        currentVersion: workspaceVersion,
      }
    };
  }
  // Optimistic concurrency: reject stale writes when expectedVersion is supplied.
  if (typeof opts.expectedVersion === 'number' && opts.expectedVersion !== workspaceVersion) {
    return {
      status: 409,
      body: {
        error: 'version_conflict',
        message: `Stale write rejected: expectedVersion ${opts.expectedVersion} != current ${workspaceVersion}. Re-fetch /api/agent/workspace and retry.`,
        currentVersion: workspaceVersion
      }
    };
  }
  // B2 slice 1 (ADR-F1, 2026-07-09): CONTENT-addressed compare-and-swap. `expectedHead`
  // is the content hash the writer believes the server currently holds (from GET
  // /api/agent/workspace → workspaceHash). Mismatch = someone else changed the workspace
  // since the writer last read it → explicit 409 with BOTH heads, never a silent
  // last-writer-wins overwrite (the clobber class behind the SPEC-#66 incident).
  // Version numbers can lie across restarts; content hashes cannot.
  if (typeof opts.expectedHead === 'string' && opts.expectedHead.length > 0) {
    const currentHead = activeWorkspaceHash();
    if (opts.expectedHead !== currentHead) {
      return {
        status: 409,
        body: {
          error: 'head_conflict',
          message: `Content conflict: expectedHead ${opts.expectedHead} != current ${currentHead}. The workspace changed since you read it — re-fetch, reconcile, and retry (or omit expectedHead to force last-writer-wins).`,
          currentHead,
          expectedHead: opts.expectedHead,
          currentVersion: workspaceVersion,
        }
      };
    }
  }
  const merged = opts.merge ? { ...activeWorkspace, ...incoming } : incoming;
  const nextWorkspace = sanitizeWorkspace(merged);
  const diagnostics = computeWorkspaceDiagnostics(nextWorkspace);

  if (opts.dryRun) {
    return {
      status: 200,
      body: {
        success: true, dryRun: true, applied: false,
        version: workspaceVersion,
        diagnosticsSummary: summarizeDiagnostics(diagnostics),
        diagnostics,
        previewWorkspace: nextWorkspace
      }
    };
  }

  const isDifferent = JSON.stringify(nextWorkspace) !== JSON.stringify(activeWorkspace);
  if (isDifferent) {
    // B2s3: all real writes go through the chokepoint (persist + park-on-switch).
    commitActiveWorkspace(nextWorkspace, opts.force ? 'api:forced' : (isLegacyWrite ? 'api:legacy-first-contact' : 'api:cas'));
  }
  return {
    status: 200,
    body: {
      success: true, applied: isDifferent,
      message: isDifferent ? 'Workspace updated; version bumped.' : 'Workspace already in sync.',
      version: workspaceVersion,
      // B2 slice 2: writers track the post-write head so their NEXT CAS write carries it.
      workspaceHash: activeWorkspaceHash(),
      diagnosticsSummary: summarizeDiagnostics(diagnostics),
      workspace: activeWorkspace
    }
  };
}

/**
 * POST /api/agent/workspace
 * Replace the active workspace. Supports optimistic concurrency via
 * `expectedVersion` (409 on mismatch) and `dryRun` (validate without applying).
 */
app.post("/api/agent/workspace", (req, res) => {
  const { workspace, expectedVersion, expectedHead, dryRun, force } = req.body || {};
  if (!workspace) {
    return res.status(400).json({ error: "Missing required 'workspace' body parameter." });
  }
  const r = applyWorkspaceMutation(workspace, { expectedVersion, expectedHead, dryRun, force: force === true });
  return res.status(r.status).json(r.body);
});

/**
 * POST /api/agent/workspace/merge
 * JSON-merge-patch style granular edit: provide only the top-level fields to
 * change (e.g. { "version": "2.0.0" } or { "wares": [...] }). Supports the same
 * `expectedVersion` and `dryRun` controls.
 */
app.post("/api/agent/workspace/merge", (req, res) => {
  const { changes, expectedVersion, expectedHead, dryRun, force } = req.body || {};
  if (!changes || typeof changes !== 'object') {
    return res.status(400).json({ error: "Missing required 'changes' object (top-level workspace fields to merge)." });
  }
  const r = applyWorkspaceMutation(changes, { expectedVersion, expectedHead, dryRun, merge: true, force: force === true });
  return res.status(r.status).json(r.body);
});

/**
 * GET /api/agent/workspace/parked
 * B2s3: states parked when a different mod was loaded (park-on-switch). Read-only list.
 */
app.get("/api/agent/workspace/parked", (req, res) => {
  return res.json({ parked: listParked(STUDIO_STATE_DIR) });
});

/**
 * POST /api/agent/workspace/restore-parked { name }
 * B2s3: deliberate switch back to a parked state — parks the current one first (so a
 * restore is never destructive either), then activates the parked workspace.
 */
app.post("/api/agent/workspace/restore-parked", (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Missing required 'name' body parameter." });
  const parked = readParked(STUDIO_STATE_DIR, name);
  if (!parked) return res.status(404).json({ error: `No parked state named "${name}".` });
  commitActiveWorkspace(parked.workspace as ModWorkspace, 'restore-parked');
  return res.json({
    success: true,
    workspace: activeWorkspace,
    version: workspaceVersion,
    workspaceHash: activeWorkspaceHash(),
  });
});

/**
 * GET /api/agent/diagnostics
 * Read-only current diagnostics for the active workspace (doctor + XSD + patches).
 */
app.get("/api/agent/diagnostics", (req, res) => {
  try {
    const diagnostics = computeWorkspaceDiagnostics(activeWorkspace);
    return res.json({ version: workspaceVersion, summary: summarizeDiagnostics(diagnostics), diagnostics });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'diagnostics failed' });
  }
});

/**
 * GET /api/agent/game-log/status
 * Log-first live game feedback loop. Reads recent X4 debug output and classifies
 * active-mod errors without sending log content to any AI provider.
 */
app.get("/api/agent/game-log/status", (req, res) => {
  try {
    const modId = typeof req.query.modId === "string" ? req.query.modId : undefined;
    return res.json(getGameLogStatus(modId));
  } catch (error) {
    return res.status(500).json({
      status: "error",
      error: error.message || "Failed to read X4 game log status."
    });
  }
});

/**
 * GET /api/agent/debug-watcher/brief
 * Headless, agent-friendly debug-log watcher report. Extends game-log/status with
 * a compact timeline, optional expected-chain checks, deploy freshness, and a
 * copyable evidence artifact. Deterministic only; no AI provider involved.
 */
app.get("/api/agent/debug-watcher/brief", (req, res) => {
  try {
    const modId = typeof req.query.modId === "string" ? req.query.modId : undefined;
    const expectRaw = typeof req.query.expect === "string" ? req.query.expect : "";
    const expected = expectRaw.split(",").map(s => s.trim()).filter(Boolean);
    return res.json(buildDebugWatcherBrief(modId, expected));
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "debug-watcher brief failed" });
  }
});

// NPC Identity Probe (agent-only legacy) moved to src/server/npcIdentityProbe.ts — audit A6.
registerNpcIdentityProbeRoutes(app, { findDebugLogCandidates, readTail, errorMessage });

// A2 — run the deterministic root-cause layer over a PASTED trace (no live log needed).
// Same engine as game-log/status.diagnosis; lets a dev paste a known-bad trace and see the
// named hypothesis deterministically. No AI provider involved.
app.post("/api/agent/log-diagnose", (req, res) => {
  try {
    const tail = String(req.body?.tail || "");
    const rawMod = String(req.body?.modId || activeWorkspace.name || "");
    const modIds = Array.from(new Set([toSafeModId(rawMod), rawMod.toLowerCase().trim(), toSafeModId(rawMod).replace(/_mod$/, "")].filter(s => s && s.length >= 3)));
    const { issues } = analyzeGameLog(tail, modIds);
    const activeIssues = issues.filter(i => i.matchesActiveMod);
    return res.json({ modIds, diagnosis: deriveLogDiagnosis(tail, modIds, activeIssues) });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "log-diagnose failed" });
  }
});

/**
 * GET /api/agent/object-index
 * Agent and UI searchable index over local loose X4 XML objects plus MD schema elements.
 */
app.get("/api/agent/object-index", (req, res) => {
  try {
    const index = getObjectIndex();
    const filtered = filterX4ObjectIndex(index, {
      q: typeof req.query.q === "string" ? req.query.q : "",
      kind: typeof req.query.kind === "string" ? req.query.kind : "all",
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : 500
    });
    return res.json(filtered);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to build X4 object index."
    });
  }
});

// Real base-game XML file paths that can be the target of a <diff> patch, enumerated
// from the packed .cat manifests (so the patch editor only offers files that actually
// exist — e.g. surfaces that `libraries/ship_macros.xml` is NOT a real base file).
let patchTargetsCache: { key: string; builtAt: number; paths: string[] } | null = null;
function listBasePatchTargets(): string[] {
  const resolved = resolveXsdConfig();
  if (!resolved.x4GamePath) return [];
  const key = resolved.x4GamePath;
  if (patchTargetsCache && patchTargetsCache.key === key && Date.now() - patchTargetsCache.builtAt < 300_000) {
    return patchTargetsCache.paths;
  }
  const set = new Set<string>();
  try {
    for (const arc of findCatDatArchives([resolved.x4GamePath])) {
      let entries;
      try { entries = parseCat(arc.catPath); } catch { continue; }
      for (const e of entries) {
        const name = e.name.replace(/\\/g, "/");
        const lower = name.toLowerCase();
        // Realistic patch targets: base library/index/map XML files.
        if (lower.endsWith(".xml") && /^(libraries|index|maps)\//.test(lower)) set.add(name);
      }
    }
  } catch { /* best effort */ }
  const paths = [...set].sort();
  patchTargetsCache = { key, builtAt: Date.now(), paths };
  return paths;
}

app.get("/api/agent/patch-targets", (req, res) => {
  try {
    const q = (typeof req.query.q === "string" ? req.query.q : "").toLowerCase().trim();
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    let paths = listBasePatchTargets();
    if (q) paths = paths.filter(p => p.toLowerCase().includes(q));
    return res.json({ success: true, total: paths.length, items: paths.slice(0, limit).map(p => ({ id: p, name: "" })) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "patch-targets listing failed" });
  }
});

// ---------------------------------------------------------------------------
// Round-trip mod-folder import + lossiness reporting (P4)
// ---------------------------------------------------------------------------

const ROUND_TRIP_TEXT_EXTS = new Set(['.xml', '.lua', '.xsd', '.txt', '.md', '.json', '.css', '.html', '.csv', '.cfg', '.ini']);

function walkFilesRelative(absRoot: string, rel = '', out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(absRoot, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === '.snapshots' || e.name === '.git' || e.name.startsWith('.studio-')) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walkFilesRelative(absRoot, childRel, out);
    else if (e.isFile()) out.push(childRel);
  }
  return out;
}

interface ExtensionFileView {
  rel: string;
  text: string;
  source: "loose" | "packed";
  sourcePath: string;
}

function readExtensionFilesWithPacked(absDir: string, maxBytesPerPackedEntry = 2 * 1024 * 1024): ExtensionFileView[] {
  const byRel = new Map<string, ExtensionFileView>();
  for (const rel of walkFilesRelative(absDir)) {
    const relNorm = rel.replace(/\\/g, "/");
    const lower = relNorm.toLowerCase();
    if (lower.endsWith(".cat") || lower.endsWith(".dat")) continue;
    const abs = path.join(absDir, relNorm);
    try {
      if (!fs.statSync(abs).isFile()) continue;
      byRel.set(lower, { rel: relNorm, text: fs.readFileSync(abs, "utf8"), source: "loose", sourcePath: abs });
    } catch {
      /* unreadable loose file — skip */
    }
  }

  for (const archive of findCatDatArchives([absDir], true).filter(a => path.dirname(a.catPath).toLowerCase() === absDir.toLowerCase())) {
    let entries: ReturnType<typeof parseCat> = [];
    try { entries = parseCat(archive.catPath); } catch { continue; }
    for (const entry of entries) {
      if (entry.size <= 0 || entry.size > maxBytesPerPackedEntry) continue;
      const relNorm = entry.name.replace(/\\/g, "/");
      const lower = relNorm.toLowerCase();
      if (byRel.has(lower)) continue; // Loose files override the same packed path for diagnostics/opening.
      try {
        byRel.set(lower, { rel: relNorm, text: readEntryText(archive.datPath, entry), source: "packed", sourcePath: archive.catPath });
      } catch {
        /* unreadable packed entry — skip */
      }
    }
  }

  return [...byRel.values()];
}

function parseContentMeta(xml: string): { id?: string; name?: string; version?: string; author?: string; description?: string } {
  const attr = (a: string) => {
    const m = xml.match(new RegExp(`<content\\b[^>]*\\b${a}\\s*=\\s*"([^"]*)"`, 'i'));
    return m?.[1];
  };
  return { id: attr('id'), name: attr('name') || attr('id'), version: attr('version'), author: attr('author'), description: attr('description') };
}

/**
 * The mod's real extension id (folder name + content.xml id). Preserve the imported
 * content id when present so export deploys to the SAME folder with the SAME id, instead
 * of renaming it after the display title (toSafeModId("AI Influence Test Mod") =
 * "ai_influence_test_mod" ≠ the real "ai_influence_test"). New mods fall back to the title.
 */
function effectiveModId(ws: any): string {
  // Name the mod after the FOLDER it was loaded from (sanitized to a valid X4 id), so compile
  // targets the directory you opened — not the content.xml display title. This keeps a copy
  // (e.g. "x4_ai_influence - Copy") a DISTINCT mod ("x4_ai_influence_copy") and stops it
  // silently deploying over the original via the copied content.xml id.
  if (ws && typeof ws.sourceFolder === 'string' && ws.sourceFolder) {
    const base = ws.sourceFolder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
    const fromFolder = toSafeModId(base);
    if (fromFolder) return fromFolder;
  }
  const cid = ws && ws.contentId;
  return (typeof cid === 'string' && /^[A-Za-z][\w.-]*$/.test(cid)) ? cid : toSafeModId(ws?.name);
}

/** content.xml to emit: the imported original bytes when the mod metadata is unedited (so
 *  <dependency> + formatting survive), otherwise the regenerated content.xml. */
function contentXmlFor(modId: string, ws: any): string {
  const orig = ws && ws.contentOriginal;
  if (typeof orig === 'string' && orig) {
    const m = parseContentMeta(orig);
    const eq = (a: any, b: any) => String(a ?? '') === String(b ?? '');
    if (eq(m.id, modId) && eq(m.id, ws.contentId) && eq(m.name, ws.name) && eq(m.version, ws.version)
        && eq(m.author, ws.author) && eq(m.description, ws.description)) {
      return orig; // unedited → verbatim
    }
  }
  return generateContentXML(modId, ws);
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function contentFingerprint(ws: any): string {
  return stableStringify({
    contentId: ws?.contentId || '',
    name: ws?.name || '',
    version: ws?.version || '',
    author: ws?.author || '',
    description: ws?.description || '',
    dependencies: (ws?.dependencies || []).map((d: any) => ({
      id: d?.id || '',
      version: d?.version || '',
      optional: d?.optional === true,
      name: d?.name || ''
    }))
  });
}

function tFileFingerprint(tFile: any): string {
  return stableStringify({
    languageId: tFile?.languageId || '',
    fileName: tFile?.fileName || '',
    pages: (tFile?.pages || []).map((p: any) => ({
      id: p?.id || '',
      title: p?.title || '',
      items: (p?.items || []).map((i: any) => ({
        id: i?.id || '',
        value: i?.value || '',
        description: i?.description || ''
      }))
    }))
  });
}

function mdStemFingerprint(ws: any, stem: string): string {
  const nodes = (ws?.nodes || [])
    .filter((n: any) => n?.type === 'cue' && n?.properties?.mdFileStem === stem)
    .map((n: any) => ({
      id: n.id,
      type: n.type,
      xmlTag: n.xmlTag,
      label: n.label,
      includeInBuild: n.includeInBuild !== false,
      properties: n.properties || {}
    }))
    .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
  const ids = new Set(nodes.map((n: any) => n.id));
  const links = (ws?.links || [])
    .filter((l: any) => ids.has(l.sourceNodeId) && ids.has(l.targetNodeId))
    .map((l: any) => ({
      sourceNodeId: l.sourceNodeId,
      sourcePortId: l.sourcePortId,
      targetNodeId: l.targetNodeId,
      targetPortId: l.targetPortId
    }))
    .sort((a: any, b: any) => stableStringify(a).localeCompare(stableStringify(b)));
  return stableStringify({ stem, nodes, links });
}

function applyOriginalModeledFiles(ws: any, files: CompiledFileManifest): void {
  for (const original of ws?.originalFiles || []) {
    if (!original || typeof original.path !== 'string' || typeof original.content !== 'string') continue;
    const rel = original.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rel || rel.includes('..')) continue;
    if (files[rel] === undefined) continue;
    if (original.kind === 'content') {
      const originalId = parseContentMeta(original.content).id;
      if (originalId === effectiveModId(ws) && (!original.fingerprint || original.fingerprint === contentFingerprint(ws))) files[rel] = original.content;
    } else if (original.kind === 'md') {
      const stem = original.stem || rel.replace(/^md\//i, '').replace(/\.xml$/i, '');
      if (!original.fingerprint || original.fingerprint === mdStemFingerprint(ws, stem)) files[rel] = original.content;
    } else if (original.kind === 'tfile') {
      const tFile = (ws.tFiles || []).find((tf: any) => `t/${toTFileName(tf)}`.toLowerCase() === rel.toLowerCase());
      if (tFile && (!original.fingerprint || original.fingerprint === tFileFingerprint(tFile))) files[rel] = original.content;
    } else if (original.kind === 'readme') {
      files[rel] = original.content;
    }
  }
}

function decodeXmlEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Parse an X4 translation (t-file) into the studio's editable TFile model.
 * Structure: <language id><page id title><t id>value</t></page></language>.
 * `compileTFileXML` is the faithful inverse, so these round-trip cleanly.
 */
function parseTFileXML(xml: string, fileName: string): any | null {
  const langId = xml.match(/<language\b[^>]*\bid\s*=\s*"([^"]+)"/i)?.[1];
  if (!langId) return null;
  const pages: any[] = [];
  const pageRe = /<page\b([^>]*)>([\s\S]*?)<\/page>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pageRe.exec(xml)) !== null) {
    const id = pm[1].match(/\bid\s*=\s*"([^"]+)"/i)?.[1];
    if (!id) continue;
    const title = pm[1].match(/\btitle\s*=\s*"([^"]*)"/i)?.[1] || '';
    const items: any[] = [];
    const tRe = /<t\b[^>]*\bid\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/t>/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(pm[2])) !== null) {
      items.push({ id: tm[1], value: decodeXmlEntities(tm[2]), description: '' });
    }
    pages.push({ id, title, items });
  }
  return { languageId: String(langId).replace(/\D/g, '') || langId, fileName, pages, includeInBuild: true };
}

/**
 * MD faithfulness guard (round-trip element preservation).
 *
 * The visual node graph models MOST — but not all — Mission Director XML. Constructs the
 * parser doesn't represent yet (e.g. `<delay>`, `<library>`, `<params>`) are silently lost
 * when a cue is regenerated from nodes on export. Classifying such a file as "editable"
 * therefore corrupts the mod with no error. This mirrors the aiscript faithfulness guard
 * (#65): only adopt an MD file as an editable node graph if regenerating it preserves every
 * element. We compare element-name multisets (whitespace/attribute-order immune); if the
 * regen has fewer of ANY tag, the file is NOT faithfully editable and stays passthrough.
 */
function mdElementCounts(xml: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of xml.matchAll(/<([a-zA-Z_][\w.-]*)/g)) {
    const tag = m[1];
    if (tag === 'xml' || tag === 'mdscript') continue; // header/wrapper noise
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return counts;
}
function mdRoundTripPreservesElements(original: string, regenerated: string): boolean {
  const o = mdElementCounts(original);
  const r = mdElementCounts(regenerated);
  for (const [tag, n] of o) {
    if ((r.get(tag) || 0) < n) return false; // regen dropped at least one <tag> → lossy
  }
  return true;
}

/**
 * Canonical form of an MD document for "was this semantically edited?" comparison. Strips
 * comments, sorts each tag's attributes, and collapses whitespace — so two documents that
 * differ ONLY in comments/formatting/attribute-order canonicalize identically, but ANY change
 * to a tag, attribute name, or attribute VALUE makes them differ. Used to decide whether to
 * re-emit the original bytes verbatim (unedited → true byte-fidelity, comments kept) or the
 * regenerated XML (the graph was actually edited).
 */
const MD_DEFAULT_ATTRS = new Set(['namespace="this"', 'instantiate="false"', 'state="active"']);
function canonicalMd(xml: string): string {
  return String(xml || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<([a-zA-Z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g, (_m, tag, attrs, close) => {
      // Drop attributes that equal their X4 default — so a source that OMITS them and a regen
      // that ADDS them (e.g. namespace="this") canonicalize identically, and we keep the
      // byte-perfect original instead of falsely treating the default-add as an edit.
      const pairs = [...String(attrs).matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)]
        .map(p => `${p[1]}="${p[2]}"`).filter(a => !MD_DEFAULT_ATTRS.has(a)).sort();
      return `<${tag}${pairs.length ? ' ' + pairs.join(' ') : ''}${close ? '/' : ''}>`;
    })
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Import a mod folder into a workspace, preserving every file losslessly. */
function importModFolder(absDir: string): { workspace: ModWorkspace; report: any } {
  const relFiles = walkFilesRelative(absDir);
  let baseWorkspace: ModWorkspace | null = null;
  const meta: any = {};

  // metadata from content.xml (+ keep the raw bytes for byte-fidelity on unedited export —
  // generateContentXML drops <dependency> elements and reformats, which would break the mod).
  const contentRel = relFiles.find(f => f.toLowerCase() === 'content.xml');
  let contentOriginalText = '';
  if (contentRel) {
    try {
      contentOriginalText = fs.readFileSync(path.join(absDir, contentRel), 'utf8');
      Object.assign(meta, parseContentMeta(contentOriginalText));
    } catch { /* */ }
  }

  // editable MD: parse the first md/*.xml — but only adopt it as an editable node graph
  // if regenerating from those nodes preserves every element (faithfulness guard). The
  // node model doesn't represent every MD construct yet (<delay>, <library>, <params>, …);
  // adopting a file we can't round-trip would silently delete them on export. On any loss
  // we leave baseWorkspace null so the original file is preserved verbatim (passthrough).
  // MULTI-SCRIPT: parse EVERY md/*.xml. Each file that round-trips faithfully (parse→regen
  // preserves all elements) is merged into ONE node graph — cues are tagged with their owning
  // script name (by the parser) + file stem (here) so export re-emits one <mdscript> per file at
  // its original path. Files that don't round-trip stay passthrough. Removes the old
  // "only the first md file is editable" limit (the root cause of multi-script mods being raw).
  const mdRels = relFiles.filter(f => /^md\/[^/]+\.xml$/i.test(f));
  const editableMdRels = new Set<string>();
  let mergedNodes: any[] = [];
  let mergedLinks: any[] = [];
  for (const rel of mdRels) {
    try {
      const mdText = fs.readFileSync(path.join(absDir, rel), 'utf8');
      const parsed = parseXMLToWorkspace(mdText);
      if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) continue;
      const regen = generateMDXML(sanitizeWorkspace({
        ...parsed,
        name: meta.name || parsed.name || path.basename(absDir),
      } as any));
      const stem = rel.replace(/^md\//i, '').replace(/\.xml$/i, '');
      if (!mdRoundTripPreservesElements(mdText, regen)) {
        // Not faithfully decomposable into typed nodes → preserve each top-level cue as a lossless
        // generic node (custom_xml_cue): still EDITABLE (renders on the canvas, round-trips verbatim),
        // so NO passthrough. This is what takes node coverage to 100% of cues.
        const mdName = (mdText.match(/<mdscript\b[^>]*\bname\s*=\s*"([^"]+)"/i) || [])[1] || stem;
        const tops = extractTopLevelCueXml(mdText);
        if (tops.length === 0) continue; // truly unparseable → leave passthrough
        tops.forEach((t, k) => {
          mergedNodes.push({
            id: `${stem}__rawcue_${k}`, type: 'cue', label: `Cue (raw): ${t.name}`,
            xmlTag: 'custom_xml_cue', x: 120, y: 100 + k * 220,
            properties: { name: t.name, mdScript: mdName, mdFileStem: stem, rawXml: t.xml },
            propertiesSchema: [],
            inputs: [{ id: 'in_flow', name: 'Trigger Parent', type: 'parent' }],
            outputs: [{ id: 'out_sub', name: 'Sub Cues', type: 'child' }],
          } as any);
        });
        editableMdRels.add(rel.toLowerCase());
        if (!baseWorkspace) baseWorkspace = parsed;
        continue;
      }
      // namespace node ids per file so two scripts never collide (parser ids are Date.now()-based)
      const idMap = new Map<string, string>();
      for (const n of parsed.nodes as any[]) {
        const nid = `${stem}__${n.id}`; idMap.set(n.id, nid); n.id = nid;
        if (n.type === 'cue') n.properties = { ...(n.properties || {}), mdFileStem: stem };
      }
      for (const l of (parsed.links || []) as any[]) {
        l.sourceNodeId = idMap.get(l.sourceNodeId) || l.sourceNodeId;
        l.targetNodeId = idMap.get(l.targetNodeId) || l.targetNodeId;
      }
      mergedNodes = mergedNodes.concat(parsed.nodes);
      mergedLinks = mergedLinks.concat(parsed.links || []);
      editableMdRels.add(rel.toLowerCase());
      if (!baseWorkspace) baseWorkspace = parsed;
    } catch { /* unreadable / lossy → passthrough */ }
  }
  if (baseWorkspace) { baseWorkspace.nodes = mergedNodes; baseWorkspace.links = mergedLinks; }

  const mdParsed = editableMdRels.size > 0;

  // Editable translations: parse every t/*.xml into the TFile model. fileName is
  // the original basename so toTFileName regenerates at the exact same path.
  const tFiles: any[] = [];
  const editableTPaths = new Set<string>();
  for (const rel of relFiles) {
    if (!/^t\/[^/]+\.xml$/i.test(rel)) continue;
    try {
      const parsed = parseTFileXML(fs.readFileSync(path.join(absDir, rel), 'utf8'), rel.replace(/^t\//i, ''));
      if (parsed && parsed.pages.length) { tFiles.push(parsed); editableTPaths.add(rel.toLowerCase()); }
    } catch { /* leave as passthrough */ }
  }

  // Editable wares/jobs (G13): parse libraries/wares.xml & libraries/jobs.xml into the
  // WareDef/JobDef models so a studio-authored economy mod round-trips as EDITABLE rather
  // than preserved-raw. parse* returns null for unrecognized content → falls back to
  // passthrough (lossless), so external files carrying unmodeled fields are never flattened.
  // BYTE-FAITHFUL GUARD (2026-07-09, same standard as the aiscripts import below): a
  // parse is only accepted as EDITABLE when re-compiling the parsed model reproduces the
  // original file EXACTLY — otherwise regeneration would silently drop unmodeled fields
  // (grounding found vanilla wares.xml losing 67% through the old unguarded path).
  // Foreign/vanilla/diff files therefore stay passthrough (lossless); studio-emitted
  // files round-trip byte-identically and stay editable.
  let importedWares: any[] | null = null;
  let importedJobs: any[] | null = null;
  const waresRel = relFiles.find(f => f.toLowerCase() === 'libraries/wares.xml');
  if (waresRel) {
    try {
      const waresText = fs.readFileSync(path.join(absDir, waresRel), 'utf8');
      const parsed = parseWaresXml(waresText);
      if (parsed && compileWaresXML(parsed) === waresText) importedWares = parsed;
    } catch { /* passthrough */ }
  }
  const jobsRel = relFiles.find(f => f.toLowerCase() === 'libraries/jobs.xml');
  if (jobsRel) {
    try {
      const jobsText = fs.readFileSync(path.join(absDir, jobsRel), 'utf8');
      const parsed = parseJobsXml(jobsText);
      if (parsed && compileJobsXML(parsed) === jobsText) importedJobs = parsed;
    } catch { /* passthrough */ }
  }

  // #65 — aiscripts import as EDITABLE when faithfulness-safe, else passthrough. Two
  // determinism guards so re-export can't diverge from the original: (1) the parsed model
  // must re-compile BYTE-IDENTICALLY, and (2) name === the file's stem so the regenerated
  // file lands at the SAME path. Imported names are already final → flagged `namespaced`
  // so the export pipeline never re-prefixes them with this workspace's modId (the old
  // round-trip break). Anything that fails a guard stays passthrough (lossless).
  let importedAiScripts: AIBehaviorScript[] | null = null;
  for (const rel of relFiles) {
    if (!/^aiscripts\/.+\.xml$/i.test(rel.replace(/\\/g, '/'))) continue;
    try {
      const content = fs.readFileSync(path.join(absDir, rel), 'utf8');
      const parsed = parseAiScriptXml(content);
      if (!parsed) continue;
      const stem = path.basename(rel).replace(/\.xml$/i, '');
      if (parsed.name !== stem) continue;                      // guard 2: name === filename
      if (compileScriptToXML(parsed) !== content) continue;    // guard 1: byte-faithful re-compile
      if (!importedAiScripts) importedAiScripts = [];
      importedAiScripts.push({ ...parsed, namespaced: true, includeInBuild: true });
    } catch { /* unreadable → passthrough */ }
  }

  // Parse content.xml <dependency> declarations into the workspace model so they survive
  // regeneration (re-emitted by generateContentXML) instead of being silently dropped — which
  // made dependent APIs no-op in-game and kept the dependency analyzer warning.
  const parsedDeps: { id: string; version?: string; optional?: boolean }[] = [];
  if (contentOriginalText) {
    const depRe = /<dependency\b([^>]*)>/gi; let dm: RegExpExecArray | null;
    while ((dm = depRe.exec(contentOriginalText)) !== null) {
      const a = dm[1] || '';
      const id = (a.match(/\bid\s*=\s*"([^"]+)"/i) || [])[1];
      if (!id) continue;
      const version = (a.match(/\bversion\s*=\s*"([^"]+)"/i) || [])[1];
      const optional = /\boptional\s*=\s*"?true"?/i.test(a);
      parsedDeps.push({ id, ...(version ? { version } : {}), ...(optional ? { optional: true } : {}) });
    }
  }

  const ws: ModWorkspace = sanitizeWorkspace({
    ...(baseWorkspace || {}),
    sourceFolder: absDir, // so the UI can always show which folder/dir is open
    ...(parsedDeps.length ? { dependencies: parsedDeps } : {}),
    name: meta.name || baseWorkspace?.name || path.basename(absDir),
    version: meta.version || baseWorkspace?.version,
    author: meta.author || baseWorkspace?.author,
    description: meta.description || baseWorkspace?.description,
    // Preserve the editable MD file's original identity (script name + filename) so export
    // regenerates it at the SAME path with the SAME <mdscript name>, instead of renaming it
    // after the mod's display title. `baseWorkspace.name` holds the parsed <mdscript name>.
    // Multi-script: per-cue mdScript (the <mdscript name>) + mdFileStem (the output path) drive
    // export now, so we no longer pin a single mdScriptName/mdFileStem/mdOriginal on the workspace.
    // Preserve the real content.xml id so export keeps the SAME extension folder + id
    // (not renamed after the display title). Falls back to the title for new mods.
    ...(meta.id ? { contentId: meta.id } : {}),
    // Keep content.xml's original bytes too (preserves <dependency> + formatting on export).
    ...(contentOriginalText ? { contentOriginal: contentOriginalText } : {}),
    tFiles,
    ...(importedWares ? { wares: importedWares } : {}),
    ...(importedJobs ? { jobs: importedJobs } : {}),
    ...(importedAiScripts ? { aiScripts: importedAiScripts } : {}),
  });

  // Only regenerate domains we actually modeled. If the MD didn't parse, turn MD
  // generation OFF so the original md file is preserved verbatim (as passthrough)
  // instead of being overwritten by an empty regenerated file. Domains without an
  // importer stay OFF — their files round-trip as passthrough until a parser models them.
  ws.compileSettings = {
    md: mdParsed,
    ui: false,
    ai: !!importedAiScripts, // #65: regenerate the aiscripts we parsed to editable (namespaced-safe); others stay passthrough
    library: !!(importedWares || importedJobs), // G13: regenerate wares/jobs we parsed to editable
    translations: tFiles.length > 0,
    patches: false
  };

  const originalFiles: any[] = [];
  if (contentRel && contentOriginalText) {
    originalFiles.push({
      path: contentRel,
      content: contentOriginalText,
      kind: 'content',
      fingerprint: contentFingerprint(ws)
    });
  }
  for (const rel of mdRels) {
    const lower = rel.toLowerCase();
    if (!editableMdRels.has(lower)) continue;
    try {
      const stem = rel.replace(/^md\//i, '').replace(/\.xml$/i, '');
      originalFiles.push({
        path: rel,
        content: fs.readFileSync(path.join(absDir, rel), 'utf8'),
        kind: 'md',
        stem,
        fingerprint: mdStemFingerprint(ws, stem)
      });
    } catch { /* ignore unreadable originals */ }
  }
  for (const rel of relFiles) {
    const lower = rel.toLowerCase();
    if (!editableTPaths.has(lower)) continue;
    const fileName = rel.replace(/^t\//i, '');
    const parsed = tFiles.find((tf: any) => String(tf.fileName || '').toLowerCase() === fileName.toLowerCase());
    if (!parsed) continue;
    try {
      originalFiles.push({
        path: rel,
        content: fs.readFileSync(path.join(absDir, rel), 'utf8'),
        kind: 'tfile',
        fingerprint: tFileFingerprint(parsed)
      });
    } catch { /* ignore unreadable originals */ }
  }
  const readmeRel = relFiles.find(f => f.toLowerCase() === 'readme.md');
  if (readmeRel) {
    try {
      originalFiles.push({
        path: readmeRel,
        content: fs.readFileSync(path.join(absDir, readmeRel), 'utf8'),
        kind: 'readme'
      });
    } catch { /* ignore unreadable readme */ }
  }
  ws.originalFiles = originalFiles;

  // Paths the manifest will regenerate from the parsed/modeled domains.
  const regenPaths = new Set<string>(Object.keys(buildWorkspaceFileManifest(ws).files).map(p => p.toLowerCase()));

  // Four-way file classification for round-trip safety awareness.
  //   editable    — parsed into a fully-modeled, graph-editable domain (the MD file)
  //   generated   — the studio regenerates this path from modeled domains on export
  //   partial     — known domain but not yet parsed to editable; preserved verbatim
  //   passthrough — unknown domain; preserved verbatim
  //   binary      — non-text; not loaded into the workspace
  type FileClass = 'editable' | 'generated' | 'partial' | 'passthrough' | 'binary';
  const classification: { path: string; class: FileClass; note?: string }[] = [];
  const passthroughFiles: any[] = [];
  const KNOWN_DOMAIN = /^(md|aiscripts|libraries|t|ui)\//i;
  // Resilience caps: never inline so much file content into the workspace that the
  // renderer chokes (the all-or-nothing white-screen on a mod that carries a runtime
  // DB or a packed CAT/DAT archive). Oversized / over-budget files are TRACKED but
  // their content is NOT loaded; they stay on disk and are preserved by the deploy guard.
  const MAX_INLINE_BYTES = 256 * 1024;             // per-file cap
  const MAX_TOTAL_INLINE_BYTES = 6 * 1024 * 1024;  // whole-import budget
  let inlinedBytes = 0;

  for (const rel of relFiles) {
    const ext = path.extname(rel).toLowerCase();
    const lower = rel.toLowerCase();
    if (editableMdRels.has(lower)) {
      classification.push({ path: rel, class: 'editable', note: 'parsed into the MD node graph' });
      continue; // regenerated from nodes on export (per-script)
    }
    if (editableTPaths.has(lower) && regenPaths.has(lower)) {
      classification.push({ path: rel, class: 'editable', note: 'parsed into the editable translation (TFile) model' });
      continue;
    }
    if (regenPaths.has(lower)) {
      classification.push({ path: rel, class: 'generated', note: 'regenerated from a modeled domain on export' });
      continue;
    }
    const absPath = path.join(absDir, rel);
    let bytes = 0; try { bytes = fs.statSync(absPath).size; } catch {}
    const kb = Math.round(bytes / 1024);
    const overBudget = bytes > MAX_INLINE_BYTES || (inlinedBytes + bytes) > MAX_TOTAL_INLINE_BYTES;
    if (!ROUND_TRIP_TEXT_EXTS.has(ext)) {
      if (overBudget) {
        passthroughFiles.push({ path: rel, reason: 'binary', omitted: true, bytes });
        classification.push({ path: rel, class: 'binary', note: `binary, ${kb} KB — tracked, not loaded (preserved on disk)` });
        continue;
      }
      let content = '';
      try { content = fs.readFileSync(absPath, 'base64'); } catch { continue; }
      inlinedBytes += content.length;
      passthroughFiles.push({ path: rel, content, reason: 'binary' });
      classification.push({ path: rel, class: 'binary', note: 'binary file, preserved verbatim via base64 encoding' });
      continue;
    }
    if (overBudget) {
      passthroughFiles.push({ path: rel, reason: 'too_large', omitted: true, bytes });
      classification.push({ path: rel, class: 'passthrough', note: `large file, ${kb} KB — tracked, not loaded (preserved on disk)` });
      continue;
    }
    let content = '';
    try { content = fs.readFileSync(absPath, 'utf8'); } catch { continue; }
    inlinedBytes += content.length;
    const known = KNOWN_DOMAIN.test(rel);
    const cls: FileClass = known ? 'partial' : 'passthrough';
    passthroughFiles.push({ path: rel, content, reason: known ? 'partial' : 'unknown_domain' });
    classification.push({ path: rel, class: cls, note: known ? 'known domain, preserved verbatim until a parser models it' : 'unknown file, preserved verbatim' });
  }

  ws.passthroughFiles = passthroughFiles;

  // STALE-SOURCE GATE stamp (P0 2026-07-09): content-keyed hash of the source folder at
  // import time. Deploy recomputes it; mismatch = the disk changed since this canvas
  // imported it → the write is blocked instead of overwriting newer truth (the incident).
  try {
    ws.sourceStamp = {
      dir: absDir,
      hash: hashFolderFingerprint(fingerprintModFolder(absDir)),
      at: new Date().toISOString(),
    };
  } catch { /* stamping is best-effort; a missing stamp only disables the gate */ }

  const counts = classification.reduce((a: any, c) => { a[c.class] = (a[c.class] || 0) + 1; return a; }, {});
  const report = {
    folder: absDir,
    totalFiles: relFiles.length,
    counts,
    classification,
    summary: `editable:${counts.editable || 0} generated:${counts.generated || 0} partial:${counts.partial || 0} passthrough:${counts.passthrough || 0} binary:${counts.binary || 0}`
  };
  return { workspace: ws, report };
}

function resolveModFolder(reqPath: string, requestedRoot?: unknown): { abs: string } | { error: string; status: number } {
  const resolved = resolveXsdConfig();
  const selection = parseProjectSourceRoot(requestedRoot);
  if (selection.error) return { error: selection.error, status: 400 };
  const configuredRoots = selection.root
    ? [configuredProjectRoot(resolved, selection.root)]
    : [resolved.modWorkspacePath, resolved.filesystemPath];
  const roots = configuredRoots
    .filter((root): root is string => Boolean(root))
    .filter((root, idx, arr) => arr.indexOf(root) === idx);
  if (roots.length === 0) {
    return {
      error: selection.root
        ? `No ${selection.root} project root is configured.`
        : 'No modWorkspacePath/filesystemPath configured.',
      status: 400,
    };
  }
  const rel = String(reqPath || '').trim();
  const normalized = path.normalize(rel);
  if (path.isAbsolute(normalized) || normalized.startsWith('..')) return { error: 'Invalid folder path.', status: 400 };
  for (const root of roots) {
    const rootAbs = path.resolve(root);
    const abs = path.resolve(rootAbs, normalized);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) continue;
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return { abs };
  }
  return { error: `Folder not found in configured roots: ${rel}`, status: 404 };
}

app.post("/api/agent/mod-folder/import", (req, res) => {
  try {
    const r = resolveModFolder(req.body?.path, req.body?.root);
    if ('error' in r) return res.status(r.status).json({ error: r.error });
    // B93.2: never 200 on a degenerate result. Pointing this at a root that is not a mod (or at a
    // whole library of mods) previously returned success with a multi-thousand-file garbage
    // workspace, which is worse than an error because it LOOKS like it worked.
    const contentXml = path.join(r.abs, 'content.xml');
    if (!fs.existsSync(contentXml)) {
      const entries = (() => { try { return fs.readdirSync(r.abs, { withFileTypes: true }); } catch { return []; } })();
      const modLikeChildren = entries
        .filter(e => e.isDirectory() && fs.existsSync(path.join(r.abs, e.name, 'content.xml')))
        .map(e => e.name);
      return res.status(400).json({
        error: modLikeChildren.length
          ? `"${req.body?.path}" is a folder CONTAINING mods, not a mod. It has no content.xml of its own. Import one of its mods instead, e.g. {"root":"${req.body?.root || 'workspace'}","path":"${modLikeChildren[0]}"}.`
          : `"${req.body?.path}" has no content.xml, so it is not an X4 extension. Point this at the mod's own folder — the one containing content.xml.`,
        code: 'NOT_A_MOD_FOLDER',
        folder: r.abs,
        ...(modLikeChildren.length ? { modsFoundInside: modLikeChildren.slice(0, 20) } : {}),
      });
    }
    const { workspace, report } = importModFolder(r.abs);
    return res.json({ success: true, workspace, report });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'mod-folder import failed' });
  }
});

app.get("/api/agent/round-trip-selftest", (req, res) => {
  let tmp = '';
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4rt-'));
    const modDir = path.join(tmp, 'roundtrip_test');
    // Synthesize a small mod exercising modeled + unknown domains.
    const mdXml = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="RoundTrip_Test" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <cue name="RT_Cue">
      <conditions>
        <event_game_started/>
      </conditions>
      <actions>
        <set_value name="$rt" exact="1"/>
      </actions>
    </cue>
  </cues>
</mdscript>`;
    const godXml = `<?xml version="1.0" encoding="utf-8"?>\n<diff>\n  <add sel="/god/stations">\n    <station id="rt_custom_station"/>\n  </add>\n</diff>\n`;
    const customLua = `-- a hand-authored helper the studio does not model\nlocal m = {}\nreturn m\n`;
    const tFileXml = `<?xml version="1.0" encoding="utf-8"?>\n<language id="44">\n  <page id="10001" title="RoundTrip">\n    <t id="1001">Bounty Hunter</t>\n    <t id="1002">Destroy the target</t>\n  </page>\n</language>`;
    const files: Record<string, string> = {
      'content.xml': `<?xml version="1.0" encoding="utf-8"?>\n<content id="roundtrip_test" name="RoundTrip_Test" author="tester" version="100" date="2026-06-11" save="0"/>`,
      'md/roundtrip_test.xml': mdXml,
      'libraries/god.xml': godXml,
      // G13: studio-emit wares/jobs should import as EDITABLE (parsed into WareDef/JobDef).
      'libraries/wares.xml': compileWaresXML([{ id: 'rt_ware', name: 'RT Ware', description: 'rt', transport: 'container', volume: 5, minPrice: 10, avgPrice: 20, maxPrice: 30, prodTime: 60, prodAmount: 100, productionMethod: 'default', includeInBuild: true }]),
      'libraries/jobs.xml': compileJobsXML([{ id: 'rt_job', name: 'RT Job', faction: 'argon', shipClass: 'fighter', shipMacro: '', galaxyQuota: 3, sectorQuota: 1, taskScript: 'masstraffic.generic', rebuildOnDestroy: false, includeInBuild: true }]),
      // #52: studio-emit aiscript should import as EDITABLE (faithfulness-guarded). name === filename stem.
      'aiscripts/rt_patrol.xml': compileScriptToXML({ id: 'rt_patrol', name: 'rt_patrol', description: '', command: '', attentionLevel: 'low', params: [{ name: '$t', type: 'object', defaultValue: 'null', comment: 'tgt' }], interrupts: [], actions: [{ id: 'a0', command: 'flee', label: 'Run', properties: {} }], includeInBuild: true }),
      't/0001-l044.xml': tFileXml,
      'subscripts/custom_helper.lua': customLua,
      'unknown_top_level.xml': `<?xml version="1.0"?>\n<weird custom="data"/>\n`,
      'README.md': `# RoundTrip Test\n\nHand-authored README that must not be replaced by generated boilerplate.\n`
    };
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(modDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }

    const { workspace, report } = importModFolder(modDir);
    const out = buildWorkspaceFileManifest(workspace);
    const outFiles = out.files;

    // Classification decides the contract: editable/generated files may be
    // regenerated (differ); partial/passthrough must be byte-identical.
    const classOf = (rel: string) => (report.classification.find((c: any) => c.path.toLowerCase() === rel.toLowerCase())?.class) || 'unknown';
    const checks: any[] = [];
    let lossless = true;
    for (const [rel, content] of Object.entries(files)) {
      const present = outFiles[rel] !== undefined;
      const cls = classOf(rel);
      const mayDiffer = cls === 'editable' || cls === 'generated';
      const identical = present && outFiles[rel] === content;
      if (!present) lossless = false;
      if (!mayDiffer && present && !identical) lossless = false;
      const pass = present && (mayDiffer || identical);
      checks.push({ name: rel, pass, path: rel, class: cls, present, byteIdentical: identical });
    }

    // G13: assert the wares/jobs imported as EDITABLE models (not preserved-raw passthrough).
    const waresOk = Array.isArray(workspace.wares) && workspace.wares.length === 1 && workspace.wares[0].id === 'rt_ware'
      && (classOf('libraries/wares.xml') === 'generated' || classOf('libraries/wares.xml') === 'editable');
    const jobsOk = Array.isArray(workspace.jobs) && workspace.jobs.length === 1 && workspace.jobs[0].id === 'rt_job'
      && (classOf('libraries/jobs.xml') === 'generated' || classOf('libraries/jobs.xml') === 'editable');
    checks.push({ name: 'G13 wares→editable model', pass: !!waresOk, class: classOf('libraries/wares.xml'), wares: (workspace.wares || []).length });
    checks.push({ name: 'G13 jobs→editable model', pass: !!jobsOk, class: classOf('libraries/jobs.xml'), jobs: (workspace.jobs || []).length });

    // #65: a faithfulness-safe aiscript (re-compiles byte-identically AND name === file stem)
    // now imports as EDITABLE — modeled into workspace.aiScripts and regenerated on export
    // (class 'generated'/'editable'), with namespaced:true so export won't re-prefix it.
    const aiCls = classOf('aiscripts/rt_patrol.xml');
    const aiOk = (aiCls === 'generated' || aiCls === 'editable')
      && (workspace.aiScripts || []).some(s => s.name === 'rt_patrol' && s.namespaced === true);
    checks.push({ name: '#65 aiscript→editable (faithful, namespaced)', pass: !!aiOk, class: aiCls, aiScripts: (workspace.aiScripts || []).length });

    // Byte-fidelity: an UNEDITED editable MD file must re-emit its ORIGINAL bytes verbatim
    // (comments/whitespace/attribute-order preserved), not a reformatted regen.
    const mdByteFaithful = outFiles['md/roundtrip_test.xml'] === files['md/roundtrip_test.xml'];
    checks.push({ name: 'md byte-fidelity (unedited→verbatim)', pass: !!mdByteFaithful, path: 'md/roundtrip_test.xml' });
    const contentByteFaithful = outFiles['content.xml'] === files['content.xml'];
    checks.push({ name: 'content.xml byte-fidelity (unedited→verbatim)', pass: !!contentByteFaithful, path: 'content.xml' });
    const readmeByteFaithful = outFiles['README.md'] === files['README.md'];
    checks.push({ name: 'README byte-fidelity (unedited→verbatim)', pass: !!readmeByteFaithful, path: 'README.md' });
    const tFileByteFaithful = outFiles['t/0001-l044.xml'] === files['t/0001-l044.xml'];
    checks.push({ name: 't-file byte-fidelity (unedited→verbatim)', pass: !!tFileByteFaithful, path: 't/0001-l044.xml' });

    const passed = checks.filter((c: any) => c.pass).length;
    // House selftest contract (allPassed/passed/total) alongside the richer lossless report,
    // so a generic dashboard/agent doesn't misread {lossless:true} as a failure (H9).
    return res.json({
      allPassed: lossless && waresOk && jobsOk && aiOk && mdByteFaithful && contentByteFaithful && readmeByteFaithful && tFileByteFaithful,
      passed,
      total: checks.length,
      lossless,
      inputFiles: Object.keys(files).length,
      outputFiles: Object.keys(outFiles).length,
      passthroughCount: (workspace.passthroughFiles || []).length,
      checks,
      importSummary: report.summary,
      importReport: report
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'selftest failed', stack: String(error?.stack || '').slice(0, 500) });
  } finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } }
  }
});

app.post("/api/agent/round-trip-check", (req, res) => {
  try {
    const r = resolveModFolder(req.body?.path, req.body?.root);
    if ('error' in r) return res.status(r.status).json({ error: r.error });
    const { workspace, report } = importModFolder(r.abs);
    const { files } = buildWorkspaceFileManifest(workspace);
    const outPaths = new Set(Object.keys(files).map(p => p.toLowerCase()));

    const inputFiles = walkFilesRelative(r.abs);
    const droppedFiles: string[] = [];
    const passthroughVerified: string[] = [];
    const omittedPreserved: string[] = [];
    const passthroughMismatch: any[] = [];
    const modeledChanged: string[] = [];
    const modeledByteChanged: any[] = [];
    const modeledByteIdentical: string[] = [];

    for (const rel of inputFiles) {
      const ext = path.extname(rel).toLowerCase();
      const inputAbs = path.join(r.abs, rel);
      const inputContent = ROUND_TRIP_TEXT_EXTS.has(ext) ? fs.readFileSync(inputAbs, 'utf8') : undefined;
      const inPassthrough = (workspace.passthroughFiles || []).find(p => p.path.toLowerCase() === rel.toLowerCase());
      if (inPassthrough) {
        if (inPassthrough.omitted) {
          omittedPreserved.push(rel);
          continue;
        }
        const outContent = files[inPassthrough.path] ?? files[rel];
        if (outContent === undefined) {
          droppedFiles.push(rel);
        } else if (outContent === inPassthrough.content) {
          passthroughVerified.push(rel);
        } else {
          passthroughMismatch.push({ path: rel, inLen: inPassthrough.content.length, outLen: outContent.length });
        }
        continue;
      }
      if (outPaths.has(rel.toLowerCase())) {
        modeledChanged.push(rel); // present in output but regenerated/modeled
        if (inputContent !== undefined) {
          const outKey = Object.keys(files).find(p => p.toLowerCase() === rel.toLowerCase()) || rel;
          const outContent = files[outKey];
          if (outContent === inputContent) {
            modeledByteIdentical.push(rel);
          } else {
            modeledByteChanged.push({
              path: rel,
              inLen: inputContent.length,
              outLen: String(outContent ?? '').length
            });
          }
        }
      } else if (!ROUND_TRIP_TEXT_EXTS.has(ext)) {
        // binary, intentionally not modeled — report separately, not a "drop"
        modeledChanged.push(rel + ' (binary, not modeled)');
      } else {
        droppedFiles.push(rel);
      }
    }

    const lossless = droppedFiles.length === 0 && passthroughMismatch.length === 0;
    const strictLossless = lossless && modeledByteChanged.length === 0;
    return res.json({
      success: true,
      lossless,
      strictLossless,
      inputFileCount: inputFiles.length,
      outputFileCount: Object.keys(files).length,
      passthroughVerified: passthroughVerified.length,
      omittedPreserved: omittedPreserved.length,
      omittedPreservedFiles: omittedPreserved,
      passthroughMismatch,
      modeledOrRegenerated: modeledChanged.length,
      modeledOrRegeneratedFiles: modeledChanged,
      modeledByteIdentical,
      modeledByteChanged,
      droppedFiles,
      importReport: report
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'round-trip-check failed' });
  }
});

/**
 * Extension Doctor (P-A) — cross-mod conflict scan over an extensions/ folder.
 * Read-only and side-effect-free. Checks: (1) missing dependencies, (2) duplicate
 * extension ids, (3) cross-mod file/patch collisions (full-file overrides + identical
 * diff selectors on a shared base path). Returns the standard diagnostic shape.
 * Extracted as a function so both the live endpoint and the selftest can call it.
 */
function runExtensionDoctor(extRoot: string, opts?: { resolveBaseContent?: (rel: string) => string | null }) {
    interface ExtInfo {
      folder: string; id: string; idLower: string; name?: string; version?: string;
      enabled: boolean; deps: { id: string; optional: boolean; name?: string }[]; absDir: string;
    }

    const exts: ExtInfo[] = [];
    for (const folder of fs.readdirSync(extRoot)) {
      const absDir = path.join(extRoot, folder);
      let isDir = false;
      try { isDir = fs.statSync(absDir).isDirectory(); } catch { isDir = false; }
      const contentPath = path.join(absDir, "content.xml");
      if (!isDir || !fs.existsSync(contentPath)) continue;

      let xml = "";
      try { xml = fs.readFileSync(contentPath, "utf8"); } catch { continue; }
      const id = xml.match(/<content\b[^>]*\bid\s*=\s*"([^"]+)"/i)?.[1] || folder;
      const enabledAttr = xml.match(/<content\b[^>]*\benabled\s*=\s*"([^"]+)"/i)?.[1];
      const enabled = enabledAttr !== "0" && enabledAttr !== "false";
      const name = xml.match(/<content\b[^>]*\bname\s*=\s*"([^"]+)"/i)?.[1];
      const version = xml.match(/<content\b[^>]*\bversion\s*=\s*"([^"]+)"/i)?.[1];

      const deps: { id: string; optional: boolean; name?: string }[] = [];
      const depRe = /<dependency\b([^>]*)>/gi;
      let dm: RegExpExecArray | null;
      while ((dm = depRe.exec(xml))) {
        const attrs = dm[1];
        const depId = attrs.match(/\bid\s*=\s*"([^"]+)"/i)?.[1];
        if (!depId) continue;
        deps.push({
          id: depId,
          optional: /\boptional\s*=\s*"(?:true|1)"/i.test(attrs),
          name: attrs.match(/\bname\s*=\s*"([^"]+)"/i)?.[1]
        });
      }
      exts.push({ folder, id, idLower: id.toLowerCase(), name, version, enabled, deps, absDir });
    }

    const idToExts = new Map<string, ExtInfo[]>();
    for (const e of exts) {
      const arr = idToExts.get(e.idLower) || [];
      arr.push(e);
      idToExts.set(e.idLower, arr);
    }
    const installedIds = new Set(exts.map(e => e.idLower));

    const findings: any[] = [];

    // CHECK 1 — dependency resolution.
    for (const e of exts) {
      for (const d of e.deps) {
        if (installedIds.has(d.id.toLowerCase())) continue;
        findings.push({
          severity: d.optional ? "info" : "error",
          category: "dependency",
          code: d.optional ? "dep.missing_optional" : "dep.missing_required",
          domain: "extension",
          filePath: `extensions/${e.folder}/content.xml`,
          message: `${e.name || e.folder} ${d.optional ? "optionally depends on" : "requires"} "${d.id}"${d.name ? ` (${d.name})` : ""}, which is not installed${d.optional ? "." : " — this extension may fail to load."}`,
          sourceRef: { kind: "dependency", id: d.id, label: e.id },
          openTargets: [{ label: e.folder, path: `${e.folder}/content.xml` }]
        });
      }
    }

    // CHECK 2 — duplicate extension ids.
    for (const arr of idToExts.values()) {
      if (arr.length < 2) continue;
      findings.push({
        severity: "error",
        category: "conflict",
        code: "ext.duplicate_id",
        domain: "extension",
        filePath: arr.map(a => `extensions/${a.folder}/content.xml`).join(", "),
        message: `Duplicate extension id "${arr[0].id}" declared by ${arr.length} folders (${arr.map(a => a.folder).join(", ")}). X4 loads only one of them.`,
        sourceRef: { kind: "extension", id: arr[0].id },
        openTargets: arr.map(a => ({ label: a.folder, path: `${a.folder}/content.xml` }))
      });
    }

    // CHECK 2b — folder name vs content id mismatch. Not fatal (X4 identifies
    // extensions by folder; dependencies reference the content id), but a mismatch
    // is a common source of confusion when wiring dependencies and debugging load
    // issues, so surface it as info. First-party ego_* content is skipped.
    for (const e of exts) {
      if (/^ego_/i.test(e.id) || /^ego_/i.test(e.folder)) continue;
      if (e.folder.toLowerCase() === e.idLower) continue;
      findings.push({
        severity: "info",
        category: "convention",
        code: "ext.folder_id_mismatch",
        domain: "extension",
        filePath: `extensions/${e.folder}/content.xml`,
        message: `Folder "${e.folder}" declares content id "${e.id}" — folder name and id differ. Dependencies resolve by id, the engine identifies the extension by folder; keeping them identical avoids wiring mistakes.`,
        sourceRef: { kind: "extension", id: e.id, label: e.folder },
        openTargets: [{ label: e.folder, path: `${e.folder}/content.xml` }]
      });
    }

    // LOAD ORDER SIMULATION — X4 loads extensions alphabetically by folder name
    // (case-insensitive), with declared dependencies loaded before their dependents.
    // Deterministic topological sort with alphabetical tie-break; used to annotate
    // conflict findings with the actual winner (last loaded wins).
    const enabledExts = exts.filter(e => e.enabled);
    const loadOrder = simulateLoadOrder(enabledExts);
    const loadRank = new Map(loadOrder.map((f, i) => [f, i]));
    const orderContested = (mods: string[]) =>
      [...mods].sort((a, b) => (loadRank.get(a) ?? -1) - (loadRank.get(b) ?? -1));

    // CHECK 2d — dependency CYCLES. simulateLoadOrder silently bails out of a cyclic
    // branch (so the load order above hides cycles); the modDependencyGraph analyzer
    // surfaces them explicitly. Reuses ONE detection path (the same engine behind
    // /api/agent/mod-dependency-selftest) rather than a second copy here.
    const depGraph = analyzeModDependencies(enabledExts.map(e => ({
      folder: e.folder, id: e.id, version: e.version, name: e.name, enabled: e.enabled,
      deps: e.deps.map(d => ({ id: d.id, optional: d.optional, name: d.name })),
    })));
    for (const cyc of depGraph.cycles) {
      const folders = cyc.slice(0, -1); // drop the repeated closing folder
      findings.push({
        severity: "error",
        category: "dependency",
        code: "dep.cycle",
        domain: "extension",
        filePath: folders.map(f => `extensions/${f}/content.xml`).join(", "),
        message: `Dependency cycle: ${cyc.join(" → ")}. X4 has no valid load order for these extensions — one will load before its dependency is ready.`,
        sourceRef: { kind: "dependency", id: folders[0] },
        openTargets: folders.map(f => ({ label: f, path: `${f}/content.xml` }))
      });
    }

    const extensionFiles = new Map<string, ExtensionFileView[]>();
    for (const e of exts) {
      if (!e.enabled || /^ego_/i.test(e.id)) continue;
      extensionFiles.set(e.folder, readExtensionFilesWithPacked(e.absDir));
    }

    // CHECK 2c — two-layer Lua analysis. Baseline layer: parser-backed syntax
    // and undefined-global hygiene with deterministic globals only. X4 layer:
    // engine/runtime hazards such as 9.0 restricted UI online-user-item calls.
    const luaFiles: LuaFileInput[] = [];
    for (const e of enabledExts) {
      if (/^ego_/i.test(e.id)) continue;
      for (const file of extensionFiles.get(e.folder) || []) {
        if (!file.rel.toLowerCase().endsWith(".lua")) continue;
        luaFiles.push({
          rel: file.rel,
          text: file.text,
          source: file.source,
          sourcePath: file.sourcePath,
          extension: { folder: e.folder, id: e.id, name: e.name }
        });
      }
    }
    const luaAnalysis = analyzeLuaFiles(luaFiles);
    let undefinedGlobalInfos = 0;
    for (const lf of luaAnalysis.findings) {
      if (lf.code === "lua.undefined_global" && undefinedGlobalInfos++ >= 25) continue;
      const e = luaFiles.find(f => f.rel === lf.rel && f.sourcePath === lf.sourcePath)?.extension;
      const folder = e?.folder || "unknown";
      findings.push({
        severity: lf.severity,
        category: lf.layer === "x4" ? "runtime" : "lua_hygiene",
        code: lf.code,
        domain: lf.layer === "x4" ? "lua_ui" : "lua",
        filePath: `extensions/${folder}/${lf.rel}`,
        message: `${e?.name || folder}: ${lf.message}${lf.source === "packed" ? ` (${path.basename(lf.sourcePath)})` : ""}`,
        sourceRef: { kind: "lua_static", id: lf.symbol || lf.code, label: folder },
        openTargets: [{ label: `${folder}/${lf.rel}`, path: `${folder}/${lf.rel}` }],
        packed: lf.source === "packed",
        archive: lf.source === "packed" ? path.basename(lf.sourcePath) : undefined,
        layer: lf.layer,
        line: lf.line,
        column: lf.column
      });
    }

    // CHECK 3 — cross-mod file/patch collisions.
    // Key every (third-party) mod's XML files by the base path they occupy (rel to ext
    // root, mirroring the base-game layout). Official DLCs (ego_*) are excluded — first-
    // party, mostly packed, layered by the engine. A path shared by >=2 mods is contested:
    // full-file overrides collide outright; diff files collide on identical selectors.
    interface FileRec { folder: string; isDiff: boolean; selectors: { op: string; sel: string }[]; }
    const pathMap = new Map<string, FileRec[]>();
    for (const e of exts) {
      if (!e.enabled || /^ego_/i.test(e.id)) continue;
      for (const file of extensionFiles.get(e.folder) || []) {
        const rel = file.rel;
        const relLower = rel.toLowerCase();
        // content.xml and ui.xml are per-extension root manifests (each mod has its own;
        // they register that mod's content/UI, they don't override each other) — never a conflict.
        if (!relLower.endsWith(".xml") || relLower === "content.xml" || relLower === "ui.xml") continue;
        // Translations (t/) and index/ files are merged additively by X4 (by language→page→id,
        // or name→path), not destructively overridden — a shared path there is not a real
        // file-level conflict, so skip them to avoid false "load order decides" warnings.
        if (relLower.startsWith("t/") || relLower.startsWith("index/")) continue;
        const xml = file.text;
        const isDiff = /<diff[\s>]/.test(xml);
        const selectors = isDiff
          ? [...xml.matchAll(/<(add|replace|remove)\b[^>]*\bsel\s*=\s*"([^"]+)"/gi)].map(mm => ({ op: mm[1].toLowerCase(), sel: mm[2] }))
          : [];
        const tf = rel.replace(/\\/g, "/");
        const arr = pathMap.get(tf) || [];
        arr.push({ folder: e.folder, isDiff, selectors });
        pathMap.set(tf, arr);
      }
    }
    for (const [tf, recs] of pathMap) {
      if (recs.length < 2) continue;
      const mods = recs.map(r => r.folder);
      const fullFileOwners = recs.filter(r => !r.isDiff).map(r => r.folder);
      const selOwners = new Map<string, string[]>();
      for (const r of recs) {
        for (const s of r.selectors) {
          const a = selOwners.get(s.sel) || [];
          a.push(r.folder);
          selOwners.set(s.sel, a);
        }
      }
      const selCollisions = [...selOwners.entries()].filter(([, o]) => o.length > 1);

      const ordered = orderContested(mods);
      const winner = ordered[ordered.length - 1];

      if (fullFileOwners.length > 0) {
        findings.push({
          severity: "warning", category: "conflict", code: "file.override_collision",
          domain: "xml_patches", filePath: tf,
          message: `${recs.length} enabled mods provide ${tf} (full-file override) — simulated load order: ${ordered.join(" → ")}; winner (loaded last): ${winner}.`,
          sourceRef: { kind: "file_conflict", id: tf, label: mods.join(", ") },
          openTargets: recs.map(r => ({ label: r.folder, path: `${r.folder}/${tf}` })),
          loadOrder: ordered, winner
        });
      } else if (selCollisions.length) {
        findings.push({
          severity: "warning", category: "conflict", code: "patch.selector_collision",
          domain: "xml_patches", filePath: tf,
          message: `${mods.length} enabled mods patch ${tf} with ${selCollisions.length} identical selector(s) — simulated load order: ${ordered.join(" → ")}; winner (loaded last): ${winner}.`,
          sourceRef: { kind: "patch_conflict", id: tf, label: mods.join(", ") },
          openTargets: recs.map(r => ({ label: r.folder, path: `${r.folder}/${tf}` })),
          loadOrder: ordered, winner
        });
      } else {
        // XPath-LEVEL overlap: selector strings differ, but they may still resolve
        // to the same node in the real base file (e.g. /jobs/job[@id='x'] vs
        // //job[@id='x']). Evaluate every selector against the resolved base
        // content and flag nodes claimed by >=2 mods where at least one op is
        // replace/remove (add+add to a shared parent merges and is fine).
        const xpathConflicts: { nodeName: string; folders: string[]; sels: string[] }[] = [];
        const baseContent = opts?.resolveBaseContent ? opts.resolveBaseContent(tf) : null;
        if (baseContent && baseContent.length <= 2_000_000) {
          try {
            const doc = new XmlDomParser({ onError: () => { /* tolerate recoverable parse noise */ } })
              .parseFromString(baseContent, 'text/xml');
            const nodeOwners = new Map<any, { folder: string; op: string; sel: string }[]>();
            let evaluated = 0;
            for (const r of recs) {
              for (const s of r.selectors) {
                if (evaluated >= 200) break;
                evaluated++;
                let matches: any;
                try { matches = xpathLib.select(s.sel, doc as any); } catch { continue; }
                if (!Array.isArray(matches)) continue;
                for (const n of matches.slice(0, 50)) {
                  const arr = nodeOwners.get(n) || [];
                  arr.push({ folder: r.folder, op: s.op, sel: s.sel });
                  nodeOwners.set(n, arr);
                }
              }
            }
            for (const [n, owners] of nodeOwners) {
              const ownerFolders = [...new Set(owners.map(o => o.folder))];
              if (ownerFolders.length < 2) continue;
              if (!owners.some(o => o.op === 'replace' || o.op === 'remove')) continue;
              xpathConflicts.push({
                nodeName: (n && n.nodeName) || '?',
                folders: ownerFolders,
                sels: [...new Set(owners.map(o => o.sel))].slice(0, 4)
              });
              if (xpathConflicts.length >= 5) break;
            }
          } catch { /* unparseable base — fall through to the info finding */ }
        }

        if (xpathConflicts.length > 0) {
          const example = xpathConflicts[0];
          const ordered2 = orderContested([...new Set(xpathConflicts.flatMap(c => c.folders))]);
          const winner2 = ordered2[ordered2.length - 1];
          findings.push({
            severity: "warning", category: "conflict", code: "patch.xpath_overlap",
            domain: "xml_patches", filePath: tf,
            message: `${mods.length} enabled mods patch ${tf} with DIFFERENT selector strings that resolve to the same node(s) in the base file — e.g. <${example.nodeName}> targeted by ${example.sels.map(s => `"${s}"`).join(" and ")} (${example.folders.join(", ")}). ${xpathConflicts.length} overlapping node(s) found; at least one op is replace/remove, so load order decides the result — simulated order: ${ordered2.join(" → ")}; winner: ${winner2}.`,
            sourceRef: { kind: "patch_conflict", id: tf, label: example.folders.join(", ") },
            openTargets: recs.map(r => ({ label: r.folder, path: `${r.folder}/${tf}` })),
            loadOrder: ordered2, winner: winner2,
            overlaps: xpathConflicts
          });
        } else {
          findings.push({
            severity: "info", category: "conflict", code: "patch.shared_target",
            domain: "xml_patches", filePath: tf,
            message: `${mods.length} enabled mods patch ${tf} (different selectors — lower conflict risk): ${mods.join(", ")}.`,
            sourceRef: { kind: "patch_conflict", id: tf, label: mods.join(", ") },
            openTargets: recs.map(r => ({ label: r.folder, path: `${r.folder}/${tf}` }))
          });
        }
      }
    }

    const rank: Record<string, number> = { error: 0, warning: 1, info: 2 };
    findings.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
    const counts = { error: 0, warning: 0, info: 0 } as Record<string, number>;
    for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;

    return {
      extensionsScanned: exts.length,
      enabledCount: exts.filter(e => e.enabled).length,
      counts,
      findings,
      loadOrder
    };
}

app.get("/api/agent/extension-doctor", (_req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const extRoot = resolved.x4GamePath ? path.join(resolved.x4GamePath, "extensions") : "";
    if (!extRoot || !fs.existsSync(extRoot)) {
      return res.status(400).json({ error: "X4 extensions folder not found. Set the X4 game path in Settings." });
    }
    // Base-content resolver for XPath-level overlap detection: loose game file
    // first, then the packed .cat/.dat archives. Cached per scan.
    const baseCache = new Map<string, string | null>();
    const resolveBaseContent = (rel: string): string | null => {
      if (baseCache.has(rel)) return baseCache.get(rel)!;
      let out: string | null = null;
      try {
        const loose = path.join(resolved.x4GamePath!, rel);
        if (fs.existsSync(loose) && fs.statSync(loose).isFile()) {
          out = fs.readFileSync(loose, 'utf8');
        } else {
          const packed = catDatExtractBaseGameFile(resolved.x4GamePath!, rel.replace(/\\/g, '/'));
          if (packed) out = packed.text;
        }
      } catch { out = null; }
      baseCache.set(rel, out);
      return out;
    };
    return res.json({ success: true, extensionsRoot: extRoot, ...runExtensionDoctor(extRoot, { resolveBaseContent }) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "extension-doctor scan failed" });
  }
});

// #71 — multi-mod project view. Exposes the FULL dependency graph (nodes + resolved
// load order + cycles + missing/optional-dep issues) across the installed extensions,
// so the UI can show the mod ecosystem, not just the cycle findings the Doctor folds in.
app.get("/api/agent/mod-dependency-graph", (_req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const extRoot = resolved.x4GamePath ? path.join(resolved.x4GamePath, "extensions") : "";
    if (!extRoot || !fs.existsSync(extRoot)) {
      return res.status(400).json({ success: false, error: "X4 extensions folder not found. Set the X4 game path in Settings." });
    }
    const present: ModManifest[] = [];
    for (const folder of fs.readdirSync(extRoot)) {
      const absDir = path.join(extRoot, folder);
      try { if (!fs.statSync(absDir).isDirectory()) continue; } catch { continue; }
      const contentPath = path.join(absDir, "content.xml");
      if (!fs.existsSync(contentPath)) continue;
      try {
        const man = parseModManifest(folder, fs.readFileSync(contentPath, "utf8"));
        if (man) present.push(man);
      } catch { /* skip unreadable extension */ }
    }
    const graph = analyzeModDependencies(present);
    return res.json({ success: true, extensionsRoot: extRoot, ...graph });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "mod-dependency-graph scan failed" });
  }
});

// T4.4 Override Visualizer (Inc 1) — per-element drill-down on a contested base
// file: who rewrites what, who wins. EXTENDS the Extension Doctor (same record
// shape + its simulated load order); the analysis engine is src/lib/overrideMap.ts.
app.get("/api/agent/override-map", (req, res) => {
  try {
    const targetFile = String(req.query.file || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (!targetFile || targetFile.includes(":") || targetFile.split("/").includes("..")) {
      return res.status(400).json({ error: "Provide ?file=<base-relative xml path>, e.g. libraries/jobs.xml" });
    }
    const resolved = resolveXsdConfig();
    const extRoot = resolved.x4GamePath ? path.join(resolved.x4GamePath, "extensions") : "";
    if (!extRoot || !fs.existsSync(extRoot)) {
      return res.status(400).json({ error: "X4 extensions folder not found. Set the X4 game path in Settings." });
    }
    // Targeted record collection: same enabled / ego_* / diff-selector rules as the
    // Doctor's pathMap, but checking only the requested rel path in each extension.
    const records: { folder: string; isDiff: boolean; selectors: { op: string; sel: string }[] }[] = [];
    const extInfos: { folder: string; idLower: string; deps: { id: string }[] }[] = [];
    for (const folder of fs.readdirSync(extRoot)) {
      const absDir = path.join(extRoot, folder);
      const contentPath = path.join(absDir, "content.xml");
      try { if (!fs.statSync(absDir).isDirectory() || !fs.existsSync(contentPath)) continue; } catch { continue; }
      let cxml = "";
      try { cxml = fs.readFileSync(contentPath, "utf8"); } catch { continue; }
      const id = cxml.match(/<content\b[^>]*\bid\s*=\s*"([^"]+)"/i)?.[1] || folder;
      if (/^ego_/i.test(id)) continue;
      const enabledAttr = cxml.match(/<content\b[^>]*\benabled\s*=\s*"([^"]+)"/i)?.[1];
      if (enabledAttr === "0" || enabledAttr === "false") continue;
      extInfos.push({ folder, idLower: id.toLowerCase(), deps: [...cxml.matchAll(/<dependency\b[^>]*\bid\s*=\s*"([^"]+)"/gi)].map(mm => ({ id: mm[1] })) });
      const filePath = path.join(absDir, targetFile);
      if (!fs.existsSync(filePath)) continue;
      let xml = "";
      try { xml = fs.readFileSync(filePath, "utf8"); } catch { continue; }
      const isDiff = /<diff[\s>]/.test(xml);
      const selectors = isDiff
        ? [...xml.matchAll(/<(add|replace|remove)\b[^>]*\bsel\s*=\s*"([^"]+)"/gi)].map(mm => ({ op: mm[1].toLowerCase(), sel: mm[2] }))
        : [];
      records.push({ folder, isDiff, selectors });
    }
    // Simulated load order — the same shared topo sort the Extension Doctor
    // uses (simulateLoadOrder), WITHOUT re-running the Doctor's full file walk
    // on every drill-down call. ego_* DLCs are excluded here as in the Doctor's
    // collision pass — they never contest third-party records.
    const loadOrder = simulateLoadOrder(extInfos);
    // Vanilla content: loose game file first, then the packed .cat/.dat archives.
    let baseContent: string | null = null;
    try {
      const loose = path.join(resolved.x4GamePath!, targetFile);
      if (fs.existsSync(loose) && fs.statSync(loose).isFile()) {
        baseContent = fs.readFileSync(loose, "utf8");
      } else {
        const packed = catDatExtractBaseGameFile(resolved.x4GamePath!, targetFile);
        if (packed) baseContent = packed.text;
      }
    } catch { baseContent = null; }
    return res.json({ success: true, ...analyzeOverrides({ targetFile, records, loadOrder, baseContent }) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "override-map failed" });
  }
});


// T4.1 Inc 0 — cat/dat round-trip spike oracle (synthetic fixture; proves
// parse → positioned read → gzip/zlib decompress before any VFS UI is built).

// H8 — object-index name-resolution oracle (synthetic fixtures; guards the regex
// XML/localization parsing incl. the multi-macro identification bounding fix).

// A4.2 — proposal-review engine oracle (synthetic fixtures; verifies the node
// diff + Schema/Graph verdicts + applySafe contract that gates AI applies).

// A4.9 — intent-satisfaction checker oracle (synthetic; verifies requirement
// pattern assertions incl. the Codex 'missing game-start trigger → FAIL' case).

// A5.1 — Architect ModBlueprint oracle (sanitize + the canMarkDone M-ARCH-2 guarantee).



// #23 — live-log error -> cue -> canvas navigation oracle (the deterministic core of the alert+jump feature).



// MD faithfulness guard oracle: proves the importer refuses to model MD it can't
// round-trip (so <delay>/<library>/<params> are preserved verbatim, never silently
// dropped), while still modeling MD it CAN round-trip.
app.get("/api/agent/md-faithfulness-selftest", (_req, res) => {
  try {
    const checks: { name: string; pass: boolean; detail?: any }[] = [];
    const ok = (name: string, pass: boolean, detail?: any) => checks.push({ name, pass, detail });

    const wsOf = (md: string) => {
      const parsed = parseXMLToWorkspace(md);
      if (!parsed || !(parsed.nodes || []).length) return null;
      return generateMDXML(sanitizeWorkspace({ ...parsed, name: 'Faith_Test' } as any));
    };

    // 1) A cue with a <delay> now ROUND-TRIPS: the timer survives + elements preserved.
    const delayMd = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="D" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <cue name="Tick"><delay exact="1s" /><actions><reset_cue cue="Tick" /></actions></cue>
  </cues>
</mdscript>`;
    const delayRegen = wsOf(delayMd);
    ok('delay_roundtrips', delayRegen !== null && /<delay exact="1s"/.test(delayRegen) && mdRoundTripPreservesElements(delayMd, delayRegen),
      { regenDelay: delayRegen ? (delayRegen.match(/<delay[^>]*>/) || [''])[0] : 'no-nodes' });

    // 2) A <library> now ROUND-TRIPS: re-emitted as <library>, params + actions preserved.
    const libMd = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="L" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <library name="Foo"><params><param name="x" default="1" /></params><actions><set_value name="$x" exact="1" /></actions></library>
    <cue name="Start"><conditions><event_game_started /></conditions><actions><set_value name="$y" exact="2" /></actions></cue>
  </cues>
</mdscript>`;
    const libRegen = wsOf(libMd);
    ok('library_roundtrips', libRegen !== null && /<library name="Foo"/.test(libRegen) && /<param name="x"/.test(libRegen) && mdRoundTripPreservesElements(libMd, libRegen),
      { regenHasLibrary: libRegen ? /<library/.test(libRegen) : 'no-nodes', regenHasParams: libRegen ? /<param /.test(libRegen) : false });

    // 3) Backstop still works: a construct we DON'T model (alternating delay/actions blocks)
    //    is detected lossy so it stays verbatim instead of silently dropping a block.
    const exoticMd = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="E" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <cue name="Multi"><delay exact="1s" /><actions><set_value name="$a" exact="1" /></actions><delay exact="2s" /><actions><set_value name="$b" exact="2" /></actions></cue>
  </cues>
</mdscript>`;
    const exoticRegen = wsOf(exoticMd);
    ok('exotic_guard_backstop', exoticRegen !== null && !mdRoundTripPreservesElements(exoticMd, exoticRegen),
      { note: 'two delay/actions blocks; model keeps one → guard keeps file verbatim' });

    // 4) A fully-modelable cue must round-trip FAITHFULLY (still editable; not a false trip).
    const cleanMd = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="C" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <cue name="Start"><conditions><event_game_started /></conditions><actions><set_value name="$z" exact="3" /></actions></cue>
  </cues>
</mdscript>`;
    const cleanRegen = wsOf(cleanMd);
    ok('clean_md_stays_faithful', cleanRegen !== null && mdRoundTripPreservesElements(cleanMd, cleanRegen),
      { regen: cleanRegen ? cleanRegen.replace(/\s+/g, ' ').slice(0, 160) : 'no-nodes' });

    const passed = checks.filter(c => c.pass).length;
    return res.json({ allPassed: passed === checks.length, passed, total: checks.length, checks });
  } catch (error) {
    return res.status(500).json({ allPassed: false, error: errorMessage(error) || "md-faithfulness-selftest failed" });
  }
});








// P4 — third-party API registry (palettization). Curated registry + ◐ heuristic
// dependency/usage validation for community library mods (sn_mod_support_apis, kuertee).

/* ------------------------------------------------------------------ *
 * P4 dynamic registry — DUMP IN new API defs from three sources, all merged
 * onto the built-in seed through the same validate→merge pipeline:
 *   1. bundled repo dir  data/api-registry/*.json
 *   2. configured folder config.apiRegistryPath (optional)
 *   3. runtime endpoint  POST /api/agent/external-api/register  (in-memory)
 * Plus derive→refine: GET /api/agent/external-api/derive reads an installed mod.
 * ------------------------------------------------------------------ */

// in-memory defs registered at runtime via the endpoint (source 3)
const runtimeApiDefs: ApiDefinition[] = [];
// last load report (for the listing endpoint)
let apiRegistrySources: {
  builtin: number; dataDir: number; folder: number; endpoint: number;
  errors: { source: string; file?: string; errors: string[] }[];
  conflicts: { extensionId: string; kind: string; detail: string }[];
} = { builtin: EXTERNAL_API_REGISTRY.length, dataDir: 0, folder: 0, endpoint: 0, errors: [], conflicts: [] };

/** Read + validate every *.json def in a directory. Bad files are reported, never fatal. */
function loadApiDefsFromDir(dir: string, origin: ApiOrigin): { defs: ApiDefinition[]; errors: { source: string; file?: string; errors: string[] }[] } {
  const defs: ApiDefinition[] = [];
  const errors: { source: string; file?: string; errors: string[] }[] = [];
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir).filter(f => {
      const lower = f.toLowerCase();
      // skip the JSON Schema + any underscore-prefixed helper files
      return lower.endsWith(".json") && lower !== "schema.json" && !f.startsWith("_");
    });
  } catch { return { defs, errors }; } // dir missing is fine
  for (const f of entries) {
    const full = path.join(dir, f);
    try {
      const raw = fs.readFileSync(full, "utf8");
      const parsed = JSON.parse(raw);
      const v = validateApiDefinition(parsed, origin);
      if (v.ok && v.normalized) defs.push(v.normalized);
      else errors.push({ source: origin, file: f, errors: v.errors });
    } catch (e) {
      errors.push({ source: origin, file: f, errors: [errorMessage(e) || "unreadable / invalid JSON"] });
    }
  }
  return { defs, errors };
}

/** Rebuild + apply the active registry from all three sources. Idempotent. */
function loadAndApplyExternalApiRegistry(): void {
  const errors: { source: string; file?: string; errors: string[] }[] = [];
  const conflictsAll: { extensionId: string; kind: string; detail: string }[] = [];

  const dataDir = dataPath("api-registry"); // B53
  const fromData = loadApiDefsFromDir(dataDir, "data-dir");
  errors.push(...fromData.errors);

  let fromFolder = { defs: [] as ApiDefinition[], errors: [] as typeof errors };
  try {
    const cfg = readXsdConfig() as Record<string, unknown>;
    const folder = typeof cfg.apiRegistryPath === "string" ? cfg.apiRegistryPath.trim() : "";
    if (folder) { fromFolder = loadApiDefsFromDir(folder, "folder"); errors.push(...fromFolder.errors); }
  } catch { /* no config */ }

  // merge in order: data-dir → folder → endpoint
  let merged = EXTERNAL_API_REGISTRY.map(e => ({ ...e, origin: "builtin" as ApiOrigin })) as ApiDefinition[];
  for (const layer of [fromData.defs, fromFolder.defs, runtimeApiDefs]) {
    const r = mergeRegistries(merged, layer);
    merged = r.registry;
    conflictsAll.push(...r.conflicts);
  }
  setActiveRegistry(merged);

  apiRegistrySources = {
    builtin: EXTERNAL_API_REGISTRY.length,
    dataDir: fromData.defs.length,
    folder: fromFolder.defs.length,
    endpoint: runtimeApiDefs.length,
    errors,
    conflicts: conflictsAll,
  };

  // Load-time guards (curated built-ins now ship as data files): make a missing or
  // malformed registry LOUD instead of silently degrading the validators.
  if (merged.length === 0) {
    console.error("[external-api-registry] WARNING: active registry is EMPTY — no API defs loaded (check data/api-registry/).");
  } else if (fromData.defs.length === 0) {
    console.warn(`[external-api-registry] No built-in API defs loaded from ${dataDir} — only ${merged.length} API(s) from other sources.`);
  }
  if (errors.length > 0) {
    console.warn(`[external-api-registry] ${errors.length} API def file(s) failed validation:`, errors.map(e => `${e.source}/${e.file || "?"}`).join(", "));
  }
}
loadAndApplyExternalApiRegistry();

// Public read-only: the merged active registry + where each entry came from + load report.
app.get("/api/agent/external-api-registry", (req, res) => {
  try {
    const registry = getActiveRegistry();
    const full = String(req.query.full || "") === "1" || req.query.full === "true";
    return res.json({
      success: true,
      count: registry.length,
      // ?full=1 returns the complete entries (with symbols) so the UI can run the
      // same detect/validate the server would; default returns a light summary.
      apis: full
        ? registry
        : registry.map(e => ({
            extensionId: e.extensionId,
            name: e.name,
            origin: (e as ApiDefinition).origin || "builtin",
            dependsOn: e.dependsOn,
            components: e.components.map(c => ({ id: c.id, title: c.title, symbols: c.symbols.length })),
          })),
      sources: apiRegistrySources,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: errorMessage(error) || "external-api-registry failed" });
  }
});

// Authenticated: register an API def at runtime (in-memory; not persisted to disk).
app.post("/api/agent/external-api/register", (req, res) => {
  try {
    const v = validateApiDefinition(req.body, "endpoint");
    if (!v.ok || !v.normalized) {
      return res.status(400).json({ success: false, ok: false, errors: v.errors });
    }
    // replace any existing runtime def with the same id, then re-merge
    const idx = runtimeApiDefs.findIndex(d => d.extensionId.toLowerCase() === v.normalized!.extensionId.toLowerCase());
    if (idx >= 0) runtimeApiDefs[idx] = v.normalized; else runtimeApiDefs.push(v.normalized);
    loadAndApplyExternalApiRegistry();
    return res.json({
      success: true, ok: true,
      registered: v.normalized.extensionId,
      totalApis: getActiveRegistry().length,
      sources: apiRegistrySources,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: errorMessage(error) || "external-api register failed" });
  }
});

// Authenticated: derive a DRAFT API def from an installed extension's loose files.
app.get("/api/agent/external-api/derive", (req, res) => {
  try {
    const ext = String(req.query.ext || "").trim();
    if (!ext || /[\\/]|\.\./.test(ext)) {
      return res.status(400).json({ success: false, error: "provide ?ext=<extension_folder_name> (no path separators)" });
    }
    const resolved = resolveXsdConfig();
    const candidates = [
      resolved.filesystemPath ? path.join(resolved.filesystemPath, ext) : "",
      resolved.x4GamePath ? path.join(resolved.x4GamePath, "extensions", ext) : "",
      resolved.modWorkspacePath ? path.join(resolved.modWorkspacePath, ext) : "",
    ].filter(Boolean);
    const extRoot = candidates.find(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
    if (!extRoot) {
      return res.status(404).json({ success: false, error: `extension "${ext}" not found under configured roots`, searched: candidates });
    }
    // collect loose .xml/.lua files (packed cat/dat not read here — honest limitation)
    const files: { path: string; content: string }[] = [];
    const MAX_FILES = 400, MAX_BYTES = 2_000_000;
    let bytes = 0;
    const walk = (dir: string, rel: string) => {
      if (files.length >= MAX_FILES || bytes >= MAX_BYTES) return;
      let ents: fs.Dirent[] = [];
      try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const d of ents) {
        if (files.length >= MAX_FILES || bytes >= MAX_BYTES) break;
        const abs = path.join(dir, d.name);
        const r = rel ? `${rel}/${d.name}` : d.name;
        if (d.isDirectory()) { walk(abs, r); continue; }
        if (!/\.(xml|lua)$/i.test(d.name)) continue;
        try {
          const sz = fs.statSync(abs).size;
          if (sz > 500_000) continue;
          const content = fs.readFileSync(abs, "utf8");
          bytes += content.length;
          files.push({ path: r, content });
        } catch { /* skip unreadable */ }
      }
    };
    walk(extRoot, "");
    // Also read PACKED .xml/.lua from the extension's own .cat/.dat (published mods —
    // sn/kuertee on Steam Workshop — ship packed, so loose-only would find nothing).
    let packedFiles = 0;
    try {
      for (const archive of findCatDatArchives([extRoot], true).filter(a => path.dirname(a.catPath).toLowerCase() === extRoot.toLowerCase())) {
        if (bytes >= MAX_BYTES || files.length >= MAX_FILES) break;
        let entries: ReturnType<typeof parseCat> = [];
        try { entries = parseCat(archive.catPath); } catch { continue; }
        for (const entry of entries) {
          if (bytes >= MAX_BYTES || files.length >= MAX_FILES) break;
          if (!/\.(xml|lua)$/i.test(entry.name)) continue;
          try {
            const content = readEntryText(archive.datPath, entry);
            if (!content || content.length > 500_000) continue;
            bytes += content.length;
            packedFiles++;
            files.push({ path: entry.name.replace(/\\/g, "/"), content });
          } catch { /* skip unreadable entry */ }
        }
      }
    } catch { /* no packed archives */ }
    const { definition, notes } = deriveApiDefinition(ext, files);
    const validation = validateApiDefinition(definition, "derived");
    return res.json({
      success: true,
      extensionRoot: extRoot,
      filesScanned: files.length,
      packedFilesScanned: packedFiles,
      definition,
      notes,
      validates: validation.ok,
      validationErrors: validation.errors,
      note: "DRAFT — reads loose + packed (.cat/.dat) .xml/.lua. Refine summaries + detect tokens, then POST to /api/agent/external-api/register.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: errorMessage(error) || "external-api derive failed" });
  }
});

// P0c — project-level agent API. Stateless: the agent holds the project (create + add
// files client-side) and POSTs it here to validate as a unit. Returns BOTH structural
// issues AND the cross-file cue index (defined/references/unresolved) as first-class
// results — the cross-file linkage is the keystone's actual value-add over per-file checks.
app.post("/api/agent/project/create", (req, res) => {
  try {
    const meta = req.body?.meta || req.body || {};
    if (!meta.id) return res.status(400).json({ error: "Body must include { meta: { id, name?, version?, deps? } } or top-level id." });
    const project = createAgentProject(meta);
    return res.json({ success: true, project });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "project create failed" });
  }
});

app.post("/api/agent/project/file/create", (req, res) => {
  try {
    const project = req.body?.project as ExtensionProject | undefined;
    const file = req.body?.file;
    if (!project || !Array.isArray(project.files) || !file?.path) {
      return res.status(400).json({ error: "Body must be { project, file: { path, content?, kind? } }." });
    }
    return res.json({ success: true, project: createProjectFile(project, file) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "project file/create failed" });
  }
});

app.post("/api/agent/project/generate", (req, res) => {
  try {
    const spec = req.body?.spec || req.body || {};
    const project = generateAgentProject(spec);
    const packaged = packageAgentProject(project);
    return res.json({ success: true, project, summary: packaged.summary, validation: packaged.validation });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "project generate failed" });
  }
});

app.post("/api/agent/project/package", (req, res) => {
  try {
    const project = req.body?.project as ExtensionProject | undefined;
    if (!project || !Array.isArray(project.files)) {
      return res.status(400).json({ error: "Body must be { project: { id, name, files } }." });
    }
    const packaged = packageAgentProject(project);
    return res.json({ success: true, ...packaged });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "project package failed" });
  }
});

app.post("/api/agent/project/validate-crossfile", (req, res) => {
  try {
    const project = req.body?.project as ExtensionProject | undefined;
    if (!project || typeof project !== "object" || !Array.isArray(project.files)) {
      return res.status(400).json({ error: "Body must be { project: { id, name, files: [{ path, kind, content? }, ...] } }." });
    }
    if (project.files.length > 2000) {
      return res.status(413).json({ error: "Project has too many files (>2000)." });
    }
    return res.json(validateProjectCrossFile(project));
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "project cross-file validate failed" });
  }
});

// Full validation layering (structure → cues → cross-file → XSD md/aiscript →
// aiscript order-param lint → scriptproperty chains) lives in
// src/server/projectValidation.ts (stage-2 modularization). Two input modes:
//   { project: {...} }        — inline payload (as before)
//   { fromPath: "x4_ai_influence" } — server reads the mod folder ITSELF from the
//     configured roots (mod workspace / live extensions dir) — ROADMAP tool-improvement
//     #6 (no ~20KB inline ceiling, no sandbox staleness) and the #5 "validate the LIVE
//     deployed mod" workflow. Path-containment guarded; never reads outside the roots.
app.post("/api/agent/project/validate", (req, res) => {
  try {
    let project = req.body?.project as ExtensionProject | undefined;
    let source: { mode: "inline" } | { mode: "fromPath"; root: string; loaded: string[]; skipped: { path: string; reason: string }[] } = { mode: "inline" };

    // B93.3: accept the SAME {root, path} shape as mod-folder/import. Callers previously had to
    // walk the folder and classify every file themselves; one reporter mis-classified
    // `libraries/*.xml`, got 16 "unknown ware" warnings, and reasonably concluded the Forge's
    // reference data was incomplete. The Forge already knows how to walk a mod folder — asking the
    // caller to reimplement that and then blaming them for the difference is the defect.
    const fromPath = typeof req.body?.fromPath === "string" ? req.body.fromPath.trim()
      : typeof req.body?.path === "string" ? req.body.path.trim()
      : "";
    if (fromPath) {
      const resolvedFolder = resolveModFolder(fromPath, req.body?.root);
      if ("error" in resolvedFolder) {
        return res.status(resolvedFolder.status).json({ error: resolvedFolder.error });
      }
      const load = loadProjectFromDisk(resolvedFolder.abs);
      project = load.project;
      source = { mode: "fromPath", root: load.root, loaded: load.loaded, skipped: load.skipped };
    }

    if (!project || typeof project !== "object" || !Array.isArray(project.files)) {
      return res.status(400).json({ error: "Body must be { project: { id, name, files: [...] } } or { fromPath: \"<mod folder>\" }." });
    }
    if (project.files.length > 2000) {
      return res.status(413).json({ error: "Project has too many files (>2000)." });
    }

    const references = (() => { try { return getReferenceSets(); } catch { return undefined; } })();
    const result = runProjectValidation(project, { references, jobsVocabulary: getJobsVocabulary(), waresVocabulary: getWaresVocabulary() });
    // Drift-as-first-class-state: when the validated mod exists as BOTH a workspace copy
    // and a deployed copy, report their divergence alongside the verdict — validating a
    // stale copy without knowing it is the trap (ROADMAP #5, confirmed 2026-07-09).
    const drift = source.mode === "fromPath" ? computeModDrift(path.basename(source.root)) : null;
    // B56s1: `flat` = the one-list diagnostic view (B55P1 currency) — consumed by the
    // extension's Problems-panel projection. Additive; existing consumers unaffected.
    const flat = flattenProjectValidation(result);
    // B57s2: `capsules` = the SAME remediation packet the in-app repair loop feeds its
    // model — one currency for our loop, the IDE, and external agents. Additive.
    return res.json({ ...result, flat, capsules: buildRemediationCapsules(flat), source, ...(drift ? { drift } : {}) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "project validate failed" });
  }
});

// B59a — patch-day readiness: does a mod's <diff> selectors still match after a game update?
// Reads the mod's diff patches, evaluates each selector against the OLD and NEW vanilla files
// (extractBaseGameFile with two game roots), reports which will silently miss. Additive/read-only.
app.get("/api/agent/patch-readiness", (req, res) => {
  try {
    const fromPath = String(req.query.fromPath || "").trim();
    const oldRoot = String(req.query.oldRoot || "").trim();
    const newRoot = String(req.query.newRoot || "").trim() || resolveXsdConfig().x4GamePath || "";
    if (!fromPath) return res.status(400).json({ error: "Missing fromPath (mod folder under the configured roots)." });
    if (!oldRoot) return res.status(400).json({ error: "Missing oldRoot — the path to the PREVIOUS game version's data (unpacked or install) to compare against. Without an old reference no patch-day check is possible." });
    if (!newRoot) return res.status(400).json({ error: "No newRoot and no configured X4 game path — set the game path in Settings or pass newRoot." });

    const resolvedFolder = resolveModFolder(fromPath);
    if ("error" in resolvedFolder) return res.status(resolvedFolder.status).json({ error: resolvedFolder.error });
    const load = loadProjectFromDisk(resolvedFolder.abs);

    // Collect diff patches: a loaded file whose content is a <diff> doc patches the vanilla
    // file at its OWN relative path (X4 convention). Selectors via the Doctor's regex shape.
    const patches: Array<{ targetFile: string; selectors: Array<{ sel: string; op?: string }> }> = [];
    for (const f of load.project.files) {
      if (typeof f.content !== "string" || !/<diff[\s>]/.test(f.content)) continue;
      const selectors = [...f.content.matchAll(/<(add|replace|remove)\b[^>]*\bsel\s*=\s*"([^"]+)"/gi)]
        .map(m => ({ op: m[1].toLowerCase(), sel: m[2] }));
      if (selectors.length) patches.push({ targetFile: f.path, selectors });
    }

    // Loose-first, then packed .cat/.dat — mirrors the Doctor's resolveBaseContent so this
    // works against BOTH an unpacked corpus (all loose) and a real install (core files packed).
    const readFrom = (root: string) => (targetFile: string): string | null => {
      const rel = targetFile.replace(/\\/g, "/");
      try {
        const loose = path.join(root, ...rel.split("/"));
        if (fs.existsSync(loose) && fs.statSync(loose).isFile()) return fs.readFileSync(loose, "utf8");
      } catch { /* fall through to packed */ }
      try { const hit = catDatExtractBaseGameFile(root, rel); return hit?.text ?? null; }
      catch { return null; }
    };
    const result = analyzePatchReadiness({ patches, resolveOld: readFrom(oldRoot), resolveNew: readFrom(newRoot) });
    return res.json({ oldRoot, newRoot, diffFiles: patches.length, ...result });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "patch-readiness failed" });
  }
});

// B57s1 — the self-describing mod folder: AGENTS.md + X4_NOTES.md content generated from
// live truth (files, cue index, routed domains, generated-file ownership). The extension
// writes the files; agents READ them. Deterministic and idempotent by construction.
app.get("/api/agent/project/brief", (req, res) => {
  try {
    const fromPath = String(req.query.fromPath || "").trim();
    if (!fromPath) return res.status(400).json({ error: "Missing fromPath." });
    const resolvedFolder = resolveModFolder(fromPath);
    if ("error" in resolvedFolder) return res.status(resolvedFolder.status).json({ error: resolvedFolder.error });
    const load = loadProjectFromDisk(resolvedFolder.abs);
    const modId = path.basename(load.root).toLowerCase();
    const files = load.loaded.map(f => f.replace(/\\/g, "/"));
    // Canvas-owned files: the compiler's manifest names for THIS folder id. content.xml
    // counts as generated only when the compiled md file exists too (canvas-produced mod).
    const mdFile = `md/${modId}.xml`;
    const generatedFiles = files.filter(f =>
      f === mdFile || f === "ui.xml" || f === `ui/${modId}.lua`
      || (f === "content.xml" && files.includes(mdFile)));
    const domains = Array.from(new Set(
      files.map(f => {
        const file = load.project.files.find(pf => pf.path === f);
        const routed = routeProjectFile(f, typeof file?.content === "string" ? file.content : "");
        return routed?.kind === "schema" ? routed.domain : routed?.kind === "tfile" ? "t" : null;
      }).filter((d): d is string => !!d)));
    const cueNames = indexCueReferences(load.project).defined.map(d => d.name);
    const input = {
      modId, files, generatedFiles, domainsPresent: domains, cueNames,
      mcpTools: ["validate_mod", "author_check", "stage_and_validate", "readiness", "list_schema_domains", "get_workspace", "compile_workspace", "explain_element"],
    };
    return res.json({ input, agentsMd: buildAgentsMd(input), notesMd: buildNotesMd(input) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "project brief failed" });
  }
});

// B57s2 — the readiness ladder as MACHINE truth for agents: the same buildReadinessStages
// the studio header uses, fed entirely from server-side evidence. The `experience` stage is
// user-screen-gated by design — the server reports it honestly un-confirmed (ADR-G3).
function computeServerReadiness() {
  const ws = sanitizeWorkspace(activeWorkspace);
  const mdCode = generateMDXML(ws);
  const graphDiagnostics = validateModWorkspace(ws, mdCode);
  const { modId, files } = buildWorkspaceFileManifest(ws);
  // The stage builder only counts severities; adapt server diagnostics to its shape.
  const packageDiagnostics = runFullWorkspaceValidation(ws, { modId, files }).diagnostics
    .map(d => ({ severity: d.severity, message: d.message, category: "egosoft" as const }));
  const brief = buildDebugWatcherBrief(modId, []);
  const stages = buildReadinessStages({
    workspaceName: ws.name,
    workspaceHash: activeWorkspaceHash(),
    graphDiagnostics,
    packageDiagnostics,
    diagnosticSource: "project",
    watcher: { phase: "ready", lastDeploy: brief.status?.lastDeploy ?? null, sinceDeploy: brief.sinceDeploy, verdict: brief.verdict, error: null },
    confirmation: null,
  });
  return { ws, modId, stages, watcherVerdict: brief.verdict };
}

app.get("/api/agent/readiness", (req, res) => {
  try {
    const { ws, modId, stages } = computeServerReadiness();
    return res.json({
      workspace: ws.name,
      modId,
      stages,
      note: "experience flips only on the user's screen (studio confirmation) — agents must never claim it.",
    });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "readiness failed" });
  }
});

// B57s4 — the PROOF artifact: one markdown page of machine evidence (readiness ladder,
// folder validation, watcher verdict, content identity). Renders ONLY server-computed
// state — there is no path to author evidence into it.
app.get("/api/agent/proof", (req, res) => {
  try {
    const fromPath = String(req.query.fromPath || "").trim();
    const { ws, stages, watcherVerdict } = computeServerReadiness();
    let folderBlock = "_no fromPath given — folder validation skipped_";
    if (fromPath) {
      const resolvedFolder = resolveModFolder(fromPath);
      if ("error" in resolvedFolder) {
        folderBlock = `_folder not resolvable: ${resolvedFolder.error}_`;
      } else {
        const load = loadProjectFromDisk(resolvedFolder.abs);
        const references = (() => { try { return getReferenceSets(); } catch { return undefined; } })();
        const result = runProjectValidation(load.project, { references, jobsVocabulary: getJobsVocabulary(), waresVocabulary: getWaresVocabulary() });
        const flat = flattenProjectValidation(result);
        const errors = flat.filter(f => f.severity === "error").length;
        const warnings = flat.filter(f => f.severity === "warning").length;
        // B58c — save-impact FACTS (deterministic; no judgment rules): what this mod adds
        // to a save (cues become part of it — renaming them later breaks saves), which
        // vanilla files it patches, and which it fully overrides (diffs are the safer form).
        const cueNames = result.cueIndex.defined.map(d => d.name);
        const diffPatched = result.schema.routed.filter(r => r.route.wrapper === "diff").map(r => r.path);
        const fullOverrides = result.schema.routed.filter(r => r.route.kind === "schema" && r.route.wrapper === "plain").map(r => r.path);
        folderBlock = [
          `- Folder: \`${load.root}\` (${load.loaded.length} files)`,
          `- Verdict: **${result.ok ? "OK" : "FAILING"}** — ${errors} error(s), ${warnings} warning(s)`,
          ...flat.slice(0, 10).map(f => `  - ${f.severity.toUpperCase()} \`${f.code || "?"}\` ${f.filePath || ""}${f.line ? `:${f.line}` : ""} — ${f.message.slice(0, 110)}`),
          flat.length > 10 ? `  - …and ${flat.length - 10} more` : "",
          "",
          "### Save-impact facts",
          `- Cues this mod adds to saves: ${cueNames.length ? cueNames.slice(0, 20).map(c => `\`${c}\``).join(", ") : "(none)"}${cueNames.length ? " — renaming released cues breaks existing saves." : ""}`,
          `- Vanilla files patched via \`<diff>\` (compatibility-friendly): ${diffPatched.length ? diffPatched.map(p => `\`${p}\``).join(", ") : "(none)"}`,
          `- Full-file overrides (replace vanilla wholesale — prefer diffs): ${fullOverrides.length ? fullOverrides.map(p => `\`${p}\``).join(", ") : "(none)"}`,
          "- The game marks any save that ever loaded a mod as *modified* permanently — that flag is engine-side and no mod or tool can remove it.",
        ].filter(Boolean).join("\n");
      }
    }
    const stageLines = stages.map(s => `| ${s.label} | **${s.status.toUpperCase()}** | ${s.evidence.replace(/\|/g, "\\|")} |`).join("\n");
    const md = `<!-- GENERATED by X4 Forge (PROOF.md) — machine evidence; regenerate, never hand-edit. -->
# Proof of state — ${ws.name}

Generated: ${new Date().toISOString()}

## Readiness ladder (machine stages)
| stage | status | evidence |
|---|---|---|
${stageLines}

Watcher verdict: \`${watcherVerdict ?? "unavailable"}\`
Workspace content hash: \`${activeWorkspaceHash()}\`

## Mod folder validation
${folderBlock}

_The experience stage flips only on the user's screen. This artifact renders server-computed
state only._
`;
    return res.json({ markdown: md, workspace: ws.name });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "proof failed" });
  }
});

// P0b/P0c — author a content.xml (with <dependency> children) from declarative meta.
app.post("/api/agent/project/content-xml", (req, res) => {
  try {
    const meta = req.body?.meta;
    if (!meta || typeof meta !== "object" || !meta.id) {
      return res.status(400).json({ error: "Body must be { meta: { id, name?, version?, author?, description?, deps? } }." });
    }
    return res.json({ contentXml: buildContentXml(meta) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "content-xml authoring failed" });
  }
});

// #64 Phase 1 — real-data galaxy/sector map built from the installed universe files.
// Read-only; reads base-game maps/xu_ep2_universe/{galaxy,clusters}.xml plus
// packed DLC/extension galaxy diffs and *_clusters.xml macro files via cat/dat.
app.get("/api/agent/galaxy-map", (_req, res) => {
  try {
    const resolved = resolveXsdConfig();
    if (!resolved.x4GamePath) return res.status(400).json({ error: "X4 game path not set." });
    const galaxyHit = catDatExtractBaseGameFile(resolved.x4GamePath, "maps/xu_ep2_universe/galaxy.xml");
    const clustersHit = catDatExtractBaseGameFile(resolved.x4GamePath, "maps/xu_ep2_universe/clusters.xml");
    if (!galaxyHit || !clustersHit) {
      return res.status(404).json({ error: "Universe files not found in the configured game path." });
    }
    const extensionMatches = catDatExtractEntries(
      [resolved.x4GamePath],
      name => name.startsWith("maps/xu_ep2_universe/")
        && (/(^|\/)galaxy\.xml$/i.test(name) || /(^|\/)[^/]*_clusters\.xml$/i.test(name)),
      { dedupeByName: false, includeSubst: true, maxBytesPerEntry: 8 * 1024 * 1024 }
    ).matches.filter(match => /[\\/]extensions[\\/]/i.test(match.catPath));
    const extensionSources: GalaxyMapSource[] = extensionMatches.map(match => ({
      path: match.name,
      text: match.text,
      source: `${path.basename(path.dirname(match.catPath))}/${match.name}`,
    }));
    const map = buildMergedGalaxyMap(galaxyHit.text, clustersHit.text, extensionSources);
    return res.json({ success: true, counts: map.counts, bounds: map.bounds, clusters: map.clusters, sectors: map.sectors, sources: map.sources });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "galaxy-map failed" });
  }
});


// scriptproperties-selftest, aiscript-lint-selftest, scriptproperties-status —
// registered by the validation module (src/server/validationRoutes.ts, stage-1 split).
// SELFTEST REGISTRY (audit R1): one line per oracle — route + public allowlist wired together.
const SELFTESTS: Record<string, () => unknown> = {
  "agent-history-selftest": runAgentHistorySelftest,
  "instance-discovery-selftest": runInstanceDiscoverySelftest,
  "agent-keys-selftest": runAgentKeysSelftest,
  "schema-discovery-selftest": runSchemaDiscoverySelftest,
  "schema-registry-selftest": runSchemaRegistrySelftest,
  "schema-routing-selftest": runSchemaRoutingSelftest,
  "xsd-model-selftest": runXsdValidateSelftest,
  "reference-language-selftest": runReferenceLanguageSelftest,
  "agent-loop-selftest": runAgentLoopSelftest,
  "lang-service-selftest": runLangServiceSelftest,
  "agent-brief-selftest": runAgentBriefSelftest,
  "patch-readiness-selftest": runPatchReadinessSelftest,
  "jobs-content-lint-selftest": runJobsContentLintSelftest,
  "migration-lint-selftest": runMigrationLintSelftest,
  "wares-content-lint-selftest": runWaresContentLintSelftest,
  "tfile-lint-selftest": runTFileLintSelftest,
  "factions-lint-selftest": runFactionsLintSelftest,
  "god-lint-selftest": runGodLintSelftest,
  "bug-report-selftest": runBugReportSelftest,
  "data-dir-selftest": runDataDirSelftest,
  "game-detect-selftest": runGameDetectSelftest,
  "path-roles-selftest": runPathRolesSelftest,
  "ttfm-selftest": runTtfmSelftest,
  "action-census-selftest": runActionCensusSelftest,
  "ai-spend-meter-selftest": runAiSpendMeterSelftest,
  "mod-patterns-selftest": runModPatternsSelftest,
  "compile-fidelity-selftest": runCompileFidelitySelftest,
  "workspace-identity-selftest": runWorkspaceIdentitySelftest,
  "mod-distribution-selftest": runModDistributionSelftest,
  "override-map-selftest": runOverrideMapSelftest,
  "catdat-selftest": runCatDatSelftest,
  "artifact-pipeline-selftest": runCompileArtifactSelftest,
  "object-index-selftest": runObjectIndexSelftest,
  "reference-corpus-selftest": runReferenceCorpusSelftest,
  "reference-literal-lint-selftest": runReferenceLiteralLintSelftest,
  "proposal-review-selftest": runProposalReviewSelftest,
  "intent-check-selftest": runIntentCheckSelftest,
  "blueprint-selftest": runBlueprintSelftest,
  "architect-loop-selftest": runArchitectLoopSelftest,
  "canvas-interaction-selftest": runCanvasInteractionSelftest,
  "live-log-nav-selftest": runLiveLogNavSelftest,
  "wares-jobs-roundtrip-selftest": runWaresJobsRoundtripSelftest,
  "aiscript-roundtrip-selftest": runAiScriptRoundtripSelftest,
  "lua-md-binding-selftest": runLuaMdBindingSelftest,
  "mod-dependency-selftest": runModDependencyGraphSelftest,
  "galaxy-map-selftest": runGalaxyMapSelftest,
  "extension-project-selftest": runExtensionProjectSelftest,
  "project-orchestration-selftest": runProjectOrchestrationSelftest,
  "project-crossfile-selftest": runProjectCrossFileSelftest,
  "external-api-registry-selftest": runExternalApiRegistrySelftest,
  "position-picker-selftest": runPositionPickerSelftest,
  "mod-drift-selftest": runModDriftSelftest,
  "quick-fixes-selftest": runWorkspaceQuickFixesSelftest,
  "mod-recipes-selftest": runModRecipesSelftest,
  "health-card-selftest": runHealthCardSelftest,
  "bridge-live-state-selftest": runBridgeLiveStateSelftest,
  "forge-watch-selftest": runForgeWatchSelftest,
  "forge-state-selftest": runForgeStateSelftest,
  "forge-probe-selftest": runForgeProbeSelftest,
  "watcher-verdict-selftest": runWatcherVerdictSelftest,
  "live-canvas-selftest": runLiveCanvasTelemetrySelftest,
  "lua-staleness-selftest": runLuaStalenessSelftest,
  "lua-runtime-log-selftest": runLuaRuntimeLogSelftest,
  "workspace-persistence-selftest": runWorkspaceStateSelftest,
  "ui-compiler-selftest": runUiCompilerSelftest,
  "node-toolbox-selftest": runNodeToolboxSelftest,
  "readiness-selftest": runReadinessSelftest,
  "experience-mode-selftest": runExperienceModeSelftest,
};
registerSelftests(app, PUBLIC_READONLY_GETS, SELFTESTS, errorMessage);

// B27: runtime selftest index — the RUNNING server states its own oracle board, so
// discovery (oracle-sweep) reads the same truth registration writes instead of
// regexing server.ts source (the blind-spot class fixed 2026-07-11). Public:
// read-only metadata, no state.
PUBLIC_READONLY_GETS.add("/agent/selftest-index");
app.get("/api/agent/selftest-index", (_req, res) => {
  // endsWith("selftest"), not "-selftest": the board includes the bare legacy
  // /agent/selftest route (found by the B27 acceptance diff, 69≠70).
  const selftests = [...PUBLIC_READONLY_GETS].filter((p) => p.startsWith("/agent/") && p.endsWith("selftest")).sort();
  return res.json({ count: selftests.length, selftests });
});

registerValidationAgentRoutes(app);
registerReferenceRoutes(app);


// Drift report for one mod present in BOTH the workspace and deployed roots.
app.get("/api/agent/mod-drift", (req, res) => {
  try {
    const mod = String(req.query.mod || "").trim();
    if (!mod) return res.status(400).json({ error: "Query ?mod=<folder name> required." });
    const report = computeModDrift(mod);
    if (!report) return res.status(404).json({ error: `"${mod}" is not present in both the mod workspace and the deployed extensions root (nothing to compare).` });
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "mod-drift failed" });
  }
});

// LIVE cue telemetry for the canvas (Play-In-Editor-adjacent, slice 1): the Canvas
// posts ITS OWN cue names and gets back per-cue fire/error counts from the debug-log
// tail, plus a `live` freshness flag (log written within the last 2 minutes = the game
// is actively playing). Works for undeployed workspaces too — names come from the graph.
app.post("/api/agent/live/cue-telemetry", async (req, res) => {
  try {
    const cueNames = Array.isArray(req.body?.cueNames)
      ? req.body.cueNames.map((n: unknown) => String(n || "").trim()).filter(Boolean).slice(0, 500)
      : [];
    if (!cueNames.length) return res.status(400).json({ error: "Body must be { cueNames: string[] }." });
    const bridge = await getBridgeLiveState(); // cached ~10s; never throws
    const candidates = findDebugLogCandidates();
    const logPath = candidates.find(c => { try { return fs.statSync(c).isFile(); } catch { return false; } });
    if (!logPath) return res.json({ available: false, live: false, reason: "No X4 debuglog found in the known locations.", cues: [], watches: [], bridge });
    const stat = fs.statSync(logPath);
    const tail = readTail(logPath, 256 * 1024);
    const telemetry = parseLogTelemetry(tail, cueNames);
    return res.json({
      available: true,
      logPath,
      logUpdatedAt: stat.mtime.toISOString(),
      live: (Date.now() - stat.mtimeMs) < 120_000,
      cues: telemetry.cues,
      totals: telemetry.totals,
      // FORGE-WATCH protocol values (slice 3) — latest per name from the tail.
      watches: parseForgeWatches(tail),
      // game←→bridge chain freshness (slice 2).
      bridge,
    });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "live cue-telemetry failed" });
  }
});

// B24s1 (ADR-F3): the Inspector's read path — latest FORGE-STATE snapshot per topic
// from the debuglog tail. READ-ONLY by construction: this endpoint (and the whole
// FORGE-STATE surface) must never grow a write path toward the game.
app.get("/api/agent/live/forge-state", (req, res) => {
  try {
    const candidates = findDebugLogCandidates();
    const logPath = candidates.find(c => { try { return fs.statSync(c).isFile(); } catch { return false; } });
    if (!logPath) return res.json({ available: false, live: false, reason: "No X4 debuglog found in the known locations.", topics: [], malformed: 0 });
    const stat = fs.statSync(logPath);
    const tail = readTail(logPath, 256 * 1024);
    const parsed = parseForgeState(tail);
    return res.json({
      available: true,
      logPath,
      logUpdatedAt: stat.mtime.toISOString(),
      live: (Date.now() - stat.mtimeMs) < 120_000,
      topics: parsed.topics,
      malformed: parsed.malformed,
    });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "forge-state read failed" });
  }
});

// B24s2 (ADR-F3): READ-ONLY preview of the generated x4_forge_probe extension. Returns
// the probe workspace + its compiled MD so an agent/UI can review it BEFORE deploying.
// NOTE: there is intentionally NO deploy endpoint here — deploying the probe into the
// game dirs is the write-gated / in-game half (Ken). The probe emits FORGE-STATE via
// debug_text only (read-only, save-removable, zero-impact when absent).
app.post("/api/agent/probe/preview", (req, res) => {
  try {
    const topics = Array.isArray(req.body?.topics) && req.body.topics.length ? req.body.topics : DEFAULT_PROBE_TOPICS;
    const ws = buildProbeWorkspace(topics);
    const md = generateMDXML(ws);
    const diagnostics = computeWorkspaceDiagnostics(ws);
    return res.json({
      workspace: ws,
      md,
      diagnosticsSummary: summarizeDiagnostics(diagnostics),
      readOnly: true,
      note: "Preview only. Deploying x4_forge_probe writes into the game extensions folder — that step is write-gated and human-run.",
    });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "probe preview failed" });
  }
});

// Expression autocomplete (beta-UX pass): legal property continuations for the text
// being typed, from the REAL scriptproperties index — the "Gmail completion" for MD.
app.post("/api/agent/suggest/expression", (req, res) => {
  try {
    const text = String(req.body?.text ?? "");
    const caret = Number.isFinite(req.body?.caret) ? Number(req.body.caret) : text.length;
    if (text.length > 4000) return res.json({ suggestions: [] });
    const spIndex = getScriptPropertyIndex();
    if (!spIndex) return res.json({ suggestions: [], available: false });
    return res.json({ available: true, suggestions: suggestExpression(text, caret, spIndex) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "expression suggest failed" });
  }
});

// Quick-fix listing (beta-UX): descriptors for one-click repairs on the workspace graph.
// Listing runs here (the scriptproperty union lives server-side); application is the
// client's pure applyQuickFix inside an undo checkpoint.
app.post("/api/agent/quick-fixes", (req, res) => {
  try {
    const ws = req.body?.workspace;
    if (!ws || !Array.isArray(ws.nodes)) return res.status(400).json({ error: "Body must be { workspace: { nodes, links } }." });
    const spIndex = getScriptPropertyIndex();
    return res.json({ fixes: listQuickFixes(ws, { propertyUnion: spIndex?.union }) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "quick-fixes failed" });
  }
});


app.get("/api/agent/expression-suggest-selftest", (_req, res) => {
  try {
    const spIndex = getScriptPropertyIndex();
    if (!spIndex) return res.json({ allPassed: false, pass: false, passed: 0, total: 0, checks: [], error: "scriptproperty index unavailable" });
    return res.json(runExpressionSuggestSelftest(spIndex));
  } catch (error) {
    return res.status(500).json({ pass: false, error: errorMessage(error) || "expression-suggest-selftest failed" });
  }
});

// Startup walkaround card (beta-UX D1): the whole environment at a glance. Probes are
// gathered here (cheap/cached services only — never triggers a cold object-index build);
// the pure engine turns them into rows. Honest: a probe that can't run reports unknown.
app.get("/api/agent/health-card", async (_req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const mdIndex = (() => { try { return getSchemaIndex(); } catch { return null; } })();
    const aiIndex = (() => { try { return getAiSchemaIndex(); } catch { return null; } })();
    const spIndex = getScriptPropertyIndex();
    const bridge = await getBridgeLiveState();
    const logPath = findDebugLogCandidates().find(c => { try { return fs.statSync(c).isFile(); } catch { return false; } });
    const ws = sanitizeWorkspace(activeWorkspace);
    const modId = (() => { try { return effectiveModId(ws); } catch { return ''; } })();
    const drift = modId ? computeModDrift(modId) : null;
    const tail = logPath ? readTail(logPath, 256 * 1024) : '';
    const luaFiles = modId ? collectModLuaFiles(modId) : [];
    const lua = luaFiles.length ? assessLuaStaleness(luaFiles.map(f => ({ path: f.path, source: f.source })), tail) : null;
    const card = buildHealthCard({
      gamePath: { path: resolved.x4GamePath || '(unset)', exists: !!resolved.x4GamePath && fs.existsSync(resolved.x4GamePath) },
      stagingPath: { path: resolved.modWorkspacePath || '(unset)', exists: !!resolved.modWorkspacePath && fs.existsSync(resolved.modWorkspacePath) },
      mdSchema: { loaded: !!mdIndex?.loaded, elements: mdIndex?.elementCount || 0 },
      aiSchema: { loaded: !!aiIndex?.loaded, elements: aiIndex?.elementCount || 0 },
      scriptProperties: { loaded: !!spIndex?.loaded, properties: spIndex?.model.parsedProperties || 0 },
      objectIndex: objectIndexCache ? { items: objectIndexCache.index.items.length } : null,
      bridge: { bridgeUp: bridge.bridgeUp, gameActive: bridge.gameActive, summary: bridge.summary },
      debugLog: logPath ? { found: true, updatedAt: fs.statSync(logPath).mtime.toISOString() } : { found: false },
      activeModDrift: drift ? { verdict: drift.verdict, summary: drift.summary } : null,
      luaStaleness: lua ? { restartRequired: lua.restartRequired, instrumented: lua.instrumented, summary: lua.summary } : null,
    });
    return res.json({ ...card, activeMod: modId || null });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "health-card failed" });
  }
});



app.get("/api/agent/live/bridge-state", async (_req, res) => {
  try {
    return res.json(await getBridgeLiveState());
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "bridge-state failed" });
  }
});





// Instrument a deployed mod's ui *.lua with FORGE-LUAV boot markers so the game-log
// watcher can detect resident-vs-disk staleness (#7). Idempotent; every rewritten file
// must pass luaparse BEFORE it is written (never break a live mod), else it's skipped.
app.post("/api/agent/lua-staleness/instrument", (req, res) => {
  try {
    const modId = toSafeModId(String(req.body?.modId || ""));
    if (!modId) return res.status(400).json({ error: "Body must be { modId }." });
    const files = collectModLuaFiles(modId);
    if (!files.length) return res.status(404).json({ error: `No ui *.lua files found for mod "${modId}".` });
    const prefix = (collectModLogMarkers(modId)[0] || "FORGE").toUpperCase();
    const results: { path: string; action: string; hash?: string; error?: string }[] = [];
    for (const f of files) {
      const injected = injectLuaVersionMarker(f.source, prefix);
      if (injected.source === f.source) { results.push({ path: f.path, action: "unchanged", hash: injected.hash }); continue; }
      try {
        luaParse(injected.source, { luaVersion: "5.2" });
      } catch (err) {
        results.push({ path: f.path, action: "SKIPPED (instrumented source failed luaparse — file left untouched)", error: errorMessage(err) });
        continue;
      }
      fs.writeFileSync(f.absPath, injected.source, "utf8");
      results.push({ path: f.path, action: "instrumented", hash: injected.hash });
    }
    return res.json({ modId, prefix, results, note: "Markers log at next game boot; the watcher then reports resident-vs-disk staleness." });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "lua-staleness instrument failed" });
  }
});

// T4.2 Diff-to-Patch — synthesize the minimal X4 <diff> turning a vanilla file
// into the user's edited copy (engine: src/lib/xpathSynth.ts). The vanilla side
// can be supplied inline or resolved from the game data (loose → packed).
app.post("/api/agent/xpath-synth", (req, res) => {
  try {
    const editedXml = String(req.body?.editedXml || "");
    if (!editedXml.trim()) {
      return res.status(400).json({ error: "Missing editedXml." });
    }
    let vanillaXml = typeof req.body?.vanillaXml === "string" ? req.body.vanillaXml : "";
    const targetFile = String(req.body?.targetFile || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (!vanillaXml && targetFile) {
      if (targetFile.includes(":") || targetFile.split("/").includes("..")) {
        return res.status(400).json({ error: "Invalid targetFile path." });
      }
      const resolved = resolveXsdConfig();
      if (resolved.x4GamePath) {
        const loose = path.join(resolved.x4GamePath, targetFile);
        if (fs.existsSync(loose) && fs.statSync(loose).isFile()) {
          vanillaXml = fs.readFileSync(loose, "utf8");
        } else {
          const packed = catDatExtractBaseGameFile(resolved.x4GamePath, targetFile);
          if (packed) vanillaXml = packed.text;
        }
      }
      if (!vanillaXml) {
        return res.status(404).json({ error: "Could not resolve vanilla content for " + targetFile + " (loose or packed)." });
      }
    }
    if (!vanillaXml) {
      return res.status(400).json({ error: "Provide vanillaXml or a resolvable targetFile." });
    }
    const result = synthesizePatch(vanillaXml, editedXml);
    return res.json({ success: true, targetFile: targetFile || null, ...result });
  } catch (error) {
    return res.status(400).json({ error: error.message || "xpath-synth failed" });
  }
});

app.get("/api/agent/xpath-synth-selftest", (_req, res) => {
  try {
    return res.json(runXpathSynthSelftest());
  } catch (error) {
    return res.status(500).json({ pass: false, error: error.message || "xpath-synth-selftest failed" });
  }
});

// Positive regression test: synthesize a temp extensions folder with deliberate faults
// (a required missing dependency, a duplicate id, and two mods patching the same
// libraries/jobs.xml with an identical selector) and assert each check fires. The real
// install is conflict-clean, so this is how we prove the positive paths actually work.
// UI layout (grid descriptor + pixel->grid bridge) self-test.
app.get("/api/agent/ui-layout-selftest", (_req, res) => {
  try { res.json(runUILayoutSelftest()); }
  catch (error) { res.status(500).json({ error: error?.message || "ui-layout-selftest failed" }); }
});

// HUD & LUA UI Layout Designer — widget validation self-test.
app.get("/api/agent/ui-widget-validate-selftest", (_req, res) => {
  try {
    res.json(runUiWidgetValidateSelftest());
  } catch (error) {
    res.status(500).json({ error: error?.message || "ui-widget-validate-selftest failed" });
  }
});

// Tier 2 / T3.3 — read/tail an X4 debug-log file and parse it into cue telemetry.
function readAndParseLogFile(filePath: string, cueNames: string[], maxBytes = 262144) {
  const stat = fs.statSync(filePath);
  let text: string;
  if (stat.size > maxBytes) {
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      fs.readSync(fd, buf, 0, maxBytes, stat.size - maxBytes);
      text = buf.toString("utf8");
      const nl = text.indexOf("\n"); if (nl >= 0) text = text.slice(nl + 1); // drop the partial first line
    } finally { fs.closeSync(fd); }
  } else {
    text = fs.readFileSync(filePath, "utf8");
  }
  return parseLogTelemetry(text, Array.isArray(cueNames) ? cueNames : []);
}

function runLogFileSelftest() {
  const checks: { name: string; pass: boolean; detail?: any }[] = [];
  const ok = (name: string, pass: boolean, detail?: any) => checks.push({ name, pass, detail });
  const tmp = path.join(os.tmpdir(), `mdstudio_logtest_${Date.now()}.log`);
  let cleaned = false;
  try {
    fs.writeFileSync(tmp, "[General] 1.0 cue Foo started\n[=ERROR=] 2.0 error in cue Bar: nil value\n");
    const r = readAndParseLogFile(tmp, ["Foo", "Bar"]);
    ok("reads_two_lines", r.totals.lines === 2);
    ok("parses_one_error", r.totals.errors === 1);
    ok("correlates_bar_error", !!r.cues.find(c => c.name === "Bar" && c.errors === 1));
    ok("correlates_foo_clean", !!r.cues.find(c => c.name === "Foo" && c.errors === 0));
  } catch (e) { ok("no_exception", false, String(e && e.message || e)); }
  finally { try { fs.unlinkSync(tmp); cleaned = true; } catch {} }
  ok("temp_cleaned_up", cleaned);
  const passed = checks.filter(c => c.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}

app.get("/api/agent/log-file-selftest", (_req, res) => {
  try {
    res.json(runLogFileSelftest());
  } catch (error) {
    res.status(500).json({ error: error?.message || "log-file-selftest failed" });
  }
});

// Live-tail endpoint (authed): read the tail of a user-specified log file + parse it.
app.post("/api/agent/log-file-tail", (req, res) => {
  try {
    const { path: filePath, cueNames, maxBytes } = (req.body || {}) as any;
    if (!filePath || typeof filePath !== "string") return res.status(400).json({ error: "path required" });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file not found" });
    const telemetry = readAndParseLogFile(filePath, cueNames, typeof maxBytes === "number" ? maxBytes : undefined);
    res.json({ success: true, path: filePath, telemetry: { ...telemetry, entries: telemetry.entries.slice(-500) } });
  } catch (error) {
    res.status(500).json({ error: error?.message || "log-file-tail failed" });
  }
});

// Tier 2 / T3.1 — log-telemetry parser self-test.
app.get("/api/agent/log-telemetry-selftest", (_req, res) => {
  try {
    res.json(runLogTelemetrySelftest());
  } catch (error) {
    res.status(500).json({ error: error?.message || "log-telemetry-selftest failed" });
  }
});

// T5 — Live Fix Loop rule-engine self-test.
app.get("/api/agent/live-fixes-selftest", (_req, res) => {
  try {
    res.json(runLiveFixesSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "live-fixes-selftest failed" });
  }
});

// Tier 2 / T2.1 — structural cue-lineage analyzer self-test.
app.get("/api/agent/cue-lineage-selftest", (_req, res) => {
  try {
    res.json(runCueLineageSelftest());
  } catch (error) {
    res.status(500).json({ error: error?.message || "cue-lineage-selftest failed" });
  }
});

// Determinism Doctrine / Phase 1 — MD Semantics Registry (the "Meaning" layer) self-test.
app.get("/api/agent/semantics-selftest", (_req, res) => {
  try {
    res.json(runSemanticsSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "semantics-selftest failed" });
  }
});

// Deterministic semantics lookup. No arg → the curated registry listing.
// ?tag=<element> → curated entry or honest fallback. ?tag=&props={json} → a
// node-style description (used to prove deterministic describe over real attributes).
app.get("/api/agent/semantics", (req, res) => {
  try {
    const tag = (req.query.tag as string) || "";
    if (!tag) {
      return res.json({ success: true, count: listSemantics().length, registry: listSemantics() });
    }
    let props: Record<string, any> = {};
    if (req.query.props) {
      try { props = JSON.parse(req.query.props as string); } catch { props = {}; }
    }
    const type = (req.query.type as string) || "action";
    res.json({ success: true, ...semanticsForNode({ xmlTag: tag, type: type as any, properties: props }) });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || "semantics lookup failed" });
  }
});

// Determinism Doctrine / Phase 2 — deterministic explainer self-test.
app.get("/api/agent/explain-selftest", (_req, res) => {
  try {
    res.json(runExplainSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "explain-selftest failed" });
  }
});

// Deterministic explanation of a posted {nodes, links} graph (no AI). Authed POST.
app.post("/api/agent/explain", (req, res) => {
  try {
    const { nodes, links } = req.body || {};
    res.json({ success: true, ...explainWorkspace(nodes || [], links || []) });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || "explain failed" });
  }
});

// Node-level schema diagnostics — maps game-schema validation to the exact node, for
// the in-your-face on-canvas error/warning badges. Schema-driven (md.xsd), no AI.
function getNodeSchemaView(): NodeSchemaView {
  try {
    const idx = getSchemaIndex();
    return {
      loaded: !!idx.loaded,
      has: (t: string) => idx.elements.has(String(t).toLowerCase()),
      requiredAttrs: (t: string) => {
        const spec = idx.elements.get(String(t).toLowerCase());
        if (!spec) return [];
        return [...spec.attributes.entries()].filter(([, a]: any) => a.required).map(([k]: any) => k);
      },
    };
  } catch {
    return { loaded: false, has: () => false, requiredAttrs: () => [] };
  }
}

app.post("/api/agent/node-diagnostics", (req, res) => {
  try {
    const nodes = Array.isArray(req.body?.nodes) ? req.body.nodes : (req.body?.workspace?.nodes || []);
    const diagnostics = validateNodesAgainstSchema(nodes, getNodeSchemaView());
    res.json({ success: true, schemaLoaded: getNodeSchemaView().loaded, diagnostics, byNode: summarizeByNode(diagnostics) });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || "node-diagnostics failed" });
  }
});

app.get("/api/agent/node-diagnostics-selftest", (_req, res) => {
  try {
    res.json(runNodeDiagnosticsSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "node-diagnostics-selftest failed" });
  }
});

// Selective node alignment/distribution geometry oracle (UE5-style align tools).
app.get("/api/agent/node-align-selftest", (_req, res) => {
  try {
    res.json(runNodeAlignSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "node-align-selftest failed" });
  }
});

// Graph auto-layout (53rd pass, gap G11) — deterministic tiered layout; no-overlap oracle.
app.get("/api/agent/auto-layout-selftest", (_req, res) => {
  try {
    res.json(runAutoLayoutSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "auto-layout-selftest failed" });
  }
});

// Composite blocks (53rd pass, gap G10) — one-click multi-node patterns; structural + compile checks.
app.get("/api/agent/composite-blocks-selftest", (_req, res) => {
  try {
    res.json(runCompositeBlocksSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "composite-blocks-selftest failed" });
  }
});

// Starter mod templates (53rd pass, gap G9) — each non-blank template must compile clean.
app.get("/api/agent/mod-templates-selftest", (_req, res) => {
  try {
    res.json(runModTemplatesSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "mod-templates-selftest failed" });
  }
});

// Compiled-XML self-test (52nd pass, gap G2) — asserts what generateMDXML actually emits.
app.get("/api/agent/compile-selftest", (_req, res) => {
  try {
    res.json(runCompileSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "compile-selftest failed" });
  }
});

// Friendly node names (51st pass, Track 1) — plain-English display-name registry self-test.
app.get("/api/agent/friendly-names-selftest", (_req, res) => {
  try {
    res.json(runFriendlyNamesSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "friendly-names-selftest failed" });
  }
});

// Port-semantics layer (50th pass) — typed-connector + branch-body model self-test.
app.get("/api/agent/port-semantics-selftest", (_req, res) => {
  try {
    res.json(runPortSemanticsSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "port-semantics-selftest failed" });
  }
});

// Determinism Doctrine / Phase 4 — deterministic MD simulator self-test.
app.get("/api/agent/simulate-selftest", (_req, res) => {
  try {
    res.json(runSimulateSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "simulate-selftest failed" });
  }
});

// Deterministic simulation of a posted {nodes, links, seed} graph (no AI). Authed POST.
// seed pre-loads known variable values (e.g. {"$threat": 5}); unseeded ⇒ unknown.
app.post("/api/agent/simulate", (req, res) => {
  try {
    const { nodes, links, seed } = req.body || {};
    res.json({ success: true, ...simulateWorkspace(nodes || [], links || [], seed || {}) });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || "simulate failed" });
  }
});

// Determinism Doctrine / Phase 3 — deterministic critic self-test.
app.get("/api/agent/critic-selftest", (_req, res) => {
  try {
    res.json(runCriticSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "critic-selftest failed" });
  }
});

// XML well-formedness gate self-test — the layer below the graph importer that catches the
// mismatched/unclosed-tag class X4 rejects on load but @xmldom/xmldom silently tolerated.
app.get("/api/agent/xml-wellformed-selftest", (_req, res) => {
  try {
    res.json(runXmlWellformedSelftest());
  } catch (error) {
    res.status(500).json({ allPassed: false, error: error?.message || "xml-wellformed-selftest failed" });
  }
});

// Vanilla-UI reference engine self-test — profiles menu Lua against the standalone-menu schema and
// validates a candidate against the patterns observed in known-working menus.
app.get("/api/agent/vanilla-ui-selftest", (_req, res) => {
  try {
    res.json(runVanillaUiReferenceSelftest());
  } catch (error) {
    res.status(500).json({ allPassed: false, error: error?.message || "vanilla-ui-selftest failed" });
  }
});

// REAL-DATA harvester: scan the base-game .cat/.dat for vanilla menu Lua, profile each against the
// standalone-menu contract, and derive which schema elements are UNIVERSAL across real menus. This
// grounds X4_STANDALONE_MENU_SCHEMA in the engine's own menus instead of two hand-picked examples.
// Authenticated, read-only, on-demand (full-cat scan is fine off the hot path).
app.get("/api/agent/vanilla-ui-harvest", (req, res) => {
  try {
    const resolved = resolveXsdConfig();
    if (!resolved.x4GamePath) return res.status(400).json({ error: "X4 game path not configured." });
    const limit = Math.min(Number(req.query.limit) || 24, 60);
    // Menu-bearing vanilla UI lua: ui/core/menus/<name>/<name>.lua, chatwindow, optionsmenu, etc.
    const isMenuLua = (n: string) => /^ui\/.*\.lua$/i.test(n) &&
      /(menu|chatwindow|widget_fullscreen|optionsmenu|interactmenu|gameoptions)/i.test(n);
    const corpus: { name: string; profile: ReturnType<typeof profileMenuLua> }[] = [];
    let scanned = 0;
    for (const arc of findCatDatArchives([resolved.x4GamePath], true)) {
      let entries: ReturnType<typeof parseCat> = [];
      try { entries = parseCat(arc.catPath); } catch { continue; }
      for (const e of entries) {
        if (corpus.length >= limit) break;
        const name = e.name.replace(/\\/g, "/");
        if (!isMenuLua(name) || !(e.size > 0 && e.size < 512 * 1024)) continue;
        let text = '';
        try { text = readEntryText(arc.datPath, e); } catch { continue; }
        if (!text) continue;
        scanned++;
        const profile = profileMenuLua(text);
        if (profile.isMenuLike) corpus.push({ name, profile });
      }
      if (corpus.length >= limit) break;
    }
    const evidence = deriveSchemaEvidence(corpus);
    return res.json({
      ok: true, scanned, menusProfiled: corpus.length,
      evidence,
      menus: corpus.map((c) => ({ name: c.name, ...c.profile })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "vanilla-ui-harvest failed" });
  }
});

// Deterministic critique of a posted {nodes, links} graph (no AI). Authed POST.
app.post("/api/agent/critic", (req, res) => {
  try {
    const { nodes, links } = req.body || {};
    res.json({ success: true, ...critiqueWorkspace(nodes || [], links || []) });
  } catch (error) {
    res.status(500).json({ success: false, error: error?.message || "critic failed" });
  }
});

// Lever 3 — vetted Lua snippet library (the harder X4 patterns) + its self-test.
app.get("/api/agent/lua-snippets", (_req, res) => {
  try {
    res.json({ success: true, snippets: LUA_SNIPPETS, selftest: runLuaSnippetSelftest() });
  } catch (error) {
    res.status(500).json({ error: error?.message || "lua-snippets failed" });
  }
});

app.get("/api/agent/lua-static-selftest", (_req, res) => {
  try {
    res.json(runLuaStaticAnalysisSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "lua-static-selftest failed" });
  }
});


app.get("/api/agent/lua-logic-blocks-selftest", (_req, res) => {
  try {
    res.json(runLuaLogicBlocksSelftest());
  } catch (error) {
    res.status(500).json({ pass: false, error: error?.message || "lua-logic-blocks-selftest failed" });
  }
});

// Lever 2 — external-integration / contract seam: validate the X4<->external HTTP/JSON
// contract and generate the X4-side glue Lua. Read-only public GETs (no secrets, no mutation).
app.get("/api/agent/contract-selftest", (_req, res) => {
  try {
    res.json(runContractGlueSelftest());
  } catch (error) {
    res.status(500).json({ error: error?.message || "contract-selftest failed" });
  }
});

app.get("/api/agent/file-bridge-transport-selftest", (_req, res) => {
  try {
    res.json(runFileBridgeTransportSelftest());
  } catch (error) {
    res.status(500).json({ error: error?.message || "file-bridge-transport-selftest failed" });
  }
});

app.get("/api/agent/contract-glue-sample", (_req, res) => {
  try {
    const sample: IntegrationContract = {
      namespace: "myai",
      baseUrl: "http://127.0.0.1:8713",
      endpoints: [
        { id: "get_status", method: "GET", path: "/v1/status", response: [{ name: "ok", type: "boolean" }] },
        { id: "send_prompt", method: "POST", path: "/v1/prompt", request: [{ name: "text", type: "string", required: true }], response: [{ name: "reply", type: "string" }] },
        { id: "file_prompt", kind: "file_bridge", request: [{ name: "text", type: "string", required: true }], response: [{ name: "reply", type: "string" }],
          fileBridge: { directory: "x4_forge_bridge", requestFile: "prompt_request.json", responseFile: "prompt_response.json", pollInterval: "0.5s", timeout: "8s" } }
      ]
    };
    const findings = validateContract(sample);
    const lua = generateHttpGlueLua(sample);
    const mdScript = generateContractMdScript(sample, "mymod_http");
    res.json({ success: true, contract: sample, findings, lua, mdScript });
  } catch (error) {
    res.status(500).json({ error: error?.message || "contract-glue-sample failed" });
  }
});

app.get("/api/agent/extension-doctor-selftest", (_req, res) => {
  let tmp = "";
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "x4ed-"));
    const write = (rel: string, content: string) => {
      const abs = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    };
    const writeCatDat = (folder: string, catName: string, entries: { name: string; text: string }[]) => {
      const dir = path.join(tmp, folder);
      fs.mkdirSync(dir, { recursive: true });
      const parts = entries.map(e => ({ name: e.name, data: Buffer.from(e.text, "utf8") }));
      const cat = parts.map((p, i) => `${p.name} ${p.data.length} ${1700000000 + i} ${String(i).repeat(32).slice(0, 32).padEnd(32, "0")}`).join("\n") + "\n";
      fs.writeFileSync(path.join(dir, catName), cat);
      fs.writeFileSync(path.join(dir, catName.replace(/\.cat$/i, ".dat")), Buffer.concat(parts.map(p => p.data)));
    };
    write("mod_a/content.xml", `<?xml version="1.0"?>\n<content id="mod_a" name="Mod A" version="100" enabled="1">\n  <dependency id="not_installed_dep" name="Ghost Dependency"/>\n</content>`);
    write("mod_a/libraries/jobs.xml", `<?xml version="1.0"?>\n<diff>\n  <add sel="/jobs"><job id="a_job"/></add>\n</diff>`);
    write("mod_b/content.xml", `<?xml version="1.0"?>\n<content id="mod_b" name="Mod B" version="100" enabled="1">\n  <dependency id="mod_z" name="Z Library"/>\n</content>`);
    write("mod_b/libraries/jobs.xml", `<?xml version="1.0"?>\n<diff>\n  <add sel="/jobs"><job id="b_job"/></add>\n</diff>`);
    // mod_z: alphabetically AFTER mod_b, but mod_b depends on it, so the topological
    // load order must place mod_z BEFORE mod_b. Also collides with mod_a/mod_b on a
    // full-file override (libraries/wares.xml) to test winner annotation.
    write("mod_z/content.xml", `<?xml version="1.0"?>\n<content id="mod_z" name="Mod Z" version="100" enabled="1"/>`);
    write("mod_a/libraries/wares.xml", `<?xml version="1.0"?>\n<wares><ware id="a_ware"/></wares>`);
    write("mod_z/libraries/wares.xml", `<?xml version="1.0"?>\n<wares><ware id="z_ware"/></wares>`);
    // XPath-overlap fixtures: DIFFERENT selector strings that resolve to the SAME
    // base node (must fire patch.xpath_overlap) vs different nodes (must stay info).
    write("mod_a/libraries/baskets.xml", `<?xml version="1.0"?>\n<diff>\n  <remove sel="/baskets/basket[@id='shared']"/>\n</diff>`);
    write("mod_b/libraries/baskets.xml", `<?xml version="1.0"?>\n<diff>\n  <replace sel="//basket[@id='shared']"><basket id="shared" tier="2"/></replace>\n</diff>`);
    write("mod_a/libraries/god.xml", `<?xml version="1.0"?>\n<diff>\n  <remove sel="/god/x[@id='a_node']"/>\n</diff>`);
    write("mod_b/libraries/god.xml", `<?xml version="1.0"?>\n<diff>\n  <replace sel="/god/x[@id='b_node']"><x id="b_node2"/></replace>\n</diff>`);
    write("mod_c/content.xml", `<?xml version="1.0"?>\n<content id="dup_id" name="Mod C" version="100" enabled="1"/>`);
    write("mod_c_dup/content.xml", `<?xml version="1.0"?>\n<content id="dup_id" name="Mod C Clone" version="100" enabled="1"/>`);
    // Both mods also ship t/0001.xml (translations MERGE) and a root ui.xml (per-extension
    // manifest) — neither must be flagged as a collision.
    write("mod_a/t/0001.xml", `<?xml version="1.0"?>\n<language id="44"><page id="1"><t id="1">A</t></page></language>`);
    write("mod_b/t/0001.xml", `<?xml version="1.0"?>\n<language id="44"><page id="2"><t id="1">B</t></page></language>`);
    write("mod_a/ui.xml", `<?xml version="1.0"?>\n<addon><environment type="menus"><file name="ui/a.lua"/></environment></addon>`);
    write("mod_b/ui.xml", `<?xml version="1.0"?>\n<addon><environment type="menus"><file name="ui/b.lua"/></environment></addon>`);
    write("mod_packed/content.xml", `<?xml version="1.0"?>\n<content id="mod_packed" name="Packed Runtime Mod" version="100" enabled="1"/>`);
    writeCatDat("mod_packed", "ext_01.cat", [
      { name: "ui/hotkey/interface.lua", text: `local amount = OnlineGetUserItemAmount("x4-example")\nreturn amount\n` },
      { name: "md/packed.xml", text: `<?xml version="1.0"?><mdscript name="Packed"><cues/></mdscript>` }
    ]);

    // Stub base resolver: the synthetic mods patch these "base game" files.
    const stubBases: Record<string, string> = {
      'libraries/baskets.xml': `<baskets><basket id="shared" tier="1"/><basket id="other"/></baskets>`,
      'libraries/god.xml': `<god><x id="a_node"/><x id="b_node"/></god>`
    };
    const result = runExtensionDoctor(tmp, { resolveBaseContent: rel => stubBases[rel.replace(/\\/g, '/')] ?? null });
    const has = (code: string, pred?: (f: any) => boolean) =>
      result.findings.some((f: any) => f.code === code && (!pred || pred(f)));
    const checks = {
      missingRequiredDep: has("dep.missing_required", f => f.sourceRef?.id === "not_installed_dep" && f.severity === "error"),
      duplicateId: has("ext.duplicate_id"),
      selectorCollision: has("patch.selector_collision", f => f.filePath === "libraries/jobs.xml" && f.severity === "warning"),
      // negative cases: translations merge and ui.xml/content.xml are per-extension manifests,
      // so shared t/ and ui.xml paths must NOT produce collisions.
      tFilesNotFlagged: !result.findings.some((f: any) => f.filePath === "t/0001.xml"),
      uiManifestNotFlagged: !result.findings.some((f: any) => f.filePath === "ui.xml"),
      // folder "mod_c" declares id "dup_id" → folder/id mismatch must fire (as info).
      folderIdMismatch: has("ext.folder_id_mismatch", f => f.sourceRef?.label === "mod_c" && f.severity === "info"),
      // load-order simulation: mod_b depends on mod_z, so mod_z loads before mod_b
      // despite sorting after it alphabetically.
      depAwareLoadOrder: Array.isArray(result.loadOrder)
        && result.loadOrder.indexOf("mod_z") !== -1
        && result.loadOrder.indexOf("mod_z") < result.loadOrder.indexOf("mod_b"),
      // selector collision (mod_a vs mod_b on libraries/jobs.xml): winner = mod_b (loads last).
      selectorWinner: has("patch.selector_collision", f => f.filePath === "libraries/jobs.xml" && f.winner === "mod_b"),
      // full-file override (mod_a vs mod_z on libraries/wares.xml): mod_z loads before
      // mod_b but after mod_a (topo: a, z, b) → winner = mod_z.
      overrideWinner: has("file.override_collision", f => f.filePath === "libraries/wares.xml" && f.winner === "mod_z"),
      // XPath overlap: "/baskets/basket[@id='shared']" (remove) and "//basket[@id='shared']"
      // (replace) are different strings resolving to the same base node → warning.
      xpathOverlap: has("patch.xpath_overlap", f => f.filePath === "libraries/baskets.xml" && f.severity === "warning"),
      // Different selectors hitting DIFFERENT nodes must stay an info shared-target.
      xpathNoFalsePositive: has("patch.shared_target", f => f.filePath === "libraries/god.xml")
        && !result.findings.some((f: any) => f.code === "patch.xpath_overlap" && f.filePath === "libraries/god.xml"),
      packedLuaRestrictedCall: has("lua.restricted_online_call", f =>
        f.filePath === "extensions/mod_packed/ui/hotkey/interface.lua"
        && f.severity === "error"
        && f.packed === true
        && f.archive === "ext_01.cat")
    };
    const pass = checks.missingRequiredDep && checks.duplicateId && checks.selectorCollision
      && checks.tFilesNotFlagged && checks.uiManifestNotFlagged
      && checks.folderIdMismatch && checks.depAwareLoadOrder
      && checks.selectorWinner && checks.overrideWinner
      && checks.xpathOverlap && checks.xpathNoFalsePositive
      && checks.packedLuaRestrictedCall;
    return res.json({ success: true, pass, checks, codes: result.findings.map((f: any) => f.code), result });
  } catch (error) {
    return res.status(500).json({ error: error.message || "extension-doctor-selftest failed" });
  } finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
});

// (cold-boot restore verified live: see ROADMAP 8th pass.)
// SQLite cache self-test (migration step 4's oracle): builds a throwaway DB and
// asserts the query layer matches a known in-memory fixture. Reports
// {available:false, reason} cleanly when better-sqlite3 isn't installed.
app.get("/api/agent/db-selftest", (_req, res) => {
  try {
    const result = dbSelfTest();

    // Stage-4 parity: when the live process has an in-memory index AND the live
    // cache DB has rows, their per-kind counts must agree.
    let liveParity: any = null;
    try {
      const db = getStudioDb();
      if (db && objectIndexCache) {
        const dbCounts = dbObjectIndexCounts(db);
        const memCounts: Record<string, number> = {};
        for (const it of objectIndexCache.index.items) memCounts[it.kind] = (memCounts[it.kind] || 0) + 1;
        const kinds = new Set([...Object.keys(dbCounts), ...Object.keys(memCounts)]);
        const mismatches = [...kinds].filter(k => (dbCounts[k] || 0) !== (memCounts[k] || 0));
        liveParity = { match: mismatches.length === 0, mismatches, memory: memCounts, db: dbCounts };
      }
    } catch { /* parity is informational */ }

    return res.json({ success: true, ...result, liveCache: getStudioDb()?.path || null, liveParity });
  } catch (error) {
    return res.status(500).json({ error: error.message || "db-selftest failed" });
  }
});

// Read a single file inside the extensions/ folder by ext-root-relative path (e.g.
// "deadair_scripts/content.xml"). Backs the Extension Doctor finding click-through.
// Read-only and path-traversal guarded.
app.get("/api/agent/extension-file", (req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const extRoot = resolved.x4GamePath ? path.join(resolved.x4GamePath, "extensions") : "";
    if (!extRoot) return res.status(400).json({ error: "X4 game path not configured." });
    const rel = String(req.query.path || "").replace(/\\/g, "/");
    if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
      return res.status(400).json({ error: "Invalid path." });
    }
    const abs = path.join(extRoot, rel);
    if (!isPathWithin(abs, extRoot)) return res.status(400).json({ error: "Path escapes extensions root." });
    if (fs.existsSync(abs)) {
      const content = fs.readFileSync(abs, "utf8");
      return res.json({ success: true, path: rel, name: path.basename(rel), content, source: "loose" });
    }

    const parts = rel.split("/").filter(Boolean);
    const folder = parts.shift();
    if (!folder || !parts.length) return res.status(404).json({ error: "File not found." });
    const extDir = path.join(extRoot, folder);
    if (!isPathWithin(extDir, extRoot) || !fs.existsSync(extDir)) return res.status(404).json({ error: "File not found." });
    const entryRel = parts.join("/").toLowerCase();
    for (const archive of findCatDatArchives([extDir], true).filter(a => path.dirname(a.catPath).toLowerCase() === extDir.toLowerCase())) {
      let entries: ReturnType<typeof parseCat> = [];
      try { entries = parseCat(archive.catPath); } catch { continue; }
      const entry = entries.find(e => e.name.toLowerCase() === entryRel);
      if (!entry || entry.size <= 0 || entry.size > 8 * 1024 * 1024) continue;
      const content = readEntryText(archive.datPath, entry);
      return res.json({ success: true, path: rel, name: path.basename(entry.name), content, source: "packed", archive: path.basename(archive.catPath) });
    }
    return res.status(404).json({ error: "File not found." });
  } catch (error) {
    return res.status(500).json({ error: error.message || "extension-file read failed" });
  }
});

// Public read-only audit: build a workspace exercising every node template and
// curated MD branch, generate MD, validate against the real schema, and report
// findings plus the schema truth for each involved element. Used to drive the
// MD generator to zero schema violations.
app.get("/api/agent/md-audit", (req, res) => {
  try {
    // Build one cue with every event/condition under conditions and every action
    // chained under actions so the generator's curated + generic paths all fire.
    const nodes: any[] = [];
    const links: any[] = [];
    const cueId = 'audit_cue';
    nodes.push({ id: cueId, type: 'cue', xmlTag: 'cue', label: 'Audit Cue', x: 0, y: 0, properties: { name: 'Audit_Cue' }, includeInBuild: true });

    let prevAction: string | null = null;
    let actionIndex = 0;
    let condIndex = 0;
    for (const tpl of (NODE_TEMPLATES as any[])) {
      if (tpl.xmlTag === 'cue') continue;
      const id = `n_${tpl.xmlTag}_${actionIndex}_${condIndex}`;
      nodes.push({ ...tpl, id, x: 0, y: 0, properties: { ...tpl.properties }, includeInBuild: true });
      if (tpl.type === 'action') {
        if (prevAction === null) links.push({ id: `l_${id}`, sourceNodeId: cueId, sourcePortId: 'out_act', targetNodeId: id, targetPortId: 'in_act' });
        else links.push({ id: `l_${id}`, sourceNodeId: prevAction, sourcePortId: 'out_next', targetNodeId: id, targetPortId: 'in_act' });
        prevAction = id; actionIndex++;
      } else {
        // events + conditions go under the cue's conditions block
        links.push({ id: `l_${id}`, sourceNodeId: cueId, sourcePortId: 'out_cond', targetNodeId: id, targetPortId: 'in_cond' });
        condIndex++;
      }
    }

    const ws = sanitizeWorkspace({ name: 'MD_Audit', nodes, links });
    const md = generateMDXML(ws);
    const index = getSchemaIndex();
    const findings = validateXmlAgainstSchema(md, index, { filePath: 'md/md_audit.xml', domain: 'mission_director', reportUnknownElements: true, references: getReferenceSets() });

    // Schema truth for every element that appears in a finding.
    const involved = [...new Set(findings.map(f => String(f.sourceRef || '').split('@')[0]).filter(Boolean))];
    const schemaTruth: Record<string, any> = {};
    for (const name of involved) {
      const spec = index.elements.get(name.toLowerCase());
      schemaTruth[name] = spec
        ? { resolved: spec.resolved, attrs: [...spec.attributes.keys()], children: [...spec.children] }
        : { inIndex: false };
    }

    return res.json({
      findingCount: findings.length,
      byCode: findings.reduce((a: any, f) => { a[f.code || '?'] = (a[f.code || '?'] || 0) + 1; return a; }, {}),
      findings: findings.map(f => ({ severity: f.severity, code: f.code, ref: f.sourceRef, line: f.line, message: f.message })),
      schemaTruth,
      md
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'md-audit failed', stack: String(error?.stack || '').slice(0, 400) });
  }
});

// Public read-only self-test for the agent mutation API. Snapshots and restores
// the live workspace/version so it never leaves a side effect.
app.get("/api/agent/api-selftest", (req, res) => {
  const savedWs = activeWorkspace;
  const savedVer = workspaceVersion;
  try {
    const results: any[] = [];
    // 1. dry-run replace: must NOT apply, version unchanged.
    const dry = applyWorkspaceMutation({ ...savedWs, version: '9.9.9' }, { dryRun: true });
    results.push({ test: 'dryRun', pass: dry.status === 200 && dry.body.applied === false && workspaceVersion === savedVer, detail: { applied: dry.body.applied, version: workspaceVersion } });
    // 2. stale write: expectedVersion wrong -> 409.
    const stale = applyWorkspaceMutation({ ...savedWs }, { expectedVersion: savedVer + 999 });
    results.push({ test: 'versionConflict', pass: stale.status === 409 && stale.body.error === 'version_conflict', detail: { status: stale.status } });
    // 3. merge with correct expectedVersion: applies, version bumps.
    const merge = applyWorkspaceMutation({ version: '7.7.7' }, { expectedVersion: savedVer, merge: true });
    results.push({ test: 'mergeApply', pass: merge.status === 200 && merge.body.applied === true && workspaceVersion === savedVer + 1 && activeWorkspace.version === '7.7.7', detail: { applied: merge.body.applied, newVersion: workspaceVersion, mergedVersion: activeWorkspace.version } });
    // 4. B2s3 legacy gate: a blind write (no head, no version, no force) is rejected.
    const legacy = applyWorkspaceMutation({ ...savedWs, version: '8.8.8' }, {});
    results.push({ test: 'legacyRejected', pass: legacy.status === 409 && legacy.body.error === 'legacy_write_rejected', detail: { status: legacy.status, error: legacy.body.error } });
    // 5. B2s3 force valve: the same blind write with force:true is a deliberate overwrite.
    const forced = applyWorkspaceMutation({ ...savedWs, version: '8.8.9' }, { force: true });
    results.push({ test: 'forceAccepted', pass: forced.status === 200 && forced.body.applied === true, detail: { status: forced.status } });
    // 6. B2s3 first-contact allowance: on a fresh install (nothing persisted, nothing
    // committed) a legacy write is allowed once. Simulated by flag swap, restored below.
    const savedBootFlag = hadPersistedStateAtBoot; const savedCommitFlag = anyCommitSinceBoot;
    hadPersistedStateAtBoot = false; anyCommitSinceBoot = false;
    const firstContact = applyWorkspaceMutation({ ...savedWs, version: '9.0.1' }, {});
    hadPersistedStateAtBoot = savedBootFlag; anyCommitSinceBoot = savedCommitFlag;
    results.push({ test: 'firstContactLegacyAllowed', pass: firstContact.status === 200 && firstContact.body.applied === true, detail: { status: firstContact.status } });
    return res.json({ allPassed: results.every(r => r.pass), results });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'api-selftest failed' });
  } finally {
    // Always restore live state. Deliberately RAW (not commitActiveWorkspace): this swap
    // is test-scoped and must not park anything — but the mid-test commit persisted test
    // junk to disk, so re-persist the restored truth or a later restart adopts the junk.
    activeWorkspace = savedWs;
    workspaceVersion = savedVer;
    try {
      writeActiveState(STUDIO_STATE_DIR, { workspace: savedWs, version: savedVer, savedAt: new Date().toISOString(), origin: 'api-selftest-restore' });
    } catch { /* persistence failure never fails the selftest response */ }
  }
});

// Public read-only self-test for the deterministic live-feedback log logic.
// Public read-only test for reference + time-format validation, using the exact
// failures observed in-game (invalid macro, bare-number duration).
// Consolidated regression: runs every public self-test and reports one verdict.
app.get("/api/agent/selftest", async (req, res) => {
  const base = `http://127.0.0.1:${PORT}/api/agent`;
  const get = async (p: string) => { try { const r = await fetch(`${base}/${p}`); return await r.json(); } catch (e) { return { __error: String(e?.message || e) }; } };
  try {
    const [md, ref, api, log, rt, patch] = await Promise.all([
      get('md-audit'), get('reference-selftest'), get('api-selftest'), get('log-selftest'), get('round-trip-selftest'), get('patch-audit')
    ]);
    const checks = [
      { name: 'md_generator_zero_findings', pass: md.findingCount === 0, detail: { findingCount: md.findingCount } },
      { name: 'reference_macro_caught', pass: (ref.macroDiagnostics || []).length === 1 },
      { name: 'reference_time_format_caught', pass: (ref.timeFormatDiagnostics || []).length === 1 },
      { name: 'reference_faction_bad_caught', pass: ref.factionBadDetected === true },
      { name: 'reference_faction_good_clean', pass: ref.factionGoodClean === true },
      { name: 'generator_emits_time_units', pass: ref.durationEmittedWithUnit === true },
      { name: 'agent_api_concurrency', pass: api.allPassed === true },
      { name: 'live_feedback_logic', pass: log.allPassed === true },
      { name: 'round_trip_lossless', pass: rt.lossless === true },
      { name: 'patch_diagnostics', pass: Array.isArray(patch.diagnostics) && patch.diagnostics.some((d: any) => d.code === 'patch.target_unresolved') && patch.diagnostics.some((d: any) => d.code === 'patch.selector_root_mismatch') }
    ];
    return res.json({ allPassed: checks.every(c => c.pass), passed: checks.filter(c => c.pass).length, total: checks.length, checks });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'selftest failed' });
  }
});

// B56s3 — X4 IntelliSense endpoints (public read-only): completion/hover data for the
// IDE extension's language providers. Index selection mirrors the validation routing —
// md/ and aiscripts/ use their existing indexes; routed subset files use the registry
// domain; anything else answers empty (never the wrong vocabulary).
function langIndexFor(file: string, rootHint?: string): { index: SchemaIndex | null; domain: string } {
  const p = String(file || "").replace(/\\/g, "/").toLowerCase();
  try {
    if (/(^|\/)aiscripts\//.test(p)) return { index: getAiSchemaIndex(), domain: "aiscripts" };
    if (/(^|\/)md\//.test(p) || !p) return { index: getSchemaIndex(), domain: "md" };
    const routed = routeProjectFile(p, rootHint === "diff" ? "<diff/>" : `<${rootHint || ""}/>`);
    if (routed?.kind === "schema" && routed.domain) {
      const resolved = resolveXsdConfig();
      const registry = discoverSchemaRegistry(resolved.schemaDir, resolved.x4GamePath || undefined);
      const info = registry.domains.find(d => d.domain === routed.domain);
      if (info) return { index: getDomainIndex(info), domain: routed.domain };
    }
    if (/(^|\/)t\/[^/]+\.xml$/.test(p)) return { index: null, domain: "t" };
  } catch { /* degrade to empty below */ }
  return { index: null, domain: "none" };
}

app.get("/api/agent/lang/complete", (req, res) => {
  try {
    const { index, domain } = langIndexFor(String(req.query.file || ""), String(req.query.root || "") || undefined);
    const parent = String(req.query.parent || "") || null;
    return res.json({ domain, parent, items: index ? completeChildren(index, parent) : [] });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "lang complete failed" });
  }
});

app.get("/api/agent/lang/attrs", (req, res) => {
  try {
    const { index, domain } = langIndexFor(String(req.query.file || ""), String(req.query.root || "") || undefined);
    const tag = String(req.query.tag || "") || null;
    return res.json({ domain, tag, attrs: index ? attributesFor(index, tag) : [] });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "lang attrs failed" });
  }
});

app.get("/api/agent/lang/hover", (req, res) => {
  try {
    const { index, domain } = langIndexFor(String(req.query.file || ""), String(req.query.root || "") || undefined);
    const tag = String(req.query.tag || "") || null;
    return res.json({ domain, ...(index ? hoverFor(index, tag) : { tag: (tag || "").toLowerCase(), known: false, requiredAttrs: [], attrCount: 0 }) });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "lang hover failed" });
  }
});

// Public probe: report the schema-declared type of specific element attributes,
// to confirm whether X4 types are strict (time/int) or permissive (expression).
app.get("/api/agent/type-probe", (req, res) => {
  try {
    const index = getSchemaIndex();
    const probe: Array<[string, string]> = [
      ['show_help', 'duration'], ['set_value', 'exact'], ['wait', 'exact'], ['wait', 'min'],
      ['create_ship', 'macro'], ['show_notification', 'timeout'], ['signal_cue_instantly', 'cue'], ['play_sound', 'sound']
    ];
    const out: any = {};
    for (const [el, at] of probe) {
      const spec = index.elements.get(el);
      const a = spec?.attributes.get(at);
      out[`${el}@${at}`] = a ? { type: a.type || '(none)', enum: a.enumValues ? a.enumValues.slice(0, 6) : undefined, required: a.required } : (spec ? 'attr_not_found' : 'element_not_found');
    }
    // Full type vocabulary across the index (to find reference types like macroname/cuename/warename).
    const typeCounts: Record<string, number> = {};
    for (const [, spec] of index.elements) {
      for (const [, a] of spec.attributes) {
        const t = a.type || '(none)';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
    }
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const nameTypes = sortedTypes.filter(([t]) => /name$|ref$/i.test(t));
    // Sample real macros to pick valid template defaults.
    const oi = getObjectIndex();
    const sampleStations = oi.items.filter(i => i.kind === 'station' && /defence|defense/i.test(i.id)).slice(0, 8).map(i => i.id);
    const anyStations = oi.items.filter(i => i.kind === 'station').slice(0, 6).map(i => i.id);
    const sampleShips = oi.items.filter(i => i.kind === 'ship' && i.id.includes('arg')).slice(0, 4).map(i => i.id);
    return res.json({
      note: 'If types are generic (expression/unions), the XSD cannot catch runtime value errors — value-format validation is needed.',
      types: out,
      referenceTypeCandidates: nameTypes,
      sampleDefenceStations: sampleStations,
      anyStations,
      sampleArgonShips: sampleShips
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'type-probe failed' });
  }
});

app.get("/api/agent/reference-selftest", (req, res) => {
  try {
    const badWs = sanitizeWorkspace({
      name: 'Ref_Test',
      nodes: [
        { id: 'c', type: 'cue', xmlTag: 'cue', properties: { name: 'C' }, includeInBuild: true },
        { id: 's1', type: 'action', xmlTag: 'create_ship', properties: { name: '$x', macro: 'ship_xen_i_destroyer_01_macro', faction: 'xenon' }, includeInBuild: true },
        { id: 'h1', type: 'action', xmlTag: 'show_help', properties: { text: 'hi', duration: 8 }, includeInBuild: true }
      ],
      links: [
        { id: 'l1', sourceNodeId: 'c', sourcePortId: 'out_act', targetNodeId: 's1', targetPortId: 'in_act' },
        { id: 'l2', sourceNodeId: 's1', sourcePortId: 'out_next', targetNodeId: 'h1', targetPortId: 'in_act' }
      ]
    });
    const { modId, files } = buildWorkspaceFileManifest(badWs);
    const md = files[`md/${modId}.xml`] || '';
    // Schema-driven validation with real reference sets (macroname type -> macro index).
    const index = getSchemaIndex();
    const references = getReferenceSets();
    const diags = validateXmlAgainstSchema(md, index, { domain: 'mission_director', reportUnknownElements: true, references });
    // Also validate a raw bare-number duration to confirm the time-format net.
    const timeDiags = validateXmlAgainstSchema('<show_help custom="x" duration="8"/>', index, { references });
    // Faction: invalid vs valid literal.
    const factionBad = validateXmlAgainstSchema('<create_ship macro="ship_arg_l_destroyer_01_a_macro"><owner exact="faction.notareal"/></create_ship>', index, { references });
    const factionGood = validateXmlAgainstSchema('<create_ship macro="ship_arg_l_destroyer_01_a_macro"><owner exact="faction.argon"/></create_ship>', index, { references });
    const macroDiagnostics = diags.filter(d => d.code === 'REF_UNKNOWN_MACRO').map(d => ({ code: d.code, severity: d.severity, ref: d.sourceRef, message: d.message.slice(0, 110) }));
    const timeFormatDiagnostics = timeDiags.filter(d => d.code === 'XSD_TIME_FORMAT').map(d => ({ code: d.code, severity: d.severity, message: d.message.slice(0, 110) }));
    const durationEmittedWithUnit = /duration="8s"/.test(md);
    const factionBadDetected = factionBad.some(d => d.code === 'REF_UNKNOWN_FACTION');
    const factionGoodClean = !factionGood.some(d => d.code === 'REF_UNKNOWN_FACTION');
    const checks = [
      { name: 'generator_emits_time_units', pass: durationEmittedWithUnit },
      { name: 'unknown_macro_caught', pass: macroDiagnostics.length > 0 },
      { name: 'bare_time_format_caught', pass: timeFormatDiagnostics.length > 0 },
      { name: 'bad_faction_caught', pass: factionBadDetected },
      { name: 'valid_faction_clean', pass: factionGoodClean }
    ];
    return res.json({
      pass: checks.every(c => c.pass),
      checks,
      durationEmittedWithUnit,
      durationRaw: (md.match(/duration="[^"]*"/) || [])[0] || null,
      macroDiagnostics,
      timeFormatDiagnostics,
      factionBadDetected,
      factionGoodClean,
      mdSnippet: (md.match(/<create_ship[^>]*>/) || [])[0] || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'reference-selftest failed', stack: String(error?.stack||'').slice(0,300) });
  }
});

app.get("/api/agent/log-selftest", (req, res) => {
  try {
    const modId = 'mymod';
    const cleanTail = `[General] 1.23 Loading extension mymod\n[General] 1.40 extension 'mymod' loaded`;
    const errorTail = `[General] 1.23 Loading extension mymod\n[Scripts] 2.5 *** Error in MD script 'mymod' cue 'Start': unexpected value (line 18)`;
    const notSeenTail = `[General] 1.0 Loading extension othermod\n[General] 1.1 done`;

    const clean = computeGameStates({ tail: cleanTail, modIds: [modId], deployed: true, stale: false });
    const errored = computeGameStates({ tail: errorTail, modIds: [modId], deployed: true, stale: false });
    const errIssue = analyzeGameLog(errorTail, [modId]).issues.find(i => i.matchesActiveMod);
    const notSeen = computeGameStates({ tail: notSeenTail, modIds: [modId], deployed: true, stale: false });

    // A2 — deterministic root-cause + markersSeen fixtures.
    const fileOnlyTail = `[FileIO ] 1.2 File I/O: Failed to verify the file signature for file '.\\extensions\\mymod\\md\\mymod.xml' (error: 14)\n[General] 1.3 Loading extension mymod`;
    const markerTail = `[FileIO ] 1.2 signature for file '.\\extensions\\mymod\\ui.xml' (error: 14)\n[=ERROR=] 1.4 [MYMOD] events registered: open, poll`;
    const djfheTail = `[General] 1.0 Loading extension mymod\n[=ERROR=] 1.5 Error: loop or previous error loading module 'djfhe.http.client'`;
    const truncTail = `[General] 1.0 Loading extension mymod\n[=ERROR=] 1.6 Parse error in md/mymod.xml: Couldn't find end of Start Tag cue line 39`;

    const fileOnly = deriveLogDiagnosis(fileOnlyTail, [modId], analyzeGameLog(fileOnlyTail, [modId]).issues.filter(i => i.matchesActiveMod));
    const marker = deriveLogDiagnosis(markerTail, [modId], analyzeGameLog(markerTail, [modId]).issues.filter(i => i.matchesActiveMod));
    const djfhe = deriveLogDiagnosis(djfheTail, [modId], analyzeGameLog(djfheTail, [modId]).issues.filter(i => i.matchesActiveMod));
    const trunc = deriveLogDiagnosis(truncTail, [modId], analyzeGameLog(truncTail, [modId]).issues.filter(i => i.matchesActiveMod));

    const results = [
      { test: 'cleanLoad', pass: clean.seenByX4 && clean.loadedCleanly && !clean.runtimeErrors, detail: clean },
      { test: 'runtimeError', pass: errored.runtimeErrors && !errored.loadedCleanly, detail: errored },
      { test: 'errorSourceRefMapping', pass: errIssue?.sourceRef?.file === 'md/mymod.xml' && errIssue?.sourceRef?.line === 18, detail: errIssue?.sourceRef },
      { test: 'notSeen', pass: !notSeen.seenByX4 && !notSeen.loadedCleanly, detail: notSeen },
      // A2: files-loaded-but-no-markers → code_never_ran hypothesis; markersSeen=false.
      { test: 'diag_code_never_ran', pass: fileOnly.filesLoaded && !fileOnly.markersSeen && fileOnly.hypotheses.some(h => h.code === 'code_never_ran'), detail: fileOnly },
      // A2: a mod-authored marker line flips markersSeen and suppresses code_never_ran.
      { test: 'diag_markers_seen', pass: marker.markersSeen && !marker.hypotheses.some(h => h.code === 'code_never_ran'), detail: marker },
      { test: 'diag_djfhe_require', pass: djfhe.hypotheses.some(h => h.code === 'djfhe_require' && h.confidence === 'high'), detail: djfhe.hypotheses },
      { test: 'diag_truncated', pass: trunc.hypotheses.some(h => h.code === 'truncated_or_malformed'), detail: trunc.hypotheses }
    ];
    return res.json({ allPassed: results.every(r => r.pass), results });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'log-selftest failed' });
  }
});

app.get("/api/agent/patch-audit", (req, res) => {
  try {
    const ws = {
      xmlPatches: [
        { id: 'p_ok', targetFile: 'libraries/wares.xml', sel: '/wares', action: 'add', content: '<ware id="x"/>', includeInBuild: true },
        { id: 'p_missing', targetFile: 'libraries/does_not_exist.xml', sel: '/foo', action: 'add', content: '<x/>', includeInBuild: true },
        { id: 'p_rootmismatch', targetFile: 'libraries/wares.xml', sel: '/jobs/job', action: 'add', content: '<job/>', includeInBuild: true }
      ]
    };
    const diagnostics = runPatchDiagnostics(ws);
    const hasResolved = diagnostics.some(d => d.code === 'patch.target_resolved' && d.severity === 'info');
    const hasMissing = diagnostics.some(d => d.code === 'patch.target_unresolved' && d.severity === 'warning');
    const hasRootMismatch = diagnostics.some(d => d.code === 'patch.selector_root_mismatch' && d.severity === 'warning');
    const checks = [
      { name: 'known_target_resolves', pass: hasResolved },
      { name: 'missing_target_warns', pass: hasMissing },
      { name: 'selector_root_mismatch_warns', pass: hasRootMismatch }
    ];
    return res.json({ pass: checks.every(c => c.pass), checks, diagnostics });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'patch-audit failed' });
  }
});

app.post("/api/agent/xsd-lookup", (req, res) => {
  try {
    const index = getSchemaIndex();
    const names: string[] = Array.isArray(req.body?.elements) ? req.body.elements : [];
    const out: Record<string, any> = {};
    for (const n of names) {
      const spec = index.elements.get(String(n).toLowerCase());
      out[n] = spec
        ? {
            inIndex: true,
            resolved: spec.resolved,
            attributes: [...spec.attributes.entries()].map(([k, a]) => ({ name: k, required: a.required, enum: a.enumValues })),
            children: [...spec.children]
          }
        : { inIndex: false };
    }
    return res.json({ loaded: index.loaded, elementCount: index.elementCount, elements: out });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'xsd-lookup failed' });
  }
});

app.get("/api/agent/xsd-debug", (req, res) => {
  try {
    const index = getSchemaIndex();
    // Element lookup mode: ?el=create_ship returns that element's resolved attrs.
    if (typeof req.query.el === 'string' && req.query.el) {
      const spec = index.elements.get(req.query.el.toLowerCase());
      const resolved = resolveXsdConfig();
      let rawHit: string | null = null;
      try {
        const xsd = fs.readFileSync(resolved.mdXsdPath, 'utf8');
        const term = String(req.query.search || req.query.el);
        const i = xsd.toLowerCase().indexOf(String(term).toLowerCase());
        rawHit = i >= 0 ? xsd.slice(Math.max(0, i - 30), i + 300).replace(/\s+/g, ' ') : 'NOT_FOUND_IN_md.xsd';
      } catch (e) { rawHit = 'read_err:' + e.message; }
      return res.json({
        element: req.query.el,
        inIndex: Boolean(spec),
        resolved: spec?.resolved,
        attrNames: spec ? [...spec.attributes.keys()] : [],
        rawHit
      });
    }
    const sample = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="Test" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <cue name="Test_Cue">
      <conditions>
        <event_object_signalled bogusattr="x"/>
      </conditions>
      <actions>
        <set_value name="$x" exact="1" operation="not_a_real_enum_value"/>
        <totally_made_up_action foo="bar"/>
      </actions>
    </cue>
  </cues>
</mdscript>`;
    const diags = validateXmlAgainstSchema(sample, index, { filePath: 'md/test.xml', domain: 'mission_director', reportUnknownElements: true });
    // also surface a couple of known elements + whether they carry enum attrs
    const knownSamples: Record<string, any> = {};
    for (const name of ['set_value', 'event_object_signalled', 'attention', 'cue']) {
      const spec = index.elements.get(name);
      knownSamples[name] = spec ? {
        attrCount: spec.attributes.size,
        enumAttrs: [...spec.attributes.entries()].filter(([, a]) => a.enumValues && a.enumValues.length).map(([k, a]) => `${k}:[${(a.enumValues || []).slice(0, 4).join(',')}]`).slice(0, 5),
        requiredAttrs: [...spec.attributes.entries()].filter(([, a]) => a.required).map(([k]) => k)
      } : 'NOT_IN_INDEX';
    }
    return res.json({ loaded: index.loaded, elementCount: index.elementCount, sourceFiles: index.sourceFiles, knownSamples, sampleDiagnostics: diags });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'xsd-debug failed', stack: String(error?.stack || '').slice(0, 400) });
  }
});

app.get("/api/agent/catdat-debug", (req, res) => {
  try {
    const resolved = resolveXsdConfig();
    const roots = [resolved.x4GamePath || "", resolved.modWorkspacePath || ""].filter(Boolean);

    // Optional ?file=<relpath> — read-only probe of a single base-game file (loose or
    // packed). Used to ground deterministic parsers (e.g. #64 galaxy map) against the
    // real installed universe files instead of assumed shapes. Base-game files only,
    // path-traversal guarded, output capped.
    const fileParam = String(req.query.file || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (fileParam) {
      if (!resolved.x4GamePath) return res.status(400).json({ error: "X4 game path not set." });
      if (fileParam.includes(":") || fileParam.split("/").includes("..")) {
        return res.status(400).json({ error: "Invalid file path." });
      }
      const hit = catDatExtractBaseGameFile(resolved.x4GamePath, fileParam);
      if (!hit) return res.json({ file: fileParam, found: false });
      const MAX = 200_000;
      const text = hit.text || "";
      return res.json({
        file: fileParam, found: true, bytes: text.length,
        truncated: text.length > MAX, text: text.slice(0, MAX),
      });
    }

    const report = catDatDebugScan(roots);
    // Trim to keep payload reasonable: only show archives that have entries or errors.
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message || "catdat-debug failed" });
  }
});

// (Removed 2026-07-12, standing-hazard sweep: cleanDirectoryExceptMetadata — the old
// "wipe everything except .snapshots/.studio-mod-id" deploy refresh — had ZERO callers
// since cleanForgeManagedEntries replaced it, but a recursive-delete foot-gun sitting
// unused is exactly what a future edit re-wires by accident. Deleted, not left dormant.)

// Explicit preserve-list: newline-separated top-level names (e.g. "external_runtime") in a `.forgekeep`
// file at the deploy root. Lines starting with '#' are comments. Lets a mod co-locate non-Forge runtime.
function readForgeKeep(dirPath: string): Set<string> {
  const keep = new Set<string>();
  try {
    const kp = path.join(dirPath, '.forgekeep');
    if (fs.existsSync(kp)) {
      for (const line of fs.readFileSync(kp, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        const top = t.replace(/[\\/]+$/, '');
        if (top && !top.startsWith('#') && top !== '.' && top !== '..' && !/[\\/:]/.test(top)) keep.add(top);
      }
    }
  } catch { /* ignore */ }
  return keep;
}

function copyRegularTree(sourceRoot: string, targetRoot: string): void {
  const walk = (sourceDir: string, relativeDir: string) => {
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const source = path.join(sourceDir, entry.name);
      const target = path.join(targetRoot, ...relativePath.split('/'));
      const stat = fs.lstatSync(source);
      if (stat.isSymbolicLink()) throw new Error(`Refusing to copy symbolic link or reparse point: ${relativePath}`);
      if (stat.isDirectory()) {
        fs.mkdirSync(target, { recursive: true });
        walk(source, relativePath);
      } else if (stat.isFile()) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
      } else {
        throw new Error(`Refusing unsupported artifact entry type: ${relativePath}`);
      }
    }
  };
  fs.mkdirSync(targetRoot, { recursive: true });
  walk(sourceRoot, '');
}

interface RegularTreeEntry {
  path: string;
  type: 'file' | 'directory';
}

function inspectRegularTree(rootPath: string): RegularTreeEntry[] {
  if (!fs.existsSync(rootPath)) return [];
  const entries: RegularTreeEntry[] = [];
  const walk = (dirPath: string, relativeDir: string) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolutePath = path.join(dirPath, entry.name);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link or reparse point in deployment tree: ${relativePath}`);
      if (stat.isDirectory()) {
        entries.push({ path: relativePath, type: 'directory' });
        walk(absolutePath, relativePath);
      } else if (stat.isFile()) {
        entries.push({ path: relativePath, type: 'file' });
      } else {
        throw new Error(`Refusing unsupported deployment entry type: ${relativePath}`);
      }
    }
  };
  walk(rootPath, '');
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function regularTreeFingerprint(rootPath: string): string {
  const digest = crypto.createHash('sha256');
  for (const entry of inspectRegularTree(rootPath)) {
    digest.update(entry.type === 'directory' ? 'D\0' : 'F\0');
    digest.update(entry.path.replace(/\\/g, '/'));
    digest.update('\0');
    if (entry.type === 'file') {
      const filePath = path.join(rootPath, ...entry.path.split('/'));
      const stat = fs.statSync(filePath);
      digest.update(String(stat.size));
      digest.update('\0');
      digest.update(hashArtifactFile(filePath));
      digest.update('\0');
    }
  }
  return digest.digest('hex');
}

function synchronizeRegularTree(sourceRoot: string, targetRoot: string): void {
  const desired = inspectRegularTree(sourceRoot);
  const current = inspectRegularTree(targetRoot);
  const comparisonKey = (relativePath: string) => process.platform === 'win32' ? relativePath.toLowerCase() : relativePath;
  const desiredByPath = new Map(desired.map(entry => [comparisonKey(entry.path), entry]));

  // Remove entries that are absent from the desired tree or whose file/directory
  // type changed. Deepest-first keeps parent removal deterministic.
  const removals = current
    .filter(entry => {
      const wanted = desiredByPath.get(comparisonKey(entry.path));
      return !wanted || wanted.type !== entry.type || wanted.path !== entry.path;
    })
    .sort((a, b) => b.path.split('/').length - a.path.split('/').length || b.path.localeCompare(a.path));
  for (const entry of removals) {
    const targetPath = path.join(targetRoot, ...entry.path.split('/'));
    if (!fs.existsSync(targetPath)) continue;
    if (entry.type === 'directory') fs.rmSync(targetPath, { recursive: true, force: true });
    else fs.rmSync(targetPath, { force: true });
  }

  fs.mkdirSync(targetRoot, { recursive: true });
  for (const entry of desired.filter(entry => entry.type === 'directory').sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    fs.mkdirSync(path.join(targetRoot, ...entry.path.split('/')), { recursive: true });
  }
  for (const entry of desired.filter(entry => entry.type === 'file')) {
    const sourcePath = path.join(sourceRoot, ...entry.path.split('/'));
    const targetPath = path.join(targetRoot, ...entry.path.split('/'));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function verifyRegularTreeMirror(expectedRoot: string, actualRoot: string): void {
  const expectedFingerprint = regularTreeFingerprint(expectedRoot);
  const actualFingerprint = regularTreeFingerprint(actualRoot);
  if (expectedFingerprint !== actualFingerprint) {
    throw new Error(`Deployed tree verification failed: expected ${expectedFingerprint}, got ${actualFingerprint}`);
  }
}

function verifyExpectedFiles(targetRoot: string, expected: Array<{ path: string; size: number; sha256: string }>): void {
  for (const entry of expected) {
    const filePath = path.join(targetRoot, ...entry.path.split('/'));
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error(`Deployed artifact is missing ${entry.path}`);
    const stat = fs.statSync(filePath);
    const hash = hashArtifactFile(filePath);
    if (stat.size !== entry.size || hash !== entry.sha256) throw new Error(`Deployed artifact verification failed for ${entry.path}`);
  }
}

/**
 * B84 — preserved paths carry their ORIGIN, because the two sources are different promises:
 *
 *  - `runtime` comes from an explicit `.forgeartifact.json` runtime-owned declaration. The
 *    project asserted the build does NOT manage this path, so finding it in the built
 *    artifact is a genuine contract contradiction and must fail closed.
 *  - `forgekeep` / `forge-state` are soft "don't wipe this" hints. When such a hint names a
 *    path the build DOES manage, the built artifact wins and the override is reported.
 *    Letting the hint win instead would silently freeze deployed files against every future
 *    source edit — the same stale-content class as the B81 read/write root split.
 */
type PreservedOrigin = 'runtime' | 'forgekeep' | 'forge-state';

function preservedDeploymentEntries(
  targetPath: string,
  plan: ArtifactPlan,
  /**
   * True only for the STAGING target inside the mod workspace, which is where Forge writes its
   * own dev state (`.studio-mod-id`, `.snapshots`). The deployed game directory must stay a
   * CLEAN mod: Forge state has no business there, so if a stale copy exists it is removed as
   * stale rather than preserved. Preserving it unconditionally (as B84 first did) would turn
   * dev artifacts into permanent litter in the folder the game loads.
   */
  ownsForgeState: boolean,
): Array<{ path: string; origin: PreservedOrigin }> {
  const origins = new Map<string, PreservedOrigin>();
  const put = (relativePath: string, origin: PreservedOrigin) => {
    if (!relativePath || relativePath.split('/').includes('..')) return;
    // A hard runtime-owned declaration outranks a soft hint for the same path.
    if (origin === 'runtime' || !origins.has(relativePath)) origins.set(relativePath, origin);
  };
  for (const entry of plan.runtimeOwned) put(entry.path.replace(/\/\*\*$/, ''), 'runtime');
  const keep = readForgeKeep(targetPath);
  for (const top of keep) put(top, 'forgekeep');
  if (keep.size > 0) put('.forgekeep', 'forgekeep');
  // Forge's own dev state belongs ONLY in the workspace-side staging target. In the deployed
  // game directory it is litter, so it is left out of preservation and cleaned as stale.
  if (ownsForgeState) {
    put('.studio-mod-id', 'forge-state');
    put('.snapshots', 'forge-state');
  }
  return [...origins.entries()].map(([path, origin]) => ({ path, origin }));
}

interface DeploymentTransactionHooks {
  /** Test seam for deterministic Windows root-lock fixtures. Production uses fs.renameSync. */
  rename?: (oldPath: string, newPath: string) => void;
  /** Test seam for proving an incomplete backup never becomes a rollback source. */
  afterFallbackBackupCopy?: (backupPath: string) => void;
  /** Test seam for proving rollback after the fallback has changed target bytes. */
  afterFallbackApply?: (targetPath: string) => void;
}

function isLockedRootRenameError(error: unknown): boolean {
  const code = String((error as NodeJS.ErrnoException | undefined)?.code || '').toUpperCase();
  return code === 'EBUSY' || code === 'EPERM';
}

function replaceLockedDeploymentInPlace(
  stage: string,
  backup: string,
  targetPath: string,
  expected: Array<{ path: string; size: number; sha256: string }>,
  hooks: DeploymentTransactionHooks,
): void {
  const originalFingerprint = regularTreeFingerprint(targetPath);
  let backupVerified = false;
  let targetMutated = false;
  try {
    copyRegularTree(targetPath, backup);
    hooks.afterFallbackBackupCopy?.(backup);
    const backupFingerprint = regularTreeFingerprint(backup);
    if (backupFingerprint !== originalFingerprint) {
      throw new Error(`Locked-root backup verification failed: expected ${originalFingerprint}, got ${backupFingerprint}`);
    }
    backupVerified = true;

    targetMutated = true;
    synchronizeRegularTree(stage, targetPath);
    hooks.afterFallbackApply?.(targetPath);
    verifyExpectedFiles(targetPath, expected);
    verifyRegularTreeMirror(stage, targetPath);
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    try {
      if (backupVerified && targetMutated && fs.existsSync(backup)) {
        synchronizeRegularTree(backup, targetPath);
        const restoredFingerprint = regularTreeFingerprint(targetPath);
        if (restoredFingerprint !== originalFingerprint) {
          throw new Error(`rollback fingerprint mismatch: expected ${originalFingerprint}, got ${restoredFingerprint}`);
        }
      }
      if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
      if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
    } catch (rollbackError) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}; locked-root rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
    throw error;
  }
}

function replaceValidatedDeployment(
  artifactRoot: string,
  targetPath: string,
  expected: Array<{ path: string; size: number; sha256: string }>,
  plan: ArtifactPlan,
  hooks: DeploymentTransactionHooks = {},
  /** True only for the workspace-side staging target — see `preservedDeploymentEntries`. */
  ownsForgeState: boolean = false,
): void {
  const parent = path.dirname(targetPath);
  fs.mkdirSync(parent, { recursive: true });
  const nonce = `${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const stage = path.join(parent, `.${path.basename(targetPath)}.x4forge-next-${nonce}`);
  const backup = path.join(parent, `.${path.basename(targetPath)}.x4forge-backup-${nonce}`);
  const rename = hooks.rename || ((oldPath: string, newPath: string) => fs.renameSync(oldPath, newPath));
  lastPreservationOverrides = [];
  let movedOld = false;
  try {
    copyRegularTree(artifactRoot, stage);
    if (fs.existsSync(targetPath)) {
      for (const { path: relativePath, origin } of preservedDeploymentEntries(targetPath, plan, ownsForgeState)) {
        const source = path.join(targetPath, ...relativePath.split('/'));
        if (!fs.existsSync(source)) continue;
        const destination = path.join(stage, ...relativePath.split('/'));
        if (fs.existsSync(destination)) {
          // An explicit `.forgeartifact.json` runtime-owned declaration colliding with
          // managed content is a genuine contract contradiction — fail closed.
          if (origin === 'runtime') throw new Error(`Runtime-owned path conflicts with built artifact: ${relativePath}`);
          // A soft keep-hint yields to the build, and the override is REPORTED rather than
          // silently applied. Letting the hint win would freeze the deployed copy against
          // every future source edit.
          lastPreservationOverrides.push(relativePath);
          continue;
        }
        const stat = fs.lstatSync(source);
        if (stat.isSymbolicLink()) throw new Error(`Runtime-owned path is a symbolic link or reparse point: ${relativePath}`);
        if (stat.isDirectory()) copyRegularTree(source, destination);
        else if (stat.isFile()) {
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.copyFileSync(source, destination);
        }
      }
      try {
        rename(targetPath, backup);
        movedOld = true;
      } catch (error) {
        if (!isLockedRootRenameError(error)) throw error;
        replaceLockedDeploymentInPlace(stage, backup, targetPath, expected, hooks);
        return;
      }
    }
    rename(stage, targetPath);
    verifyExpectedFiles(targetPath, expected);
    if (movedOld) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    try { if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true }); } catch { /* best effort */ }
    if (movedOld) {
      try {
        if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });
        if (fs.existsSync(backup)) rename(backup, targetPath);
      } catch (rollbackError) {
        throw new Error(`${error instanceof Error ? error.message : String(error)}; rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
    }
    throw error;
  }
}

function compileWorkspaceToFolder(
  ws: any,
  rootPath: string,
  mode: 'candy' | 'store',
  writeSnapshots: boolean = false,
  artifactMode: 'loose' | 'catalog' = 'loose',
  transactionHooks: DeploymentTransactionHooks = {},
): string {
  ws = activeBuildWorkspace(ws);
  const targetPath = mode === 'store' ? path.join(rootPath, effectiveModId(ws)) : rootPath;
  const scratchParent = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-compile-'));
  let ephemeralSource = '';
  try {
    const stampedSource = typeof ws?.sourceStamp?.dir === 'string' ? path.resolve(ws.sourceStamp.dir) : '';
    const hasDiskSource = Boolean(stampedSource && fs.existsSync(stampedSource) && fs.statSync(stampedSource).isDirectory());
    if (!hasDiskSource && (ws.passthroughFiles || []).some((file: any) => file?.omitted)) {
      throw new Error('Cannot build a complete artifact: omitted passthrough files have no available disk source. Re-import the project from its workspace folder.');
    }
    const sourceRoot = hasDiskSource ? stampedSource : (ephemeralSource = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-generated-source-')));
    const generated = buildWorkspaceFileManifest(ws, { includePassthrough: !hasDiskSource });
    const plan = buildArtifactPlan({ sourceRoot, generatedFiles: generated.files });
    if (!plan.ok) throw new Error(`Artifact planning failed: ${plan.errors.join('; ')}`);

    const artifactRoot = path.join(scratchParent, artifactMode);
    if (artifactMode === 'catalog') {
      const packaged = materializeCatalogArtifact(plan, artifactRoot);
      if (!packaged.ok) throw new Error(`Packed artifact failed: ${packaged.errors.join('; ')}`);
      replaceValidatedDeployment(artifactRoot, targetPath, packaged.files, plan, transactionHooks, writeSnapshots);
      lastArtifactReport = {
        mode: artifactMode,
        sourceRoot,
        targetRoot: targetPath,
        includedFiles: plan.entries.length,
        includedBytes: plan.totals.includedBytes,
        generatedFiles: plan.totals.generatedFiles,
        sourceCopyFiles: plan.totals.sourceCopyFiles,
        excluded: plan.excluded,
        runtimeOwned: plan.runtimeOwned,
        outputFiles: packaged.files.length,
        catalogVolumes: packaged.catalogs.volumes.length,
        verified: true,
        nativeBinaries: plan.entries.filter(entry => isNativeBinaryPath(entry.path)).map(entry => entry.path),
        preservationOverrides: [...lastPreservationOverrides],
      };
    } else {
      const built = materializeArtifact(plan, artifactRoot);
      if (!built.ok) throw new Error(`Loose artifact failed: ${built.errors.join('; ')}`);
      const verified = verifyMaterializedArtifact(plan, artifactRoot);
      if (!verified.ok) throw new Error(`Loose artifact verification failed: ${verified.errors.join('; ')}`);
      // B84: loose deployments now go through the SAME rollback-safe replacement as catalog
      // ones. The previous `copyRegularTree` was purely ADDITIVE: it never removed anything,
      // so a file deleted from the mod stayed in the game folder forever and kept being
      // loaded by X4 — and loose deploys got none of the sibling-backup, rollback, hash
      // verification, or locked-root (B83) protection that catalog deploys already had.
      replaceValidatedDeployment(artifactRoot, targetPath, plan.entries, plan, transactionHooks, writeSnapshots);
      lastArtifactReport = {
        mode: artifactMode,
        sourceRoot,
        targetRoot: targetPath,
        includedFiles: plan.entries.length,
        includedBytes: plan.totals.includedBytes,
        generatedFiles: plan.totals.generatedFiles,
        sourceCopyFiles: plan.totals.sourceCopyFiles,
        excluded: plan.excluded,
        runtimeOwned: plan.runtimeOwned,
        outputFiles: plan.entries.length,
        catalogVolumes: 0,
        verified: true,
        nativeBinaries: plan.entries.filter(entry => isNativeBinaryPath(entry.path)).map(entry => entry.path),
        preservationOverrides: [...lastPreservationOverrides],
      };
    }

  // Snapshots & modID identification
  if (writeSnapshots) {
    // 1. Find or create the unique mod ID in the ambiguous file
    const modIdFile = path.join(targetPath, '.studio-mod-id');
    let modUniqueId = '';
    if (fs.existsSync(modIdFile)) {
      try {
        modUniqueId = fs.readFileSync(modIdFile, 'utf8').trim();
      } catch (err) {
        console.warn('Failed to read .studio-mod-id:', err);
      }
    }
    if (!modUniqueId) {
      modUniqueId = `mod_${crypto.randomBytes(8).toString('hex')}`;
      try {
        fs.writeFileSync(modIdFile, modUniqueId, 'utf8');
      } catch (err) {
        console.warn('Failed to write .studio-mod-id:', err);
      }
    }

    // 2. Write the workspace snapshot
    try {
      const snapDir = path.join(targetPath, '.snapshots');
      if (!fs.existsSync(snapDir)) {
        fs.mkdirSync(snapDir, { recursive: true });
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(
        path.join(snapDir, `snapshot_${stamp}.json`),
        JSON.stringify({ savedAt: new Date().toISOString(), name: ws.name, modId: modUniqueId, workspace: ws }, null, 2),
        'utf8'
      );
      const names = fs.readdirSync(snapDir).filter(name => name.startsWith('snapshot_') && name.endsWith('.json'));
      names.sort();
      const MAX_SNAPSHOTS = 30;
      for (let i = 0; i < names.length - MAX_SNAPSHOTS; i++) {
        fs.unlinkSync(path.join(snapDir, names[i]));
      }
    } catch (err) {
      console.warn('Snapshot write failed (non-fatal):', err);
    }
  }

  return targetPath;
  } finally {
    fs.rmSync(scratchParent, { recursive: true, force: true });
    if (ephemeralSource) fs.rmSync(ephemeralSource, { recursive: true, force: true });
  }
}

function runCompileArtifactSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const record = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-compile-selftest-'));
  const source = path.join(root, 'source');
  const deployRoot = path.join(root, 'extensions');
  const sourceWrite = (relativePath: string, content: string | Buffer) => {
    const filePath = path.join(source, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };
  try {
    sourceWrite('content.xml', '<?xml version="1.0"?><content id="artifact_integration" name="Artifact Integration" version="100"/>');
    sourceWrite('md/source.xml', '<?xml version="1.0"?><mdscript name="ArtifactIntegration"><cues/></mdscript>');
    sourceWrite('assets/over-legacy-total.bin', Buffer.alloc((7 * 1024 * 1024) + 19, 0x6d));
    sourceWrite('unknown/deep/path/file.arbitrary', Buffer.from([0x00, 0xff, 0x10, 0x20]));
    sourceWrite('unicode/船.txt', 'payload');
    sourceWrite('runtime/state.db', 'source placeholder');
    sourceWrite('.git/config', 'must not deploy');
    sourceWrite('.forgeartifact.json', JSON.stringify({ runtimeOwned: ['runtime/**'] }));

    const imported = importModFolder(source);
    const target = path.join(deployRoot, effectiveModId(imported.workspace));
    fs.mkdirSync(path.join(target, 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(target, 'runtime', 'state.db'), 'deployed mutable state');
    fs.writeFileSync(path.join(target, 'stale-loose.txt'), 'must disappear');
    fs.mkdirSync(path.join(target, '.git'), { recursive: true });
    fs.writeFileSync(path.join(target, '.git', 'config'), 'stale deploy metadata');
    fs.mkdirSync(path.join(target, 'preserved'), { recursive: true });
    fs.writeFileSync(path.join(target, 'preserved', 'state.bin'), 'forgekeep state');
    fs.writeFileSync(path.join(target, '.forgekeep'), 'preserved\n../outside\nC:\\escape\n');

    const deployed = compileWorkspaceToFolder(imported.workspace, deployRoot, 'store', false, 'catalog');
    record('compile returns expected target', deployed === target, deployed);
    record('content.xml remains loose', fs.existsSync(path.join(target, 'content.xml')));
    const deployedContentId = fs.readFileSync(path.join(target, 'content.xml'), 'utf8').match(/<content\b[^>]*\bid="([^"]+)"/i)?.[1];
    record('content.xml id matches effective deployment folder', deployedContentId === path.basename(target), `${deployedContentId} / ${path.basename(target)}`);
    record('catalog pair emitted', fs.existsSync(path.join(target, 'ext_01.cat')) && fs.existsSync(path.join(target, 'ext_01.dat')));
    record('stale loose payload removed by validated swap', !fs.existsSync(path.join(target, 'stale-loose.txt')));
    record('development metadata excluded from deploy', !fs.existsSync(path.join(target, '.git')));
    record('runtime-owned state preserved', fs.readFileSync(path.join(target, 'runtime', 'state.db'), 'utf8') === 'deployed mutable state');
    record('valid forgekeep top-level path preserved', fs.readFileSync(path.join(target, 'preserved', 'state.bin'), 'utf8') === 'forgekeep state');
    record('unsafe forgekeep paths ignored', !fs.existsSync(path.join(deployRoot, 'outside')) && !fs.existsSync(path.join(deployRoot, 'C:', 'escape')));

    const catalogEntries = parseCat(path.join(target, 'ext_01.cat'));
    const large = catalogEntries.find(entry => entry.name === 'assets/over-legacy-total.bin');
    record('large arbitrary file is inside catalog', Boolean(large && large.size === (7 * 1024 * 1024) + 19));
    if (large) {
      const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(source, 'assets', 'over-legacy-total.bin'))).digest('hex');
      const packedHash = crypto.createHash('sha256').update(readEntryBytes(path.join(target, 'ext_01.dat'), large)).digest('hex');
      record('large catalog payload is hash-identical', sourceHash === packedHash);
    }
    record('unicode and unknown paths are cataloged', catalogEntries.some(entry => entry.name === 'unicode/船.txt') && catalogEntries.some(entry => entry.name === 'unknown/deep/path/file.arbitrary'));

    // B83: simulate the Windows case where the deployed mod root is a process
    // cwd/watched directory. The root cannot move, but its files remain writable.
    const transactionArtifacts = () => fs.readdirSync(deployRoot)
      .filter(name => name.startsWith(`.${path.basename(target)}.x4forge-next-`) || name.startsWith(`.${path.basename(target)}.x4forge-backup-`));
    const lockedRename = (code: 'EBUSY' | 'EPERM', attempts: { value: number }) => (oldPath: string, newPath: string) => {
      if (path.resolve(oldPath) === path.resolve(target) && path.basename(newPath).includes('.x4forge-backup-')) {
        attempts.value++;
        throw Object.assign(new Error(`simulated locked deployed root (${code})`), { code });
      }
      fs.renameSync(oldPath, newPath);
    };
    for (const code of ['EBUSY', 'EPERM'] as const) {
      fs.writeFileSync(path.join(target, `stale-after-${code.toLowerCase()}.txt`), 'must disappear through fallback');
      const attempts = { value: 0 };
      try {
        const lockedDeploy = compileWorkspaceToFolder(imported.workspace, deployRoot, 'store', false, 'catalog', {
          rename: lockedRename(code, attempts),
        });
        record(`locked-root ${code} fallback deploys without moving target root`, lockedDeploy === target && attempts.value === 1);
        record(`locked-root ${code} fallback removes stale managed payload`, !fs.existsSync(path.join(target, `stale-after-${code.toLowerCase()}.txt`)));
        record(`locked-root ${code} fallback preserves runtime-owned state`, fs.readFileSync(path.join(target, 'runtime', 'state.db'), 'utf8') === 'deployed mutable state');
        record(`locked-root ${code} fallback leaves no transaction siblings`, transactionArtifacts().length === 0, transactionArtifacts().join(', '));
      } catch (error) {
        record(`locked-root ${code} fallback deploys without moving target root`, false, error instanceof Error ? error.message : String(error));
      }
    }

    // A failure after in-place mutation must restore the exact original tree.
    fs.writeFileSync(path.join(target, 'rollback-only.txt'), 'original bytes that stage will remove');
    const beforeRollbackFingerprint = regularTreeFingerprint(target);
    let rollbackFailureObserved = false;
    try {
      const attempts = { value: 0 };
      compileWorkspaceToFolder(imported.workspace, deployRoot, 'store', false, 'catalog', {
        rename: lockedRename('EBUSY', attempts),
        afterFallbackApply: () => { throw new Error('simulated post-apply verification failure'); },
      });
    } catch (error) {
      rollbackFailureObserved = String(error instanceof Error ? error.message : error).includes('simulated post-apply verification failure');
    }
    record('locked-root fallback propagates apply failure', rollbackFailureObserved);
    record('locked-root fallback restores exact original tree', regularTreeFingerprint(target) === beforeRollbackFingerprint);
    record('locked-root rollback leaves no transaction siblings', transactionArtifacts().length === 0, transactionArtifacts().join(', '));

    // A partial/corrupt backup is never eligible as a rollback source. The
    // untouched target must remain byte-identical while the transaction fails closed.
    const beforeBackupFailureFingerprint = regularTreeFingerprint(target);
    let incompleteBackupRejected = false;
    try {
      const attempts = { value: 0 };
      compileWorkspaceToFolder(imported.workspace, deployRoot, 'store', false, 'catalog', {
        rename: lockedRename('EBUSY', attempts),
        afterFallbackBackupCopy: backupPath => fs.rmSync(path.join(backupPath, 'content.xml'), { force: true }),
      });
    } catch (error) {
      incompleteBackupRejected = String(error instanceof Error ? error.message : error).includes('Locked-root backup verification failed');
    }
    record('incomplete locked-root backup fails closed', incompleteBackupRejected);
    record('incomplete backup never mutates target', regularTreeFingerprint(target) === beforeBackupFailureFingerprint);
    record('incomplete backup leaves no transaction siblings', transactionArtifacts().length === 0, transactionArtifacts().join(', '));

    // Only lock-shaped errors are eligible. An unrelated rename failure must
    // leave the existing deployment untouched and must not enter fallback.
    const beforeNonLockFingerprint = regularTreeFingerprint(target);
    let nonLockFailureObserved = false;
    try {
      compileWorkspaceToFolder(imported.workspace, deployRoot, 'store', false, 'catalog', {
        rename: (oldPath, newPath) => {
          if (path.resolve(oldPath) === path.resolve(target) && path.basename(newPath).includes('.x4forge-backup-')) {
            throw Object.assign(new Error('simulated access failure'), { code: 'EACCES' });
          }
          fs.renameSync(oldPath, newPath);
        },
      });
    } catch (error) {
      nonLockFailureObserved = String(error instanceof Error ? error.message : error).includes('simulated access failure');
    }
    record('non-lock rename error fails without fallback', nonLockFailureObserved);
    record('non-lock rename error leaves target unchanged', regularTreeFingerprint(target) === beforeNonLockFingerprint);
    record('non-lock rename error leaves no transaction siblings', transactionArtifacts().length === 0, transactionArtifacts().join(', '));

    // The DEPLOYED directory must stay a clean mod: Forge's own dev state (.snapshots,
    // .studio-mod-id) belongs in the workspace-side staging target only. A stale copy sitting
    // in the game folder must be cleaned as stale, never preserved into permanence.
    fs.mkdirSync(path.join(target, '.snapshots'), { recursive: true });
    fs.writeFileSync(path.join(target, '.snapshots', 'snapshot_stale.json'), '{"stale":true}');
    fs.writeFileSync(path.join(target, '.studio-mod-id'), 'mod_stale');
    try {
      compileWorkspaceToFolder(imported.workspace, deployRoot, 'store', false, 'catalog');
      record('deployed mod folder is cleaned of forge dev state',
        !fs.existsSync(path.join(target, '.snapshots')) && !fs.existsSync(path.join(target, '.studio-mod-id')),
        `snapshots=${fs.existsSync(path.join(target, '.snapshots'))} modId=${fs.existsSync(path.join(target, '.studio-mod-id'))}`);
    } catch (error) {
      record('deployed mod folder is cleaned of forge dev state', false, error instanceof Error ? error.message : String(error));
    }
    // …but a staging deploy (writeSnapshots=true) OWNS that state and must keep it.
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-staging-selftest-'));
    try {
      const stagedPath = compileWorkspaceToFolder(imported.workspace, stagingRoot, 'store', true, 'loose');
      fs.writeFileSync(path.join(stagedPath, '.snapshots', 'snapshot_keepme.json'), '{"keep":true}');
      compileWorkspaceToFolder(imported.workspace, stagingRoot, 'store', true, 'loose');
      record('staging deploy preserves its own snapshot history',
        fs.existsSync(path.join(stagedPath, '.snapshots', 'snapshot_keepme.json')));
    } catch (error) {
      record('staging deploy preserves its own snapshot history', false, error instanceof Error ? error.message : String(error));
    } finally {
      try { fs.rmSync(stagingRoot, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
    }
  } catch (error) {
    record('artifact integration selftest completed', false, error instanceof Error ? error.stack || error.message : String(error));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return { pass: checks.every(check => check.pass), checks, summary: `${checks.filter(check => check.pass).length}/${checks.length}` };
}

/**
 * POST /api/agent/deploy
 * Compiles and deploys the workspace directly into the configured X4 Extensions directory.
 */
app.post("/api/agent/deploy", (req, res) => {
  const ws = sanitizeWorkspace(req.body.workspace || activeWorkspace);
  try {
    // STALE-SOURCE GATE (P0 2026-07-09) — same protection as deploy-verify: never let an
    // out-of-date workspace overwrite a source folder that changed after it was imported.
    {
      const stamp = (ws as any)?.sourceStamp as { dir: string; hash: string; at: string } | undefined;
      let currentHash: string | null = null;
      if (stamp?.dir) {
        try { if (fs.existsSync(stamp.dir)) currentHash = hashFolderFingerprint(fingerprintModFolder(stamp.dir)); } catch { currentHash = null; }
      }
      const verdict = assessSourceSync(stamp, currentHash, req.body?.allowStaleOverwrite === true);
      if (!verdict.ok) {
        return res.status(409).json({ success: false, error: verdict.detail, stage: 'source-sync' });
      }
    }
    const resolved = resolveXsdConfig();
    const modWorkspacePath = resolved.modWorkspacePath;
    const x4GamePath = resolved.x4GamePath;
    
    if (!modWorkspacePath && !x4GamePath) {
      return res.status(400).json({
        success: false,
        error: "Neither Mod Workspace Folder nor X4 Game Installation are configured."
      });
    }
    if (modWorkspacePath && rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;

    const modId = effectiveModId(ws);

    // SAFETY GATE (2026-07-09): refuse to write malformed XML over an installed mod.
    // Passthrough imports carry their original bytes into the deploy payload, so a
    // corrupted source file (truncated mid-tag — the H1 damage class, found live in the
    // forked x4_ai_influence workspace copy) would silently clobber a WORKING deployed
    // mod. Same check the preflight chain runs; here it guards the legacy route too.
    {
      const gate = buildWorkspaceFileManifest(ws);
      const malformed: string[] = [];
      for (const [rel, content] of Object.entries(gate.files)) {
        if (!/\.xml$/i.test(rel)) continue;
        if (!checkXmlWellformed(String(content)).ok) malformed.push(rel);
      }
      if (malformed.length > 0) {
        return res.status(422).json({
          success: false,
          error: `Deploy blocked: ${malformed.length} emitted XML file(s) are malformed (likely corrupted/truncated source): ${malformed.slice(0, 5).join(', ')}. Deploying would overwrite the installed mod with broken files. Fix or re-import the source first (use Deploy + Verify for the full preflight).`,
          malformed,
        });
      }
    }

    let stagingPath = '';
    let deployedPath = '';

    // 1. Compile to Mod Workspace Path (Staging) if configured
    if (modWorkspacePath) {
      if (!fs.existsSync(modWorkspacePath)) {
        fs.mkdirSync(modWorkspacePath, { recursive: true });
      }
      const stagingRoot = path.join(modWorkspacePath, '.forge-builds', 'loose');
      stagingPath = compileWorkspaceToFolder(ws, stagingRoot, 'store', true);
    }

    // 2. Compile and deploy to Game Extensions Path if configured
    if (x4GamePath) {
      if (fs.existsSync(x4GamePath)) {
        const extensionsPath = path.join(x4GamePath, 'extensions');
        if (!fs.existsSync(extensionsPath)) {
          fs.mkdirSync(extensionsPath, { recursive: true });
        }
        deployedPath = compileWorkspaceToFolder(ws, extensionsPath, 'store', false, 'catalog');
      } else {
        console.warn(`Configured X4 Game Installation path "${x4GamePath}" does not exist.`);
      }
    }

    let message = '';
    if (stagingPath && deployedPath) {
      message = `Successfully compiled to staging workspace AND deployed to game extensions: ${deployedPath}`;
    } else if (stagingPath) {
      message = `Successfully compiled to staging workspace: ${stagingPath}`;
    } else if (deployedPath) {
      message = `Successfully deployed to game extensions: ${deployedPath}`;
    }

    lastDeployInfo = {
      modId,
      workspaceName: ws.name,
      workspaceHash: workspaceContentHash(sanitizeWorkspace(ws)),
      deployedAt: new Date().toISOString(),
      stagingPath: stagingPath || undefined,
      deployedPath: deployedPath || undefined
    };

    return res.json({
      success: true,
      message,
      deployedPath: deployedPath || stagingPath,
      lastDeploy: lastDeployInfo,
      artifact: lastArtifactReport,
      // Audit A5: this route deploys WITHOUT the 9-stage preflight checklist. It stays
      // for UI/agent compatibility (and carries the malformed-XML gate), but new flows
      // should use deploy-verify. Converge the UI, then retire this route.
      deprecated: true,
      use: "/api/agent/deploy-verify"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to compile/deploy mod."
    });
  }
});

/**
 * POST /api/agent/compile
 * Compiles a submitted workspace JSON body on-the-fly and runs the X4 Forge XML validator check.
 */
// A1 — deploy-verify: ONE orchestration over existing primitives. import-by-path (fresh
// from disk, avoids stale-workspace bugs) → compile gate (0 errors) → deploy (staging +
// extensions) → bytes confirm (deployed content.xml exists + id matches) → extension-doctor
// (auto-FAIL on duplicate-id / folder-id-mismatch). Returns a single pass/fail verdict so the
// agent/UI never skips the doctor. On-demand only (not a hot poll), so full-folder scan is fine.
app.post("/api/agent/deploy-verify", (req, res) => {
  // PREFLIGHT CHECKLIST (beta-UX bundle C, 2026-07-09): every stage reports into an
  // ordered walkaround card — pass/warn/fail per check, later stages 'skipped' on a
  // failure — so the user sees the whole preflight, not just the first red light.
  const checklist: Array<{ id: string; label: string; status: 'pass' | 'warn' | 'fail' | 'skipped'; detail: string }> = [];
  const check = (id: string, label: string, status: 'pass' | 'warn' | 'fail', detail: string) =>
    checklist.push({ id, label, status, detail });
  const STAGES: Array<[string, string]> = [
    ['config', 'Paths configured'], ['import', 'Mod source read'], ['source-sync', 'Canvas in sync with source folder'], ['wellformed', 'XML well-formed'],
    ['compile', 'Compile diagnostics'], ['preflight', 'Full validation (schema/cues/lints)'],
    ['deploy', 'Written to staging + extensions'], ['bytes', 'Deployed bytes confirmed'],
    ['doctor', 'Extension doctor'], ['drift', 'Workspace/deployed sync'],
  ];
  const failWith = (stageId: string, payload: Record<string, unknown>) => {
    let hit = false;
    for (const [id, label] of STAGES) {
      if (id === stageId) { hit = true; continue; }
      if (hit && !checklist.some(c => c.id === id)) checklist.push({ id, label, status: 'skipped', detail: 'Not reached — fix the failure above first.' });
    }
    return { ok: false, stage: stageId, checklist, ...payload };
  };
  try {
    const resolved = resolveXsdConfig();
    const x4GamePath = resolved.x4GamePath;
    const modWorkspacePath = resolved.modWorkspacePath;
    // B84: resolve the packaging format BEFORE any staging or write happens, so a bad
    // request is rejected with zero writes rather than after a partial deploy.
    const formatChoice = resolveDeployFormat(req.body?.deployFormat);
    if (!formatChoice.ok) {
      check('config', 'Paths configured', 'fail', formatChoice.error);
      return res.status(400).json(failWith('config', { error: formatChoice.error, code: 'UNKNOWN_DEPLOY_FORMAT' }));
    }
    const deployFormat = formatChoice.format;
    if (!x4GamePath) {
      check('config', 'Paths configured', 'fail', 'X4 Game Installation path not configured.');
      return res.status(400).json(failWith('config', { error: 'X4 Game Installation path not configured.' }));
    }
    if (modWorkspacePath) {
      const issue = directoryRoleIssues(resolved).find(candidate => candidate.field === 'modWorkspacePath');
      if (issue) {
        check('config', 'Paths configured', 'fail', issue.message);
        return res.status(409).json(failWith('config', { error: `Write blocked by directory safety: ${issue.message}`, code: issue.code, issue }));
      }
    }
    check('config', 'Paths configured', 'pass', `game=${x4GamePath}${modWorkspacePath ? ' · staging=' + modWorkspacePath : ''}`);

    // 1. Resolve workspace: fresh import-by-path if given, else the active workspace.
    let ws: any;
    let modSourceDir = '';
    const reqPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
    if (reqPath) {
      const r = resolveModFolder(reqPath);
      if ('error' in r) {
        check('import', 'Mod source read', 'fail', r.error);
        return res.status(r.status).json(failWith('import', { error: r.error }));
      }
      modSourceDir = r.abs;
      ws = importModFolder(r.abs).workspace;
      check('import', 'Mod source read', 'pass', `fresh from ${reqPath} (${(ws.nodes || []).length} nodes)`);
    } else if (req.body?.workspace && typeof req.body.workspace === 'object') {
      // UI convergence (audit R4): the editor panels send their CURRENT canvas workspace,
      // same contract the legacy /deploy accepted — without this, converged UI buttons
      // would silently deploy a stale server-side activeWorkspace.
      ws = sanitizeWorkspace(req.body.workspace);
      check('import', 'Mod source read', 'pass', `workspace from request "${ws.name}" (${(ws.nodes || []).length} nodes)`);
    } else {
      ws = sanitizeWorkspace(activeWorkspace);
      check('import', 'Mod source read', 'pass', `active workspace "${ws.name}"`);
    }

    // 1a. STALE-SOURCE GATE (P0 2026-07-09): refuse to overwrite a source folder that
    // changed AFTER this workspace imported it — an out-of-date canvas (restart-reset sync,
    // another session, a git restore) must never regenerate over newer truth. Content-keyed,
    // so byte-identical re-deploys never trip it. This is the gate that would have blocked
    // the SPEC-#66 data-loss click.
    const sourceStamp = (ws as any)?.sourceStamp as { dir: string; hash: string; at: string } | undefined;
    {
      let currentSourceHash: string | null = null;
      if (sourceStamp?.dir) {
        try { if (fs.existsSync(sourceStamp.dir)) currentSourceHash = hashFolderFingerprint(fingerprintModFolder(sourceStamp.dir)); } catch { currentSourceHash = null; }
      }
      const verdict = assessSourceSync(sourceStamp, currentSourceHash, req.body?.allowStaleOverwrite === true);
      if (!verdict.ok) {
        check('source-sync', 'Canvas in sync with source folder', 'fail', verdict.detail);
        return res.status(409).json(failWith('source-sync', { error: verdict.detail, sourceStamp }));
      }
      check('source-sync', 'Canvas in sync with source folder', verdict.reason === 'in_sync' ? 'pass' : 'warn', verdict.detail);
    }

    // 1b. Well-formedness gate on the SOURCE .xml files on disk. importModFolder keeps MD as
    // byte-fidelity passthrough text (it doesn't re-run the parser's well-formedness check on
    // every file), so a malformed file (mismatched/unclosed tag — which X4 rejects on load but
    // @xmldom/xmldom silently tolerates) could otherwise sail through deploy-verify. This makes
    // deploy-verify catch the exact class that previously deployed "clean" and then failed in X4.
    if (modSourceDir) {
      const xmlFiles: string[] = [];
      const walk = (dir: string) => {
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) { if (!/^(\.|node_modules$)/.test(e.name)) walk(full); }
          else if (/\.xml$/i.test(e.name)) xmlFiles.push(full);
        }
      };
      walk(modSourceDir);
      const malformed: any[] = [];
      for (const f of xmlFiles) {
        let txt = '';
        try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
        const wf = checkXmlWellformed(txt);
        if (!wf.ok) {
          malformed.push({ file: path.relative(modSourceDir, f).replace(/\\/g, '/'), errors: wf.errors.slice(0, 3) });
        }
      }
      if (malformed.length > 0) {
        check('wellformed', 'XML well-formed', 'fail', malformed.map(m => m.file).join(', '));
        return res.json(failWith('wellformed', { modId: ws?.name || reqPath, malformed }));
      }
      check('wellformed', 'XML well-formed', 'pass', `${xmlFiles.length} source XML file(s) parse cleanly`);
    }

    // 2. Compile gate — reuse the exact diagnostics the /compile route runs, but gate on the
    // EMITTED files, not the graph. A byte-fidelity import keeps MD as passthrough text (empty
    // graph), so runModDoctor's "no cue nodes" (package.readiness) false-fires even though the
    // deployed file has cues. Exclude that one code when the emitted MD actually contains cues.
    const { modId, files } = buildWorkspaceFileManifest(ws);

    // 1c. Wellformedness over the EMITTED manifest — closes the passthrough hole: a
    // byte-fidelity import carries its ORIGINAL (possibly truncated/corrupted) files
    // straight into the deploy payload, so "well-formed by construction" is only true
    // for generated XML. Found live 2026-07-09: the forked workspace copy of
    // x4_ai_influence contains truncated files an active-workspace deploy would have
    // written OVER the working in-game mod. This gate makes that impossible.
    {
      const emittedMalformed: Array<{ file: string; errors: unknown[] }> = [];
      for (const [rel, content] of Object.entries(files)) {
        if (!/\.xml$/i.test(rel)) continue;
        const wf = checkXmlWellformed(String(content));
        if (!wf.ok) emittedMalformed.push({ file: rel, errors: wf.errors.slice(0, 3) });
      }
      if (emittedMalformed.length > 0) {
        check('wellformed', 'XML well-formed', 'fail', 'EMITTED files malformed (corrupted passthrough?): ' + emittedMalformed.map(m => m.file).join(', '));
        return res.json(failWith('wellformed', { modId: ws?.name || reqPath, malformed: emittedMalformed }));
      }
      if (!checklist.some(c => c.id === 'wellformed')) {
        check('wellformed', 'XML well-formed', 'pass', `${Object.keys(files).filter(k => /\.xml$/i.test(k)).length} emitted XML file(s) parse cleanly`);
      }
    }

    const emittedMd = Object.entries(files).filter(([k]) => /^md\/.*\.xml$/i.test(k)).map(([, v]) => String(v)).join('\n');
    const hasCuesInEmitted = /<cue\b|<library\b/i.test(emittedMd);
    // Audit A3 (2026-07-09): runSchemaValidation removed from this gate — the PREFLIGHT
    // stage below runs the same XSD layer (and more) via runProjectValidation, so the
    // schema pass ran twice per deploy. Doctor + patch stay here; preflight owns schema.
    const diagnostics = [...runModDoctor(ws, files, modId), ...runPatchDiagnostics(ws)];
    const compileErrors = diagnostics.filter((d: any) => d.severity === 'error' && !(d.code === 'package.readiness' && hasCuesInEmitted));
    if (compileErrors.length > 0) {
      check('compile', 'Compile diagnostics', 'fail', compileErrors.slice(0, 3).map((d: any) => d.message).join(' | '));
      return res.json(failWith('compile', { modId, compileErrors: compileErrors.slice(0, 10) }));
    }
    check('compile', 'Compile diagnostics', 'pass', `0 errors across doctor/patch (${diagnostics.length} findings; schema runs in preflight)`);

    // 2b. PREFLIGHT — the FULL validation stack over the emitted manifest (same engine as
    // project/validate: structure, cue refs, MD↔Lua wiring, XSD md+aiscript, order-param
    // lint, scriptproperty chains, pitfall lints). Errors block; warnings surface.
    const validationFiles = new Map<string, { path: string; kind: ReturnType<typeof classifyPath>; content: string }>(
      Object.entries(files).map(([p, c]) => [p.toLowerCase(), { path: p, kind: classifyPath(p), content: String(c) }]),
    );
    let diskValidationSkipped: Array<{ path: string; reason: string }> = [];
    const validationSourceDir = sourceStamp?.dir && fs.existsSync(sourceStamp.dir) ? sourceStamp.dir : modSourceDir;
    if (validationSourceDir) {
      const diskLoad = loadProjectFromDisk(validationSourceDir, modId);
      diskValidationSkipped = diskLoad.skipped;
      for (const file of diskLoad.project.files) {
        const key = file.path.toLowerCase();
        if (!validationFiles.has(key)) validationFiles.set(key, { path: file.path, kind: file.kind, content: file.content });
      }
    }
    const manifestProject = {
      id: modId,
      name: modId,
      files: [...validationFiles.values()],
    };
    const references = (() => { try { return getReferenceSets(); } catch { return undefined; } })();
    const preflight = runProjectValidation(manifestProject as any, { references, jobsVocabulary: getJobsVocabulary(), waresVocabulary: getWaresVocabulary() });
    const pfWarnings = preflight.summary.schemaWarnings + preflight.summary.scriptPropertyWarnings + preflight.summary.mdPitfallWarnings + diskValidationSkipped.length;
    if (!preflight.ok) {
      check('preflight', 'Full validation (schema/cues/lints)', 'fail',
        `${preflight.summary.schemaErrors} schema, ${preflight.summary.unresolvedCueRefs} cue, ${preflight.summary.crossFileErrors} cross-file, ${preflight.summary.aiscriptErrors} aiscript error(s)`);
      return res.json(failWith('preflight', { modId, preflight: { summary: preflight.summary, findings: [...preflight.schema.findings, ...preflight.crossFile.findings].slice(0, 10) } }));
    }
    check('preflight', 'Full validation (schema/cues/lints)', pfWarnings > 0 ? 'warn' : 'pass',
      pfWarnings > 0
        ? `0 errors; ${pfWarnings} warning(s) — ${preflight.summary.scriptPropertyWarnings} scriptproperty, ${preflight.summary.mdPitfallWarnings} pitfall, ${preflight.summary.schemaWarnings} schema, ${diskValidationSkipped.length} disk file(s) above/unavailable to the validation loader`
        : '0 errors, 0 warnings across the full stack');

    // 3. Deploy — staging (writeSnapshots) + game extensions (clean), same as /deploy.
    let stagingPath = '';
    if (modWorkspacePath) {
      if (!fs.existsSync(modWorkspacePath)) fs.mkdirSync(modWorkspacePath, { recursive: true });
      const stagingRoot = path.join(modWorkspacePath, '.forge-builds', 'loose');
      stagingPath = compileWorkspaceToFolder(ws, stagingRoot, 'store', true);
    }
    const extensionsPath = path.join(x4GamePath, 'extensions');
    if (!fs.existsSync(extensionsPath)) fs.mkdirSync(extensionsPath, { recursive: true });
    const deployedPath = compileWorkspaceToFolder(ws, extensionsPath, 'store', false, deployFormat);
    const formatReport = describeDeployFormat(deployFormat, lastArtifactReport);

    // 4. Bytes confirm — deployed content.xml exists, non-empty, id matches modId.
    const deployedContent = path.join(deployedPath, 'content.xml');
    const deployedBytes = fs.existsSync(deployedContent) ? fs.statSync(deployedContent).size : 0;
    const deployedId = deployedBytes ? (fs.readFileSync(deployedContent, 'utf8').match(/<content\b[^>]*\bid\s*=\s*"([^"]+)"/i)?.[1] || '') : '';
    const bytesConfirmed = deployedBytes > 0 && deployedId.toLowerCase() === modId.toLowerCase();

    // 5. Extension-doctor — filter to this mod; FAIL on duplicate-id / folder-id-mismatch / any error.
    const doctor = runExtensionDoctor(extensionsPath);
    const modFindings = (doctor.findings || []).filter((f: any) => JSON.stringify(f).toLowerCase().includes(modId.toLowerCase()));
    const blocking = modFindings.filter((f: any) => f.severity === 'error' || f.code === 'ext.duplicate_id' || f.code === 'ext.folder_id_mismatch');

    // B84: the deploy row SAYS which format was written and what that means. A catalog
    // deploy that buried native binaries warns rather than passing quietly — the author
    // would otherwise only discover it as a silent runtime failure in-game.
    check('deploy', 'Written to staging + extensions', formatReport.warnings.length ? 'warn' : 'pass',
      `${deployedPath}${stagingPath ? ' (+ staging)' : ''} — ${formatReport.summary}` +
      (formatReport.warnings.length ? ` ⚠ ${formatReport.warnings.join(' ')}` : ''));
    check('bytes', 'Deployed bytes confirmed', bytesConfirmed ? 'pass' : 'fail',
      bytesConfirmed ? `content.xml ${deployedBytes}b, id "${deployedId}"` : `content.xml missing/empty or id mismatch (got "${deployedId}", want "${modId}")`);
    check('doctor', 'Extension doctor', blocking.length === 0 ? 'pass' : 'fail',
      blocking.length === 0 ? `${modFindings.length} finding(s) for this mod, none blocking` : blocking.map((f: any) => f.code).join(', '));

    // 6. Drift — after a deploy the workspace and deployed copies should agree.
    // B84: BOTH artifact modes reopen-and-hash-verify what they wrote, so either one is
    // direct sync evidence. Restricting this to 'catalog' made a verified loose deploy fall
    // through to the coarser drift heuristic and report a needless warning.
    const deployedArtifact = lastArtifactReport && path.resolve(lastArtifactReport.targetRoot) === path.resolve(deployedPath)
      ? lastArtifactReport
      : null;
    const driftReport = deployedArtifact ? null : computeModDrift(path.basename(deployedPath));
    if (deployedArtifact?.verified) {
      check('drift', 'Workspace/deployed sync', 'pass', deployedArtifact.mode === 'catalog'
        ? `verified packed artifact: ${deployedArtifact.includedFiles} source/generated files -> ${deployedArtifact.outputFiles} loose/catalog files across ${deployedArtifact.catalogVolumes} catalog volume(s)`
        : `verified loose artifact: ${deployedArtifact.includedFiles} source/generated files -> ${deployedArtifact.outputFiles} file(s) written to disk`);
    } else if (driftReport) {
      check('drift', 'Workspace/deployed sync', driftReport.verdict === 'identical' ? 'pass' : 'warn', driftReport.summary);
    } else {
      check('drift', 'Workspace/deployed sync', 'pass', 'single-copy mod (nothing to compare)');
    }

    const ok = bytesConfirmed && blocking.length === 0;
    const deployedAt = new Date().toISOString();

    // Post-deploy convergence (P0): refresh the source stamp to the post-write state (a
    // content-changing deploy legitimately changes the folder hash) and adopt this
    // workspace as active with a version bump so polling clients converge on it — the
    // canvas that just deployed can immediately deploy again without a false stale-block.
    if (ok && sourceStamp?.dir) {
      try {
        if (fs.existsSync(sourceStamp.dir)) {
          (ws as any).sourceStamp = { dir: sourceStamp.dir, hash: hashFolderFingerprint(fingerprintModFolder(sourceStamp.dir)), at: new Date().toISOString() };
          commitActiveWorkspace(ws, 'deploy-verify');
        }
      } catch { /* convergence is best-effort; the gate stays safe either way */ }
    }
    // Capture content identity after source-stamp convergence so the client compares
    // readiness against the exact workspace state adopted after deploy.
    // Failed byte/doctor gates are attempted writes, not successful deploy evidence.
    // Preserve the prior successful record instead of painting the readiness ladder green.
    if (ok) {
      lastDeployInfo = {
        modId,
        workspaceName: ws.name,
        workspaceHash: workspaceContentHash(sanitizeWorkspace(ws)),
        deployedAt,
        stagingPath: stagingPath || undefined,
        deployedPath: deployedPath || undefined,
      };
    }
    return res.json({
      ok, stage: 'done', modId, deployedPath, stagingPath, bytesConfirmed, deployedBytes,
      checklist,
      // B84: what format was written, why it was chosen, and what it means — in the payload
      // so every surface (wizard, IDE, agent) can say the same plain thing.
      deployFormat: { ...formatReport, source: formatChoice.source },
      artifact: lastArtifactReport,
      preflightWarnings: pfWarnings,
      diskValidationSkipped,
      compileErrors: [],
      doctor: {
        scanned: doctor.findings?.length || 0,
        modFindings: modFindings.map((f: any) => ({ code: f.code, severity: f.severity })),
        blocking: blocking.map((f: any) => ({ code: f.code, severity: f.severity })),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, stage: 'exception', error: error?.message || 'deploy-verify failed' });
  }
});

app.post("/api/agent/compile", (req, res) => {
  const ws = sanitizeWorkspace(req.body.workspace || activeWorkspace);
  try {
    const built = buildWorkspaceFileManifest(ws);
    const modId = built.modId;
    const files = { ...built.files };
    const overrides = req.body?.fileOverrides;
    if (overrides !== undefined) {
      if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
        return res.status(400).json({ success: false, error: "fileOverrides must be an object of project-relative paths to string contents." });
      }
      let totalBytes = 0;
      for (const [rawPath, rawContent] of Object.entries(overrides)) {
        const normalized = String(rawPath || "").replace(/\\/g, "/").replace(/^\.\//, "");
        if (!normalized || path.posix.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized) || normalized.includes("\0") || normalized.split("/").includes("..") || !/\.(xml|lua)$/i.test(normalized)) {
          return res.status(400).json({ success: false, error: `Unsafe or unsupported validation override path: ${rawPath}` });
        }
        if (typeof rawContent !== "string") {
          return res.status(400).json({ success: false, error: `Validation override content must be a string: ${rawPath}` });
        }
        totalBytes += Buffer.byteLength(rawContent, "utf8");
        if (totalBytes > 4 * 1024 * 1024) {
          return res.status(413).json({ success: false, error: "Validation overrides exceed the 4 MiB request limit." });
        }
        files[normalized] = rawContent;
      }
      if (Object.keys(files).length > 2000) {
        return res.status(413).json({ success: false, error: "Compiled project exceeds the 2,000-file validation limit." });
      }
    }
    const mdPath = `md/${modId}.xml`;
    const uiIndexPath = `ui.xml`;
    const uiLuaPath = `ui/${modId}.lua`;
    const full = runFullWorkspaceValidation(ws, { modId, files });

    return res.json({
      success: true,
      modId,
      file_count: Object.keys(files).length,
      files: {
        ...files,
        mission_director_xml: files[mdPath],
        ui_index_xml: files[uiIndexPath] || "",
        ui_lua: files[uiLuaPath] || ""
      },
      legacy_files: {
        mission_director_xml: files[mdPath],
        ui_index_xml: files[uiIndexPath] || ""
      },
      diagnostics: full.diagnostics,
      validation: {
        scope: "full-project",
        ok: full.validation.ok,
        summary: full.validation.summary,
        availability: {
          mdSchema: full.validation.schema.mdAvailable,
          aiScriptSchema: full.validation.schema.aiscriptAvailable,
          scriptProperties: full.validation.scriptProperties.available,
          references: full.validation.references.available,
        },
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to compile workspace schema to XML."
    });
  }
});

/**
 * POST /api/agent/package
 * Agent-friendly alias for compile that returns the complete package file manifest.
 */
app.post("/api/agent/package", (req, res) => {
  const ws = sanitizeWorkspace(req.body.workspace || activeWorkspace);
  try {
    const { modId, files } = buildWorkspaceFileManifest(ws);
    const full = runFullWorkspaceValidation(ws, { modId, files });

    return res.json({
      success: true,
      modId,
      file_count: Object.keys(files).length,
      files,
      diagnostics: full.diagnostics,
      validation: {
        scope: "full-project",
        ok: full.validation.ok,
        summary: full.validation.summary,
        availability: {
          mdSchema: full.validation.schema.mdAvailable,
          aiScriptSchema: full.validation.schema.aiscriptAvailable,
          scriptProperties: full.validation.scriptProperties.available,
          references: full.validation.references.available,
        },
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to package workspace schema to file manifest."
    });
  }
});

app.post("/api/agent/artifact/build", (req, res) => {
  const ws = sanitizeWorkspace(req.body?.workspace || activeWorkspace);
  const format = req.body?.format === 'loose' ? 'loose' : req.body?.format === undefined || req.body?.format === 'catalog' ? 'catalog' : null;
  if (!format) return res.status(400).json({ success: false, error: 'format must be "loose" or "catalog".' });
  try {
    const resolved = resolveXsdConfig();
    if (!resolved.modWorkspacePath) return res.status(400).json({ success: false, error: 'No Mod Workspace Folder configured.' });
    if (rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;
    const buildRoot = path.join(resolved.modWorkspacePath, '.forge-builds', format);
    const artifactPath = compileWorkspaceToFolder(ws, buildRoot, 'store', false, format);
    const built = buildWorkspaceFileManifest(ws);
    const full = runFullWorkspaceValidation(ws, built);
    return res.json({
      success: true,
      modId: built.modId,
      format,
      artifactPath,
      artifact: lastArtifactReport,
      diagnostics: full.diagnostics,
      validation: { scope: 'full-project', ok: full.validation.ok, summary: full.validation.summary },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/agent/package/release — B9 (2026-07-10): the "I shipped a mod" endpoint.
 * Compiles the workspace, runs the SAME diagnostics as /package, and — only on ZERO
 * errors — writes a Nexus-ready `<modId>/`-rooted zip (bumped content.xml version,
 * player install README inside) to `<modWorkspacePath>/releases/`.
 * Body: { workspace?, bump?: 'none'|'patch'|'minor' } (bump defaults to 'none').
 */
app.post("/api/agent/package/release", (req, res) => {
  const ws = sanitizeWorkspace(req.body?.workspace || activeWorkspace);
  const bump = ['none', 'patch', 'minor'].includes(req.body?.bump) ? req.body.bump : 'none';
  try {
    const { modId, files } = buildWorkspaceFileManifest(ws);
    const full = runFullWorkspaceValidation(ws, { modId, files });
    const diagnostics = full.diagnostics;
    const plan = buildReleasePlan({
      modId, files, diagnostics, bump,
      meta: { name: ws.name, author: ws.author, description: ws.description },
    });
    if (!plan.ok) {
      return res.status(422).json({
        success: false,
        error: `Release blocked: ${plan.blocking!.length} error diagnostic(s). The Forge never packages a red build — fix them (Doctor / quick fixes), then release.`,
        blocking: plan.blocking,
      });
    }
    const resolved = resolveXsdConfig();
    if (resolved.modWorkspacePath && rejectUnsafeDevelopmentWrite(res, resolved, ['modWorkspacePath'])) return;
    const baseDir = resolved.modWorkspacePath || process.cwd();
    const releasesDir = path.join(baseDir, "releases");
    if (!fs.existsSync(releasesDir)) fs.mkdirSync(releasesDir, { recursive: true });
    const zipBuf = buildZip(plan.entries!);
    const zipPath = path.join(releasesDir, plan.zipName!);
    fs.writeFileSync(zipPath, zipBuf);
    return res.json({
      success: true,
      modId: plan.modId,
      version: plan.version,
      zipPath,
      sizeBytes: zipBuf.length,
      fileCount: plan.entries!.length,
      warnings: plan.warnings,
      readme: plan.readme,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Failed to build release package." });
  }
});

function populateNodeMetadata(nodes: any[]): any[] {
  if (!nodes || !Array.isArray(nodes)) return [];
  return nodes.map(node => {
    // Attempt to match by xmlTag
    let template = NODE_TEMPLATES.find(t => t.xmlTag === node.xmlTag);
    if (!template) {
      template = schemaTemplatesByTag.get(node.xmlTag);
    }
    // Fallback search by type
    if (!template) {
      template = NODE_TEMPLATES.find(t => t.type === node.type);
    }
    // Deep fallback to first template
    if (!template) {
      template = NODE_TEMPLATES[0];
    }
    
    return {
      id: node.id || `node_${Math.random().toString(36).substring(2, 9)}`,
      type: node.type || template.type,
      label: node.label || template.label,
      xmlTag: node.xmlTag || template.xmlTag,
      x: typeof node.x === 'number' ? node.x : Math.floor(Math.random() * 500) + 100,
      y: typeof node.y === 'number' ? node.y : Math.floor(Math.random() * 400) + 100,
      properties: { ...template.properties, ...node.properties },
      propertiesSchema: template.propertiesSchema,
      inputs: template.inputs,
      outputs: template.outputs,
      comment: node.comment || ""
    };
  });
}

/**
 * POST /api/agent/generate
 * Prompts the built-in Gemini language model to map a natural language instruction directly
 * into a highly complex, logical ModWorkspace structured JSON value.
 */
app.post("/api/agent/generate", async (req, res) => {
  const { prompt, currentWorkspace } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' body parameter." });
  }
  const baseWorkspace = sanitizeWorkspace(currentWorkspace || activeWorkspace);

  try {
    console.log(`[AI-STUDIO] Starting Phased Cognitive Prompt Interpretation Workflow...`);
    
    // --- PHASE 1: CORE NODE BLUEPRINT INTERPRETER ---
    console.log(`[AI-STUDIO] [Phase 1/4] Interrogating Intent & Node Visual Setup...`);
    const phase1System = `You are Phase 1 of a visual workspace translator. Design or edit ONLY the workspace metadata (name, version, author, description) and the raw "nodes" array based on the user's raw prompt.
Do not worry about linkages / links or uiWidgets. 
Focus on allocating:
1. Cue nodes (type="cue", xmlTag="cue") representing mission cues.
2. Event/Condition nodes (type="event" or type="condition") representing triggers/checks. Available xmlTags: "event_cue_signalled", "event_object_destroyed", "event_object_changed_sector", "check_value", "custom_event", "custom_condition".
3. Action nodes (type="action") representing actions. Available xmlTags: "create_ship", "reward_player", "play_sound", "show_help", "create_station", "custom_xml".

Ensure each node has a unique 'id' (e.g., 'cue_0', 'event_0', 'action_0', etc.) and appropriate 'properties' matching their template.
Position nodes clearly: Cues on the left, conditions to their right, and action chains horizontally to the right.`;

    const phase1Schema = {
      type: Type.OBJECT,
      required: ["name", "version", "author", "description", "nodes"],
      properties: {
        name: { type: Type.STRING, description: "Alphanumeric mod name with underscores, e.g. Bounty_Killer_Mod" },
        version: { type: Type.STRING },
        author: { type: Type.STRING },
        description: { type: Type.STRING },
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["id", "type", "label", "xmlTag", "x", "y", "properties"],
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, description: "cue, event, condition, or action" },
              label: { type: Type.STRING },
              xmlTag: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              properties: {
                type: Type.OBJECT,
                description: "Properties for the node. E.g. for cue: {name, instantiate, namespace, state}. For event/condition/action: relevant keys according to their templates."
              },
              comment: { type: Type.STRING }
            }
          }
        }
      }
    };

    let phase1Prompt = `Prompt: "${prompt}"`;
    if (baseWorkspace) {
      const promptNodes = (baseWorkspace.nodes || []).map((node: any) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        xmlTag: node.xmlTag,
        x: node.x,
        y: node.y,
        properties: node.properties
      }));
      phase1Prompt = `You are modifying an existing ModWorkspace layout.
[Current Workspace Structure]:
- Name: "${baseWorkspace.name}"
- Version: "${baseWorkspace.version || "1.0.0"}"
- Author: "${baseWorkspace.author || ""}"
- Description: "${baseWorkspace.description || ""}"
- Current Nodes: ${JSON.stringify(promptNodes)}
- Non-MD domains to preserve unless the user explicitly asks to change them: ${JSON.stringify(summarizeWorkspaceDomains(baseWorkspace))}

Modify these nodes or add new ones to satisfy this prompt:
"${prompt}"

Maintain as many existing nodes as possible unless they require replacement.`;
    }

    const phase1RawResult = await callMultiProviderAI(req, phase1System, phase1Prompt, "json", phase1Schema);
    const phase1Result = JSON.parse(phase1RawResult.trim());
    
    // Auto-populate port signatures and property schemas from source dictionary to ensure 100% compliance
    const populatedNodes = populateNodeMetadata(phase1Result.nodes);

    // --- PHASE 2: RELATIONAL WIRE LOGIC LINKEAGES ---
    console.log(`[AI-STUDIO] [Phase 2/4] Constructing Relational Wire Linkages...`);
    const phase2System = `You are Phase 2 of a visual workspace translator. Given the populated list of visual nodes (cues, events, conditions, actions), define how they connect together.
Return ONLY the links connection list matching the specified JSON schema.

CRITICAL LINKING RULES:
1. Connect conditions/events to their cue: sourceNodeId is the cue, sourcePortId="out_cond", targetNodeId is the event/condition, targetPortId="in_cond".
2. Connect the first action of a cue: sourceNodeId is the cue, sourcePortId="out_act", targetNodeId is the first action, targetPortId="in_act".
3. Chain subsequent actions together: sourceNodeId is the previous action, sourcePortId="out_next", targetNodeId is the next action, targetPortId="in_act".
4. Connect child cues to parent cues for nested sub-cues: sourceNodeId is parent, sourcePortId="out_sub", targetNodeId is the child cue, targetPortId="in_flow".`;

    const phase2Schema = {
      type: Type.OBJECT,
      required: ["links"],
      properties: {
        links: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["id", "sourceNodeId", "sourcePortId", "targetNodeId", "targetPortId"],
            properties: {
              id: { type: Type.STRING },
              sourceNodeId: { type: Type.STRING, description: "ID of the source node" },
              sourcePortId: { type: Type.STRING, description: "out_cond, out_act, out_next, or out_sub" },
              targetNodeId: { type: Type.STRING, description: "ID of the target node" },
              targetPortId: { type: Type.STRING, description: "in_cond, in_act, or in_flow" }
            }
          }
        }
      }
    };

    const phase2Prompt = `Construct logic link arrays for this workspace layout.
[Populated Nodes Layout]:
${JSON.stringify(populatedNodes.map(n => ({ id: n.id, label: n.label, type: n.type, xmlTag: n.xmlTag, inputs: n.inputs, outputs: n.outputs })))}

[User Prompt Requirement Context]:
"${prompt}"

Please connect the nodes logically. For example, connect a Cue node's outputs ('out_cond' / 'out_act') to its associated Event or Action node inputs ('in_cond' / 'in_act').`;

    const phase2RawResult = await callMultiProviderAI(req, phase2System, phase2Prompt, "json", phase2Schema);
    const phase2Result = JSON.parse(phase2RawResult.trim());

    // --- PHASE 3: HUD USER CONTROL INTERFACES ---
    console.log(`[AI-STUDIO] [Phase 3/4] Designing Graphic Interface Control overlays...`);
    const phase3System = `You are Phase 3 of a visual workspace translator. Design or edit active web graphic HUD dashboard widgets and custom UI themes that fit the mod behavior.
Ensure that smaller UI elements (progressbar, buttons, checkboxes, input text) are styled and positioned visually inside container "window" elements (w, h heights).
Return ONLY the uiWidgets and uiTheme block fit.`;

    const phase3Schema = {
      type: Type.OBJECT,
      required: ["uiWidgets", "uiTheme"],
      properties: {
        uiWidgets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["id", "type", "x", "y", "w", "h", "label", "properties"],
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, description: "window, table, button, progressbar, check, text, dropdown, header, input, chat" },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              w: { type: Type.NUMBER },
              h: { type: Type.NUMBER },
              label: { type: Type.STRING },
              properties: { type: Type.OBJECT }
            }
          }
        },
        uiTheme: {
          type: Type.OBJECT,
          required: ["backgroundColor", "borderColor", "accentColor", "opacity", "showIcons"],
          properties: {
            backgroundColor: { type: Type.STRING },
            borderColor: { type: Type.STRING },
            accentColor: { type: Type.STRING },
            opacity: { type: Type.NUMBER },
            showIcons: { type: Type.BOOLEAN }
          }
        }
      }
    };

    const currentUIWidgets = baseWorkspace.uiWidgets || [];
    const currentUITheme = baseWorkspace.uiTheme || {
      backgroundColor: "#0d1117",
      borderColor: "#df9825",
      accentColor: "#f39c12",
      opacity: 0.85,
      showIcons: true
    };

    const phase3Prompt = `Add or adjust visual HUD display control widgets.
[User Request]:
"${prompt}"

[Nodes Created]:
${JSON.stringify(populatedNodes.map(n => ({ id: n.id, label: n.label, xmlTag: n.xmlTag })))}

[Current HUD widgets]:
${JSON.stringify(currentUIWidgets)}

Create, update, or reposition HUD window containers and nested controller elements to fit the mod. Return the compiled array.`;

    const phase3RawResult = await callMultiProviderAI(req, phase3System, phase3Prompt, "json", phase3Schema);
    const phase3Result = JSON.parse(phase3RawResult.trim());

    // --- PACK COMBINED EXPERIMENT STAGE ---
    let combinedWorkspace: ModWorkspace = {
      ...baseWorkspace,
      id: `workspace_${Date.now()}`,
      name: phase1Result.name || (baseWorkspace.name || "My_Custom_Mod"),
      version: phase1Result.version || (baseWorkspace.version || "1.0.0"),
      author: phase1Result.author || (baseWorkspace.author || "Player"),
      description: phase1Result.description || (baseWorkspace.description || ""),
      nodes: populatedNodes,
      links: phase2Result.links || [],
      uiWidgets: phase3Result.uiWidgets || [],
      uiTheme: phase3Result.uiTheme || currentUITheme
    };

    // --- PHASE 4: VALIDATION-DRIVEN REPAIR LOOP (B55P1) ---
    // The composite validator DRIVES a bounded repair loop; the model only proposes
    // candidates (src/lib/agentLoop.ts). Composite = workspace laws + the FULL project
    // stack (structure, cross-file cues, md/aiscripts schemas incl. B46P2 routed domains,
    // aiscript lint, script properties, corpus pitfalls). A clean first validation makes
    // ZERO repair calls; identical unresolved findings across 2 consecutive attempts halt
    // the loop; a spend-cap trip halts honestly with the best workspace seen.
    console.log(`[AI-STUDIO] [Phase 4/4] Validation-driven repair loop...`);
    const compositeValidate = (ws: ModWorkspace): LoopDiagnostic[] => {
      const out: LoopDiagnostic[] = validateModWorkspace(ws, generateMDXML(ws)).map(d => ({
        severity: d.severity, message: d.message, code: `workspace.${d.category}`, nodeId: d.nodeId, line: d.line,
      }));
      try {
        const { modId, files } = buildWorkspaceFileManifest(ws);
        const project: ExtensionProject = {
          id: modId, name: modId,
          files: Object.entries(files).map(([p, c]) => ({ path: p, kind: classifyPath(p), content: String(c) })),
        };
        out.push(...flattenProjectValidation(runProjectValidation(project, { references: getReferenceSets(), jobsVocabulary: getJobsVocabulary(), waresVocabulary: getWaresVocabulary() })));
      } catch { /* project layer unavailable — workspace laws still drive the loop */ }
      return out;
    };

      const phase4System = `You are Phase 4 (Self-Healing Compiler) for the X4 Foundations visual editor.
The generated workspace layout currently fails Egosoft's visual schema checks with specific warnings/errors.
Study the diagnostics report, apply corrections to the nodes, properties, and links, and return the absolute complete ModWorkspace JSON.

CRITICAL COMPLIANCE RULES:
1. Visual Event, Condition, and Action nodes must be linked correctly to their respective parent Cue node.
2. Conditions/events connect via Cue's out_cond to Condition's in_cond.
3. Actions connect sequentially starting from Cue's out_act to first Action's in_act, then Action's out_next to next Action's in_act.
4. Child cues connect via parent Cue's out_sub to child Cue's in_flow.`;

      const phase4Schema = {
        type: Type.OBJECT,
        required: ["name", "version", "author", "description", "nodes", "links", "uiWidgets", "uiTheme"],
        properties: {
          name: { type: Type.STRING },
          version: { type: Type.STRING },
          author: { type: Type.STRING },
          description: { type: Type.STRING },
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["id", "type", "label", "xmlTag", "x", "y", "properties"],
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                label: { type: Type.STRING },
                xmlTag: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                properties: {
                  type: Type.OBJECT,
                  description: "Properties for the node. E.g. for cue: {name, instantiate, namespace, state}. For event/condition/action: relevant keys according to their templates."
                },
                comment: { type: Type.STRING }
              }
            }
          },
          links: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["id", "sourceNodeId", "sourcePortId", "targetNodeId", "targetPortId"],
              properties: {
                id: { type: Type.STRING },
                sourceNodeId: { type: Type.STRING },
                sourcePortId: { type: Type.STRING },
                targetNodeId: { type: Type.STRING },
                targetPortId: { type: Type.STRING }
              }
            }
          },
          uiWidgets: { type: Type.ARRAY, items: { type: Type.OBJECT } },
          uiTheme: { type: Type.OBJECT }
        }
      };

    // B55P1: repairAttempts 1..3 (default 3). 1 reproduces the pre-B55 one-shot behavior —
    // the documented external-agent request shape is unchanged; this field is additive.
    const repairAttempts = Math.max(1, Math.min(3, Math.floor(Number(req.body.repairAttempts)) || 3));
    const repairResult = await runRepairLoop<ModWorkspace>({
      initial: combinedWorkspace,
      validate: compositeValidate,
      maxAttempts: repairAttempts,
      repair: async (ws, capsules, attempt) => {
        console.log(`[AI-STUDIO] Repair attempt ${attempt}/${repairAttempts}: ${capsules.length} open finding(s)...`);
        // Deterministic quick-fix descriptors ride along as grounded hints (B55 plan:
        // typed remediation, reuse — never rebuild — the existing mechanical fixes).
        const mechanicalFixes = listQuickFixes(ws).map(f => ({ nodeId: f.nodeId, title: f.title, detail: f.detail }));
        const phase4Prompt = `Correct this ModWorkspace structure.
[Workspace Layout]:
${JSON.stringify({
  name: ws.name,
  description: ws.description,
  nodes: ws.nodes.map(n => ({ id: n.id, xmlTag: n.xmlTag, properties: n.properties })),
  links: ws.links
})}

[Open validation findings — resolve ALL of these]:
${JSON.stringify(capsules, null, 2)}
${mechanicalFixes.length ? `
[Known mechanical fixes (deterministic hints for specific nodes)]:
${JSON.stringify(mechanicalFixes, null, 2)}
` : ''}
Apply corrections to the nodes, properties, and links to resolve every finding. Output the corrected complete structure.`;
        const phase4Raw = await callMultiProviderAI(req, phase4System, phase4Prompt, "json", phase4Schema);
        const phase4Result = JSON.parse(phase4Raw.trim());
        // Re-populate system metadata to guarantee property schemas remain undamaged
        return {
          ...ws,
          name: phase4Result.name || ws.name,
          nodes: populateNodeMetadata(phase4Result.nodes),
          links: phase4Result.links || ws.links,
          uiWidgets: phase4Result.uiWidgets || ws.uiWidgets,
          uiTheme: phase4Result.uiTheme || ws.uiTheme
        };
      },
    });
    combinedWorkspace = repairResult.workspace;
    const selfHealError: string | null = repairResult.repairError || null;
    if (repairResult.attempts === 0) {
      console.log(`[AI-STUDIO] Verification complete: pristine composite validation on first run (0 repair calls).`);
    } else {
      console.log(`[AI-STUDIO] Repair loop finished: ${repairResult.attempts} attempt(s), halt=${repairResult.haltReason}, remaining=${repairResult.remaining.length} finding(s).`);
    }

    // Approval-flow fix (Codex finding): the in-app AI guide sends apply:false
    // so the generated blueprint is STAGED — returned to the client for its
    // Confirm & Apply card — without touching the shared workspace. Previously
    // generate committed here unconditionally, so the canvas sync adopted the
    // change before the user approved (the approval step was not the first
    // mutation point). External agents keep the documented apply-by-default.
    const applyGenerated = req.body.apply !== false;
    if (applyGenerated) {
      commitActiveWorkspace(combinedWorkspace, 'ai-generate');
    }

    console.log(`[AI-STUDIO] Phased interpretation complete. Delivered blueprint named: ${combinedWorkspace.name}`);

    const finalCode = generateMDXML(combinedWorkspace);
    const finalDiagnostics = validateModWorkspace(combinedWorkspace, finalCode);
    const finalErrors = finalDiagnostics.filter(d => d.severity === 'error').length;
    const finalWarnings = finalDiagnostics.filter(d => d.severity === 'warning').length;

    // Honest reporting: the message must reflect the real post-validation state,
    // including a self-heal attempt that threw (previously swallowed silently).
    let resultMessage = `AI Agent generated${applyGenerated ? " and applied" : " (staged for approval — NOT applied)"} "${combinedWorkspace.name}" (${combinedWorkspace.nodes.length} nodes) in 4 phases.`;
    if (finalDiagnostics.length === 0) {
      resultMessage += ` Validation clean: 0 errors / 0 warnings.`;
    } else {
      resultMessage += ` Validation found ${finalErrors} error(s) / ${finalWarnings} warning(s) remaining.`;
    }
    if (repairResult.attempts > 0) {
      resultMessage += ` Repair loop: ${repairResult.attempts} attempt(s), halted ${repairResult.haltReason}.`;
    }
    if (selfHealError) {
      resultMessage += ` A repair call failed (${selfHealError}); the best-validated layout seen was kept.`;
    }

    // A4.9b — extract checkable requirements from the ORIGINAL prompt (separate
    // from generation) so the review can verify INTENT, not just legality. The
    // client runs these deterministically via checkIntent against the output.
    type RawIntentRequirement = {
      id?: unknown;
      label?: unknown;
      kind?: unknown;
      xmlTag?: unknown;
      prop?: unknown;
    };
    let intentRequirements: IntentRequirement[] = [];
    try {
      const reqSystem = `Convert an X4 mod request into a SHORT list (3-6) of checkable requirements. For each pick a verification "kind":
- "triggerWired": the cue must be triggered by an event of a given xmlTag (e.g. event_game_started, event_object_changed_sector, event_object_destroyed).
- "actionInChain": the cue must run an action of a given xmlTag (e.g. show_help, reward_player, create_ship, play_sound, create_station).
- "nodePresent": a node of a given xmlTag must exist.
- "nodePropPositive": a node of xmlTag must have a positive numeric property "prop" (e.g. reward_player money).
- "manual": subjective/unverifiable (tone, "fun", balance).
Use real X4 Mission Director xmlTags. Each requirement: {id, label (plain English), kind, xmlTag (omit for manual), prop (only nodePropPositive)}.`;
      const reqSchema = {
        type: Type.OBJECT,
        required: ["requirements"],
        properties: {
          requirements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["id", "label", "kind"],
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                kind: { type: Type.STRING, description: "triggerWired|actionInChain|nodePresent|nodePropPositive|manual" },
                xmlTag: { type: Type.STRING },
                prop: { type: Type.STRING }
              }
            }
          }
        }
      };
      const reqRaw = await callMultiProviderAI(req, reqSystem, `User request: "${prompt}"`, "json", reqSchema);
      const reqParsed = JSON.parse(reqRaw.trim());
      const reqObj = reqParsed && typeof reqParsed === "object" ? reqParsed as { requirements?: unknown } : {};
      const ALLOWED = new Set<IntentCheckSpec["kind"]>(["nodePresent", "nodePropPositive", "triggerWired", "actionInChain", "manual"]);
      intentRequirements = (Array.isArray(reqObj.requirements) ? reqObj.requirements : []).slice(0, 8).map((raw, i: number) => {
        const r = raw && typeof raw === "object" ? raw as RawIntentRequirement : {};
        const kind = ALLOWED.has(r.kind as IntentCheckSpec["kind"]) ? r.kind as IntentCheckSpec["kind"] : "manual";
        const xmlTag = String(r.xmlTag || "").trim();
        const check: IntentCheckSpec = kind === "manual" || !xmlTag
          ? { kind: "manual" }
          : kind === "nodePropPositive"
            ? { kind, xmlTag, prop: String(r.prop || "").trim() }
            : { kind, xmlTag };
        return { id: String(r.id || `req_${i}`), label: String(r.label || "Requirement"), check };
      });
    } catch (e) {
      console.warn("[AI-STUDIO] requirement extraction failed (non-fatal):", e);
    }

    return res.json({
      success: true,
      message: resultMessage,
      applied: applyGenerated,
      version: workspaceVersion,
      workspace: combinedWorkspace,
      diagnostics: finalDiagnostics,
      requirements: intentRequirements,
      selfHealFailed: (repairResult.attempts > 0 && finalDiagnostics.length > 0) || !!selfHealError,
      selfHealError,
      // B55P1: honest repair-loop reporting (additive field; request shape unchanged).
      repair: {
        attempts: repairResult.attempts,
        maxAttempts: repairAttempts,
        haltReason: repairResult.haltReason,
        remaining: repairResult.remaining.slice(0, 25),
        history: repairResult.history
      }
    });

  } catch (error) {
    console.error("AI Agent layout generation error: ", error);
    return res.status(500).json({
      error: error.message || "Failed to trigger automated workspace planner in phased execution mode."
    });
  }
});


// GitHub proxy routes (load/push/create/device-flow/commits) moved to
// src/server/githubRoutes.ts — stage-3 modularization (2026-07-08).
// (2026-07-09: comment touch to wake tsx after a child-process kill test — tsx watch
// waits for a file change after its child dies; the supervisor guards full-tree death.)
registerGithubRoutes(app);
// B18 first-run setup: game autodetect + schema harvest (config apply stays /api/schema/config).
registerGameDetectRoutes(app, { extractBaseGameFile: catDatExtractBaseGameFile });

// B25: AI usage readout — counts only, no key material, no prompts.
app.get("/api/ai/usage", (_req, res) => {
  try { return res.json(aiSpendMeter.snapshot()); }
  catch (error) { return res.status(500).json({ error: errorMessage(error) || "usage readout failed" }); }
});

// B21: MD action-frequency census — counts real action usage across the vanilla md/
// corpus (read straight from the game's cat/dat archives, DLC included) so B10's
// curation spend follows measured frequency, not judgment. Scan is seconds-heavy →
// cached per game path until the schema library reloads.
let actionCensusCache: { key: string; result: ReturnType<typeof computeActionCensus> } | null = null;
app.get("/api/agent/action-census", (req, res) => {
  try {
    const resolved = resolveXsdConfig();
    if (!resolved.x4GamePath) return res.status(400).json({ error: "No x4GamePath configured." });
    if (!schemaLibrary.loaded) return res.status(503).json({ error: "Schema library not loaded." });
    const key = `${resolved.x4GamePath}|${schemaLibrary.actions.length}`;
    if (!actionCensusCache || actionCensusCache.key !== key) {
      const { matches, archiveCount } = catDatExtractEntries(
        [resolved.x4GamePath],
        (name) => /^md\/[^/]+\.xml$/.test(name),
        { dedupeByName: true }
      );
      const actionTags = new Set(schemaLibrary.actions.map((a) => a.tag));
      const result = computeActionCensus(
        matches.map((m) => ({ name: m.name, text: m.text })),
        actionTags,
        (tag) => getElementSemantics(tag) !== null,
      );
      actionCensusCache = { key, result };
      (result as unknown as Record<string, unknown>).archiveCount = archiveCount;
    }
    const top = Math.max(0, Math.min(1000, Number(req.query.top) || 50));
    const c = actionCensusCache.result;
    return res.json({ ...c, ranked: c.ranked.slice(0, top), rankedTotal: c.ranked.length });
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) || "action-census failed" });
  }
});

// Configure Vite middleware or static serving
async function setupDevOrProd() {
  // Split-dev mode: run as an API-only server. The web UI + HMR are served by a
  // standalone Vite process (see vite.config.ts), which proxies /api here. A
  // backend restart (tsx watch) then no longer tears down the browser page.
  if (process.env.API_ONLY === "true") {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .type("text/plain")
        .end(
          "X4 Forge API server (API_ONLY). The web UI is served by Vite — open http://localhost:3000",
        );
    });
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.get("/", async (req, res, next) => {
      try {
        const template = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, injectStudioToken(template));
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // B41: index:false — otherwise static serves dist/index.html for "/" BEFORE the
    // injecting catch-all below, and the page never receives __STUDIO_API_TOKEN__
    // (every API call then 401s in a packaged/production build).
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      const html = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
      res.status(200).set({ "Content-Type": "text/html" }).end(injectStudioToken(html));
    });
  }
}


// Host-toolchain gate for local agents (HANDOFF protocol: typecheck/lint/tests run
// through here). DEV-ONLY BY DESIGN: arbitrary command execution must never ship in a
// packaged/production build (G5 security item, 2026-07-08) — under NODE_ENV=production
// the route is not registered at all unless FORGE_ALLOW_RUN_COMMAND=true is set
// explicitly. Dev workflow (restart-studio.bat / tsx watch) is unchanged.
if (process.env.NODE_ENV !== "production" || process.env.FORGE_ALLOW_RUN_COMMAND === "true") {
  app.get("/api/run_command", async (req, res) => {
    const cmd = String(req.query.cmd || "");
    try {
      const { exec } = await import("child_process");
      exec(cmd, (err, stdout, stderr) => {
        res.json({
          error: err ? err.message : null,
          stdout,
          stderr
        });
      });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // B16 (2026-07-09): ASYNC JOBS. The synchronous route above holds the HTTP response for
  // the child's entire lifetime — a long command (lint, playwright) froze every in-page
  // fetch for minutes (the all-evening 45s CDP-freeze class; 3 AAR citations). Jobs return
  // a handle immediately; poll for status + output tail. Same dev-only gating; authed like
  // every non-allowlisted route.
  interface RunJob {
    status: 'running' | 'done';
    exitCode: number | null;
    error: string | null;
    out: string;
    cmd: string;
    startedAt: string;
    endedAt?: string;
  }
  const RUN_JOBS = new Map<string, RunJob>();
  let runJobSeq = 0;

  app.post("/api/run_command/job", async (req, res) => {
    const cmd = String(req.body?.cmd || "");
    if (!cmd.trim()) return res.status(400).json({ error: "Missing 'cmd' in body." });
    try {
      const { exec } = await import("child_process");
      const id = `job_${Date.now()}_${++runJobSeq}`;
      const job: RunJob = { status: 'running', exitCode: null, error: null, out: '', cmd, startedAt: new Date().toISOString() };
      RUN_JOBS.set(id, job);
      if (RUN_JOBS.size > 20) { const oldest = RUN_JOBS.keys().next().value; if (oldest !== undefined) RUN_JOBS.delete(oldest); }
      const child = exec(cmd, { maxBuffer: 8 * 1024 * 1024 });
      const append = (chunk: unknown) => { job.out = (job.out + String(chunk)).slice(-65536); };
      child.stdout?.on('data', append);
      child.stderr?.on('data', append);
      child.on('error', (e) => { job.error = e.message; });
      child.on('exit', (code) => { job.status = 'done'; job.exitCode = code; job.endedAt = new Date().toISOString(); });
      return res.json({ jobId: id, status: job.status, startedAt: job.startedAt });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || String(e) });
    }
  });

  app.get("/api/run_command/job/:id", (req, res) => {
    const job = RUN_JOBS.get(String(req.params.id));
    if (!job) return res.status(404).json({ error: "No such job (registry keeps the newest 20)." });
    return res.json({
      status: job.status, exitCode: job.exitCode, error: job.error,
      cmd: job.cmd, startedAt: job.startedAt, endedAt: job.endedAt,
      tail: job.out.slice(-4000),
    });
  });
}

/**
 * B93.2 — tell the caller the truth about the request they made.
 *
 * Unmatched GETs previously fell through to the SPA fallback and returned the app's HTML, so a
 * caller could not distinguish "this route does not exist" from "wrong verb" — one reporter nearly
 * filed a working endpoint as missing. Mounted after every route and before the SPA fallback, so
 * real page loads are untouched: only `/api/*` is affected.
 */
function allowedMethodsForApiPath(requestPath: string): string[] {
  const methods = new Set<string>();
  try {
    const stack = (app as any)._router?.stack || [];
    for (const layer of stack) {
      if (!layer?.route || !layer.regexp?.test?.(requestPath)) continue;
      for (const [method, enabled] of Object.entries(layer.route.methods || {})) {
        if (enabled && method !== '_all') methods.add(method.toUpperCase());
      }
    }
  } catch { /* fall through to a 404 rather than crashing the request */ }
  return [...methods].sort();
}

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const allowed = allowedMethodsForApiPath(req.path);
  if (allowed.length === 0) {
    return res.status(404).json({
      error: `No endpoint at ${req.path}. This is a 404 from the API router, not the app shell — the route genuinely does not exist.`,
      code: 'UNKNOWN_ENDPOINT',
      path: req.path,
    });
  }
  if (!allowed.includes(req.method.toUpperCase())) {
    res.set('Allow', allowed.join(', '));
    return res.status(405).json({
      error: `${req.method} is not supported on ${req.path}. This route exists and accepts: ${allowed.join(', ')}.`,
      code: 'METHOD_NOT_ALLOWED',
      allow: allowed,
      path: req.path,
    });
  }
  return next();
});

initializeReferenceCorpus();
setupDevOrProd().then(() => {
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`X4 Forge Dev Server running on http://127.0.0.1:${PORT}`);
    // B93.1: publish where we are. The sidecar's port changes every launch and nothing on disk
    // said what it was, so callers were port-scanning to find us. Never fatal.
    const published = publishInstance({
      port: PORT,
      token: STUDIO_API_TOKEN,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      cwd: process.cwd(),
      mode: process.env.X4_FORGE_MODE?.trim() || (process.env.X4_DATA_DIR ? 'sidecar' : 'standalone'),
    });
    if (published) console.log(`[discovery] port + token published to ${published.latestFile}`);
    const releaseDiscovery = () => unpublishInstance(process.pid);
    process.on('exit', releaseDiscovery);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      process.on(signal, () => { releaseDiscovery(); process.exit(0); });
    }
  });
}).catch(err => {
  console.error("Server failure: ", err);
});
