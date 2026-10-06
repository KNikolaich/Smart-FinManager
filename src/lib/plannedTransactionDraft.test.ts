import { describe, expect, it } from 'vitest';
import { plannedTransactionDraft } from './plannedTransactionDraft';
import type { PlannedPayment } from '../types';

const base: PlannedPayment = {
  id: 'plan-1',
  title: 'Зарплата',
  amount: 5000,
  date: '2026-10-01',
  recurrence: 'monthly',
  status: 'pending',
  accountId: 'card',
  categoryId: 'salary',
};

describe('plannedTransactionDraft', () => {
  it('opens a planned transfer as a transfer between the plan accounts without a category', () => {
    const draft = plannedTransactionDraft(
      { ...base, transactionType: 'transfer', targetAccountId: 'savings' },
      '2026-10-06',
    );

    expect(draft).toMatchObject({
      type: 'transfer',
      amount: 5000,
      accountId: 'card',
      targetAccountId: 'savings',
      categoryId: '',
      calendarPlanId: 'plan-1',
      calendarDate: '2026-10-06',
    });
  });

  it('keeps the category of an income or expense plan and links the occurrence', () => {
    const draft = plannedTransactionDraft({ ...base, transactionType: 'income' }, '2026-10-01');

    expect(draft).toMatchObject({
      type: 'income',
      categoryId: 'salary',
      targetAccountId: undefined,
      calendarPlanId: 'plan-1',
      calendarDate: '2026-10-01',
    });
  });
});
