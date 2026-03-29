import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  BarChart2, 
  Settings as SettingsIcon, 
  Bot, 
  Plus,
  Mic,
  X,
  LogOut,
  User as UserIcon,
  Wallet
} from 'lucide-react';
import { api } from './lib/api';
import { Account, Transaction, Goal, Budget, Category, Plan } from './types';
import Dashboard from './components/Dashboard';
import PlanPage from './components/PlanPage';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import AddTransaction from './components/AddTransaction';
import AILogs from './components/AILogs';
import Auth from './components/Auth';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plan' | 'analytics' | 'settings' | 'ai'>('dashboard');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [addMode, setAddMode] = useState<'text' | 'voice'>(() => (localStorage.getItem('addMode') as 'text' | 'voice') || 'text');
  const [showAILogs, setShowAILogs] = useState(false);
  const aiAssistantRef = useRef<any>(null);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('addMode', addMode);
  }, [addMode]);

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      setAddMode(prev => prev === 'text' ? 'voice' : 'text');
    }, 2000);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleButtonClick = () => {
    if (addMode === 'text') {
      setShowAddTransaction(true);
    } else {
      if (aiAssistantRef.current) {
        aiAssistantRef.current.handleVoiceInput();
        setActiveTab('ai');
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
  const [plans, setPlans] = useState<Plan[]>(() => {
    const saved = localStorage.getItem('ai_temporary_plans');
    return saved ? JSON.parse(saved) : [];
  });

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      const [accs, trans, gls, bdgs, cats] = await Promise.all([
        api.get<Account[]>('/accounts'),
        api.get<Transaction[]>('/transactions'),
        api.get<Goal[]>('/goals'),
        api.get<Budget[]>('/budgets'),
        api.get<Category[]>('/categories'),
      ]);
      setAccounts(accs);
      setTransactions(trans);
      setGoals(gls);
      setBudgets(bdgs);
      setCategories(cats);
      
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
          const userData = await api.get('/auth/me');
          setUser(userData);
        } catch (error) {
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
            budgets={budgets} 
            categories={categories}
            userId={user.id}
            showTotalBalance={showTotalBalance}
            initialGoalData={initialGoalData}
            onCloseGoalManager={() => setInitialGoalData(undefined)}
            onRefresh={refreshData}
            onNavigateToAnalytics={() => setActiveTab('analytics')}
          />
        );
      case 'plan':
        return <PlanPage accounts={accounts} categories={categories} onRefresh={refreshData} />;
      case 'analytics':
        return <Analytics transactions={transactions} categories={categories} accounts={accounts} />;
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
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100 group-active:scale-95 transition-all">
            <Wallet size={20} />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight group-hover:text-emerald-600 transition-colors">Finance</h2>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('ai')}
            className={cn(
              "p-2 rounded-xl transition-all",
              activeTab === 'ai' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" : "bg-neutral-100 text-neutral-500"
            )}
          >
            <Bot size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm bg-emerald-100 flex items-center justify-center">
            <UserIcon className="text-emerald-600 w-6 h-6" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full w-full max-w-7xl mx-auto overflow-y-auto no-scrollbar landscape:max-w-none">
          {renderContent()}
        </div>
      </main>

      {/* Navigation Bar */}
      <nav className="bg-white border-t border-neutral-100 px-6 py-3 pb-safe shrink-0 z-40 flex items-center justify-center shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)] landscape:py-1 landscape:px-4">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-around relative">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn("flex flex-col items-center gap-1 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'dashboard' ? "text-emerald-600 landscape:bg-emerald-50" : "text-neutral-400")}
          >
            <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">Главная</span>
          </button>
          <button 
            onClick={() => setActiveTab('plan')}
            className={cn("flex flex-col items-center gap-1 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'plan' ? "text-emerald-600 landscape:bg-emerald-50" : "text-neutral-400")}
          >
            <CalendarRange size={22} strokeWidth={activeTab === 'plan' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">План</span>
          </button>
          
          {/* Add Button */}
          <div className="relative">
            <button 
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onClick={handleButtonClick}
              className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-200 active:scale-90 transition-all landscape:w-auto landscape:h-auto landscape:px-6 landscape:py-1 landscape:rounded-lg landscape:shadow-none"
            >
              {addMode === 'text' ? <Plus size={32} /> : <Mic size={32} />}
              <span className="hidden landscape:block text-[11px] font-bold uppercase tracking-tighter">
                {addMode === 'text' ? 'Пуск' : 'Голос'}
              </span>
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn("flex flex-col items-center gap-1 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'analytics' ? "text-emerald-600 landscape:bg-emerald-50" : "text-neutral-400")}
          >
            <BarChart2 size={22} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">Анализ</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn("flex flex-col items-center gap-1 transition-all landscape:flex-row landscape:px-3 landscape:py-1 landscape:rounded-lg", activeTab === 'settings' ? "text-emerald-600 landscape:bg-emerald-50" : "text-neutral-400")}
          >
            <SettingsIcon size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="hidden landscape:block text-[10px] font-bold uppercase tracking-tighter landscape:text-[11px]">Настройки</span>
          </button>
        </div>
      </nav>

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" 
            onClick={() => setShowAddTransaction(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
            <div className="px-6 py-3 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-neutral-800">Новая операция</h3>
              <button 
                onClick={() => setShowAddTransaction(false)}
                className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X size={18} className="text-neutral-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <AddTransaction 
                accounts={accounts} 
                categories={categories} 
                onComplete={() => {
                  setShowAddTransaction(false);
                  refreshData();
                }} 
              />
            </div>
          </div>
        </div>
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
