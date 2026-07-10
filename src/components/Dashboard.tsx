import { Account, Transaction, Goal, Category, Currency, BalanceHistory } from '../types';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { TotalBalanceCard } from './dashboard/TotalBalanceCard';
import { AccountsSection } from './dashboard/AccountsSection';
import { TransactionsSection } from './dashboard/TransactionsSection';
import { GoalsSection } from './dashboard/GoalsSection';

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

  return (
    <div className="pt-[10px] pb-[8px] px-1.5 sm:px-2 space-y-6">
      <TotalBalanceCard
        visible={showTotalBalance}
        totalBalance={totalBalance}
        monthlyRollingBalance={monthlyRollingBalance}
        monthlyStats={monthlyStats}
        balanceTrend={balanceTrend}
        onNavigateToAnalytics={onNavigateToAnalytics}
        onOpenTransactionHistory={onOpenTransactionHistory}
      />

      <AccountsSection
        accounts={dashboardAccounts}
        allAccounts={accounts}
        currencies={currencies}
        onOpenTransactionHistory={onOpenTransactionHistory}
        onRefresh={onRefresh}
      />

      <TransactionsSection
        groupedTransactions={groupedTransactions}
        hasTransactions={recentTransactions.length > 0}
        categories={categories}
        accounts={accounts}
        onOpenTransactionHistory={onOpenTransactionHistory}
        onOpenAddTransaction={onOpenAddTransaction}
        onEditTransaction={onEditTransaction}
      />

      <GoalsSection
        visible={showGoals}
        goals={goals}
        userId={userId}
        initialGoalData={initialGoalData}
        onCloseGoalManager={onCloseGoalManager}
        onRefresh={onRefresh}
      />

      {/* Bottom Bar Spacer */}
      <div className="h-10 lg:hidden shrink-0" />
    </div>
  );
}
