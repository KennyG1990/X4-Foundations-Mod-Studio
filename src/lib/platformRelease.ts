/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B109 platform release engine. Platform-neutral artifact ownership comes from
 * artifactPipeline; this layer adds Nexus archive semantics and Steam Workshop
 * preflight/command semantics without uploading or opening external programs.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArtifactPlan, type ArtifactEntry, type ArtifactPlan } from './artifactPipeline';
import { buildZip, crc32, verifyZipArchive, type VerifiedZipEntry, type ZipEntry } from './modDistribution';

export type ReleaseStageStatus = 'pending' | 'running' | 'pass' | 'warning' | 'fail' | 'skipped';

export interface ReleaseStage {
  id: string;
  label: string;
  status: ReleaseStageStatus;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface ContentManifestMeta {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  workshopId: string | null;
}

export interface PreviewInspection {
  ok: boolean;
  path: string;
  format: 'png' | 'jpeg' | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  warnings: string[];
  errors: string[];
}

export interface WorkshopToolInspection {
  ok: boolean;
  path: string;
  sizeBytes: number;
  errors: string[];
}

export interface NexusArchiveResult {
  ok: boolean;
  zip: Buffer;
  entries: VerifiedZipEntry[];
  errors: string[];
}

export interface WorkshopCommand {
  executable: string;
  args: string[];
  display: string;
  shell: 'powershell';
  mode: 'publishx4' | 'update';
}

function xmlAttr(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1]?.trim() || '';
}

export function inspectContentManifest(xml: string): ContentManifestMeta | null {
  const tag = String(xml || '').match(/<content\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const id = xmlAttr(tag, 'id');
  const workshopId = /^ws_\d+$/i.test(id) ? id : null;
  return {
    id,
    name: xmlAttr(tag, 'name'),
    version: xmlAttr(tag, 'version'),
    author: xmlAttr(tag, 'author'),
    description: xmlAttr(tag, 'description'),
    workshopId,
  };
}

export function validateReleaseManifest(xml: string): { ok: boolean; meta: ContentManifestMeta | null; errors: string[] } {
  const meta = inspectContentManifest(xml);
  if (!meta) return { ok: false, meta: null, errors: ['content.xml has no <content> element.'] };
  const errors: string[] = [];
  for (const field of ['id', 'name', 'version', 'author', 'description'] as const) {
    if (!meta[field]?.trim()) errors.push(`content.xml is missing required release metadata: ${field}.`);
  }
  if (meta.id && !/^[A-Za-z][\w.-]*$/.test(meta.id) && !meta.workshopId) errors.push(`content.xml id is not a safe X4 extension id: ${meta.id}`);
  if (meta.version && !/^\d+$/.test(meta.version)) errors.push(`content.xml version must be an X4 integer for release: ${meta.version}`);
  return { ok: errors.length === 0, meta, errors };
}

const WORKSHOP_MANAGED_CONTENT_ATTRIBUTES = new Set(['id', 'lastupdate', 'sync']);

function contentTagInvariant(xml: string): { invariant: string; attributes: Map<string, string> } | null {
  const match = /<content\b[^>]*>/i.exec(String(xml || ''));
  if (!match || match.index === undefined) return null;
  const attributes = new Map<string, string>();
  const attrRe = /\b([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let attr: RegExpExecArray | null;
  while ((attr = attrRe.exec(match[0])) !== null) attributes.set(attr[1].toLocaleLowerCase('en-US'), attr[2] ?? attr[3] ?? '');
  const stableAttributes = [...attributes.entries()]
    .filter(([name]) => !WORKSHOP_MANAGED_CONTENT_ATTRIBUTES.has(name))
    .sort(([left], [right]) => left.localeCompare(right, 'en-US'));
  const invariant = `${xml.slice(0, match.index)}<content ${JSON.stringify(stableAttributes)}>${xml.slice(match.index + match[0].length)}`;
  return { invariant, attributes };
}

export function validateWorkshopManifestMutation(beforeXml: string, afterXml: string): { ok: boolean; errors: string[]; changedManagedAttributes: string[] } {
  const before = contentTagInvariant(beforeXml);
  const after = contentTagInvariant(afterXml);
  if (!before || !after) return { ok: false, errors: ['Prepared or post-tool content.xml has no readable <content> element.'], changedManagedAttributes: [] };
  const errors: string[] = [];
  if (before.invariant !== after.invariant) errors.push('WorkshopTool result changed content.xml outside the allowed id/lastupdate/sync attributes.');
  const changedManagedAttributes = [...WORKSHOP_MANAGED_CONTENT_ATTRIBUTES]
    .filter(name => before.attributes.get(name) !== after.attributes.get(name));
  return { ok: errors.length === 0, errors, changedManagedAttributes };
}

export function validateSteamFolderName(folderNameInput: string): string[] {
  const folderName = String(folderNameInput || '');
  const errors: string[] = [];
  if (!folderName) errors.push('Steam Workshop requires a non-empty extension folder name.');
  if (folderName.length > 32) errors.push(`Steam Workshop folder names are limited to 32 characters; "${folderName}" has ${folderName.length}.`);
  if (!/^[a-z0-9._ -]+$/.test(folderName)) errors.push('Steam Workshop folder names may contain lowercase a-z, digits, space, period, underscore, and hyphen only.');
  return errors;
}

function artifactBytes(entry: ArtifactEntry): Buffer {
  let bytes: Buffer;
  if (entry.content !== undefined) bytes = Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(entry.content, 'utf8');
  else if (entry.sourcePath) bytes = fs.readFileSync(entry.sourcePath);
  else throw new Error(`Artifact entry has neither generated content nor a source file: ${entry.path}`);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== entry.size || hash !== entry.sha256) throw new Error(`Artifact source changed after planning: ${entry.path}`);
  return bytes;
}

export function artifactPlanToZipEntries(plan: ArtifactPlan, rootFolder: string, installReadme?: string): ZipEntry[] {
  if (!plan.ok) throw new Error(`Artifact plan is not valid: ${plan.errors.join('; ')}`);
  const root = String(rootFolder || '').trim();
  if (!/^[A-Za-z][\w.-]*$/.test(root)) throw new Error(`Nexus root folder is not a safe X4 extension id: ${root || '(empty)'}`);
  const entries = plan.entries.map(entry => ({ path: `${root}/${entry.path}`, data: artifactBytes(entry) }));
  if (installReadme && !plan.entries.some(entry => entry.path.toLocaleLowerCase('en-US') === 'readme_install.md')) {
    entries.push({ path: `${root}/README_INSTALL.md`, data: Buffer.from(installReadme, 'utf8') });
  }
  return entries;
}

export function createNexusArchive(plan: ArtifactPlan, rootFolder: string, installReadme?: string): NexusArchiveResult {
  try {
    const expected = artifactPlanToZipEntries(plan, rootFolder, installReadme);
    const zip = buildZip(expected);
    const verified = verifyZipArchive(zip, expected);
    return { ok: verified.ok, zip, entries: verified.entries, errors: verified.errors };
  } catch (error) {
    return { ok: false, zip: Buffer.alloc(0), entries: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 45 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  let cursor = 8;
  let dimensions: { width: number; height: number } | null = null;
  let sawImageData = false;
  let sawEnd = false;
  while (cursor + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(cursor);
    const typeStart = cursor + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > bytes.length) return null;
    const type = bytes.subarray(typeStart, dataStart).toString('ascii');
    if (crc32(bytes.subarray(typeStart, dataEnd)) !== bytes.readUInt32BE(dataEnd)) return null;
    if (type === 'IHDR') {
      if (cursor !== 8 || length !== 13) return null;
      const width = bytes.readUInt32BE(dataStart);
      const height = bytes.readUInt32BE(dataStart + 4);
      if (!width || !height) return null;
      dimensions = { width, height };
    } else if (type === 'IDAT') sawImageData = true;
    else if (type === 'IEND') {
      if (length !== 0 || chunkEnd !== bytes.length) return null;
      sawEnd = true;
      break;
    }
    cursor = chunkEnd;
  }
  return dimensions && sawImageData && sawEnd ? dimensions : null;
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
  let cursor = 2;
  while (cursor + 4 <= bytes.length) {
    if (bytes[cursor] !== 0xff) return null;
    while (bytes[cursor] === 0xff) cursor++;
    const marker = bytes[cursor++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (cursor + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(cursor);
    if (length < 2 || cursor + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return { height: bytes.readUInt16BE(cursor + 3), width: bytes.readUInt16BE(cursor + 5) };
    }
    cursor += length;
  }
  return null;
}

export function inspectWorkshopPreview(filePathInput: string, maxBytes = 1024 * 1024): PreviewInspection {
  const filePath = path.resolve(String(filePathInput || ''));
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!filePathInput || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { ok: false, path: filePath, format: null, sizeBytes: 0, width: null, height: null, warnings, errors: ['Select an existing PNG or JPEG Workshop preview image.'] };
  }
  const sizeBytes = fs.statSync(filePath).size;
  if (sizeBytes > maxBytes) {
    return { ok: false, path: filePath, format: null, sizeBytes, width: null, height: null, warnings, errors: [`Workshop preview exceeds the configured ${maxBytes}-byte limit.`] };
  }
  const bytes = fs.readFileSync(filePath);
  const png = pngDimensions(bytes);
  const jpeg = png ? null : jpegDimensions(bytes);
  const dimensions = png || jpeg;
  const format = png ? 'png' : jpeg ? 'jpeg' : null;
  if (!format) errors.push('Workshop preview is not a valid PNG or JPEG image.');
  if (dimensions && (dimensions.width < 640 || dimensions.height < 360)) warnings.push(`Egosoft recommends a widescreen preview of at least 640x360; selected image is ${dimensions.width}x${dimensions.height}.`);
  if (dimensions && dimensions.width < dimensions.height) warnings.push('Workshop preview is portrait; a widescreen image is recommended.');
  return {
    ok: errors.length === 0,
    path: filePath,
    format,
    sizeBytes,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    warnings,
    errors,
  };
}

export function inspectWorkshopTool(filePathInput: string): WorkshopToolInspection {
  const filePath = path.resolve(String(filePathInput || ''));
  const errors: string[] = [];
  if (!filePathInput || path.basename(filePath).toLocaleLowerCase('en-US') !== 'workshoptool.exe') {
    errors.push('Select Egosoft WorkshopTool.exe from the separate X Tools installation.');
  }
  if (!filePathInput || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    errors.push('WorkshopTool.exe does not exist or is not a file.');
    return { ok: false, path: filePath, sizeBytes: 0, errors };
  }
  const sizeBytes = fs.statSync(filePath).size;
  let fd = -1;
  try {
    fd = fs.openSync(filePath, 'r');
    const dos = Buffer.alloc(64);
    if (fs.readSync(fd, dos, 0, dos.length, 0) !== dos.length || dos.subarray(0, 2).toString('ascii') !== 'MZ') {
      errors.push('Selected WorkshopTool.exe is not a Windows PE executable (missing MZ header).');
    } else {
      const peOffset = dos.readUInt32LE(0x3c);
      const pe = Buffer.alloc(4);
      if (peOffset < 64 || peOffset + pe.length > sizeBytes || fs.readSync(fd, pe, 0, pe.length, peOffset) !== pe.length || pe.toString('hex') !== '50450000') {
        errors.push('Selected WorkshopTool.exe has an invalid PE signature.');
      }
    }
  } catch (error) {
    errors.push(`WorkshopTool.exe could not be inspected: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (fd >= 0) fs.closeSync(fd);
  }
  return { ok: errors.length === 0, path: filePath, sizeBytes, errors };
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildWorkshopCommand(input: {
  toolPath: string;
  stagedModPath: string;
  previewPath?: string;
  workshopId?: string | null;
  changeNote?: string;
  minorUpdate?: boolean;
}): WorkshopCommand {
  const executable = path.resolve(String(input.toolPath || ''));
  const stagedModPath = path.resolve(String(input.stagedModPath || ''));
  if (!input.toolPath) throw new Error('WorkshopTool.exe path is required.');
  if (!input.stagedModPath) throw new Error('Verified Steam staging path is required.');
  const mode = input.workshopId && /^ws_\d+$/i.test(input.workshopId) ? 'update' : 'publishx4';
  if (mode === 'publishx4' && input.minorUpdate) throw new Error('The WorkshopTool -minor switch is valid only for an existing Workshop update.');
  const args = [mode, '-path', stagedModPath];
  if (input.previewPath) args.push('-preview', path.resolve(input.previewPath));
  if (mode === 'update') {
    const changeNote = String(input.changeNote || '').trim();
    if (!changeNote) throw new Error('Steam Workshop updates require a non-empty change note.');
    if (/[\r\n\0]/.test(changeNote)) throw new Error('Steam Workshop change notes must be a single line.');
    args.push('-changenote', changeNote);
    if (input.minorUpdate) args.push('-minor');
  }
  // Forge has already built and verified CAT/DAT, so intentionally omit -buildcat.
  return { executable, args, display: ['&', quotePowerShellLiteral(executable), ...args.map(quotePowerShellLiteral)].join(' '), shell: 'powershell', mode };
}

export function steamCatalogMixErrors(plan: ArtifactPlan): string[] {
  const hasExistingCatalog = plan.entries.some(entry => /^ext_\d+\.(?:cat|dat|sig)$/i.test(entry.path));
  const generatedPayload = plan.entries.filter(entry => entry.disposition === 'generated'
    && entry.path.toLocaleLowerCase('en-US') !== 'content.xml'
    && !/^preview\.(?:png|jpe?g)$/i.test(entry.path));
  return hasExistingCatalog && generatedPayload.length > 0
    ? [`Steam staging refuses to mix existing root catalogs with regenerated payload (${generatedPayload.map(entry => entry.path).join(', ')}). Re-import/unpack the source or release the unchanged packed mod.`]
    : [];
}

export function runPlatformReleaseSelftest(): { allPassed: boolean; pass: boolean; passed: number; total: number; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, detail: detail === undefined ? undefined : typeof detail === 'string' ? detail : JSON.stringify(detail) });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-release-selftest-'));
  try {
    const source = path.join(tmp, 'source');
    fs.mkdirSync(path.join(source, 'assets'), { recursive: true });
    const content = '<content id="fixture_mod" name="Fixture Mod" version="100" author="Forge" description="Fixture release"/>';
    fs.writeFileSync(path.join(source, 'content.xml'), content);
    fs.writeFileSync(path.join(source, 'assets', 'binary.bin'), Buffer.from([0x00, 0xff, 0x7f, 0x42]));
    const plan = buildArtifactPlan({ sourceRoot: source });
    const manifest = validateReleaseManifest(content);
    ok('release_manifest_required_fields_pass', manifest.ok && manifest.meta?.id === 'fixture_mod', manifest.errors);
    ok('release_manifest_missing_author_fails', validateReleaseManifest('<content id="m" name="M" version="100" description="D"/>').ok === false);
    ok('steam_folder_name_accepts_legal_32_chars', validateSteamFolderName('a'.repeat(32)).length === 0);
    ok('steam_folder_name_rejects_over_32_chars', validateSteamFolderName('a'.repeat(33)).some(error => error.includes('32 characters')));
    ok('steam_folder_name_rejects_uppercase_and_slashes', validateSteamFolderName('Bad/Folder').length > 0);
    const nexus = createNexusArchive(plan, 'fixture_mod', 'install me');
    ok('nexus_archive_reopens_and_verifies', nexus.ok && nexus.entries.length === 3, nexus.errors);
    ok('nexus_binary_hash_preserved', nexus.entries.some(entry => entry.path === 'fixture_mod/assets/binary.bin'
      && entry.sha256 === crypto.createHash('sha256').update(Buffer.from([0x00, 0xff, 0x7f, 0x42])).digest('hex')));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const previewPath = path.join(tmp, 'preview.png');
    fs.writeFileSync(previewPath, png);
    const preview = inspectWorkshopPreview(previewPath);
    ok('steam_preview_png_dimensions_read', preview.ok && preview.width === 1 && preview.height === 1 && preview.warnings.length > 0, preview);
    const invalidPreviewPath = path.join(tmp, 'preview-bad.png');
    fs.writeFileSync(invalidPreviewPath, 'not an image');
    ok('steam_preview_invalid_image_rejected', inspectWorkshopPreview(invalidPreviewPath).ok === false);
    const oversizedPreviewPath = path.join(tmp, 'preview-large.png');
    fs.writeFileSync(oversizedPreviewPath, Buffer.alloc((1024 * 1024) + 1));
    ok('steam_preview_size_bound_rejected_before_decode', inspectWorkshopPreview(oversizedPreviewPath).ok === false);
    const publish = buildWorkshopCommand({ toolPath: 'C:\\X Tools\\WorkshopTool.exe', stagedModPath: 'C:\\Builds\\fixture_mod', previewPath });
    ok('steam_first_publish_command_shape', publish.mode === 'publishx4' && !publish.args.includes('-buildcat') && publish.args.includes('-preview'), publish.display);
    const hostileDisplay = buildWorkshopCommand({ toolPath: 'C:\\X Tools & More\\WorkshopTool.exe', stagedModPath: "C:\\Builds\\Ken's Mod", previewPath });
    ok('steam_display_command_quotes_powershell_metacharacters', hostileDisplay.display.startsWith("& 'C:\\X Tools & More\\WorkshopTool.exe'") && hostileDisplay.display.includes("Ken''s Mod"), hostileDisplay.display);
    const fakeToolPath = path.join(tmp, 'WorkshopTool.exe');
    fs.writeFileSync(fakeToolPath, 'renamed text file');
    ok('steam_renamed_non_executable_tool_rejected', inspectWorkshopTool(fakeToolPath).ok === false);
    const peFixture = Buffer.alloc(132);
    Buffer.from('MZ').copy(peFixture, 0);
    peFixture.writeUInt32LE(128, 0x3c);
    Buffer.from('PE\0\0', 'binary').copy(peFixture, 128);
    fs.writeFileSync(fakeToolPath, peFixture);
    ok('steam_pe_workshop_tool_fixture_accepted_without_execution', inspectWorkshopTool(fakeToolPath).ok === true);
    const update = buildWorkshopCommand({ toolPath: 'C:\\X Tools\\WorkshopTool.exe', stagedModPath: 'C:\\Builds\\fixture_mod', workshopId: 'ws_12345', changeNote: 'Fixes', minorUpdate: true });
    ok('steam_update_requires_changenote_and_uses_update', update.mode === 'update' && update.args.includes('-changenote'), update.display);
    ok('steam_deliberately_unchanged_update_adds_minor', update.args.includes('-minor') && !update.args.includes('-preview'), update.display);
    const bumpedUpdate = buildWorkshopCommand({ toolPath: 'C:\\X Tools\\WorkshopTool.exe', stagedModPath: 'C:\\Builds\\fixture_mod', workshopId: 'ws_12345', changeNote: 'Version increased' });
    ok('steam_normal_update_omits_minor_and_optional_preview', !bumpedUpdate.args.includes('-minor') && !bumpedUpdate.args.includes('-preview'), bumpedUpdate.display);
    let missingNoteRejected = false;
    try { buildWorkshopCommand({ toolPath: 'C:\\WorkshopTool.exe', stagedModPath: 'C:\\fixture_mod', workshopId: 'ws_12345' }); } catch { missingNoteRejected = true; }
    ok('steam_update_without_changenote_rejected', missingNoteRejected);
    let multilineNoteRejected = false;
    try { buildWorkshopCommand({ toolPath: 'C:\\WorkshopTool.exe', stagedModPath: 'C:\\fixture_mod', workshopId: 'ws_12345', changeNote: 'Line one\nLine two' }); } catch { multilineNoteRejected = true; }
    ok('steam_multiline_changenote_rejected', multilineNoteRejected);
    let publishMinorRejected = false;
    try { buildWorkshopCommand({ toolPath: 'C:\\WorkshopTool.exe', stagedModPath: 'C:\\fixture_mod', previewPath, minorUpdate: true }); } catch { publishMinorRejected = true; }
    ok('steam_first_publish_rejects_minor_switch', publishMinorRejected);
    const workshopMutation = validateWorkshopManifestMutation(content, content.replace('id="fixture_mod"', 'id="ws_12345" lastupdate="123" sync="false"'));
    ok('steam_manifest_allows_only_workshop_managed_attributes', workshopMutation.ok && workshopMutation.changedManagedAttributes.includes('id') && workshopMutation.changedManagedAttributes.includes('lastupdate'), workshopMutation);
    ok('steam_manifest_rejects_author_or_payload_metadata_drift', validateWorkshopManifestMutation(content, content.replace('author="Forge"', 'author="Tampered"')).ok === false);
    ok('release_manifest_rejects_whitespace_only_metadata', validateReleaseManifest(content.replace('author="Forge"', 'author="   "')).ok === false);
    const mixed = buildArtifactPlan({ sourceRoot: source, generatedFiles: { 'md/generated.xml': '<mdscript/>' } });
    mixed.entries.push({ path: 'ext_01.cat', disposition: 'source-copy', reason: 'fixture', size: 1, sha256: 'x', sourcePath: 'x' });
    ok('steam_existing_catalog_generated_payload_mix_rejected', steamCatalogMixErrors(mixed).length === 1);
  } catch (error) {
    ok('selftest_completed_without_exception', false, error instanceof Error ? error.message : String(error));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
