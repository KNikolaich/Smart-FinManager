import { describe, expect, it } from 'vitest';
import type { PlannedPayment } from '../types';
import { formatCompactAmount, formatSignedAmount, sumPlanOccurrences } from './planTotals';

const plan = (amount: number, transactionType?: PlannedPayment['transactionType']) => ({
  date: '2026-11-04',
  status: 'pending' as const,
  payment: { id: `p-${amount}`, title: 'План', amount, date: '2026-11-04', recurrence: 'none' as const, status: 'pending' as const, transactionType },
});

describe('sumPlanOccurrences', () => {
  it('adds income, subtracts expenses and ignores transfers', () => {
    const totals = sumPlanOccurrences([plan(50000, 'income'), plan(1200, 'expense'), plan(800), plan(10000, 'transfer')]);
    expect(totals).toEqual({ income: 50000, expense: 2000, net: 48000, count: 4 });
  });

  it('is zero for no plans', () => {
    expect(sumPlanOccurrences([])).toEqual({ income: 0, expense: 0, net: 0, count: 0 });
  });
});

describe('amount formatting', () => {
  it('formats signed full amounts', () => {
    expect(formatSignedAmount(48000).replace(/\s/g, ' ')).toBe('+48 000 ₽');
    expect(formatSignedAmount(-3200).replace(/\s/g, ' ')).toBe('−3 200 ₽');
    expect(formatSignedAmount(0)).toBe('0 ₽');
  });

  it('formats compact amounts for narrow day cells', () => {
    expect(formatCompactAmount(-950)).toBe('−950');
    expect(formatCompactAmount(-3200)).toBe('−3,2к');
    expect(formatCompactAmount(48000)).toBe('+48к');
    expect(formatCompactAmount(-1500000)).toBe('−1,5М');
  });
});
