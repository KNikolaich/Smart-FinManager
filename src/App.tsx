import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useAppData } from './hooks/useAppData';
import { useAuth } from './hooks/useAuth';
import { useGlobalInputContextMenu } from './hooks/useGlobalInputContextMenu';
import { api, syncOfflineQueue, safeStorage } from './lib/api';
import { Transaction } from './types';

// Import components directly to avoid lazy loading issues in preview
import Dashboard from './components/Dashboard';
import PlanPage from './components/PlanPage';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import type { AIAssistantHandle } from './components/AIAssistant';
import Auth from './components/Auth';

import { AppHeader } from './components/app/AppHeader';
import { BottomNav } from './components/app/BottomNav';
import { AppModals } from './components/app/AppModals';

import { cn } from './lib/utils';
import { ToastContainer, ToastType } from './components/ui/Toast';

type Tab = 'dashboard' | 'plan' | 'analytics' | 'settings' | 'ai';

export default function App() {
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const { user, setUser, loading, handleLogout } = useAuth(addToast);
  const {
    accounts,
    transactions,
    goals,
    categories,
    currencies,
    balanceHistory,
    dataVersion,
    plans,
    refreshData,
    optimisticAddTransaction
  } = useAppData({ user, addToast });

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [analyticsOptions, setAnalyticsOptions] = useState<{
    type?: 'expense' | 'income';
    filterType?: 'month' | 'period' | 'all';
    selectedMonth?: Date;
    periodRange?: { start: Date; end: Date };
  }>({});
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [transactionHistoryFilter, setTransactionHistoryFilter] = useState<{
    categoryId?: string,
    accountId?: string,
    type?: 'all' | 'income' | 'expense',
    startDate?: string,
    endDate?: string,
    selectedMonth?: Date
  }>({});
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [initialTransactionData, setInitialTransactionData] = useState<any | null>(null);
  const [showAILogs, setShowAILogs] = useState(false);
  const [showUserPage, setShowUserPage] = useState(false);
  const aiAssistantRef = useRef<AIAssistantHandle>(null);

  const [showTotalBalance, setShowTotalBalance] = useState(() => {
    const saved = safeStorage.getItem('showTotalBalance');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [initialGoalData, setInitialGoalData] = useState<{ name?: string; targetAmount?: number; deadline?: string } | undefined>(undefined);

  const { globalContextMenu, closeGlobalContextMenu } = useGlobalInputContextMenu();

  useEffect(() => {
    const savedTheme = safeStorage.getItem('theme') || 'theme-nordic';
    document.body.classList.add(savedTheme);
  }, []);

  useEffect(() => {
    safeStorage.setItem('showTotalBalance', JSON.stringify(showTotalBalance));
  }, [showTotalBalance]);

  const handleAIResult = async (result: any) => {
    if (result.intent === 'transaction') {
      const { type, amount, accountId, categoryId } = result.data;

      if (type && amount && accountId && categoryId) {
        try {
          const transactionData = {
            amount: Number(amount),
            description: result.data.description || '',
            accountId: accountId,
            targetAccountId: type === 'transfer' ? result.data.targetAccountId : null,
            categoryId: type !== 'transfer' ? categoryId : null,
            createdAt: new Date().toISOString(),
            type: type
          };

          const newTransaction: Transaction = {
            id: Math.random().toString(36).substring(2, 9),
            userId: user?.id || '',
            ...transactionData,
            categoryId: transactionData.categoryId || '',
          };

          optimisticAddTransaction(newTransaction);
          await api.post('/transactions', transactionData);
          addToast('Операция добавлена', 'success');
          refreshData();
        } catch (err) {
          console.error('Error saving transaction:', err);
          addToast('Ошибка при сохранении', 'error');
        }
      } else {
        setInitialTransactionData(result.data);
      }
    } else if (result.intent === 'goal') {
      setInitialGoalData(result.data);
      setActiveTab('dashboard');
    } else {
      setActiveTab('ai');
    }
  };

  const isOnline = useNetworkStatus(useCallback((status) => {
    if (status === 'offline') {
      addToast('Вы перешли в оффлайн режим', 'error');
    } else {
      addToast('Соединение восстановлено', 'success');
      syncOfflineQueue((message) => {
        addToast(`Не удалось сохранить операцию: ${message}`, 'error');
      }).then((synced) => {
        if (synced) {
          addToast('Синхронизация данных завершена успешно', 'success');
        }
        refreshData();
      });
    }
  }, [addToast, refreshData]));

  const handleWalletOrLogoClick = () => {
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
    } else {
      setShowTotalBalance(!showTotalBalance);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-main">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Auth onAuth={setUser} />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            accounts={accounts}
            transactions={transactions}
            goals={goals}
            categories={categories}
            currencies={currencies}
            balanceHistory={balanceHistory}
            userId={user.id}
            showTotalBalance={showTotalBalance}
            showGoals={showTotalBalance}
            initialGoalData={initialGoalData}
            onCloseGoalManager={() => setInitialGoalData(undefined)}
            onRefresh={refreshData}
            onNavigateToAnalytics={(options) => {
              if (options) setAnalyticsOptions(options);
              else setAnalyticsOptions({});
              setActiveTab('analytics');
            }}
            onOpenTransactionHistory={(filterProps) => {
              if (typeof filterProps === 'string') {
                setTransactionHistoryFilter({ accountId: filterProps });
              } else if (filterProps) {
                setTransactionHistoryFilter(filterProps);
              } else {
                setTransactionHistoryFilter({});
              }
              setShowTransactionHistory(true);
            }}
            onOpenAddTransaction={(data) => {
              setInitialTransactionData(data);
              setShowAddTransaction(true);
            }}
            onEditTransaction={setEditingTransaction}
          />
        );
      case 'plan':
        return <PlanPage accounts={accounts} categories={categories} user={user} onRefresh={refreshData} />;
      case 'analytics':
        return (
          <Analytics
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            currencies={currencies}
            balanceHistory={balanceHistory}
            initialType={analyticsOptions.type}
            initialFilterType={analyticsOptions.filterType}
            initialSelectedMonth={analyticsOptions.selectedMonth}
            initialPeriodRange={analyticsOptions.periodRange}
            onNavigateToHistory={(categoryName, dateFilter) => {
              const category = categories.find(c => c.name === categoryName);
              setTransactionHistoryFilter({
                categoryId: category?.id,
                startDate: dateFilter?.startDate,
                endDate: dateFilter?.endDate,
                selectedMonth: dateFilter?.selectedMonth
              });
              setShowTransactionHistory(true);
            }}
          />
        );
      case 'settings':
        return <Settings user={user} accounts={accounts} onLogout={handleLogout} onShowLogs={() => setShowAILogs(true)} onRefresh={refreshData} />;
      case 'ai':
        return (
          <AIAssistant
            ref={aiAssistantRef as any}
            accounts={accounts}
            categories={categories}
            transactions={transactions}
            goals={goals}
            plans={plans}
            userId={user.id}
            onRedirectToCreateGoal={(data) => {
              setInitialGoalData(data);
              setActiveTab('dashboard');
            }}
            onRefresh={refreshData}
            onResult={handleAIResult}
            onOpenAddTransaction={(data) => {
              setInitialTransactionData(data);
              setShowAddTransaction(true);
            }}
            showToast={addToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] bg-theme-main flex flex-col landscape:flex-row-reverse overflow-hidden">
      <AppHeader
        activeTab={activeTab}
        onLogoClick={handleWalletOrLogoClick}
        isOnline={isOnline}
        showUserPage={showUserPage}
        onOpenUserPage={() => setShowUserPage(true)}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className={cn(
          "absolute inset-0 overflow-y-auto no-scrollbar px-[2px] pt-0",
          activeTab === 'plan'
            ? "portrait:pb-12 landscape:pb-0"
            : "pb-24 md:pb-0 landscape:pb-0"
        )}>
          <div className="max-w-7xl mx-auto h-full landscape:max-w-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="h-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onWalletClick={handleWalletOrLogoClick}
        showUserPage={showUserPage}
        onOpenUserPage={() => setShowUserPage(true)}
        isOnline={isOnline}
      />

      <AppModals
        showTransactionHistory={showTransactionHistory}
        transactionHistoryFilter={transactionHistoryFilter}
        categories={categories}
        accounts={accounts}
        dataVersion={dataVersion}
        onCloseTransactionHistory={() => {
          setShowTransactionHistory(false);
          setTransactionHistoryFilter({});
        }}
        showAddTransaction={showAddTransaction}
        initialTransactionData={initialTransactionData}
        transactions={transactions}
        userId={user.id}
        onCloseAddTransaction={() => { setShowAddTransaction(false); setInitialTransactionData(null); }}
        onAddTransaction={refreshData}
        onOptimisticAdd={optimisticAddTransaction}
        editingTransaction={editingTransaction}
        onCloseEditTransaction={() => setEditingTransaction(null)}
        onUpdateTransaction={refreshData}
        onEditTransaction={(t) => setEditingTransaction(t)}
        onOpenAddTransactionWithData={(data) => {
          setInitialTransactionData(data);
          setShowAddTransaction(true);
        }}
        showUserPage={showUserPage}
        user={user}
        onCloseUserPage={() => setShowUserPage(false)}
        onLogout={handleLogout}
        onUpdateUser={(updatedUser) => setUser(updatedUser)}
        onRefresh={refreshData}
        showAILogs={showAILogs}
        onCloseAILogs={() => setShowAILogs(false)}
        globalContextMenu={globalContextMenu}
        onCloseGlobalContextMenu={closeGlobalContextMenu}
      />
    </div>
  );
}
