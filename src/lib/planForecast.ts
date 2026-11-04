import type { Account, Currency, PlannedPayment } from '../types';
import { accountCurrencyRate } from './currencyUtils';
import { getPaymentOccurrencesInRange, parseDateKey, toDateKey } from './plannedPaymentOccurrences';

/** How far ahead the plan forecast looks, in months. */
export const PLAN_FORECAST_MONTHS = 2;

export interface PlanForecastOperation {
  title: string;
  /** Change of the total balance in rubles: + income, − expense, ± transfer to/from an uncounted account. */
  delta: number;
  type: 'income' | 'expense' | 'transfer';
}

export interface PlanForecastPoint {
  /** yyyy-MM-dd */
  date: string;
  /** Total balance in rubles at the end of this day, after its plans. */
  balance: number;
  income: number;
  expense: number;
  operations: PlanForecastOperation[];
  /** The opening point: the balance right now, before today's remaining plans. */
  isStart?: boolean;
}

export interface PlanForecast {
  points: PlanForecastPoint[];
  startBalance: number;
  endBalance: number;
  income: number;
  expense: number;
  minBalance: number;
  minDate: string;
}

/** Accounts that make up the total balance, the same way the balance card counts them. */
export function isCountedAccount(account: Account | undefined) {
  return !!account && account.showInTotals && !account.isArchived;
}

/** Total balance in rubles of the counted accounts. */
export function totalRubleBalance(accounts: Account[], currencies: Currency[]) {
  return accounts
    .filter(isCountedAccount)
    .reduce((sum, account) => sum + account.balance * accountCurrencyRate(account, currencies), 0);
}

/**
 * How one plan changes the total balance, in rubles. A plan without an account
 * is counted against the total (it is money the user expects to spend or get);
 * a plan on an account left out of the total does not change it. A transfer
 * changes the total only when it crosses the boundary of counted accounts.
 */
export function planBalanceDelta(payment: PlannedPayment, accounts: Account[], currencies: Currency[]) {
  const amount = Math.abs(Number(payment.amount) || 0);
  if (!amount) return 0;
  const source = payment.accountId ? accounts.find(a => a.id === payment.accountId) : undefined;
  const sourceCounted = payment.accountId ? isCountedAccount(source) : true;
  const rubles = amount * (source ? accountCurrencyRate(source, currencies) : 1);
  const type = payment.transactionType || 'expense';

  if (type === 'income') return sourceCounted ? rubles : 0;
  if (type === 'expense') return sourceCounted ? -rubles : 0;

  const target = payment.targetAccountId ? accounts.find(a => a.id === payment.targetAccountId) : undefined;
  const targetCounted = isCountedAccount(target);
  if (!payment.accountId) return 0;
  if (sourceCounted === targetCounted) return 0;
  return sourceCounted ? -rubles : rubles;
}

/**
 * Day-by-day forecast of the total balance: it starts at the current balance
 * today and applies every plan that is still to be done from today to the end
 * of the horizon. Completed plans are already in the balance; overdue ones
 * (before today) are not counted, the forecast only looks forward.
 */
export function buildPlanForecast(
  payments: PlannedPayment[],
  accounts: Account[],
  currencies: Currency[],
  today: Date = new Date(),
  months = PLAN_FORECAST_MONTHS,
): PlanForecast {
  const startKey = toDateKey(today);
  const start = parseDateKey(startKey);
  const end = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
  const endKey = toDateKey(end);
  const startBalance = totalRubleBalance(accounts, currencies);

  const byDate = new Map<string, PlanForecastOperation[]>();
  for (const payment of payments) {
    const delta = planBalanceDelta(payment, accounts, currencies);
    for (const occurrence of getPaymentOccurrencesInRange(payment, startKey, endKey)) {
      if (occurrence.status === 'paid' || occurrence.transactionId || occurrence.manuallyCompleted) continue;
      const list = byDate.get(occurrence.date) || [];
      list.push({ title: payment.title, delta, type: payment.transactionType || 'expense' });
      byDate.set(occurrence.date, list);
    }
  }

  // The line starts at the balance there is now. When plans are still due
  // today, an opening point keeps that starting value visible before them.
  const points: PlanForecastPoint[] = byDate.has(startKey)
    ? [{ date: startKey, balance: startBalance, income: 0, expense: 0, operations: [], isStart: true }]
    : [];
  let balance = startBalance;
  let income = 0;
  let expense = 0;
  let minBalance = startBalance;
  let minDate = startKey;
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const date = toDateKey(day);
    const operations = byDate.get(date) || [];
    let dayIncome = 0;
    let dayExpense = 0;
    for (const operation of operations) {
      if (operation.delta > 0) dayIncome += operation.delta;
      else dayExpense -= operation.delta;
    }
    balance += dayIncome - dayExpense;
    income += dayIncome;
    expense += dayExpense;
    if (balance < minBalance) {
      minBalance = balance;
      minDate = date;
    }
    points.push({ date, balance, income: dayIncome, expense: dayExpense, operations });
  }

  return { points, startBalance, endBalance: balance, income, expense, minBalance, minDate };
}
