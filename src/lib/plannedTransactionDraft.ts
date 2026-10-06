import type { PlannedPayment } from '../types';

/**
 * Prefill for the "add operation" form when a planned occurrence is executed.
 * A planned transfer opens the form as a transfer between the plan's two
 * accounts; expenses and incomes keep their category. calendarPlanId and
 * calendarDate let the server link the new operation to that occurrence.
 */
export function plannedTransactionDraft(payment: PlannedPayment, date: string) {
  const isTransfer = payment.transactionType === 'transfer';
  return {
    type: payment.transactionType || 'expense',
    amount: payment.amount,
    accountId: payment.accountId || '',
    targetAccountId: isTransfer ? payment.targetAccountId || '' : undefined,
    categoryId: isTransfer ? '' : payment.categoryId || '',
    description: payment.title,
    createdAt: new Date().toISOString(),
    calendarPlanId: payment.id,
    calendarDate: date,
  };
}
