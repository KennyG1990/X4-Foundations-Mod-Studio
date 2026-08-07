/** Authenticated preview/apply routes for bounded canonical bulk XML transforms. */

import type { Express, Request, Response } from 'express';
import { resolveXsdConfig } from '../lib/xsdParser';
import { listReferenceManifestFiles } from '../lib/referenceManifest';
import { resolveEffectiveReferenceDocument } from '../lib/referenceOverlay';
import {
  createBulkTransformPlan,
  logicalReferencePath,
  type BulkTransformOperationRule,
  type BulkTransformRule,
} from '../lib/bulkCorpusTransform';
import type { RuntimeReceiptIdentityInput } from '../lib/actionReceiptRuntime';
import type { ActionReceiptTransactionProjection } from '../lib/actionReceiptTransaction';
import type { DestructiveRecoveryStore } from '../lib/destructiveRecovery';
import {
  executeBulkTransformApplyReceipt,
  type BulkTransformApplyReceiptAdapterStore,
} from './bulkTransformApplyReceiptAdapter';
import type { WorkspaceReceiptService } from './workspaceReceiptService';
import type { WorkspaceRegistry } from '../lib/workspaceRegistry';
import type { ModWorkspace, PatchBlock } from '../types';

interface BulkTransformRouteOptions {
  workspace: (req: Request) => ModWorkspace;
  workspaceId: (req: Request) => string;
  workspaceHash: (req: Request) => string;
  workspaceSnapshotHash: (req: Request) => string;
  registry: WorkspaceRegistry;
  receiptService: WorkspaceReceiptService;
  store: BulkTransformApplyReceiptAdapterStore;
  recoveryStore: DestructiveRecoveryStore;
  operationId: (req: Request) => unknown;
  identity: (req: Request) => RuntimeReceiptIdentityInput;
  captureProjection: (req: Request, projection: ActionReceiptTransactionProjection | undefined) => void | Promise<void>;
  mayProceed: (req: Request, res: Response) => boolean | Promise<boolean>;
  recoveryForReceipt: (projection: ActionReceiptTransactionProjection | undefined) => Record<string, unknown> | undefined;
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

function bulkTransformApplyFailureStatus(code: string): number {
  if (code === 'WORKSPACE_NOT_FOUND') return 404;
  if (code === 'ACTION_RECEIPT_OPERATION_ID_INVALID'
    || code === 'WORKSPACE_ID_INVALID'
    || code === 'BULK_APPLY_RECEIPT_INPUT_INVALID'
    || code === 'BULK_APPLY_RECEIPT_FACTS_INVALID'
    || code.startsWith('ACTION_RECEIPT_RUNTIME_')) return 400;
  if (code === 'BULK_APPLY_PLAN_INVALID') return 422;
  if (code === 'BULK_APPLY_PLAN_CHANGED'
    || code === 'BULK_APPLY_HEAD_CONFLICT'
    || code === 'BULK_APPLY_SNAPSHOT_CONFLICT'
    || code === 'BULK_APPLY_REPLAY_STATE_CONFLICT'
    || code === 'BULK_APPLY_BOUNDARY_CAS_CONFLICT'
    || code === 'BULK_APPLY_BOUNDARY_FACTS_CHANGED'
    || code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
    || code === 'RECEIPT_DUPLICATE_CONFLICT'
    || code === 'ACTION_RECEIPT_PREPARED_REPLAY'
    || code === 'ACTION_RECEIPT_REPLAY') return 409;
  if (code === 'BULK_APPLY_RECOVERY_FAILED'
    || code === 'BULK_APPLY_ROLLBACK_FAILED'
    || code === 'BULK_APPLY_REPLAY_RECOVERY_INVALID'
    || code === 'BULK_APPLY_RECEIPT_RECOVERY_REOPEN_FAILED'
    || code === 'ACTION_RECEIPT_RECOVERY_FAILED'
    || code === 'ACTION_RECEIPT_ROLLBACK_FAILED'
    || code === 'ACTION_RECEIPT_INCOMPLETE_UNRECORDED'
    || (code.includes('RECOVERY') && !code.includes('UNAVAILABLE'))
    || code.includes('ROLLBACK')
    || code.includes('INCOMPLETE')) return 507;
  if (code === 'BULK_APPLY_REPLAY_RECOVERY_UNAVAILABLE'
    || code === 'BULK_APPLY_CURRENT_STATE_READ_FAILED'
    || code === 'BULK_APPLY_REPLAY_STATE_UNAVAILABLE'
    || code === 'BULK_APPLY_RECEIPT_EXECUTION_FAILED'
    || code === 'BULK_APPLY_RECEIPT_LOOKUP_FAILED'
    || code === 'BULK_APPLY_RECEIPT_REOPEN_FAILED'
    || code === 'BULK_APPLY_PREPARE_FAILED'
    || code === 'BULK_APPLY_RESPONSE_DEADLINE'
    || code.includes('PREPARE')
    || code.includes('UNAVAILABLE')
    || code.includes('STORE')
    || code.includes('POLICY')
    || code.includes('COVERAGE')) return 503;
  return 500;
}

function safeRecoveryResponse(
  options: BulkTransformRouteOptions,
  projection: ActionReceiptTransactionProjection | undefined,
): Record<string, unknown> | undefined {
  if (projection === undefined) return undefined;
  try {
    return options.recoveryForReceipt(projection);
  } catch {
    return undefined;
  }
}

export function registerBulkTransformRoutes(app: Express, options: BulkTransformRouteOptions): void {
  app.post('/api/agent/bulk-transform/preview', (req, res) => {
    try {
      const workspace = options.workspace(req);
      const plan = buildPlan(parseRule(req.body), workspace);
      return res.status(plan.ok ? 200 : 422).json({
        ...plan,
        applied: false,
        workspaceId: options.workspaceId(req),
        workspaceHash: options.workspaceHash(req),
        snapshotHash: options.workspaceSnapshotHash(req),
      });
    } catch (error) { return sendError(res, error); }
  });

  app.post('/api/agent/bulk-transform/apply', async (req, res) => {
    const mayProceed = () => options.mayProceed(req, res);
    const responseAvailable = async () => {
      if (res.writableEnded || res.destroyed) return false;
      try { return await mayProceed(); } catch { return false; }
    };
    const respondFailure = async (
      code: string,
      replayed = false,
      receipt?: ActionReceiptTransactionProjection,
    ) => {
      if (!await responseAvailable()) return;
      const recovery = safeRecoveryResponse(options, receipt);
      return res.status(bulkTransformApplyFailureStatus(code)).json({
        success: false,
        status: 'FAILED',
        code,
        error: 'Bulk transform apply failed.',
        failedStages: ['bulk_transform_apply_receipt'],
        replayed,
        ...(receipt === undefined ? {} : { receipt }),
        ...(recovery === undefined ? {} : { recovery }),
      });
    };

    if (!await responseAvailable()) return;

    let operationId: unknown;
    try {
      operationId = options.operationId(req);
    } catch {
      return respondFailure('ACTION_RECEIPT_OPERATION_ID_INVALID');
    }
    const expectedPlanHash = req.body?.expectedPlanHash;
    const expectedHead = req.body?.expectedHead;
    const expectedSnapshotHash = req.body?.expectedSnapshotHash;
    if (typeof operationId !== 'string' || operationId.trim().length === 0) {
      return respondFailure('ACTION_RECEIPT_OPERATION_ID_INVALID');
    }
    if (typeof expectedPlanHash !== 'string' || expectedPlanHash.trim().length === 0
      || typeof expectedHead !== 'string' || expectedHead.trim().length === 0
      || typeof expectedSnapshotHash !== 'string' || expectedSnapshotHash.trim().length === 0) {
      return respondFailure('BULK_APPLY_RECEIPT_INPUT_INVALID');
    }

    let rule: BulkTransformRule;
    try {
      rule = parseRule(req.body);
    } catch {
      return respondFailure('BULK_APPLY_RECEIPT_INPUT_INVALID');
    }

    try {
      const result = await executeBulkTransformApplyReceipt({
        registry: options.registry,
        receiptService: options.receiptService,
        recoveryStore: options.recoveryStore,
        store: options.store,
        captureProjection: projection => options.captureProjection(req, projection),
      }, {
        operationId,
        workspaceId: options.workspaceId(req),
        identity: options.identity(req),
        rule,
        expectedPlanHash,
        expectedHead,
        expectedSnapshotHash,
        buildPlan,
        mayProceed,
      });

      if (!await responseAvailable()) return;
      if (result.ok === false) return respondFailure(result.code, result.replayed, result.receipt);
      if (result.receipt.status !== 'committed') {
        return respondFailure('BULK_APPLY_RECEIPT_MISMATCH', result.replayed, result.receipt);
      }

      const recovery = safeRecoveryResponse(options, result.receipt);
      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        applied: result.applied,
        replayed: result.replayed,
        message: result.applied ? 'Workspace updated; version bumped.' : 'Workspace already in sync.',
        workspaceId: result.record.workspaceId,
        workspace: result.record.workspace,
        version: result.record.version,
        workspaceHash: result.record.head,
        snapshotHash: options.registry.snapshotHash(result.record),
        plan: result.plan,
        added: result.plan.rows.length,
        matchedFiles: result.plan.matchedFiles,
        receipt: result.receipt,
        ...(recovery === undefined ? {} : { recovery }),
      });
    } catch {
      return respondFailure('BULK_APPLY_RECEIPT_EXECUTION_FAILED');
    }
  });
}
