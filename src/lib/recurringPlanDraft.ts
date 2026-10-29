import type { Category, PlannedPaymentDraft, Transaction } from '../types';

const MAX_TITLE_LENGTH = 80;

/**
 * Prefill for the "new plan" form when an operation is made recurring
 * ("Сделать регулярной"). The amount, accounts, category and comment are taken
 * from the operation; the start date is today and the user picks how often the
 * payment repeats (monthly is preselected). The reverse of
 * plannedTransactionDraft: there the plan title becomes the operation comment.
 */
export function recurringPlanDraft(transaction: Transaction, categories: Category[] = []): PlannedPaymentDraft {
  const isTransfer = transaction.type === 'transfer';
  const description = transaction.description?.trim() || '';
  const firstLine = getFirstLine(description);
  const category = isTransfer ? undefined : categories.find(item => item.id === transaction.categoryId);
  const title = truncate(firstLine, MAX_TITLE_LENGTH)
    || category?.name
    || (isTransfer ? 'Перевод' : 'Регулярный платёж');

  return {
    title,
    note: description && description !== title ? description : undefined,
    amount: transaction.amount,
    recurrence: 'monthly',
    transactionType: transaction.type,
    accountId: transaction.accountId,
    categoryId: isTransfer ? undefined : transaction.categoryId || undefined,
    targetAccountId: isTransfer ? transaction.targetAccountId : undefined,
  };
}

function getFirstLine(text: string) {
  const line = text.split('\n').map(item => item.trim()).find(Boolean) || '';
  // Drop markdown markers so "## Аренда" or "- [ ] Аренда" become "Аренда".
  return line.replace(/^(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '').trim();
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}
