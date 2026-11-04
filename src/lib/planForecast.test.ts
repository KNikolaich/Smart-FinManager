import { describe, expect, it } from 'vitest';
import type { Account, Currency, PlannedPayment } from '../types';
import { buildPlanForecast, planBalanceDelta, totalRubleBalance } from './planForecast';

const account = (id: string, balance: number, extra: Partial<Account> = {}): Account => ({
  id, userId: 'u', name: id, type: 'card', balance, currency: '₽', showOnDashboard: true, showInTotals: true, ...extra,
});

const currencies: Currency[] = [{ id: 'usd', iso: 'USD', symbol: '$', currency: 'Доллар', rate: 90 } as Currency];

const plan = (id: string, extra: Partial<PlannedPayment>): PlannedPayment => ({
  id, title: id, amount: 1000, date: '2026-11-10', recurrence: 'none', status: 'pending', accountId: 'card', ...extra,
});

const accounts = [
  account('card', 100_000),
  account('usd', 100, { currency: 'USD' }),
  account('hidden', 50_000, { showInTotals: false }),
  account('old', 70_000, { isArchived: true }),
];

describe('totalRubleBalance', () => {
  it('counts shown, non-archived accounts at their ruble rate', () => {
    expect(totalRubleBalance(accounts, currencies)).toBe(109_000);
  });
});

describe('planBalanceDelta', () => {
  it('adds income and subtracts expenses of counted accounts', () => {
    expect(planBalanceDelta(plan('a', { transactionType: 'income', amount: 5000 }), accounts, currencies)).toBe(5000);
    expect(planBalanceDelta(plan('b', { amount: 300 }), accounts, currencies)).toBe(-300);
    expect(planBalanceDelta(plan('c', { accountId: 'usd', amount: 10 }), accounts, currencies)).toBe(-900);
  });

  it('ignores plans on accounts left out of the total', () => {
    expect(planBalanceDelta(plan('d', { accountId: 'hidden' }), accounts, currencies)).toBe(0);
  });

  it('counts a transfer only when it leaves or enters the counted accounts', () => {
    expect(planBalanceDelta(plan('e', { transactionType: 'transfer', targetAccountId: 'usd' }), accounts, currencies)).toBe(0);
    expect(planBalanceDelta(plan('f', { transactionType: 'transfer', targetAccountId: 'hidden' }), accounts, currencies)).toBe(-1000);
    expect(planBalanceDelta(plan('g', { transactionType: 'transfer', accountId: 'hidden', targetAccountId: 'card' }), accounts, currencies)).toBe(1000);
  });
});

describe('buildPlanForecast', () => {
  const today = new Date(2026, 10, 4, 12);

  it('starts at the current balance and runs two months ahead', () => {
    const forecast = buildPlanForecast([], accounts, currencies, today);
    expect(forecast.points[0]).toMatchObject({ date: '2026-11-04', balance: 109_000 });
    expect(forecast.points.at(-1)?.date).toBe('2027-01-04');
    expect(forecast.endBalance).toBe(109_000);
  });

  it('applies future plans day by day, including recurring ones', () => {
    const forecast = buildPlanForecast([
      plan('salary', { transactionType: 'income', amount: 80_000, date: '2026-10-15', recurrence: 'monthly' }),
      plan('rent', { amount: 40_000, date: '2026-11-20' }),
    ], accounts, currencies, today);

    const at = (date: string) => forecast.points.find(p => p.date === date)!.balance;
    expect(at('2026-11-14')).toBe(109_000);
    expect(at('2026-11-15')).toBe(189_000);
    expect(at('2026-11-20')).toBe(149_000);
    expect(at('2026-12-15')).toBe(229_000);
    expect(forecast).toMatchObject({ income: 160_000, expense: 40_000, endBalance: 229_000 });
  });

  it('skips completed and overdue plans and finds the lowest point', () => {
    const forecast = buildPlanForecast([
      plan('done', { date: '2026-11-10', paidDates: ['2026-11-10'] }),
      plan('overdue', { date: '2026-11-01' }),
      plan('big', { amount: 150_000, date: '2026-11-12' }),
      plan('pay', { transactionType: 'income', amount: 60_000, date: '2026-11-13' }),
    ], accounts, currencies, today);
    expect(forecast.minBalance).toBe(-41_000);
    expect(forecast.minDate).toBe('2026-11-12');
    expect(forecast.endBalance).toBe(19_000);
  });

  it('keeps the current balance as an opening point when plans are due today', () => {
    const forecast = buildPlanForecast([plan('today', { date: '2026-11-04', amount: 9000 })], accounts, currencies, today);
    expect(forecast.points[0]).toMatchObject({ date: '2026-11-04', balance: 109_000, isStart: true });
    expect(forecast.points[1]).toMatchObject({ date: '2026-11-04', balance: 100_000 });
  });
});
