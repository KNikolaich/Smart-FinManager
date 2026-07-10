import { useMemo } from 'react';
import { Account, Transaction, Currency, BalanceHistory, AccountType } from '../types';
import { format, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';

export function useDashboardMetrics(
  accounts: Account[],
  transactions: Transaction[],
  currencies: Currency[],
  balanceHistory: BalanceHistory[]
) {
  const totalBalance = useMemo(() => {
    return accounts
      .filter(a => a.showInTotals && !a.isArchived)
      .reduce((sum, acc) => {
        if (acc.currency === '₽') {
          return sum + acc.balance;
        }

        const currency = currencies.find(c => c.symbol === acc.currency);
        const rate = currency ? currency.rate : 1;
        return sum + (acc.balance * rate);
      }, 0);
  }, [accounts, currencies]);

  const dashboardAccounts = useMemo(() => {
    const order: Record<AccountType, number> = { card: 0, credit: 1, cash: 2, bank: 3 };
    return accounts
      .filter(a => a.showOnDashboard && !a.isArchived)
      .sort((a, b) => order[a.type] - order[b.type]);
  }, [accounts]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const currentMonthTransactions = transactions.filter(t => new Date(t.createdAt) >= startOfMonth);

    const income = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expense };
  }, [transactions]);

  const monthlyRollingBalance = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = subMonths(now, 1);

    const relevantAccountIds = new Set(accounts.filter(a => a.showInTotals).map(a => a.id));

    return transactions
      .filter(t => {
        const tDate = new Date(t.createdAt);
        return tDate >= oneMonthAgo && tDate <= now &&
               (t.type === 'income' || t.type === 'expense') &&
               relevantAccountIds.has(t.accountId);
      })
      .reduce((sum, t) => {
        const amount = t.type === 'income' ? t.amount : -t.amount;

        const acc = accounts.find(a => a.id === t.accountId);
        if (!acc) return sum;

        if (acc.currency === '₽') {
          return sum + amount;
        }

        const currency = currencies.find(c => c.symbol === acc.currency);
        const rate = currency ? currency.rate : 1;
        return sum + (amount * rate);
      }, 0);
  }, [transactions, accounts, currencies]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [transactions]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    recentTransactions.forEach(t => {
      const dateKey = format(new Date(t.createdAt), 'dd MMMM', { locale: ru });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0].split('.').reverse().join('-')).getTime() - new Date(a[0].split('.').reverse().join('-')).getTime());
  }, [recentTransactions]);

  const balanceTrend = useMemo(() => {
    // 1. Get history points and sort them by month ascending
    const historyPoints = [...balanceHistory]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(h => ({
        name: format(new Date(h.month + '-01'), 'MMM', { locale: ru }),
        month: h.month,
        balance: h.totalBalance
      }));

    // 2. Add current state as the last point
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const currentPoint = {
      name: format(new Date(), 'MMM', { locale: ru }),
      month: currentMonthKey,
      balance: totalBalance
    };

    // If we already have a history point for this month, override it with current balance
    // otherwise append the current balance
    const existingIndex = historyPoints.findIndex(p => p.month === currentMonthKey);
    if (existingIndex !== -1) {
      historyPoints[existingIndex] = currentPoint;
      return historyPoints;
    } else {
      return [...historyPoints, currentPoint].sort((a, b) => a.month.localeCompare(b.month));
    }
  }, [balanceHistory, totalBalance]);

  return {
    totalBalance,
    dashboardAccounts,
    monthlyStats,
    monthlyRollingBalance,
    recentTransactions,
    groupedTransactions,
    balanceTrend
  };
}
