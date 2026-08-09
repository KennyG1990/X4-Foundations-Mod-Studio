import fs from "fs";
import os from "os";
import path from "path";
import type { RuntimeExtensionInput } from "../lib/runtimeDebugger";
import { RuntimeDebugSessionStore } from "../lib/runtimeDebugSession";
import { expectedInputFromLegacy, RuntimeDebuggerAdapter, type RuntimeDebuggerDeployInfo, type RuntimeInstalledExtensionInventory } from "./runtimeDebuggerAdapter";
import type { ModWorkspace } from "../types";

type SelftestCheck = { name: string; pass: boolean; detail?: string };

const WORKSPACE_ID = "ws_runtime_adapter";
const DEPLOY_INFO: RuntimeDebuggerDeployInfo = {
  workspaceId: WORKSPACE_ID,
  modId: "x4_ai_influence",
  workspaceName: "AiLive",
  workspaceHash: "hash-runtime-adapter",
  deployedAt: "2026-08-08T12:00:00.000Z",
  deployedPath: "F:/X4/extensions/x4_ai_influence",
};

function mdFixture(): string {
  const lines = Array.from({ length: 97 }, () => "<!-- deterministic filler -->");
  lines.push("<cancel_conversation><actor name=\"speaker\" template=\"chat\" /></cancel_conversation>");
  return lines.join("\n");
}

function manifestFixture(): Record<string, string> {
  return {
    "content.xml": "<content id=\"x4_ai_influence\" name=\"Ai Influence\" />",
    "md/ai_influence_conversation.xml": mdFixture(),
    "md/shared.xml": "<mdscript name=\"SharedScript\"><cue name=\"Shared\" /></mdscript>",
    "ui/ai_influence_chat.lua": "function onChat() end",
  };
}

function workspaceFixture(): Pick<{ workspaceId: string; workspace: ModWorkspace }, "workspaceId" | "workspace"> {
  const md = mdFixture();
  return {
    workspaceId: WORKSPACE_ID,
    workspace: {
      id: "x4_ailive",
      name: "AiLive",
      contentId: "x4_ai_influence",
      sourceFolder: "x4_ailive",
      nodes: [{
        id: "cancel-conversation",
        type: "action",
        label: "cancel_conversation",
        xmlTag: "cancel_conversation",
        properties: { mdScript: "ai_influence_conversation" },
        source: { path: "md/ai_influence_conversation.xml", start: 0, end: md.length, modeled: true },
      }],
    } as unknown as ModWorkspace,
  };
}

function otherExtensionFixture(): RuntimeExtensionInput {
  return {
    workspaceId: "other-extension",
    id: "other_mod",
    name: "Other Mod",
    displayName: "Other Mod",
    contentId: "other_mod",
    deployedFolder: "other_mod",
    manifest: [
      { path: "content.xml", text: "<content id=\"other_mod\" name=\"Other Mod\" />" },
      { path: "md/shared.xml", text: "<mdscript name=\"SharedScript\"><cue name=\"Shared\" /></mdscript>" },
    ],
  };
}

function installedExtensionFixture(folder: string, sourceFolder?: string): RuntimeExtensionInput {
  return {
    workspaceId: `installed-${folder}`,
    id: folder,
    name: "Ai Influence",
    displayName: "Ai Influence",
    contentId: "x4_ai_influence",
    deployedFolder: folder,
    ...(sourceFolder ? { sourceFolder, sourceFolders: [sourceFolder] } : {}),
    manifest: [
      { path: "content.xml", text: "<content id=\"x4_ai_influence\" name=\"Ai Influence\" />" },
      { path: "md/ai_influence_conversation.xml", text: "<mdscript name=\"installed_copy\" />" },
      { path: "md/legacy_only.xml", text: "<mdscript name=\"legacy_only\" />" },
    ],
  };
}

function directFailureLine(time = "10.0", folder = "x4_ai_influence"): string {
  return `[=ERROR=] ${time} extensions\\${folder}\\md\\ai_influence_conversation.xml(98): Neither of the attributes 'actor' and 'template' is present!`;
}

function authoredMarkerLine(time = "20.0"): string {
  return `[=ERROR=] ${time} extensions\\x4_ai_influence\\md\\ai_influence_conversation.xml(98): [AICHAT][UIX] runtime marker heartbeat`;
}

function authoredOwnedPathLine(time = "20.5"): string {
  return `[=ERROR=] ${time} [AICHTTP] AIC-HTTP libs loaded from extensions/x4_ai_influence/lua3p/`;
}

function fileIoLine(time = "21.0"): string {
  return `[FileIO ] ${time} Failed to verify signature for file 'extensions\\x4_ai_influence\\ui\\ai_influence_chat.lua'`;
}

function bareCollisionLine(time = "22.0"): string {
  return `[=ERROR=] ${time} md\\shared.xml(1): invalid parameter in SharedScript`;
}

function unrelatedLine(time = "23.0"): string {
  return `[=ERROR=] ${time} extensions\\other_mod\\md\\shared.xml(1): invalid parameter`;
}

function checkDetail(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try { return JSON.stringify(value).slice(0, 1000); } catch { return String(value).slice(0, 1000); }
}

function normalizedWindowsPathForCheck(value: string): string {
  const normalized = path.win32.normalize(value.replace(/\//g, "\\"));
  if (/^[A-Za-z]:\\$/.test(normalized) || normalized === "\\") return normalized;
  return normalized.replace(/[\\]+$/, "");
}

function expectedRedactedProfilePath(value: string, profileRoot: string): string {
  const root = normalizedWindowsPathForCheck(profileRoot);
  const candidate = normalizedWindowsPathForCheck(value);
  const rootLower = root.toLowerCase();
  const candidateLower = candidate.toLowerCase();
  if (candidateLower !== rootLower && !candidateLower.startsWith(`${rootLower}\\`)) return value;
  return `%USERPROFILE%${candidate.slice(root.length)}`;
}

function containsExactProfilePrefix(value: string, profileRoot: string): boolean {
  const root = normalizedWindowsPathForCheck(profileRoot).toLowerCase();
  const normalized = value.replace(/\//g, "\\").toLowerCase();
  let start = 0;
  while (start < normalized.length) {
    const index = normalized.indexOf(root, start);
    if (index < 0) return false;
    const next = normalized[index + root.length];
    if (next === undefined || next === "\\") return true;
    start = index + 1;
  }
  return false;
}

function createAdapter(
  root: string,
  selectedPath: () => string,
  profile: () => string,
  inventory: () => RuntimeInstalledExtensionInventory,
  now: () => number,
  selection: { preferredLogPath?: string; logCandidates?: () => readonly string[]; store?: RuntimeDebugSessionStore } = {},
): RuntimeDebuggerAdapter {
  return new RuntimeDebuggerAdapter({
    root,
    ...(selection.store ? { store: selection.store } : {}),
    ...(selection.preferredLogPath !== undefined ? { preferredLogPath: selection.preferredLogPath } : {}),
    logCandidates: selection.logCandidates || (() => [selectedPath()]),
    profileForLog: profile,
    installedInventory: inventory,
    inventoryTtlMs: 180_000,
    now,
  });
}

function appendLine(filePath: string, line: string): void {
  const size = fs.statSync(filePath).size;
  const last = size > 0 ? Buffer.alloc(1) : undefined;
  if (last) {
    const descriptor = fs.openSync(filePath, "r");
    try { fs.readSync(descriptor, last, 0, 1, size - 1); } finally { fs.closeSync(descriptor); }
  }
  const separator = !size || last?.toString("utf8") === "\n" ? "" : "\n";
  fs.appendFileSync(filePath, `${separator}${line}\n`, "utf8");
}

function runBoundedStoreChecks(root: string, checks: SelftestCheck[]): void {
  const logPath = path.join(root, "bounded.log");
  const size = 3 * 1024 * 1024;
  const identity = "identity-a";
  const backing = Buffer.from("noise\n".repeat(Math.ceil(size / 6)), "utf8").subarray(0, size);
  const reads: number[] = [];
  const store = new RuntimeDebugSessionStore({
    root: path.join(root, "bounded-store"),
    now: () => 0,
    stat: () => ({ size, fileIdentity: identity, mtimeMs: 0 }),
    read: (_filePath, position, length) => {
      reads.push(length);
      return backing.subarray(position, Math.min(position + length, size));
    },
  });
  let totalBytes = 0;
  let calls = 0;
  for (;;) {
    const result = store.ingest({ workspaceId: "ws_bounded", logPath, profileId: "profile-a", baselineOffset: 0, baselineLineNumber: 0 });
    calls += 1;
    if (result.ok === false) {
      checks.push({ name: "bounded_multi_megabyte_ingest_succeeds", pass: false, detail: result.error });
      break;
    }
    totalBytes += result.bytesRead;
    if (result.bytesRead === 0 || calls > 8) break;
  }
  checks.push({ name: "bounded_multi_megabyte_ingest_calls_are_capped", pass: calls >= 3 && calls <= 8 && totalBytes === size && reads.every(length => length <= 64 * 1024), detail: checkDetail({ calls, totalBytes, maxRead: Math.max(...reads) }) });

  const boundaryBytes = Buffer.from("line\n", "utf8");
  let boundarySize = boundaryBytes.length;
  let boundaryIdentity = "boundary-a";
  const boundaryStore = new RuntimeDebugSessionStore({
    root: path.join(root, "boundary-store"),
    now: () => 0,
    stat: () => ({ size: boundarySize, fileIdentity: boundaryIdentity, mtimeMs: 0 }),
    read: (_filePath, position, length) => boundaryBytes.subarray(position, Math.min(position + length, boundarySize)),
  });
  const boundaryPath = path.join(root, "boundary.log");
  boundaryStore.ingest({ workspaceId: "ws_boundary", logPath: boundaryPath, profileId: "profile-a", baselineOffset: 0, baselineLineNumber: 0 });
  boundaryStore.ingest({ workspaceId: "ws_boundary", logPath: boundaryPath, profileId: "profile-b", baselineOffset: 0, baselineLineNumber: 0 });
  boundaryStore.ingest({ workspaceId: "ws_boundary", logPath: path.join(root, "boundary-2.log"), profileId: "profile-b", baselineOffset: 0, baselineLineNumber: 0 });
  boundarySize = 1;
  boundaryStore.ingest({ workspaceId: "ws_boundary", logPath: path.join(root, "boundary-2.log"), profileId: "profile-b", baselineOffset: 0, baselineLineNumber: 0 });
  boundarySize = boundaryBytes.length;
  boundaryIdentity = "boundary-b";
  const rotation = boundaryStore.ingest({ workspaceId: "ws_boundary", logPath: path.join(root, "boundary-2.log"), profileId: "profile-b", baselineOffset: 0, baselineLineNumber: 0 });
  const reasons = rotation.ok ? rotation.snapshot.segments.map(segment => segment.reason) : [];
  checks.push({ name: "profile_path_truncation_rotation_boundaries", pass: reasons.includes("profile-change") && reasons.includes("selected-path-change") && reasons.includes("truncation") && reasons.includes("file-replaced-or-rotated"), detail: checkDetail(reasons) });
}

export function runRuntimeDebuggerAdapterSelftest(): {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: SelftestCheck[];
} {
  const checks: SelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: unknown): void => { checks.push({ name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail: checkDetail(detail) }) }); };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "x4-runtime-debugger-adapter-"));
  let selectedPath = path.join(root, "debuglog.txt");
  let profile = "profile-a";
  const now = 0;
  let inventoryScans = 0;
  const inventory = (): RuntimeInstalledExtensionInventory => {
    inventoryScans += 1;
    return {
      complete: true,
      scannedAt: new Date(now).toISOString(),
      extensions: [otherExtensionFixture()],
    };
  };
    const record = workspaceFixture();
    const manifest = manifestFixture();
    const adapterRoot = path.join(root, "adapter-store");
    const adapter = createAdapter(adapterRoot, () => selectedPath, () => profile, inventory, () => now);
    fs.writeFileSync(selectedPath, `${directFailureLine()}\n${"historical noise\n".repeat(4)}`, "utf8");

    try {
    const preferredOlderPath = path.join(root, "preferred-older.log");
    const automaticOlderPath = path.join(root, "automatic-older.log");
    const automaticFreshestPath = path.join(root, "automatic-freshest.log");
    fs.writeFileSync(preferredOlderPath, "", "utf8");
    fs.writeFileSync(automaticOlderPath, "", "utf8");
    fs.writeFileSync(automaticFreshestPath, "", "utf8");
    fs.utimesSync(preferredOlderPath, new Date("2026-01-01T00:00:01.000Z"), new Date("2026-01-01T00:00:01.000Z"));
    fs.utimesSync(automaticOlderPath, new Date("2026-01-01T00:00:02.000Z"), new Date("2026-01-01T00:00:02.000Z"));
    fs.utimesSync(automaticFreshestPath, new Date("2026-01-01T00:00:03.000Z"), new Date("2026-01-01T00:00:03.000Z"));
    const selectionInventory = () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [otherExtensionFixture()] });
    const preferredResult = createAdapter(
      path.join(root, "preferred-selection-store"),
      () => automaticOlderPath,
      () => profile,
      selectionInventory,
      () => now,
      { preferredLogPath: preferredOlderPath, logCandidates: () => [automaticFreshestPath] },
    ).buildBrief({ record, manifest, expectedSteps: [] });
    check("older_readable_preferred_log_path_wins", preferredResult.selectedLogPath === path.resolve(preferredOlderPath), preferredResult.selectedLogPath);

    const freshestResult = createAdapter(
      path.join(root, "freshest-selection-store"),
      () => automaticOlderPath,
      () => profile,
      selectionInventory,
      () => now,
      { logCandidates: () => [automaticOlderPath, automaticFreshestPath] },
    ).buildBrief({ record, manifest, expectedSteps: [] });
    check("freshest_readable_automatic_candidate_wins", freshestResult.selectedLogPath === path.resolve(automaticFreshestPath), freshestResult.selectedLogPath);

    const missingPreferredResult = createAdapter(
      path.join(root, "missing-preferred-selection-store"),
      () => automaticOlderPath,
      () => profile,
      selectionInventory,
      () => now,
      { preferredLogPath: path.join(root, "missing-preferred.log"), logCandidates: () => [automaticOlderPath, automaticFreshestPath] },
    ).buildBrief({ record, manifest, expectedSteps: [] });
    check("missing_preferred_log_path_falls_back_to_freshest_automatic_candidate", missingPreferredResult.selectedLogPath === path.resolve(automaticFreshestPath), missingPreferredResult.selectedLogPath);

    const uniqueLegacyPath = path.join(root, "unique-legacy.log");
    fs.writeFileSync(uniqueLegacyPath, `${directFailureLine("11.0", "legacy_folder")}\n`, "utf8");
    const uniqueLegacy = installedExtensionFixture("legacy_folder");
    const uniqueAdapter = createAdapter(
      path.join(root, "unique-legacy-store"),
      () => uniqueLegacyPath,
      () => profile,
      () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [uniqueLegacy] }),
      () => now,
    );
    const uniqueResult = uniqueAdapter.buildBrief({ record, manifest, modId: "request-alias", expectedSteps: [] });
    const uniqueIncident = uniqueResult.payload.incidents.find(incident => incident.classification === "direct_extension_fault");
    check(
      "unique_complete_content_id_match_merges_installed_folder_and_reports_zero_others",
      Boolean(uniqueIncident?.attribution.disposition === "confirmed_active" && uniqueResult.payload.identity.deployedFolders.includes("legacy_folder") && uniqueResult.payload.identity.ownedFileCount === 5 && uniqueResult.payload.identity.inventoryOtherExtensionCount === 0),
      { identity: uniqueResult.payload.identity, incident: uniqueIncident },
    );
    check(
      "workspace_manifest_text_precedes_installed_duplicate_for_node_mapping",
      Boolean(uniqueIncident?.mapping.kind === "node" && uniqueIncident.mapping.nodeId === "cancel-conversation" && uniqueIncident.mapping.line === 98),
      uniqueIncident?.mapping,
    );

    const duplicateAPath = path.join(root, "duplicate-content.log");
    fs.writeFileSync(duplicateAPath, `${directFailureLine("12.0", "legacy_a")}\n`, "utf8");
    const duplicateAdapter = createAdapter(
      path.join(root, "duplicate-content-store"),
      () => duplicateAPath,
      () => profile,
      () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [installedExtensionFixture("legacy_a"), installedExtensionFixture("legacy_b")] }),
      () => now,
    );
    const duplicateResult = duplicateAdapter.buildBrief({ record, manifest, expectedSteps: [] });
    check(
      "duplicate_content_id_matches_are_not_guessed_and_report_two_others",
      Boolean(duplicateResult.payload.hiddenOtherModCount > 0 && !duplicateResult.payload.identity.deployedFolders.includes("legacy_a") && duplicateResult.payload.identity.inventoryOtherExtensionCount === 2),
      { identity: duplicateResult.payload.identity, hiddenOtherModCount: duplicateResult.payload.hiddenOtherModCount, incidents: duplicateResult.payload.incidents },
    );

    const explicitFolderPath = path.join(root, "explicit-folder.log");
    fs.writeFileSync(explicitFolderPath, `${directFailureLine("13.0", "legacy_a")}\n${directFailureLine("14.0", "legacy_b")}\n`, "utf8");
    const explicitFolderAdapter = createAdapter(
      path.join(root, "explicit-folder-store"),
      () => explicitFolderPath,
      () => profile,
      () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [installedExtensionFixture("legacy_a"), installedExtensionFixture("legacy_b")] }),
      () => now,
    );
    const explicitFolderDeploy = { ...DEPLOY_INFO, deployedPath: "F:/X4/extensions/legacy_b" };
    const explicitFolderResult = explicitFolderAdapter.buildBrief({ record, manifest, deployInfo: explicitFolderDeploy, expectedSteps: [] });
    const explicitA = explicitFolderResult.payload.incidents.find(incident => incident.attribution.evidence.some(evidence => evidence.value.includes("legacy_a")));
    const explicitB = explicitFolderResult.payload.incidents.find(incident => incident.attribution.evidence.some(evidence => evidence.value.includes("legacy_b")));
    check(
      "explicit_successful_deploy_folder_selects_only_matching_duplicate",
      Boolean(explicitFolderResult.payload.identity.deployedFolders.includes("legacy_b") && !explicitFolderResult.payload.identity.deployedFolders.includes("legacy_a") && explicitA?.attribution.disposition !== "confirmed_active" && explicitB?.attribution.disposition === "confirmed_active"),
      { identity: explicitFolderResult.payload.identity, a: explicitA?.attribution, b: explicitB?.attribution },
    );

    const incompleteSourcePath = path.join(root, "incomplete-source.log");
    fs.writeFileSync(incompleteSourcePath, `${directFailureLine("15.0", "legacy_source")}\n`, "utf8");
    const incompleteSourceAdapter = createAdapter(
      path.join(root, "incomplete-source-store"),
      () => incompleteSourcePath,
      () => profile,
      () => ({ complete: false, scannedAt: new Date(now).toISOString(), extensions: [installedExtensionFixture("legacy_source", "x4_ailive")] }),
      () => now,
    );
    const incompleteSourceResult = incompleteSourceAdapter.buildBrief({ record, manifest, expectedSteps: [] });
    const incompleteSourceIncident = incompleteSourceResult.payload.incidents.find(incident => incident.classification === "direct_extension_fault");
    check(
      "exact_source_folder_can_select_with_incomplete_inventory",
      Boolean(incompleteSourceIncident?.attribution.disposition === "confirmed_active" && incompleteSourceResult.payload.identity.deployedFolders.includes("legacy_source") && incompleteSourceResult.payload.identity.inventoryComplete === false),
      { identity: incompleteSourceResult.payload.identity, incident: incompleteSourceIncident },
    );

    const incompleteContentPath = path.join(root, "incomplete-content.log");
    fs.writeFileSync(incompleteContentPath, `${directFailureLine("15.5", "x4_ai_influence")}\n`, "utf8");
    const incompleteContentAdapter = createAdapter(
      path.join(root, "incomplete-content-store"),
      () => incompleteContentPath,
      () => profile,
      () => ({ complete: false, scannedAt: new Date(now).toISOString(), extensions: [installedExtensionFixture("x4_ai_influence"), otherExtensionFixture()] }),
      () => now,
    );
    const incompleteContentResult = incompleteContentAdapter.buildBrief({ record, manifest, expectedSteps: [] });
    const incompleteContentIncident = incompleteContentResult.payload.incidents.find(incident => incident.classification === "direct_extension_fault");
    check(
      "incomplete_inventory_unique_folder_content_match_merges_active_owner",
      Boolean(incompleteContentIncident?.attribution.disposition === "confirmed_active"
        && incompleteContentResult.payload.identity.deployedFolders.includes("x4_ai_influence")
        && !incompleteContentResult.payload.identity.deployedFolders.includes("x4_ailive")
        && incompleteContentResult.payload.identity.inventoryComplete === false
        && incompleteContentResult.payload.identity.inventoryOtherExtensionCount === 1),
      { identity: incompleteContentResult.payload.identity, incident: incompleteContentIncident },
    );
    appendLine(incompleteContentPath, unrelatedLine("15.6"));
    const incompleteWithUnrelated = incompleteContentAdapter.buildBrief({ record, manifest, expectedSteps: [] });
    check(
      "incomplete_inventory_known_unrelated_evidence_remains_excluded",
      incompleteWithUnrelated.payload.hiddenOtherModCount > 0
        && incompleteWithUnrelated.payload.incidents.every(incident => incident.attribution.disposition !== "excluded_other_mod"),
      { hiddenOtherModCount: incompleteWithUnrelated.payload.hiddenOtherModCount, incidents: incompleteWithUnrelated.payload.incidents },
    );

    const incompleteConflictPath = path.join(root, "incomplete-conflict.log");
    fs.writeFileSync(incompleteConflictPath, `${directFailureLine("15.7", "x4_ai_influence")}\n`, "utf8");
    const incompleteConflictAdapter = createAdapter(
      path.join(root, "incomplete-conflict-store"),
      () => incompleteConflictPath,
      () => profile,
      () => ({ complete: false, scannedAt: new Date(now).toISOString(), extensions: [installedExtensionFixture("x4_ai_influence"), installedExtensionFixture("conflicting_copy")] }),
      () => now,
    );
    const incompleteConflictResult = incompleteConflictAdapter.buildBrief({ record, manifest, expectedSteps: [] });
    const incompleteConflictIncident = incompleteConflictResult.payload.incidents.find(incident => incident.classification === "direct_extension_fault");
    check(
      "incomplete_inventory_multiple_exact_owner_candidates_remain_ambiguous",
      Boolean(incompleteConflictIncident?.attribution.disposition === "ambiguous" && incompleteConflictResult.payload.identity.inventoryOtherExtensionCount === 2),
      { identity: incompleteConflictResult.payload.identity, incident: incompleteConflictIncident },
    );

    const first = adapter.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: [] });
    const direct = first.payload.incidents.find(incident => incident.classification === "direct_extension_fault");
    check("hostile_query_mod_id_cannot_replace_exact_deployed_identity", first.payload.authority.deployedFolder === "x4_ai_influence" && first.payload.identity.deployedFolders.includes("x4_ai_influence") && !first.payload.identity.deployedFolders.includes("x4_ailive"), first.payload.identity);
    check("exact_real_line_renamed_workspace_is_active_engine_failure", Boolean(direct && direct.attribution.disposition === "confirmed_active" && direct.isEngineFailure === true && direct.mapping.file === "md/ai_influence_conversation.xml" && direct.mapping.line === 98), direct);
    check("governed_explanation_is_persisted", Boolean(direct && direct.explanation.cause !== "Runtime explanation unavailable." && direct.explanation.summary.length > 0), direct?.explanation);
    check("prebaseline_evidence_is_historical_not_current", first.payload.session.state === "historical" && first.payload.verdict.state === "stale", first.payload.verdict);
    check("inventory_cache_reused_across_polls", inventoryScans === 1 && first.payload.identity.inventoryComplete === true && Boolean(first.payload.identity.inventoryScannedAt), { inventoryScans, scannedAt: first.payload.identity.inventoryScannedAt });

    const profileRoot = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const exactSelectedLogPath = path.resolve(selectedPath);
    const expectedRedactedLogPath = expectedRedactedProfilePath(exactSelectedLogPath, profileRoot);
    const homeSourceFolder = path.win32.join(profileRoot.toLowerCase(), "Documents", "Egosoft", "X4", "x4_ailive");
    const homeSourceRecord = { ...record, workspace: { ...record.workspace, sourceFolder: homeSourceFolder } };
    const redactedResult = adapter.buildBrief({ record: homeSourceRecord, manifest, expectedSteps: [] });
    const redactedPayloadText = JSON.stringify(redactedResult.payload);
    check(
      "ui_payload_and_artifact_redact_case_insensitive_profile_paths_and_keep_internal_selection",
      redactedResult.payload.session.logPath === expectedRedactedLogPath
        && redactedResult.payload.authority.sourceFolder === expectedRedactedProfilePath(homeSourceFolder, profileRoot)
        && redactedResult.payload.identity.sourceFolders.includes(expectedRedactedProfilePath(homeSourceFolder, profileRoot))
        && redactedResult.selectedLogPath === exactSelectedLogPath
        && redactedResult.artifact.includes("%USERPROFILE%")
        && !containsExactProfilePrefix(redactedPayloadText, profileRoot)
        && !containsExactProfilePrefix(redactedResult.artifact, profileRoot),
      {
        sessionRedacted: redactedResult.payload.session.logPath === expectedRedactedLogPath,
        authorityRedacted: redactedResult.payload.authority.sourceFolder === expectedRedactedProfilePath(homeSourceFolder, profileRoot),
        selectedPathPreserved: redactedResult.selectedLogPath === exactSelectedLogPath,
        payloadLeaked: containsExactProfilePrefix(redactedPayloadText, profileRoot),
        artifactLeaked: containsExactProfilePrefix(redactedResult.artifact, profileRoot),
      },
    );
    const siblingSourceFolder = path.win32.join(`${normalizedWindowsPathForCheck(profileRoot)}2`, "Documents", "Egosoft", "X4", "x4_ailive");
    const siblingResult = adapter.buildBrief({ record: { ...record, workspace: { ...record.workspace, sourceFolder: siblingSourceFolder } }, manifest, expectedSteps: [] });
    check(
      "sibling_profile_prefix_remains_unchanged",
      siblingResult.payload.authority.sourceFolder === siblingSourceFolder && siblingResult.payload.identity.sourceFolders.includes(siblingSourceFolder),
      { unchanged: siblingResult.payload.authority.sourceFolder === siblingSourceFolder },
    );
    const nonHomeSourceFolder = "F:\\Forge\\runtime-debugger\\x4_ailive";
    const nonHomeResult = adapter.buildBrief({ record: { ...record, workspace: { ...record.workspace, sourceFolder: nonHomeSourceFolder } }, manifest, expectedSteps: [] });
    check(
      "non_home_source_path_remains_unchanged",
      nonHomeResult.payload.authority.sourceFolder === nonHomeSourceFolder && nonHomeResult.payload.identity.sourceFolders.includes(nonHomeSourceFolder),
      { unchanged: nonHomeResult.payload.authority.sourceFolder === nonHomeSourceFolder },
    );

    const focusedCorpusPath = path.join(root, "focused-corpus.log");
    fs.writeFileSync(focusedCorpusPath, [
      directFailureLine("18.0"),
      authoredMarkerLine("18.1"),
      authoredOwnedPathLine("18.2"),
      fileIoLine("18.3"),
      unrelatedLine("18.4"),
      bareCollisionLine("18.5"),
    ].join("\n") + "\n", "utf8");
    const focusedCorpus = createAdapter(
      path.join(root, "focused-corpus-store"),
      () => focusedCorpusPath,
      () => profile,
      () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [otherExtensionFixture()] }),
      () => now,
    ).buildBrief({ record, manifest, expectedSteps: [] });
    check(
      "focused_corpus_has_zero_silent_candidate_drops_under_default_bounds",
      focusedCorpus.payload.coverage.candidates >= 6
        && focusedCorpus.payload.coverage.silentlyDropped === 0
        && focusedCorpus.payload.coverage.recognizedOrExplicitUnknownRatio >= 0.99
        && focusedCorpus.payload.coverage.met === true,
      focusedCorpus.payload.coverage,
    );

    const noise = "later bounded noise\n".repeat(40_000);
    fs.appendFileSync(selectedPath, noise, "utf8");
    const afterNoise = adapter.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: [] });
    const restarted = createAdapter(adapterRoot, () => selectedPath, () => profile, inventory, () => now);
    const afterRestart = restarted.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: [] });
    const retained = afterRestart.payload.incidents.some(incident => incident.classification === "direct_extension_fault" && incident.isEngineFailure === true);
    check(">256KiB_noise_retains_failure_after_restart", afterNoise.payload.session?.newlyReadBytes !== undefined && retained, { newlyRead: afterNoise.payload.session.newlyReadBytes, incidents: afterRestart.payload.incidents.length });

    appendLine(selectedPath, authoredOwnedPathLine());
    const taggedOwnedPath = adapter.buildBrief({ record, manifest, expectedSteps: [] });
    const taggedOwnedIncident = taggedOwnedPath.payload.incidents.find(incident => incident.evidence.some(value => value.includes("AICHTTP")) || incident.classification === "authored_diagnostic");
    check(
      "tagged_owned_path_is_authored_diagnostic_not_engine_failure",
      Boolean(taggedOwnedIncident?.classification === "authored_diagnostic" && taggedOwnedIncident.isEngineFailure === false && taggedOwnedIncident.severity === "info"),
      taggedOwnedIncident,
    );

    // Simulate a valid 0.0.67-style derived document: a stale runtime envelope,
    // an unrelated non-runtime record, and cumulative pre-policy drops.  The
    // next adapter instance must replay the source log under policy 2, retain
    // unrelated data, and measure only post-policy drops for coverage/health.
    const migrationWorkspace = "ws_runtime_policy_migration";
    const migrationPath = path.join(root, "policy-migration.log");
    fs.writeFileSync(migrationPath, `${directFailureLine("25.0")}\n`, "utf8");
    const migrationRoot = path.join(root, "policy-migration-store");
    const migrationStore = new RuntimeDebugSessionStore({ root: migrationRoot });
    const migrationOpen = migrationStore.open({ workspaceId: migrationWorkspace, logPath: migrationPath, profileId: profile, baselineOffset: 0, baselineLineNumber: 0 });
    if (migrationOpen.ok) {
      migrationStore.recordIncidents({
        workspaceId: migrationWorkspace,
        incidents: [{
          key: "legacy-wrong-runtime-attribution",
          summary: "legacy attribution retained by public 0.0.67",
          classification: "direct_extension_fault",
          severity: "warning",
          reason: "legacy analyzer policy",
          attributes: {
            runtimeInternal: "runtime",
            runtimeKind: "direct_extension_fault",
            isEngineFailure: false,
            attribution: JSON.stringify({ disposition: "unknown", reason: "legacy policy" }),
          },
        }, {
          key: "unrelated-derived-record",
          summary: "unrelated derived record must remain retained",
          classification: "other-derived-data",
          severity: "info",
          attributes: { runtimeInternal: "other-derived-data" },
        }],
      });
      const migrationPathOnDisk = migrationStore.storagePathFor(migrationWorkspace);
      const migrationDocument = JSON.parse(fs.readFileSync(migrationPathOnDisk, "utf8")) as { dropped?: Record<string, number> };
      migrationDocument.dropped = { ...(migrationDocument.dropped || {}), incidents: 55 };
      fs.writeFileSync(migrationPathOnDisk, JSON.stringify(migrationDocument), "utf8");
    }
    const migrationRecord = { ...record, workspaceId: migrationWorkspace };
    const migrationAdapter = createAdapter(
      migrationRoot,
      () => migrationPath,
      () => profile,
      () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [otherExtensionFixture()] }),
      () => now,
      { store: migrationStore },
    );
    const migrated = migrationAdapter.buildBrief({ record: migrationRecord, manifest, expectedSteps: [] });
    const migratedDirect = migrated.payload.incidents.find(incident => incident.classification === "direct_extension_fault");
    const migratedSnapshot = migrationStore.readSnapshot(migrationWorkspace);
    const migrationMarker = migratedSnapshot.ok
      ? migratedSnapshot.snapshot.incidents.find(incident => incident.key === "__forge_runtime_analyzer_policy__")
      : undefined;
    check(
      "policy_migration_reanalyzes_old_state_and_resets_coverage_drop_baseline",
      migrationOpen.ok
        && Boolean(migratedDirect?.attribution.disposition === "confirmed_active" && migratedDirect.isEngineFailure === true)
        && migrated.payload.coverage.met === true
        && migratedSnapshot.ok
        && migratedSnapshot.snapshot.health === "ready"
        && migratedSnapshot.snapshot.dropped.incidents === 55
        && migrationMarker?.attributes.policyBaselineDroppedIncidents === 55
        && migratedSnapshot.snapshot.incidents.some(incident => incident.key === "unrelated-derived-record"),
      { verdict: migrated.payload.verdict, coverage: migrated.payload.coverage, snapshot: migratedSnapshot, direct: migratedDirect },
    );
    const migrationSegments = migratedSnapshot.ok ? migratedSnapshot.snapshot.segments.length : -1;
    const migrationRestart = createAdapter(
      migrationRoot,
      () => migrationPath,
      () => profile,
      () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [otherExtensionFixture()] }),
      () => now,
      { store: new RuntimeDebugSessionStore({ root: migrationRoot }) },
    ).buildBrief({ record: migrationRecord, manifest, expectedSteps: [] });
    check(
      "policy_migration_marker_survives_restart_without_replaying_again",
      migrationRestart.payload.incidents.some(incident => incident.classification === "direct_extension_fault" && incident.attribution.disposition === "confirmed_active")
        && migrationRestart.payload.coverage.met === true
        && migrationRestart.payload.session?.sessionId !== undefined
        && (migrationStore.readSnapshot(migrationWorkspace).ok ? migrationStore.readSnapshot(migrationWorkspace).snapshot.segments.length : -1) === migrationSegments,
      { coverage: migrationRestart.payload.coverage, session: migrationRestart.payload.session },
    );
    const alphabeticNoiseId = (value: number): string => {
      let remaining = value;
      let result = "";
      do {
        result = String.fromCharCode(97 + (remaining % 26)) + result;
        remaining = Math.floor(remaining / 26) - 1;
      } while (remaining >= 0);
      return result;
    };
    fs.appendFileSync(migrationPath, Array.from({ length: 300 }, (_, index) => `[=ERROR=] ${26 + index}.0 Fatal failure in post-policy noise ${alphabeticNoiseId(index)}`).join("\n") + "\n", "utf8");
    const postPolicyDrops = createAdapter(
      migrationRoot,
      () => migrationPath,
      () => profile,
      () => ({ complete: true, scannedAt: new Date(now).toISOString(), extensions: [otherExtensionFixture()] }),
      () => now,
      { store: new RuntimeDebugSessionStore({ root: migrationRoot }) },
    ).buildBrief({ record: migrationRecord, manifest, expectedSteps: [] });
    check(
      "post_policy_drops_remain_explicit_and_fail_honest",
      postPolicyDrops.payload.coverage.met === false
        && postPolicyDrops.payload.coverage.silentlyDropped > 0
        && postPolicyDrops.payload.incidents.some(incident => incident.classification === "direct_extension_fault" && incident.attribution.disposition === "confirmed_active"),
      { coverage: postPolicyDrops.payload.coverage, incidents: postPolicyDrops.payload.incidents.length },
    );
    check(
      "response_cap_runs_after_priority_and_hides_unrelated_incidents",
      postPolicyDrops.payload.incidents.length <= 64
        && postPolicyDrops.payload.incidents[0]?.classification === "direct_extension_fault"
        && postPolicyDrops.payload.incidents[0]?.attribution.disposition === "confirmed_active"
        && postPolicyDrops.payload.incidents.every(incident => incident.attribution.disposition !== "excluded_other_mod"),
      postPolicyDrops.payload.incidents.slice(0, 3),
    );

    const baseline = adapter.recordSuccessfulDeploy(WORKSPACE_ID, DEPLOY_INFO);
    check("successful_deploy_creates_current_eof_baseline", baseline.ok && baseline.snapshot.baselineTokens.length === 1 && baseline.snapshot.currentSegmentId.length > 0, baseline.ok ? baseline.snapshot : baseline);
    const immediate = adapter.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: expectedInputFromLegacy(["marker:AICHAT"]) });
    check("immediate_eof_baseline_reports_no_post_deploy_change", immediate.payload.session.state === "current" && immediate.changedSinceDeploy === false, immediate.payload.session);
    const segmentsBeforeRetry = baseline.ok ? baseline.snapshot.segments.length : -1;
    appendLine(selectedPath, authoredMarkerLine());
    const retryAfterGrowth = adapter.recordSuccessfulDeploy(WORKSPACE_ID, DEPLOY_INFO);
    check("same_token_retry_after_log_growth_is_idempotent", retryAfterGrowth.ok && retryAfterGrowth.snapshot.segments.length === segmentsBeforeRetry && retryAfterGrowth.snapshot.baselineTokens.length === 1, retryAfterGrowth.ok ? retryAfterGrowth.snapshot : retryAfterGrowth);
    const withMarker = adapter.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: expectedInputFromLegacy(["marker:AICHAT"]) });
    check("post_baseline_bytes_set_durable_freshness", withMarker.changedSinceDeploy === true && withMarker.payload.expectedSteps[0]?.truth === "observed", { changed: withMarker.changedSinceDeploy, expected: withMarker.payload.expectedSteps });
    const zeroPoll = adapter.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: expectedInputFromLegacy(["marker:AICHAT"]) });
    const restartAfterBytes = restarted.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: expectedInputFromLegacy(["marker:AICHAT"]) });
    check("zero_byte_poll_and_restart_retain_post_baseline_freshness", zeroPoll.newlyReadBytes === 0 && zeroPoll.changedSinceDeploy === true && restartAfterBytes.changedSinceDeploy === true, { zero: zeroPoll.changedSinceDeploy, restart: restartAfterBytes.changedSinceDeploy });

    appendLine(selectedPath, fileIoLine());
    appendLine(selectedPath, unrelatedLine());
    appendLine(selectedPath, bareCollisionLine());
    const excluded = adapter.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: [] });
    const visibleOther = excluded.payload.incidents.some(incident => incident.attribution.disposition === "excluded_other_mod");
    const ambiguous = excluded.payload.incidents.find(incident => incident.attribution.disposition === "ambiguous");
    const fileIo = excluded.payload.incidents.find(incident => incident.classification === "file_io");
    check("unrelated_incidents_hidden_to_bounded_count", !visibleOther && excluded.payload.hiddenOtherModCount > 0 && excluded.payload.hiddenOtherModCount <= 1_000_000_000, { hidden: excluded.payload.hiddenOtherModCount, incidents: excluded.payload.incidents });
    check("ambiguous_collision_remains_unresolved_without_navigation", Boolean(ambiguous && ambiguous.mapping.kind !== "node" && excluded.payload.ambiguousCount > 0), { ambiguous, incidents: excluded.payload.incidents.map(incident => ({ classification: incident.classification, disposition: incident.attribution.disposition, mapping: incident.mapping })) });
    check("file_io_signature_is_not_engine_failure", Boolean(fileIo && fileIo.isEngineFailure === false && fileIo.severity !== "error"), fileIo);

    const cleanWorkspace = { ...record, workspaceId: "ws_runtime_clean" };
    const cleanDeploy = { ...DEPLOY_INFO, workspaceId: "ws_runtime_clean" };
    const cleanBaseline = adapter.recordSuccessfulDeploy("ws_runtime_clean", cleanDeploy);
    appendLine(selectedPath, authoredMarkerLine("30.0"));
    const clean = adapter.buildBrief({ record: cleanWorkspace, manifest, modId: "x4_ailive", deployInfo: cleanDeploy, expectedSteps: expectedInputFromLegacy(["marker:AICHAT"]) });
    check("authored_marker_is_not_red_and_clean_is_not_proof", cleanBaseline.ok && clean.payload.verdict.state === "loaded_clean" && clean.payload.verdict.detail.includes("no attributed failures observed") && clean.payload.incidents.every(incident => incident.isEngineFailure !== true), { baseline: cleanBaseline, verdict: clean.payload.verdict, session: clean.payload.session, incidents: clean.payload.incidents });

    const zeroWorkspace = { ...record, workspaceId: "ws_runtime_zero" };
    const zeroDeploy = { ...DEPLOY_INFO, workspaceId: "ws_runtime_zero" };
    const zeroBaseline = adapter.recordSuccessfulDeploy("ws_runtime_zero", zeroDeploy);
    const empty = adapter.buildBrief({ record: zeroWorkspace, manifest, modId: "x4_ailive", deployInfo: zeroDeploy, expectedSteps: expectedInputFromLegacy(["marker:never_seen"]) });
    check("zero_candidates_are_not_clean", zeroBaseline.ok && empty.payload.verdict.state === "not_seen" && empty.payload.coverage.candidates === 0 && empty.payload.coverage.met === false, empty.payload);
    const noLog = createAdapter(path.join(root, "no-log-store"), () => path.join(root, "missing-debuglog.txt"), () => profile, inventory, () => now).buildBrief({ record: cleanWorkspace, manifest, expectedSteps: expectedInputFromLegacy(["marker:missing"]) });
    check("unavailable_log_is_not_clean_and_expected_is_unavailable", noLog.payload.session.state === "unavailable" && noLog.payload.verdict.state === "no_log" && noLog.payload.expectedSteps[0]?.truth === "unavailable", noLog.payload);

    const corruptAdapter = createAdapter(path.join(root, "corrupt-store"), () => selectedPath, () => profile, inventory, () => now);
    const corruptPath = corruptAdapter.store.storagePathFor(WORKSPACE_ID);
    fs.mkdirSync(path.dirname(corruptPath), { recursive: true });
    fs.writeFileSync(corruptPath, "{not-json", "utf8");
    const corrupt = corruptAdapter.buildBrief({ record, manifest, expectedSteps: [] });
    check("corrupt_state_is_honestly_unavailable", corrupt.payload.session.state === "unavailable" && corrupt.payload.verdict.state !== "loaded_clean", corrupt.payload);

    const capped = adapter.buildBrief({ record, manifest, modId: "x4_ailive", expectedSteps: expectedInputFromLegacy(Array.from({ length: 80 }, (_, index) => `marker:step-${index}`)) });
    check("response_caps_and_additive_shape_are_bounded", capped.payload.incidents.length <= 64 && capped.payload.expectedSteps.length <= 32 && capped.payload.schemaVersion === 1 && "authority" in capped.payload && "session" in capped.payload && "coverage" in capped.payload, { incidents: capped.payload.incidents.length, expected: capped.payload.expectedSteps.length });

    profile = "profile-b";
    adapter.buildBrief({ record, manifest, expectedSteps: [] });
    selectedPath = path.join(root, "rotated-debuglog.txt");
    fs.writeFileSync(selectedPath, `${authoredMarkerLine("40.0")}\n`, "utf8");
    adapter.buildBrief({ record, manifest, expectedSteps: [] });
    fs.writeFileSync(selectedPath, "x\n", "utf8");
    adapter.buildBrief({ record, manifest, expectedSteps: [] });
    const adapterBoundaries = adapter.store.readSnapshot(WORKSPACE_ID);
    const adapterReasons = adapterBoundaries.ok ? adapterBoundaries.snapshot.segments.map(segment => segment.reason) : [];
    check("adapter_profile_and_path_changes_remain_bounded", adapterReasons.includes("profile-change") && adapterReasons.includes("selected-path-change") && adapterReasons.includes("truncation"), adapterReasons);

    runBoundedStoreChecks(root, checks);
  } catch (error) {
    check("adapter_selftest_execution", false, error instanceof Error ? error.stack || error.message : String(error));
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* scratch only */ }
  }
  const passed = checks.filter(item => item.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}

if (path.basename(process.argv[1] ?? "") === "runtimeDebuggerAdapter.selftest.ts") {
  const result = runRuntimeDebuggerAdapterSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
