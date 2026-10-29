import { describe, expect, it } from 'vitest';
import { recurringPlanDraft } from './recurringPlanDraft';
import type { Category, Transaction } from '../types';

const expense: Transaction = {
  id: 'tx-1',
  userId: 'user-1',
  accountId: 'card',
  categoryId: 'rent',
  amount: 45000,
  type: 'expense',
  description: 'Аренда квартиры',
  createdAt: '2026-10-05T09:00:00.000Z',
};

const categories = [
  { id: 'rent', userId: 'user-1', name: 'Жильё', type: 'expense', icon: 'home', color: '#000' },
] as Category[];

describe('recurringPlanDraft', () => {
  it('keeps amount, account, category and comment of the operation and preselects monthly', () => {
    expect(recurringPlanDraft(expense, categories)).toEqual({
      title: 'Аренда квартиры',
      note: undefined,
      amount: 45000,
      recurrence: 'monthly',
      transactionType: 'expense',
      accountId: 'card',
      categoryId: 'rent',
      targetAccountId: undefined,
    });
  });

  it('does not pass the operation date, so the plan starts from today', () => {
    expect(recurringPlanDraft(expense, categories)).not.toHaveProperty('date');
  });

  it('keeps both accounts of a transfer and drops the category', () => {
    const draft = recurringPlanDraft(
      { ...expense, type: 'transfer', targetAccountId: 'savings', categoryId: '', description: 'Копилка' },
      categories,
    );

    expect(draft).toMatchObject({
      title: 'Копилка',
      transactionType: 'transfer',
      accountId: 'card',
      targetAccountId: 'savings',
      categoryId: undefined,
    });
  });

  it('titles the plan by the first line of a long comment and keeps the whole comment as the note', () => {
    const draft = recurringPlanDraft(
      { ...expense, description: '## Интернет\nДоговор 123, оплата до 10 числа' },
      categories,
    );

    expect(draft.title).toBe('Интернет');
    expect(draft.note).toBe('## Интернет\nДоговор 123, оплата до 10 числа');
  });

  it('falls back to the category name when the operation has no comment', () => {
    expect(recurringPlanDraft({ ...expense, description: '' }, categories).title).toBe('Жильё');
    expect(recurringPlanDraft({ ...expense, type: 'transfer', description: '' }).title).toBe('Перевод');
  });
});
