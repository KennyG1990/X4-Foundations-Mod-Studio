/**
 * B116 — deterministic renderer/polling pressure fixture.
 *
 * Four independent action chains make the graph counts exact without relying on
 * imported user content. Snapshot padding lives in one preserved README so JSON
 * transfer size can be varied independently from visible node text/AX density.
 */
import { Buffer } from 'node:buffer';
import { buildTemplateWorkspace } from '../../../src/lib/modTemplates';
import { sanitizeWorkspace, type MDLink, type MDNode, type ModWorkspace } from '../../../src/types';

export const LARGE_WORKSPACE_NODE_COUNT = 1_424;
export const LARGE_WORKSPACE_LINK_COUNT = 1_420;
export const LARGE_WORKSPACE_SNAPSHOT_BYTES = 6_040_734;

export type LargeWorkspaceLayout = 'sparse' | 'dense';

export interface LargeWorkspaceOptions {
  layout?: LargeWorkspaceLayout;
  snapshotBytes?: number;
}
function position(layout: LargeWorkspaceLayout, chain: number, index: number): { x: number; y: number } {
  if (layout === 'dense') {
    return {
      x: 80 + ((chain * 356 + index) % 9) * 20,
      y: 80 + (Math.floor((chain * 356 + index) / 9) % 9) * 20,
    };
  }
  return { x: 80 + index * 320, y: 80 + chain * 2_500 };
}

export function serializedWorkspaceBytes(workspace: ModWorkspace): number {
  return Buffer.byteLength(JSON.stringify(workspace), 'utf8');
}

export function buildLargeWorkspace(options: LargeWorkspaceOptions = {}): ModWorkspace {
  const layout = options.layout ?? 'sparse';
  const nodes: Partial<MDNode>[] = [];
  const links: MDLink[] = [];

  for (let chain = 0; chain < 4; chain += 1) {
    const cueId = `b116_cue_${chain}`;
    const cuePosition = position(layout, chain, 0);
    nodes.push({
      id: cueId,
      type: 'cue',
      xmlTag: 'cue',
      label: `B116 Cue ${chain + 1}`,
      properties: { name: `B116Cue${chain + 1}`, namespace: 'this', state: 'active' },
      ...cuePosition,
    });

    let previousId = cueId;
    let previousPort = 'out_act';
    for (let action = 0; action < 355; action += 1) {
      const actionId = `b116_action_${chain}_${action}`;
      nodes.push({
        id: actionId,
        type: 'action',
        xmlTag: 'show_help',
        label: `B116 Action ${chain + 1}.${action + 1}`,
        properties: { text: `'B116 ${chain + 1}.${action + 1}'`, duration: 1 },
        ...position(layout, chain, action + 1),
      });
      links.push({
        id: `b116_link_${chain}_${action}`,
        sourceNodeId: previousId,
        sourcePortId: previousPort,
        targetNodeId: actionId,
        targetPortId: 'in_act',
      });
      previousId = actionId;
      previousPort = 'out_next';
    }
  }

  const blank = buildTemplateWorkspace('blank');
  let workspace = sanitizeWorkspace({
    ...blank,
    id: `b116_${layout}`,
    name: `B116_${layout}_1424`,
    description: 'Deterministic B116 renderer and workspace polling pressure fixture.',
    nodes,
    links,
    originalFiles: options.snapshotBytes
      ? [{ path: 'README-b116-payload.txt', content: '', kind: 'readme' as const }]
      : [],
  });

  if (options.snapshotBytes !== undefined) {
    const unpaddedBytes = serializedWorkspaceBytes(workspace);
    const paddingBytes = Math.trunc(options.snapshotBytes) - unpaddedBytes;
    if (paddingBytes < 0) {
      throw new Error(`B116 snapshot target ${options.snapshotBytes} is below the ${unpaddedBytes}-byte fixture.`);
    }
    workspace = sanitizeWorkspace({
      ...workspace,
      originalFiles: [{ path: 'README-b116-payload.txt', content: 'x'.repeat(paddingBytes), kind: 'readme' }],
    });
    const actualBytes = serializedWorkspaceBytes(workspace);
    if (actualBytes !== options.snapshotBytes) {
      throw new Error(`B116 snapshot size drift: expected ${options.snapshotBytes}, got ${actualBytes}.`);
    }
  }

  if (workspace.nodes.length !== LARGE_WORKSPACE_NODE_COUNT || workspace.links.length !== LARGE_WORKSPACE_LINK_COUNT) {
    throw new Error(`B116 graph count drift: ${workspace.nodes.length} nodes / ${workspace.links.length} links.`);
  }
  return workspace;
}
