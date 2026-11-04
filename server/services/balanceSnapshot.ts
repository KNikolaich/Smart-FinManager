/**
 * Month-end balance snapshots for the "Динамика баланса" chart.
 *
 * A point for month M is the total balance at the end of M (Moscow time), the
 * same number the chart shows live while M is the current month. So nothing
 * jumps on the 1st: the live value of October becomes October's stored value.
 *
 * Pure helpers live here; balanceHistory.service.ts reads and writes the rows.
 */

export const MONTH_END_KIND = "month-end";

/** Moscow has been UTC+3 all year round since 2014. */
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface SnapshotAccount {
  id: string;
  name?: string;
  balance: number;
  currency?: string | null;
  currencyId?: string | null;
  showInTotals?: boolean;
  isArchived?: boolean;
}

export interface SnapshotCurrency {
  id: string;
  iso?: string | null;
  symbol?: string | null;
  currency?: string | null;
  rate: number;
}

export interface SnapshotTransaction {
  accountId: string;
  targetAccountId?: string | null;
  amount: number;
  targetAmount?: number | null;
  type: string;
  createdAt: Date;
}

export interface MonthEndDetails {
  kind: typeof MONTH_END_KIND;
  accounts: Array<{ id: string; name?: string; currency?: string | null; balance: number }>;
}

/** "yyyy-MM" of the Moscow calendar month that contains `date`. */
export function moscowMonthKey(date: Date) {
  const shifted = new Date(date.getTime() + MOSCOW_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The instant the Moscow month `key` starts (00:00 MSK on the 1st). */
export function moscowMonthStart(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1) - MOSCOW_OFFSET_MS);
}

export function addMonths(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Ruble price of one unit of the account's currency, resolved like the client's accountCurrencyRate. */
export function accountRate(account: Pick<SnapshotAccount, "currency" | "currencyId"> | undefined, currencies: SnapshotCurrency[]) {
  if (!account) return 1;
  const raw = (account.currency || "").trim();
  const found = (account.currencyId ? currencies.find(c => c.id === account.currencyId) : undefined)
    || (raw ? currencies.find(c => c.iso === raw) || currencies.find(c => c.symbol === raw) || currencies.find(c => c.currency === raw) : undefined);
  const rate = found?.rate;
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : 1;
}

/** Accounts counted in the total, exactly as the balance card counts them. */
export function isCountedAccount(account: SnapshotAccount) {
  return account.showInTotals !== false && !account.isArchived;
}

/** How a transaction changed each account's balance when it was booked. */
function transactionEffects(transaction: SnapshotTransaction): Array<[string, number]> {
  const amount = Number(transaction.amount) || 0;
  if (transaction.type === "income") return [[transaction.accountId, amount]];
  if (transaction.type === "expense") return [[transaction.accountId, -amount]];
  if (transaction.type === "transfer" && transaction.targetAccountId) {
    return [
      [transaction.accountId, -amount],
      [transaction.targetAccountId, Number(transaction.targetAmount ?? amount) || 0],
    ];
  }
  return [];
}

/**
 * Balances as they were before every transaction dated at or after `from`
 * (and before `to`, when given) was booked: the current balances with those
 * transactions taken back out.
 */
export function rollBackBalances(
  balances: Map<string, number>,
  transactions: SnapshotTransaction[],
  from: Date,
  to?: Date,
) {
  const result = new Map(balances);
  for (const transaction of transactions) {
    const time = new Date(transaction.createdAt).getTime();
    if (time < from.getTime()) continue;
    if (to && time >= to.getTime()) continue;
    for (const [accountId, delta] of transactionEffects(transaction)) {
      if (result.has(accountId)) result.set(accountId, (result.get(accountId) || 0) - delta);
    }
  }
  return result;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Month-end snapshot of `month` built from the accounts as they are now: the
 * counted accounts' balances minus everything dated after that month ended.
 */
export function monthEndFromCurrent(
  month: string,
  accounts: SnapshotAccount[],
  currencies: SnapshotCurrency[],
  transactions: SnapshotTransaction[],
) {
  const counted = accounts.filter(isCountedAccount);
  const balances = rollBackBalances(
    new Map(counted.map(account => [account.id, account.balance])),
    transactions,
    moscowMonthStart(addMonths(month, 1)),
  );
  const details: MonthEndDetails = {
    kind: MONTH_END_KIND,
    accounts: counted.map(account => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      balance: roundMoney(balances.get(account.id) || 0),
    })),
  };
  const totalBalance = roundMoney(counted.reduce(
    (sum, account) => sum + (balances.get(account.id) || 0) * accountRate(account, currencies),
    0,
  ));
  return { month, totalBalance, details };
}

export interface StoredSnapshot {
  id: string;
  month: string;
  totalBalance: number;
  details: unknown;
  createdAt: Date;
}

/**
 * The automatic snapshot written before month-end snapshots existed: taken on
 * the first visit of a month, labelled with that month, holding the balances
 * of that moment as `[{ id, name, balance }]`. Demo rows use `accountId` and
 * manual rows have no details, so neither matches.
 */
export function isLegacyAutoSnapshot(record: StoredSnapshot) {
  const details = record.details;
  if (!Array.isArray(details) || details.length === 0) return false;
  if (!details.every(item => item && typeof item === "object" && typeof (item as any).id === "string" && !("accountId" in item))) return false;
  const created = new Date(record.createdAt);
  const utcMonth = created.toISOString().slice(0, 7);
  return record.month === utcMonth || record.month === moscowMonthKey(created);
}

/**
 * Turns a legacy start-of-month snapshot into the month-end value of the month
 * before it: the balances it holds, with the transactions dated between the
 * month boundary and the moment it was taken rolled back out.
 */
export function monthEndFromLegacy(
  record: StoredSnapshot,
  accounts: SnapshotAccount[],
  currencies: SnapshotCurrency[],
  transactions: SnapshotTransaction[],
) {
  const takenAt = new Date(record.createdAt);
  const takenMonth = moscowMonthKey(takenAt);
  const month = addMonths(takenMonth, -1);
  const boundary = moscowMonthStart(takenMonth);
  const items = (record.details as Array<{ id: string; name?: string; balance: number }>);
  const balances = rollBackBalances(
    new Map(items.map(item => [item.id, Number(item.balance) || 0])),
    transactions,
    boundary,
    takenAt,
  );
  const byId = new Map(accounts.map(account => [account.id, account]));
  const details: MonthEndDetails = {
    kind: MONTH_END_KIND,
    accounts: items.map(item => ({
      id: item.id,
      name: item.name,
      currency: byId.get(item.id)?.currency,
      balance: roundMoney(balances.get(item.id) || 0),
    })),
  };
  const totalBalance = roundMoney(items.reduce(
    (sum, item) => sum + (balances.get(item.id) || 0) * accountRate(byId.get(item.id), currencies),
    0,
  ));
  return { month, totalBalance, details, gapMs: takenAt.getTime() - boundary.getTime() };
}
