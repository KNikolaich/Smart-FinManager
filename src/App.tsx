import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  BarChart2, 
  Settings as SettingsIcon, 
  Bot, 
  Plus,
  Mic,
  AudioLines,
  X,
  LogOut,
  User as UserIcon,
  Wallet
} from 'lucide-react';
import { api } from './lib/api';
import { Account, Transaction, Goal, Budget, Category, Plan, Currency, BalanceHistory } from './types';
import Dashboard from './components/Dashboard';
import PlanPage from './components/PlanPage';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import AddTransaction from './components/AddTransaction';
import TransactionHistory from './components/TransactionHistory';
import EditTransaction from './components/EditTransaction';
import AILogs from './components/AILogs';
import Auth from './components/Auth';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plan' | 'analytics' | 'settings' | 'ai'>('dashboard');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [transactionHistoryFilter, setTransactionHistoryFilter] = useState<{ categoryId?: string, accountId?: string }>({});
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [addMode, setAddMode] = useState<'text' | 'voice'>(() => (localStorage.getItem('addMode') as 'text' | 'voice') || 'text');
  const [isRecording, setIsRecording] = useState(false);
  const [showAILogs, setShowAILogs] = useState(false);
  const aiAssistantRef = useRef<any>(null);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('addMode', addMode);
  }, [addMode]);

  const handleMouseDown = () => {
    console.log('handleMouseDown called');
    longPressTimer.current = setTimeout(() => {
      console.log('Long press triggered');
      setAddMode(prev => prev === 'text' ? 'voice' : 'text');
    }, 1000);
  };

  const handleMouseUp = () => {
    console.log('handleMouseUp called');
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleButtonClick = () => {
    console.log('handleButtonClick called, addMode:', addMode);
    if (addMode === 'text') {
      setShowAddTransaction(true);
    } else {
      if (aiAssistantRef.current) {
        setActiveTab('ai');
        aiAssistantRef.current.handleVoiceInput(
          () => setIsRecording(true),
          () => setIsRecording(false)
        );
      }
    }
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
  const [budgets, setBudgets] = useState<Budget[]>([]);
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
      const [accs, trans, gls, bdgs, cats, currs, bhist] = await Promise.all([
        api.get<Account[]>('/accounts'),
        api.get<Transaction[]>('/transactions'),
        api.get<Goal[]>('/goals'),
        api.get<Budget[]>('/budgets'),
        api.get<Category[]>('/categories'),
        api.get<Currency[]>('/currencies'),
        api.get<BalanceHistory[]>('/balance-history'),
      ]);
      setAccounts(accs);
      setTransactions(trans);
      setGoals(gls);
      setBudgets(bdgs);
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
      console.log('Checking auth, token exists:', !!token);
      if (token) {
        try {
          const userData = await api.get('/auth/me');
          console.log('Auth check success, user:', userData);
          setUser(userData);
        } catch (error) {
          console.error('Auth check error:', error);
          localStorage.removeItem('token');
          setUser(null);
        }
      } else {
        console.log('No token, user is null');
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    console.log('User state changed:', user);
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
            budgets={budgets} 
            categories={categories}
            currencies={currencies}
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
            balanceHistory={balanceHistory}
            onNavigateToHistory={(categoryName) => {
              const category = categories.find(c => c.name === categoryName);
              setTransactionHistoryFilter({ categoryId: category?.id });
              setShowTransactionHistory(true);
            }}
          />
        );
      case 'settings':
        return <Settings user={user} onLogout={handleLogout} onShowLogs={() => setShowAILogs(true)} onRefresh={refreshData} />;
      case 'ai':
        return (
          <AIAssistant 
            ref={aiAssistantRef}
            accounts={accounts} 
            categories={categories} 
            transactions={transactions} 
            budgets={budgets} 
            goals={goals} 
            plans={plans}
            userId={user.id}
            onRedirectToCreateGoal={(data) => {
              setInitialGoalData(data);
              setActiveTab('dashboard');
            }}
            onRefresh={refreshData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-neutral-100 shrink-0 z-40 [@media(max-width:767px)_and_(orientation:landscape)]:hidden">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setShowTotalBalance(!showTotalBalance)}
        >
          <div className="w-10 h-10 bg-theme-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-theme-primary-light group-active:scale-95 transition-all">
            <Wallet size={20} />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight group-hover:text-theme-primary-dark transition-colors">Finance</h2>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('ai')}
            className={cn(
              "p-2 rounded-xl transition-all",
              activeTab === 'ai' ? "bg-theme-primary text-white shadow-lg shadow-theme-primary-light" : "bg-neutral-100 text-neutral-500"
            )}
          >
            <Bot size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm flex items-center justify-center transition-all active:scale-95",
              activeTab === 'settings' ? "bg-theme-primary text-white shadow-lg shadow-theme-primary-light" : "bg-theme-primary-light text-theme-primary-dark"
            )}
          >
            <UserIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full w-full max-w-7xl mx-auto overflow-y-auto no-scrollbar landscape:max-w-none">
          {renderContent()}
        </div>
      </main>

      {/* Navigation Bar */}
      <nav className="bg-white border-t border-neutral-100 px-6 pb-safe shrink-0 z-40 flex items-center justify-center shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)] rounded-t-[20px] landscape:px-4 landscape:rounded-none">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-around relative h-11">
           <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn("flex flex-col items-center justify-center h-full gap-0.5 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'dashboard' ? "text-theme-primary-dark landscape:bg-theme-primary-light" : "text-neutral-400")}
          >
            <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">Главная</span>
          </button>
          <button 
            onClick={() => setActiveTab('plan')}
            className={cn("flex flex-col items-center justify-center h-full gap-0.5 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'plan' ? "text-theme-primary-dark landscape:bg-theme-primary-light" : "text-neutral-400")}
          >
            <CalendarRange size={20} strokeWidth={activeTab === 'plan' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">План</span>
          </button>
          
          {/* Add Button */}
          <div className="relative w-[70px] h-full">
            <button 
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onClick={handleButtonClick}
              className={cn(
                "absolute bottom-[5%] left-1/2 -translate-x-1/2 h-[137.5%] aspect-square text-white rounded-full flex items-center justify-center shadow-xl transition-all border-4 border-white z-50",
                isRecording ? "bg-red-500 shadow-red-200 animate-pulse" : "bg-theme-primary shadow-theme-primary-light"
              )}
            >
              {addMode === 'text' ? (
                <Plus size={30} />
              ) : isRecording ? (
                <AudioLines size={30} className="animate-pulse" />
              ) : (
                <Mic size={30} />
              )}
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn("flex flex-col items-center justify-center h-full gap-0.5 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'analytics' ? "text-theme-primary-dark landscape:bg-theme-primary-light" : "text-neutral-400")}
          >
            <BarChart2 size={20} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">Анализ</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn("flex flex-col items-center justify-center h-full gap-0.5 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'settings' ? "text-theme-primary-dark landscape:bg-theme-primary-light" : "text-neutral-400")}
          >
            <SettingsIcon size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">Настройки</span>
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
      {showAddTransaction && (
        <AddTransaction 
          onComplete={() => setShowAddTransaction(false)}
          onAdd={refreshData}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          userId={user.id}
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

      {/* AI Logs Modal */}
      {showAILogs && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-[32px] shadow-2xl">
            <AILogs userId={user.id} onClose={() => setShowAILogs(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
