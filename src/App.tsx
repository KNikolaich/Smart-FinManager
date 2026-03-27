import { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  BarChart2, 
  Settings as SettingsIcon, 
  Bot, 
  Plus,
  X,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { api } from './lib/api';
import { Account, Transaction, Goal, Budget, Category, Plan } from './types';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import AddTransaction from './components/AddTransaction';
import AILogs from './components/AILogs';
import Auth from './components/Auth';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'analytics' | 'settings' | 'ai'>('dashboard');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAILogs, setShowAILogs] = useState(false);
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
  const [plans, setPlans] = useState<Plan[]>([]);

  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      const [accs, trans, gls, bdgs, cats, plns] = await Promise.all([
        api.get<Account[]>('/accounts'),
        api.get<Transaction[]>('/transactions'),
        api.get<Goal[]>('/goals'),
        api.get<Budget[]>('/budgets'),
        api.get<Category[]>('/categories'),
        api.get<Plan[]>('/plans').catch(() => []),
      ]);
      setAccounts(accs);
      setTransactions(trans);
      setGoals(gls);
      setBudgets(bdgs);
      setCategories(cats);
      setPlans(plns);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('showTotalBalance', JSON.stringify(showTotalBalance));
  }, [showTotalBalance]);

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
          />
        );
      case 'transactions':
        return <Transactions transactions={transactions} categories={categories} accounts={accounts} onRefresh={refreshData} />;
      case 'analytics':
        return <Analytics transactions={transactions} categories={categories} accounts={accounts} />;
      case 'settings':
        return <Settings user={user} onLogout={handleLogout} onShowLogs={() => setShowAILogs(true)} onRefresh={refreshData} />;
      case 'ai':
        return (
          <AIAssistant 
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
      <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-neutral-100 shrink-0 z-40">
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
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {renderContent()}
      </main>

      {/* Navigation Bar */}
      <nav className="bg-white border-t border-neutral-100 px-6 py-3 pb-safe shrink-0 z-40 flex items-center justify-between shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between relative">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'dashboard' ? "text-emerald-600" : "text-neutral-400")}
          >
            <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Главная</span>
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'transactions' ? "text-emerald-600" : "text-neutral-400")}
          >
            <ArrowRightLeft size={22} strokeWidth={activeTab === 'transactions' ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Операции</span>
          </button>
          
          {/* Add Button */}
          <div className="relative -top-6">
            <button 
              onClick={() => setShowAddTransaction(true)}
              className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200 active:scale-90 transition-all"
            >
              <Plus size={32} />
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'analytics' ? "text-emerald-600" : "text-neutral-400")}
          >
            <BarChart2 size={22} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Анализ</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn("flex flex-col items-center gap-1 transition-all", activeTab === 'settings' ? "text-emerald-600" : "text-neutral-400")}
          >
            <SettingsIcon size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Настройки</span>
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

function Wallet({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
