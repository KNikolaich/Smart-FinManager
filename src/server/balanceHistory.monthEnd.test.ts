import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  history: [] as any[],
  accounts: [] as any[],
  currencies: [] as any[],
  transactions: [] as any[],
}));

vi.mock('../../server/prisma', () => ({
  prisma: {
    balanceHistory: {
      findMany: vi.fn(async () => db.history.map(row => ({ ...row }))),
      deleteMany: vi.fn(({ where }: any) => ({ op: 'delete', ids: where.id.in })),
      createMany: vi.fn(({ data }: any) => ({ op: 'create', data })),
    },
    account: { findMany: vi.fn(async () => db.accounts) },
    currency: { findMany: vi.fn(async () => db.currencies) },
    transaction: {
      findMany: vi.fn(async ({ where }: any) => db.transactions.filter(t => t.createdAt >= where.createdAt.gte)),
    },
    $transaction: vi.fn(async (ops: any[]) => {
      for (const op of ops) {
        if (op.op === 'delete') db.history = db.history.filter(row => !op.ids.includes(row.id));
        if (op.op === 'create') {
          for (const row of op.data) {
            if (db.history.some(existing => existing.month === row.month)) continue;
            db.history.push({ ...row, id: `new-${row.month}`, createdAt: new Date() });
          }
        }
      }
    }),
  },
}));

import { ensureMonthEndSnapshots } from '../../server/services/balanceHistory.service';
import { moscowMonthKey, moscowMonthStart } from '../../server/services/balanceSnapshot';

const account = (id: string, balance: number, extra: Record<string, unknown> = {}) => ({
  id, name: id, balance, currency: 'RUB', currencyId: null, showInTotals: true, isArchived: false, ...extra,
});
const tx = (type: string, amount: number, createdAt: string, extra: Record<string, unknown> = {}) => ({
  accountId: 'card', targetAccountId: null, amount, targetAmount: null, type, createdAt: new Date(createdAt), ...extra,
});
const byMonth = () => Object.fromEntries(db.history.map(row => [row.month, row.totalBalance]));

describe('Moscow month helpers', () => {
  it('uses Moscow time at the month boundary', () => {
    expect(moscowMonthKey(new Date('2026-10-31T20:59:00Z'))).toBe('2026-10');
    expect(moscowMonthKey(new Date('2026-10-31T21:00:00Z'))).toBe('2026-11');
    expect(moscowMonthStart('2026-11').toISOString()).toBe('2026-10-31T21:00:00.000Z');
  });
});

describe('ensureMonthEndSnapshots', () => {
  beforeEach(() => {
    db.history = [];
    db.currencies = [{ id: 'usd', iso: 'USD', symbol: '$', currency: 'доллар', rate: 90 }];
    db.accounts = [
      account('card', 100_000),
      account('usd', 100, { currency: 'USD' }),
      account('hidden', 5_000, { showInTotals: false }),
      account('old', 7_000, { isArchived: true }),
    ];
    db.transactions = [];
  });

  it('stores the last finished month as the balance at its end, not at the start of the next', async () => {
    db.transactions = [
      tx('expense', 3_000, '2026-10-31T18:00:00Z'), // 31 Oct, 21:00 MSK: still October
      tx('income', 50_000, '2026-11-02T09:00:00Z'),
      tx('expense', 8_000, '2026-11-03T09:00:00Z'),
      tx('transfer', 1_000, '2026-11-03T10:00:00Z', { targetAccountId: 'hidden' }),
    ];
    await ensureMonthEndSnapshots('u', new Date('2026-11-04T12:00:00Z'));

    // card at the end of October: 100 000 − 50 000 + 8 000 + 1 000; USD at 90.
    expect(byMonth()).toEqual({ '2026-10': 59_000 + 9_000 });
    expect(db.history[0].details.kind).toBe('month-end');
  });

  it('matches the live value shown on the last evening of the month', async () => {
    const live = 100_000 + 100 * 90;
    await ensureMonthEndSnapshots('u', new Date('2026-11-01T06:00:00Z'));
    expect(byMonth()['2026-10']).toBe(live);
  });

  it('moves a legacy start-of-month snapshot to the month before and rolls back what came after the boundary', async () => {
    db.history = [{
      id: 'legacy-nov', month: '2026-11', totalBalance: 999, createdAt: new Date('2026-11-03T08:00:00Z'),
      details: [{ id: 'card', name: 'card', balance: 70_000 }, { id: 'usd', name: 'usd', balance: 200 }],
    }];
    db.transactions = [
      tx('income', 40_000, '2026-11-02T08:00:00Z'), // after the boundary, before the snapshot
      tx('expense', 500, '2026-11-03T09:00:00Z'), // after the snapshot: already not in it
    ];
    await ensureMonthEndSnapshots('u', new Date('2026-11-04T12:00:00Z'));

    expect(byMonth()).toEqual({ '2026-10': 30_000 + 200 * 90 });
    expect(db.history.some(row => row.id === 'legacy-nov')).toBe(false);
  });

  it('keeps manual and demo rows and never stores the current month', async () => {
    db.history = [
      { id: 'manual', month: '2026-10', totalBalance: 12_345, details: null, createdAt: new Date('2026-10-20T00:00:00Z') },
      { id: 'demo', month: '2026-09', totalBalance: 1, details: [{ accountId: 'card', balance: 1 }], createdAt: new Date('2026-11-01T00:00:00Z') },
    ];
    await ensureMonthEndSnapshots('u', new Date('2026-11-04T12:00:00Z'));
    expect(byMonth()).toEqual({ '2026-10': 12_345, '2026-09': 1 });
  });

  it('fills every finished month since the last stored one', async () => {
    db.history = [{ id: 'manual', month: '2026-07', totalBalance: 1, details: null, createdAt: new Date('2026-08-01T00:00:00Z') }];
    db.transactions = [
      tx('income', 10_000, '2026-09-15T09:00:00Z'),
      tx('income', 20_000, '2026-10-15T09:00:00Z'),
    ];
    await ensureMonthEndSnapshots('u', new Date('2026-11-04T12:00:00Z'));
    expect(byMonth()).toEqual({
      '2026-07': 1,
      '2026-08': 79_000,
      '2026-09': 89_000,
      '2026-10': 109_000,
    });
  });

  it('does nothing once the history is up to date', async () => {
    await ensureMonthEndSnapshots('u', new Date('2026-11-04T12:00:00Z'));
    const first = [...db.history];
    db.accounts[0].balance = 1;
    await ensureMonthEndSnapshots('u', new Date('2026-11-20T12:00:00Z'));
    expect(db.history).toEqual(first);
  });
});
