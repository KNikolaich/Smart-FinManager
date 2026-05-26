import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useNetworkStatus } from './hooks/useNetworkStatus';
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
import { api, syncOfflineQueue } from './lib/api';
import { processUserMessage } from './services/aiService';
import { Account, Transaction, Goal, Category, Plan, Currency, BalanceHistory, UserProfile } from './types';

// Import components directly to avoid lazy loading issues in preview
import UserPage from './components/UserPage';
import Dashboard from './components/Dashboard';
import PlanPage from './components/PlanPage';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import type { AIAssistantHandle } from './components/AIAssistant';
import AddTransaction from './components/AddTransaction';
import TransactionHistory from './components/TransactionHistory';
import EditTransaction from './components/EditTransaction';
import AILogs from './components/AILogs';
import Auth from './components/Auth';

import { cn } from './lib/utils';
import { RobotIcon } from './components/icons/RobotIcon';
import { ToastContainer, ToastType } from './components/ui/Toast';

import { GenericContextMenu } from './components/ui/GenericContextMenu';
import type { ContextMenuItem } from './components/ui/GenericContextMenu';

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
    type?: 'all' | 'income' | 'expense'
  }>({});
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [initialTransactionData, setInitialTransactionData] = useState<any | null>(null);
  const [addMode, setAddMode] = useState<'text' | 'voice'>(() => (localStorage.getItem('addMode') as 'text' | 'voice') || 'text');
  const [showAILogs, setShowAILogs] = useState(false);
  const [showUserPage, setShowUserPage] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const aiAssistantRef = useRef<AIAssistantHandle>(null);
  const socketRef = useRef<any>(null);
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

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  const refreshData = useCallback(async () => {
    if (!user || isRefreshingRef.current) return;
    
    // Clear any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    isRefreshingRef.current = true;
    try {
      const data = await api.get<{
        accounts: Account[];
        transactions: Transaction[];
        goals: Goal[];
        categories: Category[];
        currencies: Currency[];
        balanceHistory: BalanceHistory[];
      }>('/initial-data');
      
      setAccounts(data.accounts);
      setTransactions(data.transactions);
      setGoals(data.goals);
      setCategories(data.categories);
      setCurrencies(data.currencies);
      setBalanceHistory(data.balanceHistory);
      
      // Load plans from localStorage
      const savedPlans = localStorage.getItem('ai_temporary_plans');
      if (savedPlans) {
        setPlans(JSON.parse(savedPlans));
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error.message.includes('Rate exceeded') || error.status === 429) {
        addToast('Превышен лимит запросов. Пожалуйста, подождите немного.', 'error');
      } else {
        addToast('Ошибка при загрузке данных', 'error');
      }
    } finally {
      // Throttle the next possible refresh to at least 1 second later
      setTimeout(() => {
        isRefreshingRef.current = false;
      }, 1000);
    }
  }, [user]);

  const isOnline = useNetworkStatus(useCallback((status) => {
    if (status === 'offline') {
      addToast('Вы перешли в оффлайн режим', 'error');
    } else {
      addToast('Соединение восстановлено', 'success');
      syncOfflineQueue().then((synced) => {
        if (synced) {
          addToast('Синхронизация данных завершена успешно', 'success');
        }
        refreshData();
      });
    }
  }, [addToast, refreshData]));

  // Auto-sync on startup if online
  useEffect(() => {
    if (user && navigator.onLine) {
      syncOfflineQueue().then((synced) => {
        if (synced) {
          addToast('Синхронизация данных завершена успешно', 'success');
          refreshData();
        }
      });
    }
  }, [user, addToast, refreshData]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'theme-nordic';
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
          localStorage.setItem('last_logged_in_user', JSON.stringify(userData));
        } catch (error: any) {
          console.error('Auth check error:', error);
          const isNetworkError = !navigator.onLine || error.message === 'Failed to fetch' || error.status === 0 || error.message?.includes('NetworkError');
          if (isNetworkError) {
            const savedUser = localStorage.getItem('last_logged_in_user');
            if (savedUser) {
              try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                addToast('Оффлайн-режим: выполнен вход в последний рабочий аккаунт', 'info');
              } catch (e) {
                localStorage.removeItem('token');
                setUser(null);
              }
            } else {
              localStorage.removeItem('token');
              setUser(null);
            }
          } else {
            localStorage.removeItem('token');
            setUser(null);
          }
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [addToast]);

  useEffect(() => {
    if (user) {
      const socket = io(window.location.origin, {
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 20
      });
      
      socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('join', user.id);
      });

      socket.on('data:updated', (data: any) => {
        console.log('Real-time update received:', data);
        refreshData();
      });

      socketRef.current = socket;

      return () => {
        socket.disconnect();
      };
    }
  }, [user, refreshData]);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const [globalContextMenu, setGlobalContextMenu] = useState<{ x: number, y: number, items: any[] } | null>(null);

  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      const target = e.target as HTMLElement;
      const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if (isInput) {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        const hasSelection = input.selectionStart !== input.selectionEnd;
        
        const items = [
          { 
            label: 'Выделить всё', 
            icon: Wallet, // Generic icon or none
            onClick: () => {
              input.focus();
              input.select();
            }
          },
          { 
            label: 'Копировать', 
            divider: true,
            onClick: async () => {
              const text = input.value.substring(input.selectionStart || 0, input.selectionEnd || 0);
              if (text) await navigator.clipboard.writeText(text);
            }
          },
          { 
            label: 'Вырезать', 
            onClick: async () => {
              const start = input.selectionStart || 0;
              const end = input.selectionEnd || 0;
              const text = input.value.substring(start, end);
              if (text) {
                await navigator.clipboard.writeText(text);
                const newValue = input.value.substring(0, start) + input.value.substring(end);
                // We need to trigger the react change event if possible, but for now just raw update
                input.value = newValue;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
              }
            }
          },
          { 
            label: 'Вставить', 
            onClick: async () => {
              try {
                const text = await navigator.clipboard.readText();
                const start = input.selectionStart || 0;
                const end = input.selectionEnd || 0;
                const newValue = input.value.substring(0, start) + text + input.value.substring(end);
                input.value = newValue;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
                const newPos = start + text.length;
                input.setSelectionRange(newPos, newPos);
              } catch (err) {
                console.error('Failed to read clipboard:', err);
              }
            }
          },
          { 
            label: 'Удалить', 
            variant: 'danger',
            onClick: () => {
              const start = input.selectionStart || 0;
              const end = input.selectionEnd || 0;
              if (start !== end) {
                const newValue = input.value.substring(0, start) + input.value.substring(end);
                input.value = newValue;
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
                input.setSelectionRange(start, start);
              }
            }
          }
        ];
        
        setGlobalContextMenu({ x: e.clientX, y: e.clientY, items });
      } else {
        // Find if we are clicking on an account card or something that should have a menu
        // This will be handled by individual components mostly, 
        // but we need to ensure the global prevention doesn't break them.
      }
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

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
      {/* Header - Hidden in landscape to save space, or transformed */}
      <header className="relative px-6 h-16 md:h-20 flex items-center justify-between bg-theme-surface/80 backdrop-blur-md border-b border-theme-base shrink-0 z-50 sticky top-0 transition-all landscape:hidden">
        <div 
          className="flex items-center gap-4 cursor-pointer group"
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
            className="w-11 h-11 bg-theme-primary rounded-xl flex items-center justify-center text-theme-on-primary shadow-lg shadow-theme-primary-light transition-all"
          >
            <Wallet size={20} />
          </motion.div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h2 className="font-bold text-sm leading-none group-hover:text-theme-primary transition-colors text-theme-main">Finance</h2>
              <p className="text-[10px] text-theme-muted font-bold uppercase tracking-widest mt-0.5">Manager</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="text-[10px] text-theme-muted font-bold uppercase tracking-widest mr-2 select-none animate-pulse">
              Оффлайн
            </span>
          )}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUserPage(true)}
            className={cn(
              "w-10 h-10 md:w-11 md:h-11 rounded-xl overflow-hidden border border-theme-base shadow-sm flex items-center justify-center transition-all",
              showUserPage ? "bg-theme-primary text-theme-on-primary shadow-lg shadow-theme-primary-light" : "bg-theme-primary-light text-theme-primary-dark"
            )}
          >
            <UserIcon className="w-6 h-6" />
          </motion.button>
        </div>
      </header>

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

      {/* Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 pb-0 h-[54px] shrink-0 z-40 flex items-center justify-center md:relative md:bottom-0 md:left-auto md:translate-x-0 md:max-w-none md:bg-theme-surface md:border-t border-theme-base md:rounded-none landscape:relative landscape:bottom-0 landscape:left-auto landscape:translate-x-0 landscape:w-20 landscape:h-full landscape:px-0 landscape:bg-theme-surface landscape:border-r landscape:border-t-0">
        <div className="w-full bg-theme-surface/90 backdrop-blur-xl border border-theme-base shadow-elegant rounded-3xl flex items-center justify-around h-full px-2 md:bg-transparent md:backdrop-blur-none md:border-none md:shadow-none md:rounded-none landscape:flex-col landscape:py-4 landscape:bg-transparent landscape:backdrop-blur-none">
           <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'dashboard' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
            )}
          >
            <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          </button>
          <button 
            onClick={() => setActiveTab('plan')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'plan' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
            )}
          >
            <CalendarRange size={20} strokeWidth={activeTab === 'plan' ? 2.5 : 2} />
          </button>
          
          {/* AI Assistant Button */}
          <div className="relative w-14 h-14 flex items-center justify-center -top-4 md:top-0 md:relative landscape:top-0 landscape:relative">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveTab('ai')}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all z-50",
                activeTab === 'ai' 
                  ? "bg-theme-primary-light text-theme-primary shadow-theme-primary-light" 
                  : "bg-theme-surface border border-theme-base text-theme-primary shadow-soft"
              )}
            >
              <RobotIcon className="w-11 h-11" active={activeTab === 'ai'}  />
            </motion.button>
          </div>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'analytics' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
            )}
          >
            <BarChart2 size={20} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95", 
              activeTab === 'settings' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
            )}
          >
            <SettingsIcon size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
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
            onOpenAddTransaction={(data) => {
              setInitialTransactionData(data);
              setShowAddTransaction(true);
            }}
            initialAccountId={transactionHistoryFilter.accountId}
            initialCategoryId={transactionHistoryFilter.categoryId}
            initialType={transactionHistoryFilter.type}
          />
        )}

        {/* Add Transaction Modal */}
        {(showAddTransaction || initialTransactionData) && (
          <AddTransaction 
            key={initialTransactionData ? `copy-${initialTransactionData.createdAt}-${initialTransactionData.amount}` : 'new'}
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
        
        {globalContextMenu && (
          <GenericContextMenu 
            x={globalContextMenu.x}
            y={globalContextMenu.y}
            items={globalContextMenu.items}
            onClose={() => setGlobalContextMenu(null)}
          />
        )}
    </div>
  );
}
