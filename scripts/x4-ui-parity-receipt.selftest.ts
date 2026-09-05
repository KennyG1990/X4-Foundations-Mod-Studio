import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  B119_PARITY_MENU_TARGETS,
  B119_PARITY_REQUIRED_GEOMETRY_FEATURES,
  B119_PARITY_RECEIPT_SCHEMA,
  B119_PARITY_WRAPPED_LINE_COUNTS,
  classifyParityReceipt,
  type ParityReceipt,
  type RejectedParityReceiptClassification,
} from './x4-ui-parity-receipt';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function cloneReceipt(): ParityReceipt {
  return JSON.parse(JSON.stringify(BASE_RECEIPT)) as ParityReceipt;
}

function assertAccepted(receipt: unknown): void {
  const result = classifyParityReceipt(receipt);
  assert.equal(result.accepted, true, JSON.stringify(result));
}

function assertRejected(receipt: unknown, code: string): RejectedParityReceiptClassification {
  const result = classifyParityReceipt(receipt);
  assert.equal(result.accepted, false, 'receipt unexpectedly accepted');
  if (result.accepted) throw new Error('unreachable');
  assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result));
  return result;
}

function makeMenu(id: 'A' | 'B' | 'C', offset: number) {
  const forge = Object.fromEntries(
    B119_PARITY_REQUIRED_GEOMETRY_FEATURES[id].map((feature, index) => [feature, 100 + offset + index]),
  );
  const x4 = Object.fromEntries(
    Object.entries(forge).map(([feature, value]) => [feature, value]),
  );
  const wrappedLineEndings = Array.from(
    { length: B119_PARITY_WRAPPED_LINE_COUNTS[id] },
    (_, index) => `${id}-line-${index + 1}`,
  );
  return {
    id,
    target: B119_PARITY_MENU_TARGETS[id],
    images: {
      forge: {
        path: `evidence/b119/forge/menu-${id.toLowerCase()}-2544x1353.png`,
        sha256: sha256(`forge-image-${id}`),
      },
      x4: {
        path: `evidence/b119/x4/menu-${id.toLowerCase()}-2544x1353.png`,
        sha256: sha256(`x4-image-${id}`),
      },
    },
    geometry: { forge, x4 },
    semantic: {
      forge: {
        wrappedLineEndings,
        finalVisibleOverflow: { text: `${id} overflow]`, glyph: ']' },
      },
      x4: {
        wrappedLineEndings: [...wrappedLineEndings],
        finalVisibleOverflow: { text: `${id} overflow]`, glyph: ']' },
      },
    },
  };
}

const BASE_RECEIPT: ParityReceipt = {
  schema: B119_PARITY_RECEIPT_SCHEMA,
  version: 1,
  thresholdPx: 5,
  identities: {
    luaSource: {
      forge: { path: 'ui/b119_menu.lua', sha256: sha256('b119-lua-source') },
      x4: { path: 'ui/b119_menu.lua', sha256: sha256('b119-lua-source') },
    },
    renderProfile: {
      forge: 'b119-1080p-scale-1',
      x4: 'b119-1080p-scale-1',
    },
  },
  menus: [makeMenu('A', 0), makeMenu('B', 12), makeMenu('C', 24)],
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(repoRoot, 'scripts', 'x4-ui-parity-receipt.ts');
const tsxCliPath = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const checks: Array<[string, () => void]> = [
  ['valid A/B/C receipt passes', () => {
    const result = classifyParityReceipt(BASE_RECEIPT);
    assertAccepted(BASE_RECEIPT);
    assert.equal(result.accepted, true);
    if (!result.accepted) throw new Error('unreachable');
    assert.equal(result.menusChecked, 3);
    assert.equal(result.featuresChecked, 125);
    assert.equal(result.maxDeltaPx, 0);
  }],
  ['six-pixel perturbation names feature and delta', () => {
    const receipt = cloneReceipt();
    receipt.menus[0].geometry.x4['table.left'] += 6;
    const result = assertRejected(receipt, 'NUMERIC_DELTA_EXCEEDED');
    if (result.accepted) throw new Error('unreachable');
    const issue = result.errors.find(error => error.code === 'NUMERIC_DELTA_EXCEEDED');
    assert.ok(issue);
    assert.equal(issue.feature, 'table.left');
    assert.equal(issue.deltaPx, 6);
    assert.equal(issue.thresholdPx, 5);
  }],
  ['boundary delta of five pixels passes', () => {
    const receipt = cloneReceipt();
    receipt.menus[1].geometry.x4['buttons.button4.right'] += 5;
    assertAccepted(receipt);
  }],
  ['delta above five pixels fails', () => {
    const receipt = cloneReceipt();
    receipt.menus[1].geometry.x4['buttons.button4.right'] += 5.0001;
    const result = assertRejected(receipt, 'NUMERIC_DELTA_EXCEEDED');
    if (result.accepted) throw new Error('unreachable');
    const issue = result.errors.find(error => error.code === 'NUMERIC_DELTA_EXCEEDED');
    assert.ok(issue);
    assert.equal(issue.feature, 'buttons.button4.right');
    assert.equal(issue.deltaPx, 5.0001);
  }],
  ['schema mismatch is rejected', () => {
    const receipt = { ...cloneReceipt(), schema: 'forge.x4-ui-parity-receipt.invalid' };
    assertRejected(receipt, 'SCHEMA_MISMATCH');
  }],
  ['invalid image identity is rejected', () => {
    const receipt = cloneReceipt();
    receipt.menus[0].images.forge.path = ' ';
    receipt.menus[0].images.x4.sha256 = 'not-a-sha256';
    assertRejected(receipt, 'INVALID_IMAGE_IDENTITY');
  }],
  ['wrong menu target is rejected', () => {
    const receipt = cloneReceipt();
    receipt.menus[0].target = B119_PARITY_MENU_TARGETS.B;
    assertRejected(receipt, 'TARGET_MISMATCH');
  }],
  ['menu image paths must be menu-bound', () => {
    const receipt = cloneReceipt();
    receipt.menus[0].images.forge.path = 'evidence/b119/forge/menu-b-2544x1353.png';
    assertRejected(receipt, 'IMAGE_IDENTITY_NOT_MENU_BOUND');
  }],
  ['reused menu image path is rejected', () => {
    const receipt = cloneReceipt();
    receipt.menus[1].images.x4.path = receipt.menus[0].images.x4.path;
    const result = assertRejected(receipt, 'DUPLICATE_IMAGE_IDENTITY');
    if (result.accepted) throw new Error('unreachable');
    const issue = result.errors.find(error => error.code === 'DUPLICATE_IMAGE_IDENTITY');
    assert.ok(issue);
    assert.equal(issue.path, 'menus[B].images.x4.path');
  }],
  ['source hashes must agree', () => {
    const receipt = cloneReceipt();
    receipt.identities.luaSource.x4.sha256 = sha256('different-source');
    assertRejected(receipt, 'SOURCE_HASH_MISMATCH');
  }],
  ['render profiles must agree', () => {
    const receipt = cloneReceipt();
    receipt.identities.renderProfile.x4 = 'b119-720p-scale-1';
    assertRejected(receipt, 'RENDER_PROFILE_MISMATCH');
  }],
  ['wrapped line ending observations must agree', () => {
    const receipt = cloneReceipt();
    receipt.menus[2].semantic.x4.wrappedLineEndings[1] = 'C-line-different';
    const result = assertRejected(receipt, 'SEMANTIC_MISMATCH');
    if (result.accepted) throw new Error('unreachable');
    assert.ok(result.errors.some(error => error.field === 'wrappedLineEndings'));
  }],
  ['final overflow text and glyph observations must agree', () => {
    const receipt = cloneReceipt();
    receipt.menus[0].semantic.x4.finalVisibleOverflow.glyph = 'x';
    const result = assertRejected(receipt, 'SEMANTIC_MISMATCH');
    if (result.accepted) throw new Error('unreachable');
    assert.ok(result.errors.some(error => error.field === 'finalVisibleOverflow.glyph'));
  }],
  ['wrapped line observations must be non-empty and exact-count', () => {
    const emptyReceipt = cloneReceipt();
    emptyReceipt.menus[0].semantic.forge.wrappedLineEndings = [];
    assertRejected(emptyReceipt, 'EMPTY_WRAPPED_LINE_OBSERVATIONS');

    const wrongCountReceipt = cloneReceipt();
    wrongCountReceipt.menus[1].semantic.x4.wrappedLineEndings.pop();
    assertRejected(wrongCountReceipt, 'WRAPPED_LINE_COUNT_MISMATCH');
  }],
  ['overflow text must end in its declared glyph', () => {
    const receipt = cloneReceipt();
    receipt.menus[2].semantic.x4.finalVisibleOverflow.text = 'C overflow?';
    assertRejected(receipt, 'OVERFLOW_TEXT_NOT_ENDING_IN_GLYPH');
  }],
  ['numeric feature-set mismatch is rejected', () => {
    const receipt = cloneReceipt();
    delete receipt.menus[0].geometry.x4['columns.boundary1'];
    const result = assertRejected(receipt, 'NUMERIC_FEATURE_SET_MISMATCH');
    if (result.accepted) throw new Error('unreachable');
    const issue = result.errors.find(error => error.code === 'NUMERIC_FEATURE_SET_MISMATCH');
    assert.ok(issue);
    assert.deepEqual(issue.x4Only, []);
    assert.deepEqual(issue.forgeOnly, ['columns.boundary1']);
  }],
  ['extra or renamed geometry features are rejected', () => {
    const receipt = cloneReceipt();
    delete receipt.menus[1].geometry.forge['columns.boundary1'];
    receipt.menus[1].geometry.forge['columns.renamedBoundary'] = 123;
    assertRejected(receipt, 'NUMERIC_FEATURE_SET_MISMATCH');
  }],
  ['rejection ordering is canonical across menu order', () => {
    const ordered = cloneReceipt();
    ordered.menus[0].geometry.x4['table.left'] += 6;
    ordered.menus[2].geometry.x4['overflow.finalGlyphX'] += 6;

    const reversed = cloneReceipt();
    reversed.menus.reverse();
    reversed.menus.find(menu => menu.id === 'A')!.geometry.x4['table.left'] += 6;
    reversed.menus.find(menu => menu.id === 'C')!.geometry.x4['overflow.finalGlyphX'] += 6;

    const orderedResult = assertRejected(ordered, 'NUMERIC_DELTA_EXCEEDED');
    const reversedResult = assertRejected(reversed, 'NUMERIC_DELTA_EXCEEDED');
    assert.deepEqual(reversedResult.errors, orderedResult.errors);
  }],
  ['arbitrary tiny numeric fixture is rejected', () => {
    const receipt = cloneReceipt();
    const tinyGeometry = { 'table.left': 20, 'table.right': 480 };
    receipt.menus[0].geometry = { forge: tinyGeometry, x4: { ...tinyGeometry } };
    assertRejected(receipt, 'NUMERIC_FEATURE_SET_MISMATCH');
  }],
  ['missing menu is rejected', () => {
    const receipt = cloneReceipt();
    receipt.menus = receipt.menus.filter(menu => menu.id !== 'B');
    assertRejected(receipt, 'MENU_SET_MISMATCH');
  }],
  ['duplicate menu id is rejected', () => {
    const receipt = cloneReceipt();
    receipt.menus[2].id = 'A';
    assertRejected(receipt, 'DUPLICATE_MENU_ID');
  }],
  ['non-finite geometry is rejected', () => {
    const receipt = cloneReceipt();
    receipt.menus[0].geometry.forge['table.top'] = Number.NaN;
    assertRejected(receipt, 'NON_FINITE_NUMERIC_FEATURE');
  }],
  ['zero threshold is rejected', () => {
    const receipt = cloneReceipt();
    receipt.thresholdPx = 0;
    assertRejected(receipt, 'THRESHOLD_OUT_OF_RANGE');
  }],
  ['threshold above five is rejected', () => {
    const receipt = cloneReceipt();
    receipt.thresholdPx = 5.0001;
    assertRejected(receipt, 'THRESHOLD_OUT_OF_RANGE');
  }],
  ['closed schema rejects unknown fields', () => {
    const receipt = cloneReceipt() as ParityReceipt & { unexpected?: string };
    receipt.unexpected = 'reject me';
    assertRejected(receipt, 'UNKNOWN_FIELD');
  }],
  ['CLI classifies pass and reject with temp JSON and cleans it', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-ui-parity-receipt-selftest-'));
    try {
      const passPath = path.join(tempRoot, 'pass.json');
      const rejectPath = path.join(tempRoot, 'reject.json');
      const rejectedReceipt = cloneReceipt();
      rejectedReceipt.menus[0].geometry.x4['table.left'] += 6;
      fs.writeFileSync(passPath, `${JSON.stringify(BASE_RECEIPT)}\n`, 'utf8');
      fs.writeFileSync(rejectPath, `${JSON.stringify(rejectedReceipt)}\n`, 'utf8');

      const pass = spawnSync(process.execPath, [tsxCliPath, scriptPath, passPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      });
      assert.equal(pass.status, 0, pass.stderr || pass.error?.message);
      assert.equal(JSON.parse(pass.stdout).accepted, true);

      const reject = spawnSync(process.execPath, [tsxCliPath, scriptPath, rejectPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      });
      assert.equal(reject.status, 1, reject.stderr || reject.error?.message);
      const output = JSON.parse(reject.stdout);
      assert.equal(output.accepted, false);
      assert.equal(output.errors[0].feature, 'table.left');
      assert.equal(output.errors[0].deltaPx, 6);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    assert.equal(fs.existsSync(tempRoot), false);
  }],
];

let passed = 0;
for (const [name, run] of checks) {
  try {
    run();
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode !== 1) {
  console.log(`x4-ui-parity-receipt selftest passed: ${passed}/${checks.length} checks`);
}
