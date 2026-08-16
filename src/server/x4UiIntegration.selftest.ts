import { flattenProjectValidation, runProjectValidation } from "./projectValidation";
import { mapFlatFindings } from "../../vscode-extension/src/diagnosticsMap";

type Check = { name: string; pass: boolean; detail?: string };

const CONTENT_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<content id="b119-ui-integration-selftest" name="B119 UI integration selftest" description="Deterministic selftest" author="OpenAI" version="1.0" date="2026-08-10" />',
  "",
].join("\n");

const addTableFixture = (expression: string): string => [
  "local menu = { name = 'B119' }",
  "local frame = Helper.createFrameHandle(menu, {})",
  `local table = frame:addTable(${expression})`,
  "OpenMenu('B119', nil, nil, true)",
  "",
].join("\n");

const projectFor = (luaPath: string, luaText: string) => ({
  id: "b119-ui-integration-selftest",
  name: "B119 UI integration selftest",
  files: [
    { path: "content.xml", kind: "content", content: CONTENT_XML },
    { path: luaPath, kind: "lua", content: luaText },
  ],
} as Parameters<typeof runProjectValidation>[0]);

const targetFindings = (flat: ReturnType<typeof flattenProjectValidation>, code: string, filePath: string) =>
  flat.filter(finding => finding.code === code && finding.filePath === filePath);

export function runX4UiIntegrationSelftest(): { pass: boolean; checks: Check[] } {
  const checks: Check[] = [];
  const check = (name: string, pass: boolean, detail?: unknown) => checks.push({
    name,
    pass,
    ...(detail === undefined ? {} : { detail: String(detail) }),
  });

  try {
    const fatalPath = "ui/too_many_columns.lua";
    const fatal = runProjectValidation(projectFor(fatalPath, addTableFixture("24")));
    const fatalFlat = flattenProjectValidation(fatal);
    const fatalFindings = targetFindings(fatalFlat, "x4-ui.add-table-column-limit", fatalPath);
    const fatalFinding = fatalFindings[0];
    const fatalMapped = mapFlatFindings(fatalFindings, ["content.xml", fatalPath]).byFile.get(fatalPath) || [];
    const fatalDiagnostic = fatalMapped[0];
    const fatalMessage = fatalFinding?.message || "";

    check(
      "fatal_24_columns_is_one_error_at_flat_line_3",
      !fatal.ok
        && fatalFindings.length === 1
        && fatalFinding?.severity === "error"
        && fatalFinding.line === 3,
      fatalFindings,
    );
    check(
      "fatal_failure_mode_is_complete_and_whole_frame",
      /Failure mode: Engine refuses the ENTIRE frame: .+ Next action: /s.test(fatalMessage)
        && fatalMessage.includes("UI auto-reloads")
        && fatalMessage.includes("conversation-open symptom"),
      fatalMessage,
    );
    check(
      "fatal_mapping_preserves_lua_path_code_line_severity_message",
      fatalMapped.length === 1
        && fatalDiagnostic?.relPath === fatalPath
        && fatalDiagnostic.line === 2
        && fatalDiagnostic.severity === "error"
        && fatalDiagnostic.code === "x4-ui.add-table-column-limit"
        && fatalDiagnostic.message === fatalMessage,
      fatalDiagnostic,
    );

    const warningPath = "ui/thirteen_columns.lua";
    const warning = runProjectValidation(projectFor(warningPath, addTableFixture("13")));
    const warningFlat = flattenProjectValidation(warning);
    const warningFindings = targetFindings(warningFlat, "x4-ui.add-table-column-limit", warningPath);
    const warningFinding = warningFindings[0];
    const warningMapped = mapFlatFindings(warningFindings, ["content.xml", warningPath]).byFile.get(warningPath) || [];
    const warningDiagnostic = warningMapped[0];
    check(
      "warning_13_columns_is_nonblocking_and_contextual",
      warning.ok
        && warningFindings.length === 1
        && warningFinding?.severity === "warning"
        && warningFinding.line === 3
        && /in-game|context-dependent/i.test(warningFinding.message),
      warningFindings,
    );
    check(
      "warning_mapping_preserves_lua_path_line_and_severity",
      warningMapped.length === 1
        && warningDiagnostic?.relPath === warningPath
        && warningDiagnostic.line === 2
        && warningDiagnostic.severity === "warning"
        && warningDiagnostic.code === "x4-ui.add-table-column-limit"
        && warningDiagnostic.message === warningFinding?.message,
      warningDiagnostic,
    );

    const dynamicPath = "ui/dynamic_columns.lua";
    const dynamicLua = [
      "local menu = { name = 'B119' }",
      "local frame = Helper.createFrameHandle(menu, {})",
      "local count = getCount()",
      "local table = frame:addTable(count)",
      "OpenMenu('B119', nil, nil, true)",
      "",
    ].join("\n");
    const dynamic = runProjectValidation(projectFor(dynamicPath, dynamicLua));
    const dynamicFlat = flattenProjectValidation(dynamic);
    const dynamicFindings = targetFindings(dynamicFlat, "x4-ui.verification-gap", dynamicPath);
    const dynamicMapped = mapFlatFindings(dynamicFindings, ["content.xml", dynamicPath]).byFile.get(dynamicPath) || [];
    const dynamicDiagnostic = dynamicMapped[0];
    check(
      "dynamic_columns_are_one_nonblocking_verification_gap",
      dynamic.ok
        && dynamicFindings.length === 1
        && dynamicFindings[0]?.severity === "info"
        && dynamicFindings[0].line === 4
        && dynamicFindings[0].message.includes("Not statically verified"),
      dynamicFindings,
    );
    check(
      "dynamic_mapping_preserves_lua_path_line_and_info",
      dynamicMapped.length === 1
        && dynamicDiagnostic?.relPath === dynamicPath
        && dynamicDiagnostic.line === 3
        && dynamicDiagnostic.severity === "info"
        && dynamicDiagnostic.code === "x4-ui.verification-gap"
        && dynamicDiagnostic.message === dynamicFindings[0]?.message
        && !dynamicFlat.some(finding => finding.filePath === dynamicPath && (finding.severity === "error" || finding.severity === "warning")),
      dynamicDiagnostic,
    );
  } catch (error) {
    check("real_x4_ui_validation_flatten_mapping_chain_completed", false, error instanceof Error ? error.stack || error.message : error);
  }

  return { pass: checks.every(item => item.pass), checks };
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("x4UiIntegration.selftest.ts");

if (invokedDirectly) {
  const result = runX4UiIntegrationSelftest();
  console.log(`x4-ui integration selftest: ${result.checks.filter(check => check.pass).length}/${result.checks.length} allPassed=${result.pass}`);
  for (const item of result.checks) if (!item.pass) console.log("FAIL", item.name, item.detail || "");
  process.exit(result.pass ? 0 : 1);
}
