import { strict as assert } from 'node:assert';
import type { ModWorkspace, PassthroughFile } from '../types';
import {
  buildX4UiCallModel,
  type X4UiCallModel,
} from './x4UiCallModel';
import {
  createX4UiLayoutTargetCatalog,
  isIssuedX4UiLayoutEvidencePairForModel,
  projectX4UiLayoutProgram,
  type X4UiLayoutEvidenceAuthority,
  type X4UiLayoutProgram,
  type X4UiLayoutProjectionProfile,
} from './x4UiLayoutProgram';
import {
  HELPER_SOURCE_SHA256,
  WIDGET_SOURCE_SHA256,
  X4_LAYOUT_PROVENANCE,
} from './x4UiLayoutKernel';
import {
  buildX4UiWorkspaceSource,
  type X4UiWorkspaceSource,
} from './x4UiWorkspaceSource';
import {
  applyX4UiSourceEdit,
  applyX4UiSourceEditRequest,
  buildX4UiSourceEditCatalog,
  catalogX4UiSourceEdits,
  commitX4UiSourceEdit,
  discoverX4UiSourceEdits,
  encodeX4UiSourceEditReplacement,
  normalizeX4UiSourceEditLayoutModel,
  type X4UiEditableSourceEditEntry,
  type X4UiSourceEditCatalog,
  type X4UiSourceEditResult,
} from './x4UiSourceEdits';

interface Check {
  readonly name: string;
  readonly pass: boolean;
  readonly detail?: string;
}

interface SourceEditFixtureContext {
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly program: X4UiLayoutProgram;
  readonly evidenceAuthority: X4UiLayoutEvidenceAuthority;
}

interface PublicCallOutcome<T> {
  readonly threw: boolean;
  readonly value?: T;
  readonly error?: string;
}

const checks: Check[] = [];

const check = (name: string, pass: boolean, detail?: string): void => {
  checks.push({ name, pass, detail });
  assert.equal(pass, true, `${name}${detail ? `: ${detail}` : ''}`);
};

const uiXml = '<addon><environment type="menus"><file name="ui/edit.lua"/></environment></addon>';

const baseLua = [
  'local menu = { name = "Edit", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(1, { width = 80, scaling = false })',
  'local row = table:addRow(false, { scaling = false })',
  'row[1]:createText(\'old\\n"quote"\', { width = 20, scaling = true })',
  'frame:display()',
  '',
].join('\n');

const passthrough = (path: string, content?: string, extra: Partial<PassthroughFile> = {}): PassthroughFile => ({
  path,
  ...(content === undefined ? {} : { content }),
  ...extra,
});

const workspace = (lua: string, extra: Partial<ModWorkspace> = {}): ModWorkspace => ({
  id: 'source-edits-selftest',
  name: 'Source edits selftest',
  version: '1.0.0',
  author: 'Forge',
  description: 'B119 Batch 7B source edit fixture',
  nodes: [],
  links: [],
  uiWidgets: [],
  uiTheme: {
    backgroundColor: '#000000',
    borderColor: '#111111',
    accentColor: '#00ffff',
    opacity: 1,
    showIcons: true,
  },
  compileSettings: {
    md: false,
    ui: true,
    ai: false,
    library: false,
    translations: false,
    patches: false,
  },
  passthroughFiles: [
    passthrough('README.md', '# unchanged\n', { reason: 'unknown_domain' }),
    passthrough('ui.xml', uiXml, { reason: 'partial', bytes: uiXml.length }),
    passthrough('ui/edit.lua', lua, { reason: 'partial', bytes: lua.length }),
  ],
  ...extra,
} as ModWorkspace);

const pin = (value: number, lineStart: number, lineEnd = lineStart) => ({
  value,
  source: {
    sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath,
    lineStart,
    lineEnd,
  },
});

const profileFor = (model: ReturnType<typeof buildX4UiCallModel>): X4UiLayoutProjectionProfile => {
  const targetCatalog = createX4UiLayoutTargetCatalog(model);
  return {
    id: 'source-edits-profile',
    provenance: 'B119 source-edits selftest profile',
    truthGrade: 'captured',
    source: targetCatalog.sourceIdentity,
    frame: { width: 100, height: 80 },
    metrics: {
      uiScale: 1,
      borderSize: 1,
      scrollbarWidth: 12,
      standardContainerOffset: 2,
    },
    helper: {
      sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath,
      sha256: HELPER_SOURCE_SHA256,
      constants: {
        standardTextHeight: pin(16, 533),
        standardButtonHeight: pin(25, 522),
        viewWidth: pin(100, 707),
        viewHeight: pin(80, 708),
        borderSize: pin(1, 709),
      },
    },
    widget: {
      sourcePath: X4_LAYOUT_PROVENANCE.widgetSourcePath,
      sha256: WIDGET_SOURCE_SHA256,
    },
    defaults: {
      standardButtonHeight: pin(25, 522),
      minTextHeight: 7,
    },
  };
};

const contextFor = (lua = baseLua, extra: Partial<ModWorkspace> = {}): SourceEditFixtureContext => {
  const currentWorkspace = workspace(lua, extra);
  const currentSource = buildX4UiWorkspaceSource(currentWorkspace);
  if (!currentSource.bundle) throw new Error('source fixture did not build a bundle');
  const sourceFile = currentSource.bundle.sourceFiles.find(file => file.path === 'ui/edit.lua');
  if (!sourceFile) throw new Error('source fixture Lua file missing');
  const layoutModel = normalizeX4UiSourceEditLayoutModel(sourceFile.callModel);
  const target = createX4UiLayoutTargetCatalog(layoutModel).targets.find(candidate => candidate.kind === 'top-level');
  if (!target) throw new Error('source fixture top-level target missing');
  const result = projectX4UiLayoutProgram(layoutModel, target, profileFor(layoutModel));
  if (result.status === 'refused' || !result.program) throw new Error(`source fixture layout refused: ${JSON.stringify(result)}`);
  return {
    workspace: currentWorkspace,
    source: currentSource,
    program: result.program,
    evidenceAuthority: result.evidenceAuthority,
  };
};

const catalogFor = (context: SourceEditFixtureContext): X4UiSourceEditCatalog => discoverX4UiSourceEdits(
  context.workspace,
  context.source,
  context.program,
  context.evidenceAuthority,
);

const editableField = (
  catalog: X4UiSourceEditCatalog,
  type: X4UiEditableSourceEditEntry['valueType'],
  field: string,
  expectedText?: string,
  callName?: string,
): X4UiEditableSourceEditEntry => {
  const found = catalog.editableEntries.find(entry => entry.valueType === type
    && entry.provenance.fields.includes(field)
    && (expectedText === undefined || entry.expectedText === expectedText)
    && (callName === undefined || entry.provenance.callName === callName));
  if (!found) throw new Error(`editable ${type}/${field}/${expectedText || ''}/${callName || ''} missing: ${JSON.stringify(catalog)}`);
  return found;
};

const apply = (
  context: SourceEditFixtureContext,
  catalog: X4UiSourceEditCatalog,
  entry: X4UiEditableSourceEditEntry,
  value: string | number | boolean,
  expected?: { readonly path?: string; readonly startOffset?: number; readonly endOffset?: number; readonly expectedText?: string },
): X4UiSourceEditResult => applyX4UiSourceEdit(
  context.workspace,
  context.source,
  catalog,
  entry.id,
  value,
  expected?.path,
  expected?.startOffset,
  expected?.endOffset,
  expected?.expectedText,
);

const accepted = (result: X4UiSourceEditResult): Extract<X4UiSourceEditResult, { accepted: true }> => {
  if (!result.accepted) throw new Error(`expected accepted edit, got ${JSON.stringify(result)}`);
  return result;
};

const refused = (result: X4UiSourceEditResult): Extract<X4UiSourceEditResult, { accepted: false }> => {
  if (result.accepted === false) return result;
  throw new Error(`expected refused edit, got ${JSON.stringify(result)}`);
};

const sourceText = (context: { readonly source: X4UiWorkspaceSource }): string => {
  const text = context.source.bundle?.sourceFiles.find(file => file.path === 'ui/edit.lua')?.text;
  if (text === undefined) throw new Error('source fixture text missing');
  return text;
};

const workspaceBytes = (value: ModWorkspace): string => JSON.stringify(
  (value.passthroughFiles || []).map(file => ({
    path: file.path,
    content: file.content,
    bytes: file.bytes,
  })),
);

const applyById = (
  context: Pick<SourceEditFixtureContext, 'workspace' | 'source'>,
  catalog: X4UiSourceEditCatalog,
  entryId: string,
  value: string | number | boolean,
): X4UiSourceEditResult => applyX4UiSourceEdit(
  context.workspace,
  context.source,
  catalog,
  entryId,
  value,
);

const catalogWithEntry = (
  catalog: X4UiSourceEditCatalog,
  entryId: string,
  replacement: X4UiEditableSourceEditEntry,
  changes: Partial<X4UiSourceEditCatalog> = {},
): X4UiSourceEditCatalog => {
  const entries = catalog.entries.map(entry => entry.id === entryId ? replacement : entry);
  return {
    ...catalog,
    ...changes,
    entries,
    editableEntries: entries.filter((entry): entry is X4UiEditableSourceEditEntry => entry.kind === 'editable'),
    lockedEntries: entries.filter(entry => entry.kind === 'locked'),
  } as X4UiSourceEditCatalog;
};

const refusalPreservesInput = (
  result: X4UiSourceEditResult,
  context: Pick<SourceEditFixtureContext, 'workspace' | 'source'>,
  catalog: X4UiSourceEditCatalog,
  beforeBytes: string,
  beforeSource: string,
): boolean => !result.accepted
  && result.changed === false
  && result.workspace === context.workspace
  && result.source === context.source
  && result.catalog === catalog
  && workspaceBytes(context.workspace) === beforeBytes
  && sourceText(context) === beforeSource;

const contextWithCallModel = (
  context: SourceEditFixtureContext,
  callModel: X4UiCallModel,
): SourceEditFixtureContext => {
  if (!context.source.bundle) throw new Error('source fixture bundle missing');
  const sourceFiles = context.source.bundle.sourceFiles.map(file => file.path === 'ui/edit.lua'
    ? { ...file, callModel }
    : file);
  return {
    ...context,
    source: {
      ...context.source,
      bundle: {
        ...context.source.bundle,
        sourceFiles,
      },
    },
  };
};

const invokePublic = <T>(call: () => T): PublicCallOutcome<T> => {
  try {
    return { threw: false, value: call() };
  } catch (error) {
    return {
      threw: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const invokeDiscoveryBoundary = (
  workspaceValue: unknown,
  sourceValue: unknown,
  programValue: unknown,
  evidenceValue: unknown,
): PublicCallOutcome<X4UiSourceEditCatalog> => invokePublic(() => {
  // @ts-expect-error Deliberately exercise the runtime boundary with malformed positional inputs.
  return discoverX4UiSourceEdits(workspaceValue, sourceValue, programValue, evidenceValue);
});

const invokeApplyBoundary = (
  workspaceValue: unknown,
  sourceValue: unknown,
  catalogValue: unknown,
  entryIdValue: unknown,
  replacementValue: unknown,
  expectedPathValue: unknown = undefined,
  expectedStartValue: unknown = undefined,
  expectedEndValue: unknown = undefined,
  expectedTextValue: unknown = undefined,
): PublicCallOutcome<X4UiSourceEditResult> => invokePublic(() => {
  // @ts-expect-error Deliberately exercise the runtime boundary with malformed positional inputs.
  return applyX4UiSourceEdit(workspaceValue, sourceValue, catalogValue, entryIdValue, replacementValue, expectedPathValue, expectedStartValue, expectedEndValue, expectedTextValue);
});

const frozenClone = <T>(value: T): T => {
  const clone: T = structuredClone(value);
  const seen = new WeakSet<object>();
  const freeze = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== 'object' || seen.has(candidate)) return;
    seen.add(candidate);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(candidate))) {
      if ('value' in descriptor) freeze(descriptor.value);
    }
    Object.freeze(candidate);
  };
  freeze(clone);
  return clone;
};

interface TrapCounter {
  reads: number;
}

const hostileProxy = <T extends object>(target: T, counter: TrapCounter): T => new Proxy(target, {
  get(): never {
    counter.reads += 1;
    throw new Error('hostile proxy get trap executed');
  },
  getOwnPropertyDescriptor(): never {
    counter.reads += 1;
    throw new Error('hostile proxy descriptor trap executed');
  },
  getPrototypeOf(): never {
    counter.reads += 1;
    throw new Error('hostile proxy prototype trap executed');
  },
  has(): never {
    counter.reads += 1;
    throw new Error('hostile proxy has trap executed');
  },
  ownKeys(): never {
    counter.reads += 1;
    throw new Error('hostile proxy ownKeys trap executed');
  },
});

const ownUndefinedPaths = (
  value: unknown,
  path = 'model',
  seen = new WeakSet<object>(),
): readonly string[] => {
  if (value === null || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  const paths: string[] = [];
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (key === 'length' || !('value' in descriptor)) continue;
    const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    if (descriptor.value === undefined) paths.push(childPath);
    else paths.push(...ownUndefinedPaths(descriptor.value, childPath, seen));
  }
  return paths;
};

const normalizationMessage = (model: X4UiCallModel): string => {
  try {
    normalizeX4UiSourceEditLayoutModel(model);
    return 'accepted';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const run = (): void => {
  const initial = contextFor();
  const initialCatalog = catalogFor(initial);
  const positionalCatalogOutcome = invokePublic(() => discoverX4UiSourceEdits(
    initial.workspace,
    initial.source,
    initial.program,
    initial.evidenceAuthority,
  ));
  const positionalCountEntry = initialCatalog.editableEntries.find(entry => entry.provenance.callName === 'addTable'
    && entry.provenance.fields.includes('semantics.count'));
  if (!positionalCountEntry) throw new Error('positional fail-first count entry missing');
  const positionalApplyOutcome = invokePublic(() => applyX4UiSourceEdit(
    initial.workspace,
    initial.source,
    initialCatalog,
    positionalCountEntry.id,
    2,
  ));
  let positionalProxyReads = 0;
  const positionalWorkspaceProxy = new Proxy(initial.workspace, {
    get(): never {
      positionalProxyReads += 1;
      throw new Error('positional workspace proxy getter executed');
    },
    getPrototypeOf(): never {
      positionalProxyReads += 1;
      throw new Error('positional workspace proxy prototype trap executed');
    },
  });
  const positionalProxyOutcome = invokePublic(() => discoverX4UiSourceEdits(
    positionalWorkspaceProxy,
    initial.source,
    initial.program,
    initial.evidenceAuthority,
  ));
  const positionalFailFirst = {
    exactDiscovery: {
      threw: positionalCatalogOutcome.threw,
      status: positionalCatalogOutcome.value?.status,
      editable: positionalCatalogOutcome.value?.editable,
    },
    exactApply: {
      threw: positionalApplyOutcome.threw,
      accepted: positionalApplyOutcome.value?.accepted,
      changed: positionalApplyOutcome.value?.changed,
    },
    proxyDiscovery: {
      threw: positionalProxyOutcome.threw,
      status: positionalProxyOutcome.value?.status,
      reads: positionalProxyReads,
    },
  };
  console.log(`x4UiSourceEdits 7B-C positional fail-first: ${JSON.stringify(positionalFailFirst)}`);
  check('7B-C positional authority requires issued primitive boundaries before semantic inspection',
    positionalCatalogOutcome.threw === false
      && positionalCatalogOutcome.value?.status === 'ready'
      && positionalCatalogOutcome.value.editable
      && positionalApplyOutcome.threw === false
      && positionalApplyOutcome.value?.accepted === true
      && positionalApplyOutcome.value.changed
      && positionalProxyOutcome.threw === false
      && positionalProxyOutcome.value?.status === 'locked'
      && positionalProxyReads === 0,
    JSON.stringify(positionalFailFirst));
  check('accepted source/call/layout provenance yields editable scalar catalog',
    initialCatalog.status === 'ready'
      && initialCatalog.editableEntries.some(entry => entry.valueType === 'number')
      && initialCatalog.editableEntries.some(entry => entry.valueType === 'string')
      && initialCatalog.editableEntries.some(entry => entry.valueType === 'boolean'),
    JSON.stringify(initialCatalog.entries));
  check('catalog entries are frozen and source ranges match exact UTF-16 bytes',
    Object.isFrozen(initialCatalog)
      && initialCatalog.entries.every(entry => Object.isFrozen(entry))
      && initialCatalog.editableEntries.every(entry => entry.expectedText === sourceText(initial).slice(entry.startOffset, entry.endOffset)),
    JSON.stringify(initialCatalog.editableEntries));
  check('direct call insertion/deletion is absent from the public edit shape',
    !('insert' in initialCatalog) && !('delete' in initialCatalog) && initialCatalog.entries.every(entry => entry.kind === 'editable' || entry.kind === 'locked'));

  const numberContext = contextFor();
  const numberCatalog = catalogFor(numberContext);
  const numberEntry = editableField(numberCatalog, 'number', 'semantics.count', '1', 'addTable');
  const numberBefore = sourceText(numberContext);
  const numberResult = accepted(apply(numberContext, numberCatalog, numberEntry, 2));
  const numberAfter = sourceText(numberResult);
  check('number edit accepts finite replacement and reparses complete document',
    numberResult.changed
      && numberResult.reparsed
      && numberResult.provenanceReestablished
      && numberAfter === numberBefore.slice(0, numberEntry.startOffset) + '2' + numberBefore.slice(numberEntry.endOffset)
      && numberResult.entry.expectedText === '2',
    JSON.stringify(numberResult));
  check('number edit changes one exact source range and preserves all other passthrough bytes',
    numberResult.workspace.passthroughFiles?.[0] === numberContext.workspace.passthroughFiles?.[0]
      && numberResult.workspace.passthroughFiles?.[1] === numberContext.workspace.passthroughFiles?.[1]
      && numberResult.workspace.passthroughFiles?.[2] !== numberContext.workspace.passthroughFiles?.[2]
      && numberResult.source.projection?.uiXml === numberContext.source.projection?.uiXml
      && numberResult.source.projection?.luaFiles.filter((file, index) => file.text !== numberContext.source.projection?.luaFiles[index].text).length === 1);
  const secondEditEntry = editableField(
    numberResult.catalog,
    'boolean',
    'semantics.properties.scaling',
    'false',
    'addTable',
  );
  const secondEditResult = accepted(applyX4UiSourceEdit(
    numberResult.workspace,
    numberResult.source,
    numberResult.catalog,
    secondEditEntry.id,
    true,
  ));
  check('reparse-issued workspace/source/catalog authority remains usable for a second valid edit',
    secondEditResult.changed
      && secondEditResult.reparsed
      && secondEditResult.provenanceReestablished
      && sourceText(secondEditResult).includes('addTable(2, { width = 80, scaling = true })'),
    JSON.stringify(secondEditResult));

  const stringSingleContext = contextFor();
  const stringSingleCatalog = catalogFor(stringSingleContext);
  const stringSingle = editableField(stringSingleCatalog, 'string', 'arguments[0]', "'old\\n\"quote\"'", 'createText');
  const singleValue = "new 'single'\n\"double\" \\ path\tend";
  const stringSingleResult = accepted(apply(stringSingleContext, stringSingleCatalog, stringSingle, singleValue));
  check('single-quoted string preserves quote style, escapes quotes, slash, controls, and newline',
    stringSingleResult.replacement.startsWith("'")
      && stringSingleResult.replacement.endsWith("'")
      && stringSingleResult.replacement.includes("\\'single\\'")
      && stringSingleResult.replacement.includes('"double"')
      && stringSingleResult.replacement.includes('\\\\ path')
      && stringSingleResult.replacement.includes('\\n')
      && stringSingleResult.replacement.includes('\\t')
      && sourceText(stringSingleResult).slice(stringSingle.startOffset, stringSingleResult.entry.endOffset) === stringSingleResult.replacement,
    stringSingleResult.replacement);

  const doubleLua = baseLua.replace("'old\\n\"quote\"'", '"old \'quote\' \\\\ path"');
  const stringDoubleContext = contextFor(doubleLua);
  const stringDoubleCatalog = catalogFor(stringDoubleContext);
  const stringDouble = editableField(stringDoubleCatalog, 'string', 'arguments[0]', '"old \'quote\' \\\\ path"', 'createText');
  const stringDoubleResult = accepted(apply(stringDoubleContext, stringDoubleCatalog, stringDouble, "double \"quote\" 'single' \\ path"));
  check('double-quoted string preserves double quote style and Lua escaping',
    stringDoubleResult.replacement.startsWith('"')
      && stringDoubleResult.replacement.endsWith('"')
      && stringDoubleResult.replacement.includes('\\"quote\\"')
      && stringDoubleResult.replacement.includes("'single'")
      && stringDoubleResult.replacement.includes('\\\\ path'),
    stringDoubleResult.replacement);

  const booleanContext = contextFor();
  const booleanCatalog = catalogFor(booleanContext);
  const booleanEntry = editableField(booleanCatalog, 'boolean', 'semantics.properties.scaling', 'false', 'addTable');
  const booleanResult = accepted(apply(booleanContext, booleanCatalog, booleanEntry, true));
  check('boolean edit accepts only Lua boolean spelling and reparses provenance',
    booleanResult.replacement === 'true'
      && sourceText(booleanResult).slice(booleanEntry.startOffset, booleanEntry.startOffset + 4) === 'true'
      && booleanResult.reparsed,
    JSON.stringify(booleanResult));

  const noEditContext = contextFor();
  const noEditCatalog = catalogFor(noEditContext);
  const noEditEntry = editableField(noEditCatalog, 'number', 'semantics.count', '1', 'addTable');
  const noEdit = accepted(apply(noEditContext, noEditCatalog, noEditEntry, noEditEntry.value));
  check('no-edit preserves exact workspace, source, catalog, and bytes by identity',
    !noEdit.changed
      && noEdit.workspace === noEditContext.workspace
      && noEdit.source === noEditContext.source
      && noEdit.catalog === noEditCatalog
      && sourceText(noEdit) === sourceText(noEditContext),
    JSON.stringify(noEdit));

  const authorityContext = contextFor();
  const authorityCatalog = catalogFor(authorityContext);
  const authorityCount = editableField(authorityCatalog, 'number', 'semantics.count', '1', 'addTable');
  const authorityWidth = editableField(authorityCatalog, 'number', 'semantics.properties.width', '80', 'addTable');
  check('addTable count authority is field-exact and excludes same-call width and options evidence',
    authorityCount.provenance.fields.includes('arguments[0]')
      && authorityCount.provenance.fields.includes('semantics.count')
      && authorityCount.provenance.fields.every(field => field === 'arguments[0]' || field === 'semantics.count')
      && authorityWidth.provenance.fields.every(field => field !== 'arguments[0]' && field !== 'semantics.count'),
    JSON.stringify({ count: authorityCount.provenance.fields, width: authorityWidth.provenance.fields }));
  const authorityBeforeBytes = workspaceBytes(authorityContext.workspace);
  const authorityBeforeSource = sourceText(authorityContext);
  const retargetedCount: X4UiEditableSourceEditEntry = {
    ...authorityCount,
    value: authorityWidth.value,
    expression: authorityWidth.expression,
    expectedText: authorityWidth.expectedText,
    startOffset: authorityWidth.startOffset,
    endOffset: authorityWidth.endOffset,
    source: authorityWidth.source,
    sourceLiteral: authorityWidth.sourceLiteral,
    provenance: {
      ...authorityCount.provenance,
      fields: authorityWidth.provenance.fields,
    },
  };
  const retargetedCatalog = catalogWithEntry(authorityCatalog, authorityCount.id, retargetedCount);
  const retargetedResult = applyById(authorityContext, retargetedCatalog, authorityCount.id, 2);
  const wrongPathCatalog = {
    ...authorityCatalog,
    sourcePath: 'ui/foreign.lua',
  } as X4UiSourceEditCatalog;
  const wrongPathResult = applyById(authorityContext, wrongPathCatalog, authorityCount.id, 2);
  const wrongOperationEntry: X4UiEditableSourceEditEntry = {
    ...authorityCount,
    provenance: { ...authorityCount.provenance, operationId: 'foreign-operation-id' },
  };
  const wrongOperationCatalog = catalogWithEntry(authorityCatalog, authorityCount.id, wrongOperationEntry);
  const wrongOperationResult = applyById(authorityContext, wrongOperationCatalog, authorityCount.id, 2);
  const wrongOrderEntry: X4UiEditableSourceEditEntry = {
    ...authorityCount,
    provenance: { ...authorityCount.provenance, callOrder: authorityCount.provenance.callOrder + 1 },
  };
  const wrongOrderCatalog = catalogWithEntry(authorityCatalog, authorityCount.id, wrongOrderEntry);
  const wrongOrderResult = applyById(authorityContext, wrongOrderCatalog, authorityCount.id, 2);
  const duplicateEntryCatalog = {
    ...authorityCatalog,
    entries: [...authorityCatalog.entries, authorityCount],
    editableEntries: [...authorityCatalog.editableEntries, authorityCount],
  } as X4UiSourceEditCatalog;
  const duplicateResult = applyById(authorityContext, duplicateEntryCatalog, authorityCount.id, 2);
  const prototypeCatalog = Object.create(authorityCatalog) as X4UiSourceEditCatalog;
  const prototypeCatalogResult = applyById(authorityContext, prototypeCatalog, authorityCount.id, 2);
  const prototypeEntry = Object.create(authorityCount) as X4UiEditableSourceEditEntry;
  const prototypeEntryCatalog = catalogWithEntry(authorityCatalog, authorityCount.id, prototypeEntry);
  const prototypeEntryResult = applyById(authorityContext, prototypeEntryCatalog, authorityCount.id, 2);
  const clonedWorkspace = {
    ...authorityContext.workspace,
    passthroughFiles: authorityContext.workspace.passthroughFiles?.map(file => ({ ...file })),
  } as ModWorkspace;
  const clonedWorkspaceContext: SourceEditFixtureContext = { ...authorityContext, workspace: clonedWorkspace };
  const clonedWorkspaceBeforeBytes = workspaceBytes(clonedWorkspaceContext.workspace);
  const clonedWorkspaceResult = applyById(clonedWorkspaceContext, authorityCatalog, authorityCount.id, 2);
  const clonedSourceContext: SourceEditFixtureContext = {
    ...authorityContext,
    source: { ...authorityContext.source },
  };
  const clonedSourceBeforeBytes = workspaceBytes(clonedSourceContext.workspace);
  const clonedSourceResult = applyById(clonedSourceContext, authorityCatalog, authorityCount.id, 2);
  const clonedProgramContext: SourceEditFixtureContext = {
    ...authorityContext,
    program: { ...authorityContext.program },
  };
  const clonedProgramCatalog = catalogFor(clonedProgramContext);
  const clonedProgramBeforeBytes = workspaceBytes(clonedProgramContext.workspace);
  const clonedProgramResult = applyById(clonedProgramContext, clonedProgramCatalog, authorityCount.id, 2);
  const foreignAuthorityContext = contextFor();
  const foreignAuthorityCatalog = catalogFor(foreignAuthorityContext);
  const foreignAuthorityEntry = editableField(foreignAuthorityCatalog, 'number', 'semantics.count', '1', 'addTable');
  const foreignBeforeBytes = workspaceBytes(authorityContext.workspace);
  const foreignResult = applyById(authorityContext, foreignAuthorityCatalog, foreignAuthorityEntry.id, 2);
  const authorityAttackCases = [
    { name: 'retargeted count to same-call width', result: retargetedResult, context: authorityContext, catalog: retargetedCatalog, beforeBytes: authorityBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'wrong catalog source path', result: wrongPathResult, context: authorityContext, catalog: wrongPathCatalog, beforeBytes: authorityBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'wrong operation id', result: wrongOperationResult, context: authorityContext, catalog: wrongOperationCatalog, beforeBytes: authorityBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'wrong call order', result: wrongOrderResult, context: authorityContext, catalog: wrongOrderCatalog, beforeBytes: authorityBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'duplicate entry id', result: duplicateResult, context: authorityContext, catalog: duplicateEntryCatalog, beforeBytes: authorityBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'prototype-backed catalog', result: prototypeCatalogResult, context: authorityContext, catalog: prototypeCatalog, beforeBytes: authorityBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'prototype-backed entry', result: prototypeEntryResult, context: authorityContext, catalog: prototypeEntryCatalog, beforeBytes: authorityBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'cloned workspace', result: clonedWorkspaceResult, context: clonedWorkspaceContext, catalog: authorityCatalog, beforeBytes: clonedWorkspaceBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'cloned source', result: clonedSourceResult, context: clonedSourceContext, catalog: authorityCatalog, beforeBytes: clonedSourceBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'cloned program', result: clonedProgramResult, context: clonedProgramContext, catalog: clonedProgramCatalog, beforeBytes: clonedProgramBeforeBytes, beforeSource: authorityBeforeSource },
    { name: 'foreign catalog/context combination', result: foreignResult, context: authorityContext, catalog: foreignAuthorityCatalog, beforeBytes: foreignBeforeBytes, beforeSource: authorityBeforeSource },
  ];
  check('only exact producer-issued catalog/context/entry authority can mutate one scalar range',
    authorityAttackCases.every(item => refusalPreservesInput(item.result, item.context, item.catalog, item.beforeBytes, item.beforeSource)),
    JSON.stringify(authorityAttackCases.map(item => ({
      name: item.name,
      accepted: item.result.accepted,
      reason: item.result.accepted === false ? item.result.reason : 'accepted',
    }))));

  const negativeZeroContext = contextFor();
  const negativeZeroCatalog = catalogFor(negativeZeroContext);
  const negativeZeroCountEntry = editableField(negativeZeroCatalog, 'number', 'semantics.count', '1', 'addTable');
  const negativeZeroCount = refused(apply(negativeZeroContext, negativeZeroCatalog, negativeZeroCountEntry, -0));
  check('negative zero on an invalid count field fails closed after provenance revalidation',
    negativeZeroCount.reason === 'reparse-provenance-drift'
      && negativeZeroCount.workspace === negativeZeroContext.workspace
      && sourceText(negativeZeroContext) === baseLua,
    JSON.stringify(negativeZeroCount));
  const negativeZeroEncoding = encodeX4UiSourceEditReplacement(negativeZeroCountEntry, -0);
  check('negative zero encoding is deterministic and independent of workspace mutation',
    negativeZeroEncoding.ok && negativeZeroEncoding.replacement === '0'
      && sourceText(negativeZeroContext) === baseLua,
    JSON.stringify(negativeZeroEncoding));
  const nonFiniteContext = contextFor();
  const nonFiniteCatalog = catalogFor(nonFiniteContext);
  const nonFiniteEntry = editableField(nonFiniteCatalog, 'number', 'semantics.count', '1', 'addTable');
  const nan = refused(apply(nonFiniteContext, nonFiniteCatalog, nonFiniteEntry, Number.NaN));
  const infinity = refused(apply(nonFiniteContext, nonFiniteCatalog, nonFiniteEntry, Number.POSITIVE_INFINITY));
  const negative = refused(apply(nonFiniteContext, nonFiniteCatalog, nonFiniteEntry, -1));
  check('nonfinite and parser-unsupported negative numeric replacements refuse without mutation',
    nan.reason === 'invalid-replacement'
      && infinity.reason === 'invalid-replacement'
      && negative.reason === 'unsupported-number-replacement'
      && nan.workspace === nonFiniteContext.workspace
      && infinity.workspace === nonFiniteContext.workspace
      && negative.workspace === nonFiniteContext.workspace,
    JSON.stringify({ nan, infinity, negative }));

  const staleContext = contextFor();
  const staleCatalog = catalogFor(staleContext);
  const staleEntry = editableField(staleCatalog, 'number', 'semantics.count', '1', 'addTable');
  const staleText = refused(apply(staleContext, staleCatalog, staleEntry, 2, { expectedText: 'stale' }));
  const staleRange = refused(apply(staleContext, staleCatalog, staleEntry, 2, { startOffset: staleEntry.startOffset + 1 }));
  check('stale expected text and range refuse with exact original workspace identity',
    staleText.reason === 'stale-expected-text'
      && staleRange.reason === 'stale-range'
      && staleText.workspace === staleContext.workspace
      && staleRange.workspace === staleContext.workspace
      && sourceText(staleContext) === baseLua,
    JSON.stringify({ staleText, staleRange }));

  const concurrentContext = contextFor();
  const concurrentCatalog = catalogFor(concurrentContext);
  const concurrentEntry = editableField(concurrentCatalog, 'number', 'semantics.count', '1', 'addTable');
  const concurrentWorkspace = {
    ...concurrentContext.workspace,
    passthroughFiles: concurrentContext.workspace.passthroughFiles?.map((file, index) => index === 2
      ? { ...file, content: `${file.content || ''}-- concurrent\n` }
      : file),
  } as ModWorkspace;
  const concurrent = refused(apply({ ...concurrentContext, workspace: concurrentWorkspace }, concurrentCatalog, concurrentEntry, 2));
  check('concurrent passthrough drift refuses before mutation and returns exact supplied workspace',
    concurrent.reason === 'workspace-source-mismatch'
      && concurrent.workspace === concurrentWorkspace,
    JSON.stringify(concurrent));

  const dynamicContext = contextFor([
    'local menu = { name = "Dynamic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(runtimeCount, { width = getWidth(), scaling = runtimeScaling })',
    'local row = table:addRow(runtimeRow, {})',
    'row[1]:createText(runtimeText, { width = 10 + 1 })',
    '',
  ].join('\n'));
  const dynamicCatalog = catalogFor(dynamicContext);
  check('exact issued partial program with dynamic and unsupported values is wholly non-actionable',
    dynamicContext.program.status === 'partial'
      && dynamicCatalog.status === 'locked'
      && dynamicCatalog.reason === 'operation-not-applied'
      && dynamicCatalog.editableEntries.length === 0
      && dynamicCatalog.lockedEntries.every(entry => entry.reason === 'operation-not-applied'),
    JSON.stringify(dynamicCatalog.lockedEntries));

  const aliasLua = [
    'local menu = { name = "Alias", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local width = 20',
    'local table = frame:addTable(1, { width = width, scaling = false })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("alias", { width = width })',
    '',
  ].join('\n');
  const aliasContext = contextFor(aliasLua);
  const aliasCatalog = catalogFor(aliasContext);
  check('aliased literals remain visible but locked rather than editable at the use site',
    aliasContext.program.status === 'projected'
      && aliasCatalog.status === 'ready'
      && aliasCatalog.lockedEntries.some(entry => entry.reason === 'aliased-value')
      && aliasCatalog.editableEntries.every(entry => entry.expectedText !== 'width'),
    JSON.stringify(aliasCatalog.lockedEntries));

  const unsupportedStringContext = contextFor(baseLua.replace("'old\\n\"quote\"'", '[[long string]]'));
  const unsupportedStringCatalog = catalogFor(unsupportedStringContext);
  check('unsupported long-bracket string style remains non-actionable',
    unsupportedStringContext.program.status === 'projected'
      && unsupportedStringCatalog.lockedEntries.some(entry => entry.reason === 'unsupported-string-style')
      && unsupportedStringCatalog.editableEntries.every(entry => entry.expectedText !== '[[long string]]'),
    JSON.stringify(unsupportedStringCatalog.lockedEntries));

  const shadowContext = contextFor(baseLua, { uiWidgets: [{
    id: 'generated', type: 'button', x: 1, y: 1, w: 10, h: 10, label: 'generated', properties: {},
  }] as ModWorkspace['uiWidgets'] });
  const shadowCatalog = catalogFor(shadowContext);
  const shadowResult = refused(applyX4UiSourceEdit(
    shadowContext.workspace,
    shadowContext.source,
    shadowCatalog,
    shadowCatalog.entries[0].id,
    2,
  ));
  check('generated-shadowed source is locked and cannot mutate the workspace',
    shadowContext.source.status === 'generated-shadowing-source'
      && shadowCatalog.reason === 'generated-shadowed-source'
      && shadowResult.workspace === shadowContext.workspace,
    JSON.stringify(shadowCatalog));

  const foreignContext = contextFor();
  const foreignProgramContext = contextFor(baseLua.replace('name = "Edit"', 'name = "Foreign"'));
  const foreignCatalog = catalogFor({ ...foreignContext, program: foreignProgramContext.program });
  check('crossed program/evidence producer pairs produce a deterministic locked catalog',
    foreignCatalog.status === 'locked'
      && foreignCatalog.reason === 'unsupported-provenance'
      && foreignCatalog.editableEntries.length === 0
      && foreignCatalog.lockedEntries[0].reason === 'unsupported-provenance',
    JSON.stringify(foreignCatalog));

  const unregisteredWorkspace = {
    ...workspace(baseLua),
    passthroughFiles: [
      passthrough('ui.xml', '<addon><environment type="menus"></environment></addon>'),
      passthrough('ui/edit.lua', baseLua),
    ],
  } as ModWorkspace;
  const unregisteredSource = buildX4UiWorkspaceSource(unregisteredWorkspace);
  const unregisteredContext: SourceEditFixtureContext = { ...foreignContext, workspace: unregisteredWorkspace, source: unregisteredSource };
  const unregisteredCatalog = catalogFor(unregisteredContext);
  check('unregistered source remains locked and is never selected for editing',
    unregisteredCatalog.status === 'locked'
      && (unregisteredCatalog.reason === 'unregistered-source' || unregisteredCatalog.reason === 'source-locked'),
    JSON.stringify(unregisteredCatalog));

  const duplicateWorkspace = {
    ...workspace(baseLua),
    passthroughFiles: [
      passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/edit.lua"/><file name="ui/edit.lua"/></environment></addon>'),
      passthrough('ui/edit.lua', baseLua),
    ],
  } as ModWorkspace;
  const duplicateSource = buildX4UiWorkspaceSource(duplicateWorkspace);
  const duplicateCatalog = catalogFor({ ...foreignContext, workspace: duplicateWorkspace, source: duplicateSource });
  check('ambiguous registration remains locked with no source mutation path',
    duplicateCatalog.status === 'locked'
      && duplicateCatalog.reason === 'ambiguous-registration'
      && duplicateCatalog.lockedEntries.every(entry => entry.reason === 'ambiguous-registration'),
    JSON.stringify(duplicateCatalog));

  const syntaxContext = contextFor();
  const syntaxCatalog = catalogFor(syntaxContext);
  const syntaxEntry = editableField(syntaxCatalog, 'string', 'arguments[0]', "'old\\n\"quote\"'", 'createText');
  const syntaxBefore = sourceText(syntaxContext);
  const forgedEndOffset = syntaxEntry.startOffset + 1;
  const forgedEntry: X4UiEditableSourceEditEntry = {
    ...syntaxEntry,
    expectedText: syntaxBefore.slice(syntaxEntry.startOffset, forgedEndOffset),
    sourceLiteral: {
      ...syntaxEntry.sourceLiteral,
      end: {
        ...syntaxEntry.sourceLiteral.start,
        column: syntaxEntry.sourceLiteral.start.column + 1,
        offset: forgedEndOffset,
      },
    },
    endOffset: forgedEndOffset,
  };
  const forgedSyntaxCatalog: X4UiSourceEditCatalog = {
    ...syntaxCatalog,
    entries: syntaxCatalog.entries.map(entry => entry.id === forgedEntry.id ? forgedEntry : entry),
    editableEntries: syntaxCatalog.editableEntries.map(entry => entry.id === forgedEntry.id ? forgedEntry : entry),
  };
  const syntaxRefusal = refused(apply(syntaxContext, forgedSyntaxCatalog, forgedEntry, 'broken'));
  check('forged syntax-breaking range refuses before partial mutation',
    (syntaxRefusal.reason === 'replacement-parse-failure' || syntaxRefusal.reason === 'unsupported-provenance')
      && syntaxRefusal.workspace === syntaxContext.workspace
      && sourceText(syntaxContext) === syntaxBefore,
    JSON.stringify(syntaxRefusal));

  const refusalOrigins = [
    { result: staleText, workspace: staleContext.workspace, source: staleContext.source, catalog: staleCatalog },
    { result: staleRange, workspace: staleContext.workspace, source: staleContext.source, catalog: staleCatalog },
    { result: nan, workspace: nonFiniteContext.workspace, source: nonFiniteContext.source, catalog: nonFiniteCatalog },
    { result: infinity, workspace: nonFiniteContext.workspace, source: nonFiniteContext.source, catalog: nonFiniteCatalog },
    { result: negative, workspace: nonFiniteContext.workspace, source: nonFiniteContext.source, catalog: nonFiniteCatalog },
    { result: negativeZeroCount, workspace: negativeZeroContext.workspace, source: negativeZeroContext.source, catalog: negativeZeroCatalog },
    { result: concurrent, workspace: concurrentWorkspace, source: concurrentContext.source, catalog: concurrentCatalog },
    { result: shadowResult, workspace: shadowContext.workspace, source: shadowContext.source, catalog: shadowCatalog },
    { result: syntaxRefusal, workspace: syntaxContext.workspace, source: syntaxContext.source, catalog: forgedSyntaxCatalog },
  ];
  check('every refusal preserves exact original workspace identity and source bytes',
    refusalOrigins.every(({ result, workspace: expectedWorkspace, source: expectedSource, catalog: expectedCatalog }) =>
      !result.accepted
      && result.changed === false
      && result.workspace === expectedWorkspace
      && result.source === expectedSource
      && result.catalog === expectedCatalog),
    JSON.stringify(refusalOrigins.map(({ result }) => ({ reason: result.reason, changed: result.changed }))));

  const validModel = initial.source.bundle?.sourceFiles.find(file => file.path === 'ui/edit.lua')?.callModel;
  if (!validModel) throw new Error('source fixture call model missing');
  const validEvidence = validModel.calls[0];
  const canonicalUndefinedPaths = ownUndefinedPaths(validModel);
  const canonicalUndefinedFields = [...new Set(canonicalUndefinedPaths.map(path => path.slice(path.lastIndexOf('.') + 1)))].sort();
  const expectedCanonicalUndefinedFields = ['index', 'parentPath', 'reason', 'reference', 'result', 'sourcePath', 'symbol'];
  const normalizedModel = normalizeX4UiSourceEditLayoutModel(validModel);
  check('closed normalization removes only explicit undefined fields and preserves defined evidence',
    normalizedModel !== validModel
      && isIssuedX4UiLayoutEvidencePairForModel(initial.program, initial.evidenceAuthority, normalizedModel)
      && normalizedModel.file.text === validModel.file.text
      && normalizedModel.calls.length === validModel.calls.length
      && normalizedModel.calls[0]?.name === validEvidence?.name
      && validEvidence !== undefined
      && canonicalUndefinedPaths.length > 0
      && canonicalUndefinedFields.join('|') === expectedCanonicalUndefinedFields.join('|')
      && Object.keys(validEvidence).every(key => Object.prototype.hasOwnProperty.call(validEvidence, key)),
    JSON.stringify({ canonicalUndefinedFields, normalized: normalizedModel, original: validModel }));

  const prototypeModel = Object.create(validModel) as typeof validModel;
  const nestedPrototypeModel = {
    ...validModel,
    calls: validModel.calls.map((call, index) => index === 0 ? Object.create(call) : call),
  } as typeof validModel;
  const accessorModel = { ...validModel } as typeof validModel;
  Object.defineProperty(accessorModel, 'parsed', { enumerable: true, configurable: true, get: () => true });
  const sparseModel = { ...validModel, calls: new Array(Math.max(1, validModel.calls.length)) } as typeof validModel;
  const cyclicModel = structuredClone(validModel);
  Object.defineProperty(cyclicModel.calls[0].semantics, 'cycle', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: cyclicModel,
  });
  class CustomModel {}
  const customModel = structuredClone(validModel);
  Object.setPrototypeOf(customModel, CustomModel.prototype);
  const nonOwnModel = Object.create({ ...validModel }) as typeof validModel;
  const malformedModels = [
    { name: 'prototype-backed model', model: prototypeModel },
    { name: 'nested prototype-backed call', model: nestedPrototypeModel },
    { name: 'accessor model', model: accessorModel },
    { name: 'sparse call array', model: sparseModel },
    { name: 'cyclic model', model: cyclicModel },
    { name: 'custom model', model: customModel },
    { name: 'non-own model', model: nonOwnModel },
  ];
  const malformedMessages = malformedModels.map(item => ({
    ...item,
    message: normalizationMessage(item.model),
  }));
  check('malformed nested normalization is deterministic and never silently accepted',
    malformedMessages.every(item => item.message === 'source edit layout model must be closed plain own data'),
    JSON.stringify(malformedMessages.map(item => ({ name: item.name, message: item.message }))));

  const duplicateCallModel = {
    ...validModel,
    calls: [...validModel.calls, validModel.calls[0]],
  } as typeof validModel;
  const malformedDiscoverInputs = [
    ...malformedModels,
    { name: 'duplicate call evidence', model: duplicateCallModel },
  ];
  const malformedDiscoverResults = malformedDiscoverInputs.map(item => {
    const malformedContext = contextWithCallModel(initial, item.model);
    const beforeBytes = workspaceBytes(malformedContext.workspace);
    const beforeSource = sourceText(malformedContext);
    try {
      const catalog = catalogFor(malformedContext);
      const result = applyById(malformedContext, catalog, authorityCount.id, 2);
      return {
        name: item.name,
        threw: false,
        catalog,
        result,
        context: malformedContext,
        beforeBytes,
        beforeSource,
      };
    } catch (error) {
      return {
        name: item.name,
        threw: true,
        error: error instanceof Error ? error.message : String(error),
        catalog: undefined,
        result: undefined,
        context: malformedContext,
        beforeBytes,
        beforeSource,
      };
    }
  });
  check('malformed model, duplicate call, and layout refusal paths return typed non-mutating source-edit results',
    malformedDiscoverResults.every(item => !item.threw
      && item.catalog !== undefined
      && item.catalog.status === 'locked'
      && item.result !== undefined
      && refusalPreservesInput(item.result, item.context, item.catalog, item.beforeBytes, item.beforeSource)),
    JSON.stringify(malformedDiscoverResults.map(item => ({
      name: item.name,
      threw: item.threw,
      catalog: item.catalog?.reason,
      result: item.result?.accepted ? 'accepted' : item.result?.reason,
      error: item.error,
    }))));

  const reversedCallsModel = structuredClone(normalizedModel);
  reversedCallsModel.calls.reverse();
  const reversedRecordsModel = structuredClone(normalizedModel);
  reversedRecordsModel.records.reverse();
  const retargetedModel = structuredClone(normalizedModel);
  const retargetedCall = retargetedModel.calls.find(call => call.name === 'addTable');
  const retargetedWidth = retargetedCall?.semantics.properties?.find(property => property.normalizedName === 'width');
  if (!retargetedCall || !retargetedWidth || retargetedCall.arguments.length === 0) {
    throw new Error('wrong-literal retarget fixture could not find addTable count and width evidence');
  }
  retargetedCall.arguments[0] = retargetedWidth.value;
  retargetedCall.semantics.count = retargetedWidth.value;
  const addedRecordModel = structuredClone(normalizedModel);
  const addedRecord = addedRecordModel.records.find(record => record.recordType !== 'call');
  if (!addedRecord) throw new Error('complete-model added-record fixture requires a non-call record');
  addedRecordModel.records.push(structuredClone(addedRecord));
  const removedRecordModel = structuredClone(normalizedModel);
  const removedRecordIndex = removedRecordModel.records.findIndex(record => record.recordType !== 'call');
  if (removedRecordIndex < 0) throw new Error('complete-model removed-record fixture requires a non-call record');
  removedRecordModel.records.splice(removedRecordIndex, 1);

  const projectIssuedModelAttack = (name: string, model: X4UiCallModel) => {
    const normalizedAttackModel = normalizeX4UiSourceEditLayoutModel(model);
    const target = createX4UiLayoutTargetCatalog(normalizedAttackModel).targets.find(candidate => candidate.kind === 'top-level');
    if (!target) throw new Error(`${name} fixture top-level target missing`);
    const projection = projectX4UiLayoutProgram(
      normalizedAttackModel,
      target,
      profileFor(normalizedAttackModel),
    );
    if (projection.status !== 'projected' || !projection.program) {
      throw new Error(`${name} fixture did not produce an exact projected pair: ${JSON.stringify(projection)}`);
    }
    return {
      name,
      model: normalizedAttackModel,
      context: {
        workspace: initial.workspace,
        source: initial.source,
        program: projection.program,
        evidenceAuthority: projection.evidenceAuthority,
      } satisfies SourceEditFixtureContext,
    };
  };
  const completeModelAttacks = [
    projectIssuedModelAttack('exact issued pair for reversed calls', reversedCallsModel),
    projectIssuedModelAttack('exact issued pair for reversed records', reversedRecordsModel),
    projectIssuedModelAttack('exact issued pair for same-call wrong-literal retarget', retargetedModel),
    projectIssuedModelAttack('exact issued pair for added complete-model record', addedRecordModel),
    projectIssuedModelAttack('exact issued pair for removed complete-model record', removedRecordModel),
  ];
  const completeModelAttackRows = completeModelAttacks.map(item => {
    const beforeBytes = workspaceBytes(item.context.workspace);
    const beforeSource = sourceText(item.context);
    const alteredPairIssued = isIssuedX4UiLayoutEvidencePairForModel(
      item.context.program,
      item.context.evidenceAuthority,
      item.model,
    );
    const canonicalPairIssued = isIssuedX4UiLayoutEvidencePairForModel(
      item.context.program,
      item.context.evidenceAuthority,
      normalizedModel,
    );
    const catalogOutcome = invokePublic(() => catalogFor(item.context));
    const catalog = catalogOutcome.value;
    const applyOutcome = catalog
      ? invokePublic(() => applyById(
        item.context,
        catalog,
        catalog.editableEntries[0]?.id || authorityCount.id,
        item.name.includes('wrong-literal') ? 90 : 2,
      ))
      : { threw: false };
    const result = applyOutcome.value;
    return {
      name: item.name,
      alteredPairIssued,
      canonicalPairIssued,
      exactCanonicalWorkspace: item.context.workspace === initial.workspace,
      exactCanonicalSource: item.context.source === initial.source,
      discoverThrew: catalogOutcome.threw,
      catalogStatus: catalog?.status,
      catalogReason: catalog?.reason,
      catalogDetail: catalog?.detail,
      editableIssued: catalog?.editableEntries.length || 0,
      applyThrew: applyOutcome.threw,
      accepted: result?.accepted,
      changed: result?.changed,
      applyReason: result?.accepted === false ? result.reason : undefined,
      applyDetail: result?.accepted === false ? result.detail : undefined,
      closed: alteredPairIssued
        && !canonicalPairIssued
        && item.context.workspace === initial.workspace
        && item.context.source === initial.source
        && catalogOutcome.threw === false
        && catalog?.status === 'locked'
        && catalog.reason === 'provenance-drift'
        && catalog.detail === 'layout evidence pair was not issued for the canonical complete source call model'
        && catalog.editableEntries.length === 0
        && applyOutcome.threw === false
        && result?.accepted === false
        && result.changed === false
        && result.reason === 'unsupported-provenance'
        && result.detail === 'catalog layout authority does not match the canonical complete source call model'
        && result.workspace === item.context.workspace
        && result.source === item.context.source
        && result.catalog === catalog
        && workspaceBytes(item.context.workspace) === beforeBytes
        && sourceText(item.context) === beforeSource,
    };
  });

  const malformedNestedInputs = [
    { name: 'non-whitelisted nested undefined', value: undefined, field: 'context.auditUndefined' },
    { name: 'undefined array slot', value: undefined, field: 'assignedTo[0]' },
    { name: 'NaN', value: Number.NaN, field: 'order' },
    { name: '+Infinity', value: Number.POSITIVE_INFINITY, field: 'order' },
    { name: '-Infinity', value: Number.NEGATIVE_INFINITY, field: 'order' },
  ];
  const malformedNestedRows = malformedNestedInputs.map(attack => {
    const model = structuredClone(validModel);
    const call = model.calls.find(candidate => candidate.name === 'addTable');
    if (!call) throw new Error(`malformed nested fixture missing addTable for ${attack.name}`);
    if (attack.field === 'context.auditUndefined') {
      Object.defineProperty(call.context, 'auditUndefined', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: attack.value,
      });
    } else if (attack.field === 'assignedTo[0]') {
      if (!call.assignedTo?.length) throw new Error('malformed nested undefined fixture missing assignedTo evidence');
      Object.defineProperty(call.assignedTo, '0', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: attack.value,
      });
    } else {
      Object.defineProperty(call, 'order', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: attack.value,
      });
    }
    const normalization = normalizationMessage(model);
    const context = contextWithCallModel(initial, model);
    const beforeBytes = workspaceBytes(context.workspace);
    const beforeSource = sourceText(context);
    const catalogOutcome = invokePublic(() => catalogFor(context));
    const catalog = catalogOutcome.value;
    const countEntry = catalog?.editableEntries.find(entry => entry.provenance.callName === 'addTable'
      && entry.provenance.fields.includes('semantics.count'));
    const applyOutcome = catalog
      ? invokePublic(() => applyById(context, catalog, countEntry?.id || authorityCount.id, 2))
      : { threw: false };
    const result = applyOutcome.value;
    return {
      name: attack.name,
      normalization,
      discoverThrew: catalogOutcome.threw,
      catalogStatus: catalog?.status,
      catalogReason: catalog?.reason,
      actionable: countEntry !== undefined,
      applyThrew: applyOutcome.threw,
      accepted: result?.accepted,
      changed: result?.changed,
      closed: normalization === 'source edit layout model must be closed plain own data'
        && catalogOutcome.threw === false
        && catalog?.status === 'locked'
        && countEntry === undefined
        && applyOutcome.threw === false
        && result?.accepted === false
        && result.changed === false
        && result.workspace === context.workspace
        && result.source === context.source
        && workspaceBytes(context.workspace) === beforeBytes
        && sourceText(context) === beforeSource,
    };
  });

  const refusedProgram: X4UiLayoutProgram = {
    ...initial.program,
    status: 'refused',
  };
  const refusedProgramContext: SourceEditFixtureContext = {
    ...initial,
    program: refusedProgram,
  };
  const refusedProgramBeforeBytes = workspaceBytes(refusedProgramContext.workspace);
  const refusedProgramBeforeSource = sourceText(refusedProgramContext);
  const refusedProgramCatalogOutcome = invokePublic(() => catalogFor(refusedProgramContext));
  const refusedProgramCatalog = refusedProgramCatalogOutcome.value;
  const refusedProgramEntry = refusedProgramCatalog?.editableEntries.find(entry => entry.provenance.callName === 'addTable'
    && entry.provenance.fields.includes('semantics.count'));
  const refusedProgramApplyOutcome = refusedProgramCatalog
    ? invokePublic(() => applyById(refusedProgramContext, refusedProgramCatalog, refusedProgramEntry?.id || authorityCount.id, 2))
    : { threw: false };
  const refusedProgramResult = refusedProgramApplyOutcome.value;
  const refusedProgramRows = [{
    name: 'refused layout program retaining target and operations',
    discoverThrew: refusedProgramCatalogOutcome.threw,
    catalogStatus: refusedProgramCatalog?.status,
    catalogReason: refusedProgramCatalog?.reason,
    entryIssued: refusedProgramEntry !== undefined,
    applyThrew: refusedProgramApplyOutcome.threw,
    accepted: refusedProgramResult?.accepted,
    changed: refusedProgramResult?.changed,
  }];
  const refusedProgramClosed = refusedProgramCatalogOutcome.threw === false
    && refusedProgramCatalog?.status === 'locked'
    && refusedProgramEntry === undefined
    && refusedProgramApplyOutcome.threw === false
    && refusedProgramResult?.accepted === false
    && refusedProgramResult.changed === false
    && refusedProgramResult.workspace === refusedProgramContext.workspace
    && refusedProgramResult.source === refusedProgramContext.source
    && workspaceBytes(refusedProgramContext.workspace) === refusedProgramBeforeBytes
    && sourceText(refusedProgramContext) === refusedProgramBeforeSource;

  check('public aliases expose only the positional primitive signatures',
    discoverX4UiSourceEdits.length === 4
      && buildX4UiSourceEditCatalog === discoverX4UiSourceEdits
      && catalogX4UiSourceEdits === discoverX4UiSourceEdits
      && buildX4UiSourceEditCatalog.length === 4
      && catalogX4UiSourceEdits.length === 4
      && applyX4UiSourceEdit.length === 9
      && applyX4UiSourceEditRequest === applyX4UiSourceEdit
      && commitX4UiSourceEdit === applyX4UiSourceEdit
      && applyX4UiSourceEditRequest.length === 9
      && commitX4UiSourceEdit.length === 9);

  const foreignBoundaryContext = contextFor();
  const actualRefusedProjection = projectX4UiLayoutProgram(
    validModel,
    {
      kind: initial.program.target.kind,
      source: initial.program.target.source,
      id: `${initial.program.target.id}:mismatched`,
    },
    profileFor(validModel),
  );
  const actualRefusedDiscovery = actualRefusedProjection.status === 'refused'
    ? invokeDiscoveryBoundary(
      initial.workspace,
      initial.source,
      actualRefusedProjection.program,
      undefined,
    )
    : invokeDiscoveryBoundary(
      initial.workspace,
      initial.source,
      frozenClone(actualRefusedProjection.program),
      frozenClone(actualRefusedProjection.evidenceAuthority),
    );
  const frozenQuartet = {
    workspace: frozenClone(initial.workspace),
    source: frozenClone(initial.source),
    program: frozenClone(initial.program),
    evidence: frozenClone(initial.evidenceAuthority),
  };
  const discoveryWorkspaceProxyCounter: TrapCounter = { reads: 0 };
  const discoverySourceProxyCounter: TrapCounter = { reads: 0 };
  const discoveryProgramProxyCounter: TrapCounter = { reads: 0 };
  const discoveryEvidenceProxyCounter: TrapCounter = { reads: 0 };
  const discoveryWorkspaceProxy = hostileProxy(initial.workspace, discoveryWorkspaceProxyCounter);
  const discoverySourceProxy = hostileProxy(initial.source, discoverySourceProxyCounter);
  const discoveryProgramProxy = hostileProxy(initial.program, discoveryProgramProxyCounter);
  const discoveryEvidenceProxy = hostileProxy(initial.evidenceAuthority, discoveryEvidenceProxyCounter);
  const customPrototypeWorkspace = Object.create(initial.workspace);

  let accessorWorkspaceReads = 0;
  const accessorWorkspace = Object.defineProperty({}, 'passthroughFiles', {
    enumerable: true,
    get(): never {
      accessorWorkspaceReads += 1;
      throw new Error('workspace accessor executed');
    },
  });
  let accessorSourceReads = 0;
  const accessorSource = Object.defineProperty({}, 'bundle', {
    enumerable: true,
    get(): never {
      accessorSourceReads += 1;
      throw new Error('source accessor executed');
    },
  });
  let accessorProgramReads = 0;
  const accessorProgram = Object.defineProperty({}, 'status', {
    enumerable: true,
    get(): never {
      accessorProgramReads += 1;
      throw new Error('program accessor executed');
    },
  });
  let accessorEvidenceReads = 0;
  const accessorEvidence = Object.defineProperty({}, 'calls', {
    enumerable: true,
    get(): never {
      accessorEvidenceReads += 1;
      throw new Error('evidence accessor executed');
    },
  });

  const discoveryBoundaryCases = [
    {
      name: 'deeply cloned and frozen coherent quartet',
      outcome: invokeDiscoveryBoundary(frozenQuartet.workspace, frozenQuartet.source, frozenQuartet.program, frozenQuartet.evidence),
      reads: 0,
    },
    { name: 'one-sided workspace clone', outcome: invokeDiscoveryBoundary(frozenClone(initial.workspace), initial.source, initial.program, initial.evidenceAuthority), reads: 0 },
    { name: 'one-sided source clone', outcome: invokeDiscoveryBoundary(initial.workspace, frozenClone(initial.source), initial.program, initial.evidenceAuthority), reads: 0 },
    { name: 'one-sided program clone', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, frozenClone(initial.program), initial.evidenceAuthority), reads: 0 },
    { name: 'one-sided evidence clone', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, initial.program, frozenClone(initial.evidenceAuthority)), reads: 0 },
    { name: 'crossed workspace/source pair', outcome: invokeDiscoveryBoundary(initial.workspace, foreignBoundaryContext.source, initial.program, initial.evidenceAuthority), reads: 0 },
    { name: 'reverse-crossed workspace/source pair', outcome: invokeDiscoveryBoundary(foreignBoundaryContext.workspace, initial.source, initial.program, initial.evidenceAuthority), reads: 0 },
    { name: 'crossed program/evidence pair', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, foreignBoundaryContext.program, initial.evidenceAuthority), reads: 0 },
    { name: 'reverse-crossed program/evidence pair', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, initial.program, foreignBoundaryContext.evidenceAuthority), reads: 0 },
    { name: 'workspace proxy', outcome: invokeDiscoveryBoundary(discoveryWorkspaceProxy, initial.source, initial.program, initial.evidenceAuthority), reads: discoveryWorkspaceProxyCounter.reads },
    { name: 'source proxy', outcome: invokeDiscoveryBoundary(initial.workspace, discoverySourceProxy, initial.program, initial.evidenceAuthority), reads: discoverySourceProxyCounter.reads },
    { name: 'program proxy', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, discoveryProgramProxy, initial.evidenceAuthority), reads: discoveryProgramProxyCounter.reads },
    { name: 'evidence proxy', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, initial.program, discoveryEvidenceProxy), reads: discoveryEvidenceProxyCounter.reads },
    { name: 'workspace accessor object', outcome: invokeDiscoveryBoundary(accessorWorkspace, initial.source, initial.program, initial.evidenceAuthority), reads: accessorWorkspaceReads },
    { name: 'source accessor object', outcome: invokeDiscoveryBoundary(initial.workspace, accessorSource, initial.program, initial.evidenceAuthority), reads: accessorSourceReads },
    { name: 'program accessor object', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, accessorProgram, initial.evidenceAuthority), reads: accessorProgramReads },
    { name: 'evidence accessor object', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, initial.program, accessorEvidence), reads: accessorEvidenceReads },
    { name: 'custom-prototype workspace wrapper', outcome: invokeDiscoveryBoundary(customPrototypeWorkspace, initial.source, initial.program, initial.evidenceAuthority), reads: 0 },
    { name: 'null workspace', outcome: invokeDiscoveryBoundary(null, initial.source, initial.program, initial.evidenceAuthority), reads: 0 },
    { name: 'primitive source', outcome: invokeDiscoveryBoundary(initial.workspace, 1, initial.program, initial.evidenceAuthority), reads: 0 },
    { name: 'primitive program', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, 'program', initial.evidenceAuthority), reads: 0 },
    { name: 'primitive evidence', outcome: invokeDiscoveryBoundary(initial.workspace, initial.source, initial.program, false), reads: 0 },
    { name: 'exact issued partial pair', outcome: invokeDiscoveryBoundary(dynamicContext.workspace, dynamicContext.source, dynamicContext.program, dynamicContext.evidenceAuthority), reads: 0 },
    { name: 'actual producer refused result', outcome: actualRefusedDiscovery, reads: 0 },
    { name: 'caller-authored refused lookalike', outcome: refusedProgramCatalogOutcome, reads: 0 },
  ];
  const discoveryBoundariesClosed = actualRefusedProjection.status === 'refused'
    && discoveryBoundaryCases.every(item => item.outcome.threw === false
      && item.outcome.value?.status === 'locked'
      && item.outcome.value.editable === false
      && item.reads === 0);

  const applyBoundaryContext = contextFor();
  const applyBoundaryCatalog = catalogFor(applyBoundaryContext);
  const applyBoundaryEntry = editableField(applyBoundaryCatalog, 'number', 'semantics.count', '1', 'addTable');
  const applyBoundaryBeforeBytes = workspaceBytes(applyBoundaryContext.workspace);
  const applyBoundaryBeforeSource = sourceText(applyBoundaryContext);
  const exactCasOutcome = invokeApplyBoundary(
    applyBoundaryContext.workspace,
    applyBoundaryContext.source,
    applyBoundaryCatalog,
    applyBoundaryEntry.id,
    2,
    applyBoundaryEntry.path,
    applyBoundaryEntry.startOffset,
    applyBoundaryEntry.endOffset,
    applyBoundaryEntry.expectedText,
  );
  const clonedApplyCatalog = frozenClone(applyBoundaryCatalog);
  const applyCatalogProxyCounter: TrapCounter = { reads: 0 };
  const applyWorkspaceProxyCounter: TrapCounter = { reads: 0 };
  const applySourceProxyCounter: TrapCounter = { reads: 0 };
  const applyCatalogProxy = hostileProxy(applyBoundaryCatalog, applyCatalogProxyCounter);
  const applyWorkspaceProxy = hostileProxy(applyBoundaryContext.workspace, applyWorkspaceProxyCounter);
  const applySourceProxy = hostileProxy(applyBoundaryContext.source, applySourceProxyCounter);
  let applyCatalogAccessorReads = 0;
  const applyCatalogAccessor = Object.defineProperty({}, 'entries', {
    enumerable: true,
    get(): never {
      applyCatalogAccessorReads += 1;
      throw new Error('catalog accessor executed');
    },
  });
  let hostileReplacementReads = 0;
  const hostileReplacement = Object.defineProperty({}, 'value', {
    enumerable: true,
    get(): never {
      hostileReplacementReads += 1;
      throw new Error('replacement accessor executed');
    },
  });
  const customPrototypeReplacement = Object.create({ scalar: 2 });
  const crossApplyContext = contextFor();
  const crossApplyCatalog = catalogFor(crossApplyContext);
  const applyBoundaryCases = [
    { name: 'exact issued partial catalog', outcome: invokeApplyBoundary(dynamicContext.workspace, dynamicContext.source, dynamicCatalog, dynamicCatalog.entries[0].id, 2), workspace: dynamicContext.workspace, source: dynamicContext.source, catalog: dynamicCatalog, reads: 0 },
    { name: 'cloned catalog', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, clonedApplyCatalog, applyBoundaryEntry.id, 2), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: clonedApplyCatalog, reads: 0 },
    { name: 'catalog proxy', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyCatalogProxy, applyBoundaryEntry.id, 2), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyCatalogProxy, reads: applyCatalogProxyCounter.reads },
    { name: 'catalog accessor object', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyCatalogAccessor, applyBoundaryEntry.id, 2), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyCatalogAccessor, reads: applyCatalogAccessorReads },
    { name: 'cross-context catalog', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, crossApplyCatalog, applyBoundaryEntry.id, 2), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: crossApplyCatalog, reads: 0 },
    { name: 'workspace proxy', outcome: invokeApplyBoundary(applyWorkspaceProxy, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2), workspace: applyWorkspaceProxy, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: applyWorkspaceProxyCounter.reads },
    { name: 'source proxy', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applySourceProxy, applyBoundaryCatalog, applyBoundaryEntry.id, 2), workspace: applyBoundaryContext.workspace, source: applySourceProxy, catalog: applyBoundaryCatalog, reads: applySourceProxyCounter.reads },
    { name: 'unknown entry', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, 'unknown-entry', 2), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'non-string entry id', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, 7, 2), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'undefined replacement', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, undefined), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'null replacement', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, null), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'wrong string replacement type', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, '2'), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'wrong boolean replacement type', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, true), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'hostile object replacement', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, hostileReplacement), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: hostileReplacementReads },
    { name: 'custom-prototype replacement', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, customPrototypeReplacement), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'NaN replacement', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, Number.NaN), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: '+Infinity replacement', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, Number.POSITIVE_INFINITY), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: '-Infinity replacement', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, Number.NEGATIVE_INFINITY), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'wrong expected path', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, 'ui/wrong.lua'), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'wrong expected start', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, undefined, applyBoundaryEntry.startOffset + 1), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'wrong expected end', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, undefined, undefined, applyBoundaryEntry.endOffset + 1), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'wrong expected text', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, undefined, undefined, undefined, 'stale'), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'non-string expected path', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, 1), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'non-integer expected start', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, undefined, 1.5), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'negative expected end', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, undefined, undefined, -1), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: 0 },
    { name: 'non-string expected text', outcome: invokeApplyBoundary(applyBoundaryContext.workspace, applyBoundaryContext.source, applyBoundaryCatalog, applyBoundaryEntry.id, 2, undefined, undefined, undefined, hostileReplacement), workspace: applyBoundaryContext.workspace, source: applyBoundaryContext.source, catalog: applyBoundaryCatalog, reads: hostileReplacementReads },
  ];
  const applyBoundariesClosed = exactCasOutcome.threw === false
    && exactCasOutcome.value?.accepted === true
    && exactCasOutcome.value.changed
    && applyBoundaryCases.every(item => item.outcome.threw === false
      && item.outcome.value?.accepted === false
      && item.outcome.value.changed === false
      && item.outcome.value.workspace === item.workspace
      && item.outcome.value.source === item.source
      && item.outcome.value.catalog === item.catalog
      && item.reads === 0)
    && workspaceBytes(applyBoundaryContext.workspace) === applyBoundaryBeforeBytes
    && sourceText(applyBoundaryContext) === applyBoundaryBeforeSource;

  let hostileWrapperReads = 0;
  const hostileWrapper = Object.defineProperties({}, {
    workspace: { enumerable: true, get(): never { hostileWrapperReads += 1; throw new Error('wrapper workspace getter executed'); } },
    source: { enumerable: true, get(): never { hostileWrapperReads += 1; throw new Error('wrapper source getter executed'); } },
    catalog: { enumerable: true, get(): never { hostileWrapperReads += 1; throw new Error('wrapper catalog getter executed'); } },
    request: { enumerable: true, get(): never { hostileWrapperReads += 1; throw new Error('wrapper request getter executed'); } },
  });
  const hostileWrapperOutcome = invokePublic(() => {
    // @ts-expect-error The removed object-wrapper overload must remain unrepresentable and inert at runtime.
    return applyX4UiSourceEdit(hostileWrapper);
  });
  const wrapperOverloadClosed = hostileWrapperOutcome.threw === false
    && hostileWrapperReads === 0
    && hostileWrapperOutcome.value?.accepted === false
    && hostileWrapperOutcome.value.changed === false
    && hostileWrapperOutcome.value.workspace === hostileWrapper;

  const publicBoundaryRows = [
    ...discoveryBoundaryCases.map(item => ({
      name: `discover ${item.name}`,
      threw: item.outcome.threw,
      status: item.outcome.value?.status,
      reads: item.reads,
    })),
    ...applyBoundaryCases.map(item => ({
      name: `apply ${item.name}`,
      threw: item.outcome.threw,
      accepted: item.outcome.value?.accepted,
      reads: item.reads,
    })),
    {
      name: 'removed nested request wrapper overload',
      threw: hostileWrapperOutcome.threw,
      accepted: hostileWrapperOutcome.value?.accepted,
      reads: hostileWrapperReads,
    },
  ];
  const publicBoundariesClosed = discoveryBoundariesClosed
    && applyBoundariesClosed
    && wrapperOverloadClosed;

  const round2Families = {
    canonicalOptionalUndefined: canonicalUndefinedFields,
    completeModelAuthority: { total: completeModelAttackRows.length, rows: completeModelAttackRows },
    malformedNestedEvidence: { total: malformedNestedRows.length, rows: malformedNestedRows },
    refusedProgram: { total: refusedProgramRows.length, rows: refusedProgramRows },
    publicBoundaryContainment: { total: publicBoundaryRows.length, rows: publicBoundaryRows },
  };
  console.log(`x4UiSourceEdits 7B-C.1 causal families: ${JSON.stringify(round2Families)}`);
  check('five real producer-issued altered complete models refuse against the exact canonical workspace/source pair',
    completeModelAttackRows.length === 5
      && completeModelAttackRows.every(row => row.closed),
    JSON.stringify(completeModelAttackRows));
  check('7B-C.1 complete-model authority and containment families fail closed without weakening valid source edits',
    completeModelAttackRows.every(row => row.closed)
      && malformedNestedRows.every(row => row.closed)
      && refusedProgramClosed
      && publicBoundariesClosed,
    JSON.stringify(round2Families));

  const model = buildX4UiCallModel({ rel: 'selftest/direct.lua', text: 'local value = 1\n' });
  const modelTarget = createX4UiLayoutTargetCatalog(model).targets[0];
  check('selftest fixture uses the existing parser/model owners only',
    modelTarget !== undefined && model.file.text === 'local value = 1\n' && typeof projectX4UiLayoutProgram === 'function');

  const failed = checks.filter(item => !item.pass);
  assert.equal(failed.length, 0, JSON.stringify(failed));
  console.log(`x4UiSourceEdits selftest: PASS (${checks.length}/${checks.length})`);
};

run();
