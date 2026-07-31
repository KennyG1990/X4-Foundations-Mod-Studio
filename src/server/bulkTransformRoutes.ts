/** Authenticated preview/apply routes for bounded canonical bulk XML transforms. */

import type { Express, Request, Response } from 'express';
import { resolveXsdConfig } from '../lib/xsdParser';
import { listReferenceManifestFiles } from '../lib/referenceManifest';
import { resolveEffectiveReferenceDocument } from '../lib/referenceOverlay';
import {
  createBulkTransformPlan,
  logicalReferencePath,
  mergeBulkTransformPatches,
  type BulkTransformOperationRule,
  type BulkTransformRule,
} from '../lib/bulkCorpusTransform';
import type { ModWorkspace, PatchBlock } from '../types';

type MutationResult = { status: number; body: any };

interface BulkTransformRouteOptions {
  workspace: (req: Request) => ModWorkspace;
  workspaceId: (req: Request) => string;
  workspaceHash: (req: Request) => string;
  applyWorkspaceMutation: (req: Request, incoming: any, options: { expectedHead?: string; merge?: boolean }) => MutationResult;
}

const MAX_MANIFEST_ROWS = 50_000;

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function parseRule(body: any): BulkTransformRule {
  if (!body?.rule || typeof body.rule !== 'object') throw new Error('Missing required rule object.');
  const parseOperand = (value: any) => Array.isArray(value)
    ? [Number(value[0]), Number(value[1])] as [number, number]
    : Number(value);
  const operations: BulkTransformOperationRule[] | undefined = Array.isArray(body.rule.operations)
    ? body.rule.operations.map((operation: any, index: number) => ({
        id: String(operation?.id || `operation-${index + 1}`),
        selector: String(operation?.selector || ''),
        operation: operation?.operation,
        operand: parseOperand(operation?.operand),
        rounding: operation?.rounding,
        roundingIncrement: operation?.roundingIncrement === undefined ? 1 : Number(operation.roundingIncrement),
      }))
    : undefined;
  const first = operations?.[0];
  return {
    pathPrefix: String(body.rule.pathPrefix || ''),
    selector: String(first?.selector || body.rule.selector || ''),
    operation: first?.operation || body.rule.operation,
    operand: first?.operand ?? parseOperand(body.rule.operand),
    rounding: first?.rounding || body.rule.rounding,
    roundingIncrement: first?.roundingIncrement ?? (body.rule.roundingIncrement === undefined ? 1 : Number(body.rule.roundingIncrement)),
    maxFiles: Number(body.rule.maxFiles),
    operations,
  };
}

function pathMatchesPrefix(candidate: string, prefix: string): boolean {
  return candidate === prefix || candidate.startsWith(`${prefix}/`);
}

function canonicalLogicalPaths(root: string, prefix: string): { generation: string; paths: string[] } {
  const query = listReferenceManifestFiles(root, { q: prefix, extension: '.xml' }, MAX_MANIFEST_ROWS + 1);
  if (!query) throw new Error('The canonical manifest is not ready. Refresh the unpacked corpus and retry.');
  if (query.files.length > MAX_MANIFEST_ROWS) {
    throw new Error(`The prefix is too broad: more than ${MAX_MANIFEST_ROWS.toLocaleString()} XML files matched. Choose a narrower corpus path.`);
  }
  const normalizedPrefix = String(prefix || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  const paths = [...new Set(query.files
    .filter(file => file.source === 'base' || file.source.startsWith('ego_dlc_'))
    .map(file => logicalReferencePath(file.path))
    .filter(file => pathMatchesPrefix(file, normalizedPrefix)))]
    .sort();
  return { generation: query.generation, paths };
}

function buildPlan(rule: BulkTransformRule, workspace: ModWorkspace) {
  const normalizedPrefix = String(rule.pathPrefix || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalizedPrefix || normalizedPrefix.startsWith('/') || /^[A-Za-z]:/.test(normalizedPrefix) || normalizedPrefix.split('/').includes('..')) {
    throw new Error('Invalid pathPrefix: use a non-empty vanilla-relative corpus path without traversal.');
  }
  const resolved = resolveXsdConfig();
  if (!resolved.x4ReferenceExists) throw new Error(`X4 unpacked reference root is unavailable: ${resolved.x4ReferenceRoot}`);
  const candidates = canonicalLogicalPaths(resolved.x4ReferenceRoot, rule.pathPrefix);
  return createBulkTransformPlan({
    rule,
    logicalPaths: candidates.paths,
    corpusGeneration: candidates.generation,
    resolve: logicalPath => resolveEffectiveReferenceDocument(resolved.x4ReferenceRoot, logicalPath),
    existingPatches: (workspace.xmlPatches || []) as PatchBlock[],
  });
}

function sendError(res: Response, error: unknown) {
  const message = errorText(error);
  const status = /missing|required|invalid|too broad/i.test(message) ? 400 : /not ready|unavailable/i.test(message) ? 503 : 500;
  return res.status(status).json({ error: message });
}

export function registerBulkTransformRoutes(app: Express, options: BulkTransformRouteOptions): void {
  app.post('/api/agent/bulk-transform/preview', (req, res) => {
    try {
      const workspace = options.workspace(req);
      const plan = buildPlan(parseRule(req.body), workspace);
      return res.status(plan.ok ? 200 : 422).json({ ...plan, applied: false, workspaceId: options.workspaceId(req), workspaceHash: options.workspaceHash(req) });
    } catch (error) { return sendError(res, error); }
  });

  app.post('/api/agent/bulk-transform/apply', (req, res) => {
    try {
      const expectedPlanHash = String(req.body?.expectedPlanHash || '').trim();
      const expectedHead = String(req.body?.expectedHead || '').trim();
      if (!expectedPlanHash) return res.status(400).json({ error: 'Missing required expectedPlanHash from preview.' });
      if (!expectedHead) return res.status(400).json({ error: 'Missing required expectedHead from preview.' });
      const workspace = options.workspace(req);
      const plan = buildPlan(parseRule(req.body), workspace);
      if (plan.planHash !== expectedPlanHash) {
        return res.status(409).json({
          error: 'bulk_plan_changed',
          message: 'The corpus, selector results, or workspace conflicts changed after preview. Preview again before applying.',
          expectedPlanHash,
          currentPlanHash: plan.planHash,
          plan,
        });
      }
      if (!plan.ok) return res.status(422).json({ error: 'bulk_plan_invalid', message: 'Bulk transform is not clean; zero workspace changes were applied.', plan });
      const xmlPatches = mergeBulkTransformPatches(workspace.xmlPatches || [], plan);
      const mutation = options.applyWorkspaceMutation(req, { xmlPatches }, { expectedHead, merge: true });
      return res.status(mutation.status).json({ ...mutation.body, workspaceId: options.workspaceId(req), plan, added: plan.rows.length, matchedFiles: plan.matchedFiles });
    } catch (error) { return sendError(res, error); }
  });
}
