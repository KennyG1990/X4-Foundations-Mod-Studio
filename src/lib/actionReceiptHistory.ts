/** W3A optional projection from durable action receipts into the fail-soft Agent History ledger. */

import { ActionReceiptValidationError, assertValidActionReceipt } from './actionReceipt';
import type { LedgerRow } from './agentHistory';

export type ActionReceiptLedgerProjection = Pick<LedgerRow, 'receiptId' | 'receiptHash' | 'receiptStatus'>;

/**
 * Validate the entire durable receipt before exposing only its identity, content hash, and status
 * to optional history. Prepared receipts are intentionally excluded: history can link terminal
 * truth, but it cannot become a second lifecycle/status authority.
 */
export function projectActionReceiptToLedger(receipt: unknown): ActionReceiptLedgerProjection {
  const validated = assertValidActionReceipt(receipt);
  if (validated.status === 'prepared') {
    throw new ActionReceiptValidationError('Only terminal action receipts may be projected to history.');
  }
  return {
    receiptId: validated.id,
    receiptHash: validated.hash,
    receiptStatus: validated.status,
  };
}

/** Attach the validated projection, replacing any caller-supplied receipt fields. */
export function attachActionReceiptToLedgerRow(row: LedgerRow, receipt: unknown): LedgerRow {
  return { ...row, ...projectActionReceiptToLedger(receipt) };
}
