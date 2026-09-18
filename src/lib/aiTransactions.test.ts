import { describe, expect, it } from 'vitest';
import { getAITransactionDrafts, isTransactionBatch } from './aiTransactions';

describe('AI transaction batches', () => {
  const expense = { type: 'expense', amount: 13000 };
  const transfer = { type: 'transfer', amount: 1500 };

  it('keeps the existing single transaction shape', () => {
    expect(isTransactionBatch(expense)).toBe(false);
    expect(getAITransactionDrafts(expense)).toEqual([expense]);
  });

  it('extracts transactions from the batch shape', () => {
    const data = { transactions: [transfer, expense] };

    expect(isTransactionBatch(data)).toBe(true);
    expect(getAITransactionDrafts(data)).toEqual([transfer, expense]);
  });

  it('does not treat malformed values as transaction drafts', () => {
    expect(getAITransactionDrafts({ transactions: [expense, null, 'invalid'] })).toEqual([expense]);
    expect(getAITransactionDrafts({ message: 'not a transaction' })).toEqual([]);
  });
});