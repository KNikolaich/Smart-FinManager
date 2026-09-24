import { Account, Transaction, Goal, Category, Currency, BalanceHistory, DashboardWidgetId } from '../types';
import type { PlannedPaymentOccurrence } from '../lib/plannedPaymentOccurrences';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { TotalBalanceCard } from './dashboard/TotalBalanceCard';
import { AccountsSection } from './dashboard/AccountsSection';
import { TransactionsSection } from './dashboard/TransactionsSection';
import { GoalsSection } from './dashboard/GoalsSection';
import UpcomingTasks from './UpcomingTasks';
import { DEFAULT_DASHBOARD_WIDGET_ORDER } from '../lib/dashboardLayout';

export type { DashboardWidgetId };
export { DEFAULT_DASHBOARD_WIDGET_ORDER };

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
  onEditUpcomingTask?: (item: PlannedPaymentOccurrence) => void;
  widgetOrder?: DashboardWidgetId[];
  widgetVisibility?: Partial<Record<DashboardWidgetId, boolean>>;
  widgetSpans?: Partial<Record<DashboardWidgetId, number>>;
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
  onEditUpcomingTask,
  widgetOrder = DEFAULT_DASHBOARD_WIDGET_ORDER,
  widgetVisibility = {},
  widgetSpans = {},
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
    const stretchClass = options.stretch ? 'h-full' : undefined;
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
            className={stretchClass}
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
            className={stretchClass}
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
            className={stretchClass}
          />
        );
      case 'upcomingTasks':
        return (
          <UpcomingTasks
            variant="carousel"
            className={stretchClass}
            onOpenCalendar={onOpenCalendar}
            onEditTask={onEditUpcomingTask}
            onRequestTransaction={(item, onCompleted) => onOpenAddTransaction?.({
              type: item.payment.transactionType,
              amount: item.payment.amount,
              accountId: item.payment.accountId || '',
              categoryId: item.payment.categoryId || '',
              description: item.payment.title,
              createdAt: new Date().toISOString(),
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
            className={stretchClass}
          />
        );
    }
  };

  const visibleWidgetOrder = widgetOrder.filter(widgetId => widgetVisibility[widgetId] !== false);
  const renderedWidgets = [];
  for (const widgetId of visibleWidgetOrder) {
    const span = Math.max(1, Math.min(12, Math.round(widgetSpans[widgetId] ?? 12)));
    renderedWidgets.push(
      <div
        key={widgetId}
        className="min-w-0 h-full"
        style={{ gridColumn: `span ${span} / span ${span}` }}
      >
        {renderWidget(widgetId, { stretch: true })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 items-stretch gap-6 pt-[10px] pb-[8px] px-1.5 sm:px-2">
      {renderedWidgets}

      {/* Bottom Bar Spacer */}
      <div className="h-10 lg:hidden shrink-0" />
    </div>
  );
}
