import type { PlannedPaymentOccurrence } from './plannedPaymentOccurrences';

export interface PlanTotals {
  income: number;
  expense: number;
  /** income − expense. Transfers move money between own accounts and do not change it. */
  net: number;
  /** How many shown plans went into the totals, transfers included. */
  count: number;
}

const EMPTY_TOTALS: PlanTotals = { income: 0, expense: 0, net: 0, count: 0 };

/** Sums the plans the calendar shows, so the user can see whether the plan fits the budget. */
export function sumPlanOccurrences(items: Iterable<PlannedPaymentOccurrence>): PlanTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const item of items) {
    const amount = Math.abs(Number(item.payment.amount) || 0);
    totals.count += 1;
    if (item.payment.transactionType === 'income') totals.income += amount;
    else if (item.payment.transactionType === 'transfer') continue;
    else totals.expense += amount;
  }
  totals.net = totals.income - totals.expense;
  return totals;
}

const fullFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** Signed amount, e.g. "+12 500 ₽", "−3 200 ₽", "0 ₽". */
export function formatSignedAmount(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${fullFormatter.format(Math.abs(rounded))} ₽`;
}

/** Short signed amount for a narrow calendar cell, e.g. "−3,2к", "+12к", "−1,5М", "−950". */
export function formatCompactAmount(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  const abs = Math.abs(rounded);
  const short = (amount: number, suffix: string) => {
    const digits = amount < 10 ? 1 : 0;
    const text = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(amount);
    return `${text}${suffix}`;
  };
  if (abs >= 1_000_000) return `${sign}${short(abs / 1_000_000, 'М')}`;
  if (abs >= 1_000) return `${sign}${short(abs / 1_000, 'к')}`;
  return `${sign}${abs}`;
}

export function planTotalsTone(net: number) {
  if (net > 0) return 'text-emerald-700';
  if (net < 0) return 'text-red-700';
  return 'text-theme-muted';
}
