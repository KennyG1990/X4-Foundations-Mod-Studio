#!/usr/bin/env tsx
/**
 * B119 Forge-vs-X4 parity receipt classifier.
 *
 * This validates declared measurements against exact image/source identities. It
 * deliberately does not decode images or independently extract pixels.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const B119_PARITY_RECEIPT_SCHEMA = 'forge.x4-ui-parity-receipt.v1' as const;
export const B119_PARITY_RECEIPT_VERSION = 1 as const;
export const B119_PARITY_MAX_THRESHOLD_PX = 5 as const;
export const B119_PARITY_MENU_IDS = ['A', 'B', 'C'] as const;

export type ParityMenuId = (typeof B119_PARITY_MENU_IDS)[number];

export const B119_PARITY_MENU_TARGETS: Readonly<Record<ParityMenuId, string>> = Object.freeze({
  A: 'menuA.createFrame',
  B: 'menuB.createFrame',
  C: 'menuC.createFrame',
});

export const B119_PARITY_COLUMN_COUNTS: Readonly<Record<ParityMenuId, number>> = Object.freeze({
  A: 3,
  B: 4,
  C: 5,
});

export const B119_PARITY_BUTTON_COUNTS: Readonly<Record<ParityMenuId, number>> = Object.freeze({
  A: 3,
  B: 4,
  C: 5,
});

export const B119_PARITY_WRAPPED_LINE_COUNTS: Readonly<Record<ParityMenuId, number>> = Object.freeze({
  A: 3,
  B: 3,
  C: 2,
});

export interface ParityImageIdentity {
  path: string;
  sha256: string;
}

export interface ParityLuaSourceIdentity {
  path: string;
  sha256: string;
}

export interface ParitySemanticObservation {
  wrappedLineEndings: string[];
  finalVisibleOverflow: {
    text: string;
    glyph: string;
  };
}

export type ParityNumericFeatureMap = Record<string, number>;

export interface ParityMenuReceipt {
  id: ParityMenuId;
  target: string;
  images: {
    forge: ParityImageIdentity;
    x4: ParityImageIdentity;
  };
  geometry: {
    forge: ParityNumericFeatureMap;
    x4: ParityNumericFeatureMap;
  };
  semantic: {
    forge: ParitySemanticObservation;
    x4: ParitySemanticObservation;
  };
}

export interface ParityReceipt {
  schema: typeof B119_PARITY_RECEIPT_SCHEMA;
  version: typeof B119_PARITY_RECEIPT_VERSION;
  thresholdPx: number;
  identities: {
    luaSource: {
      forge: ParityLuaSourceIdentity;
      x4: ParityLuaSourceIdentity;
    };
    renderProfile: {
      forge: string;
      x4: string;
    };
  };
  menus: ParityMenuReceipt[];
}

export interface ParityReceiptIssue {
  code: string;
  path: string;
  message: string;
  feature?: string;
  field?: string;
  deltaPx?: number;
  thresholdPx?: number;
  forgeOnly?: string[];
  x4Only?: string[];
  expected?: unknown;
  actual?: unknown;
}

export interface AcceptedParityReceiptClassification {
  accepted: true;
  schema: typeof B119_PARITY_RECEIPT_SCHEMA;
  version: typeof B119_PARITY_RECEIPT_VERSION;
  thresholdPx: number;
  menusChecked: number;
  featuresChecked: number;
  maxDeltaPx: number;
}

export interface RejectedParityReceiptClassification {
  accepted: false;
  errors: ParityReceiptIssue[];
}

export type ParityReceiptClassification =
  | AcceptedParityReceiptClassification
  | RejectedParityReceiptClassification;

type JsonRecord = Record<string, unknown>;
type IssueDetails = Partial<Omit<ParityReceiptIssue, 'code' | 'path' | 'message'>>;

interface ParsedFeatureMap {
  keys: string[];
  values: ParityNumericFeatureMap;
}

interface ParsedSemanticObservation {
  wrappedLineEndings: string[];
  finalVisibleOverflow: {
    text: string;
    glyph: string;
  };
}

interface MenuMetrics {
  featuresChecked: number;
  maxDeltaPx: number;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const REQUIRED_RECEIPT_KEYS = ['schema', 'version', 'thresholdPx', 'identities', 'menus'];
const REQUIRED_IDENTITIES_KEYS = ['luaSource', 'renderProfile'];
const REQUIRED_IMAGE_KEYS = ['forge', 'x4'];
const REQUIRED_IMAGE_IDENTITY_KEYS = ['path', 'sha256'];
const REQUIRED_SOURCE_KEYS = ['forge', 'x4'];
const REQUIRED_RENDER_PROFILE_KEYS = ['forge', 'x4'];
const REQUIRED_MENU_KEYS = ['id', 'target', 'images', 'geometry', 'semantic'];
const REQUIRED_GEOMETRY_KEYS = ['forge', 'x4'];
const REQUIRED_SEMANTIC_KEYS = ['forge', 'x4'];
const REQUIRED_OBSERVATION_KEYS = ['wrappedLineEndings', 'finalVisibleOverflow'];
const REQUIRED_OVERFLOW_KEYS = ['text', 'glyph'];

function makeRequiredGeometryFeatures(columnCount: number, buttonCount: number, wrappedLineCount: number): readonly string[] {
  const features = [
    'table.left',
    'table.right',
    'table.top',
    'table.bottom',
    ...Array.from({ length: columnCount + 1 }, (_, index) => `columns.boundary${index + 1}`),
    ...Array.from({ length: 6 }, (_, index) => `rows.row${index + 1}.top`),
    ...Array.from({ length: 6 }, (_, index) => `rows.row${index + 1}.bottom`),
    ...Array.from(
      { length: buttonCount },
      (_, index) => [`buttons.button${index + 1}.left`, `buttons.button${index + 1}.right`, `buttons.button${index + 1}.top`, `buttons.button${index + 1}.bottom`],
    ).flat(),
    ...Array.from({ length: wrappedLineCount }, (_, index) => `wrapped.line${index + 1}.baseline`),
    'overflow.finalGlyphX',
    'overflow.rightCellEdgeX',
  ];
  return Object.freeze(features.sort(compareStrings));
}

export const B119_PARITY_REQUIRED_GEOMETRY_FEATURES: Readonly<Record<ParityMenuId, readonly string[]>> = Object.freeze({
  A: makeRequiredGeometryFeatures(B119_PARITY_COLUMN_COUNTS.A, B119_PARITY_BUTTON_COUNTS.A, B119_PARITY_WRAPPED_LINE_COUNTS.A),
  B: makeRequiredGeometryFeatures(B119_PARITY_COLUMN_COUNTS.B, B119_PARITY_BUTTON_COUNTS.B, B119_PARITY_WRAPPED_LINE_COUNTS.B),
  C: makeRequiredGeometryFeatures(B119_PARITY_COLUMN_COUNTS.C, B119_PARITY_BUTTON_COUNTS.C, B119_PARITY_WRAPPED_LINE_COUNTS.C),
});

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableNumber(value: number): number {
  return Number(value.toFixed(12));
}

function isJsonRecord(value: unknown): value is JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function makeIssue(code: string, issuePath: string, message: string, details: IssueDetails = {}): ParityReceiptIssue {
  return { code, path: issuePath, message, ...details };
}

function addIssue(
  issues: ParityReceiptIssue[],
  code: string,
  issuePath: string,
  message: string,
  details: IssueDetails = {},
): void {
  issues.push(makeIssue(code, issuePath, message, details));
}

function sortedIssues(issues: ParityReceiptIssue[]): ParityReceiptIssue[] {
  return [...issues].sort((left, right) => {
    const leftKey = [left.path, left.code, left.feature ?? '', left.field ?? '', left.message].join('\u0000');
    const rightKey = [right.path, right.code, right.feature ?? '', right.field ?? '', right.message].join('\u0000');
    return compareStrings(leftKey, rightKey);
  });
}

function rejected(issues: ParityReceiptIssue[]): RejectedParityReceiptClassification {
  return { accepted: false, errors: sortedIssues(issues) };
}

function requireExactKeys(
  value: JsonRecord,
  expectedKeys: string[],
  objectPath: string,
  issues: ParityReceiptIssue[],
): void {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value).sort(compareStrings)) {
    if (!expected.has(key)) {
      addIssue(issues, 'UNKNOWN_FIELD', `${objectPath}.${key}`, `unknown field "${key}"`);
    }
  }
  for (const key of [...expected].sort(compareStrings)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      addIssue(issues, 'MISSING_FIELD', `${objectPath}.${key}`, `required field "${key}" is missing`);
    }
  }
}

function readNonEmptyString(value: JsonRecord, key: string, issuePath: string, issues: ParityReceiptIssue[], code: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
  const candidate = value[key];
  if (typeof candidate !== 'string' || candidate.trim() === '' || candidate.includes('\u0000')) {
    addIssue(issues, code, issuePath, `${issuePath} must be a non-empty string`);
    return undefined;
  }
  return candidate;
}

function readSha256(value: JsonRecord, issuePath: string, issues: ParityReceiptIssue[], code: string): string | undefined {
  const candidate = value.sha256;
  if (typeof candidate !== 'string' || !SHA256_PATTERN.test(candidate)) {
    addIssue(issues, code, issuePath, `${issuePath} must be a 64-character SHA-256 hex digest`);
    return undefined;
  }
  return candidate.toLowerCase();
}

function isMenuBoundImagePath(imagePath: string, menuId: ParityMenuId): boolean {
  const basename = imagePath.replaceAll('\\', '/').split('/').pop() ?? '';
  const menuToken = menuId.toLowerCase();
  return new RegExp(`(?:^|[^a-z0-9])(?:menu[-_]?)?${menuToken}(?:[^a-z0-9]|$)`, 'i').test(basename);
}

function validateImageIdentity(
  value: unknown,
  objectPath: string,
  issues: ParityReceiptIssue[],
  menuId?: ParityMenuId,
): ParityImageIdentity | undefined {
  if (!isJsonRecord(value)) {
    addIssue(issues, 'INVALID_IMAGE_IDENTITY', objectPath, `${objectPath} must be an object`);
    return undefined;
  }
  requireExactKeys(value, REQUIRED_IMAGE_IDENTITY_KEYS, objectPath, issues);
  const imagePath = readNonEmptyString(value, 'path', `${objectPath}.path`, issues, 'INVALID_IMAGE_IDENTITY');
  const sha256 = Object.prototype.hasOwnProperty.call(value, 'sha256')
    ? readSha256(value, `${objectPath}.sha256`, issues, 'INVALID_IMAGE_IDENTITY')
    : undefined;
  if (imagePath === undefined || sha256 === undefined) return undefined;
  if (!/\.png$/i.test(imagePath)) {
    addIssue(issues, 'INVALID_IMAGE_IDENTITY', `${objectPath}.path`, `${objectPath}.path must name a PNG image`);
  }
  if (menuId !== undefined && !isMenuBoundImagePath(imagePath, menuId)) {
    addIssue(
      issues,
      'IMAGE_IDENTITY_NOT_MENU_BOUND',
      `${objectPath}.path`,
      `${objectPath}.path must be a menu-${menuId.toLowerCase()} PNG path`,
      { expected: `PNG path containing a menu-${menuId.toLowerCase()} token`, actual: imagePath },
    );
  }
  return { path: imagePath, sha256 };
}

function validateLuaSourceIdentity(value: unknown, objectPath: string, issues: ParityReceiptIssue[]): ParityLuaSourceIdentity | undefined {
  if (!isJsonRecord(value)) {
    addIssue(issues, 'INVALID_LUA_SOURCE_IDENTITY', objectPath, `${objectPath} must be an object`);
    return undefined;
  }
  requireExactKeys(value, REQUIRED_IMAGE_IDENTITY_KEYS, objectPath, issues);
  const sourcePath = readNonEmptyString(value, 'path', `${objectPath}.path`, issues, 'INVALID_LUA_SOURCE_IDENTITY');
  const sha256 = Object.prototype.hasOwnProperty.call(value, 'sha256')
    ? readSha256(value, `${objectPath}.sha256`, issues, 'INVALID_LUA_SOURCE_IDENTITY')
    : undefined;
  if (sourcePath === undefined || sha256 === undefined) return undefined;
  return { path: sourcePath, sha256 };
}

function validateIdentities(value: unknown, issues: ParityReceiptIssue[]): void {
  if (!isJsonRecord(value)) {
    addIssue(issues, 'INVALID_IDENTITIES', 'identities', 'identities must be an object');
    return;
  }
  requireExactKeys(value, REQUIRED_IDENTITIES_KEYS, 'identities', issues);

  let forgeSource: ParityLuaSourceIdentity | undefined;
  let x4Source: ParityLuaSourceIdentity | undefined;
  const luaSource = value.luaSource;
  if (isJsonRecord(luaSource)) {
    requireExactKeys(luaSource, REQUIRED_SOURCE_KEYS, 'identities.luaSource', issues);
    forgeSource = validateLuaSourceIdentity(luaSource.forge, 'identities.luaSource.forge', issues);
    x4Source = validateLuaSourceIdentity(luaSource.x4, 'identities.luaSource.x4', issues);
    if (forgeSource && x4Source && forgeSource.sha256 !== x4Source.sha256) {
      addIssue(
        issues,
        'SOURCE_HASH_MISMATCH',
        'identities.luaSource',
        'Forge and X4 Lua source SHA-256 hashes must agree',
        { field: 'sha256', expected: forgeSource.sha256, actual: x4Source.sha256 },
      );
    }
  } else if (Object.prototype.hasOwnProperty.call(value, 'luaSource')) {
    addIssue(issues, 'INVALID_LUA_SOURCE_IDENTITY', 'identities.luaSource', 'identities.luaSource must be an object');
  }

  const renderProfile = value.renderProfile;
  if (isJsonRecord(renderProfile)) {
    requireExactKeys(renderProfile, REQUIRED_RENDER_PROFILE_KEYS, 'identities.renderProfile', issues);
    const forgeProfile = readNonEmptyString(
      renderProfile,
      'forge',
      'identities.renderProfile.forge',
      issues,
      'INVALID_RENDER_PROFILE',
    );
    const x4Profile = readNonEmptyString(
      renderProfile,
      'x4',
      'identities.renderProfile.x4',
      issues,
      'INVALID_RENDER_PROFILE',
    );
    if (forgeProfile !== undefined && x4Profile !== undefined && forgeProfile !== x4Profile) {
      addIssue(
        issues,
        'RENDER_PROFILE_MISMATCH',
        'identities.renderProfile',
        'Forge and X4 render profiles must agree',
        { field: 'renderProfile', expected: forgeProfile, actual: x4Profile },
      );
    }
  } else if (Object.prototype.hasOwnProperty.call(value, 'renderProfile')) {
    addIssue(issues, 'INVALID_RENDER_PROFILE', 'identities.renderProfile', 'identities.renderProfile must be an object');
  }

}

function validateThreshold(value: unknown, issues: ParityReceiptIssue[]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > B119_PARITY_MAX_THRESHOLD_PX) {
    addIssue(
      issues,
      'THRESHOLD_OUT_OF_RANGE',
      'thresholdPx',
      `thresholdPx must be finite, greater than 0, and at most ${B119_PARITY_MAX_THRESHOLD_PX}`,
    );
    return undefined;
  }
  return value;
}

function validateFeatureMap(value: unknown, objectPath: string, issues: ParityReceiptIssue[]): ParsedFeatureMap | undefined {
  if (!isJsonRecord(value)) {
    if (value !== undefined) addIssue(issues, 'INVALID_NUMERIC_GEOMETRY', objectPath, `${objectPath} must be an object`);
    return undefined;
  }
  const keys = Object.keys(value).sort(compareStrings);
  if (keys.length === 0) {
    addIssue(issues, 'EMPTY_NUMERIC_FEATURE_SET', objectPath, `${objectPath} must contain at least one numeric feature`);
  }
  const values: ParityNumericFeatureMap = Object.create(null) as ParityNumericFeatureMap;
  for (const feature of keys) {
    const featurePath = `${objectPath}.${feature}`;
    const candidate = value[feature];
    if (feature.trim() === '' || feature.includes('\u0000')) {
      addIssue(issues, 'INVALID_NUMERIC_FEATURE', featurePath, 'numeric feature names must be non-empty strings');
      continue;
    }
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      addIssue(
        issues,
        'NON_FINITE_NUMERIC_FEATURE',
        featurePath,
        `${featurePath} must be a finite number`,
        { feature },
      );
      continue;
    }
    values[feature] = candidate;
  }
  return { keys, values };
}

function validateGeometry(
  value: unknown,
  menuPath: string,
  menuId: ParityMenuId,
  thresholdPx: number | undefined,
  issues: ParityReceiptIssue[],
): MenuMetrics {
  if (!isJsonRecord(value)) {
    if (value !== undefined) addIssue(issues, 'INVALID_NUMERIC_GEOMETRY', `${menuPath}.geometry`, `${menuPath}.geometry must be an object`);
    return { featuresChecked: 0, maxDeltaPx: 0 };
  }
  requireExactKeys(value, REQUIRED_GEOMETRY_KEYS, `${menuPath}.geometry`, issues);
  const forge = validateFeatureMap(value.forge, `${menuPath}.geometry.forge`, issues);
  const x4 = validateFeatureMap(value.x4, `${menuPath}.geometry.x4`, issues);
  if (!forge || !x4) return { featuresChecked: 0, maxDeltaPx: 0 };

  const forgeSet = new Set(forge.keys);
  const x4Set = new Set(x4.keys);
  const expectedFeatures = B119_PARITY_REQUIRED_GEOMETRY_FEATURES[menuId];
  const expectedSet = new Set(expectedFeatures);
  const forgeOnly = forge.keys.filter(feature => !x4Set.has(feature));
  const x4Only = x4.keys.filter(feature => !forgeSet.has(feature));
  const forgeMissing = expectedFeatures.filter(feature => !forgeSet.has(feature));
  const x4Missing = expectedFeatures.filter(feature => !x4Set.has(feature));
  const forgeUnexpected = forge.keys.filter(feature => !expectedSet.has(feature));
  const x4Unexpected = x4.keys.filter(feature => !expectedSet.has(feature));
  if (
    forgeOnly.length > 0 ||
    x4Only.length > 0 ||
    forgeMissing.length > 0 ||
    x4Missing.length > 0 ||
    forgeUnexpected.length > 0 ||
    x4Unexpected.length > 0
  ) {
    addIssue(
      issues,
      'NUMERIC_FEATURE_SET_MISMATCH',
      `${menuPath}.geometry`,
      `geometry must contain the exact ${menuId} fixture feature set on both sides`,
      {
        forgeOnly,
        x4Only,
        expected: [...expectedFeatures],
        actual: { forge: forge.keys, x4: x4.keys },
      },
    );
  }

  const commonFeatures = expectedFeatures.filter(feature => forgeSet.has(feature) && x4Set.has(feature));
  let maxDeltaPx = 0;
  if (thresholdPx !== undefined) {
    for (const feature of commonFeatures) {
      const forgeValue = forge.values[feature];
      const x4Value = x4.values[feature];
      if (forgeValue === undefined || x4Value === undefined) continue;
      const deltaPx = Math.abs(forgeValue - x4Value);
      if (!Number.isFinite(deltaPx)) {
        addIssue(
          issues,
          'NON_FINITE_NUMERIC_FEATURE',
          `${menuPath}.geometry.${feature}`,
          `${menuPath}.geometry.${feature} produced a non-finite delta`,
          { feature },
        );
        continue;
      }
      const reportedDeltaPx = stableNumber(deltaPx);
      maxDeltaPx = Math.max(maxDeltaPx, deltaPx);
      if (deltaPx > thresholdPx) {
        addIssue(
          issues,
          'NUMERIC_DELTA_EXCEEDED',
          `${menuPath}.geometry.${feature}`,
          `${menuPath}.geometry.${feature} differs by ${reportedDeltaPx} px; threshold is ${thresholdPx} px`,
          { feature, deltaPx: reportedDeltaPx, thresholdPx },
        );
      }
    }
  }
  return { featuresChecked: commonFeatures.length, maxDeltaPx };
}

function readStringArray(value: JsonRecord, key: string, issuePath: string, issues: ParityReceiptIssue[]): string[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
  const candidate = value[key];
  if (!Array.isArray(candidate) || candidate.some(item => typeof item !== 'string' || item.includes('\u0000'))) {
    addIssue(issues, 'INVALID_SEMANTIC_OBSERVATION', issuePath, `${issuePath} must be an array of strings`);
    return undefined;
  }
  if (candidate.length === 0) {
    addIssue(issues, 'EMPTY_WRAPPED_LINE_OBSERVATIONS', issuePath, `${issuePath} must contain non-empty observations`);
  }
  for (let index = 0; index < candidate.length; index++) {
    if (candidate[index].trim() === '') {
      addIssue(
        issues,
        'EMPTY_WRAPPED_LINE_OBSERVATION',
        `${issuePath}[${index}]`,
        `${issuePath}[${index}] must be a non-empty observation`,
      );
    }
  }
  return [...candidate];
}

function validateSemanticObservation(
  value: unknown,
  objectPath: string,
  expectedWrappedLineCount: number,
  issues: ParityReceiptIssue[],
): ParsedSemanticObservation | undefined {
  if (!isJsonRecord(value)) {
    if (value !== undefined) addIssue(issues, 'INVALID_SEMANTIC_OBSERVATION', objectPath, `${objectPath} must be an object`);
    return undefined;
  }
  requireExactKeys(value, REQUIRED_OBSERVATION_KEYS, objectPath, issues);
  const wrappedLineEndings = readStringArray(value, 'wrappedLineEndings', `${objectPath}.wrappedLineEndings`, issues);
  if (wrappedLineEndings !== undefined && wrappedLineEndings.length !== expectedWrappedLineCount) {
    addIssue(
      issues,
      'WRAPPED_LINE_COUNT_MISMATCH',
      `${objectPath}.wrappedLineEndings`,
      `${objectPath}.wrappedLineEndings must contain exactly ${expectedWrappedLineCount} observations`,
      { expected: expectedWrappedLineCount, actual: wrappedLineEndings.length },
    );
  }

  let finalVisibleOverflow: ParsedSemanticObservation['finalVisibleOverflow'] | undefined;
  const overflow = value.finalVisibleOverflow;
  if (isJsonRecord(overflow)) {
    requireExactKeys(overflow, REQUIRED_OVERFLOW_KEYS, `${objectPath}.finalVisibleOverflow`, issues);
    const text = readNonEmptyString(
      overflow,
      'text',
      `${objectPath}.finalVisibleOverflow.text`,
      issues,
      'EMPTY_SEMANTIC_OBSERVATION',
    );
    const glyph = readNonEmptyString(
      overflow,
      'glyph',
      `${objectPath}.finalVisibleOverflow.glyph`,
      issues,
      'EMPTY_SEMANTIC_OBSERVATION',
    );
    if (text !== undefined && glyph !== undefined) {
      if (!text.endsWith(glyph)) {
        addIssue(
          issues,
          'OVERFLOW_TEXT_NOT_ENDING_IN_GLYPH',
          `${objectPath}.finalVisibleOverflow.text`,
          `${objectPath}.finalVisibleOverflow.text must end in its declared glyph`,
          { field: 'finalVisibleOverflow.glyph', expected: glyph, actual: text },
        );
      }
      finalVisibleOverflow = { text, glyph };
    }
  } else if (Object.prototype.hasOwnProperty.call(value, 'finalVisibleOverflow')) {
    addIssue(
      issues,
      'INVALID_SEMANTIC_OBSERVATION',
      `${objectPath}.finalVisibleOverflow`,
      `${objectPath}.finalVisibleOverflow must be an object`,
    );
  }

  if (wrappedLineEndings === undefined || finalVisibleOverflow === undefined) return undefined;
  return { wrappedLineEndings, finalVisibleOverflow };
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateSemanticPair(value: unknown, menuPath: string, menuId: ParityMenuId, issues: ParityReceiptIssue[]): void {
  if (!isJsonRecord(value)) {
    if (value !== undefined) addIssue(issues, 'INVALID_SEMANTIC_OBSERVATION', `${menuPath}.semantic`, `${menuPath}.semantic must be an object`);
    return;
  }
  requireExactKeys(value, REQUIRED_SEMANTIC_KEYS, `${menuPath}.semantic`, issues);
  const expectedWrappedLineCount = B119_PARITY_WRAPPED_LINE_COUNTS[menuId];
  const forge = validateSemanticObservation(value.forge, `${menuPath}.semantic.forge`, expectedWrappedLineCount, issues);
  const x4 = validateSemanticObservation(value.x4, `${menuPath}.semantic.x4`, expectedWrappedLineCount, issues);
  if (!forge || !x4) return;

  if (!arraysEqual(forge.wrappedLineEndings, x4.wrappedLineEndings)) {
    addIssue(
      issues,
      'SEMANTIC_MISMATCH',
      `${menuPath}.semantic.wrappedLineEndings`,
      'Forge and X4 wrapped line ending observations must agree',
      { field: 'wrappedLineEndings', expected: forge.wrappedLineEndings, actual: x4.wrappedLineEndings },
    );
  }
  if (forge.finalVisibleOverflow.text !== x4.finalVisibleOverflow.text) {
    addIssue(
      issues,
      'SEMANTIC_MISMATCH',
      `${menuPath}.semantic.finalVisibleOverflow.text`,
      'Forge and X4 final visible overflow text observations must agree',
      { field: 'finalVisibleOverflow.text', expected: forge.finalVisibleOverflow.text, actual: x4.finalVisibleOverflow.text },
    );
  }
  if (forge.finalVisibleOverflow.glyph !== x4.finalVisibleOverflow.glyph) {
    addIssue(
      issues,
      'SEMANTIC_MISMATCH',
      `${menuPath}.semantic.finalVisibleOverflow.glyph`,
      'Forge and X4 final visible overflow glyph observations must agree',
      { field: 'finalVisibleOverflow.glyph', expected: forge.finalVisibleOverflow.glyph, actual: x4.finalVisibleOverflow.glyph },
    );
  }
}

function isParityMenuId(value: unknown): value is ParityMenuId {
  return typeof value === 'string' && (B119_PARITY_MENU_IDS as readonly string[]).includes(value);
}

function validateMenuImages(
  value: unknown,
  menuPath: string,
  menuId: ParityMenuId,
  issues: ParityReceiptIssue[],
  seenImagePaths: Map<string, string>,
): void {
  if (!isJsonRecord(value)) {
    if (value !== undefined) addIssue(issues, 'INVALID_IMAGE_IDENTITY', `${menuPath}.images`, `${menuPath}.images must be an object`);
    return;
  }
  requireExactKeys(value, REQUIRED_IMAGE_KEYS, `${menuPath}.images`, issues);
  for (const role of REQUIRED_IMAGE_KEYS) {
    const identity = validateImageIdentity(value[role], `${menuPath}.images.${role}`, issues, menuId);
    if (!identity) continue;
    const normalizedPath = identity.path.replaceAll('\\', '/').toLowerCase();
    const previousOwner = seenImagePaths.get(normalizedPath);
    if (previousOwner !== undefined) {
      addIssue(
        issues,
        'DUPLICATE_IMAGE_IDENTITY',
        `${menuPath}.images.${role}.path`,
        `${menuPath}.images.${role}.path reuses an image path already bound to ${previousOwner}`,
        { expected: previousOwner, actual: identity.path },
      );
    } else {
      seenImagePaths.set(normalizedPath, `${menuId}.${role}`);
    }
  }
}

function validateMenus(value: unknown, thresholdPx: number | undefined, issues: ParityReceiptIssue[]): { menusChecked: number; featuresChecked: number; maxDeltaPx: number } {
  if (!Array.isArray(value)) {
    addIssue(issues, 'MENU_SET_MISMATCH', 'menus', 'menus must contain exactly one menu A, B, and C');
    return { menusChecked: 0, featuresChecked: 0, maxDeltaPx: 0 };
  }

  const seen = new Set<ParityMenuId>();
  const actualIds: string[] = [];
  const menuEntries: Array<{ id: ParityMenuId; index: number; value: JsonRecord }> = [];
  const seenImagePaths = new Map<string, string>();
  for (let index = 0; index < value.length; index++) {
    const menu = value[index];
    if (!isJsonRecord(menu)) {
      addIssue(issues, 'INVALID_MENU', `menus[${index}]`, `menus[${index}] must be an object`);
      continue;
    }
    requireExactKeys(menu, REQUIRED_MENU_KEYS, `menus[${index}]`, issues);
    const idValue = menu.id;
    if (typeof idValue === 'string') actualIds.push(idValue);
    if (!isParityMenuId(idValue)) {
      addIssue(issues, 'INVALID_MENU_ID', `menus[${index}].id`, 'menu id must be exactly A, B, or C');
      continue;
    }
    if (seen.has(idValue)) {
      addIssue(issues, 'DUPLICATE_MENU_ID', `menus[${index}].id`, `menu id "${idValue}" appears more than once`, { actual: idValue });
    } else {
      seen.add(idValue);
    }
    menuEntries.push({ id: idValue, index, value: menu });
  }

  const expectedIds = [...B119_PARITY_MENU_IDS];
  const missing = expectedIds.filter(id => !seen.has(id));
  const unexpected = actualIds.filter(id => !expectedIds.includes(id as ParityMenuId));
  if (value.length !== expectedIds.length || missing.length > 0 || unexpected.length > 0) {
    addIssue(
      issues,
      'MENU_SET_MISMATCH',
      'menus',
      'menus must contain exactly one menu A, B, and C',
      { expected: expectedIds, actual: [...actualIds].sort(compareStrings) },
    );
  }

  menuEntries.sort((left, right) => compareStrings(left.id, right.id) || left.index - right.index);
  let featuresChecked = 0;
  let maxDeltaPx = 0;
  for (const entry of menuEntries) {
    const menuPath = `menus[${entry.id}]`;
    const target = readNonEmptyString(entry.value, 'target', `${menuPath}.target`, issues, 'INVALID_TARGET');
    if (target !== undefined && target !== B119_PARITY_MENU_TARGETS[entry.id]) {
      addIssue(
        issues,
        'TARGET_MISMATCH',
        `${menuPath}.target`,
        `${menuPath}.target must be exactly ${B119_PARITY_MENU_TARGETS[entry.id]}`,
        { expected: B119_PARITY_MENU_TARGETS[entry.id], actual: target },
      );
    }
    validateMenuImages(entry.value.images, menuPath, entry.id, issues, seenImagePaths);
    const metrics = validateGeometry(entry.value.geometry, menuPath, entry.id, thresholdPx, issues);
    validateSemanticPair(entry.value.semantic, menuPath, entry.id, issues);
    featuresChecked += metrics.featuresChecked;
    maxDeltaPx = Math.max(maxDeltaPx, metrics.maxDeltaPx);
  }
  return { menusChecked: menuEntries.length, featuresChecked, maxDeltaPx };
}

export function classifyParityReceipt(input: unknown): ParityReceiptClassification {
  const issues: ParityReceiptIssue[] = [];
  if (!isJsonRecord(input)) {
    return rejected([makeIssue('INVALID_RECEIPT', '$', 'receipt must be a JSON object')]);
  }

  requireExactKeys(input, REQUIRED_RECEIPT_KEYS, '$', issues);
  if (input.schema !== B119_PARITY_RECEIPT_SCHEMA) {
    addIssue(issues, 'SCHEMA_MISMATCH', '$.schema', `schema must be "${B119_PARITY_RECEIPT_SCHEMA}"`);
  }
  if (input.version !== B119_PARITY_RECEIPT_VERSION) {
    addIssue(issues, 'VERSION_MISMATCH', '$.version', `version must be ${B119_PARITY_RECEIPT_VERSION}`);
  }
  const thresholdPx = validateThreshold(input.thresholdPx, issues);
  validateIdentities(input.identities, issues);
  const metrics = validateMenus(input.menus, thresholdPx, issues);

  if (issues.length > 0) return rejected(issues);
  return {
    accepted: true,
    schema: B119_PARITY_RECEIPT_SCHEMA,
    version: B119_PARITY_RECEIPT_VERSION,
    thresholdPx: thresholdPx as number,
    menusChecked: metrics.menusChecked,
    featuresChecked: metrics.featuresChecked,
    maxDeltaPx: stableNumber(metrics.maxDeltaPx),
  };
}

export const classifyReceipt = classifyParityReceipt;

export function classifyParityReceiptJson(jsonText: string): ParityReceiptClassification {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    return classifyParityReceipt(parsed);
  } catch {
    return rejected([makeIssue('JSON_PARSE_ERROR', '$', 'input is not valid JSON')]);
  }
}

function classifyFile(filePath: string): ParityReceiptClassification {
  let jsonText: string;
  try {
    jsonText = fs.readFileSync(filePath, 'utf8');
  } catch {
    return rejected([makeIssue('INPUT_READ_ERROR', '$', 'input JSON file could not be read')]);
  }
  return classifyParityReceiptJson(jsonText);
}

function runCli(args: string[]): number {
  const classification = args.length === 1
    ? classifyFile(args[0])
    : rejected([makeIssue('CLI_USAGE', '$', 'usage: x4-ui-parity-receipt.ts <receipt.json>')]);
  process.stdout.write(`${JSON.stringify(classification)}\n`);
  return classification.accepted ? 0 : 1;
}

function isMainModule(): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && path.resolve(entryPath) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) process.exitCode = runCli(process.argv.slice(2));
