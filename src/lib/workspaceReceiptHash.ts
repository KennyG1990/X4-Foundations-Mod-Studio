/**
 * Server-only SHA-256 receipt fingerprints for workspace authority.
 *
 * The browser/server shared identity module owns canonicalization. This module only supplies
 * the Node crypto boundary, so receipt hashes cannot drift from the legacy short hashes.
 */

import { createHash } from 'node:crypto';

import type { ModWorkspace } from '../types';
import {
  canonicalWorkspaceContentString,
  canonicalWorkspaceSnapshotString,
} from './workspaceIdentity';

function sha256Canonical(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** SHA-256 of the exact canonical content-CAS substance string. */
export function workspaceContentReceiptHash(ws: ModWorkspace | null | undefined): string {
  return sha256Canonical(canonicalWorkspaceContentString(ws));
}

/** SHA-256 of the exact canonical complete workspace snapshot string. */
export function workspaceSnapshotReceiptHash(ws: ModWorkspace | null | undefined): string {
  return sha256Canonical(canonicalWorkspaceSnapshotString(ws));
}
