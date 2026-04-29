import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVoiceInput } from './hooks/useVoiceInput';
import { 
  LayoutDashboard, 
  CalendarRange, 
  BarChart2, 
  Settings as SettingsIcon, 
  Plus,
  Mic,
  AudioLines,
  User as UserIcon,
  Wallet,
  Loader2
} from 'lucide-react';
import { api } from './lib/api';
import { processUserMessage } from './services/aiService';
import { Account, Transaction, Goal, Category, Plan, Currency, BalanceHistory, UserProfile } from './types';
import UserPage from './components/UserPage';
import Dashboard from './components/Dashboard';
import PlanPage from './components/PlanPage';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import AIAssistant, { AIAssistantHandle } from './components/AIAssistant';
import AddTransaction from './components/AddTransaction';
import TransactionHistory from './components/TransactionHistory';
import EditTransaction from './components/EditTransaction';
import AILogs from './components/AILogs';
import Auth from './components/Auth';
import { cn } from './lib/utils';
import { RobotIcon } from './components/icons/RobotIcon';
import { ToastContainer, ToastType } from './components/ui/Toast';

export default function App() {
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);
  
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plan' | 'analytics' | 'settings' | 'ai'>('dashboard');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [transactionHistoryFilter, setTransactionHistoryFilter] = useState<{ categoryId?: string, accountId?: string }>({});
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [initialTransactionData, setInitialTransactionData] = useState<any | null>(null);
  const [addMode, setAddMode] = useState<'text' | 'voice'>(() => (localStorage.getItem('addMode') as 'text' | 'voice') || 'text');
  const [showAILogs, setShowAILogs] = useState(false);
  const [showUserPage, setShowUserPage] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const aiAssistantRef = useRef<AIAssistantHandle>(null);
  const { isRecording, startListening, stopListening } = useVoiceInput();
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('addMode', addMode);
  }, [addMode]);

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      setAddMode(prev => prev === 'text' ? 'voice' : 'text');
    }, 1000);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleButtonClick = async () => {
    if (isProcessingAI) return;

    if (addMode === 'text') {
      setShowAddTransaction(true);
    } else {
      if (isRecording) {
        stopListening();
      } else {
        startListening(
          async (text) => {
            // Final result
            if (isProcessingAI || !user) return;
            setIsProcessingAI(true);
            try {
              const result = await processUserMessage(user.id, text, accounts, categories);
              await handleAIResult(result);
            } catch (error) {
              console.error('AI Error:', error);
            } finally {
              setIsProcessingAI(false);
            }
          },
          (error) => {
            console.error('Voice error:', error);
            setIsProcessingAI(false);
          }
        );
      }
    }
  };

  const handleAIResult = async (result: any) => {
    if (result.intent === 'transaction') {
      const { type, amount, accountId, accountName, categoryId } = result.data;
      
      if (type && amount && accountId && categoryId) {
        // Все параметры есть, сохраняем автоматически
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
        // Не хватает параметров, открываем редактор
        setInitialTransactionData(result.data);
      }
    } else if (result.intent === 'goal') {
      setInitialGoalData(result.data);
      setActiveTab('dashboard');
    } else {
      setActiveTab('ai');
    }
  };

  const optimisticAddTransaction = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };
  const [showTotalBalance, setShowTotalBalance] = useState(() => {
    const saved = localStorage.getItem('showTotalBalance');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [initialGoalData, setInitialGoalData] = useState<{ name?: string; targetAmount?: number; deadline?: string } | undefined>(undefined);

  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistory[]>([]);
  const [plans, setPlans] = useState<Plan[]>(() => {
    const saved = localStorage.getItem('ai_temporary_plans');
    return saved ? JSON.parse(saved) : [];
  });

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      const [accs, trans, gls, cats, currs, bhist] = await Promise.all([
        api.get<Account[]>('/accounts'),
        api.get<Transaction[]>('/transactions'),
        api.get<Goal[]>('/goals'),
        api.get<Category[]>('/categories'),
        api.get<Currency[]>('/currencies'),
        api.get<BalanceHistory[]>('/balance-history'),
      ]);
      setAccounts(accs);
      setTransactions(trans);
      setGoals(gls);
      setCategories(cats);
      setCurrencies(currs);
      setBalanceHistory(bhist);
      
      // Load plans from localStorage
      const savedPlans = localStorage.getItem('ai_temporary_plans');
      if (savedPlans) {
        setPlans(JSON.parse(savedPlans));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [user]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'theme-light-green';
    document.body.classList.add(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem('showTotalBalance', JSON.stringify(showTotalBalance));
  }, [showTotalBalance]);

  useEffect(() => {
    localStorage.setItem('ai_temporary_plans', JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await api.get<UserProfile>('/auth/me');
          setUser(userData);
        } catch (error) {
          console.error('Auth check error:', error);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return <Auth onAuth={setUser} />;
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
            onNavigateToAnalytics={() => setActiveTab('analytics')}
            onOpenTransactionHistory={(accountId) => {
              setTransactionHistoryFilter({ accountId });
              setShowTransactionHistory(true);
            }}
            onEditTransaction={setEditingTransaction}
          />
        );
      case 'plan':
        return <PlanPage accounts={accounts} categories={categories} onRefresh={refreshData} />;
      case 'analytics':
        return (
          <Analytics 
            transactions={transactions} 
            categories={categories} 
            accounts={accounts} 
            currencies={currencies}
            balanceHistory={balanceHistory}
            onNavigateToHistory={(categoryName) => {
              const category = categories.find(c => c.name === categoryName);
              setTransactionHistoryFilter({ categoryId: category?.id });
              setShowTransactionHistory(true);
            }}
          />
        );
      case 'settings':
        return <Settings user={user} accounts={accounts} onLogout={handleLogout} onShowLogs={() => setShowAILogs(true)} onRefresh={refreshData} />;
      case 'ai':
        return (
          <AIAssistant 
            ref={aiAssistantRef}
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
            showToast={addToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[100dvh] bg-neutral-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 h-16 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-white/40 shrink-0 z-40 sticky top-0">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => {
            if (activeTab !== 'dashboard') {
              setActiveTab('dashboard');
            } else {
              setShowTotalBalance(!showTotalBalance);
            }
          }}
        >
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 mb-[7px] bg-theme-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-theme-primary-light group-active:scale-95 transition-all"
          >
            <Wallet size={20} />
          </motion.div>
          <div className="flex items-center gap-2">
            <div>
              <h2 className="font-bold text-sm leading-tight group-hover:text-theme-primary-dark transition-colors ml-5">Finance</h2>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest ml-[15px]">Manager</p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('ai');
              }}
              className={cn(
                "ml-[36px] mb-0 flex items-center justify-center rounded-xl transition-all active:scale-90 w-10 h-10 shadow-md pb-0",
                activeTab === 'ai' 
                  ? "text-theme-primary bg-theme-primary-light border-theme-primary/30 shadow-theme-primary-light/50" 
                  : "text-neutral-400 hover:text-neutral-500 bg-white border-neutral-100"
              )}
              title="AI Assistant"
            >
              <RobotIcon className="w-8 h-8" />
            </motion.button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUserPage(true)}
            className={cn(
              "w-10 h-10 rounded-xl overflow-hidden border border-white/50 shadow-sm flex items-center justify-center transition-all",
              showUserPage ? "bg-theme-primary text-white shadow-lg shadow-theme-primary-light" : "bg-theme-primary-light text-theme-primary-dark"
            )}
          >
            <UserIcon className="w-6 h-6" />
          </motion.button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto no-scrollbar pb-24 md:pb-0 px-[2px] pt-0">
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

      {/* Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 pb-0 h-16 shrink-0 z-40 flex items-center justify-center md:relative md:bottom-0 md:translate-x-0 md:max-w-none md:bg-white md:border-t md:border-neutral-100 md:rounded-none">
        <div className="w-full bg-white/90 backdrop-blur-xl border border-white/40 shadow-elegant rounded-3xl flex items-center justify-around h-full px-2">
           <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'dashboard' ? "text-theme-primary bg-theme-primary-light/50" : "text-neutral-400 hover:text-neutral-500"
            )}
          >
            <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          </button>
          <button 
            onClick={() => setActiveTab('plan')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'plan' ? "text-theme-primary bg-theme-primary-light/50" : "text-neutral-400 hover:text-neutral-500"
            )}
          >
            <CalendarRange size={22} strokeWidth={activeTab === 'plan' ? 2.5 : 2} />
          </button>
          
          {/* Add Button */}
          <div className="relative w-12 h-12">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onClick={handleButtonClick}
              disabled={isProcessingAI}
              className={cn(
                "w-12 h-12 text-white rounded-[18px] flex items-center justify-center shadow-lg transition-all z-50",
                isRecording ? "bg-red-500 shadow-red-200 animate-pulse" : 
                isProcessingAI ? "bg-amber-500 opacity-80" : "bg-theme-primary shadow-theme-primary-light"
              )}
            >
              {isProcessingAI ? (
                <Loader2 size={24} className="animate-spin" />
              ) : addMode === 'text' ? (
                <Plus size={24} />
              ) : isRecording ? (
                <AudioLines size={24} className="animate-pulse" />
              ) : (
                <Mic size={24} />
              )}
            </motion.button>
          </div>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'analytics' ? "text-theme-primary bg-theme-primary-light/50" : "text-neutral-400 hover:text-neutral-500"
            )}
          >
            <BarChart2 size={22} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'settings' ? "text-theme-primary bg-theme-primary-light/50" : "text-neutral-400 hover:text-neutral-500"
            )}
          >
            <SettingsIcon size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          </button>
        </div>
      </nav>

      {/* Transaction History Modal */}
      {showTransactionHistory && (
        <TransactionHistory 
          transactions={transactions}
          categories={categories}
          accounts={accounts}
          onClose={() => {
            setShowTransactionHistory(false);
            setTransactionHistoryFilter({});
          }}
          onEditTransaction={(t) => {
            setEditingTransaction(t);
          }}
          initialAccountId={transactionHistoryFilter.accountId}
          initialCategoryId={transactionHistoryFilter.categoryId}
        />
      )}

      {/* Add Transaction Modal */}
      {(showAddTransaction || initialTransactionData) && (
        <AddTransaction 
          onComplete={() => { setShowAddTransaction(false); setInitialTransactionData(null); }}
          onAdd={refreshData}
          onOptimisticAdd={optimisticAddTransaction}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          userId={user.id}
          initialData={initialTransactionData}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransaction 
          transaction={editingTransaction}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onUpdate={refreshData}
        />
      )}

      {showUserPage && (
        <UserPage 
          user={user} 
          onLogout={handleLogout} 
          onClose={() => setShowUserPage(false)} 
          onUpdateUser={(updatedUser) => setUser(updatedUser)}
          onRefresh={refreshData}
        />
      )}
      {showAILogs && (
        <AILogs 
          userId={user.id}
          onClose={() => setShowAILogs(false)}
        />
      )}
    </div>
  );
}
