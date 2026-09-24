import { describe, expect, it } from 'vitest';
import type { Account, Category } from '../types';
import { normalizeAICalendarPlanDraft } from './aiCalendarPlanDraft';

const accounts = [
  { id: 'cash-1', name: 'Наличные', aliases: 'кошелёк', showOnDashboard: true, isArchived: false },
] as Account[];

const categories = [
  { id: 'rent', name: 'Жильё', type: 'expense' },
  { id: 'salary', name: 'Зарплата', type: 'income' },
] as Category[];

describe('normalizeAICalendarPlanDraft', () => {
  it('maps exact account and category references and keeps valid schedule fields', () => {
    const draft = normalizeAICalendarPlanDraft({
      title: 'Аренда',
      amount: '32000',
      date: '2026-10-01',
      accountName: 'Кошелёк',
      categoryName: 'Жильё',
      transactionType: 'expense',
      recurrence: 'monthly',
      weekdays: [1, 1, 8, 3],
      time: '09:30',
      note: 'Оплатить до конца дня',
    }, accounts, categories);

    expect(draft).toEqual({
      title: 'Аренда',
      amount: 32000,
      date: '2026-10-01',
      accountId: 'cash-1',
      categoryId: 'rent',
      transactionType: 'expense',
      recurrence: 'monthly',
      weekdays: [1, 3],
      time: '09:30',
      note: 'Оплатить до конца дня',
    });
  });

  it('does not guess mismatched accounts or categories and drops invalid values', () => {
    const draft = normalizeAICalendarPlanDraft({
      title: 'Цель',
      amount: -12,
      date: '2026-02-30',
      accountName: 'Неизвестный счёт',
      categoryName: 'Жильё',
      transactionType: 'income',
      recurrence: 'every-month',
      time: '25:90',
    }, accounts, categories);

    expect(draft).toEqual({
      title: 'Цель',
      amount: 0,
      accountId: '',
      categoryId: '',
      transactionType: 'income',
      recurrence: 'none',
    });
  });
});