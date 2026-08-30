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

const editBoxProgramFixture = (lines: readonly string[]): string => [
  "local menu = { name = 'B119' }",
  "local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })",
  "local table = frame:addTable(2, { width = 2, height = 20, scaling = false })",
  "local row = table:addRow(nil, { borderBelow = false, scaling = false })",
  ...lines,
  "frame:display()",
  "OpenMenu('B119', nil, nil, true)",
  "",
].join("\n");

const editBoxFixture = (call: string): string => editBoxProgramFixture([`row[1]:${call}`]);

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

    const omittedPath = "ui/pipeline_test.lua";
    const omitted = runProjectValidation(projectFor(omittedPath, editBoxFixture("createEditBox()")));
    const omittedFlat = flattenProjectValidation(omitted);
    const omittedFindings = targetFindings(omittedFlat, "x4-ui.editbox-height-minimum", omittedPath);
    const omittedFinding = omittedFindings[0];
    const omittedMapped = mapFlatFindings(omittedFindings, ["content.xml", omittedPath]).byFile.get(omittedPath) || [];
    const omittedDiagnostic = omittedMapped[0];
    check(
      "omitted_editbox_height_is_one_nonblocking_project_warning",
      omitted.ok
        && omittedFindings.length === 1
        && omittedFinding?.severity === "warning"
        && omittedFinding.line === 5
        && /known zero-height overlap failure/i.test(omittedFinding.message)
        && /in-game/i.test(omittedFinding.message),
      omittedFindings,
    );
    check(
      "omitted_editbox_height_problems_mapping_preserves_parity",
      omittedMapped.length === 1
        && omittedDiagnostic?.relPath === omittedPath
        && omittedDiagnostic.line === 4
        && omittedDiagnostic.severity === "warning"
        && omittedDiagnostic.code === "x4-ui.editbox-height-minimum"
        && omittedDiagnostic.message === omittedFinding?.message,
      omittedDiagnostic,
    );

    const zeroPath = "ui/pipeline_zero_height.lua";
    const zero = runProjectValidation(projectFor(zeroPath, editBoxFixture("createEditBox({ height = 0 })")));
    const zeroFlat = flattenProjectValidation(zero);
    const zeroFindings = targetFindings(zeroFlat, "x4-ui.editbox-height-minimum", zeroPath);
    const zeroFinding = zeroFindings[0];
    const zeroMapped = mapFlatFindings(zeroFindings, ["content.xml", zeroPath]).byFile.get(zeroPath) || [];
    const zeroDiagnostic = zeroMapped[0];
    check(
      "literal_zero_editbox_height_is_one_blocking_project_error",
      !zero.ok
        && zeroFindings.length === 1
        && zeroFinding?.severity === "error"
        && zeroFinding.line === 5,
      zeroFindings,
    );
    check(
      "literal_zero_editbox_height_problems_mapping_preserves_parity",
      zeroMapped.length === 1
        && zeroDiagnostic?.relPath === zeroPath
        && zeroDiagnostic.line === 4
        && zeroDiagnostic.severity === "error"
        && zeroDiagnostic.code === "x4-ui.editbox-height-minimum"
        && zeroDiagnostic.message === zeroFinding?.message,
      zeroDiagnostic,
    );

    const simpleDefaultPath = "ui/pipeline_default_height.lua";
    const simpleDefault = runProjectValidation(projectFor(simpleDefaultPath, editBoxProgramFixture([
      'table:setDefaultCellProperties("editbox", { height = 24, scaling = false })',
      'row[1]:createEditBox({})',
    ])));
    const simpleDefaultFlat = flattenProjectValidation(simpleDefault);
    const simpleDefaultFindings = targetFindings(simpleDefaultFlat, "x4-ui.editbox-height-minimum", simpleDefaultPath);
    const simpleDefaultMapped = mapFlatFindings(simpleDefaultFindings, ["content.xml", simpleDefaultPath]).byFile.get(simpleDefaultPath) || [];
    check(
      "positive_simple_table_default_is_clean_in_project_validation",
      simpleDefault.ok && simpleDefaultFindings.length === 0 && simpleDefaultMapped.length === 0,
      { flat: simpleDefaultFindings, mapped: simpleDefaultMapped },
    );

    const complexDefaultPath = "ui/pipeline_default_hotkey.lua";
    const complexDefault = runProjectValidation(projectFor(complexDefaultPath, editBoxProgramFixture([
      'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "DEFAULT", displayIcon = true })',
      'row[1]:createEditBox({ height = 0 })',
    ])));
    const complexDefaultFlat = flattenProjectValidation(complexDefault);
    const complexDefaultFindings = targetFindings(complexDefaultFlat, "x4-ui.editbox-height-minimum", complexDefaultPath);
    const complexDefaultMapped = mapFlatFindings(complexDefaultFindings, ["content.xml", complexDefaultPath]).byFile.get(complexDefaultPath) || [];
    check(
      "positive_complex_hotkey_default_is_clean_in_project_validation",
      complexDefault.ok && complexDefaultFindings.length === 0 && complexDefaultMapped.length === 0,
      { flat: complexDefaultFindings, mapped: complexDefaultMapped },
    );

    const displayedZeroPath = "ui/pipeline_displayed_zero.lua";
    const displayedZero = runProjectValidation(projectFor(displayedZeroPath, editBoxProgramFixture([
      'local edit = row[1]:createEditBox({ height = 0 })',
      'edit:setHotkey("DISPLAYED", { displayIcon = true })',
    ])));
    const displayedZeroFlat = flattenProjectValidation(displayedZero);
    const displayedZeroFindings = targetFindings(displayedZeroFlat, "x4-ui.editbox-height-minimum", displayedZeroPath);
    const displayedZeroMapped = mapFlatFindings(displayedZeroFindings, ["content.xml", displayedZeroPath]).byFile.get(displayedZeroPath) || [];
    check(
      "positive_direct_displayed_zero_is_clean_in_project_and_problems",
      displayedZero.ok && displayedZeroFindings.length === 0 && displayedZeroMapped.length === 0,
      { flat: displayedZeroFindings, mapped: displayedZeroMapped },
    );

    const sourceProvenChainPath = "ui/pipeline_source_proven_chain.lua";
    const sourceProvenChain = runProjectValidation(projectFor(sourceProvenChainPath, [
      "local table = getTable()",
      "local row = table:addRow()",
      "row[1]:setColSpan(1):createEditBox({}):setText('EDIT', {}):setHotkey('CHAIN', { displayIcon = true })",
      "",
    ].join("\n")));
    const sourceProvenChainFlat = flattenProjectValidation(sourceProvenChain);
    const sourceProvenChainHeight = targetFindings(sourceProvenChainFlat, "x4-ui.editbox-height-minimum", sourceProvenChainPath);
    const sourceProvenChainHotkeyGaps = targetFindings(sourceProvenChainFlat, "x4-ui.verification-gap", sourceProvenChainPath)
      .filter(finding => /displayed-hotkey|hotkey or displayIcon/i.test(finding.message));
    const sourceProvenChainMapped = mapFlatFindings(sourceProvenChainHeight, ["content.xml", sourceProvenChainPath]).byFile.get(sourceProvenChainPath) || [];
    check(
      "source_proven_non_static_chain_is_clean_in_project_and_problems",
      sourceProvenChain.ok
        && sourceProvenChainHeight.length === 0
        && sourceProvenChainHotkeyGaps.length === 0
        && sourceProvenChainMapped.length === 0,
      { height: sourceProvenChainHeight, hotkeyGaps: sourceProvenChainHotkeyGaps, mapped: sourceProvenChainMapped },
    );

    const sourceProvenButtonPath = "ui/pipeline_source_proven_button_chain.lua";
    const sourceProvenButton = runProjectValidation(projectFor(sourceProvenButtonPath, [
      "local table = getTable()",
      "local row = table:addRow()",
      "row[1]:createButton({ height = 25 }):setText('BUTTON', {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })",
      "row[2]:createEditBox({})",
      "",
    ].join("\n")));
    const sourceProvenButtonFlat = flattenProjectValidation(sourceProvenButton);
    const sourceProvenButtonHeight = targetFindings(sourceProvenButtonFlat, "x4-ui.editbox-height-minimum", sourceProvenButtonPath);
    const sourceProvenButtonHotkeyGaps = targetFindings(sourceProvenButtonFlat, "x4-ui.verification-gap", sourceProvenButtonPath)
      .filter(finding => /displayed-hotkey|hotkey or displayIcon/i.test(finding.message));
    check(
      "source_proven_button_chain_does_not_contaminate_editbox_project_validation",
      sourceProvenButton.ok
        && sourceProvenButtonHeight.length === 1
        && sourceProvenButtonHeight[0]?.severity === "warning"
        && sourceProvenButtonHotkeyGaps.length === 0,
      { height: sourceProvenButtonHeight, hotkeyGaps: sourceProvenButtonHotkeyGaps },
    );

    const branchMergedButtonPath = "ui/pipeline_branch_merged_button_chain.lua";
    const branchMergedButton = runProjectValidation(projectFor(branchMergedButtonPath, [
      "local table = getTable()",
      "local row = table:addRow()",
      "if mode then",
      "  row = table:addRow()",
      "end",
      "row[1]:createButton({ height = 25 }):setText('BUTTON', {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })",
      "",
    ].join("\n")));
    const branchMergedButtonFlat = flattenProjectValidation(branchMergedButton);
    const branchMergedButtonHotkeyGaps = targetFindings(
      branchMergedButtonFlat,
      "x4-ui.verification-gap",
      branchMergedButtonPath,
    ).filter(finding => /edit-box|displayed-hotkey|hotkey or displayIcon/i.test(finding.message));
    check(
      "branch_merged_button_chain_does_not_contaminate_editbox_project_validation",
      branchMergedButton.ok && branchMergedButtonHotkeyGaps.length === 0,
      { hotkeyGaps: branchMergedButtonHotkeyGaps },
    );

    const conditionalSourceProvenChainPath = "ui/pipeline_conditional_source_proven_chain.lua";
    const conditionalSourceProvenChain = runProjectValidation(projectFor(
      conditionalSourceProvenChainPath,
      editBoxProgramFixture([
        "if mode then",
        "  row[1]:setColSpan(1):createEditBox({ height = 0 }):setText('EDIT', {}):setHotkey('CHAIN', { displayIcon = true })",
        "end",
      ]),
    ));
    const conditionalSourceProvenChainFlat = flattenProjectValidation(conditionalSourceProvenChain);
    const conditionalSourceProvenChainHeight = targetFindings(
      conditionalSourceProvenChainFlat,
      "x4-ui.editbox-height-minimum",
      conditionalSourceProvenChainPath,
    );
    const conditionalSourceProvenChainHotkeyGaps = targetFindings(
      conditionalSourceProvenChainFlat,
      "x4-ui.verification-gap",
      conditionalSourceProvenChainPath,
    ).filter(finding => /displayed-hotkey|hotkey or displayIcon/i.test(finding.message));
    check(
      "conditional_source_proven_editbox_chain_is_clean_in_project_and_problems",
      conditionalSourceProvenChain.ok
        && conditionalSourceProvenChainHeight.length === 0
        && conditionalSourceProvenChainHotkeyGaps.length === 0,
      { height: conditionalSourceProvenChainHeight, hotkeyGaps: conditionalSourceProvenChainHotkeyGaps },
    );

    const conditionalSourceProvenButtonPath = "ui/pipeline_conditional_source_proven_button.lua";
    const conditionalSourceProvenButton = runProjectValidation(projectFor(
      conditionalSourceProvenButtonPath,
      editBoxProgramFixture([
        "row[2]:createEditBox({})",
        "if mode then",
        "  row[1]:createButton({ height = 25 }):setIcon('ICON'):setHotkey('BUTTON', { displayIcon = true })",
        "end",
      ]),
    ));
    const conditionalSourceProvenButtonFlat = flattenProjectValidation(conditionalSourceProvenButton);
    const conditionalSourceProvenButtonHeight = targetFindings(
      conditionalSourceProvenButtonFlat,
      "x4-ui.editbox-height-minimum",
      conditionalSourceProvenButtonPath,
    );
    const conditionalSourceProvenButtonHotkeyGaps = targetFindings(
      conditionalSourceProvenButtonFlat,
      "x4-ui.verification-gap",
      conditionalSourceProvenButtonPath,
    ).filter(finding => /displayed-hotkey|hotkey or displayIcon/i.test(finding.message));
    check(
      "conditional_source_proven_button_setIcon_chain_leaves_one_omission_warning",
      conditionalSourceProvenButton.ok
        && conditionalSourceProvenButtonHeight.length === 1
        && conditionalSourceProvenButtonHeight[0]?.severity === "warning"
        && conditionalSourceProvenButtonHotkeyGaps.length === 0,
      { height: conditionalSourceProvenButtonHeight, hotkeyGaps: conditionalSourceProvenButtonHotkeyGaps },
    );

    const dynamicDefaultPath = "ui/pipeline_dynamic_default.lua";
    const dynamicDefault = runProjectValidation(projectFor(dynamicDefaultPath, editBoxProgramFixture([
      'table:setDefaultCellProperties("editbox", { height = getHeight() })',
      'row[1]:createEditBox({})',
    ])));
    const dynamicDefaultFlat = flattenProjectValidation(dynamicDefault);
    const dynamicDefaultWarnings = targetFindings(dynamicDefaultFlat, "x4-ui.editbox-height-minimum", dynamicDefaultPath);
    const dynamicDefaultGaps = targetFindings(dynamicDefaultFlat, "x4-ui.verification-gap", dynamicDefaultPath);
    const dynamicDefaultMapped = mapFlatFindings(dynamicDefaultWarnings, ["content.xml", dynamicDefaultPath]).byFile.get(dynamicDefaultPath) || [];
    check(
      "dynamic_relevant_default_is_nonblocking_but_not_silent",
      dynamicDefault.ok
        && dynamicDefaultWarnings.length === 1
        && dynamicDefaultWarnings[0]?.severity === "warning"
        && dynamicDefaultGaps.length >= 1
        && dynamicDefaultMapped.length === 1
        && dynamicDefaultMapped[0]?.code === "x4-ui.editbox-height-minimum",
      { warnings: dynamicDefaultWarnings, gaps: dynamicDefaultGaps, mapped: dynamicDefaultMapped },
    );

    const irrelevantButtonPath = "ui/pipeline_irrelevant_button.lua";
    const irrelevantButton = runProjectValidation(projectFor(irrelevantButtonPath, editBoxProgramFixture([
      'table:setDefaultCellProperties("button", { height = getHeight(), scaling = getScaling() })',
      'table:setDefaultComplexCellProperties("editbox", "caption", { hotkey = getHotkey(), displayIcon = getDisplayIcon() })',
      'local button = row[1]:createButton({ height = 25, scaling = false, affectRowHeight = false })',
      'button:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      'row[2]:createEditBox({ height = 12, scaling = false })',
    ])));
    const irrelevantButtonFlat = flattenProjectValidation(irrelevantButton);
    const irrelevantButtonFindings = irrelevantButtonFlat.filter(finding => finding.filePath === irrelevantButtonPath
      && (finding.code === "x4-ui.editbox-height-minimum" || finding.code === "x4-ui.verification-gap"));
    const irrelevantButtonMapped = mapFlatFindings(
      irrelevantButtonFindings,
      ["content.xml", irrelevantButtonPath],
    ).byFile.get(irrelevantButtonPath) || [];
    check(
      "dynamic_button_defaults_and_hotkey_are_clean_in_project_and_problems",
      irrelevantButton.ok && irrelevantButtonFindings.length === 0 && irrelevantButtonMapped.length === 0,
      { flat: irrelevantButtonFindings, mapped: irrelevantButtonMapped },
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
