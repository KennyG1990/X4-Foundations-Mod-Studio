import type { MDLink, MDNode, ModWorkspace } from '../types';
import { stableStringify } from './workspaceIdentity';

/** All graph nodes owned by one imported MD file, derived from its cue roots. */
export function mdNodeIdsForStem(workspace: Pick<ModWorkspace, 'nodes' | 'links'>, stem: string): Set<string> {
  const nodes = workspace.nodes || [];
  const byId = new Map(nodes.map(node => [node.id, node] as const));
  const owned = new Set<string>();
  const queue = nodes
    .filter(node => node.type === 'cue' && String(node.properties?.mdFileStem || '') === stem)
    .map(node => node.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (owned.has(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    if (node.type === 'cue') {
      const cueStem = String(node.properties?.mdFileStem || '');
      if (cueStem && cueStem !== stem) continue;
    }
    owned.add(id);
    for (const link of workspace.links || []) {
      if (link.sourceNodeId === id && !owned.has(link.targetNodeId)) queue.push(link.targetNodeId);
    }
  }
  return owned;
}

function fingerprintNode(node: MDNode): unknown {
  return {
    id: node.id,
    type: node.type,
    xmlTag: node.xmlTag,
    label: node.label,
    includeInBuild: node.includeInBuild !== false,
    properties: node.properties || {},
  };
}

function fingerprintLink(link: MDLink): unknown {
  return {
    sourceNodeId: link.sourceNodeId,
    sourcePortId: link.sourcePortId,
    targetNodeId: link.targetNodeId,
    targetPortId: link.targetPortId,
  };
}

/** Semantic fingerprint used by original-file byte preservation. Includes every node in the file. */
export function mdStemFingerprint(workspace: Pick<ModWorkspace, 'nodes' | 'links'>, stem: string): string {
  const ids = mdNodeIdsForStem(workspace, stem);
  const nodes = (workspace.nodes || [])
    .filter(node => ids.has(node.id))
    .map(fingerprintNode)
    .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
  const links = (workspace.links || [])
    .filter(link => ids.has(link.sourceNodeId) && ids.has(link.targetNodeId))
    .map(fingerprintLink)
    .sort((a: any, b: any) => stableStringify(a).localeCompare(stableStringify(b)));
  return stableStringify({ stem, nodes, links });
}

export function runMdFileIdentitySelftest(): { allPassed: boolean; passed: number; total: number; checks: Array<{ name: string; pass: boolean }> } {
  const cue = { id: 'cue', type: 'cue', xmlTag: 'cue', label: 'Cue', x: 0, y: 0, properties: { name: 'Start', mdFileStem: 'main' }, propertiesSchema: [], inputs: [], outputs: [] } as MDNode;
  const action = { id: 'act', type: 'action', xmlTag: 'set_value', label: 'Set', x: 0, y: 0, properties: { name: '$x', exact: '1' }, propertiesSchema: [], inputs: [], outputs: [] } as MDNode;
  const link = { id: 'l', sourceNodeId: 'cue', sourcePortId: 'out_act', targetNodeId: 'act', targetPortId: 'in_act' } as MDLink;
  const base = { nodes: [cue, action], links: [link] } as ModWorkspace;
  const changed = { ...base, nodes: [cue, { ...action, properties: { ...action.properties, exact: '2' } }] } as ModWorkspace;
  const checks = [
    { name: 'action_is_owned_by_cue_file', pass: mdNodeIdsForStem(base, 'main').has('act') },
    { name: 'action_property_edit_changes_file_fingerprint', pass: mdStemFingerprint(base, 'main') !== mdStemFingerprint(changed, 'main') },
    { name: 'unknown_stem_has_no_nodes', pass: mdNodeIdsForStem(base, 'other').size === 0 },
  ];
  return { allPassed: checks.every(check => check.pass), passed: checks.filter(check => check.pass).length, total: checks.length, checks };
}
