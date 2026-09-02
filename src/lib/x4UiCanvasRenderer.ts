import {
  isX4UiCorpusCanonicalSuccess,
  X4_UI_CORPUS_9_00_COLOR_CONTRACT,
  X4_UI_CORPUS_9_00_CONTRACT,
  type X4UiCorpusCanonicalSuccess,
} from './x4UiCorpusAssets';
import {
  applyZektonSdfAlpha,
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
} from './x4UiFontMetrics';
import {
  X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS,
  X4_UI_PAINT_GAME_TRUTH,
  X4_UI_PAINT_PLAN_FORMAT,
  X4_UI_PAINT_PLAN_VERSION,
  type X4UiPaintEditBoxCompositionEvidence,
  type X4UiPaintPlanResult,
} from './x4UiPaintPlan';

export const X4_UI_CANVAS_RENDERER_FORMAT = 'x4-ui-canvas-renderer' as const;
export const X4_UI_CANVAS_RENDERER_VERSION = 1 as const;
export const X4_UI_CANVAS_GAME_TRUTH = X4_UI_PAINT_GAME_TRUTH;

/** Diagnostic-only colors. These are not X4 colors, materials, or engine state. */
export const X4_UI_CANVAS_DIAGNOSTIC_PALETTE = Object.freeze({
  id: 'diagnostic-only',
  description: 'Diagnostic palette only; not an X4 color/material claim.',
  background: '#111827',
  geometry: '#64748b',
  glyph: '#e5e7eb',
  selection: '#f59e0b',
  gap: '#ef4444',
  unsupported: '#a855f7',
  unavailable: '#6b7280',
  emptyClip: '#dc2626',
  invalidRaster: '#f97316',
  keepOut: '#22d3ee',
  unavailableKeepOut: '#fb7185',
} as const);

export type X4UiCanvasSurfaceRole = 'regular-atlas' | 'bold-atlas' | 'composite';
export type X4UiCanvasPresentation = 'diagnostic-map' | 'source-composition';

export interface X4UiCanvasSurface {
  width: number;
  height: number;
  getContext(contextId: '2d'): unknown | null;
}

/**
 * Allocates a fresh, unmounted surface for one renderer-owned stage.
 * Every returned surface transfers to the renderer for the duration of the
 * render; callers do not supply a target or existing surface through this API.
 */
export type X4UiCanvasSurfaceFactory = (
  width: number,
  height: number,
  role: X4UiCanvasSurfaceRole,
) => X4UiCanvasSurface | null | undefined;

/** Renderer options select the owned allocator and the explicit presentation contract. */
export interface X4UiCanvasRenderOptions {
  readonly surfaceFactory?: X4UiCanvasSurfaceFactory;
  readonly presentation?: X4UiCanvasPresentation;
}

export type X4UiCanvasRenderRefusalCode =
  | 'invalid-input'
  | 'input-refused'
  | 'invalid-result'
  | 'invalid-plan'
  | 'invalid-layer'
  | 'invalid-command'
  | 'duplicate-command'
  | 'out-of-order-command'
  | 'unsupported-command'
  | 'invalid-truth'
  | 'invalid-corpus'
  | 'invalid-font'
  | 'invalid-atlas'
  | 'atlas-bounds'
  | 'invalid-geometry'
  | 'invalid-clip'
  | 'invalid-keepout'
  | 'game-truth'
  | 'missing-context'
  | 'allocation-failure'
  | 'post-validation-mutation'
  | 'surface-failure';

export interface X4UiCanvasRenderRefusal {
  readonly code: X4UiCanvasRenderRefusalCode;
  readonly message: string;
}

interface X4UiCanvasTruthReceipt {
  readonly gameTruth: typeof X4_UI_CANVAS_GAME_TRUTH;
  readonly gameVerified: false;
  readonly verification: {
    readonly game: typeof X4_UI_CANVAS_GAME_TRUTH;
    readonly gameVerified: false;
  };
}

export type X4UiCanvasRenderReceipt =
  | X4UiCanvasTruthReceipt & {
    readonly format: typeof X4_UI_CANVAS_RENDERER_FORMAT;
    readonly version: typeof X4_UI_CANVAS_RENDERER_VERSION;
    readonly status: 'rendered';
    readonly width: number;
    readonly height: number;
    readonly layers: readonly [
      'diagnostic-background',
      'glyph-alpha-blits',
      'diagnostics',
      'keep-out-overlays',
    ];
    readonly commandIds: readonly string[];
    readonly commandCount: number;
    readonly atlasRoles: readonly ('regular' | 'bold')[];
    readonly palette: {
      readonly id: typeof X4_UI_CANVAS_DIAGNOSTIC_PALETTE.id;
      readonly diagnosticOnly: true;
    };
  }
  | X4UiCanvasTruthReceipt & {
    readonly format: typeof X4_UI_CANVAS_RENDERER_FORMAT;
    readonly version: typeof X4_UI_CANVAS_RENDERER_VERSION;
    readonly status: 'refused';
    readonly refusal: X4UiCanvasRenderRefusal;
  };

export type X4UiCanvasRenderedReceipt = Extract<X4UiCanvasRenderReceipt, { readonly status: 'rendered' }>;
export type X4UiCanvasRefusedReceipt = Extract<X4UiCanvasRenderReceipt, { readonly status: 'refused' }>;

export type X4UiCanvasRenderResult =
  | {
    readonly status: 'rendered';
    readonly receipt: X4UiCanvasRenderedReceipt;
    readonly surface: X4UiCanvasSurface;
  }
  | {
    readonly status: 'refused';
    readonly receipt: X4UiCanvasRefusedReceipt;
  };

type UnknownRecord = Record<string, unknown>;
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

interface Method {
  (...args: unknown[]): unknown;
}

interface PaintApi {
  readonly save: Method;
  readonly restore: Method;
  readonly beginPath: Method;
  readonly rect: Method;
  readonly clip: Method;
  readonly fillRect: Method;
  readonly drawImage: Method;
  readonly moveTo: Method;
  readonly lineTo: Method;
  readonly closePath: Method;
  readonly stroke: Method;
  readonly setFillStyle: (value: string) => void;
  readonly setStrokeStyle: (value: string) => void;
}

interface AtlasApi extends PaintApi {
  readonly createImageData: Method;
  readonly putImageData: Method;
}

interface FontBinding {
  readonly role: 'regular' | 'bold';
  readonly font: UnknownRecord;
  readonly descriptor: UnknownRecord;
  readonly atlas: UnknownRecord;
  readonly alphaBytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly descriptorPath: string;
  readonly descriptorSha256: string;
  readonly atlasPath: string;
  readonly atlasSha256: string;
}

interface AtlasSnapshot {
  readonly role: 'regular' | 'bold';
  readonly alphaBytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

type TintDomain = 'source-literal-percent-alpha' | 'canonical-xml-byte-alpha';
type TintSlot = 'table-background' | 'cell-background' | 'widget-background' | 'editbox-inner-background' | 'widget-border' | 'widget-highlight' | 'widget-icon' | 'primary-text' | 'secondary-text';

interface ValidatedTint {
  readonly field: 'backgroundColor' | 'cellbgcolor' | 'bgcolor' | 'editboxBackgroundBlackColor' | 'bordercolor' | 'highlightcolor' | 'defaultTextColor' | 'color';
  readonly slot: TintSlot;
  readonly domain: TintDomain;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  readonly alphaScale: number;
  readonly drawableKey: string;
  readonly factKey: string;
}

interface FontIdentity {
  readonly descriptor: { readonly relativePath: string; readonly sha256: string };
  readonly atlas: { readonly relativePath: string; readonly sha256: string };
}

interface DetachedCommandBase {
  readonly id: string;
  readonly order: number;
  readonly clip?: Rect;
}

interface DetachedGeometryCommand extends DetachedCommandBase {
  readonly kind: 'node-geometry';
  readonly geometry?: Rect;
  readonly innerGeometry?: Rect;
  readonly editboxComposition?: X4UiPaintEditBoxCompositionEvidence;
  readonly color: string;
  readonly tints?: readonly ValidatedTint[];
}

interface DetachedGlyphCommand extends DetachedCommandBase {
  readonly kind: 'glyph-alpha-blit';
  readonly role: 'regular' | 'bold';
  readonly source: Rect;
  readonly destination: Rect;
  readonly tint?: ValidatedTint;
}

interface DetachedDiagnosticCommand extends DetachedCommandBase {
  readonly kind: 'selection' | 'gap' | 'unsupported-runtime-paint' | 'unavailable-node' | 'empty-clip' | 'invalid-raster-candidate';
  readonly geometry?: Rect;
  readonly color: string;
  readonly sourceComposition: 'visual' | 'diagnostic-only';
}

type DetachedKeepOutGeometry =
  | { readonly kind: 'horizontal-guide'; readonly y: number }
  | { readonly kind: 'vertical-guide'; readonly x: number }
  | { readonly kind: 'polygon'; readonly points: readonly { readonly x: number; readonly y: number }[] }
  | null;

interface DetachedKeepOutCommand extends DetachedCommandBase {
  readonly kind: 'keep-out';
  readonly geometry: DetachedKeepOutGeometry;
}

type ValidatedCommand = DetachedGeometryCommand | DetachedGlyphCommand | DetachedDiagnosticCommand | DetachedKeepOutCommand;

interface ValidatedPlan {
  readonly width: number;
  readonly height: number;
  readonly layers: readonly [
    readonly ValidatedCommand[],
    readonly ValidatedCommand[],
    readonly ValidatedCommand[],
    readonly ValidatedCommand[],
  ];
  readonly flattened: readonly ValidatedCommand[];
  readonly atlasRoles: readonly ('regular' | 'bold')[];
}

interface ValidationSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

interface ValidationFailure {
  readonly ok: false;
  readonly refusal: X4UiCanvasRenderRefusal;
}

type Validation<T> = ValidationSuccess<T> | ValidationFailure;

const isValidationFailure = <T>(value: Validation<T>): value is ValidationFailure => value.ok === false;

const TRUTH_VERIFICATION = Object.freeze({
  game: X4_UI_CANVAS_GAME_TRUTH,
  gameVerified: false as const,
});

const LAYER_KINDS = [
  'diagnostic-background',
  'glyph-alpha-blits',
  'diagnostics',
  'keep-out-overlays',
] as const;

const DIAGNOSTIC_KINDS = new Set([
  'selection',
  'gap',
  'unsupported-runtime-paint',
  'unavailable-node',
  'empty-clip',
  'invalid-raster-candidate',
]);

const KEEP_OUT_CONTEXTS = new Set([
  'cockpit-conversation',
  'map-open',
  'fullscreen-menu',
  'first-person',
]);

const KEEP_OUT_PRODUCTION_RULES = new Map<string, {
  readonly status: 'projected' | 'unavailable';
  readonly evidenceGrade: 'measured-guide' | 'reference-unmeasured';
  readonly geometry: 'horizontal-guide' | 'vertical-guide' | 'unavailable';
}>([
  ['conversation-back-row', { status: 'projected', evidenceGrade: 'measured-guide', geometry: 'horizontal-guide' }],
  ['conversation-option-stack-start', { status: 'projected', evidenceGrade: 'measured-guide', geometry: 'horizontal-guide' }],
  ['information-panel-left-edge', { status: 'projected', evidenceGrade: 'measured-guide', geometry: 'vertical-guide' }],
  ['mission-messages-ticker', { status: 'unavailable', evidenceGrade: 'reference-unmeasured', geometry: 'unavailable' }],
  ['top-hud-strip', { status: 'unavailable', evidenceGrade: 'reference-unmeasured', geometry: 'unavailable' }],
]);

const EVIDENCE_GRADES = new Set(['measured-guide', 'calibrated', 'reference-unmeasured']);
const MAX_DRAWABLE_DIMENSION = 1_000_000;
const MAX_COMMANDS = 100_000;

const isObject = (value: unknown): value is object => value !== null && typeof value === 'object';

const ownField = (value: object, key: string): { readonly present: boolean; readonly valid: boolean; readonly value?: unknown } => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { present: false, valid: true };
    if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return { present: true, valid: false };
    }
    return { present: true, valid: true, value: descriptor.value };
  } catch {
    return { present: true, valid: false };
  }
};

const isPlainDataRecord = (value: unknown): value is UnknownRecord => {
  if (!isObject(value) || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    return Object.getOwnPropertyNames(value).every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined
        && descriptor.enumerable
        && Object.prototype.hasOwnProperty.call(descriptor, 'value');
    });
  } catch {
    return false;
  }
};

const isDenseArray = (value: unknown, maximum = MAX_COMMANDS): value is readonly unknown[] => {
  if (!Array.isArray(value)) return false;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length !== 0) return false;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined
      || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      || lengthDescriptor.enumerable
      || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0
      || lengthDescriptor.value > maximum) return false;
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== value.length + 1 || !names.includes('length')) return false;
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      if (!names.includes(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined
        || !descriptor.enumerable
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return false;
    }
    return names.every(name => name === 'length' || /^(0|[1-9][0-9]*)$/.test(name));
  } catch {
    return false;
  }
};

const exactRecord = (value: unknown, required: readonly string[], optional: readonly string[] = []): value is UnknownRecord => {
  if (!isPlainDataRecord(value)) return false;
  try {
    const names = Object.getOwnPropertyNames(value);
    const allowed = new Set([...required, ...optional]);
    return required.every(key => names.includes(key)) && names.every(key => allowed.has(key));
  } catch {
    return false;
  }
};

const structuralFingerprint = (root: unknown): string | undefined => {
  const seen = new Map<object, number>();
  const active = new Set<object>();
  let nextId = 0;
  const atom = (value: string): string => `${value.length}:${value}`;
  const flags = (descriptor: PropertyDescriptor): string => `${descriptor.enumerable === true ? 'e' : '-'}${descriptor.configurable === true ? 'c' : '-'}${descriptor.writable === true ? 'w' : '-'}`;
  const visit = (value: unknown): string | undefined => {
    if (value === null) return 'null;';
    if (typeof value === 'string') return `s${atom(value)};`;
    if (typeof value === 'boolean') return value ? 'b1;' : 'b0;';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return undefined;
      return `n${Object.is(value, -0) ? '-0' : String(value)};`;
    }
    if (typeof value !== 'object') return undefined;
    const object = value as object;
    if (active.has(object)) return undefined;
    const prior = seen.get(object);
    if (prior !== undefined) return `r${prior};`;
    const identity = nextId;
    nextId += 1;
    seen.set(object, identity);
    active.add(object);
    try {
      if (Object.getOwnPropertySymbols(object).length !== 0 || ArrayBuffer.isView(object) || object instanceof ArrayBuffer) return undefined;
      const prototype = Object.getPrototypeOf(object);
      const names = Object.getOwnPropertyNames(object);
      if (Array.isArray(object)) {
        if (prototype !== Array.prototype) return undefined;
        const lengthDescriptor = Object.getOwnPropertyDescriptor(object, 'length');
        if (lengthDescriptor === undefined || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return undefined;
        if (names.length !== object.length + 1 || !names.includes('length')) return undefined;
        let output = `a${identity}[${object.length}|${flags(lengthDescriptor)}|`;
        for (let index = 0; index < object.length; index += 1) {
          const key = String(index);
          const descriptor = Object.getOwnPropertyDescriptor(object, key);
          if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
          const nested = visit(descriptor.value);
          if (nested === undefined) return undefined;
          output += `${flags(descriptor)}${nested}`;
        }
        if (!names.every(name => name === 'length' || /^(0|[1-9][0-9]*)$/.test(name))) return undefined;
        return `${output}];`;
      }
      if (prototype !== Object.prototype && prototype !== null) return undefined;
      let output = `o${identity}${prototype === null ? '0' : '1'}{`;
      for (const name of names) {
        const descriptor = Object.getOwnPropertyDescriptor(object, name);
        if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
        const nested = visit(descriptor.value);
        if (nested === undefined) return undefined;
        output += `${atom(name)}${flags(descriptor)}${nested}`;
      }
      return `${output}};`;
    } catch {
      return undefined;
    } finally {
      active.delete(object);
    }
  };
  return visit(root);
};

const fieldValue = (value: object, key: string): unknown => ownField(value, key).value;

const hasField = (value: object, key: string): boolean => ownField(value, key).present;

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const safeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;

const safeInteger = (value: unknown, minimum = 0): value is number =>
  safeNumber(value) && Number.isSafeInteger(value) && value >= minimum;

const dimension = (value: unknown, positive = false): value is number =>
  safeNumber(value) && (positive ? value > 0 : value >= 0) && value <= MAX_DRAWABLE_DIMENSION;

const sha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value) && !/^0+$/.test(value);

const refusal = (code: X4UiCanvasRenderRefusalCode, message: string): ValidationFailure => ({
  ok: false,
  refusal: { code, message },
});

const freezeReceipt = <T extends X4UiCanvasRenderReceipt>(value: T): T => {
  Object.freeze(value.verification);
  if (value.status === 'refused') {
    Object.freeze(value.refusal);
  } else {
    Object.freeze(value.layers);
    Object.freeze(value.commandIds);
    Object.freeze(value.atlasRoles);
    Object.freeze(value.palette);
  }
  return Object.freeze(value);
};

const makeRefusalReceipt = (failure: ValidationFailure): X4UiCanvasRefusedReceipt => freezeReceipt({
  format: X4_UI_CANVAS_RENDERER_FORMAT,
  version: X4_UI_CANVAS_RENDERER_VERSION,
  status: 'refused',
  gameTruth: X4_UI_CANVAS_GAME_TRUTH,
  gameVerified: false,
  verification: TRUTH_VERIFICATION,
  refusal: failure.refusal,
});

const makeRenderedReceipt = (
  width: number,
  height: number,
  commandIds: readonly string[],
  atlasRoles: readonly ('regular' | 'bold')[],
): X4UiCanvasRenderedReceipt => freezeReceipt({
  format: X4_UI_CANVAS_RENDERER_FORMAT,
  version: X4_UI_CANVAS_RENDERER_VERSION,
  status: 'rendered',
  gameTruth: X4_UI_CANVAS_GAME_TRUTH,
  gameVerified: false,
  verification: TRUTH_VERIFICATION,
  width,
  height,
  layers: LAYER_KINDS,
  commandIds: [...commandIds],
  commandCount: commandIds.length,
  atlasRoles: [...atlasRoles],
  palette: { id: X4_UI_CANVAS_DIAGNOSTIC_PALETTE.id, diagnosticOnly: true },
});

const makeRefusalResult = (failure: ValidationFailure): X4UiCanvasRenderResult => Object.freeze({
  status: 'refused' as const,
  receipt: makeRefusalReceipt(failure),
});

const makeRenderedResult = (
  surface: X4UiCanvasSurface,
  width: number,
  height: number,
  commandIds: readonly string[],
  atlasRoles: readonly ('regular' | 'bold')[],
): X4UiCanvasRenderResult => Object.freeze({
  status: 'rendered' as const,
  receipt: makeRenderedReceipt(width, height, commandIds, atlasRoles),
  surface,
});

const noForbiddenTruth = (value: unknown, active = new WeakSet<object>()): boolean => {
  if (value === null || typeof value !== 'object') return true;
  if (value instanceof Uint8Array || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
  const object = value as object;
  if (active.has(object)) return false;
  active.add(object);
  try {
    for (const key of Object.getOwnPropertyNames(value)) {
      const field = ownField(object, key);
      if (!field.valid) continue;
      if (key === 'gameVerified' && field.value === true) return false;
      if (key === 'engineColor') return false;
      if (key === 'engineAccepted' && field.value !== false) return false;
      if (!noForbiddenTruth(field.value, active)) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    active.delete(object);
  }
};

const validTruthRecord = (value: unknown): value is { readonly game: typeof X4_UI_CANVAS_GAME_TRUTH; readonly gameVerified: false } =>
  exactRecord(value, ['game', 'gameVerified'])
  && fieldValue(value, 'game') === X4_UI_CANVAS_GAME_TRUTH
  && fieldValue(value, 'gameVerified') === false;

const validSource = (value: unknown): boolean => {
  if (!exactRecord(value, ['file', 'start', 'end'], ['sourcePath'])) return false;
  const file = fieldValue(value, 'file');
  const sourcePath = fieldValue(value, 'sourcePath');
  const start = fieldValue(value, 'start');
  const end = fieldValue(value, 'end');
  if (!nonEmptyString(file)
    || sourcePath !== undefined && !nonEmptyString(sourcePath)
    || !exactRecord(start, ['line', 'column', 'offset'])
    || !exactRecord(end, ['line', 'column', 'offset'])) return false;
  return safeInteger(fieldValue(start, 'line'), 1)
    && safeInteger(fieldValue(start, 'column'))
    && safeInteger(fieldValue(start, 'offset'))
    && safeInteger(fieldValue(end, 'line'), 1)
    && safeInteger(fieldValue(end, 'column'))
    && safeInteger(fieldValue(end, 'offset'), fieldValue(start, 'offset') as number)
    && (fieldValue(end, 'offset') as number) >= (fieldValue(start, 'offset') as number);
};

const validSourcePin = (value: unknown): boolean => {
  return exactRecord(value, ['sourcePath', 'lineStart', 'lineEnd'])
    && nonEmptyString(fieldValue(value, 'sourcePath'))
    && safeInteger(fieldValue(value, 'lineStart'), 1)
    && safeInteger(fieldValue(value, 'lineEnd'), fieldValue(value, 'lineStart') as number);
};

const exactSourcePin = (
  value: unknown,
  expected: { readonly sourcePath: string; readonly lineStart: number; readonly lineEnd: number },
): boolean => validSourcePin(value)
  && fieldValue(value as object, 'sourcePath') === expected.sourcePath
  && fieldValue(value as object, 'lineStart') === expected.lineStart
  && fieldValue(value as object, 'lineEnd') === expected.lineEnd;

const validEditBoxComposition = (value: unknown): value is X4UiPaintEditBoxCompositionEvidence => {
  if (!exactRecord(value, ['previewOnly', 'configBorder', 'innerInset', 'textBorder', 'sourcePins'])
    || fieldValue(value, 'previewOnly') !== true
    || fieldValue(value, 'configBorder') !== 1
    || !safeInteger(fieldValue(value, 'innerInset'), 2)
    || (fieldValue(value, 'innerInset') as number) > 1_000_000
    || fieldValue(value, 'textBorder') !== 2) return false;
  const pins = fieldValue(value, 'sourcePins');
  if (!exactRecord(pins, ['configBorder', 'fixedTextBorder', 'scaledInnerInset', 'innerApplication', 'textAnchor', 'textTruncation'])) return false;
  return exactSourcePin(fieldValue(pins, 'configBorder'), X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.configBorder)
    && exactSourcePin(fieldValue(pins, 'fixedTextBorder'), X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.fixedTextBorder)
    && exactSourcePin(fieldValue(pins, 'scaledInnerInset'), X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.scaledInnerInset)
    && exactSourcePin(fieldValue(pins, 'innerApplication'), X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.innerApplication)
    && exactSourcePin(fieldValue(pins, 'textAnchor'), X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.textAnchor)
    && exactSourcePin(fieldValue(pins, 'textTruncation'), X4_UI_EDITBOX_SOURCE_COMPOSITION_PINS.textTruncation);
};

const copyEditBoxComposition = (value: X4UiPaintEditBoxCompositionEvidence): X4UiPaintEditBoxCompositionEvidence => ({
  previewOnly: true,
  configBorder: 1,
  innerInset: value.innerInset,
  textBorder: 2,
  sourcePins: {
    configBorder: { ...value.sourcePins.configBorder },
    fixedTextBorder: { ...value.sourcePins.fixedTextBorder },
    scaledInnerInset: { ...value.sourcePins.scaledInnerInset },
    innerApplication: { ...value.sourcePins.innerApplication },
    textAnchor: { ...value.sourcePins.textAnchor },
    textTruncation: { ...value.sourcePins.textTruncation },
  },
});

const sourceContains = (outer: unknown, inner: unknown): boolean => {
  if (!validSource(outer) || !validSource(inner)) return false;
  const outerRecord = outer as object;
  const innerRecord = inner as object;
  const outerStart = fieldValue(fieldValue(outerRecord, 'start') as object, 'offset');
  const outerEnd = fieldValue(fieldValue(outerRecord, 'end') as object, 'offset');
  const innerStart = fieldValue(fieldValue(innerRecord, 'start') as object, 'offset');
  const innerEnd = fieldValue(fieldValue(innerRecord, 'end') as object, 'offset');
  return fieldValue(outerRecord, 'file') === fieldValue(innerRecord, 'file')
    && fieldValue(outerRecord, 'sourcePath') === fieldValue(innerRecord, 'sourcePath')
    && typeof outerStart === 'number'
    && typeof outerEnd === 'number'
    && typeof innerStart === 'number'
    && typeof innerEnd === 'number'
    && outerStart <= innerStart
    && innerEnd <= outerEnd;
};

const sourceIdentityMatches = (left: unknown, right: unknown): boolean => {
  if (!validSource(left) || !validSource(right)) return false;
  const leftRecord = left as object;
  const rightRecord = right as object;
  return fieldValue(leftRecord, 'file') === fieldValue(rightRecord, 'file')
    && fieldValue(leftRecord, 'sourcePath') === fieldValue(rightRecord, 'sourcePath');
};

const COLOR_TINT_FIELD_SLOTS: ReadonlyMap<string, TintSlot> = new Map([
  ['backgroundColor', 'table-background'],
  ['cellbgcolor', 'cell-background'],
  ['bgcolor', 'widget-background'],
  ['editboxBackgroundBlackColor', 'editbox-inner-background'],
  ['bordercolor', 'widget-border'],
  ['highlightcolor', 'widget-highlight'],
  ['defaultTextColor', 'primary-text'],
  ['color', 'widget-icon'],
]);

const validColorFileIdentity = (
  value: unknown,
  expected: { readonly relativePath: string; readonly sha256: string; readonly size: number },
): boolean => exactRecord(value, ['path', 'relativePath', 'sha256', 'size'])
  && fieldValue(value, 'path') === expected.relativePath
  && fieldValue(value, 'relativePath') === expected.relativePath
  && fieldValue(value, 'sha256') === expected.sha256
  && fieldValue(value, 'size') === expected.size;

const validColorChannelEvidence = (value: unknown, expected: unknown, maximum: number): boolean => {
  if (!exactRecord(value, ['expression', 'keySource', 'source', 'value'])) return false;
  const channelValue = fieldValue(value, 'value');
  return nonEmptyString(fieldValue(value, 'expression'))
    && validSource(fieldValue(value, 'keySource'))
    && validSource(fieldValue(value, 'source'))
    && safeNumber(channelValue)
    && (channelValue as number) >= 0
    && (channelValue as number) <= maximum
    && channelValue === expected;
};

const validateBasePreviewTint = (value: unknown): Validation<ValidatedTint> => {
  if (!exactRecord(value, ['kind', 'completeness', 'field', 'slot', 'value', 'domain', 'provenance', 'expression', 'source', 'gameVerification'], ['sourcePin', 'sampleId'])) {
    return refusal('invalid-command', 'basePreviewTints contains an unexpected, inherited, sparse, or accessor tint record');
  }
  if (fieldValue(value, 'kind') !== 'base-preview-tint' || fieldValue(value, 'completeness') !== 'partial') {
    return refusal('invalid-command', 'basePreviewTints tint completeness or kind is invalid');
  }
  const field = fieldValue(value, 'field');
  const slot = fieldValue(value, 'slot');
  const expectedSlot = typeof field === 'string' ? COLOR_TINT_FIELD_SLOTS.get(field) : undefined;
  const fieldSlotMatches = expectedSlot !== undefined && (slot === expectedSlot || field === 'color' && (slot === 'primary-text' || slot === 'secondary-text'));
  if (!fieldSlotMatches) return refusal('invalid-command', 'basePreviewTints field and slot relationship is invalid');
  const domain = fieldValue(value, 'domain');
  if (domain !== 'source-literal-percent-alpha' && domain !== 'canonical-xml-byte-alpha') return refusal('invalid-command', 'basePreviewTints alpha domain is unsupported');
  const provenance = fieldValue(value, 'provenance');
  if (domain === 'source-literal-percent-alpha' && provenance !== 'source-literal' || domain === 'canonical-xml-byte-alpha' && provenance !== 'canonical-default-only') {
    return refusal('invalid-command', 'basePreviewTints provenance does not match its alpha domain');
  }
  if (!nonEmptyString(fieldValue(value, 'expression')) || !validSource(fieldValue(value, 'source'))) return refusal('invalid-command', 'basePreviewTints source expression or location is malformed');
  if (hasField(value, 'sourcePin') && !validSourcePin(fieldValue(value, 'sourcePin')) || hasField(value, 'sampleId') && !nonEmptyString(fieldValue(value, 'sampleId'))) return refusal('invalid-command', 'basePreviewTints source pin or sample identity is malformed');
  if (fieldValue(value, 'gameVerification') !== X4_UI_CANVAS_GAME_TRUTH || !noForbiddenTruth(value)) return refusal('game-truth', 'basePreviewTints carries escalated game truth');
  const color = fieldValue(value, 'value');
  const colorMaximum = domain === 'source-literal-percent-alpha' ? 100 : 255;
  if (domain === 'source-literal-percent-alpha') {
    if (!exactRecord(color, ['a', 'b', 'channels', 'declarationExpression', 'declarationSource', 'domain', 'g', 'gameVerification', 'kind', 'r'], ['glow'])) return refusal('invalid-command', 'source-literal basePreviewTints color evidence has an unexpected shape');
    const channels = fieldValue(color, 'channels') as object;
    const hasGlow = hasField(color as object, 'glow');
    if (!exactRecord(channels, ['a', 'b', 'g', 'r'], hasGlow ? ['glow'] : [])
      || !validColorChannelEvidence(fieldValue(channels, 'r'), fieldValue(color, 'r'), 255)
      || !validColorChannelEvidence(fieldValue(channels, 'g'), fieldValue(color, 'g'), 255)
      || !validColorChannelEvidence(fieldValue(channels, 'b'), fieldValue(color, 'b'), 255)
      || !validColorChannelEvidence(fieldValue(channels, 'a'), fieldValue(color, 'a'), colorMaximum)
      || !nonEmptyString(fieldValue(color, 'declarationExpression'))
      || !validSource(fieldValue(color, 'declarationSource'))
      || !sourceIdentityMatches(fieldValue(value, 'source'), fieldValue(color, 'declarationSource'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'r') as object, 'keySource'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'g') as object, 'keySource'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'b') as object, 'keySource'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'a') as object, 'keySource'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'r') as object, 'source'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'g') as object, 'source'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'b') as object, 'source'))
      || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'a') as object, 'source'))) {
      return refusal('invalid-command', 'source-literal basePreviewTints channels or declaration evidence is malformed');
    }
    if (hasGlow) {
      if (!safeNumber(fieldValue(color as object, 'glow')) || (fieldValue(color as object, 'glow') as number) < 0 || (fieldValue(color as object, 'glow') as number) > 1 || !validColorChannelEvidence(fieldValue(channels, 'glow'), fieldValue(color, 'glow'), 1) || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'glow') as object, 'keySource')) || !sourceContains(fieldValue(color, 'declarationSource'), fieldValue(fieldValue(channels, 'glow') as object, 'source'))) {
        return refusal('invalid-command', 'source-literal basePreviewTints glow evidence is malformed or not contained by its declaration');
      }
    }
  } else {
    if (!exactRecord(color, ['a', 'b', 'baseSource', 'canonicalIdentity', 'domain', 'g', 'gameVerification', 'glow', 'kind', 'r', 'requestedId', 'resolvedBaseId', 'sourceIdentities'], ['mappingSource'])) return refusal('invalid-command', 'canonical basePreviewTints color evidence has an unexpected shape');
    const baseSource = fieldValue(color, 'baseSource');
    const sourceIdentities = fieldValue(color, 'sourceIdentities');
    if (!exactRecord(baseSource, ['id', 'index', 'path'])
      || !nonEmptyString(fieldValue(baseSource, 'id'))
      || !safeInteger(fieldValue(baseSource, 'index'))
      || (fieldValue(baseSource, 'index') as number) > 223
      || fieldValue(baseSource, 'path') !== X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath
      || fieldValue(color, 'canonicalIdentity') !== 'x4-9.00'
      || !nonEmptyString(fieldValue(color, 'requestedId'))
      || !nonEmptyString(fieldValue(color, 'resolvedBaseId'))
      || fieldValue(baseSource, 'id') !== fieldValue(color, 'resolvedBaseId')
      || !exactRecord(sourceIdentities, ['xml', 'xsd'])
      || !validColorFileIdentity(fieldValue(sourceIdentities, 'xml'), X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml)
      || !validColorFileIdentity(fieldValue(sourceIdentities, 'xsd'), X4_UI_CORPUS_9_00_COLOR_CONTRACT.xsd)) {
      return refusal('invalid-command', 'canonical basePreviewTints pinned corpus identity is malformed');
    }
    const glow = fieldValue(color, 'glow');
    if (!safeNumber(glow) || (glow as number) < 0 || (glow as number) > 1) return refusal('invalid-command', 'canonical basePreviewTints glow evidence is malformed');
    if (hasField(color as object, 'mappingSource')) {
      const mappingSource = fieldValue(color as object, 'mappingSource');
      if (!exactRecord(mappingSource, ['id', 'index', 'path'])
        || !nonEmptyString(fieldValue(mappingSource as object, 'id'))
        || !safeInteger(fieldValue(mappingSource as object, 'index'))
        || (fieldValue(mappingSource as object, 'index') as number) > 803
        || fieldValue(mappingSource as object, 'path') !== X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath
        || fieldValue(mappingSource as object, 'id') !== fieldValue(color, 'requestedId')
        || fieldValue(color, 'requestedId') === fieldValue(color, 'resolvedBaseId')
        ) {
        return refusal('invalid-command', 'canonical basePreviewTints mapping source or requested/resolved identity is inconsistent');
      }
    } else if (fieldValue(color, 'requestedId') !== fieldValue(color, 'resolvedBaseId')) {
      return refusal('invalid-command', 'canonical basePreviewTints requested and resolved identities are inconsistent');
    }
  }
  if (fieldValue(color, 'kind') !== 'color'
    || fieldValue(color, 'domain') !== domain
    || fieldValue(color, 'gameVerification') !== X4_UI_CANVAS_GAME_TRUTH) {
    return refusal('invalid-command', 'basePreviewTints nested color domain or truth is malformed');
  }
  const red = fieldValue(color, 'r');
  const green = fieldValue(color, 'g');
  const blue = fieldValue(color, 'b');
  const alpha = fieldValue(color, 'a');
  const canonicalChannelsAreIntegers = domain === 'canonical-xml-byte-alpha';
  if (!safeNumber(red) || canonicalChannelsAreIntegers && !Number.isInteger(red) || (red as number) < 0 || (red as number) > 255
    || !safeNumber(green) || canonicalChannelsAreIntegers && !Number.isInteger(green) || (green as number) < 0 || (green as number) > 255
    || !safeNumber(blue) || canonicalChannelsAreIntegers && !Number.isInteger(blue) || (blue as number) < 0 || (blue as number) > 255
    || !safeNumber(alpha) || canonicalChannelsAreIntegers && !Number.isInteger(alpha) || (alpha as number) < 0 || (alpha as number) > colorMaximum) {
    return refusal('invalid-command', 'basePreviewTints RGB or alpha channel is outside its typed range');
  }
  const alphaScale = domain === 'source-literal-percent-alpha' ? (alpha as number) / 100 : (alpha as number) / 255;
  const source = fieldValue(value, 'source') as object;
  const sourceStart = fieldValue(source, 'start') as object;
  const sourceEnd = fieldValue(source, 'end') as object;
  const factKey = `${String(fieldValue(source, 'file'))}|${String(fieldValue(sourceStart, 'offset'))}|${String(fieldValue(sourceEnd, 'offset'))}|${String(field)}|${String(slot)}`;
  return {
    ok: true,
    value: {
      field: field as ValidatedTint['field'],
      slot: slot as TintSlot,
      domain: domain as TintDomain,
      red: red as number,
      green: green as number,
      blue: blue as number,
      alpha: alpha as number,
      alphaScale,
      drawableKey: `${String(red)}|${String(green)}|${String(blue)}|${String(alphaScale)}`,
      factKey,
    },
  };
};

const validateBasePreviewTints = (value: unknown): Validation<readonly ValidatedTint[]> => {
  if (!isDenseArray(value, 16) || value.length === 0) return refusal('invalid-command', 'basePreviewTints must be a non-empty dense own-data array');
  const tints: ValidatedTint[] = [];
  const factKeys = new Set<string>();
  const slots = new Set<TintSlot>();
  for (const tintValue of value) {
    const tint = validateBasePreviewTint(tintValue);
    if (isValidationFailure(tint)) return tint;
    if (factKeys.has(tint.value.factKey) || slots.has(tint.value.slot)) return refusal('invalid-command', 'basePreviewTints contains duplicate or reassigned facts');
    factKeys.add(tint.value.factKey);
    slots.add(tint.value.slot);
    tints.push(tint.value);
  }
  return { ok: true, value: tints };
};

const validRect = (value: unknown, bounds?: Rect, positive = false): value is Rect => {
  if (!exactRecord(value, ['x', 'y', 'width', 'height'])) return false;
  const x = fieldValue(value, 'x');
  const y = fieldValue(value, 'y');
  const width = fieldValue(value, 'width');
  const height = fieldValue(value, 'height');
  if (!safeNumber(x) || !safeNumber(y) || !dimension(width, positive) || !dimension(height, positive)) return false;
  if (!safeNumber((x as number) + (width as number)) || !safeNumber((y as number) + (height as number))) return false;
  if (bounds === undefined) return true;
  return (x as number) >= bounds.x
    && (y as number) >= bounds.y
    && (x as number) + (width as number) <= bounds.x + bounds.width
    && (y as number) + (height as number) <= bounds.y + bounds.height;
};

const validRange = (value: unknown): boolean => {
  if (!exactRecord(value, ['start', 'end'])) return false;
  const start = fieldValue(value, 'start');
  const end = fieldValue(value, 'end');
  return safeInteger(start) && safeInteger(end, start as number) && (end as number) >= (start as number);
};

const validIdentity = (value: unknown, relativePath: string, expectedSha256: string): value is UnknownRecord =>
  exactRecord(value, ['relativePath', 'sha256'])
  && fieldValue(value, 'relativePath') === relativePath
  && fieldValue(value, 'sha256') === expectedSha256;

const validBytes = (value: unknown): value is Uint8Array => {
  if (!(value instanceof Uint8Array)) return false;
  try {
    return Object.getPrototypeOf(value) === Uint8Array.prototype;
  } catch {
    return false;
  }
};

const validBinaryEvidence = (
  value: unknown,
  kind: string,
  relativePath: string,
  expectedSha256: string,
): boolean => {
  if (!exactRecord(value, ['kind', 'path', 'relativePath', 'sha256', 'size', 'bytes'])) return false;
  const bytes = fieldValue(value, 'bytes');
  return fieldValue(value, 'kind') === kind
    && fieldValue(value, 'path') === relativePath
    && fieldValue(value, 'relativePath') === relativePath
    && fieldValue(value, 'sha256') === expectedSha256
    && safeInteger(fieldValue(value, 'size'))
    && validBytes(bytes)
    && bytes.byteLength === fieldValue(value, 'size');
};

const validTextEvidence = (
  value: unknown,
  kind: string,
  relativePath: string,
  expectedSha256: string,
): boolean => exactRecord(value, ['kind', 'path', 'relativePath', 'sha256', 'size', 'bytes', 'encoding', 'text'])
  && validBinaryEvidence({
    kind: fieldValue(value, 'kind'),
    path: fieldValue(value, 'path'),
    relativePath: fieldValue(value, 'relativePath'),
    sha256: fieldValue(value, 'sha256'),
    size: fieldValue(value, 'size'),
    bytes: fieldValue(value, 'bytes'),
  }, kind, relativePath, expectedSha256)
  && fieldValue(value, 'encoding') === 'utf-8'
  && typeof fieldValue(value, 'text') === 'string';

const validHeader = (value: unknown, width: number, height: number, maxCodepoint: number): boolean => {
  if (!exactRecord(value, ['formatVersion', 'lineMetrics', 'reserved32', 'atlasWidth', 'atlasHeight', 'maxCodepoint'])) return false;
  const lineMetrics = fieldValue(value, 'lineMetrics');
  return fieldValue(value, 'formatVersion') === 9
    && fieldValue(value, 'reserved32') === 0
    && fieldValue(value, 'atlasWidth') === width
    && fieldValue(value, 'atlasHeight') === height
    && fieldValue(value, 'maxCodepoint') === maxCodepoint
    && exactRecord(lineMetrics, ['outer', 'top', 'bottom', 'inner', 'split20', 'split24', 'rawMetric28'])
    && ['outer', 'top', 'bottom', 'inner', 'split20', 'split24', 'rawMetric28'].every(key => safeNumber(fieldValue(lineMetrics as object, key)));
};

const validByteArray = (value: unknown): boolean => isDenseArray(value, 20_000_000)
  && (value as readonly unknown[]).every(item => safeInteger(item, 0) && (item as number) <= 255);

const validDescriptor = (value: unknown, binding: FontIdentity): value is UnknownRecord => {
  if (!exactRecord(value, [
    'format',
    'atlasWidth',
    'atlasHeight',
    'maxCodepoint',
    'codePointToGlyphIndex',
    'map',
    'glyphRecords',
    'glyphs',
    'glyphCount',
    'recordSize',
    'headerBytes',
    'header',
    'lineMetrics',
    'trailingBytes',
    'identity',
    'provenance',
    'evidenceState',
  ])) return false;
  const width = fieldValue(value, 'atlasWidth');
  const height = fieldValue(value, 'atlasHeight');
  const maxCodepoint = fieldValue(value, 'maxCodepoint');
  const map = fieldValue(value, 'codePointToGlyphIndex');
  const mapAlias = fieldValue(value, 'map');
  const glyphs = fieldValue(value, 'glyphRecords');
  const glyphAlias = fieldValue(value, 'glyphs');
  const identity = fieldValue(value, 'identity');
  const provenance = fieldValue(value, 'provenance');
  const descriptorProvenance = isPlainDataRecord(provenance) ? fieldValue(provenance, 'identity') : undefined;
  return fieldValue(value, 'format') === 'x4-zekton-abc'
    && safeInteger(width, 1)
    && safeInteger(height, 1)
    && safeInteger(maxCodepoint)
    && (maxCodepoint as number) <= 0x10ffff
    && isDenseArray(map, 0x110000)
    && mapAlias === map
    && (map as readonly unknown[]).length === (maxCodepoint as number) + 1
    && (map as readonly unknown[]).every(item => safeInteger(item))
    && isDenseArray(glyphs, 0xffff)
    && glyphAlias === glyphs
    && fieldValue(value, 'glyphCount') === (glyphs as readonly unknown[]).length
    && fieldValue(value, 'recordSize') === 24
    && validByteArray(fieldValue(value, 'headerBytes'))
    && validHeader(fieldValue(value, 'header'), width as number, height as number, maxCodepoint as number)
    && exactRecord(fieldValue(value, 'lineMetrics'), ['outer', 'top', 'bottom', 'inner', 'split20', 'split24', 'rawMetric28'])
    && validByteArray(fieldValue(value, 'trailingBytes'))
    && validIdentity(identity, binding.descriptor.relativePath, binding.descriptor.sha256)
    && exactRecord(provenance, ['identity', 'evidenceState'])
    && descriptorProvenance === identity
    && fieldValue(provenance, 'evidenceState') === ZEKTON_EVIDENCE_STATE
    && fieldValue(value, 'evidenceState') === ZEKTON_EVIDENCE_STATE;
};

const validAtlas = (value: unknown, binding: FontIdentity): value is UnknownRecord => {
  if (!exactRecord(value, [
    'format',
    'width',
    'height',
    'dimensions',
    'payloadOffset',
    'payloadLength',
    'mipMapCount',
    'depth',
    'alphaBytes',
    'identity',
    'provenance',
    'evidenceState',
  ])) return false;
  const width = fieldValue(value, 'width');
  const height = fieldValue(value, 'height');
  const dimensions = fieldValue(value, 'dimensions');
  const bytes = fieldValue(value, 'alphaBytes');
  const identity = fieldValue(value, 'identity');
  const provenance = fieldValue(value, 'provenance');
  const product = safeInteger(width, 1) && safeInteger(height, 1) ? (width as number) * (height as number) : -1;
  return fieldValue(value, 'format') === 'x4-zekton-a8-dds'
    && safeInteger(width, 1)
    && safeInteger(height, 1)
    && product <= 64 * 1024 * 1024
    && exactRecord(dimensions, ['width', 'height'])
    && fieldValue(dimensions, 'width') === width
    && fieldValue(dimensions, 'height') === height
    && fieldValue(value, 'payloadOffset') === 128
    && fieldValue(value, 'payloadLength') === product
    && fieldValue(value, 'mipMapCount') === 0
    && fieldValue(value, 'depth') === 0
    && validBytes(bytes)
    && bytes.byteLength === product
    && validIdentity(identity, binding.atlas.relativePath, binding.atlas.sha256)
    && exactRecord(provenance, ['identity', 'evidenceState'])
    && fieldValue(provenance, 'identity') === identity
    && fieldValue(provenance, 'evidenceState') === ZEKTON_EVIDENCE_STATE
    && fieldValue(value, 'evidenceState') === ZEKTON_EVIDENCE_STATE;
};

const validFont = (
  value: unknown,
  assetValue: unknown,
  role: 'regular' | 'bold',
): Validation<FontBinding> => {
  const binding = role === 'regular' ? ZEKTON_CORPUS_ASSETS.regular : ZEKTON_CORPUS_ASSETS.bold;
  if (!exactRecord(value, ['format', 'descriptor', 'atlas', 'descriptorIdentity', 'atlasIdentity', 'evidenceState', 'provenance'])) {
    return refusal('invalid-font', `${role} Zekton font assets have an unexpected shape`);
  }
  const descriptor = fieldValue(value, 'descriptor');
  const atlas = fieldValue(value, 'atlas');
  const descriptorIdentity = fieldValue(value, 'descriptorIdentity');
  const atlasIdentity = fieldValue(value, 'atlasIdentity');
  const provenance = fieldValue(value, 'provenance');
  if (fieldValue(value, 'format') !== 'x4-zekton-font-assets'
    || !validDescriptor(descriptor, binding)
    || !validAtlas(atlas, binding)
    || !validIdentity(descriptorIdentity, binding.descriptor.relativePath, binding.descriptor.sha256)
    || !validIdentity(atlasIdentity, binding.atlas.relativePath, binding.atlas.sha256)
    || descriptorIdentity !== fieldValue(descriptor as object, 'identity')
    || atlasIdentity !== fieldValue(atlas as object, 'identity')
    || fieldValue(value, 'evidenceState') !== ZEKTON_EVIDENCE_STATE
    || !exactRecord(provenance, ['descriptor', 'atlas'])
    || fieldValue(provenance, 'descriptor') !== fieldValue(descriptor as object, 'provenance')
    || fieldValue(provenance, 'atlas') !== fieldValue(atlas as object, 'provenance')) {
    return refusal('invalid-font', `${role} Zekton font assets are not canonical decoded assets`);
  }
  if (!exactRecord(assetValue, ['descriptor', 'atlas', 'decoded', 'evidenceState'])
    || fieldValue(assetValue, 'decoded') !== value
    || fieldValue(assetValue, 'descriptor') === undefined
    || fieldValue(assetValue, 'atlas') === undefined
    || !validBinaryEvidence(
      fieldValue(assetValue as object, 'descriptor'),
      `${role}-descriptor`,
      binding.descriptor.relativePath,
      binding.descriptor.sha256,
    )
    || !validBinaryEvidence(
      fieldValue(assetValue as object, 'atlas'),
      `${role}-atlas`,
      binding.atlas.relativePath,
      binding.atlas.sha256,
    )
    || fieldValue(assetValue, 'evidenceState') !== ZEKTON_EVIDENCE_STATE) {
    return refusal('invalid-font', `${role} corpus evidence is detached from its decoded font`);
  }
  const alphaBytes = fieldValue(atlas as object, 'alphaBytes');
  const width = fieldValue(atlas as object, 'width');
  const height = fieldValue(atlas as object, 'height');
  if (fieldValue(descriptor as object, 'atlasWidth') !== width || fieldValue(descriptor as object, 'atlasHeight') !== height) {
    return refusal('invalid-atlas', `${role} descriptor and A8 atlas dimensions do not match`);
  }
  return {
    ok: true,
    value: {
      role,
      font: value,
      descriptor: descriptor as UnknownRecord,
      atlas: atlas as UnknownRecord,
      alphaBytes: new Uint8Array(alphaBytes as Uint8Array),
      width: width as number,
      height: height as number,
      descriptorPath: binding.descriptor.relativePath,
      descriptorSha256: binding.descriptor.sha256,
      atlasPath: binding.atlas.relativePath,
      atlasSha256: binding.atlas.sha256,
    },
  };
};

const validateCorpus = (value: unknown): Validation<{
  readonly regular: FontBinding;
  readonly bold: FontBinding;
}> => {
  try {
    if (!isX4UiCorpusCanonicalSuccess(value)) return refusal('invalid-corpus', 'renderer requires the exact loader-issued canonical X4 corpus result');
    if (!exactRecord(value, [
      'ok',
      'statusIdentity',
      'manifestGeneration',
      'assets',
      'fonts',
      'helperSourceHash',
      'widgetSourceHash',
      'fontEvidence',
      'verification',
      'evidenceKind',
      'canonical',
      'canonicalIdentity',
    ])) return refusal('invalid-corpus', 'canonical corpus result has an unexpected shape');
    if (fieldValue(value, 'ok') !== true
      || fieldValue(value, 'evidenceKind') !== 'canonical-9.00'
      || fieldValue(value, 'canonical') !== true
      || fieldValue(value, 'canonicalIdentity') !== 'x4-9.00'
      || fieldValue(value, 'verification') !== 'Not verified in game'
      || !exactRecord(fieldValue(value, 'statusIdentity'), ['root', 'generatedAt', 'manifestGeneration', 'manifestRoot', 'manifestGeneratedAt'])
      || !['root', 'generatedAt', 'manifestGeneration', 'manifestRoot', 'manifestGeneratedAt'].every(key => nonEmptyString(fieldValue(fieldValue(value, 'statusIdentity') as object, key)))
      || !nonEmptyString(fieldValue(value, 'manifestGeneration'))
      || !sha256(fieldValue(value, 'helperSourceHash'))
      || !sha256(fieldValue(value, 'widgetSourceHash'))
      || fieldValue(value, 'helperSourceHash') !== X4_UI_CORPUS_9_00_CONTRACT.helper.sha256
      || fieldValue(value, 'widgetSourceHash') !== X4_UI_CORPUS_9_00_CONTRACT.widget.sha256
      || fieldValue(value, 'fontEvidence') !== ZEKTON_EVIDENCE_STATE) {
      return refusal('invalid-corpus', 'canonical corpus truth or status identity is invalid');
    }
    const assets = fieldValue(value, 'assets');
    const fonts = fieldValue(value, 'fonts');
    if (!exactRecord(assets, ['helper', 'widget', 'regular', 'bold']) || !exactRecord(fonts, ['regular', 'bold'])) {
      return refusal('invalid-corpus', 'canonical corpus font evidence is missing');
    }
    if (!validTextEvidence(
      fieldValue(assets, 'helper'),
      'helper',
      X4_UI_CORPUS_9_00_CONTRACT.helper.relativePath,
      X4_UI_CORPUS_9_00_CONTRACT.helper.sha256,
    ) || !validTextEvidence(
      fieldValue(assets, 'widget'),
      'widget',
      X4_UI_CORPUS_9_00_CONTRACT.widget.relativePath,
      X4_UI_CORPUS_9_00_CONTRACT.widget.sha256,
    )) return refusal('invalid-corpus', 'canonical source evidence is invalid');
    const regular = validFont(fieldValue(fonts, 'regular'), fieldValue(assets, 'regular'), 'regular');
    if (isValidationFailure(regular)) return { ok: false, refusal: regular.refusal };
    const bold = validFont(fieldValue(fonts, 'bold'), fieldValue(assets, 'bold'), 'bold');
    if (isValidationFailure(bold)) return { ok: false, refusal: bold.refusal };
    return { ok: true, value: { regular: regular.value, bold: bold.value } };
  } catch {
    return refusal('invalid-corpus', 'canonical corpus validation failed without executing a product exception');
  }
};

const validPlanSource = (value: unknown): boolean => {
  if (!exactRecord(value, ['file', 'sha256'], ['sourcePath'])) return false;
  const sourcePath = fieldValue(value, 'sourcePath');
  return nonEmptyString(fieldValue(value, 'file'))
    && (sourcePath === undefined || nonEmptyString(sourcePath))
    && sha256(fieldValue(value, 'sha256'));
};

const validateCommandBase = (
  value: UnknownRecord,
  expectedLayer: string,
  drawable: Rect,
): Validation<true> => {
  const base = ['id', 'layer', 'order', 'gameTruth', 'gameVerified'];
  const optional = ['nodeId', 'frameId', 'source', 'clipRect'];
  if (fieldValue(value, 'layer') !== expectedLayer) return refusal('invalid-command', 'command layer membership does not match its issued layer');
  if (!nonEmptyString(fieldValue(value, 'id'))) return refusal('invalid-command', 'paint command id is empty');
  if (fieldValue(value, 'gameTruth') !== X4_UI_CANVAS_GAME_TRUTH || fieldValue(value, 'gameVerified') !== false) {
    return refusal('game-truth', 'paint command carries escalated game truth');
  }
  const nodeId = fieldValue(value, 'nodeId');
  const frameId = fieldValue(value, 'frameId');
  if (nodeId !== undefined && !nonEmptyString(nodeId) || frameId !== undefined && !nonEmptyString(frameId)) {
    return refusal('invalid-command', 'paint command node or frame identity is malformed');
  }
  if (hasField(value, 'source') && !validSource(fieldValue(value, 'source'))) {
    return refusal('invalid-command', 'paint command source location is malformed');
  }
  if (hasField(value, 'clipRect') && !validRect(fieldValue(value, 'clipRect'), drawable, false)) {
    return refusal('invalid-clip', 'paint command clip rectangle is unsafe or outside the drawable');
  }
  if (!base.every(key => hasField(value, key)) || !optional.every(key => !hasField(value, key) || ownField(value, key).valid)) {
    return refusal('invalid-command', 'paint command contains an accessor or malformed base field');
  }
  return { ok: true, value: true };
};

const fontForGlyph = (
  descriptorValue: unknown,
  atlasValue: unknown,
  fonts: { readonly regular: FontBinding; readonly bold: FontBinding },
): FontBinding | undefined => {
  const matches = [fonts.regular, fonts.bold].filter(font =>
    validIdentity(descriptorValue, font.descriptorPath, font.descriptorSha256)
    && exactRecord(atlasValue, ['relativePath', 'sha256', 'width', 'height'])
    && fieldValue(atlasValue, 'relativePath') === font.atlasPath
    && fieldValue(atlasValue, 'sha256') === font.atlasSha256
    && fieldValue(atlasValue, 'width') === font.width
    && fieldValue(atlasValue, 'height') === font.height,
  );
  return matches.length === 1 ? matches[0] : undefined;
};

const validKeepOutGeometry = (value: unknown, drawable: Rect): boolean => {
  if (value === null) return true;
  if (!isPlainDataRecord(value) || !hasField(value, 'kind')) return false;
  const kind = fieldValue(value, 'kind');
  if (kind === 'horizontal-guide') {
    return exactRecord(value, ['kind', 'y']) && safeNumber(fieldValue(value, 'y'))
      && (fieldValue(value, 'y') as number) >= 0 && (fieldValue(value, 'y') as number) <= drawable.height;
  }
  if (kind === 'vertical-guide') {
    return exactRecord(value, ['kind', 'x']) && safeNumber(fieldValue(value, 'x'))
      && (fieldValue(value, 'x') as number) >= 0 && (fieldValue(value, 'x') as number) <= drawable.width;
  }
  if (kind !== 'polygon' || !exactRecord(value, ['kind', 'points']) || !isDenseArray(fieldValue(value, 'points'), 100_000)) return false;
  const points = fieldValue(value, 'points') as readonly unknown[];
  return points.length >= 3 && points.every(point => exactRecord(point, ['x', 'y'])
    && safeNumber(fieldValue(point as object, 'x'))
    && safeNumber(fieldValue(point as object, 'y'))
    && (fieldValue(point as object, 'x') as number) >= 0
    && (fieldValue(point as object, 'x') as number) <= drawable.width
    && (fieldValue(point as object, 'y') as number) >= 0
    && (fieldValue(point as object, 'y') as number) <= drawable.height);
};

const copyValidatedRect = (value: unknown): Rect => ({
  x: fieldValue(value as object, 'x') as number,
  y: fieldValue(value as object, 'y') as number,
  width: fieldValue(value as object, 'width') as number,
  height: fieldValue(value as object, 'height') as number,
});

const detachedCommandBase = (value: UnknownRecord): DetachedCommandBase => {
  const clipValue = fieldValue(value, 'clipRect');
  return {
    id: fieldValue(value, 'id') as string,
    order: fieldValue(value, 'order') as number,
    ...(clipValue === undefined ? {} : { clip: copyValidatedRect(clipValue) }),
  };
};

const diagnosticColor = (kind: string): string => {
  switch (kind) {
    case 'selection': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.selection;
    case 'gap': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.gap;
    case 'unsupported-runtime-paint': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unsupported;
    case 'unavailable-node': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable;
    case 'empty-clip': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.emptyClip;
    case 'invalid-raster-candidate': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.invalidRaster;
    default: return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.background;
  }
};

const validateCommand = (
  value: unknown,
  expectedLayer: typeof LAYER_KINDS[number],
  drawable: Rect,
  fonts: { readonly regular: FontBinding; readonly bold: FontBinding },
): Validation<ValidatedCommand> => {
  if (!isPlainDataRecord(value) || !hasField(value, 'kind')) return refusal('invalid-command', 'paint command is not a plain data record');
  const kind = fieldValue(value, 'kind');
  const baseResult = (extraRequired: readonly string[], extraOptional: readonly string[] = []): Validation<true> => {
    if (!exactRecord(value, ['id', 'layer', 'order', 'gameTruth', 'gameVerified', 'kind', ...extraRequired], ['nodeId', 'frameId', 'source', 'clipRect', ...extraOptional])) {
      return refusal('invalid-command', 'paint command has unexpected, inherited, sparse, or accessor fields');
    }
    return validateCommandBase(value, expectedLayer, drawable);
  };
  if (expectedLayer === 'diagnostic-background') {
    if (kind !== 'node-geometry') return refusal('unsupported-command', 'diagnostic background contains a non-geometry command');
    const valid = baseResult(['completeness', 'style'], ['geometry', 'innerGeometry', 'editboxComposition', 'basePreviewTints']);
    if (isValidationFailure(valid)) return { ok: false, refusal: valid.refusal };
    const geometry = fieldValue(value, 'geometry');
    if (geometry !== undefined && !validRect(geometry, drawable, true)) return refusal('invalid-geometry', 'node geometry is unsafe or outside the drawable');
    const innerGeometry = fieldValue(value, 'innerGeometry');
    const editboxComposition = fieldValue(value, 'editboxComposition');
    if (innerGeometry === undefined !== (editboxComposition === undefined)) {
      return refusal('invalid-command', 'edit-box inner geometry and its distinct scaled-inset/fixed-text evidence must be issued together');
    }
    if (editboxComposition !== undefined && !validEditBoxComposition(editboxComposition)) {
      return refusal('invalid-command', 'edit-box composition evidence has malformed values or wrong shipped source pins');
    }
    if (innerGeometry !== undefined) {
      if (geometry === undefined || !validRect(innerGeometry, drawable, true)) return refusal('invalid-geometry', 'edit-box inner geometry is unsafe, outside the drawable, or has no outer geometry');
      const outer = geometry as object;
      const inner = innerGeometry as object;
      const outerX = fieldValue(outer, 'x') as number;
      const outerY = fieldValue(outer, 'y') as number;
      const outerRight = outerX + (fieldValue(outer, 'width') as number);
      const outerBottom = outerY + (fieldValue(outer, 'height') as number);
      const innerX = fieldValue(inner, 'x') as number;
      const innerY = fieldValue(inner, 'y') as number;
      const innerRight = innerX + (fieldValue(inner, 'width') as number);
      const innerBottom = innerY + (fieldValue(inner, 'height') as number);
      if (innerX < outerX || innerY < outerY || innerRight > outerRight || innerBottom > outerBottom) return refusal('invalid-geometry', 'edit-box inner geometry is not contained by its outer geometry');
      const innerInset = (editboxComposition as X4UiPaintEditBoxCompositionEvidence).innerInset;
      const clippedEdgeInsets = [innerX - outerX, innerY - outerY, outerRight - innerRight, outerBottom - innerBottom];
      if (clippedEdgeInsets.some(inset => inset < 0 || inset > innerInset)) {
        return refusal('invalid-geometry', 'edit-box inner geometry exceeds the source-scaled inset after clipping');
      }
    }
    if (!['complete', 'partial', 'unavailable'].includes(String(fieldValue(value, 'completeness'))) || !['source-derived', 'unavailable'].includes(String(fieldValue(value, 'style')))) {
      return refusal('invalid-command', 'node geometry completeness or style is invalid');
    }
    let tints: readonly ValidatedTint[] | undefined;
    if (hasField(value, 'basePreviewTints')) {
      const tintResult = validateBasePreviewTints(fieldValue(value, 'basePreviewTints'));
      if (isValidationFailure(tintResult)) return { ok: false, refusal: tintResult.refusal };
      tints = tintResult.value;
      const activeFillCount = tints.filter(tint => tint.slot === 'table-background' || tint.slot === 'cell-background' || tint.slot === 'widget-background').length;
      if (activeFillCount > 1) return refusal('invalid-command', 'node geometry carries multiple reassigned base fill tints');
      const innerTintCount = tints.filter(tint => tint.slot === 'editbox-inner-background').length;
      if (innerTintCount > 1 || innerGeometry === undefined && innerTintCount !== 0 || innerGeometry !== undefined && innerTintCount !== 1) return refusal('invalid-command', 'edit-box inner geometry and canonical black tint must be issued together exactly once');
    }
    if (innerGeometry !== undefined && (tints === undefined || !tints.some(tint => tint.slot === 'editbox-inner-background'))) return refusal('invalid-command', 'edit-box inner geometry requires its canonical black preview tint');
    const base = detachedCommandBase(value);
    return {
      ok: true,
      value: {
        ...base,
        kind: 'node-geometry',
        ...(geometry === undefined ? {} : { geometry: copyValidatedRect(geometry) }),
        ...(innerGeometry === undefined ? {} : { innerGeometry: copyValidatedRect(innerGeometry) }),
        ...(editboxComposition === undefined ? {} : { editboxComposition: copyEditBoxComposition(editboxComposition as X4UiPaintEditBoxCompositionEvidence) }),
        color: fieldValue(value, 'style') === 'unavailable' || fieldValue(value, 'completeness') !== 'complete'
          ? X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable
          : X4_UI_CANVAS_DIAGNOSTIC_PALETTE.geometry,
        ...(tints === undefined ? {} : { tints }),
      },
    };
  }
  if (expectedLayer === 'glyph-alpha-blits') {
    if (kind !== 'glyph-alpha-blit') return refusal('unsupported-command', 'glyph layer contains a non-glyph command');
    const valid = baseResult(['textId', 'lineIndex', 'codePoint', 'glyphIndex', 'descriptor', 'atlas', 'sourceRect', 'destinationRect', 'sourceRange', 'sourceCodePointRange', 'isEllipsis'], ['basePreviewTints']);
    if (isValidationFailure(valid)) return { ok: false, refusal: valid.refusal };
    const descriptor = fieldValue(value, 'descriptor');
    const atlas = fieldValue(value, 'atlas');
    const font = fontForGlyph(descriptor, atlas, fonts);
    if (font === undefined) return refusal('invalid-atlas', 'glyph descriptor and atlas do not map to one canonical regular or bold font');
    const sourceRect = fieldValue(value, 'sourceRect');
    const destinationRect = fieldValue(value, 'destinationRect');
    if (!validRect(sourceRect, { x: 0, y: 0, width: font.width, height: font.height }, true)) return refusal('atlas-bounds', 'glyph source rectangle is outside the selected A8 atlas');
    if (!validRect(destinationRect, drawable, true)) return refusal('invalid-geometry', 'glyph destination rectangle is unsafe or outside the drawable');
    if (!hasField(value, 'clipRect') || !validRect(fieldValue(value, 'clipRect'), drawable, false)) return refusal('invalid-clip', 'glyph command must carry an accepted clip rectangle');
    const lineIndex = fieldValue(value, 'lineIndex');
    const codePoint = fieldValue(value, 'codePoint');
    const glyphIndex = fieldValue(value, 'glyphIndex');
    if (!safeInteger(lineIndex) || !safeInteger(codePoint) || (codePoint as number) > 0x10ffff || (codePoint as number) >= 0xd800 && (codePoint as number) <= 0xdfff || !safeInteger(glyphIndex, 1) || !nonEmptyString(fieldValue(value, 'textId')) || !validRange(fieldValue(value, 'sourceRange')) || !validRange(fieldValue(value, 'sourceCodePointRange')) || typeof fieldValue(value, 'isEllipsis') !== 'boolean') {
      return refusal('invalid-command', 'glyph command metadata is unsafe or malformed');
    }
    const map = fieldValue(font.descriptor, 'codePointToGlyphIndex') as readonly unknown[];
    const records = fieldValue(font.descriptor, 'glyphRecords') as readonly unknown[];
    const mapped = map[codePoint as number];
    const record = records[(glyphIndex as number) - 1];
    if (mapped !== glyphIndex || !isPlainDataRecord(record) || fieldValue(record, 'glyphIndex') !== glyphIndex) return refusal('invalid-atlas', 'glyph command does not match the selected canonical descriptor mapping');
    const pixelBounds = fieldValue(record, 'pixelBounds');
    if (!exactRecord(pixelBounds, ['left', 'top', 'right', 'bottom'])) return refusal('invalid-atlas', 'canonical glyph pixel bounds are malformed');
    const recordRect: Rect = {
      x: fieldValue(pixelBounds, 'left') as number,
      y: fieldValue(pixelBounds, 'top') as number,
      width: (fieldValue(pixelBounds, 'right') as number) - (fieldValue(pixelBounds, 'left') as number),
      height: (fieldValue(pixelBounds, 'bottom') as number) - (fieldValue(pixelBounds, 'top') as number),
    };
    if (!validRect(recordRect, { x: 0, y: 0, width: font.width, height: font.height }, true)
      || !validRect(sourceRect, recordRect, true)) return refusal('atlas-bounds', 'glyph source rectangle is not within its canonical glyph bounds');
    let tint: ValidatedTint | undefined;
    if (hasField(value, 'basePreviewTints')) {
      const tintResult = validateBasePreviewTints(fieldValue(value, 'basePreviewTints'));
      if (isValidationFailure(tintResult)) return { ok: false, refusal: tintResult.refusal };
      if (tintResult.value.length !== 1 || (tintResult.value[0]?.slot !== 'primary-text' && tintResult.value[0]?.slot !== 'secondary-text') || (tintResult.value[0]?.field !== 'color' && tintResult.value[0]?.field !== 'defaultTextColor')) {
        return refusal('invalid-command', 'glyph basePreviewTints must carry exactly its parent primary or secondary text tint');
      }
      tint = tintResult.value[0];
    }
    return {
      ok: true,
      value: {
        ...detachedCommandBase(value),
        kind: 'glyph-alpha-blit',
        role: font.role,
        source: copyValidatedRect(sourceRect),
        destination: copyValidatedRect(destinationRect),
        ...(tint === undefined ? {} : { tint }),
      },
    };
  }
  if (expectedLayer === 'diagnostics') {
    if (typeof kind !== 'string' || !DIAGNOSTIC_KINDS.has(kind)) return refusal('unsupported-command', 'diagnostics layer contains an unsupported command kind');
    const valid = baseResult(['reason', 'sourceComposition'], ['geometry', 'category', 'status', 'operationId']);
    if (isValidationFailure(valid)) return { ok: false, refusal: valid.refusal };
    if (!nonEmptyString(fieldValue(value, 'reason'))) return refusal('invalid-command', 'diagnostic reason is empty');
    const sourceComposition = fieldValue(value, 'sourceComposition');
    if (sourceComposition !== 'visual' && sourceComposition !== 'diagnostic-only') return refusal('invalid-command', 'diagnostic source-composition classification is invalid');
    const geometry = fieldValue(value, 'geometry');
    if (geometry !== undefined && !validRect(geometry, drawable, true)) return refusal('invalid-geometry', 'diagnostic geometry is unsafe or outside the drawable');
    for (const key of ['category', 'status', 'operationId']) {
      if (hasField(value, key) && !nonEmptyString(fieldValue(value, key))) return refusal('invalid-command', 'diagnostic metadata is malformed');
    }
    return {
      ok: true,
      value: {
        ...detachedCommandBase(value),
        kind: kind as DetachedDiagnosticCommand['kind'],
        ...(geometry === undefined ? {} : { geometry: copyValidatedRect(geometry) }),
        color: diagnosticColor(kind),
        sourceComposition,
      },
    };
  }
  if (kind !== 'keep-out') return refusal('unsupported-command', 'keep-out layer contains an unsupported command kind');
  const valid = baseResult(['context', 'entryId', 'status', 'evidenceGrade', 'advisoryOnly', 'gameVerification', 'geometry'], ['reason']);
  if (isValidationFailure(valid)) return { ok: false, refusal: valid.refusal };
  const context = fieldValue(value, 'context');
  const entryId = fieldValue(value, 'entryId');
  const status = fieldValue(value, 'status');
  const evidenceGrade = fieldValue(value, 'evidenceGrade');
  const geometry = fieldValue(value, 'geometry');
  const reasonPresent = hasField(value, 'reason');
  const reason = fieldValue(value, 'reason');
  if (typeof context !== 'string' || context.trim().length === 0
    || typeof entryId !== 'string' || entryId.trim().length === 0
    || (status !== 'projected' && status !== 'unavailable')
    || typeof evidenceGrade !== 'string' || !EVIDENCE_GRADES.has(evidenceGrade)
    || fieldValue(value, 'advisoryOnly') !== true
    || fieldValue(value, 'gameVerification') !== X4_UI_CANVAS_GAME_TRUTH
    || !validKeepOutGeometry(geometry, drawable)
    || hasField(value, 'reason') && !nonEmptyString(fieldValue(value, 'reason'))) {
    return refusal('invalid-keepout', 'keep-out overlay geometry, identity, or truth is malformed');
  }
  const productionRule = KEEP_OUT_PRODUCTION_RULES.get(entryId);
  if (productionRule !== undefined) {
    const geometryKind = isPlainDataRecord(geometry) ? fieldValue(geometry, 'kind') : undefined;
    if (!KEEP_OUT_CONTEXTS.has(context)
      || status !== productionRule.status
      || evidenceGrade !== productionRule.evidenceGrade
      || productionRule.geometry === 'unavailable' && geometry !== null
      || productionRule.geometry !== 'unavailable' && geometryKind !== productionRule.geometry) {
      return refusal('invalid-keepout', 'production keep-out identity, selected preset context, grade, status, or geometry is malformed');
    }
    if (productionRule.status === 'unavailable'
      ? !reasonPresent || reason !== 'reference-unmeasured'
      : reasonPresent) {
      return refusal('invalid-keepout', 'production keep-out reason is inconsistent with its issued status');
    }
  } else if (status !== 'projected' || evidenceGrade !== 'calibrated' || geometry === null
    || !isPlainDataRecord(geometry) || fieldValue(geometry, 'kind') !== 'polygon' || reasonPresent) {
    return refusal('invalid-keepout', 'manual calibrated keep-out requires a projected polygon and calibrated evidence');
  }
  let detachedGeometry: DetachedKeepOutGeometry = null;
  if (isPlainDataRecord(geometry)) {
    const geometryKind = fieldValue(geometry, 'kind');
    if (geometryKind === 'horizontal-guide') detachedGeometry = { kind: 'horizontal-guide', y: fieldValue(geometry, 'y') as number };
    else if (geometryKind === 'vertical-guide') detachedGeometry = { kind: 'vertical-guide', x: fieldValue(geometry, 'x') as number };
    else {
      const points = fieldValue(geometry, 'points') as readonly unknown[];
      detachedGeometry = {
        kind: 'polygon',
        points: points.map(point => ({ x: fieldValue(point as object, 'x') as number, y: fieldValue(point as object, 'y') as number })),
      };
    }
  }
  return { ok: true, value: { ...detachedCommandBase(value), kind: 'keep-out', geometry: detachedGeometry } };
};

const validateResultEnvelope = (value: unknown): Validation<{ readonly status: 'projected' | 'partial'; readonly plan: unknown }> => {
  if (!isPlainDataRecord(value) || !hasField(value, 'status')) return refusal('invalid-result', 'paint result is not a plain data record');
  const status = fieldValue(value, 'status');
  if (status === 'refused') {
    if (!exactRecord(value, ['status', 'refusal', 'gameTruth', 'verification']) || fieldValue(value, 'gameTruth') !== X4_UI_CANVAS_GAME_TRUTH || !validTruthRecord(fieldValue(value, 'verification'))) {
      return refusal('invalid-result', 'refused paint result has malformed truth or envelope fields');
    }
    const paintRefusal = fieldValue(value, 'refusal');
    if (!exactRecord(paintRefusal, ['code', 'message']) || !nonEmptyString(fieldValue(paintRefusal, 'code')) || !nonEmptyString(fieldValue(paintRefusal, 'message'))) return refusal('invalid-result', 'refused paint result has malformed refusal details');
    return refusal('input-refused', `accepted paint plan result is refused: ${fieldValue(paintRefusal, 'message') as string}`);
  }
  if (status !== 'projected' && status !== 'partial') return refusal('invalid-result', 'paint result status is unsupported');
  if (!exactRecord(value, ['status', 'plan', 'verification']) || !validTruthRecord(fieldValue(value, 'verification'))) return refusal('invalid-result', 'paint result has malformed truth or envelope fields');
  return { ok: true, value: { status, plan: fieldValue(value, 'plan') } };
};

const validatePlan = (
  value: unknown,
  resultStatus: 'projected' | 'partial',
  fonts: { readonly regular: FontBinding; readonly bold: FontBinding },
): Validation<ValidatedPlan> => {
  if (!isPlainDataRecord(value) || !exactRecord(value, ['format', 'version', 'status', 'gameTruth', 'gameVerified', 'source', 'logicalDrawable', 'layers', 'sceneStatus', 'selectedNodeIds', 'keepOuts', 'diagnostics', 'verification'])) return refusal('invalid-plan', 'paint plan has unexpected, inherited, or accessor fields');
  if (!noForbiddenTruth(value)) return refusal('game-truth', 'paint plan contains forbidden engine or escalated game truth');
  if (fieldValue(value, 'format') !== X4_UI_PAINT_PLAN_FORMAT || fieldValue(value, 'version') !== X4_UI_PAINT_PLAN_VERSION || fieldValue(value, 'status') !== resultStatus || (fieldValue(value, 'status') !== 'projected' && fieldValue(value, 'status') !== 'partial') || fieldValue(value, 'gameTruth') !== X4_UI_CANVAS_GAME_TRUTH || fieldValue(value, 'gameVerified') !== false || !validTruthRecord(fieldValue(value, 'verification')) || (fieldValue(value, 'sceneStatus') !== 'projected' && fieldValue(value, 'sceneStatus') !== 'partial') || !validPlanSource(fieldValue(value, 'source'))) {
    return refusal('invalid-plan', 'paint plan format, status, source, or truth fields are invalid');
  }
  const drawableValue = fieldValue(value, 'logicalDrawable');
  if (!exactRecord(drawableValue, ['width', 'height']) || !safeInteger(fieldValue(drawableValue, 'width'), 1) || !safeInteger(fieldValue(drawableValue, 'height'), 1) || (fieldValue(drawableValue, 'width') as number) > MAX_DRAWABLE_DIMENSION || (fieldValue(drawableValue, 'height') as number) > MAX_DRAWABLE_DIMENSION) return refusal('invalid-geometry', 'paint plan logical drawable dimensions are unsafe');
  const drawable: Rect = { x: 0, y: 0, width: fieldValue(drawableValue, 'width') as number, height: fieldValue(drawableValue, 'height') as number };
  const selected = fieldValue(value, 'selectedNodeIds');
  if (!isDenseArray(selected, MAX_COMMANDS) || !(selected as readonly unknown[]).every(item => nonEmptyString(item)) || new Set(selected as readonly unknown[]).size !== (selected as readonly unknown[]).length) return refusal('invalid-plan', 'selected node ids are sparse, duplicated, or malformed');
  const layers = fieldValue(value, 'layers');
  if (!isDenseArray(layers, 4) || layers.length !== 4) return refusal('invalid-layer', 'paint plan must issue exactly four dense layers');
  const validatedLayers: ValidatedCommand[][] = [[], [], [], []];
  const flattened: ValidatedCommand[] = [];
  const ids = new Set<string>();
  const keepOutEntries = new Set<string>();
  const issuedOrders = new Set<number>();
  const previousLayerOrders = [-1, -1, -1, -1];
  const tintOwners = new Map<string, string>();
  const glyphTintOwners = new Map<string, string>();
  for (let layerIndex = 0; layerIndex < 4; layerIndex += 1) {
    const layer = layers[layerIndex];
    if (!exactRecord(layer, ['kind', 'commands']) || fieldValue(layer as object, 'kind') !== LAYER_KINDS[layerIndex] || !isDenseArray(fieldValue(layer as object, 'commands'), MAX_COMMANDS)) return refusal('invalid-layer', 'paint layer tuple or command array is malformed');
    const commands = fieldValue(layer as object, 'commands') as readonly unknown[];
    for (const commandValue of commands) {
      if (!isPlainDataRecord(commandValue) || !safeInteger(fieldValue(commandValue, 'order'))) return refusal('invalid-command', 'paint command order is unsafe or malformed');
      const order = fieldValue(commandValue, 'order') as number;
      if (issuedOrders.has(order)) return refusal('out-of-order-command', 'paint command order is duplicated');
      if (order <= previousLayerOrders[layerIndex]) return refusal('out-of-order-command', 'paint command order is not increasing within its issued layer');
      if (order !== flattened.length) return refusal('out-of-order-command', 'paint command order must equal its flattened issued index');
       previousLayerOrders[layerIndex] = order;
      issuedOrders.add(order);
      const command = validateCommand(commandValue, LAYER_KINDS[layerIndex], drawable, fonts);
      if (isValidationFailure(command)) return { ok: false, refusal: command.refusal };
      const id = fieldValue(commandValue as object, 'id') as string;
      if (ids.has(id)) return refusal('duplicate-command', `paint command id ${id} is duplicated`);
      ids.add(id);
      if (layerIndex === 3) {
        const entryId = fieldValue(commandValue as object, 'entryId');
        if (typeof entryId === 'string' && keepOutEntries.has(entryId)) return refusal('duplicate-command', `keep-out entry ${entryId} is duplicated`);
        if (typeof entryId === 'string') keepOutEntries.add(entryId);
      }
      if (command.value.kind === 'node-geometry' && command.value.tints !== undefined) {
        const owner = nonEmptyString(fieldValue(commandValue, 'nodeId')) ? fieldValue(commandValue, 'nodeId') as string : id;
        for (const tint of command.value.tints) {
          const priorOwner = tintOwners.get(tint.factKey);
          if (priorOwner !== undefined && priorOwner !== owner) return refusal('invalid-command', 'basePreviewTints fact is reassigned across geometry owners');
          tintOwners.set(tint.factKey, owner);
        }
      }
      if (command.value.kind === 'glyph-alpha-blit') {
        const textId = fieldValue(commandValue, 'textId');
        if (!nonEmptyString(textId)) return refusal('invalid-command', 'glyph text owner is malformed');
        const owner = textId as string;
        const tintKey = command.value.tint?.factKey ?? 'diagnostic';
        const priorTextTint = glyphTintOwners.get(owner);
        if (priorTextTint !== undefined && priorTextTint !== tintKey) return refusal('invalid-command', 'glyph basePreviewTints are reassigned within one text owner');
        glyphTintOwners.set(owner, tintKey);
        if (command.value.tint !== undefined) {
          const priorOwner = tintOwners.get(command.value.tint.factKey);
          if (priorOwner !== undefined && priorOwner !== owner) return refusal('invalid-command', 'basePreviewTints fact is reassigned across geometry and glyph owners');
          tintOwners.set(command.value.tint.factKey, owner);
        }
      }
      validatedLayers[layerIndex].push(command.value);
      flattened.push(command.value);
    }
  }
  for (let expectedOrder = 0; expectedOrder < flattened.length; expectedOrder += 1) {
    if (!issuedOrders.has(expectedOrder)) return refusal('out-of-order-command', 'global paint command orders must be exactly contiguous from zero');
  }
  const diagnostics = fieldValue(value, 'diagnostics');
  const keepOuts = fieldValue(value, 'keepOuts');
  const layerDiagnostics = fieldValue(layers[2] as object, 'commands');
  const layerKeepOuts = fieldValue(layers[3] as object, 'commands');
  if (!isDenseArray(diagnostics, MAX_COMMANDS) || diagnostics.length !== (layerDiagnostics as readonly unknown[]).length || !(diagnostics as readonly unknown[]).every((item, index) => item === (layerDiagnostics as readonly unknown[])[index])) return refusal('invalid-plan', 'diagnostics projection is detached or reordered from its issued layer');
  if (!isDenseArray(keepOuts, MAX_COMMANDS) || keepOuts.length !== (layerKeepOuts as readonly unknown[]).length || !(keepOuts as readonly unknown[]).every((item, index) => item === (layerKeepOuts as readonly unknown[])[index])) return refusal('invalid-plan', 'keep-out projection is detached or reordered from its issued layer');
  const atlasRoles: ('regular' | 'bold')[] = [];
  for (const item of validatedLayers[1]) {
    if (item.kind === 'glyph-alpha-blit' && !atlasRoles.includes(item.role)) atlasRoles.push(item.role);
  }
  return {
    ok: true,
    value: {
      width: drawable.width,
      height: drawable.height,
      layers: validatedLayers as unknown as ValidatedPlan['layers'],
      flattened,
      atlasRoles,
    },
  };
};

const readMethod = (receiver: unknown, name: string): Method | undefined => {
  if (!isObject(receiver)) return undefined;
  let current: object | null = receiver;
  try {
    while (current !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor !== undefined) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, 'value') || typeof descriptor.value !== 'function') return undefined;
        const method = descriptor.value as (...args: unknown[]) => unknown;
        return (...args: unknown[]) => method.apply(receiver, args);
      }
      current = Object.getPrototypeOf(current);
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const canWriteProperty = (receiver: unknown, name: string): boolean => {
  if (!isObject(receiver)) return false;
  let current: object | null = receiver;
  try {
    while (current !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor !== undefined) {
        return Object.prototype.hasOwnProperty.call(descriptor, 'value')
          ? descriptor.writable === true
          : typeof descriptor.set === 'function';
      }
      current = Object.getPrototypeOf(current);
    }
  } catch {
    return false;
  }
  return false;
};

const setProperty = (receiver: object, name: string, value: unknown): void => {
  (receiver as UnknownRecord)[name] = value;
};

const readDimension = (surface: object, name: 'width' | 'height'): number | undefined => {
  try {
    const value = (surface as UnknownRecord)[name];
    return safeInteger(value) && (value as number) <= MAX_DRAWABLE_DIMENSION ? value as number : undefined;
  } catch {
    return undefined;
  }
};

const paintApi = (context: unknown, includeAtlas: boolean): Validation<PaintApi | AtlasApi> => {
  if (!isObject(context)) return refusal('missing-context', '2D context is missing');
  const names = ['save', 'restore', 'beginPath', 'rect', 'clip', 'fillRect', 'drawImage', 'moveTo', 'lineTo', 'closePath', 'stroke'];
  const methods = new Map<string, Method>();
  for (const name of names) {
    const method = readMethod(context, name);
    if (method === undefined) return refusal('missing-context', `2D context lacks ${name}`);
    methods.set(name, method);
  }
  if (!canWriteProperty(context, 'fillStyle') || !canWriteProperty(context, 'strokeStyle')) return refusal('missing-context', '2D context lacks writable diagnostic styles');
  const base: PaintApi = {
    save: methods.get('save') as Method,
    restore: methods.get('restore') as Method,
    beginPath: methods.get('beginPath') as Method,
    rect: methods.get('rect') as Method,
    clip: methods.get('clip') as Method,
    fillRect: methods.get('fillRect') as Method,
    drawImage: methods.get('drawImage') as Method,
    moveTo: methods.get('moveTo') as Method,
    lineTo: methods.get('lineTo') as Method,
    closePath: methods.get('closePath') as Method,
    stroke: methods.get('stroke') as Method,
    setFillStyle: value => setProperty(context, 'fillStyle', value),
    setStrokeStyle: value => setProperty(context, 'strokeStyle', value),
  };
  if (!includeAtlas) return { ok: true, value: base };
  const createImageData = readMethod(context, 'createImageData');
  const putImageData = readMethod(context, 'putImageData');
  if (createImageData === undefined || putImageData === undefined) return refusal('missing-context', 'atlas staging context lacks image-data APIs');
  return { ok: true, value: { ...base, createImageData, putImageData } };
};

const surfaceFactoryDefault: X4UiCanvasSurfaceFactory = (_width, _height): X4UiCanvasSurface | undefined => {
  try {
    const globalValue = globalThis as unknown as { readonly document?: unknown };
    const documentValue = globalValue.document;
    const createElement = readMethod(documentValue, 'createElement');
    if (createElement === undefined) return undefined;
    const surface = createElement('canvas');
    return isObject(surface) ? surface as X4UiCanvasSurface : undefined;
  } catch {
    return undefined;
  }
};

interface ValidatedRenderOptions {
  readonly factory: X4UiCanvasSurfaceFactory;
  readonly presentation: X4UiCanvasPresentation;
}

const validatedOptions = (options: unknown): Validation<ValidatedRenderOptions> => {
  if (options === undefined) return { ok: true, value: { factory: surfaceFactoryDefault, presentation: 'diagnostic-map' } };
  if (!exactRecord(options, [], ['surfaceFactory', 'presentation'])) return refusal('invalid-input', 'renderer options are malformed');
  const candidate = fieldValue(options, 'surfaceFactory');
  const presentation = fieldValue(options, 'presentation');
  if (candidate !== undefined && typeof candidate !== 'function') return refusal('invalid-input', 'surfaceFactory must be callable');
  if (presentation !== undefined && presentation !== 'diagnostic-map' && presentation !== 'source-composition') return refusal('invalid-input', 'presentation must be diagnostic-map or source-composition');
  return {
    ok: true,
    value: {
      factory: candidate === undefined ? surfaceFactoryDefault : candidate as X4UiCanvasSurfaceFactory,
      presentation: presentation === 'source-composition' ? 'source-composition' : 'diagnostic-map',
    },
  };
};

const allocateSurface = (
  factory: X4UiCanvasSurfaceFactory,
  width: number,
  height: number,
  role: X4UiCanvasSurfaceRole,
  includeAtlas: boolean,
): Validation<{ readonly surface: X4UiCanvasSurface; readonly api: PaintApi | AtlasApi }> => {
  try {
    const surface = factory(width, height, role);
    if (!isObject(surface) || !canWriteProperty(surface, 'width') || !canWriteProperty(surface, 'height')) return refusal('allocation-failure', `${role} surface allocation returned an invalid surface`);
    setProperty(surface, 'width', width);
    setProperty(surface, 'height', height);
    if (readDimension(surface, 'width') !== width || readDimension(surface, 'height') !== height) return refusal('allocation-failure', `${role} surface dimensions could not be established`);
    const getContext = readMethod(surface, 'getContext');
    if (getContext === undefined) return refusal('missing-context', `${role} surface lacks getContext`);
    const context = getContext('2d');
    const api = paintApi(context, includeAtlas);
    if (isValidationFailure(api)) return { ok: false, refusal: api.refusal };
    return { ok: true, value: { surface, api: api.value } };
  } catch {
    return refusal('allocation-failure', `${role} surface allocation or context acquisition failed`);
  }
};

const tintByte = (value: number): number => Math.round(value);

/**
 * Stage detached raw A8 bytes through the shipped Zekton SDF transfer before
 * applying caller alpha. Canvas resampling is still browser-preview behavior,
 * not X4 runtime parity.
 */
const stageAtlas = (
  factory: X4UiCanvasSurfaceFactory,
  binding: AtlasSnapshot,
  tint?: ValidatedTint,
): Validation<{ readonly surface: X4UiCanvasSurface; readonly api: PaintApi }> => {
  const allocated = allocateSurface(factory, binding.width, binding.height, `${binding.role}-atlas`, true);
  if (isValidationFailure(allocated)) return { ok: false, refusal: allocated.refusal };
  const api = allocated.value.api as AtlasApi;
  try {
    const rawAlphaBytes = binding.alphaBytes.slice();
    const imageData = api.createImageData(binding.width, binding.height);
    if (!isObject(imageData)) return refusal('allocation-failure', `${binding.role} atlas image-data allocation failed`);
    const data = (imageData as UnknownRecord).data;
    if (!(data instanceof Uint8ClampedArray) || data.length !== rawAlphaBytes.length * 4) return refusal('allocation-failure', `${binding.role} atlas image-data has unsafe dimensions`);
    for (let index = 0; index < rawAlphaBytes.length; index += 1) {
      const offset = index * 4;
      data[offset] = tint === undefined ? 229 : tintByte(tint.red);
      data[offset + 1] = tint === undefined ? 231 : tintByte(tint.green);
      data[offset + 2] = tint === undefined ? 235 : tintByte(tint.blue);
      // Typed tint RGB and SDF/caller alpha use one deterministic positive-value half-up byte rule; CSS keeps raw tint values.
      data[offset + 3] = applyZektonSdfAlpha(rawAlphaBytes[index] as number, tint?.alphaScale ?? 1);
    }
    api.putImageData(imageData, 0, 0);
    return { ok: true, value: { surface: allocated.value.surface, api } };
  } catch {
    return refusal('allocation-failure', `${binding.role} atlas image-data staging failed`);
  }
};

const tintStyle = (tint: ValidatedTint): string => `rgba(${String(tint.red)}, ${String(tint.green)}, ${String(tint.blue)}, ${String(tint.alphaScale)})`;

const atlasSurfaceKey = (role: 'regular' | 'bold', tint?: ValidatedTint): string => `${role}|${tint?.drawableKey ?? 'diagnostic'}`;

const withClip = (api: PaintApi, clip: Rect | undefined, draw: () => void): void => {
  if (clip === undefined) {
    draw();
    return;
  }
  api.save();
  try {
    api.beginPath();
    api.rect(clip.x, clip.y, clip.width, clip.height);
    api.clip();
    draw();
  } finally {
    api.restore();
  }
};

type PaintOperation = (api: PaintApi) => void;

const activeFillTint = (tints: readonly ValidatedTint[] | undefined): ValidatedTint | undefined => tints?.find(tint => tint.slot === 'table-background' || tint.slot === 'cell-background' || tint.slot === 'widget-background');

const borderTint = (tints: readonly ValidatedTint[] | undefined): ValidatedTint | undefined => tints?.find(tint => tint.slot === 'widget-border');

const positiveRect = (x: number, y: number, width: number, height: number): Rect | undefined => width <= 0 || height <= 0 ? undefined : { x, y, width, height };

const subtractRectangles = (base: Rect, exclusions: readonly Rect[]): readonly Rect[] => {
  let remaining: Rect[] = [base];
  for (const exclusion of exclusions) {
    const next: Rect[] = [];
    for (const candidate of remaining) {
      const overlap = intersectRectangles(candidate, exclusion);
      if (overlap === undefined) {
        next.push(candidate);
        continue;
      }
      const candidateRight = candidate.x + candidate.width;
      const candidateBottom = candidate.y + candidate.height;
      const overlapRight = overlap.x + overlap.width;
      const overlapBottom = overlap.y + overlap.height;
      const top = positiveRect(candidate.x, candidate.y, candidate.width, overlap.y - candidate.y);
      const bottom = positiveRect(candidate.x, overlapBottom, candidate.width, candidateBottom - overlapBottom);
      const left = positiveRect(candidate.x, overlap.y, overlap.x - candidate.x, overlap.height);
      const right = positiveRect(overlapRight, overlap.y, candidateRight - overlapRight, overlap.height);
      if (top !== undefined) next.push(top);
      if (bottom !== undefined) next.push(bottom);
      if (left !== undefined) next.push(left);
      if (right !== undefined) next.push(right);
    }
    remaining = next;
    if (remaining.length === 0) break;
  }
  return remaining;
};

const intersectRectangles = (left: Rect | undefined, right: Rect | undefined): Rect | undefined => {
  if (left === undefined) return right;
  if (right === undefined) return left;
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  return positiveRect(x, y, rightEdge - x, bottomEdge - y);
};

const sourceCompositionCoverage = (validated: ValidatedPlan): readonly Rect[] => {
  const coverage: Rect[] = [];
  for (const command of validated.layers[0]) {
    if (command.kind !== 'node-geometry' || command.geometry === undefined) continue;
    if (activeFillTint(command.tints) === undefined && borderTint(command.tints) === undefined) continue;
    const visible = intersectRectangles(command.geometry, command.clip);
    if (visible !== undefined) coverage.push(visible);
  }
  for (const command of validated.layers[1]) {
    if (command.kind !== 'glyph-alpha-blit') continue;
    const visible = intersectRectangles(command.destination, command.clip);
    if (visible !== undefined) coverage.push(visible);
  }
  return coverage;
};

const buildOperations = (
  validated: ValidatedPlan,
  atlasSurfaces: ReadonlyMap<string, X4UiCanvasSurface>,
  presentation: X4UiCanvasPresentation,
): Validation<readonly PaintOperation[]> => {
  try {
    const operations: PaintOperation[] = [];
    const preserveCoverage = presentation === 'source-composition' ? sourceCompositionCoverage(validated) : [];
    for (const layer of validated.layers) {
      for (const item of layer) {
        if (item.kind === 'node-geometry') {
          const geometry = item.geometry;
          const clip = item.clip;
          const color = item.color;
          const fillTint = activeFillTint(item.tints);
          const innerFillTint = item.tints?.find(tint => tint.slot === 'editbox-inner-background');
          const outlineTint = borderTint(item.tints);
          operations.push(api => {
            if (presentation === 'source-composition') {
              if (geometry === undefined || (fillTint === undefined && outlineTint === undefined)) return;
              if (fillTint !== undefined) api.setFillStyle(tintStyle(fillTint));
              withClip(api, clip, () => {
                if (fillTint !== undefined) api.fillRect(geometry.x, geometry.y, geometry.width, geometry.height);
                if (item.innerGeometry !== undefined && innerFillTint !== undefined) {
                  api.setFillStyle(tintStyle(innerFillTint));
                  api.fillRect(item.innerGeometry.x, item.innerGeometry.y, item.innerGeometry.width, item.innerGeometry.height);
                }
                if (outlineTint !== undefined) {
                  api.setStrokeStyle(tintStyle(outlineTint));
                  api.beginPath();
                  api.rect(geometry.x, geometry.y, geometry.width, geometry.height);
                  api.stroke();
                }
              });
              return;
            }
            api.setFillStyle(fillTint === undefined ? color : tintStyle(fillTint));
            if (geometry !== undefined) withClip(api, clip, () => {
              api.fillRect(geometry.x, geometry.y, geometry.width, geometry.height);
              if (outlineTint !== undefined) {
                api.setStrokeStyle(tintStyle(outlineTint));
                api.beginPath();
                api.rect(geometry.x, geometry.y, geometry.width, geometry.height);
                api.stroke();
              }
            });
          });
          continue;
        }
        if (item.kind === 'glyph-alpha-blit') {
          const surface = atlasSurfaces.get(atlasSurfaceKey(item.role, item.tint));
          const source = item.source;
          const destination = item.destination;
          const clip = item.clip;
          if (surface === undefined) return refusal('invalid-atlas', 'validated glyph command lost its canonical atlas staging surface');
          operations.push(api => withClip(api, clip, () => {
            api.setFillStyle(item.tint === undefined ? X4_UI_CANVAS_DIAGNOSTIC_PALETTE.glyph : tintStyle(item.tint));
            api.drawImage(surface, source.x, source.y, source.width, source.height, destination.x, destination.y, destination.width, destination.height);
          }));
          continue;
        }
        if (item.kind === 'keep-out') {
          const geometry = item.geometry;
          operations.push(api => {
            api.setStrokeStyle(geometry === null ? X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailableKeepOut : X4_UI_CANVAS_DIAGNOSTIC_PALETTE.keepOut);
            if (geometry === null) return;
            if (geometry.kind === 'horizontal-guide') {
              api.beginPath();
              api.moveTo(0, geometry.y);
              api.lineTo(validated.width, geometry.y);
              api.stroke();
            } else if (geometry.kind === 'vertical-guide') {
              api.beginPath();
              api.moveTo(geometry.x, 0);
              api.lineTo(geometry.x, validated.height);
              api.stroke();
            } else {
              const points = geometry.points;
              const first = points[0];
              if (first === undefined) return;
              api.beginPath();
              api.moveTo(first.x, first.y);
              for (const point of points.slice(1)) {
                api.lineTo(point.x, point.y);
              }
              api.closePath();
              api.stroke();
            }
          });
          continue;
        }
        if (DIAGNOSTIC_KINDS.has(item.kind)) {
          const geometry = item.geometry ?? item.clip;
          const clip = item.clip;
          const color = item.color;
          operations.push(api => {
            if (presentation === 'diagnostic-map') {
              api.setFillStyle(color);
              if (geometry === undefined) return;
              withClip(api, clip, () => { api.fillRect(geometry.x, geometry.y, geometry.width, geometry.height); });
              return;
            }
            if (item.sourceComposition === 'diagnostic-only') return;
            api.setStrokeStyle(color);
            if (geometry === undefined) return;
            const visibleGeometry = intersectRectangles(geometry, clip);
            if (visibleGeometry === undefined) return;
            for (const fragment of subtractRectangles(visibleGeometry, preserveCoverage)) {
              withClip(api, clip, () => {
                api.beginPath();
                api.rect(fragment.x, fragment.y, fragment.width, fragment.height);
                api.stroke();
              });
            }
          });
          continue;
        }
        return refusal('unsupported-command', 'validated command kind has no Canvas operation');
      }
    }
    return { ok: true, value: operations };
  } catch {
    return refusal('surface-failure', 'paint operation staging failed deterministically');
  }
};

/** Convert an accepted logical X4 paint plan into diagnostic Canvas pixels. */
export function renderX4UiPaintPlanToCanvas(
  result: X4UiPaintPlanResult,
  corpus: X4UiCorpusCanonicalSuccess,
  options?: X4UiCanvasRenderOptions,
): X4UiCanvasRenderResult {
  try {
    const resultValidation = validateResultEnvelope(result);
    if (isValidationFailure(resultValidation)) return makeRefusalResult({ ok: false, refusal: resultValidation.refusal });
    const corpusValidation = validateCorpus(corpus);
    if (isValidationFailure(corpusValidation)) return makeRefusalResult({ ok: false, refusal: corpusValidation.refusal });
    const planValidation = validatePlan(resultValidation.value.plan, resultValidation.value.status, corpusValidation.value);
    if (isValidationFailure(planValidation)) return makeRefusalResult({ ok: false, refusal: planValidation.refusal });
    const acceptedResultFingerprint = structuralFingerprint(result);
    if (acceptedResultFingerprint === undefined) return makeRefusalResult(refusal('invalid-result', 'paint result cannot be fingerprinted as exact own data'));
    const atlasSnapshots: { readonly regular: AtlasSnapshot; readonly bold: AtlasSnapshot } = {
      regular: {
        role: 'regular',
        width: corpusValidation.value.regular.width,
        height: corpusValidation.value.regular.height,
        alphaBytes: corpusValidation.value.regular.alphaBytes.slice(),
      },
      bold: {
        role: 'bold',
        width: corpusValidation.value.bold.width,
        height: corpusValidation.value.bold.height,
        alphaBytes: corpusValidation.value.bold.alphaBytes.slice(),
      },
    };
    const optionsValidation = validatedOptions(options);
    if (isValidationFailure(optionsValidation)) return makeRefusalResult({ ok: false, refusal: optionsValidation.refusal });
    const { factory, presentation } = optionsValidation.value;

    const atlasSurfaces = new Map<string, X4UiCanvasSurface>();
    for (const item of planValidation.value.flattened) {
      if (item.kind !== 'glyph-alpha-blit') continue;
      const key = atlasSurfaceKey(item.role, item.tint);
      if (atlasSurfaces.has(key)) continue;
      const binding = atlasSnapshots[item.role];
      const staged = stageAtlas(factory, binding, item.tint);
      if (isValidationFailure(staged)) return makeRefusalResult({ ok: false, refusal: staged.refusal });
      atlasSurfaces.set(key, staged.value.surface);
    }

    const composite = allocateSurface(
      factory,
      planValidation.value.width,
      planValidation.value.height,
      'composite',
      false,
    );
    if (isValidationFailure(composite)) return makeRefusalResult({ ok: false, refusal: composite.refusal });
    const compositeApi = composite.value.api as PaintApi;
    const operations = buildOperations(planValidation.value, atlasSurfaces, presentation);
    if (isValidationFailure(operations)) return makeRefusalResult({ ok: false, refusal: operations.refusal });
    try {
      for (const operation of operations.value) operation(compositeApi);
    } catch {
      return makeRefusalResult(refusal('surface-failure', 'renderer-owned composite Canvas paint failed'));
    }

    const finalFingerprint = structuralFingerprint(result);
    if (finalFingerprint === undefined || finalFingerprint !== acceptedResultFingerprint || !isX4UiCorpusCanonicalSuccess(corpus)) {
      return makeRefusalResult(refusal('post-validation-mutation', 'paint result or canonical corpus changed during renderer callbacks'));
    }
    const commandIds = planValidation.value.flattened.map(item => item.id);
    return makeRenderedResult(composite.value.surface, planValidation.value.width, planValidation.value.height, commandIds, planValidation.value.atlasRoles);
  } catch {
    return makeRefusalResult(refusal('invalid-input', 'renderer rejected malformed input without producing a product exception'));
  }
}

export const renderX4UiCanvas = renderX4UiPaintPlanToCanvas;
