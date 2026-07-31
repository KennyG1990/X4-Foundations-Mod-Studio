import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTemplateWorkspace } from '../../src/lib/modTemplates';
import { needsManifestMaterialization } from '../../src/lib/nativeEditor';
import { E2E_TOKEN } from '../../playwright.config';
import { parseXMLToWorkspace } from '../../src/lib/xmlParser';
import { mdStemFingerprint } from '../../src/lib/mdFileIdentity';
import { applyNodeSelectionDocument, buildNodeSelectionDocument, isNodeSelectionFailure } from '../../src/lib/nodeSelectionDocument';
import { seedServerWorkspace } from './ephemeral';
import { validatePackageReadiness } from '../../src/lib/modCompiler';

const API = 'http://127.0.0.1:3101';
const auth = { Authorization: `Bearer ${E2E_TOKEN}` };

test('package readiness distinguishes data-only, inert legacy MD, empty, and real MD projects', () => {
  const patchOnly = {
    ...buildTemplateWorkspace('welcome'),
    nodes: [], links: [], uiWidgets: [], aiScripts: [], wares: [], jobs: [], tFiles: [],
    xmlPatches: [{
      id: 'data-only-patch', action: 'replace' as const, targetFile: 'libraries/wares.xml',
      sel: "/wares/ware[@id='energycells']/price/@average", content: '12', note: 'data-only', includeInBuild: true,
    }],
  };
  expect(validatePackageReadiness(patchOnly).some(finding => finding.code === 'package.md_missing_entrypoint')).toBe(false);
  expect(validatePackageReadiness({
    ...patchOnly,
    mdOriginal: { path: 'md/legacy.xml', content: '<?xml version="1.0"?><mdscript name="Legacy"><cues/></mdscript>' },
  })).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'package.md_inert_source', severity: 'warning', message: expect.stringContaining('do not need a cue') }),
  ]));

  const empty = { ...patchOnly, xmlPatches: [] };
  expect(validatePackageReadiness(empty)).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'package.empty_extension', severity: 'error' }),
  ]));

  const realMdWithoutCue = {
    ...empty,
    nodes: [{
      id: 'orphan', type: 'action' as const, xmlTag: 'debug_text', label: 'Orphan action',
      x: 0, y: 0, properties: { text: 'x' }, propertiesSchema: [], inputs: [], outputs: [], includeInBuild: true,
    }],
  };
  expect(validatePackageReadiness(realMdWithoutCue)).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'package.md_missing_entrypoint', severity: 'error' }),
  ]));
});

test('patch-only projects emit no fake MD and materialization refuses stale overwrite', async ({ request }) => {
  expect(needsManifestMaterialization('libraries/wares.xml', true)).toBe(false);
  expect(needsManifestMaterialization('libraries/wares.xml', false)).toBe(true);
  expect(needsManifestMaterialization('content.xml', false)).toBe(false);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-native-authoring-'));
  const staging = path.join(temp, 'staging');
  const deployment = path.join(temp, 'deployment');
  const source = path.join(staging, 'patch_only_fixture');
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(deployment, { recursive: true });
  fs.writeFileSync(path.join(source, 'content.xml'), '<content id="patch_only_fixture" name="Patch Only Fixture" version="1"/>', 'utf8');

  const originalResponse = await request.get(`${API}/api/schema/config`, { headers: auth });
  expect(originalResponse.ok(), await originalResponse.text()).toBeTruthy();
  const original = (await originalResponse.json()) as { config?: Record<string, unknown> };
  const restore = {
    modWorkspacePath: original.config?.modWorkspacePath || '',
    filesystemPath: original.config?.filesystemPath || '',
  };

  try {
    const configured = await request.post(`${API}/api/schema/config`, {
      headers: auth,
      data: { modWorkspacePath: staging, filesystemPath: deployment },
    });
    expect(configured.ok(), await configured.text()).toBeTruthy();

    const workspace = {
      ...buildTemplateWorkspace('welcome'),
      id: 'patch_only_fixture',
      name: 'patch_only_fixture',
      nodes: [],
      links: [],
      uiWidgets: [],
      aiScripts: [],
      wares: [],
      jobs: [],
      tFiles: [],
      sourceFolder: source,
      compileSettings: { md: true, ui: false, ai: false, library: true, translations: false, patches: true },
      xmlPatches: [{
        id: 'patch-ware-price',
        action: 'replace',
        sel: "/wares/ware[@id='energycells']/price/@average",
        content: '12',
        note: 'Patch-only fixture',
        targetFile: 'libraries/wares.xml',
        includeInBuild: true,
      }],
    };

    const compiledResponse = await request.post(`${API}/api/agent/compile`, { headers: auth, data: { workspace } });
    expect(compiledResponse.ok(), await compiledResponse.text()).toBeTruthy();
    const compiled = await compiledResponse.json() as { files: Record<string, string>; diagnostics?: Array<{ code?: string }> };
    expect(Object.keys(compiled.files).some(file => file.startsWith('md/'))).toBeFalsy();
    expect(compiled.files['libraries/wares.xml']).toContain('<replace');
    expect(compiled.diagnostics?.some(finding => /md.*no.*cue/i.test(String(finding.code || '')))).toBeFalsy();

    const inventoryResponse = await request.post(`${API}/api/agent/project/files`, { headers: auth, data: { workspace } });
    expect(inventoryResponse.ok(), await inventoryResponse.text()).toBeTruthy();
    const inventory = await inventoryResponse.json() as { entries: Array<{ path: string; state: string; materializable: boolean }> };
    expect(inventory.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'libraries/wares.xml', state: 'generated-only', materializable: true }),
    ]));

    const derivedInventoryResponse = await request.post(`${API}/api/agent/project/files`, {
      headers: auth,
      data: { workspace: { ...workspace, sourceFolder: undefined } },
    });
    expect(derivedInventoryResponse.ok(), await derivedInventoryResponse.text()).toBeTruthy();
    const derivedInventory = await derivedInventoryResponse.json() as {
      sourceAvailable: boolean;
      sourceFolder: string | null;
      entries: Array<{ path: string; openable: boolean }>;
    };
    expect(derivedInventory.sourceAvailable).toBe(true);
    expect(derivedInventory.sourceFolder).toBe('patch_only_fixture');
    expect(derivedInventory.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'content.xml', openable: true }),
    ]));

    const relative = 'patch_only_fixture/libraries/wares.xml';
    const first = await request.post(`${API}/api/fs/write`, {
      headers: auth,
      data: { path: relative, content: compiled.files['libraries/wares.xml'], strict: true, expectedSha256: null },
    });
    expect(first.ok(), await first.text()).toBeTruthy();
    const refused = await request.post(`${API}/api/fs/write`, {
      headers: auth,
      data: { path: relative, content: '<diff><remove sel="/wares"/></diff>', strict: true, expectedSha256: null },
    });
    expect(refused.status()).toBe(409);
    expect(await refused.json()).toMatchObject({ code: 'FILE_CHANGED' });

    const readBack = await request.get(`${API}/api/fs/read?root=workspace&path=${encodeURIComponent(relative)}`, { headers: auth });
    expect(readBack.ok(), await readBack.text()).toBeTruthy();
    expect((await readBack.json()).content).toBe(compiled.files['libraries/wares.xml']);
  } finally {
    const restored = await request.post(`${API}/api/schema/config`, { headers: auth, data: restore });
    expect(restored.ok(), await restored.text()).toBeTruthy();
    const verified = await request.get(`${API}/api/schema/config`, { headers: auth });
    expect(verified.ok(), await verified.text()).toBeTruthy();
    const verifiedBody = await verified.json() as { config?: Record<string, unknown> };
    expect(verifiedBody.config?.modWorkspacePath).toBe(restore.modWorkspacePath);
    expect(verifiedBody.config?.filesystemPath).toBe(restore.filesystemPath);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('selected node edit compiles from an exact source splice without touching sibling bytes', async ({ request }) => {
  const original = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="NodeEdit"><cues>
  <!-- rationale before cue must survive -->
  <cue name="Start" instantiate="true"><conditions><event_cue_signalled cue="md.Setup.Start" /></conditions><actions>
    <reward_player money="100" />
    <reward_player money="200" />
  </actions></cue>
  <cue name="Start_Long"><actions><reward_player money="300" /></actions></cue>
</cues></mdscript>`;
  const workspace = parseXMLToWorkspace(original, { path: 'md/test.xml' });
  expect(workspace).not.toBeNull();
  const ws = workspace!;
  ws.id = 'node_edit';
  ws.name = 'Node Edit';
  ws.contentId = 'node_edit';
  ws.compileSettings = { md: true, ui: false, ai: false, library: false, translations: false, patches: false };
  for (const node of ws.nodes) if (node.type === 'cue') node.properties = { ...node.properties, mdFileStem: 'test' };
  const editedNode = ws.nodes.filter(node => node.xmlTag === 'reward_player')[1];
  expect(editedNode?.source).toBeTruthy();
  ws.originalFiles = [{ path: 'md/test.xml', content: original, kind: 'md', stem: 'test', fingerprint: mdStemFingerprint(ws, 'test') }];

  const document = buildNodeSelectionDocument(ws, [editedNode.id]);
  expect(isNodeSelectionFailure(document), isNodeSelectionFailure(document) ? document.message : '').toBeFalsy();
  if (isNodeSelectionFailure(document)) return;
  const applied = applyNodeSelectionDocument(ws, [editedNode.id], document.token, document.content.replace('money="200"', 'money="275"'));
  expect(isNodeSelectionFailure(applied), isNodeSelectionFailure(applied) ? applied.message : '').toBeFalsy();
  if (isNodeSelectionFailure(applied)) return;

  const response = await request.post(`${API}/api/agent/compile`, { headers: auth, data: { workspace: applied.workspace } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const compiled = await response.json() as { files: Record<string, string> };
  const output = compiled.files['md/test.xml'];
  expect(output).toBe(applied.workspace.originalFiles![0].content);
  const span = editedNode.source!;
  expect(output.slice(0, span.start)).toBe(original.slice(0, span.start));
  expect(output.endsWith(original.slice(span.end))).toBeTruthy();
  expect(output).toContain('<!-- rationale before cue must survive -->');
  expect(output).toContain('<reward_player money="100" />');
  expect(output).toContain('<cue name="Start_Long"><actions><reward_player money="300" /></actions></cue>');
});

test('rendered modifier selection sends exactly the selected graph snippets to the native host', async ({ page }) => {
  const workspace = buildTemplateWorkspace('welcome');
  workspace.id = 'native_selection_ui';
  workspace.name = 'Native Selection UI';
  workspace.nodes = [
    {
      id: 'cue_native_ui', type: 'cue', label: 'Native Cue', xmlTag: 'cue', x: 130, y: 120,
      properties: { name: 'Native_Cue', namespace: 'this', instantiate: true }, propertiesSchema: [],
      inputs: [], outputs: [{ id: 'out_act', name: 'actions', type: 'flow' }], includeInBuild: true,
    },
    {
      id: 'action_native_ui', type: 'action', label: 'Native Reward', xmlTag: 'reward_player', x: 470, y: 150,
      properties: { money: '250' }, propertiesSchema: [],
      inputs: [{ id: 'in_act', name: 'action', type: 'flow' }], outputs: [], includeInBuild: true,
    },
    {
      id: 'unselected_native_ui', type: 'action', label: 'Unselected Action', xmlTag: 'show_help', x: 470, y: 380,
      properties: { custom: "'not selected'" }, propertiesSchema: [],
      inputs: [{ id: 'in_act', name: 'action', type: 'flow' }], outputs: [], includeInBuild: true,
    },
  ];
  workspace.links = [{
    id: 'native_ui_link', sourceNodeId: 'cue_native_ui', sourcePortId: 'out_act',
    targetNodeId: 'action_native_ui', targetPortId: 'in_act',
  }];
  await seedServerWorkspace(workspace);
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('x4_mod_studio_workspace');
      localStorage.removeItem('x4_mod_studio_version');
    } catch {
      // The top-level about:blank document has no storage; the Forge iframe does.
    }
  });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <iframe id="forge" src="http://127.0.0.1:3100/" style="border:0;width:1600px;height:1000px"></iframe>
    <script>
      window.__nativeMessages = [];
      window.addEventListener('message', event => {
        if (event.data && event.data.source === 'x4forge-studio' && event.data.type === 'open-node-selection') {
          window.__nativeMessages.push(event.data);
        }
      });
    </script>
  </body></html>`);

  const forge = page.frameLocator('#forge');
  await expect(forge.getByTestId('canvas-node-cue_native_ui')).toBeVisible({ timeout: 30_000 });
  await expect(forge.getByTestId('canvas-node-action_native_ui')).toBeVisible({ timeout: 30_000 });
  await forge.getByTestId('canvas-node-cue_native_ui').click();
  await expect.poll(() => page.evaluate(() => (window as any).__nativeMessages.at(-1)?.nodeIds))
    .toEqual(['cue_native_ui']);
  await forge.getByTestId('canvas-node-action_native_ui').click({ modifiers: ['Control'] });

  await expect.poll(() => page.evaluate(() => (window as any).__nativeMessages.at(-1)))
    .toMatchObject({ nodeIds: ['cue_native_ui', 'action_native_ui'], readOnly: false });
  const latest = await page.evaluate(() => (window as any).__nativeMessages.at(-1)) as { content: string; nodeIds: string[] };
  expect(latest.content.match(/x4forge-node:/g)).toHaveLength(2);
  expect(latest.content).toContain('x4forge-node:cue_native_ui');
  expect(latest.content).toContain('x4forge-node:action_native_ui');
  expect(latest.content).toContain('<cue name="Native_Cue"');
  expect(latest.content).toContain('<reward_player money="250"');
  expect(latest.content).not.toContain('not selected');
});
