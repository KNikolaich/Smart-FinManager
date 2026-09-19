import { Fragment } from 'react';
import { Account, Transaction, Goal, Category, Currency, BalanceHistory } from '../types';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { TotalBalanceCard } from './dashboard/TotalBalanceCard';
import { AccountsSection } from './dashboard/AccountsSection';
import { TransactionsSection } from './dashboard/TransactionsSection';
import { GoalsSection } from './dashboard/GoalsSection';
import UpcomingTasks from './UpcomingTasks';

export type DashboardWidgetId = 'balance' | 'accounts' | 'transactions' | 'upcomingTasks' | 'goals';

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  'balance',
  'accounts',
  'transactions',
  'upcomingTasks',
  'goals',
];

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  categories: Category[];
  currencies: Currency[];
  balanceHistory: BalanceHistory[];
  userId: string;
  showTotalBalance: boolean;
  showGoals: boolean;
  initialGoalData?: {
    name?: string;
    targetAmount?: number;
    deadline?: string;
  };
  onCloseGoalManager?: () => void;
  onRefresh?: () => void;
  onNavigateToAnalytics?: (options?: any) => void;
  onOpenTransactionHistory?: (filterProps?: any) => void;
  onOpenAddTransaction?: (initialData?: any) => void;
  onEditTransaction?: (t: Transaction) => void;
  onNavigateToCalendar?: (date: string) => void;
  widgetOrder?: DashboardWidgetId[];
}

export default function Dashboard({
  accounts,
  transactions,
  goals,
  categories,
  currencies,
  balanceHistory,
  userId,
  showTotalBalance,
  showGoals,
  initialGoalData,
  onCloseGoalManager,
  onRefresh,
  onNavigateToAnalytics,
  onOpenTransactionHistory,
  onOpenAddTransaction,
  onEditTransaction,
  onNavigateToCalendar,
  widgetOrder = DEFAULT_DASHBOARD_WIDGET_ORDER,
}: DashboardProps) {
  const {
    totalBalance,
    dashboardAccounts,
    monthlyStats,
    monthlyRollingBalance,
    recentTransactions,
    groupedTransactions,
    balanceTrend
  } = useDashboardMetrics(accounts, transactions, currencies, balanceHistory);

  const renderWidget = (widgetId: DashboardWidgetId) => {
    switch (widgetId) {
      case 'balance':
        return (
          <TotalBalanceCard
            visible={showTotalBalance}
            totalBalance={totalBalance}
            monthlyRollingBalance={monthlyRollingBalance}
            monthlyStats={monthlyStats}
            balanceTrend={balanceTrend}
            onNavigateToAnalytics={onNavigateToAnalytics}
            onOpenTransactionHistory={onOpenTransactionHistory}
          />
        );
      case 'accounts':
        return (
          <AccountsSection
            accounts={dashboardAccounts}
            allAccounts={accounts}
            currencies={currencies}
            onOpenTransactionHistory={onOpenTransactionHistory}
            onRefresh={onRefresh}
          />
        );
      case 'transactions':
        return (
          <TransactionsSection
            groupedTransactions={groupedTransactions}
            hasTransactions={recentTransactions.length > 0}
            categories={categories}
            accounts={accounts}
            onOpenTransactionHistory={onOpenTransactionHistory}
            onOpenAddTransaction={onOpenAddTransaction}
            onEditTransaction={onEditTransaction}
            onRefresh={onRefresh}
          />
        );
      case 'upcomingTasks':
        return (
          <UpcomingTasks
            variant="carousel"
            onTaskClick={onNavigateToCalendar}
            onRequestTransaction={(item, onCompleted) => onOpenAddTransaction?.({
              type: item.payment.transactionType,
              amount: item.payment.amount,
              accountId: item.payment.accountId || '',
              categoryId: item.payment.categoryId || '',
              description: item.payment.title,
              createdAt: `${item.date}T12:00:00`,
              __onTransactionCreated: onCompleted,
            })}
          />
        );
      case 'goals':
        return (
          <GoalsSection
            visible={showGoals}
            goals={goals}
            userId={userId}
            initialGoalData={initialGoalData}
            onCloseGoalManager={onCloseGoalManager}
            onRefresh={onRefresh}
          />
        );
    }
  };

  return (
    <div className="pt-[10px] pb-[8px] px-1.5 sm:px-2 space-y-6">
      {widgetOrder.map(widgetId => (
        <Fragment key={widgetId}>{renderWidget(widgetId)}</Fragment>
      ))}

      {/* Bottom Bar Spacer */}
      <div className="h-10 lg:hidden shrink-0" />
    </div>
  );
}
