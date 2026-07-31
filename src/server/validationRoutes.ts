/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Validation-layer services + routes, extracted from server.ts (stage 1 of the
 * server modularization). Pattern for future extractions: a module under
 * src/server/ owns its services (caches included) and exposes
 * `register<Area>Routes(app)`; server.ts imports and calls it, keeping the
 * monolith a thin composition root. Routes registered here must still be added
 * to server.ts's PUBLIC_READONLY_GETS when they are public selftests.
 *
 * Owns: the aiscripts.xsd schema index (with cat/dat harvest fallback), the
 * scriptproperties.xml index, the schema-derived order-param type set, and the
 * three read-only GET endpoints for this subsystem.
 */

import fs from "fs";
import path from "path";
import type { Express, Request, Response } from "express";
import { resolveXsdConfig } from "../lib/xsdParser";
import { dataPath } from "../lib/dataDir";
import { buildSchemaIndex, type SchemaIndex } from "../lib/xsdValidate";
import { expandIncludeChain } from "../lib/schemaRegistry";
import { extractBaseGameFile as catDatExtractBaseGameFile } from "../lib/x4CatDat";
import { buildScriptPropertyIndex, runScriptPropertiesSelftest, type ScriptPropertyIndex } from "../lib/scriptProperties";
import { ORDER_PARAM_TYPES, runAiscriptLintSelftest } from "../lib/aiscriptLint";
import { runMdPitfallSelftest } from "../lib/mdPitfallLints";
import { getReferenceCorpus } from "../lib/referenceCorpus";
import { getReferenceScriptPropertyIndex } from "../lib/referenceLanguage";
import { atomicWriteFile } from "../lib/workspaceState";

function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// AI scripts use a different schema (aiscripts.xsd). Validate against it only
// when available; never fall back to md.xsd, which would produce false positives
// on AI-specific elements/attributes. If the configured schema dir doesn't have
// it, HARVEST it from the game data (libraries/aiscripts.xsd, loose or packed) —
// closes ROADMAP AAR item #1 ("no AISCRIPT validation path") without manual setup.
export function getAiSchemaIndex(): SchemaIndex | null {
  const resolved = resolveXsdConfig();
  const referenceAi = path.join(resolved.x4ReferenceRoot, "libraries", "aiscripts.xsd");
  const referenceCommon = path.join(resolved.x4ReferenceRoot, "libraries", "common.xsd");
  if (fs.existsSync(referenceAi) && fs.existsSync(referenceCommon)) {
    return buildSchemaIndex(Array.from(new Set([referenceAi, referenceCommon].flatMap(p => expandIncludeChain(p)))));
  }
  // B51: prefer the DISCOVERED aiscripts.xsd (subdir-aware — the game keeps it in aiscripts/ or
  // libraries/, not at the top level), falling back to a top-level file, then the cat/dat harvest.
  const aiXsd = resolved.aiscriptsXsdPath || path.join(resolved.schemaDir || "", "aiscripts.xsd");
  // B46P2: expand include chains — the unpacked game's aiscripts/aiscripts.xsd is a
  // zero-declaration shim including ../libraries/aiscripts.xsd (101 declarations).
  if (aiXsd && fs.existsSync(aiXsd)) {
    const roots = [aiXsd, resolved.commonXsdPath].filter((p): p is string => !!p);
    return buildSchemaIndex(Array.from(new Set(roots.flatMap(p => expandIncludeChain(p)))));
  }
  try {
    if (!resolved.x4GamePath) return null;
    const cacheDir = dataPath("harvested-schemas"); // B53
    const cachedXsd = path.join(cacheDir, "aiscripts.xsd");
    if (!fs.existsSync(cachedXsd)) {
      const hit = catDatExtractBaseGameFile(resolved.x4GamePath, "libraries/aiscripts.xsd");
      if (!hit || !hit.text) return null;
      atomicWriteFile(cachedXsd, hit.text);
    }
    return buildSchemaIndex([cachedXsd, resolved.commonXsdPath].filter(Boolean));
  } catch {
    return null;
  }
}

// The schema's enum for order-param types, when the aiscripts schema index is
// available — schema-grade beats the lint's curated fallback set.
export function getAiOrderParamTypes(aiIndex: SchemaIndex | null): Set<string> {
  const enumValues = aiIndex?.elements.get("param")?.attributes.get("type")?.enumValues;
  return enumValues && enumValues.length ? new Set(enumValues.map(v => v.toLowerCase())) : ORDER_PARAM_TYPES;
}

// Scriptproperty index (ROADMAP TOOL GAP, 2026-06-27): parsed from the game's
// libraries/scriptproperties.xml (loose or packed). Cached in-memory per game path.
let scriptPropertyCache: { key: string; index: ScriptPropertyIndex } | null = null;
export function getScriptPropertyIndex(): ScriptPropertyIndex | null {
  try {
    const resolved = resolveXsdConfig();
    if (resolved.x4ReferenceExists) {
      const corpus = getReferenceCorpus(resolved.x4ReferenceRoot);
      const key = `reference:${corpus.root}:${corpus.signature}`;
      if (scriptPropertyCache?.key === key) return scriptPropertyCache.index;
      const index = getReferenceScriptPropertyIndex(corpus);
      if (index.loaded) {
        scriptPropertyCache = { key, index };
        return index;
      }
    }
    if (!resolved.x4GamePath) return null;
    const key = resolved.x4GamePath;
    if (scriptPropertyCache && scriptPropertyCache.key === key) return scriptPropertyCache.index;
    const hit = catDatExtractBaseGameFile(resolved.x4GamePath, "libraries/scriptproperties.xml");
    if (!hit || !hit.text) return null;
    const index = buildScriptPropertyIndex(hit.text);
    if (!index.loaded) return null;
    scriptPropertyCache = { key, index };
    return index;
  } catch {
    return null;
  }
}

/** Public read-only GETs owned by this module (each is in PUBLIC_READONLY_GETS). */
export function registerValidationAgentRoutes(app: Express): void {
  app.get("/api/agent/scriptproperties-selftest", (_req: Request, res: Response) => {
    try {
      return res.json(runScriptPropertiesSelftest());
    } catch (error) {
      return res.status(500).json({ pass: false, error: errText(error) || "scriptproperties-selftest failed" });
    }
  });

  app.get("/api/agent/md-pitfall-selftest", (_req: Request, res: Response) => {
    try {
      return res.json(runMdPitfallSelftest());
    } catch (error) {
      return res.status(500).json({ pass: false, error: errText(error) || "md-pitfall-selftest failed" });
    }
  });

  app.get("/api/agent/aiscript-lint-selftest", (_req: Request, res: Response) => {
    try {
      return res.json(runAiscriptLintSelftest());
    } catch (error) {
      return res.status(500).json({ pass: false, error: errText(error) || "aiscript-lint-selftest failed" });
    }
  });

  // Real-data probe: status of the scriptproperty index + aiscripts schema harvest —
  // lets an agent confirm the offline-catch layers are actually armed on this install.
  app.get("/api/agent/scriptproperties-status", (_req: Request, res: Response) => {
    try {
      const sp = getScriptPropertyIndex();
      const ai = getAiSchemaIndex();
      return res.json({
        scriptProperties: sp
          ? { available: true, keywords: sp.model.keywords.size, datatypes: sp.model.datatypes.size, properties: sp.model.parsedProperties, unionHeads: sp.union.size }
          : { available: false },
        aiscriptSchema: ai ? { available: true, elements: ai.elementCount, sources: ai.sourceFiles } : { available: false },
      });
    } catch (error) {
      return res.status(500).json({ error: errText(error) || "scriptproperties-status failed" });
    }
  });
}
