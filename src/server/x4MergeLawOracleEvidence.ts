import {
  X4_MERGE_ORACLE_CASE_IDS,
  evaluateX4MergeOracleEvidence,
  type X4MergeOracleCaseVerdict,
  type X4MergeOracleEvidenceResult,
  type X4MergeOracleSha256,
} from "../lib/x4MergeLawOracle";
import { deriveX4MergeLawOracleProbeTokens } from "../lib/x4MergeLawOracleFixture";

export const X4_MERGE_LAW_ORACLE_EVIDENCE_MAX_LOG_WINDOW_BYTES = 16 * 1_048_576;

const MAX_RESULT_DEFECTS = 64;
const MAX_CORE_DEFECTS = 48;
const MAX_DEFECT_BYTES = 256;
const ZERO_PROBE_OCCURRENCES = Object.freeze({
  silent: 0,
  control: 0,
});

export interface X4MergeLawOracleProbeOccurrenceCounts {
  readonly silent: number;
  readonly control: number;
}

export interface X4MergeLawOracleEvidenceResult extends X4MergeOracleEvidenceResult {
  readonly probeOccurrences: X4MergeLawOracleProbeOccurrenceCounts;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isBoundedLogWindow(value: unknown): value is string {
  if (typeof value !== "string" || value.length > X4_MERGE_LAW_ORACLE_EVIDENCE_MAX_LOG_WINDOW_BYTES) {
    return false;
  }

  try {
    return utf8ByteLength(value) <= X4_MERGE_LAW_ORACLE_EVIDENCE_MAX_LOG_WINDOW_BYTES;
  } catch {
    return false;
  }
}

function isTokenCharacter(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39)
    || (code >= 0x41 && code <= 0x5a)
    || (code >= 0x61 && code <= 0x7a)
    || code === 0x5f
  );
}

function countExactTokenOccurrences(logWindow: string, token: string): number {
  let count = 0;
  let searchOffset = 0;

  while (searchOffset <= logWindow.length - token.length) {
    const foundIndex = logWindow.indexOf(token, searchOffset);
    if (foundIndex < 0) {
      break;
    }

    const beforeIsBoundary =
      foundIndex === 0 || !isTokenCharacter(logWindow.charCodeAt(foundIndex - 1));
    const afterIndex = foundIndex + token.length;
    const afterIsBoundary =
      afterIndex === logWindow.length || !isTokenCharacter(logWindow.charCodeAt(afterIndex));
    if (beforeIsBoundary && afterIsBoundary) {
      count += 1;
    }

    searchOffset = afterIndex;
  }

  return count;
}

function sanitizeDefect(value: unknown): string {
  const source = typeof value === "string" ? value : "evidence defect unavailable.";
  const truncated = source.length > MAX_DEFECT_BYTES
    ? source.slice(0, MAX_DEFECT_BYTES - 3) + "..."
    : source;
  return truncated.replace(/[^\u0020-\u007e]/gu, "?");
}

function copyDefects(core: X4MergeOracleEvidenceResult): string[] {
  const defects: string[] = [];
  const count = Math.min(core.defects.length, MAX_CORE_DEFECTS);
  for (let index = 0; index < count; index += 1) {
    defects.push(sanitizeDefect(core.defects[index]));
  }
  if (core.defects.length > MAX_CORE_DEFECTS) {
    defects.push("additional core evidence defects were omitted.");
  }
  return defects;
}

function addDefect(defects: string[], value: string): void {
  const defect = sanitizeDefect(value);
  if (defects.length < MAX_RESULT_DEFECTS && !defects.includes(defect)) {
    defects.push(defect);
  }
}

function isStandardManifestExpectationShape(
  verdicts: readonly X4MergeOracleCaseVerdict[],
): boolean {
  if (verdicts.length !== X4_MERGE_ORACLE_CASE_IDS.length) {
    return false;
  }

  for (let index = 0; index < X4_MERGE_ORACLE_CASE_IDS.length; index += 1) {
    const verdict = verdicts[index];
    const expectedObservation = verdict.caseId === "silent" ? "pending" : "pass";
    if (
      verdict.caseId !== X4_MERGE_ORACLE_CASE_IDS[index]
      || verdict.expectedObservation !== expectedObservation
    ) {
      return false;
    }
  }

  return true;
}

function findVerdict(
  verdicts: readonly X4MergeOracleCaseVerdict[],
  caseId: (typeof X4_MERGE_ORACLE_CASE_IDS)[number],
): X4MergeOracleCaseVerdict | undefined {
  return verdicts.find((verdict) => verdict.caseId === caseId);
}

function cloneVerdict(
  verdict: X4MergeOracleCaseVerdict,
  upgradeSilent: boolean,
  failSilent: boolean,
): X4MergeOracleCaseVerdict {
  if ("observedObservation" in verdict) {
    return Object.freeze({
      caseId: verdict.caseId,
      expectedObservation: verdict.expectedObservation,
      status: verdict.caseId === "silent" && failSilent
        ? "failed"
        : verdict.caseId === "silent" && upgradeSilent
          ? "green"
          : verdict.status,
      observedObservation: verdict.observedObservation,
      detail: verdict.detail,
    });
  }

  return Object.freeze({
    caseId: verdict.caseId,
    expectedObservation: verdict.expectedObservation,
    status: "failed" as const,
  });
}

function freezeResult(
  core: X4MergeOracleEvidenceResult,
  status: X4MergeOracleEvidenceResult["status"],
  probeOccurrences: X4MergeLawOracleProbeOccurrenceCounts,
  verdicts: readonly X4MergeOracleCaseVerdict[],
  defects: readonly string[],
): X4MergeLawOracleEvidenceResult {
  return Object.freeze({
    status,
    runId: core.runId,
    fixtureHash: core.fixtureHash,
    manifestSha256: core.manifestSha256,
    logWindowSha256: core.logWindowSha256,
    verdicts: Object.freeze([...verdicts]),
    defects: Object.freeze([...defects]),
    probeOccurrences: Object.freeze({
      silent: probeOccurrences.silent,
      control: probeOccurrences.control,
    }),
  });
}

function safeFailure(): X4MergeLawOracleEvidenceResult {
  return Object.freeze({
    status: "failed" as const,
    runId: null,
    fixtureHash: null,
    manifestSha256: null,
    logWindowSha256: null,
    verdicts: Object.freeze([]),
    defects: Object.freeze(["evidence finalization failed safely."]),
    probeOccurrences: ZERO_PROBE_OCCURRENCES,
  });
}

function readProbeOccurrences(
  core: X4MergeOracleEvidenceResult,
  logWindowValue: unknown,
): { readonly evaluated: boolean; readonly counts: X4MergeLawOracleProbeOccurrenceCounts } {
  if (typeof core.runId !== "string" || !isBoundedLogWindow(logWindowValue)) {
    return { evaluated: false, counts: ZERO_PROBE_OCCURRENCES };
  }

  try {
    const tokens = deriveX4MergeLawOracleProbeTokens(core.runId);
    return {
      evaluated: true,
      counts: Object.freeze({
        silent: countExactTokenOccurrences(logWindowValue, tokens.silentProbeToken),
        control: countExactTokenOccurrences(logWindowValue, tokens.controlProbeToken),
      }),
    };
  } catch {
    return { evaluated: false, counts: ZERO_PROBE_OCCURRENCES };
  }
}

function hasExactCurrentRunCueRuntimeError(runId: string, logWindow: string): boolean {
  return logWindow.includes(
    "Error in MD cue md.Setup.X4ForgeMergeOracle_OnLoad_" + runId + ":",
  );
}

export function finalizeX4MergeLawOracleEvidence(
  manifestValue: unknown,
  logWindowValue: unknown,
  sha256Provider: unknown,
): X4MergeLawOracleEvidenceResult {
  let core: X4MergeOracleEvidenceResult;
  try {
    core = evaluateX4MergeOracleEvidence(
      manifestValue,
      logWindowValue,
      sha256Provider as X4MergeOracleSha256,
    );
  } catch {
    return safeFailure();
  }

  try {
    const defects = copyDefects(core);
    const probe = readProbeOccurrences(core, logWindowValue);
    const silentVerdict = findVerdict(core.verdicts, "silent");
    const silentMarkerFailed =
      silentVerdict !== undefined
      && "observedObservation" in silentVerdict
      && silentVerdict.observedObservation !== "pass";
    const failSilent = probe.counts.silent > 0 || silentMarkerFailed;
    const standardShape = isStandardManifestExpectationShape(core.verdicts);
    const currentRunCueRuntimeError =
      probe.evaluated
      && typeof core.runId === "string"
      && typeof logWindowValue === "string"
      && hasExactCurrentRunCueRuntimeError(core.runId, logWindowValue);

    if (probe.evaluated && probe.counts.silent > 0) {
      addDefect(defects, "silent-selector probe token occurred in the bounded log window.");
    }
    if (probe.evaluated && probe.counts.control === 0) {
      addDefect(defects, "non-silent control probe token is missing from the bounded log window.");
    }
    if (currentRunCueRuntimeError) {
      addDefect(defects, "run-scoped X4 merge-oracle MD cue runtime error occurred in the current run.");
    }
    if (core.status === "unavailable") {
      if (!probe.evaluated) {
        addDefect(defects, "external probe evidence requires a bounded string log window and valid run identity.");
      }
      if (core.logWindowSha256 === null) {
        addDefect(defects, "bounded log-window SHA-256 is unavailable.");
      }
      if (!standardShape) {
        addDefect(defects, "signed manifest expectations are not the standard silent-pending contract.");
      }
      if (silentVerdict === undefined || silentVerdict.status !== "unavailable") {
        addDefect(defects, "silent case is not the sole unavailable core verdict.");
      }
      if (core.verdicts.some((verdict) => verdict.caseId !== "silent" && verdict.status !== "green")) {
        addDefect(defects, "a non-silent core verdict is not green.");
      }
      if (silentMarkerFailed) {
        addDefect(defects, "silent case marker did not report the expected staged result.");
      }
      if (core.defects.length > 0) {
        addDefect(defects, "core marker or manifest verification reported defects.");
      }
    } else if (core.status === "green") {
      if (!standardShape) {
        addDefect(defects, "signed manifest expectations are not the standard silent-pending contract.");
      }
      addDefect(defects, "core evidence is green without the required silent-pending case.");
    }

    const canUpgrade =
      core.status === "unavailable"
      && core.defects.length === 0
      && core.logWindowSha256 !== null
      && probe.evaluated
      && standardShape
      && silentVerdict !== undefined
      && silentVerdict.status === "unavailable"
      && !silentMarkerFailed
      && probe.counts.control > 0
      && probe.counts.silent === 0
      && defects.length === 0
      && core.verdicts.every(
        (verdict) => verdict.caseId === "silent" || verdict.status === "green",
      );

    const status = canUpgrade ? "green" : "failed";
    const verdicts = core.verdicts.map((verdict) =>
      cloneVerdict(verdict, canUpgrade, failSilent),
    );

    return freezeResult(core, status, probe.counts, verdicts, defects);
  } catch {
    return safeFailure();
  }
}
