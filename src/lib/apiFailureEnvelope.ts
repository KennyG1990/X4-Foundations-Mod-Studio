/**
 * Additive machine-readable truth for API failures.
 *
 * Route-specific evidence remains authoritative. This normalizer fills missing top-level
 * fields and corrects only a contradictory success:true on a recognized failure, so generic
 * clients can always answer: did it fail, why, with what code, and at which stages?
 */

type JsonRecord = Record<string, unknown>;

const FAILURE_STATUSES = new Set(['FAILED', 'BLOCKED', 'ERROR', 'REJECTED', 'TIMED_OUT']);
const FAILED_STAGE_STATUSES = new Set(['FAIL', 'FAILED', 'ERROR', 'BLOCKED', 'REJECTED']);

const HTTP_FALLBACK_CODES: Record<number, string> = {
  400: 'API_BAD_REQUEST',
  401: 'API_UNAUTHORIZED',
  403: 'API_FORBIDDEN',
  404: 'API_NOT_FOUND',
  405: 'API_METHOD_NOT_ALLOWED',
  408: 'API_TIMEOUT',
  409: 'API_CONFLICT',
  413: 'API_PAYLOAD_TOO_LARGE',
  422: 'API_UNPROCESSABLE',
  429: 'API_RATE_LIMITED',
  500: 'API_INTERNAL_ERROR',
  502: 'API_BAD_GATEWAY',
  503: 'API_SERVICE_UNAVAILABLE',
  504: 'API_TIMEOUT',
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function failureStatus(value: unknown): boolean {
  return typeof value === 'string' && FAILURE_STATUSES.has(value.trim().toUpperCase());
}

function failedStageIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (!isRecord(item) || !FAILED_STAGE_STATUSES.has(String(item.status || '').toUpperCase())) continue;
    const id = nonEmptyString(item.id) || nonEmptyString(item.stage) || nonEmptyString(item.name);
    if (id) ids.push(id);
  }
  return ids;
}

function hasExplicitSuccess(body: JsonRecord): boolean {
  return body.success === true || body.ok === true || body.pass === true || body.allPassed === true;
}

function isFailureResponse(statusCode: number, body: unknown): boolean {
  if (statusCode >= 400) return true;
  if (!isRecord(body)) return false;
  if (failureStatus(body.status)) return true;
  if (body.success === false || body.ok === false || body.pass === false || body.allPassed === false) return true;
  // A successful/partial operation may deliberately carry a failed optional stage (B109).
  // Its explicit positive outcome wins; nested failures alone do not rewrite that contract.
  if (hasExplicitSuccess(body)) return false;
  return failedStageIds(body.stages).length > 0 || failedStageIds(body.checklist).length > 0;
}

function normalizedStageCode(value: unknown): string | null {
  const stage = nonEmptyString(value);
  if (!stage) return null;
  const token = stage.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return token ? `${token}_FAILED` : null;
}

function fallbackCode(statusCode: number, body: JsonRecord): string {
  return normalizedStageCode(body.stage) || HTTP_FALLBACK_CODES[statusCode] || (statusCode >= 500 ? 'API_INTERNAL_ERROR' : 'API_OPERATION_FAILED');
}

function firstMessage(value: unknown): string | null {
  if (nonEmptyString(value)) return nonEmptyString(value);
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const direct = nonEmptyString(item);
    if (direct) return direct;
    if (isRecord(item)) {
      const nested = nonEmptyString(item.error) || nonEmptyString(item.message) || nonEmptyString(item.detail);
      if (nested) return nested;
    }
  }
  return null;
}

function firstFailedStageMessage(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (!isRecord(item) || !FAILED_STAGE_STATUSES.has(String(item.status || '').toUpperCase())) continue;
    const detail = nonEmptyString(item.error) || nonEmptyString(item.message) || nonEmptyString(item.detail);
    if (detail) return detail;
  }
  return null;
}

function inferredError(statusCode: number, body: JsonRecord): string {
  const detail = nonEmptyString(body.message)
    || firstMessage(body.errors)
    || firstFailedStageMessage(body.stages)
    || firstFailedStageMessage(body.checklist)
    || firstMessage(body.findings);
  if (detail) return detail.replace(/\s+/g, ' ').trim();
  return statusCode >= 400
    ? `API request failed with HTTP ${statusCode}.`
    : 'API operation reported failure without an error detail.';
}

function collectFailedStages(body: JsonRecord): string[] {
  const ids: string[] = [];
  if (Array.isArray(body.failedStages)) {
    for (const item of body.failedStages) {
      const id = nonEmptyString(item);
      if (id) ids.push(id);
    }
  }
  ids.push(...failedStageIds(body.stages), ...failedStageIds(body.checklist));
  if (ids.length === 0) {
    const stage = nonEmptyString(body.stage);
    if (stage) ids.push(stage);
  }
  return [...new Set(ids)];
}

/** Returns the original value by reference when it is not a recognized failure. */
export function normalizeApiFailureBody(statusCode: number, body: unknown): unknown {
  if (!isFailureResponse(statusCode, body)) return body;
  const original = isRecord(body) ? body : { details: body };
  return {
    ...original,
    // A recognized failure cannot truthfully retain success:true. This is the one existing
    // field we deliberately correct; all route-specific evidence and wording stay intact.
    success: false,
    ...(!Object.prototype.hasOwnProperty.call(original, 'status') ? { status: 'FAILED' } : {}),
    code: nonEmptyString(original.code) || fallbackCode(statusCode, original),
    error: nonEmptyString(original.error) || inferredError(statusCode, original),
    failedStages: collectFailedStages(original),
  };
}

export function runApiFailureEnvelopeSelftest() {
  const checks: Array<{ name: string; pass: boolean; detail?: unknown }> = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, detail });

  const auth = normalizeApiFailureBody(401, { error: 'Unauthorized.' }) as JsonRecord;
  ok('http_failure_gets_uniform_fields', auth.success === false && auth.status === 'FAILED' && auth.code === 'API_UNAUTHORIZED' && Array.isArray(auth.failedStages));

  const deploy = normalizeApiFailureBody(200, {
    ok: false,
    stage: 'preflight',
    checklist: [{ id: 'preflight', status: 'fail', detail: 'Three diagnostics block deploy.' }],
    preflight: { findings: [{ message: 'nested evidence stays' }] },
  }) as JsonRecord;
  ok('http_200_operational_failure_is_normalized', deploy.success === false && deploy.code === 'PREFLIGHT_FAILED');
  ok('failed_stage_and_error_are_top_level', JSON.stringify(deploy.failedStages) === '["preflight"]' && deploy.error === 'Three diagnostics block deploy.');
  ok('route_specific_detail_is_preserved', isRecord(deploy.preflight) && Array.isArray(deploy.preflight.findings));

  const releaseInput = {
    success: false, status: 'BLOCKED', code: 'WORKSPACE_REQUIRED', error: 'Workspace required.',
    failedStages: ['source'], stages: [{ id: 'source', status: 'fail', detail: 'missing' }],
  };
  const release = normalizeApiFailureBody(400, releaseInput) as JsonRecord;
  ok('existing_b109_contract_is_preserved', release.status === 'BLOCKED' && release.code === 'WORKSPACE_REQUIRED' && release.error === 'Workspace required.');
  ok('failed_stages_are_deduplicated', JSON.stringify(release.failedStages) === '["source"]', release.failedStages);

  const partial = { success: true, status: 'PARTIAL', stages: [{ id: 'tool', status: 'fail', detail: 'Install the tool.' }], failedStages: ['tool'] };
  ok('explicit_partial_success_is_not_reclassified', normalizeApiFailureBody(200, partial) === partial);

  const success = { ok: true, data: { ok: false } };
  ok('nested_false_does_not_reclassify_success', normalizeApiFailureBody(200, success) === success);
  const successArray: unknown[] = [{ ok: false }];
  ok('successful_array_is_unchanged', normalizeApiFailureBody(200, successArray) === successArray);

  const malformed = normalizeApiFailureBody(500, null) as JsonRecord;
  ok('missing_detail_falls_back_without_throwing', malformed.code === 'API_INTERNAL_ERROR' && malformed.error === 'API request failed with HTTP 500.');

  const existing = normalizeApiFailureBody(409, { ok: false, code: 'SOURCE_STALE', error: 'Exact existing error', custom: 7 }) as JsonRecord;
  ok('existing_fields_are_not_overwritten', existing.code === 'SOURCE_STALE' && existing.error === 'Exact existing error' && existing.custom === 7);
  const contradictory = normalizeApiFailureBody(500, { success: true, error: 'Route contradicted its HTTP status.' }) as JsonRecord;
  ok('http_failure_cannot_claim_success', contradictory.success === false);

  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
