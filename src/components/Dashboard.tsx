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
  'upcomingTasks',
  'accounts',
  'transactions',
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
  onOpenCalendar?: () => void;
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
  initialGoalData,
  onCloseGoalManager,
  onRefresh,
  onNavigateToAnalytics,
  onOpenTransactionHistory,
  onOpenAddTransaction,
  onEditTransaction,
  onNavigateToCalendar,
  onOpenCalendar,
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

  const renderWidget = (widgetId: DashboardWidgetId, options: { stretch?: boolean } = {}) => {
    switch (widgetId) {
      case 'balance':
        return (
          <TotalBalanceCard
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
            className={options.stretch ? 'h-full' : undefined}
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
            className={options.stretch ? 'h-full' : undefined}
            onOpenCalendar={onOpenCalendar}
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
            goals={goals}
            userId={userId}
            initialGoalData={initialGoalData}
            onCloseGoalManager={onCloseGoalManager}
            onRefresh={onRefresh}
          />
        );
    }
  };

  const renderedWidgets = [];
  for (let index = 0; index < widgetOrder.length; index += 1) {
    const widgetId = widgetOrder[index];
    const nextWidgetId = widgetOrder[index + 1];

    if (widgetId === 'upcomingTasks' && nextWidgetId === 'accounts') {
      renderedWidgets.push(
        <div
          key="upcoming-tasks-and-accounts"
          className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]"
        >
          {renderWidget('upcomingTasks', { stretch: true })}
          {renderWidget('accounts', { stretch: true })}
        </div>
      );
      index += 1;
      continue;
    }

    renderedWidgets.push(
      <Fragment key={widgetId}>{renderWidget(widgetId)}</Fragment>
    );
  }

  return (
    <div className="pt-[10px] pb-[8px] px-1.5 sm:px-2 space-y-6">
      {renderedWidgets}

      {/* Bottom Bar Spacer */}
      <div className="h-10 lg:hidden shrink-0" />
    </div>
  );
}
