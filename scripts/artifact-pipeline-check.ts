import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildArtifactPlan,
  materializeArtifact,
  verifyMaterializedArtifact,
  type ArtifactPlan,
} from '../src/lib/artifactPipeline';
import { verifyCatDatCatalogs, writeCatDatCatalogs } from '../src/lib/x4CatDat';
import { materializeCatalogArtifact } from '../src/lib/artifactPackager';

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];
const check = (name: string, pass: boolean, detail?: unknown) => {
  checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
};

function write(root: string, relativePath: string, content: string | Buffer): void {
  const absolute = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    while (true) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (read <= 0) break;
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function included(plan: ArtifactPlan, relativePath: string) {
  return plan.entries.find(entry => entry.path === relativePath);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-artifact-check-'));
const source = path.join(root, 'source');
const output = path.join(root, 'output');
const brokenOutput = path.join(root, 'broken-output');
const catalogOutput = path.join(root, 'catalog-output');
const catalogOutputRepeat = path.join(root, 'catalog-output-repeat');
const packagedOutput = path.join(root, 'packaged-output');

try {
  fs.mkdirSync(source, { recursive: true });
  write(source, 'content.xml', '<?xml version="1.0"?><content id="artifact_torture" name="Artifact Torture" version="100"/>');
  write(source, 'md/source.xml', '<?xml version="1.0"?><mdscript name="Source"><cues/></mdscript>\r\n');
  write(source, 'aiscripts/behavior.xml', '<?xml version="1.0"?><aiscript name="behavior"/>\n');
  write(source, 'libraries/arbitrary.unknownxml', '<anything value="opaque"/>');
  write(source, 'ui/over-256k.lua', `-- deliberately above the old per-file cap\n${'x'.repeat(300 * 1024)}`);
  write(source, 'ui/under-256k.lua', `-- deliberately below the old per-file cap\n${'y'.repeat((256 * 1024) - 256)}`);
  write(source, 'assets/multi-megabyte.weirdbin', Buffer.alloc((7 * 1024 * 1024) + 123, 0xa5));
  write(source, 'textures/raw-bytes.texture', Buffer.from([0x00, 0xff, 0x7f, 0x80, 0x0d, 0x0a, 0x1a, 0x00]));
  write(source, 'unicode/船/данные.bin', Buffer.from('unicode-path-payload'));
  write(source, 'path with spaces/another file.custom', 'spaces survive');
  write(source, 'deep/a/b/c/d/e/f/g/h/file.no-known-type', 'deep survives');
  write(source, 'duplicate-a/shared.name', 'first basename');
  write(source, 'duplicate-b/shared.name', 'second basename');
  write(source, 'empty/zero.bin', Buffer.alloc(0));
  write(source, 'extensionless', 'no extension');
  write(source, 'encoding/utf8-bom.txt', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('BOM text') ]));
  write(source, 'encoding/crlf.txt', 'one\r\ntwo\r\n');
  write(source, 'encoding/lf.txt', 'one\ntwo\n');
  write(source, 't/0001-l044.xml', '<?xml version="1.0"?><language id="44"><page id="1000" title="Fixture"><t id="1">Artifact</t></page></language>');
  write(source, 'replace/me.txt', 'source version');
  write(source, 'private/secret.dat', 'must not ship');
  write(source, 'runtime/state.db', Buffer.from('runtime-owned')); 
  write(source, '.git/config', '[remote "origin"]\nurl=https://example.invalid/private.git\n');
  write(source, '.claude/session.json', '{"private":true}');
  write(source, '.kilo/state.json', '{"private":true}');
  write(source, '.forge/cache.bin', Buffer.from('private-forge-state'));
  write(source, 'node_modules/package/index.js', 'module.exports = 1');
  write(source, '.forgeartifact.json', JSON.stringify({
    exclude: ['private/**'],
    runtimeOwned: ['runtime/**'],
    catalogLoose: ['preview.*'],
  }, null, 2));
  write(source, 'preview.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  write(source, 'ext_07.cat', 'opaque pre-existing catalog manifest');
  write(source, 'ext_07.dat', Buffer.from([0xca, 0x7a, 0x10, 0x07]));

  const plan = buildArtifactPlan({
    sourceRoot: source,
    generatedFiles: {
      'md/generated.xml': '<?xml version="1.0"?><mdscript name="Generated"><cues/></mdscript>',
      'replace/me.txt': 'generated version',
    },
  });

  check('plan succeeds', plan.ok, plan.errors.join('; '));
  check('large text is source-copy', included(plan, 'ui/over-256k.lua')?.disposition === 'source-copy');
  check('multi-megabyte arbitrary binary is source-copy', included(plan, 'assets/multi-megabyte.weirdbin')?.disposition === 'source-copy');
  check('generated output is owned by compiler output', included(plan, 'md/generated.xml')?.disposition === 'generated');
  check('generated output replaces same-path source deterministically', included(plan, 'replace/me.txt')?.disposition === 'generated');
  check('unknown extension defaults to source-copy', included(plan, 'libraries/arbitrary.unknownxml')?.disposition === 'source-copy');
  check('unicode path survives planning', included(plan, 'unicode/船/данные.bin')?.disposition === 'source-copy');
  check('empty file survives planning', included(plan, 'empty/zero.bin')?.size === 0);
  check('git metadata excluded', plan.excluded.some(entry => entry.path === '.git/**'));
  check('agent metadata excluded', ['.claude/**', '.kilo/**', '.forge/**'].every(p => plan.excluded.some(entry => entry.path === p)));
  check('node_modules excluded', plan.excluded.some(entry => entry.path === 'node_modules/**'));
  check('project exclusion applied', plan.excluded.some(entry => entry.path === 'private/**' && entry.reason.includes('project')));
  check('runtime-owned path separated', plan.runtimeOwned.some(entry => entry.path === 'runtime/**'));
  check('artifact config is not shipped', plan.excluded.some(entry => entry.path === '.forgeartifact.json'));
  check('catalogLoose rule recorded', included(plan, 'preview.jpg')?.catalogLoose === true);

  const build = materializeArtifact(plan, output);
  check('materialization succeeds', build.ok, build.errors.join('; '));
  const verification = verifyMaterializedArtifact(plan, output);
  check('materialized artifact verifies', verification.ok, verification.errors.join('; '));
  check('large text hash-identical', sha256File(path.join(source, 'ui', 'over-256k.lua')) === sha256File(path.join(output, 'ui', 'over-256k.lua')));
  check('multi-megabyte binary hash-identical', sha256File(path.join(source, 'assets', 'multi-megabyte.weirdbin')) === sha256File(path.join(output, 'assets', 'multi-megabyte.weirdbin')));
  check('generated replacement wins', fs.readFileSync(path.join(output, 'replace', 'me.txt'), 'utf8') === 'generated version');
  check('excluded paths absent', !fs.existsSync(path.join(output, '.git')) && !fs.existsSync(path.join(output, 'private')));
  check('runtime-owned paths absent from fresh artifact', !fs.existsSync(path.join(output, 'runtime')));

  const catalogEntries = plan.entries
    .filter(entry => entry.path !== 'content.xml' && !entry.catalogLoose)
    .map(entry => ({
      name: entry.path,
      size: entry.size,
      sourcePath: entry.sourcePath,
      content: entry.content,
      expectedSha256: entry.sha256,
    }));
  const catalogs = writeCatDatCatalogs(catalogEntries, catalogOutput, { maxVolumeBytes: 2 * 1024 * 1024 });
  check('catalog writer succeeds', catalogs.ok, catalogs.errors.join('; '));
  check('catalog writer splits deterministic volumes without splitting files', catalogs.volumes.length >= 2);
  const catalogVerification = verifyCatDatCatalogs(catalogs);
  check('catalog reopen and hash verification succeeds', catalogVerification.ok, catalogVerification.errors.join('; '));
  check('catalog contains arbitrary and unicode paths', catalogs.volumes.some(volume => volume.entries.some(entry => entry.name === 'unicode/船/данные.bin')));
  check('content.xml and catalogLoose paths remain outside catalogs', catalogs.volumes.every(volume => volume.entries.every(entry => entry.name !== 'content.xml' && entry.name !== 'preview.jpg')));

  const repeatedCatalogs = writeCatDatCatalogs(catalogEntries, catalogOutputRepeat, { maxVolumeBytes: 2 * 1024 * 1024 });
  const firstCatalogHashes = catalogs.volumes.flatMap(volume => [sha256File(volume.catPath), sha256File(volume.datPath)]);
  const repeatCatalogHashes = repeatedCatalogs.volumes.flatMap(volume => [sha256File(volume.catPath), sha256File(volume.datPath)]);
  check('catalog build is byte-deterministic', repeatedCatalogs.ok && JSON.stringify(firstCatalogHashes) === JSON.stringify(repeatCatalogHashes), repeatedCatalogs.errors.join('; '));

  if (catalogs.volumes[0]?.bytes) {
    const fd = fs.openSync(catalogs.volumes[0].datPath, 'r+');
    try {
      const byte = Buffer.alloc(1);
      fs.readSync(fd, byte, 0, 1, 0);
      byte[0] ^= 0xff;
      fs.writeSync(fd, byte, 0, 1, 0);
    } finally {
      fs.closeSync(fd);
    }
  }
  const tamperedCatalogVerification = verifyCatDatCatalogs(catalogs);
  check('catalog tamper is detected', !tamperedCatalogVerification.ok && tamperedCatalogVerification.errors.some(error => error.includes('mismatch')), tamperedCatalogVerification.errors.join('; '));

  const unsafeCatalog = writeCatDatCatalogs([{ name: '../escape.bin', size: 0, content: Buffer.alloc(0) }], path.join(root, 'unsafe-catalog'));
  check('catalog traversal path rejected', !unsafeCatalog.ok && unsafeCatalog.errors.some(error => error.includes('Unsafe')));
  const rollbackCatalogRoot = path.join(root, 'rollback-catalog');
  const rollbackCatalog = writeCatDatCatalogs([
    { name: 'a.bin', size: 1, content: Buffer.from([1]) },
    { name: 'z.bin', size: 1, sourcePath: path.join(root, 'missing.bin') },
  ], rollbackCatalogRoot, { maxVolumeBytes: 1 });
  check('partial multi-volume failure rolls back prior volumes', !rollbackCatalog.ok && rollbackCatalog.volumes.length === 0 && fs.readdirSync(rollbackCatalogRoot).length === 0, rollbackCatalog.errors.join('; '));

  const packaged = materializeCatalogArtifact(plan, packagedOutput, { maxVolumeBytes: 2 * 1024 * 1024 });
  check('packed artifact materialization succeeds', packaged.ok, packaged.errors.join('; '));
  check('packed artifact keeps content.xml loose', fs.existsSync(path.join(packagedOutput, 'content.xml')));
  check('packed artifact keeps configured preview loose', fs.existsSync(path.join(packagedOutput, 'preview.jpg')));
  check('packed artifact preserves pre-existing root catalog pair', fs.existsSync(path.join(packagedOutput, 'ext_07.cat')) && fs.existsSync(path.join(packagedOutput, 'ext_07.dat')));
  check('new catalogs follow pre-existing catalog index', packaged.catalogs.volumes[0]?.index === 8, packaged.catalogs.volumes.map(volume => volume.index).join(','));
  check('packed payload is not duplicated loose', !fs.existsSync(path.join(packagedOutput, 'md')) && !fs.existsSync(path.join(packagedOutput, 'assets')));

  fs.rmSync(path.join(source, 'ui', 'over-256k.lua'));
  const broken = materializeArtifact(plan, brokenOutput);
  check('missing planned source fails closed', !broken.ok && broken.errors.some(error => error.includes('ui/over-256k.lua')), broken.errors.join('; '));

  const traversalPlan = buildArtifactPlan({ sourceRoot: source, generatedFiles: { '../escape.txt': 'no' } });
  check('generated traversal rejected', !traversalPlan.ok && traversalPlan.errors.some(error => error.toLowerCase().includes('unsafe')));
  write(source, 'collision/Name.txt', 'source case');
  const collisionPlan = buildArtifactPlan({ sourceRoot: source, generatedFiles: { 'collision/name.txt': 'generated case' } });
  check('case-fold collision rejected', !collisionPlan.ok && collisionPlan.errors.some(error => error.toLowerCase().includes('collide')));

  const symlinkTarget = path.join(root, 'outside.txt');
  fs.writeFileSync(symlinkTarget, 'outside');
  let symlinkSupported = true;
  try {
    fs.symlinkSync(symlinkTarget, path.join(source, 'linked-outside.txt'), 'file');
  } catch {
    symlinkSupported = false;
  }
  if (symlinkSupported) {
    const symlinkPlan = buildArtifactPlan({ sourceRoot: source, generatedFiles: {} });
    check('symlink/reparse entry fails closed', !symlinkPlan.ok && symlinkPlan.errors.some(error => error.toLowerCase().includes('symbolic')));
  } else {
    check('symlink negative skipped when host forbids fixture creation', true);
  }
} catch (error) {
  check('test harness completed', false, error instanceof Error ? error.stack || error.message : String(error));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

const passed = checks.filter(item => item.pass).length;
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}
console.log(`artifact pipeline: ${passed}/${checks.length}`);
process.exit(passed === checks.length ? 0 : 1);
