export type AITransactionDraft = Record<string, any>;

export function isTransactionBatch(data: unknown): boolean {
  if (Array.isArray(data)) return true;
  return Boolean(
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { transactions?: unknown }).transactions),
  );
}

export function getAITransactionDrafts(data: unknown): AITransactionDraft[] {
  if (Array.isArray(data)) {
    return data.filter(isObject);
  }

  if (data && typeof data === 'object') {
    const transactions = (data as { transactions?: unknown }).transactions;
    if (Array.isArray(transactions)) {
      return transactions.filter(isObject);
    }

    if (typeof (data as { type?: unknown }).type === 'string') {
      return [data as AITransactionDraft];
    }
  }

  return [];
}

function isObject(value: unknown): value is AITransactionDraft {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}