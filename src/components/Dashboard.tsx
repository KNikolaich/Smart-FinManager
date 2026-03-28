import { useMemo, useState, useEffect } from 'react';
import { Account, Transaction, Goal, Budget, Category, AccountType } from '../types';
import { Wallet, TrendingUp, TrendingDown, Target, ChevronRight, CreditCard, Landmark } from 'lucide-react';
import { CoinStack } from './CustomIcons';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import AccountManager from './AccountManager';
import GoalManager from './GoalManager';
import TransactionHistory from './TransactionHistory';
import EditTransaction from './EditTransaction';
import { cn } from '../lib/utils';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  categories: Category[];
  userId: string;
  showTotalBalance: boolean;
  initialGoalData?: {
    name?: string;
    targetAmount?: number;
    deadline?: string;
  };
  onCloseGoalManager?: () => void;
  onRefresh?: () => void;
  onNavigateToAnalytics?: () => void;
}

export default function Dashboard({ 
  accounts, 
  transactions, 
  goals, 
  budgets, 
  categories, 
  userId, 
  showTotalBalance, 
  initialGoalData, 
  onCloseGoalManager, 
  onRefresh,
  onNavigateToAnalytics
}: DashboardProps) {
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [showGoalManager, setShowGoalManager] = useState(!!initialGoalData);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Sync showGoalManager with initialGoalData
  useEffect(() => {
    if (initialGoalData) {
      setShowGoalManager(true);
    }
  }, [initialGoalData]);

  const handleCloseGoalManager = () => {
    setShowGoalManager(false);
    if (onCloseGoalManager) onCloseGoalManager();
  };

  const totalBalance = useMemo(() => accounts.filter(a => a.showInTotals && !a.isArchived).reduce((sum, acc) => sum + acc.balance, 0), [accounts]);
  
  const dashboardAccounts = useMemo(() => {
    const order: Record<AccountType, number> = { card: 0, credit: 1, cash: 2, bank: 3 };
    return accounts
      .filter(a => a.showOnDashboard && !a.isArchived)
      .sort((a, b) => order[a.type] - order[b.type]);
  }, [accounts]);
  
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const currentMonthTransactions = transactions.filter(t => new Date(t.createdAt) >= startOfMonth);
    
    const income = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const expense = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    return { income, expense };
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [transactions]);

  const activeGoals = useMemo(() => {
    return goals
      .filter(g => !g.isCompleted)
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [goals]);

  const threeMonthTrend = useMemo(() => {
    const end = new Date();
    const start = subMonths(end, 2); // Last 3 months including current
    
    const months = eachMonthOfInterval({ start, end });
    const data: { [key: string]: { name: string, income: number, expense: number, rawDate: Date } } = {};

    months.forEach(month => {
      const m = format(month, 'MMM', { locale: ru });
      const key = format(month, 'yyyy-MM');
      data[key] = { name: m, income: 0, expense: 0, rawDate: new Date(month) };
    });

    transactions.forEach(t => {
      const tDate = new Date(t.createdAt);
      const key = format(tDate, 'yyyy-MM');
      if (data[key]) {
        if (t.type === 'income') data[key].income += t.amount;
        else if (t.type === 'expense') data[key].expense += t.amount;
      }
    });

    return Object.values(data).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [transactions]);

  return (
    <div className="p-1.5 sm:p-2 space-y-6">
      {/* Total Balance Card */}
      <AnimatePresence>
        {showTotalBalance && (
          <motion.div 
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div 
              onClick={onNavigateToAnalytics}
              className="bg-emerald-500 rounded-3xl p-6 text-white shadow-xl shadow-emerald-100 cursor-pointer group relative overflow-hidden"
            >
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                {/* Left Side: Balance and Stats */}
                <div>
                  <p className="text-emerald-100 text-sm font-medium mb-1">Общий баланс</p>
                  <h2 className="text-4xl font-bold mb-6">{totalBalance.toLocaleString()} ₽</h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-xl">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-100">Доход</p>
                        <p className="font-semibold">+{monthlyStats.income.toLocaleString()} ₽</p>
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-xl">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-100">Расход</p>
                        <p className="font-semibold">-{monthlyStats.expense.toLocaleString()} ₽</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Dynamics Chart (Hidden on mobile) */}
                <div className="hidden sm:block h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={threeMonthTrend}>
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)', fontWeight: 600 }} 
                      />
                      <YAxis hide />
                      <Bar dataKey="income" fill="rgba(255,255,255,0.9)" radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="expense" fill="rgba(255,255,255,0.4)" radius={[4, 4, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accounts Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Счета</h3>
          <button 
            onClick={() => setShowAccountManager(true)}
            className="text-emerald-600 text-sm font-medium hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
          >
            Все
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1.5 px-1.5 no-scrollbar snap-x snap-mandatory">
          {dashboardAccounts.map(account => {
            const isNegative = account.balance < 0;
            const Icon = account.type === 'card' ? CreditCard : account.type === 'bank' ? Landmark : account.type === 'cash' ? CoinStack : Wallet;
            const hasColor = account.color && account.color !== '#000000';
            
            return (
              <div 
                key={account.id} 
                className={cn(
                  "min-w-[90px] flex-shrink-0 bg-white p-3 rounded-2xl border transition-all duration-300 snap-start",
                  isNegative 
                    ? "shadow-lg shadow-rose-100/60 border-rose-50" 
                    : "shadow-lg shadow-emerald-100/60 border-emerald-50"
                )}
              >
                <div 
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                    !hasColor && (isNegative ? "bg-rose-50" : "bg-emerald-50")
                  )}
                  style={hasColor ? { backgroundColor: `${account.color}20` } : {}}
                >
                  <Icon 
                    className={cn("w-4 h-4", !hasColor && (isNegative ? "text-rose-500" : "text-emerald-500"))} 
                    style={hasColor ? { color: account.color } : {}}
                  />
                </div>
                <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-tight mb-0.5 truncate">{account.name}</p>
                <p className={cn("font-bold text-sm truncate", isNegative ? "text-rose-600" : "text-neutral-900")}>
                  {account.balance.toLocaleString()} {account.currency}
                </p>
              </div>
            );
          })}
          {dashboardAccounts.length === 0 && (
            <p className="text-neutral-400 text-sm italic">Нет добавленных счетов</p>
          )}
        </div>
      </section>

      {showAccountManager && (
        <AccountManager 
          accounts={accounts} 
          userId={userId} 
          onClose={() => setShowAccountManager(false)} 
          onRefresh={onRefresh}
        />
      )}

      {/* Recent Transactions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Последние операции</h3>
          <button 
            onClick={() => setShowTransactionHistory(true)}
            className="text-emerald-600 text-sm font-medium hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
          >
            Все
          </button>
        </div>
        <div className="space-y-1">
          {recentTransactions.map(t => {
            const category = categories.find(c => c.id === t.categoryId);
            // Ищем родительскую категорию, если текущая - подкатегория
            const parentCategory = category?.parentId ? categories.find(c => c.id === category.parentId) : category;
            return (
              <div 
                key={t.id} 
                onClick={() => setEditingTransaction(t)}
                className="bg-white p-2 rounded-2xl border border-neutral-100 flex items-center justify-between hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: (t.type === 'transfer' ? '#3b82f6' : (parentCategory?.color || '#3b82f6')) + '20' }}>
                    {t.type === 'transfer' ? '🔄' : (category?.icon || parentCategory?.icon || '💰')}
                  </div>
                  <div>
                    <p className="font-semibold text-xs">{t.description || category?.name || 'Без описания'}</p>
                    <p className="text-[10px] text-neutral-400">{format(new Date(t.createdAt), 'd MMMM', { locale: ru })}</p>
                  </div>
                </div>
                <p className={cn(
                  "font-bold text-sm", 
                  t.type === 'income' ? "text-emerald-600" : 
                  t.type === 'transfer' ? "text-blue-600" : 
                  "text-neutral-900"
                )}>
                  {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}{t.amount.toLocaleString()} ₽
                </p>
              </div>
            );
          })}
          {recentTransactions.length === 0 && (
            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-neutral-200">
              <p className="text-neutral-400 text-sm">Операций пока нет</p>
            </div>
          )}
        </div>
      </section>

      {showTransactionHistory && (
        <TransactionHistory 
          transactions={transactions}
          categories={categories}
          accounts={accounts}
          onClose={() => setShowTransactionHistory(false)}
          onEditTransaction={(t) => {
            setEditingTransaction(t);
          }}
        />
      )}

      {editingTransaction && (
        <EditTransaction 
          transaction={editingTransaction}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onUpdate={onRefresh || (() => {})}
        />
      )}

      {/* Goals Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Цели</h3>
          <button onClick={() => setShowGoalManager(true)} className="text-emerald-600 text-sm font-medium hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors">Все</button>
        </div>
        <div className="space-y-3">
          {activeGoals.map(goal => {
            const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
            
            // Calculate color based on deadline proximity
            let progressColor = 'bg-emerald-500';
            if (goal.deadline) {
              const deadlineDate = new Date(goal.deadline);
              const now = new Date();
              const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              if (progress < 100) {
                if (diffDays <= 3) progressColor = 'bg-rose-600';
                else if (diffDays <= 7) progressColor = 'bg-rose-500';
                else if (diffDays <= 14) progressColor = 'bg-orange-500';
                else if (diffDays <= 30) progressColor = 'bg-amber-500';
              }
            }

            return (
              <div key={goal.id} className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-neutral-900">{goal.name}</span>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      {goal.deadline ? format(new Date(goal.deadline), 'd MMM yyyy', { locale: ru }) : 'Без срока'}
                    </span>
                  </div>
                  
                  <div className="flex items-end justify-between mb-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tight">Накоплено</p>
                      <p className="font-bold text-sm text-emerald-600">{goal.currentAmount.toLocaleString()} ₽</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tight">Цель</p>
                      <p className="font-bold text-sm text-neutral-900">{goal.targetAmount.toLocaleString()} ₽</p>
                    </div>
                  </div>

                  {goal.description && (
                    <div className="prose prose-sm max-w-none text-neutral-500 text-[11px] leading-tight mb-1">
                      <ReactMarkdown>{goal.description}</ReactMarkdown>
                    </div>
                  )}
                </div>
                
                {/* Thin progress bar at the bottom */}
                <div className="h-1 w-full bg-neutral-100">
                  <div 
                    className={cn("h-full transition-all duration-500", progressColor)}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
          {activeGoals.length === 0 && (
            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-neutral-200">
              <p className="text-neutral-400 text-sm italic">Нет активных целей</p>
            </div>
          )}
        </div>
      </section>

      {showGoalManager && (
        <GoalManager 
          goals={goals} 
          userId={userId} 
          onClose={handleCloseGoalManager} 
          initialData={initialGoalData}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
