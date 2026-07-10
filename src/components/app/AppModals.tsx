import TransactionHistory from '../TransactionHistory';
import AddTransaction from '../AddTransaction';
import EditTransaction from '../EditTransaction';
import UserPage from '../UserPage';
import AILogs from '../AILogs';
import { GenericContextMenu } from '../ui/GenericContextMenu';
import { Account, Category, Transaction, UserProfile } from '../../types';

interface TransactionHistoryFilter {
  categoryId?: string;
  accountId?: string;
  type?: 'all' | 'income' | 'expense';
  startDate?: string;
  endDate?: string;
  selectedMonth?: Date;
}

interface AppModalsProps {
  // Transaction history
  showTransactionHistory: boolean;
  transactionHistoryFilter: TransactionHistoryFilter;
  categories: Category[];
  accounts: Account[];
  dataVersion: number;
  onCloseTransactionHistory: () => void;

  // Add transaction
  showAddTransaction: boolean;
  initialTransactionData: any | null;
  transactions: Transaction[];
  userId: string;
  onCloseAddTransaction: () => void;
  onAddTransaction: () => void;
  onOptimisticAdd: (t: Transaction) => void;

  // Edit transaction
  editingTransaction: Transaction | null;
  onCloseEditTransaction: () => void;
  onUpdateTransaction: () => void;

  // Set an editing transaction (used by TransactionHistory row clicks)
  onEditTransaction: (t: Transaction) => void;
  onOpenAddTransactionWithData: (data?: any) => void;

  // User page
  showUserPage: boolean;
  user: UserProfile;
  onCloseUserPage: () => void;
  onLogout: () => void;
  onUpdateUser: (user: UserProfile) => void;
  onRefresh: () => void;

  // AI logs
  showAILogs: boolean;
  onCloseAILogs: () => void;

  // Global input context menu
  globalContextMenu: { x: number, y: number, items: any[] } | null;
  onCloseGlobalContextMenu: () => void;
}

export function AppModals({
  showTransactionHistory,
  transactionHistoryFilter,
  categories,
  accounts,
  dataVersion,
  onCloseTransactionHistory,
  showAddTransaction,
  initialTransactionData,
  transactions,
  userId,
  onCloseAddTransaction,
  onAddTransaction,
  onOptimisticAdd,
  editingTransaction,
  onCloseEditTransaction,
  onUpdateTransaction,
  onEditTransaction,
  onOpenAddTransactionWithData,
  showUserPage,
  user,
  onCloseUserPage,
  onLogout,
  onUpdateUser,
  onRefresh,
  showAILogs,
  onCloseAILogs,
  globalContextMenu,
  onCloseGlobalContextMenu
}: AppModalsProps) {
  return (
    <>
      {showTransactionHistory && (
        <TransactionHistory
          categories={categories}
          accounts={accounts}
          refreshSignal={dataVersion}
          onClose={onCloseTransactionHistory}
          onEditTransaction={onEditTransaction}
          onOpenAddTransaction={onOpenAddTransactionWithData}
          initialAccountId={transactionHistoryFilter.accountId}
          initialCategoryId={transactionHistoryFilter.categoryId}
          initialType={transactionHistoryFilter.type}
          initialStartDate={transactionHistoryFilter.startDate}
          initialEndDate={transactionHistoryFilter.endDate}
          initialSelectedMonth={transactionHistoryFilter.selectedMonth}
        />
      )}

      {(showAddTransaction || initialTransactionData) && (
        <AddTransaction
          key={initialTransactionData ? `copy-${initialTransactionData.createdAt}-${initialTransactionData.amount}` : 'new'}
          onComplete={onCloseAddTransaction}
          onAdd={onAddTransaction}
          onOptimisticAdd={onOptimisticAdd}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          userId={userId}
          initialData={initialTransactionData}
        />
      )}

      {editingTransaction && (
        <EditTransaction
          transaction={editingTransaction}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          onClose={onCloseEditTransaction}
          onUpdate={onUpdateTransaction}
        />
      )}

      {showUserPage && (
        <UserPage
          user={user}
          onLogout={onLogout}
          onClose={onCloseUserPage}
          onUpdateUser={onUpdateUser}
          onRefresh={onRefresh}
        />
      )}

      {showAILogs && (
        <AILogs
          userId={user.id}
          onClose={onCloseAILogs}
        />
      )}

      {globalContextMenu && (
        <GenericContextMenu
          x={globalContextMenu.x}
          y={globalContextMenu.y}
          items={globalContextMenu.items}
          onClose={onCloseGlobalContextMenu}
        />
      )}
    </>
  );
}
