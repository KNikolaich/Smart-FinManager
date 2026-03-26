import { useState, useEffect } from 'react';
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
import { auth, db, signInWithGoogle, logout, handleFirestoreError } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { Account, Transaction, Goal, Budget, Category, Plan, OperationType } from './types';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import AIAssistant from './components/AIAssistant';
import AddTransaction from './components/AddTransaction';
import AILogs from './components/AILogs';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
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

  useEffect(() => {
    localStorage.setItem('showTotalBalance', JSON.stringify(showTotalBalance));
  }, [showTotalBalance]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user document exists
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: new Date().toISOString(),
            role: 'user',
            settings: {
              showTotalBalance: true
            }
          });
        }
      }
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const userId = user.uid;

    const unsubAccounts = onSnapshot(query(collection(db, 'accounts'), where('userId', '==', userId)), (snapshot) => {
      setAccounts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Account[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'accounts'));

    const unsubTransactions = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', userId)), (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const unsubGoals = onSnapshot(query(collection(db, 'goals'), where('userId', '==', userId)), (snapshot) => {
      setGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Goal[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'goals'));

    const unsubBudgets = onSnapshot(query(collection(db, 'budgets'), where('userId', '==', userId)), (snapshot) => {
      setBudgets(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Budget[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'budgets'));

    const unsubCategories = onSnapshot(query(collection(db, 'categories'), where('userId', '==', userId)), (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Category[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubPlans = onSnapshot(query(collection(db, 'plans'), where('userId', '==', userId)), (snapshot) => {
      setPlans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Plan[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'plans'));

    return () => {
      unsubAccounts();
      unsubTransactions();
      unsubGoals();
      unsubBudgets();
      unsubCategories();
      unsubPlans();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl shadow-emerald-100 border border-emerald-50 text-center space-y-8">
          <div className="w-20 h-20 bg-emerald-500 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Wallet size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">AI Finance Manager</h1>
            <p className="text-neutral-500">Управляйте своими финансами с помощью ИИ</p>
          </div>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all active:scale-95 shadow-lg shadow-neutral-200"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Войти через Google
          </button>
        </div>
      </div>
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
            budgets={budgets} 
            categories={categories}
            userId={user.uid}
            showTotalBalance={showTotalBalance}
            initialGoalData={initialGoalData}
            onCloseGoalManager={() => setInitialGoalData(undefined)}
          />
        );
      case 'transactions':
        return <Transactions transactions={transactions} categories={categories} accounts={accounts} />;
      case 'analytics':
        return <Analytics transactions={transactions} categories={categories} accounts={accounts} />;
      case 'settings':
        return <Settings user={user} onLogout={logout} onShowLogs={() => setShowAILogs(true)} />;
      case 'ai':
        return (
          <AIAssistant 
            accounts={accounts} 
            categories={categories} 
            transactions={transactions} 
            budgets={budgets} 
            goals={goals} 
            plans={plans}
            userId={user.uid}
            onRedirectToCreateGoal={(data) => {
              setInitialGoalData(data);
              setActiveTab('dashboard');
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col relative">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-neutral-100">
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
          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm">
            <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-32 overflow-x-hidden">
        {renderContent()}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-neutral-100 px-6 py-4 pb-safe z-40 flex items-center justify-between shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
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
          <div className="relative -top-8">
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
          <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-bold">Новая операция</h3>
              <button 
                onClick={() => setShowAddTransaction(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X size={20} className="text-neutral-400" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto">
              <AddTransaction 
                accounts={accounts} 
                categories={categories} 
                onComplete={() => setShowAddTransaction(false)} 
              />
            </div>
          </div>
        </div>
      )}

      {/* AI Logs Modal */}
      {showAILogs && (
        <AILogs userId={user.uid} onClose={() => setShowAILogs(false)} />
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
