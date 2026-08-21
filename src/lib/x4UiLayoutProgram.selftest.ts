import {
  buildX4UiCallModel,
  type X4UiCallModel,
} from './x4UiCallModel';
import {
  HELPER_SOURCE_SHA256,
  WIDGET_SOURCE_SHA256,
  X4_LAYOUT_PROVENANCE,
} from './x4UiLayoutKernel';
import {
  createX4UiLayoutTargetCatalog,
  projectX4UiLayoutProgram,
  validateX4UiLayoutEvidencePair,
  X4_UI_LAYOUT_GAME_TRUTH,
  type X4UiLayoutEvidenceAuthority,
  type X4UiLayoutProjectionProfile,
  type X4UiLayoutPreviewPathSelectionInput,
  type X4UiLayoutPreviewSampleInput,
  type X4UiLayoutProgram,
  type X4UiLayoutTarget,
  type X4UiLayoutTargetSelector,
} from './x4UiLayoutProgram';
import * as x4UiLayoutProgramExports from './x4UiLayoutProgram';
import {
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  isX4UiCorpusCanonicalColorSuccess,
  loadCanonicalX4UiCorpusColorEvidence,
  type X4UiCorpusCanonicalColorLoadOptions,
  type X4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusFetchResponse,
} from './x4UiCorpusAssets';

interface Check {
  readonly name: string;
  readonly pass: boolean;
  readonly detail?: string;
}

type EvidenceAuthorityLike = X4UiLayoutEvidenceAuthority;
type EvidenceAuthorityGapLike = EvidenceAuthorityLike['gaps'][number];
type EvidenceNodeLedgerLike = {
  readonly id: string;
  readonly operationIds: readonly string[];
  readonly metadataOperationIds?: readonly string[];
  readonly snapshot: EvidenceAuthorityLike['nodes']['frames'][number]['snapshot'];
};
type EvidenceNodeLedgersLike = {
  readonly frames: readonly EvidenceNodeLedgerLike[];
  readonly tables: readonly EvidenceNodeLedgerLike[];
  readonly rows: readonly EvidenceNodeLedgerLike[];
  readonly cells: readonly EvidenceNodeLedgerLike[];
};
type EvidenceAuthorityWithNodesLike = EvidenceAuthorityLike & {
  readonly nodes: EvidenceNodeLedgersLike;
};

const checks: Check[] = [];

const check = (name: string, pass: boolean, detail?: string): void => {
  checks.push({ name, pass, detail });
};

const input = (text: string, rel = 'selftest/b119-layout-program.lua') => ({
  rel,
  text,
  sourcePath: `fixture://${rel}`,
});

const detail = (value: unknown): string => JSON.stringify(value);

const locationsSameForTest = (
  left: { readonly file: string; readonly sourcePath?: string; readonly start: { readonly line: number; readonly column: number; readonly offset: number }; readonly end: { readonly line: number; readonly column: number; readonly offset: number } } | undefined,
  right: { readonly file: string; readonly sourcePath?: string; readonly start: { readonly line: number; readonly column: number; readonly offset: number }; readonly end: { readonly line: number; readonly column: number; readonly offset: number } } | undefined,
): boolean => Boolean(left && right)
  && left!.file === right!.file
  && (left!.sourcePath || undefined) === (right!.sourcePath || undefined)
  && JSON.stringify(left!.start) === JSON.stringify(right!.start)
  && JSON.stringify(left!.end) === JSON.stringify(right!.end);

const pin = (value: number, lineStart: number, lineEnd = lineStart) => ({
  value,
  source: {
    sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath,
    lineStart,
    lineEnd,
  },
});

// These are explicit captured runtime dimensions.  The helper source lines below
// prove the assignment sites, not numeric Lua literals for these runtime values.
const CAPTURED_VIEW_WIDTH = 100;
const CAPTURED_VIEW_HEIGHT = 80;
const CAPTURED_BORDER_SIZE = 1;

const profileFor = (
  model: X4UiCallModel,
  options: {
    readonly buttonDefault?: boolean;
    readonly minTextHeight?: number;
    readonly uiScale?: number;
    readonly truthGrade?: X4UiLayoutProjectionProfile['truthGrade'];
    readonly localExpansion?: { readonly maxDepth: number; readonly maxInvocations: number };
  } = {},
): X4UiLayoutProjectionProfile => {
  const catalog = createX4UiLayoutTargetCatalog(model);
  return {
    id: 'selftest-profile',
    provenance: 'B119 selftest source-pinned Helper + captured runtime dimensions',
    truthGrade: options.truthGrade ?? 'captured',
    source: catalog.sourceIdentity,
    frame: { width: CAPTURED_VIEW_WIDTH, height: CAPTURED_VIEW_HEIGHT },
    metrics: {
      uiScale: options.uiScale ?? 1,
      borderSize: CAPTURED_BORDER_SIZE,
      scrollbarWidth: 12,
      standardContainerOffset: 2,
    },
    helper: {
      sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath,
      sha256: HELPER_SOURCE_SHA256,
      constants: {
        standardTextHeight: pin(16, 533),
        standardButtonHeight: pin(25, 522),
        viewWidth: pin(CAPTURED_VIEW_WIDTH, 707),
        viewHeight: pin(CAPTURED_VIEW_HEIGHT, 708),
        borderSize: pin(CAPTURED_BORDER_SIZE, 709),
      },
    },
    widget: {
      sourcePath: X4_LAYOUT_PROVENANCE.widgetSourcePath,
      sha256: WIDGET_SOURCE_SHA256,
    },
    defaults: {
      ...(options.buttonDefault === false ? {} : { standardButtonHeight: pin(25, 522) }),
      ...(options.minTextHeight !== undefined ? { minTextHeight: options.minTextHeight } : {}),
    },
    ...(options.localExpansion ? { localExpansion: options.localExpansion } : {}),
  };
};

const topTarget = (model: X4UiCallModel): X4UiLayoutTarget => {
  const target = createX4UiLayoutTargetCatalog(model).targets.find(candidate => candidate.kind === 'top-level');
  if (!target) throw new Error('top-level target missing');
  return target;
};

const namedTarget = (model: X4UiCallModel, name: string): X4UiLayoutTarget => {
  const target = createX4UiLayoutTargetCatalog(model).targets.find(candidate =>
    candidate.kind !== 'top-level' && candidate.name === name);
  if (!target) throw new Error(`target ${name} missing`);
  return target;
};

const programOf = (result: ReturnType<typeof projectX4UiLayoutProgram>): X4UiLayoutProgram => {
  if (!result.program) throw new Error(`expected program, got ${detail(result)}`);
  return result.program;
};

const evidenceAuthorityOf = (result: ReturnType<typeof projectX4UiLayoutProgram>): EvidenceAuthorityLike | undefined =>
  'evidenceAuthority' in result ? result.evidenceAuthority : undefined;

const resultProgram = (result: ReturnType<typeof projectX4UiLayoutProgram>): X4UiLayoutProgram | undefined =>
  result.program;

const resultWithAuthority = (
  result: unknown,
  authority: unknown,
): ReturnType<typeof projectX4UiLayoutProgram> => ({
  ...(result as Record<string, unknown>),
  evidenceAuthority: authority as EvidenceAuthorityLike,
} as ReturnType<typeof projectX4UiLayoutProgram>);

const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const freezeClone = <T>(value: T): T => {
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object' || Object.isFrozen(candidate)) return;
    for (const child of Object.values(candidate)) visit(child);
    Object.freeze(candidate);
  };
  visit(value);
  return value;
};

type IssuedPairPredicate = (program: unknown, evidenceAuthority: unknown) => boolean;
type IssuedPairForModelPredicate = (
  program: unknown,
  evidenceAuthority: unknown,
  model: unknown,
) => boolean;

const issuedPair = (
  program: unknown,
  evidenceAuthority: unknown,
): { readonly available: boolean; readonly threw: boolean; readonly value: boolean } => {
  const candidate = (x4UiLayoutProgramExports as unknown as {
    readonly isIssuedX4UiLayoutEvidencePair?: unknown;
  }).isIssuedX4UiLayoutEvidencePair;
  if (typeof candidate !== 'function') return { available: false, threw: false, value: false };
  try {
    return {
      available: true,
      threw: false,
      value: (candidate as IssuedPairPredicate)(program, evidenceAuthority),
    };
  } catch {
    return { available: true, threw: true, value: false };
  }
};

const issuedPairForModel = (
  program: unknown,
  evidenceAuthority: unknown,
  model: unknown,
): { readonly available: boolean; readonly threw: boolean; readonly value: boolean } => {
  const candidate = (x4UiLayoutProgramExports as unknown as {
    readonly isIssuedX4UiLayoutEvidencePairForModel?: unknown;
  }).isIssuedX4UiLayoutEvidencePairForModel;
  if (typeof candidate !== 'function') return { available: false, threw: false, value: false };
  try {
    return {
      available: true,
      threw: false,
      value: (candidate as IssuedPairForModelPredicate)(program, evidenceAuthority, model),
    };
  } catch {
    return { available: true, threw: true, value: false };
  }
};

const freezeCycleClone = <T>(value: T): T => {
  const seen = new Set<object>();
  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return;
    const objectValue = candidate as object;
    if (seen.has(objectValue) || Object.isFrozen(objectValue)) return;
    seen.add(objectValue);
    for (const child of Object.values(objectValue)) visit(child);
    Object.freeze(objectValue);
  };
  visit(value);
  return value;
};

const P3_COLOR_BASE_IDS = [
  'white',
  'black_alpha_0',
  'white_weak_glow',
  'azure_very_dark',
  'azure_moderate_glow',
  'azure_dark_alpha_160_glow',
  'azure_very_dark_alpha_224',
  'literal_base',
] as const;

const P3_COLOR_MAPPING_IDS = [
  'table_background_default',
  'row_background',
  'text_normal',
  'icon_normal',
  'button_background_default',
  'button_highlight_default',
  'button_border_default',
  'editbox_background_default',
] as const;

const p3PaddedUtf8 = (text: string, size: number): Uint8Array => {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > size) throw new Error(`P3 fixture exceeds pinned size ${size}`);
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded.fill(0x20, bytes.byteLength);
  return padded;
};

const p3HexDigest = (hex: string): ArrayBuffer => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer;
};

const p3StatusBody = (root: string, generation: string): Record<string, unknown> => {
  const current = { generation, root, generatedAt: '2026-08-18T00:00:00.000Z' };
  return {
    available: true,
    root,
    generatedAt: current.generatedAt,
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current },
  };
};

const p3ManifestStatus = (root: string, generation: string): Record<string, unknown> => ({
  available: true,
  state: 'ready',
  root,
  current: { generation, root, generatedAt: '2026-08-18T00:00:00.000Z' },
});

const p3PathFromQuery = (url: string, key: string): string => {
  const query = url.slice(url.indexOf('?') + 1).split('&');
  const pair = query.find(part => part.startsWith(`${key}=`));
  if (!pair) throw new Error(`P3 fixture query is missing ${key}`);
  return decodeURIComponent(pair.slice(key.length + 1));
};

interface P3ColorFixture {
  readonly buffers: Map<string, Uint8Array>;
  readonly records: Map<string, unknown[]>;
  readonly calls: string[];
  readonly statusBodies: unknown[];
  readonly statusCodes: number[];
  readonly root: string;
  readonly generation: string;
}

const p3MakeColorFixture = (): P3ColorFixture => {
  const root = 'p3-color-corpus-identity';
  const generation = 'p3-color-generation-1';
  const baseIds: string[] = [...P3_COLOR_BASE_IDS];
  while (baseIds.length < 224) baseIds.push(`p3_base_${baseIds.length.toString().padStart(3, '0')}`);
  const specialValues: Record<string, readonly [number, number, number, number, number]> = {
    white: [11, 22, 33, 44, 0.1],
    black_alpha_0: [51, 52, 53, 54, 0.2],
    white_weak_glow: [101, 102, 103, 104, 0.3],
    azure_very_dark: [61, 62, 63, 64, 0.4],
    azure_moderate_glow: [71, 72, 73, 74, 0.5],
    azure_dark_alpha_160_glow: [81, 82, 83, 84, 0.6],
    azure_very_dark_alpha_224: [91, 92, 93, 94, 0.7],
    literal_base: [131, 132, 133, 134, 0.9],
  };
  const colors = baseIds.map((id, index) => {
    const values = specialValues[id] || [index % 256, (index + 1) % 256, (index + 2) % 256, (index + 3) % 256, 0];
    return `    <color id="${id}" r="${values[0]}" g="${values[1]}" b="${values[2]}" a="${values[3]}" glow="${values[4]}"/>`;
  });
  const mappingRefs: Record<string, string> = {
    table_background_default: 'white',
    row_background: 'black_alpha_0',
    text_normal: 'white_weak_glow',
    icon_normal: 'white_weak_glow',
    button_background_default: 'azure_very_dark',
    button_highlight_default: 'azure_moderate_glow',
    button_border_default: 'azure_dark_alpha_160_glow',
    editbox_background_default: 'azure_very_dark_alpha_224',
  };
  const mappings = P3_COLOR_MAPPING_IDS.map(id => `    <mapping id="${id}" ref="${mappingRefs[id]}"/>`);
  for (let index = mappings.length; index < 804; index += 1) {
    mappings.push(`    <mapping id="p3_map_${index.toString().padStart(3, '0')}" ref="${baseIds[index % baseIds.length]}"/>`);
  }
  const xml = p3PaddedUtf8([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<colormap>',
    '  <colors>',
    ...colors,
    '  </colors>',
    '  <mappings>',
    ...mappings,
    '  </mappings>',
    '</colormap>',
  ].join('\n'), X4_UI_CORPUS_COLORS_XML_SIZE);
  const xsd = p3PaddedUtf8([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">',
    '  <xs:simpleType name="identifier"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType>',
    '</xs:schema>',
  ].join('\n'), X4_UI_CORPUS_COLORS_XSD_SIZE);
  const buffers = new Map<string, Uint8Array>([
    [X4_UI_CORPUS_COLORS_XML_PATH, xml],
    [X4_UI_CORPUS_COLORS_XSD_PATH, xsd],
  ]);
  const records = new Map<string, unknown[]>([
    [X4_UI_CORPUS_COLORS_XML_PATH, [{ path: X4_UI_CORPUS_COLORS_XML_PATH, bytes: xml.byteLength }]],
    [X4_UI_CORPUS_COLORS_XSD_PATH, [{ path: X4_UI_CORPUS_COLORS_XSD_PATH, bytes: xsd.byteLength }]],
  ]);
  return {
    buffers,
    records,
    calls: [],
    statusBodies: [p3StatusBody(root, generation), p3StatusBody(root, generation)],
    statusCodes: [200, 200],
    root,
    generation,
  };
};

const p3ColorTransport = (fixture: P3ColorFixture): ((url: string, init?: { readonly signal?: AbortSignal }) => Promise<X4UiCorpusFetchResponse>) =>
  async url => {
    fixture.calls.push(url);
    if (url === X4_UI_CORPUS_STATUS_URL) {
      const index = Math.min(
        fixture.calls.filter(call => call === X4_UI_CORPUS_STATUS_URL).length - 1,
        fixture.statusBodies.length - 1,
      );
      return {
        status: fixture.statusCodes[index] ?? 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => fixture.statusBodies[index],
      };
    }
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = p3PathFromQuery(url, 'q');
      const records = fixture.records.get(path) || [];
      return {
        status: 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => ({
          status: p3ManifestStatus(fixture.root, fixture.generation),
          generation: fixture.generation,
          files: records,
          total: records.length,
          limit: 500,
          offset: 0,
        }),
      };
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = p3PathFromQuery(url, 'path');
      const bytes = (fixture.buffers.get(path) || new Uint8Array()).slice();
      return {
        status: 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/xml' : null },
        arrayBuffer: async () => bytes.buffer,
      };
    }
    throw new Error(`unexpected P3 color URL ${url}`);
  };

const p3WithCanonicalPlatformHash = async <T>(run: () => Promise<T>): Promise<T> => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalValue = (globalThis as unknown as { crypto?: unknown }).crypto;
  let hashIndex = 0;
  const expectedHashes = [X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256];
  const fakeCrypto = {
    subtle: {
      digest: async (): Promise<ArrayBuffer> => {
        const expected = expectedHashes[hashIndex++];
        if (!expected) throw new Error('P3 canonical hash count mismatch');
        return p3HexDigest(expected);
      },
    },
  };
  let result!: T;
  let restoreError: Error | undefined;
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: originalDescriptor?.enumerable ?? true,
      writable: true,
      value: fakeCrypto,
    });
    result = await run();
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
    if ((globalThis as unknown as { crypto?: unknown }).crypto !== originalValue) {
      restoreError = new Error('P3 canonical selftest did not restore global Web Crypto');
    }
  }
  if (restoreError) throw restoreError;
  return result;
};

const p3LoadCanonicalColorAuthority = async (): Promise<X4UiCorpusCanonicalColorSuccess> => {
  const fixture = p3MakeColorFixture();
  const options: X4UiCorpusCanonicalColorLoadOptions = { transport: p3ColorTransport(fixture) };
  const result = await p3WithCanonicalPlatformHash(() => loadCanonicalX4UiCorpusColorEvidence(options));
  if ('error' in result) throw new Error(`P3 canonical color fixture failed: ${result.error.code}: ${result.error.message}`);
  return result;
};

const mutateFactForAudit = (value: unknown): unknown => {
  const fact: Record<string, unknown> = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : { status: 'known', value: 0 };
  const current = fact.value;
  fact.value = typeof current === 'number'
    ? current + 1
    : typeof current === 'boolean'
      ? !current
      : `${String(current)}:audit-forged`;
  fact.provenance = 'audit-forged';
  fact.expression = 'audit-forged-expression';
  fact.source = {
    file: 'audit-forged.lua',
    sourcePath: 'fixture://audit-forged.lua',
    start: { line: 1, column: 0, offset: 1 },
    end: { line: 1, column: 1, offset: 2 },
  };
  fact.sourcePin = { sourcePath: 'fixture://audit-forged.lua', lineStart: 1 };
  fact.sampleId = 'audit-forged-sample';
  return fact;
};

const mutateProgramJson = (
  programValue: X4UiLayoutProgram,
  mutate: (candidate: Record<string, unknown>) => void,
): X4UiLayoutProgram => {
  const candidate = jsonClone(programValue) as unknown as Record<string, unknown>;
  mutate(candidate);
  return freezeClone(candidate) as unknown as X4UiLayoutProgram;
};

const mutateAuthorityJson = (
  authorityValue: EvidenceAuthorityLike,
  mutate: (candidate: Record<string, unknown>) => void,
): EvidenceAuthorityLike => {
  const candidate = jsonClone(authorityValue) as unknown as Record<string, unknown>;
  mutate(candidate);
  return freezeClone(candidate) as unknown as EvidenceAuthorityLike;
};

const programWithAuthority = (
  program: X4UiLayoutProgram,
  authority: unknown,
): { readonly program: X4UiLayoutProgram; readonly evidenceAuthority: EvidenceAuthorityLike } => ({
  program,
  evidenceAuthority: authority as EvidenceAuthorityLike,
});

const refusalCode = (result: ReturnType<typeof projectX4UiLayoutProgram>): string | undefined =>
  'refusal' in result ? result.refusal.code : undefined;

const operation = (program: X4UiLayoutProgram, kind: string, index = 0) =>
  program.operations.filter(candidate => candidate.kind === kind)[index];

const factValue = (programFact: X4UiLayoutProgram['frames'][number]['descriptorFacts'][string] | undefined) =>
  programFact?.status === 'known' ? programFact.value : undefined;

const factProvenance = (programFact: X4UiLayoutProgram['frames'][number]['descriptorFacts'][string] | undefined) =>
  programFact?.status === 'known' ? programFact.provenance : undefined;

const positiveSource = [
  'local menu = { name = "B119", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local frameAlias = frame',
  'local table = frameAlias:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
  'local tableAlias = table',
  'tableAlias:setColWidth(1, 20, false)',
  'tableAlias:setColWidthPercent(2, 25)',
  'local row = tableAlias:addRow(false, { paddingTop = 1, paddingBottom = 2, borderBelow = false, fixed = true, scaling = false })',
  'local rowAlias = row',
  'local cell = rowAlias[1]',
  'local cellAlias = cell',
  'cellAlias:setColSpan(2):createButton({ active = true }):setText("go", { color = "white" }):setText2("label2", { color = "yellow" })',
  'rowAlias[3]:createText("label", { height = 4 })',
  'rowAlias[4]:createEditBox({ height = 6 })',
  'local row2 = tableAlias:addRow(false, {})',
  'row2[1]:createIcon("solid", { height = 8, affectRowHeight = false })',
  'tableAlias:setColWidth(3, 30, false)',
  'local independent = frame:addTable(2, { width = 60 })',
  'independent:addRow(false, {})',
  'function duplicate() local menuOne = { name = "one", layer = 1 }; local frameOne = Helper.createFrameHandle(menuOne, { width = 40, height = 30 }); local tableOne = frameOne:addTable(1, { width = 40 }); tableOne:addRow(false, {}) end',
  'function duplicate() local menuTwo = { name = "two", layer = 1 }; local frameTwo = Helper.createFrameHandle(menuTwo, { width = 50, height = 30 }); local tableTwo = frameTwo:addTable(2, { width = 50 }); tableTwo:addRow(false, {}) end',
].join('\n');

// These are deliberately source-shaped reductions of the reproduced shipping-menu
// evidence. They travel through the real call model, target catalog, projector, and
// producer self-validator; they are not hand-built validator fixtures.
const b119NestedLocalInvocationSource = [
  'local function asciiClean(s)',
  '  return s:gsub("x" .. string.char(1, 2), "y"):gsub("z" .. string.char(3, 4), "w")',
  'end',
  'local menu = { name = "B119", layer = 4 }',
  'function menu.display()',
  '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  '  local table = frame:addTable(1, { width = 80 })',
  '  local row = table:addRow(false, {})',
  '  row[1]:createText(asciiClean("x"), {})',
  '  frame:display()',
  'end',
].join('\n');

const b119PropagatedLayerSource = [
  'local menu = { name = "B119", layer = 4 }',
  'function menu.display()',
  '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = menu.layer })',
  '  frame:display()',
  'end',
].join('\n');

const run = (): { readonly allPassed: boolean; readonly passed: number; readonly total: number; readonly checks: readonly Check[] } => {
  const model = buildX4UiCallModel(input(positiveSource));
  const catalog = createX4UiLayoutTargetCatalog(model);
  const profile = profileFor(model, { minTextHeight: 7 });
  const target = topTarget(model);
  const beforeModel = JSON.stringify(model);
  const beforeProfile = JSON.stringify(profile);
  const result = projectX4UiLayoutProgram(model, target, profile);
  const program = programOf(result);
  const resultAuthority = 'evidenceAuthority' in result ? result.evidenceAuthority : undefined;
  const table = program.tables.find(candidate => candidate.identity?.path === 'table');
  const independent = program.tables.find(candidate => candidate.identity?.path === 'independent');

  const b119NestedLocalInvocationModel = buildX4UiCallModel(input(
    b119NestedLocalInvocationSource,
    'selftest/b119-nested-local-invocation.lua',
  ));
  const b119NestedLocalInvocationResult = projectX4UiLayoutProgram(
    b119NestedLocalInvocationModel,
    namedTarget(b119NestedLocalInvocationModel, 'menu.display'),
    profileFor(b119NestedLocalInvocationModel),
  );
  const b119PropagatedLayerModel = buildX4UiCallModel(input(
    b119PropagatedLayerSource,
    'selftest/b119-propagated-layer.lua',
  ));
  const b119PropagatedLayerResult = projectX4UiLayoutProgram(
    b119PropagatedLayerModel,
    namedTarget(b119PropagatedLayerModel, 'menu.display'),
    profileFor(b119PropagatedLayerModel),
  );

  check('B119 valid repeated/source-bound local invocation shape projects through the real path',
    b119NestedLocalInvocationResult.status !== 'refused'
      && b119NestedLocalInvocationResult.program?.status !== 'refused',
    detail({
      status: b119NestedLocalInvocationResult.status,
      refusal: refusalCode(b119NestedLocalInvocationResult),
    }));
  check('B119 valid direct frame-layer literal provenance projects through the real path',
    b119PropagatedLayerResult.status !== 'refused'
      && b119PropagatedLayerResult.program?.status !== 'refused',
    detail({
      status: b119PropagatedLayerResult.status,
      refusal: refusalCode(b119PropagatedLayerResult),
    }));

  check('fixture Helper constants use the shipped values and exact evidence lines',
    profile.helper.constants.standardTextHeight.value === 16
      && profile.helper.constants.standardTextHeight.source.lineStart === 533
      && profile.helper.constants.standardButtonHeight.value === 25
      && profile.helper.constants.standardButtonHeight.source.lineStart === 522
      && profile.defaults.standardButtonHeight?.value === 25
      && profile.defaults.standardButtonHeight.source.lineStart === 522,
    detail(profile.helper.constants));
  const emptyModel = buildX4UiCallModel(input('', 'selftest/empty.lua'));
  check('source hash implementation matches the independent empty-source vector',
    createX4UiLayoutTargetCatalog(emptyModel).sourceIdentity.sha256 === 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
    detail(createX4UiLayoutTargetCatalog(emptyModel).sourceIdentity));

  check('target catalog is deterministic, frozen, and source-ranged',
    catalog.targets.length === 3
      && catalog.targets.every(candidate => candidate.source.start.offset < candidate.source.end.offset || candidate.kind === 'top-level')
      && Object.isFrozen(catalog)
      && Object.isFrozen(catalog.targets)
      && catalog.targets.every(candidate => Object.isFrozen(candidate.source)),
    detail(catalog.targets));
  const duplicateTargets = catalog.targets.filter(candidate => candidate.kind === 'function' && candidate.name === 'duplicate');
  check('duplicate function names remain separate exact targets', duplicateTargets.length === 2
    && duplicateTargets[0].source.start.offset !== duplicateTargets[1].source.start.offset, detail(duplicateTargets));
  const firstDuplicate = duplicateTargets[0];
  const secondDuplicate = duplicateTargets[1];
  const firstFunction = programOf(projectX4UiLayoutProgram(model, firstDuplicate, profile));
  const secondFunction = programOf(projectX4UiLayoutProgram(model, secondDuplicate, profile));
  check('selecting each duplicate function never flattens the other',
    firstFunction.tables.length === 1
      && secondFunction.tables.length === 1
      && firstFunction.tables[0].numColumns === 1
      && secondFunction.tables[0].numColumns === 2
      && firstFunction.tables[0].frameWidth === 40
      && secondFunction.tables[0].frameWidth === 50,
    detail({ first: firstFunction.tables, second: secondFunction.tables }));
  const wrongSelector: X4UiLayoutTargetSelector = {
    kind: firstDuplicate.kind,
    source: firstDuplicate.source,
    id: secondDuplicate.id,
  };
  check('target ID mismatch refuses even when names and ranges are otherwise close',
    projectX4UiLayoutProgram(model, wrongSelector, profile).status === 'refused', detail(wrongSelector));
  check('direct and aliased frame/table/row/cell chains use one kernel identity',
    result.status !== 'refused'
      && table?.frameId === program.frames.find(candidate => candidate.identity?.path === 'frame')?.id
      && program.operations.filter(candidate => candidate.cellId).map(candidate => candidate.cellId).filter(Boolean).includes(
        program.cells.find(candidate => candidate.identity?.path === 'row[1]')?.id,
      ),
    detail({ table, cells: program.cells, operations: program.operations }));
  check('independent table state is isolated',
    Boolean(table?.kernelState && independent?.kernelState)
      && table?.kernelState?.rows.length === 2
      && independent?.kernelState?.rows.length === 1
      && table?.id !== independent?.id,
    detail({ table, independent }));
  check('equal, percent, and pixel widths are finalized by the accepted kernel',
    Boolean(table?.kernelState)
      && table!.kernelState!.final
      && table!.kernelState!.columns[0].width === 20
      && table!.kernelState!.columns.map(column => column.width).join(',') === '20,24,27,26'
      && factValue(table?.descriptorFacts.finalWidth) === table!.kernelState!.properties.width,
    detail({ columns: table?.kernelState?.columns, facts: table?.descriptorFacts }));
  const tableAdd = operation(program, 'addTable');
  const firstRowAdd = operation(program, 'addRow');
  const secondRowAdd = operation(program, 'addRow', 1);
  check('addTable leaves finalWidth unavailable until the first successfully applied addRow',
    tableAdd?.descriptorFacts.finalWidth?.status === 'unavailable'
      && tableAdd.descriptorFacts.finalWidth.reason === 'table finalization awaits the first successfully applied addRow'
      && firstRowAdd?.status === 'applied'
      && factValue(firstRowAdd.descriptorFacts.finalWidth) === table?.kernelState?.properties.width
      && firstRowAdd.descriptorFacts.finalWidth.status === 'known'
      && firstRowAdd.descriptorFacts.finalWidth.provenance === 'source-pinned-default'
      && firstRowAdd.descriptorFacts.finalWidth.sourcePin?.lineStart === 4895
      && firstRowAdd.descriptorFacts.finalWidth.sourcePin.lineEnd === 4897,
    detail({ tableAdd, firstRowAdd, table: table?.descriptorFacts }));
  check('later rows restate the identical finalized width without changing the table fact',
    secondRowAdd?.status === 'applied'
      && factValue(secondRowAdd.descriptorFacts.finalWidth) === factValue(firstRowAdd?.descriptorFacts.finalWidth)
      && factValue(table?.descriptorFacts.finalWidth) === factValue(firstRowAdd?.descriptorFacts.finalWidth),
    detail({ firstRowAdd, secondRowAdd, table: table?.descriptorFacts }));
  const postRowWidth = operation(program, 'setColWidth', 1);
  check('post-row width setter records exact kernel refusal and prior state',
    postRowWidth?.status === 'rejected'
      && postRowWidth.kernel?.refusal?.code === 'finalized'
      && postRowWidth.kernel?.stateBefore === postRowWidth.kernel.stateAfter
      && factValue(table?.descriptorFacts.finalWidth) === factValue(firstRowAdd?.descriptorFacts.finalWidth),
    detail({ postRowWidth, finalWidth: table?.descriptorFacts.finalWidth }));

  const noRowModel = buildX4UiCallModel(input([
    'local menu = { name = "NoRow", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
  ].join('\n'), 'selftest/final-width-no-row.lua'));
  const noRowProgram = programOf(projectX4UiLayoutProgram(noRowModel, topTarget(noRowModel), profileFor(noRowModel)));
  const noRowTable = noRowProgram.tables[0];
  const noRowAddTable = operation(noRowProgram, 'addTable');
  check('a successful addTable without an applied row keeps finalWidth unavailable',
    noRowAddTable?.status === 'applied'
      && noRowTable.kernelState?.final === false
      && noRowTable.descriptorFacts.finalWidth.status === 'unavailable'
      && noRowAddTable.descriptorFacts.finalWidth?.status === 'unavailable'
      && noRowTable.descriptorFacts.finalWidth.reason === 'table finalization awaits the first successfully applied addRow',
    detail({ operation: noRowAddTable, table: noRowTable }));

  const rejectedRowModel = buildX4UiCallModel(input([
    'local menu = { name = "RejectedRow", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false })',
    'table:addRow(false, { paddingTop = -1 })',
  ].join('\n'), 'selftest/final-width-rejected-row.lua'));
  const rejectedRowProgram = programOf(projectX4UiLayoutProgram(
    rejectedRowModel,
    topTarget(rejectedRowModel),
    profileFor(rejectedRowModel),
  ));
  const rejectedRowTable = rejectedRowProgram.tables[0];
  const rejectedRowAdd = operation(rejectedRowProgram, 'addRow');
  check('a rejected addRow cannot finalize or expose finalWidth',
    rejectedRowAdd?.status === 'rejected'
      && rejectedRowAdd.kernel?.refusal?.code === 'invalid-domain'
      && rejectedRowAdd.descriptorFacts.finalWidth === undefined
      && rejectedRowTable.kernelState?.final === false
      && rejectedRowTable.kernelState.rows.length === 0
      && rejectedRowTable.descriptorFacts.finalWidth.status === 'unavailable',
    detail({ operation: rejectedRowAdd, table: rejectedRowTable }));

  const contractedModel = buildX4UiCallModel(input([
    'local menu = { name = "Contracted", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 30, false)',
    'table:addRow(false, { scaling = false })',
    'table:addRow(false, { scaling = false })',
    'table:setColWidth(1, 40, false)',
  ].join('\n'), 'selftest/final-width-contracted.lua'));
  const contractedProgram = programOf(projectX4UiLayoutProgram(
    contractedModel,
    topTarget(contractedModel),
    profileFor(contractedModel),
  ));
  const contractedTable = contractedProgram.tables[0];
  const contractedRows = contractedProgram.operations.filter(candidate => candidate.kind === 'addRow');
  const contractedRefusal = operation(contractedProgram, 'setColWidth', 2);
  check('all-fixed columns report the contracted width from the first addRow kernel result',
    contractedTable.requestedWidth === 100
      && contractedTable.kernelState?.properties.width === 51
      && factValue(contractedTable.descriptorFacts.finalWidth) === 51
      && factValue(contractedRows[0]?.descriptorFacts.finalWidth) === 51
      && contractedTable.descriptorFacts.finalWidth.sourcePin?.lineStart === 4895
      && contractedTable.descriptorFacts.finalWidth.sourcePin.lineEnd === 4897,
    detail({ table: contractedTable, firstRow: contractedRows[0] }));
  check('repeated rows and a post-freeze width refusal retain the contracted finalWidth',
    contractedRows.length === 2
      && contractedRows.every(candidate => candidate.status === 'applied' && factValue(candidate.descriptorFacts.finalWidth) === 51)
      && contractedRefusal?.status === 'rejected'
      && contractedRefusal.kernel?.refusal?.code === 'finalized'
      && contractedRefusal.kernel?.stateBefore === contractedRefusal.kernel.stateAfter
      && factValue(contractedTable.descriptorFacts.finalWidth) === 51,
    detail({ rows: contractedRows, refusal: contractedRefusal, table: contractedTable }));

  const rowSemanticsSource = [
    'local menu = { name = "Rows", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false })',
    'table:addRow()',
    'table:addRow(nil, {})',
    'table:addRow(false, {})',
    'table:addRow(true, { interactive = false })',
    'table:addRow(0, {})',
    'table:addRow("", {})',
    'table:addRow({}, {})',
    'table:addRow(runtimeRowData, { interactive = runtimeInteractive })',
  ].join('\n');
  const rowSemanticsModel = buildX4UiCallModel(input(rowSemanticsSource, 'selftest/row-semantics.lua'));
  const rowSemanticsProfile = profileFor(rowSemanticsModel);
  const rowSemanticsProgram = programOf(projectX4UiLayoutProgram(
    rowSemanticsModel,
    topTarget(rowSemanticsModel),
    rowSemanticsProfile,
  ));
  const rowSemanticsAdds = rowSemanticsProgram.operations.filter(candidate => candidate.kind === 'addRow');
  const rowSelectableFacts = rowSemanticsProgram.rows.map(candidate => candidate.descriptorFacts.selectable);
  check('Lua rowdata truthiness produces exact selectable facts without blocking row geometry',
    rowSemanticsProgram.tables[0].kernelState?.rows.length === 8
      && rowSemanticsAdds.every(candidate => candidate.status === 'applied')
      && factValue(rowSelectableFacts[0]) === false
      && factValue(rowSelectableFacts[1]) === false
      && factValue(rowSelectableFacts[2]) === false
      && factValue(rowSelectableFacts[3]) === true
      && factValue(rowSelectableFacts[4]) === true
      && factValue(rowSelectableFacts[5]) === true
      && factValue(rowSelectableFacts[6]) === true
      && rowSelectableFacts.slice(0, 7).every(fact => fact.sourcePin?.lineStart === 5087 && fact.sourcePin.lineEnd === 5118)
      && rowSelectableFacts[7].status === 'unavailable'
      && factValue(rowSemanticsAdds[7].descriptorFacts.finalWidth) === rowSemanticsProgram.tables[0].kernelState?.properties.width,
    detail({ rows: rowSemanticsProgram.rows, operations: rowSemanticsAdds }));
  const interactiveSample = rowSemanticsProgram.sampleCatalog.entries.find(entry =>
    entry.consumers.some(consumer => consumer.field === 'interactive'));
  check('row interactive default, explicit false, and dynamic evidence remain independent from selectable',
    factValue(rowSemanticsProgram.rows[0].descriptorFacts.interactive) === true
      && rowSemanticsProgram.rows[0].descriptorFacts.interactive.sourcePin?.lineStart === 3192
      && factValue(rowSemanticsProgram.rows[3].descriptorFacts.interactive) === false
      && rowSemanticsProgram.rows[7].descriptorFacts.interactive.status === 'unavailable'
      && interactiveSample?.expression === 'runtimeInteractive'
      && !rowSemanticsProgram.sampleCatalog.entries.some(entry => entry.expression === 'runtimeRowData')
      && rowSemanticsProgram.gaps.some(gap => gap.expression === 'runtimeRowData' && gap.category === 'row'),
    detail({ catalog: rowSemanticsProgram.sampleCatalog, rows: rowSemanticsProgram.rows, gaps: rowSemanticsProgram.gaps }));
  if (!interactiveSample) throw new Error('row interactive sample missing');
  const rowInteractiveSamples: X4UiLayoutPreviewSampleInput = {
    catalogId: rowSemanticsProgram.sampleCatalog.id,
    source: rowSemanticsProgram.sampleCatalog.sourceIdentity,
    values: [{ id: interactiveSample.id, value: false }],
  };
  const sampledRowSemanticsProgram = programOf(projectX4UiLayoutProgram(
    rowSemanticsModel,
    topTarget(rowSemanticsModel),
    rowSemanticsProfile,
    rowInteractiveSamples,
  ));
  check('exact-range interactive sample changes only descriptor evidence and not rowdata or kernel geometry',
    factValue(sampledRowSemanticsProgram.rows[7].descriptorFacts.interactive) === false
      && factProvenance(sampledRowSemanticsProgram.rows[7].descriptorFacts.interactive) === 'preview-sample'
      && sampledRowSemanticsProgram.rows[7].descriptorFacts.selectable.status === 'unavailable'
      && sampledRowSemanticsProgram.tables[0].kernelState?.rows.length === 8
      && JSON.stringify(sampledRowSemanticsProgram.tables[0].kernelState)
        === JSON.stringify(rowSemanticsProgram.tables[0].kernelState),
    detail({ row: sampledRowSemanticsProgram.rows[7], bindings: sampledRowSemanticsProgram.previewSampleBindings }));

  const span = operation(program, 'setColSpan');
  const button = operation(program, 'createButton');
  const setText = operation(program, 'setText');
  check('fluent colspan/button/text calls retain the same cell identity and order',
    Boolean(span?.cellId)
      && span?.cellId === button?.cellId
      && button?.cellId === setText?.cellId
      && span!.modelOrder < button!.modelOrder
      && button!.modelOrder < setText!.modelOrder
      && span!.sourceOrder === span!.source.start.offset
      && button!.sourceOrder === button!.source.start.offset
      && setText!.sourceOrder === setText!.source.start.offset,
    detail({ span, button, setText }));
  const setText2 = operation(program, 'setText2');
  check('setText2 remains metadata on the same shipped button cell',
    Boolean(button?.cellId) && button?.cellId === setText2?.cellId
      && program.cells.find(candidate => candidate.id === button?.cellId)?.metadataOperationIds.includes(setText2!.id) === true,
    detail({ button, setText2 }));
  const buttonCell = program.cells.find(candidate => candidate.id === button?.cellId);
  const editCell = program.cells.find(candidate => candidate.kernelState?.type === 'editbox');
  const iconCell = program.cells.find(candidate => candidate.kernelState?.type === 'icon');
  check('button default, explicit editbox, and affectRowHeight=false icon follow the kernel',
    buttonCell?.kernelState?.type === 'button'
      && buttonCell.kernelState.height === 25
      && editCell?.kernelState?.height === 6
      && iconCell?.kernelState?.height === 8
      && iconCell.kernelState.affectRowHeight === false
      && program.rows.find(candidate => candidate.id === iconCell.rowId)?.height?.value === 1,
    detail({ buttonCell, editCell, iconCell }));
  check('all operations retain source order and source locations',
    program.operations.every((candidate, index) => index === 0 || candidate.sourceOrder >= program.operations[index - 1].sourceOrder)
      && program.operations.every(candidate => positiveSource.slice(candidate.source.start.offset, candidate.source.end.offset).includes(candidate.kind)),
    detail(program.operations.map(candidate => ({ kind: candidate.kind, order: candidate.sourceOrder }))));

  const sourceOrderSource = [
    'local menu = { name = "SourceOrder", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidthPercent(2, 50)',
    'local row = table:addRow(false, { scaling = false })',
    'row[1]:setColSpan(2):createButton({ height = 10, scaling = false }):setText("one", {})',
    'row[2]:createText("two", {})',
    'frame:display()',
    'OpenMenu(menu)',
  ].join('\n');
  const sourceOrderModel = buildX4UiCallModel(input(sourceOrderSource, 'selftest/source-order.lua'));
  const sourceOrderProgram = programOf(projectX4UiLayoutProgram(
    sourceOrderModel,
    topTarget(sourceOrderModel),
    profileFor(sourceOrderModel),
  ));
  const sourceOrderKinds = [
    'createFrameHandle', 'addTable', 'setColWidth', 'setColWidthPercent', 'addRow',
    'setColSpan', 'createButton', 'setText', 'createText', 'display', 'OpenMenu',
  ] as const;
  const sourceOrderModelCalls = sourceOrderModel.calls
    .filter(candidate => sourceOrderKinds.includes(candidate.name as typeof sourceOrderKinds[number]))
    .sort((left, right) => left.order - right.order);
  const sourceOrderPairs = sourceOrderModelCalls.map(call => ({
    call,
    operation: sourceOrderProgram.operations.find(candidate =>
      candidate.kind === call.name && candidate.modelOrder === call.order),
  }));
  const sourceOrderPairPasses = (pair: typeof sourceOrderPairs[number]): boolean => {
    const { call, operation } = pair;
    if (!operation) return false;
    return operation.sourceOrder === operation.source.start.offset
      && operation.sourceOrder === call.source.start.offset
      && operation.modelOrder === call.order;
  };
  const sourceOrderOperations = sourceOrderPairs
    .map(pair => pair.operation)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const fluentKinds = ['setColSpan', 'createButton', 'setText'] as const;
  const fluentPairs = sourceOrderPairs.filter(pair => fluentKinds.includes(
    pair.call.name as typeof fluentKinds[number]));
  const fluentCallKinds = fluentPairs.map(pair => pair.call.name);
  const fluentOperationKinds = sourceOrderOperations
    .filter(candidate => fluentKinds.includes(candidate.kind as typeof fluentKinds[number]))
    .map(candidate => candidate.kind);
  check('raw member/global operations pair exactly to complete call starts',
    sourceOrderPairs.length === sourceOrderKinds.length
      && sourceOrderModelCalls.length === sourceOrderKinds.length
      && sourceOrderKinds.every(kind => sourceOrderModelCalls.filter(candidate => candidate.name === kind).length
        === sourceOrderOperations.filter(candidate => candidate.kind === kind).length)
      && sourceOrderPairs.every(sourceOrderPairPasses)
      && sourceOrderPairs.some(pair => pair.call.sourceOrder !== pair.call.source.start.offset)
      && JSON.stringify(fluentCallKinds) === JSON.stringify(fluentKinds)
      && JSON.stringify(fluentOperationKinds) === JSON.stringify(fluentKinds)
      && fluentPairs.every(pair => pair.operation?.modelOrder === pair.call.order),
    detail({
      model: sourceOrderModelCalls.map(candidate => ({
        kind: candidate.name,
        source: candidate.source,
        sourceOrder: candidate.sourceOrder,
        modelOrder: candidate.order,
      })),
      operations: sourceOrderOperations.map(candidate => ({
        kind: candidate.kind,
        source: candidate.source,
        sourceOrder: candidate.sourceOrder,
        modelOrder: candidate.modelOrder,
      })),
    }));
  const shiftedModelOrderPair = sourceOrderPairs[0];
  const shiftedModelOrderRejected = shiftedModelOrderPair?.operation
    ? !sourceOrderPairPasses({
      ...shiftedModelOrderPair,
      operation: {
        ...shiftedModelOrderPair.operation,
        modelOrder: shiftedModelOrderPair.operation.modelOrder + 1000,
      },
    })
    : false;
  check('source-order review guard rejects a shifted operation modelOrder',
    shiftedModelOrderRejected,
    detail({ shiftedModelOrderPair, shiftedModelOrderRejected }));

  const rowScalingSource = [
    'local menu = { name = "RowScaling", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local inheritedTrueTable = frame:addTable(1, { width = 40, reserveScrollBar = false, scaling = true })',
    'local inheritedTrueRow1 = inheritedTrueTable:addRow(false, {})',
    'local inheritedTrueRow2 = inheritedTrueTable:addRow(false, {})',
    'local inheritedFalseTable = frame:addTable(1, { width = 41, reserveScrollBar = false, scaling = false })',
    'local inheritedFalseRow = inheritedFalseTable:addRow(false, {})',
    'local explicitTrueTable = frame:addTable(1, { width = 42, reserveScrollBar = false, scaling = false })',
    'local explicitTrueRow = explicitTrueTable:addRow(false, { scaling = true })',
    'local explicitFalseTable = frame:addTable(1, { width = 43, reserveScrollBar = false, scaling = true })',
    'local explicitFalseRow = explicitFalseTable:addRow(false, { scaling = false })',
  ].join('\n');
  const rowScalingModel = buildX4UiCallModel(input(rowScalingSource, 'selftest/row-scaling.lua'));
  const rowScalingProgram = programOf(projectX4UiLayoutProgram(
    rowScalingModel,
    topTarget(rowScalingModel),
    profileFor(rowScalingModel),
  ));
  const rowScalingAdds = rowScalingProgram.operations.filter(candidate => candidate.kind === 'addRow');
  const rowScalingCalls = rowScalingModel.calls
    .filter(candidate => candidate.name === 'addRow')
    .sort((left, right) => left.order - right.order);
  const rowScalingPairs = rowScalingCalls.map(call => {
    const operation = rowScalingAdds.find(candidate =>
      candidate.kind === call.name && candidate.modelOrder === call.order);
    return {
      call,
      operation,
      row: operation?.rowId
        ? rowScalingProgram.rows.find(rowNode => rowNode.id === operation.rowId)
        : undefined,
      table: operation?.tableId
        ? rowScalingProgram.tables.find(tableNode => tableNode.id === operation.tableId)
        : undefined,
    };
  });
  const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
  const scalingPairPasses = (
    pair: typeof rowScalingPairs[number],
    expected: boolean,
    tableExpected = expected,
    operationFact = pair.operation?.descriptorFacts.scaling,
    rowFact = pair.row?.descriptorFacts.scaling,
  ): boolean => {
    const { call, operation, row, table } = pair;
    const tableFact = table?.descriptorFacts.scaling;
    if (!operation || !row || !table || !operationFact || !rowFact || !tableFact) return false;
    if (operation.kind !== call.name
      || operation.modelOrder !== call.order
      || operation.sourceOrder !== operation.source.start.offset
      || operation.sourceOrder !== call.source.start.offset
      || operation.tableId !== table.id
      || operation.rowId !== row.id
      || call.semantics.table?.reference?.path !== table.identity?.path
      || call.result?.path !== row.identity?.path) return false;
    if (operationFact.status !== 'known' || rowFact.status !== 'known' || tableFact.status !== 'known') return false;
    if (!sameJson(operationFact, rowFact)
      || operationFact.value !== expected
      || rowFact.value !== expected
      || tableFact.value !== tableExpected
      || table.kernelState?.final !== true
      || table.kernelState.properties.scaling !== tableExpected
      || row.kernelState?.scaling !== expected
      || operation.kernel?.stateAfter?.rows.at(-1)?.scaling !== expected) return false;
    const scalingProperty = call.semantics.properties?.find(candidate => candidate.normalizedName === 'scaling');
    if (!scalingProperty) {
      return operationFact.provenance === tableFact.provenance
        && sameJson(operationFact.source, tableFact.source)
        && sameJson(operationFact.sourcePin, tableFact.sourcePin)
        && operationFact.expression === 'row scaling inherited from owning table properties.scaling';
    }
    return operationFact.provenance === 'source-literal'
      && sameJson(operationFact.source, scalingProperty.source)
      && sameJson(operationFact.source, scalingProperty.value.location)
      && operationFact.sourcePin === undefined
      && operationFact.expression === scalingProperty.value.expression;
  };
  const rowScalingCases = [
    { path: 'inheritedTrueRow1', value: true, tableValue: true, inherited: true },
    { path: 'inheritedTrueRow2', value: true, tableValue: true, inherited: true },
    { path: 'inheritedFalseRow', value: false, tableValue: false, inherited: true },
    { path: 'explicitTrueRow', value: true, tableValue: false, inherited: false },
    { path: 'explicitFalseRow', value: false, tableValue: true, inherited: false },
  ] as const;
  const rowScalingCasePairs = rowScalingCases.map(testCase => ({
    ...testCase,
    pair: rowScalingPairs.find(candidate => candidate.row?.identity?.path === testCase.path),
  }));
  const inheritedTrueRow1 = rowScalingCasePairs.find(candidate => candidate.path === 'inheritedTrueRow1')?.pair;
  const inheritedTrueRow2 = rowScalingCasePairs.find(candidate => candidate.path === 'inheritedTrueRow2')?.pair;
  const explicitTruePair = rowScalingCasePairs.find(candidate => candidate.path === 'explicitTrueRow')?.pair;
  const explicitTrueFact = explicitTruePair?.operation?.descriptorFacts.scaling;
  const explicitTrueOwnerFact = explicitTruePair?.table?.descriptorFacts.scaling;
  const mutatedExplicitTrueFact = explicitTrueFact?.status === 'known' && explicitTrueOwnerFact?.status === 'known'
    ? { ...explicitTrueFact, source: explicitTrueOwnerFact.source }
    : undefined;
  const ownerSourceMutationRejected = explicitTruePair && mutatedExplicitTrueFact
    ? !scalingPairPasses(explicitTruePair, true, false, mutatedExplicitTrueFact, mutatedExplicitTrueFact)
    : false;
  check('omitted row scaling inherits table truth while explicit scaling overrides it',
    rowScalingAdds.length === rowScalingCases.length
      && rowScalingCalls.length === rowScalingCases.length
      && rowScalingPairs.length === rowScalingCalls.length
      && rowScalingCasePairs.every(testCase => testCase.pair !== undefined
        && scalingPairPasses(testCase.pair, testCase.value, testCase.tableValue))
      && rowScalingCasePairs.filter(testCase => testCase.inherited).length === 3
      && rowScalingCasePairs.filter(testCase => testCase.inherited).every(testCase =>
        testCase.pair?.call.semantics.properties?.some(candidate => candidate.normalizedName === 'scaling') !== true)
      && rowScalingCasePairs.filter(testCase => !testCase.inherited).every(testCase =>
        testCase.pair?.call.semantics.properties?.some(candidate => candidate.normalizedName === 'scaling') === true)
      && inheritedTrueRow1?.table?.kernelState?.rows.length === 2
      && inheritedTrueRow1?.operation?.kernel?.stateAfter?.properties.width
        === inheritedTrueRow2?.operation?.kernel?.stateAfter?.properties.width
      && sameJson(
        inheritedTrueRow1?.operation?.kernel?.stateAfter?.columns,
        inheritedTrueRow2?.operation?.kernel?.stateAfter?.columns,
      ),
    detail({
      cases: rowScalingCasePairs,
      explicitTrueFact,
      explicitTrueOwnerFact,
    }));
  check('scaling review guard rejects explicit fact source replaced with owning-table source',
    ownerSourceMutationRejected,
    detail({ explicitTruePair, mutatedExplicitTrueFact, ownerSourceMutationRejected }));

  const allKindBody = [
    'local sx = Helper.scaleX(40, true)',
    'local sy = Helper.scaleY(20, true)',
    'local sf = Helper.scaleFont("Zekton", 12, true)',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidthPercent(2, 25)',
    'local row = table:addRow(false, { scaling = false })',
    'row[1]:setColSpan(2):createButton({ height = 10, scaling = false }):setText("button", {}):setText2("button2", {})',
    'row[3]:createText("text", {})',
    'row[4]:createEditBox({ height = 10 })',
    'local row2 = table:addRow(false, { scaling = false })',
    'row2[1]:createIcon("solid", { height = 8, scaling = false })',
    'frame:display()',
    'OpenMenu(menu)',
  ];
  const allKindKinds = [
    'scaleX', 'scaleY', 'scaleFont', 'createFrameHandle', 'addTable', 'setColWidth',
    'setColWidthPercent', 'addRow', 'setColSpan', 'createButton', 'setText', 'setText2',
    'createText', 'createEditBox', 'addRow', 'createIcon', 'display', 'OpenMenu',
  ] as const;
  const allKindSource = [
    'local menu = { name = "AllKinds", layer = 1 }',
    ...allKindBody,
  ].join('\n');
  const allKindModel = buildX4UiCallModel(input(allKindSource, 'selftest/evidence-all-kinds.lua'));
  const allKindCalls = allKindModel.calls
    .filter(call => (allKindKinds as readonly string[]).includes(call.name))
    .sort((left, right) => left.order - right.order);
  const allKindResult = projectX4UiLayoutProgram(
    allKindModel,
    topTarget(allKindModel),
    profileFor(allKindModel),
  );
  const allKindProgram = programOf(allKindResult);
  const allKindAuthority = evidenceAuthorityOf(allKindResult);
  const allKindManifestPasses = Boolean(allKindAuthority)
    && new Set(allKindKinds).size === 17
    && allKindAuthority!.calls.length === allKindKinds.length
    && allKindAuthority!.operations.length === allKindKinds.length
    && allKindAuthority!.calls.every((entry, index) => {
      const operation = allKindProgram.operations[index];
      const manifestOperation = allKindAuthority!.operations[index];
      return entry.kind === allKindKinds[index]
        && manifestOperation?.kind === allKindKinds[index]
        && operation?.kind === allKindKinds[index]
        && entry.operationId === operation?.id
        && allKindCalls[index] !== undefined
        && entry.kind === allKindCalls[index].name
        && sameJson(entry.source, allKindCalls[index].source)
        && entry.sourceOrder === allKindCalls[index].source.start.offset
        && entry.modelOrder === allKindCalls[index].order
        && manifestOperation.id === operation?.id
        && manifestOperation.callId === entry.id
        && sameJson(manifestOperation.source, operation.source)
        && manifestOperation.sourceOrder === operation.sourceOrder
        && manifestOperation.modelOrder === operation.modelOrder
        && entry.streamIndex === index
        && manifestOperation.streamIndex === index
        && entry.sourceOrder === operation.source.start.offset
        && entry.modelOrder === operation.modelOrder
        && entry.status === operation.status
        && manifestOperation.status === operation.status;
    })
    && new Set(allKindAuthority!.calls.map(entry => entry.id)).size === allKindKinds.length
    && new Set(allKindAuthority!.operations.map(entry => entry.id)).size === allKindKinds.length;
  check('evidence manifest covers every untouched static all-kind call in exact source order and operation bijection',
    allKindManifestPasses,
    detail({ authority: allKindAuthority, operations: allKindProgram.operations }));

  type NodeCollectionName = 'frames' | 'tables' | 'rows' | 'cells';
  const malformedNodeCollectionProgram = (
    collection: NodeCollectionName,
    value: unknown,
  ): X4UiLayoutProgram => freezeClone({
    ...allKindProgram,
    [collection]: value,
  }) as X4UiLayoutProgram;
  const validatorRejectsWithoutThrow = (candidate: X4UiLayoutProgram): boolean => {
    try {
      return validateX4UiLayoutEvidencePair(candidate, allKindAuthority!).valid === false;
    } catch {
      return false;
    }
  };
  const malformedNodeCollectionValues: readonly unknown[] = [null, 0, {}, [null], [1]];
  for (const collection of ['frames', 'tables', 'rows', 'cells'] as const) {
    check(`public evidence validator fail-closes malformed ${collection} collections and entries`,
      allKindAuthority !== undefined
        && malformedNodeCollectionValues.every(value =>
          validatorRejectsWithoutThrow(malformedNodeCollectionProgram(collection, value))),
      detail({ collection, malformedNodeCollectionValues }));
  }

  const safeSchemaPairValidation = (
    candidateProgram: X4UiLayoutProgram,
    candidateAuthority: EvidenceAuthorityLike | undefined = allKindAuthority,
  ): { readonly threw: boolean; readonly valid?: boolean; readonly reason?: string } => {
    if (candidateAuthority === undefined) return { threw: false, valid: false, reason: 'missing authority fixture' };
    try {
      const validation = validateX4UiLayoutEvidencePair(candidateProgram, candidateAuthority);
      return {
        threw: false,
        valid: validation.valid,
        reason: 'reason' in validation ? validation.reason : undefined,
      };
    } catch {
      return { threw: true };
    }
  };
  const schemaProgramMutation = (
    mutate: (candidate: Record<string, unknown>) => void,
  ): X4UiLayoutProgram => mutateProgramJson(allKindProgram, mutate);
  const schemaProgramCycleMutation = (
    mutate: (candidate: Record<string, unknown>) => void,
  ): X4UiLayoutProgram => {
    const candidate = jsonClone(allKindProgram) as unknown as Record<string, unknown>;
    mutate(candidate);
    return freezeCycleClone(candidate) as unknown as X4UiLayoutProgram;
  };
  const rootSchemaAttacks: readonly { readonly name: string; readonly value: X4UiLayoutProgram }[] = [
    { name: 'unknown program-root key', value: schemaProgramMutation(candidate => { candidate.auditUnknownRoot = true; }) },
    { name: 'missing program status', value: schemaProgramMutation(candidate => { delete candidate.status; }) },
    { name: 'missing program profile', value: schemaProgramMutation(candidate => { delete candidate.profile; }) },
    {
      name: 'program-root self-cycle',
      value: schemaProgramCycleMutation(candidate => { candidate.auditCycle = candidate; }),
    },
    {
      name: 'target self-cycle',
      value: schemaProgramCycleMutation(candidate => {
        const target = candidate.target as Record<string, unknown>;
        target.auditCycle = target;
      }),
    },
    {
      name: 'profile self-cycle',
      value: schemaProgramCycleMutation(candidate => {
        const profile = candidate.profile as Record<string, unknown>;
        profile.auditCycle = profile;
      }),
    },
    {
      name: 'function-valued profile provenance',
      value: schemaProgramMutation(candidate => {
        const profile = candidate.profile as Record<string, unknown>;
        profile.provenance = () => 'forged';
      }),
    },
    { name: 'root symbol value', value: schemaProgramMutation(candidate => { candidate.auditSymbol = Symbol('forged'); }) },
    { name: 'root bigint value', value: schemaProgramMutation(candidate => { candidate.auditBigint = BigInt(7); }) },
    { name: 'root undefined value', value: schemaProgramMutation(candidate => { candidate.auditUndefined = undefined; }) },
    {
      name: 'profile metrics NaN',
      value: schemaProgramMutation(candidate => {
        const profile = candidate.profile as Record<string, unknown>;
        const metrics = profile.metrics as Record<string, unknown>;
        metrics.uiScale = Number.NaN;
      }),
    },
    {
      name: 'profile metrics Infinity',
      value: schemaProgramMutation(candidate => {
        const profile = candidate.profile as Record<string, unknown>;
        const metrics = profile.metrics as Record<string, unknown>;
        metrics.uiScale = Number.POSITIVE_INFINITY;
      }),
    },
    {
      name: 'profile metrics changed to array',
      value: schemaProgramMutation(candidate => {
        const profile = candidate.profile as Record<string, unknown>;
        profile.metrics = [];
      }),
    },
    {
      name: 'program verification claim changed from the fixed boundary',
      value: schemaProgramMutation(candidate => {
        const verification = candidate.verification as Record<string, unknown>;
        verification.gameVerified = true;
      }),
    },
  ];
  for (const attack of rootSchemaAttacks) {
    const validation = safeSchemaPairValidation(attack.value);
    check(`closed program schema rejects ${attack.name} without throwing`,
      validation.threw === false && validation.valid === false,
      detail({ attack: attack.name, validation }));
  }

  const actualOperationSnapshotPair = (
    index: number,
    mutateProgram: (operation: Record<string, unknown>) => void,
    mutateSnapshot: (snapshot: Record<string, unknown>) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } => {
    const candidateProgram = jsonClone(allKindProgram) as unknown as Record<string, unknown>;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as Record<string, unknown>;
    const programOperation = (candidateProgram.operations as Record<string, unknown>[])[index];
    const authorityOperation = (candidateAuthority.operations as Record<string, unknown>[])[index];
    if (programOperation) mutateProgram(programOperation);
    if (authorityOperation) mutateSnapshot(authorityOperation.snapshot as Record<string, unknown>);
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
    };
  };
  const actualOperationSnapshotPairFor = (
    sourceProgram: X4UiLayoutProgram,
    sourceAuthority: EvidenceAuthorityLike,
    index: number,
    mutateProgram: (operation: Record<string, unknown>) => void,
    mutateSnapshot: (snapshot: Record<string, unknown>) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } => {
    const candidateProgram = jsonClone(sourceProgram) as unknown as Record<string, unknown>;
    const candidateAuthority = jsonClone(sourceAuthority) as unknown as Record<string, unknown>;
    const programOperation = (candidateProgram.operations as Record<string, unknown>[])[index];
    const authorityOperation = (candidateAuthority.operations as Record<string, unknown>[])[index];
    if (programOperation) mutateProgram(programOperation);
    if (authorityOperation) mutateSnapshot(authorityOperation.snapshot as Record<string, unknown>);
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
    };
  };
  const operationUnknownKeyAttacks = allKindProgram.operations.map((candidate, index) => {
    const pair = actualOperationSnapshotPair(
      index,
      operationValue => { operationValue.auditUnknownOperationKey = true; },
      snapshot => { snapshot.auditUnknownOperationKey = true; },
    );
    return { index, kind: candidate.kind, pair };
  });
  for (const attack of operationUnknownKeyAttacks) {
    const validation = safeSchemaPairValidation(attack.pair.program, attack.pair.authority);
    check(`closed operation schema rejects coordinated unknown key ${attack.index}:${attack.kind}`,
      validation.threw === false && validation.valid === false,
      detail({ index: attack.index, kind: attack.kind, validation }));
  }
  const firstOperationWithFact = allKindProgram.operations.findIndex(candidate =>
    Object.keys(candidate.descriptorFacts).length > 0);
  const firstFactKey = firstOperationWithFact < 0
    ? undefined
    : Object.keys(allKindProgram.operations[firstOperationWithFact].descriptorFacts)[0];
  const coordinatedOperationSchemaAttacks = firstOperationWithFact >= 0 && firstFactKey !== undefined
    ? [
      {
        name: 'missing operation metadata',
        pair: actualOperationSnapshotPair(firstOperationWithFact,
          operationValue => { delete (operationValue.metadata as Record<string, unknown>).semantics; },
          snapshot => { delete (snapshot.metadata as Record<string, unknown>).semantics; }),
      },
      {
        name: 'descriptor fact missing required status',
        pair: actualOperationSnapshotPair(firstOperationWithFact,
          operationValue => { delete ((operationValue.descriptorFacts as Record<string, unknown>)[firstFactKey] as Record<string, unknown>).status; },
          snapshot => { delete (((snapshot.descriptorFacts as Record<string, unknown>)[firstFactKey]) as Record<string, unknown>).status; }),
      },
      {
        name: 'unknown descriptor-fact key',
        pair: actualOperationSnapshotPair(firstOperationWithFact,
          operationValue => { ((operationValue.descriptorFacts as Record<string, unknown>)[firstFactKey] as Record<string, unknown>).auditUnknownFact = true; },
          snapshot => { ((snapshot.descriptorFacts as Record<string, unknown>)[firstFactKey] as Record<string, unknown>).auditUnknownFact = true; }),
      },
      {
        name: 'metadata arguments changed array to object',
        pair: actualOperationSnapshotPair(firstOperationWithFact,
          operationValue => { (operationValue.metadata as Record<string, unknown>).arguments = {}; },
          snapshot => { (snapshot.metadata as Record<string, unknown>).arguments = {}; }),
      },
    ]
    : [];
  for (const attack of coordinatedOperationSchemaAttacks) {
    const validation = safeSchemaPairValidation(attack.pair.program, attack.pair.authority);
    check(`closed coordinated operation schema rejects ${attack.name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: attack.name, validation }));
  }

  type SchemaNodeCollection = 'frames' | 'tables' | 'rows' | 'cells';
  const schemaNodeLocations: readonly { readonly collection: SchemaNodeCollection; readonly index: number; readonly id: string }[] = [
    ...allKindProgram.frames.map((node, index) => ({ collection: 'frames' as const, index, id: node.id })),
    ...allKindProgram.tables.map((node, index) => ({ collection: 'tables' as const, index, id: node.id })),
    ...allKindProgram.rows.map((node, index) => ({ collection: 'rows' as const, index, id: node.id })),
    ...allKindProgram.cells.map((node, index) => ({ collection: 'cells' as const, index, id: node.id })),
  ];
  const actualNodeSnapshotPair = (
    location: { readonly collection: SchemaNodeCollection; readonly index: number },
    mutateProgram: (node: Record<string, unknown>) => void,
    mutateSnapshot: (snapshot: Record<string, unknown>) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } => {
    const candidateProgram = jsonClone(allKindProgram) as unknown as Record<string, unknown>;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as Record<string, unknown>;
    const programNode = (candidateProgram[location.collection] as Record<string, unknown>[])[location.index];
    const authorityNodes = (candidateAuthority.nodes as Record<string, unknown>)[location.collection] as Record<string, unknown>[];
    const authorityNode = authorityNodes[location.index];
    if (programNode) mutateProgram(programNode);
    if (authorityNode) mutateSnapshot(authorityNode.snapshot as Record<string, unknown>);
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
    };
  };
  const actualNodeSnapshotPairFor = (
    sourceProgram: X4UiLayoutProgram,
    sourceAuthority: EvidenceAuthorityLike,
    location: { readonly collection: SchemaNodeCollection; readonly index: number },
    mutateProgram: (node: Record<string, unknown>) => void,
    mutateSnapshot: (snapshot: Record<string, unknown>) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } => {
    const candidateProgram = jsonClone(sourceProgram) as unknown as Record<string, unknown>;
    const candidateAuthority = jsonClone(sourceAuthority) as unknown as Record<string, unknown>;
    const programNode = (candidateProgram[location.collection] as Record<string, unknown>[])[location.index];
    const authorityNodes = (candidateAuthority.nodes as Record<string, unknown>)[location.collection] as Record<string, unknown>[];
    const authorityNode = authorityNodes[location.index];
    if (programNode) mutateProgram(programNode);
    if (authorityNode) mutateSnapshot(authorityNode.snapshot as Record<string, unknown>);
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
    };
  };
  const nodeUnknownKeyAttacks = schemaNodeLocations.map(location => ({
    ...location,
    pair: actualNodeSnapshotPair(
      location,
      node => { node.auditUnknownNodeKey = true; },
      snapshot => { snapshot.auditUnknownNodeKey = true; },
    ),
  }));
  for (const attack of nodeUnknownKeyAttacks) {
    const validation = safeSchemaPairValidation(attack.pair.program, attack.pair.authority);
    check(`closed node schema rejects coordinated unknown key ${attack.collection}[${attack.index}]`,
      validation.threw === false && validation.valid === false,
      detail({ collection: attack.collection, index: attack.index, id: attack.id, validation }));
  }
  const firstNodeLocation = schemaNodeLocations[0];
  const coordinatedNodeSchemaAttacks = firstNodeLocation
    ? [
      {
        name: 'node descriptorFacts changed object to array',
        pair: actualNodeSnapshotPair(firstNodeLocation,
          node => { node.descriptorFacts = []; },
          snapshot => { snapshot.descriptorFacts = []; }),
      },
      {
        name: 'missing node descriptorFacts',
        pair: actualNodeSnapshotPair(firstNodeLocation,
          node => { delete node.descriptorFacts; },
          snapshot => { delete snapshot.descriptorFacts; }),
      },
    ]
    : [];
  for (const attack of coordinatedNodeSchemaAttacks) {
    const validation = safeSchemaPairValidation(attack.pair.program, attack.pair.authority);
    check(`closed coordinated node schema rejects ${attack.name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: attack.name, validation }));
  }

  const schemaShapeSource = [
    'local menu = { name = "SchemaShapes", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 60, reserveScrollBar = false })',
    'local row = table:addRow(nil, {})',
    'row[1]:createText("text", { fontsize = 11 })',
    'row[2]:createEditBox({ height = 12, defaultText = "default", description = "description", fontsize = 10 })',
  ].join('\n');
  const schemaShapeModel = buildX4UiCallModel(input(schemaShapeSource, 'selftest/schema-shapes.lua'));
  const schemaShapeResult = projectX4UiLayoutProgram(
    schemaShapeModel,
    topTarget(schemaShapeModel),
    profileFor(schemaShapeModel),
  );
  const schemaShapeProgram = programOf(schemaShapeResult);
  const schemaShapeAuthority = evidenceAuthorityOf(schemaShapeResult);
  const schemaParameterSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width)',
    '  local table = frame:addTable(1, { width = width })',
    '  table:addRow(false, {})',
    'end',
    'local function display()',
    '  local menu = { name = "Parameters", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, runtimeWidth)',
    'end',
  ].join('\n');
  const schemaParameterModel = buildX4UiCallModel(input(schemaParameterSource, 'selftest/schema-parameters.lua'));
  const schemaParameterResult = projectX4UiLayoutProgram(
    schemaParameterModel,
    namedTarget(schemaParameterModel, 'display'),
    profileFor(schemaParameterModel, { localExpansion: { maxDepth: 3, maxInvocations: 4 } }),
  );
  const schemaParameterProgram = programOf(schemaParameterResult);
  const schemaParameterAuthority = evidenceAuthorityOf(schemaParameterResult);
  const schemaLocalResultSource = [
    'local function getValue() return runtimeValue end',
    'local menu = { name = "LocalResult", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = getValue() })',
    'table:addRow(false, {})',
  ].join('\n');
  const schemaLocalResultModel = buildX4UiCallModel(input(schemaLocalResultSource, 'selftest/schema-local-result.lua'));
  const schemaLocalResultResult = projectX4UiLayoutProgram(
    schemaLocalResultModel,
    topTarget(schemaLocalResultModel),
    profileFor(schemaLocalResultModel),
  );
  const schemaLocalResultProgram = programOf(schemaLocalResultResult);
  const schemaLocalResultAuthority = evidenceAuthorityOf(schemaLocalResultResult);
  const schemaHeightSource = [
    'local menu = { name = "HeightSchema", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("zero-height", { height = 0 })',
  ].join('\n');
  const schemaHeightModel = buildX4UiCallModel(input(schemaHeightSource, 'selftest/schema-height.lua'));
  const schemaHeightResult = projectX4UiLayoutProgram(
    schemaHeightModel,
    topTarget(schemaHeightModel),
    profileFor(schemaHeightModel),
  );
  const schemaHeightProgram = programOf(schemaHeightResult);
  const schemaHeightAuthority = evidenceAuthorityOf(schemaHeightResult);
  check('intact call-model value, edit-box, and Lua nil shapes are pair-valid',
    schemaShapeAuthority !== undefined
      && safeSchemaPairValidation(schemaShapeProgram, schemaShapeAuthority).valid === true
      && schemaShapeProgram.operations.some(candidate => candidate.kind === 'createText'
        && candidate.metadata.semantics.fontsize?.type === 'number')
      && schemaShapeProgram.operations.some(candidate => candidate.kind === 'createEditBox'
        && candidate.metadata.semantics.editBox?.defaultText?.value === 'default'
        && candidate.metadata.semantics.editBox?.description?.value === 'description'
        && candidate.metadata.semantics.fontsize?.type === 'number')
      && schemaShapeProgram.operations.some(candidate => candidate.kind === 'addRow'
        && candidate.metadata.arguments[0]?.type === 'nil'
        && candidate.metadata.arguments[0]?.value === null),
    detail({ program: schemaShapeProgram, validation: schemaShapeAuthority && safeSchemaPairValidation(schemaShapeProgram, schemaShapeAuthority) }));
  const schemaParameterIdentity = schemaParameterModel.localFunctions
    .flatMap(candidate => candidate.parameters)[0];
  check('intact parameter identity and local invocation result shapes are pair-valid',
    schemaParameterAuthority !== undefined
      && schemaLocalResultAuthority !== undefined
      && safeSchemaPairValidation(schemaParameterProgram, schemaParameterAuthority).valid === true
      && safeSchemaPairValidation(schemaLocalResultProgram, schemaLocalResultAuthority).valid === true
      && schemaParameterIdentity !== undefined
      && Object.keys(schemaParameterIdentity).sort().join(',') === 'declarationId,id,index,name,source'
      && schemaLocalResultProgram.operations.some(candidate =>
        Object.values(candidate.metadata.semantics).some(value => value?.localInvocationResult !== undefined)),
    detail({
      parameter: schemaParameterAuthority && safeSchemaPairValidation(schemaParameterProgram, schemaParameterAuthority),
      localResult: schemaLocalResultAuthority && safeSchemaPairValidation(schemaLocalResultProgram, schemaLocalResultAuthority),
    }));
  check('intact unavailable height shape remains pair-valid',
    schemaHeightAuthority !== undefined
      && safeSchemaPairValidation(schemaHeightProgram, schemaHeightAuthority).valid === true
      && schemaHeightProgram.rows.some(candidate => candidate.height?.status === 'unavailable')
      && schemaHeightProgram.cells.some(candidate => candidate.height?.status === 'unavailable'),
    detail({
      validation: schemaHeightAuthority && safeSchemaPairValidation(schemaHeightProgram, schemaHeightAuthority),
      rows: schemaHeightProgram.rows.map(candidate => candidate.height),
      cells: schemaHeightProgram.cells.map(candidate => candidate.height),
    }));

  const mutateKernelStates = (
    root: unknown,
    mutate: (state: Record<string, unknown>) => void,
  ): void => {
    const seen = new Set<object>();
    const visit = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const objectValue = candidate as object;
      if (seen.has(objectValue)) return;
      seen.add(objectValue);
      if (!Array.isArray(objectValue)) {
        const record = objectValue as Record<string, unknown>;
        if (Array.isArray(record.rowGroups) && Array.isArray(record.rows)) mutate(record);
        if (Array.isArray(record.diagnostics)) mutate(record);
        if (record.kernelState && typeof record.kernelState === 'object') visit(record.kernelState);
      }
      for (const child of Object.values(objectValue)) visit(child);
    };
    visit(root);
  };
  const addLegitimateRowGroup = (root: unknown): void => {
    mutateKernelStates(root, state => {
      if (Array.isArray(state.rowGroups) && Array.isArray(state.rows)) {
        state.rowGroups = [{ level: 2 }];
        state.rows = state.rows.map(row => row && typeof row === 'object'
          ? { ...(row as Record<string, unknown>), groupIndex: 1 }
          : row);
      }
    });
  };
  const schemaRowGroupProgram = schemaShapeProgram
    ? freezeClone((() => {
      const candidate = jsonClone(schemaShapeProgram) as unknown as Record<string, unknown>;
      addLegitimateRowGroup(candidate);
      return candidate;
    })() as unknown as X4UiLayoutProgram)
    : undefined;
  const schemaRowGroupAuthority = schemaShapeAuthority
    ? freezeClone((() => {
      const candidate = jsonClone(schemaShapeAuthority) as unknown as Record<string, unknown>;
      addLegitimateRowGroup(candidate);
      return candidate;
    })() as unknown as EvidenceAuthorityLike)
    : undefined;
  check('legitimate Helper rowGroups and one-based row groupIndex are pair-valid',
    schemaRowGroupProgram !== undefined
      && schemaRowGroupAuthority !== undefined
      && safeSchemaPairValidation(schemaRowGroupProgram, schemaRowGroupAuthority).valid === true,
    detail(schemaRowGroupProgram?.tables.map(candidate => candidate.kernelState)));

  const coordinatedRootPair = (
    mutateProgram: (candidate: Record<string, unknown>) => void,
    mutateAuthority: (candidate: Record<string, unknown>) => void = mutateProgram,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } => ({
    program: mutateProgramJson(allKindProgram, mutateProgram),
    authority: mutateAuthorityJson(allKindAuthority!, mutateAuthority),
  });
  const firstValueOperationIndex = allKindProgram.operations.findIndex(candidate =>
    candidate.metadata.arguments.some(value => value.reference !== undefined));
  const mutateFirstArgumentValue = (
    mutate: (value: Record<string, unknown>) => void,
  ) => (operationValue: Record<string, unknown>): void => {
    const metadata = operationValue.metadata as Record<string, unknown>;
    const argument = (metadata.arguments as Record<string, unknown>[]).find(value => value && value.reference !== undefined)
      || (metadata.arguments as Record<string, unknown>[])[0];
    if (argument) mutate(argument);
  };
  const valueSchemaAttacks = [
    ['invented X4UiValue type', mutateFirstArgumentValue(value => { value.type = 'forged'; })],
    ['invented X4UiValue recordType', mutateFirstArgumentValue(value => { value.recordType = 'forged'; })],
    ['invented X4UiValue transformed', mutateFirstArgumentValue(value => { value.transformed = true; })],
    ['non-nil X4UiValue null literal', mutateFirstArgumentValue(value => { value.type = 'number'; value.value = null; })],
    ['invented reference kind', mutateFirstArgumentValue(value => { (value.reference as Record<string, unknown>).kind = 'forged'; })],
    ['invented reference origin', mutateFirstArgumentValue(value => { (value.reference as Record<string, unknown>).origin = 'forged'; })],
    ['invented helper runtime availability', mutateFirstArgumentValue(value => { (value.reference as Record<string, unknown>).helperRuntimeAvailability = 'known'; })],
  ] as const;
  for (const [name, mutate] of valueSchemaAttacks) {
    const pair = firstValueOperationIndex >= 0
      ? actualOperationSnapshotPair(firstValueOperationIndex, mutate, mutate)
      : undefined;
    const validation = pair ? safeSchemaPairValidation(pair.program, pair.authority) : { threw: false, valid: false };
    check(`closed call-model schema rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ name, validation }));
  }
  const propertyOperationIndex = allKindProgram.operations.findIndex(candidate =>
    candidate.metadata.semantics.properties?.length);
  const propertySourceOrderPair = propertyOperationIndex >= 0
    ? actualOperationSnapshotPair(propertyOperationIndex,
      operationValue => {
        const property = ((operationValue.metadata as Record<string, unknown>).semantics as Record<string, unknown>).properties as Record<string, unknown>[];
        if (property[0]) delete property[0].sourceOrder;
      },
      snapshot => {
        const property = ((snapshot.metadata as Record<string, unknown>).semantics as Record<string, unknown>).properties as Record<string, unknown>[];
        if (property[0]) delete property[0].sourceOrder;
      })
    : undefined;
  const propertySourceOrderValidation = propertySourceOrderPair
    ? safeSchemaPairValidation(propertySourceOrderPair.program, propertySourceOrderPair.authority)
    : { threw: false, valid: false };
  check('closed call-model schema requires property sourceOrder',
    propertySourceOrderValidation.threw === false && propertySourceOrderValidation.valid === false,
    detail(propertySourceOrderValidation));

  const parameterAttack = firstValueOperationIndex >= 0
    ? actualOperationSnapshotPair(firstValueOperationIndex,
      operationValue => {
        const value = ((operationValue.metadata as Record<string, unknown>).arguments as Record<string, unknown>[])[0];
        if (value) value.parameter = { id: 'local-parameter:truncated', index: 0 };
      },
      snapshot => {
        const value = ((snapshot.metadata as Record<string, unknown>).arguments as Record<string, unknown>[])[0];
        if (value) value.parameter = { id: 'local-parameter:truncated', index: 0 };
      })
    : undefined;
  const localResultOperationIndex = schemaLocalResultProgram.operations.findIndex(candidate =>
    Object.values(candidate.metadata.semantics).some(value => value?.localInvocationResult !== undefined));
  const localResultAttack = localResultOperationIndex >= 0 && schemaLocalResultAuthority
    ? actualOperationSnapshotPairFor(schemaLocalResultProgram, schemaLocalResultAuthority, localResultOperationIndex,
      operationValue => {
        const semantics = (operationValue.metadata as Record<string, unknown>).semantics as Record<string, unknown>;
        const value = Object.values(semantics).find(candidate => candidate && typeof candidate === 'object' && (candidate as Record<string, unknown>).localInvocationResult) as Record<string, unknown> | undefined;
        if (value) value.localInvocationResult = { source: (value.localInvocationResult as Record<string, unknown>).source, expression: (value.localInvocationResult as Record<string, unknown>).expression };
      },
      snapshot => {
        const semantics = (snapshot.metadata as Record<string, unknown>).semantics as Record<string, unknown>;
        const value = Object.values(semantics).find(candidate => candidate && typeof candidate === 'object' && (candidate as Record<string, unknown>).localInvocationResult) as Record<string, unknown> | undefined;
        if (value) value.localInvocationResult = { source: (value.localInvocationResult as Record<string, unknown>).source, expression: (value.localInvocationResult as Record<string, unknown>).expression };
      })
    : undefined;
  check('closed call-model schema rejects truncated local parameter identity',
    parameterAttack !== undefined && safeSchemaPairValidation(parameterAttack.program, parameterAttack.authority).valid === false,
    detail(parameterAttack && safeSchemaPairValidation(parameterAttack.program, parameterAttack.authority)));
  check('closed call-model schema rejects truncated local invocation result identity',
    localResultAttack !== undefined && safeSchemaPairValidation(localResultAttack.program, localResultAttack.authority).valid === false,
    detail(localResultAttack && safeSchemaPairValidation(localResultAttack.program, localResultAttack.authority)));

  const rowGroupAttack = (
    mutate: (state: Record<string, unknown>) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (!schemaRowGroupProgram || !schemaRowGroupAuthority) return undefined;
    const candidateProgram = jsonClone(schemaRowGroupProgram) as unknown as Record<string, unknown>;
    const candidateAuthority = jsonClone(schemaRowGroupAuthority) as unknown as Record<string, unknown>;
    mutateKernelStates(candidateProgram, mutate);
    mutateKernelStates(candidateAuthority, mutate);
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
    };
  };
  const rowGroupAttacks = [
    ['rowGroups unknown key', rowGroupAttack(state => {
      const group = (state.rowGroups as Record<string, unknown>[])[0];
      if (group) group.auditUnknown = true;
    })],
    ['rowGroups string level', rowGroupAttack(state => {
      const group = (state.rowGroups as Record<string, unknown>[])[0];
      if (group) group.level = '2';
    })],
  ] as const;
  for (const [name, pair] of rowGroupAttacks) {
    const validation = pair ? safeSchemaPairValidation(pair.program, pair.authority) : { threw: false, valid: false };
    check(`closed kernel schema rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ name, validation }));
  }

  const diagnosticPair = rowGroupAttack(state => {
    if (Array.isArray(state.diagnostics)) {
      state.diagnostics = [{ code: 'colspan-clamped', message: 'fixture diagnostic', provenance: X4_LAYOUT_PROVENANCE }];
    }
  });
  check('exact Helper diagnostic shape is pair-valid',
    diagnosticPair !== undefined && safeSchemaPairValidation(diagnosticPair.program, diagnosticPair.authority).valid === true,
    detail(diagnosticPair && safeSchemaPairValidation(diagnosticPair.program, diagnosticPair.authority)));
  const diagnosticAttacks = [
    ['diagnostic unknown key', (diagnostic: Record<string, unknown>) => { diagnostic.auditUnknown = true; }],
    ['invented diagnostic code', (diagnostic: Record<string, unknown>) => { diagnostic.code = 'forged'; }],
    ['diagnostic provenance wrong type', (diagnostic: Record<string, unknown>) => { diagnostic.provenance = 'forged'; }],
  ] as const;
  for (const [name, mutate] of diagnosticAttacks) {
    const pair = diagnosticPair && (() => {
      const candidateProgram = jsonClone(diagnosticPair.program) as unknown as Record<string, unknown>;
      const candidateAuthority = jsonClone(diagnosticPair.authority) as unknown as Record<string, unknown>;
      mutateKernelStates(candidateProgram, state => {
        const diagnostic = (state.diagnostics as Record<string, unknown>[])[0];
        if (diagnostic) mutate(diagnostic);
      });
      mutateKernelStates(candidateAuthority, state => {
        const diagnostic = (state.diagnostics as Record<string, unknown>[])[0];
        if (diagnostic) mutate(diagnostic);
      });
      return {
        program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
        authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      };
    })();
    const validation = pair ? safeSchemaPairValidation(pair.program, pair.authority) : { threw: false, valid: false };
    check(`closed kernel schema rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ name, validation }));
  }

  const firstGapPair = allKindProgram.gaps.length > 0 && allKindAuthority
    ? coordinatedRootPair(
      candidate => { (candidate.gaps as Record<string, unknown>[])[0].category = 'forged'; },
      candidate => { (candidate.gaps as Record<string, unknown>[])[0].category = 'forged'; },
    )
    : undefined;
  const firstGapValidation = firstGapPair
    ? safeSchemaPairValidation(firstGapPair.program, firstGapPair.authority)
    : { threw: false, valid: false };
  check('closed layout schema rejects invented gap category',
    firstGapValidation.threw === false && firstGapValidation.valid === false,
    detail(firstGapValidation));

  const operationWithKernelIndex = allKindProgram.operations.findIndex(candidate => candidate.kernel !== undefined);
  const transitionAttack = operationWithKernelIndex >= 0
    ? actualOperationSnapshotPair(operationWithKernelIndex,
      operationValue => {
        const kernel = operationValue.kernel as Record<string, unknown>;
        kernel.refusal = { status: 'refused', code: 'finalized', message: 'forged', provenance: X4_LAYOUT_PROVENANCE };
      },
      snapshot => {
        const kernel = snapshot.kernel as Record<string, unknown>;
        kernel.refusal = { status: 'refused', code: 'finalized', message: 'forged', provenance: X4_LAYOUT_PROVENANCE };
      })
    : undefined;
  const impossibleTransitionAttack = operationWithKernelIndex >= 0
    ? actualOperationSnapshotPair(operationWithKernelIndex,
      operationValue => { operationValue.kernel = { stateBefore: (operationValue.kernel as Record<string, unknown>).stateBefore }; },
      snapshot => { snapshot.kernel = { stateBefore: (snapshot.kernel as Record<string, unknown>).stateBefore }; })
    : undefined;
  check('closed layout schema rejects successful transition carrying refusal',
    transitionAttack !== undefined && safeSchemaPairValidation(transitionAttack.program, transitionAttack.authority).valid === false,
    detail(transitionAttack && safeSchemaPairValidation(transitionAttack.program, transitionAttack.authority)));
  check('closed layout schema rejects impossible transition key subsets',
    impossibleTransitionAttack !== undefined && safeSchemaPairValidation(impossibleTransitionAttack.program, impossibleTransitionAttack.authority).valid === false,
    detail(impossibleTransitionAttack && safeSchemaPairValidation(impossibleTransitionAttack.program, impossibleTransitionAttack.authority)));

  const cellNodeLocation = schemaNodeLocations.find(location => location.collection === 'cells');
  const cellTypeAttack = cellNodeLocation
    ? actualNodeSnapshotPair(cellNodeLocation,
      node => { ((node.kernelState as Record<string, unknown>) || {}).type = 'forged-cell'; },
      snapshot => { ((snapshot.kernelState as Record<string, unknown>) || {}).type = 'forged-cell'; })
    : undefined;
  check('closed kernel schema rejects invented cell type',
    cellTypeAttack !== undefined && safeSchemaPairValidation(cellTypeAttack.program, cellTypeAttack.authority).valid === false,
    detail(cellTypeAttack && safeSchemaPairValidation(cellTypeAttack.program, cellTypeAttack.authority)));

  const nodeAt = (
    sourceProgram: X4UiLayoutProgram,
    location: { readonly collection: SchemaNodeCollection; readonly index: number },
  ): Record<string, unknown> | undefined => {
    const candidate = (sourceProgram[location.collection] as readonly unknown[])[location.index];
    return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ? candidate as Record<string, unknown>
      : undefined;
  };
  const knownHeightLocation = schemaNodeLocations.find(location => {
    const node = nodeAt(allKindProgram, location);
    const height = node?.height as Record<string, unknown> | undefined;
    return height?.status === 'known';
  });
  const knownHeightRefusalPair = knownHeightLocation
    ? actualNodeSnapshotPair(knownHeightLocation,
      node => {
        node.height = {
          ...(node.height as Record<string, unknown>),
          refusal: { status: 'refused', code: 'finalized', message: 'forged', provenance: X4_LAYOUT_PROVENANCE },
        };
      },
      snapshot => {
        snapshot.height = {
          ...(snapshot.height as Record<string, unknown>),
          refusal: { status: 'refused', code: 'finalized', message: 'forged', provenance: X4_LAYOUT_PROVENANCE },
        };
      })
    : undefined;
  check('closed height schema rejects known height carrying refusal',
    knownHeightRefusalPair !== undefined
      && safeSchemaPairValidation(knownHeightRefusalPair.program, knownHeightRefusalPair.authority).valid === false,
    detail(knownHeightRefusalPair && safeSchemaPairValidation(knownHeightRefusalPair.program, knownHeightRefusalPair.authority)));

  const schemaHeightNodeLocations: readonly { readonly collection: SchemaNodeCollection; readonly index: number }[] = [
    ...schemaHeightProgram.frames.map((_, index) => ({ collection: 'frames' as const, index })),
    ...schemaHeightProgram.tables.map((_, index) => ({ collection: 'tables' as const, index })),
    ...schemaHeightProgram.rows.map((_, index) => ({ collection: 'rows' as const, index })),
    ...schemaHeightProgram.cells.map((_, index) => ({ collection: 'cells' as const, index })),
  ];
  const unavailableHeightLocation = schemaHeightNodeLocations.find(location => {
    const node = nodeAt(schemaHeightProgram, location);
    const height = node?.height as Record<string, unknown> | undefined;
    return height?.status === 'unavailable';
  });
  const unavailableHeightValuePair = unavailableHeightLocation && schemaHeightAuthority
    ? actualNodeSnapshotPairFor(schemaHeightProgram, schemaHeightAuthority, unavailableHeightLocation,
      node => {
        node.height = { ...(node.height as Record<string, unknown>), value: 0 };
      },
      snapshot => {
        snapshot.height = { ...(snapshot.height as Record<string, unknown>), value: 0 };
      })
    : undefined;
  const unavailableHeightRefusalPair = unavailableHeightLocation && schemaHeightAuthority
    ? actualNodeSnapshotPairFor(schemaHeightProgram, schemaHeightAuthority, unavailableHeightLocation,
      node => {
        node.height = { ...(node.height as Record<string, unknown>), refusal: { status: 'forged' } };
      },
      snapshot => {
        snapshot.height = { ...(snapshot.height as Record<string, unknown>), refusal: { status: 'forged' } };
      })
    : undefined;
  check('closed height schema rejects unavailable height carrying a value',
    unavailableHeightValuePair !== undefined
      && safeSchemaPairValidation(unavailableHeightValuePair.program, unavailableHeightValuePair.authority).valid === false,
    detail(unavailableHeightValuePair && safeSchemaPairValidation(unavailableHeightValuePair.program, unavailableHeightValuePair.authority)));
  check('closed height schema rejects unavailable height carrying a malformed refusal',
    unavailableHeightRefusalPair !== undefined
      && safeSchemaPairValidation(unavailableHeightRefusalPair.program, unavailableHeightRefusalPair.authority).valid === false,
    detail(unavailableHeightRefusalPair && safeSchemaPairValidation(unavailableHeightRefusalPair.program, unavailableHeightRefusalPair.authority)));

  const noOpSource = [
    'local menu = { name = "NoOpEvidence", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(1, 20, false)',
    'table:addRow(false, {})',
  ].join('\n');
  const noOpModel = buildX4UiCallModel(input(noOpSource, 'selftest/evidence-no-op.lua'));
  const noOpResult = projectX4UiLayoutProgram(noOpModel, topTarget(noOpModel), profileFor(noOpModel));
  const noOpProgram = programOf(noOpResult);
  const noOpAuthority = evidenceAuthorityOf(noOpResult);
  const noOpWidthOperations = noOpProgram.operations.filter(candidate => candidate.kind === 'setColWidth');
  const noOpManifestOperations = noOpAuthority?.operations.filter(candidate => candidate.kind === 'setColWidth') || [];
  const noOpSecondOperation = noOpWidthOperations[1];
  const noOpDeletedProgram = noOpSecondOperation
    ? {
      ...noOpProgram,
      operations: noOpProgram.operations.filter(candidate => candidate.id !== noOpSecondOperation.id),
    } as X4UiLayoutProgram
    : undefined;
  if (noOpDeletedProgram) freezeClone(noOpDeletedProgram);
  const noOpDeletedManifest = noOpAuthority;
  check('two identical real no-op width calls remain distinct and manifest omission is mechanically detectable',
    noOpWidthOperations.length === 2
      && noOpManifestOperations.length === 2
      && noOpWidthOperations[0].id !== noOpWidthOperations[1].id
      && noOpWidthOperations[1].kernel?.stateBefore !== undefined
      && sameJson(noOpWidthOperations[1].kernel.stateBefore, noOpWidthOperations[1].kernel.stateAfter)
      && noOpManifestOperations.every((entry, index) => entry.id === noOpWidthOperations[index]?.id)
      && noOpDeletedManifest !== undefined
      && noOpDeletedManifest.operations.length === (noOpAuthority?.operations.length || 0)
      && noOpDeletedProgram?.operations.length !== noOpDeletedManifest.operations.length,
    detail({
      operations: noOpWidthOperations,
      manifestOperations: noOpManifestOperations,
      deletedProgramOperations: noOpDeletedProgram?.operations.length,
      retainedAuthorityOperations: noOpDeletedManifest?.operations.length,
    }));

  const dynamicGapSource = [
    'local menu = { name = "DynamicGapEvidence", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(getIndex(), getWidth(), getScaling())',
  ].join('\n');
  const dynamicGapModel = buildX4UiCallModel(input(dynamicGapSource, 'selftest/evidence-dynamic-gaps.lua'));
  const dynamicGapResult = projectX4UiLayoutProgram(
    dynamicGapModel,
    topTarget(dynamicGapModel),
    profileFor(dynamicGapModel),
  );
  const dynamicGapProgram = programOf(dynamicGapResult);
  const dynamicGapAuthority = evidenceAuthorityOf(dynamicGapResult);
  const dynamicGapOperation = operation(dynamicGapProgram, 'setColWidth');
  const dynamicLinkedGaps = dynamicGapAuthority?.linkedGapIndexes.map(index => dynamicGapAuthority.gaps[index]) || [];
  const dynamicProgramLinkedGaps = dynamicGapOperation
    ? dynamicGapProgram.gaps.filter(gap => gap.operationId === dynamicGapOperation.id)
    : [];
  check('dynamic width operation exposes three exact ordered linked manifest gaps',
    dynamicGapOperation?.status === 'unresolved'
      && dynamicLinkedGaps.length === 3
      && dynamicLinkedGaps.every(gap => gap?.operationId === dynamicGapOperation.id)
      && dynamicLinkedGaps.map(gap => gap?.category).join(',') === 'index,width,options'
      && sameJson(dynamicLinkedGaps, dynamicProgramLinkedGaps)
      && dynamicLinkedGaps.every(gap => gap?.source && gap.reason && gap.status && gap.category),
    detail({ operation: dynamicGapOperation, manifestGaps: dynamicLinkedGaps, programGaps: dynamicProgramLinkedGaps }));

  const dynamicManifestClone = dynamicGapAuthority ? jsonClone(dynamicGapAuthority) : undefined;
  const dynamicFirstLinkedIndex = dynamicManifestClone?.linkedGapIndexes[0];
  const dynamicFirstGap = dynamicFirstLinkedIndex === undefined
    ? undefined
    : dynamicManifestClone?.gaps[dynamicFirstLinkedIndex];
  const mutateDynamicGap = (mutation: Partial<EvidenceAuthorityGapLike>): EvidenceAuthorityLike | undefined => {
    if (!dynamicManifestClone || dynamicFirstLinkedIndex === undefined || !dynamicFirstGap) return undefined;
    return freezeClone({
      ...dynamicManifestClone,
      gaps: dynamicManifestClone.gaps.map((gap, index) =>
        index === dynamicFirstLinkedIndex ? { ...gap, ...mutation } : gap),
    });
  };
  const dynamicGapFieldMutations = [
    mutateDynamicGap({ category: 'row' }),
    mutateDynamicGap({ status: 'refused' }),
    mutateDynamicGap({ reason: 'mutated producer reason' }),
    mutateDynamicGap({ source: { ...dynamicFirstGap!.source, start: { ...dynamicFirstGap!.source.start, offset: dynamicFirstGap!.source.start.offset + 1 } } }),
    mutateDynamicGap({ expression: `${dynamicFirstGap?.expression || ''} mutated` }),
    mutateDynamicGap({ operationId: 'operation:mutated' }),
    mutateDynamicGap({ nodeId: 'node:mutated' }),
  ].filter((candidate): candidate is EvidenceAuthorityLike => candidate !== undefined);
  const dynamicGapOmission = dynamicManifestClone
    ? freezeClone({ ...dynamicManifestClone, gaps: dynamicManifestClone.gaps.slice(1) })
    : undefined;
  const dynamicGapDuplication = dynamicManifestClone
    ? freezeClone({ ...dynamicManifestClone, gaps: [...dynamicManifestClone.gaps, dynamicManifestClone.gaps[0]] })
    : undefined;
  const dynamicGapReversal = dynamicManifestClone
    ? freezeClone({ ...dynamicManifestClone, linkedGapIndexes: [...dynamicManifestClone.linkedGapIndexes].reverse() })
    : undefined;
  const allKindManifestClone = allKindAuthority ? jsonClone(allKindAuthority) : undefined;
  const sourceMismatchManifest = allKindManifestClone
    ? freezeClone({
      ...allKindManifestClone,
      calls: allKindManifestClone.calls.map((call, index) => index === 0
        ? { ...call, source: { ...call.source, start: { ...call.source.start, offset: call.source.start.offset + 1 } } }
        : call),
    })
    : undefined;
  const duplicateCallIdManifest = allKindManifestClone
    ? freezeClone({
      ...allKindManifestClone,
      calls: allKindManifestClone.calls.map((call, index) => index === 1
        ? { ...call, id: allKindManifestClone.calls[0].id }
        : call),
    })
    : undefined;
  const shiftedOperationOrderManifest = allKindManifestClone
    ? freezeClone({
      ...allKindManifestClone,
      operations: allKindManifestClone.operations.map((operation, index) => index === 0
        ? { ...operation, modelOrder: operation.modelOrder + 1000 }
        : operation),
    })
    : undefined;
  const unknownManifestKey = allKindManifestClone
    ? freezeClone({ ...allKindManifestClone, unknownManifestKey: true }) as unknown as EvidenceAuthorityLike
    : undefined;
  type AuthorityPairCandidate =
    | X4UiLayoutProgram
    | { readonly program: X4UiLayoutProgram; readonly evidenceAuthority: EvidenceAuthorityLike };
  const authorityForProgram = (candidateProgram: X4UiLayoutProgram): EvidenceAuthorityLike | undefined => {
    if (candidateProgram === allKindProgram) return allKindAuthority;
    if (candidateProgram === dynamicGapProgram) return dynamicGapAuthority;
    if (candidateProgram === noOpProgram || candidateProgram === noOpDeletedProgram) return noOpAuthority;
    if (candidateProgram === conditionalAllKindProgram) return conditionalAllKindAuthority;
    if (candidateProgram === rejectedEvidenceProgram) return rejectedEvidenceAuthority;
    if (candidateProgram === actualRejectedProgram) return actualRejectedAuthority;
    return undefined;
  };
  const validatorResult = (
    candidate: AuthorityPairCandidate,
    authorityOverride?: EvidenceAuthorityLike,
  ): boolean => {
    const candidateProgram = 'evidenceAuthority' in candidate ? candidate.program : candidate;
    const candidateAuthority = 'evidenceAuthority' in candidate
      ? candidate.evidenceAuthority
      : authorityOverride || authorityForProgram(candidateProgram);
    return candidateAuthority !== undefined && validateX4UiLayoutEvidencePair(candidateProgram, candidateAuthority).valid;
  };
  check('public evidence validator accepts intact ledgers and rejects operation, gap, source, ID, and key attacks',
    validatorResult(allKindProgram)
      && validatorResult(dynamicGapProgram)
      && validatorResult(noOpProgram)
      && noOpDeletedProgram !== undefined
      && !validatorResult(noOpDeletedProgram)
      && dynamicGapOmission !== undefined
      && !validatorResult(programWithAuthority(dynamicGapProgram, dynamicGapOmission))
      && dynamicGapDuplication !== undefined
      && !validatorResult(programWithAuthority(dynamicGapProgram, dynamicGapDuplication))
      && dynamicGapReversal !== undefined
      && !validatorResult(programWithAuthority(dynamicGapProgram, dynamicGapReversal))
      && dynamicGapFieldMutations.every(candidate => !validatorResult(programWithAuthority(dynamicGapProgram, candidate)))
      && sourceMismatchManifest !== undefined
      && !validatorResult(programWithAuthority(allKindProgram, sourceMismatchManifest))
      && duplicateCallIdManifest !== undefined
      && !validatorResult(programWithAuthority(allKindProgram, duplicateCallIdManifest))
      && shiftedOperationOrderManifest !== undefined
      && !validatorResult(programWithAuthority(allKindProgram, shiftedOperationOrderManifest))
      && unknownManifestKey !== undefined
      && !validatorResult(programWithAuthority(allKindProgram, unknownManifestKey)),
    detail({
      intact: validatorResult(allKindProgram),
      dynamicGapFieldMutationCount: dynamicGapFieldMutations.length,
      deletion: noOpDeletedProgram && noOpAuthority
        ? validateX4UiLayoutEvidencePair(noOpDeletedProgram, noOpAuthority)
        : undefined,
    }));

  const conditionalAllKindSource = [
    'local menu = { name = "BlockedAllKinds", layer = 1 }',
    'if choice then',
    ...allKindBody.map(line => `  ${line}`),
    'end',
    'if false then',
    ...allKindBody.map(line => `  ${line}`),
    'end',
  ].join('\n');
  const conditionalAllKindModel = buildX4UiCallModel(input(
    conditionalAllKindSource,
    'selftest/evidence-blocked-all-kinds.lua',
  ));
  const conditionalAllKindResult = projectX4UiLayoutProgram(
    conditionalAllKindModel,
    topTarget(conditionalAllKindModel),
    profileFor(conditionalAllKindModel),
  );
  const conditionalAllKindProgram = programOf(conditionalAllKindResult);
  const conditionalAllKindAuthority = evidenceAuthorityOf(conditionalAllKindResult);
  const blockedManifestKinds = conditionalAllKindAuthority?.calls.map(entry => entry.kind) || [];
  const blockedRows = conditionalAllKindAuthority?.calls.filter(entry => entry.kind === 'addRow') || [];
  check('conditional and unreachable all-kind sweeps retain all manifest calls and exact blocked addRow evidence',
    conditionalAllKindAuthority !== undefined
      && conditionalAllKindAuthority.calls.length === allKindKinds.length * 2
      && new Set(allKindKinds).size === 17
      && [...new Set(allKindKinds)].every(kind => blockedManifestKinds.filter(candidate => candidate === kind).length
        === (kind === 'addRow' ? 4 : 2))
      && blockedRows.length === 4
      && blockedRows.every(entry => entry.status === 'conditional' || entry.status === 'unreachable')
      && blockedRows.map(entry => entry.reachability).sort().join(',') === 'conditional,conditional,unreachable,unreachable'
      && conditionalAllKindAuthority.operations.every((entry, index) =>
        entry.id === conditionalAllKindProgram.operations[index]?.id
          && entry.status === conditionalAllKindProgram.operations[index]?.status),
    detail({ authority: conditionalAllKindAuthority, operations: conditionalAllKindProgram.operations }));

  const rejectedEvidenceSource = [
    'local menu = { name = "RejectedEvidence", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(getIndex(), 20, false)',
    'table:addRow(false, { paddingTop = -1 })',
    'local other = {}',
    'other:setColSpan(getSpan())',
    'other:createText("text", {})',
    'other:createButton({})',
    'other:createEditBox({})',
    'other:createIcon("solid", {})',
  ].join('\n');
  const rejectedEvidenceModel = buildX4UiCallModel(input(
    rejectedEvidenceSource,
    'selftest/evidence-rejected.lua',
  ));
  const rejectedEvidenceResult = projectX4UiLayoutProgram(
    rejectedEvidenceModel,
    topTarget(rejectedEvidenceModel),
    profileFor(rejectedEvidenceModel),
  );
  const rejectedEvidenceProgram = programOf(rejectedEvidenceResult);
  const rejectedEvidenceAuthority = evidenceAuthorityOf(rejectedEvidenceResult);
  const rejectedEvidenceKinds = ['setColWidth', 'addRow', 'setColSpan', 'createText', 'createButton', 'createEditBox', 'createIcon'];
  check('rejected and unresolved width/row/span/text/button/editbox/icon entries preserve exact evidence identity',
    rejectedEvidenceAuthority !== undefined
      && rejectedEvidenceKinds.every(kind => {
        const programOperation = rejectedEvidenceProgram.operations.find(candidate => candidate.kind === kind);
        const manifestOperation = rejectedEvidenceAuthority.operations.find(candidate => candidate.id === programOperation?.id);
        const manifestCall = rejectedEvidenceAuthority.calls.find(candidate => candidate.operationId === programOperation?.id);
        return programOperation !== undefined
          && manifestOperation !== undefined
          && manifestCall !== undefined
          && manifestOperation.kind === programOperation.kind
          && manifestOperation.status === programOperation.status
          && manifestOperation.reason === programOperation.reason
          && manifestOperation.sourceOrder === programOperation.sourceOrder
          && manifestOperation.modelOrder === programOperation.modelOrder
          && manifestCall.status === programOperation.status
          && rejectedEvidenceProgram.gaps
            .filter(gap => gap.operationId === programOperation.id)
            .every(gap => rejectedEvidenceAuthority.gaps.some(manifestGap => sameJson(manifestGap, gap)));
      }),
    detail({ authority: rejectedEvidenceAuthority, operations: rejectedEvidenceProgram.operations, gaps: rejectedEvidenceProgram.gaps }));
  check('public evidence validator accepts blocked and refused producer ledgers',
    validatorResult(conditionalAllKindProgram) && validatorResult(rejectedEvidenceProgram),
    detail({
      conditional: conditionalAllKindAuthority
        ? validateX4UiLayoutEvidencePair(conditionalAllKindProgram, conditionalAllKindAuthority)
        : undefined,
      rejected: rejectedEvidenceAuthority
        ? validateX4UiLayoutEvidencePair(rejectedEvidenceProgram, rejectedEvidenceAuthority)
        : undefined,
    }));

  const actualRejectedSource = [
    'local menu = { name = "ActualRejected", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 120, height = 90 })',
    'local widthTable = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'widthTable:setColWidth(1, 20, false)',
    'widthTable:addRow(false, {})',
    'widthTable:setColWidth(1, 30, false)',
    'local rowTable = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'rowTable:addRow(false, { paddingTop = -1 })',
    'local spanTable = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'local spanRow = spanTable:addRow(false, {})',
    'spanRow[1]:setColSpan(0)',
    'local widgetTable = frame:addTable(4, { width = 80, reserveScrollBar = false })',
    'local widgetRow = widgetTable:addRow(false, {})',
    'widgetRow[1]:createText("bad-text", { height = -1 })',
    'widgetRow[2]:createButton({ height = -1 })',
    'widgetRow[3]:createEditBox({ height = -1 })',
    'widgetRow[4]:createIcon("solid", { height = -1 })',
  ].join('\n');
  const actualRejectedModel = buildX4UiCallModel(input(
    actualRejectedSource,
    'selftest/evidence-actual-rejected.lua',
  ));
  const actualRejectedResult = projectX4UiLayoutProgram(
    actualRejectedModel,
    topTarget(actualRejectedModel),
    profileFor(actualRejectedModel),
  );
  const actualRejectedProgram = programOf(actualRejectedResult);
  const actualRejectedAuthority = evidenceAuthorityOf(actualRejectedResult);
  const actualRejectedKinds = [
    'setColWidth', 'addRow', 'setColSpan', 'createText', 'createButton', 'createEditBox', 'createIcon',
  ] as const;
  const actualRejectedOccurrences = [1, 1, 0, 0, 0, 0, 0] as const;
  const actualRejectedOperations = actualRejectedKinds.map((kind, index) =>
    actualRejectedProgram.operations.filter(candidate => candidate.kind === kind)[actualRejectedOccurrences[index]]);
  const actualRejectedAuthorityOperations = actualRejectedAuthority
    ? actualRejectedOperations.map(candidate => candidate === undefined
      ? undefined
      : actualRejectedAuthority.operations.find(authorityOperation => authorityOperation.id === candidate.id))
    : [];
  check('actual rejected width/row/span/text/button/editbox/icon cases remain rejected with exact refusal authority',
    actualRejectedAuthority !== undefined
      && validateX4UiLayoutEvidencePair(actualRejectedProgram, actualRejectedAuthority).valid
      && actualRejectedOperations.every((candidate, index) => {
        const authorityOperation = actualRejectedAuthorityOperations[index];
        const authorityCall = authorityOperation
          ? actualRejectedAuthority!.calls.find(call => call.operationId === authorityOperation.id)
          : undefined;
        return candidate?.status === 'rejected'
          && candidate.kernel?.refusal !== undefined
          && sameJson(candidate.kernel.stateBefore, candidate.kernel.stateAfter)
          && authorityOperation?.id === candidate.id
          && authorityOperation.status === 'rejected'
          && authorityOperation.reason === candidate.reason
          && authorityCall?.operationId === candidate.id
          && authorityCall.status === 'rejected'
          && actualRejectedProgram.gaps
            .filter(gap => gap.operationId === candidate.id)
            .every(gap => actualRejectedAuthority!.gaps.some(authorityGap => sameJson(authorityGap, gap)));
      }),
    detail({
      operations: actualRejectedOperations.map(candidate => ({
        kind: candidate?.kind,
        status: candidate?.status,
        refusal: candidate?.kernel?.refusal?.code,
        reason: candidate?.reason,
      })),
      pair: actualRejectedAuthority
        ? validateX4UiLayoutEvidencePair(actualRejectedProgram, actualRejectedAuthority)
        : undefined,
    }));

  const actualRejectedStateOperationIndex = actualRejectedAuthority
    ? actualRejectedProgram.operations.findIndex(candidate => candidate.kernel?.refusal !== undefined
      && candidate.kernel.stateBefore !== undefined
      && candidate.kernel.stateAfter !== undefined)
    : -1;
  const actualStateRefusalPair = actualRejectedStateOperationIndex >= 0 && actualRejectedAuthority
    ? actualOperationSnapshotPairFor(actualRejectedProgram, actualRejectedAuthority, actualRejectedStateOperationIndex,
      () => {}, () => {})
    : undefined;
  check('actual state refusal transition shape remains pair-valid',
    actualStateRefusalPair !== undefined
      && safeSchemaPairValidation(actualStateRefusalPair.program, actualStateRefusalPair.authority).valid === true,
    detail(actualStateRefusalPair && safeSchemaPairValidation(actualStateRefusalPair.program, actualStateRefusalPair.authority)));
  const stateRefusalAttacks = [
    ['invented state refusal code', (refusal: Record<string, unknown>) => { refusal.code = 'forged'; }],
    ['invented state refusal status', (refusal: Record<string, unknown>) => { refusal.status = 'dynamic'; }],
    ['missing state refusal provenance', (refusal: Record<string, unknown>) => { delete refusal.provenance; }],
    ['forged state refusal provenance identity', (refusal: Record<string, unknown>) => {
      refusal.provenance = { ...X4_LAYOUT_PROVENANCE, id: 'forged-provenance' };
    }],
    ['state refusal payload diverges from stateAfter', (refusal: Record<string, unknown>) => {
      const state = refusal.state as Record<string, unknown>;
      refusal.state = { ...state, final: !state.final };
    }],
  ] as const;
  for (const [name, mutate] of stateRefusalAttacks) {
    const pair = actualRejectedStateOperationIndex >= 0 && actualRejectedAuthority
      ? actualOperationSnapshotPairFor(actualRejectedProgram, actualRejectedAuthority, actualRejectedStateOperationIndex,
        operationValue => mutate((operationValue.kernel as Record<string, unknown>).refusal as Record<string, unknown>),
        snapshot => mutate((snapshot.kernel as Record<string, unknown>).refusal as Record<string, unknown>))
      : undefined;
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false };
    check('closed transition schema rejects ' + name,
      validation.threw === false && validation.valid === false,
      detail({ name, validation }));
  }

  type ValuePathPart = string | number;
  type ValuePath = readonly ValuePathPart[];
  type ValueRecord = Record<string, unknown>;
  const isValueRecord = (value: unknown): value is ValueRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as ValueRecord;
    return Object.prototype.hasOwnProperty.call(candidate, 'status')
      && Object.prototype.hasOwnProperty.call(candidate, 'type')
      && Object.prototype.hasOwnProperty.call(candidate, 'expression')
      && Object.prototype.hasOwnProperty.call(candidate, 'location');
  };
  const valuePathAt = (root: unknown, path: ValuePath): unknown => {
    let current = root;
    for (const part of path) {
      if (!current || typeof current !== 'object') return undefined;
      current = (current as Record<string | number, unknown>)[part];
    }
    return current;
  };
  const findValuePath = (
    root: unknown,
    predicate: (value: ValueRecord) => boolean,
    occurrence = 0,
  ): ValuePath | undefined => {
    const seen = new Set<object>();
    let remaining = occurrence;
    const visit = (value: unknown, path: ValuePath): ValuePath | undefined => {
      if (!value || typeof value !== 'object') return undefined;
      const objectValue = value as object;
      if (seen.has(objectValue)) return undefined;
      seen.add(objectValue);
      if (!Array.isArray(value) && isValueRecord(value) && predicate(value)) {
        if (remaining === 0) return path;
        remaining -= 1;
      }
      if (Array.isArray(value)) {
        for (const [index, child] of value.entries()) {
          const found = visit(child, [...path, index]);
          if (found) return found;
        }
      } else {
        for (const key of Object.keys(value as ValueRecord)) {
          const found = visit((value as ValueRecord)[key], [...path, key]);
          if (found) return found;
        }
      }
      return undefined;
    };
    return visit(root, []);
  };
  const mutateValueAtPath = (
    root: unknown,
    path: ValuePath,
    mutate: (value: ValueRecord) => void,
  ): boolean => {
    const value = valuePathAt(root, path);
    if (!isValueRecord(value)) return false;
    mutate(value);
    return true;
  };
  const dynamicNumberSource = [
    'local menu = { name = "DynamicNumber", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1 / 0, 20, false)',
  ].join('\n');
  const dynamicNumberModel = buildX4UiCallModel(input(dynamicNumberSource, 'selftest/evidence-dynamic-number.lua'));
  const dynamicNumberResult = projectX4UiLayoutProgram(
    dynamicNumberModel,
    topTarget(dynamicNumberModel),
    profileFor(dynamicNumberModel),
  );
  const dynamicNumberProgram = programOf(dynamicNumberResult);
  const dynamicNumberAuthority = evidenceAuthorityOf(dynamicNumberResult);
  const coordinatedValuePair = (
    sourceProgram: X4UiLayoutProgram,
    sourceAuthority: EvidenceAuthorityLike | undefined,
    predicate: (value: ValueRecord) => boolean,
    mutate: (value: ValueRecord) => void,
    occurrence = 0,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (!sourceAuthority) return undefined;
    let operationIndex = -1;
    let path: ValuePath | undefined;
    for (const [index, candidate] of sourceProgram.operations.entries()) {
      const candidatePath = findValuePath(candidate, predicate, occurrence);
      if (candidatePath) {
        operationIndex = index;
        path = candidatePath;
        break;
      }
    }
    if (operationIndex < 0 || !path) return undefined;
    const candidateProgram = jsonClone(sourceProgram) as unknown as Record<string, unknown>;
    const candidateAuthority = jsonClone(sourceAuthority) as unknown as Record<string, unknown>;
    const programOperation = (candidateProgram.operations as ValueRecord[])[operationIndex];
    const authorityOperation = (candidateAuthority.operations as ValueRecord[])[operationIndex];
    const programChanged = mutateValueAtPath(programOperation, path, mutate);
    const authoritySnapshot = authorityOperation?.snapshot;
    const authorityChanged = mutateValueAtPath(authoritySnapshot, path, mutate);
    if (!programChanged || !authorityChanged) return undefined;
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
    };
  };
  const valueAttackCases = [
    {
      name: 'static scalar value removed #1',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static'
          && ['string', 'number', 'boolean'].includes(String(value.type))
          && Object.prototype.hasOwnProperty.call(value, 'value'),
        value => { delete value.value; }),
    },
    {
      name: 'static scalar value removed #2',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static'
          && ['string', 'number', 'boolean'].includes(String(value.type))
          && Object.prototype.hasOwnProperty.call(value, 'value'),
        value => { delete value.value; },
        1),
    },
    {
      name: 'dynamic number carries value',
      pair: coordinatedValuePair(dynamicNumberProgram, dynamicNumberAuthority,
        value => value.status === 'dynamic' && value.type === 'number' && !Object.prototype.hasOwnProperty.call(value, 'value'),
        value => { value.value = 1; }),
    },
    {
      name: 'static reference lacks reference',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static' && value.type === 'reference' && value.reference !== undefined,
        value => { delete value.reference; }),
    },
    {
      name: 'dynamic value carries sourceLiteral',
      pair: coordinatedValuePair(dynamicGapProgram, dynamicGapAuthority,
        value => value.status === 'dynamic' && value.sourceLiteral === undefined,
        value => { value.sourceLiteral = value.location; }),
    },
    {
      name: 'static literal carries reason',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static' && value.sourceLiteral !== undefined && value.reason === undefined,
        value => { value.reason = 'coordinated forged reason'; }),
    },
    {
      name: 'static literal carries symbol',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static' && value.sourceLiteral !== undefined && value.symbol === undefined,
        value => { value.symbol = 'coordinated-forged-symbol'; }),
    },
  ] as const;
  for (const attack of valueAttackCases) {
    const validation = attack.pair
      ? safeSchemaPairValidation(attack.pair.program, attack.pair.authority)
      : { threw: false, valid: false, reason: 'value fixture not found' };
    check(`emitted X4UiValue schema rejects ${attack.name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: attack.name, validation }));
  }

  const valueCensusFixtures: readonly {
    readonly name: string;
    readonly program: X4UiLayoutProgram;
    readonly authority: EvidenceAuthorityLike | undefined;
  }[] = [
    { name: 'all-kind', program: allKindProgram, authority: allKindAuthority },
    { name: 'dynamic-gap', program: dynamicGapProgram, authority: dynamicGapAuthority },
    { name: 'dynamic-number', program: dynamicNumberProgram, authority: dynamicNumberAuthority },
    { name: 'no-op', program: noOpProgram, authority: noOpAuthority },
    { name: 'schema-shape', program: schemaShapeProgram, authority: schemaShapeAuthority },
    { name: 'schema-parameter', program: schemaParameterProgram, authority: schemaParameterAuthority },
    { name: 'schema-local-result', program: schemaLocalResultProgram, authority: schemaLocalResultAuthority },
    { name: 'conditional', program: conditionalAllKindProgram, authority: conditionalAllKindAuthority },
    { name: 'rejected', program: rejectedEvidenceProgram, authority: rejectedEvidenceAuthority },
    { name: 'actual-rejected', program: actualRejectedProgram, authority: actualRejectedAuthority },
  ];
  const emittedValueSignatures = new Set<string>();
  const collectValueSignatures = (root: unknown): void => {
    const seen = new Set<object>();
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const objectValue = value as object;
      if (seen.has(objectValue)) return;
      seen.add(objectValue);
      if (!Array.isArray(value) && isValueRecord(value)) {
        const record = value as ValueRecord;
        emittedValueSignatures.add([
          record.status,
          record.type,
          Object.prototype.hasOwnProperty.call(record, 'value') ? 'value' : '-',
          Object.prototype.hasOwnProperty.call(record, 'reference') ? 'reference' : '-',
          Object.prototype.hasOwnProperty.call(record, 'sourceLiteral') ? 'sourceLiteral' : '-',
          Object.prototype.hasOwnProperty.call(record, 'reason') ? 'reason' : '-',
          Object.prototype.hasOwnProperty.call(record, 'symbol') ? 'symbol' : '-',
          Object.prototype.hasOwnProperty.call(record, 'parameter') ? 'parameter' : '-',
          Object.prototype.hasOwnProperty.call(record, 'localInvocationResult') ? 'localResult' : '-',
        ].join('|'));
      }
      for (const child of Array.isArray(value) ? value : Object.values(value as ValueRecord)) visit(child);
    };
    visit(root);
  };
  for (const fixture of valueCensusFixtures) collectValueSignatures(fixture.program.operations);
  check('positive emitted X4UiValue signature census remains pair-valid',
    emittedValueSignatures.size > 0
      && valueCensusFixtures.every(fixture => fixture.authority !== undefined
        && safeSchemaPairValidation(fixture.program, fixture.authority).valid === true),
    detail({ signatures: [...emittedValueSignatures].sort(), fixtureCount: valueCensusFixtures.length }));

  const coordinatedKernelPair = (
    mutate: (state: Record<string, unknown>) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } => {
    const candidateProgram = jsonClone(allKindProgram) as unknown as Record<string, unknown>;
    const candidateAuthority = jsonClone(allKindAuthority!) as unknown as Record<string, unknown>;
    const programState = ((candidateProgram.tables as ValueRecord[])[0].kernelState) as Record<string, unknown>;
    const authorityTables = (candidateAuthority.nodes as ValueRecord).tables as ValueRecord[];
    const authorityState = (authorityTables[0].snapshot as ValueRecord).kernelState as Record<string, unknown>;
    mutate(programState);
    mutate(authorityState);
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
    };
  };
  const kernelInvariantAttacks = [
    ['negative row padding', coordinatedKernelPair(state => {
      const row = (state.rows as ValueRecord[])[0];
      if (row) row.paddingTop = -1;
    })],
    ['negative specialized-cell height', coordinatedKernelPair(state => {
      const cell = (state.rows as ValueRecord[])
        .flatMap(row => Array.isArray(row.cells) ? row.cells as ValueRecord[] : [])
        .find(candidate => candidate.type !== 'cell');
      if (cell) cell.height = -1;
    })],
    ['row cell count differs from table columns', coordinatedKernelPair(state => {
      const row = (state.rows as ValueRecord[])[0];
      if (row && Array.isArray(row.cells)) row.cells = row.cells.slice(0, -1);
    })],
    ['finalized table has zero columns', coordinatedKernelPair(state => {
      state.columns = [];
      state.rows = [];
      state.final = true;
    })],
  ] as const;
  for (const [name, pair] of kernelInvariantAttacks) {
    const validation = safeSchemaPairValidation(pair.program, pair.authority);
    check(`emitted kernel schema rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }
  check('positive emitted kernel invariant census remains pair-valid',
    safeSchemaPairValidation(allKindProgram, allKindAuthority).valid === true
      && schemaRowGroupProgram !== undefined
      && schemaRowGroupAuthority !== undefined
      && safeSchemaPairValidation(schemaRowGroupProgram, schemaRowGroupAuthority).valid === true
      && safeSchemaPairValidation(actualRejectedProgram, actualRejectedAuthority).valid === true,
    detail({ allKind: safeSchemaPairValidation(allKindProgram, allKindAuthority), rowGroup: schemaRowGroupAuthority && safeSchemaPairValidation(schemaRowGroupProgram!, schemaRowGroupAuthority), rejected: actualRejectedAuthority && safeSchemaPairValidation(actualRejectedProgram, actualRejectedAuthority) }));

  const stateBeforeDriftPair = actualRejectedStateOperationIndex >= 0 && actualRejectedAuthority
    ? actualOperationSnapshotPairFor(actualRejectedProgram, actualRejectedAuthority, actualRejectedStateOperationIndex,
      operationValue => {
        const stateBefore = ((operationValue.kernel as Record<string, unknown>).stateBefore as Record<string, unknown>);
        const properties = stateBefore.properties as Record<string, unknown>;
        properties.x = (properties.x as number) + 1;
      },
      snapshot => {
        const stateBefore = ((snapshot.kernel as Record<string, unknown>).stateBefore as Record<string, unknown>);
        const properties = stateBefore.properties as Record<string, unknown>;
        properties.x = (properties.x as number) + 1;
      })
    : undefined;
  check('state refusal rejects stateBefore drift from stateAfter and refusal.state',
    stateBeforeDriftPair !== undefined
      && safeSchemaPairValidation(stateBeforeDriftPair.program, stateBeforeDriftPair.authority).valid === false,
    detail(stateBeforeDriftPair && safeSchemaPairValidation(stateBeforeDriftPair.program, stateBeforeDriftPair.authority)));

  const propertyPair = (
    mutate: (property: ValueRecord) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (propertyOperationIndex < 0 || !allKindAuthority) return undefined;
    return actualOperationSnapshotPair(propertyOperationIndex,
      operationValue => {
        const properties = ((operationValue.metadata as ValueRecord).semantics as ValueRecord).properties as ValueRecord[];
        if (properties[0]) mutate(properties[0]);
      },
      snapshot => {
        const properties = ((snapshot.metadata as ValueRecord).semantics as ValueRecord).properties as ValueRecord[];
        if (properties[0]) mutate(properties[0]);
      });
  };
  const propertyInvariantAttacks = [
    ['shifted property sourceOrder', propertyPair(property => { property.sourceOrder = (property.sourceOrder as number) + 1; })],
    ['zero property sourceOrder', propertyPair(property => { property.sourceOrder = 0; })],
    ['property source file differs from value location', propertyPair(property => {
      (property.source as ValueRecord).file = 'forged-property-source.lua';
    })],
    ['property value location file differs from source', propertyPair(property => {
      ((property.value as ValueRecord).location as ValueRecord).file = 'forged-property-value.lua';
    })],
    ['property source line is zero', propertyPair(property => {
      ((property.source as ValueRecord).start as ValueRecord).line = 0;
    })],
  ] as const;
  for (const [name, pair] of propertyInvariantAttacks) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'property fixture not found' };
    check(`emitted property schema rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }
  const firstSchemaShapeSource = schemaShapeProgram.target.source;
  check('positive source correlation census preserves first-line zero-offset and sourcePath',
    firstSchemaShapeSource.start.line === 1
      && firstSchemaShapeSource.start.offset === 0
      && typeof firstSchemaShapeSource.sourcePath === 'string'
      && schemaShapeAuthority !== undefined
      && safeSchemaPairValidation(schemaShapeProgram, schemaShapeAuthority).valid === true,
    detail({ source: firstSchemaShapeSource }));


  const authorityPairIsValid = (
    candidateResult: ReturnType<typeof projectX4UiLayoutProgram>,
    authorityOverride?: unknown,
  ): boolean => {
    const candidateProgram = resultProgram(candidateResult);
    const candidateAuthority = authorityOverride || evidenceAuthorityOf(candidateResult);
    return candidateProgram !== undefined
      && candidateAuthority !== undefined
      && validateX4UiLayoutEvidencePair(candidateProgram, candidateAuthority as EvidenceAuthorityLike).valid;
  };
  const allKindAuthorityResult = allKindResult;
  const allKindAuthorityProgram = allKindProgram;
  const noOpAuthorityResult = noOpResult;
  const noOpAuthorityProgram = noOpProgram;
  const dynamicGapAuthorityResult = dynamicGapResult;
  const dynamicGapAuthorityProgram = dynamicGapProgram;
  const conditionalAuthorityResult = conditionalAllKindResult;
  const rejectedAuthorityResult = rejectedEvidenceResult;
  const rejectedAuthorityProgram = rejectedEvidenceProgram;
  const conditionalAuthority = conditionalAllKindAuthority;
  const rejectedAuthority = rejectedEvidenceAuthority;
  const actualRejectedAuthorityProgram = actualRejectedProgram;
  const actualRejectedAuthorityEvidence = actualRejectedAuthority;
  const cloneAuthority = (authority: EvidenceAuthorityLike | undefined): EvidenceAuthorityLike | undefined =>
    authority ? jsonClone(authority) : undefined;
  const mutateProgramOperations = (programValue: X4UiLayoutProgram | undefined, mode: 'delete' | 'reverse' | 'duplicate') => {
    if (!programValue) return undefined;
    const operations = [...programValue.operations];
    if (mode === 'delete') operations.splice(0, 1);
    if (mode === 'reverse') operations.reverse();
    if (mode === 'duplicate' && operations[0]) operations.splice(1, 0, operations[0]);
    return freezeClone({ ...programValue, operations }) as X4UiLayoutProgram;
  };
  const mutateAuthorityOperations = (authority: EvidenceAuthorityLike | undefined, mode: 'delete' | 'reverse' | 'duplicate') => {
    if (!authority) return undefined;
    const operations = [...authority.operations];
    if (mode === 'delete') operations.splice(0, 1);
    if (mode === 'reverse') operations.reverse();
    if (mode === 'duplicate' && operations[0]) operations.splice(1, 0, operations[0]);
    return freezeClone({ ...authority, operations });
  };
  const programOperationAttacks = (['delete', 'reverse', 'duplicate'] as const).map(mode =>
    mutateProgramOperations(allKindAuthorityProgram, mode));
  const authorityOperationAttacks = (['delete', 'reverse', 'duplicate'] as const).map(mode =>
    mutateAuthorityOperations(allKindAuthority, mode));
  check('separate authority rejects coordinated program operation deletion, reindexing, reorder, and duplication',
    authorityPairIsValid(allKindAuthorityResult)
      && programOperationAttacks.every(candidate => candidate !== undefined
        && !authorityPairIsValid(resultWithAuthority({ ...allKindAuthorityResult, program: candidate }, allKindAuthority!), allKindAuthority)),
    detail({ authority: allKindAuthority, attacks: programOperationAttacks }));
  check('separate authority rejects authority operation deletion, reindexing, reorder, and duplication',
    authorityPairIsValid(allKindAuthorityResult)
      && authorityOperationAttacks.every(candidate => candidate !== undefined
        && !authorityPairIsValid(resultWithAuthority(allKindAuthorityResult, candidate), candidate)),
    detail({ authority: allKindAuthority, attacks: authorityOperationAttacks }));

  const nodeAuthorityBase = allKindAuthority as EvidenceAuthorityWithNodesLike | undefined;
  const nodeAuthority = nodeAuthorityBase?.nodes;
  const nodeAuthorityAttack = (
    nodes: EvidenceNodeLedgersLike,
  ): EvidenceAuthorityLike => freezeClone({ ...allKindAuthority!, nodes });
  const nodeAuthorityAttacks = nodeAuthority
    ? [
      nodeAuthorityAttack({
        ...nodeAuthority,
        frames: nodeAuthority.frames.map((entry, index) => index === 0
          ? { ...entry, operationIds: entry.operationIds.slice(1) }
          : entry),
      }),
      nodeAuthorityAttack({
        ...nodeAuthority,
        tables: nodeAuthority.tables.map((entry, index) => index === 0
          ? { ...entry, operationIds: entry.operationIds.length > 0
            ? [entry.operationIds[0], ...entry.operationIds]
            : ['operation:forged'] }
          : entry),
      }),
      nodeAuthorityAttack({
        ...nodeAuthority,
        rows: nodeAuthority.rows.map((entry, index) => index === 0
          ? { ...entry, operationIds: [...entry.operationIds].reverse() }
          : entry),
      }),
      nodeAuthorityAttack({
        ...nodeAuthority,
        cells: nodeAuthority.cells.map((entry, index) => index === 0
          ? { ...entry, operationIds: entry.operationIds.length > 0
            ? [entry.operationIds[0], ...entry.operationIds]
            : ['operation:forged'] }
          : entry),
      }),
      nodeAuthorityAttack({
        ...nodeAuthority,
        cells: nodeAuthority.cells.map((entry, index) => index === 0
          ? { ...entry, metadataOperationIds: entry.metadataOperationIds?.length
            ? [entry.metadataOperationIds[0], ...entry.metadataOperationIds]
            : ['operation:forged'] }
          : entry),
      }),
    ]
    : [];
  const nodeProgramAttacks = [
    allKindProgram.frames[0]
      ? freezeClone({
        ...allKindProgram,
        frames: allKindProgram.frames.map((entry, index) => index === 0
          ? { ...entry, operationIds: entry.operationIds.slice(1) }
          : entry),
      }) as X4UiLayoutProgram
      : undefined,
    allKindProgram.tables[0]
      ? freezeClone({
        ...allKindProgram,
        tables: allKindProgram.tables.map((entry, index) => index === 0
          ? { ...entry, operationIds: entry.operationIds.length > 0
            ? [entry.operationIds[0], ...entry.operationIds]
            : ['operation:forged'] }
          : entry),
      }) as X4UiLayoutProgram
      : undefined,
    allKindProgram.rows[0]
      ? freezeClone({
        ...allKindProgram,
        rows: allKindProgram.rows.map((entry, index) => index === 0
          ? { ...entry, operationIds: [...entry.operationIds].reverse() }
          : entry),
      }) as X4UiLayoutProgram
      : undefined,
    allKindProgram.cells[0]
      ? freezeClone({
        ...allKindProgram,
        cells: allKindProgram.cells.map((entry, index) => index === 0
          ? { ...entry, operationIds: entry.operationIds.length > 0
            ? [entry.operationIds[0], ...entry.operationIds]
            : ['operation:forged'] }
          : entry),
      }) as X4UiLayoutProgram
      : undefined,
    allKindProgram.cells[0]
      ? freezeClone({
        ...allKindProgram,
        cells: allKindProgram.cells.map((entry, index) => index === 0
          ? { ...entry, metadataOperationIds: entry.metadataOperationIds.length > 0
            ? [entry.metadataOperationIds[0], ...entry.metadataOperationIds]
            : ['operation:forged'] }
          : entry),
      }) as X4UiLayoutProgram
      : undefined,
  ];
  check('separate authority rejects frame/table/row/cell operation and cell metadata ledger attacks',
    authorityPairIsValid(allKindAuthorityResult)
      && nodeAuthorityBase !== undefined
      && nodeAuthorityAttacks.length === 5
      && nodeAuthorityAttacks.every(candidate => !validateX4UiLayoutEvidencePair(allKindProgram, candidate).valid)
      && nodeProgramAttacks.every(candidate => candidate !== undefined
        && !validateX4UiLayoutEvidencePair(candidate, allKindAuthority!).valid),
    detail({ authorityNodes: nodeAuthority, authorityAttacks: nodeAuthorityAttacks, programAttacks: nodeProgramAttacks }));

  const reachabilityCases = [
    { program: allKindProgram, authority: allKindAuthority, status: 'applied' },
    { program: dynamicGapProgram, authority: dynamicGapAuthority, status: 'unresolved' },
    { program: actualRejectedAuthorityProgram, authority: actualRejectedAuthorityEvidence, status: 'rejected' },
  ] as const;
  const reachabilityAttacks = reachabilityCases.flatMap(candidate => [
    { ...candidate, reachability: 'conditional' as const },
    { ...candidate, reachability: 'unreachable' as const },
  ]).map(candidate => {
    if (!candidate.authority) return { ...candidate, forged: undefined };
    const authority = jsonClone(candidate.authority);
    const callIndex = authority.calls.findIndex(call => call.status === candidate.status);
    return {
      ...candidate,
      forged: freezeClone({
        ...authority,
        calls: authority.calls.map((call, index) => index === callIndex
          ? { ...call, reachability: candidate.reachability }
          : call),
      }) as EvidenceAuthorityLike,
    };
  });
  check('separate authority rejects conditional or unreachable reachability forged onto applied, unresolved, or rejected calls',
    reachabilityCases.every(candidate => candidate.authority !== undefined
      && validateX4UiLayoutEvidencePair(candidate.program, candidate.authority).valid)
      && reachabilityAttacks.every(candidate => candidate.forged !== undefined
        && !validateX4UiLayoutEvidencePair(candidate.program, candidate.forged).valid),
    detail({ attacks: reachabilityAttacks }));

  const dynamicGapAuthorityClone = cloneAuthority(dynamicGapAuthority);
  const dynamicGapAuthorityGapAttacks = dynamicGapAuthorityClone
    ? [
      freezeClone({ ...dynamicGapAuthorityClone, gaps: dynamicGapAuthorityClone.gaps.slice(1) }),
      freezeClone({ ...dynamicGapAuthorityClone, gaps: [...dynamicGapAuthorityClone.gaps, dynamicGapAuthorityClone.gaps[0]] }),
      freezeClone({ ...dynamicGapAuthorityClone, gaps: [...dynamicGapAuthorityClone.gaps].reverse() }),
      freezeClone({ ...dynamicGapAuthorityClone, gaps: dynamicGapAuthorityClone.gaps.map((gap, index) => index === 0 ? { ...gap, reason: 'forged' } : gap) }),
    ]
    : [];
  const dynamicGapProgramGapAttacks = dynamicGapAuthorityProgram
    ? [
      freezeClone({ ...dynamicGapAuthorityProgram, gaps: dynamicGapAuthorityProgram.gaps.slice(1) }),
      freezeClone({ ...dynamicGapAuthorityProgram, gaps: [...dynamicGapAuthorityProgram.gaps, dynamicGapAuthorityProgram.gaps[0]] }),
      freezeClone({ ...dynamicGapAuthorityProgram, gaps: [...dynamicGapAuthorityProgram.gaps].reverse() }),
      freezeClone({ ...dynamicGapAuthorityProgram, gaps: dynamicGapAuthorityProgram.gaps.map((gap, index) => index === 0 ? { ...gap, reason: 'forged' } : gap) }),
    ]
    : [];
  check('separate authority rejects program and authority gap omission, duplication, reversal, and field mutation',
    authorityPairIsValid(dynamicGapAuthorityResult)
      && dynamicGapProgramGapAttacks.every(candidate => !authorityPairIsValid(
        resultWithAuthority({ ...dynamicGapAuthorityResult, program: candidate }, dynamicGapAuthority!),
        dynamicGapAuthority!,
      ))
      && dynamicGapAuthorityGapAttacks.every(candidate => !authorityPairIsValid(
        resultWithAuthority(dynamicGapAuthorityResult, candidate),
        candidate,
      )),
    detail({ programAttacks: dynamicGapProgramGapAttacks, authorityAttacks: dynamicGapAuthorityGapAttacks }));
  const noOpAuthorityOperations = noOpAuthority?.operations.filter(operation => operation.kind === 'setColWidth') || [];
  check('repeated no-op width transitions are independently represented by the authority',
    authorityPairIsValid(noOpAuthorityResult)
      && noOpAuthorityOperations.length === 2
      && noOpAuthorityOperations[0].id !== noOpAuthorityOperations[1].id
      && noOpAuthorityProgram?.operations.filter(operation => operation.kind === 'setColWidth').length === 2,
    detail({ authority: noOpAuthorityOperations, operations: noOpAuthorityProgram?.operations }));
  const schemaAttackAuthority = cloneAuthority(allKindAuthority);
  const schemaAttacks = schemaAttackAuthority
    ? [
      { ...schemaAttackAuthority, version: 99 },
      { ...schemaAttackAuthority, calls: schemaAttackAuthority.calls.map((call, index) => index === 0 ? { ...call, id: '' } : call) },
      { ...schemaAttackAuthority, calls: schemaAttackAuthority.calls.map((call, index) => index === 0 ? { ...call, modelOrder: Number.POSITIVE_INFINITY } : call) },
      { ...schemaAttackAuthority, calls: schemaAttackAuthority.calls.map((call, index) => index === 0 ? { ...call, sourceOrder: -1 } : call) },
      { ...schemaAttackAuthority, calls: schemaAttackAuthority.calls.map((call, index) => index === 0 ? { ...call, reachability: 'forged' } : call) },
      { ...schemaAttackAuthority, calls: schemaAttackAuthority.calls.map((call, index) => index === 0 ? { ...call, unknown: true } : call) },
    ].map(candidate => freezeClone(candidate))
    : [];
  check('authority recursively rejects unsafe numbers, empty or forged IDs, source/order/status, and unknown-key attacks',
    authorityPairIsValid(allKindAuthorityResult)
      && schemaAttacks.every(candidate => !authorityPairIsValid(
        resultWithAuthority(allKindAuthorityResult, candidate),
        candidate,
      )),
    detail({ attacks: schemaAttacks }));
  const safePairValidation = (
    candidateProgram: X4UiLayoutProgram,
    candidateAuthority: EvidenceAuthorityLike,
  ): { readonly threw: boolean; readonly valid?: boolean } => {
    try {
      return { threw: false, valid: validateX4UiLayoutEvidencePair(candidateProgram, candidateAuthority).valid };
    } catch {
      return { threw: true };
    }
  };
  const undefinedOperationSnapshotAuthority = allKindAuthority
    ? mutateAuthorityJson(allKindAuthority, candidate => {
      const operation = (candidate.operations as unknown as Record<string, unknown>[])[0];
      const snapshot = operation?.snapshot as Record<string, unknown> | undefined;
      if (snapshot) snapshot.auditUndefinedField = undefined;
    })
    : undefined;
  const undefinedNodeSnapshotAuthority = allKindAuthority
    ? mutateAuthorityJson(allKindAuthority, candidate => {
      const frames = (candidate.nodes as Record<string, unknown>).frames as Record<string, unknown>[];
      const snapshot = frames[0]?.snapshot as Record<string, unknown> | undefined;
      if (snapshot) snapshot.auditUndefinedField = undefined;
    })
    : undefined;
  check('undefined nested operation snapshot keys fail exact authority validation',
    undefinedOperationSnapshotAuthority !== undefined
      && safePairValidation(allKindProgram, undefinedOperationSnapshotAuthority).valid === false,
    detail({
      validation: undefinedOperationSnapshotAuthority
        ? safePairValidation(allKindProgram, undefinedOperationSnapshotAuthority)
        : undefined,
    }));
  check('undefined nested node snapshot keys fail exact authority validation',
    undefinedNodeSnapshotAuthority !== undefined
      && safePairValidation(allKindProgram, undefinedNodeSnapshotAuthority).valid === false,
    detail({
      validation: undefinedNodeSnapshotAuthority
        ? safePairValidation(allKindProgram, undefinedNodeSnapshotAuthority)
        : undefined,
    }));
  const cyclicAuthority = (kind: 'operation' | 'node'): EvidenceAuthorityLike | undefined => {
    if (!allKindAuthority) return undefined;
    const candidate = jsonClone(allKindAuthority) as unknown as Record<string, unknown>;
    if (kind === 'operation') {
      const operation = (candidate.operations as unknown as Record<string, unknown>[])[0];
      const snapshot = operation?.snapshot as Record<string, unknown> | undefined;
      if (snapshot) snapshot.auditCycle = snapshot;
    } else {
      const frames = (candidate.nodes as Record<string, unknown>).frames as Record<string, unknown>[];
      const snapshot = frames[0]?.snapshot as Record<string, unknown> | undefined;
      if (snapshot) snapshot.auditCycle = snapshot;
    }
    return freezeCycleClone(candidate) as unknown as EvidenceAuthorityLike;
  };
  const cyclicOperationValidation = cyclicAuthority('operation');
  const cyclicNodeValidation = cyclicAuthority('node');
  const cyclicOperationResult = cyclicOperationValidation
    ? safePairValidation(allKindProgram, cyclicOperationValidation)
    : undefined;
  const cyclicNodeResult = cyclicNodeValidation
    ? safePairValidation(allKindProgram, cyclicNodeValidation)
    : undefined;
  check('cyclic operation snapshots fail closed without throwing',
    cyclicOperationResult?.threw === false && cyclicOperationResult.valid === false,
    detail({ validation: cyclicOperationResult }));
  check('cyclic node snapshots fail closed without throwing',
    cyclicNodeResult?.threw === false && cyclicNodeResult.valid === false,
    detail({ validation: cyclicNodeResult }));
  const realSceneZeroCell = allKindProgram.cells.find(candidate =>
    typeof candidate.kernelState?.y === 'number' && Object.is(candidate.kernelState.y, 0));
  const signedZeroAuthority = realSceneZeroCell && allKindAuthority
    ? mutateAuthorityJson(allKindAuthority, candidate => {
      const cells = (candidate.nodes as Record<string, unknown>).cells as Record<string, unknown>[];
      const cell = cells.find(candidateCell => candidateCell.id === realSceneZeroCell.id);
      const snapshot = cell?.snapshot as Record<string, unknown> | undefined;
      const kernelState = snapshot?.kernelState as Record<string, unknown> | undefined;
      if (kernelState && typeof kernelState.y === 'number' && Object.is(kernelState.y, 0)) kernelState.y = -0;
    })
    : undefined;
  const signedZeroResult = signedZeroAuthority
    ? safePairValidation(allKindProgram, signedZeroAuthority)
    : undefined;
  check('signed-zero mutation of a real scene-consumed zero is exact',
    realSceneZeroCell === undefined
      ? true
      : signedZeroResult?.threw === false && signedZeroResult.valid === false,
    detail({
      available: realSceneZeroCell !== undefined,
      cellId: realSceneZeroCell?.id,
      validation: signedZeroResult,
    }));
  const authorityJsonClone = cloneAuthority(allKindAuthority);
  const frozenAuthorityJsonClone = authorityJsonClone ? freezeClone(authorityJsonClone) : undefined;
  check('JSON authority clone round-trips structurally without a producer-origin claim',
    authorityPairIsValid(allKindAuthorityResult)
      && authorityJsonClone !== undefined
      && JSON.stringify(authorityJsonClone) === JSON.stringify(allKindAuthority)
      && frozenAuthorityJsonClone !== undefined
      && validateX4UiLayoutEvidencePair(allKindProgram, frozenAuthorityJsonClone).valid
      && !Object.prototype.hasOwnProperty.call(frozenAuthorityJsonClone, 'trust')
      && !Object.prototype.hasOwnProperty.call(frozenAuthorityJsonClone, 'producerOrigin'),
    detail({
      originalFrozen: Object.isFrozen(allKindAuthority),
      cloneFrozen: frozenAuthorityJsonClone ? Object.isFrozen(frozenAuthorityJsonClone) : undefined,
      clone: frozenAuthorityJsonClone,
    }));
  const rejectedAuthorityKinds = ['setColWidth', 'addRow', 'setColSpan', 'createText', 'createButton', 'createEditBox', 'createIcon'];
  check('unresolved fixture retains exact unresolved authority membership',
    authorityPairIsValid(rejectedAuthorityResult)
      && rejectedAuthority !== undefined
      && rejectedAuthorityKinds.filter(kind => kind !== 'addRow').every(kind =>
        rejectedAuthority.operations.some(operation => operation.kind === kind && operation.status === 'unresolved')),
    detail({ authority: rejectedAuthority, operations: rejectedAuthorityProgram?.operations }));
  check('static and conditional/unreachable all-kind streams retain complete separate authority',
    authorityPairIsValid(allKindAuthorityResult)
      && authorityPairIsValid(conditionalAuthorityResult)
      && allKindAuthority?.calls.length === 18
      && conditionalAuthority?.calls.length === 36
      && conditionalAuthority?.calls.filter(call => call.kind === 'addRow').length === 4,
    detail({ static: allKindAuthority, conditional: conditionalAuthority }));

  check('projection remains permanently not verified in game',
    program.verification.game === X4_UI_LAYOUT_GAME_TRUTH
      && program.verification.gameVerified === false
      && result.verification.game === X4_UI_LAYOUT_GAME_TRUTH,
    detail(program.verification));
  check('result, nodes, operations, and profile are deeply frozen and serializable',
    Object.isFrozen(result)
      && Object.isFrozen(program)
      && Object.isFrozen(program.tables)
      && Object.isFrozen(program.operations)
      && Object.isFrozen(program.profile)
      && resultAuthority !== undefined
      && Object.isFrozen(resultAuthority)
      && Object.isFrozen(resultAuthority.profile)
      && (resultAuthority.profile as unknown) !== program.profile
      && Object.isFrozen(resultAuthority.calls)
      && Object.isFrozen(resultAuthority.operations)
      && Object.isFrozen(resultAuthority.gaps)
      && Object.isFrozen(resultAuthority.linkedGapIndexes)
      && Object.isFrozen(resultAuthority.unlinkedGapIndexes)
      && Object.isFrozen(resultAuthority.nodes)
      && Object.isFrozen(resultAuthority.nodes.frames)
      && Object.isFrozen(resultAuthority.nodes.tables)
      && Object.isFrozen(resultAuthority.nodes.rows)
      && Object.isFrozen(resultAuthority.nodes.cells)
      && Object.isFrozen(resultAuthority.localIdentities)
      && Object.isFrozen(resultAuthority.localIdentities.functions)
      && Object.isFrozen(resultAuthority.localIdentities.invocations)
      && resultAuthority.localIdentities.functions.every(identity => Object.isFrozen(identity)
        && Object.isFrozen(identity.source)
        && Object.isFrozen(identity.parameters)
        && (identity.parameters as unknown) !== (model.localFunctions.find(candidate => candidate.id === identity.id)?.parameters as unknown))
      && resultAuthority.localIdentities.invocations.every(identity => Object.isFrozen(identity)
        && Object.isFrozen(identity.source))
      && resultAuthority.nodes.frames.every(node => Object.isFrozen(node) && Object.isFrozen(node.operationIds))
      && resultAuthority.nodes.tables.every(node => Object.isFrozen(node) && Object.isFrozen(node.operationIds))
      && resultAuthority.nodes.rows.every(node => Object.isFrozen(node) && Object.isFrozen(node.operationIds))
      && resultAuthority.nodes.cells.every(node => Object.isFrozen(node)
        && Object.isFrozen(node.operationIds)
        && node.metadataOperationIds !== undefined
        && Object.isFrozen(node.metadataOperationIds))
      && (resultAuthority.nodes.frames as unknown) !== program.frames
      && (resultAuthority.nodes.tables as unknown) !== program.tables
      && (resultAuthority.nodes.rows as unknown) !== program.rows
      && (resultAuthority.nodes.cells as unknown) !== program.cells
       && resultAuthority.nodes.frames.every((node, index) =>
         (node.operationIds as unknown) !== program.frames[index]?.operationIds
           && Object.isFrozen(node.snapshot)
           && (node.snapshot as unknown) !== program.frames[index]
           && Object.isFrozen(node.snapshot.operationIds)
           && Object.isFrozen(node.snapshot.descriptorFacts))
       && resultAuthority.nodes.tables.every((node, index) =>
         (node.operationIds as unknown) !== program.tables[index]?.operationIds
           && Object.isFrozen(node.snapshot)
           && (node.snapshot as unknown) !== program.tables[index]
           && Object.isFrozen(node.snapshot.operationIds)
           && Object.isFrozen(node.snapshot.descriptorFacts))
       && resultAuthority.nodes.rows.every((node, index) =>
         (node.operationIds as unknown) !== program.rows[index]?.operationIds
           && Object.isFrozen(node.snapshot)
           && (node.snapshot as unknown) !== program.rows[index]
           && Object.isFrozen(node.snapshot.operationIds)
           && Object.isFrozen(node.snapshot.descriptorFacts))
       && resultAuthority.nodes.cells.every((node, index) =>
         (node.operationIds as unknown) !== program.cells[index]?.operationIds
           && (node.metadataOperationIds as unknown) !== program.cells[index]?.metadataOperationIds
           && Object.isFrozen(node.snapshot)
           && (node.snapshot as unknown) !== program.cells[index]
           && Object.isFrozen(node.snapshot.operationIds)
           && Object.isFrozen((node.snapshot as { readonly metadataOperationIds: readonly string[] }).metadataOperationIds)
           && Object.isFrozen(node.snapshot.descriptorFacts))
      && resultAuthority.calls.every(call => Object.isFrozen(call) && Object.isFrozen(call.source))
       && resultAuthority.operations.every(operation => Object.isFrozen(operation) && Object.isFrozen(operation.source))
       && resultAuthority.operations.every((operation, index) =>
         Object.isFrozen(operation.snapshot)
           && operation.snapshot !== program.operations[index]
           && Object.isFrozen(operation.snapshot.metadata)
           && Object.isFrozen(operation.snapshot.descriptorFacts))
      && resultAuthority.gaps.every(gap => Object.isFrozen(gap) && Object.isFrozen(gap.source))
      && resultAuthority.calls.every((call, index) =>
        call.source !== resultAuthority.operations[index]?.source
          && (call.expansion === undefined || call.expansion !== resultAuthority.operations[index]?.expansion))
      && (resultAuthority.operations as unknown) !== program.operations
      && (resultAuthority.gaps as unknown) !== program.gaps
      && (resultAuthority.operations.length === 0 || (resultAuthority.operations[0] as unknown) !== program.operations[0])
      && (resultAuthority.gaps.length === 0 || (resultAuthority.gaps[0] as unknown) !== program.gaps[0])
      && JSON.stringify(result).length > 0,
    detail({ resultFrozen: Object.isFrozen(result), programFrozen: Object.isFrozen(program) }));
  check('projection is deterministic and does not mutate model or profile',
    JSON.stringify(result) === JSON.stringify(projectX4UiLayoutProgram(model, target, profile))
      && JSON.stringify(model) === beforeModel
      && JSON.stringify(profile) === beforeProfile,
    detail({ modelChanged: JSON.stringify(model) !== beforeModel, profileChanged: JSON.stringify(profile) !== beforeProfile }));

  const descriptorSource = [
    'local menu = { name = "Descriptor", layer = 1 }',
    'function menu.display()',
    '  local frame = Helper.createFrameHandle(menu, { x = 1, y = 2, width = 120, height = 90, layer = 3, autoFrameHeight = false })',
    '  local table = frame:addTable(5, { x = 3, y = 4, width = 100, tabOrder = 2, backgroundID = "panel", highlightMode = "off", maxVisibleHeight = 70, reserveScrollBar = false, scaling = false })',
    '  local row = table:addRow(false, { paddingTop = 1, paddingBottom = 2, borderBelow = false, fixed = true, scaling = false })',
    '  row[1]:createText("Text", { x = 6, y = 7, width = 20, height = 8, font = "Zekton", fontsize = 11, halign = "center", wordwrap = true })',
    '  row[2]:createButton({ x = 1, y = 2, width = 30 }):setText("Button")',
    '  row[3]:createEditBox({ x = 2, y = 3, width = 31, height = 10, defaultText = "Default", description = "Describe", maxChars = 12, selectTextOnActivation = false })',
    '  row[4]:createIcon("solid", { x = 3, y = 4, width = 11, height = 12, affectRowHeight = false })',
    '  row[5]:createText("Scaled", { height = Helper.scaleY(6, false), fontsize = Helper.scaleFont("Zekton", 8, false) })',
    'end',
  ].join('\n');
  const descriptorModel = buildX4UiCallModel(input(descriptorSource, 'selftest/descriptor-facts.lua'));
  const descriptorCatalog = createX4UiLayoutTargetCatalog(descriptorModel);
  const descriptorTarget = descriptorCatalog.targets.find(candidate => candidate.kind !== 'top-level');
  if (!descriptorTarget) throw new Error('descriptor fixture target missing');
  const descriptorProgram = programOf(projectX4UiLayoutProgram(
    descriptorModel,
    descriptorTarget,
    profileFor(descriptorModel),
  ));
  const descriptorFrame = descriptorProgram.frames[0];
  const descriptorTable = descriptorProgram.tables[0];
  const descriptorRow = descriptorProgram.rows[0];
  const descriptorCells = descriptorProgram.cells.filter(candidate => candidate.rowId === descriptorRow.id);
  const descriptorText = descriptorCells.find(candidate => candidate.column === 1)!;
  const descriptorButton = descriptorCells.find(candidate => candidate.column === 2)!;
  const descriptorEditBox = descriptorCells.find(candidate => candidate.column === 3)!;
  const descriptorIcon = descriptorCells.find(candidate => candidate.column === 4)!;
  const descriptorScaledText = descriptorCells.find(candidate => candidate.column === 5)!;
  check('direct menu target exposes renderer-ready frame, table, and row facts',
    factValue(descriptorFrame.descriptorFacts.x) === 1
      && factValue(descriptorFrame.descriptorFacts.y) === 2
      && factValue(descriptorFrame.descriptorFacts.width) === 120
      && factValue(descriptorFrame.descriptorFacts.height) === 90
      && factValue(descriptorFrame.descriptorFacts.layer) === 3
      && factValue(descriptorFrame.descriptorFacts.autoFrameHeight) === false
      && factValue(descriptorTable.descriptorFacts.x) === 3
      && factValue(descriptorTable.descriptorFacts.y) === 4
      && factValue(descriptorTable.descriptorFacts.requestedWidth) === 100
      && factValue(descriptorTable.descriptorFacts.finalWidth) === 100
      && factValue(descriptorTable.descriptorFacts.maxVisibleHeight) === 70
      && factValue(descriptorTable.descriptorFacts.tabOrder) === 2
      && factValue(descriptorTable.descriptorFacts.highlightMode) === 'off'
      && factValue(descriptorRow.descriptorFacts.paddingTop) === 1
      && factValue(descriptorRow.descriptorFacts.paddingBottom) === 2
      && factValue(descriptorRow.descriptorFacts.borderBelow) === false
      && factValue(descriptorRow.descriptorFacts.fixed) === true
      && factValue(descriptorRow.descriptorFacts.scaling) === false
      && factValue(descriptorRow.descriptorFacts.selectable) === false
      && factValue(descriptorRow.descriptorFacts.interactive) === true
      && descriptorRow.descriptorFacts.interactive.sourcePin?.lineStart === 3192,
    detail({ frame: descriptorFrame.descriptorFacts, table: descriptorTable.descriptorFacts, row: descriptorRow.descriptorFacts }));
  check('text, button, edit-box, and icon cells expose exact outer geometry and content facts',
    factValue(descriptorText.descriptorFacts.contentKind) === 'text'
      && factValue(descriptorText.descriptorFacts.outerX) === 6
      && factValue(descriptorText.descriptorFacts.outerY) === 7
      && factValue(descriptorText.descriptorFacts.outerWidth) === 20
      && factValue(descriptorText.descriptorFacts.outerHeight) === 8
      && factValue(descriptorText.descriptorFacts.primaryContent) === 'Text'
      && factValue(descriptorText.descriptorFacts.font) === 'Zekton'
      && factValue(descriptorText.descriptorFacts.fontsize) === 11
      && factValue(descriptorText.descriptorFacts.halign) === 'center'
      && factValue(descriptorText.descriptorFacts.wordwrap) === true
      && factValue(descriptorButton.descriptorFacts.primaryContent) === 'Button'
      && factValue(descriptorButton.descriptorFacts.outerHeight) === 25
      && factValue(descriptorEditBox.descriptorFacts.outerX) === 2
      && factValue(descriptorEditBox.descriptorFacts.outerY) === 3
      && factValue(descriptorEditBox.descriptorFacts.outerWidth) === 31
      && factValue(descriptorEditBox.descriptorFacts.defaultText) === 'Default'
      && factValue(descriptorEditBox.descriptorFacts.maxChars) === 12
      && factValue(descriptorEditBox.descriptorFacts.selectTextOnActivation) === false
      && factValue(descriptorIcon.descriptorFacts.icon) === 'solid'
      && factValue(descriptorIcon.descriptorFacts.outerHeight) === 12
      && factValue(descriptorIcon.descriptorFacts.affectRowHeight) === false,
    detail(descriptorCells.map(candidate => ({ column: candidate.column, facts: candidate.descriptorFacts }))));
  check('descriptor defaults cite shipped 16/25 and exact Helper declaration lines',
    descriptorButton.descriptorFacts.outerHeight.status === 'known'
      && descriptorButton.descriptorFacts.outerHeight.value === 25
      && descriptorButton.descriptorFacts.outerHeight.sourcePin?.lineStart === 522
      && descriptorButton.descriptorFacts.font.status === 'known'
      && descriptorButton.descriptorFacts.font.value === 'Zekton'
      && descriptorButton.descriptorFacts.font.sourcePin?.lineStart === 529
      && profileFor(descriptorModel).helper.constants.standardTextHeight.value === 16
      && profileFor(descriptorModel).helper.constants.standardTextHeight.source.lineStart === 533,
    detail(descriptorButton.descriptorFacts));
  check('direct scale provenance reaches permitted facts without treating scaleFont as geometry',
    descriptorScaledText.descriptorFacts.outerHeight.status === 'known'
      && descriptorScaledText.descriptorFacts.outerHeight.value === 6
      && descriptorScaledText.descriptorFacts.outerWidth.status === 'known'
      && descriptorScaledText.descriptorFacts.outerWidth.value === 14
      && descriptorText.descriptorFacts.outerWidth.status === 'known'
      && descriptorText.descriptorFacts.outerWidth.value === 20
      && descriptorEditBox.descriptorFacts.outerWidth.status === 'known'
      && descriptorEditBox.descriptorFacts.outerWidth.value === 31
      && descriptorScaledText.descriptorFacts.outerHeight.provenance === 'direct-helper-scale'
      && descriptorScaledText.descriptorFacts.fontsize.status === 'known'
      && descriptorScaledText.descriptorFacts.fontsize.value === 8
      && descriptorScaledText.descriptorFacts.fontsize.provenance === 'direct-helper-scale'
      && descriptorProgram.operations.filter(candidate => candidate.kind === 'scaleY' || candidate.kind === 'scaleFont')
        .every(candidate => factProvenance(candidate.descriptorFacts.result) === 'direct-helper-scale'),
    detail({ cell: descriptorScaledText.descriptorFacts, operations: descriptorProgram.operations }));

  const scaledSource = [
    'local menu = { name = "Scaled", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = Helper.scaleX(40), scaling = false })',
    'table:setColWidth(1, Helper.scaleX(10), false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("scaled", { height = Helper.scaleY(8, false), y = Helper.scaleY(3, false) })',
    'row[2]:createText("font", { height = Helper.scaleFont("Zekton", 8) })',
  ].join('\n');
  const scaledModel = buildX4UiCallModel(input(scaledSource, 'selftest/scaled-layout.lua'));
  const scaledBaseProfile = profileFor(scaledModel, { minTextHeight: 7 });
  const scaledProfile: X4UiLayoutProjectionProfile = {
    ...scaledBaseProfile,
    id: 'selftest-scaled-profile',
    metrics: { ...scaledBaseProfile.metrics, uiScale: 1.5 },
  };
  const scaledProgram = programOf(projectX4UiLayoutProgram(scaledModel, topTarget(scaledModel), scaledProfile));
  const scaledTable = scaledProgram.tables[0];
  const scaledRow = scaledProgram.rows[0];
  const scaledCell = scaledProgram.cells.find(candidate => candidate.column === 1);
  const fontCell = scaledProgram.cells.find(candidate => candidate.column === 2);
  const scaledScaleOperations = scaledProgram.operations.filter(candidate => candidate.kind === 'scaleX' || candidate.kind === 'scaleY');
  check('direct source-matched scaleX/scaleY results drive table, column, and cell geometry',
    scaledTable.requestedWidth === 60
      && scaledTable.kernelState?.columns[0].width === 15
      && scaledCell?.kernelState?.height === 8
      && scaledCell.kernelState.y === 3
      && scaledRow.height?.value === 11
      && scaledScaleOperations.length === 4
      && scaledScaleOperations.every(candidate => candidate.status === 'applied' && candidate.scale?.status === 'resolved')
      && !scaledProgram.gaps.some(gap => gap.reason.includes('scaleX/scaleY result is not modeled')),
    detail({ table: scaledTable, row: scaledRow, cell: scaledCell, operations: scaledScaleOperations, gaps: scaledProgram.gaps }));
  const scaleFontOperation = operation(scaledProgram, 'scaleFont');
  check('static scaleFont is resolved as an operation but is not reused as geometry',
    scaleFontOperation?.status === 'applied'
      && scaleFontOperation.scale?.status === 'resolved'
      && scaleFontOperation.scale.value === 12
      && fontCell?.kernelState?.type === 'cell'
      && scaledProgram.gaps.some(gap => gap.category === 'height' && gap.expression?.includes('Helper.scaleFont')),
    detail({ scaleFontOperation, fontCell, gaps: scaledProgram.gaps.filter(gap => gap.expression?.includes('Helper.scaleFont')) }));

  const sampledSource = [
    'local menu = { name = "Sampled", layer = 1 }',
    'function menu.display(tw, dynamicText, mx)',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local table = frame:addTable(2, { width = tw - mx * 2, reserveScrollBar = false, scaling = false })',
    '  local row = table:addRow(false, { scaling = false })',
    '  row[1]:createText(dynamicText, { height = 10 })',
    '  row[2]:createText(dynamicText, { height = 10 })',
    'end',
  ].join('\n');
  const sampledModel = buildX4UiCallModel(input(sampledSource, 'selftest/production-shaped-samples.lua'));
  const sampledTarget = createX4UiLayoutTargetCatalog(sampledModel).targets.find(candidate => candidate.kind !== 'top-level');
  if (!sampledTarget) throw new Error('sampled fixture target missing');
  const sampledProfile = profileFor(sampledModel, { minTextHeight: 7 });
  const unsampledResult = projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile);
  const unsampledProgram = programOf(unsampledResult);
  const numberSample = unsampledProgram.sampleCatalog.entries.find(candidate => candidate.expectedType === 'number');
  const textSamples = unsampledProgram.sampleCatalog.entries.filter(candidate => candidate.expectedType === 'string');
  check('unsampled runtime width/text stay unresolved while exact same expressions retain separate range IDs',
    unsampledProgram.tables[0]?.kernelState === undefined
      && numberSample?.expression === 'tw - mx * 2'
      && textSamples.length === 2
      && textSamples.every(candidate => candidate.expression === 'dynamicText')
      && textSamples[0].id !== textSamples[1].id
      && textSamples[0].source.start.offset !== textSamples[1].source.start.offset
      && unsampledProgram.sampleCatalog.entries.every(candidate => candidate.id.includes(unsampledProgram.sampleCatalog.sourceIdentity.sha256)),
    detail({ catalog: unsampledProgram.sampleCatalog, tables: unsampledProgram.tables, gaps: unsampledProgram.gaps }));
  if (!numberSample || textSamples.length !== 2) throw new Error(`sample fixture catalog incomplete: ${detail(unsampledProgram.sampleCatalog)}`);
  const validSamples: X4UiLayoutPreviewSampleInput = {
    catalogId: unsampledProgram.sampleCatalog.id,
    source: unsampledProgram.sampleCatalog.sourceIdentity,
    values: [
      { id: numberSample.id, value: 80 },
      { id: textSamples[0].id, value: 'First' },
      { id: textSamples[1].id, value: 'Second' },
    ],
  };
  const beforeSamples = JSON.stringify(validSamples);
  const sampledResult = projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, validSamples);
  const sampledProgram = programOf(sampledResult);
  const sampledCells = sampledProgram.cells.filter(candidate => candidate.kernelState?.type === 'text');
  check('exact valid samples project runtime table width and range-owned text with preview-only provenance',
    sampledProgram.tables[0].requestedWidth === 80
      && sampledProgram.tables[0].kernelState?.columns.map(column => column.width).join(',') === '40,39'
      && factValue(sampledCells[0].descriptorFacts.primaryContent) === 'First'
      && factValue(sampledCells[1].descriptorFacts.primaryContent) === 'Second'
      && factProvenance(sampledProgram.tables[0].descriptorFacts.requestedWidth) === 'preview-sample'
      && sampledCells.every(candidate => factProvenance(candidate.descriptorFacts.primaryContent) === 'preview-sample')
      && sampledProgram.previewSampleBindings.every(candidate => candidate.status === 'consumed' && candidate.provenance === 'preview-only')
      && !sampledProgram.gaps.some(gap => ['tw - mx * 2', 'dynamicText'].includes(gap.expression || '')),
    detail({ table: sampledProgram.tables[0], cells: sampledCells, bindings: sampledProgram.previewSampleBindings, gaps: sampledProgram.gaps }));
  const sparseSampleBindingsProgram = mutateProgramJson(sampledProgram, candidate => {
    const bindings = candidate.previewSampleBindings as unknown[];
    delete bindings[0];
  });
  check('closed program schema rejects sparse preview sample bindings without throwing',
    safeSchemaPairValidation(sparseSampleBindingsProgram, evidenceAuthorityOf(sampledResult)).valid === false,
    detail({ validation: safeSchemaPairValidation(sparseSampleBindingsProgram, evidenceAuthorityOf(sampledResult)) }));
  const changedSamples: X4UiLayoutPreviewSampleInput = {
    ...validSamples,
    values: validSamples.values.map(candidate => candidate.id === numberSample.id ? { ...candidate, value: 90 } : candidate),
  };
  const changedSampleProgram = programOf(projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, changedSamples));
  check('changing one valid sample changes only its dependent kernel/facts and never mutates source inputs',
    changedSampleProgram.tables[0].requestedWidth === 90
      && changedSampleProgram.tables[0].kernelState?.columns.map(column => column.width).join(',') === '45,44'
      && factValue(changedSampleProgram.cells.filter(candidate => candidate.kernelState?.type === 'text')[0].descriptorFacts.primaryContent) === 'First'
      && JSON.stringify(sampledModel) === JSON.stringify(buildX4UiCallModel(input(sampledSource, 'selftest/production-shaped-samples.lua')))
      && JSON.stringify(validSamples) === beforeSamples,
    detail({ original: sampledProgram.tables[0], changed: changedSampleProgram.tables[0] }));
  check('three-argument path equals explicit undefined and sample outputs are frozen/serializable',
    JSON.stringify(unsampledResult) === JSON.stringify(projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, undefined))
      && JSON.stringify(sampledResult) === JSON.stringify(projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, validSamples))
      && Object.isFrozen(sampledProgram.sampleCatalog)
      && Object.isFrozen(sampledProgram.sampleCatalog.entries)
      && Object.isFrozen(sampledProgram.previewSampleBindings)
      && JSON.stringify(sampledResult).length > 0,
    detail({ catalogFrozen: Object.isFrozen(sampledProgram.sampleCatalog), bindingsFrozen: Object.isFrozen(sampledProgram.previewSampleBindings) }));

  const sampledCountSource = [
    'local menu = { name = "SampledCount", layer = 1 }',
    'function menu.display(columnCount, tableWidth, tableScaling)',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local table = frame:addTable(columnCount, { width = tableWidth, reserveScrollBar = false, scaling = tableScaling })',
    '  table:addRow(false, {})',
    'end',
  ].join('\n');
  const sampledCountModel = buildX4UiCallModel(input(sampledCountSource, 'selftest/sampled-count.lua'));
  const sampledCountTarget = createX4UiLayoutTargetCatalog(sampledCountModel).targets.find(candidate => candidate.kind !== 'top-level');
  if (!sampledCountTarget) throw new Error('sampled count target missing');
  const sampledCountUnsampled = programOf(projectX4UiLayoutProgram(sampledCountModel, sampledCountTarget, profileFor(sampledCountModel)));
  const sampledCountInput: X4UiLayoutPreviewSampleInput = {
    catalogId: sampledCountUnsampled.sampleCatalog.id,
    source: sampledCountUnsampled.sampleCatalog.sourceIdentity,
    values: sampledCountUnsampled.sampleCatalog.entries.map(entry => ({
      id: entry.id,
      value: entry.consumers.some(consumer => consumer.field === 'count')
        ? 2
        : entry.expectedType === 'boolean'
          ? false
          : 60,
    })),
  };
  const sampledCountProgram = programOf(projectX4UiLayoutProgram(
    sampledCountModel,
    sampledCountTarget,
    profileFor(sampledCountModel),
    sampledCountInput,
  ));
  check('number and boolean samples can satisfy exact count, width, and supported property consumers',
    sampledCountProgram.tables[0].numColumns === 2
      && sampledCountProgram.tables[0].requestedWidth === 60
      && sampledCountProgram.tables[0].kernelState?.properties.scaling === false
      && factProvenance(operation(sampledCountProgram, 'addTable')?.descriptorFacts.columnCount) === 'preview-sample'
      && factProvenance(sampledCountProgram.tables[0].descriptorFacts.scaling) === 'preview-sample'
      && sampledCountProgram.previewSampleBindings.every(candidate => candidate.status === 'consumed'),
    detail({ catalog: sampledCountProgram.sampleCatalog, table: sampledCountProgram.tables[0] }));

  const staleSamples: X4UiLayoutPreviewSampleInput = {
    ...validSamples,
    source: { ...validSamples.source, sha256: 'B'.repeat(64) },
  };
  const duplicateSamples: X4UiLayoutPreviewSampleInput = {
    ...validSamples,
    values: [...validSamples.values, validSamples.values[0]],
  };
  const extraSamples: X4UiLayoutPreviewSampleInput = {
    ...validSamples,
    values: [...validSamples.values, { id: `preview-sample:${validSamples.source.sha256}|static-or-extra`, value: 1 }],
  };
  const wrongTypeSamples: X4UiLayoutPreviewSampleInput = {
    ...validSamples,
    values: validSamples.values.map(candidate => candidate.id === numberSample.id ? { ...candidate, value: 'wrong' } : candidate),
  };
  const nonFiniteSamples: X4UiLayoutPreviewSampleInput = {
    ...validSamples,
    values: validSamples.values.map(candidate => candidate.id === numberSample.id ? { ...candidate, value: Number.POSITIVE_INFINITY } : candidate),
  };
  check('stale source/catalog and duplicate/extra/static sample IDs refuse before kernel replay',
    projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, staleSamples).status === 'refused'
      && projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, { ...validSamples, catalogId: `${validSamples.catalogId}:stale` }).status === 'refused'
      && projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, duplicateSamples).status === 'refused'
      && projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, extraSamples).status === 'refused',
    detail({ staleSamples, duplicateSamples, extraSamples }));
  check('wrong-type and non-finite sample values refuse without a program/kernel state',
    projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, wrongTypeSamples).program === undefined
      && projectX4UiLayoutProgram(sampledModel, sampledTarget, sampledProfile, nonFiniteSamples).program === undefined,
    detail({ wrongTypeSamples, nonFiniteSamples }));

  const malformedProfile = { ...profile, metrics: { ...profile.metrics, uiScale: Number.NaN } };
  check('malformed profile refuses deterministically',
    projectX4UiLayoutProgram(model, target, malformedProfile).status === 'refused', detail(malformedProfile));
  const inventedConstantLine = {
    ...profile,
    helper: {
      ...profile.helper,
      constants: { ...profile.helper.constants, standardTextHeight: pin(16, 514) },
    },
  };
  const inventedTextHeightValue = {
    ...profile,
    helper: {
      ...profile.helper,
      constants: { ...profile.helper.constants, standardTextHeight: pin(18, 533) },
    },
  };
  check('invented Helper constant/default declaration lines refuse deterministically',
    projectX4UiLayoutProgram(model, target, inventedConstantLine).status === 'refused'
      && projectX4UiLayoutProgram(model, target, inventedTextHeightValue).status === 'refused'
      && projectX4UiLayoutProgram(model, target, {
        ...profile,
        defaults: { ...profile.defaults, standardButtonHeight: pin(25, 514) },
      }).status === 'refused',
    detail(inventedConstantLine.helper.constants));
  const zeroScaleProfile = { ...profile, metrics: { ...profile.metrics, uiScale: 0 } };
  const negativeScaleProfile = { ...profile, metrics: { ...profile.metrics, uiScale: -1 } };
  check('zero and negative uiScale profiles refuse deterministically',
    projectX4UiLayoutProgram(model, target, zeroScaleProfile).status === 'refused'
      && projectX4UiLayoutProgram(model, target, negativeScaleProfile).status === 'refused',
    detail({ zero: zeroScaleProfile.metrics, negative: negativeScaleProfile.metrics }));
  const sourceMismatch = { ...profile, source: { ...profile.source, sha256: 'A'.repeat(64) } };
  check('model source hash mismatch refuses deterministically',
    projectX4UiLayoutProgram(model, target, sourceMismatch).status === 'refused', detail(sourceMismatch.source));
  const noButtonDefault = profileFor(model, { buttonDefault: false });
  check('omitted button height without proof stays partial and unavailable',
    (() => {
      const noDefault = programOf(projectX4UiLayoutProgram(model, target, noButtonDefault));
      const defaultButton = noDefault.cells.find(candidate => candidate.kernelState?.type === 'button');
      return noDefault.status === 'partial'
        && defaultButton?.height?.status === 'unavailable'
        && noDefault.gaps.some(gap => gap.category === 'height' && gap.reason.includes('standardButtonHeight'));
    })(),
    detail(noButtonDefault.defaults));

  const missingTextModel = buildX4UiCallModel(input([
    'local menu = { name = "Text", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 50, height = 40 })',
    'local table = frame:addTable(1, { width = 50 })',
    'table:addRow(false, {})[1]:createText("zero", {})',
  ].join('\n'), 'selftest/missing-text.lua'));
  const missingTextProgram = programOf(projectX4UiLayoutProgram(missingTextModel, topTarget(missingTextModel), profileFor(missingTextModel)));
  const missingTextCell = missingTextProgram.cells.find(candidate => candidate.kernelState?.type === 'text');
  check('known source minimum does not pretend to prove the missing C++ text-height candidate',
    missingTextProgram.tables[0].kernelState !== undefined
      && missingTextProgram.tables[0].height?.status === 'unavailable'
      && factValue(missingTextCell?.descriptorFacts.minRowHeight) === 16
      && missingTextCell?.descriptorFacts.minRowHeight.sourcePin?.lineStart === 3215
      && factValue(missingTextCell?.descriptorFacts.minRowHeightFloor) === 16
      && missingTextCell?.descriptorFacts.minRowHeightFloor.sourcePin?.lineStart === 5482
      && missingTextCell.descriptorFacts.outerHeight.status === 'unavailable'
      && missingTextProgram.gaps.some(gap => gap.reason.includes('C++ text-height candidate')),
    detail({ cell: missingTextCell, gaps: missingTextProgram.gaps }));

  const textMinimumSource = [
    'local menu = { name = "TextMinimum", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false })',
    'local row1 = table:addRow(false, {})',
    'row1[1]:createText("default", { y = 1 })',
    'local row2 = table:addRow(false, {})',
    'row2[1]:createText("explicit", { y = 2, minRowHeight = 30 })',
    'local row3 = table:addRow(false, {})',
    'row3[1]:createText("direct", { y = Helper.scaleY(3, false), minRowHeight = Helper.scaleY(8) })',
    'local row4 = table:addRow(false, {})',
    'row4[1]:createText("sampled", { y = 1, minRowHeight = runtimeMin })',
  ].join('\n');
  const textMinimumModel = buildX4UiCallModel(input(textMinimumSource, 'selftest/text-minimum.lua'));
  const textMinimumProfile = profileFor(textMinimumModel, { minTextHeight: 10, uiScale: 1.5 });
  const textMinimumUnsampled = programOf(projectX4UiLayoutProgram(
    textMinimumModel,
    topTarget(textMinimumModel),
    textMinimumProfile,
  ));
  const minimumCells = textMinimumUnsampled.cells.filter(candidate => candidate.kernelState?.type === 'text');
  check('default, explicit, and direct-scale minRowHeight facts preserve Helper scaling and floor behavior',
    minimumCells.length === 4
      && factValue(minimumCells[0].descriptorFacts.minRowHeight) === 16
      && factValue(minimumCells[0].descriptorFacts.minRowHeightFloor) === 22
      && minimumCells[0].kernelState?.minTextHeight === 22
      && textMinimumUnsampled.rows[0].height?.value === 24
      && factValue(minimumCells[1].descriptorFacts.minRowHeight) === 30
      && factValue(minimumCells[1].descriptorFacts.minRowHeightFloor) === 42
      && minimumCells[1].kernelState?.minTextHeight === 42
      && textMinimumUnsampled.rows[1].height?.value === 45
      && factValue(minimumCells[2].descriptorFacts.minRowHeight) === 12
      && factProvenance(minimumCells[2].descriptorFacts.minRowHeight) === 'direct-helper-scale'
      && factValue(minimumCells[2].descriptorFacts.outerY) === 5
      && factValue(minimumCells[2].descriptorFacts.minRowHeightFloor) === 13
      && minimumCells[2].kernelState?.minTextHeight === 13
      && textMinimumUnsampled.rows[2].height?.value === 18,
    detail({ cells: minimumCells, rows: textMinimumUnsampled.rows }));
  const textMinimumNoCandidate = programOf(projectX4UiLayoutProgram(
    textMinimumModel,
    topTarget(textMinimumModel),
    profileFor(textMinimumModel, { uiScale: 1.5 }),
  ));
  const noCandidateExplicit = textMinimumNoCandidate.cells.filter(candidate => candidate.kernelState?.type === 'text')[1];
  check('an explicit larger source minimum cannot finalize text height without a proven C++ candidate',
    factValue(noCandidateExplicit.descriptorFacts.minRowHeight) === 30
      && factValue(noCandidateExplicit.descriptorFacts.minRowHeightFloor) === 42
      && noCandidateExplicit.kernelState?.minTextHeight === undefined
      && noCandidateExplicit.descriptorFacts.outerHeight.status === 'unavailable'
      && textMinimumNoCandidate.rows[1].height?.status === 'unavailable'
      && textMinimumNoCandidate.gaps.some(gap => gap.nodeId === noCandidateExplicit.id && gap.reason.includes('C++ text-height candidate')),
    detail({ cell: noCandidateExplicit, row: textMinimumNoCandidate.rows[1], gaps: textMinimumNoCandidate.gaps }));
  const minRowHeightSample = textMinimumUnsampled.sampleCatalog.entries.find(entry =>
    entry.expression === 'runtimeMin' && entry.consumers.some(consumer => consumer.field === 'minrowheight'));
  check('unsampled dynamic minRowHeight leaves final height unavailable while preserving specialization and width',
    minimumCells[3].kernelState?.type === 'text'
      && minimumCells[3].kernelState?.minTextHeight === undefined
      && minimumCells[3].descriptorFacts.minRowHeight.status === 'unavailable'
      && minimumCells[3].descriptorFacts.minRowHeightFloor.status === 'unavailable'
      && minimumCells[3].descriptorFacts.outerHeight.status === 'unavailable'
      && textMinimumUnsampled.rows[3].height?.status === 'unavailable'
      && operation(textMinimumUnsampled, 'createText', 3)?.status === 'unresolved'
      && factValue(textMinimumUnsampled.tables[0].descriptorFacts.finalWidth) === textMinimumUnsampled.tables[0].kernelState?.properties.width
      && Boolean(minRowHeightSample),
    detail({ cell: minimumCells[3], catalog: textMinimumUnsampled.sampleCatalog, gaps: textMinimumUnsampled.gaps }));
  if (!minRowHeightSample) throw new Error('minRowHeight sample missing');
  const sampledMinimumInput: X4UiLayoutPreviewSampleInput = {
    catalogId: textMinimumUnsampled.sampleCatalog.id,
    source: textMinimumUnsampled.sampleCatalog.sourceIdentity,
    values: [{ id: minRowHeightSample.id, value: 20 }],
  };
  const textMinimumSampled = programOf(projectX4UiLayoutProgram(
    textMinimumModel,
    topTarget(textMinimumModel),
    textMinimumProfile,
    sampledMinimumInput,
  ));
  const sampledMinimumCell = textMinimumSampled.cells.filter(candidate => candidate.kernelState?.type === 'text')[3];
  check('exact minRowHeight sample supplies preview-only floor provenance and deterministic kernel height',
    factValue(sampledMinimumCell.descriptorFacts.minRowHeight) === 20
      && factProvenance(sampledMinimumCell.descriptorFacts.minRowHeight) === 'preview-sample'
      && factValue(sampledMinimumCell.descriptorFacts.minRowHeightFloor) === 28
      && factProvenance(sampledMinimumCell.descriptorFacts.minRowHeightFloor) === 'preview-sample'
      && sampledMinimumCell.kernelState?.minTextHeight === 28
      && textMinimumSampled.rows[3].height?.value === 30
      && operation(textMinimumSampled, 'createText', 3)?.status === 'applied'
      && textMinimumSampled.previewSampleBindings[0]?.status === 'consumed',
    detail({ cell: sampledMinimumCell, row: textMinimumSampled.rows[3], bindings: textMinimumSampled.previewSampleBindings }));

  const nestedTextSource = [
    'local menu = { name = "NestedText", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 120, height = 80 })',
    'local table = frame:addTable(6, { width = 120, reserveScrollBar = false })',
    'local row = table:addRow(false, {})',
    'row[1]:createButton({ height = 10, scaling = false }):setText("button", { x = 5, y = 2, fontsize = 9 })',
    'row[2]:createIcon("solid", { height = 10, scaling = false }):setText("icon", { x = 5, y = 2, fontsize = 9 }):setText2("icon2", {})',
    'row[3]:createEditBox({ height = 10, scaling = false }):setText("edit", { x = 5, y = 2, fontsize = 9 })',
    'row[4]:createButton({ height = 10, scaling = false }):setText("override", { x = 5, y = 2, fontsize = 9, scaling = true })',
    'row[5]:createButton({ height = 10 }):setText("invalid", { wordwrap = true, cellBGColor = "bad", height = 99 })',
    'row[6]:createText("original", { height = 5 }):setText("unsupported", {})',
  ].join('\n');
  const nestedTextModel = buildX4UiCallModel(input(nestedTextSource, 'selftest/nested-text-scaling.lua'));
  const nestedTextResult = projectX4UiLayoutProgram(
    nestedTextModel,
    topTarget(nestedTextModel),
    profileFor(nestedTextModel, { uiScale: 2 }),
  );
  const nestedTextProgram = programOf(nestedTextResult);
  const nestedTextAuthority = evidenceAuthorityOf(nestedTextResult);
  const nestedSetText = nestedTextProgram.operations.filter(candidate => candidate.kind === 'setText');
  const nestedSetText2 = operation(nestedTextProgram, 'setText2');
  check('omitted nested text scaling inherits false from button, icon, and editbox cells',
    nestedSetText.slice(0, 3).every(candidate =>
      candidate.status === 'applied'
        && factValue(candidate.descriptorFacts.textScaling) === false
        && factValue(candidate.descriptorFacts.textX) === 5
        && factValue(candidate.descriptorFacts.textY) === 2
        && factValue(candidate.descriptorFacts.textFontsize) === 9
        && candidate.descriptorFacts.textWordwrap.status === 'unavailable')
      && nestedSetText2?.status === 'applied'
      && factValue(nestedSetText2.descriptorFacts.text2Scaling) === false
      && factValue(nestedSetText2.descriptorFacts.text2X) === 5
      && factValue(nestedSetText2.descriptorFacts.text2Y) === 0
      && factValue(nestedSetText2.descriptorFacts.text2Fontsize) === 9,
    detail({ setText: nestedSetText, setText2: nestedSetText2 }));
  check('explicit nested scaling true overrides a scaling-false button and scales x, y, and font size',
    nestedSetText[3]?.status === 'applied'
      && factValue(nestedSetText[3].descriptorFacts.textScaling) === true
      && factValue(nestedSetText[3].descriptorFacts.textX) === 10
      && factValue(nestedSetText[3].descriptorFacts.textY) === 4
      && factValue(nestedSetText[3].descriptorFacts.textFontsize) === 18,
    detail(nestedSetText[3]));

  const mutateProgramNodeScalar = (
    programValue: X4UiLayoutProgram,
    collection: 'frames' | 'tables' | 'rows' | 'cells',
    index: number,
    field: string,
  ): X4UiLayoutProgram => mutateProgramJson(programValue, candidate => {
    const nodes = candidate[collection] as unknown as Record<string, unknown>[];
    const node = nodes[index];
    if (!node) return;
    const current = node[field];
    node[field] = typeof current === 'number' ? current + 1 : 'audit-forged';
  });
  const mutateProgramNodeFact = (
    programValue: X4UiLayoutProgram,
    collection: 'frames' | 'tables' | 'rows' | 'cells',
    index: number,
    field: string,
  ): X4UiLayoutProgram => mutateProgramJson(programValue, candidate => {
    const nodes = candidate[collection] as unknown as Record<string, unknown>[];
    const facts = nodes[index]?.descriptorFacts as Record<string, unknown> | undefined;
    if (facts) facts[field] = mutateFactForAudit(facts[field]);
  });
  const mutateProgramOperationFact = (
    programValue: X4UiLayoutProgram,
    kind: string,
    field: string,
  ): X4UiLayoutProgram => mutateProgramJson(programValue, candidate => {
    const operations = candidate.operations as unknown as Record<string, unknown>[];
    const operationValue = operations.find(candidateOperation => candidateOperation.kind === kind);
    const facts = operationValue?.descriptorFacts as Record<string, unknown> | undefined;
    if (facts) facts[field] = mutateFactForAudit(facts[field]);
  });
  const mutateProgramOperationAndOwnerFact = (
    programValue: X4UiLayoutProgram,
    kind: string,
    ownerCollection: 'frames' | 'tables' | 'cells',
    field: string,
  ): X4UiLayoutProgram => mutateProgramJson(programValue, candidate => {
    const operationValue = (candidate.operations as unknown as Record<string, unknown>[])
      .find(candidateOperation => candidateOperation.kind === kind);
    if (!operationValue) return;
    const operationFacts = operationValue.descriptorFacts as Record<string, unknown> | undefined;
    if (operationFacts) operationFacts[field] = mutateFactForAudit(operationFacts[field]);
    const ownerId = operationValue[`${ownerCollection.slice(0, -1)}Id`];
    const owner = (candidate[ownerCollection] as unknown as Record<string, unknown>[])
      .find(candidateOwner => candidateOwner.id === ownerId);
    const ownerFacts = owner?.descriptorFacts as Record<string, unknown> | undefined;
    if (ownerFacts) ownerFacts[field] = mutateFactForAudit(ownerFacts[field]);
  });
  const mutateProgramOperationMetadata = (
    programValue: X4UiLayoutProgram,
    kind: string,
  ): X4UiLayoutProgram => mutateProgramJson(programValue, candidate => {
    const operationValue = (candidate.operations as unknown as Record<string, unknown>[])
      .find(candidateOperation => candidateOperation.kind === kind);
    if (operationValue) {
      operationValue.metadata = {
        ...(operationValue.metadata as Record<string, unknown>),
        auditForgedMetadata: true,
      };
    }
  });
  const mutateProgramOperationKernel = (
    programValue: X4UiLayoutProgram,
    kind: string,
  ): X4UiLayoutProgram => mutateProgramJson(programValue, candidate => {
    const operationValue = (candidate.operations as unknown as Record<string, unknown>[])
      .find(candidateOperation => candidateOperation.kind === kind);
    if (!operationValue) return;
    const kernel = operationValue.kernel as Record<string, unknown> | undefined;
    if (kernel) kernel.stateAfter = { auditForgedKernelState: true };
    else operationValue.kernel = { auditForgedKernel: true };
  });
  const mutateProgramCellAffect = (
    programValue: X4UiLayoutProgram,
    cellType: string,
  ): X4UiLayoutProgram => mutateProgramJson(programValue, candidate => {
    const cells = candidate.cells as unknown as Record<string, unknown>[];
    const cell = cells.find(candidateCell => {
      const kernelState = candidateCell.kernelState as Record<string, unknown> | undefined;
      return kernelState?.type === cellType;
    });
    const facts = cell?.descriptorFacts as Record<string, unknown> | undefined;
    if (facts) {
      facts.affectRowHeight = {
        ...(facts.affectRowHeight as Record<string, unknown> | undefined),
        status: 'known',
        value: true,
        provenance: 'audit-forged',
      };
    }
  });

  const boundProgramAttackPairs = [
    {
      name: 'frame geometry',
      programValue: mutateProgramNodeScalar(allKindProgram, 'frames', 0, 'width'),
      authority: allKindAuthority,
    },
    {
      name: 'frame layer fact',
      programValue: mutateProgramNodeFact(allKindProgram, 'frames', 0, 'layer'),
      authority: allKindAuthority,
    },
    {
      name: 'table geometry',
      programValue: mutateProgramNodeScalar(allKindProgram, 'tables', 0, 'requestedWidth'),
      authority: allKindAuthority,
    },
    {
      name: 'table layer fact',
      programValue: mutateProgramNodeFact(allKindProgram, 'tables', 0, 'x'),
      authority: allKindAuthority,
    },
    {
      name: 'creator descriptor fact',
      programValue: mutateProgramOperationFact(allKindProgram, 'createButton', 'outerHeight'),
      authority: allKindAuthority,
    },
    ...(['text2Font', 'text2Fontsize', 'text2Halign', 'text2X', 'text2Y'] as const).map(field => ({
      name: `secondary text ${field}`,
      programValue: mutateProgramOperationFact(allKindProgram, 'setText2', field),
      authority: allKindAuthority,
    })),
    {
      name: 'fact source provenance expression sourcePin sample identity',
      programValue: mutateProgramOperationFact(allKindProgram, 'setText2', 'text2X'),
      authority: allKindAuthority,
    },
    {
      name: 'operation metadata',
      programValue: mutateProgramOperationMetadata(allKindProgram, 'createButton'),
      authority: allKindAuthority,
    },
    {
      name: 'operation kernel payload',
      programValue: mutateProgramOperationKernel(allKindProgram, 'setColWidth'),
      authority: allKindAuthority,
    },
    {
      name: 'unavailable-to-known text affectRowHeight',
      programValue: mutateProgramCellAffect(nestedTextProgram, 'text'),
      authority: nestedTextAuthority,
    },
    {
      name: 'unavailable-to-known editbox affectRowHeight',
      programValue: mutateProgramCellAffect(nestedTextProgram, 'editbox'),
      authority: nestedTextAuthority,
    },
  ];
  const hasFullAuthoritySnapshots = Boolean(
    allKindAuthority
      && allKindAuthority.operations.every(operationValue =>
        Object.prototype.hasOwnProperty.call(operationValue, 'snapshot'))
      && allKindAuthority.nodes.frames.every(node =>
        Object.prototype.hasOwnProperty.call(node, 'snapshot'))
      && allKindAuthority.nodes.tables.every(node =>
        Object.prototype.hasOwnProperty.call(node, 'snapshot'))
      && allKindAuthority.nodes.rows.every(node =>
        Object.prototype.hasOwnProperty.call(node, 'snapshot'))
      && allKindAuthority.nodes.cells.every(node =>
        Object.prototype.hasOwnProperty.call(node, 'snapshot')),
  );
  const authoritySnapshotOperationMutation = (
    authorityValue: EvidenceAuthorityLike,
    kind: string,
    mutate: (snapshot: Record<string, unknown>) => void,
  ): EvidenceAuthorityLike => mutateAuthorityJson(authorityValue, candidate => {
    const operationValue = (candidate.operations as unknown as Record<string, unknown>[])
      .find(candidateOperation => candidateOperation.kind === kind);
    const snapshot = operationValue?.snapshot as Record<string, unknown> | undefined;
    if (snapshot) mutate(snapshot);
  });
  const authoritySnapshotNodeMutation = (
    authorityValue: EvidenceAuthorityLike,
    collection: 'frames' | 'tables' | 'rows' | 'cells',
    mutate: (snapshot: Record<string, unknown>) => void,
  ): EvidenceAuthorityLike => mutateAuthorityJson(authorityValue, candidate => {
    const nodeValue = (candidate.nodes as Record<string, unknown>)[collection] as Record<string, unknown>[];
    const snapshot = nodeValue[0]?.snapshot as Record<string, unknown> | undefined;
    if (snapshot) mutate(snapshot);
  });
  const authoritySnapshotAttacks = allKindAuthority
    ? [
      authoritySnapshotNodeMutation(allKindAuthority, 'frames', snapshot => {
        snapshot.width = Number(snapshot.width || 0) + 1;
      }),
      authoritySnapshotNodeMutation(allKindAuthority, 'tables', snapshot => {
        snapshot.requestedWidth = Number(snapshot.requestedWidth || 0) + 1;
      }),
      authoritySnapshotOperationMutation(allKindAuthority, 'createButton', snapshot => {
        const facts = snapshot.descriptorFacts as Record<string, unknown>;
        facts.outerHeight = mutateFactForAudit(facts.outerHeight);
      }),
      ...(['text2Font', 'text2Fontsize', 'text2Halign', 'text2X', 'text2Y'] as const).map(field =>
        authoritySnapshotOperationMutation(allKindAuthority, 'setText2', snapshot => {
          const facts = snapshot.descriptorFacts as Record<string, unknown>;
          facts[field] = mutateFactForAudit(facts[field]);
        })),
      authoritySnapshotOperationMutation(allKindAuthority, 'createButton', snapshot => {
        snapshot.metadata = {
          ...(snapshot.metadata as Record<string, unknown>),
          auditForgedMetadata: true,
        };
      }),
      authoritySnapshotOperationMutation(allKindAuthority, 'setColWidth', snapshot => {
        const kernel = snapshot.kernel as Record<string, unknown> | undefined;
        if (kernel) kernel.stateAfter = { auditForgedKernelState: true };
      }),
      authoritySnapshotNodeMutation(allKindAuthority, 'rows', snapshot => {
        snapshot.height = { status: 'known', value: 999 };
      }),
      authoritySnapshotNodeMutation(allKindAuthority, 'cells', snapshot => {
        const kernelState = snapshot.kernelState as Record<string, unknown> | undefined;
        if (kernelState) kernelState.height = 999;
        else snapshot.height = { status: 'known', value: 999 };
      }),
    ]
    : [];
  const authoritySnapshotAffectAttacks = nestedTextAuthority
    ? (['text', 'editbox'] as const).map(cellType => mutateAuthorityJson(nestedTextAuthority, candidate => {
      const cells = (candidate.nodes as Record<string, unknown>).cells as Record<string, unknown>[];
      const cell = cells.find(candidateCell => {
        const snapshot = candidateCell.snapshot as Record<string, unknown> | undefined;
        const kernelState = snapshot?.kernelState as Record<string, unknown> | undefined;
        return kernelState?.type === cellType;
      });
      const snapshot = cell?.snapshot as Record<string, unknown> | undefined;
      const facts = snapshot?.descriptorFacts as Record<string, unknown> | undefined;
      if (facts) {
        facts.affectRowHeight = {
          ...(facts.affectRowHeight as Record<string, unknown> | undefined),
          status: 'known',
          value: true,
          provenance: 'audit-forged',
        };
      }
    }))
    : [];
  const exactSnapshotInventory = Boolean(
    hasFullAuthoritySnapshots
      && allKindAuthority
      && allKindAuthority.operations.every((operationValue, index) =>
        sameJson((operationValue as unknown as Record<string, unknown>).snapshot, allKindProgram.operations[index]))
      && allKindAuthority.nodes.frames.every((node, index) =>
        sameJson((node as unknown as Record<string, unknown>).snapshot, allKindProgram.frames[index]))
      && allKindAuthority.nodes.tables.every((node, index) =>
        sameJson((node as unknown as Record<string, unknown>).snapshot, allKindProgram.tables[index]))
      && allKindAuthority.nodes.rows.every((node, index) =>
        sameJson((node as unknown as Record<string, unknown>).snapshot, allKindProgram.rows[index]))
      && allKindAuthority.nodes.cells.every((node, index) =>
        sameJson((node as unknown as Record<string, unknown>).snapshot, allKindProgram.cells[index])),
  );
  const authoritySnapshotSchemaAttacks = allKindAuthority
    ? [
      mutateAuthorityJson(allKindAuthority, candidate => {
        const operation = (candidate.operations as unknown as Record<string, unknown>[])[0];
        if (operation) delete operation.snapshot;
      }),
      mutateAuthorityJson(allKindAuthority, candidate => {
        const operation = (candidate.operations as unknown as Record<string, unknown>[])[0];
        const snapshot = operation?.snapshot as Record<string, unknown> | undefined;
        if (snapshot) snapshot.auditUnknownField = true;
      }),
      mutateAuthorityJson(allKindAuthority, candidate => {
        const frames = (candidate.nodes as Record<string, unknown>).frames as Record<string, unknown>[];
        if (frames[0]) delete frames[0].snapshot;
      }),
    ]
    : [];
  check('full authority snapshots have an exact machine-readable operation/node field inventory',
    exactSnapshotInventory,
    detail({ hasFullAuthoritySnapshots, authority: allKindAuthority }));
  check('authority snapshot schema rejects missing and unknown nested snapshot fields',
    hasFullAuthoritySnapshots
      && authoritySnapshotSchemaAttacks.length === 3
      && authoritySnapshotSchemaAttacks.every(candidate =>
        !validateX4UiLayoutEvidencePair(allKindProgram, candidate).valid),
    detail({ hasFullAuthoritySnapshots, attacks: authoritySnapshotSchemaAttacks }));
  check('separate authority rejects every newly bound program operation/node mutation',
    boundProgramAttackPairs.every(candidate => candidate.authority !== undefined
      && !validateX4UiLayoutEvidencePair(candidate.programValue, candidate.authority).valid),
    detail({ attacks: boundProgramAttackPairs.map(candidate => ({ name: candidate.name, authority: candidate.authority })) }));
  const coherentProgramAttackPairs = [
    mutateProgramOperationAndOwnerFact(allKindProgram, 'createFrameHandle', 'frames', 'layer'),
    mutateProgramOperationAndOwnerFact(allKindProgram, 'addTable', 'tables', 'requestedWidth'),
    mutateProgramOperationAndOwnerFact(allKindProgram, 'createButton', 'cells', 'outerHeight'),
    mutateProgramOperationAndOwnerFact(allKindProgram, 'setText2', 'cells', 'text2X'),
  ];
  check('coherent program operation and owner fact mutations remain independently rejected',
    coherentProgramAttackPairs.every(candidate =>
      !validateX4UiLayoutEvidencePair(candidate, allKindAuthority!).valid),
    detail({ attacks: coherentProgramAttackPairs }));
  check('separate authority rejects every newly bound authority operation/node mutation',
    hasFullAuthoritySnapshots
      && authoritySnapshotAttacks.length === 12
      && authoritySnapshotAttacks.every(candidate =>
        !validateX4UiLayoutEvidencePair(allKindProgram, candidate).valid)
      && authoritySnapshotAffectAttacks.length === 2
      && authoritySnapshotAffectAttacks.every(candidate =>
        !validateX4UiLayoutEvidencePair(nestedTextProgram, candidate).valid),
    detail({ hasFullAuthoritySnapshots, attacks: authoritySnapshotAttacks, affectAttacks: authoritySnapshotAffectAttacks }));

  const overflowSource = [
    'local menu = { name = "OmittedWidthOverflow", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false, scaling = false })',
    'local textRow = table:addRow(false, {})',
    'textRow[1]:createText("text", { x = Helper.scaleX(50, false), height = 10 })',
    'local editRow = table:addRow(false, {})',
    'editRow[1]:createEditBox({ x = Helper.scaleX(50, false), height = 10 })',
    'local buttonRow = table:addRow(false, {})',
    'buttonRow[1]:createButton({ x = Helper.scaleX(50, false), height = 10 })',
    'local iconRow = table:addRow(false, {})',
    'iconRow[1]:createIcon("solid", { x = Helper.scaleX(50, false), height = 10 })',
    'local explicitRow = table:addRow(false, {})',
    'explicitRow[1]:createText("explicit", { x = Helper.scaleX(2, false), width = Helper.scaleX(30, false), height = 10 })',
  ].join('\n');
  const overflowModel = buildX4UiCallModel(input(overflowSource, 'selftest/omitted-width-overflow.lua'));
  const overflowResult = projectX4UiLayoutProgram(
    overflowModel,
    topTarget(overflowModel),
    profileFor(overflowModel),
  );
  const overflowProgram = programOf(overflowResult);
  const overflowAuthority = evidenceAuthorityOf(overflowResult);
  const overflowKinds = ['createText', 'createEditBox', 'createButton', 'createIcon'] as const;
  const overflowRows = overflowProgram.rows;
  const overflowCells = overflowProgram.cells;
  const overflowPasses = overflowKinds.every(kind => {
    const creator = overflowProgram.operations.find(operationValue => operationValue.kind === kind);
    const cell = creator?.cellId ? overflowCells.find(candidate => candidate.id === creator.cellId) : undefined;
    const width = cell?.descriptorFacts.outerWidth;
    return creator?.status === 'applied'
      && cell?.spanWidth?.status === 'known'
      && cell.spanWidth.value === 40
      && width?.status === 'known'
      && width.value === -10
      && width.sourcePin?.sourcePath === X4_LAYOUT_PROVENANCE.helperSourcePath
      && width.sourcePin.lineStart === 5372
      && width.sourcePin.lineEnd === 5388;
  });
  check('omitted-width overflow preserves exact negative Helper subtraction for all creator kinds',
    overflowPasses
      && overflowRows.length === 5
      && overflowAuthority !== undefined
      && validateX4UiLayoutEvidencePair(overflowProgram, overflowAuthority).valid,
    detail({
      rows: overflowRows,
      cells: overflowCells,
      operations: overflowProgram.operations,
      authority: overflowAuthority,
    }));
  const explicitWidthCell = overflowProgram.cells.find(candidate => candidate.rowIndex === 5);
  check('normal omitted and explicit scaled widths remain exact after the overflow correction',
    factValue(explicitWidthCell?.descriptorFacts.outerWidth) === 30
      && factProvenance(explicitWidthCell?.descriptorFacts.outerWidth) === 'direct-helper-scale'
      && factValue(descriptorScaledText.descriptorFacts.outerWidth) === 14
      && factValue(descriptorText.descriptorFacts.outerWidth) === 20
      && factValue(descriptorEditBox.descriptorFacts.outerWidth) === 31,
    detail({ explicitWidthCell, descriptorScaledText, descriptorText, descriptorEditBox }));
  const invalidNestedText = nestedSetText[4];
  const invalidNestedCell = nestedTextProgram.cells.find(candidate => candidate.id === invalidNestedText?.cellId);
  check('invalid nested text-cell properties remain raw source gaps and never overwrite renderer facts',
    invalidNestedText?.status === 'unresolved'
      && invalidNestedText.metadata.semantics.unsupportedProperties?.map(candidate => candidate.name).join(',') === 'wordwrap,cellBGColor,height'
      && invalidNestedText.descriptorFacts.textWordwrap.status === 'unavailable'
      && invalidNestedText.descriptorFacts.height === undefined
      && invalidNestedText.descriptorFacts.cellBGColor === undefined
      && invalidNestedCell?.kernelState?.height === 10
      && invalidNestedCell.descriptorFacts.outerHeight.status === 'known'
      && invalidNestedCell.descriptorFacts.outerHeight.value === 20
      && nestedTextProgram.gaps.filter(gap => gap.operationId === invalidNestedText.id && gap.category === 'text').length === 3,
    detail({ operation: invalidNestedText, cell: invalidNestedCell, gaps: nestedTextProgram.gaps }));
  const unsupportedNestedText = nestedSetText[5];
  const unsupportedNestedCell = nestedTextProgram.cells.find(candidate => candidate.id === unsupportedNestedText?.cellId);
  check('unsupported setText receiver is non-applied and cannot overwrite the specialized text cell',
    unsupportedNestedText?.status === 'unresolved'
      && unsupportedNestedText.reason === 'setText is not implemented by shipped text cells'
      && Object.keys(unsupportedNestedText.descriptorFacts).length === 0
      && factValue(unsupportedNestedCell?.descriptorFacts.primaryContent) === 'original'
      && unsupportedNestedCell?.metadataOperationIds.includes(unsupportedNestedText.id) === false
      && nestedTextProgram.gaps.some(gap => gap.operationId === unsupportedNestedText.id && gap.category === 'data-flow'),
    detail({ operation: unsupportedNestedText, cell: unsupportedNestedCell, gaps: nestedTextProgram.gaps }));

  const negativeSource = [
    'local menu = { name = "Negative", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local dynamicTable = frame:addTable(getCount(), { width = getWidth() })',
    'local optionsTable = frame:addTable(1, getOptions())',
    'local good = frame:addTable(2, { width = 60 })',
    'local row = good:addRow(false, {})',
    'row[1]:createText("x", { height = getHeight() })',
    'row[2]:setColSpan(getSpan())',
    'local other = {}',
    'other:createButton({ height = getHeight() })',
    'other:scaleX(getScale(), getEnabled())',
    'Helper.scaleX(getScale(), false)',
    'local unknownFrame = Helper.createFrameHandle(menu, { width = Helper.unknownWidth, height = 20 })',
    'unknownFrame:addTable(1, { width = 20 })',
    'good:addRow(false, {})',
  ].join('\n');
  const negativeModel = buildX4UiCallModel(input(negativeSource, 'selftest/negative-layout.lua'));
  const negativeResult = projectX4UiLayoutProgram(negativeModel, topTarget(negativeModel), profileFor(negativeModel));
  const negativeProgram = programOf(negativeResult);
  check('dynamic count and width refuse only their table node',
    negativeProgram.tables.some(candidate => candidate.kernelState === undefined && candidate.status === 'refused')
      && negativeProgram.tables.some(candidate => candidate.kernelState !== undefined && candidate.identity?.path === 'good'),
    detail(negativeProgram.tables));
  check('dynamic options, height, and span remain precise source gaps',
    negativeProgram.gaps.some(gap => gap.category === 'options' && gap.status === 'dynamic')
      && negativeProgram.gaps.some(gap => gap.category === 'height' && gap.status === 'dynamic')
      && negativeProgram.gaps.some(gap => gap.category === 'span' && gap.status === 'dynamic')
      && Object.values(negativeProgram.tables.find(candidate => candidate.identity?.path === 'optionsTable')?.descriptorFacts || {})
        .every(fact => fact.status === 'unavailable'),
    detail(negativeProgram.gaps));
  check('unrelated receiver and dynamic direct scale arguments do not mutate state',
    negativeProgram.operations.some(candidate => candidate.kind === 'createButton' && candidate.status === 'unresolved')
      && negativeProgram.operations.filter(candidate => candidate.kind === 'scaleX').every(candidate => candidate.status === 'unresolved')
      && negativeProgram.tables.find(candidate => candidate.identity?.path === 'good')?.kernelState?.rows.length === 2,
    detail(negativeProgram.operations));
  check('unknown Helper constant is an explicit constant gap',
    negativeProgram.gaps.some(gap => gap.category === 'constant' && gap.reason.includes('unknown Helper constant')),
    detail(negativeProgram.gaps.filter(gap => gap.category === 'constant')));
  const ownerlessSource = [
    'local menu = { name = "Ownerless", layer = 1 }',
    'local unknownFrame = Helper.createFrameHandle(menu, { width = Helper.unknownWidth, height = 20 })',
    'unknownFrame:addTable(1, { width = 20 })',
  ].join('\n');
  const ownerlessModel = buildX4UiCallModel(input(ownerlessSource, 'selftest/ownerless-add-table.lua'));
  const ownerlessResult = projectX4UiLayoutProgram(
    ownerlessModel,
    topTarget(ownerlessModel),
    profileFor(ownerlessModel),
  );
  const ownerlessProgram = programOf(ownerlessResult);
  const ownerlessAuthority = evidenceAuthorityOf(ownerlessResult);
  const unresolvedOwnerFrame = ownerlessProgram.frames.find(candidate => candidate.identity?.path === 'unknownFrame');
  const unresolvedOwnerFrameOperation = unresolvedOwnerFrame
    ? ownerlessProgram.operations.find(candidate => candidate.kind === 'createFrameHandle' && candidate.frameId === unresolvedOwnerFrame.id)
    : undefined;
  const unresolvedOwnerTable = ownerlessProgram.tables.find(candidate => {
    const addTableOperation = ownerlessProgram.operations.find(operationValue =>
      operationValue.kind === 'addTable'
        && operationValue.tableId === candidate.id
        && operationValue.metadata.receiver?.reference?.path === 'unknownFrame');
    return addTableOperation !== undefined
      && candidate.frameId === undefined
      && candidate.frameWidth === undefined
      && candidate.kernelState === undefined;
  });
  const unresolvedOwnerAddTable = unresolvedOwnerTable
    ? ownerlessProgram.operations.find(candidate => candidate.kind === 'addTable' && candidate.tableId === unresolvedOwnerTable.id)
    : undefined;
  check('ownerless unresolved addTable remains pair-valid without derived frame state',
    ownerlessAuthority !== undefined
      && unresolvedOwnerFrame !== undefined
      && unresolvedOwnerFrame.width === undefined
      && unresolvedOwnerFrameOperation?.status === 'unresolved'
      && unresolvedOwnerTable !== undefined
      && !ownerlessProgram.frames.some(candidate => candidate.tableIds.includes(unresolvedOwnerTable.id))
      && unresolvedOwnerAddTable?.status === 'unresolved'
      && unresolvedOwnerAddTable.kernel === undefined
      && unresolvedOwnerAddTable.reason === 'addTable owner/frame width is not an applied source identity'
      && safeSchemaPairValidation(ownerlessProgram, ownerlessAuthority).valid === true,
    detail({
      frame: unresolvedOwnerFrame,
      frameOperation: unresolvedOwnerFrameOperation,
      table: unresolvedOwnerTable,
      operation: unresolvedOwnerAddTable,
      validation: ownerlessAuthority && safeSchemaPairValidation(ownerlessProgram, ownerlessAuthority),
    }));

  const controlFlowSource = [
    'local menu = { name = "Control", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 80 })',
    'table:addRow(false, {})',
    'table:addRow(false, getRowOptions())',
    'if choice then table:addRow(false, {}) end',
    'while keepGoing() do table:addRow(false, {}) end',
    'if false then table:addRow(false, {}) end',
    'if false then table:setColWidth(1, 50) end',
  ].join('\n');
  const controlModel = buildX4UiCallModel(input(controlFlowSource, 'selftest/control-flow.lua'));
  const controlProgram = programOf(projectX4UiLayoutProgram(controlModel, topTarget(controlModel), profileFor(controlModel)));
  const controlAdds = controlProgram.operations.filter(candidate => candidate.kind === 'addRow');
  check('conditional, looped, and unreachable operations never mutate authoritative state',
    controlAdds.some(candidate => candidate.status === 'conditional')
      && controlAdds.some(candidate => candidate.status === 'unresolved')
      && controlAdds.some(candidate => candidate.status === 'unreachable')
      && controlProgram.operations.some(candidate => candidate.kind === 'setColWidth' && candidate.status === 'unreachable')
      && controlProgram.tables[0].kernelState?.rows.length === 1
      && controlAdds.filter(candidate => candidate.status !== 'applied')
        .every(candidate => candidate.descriptorFacts.finalWidth === undefined)
      && factValue(controlProgram.tables[0].descriptorFacts.finalWidth)
        === factValue(controlAdds.find(candidate => candidate.status === 'applied')?.descriptorFacts.finalWidth),
    detail({ operations: controlProgram.operations, state: controlProgram.tables[0].kernelState, facts: controlProgram.tables[0].descriptorFacts }));

  const guardedSampleSource = [
    'local menu = { name = "GuardedSamples", layer = 1 }',
    'function menu.display(dynamicText, h)',
    '  local frame = Helper.createFrameHandle(menu, { width = 90, height = 60 })',
    '  local table = frame:addTable(3, { width = 90, reserveScrollBar = false })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText("color", { height = 5, color = Color["text_normal"] })',
    '  if choice then row[2]:createText(dynamicText, { height = h }) end',
    '  for i = 1, 2 do row[3]:createText(dynamicText, { height = h }) end',
    '  local other = {}',
    '  other:createButton({ height = h })',
    '  local function localWidth() return 40 end',
    '  frame:addTable(1, { width = localWidth() })',
    '  frame:addTable(1, { width = C.GetWidth() })',
    'end',
  ].join('\n');
  const guardedSampleModel = buildX4UiCallModel(input(guardedSampleSource, 'selftest/guarded-samples.lua'));
  const guardedTarget = createX4UiLayoutTargetCatalog(guardedSampleModel).targets.find(candidate => candidate.kind !== 'top-level' && candidate.name !== 'localWidth');
  if (!guardedTarget) throw new Error('guarded sample target missing');
  const guardedUnsampled = programOf(projectX4UiLayoutProgram(guardedSampleModel, guardedTarget, profileFor(guardedSampleModel, { minTextHeight: 7 })));
  const guardedInput: X4UiLayoutPreviewSampleInput = {
    catalogId: guardedUnsampled.sampleCatalog.id,
    source: guardedUnsampled.sampleCatalog.sourceIdentity,
    values: guardedUnsampled.sampleCatalog.entries.map(entry => ({
      id: entry.id,
      value: entry.expectedType === 'number' ? 9 : entry.expectedType === 'boolean' ? true : 'guarded',
    })),
  };
  const guardedProgram = programOf(projectX4UiLayoutProgram(
    guardedSampleModel,
    guardedTarget,
    profileFor(guardedSampleModel, { minTextHeight: 7 }),
    guardedInput,
  ));
  check('conditional, loop, and unrelated-receiver samples remain non-applied',
    guardedProgram.operations.filter(candidate => candidate.kind === 'createText').some(candidate => candidate.status === 'conditional')
      && guardedProgram.operations.some(candidate => candidate.kind === 'createButton' && candidate.status === 'unresolved')
      && guardedProgram.tables.find(candidate => candidate.kernelState)?.kernelState?.rows[0].cells[1].type === 'cell'
      && guardedProgram.tables.find(candidate => candidate.kernelState)?.kernelState?.rows[0].cells[2].type === 'cell'
      && guardedProgram.previewSampleBindings.length > 0
      && guardedProgram.previewSampleBindings.every(candidate => candidate.status === 'not-applied')
      && guardedProgram.gaps.some(gap => gap.category === 'sample'),
    detail({ operations: guardedProgram.operations, bindings: guardedProgram.previewSampleBindings, gaps: guardedProgram.gaps }));
  check('local calls, C++ values, direct scales, and color objects are never sample catalog entries',
    !guardedProgram.sampleCatalog.entries.some(candidate => /localWidth\(|C\.|Color\[/.test(candidate.expression))
      && !scaledProgram.sampleCatalog.entries.some(candidate => candidate.expression.includes('Helper.scale'))
      && guardedProgram.gaps.some(gap => gap.expression?.includes('Color["text_normal"]'))
      && guardedProgram.operations.some(candidate => candidate.kind === 'createText'
        && candidate.descriptorFacts.color?.status === 'unavailable'
        && candidate.descriptorFacts.color.expectedType === 'color-object'),
    detail({ catalog: guardedProgram.sampleCatalog, gaps: guardedProgram.gaps }));

  const localExpansionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function nested(cell, label, height)',
    '  cell:createText(label, { height = height })',
    'end',
    'local function panel(frame, count, width, label)',
    '  local table = frame:addTable(count, { width = width })',
    '  table:setColWidthPercent(1, 100)',
    '  local row = table:addRow(false, {})',
    '  nested(row[1], label, 12)',
    'end',
    'local panelAlias = panel',
    'local function display()',
    '  local menu = { name = "Expansion", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, 1, 60, "one")',
    '  panelAlias(frame, 1, 70, "two")',
    '  frame:display()',
    'end',
  ].join('\n');
  const localExpansionModel = buildX4UiCallModel(input(localExpansionSource, 'selftest/local-expansion.lua'));
  const localExpansionTarget = namedTarget(localExpansionModel, 'display');
  const localExpansionProfile = profileFor(localExpansionModel, {
    minTextHeight: 12,
    localExpansion: { maxDepth: 4, maxInvocations: 8 },
  });
  const localExpansionResult = projectX4UiLayoutProgram(
    localExpansionModel,
    localExpansionTarget,
    localExpansionProfile,
  );
  const localExpansionProgram = programOf(localExpansionResult);
  const expandedInvocations = localExpansionProgram.localExpansion?.invocations.filter(
    candidate => candidate.status === 'expanded') || [];
  check('same-file direct, aliased, nested, and repeated helpers expand with ancestry-isolated ownership',
    expandedInvocations.length === 4
      && expandedInvocations.some(candidate => candidate.resolution === 'alias')
      && expandedInvocations.filter(candidate => candidate.depth === 1).length === 2
      && expandedInvocations.filter(candidate => candidate.depth === 2).length === 2
      && localExpansionProgram.frames.length === 1
      && localExpansionProgram.tables.length === 2
      && new Set(localExpansionProgram.tables.map(candidate => candidate.id)).size === 2
      && localExpansionProgram.tables.map(candidate => candidate.numColumns).join(',') === '1,1'
      && localExpansionProgram.tables.map(candidate => candidate.requestedWidth).join(',') === '60,70'
      && localExpansionProgram.tables.every(candidate => candidate.kernelState?.rows.length === 1)
      && localExpansionProgram.cells.map(candidate => factValue(candidate.descriptorFacts.primaryContent)).join(',') === 'one,two'
      && localExpansionProgram.operations.filter(candidate => candidate.localExpansion).every(candidate =>
        candidate.localExpansion?.ancestry.length === candidate.localExpansion.depth + 1)
      && localExpansionProgram.gaps.some(gap => gap.reason.includes('runtime non-nil availability remains unverified')),
    detail({
      invocations: localExpansionProgram.localExpansion?.invocations,
      tables: localExpansionProgram.tables,
      cells: localExpansionProgram.cells,
      operations: localExpansionProgram.operations,
      gaps: localExpansionProgram.gaps,
    }));
  const repeatedLocalExpansionProgram = programOf(projectX4UiLayoutProgram(
    localExpansionModel,
    localExpansionTarget,
    localExpansionProfile,
  ));
  check('local expansion is frozen, serializable, deterministic, and leaves inputs unchanged',
    JSON.stringify(localExpansionProgram) === JSON.stringify(repeatedLocalExpansionProgram)
      && JSON.parse(JSON.stringify(localExpansionProgram)).verification.game === X4_UI_LAYOUT_GAME_TRUTH
      && Object.isFrozen(localExpansionProgram)
      && Object.isFrozen(localExpansionProgram.localExpansion)
      && Object.isFrozen(localExpansionProgram.localExpansion?.invocations)
      && JSON.stringify(localExpansionModel) === JSON.stringify(buildX4UiCallModel(
        input(localExpansionSource, 'selftest/local-expansion.lua')))
      && localExpansionProgram.verification.gameVerified === false,
    detail(localExpansionProgram.localExpansion));
  const localExpansionAuthority = evidenceAuthorityOf(localExpansionResult);
  const localInvocationSourceIds = new Map(
    (localExpansionProgram.localExpansion?.invocations || []).map(invocation => [invocation.id, invocation.sourceInvocationId]),
  );
  const expandedManifestCalls = localExpansionAuthority?.calls.filter(candidate => candidate.expansion) || [];
  check('manifest expansion entries distinguish source invocation IDs from instance IDs and bind operation membership',
    localExpansionAuthority !== undefined
      && expandedManifestCalls.length > 0
      && expandedManifestCalls.every(call => {
        const operation = localExpansionProgram.operations.find(candidate => candidate.id === call.operationId);
        const manifestOperation = localExpansionAuthority.operations.find(candidate => candidate.id === call.operationId);
        return call.expansion?.sourceInvocationId !== undefined
          && call.expansion?.invocationInstanceId !== undefined
          && call.expansion.sourceInvocationId !== call.expansion.invocationInstanceId
          && localInvocationSourceIds.get(call.expansion.invocationInstanceId) === call.expansion.sourceInvocationId
          && operation?.localExpansion?.invocationId === call.expansion.invocationInstanceId
          && manifestOperation?.callId === call.id
          && sameJson(manifestOperation.expansion, call.expansion);
      }),
    detail({
      calls: expandedManifestCalls,
      invocations: localExpansionProgram.localExpansion?.invocations,
      operations: localExpansionProgram.operations,
    }));

  const parameterIdentitySource = [
    'local function panel(frame, width)',
    '  local table = frame:addTable(1, { width = width })',
    '  table:addRow(false, {})',
    'end',
  ].join('\n');
  const parameterIdentityModel = buildX4UiCallModel(input(
    parameterIdentitySource,
    'selftest/emitted-parameter-identity.lua',
  ));
  const parameterIdentityResult = projectX4UiLayoutProgram(
    parameterIdentityModel,
    namedTarget(parameterIdentityModel, 'panel'),
    profileFor(parameterIdentityModel),
  );
  const parameterIdentityProgram = programOf(parameterIdentityResult);
  const parameterIdentityAuthority = evidenceAuthorityOf(parameterIdentityResult);
  const parameterReceiverOperationIndex = parameterIdentityProgram.operations.findIndex(candidate =>
    candidate.metadata.receiver?.parameter !== undefined);
  const parameterReceiverPair = (
    mutate: (value: ValueRecord) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (parameterReceiverOperationIndex < 0 || parameterIdentityAuthority === undefined) return undefined;
    return actualOperationSnapshotPairFor(
      parameterIdentityProgram,
      parameterIdentityAuthority,
      parameterReceiverOperationIndex,
      operationValue => {
        const receiver = (operationValue.metadata as ValueRecord).receiver;
        if (receiver && typeof receiver === 'object' && !Array.isArray(receiver)) mutate(receiver as ValueRecord);
      },
      snapshot => {
        const receiver = (snapshot.metadata as ValueRecord).receiver;
        if (receiver && typeof receiver === 'object' && !Array.isArray(receiver)) mutate(receiver as ValueRecord);
      },
    );
  };
  check('positive direct parameter receiver identity remains pair-valid',
    parameterReceiverPair(() => {}) !== undefined
      && parameterIdentityAuthority !== undefined
      && safeSchemaPairValidation(parameterIdentityProgram, parameterIdentityAuthority).valid === true
      && parameterIdentityProgram.operations.some(candidate => candidate.metadata.receiver?.parameter !== undefined),
    detail({
      validation: parameterIdentityAuthority && safeSchemaPairValidation(parameterIdentityProgram, parameterIdentityAuthority),
      operations: parameterIdentityProgram.operations,
    }));

  const directDynamicPropertySource = [
    'local menu = { name = "DirectDynamicProperty", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("runtime", { width = getRuntimeWidth(), height = 2 })',
  ].join('\n');
  const directDynamicPropertyModel = buildX4UiCallModel(input(
    directDynamicPropertySource,
    'selftest/direct-dynamic-property.lua',
  ));
  const directDynamicPropertyResult = projectX4UiLayoutProgram(
    directDynamicPropertyModel,
    topTarget(directDynamicPropertyModel),
    profileFor(directDynamicPropertyModel),
  );
  const directDynamicPropertyProgram = programOf(directDynamicPropertyResult);
  const directDynamicPropertyAuthority = evidenceAuthorityOf(directDynamicPropertyResult);
  const directDynamicPropertyOperationIndex = directDynamicPropertyProgram.operations.findIndex(candidate =>
    candidate.metadata.semantics.properties?.some(property => property.value.status !== 'static'));
  const directDynamicPropertyPair = (
    mutate: (property: ValueRecord) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (directDynamicPropertyOperationIndex < 0 || directDynamicPropertyAuthority === undefined) return undefined;
    const mutateOperation = (operationValue: Record<string, unknown>): void => {
      const semantics = (operationValue.metadata as ValueRecord).semantics as ValueRecord;
      const properties = semantics.properties as ValueRecord[] | undefined;
      const property = properties?.find(candidate => {
        const value = candidate.value;
        return value && typeof value === 'object' && (value as ValueRecord).status !== 'static';
      });
      if (property) mutate(property);
    };
    return actualOperationSnapshotPairFor(
      directDynamicPropertyProgram,
      directDynamicPropertyAuthority,
      directDynamicPropertyOperationIndex,
      mutateOperation,
      mutateOperation,
    );
  };
  check('positive direct runtime property source equality remains pair-valid',
    directDynamicPropertyOperationIndex >= 0
      && directDynamicPropertyAuthority !== undefined
      && safeSchemaPairValidation(directDynamicPropertyProgram, directDynamicPropertyAuthority).valid === true,
    detail({
      operationIndex: directDynamicPropertyOperationIndex,
      validation: directDynamicPropertyAuthority && safeSchemaPairValidation(directDynamicPropertyProgram, directDynamicPropertyAuthority),
      operations: directDynamicPropertyProgram.operations,
    }));

  const profileAttack = (
    mutate: (profile: ValueRecord) => void,
  ): X4UiLayoutProgram => mutateProgramJson(allKindProgram, candidate => {
    mutate(candidate.profile as ValueRecord);
  });
  const profileAttacks: readonly [string, X4UiLayoutProgram][] = [
    ['profile uiScale zero', profileAttack(profile => {
      (profile.metrics as ValueRecord).uiScale = 0;
    })],
    ['profile border pin negative', profileAttack(profile => {
      const helper = profile.helper as ValueRecord;
      const constants = helper.constants as ValueRecord;
      (constants.borderSize as ValueRecord).value = -1;
    })],
    ['profile frame width negative', profileAttack(profile => {
      (profile.frame as ValueRecord).width = -1;
    })],
    ['profile minTextHeight negative', profileAttack(profile => {
      (profile.defaults as ValueRecord).minTextHeight = -1;
    })],
    ['profile Helper hash drift', profileAttack(profile => {
      (profile.helper as ValueRecord).sha256 = '0'.repeat(64);
    })],
    ['profile widget hash drift', profileAttack(profile => {
      (profile.widget as ValueRecord).sha256 = '0'.repeat(64);
    })],
    ['profile standardTextHeight value drift', profileAttack(profile => {
      const constants = (profile.helper as ValueRecord).constants as ValueRecord;
      (constants.standardTextHeight as ValueRecord).value = 17;
    })],
    ['profile standardTextHeight line drift', profileAttack(profile => {
      const constants = (profile.helper as ValueRecord).constants as ValueRecord;
      const source = (constants.standardTextHeight as ValueRecord).source as ValueRecord;
      source.lineStart = 534;
      source.lineEnd = 534;
    })],
    ['profile standardButtonHeight value drift', profileAttack(profile => {
      const defaults = profile.defaults as ValueRecord;
      (defaults.standardButtonHeight as ValueRecord).value = 26;
    })],
    ['profile localExpansion maxDepth zero', profileAttack(profile => {
      profile.localExpansion = { maxDepth: 0, maxInvocations: 4 };
    })],
    ['profile localExpansion maxDepth above limit', profileAttack(profile => {
      profile.localExpansion = { maxDepth: 33, maxInvocations: 4 };
    })],
    ['profile localExpansion maxInvocations zero', profileAttack(profile => {
      profile.localExpansion = { maxDepth: 4, maxInvocations: 0 };
    })],
    ['profile localExpansion maxInvocations above limit', profileAttack(profile => {
      profile.localExpansion = { maxDepth: 4, maxInvocations: 2049 };
    })],
    ['profile metrics border cross-link drift', profileAttack(profile => {
      (profile.metrics as ValueRecord).borderSize = 2;
    })],
  ];
  for (const [name, candidate] of profileAttacks) {
    const validation = safeSchemaPairValidation(candidate, allKindAuthority);
    check(`8A.5 profile schema rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }

  const valueSignatureAttacks: readonly {
    readonly name: string;
    readonly pair: { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined;
  }[] = [
    {
      name: 'static identifier',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static' && value.type === 'number',
        value => {
          value.type = 'identifier';
          delete value.value;
          delete value.sourceLiteral;
          delete value.reason;
          delete value.symbol;
        }),
    },
    {
      name: 'static expression',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static' && value.type === 'number',
        value => {
          value.type = 'expression';
          delete value.value;
          delete value.sourceLiteral;
          delete value.reason;
          delete value.symbol;
        }),
    },
    {
      name: 'static unknown',
      pair: coordinatedValuePair(allKindProgram, allKindAuthority,
        value => value.status === 'static' && value.type === 'number',
        value => {
          value.type = 'unknown';
          delete value.value;
          delete value.sourceLiteral;
          delete value.reason;
          delete value.symbol;
        }),
    },
    {
      name: 'dynamic function',
      pair: coordinatedValuePair(dynamicGapProgram, dynamicGapAuthority,
        value => value.status === 'dynamic' && value.type === 'expression',
        value => {
          value.type = 'function';
          delete value.localInvocationResult;
        }),
    },
    {
      name: 'dynamic identifier',
      pair: coordinatedValuePair(dynamicGapProgram, dynamicGapAuthority,
        value => value.status === 'dynamic' && value.type === 'expression',
        value => {
          value.type = 'identifier';
          delete value.localInvocationResult;
        }),
    },
    {
      name: 'dynamic table',
      pair: coordinatedValuePair(dynamicGapProgram, dynamicGapAuthority,
        value => value.status === 'dynamic' && value.type === 'expression',
        value => {
          value.type = 'table';
          delete value.localInvocationResult;
        }),
    },
    {
      name: 'unknown function',
      pair: coordinatedValuePair(schemaParameterProgram, schemaParameterAuthority,
        value => value.status === 'unknown' && value.type === 'identifier',
        value => {
          value.type = 'function';
          delete value.symbol;
        }),
    },
    {
      name: 'unknown table',
      pair: coordinatedValuePair(schemaParameterProgram, schemaParameterAuthority,
        value => value.status === 'unknown' && value.type === 'identifier',
        value => {
          value.type = 'table';
          delete value.symbol;
        }),
    },
  ];
  for (const attack of valueSignatureAttacks) {
    const validation = attack.pair
      ? safeSchemaPairValidation(attack.pair.program, attack.pair.authority)
      : { threw: false, valid: false, reason: 'value fixture not found' };
    check(`8A.5 value signature rejects ${attack.name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: attack.name, validation }));
  }

  const localResultPair = (
    mutate: (result: ValueRecord) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (localResultOperationIndex < 0 || schemaLocalResultAuthority === undefined) return undefined;
    const mutateOperation = (operationValue: Record<string, unknown>): void => {
      const semantics = (operationValue.metadata as ValueRecord).semantics as ValueRecord;
      const value = Object.values(semantics).find(candidate =>
        candidate && typeof candidate === 'object'
          && (candidate as ValueRecord).localInvocationResult !== undefined) as ValueRecord | undefined;
      if (value) mutate(value.localInvocationResult as ValueRecord);
    };
    return actualOperationSnapshotPairFor(
      schemaLocalResultProgram,
      schemaLocalResultAuthority,
      localResultOperationIndex,
      mutateOperation,
      mutateOperation,
    );
  };
  const parameterAttacks: readonly [string, { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined][] = [
    ['parameter symbol removed', parameterReceiverPair(value => { delete value.symbol; })],
    ['parameter name drift', parameterReceiverPair(value => {
      const parameter = value.parameter as ValueRecord;
      parameter.name = `${String(parameter.name)}-forged`;
    })],
    ['parameter declaration identity drift', parameterReceiverPair(value => {
      const parameter = value.parameter as ValueRecord;
      parameter.declarationId = 'local-function:forged.lua|0|1|2';
    })],
  ];
  for (const [name, pair] of parameterAttacks) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'parameter receiver fixture not found' };
    check(`8A.5 parameter correlation rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }
  const localResultAttacks: readonly [string, { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined][] = [
    ['local invocation ID drift', localResultPair(result => { result.invocationId = 'local-invocation:forged'; })],
    ['local invocation expression drift', localResultPair(result => { result.expression = 'forged()'; })],
    ['local invocation source file drift', localResultPair(result => {
      (result.source as ValueRecord).file = 'forged-local-result.lua';
    })],
  ];
  for (const [name, pair] of localResultAttacks) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'local invocation result fixture not found' };
    check(`8A.5 local-result correlation rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }

  const dynamicPropertyAttackCases: readonly [string, ReturnType<typeof directDynamicPropertyPair>][] = [
    ['direct runtime property source offset drift', directDynamicPropertyPair(property => {
      const source = property.source as ValueRecord;
      const start = source.start as ValueRecord;
      start.offset = (start.offset as number) + 1;
      property.sourceOrder = start.offset;
    })],
    ['direct runtime property source file drift', directDynamicPropertyPair(property => {
      (property.source as ValueRecord).file = 'forged-runtime-property.lua';
    })],
    ['direct runtime property source line drift', directDynamicPropertyPair(property => {
      const start = (property.source as ValueRecord).start as ValueRecord;
      start.line = (start.line as number) + 1;
    })],
  ];
  for (const [name, pair] of dynamicPropertyAttackCases) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'direct dynamic property fixture not found' };
    check(`8A.5 direct property correlation rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }

  const staticLiteralOperationIndex = allKindProgram.operations.findIndex(candidate =>
    candidate.metadata.semantics.properties?.some(property => property.value.sourceLiteral !== undefined));
  const staticLiteralPropertyPair = (
    mutate: (property: ValueRecord) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (staticLiteralOperationIndex < 0 || allKindAuthority === undefined) return undefined;
    const mutateOperation = (operationValue: Record<string, unknown>): void => {
      const semantics = (operationValue.metadata as ValueRecord).semantics as ValueRecord;
      const properties = semantics.properties as ValueRecord[] | undefined;
      const property = properties?.find(candidate => {
        const value = candidate.value;
        return value && typeof value === 'object'
          && (value as ValueRecord).sourceLiteral !== undefined;
      });
      if (property) mutate(property);
    };
    return actualOperationSnapshotPair(
      staticLiteralOperationIndex,
      mutateOperation,
      mutateOperation,
    );
  };
  const staticLiteralPropertyAttacks: readonly [string, ReturnType<typeof staticLiteralPropertyPair>][] = [
    ['direct static literal location file drift', staticLiteralPropertyPair(property => {
      const forgedFile = 'forged-static-literal.lua';
      (property.value as ValueRecord).location = {
        ...((property.value as ValueRecord).location as ValueRecord),
        file: forgedFile,
      };
      (property.source as ValueRecord).file = forgedFile;
    })],
    ['direct static literal sourceLiteral file drift', staticLiteralPropertyPair(property => {
      (property.value as ValueRecord).sourceLiteral = {
        ...((property.value as ValueRecord).sourceLiteral as ValueRecord),
        file: 'forged-literal-source.lua',
      };
    })],
    ['direct static literal location range drift', staticLiteralPropertyPair(property => {
      const value = property.value as ValueRecord;
      const location = value.location as ValueRecord;
      const source = property.source as ValueRecord;
      const valueStart = location.start as ValueRecord;
      const valueEnd = location.end as ValueRecord;
      const sourceStart = source.start as ValueRecord;
      const sourceEnd = source.end as ValueRecord;
      valueStart.offset = (valueStart.offset as number) + 1;
      valueEnd.offset = (valueEnd.offset as number) + 1;
      sourceStart.offset = valueStart.offset;
      sourceEnd.offset = valueEnd.offset;
      property.sourceOrder = sourceStart.offset;
    })],
  ];
  for (const [name, pair] of staticLiteralPropertyAttacks) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'direct static literal fixture not found' };
    check(`8A.5 static literal correlation rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }

  const directLiteralArgumentOperationIndex = allKindProgram.operations.findIndex(candidate =>
    candidate.kind === 'setColWidth'
      && candidate.metadata.arguments[0]?.sourceLiteral !== undefined);
  const directLiteralArgumentPair = (
    mutate: (argument: ValueRecord) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (directLiteralArgumentOperationIndex < 0 || allKindAuthority === undefined) return undefined;
    const mutateOperation = (operationValue: Record<string, unknown>): void => {
      const argumentsValue = (operationValue.metadata as ValueRecord).arguments as ValueRecord[];
      if (argumentsValue[0]) mutate(argumentsValue[0]);
    };
    return actualOperationSnapshotPair(
      directLiteralArgumentOperationIndex,
      mutateOperation,
      mutateOperation,
    );
  };
  const directLiteralArgumentAttacks: readonly [string, ReturnType<typeof directLiteralArgumentPair>][] = [
    ['argument location file drift', directLiteralArgumentPair(argument => {
      (argument.location as ValueRecord).file = 'forged-direct-argument.lua';
    })],
    ['argument sourceLiteral file drift', directLiteralArgumentPair(argument => {
      (argument.sourceLiteral as ValueRecord).file = 'forged-direct-literal.lua';
    })],
    ['argument location range drift', directLiteralArgumentPair(argument => {
      const location = argument.location as ValueRecord;
      const start = location.start as ValueRecord;
      const end = location.end as ValueRecord;
      start.offset = (start.offset as number) + 1;
      end.offset = (end.offset as number) + 1;
    })],
  ];
  for (const [name, pair] of directLiteralArgumentAttacks) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'direct literal argument fixture not found' };
    check(`8A.5 review fail-first rejects direct literal ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }

  const profileReviewAttacks: readonly [string, X4UiLayoutProgram][] = [
    ['truthGrade drift', profileAttack(profile => { profile.truthGrade = 'supplied'; })],
    ['frame width drift', profileAttack(profile => {
      const width = ((profile.frame as ValueRecord).width as number) + 1;
      (profile.frame as ValueRecord).width = width;
      (((profile.helper as ValueRecord).constants as ValueRecord).viewWidth as ValueRecord).value = width;
    })],
    ['uiScale drift', profileAttack(profile => {
      (profile.metrics as ValueRecord).uiScale = ((profile.metrics as ValueRecord).uiScale as number) + 0.25;
    })],
    ['scrollbarWidth drift', profileAttack(profile => {
      (profile.metrics as ValueRecord).scrollbarWidth = ((profile.metrics as ValueRecord).scrollbarWidth as number) + 1;
    })],
    ['standardContainerOffset drift', profileAttack(profile => {
      (profile.metrics as ValueRecord).standardContainerOffset = ((profile.metrics as ValueRecord).standardContainerOffset as number) + 1;
    })],
    ['profile source identity drift', profileAttack(profile => {
      (profile.source as ValueRecord).file = 'forged-profile-source.lua';
    })],
  ];
  for (const [name, candidate] of profileReviewAttacks) {
    const validation = safeSchemaPairValidation(candidate, allKindAuthority);
    check(`8A.5 review fail-first rejects one-sided profile ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }

  const recomputedParameterId = (parameter: ValueRecord): string => {
    const source = parameter.source as ValueRecord;
    const start = source.start as ValueRecord;
    const end = source.end as ValueRecord;
    return `local-parameter:${parameter.declarationId}|${parameter.index}|${start.offset}|${end.offset}`;
  };
  const internallyConsistentParameterAttacks: readonly [string, ReturnType<typeof parameterReceiverPair>][] = [
    ['declaration and recomputed ID drift', parameterReceiverPair(value => {
      const parameter = value.parameter as ValueRecord;
      parameter.declarationId = 'local-function:forged-owner.lua|0|1|2';
      parameter.id = recomputedParameterId(parameter);
    })],
    ['source and recomputed ID drift', parameterReceiverPair(value => {
      const parameter = value.parameter as ValueRecord;
      (parameter.source as ValueRecord).file = 'forged-parameter-source.lua';
      parameter.id = recomputedParameterId(parameter);
    })],
  ];
  for (const [name, pair] of internallyConsistentParameterAttacks) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'parameter receiver fixture not found' };
    check(`8A.5 review fail-first rejects internally consistent parameter ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }

  const localResultPropertySource = [
    'local function getValue() return runtimeValue end',
    'local menu = { name = "LocalResultProperty", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("runtime", { width = getValue(), height = 2 })',
  ].join('\n');
  const localResultPropertyModel = buildX4UiCallModel(input(
    localResultPropertySource,
    'selftest/local-result-property.lua',
  ));
  const localResultPropertyResult = projectX4UiLayoutProgram(
    localResultPropertyModel,
    topTarget(localResultPropertyModel),
    profileFor(localResultPropertyModel),
  );
  const localResultPropertyProgram = programOf(localResultPropertyResult);
  const localResultPropertyAuthority = evidenceAuthorityOf(localResultPropertyResult);
  const localResultPropertyOperationIndex = localResultPropertyProgram.operations.findIndex(candidate =>
    candidate.metadata.semantics.properties?.some(property => property.value.localInvocationResult !== undefined));
  const localResultPropertyPair = (
    mutate: (value: ValueRecord, property: ValueRecord) => void,
  ): { readonly program: X4UiLayoutProgram; readonly authority: EvidenceAuthorityLike } | undefined => {
    if (localResultPropertyOperationIndex < 0 || localResultPropertyAuthority === undefined) return undefined;
    const mutateOperation = (operationValue: Record<string, unknown>): void => {
      const semantics = (operationValue.metadata as ValueRecord).semantics as ValueRecord;
      const property = (semantics.properties as ValueRecord[]).find(candidate =>
        candidate.value && typeof candidate.value === 'object'
          && (candidate.value as ValueRecord).localInvocationResult !== undefined);
      if (property) mutate(property.value as ValueRecord, property);
    };
    return actualOperationSnapshotPairFor(
      localResultPropertyProgram,
      localResultPropertyAuthority,
      localResultPropertyOperationIndex,
      mutateOperation,
      mutateOperation,
    );
  };
  const internallyConsistentLocalResultPair = localResultPropertyPair((value, property) => {
    const localResult = value.localInvocationResult as ValueRecord;
    const source = localResult.source as ValueRecord;
    const forgedSource = {
      ...source,
      file: 'forged-local-invocation.lua',
      start: {
        ...(source.start as ValueRecord),
        offset: ((source.start as ValueRecord).offset as number) + 1,
      },
      end: {
        ...(source.end as ValueRecord),
        offset: ((source.end as ValueRecord).offset as number) + 1,
      },
    } as ValueRecord;
    const start = forgedSource.start as ValueRecord;
    const end = forgedSource.end as ValueRecord;
    localResult.source = forgedSource;
    localResult.invocationId = `local-invocation:${forgedSource.file}|${forgedSource.sourcePath || ''}|${start.offset}|${end.offset}`;
    value.location = forgedSource;
    property.source = forgedSource;
    property.sourceOrder = start.offset;
  });
  const localResultPropertyValidation = internallyConsistentLocalResultPair
    ? safeSchemaPairValidation(internallyConsistentLocalResultPair.program, internallyConsistentLocalResultPair.authority)
    : { threw: false, valid: false, reason: 'local-result property fixture not found' };
  check('8A.5 review fail-first rejects internally consistent local-result source/ID drift',
    localResultPropertyValidation.threw === false && localResultPropertyValidation.valid === false,
    detail({
      operationIndex: localResultPropertyOperationIndex,
      validation: localResultPropertyValidation,
    }));

  const expandedDynamicPropertySource = [
    'local function panel(cell, width)',
    '  cell:createText("runtime", { width = width })',
    'end',
    'local function display(runtimeWidth)',
    '  local menu = { name = "ExpandedDynamicProperty", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local table = frame:addTable(1, { width = 80 })',
    '  local row = table:addRow(false, {})',
    '  panel(row[1], runtimeWidth)',
    'end',
  ].join('\n');
  const expandedDynamicPropertyModel = buildX4UiCallModel(input(
    expandedDynamicPropertySource,
    'selftest/expanded-dynamic-property.lua',
  ));
  const expandedDynamicPropertyResult = projectX4UiLayoutProgram(
    expandedDynamicPropertyModel,
    namedTarget(expandedDynamicPropertyModel, 'display'),
    profileFor(expandedDynamicPropertyModel, { localExpansion: { maxDepth: 2, maxInvocations: 4 } }),
  );
  const expandedDynamicPropertyProgram = programOf(expandedDynamicPropertyResult);
  const expandedDynamicPropertyAuthority = evidenceAuthorityOf(expandedDynamicPropertyResult);
  const expandedDynamicPropertyOperationIndex = expandedDynamicPropertyProgram.operations.findIndex(candidate =>
    candidate.localExpansion !== undefined
      && candidate.metadata.semantics.properties?.some(property => property.value.status !== 'static'));
  const expandedDynamicPropertyPair = expandedDynamicPropertyOperationIndex >= 0 && expandedDynamicPropertyAuthority
    ? actualOperationSnapshotPairFor(
      expandedDynamicPropertyProgram,
      expandedDynamicPropertyAuthority,
      expandedDynamicPropertyOperationIndex,
      operationValue => {
        const properties = ((operationValue.metadata as ValueRecord).semantics as ValueRecord).properties as ValueRecord[];
        const property = properties.find(candidate => (candidate.value as ValueRecord).status !== 'static');
        if (property) (property.source as ValueRecord).file = 'forged-expanded-property.lua';
      },
      snapshot => {
        const properties = ((snapshot.metadata as ValueRecord).semantics as ValueRecord).properties as ValueRecord[];
        const property = properties.find(candidate => (candidate.value as ValueRecord).status !== 'static');
        if (property) (property.source as ValueRecord).file = 'forged-expanded-property.lua';
      },
    )
    : undefined;
  const expandedDynamicPropertyValidation = expandedDynamicPropertyPair
    ? safeSchemaPairValidation(expandedDynamicPropertyPair.program, expandedDynamicPropertyPair.authority)
    : { threw: false, valid: false, reason: 'expanded dynamic property fixture not found' };
  check('8A.5 review fail-first rejects expanded non-static source identity drift',
    expandedDynamicPropertyValidation.threw === false && expandedDynamicPropertyValidation.valid === false,
    detail({
      operationIndex: expandedDynamicPropertyOperationIndex,
      validation: expandedDynamicPropertyValidation,
      operations: expandedDynamicPropertyProgram.operations,
    }));
  check('8A.5 review positive direct/local/expanded identity fixtures remain intact',
    directLiteralArgumentOperationIndex >= 0
      && localResultPropertyAuthority !== undefined
      && safeSchemaPairValidation(localResultPropertyProgram, localResultPropertyAuthority).valid === true
      && expandedDynamicPropertyAuthority !== undefined
      && safeSchemaPairValidation(expandedDynamicPropertyProgram, expandedDynamicPropertyAuthority).valid === true,
    detail({
      directLiteralArgumentOperationIndex,
      localResultPropertyValidation: localResultPropertyAuthority
        && safeSchemaPairValidation(localResultPropertyProgram, localResultPropertyAuthority),
      expandedDynamicPropertyValidation: expandedDynamicPropertyAuthority
        && safeSchemaPairValidation(expandedDynamicPropertyProgram, expandedDynamicPropertyAuthority),
    }));

  const identityAttackSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function nested(cell, label, height)',
    '  cell:createText(label, { height = height })',
    'end',
    'local function panel(frame, count, width, label)',
    '  local table = frame:addTable(count, { width = width })',
    '  local row = table:addRow(false, {})',
    '  nested(row[1], label, 12)',
    'end',
    'local function unused(frame)',
    '  frame:addTable(1, { width = 22 })',
    'end',
    'local function unusedCaller(frame)',
    '  unused(frame)',
    'end',
    'local function display()',
    '  local menu = { name = "IdentityAttacks", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, 1, 60, "one")',
    'end',
  ].join('\n');
  const identityAttackModel = buildX4UiCallModel(input(
    identityAttackSource,
    'selftest/local-identity-attacks.lua',
  ));
  const identityAttackResult = projectX4UiLayoutProgram(
    identityAttackModel,
    namedTarget(identityAttackModel, 'display'),
    profileFor(identityAttackModel, { localExpansion: { maxDepth: 3, maxInvocations: 8 } }),
  );
  const identityAttackProgram = programOf(identityAttackResult);
  const identityAttackAuthority = evidenceAuthorityOf(identityAttackResult);
  const identityBaseValidation = identityAttackAuthority
    ? safeSchemaPairValidation(identityAttackProgram, identityAttackAuthority)
    : { threw: false, valid: false, reason: 'local identity authority fixture missing' };
  const identityAuthorityRecord = identityAttackAuthority?.localIdentities;
  const identityFunctions = identityAuthorityRecord?.functions || [];
  const identityInvocations = identityAuthorityRecord?.invocations || [];
  const identityProgramLedger = identityAttackProgram.localIdentities;
  const identityAuthorityLedger = identityAttackAuthority?.localIdentities;
  const identityAuthorityObjects = new Set<object>();
  const collectIdentityObjects = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const objectValue = value as object;
    if (identityAuthorityObjects.has(objectValue)) return;
    identityAuthorityObjects.add(objectValue);
    Object.values(objectValue).forEach(collectIdentityObjects);
  };
  collectIdentityObjects(identityAuthorityLedger);
  const programIdentityObjectsAreDetached = (value: unknown, seen = new Set<object>()): boolean => {
    if (!value || typeof value !== 'object') return true;
    const objectValue = value as object;
    if (seen.has(objectValue)) return true;
    if (identityAuthorityObjects.has(objectValue)) return false;
    seen.add(objectValue);
    return Object.values(objectValue).every(child => programIdentityObjectsAreDetached(child, seen));
  };
  check('8A.6 positive program local identity ledger is complete, frozen, exact, and JSON-roundtrippable',
    identityAttackAuthority !== undefined
      && identityBaseValidation.valid === true
      && identityProgramLedger !== undefined
      && Object.isFrozen(identityProgramLedger)
      && Object.isFrozen(identityProgramLedger.functions)
      && Object.isFrozen(identityProgramLedger.invocations)
      && identityProgramLedger.functions.every(identity => Object.isFrozen(identity)
        && Object.isFrozen(identity.source)
        && Object.isFrozen(identity.parameters)
        && identity.parameters.every(parameter => Object.isFrozen(parameter) && Object.isFrozen(parameter.source)))
      && identityProgramLedger.invocations.every(invocation => Object.isFrozen(invocation)
        && Object.isFrozen(invocation.source))
      && sameJson(identityProgramLedger, identityAuthorityLedger)
      && sameJson(JSON.parse(JSON.stringify(identityProgramLedger)), identityProgramLedger),
    detail({ program: identityProgramLedger, authority: identityAuthorityLedger }));
  check('8A.6 positive program and authority local identity ledgers are recursively detached',
    identityAuthorityLedger !== undefined
      && identityProgramLedger !== identityAuthorityLedger
      && (identityProgramLedger.functions as unknown) !== identityAuthorityLedger.functions
      && (identityProgramLedger.invocations as unknown) !== identityAuthorityLedger.invocations
      && identityProgramLedger.functions.every((identity, index) =>
        (identity as unknown) !== identityAuthorityLedger.functions[index]
          && identity.source !== identityAuthorityLedger.functions[index]?.source
          && identity.parameters !== identityAuthorityLedger.functions[index]?.parameters)
      && identityProgramLedger.invocations.every((invocation, index) =>
        (invocation as unknown) !== identityAuthorityLedger.invocations[index]
          && invocation.source !== identityAuthorityLedger.invocations[index]?.source)
      && programIdentityObjectsAreDetached(identityProgramLedger),
    detail({
      programAuthorityRootDetached: identityProgramLedger !== identityAuthorityLedger,
      recursivelyDetached: programIdentityObjectsAreDetached(identityProgramLedger),
    }));

  type TopologyAttack = {
    readonly name: string;
    readonly program: X4UiLayoutProgram | undefined;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly proof: ValueRecord;
  };
  const topologyFixture = (() => {
    if (!allKindAuthority) return undefined;
    const tableIndex = allKindProgram.tables.findIndex(table => {
      const frame = table.frameId
        ? allKindProgram.frames.find(candidate => candidate.id === table.frameId)
        : undefined;
      return frame !== undefined
        && table.frameWidth !== undefined
        && table.kernelState !== undefined
        && frame.tableIds.includes(table.id)
        && frame.operationIds.some(operationId => allKindProgram.operations.some(operation =>
          operation.id === operationId && operation.kind === 'createFrameHandle' && operation.status === 'applied'))
        && table.operationIds.some(operationId => allKindProgram.operations.some(operation =>
          operation.id === operationId && operation.kind === 'addTable' && operation.status === 'applied'));
    });
    if (tableIndex < 0) return undefined;
    const table = allKindProgram.tables[tableIndex];
    const frameIndex = table.frameId === undefined
      ? -1
      : allKindProgram.frames.findIndex(candidate => candidate.id === table.frameId);
    const authorityTableIndex = allKindAuthority.nodes.tables.findIndex(candidate => candidate.id === table.id);
    const authorityFrameIndex = frameIndex < 0
      ? -1
      : allKindAuthority.nodes.frames.findIndex(candidate => candidate.id === allKindProgram.frames[frameIndex].id);
    if (frameIndex < 0 || authorityTableIndex < 0 || authorityFrameIndex < 0) return undefined;
    return { tableIndex, frameIndex, authorityTableIndex, authorityFrameIndex } as const;
  })();
  const topologyBaselineValidation = allKindAuthority
    ? safeSchemaPairValidation(allKindProgram, allKindAuthority)
    : { threw: false, valid: false, reason: 'topology authority fixture missing' };
  const withoutTopologyKey = (value: unknown, key: string): ValueRecord => {
    const clone = jsonClone(value) as ValueRecord;
    delete clone[key];
    return clone;
  };
  const makeTopologyAttack = (
    name: string,
    mutate: (
      candidateProgram: ValueRecord,
      candidateAuthority: ValueRecord,
      fixture: NonNullable<typeof topologyFixture>,
    ) => ValueRecord,
  ): TopologyAttack => {
    if (!topologyFixture || !allKindAuthority) {
      return {
        name,
        program: undefined,
        authority: undefined,
        proof: { fixtureReady: false, reason: 'applied frame/table topology fixture missing' },
      };
    }
    const candidateProgram = jsonClone(allKindProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as ValueRecord;
    const proof = mutate(candidateProgram, candidateAuthority, topologyFixture);
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof,
    };
  };
  const topologyAttacks: readonly TopologyAttack[] = [
    makeTopologyAttack('rejects nonexistent table frame owner while width/state remain', (candidateProgram, candidateAuthority, fixture) => {
      const tables = candidateProgram.tables as ValueRecord[];
      const frames = candidateProgram.frames as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityTables = authorityNodes.tables as ValueRecord[];
      const table = tables[fixture.tableIndex];
      const frame = frames[fixture.frameIndex];
      const authorityTable = authorityTables[fixture.authorityTableIndex]?.snapshot as ValueRecord;
      const beforeTable = jsonClone(table);
      const beforeAuthorityTable = jsonClone(authorityTable);
      const beforeFrameIds = new Set(frames.map(candidate => String(candidate.id)));
      const forgedFrameId = `${String(table.frameId)}:nonexistent-topology-owner`;
      table.frameId = forgedFrameId;
      authorityTable.frameId = forgedFrameId;
      return {
        fixtureReady: table !== undefined
          && frame !== undefined
          && authorityTable !== undefined
          && typeof beforeTable.frameId === 'string'
          && beforeFrameIds.has(String(beforeTable.frameId))
          && !beforeFrameIds.has(forgedFrameId)
          && table.frameId === forgedFrameId
          && authorityTable.frameId === forgedFrameId
          && table.frameId !== beforeTable.frameId
          && authorityTable.frameId !== beforeAuthorityTable.frameId
          && Object.is(table.frameWidth, beforeTable.frameWidth)
          && sameJson(table.kernelState, beforeTable.kernelState)
          && sameJson(authorityTable.frameWidth, beforeAuthorityTable.frameWidth)
          && sameJson(authorityTable.kernelState, beforeAuthorityTable.kernelState)
          && sameJson(withoutTopologyKey(table, 'frameId'), withoutTopologyKey(beforeTable, 'frameId'))
          && sameJson(withoutTopologyKey(authorityTable, 'frameId'), withoutTopologyKey(beforeAuthorityTable, 'frameId')),
        selectedTableId: table?.id,
        beforeFrameId: beforeTable.frameId,
        forgedFrameId,
        frameIdChanged: table?.frameId === forgedFrameId && authorityTable?.frameId === forgedFrameId,
        forgedFrameIdIsUnknown: !beforeFrameIds.has(forgedFrameId),
        tableWidthUnchanged: table !== undefined && Object.is(table.frameWidth, beforeTable.frameWidth),
        tableKernelStateUnchanged: table !== undefined && sameJson(table.kernelState, beforeTable.kernelState),
        noCollateralTableMutation: table !== undefined
          && authorityTable !== undefined
          && sameJson(withoutTopologyKey(table, 'frameId'), withoutTopologyKey(beforeTable, 'frameId'))
          && sameJson(withoutTopologyKey(authorityTable, 'frameId'), withoutTopologyKey(beforeAuthorityTable, 'frameId')),
      };
    }),
    makeTopologyAttack('rejects missing owning frame width while table width/state remain', (candidateProgram, candidateAuthority, fixture) => {
      const tables = candidateProgram.tables as ValueRecord[];
      const frames = candidateProgram.frames as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityTables = authorityNodes.tables as ValueRecord[];
      const authorityFrames = authorityNodes.frames as ValueRecord[];
      const table = tables[fixture.tableIndex];
      const frame = frames[fixture.frameIndex];
      const authorityTable = authorityTables[fixture.authorityTableIndex]?.snapshot as ValueRecord;
      const authorityFrame = authorityFrames[fixture.authorityFrameIndex]?.snapshot as ValueRecord;
      const beforeFrame = jsonClone(frame);
      const beforeAuthorityFrame = jsonClone(authorityFrame);
      const beforeTable = jsonClone(table);
      const beforeAuthorityTable = jsonClone(authorityTable);
      const hadWidth = Object.prototype.hasOwnProperty.call(frame, 'width')
        && Object.prototype.hasOwnProperty.call(authorityFrame, 'width')
        && typeof frame.width === 'number'
        && typeof authorityFrame.width === 'number';
      delete frame.width;
      delete authorityFrame.width;
      return {
        fixtureReady: hadWidth
          && !Object.prototype.hasOwnProperty.call(frame, 'width')
          && !Object.prototype.hasOwnProperty.call(authorityFrame, 'width')
          && table.frameId === frame.id
          && authorityTable.frameId === authorityFrame.id
          && Object.is(table.frameWidth, beforeTable.frameWidth)
          && sameJson(table.kernelState, beforeTable.kernelState)
          && sameJson(withoutTopologyKey(frame, 'width'), withoutTopologyKey(beforeFrame, 'width'))
          && sameJson(withoutTopologyKey(authorityFrame, 'width'), withoutTopologyKey(beforeAuthorityFrame, 'width'))
          && sameJson(authorityTable, beforeAuthorityTable),
        selectedFrameId: frame?.id,
        selectedTableId: table?.id,
        frameWidthPresentBefore: hadWidth,
        frameWidthPresentAfter: Object.prototype.hasOwnProperty.call(frame, 'width'),
        frameWidthDeleted: !Object.prototype.hasOwnProperty.call(frame, 'width')
          && !Object.prototype.hasOwnProperty.call(authorityFrame, 'width'),
        tableWidthUnchanged: table !== undefined && Object.is(table.frameWidth, beforeTable.frameWidth),
        tableKernelStateUnchanged: table !== undefined && sameJson(table.kernelState, beforeTable.kernelState),
        noCollateralFrameMutation: frame !== undefined
          && authorityFrame !== undefined
          && sameJson(withoutTopologyKey(frame, 'width'), withoutTopologyKey(beforeFrame, 'width'))
          && sameJson(withoutTopologyKey(authorityFrame, 'width'), withoutTopologyKey(beforeAuthorityFrame, 'width')),
      };
    }),
    makeTopologyAttack('rejects removed owning frame table ID', (candidateProgram, candidateAuthority, fixture) => {
      const tables = candidateProgram.tables as ValueRecord[];
      const frames = candidateProgram.frames as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityFrames = authorityNodes.frames as ValueRecord[];
      const table = tables[fixture.tableIndex];
      const frame = frames[fixture.frameIndex];
      const authorityFrame = authorityFrames[fixture.authorityFrameIndex]?.snapshot as ValueRecord;
      const beforeFrame = jsonClone(frame);
      const beforeAuthorityFrame = jsonClone(authorityFrame);
      const beforeTableIds = [...(frame.tableIds as string[])];
      const afterTableIds = beforeTableIds.filter(id => id !== table.id);
      frame.tableIds = afterTableIds;
      authorityFrame.tableIds = [...afterTableIds];
      return {
        fixtureReady: beforeTableIds.includes(String(table.id))
          && afterTableIds.length === beforeTableIds.length - 1
          && !afterTableIds.includes(String(table.id))
          && sameJson(afterTableIds, (authorityFrame.tableIds as string[]))
          && sameJson(withoutTopologyKey(frame, 'tableIds'), withoutTopologyKey(beforeFrame, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrame, 'tableIds'), withoutTopologyKey(beforeAuthorityFrame, 'tableIds')),
        selectedFrameId: frame?.id,
        removedTableId: table?.id,
        beforeTableIdCount: beforeTableIds.length,
        afterTableIdCount: afterTableIds.length,
        cardinalityDelta: afterTableIds.length - beforeTableIds.length,
        removed: !afterTableIds.includes(String(table.id)),
        noCollateralFrameMutation: frame !== undefined
          && authorityFrame !== undefined
          && sameJson(withoutTopologyKey(frame, 'tableIds'), withoutTopologyKey(beforeFrame, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrame, 'tableIds'), withoutTopologyKey(beforeAuthorityFrame, 'tableIds')),
      };
    }),
    makeTopologyAttack('rejects unknown owning frame table ID', (candidateProgram, candidateAuthority, fixture) => {
      const tables = candidateProgram.tables as ValueRecord[];
      const frames = candidateProgram.frames as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityFrames = authorityNodes.frames as ValueRecord[];
      const table = tables[fixture.tableIndex];
      const frame = frames[fixture.frameIndex];
      const authorityFrame = authorityFrames[fixture.authorityFrameIndex]?.snapshot as ValueRecord;
      const beforeFrame = jsonClone(frame);
      const beforeAuthorityFrame = jsonClone(authorityFrame);
      const beforeTableIds = [...(frame.tableIds as string[])];
      const unknownTableId = `${String(table.id)}:unknown-topology-table`;
      const afterTableIds = [...beforeTableIds, unknownTableId];
      frame.tableIds = afterTableIds;
      authorityFrame.tableIds = [...afterTableIds];
      const knownTableIds = new Set(tables.map(candidate => String(candidate.id)));
      return {
        fixtureReady: !knownTableIds.has(unknownTableId)
          && afterTableIds.length === beforeTableIds.length + 1
          && sameJson(afterTableIds.slice(0, beforeTableIds.length), beforeTableIds)
          && afterTableIds[afterTableIds.length - 1] === unknownTableId
          && sameJson(afterTableIds, authorityFrame.tableIds)
          && sameJson(withoutTopologyKey(frame, 'tableIds'), withoutTopologyKey(beforeFrame, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrame, 'tableIds'), withoutTopologyKey(beforeAuthorityFrame, 'tableIds')),
        selectedFrameId: frame?.id,
        addedTableId: unknownTableId,
        knownTableIdBefore: knownTableIds.has(unknownTableId),
        beforeTableIdCount: beforeTableIds.length,
        afterTableIdCount: afterTableIds.length,
        cardinalityDelta: afterTableIds.length - beforeTableIds.length,
        appended: afterTableIds[afterTableIds.length - 1] === unknownTableId,
        noCollateralFrameMutation: frame !== undefined
          && authorityFrame !== undefined
          && sameJson(withoutTopologyKey(frame, 'tableIds'), withoutTopologyKey(beforeFrame, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrame, 'tableIds'), withoutTopologyKey(beforeAuthorityFrame, 'tableIds')),
      };
    }),
    makeTopologyAttack('rejects missing table frame owner while width/state remain', (candidateProgram, candidateAuthority, fixture) => {
      const tables = candidateProgram.tables as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityTables = authorityNodes.tables as ValueRecord[];
      const table = tables[fixture.tableIndex];
      const authorityTable = authorityTables[fixture.authorityTableIndex]?.snapshot as ValueRecord;
      const beforeTable = jsonClone(table);
      const beforeAuthorityTable = jsonClone(authorityTable);
      const hadFrameId = typeof table.frameId === 'string'
        && typeof authorityTable.frameId === 'string'
        && table.frameId === authorityTable.frameId;
      delete table.frameId;
      delete authorityTable.frameId;
      return {
        fixtureReady: hadFrameId
          && !Object.prototype.hasOwnProperty.call(table, 'frameId')
          && !Object.prototype.hasOwnProperty.call(authorityTable, 'frameId')
          && Object.is(table.frameWidth, beforeTable.frameWidth)
          && sameJson(table.kernelState, beforeTable.kernelState)
          && sameJson(withoutTopologyKey(table, 'frameId'), withoutTopologyKey(beforeTable, 'frameId'))
          && sameJson(withoutTopologyKey(authorityTable, 'frameId'), withoutTopologyKey(beforeAuthorityTable, 'frameId')),
        selectedTableId: table?.id,
        frameIdPresentBefore: hadFrameId,
        frameIdPresentAfter: Object.prototype.hasOwnProperty.call(table, 'frameId'),
        frameIdDeleted: !Object.prototype.hasOwnProperty.call(table, 'frameId')
          && !Object.prototype.hasOwnProperty.call(authorityTable, 'frameId'),
        tableWidthUnchanged: table !== undefined && Object.is(table.frameWidth, beforeTable.frameWidth),
        tableKernelStateUnchanged: table !== undefined && sameJson(table.kernelState, beforeTable.kernelState),
        noCollateralTableMutation: table !== undefined
          && authorityTable !== undefined
          && sameJson(withoutTopologyKey(table, 'frameId'), withoutTopologyKey(beforeTable, 'frameId'))
          && sameJson(withoutTopologyKey(authorityTable, 'frameId'), withoutTopologyKey(beforeAuthorityTable, 'frameId')),
      };
    }),
  ];
  for (const attack of topologyAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'topology attack fixture missing' };
    check(`8A.6 Phase 2A fail-first ${attack.name}`,
      topologyBaselineValidation.valid === true
        && attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: topologyBaselineValidation, proof: attack.proof, validation }));
  }
  const ownerConsistencySource = [
    'local menu = { name = "OwnerConsistency", layer = 1 }',
    'local frameA = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableA = frameA:addTable(1, { width = 80, reserveScrollBar = false })',
    'tableA:addRow(false, {})',
    'local tableA2 = frameA:addTable(1, { width = 80, reserveScrollBar = false })',
    'tableA2:addRow(false, {})',
    'local frameB = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableB = frameB:addTable(1, { width = 80, reserveScrollBar = false })',
    'tableB:addRow(false, {})',
    'frameA:display()',
    'frameB:display()',
  ].join('\n');
  const ownerConsistencyModel = buildX4UiCallModel(input(
    ownerConsistencySource,
    'selftest/owner-consistency.lua',
  ));
  const ownerConsistencyResult = projectX4UiLayoutProgram(
    ownerConsistencyModel,
    topTarget(ownerConsistencyModel),
    profileFor(ownerConsistencyModel),
  );
  const ownerConsistencyProgram = programOf(ownerConsistencyResult);
  const ownerConsistencyAuthority = evidenceAuthorityOf(ownerConsistencyResult);
  const ownerConsistencyFixture = (() => {
    if (!ownerConsistencyAuthority) return undefined;
    const frames = ownerConsistencyProgram.frames;
    const tables = ownerConsistencyProgram.tables;
    const appliedFrame = (frame: typeof frames[number]): boolean => frame.operationIds.some(operationId =>
      ownerConsistencyProgram.operations.some(operation =>
        operation.id === operationId && operation.kind === 'createFrameHandle' && operation.status === 'applied'));
    const appliedTable = (table: typeof tables[number]): boolean => table.kernelState !== undefined
      && table.frameWidth !== undefined
      && table.operationIds.some(operationId => ownerConsistencyProgram.operations.some(operation =>
        operation.id === operationId && operation.kind === 'addTable' && operation.status === 'applied'));
    const frameAIndex = frames.findIndex(frame =>
      frame.tableIds.length >= 2
        && new Set(frame.tableIds).size >= 2
        && appliedFrame(frame)
        && frame.tableIds.every(tableId => {
          const table = tables.find(candidate => candidate.id === tableId);
          return table !== undefined && table.frameId === frame.id && appliedTable(table);
        }));
    if (frameAIndex < 0) return undefined;
    const frameA = frames[frameAIndex];
    const frameBIndex = frames.findIndex((frame, index) => index !== frameAIndex
      && frame.width !== undefined
      && frame.width === frameA.width
      && frame.id !== frameA.id
      && frame.tableIds.length >= 1
      && appliedFrame(frame)
      && frame.tableIds.some(tableId => {
        const table = tables.find(candidate => candidate.id === tableId);
        return table !== undefined && table.frameId === frame.id && appliedTable(table);
      }));
    if (frameBIndex < 0) return undefined;
    const frameB = frames[frameBIndex];
    const tableAIndex = tables.findIndex(table => table.frameId === frameA.id
      && frameA.tableIds.includes(table.id)
      && table.identity?.parentPath === frameA.identity?.path
      && appliedTable(table));
    const tableBIndex = tables.findIndex(table => table.frameId === frameB.id
      && frameB.tableIds.includes(table.id)
      && appliedTable(table));
    const authorityFrameAIndex = ownerConsistencyAuthority.nodes.frames.findIndex(candidate => candidate.id === frameA.id);
    const authorityFrameBIndex = ownerConsistencyAuthority.nodes.frames.findIndex(candidate => candidate.id === frameB.id);
    const authorityTableAIndex = tableAIndex < 0
      ? -1
      : ownerConsistencyAuthority.nodes.tables.findIndex(candidate => candidate.id === tables[tableAIndex].id);
    if (tableAIndex < 0 || tableBIndex < 0 || authorityFrameAIndex < 0 || authorityFrameBIndex < 0 || authorityTableAIndex < 0) {
      return undefined;
    }
    return {
      frameAIndex,
      frameBIndex,
      tableAIndex,
      tableBIndex,
      authorityFrameAIndex,
      authorityFrameBIndex,
      authorityTableAIndex,
    } as const;
  })();
  const ownerConsistencyBaseline = ownerConsistencyAuthority
    ? safeSchemaPairValidation(ownerConsistencyProgram, ownerConsistencyAuthority)
    : { threw: false, valid: false, reason: 'owner consistency fixture missing authority' };
  type OwnerConsistencyAttack = {
    readonly name: string;
    readonly program: X4UiLayoutProgram | undefined;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly proof: ValueRecord;
  };
  const makeOwnerConsistencyAttack = (
    name: string,
    mutate: (
      candidateProgram: ValueRecord,
      candidateAuthority: ValueRecord,
      fixture: NonNullable<typeof ownerConsistencyFixture>,
    ) => ValueRecord,
  ): OwnerConsistencyAttack => {
    if (!ownerConsistencyFixture || !ownerConsistencyAuthority) {
      return {
        name,
        program: undefined,
        authority: undefined,
        proof: { fixtureReady: false, reason: 'owner consistency fixture missing' },
      };
    }
    const candidateProgram = jsonClone(ownerConsistencyProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(ownerConsistencyAuthority) as unknown as ValueRecord;
    const proof = mutate(candidateProgram, candidateAuthority, ownerConsistencyFixture);
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof,
    };
  };
  const ownerConsistencyAttacks: readonly OwnerConsistencyAttack[] = [
    makeOwnerConsistencyAttack('rejects coherent same-width table reassignment', (candidateProgram, candidateAuthority, fixture) => {
      const frames = candidateProgram.frames as ValueRecord[];
      const tables = candidateProgram.tables as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityFrames = authorityNodes.frames as ValueRecord[];
      const authorityTables = authorityNodes.tables as ValueRecord[];
      const frameA = frames[fixture.frameAIndex];
      const frameB = frames[fixture.frameBIndex];
      const table = tables[fixture.tableAIndex];
      const authorityFrameA = authorityFrames[fixture.authorityFrameAIndex]?.snapshot as ValueRecord;
      const authorityFrameB = authorityFrames[fixture.authorityFrameBIndex]?.snapshot as ValueRecord;
      const authorityTable = authorityTables[fixture.authorityTableAIndex]?.snapshot as ValueRecord;
      const operations = candidateProgram.operations as X4UiLayoutProgram['operations'];
      const operation = operations.find(candidate =>
        candidate.kind === 'addTable' && candidate.tableId === table.id && candidate.status === 'applied');
      const beforeFrameA = jsonClone(frameA);
      const beforeFrameB = jsonClone(frameB);
      const beforeTable = jsonClone(table);
      const beforeAuthorityFrameA = jsonClone(authorityFrameA);
      const beforeAuthorityFrameB = jsonClone(authorityFrameB);
      const beforeAuthorityTable = jsonClone(authorityTable);
      const beforeOperation = operation ? jsonClone(operation) as unknown as ValueRecord : undefined;
      const beforeAuthorityOperation = operation
        ? jsonClone((candidateAuthority.operations as ValueRecord[]).find(candidate => candidate.id === operation.id)) as ValueRecord
        : undefined;
      const receiver = operation?.metadata.receiver as unknown as ValueRecord | undefined;
      const receiverReference = receiver?.reference as ValueRecord | undefined;
      frameA.tableIds = (frameA.tableIds as string[]).filter(id => id !== table.id);
      frameB.tableIds = [...(frameB.tableIds as string[]), String(table.id)];
      table.frameId = frameB.id;
      authorityFrameA.tableIds = (authorityFrameA.tableIds as string[]).filter(id => id !== table.id);
      authorityFrameB.tableIds = [...(authorityFrameB.tableIds as string[]), String(table.id)];
      authorityTable.frameId = frameB.id;
      const authorityOperation = operation
        ? (candidateAuthority.operations as ValueRecord[]).find(candidate => candidate.id === operation.id)
        : undefined;
      return {
        fixtureReady: frameA !== undefined
          && frameB !== undefined
          && table !== undefined
          && authorityFrameA !== undefined
          && authorityFrameB !== undefined
          && authorityTable !== undefined
          && operation !== undefined
          && frameA.id !== frameB.id
          && typeof frameA.width === 'number'
          && frameA.width === frameB.width
          && (beforeFrameA.tableIds as string[]).includes(String(table.id))
          && !(beforeFrameB.tableIds as string[]).includes(String(table.id))
          && table.frameId === frameB.id
          && authorityTable.frameId === frameB.id
          && !(frameA.tableIds as string[]).includes(String(table.id))
          && (frameB.tableIds as string[]).includes(String(table.id))
          && (authorityFrameA.tableIds as string[]).includes(String(table.id)) === false
          && (authorityFrameB.tableIds as string[]).includes(String(table.id))
          && Object.is(table.frameWidth, beforeTable.frameWidth)
          && sameJson(table.kernelState, beforeTable.kernelState)
          && sameJson(table.identity, beforeTable.identity)
          && Object.is(authorityTable.frameWidth, beforeAuthorityTable.frameWidth)
          && sameJson(authorityTable.kernelState, beforeAuthorityTable.kernelState)
          && receiver?.expression === 'frameA'
          && receiverReference?.kind === 'frame'
          && receiverReference.path === 'frameA'
          && sameJson(operation.metadata.receiver, beforeOperation?.metadata && (beforeOperation.metadata as ValueRecord).receiver)
          && sameJson(operation.metadata.result, beforeOperation?.metadata && (beforeOperation.metadata as ValueRecord).result)
          && sameJson(authorityOperation?.snapshot, beforeAuthorityOperation?.snapshot)
          && sameJson(withoutTopologyKey(frameA, 'tableIds'), withoutTopologyKey(beforeFrameA, 'tableIds'))
          && sameJson(withoutTopologyKey(frameB, 'tableIds'), withoutTopologyKey(beforeFrameB, 'tableIds'))
          && sameJson(withoutTopologyKey(table, 'frameId'), withoutTopologyKey(beforeTable, 'frameId'))
          && sameJson(withoutTopologyKey(authorityFrameA, 'tableIds'), withoutTopologyKey(beforeAuthorityFrameA, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrameB, 'tableIds'), withoutTopologyKey(beforeAuthorityFrameB, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityTable, 'frameId'), withoutTopologyKey(beforeAuthorityTable, 'frameId')),
        frameAId: frameA?.id,
        frameBId: frameB?.id,
        frameAWidth: frameA?.width,
        frameBWidth: frameB?.width,
        tableId: table?.id,
        equalWidth: frameA !== undefined && frameA.width === frameB?.width,
        frameAContainsAfter: (frameA?.tableIds as string[] | undefined)?.includes(table?.id as string),
        frameBContainsAfter: (frameB?.tableIds as string[] | undefined)?.includes(table?.id as string),
        tableFrameIdAfter: table?.frameId,
        receiverUnchanged: operation !== undefined && sameJson(operation.metadata.receiver, beforeOperation?.metadata && (beforeOperation.metadata as ValueRecord).receiver),
        receiverSnapshot: operation ? jsonClone(operation.metadata.receiver) : undefined,
        receiverIdentifiesFrameA: receiver?.expression === 'frameA'
          && receiverReference?.kind === 'frame'
          && receiverReference.path === 'frameA',
        resultUnchanged: operation !== undefined && sameJson(operation.metadata.result, beforeOperation?.metadata && (beforeOperation.metadata as ValueRecord).result),
        tableWidthUnchanged: table !== undefined && Object.is(table.frameWidth, beforeTable.frameWidth),
        tableKernelStateUnchanged: table !== undefined && sameJson(table.kernelState, beforeTable.kernelState),
        tableIdentityUnchanged: table !== undefined && sameJson(table.identity, beforeTable.identity),
        authorityTableWidthUnchanged: authorityTable !== undefined && Object.is(authorityTable.frameWidth, beforeAuthorityTable.frameWidth),
        authorityTableKernelStateUnchanged: authorityTable !== undefined && sameJson(authorityTable.kernelState, beforeAuthorityTable.kernelState),
      };
    }),
    makeOwnerConsistencyAttack('rejects contradictory operation frame/table owners', (candidateProgram, candidateAuthority, fixture) => {
      const frames = candidateProgram.frames as ValueRecord[];
      const tables = candidateProgram.tables as ValueRecord[];
      const operations = candidateProgram.operations as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityFrames = authorityNodes.frames as ValueRecord[];
      const authorityTables = authorityNodes.tables as ValueRecord[];
      const authorityOperations = candidateAuthority.operations as ValueRecord[];
      const frameA = frames[fixture.frameAIndex];
      const frameB = frames[fixture.frameBIndex];
      const table = tables[fixture.tableAIndex];
      const authorityFrameA = authorityFrames[fixture.authorityFrameAIndex]?.snapshot as ValueRecord;
      const authorityFrameB = authorityFrames[fixture.authorityFrameBIndex]?.snapshot as ValueRecord;
      const authorityFrameBLedger = authorityFrames[fixture.authorityFrameBIndex];
      const authorityFrameALedger = authorityFrames[fixture.authorityFrameAIndex];
      const authorityTable = authorityTables[fixture.authorityTableAIndex]?.snapshot as ValueRecord;
      const operation = operations.find(candidate =>
        candidate.kind === 'addTable' && candidate.tableId === table.id && candidate.status === 'applied');
      const authorityOperation = operation
        ? authorityOperations.find(candidate => candidate.id === operation.id)
        : undefined;
      const operationId = operation ? String(operation.id) : undefined;
      const beforeOperation = operation ? jsonClone(operation) : undefined;
      const beforeAuthorityOperation = authorityOperation ? jsonClone(authorityOperation) : undefined;
      const beforeFrameA = jsonClone(frameA);
      const beforeFrameB = jsonClone(frameB);
      const beforeAuthorityFrameA = jsonClone(authorityFrameA);
      const beforeAuthorityFrameB = jsonClone(authorityFrameB);
      const beforeAuthorityFrameBLedger = jsonClone(authorityFrameBLedger);
      const beforeAuthorityFrameALedger = jsonClone(authorityFrameALedger);
      const beforeTable = jsonClone(table);
      const beforeAuthorityTable = jsonClone(authorityTable);
      const withoutAuthorityOperationMembership = (value: unknown): ValueRecord => {
        const clone = jsonClone(value) as ValueRecord;
        delete clone.operationIds;
        if (clone.snapshot && typeof clone.snapshot === 'object' && !Array.isArray(clone.snapshot)) {
          delete (clone.snapshot as ValueRecord).operationIds;
        }
        return clone;
      };
      const withoutAuthorityOperationFrameId = (value: unknown): ValueRecord => {
        const clone = jsonClone(value) as ValueRecord;
        delete clone.frameId;
        if (clone.snapshot && typeof clone.snapshot === 'object' && !Array.isArray(clone.snapshot)) {
          delete (clone.snapshot as ValueRecord).frameId;
        }
        return clone;
      };
      if (operation && authorityOperation && authorityFrameBLedger && authorityFrameALedger) {
        operation.frameId = frameB.id;
        authorityOperation.frameId = frameB.id;
        (authorityOperation.snapshot as ValueRecord).frameId = frameB.id;
        frameA.operationIds = (frameA.operationIds as string[]).filter(id => id !== operation.id);
        frameB.operationIds = [...(frameB.operationIds as string[]), String(operation.id)];
        authorityFrameALedger.operationIds = (authorityFrameALedger.operationIds as string[]).filter(id => id !== operation.id);
        authorityFrameBLedger.operationIds = [...(authorityFrameBLedger.operationIds as string[]), String(operation.id)];
        authorityFrameA.operationIds = (authorityFrameA.operationIds as string[]).filter(id => id !== operation.id);
        authorityFrameB.operationIds = [...(authorityFrameB.operationIds as string[]), String(operation.id)];
      }
      return {
        fixtureReady: frameA !== undefined
          && frameB !== undefined
          && table !== undefined
          && operation !== undefined
          && authorityOperation !== undefined
          && authorityFrameBLedger !== undefined
          && frameA.id !== frameB.id
          && frameA.width === frameB.width
          && operation.frameId === frameB.id
          && authorityOperation.frameId === frameB.id
          && (authorityOperation.snapshot as ValueRecord).frameId === frameB.id
          && operation.tableId === table.id
          && table.frameId === frameA.id
          && operation.frameId !== table.frameId
          && (frameA.operationIds as string[]).includes(operationId as string) === false
          && (frameB.operationIds as string[]).includes(operationId as string)
          && (authorityFrameA.operationIds as string[]).includes(operationId as string) === false
          && (authorityFrameB.operationIds as string[]).includes(operationId as string)
          && (authorityFrameALedger.operationIds as string[]).includes(operationId as string) === false
          && (authorityFrameBLedger.operationIds as string[]).includes(operationId as string)
          && sameJson(operation.kernel, beforeOperation?.kernel)
          && sameJson(operation.metadata, beforeOperation?.metadata)
          && sameJson(table, beforeTable)
          && sameJson(authorityTable, beforeAuthorityTable)
          && sameJson(withoutTopologyKey(frameA, 'operationIds'), withoutTopologyKey(beforeFrameA, 'operationIds'))
          && sameJson(withoutTopologyKey(frameB, 'operationIds'), withoutTopologyKey(beforeFrameB, 'operationIds'))
          && sameJson(withoutTopologyKey(authorityFrameA, 'operationIds'), withoutTopologyKey(beforeAuthorityFrameA, 'operationIds'))
          && sameJson(withoutTopologyKey(authorityFrameB, 'operationIds'), withoutTopologyKey(beforeAuthorityFrameB, 'operationIds'))
          && sameJson(withoutAuthorityOperationMembership(authorityFrameALedger), withoutAuthorityOperationMembership(beforeAuthorityFrameALedger))
          && sameJson(withoutAuthorityOperationMembership(authorityFrameBLedger), withoutAuthorityOperationMembership(beforeAuthorityFrameBLedger))
          && sameJson(withoutTopologyKey(operation, 'frameId'), withoutTopologyKey(beforeOperation, 'frameId'))
          && sameJson(withoutAuthorityOperationFrameId(authorityOperation), withoutAuthorityOperationFrameId(beforeAuthorityOperation)),
        conditionDiagnostics: {
          frameAWidth: frameA !== undefined && frameA.width === frameB?.width,
          operationTableMatch: operation !== undefined && operation.tableId === table?.id,
          tableOwnerBefore: table !== undefined && table.frameId === frameA?.id,
          operationOwnerAfter: operation !== undefined && operation.frameId === frameB?.id,
          authorityOperationOwnerAfter: authorityOperation !== undefined && authorityOperation.frameId === frameB?.id,
          authoritySnapshotOwnerAfter: authorityOperation !== undefined
            && (authorityOperation.snapshot as ValueRecord).frameId === frameB?.id,
          programARemoved: operation !== undefined && frameA !== undefined && !(frameA.operationIds as string[]).includes(operationId as string),
          programBAdded: operation !== undefined && frameB !== undefined && (frameB.operationIds as string[]).includes(operationId as string),
          authoritySnapshotARemoved: operation !== undefined && authorityFrameA !== undefined
            && !(authorityFrameA.operationIds as string[]).includes(operationId as string),
          authoritySnapshotBAdded: operation !== undefined && authorityFrameB !== undefined
            && (authorityFrameB.operationIds as string[]).includes(operationId as string),
          authorityLedgerARemoved: operation !== undefined && authorityFrameALedger !== undefined
            && !(authorityFrameALedger.operationIds as string[]).includes(operationId as string),
          authorityLedgerBAdded: operation !== undefined && authorityFrameBLedger !== undefined
            && (authorityFrameBLedger.operationIds as string[]).includes(operationId as string),
          kernelUnchanged: operation !== undefined && sameJson(operation.kernel, beforeOperation?.kernel),
          metadataUnchanged: operation !== undefined && sameJson(operation.metadata, beforeOperation?.metadata),
          tableUnchanged: table !== undefined && sameJson(table, beforeTable),
          authorityTableUnchanged: authorityTable !== undefined && sameJson(authorityTable, beforeAuthorityTable),
          programAUnchanged: sameJson(withoutTopologyKey(frameA, 'operationIds'), withoutTopologyKey(beforeFrameA, 'operationIds')),
          programBUnchanged: sameJson(withoutTopologyKey(frameB, 'operationIds'), withoutTopologyKey(beforeFrameB, 'operationIds')),
          authoritySnapshotAUnchanged: sameJson(withoutTopologyKey(authorityFrameA, 'operationIds'), withoutTopologyKey(beforeAuthorityFrameA, 'operationIds')),
          authoritySnapshotBUnchanged: sameJson(withoutTopologyKey(authorityFrameB, 'operationIds'), withoutTopologyKey(beforeAuthorityFrameB, 'operationIds')),
          authorityLedgerAUnchanged: sameJson(withoutAuthorityOperationMembership(authorityFrameALedger), withoutAuthorityOperationMembership(beforeAuthorityFrameALedger)),
          authorityLedgerBUnchanged: sameJson(withoutAuthorityOperationMembership(authorityFrameBLedger), withoutAuthorityOperationMembership(beforeAuthorityFrameBLedger)),
          operationUnchanged: sameJson(withoutTopologyKey(operation, 'frameId'), withoutTopologyKey(beforeOperation, 'frameId')),
          authorityOperationUnchanged: sameJson(withoutAuthorityOperationFrameId(authorityOperation), withoutAuthorityOperationFrameId(beforeAuthorityOperation)),
        },
        frameAId: frameA?.id,
        frameBId: frameB?.id,
        frameAWidth: frameA?.width,
        frameBWidth: frameB?.width,
        tableId: table?.id,
        operationId: operation?.id,
        frameIdAfter: operation?.frameId,
        tableIdAfter: operation?.tableId,
        tableFrameId: table?.frameId,
        ownerContradiction: operation !== undefined && operation.frameId !== table?.frameId,
        frameAMembershipRemoved: operation !== undefined && !(frameA.operationIds as string[]).includes(operationId as string),
        frameBMembershipAdded: operation !== undefined && frameB !== undefined && (frameB.operationIds as string[]).includes(operationId as string),
        tableKernelStateUnchanged: table !== undefined && sameJson(table.kernelState, beforeTable.kernelState),
      };
    }),
    makeOwnerConsistencyAttack('rejects table identity parent drift to another frame', (candidateProgram, candidateAuthority, fixture) => {
      const frames = candidateProgram.frames as ValueRecord[];
      const tables = candidateProgram.tables as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityTables = authorityNodes.tables as ValueRecord[];
      const frameA = frames[fixture.frameAIndex];
      const frameB = frames[fixture.frameBIndex];
      const table = tables[fixture.tableAIndex];
      const authorityTable = authorityTables[fixture.authorityTableAIndex]?.snapshot as ValueRecord;
      const beforeTable = jsonClone(table);
      const beforeAuthorityTable = jsonClone(authorityTable);
      const tableIdentity = table.identity as ValueRecord;
      const authorityTableIdentity = authorityTable.identity as ValueRecord;
      const beforeParentPath = tableIdentity?.parentPath;
      const frameAPath = (frameA.identity as ValueRecord | undefined)?.path;
      const frameBPath = (frameB.identity as ValueRecord | undefined)?.path;
      if (tableIdentity && authorityTableIdentity && typeof frameBPath === 'string') {
        tableIdentity.parentPath = frameBPath;
        authorityTableIdentity.parentPath = frameBPath;
      }
      const withoutParentPath = (value: unknown): ValueRecord => {
        const clone = jsonClone(value) as ValueRecord;
        if (clone.identity && typeof clone.identity === 'object') delete (clone.identity as ValueRecord).parentPath;
        return clone;
      };
      return {
        fixtureReady: frameA !== undefined
          && frameB !== undefined
          && table !== undefined
          && authorityTable !== undefined
          && typeof frameAPath === 'string'
          && typeof frameBPath === 'string'
          && frameAPath !== frameBPath
          && beforeParentPath === frameAPath
          && tableIdentity.parentPath === frameBPath
          && authorityTableIdentity.parentPath === frameBPath
          && table.frameId === frameA.id
          && authorityTable.frameId === frameA.id
          && tableIdentity.parentPath !== frameAPath
          && sameJson(withoutParentPath(table), withoutParentPath(beforeTable))
          && sameJson(withoutParentPath(authorityTable), withoutParentPath(beforeAuthorityTable)),
        frameAId: frameA?.id,
        frameBId: frameB?.id,
        tableId: table?.id,
        beforeParentPath,
        frameAPath,
        frameBPath,
        afterParentPath: tableIdentity?.parentPath,
        beforeParentMatchedFrameA: beforeParentPath === frameAPath,
        afterParentMatchedFrameB: tableIdentity?.parentPath === frameBPath,
        ownerFrameIdUnchanged: table?.frameId === frameA?.id,
        parentDisagreesWithOwner: tableIdentity?.parentPath !== frameAPath,
        noCollateralTableMutation: table !== undefined
          && authorityTable !== undefined
          && sameJson(withoutParentPath(table), withoutParentPath(beforeTable))
          && sameJson(withoutParentPath(authorityTable), withoutParentPath(beforeAuthorityTable)),
      };
    }),
    makeOwnerConsistencyAttack('rejects known table listed by a second non-owner frame', (candidateProgram, candidateAuthority, fixture) => {
      const frames = candidateProgram.frames as ValueRecord[];
      const tables = candidateProgram.tables as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityFrames = authorityNodes.frames as ValueRecord[];
      const frameA = frames[fixture.frameAIndex];
      const frameB = frames[fixture.frameBIndex];
      const table = tables[fixture.tableAIndex];
      const authorityFrameA = authorityFrames[fixture.authorityFrameAIndex]?.snapshot as ValueRecord;
      const authorityFrameB = authorityFrames[fixture.authorityFrameBIndex]?.snapshot as ValueRecord;
      const beforeFrameA = jsonClone(frameA);
      const beforeFrameB = jsonClone(frameB);
      const beforeAuthorityFrameA = jsonClone(authorityFrameA);
      const beforeAuthorityFrameB = jsonClone(authorityFrameB);
      const beforeTable = jsonClone(table);
      const beforeTableIds = [...(frameB.tableIds as string[])];
      frameB.tableIds = [...beforeTableIds, String(table.id)];
      authorityFrameB.tableIds = [...beforeTableIds, String(table.id)];
      const knownTableIds = new Set(tables.map(candidate => String(candidate.id)));
      return {
        fixtureReady: frameA !== undefined
          && frameB !== undefined
          && table !== undefined
          && authorityFrameA !== undefined
          && authorityFrameB !== undefined
          && frameA.id !== frameB.id
          && knownTableIds.has(String(table.id))
          && (frameA.tableIds as string[]).includes(String(table.id))
          && beforeTable.frameId === frameA.id
          && table.frameId === frameA.id
          && !beforeTableIds.includes(String(table.id))
          && (frameB.tableIds as string[]).includes(String(table.id))
          && (authorityFrameB.tableIds as string[]).includes(String(table.id))
          && (frameB.tableIds as string[]).length === beforeTableIds.length + 1
          && sameJson(frameB.tableIds, authorityFrameB.tableIds)
          && sameJson(frameA, beforeFrameA)
          && sameJson(authorityFrameA, beforeAuthorityFrameA)
          && sameJson(table, beforeTable)
          && sameJson(withoutTopologyKey(frameB, 'tableIds'), withoutTopologyKey(beforeFrameB, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrameB, 'tableIds'), withoutTopologyKey(beforeAuthorityFrameB, 'tableIds')),
        frameAId: frameA?.id,
        frameBId: frameB?.id,
        tableId: table?.id,
        tableKnown: knownTableIds.has(String(table?.id)),
        ownerFrameId: table?.frameId,
        secondFrameListsTable: (frameB?.tableIds as string[] | undefined)?.includes(String(table?.id)),
        beforeSecondFrameTableIdCount: beforeTableIds.length,
        afterSecondFrameTableIdCount: (frameB?.tableIds as string[] | undefined)?.length,
        cardinalityDelta: ((frameB?.tableIds as string[] | undefined)?.length || 0) - beforeTableIds.length,
        ownerUnchanged: table?.frameId === frameA?.id,
        noCollateral: frameA !== undefined
          && table !== undefined
          && authorityFrameA !== undefined
          && authorityFrameB !== undefined
          && sameJson(frameA, beforeFrameA)
          && sameJson(authorityFrameA, beforeAuthorityFrameA)
          && sameJson(table, beforeTable)
          && sameJson(withoutTopologyKey(frameB, 'tableIds'), withoutTopologyKey(beforeFrameB, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrameB, 'tableIds'), withoutTopologyKey(beforeAuthorityFrameB, 'tableIds')),
      };
    }),
    makeOwnerConsistencyAttack('rejects reversed owning-frame table order', (candidateProgram, candidateAuthority, fixture) => {
      const frames = candidateProgram.frames as ValueRecord[];
      const authorityNodes = candidateAuthority.nodes as ValueRecord;
      const authorityFrames = authorityNodes.frames as ValueRecord[];
      const frameA = frames[fixture.frameAIndex];
      const authorityFrameA = authorityFrames[fixture.authorityFrameAIndex]?.snapshot as ValueRecord;
      const beforeFrameA = jsonClone(frameA);
      const beforeAuthorityFrameA = jsonClone(authorityFrameA);
      const beforeTableIds = [...(frameA.tableIds as string[])];
      const afterTableIds = [...beforeTableIds].reverse();
      frameA.tableIds = afterTableIds;
      authorityFrameA.tableIds = [...afterTableIds];
      const distinctApplied = new Set(beforeTableIds).size === beforeTableIds.length
        && beforeTableIds.length >= 2;
      return {
        fixtureReady: frameA !== undefined
          && authorityFrameA !== undefined
          && distinctApplied
          && beforeTableIds.join('|') !== afterTableIds.join('|')
          && afterTableIds.length === beforeTableIds.length
          && sameJson(afterTableIds, [...beforeTableIds].reverse())
          && sameJson(afterTableIds, authorityFrameA.tableIds)
          && sameJson(withoutTopologyKey(frameA, 'tableIds'), withoutTopologyKey(beforeFrameA, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrameA, 'tableIds'), withoutTopologyKey(beforeAuthorityFrameA, 'tableIds')),
        frameAId: frameA?.id,
        beforeTableIds,
        afterTableIds,
        distinctTableCount: new Set(beforeTableIds).size,
        beforeCount: beforeTableIds.length,
        afterCount: (frameA?.tableIds as string[] | undefined)?.length,
        cardinalityDelta: ((frameA?.tableIds as string[] | undefined)?.length || 0) - beforeTableIds.length,
        orderChanged: beforeTableIds.join('|') !== afterTableIds.join('|'),
        exactReverse: sameJson(afterTableIds, [...beforeTableIds].reverse()),
        noCollateralFrameMutation: frameA !== undefined
          && authorityFrameA !== undefined
          && sameJson(withoutTopologyKey(frameA, 'tableIds'), withoutTopologyKey(beforeFrameA, 'tableIds'))
          && sameJson(withoutTopologyKey(authorityFrameA, 'tableIds'), withoutTopologyKey(beforeAuthorityFrameA, 'tableIds')),
      };
    }),
  ];
  for (const attack of ownerConsistencyAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'owner consistency attack fixture missing' };
    check(`8A.6 Phase 2A.1 fail-first ${attack.name}`,
      ownerConsistencyBaseline.valid === true
        && attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: ownerConsistencyBaseline, proof: attack.proof, validation }));
  }
  const expandedSourceInvocationIds = new Set(
    identityAttackProgram.localExpansion?.invocations.map(invocation => invocation.sourceInvocationId) || [],
  );
  const unconsumedInvocation = identityInvocations.find(candidate => !expandedSourceInvocationIds.has(candidate.id));
  const unconsumedFunction = identityFunctions.find(candidate =>
    !identityAttackProgram.localExpansion?.invocations.some(invocation => invocation.calleeDeclarationId === candidate.id)
      && identityInvocations.some(invocation => invocation.calleeDeclarationId === candidate.id));
  const unconsumedParameterFunction = identityFunctions.find(candidate =>
    candidate.parameters.length > 0
      && !identityAttackProgram.localExpansion?.invocations.some(invocation => invocation.calleeDeclarationId === candidate.id));
  const otherUnconsumedParameterFunction = identityFunctions.find(candidate =>
    candidate.id !== unconsumedParameterFunction?.id
      && candidate.parameters.length > 0
      && !identityAttackProgram.localExpansion?.invocations.some(invocation => invocation.calleeDeclarationId === candidate.id));
  const auditLocalParameterId = (
    declarationId: string,
    index: number,
    source: ValueRecord,
  ): string => {
    const start = source.start as ValueRecord;
    const end = source.end as ValueRecord;
    return `local-parameter:${declarationId}|${index}|${start.offset}|${end.offset}`;
  };
  const auditLocalFunctionId = (source: ValueRecord): string => {
    const start = source.start as ValueRecord;
    const end = source.end as ValueRecord;
    return `local-function:${source.file}|${source.sourcePath || ''}|${start.offset}|${end.offset}`;
  };
  const auditLocalInvocationId = (source: ValueRecord): string => {
    const start = source.start as ValueRecord;
    const end = source.end as ValueRecord;
    return `local-invocation:${source.file}|${source.sourcePath || ''}|${start.offset}|${end.offset}`;
  };
  const auditJsonEqual = (left: unknown, right: unknown): boolean =>
    JSON.stringify(left) === JSON.stringify(right);
  type IdentityAttackCase = {
    readonly name: string;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly proof: ValueRecord;
  };
  const identityMutationAttack = (
    name: string,
    mutate: (identities: ValueRecord, before: ValueRecord) => ValueRecord,
  ): IdentityAttackCase => {
    if (!identityAttackAuthority) {
      return {
        name,
        authority: undefined,
        proof: { fixtureReady: false, reason: 'local identity authority fixture missing' },
      };
    }
    const candidate = jsonClone(identityAttackAuthority) as unknown as ValueRecord;
    const identities = candidate.localIdentities as ValueRecord;
    const before = jsonClone(identities) as ValueRecord;
    const proof = mutate(identities, before);
    return {
      name,
      authority: freezeClone(candidate) as unknown as EvidenceAuthorityLike,
      proof,
    };
  };
  const identityAuthorityAttacks: readonly IdentityAttackCase[] = [
    identityMutationAttack('reverse authority function order', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const beforeIds = beforeFunctions.map(candidate => String(candidate.id));
      const after = [...functions].reverse();
      const afterIds = after.map(candidate => String(candidate.id));
      identities.functions = after;
      return {
        fixtureReady: beforeFunctions.length >= 2
          && new Set(beforeIds).size >= 2
          && beforeIds.join('|') !== afterIds.join('|')
          && after.length === beforeFunctions.length
          && !auditJsonEqual(after, beforeFunctions),
        selectedArray: 'functions',
        beforeCount: beforeFunctions.length,
        afterCount: after.length,
        cardinalityDelta: after.length - beforeFunctions.length,
        distinctEntryCount: new Set(beforeIds).size,
        orderChanged: beforeIds.join('|') !== afterIds.join('|'),
      };
    }),
    identityMutationAttack('reverse authority invocation order', (identities, before) => {
      const beforeInvocations = before.invocations as ValueRecord[];
      const invocations = identities.invocations as ValueRecord[];
      const beforeIds = beforeInvocations.map(candidate => String(candidate.id));
      const after = [...invocations].reverse();
      const afterIds = after.map(candidate => String(candidate.id));
      identities.invocations = after;
      return {
        fixtureReady: beforeInvocations.length >= 2
          && new Set(beforeIds).size >= 2
          && beforeIds.join('|') !== afterIds.join('|')
          && after.length === beforeInvocations.length
          && !auditJsonEqual(after, beforeInvocations),
        selectedArray: 'invocations',
        beforeCount: beforeInvocations.length,
        afterCount: after.length,
        cardinalityDelta: after.length - beforeInvocations.length,
        distinctEntryCount: new Set(beforeIds).size,
        orderChanged: beforeIds.join('|') !== afterIds.join('|'),
      };
    }),
    identityMutationAttack('reverse a real declaration parameter order', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const functionIndex = beforeFunctions.findIndex(candidate =>
        Array.isArray(candidate.parameters) && (candidate.parameters as ValueRecord[]).length >= 2);
      const beforeFunction = functionIndex >= 0 ? beforeFunctions[functionIndex] : undefined;
      const functionValue = functionIndex >= 0 ? functions[functionIndex] : undefined;
      const beforeParameters = beforeFunction?.parameters as ValueRecord[] | undefined;
      const parameters = functionValue?.parameters as ValueRecord[] | undefined;
      const beforeIds = beforeParameters?.map(candidate => String(candidate.id)) || [];
      const after = parameters ? [...parameters].reverse() : [];
      const afterIds = after.map(candidate => String(candidate.id));
      if (functionValue) functionValue.parameters = after;
      return {
        fixtureReady: functionValue !== undefined
          && beforeParameters !== undefined
          && parameters !== undefined
          && beforeParameters.length >= 2
          && new Set(beforeIds).size >= 2
          && beforeIds.join('|') !== afterIds.join('|')
          && after.length === beforeParameters.length
          && !auditJsonEqual(after, beforeParameters),
        declarationId: functionValue?.id,
        selectedArray: 'functions[].parameters',
        beforeCount: beforeParameters?.length,
        afterCount: after.length,
        cardinalityDelta: after.length - (beforeParameters?.length || 0),
        distinctEntryCount: new Set(beforeIds).size,
        orderChanged: beforeIds.join('|') !== afterIds.join('|'),
      };
    }),
    identityMutationAttack('remove an unconsumed invocation', (identities, before) => {
      const beforeInvocations = before.invocations as ValueRecord[];
      const invocations = identities.invocations as ValueRecord[];
      const removedId = unconsumedInvocation?.id;
      const after = removedId === undefined
        ? [...invocations]
        : invocations.filter(candidate => candidate.id !== removedId);
      identities.invocations = after;
      return {
        fixtureReady: removedId !== undefined
          && beforeInvocations.some(candidate => candidate.id === removedId)
          && after.length === beforeInvocations.length - 1
          && !after.some(candidate => candidate.id === removedId)
          && auditJsonEqual(after, beforeInvocations.filter(candidate => candidate.id !== removedId)),
        selectedArray: 'invocations',
        selectedInvocationId: removedId,
        beforeCount: beforeInvocations.length,
        afterCount: after.length,
        cardinalityDelta: after.length - beforeInvocations.length,
        removed: !after.some(candidate => candidate.id === removedId),
      };
    }),
    identityMutationAttack('remove an unconsumed function and its invocation', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const beforeInvocations = before.invocations as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const invocations = identities.invocations as ValueRecord[];
      const removedId = unconsumedFunction?.id;
      const ownedInvocationIds = removedId === undefined
        ? []
        : beforeInvocations
          .filter(candidate => candidate.calleeDeclarationId === removedId)
          .map(candidate => String(candidate.id));
      const afterFunctions = removedId === undefined
        ? [...functions]
        : functions.filter(candidate => candidate.id !== removedId);
      const afterInvocations = removedId === undefined
        ? [...invocations]
        : invocations.filter(candidate => candidate.calleeDeclarationId !== removedId);
      identities.functions = afterFunctions;
      identities.invocations = afterInvocations;
      return {
        fixtureReady: removedId !== undefined
          && beforeFunctions.some(candidate => candidate.id === removedId)
          && ownedInvocationIds.length >= 1
          && afterFunctions.length === beforeFunctions.length - 1
          && afterInvocations.length === beforeInvocations.length - ownedInvocationIds.length
          && !afterFunctions.some(candidate => candidate.id === removedId)
          && !afterInvocations.some(candidate => candidate.calleeDeclarationId === removedId)
          && auditJsonEqual(afterFunctions, beforeFunctions.filter(candidate => candidate.id !== removedId))
          && auditJsonEqual(afterInvocations, beforeInvocations.filter(candidate => candidate.calleeDeclarationId !== removedId)),
        selectedFunctionId: removedId,
        selectedArray: 'functions and invocations',
        beforeFunctionCount: beforeFunctions.length,
        afterFunctionCount: afterFunctions.length,
        functionCardinalityDelta: afterFunctions.length - beforeFunctions.length,
        beforeInvocationCount: beforeInvocations.length,
        afterInvocationCount: afterInvocations.length,
        invocationCardinalityDelta: afterInvocations.length - beforeInvocations.length,
        removedInvocationCount: ownedInvocationIds.length,
      };
    }),
    identityMutationAttack('duplicate a parameter', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const functionIndex = beforeFunctions.findIndex(candidate =>
        Array.isArray(candidate.parameters) && (candidate.parameters as ValueRecord[]).length > 0);
      const beforeFunction = functionIndex >= 0 ? beforeFunctions[functionIndex] : undefined;
      const functionValue = functionIndex >= 0 ? functions[functionIndex] : undefined;
      const beforeParameters = beforeFunction?.parameters as ValueRecord[] | undefined;
      const parameters = functionValue?.parameters as ValueRecord[] | undefined;
      if (parameters && parameters.length > 0) {
        parameters.unshift(parameters[0]);
      }
      return {
        fixtureReady: functionValue !== undefined
          && beforeParameters !== undefined
          && parameters !== undefined
          && beforeParameters.length > 0
          && parameters.length === beforeParameters.length + 1
          && auditJsonEqual(parameters[0], beforeParameters[0])
          && auditJsonEqual(parameters.slice(1), beforeParameters),
        declarationId: functionValue?.id,
        selectedArray: 'functions[].parameters',
        beforeCount: beforeParameters?.length,
        afterCount: parameters?.length,
        cardinalityDelta: (parameters?.length || 0) - (beforeParameters?.length || 0),
        duplicatedParameterId: parameters?.[0]?.id,
      };
    }),
    identityMutationAttack('remove a parameter', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const functionIndex = beforeFunctions.findIndex(candidate =>
        Array.isArray(candidate.parameters) && (candidate.parameters as ValueRecord[]).length > 0);
      const beforeFunction = functionIndex >= 0 ? beforeFunctions[functionIndex] : undefined;
      const functionValue = functionIndex >= 0 ? functions[functionIndex] : undefined;
      const beforeParameters = beforeFunction?.parameters as ValueRecord[] | undefined;
      const parameters = functionValue?.parameters as ValueRecord[] | undefined;
      const removedId = parameters?.[0]?.id;
      if (parameters) parameters.shift();
      return {
        fixtureReady: functionValue !== undefined
          && beforeParameters !== undefined
          && parameters !== undefined
          && beforeParameters.length > 0
          && removedId !== undefined
          && parameters.length === beforeParameters.length - 1
          && !parameters.some(candidate => candidate.id === removedId)
          && auditJsonEqual(parameters, beforeParameters.slice(1)),
        declarationId: functionValue?.id,
        selectedArray: 'functions[].parameters',
        removedParameterId: removedId,
        beforeCount: beforeParameters?.length,
        afterCount: parameters?.length,
        cardinalityDelta: (parameters?.length || 0) - (beforeParameters?.length || 0),
      };
    }),
    identityMutationAttack('move a parameter source outside its declaration and recompute its deterministic ID', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const functionIndex = beforeFunctions.findIndex(candidate =>
        Array.isArray(candidate.parameters) && (candidate.parameters as ValueRecord[]).length > 0);
      const beforeFunction = functionIndex >= 0 ? beforeFunctions[functionIndex] : undefined;
      const functionValue = functionIndex >= 0 ? functions[functionIndex] : undefined;
      const externalFunction = functions.find(candidate => candidate.id !== functionValue?.id);
      const beforeParameter = beforeFunction && (beforeFunction.parameters as ValueRecord[])[0];
      const parameter = functionValue && (functionValue.parameters as ValueRecord[])[0];
      if (functionValue && externalFunction && parameter) {
        const source = jsonClone(externalFunction.source) as ValueRecord;
        parameter.source = source;
        parameter.id = auditLocalParameterId(
          String(parameter.declarationId),
          Number(parameter.index),
          source,
        );
      }
      const source = parameter?.source as ValueRecord | undefined;
      const ownerSource = functionValue?.source as ValueRecord | undefined;
      const beforeSource = beforeParameter?.source as ValueRecord | undefined;
      const recomputedId = parameter && source
        ? auditLocalParameterId(String(parameter.declarationId), Number(parameter.index), source)
        : undefined;
      return {
        fixtureReady: functionValue !== undefined
          && externalFunction !== undefined
          && parameter !== undefined
          && beforeParameter !== undefined
          && source !== undefined
          && ownerSource !== undefined
          && beforeSource !== undefined
          && !auditJsonEqual(source, beforeSource)
          && auditJsonEqual(source, externalFunction.source)
          && !auditJsonEqual(source, ownerSource)
          && parameter.id !== beforeParameter.id
          && parameter.id === recomputedId,
        declarationId: functionValue?.id,
        externalDeclarationId: externalFunction?.id,
        selectedField: 'parameter.source and parameter.id',
        sourceChanged: beforeSource !== undefined && source !== undefined && !auditJsonEqual(source, beforeSource),
        ownerChanged: ownerSource !== undefined && source !== undefined && !auditJsonEqual(source, ownerSource),
        idRecomputed: parameter?.id === recomputedId,
      };
    }),
    identityMutationAttack('change an unconsumed invocation expression', (identities, before) => {
      const beforeInvocations = before.invocations as ValueRecord[];
      const invocations = identities.invocations as ValueRecord[];
      const invocationIndex = beforeInvocations.findIndex(candidate => candidate.id === unconsumedInvocation?.id);
      const beforeInvocation = invocationIndex >= 0 ? beforeInvocations[invocationIndex] : undefined;
      const invocation = invocationIndex >= 0 ? invocations[invocationIndex] : undefined;
      const beforeExpression = beforeInvocation?.expression;
      if (invocation) invocation.expression = 'forgedUnconsumed()';
      return {
        fixtureReady: invocation !== undefined
          && beforeExpression !== undefined
          && invocation.expression === 'forgedUnconsumed()'
          && invocation.expression !== beforeExpression
          && invocation.id === beforeInvocation?.id,
        selectedInvocationId: invocation?.id,
        selectedField: 'invocation.expression',
        beforeExpression,
        afterExpression: invocation?.expression,
        expressionChanged: invocation?.expression !== beforeExpression,
      };
    }),
    identityMutationAttack('move a parameter to the wrong declaration and recompute declarationId/id consistently', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const functionValue = functions.find(candidate => candidate.id === unconsumedParameterFunction?.id);
      const wrongOwner = functions.find(candidate => candidate.id === otherUnconsumedParameterFunction?.id);
      const beforeFunction = beforeFunctions.find(candidate => candidate.id === functionValue?.id);
      const beforeWrongOwner = beforeFunctions.find(candidate => candidate.id === wrongOwner?.id);
      const parameter = functionValue && (functionValue.parameters as ValueRecord[])[0];
      const beforeParameter = beforeFunction && (beforeFunction.parameters as ValueRecord[])[0];
      const beforeFunctionCount = (beforeFunction?.parameters as ValueRecord[] | undefined)?.length;
      const beforeWrongOwnerCount = (beforeWrongOwner?.parameters as ValueRecord[] | undefined)?.length;
      let movedParameter: ValueRecord | undefined;
      if (functionValue && wrongOwner && parameter) {
        functionValue.parameters = (functionValue.parameters as ValueRecord[]).slice(1);
        movedParameter = {
          ...parameter,
          declarationId: wrongOwner.id,
          id: auditLocalParameterId(
            String(wrongOwner.id),
            Number(parameter.index),
            parameter.source as ValueRecord,
          ),
        };
        wrongOwner.parameters = [...(wrongOwner.parameters as ValueRecord[]), movedParameter];
      }
      const afterFunctionCount = (functionValue?.parameters as ValueRecord[] | undefined)?.length;
      const afterWrongOwnerCount = (wrongOwner?.parameters as ValueRecord[] | undefined)?.length;
      const recomputedId = movedParameter
        ? auditLocalParameterId(
          String(movedParameter.declarationId),
          Number(movedParameter.index),
          movedParameter.source as ValueRecord,
        )
        : undefined;
      return {
        fixtureReady: functionValue !== undefined
          && wrongOwner !== undefined
          && parameter !== undefined
          && beforeParameter !== undefined
          && movedParameter !== undefined
          && functionValue.id !== wrongOwner.id
          && beforeFunctionCount !== undefined
          && beforeWrongOwnerCount !== undefined
          && afterFunctionCount === beforeFunctionCount - 1
          && afterWrongOwnerCount === beforeWrongOwnerCount + 1
          && movedParameter.declarationId === wrongOwner.id
          && movedParameter.declarationId !== beforeParameter.declarationId
          && movedParameter.id !== beforeParameter.id
          && movedParameter.id === recomputedId,
        originalDeclarationId: functionValue?.id,
        newDeclarationId: movedParameter?.declarationId,
        selectedField: 'parameter.declarationId and parameter.id',
        ownerChanged: movedParameter?.declarationId !== beforeParameter?.declarationId,
        originalOwnerCardinalityDelta: (afterFunctionCount || 0) - (beforeFunctionCount || 0),
        newOwnerCardinalityDelta: (afterWrongOwnerCount || 0) - (beforeWrongOwnerCount || 0),
        idRecomputed: movedParameter?.id === recomputedId,
      };
    }),
    identityMutationAttack('add an extra source-shaped invocation', (identities, before) => {
      const beforeInvocations = before.invocations as ValueRecord[];
      const invocations = identities.invocations as ValueRecord[];
      const original = invocations[0];
      let extra: ValueRecord | undefined;
      if (original) {
        const source = jsonClone(original.source) as ValueRecord;
        const start = source.start as ValueRecord;
        const end = source.end as ValueRecord;
        start.offset = Number(start.offset) + 1;
        end.offset = Number(end.offset) + 1;
        extra = {
          ...original,
          id: auditLocalInvocationId(source),
          source,
          expression: 'forgedExtraInvocation()',
        };
        invocations.push(extra);
      }
      return {
        fixtureReady: original !== undefined
          && extra !== undefined
          && invocations.length === beforeInvocations.length + 1
          && auditJsonEqual(invocations.slice(0, -1), beforeInvocations)
          && !auditJsonEqual(extra.source, original.source)
          && extra.id === auditLocalInvocationId(extra.source as ValueRecord)
          && extra.expression !== original.expression,
        selectedArray: 'invocations',
        beforeCount: beforeInvocations.length,
        afterCount: invocations.length,
        cardinalityDelta: invocations.length - beforeInvocations.length,
        addedInvocationId: extra?.id,
        sourceChanged: extra !== undefined && original !== undefined && !auditJsonEqual(extra.source, original.source),
        idRecomputed: extra?.id === auditLocalInvocationId(extra.source as ValueRecord),
      };
    }),
    identityMutationAttack('sparse local-identity array control', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const hadEntry = Object.prototype.hasOwnProperty.call(functions, 0);
      if (functions.length > 0) delete functions[0];
      return {
        fixtureReady: beforeFunctions.length > 0
          && hadEntry
          && functions.length === beforeFunctions.length
          && !Object.prototype.hasOwnProperty.call(functions, 0)
          && !(0 in functions),
        selectedArray: 'functions',
        beforeCount: beforeFunctions.length,
        afterCount: functions.length,
        cardinalityDelta: functions.length - beforeFunctions.length,
        holeAtIndex: 0,
        actualHole: !Object.prototype.hasOwnProperty.call(functions, 0) && !(0 in functions),
      };
    }),
    (() => {
      if (!identityAttackAuthority) {
        return {
          name: 'cyclic local-identity control',
          authority: undefined,
          proof: { fixtureReady: false, reason: 'local identity authority fixture missing' },
        };
      }
      const candidate = jsonClone(identityAttackAuthority) as unknown as ValueRecord;
      const identities = candidate.localIdentities as ValueRecord;
      const functions = identities.functions as ValueRecord[];
      const functionValue = functions[0];
      const existingParameters = functionValue?.parameters;
      const beforeLocalIdentityKeys = Object.keys(identities).sort();
      if (functionValue) functionValue.parameters = functions;
      const afterLocalIdentityKeys = Object.keys(identities).sort();
      const cyclePresent = functionValue !== undefined
        && Array.isArray(existingParameters)
        && functionValue.parameters === functions
        && functions.includes(functionValue);
      return {
        name: 'cyclic local-identity control',
        authority: freezeCycleClone(candidate) as unknown as EvidenceAuthorityLike,
        proof: {
          fixtureReady: cyclePresent && beforeLocalIdentityKeys.join('|') === afterLocalIdentityKeys.join('|'),
          selectedField: 'functions[0].parameters',
          existingField: Array.isArray(existingParameters),
          cyclePath: 'localIdentities.functions[0].parameters -> localIdentities.functions',
          cyclePresent,
          localIdentityKeysUnchanged: beforeLocalIdentityKeys.join('|') === afterLocalIdentityKeys.join('|'),
          localIdentityKeys: afterLocalIdentityKeys,
        },
      };
    })(),
    identityMutationAttack('unsafe source-offset control', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const functionValue = functions[0];
      const beforeFunction = beforeFunctions[0];
      const beforeSource = beforeFunction?.source as ValueRecord | undefined;
      const source = functionValue?.source as ValueRecord | undefined;
      const beforeOffset = (beforeSource?.start as ValueRecord | undefined)?.offset;
      const start = source?.start as ValueRecord | undefined;
      const end = source?.end as ValueRecord | undefined;
      const unsafeStart = Number.MAX_SAFE_INTEGER + 1;
      const unsafeEnd = Number.MAX_SAFE_INTEGER + 2;
      if (functionValue && source && start && end) {
        start.offset = unsafeStart;
        end.offset = unsafeEnd;
        functionValue.id = auditLocalFunctionId(source);
      }
      return {
        fixtureReady: functionValue !== undefined
          && source !== undefined
          && start !== undefined
          && end !== undefined
          && Number.isSafeInteger(Number(beforeOffset))
          && start.offset === unsafeStart
          && end.offset === unsafeEnd
          && !Number.isSafeInteger(Number(start.offset))
          && Number(start.offset) > Number.MAX_SAFE_INTEGER
          && functionValue.id === auditLocalFunctionId(source),
        selectedField: 'function.source.start.offset',
        beforeOffset,
        afterOffset: start?.offset,
        afterEndOffset: end?.offset,
        outsideSafeIntegerBounds: start !== undefined
          && !Number.isSafeInteger(Number(start.offset))
          && Number(start.offset) > Number.MAX_SAFE_INTEGER,
        idRecomputed: functionValue?.id === (source ? auditLocalFunctionId(source) : undefined),
      };
    }),
    identityMutationAttack('duplicate local-function-ID control', (identities, before) => {
      const beforeFunctions = before.functions as ValueRecord[];
      const functions = identities.functions as ValueRecord[];
      const original = functions[0];
      const originalBefore = original ? jsonClone(original) as ValueRecord : undefined;
      const clone = original ? jsonClone(original) as ValueRecord : undefined;
      if (clone) functions.push(clone);
      return {
        fixtureReady: original !== undefined
          && originalBefore !== undefined
          && clone !== undefined
          && functions.length === beforeFunctions.length + 1
          && auditJsonEqual(clone, originalBefore)
          && auditJsonEqual(clone, original)
          && clone.id === original.id
          && clone.id === auditLocalFunctionId(clone.source as ValueRecord),
        selectedArray: 'functions',
        beforeCount: beforeFunctions.length,
        afterCount: functions.length,
        cardinalityDelta: functions.length - beforeFunctions.length,
        appendedClone: clone !== undefined && originalBefore !== undefined && auditJsonEqual(clone, originalBefore),
        duplicateId: clone?.id === original?.id,
        sourceBoundId: clone?.id === (clone ? auditLocalFunctionId(clone.source as ValueRecord) : undefined),
      };
    }),
  ];
  for (const attack of identityAuthorityAttacks) {
    const validation = attack.authority
      ? safeSchemaPairValidation(identityAttackProgram, attack.authority)
      : { threw: false, valid: false, reason: 'local identity authority fixture missing' };
    const cycleReason = attack.name === 'cyclic local-identity control'
      ? typeof validation.reason === 'string' && validation.reason.toLowerCase().includes('cycle')
      : true;
    check(`8A.6 fail-first local identity ${attack.name}`,
      identityBaseValidation.valid === true
        && attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false
        && cycleReason,
      detail({ base: identityBaseValidation, validation, proof: attack.proof, unconsumedInvocation, unconsumedFunction }));
  }

  type B119IdentityAttack = {
    readonly name: string;
    readonly program: X4UiLayoutProgram | undefined;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly proof: ValueRecord;
  };
  const b119IdentityAttack = (
    name: string,
    mutate: (programIdentities: ValueRecord, authorityIdentities: ValueRecord) => ValueRecord,
  ): B119IdentityAttack => {
    const sourceProgram = resultProgram(b119NestedLocalInvocationResult);
    const sourceAuthority = evidenceAuthorityOf(b119NestedLocalInvocationResult);
    if (!sourceProgram || !sourceAuthority) {
      return {
        name,
        program: undefined,
        authority: undefined,
        proof: { fixtureReady: false, reason: 'B119 nested local-invocation fixture is not issued' },
      };
    }
    const candidateProgram = jsonClone(sourceProgram);
    const candidateAuthority = jsonClone(sourceAuthority);
    const proof = mutate(
      candidateProgram.localIdentities as unknown as ValueRecord,
      candidateAuthority.localIdentities as unknown as ValueRecord,
    );
    return {
      name,
      program: freezeClone(candidateProgram),
      authority: freezeClone(candidateAuthority),
      proof,
    };
  };
  const b119LocalIdentityAttacks: readonly B119IdentityAttack[] = [
    b119IdentityAttack('ambiguous repeated invocation identity', (programIdentities, authorityIdentities) => {
      const programInvocations = programIdentities.invocations as ValueRecord[];
      const authorityInvocations = authorityIdentities.invocations as ValueRecord[];
      const original = programInvocations[0];
      const authorityOriginal = authorityInvocations[0];
      if (original && authorityOriginal) {
        programInvocations.splice(1, 0, jsonClone(original));
        authorityInvocations.splice(1, 0, jsonClone(authorityOriginal));
      }
      return {
        fixtureReady: original !== undefined
          && authorityOriginal !== undefined
          && programInvocations.length === authorityInvocations.length
          && programInvocations.length >= 2
          && programInvocations[0].id === programInvocations[1].id
          && authorityInvocations[0].id === authorityInvocations[1].id,
        duplicateProgramId: original?.id,
        duplicateAuthorityId: authorityOriginal?.id,
      };
    }),
    b119IdentityAttack('cross-bound invocation source identity', (programIdentities, authorityIdentities) => {
      const programInvocations = programIdentities.invocations as ValueRecord[];
      const authorityInvocations = authorityIdentities.invocations as ValueRecord[];
      const programInvocation = programInvocations[0];
      const authorityInvocation = authorityInvocations[0];
      const programSource = programInvocation?.source as ValueRecord | undefined;
      const authoritySource = authorityInvocation?.source as ValueRecord | undefined;
      if (programInvocation && authorityInvocation && programSource && authoritySource) {
        const forgedProgramSource = jsonClone(programSource) as ValueRecord;
        const forgedAuthoritySource = jsonClone(authoritySource) as ValueRecord;
        forgedProgramSource.file = 'forged-b119-cross-bound.lua';
        forgedAuthoritySource.file = 'forged-b119-cross-bound.lua';
        programInvocation.source = forgedProgramSource;
        authorityInvocation.source = forgedAuthoritySource;
        programInvocation.id = auditLocalInvocationId(forgedProgramSource);
        authorityInvocation.id = auditLocalInvocationId(forgedAuthoritySource);
      }
      return {
        fixtureReady: programInvocation !== undefined
          && authorityInvocation !== undefined
          && programSource !== undefined
          && authoritySource !== undefined
          && (programInvocation.source as ValueRecord).file === 'forged-b119-cross-bound.lua'
          && (authorityInvocation.source as ValueRecord).file === 'forged-b119-cross-bound.lua'
          && programInvocation.id === auditLocalInvocationId(programInvocation.source as ValueRecord)
          && authorityInvocation.id === auditLocalInvocationId(authorityInvocation.source as ValueRecord),
        programSourceFile: (programInvocation?.source as ValueRecord | undefined)?.file,
        authoritySourceFile: (authorityInvocation?.source as ValueRecord | undefined)?.file,
        programIdRecomputed: programInvocation?.id === (programInvocation
          ? auditLocalInvocationId(programInvocation.source as ValueRecord)
          : undefined),
        authorityIdRecomputed: authorityInvocation?.id === (authorityInvocation
          ? auditLocalInvocationId(authorityInvocation.source as ValueRecord)
          : undefined),
      };
    }),
    b119IdentityAttack('out-of-range invocation source offsets', (programIdentities, authorityIdentities) => {
      const programInvocations = programIdentities.invocations as ValueRecord[];
      const authorityInvocations = authorityIdentities.invocations as ValueRecord[];
      const programInvocation = programInvocations[0];
      const authorityInvocation = authorityInvocations[0];
      const programSource = programInvocation?.source as ValueRecord | undefined;
      const authoritySource = authorityInvocation?.source as ValueRecord | undefined;
      if (programInvocation && authorityInvocation && programSource && authoritySource) {
        const forgedProgramSource = jsonClone(programSource) as ValueRecord;
        const forgedAuthoritySource = jsonClone(authoritySource) as ValueRecord;
        (forgedProgramSource.start as ValueRecord).offset = Number.MAX_SAFE_INTEGER + 1;
        (forgedProgramSource.end as ValueRecord).offset = Number.MAX_SAFE_INTEGER + 2;
        (forgedAuthoritySource.start as ValueRecord).offset = Number.MAX_SAFE_INTEGER + 1;
        (forgedAuthoritySource.end as ValueRecord).offset = Number.MAX_SAFE_INTEGER + 2;
        programInvocation.source = forgedProgramSource;
        authorityInvocation.source = forgedAuthoritySource;
        programInvocation.id = auditLocalInvocationId(forgedProgramSource);
        authorityInvocation.id = auditLocalInvocationId(forgedAuthoritySource);
      }
      const programStart = (programInvocation?.source as ValueRecord | undefined)?.start as ValueRecord | undefined;
      const authorityStart = (authorityInvocation?.source as ValueRecord | undefined)?.start as ValueRecord | undefined;
      return {
        fixtureReady: programStart !== undefined
          && authorityStart !== undefined
          && programStart.offset === Number.MAX_SAFE_INTEGER + 1
          && authorityStart.offset === Number.MAX_SAFE_INTEGER + 1
          && !Number.isSafeInteger(Number(programStart.offset))
          && !Number.isSafeInteger(Number(authorityStart.offset)),
        programStartOffset: programStart?.offset,
        authorityStartOffset: authorityStart?.offset,
        programIdRecomputed: programInvocation?.id === (programInvocation
          ? auditLocalInvocationId(programInvocation.source as ValueRecord)
          : undefined),
        authorityIdRecomputed: authorityInvocation?.id === (authorityInvocation
          ? auditLocalInvocationId(authorityInvocation.source as ValueRecord)
          : undefined),
      };
    }),
  ];
  for (const attack of b119LocalIdentityAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'B119 nested local-invocation fixture not issued' };
    check(`B119 local identity control rejects ${attack.name}`,
      attack.proof.fixtureReady !== true
        || (validation.threw === false && validation.valid === false),
      detail({ attack: attack.name, validation, proof: attack.proof }));
  }

  const b119PropagatedLayerProgram = resultProgram(b119PropagatedLayerResult);
  const b119PropagatedLayerAuthority = evidenceAuthorityOf(b119PropagatedLayerResult);
  const b119LayerOperationIndex = b119PropagatedLayerProgram?.operations.findIndex(candidate => {
    const semantics = candidate.metadata.semantics as ValueRecord;
    const layer = semantics.layer as ValueRecord | undefined;
    return layer?.sourceLiteral !== undefined;
  }) ?? -1;
  const b119ForgedDirectLayerPair = b119PropagatedLayerProgram && b119PropagatedLayerAuthority
    ? (() => {
      const candidateProgram = jsonClone(b119PropagatedLayerProgram);
      const candidateAuthority = jsonClone(b119PropagatedLayerAuthority);
      const programOperation = (candidateProgram.operations as unknown as ValueRecord[])[b119LayerOperationIndex];
      const authorityOperation = (candidateAuthority.operations as unknown as ValueRecord[])[b119LayerOperationIndex];
      const mutateLayerLocation = (operationValue: ValueRecord): boolean => {
        const metadata = operationValue.metadata as ValueRecord | undefined;
        const semantics = metadata?.semantics as ValueRecord | undefined;
        const layer = semantics?.layer as ValueRecord | undefined;
        const location = layer?.location as ValueRecord | undefined;
        if (!layer || !location) return false;
        layer.location = { ...location, file: 'forged-b119-direct-layer.lua' };
        return true;
      };
      const programChanged = programOperation ? mutateLayerLocation(programOperation) : false;
      const authorityChanged = authorityOperation
        ? mutateLayerLocation(authorityOperation.snapshot as ValueRecord)
        : false;
      return {
        program: freezeClone(candidateProgram),
        authority: freezeClone(candidateAuthority),
        proof: {
          fixtureReady: programChanged && authorityChanged,
          operationIndex: b119LayerOperationIndex,
          programChanged,
          authorityChanged,
        },
      };
    })()
    : undefined;
  const b119ForgedDirectLayerValidation = b119ForgedDirectLayerPair
    ? safeSchemaPairValidation(b119ForgedDirectLayerPair.program, b119ForgedDirectLayerPair.authority)
    : { threw: false, valid: false, reason: 'B119 propagated-layer fixture not issued' };
  check('B119 forged direct-layer location mismatch still refuses',
    b119ForgedDirectLayerPair?.proof.fixtureReady !== true
      || (b119ForgedDirectLayerValidation.threw === false && b119ForgedDirectLayerValidation.valid === false),
    detail({ validation: b119ForgedDirectLayerValidation, proof: b119ForgedDirectLayerPair?.proof }));

  type AuditKernelMutation = {
    readonly mutations: number;
    readonly helperTableStateMutations: number;
    readonly otherMetricStateMutations: number;
  };
  const isAuditHelperTableState = (value: ValueRecord): boolean =>
    typeof value.frameWidth === 'number'
      && value.provenance !== undefined
      && value.metrics !== undefined
      && value.properties !== undefined
      && Array.isArray(value.columns)
      && Array.isArray(value.rows)
      && Array.isArray(value.rowGroups)
      && typeof value.createdWithScrollBar === 'boolean'
      && typeof value.final === 'boolean'
      && Array.isArray(value.diagnostics);
  const mutateAuditKernelStates = (
    candidate: unknown,
    field: 'uiScale' | 'scrollbarWidth' | 'frameWidth',
  ): AuditKernelMutation => {
    let mutations = 0;
    let helperTableStateMutations = 0;
    let otherMetricStateMutations = 0;
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const record = value as ValueRecord;
      const helperTableState = isAuditHelperTableState(record);
      if (field === 'frameWidth' && helperTableState) {
        record.frameWidth = (record.frameWidth as number) + 1;
        mutations += 1;
        helperTableStateMutations += 1;
      }
      const metrics = record.metrics;
      if (field !== 'frameWidth' && metrics && typeof metrics === 'object' && !Array.isArray(metrics)) {
        const metricRecord = metrics as ValueRecord;
        if (typeof metricRecord[field] === 'number') {
          metricRecord[field] = (metricRecord[field] as number) + (field === 'uiScale' ? 0.25 : 1);
          mutations += 1;
          if (helperTableState) helperTableStateMutations += 1;
          else otherMetricStateMutations += 1;
        }
      }
      Object.values(record).forEach(visit);
    };
    visit(candidate);
    return { mutations, helperTableStateMutations, otherMetricStateMutations };
  };
  const coordinatedKernelMetricPair = (
    field: 'uiScale' | 'scrollbarWidth' | 'frameWidth',
  ): {
    readonly program: X4UiLayoutProgram;
    readonly authority: EvidenceAuthorityLike;
    readonly mutations: number;
    readonly fixtureReady: boolean;
    readonly programMutations: number;
    readonly authorityMutations: number;
    readonly programHelperTableStateMutations: number;
    readonly authorityHelperTableStateMutations: number;
    readonly programOtherMetricStateMutations: number;
    readonly authorityOtherMetricStateMutations: number;
    readonly targetFamily: 'kernel-state metrics' | 'HelperTableState.frameWidth only';
  } | undefined => {
    if (!allKindAuthority) return undefined;
    const candidateProgram = jsonClone(allKindProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as ValueRecord;
    const programScopes = [
      candidateProgram.frames,
      candidateProgram.tables,
      candidateProgram.rows,
      candidateProgram.cells,
      candidateProgram.operations,
    ];
    const authorityScopes = [
      (candidateAuthority.nodes as ValueRecord).frames,
      (candidateAuthority.nodes as ValueRecord).tables,
      (candidateAuthority.nodes as ValueRecord).rows,
      (candidateAuthority.nodes as ValueRecord).cells,
      candidateAuthority.operations,
    ];
    const aggregate = (scopes: readonly unknown[]): AuditKernelMutation => scopes.reduce<AuditKernelMutation>((summary, scope) => {
      const mutation = mutateAuditKernelStates(scope, field);
      return {
        mutations: summary.mutations + mutation.mutations,
        helperTableStateMutations: summary.helperTableStateMutations + mutation.helperTableStateMutations,
        otherMetricStateMutations: summary.otherMetricStateMutations + mutation.otherMetricStateMutations,
      };
    }, { mutations: 0, helperTableStateMutations: 0, otherMetricStateMutations: 0 });
    const programMutation = aggregate(programScopes);
    const authorityMutation = aggregate(authorityScopes);
    const frameWidthOnly = field === 'frameWidth';
    const fixtureReady = programMutation.mutations > 0
      && authorityMutation.mutations > 0
      && programMutation.helperTableStateMutations > 0
      && authorityMutation.helperTableStateMutations > 0
      && (!frameWidthOnly
        || (programMutation.otherMetricStateMutations === 0 && authorityMutation.otherMetricStateMutations === 0));
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      mutations: programMutation.mutations + authorityMutation.mutations,
      fixtureReady,
      programMutations: programMutation.mutations,
      authorityMutations: authorityMutation.mutations,
      programHelperTableStateMutations: programMutation.helperTableStateMutations,
      authorityHelperTableStateMutations: authorityMutation.helperTableStateMutations,
      programOtherMetricStateMutations: programMutation.otherMetricStateMutations,
      authorityOtherMetricStateMutations: authorityMutation.otherMetricStateMutations,
      targetFamily: frameWidthOnly ? 'HelperTableState.frameWidth only' : 'kernel-state metrics',
    };
  };
  const coordinatedTableFrameWidthPair = (): {
    readonly program: X4UiLayoutProgram;
    readonly authority: EvidenceAuthorityLike;
    readonly mutations: number;
    readonly fixtureReady: boolean;
    readonly programTableNodeMutations: number;
    readonly authorityTableNodeMutations: number;
    readonly programHelperTableStateMutations: number;
    readonly authorityHelperTableStateMutations: number;
    readonly targetFamily: 'table-node.frameWidth only';
  } | undefined => {
    if (!allKindAuthority) return undefined;
    const candidateProgram = jsonClone(allKindProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as ValueRecord;
    const tables = candidateProgram.tables as ValueRecord[];
    const authorityTables = (candidateAuthority.nodes as ValueRecord).tables as ValueRecord[];
    let programTableNodeMutations = 0;
    let authorityTableNodeMutations = 0;
    let programHelperTableStateMutations = 0;
    let authorityHelperTableStateMutations = 0;
    tables.forEach((table, index) => {
      const authoritySnapshot = authorityTables[index]?.snapshot as ValueRecord | undefined;
      if (table && authoritySnapshot) {
        if (isAuditHelperTableState(table)) programHelperTableStateMutations += 1;
        if (isAuditHelperTableState(authoritySnapshot)) authorityHelperTableStateMutations += 1;
        const beforeProgramFrameWidth = table.frameWidth;
        const beforeAuthorityFrameWidth = authoritySnapshot.frameWidth;
        table.frameWidth = Number(table.frameWidth || 0) + 1;
        authoritySnapshot.frameWidth = Number(authoritySnapshot.frameWidth || 0) + 1;
        if (!Object.is(table.frameWidth, beforeProgramFrameWidth)) programTableNodeMutations += 1;
        if (!Object.is(authoritySnapshot.frameWidth, beforeAuthorityFrameWidth)) authorityTableNodeMutations += 1;
      }
    });
    const mutations = programTableNodeMutations + authorityTableNodeMutations;
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      mutations,
      fixtureReady: programTableNodeMutations > 0
        && authorityTableNodeMutations > 0
        && programHelperTableStateMutations === 0
        && authorityHelperTableStateMutations === 0,
      programTableNodeMutations,
      authorityTableNodeMutations,
      programHelperTableStateMutations,
      authorityHelperTableStateMutations,
      targetFamily: 'table-node.frameWidth only',
    };
  };
  const kernelReconciliationAttacks: readonly [
    string,
    {
      readonly program: X4UiLayoutProgram;
      readonly authority: EvidenceAuthorityLike;
      readonly mutations: number;
      readonly fixtureReady: boolean;
      readonly programMutations?: number;
      readonly authorityMutations?: number;
      readonly programTableNodeMutations?: number;
      readonly authorityTableNodeMutations?: number;
      readonly programHelperTableStateMutations: number;
      readonly authorityHelperTableStateMutations: number;
      readonly programOtherMetricStateMutations?: number;
      readonly authorityOtherMetricStateMutations?: number;
      readonly targetFamily: string;
    } | undefined,
  ][] = [
    ['coordinated kernel metrics.uiScale drift', coordinatedKernelMetricPair('uiScale')],
    ['coordinated kernel metrics.scrollbarWidth drift', coordinatedKernelMetricPair('scrollbarWidth')],
    ['coordinated kernel frameWidth drift', coordinatedKernelMetricPair('frameWidth')],
    ['coordinated table-node frameWidth drift', coordinatedTableFrameWidthPair()],
  ];
  for (const [name, pair] of kernelReconciliationAttacks) {
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'kernel reconciliation fixture missing' };
    check(`8A.6 fail-first kernel/profile ${name}`,
      pair?.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({
        validation,
        fixtureReady: pair?.fixtureReady,
        mutations: pair?.mutations,
        programMutations: pair?.programMutations ?? pair?.programTableNodeMutations,
        authorityMutations: pair?.authorityMutations ?? pair?.authorityTableNodeMutations,
        programHelperTableStateMutations: pair?.programHelperTableStateMutations,
        authorityHelperTableStateMutations: pair?.authorityHelperTableStateMutations,
        programOtherMetricStateMutations: pair?.programOtherMetricStateMutations,
        authorityOtherMetricStateMutations: pair?.authorityOtherMetricStateMutations,
        targetFamily: pair?.targetFamily,
      }));
  }

  const kernelEightFiveAttacks: readonly [string, ReturnType<typeof coordinatedKernelPair>][] = [
    ['negative column width', coordinatedKernelPair(state => {
      const column = (state.columns as ValueRecord[])[0];
      if (column) column.width = -1;
    })],
    ['negative column weight', coordinatedKernelPair(state => {
      const column = (state.columns as ValueRecord[])[0];
      if (column) column.weight = -1;
    })],
    ['default column colspan zero', coordinatedKernelPair(state => {
      const column = (state.columns as ValueRecord[])[0];
      if (column) column.colspan = 0;
    })],
    ['populated rows while table is pre-final', coordinatedKernelPair(state => {
      state.final = false;
    })],
  ];
  for (const [name, pair] of kernelEightFiveAttacks) {
    const validation = safeSchemaPairValidation(pair.program, pair.authority);
    check(`8A.5 kernel invariant rejects ${name}`,
      validation.threw === false && validation.valid === false,
      detail({ attack: name, validation }));
  }
  const profileTruthGradeResults = (['supplied', 'captured', 'unverified-default'] as const).map(truthGrade =>
    projectX4UiLayoutProgram(
      allKindModel,
      topTarget(allKindModel),
      profileFor(allKindModel, { truthGrade }),
    ));
  const preFinalSource = [
    'local menu = { name = "PreFinal", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'frame:addTable(1, { width = 80 })',
  ].join('\n');
  const preFinalModel = buildX4UiCallModel(input(preFinalSource, 'selftest/pre-final-state.lua'));
  const preFinalResult = projectX4UiLayoutProgram(preFinalModel, topTarget(preFinalModel), profileFor(preFinalModel));
  const preFinalProgram = programOf(preFinalResult);
  const preFinalAuthority = evidenceAuthorityOf(preFinalResult);
  check('positive profile truth grades and pre-final zero-row state remain pair-valid',
    profileTruthGradeResults.every(result => {
      const candidateProgram = resultProgram(result);
      const candidateAuthority = evidenceAuthorityOf(result);
      return candidateProgram !== undefined
        && candidateAuthority !== undefined
        && safeSchemaPairValidation(candidateProgram, candidateAuthority).valid === true;
    })
      && preFinalAuthority !== undefined
      && preFinalProgram.tables.some(candidate => candidate.kernelState?.final === false && candidate.kernelState.rows.length === 0)
      && safeSchemaPairValidation(preFinalProgram, preFinalAuthority).valid === true,
    detail({
      truthGrades: profileTruthGradeResults.map(result => result.program?.profile.truthGrade),
      preFinal: preFinalProgram.tables.map(candidate => candidate.kernelState),
      validation: preFinalAuthority && safeSchemaPairValidation(preFinalProgram, preFinalAuthority),
    }));
  check('positive 8A.5 direct fixtures and expanded output remain pair-valid',
    parameterIdentityAuthority !== undefined
      && safeSchemaPairValidation(parameterIdentityProgram, parameterIdentityAuthority).valid === true
      && directDynamicPropertyAuthority !== undefined
      && safeSchemaPairValidation(directDynamicPropertyProgram, directDynamicPropertyAuthority).valid === true
      && localExpansionAuthority !== undefined
      && safeSchemaPairValidation(localExpansionProgram, localExpansionAuthority).valid === true,
    detail({
      parameter: parameterIdentityAuthority && safeSchemaPairValidation(parameterIdentityProgram, parameterIdentityAuthority),
      directDynamic: directDynamicPropertyAuthority && safeSchemaPairValidation(directDynamicPropertyProgram, directDynamicPropertyAuthority),
      expansion: localExpansionAuthority && safeSchemaPairValidation(localExpansionProgram, localExpansionAuthority),
    }));

  const sampledExpansionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width, label)',
    '  local table = frame:addTable(1, { width = width })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText(label, { height = 12 })',
    '  return width',
    'end',
    'local function display(tw, dynamicText)',
    '  local menu = { name = "Samples", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, Helper.scaleX(20), "scaled")',
    '  panel(frame, tw, dynamicText)',
    '  local consumed = panel(frame, 40, "consumed")',
    '  local dependent = frame:addTable(1, { width = consumed })',
    '  dependent:addRow(false, {})',
    'end',
  ].join('\n');
  const sampledExpansionModel = buildX4UiCallModel(input(
    sampledExpansionSource,
    'selftest/sampled-local-expansion.lua',
  ));
  const sampledExpansionTarget = namedTarget(sampledExpansionModel, 'display');
  const sampledExpansionProfile = profileFor(sampledExpansionModel, {
    minTextHeight: 12,
    uiScale: 1.5,
    localExpansion: { maxDepth: 3, maxInvocations: 8 },
  });
  const unsampledExpansion = programOf(projectX4UiLayoutProgram(
    sampledExpansionModel,
    sampledExpansionTarget,
    sampledExpansionProfile,
  ));
  const consumedReturnSample = unsampledExpansion.sampleCatalog.entries.find(candidate =>
    candidate.expression === 'panel(frame, 40, "consumed")');
  const widthSample = unsampledExpansion.sampleCatalog.entries.find(candidate => candidate.expression === 'tw');
  const textSample = unsampledExpansion.sampleCatalog.entries.find(candidate => candidate.expression === 'dynamicText');
  check('direct scale parameters apply exactly while dynamic scalar/text and consumed returns stay sample points',
    unsampledExpansion.tables.length === 4
      && unsampledExpansion.tables[0].requestedWidth === 30
      && factProvenance(unsampledExpansion.tables[0].descriptorFacts.requestedWidth) === 'direct-helper-scale'
      && unsampledExpansion.tables[1].kernelState === undefined
      && unsampledExpansion.tables[2].requestedWidth === 40
      && unsampledExpansion.tables[3].kernelState === undefined
      && Boolean(widthSample && textSample && consumedReturnSample)
      && consumedReturnSample?.source.start.offset === sampledExpansionModel.localInvocations.find(
        candidate => candidate.source.start.offset === consumedReturnSample.source.start.offset)?.source.start.offset
      && unsampledExpansion.operations.findIndex(candidate => candidate.kind === 'scaleX')
        < unsampledExpansion.operations.findIndex(candidate => candidate.kind === 'addTable'),
    detail({ tables: unsampledExpansion.tables, catalog: unsampledExpansion.sampleCatalog, operations: unsampledExpansion.operations }));
  if (!widthSample || !textSample || !consumedReturnSample) throw new Error('sampled local expansion catalog incomplete');
  const sampledExpansionInput: X4UiLayoutPreviewSampleInput = {
    catalogId: unsampledExpansion.sampleCatalog.id,
    source: unsampledExpansion.sampleCatalog.sourceIdentity,
    values: [
      { id: widthSample.id, value: 55 },
      { id: textSample.id, value: 'sampled text' },
      { id: consumedReturnSample.id, value: 65 },
    ],
  };
  const sampledExpansionProgram = programOf(projectX4UiLayoutProgram(
    sampledExpansionModel,
    sampledExpansionTarget,
    sampledExpansionProfile,
    sampledExpansionInput,
  ));
  check('exact-range samples bind helper parameters and one consumed return without inferring return semantics',
    sampledExpansionProgram.tables.map(candidate => candidate.requestedWidth).join(',') === '30,55,40,65'
      && sampledExpansionProgram.tables.every(candidate => candidate.kernelState?.rows.length === 1)
      && sampledExpansionProgram.cells.some(candidate =>
        factValue(candidate.descriptorFacts.primaryContent) === 'sampled text'
        && factProvenance(candidate.descriptorFacts.primaryContent) === 'preview-sample')
      && sampledExpansionProgram.previewSampleBindings.length === 3
      && sampledExpansionProgram.previewSampleBindings.every(candidate => candidate.status === 'consumed')
      && sampledExpansionProgram.localExpansion?.invocations.filter(candidate => candidate.status === 'expanded').length === 3,
    detail({
      tables: sampledExpansionProgram.tables,
      cells: sampledExpansionProgram.cells,
      bindings: sampledExpansionProgram.previewSampleBindings,
      invocations: sampledExpansionProgram.localExpansion?.invocations,
    }));

  const repeatedScaleSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width)',
    '  local table = frame:addTable(1, { width = Helper.scaleX(width) })',
    '  table:addRow(false, {})',
    'end',
    'local function display()',
    '  local menu = { name = "RepeatedScale", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, 20)',
    '  panel(frame, 30)',
    'end',
  ].join('\n');
  const repeatedScaleModel = buildX4UiCallModel(input(repeatedScaleSource, 'selftest/repeated-scale-expansion.lua'));
  const repeatedScaleProgram = programOf(projectX4UiLayoutProgram(
    repeatedScaleModel,
    namedTarget(repeatedScaleModel, 'display'),
    profileFor(repeatedScaleModel, {
      uiScale: 1.5,
      localExpansion: { maxDepth: 2, maxInvocations: 4 },
    }),
  ));
  check('repeated helper instances scope one direct scale source to their distinct caller arguments',
    repeatedScaleProgram.tables.map(candidate => candidate.requestedWidth).join(',') === '30,45'
      && repeatedScaleProgram.operations.filter(candidate => candidate.kind === 'scaleX')
        .map(candidate => candidate.scale?.value).join(',') === '30,45'
      && repeatedScaleProgram.operations.filter(candidate => candidate.kind === 'scaleX')
        .every(candidate => candidate.status === 'applied')
      && repeatedScaleProgram.sampleCatalog.entries.every(candidate =>
        !candidate.expression.includes('Helper.scaleX')),
    detail({ tables: repeatedScaleProgram.tables, operations: repeatedScaleProgram.operations }));

  const branchExpansionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function tabPanel(frame, width, label)',
    '  local table = frame:addTable(1, { width = width })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText(label, { height = 10 })',
    'end',
    'local function display(tab)',
    '  local menu = { name = "Branches", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  if tab == "first" then',
    '    tabPanel(frame, 40, "first")',
    '  else',
    '    tabPanel(frame, 50, "second")',
    '  end',
    '  if false then tabPanel(frame, 60, "never") end',
    '  while tab do tabPanel(frame, 70, "loop") end',
    'end',
  ].join('\n');
  const branchExpansionModel = buildX4UiCallModel(input(branchExpansionSource, 'selftest/branch-expansion.lua'));
  const branchExpansionTarget = namedTarget(branchExpansionModel, 'display');
  const branchExpansionProfile = profileFor(branchExpansionModel, {
    minTextHeight: 10,
    localExpansion: { maxDepth: 2, maxInvocations: 4 },
  });
  const unselectedBranchProgram = programOf(projectX4UiLayoutProgram(
    branchExpansionModel,
    branchExpansionTarget,
    branchExpansionProfile,
  ));
  const branchCatalog = unselectedBranchProgram.localExpansion?.previewPathCatalog;
  if (!branchCatalog) throw new Error('branch preview catalog missing');
  const thenPath = branchCatalog.entries.find(candidate => candidate.arm === 'then'
    && candidate.reachability !== 'unreachable');
  const elsePath = branchCatalog.entries.find(candidate => candidate.arm === 'else');
  const unreachablePath = branchCatalog.entries.find(candidate => candidate.reachability === 'unreachable');
  if (!thenPath || !elsePath || !unreachablePath) throw new Error('branch preview catalog entries missing');
  check('conditional, looped, and unreachable local invocations are recorded without kernel mutation when unselected',
    unselectedBranchProgram.tables.length === 0
      && unselectedBranchProgram.localExpansion?.invocations.filter(candidate => candidate.status === 'conditional').length === 2
      && unselectedBranchProgram.localExpansion.invocations.some(candidate => candidate.status === 'looped')
      && unselectedBranchProgram.localExpansion.invocations.some(candidate => candidate.status === 'unreachable')
      && Object.isFrozen(branchCatalog)
      && branchCatalog.entries.every(candidate =>
        candidate.id.includes(branchCatalog.sourceIdentity.sha256)
        && candidate.id.includes(candidate.boundaryId)
        && candidate.id.includes(candidate.armId)),
    detail({ catalog: branchCatalog, invocations: unselectedBranchProgram.localExpansion?.invocations }));
  const selectedPathInput: X4UiLayoutPreviewPathSelectionInput = {
    catalogId: branchCatalog.id,
    source: branchCatalog.sourceIdentity,
    selections: [{ id: thenPath.id, boundaryId: thenPath.boundaryId, armId: thenPath.armId }],
  };
  const selectedPathInputBefore = JSON.stringify(selectedPathInput);
  const selectedBranchResult = projectX4UiLayoutProgram(
    branchExpansionModel,
    branchExpansionTarget,
    branchExpansionProfile,
    undefined,
    selectedPathInput,
  );
  const selectedBranchProgram = programOf(selectedBranchResult);
  const selectedBranchAuthority = evidenceAuthorityOf(selectedBranchResult);
  check('one exact preview arm expands while the other arm, loop, and unreachable call stay non-applied',
    selectedBranchProgram.tables.length === 1
      && selectedBranchProgram.tables[0].requestedWidth === 40
      && selectedBranchProgram.tables[0].kernelState?.rows.length === 1
      && selectedBranchProgram.cells.some(candidate => factValue(candidate.descriptorFacts.primaryContent) === 'first')
      && selectedBranchProgram.localExpansion?.previewPathSelections.length === 1
      && selectedBranchProgram.localExpansion.previewPathSelections[0].provenance === 'preview-only'
      && Object.isFrozen(selectedBranchProgram.localExpansion.previewPathSelections)
      && JSON.stringify(selectedPathInput) === selectedPathInputBefore
      && selectedBranchProgram.localExpansion.invocations.filter(candidate => candidate.status === 'expanded').length === 1
      && selectedBranchProgram.localExpansion.invocations.filter(candidate => candidate.status === 'conditional').length === 1
      && selectedBranchProgram.status === 'partial'
      && selectedBranchProgram.verification.game === X4_UI_LAYOUT_GAME_TRUTH,
    detail({ tables: selectedBranchProgram.tables, expansion: selectedBranchProgram.localExpansion }));
  const selectedExpandedInvocation = selectedBranchAuthority?.expansion?.invocations.find(
    invocation => invocation.status === 'expanded',
  );
  const selectedExpansionClone = selectedBranchAuthority ? jsonClone(selectedBranchAuthority) : undefined;
  const selectedExpansionAttacks = selectedExpansionClone && selectedExpandedInvocation
    ? [
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          selections: [],
        },
      },
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          catalog: {
            ...selectedExpansionClone.expansion.catalog,
            entries: selectedExpansionClone.expansion.catalog.entries.map((entry, index) => index === 0
              ? { ...entry, id: `${entry.id}:forged` }
              : entry),
          },
        },
      },
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          invocations: selectedExpansionClone.expansion.invocations.map(invocation => invocation.id === selectedExpandedInvocation.id
            ? { ...invocation, operationIds: ['operation:forged'] }
            : invocation),
        },
      },
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          invocations: selectedExpansionClone.expansion.invocations.map(invocation => invocation.id === selectedExpandedInvocation.id
            ? { ...invocation, sourceInvocationId: `${invocation.sourceInvocationId}:forged` }
            : invocation),
        },
      },
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          invocations: selectedExpansionClone.expansion.invocations.map(invocation => invocation.id === selectedExpandedInvocation.id
            ? { ...invocation, id: `${invocation.id}:forged` }
            : invocation),
        },
      },
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          invocations: selectedExpansionClone.expansion.invocations.map(invocation => invocation.id === selectedExpandedInvocation.id
            ? { ...invocation, ancestry: [...invocation.ancestry, 'forged'] }
            : invocation),
        },
      },
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          invocations: selectedExpansionClone.expansion.invocations.map(invocation => invocation.id === selectedExpandedInvocation.id
            ? { ...invocation, depth: invocation.depth + 1 }
            : invocation),
        },
      },
      {
        ...selectedExpansionClone,
        expansion: selectedExpansionClone.expansion && {
          ...selectedExpansionClone.expansion,
          invocations: selectedExpansionClone.expansion.invocations.map(invocation => invocation.id === selectedExpandedInvocation.id
            ? { ...invocation, operationIds: [] }
            : invocation),
        },
      },
    ].map(candidate => freezeClone(candidate) as EvidenceAuthorityLike)
    : [];
  const selectedAuthorityValidation = selectedBranchAuthority
    ? validateX4UiLayoutEvidencePair(selectedBranchProgram, selectedBranchAuthority)
    : undefined;
  const selectedAttackValidations = selectedExpansionAttacks.map(candidate =>
    validateX4UiLayoutEvidencePair(selectedBranchProgram, candidate));
  check('selected local expansion has exact reciprocal catalog, selection, invocation, ancestry, depth, and operation authority',
    selectedBranchAuthority !== undefined
      && selectedAuthorityValidation?.valid === true
      && selectedExpandedInvocation !== undefined
      && selectedExpansionAttacks.length === 8
      && selectedAttackValidations.every(candidate => !candidate.valid),
    detail({
      valid: selectedAuthorityValidation,
      attacks: selectedAttackValidations.map(candidate =>
        candidate.valid ? 'accepted' : ('reason' in candidate ? candidate.reason : 'invalid')),
    }));
  const selectedProgramExpansion = selectedBranchProgram.localExpansion;
  const selectedAuthorityExpansion = selectedBranchAuthority?.expansion;
  const selectedProgramSelection = selectedProgramExpansion?.previewPathSelections[0];
  const selectedProgramInvocation = selectedProgramExpansion?.invocations.find(invocation =>
    invocation.status === 'expanded');
  const selectedAuthorityInvocation = selectedAuthorityExpansion?.invocations.find(invocation =>
    invocation.status === 'expanded');
  const mutateSelectedProgramExpansion = (
    expansion: Record<string, unknown>,
  ): X4UiLayoutProgram => freezeClone({
    ...selectedBranchProgram,
    localExpansion: expansion,
  }) as unknown as X4UiLayoutProgram;
  const selectedProgramSelectionFieldMutations = selectedProgramSelection
    ? [
      { id: `${selectedProgramSelection.id}:forged` },
      { boundaryId: `${selectedProgramSelection.boundaryId}:forged` },
      { armId: `${selectedProgramSelection.armId}:forged` },
      { boundary: { ...selectedProgramSelection.boundary, start: { ...selectedProgramSelection.boundary.start, offset: selectedProgramSelection.boundary.start.offset + 1 } } },
      { provenance: 'source' },
    ] as const
    : [];
  const selectedProgramSelectionAttacks = selectedProgramExpansion && selectedProgramSelection
    ? [
      ...selectedProgramSelectionFieldMutations.map(mutation => mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        previewPathSelections: [{ ...selectedProgramSelection, ...mutation }],
      })),
      mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        previewPathSelections: [],
      }),
      mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        previewPathSelections: [
          {
            id: elsePath.id,
            boundaryId: elsePath.boundaryId,
            armId: elsePath.armId,
            boundary: elsePath.boundary,
            provenance: 'preview-only',
          },
          selectedProgramSelection,
        ],
      }),
      mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        previewPathSelections: [...selectedProgramExpansion.previewPathSelections, selectedProgramSelection],
      }),
    ]
    : [];
  const selectedProgramInvocationFieldMutations = selectedProgramInvocation
    ? [
      { id: `${selectedProgramInvocation.id}:forged` },
      { sourceInvocationId: `${selectedProgramInvocation.sourceInvocationId}:forged` },
      { calleeDeclarationId: `${selectedProgramInvocation.calleeDeclarationId || 'callee'}:forged` },
      { source: { ...selectedProgramInvocation.source, start: { ...selectedProgramInvocation.source.start, offset: selectedProgramInvocation.source.start.offset + 1 } } },
      { ancestry: [...selectedProgramInvocation.ancestry, 'forged'] },
      { depth: selectedProgramInvocation.depth + 1 },
      { status: selectedProgramInvocation.status === 'expanded' ? 'rejected' : 'expanded' },
      { resultConsumed: !selectedProgramInvocation.resultConsumed },
      { resolution: { forged: true } },
      { previewPathSelectionIds: [] },
      { operationIds: [] },
      { reason: `${selectedProgramInvocation.reason || 'no-reason'}:forged` },
    ] as const
    : [];
  const selectedProgramInvocationAttacks = selectedProgramExpansion && selectedProgramInvocation
    ? [
      ...selectedProgramInvocationFieldMutations.map(mutation => mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        invocations: selectedProgramExpansion.invocations.map(invocation => invocation.id === selectedProgramInvocation.id
          ? { ...invocation, ...mutation }
          : invocation),
      })),
      mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        invocations: selectedProgramExpansion.invocations.filter(invocation => invocation.id !== selectedProgramInvocation.id),
      }),
      mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        invocations: [...selectedProgramExpansion.invocations].reverse(),
      }),
      mutateSelectedProgramExpansion({
        ...selectedProgramExpansion,
        invocations: [...selectedProgramExpansion.invocations, selectedProgramInvocation],
      }),
    ]
    : [];
  const selectedAuthorityClone = selectedBranchAuthority ? jsonClone(selectedBranchAuthority) : undefined;
  const mutateSelectedAuthorityExpansion = (
    expansion: Record<string, unknown>,
  ): EvidenceAuthorityLike => freezeClone({
    ...selectedAuthorityClone!,
    expansion,
  }) as unknown as EvidenceAuthorityLike;
  const selectedAuthoritySelection = selectedAuthorityExpansion?.selections[0];
  const selectedAuthoritySelectionFieldMutations = selectedAuthoritySelection
    ? [
      { id: `${selectedAuthoritySelection.id}:forged` },
      { boundaryId: `${selectedAuthoritySelection.boundaryId}:forged` },
      { armId: `${selectedAuthoritySelection.armId}:forged` },
      { boundary: { ...selectedAuthoritySelection.boundary, start: { ...selectedAuthoritySelection.boundary.start, offset: selectedAuthoritySelection.boundary.start.offset + 1 } } },
      { provenance: 'source' },
    ] as const
    : [];
  const selectedAuthoritySelectionAttacks = selectedAuthorityClone?.expansion && selectedAuthoritySelection
    ? [
      ...selectedAuthoritySelectionFieldMutations.map(mutation => mutateSelectedAuthorityExpansion({
        ...selectedAuthorityClone.expansion!,
        selections: [{ ...selectedAuthoritySelection, ...mutation }],
      })),
      mutateSelectedAuthorityExpansion({ ...selectedAuthorityClone.expansion, selections: [] }),
      mutateSelectedAuthorityExpansion({
        ...selectedAuthorityClone.expansion,
        selections: [
          {
            id: elsePath.id,
            boundaryId: elsePath.boundaryId,
            armId: elsePath.armId,
            boundary: elsePath.boundary,
            provenance: 'preview-only',
          },
          selectedAuthoritySelection,
        ],
      }),
      mutateSelectedAuthorityExpansion({
        ...selectedAuthorityClone.expansion,
        selections: [...selectedAuthorityClone.expansion.selections, selectedAuthoritySelection],
      }),
    ]
    : [];
  const selectedAuthorityInvocationFieldMutations = selectedAuthorityInvocation
    ? [
      { id: `${selectedAuthorityInvocation.id}:forged` },
      { sourceInvocationId: `${selectedAuthorityInvocation.sourceInvocationId}:forged` },
      { calleeDeclarationId: `${selectedAuthorityInvocation.calleeDeclarationId || 'callee'}:forged` },
      { source: { ...selectedAuthorityInvocation.source, start: { ...selectedAuthorityInvocation.source.start, offset: selectedAuthorityInvocation.source.start.offset + 1 } } },
      { ancestry: [...selectedAuthorityInvocation.ancestry, 'forged'] },
      { depth: selectedAuthorityInvocation.depth + 1 },
      { status: selectedAuthorityInvocation.status === 'expanded' ? 'rejected' : 'expanded' },
      { resultConsumed: !selectedAuthorityInvocation.resultConsumed },
      { resolution: { forged: true } },
      { previewPathSelectionIds: [] },
      { operationIds: [] },
      { reason: `${selectedAuthorityInvocation.reason || 'no-reason'}:forged` },
    ] as const
    : [];
  const selectedAuthorityInvocationAttacks = selectedAuthorityClone?.expansion && selectedAuthorityInvocation
    ? [
      ...selectedAuthorityInvocationFieldMutations.map(mutation => mutateSelectedAuthorityExpansion({
        ...selectedAuthorityClone.expansion!,
        invocations: selectedAuthorityClone.expansion.invocations.map(invocation => invocation.id === selectedAuthorityInvocation.id
          ? { ...invocation, ...mutation }
          : invocation),
      })),
      mutateSelectedAuthorityExpansion({
        ...selectedAuthorityClone.expansion,
        invocations: selectedAuthorityClone.expansion.invocations.filter(invocation => invocation.id !== selectedAuthorityInvocation.id),
      }),
      mutateSelectedAuthorityExpansion({
        ...selectedAuthorityClone.expansion,
        invocations: [...selectedAuthorityClone.expansion.invocations].reverse(),
      }),
      mutateSelectedAuthorityExpansion({
        ...selectedAuthorityClone.expansion,
        invocations: [...selectedAuthorityClone.expansion.invocations, selectedAuthorityInvocation],
      }),
    ]
    : [];
  check('selected expansion selections and complete invocations reject program-side and authority-side ledger attacks',
    selectedBranchAuthority !== undefined
      && selectedAuthorityValidation?.valid === true
      && selectedProgramSelection !== undefined
      && selectedProgramInvocation !== undefined
      && selectedAuthoritySelection !== undefined
      && selectedAuthorityInvocation !== undefined
      && selectedProgramSelectionAttacks.length === 8
      && selectedAuthoritySelectionAttacks.length === 8
      && selectedProgramInvocationAttacks.length === 15
      && selectedAuthorityInvocationAttacks.length === 15
      && selectedProgramSelectionAttacks.every(candidate =>
        !validateX4UiLayoutEvidencePair(candidate, selectedBranchAuthority! as EvidenceAuthorityLike).valid)
      && selectedAuthoritySelectionAttacks.every(candidate =>
        !validateX4UiLayoutEvidencePair(selectedBranchProgram, candidate).valid)
      && selectedProgramInvocationAttacks.every(candidate =>
        !validateX4UiLayoutEvidencePair(candidate, selectedBranchAuthority! as EvidenceAuthorityLike).valid)
      && selectedAuthorityInvocationAttacks.every(candidate =>
        !validateX4UiLayoutEvidencePair(selectedBranchProgram, candidate).valid),
    detail({
      selectionProgramAttacks: selectedProgramSelectionAttacks.length,
      selectionAuthorityAttacks: selectedAuthoritySelectionAttacks.length,
      invocationProgramAttacks: selectedProgramInvocationAttacks.length,
      invocationAuthorityAttacks: selectedAuthorityInvocationAttacks.length,
      programSelectionResults: selectedProgramSelectionAttacks.map(candidate => validateX4UiLayoutEvidencePair(candidate, selectedBranchAuthority!)),
      authoritySelectionResults: selectedAuthoritySelectionAttacks.map(candidate => validateX4UiLayoutEvidencePair(selectedBranchProgram, candidate)),
      programInvocationResults: selectedProgramInvocationAttacks.map(candidate => validateX4UiLayoutEvidencePair(candidate, selectedBranchAuthority!)),
      authorityInvocationResults: selectedAuthorityInvocationAttacks.map(candidate => validateX4UiLayoutEvidencePair(selectedBranchProgram, candidate)),
    }));
  const duplicatePathInput: X4UiLayoutPreviewPathSelectionInput = {
    ...selectedPathInput,
    selections: [selectedPathInput.selections[0], selectedPathInput.selections[0]],
  };
  const conflictingPathInput: X4UiLayoutPreviewPathSelectionInput = {
    ...selectedPathInput,
    selections: [
      selectedPathInput.selections[0],
      { id: elsePath.id, boundaryId: elsePath.boundaryId, armId: elsePath.armId },
    ],
  };
  const extraPathInput: X4UiLayoutPreviewPathSelectionInput = {
    ...selectedPathInput,
    selections: [{ id: 'preview-path:extra', boundaryId: 'extra-boundary', armId: 'extra-arm' }],
  };
  const stalePathInput: X4UiLayoutPreviewPathSelectionInput = {
    ...selectedPathInput,
    source: { ...selectedPathInput.source, sha256: 'F'.repeat(64) },
  };
  const unreachablePathInput: X4UiLayoutPreviewPathSelectionInput = {
    ...selectedPathInput,
    selections: [{
      id: unreachablePath.id,
      boundaryId: unreachablePath.boundaryId,
      armId: unreachablePath.armId,
    }],
  };
  const duplicatePathResult = projectX4UiLayoutProgram(
    branchExpansionModel, branchExpansionTarget, branchExpansionProfile, undefined, duplicatePathInput);
  const conflictingPathResult = projectX4UiLayoutProgram(
    branchExpansionModel, branchExpansionTarget, branchExpansionProfile, undefined, conflictingPathInput);
  const extraPathResult = projectX4UiLayoutProgram(
    branchExpansionModel, branchExpansionTarget, branchExpansionProfile, undefined, extraPathInput);
  const stalePathResult = projectX4UiLayoutProgram(
    branchExpansionModel, branchExpansionTarget, branchExpansionProfile, undefined, stalePathInput);
  const unreachablePathResult = projectX4UiLayoutProgram(
    branchExpansionModel, branchExpansionTarget, branchExpansionProfile, undefined, unreachablePathInput);
  const disabledPathResult = projectX4UiLayoutProgram(
    branchExpansionModel,
    branchExpansionTarget,
    profileFor(branchExpansionModel),
    undefined,
    selectedPathInput,
  );
  const malformedPathResult = projectX4UiLayoutProgram(
    branchExpansionModel,
    branchExpansionTarget,
    branchExpansionProfile,
    undefined,
    { catalogId: branchCatalog.id } as X4UiLayoutPreviewPathSelectionInput,
  );
  check('stale, duplicate, conflicting, extra, and unreachable path selections refuse before projection',
    duplicatePathResult.status === 'refused' && refusalCode(duplicatePathResult) === 'invalid-preview-path'
      && conflictingPathResult.status === 'refused' && refusalCode(conflictingPathResult) === 'invalid-preview-path'
      && extraPathResult.status === 'refused' && refusalCode(extraPathResult) === 'invalid-preview-path'
      && stalePathResult.status === 'refused' && refusalCode(stalePathResult) === 'preview-path-source-mismatch'
      && unreachablePathResult.status === 'refused' && refusalCode(unreachablePathResult) === 'invalid-preview-path'
      && disabledPathResult.status === 'refused' && refusalCode(disabledPathResult) === 'invalid-preview-path'
      && malformedPathResult.status === 'refused' && refusalCode(malformedPathResult) === 'malformed-preview-path'
      && !duplicatePathResult.program && !conflictingPathResult.program && !extraPathResult.program
      && !stalePathResult.program && !unreachablePathResult.program
      && !disabledPathResult.program && !malformedPathResult.program,
    detail({
      duplicatePathResult,
      conflictingPathResult,
      extraPathResult,
      stalePathResult,
      unreachablePathResult,
      disabledPathResult,
      malformedPathResult,
    }));

  const invocationRefusalSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width)',
    '  local table = frame:addTable(1, { width = width })',
    '  table:addRow(false, {})',
    '  return table',
    'end',
    'local function variadic(frame, ...)',
    '  frame:addTable(1, { width = 99 })',
    'end',
    'local holder = {}',
    'local function display(dynamicFrame, dynamicPanel)',
    '  local menu = { name = "Refusals", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame)',
    '  panel(frame, 20, 30)',
    '  variadic(frame, 20)',
    '  globalPanel(frame, 20)',
    '  holder.panel(frame, 20)',
    '  holder:panel(frame, 20)',
    '  dynamicPanel(frame, 20)',
    '  pcall(function() panel(frame, 25) end)',
    '  panel(dynamicFrame, 20)',
    '  local returned = panel(frame, 30)',
    '  returned:addTable(1, { width = 88 })',
    'end',
  ].join('\n');
  const invocationRefusalModel = buildX4UiCallModel(input(
    invocationRefusalSource,
    'selftest/local-invocation-refusals.lua',
  ));
  const invocationRefusalTarget = namedTarget(invocationRefusalModel, 'display');
  const invocationRefusalProgram = programOf(projectX4UiLayoutProgram(
    invocationRefusalModel,
    invocationRefusalTarget,
    profileFor(invocationRefusalModel, { localExpansion: { maxDepth: 3, maxInvocations: 8 } }),
  ));
  const refusalLedger = invocationRefusalProgram.localExpansion?.invocations || [];
  check('wrong arity, varargs, global/table/method calls, and dynamic ownership reject without false effects',
    refusalLedger.filter(candidate => candidate.status === 'rejected').length === 9
      && refusalLedger.filter(candidate => candidate.status === 'expanded').length === 1
      && refusalLedger.some(candidate => candidate.reason?.includes('arity mismatch'))
      && refusalLedger.some(candidate => candidate.reason?.includes('vararg'))
      && refusalLedger.filter(candidate =>
        candidate.reason?.includes('computed, table, global, or method')
          || candidate.reason?.includes('direct callee is global')).length >= 3
      && refusalLedger.some(candidate => candidate.reason?.includes('direct callee binding is not an exact tracked'))
      && refusalLedger.some(candidate => candidate.reason?.includes('requires a direct frame/table/row/cell ownership'))
      && invocationRefusalProgram.tables.filter(candidate => candidate.kernelState).length === 1
      && invocationRefusalProgram.tables.find(candidate => candidate.kernelState)?.requestedWidth === 30
      && invocationRefusalProgram.tables.find(candidate => candidate.kernelState)?.kernelState?.rows.length === 1
      && invocationRefusalProgram.tables.filter(candidate => !candidate.kernelState).length === 1
      && invocationRefusalProgram.operations.some(candidate => candidate.kind === 'addTable'
        && candidate.status === 'unresolved'
        && candidate.reason?.includes('owner/frame width is not an applied source identity'))
      && invocationRefusalProgram.sampleCatalog.entries.length === 0,
    detail({
      statuses: refusalLedger.map(candidate => candidate.status),
      reasons: refusalLedger.map(candidate => candidate.reason),
      tables: invocationRefusalProgram.tables.map(candidate => ({ width: candidate.requestedWidth, rows: candidate.kernelState?.rows.length })),
      operations: invocationRefusalProgram.operations.map(candidate => ({ kind: candidate.kind, status: candidate.status, line: candidate.source.start.line })),
      samples: invocationRefusalProgram.sampleCatalog.entries,
    }));

  const exactDeclarationSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame)',
    '  local table = frame:addTable(1, { width = 30 })',
    '  table:addRow(false, {})',
    'end',
    'local firstPanel = panel',
    'local function panel(frame)',
    '  local table = frame:addTable(1, { width = 40 })',
    '  table:addRow(false, {})',
    'end',
    'local function display()',
    '  local menu = { name = "Declarations", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  firstPanel(frame)',
    '  panel(frame)',
    'end',
  ].join('\n');
  const exactDeclarationModel = buildX4UiCallModel(input(
    exactDeclarationSource,
    'selftest/exact-local-declarations.lua',
  ));
  const exactDeclarationProgram = programOf(projectX4UiLayoutProgram(
    exactDeclarationModel,
    namedTarget(exactDeclarationModel, 'display'),
    profileFor(exactDeclarationModel, { localExpansion: { maxDepth: 2, maxInvocations: 4 } }),
  ));
  check('same-named declarations remain exact and a tracked alias keeps its original declaration',
    exactDeclarationModel.localFunctions.filter(candidate => candidate.name === 'panel').length === 2
      && exactDeclarationProgram.tables.map(candidate => candidate.requestedWidth).join(',') === '30,40'
      && exactDeclarationProgram.localExpansion?.invocations.map(candidate => candidate.resolution).join(',') === 'alias,direct'
      && new Set(exactDeclarationProgram.localExpansion?.invocations.map(candidate => candidate.calleeDeclarationId)).size === 2,
    detail({ declarations: exactDeclarationModel.localFunctions, expansion: exactDeclarationProgram.localExpansion }));

  const parameterCollisionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function inner(frame, width)',
    '  local table = frame:addTable(1, { width = width })',
    '  table:addRow(false, {})',
    'end',
    'local function outer(frame, width)',
    '  inner(frame, width)',
    'end',
    'local function display()',
    '  local menu = { name = "Parameters", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  outer(frame, 44)',
    'end',
  ].join('\n');
  const parameterCollisionModel = buildX4UiCallModel(input(
    parameterCollisionSource,
    'selftest/parameter-collision.lua',
  ));
  const parameterCollisionProgram = programOf(projectX4UiLayoutProgram(
    parameterCollisionModel,
    namedTarget(parameterCollisionModel, 'display'),
    profileFor(parameterCollisionModel, { localExpansion: { maxDepth: 3, maxInvocations: 4 } }),
  ));
  const collisionParameters = parameterCollisionModel.localFunctions
    .filter(candidate => candidate.name === 'inner' || candidate.name === 'outer')
    .flatMap(candidate => candidate.parameters);
  check('same-spelled nested parameters bind by declaration range without collision',
    new Set(collisionParameters.map(candidate => candidate.id)).size === collisionParameters.length
      && parameterCollisionProgram.localExpansion?.invocations.every(candidate => candidate.status === 'expanded')
      && parameterCollisionProgram.tables.length === 1
      && parameterCollisionProgram.tables[0].requestedWidth === 44
      && parameterCollisionProgram.tables[0].kernelState?.rows.length === 1,
    detail({ parameters: collisionParameters, program: parameterCollisionProgram }));

  const recursiveExpansionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function leaf(frame)',
    '  frame:addTable(1, { width = 20 })',
    'end',
    'local function direct(frame)',
    '  leaf(frame)',
    '  direct(frame)',
    'end',
    'local function outer(frame)',
    '  local function inner(nextFrame)',
    '    outer(nextFrame)',
    '  end',
    '  frame:addTable(1, { width = 40 })',
    '  inner(frame)',
    'end',
    'local function display()',
    '  local menu = { name = "Cycles", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  direct(frame)',
    '  outer(frame)',
    'end',
  ].join('\n');
  const recursiveExpansionModel = buildX4UiCallModel(input(
    recursiveExpansionSource,
    'selftest/recursive-expansion.lua',
  ));
  const recursiveExpansionProgram = programOf(projectX4UiLayoutProgram(
    recursiveExpansionModel,
    namedTarget(recursiveExpansionModel, 'display'),
    profileFor(recursiveExpansionModel, { localExpansion: { maxDepth: 8, maxInvocations: 16 } }),
  ));
  check('direct and indirect recursion are detected before helper subtree kernel mutation',
    recursiveExpansionProgram.frames.length === 1
      && recursiveExpansionProgram.tables.length === 0
      && recursiveExpansionProgram.operations.every(candidate => candidate.kind !== 'addTable')
      && recursiveExpansionProgram.localExpansion?.invocations.every(candidate => candidate.status === 'rejected')
      && recursiveExpansionProgram.localExpansion?.invocations.some(candidate =>
        candidate.reason?.includes('discarded with containing subtree')) === true
      && recursiveExpansionProgram.localExpansion?.invocations.filter(candidate =>
        candidate.reason?.includes('recursive local-helper cycle')).length >= 4
      && recursiveExpansionProgram.gaps.some(gap => gap.category === 'local-expansion'
        && gap.reason.includes('recursive local-helper cycle')),
    detail(recursiveExpansionProgram.localExpansion));

  const depthExpansionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function leaf(frame)',
    '  local table = frame:addTable(1, { width = 31 })',
    '  table:addRow(false, {})',
    'end',
    'local function middle(frame)',
    '  leaf(frame)',
    'end',
    'local function root(frame)',
    '  middle(frame)',
    'end',
    'local function display()',
    '  local menu = { name = "Depth", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  root(frame)',
    'end',
  ].join('\n');
  const depthExpansionModel = buildX4UiCallModel(input(depthExpansionSource, 'selftest/depth-expansion.lua'));
  const depthExpansionTarget = namedTarget(depthExpansionModel, 'display');
  const depthLimitedProgram = programOf(projectX4UiLayoutProgram(
    depthExpansionModel,
    depthExpansionTarget,
    profileFor(depthExpansionModel, { localExpansion: { maxDepth: 2, maxInvocations: 8 } }),
  ));
  const depthAcceptedProgram = programOf(projectX4UiLayoutProgram(
    depthExpansionModel,
    depthExpansionTarget,
    profileFor(depthExpansionModel, { localExpansion: { maxDepth: 3, maxInvocations: 8 } }),
  ));
  check('depth overflow rejects the whole pending subtree while the exact boundary accepts it',
    depthLimitedProgram.tables.length === 0
      && depthLimitedProgram.localExpansion?.invocations.some(candidate => candidate.reason?.includes('exceeds maxDepth 2'))
      && depthAcceptedProgram.tables.length === 1
      && depthAcceptedProgram.tables[0].requestedWidth === 31
      && depthAcceptedProgram.tables[0].kernelState?.rows.length === 1,
    detail({ limited: depthLimitedProgram.localExpansion, accepted: depthAcceptedProgram.localExpansion }));

  const countExpansionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width)',
    '  local table = frame:addTable(1, { width = width })',
    '  table:addRow(false, {})',
    'end',
    'local function display()',
    '  local menu = { name = "Count", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, 32)',
    '  panel(frame, 42)',
    'end',
  ].join('\n');
  const countExpansionModel = buildX4UiCallModel(input(countExpansionSource, 'selftest/count-expansion.lua'));
  const countLimitedProgram = programOf(projectX4UiLayoutProgram(
    countExpansionModel,
    namedTarget(countExpansionModel, 'display'),
    profileFor(countExpansionModel, { localExpansion: { maxDepth: 2, maxInvocations: 1 } }),
  ));
  check('invocation-count overflow preserves the last exact prior table state',
    countLimitedProgram.tables.length === 1
      && countLimitedProgram.tables[0].requestedWidth === 32
      && countLimitedProgram.tables[0].kernelState?.rows.length === 1
      && countLimitedProgram.localExpansion?.invocations.map(candidate => candidate.status).join(',') === 'expanded,rejected'
      && countLimitedProgram.localExpansion.invocations[1].reason?.includes('maxInvocations 1'),
    detail({ tables: countLimitedProgram.tables, expansion: countLimitedProgram.localExpansion }));
  const invalidDepthProfile = {
    ...profileFor(countExpansionModel),
    localExpansion: { maxDepth: 0, maxInvocations: 1 },
  } as X4UiLayoutProjectionProfile;
  const invalidCountProfile = {
    ...profileFor(countExpansionModel),
    localExpansion: { maxDepth: 1, maxInvocations: 0 },
  } as X4UiLayoutProjectionProfile;
  const invalidDepthResult = projectX4UiLayoutProgram(
    countExpansionModel, namedTarget(countExpansionModel, 'display'), invalidDepthProfile);
  const invalidCountResult = projectX4UiLayoutProgram(
    countExpansionModel, namedTarget(countExpansionModel, 'display'), invalidCountProfile);
  check('malformed expansion limits refuse before any projection state exists',
    invalidDepthResult.status === 'refused' && refusalCode(invalidDepthResult) === 'malformed-profile'
      && invalidCountResult.status === 'refused' && refusalCode(invalidCountResult) === 'malformed-profile'
      && !invalidDepthResult.program && !invalidCountResult.program,
    detail({ invalidDepthResult, invalidCountResult }));

  const refreshedHelperSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function display()',
    '  if not Helper then Helper = rawget(_G, "Helper") end',
    '  local menu = { name = "Refresh", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local table = frame:addTable(1, { width = 45 })',
    '  table:addRow(false, {})',
    'end',
  ].join('\n');
  const refreshedHelperModel = buildX4UiCallModel(input(refreshedHelperSource, 'selftest/helper-refresh.lua'));
  const refreshedHelperProgram = programOf(projectX4UiLayoutProgram(
    refreshedHelperModel,
    namedTarget(refreshedHelperModel, 'display'),
    profileFor(refreshedHelperModel),
  ));
  check('exact rawget Helper declaration and lazy same-expression refresh prove preview identity only',
    refreshedHelperModel.helperReceiverAliases.map(candidate => candidate.status).join(',') === 'bound,preserved'
      && refreshedHelperProgram.frames.length === 1
      && refreshedHelperProgram.tables.length === 1
      && refreshedHelperProgram.tables[0].kernelState?.rows.length === 1
      && refreshedHelperProgram.gaps.some(gap => gap.reason.includes('runtime non-nil availability remains unverified'))
      && refreshedHelperProgram.verification.game === X4_UI_LAYOUT_GAME_TRUTH,
    detail({
      aliases: refreshedHelperModel.helperReceiverAliases.map(candidate => candidate.status),
      frames: refreshedHelperProgram.frames.map(candidate => candidate.status),
      tables: refreshedHelperProgram.tables.map(candidate => ({ status: candidate.status, rows: candidate.kernelState?.rows.length })),
      gaps: refreshedHelperProgram.gaps.map(gap => gap.reason),
    }));

  const helperAliasNegativeSource = [
    'local rawget = function() return nil end',
    'local ShadowedRawget = rawget(_G, "Helper")',
    'local key = "Helper"',
    'local DynamicKey = _G[key]',
    'local OtherKey = _G["Other"]',
    'local Base = _G.Helper',
    'local Copied = Base',
    'local Invalidated = _G.Helper',
    'Invalidated = {}',
    'local function shadowGlobal(_G)',
    '  local ShadowedGlobal = rawget(_G, "Helper")',
    '  local menu = { name = "ShadowGlobal", layer = 1 }',
    '  ShadowedGlobal.createFrameHandle(menu, { width = 100, height = 80 })',
    'end',
    'local function display()',
    '  local menu = { name = "AliasNegatives", layer = 1 }',
    '  ShadowedRawget.createFrameHandle(menu, { width = 100, height = 80 })',
    '  DynamicKey.createFrameHandle(menu, { width = 100, height = 80 })',
    '  OtherKey.createFrameHandle(menu, { width = 100, height = 80 })',
    '  Copied.createFrameHandle(menu, { width = 100, height = 80 })',
    '  Invalidated.createFrameHandle(menu, { width = 100, height = 80 })',
    'end',
  ].join('\n');
  const helperAliasNegativeModel = buildX4UiCallModel(input(
    helperAliasNegativeSource,
    'selftest/helper-alias-layout-negatives.lua',
  ));
  const helperAliasNegativeProgram = programOf(projectX4UiLayoutProgram(
    helperAliasNegativeModel,
    namedTarget(helperAliasNegativeModel, 'display'),
    profileFor(helperAliasNegativeModel),
  ));
  check('shadowed/computed/copied/non-Helper/reassigned receiver shapes never establish Helper preview identity',
    helperAliasNegativeProgram.frames.length === 5
      && helperAliasNegativeProgram.frames.every(candidate =>
        candidate.status !== 'projected' && candidate.width === undefined && candidate.height === undefined)
      && helperAliasNegativeProgram.operations.filter(candidate => candidate.kind === 'createFrameHandle')
        .every(candidate => candidate.status === 'unresolved')
      && helperAliasNegativeProgram.tables.length === 0
      && helperAliasNegativeProgram.sampleCatalog.entries.length === 0
      && !helperAliasNegativeModel.calls.some(candidate =>
        candidate.receiver?.reference?.path === 'Helper' && candidate.context.name === 'display'),
    detail({
      aliases: helperAliasNegativeModel.helperReceiverAliases.map(candidate => ({ status: candidate.status, reason: candidate.reason })),
      frames: helperAliasNegativeProgram.frames.map(candidate => candidate.status),
      operations: helperAliasNegativeProgram.operations.map(candidate => candidate.status),
      samples: helperAliasNegativeProgram.sampleCatalog.entries,
      helperReceivers: helperAliasNegativeModel.calls.map(candidate => candidate.receiver?.reference?.path),
    }));
  const attemptedIdentitySampleResult = projectX4UiLayoutProgram(
    helperAliasNegativeModel,
    namedTarget(helperAliasNegativeModel, 'display'),
    profileFor(helperAliasNegativeModel, { localExpansion: { maxDepth: 2, maxInvocations: 4 } }),
    {
      catalogId: helperAliasNegativeProgram.sampleCatalog.id,
      source: helperAliasNegativeProgram.sampleCatalog.sourceIdentity,
      values: [{ id: 'preview-sample:receiver-identity', value: true }],
    },
  );
  check('preview samples cannot establish function or Helper receiver identity',
    helperAliasNegativeProgram.sampleCatalog.entries.length === 0
      && invocationRefusalProgram.sampleCatalog.entries.length === 0
      && attemptedIdentitySampleResult.status === 'refused'
      && refusalCode(attemptedIdentitySampleResult) === 'invalid-samples'
      && !attemptedIdentitySampleResult.program,
    detail(attemptedIdentitySampleResult));

  const directCompatibilityA = projectX4UiLayoutProgram(
    localExpansionModel,
    localExpansionTarget,
    profileFor(localExpansionModel, { minTextHeight: 12 }),
  );
  const directCompatibilityB = projectX4UiLayoutProgram(
    localExpansionModel,
    localExpansionTarget,
    profileFor(localExpansionModel, { minTextHeight: 12 }),
    undefined,
    undefined,
  );
  check('omitting local expansion preserves exact direct-target three-argument behavior',
    JSON.stringify(directCompatibilityA) === JSON.stringify(directCompatibilityB)
      && directCompatibilityA.program?.tables.length === 0
      && directCompatibilityA.program?.localExpansion === undefined,
    detail(directCompatibilityA));

  const truncationSource = [
    'local menu = { name = "Truncated", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 80 })',
    ...Array.from({ length: 140 }, () => 'table:setColWidth(getIndex(), getWidth())'),
  ].join('\n');
  const truncationModel = buildX4UiCallModel(input(truncationSource, 'selftest/truncated.lua'));
  const truncationProgram = programOf(projectX4UiLayoutProgram(truncationModel, topTarget(truncationModel), profileFor(truncationModel)));
  check('call-model truncation propagates as incomplete rather than green',
    truncationModel.verificationGapsTruncated
      && truncationProgram.analysis.callModelGapsTruncated
      && truncationProgram.analysis.incomplete
      && truncationProgram.status !== 'projected',
    detail({ truncated: truncationModel.verificationGapsTruncated, analysis: truncationProgram.analysis }));

  type Phase87OwnerField = 'frameId' | 'tableId' | 'rowId' | 'cellId';
  type Phase87NodeCollection = 'frames' | 'tables' | 'rows' | 'cells';
  const phase87OwnerFields: readonly Phase87OwnerField[] = ['frameId', 'tableId', 'rowId', 'cellId'];
  const phase87OwnerShape: Readonly<Record<string, readonly Phase87OwnerField[]>> = {
    scaleX: [],
    scaleY: [],
    scaleFont: [],
    createFrameHandle: ['frameId'],
    addTable: ['tableId'],
    setColWidth: ['tableId'],
    setColWidthPercent: ['tableId'],
    addRow: ['tableId', 'rowId'],
    setColSpan: ['tableId', 'rowId', 'cellId'],
    createButton: ['tableId', 'rowId', 'cellId'],
    setText: ['tableId', 'rowId', 'cellId'],
    setText2: ['tableId', 'rowId', 'cellId'],
    createText: ['tableId', 'rowId', 'cellId'],
    createEditBox: ['tableId', 'rowId', 'cellId'],
    createIcon: ['tableId', 'rowId', 'cellId'],
    display: ['frameId'],
    OpenMenu: [],
  };
  const phase87NodeCollectionForOwner = (field: Phase87OwnerField): Phase87NodeCollection =>
    field === 'frameId' ? 'frames' : field === 'tableId' ? 'tables' : field === 'rowId' ? 'rows' : 'cells';
  const phase87OwnerIds = (
    candidateProgram: ValueRecord,
    field: Phase87OwnerField,
    operationValue: ValueRecord,
  ): string[] => {
    const frames = candidateProgram.frames as ValueRecord[];
    const tables = candidateProgram.tables as ValueRecord[];
    const rows = candidateProgram.rows as ValueRecord[];
    const cells = candidateProgram.cells as ValueRecord[];
    const tableFor = (): ValueRecord | undefined => {
      if (typeof operationValue.tableId === 'string') {
        return tables.find(candidate => candidate.id === operationValue.tableId);
      }
      if (typeof operationValue.rowId === 'string') {
        const row = rows.find(candidate => candidate.id === operationValue.rowId);
        return typeof row?.tableId === 'string' ? tables.find(candidate => candidate.id === row.tableId) : undefined;
      }
      if (typeof operationValue.cellId === 'string') {
        const cell = cells.find(candidate => candidate.id === operationValue.cellId);
        return typeof cell?.tableId === 'string' ? tables.find(candidate => candidate.id === cell.tableId) : undefined;
      }
      return undefined;
    };
    const rowFor = (): ValueRecord | undefined => {
      if (typeof operationValue.rowId === 'string') return rows.find(candidate => candidate.id === operationValue.rowId);
      if (typeof operationValue.cellId === 'string') {
        const cell = cells.find(candidate => candidate.id === operationValue.cellId);
        return typeof cell?.rowId === 'string' ? rows.find(candidate => candidate.id === cell.rowId) : undefined;
      }
      return undefined;
    };
    const cellFor = (): ValueRecord | undefined =>
      typeof operationValue.cellId === 'string'
        ? cells.find(candidate => candidate.id === operationValue.cellId)
        : undefined;
    if (field === 'frameId') {
      const table = tableFor();
      const row = rowFor();
      const cell = cellFor();
      const inheritedFrameId = table?.frameId
        || (row?.tableId ? tables.find(candidate => candidate.id === row.tableId)?.frameId : undefined)
        || (cell?.tableId ? tables.find(candidate => candidate.id === cell.tableId)?.frameId : undefined);
      return typeof inheritedFrameId === 'string'
        ? [inheritedFrameId]
        : frames[0]?.id ? [String(frames[0].id)] : [];
    }
    if (field === 'tableId') {
      const table = tableFor();
      return table?.id
        ? [String(table.id)]
        : tables[0]?.id ? [String(tables[0].id)] : [];
    }
    if (field === 'rowId') {
      const row = rowFor();
      return row?.id
        ? [String(row.id)]
        : rows[0]?.id ? [String(rows[0].id)] : [];
    }
    const cell = cellFor();
    return cell?.id
      ? [String(cell.id)]
      : cells[0]?.id ? [String(cells[0].id)] : [];
  };
  const phase87UpdateNodeOperationMembership = (
    candidateProgram: ValueRecord,
    candidateAuthority: ValueRecord,
    field: Phase87OwnerField,
    nodeId: string,
    operationId: string,
    add: boolean,
  ): void => {
    const collection = phase87NodeCollectionForOwner(field);
    const programNodes = candidateProgram[collection] as ValueRecord[];
    const authorityNodes = (candidateAuthority.nodes as ValueRecord)[collection] as ValueRecord[];
    const programNode = programNodes.find(candidate => candidate.id === nodeId);
    const authorityNode = authorityNodes.find(candidate => candidate.id === nodeId);
    const authoritySnapshot = authorityNode?.snapshot as ValueRecord | undefined;
    const update = (node: ValueRecord | undefined): void => {
      if (!node || !Array.isArray(node.operationIds)) return;
      const operationIds = node.operationIds as string[];
      node.operationIds = add
        ? operationIds.includes(operationId) ? operationIds : [...operationIds, operationId]
        : operationIds.filter(candidate => candidate !== operationId);
    };
    update(programNode);
    update(authorityNode);
    update(authoritySnapshot);
    if (field === 'cellId' && !add) {
      const removeMetadata = (node: ValueRecord | undefined): void => {
        if (!node || !Array.isArray(node.metadataOperationIds)) return;
        node.metadataOperationIds = (node.metadataOperationIds as string[]).filter(candidate => candidate !== operationId);
      };
      removeMetadata(programNode);
      removeMetadata(authorityNode);
      removeMetadata(authoritySnapshot);
    }
  };
  const phase87SetOperationOwner = (
    candidateProgram: ValueRecord,
    candidateAuthority: ValueRecord,
    operationIndex: number,
    field: Phase87OwnerField,
    nextOwner: string | undefined,
  ): ValueRecord => {
    const operations = candidateProgram.operations as ValueRecord[];
    const authorityOperations = candidateAuthority.operations as ValueRecord[];
    const operationValue = operations[operationIndex];
    const authorityOperation = authorityOperations[operationIndex];
    const snapshot = authorityOperation?.snapshot as ValueRecord | undefined;
    const operationId = String(operationValue?.id || '');
    const previousOwner = typeof operationValue?.[field] === 'string' ? String(operationValue[field]) : undefined;
    if (previousOwner !== undefined) {
      phase87UpdateNodeOperationMembership(candidateProgram, candidateAuthority, field, previousOwner, operationId, false);
    }
    if (nextOwner !== undefined) {
      phase87UpdateNodeOperationMembership(candidateProgram, candidateAuthority, field, nextOwner, operationId, true);
      if (operationValue) operationValue[field] = nextOwner;
      if (authorityOperation) authorityOperation[field] = nextOwner;
      if (snapshot) snapshot[field] = nextOwner;
    } else {
      if (operationValue) delete operationValue[field];
      if (authorityOperation) delete authorityOperation[field];
      if (snapshot) delete snapshot[field];
    }
    return {
      previousOwner,
      nextOwner,
      operationId,
      operationIndex,
      field,
      changed: previousOwner !== nextOwner,
    };
  };
  const phase87OwnerShapeMatches = allKindProgram.operations.every(operationValue => {
    const actual = phase87OwnerFields.filter(field => operationValue[field] !== undefined);
    const expected = phase87OwnerShape[operationValue.kind] || [];
    return sameJson(actual, expected);
  });
  const phase87OwnerCaseName = (operationValue: { readonly kind: unknown }, operationIndex: number, field: Phase87OwnerField): string => {
    const occurrence = allKindProgram.operations
      .slice(0, operationIndex)
      .filter(candidate => candidate.kind === operationValue.kind).length + 1;
    return `${String(operationValue.kind)}#${occurrence}.${field}`;
  };
  const phase87OwnerAdditions = allKindProgram.operations.flatMap((operationValue, operationIndex) =>
    phase87OwnerFields
      .filter(field => operationValue[field] === undefined)
      .map(field => ({ operationValue, operationIndex, field, name: phase87OwnerCaseName(operationValue, operationIndex, field) })));
  const phase87OwnerRemovals = allKindProgram.operations.flatMap((operationValue, operationIndex) =>
    phase87OwnerFields
      .filter(field => operationValue[field] !== undefined && !(field === 'tableId' && operationValue.kernel !== undefined))
      .map(field => ({ operationValue, operationIndex, field, name: phase87OwnerCaseName(operationValue, operationIndex, field) })));
  for (const attack of [...phase87OwnerAdditions, ...phase87OwnerRemovals]) {
    const candidateProgram = jsonClone(allKindProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as ValueRecord;
    const operationValue = (candidateProgram.operations as ValueRecord[])[attack.operationIndex];
    const targetIds = operationValue ? phase87OwnerIds(candidateProgram, attack.field, operationValue) : [];
    const targetId = targetIds[0];
    const adding = attack.operationValue[attack.field] === undefined;
    const beforeOwner = operationValue?.[attack.field];
    const mutation = phase87SetOperationOwner(
      candidateProgram,
      candidateAuthority,
      attack.operationIndex,
      attack.field,
      adding ? targetId : undefined,
    );
    const proof: ValueRecord = {
      fixtureReady: phase87OwnerShapeMatches
        && operationValue !== undefined
        && (adding ? typeof targetId === 'string' : typeof beforeOwner === 'string')
        && mutation.changed
        && (adding ? operationValue[attack.field] === targetId : operationValue[attack.field] === undefined),
      operationKind: attack.operationValue.kind,
      operationIndex: attack.operationIndex,
      field: attack.field,
      beforeOwner,
      afterOwner: operationValue?.[attack.field],
      targetId,
      adding,
      kernelBacked: operationValue?.kernel !== undefined,
      shapeMatches: phase87OwnerShapeMatches,
    };
    const frozenProgram = freezeClone(candidateProgram) as unknown as X4UiLayoutProgram;
    const frozenAuthority = freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike;
    const validation = safeSchemaPairValidation(frozenProgram, frozenAuthority);
    check(`8A.7 fail-first exhaustive owner shape ${attack.name}`,
      phase87OwnerShapeMatches
        && proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ proof, validation }));
  }
  const phase87KernelRemovalControl = allKindProgram.operations.findIndex(operationValue =>
    operationValue.kernel !== undefined && operationValue.tableId !== undefined);
  if (phase87KernelRemovalControl >= 0 && allKindAuthority) {
    const candidateProgram = jsonClone(allKindProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as ValueRecord;
    const operationValue = (candidateProgram.operations as ValueRecord[])[phase87KernelRemovalControl];
    const mutation = phase87SetOperationOwner(candidateProgram, candidateAuthority, phase87KernelRemovalControl, 'tableId', undefined);
    const frozenProgram = freezeClone(candidateProgram) as unknown as X4UiLayoutProgram;
    const frozenAuthority = freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike;
    const validation = safeSchemaPairValidation(frozenProgram, frozenAuthority);
    check('8A.7 control keeps a kernel-backed table-owner removal refused',
      operationValue !== undefined
        && mutation.changed === true
        && validation.threw === false
        && validation.valid === false,
      detail({ operationKind: operationValue?.kind, mutation, validation }));
  }

  type Phase87PairAttack = {
    readonly name: string;
    readonly program: X4UiLayoutProgram | undefined;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly proof: ValueRecord;
  };
  const phase87PositiveAuthority = resultAuthority;
  const phase87NodePairAttack = (
    collection: Phase87NodeCollection,
    predicate: (node: ValueRecord) => boolean,
    mutate: (programNode: ValueRecord, authoritySnapshot: ValueRecord, before: ValueRecord) => ValueRecord,
    name: string,
  ): Phase87PairAttack => {
    if (!phase87PositiveAuthority) {
      return { name, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'positive authority missing' } };
    }
    const candidateProgram = jsonClone(program) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87PositiveAuthority) as unknown as ValueRecord;
    const programNodes = candidateProgram[collection] as ValueRecord[];
    const authorityNodes = (candidateAuthority.nodes as ValueRecord)[collection] as ValueRecord[];
    const nodeIndex = programNodes.findIndex(predicate);
    const node = nodeIndex >= 0 ? programNodes[nodeIndex] : undefined;
    const nodeId = node?.id;
    const authorityNode = authorityNodes.find(candidate => candidate.id === nodeId);
    const authoritySnapshot = authorityNode?.snapshot as ValueRecord | undefined;
    const before = node ? jsonClone(node) as ValueRecord : {};
    const proof = node && authoritySnapshot
      ? mutate(node, authoritySnapshot, before)
      : { fixtureReady: false, reason: 'selected node or authority snapshot missing', collection, nodeId };
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: { ...proof, collection, nodeId, nodeIndex },
    };
  };
  const phase87TableA = program.tables.find(candidate => candidate.identity?.path === 'table');
  const phase87TableB = program.tables.find(candidate => candidate.identity?.path === 'independent');
  const phase87RowA = phase87TableA ? program.rows.find(candidate => candidate.tableId === phase87TableA.id) : undefined;
  const phase87RowB = phase87TableB ? program.rows.find(candidate => candidate.tableId === phase87TableB.id) : undefined;
  const phase87CellA = phase87RowA ? program.cells.find(candidate => candidate.rowId === phase87RowA.id && candidate.column === 1) : undefined;
  const phase87CellB = phase87RowB ? program.cells.find(candidate => candidate.rowId === phase87RowB.id && candidate.column === 1) : undefined;
  const phase87CreatorOperation = program.operations.find(operationValue => {
    const metadata = operationValue.metadata as unknown as ValueRecord | undefined;
    const receiver = metadata?.receiver as ValueRecord | undefined;
    return (operationValue.kind === 'createText' || operationValue.kind === 'createButton')
      && operationValue.status === 'applied'
      && receiver?.reference !== undefined;
  });
  const phase87CreatorBeforeReference = (
    (phase87CreatorOperation?.metadata as unknown as ValueRecord | undefined)?.receiver as ValueRecord | undefined
  )?.reference as ValueRecord | undefined;
  const phase87CreatorSiblingCell = phase87CreatorBeforeReference
    ? program.cells.find(candidate => candidate.identity !== undefined
      && candidate.identity.kind === phase87CreatorBeforeReference.kind
      && candidate.identity.path !== phase87CreatorBeforeReference.path)
    : undefined;
  const phase87TopologyAttacks: readonly Phase87PairAttack[] = [
    phase87NodePairAttack('tables', node => node.id === phase87TableA?.id, (node, snapshot, before) => {
      const rowIds = node.rowIds as string[];
      node.rowIds = rowIds.slice(1);
      snapshot.rowIds = [...(node.rowIds as string[])];
      return { fixtureReady: rowIds.length >= 2 && (node.rowIds as string[]).length === rowIds.length - 1 && sameJson(snapshot.rowIds, node.rowIds), beforeRowIds: before.rowIds, afterRowIds: node.rowIds };
    }, 'missing table.rowIds'),
    phase87NodePairAttack('tables', node => node.id === phase87TableA?.id, (node, snapshot, before) => {
      const rowIds = [...(node.rowIds as string[]), 'row:phase87-unknown'];
      node.rowIds = rowIds;
      snapshot.rowIds = [...rowIds];
      return { fixtureReady: Array.isArray(before.rowIds) && rowIds.length === (before.rowIds as string[]).length + 1 && rowIds.at(-1) === 'row:phase87-unknown' && sameJson(snapshot.rowIds, rowIds), beforeRowIds: before.rowIds, afterRowIds: rowIds };
    }, 'unknown table.rowIds'),
    phase87NodePairAttack('tables', node => node.id === phase87TableA?.id, (node, snapshot, before) => {
      const rowIds = [...(node.rowIds as string[])].reverse();
      node.rowIds = rowIds;
      snapshot.rowIds = [...rowIds];
      return { fixtureReady: (before.rowIds as string[]).length >= 2 && !sameJson(before.rowIds, rowIds) && sameJson(snapshot.rowIds, rowIds), beforeRowIds: before.rowIds, afterRowIds: rowIds };
    }, 'reversed table.rowIds'),
    phase87NodePairAttack('rows', node => node.id === phase87RowA?.id, (node, snapshot, before) => {
      if (phase87TableB) {
        node.tableId = phase87TableB.id;
        snapshot.tableId = phase87TableB.id;
      }
      return { fixtureReady: phase87TableB !== undefined && before.tableId !== node.tableId && snapshot.tableId === node.tableId, beforeTableId: before.tableId, afterTableId: node.tableId };
    }, 'row table reassignment'),
    phase87NodePairAttack('rows', node => node.id === phase87RowA?.id, (node, snapshot, before) => {
      const identity = node.identity as ValueRecord | undefined;
      const snapshotIdentity = snapshot.identity as ValueRecord | undefined;
      const beforeIdentity = before.identity as ValueRecord | undefined;
      const targetPath = phase87TableB?.identity?.path;
      if (identity && snapshotIdentity && typeof targetPath === 'string') {
        identity.parentPath = targetPath;
        snapshotIdentity.parentPath = targetPath;
      }
      return { fixtureReady: identity !== undefined && snapshotIdentity !== undefined && typeof targetPath === 'string' && beforeIdentity?.parentPath !== targetPath && identity.parentPath === targetPath && snapshotIdentity.parentPath === targetPath, beforeParentPath: beforeIdentity?.parentPath, afterParentPath: identity?.parentPath };
    }, 'row identity parent-path drift'),
    phase87NodePairAttack('rows', node => node.id === phase87RowA?.id, (node, snapshot, before) => {
      const cellIds = node.cellIds as string[];
      node.cellIds = cellIds.slice(1);
      snapshot.cellIds = [...(node.cellIds as string[])];
      return { fixtureReady: cellIds.length >= 2 && (node.cellIds as string[]).length === cellIds.length - 1 && sameJson(snapshot.cellIds, node.cellIds), beforeCellIds: before.cellIds, afterCellIds: node.cellIds };
    }, 'missing row.cellIds'),
    phase87NodePairAttack('rows', node => node.id === phase87RowA?.id, (node, snapshot, before) => {
      const cellIds = [...(node.cellIds as string[]), 'cell:phase87-unknown'];
      node.cellIds = cellIds;
      snapshot.cellIds = [...cellIds];
      return { fixtureReady: Array.isArray(before.cellIds) && cellIds.length === (before.cellIds as string[]).length + 1 && cellIds.at(-1) === 'cell:phase87-unknown' && sameJson(snapshot.cellIds, cellIds), beforeCellIds: before.cellIds, afterCellIds: cellIds };
    }, 'unknown row.cellIds'),
    phase87NodePairAttack('rows', node => node.id === phase87RowA?.id, (node, snapshot, before) => {
      const cellIds = node.cellIds as string[];
      const after = phase87CellB?.id && !cellIds.includes(phase87CellB.id)
        ? [...cellIds, phase87CellB.id]
        : [...cellIds];
      node.cellIds = after;
      snapshot.cellIds = [...after];
      return { fixtureReady: phase87CellB !== undefined && cellIds.length > 0 && !cellIds.includes(phase87CellB.id) && after.length === cellIds.length + 1 && new Set(after).size === after.length && sameJson(snapshot.cellIds, after), beforeCellIds: before.cellIds, afterCellIds: after, duplicatedKnownCellId: phase87CellB?.id };
    }, 'duplicated row.cellIds membership'),
    phase87NodePairAttack('cells', node => node.id === phase87CellA?.id, (node, snapshot, before) => {
      if (phase87TableB) {
        node.tableId = phase87TableB.id;
        snapshot.tableId = phase87TableB.id;
      }
      return { fixtureReady: phase87TableB !== undefined && before.tableId !== node.tableId && snapshot.tableId === node.tableId, beforeTableId: before.tableId, afterTableId: node.tableId };
    }, 'cell ancestry drift'),
    phase87NodePairAttack('cells', node => node.id === phase87CellA?.id, (node, snapshot, before) => {
      const identity = node.identity as ValueRecord | undefined;
      const snapshotIdentity = snapshot.identity as ValueRecord | undefined;
      const beforeIdentity = before.identity as ValueRecord | undefined;
      const targetPath = phase87RowB?.identity?.path;
      if (identity && snapshotIdentity && typeof targetPath === 'string') {
        identity.parentPath = targetPath;
        snapshotIdentity.parentPath = targetPath;
      }
      return { fixtureReady: identity !== undefined && snapshotIdentity !== undefined && typeof targetPath === 'string' && beforeIdentity?.parentPath !== targetPath && identity.parentPath === targetPath && snapshotIdentity.parentPath === targetPath, beforeParentPath: beforeIdentity?.parentPath, afterParentPath: identity?.parentPath };
    }, 'cell identity parent-path drift'),
  ];
  const phase87AddRowReassignment = (() => {
    if (!phase87PositiveAuthority || !phase87TableA || !phase87TableB || !phase87RowA || !phase87RowB) return undefined;
    const candidateProgram = jsonClone(program) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87PositiveAuthority) as unknown as ValueRecord;
    const operationIndex = (candidateProgram.operations as ValueRecord[]).findIndex(operationValue =>
      operationValue.kind === 'addRow' && operationValue.tableId === phase87TableA.id && operationValue.rowId === phase87RowA.id && operationValue.status === 'applied');
    const operationValue = (candidateProgram.operations as ValueRecord[])[operationIndex];
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const mutation = operationIndex >= 0
      ? {
        table: phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, 'tableId', phase87TableB.id),
        row: phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, 'rowId', phase87RowB.id),
      }
      : undefined;
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: operationIndex >= 0 && mutation !== undefined && before.tableId === phase87TableA.id && before.rowId === phase87RowA.id && operationValue?.tableId === phase87TableB.id && operationValue?.rowId === phase87RowB.id,
        operationIndex,
        beforeTableId: before.tableId,
        beforeRowId: before.rowId,
        afterTableId: operationValue?.tableId,
        afterRowId: operationValue?.rowId,
        tableMutation: mutation?.table,
        rowMutation: mutation?.row,
      },
      name: 'coherent addRow reassignment',
    } satisfies Phase87PairAttack;
  })();
  const phase87RowCellAttacks = [...phase87TopologyAttacks, phase87AddRowReassignment].filter((attack): attack is Phase87PairAttack => attack !== undefined);
  const phase87TopologyBaseline = phase87PositiveAuthority ? safeSchemaPairValidation(program, phase87PositiveAuthority) : { threw: false, valid: false };
  for (const attack of phase87RowCellAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'row/cell topology fixture missing' };
    check(`8A.7 fail-first row/cell topology ${attack.name}`,
      phase87TopologyBaseline.valid === true
        && attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: phase87TopologyBaseline, proof: attack.proof, validation }));
  }

  const phase87OperationPairMutation = (
    name: string,
    predicate: (operationValue: ValueRecord) => boolean,
    mutate: (operationValue: ValueRecord, snapshot: ValueRecord, before: ValueRecord) => ValueRecord,
  ): Phase87PairAttack => {
    if (!phase87PositiveAuthority) return { name, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'positive authority missing' } };
    const candidateProgram = jsonClone(program) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87PositiveAuthority) as unknown as ValueRecord;
    const operations = candidateProgram.operations as ValueRecord[];
    const authorityOperations = candidateAuthority.operations as ValueRecord[];
    const operationIndex = operations.findIndex(predicate);
    const operationValue = operationIndex >= 0 ? operations[operationIndex] : undefined;
    const snapshot = operationIndex >= 0 ? authorityOperations[operationIndex]?.snapshot as ValueRecord | undefined : undefined;
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const proof = operationValue && snapshot ? mutate(operationValue, snapshot, before) : { fixtureReady: false, reason: 'selected operation or snapshot missing', operationIndex };
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: { ...proof, operationIndex, operationId: operationValue?.id, operationKind: operationValue?.kind },
    };
  };
  const phase87IdentityAttacks: readonly Phase87PairAttack[] = [
    phase87NodePairAttack('frames', node => node.identity !== undefined && Array.isArray(node.operationIds) && (node.operationIds as string[]).some(operationId => program.operations.some(operationValue => operationValue.id === operationId && operationValue.kind === 'createFrameHandle' && operationValue.status === 'applied')), (node, snapshot, before) => {
      delete node.identity;
      delete snapshot.identity;
      return { fixtureReady: before.identity !== undefined && node.identity === undefined && snapshot.identity === undefined };
    }, 'removed applied frame identity'),
    phase87NodePairAttack('tables', node => node.identity !== undefined && node.frameId !== undefined, (node, snapshot, before) => {
      delete node.identity;
      delete snapshot.identity;
      return { fixtureReady: before.identity !== undefined && node.identity === undefined && snapshot.identity === undefined };
    }, 'removed applied table identity'),
    phase87NodePairAttack('rows', node => node.identity !== undefined && node.tableId !== undefined, (node, snapshot, before) => {
      delete node.identity;
      delete snapshot.identity;
      return { fixtureReady: before.identity !== undefined && node.identity === undefined && snapshot.identity === undefined };
    }, 'removed applied row identity'),
    phase87NodePairAttack('cells', node => node.identity !== undefined && Array.isArray(node.operationIds) && (node.operationIds as string[]).length > 0, (node, snapshot, before) => {
      delete node.identity;
      delete snapshot.identity;
      return { fixtureReady: before.identity !== undefined && node.identity === undefined && snapshot.identity === undefined };
    }, 'removed identified-cell identity'),
    phase87OperationPairMutation('create-frame result drift', operationValue => operationValue.kind === 'createFrameHandle' && operationValue.status === 'applied', (operationValue, snapshot, before) => {
      const targetIdentity = phase87TableB?.identity || phase87TableA?.identity;
      const metadata = operationValue.metadata as ValueRecord;
      const snapshotMetadata = snapshot.metadata as ValueRecord;
      const beforeMetadata = before.metadata as ValueRecord | undefined;
      if (targetIdentity && metadata && snapshotMetadata) {
        metadata.result = jsonClone(targetIdentity);
        snapshotMetadata.result = jsonClone(targetIdentity);
      }
      return { fixtureReady: targetIdentity !== undefined && beforeMetadata?.result !== undefined && !sameJson(beforeMetadata.result, metadata.result) && sameJson(metadata.result, snapshotMetadata.result), beforeResult: beforeMetadata?.result, afterResult: metadata.result };
    }),
    phase87OperationPairMutation('addRow result drift', operationValue => operationValue.kind === 'addRow' && operationValue.status === 'applied', (operationValue, snapshot, before) => {
      const targetIdentity = phase87CellA?.identity;
      const metadata = operationValue.metadata as ValueRecord;
      const snapshotMetadata = snapshot.metadata as ValueRecord;
      const beforeMetadata = before.metadata as ValueRecord | undefined;
      if (targetIdentity && metadata && snapshotMetadata) {
        metadata.result = jsonClone(targetIdentity);
        snapshotMetadata.result = jsonClone(targetIdentity);
      }
      return { fixtureReady: targetIdentity !== undefined && beforeMetadata?.result !== undefined && !sameJson(beforeMetadata.result, metadata.result) && sameJson(metadata.result, snapshotMetadata.result), beforeResult: beforeMetadata?.result, afterResult: metadata.result };
    }),
    phase87OperationPairMutation('width receiver drift', operationValue => {
      const metadata = operationValue.metadata as ValueRecord | undefined;
      return operationValue.kind === 'setColWidth' && operationValue.status === 'applied' && metadata?.receiver !== undefined && (metadata.receiver as ValueRecord).reference !== undefined;
    }, (operationValue, snapshot, before) => {
      const targetIdentity = phase87TableB?.identity;
      const metadata = operationValue.metadata as ValueRecord;
      const snapshotMetadata = snapshot.metadata as ValueRecord;
      const beforeMetadata = before.metadata as ValueRecord | undefined;
      const receiver = metadata.receiver as ValueRecord | undefined;
      const snapshotReceiver = snapshotMetadata.receiver as ValueRecord | undefined;
      const beforeReceiver = beforeMetadata?.receiver as ValueRecord | undefined;
      const beforeReceiverReference = beforeReceiver?.reference;
      if (targetIdentity && receiver && snapshotReceiver) {
        receiver.reference = jsonClone(targetIdentity);
        snapshotReceiver.reference = jsonClone(targetIdentity);
      }
      return { fixtureReady: targetIdentity !== undefined && beforeReceiverReference !== undefined && receiver?.reference !== undefined && !sameJson(beforeReceiverReference, receiver.reference) && sameJson(receiver.reference, snapshotReceiver?.reference), beforeReceiver, afterReceiver: receiver };
    }),
    phase87OperationPairMutation('creator receiver drift', operationValue => {
      const metadata = operationValue.metadata as ValueRecord | undefined;
      return (operationValue.kind === 'createText' || operationValue.kind === 'createButton')
        && operationValue.status === 'applied'
        && metadata?.receiver !== undefined
        && (metadata.receiver as ValueRecord).reference !== undefined;
    }, (operationValue, snapshot, before) => {
      const targetIdentity = phase87CreatorSiblingCell?.identity;
      const metadata = operationValue.metadata as ValueRecord;
      const snapshotMetadata = snapshot.metadata as ValueRecord;
      const beforeMetadata = before.metadata as ValueRecord | undefined;
      const receiver = metadata.receiver as ValueRecord | undefined;
      const snapshotReceiver = snapshotMetadata.receiver as ValueRecord | undefined;
      const beforeReceiver = beforeMetadata?.receiver as ValueRecord | undefined;
      const beforeReceiverReference = beforeReceiver?.reference;
      if (targetIdentity && receiver && snapshotReceiver) {
        receiver.reference = jsonClone(targetIdentity);
        snapshotReceiver.reference = jsonClone(targetIdentity);
      }
      const afterReceiverReference = receiver?.reference;
      const receiverReferenceChanged = beforeReceiverReference !== undefined
        && afterReceiverReference !== undefined
        && !sameJson(beforeReceiverReference, afterReceiverReference);
      const targetReferenceMatches = targetIdentity !== undefined
        && afterReceiverReference !== undefined
        && sameJson(afterReceiverReference, targetIdentity)
        && sameJson(afterReceiverReference, snapshotReceiver?.reference);
      return {
        fixtureReady: targetIdentity !== undefined
          && beforeReceiverReference !== undefined
          && receiverReferenceChanged
          && targetReferenceMatches,
        beforeReceiver,
        afterReceiver: receiver,
        beforeReceiverReference,
        afterReceiverReference,
        targetReceiverReference: targetIdentity,
        receiverReferenceChanged,
        targetReferenceMatches,
        distinctCanonicalIdentity: beforeReceiverReference !== undefined
          && targetIdentity !== undefined
          && !sameJson(beforeReceiverReference, targetIdentity),
      };
    }),
    phase87OperationPairMutation('addTable result mismatch control', operationValue => operationValue.kind === 'addTable' && operationValue.tableId === phase87TableA?.id && operationValue.status === 'applied', (operationValue, snapshot, before) => {
      const targetIdentity = phase87TableB?.identity;
      const metadata = operationValue.metadata as ValueRecord;
      const snapshotMetadata = snapshot.metadata as ValueRecord;
      const beforeMetadata = before.metadata as ValueRecord | undefined;
      if (targetIdentity && metadata && snapshotMetadata) {
        metadata.result = jsonClone(targetIdentity);
        snapshotMetadata.result = jsonClone(targetIdentity);
      }
      return { fixtureReady: targetIdentity !== undefined && beforeMetadata?.result !== undefined && !sameJson(beforeMetadata.result, metadata.result) && sameJson(metadata.result, snapshotMetadata.result), beforeResult: beforeMetadata?.result, afterResult: metadata.result };
    }),
  ];
  const phase87IdentityBaseline = phase87PositiveAuthority ? safeSchemaPairValidation(program, phase87PositiveAuthority) : { threw: false, valid: false };
  for (const attack of phase87IdentityAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'identity fixture missing' };
    const expectedValid = false;
    check(`8A.7 fail-first identity/result/receiver ${attack.name}`,
      phase87IdentityBaseline.valid === true
        && attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === expectedValid,
      detail({ baseline: phase87IdentityBaseline, proof: attack.proof, validation, expectedValid }));
  }

  const phase87ProfileIngress = (name: string, mutateProfile: (candidate: ValueRecord) => void): ValueRecord => {
    const candidateProfile = jsonClone(profile) as unknown as ValueRecord;
    mutateProfile(candidateProfile);
    const candidateResult = projectX4UiLayoutProgram(model, target, candidateProfile as unknown as X4UiLayoutProjectionProfile);
    const candidateProgram = resultProgram(candidateResult);
    const candidateAuthority = evidenceAuthorityOf(candidateResult);
    const validation = candidateProgram && candidateAuthority
      ? safeSchemaPairValidation(candidateProgram, candidateAuthority)
      : { threw: false, valid: undefined, reason: 'wrapper refused before program emission' };
    return {
      name,
      status: candidateResult.status,
      programEmitted: candidateProgram !== undefined,
      wrapperSelfValid: candidateResult.status === 'refused' || validation.valid === true,
      validation,
      profile: candidateProfile,
    };
  };
  const phase87ProfileIngressCases = [
    phase87ProfileIngress('view-width mismatch', candidate => {
      const frame = candidate.frame as ValueRecord;
      frame.width = Number(frame.width) + 1;
    }),
    phase87ProfileIngress('view-height mismatch', candidate => {
      const frame = candidate.frame as ValueRecord;
      frame.height = Number(frame.height) + 1;
    }),
    phase87ProfileIngress('standard-button-height 26 with defaults omitted', candidate => {
      const defaults = candidate.defaults as ValueRecord;
      delete defaults.standardButtonHeight;
      const constants = (candidate.helper as ValueRecord).constants as ValueRecord;
      (constants.standardButtonHeight as ValueRecord).value = 26;
    }),
  ];
  for (const attack of phase87ProfileIngressCases) {
    check(`8A.7 fail-first profile ingress ${String(attack.name)}`,
      attack.wrapperSelfValid === true,
      detail(attack));
  }
  const phase87EmptyProfileProgram = mutateProgramJson(allKindProgram, candidate => {
    const candidateProfile = candidate.profile as ValueRecord;
    candidateProfile.provenance = '';
  });
  const phase87EmptyProfileAuthority = allKindAuthority
    ? mutateAuthorityJson(allKindAuthority, candidate => {
      const candidateProfile = candidate.profile as ValueRecord;
      candidateProfile.provenance = '';
    })
    : undefined;
  const phase87EmptyProfileValidation = phase87EmptyProfileAuthority
    ? safeSchemaPairValidation(phase87EmptyProfileProgram, phase87EmptyProfileAuthority)
    : { threw: false, valid: false, reason: 'profile authority missing' };
  check('8A.7 fail-first profile provenance cannot be empty',
    phase87EmptyProfileValidation.threw === false && phase87EmptyProfileValidation.valid === false,
    detail({ validation: phase87EmptyProfileValidation }));

  const phase87ReplaceParameterReferences = (
    root: unknown,
    declarationId: string,
    replacements: ReadonlyMap<number, ValueRecord>,
  ): void => {
    const seen = new Set<object>();
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const objectValue = value as object;
      if (seen.has(objectValue)) return;
      seen.add(objectValue);
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const record = value as ValueRecord;
      const parameter = record.parameter as ValueRecord | undefined;
      if (parameter?.declarationId === declarationId && typeof parameter.index === 'number') {
        const replacement = replacements.get(parameter.index);
        if (replacement) record.parameter = jsonClone(replacement);
      }
      Object.values(record).forEach(visit);
    };
    visit(root);
  };
  const phase87LocalRangePair = (name: string, mode: 'swap' | 'overlap'): Phase87PairAttack => {
    if (!identityAttackAuthority) return { name, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'local identity authority missing' } };
    const candidateProgram = jsonClone(identityAttackProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(identityAttackAuthority) as unknown as ValueRecord;
    const programIdentities = candidateProgram.localIdentities as ValueRecord;
    const authorityIdentities = candidateAuthority.localIdentities as ValueRecord;
    const programFunctions = programIdentities.functions as ValueRecord[];
    const authorityFunctions = authorityIdentities.functions as ValueRecord[];
    const functionIndex = programFunctions.findIndex(candidate => Array.isArray(candidate.parameters) && (candidate.parameters as ValueRecord[]).length >= 2);
    const functionValue = functionIndex >= 0 ? programFunctions[functionIndex] : undefined;
    const authorityFunction = functionValue ? authorityFunctions.find(candidate => candidate.id === functionValue.id) : undefined;
    const parameters = functionValue?.parameters as ValueRecord[] | undefined;
    const authorityParameters = authorityFunction?.parameters as ValueRecord[] | undefined;
    const beforeParameters = parameters ? jsonClone(parameters) as ValueRecord[] : [];
    const declarationId = typeof functionValue?.id === 'string' ? functionValue.id : undefined;
    if (parameters && authorityParameters && declarationId) {
      const firstSource = jsonClone(parameters[0].source) as ValueRecord;
      const secondSource = jsonClone(parameters[1].source) as ValueRecord;
      const nextSources = mode === 'swap' ? [secondSource, firstSource] : [firstSource, firstSource];
      const replacements = new Map<number, ValueRecord>();
      for (const [index, parameter] of parameters.entries()) {
        const next = { ...parameter, source: jsonClone(nextSources[index] || parameter.source) } as ValueRecord;
        next.id = auditLocalParameterId(declarationId, Number(parameter.index), next.source as ValueRecord);
        replacements.set(Number(parameter.index), next);
        parameters[index] = next;
        authorityParameters[index] = jsonClone(next);
      }
      for (const operationValue of candidateProgram.operations as ValueRecord[]) phase87ReplaceParameterReferences(operationValue.metadata, declarationId, replacements);
      for (const operationValue of candidateAuthority.operations as ValueRecord[]) phase87ReplaceParameterReferences((operationValue.snapshot as ValueRecord | undefined)?.metadata, declarationId, replacements);
    }
    const afterParameters = parameters || [];
    const afterSources = afterParameters.map(parameter => parameter.source);
    const sourceChanged = beforeParameters.length >= 2 && !sameJson(beforeParameters.map(parameter => parameter.source), afterSources);
    const beforeFirstSource = beforeParameters[0]?.source as ValueRecord | undefined;
    const afterFirstSource = afterParameters[0]?.source as ValueRecord | undefined;
    const beforeFirstStart = beforeFirstSource?.start as ValueRecord | undefined;
    const afterFirstStart = afterFirstSource?.start as ValueRecord | undefined;
    const sourceOrderChanged = beforeParameters.length >= 2
      && Number(afterFirstStart?.offset) !== Number(beforeFirstStart?.offset);
    const overlapping = beforeParameters.length >= 2
      && sameJson(afterParameters[0].source, afterParameters[1].source)
      && afterParameters[0].id !== afterParameters[1].id
      && afterParameters[0].index !== afterParameters[1].index;
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: functionValue !== undefined
          && authorityFunction !== undefined
          && parameters !== undefined
          && authorityParameters !== undefined
          && parameters.length >= 2
          && sameJson(parameters, authorityParameters)
          && parameters.every(parameter => parameter.id === auditLocalParameterId(declarationId || '', Number(parameter.index), parameter.source as ValueRecord)),
        declarationId,
        beforeParameters,
        afterParameters,
        sourceChanged,
        sourceOrderChanged,
        overlapping,
        mode,
      },
    };
  };
  const phase87LocalRangeAttacks = [
    phase87LocalRangePair('swapped parameter ranges with recomputed IDs', 'swap'),
    phase87LocalRangePair('overlapping parameter ranges with distinct index IDs', 'overlap'),
  ];
  const phase87LocalRangeBaseline = identityAttackAuthority ? safeSchemaPairValidation(identityAttackProgram, identityAttackAuthority) : { threw: false, valid: false };
  for (const attack of phase87LocalRangeAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'local range fixture missing' };
    const proof = attack.proof;
    check(`8A.7 fail-first local parameter ${attack.name}`,
      phase87LocalRangeBaseline.valid === true
        && proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: phase87LocalRangeBaseline, proof, validation }));
  }

  const phase87SiblingSource = [
    'local menu = { name = "Phase87Siblings", layer = 1 }',
    'local frameA = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableA = frameA:addTable(1, { width = 80, reserveScrollBar = false })',
    'tableA:setColWidth(1, 20, false)',
    'local rowA = tableA:addRow(false, {})',
    'rowA[1]:createText("A", { height = 4 })',
    'local frameB = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableB = frameB:addTable(1, { width = 80, reserveScrollBar = false })',
    'tableB:setColWidth(1, 20, false)',
    'local rowB = tableB:addRow(false, {})',
    'rowB[1]:createText("B", { height = 4 })',
    'frameA:display()',
    'frameB:display()',
  ].join('\n');
  const phase87SiblingModel = buildX4UiCallModel(input(phase87SiblingSource, 'selftest/phase87-siblings.lua'));
  const phase87SiblingResult = projectX4UiLayoutProgram(
    phase87SiblingModel,
    topTarget(phase87SiblingModel),
    profileFor(phase87SiblingModel),
  );
  const phase87SiblingProgram = resultProgram(phase87SiblingResult);
  const phase87SiblingAuthority = evidenceAuthorityOf(phase87SiblingResult);
  const phase87SiblingFrameA = phase87SiblingProgram?.frames.find(node => node.identity?.path === 'frameA');
  const phase87SiblingFrameB = phase87SiblingProgram?.frames.find(node => node.identity?.path === 'frameB');
  const phase87SiblingTableA = phase87SiblingProgram?.tables.find(node => node.identity?.path === 'tableA');
  const phase87SiblingTableB = phase87SiblingProgram?.tables.find(node => node.identity?.path === 'tableB');
  const phase87SiblingRowA = phase87SiblingProgram?.rows.find(node => node.identity?.path === 'rowA');
  const phase87SiblingRowB = phase87SiblingProgram?.rows.find(node => node.identity?.path === 'rowB');
  const phase87SiblingCellA = phase87SiblingProgram?.cells.find(node => node.identity?.path === 'rowA[1]');
  const phase87SiblingCellB = phase87SiblingProgram?.cells.find(node => node.identity?.path === 'rowB[1]');
  const phase87SiblingTransfer = (
    name: string,
    predicate: (operationValue: ValueRecord) => boolean,
    transfers: readonly { readonly field: Phase87OwnerField; readonly targetId: string | undefined }[],
  ): Phase87PairAttack => {
    if (!phase87SiblingProgram || !phase87SiblingAuthority) return { name, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'sibling fixture missing' } };
    const candidateProgram = jsonClone(phase87SiblingProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87SiblingAuthority) as unknown as ValueRecord;
    const operationIndex = (candidateProgram.operations as ValueRecord[]).findIndex(predicate);
    const operationValue = (candidateProgram.operations as ValueRecord[])[operationIndex];
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const mutations = operationValue
      ? transfers.map(transfer => phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, transfer.field, transfer.targetId))
      : [];
    const changed = transfers.every((transfer, index) => mutations[index]?.changed === true && operationValue?.[transfer.field] === transfer.targetId);
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: operationValue !== undefined
          && operationValue.status === 'applied'
          && phase87SiblingFrameA !== undefined
          && phase87SiblingFrameB !== undefined
          && phase87SiblingTableA !== undefined
          && phase87SiblingTableB !== undefined
          && phase87SiblingFrameA.width === phase87SiblingFrameB.width
          && changed
          && transfers.every(transfer => typeof transfer.targetId === 'string')
          && transfers.every(transfer => before[transfer.field] !== transfer.targetId),
        operationIndex,
        operationKind: operationValue?.kind,
        beforeOwners: Object.fromEntries(transfers.map(transfer => [transfer.field, before[transfer.field]])),
        afterOwners: operationValue ? Object.fromEntries(transfers.map(transfer => [transfer.field, operationValue[transfer.field]])) : {},
        mutations,
        sameWidth: phase87SiblingFrameA?.width === phase87SiblingFrameB?.width,
      },
    };
  };
  const phase87SiblingAttacks = [
    phase87SiblingTransfer('createFrameHandle to frameB', operationValue => operationValue.kind === 'createFrameHandle' && operationValue.frameId === phase87SiblingFrameA?.id, [{ field: 'frameId', targetId: phase87SiblingFrameB?.id }]),
    phase87SiblingTransfer('display to frameB', operationValue => operationValue.kind === 'display' && operationValue.frameId === phase87SiblingFrameA?.id, [{ field: 'frameId', targetId: phase87SiblingFrameB?.id }]),
    phase87SiblingTransfer('setColWidth to same-width tableB', operationValue => operationValue.kind === 'setColWidth' && operationValue.tableId === phase87SiblingTableA?.id && operationValue.status === 'applied', [{ field: 'tableId', targetId: phase87SiblingTableB?.id }]),
    phase87SiblingTransfer('addRow to tableB+rowB', operationValue => operationValue.kind === 'addRow' && operationValue.tableId === phase87SiblingTableA?.id && operationValue.rowId === phase87SiblingRowA?.id && operationValue.status === 'applied', [{ field: 'tableId', targetId: phase87SiblingTableB?.id }, { field: 'rowId', targetId: phase87SiblingRowB?.id }]),
    phase87SiblingTransfer('createText to tableB+rowB+cellB', operationValue => operationValue.kind === 'createText' && operationValue.tableId === phase87SiblingTableA?.id && operationValue.rowId === phase87SiblingRowA?.id && operationValue.cellId === phase87SiblingCellA?.id && operationValue.status === 'applied', [{ field: 'tableId', targetId: phase87SiblingTableB?.id }, { field: 'rowId', targetId: phase87SiblingRowB?.id }, { field: 'cellId', targetId: phase87SiblingCellB?.id }]),
  ];
  const phase87SiblingBaseline = phase87SiblingProgram && phase87SiblingAuthority
    ? safeSchemaPairValidation(phase87SiblingProgram, phase87SiblingAuthority)
    : { threw: false, valid: false, reason: 'sibling fixture missing' };
  for (const attack of phase87SiblingAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'sibling fixture missing' };
    check(`8A.7 fail-first identical-shape sibling binding ${attack.name}`,
      phase87SiblingBaseline.valid === true
        && attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: phase87SiblingBaseline, proof: attack.proof, validation }));
  }

  const phase87ResidualNonAppliedSource = [
    'local menu = { name = "Phase87ResidualNonApplied", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false })',
    'local row = table:addRow(false, {})',
    'table:setColWidth(getIndex(), getWidth(), getScaling())',
    'table:addRow(false, { paddingTop = getPadding() })',
    'row[1]:setColSpan(getSpan())',
    'row[1]:createButton({ height = getHeight() })',
    'row[1]:createText(getText(), { height = getHeight() })',
    'row[1]:createEditBox({ height = getHeight() })',
    'row[1]:createIcon(getIcon(), { height = getHeight() })',
    'if choice then frame:display() end',
    'if false then frame:display() end',
  ].join('\n');
  const phase87ResidualNonAppliedModel = buildX4UiCallModel(input(
    phase87ResidualNonAppliedSource,
    'selftest/phase87-residual-non-applied.lua',
  ));
  const phase87ResidualNonAppliedResult = projectX4UiLayoutProgram(
    phase87ResidualNonAppliedModel,
    topTarget(phase87ResidualNonAppliedModel),
    profileFor(phase87ResidualNonAppliedModel),
  );
  const phase87ResidualNonAppliedProgram = resultProgram(phase87ResidualNonAppliedResult);
  const phase87ResidualNonAppliedAuthority = evidenceAuthorityOf(phase87ResidualNonAppliedResult);
  const phase87ResidualNonAppliedBaseline = phase87ResidualNonAppliedProgram && phase87ResidualNonAppliedAuthority
    ? safeSchemaPairValidation(phase87ResidualNonAppliedProgram, phase87ResidualNonAppliedAuthority)
    : { threw: false, valid: false, reason: 'non-applied fixture missing' };
  const phase87ResidualOperationIndex = (
    sourceProgram: X4UiLayoutProgram | undefined,
    kind: string,
    status: string,
    occurrence = 0,
  ): number => {
    if (!sourceProgram) return -1;
    let remaining = occurrence;
    return sourceProgram.operations.findIndex(candidate => {
      if (candidate.kind !== kind || candidate.status !== status) return false;
      if (remaining > 0) {
        remaining -= 1;
        return false;
      }
      return true;
    });
  };
  type Phase87ResidualOwnerRemovalSpec = {
    readonly label: string;
    readonly kind: string;
    readonly status: string;
    readonly field: Phase87OwnerField;
    readonly occurrence?: number;
  };
  const phase87ResidualOwnerRemovalSpecs: readonly Phase87ResidualOwnerRemovalSpec[] = [
    { label: 'dynamic unresolved width table owner', kind: 'setColWidth', status: 'unresolved', field: 'tableId' },
    { label: 'unresolved addRow table owner', kind: 'addRow', status: 'unresolved', field: 'tableId' },
    { label: 'unresolved addRow row owner', kind: 'addRow', status: 'unresolved', field: 'rowId' },
    { label: 'unresolved span table owner', kind: 'setColSpan', status: 'unresolved', field: 'tableId' },
    { label: 'unresolved span row owner', kind: 'setColSpan', status: 'unresolved', field: 'rowId' },
    { label: 'unresolved span cell owner', kind: 'setColSpan', status: 'unresolved', field: 'cellId' },
    { label: 'descriptor-partial button table owner', kind: 'createButton', status: 'unresolved', field: 'tableId' },
    { label: 'descriptor-partial button row owner', kind: 'createButton', status: 'unresolved', field: 'rowId' },
    { label: 'descriptor-partial button cell owner', kind: 'createButton', status: 'unresolved', field: 'cellId' },
    { label: 'descriptor-partial text table owner', kind: 'createText', status: 'unresolved', field: 'tableId' },
    { label: 'descriptor-partial text row owner', kind: 'createText', status: 'unresolved', field: 'rowId' },
    { label: 'descriptor-partial text cell owner', kind: 'createText', status: 'unresolved', field: 'cellId' },
    { label: 'descriptor-partial editbox table owner', kind: 'createEditBox', status: 'unresolved', field: 'tableId' },
    { label: 'descriptor-partial editbox row owner', kind: 'createEditBox', status: 'unresolved', field: 'rowId' },
    { label: 'descriptor-partial editbox cell owner', kind: 'createEditBox', status: 'unresolved', field: 'cellId' },
    { label: 'descriptor-partial icon table owner', kind: 'createIcon', status: 'unresolved', field: 'tableId' },
    { label: 'descriptor-partial icon row owner', kind: 'createIcon', status: 'unresolved', field: 'rowId' },
    { label: 'descriptor-partial icon cell owner', kind: 'createIcon', status: 'unresolved', field: 'cellId' },
    { label: 'conditional display frame owner', kind: 'display', status: 'conditional', field: 'frameId' },
    { label: 'unreachable display frame owner', kind: 'display', status: 'unreachable', field: 'frameId' },
  ];
  const phase87ResidualOwnerRemovalPair = (
    spec: Phase87ResidualOwnerRemovalSpec,
  ): Phase87PairAttack => {
    if (!phase87ResidualNonAppliedProgram || !phase87ResidualNonAppliedAuthority) {
      return { name: spec.label, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'non-applied fixture missing' } };
    }
    const candidateProgram = jsonClone(phase87ResidualNonAppliedProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87ResidualNonAppliedAuthority) as unknown as ValueRecord;
    const operationIndex = phase87ResidualOperationIndex(
      phase87ResidualNonAppliedProgram,
      spec.kind,
      spec.status,
      spec.occurrence,
    );
    const operationValue = operationIndex >= 0
      ? (candidateProgram.operations as ValueRecord[])[operationIndex]
      : undefined;
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const mutation = operationIndex >= 0
      ? phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, spec.field, undefined)
      : { changed: false } as ValueRecord;
    const after = operationValue?.[spec.field];
    return {
      name: spec.label,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: phase87ResidualNonAppliedBaseline.valid === true
          && operationValue !== undefined
          && operationValue.kind === spec.kind
          && operationValue.status === spec.status
          && typeof before[spec.field] === 'string'
          && after === undefined
          && mutation.changed === true,
        matrixCardinality: phase87ResidualOwnerRemovalSpecs.length,
        operationIndex,
        operationKind: operationValue?.kind,
        operationStatus: operationValue?.status,
        field: spec.field,
        beforeOwner: before[spec.field],
        afterOwner: after,
        mutation,
      },
    };
  };
  const phase87ResidualOwnerRemovalAttacks = phase87ResidualOwnerRemovalSpecs.map(phase87ResidualOwnerRemovalPair);
  for (const attack of phase87ResidualOwnerRemovalAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'non-applied owner removal fixture missing' };
    check(`8A.7 residual non-applied owner removal ${attack.name}`,
      attack.proof.fixtureReady === true
        && attack.proof.matrixCardinality === 20
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: phase87ResidualNonAppliedBaseline, proof: attack.proof, validation, currentValidatorAccepted: validation.valid === true }));
  }

  const phase87ResidualOwnerAdditionSource = [
    'local menu = { name = "Phase87ResidualOwnerAdditions", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 60, reserveScrollBar = false })',
    'local row = table:addRow(false, {})',
    'local other = {}',
    'other:createButton({})',
    'other:createText("pending", { height = getHeight() })',
    'other:createEditBox({ height = getHeight() })',
    'other:createIcon("solid", { height = getHeight() })',
  ].join('\n');
  const phase87ResidualOwnerAdditionModel = buildX4UiCallModel(input(
    phase87ResidualOwnerAdditionSource,
    'selftest/phase87-residual-owner-additions.lua',
  ));
  const phase87ResidualOwnerAdditionResult = projectX4UiLayoutProgram(
    phase87ResidualOwnerAdditionModel,
    topTarget(phase87ResidualOwnerAdditionModel),
    profileFor(phase87ResidualOwnerAdditionModel),
  );
  const phase87ResidualOwnerAdditionProgram = resultProgram(phase87ResidualOwnerAdditionResult);
  const phase87ResidualOwnerAdditionAuthority = evidenceAuthorityOf(phase87ResidualOwnerAdditionResult);
  const phase87ResidualOwnerAdditionBaseline = phase87ResidualOwnerAdditionProgram && phase87ResidualOwnerAdditionAuthority
    ? safeSchemaPairValidation(phase87ResidualOwnerAdditionProgram, phase87ResidualOwnerAdditionAuthority)
    : { threw: false, valid: false, reason: 'owner addition fixture missing' };
  const phase87ResidualOwnerAdditionTable = phase87ResidualOwnerAdditionProgram?.tables.find(candidate => candidate.identity?.path === 'table');
  const phase87ResidualOwnerAdditionRow = phase87ResidualOwnerAdditionProgram?.rows.find(candidate => candidate.identity?.path === 'row');
  const phase87ResidualOwnerAdditionCell = phase87ResidualOwnerAdditionProgram?.cells.find(candidate => candidate.rowId === phase87ResidualOwnerAdditionRow?.id);
  const phase87ResidualOwnerTargets: Readonly<Record<Phase87OwnerField, string | undefined>> = {
    frameId: phase87ResidualOwnerAdditionProgram?.frames[0]?.id,
    tableId: phase87ResidualOwnerAdditionTable?.id,
    rowId: phase87ResidualOwnerAdditionRow?.id,
    cellId: phase87ResidualOwnerAdditionCell?.id,
  };
  type Phase87ResidualOwnerAdditionSpec = {
    readonly label: string;
    readonly kind: string;
    readonly fields: readonly Phase87OwnerField[];
  };
  const phase87ResidualOwnerAdditionSpecs: readonly Phase87ResidualOwnerAdditionSpec[] = [
    { label: 'unknown button receives table owner', kind: 'createButton', fields: ['tableId'] },
    { label: 'unknown text receives row owner', kind: 'createText', fields: ['rowId'] },
    { label: 'unknown editbox receives cell owner', kind: 'createEditBox', fields: ['cellId'] },
    { label: 'unknown icon receives fabricated complete ancestry', kind: 'createIcon', fields: ['tableId', 'rowId', 'cellId'] },
  ];
  const phase87ResidualOwnerAdditionPair = (spec: Phase87ResidualOwnerAdditionSpec): Phase87PairAttack => {
    if (!phase87ResidualOwnerAdditionProgram || !phase87ResidualOwnerAdditionAuthority) {
      return { name: spec.label, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'owner addition fixture missing' } };
    }
    const candidateProgram = jsonClone(phase87ResidualOwnerAdditionProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87ResidualOwnerAdditionAuthority) as unknown as ValueRecord;
    const operationIndex = (candidateProgram.operations as ValueRecord[]).findIndex(operationValue =>
      operationValue.kind === spec.kind && operationValue.status === 'unresolved');
    const operationValue = operationIndex >= 0 ? (candidateProgram.operations as ValueRecord[])[operationIndex] : undefined;
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const mutations = operationIndex >= 0
      ? spec.fields.map(field => phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, field, phase87ResidualOwnerTargets[field]))
      : [];
    const after = operationValue || {};
    return {
      name: spec.label,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: phase87ResidualOwnerAdditionBaseline.valid === true
          && operationValue !== undefined
          && operationValue.kind === spec.kind
          && operationValue.status === 'unresolved'
          && spec.fields.every((field, index) => before[field] === undefined
            && typeof phase87ResidualOwnerTargets[field] === 'string'
            && after[field] === phase87ResidualOwnerTargets[field]
            && mutations[index]?.changed === true),
        matrixCardinality: phase87ResidualOwnerAdditionSpecs.length,
        operationIndex,
        operationKind: operationValue?.kind,
        operationStatus: operationValue?.status,
        fields: spec.fields,
        beforeOwners: Object.fromEntries(spec.fields.map(field => [field, before[field]])),
        afterOwners: Object.fromEntries(spec.fields.map(field => [field, after[field]])),
        mutations,
      },
    };
  };
  const phase87ResidualOwnerAdditionAttacks = phase87ResidualOwnerAdditionSpecs.map(phase87ResidualOwnerAdditionPair);
  for (const attack of phase87ResidualOwnerAdditionAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'owner addition fixture missing' };
    check(`8A.7 residual partial-owner addition ${attack.name}`,
      attack.proof.fixtureReady === true
        && attack.proof.matrixCardinality === 4
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: phase87ResidualOwnerAdditionBaseline, proof: attack.proof, validation, currentValidatorAccepted: validation.valid === true }));
  }

  const phase87ResidualCrossPair = (
    name: string,
    predicate: (operationValue: ValueRecord) => boolean,
    transfers: readonly { readonly field: Phase87OwnerField; readonly targetId: string | undefined }[],
  ): Phase87PairAttack => {
    if (!phase87SiblingProgram || !phase87SiblingAuthority) {
      return { name, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'sibling fixture missing' } };
    }
    const candidateProgram = jsonClone(phase87SiblingProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87SiblingAuthority) as unknown as ValueRecord;
    const operationIndex = (candidateProgram.operations as ValueRecord[]).findIndex(predicate);
    const operationValue = operationIndex >= 0 ? (candidateProgram.operations as ValueRecord[])[operationIndex] : undefined;
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const mutations = operationIndex >= 0
      ? transfers.map(transfer => phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, transfer.field, transfer.targetId))
      : [];
    const metadata = operationValue?.metadata as ValueRecord | undefined;
    const beforeMetadata = before.metadata as ValueRecord | undefined;
    const afterReceiver = (metadata?.receiver as ValueRecord | undefined)?.reference;
    const beforeReceiver = (beforeMetadata?.receiver as ValueRecord | undefined)?.reference;
    const afterResult = metadata?.result;
    const beforeResult = beforeMetadata?.result;
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: phase87SiblingBaseline.valid === true
          && operationValue !== undefined
          && operationValue.status === 'applied'
          && transfers.every((transfer, index) => typeof transfer.targetId === 'string'
            && before[transfer.field] !== transfer.targetId
            && operationValue[transfer.field] === transfer.targetId
            && mutations[index]?.changed === true)
          && transfers.some(transfer => before[transfer.field] !== operationValue[transfer.field])
          && sameJson(afterReceiver, beforeReceiver)
          && sameJson(afterResult, beforeResult),
        operationIndex,
        operationKind: operationValue?.kind,
        beforeOwners: Object.fromEntries(transfers.map(transfer => [transfer.field, before[transfer.field]])),
        afterOwners: Object.fromEntries(transfers.map(transfer => [transfer.field, operationValue?.[transfer.field]])),
        receiverUnchanged: sameJson(afterReceiver, beforeReceiver),
        resultUnchanged: sameJson(afterResult, beforeResult),
        mutations,
      },
    };
  };
  const phase87ResidualCrossAttacks = [
    phase87ResidualCrossPair(
      'addRow table owner only',
      operationValue => operationValue.kind === 'addRow'
        && operationValue.tableId === phase87SiblingTableA?.id
        && operationValue.rowId === phase87SiblingRowA?.id
        && operationValue.status === 'applied',
      [{ field: 'tableId', targetId: phase87SiblingTableB?.id }],
    ),
    phase87ResidualCrossPair(
      'createText table owner only',
      operationValue => operationValue.kind === 'createText'
        && operationValue.tableId === phase87SiblingTableA?.id
        && operationValue.rowId === phase87SiblingRowA?.id
        && operationValue.cellId === phase87SiblingCellA?.id
        && operationValue.status === 'applied',
      [{ field: 'tableId', targetId: phase87SiblingTableB?.id }],
    ),
    phase87ResidualCrossPair(
      'createText row owner only',
      operationValue => operationValue.kind === 'createText'
        && operationValue.tableId === phase87SiblingTableA?.id
        && operationValue.rowId === phase87SiblingRowA?.id
        && operationValue.cellId === phase87SiblingCellA?.id
        && operationValue.status === 'applied',
      [{ field: 'rowId', targetId: phase87SiblingRowB?.id }],
    ),
  ];
  for (const attack of phase87ResidualCrossAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'cross-ancestor fixture missing' };
    check(`8A.7 residual mixed cross-ancestor ${attack.name}`,
      attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: phase87SiblingBaseline, proof: attack.proof, validation, currentValidatorAccepted: validation.valid === true }));
  }

  const phase87ResidualSiblingSource = [
    'local menu = { name = "Phase87ResidualSiblings", layer = 1 }',
    'local frameA = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableA = frameA:addTable(1, { width = 80, reserveScrollBar = false })',
    'local rowA = tableA:addRow(false, {})',
    'local frameB = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableB = frameB:addTable(1, { width = 80, reserveScrollBar = false })',
    'local rowB = tableB:addRow(false, {})',
    'rowB[1]:createText("sibling", { height = getHeight() })',
    'tableA:setColWidth(getIndex(), getWidth(), getScaling())',
    'rowA[1]:createText("pending", { height = getHeight() })',
    'if choice then frameA:display() end',
    'if choice then tableA:addRow(false, { paddingTop = getPadding() }) end',
  ].join('\n');
  const phase87ResidualSiblingModel = buildX4UiCallModel(input(
    phase87ResidualSiblingSource,
    'selftest/phase87-residual-siblings.lua',
  ));
  const phase87ResidualSiblingResult = projectX4UiLayoutProgram(
    phase87ResidualSiblingModel,
    topTarget(phase87ResidualSiblingModel),
    profileFor(phase87ResidualSiblingModel),
  );
  const phase87ResidualSiblingProgram = resultProgram(phase87ResidualSiblingResult);
  const phase87ResidualSiblingAuthority = evidenceAuthorityOf(phase87ResidualSiblingResult);
  const phase87ResidualSiblingBaseline = phase87ResidualSiblingProgram && phase87ResidualSiblingAuthority
    ? safeSchemaPairValidation(phase87ResidualSiblingProgram, phase87ResidualSiblingAuthority)
    : { threw: false, valid: false, reason: 'residual sibling fixture missing' };
  const phase87ResidualSiblingFrameA = phase87ResidualSiblingProgram?.frames.find(node => node.identity?.path === 'frameA');
  const phase87ResidualSiblingFrameB = phase87ResidualSiblingProgram?.frames.find(node => node.identity?.path === 'frameB');
  const phase87ResidualSiblingTableA = phase87ResidualSiblingProgram?.tables.find(node => node.identity?.path === 'tableA');
  const phase87ResidualSiblingTableB = phase87ResidualSiblingProgram?.tables.find(node => node.identity?.path === 'tableB');
  const phase87ResidualSiblingRowA = phase87ResidualSiblingProgram?.rows.find(node => node.identity?.path === 'rowA');
  const phase87ResidualSiblingRowB = phase87ResidualSiblingProgram?.rows.find(node => node.identity?.path === 'rowB');
  const phase87ResidualSiblingCellA = phase87ResidualSiblingProgram?.cells.find(node => node.identity?.path === 'rowA[1]');
  const phase87ResidualSiblingCellB = phase87ResidualSiblingProgram?.cells.find(node => node.identity?.path === 'rowB[1]');
  const phase87ResidualSiblingTransfer = (
    name: string,
    predicate: (operationValue: ValueRecord) => boolean,
    transfers: readonly { readonly field: Phase87OwnerField; readonly targetId: string | undefined }[],
  ): Phase87PairAttack => {
    if (!phase87ResidualSiblingProgram || !phase87ResidualSiblingAuthority) {
      return { name, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'residual sibling fixture missing' } };
    }
    const candidateProgram = jsonClone(phase87ResidualSiblingProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87ResidualSiblingAuthority) as unknown as ValueRecord;
    const operationIndex = (candidateProgram.operations as ValueRecord[]).findIndex(predicate);
    const operationValue = operationIndex >= 0 ? (candidateProgram.operations as ValueRecord[])[operationIndex] : undefined;
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const mutations = operationIndex >= 0
      ? transfers.map(transfer => phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, transfer.field, transfer.targetId))
      : [];
    const metadata = operationValue?.metadata as ValueRecord | undefined;
    const beforeMetadata = before.metadata as ValueRecord | undefined;
    const receiver = (metadata?.receiver as ValueRecord | undefined)?.reference;
    const beforeReceiver = (beforeMetadata?.receiver as ValueRecord | undefined)?.reference;
    const resultIdentity = metadata?.result;
    const beforeResultIdentity = beforeMetadata?.result;
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: phase87ResidualSiblingBaseline.valid === true
          && operationValue !== undefined
          && operationValue.status !== 'applied'
          && transfers.every((transfer, index) => typeof transfer.targetId === 'string'
            && before[transfer.field] !== transfer.targetId
            && operationValue[transfer.field] === transfer.targetId
            && mutations[index]?.changed === true)
          && phase87ResidualSiblingFrameA !== undefined
          && phase87ResidualSiblingFrameB !== undefined
          && phase87ResidualSiblingTableA !== undefined
          && phase87ResidualSiblingTableB !== undefined
          && phase87ResidualSiblingRowA !== undefined
          && phase87ResidualSiblingRowB !== undefined
          && phase87ResidualSiblingCellA !== undefined
          && phase87ResidualSiblingCellB !== undefined
          && phase87ResidualSiblingFrameA.width === phase87ResidualSiblingFrameB.width
          && sameJson(receiver, beforeReceiver)
          && sameJson(resultIdentity, beforeResultIdentity),
        operationIndex,
        operationKind: operationValue?.kind,
        operationStatus: operationValue?.status,
        beforeOwners: Object.fromEntries(transfers.map(transfer => [transfer.field, before[transfer.field]])),
        afterOwners: Object.fromEntries(transfers.map(transfer => [transfer.field, operationValue?.[transfer.field]])),
        receiverUnchanged: sameJson(receiver, beforeReceiver),
        resultUnchanged: sameJson(resultIdentity, beforeResultIdentity),
        sameWidth: phase87ResidualSiblingFrameA?.width === phase87ResidualSiblingFrameB?.width,
        mutations,
      },
    };
  };
  const phase87ResidualSiblingAttacks = [
    phase87ResidualSiblingTransfer(
      'unresolved width to tableB',
      operationValue => operationValue.kind === 'setColWidth'
        && operationValue.status === 'unresolved'
        && operationValue.tableId === phase87ResidualSiblingTableA?.id,
      [{ field: 'tableId', targetId: phase87ResidualSiblingTableB?.id }],
    ),
    phase87ResidualSiblingTransfer(
      'unresolved text to tableB rowB cellB',
      operationValue => operationValue.kind === 'createText'
        && operationValue.status === 'unresolved'
        && operationValue.tableId === phase87ResidualSiblingTableA?.id
        && operationValue.rowId === phase87ResidualSiblingRowA?.id
        && operationValue.cellId === phase87ResidualSiblingCellA?.id,
      [
        { field: 'tableId', targetId: phase87ResidualSiblingTableB?.id },
        { field: 'rowId', targetId: phase87ResidualSiblingRowB?.id },
        { field: 'cellId', targetId: phase87ResidualSiblingCellB?.id },
      ],
    ),
    phase87ResidualSiblingTransfer(
      'conditional display to frameB',
      operationValue => operationValue.kind === 'display'
        && operationValue.status === 'conditional'
        && operationValue.frameId === phase87ResidualSiblingFrameA?.id,
      [{ field: 'frameId', targetId: phase87ResidualSiblingFrameB?.id }],
    ),
    phase87ResidualSiblingTransfer(
      'conditional addRow to tableB rowB',
      operationValue => operationValue.kind === 'addRow'
        && operationValue.status === 'conditional'
        && operationValue.tableId === phase87ResidualSiblingTableA?.id,
      [
        { field: 'tableId', targetId: phase87ResidualSiblingTableB?.id },
        { field: 'rowId', targetId: phase87ResidualSiblingRowB?.id },
      ],
    ),
  ];
  for (const attack of phase87ResidualSiblingAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'residual sibling fixture missing' };
    check(`8A.7 residual non-applied sibling substitution ${attack.name}`,
      attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ baseline: phase87ResidualSiblingBaseline, proof: attack.proof, validation, currentValidatorAccepted: validation.valid === true }));
  }

  const phase87ResidualTopologyPair = (
    name: string,
    mutate: (candidateProgram: ValueRecord, candidateAuthority: ValueRecord, before: ValueRecord) => ValueRecord,
  ): Phase87PairAttack => {
    if (!phase87PositiveAuthority) {
      return { name, program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'positive authority missing' } };
    }
    const candidateProgram = jsonClone(program) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase87PositiveAuthority) as unknown as ValueRecord;
    const before = jsonClone(candidateProgram) as ValueRecord;
    const proof = mutate(candidateProgram, candidateAuthority, before);
    return {
      name,
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: { ...proof, baseline: phase87TopologyBaseline },
    };
  };
  const phase87AuthorityNodeSnapshot = (
    candidateAuthority: ValueRecord,
    collection: Phase87NodeCollection,
    id: string | undefined,
  ): ValueRecord | undefined => {
    if (!id) return undefined;
    const nodes = (candidateAuthority.nodes as ValueRecord)[collection] as ValueRecord[] | undefined;
    return nodes?.find(candidate => candidate.id === id)?.snapshot as ValueRecord | undefined;
  };
  const phase87ResidualTopologyAttacks = [
    phase87ResidualTopologyPair('applied row tableId removed with table rowIds removal', (candidateProgram, candidateAuthority, before) => {
      const rowId = phase87RowA?.id;
      const row = (candidateProgram.rows as ValueRecord[]).find(candidate => candidate.id === rowId);
      const table = (candidateProgram.tables as ValueRecord[]).find(candidate => candidate.id === phase87TableA?.id);
      const rowSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'rows', rowId);
      const tableSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'tables', phase87TableA?.id);
      const beforeRow = (before.rows as ValueRecord[]).find(candidate => candidate.id === rowId);
      const beforeTable = (before.tables as ValueRecord[]).find(candidate => candidate.id === phase87TableA?.id);
      if (row && table && rowSnapshot && tableSnapshot) {
        delete row.tableId;
        delete rowSnapshot.tableId;
        table.rowIds = (table.rowIds as string[]).filter(candidate => candidate !== rowId);
        tableSnapshot.rowIds = (tableSnapshot.rowIds as string[]).filter(candidate => candidate !== rowId);
      }
      return {
        fixtureReady: phase87TopologyBaseline.valid === true
          && row !== undefined
          && table !== undefined
          && rowSnapshot !== undefined
          && tableSnapshot !== undefined
          && beforeRow?.tableId === phase87TableA?.id
          && (beforeTable?.rowIds as string[] | undefined)?.includes(rowId || '') === true
          && row.tableId === undefined
          && !(table.rowIds as string[]).includes(rowId || '')
          && rowSnapshot.tableId === undefined
          && !(tableSnapshot.rowIds as string[]).includes(rowId || ''),
        rowId,
        beforeTableId: beforeRow?.tableId,
        afterTableId: row.tableId,
        beforeTableRowIds: beforeTable?.rowIds,
        afterTableRowIds: table.rowIds,
      };
    }),
    phase87ResidualTopologyPair('applied row rowIndex removed with table rowIds removal', (candidateProgram, candidateAuthority, before) => {
      const rowId = phase87RowA?.id;
      const row = (candidateProgram.rows as ValueRecord[]).find(candidate => candidate.id === rowId);
      const table = (candidateProgram.tables as ValueRecord[]).find(candidate => candidate.id === phase87TableA?.id);
      const rowSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'rows', rowId);
      const tableSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'tables', phase87TableA?.id);
      const beforeRow = (before.rows as ValueRecord[]).find(candidate => candidate.id === rowId);
      const beforeTable = (before.tables as ValueRecord[]).find(candidate => candidate.id === phase87TableA?.id);
      if (row && table && rowSnapshot && tableSnapshot) {
        delete row.rowIndex;
        delete rowSnapshot.rowIndex;
        table.rowIds = (table.rowIds as string[]).filter(candidate => candidate !== rowId);
        tableSnapshot.rowIds = (tableSnapshot.rowIds as string[]).filter(candidate => candidate !== rowId);
      }
      return {
        fixtureReady: phase87TopologyBaseline.valid === true
          && row !== undefined
          && table !== undefined
          && rowSnapshot !== undefined
          && tableSnapshot !== undefined
          && typeof beforeRow?.rowIndex === 'number'
          && (beforeTable?.rowIds as string[] | undefined)?.includes(rowId || '') === true
          && row.rowIndex === undefined
          && !(table.rowIds as string[]).includes(rowId || '')
          && rowSnapshot.rowIndex === undefined
          && !(tableSnapshot.rowIds as string[]).includes(rowId || ''),
        rowId,
        beforeRowIndex: beforeRow?.rowIndex,
        afterRowIndex: row.rowIndex,
        beforeTableRowIds: beforeTable?.rowIds,
        afterTableRowIds: table.rowIds,
      };
    }),
    phase87ResidualTopologyPair('applied cell rowId removed with row cellIds removal', (candidateProgram, candidateAuthority, before) => {
      const cellId = phase87CellA?.id;
      const rowId = phase87RowA?.id;
      const cell = (candidateProgram.cells as ValueRecord[]).find(candidate => candidate.id === cellId);
      const row = (candidateProgram.rows as ValueRecord[]).find(candidate => candidate.id === rowId);
      const cellSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'cells', cellId);
      const rowSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'rows', rowId);
      const beforeCell = (before.cells as ValueRecord[]).find(candidate => candidate.id === cellId);
      const beforeRow = (before.rows as ValueRecord[]).find(candidate => candidate.id === rowId);
      if (cell && row && cellSnapshot && rowSnapshot) {
        delete cell.rowId;
        delete cellSnapshot.rowId;
        row.cellIds = (row.cellIds as string[]).filter(candidate => candidate !== cellId);
        rowSnapshot.cellIds = (rowSnapshot.cellIds as string[]).filter(candidate => candidate !== cellId);
      }
      return {
        fixtureReady: phase87TopologyBaseline.valid === true
          && cell !== undefined
          && row !== undefined
          && cellSnapshot !== undefined
          && rowSnapshot !== undefined
          && beforeCell?.rowId === rowId
          && (beforeRow?.cellIds as string[] | undefined)?.includes(cellId || '') === true
          && cell.rowId === undefined
          && !(row.cellIds as string[]).includes(cellId || '')
          && cellSnapshot.rowId === undefined
          && !(rowSnapshot.cellIds as string[]).includes(cellId || ''),
        cellId,
        beforeRowId: beforeCell?.rowId,
        afterRowId: cell.rowId,
        beforeRowCellIds: beforeRow?.cellIds,
        afterRowCellIds: row.cellIds,
      };
    }),
    phase87ResidualTopologyPair('applied cell rowIndex removed', (candidateProgram, candidateAuthority, before) => {
      const cellId = phase87CellA?.id;
      const cell = (candidateProgram.cells as ValueRecord[]).find(candidate => candidate.id === cellId);
      const cellSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'cells', cellId);
      const beforeCell = (before.cells as ValueRecord[]).find(candidate => candidate.id === cellId);
      if (cell && cellSnapshot) {
        delete cell.rowIndex;
        delete cellSnapshot.rowIndex;
      }
      return {
        fixtureReady: phase87TopologyBaseline.valid === true
          && cell !== undefined
          && cellSnapshot !== undefined
          && typeof beforeCell?.rowIndex === 'number'
          && cell.rowIndex === undefined
          && cellSnapshot.rowIndex === undefined,
        cellId,
        beforeRowIndex: beforeCell?.rowIndex,
        afterRowIndex: cell.rowIndex,
      };
    }),
    phase87ResidualTopologyPair('materialized second row and cells moved to rowIndex 3', (candidateProgram, candidateAuthority, before) => {
      const secondRowId = phase87TableA
        ? program.rows.find(candidate => candidate.tableId === phase87TableA.id && candidate.id !== phase87RowA?.id && candidate.rowIndex === 2)?.id
        : undefined;
      const row = (candidateProgram.rows as ValueRecord[]).find(candidate => candidate.id === secondRowId);
      const rowSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'rows', secondRowId);
      const cells = (candidateProgram.cells as ValueRecord[]).filter(candidate => candidate.rowId === secondRowId);
      const beforeRow = (before.rows as ValueRecord[]).find(candidate => candidate.id === secondRowId);
      const beforeCells = (before.cells as ValueRecord[]).filter(candidate => candidate.rowId === secondRowId);
      const cellSnapshots = cells.map(cell => phase87AuthorityNodeSnapshot(candidateAuthority, 'cells', String(cell.id)));
      if (row && rowSnapshot && cellSnapshots.every(snapshot => snapshot !== undefined)) {
        row.rowIndex = 3;
        rowSnapshot.rowIndex = 3;
        for (const [index, cell] of cells.entries()) {
          cell.rowIndex = 3;
          (cellSnapshots[index] as ValueRecord).rowIndex = 3;
        }
      }
      return {
        fixtureReady: phase87TopologyBaseline.valid === true
          && row !== undefined
          && rowSnapshot !== undefined
          && cells.length >= 2
          && cells.every((cell, index) => beforeCells[index]?.rowIndex === 2 && cell.rowIndex === 3)
          && cellSnapshots.every(snapshot => snapshot !== undefined && snapshot.rowIndex === 3)
          && beforeRow?.rowIndex === 2
          && row.rowIndex === 3,
        rowId: secondRowId,
        cellIds: cells.map(cell => cell.id),
        beforeRowIndex: beforeRow?.rowIndex,
        afterRowIndex: row.rowIndex,
        beforeCellIndexes: beforeCells.map(cell => cell.rowIndex),
        afterCellIndexes: cells.map(cell => cell.rowIndex),
      };
    }),
    phase87ResidualTopologyPair('two-column base cell column moved beyond table columns', (candidateProgram, candidateAuthority, before) => {
      const twoColumnTableId = phase87TableB?.id;
      const baseCellId = phase87CellB?.id;
      const cell = (candidateProgram.cells as ValueRecord[]).find(candidate => candidate.id === baseCellId);
      const table = (candidateProgram.tables as ValueRecord[]).find(candidate => candidate.id === twoColumnTableId);
      const cellSnapshot = phase87AuthorityNodeSnapshot(candidateAuthority, 'cells', baseCellId);
      const beforeCell = (before.cells as ValueRecord[]).find(candidate => candidate.id === baseCellId);
      if (cell && cellSnapshot) {
        cell.column = 3;
        cellSnapshot.column = 3;
      }
      return {
        fixtureReady: phase87TopologyBaseline.valid === true
          && cell !== undefined
          && cellSnapshot !== undefined
          && table?.numColumns === 2
          && beforeCell?.identity === undefined
          && beforeCell?.operationIds !== undefined
          && (beforeCell.operationIds as string[]).length === 0
          && beforeCell.column === 1
          && cell.column === 3
          && cellSnapshot.column === 3,
        tableId: twoColumnTableId,
        cellId: baseCellId,
        numColumns: table?.numColumns,
        beforeColumn: beforeCell?.column,
        afterColumn: cell.column,
      };
    }),
  ];
  for (const attack of phase87ResidualTopologyAttacks) {
    const validation = attack.program && attack.authority
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'topology fixture missing' };
    check(`8A.7 residual materialized topology ${attack.name}`,
      attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ proof: attack.proof, validation, currentValidatorAccepted: validation.valid === true }));
  }

  type Phase87ProfileExtraCase = {
    readonly name: string;
    readonly mutate: (candidate: ValueRecord) => void;
    readonly hasExtra: (candidate: ValueRecord) => boolean;
  };
  const phase87ProfileExtraCases: readonly Phase87ProfileExtraCase[] = [
    {
      name: 'Helper constant pin extra key',
      mutate: candidate => {
        const constants = ((candidate.helper as ValueRecord).constants as ValueRecord);
        (constants.standardTextHeight as ValueRecord).auditExtra = true;
      },
      hasExtra: candidate => Object.prototype.hasOwnProperty.call(
        (((candidate.helper as ValueRecord).constants as ValueRecord).standardTextHeight as ValueRecord),
        'auditExtra',
      ),
    },
    {
      name: 'Helper constant pin source extra key',
      mutate: candidate => {
        const constants = ((candidate.helper as ValueRecord).constants as ValueRecord);
        ((constants.standardTextHeight as ValueRecord).source as ValueRecord).auditExtra = true;
      },
      hasExtra: candidate => Object.prototype.hasOwnProperty.call(
        (((candidate.helper as ValueRecord).constants as ValueRecord).standardTextHeight as ValueRecord).source as ValueRecord,
        'auditExtra',
      ),
    },
    {
      name: 'defaults standardButtonHeight pin extra key',
      mutate: candidate => {
        ((candidate.defaults as ValueRecord).standardButtonHeight as ValueRecord).auditExtra = true;
      },
      hasExtra: candidate => Object.prototype.hasOwnProperty.call(
        ((candidate.defaults as ValueRecord).standardButtonHeight as ValueRecord),
        'auditExtra',
      ),
    },
    {
      name: 'defaults standardButtonHeight source extra key',
      mutate: candidate => {
        (((candidate.defaults as ValueRecord).standardButtonHeight as ValueRecord).source as ValueRecord).auditExtra = true;
      },
      hasExtra: candidate => Object.prototype.hasOwnProperty.call(
        (((candidate.defaults as ValueRecord).standardButtonHeight as ValueRecord).source as ValueRecord),
        'auditExtra',
      ),
    },
  ];
  for (const attack of phase87ProfileExtraCases) {
    const candidateProfile = jsonClone(profile) as unknown as ValueRecord;
    attack.mutate(candidateProfile);
    const candidateResult = projectX4UiLayoutProgram(
      model,
      target,
      candidateProfile as unknown as X4UiLayoutProjectionProfile,
    );
    const candidateProgram = resultProgram(candidateResult);
    const candidateAuthority = evidenceAuthorityOf(candidateResult);
    const validation = candidateProgram && candidateAuthority
      ? safeSchemaPairValidation(candidateProgram, candidateAuthority)
      : { threw: false, valid: undefined, reason: 'wrapper refused before program emission' };
    const inputHasExtra = attack.hasExtra(candidateProfile);
    const currentEscape = inputHasExtra
      && candidateResult.status !== 'refused'
      && candidateProgram !== undefined
      && candidateAuthority !== undefined
      && validation.threw === false
      && validation.valid === false;
    const expectedRefusal = inputHasExtra
      && candidateResult.status === 'refused'
      && candidateProgram === undefined
      && candidateAuthority === undefined
      && validation.threw === false;
    const setupReady = inputHasExtra && (currentEscape || expectedRefusal);
    const proof = {
      fixtureReady: setupReady,
      setupReady,
      inputHasExtra,
      resultStatus: candidateResult.status,
      programEmitted: candidateProgram !== undefined,
      authorityEmitted: candidateAuthority !== undefined,
      issuedPairValidation: validation,
      wrapperSelfValid: candidateResult.status === 'refused' || validation.valid === true,
      currentEscape,
      expectedRefusal,
    };
    check(`8A.7 residual profile ingress rejects ${attack.name}`,
      proof.setupReady === true
        && proof.expectedRefusal === true
        && validation.threw === false,
      detail({ proof, currentWrapperAccepted: proof.wrapperSelfValid === true }));
  }

  type Phase3DPairAttack = {
    readonly name: string;
    readonly family: 'local-invocation' | 'row-groupIndex' | 'table-numColumns' | 'conditional-owner-shape';
    readonly program: X4UiLayoutProgram | undefined;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly proof: Record<string, unknown>;
  };

  const phase3DValidation = (attack: Phase3DPairAttack): { readonly threw: boolean; readonly valid?: boolean; readonly reason?: string } =>
    attack.program !== undefined && attack.authority !== undefined
      ? safeSchemaPairValidation(attack.program, attack.authority)
      : { threw: false, valid: false, reason: 'Phase 3D fixture missing' };

  const phase3DLocalOccurrenceSource = [
    'local function getA() return runtimeA end',
    'local function getB() return runtimeB end',
    'local menu = { name = "Phase3DLocalOccurrence", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("runtime", { width = getA(), height = getB() })',
  ].join('\n');
  const phase3DLocalOccurrenceModel = buildX4UiCallModel(input(
    phase3DLocalOccurrenceSource,
    'selftest/phase3d-local-occurrence.lua',
  ));
  const phase3DLocalOccurrenceResult = projectX4UiLayoutProgram(
    phase3DLocalOccurrenceModel,
    topTarget(phase3DLocalOccurrenceModel),
    profileFor(phase3DLocalOccurrenceModel),
  );
  const phase3DLocalOccurrenceProgram = resultProgram(phase3DLocalOccurrenceResult);
  const phase3DLocalOccurrenceAuthority = evidenceAuthorityOf(phase3DLocalOccurrenceResult);
  const phase3DLocalOccurrenceOperationIndex = phase3DLocalOccurrenceProgram?.operations.findIndex(candidate =>
    candidate.kind === 'createText'
      && candidate.metadata.semantics.properties?.some(property => property.normalizedName === 'width')
      && candidate.metadata.semantics.properties?.some(property => property.normalizedName === 'height')) ?? -1;
  const phase3DLocalOccurrencePair = (() => {
    if (phase3DLocalOccurrenceProgram === undefined
      || phase3DLocalOccurrenceAuthority === undefined
      || phase3DLocalOccurrenceOperationIndex < 0) return undefined;
    const operationValue = phase3DLocalOccurrenceProgram.operations[phase3DLocalOccurrenceOperationIndex];
    const properties = operationValue?.metadata.semantics.properties;
    const widthProperty = properties?.find(property => property.normalizedName === 'width');
    const heightProperty = properties?.find(property => property.normalizedName === 'height');
    const widthValue = widthProperty?.value;
    const heightValue = heightProperty?.value;
    const widthResult = widthValue?.localInvocationResult;
    const heightResult = heightValue?.localInvocationResult;
    const widthInvocation = widthResult
      ? phase3DLocalOccurrenceProgram.localIdentities.invocations.find(candidate => candidate.id === widthResult.invocationId)
      : undefined;
    const heightInvocation = heightResult
      ? phase3DLocalOccurrenceProgram.localIdentities.invocations.find(candidate => candidate.id === heightResult.invocationId)
      : undefined;
    const beforeWidthExpression = widthValue?.expression;
    const beforeWidthLocation = widthValue?.location;
    const invocationTripleMatches = (
      localResult: unknown,
      invocation: X4UiLayoutProgram['localIdentities']['invocations'][number] | undefined,
    ): boolean => {
      if (!localResult || typeof localResult !== 'object' || Array.isArray(localResult) || invocation === undefined) return false;
      const record = localResult as ValueRecord;
      return record.invocationId === invocation.id
        && sameJson(record.source, invocation.source)
        && record.expression === invocation.expression;
    };
    const mutateOperation = (operationRecord: ValueRecord): void => {
      const semantics = (operationRecord.metadata as ValueRecord).semantics as ValueRecord;
      const operationProperties = semantics.properties as ValueRecord[];
      const width = operationProperties.find(property => property.normalizedName === 'width');
      const height = operationProperties.find(property => property.normalizedName === 'height');
      const heightLocalResult = height?.value && typeof height.value === 'object'
        ? (height.value as ValueRecord).localInvocationResult
        : undefined;
      if (width?.value && typeof width.value === 'object' && heightLocalResult !== undefined) {
        (width.value as ValueRecord).localInvocationResult = jsonClone(heightLocalResult);
      }
    };
    const pair = actualOperationSnapshotPairFor(
      phase3DLocalOccurrenceProgram,
      phase3DLocalOccurrenceAuthority,
      phase3DLocalOccurrenceOperationIndex,
      mutateOperation,
      mutateOperation,
    );
    const mutatedOperation = pair.program.operations[phase3DLocalOccurrenceOperationIndex];
    const mutatedWidth = mutatedOperation?.metadata.semantics.properties?.find(property => property.normalizedName === 'width')?.value;
    const mutatedWidthResult = mutatedWidth?.localInvocationResult;
    return {
      attack: {
        name: 'width occurrence rebound from getA to exact getB invocation triple',
        family: 'local-invocation' as const,
        program: pair.program,
        authority: pair.authority,
        proof: {
          fixtureReady: safeSchemaPairValidation(phase3DLocalOccurrenceProgram, phase3DLocalOccurrenceAuthority).valid === true
            && widthResult !== undefined
            && heightResult !== undefined
            && widthInvocation !== undefined
            && heightInvocation !== undefined
            && widthInvocation.id !== heightInvocation.id
            && invocationTripleMatches(widthResult, widthInvocation)
            && invocationTripleMatches(heightResult, heightInvocation)
            && mutatedWidthResult !== undefined
            && sameJson(mutatedWidthResult, heightResult)
            && mutatedWidth?.expression === beforeWidthExpression
            && sameJson(mutatedWidth?.location, beforeWidthLocation),
          operationIndex: phase3DLocalOccurrenceOperationIndex,
          consumerKind: operationValue?.kind,
          widthBefore: widthResult,
          heightSibling: heightResult,
          widthAfter: mutatedWidthResult,
          widthInvocation,
          heightInvocation,
          enclosingWidthExpressionUnchanged: mutatedWidth?.expression === beforeWidthExpression,
          enclosingWidthLocationUnchanged: sameJson(mutatedWidth?.location, beforeWidthLocation),
        },
      },
    };
  })();
  const phase3DLocalOccurrenceAttack: Phase3DPairAttack = phase3DLocalOccurrencePair?.attack || {
    name: 'width occurrence rebound from getA to exact getB invocation triple',
    family: 'local-invocation' as const,
    program: undefined,
    authority: undefined,
    proof: { fixtureReady: false, reason: 'direct createText local occurrence fixture missing' },
  };
  const phase3DLocalOccurrenceValidation = phase3DValidation(phase3DLocalOccurrenceAttack);
  check('8A.7 Phase 3D local invocation rejects createText width rebound to sibling invocation',
    phase3DLocalOccurrenceAttack.proof.fixtureReady === true
      && phase3DLocalOccurrenceValidation.threw === false
      && phase3DLocalOccurrenceValidation.valid === false,
    detail({ attack: phase3DLocalOccurrenceAttack, validation: phase3DLocalOccurrenceValidation }));

  const phase3DRowGroupBaseProgram = schemaShapeProgram;
  const phase3DRowGroupBaseAuthority = schemaShapeAuthority;
  const phase3DRowGroupLocation = phase3DRowGroupBaseProgram?.rows.findIndex(row =>
    typeof row.tableId === 'string' && row.kernelState !== undefined) ?? -1;
  const phase3DRowGroupAttack = (nextGroupIndex: number): Phase3DPairAttack => {
    if (phase3DRowGroupBaseProgram === undefined || phase3DRowGroupBaseAuthority === undefined || phase3DRowGroupLocation < 0) {
      return {
        name: `row node groupIndex ${nextGroupIndex}`,
        family: 'row-groupIndex',
        program: undefined,
        authority: undefined,
        proof: { fixtureReady: false, reason: 'row groupIndex fixture missing' },
      };
    }
    const candidateProgram = jsonClone(phase3DRowGroupBaseProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase3DRowGroupBaseAuthority) as unknown as ValueRecord;
    const rows = candidateProgram.rows as ValueRecord[];
    const row = rows[phase3DRowGroupLocation];
    const rowId = row?.id;
    const authorityRows = ((candidateAuthority.nodes as ValueRecord).rows as ValueRecord[]);
    const authorityRow = authorityRows.find(candidate => candidate.id === rowId);
    const rowKernel = row?.kernelState as ValueRecord | undefined;
    const authorityRowKernel = authorityRow?.snapshot && typeof authorityRow.snapshot === 'object'
      ? (authorityRow.snapshot as ValueRecord).kernelState as ValueRecord | undefined
      : undefined;
    const table = typeof row?.tableId === 'string'
      ? (candidateProgram.tables as ValueRecord[]).find(candidate => candidate.id === row.tableId)
      : undefined;
    const tableKernel = table?.kernelState as ValueRecord | undefined;
    const rowSlotIndex = typeof row?.rowIndex === 'number' && Number.isSafeInteger(row.rowIndex) ? row.rowIndex - 1 : -1;
    const tableRowBefore = rowSlotIndex >= 0 && Array.isArray(tableKernel?.rows)
      ? jsonClone((tableKernel.rows as unknown[])[rowSlotIndex])
      : undefined;
    const tableKernelBefore = tableKernel ? jsonClone(tableKernel) : undefined;
    const beforeRowGroupIndex = rowKernel?.groupIndex;
    if (rowKernel && authorityRowKernel) {
      rowKernel.groupIndex = nextGroupIndex;
      authorityRowKernel.groupIndex = nextGroupIndex;
    }
    const afterRowGroupIndex = rowKernel?.groupIndex;
    const afterTableKernel = table?.kernelState;
    return {
      name: `row node groupIndex ${nextGroupIndex}`,
      family: 'row-groupIndex',
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: safeSchemaPairValidation(phase3DRowGroupBaseProgram, phase3DRowGroupBaseAuthority).valid === true
          && row !== undefined
          && authorityRow !== undefined
          && rowKernel !== undefined
          && authorityRowKernel !== undefined
          && beforeRowGroupIndex === undefined
          && tableKernel !== undefined
          && Array.isArray(tableKernel.rows)
          && tableRowBefore !== undefined
          && tableRowBefore && typeof tableRowBefore === 'object'
          && (tableRowBefore as ValueRecord).groupIndex === undefined
          && afterRowGroupIndex === nextGroupIndex
          && nextGroupIndex !== beforeRowGroupIndex
          && sameJson(tableKernelBefore, afterTableKernel),
        rowId,
        rowIndex: row?.rowIndex,
        beforeRowGroupIndex,
        afterRowGroupIndex,
        owningTableId: row?.tableId,
        tableRowBefore,
        tableRowAfter: rowSlotIndex >= 0 && Array.isArray((afterTableKernel as ValueRecord | undefined)?.rows)
          ? ((afterTableKernel as ValueRecord).rows as unknown[])[rowSlotIndex]
          : undefined,
        tableKernelUnchanged: sameJson(tableKernelBefore, afterTableKernel),
      },
    };
  };
  const phase3DRowGroupAttacks = [
    phase3DRowGroupAttack(1),
    phase3DRowGroupAttack(2),
    phase3DRowGroupAttack(999),
  ];
  for (const attack of phase3DRowGroupAttacks) {
    const validation = phase3DValidation(attack);
    check(`8A.7 Phase 3D row groupIndex rejects ${attack.name}`,
      attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ attack, validation }));
  }

  const phase3DTableBaseProgram = schemaShapeProgram;
  const phase3DTableBaseAuthority = schemaShapeAuthority;
  const phase3DTableIndex = phase3DTableBaseProgram?.tables.findIndex(tableNode =>
    typeof tableNode.numColumns === 'number'
      && tableNode.kernelState !== undefined
      && tableNode.kernelState.columns.length === tableNode.numColumns) ?? -1;
  const phase3DTableNumColumnsAttack = (mode: 'increase' | 'remove'): Phase3DPairAttack => {
    if (phase3DTableBaseProgram === undefined || phase3DTableBaseAuthority === undefined || phase3DTableIndex < 0) {
      return {
        name: `table numColumns ${mode}`,
        family: 'table-numColumns',
        program: undefined,
        authority: undefined,
        proof: { fixtureReady: false, reason: 'table numColumns fixture missing' },
      };
    }
    const candidateProgram = jsonClone(phase3DTableBaseProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase3DTableBaseAuthority) as unknown as ValueRecord;
    const table = (candidateProgram.tables as ValueRecord[])[phase3DTableIndex];
    const tableId = table?.id;
    const authorityTable = ((candidateAuthority.nodes as ValueRecord).tables as ValueRecord[]).find(candidate => candidate.id === tableId);
    const beforeNumColumns = table?.numColumns;
    const beforeKernel = table?.kernelState ? jsonClone(table.kernelState) : undefined;
    const beforeAuthorityNumColumns = authorityTable?.snapshot && typeof authorityTable.snapshot === 'object'
      ? (authorityTable.snapshot as ValueRecord).numColumns
      : undefined;
    if (mode === 'increase') {
      if (table) table.numColumns = Number(beforeNumColumns) + 1;
      if (authorityTable?.snapshot && typeof authorityTable.snapshot === 'object') {
        (authorityTable.snapshot as ValueRecord).numColumns = Number(beforeAuthorityNumColumns) + 1;
      }
    } else {
      if (table) delete table.numColumns;
      if (authorityTable?.snapshot && typeof authorityTable.snapshot === 'object') delete (authorityTable.snapshot as ValueRecord).numColumns;
    }
    const afterNumColumns = table?.numColumns;
    const afterAuthorityNumColumns = authorityTable?.snapshot && typeof authorityTable.snapshot === 'object'
      ? (authorityTable.snapshot as ValueRecord).numColumns
      : undefined;
    return {
      name: `table numColumns ${mode}`,
      family: 'table-numColumns',
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: safeSchemaPairValidation(phase3DTableBaseProgram, phase3DTableBaseAuthority).valid === true
          && table !== undefined
          && authorityTable !== undefined
          && beforeNumColumns === 2
          && beforeAuthorityNumColumns === 2
          && (table.kernelState as ValueRecord | undefined)?.columns
          && ((table.kernelState as ValueRecord).columns as readonly unknown[]).length === 2
          && beforeKernel !== undefined
          && afterNumColumns === (mode === 'increase' ? 3 : undefined)
          && afterAuthorityNumColumns === afterNumColumns
          && sameJson(beforeKernel, table.kernelState),
        tableId,
        beforeNumColumns,
        afterNumColumns,
        beforeAuthorityNumColumns,
        afterAuthorityNumColumns,
        kernelColumnCount: ((table?.kernelState as ValueRecord | undefined)?.columns as readonly unknown[] | undefined)?.length,
        kernelUnchanged: sameJson(beforeKernel, table?.kernelState),
      },
    };
  };
  const phase3DTableNumColumnsAttacks = [
    phase3DTableNumColumnsAttack('increase'),
    phase3DTableNumColumnsAttack('remove'),
  ];
  for (const attack of phase3DTableNumColumnsAttacks) {
    const validation = phase3DValidation(attack);
    check(`8A.7 Phase 3D table/kernel columns rejects ${attack.name}`,
      attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ attack, validation }));
  }

  const phase3DConditionalOwnerSource = [
    'local menu = { name = "Phase3DConditionalOwners", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false })',
    'local row = table:addRow(false, {})',
    'local other = {}',
    'if choice then',
    '  other:createText("conditional text", {})',
    '  other:addRow(false, {})',
    '  table:setColWidth(getIndex(), getWidth(), getScaling())',
    '  table:addRow(false, {})',
    'end',
    'if false then',
    '  other:createIcon("solid", {})',
    '  other:addRow(false, {})',
    'end',
  ].join('\n');
  const phase3DConditionalOwnerModel = buildX4UiCallModel(input(
    phase3DConditionalOwnerSource,
    'selftest/phase3d-conditional-owners.lua',
  ));
  const phase3DConditionalOwnerResult = projectX4UiLayoutProgram(
    phase3DConditionalOwnerModel,
    topTarget(phase3DConditionalOwnerModel),
    profileFor(phase3DConditionalOwnerModel),
  );
  const phase3DConditionalOwnerProgram = resultProgram(phase3DConditionalOwnerResult);
  const phase3DConditionalOwnerAuthority = evidenceAuthorityOf(phase3DConditionalOwnerResult);
  const phase3DConditionalOwnerBaseline = phase3DConditionalOwnerProgram && phase3DConditionalOwnerAuthority
    ? safeSchemaPairValidation(phase3DConditionalOwnerProgram, phase3DConditionalOwnerAuthority)
    : { threw: false, valid: false, reason: 'conditional owner fixture missing' };
  const phase3DConditionalPair = (
    name: string,
    predicate: (operationValue: ValueRecord) => boolean,
    field: Phase87OwnerField,
    mode: 'add' | 'remove',
  ): Phase3DPairAttack => {
    if (phase3DConditionalOwnerProgram === undefined || phase3DConditionalOwnerAuthority === undefined) {
      return { name, family: 'conditional-owner-shape', program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'conditional authority missing' } };
    }
    const candidateProgram = jsonClone(phase3DConditionalOwnerProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(phase3DConditionalOwnerAuthority) as unknown as ValueRecord;
    const operationIndex = (candidateProgram.operations as ValueRecord[]).findIndex(predicate);
    const operationValue = operationIndex >= 0 ? (candidateProgram.operations as ValueRecord[])[operationIndex] : undefined;
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const beforeShape = phase87OwnerFields.filter(ownerField => operationValue?.[ownerField] !== undefined);
    const targetId = mode === 'add' && operationValue !== undefined
      ? phase87OwnerIds(candidateProgram, field, operationValue)[0]
      : undefined;
    const mutation = operationIndex >= 0
      ? phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, field, targetId)
      : { changed: false, previousOwner: undefined, nextOwner: targetId };
    const mutatedOperation = operationIndex >= 0 ? (candidateProgram.operations as ValueRecord[])[operationIndex] : undefined;
    const afterShape = phase87OwnerFields.filter(ownerField => mutatedOperation?.[ownerField] !== undefined);
    const expectedMutation = mode === 'add'
      ? mutation.changed === true && mutatedOperation?.[field] === targetId
      : mutation.changed === true && mutatedOperation?.[field] === undefined;
    return {
      name,
      family: 'conditional-owner-shape',
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof: {
        fixtureReady: phase3DConditionalOwnerBaseline.valid === true
          && operationValue !== undefined
          && (operationValue.status === 'conditional' || operationValue.status === 'unreachable')
          && (mode === 'add' ? before[field] === undefined && typeof targetId === 'string' : typeof before[field] === 'string')
          && expectedMutation
          && afterShape.includes(field) === (mode === 'add')
          && (sameJson((candidateAuthority.operations as ValueRecord[])[operationIndex]?.snapshot, mutatedOperation) || false),
        operationIndex,
        operationKind: operationValue?.kind,
        operationStatus: operationValue?.status,
        field,
        mode,
        beforeShape,
        afterShape,
        beforeOwner: before[field],
        afterOwner: mutatedOperation?.[field],
        targetId,
        mutation,
        availableOperations: (phase3DConditionalOwnerProgram.operations as unknown as readonly ValueRecord[]).map((candidate, index) => ({
          index,
          kind: candidate.kind,
          status: candidate.status,
          owners: phase87OwnerFields.filter(ownerField => candidate[ownerField] !== undefined),
        })),
      },
    };
  };
  const phase3DConditionalOwnerAttacks: readonly Phase3DPairAttack[] = [
    phase3DConditionalPair(
      'createText conditional add tableId',
      operationValue => operationValue.kind === 'createText'
        && operationValue.status === 'conditional'
        && phase87OwnerFields.every(field => operationValue[field] === undefined),
      'tableId',
      'add',
    ),
    phase3DConditionalPair(
      'createText conditional add rowId',
      operationValue => operationValue.kind === 'createText'
        && operationValue.status === 'conditional'
        && phase87OwnerFields.every(field => operationValue[field] === undefined),
      'rowId',
      'add',
    ),
    phase3DConditionalPair(
      'createIcon unreachable add tableId',
      operationValue => operationValue.kind === 'createIcon'
        && operationValue.status === 'unreachable'
        && phase87OwnerFields.every(field => operationValue[field] === undefined),
      'tableId',
      'add',
    ),
    phase3DConditionalPair(
      'createIcon unreachable add rowId',
      operationValue => operationValue.kind === 'createIcon'
        && operationValue.status === 'unreachable'
        && phase87OwnerFields.every(field => operationValue[field] === undefined),
      'rowId',
      'add',
    ),
    phase3DConditionalPair(
      'addRow conditional remove rowId with tableId absent',
      operationValue => operationValue.kind === 'addRow'
        && operationValue.status === 'conditional'
        && operationValue.tableId === undefined
        && typeof operationValue.rowId === 'string',
      'rowId',
      'remove',
    ),
    phase3DConditionalPair(
      'setColWidth conditional remove tableId',
      operationValue => operationValue.kind === 'setColWidth'
        && operationValue.status === 'conditional'
        && typeof operationValue.tableId === 'string'
        && operationValue.rowId === undefined
        && operationValue.cellId === undefined,
      'tableId',
      'remove',
    ),
    phase3DConditionalPair(
      'addRow conditional remove tableId',
      operationValue => operationValue.kind === 'addRow'
        && operationValue.status === 'conditional'
        && typeof operationValue.tableId === 'string'
        && typeof operationValue.rowId === 'string',
      'tableId',
      'remove',
    ),
    phase3DConditionalPair(
      'addRow conditional remove rowId',
      operationValue => operationValue.kind === 'addRow'
        && operationValue.status === 'conditional'
        && typeof operationValue.tableId === 'string'
        && typeof operationValue.rowId === 'string',
      'rowId',
      'remove',
    ),
    phase3DConditionalPair(
      'addRow unreachable remove rowId with tableId absent',
      operationValue => operationValue.kind === 'addRow'
        && operationValue.status === 'unreachable'
        && operationValue.tableId === undefined
        && typeof operationValue.rowId === 'string',
      'rowId',
      'remove',
    ),
  ];
  for (const attack of phase3DConditionalOwnerAttacks) {
    const validation = phase3DValidation(attack);
    check(`8A.7 Phase 3D conditional/unreachable owner shape rejects ${attack.name}`,
      attack.proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ attack, validation }));
  }

  // Phase 3G: the independent consistency audit found two remaining classes of
  // pair-valid, producer-impossible records.  These are deliberately installed
  // after the historical checks so the fail-first denominator is explicit.
  type Phase3GValidation = { readonly threw: boolean; readonly valid?: boolean; readonly reason?: string };
  type Phase3GRecord = {
    readonly name: string;
    readonly family: 'blocked-owner' | 'local-occurrence';
    readonly proof: ValueRecord;
    readonly validation: Phase3GValidation;
  };
  const phase3GRecords: Phase3GRecord[] = [];
  const phase3GRecord = (
    name: string,
    family: Phase3GRecord['family'],
    proof: ValueRecord,
    validation: Phase3GValidation,
  ): void => {
    phase3GRecords.push({ name, family, proof, validation });
    check(name,
      proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ family, proof, validation, currentValidatorAccepted: validation.valid === true }));
  };

  const phase3GBlockedOwnerSource = [
    'local menu = { name = "Phase3GBlockedOwners", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false })',
    'local row = table:addRow(false, {})',
    'local other = {}',
    'if choice then',
    '  row[1]:setColSpan(1)',
    '  row[1]:createButton({})',
    '  row[1]:setText("linked", {})',
    '  row[1]:setText2("linked2", {})',
    '  row[1]:createEditBox({})',
    '  other:setColSpan(1)',
    '  other:createButton({})',
    '  other:setText("ownerless", {})',
    '  other:setText2("ownerless2", {})',
    '  other:createEditBox({})',
    'end',
    'if false then',
    '  row[1]:setColSpan(1)',
    '  row[1]:createButton({})',
    '  row[1]:setText("linked-unreachable", {})',
    '  row[1]:setText2("linked2-unreachable", {})',
    '  row[1]:createEditBox({})',
    '  other:setColSpan(1)',
    '  other:createButton({})',
    '  other:setText("ownerless-unreachable", {})',
    '  other:setText2("ownerless2-unreachable", {})',
    '  other:createEditBox({})',
    'end',
  ].join('\n');
  const phase3GBlockedOwnerModel = buildX4UiCallModel(input(
    phase3GBlockedOwnerSource,
    'selftest/phase3g-blocked-owners.lua',
  ));
  const phase3GBlockedOwnerResult = projectX4UiLayoutProgram(
    phase3GBlockedOwnerModel,
    topTarget(phase3GBlockedOwnerModel),
    profileFor(phase3GBlockedOwnerModel),
  );
  const phase3GBlockedOwnerProgram = resultProgram(phase3GBlockedOwnerResult);
  const phase3GBlockedOwnerAuthority = evidenceAuthorityOf(phase3GBlockedOwnerResult);
  const phase3GBlockedOwnerBaseline = phase3GBlockedOwnerProgram && phase3GBlockedOwnerAuthority
    ? safeSchemaPairValidation(phase3GBlockedOwnerProgram, phase3GBlockedOwnerAuthority)
    : { threw: false, valid: false, reason: 'blocked-owner fixture missing' };
  const phase3GBlockedKinds = [
    'setColSpan', 'createButton', 'setText', 'setText2', 'createEditBox',
  ] as const;
  const phase3GBlockedStatuses = ['conditional', 'unreachable'] as const;
  const phase3GBlockedShapes = ['linked', 'ownerless'] as const;
  const phase3GBlockedOwnerFor = (
    kind: string,
    status: string,
    shape: typeof phase3GBlockedShapes[number],
  ): number => phase3GBlockedOwnerProgram?.operations.findIndex(candidate => {
    if (candidate.kind !== kind || candidate.status !== status) return false;
    const ownerShape = phase87OwnerFields.filter(field => candidate[field] !== undefined);
    return sameJson(ownerShape, shape === 'linked' ? ['tableId', 'rowId', 'cellId'] : []);
  }) ?? -1;
  const phase3GBlockedOwnerTarget = (
    candidateProgram: ValueRecord,
    field: Phase87OwnerField,
  ): string | undefined => {
    const collection = phase87NodeCollectionForOwner(field);
    const nodes = candidateProgram[collection] as ValueRecord[] | undefined;
    return nodes?.find(candidate => typeof candidate.id === 'string')?.id as string | undefined;
  };
  for (const status of phase3GBlockedStatuses) {
    for (const kind of phase3GBlockedKinds) {
      for (const shape of phase3GBlockedShapes) {
        for (const field of ['tableId', 'rowId'] as const) {
          const operationIndex = phase3GBlockedOwnerFor(kind, status, shape);
          const candidateProgram = phase3GBlockedOwnerProgram
            ? jsonClone(phase3GBlockedOwnerProgram) as unknown as ValueRecord
            : undefined;
          const candidateAuthority = phase3GBlockedOwnerAuthority
            ? jsonClone(phase3GBlockedOwnerAuthority) as unknown as ValueRecord
            : undefined;
          const operationValue = candidateProgram && operationIndex >= 0
            ? (candidateProgram.operations as ValueRecord[])[operationIndex]
            : undefined;
          const beforeShape = operationValue
            ? phase87OwnerFields.filter(ownerField => operationValue[ownerField] !== undefined)
            : [];
          const beforeOwner = operationValue?.[field];
          const adding = shape === 'ownerless';
          const targetId = adding && candidateProgram
            ? phase3GBlockedOwnerTarget(candidateProgram, field)
            : undefined;
          const mutation = candidateProgram && candidateAuthority && operationIndex >= 0
            ? phase87SetOperationOwner(candidateProgram, candidateAuthority, operationIndex, field, targetId)
            : { changed: false, previousOwner: beforeOwner, nextOwner: targetId };
          const mutatedOperation = operationValue;
          const afterShape = mutatedOperation
            ? phase87OwnerFields.filter(ownerField => mutatedOperation[ownerField] !== undefined)
            : [];
          const authorityOperation = candidateAuthority && operationIndex >= 0
            ? (candidateAuthority.operations as ValueRecord[])[operationIndex]
            : undefined;
          const authoritySnapshot = authorityOperation?.snapshot;
          const afterOwner = mutatedOperation?.[field];
          const proof: ValueRecord = {
            fixtureReady: phase3GBlockedOwnerBaseline.valid === true
              && operationValue !== undefined
              && operationValue.kind === kind
              && operationValue.status === status
              && sameJson(beforeShape, shape === 'linked' ? ['tableId', 'rowId', 'cellId'] : [])
              && (adding
                ? beforeOwner === undefined
                  && typeof targetId === 'string'
                  && afterOwner === targetId
                  && (candidateProgram?.[phase87NodeCollectionForOwner(field)] as ValueRecord[])
                    .some(node => node.id === targetId)
                : typeof beforeOwner === 'string' && afterOwner === undefined)
              && mutation.changed === true
              && afterShape.includes(field) === adding
              && authoritySnapshot !== undefined
              && sameJson(authoritySnapshot, mutatedOperation),
            operationIndex,
            operationKind: operationValue?.kind,
            operationStatus: operationValue?.status,
            shape,
            field,
            beforeShape,
            afterShape,
            beforeOwner,
            afterOwner,
            targetId,
            mutation,
            authoritySnapshotMatches: authoritySnapshot !== undefined
              && sameJson(authoritySnapshot, mutatedOperation),
          };
          const frozenProgram = candidateProgram
            ? freezeClone(candidateProgram) as unknown as X4UiLayoutProgram
            : undefined;
          const frozenAuthority = candidateAuthority
            ? freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike
            : undefined;
          const validation = frozenProgram && frozenAuthority
            ? safeSchemaPairValidation(frozenProgram, frozenAuthority)
            : { threw: false, valid: false, reason: 'blocked-owner mutated pair missing' };
          phase3GRecord(
            `8A.7 Phase 3G blocked-owner ${status} ${kind} ${shape} ${adding ? 'add' : 'remove'} ${field}`,
            'blocked-owner',
            proof,
            validation,
          );
        }
      }
    }
  }

  const phase3GLocalPrefix = [
    'local function getA() return runtimeA end',
    'local function getB() return runtimeB end',
    'local menu = { name = "Phase3GLocal", layer = 1 }',
  ];
  const phase3GLocalBase = [
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 60 })',
    'local row = table:addRow(false, {})',
  ];
  const phase3GLocalSources: Readonly<Record<string, string>> = {
    createFrameHandle: [...phase3GLocalPrefix, 'local frame = Helper.createFrameHandle(menu, { width = getA(), height = getB() })'].join('\n'),
    createButton: [...phase3GLocalPrefix, ...phase3GLocalBase, 'row[1]:createButton({ height = getA(), fontsize = getB() })'].join('\n'),
    createEditBox: [...phase3GLocalPrefix, ...phase3GLocalBase, 'row[1]:createEditBox({ height = getA(), fontsize = getB() })'].join('\n'),
    createIcon: [...phase3GLocalPrefix, ...phase3GLocalBase, 'row[1]:createIcon("solid", { height = getA(), affectRowHeight = getB() })'].join('\n'),
    setText: [...phase3GLocalPrefix, ...phase3GLocalBase, 'row[1]:createButton({})', 'row[1]:setText(getA(), { x = getB() })'].join('\n'),
    setText2: [...phase3GLocalPrefix, ...phase3GLocalBase, 'row[1]:createButton({})', 'row[1]:setText2(getA(), { x = getB() })'].join('\n'),
    setColWidth: [...phase3GLocalPrefix, 'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })', 'local table = frame:addTable(2, { width = 60 })', 'table:setColWidth(getA(), getB(), false)'].join('\n'),
    addRow: [...phase3GLocalPrefix, 'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })', 'local table = frame:addTable(2, { width = 60 })', 'table:addRow(getA(), { paddingTop = getB() })'].join('\n'),
    addTable: [...phase3GLocalPrefix, 'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })', 'frame:addTable(getA(), { width = getB() })'].join('\n'),
  };
  const phase3GLocalKinds = [
    'createFrameHandle', 'createButton', 'createEditBox', 'createIcon', 'setText', 'setText2',
    'setColWidth', 'addRow', 'addTable',
  ] as const;
  const phase3GLocalInvocationPaths = (root: unknown): ValuePath[] => {
    const paths: ValuePath[] = [];
    for (let occurrence = 0; ; occurrence += 1) {
      const path = findValuePath(root, value => value.localInvocationResult !== undefined, occurrence);
      if (!path) return paths;
      paths.push(path);
    }
  };
  for (const kind of phase3GLocalKinds) {
    const source = phase3GLocalSources[kind];
    const model = buildX4UiCallModel(input(source, `selftest/phase3g-local-${kind}.lua`));
    const result = projectX4UiLayoutProgram(model, topTarget(model), profileFor(model));
    const sourceProgram = resultProgram(result);
    const sourceAuthority = evidenceAuthorityOf(result);
    const operationIndex = sourceProgram?.operations.findIndex(candidate => candidate.kind === kind) ?? -1;
    const sourceOperation = operationIndex >= 0 ? sourceProgram?.operations[operationIndex] : undefined;
    const localPaths = sourceOperation ? phase3GLocalInvocationPaths(sourceOperation) : [];
    const localPathFor = (name: string): ValuePath | undefined => localPaths.find(path => {
      const value = valuePathAt(sourceOperation, path) as ValueRecord | undefined;
      const localResult = value?.localInvocationResult as ValueRecord | undefined;
      return typeof localResult?.expression === 'string' && localResult.expression.includes(name);
    });
    const getAPath = localPathFor('getA');
    const getBPath = localPathFor('getB');
    const getAValue = getAPath ? valuePathAt(sourceOperation, getAPath) as ValueRecord : undefined;
    const getBValue = getBPath ? valuePathAt(sourceOperation, getBPath) as ValueRecord : undefined;
    const getALocal = getAValue?.localInvocationResult as ValueRecord | undefined;
    const getBLocal = getBValue?.localInvocationResult as ValueRecord | undefined;
    const invocationFor = (local: ValueRecord | undefined): ValueRecord | undefined =>
      local && sourceProgram
        ? sourceProgram.localIdentities.invocations.find(candidate => candidate.id === local.invocationId) as unknown as ValueRecord | undefined
        : undefined;
    const getAInvocation = invocationFor(getALocal);
    const getBInvocation = invocationFor(getBLocal);
    const baseline = sourceProgram && sourceAuthority
      ? safeSchemaPairValidation(sourceProgram, sourceAuthority)
      : { threw: false, valid: false, reason: 'local-occurrence fixture missing' };
    const mutateLocalTriple = (operationValue: Record<string, unknown>): boolean => {
      if (!getAPath || !getBLocal) return false;
      return mutateValueAtPath(operationValue, getAPath, value => {
        const localResult = value.localInvocationResult as ValueRecord;
        localResult.invocationId = getBLocal.invocationId;
        localResult.source = jsonClone(getBLocal.source);
        localResult.expression = getBLocal.expression;
      });
    };
    const pair = sourceProgram && sourceAuthority && operationIndex >= 0
      ? actualOperationSnapshotPairFor(sourceProgram, sourceAuthority, operationIndex, mutateLocalTriple, mutateLocalTriple)
      : undefined;
    const mutatedOperation = pair && operationIndex >= 0 ? pair.program.operations[operationIndex] : undefined;
    const mutatedValue = mutatedOperation && getAPath
      ? valuePathAt(mutatedOperation, getAPath) as ValueRecord | undefined
      : undefined;
    const mutatedLocal = mutatedValue?.localInvocationResult as ValueRecord | undefined;
    const mutatedAuthorityOperation = pair && operationIndex >= 0
      ? pair.authority.operations[operationIndex]
      : undefined;
    const proof: ValueRecord = {
      fixtureReady: baseline.valid === true
        && sourceOperation !== undefined
        && sourceOperation.kind === kind
        && sourceOperation.localExpansion === undefined
        && getAPath !== undefined
        && getBPath !== undefined
        && getAValue !== undefined
        && getBValue !== undefined
        && getALocal !== undefined
        && getBLocal !== undefined
        && getALocal.invocationId !== getBLocal.invocationId
        && getAInvocation !== undefined
        && getBInvocation !== undefined
        && sameJson(getALocal.source, getAInvocation.source)
        && sameJson(getBLocal.source, getBInvocation.source)
        && getALocal.expression === getAInvocation.expression
        && getBLocal.expression === getBInvocation.expression
        && pair !== undefined
        && mutatedLocal !== undefined
        && sameJson(mutatedLocal, getBLocal)
        && mutatedValue?.expression === getAValue.expression
        && sameJson(mutatedValue?.location, getAValue.location)
        && mutatedAuthorityOperation !== undefined
        && sameJson(mutatedAuthorityOperation.snapshot, mutatedOperation),
      operationIndex,
      operationKind: sourceOperation?.kind,
      operationStatus: sourceOperation?.status,
      getAPath,
      getBPath,
      getAInvocationId: getALocal?.invocationId,
      getBInvocationId: getBLocal?.invocationId,
      enclosingExpressionUnchanged: mutatedValue?.expression === getAValue?.expression,
      enclosingLocationUnchanged: sameJson(mutatedValue?.location, getAValue?.location),
      authoritySnapshotMatches: mutatedAuthorityOperation !== undefined
        && sameJson(mutatedAuthorityOperation.snapshot, mutatedOperation),
    };
    const validation = pair
      ? safeSchemaPairValidation(pair.program, pair.authority)
      : { threw: false, valid: false, reason: 'local-occurrence mutated pair missing' };
    phase3GRecord(
      `8A.7 Phase 3G local-invocation occurrence ${kind}`,
      'local-occurrence',
      proof,
      validation,
    );
  }

  // Phase 3J: retain source-emitted provenance/context substitutions as a
  // separate fail-first matrix.  The program and authority are cloned
  // independently; only the selected owner/occurrence evidence is changed.
  type Phase3JValidation = { readonly threw: boolean; readonly valid?: boolean; readonly reason?: string };
  type Phase3JRecord = {
    readonly name: string;
    readonly family: 'owner-provenance' | 'occurrence-context';
    readonly proof: ValueRecord;
    readonly validation: Phase3JValidation;
    readonly expectedCurrentAccepted: boolean;
  };
  const phase3JRecords: Phase3JRecord[] = [];
  const phase3JRecord = (
    name: string,
    family: Phase3JRecord['family'],
    proof: ValueRecord,
    validation: Phase3JValidation,
    expectedCurrentAccepted: boolean,
  ): void => {
    phase3JRecords.push({ name, family, proof, validation, expectedCurrentAccepted });
    check(name,
      proof.fixtureReady === true
        && validation.threw === false
        && validation.valid === false,
      detail({ family, proof, validation, currentValidatorAccepted: validation.valid === true, expectedCurrentAccepted }));
  };

  const phase3JNodeIdentity = (
    root: ValueRecord,
    field: Phase87OwnerField,
    id: string | undefined,
  ): ValueRecord | undefined => {
    if (typeof id !== 'string') return undefined;
    const collection = phase87NodeCollectionForOwner(field);
    const programNodes = Array.isArray(root[collection])
      ? root[collection] as ValueRecord[]
      : root.nodes && typeof root.nodes === 'object'
        && Array.isArray((root.nodes as ValueRecord)[collection])
        ? ((root.nodes as ValueRecord)[collection] as ValueRecord[]).map(node => node.snapshot as ValueRecord)
        : [];
    return programNodes.find(node => node.id === id)?.identity as ValueRecord | undefined;
  };
  const phase3JReplaceMetadataIdentity = (
    metadata: ValueRecord | undefined,
    beforeIdentity: ValueRecord | undefined,
    afterIdentity: ValueRecord | undefined,
  ): void => {
    if (!metadata || !beforeIdentity || !afterIdentity) return;
    const seen = new Set<object>();
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const objectValue = value as object;
      if (seen.has(objectValue)) return;
      seen.add(objectValue);
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const record = value as ValueRecord;
      for (const [key, child] of Object.entries(record)) {
        if ((key === 'reference' || key === 'result') && sameJson(child, beforeIdentity)) {
          record[key] = jsonClone(afterIdentity);
        } else {
          visit(child);
        }
      }
    };
    visit(metadata);
  };
  const phase3JOwnerPair = (
    name: string,
    sourceProgram: X4UiLayoutProgram | undefined,
    sourceAuthority: EvidenceAuthorityLike | undefined,
    predicate: (operationValue: ValueRecord) => boolean,
    transfers: readonly { readonly field: Phase87OwnerField; readonly targetId: string | undefined }[],
  ): {
    readonly program: X4UiLayoutProgram | undefined;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly proof: ValueRecord;
  } => {
    if (!sourceProgram || !sourceAuthority) {
      return { program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'owner provenance fixture missing' } };
    }
    const candidateProgram = jsonClone(sourceProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(sourceAuthority) as unknown as ValueRecord;
    const operationIndex = (candidateProgram.operations as ValueRecord[]).findIndex(predicate);
    const operationValue = operationIndex >= 0
      ? (candidateProgram.operations as ValueRecord[])[operationIndex]
      : undefined;
    const authorityOperation = operationIndex >= 0
      ? (candidateAuthority.operations as ValueRecord[])[operationIndex]
      : undefined;
    const authoritySnapshot = authorityOperation?.snapshot as ValueRecord | undefined;
    const operationOwnerId = (
      root: ValueRecord,
      operation: ValueRecord | undefined,
      field: Phase87OwnerField,
    ): string | undefined => {
      if (!operation) return undefined;
      if (field === 'frameId' && operation.kind === 'addTable' && typeof operation.tableId === 'string') {
        const tableNodes = Array.isArray(root.tables)
          ? root.tables as ValueRecord[]
          : root.nodes && typeof root.nodes === 'object' && Array.isArray((root.nodes as ValueRecord).tables)
            ? ((root.nodes as ValueRecord).tables as ValueRecord[]).map(node => node.snapshot as ValueRecord)
            : [];
        const table = tableNodes.find(candidate => candidate.id === operation.tableId);
        return typeof table?.frameId === 'string' ? table.frameId : undefined;
      }
      return typeof operation[field] === 'string' ? operation[field] as string : undefined;
    };
    const before = operationValue ? jsonClone(operationValue) as ValueRecord : {};
    const beforeOwners = Object.fromEntries(transfers.map(transfer => [transfer.field, before[transfer.field]]));
    const mutations = operationValue
      ? transfers.map(transfer => phase87SetOperationOwner(
        candidateProgram,
        candidateAuthority,
        operationIndex,
        transfer.field,
        transfer.targetId,
      ))
      : [];
    const afterOwners = Object.fromEntries(transfers.map(transfer => [transfer.field, operationValue?.[transfer.field]]));
    const applyMetadata = (root: ValueRecord, operation: ValueRecord | undefined): void => {
      if (!operation) return;
      for (const transfer of transfers) {
        phase3JReplaceMetadataIdentity(
          operation.metadata as ValueRecord | undefined,
          phase3JNodeIdentity(root, transfer.field, before[transfer.field] as string | undefined),
          phase3JNodeIdentity(root, transfer.field, transfer.targetId),
        );
      }
      const metadata = operation.metadata as ValueRecord | undefined;
      if (!metadata) return;
      const receiverField: Phase87OwnerField | undefined = operation.kind === 'createFrameHandle' || operation.kind === 'display' || operation.kind === 'addTable'
        ? 'frameId'
        : operation.kind === 'setColWidth' || operation.kind === 'addRow'
          ? 'tableId'
          : operation.kind === 'createText' ? 'cellId' : undefined;
      const receiver = metadata.receiver as ValueRecord | undefined;
      if (receiverField && receiver?.reference !== undefined) {
        const targetIdentity = phase3JNodeIdentity(root, receiverField, operationOwnerId(root, operation, receiverField));
        if (targetIdentity) receiver.reference = jsonClone(targetIdentity);
      }
      const resultField: Phase87OwnerField | undefined = operation.kind === 'createFrameHandle'
        ? 'frameId'
        : operation.kind === 'addTable' ? 'tableId' : operation.kind === 'addRow' ? 'rowId' : undefined;
      if (resultField && metadata.result !== undefined) {
        const targetIdentity = phase3JNodeIdentity(root, resultField, operation[resultField] as string | undefined);
        if (targetIdentity) metadata.result = jsonClone(targetIdentity);
      }
    };
    applyMetadata(candidateProgram, operationValue);
    applyMetadata(candidateAuthority, authoritySnapshot);
    const mutatedAuthoritySnapshot = (candidateAuthority.operations as ValueRecord[])[operationIndex]?.snapshot;
    const sourceOperation = (sourceProgram.operations as unknown as ValueRecord[])[operationIndex];
    const operationSourceUnchanged = sourceOperation !== undefined
      && operationValue !== undefined
      && sameJson(sourceOperation.source, operationValue.source);
    const receiver = (operationValue?.metadata as ValueRecord | undefined)?.receiver as ValueRecord | undefined;
    const resultIdentity = (operationValue?.metadata as ValueRecord | undefined)?.result;
    const receiverField: Phase87OwnerField | undefined = operationValue?.kind === 'createFrameHandle' || operationValue?.kind === 'display' || operationValue?.kind === 'addTable'
      ? 'frameId'
      : operationValue?.kind === 'setColWidth' || operationValue?.kind === 'addRow'
        ? 'tableId'
        : operationValue?.kind === 'createText' ? 'cellId' : undefined;
    const resultField: Phase87OwnerField | undefined = operationValue?.kind === 'createFrameHandle'
      ? 'frameId'
      : operationValue?.kind === 'addTable' ? 'tableId' : operationValue?.kind === 'addRow' ? 'rowId' : undefined;
    const receiverTarget = receiverField
      ? phase3JNodeIdentity(candidateProgram, receiverField, operationOwnerId(candidateProgram, operationValue, receiverField))
      : undefined;
    const resultTarget = resultField
      ? phase3JNodeIdentity(candidateProgram, resultField, operationValue?.[resultField] as string | undefined)
      : undefined;
    const beforeMetadata = before.metadata as ValueRecord | undefined;
    const beforeReceiver = (beforeMetadata?.receiver as ValueRecord | undefined)?.reference;
    const beforeResult = beforeMetadata?.result;
    const beforeReceiverOwnerId = receiverField
      ? operationOwnerId(sourceProgram as unknown as ValueRecord, before, receiverField)
      : undefined;
    const afterReceiverOwnerId = receiverField
      ? operationOwnerId(candidateProgram, operationValue, receiverField)
      : undefined;
    const addTableIdentityReady = operationValue?.kind !== 'addTable'
      || (before.tableId !== operationValue.tableId
        && beforeReceiver !== undefined
        && beforeResult !== undefined
        && typeof beforeReceiverOwnerId === 'string'
        && typeof afterReceiverOwnerId === 'string'
        && beforeReceiverOwnerId !== afterReceiverOwnerId
        && receiverTarget !== undefined
        && resultTarget !== undefined
        && (receiverTarget as ValueRecord).kind === 'frame'
        && (resultTarget as ValueRecord).kind === 'table'
        && !sameJson(beforeReceiver, receiver?.reference)
        && !sameJson(beforeResult, resultIdentity)
        && sameJson(receiver?.reference, receiverTarget)
        && sameJson(resultIdentity, resultTarget));
    const authorityOperationAfter = (candidateAuthority.operations as ValueRecord[])[operationIndex];
    const proof: ValueRecord = {
      fixtureReady: sourceOperation !== undefined
        && operationValue !== undefined
        && authoritySnapshot !== undefined
        && operationValue.status !== undefined
        && transfers.length > 0
        && transfers.every((transfer, index) => typeof transfer.targetId === 'string'
          && before[transfer.field] !== transfer.targetId
          && operationValue[transfer.field] === transfer.targetId
          && mutations[index]?.changed === true)
        && transfers.some(transfer => before[transfer.field] !== operationValue[transfer.field])
        && operationSourceUnchanged
        && addTableIdentityReady
        && receiverTarget !== undefined
        && (receiver?.reference === undefined || sameJson(receiver.reference, receiverTarget))
        && (resultField === undefined || resultIdentity === undefined || (resultTarget !== undefined && sameJson(resultIdentity, resultTarget)))
        && authorityOperationAfter !== undefined
        && sameJson(mutatedAuthoritySnapshot, operationValue),
      operationIndex,
      operationKind: operationValue?.kind,
      operationStatus: operationValue?.status,
      beforeOwners,
      afterOwners,
      targetIds: transfers.map(transfer => transfer.targetId),
      mutations,
      sourceUnchanged: operationSourceUnchanged,
      sourceCallUnchanged: operationSourceUnchanged,
      receiverOwnerField: receiverField,
      frameIdBefore: beforeReceiverOwnerId,
      frameIdAfter: afterReceiverOwnerId,
      frameIdTarget: afterReceiverOwnerId,
      receiverBefore: beforeReceiver,
      receiverOwnerBeforeId: beforeReceiverOwnerId,
      receiverOwnerAfterId: afterReceiverOwnerId,
      receiverTarget,
      receiverAfter: receiver?.reference,
      resultBefore: beforeResult,
      resultTarget,
      resultAfter: resultIdentity,
      tableIdBefore: before.tableId,
      tableIdAfter: operationValue?.tableId,
      tableIdTarget: operationValue?.tableId,
      authoritySnapshotMatches: authorityOperationAfter !== undefined
        && sameJson(mutatedAuthoritySnapshot, operationValue),
    };
    return {
      program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
      authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      proof,
    };
  };

  const phase3JUnresolvedOwnerSource = [
    'local menu = { name = "Phase3JUnresolvedOwner", layer = 1 }',
    'local frameA = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableA = frameA:addTable(1, { width = 80, reserveScrollBar = false })',
    'local rowA = tableA:addRow(false, {})',
    'rowA[1]:createText(getText(), { height = 4 })',
    'local frameB = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local tableB = frameB:addTable(1, { width = 80, reserveScrollBar = false })',
    'local rowB = tableB:addRow(false, {})',
    'rowB[1]:createText("B", { height = 4 })',
    'frameA:display()',
    'frameB:display()',
  ].join('\n');
  const phase3JUnresolvedOwnerModel = buildX4UiCallModel(input(
    phase3JUnresolvedOwnerSource,
    'selftest/phase3j-unresolved-owner.lua',
  ));
  const phase3JUnresolvedOwnerResult = projectX4UiLayoutProgram(
    phase3JUnresolvedOwnerModel,
    topTarget(phase3JUnresolvedOwnerModel),
    profileFor(phase3JUnresolvedOwnerModel),
  );
  const phase3JUnresolvedOwnerProgram = resultProgram(phase3JUnresolvedOwnerResult);
  const phase3JUnresolvedOwnerAuthority = evidenceAuthorityOf(phase3JUnresolvedOwnerResult);
  const phase3JUnresolvedOwnerBaseline = phase3JUnresolvedOwnerProgram && phase3JUnresolvedOwnerAuthority
    ? safeSchemaPairValidation(phase3JUnresolvedOwnerProgram, phase3JUnresolvedOwnerAuthority)
    : { threw: false, valid: false, reason: 'unresolved owner fixture missing' };
  const phase3JUnresolvedTableA = phase3JUnresolvedOwnerProgram?.tables.find(node => node.identity?.path === 'tableA');
  const phase3JUnresolvedTableB = phase3JUnresolvedOwnerProgram?.tables.find(node => node.identity?.path === 'tableB');
  const phase3JUnresolvedRowA = phase3JUnresolvedOwnerProgram?.rows.find(node => node.identity?.path === 'rowA');
  const phase3JUnresolvedRowB = phase3JUnresolvedOwnerProgram?.rows.find(node => node.identity?.path === 'rowB');
  const phase3JUnresolvedCellA = phase3JUnresolvedOwnerProgram?.cells.find(node => node.identity?.path === 'rowA[1]');
  const phase3JUnresolvedCellB = phase3JUnresolvedOwnerProgram?.cells.find(node => node.identity?.path === 'rowB[1]');
  const phase3JUnresolvedOwnerAttack = phase3JOwnerPair(
    'unresolved createText sibling provenance',
    phase3JUnresolvedOwnerProgram,
    phase3JUnresolvedOwnerAuthority,
    operationValue => operationValue.kind === 'createText'
      && operationValue.status === 'unresolved'
      && operationValue.tableId === phase3JUnresolvedTableA?.id
      && operationValue.rowId === phase3JUnresolvedRowA?.id
      && operationValue.cellId === phase3JUnresolvedCellA?.id,
    [
      { field: 'tableId', targetId: phase3JUnresolvedTableB?.id },
      { field: 'rowId', targetId: phase3JUnresolvedRowB?.id },
      { field: 'cellId', targetId: phase3JUnresolvedCellB?.id },
    ],
  );

  const phase3JOwnerCases: readonly {
    readonly name: string;
    readonly pair: ReturnType<typeof phase3JOwnerPair>;
    readonly expectedCurrentAccepted: boolean;
  }[] = [
    {
      name: 'createFrameHandle sibling frame provenance',
      pair: phase3JOwnerPair(
        'createFrameHandle sibling frame provenance',
        phase87SiblingProgram,
        phase87SiblingAuthority,
        operationValue => operationValue.kind === 'createFrameHandle'
          && operationValue.frameId === phase87SiblingFrameA?.id,
        [{ field: 'frameId', targetId: phase87SiblingFrameB?.id }],
      ),
      expectedCurrentAccepted: true,
    },
    {
      name: 'addTable sibling table provenance',
      pair: phase3JOwnerPair(
        'addTable sibling table provenance',
        phase87SiblingProgram,
        phase87SiblingAuthority,
        operationValue => operationValue.kind === 'addTable'
          && operationValue.tableId === phase87SiblingTableA?.id
          && operationValue.status === 'applied',
        [{ field: 'tableId', targetId: phase87SiblingTableB?.id }],
      ),
      expectedCurrentAccepted: false,
    },
    {
      name: 'setColWidth sibling table provenance',
      pair: phase3JOwnerPair(
        'setColWidth sibling table provenance',
        phase87SiblingProgram,
        phase87SiblingAuthority,
        operationValue => operationValue.kind === 'setColWidth'
          && operationValue.tableId === phase87SiblingTableA?.id
          && operationValue.status === 'applied',
        [{ field: 'tableId', targetId: phase87SiblingTableB?.id }],
      ),
      expectedCurrentAccepted: true,
    },
    {
      name: 'addRow sibling table-row provenance',
      pair: phase3JOwnerPair(
        'addRow sibling table-row provenance',
        phase87SiblingProgram,
        phase87SiblingAuthority,
        operationValue => operationValue.kind === 'addRow'
          && operationValue.tableId === phase87SiblingTableA?.id
          && operationValue.rowId === phase87SiblingRowA?.id
          && operationValue.status === 'applied',
        [
          { field: 'tableId', targetId: phase87SiblingTableB?.id },
          { field: 'rowId', targetId: phase87SiblingRowB?.id },
        ],
      ),
      expectedCurrentAccepted: true,
    },
    {
      name: 'unresolved createText sibling cell provenance',
      pair: phase3JUnresolvedOwnerAttack,
      expectedCurrentAccepted: true,
    },
    {
      name: 'display sibling frame provenance',
      pair: phase3JOwnerPair(
        'display sibling frame provenance',
        phase87SiblingProgram,
        phase87SiblingAuthority,
        operationValue => operationValue.kind === 'display'
          && operationValue.frameId === phase87SiblingFrameA?.id,
        [{ field: 'frameId', targetId: phase87SiblingFrameB?.id }],
      ),
      expectedCurrentAccepted: true,
    },
  ];
  for (const attack of phase3JOwnerCases) {
    const validation = attack.pair.program && attack.pair.authority
      ? safeSchemaPairValidation(attack.pair.program, attack.pair.authority)
      : { threw: false, valid: false, reason: 'owner provenance mutated pair missing' };
    phase3JRecord(
      `8A.7 Phase 3J owner-provenance ${attack.name}`,
      'owner-provenance',
      {
        ...attack.pair.proof,
        baseline: attack.name === 'unresolved createText sibling cell provenance'
          ? phase3JUnresolvedOwnerBaseline
          : phase87SiblingBaseline,
        validationReason: validation.reason,
      },
      validation,
      attack.expectedCurrentAccepted,
    );
  }

  const phase3JOccurrenceSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function getA() return runtimeA end',
    'local function getB() return runtimeB end',
    'local function getTop() return runtimeTop end',
    'local function leaf(cell, sampleWidth, width, height) cell:createText("x", { width = width, height = height, fontsize = sampleWidth }) end',
    'local function parent(cell, sampleWidth) leaf(cell, sampleWidth, getA(), getB()) end',
    'local function sibling(cell, sampleWidth) leaf(cell, sampleWidth, getB(), getA()) end',
    'local function display(sampleWidth)',
    '  local menu = { name = "Phase3JOccurrence", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local table = frame:addTable(1, { width = 80 })',
    '  local directTable = frame:addTable(getTop(), { width = 70 })',
    '  local dynamicTable = frame:addTable(1, { width = sampleWidth })',
    '  local row = table:addRow(false, {})',
    '  parent(row[1], sampleWidth)',
    '  sibling(row[1], sampleWidth)',
    '  frame:display()',
    'end',
  ].join('\n');
  const phase3JOccurrenceModel = buildX4UiCallModel(input(
    phase3JOccurrenceSource,
    'selftest/phase3j-occurrence.lua',
  ));
  const phase3JOccurrenceTarget = namedTarget(phase3JOccurrenceModel, 'display');
  const phase3JOccurrenceProfile = profileFor(phase3JOccurrenceModel, {
    localExpansion: { maxDepth: 4, maxInvocations: 16 },
  });
  const phase3JOccurrenceUnsampledResult = projectX4UiLayoutProgram(
    phase3JOccurrenceModel,
    phase3JOccurrenceTarget,
    phase3JOccurrenceProfile,
  );
  const phase3JOccurrenceUnsampledProgram = resultProgram(phase3JOccurrenceUnsampledResult);
  const phase3JOccurrenceSample = phase3JOccurrenceUnsampledProgram?.sampleCatalog.entries.find(entry =>
    entry.expression === 'sampleWidth'
      && entry.consumers.some(consumer => consumer.operationKind === 'createText'));
  const phase3JOccurrenceSampleInput: X4UiLayoutPreviewSampleInput | undefined = phase3JOccurrenceSample
    && phase3JOccurrenceUnsampledProgram
    ? {
      catalogId: phase3JOccurrenceUnsampledProgram.sampleCatalog.id,
      source: phase3JOccurrenceUnsampledProgram.sampleCatalog.sourceIdentity,
      values: [{ id: phase3JOccurrenceSample.id, value: 55 }],
    }
    : undefined;
  const phase3JOccurrenceResult = phase3JOccurrenceSampleInput
    ? projectX4UiLayoutProgram(
      phase3JOccurrenceModel,
      phase3JOccurrenceTarget,
      phase3JOccurrenceProfile,
      phase3JOccurrenceSampleInput,
    )
    : phase3JOccurrenceUnsampledResult;
  const phase3JOccurrenceProgram = resultProgram(phase3JOccurrenceResult);
  const phase3JOccurrenceAuthority = evidenceAuthorityOf(phase3JOccurrenceResult);
  const phase3JOccurrenceBaseline = phase3JOccurrenceProgram && phase3JOccurrenceAuthority
    ? safeSchemaPairValidation(phase3JOccurrenceProgram, phase3JOccurrenceAuthority)
    : { threw: false, valid: false, reason: 'occurrence fixture missing' };
  const phase3JUnsampledBaseline = phase3JOccurrenceUnsampledProgram
    && evidenceAuthorityOf(phase3JOccurrenceUnsampledResult)
    ? safeSchemaPairValidation(phase3JOccurrenceUnsampledProgram, evidenceAuthorityOf(phase3JOccurrenceUnsampledResult))
    : { threw: false, valid: false, reason: 'unsampled occurrence fixture missing' };
  const phase3JLocalPathsFor = (candidate: unknown): ValuePath[] => {
    const paths: ValuePath[] = [];
    for (let occurrence = 0; ; occurrence += 1) {
      const path = findValuePath(candidate, value => value.localInvocationResult !== undefined, occurrence);
      if (!path) return paths;
      paths.push(path);
    }
  };
  const phase3JExpandedCandidates = phase3JOccurrenceProgram?.operations
    .map((candidate, index) => ({ operation: candidate, index, paths: phase3JLocalPathsFor(candidate) }))
    .filter(candidate => candidate.operation.localExpansion !== undefined && candidate.paths.length >= 2) || [];
  const phase3JUnsampledExpandedCandidates = phase3JOccurrenceUnsampledProgram?.operations
    .map((candidate, index) => ({ operation: candidate, index, paths: phase3JLocalPathsFor(candidate) }))
    .filter(candidate => candidate.operation.localExpansion !== undefined && candidate.paths.length >= 2) || [];
  const phase3JUnsampledTopLevelCandidate = phase3JOccurrenceUnsampledProgram?.operations
    .map((candidate, index) => ({ operation: candidate, index, paths: phase3JLocalPathsFor(candidate) }))
    .find(candidate => candidate.operation.localExpansion === undefined && candidate.paths.length > 0);
  const phase3JExpandedPrimary = phase3JExpandedCandidates[0];
  const phase3JExpandedSibling = phase3JExpandedCandidates[1];
  const phase3JUnsampledExpandedPrimary = phase3JUnsampledExpandedCandidates[0];
  const phase3JValueAt = (candidate: { readonly operation: X4UiLayoutProgram['operations'][number]; readonly paths: readonly ValuePath[] } | undefined, path: ValuePath | undefined): ValueRecord | undefined =>
    path ? valuePathAt(candidate?.operation, path) as ValueRecord | undefined : undefined;
  const phase3JLocalTriple = (value: ValueRecord | undefined): ValueRecord | undefined => {
    const local = value?.localInvocationResult as ValueRecord | undefined;
    return local ? {
      invocationId: local.invocationId,
      source: jsonClone(local.source),
      expression: local.expression,
    } : undefined;
  };
  const phase3JLedgerTriple = (
    invocation: X4UiLayoutProgram['localIdentities']['invocations'][number] | undefined,
  ): ValueRecord | undefined => invocation ? {
    invocationId: invocation.id,
    source: jsonClone(invocation.source),
    expression: invocation.expression,
  } : undefined;
  const phase3JOccurrencePair = (
    name: string,
    sourceProgram: X4UiLayoutProgram | undefined,
    sourceAuthority: EvidenceAuthorityLike | undefined,
    sourceBaseline: Phase3JValidation,
    targetCandidate: { readonly index: number; readonly operation: X4UiLayoutProgram['operations'][number]; readonly paths: readonly ValuePath[] } | undefined,
    targetPath: ValuePath | undefined,
    replacement: ValueRecord | undefined,
    requireExpanded: boolean,
  ): { readonly program: X4UiLayoutProgram | undefined; readonly authority: EvidenceAuthorityLike | undefined; readonly proof: ValueRecord } => {
    if (!sourceProgram || !sourceAuthority || !targetCandidate || !targetPath || !replacement) {
      return { program: undefined, authority: undefined, proof: { fixtureReady: false, reason: 'occurrence context fixture missing', sourceProgram: sourceProgram !== undefined, sourceAuthority: sourceAuthority !== undefined, targetCandidate: targetCandidate !== undefined, targetPath: targetPath !== undefined, replacement: replacement !== undefined } };
    }
    const targetBefore = phase3JValueAt(targetCandidate, targetPath);
    const beforeLocal = phase3JLocalTriple(targetBefore);
    const replacementInvocation = sourceProgram.localIdentities.invocations.find(invocation =>
      invocation.id === replacement.invocationId
        && sameJson(invocation.source, replacement.source)
        && invocation.expression === replacement.expression);
    const pair = actualOperationSnapshotPairFor(
      sourceProgram,
      sourceAuthority,
      targetCandidate.index,
      operationValue => {
        mutateValueAtPath(operationValue, targetPath, value => {
          value.localInvocationResult = jsonClone(replacement);
        });
      },
      snapshot => {
        mutateValueAtPath(snapshot, targetPath, value => {
          value.localInvocationResult = jsonClone(replacement);
        });
      },
    );
    const targetAfter = phase3JValueAt({ operation: pair.program.operations[targetCandidate.index], paths: targetCandidate.paths }, targetPath);
    const afterLocal = phase3JLocalTriple(targetAfter);
    const authoritySnapshot = pair.authority.operations[targetCandidate.index]?.snapshot;
    const mutatedOperation = pair.program.operations[targetCandidate.index];
    const targetOperation = sourceProgram.operations[targetCandidate.index] as unknown as ValueRecord;
    const targetSampleProperty = ((targetOperation.metadata as ValueRecord | undefined)?.semantics as ValueRecord | undefined)
      ?.properties && Array.isArray((((targetOperation.metadata as ValueRecord).semantics as ValueRecord).properties))
      ? ((((targetOperation.metadata as ValueRecord).semantics as ValueRecord).properties as ValueRecord[]).find(property => property.name === 'fontsize'))
      : undefined;
    const targetSampleValue = targetSampleProperty?.value as ValueRecord | undefined;
    const unsampledTargetOperation = phase3JOccurrenceUnsampledProgram?.operations.find(operation => operation.id === targetOperation.id) as unknown as ValueRecord | undefined;
    const unsampledSampleProperty = ((unsampledTargetOperation?.metadata as ValueRecord | undefined)?.semantics as ValueRecord | undefined)
      ?.properties && Array.isArray((((unsampledTargetOperation?.metadata as ValueRecord).semantics as ValueRecord).properties))
      ? ((((unsampledTargetOperation?.metadata as ValueRecord).semantics as ValueRecord).properties as ValueRecord[]).find(property => property.name === 'fontsize'))
      : undefined;
    const selectedSampleConsumer = phase3JOccurrenceSample?.consumers.find(consumer =>
      consumer.operationId === targetOperation.id
        && consumer.operationKind === targetOperation.kind
        && consumer.field === 'fontsize');
    const selectedSampleBinding = (sourceProgram.previewSampleBindings as unknown as ValueRecord[] | undefined)?.find(binding =>
      binding.id === phase3JOccurrenceSample?.id
        && binding.status === 'consumed');
    const unsampledSampleBinding = (phase3JOccurrenceUnsampledProgram?.previewSampleBindings as unknown as ValueRecord[] | undefined)?.find(binding =>
      binding.id === phase3JOccurrenceSample?.id);
    const sampleConsumerMatchesTarget = name === 'same-operation sampled-source substitution'
      && phase3JOccurrenceSample !== undefined
      && phase3JOccurrenceSampleInput?.values[0]?.id === phase3JOccurrenceSample.id
      && phase3JOccurrenceSampleInput.catalogId === sourceProgram.sampleCatalog.id
      && sameJson(phase3JOccurrenceSampleInput.source, sourceProgram.sampleCatalog.sourceIdentity)
      && targetOperation.kind === 'createText'
      && typeof targetOperation.id === 'string'
      && selectedSampleConsumer !== undefined
      && selectedSampleBinding !== undefined
      && sameJson(targetSampleValue?.location, selectedSampleConsumer.source)
      && targetSampleValue?.expression === phase3JOccurrenceSample.expression;
    const sampleApplicationChangedTarget = name !== 'same-operation sampled-source substitution'
      || (selectedSampleBinding !== undefined && !sameJson(selectedSampleBinding, unsampledSampleBinding));
    const proof: ValueRecord = {
      fixtureReady: sourceBaseline.valid === true
        && (name !== 'same-operation sampled-source substitution' || phase3JUnsampledBaseline.valid === true)
        && targetBefore !== undefined
        && beforeLocal !== undefined
        && replacementInvocation !== undefined
        && afterLocal !== undefined
        && !sameJson(beforeLocal, afterLocal)
        && sameJson(afterLocal, replacement)
        && targetAfter?.expression === targetBefore.expression
        && sameJson(targetAfter.location, targetBefore.location)
        && sameJson(authoritySnapshot, mutatedOperation)
        && (name !== 'same-operation sampled-source substitution' || sampleConsumerMatchesTarget)
        && (name !== 'same-operation sampled-source substitution' || sampleApplicationChangedTarget)
        && (!requireExpanded || targetCandidate.operation.localExpansion !== undefined),
      operationIndex: targetCandidate.index,
      operationKind: targetCandidate.operation.kind,
      operationStatus: targetCandidate.operation.status,
      targetPath,
      beforeLocal,
      replacement,
      afterLocal,
      replacementInvocationId: replacementInvocation?.id,
      enclosingExpressionUnchanged: targetAfter?.expression === targetBefore?.expression,
      enclosingLocationUnchanged: sameJson(targetAfter?.location, targetBefore?.location),
      authoritySnapshotMatches: sameJson(authoritySnapshot, mutatedOperation),
      sampleInput: phase3JOccurrenceSampleInput,
      unsampledBaseline: phase3JUnsampledBaseline,
      sampleConsumerMatchesTarget,
      sampleApplicationChangedTarget,
      sampledEvidenceChanged: sampleApplicationChangedTarget,
      sampledEvidenceScope: 'previewSampleBindings',
      selectedSample: phase3JOccurrenceSample,
      selectedSampleConsumer,
      selectedSampleBinding,
      unsampledSampleBinding,
      targetOperationId: targetOperation.id,
      targetSampleValue,
      unsampledTargetSampleValue: unsampledSampleProperty?.value,
    };
    return {
      program: pair.program,
      authority: pair.authority,
      proof,
    };
  };
  const phase3JPrimaryFirstPath = phase3JExpandedPrimary?.paths[0];
  const phase3JPrimarySecondPath = phase3JExpandedPrimary?.paths[1];
  const phase3JSiblingReplacement = phase3JLocalTriple(phase3JValueAt(phase3JExpandedSibling, phase3JExpandedSibling?.paths[0]));
  const phase3JUnsampledTopLevelReplacement = phase3JLocalTriple(phase3JValueAt(
    phase3JUnsampledTopLevelCandidate,
    phase3JUnsampledTopLevelCandidate?.paths[0],
  ));
  const phase3JAncestorInvocation = phase3JExpandedPrimary?.operation.localExpansion?.ancestry[1];
  const phase3JAncestorReplacement = phase3JLedgerTriple(
    phase3JOccurrenceProgram?.localIdentities.invocations.find(invocation => invocation.id === phase3JAncestorInvocation),
  );
  const phase3JUnsampledDescendantInvocation = phase3JUnsampledExpandedPrimary?.operation.localExpansion?.ancestry.at(-1);
  const phase3JUnsampledDescendantReplacement = phase3JLedgerTriple(
    phase3JOccurrenceUnsampledProgram?.localIdentities.invocations.find(invocation => invocation.id === phase3JUnsampledDescendantInvocation),
  );
  const phase3JOccurrenceCases: readonly {
    readonly name: string;
    readonly pair: ReturnType<typeof phase3JOccurrencePair>;
    readonly expectedCurrentAccepted: boolean;
  }[] = [
    {
      name: 'ancestor expansion substitution',
      pair: phase3JOccurrencePair('ancestor expansion substitution', phase3JOccurrenceProgram, phase3JOccurrenceAuthority, phase3JOccurrenceBaseline, phase3JExpandedPrimary, phase3JPrimaryFirstPath, phase3JAncestorReplacement, true),
      expectedCurrentAccepted: true,
    },
    {
      name: 'sibling expansion substitution',
      pair: phase3JOccurrencePair('sibling expansion substitution', phase3JOccurrenceProgram, phase3JOccurrenceAuthority, phase3JOccurrenceBaseline, phase3JExpandedPrimary, phase3JPrimaryFirstPath, phase3JSiblingReplacement, true),
      expectedCurrentAccepted: true,
    },
    {
      name: 'unrelated top-level expansion substitution',
      pair: phase3JOccurrencePair('unrelated top-level expansion substitution', phase3JOccurrenceUnsampledProgram, evidenceAuthorityOf(phase3JOccurrenceUnsampledResult), phase3JUnsampledBaseline, phase3JUnsampledExpandedPrimary, phase3JUnsampledExpandedPrimary?.paths[0], phase3JUnsampledTopLevelReplacement, true),
      expectedCurrentAccepted: true,
    },
    {
      name: 'same-operation sampled-source substitution',
      pair: phase3JOccurrencePair('same-operation sampled-source substitution', phase3JOccurrenceProgram, phase3JOccurrenceAuthority, phase3JOccurrenceBaseline, phase3JExpandedPrimary, phase3JPrimaryFirstPath, phase3JLocalTriple(phase3JValueAt(phase3JExpandedPrimary, phase3JPrimarySecondPath)), true),
      expectedCurrentAccepted: true,
    },
    {
      name: 'descendant expansion substitution',
      pair: phase3JOccurrencePair('descendant expansion substitution', phase3JOccurrenceUnsampledProgram, evidenceAuthorityOf(phase3JOccurrenceUnsampledResult), phase3JUnsampledBaseline, phase3JUnsampledTopLevelCandidate, phase3JUnsampledTopLevelCandidate?.paths[0], phase3JUnsampledDescendantReplacement, false),
      expectedCurrentAccepted: false,
    },
  ];
  for (const attack of phase3JOccurrenceCases) {
    const validation = attack.pair.program && attack.pair.authority
      ? safeSchemaPairValidation(attack.pair.program, attack.pair.authority)
      : { threw: false, valid: false, reason: 'occurrence context mutated pair missing' };
    phase3JRecord(
      `8A.7 Phase 3J occurrence-context ${attack.name}`,
      'occurrence-context',
      {
        ...attack.pair.proof,
        baseline: phase3JOccurrenceBaseline,
      },
      validation,
      attack.expectedCurrentAccepted,
    );
  }

  const issuanceReady = result.status !== 'refused' && resultAuthority !== undefined;
  const issuedOriginal = issuedPair(program, resultAuthority);
  check('7B-A exact original non-refused producer pair is issued',
    issuanceReady && issuedOriginal.available && !issuedOriginal.threw && issuedOriginal.value,
    detail({ status: result.status, issuedOriginal }));

  const clonedProgram = issuanceReady ? freezeClone(jsonClone(program)) : undefined;
  const clonedAuthority = issuanceReady
    ? freezeClone(jsonClone(resultAuthority as EvidenceAuthorityLike))
    : undefined;
  const coherentCloneValidation = clonedProgram && clonedAuthority
    ? safeSchemaPairValidation(clonedProgram, clonedAuthority)
    : { threw: false, valid: false, reason: 'clone fixture missing' };
  const coherentCloneIssued = issuedPair(clonedProgram, clonedAuthority);
  check('7B-A deeply cloned and deeply frozen coherent pair is validator-valid but not issued',
    coherentCloneValidation.threw === false
      && coherentCloneValidation.valid === true
      && coherentCloneIssued.available
      && !coherentCloneIssued.threw
      && coherentCloneIssued.value === false,
    detail({ coherentCloneValidation, coherentCloneIssued }));

  const programCloneValidation = clonedProgram
    ? safeSchemaPairValidation(clonedProgram, resultAuthority)
    : { threw: false, valid: false, reason: 'program clone fixture missing' };
  const authorityCloneValidation = clonedAuthority
    ? safeSchemaPairValidation(program, clonedAuthority)
    : { threw: false, valid: false, reason: 'authority clone fixture missing' };
  const programCloneIssued = issuedPair(clonedProgram, resultAuthority);
  const authorityCloneIssued = issuedPair(program, clonedAuthority);
  check('7B-A program-only and authority-only clones fail identity issuance',
    programCloneValidation.threw === false
      && programCloneValidation.valid === true
      && authorityCloneValidation.threw === false
      && authorityCloneValidation.valid === true
      && programCloneIssued.available
      && authorityCloneIssued.available
      && !programCloneIssued.threw
      && !authorityCloneIssued.threw
      && programCloneIssued.value === false
      && authorityCloneIssued.value === false,
    detail({ programCloneValidation, authorityCloneValidation, programCloneIssued, authorityCloneIssued }));

  const firstInvocationResult = projectX4UiLayoutProgram(model, firstDuplicate, profile);
  const secondInvocationResult = projectX4UiLayoutProgram(model, secondDuplicate, profile);
  const firstInvocationProgram = resultProgram(firstInvocationResult);
  const secondInvocationProgram = resultProgram(secondInvocationResult);
  const firstInvocationAuthority = evidenceAuthorityOf(firstInvocationResult);
  const secondInvocationAuthority = evidenceAuthorityOf(secondInvocationResult);
  const firstInvocationIssued = issuedPair(firstInvocationProgram, firstInvocationAuthority);
  const secondInvocationIssued = issuedPair(secondInvocationProgram, secondInvocationAuthority);
  const firstWithSecondAuthority = issuedPair(firstInvocationProgram, secondInvocationAuthority);
  const secondWithFirstAuthority = issuedPair(secondInvocationProgram, firstInvocationAuthority);
  check('7B-A authorities swapped across producer invocations fail identity issuance',
    firstInvocationResult.status !== 'refused'
      && secondInvocationResult.status !== 'refused'
      && firstInvocationProgram !== undefined
      && secondInvocationProgram !== undefined
      && firstInvocationAuthority !== undefined
      && secondInvocationAuthority !== undefined
      && firstInvocationIssued.available
      && secondInvocationIssued.available
      && firstInvocationIssued.value
      && secondInvocationIssued.value
      && !firstWithSecondAuthority.threw
      && !secondWithFirstAuthority.threw
      && firstWithSecondAuthority.value === false
      && secondWithFirstAuthority.value === false,
    detail({
      firstStatus: firstInvocationResult.status,
      secondStatus: secondInvocationResult.status,
      firstInvocationIssued,
      secondInvocationIssued,
      firstWithSecondAuthority,
      secondWithFirstAuthority,
    }));

  let observableTrapReads = 0;
  const trap = (): never => {
    observableTrapReads += 1;
    throw new Error('issued-pair predicate inspected an attacker-controlled value');
  };
  const proxyProgram = new Proxy(program, {
    get: trap,
    getOwnPropertyDescriptor: trap,
    getPrototypeOf: trap,
    has: trap,
    isExtensible: trap,
    ownKeys: trap,
  });
  const proxyAuthority = resultAuthority === undefined
    ? undefined
    : new Proxy(resultAuthority, {
      get: trap,
      getOwnPropertyDescriptor: trap,
      getPrototypeOf: trap,
      has: trap,
      isExtensible: trap,
      ownKeys: trap,
    });
  const accessorProgram = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessorProgram, 'status', { get: trap });
  const accessorAuthority = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(accessorAuthority, 'version', { get: trap });
  const hostileCases = [
    issuedPair(proxyProgram, resultAuthority),
    issuedPair(program, proxyAuthority),
    issuedPair(proxyProgram, proxyAuthority),
    issuedPair(accessorProgram, resultAuthority),
    issuedPair(program, accessorAuthority),
  ];
  check('7B-A proxies and accessor-backed values fail closed without reads or throws',
    hostileCases.every(candidate => candidate.available && !candidate.threw && candidate.value === false)
      && observableTrapReads === 0,
    detail({ hostileCases, observableTrapReads }));

  const refusedIssuance = projectX4UiLayoutProgram(model, wrongSelector, profile);
  const refusedPair = issuedPair(resultProgram(refusedIssuance), evidenceAuthorityOf(refusedIssuance));
  check('7B-A refused producer results are never issued',
    refusedIssuance.status === 'refused'
      && refusedPair.available
      && !refusedPair.threw
      && refusedPair.value === false,
    detail({ status: refusedIssuance.status, refusedPair }));

  const primitiveIssuanceCases = [null, undefined, 0, '', false, Symbol('issued-pair')]
    .map(candidate => issuedPair(candidate, candidate));
  check('7B-A null and primitive inputs fail closed without throws',
    primitiveIssuanceCases.every(candidate => candidate.available && !candidate.threw && candidate.value === false),
    detail({ primitiveIssuanceCases }));

  const statusIssuanceCases = [
    { label: 'projected', expected: 'projected' as const, result: noOpResult },
    { label: 'partial', expected: 'partial' as const, result: dynamicGapResult },
  ].map(candidate => {
    const candidateProgram = resultProgram(candidate.result);
    const candidateAuthority = evidenceAuthorityOf(candidate.result);
    return {
      label: candidate.label,
      expected: candidate.expected,
      actual: candidate.result.status,
      issued: issuedPair(candidateProgram, candidateAuthority),
    };
  });
  check('7B-A projected and partial producer pairs may be issued after self-validation',
    statusIssuanceCases.every(candidate => candidate.actual === candidate.expected
      && candidate.issued.available
      && !candidate.issued.threw
      && candidate.issued.value),
    detail(statusIssuanceCases));

  const publicResultJsonBeforeModelChecks = JSON.stringify(result);
  const issuedOriginalForModel = issuedPairForModel(program, resultAuthority, model);
  check('7B-A.1 exact issued pair and original complete model are issued together',
    issuanceReady
      && issuedOriginal.value
      && issuedOriginalForModel.available
      && !issuedOriginalForModel.threw
      && issuedOriginalForModel.value,
    detail({ status: result.status, issuedOriginal, issuedOriginalForModel }));

  const completeModelClone = freezeClone(jsonClone(model));
  const issuedCompleteModelClone = issuedPairForModel(program, resultAuthority, completeModelClone);
  check('7B-A.1 exact issued pair accepts a deeply cloned frozen equal complete model',
    issuedCompleteModelClone.available
      && !issuedCompleteModelClone.threw
      && issuedCompleteModelClone.value,
    detail({ issuedCompleteModelClone, frozen: Object.isFrozen(completeModelClone) }));

  const reversedCallsModel = jsonClone(model) as unknown as ValueRecord;
  const callsBeforeReverse = [...(reversedCallsModel.calls as ValueRecord[])];
  reversedCallsModel.calls = [...callsBeforeReverse].reverse();
  const callsAfterReverse = reversedCallsModel.calls as ValueRecord[];
  freezeClone(reversedCallsModel);
  const issuedReversedCalls = issuedPairForModel(program, resultAuthority, reversedCallsModel);
  const reversedCallElementsUnchanged = callsAfterReverse.every((candidate, index) =>
    candidate === callsBeforeReverse[callsBeforeReverse.length - 1 - index]);
  const reversedCallOrdersUnchanged = callsAfterReverse.every(candidate =>
    typeof candidate.order === 'number' && Number.isFinite(candidate.order));
  check('7B-A.1 reversed model calls fail while call elements and numeric orders remain unchanged',
    callsBeforeReverse.length > 1
      && reversedCallElementsUnchanged
      && reversedCallOrdersUnchanged
      && issuedReversedCalls.available
      && !issuedReversedCalls.threw
      && issuedReversedCalls.value === false,
    detail({
      issuedReversedCalls,
      reversedCallElementsUnchanged,
      callOrdersBefore: callsBeforeReverse.map(candidate => candidate.order),
      callOrdersAfter: callsAfterReverse.map(candidate => candidate.order),
    }));

  const reversedRecordsModel = jsonClone(model) as unknown as ValueRecord;
  const recordsBeforeReverse = [...(reversedRecordsModel.records as ValueRecord[])];
  reversedRecordsModel.records = [...recordsBeforeReverse].reverse();
  const recordsAfterReverse = reversedRecordsModel.records as ValueRecord[];
  freezeClone(reversedRecordsModel);
  const issuedReversedRecords = issuedPairForModel(program, resultAuthority, reversedRecordsModel);
  const reversedRecordElementsUnchanged = recordsAfterReverse.every((candidate, index) =>
    candidate === recordsBeforeReverse[recordsBeforeReverse.length - 1 - index]);
  check('7B-A.1 reversed model records fail while record elements remain unchanged',
    recordsBeforeReverse.length > 1
      && reversedRecordElementsUnchanged
      && issuedReversedRecords.available
      && !issuedReversedRecords.threw
      && issuedReversedRecords.value === false,
    detail({ issuedReversedRecords, reversedRecordElementsUnchanged, recordCount: recordsAfterReverse.length }));

  const retargetFirstKnownLiteral = (
    candidate: unknown,
  ): { readonly before: string | number | boolean; readonly after: string | number | boolean } | undefined => {
    if (Array.isArray(candidate)) {
      for (const child of candidate) {
        const mutation = retargetFirstKnownLiteral(child);
        if (mutation) return mutation;
      }
      return undefined;
    }
    if (!candidate || typeof candidate !== 'object') return undefined;
    const record = candidate as ValueRecord;
    const value = record.value;
    if (record.status === 'static'
      && Object.prototype.hasOwnProperty.call(record, 'value')
      && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
      const after = typeof value === 'number'
        ? value + 1
        : typeof value === 'boolean'
          ? !value
          : `${value}:retargeted`;
      record.value = after;
      return { before: value, after };
    }
    for (const child of Object.values(record)) {
      const mutation = retargetFirstKnownLiteral(child);
      if (mutation) return mutation;
    }
    return undefined;
  };
  const wrongLiteralModel = jsonClone(model) as unknown as ValueRecord;
  const wrongLiteralCalls = wrongLiteralModel.calls as ValueRecord[];
  let wrongLiteralMutation: {
    readonly callOrder: unknown;
    readonly orderAfter: unknown;
    readonly before: string | number | boolean;
    readonly after: string | number | boolean;
  } | undefined;
  for (const call of wrongLiteralCalls) {
    const callOrder = call.order;
    const mutation = retargetFirstKnownLiteral(call);
    if (mutation) {
      wrongLiteralMutation = { callOrder, orderAfter: call.order, ...mutation };
      break;
    }
  }
  freezeClone(wrongLiteralModel);
  const modelWithArrayChange = (
    key: 'calls' | 'records',
    mode: 'added' | 'removed',
  ): X4UiCallModel => {
    const candidate = jsonClone(model) as unknown as ValueRecord;
    const values = candidate[key] as unknown[];
    candidate[key] = mode === 'added'
      ? [...values, jsonClone(values[0])]
      : values.slice(1);
    return freezeClone(candidate) as unknown as X4UiCallModel;
  };
  const completeContentMutations = [
    { name: 'same-call wrong literal', model: wrongLiteralModel },
    { name: 'added record', model: modelWithArrayChange('records', 'added') },
    { name: 'removed record', model: modelWithArrayChange('records', 'removed') },
    { name: 'added call', model: modelWithArrayChange('calls', 'added') },
    { name: 'removed call', model: modelWithArrayChange('calls', 'removed') },
  ].map(candidate => ({
    name: candidate.name,
    issued: issuedPairForModel(program, resultAuthority, candidate.model),
  }));
  check('7B-A.1 wrong literal and added or removed complete-model entries fail closed',
    wrongLiteralMutation !== undefined
      && wrongLiteralMutation.callOrder === wrongLiteralMutation.orderAfter
      && wrongLiteralMutation.before !== wrongLiteralMutation.after
      && completeContentMutations.every(candidate => candidate.issued.available
        && !candidate.issued.threw
        && candidate.issued.value === false),
    detail({ wrongLiteralMutation, completeContentMutations }));

  const sparseModel = jsonClone(model) as unknown as ValueRecord;
  const sparseCalls = sparseModel.calls as unknown[];
  delete sparseCalls[1];
  freezeClone(sparseModel);
  const undefinedModel = jsonClone(model) as unknown as ValueRecord;
  (undefinedModel.file as ValueRecord).text = undefined;
  freezeClone(undefinedModel);
  const nonFiniteModel = jsonClone(model) as unknown as ValueRecord;
  ((nonFiniteModel.calls as ValueRecord[])[0]).order = Number.POSITIVE_INFINITY;
  freezeClone(nonFiniteModel);
  const closedDomainMutations = [
    { name: 'sparse calls', model: sparseModel },
    { name: 'nested undefined', model: undefinedModel },
    { name: 'nested nonfinite', model: nonFiniteModel },
  ].map(candidate => ({
    name: candidate.name,
    issued: issuedPairForModel(program, resultAuthority, candidate.model),
  }));
  check('7B-A.1 sparse arrays and nested non-JSON values fail closed without throws',
    sparseCalls.length > 1
      && closedDomainMutations.every(candidate => candidate.issued.available
        && !candidate.issued.threw
        && candidate.issued.value === false),
    detail(closedDomainMutations));

  const customEnumerableModel = jsonClone(model) as unknown as ValueRecord;
  customEnumerableModel.unissuedEnumerableMember = { value: 'not in issuance snapshot' };
  const customPrototypeModel = jsonClone(model) as unknown as ValueRecord;
  Object.setPrototypeOf(customPrototypeModel.file as object, { customModelPrototype: true });
  const accessorModel = jsonClone(model) as unknown as ValueRecord;
  const accessorFile = accessorModel.file as ValueRecord;
  const accessorText = accessorFile.text;
  let accessorReads = 0;
  Object.defineProperty(accessorFile, 'text', {
    enumerable: true,
    get: () => {
      accessorReads += 1;
      return accessorText;
    },
  });
  let hostileModelProxyTraps = 0;
  const hostileProxyModel = new Proxy(freezeClone(jsonClone(model)), {
    getPrototypeOf: () => {
      hostileModelProxyTraps += 1;
      throw new Error('hostile model proxy trap');
    },
  });
  const cyclicModel = jsonClone(model) as unknown as ValueRecord;
  cyclicModel.self = cyclicModel;
  const hostileModelCases = [
    { name: 'custom enumerable member', model: customEnumerableModel },
    { name: 'custom prototype', model: customPrototypeModel },
    { name: 'accessor', model: accessorModel },
    { name: 'proxy', model: hostileProxyModel },
    { name: 'cycle', model: cyclicModel },
  ].map(candidate => ({
    name: candidate.name,
    issued: issuedPairForModel(program, resultAuthority, candidate.model),
  }));
  check('7B-A.1 custom accessor proxy and cyclic models fail closed without throws',
    hostileModelCases.every(candidate => candidate.issued.available
      && !candidate.issued.threw
      && candidate.issued.value === false)
      && accessorReads === 0
      && hostileModelProxyTraps > 0,
    detail({ hostileModelCases, accessorReads, hostileModelProxyTraps }));

  let shortCircuitModelTraps = 0;
  const unreadableShortCircuitModel = new Proxy(model, {
    getPrototypeOf: () => {
      shortCircuitModelTraps += 1;
      throw new Error('model should not be inspected before pair identity passes');
    },
  });
  const pairTrapReadsBeforeModelGate = observableTrapReads;
  const pairGateCases = [
    issuedPairForModel(proxyProgram, resultAuthority, unreadableShortCircuitModel),
    issuedPairForModel(program, proxyAuthority, unreadableShortCircuitModel),
  ];
  check('7B-A.1 model predicate rejects pair proxies before reading pair or model properties',
    issuanceReady
      && pairGateCases.every(candidate => candidate.available && !candidate.threw && candidate.value === false)
      && observableTrapReads === pairTrapReadsBeforeModelGate
      && shortCircuitModelTraps === 0,
    detail({ pairGateCases, observableTrapReads, pairTrapReadsBeforeModelGate, shortCircuitModelTraps }));

  const sameContentAcrossInvocation = issuedPairForModel(
    firstInvocationProgram,
    firstInvocationAuthority,
    completeModelClone,
  );
  const crossInvocationContent = issuedPairForModel(
    firstInvocationProgram,
    firstInvocationAuthority,
    sourceOrderModel,
  );
  check('7B-A.1 model identity is optional but cross-invocation model content fails',
    sameContentAcrossInvocation.available
      && !sameContentAcrossInvocation.threw
      && sameContentAcrossInvocation.value
      && crossInvocationContent.available
      && !crossInvocationContent.threw
      && crossInvocationContent.value === false,
    detail({ sameContentAcrossInvocation, crossInvocationContent }));

  const mutableIssuedModel = jsonClone(model);
  const mutableIssuedModelBefore = freezeClone(jsonClone(mutableIssuedModel));
  const mutableIssuedResult = projectX4UiLayoutProgram(
    mutableIssuedModel,
    topTarget(mutableIssuedModel),
    profileFor(mutableIssuedModel),
  );
  const mutableIssuedProgram = resultProgram(mutableIssuedResult);
  const mutableIssuedAuthority = evidenceAuthorityOf(mutableIssuedResult);
  const detachedSnapshotBeforeMutation = issuedPairForModel(
    mutableIssuedProgram,
    mutableIssuedAuthority,
    mutableIssuedModelBefore,
  );
  const mutableIssuedFile = (mutableIssuedModel as unknown as ValueRecord).file as ValueRecord;
  mutableIssuedFile.text = `${String(mutableIssuedFile.text)}\n-- post-issuance mutation`;
  const detachedSnapshotAfterMutation = issuedPairForModel(
    mutableIssuedProgram,
    mutableIssuedAuthority,
    mutableIssuedModel,
  );
  check('7B-A.1 issued complete-model snapshot is detached from later input mutation',
    mutableIssuedResult.status !== 'refused'
      && detachedSnapshotBeforeMutation.available
      && !detachedSnapshotBeforeMutation.threw
      && detachedSnapshotBeforeMutation.value
      && detachedSnapshotAfterMutation.available
      && !detachedSnapshotAfterMutation.threw
      && detachedSnapshotAfterMutation.value === false,
    detail({
      status: mutableIssuedResult.status,
      detachedSnapshotBeforeMutation,
      detachedSnapshotAfterMutation,
    }));

  const replayResult = projectX4UiLayoutProgram(model, target, profile);
  const replayIssuedForModel = issuedPairForModel(
    resultProgram(replayResult),
    evidenceAuthorityOf(replayResult),
    model,
  );
  const publicResultJsonAfterModelChecks = JSON.stringify(result);
  const replayPublicResultJson = JSON.stringify(replayResult);
  check('7B-A.1 private model issuance leaves public result program and evidence JSON byte-equivalent',
    replayIssuedForModel.available
      && !replayIssuedForModel.threw
      && replayIssuedForModel.value
      && publicResultJsonAfterModelChecks === publicResultJsonBeforeModelChecks
      && replayPublicResultJson === publicResultJsonBeforeModelChecks,
    detail({
      replayIssuedForModel,
      beforeBytes: publicResultJsonBeforeModelChecks.length,
      afterBytes: publicResultJsonAfterModelChecks.length,
      replayBytes: replayPublicResultJson.length,
    }));

  const sampledConditionalCellOwnerSource = [
    'local menu = { name = "SampledConditionalCellOwner", layer = 1 }',
    'function menu.display(tableWidth, margin, dynamicText)',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local tt = frame:addTable(4, { width = 80, reserveScrollBar = false, scaling = true })',
    '  local row = tt:addRow(true, {})',
    '  local function turnRow(frameHandle, text)',
    '    local ht = frameHandle:addTable(4, { width = 80, reserveScrollBar = false, scaling = true })',
    '    row = ht:addRow(false, {})',
    '  end',
    '  turnRow(frame, dynamicText)',
    '  local ct = frame:addTable(runtimeColumns, { width = tableWidth - margin * 2, reserveScrollBar = runtimeReserve, scaling = runtimeScaling })',
    '  if pend then',
    '    row = ct:addRow(false, {})',
    '    row[1]:setColSpan(7):createText(dynamicText, { height = runtimeHeight })',
    '    row[8]:setColSpan(5):createText(dynamicText, { height = runtimeHeight })',
    '  end',
    '  row = ct:addRow(false, {})',
    'end',
  ].join('\n');
  const sampledConditionalCellOwnerModel = buildX4UiCallModel(input(
    sampledConditionalCellOwnerSource,
    'selftest/sampled-conditional-cell-owner.lua',
  ));
  const sampledConditionalCellOwnerTarget = namedTarget(sampledConditionalCellOwnerModel, 'menu.display');
  const sampledConditionalCellOwnerProfile = profileFor(sampledConditionalCellOwnerModel, {
    localExpansion: { maxDepth: 3, maxInvocations: 4 },
  });
  const sampledConditionalCellOwnerUnsampledResult = projectX4UiLayoutProgram(
    sampledConditionalCellOwnerModel,
    sampledConditionalCellOwnerTarget,
    sampledConditionalCellOwnerProfile,
  );
  const sampledConditionalCellOwnerUnsampledProgram = resultProgram(sampledConditionalCellOwnerUnsampledResult);
  const sampledConditionalCellOwnerEntries = sampledConditionalCellOwnerUnsampledProgram?.sampleCatalog.entries
    .filter(entry => entry.expression === 'runtimeViewWidth'
      || entry.expression === 'runtimeViewHeight'
      || entry.expression === 'runtimeColumns'
      || entry.expression === 'tableWidth - margin * 2'
      || entry.expression === 'runtimeReserve'
      || entry.expression === 'runtimeScaling'
      || entry.expression === 'runtimeHeight'
      || entry.expression === 'dynamicText') || [];
  const sampledConditionalCellOwnerSamples: X4UiLayoutPreviewSampleInput | undefined = sampledConditionalCellOwnerUnsampledProgram
    && sampledConditionalCellOwnerEntries.length === sampledConditionalCellOwnerUnsampledProgram.sampleCatalog.entries.length
    ? {
      catalogId: sampledConditionalCellOwnerUnsampledProgram.sampleCatalog.id,
      source: sampledConditionalCellOwnerUnsampledProgram.sampleCatalog.sourceIdentity,
      values: sampledConditionalCellOwnerEntries.map(entry => ({
        id: entry.id,
        value: entry.expectedType === 'boolean'
          ? false
          : entry.expectedType === 'string'
            ? 'sampled'
            : entry.expression === 'runtimeViewWidth'
              ? 1920
            : entry.expression === 'runtimeViewHeight'
              ? 1080
              : entry.expression === 'runtimeColumns'
                ? 12
              : entry.expression === 'runtimeHeight'
                  ? 10
                  : 80,
      })),
    }
    : undefined;
  const sampledConditionalCellOwnerExpectedColumnCount = sampledConditionalCellOwnerSamples
    ? sampledConditionalCellOwnerSamples.values.find((candidate, index) =>
      sampledConditionalCellOwnerEntries[index]?.expression === 'runtimeColumns')?.value
    : undefined;
  const sampledConditionalCellOwnerResult = sampledConditionalCellOwnerSamples
    ? projectX4UiLayoutProgram(
      sampledConditionalCellOwnerModel,
      sampledConditionalCellOwnerTarget,
      sampledConditionalCellOwnerProfile,
      sampledConditionalCellOwnerSamples,
    )
    : undefined;
  const sampledConditionalCellOwnerProgram = sampledConditionalCellOwnerResult
    ? resultProgram(sampledConditionalCellOwnerResult)
    : undefined;
  const sampledConditionalCellOwnerAuthority = sampledConditionalCellOwnerResult
    ? evidenceAuthorityOf(sampledConditionalCellOwnerResult)
    : undefined;
  const sampledConditionalCellOwnerOperation = sampledConditionalCellOwnerProgram?.operations.find(candidate =>
    candidate.kind === 'setColSpan' && candidate.status === 'conditional');
  const sampledConditionalCellOwnerValidation = sampledConditionalCellOwnerProgram && sampledConditionalCellOwnerAuthority
    ? safeSchemaPairValidation(sampledConditionalCellOwnerProgram, sampledConditionalCellOwnerAuthority)
    : { threw: false, valid: false, reason: 'sampled conditional owner pair missing' };
  const sampledConditionalCellOwnerOperationAncestry = sampledConditionalCellOwnerOperation?.localExpansion?.ancestry
    || (sampledConditionalCellOwnerProgram ? [sampledConditionalCellOwnerProgram.target.id] : []);
  const sampledConditionalCellOwnerReceiverReference = sampledConditionalCellOwnerOperation?.metadata.receiver?.reference;
  const sampledConditionalCellOwnerCausalRowOperation = sampledConditionalCellOwnerProgram && sampledConditionalCellOwnerOperation
    && sampledConditionalCellOwnerReceiverReference?.parentPath
    ? sampledConditionalCellOwnerProgram.operations
      .filter(candidate => candidate.kind === 'addRow'
        && candidate.rowId !== undefined
        && candidate.metadata.result?.path === sampledConditionalCellOwnerReceiverReference.parentPath
        && (candidate.localExpansion?.ancestry || [sampledConditionalCellOwnerProgram.target.id])
          .every((ancestor, index) => sampledConditionalCellOwnerOperationAncestry[index] === ancestor)
        && (candidate.localExpansion?.ancestry || [sampledConditionalCellOwnerProgram.target.id]).length
          === sampledConditionalCellOwnerOperationAncestry.length
        && candidate.source.start.offset <= sampledConditionalCellOwnerOperation.source.start.offset)
      .sort((left, right) => right.source.start.offset - left.source.start.offset)[0]
    : undefined;
  const sampledConditionalCellOwnerCausalRow = sampledConditionalCellOwnerCausalRowOperation?.rowId
    ? sampledConditionalCellOwnerProgram?.rows.find(candidate => candidate.id === sampledConditionalCellOwnerCausalRowOperation.rowId)
    : undefined;
  const sampledConditionalCellOwnerExpectedTable = sampledConditionalCellOwnerCausalRow?.tableId
    ? sampledConditionalCellOwnerProgram?.tables.find(candidate => candidate.id === sampledConditionalCellOwnerCausalRow.tableId)
    : undefined;
  const sampledConditionalCellOwnerExpectedRow = sampledConditionalCellOwnerProgram && sampledConditionalCellOwnerExpectedTable
    && sampledConditionalCellOwnerReceiverReference?.parentPath
    ? sampledConditionalCellOwnerCausalRow && sampledConditionalCellOwnerCausalRow.cellIds.length > 0
      ? sampledConditionalCellOwnerCausalRow
      : sampledConditionalCellOwnerProgram.rows.find(candidate =>
        candidate.tableId === sampledConditionalCellOwnerExpectedTable.id
          && candidate.identity?.path === sampledConditionalCellOwnerReceiverReference.parentPath
          && candidate.cellIds.length > 0)
    : undefined;
  const sampledConditionalCellOwnerIndex = sampledConditionalCellOwnerReceiverReference?.index?.value;
  const sampledConditionalCellOwnerExpectedCell = sampledConditionalCellOwnerExpectedRow
    && typeof sampledConditionalCellOwnerIndex === 'number'
    && Number.isSafeInteger(sampledConditionalCellOwnerIndex)
    ? sampledConditionalCellOwnerProgram?.cells.find(candidate =>
      candidate.rowId === sampledConditionalCellOwnerExpectedRow.id
        && candidate.column === sampledConditionalCellOwnerIndex)
    : undefined;
  const sampledConditionalCellOwnerExpectedTableOperation = sampledConditionalCellOwnerExpectedTable
    ? sampledConditionalCellOwnerProgram?.operations.find(candidate =>
      candidate.kind === 'addTable' && candidate.tableId === sampledConditionalCellOwnerExpectedTable!.id)
    : undefined;
  const sampledConditionalCellOwnerExpectedRowOperation = sampledConditionalCellOwnerExpectedRow
    ? sampledConditionalCellOwnerProgram?.operations.find(candidate =>
      candidate.kind === 'addRow' && candidate.rowId === sampledConditionalCellOwnerExpectedRow!.id)
    : undefined;
  const sampledConditionalCellOwnerAuthorityWithNodes = sampledConditionalCellOwnerAuthority as EvidenceAuthorityWithNodesLike | undefined;
  const sampledConditionalCellOwnerExpectedAuthorityTable = sampledConditionalCellOwnerAuthorityWithNodes?.nodes.tables.find(candidate =>
    candidate.id === sampledConditionalCellOwnerExpectedTable?.id);
  const sampledConditionalCellOwnerExpectedAuthorityRow = sampledConditionalCellOwnerAuthorityWithNodes?.nodes.rows.find(candidate =>
    candidate.id === sampledConditionalCellOwnerExpectedRow?.id);
  const sampledConditionalCellOwnerExpectedAuthorityCell = sampledConditionalCellOwnerAuthorityWithNodes?.nodes.cells.find(candidate =>
    candidate.id === sampledConditionalCellOwnerExpectedCell?.id);
  const sampledConditionalCellOwnerCausalClosure = sampledConditionalCellOwnerOperation !== undefined
    && sampledConditionalCellOwnerExpectedTable !== undefined
    && sampledConditionalCellOwnerExpectedRow !== undefined
    && sampledConditionalCellOwnerExpectedCell !== undefined
    && sampledConditionalCellOwnerExpectedTableOperation !== undefined
    && sampledConditionalCellOwnerExpectedAuthorityTable !== undefined
    && sampledConditionalCellOwnerExpectedAuthorityRow !== undefined
    && sampledConditionalCellOwnerExpectedAuthorityCell !== undefined
    && sampledConditionalCellOwnerOperation.tableId === sampledConditionalCellOwnerExpectedTable.id
    && sampledConditionalCellOwnerOperation.rowId === sampledConditionalCellOwnerExpectedRow.id
    && sampledConditionalCellOwnerOperation.cellId === sampledConditionalCellOwnerExpectedCell.id
    && sampledConditionalCellOwnerExpectedRow.tableId === sampledConditionalCellOwnerExpectedTable.id
    && sampledConditionalCellOwnerExpectedCell.tableId === sampledConditionalCellOwnerExpectedTable.id
    && sampledConditionalCellOwnerExpectedCell.rowId === sampledConditionalCellOwnerExpectedRow.id
    && typeof sampledConditionalCellOwnerExpectedColumnCount === 'number'
    && sampledConditionalCellOwnerExpectedTable.numColumns === sampledConditionalCellOwnerExpectedColumnCount
    && sameJson(sampledConditionalCellOwnerExpectedRow.identity, sampledConditionalCellOwnerExpectedRowOperation?.metadata.result)
    && sameJson(sampledConditionalCellOwnerExpectedTable.identity, sampledConditionalCellOwnerExpectedTableOperation.metadata.result)
    && sameJson(sampledConditionalCellOwnerOperation.metadata.receiver?.reference, sampledConditionalCellOwnerOperation.metadata.semantics.cell?.reference)
    && sameJson(sampledConditionalCellOwnerOperation.metadata.receiver?.reference, sampledConditionalCellOwnerOperation.metadata.result)
    && sameJson(sampledConditionalCellOwnerOperation.metadata.receiver?.reference, sampledConditionalCellOwnerExpectedCell.identity)
    && sampledConditionalCellOwnerExpectedRow.rowIndex === undefined
    && sampledConditionalCellOwnerExpectedRow.kernelState === undefined
    && sampledConditionalCellOwnerExpectedTable.rowIds.every(candidate => candidate !== sampledConditionalCellOwnerExpectedRow.id)
    && sampledConditionalCellOwnerExpectedRow.cellIds.filter(candidate => candidate === sampledConditionalCellOwnerExpectedCell.id).length === 1
    && sampledConditionalCellOwnerExpectedTable.operationIds.filter(candidate => candidate === sampledConditionalCellOwnerOperation.id).length === 1
    && sampledConditionalCellOwnerExpectedRow.operationIds.filter(candidate => candidate === sampledConditionalCellOwnerOperation.id).length === 1
    && sampledConditionalCellOwnerExpectedCell.operationIds.filter(candidate => candidate === sampledConditionalCellOwnerOperation.id).length === 1
    && sampledConditionalCellOwnerExpectedAuthorityTable.operationIds.filter(candidate => candidate === sampledConditionalCellOwnerOperation.id).length === 1
    && sampledConditionalCellOwnerExpectedAuthorityRow.operationIds.filter(candidate => candidate === sampledConditionalCellOwnerOperation.id).length === 1
    && sampledConditionalCellOwnerExpectedAuthorityCell.operationIds.filter(candidate => candidate === sampledConditionalCellOwnerOperation.id).length === 1;
  const sampledConditionalLocalCellOwnerSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, columns, width)',
    '  local table = frame:addTable(columns, { width = width, reserveScrollBar = false })',
    '  local row = table:addRow(false, {})',
    '  if choice then',
    '    row[1]:setColSpan(6)',
    '  end',
    'end',
    'local function display()',
    '  local menu = { name = "SampledConditionalLocalCellOwner", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, runtimeColumns, runtimeWidth)',
    'end',
  ].join('\n');
  const sampledConditionalLocalCellOwnerModel = buildX4UiCallModel(input(
    sampledConditionalLocalCellOwnerSource,
    'selftest/sampled-conditional-local-cell-owner.lua',
  ));
  const sampledConditionalLocalCellOwnerTarget = namedTarget(sampledConditionalLocalCellOwnerModel, 'display');
  const sampledConditionalLocalCellOwnerProfile = profileFor(sampledConditionalLocalCellOwnerModel, {
    localExpansion: { maxDepth: 3, maxInvocations: 4 },
  });
  const sampledConditionalLocalCellOwnerUnsampledResult = projectX4UiLayoutProgram(
    sampledConditionalLocalCellOwnerModel,
    sampledConditionalLocalCellOwnerTarget,
    sampledConditionalLocalCellOwnerProfile,
  );
  const sampledConditionalLocalCellOwnerUnsampledProgram = resultProgram(sampledConditionalLocalCellOwnerUnsampledResult);
  const sampledConditionalLocalCellOwnerEntries = sampledConditionalLocalCellOwnerUnsampledProgram?.sampleCatalog.entries
    .filter(entry => entry.expression === 'runtimeColumns' || entry.expression === 'runtimeWidth') || [];
  const sampledConditionalLocalCellOwnerSamples: X4UiLayoutPreviewSampleInput | undefined = sampledConditionalLocalCellOwnerUnsampledProgram
    && sampledConditionalLocalCellOwnerEntries.length === 2
    ? {
      catalogId: sampledConditionalLocalCellOwnerUnsampledProgram.sampleCatalog.id,
      source: sampledConditionalLocalCellOwnerUnsampledProgram.sampleCatalog.sourceIdentity,
      values: sampledConditionalLocalCellOwnerEntries.map(entry => ({
        id: entry.id,
        value: entry.expression === 'runtimeColumns' ? 1 : 80,
      })),
    }
    : undefined;
  const sampledConditionalLocalCellOwnerResult = sampledConditionalLocalCellOwnerSamples
    ? projectX4UiLayoutProgram(
      sampledConditionalLocalCellOwnerModel,
      sampledConditionalLocalCellOwnerTarget,
      sampledConditionalLocalCellOwnerProfile,
      sampledConditionalLocalCellOwnerSamples,
    )
    : undefined;
  const sampledConditionalLocalCellOwnerProgram = sampledConditionalLocalCellOwnerResult
    ? resultProgram(sampledConditionalLocalCellOwnerResult)
    : undefined;
  const sampledConditionalLocalCellOwnerAuthority = sampledConditionalLocalCellOwnerResult
    ? evidenceAuthorityOf(sampledConditionalLocalCellOwnerResult)
    : undefined;
  const sampledConditionalLocalCellOwnerOperation = sampledConditionalLocalCellOwnerProgram?.operations.find(candidate =>
    candidate.kind === 'setColSpan' && candidate.status === 'conditional');
  const sampledConditionalLocalCellOwnerValidation = sampledConditionalLocalCellOwnerProgram && sampledConditionalLocalCellOwnerAuthority
    ? safeSchemaPairValidation(sampledConditionalLocalCellOwnerProgram, sampledConditionalLocalCellOwnerAuthority)
    : { threw: false, valid: false, reason: 'sampled conditional local owner pair missing' };
  const sampledConditionalProductionSource = [
    'local menu = { name = "SampledConditionalProduction", layer = 1 }',
    'function menu.display(tableWidth, margin, dynamicText)',
    '  local frame = Helper.createFrameHandle(menu, { width = runtimeViewWidth, height = runtimeViewHeight })',
    '  local table = frame:addTable(2, { width = tableWidth - margin * 2, reserveScrollBar = runtimeReserve, scaling = runtimeScaling })',
    '  local row = table:addRow(false, { scaling = runtimeRowScaling })',
    '  if choice then',
    '    row[1]:setColSpan(7)',
    '  end',
    '  row[1]:createText(dynamicText, { height = runtimeHeight })',
    'end',
  ].join('\n');
  const sampledConditionalProductionModel = buildX4UiCallModel(input(
    sampledConditionalProductionSource,
    'selftest/sampled-conditional-production.lua',
  ));
  const sampledConditionalProductionTarget = namedTarget(sampledConditionalProductionModel, 'menu.display');
  const sampledConditionalProductionProfile = profileFor(sampledConditionalProductionModel);
  const sampledConditionalProductionUnsampledResult = projectX4UiLayoutProgram(
    sampledConditionalProductionModel,
    sampledConditionalProductionTarget,
    sampledConditionalProductionProfile,
  );
  const sampledConditionalProductionUnsampledProgram = resultProgram(sampledConditionalProductionUnsampledResult);
  const sampledConditionalProductionSamples: X4UiLayoutPreviewSampleInput | undefined = sampledConditionalProductionUnsampledProgram
    ? {
      catalogId: sampledConditionalProductionUnsampledProgram.sampleCatalog.id,
      source: sampledConditionalProductionUnsampledProgram.sampleCatalog.sourceIdentity,
      values: sampledConditionalProductionUnsampledProgram.sampleCatalog.entries.map(entry => ({
        id: entry.id,
        value: entry.expectedType === 'boolean'
          ? false
          : entry.expectedType === 'string'
            ? 'sampled'
            : entry.expression === 'runtimeViewWidth'
              ? 1920
              : entry.expression === 'runtimeViewHeight'
                ? 1080
                : entry.expression === 'runtimeHeight'
                  ? 10
                  : 80,
      })),
    }
    : undefined;
  const sampledConditionalProductionResult = sampledConditionalProductionSamples
    ? projectX4UiLayoutProgram(
      sampledConditionalProductionModel,
      sampledConditionalProductionTarget,
      sampledConditionalProductionProfile,
      sampledConditionalProductionSamples,
    )
    : undefined;
  const sampledConditionalProductionProgram = sampledConditionalProductionResult
    ? resultProgram(sampledConditionalProductionResult)
    : undefined;
  const sampledConditionalProductionAuthority = sampledConditionalProductionResult
    ? evidenceAuthorityOf(sampledConditionalProductionResult)
    : undefined;
  const sampledConditionalProductionOperation = sampledConditionalProductionProgram?.operations.find(candidate =>
    candidate.kind === 'setColSpan' && candidate.status === 'conditional');
  const sampledConditionalProductionValidation = sampledConditionalProductionProgram && sampledConditionalProductionAuthority
    ? safeSchemaPairValidation(sampledConditionalProductionProgram, sampledConditionalProductionAuthority)
    : { threw: false, valid: false, reason: 'sampled conditional production pair missing' };
  check('B119 sampled conditional static setColSpan emits and closes its exact source cell owner',
    sampledConditionalCellOwnerUnsampledResult.status !== 'refused'
      && sampledConditionalCellOwnerUnsampledProgram !== undefined
      && sampledConditionalCellOwnerUnsampledProgram.operations.some(candidate =>
        candidate.kind === 'setColSpan'
          && candidate.status === 'conditional'
          && candidate.tableId !== undefined
          && candidate.rowId !== undefined
          && candidate.cellId === undefined)
      && sampledConditionalCellOwnerSamples !== undefined
      && sampledConditionalCellOwnerResult?.status !== 'refused'
      && sampledConditionalCellOwnerProgram !== undefined
      && sampledConditionalCellOwnerAuthority !== undefined
      && sampledConditionalCellOwnerOperation?.tableId !== undefined
      && sampledConditionalCellOwnerOperation.rowId !== undefined
      && sampledConditionalCellOwnerOperation.cellId !== undefined
      && sampledConditionalCellOwnerCausalClosure
      && sampledConditionalCellOwnerValidation.threw === false
      && sampledConditionalCellOwnerValidation.valid === true,
    detail({
      unsampledStatus: sampledConditionalCellOwnerUnsampledResult.status,
      unsampledRefusal: refusalCode(sampledConditionalCellOwnerUnsampledResult),
      unsampledRefusalMessage: 'refusal' in sampledConditionalCellOwnerUnsampledResult
        ? sampledConditionalCellOwnerUnsampledResult.refusal.message
        : undefined,
      sampleEntries: sampledConditionalCellOwnerEntries,
      sampledStatus: sampledConditionalCellOwnerResult?.status,
      sampledRefusal: sampledConditionalCellOwnerResult ? refusalCode(sampledConditionalCellOwnerResult) : undefined,
      sampledRefusalMessage: sampledConditionalCellOwnerResult && 'refusal' in sampledConditionalCellOwnerResult
        ? sampledConditionalCellOwnerResult.refusal.message
        : undefined,
      operation: sampledConditionalCellOwnerOperation
        ? {
          id: sampledConditionalCellOwnerOperation.id,
          modelOrder: sampledConditionalCellOwnerOperation.modelOrder,
          status: sampledConditionalCellOwnerOperation.status,
          tableId: sampledConditionalCellOwnerOperation.tableId,
          rowId: sampledConditionalCellOwnerOperation.rowId,
          cellId: sampledConditionalCellOwnerOperation.cellId,
          receiver: sampledConditionalCellOwnerOperation.metadata.receiver?.reference,
          semanticsCell: sampledConditionalCellOwnerOperation.metadata.semantics.cell?.reference,
        }
        : undefined,
      causalOwner: {
        expectedTableOperation: sampledConditionalCellOwnerExpectedTableOperation
          ? {
            id: sampledConditionalCellOwnerExpectedTableOperation.id,
            tableId: sampledConditionalCellOwnerExpectedTableOperation.tableId,
            result: sampledConditionalCellOwnerExpectedTableOperation.metadata.result,
          }
          : undefined,
        expectedTable: sampledConditionalCellOwnerExpectedTable
          ? {
            id: sampledConditionalCellOwnerExpectedTable.id,
            identity: sampledConditionalCellOwnerExpectedTable.identity,
            numColumns: sampledConditionalCellOwnerExpectedTable.numColumns,
          }
          : undefined,
        expectedRow: sampledConditionalCellOwnerExpectedRow
          ? {
            id: sampledConditionalCellOwnerExpectedRow.id,
            identity: sampledConditionalCellOwnerExpectedRow.identity,
            tableId: sampledConditionalCellOwnerExpectedRow.tableId,
          }
          : undefined,
        causalRow: sampledConditionalCellOwnerCausalRow
          ? {
            id: sampledConditionalCellOwnerCausalRow.id,
            cellIds: sampledConditionalCellOwnerCausalRow.cellIds,
            tableId: sampledConditionalCellOwnerCausalRow.tableId,
          }
          : undefined,
        expectedCell: sampledConditionalCellOwnerExpectedCell
          ? {
            id: sampledConditionalCellOwnerExpectedCell.id,
            identity: sampledConditionalCellOwnerExpectedCell.identity,
            tableId: sampledConditionalCellOwnerExpectedCell.tableId,
            rowId: sampledConditionalCellOwnerExpectedCell.rowId,
            column: sampledConditionalCellOwnerExpectedCell.column,
          }
          : undefined,
        operationOwner: sampledConditionalCellOwnerOperation
          ? {
            tableId: sampledConditionalCellOwnerOperation.tableId,
            rowId: sampledConditionalCellOwnerOperation.rowId,
            cellId: sampledConditionalCellOwnerOperation.cellId,
            receiver: sampledConditionalCellOwnerOperation.metadata.receiver?.reference,
            semanticsCell: sampledConditionalCellOwnerOperation.metadata.semantics.cell?.reference,
          }
          : undefined,
        reciprocalLedgers: {
          program: {
            table: sampledConditionalCellOwnerExpectedTable?.operationIds,
            row: sampledConditionalCellOwnerExpectedRow?.operationIds,
            cell: sampledConditionalCellOwnerExpectedCell?.operationIds,
          },
          authority: {
            table: sampledConditionalCellOwnerExpectedAuthorityTable?.operationIds,
            row: sampledConditionalCellOwnerExpectedAuthorityRow?.operationIds,
            cell: sampledConditionalCellOwnerExpectedAuthorityCell?.operationIds,
          },
        },
        causalClosure: sampledConditionalCellOwnerCausalClosure,
      },
      validation: sampledConditionalCellOwnerValidation,
      localVariant: {
        unsampledStatus: sampledConditionalLocalCellOwnerUnsampledResult.status,
        unsampledRefusal: refusalCode(sampledConditionalLocalCellOwnerUnsampledResult),
        sampleEntries: sampledConditionalLocalCellOwnerEntries,
        sampledStatus: sampledConditionalLocalCellOwnerResult?.status,
        sampledRefusal: sampledConditionalLocalCellOwnerResult ? refusalCode(sampledConditionalLocalCellOwnerResult) : undefined,
        operation: sampledConditionalLocalCellOwnerOperation,
        validation: sampledConditionalLocalCellOwnerValidation,
      },
      productionVariant: {
        unsampledStatus: sampledConditionalProductionUnsampledResult.status,
        unsampledRefusal: refusalCode(sampledConditionalProductionUnsampledResult),
        sampleEntries: sampledConditionalProductionUnsampledProgram?.sampleCatalog.entries,
        sampledStatus: sampledConditionalProductionResult?.status,
        sampledRefusal: sampledConditionalProductionResult ? refusalCode(sampledConditionalProductionResult) : undefined,
        operation: sampledConditionalProductionOperation,
        validation: sampledConditionalProductionValidation,
      },
    }));

  const sampledConditionalCellOwnerConditionalOperations = sampledConditionalCellOwnerProgram?.operations.filter(candidate =>
    candidate.kind === 'setColSpan' && candidate.status === 'conditional') || [];
  const sampledConditionalCellOwnerAllCausalOwners = sampledConditionalCellOwnerConditionalOperations.map(operation => {
    const receiver = operation.metadata.receiver?.reference;
    const index = receiver?.index?.value;
    const row = sampledConditionalCellOwnerProgram?.rows.find(candidate =>
      candidate.tableId === sampledConditionalCellOwnerExpectedTable?.id
        && candidate.identity?.path === receiver?.parentPath
        && candidate.cellIds.length > 0
        && typeof index === 'number'
        && candidate.cellIds.some(cellId => sampledConditionalCellOwnerProgram?.cells.find(cell =>
          cell.id === cellId && cell.column === index) !== undefined));
    const cell = row && typeof index === 'number'
      ? sampledConditionalCellOwnerProgram?.cells.find(candidate =>
        candidate.rowId === row.id && candidate.column === index)
      : undefined;
    const table = row?.tableId
      ? sampledConditionalCellOwnerProgram?.tables.find(candidate => candidate.id === row.tableId)
      : undefined;
    const authorityTable = sampledConditionalCellOwnerAuthorityWithNodes?.nodes.tables.find(candidate => candidate.id === table?.id);
    const authorityRow = sampledConditionalCellOwnerAuthorityWithNodes?.nodes.rows.find(candidate => candidate.id === row?.id);
    const authorityCell = sampledConditionalCellOwnerAuthorityWithNodes?.nodes.cells.find(candidate => candidate.id === cell?.id);
    return {
      operation,
      receiver,
      table,
      row,
      cell,
      authorityTable,
      authorityRow,
      authorityCell,
      causal: table !== undefined
        && row !== undefined
        && cell !== undefined
        && authorityTable !== undefined
        && authorityRow !== undefined
        && authorityCell !== undefined
        && operation.tableId === table.id
        && operation.rowId === row.id
        && operation.cellId === cell.id
        && sameJson(receiver, operation.metadata.semantics.cell?.reference)
        && sameJson(receiver, operation.metadata.result)
        && sameJson(receiver, cell.identity)
        && row.rowIndex === undefined
        && row.kernelState === undefined
        && table.rowIds.every(candidate => candidate !== row.id)
        && row.cellIds.filter(candidate => candidate === cell.id).length === 1
        && table.operationIds.filter(candidate => candidate === operation.id).length === 1
        && row.operationIds.filter(candidate => candidate === operation.id).length === 1
        && cell.operationIds.filter(candidate => candidate === operation.id).length === 1
        && authorityTable.operationIds.filter(candidate => candidate === operation.id).length === 1
        && authorityRow.operationIds.filter(candidate => candidate === operation.id).length === 1
        && authorityCell.operationIds.filter(candidate => candidate === operation.id).length === 1,
    };
  });
  check('B119 every sampled conditional cell operation keeps one exact causal table/row/cell ledger closure',
    sampledConditionalCellOwnerConditionalOperations.length >= 2
      && sampledConditionalCellOwnerAllCausalOwners.every(candidate => candidate.causal),
    detail({
      operationCount: sampledConditionalCellOwnerConditionalOperations.length,
      owners: sampledConditionalCellOwnerAllCausalOwners.map(candidate => ({
        operationId: candidate.operation.id,
        tableId: candidate.operation.tableId,
        rowId: candidate.operation.rowId,
        cellId: candidate.operation.cellId,
        expectedTableId: candidate.table?.id,
        expectedRowId: candidate.row?.id,
        expectedCellId: candidate.cell?.id,
        causal: candidate.causal,
      })),
    }));

  type B119Fixture = {
    readonly unsampled: ReturnType<typeof projectX4UiLayoutProgram>;
    readonly unsampledProgram: X4UiLayoutProgram | undefined;
    readonly samples: X4UiLayoutPreviewSampleInput | undefined;
    readonly sampled: ReturnType<typeof projectX4UiLayoutProgram> | undefined;
    readonly program: X4UiLayoutProgram | undefined;
    readonly authority: EvidenceAuthorityLike | undefined;
    readonly fixtureReady: boolean;
  };
  const b119SamplesFor = (candidate: X4UiLayoutProgram): X4UiLayoutPreviewSampleInput => ({
    catalogId: candidate.sampleCatalog.id,
    source: candidate.sampleCatalog.sourceIdentity,
    values: candidate.sampleCatalog.entries.map(entry => {
      const expression = entry.expression.toLowerCase();
      const value = entry.expectedType === 'boolean'
        ? false
        : entry.expectedType === 'string'
          ? 'sampled'
          : expression.includes('column')
            ? 12
            : 80;
      return { id: entry.id, value };
    }),
  });
  const b119Fixture = (
    source: string,
    rel: string,
    expandLocals = false,
    sampleFactory: (candidate: X4UiLayoutProgram) => X4UiLayoutPreviewSampleInput = b119SamplesFor,
  ): B119Fixture => {
    const fixtureModel = buildX4UiCallModel(input(source, rel));
    const fixtureTarget = namedTarget(fixtureModel, 'menu.display');
    const fixtureProfile = profileFor(fixtureModel, expandLocals
      ? { localExpansion: { maxDepth: 3, maxInvocations: 4 } }
      : {});
    const unsampled = projectX4UiLayoutProgram(fixtureModel, fixtureTarget, fixtureProfile);
    const unsampledProgram = resultProgram(unsampled);
    const samples = unsampledProgram ? sampleFactory(unsampledProgram) : undefined;
    const sampled = samples
      ? projectX4UiLayoutProgram(fixtureModel, fixtureTarget, fixtureProfile, samples)
      : undefined;
    const program = sampled ? resultProgram(sampled) : undefined;
    const authority = sampled ? evidenceAuthorityOf(sampled) : undefined;
    return {
      unsampled,
      unsampledProgram,
      samples,
      sampled,
      program,
      authority,
      fixtureReady: unsampledProgram !== undefined
        && samples !== undefined
        && sampled !== undefined
        && (sampled.status === 'refused' || (program !== undefined && authority !== undefined)),
    };
  };
  const b119OwnerClosure = (
    candidateProgram: X4UiLayoutProgram | undefined,
    candidateAuthority: EvidenceAuthorityLike | undefined,
    operation: X4UiLayoutProgram['operations'][number] | undefined,
  ): ValueRecord => {
    const authorityWithNodes = candidateAuthority as EvidenceAuthorityWithNodesLike | undefined;
    const table = candidateProgram && operation?.tableId
      ? candidateProgram.tables.find(candidate => candidate.id === operation.tableId)
      : undefined;
    const row = candidateProgram && operation?.rowId
      ? candidateProgram.rows.find(candidate => candidate.id === operation.rowId)
      : undefined;
    const cell = candidateProgram && operation?.cellId
      ? candidateProgram.cells.find(candidate => candidate.id === operation.cellId)
      : undefined;
    const authorityTable = authorityWithNodes?.nodes.tables.find(candidate => candidate.id === table?.id);
    const authorityRow = authorityWithNodes?.nodes.rows.find(candidate => candidate.id === row?.id);
    const authorityCell = authorityWithNodes?.nodes.cells.find(candidate => candidate.id === cell?.id);
    const receiver = operation?.metadata.receiver?.reference;
    return {
      operationId: operation?.id,
      operationKind: operation?.kind,
      operationStatus: operation?.status,
      tableId: operation?.tableId,
      rowId: operation?.rowId,
      cellId: operation?.cellId,
      exact: operation !== undefined
        && table !== undefined
        && row !== undefined
        && cell !== undefined
        && authorityTable !== undefined
        && authorityRow !== undefined
        && authorityCell !== undefined
        && operation.tableId === table.id
        && operation.rowId === row.id
        && operation.cellId === cell.id
        && row.tableId === table.id
        && cell.tableId === table.id
        && cell.rowId === row.id
        && sameJson(receiver, operation.metadata.semantics.cell?.reference)
        && sameJson(receiver, operation.metadata.result)
        && sameJson(receiver, cell.identity)
        && table.rowIds.filter(candidate => candidate === row.id).length === 1
        && row.cellIds.filter(candidate => candidate === cell.id).length === 1
        && table.operationIds.filter(candidate => candidate === operation.id).length === 1
        && row.operationIds.filter(candidate => candidate === operation.id).length === 1
        && cell.operationIds.filter(candidate => candidate === operation.id).length === 1
        && authorityTable.operationIds.filter(candidate => candidate === operation.id).length === 1
        && authorityRow.operationIds.filter(candidate => candidate === operation.id).length === 1
        && authorityCell.operationIds.filter(candidate => candidate === operation.id).length === 1,
      table: table ? { id: table.id, rows: table.rowIds, operations: table.operationIds } : undefined,
      row: row ? { id: row.id, tableId: row.tableId, cells: row.cellIds, operations: row.operationIds } : undefined,
      cell: cell ? { id: cell.id, tableId: cell.tableId, rowId: cell.rowId, column: cell.column, identity: cell.identity, operations: cell.operationIds } : undefined,
      authority: {
        table: authorityTable?.operationIds,
        row: authorityRow?.operationIds,
        cell: authorityCell?.operationIds,
      },
    };
  };

  const b119MenuFixture = b119Fixture([
    'local menu = { name = "B119MenuOwner", layer = 1 }',
    'function menu.display() ',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local ct = frame:addTable(runtimeColumns, { width = runtimeWidth, reserveScrollBar = false, scaling = true })',
    '  local row = ct:addRow(false, {})',
    '  if pending then',
    '    row[(slot - 1) * 4 + 1]:setColSpan(7)',
    '    row[1]:setColSpan(7)',
    '    row[5]:setColSpan(7)',
    '    row[9]:setColSpan(7)',
    '  end',
    'end',
  ].join('\n'), 'selftest/b119-menu-owner.lua');
  const b119MenuOperations = b119MenuFixture.program?.operations.filter(operation =>
    operation.kind === 'setColSpan' && ['conditional', 'looped'].includes(operation.status)) || [];
  const b119MenuStaticOperations = b119MenuOperations.filter(operation =>
    operation.metadata.receiver?.reference?.index?.status === 'static');
  const b119MenuDeferredOperations = b119MenuOperations.filter(operation =>
    operation.metadata.receiver?.reference?.index?.status !== 'static');
  check('B119 fail-first menu source-shaped setColSpan closes every sampled deferred owner',
    b119MenuFixture.fixtureReady
      && b119MenuStaticOperations.length >= 3
      && b119MenuStaticOperations.every(operation => b119OwnerClosure(
        b119MenuFixture.program,
        b119MenuFixture.authority,
        operation,
      ).exact === true)
      && b119MenuDeferredOperations.length >= 1
      && b119MenuDeferredOperations.every(operation => operation.tableId !== undefined && operation.rowId !== undefined)
      && safeSchemaPairValidation(b119MenuFixture.program!, b119MenuFixture.authority!).valid === true,
    detail({
      fixtureReady: b119MenuFixture.fixtureReady,
      unsampledStatus: b119MenuFixture.unsampled.status,
      sampledStatus: b119MenuFixture.sampled?.status,
      sampledRefusal: b119MenuFixture.sampled ? refusalCode(b119MenuFixture.sampled) : undefined,
      sampledRefusalMessage: b119MenuFixture.sampled && 'refusal' in b119MenuFixture.sampled
        ? b119MenuFixture.sampled.refusal.message
        : undefined,
      samples: b119MenuFixture.samples?.values,
      staticOperations: b119MenuStaticOperations.map(operation => b119OwnerClosure(
        b119MenuFixture.program,
        b119MenuFixture.authority,
        operation,
      )),
      deferredOperations: b119MenuDeferredOperations.map(operation => ({
        id: operation.id,
        tableId: operation.tableId,
        rowId: operation.rowId,
        cellId: operation.cellId,
        receiver: operation.metadata.receiver?.reference,
      })),
      validation: b119MenuFixture.program && b119MenuFixture.authority
        ? safeSchemaPairValidation(b119MenuFixture.program, b119MenuFixture.authority)
      : undefined,
    }));

  const b119MenuOwnerMismatchFixture = b119Fixture([
    'local menu = { name = "B119MenuOwnerMismatch", layer = 1 }',
    'function menu.display() ',
    '  local frame = Helper.createFrameHandle(menu, { width = runtimeViewWidth, height = runtimeViewHeight })',
    '  local ct = frame:addTable(runtimeColumns, { width = runtimeWidth, reserveScrollBar = runtimeReserveScrollBar, scaling = runtimeScaling })',
    '  local row = ct:addRow(false, { paddingTop = runtimePaddingTop, paddingBottom = runtimePaddingBottom })',
    '  local cell = row[1]',
    '  row = ct:addRow(false, {})',
    '  if pending then',
    '    cell:setColSpan(runtimeSpan)',
    '  end',
    '  if active then',
    '    row[1]:createButton({ x = runtimeX, y = runtimeY, width = runtimeButtonWidth, height = runtimeButtonHeight, scaling = runtimeButtonScaling, affectRowHeight = runtimeAffectRowHeight, active = runtimeActive })',
    '  end',
    'end',
  ].join('\n'),
  'selftest/b119-menu-owner-mismatch.lua',
  false,
  candidate => ({
    ...b119SamplesFor(candidate),
    values: candidate.sampleCatalog.entries.map(entry => ({
      id: entry.id,
      value: entry.expression === 'runtimeViewWidth'
        ? 1920
        : entry.expression === 'runtimeViewHeight'
          ? 1080
          : entry.expectedType === 'boolean'
            ? false
            : entry.expectedType === 'string'
              ? 'sampled'
              : entry.expression === 'runtimeColumns'
                ? 12
                : entry.expression === 'runtimeSpan'
                  ? 7
                  : entry.expression === 'runtimePaddingTop' || entry.expression === 'runtimePaddingBottom'
                    ? 0
                    : entry.expression === 'runtimeButtonHeight'
                      ? 25
                      : 80,
    })),
  }));
  const b119MenuOwnerMismatchResult = b119MenuOwnerMismatchFixture.sampled;
  const b119MenuOwnerMismatchRefusal = b119MenuOwnerMismatchResult && 'refusal' in b119MenuOwnerMismatchResult
    ? b119MenuOwnerMismatchResult.refusal
    : undefined;
  check('B119 causal menu owner/reference mismatch closes after producer repair',
    b119MenuOwnerMismatchFixture.fixtureReady
      && b119MenuOwnerMismatchFixture.samples?.values.length === 16
      && b119MenuOwnerMismatchResult?.status !== 'refused'
      && b119MenuOwnerMismatchFixture.program !== undefined
      && b119MenuOwnerMismatchFixture.authority !== undefined
      && safeSchemaPairValidation(
        b119MenuOwnerMismatchFixture.program,
        b119MenuOwnerMismatchFixture.authority,
      ).valid === true,
    detail({
      fixtureReady: b119MenuOwnerMismatchFixture.fixtureReady,
      sampleCount: b119MenuOwnerMismatchFixture.samples?.values.length,
      sampleExpressions: b119MenuOwnerMismatchFixture.unsampledProgram?.sampleCatalog.entries.map(entry => entry.expression),
      sampledStatus: b119MenuOwnerMismatchResult?.status,
      refusal: b119MenuOwnerMismatchRefusal,
      operations: b119MenuOwnerMismatchFixture.program?.operations
        .filter(operation => operation.kind === 'setColSpan' || operation.kind === 'createButton')
        .map((operation, index) => ({
          index: b119MenuOwnerMismatchFixture.program?.operations.indexOf(operation) ?? index,
          id: operation.id,
          kind: operation.kind,
          sourceLine: operation.source.start.line,
          modelOrder: operation.modelOrder,
          tableId: operation.tableId,
          rowId: operation.rowId,
          cellId: operation.cellId,
          receiver: operation.metadata.receiver?.reference,
          result: operation.metadata.result,
          semanticCell: operation.metadata.semantics.cell?.reference,
          cellIdentity: operation.cellId
            ? b119MenuOwnerMismatchFixture.program?.cells.find(cell => cell.id === operation.cellId)?.identity
            : undefined,
        })),
      programStatus: b119MenuOwnerMismatchFixture.program?.status,
      geometryCounts: b119MenuOwnerMismatchFixture.program
        ? {
          frames: b119MenuOwnerMismatchFixture.program.frames.length,
          tables: b119MenuOwnerMismatchFixture.program.tables.length,
          rows: b119MenuOwnerMismatchFixture.program.rows.length,
          cells: b119MenuOwnerMismatchFixture.program.cells.length,
          operations: b119MenuOwnerMismatchFixture.program.operations.length,
          gaps: b119MenuOwnerMismatchFixture.program.gaps.length,
        }
        : undefined,
      validation: b119MenuOwnerMismatchFixture.program && b119MenuOwnerMismatchFixture.authority
        ? safeSchemaPairValidation(
          b119MenuOwnerMismatchFixture.program,
          b119MenuOwnerMismatchFixture.authority,
        )
        : undefined,
      downstream: { canRender: 'not part of layout-program contract', firstRefusal: undefined },
      source: 'captured first-row cell:setColSpan(runtimeSpan) after row rebind, followed by second-row row[1]:createButton(...)',
    }));

  const b119ExactMenuOwnerShapeFixture = b119Fixture([
    'local menu = { name = "B119ExactMenuOwnerShape", layer = 1 }',
    'function menu.display()',
    '  local frame = Helper.createFrameHandle(menu, { width = runtimeViewWidth, height = runtimeViewHeight })',
    '  local ht = frame:addTable(3, { width = runtimeWidth, reserveScrollBar = runtimeReserveScrollBar, scaling = runtimeScaling })',
    '  local tt = frame:addTable(4, { width = runtimeWidth, reserveScrollBar = runtimeReserveScrollBar, scaling = runtimeScaling })',
    '  local row = tt:addRow(true, {})',
    '  row[1]:createText(dynamicText, {})',
    '  local ct = frame:addTable(12, { width = runtimeWidth, reserveScrollBar = runtimeReserveScrollBar, scaling = runtimeScaling })',
    '  if menu.lastOdds or menu.lastCheck then',
    '    local ck = menu.lastCheck',
    '    row = ct:addRow(false, {})',
    '    local _readSpan = ck and 6 or 12',
    '    row[1]:setColSpan(_readSpan):createText(dynamicText, {})',
    '    if ck then row[7]:setColSpan(6):createText(dynamicText, {}) end',
    '  end',
    'end',
  ].join('\n'),
  'selftest/b119-exact-menu-owner-shape.lua',
  false,
  candidate => ({
    ...b119SamplesFor(candidate),
    values: candidate.sampleCatalog.entries.map(entry => ({
      id: entry.id,
      value: entry.expression === 'runtimeViewWidth'
        ? 1920
        : entry.expression === 'runtimeViewHeight'
          ? 1080
          : entry.expectedType === 'boolean'
            ? false
            : entry.expectedType === 'string'
              ? 'sampled'
              : entry.expression === 'runtimeColumns'
                ? 12
                : entry.expression === 'runtimeWidth'
                  ? 787
                  : entry.expression === '_readSpan'
                    ? 6
                    : 80,
    })),
  }));
  const b119ExactMenuOwnerShapeResult = b119ExactMenuOwnerShapeFixture.sampled;
  check('B119 exact menu owner/source shape no longer refuses at layout owner gate',
    b119ExactMenuOwnerShapeFixture.fixtureReady
      && b119ExactMenuOwnerShapeFixture.samples?.values.length > 0
      && b119ExactMenuOwnerShapeResult?.status !== 'refused'
      && b119ExactMenuOwnerShapeFixture.program !== undefined
      && b119ExactMenuOwnerShapeFixture.authority !== undefined
      && safeSchemaPairValidation(
        b119ExactMenuOwnerShapeFixture.program,
        b119ExactMenuOwnerShapeFixture.authority,
      ).valid === true,
    detail({
      fixtureReady: b119ExactMenuOwnerShapeFixture.fixtureReady,
      sampleCount: b119ExactMenuOwnerShapeFixture.samples?.values.length,
      sampleExpressions: b119ExactMenuOwnerShapeFixture.unsampledProgram?.sampleCatalog.entries.map(entry => entry.expression),
      sampledStatus: b119ExactMenuOwnerShapeResult?.status,
      refusal: b119ExactMenuOwnerShapeResult && 'refusal' in b119ExactMenuOwnerShapeResult
        ? b119ExactMenuOwnerShapeResult.refusal
        : undefined,
      source: 'exact menu shape: prior tt row, ct conditional row rebind, then conditional _readSpan setColSpan and row[7] setColSpan',
    }));

  const b119ExactMenuMultipleRowsFixture = b119Fixture([
    'local menu = { name = "B119ExactMenuOwnerMultipleRows", layer = 1 }',
    'function menu.display()',
    '  local frame = Helper.createFrameHandle(menu, { width = runtimeViewWidth, height = runtimeViewHeight })',
    '  local ht = frame:addTable(3, { width = runtimeWidth, reserveScrollBar = runtimeReserveScrollBar, scaling = runtimeScaling })',
    '  local tt = frame:addTable(4, { width = runtimeWidth, reserveScrollBar = runtimeReserveScrollBar, scaling = runtimeScaling })',
    '  local row = tt:addRow(true, {})',
    '  row[1]:createText(dynamicText, {})',
    '  local ct = frame:addTable(12, { width = runtimeWidth, reserveScrollBar = runtimeReserveScrollBar, scaling = runtimeScaling })',
    '  if pending then',
    '    row = ct:addRow(false, {})',
    '    row[1]:setColSpan(7):createText(dynamicText, {})',
    '    row[8]:setColSpan(5):createText(dynamicText, {})',
    '  end',
    '  for _, item in ipairs(items or {}) do',
    '    row = ct:addRow(false, {})',
    '    row[1]:setColSpan(5):createText(dynamicText, {})',
    '    row[6]:setColSpan(7):createText(dynamicText, {})',
    '  end',
    '  row = ct:addRow(true, {})',
    '  row[1]:setColSpan(9):createText(dynamicText, {})',
    '  if menu.lastOdds or menu.lastCheck then',
    '    local ck = menu.lastCheck',
    '    row = ct:addRow(false, {})',
    '    local _readSpan = ck and 6 or 12',
    '    row[1]:setColSpan(_readSpan):createText(dynamicText, {})',
    '    if ck then row[7]:setColSpan(6):createText(dynamicText, {}) end',
    '  end',
    'end',
  ].join('\n'),
  'selftest/b119-exact-menu-owner-multiple-rows.lua',
  false,
  candidate => ({
    ...b119SamplesFor(candidate),
    values: candidate.sampleCatalog.entries.map(entry => ({
      id: entry.id,
      value: entry.expectedType === 'boolean'
        ? false
        : entry.expectedType === 'string'
          ? 'sampled'
          : entry.expression === 'runtimeViewWidth'
            ? 1920
            : entry.expression === 'runtimeViewHeight'
              ? 1080
              : entry.expression === 'runtimeWidth'
                ? 787
                : entry.expression === '_readSpan'
                  ? 6
                  : 80,
    })),
  }));
  const b119ExactMenuMultipleRowsResult = b119ExactMenuMultipleRowsFixture.sampled;
  const b119ExactMenuMultipleRowsRefusal = b119ExactMenuMultipleRowsResult && 'refusal' in b119ExactMenuMultipleRowsResult
    ? b119ExactMenuMultipleRowsResult.refusal
    : undefined;
  check('B119 exact multi-row menu producer owner/reference branch closes after repair',
    b119ExactMenuMultipleRowsFixture.fixtureReady
      && b119ExactMenuMultipleRowsFixture.samples?.values.length > 0
      && b119ExactMenuMultipleRowsResult?.status !== 'refused'
      && b119ExactMenuMultipleRowsFixture.program !== undefined
      && b119ExactMenuMultipleRowsFixture.authority !== undefined
      && safeSchemaPairValidation(
        b119ExactMenuMultipleRowsFixture.program,
        b119ExactMenuMultipleRowsFixture.authority,
      ).valid === true,
    detail({
      fixtureReady: b119ExactMenuMultipleRowsFixture.fixtureReady,
      sampleCount: b119ExactMenuMultipleRowsFixture.samples?.values.length,
      sampleExpressions: b119ExactMenuMultipleRowsFixture.unsampledProgram?.sampleCatalog.entries.map(entry => entry.expression),
      sampledStatus: b119ExactMenuMultipleRowsResult?.status,
      refusal: b119ExactMenuMultipleRowsRefusal,
      source: 'exact menu producer shape: tt owner, pending/loop/footer ct rows, conditional read row, then row[1]/row[7] setColSpan',
    }));

  const b119MenuOwnerMismatchOperations = b119MenuOwnerMismatchFixture.program?.operations || [];
  const b119MenuOwnerMismatchSetColSpanIndex = b119MenuOwnerMismatchOperations.findIndex(operation =>
    operation.kind === 'setColSpan');
  const b119MenuOwnerMismatchSetColSpan = b119MenuOwnerMismatchSetColSpanIndex >= 0
    ? b119MenuOwnerMismatchOperations[b119MenuOwnerMismatchSetColSpanIndex]
    : undefined;
  const b119MenuOwnerMismatchCreateButton = b119MenuOwnerMismatchOperations.find(operation =>
    operation.kind === 'createButton');
  const b119MenuOwnerMismatchTargetIdentity: ValueRecord | undefined = b119MenuOwnerMismatchCreateButton?.cellId
    ? b119MenuOwnerMismatchFixture.program?.cells.find(cell => cell.id === b119MenuOwnerMismatchCreateButton.cellId)?.identity as unknown as ValueRecord | undefined
    : undefined;
  const b119MenuOwnerMismatchMetadataControls: readonly {
    readonly field: 'receiver' | 'result' | 'semanticCell';
    readonly mutate: (metadata: ValueRecord, targetIdentity: ValueRecord) => void;
  }[] = [
    {
      field: 'receiver',
      mutate: (metadata, targetIdentity) => {
        const receiver = metadata.receiver as ValueRecord | undefined;
        if (receiver) receiver.reference = jsonClone(targetIdentity);
      },
    },
    {
      field: 'result',
      mutate: (metadata, targetIdentity) => {
        metadata.result = jsonClone(targetIdentity);
      },
    },
    {
      field: 'semanticCell',
      mutate: (metadata, targetIdentity) => {
        const semantics = metadata.semantics as ValueRecord | undefined;
        const cell = semantics?.cell as ValueRecord | undefined;
        if (cell) cell.reference = jsonClone(targetIdentity);
      },
    },
  ];
  for (const control of b119MenuOwnerMismatchMetadataControls) {
    const candidateProgram = b119MenuOwnerMismatchFixture.program
      ? jsonClone(b119MenuOwnerMismatchFixture.program) as unknown as ValueRecord
      : undefined;
    const candidateAuthority = b119MenuOwnerMismatchFixture.authority
      ? jsonClone(b119MenuOwnerMismatchFixture.authority) as unknown as ValueRecord
      : undefined;
    const operation = candidateProgram && b119MenuOwnerMismatchSetColSpanIndex >= 0
      ? (candidateProgram.operations as ValueRecord[])[b119MenuOwnerMismatchSetColSpanIndex]
      : undefined;
    const authorityOperation = candidateAuthority && b119MenuOwnerMismatchSetColSpanIndex >= 0
      ? (candidateAuthority.operations as ValueRecord[])[b119MenuOwnerMismatchSetColSpanIndex]
      : undefined;
    const metadata = operation?.metadata as ValueRecord | undefined;
    const authorityMetadata = (authorityOperation?.snapshot as ValueRecord | undefined)?.metadata as ValueRecord | undefined;
    const beforeMetadata = metadata ? jsonClone(metadata) : undefined;
    if (metadata && authorityMetadata && b119MenuOwnerMismatchTargetIdentity) {
      control.mutate(metadata, b119MenuOwnerMismatchTargetIdentity);
      control.mutate(authorityMetadata, b119MenuOwnerMismatchTargetIdentity);
    }
    const frozenProgram = candidateProgram
      ? freezeClone(candidateProgram) as unknown as X4UiLayoutProgram
      : undefined;
    const frozenAuthority = candidateAuthority
      ? freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike
      : undefined;
    const validation = frozenProgram && frozenAuthority
      ? safeSchemaPairValidation(frozenProgram, frozenAuthority)
      : { threw: false, valid: false, reason: 'causal metadata control fixture not ready' };
    check(`B119 causal ${control.field} one-field mutation is refused without throws`,
      b119MenuOwnerMismatchFixture.fixtureReady
        && b119MenuOwnerMismatchSetColSpan !== undefined
        && b119MenuOwnerMismatchTargetIdentity !== undefined
        && beforeMetadata !== undefined
        && metadata !== undefined
        && !sameJson(beforeMetadata, metadata)
        && validation.threw === false
        && validation.valid === false,
      detail({
        field: control.field,
        operationIndex: b119MenuOwnerMismatchSetColSpanIndex,
        operationId: b119MenuOwnerMismatchSetColSpan?.id,
        operationKind: b119MenuOwnerMismatchSetColSpan?.kind,
        sourceLine: b119MenuOwnerMismatchSetColSpan?.source.start.line,
        targetIdentity: b119MenuOwnerMismatchTargetIdentity,
        validation,
      }));
  }
  const b119MenuOwnerMismatchOwnerControl = b119MenuOwnerMismatchFixture.program
    && b119MenuOwnerMismatchFixture.authority
    && b119MenuOwnerMismatchSetColSpan
    && b119MenuOwnerMismatchTargetIdentity
    ? (() => {
      const candidateProgram = jsonClone(b119MenuOwnerMismatchFixture.program) as unknown as ValueRecord;
      const candidateAuthority = jsonClone(b119MenuOwnerMismatchFixture.authority) as unknown as ValueRecord;
      const mutation = phase87SetOperationOwner(
        candidateProgram,
        candidateAuthority,
        b119MenuOwnerMismatchSetColSpanIndex,
        'cellId',
        b119MenuOwnerMismatchCreateButton?.cellId,
      );
      const program = freezeClone(candidateProgram) as unknown as X4UiLayoutProgram;
      const authority = freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike;
      return { mutation, program, authority };
    })()
    : undefined;
  const b119MenuOwnerMismatchOwnerValidation = b119MenuOwnerMismatchOwnerControl
    ? safeSchemaPairValidation(b119MenuOwnerMismatchOwnerControl.program, b119MenuOwnerMismatchOwnerControl.authority)
    : { threw: false, valid: false, reason: 'causal owner control fixture not ready' };
  check('B119 causal cell-owner one-field mutation is refused without throws',
    b119MenuOwnerMismatchOwnerControl !== undefined
      && b119MenuOwnerMismatchOwnerControl.mutation.changed === true
      && b119MenuOwnerMismatchOwnerValidation.threw === false
      && b119MenuOwnerMismatchOwnerValidation.valid === false,
    detail({
      field: 'cellId',
      operationIndex: b119MenuOwnerMismatchSetColSpanIndex,
      operationId: b119MenuOwnerMismatchSetColSpan?.id,
      operationKind: b119MenuOwnerMismatchSetColSpan?.kind,
      sourceLine: b119MenuOwnerMismatchSetColSpan?.source.start.line,
      targetCellId: b119MenuOwnerMismatchCreateButton?.cellId,
      targetIdentity: b119MenuOwnerMismatchTargetIdentity,
      mutation: b119MenuOwnerMismatchOwnerControl?.mutation,
      validation: b119MenuOwnerMismatchOwnerValidation,
    }));

  const b119HubFixture = b119Fixture([
    'local menu = { name = "B119HubOwner", layer = 1 }',
    'local TABS = { "one", "two", "three" }',
    'function menu.display() ',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local st = frame:addTable(runtimeColumns, { width = runtimeWidth, reserveScrollBar = false, scaling = true })',
    '  local sr = st:addRow(false, {})',
    '  sr[1]:createButton({ active = true })',
    '  sr[2]:createButton({ active = true })',
    '  sr[3]:createButton({ active = true })',
    '  for i, tab in ipairs(TABS) do',
    '    sr[i]:createButton({ active = true })',
    '  end',
    'end',
  ].join('\n'), 'selftest/b119-hub-owner.lua');
  const b119HubOperations = b119HubFixture.program?.operations.filter(operation =>
    operation.kind === 'createButton') || [];
  const b119HubStaticOperations = b119HubOperations.filter(operation =>
    operation.metadata.receiver?.reference?.index?.status === 'static');
  const b119HubDeferredOperations = b119HubOperations.filter(operation =>
    operation.metadata.receiver?.reference?.index?.status !== 'static');
  check('B119 fail-first hub source-shaped createButton closes every sampled deferred owner',
    b119HubFixture.fixtureReady
      && b119HubStaticOperations.length >= 3
      && b119HubStaticOperations.every(operation => b119OwnerClosure(
        b119HubFixture.program,
        b119HubFixture.authority,
        operation,
      ).exact === true)
      && b119HubDeferredOperations.length >= 1
      && b119HubDeferredOperations.every(operation => operation.tableId !== undefined && operation.rowId !== undefined)
      && safeSchemaPairValidation(b119HubFixture.program!, b119HubFixture.authority!).valid === true,
    detail({
      fixtureReady: b119HubFixture.fixtureReady,
      unsampledStatus: b119HubFixture.unsampled.status,
      sampledStatus: b119HubFixture.sampled?.status,
      sampledRefusal: b119HubFixture.sampled ? refusalCode(b119HubFixture.sampled) : undefined,
      sampledRefusalMessage: b119HubFixture.sampled && 'refusal' in b119HubFixture.sampled
        ? b119HubFixture.sampled.refusal.message
        : undefined,
      samples: b119HubFixture.samples?.values,
      staticOperations: b119HubStaticOperations.map(operation => b119OwnerClosure(
        b119HubFixture.program,
        b119HubFixture.authority,
        operation,
      )),
      deferredOperations: b119HubDeferredOperations.map(operation => ({
        id: operation.id,
        tableId: operation.tableId,
        rowId: operation.rowId,
        cellId: operation.cellId,
        receiver: operation.metadata.receiver?.reference,
      })),
      validation: b119HubFixture.program && b119HubFixture.authority
        ? safeSchemaPairValidation(b119HubFixture.program, b119HubFixture.authority)
        : undefined,
    }));

  const b119ReserveFixture = b119Fixture([
    'local menu = { name = "B119ReserveFinal", layer = 1 }',
    'function menu.display() ',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local tt = frame:addTable(3, { width = 80, reserveScrollBar = true, scaling = true })',
    '  tt:setColWidthPercent(1, 33)',
    '  tt:setColWidthPercent(2, 33)',
    '  tt:setColWidthPercent(3, 34)',
    '  tt:addRow(false, {})',
    'end',
  ].join('\n'), 'selftest/b119-reserve-final.lua');
  const b119ReserveTable = b119ReserveFixture.program?.tables[0];
  const b119ReserveFact = b119ReserveTable?.descriptorFacts.reserveScrollBar;
  check('B119 fail-first reserveScrollBar consumes the final Helper/kernel state',
    b119ReserveFixture.fixtureReady
      && b119ReserveTable !== undefined
      && b119ReserveTable.kernelState?.properties.reserveScrollBar === false
      && b119ReserveFact?.status === 'known'
      && b119ReserveFact.value === false
      && safeSchemaPairValidation(b119ReserveFixture.program!, b119ReserveFixture.authority!).valid === true,
    detail({
      fixtureReady: b119ReserveFixture.fixtureReady,
      status: b119ReserveFixture.sampled?.status,
      kernelReserveScrollBar: b119ReserveTable?.kernelState?.properties.reserveScrollBar,
      descriptorFact: b119ReserveFact,
      validation: b119ReserveFixture.program && b119ReserveFixture.authority
        ? safeSchemaPairValidation(b119ReserveFixture.program, b119ReserveFixture.authority)
      : undefined,
    }));

  const b119CrossCellProgram = b119MenuFixture.program;
  const b119CrossCellAuthority = b119MenuFixture.authority;
  const b119CrossCellOperationIndex = b119CrossCellProgram?.operations.findIndex(operation =>
    operation.kind === 'setColSpan' && operation.rowId !== undefined) ?? -1;
  const b119CrossCellOperation = b119CrossCellOperationIndex >= 0
    ? b119CrossCellProgram?.operations[b119CrossCellOperationIndex]
    : undefined;
  const b119CrossCellTarget = b119CrossCellProgram && b119CrossCellOperation?.rowId
    ? b119CrossCellProgram.cells.find(cell =>
      cell.rowId === b119CrossCellOperation.rowId
        && cell.identity === undefined
        && cell.id !== b119CrossCellOperation.cellId)
    : undefined;
  const b119CrossCellPair = b119CrossCellProgram && b119CrossCellAuthority
    && b119CrossCellOperationIndex >= 0
    && b119CrossCellTarget
    ? (() => {
      const candidateProgram = jsonClone(b119CrossCellProgram) as unknown as ValueRecord;
      const candidateAuthority = jsonClone(b119CrossCellAuthority) as unknown as ValueRecord;
      const mutation = phase87SetOperationOwner(
        candidateProgram,
        candidateAuthority,
        b119CrossCellOperationIndex,
        'cellId',
        b119CrossCellTarget.id,
      );
      return {
        mutation,
        program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
        authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      };
    })()
    : undefined;
  const b119CrossCellValidation = b119CrossCellPair
    ? safeSchemaPairValidation(b119CrossCellPair.program, b119CrossCellPair.authority)
    : { threw: false, valid: false, reason: 'cross-cell fixture not ready' };
  check('B119 fail-first hostile cross-cell substitution is refused without throws',
    b119CrossCellPair !== undefined
      && b119CrossCellPair.mutation.changed === true
      && b119CrossCellValidation.threw === false
      && b119CrossCellValidation.valid === false,
    detail({
      fixtureReady: b119CrossCellPair !== undefined,
      sourceOperation: b119CrossCellOperation,
      targetCell: b119CrossCellTarget,
      mutation: b119CrossCellPair?.mutation,
      validation: b119CrossCellValidation,
    }));

  const b119ForgedChainFixture = b119Fixture([
    'local menu = { name = "B119ForgedChain", layer = 1 }',
    'function menu.display() ',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local earlier = frame:addTable(2, { width = 40, reserveScrollBar = false })',
    '  earlier:addRow(false, {})',
    '  local ct = frame:addTable(runtimeColumns, { width = runtimeWidth, reserveScrollBar = false, scaling = true })',
    '  local row = ct:addRow(false, {})',
    '  if pending then',
    '    row[(slot - 1) * 4 + 1]:setColSpan(7)',
    '  end',
    'end',
  ].join('\n'), 'selftest/b119-forged-chain.lua');
  const b119ForgedChainOperationIndex = b119ForgedChainFixture.program?.operations.findIndex(operation =>
    operation.kind === 'setColSpan' && operation.tableId !== undefined && operation.rowId !== undefined) ?? -1;
  const b119ForgedChainOperation = b119ForgedChainOperationIndex >= 0
    ? b119ForgedChainFixture.program?.operations[b119ForgedChainOperationIndex]
    : undefined;
  const b119ForgedChainTarget = b119ForgedChainFixture.program && b119ForgedChainOperation
    ? b119ForgedChainFixture.program.tables
      .filter(table => table.id !== b119ForgedChainOperation.tableId && table.rowIds.length > 0)
      .map(table => ({
        table,
        row: b119ForgedChainFixture.program!.rows.find(row => row.id === table.rowIds[0]),
      }))
      .map(candidate => ({
        ...candidate,
        cell: candidate.row
          ? b119ForgedChainFixture.program!.cells.find(cell => cell.rowId === candidate.row!.id && cell.identity === undefined)
          : undefined,
      }))
      .find(candidate => candidate.row !== undefined && candidate.cell !== undefined)
    : undefined;
  const b119ForgedChainPair = b119ForgedChainFixture.program && b119ForgedChainFixture.authority
    && b119ForgedChainOperationIndex >= 0
    && b119ForgedChainTarget?.row
    && b119ForgedChainTarget.cell
    ? (() => {
      const candidateProgram = jsonClone(b119ForgedChainFixture.program) as unknown as ValueRecord;
      const candidateAuthority = jsonClone(b119ForgedChainFixture.authority) as unknown as ValueRecord;
      const tableMutation = phase87SetOperationOwner(
        candidateProgram,
        candidateAuthority,
        b119ForgedChainOperationIndex,
        'tableId',
        b119ForgedChainTarget.table.id,
      );
      const rowMutation = phase87SetOperationOwner(
        candidateProgram,
        candidateAuthority,
        b119ForgedChainOperationIndex,
        'rowId',
        b119ForgedChainTarget.row!.id,
      );
      const cellMutation = phase87SetOperationOwner(
        candidateProgram,
        candidateAuthority,
        b119ForgedChainOperationIndex,
        'cellId',
        b119ForgedChainTarget.cell!.id,
      );
      return {
        mutation: { tableMutation, rowMutation, cellMutation },
        program: freezeClone(candidateProgram) as unknown as X4UiLayoutProgram,
        authority: freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike,
      };
    })()
    : undefined;
  const b119ForgedChainValidation = b119ForgedChainPair
    ? safeSchemaPairValidation(b119ForgedChainPair.program, b119ForgedChainPair.authority)
    : { threw: false, valid: false, reason: 'forged-chain fixture not ready' };
  check('B119 fail-first hostile forged earlier sibling chain is refused without throws',
    b119ForgedChainPair !== undefined
      && b119ForgedChainValidation.threw === false
      && b119ForgedChainValidation.valid === false,
    detail({
      fixtureReady: b119ForgedChainPair !== undefined,
      sourceOperation: b119ForgedChainOperation,
      target: b119ForgedChainTarget,
      mutation: b119ForgedChainPair?.mutation,
      validation: b119ForgedChainValidation,
    }));

  const b119LedgerReorderCases = (['tables', 'rows', 'cells'] as const).map(collection => {
    const sourceNodes = allKindProgram[collection];
    const nodeIndex = sourceNodes.findIndex(node => node.operationIds.length >= 2);
    if (!allKindAuthority || nodeIndex < 0) {
      return { collection, fixtureReady: false, validation: { threw: false, valid: false, reason: 'ordered-ledger fixture not ready' } };
    }
    const candidateProgram = jsonClone(allKindProgram) as unknown as ValueRecord;
    const candidateAuthority = jsonClone(allKindAuthority) as unknown as ValueRecord;
    const programNode = (candidateProgram[collection] as ValueRecord[])[nodeIndex];
    const authorityNodes = ((candidateAuthority.nodes as ValueRecord)[collection] as ValueRecord[]);
    const authorityNode = authorityNodes[nodeIndex];
    const reverse = (node: ValueRecord | undefined): void => {
      if (node && Array.isArray(node.operationIds)) node.operationIds = [...node.operationIds].reverse();
    };
    reverse(programNode);
    reverse(authorityNode);
    reverse(authorityNode?.snapshot as ValueRecord | undefined);
    const program = freezeClone(candidateProgram) as unknown as X4UiLayoutProgram;
    const authority = freezeClone(candidateAuthority) as unknown as EvidenceAuthorityLike;
    return {
      collection,
      fixtureReady: true,
      nodeId: programNode.id,
      original: sourceNodes[nodeIndex].operationIds,
      mutated: programNode.operationIds,
      validation: safeSchemaPairValidation(program, authority),
    };
  });
  for (const attack of b119LedgerReorderCases) {
    check(`B119 fail-first hostile reordered ${attack.collection} ledger is refused without throws`,
      attack.fixtureReady
        && attack.validation.threw === false
        && attack.validation.valid === false,
      detail(attack));
  }

  const passed = checks.filter(candidate => candidate.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
};

const runP3ColorChecks = async (): Promise<Check[]> => {
  const p3Checks: Check[] = [];
  const p3Check = (name: string, pass: boolean, detailValue?: unknown): void => {
    p3Checks.push({ name: `P3 color ${name}`, pass, detail: detailValue === undefined ? undefined : detail(detailValue) });
  };
  let authority: X4UiCorpusCanonicalColorSuccess;
  try {
    authority = await p3LoadCanonicalColorAuthority();
  } catch (error) {
    p3Check('in-memory transport produces genuine loader-issued P2 authority', false, String(error));
    return p3Checks;
  }
  p3Check(
    'in-memory transport produces genuine loader-issued P2 authority',
    isX4UiCorpusCanonicalColorSuccess(authority)
      && authority.graph.baseColors.length === 224
      && authority.graph.mappings.length === 804,
    {
      guard: isX4UiCorpusCanonicalColorSuccess(authority),
      baseColors: authority.graph.baseColors.length,
      mappings: authority.graph.mappings.length,
    },
  );

  const colorSource = [
    'local menu = { name = "P3", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(9, { width = 100 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("literal", { color = { r = 12.5, g = 23.5, b = 34.5, a = 45.5, glow = 0.25 }, cellBGColor = Color["row_background"] })',
    'row[2]:createButton({ bgColor = Color["button_background_default"], highlightColor = Color["button_highlight_default"], borderColor = Color["button_border_default"] }):setText("button", { color = Color["text_normal"] }):setText2("button2", { color = { r = 15, g = 25, b = 35, a = 55 } })',
    'row[3]:createEditBox({ bgColor = Color["editbox_background_default"] })',
    'row[4]:createIcon("icon", { color = Color["white"] })',
    'row[5]:createText("default", {})',
    'row[6]:createButton({}):setText("nestedDefault", {})',
    'row[7]:createEditBox({})',
    'row[8]:createIcon("defaultIcon", {})',
    'row[9]:createButton({}):setText2("nestedDefault2", {})',
    'local explicitTable = frame:addTable(1, { width = 20, backgroundColor = Color["table_background_default"] })',
    'explicitTable:addRow(false, {})',
  ].join('\n');
  const model = buildX4UiCallModel(input(colorSource, 'selftest/p3-colors.lua'));
  const target = topTarget(model);
  const profile = profileFor(model);
  const projectWithColorEvidence = projectX4UiLayoutProgram as unknown as (
    modelValue: X4UiCallModel,
    targetValue: X4UiLayoutTarget,
    profileValue: X4UiLayoutProjectionProfile,
    previewSampleValue?: X4UiLayoutPreviewSampleInput,
    previewPathValue?: X4UiLayoutPreviewPathSelectionInput,
    colorEvidenceValue?: unknown,
  ) => ReturnType<typeof projectX4UiLayoutProgram>;
  const legacy = projectX4UiLayoutProgram(model, target, profile);
  const omitted = projectWithColorEvidence(model, target, profile, undefined, undefined, undefined);
  const supplied = projectWithColorEvidence(model, target, profile, undefined, undefined, authority);
  const program = resultProgram(supplied);
  const evidenceAuthority = evidenceAuthorityOf(supplied);
  const operationFor = (callName: string, sourceNeedle: string) => program?.operations.find(operationValue =>
    operationValue.kind === callName
      && colorSource.slice(operationValue.source.start.offset, operationValue.source.end.offset).includes(sourceNeedle));
  const factFor = (callName: string, sourceNeedle: string, field: string): unknown =>
    operationFor(callName, sourceNeedle)?.descriptorFacts[field];
  const knownColor = (candidate: unknown): candidate is {
    readonly status: 'known';
    readonly expectedType: 'color-object';
    readonly value: Record<string, unknown>;
    readonly provenance: string;
    readonly sourcePin?: Record<string, unknown>;
  } => {
    const record = candidate as Record<string, unknown> | undefined;
    return Boolean(record)
      && record.status === 'known'
      && record.expectedType === 'color-object'
      && typeof record.value === 'object'
      && record.value !== null
      && typeof record.provenance === 'string';
  };
  const unavailableColor = (candidate: unknown): candidate is { readonly status: 'unavailable'; readonly reason: string } => {
    const record = candidate as Record<string, unknown> | undefined;
    return Boolean(record) && record.status === 'unavailable' && typeof record.reason === 'string';
  };

  p3Check(
    'omitted evidence preserves the exact old serialized result',
    JSON.stringify(legacy) === JSON.stringify(omitted)
      && JSON.stringify(legacy) === JSON.stringify(projectX4UiLayoutProgram(model, target, profile)),
    { legacyStatus: legacy.status, omittedStatus: omitted.status },
  );
  const literalFact = factFor('createText', 'createText("literal"', 'color') as Record<string, unknown> | undefined;
  const literalValue = literalFact?.value as Record<string, unknown> | undefined;
  p3Check(
    'source literal resolves as a typed raw-channel fact with percent alpha',
    Boolean(program)
      && knownColor(literalFact)
      && literalValue?.r === 12.5
      && literalValue.g === 23.5
      && literalValue.a === 45.5
      && literalValue.glow === 0.25
      && literalValue.domain === 'source-literal-percent-alpha'
      && literalValue.gameVerification === X4_UI_LAYOUT_GAME_TRUTH,
    literalFact,
  );
  const symbolicTextFact = factFor('setText', 'setText("button"', 'color') as Record<string, unknown> | undefined;
  const symbolicTextValue = symbolicTextFact?.value as Record<string, unknown> | undefined;
  p3Check(
    'one-hop mapping resolves with requested/base IDs, document indexes, identities, and canonical provenance',
    knownColor(symbolicTextFact)
      && symbolicTextFact.provenance === 'canonical-default-only'
      && symbolicTextValue?.requestedId === 'text_normal'
      && symbolicTextValue.resolvedBaseId === 'white_weak_glow'
      && (symbolicTextValue.baseSource as Record<string, unknown> | undefined)?.index === 2
      && (symbolicTextValue.mappingSource as Record<string, unknown> | undefined)?.index === 2
      && (symbolicTextValue.sourceIdentities as Record<string, unknown> | undefined)?.xml !== undefined
      && ((symbolicTextValue.sourceIdentities as Record<string, unknown>).xml as Record<string, unknown>).sha256 === X4_UI_CORPUS_COLORS_XML_SHA256
      && ((symbolicTextValue.sourceIdentities as Record<string, unknown>).xsd as Record<string, unknown>).sha256 === X4_UI_CORPUS_COLORS_XSD_SHA256
      && symbolicTextValue.domain === 'canonical-xml-byte-alpha'
      && symbolicTextValue.canonicalIdentity === 'x4-9.00'
      && symbolicTextValue.a === 104
      && symbolicTextValue.glow === 0.3
      && symbolicTextValue.gameVerification === X4_UI_LAYOUT_GAME_TRUTH,
    symbolicTextFact,
  );
  const baseIconFact = factFor('createIcon', 'createIcon("icon"', 'color') as Record<string, unknown> | undefined;
  const baseIconValue = baseIconFact?.value as Record<string, unknown> | undefined;
  p3Check(
    'base ID resolution preserves base-versus-mapping distinction',
    knownColor(baseIconFact)
      && baseIconValue?.requestedId === 'white'
      && baseIconValue.resolvedBaseId === 'white'
      && baseIconValue.mappingSource === undefined
      && (baseIconValue.baseSource as Record<string, unknown> | undefined)?.id === 'white',
    baseIconFact,
  );
  const tableDefaultFact = (
    program?.tables.find(tableValue =>
      colorSource.slice(tableValue.source.start.offset, tableValue.source.end.offset).includes('addTable(9'),
    )?.descriptorFacts.backgroundColor
    || factFor('addTable', 'addTable(9', 'backgroundColor')
  ) as Record<string, unknown> | undefined;
  const explicitTableFact = factFor('addTable', 'addTable(1', 'backgroundColor') as Record<string, unknown> | undefined;
  p3Check(
    'table explicit and Helper default color pins resolve without changing non-color gaps',
    knownColor(tableDefaultFact)
      && knownColor(explicitTableFact)
      && (tableDefaultFact.value as Record<string, unknown>).requestedId === 'table_background_default'
      && (explicitTableFact.value as Record<string, unknown>).requestedId === 'table_background_default'
      && (tableDefaultFact.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3175
      && (explicitTableFact.sourcePin === undefined || (explicitTableFact.sourcePin as Record<string, unknown>).lineStart !== undefined)
      && !program?.gaps.some(gap => gap.expression === 'Color["table_background_default"]'),
    { tableDefaultFact, explicitTableFact, gaps: program?.gaps },
  );
  const defaultColorFacts = [
    factFor('createText', 'createText("default"', 'color'),
    factFor('createText', 'createText("default"', 'cellbgcolor'),
    factFor('createButton', 'createButton({})', 'bgcolor'),
    factFor('createButton', 'createButton({})', 'highlightcolor'),
    factFor('createButton', 'createButton({})', 'bordercolor'),
    factFor('createEditBox', 'createEditBox({})', 'bgcolor'),
    factFor('createIcon', 'createIcon("defaultIcon"', 'color'),
  ];
  p3Check(
    'exact Helper cell/text/icon/button/editbox default color pins are typed and source-pinned',
    defaultColorFacts.every(candidate => knownColor(candidate))
      && defaultColorFacts.every(candidate => candidate && (candidate as Record<string, unknown>).provenance === 'canonical-default-only')
      && (defaultColorFacts[0] as Record<string, unknown> | undefined)?.value !== undefined
      && ((defaultColorFacts[0] as Record<string, unknown> | undefined)?.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3207
      && ((defaultColorFacts[1] as Record<string, unknown> | undefined)?.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3200
      && ((defaultColorFacts[2] as Record<string, unknown> | undefined)?.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3227
      && ((defaultColorFacts[3] as Record<string, unknown> | undefined)?.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3228
      && ((defaultColorFacts[4] as Record<string, unknown> | undefined)?.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3229
      && ((defaultColorFacts[5] as Record<string, unknown> | undefined)?.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3235
      && ((defaultColorFacts[6] as Record<string, unknown> | undefined)?.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3220,
    defaultColorFacts,
  );
  const buttonTopLevelColor = factFor('createButton', 'createButton({})', 'color');
  const editBoxTopLevelColor = factFor('createEditBox', 'createEditBox({})', 'color');
  p3Check(
    'button and editbox do not synthesize a top-level color default',
    buttonTopLevelColor === undefined && editBoxTopLevelColor === undefined,
    { buttonTopLevelColor, editBoxTopLevelColor },
  );
  const nestedDefaultTextFact = factFor('setText', 'setText("nestedDefault"', 'color') as Record<string, unknown> | undefined;
  const nestedDefaultText2Fact = factFor('setText2', 'setText2("nestedDefault2"', 'color') as Record<string, unknown> | undefined;
  p3Check(
    'nested setText and setText2 defaults use text_normal at the distinct 3422 pin',
    knownColor(nestedDefaultTextFact)
      && knownColor(nestedDefaultText2Fact)
      && (nestedDefaultTextFact.value as Record<string, unknown>).requestedId === 'text_normal'
      && (nestedDefaultText2Fact.value as Record<string, unknown>).requestedId === 'text_normal'
      && (nestedDefaultTextFact.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3422
      && (nestedDefaultText2Fact.sourcePin as Record<string, unknown> | undefined)?.lineStart === 3422,
    { nestedDefaultTextFact, nestedDefaultText2Fact },
  );
  p3Check(
    'nested setText and setText2 color facts are independently source-bound',
    knownColor(factFor('setText', 'setText("button"', 'color'))
      && knownColor(factFor('setText2', 'setText2("button2"', 'color'))
      && program?.operations.filter(operationValue => operationValue.kind === 'setText' || operationValue.kind === 'setText2')
        .every(operationValue => operationValue.descriptorFacts.color?.status === 'known'),
    program?.operations.filter(operationValue => operationValue.kind === 'setText' || operationValue.kind === 'setText2'),
  );
  p3Check(
    'known tint removes only its color gap while unrelated geometry/state gaps remain',
    program !== undefined
      && !program.gaps.some(gap => gap.expression?.includes('Color['))
      && program.verification.game === X4_UI_LAYOUT_GAME_TRUTH
      && program.verification.gameVerified === false,
    program?.gaps,
  );
  p3Check(
    'program and evidence authority retain reciprocal color snapshots and validate',
    program !== undefined
      && evidenceAuthority !== undefined
      && validateX4UiLayoutEvidencePair(program, evidenceAuthority).valid
      && evidenceAuthority.operations.every(authorityOperation => {
        const operationValue = program.operations.find(candidate => candidate.id === authorityOperation.id);
        return operationValue !== undefined
          && JSON.stringify(authorityOperation.snapshot.descriptorFacts) === JSON.stringify(operationValue.descriptorFacts);
      })
      && evidenceAuthority.nodes.cells.every(node => {
        const programCell = program.cells.find(candidate => candidate.id === node.id);
        return programCell !== undefined && JSON.stringify(node.snapshot.descriptorFacts) === JSON.stringify(programCell.descriptorFacts);
      }),
    { validation: program && evidenceAuthority && validateX4UiLayoutEvidencePair(program, evidenceAuthority) },
  );
  const knownProgramFact = factFor('createText', 'createText("literal"', 'color') as Record<string, unknown> | undefined;
  const knownProgramValue = knownProgramFact?.value as Record<string, unknown> | undefined;
  const knownProgramValuePrototype = knownProgramValue ? Object.getPrototypeOf(knownProgramValue) : undefined;
  const programClone = program ? jsonClone(program) : undefined;
  const authorityClone = evidenceAuthority ? jsonClone(evidenceAuthority) : undefined;
  const issuedPair = program && evidenceAuthority ? issuedPairForModel(program, evidenceAuthority, model) : { available: false, threw: false, value: false };
  const clonedIssuedPair = programClone && authorityClone
    ? issuedPairForModel(programClone, authorityClone, model)
    : { available: false, threw: false, value: false };
  p3Check(
    'known-color output is frozen, plain, enumerable, JSON-closed, and clone issuance-resistant',
    issuedPair.available
      && issuedPair.value
      && knownProgramValuePrototype === Object.prototype
      && knownProgramFact !== undefined
      && Object.isFrozen(knownProgramFact)
      && knownProgramValue !== undefined
      && Object.isFrozen(knownProgramValue)
      && JSON.stringify(JSON.parse(JSON.stringify(knownProgramFact))) === JSON.stringify(knownProgramFact)
      && clonedIssuedPair.available
      && !clonedIssuedPair.value,
    { issuedPair, clonedIssuedPair, fact: knownProgramFact },
  );
  const mutatedProgram = program ? jsonClone(program) as unknown as Record<string, unknown> : undefined;
  if (mutatedProgram) {
    const operations = mutatedProgram.operations as Record<string, unknown>[];
    const colorOperation = operations.find(operationValue => (operationValue.descriptorFacts as Record<string, unknown> | undefined)?.color !== undefined);
    const descriptorFacts = colorOperation?.descriptorFacts as Record<string, unknown> | undefined;
    const colorFact = descriptorFacts?.color as Record<string, unknown> | undefined;
    const colorValue = colorFact?.value as Record<string, unknown> | undefined;
    if (colorValue && typeof colorValue.r === 'number') colorValue.r += 1;
  }
  const driftValidation = mutatedProgram && evidenceAuthority
    ? validateX4UiLayoutEvidencePair(mutatedProgram as unknown as X4UiLayoutProgram, evidenceAuthority)
    : { valid: false as const, reason: 'fixture missing' };
  p3Check('evidence/program pair validation rejects descriptor drift', driftValidation.valid === false, driftValidation);

  const hostileInputs: Array<{ readonly name: string; readonly value: unknown; readonly traps?: () => number }> = [];
  hostileInputs.push({ name: 'structural clone', value: jsonClone(authority) });
  const wrongPrototype = jsonClone(authority) as unknown as Record<string, unknown>;
  Object.setPrototypeOf(wrongPrototype, { forged: true });
  hostileInputs.push({ name: 'wrong prototype', value: wrongPrototype });
  const cyclic = jsonClone(authority) as unknown as Record<string, unknown>;
  cyclic.cycle = cyclic;
  hostileInputs.push({ name: 'cycle', value: cyclic });
  const nonEnumerable = jsonClone(authority) as unknown as Record<string, unknown>;
  Object.defineProperty(nonEnumerable, 'hidden', { configurable: true, enumerable: false, value: true });
  hostileInputs.push({ name: 'non-enumerable', value: nonEnumerable });
  let accessorReads = 0;
  const accessor = jsonClone(authority) as unknown as Record<string, unknown>;
  Object.defineProperty(accessor, 'graph', {
    configurable: true,
    enumerable: true,
    get: () => {
      accessorReads += 1;
      throw new Error('hostile P2 accessor');
    },
  });
  hostileInputs.push({ name: 'throwing accessor', value: accessor });
  let proxyTraps = 0;
  const proxy = new Proxy(jsonClone(authority), {
    get: () => {
      proxyTraps += 1;
      throw new Error('hostile P2 proxy');
    },
    getPrototypeOf: () => {
      proxyTraps += 1;
      throw new Error('hostile P2 prototype trap');
    },
  });
  hostileInputs.push({ name: 'proxy', value: proxy });
  const hostileResults = hostileInputs.map(candidate => ({
    name: candidate.name,
    result: projectWithColorEvidence(model, target, profile, undefined, undefined, candidate.value),
  }));
  p3Check(
    'structural, prototype, cycle, accessor, and proxy color evidence fail closed with typed refusal without safe-admission getters',
    hostileResults.every(candidate => candidate.result.status === 'refused'
      && 'refusal' in candidate.result
      && candidate.result.refusal.code === 'malformed-color-evidence')
      && accessorReads === 0
      && proxyTraps === 0,
    { hostileResults: hostileResults.map(candidate => ({ name: candidate.name, status: candidate.result.status, refusal: 'refusal' in candidate.result ? candidate.result.refusal : undefined })), accessorReads, proxyTraps },
  );
  const hostileModel = jsonClone(model) as unknown as Record<string, unknown>;
  let modelColorExpressionReads = 0;
  Object.defineProperty(hostileModel, 'colorExpressions', {
    configurable: true,
    enumerable: true,
    get: () => {
      modelColorExpressionReads += 1;
      throw new Error('hostile model colorExpressions accessor');
    },
  });
  let hostileModelResult: ReturnType<typeof projectX4UiLayoutProgram> | undefined;
  let hostileModelThrew = false;
  try {
    hostileModelResult = projectWithColorEvidence(
      hostileModel as unknown as X4UiCallModel,
      target,
      profile,
      undefined,
      undefined,
      authority,
    );
  } catch {
    hostileModelThrew = true;
  }
  p3Check(
    'throwing model.colorExpressions accessors receive typed refusal without getter execution',
    hostileModelThrew === false
      && hostileModelResult?.status === 'refused'
      && 'refusal' in hostileModelResult
      && hostileModelResult.refusal.code === 'malformed-model'
      && modelColorExpressionReads === 0,
    { hostileModelThrew, hostileModelResult, modelColorExpressionReads },
  );
  let mutationThrew = false;
  try {
    (authority.graph.baseColors[0] as unknown as { r: number }).r = 255;
  } catch {
    mutationThrew = true;
  }
  const afterAuthorityMutation = projectWithColorEvidence(model, target, profile, undefined, undefined, authority);
  const afterMutationProgram = resultProgram(afterAuthorityMutation);
  const afterMutationFact = afterMutationProgram?.operations.find(operationValue =>
    operationValue.kind === 'createText'
      && colorSource.slice(operationValue.source.start.offset, operationValue.source.end.offset).includes('createText("literal"'),
  )?.descriptorFacts.color;
  p3Check(
    'post-issue mutation attempts cannot alter the loader-issued authority or projected channels',
    mutationThrew
      && isX4UiCorpusCanonicalColorSuccess(authority)
      && afterAuthorityMutation.status !== 'refused'
      && knownColor(afterMutationFact)
      && ((afterMutationFact.value as Record<string, unknown>).r === 12.5),
    { mutationThrew, authorityGuard: isX4UiCorpusCanonicalColorSuccess(authority), afterAuthorityMutation: afterAuthorityMutation.status, afterMutationFact },
  );

  const modelColorRecord = model.colorExpressions.find(candidate => candidate.callName === 'createText'
    && candidate.propertyName === 'color'
    && colorSource.slice(candidate.callSource.start.offset, candidate.callSource.end.offset).includes('createText("literal"'));
  const invokeModel = (candidate: X4UiCallModel): ReturnType<typeof projectX4UiLayoutProgram> =>
    projectWithColorEvidence(candidate, topTarget(candidate), profileFor(candidate), undefined, undefined, authority);
  const modelAttack = (name: string, mutate: (candidate: Record<string, unknown>) => void) => {
    const candidate = jsonClone(model) as unknown as Record<string, unknown>;
    mutate(candidate);
    freezeCycleClone(candidate);
    const result = invokeModel(candidate as unknown as X4UiCallModel);
    const fact = resultProgram(result)?.operations
      .find(operationValue => operationValue.kind === 'createText'
        && colorSource.slice(operationValue.source.start.offset, operationValue.source.end.offset).includes('createText("literal"'))
      ?.descriptorFacts.color;
    return { name, result, fact };
  };
  const duplicateModelRecord = modelColorRecord
    ? modelAttack('duplicate color expression', candidate => {
      const expressions = candidate.colorExpressions as unknown[];
      expressions.push(jsonClone(modelColorRecord));
    })
    : undefined;
  const missingModelRecord = modelColorRecord
    ? modelAttack('missing color expression', candidate => {
      const expressions = candidate.colorExpressions as Record<string, unknown>[];
      const index = expressions.findIndex(value => value.callName === 'createText'
        && value.propertyName === 'color'
        && (() => {
          const callSource = value.callSource as Record<string, unknown>;
          const start = callSource.start as Record<string, unknown>;
          const end = callSource.end as Record<string, unknown>;
          return colorSource.slice(
            start.offset as number,
            end.offset as number,
          ).includes('createText("literal"');
        })());
      if (index >= 0) expressions.splice(index, 1);
    })
    : undefined;
  const driftedModelRecord = modelColorRecord
    ? modelAttack('source/property/range drift', candidate => {
      const expressions = candidate.colorExpressions as Record<string, unknown>[];
      const index = expressions.findIndex(value => value.propertyName === 'color');
      if (index >= 0) {
        expressions[index] = {
          ...expressions[index],
          propertyName: 'cellBGColor',
          source: {
            ...(expressions[index].source as Record<string, unknown>),
            start: { ...((expressions[index].source as Record<string, unknown>).start as Record<string, unknown>), offset: 0 },
          },
        };
      }
    })
    : undefined;
  const modelAttackResults = [duplicateModelRecord, missingModelRecord, driftedModelRecord].filter(
    (candidate): candidate is NonNullable<typeof duplicateModelRecord> => candidate !== undefined,
  );
  p3Check(
    'duplicate, missing, and source/property/range-drifted P1 color records never become first-match authority',
    modelAttackResults.length === 3
      && modelAttackResults.every(candidate => unavailableColor(candidate.fact)
        && candidate.fact.reason.includes('P1 color expression')),
    modelAttackResults,
  );

  const sameExpressionWidthModel = jsonClone(model) as unknown as Record<string, unknown>;
  if (modelColorRecord) {
    const verificationGaps = sameExpressionWidthModel.verificationGaps as unknown[];
    verificationGaps.push({
      category: 'width',
      status: 'unknown',
      reason: 'auditor width gap intentionally shares the color expression provenance',
      expression: modelColorRecord.colorExpression.expression,
      source: jsonClone(modelColorRecord.colorExpression.source),
    });
  }
  freezeCycleClone(sameExpressionWidthModel);
  const sameExpressionWidthResult = modelColorRecord
    ? invokeModel(sameExpressionWidthModel as unknown as X4UiCallModel)
    : undefined;
  const sameExpressionWidthProgram = resultProgram(sameExpressionWidthResult);
  const sameExpressionWidthGaps = sameExpressionWidthProgram?.gaps.filter(gap =>
    gap.expression === modelColorRecord?.colorExpression.expression
      && locationsSameForTest(gap.source, modelColorRecord?.colorExpression.source),
  ) || [];
  p3Check(
    'same-source width gaps survive while only the exact color verification gap is suppressed',
    sameExpressionWidthProgram !== undefined
      && sameExpressionWidthGaps.some(gap => gap.category === 'width')
      && !sameExpressionWidthGaps.some(gap => gap.category !== 'width'),
    { sameExpressionWidthResult, sameExpressionWidthGaps },
  );

  type ColorFactMutator = (fact: Record<string, unknown>, value: Record<string, unknown>) => void;
  const mutateEveryColorFact = (root: unknown, mutate: ColorFactMutator): void => {
    const seen = new Set<object>();
    const visit = (candidate: unknown): void => {
      if (!candidate || typeof candidate !== 'object') return;
      const objectValue = candidate as object;
      if (seen.has(objectValue)) return;
      seen.add(objectValue);
      const record = candidate as Record<string, unknown>;
      if (record.expectedType === 'color-object' && record.value && typeof record.value === 'object' && !Array.isArray(record.value)) {
        mutate(record, record.value as Record<string, unknown>);
      }
      for (const child of Object.values(record)) visit(child);
    };
    visit(root);
  };
  const semanticColorPair = (mutate: ColorFactMutator) => {
    if (!program || !evidenceAuthority) return { valid: false as const, reason: 'fixture missing' };
    const mutatedProgram = mutateProgramJson(program, root => mutateEveryColorFact(root, mutate));
    const mutatedAuthority = mutateAuthorityJson(evidenceAuthority, root => mutateEveryColorFact(root, mutate));
    return validateX4UiLayoutEvidencePair(mutatedProgram, mutatedAuthority);
  };
  const semanticColorPairCases: ReadonlyArray<readonly [string, ColorFactMutator]> = [
    ['source literal RGB domain', (_fact, value) => {
      if (value.domain === 'source-literal-percent-alpha') value.r = 256;
    }],
    ['source literal alpha domain', (_fact, value) => {
      if (value.domain === 'source-literal-percent-alpha') value.a = 101;
    }],
    ['source literal glow domain', (_fact, value) => {
      if (value.domain === 'source-literal-percent-alpha' && value.glow !== undefined) value.glow = 1.1;
    }],
    ['canonical RGBA domain', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') value.r = 256;
    }],
    ['canonical glow domain', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') value.glow = 1.1;
    }],
    ['top-level/channel binding', (_fact, value) => {
      if (value.domain === 'source-literal-percent-alpha' && value.channels && typeof value.channels === 'object') {
        const channels = value.channels as Record<string, unknown>;
        (value.channels as Record<string, unknown>).r = {
          ...(channels.r as Record<string, unknown>),
          value: (typeof value.r === 'number' ? value.r : 0) + 1,
        };
      }
    }],
    ['source/declaration/channel binding', (_fact, value) => {
      if (value.domain === 'source-literal-percent-alpha' && value.channels && typeof value.channels === 'object') {
        const channel = (value.channels as Record<string, unknown>).r as Record<string, unknown>;
        channel.keySource = { ...(channel.keySource as Record<string, unknown>), file: 'forged-channel.lua' };
      }
    }],
    ['canonical requested identity', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') value.requestedId = 'forged_requested';
    }],
    ['canonical base identity', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') value.resolvedBaseId = 'forged_base';
    }],
    ['canonical mapping identity', (_fact, value) => {
      const mappingSource = value.mappingSource as Record<string, unknown> | undefined;
      if (value.domain === 'canonical-xml-byte-alpha' && mappingSource) mappingSource.id = 'forged_mapping';
    }],
    ['canonical document pin path/index', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') {
        const baseSource = value.baseSource as Record<string, unknown>;
        baseSource.path = 'forged-colors.xml';
        baseSource.index = 999;
      }
    }],
    ['canonical mapping/base consistency', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha' && value.mappingSource) delete value.mappingSource;
    }],
    ['provenance/domain binding', (fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') fact.provenance = 'source-literal';
    }],
    ['canonical identity binding', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') value.canonicalIdentity = 'forged-canonical';
    }],
    ['canonical source identity/hash/size', (_fact, value) => {
      if (value.domain === 'canonical-xml-byte-alpha') {
        const identities = value.sourceIdentities as Record<string, unknown>;
        const xml = identities.xml as Record<string, unknown>;
        xml.sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
        xml.size = 1;
      }
    }],
  ];
  for (const [name, mutate] of semanticColorPairCases) {
    const validation = semanticColorPair(mutate);
    p3Check('semantic pair rejects ' + name, validation.valid === false, validation);
  }

  const malformedLiteralSources = [
    ['RGB upper bound', '{ r = 256, g = 2, b = 3, a = 4 }'],
    ['RGB negative bound', '{ r = -1, g = 2, b = 3, a = 4 }'],
    ['alpha percent upper bound', '{ r = 1, g = 2, b = 3, a = 101 }'],
    ['glow upper bound', '{ r = 1, g = 2, b = 3, a = 4, glow = 1.1 }'],
  ] as const;
  const malformedLiteralResults = malformedLiteralSources.map(([name, literal]) => {
    const source = [
      'local menu = { name = "Bounds", layer = 1 }',
      'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
      'local table = frame:addTable(1, { width = 20 })',
      'local row = table:addRow(false, {})',
      `row[1]:createText("${name}", { color = ${literal} })`,
    ].join('\n');
    const candidate = buildX4UiCallModel(input(source, `selftest/p3-color-${name.replace(/[^a-z]+/giu, '-')}.lua`));
    const result = projectWithColorEvidence(candidate, topTarget(candidate), profileFor(candidate), undefined, undefined, authority);
    const fact = resultProgram(result)?.operations.find(operationValue => operationValue.kind === 'createText')?.descriptorFacts.color;
    return { name, fact };
  });
  p3Check(
    'literal channel and glow bounds fail closed without normalization',
    malformedLiteralResults.every(candidate => unavailableColor(candidate.fact)
      && (candidate.fact.reason.includes('out of range') || candidate.fact.reason.includes('not a source literal table'))),
    malformedLiteralResults,
  );

  const unknownSource = [
    'local menu = { name = "Unknown", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 20 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("unknown", { color = Color["missing.id"] })',
  ].join('\n');
  const unknownModel = buildX4UiCallModel(input(unknownSource, 'selftest/p3-color-unknown.lua'));
  const unknownResult = projectWithColorEvidence(unknownModel, topTarget(unknownModel), profileFor(unknownModel), undefined, undefined, authority);
  const unknownFact = resultProgram(unknownResult)?.operations.find(operationValue => operationValue.kind === 'createText')?.descriptorFacts.color;
  p3Check(
    'unknown symbolic IDs remain explicit gaps with no effective/runtime claim',
    unavailableColor(unknownFact)
      && unknownFact.reason.includes('canonical color ID')
      && resultProgram(unknownResult)?.gaps.some(gap => gap.expression === 'Color["missing.id"]') === true,
    { fact: unknownFact, gaps: resultProgram(unknownResult)?.gaps },
  );

  const dynamicSource = [
    'local menu = { name = "Dynamic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 20 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("dynamic", { width = getWidth(), color = Color["text_normal"] })',
  ].join('\n');
  const dynamicModel = buildX4UiCallModel(input(dynamicSource, 'selftest/p3-color-unrelated-gaps.lua'));
  const dynamicResult = projectWithColorEvidence(dynamicModel, topTarget(dynamicModel), profileFor(dynamicModel), undefined, undefined, authority);
  const dynamicTextOperation = resultProgram(dynamicResult)?.operations.find(operationValue => operationValue.kind === 'createText');
  const dynamicTextFact = dynamicTextOperation?.descriptorFacts.color;
  p3Check(
    'known colors do not erase unrelated dynamic geometry gaps',
    knownColor(dynamicTextFact)
      && dynamicTextOperation?.status === 'unresolved'
      && resultProgram(dynamicResult)?.gaps.some(gap => gap.category === 'count' || gap.category === 'width') === true,
    { dynamicTextFact, dynamicTextOperation, gaps: resultProgram(dynamicResult)?.gaps },
  );

  const localExpansionColorSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function nested(cell, label, height)',
    '  cell:createText(label, { height = height, color = Color["text_normal"] })',
    'end',
    'local function panel(frame, count, width, label)',
    '  local table = frame:addTable(count, { width = width })',
    '  table:setColWidthPercent(1, 100)',
    '  local row = table:addRow(false, {})',
    '  nested(row[1], label, 12)',
    'end',
    'local panelAlias = panel',
    'local function display()',
    '  local menu = { name = "Expansion", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, 1, 60, "one")',
    '  panelAlias(frame, 1, 70, "two")',
    '  frame:display()',
    'end',
  ].join('\n');
  const localExpansionColorModel = buildX4UiCallModel(input(localExpansionColorSource, 'selftest/p3-local-expansion-color.lua'));
  const localExpansionColorTarget = namedTarget(localExpansionColorModel, 'display');
  const localExpansionColorProfile = profileFor(localExpansionColorModel, {
    minTextHeight: 12,
    localExpansion: { maxDepth: 4, maxInvocations: 8 },
  });
  const localExpansionColorResult = projectWithColorEvidence(
    localExpansionColorModel,
    localExpansionColorTarget,
    localExpansionColorProfile,
    undefined,
    undefined,
    authority,
  );
  const localExpansionColorProgram = resultProgram(localExpansionColorResult);
  const localExpansionColorAuthority = evidenceAuthorityOf(localExpansionColorResult);
  const localExpansionColorFacts = localExpansionColorProgram?.operations
    .filter(operationValue => operationValue.kind === 'createText')
    .map(operationValue => operationValue.descriptorFacts.color) || [];
  p3Check(
    'genuine P2 authority remains reciprocal under local expansion with expanded color facts',
    localExpansionColorResult.status !== 'refused'
      && localExpansionColorProgram !== undefined
      && localExpansionColorAuthority !== undefined
      && localExpansionColorProgram.localExpansion?.invocations.filter(candidate => candidate.status === 'expanded').length === 4
      && localExpansionColorFacts.length === 2
      && localExpansionColorFacts.every(candidate => knownColor(candidate))
      && validateX4UiLayoutEvidencePair(localExpansionColorProgram, localExpansionColorAuthority).valid,
    {
      status: localExpansionColorResult.status,
      colorFacts: localExpansionColorFacts,
      validation: localExpansionColorProgram && localExpansionColorAuthority
        ? validateX4UiLayoutEvidencePair(localExpansionColorProgram, localExpansionColorAuthority)
        : undefined,
      expansion: localExpansionColorProgram?.localExpansion,
    },
  );

  const localExpansionCatalogReciprocitySource = [
    'local Helper = rawget(_G, "Helper")',
    'local function leaf(frame)',
    '  if frame then',
    '    local table = frame:addTable(1, { width = 30 })',
    '    table:addRow(false, {})',
    '  end',
    'end',
    'local function branch(frame)',
    '  if frame then leaf(frame) end',
    'end',
    'local function display()',
    '  local menu = { name = "CatalogReciprocity", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  if false then branch(frame) end',
    '  frame:display()',
    'end',
  ].join('\n');
  const localExpansionCatalogReciprocityModel = buildX4UiCallModel(input(
    localExpansionCatalogReciprocitySource,
    'selftest/p3-local-expansion-catalog-reciprocity.lua',
  ));
  const localExpansionCatalogReciprocityTarget = namedTarget(localExpansionCatalogReciprocityModel, 'display');
  const localExpansionCatalogReciprocityProfile = profileFor(localExpansionCatalogReciprocityModel, {
    localExpansion: { maxDepth: 4, maxInvocations: 8 },
  });
  const localExpansionCatalogReciprocityResult = projectX4UiLayoutProgram(
    localExpansionCatalogReciprocityModel,
    localExpansionCatalogReciprocityTarget,
    localExpansionCatalogReciprocityProfile,
    undefined,
    undefined,
    authority,
  );
  const localExpansionCatalogReciprocityProgram = resultProgram(localExpansionCatalogReciprocityResult);
  const localExpansionCatalogReciprocityAuthority = evidenceAuthorityOf(localExpansionCatalogReciprocityResult);
  p3Check(
    'genuine P2 local expansion catalog only retains ledger-reciprocal branch entries',
    localExpansionCatalogReciprocityResult.status !== 'refused'
      && localExpansionCatalogReciprocityProgram !== undefined
      && localExpansionCatalogReciprocityAuthority !== undefined
      && validateX4UiLayoutEvidencePair(
        localExpansionCatalogReciprocityProgram,
        localExpansionCatalogReciprocityAuthority,
      ).valid,
    {
      status: localExpansionCatalogReciprocityResult.status,
      refusal: 'refusal' in localExpansionCatalogReciprocityResult
        ? localExpansionCatalogReciprocityResult.refusal
        : undefined,
      validation: localExpansionCatalogReciprocityProgram && localExpansionCatalogReciprocityAuthority
        ? validateX4UiLayoutEvidencePair(
          localExpansionCatalogReciprocityProgram,
          localExpansionCatalogReciprocityAuthority,
        )
        : undefined,
      catalog: localExpansionCatalogReciprocityProgram?.localExpansion?.previewPathCatalog,
      invocations: localExpansionCatalogReciprocityProgram?.localExpansion?.invocations,
    },
  );
  return p3Checks;
};

const baseResult = run();
const p3Result = await runP3ColorChecks();
const result = {
  ...baseResult,
  allPassed: baseResult.allPassed && p3Result.every(candidate => candidate.pass),
  passed: baseResult.passed + p3Result.filter(candidate => candidate.pass).length,
  total: baseResult.total + p3Result.length,
  checks: [...baseResult.checks, ...p3Result],
};
const phase3DChecks = result.checks.filter(candidate => candidate.name.includes('Phase 3D'));
const phase3DDetails = phase3DChecks.map(candidate => {
  try {
    return candidate.detail ? JSON.parse(candidate.detail) as Record<string, unknown> : {};
  } catch {
    return {};
  }
});
const phase3DFamilyCounts = phase3DDetails.reduce<Record<string, number>>((counts, candidate) => {
  const attack = candidate.attack as Record<string, unknown> | undefined;
  const family = typeof attack?.family === 'string' ? attack.family : 'unknown';
  counts[family] = (counts[family] || 0) + 1;
  return counts;
}, {});
const phase3DFixtureNotReadyCount = phase3DDetails.filter(candidate =>
  (candidate.attack as Record<string, unknown> | undefined)?.proof
  && ((candidate.attack as Record<string, unknown>).proof as Record<string, unknown>).fixtureReady !== true).length;
const phase3DExceptionCount = phase3DDetails.filter(candidate =>
  ((candidate.validation as Record<string, unknown> | undefined)?.threw === true)
  || (((candidate.attack as Record<string, unknown> | undefined)?.validation as Record<string, unknown> | undefined)?.threw === true)).length;
const phase3GChecks = result.checks.filter(candidate => candidate.name.includes('Phase 3G'));
const phase3GDetails = phase3GChecks.map(candidate => {
  try {
    return candidate.detail ? JSON.parse(candidate.detail) as Record<string, unknown> : {};
  } catch {
    return {};
  }
});
const phase3GFamilyCounts = phase3GDetails.reduce<Record<string, number>>((counts, candidate) => {
  const family = typeof candidate.family === 'string' ? candidate.family : 'unknown';
  counts[family] = (counts[family] || 0) + 1;
  return counts;
}, {});
const phase3GFixtureNotReadyCount = phase3GDetails.filter(candidate =>
  (candidate.proof as Record<string, unknown> | undefined)?.fixtureReady !== true).length;
const phase3GExceptionCount = phase3GDetails.filter(candidate =>
  (candidate.validation as Record<string, unknown> | undefined)?.threw === true).length;
const phase3GCurrentAcceptedCount = phase3GDetails.filter(candidate =>
  (candidate.validation as Record<string, unknown> | undefined)?.valid === true).length;
const phase3JChecks = result.checks.filter(candidate => candidate.name.includes('Phase 3J'));
const phase3JDetails = phase3JChecks.map(candidate => {
  try {
    return candidate.detail ? JSON.parse(candidate.detail) as Record<string, unknown> : {};
  } catch {
    return {};
  }
});
const phase3JCaseFamilyCounts = phase3JDetails.reduce<Record<string, number>>((counts, candidate) => {
  const family = typeof candidate.family === 'string' ? candidate.family : 'unknown';
  counts[family] = (counts[family] || 0) + 1;
  return counts;
}, {});
const phase3JFailedDetails = phase3JChecks.filter(candidate => !candidate.pass).map(candidate => {
  try {
    return candidate.detail ? JSON.parse(candidate.detail) as Record<string, unknown> : {};
  } catch {
    return {};
  }
});
const phase3JFamilyCounts = phase3JFailedDetails.reduce<Record<string, number>>((counts, candidate) => {
  const family = typeof candidate.family === 'string' ? candidate.family : 'unknown';
  counts[family] = (counts[family] || 0) + 1;
  return counts;
}, {});
const phase3JFixtureNotReadyCount = phase3JDetails.filter(candidate =>
  (candidate.proof as Record<string, unknown> | undefined)?.fixtureReady !== true).length;
const phase3JExceptionCount = phase3JDetails.filter(candidate =>
  (candidate.validation as Record<string, unknown> | undefined)?.threw === true).length;
const phase3JCurrentAcceptedCount = phase3JDetails.filter(candidate =>
  (candidate.validation as Record<string, unknown> | undefined)?.valid === true).length;
const priorChecks = result.checks.filter(candidate =>
  !candidate.name.includes('Phase 3G') && !candidate.name.includes('Phase 3J'));
const phase3JHistoricalChecks = result.checks.filter(candidate =>
  !candidate.name.includes('Phase 3J'));
console.log(JSON.stringify({
  allPassed: result.allPassed,
  passed: result.passed,
  total: result.total,
  phase3D: {
    total: phase3DChecks.length,
    passed: phase3DChecks.filter(candidate => candidate.pass).length,
    failed: phase3DChecks.filter(candidate => !candidate.pass).length,
    historicalGreen: result.checks.filter(candidate => !candidate.name.includes('Phase 3D') && candidate.pass).length,
    familyCounts: phase3DFamilyCounts,
    fixtureNotReady: phase3DFixtureNotReadyCount,
    validatorExceptions: phase3DExceptionCount,
  },
  phase3G: {
    total: phase3GChecks.length,
    passed: phase3GChecks.filter(candidate => candidate.pass).length,
    failed: phase3GChecks.filter(candidate => !candidate.pass).length,
    historicalGreen: priorChecks.filter(candidate => candidate.pass).length,
    uniqueNames: new Set(phase3GChecks.map(candidate => candidate.name)).size,
    familyCounts: phase3GFamilyCounts,
    fixtureNotReady: phase3GFixtureNotReadyCount,
    validatorExceptions: phase3GExceptionCount,
    currentValidatorAccepted: phase3GCurrentAcceptedCount,
  },
  phase3J: {
    total: phase3JChecks.length,
    passed: phase3JChecks.filter(candidate => candidate.pass).length,
    failed: phase3JChecks.filter(candidate => !candidate.pass).length,
    historicalGreen: phase3JHistoricalChecks.filter(candidate => candidate.pass).length,
    uniqueNames: new Set(phase3JChecks.map(candidate => candidate.name)).size,
    familyCounts: phase3JFamilyCounts,
    caseFamilyCounts: phase3JCaseFamilyCounts,
    fixtureNotReady: phase3JFixtureNotReadyCount,
    validatorExceptions: phase3JExceptionCount,
    currentValidatorAccepted: phase3JCurrentAcceptedCount,
  },
  checks: result.checks,
}, null, 2));
if (!result.allPassed) process.exitCode = 1;
