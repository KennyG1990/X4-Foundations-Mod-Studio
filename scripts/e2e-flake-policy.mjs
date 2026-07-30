export const E2E_RETRY_COUNT = 1;
export const MAX_ACTIVE_QUARANTINES = 3;
export const MAX_QUARANTINE_DAYS = 14;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const EXACT_TEST_ID = /^[a-zA-Z0-9_-]{8,128}$/;
const ISSUE_REFERENCE = /^(?:B\d+(?:[-/#][a-zA-Z0-9._-]+)?|https:\/\/[^\s]+)$/;

function parseIsoDay(value) {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

function currentIsoDay() {
  return new Date().toISOString().slice(0, 10);
}

export function validateQuarantineManifest(manifest, today = currentIsoDay()) {
  const errors = [];
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  if (!manifest || manifest.version !== 1) errors.push('manifest.version must equal 1');
  if (!Array.isArray(manifest?.entries)) errors.push('manifest.entries must be an array');
  if (entries.length > MAX_ACTIVE_QUARANTINES) {
    errors.push(`active quarantine count ${entries.length} exceeds ${MAX_ACTIVE_QUARANTINES}`);
  }
  const todayMs = parseIsoDay(today);
  if (todayMs === null) errors.push(`validation date ${String(today)} is not YYYY-MM-DD`);
  const ids = new Set();
  const normalized = [];
  entries.forEach((entry, index) => {
    const prefix = `entries[${index}]`;
    const testId = typeof entry?.testId === 'string' ? entry.testId.trim() : '';
    const owner = typeof entry?.owner === 'string' ? entry.owner.trim() : '';
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
    const issue = typeof entry?.issue === 'string' ? entry.issue.trim() : '';
    const createdOn = typeof entry?.createdOn === 'string' ? entry.createdOn.trim() : '';
    const expiresOn = typeof entry?.expiresOn === 'string' ? entry.expiresOn.trim() : '';
    if (!EXACT_TEST_ID.test(testId)) errors.push(`${prefix}.testId must be one exact stable id (8-128 letters/digits/_/-)`);
    if (ids.has(testId)) errors.push(`${prefix}.testId duplicates ${testId}`);
    if (testId) ids.add(testId);
    if (!owner || owner.length > 80) errors.push(`${prefix}.owner must be 1-80 characters`);
    if (reason.length < 12 || reason.length > 240) errors.push(`${prefix}.reason must be 12-240 characters`);
    if (!ISSUE_REFERENCE.test(issue)) errors.push(`${prefix}.issue must be a B-number or https URL`);
    const createdMs = parseIsoDay(createdOn);
    const expiresMs = parseIsoDay(expiresOn);
    if (createdMs === null) errors.push(`${prefix}.createdOn must be a real YYYY-MM-DD date`);
    if (expiresMs === null) errors.push(`${prefix}.expiresOn must be a real YYYY-MM-DD date`);
    if (createdMs !== null && expiresMs !== null) {
      const days = Math.round((expiresMs - createdMs) / 86_400_000);
      if (days < 1 || days > MAX_QUARANTINE_DAYS) {
        errors.push(`${prefix} lifetime ${days} days is outside 1-${MAX_QUARANTINE_DAYS}`);
      }
      if (todayMs !== null && createdMs > todayMs) errors.push(`${prefix}.createdOn is in the future`);
      if (todayMs !== null && expiresMs < todayMs) errors.push(`${prefix} expired on ${expiresOn}`);
    }
    normalized.push({ testId, owner, reason, issue, createdOn, expiresOn });
  });
  return { valid: errors.length === 0, errors, entries: normalized };
}

function outcomeForTest(test) {
  if (typeof test?.status === 'string') return test.status;
  const statuses = (test?.results || []).map(result => result?.status).filter(Boolean);
  const last = statuses[statuses.length - 1];
  if (statuses.length > 1 && last === 'passed' && statuses.some(status => status !== 'passed')) return 'flaky';
  if (last === 'passed') return 'expected';
  if (last === 'skipped') return 'skipped';
  return last || 'didNotRun';
}

export function classifyE2eReport(report, quarantineEntries = []) {
  const stats = report?.stats || {};
  const passed = Number(stats.expected || 0);
  const failed = Number(stats.unexpected || 0);
  const flaky = Number(stats.flaky || 0);
  const quarantines = new Map(quarantineEntries.map(entry => [entry.testId, entry]));
  const issues = [];
  let totalTests = 0;
  const walk = suite => {
    for (const spec of suite?.specs || []) {
      for (const test of spec.tests || []) {
        totalTests++;
        const outcome = outcomeForTest(test);
        if (!['expected', 'skipped'].includes(outcome)) {
          issues.push({
            testId: String(spec.id || ''),
            title: String(spec.title || ''),
            file: String(spec.file || suite.file || ''),
            outcome,
            quarantine: quarantines.get(String(spec.id || '')) || null,
          });
        }
      }
    }
    for (const child of suite?.suites || []) walk(child);
  };
  for (const suite of report?.suites || []) walk(suite);
  const badResults = issues.length;
  const noTests = totalTests === 0;
  const green = passed > 0 && failed === 0 && flaky === 0 && badResults === 0 && !noTests;
  return {
    passed,
    failed,
    flaky,
    badResults,
    noTests,
    totalTests,
    issues,
    quarantinedIssues: issues.filter(issue => issue.quarantine !== null).length,
    green,
  };
}
