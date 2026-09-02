/**
 * Pure logical paint-plan projection for the accepted X4 UI Scene.
 *
 * This module deliberately stops before a browser or game paint API.  It
 * carries source-backed geometry, bitmap atlas reads, diagnostics, and
 * keep-out overlays as serializable commands.  It does not claim engine or
 * game acceptance.
 */

import {
  KEEP_OUT_PRESET_IDS,
  NOT_VERIFIED_IN_GAME,
  getBuiltInKeepOut,
  getKeepOutPreset,
  isIssuedKeepOutEntry,
  isIssuedKeepOutProjection,
  projectKeepOut,
  type KeepOutContextPresetId,
  type X4UiKeepOutEntry,
  type KeepOutProjectionResult,
} from './x4UiKeepOuts';
import {
  ZEKTON_CORPUS_ASSETS,
  type ZektonFontAssets,
} from './x4UiFontMetrics';
import {
  isX4UiCorpusCanonicalSuccess,
  type X4UiCorpusCanonicalSuccess,
} from './x4UiCorpusAssets';
import { materializeX4UiPreviewPaintScene, type X4UiPreviewPipelineResult } from './x4UiPreviewPipeline';
import {
  X4_UI_SCENE_FORMAT,
  X4_UI_SCENE_GAME_TRUTH,
  X4_UI_SCENE_VERSION,
  type X4UiScene,
  type X4UiSceneFontIdentityPins,
  type X4UiSceneGlyphNode,
  type X4UiSceneNodeBase,
  type X4UiSceneRect,
  type X4UiSceneResult,
  type X4UiSceneColorFact,
  type X4UiSceneGap,
  type X4UiSceneSourceLocation,
  type X4UiSceneTextNode,
} from './x4UiScene';

export const X4_UI_PAINT_PLAN_FORMAT = 'x4-ui-paint-plan' as const;
export const X4_UI_PAINT_PLAN_VERSION = 1 as const;
export const X4_UI_PAINT_GAME_TRUTH = NOT_VERIFIED_IN_GAME;
const WIDGET_SOURCE_PATH = 'ui/widget/lua/widget_fullscreen.lua';

export const X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS = Object.freeze({
  configBorder: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 617, lineEnd: 634 }),
  fixedTextBorder: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 848, lineEnd: 860 }),
  scaledInnerInset: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 8702, lineEnd: 8727 }),
  innerApplication: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 12642, lineEnd: 12646 }),
  textAnchor: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 12673, lineEnd: 12686 }),
  textTruncation: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 12774, lineEnd: 12782 }),
});

export interface X4UiPaintEditBoxCompositionEvidence {
  readonly previewOnly: true;
  readonly configBorder: 1;
  readonly innerInset: number;
  readonly textBorder: 2;
  readonly sourcePins: typeof X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS;
}

/**
 * A source-backed color fact is only a partial preview tint.  It deliberately
 * carries the Scene fact fields without deriving engine material, texture,
 * runtime state, glow, font, or game-effective color behavior.
 */
export interface X4UiPaintBasePreviewTint {
  readonly kind: 'base-preview-tint';
  readonly completeness: 'partial';
  readonly field: X4UiSceneColorFact['field'];
  readonly slot: X4UiSceneColorFact['slot'];
  readonly value: X4UiSceneColorFact['value'];
  readonly domain: X4UiSceneColorFact['domain'];
  readonly provenance: X4UiSceneColorFact['provenance'];
  readonly expression: X4UiSceneColorFact['expression'];
  readonly source: X4UiSceneColorFact['source'];
  readonly sourcePin?: X4UiSceneColorFact['sourcePin'];
  readonly sampleId?: X4UiSceneColorFact['sampleId'];
  readonly gameVerification: typeof NOT_VERIFIED_IN_GAME;
}

export type X4UiPaintLayerKind =
  | 'diagnostic-background'
  | 'glyph-alpha-blits'
  | 'diagnostics'
  | 'keep-out-overlays';

export type X4UiPaintDiagnosticKind =
  | 'node-geometry'
  | 'selection'
  | 'gap'
  | 'unsupported-runtime-paint'
  | 'unavailable-node'
  | 'empty-clip'
  | 'invalid-raster-candidate';

export interface X4UiPaintPlanSelection {
  readonly nodeIds?: readonly string[];
  readonly source?: X4UiSceneSourceLocation;
}

export interface X4UiPaintKeepOutInput {
  readonly context: string;
  /** Issued normalized entry for Batch 8C.1; structural legacy inputs are refused. */
  readonly entry: X4UiKeepOutEntry;
  readonly projection: KeepOutProjectionResult;
}

export interface X4UiPaintPlanInput {
  readonly scene: X4UiScene | X4UiSceneResult;
  readonly corpus: unknown;
  readonly keepOuts?: readonly X4UiPaintKeepOutInput[];
  readonly selection?: X4UiPaintPlanSelection;
  readonly previewAuthority: X4UiPreviewPipelineResult;
}

interface PaintCommandBase {
  readonly id: string;
  readonly layer: X4UiPaintLayerKind;
  readonly order: number;
  readonly nodeId?: string;
  readonly frameId?: string;
  readonly source?: X4UiSceneSourceLocation;
  readonly clipRect?: X4UiSceneRect;
  readonly gameTruth: typeof X4_UI_PAINT_GAME_TRUTH;
  readonly gameVerified: false;
}

export interface X4UiPaintGeometryCommand extends PaintCommandBase {
  readonly kind: 'node-geometry';
  readonly geometry?: X4UiSceneRect;
  /** Preview-only X4 edit-box inner layer, inset by the source-scaled border. */
  readonly innerGeometry?: X4UiSceneRect;
  /** Distinguishes scaled black inset geometry from the fixed text border. */
  readonly editboxComposition?: X4UiPaintEditBoxCompositionEvidence;
  readonly completeness: 'complete' | 'partial' | 'unavailable';
  readonly style: 'source-derived' | 'unavailable';
  readonly basePreviewTints?: readonly X4UiPaintBasePreviewTint[];
}

export interface X4UiPaintGlyphCommand extends PaintCommandBase {
  readonly kind: 'glyph-alpha-blit';
  readonly textId: string;
  readonly lineIndex: number;
  readonly codePoint: number;
  readonly glyphIndex: number;
  readonly descriptor: { readonly relativePath: string; readonly sha256: string };
  readonly atlas: {
    readonly relativePath: string;
    readonly sha256: string;
    readonly width: number;
    readonly height: number;
  };
  readonly sourceRect: X4UiSceneRect;
  readonly destinationRect: X4UiSceneRect;
  readonly sourceRange: { readonly start: number; readonly end: number };
  readonly sourceCodePointRange: { readonly start: number; readonly end: number };
  readonly isEllipsis: boolean;
  readonly basePreviewTints?: readonly X4UiPaintBasePreviewTint[];
}

export interface X4UiPaintDiagnosticCommand extends PaintCommandBase {
  readonly kind: Exclude<X4UiPaintDiagnosticKind, 'node-geometry'>;
  /** Whether this diagnostic is a source-composition surface or diagnostic-map only. */
  readonly sourceComposition: 'visual' | 'diagnostic-only';
  readonly reason: string;
  readonly geometry?: X4UiSceneRect;
  readonly category?: string;
  readonly status?: string;
  readonly operationId?: string;
}

export interface X4UiPaintKeepOutCommand extends PaintCommandBase {
  readonly kind: 'keep-out';
  readonly context: string;
  readonly entryId: string;
  readonly status: 'projected' | 'unavailable';
  readonly evidenceGrade: string;
  readonly advisoryOnly: true;
  readonly gameVerification: typeof NOT_VERIFIED_IN_GAME;
  readonly geometry:
    | { readonly kind: 'horizontal-guide'; readonly y: number }
    | { readonly kind: 'vertical-guide'; readonly x: number }
    | { readonly kind: 'polygon'; readonly points: readonly { readonly x: number; readonly y: number }[] }
    | null;
  readonly reason?: string;
}

export type X4UiPaintCommand =
  | X4UiPaintGeometryCommand
  | X4UiPaintGlyphCommand
  | X4UiPaintDiagnosticCommand
  | X4UiPaintKeepOutCommand;

export interface X4UiPaintLayer {
  readonly kind: X4UiPaintLayerKind;
  readonly commands: readonly X4UiPaintCommand[];
}

export interface X4UiPaintPlan {
  readonly format: typeof X4_UI_PAINT_PLAN_FORMAT;
  readonly version: typeof X4_UI_PAINT_PLAN_VERSION;
  readonly status: 'projected' | 'partial';
  readonly gameTruth: typeof X4_UI_PAINT_GAME_TRUTH;
  readonly gameVerified: false;
  readonly source: {
    readonly file: string;
    readonly sourcePath?: string;
    readonly sha256: string;
  };
  readonly logicalDrawable: { readonly width: number; readonly height: number };
  readonly layers: readonly [
    X4UiPaintLayer,
    X4UiPaintLayer,
    X4UiPaintLayer,
    X4UiPaintLayer,
  ];
  readonly sceneStatus: 'projected' | 'partial';
  readonly selectedNodeIds: readonly string[];
  readonly keepOuts: readonly X4UiPaintKeepOutCommand[];
  readonly diagnostics: readonly X4UiPaintDiagnosticCommand[];
  readonly verification: {
    readonly game: typeof X4_UI_PAINT_GAME_TRUTH;
    readonly gameVerified: false;
  };
}

export type X4UiPaintPlanRefusalCode =
  | 'invalid-input'
  | 'invalid-scene'
  | 'invalid-corpus'
  | 'invalid-font'
  | 'invalid-keepout'
  | 'invalid-selection'
  | 'invalid-hierarchy'
  | 'invalid-clip'
  | 'invalid-atlas'
  | 'unsafe-number'
  | 'game-truth'
  | 'duplicate-id';

export interface X4UiPaintPlanRefusal {
  readonly code: X4UiPaintPlanRefusalCode;
  readonly message: string;
}

export type X4UiPaintPlanResult =
  | {
    readonly status: 'projected' | 'partial';
    readonly plan: X4UiPaintPlan;
    readonly verification: X4UiPaintPlan['verification'];
  }
  | {
    readonly status: 'refused';
    readonly refusal: X4UiPaintPlanRefusal;
    readonly gameTruth: typeof X4_UI_PAINT_GAME_TRUTH;
    readonly verification: X4UiPaintPlan['verification'];
  };

type JsonRecord = Record<string, unknown>;
type Node = X4UiSceneNodeBase & { readonly kind?: string };

const HELPER_RUNTIME_AVAILABILITY_GAP_REASON = 'rawget Helper alias proves preview receiver identity only; runtime non-nil availability remains unverified';
const BLUR_BACKDROP_UNAVAILABLE_REASON = 'live-game blur rasterization is unavailable; blurBackground is a compositor/backdrop requirement only';

const VERIFICATION = Object.freeze({
  game: X4_UI_PAINT_GAME_TRUTH,
  gameVerified: false as const,
});

const PRESET_IDS = new Set<string>(Object.values(KEEP_OUT_PRESET_IDS));

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteSafe = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;

const isSafeInteger = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

const isDimension = (value: unknown): value is number =>
  isFiniteSafe(value) && value >= 0 && value <= 1_000_000;

const isCoordinate = (value: unknown): value is number =>
  isFiniteSafe(value) && Math.abs(value) <= 1_000_000;

const ownKeys = (value: JsonRecord): readonly string[] => Object.keys(value);

type OwnDataField = {
  readonly present: boolean;
  readonly valid: boolean;
  readonly value?: unknown;
};

const ownDataField = (value: object, field: string): OwnDataField => {
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  if (descriptor === undefined) return { present: false, valid: true };
  if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return { present: true, valid: false };
  return { present: true, valid: true, value: descriptor.value };
};

const exactOwnDataKeys = (value: object, required: readonly string[], optional: readonly string[] = []): boolean => {
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  const allowed = new Set([...required, ...optional]);
  const names = Object.getOwnPropertyNames(value);
  if (!required.every(key => names.includes(key)) || !names.every(key => allowed.has(key))) return false;
  return names.every(key => {
    const field = ownDataField(value, key);
    return field.present && field.valid;
  });
};

const exactKeys = (value: JsonRecord, required: readonly string[], optional: readonly string[] = []): boolean => {
  const allowed = new Set([...required, ...optional]);
  const keys = ownKeys(value);
  return required.every(key => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every(key => allowed.has(key));
};

type CapturedKeepOutAuthority = {
  readonly context: string;
  readonly entry: X4UiKeepOutEntry;
  readonly projection: KeepOutProjectionResult;
};

const captureKeepOutItem = (value: unknown): CapturedKeepOutAuthority | null => {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    const stringKeys = keys.filter((key): key is string => typeof key === 'string');
    if (stringKeys.length !== keys.length || stringKeys.length !== 3
      || !stringKeys.includes('context') || !stringKeys.includes('entry') || !stringKeys.includes('projection')) return null;
    const fields = new Map<string, unknown>();
    for (const key of stringKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) return null;
      fields.set(key, descriptor.value);
    }
    const context = fields.get('context');
    const entry = fields.get('entry');
    const projection = fields.get('projection');
    if (typeof context !== 'string' || context.trim().length === 0
      || !isIssuedKeepOutEntry(entry) || !isIssuedKeepOutProjection(projection)) return null;
    return { context, entry, projection };
  } catch {
    return null;
  }
};

const captureKeepOutAuthority = (value: unknown): readonly CapturedKeepOutAuthority[] | null => {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    const stringKeys = keys.filter((key): key is string => typeof key === 'string');
    if (stringKeys.length !== keys.length) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || lengthDescriptor.enumerable
      || typeof lengthDescriptor.value !== 'number' || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0 || stringKeys.length !== lengthDescriptor.value + 1
      || stringKeys.some(key => key !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= lengthDescriptor.value))) return null;
    const captured: CapturedKeepOutAuthority[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const itemDescriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (itemDescriptor === undefined || !itemDescriptor.enumerable || !('value' in itemDescriptor)) return null;
      const item = captureKeepOutItem(itemDescriptor.value);
      if (item === null) return null;
      captured.push(item);
    }
    return captured;
  } catch {
    return null;
  }
};

const materializeCapturedKeepOuts = (captured: readonly CapturedKeepOutAuthority[]): readonly unknown[] => captured.map(item => ({
  context: item.context,
  entry: materializePaintJsonDomain(item.entry),
  projection: materializePaintJsonDomain(item.projection),
}));

const jsonDomain = (
  value: unknown,
  active = new WeakSet<object>(),
  completed = new WeakSet<object>(),
): boolean => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return false;
  if (typeof value !== 'object' || value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return false;
  const object = value as object;
  if (completed.has(object)) return true;
  if (active.has(object)) return false;
  active.add(object);
  const prototype = Object.getPrototypeOf(object);
  const plain = Array.isArray(value) ? prototype === Array.prototype : prototype === Object.prototype || prototype === null;
  const valid = plain && (Array.isArray(value)
    ? Object.keys(value).length === value.length && value.every(item => item !== undefined && jsonDomain(item, active, completed))
    : Object.keys(value as JsonRecord).every(key => {
      const child = (value as JsonRecord)[key];
      return child === undefined || jsonDomain(child, active, completed);
    }));
  active.delete(object);
  if (valid) completed.add(object);
  return valid;
};

const materializePaintJsonDomain = (value: unknown, active = new Set<object>()): unknown => {
  if (value === undefined) throw new TypeError('paint input contains undefined outside an object member');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('paint input contains a non-JSON number');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('paint input contains a non-JSON value');
  if (active.has(value)) throw new TypeError('paint input contains a cycle');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length !== 0) {
        throw new TypeError('paint input contains a malformed array');
      }
      const names = Object.getOwnPropertyNames(value);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (lengthDescriptor === undefined
        || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
        || typeof lengthDescriptor.value !== 'number'
        || lengthDescriptor.enumerable
        || names.length !== lengthDescriptor.value + 1
        || !names.every(name => name === 'length' || /^(0|[1-9][0-9]*)$/.test(name) && Number(name) < lengthDescriptor.value)) {
        throw new TypeError('paint input contains a sparse or decorated array');
      }
      const result: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          throw new TypeError('paint input contains a sparse or accessor array member');
        }
        result.push(materializePaintJsonDomain(descriptor.value, active));
      }
      return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null || Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError('paint input contains a non-JSON object');
    }
    const names = Object.getOwnPropertyNames(value);
    const enumerableNames = Object.keys(value);
    if (names.length !== enumerableNames.length || names.some(name => !enumerableNames.includes(name))) {
      throw new TypeError('paint input contains a non-enumerable object member');
    }
    const result = Object.create(null) as JsonRecord;
    for (const name of enumerableNames) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (descriptor === undefined || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new TypeError('paint input contains an accessor object member');
      }
      if (descriptor.value !== undefined) result[name] = materializePaintJsonDomain(descriptor.value, active);
    }
    return result;
  } finally {
    active.delete(value);
  }
};

const noEnginePaintTruth = (value: unknown, active = new WeakSet<object>(), completed = new WeakSet<object>()): boolean => {
  if (value === null || typeof value !== 'object') return true;
  const object = value as object;
  if (completed.has(object)) return true;
  if (active.has(object)) return false;
  active.add(object);
  const valid = Object.keys(value as JsonRecord).every(key => {
    const child = (value as JsonRecord)[key];
    if (key === 'engineColor' || key === 'engineAccepted' && child !== false || key === 'gameVerified' && child === true) return false;
    return noEnginePaintTruth(child, active, completed);
  });
  active.delete(object);
  if (valid) completed.add(object);
  return valid;
};

const freezeDeep = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Object.keys(value as JsonRecord)) freezeDeep((value as JsonRecord)[key], seen);
  return Object.freeze(value);
};

const cloneSource = (source: X4UiSceneSourceLocation): X4UiSceneSourceLocation => ({
  file: source.file,
  ...(source.sourcePath === undefined ? {} : { sourcePath: source.sourcePath }),
  start: { line: source.start.line, column: source.start.column, offset: source.start.offset },
  end: { line: source.end.line, column: source.end.column, offset: source.end.offset },
});

const colorFactsForNode = (node: Node): readonly X4UiSceneColorFact[] => {
  const facts = (node as unknown as JsonRecord).colorFacts;
  return Array.isArray(facts) ? facts as readonly X4UiSceneColorFact[] : [];
};

const tableBackgroundTintApplicable = (node: Node): boolean => {
  if (node.kind !== 'table') return true;
  const field = ownDataField(node as unknown as object, 'backgroundId');
  return field.valid && typeof field.value === 'string' && field.value.length > 0;
};

const copyBasePreviewTint = (fact: X4UiSceneColorFact): X4UiPaintBasePreviewTint => {
  const copiedFact = materializePaintJsonDomain(fact) as JsonRecord;
  return {
    kind: 'base-preview-tint',
    completeness: 'partial',
    ...copiedFact,
    gameVerification: NOT_VERIFIED_IN_GAME,
  } as X4UiPaintBasePreviewTint;
};

const basePreviewTintsForNode = (node: Node): readonly X4UiPaintBasePreviewTint[] =>
  colorFactsForNode(node)
    .filter(fact => fact.slot !== 'table-background' || tableBackgroundTintApplicable(node))
    .map(copyBasePreviewTint);

const sourceValid = (value: unknown): value is X4UiSceneSourceLocation => {
  if (!isRecord(value) || !exactKeys(value, ['file', 'start', 'end'], ['sourcePath']) || typeof value.file !== 'string' || value.file.length === 0) return false;
  if (value.sourcePath !== undefined && (typeof value.sourcePath !== 'string' || value.sourcePath.length === 0)) return false;
  for (const position of [value.start, value.end]) {
    if (!isRecord(position) || !exactKeys(position, ['line', 'column', 'offset']) || !isSafeInteger(position.line, 1) || !isSafeInteger(position.column, 0) || !isSafeInteger(position.offset, 0)) return false;
  }
  const start = value.start as JsonRecord;
  const end = value.end as JsonRecord;
  return Number(end.offset) >= Number(start.offset);
};

const rectValid = (value: unknown): value is X4UiSceneRect =>
  isRecord(value)
  && exactKeys(value, ['x', 'y', 'width', 'height'])
  && isCoordinate(value.x) && isCoordinate(value.y)
  && isDimension(value.width) && isDimension(value.height);

const rectCopy = (value: X4UiSceneRect): X4UiSceneRect => ({ x: value.x, y: value.y, width: value.width, height: value.height });

const sameIdentity = (left: unknown, right: unknown): boolean => {
  if (!isRecord(left) || !isRecord(right)) return false;
  return ownKeys(left).length === 2 && ownKeys(right).length === 2
    && left.relativePath === right.relativePath
    && left.sha256 === right.sha256;
};

const sameStructuralValue = (left: unknown, right: unknown, seen = new WeakMap<object, object>()): boolean => {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftObject = left as object;
  const rightObject = right as object;
  const mapped = seen.get(leftObject);
  if (mapped !== undefined) return mapped === rightObject;
  seen.set(leftObject, rightObject);
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameStructuralValue(item, right[index], seen));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameStructuralValue(left[key], right[key], seen));
};

const modelIdentityValid = (value: unknown): value is { readonly file: string; readonly sourcePath?: string; readonly sha256: string } =>
  isRecord(value)
  && exactKeys(value, ['file', 'sha256'], ['sourcePath'])
  && typeof value.file === 'string' && value.file.length > 0
  && (value.sourcePath === undefined || (typeof value.sourcePath === 'string' && value.sourcePath.length > 0))
  && typeof value.sha256 === 'string' && /^[0-9A-Fa-f]{64}$/.test(value.sha256) && !/^0+$/.test(value.sha256);

const sameSourceLocation = (left: unknown, right: unknown): boolean => {
  if (!sourceValid(left) || !sourceValid(right)) return false;
  return left.file === right.file
    && left.sourcePath === right.sourcePath
    && sameStructuralValue(left.start, right.start)
    && sameStructuralValue(left.end, right.end);
};

const sourcePinValid = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['sourcePath', 'lineStart', 'lineEnd'])
  && typeof value.sourcePath === 'string' && value.sourcePath.length > 0
  && isSafeInteger(value.lineStart, 1) && isSafeInteger(value.lineEnd, value.lineStart as number)
  && value.lineEnd >= (value.lineStart as number);

const stringArrayValid = (value: unknown): value is readonly string[] =>
  Array.isArray(value)
  && value.every(item => typeof item === 'string' && item.length > 0)
  && new Set(value).size === value.length;

const diagnosticStyleValid = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['geometry', 'paint', 'texture', 'interaction'])
  && (value.geometry === 'source-derived' || value.geometry === 'unavailable')
  && value.paint === 'unknown-runtime-color'
  && value.texture === 'unknown-runtime-texture'
  && value.interaction === 'unknown-runtime-state';

const sourceRangeValid = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['start', 'end'])
  && isSafeInteger(value.start, 0) && isSafeInteger(value.end, value.start as number)
  && value.end >= (value.start as number);

const provenanceLinkValid = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'source'], ['fact', 'operationId', 'sourcePin', 'expression', 'sampleId']) || !sourceValid(value.source)) return false;
  if (!['descriptor-fact', 'kernel-state', 'source-pin', 'font-metrics', 'preview-only', 'program-gap'].includes(String(value.kind))) return false;
  if (value.fact !== undefined && (typeof value.fact !== 'string' || value.fact.length === 0)) return false;
  if (value.operationId !== undefined && (typeof value.operationId !== 'string' || value.operationId.length === 0)) return false;
  if (value.sourcePin !== undefined && !sourcePinValid(value.sourcePin)) return false;
  if (value.expression !== undefined && typeof value.expression !== 'string') return false;
  if (value.sampleId !== undefined && (typeof value.sampleId !== 'string' || value.sampleId.length === 0)) return false;
  return true;
};

const SCENE_COLOR_SLOTS = new Set([
  'table-background',
  'cell-background',
  'widget-background',
  'editbox-inner-background',
  'widget-highlight',
  'widget-border',
  'widget-icon',
  'primary-text',
  'secondary-text',
]);

const SCENE_COLOR_DOMAINS = new Set(['source-literal-percent-alpha', 'canonical-xml-byte-alpha']);
const SCENE_COLOR_PROVENANCE = new Set(['source-literal', 'canonical-default-only']);
const SCENE_COLOR_FIELD_SLOTS = new Set([
  'backgroundColor:table-background',
  'cellbgcolor:cell-background',
  'bgcolor:widget-background',
  'editboxBackgroundBlackColor:editbox-inner-background',
  'highlightcolor:widget-highlight',
  'bordercolor:widget-border',
  'color:widget-icon',
  'color:primary-text',
  'defaultTextColor:primary-text',
  'color:secondary-text',
]);

const colorSourceIdentityValid = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['path', 'relativePath', 'sha256', 'size'])
  && typeof value.path === 'string' && value.path.length > 0
  && typeof value.relativePath === 'string' && value.relativePath.length > 0
  && typeof value.sha256 === 'string' && /^[0-9A-Fa-f]{64}$/.test(value.sha256) && !/^0+$/.test(value.sha256)
  && isSafeInteger(value.size, 0);

const colorDocumentSourceValid = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['id', 'index', 'path'])
  && typeof value.id === 'string' && value.id.length > 0
  && isSafeInteger(value.index, 0)
  && typeof value.path === 'string' && value.path.length > 0;

const colorLiteralFieldValid = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['expression', 'keySource', 'source', 'value'])
  && typeof value.expression === 'string' && value.expression.length > 0
  && sourceValid(value.keySource)
  && sourceValid(value.source)
  && isFiniteSafe(value.value);

const colorValueValid = (value: unknown): boolean => {
  if (!isRecord(value) || value.kind !== 'color' || value.gameVerification !== NOT_VERIFIED_IN_GAME) return false;
  if (value.domain === 'source-literal-percent-alpha') {
    if (!exactKeys(value, ['kind', 'domain', 'r', 'g', 'b', 'a', 'declarationExpression', 'declarationSource', 'channels', 'gameVerification'], ['glow'])
      || typeof value.declarationExpression !== 'string' || value.declarationExpression.length === 0
      || !sourceValid(value.declarationSource)
      || !isRecord(value.channels)
      || !exactKeys(value.channels, ['r', 'g', 'b', 'a'], ['glow'])
      || !['r', 'g', 'b', 'a'].every(channel => colorLiteralFieldValid(value.channels?.[channel]))
      || value.glow !== undefined && (!isFiniteSafe(value.glow) || !colorLiteralFieldValid(value.channels.glow))) return false;
    return ['r', 'g', 'b', 'a'].every(channel => isFiniteSafe(value[channel]) && Object.is((value.channels as JsonRecord)[channel] && ((value.channels as JsonRecord)[channel] as JsonRecord).value, value[channel]))
      && (value.glow === undefined || Object.is(((value.channels as JsonRecord).glow as JsonRecord).value, value.glow));
  }
  if (value.domain === 'canonical-xml-byte-alpha') {
    return exactKeys(value, ['kind', 'domain', 'canonicalIdentity', 'requestedId', 'resolvedBaseId', 'r', 'g', 'b', 'a', 'glow', 'baseSource', 'sourceIdentities', 'gameVerification'], ['mappingSource'])
      && value.canonicalIdentity === 'x4-9.00'
      && typeof value.requestedId === 'string' && value.requestedId.length > 0
      && typeof value.resolvedBaseId === 'string' && value.resolvedBaseId.length > 0
      && ['r', 'g', 'b', 'a', 'glow'].every(channel => isFiniteSafe(value[channel]))
      && colorDocumentSourceValid(value.baseSource)
      && (value.mappingSource === undefined || colorDocumentSourceValid(value.mappingSource))
      && isRecord(value.sourceIdentities)
      && exactKeys(value.sourceIdentities, ['xml', 'xsd'])
      && colorSourceIdentityValid(value.sourceIdentities.xml)
      && colorSourceIdentityValid(value.sourceIdentities.xsd);
  }
  return false;
};

const sceneColorFactValid = (value: unknown): value is X4UiSceneColorFact => {
  if (!isRecord(value)
    || !exactKeys(value, ['field', 'slot', 'value', 'domain', 'provenance', 'expression', 'source', 'gameVerification'], ['sourcePin', 'sampleId'])
    || typeof value.field !== 'string' || value.field.length === 0
    || !SCENE_COLOR_SLOTS.has(String(value.slot))
    || !SCENE_COLOR_FIELD_SLOTS.has(`${value.field}:${value.slot}`)
    || !SCENE_COLOR_DOMAINS.has(String(value.domain))
    || !SCENE_COLOR_PROVENANCE.has(String(value.provenance))
    || !colorValueValid(value.value)
    || value.domain !== (value.value as JsonRecord).domain
    || value.provenance !== (value.domain === 'source-literal-percent-alpha' ? 'source-literal' : 'canonical-default-only')
    || typeof value.expression !== 'string' || value.expression.length === 0
    || !sourceValid(value.source)
    || value.sourcePin !== undefined && !sourcePinValid(value.sourcePin)
    || value.sampleId !== undefined && (typeof value.sampleId !== 'string' || value.sampleId.length === 0)
    || value.gameVerification !== NOT_VERIFIED_IN_GAME) return false;
  return true;
};

const intersect = (left: X4UiSceneRect, right: X4UiSceneRect): X4UiSceneRect => {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottom = Math.min(left.y + left.height, right.y + right.height);
  return { x, y, width: Math.max(0, rightEdge - x), height: Math.max(0, bottom - y) };
};

const hasArea = (rect: X4UiSceneRect): boolean => rect.width > 0 && rect.height > 0;

const rectForNode = (node: Node): X4UiSceneRect | undefined => {
  if (rectValid(node.rect)) return node.rect;
  const record = node as unknown as JsonRecord;
  if (rectValid(record.outerRect)) return record.outerRect;
  if (rectValid(record.naturalRect)) return record.naturalRect;
  return undefined;
};

const hasExactSourcePinLink = (
  node: Node,
  pin: { readonly sourcePath: string; readonly lineStart: number; readonly lineEnd: number },
): boolean => node.provenanceLinks.some(link => link.kind === 'source-pin'
  && link.sourcePin?.sourcePath === pin.sourcePath
  && link.sourcePin.lineStart === pin.lineStart
  && link.sourcePin.lineEnd === pin.lineEnd);

const copyEditBoxCompositionEvidence = (
  innerInset: number,
): X4UiPaintEditBoxCompositionEvidence => ({
  previewOnly: true,
  configBorder: 1,
  innerInset,
  textBorder: 2,
  sourcePins: {
    configBorder: { ...X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.configBorder },
    fixedTextBorder: { ...X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.fixedTextBorder },
    scaledInnerInset: { ...X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.scaledInnerInset },
    innerApplication: { ...X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.innerApplication },
    textAnchor: { ...X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.textAnchor },
    textTruncation: { ...X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.textTruncation },
  },
});

const previewInnerGeometryForEditBox = (
  node: Node,
  clip: X4UiSceneRect,
  tints: readonly X4UiPaintBasePreviewTint[],
): { readonly geometry: X4UiSceneRect; readonly evidence: X4UiPaintEditBoxCompositionEvidence } | undefined => {
  if (node.kind !== 'editbox') return undefined;
  const record = node as unknown as JsonRecord;
  const configBorder = record.editboxConfigBorder;
  const textBorder = record.editboxTextBorder;
  const innerInset = record.editboxBlackInset;
  const outer = rectForNode(node);
  if (configBorder !== 1 || textBorder !== 2 || !isSafeInteger(innerInset, 2) || innerInset > 1_000_000 || outer === undefined
    || !Object.values(X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS).every(pin => hasExactSourcePinLink(node, pin))
    || !hasArea(outer) || outer.width <= 2 * innerInset || outer.height <= 2 * innerInset
    || !tints.some(tint => tint.slot === 'widget-background')
    || !tints.some(tint => tint.slot === 'editbox-inner-background')) return undefined;
  const inner = {
    x: outer.x + innerInset,
    y: outer.y + innerInset,
    width: outer.width - 2 * innerInset,
    height: outer.height - 2 * innerInset,
  };
  const clipped = intersect(inner, clip);
  return hasArea(clipped)
    ? { geometry: clipped, evidence: copyEditBoxCompositionEvidence(innerInset) }
    : undefined;
};

const fontNameForText = (text: X4UiSceneTextNode): 'Zekton' | 'Zekton Bold' | undefined => text.font;

const copyFontPin = (pin: X4UiSceneFontIdentityPins): X4UiSceneFontIdentityPins => ({
  descriptor: { relativePath: pin.descriptor.relativePath, sha256: pin.descriptor.sha256 },
  atlas: { relativePath: pin.atlas.relativePath, sha256: pin.atlas.sha256 },
});

const fontAssetsValid = (font: unknown, expected: { readonly descriptor: { readonly relativePath: string; readonly sha256: string }; readonly atlas: { readonly relativePath: string; readonly sha256: string } }): font is ZektonFontAssets => {
  if (!isRecord(font) || font.format !== 'x4-zekton-font-assets' || font.evidenceState !== 'provisional-until-game-parity' || !isRecord(font.descriptor) || !isRecord(font.atlas)) return false;
  const descriptor = font.descriptor as unknown as ZektonFontAssets['descriptor'];
  const atlas = font.atlas as unknown as ZektonFontAssets['atlas'];
  if (!sameIdentity(font.descriptorIdentity, expected.descriptor) || !sameIdentity(font.atlasIdentity, expected.atlas)
    || !sameIdentity(descriptor.identity, expected.descriptor) || !sameIdentity(atlas.identity, expected.atlas)
    || descriptor.format !== 'x4-zekton-abc' || atlas.format !== 'x4-zekton-a8-dds') return false;
  if (!isSafeInteger(descriptor.atlasWidth, 1) || !isSafeInteger(descriptor.atlasHeight, 1)
    || descriptor.atlasWidth !== atlas.width || descriptor.atlasHeight !== atlas.height
    || !isSafeInteger(atlas.width, 1) || !isSafeInteger(atlas.height, 1)
    || atlas.payloadLength !== atlas.width * atlas.height
    || !(atlas.alphaBytes instanceof Uint8Array) || atlas.alphaBytes.byteLength !== atlas.payloadLength) return false;
  if (!Array.isArray(descriptor.glyphRecords) || !Array.isArray(descriptor.codePointToGlyphIndex)) return false;
  return descriptor.glyphRecords.every(record => isRecord(record)
    && isSafeInteger(record.glyphIndex, 1)
    && isRecord(record.pixelBounds)
    && isFiniteSafe(record.pixelBounds.left) && isFiniteSafe(record.pixelBounds.top)
    && isFiniteSafe(record.pixelBounds.right) && isFiniteSafe(record.pixelBounds.bottom)
    && record.pixelBounds.left >= 0 && record.pixelBounds.top >= 0
    && record.pixelBounds.right <= atlas.width && record.pixelBounds.bottom <= atlas.height
    && record.pixelBounds.right > record.pixelBounds.left && record.pixelBounds.bottom > record.pixelBounds.top);
};

const profileMatchesCorpus = (scene: X4UiScene, corpus: X4UiCorpusCanonicalSuccess): boolean => {
  const profile = scene.profile;
  if (!isRecord(profile) || !isDimension(profile.drawable.width) || !isDimension(profile.drawable.height)
    || profile.drawable.width !== scene.drawableRect.width || profile.drawable.height !== scene.drawableRect.height) return false;
  if (profile.helper.sourcePath !== corpus.assets.helper.relativePath || profile.helper.sha256 !== corpus.assets.helper.sha256
    || profile.widget.sourcePath !== corpus.assets.widget.relativePath || profile.widget.sha256 !== corpus.assets.widget.sha256) return false;
  const expectedFonts: Readonly<Record<'Zekton' | 'Zekton Bold', { readonly descriptor: { readonly relativePath: string; readonly sha256: string }; readonly atlas: { readonly relativePath: string; readonly sha256: string } }>> = {
    Zekton: ZEKTON_CORPUS_ASSETS.regular,
    'Zekton Bold': ZEKTON_CORPUS_ASSETS.bold,
  };
  for (const name of ['Zekton', 'Zekton Bold'] as const) {
    const pin = profile.fonts[name];
    if (!pin || !sameIdentity(pin.descriptor, expectedFonts[name].descriptor) || !sameIdentity(pin.atlas, expectedFonts[name].atlas)) return false;
  }
  return true;
};

const finiteRecord = (value: unknown, keys: readonly string[]): boolean =>
  isRecord(value) && exactKeys(value, keys) && keys.every(key => isFiniteSafe(value[key]));

const layoutIdentityValid = (value: unknown, expected: { readonly descriptor: { readonly relativePath: string; readonly sha256: string }; readonly atlas: { readonly relativePath: string; readonly sha256: string } }): boolean =>
  isRecord(value)
  && exactKeys(value, ['descriptorIdentity', 'atlasIdentity'])
  && sameIdentity(value.descriptorIdentity, expected.descriptor)
  && sameIdentity(value.atlasIdentity, expected.atlas);

const layoutGlyphQuadValid = (value: unknown, expected: { readonly descriptor: { readonly relativePath: string; readonly sha256: string }; readonly atlas: { readonly relativePath: string; readonly sha256: string } }): boolean =>
  isRecord(value)
  && exactKeys(value, ['kind', 'sourceRange', 'sourceCodePointRange', 'codePoint', 'glyphIndex', 'x', 'y', 'width', 'height', 'bitmapHeight', 'lineBoxY', 'lineBoxHeight', 'bearingX', 'bitmapWidth', 'advance', 'scaledAdvance', 'bitmapBounds', 'uv', 'descriptorIdentity', 'atlasIdentity', 'evidenceState', 'isEllipsis'])
  && value.kind === 'glyph-quad'
  && sourceRangeValid(value.sourceRange)
  && sourceRangeValid(value.sourceCodePointRange)
  && isSafeInteger(value.codePoint, 0) && isSafeInteger(value.glyphIndex, 1)
  && ['x', 'y', 'width', 'height', 'bitmapHeight', 'lineBoxY', 'lineBoxHeight', 'bearingX', 'bitmapWidth', 'advance', 'scaledAdvance'].every(key => isFiniteSafe(value[key]))
  && finiteRecord(value.bitmapBounds, ['left', 'top', 'right', 'bottom'])
  && finiteRecord(value.uv, ['u0', 'v0', 'u1', 'v1'])
  && layoutIdentityValid({ descriptorIdentity: value.descriptorIdentity, atlasIdentity: value.atlasIdentity }, expected)
  && value.evidenceState === 'provisional-until-game-parity'
  && typeof value.isEllipsis === 'boolean';

const layoutLineValid = (value: unknown, expected: { readonly descriptor: { readonly relativePath: string; readonly sha256: string }; readonly atlas: { readonly relativePath: string; readonly sha256: string } }): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['lineIndex', 'displayedText', 'sourceRange', 'sourceCodePointRange', 'width', 'maxWidth', 'lineBox', 'breakReason', 'truncated', 'overflow', 'glyphQuads', 'gaps'], ['breakSourceRange', 'breakSourceCodePointRange'])
    || !isSafeInteger(value.lineIndex, 0) || typeof value.displayedText !== 'string' || !sourceRangeValid(value.sourceRange) || !sourceRangeValid(value.sourceCodePointRange)
    || !isFiniteSafe(value.width) || !isFiniteSafe(value.maxWidth) || !isRecord(value.lineBox) || !exactKeys(value.lineBox, ['x', 'y', 'width', 'height', 'lineAdvance', 'metrics'])
    || !['empty', 'hard-newline', 'word-wrap', 'codepoint-wrap', 'overflow-token', 'truncated', 'overflow', 'end-of-text'].includes(String(value.breakReason))
    || typeof value.truncated !== 'boolean' || typeof value.overflow !== 'boolean' || !Array.isArray(value.glyphQuads) || !Array.isArray(value.gaps)) return false;
  if (!['x', 'y', 'width', 'height', 'lineAdvance'].every(key => isFiniteSafe((value.lineBox as JsonRecord)[key]))
    || !finiteRecord((value.lineBox as JsonRecord).metrics, ['outer', 'top', 'bottom', 'inner', 'split20', 'split24'])
    || value.breakSourceRange !== undefined && !sourceRangeValid(value.breakSourceRange)
    || value.breakSourceCodePointRange !== undefined && !sourceRangeValid(value.breakSourceCodePointRange)
    || !value.glyphQuads.every(item => layoutGlyphQuadValid(item, expected))) return false;
  return value.gaps.every(item => isRecord(item)
    && exactKeys(item, ['kind', 'reason', 'sourceRange', 'sourceCodePointRange', 'lineIndex', 'displayed', 'message'], ['codePoint'])
    && item.kind === 'gap' && ['missing-glyph', 'unsupported-control', 'unsupported-icon-escape', 'surrogate-invalid', 'invalid-newline', 'ellipsis-missing-glyph', 'overflow'].includes(String(item.reason))
    && sourceRangeValid(item.sourceRange) && sourceRangeValid(item.sourceCodePointRange) && (item.codePoint === undefined || isSafeInteger(item.codePoint, 0))
    && isSafeInteger(item.lineIndex, 0) && typeof item.displayed === 'boolean' && typeof item.message === 'string');
};

const textLayoutValid = (value: unknown, expected: { readonly descriptor: { readonly relativePath: string; readonly sha256: string }; readonly atlas: { readonly relativePath: string; readonly sha256: string } }): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['format', 'version', 'originalText', 'displayedText', 'sourceLength', 'sourceCodePointCount', 'scale', 'maxWidth', 'lineMetrics', 'designLineCandidate', 'profile', 'lines', 'gaps', 'truncated', 'overflow', 'descriptorIdentity', 'atlasIdentity', 'evidenceState', 'truthGrade', 'evidence'])
    || value.format !== 'x4-zekton-text-layout' || value.version !== 1 || typeof value.originalText !== 'string' || typeof value.displayedText !== 'string'
    || !isSafeInteger(value.sourceLength, 0) || !isSafeInteger(value.sourceCodePointCount, 0) || !isFiniteSafe(value.scale) || !isFiniteSafe(value.maxWidth)
    || !finiteRecord(value.lineMetrics, ['outer', 'top', 'bottom', 'inner', 'split20', 'split24', 'rawMetric28'])
    || !isRecord(value.designLineCandidate) || !exactKeys(value.designLineCandidate, ['nominalDesignSize', 'requestedFontSize', 'scale', 'raw', 'scaled', 'lineSpacing', 'lineAdvance'])
    || !isFiniteSafe(value.designLineCandidate.nominalDesignSize) || !isFiniteSafe(value.designLineCandidate.requestedFontSize) || !isFiniteSafe(value.designLineCandidate.scale)
    || !finiteRecord(value.designLineCandidate.raw, ['outer', 'top', 'bottom', 'inner', 'split20', 'split24', 'rawMetric28'])
    || !finiteRecord(value.designLineCandidate.scaled, ['outer', 'top', 'bottom', 'inner', 'split20', 'split24'])
    || !isFiniteSafe(value.designLineCandidate.lineSpacing) || !isFiniteSafe(value.designLineCandidate.lineAdvance)
    || !isRecord(value.profile) || !exactKeys(value.profile, ['descriptorIdentity', 'atlasIdentity', 'nominalDesignSize', 'requestedFontSize', 'maxWidth', 'lineSpacing', 'wrapMode', 'truncationMode', 'whitespacePolicy', 'ellipsisPolicy', 'newlinePolicy', 'fallbackPolicy', 'truthGrade', 'evidenceState'])
    || !layoutIdentityValid({ descriptorIdentity: value.profile.descriptorIdentity, atlasIdentity: value.profile.atlasIdentity }, expected)
    || !isFiniteSafe(value.profile.nominalDesignSize) || !isFiniteSafe(value.profile.requestedFontSize) || !isFiniteSafe(value.profile.maxWidth) || !isFiniteSafe(value.profile.lineSpacing)
    || !['no-wrap', 'word-wrap', 'greedy-word', 'none'].includes(String(value.profile.wrapMode)) || !['none', 'ellipsis'].includes(String(value.profile.truncationMode))
    || !isRecord(value.profile.whitespacePolicy) || !exactKeys(value.profile.whitespacePolicy, ['mode', 'breakOn']) || !['preserve', 'trim-at-wrap'].includes(String(value.profile.whitespacePolicy.mode)) || !['ascii-space', 'unicode-space'].includes(String(value.profile.whitespacePolicy.breakOn))
    || !isRecord(value.profile.ellipsisPolicy) || !exactKeys(value.profile.ellipsisPolicy, ['token', 'placement']) || typeof value.profile.ellipsisPolicy.token !== 'string' || value.profile.ellipsisPolicy.placement !== 'end'
    || !['lf-crlf', 'lf-crlf-and-cr'].includes(String(value.profile.newlinePolicy)) || value.profile.fallbackPolicy !== 'gap'
    || (value.profile.truthGrade !== 'source-backed-provisional' && value.profile.truthGrade !== 'provisional-until-game-parity') || value.profile.evidenceState !== 'provisional-until-game-parity'
    || !Array.isArray(value.lines) || !value.lines.every(item => layoutLineValid(item, expected)) || !Array.isArray(value.gaps)
    || !value.gaps.every(item => isRecord(item) && exactKeys(item, ['kind', 'reason', 'sourceRange', 'sourceCodePointRange', 'lineIndex', 'displayed', 'message'], ['codePoint']) && item.kind === 'gap')
    || typeof value.truncated !== 'boolean' || typeof value.overflow !== 'boolean' || !layoutIdentityValid({ descriptorIdentity: value.descriptorIdentity, atlasIdentity: value.atlasIdentity }, expected)
    || value.evidenceState !== 'provisional-until-game-parity' || (value.truthGrade !== 'source-backed-provisional' && value.truthGrade !== 'provisional-until-game-parity')
    || !isRecord(value.evidence) || !exactKeys(value.evidence, ['metrics', 'wrapAndTruncationPolicy', 'gameParity']) || value.evidence.metrics !== 'exact-source-backed' || value.evidence.wrapAndTruncationPolicy !== 'provisional-until-game-parity' || value.evidence.gameParity !== 'not-verified') return false;
  return true;
};

const sceneColumnValid = (value: unknown, sourceOrder: number): boolean =>
  isRecord(value) && exactKeys(value, ['index', 'x', 'width', 'fixedWidth', 'sourceOrder', 'provenanceLinks'])
  && isSafeInteger(value.index, 1) && ['x', 'width', 'fixedWidth'].every(key => isFiniteSafe(value[key]))
  && value.sourceOrder === sourceOrder && Array.isArray(value.provenanceLinks) && value.provenanceLinks.every(provenanceLinkValid);

const sceneScrollbarValid = (value: unknown): boolean =>
  isRecord(value) && exactKeys(value, ['rect', 'clipRect', 'provenanceLinks', 'diagnosticStyle'])
  && rectValid(value.rect) && rectValid(value.clipRect) && Array.isArray(value.provenanceLinks) && value.provenanceLinks.every(provenanceLinkValid) && diagnosticStyleValid(value.diagnosticStyle);

const sceneViewStateValid = (value: unknown): boolean =>
  isRecord(value) && exactKeys(value, [], ['topRow', 'scrollOffset', 'selectedRow'])
  && (value.topRow === undefined || isSafeInteger(value.topRow, 1))
  && (value.scrollOffset === undefined || isDimension(value.scrollOffset))
  && (value.selectedRow === undefined || isSafeInteger(value.selectedRow, 0));

const frameTextureLayerValid = (value: unknown, index: number): boolean => {
  if (!isRecord(value)
    || !exactKeys(value, [
      'name', 'source', 'sourceOrder', 'operationIds', 'descriptorFacts', 'applicability',
      'provenanceLinks', 'diagnosticLinks', 'gameVerification',
    ], ['icon', 'effectiveWidth', 'effectiveHeight', 'reason'])) return false;
  const expectedName = ['background', 'background2', 'overlay'][index];
  return value.name === expectedName
    && sourceValid(value.source)
    && value.sourceOrder === (((value.source as unknown as JsonRecord).start as JsonRecord).offset)
      && isSafeInteger(value.sourceOrder)
    && stringArrayValid(value.operationIds)
    && isRecord(value.descriptorFacts)
    && ['inactive', 'active-unresolved', 'active-source-known'].includes(String(value.applicability))
    && (value.icon === undefined || typeof value.icon === 'string')
    && (value.effectiveWidth === undefined || isDimension(value.effectiveWidth))
    && (value.effectiveHeight === undefined || isDimension(value.effectiveHeight))
    && Array.isArray(value.provenanceLinks) && value.provenanceLinks.every(provenanceLinkValid)
    && stringArrayValid(value.diagnosticLinks)
    && value.gameVerification === X4_UI_SCENE_GAME_TRUTH
    && (value.reason === undefined || typeof value.reason === 'string');
};

const frameTextureLayersValid = (value: unknown): boolean =>
  Array.isArray(value) && value.length === 3 && value.every(frameTextureLayerValid);

const frameBackdropValid = (value: unknown): boolean => {
  if (!isRecord(value)
    || !exactKeys(value, [
      'blurBackgroundFact', 'availability', 'reason', 'source', 'provenanceLinks', 'diagnosticLinks', 'gameVerification',
    ], ['blurBackground'])) return false;
  return (value.blurBackground === undefined || typeof value.blurBackground === 'boolean')
    && isRecord(value.blurBackgroundFact)
    && ['unavailable', 'disabled'].includes(String(value.availability))
    && typeof value.reason === 'string'
    && sourceValid(value.source)
    && Array.isArray(value.provenanceLinks) && value.provenanceLinks.every(provenanceLinkValid)
    && stringArrayValid(value.diagnosticLinks)
    && value.gameVerification === X4_UI_SCENE_GAME_TRUTH;
};

const sceneProfileValid = (profile: unknown): boolean => {
  if (!isRecord(profile) || !exactKeys(profile, ['id', 'provenance', 'source', 'helper', 'widget', 'fonts', 'drawable', 'textPolicy'], ['tableView'])
    || typeof profile.id !== 'string' || profile.id.length === 0 || typeof profile.provenance !== 'string' || profile.provenance.length === 0
    || !modelIdentityValid(profile.source) || !isRecord(profile.helper) || !exactKeys(profile.helper, ['sourcePath', 'sha256']) || typeof profile.helper.sourcePath !== 'string' || profile.helper.sourcePath.length === 0 || !/^[0-9A-Fa-f]{64}$/.test(String(profile.helper.sha256))
    || !isRecord(profile.widget) || !exactKeys(profile.widget, ['sourcePath', 'sha256']) || typeof profile.widget.sourcePath !== 'string' || profile.widget.sourcePath.length === 0 || !/^[0-9A-Fa-f]{64}$/.test(String(profile.widget.sha256))
    || !isRecord(profile.fonts) || !exactKeys(profile.fonts, ['Zekton', 'Zekton Bold']) || !isRecord(profile.drawable) || !exactKeys(profile.drawable, ['width', 'height'])
    || !isDimension(profile.drawable.width) || !isDimension(profile.drawable.height) || profile.drawable.width <= 0 || profile.drawable.height <= 0
    || !isRecord(profile.textPolicy) || !exactKeys(profile.textPolicy, ['nominalDesignSize', 'lineSpacing', 'wrapMode', 'truncationMode', 'whitespacePolicy', 'ellipsisPolicy', 'newlinePolicy', 'truthGrade', 'evidenceState'])
    || profile.textPolicy.nominalDesignSize !== 32 || !isDimension(profile.textPolicy.lineSpacing) || !['no-wrap', 'word-wrap', 'greedy-word', 'none'].includes(String(profile.textPolicy.wrapMode))
    || !['none', 'ellipsis'].includes(String(profile.textPolicy.truncationMode)) || !isRecord(profile.textPolicy.whitespacePolicy) || !exactKeys(profile.textPolicy.whitespacePolicy, ['mode', 'breakOn'])
    || !['preserve', 'trim-at-wrap'].includes(String(profile.textPolicy.whitespacePolicy.mode)) || !['ascii-space', 'unicode-space'].includes(String(profile.textPolicy.whitespacePolicy.breakOn))
    || !isRecord(profile.textPolicy.ellipsisPolicy) || !exactKeys(profile.textPolicy.ellipsisPolicy, ['token', 'placement']) || typeof profile.textPolicy.ellipsisPolicy.token !== 'string' || profile.textPolicy.ellipsisPolicy.placement !== 'end'
    || !['lf-crlf', 'lf-crlf-and-cr'].includes(String(profile.textPolicy.newlinePolicy)) || (profile.textPolicy.truthGrade !== 'source-backed-provisional' && profile.textPolicy.truthGrade !== 'provisional-until-game-parity')
    || profile.textPolicy.evidenceState !== 'provisional-until-game-parity') return false;
  for (const name of ['Zekton', 'Zekton Bold'] as const) {
    const pin = profile.fonts[name];
    if (!isRecord(pin) || !exactKeys(pin, ['descriptor', 'atlas']) || !sameIdentity(pin.descriptor, ZEKTON_CORPUS_ASSETS[name === 'Zekton' ? 'regular' : 'bold'].descriptor) || !sameIdentity(pin.atlas, ZEKTON_CORPUS_ASSETS[name === 'Zekton' ? 'regular' : 'bold'].atlas)) return false;
  }
  if (profile.tableView !== undefined) {
    if (!isRecord(profile.tableView) || !Object.values(profile.tableView).every(sceneViewStateValid)) return false;
  }
  return true;
};

const sceneNodeShapeValid = (node: unknown): node is Node => {
  if (!isRecord(node) || typeof node.kind !== 'string') return false;
  const baseRequired = ['id', 'kind', 'source', 'sourceOrder', 'completeness', 'provenance', 'provenanceLinks', 'diagnosticLinks', 'diagnosticStyle'];
  const baseOptional = ['parentId', 'zOrder', 'rect', 'clipRect', 'colorFacts'];
  const baseShapeValid = typeof node.id === 'string' && node.id.length > 0 && sourceValid(node.source) && node.sourceOrder === node.source.start.offset
    && ['complete', 'partial', 'unavailable'].includes(String(node.completeness)) && ['source-derived', 'font-metrics', 'preview-only', 'unavailable'].includes(String(node.provenance))
    && Array.isArray(node.provenanceLinks) && node.provenanceLinks.every(provenanceLinkValid) && stringArrayValid(node.diagnosticLinks) && diagnosticStyleValid(node.diagnosticStyle)
    && (node.parentId === undefined || (typeof node.parentId === 'string' && node.parentId.length > 0))
    && (node.zOrder === undefined || isFiniteSafe(node.zOrder))
    && (node.rect === undefined || rectValid(node.rect)) && (node.clipRect === undefined || rectValid(node.clipRect))
    && (node.colorFacts === undefined || Array.isArray(node.colorFacts) && (node.kind !== 'text' || node.colorFacts.length <= 1) && node.colorFacts.every(sceneColorFactValid));
  if (!baseShapeValid) return false;
  if (node.colorFacts !== undefined && !['table', 'cell', 'button', 'editbox', 'icon', 'text'].includes(node.kind)) return false;
  const sourceOrderValue = (node.source as X4UiSceneSourceLocation).start.offset;
  const widgetShapeValid = (): boolean => exactKeys(node, [...baseRequired, 'cellId', 'textIds'], [...baseOptional, 'primaryContent', 'iconIdentity', 'configuredActive', 'outerRect', 'editboxConfigBorder', 'editboxBlackInset', 'editboxTextBorder', 'editboxPreviewInputState'])
    && typeof node.cellId === 'string' && stringArrayValid(node.textIds) && (node.primaryContent === undefined || typeof node.primaryContent === 'string') && (node.iconIdentity === undefined || typeof node.iconIdentity === 'string')
    && (node.configuredActive === undefined || typeof node.configuredActive === 'boolean') && (node.outerRect === undefined || rectValid(node.outerRect))
    && (node.editboxConfigBorder === undefined || node.kind === 'editbox' && node.editboxConfigBorder === 1)
    && (node.editboxBlackInset === undefined || node.kind === 'editbox' && isSafeInteger(node.editboxBlackInset, 2) && node.editboxBlackInset <= 1_000_000)
    && (node.editboxTextBorder === undefined || node.kind === 'editbox' && node.editboxTextBorder === 2)
    && (node.editboxPreviewInputState === undefined || node.kind === 'editbox' && ['source-initial-inactive', 'runtime-unknown'].includes(String(node.editboxPreviewInputState)));
  switch (node.kind) {
    case 'frame':
      return exactKeys(node, [...baseRequired, 'tableIds'], [...baseOptional, 'layer', 'frameTextureLayers', 'backdrop'])
        && stringArrayValid(node.tableIds)
        && (node.layer === undefined || isFiniteSafe(node.layer))
        && (node.frameTextureLayers === undefined || frameTextureLayersValid(node.frameTextureLayers))
        && (node.backdrop === undefined || frameBackdropValid(node.backdrop));
    case 'table':
      {
        const backgroundId = ownDataField(node, 'backgroundId');
        return exactKeys(node, [...baseRequired, 'rowIds'], [...baseOptional, 'backgroundId', 'frameId', 'columns', 'fixedColumns', 'fullHeight', 'visibleHeight', 'maxVisibleHeight', 'descriptorHasScrollBar', 'scrollbarEvidence', 'reserveScrollBar', 'viewportRect', 'scrollbar', 'viewState'])
        && stringArrayValid(node.rowIds) && (node.frameId === undefined || typeof node.frameId === 'string')
        && (!backgroundId.present || backgroundId.valid && typeof backgroundId.value === 'string')
        && (node.columns === undefined || Array.isArray(node.columns) && node.columns.every(item => sceneColumnValid(item, sourceOrderValue)))
        && (node.fixedColumns === undefined || Array.isArray(node.fixedColumns) && node.fixedColumns.every(item => sceneColumnValid(item, sourceOrderValue)))
        && ['fullHeight', 'visibleHeight', 'maxVisibleHeight'].every(key => node[key] === undefined || isDimension(node[key]))
        && (node.descriptorHasScrollBar === undefined || typeof node.descriptorHasScrollBar === 'boolean')
        && (node.scrollbarEvidence === undefined || isRecord(node.scrollbarEvidence) && exactKeys(node.scrollbarEvidence, ['descriptor', 'runtime']) && node.scrollbarEvidence.descriptor === 'helper-derived' && node.scrollbarEvidence.runtime === 'unavailable')
        && (node.reserveScrollBar === undefined || typeof node.reserveScrollBar === 'boolean') && (node.viewportRect === undefined || rectValid(node.viewportRect))
        && (node.scrollbar === undefined || sceneScrollbarValid(node.scrollbar)) && (node.viewState === undefined || sceneViewStateValid(node.viewState));
      }
    case 'row':
      return exactKeys(node, [...baseRequired, 'tableId', 'cellIds'], [...baseOptional, 'rowIndex', 'fixed', 'visible', 'paddingTop', 'paddingBottom', 'borderBelow', 'naturalRect'])
        && (node.tableId === undefined || typeof node.tableId === 'string') && stringArrayValid(node.cellIds)
        && (node.rowIndex === undefined || isSafeInteger(node.rowIndex, 1)) && (node.fixed === undefined || typeof node.fixed === 'boolean') && (node.visible === undefined || typeof node.visible === 'boolean')
        && (node.paddingTop === undefined || isFiniteSafe(node.paddingTop)) && (node.paddingBottom === undefined || isFiniteSafe(node.paddingBottom)) && (node.borderBelow === undefined || typeof node.borderBelow === 'boolean') && (node.naturalRect === undefined || rectValid(node.naturalRect));
    case 'cell':
      return exactKeys(node, [...baseRequired, 'tableId', 'rowId', 'column', 'widgetIds'], [...baseOptional, 'rowIndex', 'span', 'hidden', 'naturalRect'])
        && (node.tableId === undefined || typeof node.tableId === 'string') && (node.rowId === undefined || typeof node.rowId === 'string') && isSafeInteger(node.column, 1) && stringArrayValid(node.widgetIds)
        && (node.rowIndex === undefined || isSafeInteger(node.rowIndex, 1)) && (node.span === undefined || isSafeInteger(node.span, 0)) && (node.hidden === undefined || typeof node.hidden === 'boolean') && (node.naturalRect === undefined || rectValid(node.naturalRect));
    case 'text':
      if (Object.prototype.hasOwnProperty.call(node, 'cellId')) return widgetShapeValid();
      return exactKeys(node, [...baseRequired, 'widgetId', 'slot', 'contentSelection', 'lines', 'textGaps', 'evidence'], [...baseOptional, 'content', 'defaultContent', 'description', 'editboxPreviewInputState', 'editboxTextBorder', 'font', 'fontSize', 'alignment', 'offsetX', 'offsetY', 'availableWidth', 'layout'])
        && (node.widgetId === undefined || typeof node.widgetId === 'string') && ['primary', 'secondary'].includes(String(node.slot)) && ['current', 'preview-default', 'runtime-choice-unavailable', 'unavailable'].includes(String(node.contentSelection))
        && Array.isArray(node.lines) && node.lines.every(line => isRecord(line) && exactKeys(line, ['lineIndex', 'displayedText', 'rect', 'completeness', 'diagnosticLinks', 'width', 'sourceRange', 'sourceCodePointRange', 'breakReason', 'truncated', 'overflow', 'glyphIds']) && isSafeInteger(line.lineIndex, 0) && typeof line.displayedText === 'string' && rectValid(line.rect) && ['complete', 'partial', 'unavailable'].includes(String(line.completeness)) && stringArrayValid(line.diagnosticLinks) && isFiniteSafe(line.width) && sourceRangeValid(line.sourceRange) && sourceRangeValid(line.sourceCodePointRange) && typeof line.breakReason === 'string' && typeof line.truncated === 'boolean' && typeof line.overflow === 'boolean' && stringArrayValid(line.glyphIds))
        && stringArrayValid(node.textGaps) && isRecord(node.evidence) && exactKeys(node.evidence, ['metrics', 'wrapAndTruncationPolicy', 'gameParity']) && (node.evidence.metrics === 'exact-source-backed' || node.evidence.metrics === 'unavailable') && node.evidence.wrapAndTruncationPolicy === 'provisional-until-game-parity' && node.evidence.gameParity === 'not-verified'
        && (node.content === undefined || typeof node.content === 'string') && (node.defaultContent === undefined || typeof node.defaultContent === 'string') && (node.description === undefined || typeof node.description === 'string')
        && (node.font === undefined || node.font === 'Zekton' || node.font === 'Zekton Bold') && (node.fontSize === undefined || isDimension(node.fontSize)) && (node.alignment === undefined || ['left', 'center', 'right'].includes(String(node.alignment)))
        && (node.editboxPreviewInputState === undefined || ['source-initial-inactive', 'runtime-unknown'].includes(String(node.editboxPreviewInputState)))
        && (node.editboxTextBorder === undefined || node.editboxTextBorder === 2)
        && (node.offsetX === undefined || isFiniteSafe(node.offsetX)) && (node.offsetY === undefined || isFiniteSafe(node.offsetY)) && (node.availableWidth === undefined || isDimension(node.availableWidth))
        && (node.layout === undefined || textLayoutValid(node.layout, node.font === 'Zekton Bold' ? ZEKTON_CORPUS_ASSETS.bold : ZEKTON_CORPUS_ASSETS.regular));
    case 'button':
    case 'editbox':
    case 'icon':
      return widgetShapeValid();
    case 'glyph':
      return exactKeys(node, [...baseRequired, 'textId', 'lineIndex', 'sourceRange', 'sourceCodePointRange', 'codePoint', 'glyphIndex', 'quad'], [...baseOptional])
        && typeof node.textId === 'string' && isSafeInteger(node.lineIndex, 0) && sourceRangeValid(node.sourceRange) && sourceRangeValid(node.sourceCodePointRange) && isSafeInteger(node.codePoint, 0) && isSafeInteger(node.glyphIndex, 1)
        && isRecord(node.quad) && exactKeys(node.quad, ['x', 'y', 'width', 'height', 'bitmapHeight', 'lineBoxY', 'lineBoxHeight', 'bearingX', 'bitmapWidth', 'advance', 'scaledAdvance', 'bitmapBounds', 'uv', 'isEllipsis'])
        && ['x', 'y', 'width', 'height', 'bitmapHeight', 'lineBoxY', 'lineBoxHeight', 'bearingX', 'bitmapWidth', 'advance', 'scaledAdvance'].every(key => isFiniteSafe((node.quad as JsonRecord)[key]))
        && finiteRecord((node.quad as JsonRecord).bitmapBounds, ['left', 'top', 'right', 'bottom']) && finiteRecord((node.quad as JsonRecord).uv, ['u0', 'v0', 'u1', 'v1']) && typeof (node.quad as JsonRecord).isEllipsis === 'boolean';
    default:
      return false;
  }
};

const SCENE_GAP_CATEGORIES = new Set(['profile', 'target', 'source', 'analysis', 'data-flow', 'frame', 'table', 'row', 'cell', 'count', 'index', 'span', 'width', 'percentage', 'height', 'options', 'constant', 'scale', 'sample', 'local-expansion', 'preview-path', 'text', 'parse', 'unsupported', 'layer', 'menu', 'edit-box', 'fontsize', 'property', 'number', 'geometry', 'fixed-section', 'clip', 'scrollbar', 'font', 'paint', 'texture', 'state', 'widget', 'program-node', 'operation', 'kernel', 'backdrop']);

const sceneGapValid = (value: unknown): boolean =>
  isRecord(value) && exactKeys(value, ['id', 'category', 'status', 'reason', 'source'], ['expression', 'sourcePin', 'operationId', 'nodeId', 'previewOnly', 'textRange', 'lineIndex'])
  && typeof value.id === 'string' && value.id.length > 0 && SCENE_GAP_CATEGORIES.has(String(value.category)) && ['unknown', 'incomplete', 'unsupported', 'refused'].includes(String(value.status)) && typeof value.reason === 'string' && value.reason.length > 0 && sourceValid(value.source)
  && (value.expression === undefined || typeof value.expression === 'string') && (value.sourcePin === undefined || sourcePinValid(value.sourcePin)) && (value.operationId === undefined || typeof value.operationId === 'string') && (value.nodeId === undefined || typeof value.nodeId === 'string')
  && (value.previewOnly === undefined || typeof value.previewOnly === 'boolean') && (value.textRange === undefined || sourceRangeValid(value.textRange)) && (value.lineIndex === undefined || isSafeInteger(value.lineIndex, 0));

const sameStringArray = (left: unknown, right: readonly string[]): boolean =>
  Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);

const scenePreviewValid = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['provenance', 'sampleBindings', 'pathSelections'])
  && value.provenance === 'preview-only'
  && Array.isArray(value.sampleBindings)
  && Array.isArray(value.pathSelections)
  && jsonDomain(value.sampleBindings)
  && jsonDomain(value.pathSelections);

const layoutQuadMatchesGlyph = (layoutQuad: JsonRecord, glyph: X4UiSceneGlyphNode): boolean => {
  const exactFields = ['codePoint', 'glyphIndex', 'width', 'height', 'bitmapHeight', 'lineBoxHeight', 'bearingX', 'bitmapWidth', 'advance', 'scaledAdvance', 'isEllipsis'];
  const valid = exactFields.every(field => Object.is(layoutQuad[field], field === 'codePoint' ? glyph.codePoint : field === 'glyphIndex' ? glyph.glyphIndex : field === 'isEllipsis' ? glyph.quad.isEllipsis : (glyph.quad as unknown as JsonRecord)[field]))
    && sameStructuralValue(layoutQuad.sourceRange, glyph.sourceRange)
    && sameStructuralValue(layoutQuad.sourceCodePointRange, glyph.sourceCodePointRange)
    && sameStructuralValue(layoutQuad.bitmapBounds, glyph.quad.bitmapBounds)
    && sameStructuralValue(layoutQuad.uv, glyph.quad.uv);
  return valid;
};

const sceneTextLayoutConsistent = (text: X4UiSceneTextNode, glyphsById: Map<string, X4UiSceneGlyphNode>): boolean => {
  if (text.layout === undefined) return text.lines.every(line => line.glyphIds.length === 0);
  if (text.font === undefined || !isRecord(text.layout) || !Array.isArray(text.layout.lines)) return false;
  const layoutLines = text.layout.lines as readonly unknown[];
  if (layoutLines.length !== text.lines.length) return false;
  for (const line of text.lines) {
    const layoutLine = layoutLines.find(candidate => isRecord(candidate) && candidate.lineIndex === line.lineIndex);
    if (!isRecord(layoutLine)
      || layoutLine.displayedText !== line.displayedText
      || !sameStructuralValue(layoutLine.sourceRange, line.sourceRange)
      || !sameStructuralValue(layoutLine.sourceCodePointRange, line.sourceCodePointRange)
      || layoutLine.breakReason !== line.breakReason
      || !Object.is(layoutLine.width, line.width)
      || layoutLine.truncated !== line.truncated
      || layoutLine.overflow !== line.overflow
      || !Array.isArray(layoutLine.glyphQuads)
      || layoutLine.glyphQuads.length !== line.glyphIds.length) return false;
    if (!isRecord(layoutLine.lineBox) || !isFiniteSafe(layoutLine.lineBox.x) || !isFiniteSafe(layoutLine.lineBox.y) || !isFiniteSafe(layoutLine.lineBox.height)
      || !Object.is(line.rect.width, layoutLine.width)
      || !Object.is(line.rect.height, layoutLine.lineBox.height)) return false;
    const xBase = line.rect.x - (layoutLine.lineBox.x as number);
    const yBase = line.rect.y - (layoutLine.lineBox.y as number);
    for (const [index, glyphId] of line.glyphIds.entries()) {
      const glyph = glyphsById.get(glyphId);
      const layoutQuad = layoutLine.glyphQuads[index];
      if (!glyph || !isRecord(layoutQuad) || glyph.textId !== text.id || glyph.lineIndex !== line.lineIndex || !layoutQuadMatchesGlyph(layoutQuad, glyph)
        || !Object.is(glyph.quad.x, xBase + Number(layoutQuad.x))
        || !Object.is(glyph.quad.y, yBase + Number(layoutQuad.y))
        || !Object.is(glyph.quad.lineBoxY, yBase + Number(layoutQuad.lineBoxY))) return false;
    }
  }
  return true;
};

const sceneValid = (scene: X4UiScene, corpus: X4UiCorpusCanonicalSuccess): boolean => {
  if (!jsonDomain(scene) || !noEnginePaintTruth(scene) || !exactKeys(scene as unknown as JsonRecord, ['format', 'version', 'status', 'gameTruth', 'profile', 'programStatus', 'drawableRect', 'frames', 'tables', 'rows', 'cells', 'widgets', 'texts', 'glyphs', 'gaps', 'preview', 'diagnosticStyle', 'verification'])
    || scene.format !== X4_UI_SCENE_FORMAT || scene.version !== X4_UI_SCENE_VERSION
    || (scene.status !== 'projected' && scene.status !== 'partial') || (scene.programStatus !== 'projected' && scene.programStatus !== 'partial')
    || scene.gameTruth !== X4_UI_SCENE_GAME_TRUTH || !isRecord(scene.verification) || !exactKeys(scene.verification, ['game', 'gameVerified']) || scene.verification.game !== X4_UI_SCENE_GAME_TRUTH || scene.verification.gameVerified !== false
    || !rectValid(scene.drawableRect) || scene.drawableRect.x !== 0 || scene.drawableRect.y !== 0 || scene.drawableRect.width <= 0 || scene.drawableRect.height <= 0
    || !sceneProfileValid(scene.profile) || !profileMatchesCorpus(scene, corpus) || !scenePreviewValid(scene.preview) || !diagnosticStyleValid(scene.diagnosticStyle)) return false;
  const collections: readonly (readonly Node[])[] = [scene.frames, scene.tables, scene.rows, scene.cells, scene.widgets, scene.texts, scene.glyphs];
  if (!collections.every(Array.isArray)) return false;
  const nodes = collections.flat();
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!sceneNodeShapeValid(node) || ids.has(node.id)
      || node.source.file !== scene.profile.source.file || node.source.sourcePath !== scene.profile.source.sourcePath) return false;
    ids.add(node.id);
  }
  const byId = new Map(nodes.map(node => [node.id, node]));
  const expectedKinds: readonly [readonly Node[], string | readonly string[]][] = [
    [scene.frames, 'frame'],
    [scene.tables, 'table'],
    [scene.rows, 'row'],
    [scene.cells, 'cell'],
    [scene.widgets, ['text', 'button', 'editbox', 'icon']],
    [scene.texts, 'text'],
    [scene.glyphs, 'glyph'],
  ];
  for (const [collection, kind] of expectedKinds) {
    if (collection.some(node => Array.isArray(kind) ? !kind.includes(String(node.kind)) : node.kind !== kind)) return false;
  }
  for (const node of nodes) {
    if (node.parentId !== undefined && !byId.has(node.parentId)) return false;
    if (node.clipRect !== undefined) {
      if (!rectValid(node.clipRect)
        || node.clipRect.x < 0 || node.clipRect.y < 0
        || node.clipRect.x + node.clipRect.width > scene.drawableRect.width
        || node.clipRect.y + node.clipRect.height > scene.drawableRect.height) return false;
    }
    const seen = new Set<string>();
    let current: Node | undefined = node;
    while (current?.parentId !== undefined) {
      if (seen.has(current.id)) return false;
      seen.add(current.id);
      current = byId.get(current.parentId);
    }
  }
  const frames = new Set(scene.frames.map(frame => frame.id));
  const tables = new Set(scene.tables.map(table => table.id));
  const rows = new Set(scene.rows.map(row => row.id));
  const cells = new Set(scene.cells.map(cell => cell.id));
  const widgets = new Set(scene.widgets.map(widget => widget.id));
  const texts = new Set(scene.texts.map(text => text.id));
  const glyphs = new Set(scene.glyphs.map(glyph => glyph.id));
  for (const frame of scene.frames) {
    if (frame.parentId !== undefined || !sameStringArray(frame.tableIds, scene.tables.filter(table => table.frameId === frame.id && table.parentId === frame.id).map(table => table.id))) return false;
  }
  for (const table of scene.tables) {
    if (table.frameId === undefined) {
      if (table.parentId !== undefined) return false;
    } else if (!frames.has(table.frameId) || table.parentId !== table.frameId) return false;
    if (!sameStringArray(table.rowIds, scene.rows.filter(row => row.tableId === table.id && row.parentId === table.id).map(row => row.id))) return false;
  }
  for (const row of scene.rows) {
    if (row.tableId === undefined) {
      if (row.parentId !== undefined || row.cellIds.length !== 0) return false;
    } else if (!tables.has(row.tableId) || row.parentId !== row.tableId) return false;
    if (!sameStringArray(row.cellIds, scene.cells.filter(cell => cell.rowId === row.id && cell.parentId === row.id).map(cell => cell.id))) return false;
  }
  for (const cell of scene.cells) {
    if (cell.tableId !== undefined && !tables.has(cell.tableId)) return false;
    if (cell.rowId === undefined) {
      if (cell.parentId !== undefined || cell.widgetIds.length !== 0) return false;
    } else if (cell.tableId === undefined || !rows.has(cell.rowId) || cell.parentId !== cell.rowId) return false;
    if (!sameStringArray(cell.widgetIds, scene.widgets.filter(widget => widget.cellId === cell.id && widget.parentId === cell.id).map(widget => widget.id))) return false;
  }
  for (const widget of scene.widgets) {
    if (widget.cellId === undefined) {
      if (widget.parentId !== undefined || widget.textIds.length !== 0) return false;
    } else if (!cells.has(widget.cellId) || widget.parentId !== widget.cellId) return false;
    if (!sameStringArray(widget.textIds, scene.texts.filter(text => text.widgetId === widget.id && text.parentId === widget.id).map(text => text.id))) return false;
  }
  const glyphsById = new Map(scene.glyphs.map(glyph => [glyph.id, glyph]));
  for (const text of scene.texts) {
    if (text.widgetId === undefined) {
      if (text.parentId !== undefined || text.lines.some(line => line.glyphIds.length > 0)) return false;
    } else if (!widgets.has(text.widgetId) || text.parentId !== text.widgetId) return false;
    if (!sceneTextLayoutConsistent(text, glyphsById)) return false;
    for (const line of text.lines) {
      if (line.glyphIds.some(id => !glyphs.has(id))) return false;
      if (!sameStringArray(line.glyphIds, scene.glyphs.filter(glyph => glyph.textId === text.id && glyph.parentId === text.id && glyph.lineIndex === line.lineIndex).map(glyph => glyph.id))) return false;
    }
  }
  for (const glyph of scene.glyphs) {
    if (!texts.has(glyph.textId) || glyph.parentId !== glyph.textId || !isSafeInteger(glyph.lineIndex, 0) || !isSafeInteger(glyph.codePoint, 0) || !isSafeInteger(glyph.glyphIndex, 1)) return false;
  }
  if (!Array.isArray(scene.gaps) || !scene.gaps.every(sceneGapValid)) return false;
  const gapIds = new Set<string>();
  let previousGapOffset = -1;
  for (const [index, gap] of scene.gaps.entries()) {
    if (gapIds.has(gap.id) || gap.id !== `scene-gap:${String(index).padStart(6, '0')}` || gap.source.start.offset < previousGapOffset) return false;
    gapIds.add(gap.id);
    previousGapOffset = gap.source.start.offset;
    if (gap.source.file !== scene.profile.source.file || gap.source.sourcePath !== scene.profile.source.sourcePath) return false;
  }
  const validFonts = fontAssetsValid(corpus.fonts.regular, ZEKTON_CORPUS_ASSETS.regular) && fontAssetsValid(corpus.fonts.bold, ZEKTON_CORPUS_ASSETS.bold);
  return validFonts;
};

const nodeById = (scene: X4UiScene): Map<string, Node> => new Map([
  ...scene.frames,
  ...scene.tables,
  ...scene.rows,
  ...scene.cells,
  ...scene.widgets,
  ...scene.texts,
  ...scene.glyphs,
].map(node => [node.id, node as Node]));

const frameIdFor = (node: Node, byId: Map<string, Node>): string | undefined => {
  const visited = new Set<string>();
  let current: Node | undefined = node;
  while (current !== undefined) {
    if (visited.has(current.id)) return undefined;
    visited.add(current.id);
    if (current.kind === 'frame') return current.id;
    if (current.parentId !== undefined) {
      current = byId.get(current.parentId);
      continue;
    }
    else if (current.kind === 'table' && typeof (current as unknown as JsonRecord).frameId === 'string') current = byId.get((current as unknown as JsonRecord).frameId as string);
    else if (current.kind === 'row' && typeof (current as unknown as JsonRecord).tableId === 'string') current = byId.get((current as unknown as JsonRecord).tableId as string);
    else if (current.kind === 'cell' && typeof (current as unknown as JsonRecord).rowId === 'string') current = byId.get((current as unknown as JsonRecord).rowId as string);
    else if (['button', 'editbox', 'icon'].includes(String(current.kind)) && typeof (current as unknown as JsonRecord).cellId === 'string') current = byId.get((current as unknown as JsonRecord).cellId as string);
    else if (current.kind === 'text' && typeof (current as unknown as JsonRecord).widgetId === 'string') current = byId.get((current as unknown as JsonRecord).widgetId as string);
    else if (current.kind === 'glyph' && typeof (current as unknown as JsonRecord).textId === 'string') current = byId.get((current as unknown as JsonRecord).textId as string);
    else current = undefined;
  }
  return undefined;
};

const clipFor = (node: Node, byId: Map<string, Node>, drawable: X4UiSceneRect): X4UiSceneRect | undefined => {
  let clip = rectCopy(drawable);
  const visited = new Set<string>();
  let current: Node | undefined = node;
  while (current !== undefined) {
    if (visited.has(current.id)) return undefined;
    visited.add(current.id);
    if (rectValid(current.clipRect)) clip = intersect(clip, current.clipRect);
    current = current.parentId === undefined ? undefined : byId.get(current.parentId);
  }
  return clip;
};

const orderedNodes = (scene: X4UiScene, byId: Map<string, Node>): readonly Node[] => {
  const nodeZOrder = (node: Node): number => node.zOrder ?? 0;
  const frameLayer = (node: Node): number => {
    const frameId = frameIdFor(node, byId);
    const frame = frameId === undefined ? undefined : scene.frames.find(candidate => candidate.id === frameId);
    return frame?.layer ?? 0;
  };
  const compare = (left: Node, right: Node): number => frameLayer(left) - frameLayer(right)
    || nodeZOrder(left) - nodeZOrder(right)
    || left.sourceOrder - right.sourceOrder
    || left.id.localeCompare(right.id);
  return [
    ...scene.frames,
    ...scene.tables,
    ...scene.rows,
    ...scene.cells,
    ...scene.widgets,
    ...scene.texts,
  ].sort(compare);
};

const orderedGlyphs = (scene: X4UiScene, byId: Map<string, Node>): readonly X4UiSceneGlyphNode[] => {
  const nodeZOrder = (node: Node): number => node.zOrder ?? 0;
  const frameLayer = (node: Node): number => {
    const frameId = frameIdFor(node, byId);
    const frame = frameId === undefined ? undefined : scene.frames.find(candidate => candidate.id === frameId);
    return frame?.layer ?? 0;
  };
  return [...scene.glyphs].sort((left, right) => frameLayer(left) - frameLayer(right)
    || nodeZOrder(left) - nodeZOrder(right)
    || left.sourceOrder - right.sourceOrder
    || left.id.localeCompare(right.id));
};

const diagnosticBase = (id: string, layer: X4UiPaintLayerKind, order: number, node: Node | undefined, frameId: string | undefined): PaintCommandBase => ({
  id,
  layer,
  order,
  ...(node === undefined ? {} : { nodeId: node.id, source: cloneSource(node.source) }),
  ...(frameId === undefined ? {} : { frameId }),
  gameTruth: X4_UI_PAINT_GAME_TRUTH,
  gameVerified: false,
});

const helperRuntimeAvailabilityGap = (gap: X4UiSceneGap | undefined): boolean => gap !== undefined
  && gap.category === 'data-flow'
  && gap.status === 'incomplete'
  && gap.reason === HELPER_RUNTIME_AVAILABILITY_GAP_REASON
  && gap.operationId !== undefined
  && gap.nodeId === undefined;

const nonvisualFrameGap = (gap: X4UiSceneGap, blurBackdropUnavailable: boolean): boolean =>
  helperRuntimeAvailabilityGap(gap)
  || blurBackdropUnavailable
    && gap.category === 'backdrop'
    && gap.status === 'unknown'
    && gap.reason === BLUR_BACKDROP_UNAVAILABLE_REASON;

const diagnosticSourceComposition = (
  scene: X4UiScene,
  node: Node | undefined,
  kind: X4UiPaintDiagnosticKind,
  gap?: X4UiSceneGap,
): 'visual' | 'diagnostic-only' => {
  if (kind === 'gap' && helperRuntimeAvailabilityGap(gap)) return 'diagnostic-only';
  if (node?.kind !== 'frame' || (kind !== 'gap' && kind !== 'unavailable-node')) return 'visual';
  const frame = node as unknown as JsonRecord;
  const layers = frame.frameTextureLayers;
  const backdrop = frame.backdrop;
  const allLayersInactive = Array.isArray(layers)
    && layers.length === 3
    && layers.every(layer => isRecord(layer) && layer.applicability === 'inactive' && layer.icon === '');
  const blurBackdropUnavailable = isRecord(backdrop)
    && backdrop.blurBackground === true
    && backdrop.availability === 'unavailable';
  if (!allLayersInactive) return 'visual';
  if (kind === 'gap') {
    if (gap !== undefined && nonvisualFrameGap(gap, blurBackdropUnavailable)) return 'diagnostic-only';
    return 'visual';
  }
  if (kind === 'unavailable-node' && frame.rect !== undefined) {
    const diagnosticLinks = frame.diagnosticLinks;
    const linkedGaps = Array.isArray(diagnosticLinks)
      ? scene.gaps.filter(candidate => diagnosticLinks.includes(candidate.id))
      : [];
    if (Array.isArray(diagnosticLinks)
      && linkedGaps.length === diagnosticLinks.length
      && linkedGaps.length > 0
      && linkedGaps.every(candidate => nonvisualFrameGap(candidate, blurBackdropUnavailable))) return 'diagnostic-only';
  }
  return 'visual';
};

const atlasBounds = (glyph: X4UiSceneGlyphNode, font: ZektonFontAssets): X4UiSceneRect | undefined => {
  const descriptor = font.descriptor;
  const record = descriptor.glyphRecords[glyph.glyphIndex - 1];
  if (!record || record.glyphIndex !== glyph.glyphIndex || descriptor.codePointToGlyphIndex[glyph.codePoint] !== glyph.glyphIndex) return undefined;
  const bounds = record.pixelBounds;
  const sceneBounds = glyph.quad.bitmapBounds;
  if (bounds.left !== sceneBounds.left || bounds.top !== sceneBounds.top || bounds.right !== sceneBounds.right || bounds.bottom !== sceneBounds.bottom) return undefined;
  if (bounds.left < 0 || bounds.top < 0 || bounds.right > font.atlas.width || bounds.bottom > font.atlas.height || bounds.right <= bounds.left || bounds.bottom <= bounds.top) return undefined;
  return { x: bounds.left, y: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top };
};

const clippedSource = (glyph: X4UiSceneGlyphNode, clip: X4UiSceneRect, source: X4UiSceneRect): { readonly destination: X4UiSceneRect; readonly source: X4UiSceneRect } | undefined => {
  const destination = intersect({ x: glyph.quad.x, y: glyph.quad.y, width: glyph.quad.width, height: glyph.quad.height }, clip);
  if (!hasArea(destination) || glyph.quad.width <= 0 || glyph.quad.height <= 0) return undefined;
  const dx = (destination.x - glyph.quad.x) / glyph.quad.width;
  const dy = (destination.y - glyph.quad.y) / glyph.quad.height;
  const dw = destination.width / glyph.quad.width;
  const dh = destination.height / glyph.quad.height;
  return {
    destination,
    source: {
      x: source.x + source.width * dx,
      y: source.y + source.height * dy,
      width: source.width * dw,
      height: source.height * dh,
    },
  };
};

const keepOutCommand = (input: X4UiPaintKeepOutInput, order: number, drawable: X4UiSceneRect): X4UiPaintKeepOutCommand | undefined => {
  const projection = input.projection;
  if (typeof input.context !== 'string' || input.context.trim().length === 0 || !isRecord(projection)) return undefined;
  const entry = input.entry;
  if (!isRecord(entry)) return undefined;
  const entryContext = entry.context;
  if (typeof entryContext !== 'string' || entryContext.trim().length === 0) return undefined;

  const source = isRecord(entry.provenance) ? entry.provenance.source : undefined;
  const entryId = entry.id;
  if (typeof entryId !== 'string' || entryId.trim().length === 0 || typeof source !== 'string') return undefined;
  if (source === 'production-evidence') {
    const builtIn = getBuiltInKeepOut(entryId as Parameters<typeof getBuiltInKeepOut>[0]);
    if (builtIn === undefined || !sameStructuralValue(entry, builtIn) || !PRESET_IDS.has(input.context)) return undefined;
    const preset = getKeepOutPreset(input.context as KeepOutContextPresetId);
    if (preset?.members.some(candidate => candidate.entryId === entryId) !== true) return undefined;
  } else if (source === 'manual-calibration') {
    if (input.context !== entryContext) return undefined;
  } else if (source !== 'manual-calibration') {
    return undefined;
  }

  const expected = projectKeepOut(entry, { width: drawable.width, height: drawable.height });
  if (expected.status === 'refused' || !sameStructuralValue(projection, expected)) return undefined;
  if (expected.status === 'unavailable') {
    if (expected.reason !== 'reference-unmeasured') return undefined;
    return {
      ...diagnosticBase(`keepout:${input.context}:${expected.entryId}`, 'keep-out-overlays', order, undefined, undefined),
      kind: 'keep-out',
      context: input.context,
      entryId: expected.entryId,
      status: 'unavailable',
      evidenceGrade: expected.evidenceGrade,
      advisoryOnly: true,
      gameVerification: NOT_VERIFIED_IN_GAME,
      geometry: null,
      reason: expected.reason,
    };
  }
  if (!isRecord(expected.geometry)) return undefined;
  if (expected.geometry.kind === 'horizontal-guide' && isFiniteSafe(expected.geometry.y)) {
    return {
      ...diagnosticBase(`keepout:${input.context}:${expected.entryId}`, 'keep-out-overlays', order, undefined, undefined),
      kind: 'keep-out',
      context: input.context,
      entryId: expected.entryId,
      status: 'projected',
      evidenceGrade: expected.evidenceGrade,
      advisoryOnly: true,
      gameVerification: NOT_VERIFIED_IN_GAME,
      geometry: { kind: 'horizontal-guide', y: expected.geometry.y },
    };
  }
  if (expected.geometry.kind === 'vertical-guide' && isFiniteSafe(expected.geometry.x)) {
    return {
      ...diagnosticBase(`keepout:${input.context}:${expected.entryId}`, 'keep-out-overlays', order, undefined, undefined),
      kind: 'keep-out',
      context: input.context,
      entryId: expected.entryId,
      status: 'projected',
      evidenceGrade: expected.evidenceGrade,
      advisoryOnly: true,
      gameVerification: NOT_VERIFIED_IN_GAME,
      geometry: { kind: 'vertical-guide', x: expected.geometry.x },
    };
  }
  if (expected.geometry.kind === 'polygon'
    && Array.isArray(expected.geometry.points)
    && expected.geometry.points.length >= 3
    && expected.geometry.points.every(point => isRecord(point) && isFiniteSafe(point.x) && isFiniteSafe(point.y))) {
    return {
      ...diagnosticBase(`keepout:${input.context}:${expected.entryId}`, 'keep-out-overlays', order, undefined, undefined),
      kind: 'keep-out',
      context: input.context,
      entryId: expected.entryId,
      status: 'projected',
      evidenceGrade: expected.evidenceGrade,
      advisoryOnly: true,
      gameVerification: NOT_VERIFIED_IN_GAME,
      geometry: { kind: 'polygon', points: expected.geometry.points.map(point => ({ x: point.x, y: point.y })) },
    };
  }
  return undefined;
};

const refuse = (code: X4UiPaintPlanRefusalCode, message: string): X4UiPaintPlanResult => freezeDeep({
  status: 'refused' as const,
  refusal: { code, message },
  gameTruth: X4_UI_PAINT_GAME_TRUTH,
  verification: VERIFICATION,
});

/** Project a validated Scene into deterministic logical paint commands. */
export function projectX4UiPaintPlan(input: X4UiPaintPlanInput): X4UiPaintPlanResult {
  try {
    if (!isRecord(input) || !exactOwnDataKeys(input, ['scene', 'corpus', 'previewAuthority'], ['keepOuts', 'selection'])) return refuse('invalid-input', 'paint plan requires scene, loader-issued canonical corpus evidence, and preview source authority');
    const sceneField = ownDataField(input, 'scene');
    const corpusField = ownDataField(input, 'corpus');
    const authorityField = ownDataField(input, 'previewAuthority');
    const keepOutField = ownDataField(input, 'keepOuts');
    const selectionField = ownDataField(input, 'selection');
    if (!sceneField.valid || !corpusField.valid || !authorityField.valid || sceneField.value === undefined || authorityField.value === undefined) return refuse('invalid-input', 'paint plan requires scene, loader-issued canonical corpus evidence, and preview source authority');
    if (!isX4UiCorpusCanonicalSuccess(corpusField.value)) return refuse('invalid-corpus', 'paint plan requires the loader-issued canonical corpus result');
    const corpus = corpusField.value;
    const scene = materializeX4UiPreviewPaintScene(authorityField.value, sceneField.value);
    if (scene === undefined) return refuse('invalid-scene', 'paint plan requires the issued preview source authority for this Scene');
    if (!sceneValid(scene, corpus)) return refuse('invalid-scene', 'Scene evidence is malformed, stale, cyclic, or carries engine/game paint truth');

    let keepOutInputs: readonly X4UiPaintKeepOutInput[] = [];
    if (keepOutField.present && keepOutField.value !== undefined) {
      const capturedKeepOuts = captureKeepOutAuthority(keepOutField.value);
      if (capturedKeepOuts === null) return refuse('invalid-keepout', 'keep-out entries require issued entry and projection authority');
      let materializedKeepOuts: unknown;
      try {
        materializedKeepOuts = freezeDeep(materializeCapturedKeepOuts(capturedKeepOuts));
      } catch {
        return refuse('invalid-keepout', 'keep-out inputs are malformed');
      }
      if (!jsonDomain(materializedKeepOuts)
        || !Array.isArray(materializedKeepOuts)
        || !materializedKeepOuts.every(value => isRecord(value)
          && exactKeys(value, ['context', 'entry', 'projection'])
          && typeof value.context === 'string'
          && value.context.trim().length > 0
          && isRecord(value.entry)
          && isRecord(value.projection))) return refuse('invalid-keepout', 'keep-out inputs are malformed');
      keepOutInputs = materializedKeepOuts as unknown as readonly X4UiPaintKeepOutInput[];
    }

    let selectionInput: X4UiPaintPlanSelection | undefined;
    if (selectionField.present && selectionField.value !== undefined) {
      let materializedSelection: unknown;
      try {
        materializedSelection = freezeDeep(materializePaintJsonDomain(selectionField.value));
      } catch {
        return refuse('invalid-selection', 'selection evidence is malformed');
      }
      if (!jsonDomain(materializedSelection)
        || !isRecord(materializedSelection)
        || !exactKeys(materializedSelection, [], ['nodeIds', 'source'])
        || materializedSelection.nodeIds !== undefined && !stringArrayValid(materializedSelection.nodeIds)
        || materializedSelection.source !== undefined && !sourceValid(materializedSelection.source)) return refuse('invalid-selection', 'selection evidence is malformed');
      selectionInput = materializedSelection as unknown as X4UiPaintPlanSelection;
    }
    const selectedNodeIds = selectionInput?.nodeIds === undefined ? [] : selectionInput.nodeIds.slice();
    const byId = nodeById(scene);
    if (new Set(selectedNodeIds).size !== selectedNodeIds.length || selectedNodeIds.some(id => !byId.has(id))) return refuse('invalid-selection', 'selection contains an unknown or duplicate node id');
    if (selectionInput?.source !== undefined && selectedNodeIds.some(id => !sameSourceLocation(selectionInput.source, byId.get(id)?.source))) return refuse('invalid-selection', 'selection source does not match every selected Scene node');
    const drawable = scene.drawableRect;
    const background: X4UiPaintCommand[] = [];
    const glyphs: X4UiPaintCommand[] = [];
    const diagnostics: X4UiPaintDiagnosticCommand[] = [];
    const keepOuts: X4UiPaintKeepOutCommand[] = [];
    let order = 0;
    for (const node of orderedNodes(scene, byId)) {
      const frameId = frameIdFor(node, byId);
      const geometry = rectForNode(node);
      const clip = clipFor(node, byId, drawable);
      if (clip === undefined) return refuse('invalid-clip', `node ${node.id} has a cyclic or invalid clip hierarchy`);
      const clippedGeometry = geometry === undefined ? undefined : intersect(geometry, clip);
      const drawableGeometry = clippedGeometry !== undefined && hasArea(clippedGeometry) ? clippedGeometry : undefined;
      const base = diagnosticBase(`geometry:${node.id}`, 'diagnostic-background', order++, node, frameId);
      const basePreviewTints = basePreviewTintsForNode(node);
      const editboxInner = previewInnerGeometryForEditBox(node, clip, basePreviewTints);
      const commandPreviewTints = editboxInner === undefined
        ? basePreviewTints.filter(tint => tint.slot !== 'editbox-inner-background')
        : basePreviewTints;
      background.push({
        ...base,
        ...(drawableGeometry === undefined ? {} : { clipRect: rectCopy(clip), geometry: rectCopy(drawableGeometry) }),
        ...(editboxInner === undefined ? {} : {
          innerGeometry: rectCopy(editboxInner.geometry),
          editboxComposition: editboxInner.evidence,
        }),
        ...(commandPreviewTints.length === 0 ? {} : { basePreviewTints: commandPreviewTints }),
        kind: 'node-geometry',
        completeness: node.completeness,
        style: geometry === undefined ? 'unavailable' : 'source-derived',
      });
      if (geometry !== undefined && drawableGeometry === undefined) {
        diagnostics.push({ ...diagnosticBase(`empty-clip:geometry:${node.id}`, 'diagnostics', order++, node, frameId), clipRect: rectCopy(clip), kind: 'empty-clip', sourceComposition: diagnosticSourceComposition(scene, node, 'empty-clip'), reason: 'node geometry has no drawable intersection with its accepted clip hierarchy' });
      }
      if (node.completeness !== 'complete' || geometry === undefined) {
        diagnostics.push({ ...diagnosticBase(`unavailable:${node.id}`, 'diagnostics', order++, node, frameId), ...(drawableGeometry === undefined ? {} : { clipRect: rectCopy(clip), geometry: rectCopy(drawableGeometry) }), kind: 'unavailable-node', sourceComposition: diagnosticSourceComposition(scene, node, 'unavailable-node'), reason: geometry === undefined ? 'node geometry unavailable' : `node completeness is ${node.completeness}` });
      }
      if (node.kind === 'button' || node.kind === 'editbox' || node.kind === 'icon') {
        diagnostics.push({ ...diagnosticBase(`runtime-paint:${node.id}`, 'diagnostics', order++, node, frameId), ...(drawableGeometry === undefined ? {} : { clipRect: rectCopy(clip), geometry: rectCopy(drawableGeometry) }), kind: 'unsupported-runtime-paint', sourceComposition: diagnosticSourceComposition(scene, node, 'unsupported-runtime-paint'), reason: 'runtime widget paint, texture, and interaction state are unavailable' });
      }
    }
    for (const glyph of orderedGlyphs(scene, byId)) {
      const text = scene.texts.find(candidate => candidate.id === glyph.textId);
      if (!text) return refuse('invalid-hierarchy', `glyph ${glyph.id} has no text parent`);
      const node = glyph as unknown as Node;
      const clip = clipFor(node, byId, drawable);
      if (clip === undefined) return refuse('invalid-clip', `glyph ${glyph.id} has a cyclic or invalid clip hierarchy`);
      const fontName = fontNameForText(text);
      if (fontName === undefined) {
        diagnostics.push({ ...diagnosticBase(`raster-font:${glyph.id}`, 'diagnostics', order++, node, frameIdFor(node, byId)), kind: 'invalid-raster-candidate', sourceComposition: diagnosticSourceComposition(scene, node, 'invalid-raster-candidate'), reason: 'text font evidence is unavailable' });
        continue;
      }
      const font = fontName === 'Zekton' ? corpus.fonts.regular : corpus.fonts.bold;
      const source = atlasBounds(glyph, font);
      if (source === undefined) return refuse('invalid-atlas', `glyph ${glyph.id} does not match the canonical descriptor atlas bounds`);
      const clipped = clippedSource(glyph, clip, source);
      if (clipped === undefined) {
        diagnostics.push({ ...diagnosticBase(`empty-clip:${glyph.id}`, 'diagnostics', order++, node, frameIdFor(node, byId)), kind: 'empty-clip', sourceComposition: diagnosticSourceComposition(scene, node, 'empty-clip'), reason: 'glyph has no drawable intersection with its accepted clip hierarchy', clipRect: rectCopy(clip) });
        continue;
      }
      const frameId = frameIdFor(node, byId);
      const commandBase = { ...diagnosticBase(`glyph:${glyph.id}`, 'glyph-alpha-blits', order++, node, frameId), clipRect: rectCopy(clip) };
      const identity = fontName === 'Zekton' ? ZEKTON_CORPUS_ASSETS.regular : ZEKTON_CORPUS_ASSETS.bold;
      const basePreviewTints = basePreviewTintsForNode(text as unknown as Node);
      glyphs.push({ ...commandBase, kind: 'glyph-alpha-blit', textId: glyph.textId, lineIndex: glyph.lineIndex, codePoint: glyph.codePoint, glyphIndex: glyph.glyphIndex, descriptor: copyFontPin({ descriptor: identity.descriptor, atlas: identity.atlas }).descriptor, atlas: { ...copyFontPin({ descriptor: identity.descriptor, atlas: identity.atlas }).atlas, width: font.atlas.width, height: font.atlas.height }, sourceRect: clipped.source, destinationRect: clipped.destination, sourceRange: { start: glyph.sourceRange.start, end: glyph.sourceRange.end }, sourceCodePointRange: { start: glyph.sourceCodePointRange.start, end: glyph.sourceCodePointRange.end }, isEllipsis: glyph.quad.isEllipsis, ...(basePreviewTints.length === 0 ? {} : { basePreviewTints }) });
    }
    for (const gap of scene.gaps) {
      const node = gap.nodeId === undefined ? undefined : byId.get(gap.nodeId);
      const geometry = node === undefined ? undefined : rectForNode(node);
      const clip = node === undefined ? undefined : clipFor(node, byId, drawable);
      if (node !== undefined && clip === undefined) return refuse('invalid-clip', `gap ${gap.id} has a cyclic or invalid clip hierarchy`);
      const clippedGeometry = geometry === undefined || clip === undefined ? undefined : intersect(geometry, clip);
      const drawableGeometry = clippedGeometry !== undefined && hasArea(clippedGeometry) ? clippedGeometry : undefined;
      diagnostics.push({ ...diagnosticBase(`gap:${gap.id}`, 'diagnostics', order++, node, node === undefined ? undefined : frameIdFor(node, byId)), source: cloneSource(gap.source), ...(drawableGeometry === undefined || clip === undefined ? {} : { clipRect: rectCopy(clip), geometry: rectCopy(drawableGeometry) }), kind: 'gap', sourceComposition: diagnosticSourceComposition(scene, node, 'gap', gap), reason: gap.reason, category: gap.category, status: gap.status, ...(gap.operationId === undefined ? {} : { operationId: gap.operationId }) });
      if (geometry !== undefined && drawableGeometry === undefined && clip !== undefined) diagnostics.push({ ...diagnosticBase(`empty-clip:gap:${gap.id}`, 'diagnostics', order++, node, frameIdFor(node, byId)), clipRect: rectCopy(clip), kind: 'empty-clip', sourceComposition: diagnosticSourceComposition(scene, node, 'empty-clip'), reason: `gap ${gap.id} has no drawable geometry within its accepted clip hierarchy` });
    }
    for (const nodeId of selectedNodeIds) {
      const node = byId.get(nodeId);
      if (node) {
        const geometry = rectForNode(node);
        const clip = clipFor(node, byId, drawable);
        if (clip === undefined) return refuse('invalid-clip', `selection ${nodeId} has a cyclic or invalid clip hierarchy`);
        const clippedGeometry = geometry === undefined ? undefined : intersect(geometry, clip);
        const drawableGeometry = clippedGeometry !== undefined && hasArea(clippedGeometry) ? clippedGeometry : undefined;
        diagnostics.push({ ...diagnosticBase(`selection:${nodeId}`, 'diagnostics', order++, node, frameIdFor(node, byId)), ...(drawableGeometry === undefined ? {} : { clipRect: rectCopy(clip), geometry: rectCopy(drawableGeometry) }), kind: 'selection', sourceComposition: diagnosticSourceComposition(scene, node, 'selection'), reason: 'selected source-backed Scene node' });
        if (geometry !== undefined && drawableGeometry === undefined) diagnostics.push({ ...diagnosticBase(`empty-clip:selection:${nodeId}`, 'diagnostics', order++, node, frameIdFor(node, byId)), clipRect: rectCopy(clip), kind: 'empty-clip', sourceComposition: diagnosticSourceComposition(scene, node, 'empty-clip'), reason: `selection ${nodeId} has no drawable geometry within its accepted clip hierarchy` });
      }
    }
    const keepOutEntryIds = new Set<string>();
    for (const inputKeepOut of keepOutInputs) {
      if (keepOutEntryIds.has(inputKeepOut.projection.entryId)) return refuse('invalid-keepout', `keep-out entry ${inputKeepOut.projection.entryId} is duplicated across contexts`);
      keepOutEntryIds.add(inputKeepOut.projection.entryId);
      const command = keepOutCommand(inputKeepOut, order++, drawable);
      if (command === undefined) return refuse('invalid-keepout', `keep-out ${String(inputKeepOut.context)} is stale, refused, or malformed`);
      keepOuts.push(command);
    }
    let issuedOrder = 0;
    const issuedLayers = [
      { kind: 'diagnostic-background', commands: background.map(command => ({ ...command, order: issuedOrder++ })) },
      { kind: 'glyph-alpha-blits', commands: glyphs.map(command => ({ ...command, order: issuedOrder++ })) },
      { kind: 'diagnostics', commands: diagnostics.map(command => ({ ...command, order: issuedOrder++ })) },
      { kind: 'keep-out-overlays', commands: keepOuts.map(command => ({ ...command, order: issuedOrder++ })) },
    ] as X4UiPaintPlan['layers'];
    const issuedDiagnostics = issuedLayers[2].commands as readonly X4UiPaintDiagnosticCommand[];
    const issuedKeepOuts = issuedLayers[3].commands as readonly X4UiPaintKeepOutCommand[];
    const commandIds = issuedLayers.flatMap(layer => layer.commands.map(command => command.id));
    if (new Set(commandIds).size !== commandIds.length) return refuse('duplicate-id', 'paint plan command ids are not unique');
    const hasBasePreviewTints = [...background, ...glyphs].some(command => {
      const tints = (command as unknown as JsonRecord).basePreviewTints;
      return Array.isArray(tints) && tints.length > 0;
    });
    const plan: X4UiPaintPlan = {
      format: X4_UI_PAINT_PLAN_FORMAT,
      version: X4_UI_PAINT_PLAN_VERSION,
      status: scene.status === 'partial' || hasBasePreviewTints || issuedKeepOuts.some(overlay => overlay.status === 'unavailable') ? 'partial' : 'projected',
      gameTruth: X4_UI_PAINT_GAME_TRUTH,
      gameVerified: false,
      source: {
        file: scene.profile.source.file,
        ...(scene.profile.source.sourcePath === undefined ? {} : { sourcePath: scene.profile.source.sourcePath }),
        sha256: scene.profile.source.sha256,
      },
      logicalDrawable: { width: drawable.width, height: drawable.height },
      layers: issuedLayers,
      sceneStatus: scene.status,
      selectedNodeIds,
      keepOuts: issuedKeepOuts,
      diagnostics: issuedDiagnostics,
      verification: VERIFICATION,
    };
    return freezeDeep({ status: plan.status, plan, verification: VERIFICATION });
  } catch {
    return refuse('invalid-input', 'paint plan rejected malformed evidence without producing geometry');
  }
}

export const buildX4UiPaintPlan = projectX4UiPaintPlan;
