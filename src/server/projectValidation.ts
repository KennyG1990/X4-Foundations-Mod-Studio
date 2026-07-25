/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Project validation CORE — stage 2 of the server modularization, and stage 1 of
 * "the validation engine is the product" (2026-07-08 design review).
 *
 * One function, `runProjectValidation(project)`, owns the full validation layering
 * (structure → cue index → cross-file → XSD md/aiscript → aiscript order-param lint →
 * scriptproperty chains), so every consumer gets the SAME verdict:
 *   - POST /api/agent/project/validate (inline payload)     — server.ts route
 *   - POST /api/agent/project/validate { fromPath }         — server reads the mod
 *     folder itself (ROADMAP tool-improvement #6: no inline payload ceiling, no
 *     sandbox-mount staleness — host-disk truth)
 *   - scripts/x4validate.ts                                 — standalone CLI (CI-able)
 *
 * `loadProjectFromDisk` turns a real mod folder (workspace or LIVE extensions dir —
 * ROADMAP #5's "can't import the live mod" gap) into an ExtensionProject envelope.
 * Path containment (`isPathWithin`) is the security boundary for fromPath.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { compareModCopies, type DriftReport, type FileFingerprint } from "../lib/modDrift";
import { resolveXsdConfig } from "../lib/xsdParser";
import { discoverSchemaRegistry, expandIncludeChain, schemaFilesSignature, type SchemaRegistry } from "../lib/schemaRegistry";
import { sniffRootElement, validateRoutedFiles, type RoutedFileResult } from "../lib/schemaRouting";
import { buildSchemaIndex, validateXmlAgainstSchema, type XsdDiagnostic } from "../lib/xsdValidate";
import { simulateXmlDiff, type DiffFinding } from "../lib/diffSimulator";
import { resolveEffectiveReferenceDocument, type OverlayFinding, type OverlaySource } from "../lib/referenceOverlay";
import {
  classifyPath,
  indexCueReferences,
  validateProjectStructure,
  type ExtensionProject,
  type ProjectFile,
} from "../lib/extensionProject";
import { validateProjectCrossFile } from "../lib/projectCrossFileValidation";
import { lintScriptPropertyChains, type ScriptPropertyFinding } from "../lib/scriptProperties";
import { lintAiscriptOrderParams, type AiscriptLintFinding } from "../lib/aiscriptLint";
import { lintMdPitfalls, type MdPitfallFinding } from "../lib/mdPitfallLints";
import { lintJobsContent, type JobsVocabulary, type JobLintFinding } from "../lib/jobsContentLint";
import { lintMigration, type MigrationFinding } from "../lib/migrationLint";
import { lintWaresContent, type WaresVocabulary, type WareLintFinding } from "../lib/waresContentLint";
import { buildModTextIndex, lintTextReferences, lintTranslationCoverage, type TextRefFinding, type TranslationCoverageFinding } from "../lib/tFileLint";
import { lintFactionRelations, type FactionLintFinding } from "../lib/factionsLint";
import { lintGodMacros, type GodLintFinding } from "../lib/godLint";
import { lintReferenceLiterals, type ReferenceLiteralFinding } from "../lib/referenceLint";
import { buildProjectSymbols, type ProjectVariableSymbol } from "../lib/projectSymbols";
import { getAiOrderParamTypes, getAiSchemaIndex, getScriptPropertyIndex } from "./validationRoutes";

/**
 * MD schema index (md.xsd + common.xsd from the configured schema dir).
 * B46P2: each root XSD is expanded through its transitive xs:include chain first —
 * the unpacked game's md/md.xsd is a zero-declaration include shim, and without the
 * expansion the whole real MD vocabulary (libraries/md.xsd) silently drops out.
 */
export function getSchemaIndex() {
  const resolved = resolveXsdConfig();
  const referenceLibraries = path.join(resolved.x4ReferenceRoot, "libraries");
  const referenceRoots = [path.join(referenceLibraries, "md.xsd"), path.join(referenceLibraries, "common.xsd")]
    .filter(p => fs.existsSync(p));
  const roots = (referenceRoots.length === 2 ? referenceRoots : [resolved.mdXsdPath, resolved.commonXsdPath])
    .filter((p): p is string => !!p);
  const expanded = Array.from(new Set(roots.flatMap(p => expandIncludeChain(p))));
  return buildSchemaIndex(expanded.length ? expanded : roots);
}

export interface ProjectValidationReferences {
  macros?: Set<string>;
  wares?: Set<string>;
  factions?: Set<string>;
  sectors?: Set<string>;
}

export interface ProjectValidationResult {
  ok: boolean;
  summary: {
    files: number;
    structuralErrors: number;
    definedCues: number;
    cueReferences: number;
    unresolvedCueRefs: number;
    crossFileErrors: number;
    mdLuaMissingRegisters: number;
    luaMdMissingListeners: number;
    schemaErrors: number;
    schemaWarnings: number;
    aiscriptErrors: number;
    scriptPropertyWarnings: number;
    mdPitfallWarnings: number;
    jobsContentWarnings: number;
    waresContentWarnings: number;
    migrationWarnings: number;
    tFileRefWarnings: number;
    tFileCoverageWarnings: number;
    factionRelationWarnings: number;
    godMacroWarnings: number;
    referenceWarnings: number;
    diffErrors: number;
    diffWarnings: number;
  };
  structure: ReturnType<typeof validateProjectStructure>;
  cueIndex: ReturnType<typeof indexCueReferences>;
  crossFile: ReturnType<typeof validateProjectCrossFile>;
  schema: {
    mdAvailable: boolean;
    aiscriptAvailable: boolean;
    findings: XsdDiagnostic[];
    /** B46P2: which non-md/aiscripts files were routed to which game schema (honest reporting) */
    routed: Array<Pick<RoutedFileResult, "path" | "route" | "domainAvailable" | "severityCapped">>;
  };
  aiscript: { findings: AiscriptLintFinding[] };
  scriptProperties: { available: boolean; findings: ScriptPropertyFinding[] };
  symbols: { available: boolean; variables: ProjectVariableSymbol[] };
  pitfalls: { findings: MdPitfallFinding[] };
  /** B61: corpus-grounded content lint for jobs.xml (the game ships no jobs XSD). available:false
   *  when no vocabulary was injected (CLI / schema-less instances) — never a claimed-but-unrun check. */
  jobsLint: { available: boolean; findings: JobLintFinding[] };
  /** B61 phase 3: corpus-grounded content lint for wares.xml. available:false when no vocabulary injected. */
  waresLint: { available: boolean; findings: WareLintFinding[] };
  /** B62c: version-migration/deprecation lint (embedded corpus-verified ruleset; always runs). */
  migration: { findings: MigrationFinding[] };
  /** B62b: t-file reference integrity (mod-owned-page dangling {page,id} refs; always runs). */
  tFileRefs: { findings: TextRefFinding[] };
  /** B62b phase 2: per-language translation coverage gaps across the mod's own t-files. */
  tFileCoverage: { findings: TranslationCoverageFinding[] };
  /** B63/A1: factions.xml relation value-bounds + unknown-target-faction findings. */
  factionRelations: { findings: FactionLintFinding[] };
  /** B63/A2: god.xml unresolved macro= references (sector/zone/station macro that doesn't exist). */
  godMacros: { findings: GodLintFinding[] };
  /** Canonical explicit-literal checks, including Lua Get*Data("literal", ...) calls. */
  references: { available: boolean; findings: ReferenceLiteralFinding[] };
  /** Read-only application of each project <diff> against base + dependency-ordered official DLCs. */
  diffSimulation: {
    files: Array<{
      path: string;
      available: boolean;
      sources: OverlaySource[];
      overlayFindings: OverlayFinding[];
      findings: DiffFinding[];
      postApplyFindings: XsdDiagnostic[];
    }>;
  };
}

/** Copy canonical sets and admit definitions owned by this project. Never mutate shared cache sets. */
function referencesForProject(project: ExtensionProject, base?: ProjectValidationReferences): ProjectValidationReferences | undefined {
  const available = !!(base?.macros?.size || base?.wares?.size || base?.factions?.size || base?.sectors?.size);
  if (!available) return undefined; // canonical corpus unavailable: do not validate against project-only partial sets
  const references: ProjectValidationReferences = {
    macros: new Set(base?.macros || []),
    wares: new Set(base?.wares || []),
    factions: new Set(base?.factions || []),
    sectors: new Set(base?.sectors || []),
  };
  for (const file of project.files) {
    if (typeof file.content !== 'string') continue;
    for (const m of file.content.matchAll(/<macro\b[^>]*\bname\s*=\s*["']([^"']+)["']/gi)) references.macros!.add(m[1].toLowerCase());
    for (const m of file.content.matchAll(/<macro\b[^>]*\bname\s*=\s*["']([^"']+)["'][^>]*\bclass\s*=\s*["']sector["']/gi)) references.sectors!.add(m[1].toLowerCase());
    for (const m of file.content.matchAll(/<ware\b[^>]*\bid\s*=\s*["']([^"']+)["']/gi)) references.wares!.add(m[1].toLowerCase());
    for (const m of file.content.matchAll(/<faction\b[^>]*\bid\s*=\s*["']([^"']+)["']/gi)) {
      const id = m[1].toLowerCase(); references.factions!.add(id); references.factions!.add(`faction.${id}`);
    }
  }
  return references;
}

/**
 * The full validation layering. Each layer degrades honestly when its data source
 * is unavailable (`available:false`) — it never claims a check it didn't run.
 */
export function runProjectValidation(
  project: ExtensionProject,
  opts: { references?: ProjectValidationReferences; jobsVocabulary?: JobsVocabulary; waresVocabulary?: WaresVocabulary } = {},
): ProjectValidationResult {
  const structure = validateProjectStructure(project);
  const cueIndex = indexCueReferences(project);
  const crossFile = validateProjectCrossFile(project);
  const references = referencesForProject(project, opts.references);
  const structuralErrors = structure.filter(i => i.severity === "error").length;

  const schemaFindings: XsdDiagnostic[] = [];
  let mdSchemaAvailable = false;
  let aiSchemaAvailable = false;
  let mdIndexRef: ReturnType<typeof getSchemaIndex> | null = null;
  let aiIndexRef: ReturnType<typeof getAiSchemaIndex> = null;
  try {
    const mdIndex = getSchemaIndex();
    mdIndexRef = mdIndex;
    mdSchemaAvailable = !!mdIndex.loaded && mdIndex.elements.size > 0;
    if (mdSchemaAvailable) {
      for (const f of project.files) {
        if ((f.kind === "md" || classifyPath(f.path) === "md") && typeof f.content === "string") {
          schemaFindings.push(...validateXmlAgainstSchema(f.content, mdIndex, {
            filePath: f.path, domain: "mission_director", reportUnknownElements: true, references, strictStructure: true,
          }));
        }
      }
    }
    aiIndexRef = getAiSchemaIndex();
    aiSchemaAvailable = !!aiIndexRef?.loaded;
    if (aiIndexRef && aiSchemaAvailable) {
      for (const f of project.files) {
        if ((f.kind === "aiscript" || classifyPath(f.path) === "aiscript") && typeof f.content === "string") {
          schemaFindings.push(...validateXmlAgainstSchema(f.content, aiIndexRef, {
            filePath: f.path, domain: "ai_scripts", reportUnknownElements: true, references, strictStructure: true,
          }));
        }
      }
    }
  } catch { /* schema layer unavailable — reported via available flags */ }

  // B46P2: route the non-md/aiscripts subset (factions/gamestarts/wares/jobs/ui/t + diff
  // patches) to their real game schemas via the phase-1 registry. Degrades to an empty
  // route list on schema-less instances — never wrong-schema noise.
  let routed: RoutedFileResult[] = [];
  let schemaRegistryRef: SchemaRegistry | null = null;
  try {
    const resolved = resolveXsdConfig();
    const referenceLibraries = path.join(resolved.x4ReferenceRoot, "libraries");
    const useReferenceSchemas = fs.existsSync(referenceLibraries);
    const registry = (useReferenceSchemas || resolved.schemaDir || resolved.x4GamePath)
      ? discoverSchemaRegistry(
          useReferenceSchemas ? referenceLibraries : resolved.schemaDir,
          useReferenceSchemas ? undefined : resolved.x4GamePath || undefined,
          useReferenceSchemas ? { signature: schemaFilesSignature(referenceLibraries) } : undefined,
        )
      : null;
    schemaRegistryRef = registry;
    routed = validateRoutedFiles(
      project.files.filter(f => typeof f.content === "string").map(f => ({ path: f.path, content: f.content as string })),
      registry,
      { references, strictStructure: useReferenceSchemas },
    );
    for (const r of routed) schemaFindings.push(...r.findings);
  } catch { /* routing degrades silently; md/aiscripts layers already reported */ }

  // Apply mod-owned <diff> files to the effective official document in memory, then
  // validate the result. This catches selectors that are syntactically valid but dead,
  // broad selectors that unexpectedly hit many nodes, and structurally illegal outcomes.
  const diffSimulation: ProjectValidationResult['diffSimulation']['files'] = [];
  try {
    const resolved = resolveXsdConfig();
    for (const file of project.files) {
      if (typeof file.content !== 'string' || sniffRootElement(file.content) !== 'diff') continue;
      const relativePath = file.path.replace(/\\/g, '/').replace(/^\.\//, '');
      const effective = resolveEffectiveReferenceDocument(resolved.x4ReferenceRoot, relativePath);
      const entry: ProjectValidationResult['diffSimulation']['files'][number] = {
        path: relativePath,
        available: effective.available,
        sources: effective.sources,
        overlayFindings: effective.findings,
        findings: [],
        postApplyFindings: [],
      };
      if (effective.available && effective.content !== undefined) {
        const simulation = simulateXmlDiff(effective.content, file.content);
        entry.findings = simulation.findings;
        if (simulation.ok) {
          const kind = file.kind || classifyPath(relativePath);
          const validateEffective = (content: string): XsdDiagnostic[] => {
            if (kind === 'md' && mdIndexRef?.loaded) {
              return validateXmlAgainstSchema(content, mdIndexRef, {
                filePath: relativePath, domain: 'mission_director', reportUnknownElements: true,
                references, strictStructure: true,
              });
            }
            if (kind === 'aiscript' && aiIndexRef?.loaded) {
              return validateXmlAgainstSchema(content, aiIndexRef, {
                filePath: relativePath, domain: 'ai_scripts', reportUnknownElements: true,
                references, strictStructure: true,
              });
            }
            if (schemaRegistryRef) {
              return validateRoutedFiles([{ path: relativePath, content }], schemaRegistryRef, {
                references, strictStructure: true,
              }).flatMap(result => result.findings);
            }
            return [];
          };
          const diagnosticKey = (finding: XsdDiagnostic) => [
            finding.severity, finding.domain, finding.code, finding.sourceRef, finding.message,
          ].join('|');
          const baseline = new Set(validateEffective(effective.content).map(diagnosticKey));
          entry.postApplyFindings = validateEffective(simulation.content)
            .filter(finding => !baseline.has(diagnosticKey(finding)));
        }
      } else {
        entry.findings.push({
          severity: 'warning', code: 'DIFF_SELECTOR_ZERO',
          message: `No canonical base document exists for ${relativePath}; selector application could not be proven.`,
        });
      }
      diffSimulation.push(entry);
    }
  } catch { /* unavailable corpus/root degrades honestly through an empty layer */ }

  // MD/AI files intentionally pass through the dedicated indexes and the general
  // registry router. Collapse identical diagnostics at this shared boundary so a
  // single schema violation is never reported twice to API/editor consumers.
  const seenSchemaFindings = new Set<string>();
  for (let index = schemaFindings.length - 1; index >= 0; index--) {
    const finding = schemaFindings[index];
    const key = [finding.severity, finding.filePath, finding.line, finding.code, finding.sourceRef, finding.message].join('|');
    if (seenSchemaFindings.has(key)) schemaFindings.splice(index, 1);
    else seenSchemaFindings.add(key);
  }

  const aiscriptLint: AiscriptLintFinding[] = [];
  try {
    const legalTypes = getAiOrderParamTypes(aiIndexRef);
    for (const f of project.files) {
      if ((f.kind === "aiscript" || classifyPath(f.path) === "aiscript") && typeof f.content === "string") {
        aiscriptLint.push(...lintAiscriptOrderParams(f.content, legalTypes));
      }
    }
  } catch { /* lint is pure; only reachable on truly malformed input */ }

  const scriptPropertyFindings: ScriptPropertyFinding[] = [];
  const spIndex = getScriptPropertyIndex();
  const projectSymbols = spIndex ? buildProjectSymbols(project.files, spIndex) : null;
  if (spIndex) {
    for (const f of project.files) {
      const k = f.kind || classifyPath(f.path);
      if ((k === "md" || k === "aiscript") && typeof f.content === "string") {
        scriptPropertyFindings.push(...lintScriptPropertyChains(f.content, spIndex, {
          filePath: f.path,
          variableTypes: projectSymbols?.variableTypesFor(f.path),
        }));
      }
    }
  }

  const referenceFindings: ReferenceLiteralFinding[] = [];
  if (references) {
    for (const f of project.files) {
      if (typeof f.content !== 'string') continue;
      const kind = f.kind || classifyPath(f.path);
      // The pure linter is quiet outside its explicit expression/attribute/API
      // shapes, so running it for every textual project file also covers generic
      // XML categories without inventing a non-existent `xml` classifier kind.
      referenceFindings.push(...lintReferenceLiterals(f.content, references, { filePath: f.path, kind }));
    }
  }

  // Corpus-grounded MD pitfall lints (dead UI listeners, offer-accept keyword refs,
  // param3 bare-key reads). Union-aware where the scriptproperty index is available.
  const pitfallFindings: MdPitfallFinding[] = [];
  for (const f of project.files) {
    if ((f.kind === "md" || classifyPath(f.path) === "md") && typeof f.content === "string") {
      pitfallFindings.push(...lintMdPitfalls(f.content, { propertyUnion: spIndex?.union, filePath: f.path }));
    }
  }

  // B63 (registry refactor): the per-basename content lints (jobs/wares/factions) share ONE loop via a
  // small table — adding a domain is a spec entry, not a copy-pasted per-file loop (the recurring
  // duplication hazard, banked 3×). Each `run` returns null to disable the lint (honest degrade when no
  // vocabulary was injected). Behavior is byte-identical to the prior three separate loops (golden-verified:
  // each sink is filled in the same file order, and flatten reads them in the same order). The game ships
  // NO XSD for jobs/wares CONTENT; factions.xsd doesn't check relation bounds / target resolution. All
  // findings are advisory WARNING and never flip `ok` (see the flatten mapping + the `ok` computation).
  const jobsLintFindings: JobLintFinding[] = [];
  const waresLintFindings: WareLintFinding[] = [];
  const factionFindings: FactionLintFinding[] = [];
  const godFindings: GodLintFinding[] = [];
  const jobsVocab = opts.jobsVocabulary;
  const waresVocab = opts.waresVocabulary;
  // B63/A2: known macro set for god.xml resolution = the reference-set macros (now including maps/ sector
  // macros after B63) UNION the mod's OWN <macro name> defs (a mod adding a new sector must not cry wolf).
  // Undefined when the reference set is empty (object index not built) → the god lint skips (honest degrade).
  const knownMacros: Set<string> | undefined = (() => {
    if (!references?.macros || references.macros.size === 0) return undefined;
    const set = new Set<string>([...references.macros].map(m => m.toLowerCase()));
    for (const f of project.files) {
      if (typeof f.content !== "string") continue;
      for (const m of f.content.matchAll(/<macro\b[^>]*\bname\s*=\s*"([^"]+)"/gi)) set.add(m[1].toLowerCase());
    }
    return set;
  })();
  const basenameLints: Array<{ basename: string; sink: unknown[]; run: (content: string) => unknown[] | null }> = [
    { basename: "jobs.xml", sink: jobsLintFindings, run: c => jobsVocab ? lintJobsContent({ jobsXml: c, vocabulary: jobsVocab }).findings : null },
    { basename: "wares.xml", sink: waresLintFindings, run: c => waresVocab ? lintWaresContent({ waresXml: c, vocabulary: waresVocab }).findings : null },
    { basename: "factions.xml", sink: factionFindings, run: c => lintFactionRelations({ factionsXml: c, knownFactions: references?.factions }).findings },
    { basename: "god.xml", sink: godFindings, run: c => knownMacros ? lintGodMacros({ godXml: c, knownMacros }).findings : null },
  ];
  for (const f of project.files) {
    if (typeof f.content !== "string") continue;
    const base = f.path.replace(/\\/g, "/").split("/").pop() || "";
    for (const spec of basenameLints) {
      if (base !== spec.basename) continue;
      const r = spec.run(f.content);
      if (r) spec.sink.push(...r);
    }
  }

  // B62b: t-file (localization) reference integrity — flags a {page,id} text reference that targets a
  // page THIS MOD defines but whose entry id is missing (a typo in the modder's own text). Uses the
  // mod's OWN t-files (no vanilla index) → cry-wolf-safe; always runs. Advisory WARNING.
  const strFiles = project.files.filter(f => typeof f.content === "string").map(f => ({ path: f.path, content: f.content as string }));
  const tFileFindings: TextRefFinding[] = lintTextReferences({ files: strFiles, index: buildModTextIndex(strFiles) }).findings;
  // B62b phase 2: translation coverage across the mod's own language files (corpus-verified 0-gap-safe).
  const tCoverageFindings: TranslationCoverageFinding[] = lintTranslationCoverage({ tFiles: strFiles }).findings;

  // (factions.xml relations lint is handled by the basename-lint registry above — B63/A1.)

  // B62c: version-migration / deprecation lint — flags constructs a game update renamed/removed
  // (grounded in Egosoft's Breaking Changes wiki, corpus-verified: 399 vanilla 9.0 scripts lint clean).
  // No injected data — the ruleset is embedded. Advisory WARNING; never flips `ok` (see below + flatten).
  const migrationFindings: MigrationFinding[] = lintMigration({
    files: project.files.filter(f => typeof f.content === "string").map(f => ({ path: f.path, content: f.content as string })),
  }).findings;

  const schemaErrors = schemaFindings.filter(d => d.severity === "error").length;
  const aiscriptErrors = aiscriptLint.filter(d => d.severity === "error").length;
  const diffErrors = diffSimulation.reduce((count, file) => count
    + file.findings.filter(finding => finding.severity === 'error').length
    + file.postApplyFindings.filter(finding => finding.severity === 'error').length, 0);
  const diffWarnings = diffSimulation.reduce((count, file) => count
    + file.findings.filter(finding => finding.severity === 'warning').length
    + file.postApplyFindings.filter(finding => finding.severity === 'warning').length, 0);
  return {
    ok: structuralErrors === 0 && cueIndex.unresolved.length === 0 && crossFile.ok
      && schemaErrors === 0 && aiscriptErrors === 0 && diffErrors === 0,
    summary: {
      files: project.files.length,
      structuralErrors,
      definedCues: cueIndex.defined.length,
      cueReferences: cueIndex.references.length,
      unresolvedCueRefs: cueIndex.unresolved.length,
      crossFileErrors: crossFile.summary.errors,
      mdLuaMissingRegisters: crossFile.summary.mdLuaMissingRegisters,
      luaMdMissingListeners: crossFile.summary.luaMdMissingListeners,
      schemaErrors,
      schemaWarnings: schemaFindings.filter(d => d.severity === "warning").length,
      aiscriptErrors,
      scriptPropertyWarnings: scriptPropertyFindings.length,
      mdPitfallWarnings: pitfallFindings.length,
      jobsContentWarnings: jobsLintFindings.length,
      waresContentWarnings: waresLintFindings.length,
      migrationWarnings: migrationFindings.length,
      tFileRefWarnings: tFileFindings.length,
      tFileCoverageWarnings: tCoverageFindings.length,
      factionRelationWarnings: factionFindings.length,
      godMacroWarnings: godFindings.length,
      referenceWarnings: referenceFindings.length,
      diffErrors,
      diffWarnings,
    },
    structure,
    cueIndex,
    crossFile,
    schema: {
      mdAvailable: mdSchemaAvailable,
      aiscriptAvailable: aiSchemaAvailable,
      findings: schemaFindings,
      routed: routed.map(({ path: p, route, domainAvailable, severityCapped }) => ({ path: p, route, domainAvailable, severityCapped })),
    },
    aiscript: { findings: aiscriptLint },
    scriptProperties: { available: !!spIndex, findings: scriptPropertyFindings },
    symbols: { available: !!projectSymbols, variables: projectSymbols?.variables || [] },
    pitfalls: { findings: pitfallFindings },
    jobsLint: { available: !!jobsVocab, findings: jobsLintFindings },
    waresLint: { available: !!waresVocab, findings: waresLintFindings },
    migration: { findings: migrationFindings },
    tFileRefs: { findings: tFileFindings },
    tFileCoverage: { findings: tCoverageFindings },
    factionRelations: { findings: factionFindings },
    godMacros: { findings: godFindings },
    references: { available: !!references, findings: referenceFindings },
    diffSimulation: { files: diffSimulation },
  };
}

/* ------------------------------------------------------------------ *
 * B55P1: flatten the layered result into one diagnostic currency for the
 * validation-driven repair loop (src/lib/agentLoop.ts). Every layer keeps
 * its native shape in the result; this is a VIEW, not a replacement.
 * ------------------------------------------------------------------ */

export interface FlatProjectDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
  filePath?: string;
  sourceRef?: string;
  line?: number;
}

export function flattenProjectValidation(result: ProjectValidationResult): FlatProjectDiagnostic[] {
  const out: FlatProjectDiagnostic[] = [];
  for (const i of result.structure) {
    out.push({ severity: i.severity, code: `project.${i.code}`, filePath: i.path, message: i.detail });
  }
  for (const r of result.cueIndex.unresolved) {
    out.push({ severity: "error", code: "project.unresolved_cue_ref", filePath: r.file, sourceRef: r.ref, message: `Cue reference "${r.ref}" resolves to nothing in this project.` });
  }
  for (const f of result.crossFile.findings) {
    out.push({ severity: f.severity, code: f.code, filePath: f.file, sourceRef: f.event || f.dependencyId, message: f.detail });
  }
  for (const d of result.schema.findings) {
    out.push({ severity: d.severity, code: d.code, filePath: d.filePath, sourceRef: d.sourceRef, line: d.line, message: d.message });
  }
  for (const f of result.aiscript.findings) {
    out.push({ severity: f.severity, code: f.code, sourceRef: f.order ? `${f.order}${f.param ? `@${f.param}` : ""}` : f.param, message: f.detail });
  }
  for (const f of result.scriptProperties.findings) {
    out.push({ severity: f.severity, code: f.code, filePath: f.filePath, sourceRef: f.chain, line: f.line, message: `Property chain "${f.chain}": segment "${f.segment}" — ${f.suggestions.length ? `did you mean ${f.suggestions.slice(0, 3).join(", ")}?` : "unknown in scriptproperties.xml."}` });
  }
  for (const f of result.pitfalls.findings) {
    out.push({ severity: f.severity, code: f.code, sourceRef: f.cue, line: f.line, message: f.detail });
  }
  // B61: jobs content lint — advisory only (WARNING never flips `ok`), one currency with every other layer.
  for (const f of result.jobsLint.findings) {
    out.push({ severity: "warning", code: `jobs.${f.kind}`, filePath: "libraries/jobs.xml", sourceRef: f.jobId, message: f.message });
  }
  // B61 phase 3: wares content lint — advisory WARNING (never flips `ok`).
  for (const f of result.waresLint.findings) {
    out.push({ severity: "warning", code: `wares.${f.kind}`, filePath: "libraries/wares.xml", sourceRef: f.wareId, message: f.message });
  }
  // B62c: version-migration/deprecation lint — advisory WARNING (never flips `ok`).
  for (const f of result.migration.findings) {
    out.push({ severity: "warning", code: `migration.${f.kind}`, filePath: f.filePath, sourceRef: `${f.version}:${f.match}`, message: f.message });
  }
  // B62b: t-file reference integrity — advisory WARNING (never flips `ok`).
  for (const f of result.tFileRefs.findings) {
    out.push({ severity: "warning", code: `tfile.${f.kind}`, filePath: f.filePath, sourceRef: `{${f.page},${f.id}}`, message: f.message });
  }
  // B62b phase 2: translation coverage — advisory WARNING.
  for (const f of result.tFileCoverage.findings) {
    out.push({ severity: "warning", code: `tfile.${f.kind}`, filePath: `t/ (language ${f.language})`, sourceRef: `page ${f.page}`, message: f.message });
  }
  // B63/A1: factions.xml relations — advisory WARNING (never flips `ok`).
  for (const f of result.factionRelations.findings) {
    out.push({ severity: "warning", code: `factions.${f.kind}`, filePath: "libraries/factions.xml", sourceRef: `${f.faction}→${f.target}`, message: f.message });
  }
  // B63/A2: god.xml unresolved macros — advisory WARNING (never flips `ok`).
  for (const f of result.godMacros.findings) {
    out.push({ severity: "warning", code: `god.${f.kind}`, filePath: "libraries/god.xml", sourceRef: `${f.station}:${f.macro}`, message: f.message });
  }
  for (const f of result.references.findings) {
    out.push({ severity: f.severity, code: f.code, filePath: f.filePath, sourceRef: f.id, line: f.line, message: f.message });
  }
  for (const file of result.diffSimulation.files) {
    for (const finding of file.findings) {
      out.push({ severity: finding.severity, code: finding.code, filePath: file.path, sourceRef: finding.selector, line: finding.line, message: finding.message });
    }
    for (const finding of file.postApplyFindings) {
      out.push({ severity: finding.severity, code: `post-apply.${finding.code}`, filePath: file.path, sourceRef: finding.sourceRef, line: finding.line, message: `Post-apply: ${finding.message}` });
    }
  }
  // De-dupe identical findings that reach the flat view via two layers (the cross-file
  // validator re-reports structure issues under its own code — same message, same file).
  const seen = new Set<string>();
  return out.filter(f => {
    const key = `${f.severity}|${f.filePath || ""}|${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Disk loading (fromPath / CLI).
 * ------------------------------------------------------------------ */

// B46P2: ui/**/*.xml added — ui addon documents now route to addon/coreaddon.xsd.
const LOADABLE_RE = /^(content\.xml|md\/[^/]+\.xml|aiscripts\/[^/]+\.xml|t\/[^/]+\.xml|libraries\/[^/]+\.xml|ui\/.+\.xml|(?:ui|lua|subst_lua)\/.+\.lua|[^/]+\.lua)$/i;
const MAX_FILES = 500;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const LOAD_SKIP_DIRS = new Set(['.git', '.hg', '.svn', '.claude', '.kilo', '.forge', '.snapshots', 'node_modules', '__pycache__']);

export interface DiskProjectLoad {
  project: ExtensionProject;
  root: string;
  loaded: string[];
  skipped: { path: string; reason: string }[];
}

/** Build an ExtensionProject from a real mod folder (workspace or live extensions dir). */
export function loadProjectFromDisk(rootDir: string, id?: string): DiskProjectLoad {
  const root = path.resolve(rootDir);
  const loaded: string[] = [];
  const skipped: { path: string; reason: string }[] = [];
  const files: ProjectFile[] = [];

  const walk = (dir: string) => {
    if (files.length >= MAX_FILES) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (files.length >= MAX_FILES) return;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (LOAD_SKIP_DIRS.has(e.name.toLowerCase())) continue;
        walk(abs);
        continue;
      }
      if (!e.isFile()) continue;
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      if (!LOADABLE_RE.test(rel)) continue;
      let statSize = 0;
      try { statSize = fs.statSync(abs).size; } catch { continue; }
      if (statSize > MAX_FILE_BYTES) { skipped.push({ path: rel, reason: `file exceeds ${MAX_FILE_BYTES} bytes` }); continue; }
      try {
        const content = fs.readFileSync(abs, "utf8");
        files.push({ path: rel, kind: classifyPath(rel), content });
        loaded.push(rel);
      } catch (err) {
        skipped.push({ path: rel, reason: String(err instanceof Error ? err.message : err) });
      }
    }
  };
  walk(root);

  const projectId = id || path.basename(root);
  return { project: { id: projectId, name: projectId, files }, root, loaded, skipped };
}

// NOTE: fromPath → folder resolution reuses server.ts's existing `resolveModFolder`
// (modWorkspacePath + filesystemPath roots, containment-guarded) — no duplicate here.

/* ------------------------------------------------------------------ *
 * Drift detection (workspace copy vs deployed copy) — first-class state.
 * ------------------------------------------------------------------ */

const DRIFT_SKIP_DIRS = new Set([".git", ".snapshots", "node_modules", "__pycache__", ".forgekeep"]);
const DRIFT_MAX_FILES = 800;
const DRIFT_MAX_FILE_BYTES = 8 * 1024 * 1024;

/** sha1-fingerprint every regular file in a mod folder (bounded; skips VCS/cache dirs). */
export function fingerprintModFolder(rootDir: string): FileFingerprint[] {
  const root = path.resolve(rootDir);
  const out: FileFingerprint[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || out.length >= DRIFT_MAX_FILES) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= DRIFT_MAX_FILES) return;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!DRIFT_SKIP_DIRS.has(e.name.toLowerCase())) walk(abs, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      try {
        const stat = fs.statSync(abs);
        if (stat.size > DRIFT_MAX_FILE_BYTES) continue;
        const hash = crypto.createHash("sha1").update(fs.readFileSync(abs)).digest("hex");
        out.push({ path: path.relative(root, abs).replace(/\\/g, "/"), hash, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch { /* unreadable file — skip */ }
    }
  };
  walk(root, 0);
  return out;
}

/**
 * Compare the workspace and deployed copies of a mod folder. Returns null when the mod
 * doesn't exist in BOTH roots (nothing to compare — that's not drift, that's absence).
 */
export function computeModDrift(modFolderName: string): DriftReport | null {
  const name = String(modFolderName || "").trim();
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  const resolved = resolveXsdConfig();
  const wsRoot = resolved.modWorkspacePath;
  const depRoot = resolved.filesystemPath;
  if (!wsRoot || !depRoot || path.resolve(wsRoot) === path.resolve(depRoot)) return null;
  const isDir = (p: string) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  const a = path.join(wsRoot, name);
  const b = path.join(depRoot, name);
  if (!isDir(a) || !isDir(b)) return null;
  return compareModCopies(fingerprintModFolder(a), fingerprintModFolder(b), "workspace", "deployed");
}
