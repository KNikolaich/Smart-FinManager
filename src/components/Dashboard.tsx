import { useMemo, useState, useEffect } from 'react';
import { Account, Transaction, Goal, Category, AccountType, Currency, BalanceHistory } from '../types';
import { Wallet, TrendingUp, TrendingDown, Target, ChevronRight, CreditCard, Landmark, GripVertical, Check, Save, Trash2, Calendar, Edit2, Plus } from 'lucide-react';
import { CoinStack } from './CustomIcons';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import AccountManager from './AccountManager';
import GoalManager from './GoalManager';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableGoalCardProps {
  goal: Goal;
  isEditing: boolean;
  onStartEdit: (goal: Goal) => void;
  onCancelEdit: () => void;
  onSave: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (goal: Goal) => void;
}

function SortableGoalCard({ 
  goal, 
  isEditing, 
  onStartEdit, 
  onCancelEdit, 
  onSave, 
  onDelete,
  onToggleComplete 
}: SortableGoalCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: goal.id });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 0,
    opacity: isDragging ? 0.5 : 1
  };

  const [editName, setEditName] = useState(goal.name);
  const [editTarget, setEditTarget] = useState(goal.targetAmount.toString());
  const [editCurrent, setEditCurrent] = useState(goal.currentAmount.toString());
  const [editDeadline, setEditDeadline] = useState(goal.deadline ? goal.deadline.split('T')[0] : '');
  const [editDescription, setEditDescription] = useState(goal.description || '');

  const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);

  const handleLongPress = () => {
    if (!isEditing) onStartEdit(goal);
  };

  const handleSaveWithCheck = () => {
    onSave(goal.id, {
      name: editName,
      targetAmount: parseFloat(editTarget),
      currentAmount: parseFloat(editCurrent),
      deadline: editDeadline || null,
      description: editDescription
    });
  };

  if (isEditing) {
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="bg-white rounded-2xl border-2 border-theme-primary p-4 shadow-xl space-y-4"
      >
        <div className="flex justify-between items-center gap-2">
          <input 
            type="text" 
            value={editName} 
            onChange={(e) => setEditName(e.target.value)} 
            className="flex-1 bg-neutral-50 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 ring-emerald-500/20" 
            placeholder="Название"
          />
          <input 
            type="date" 
            value={editDeadline} 
            onChange={(e) => setEditDeadline(e.target.value)} 
            className="w-32 bg-neutral-50 rounded-lg px-2 py-1 text-[10px] outline-none focus:ring-2 ring-emerald-500/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest text-[8px]">Накоплено</label>
            <input 
              type="number" 
              value={editCurrent} 
              onChange={(e) => setEditCurrent(e.target.value)} 
              className="w-full bg-neutral-50 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 outline-none focus:ring-2 ring-emerald-500/20"
            />
          </div>
          <div className="space-y-1 text-right">
            <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest text-[8px]">Цель</label>
            <input 
              type="number" 
              value={editTarget} 
              onChange={(e) => setEditTarget(e.target.value)} 
              className="w-full bg-neutral-50 rounded-lg px-2 py-1 text-xs font-bold text-right outline-none focus:ring-2 ring-emerald-500/20"
            />
          </div>
        </div>

        <textarea 
          value={editDescription} 
          onChange={(e) => setEditDescription(e.target.value)} 
          className="w-full bg-neutral-50 rounded-lg px-4 py-2 text-xs outline-none focus:ring-2 ring-emerald-500/20 min-h-[60px] resize-none" 
          placeholder="Описание (Markdown)"
        />

        <div className="flex justify-between items-center pt-2">
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteModal(true);
            }} 
            className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer relative z-30"
            title="Удалить цель"
          >
            <Trash2 size={16} />
          </button>
          <div className="flex gap-2">
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onCancelEdit();
              }} 
              className="px-3 py-1.5 bg-neutral-100 text-neutral-500 rounded-lg text-xs font-bold hover:bg-neutral-200 transition-colors"
            >
              Отмена
            </button>
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowCompleteModal(true);
              }}
              className={cn(
                "p-2 rounded-lg border transition-all flex items-center justify-center font-bold",
                goal.isCompleted 
                  ? "bg-emerald-500 border-emerald-500 text-white" 
                  : "bg-neutral-100 border-neutral-200 text-neutral-400 hover:border-emerald-500 hover:text-emerald-500"
              )}
              title={goal.isCompleted ? "Снять отметку о выполнении" : "Отметить как выполненную"}
            >
              <Check size={14} />
            </button>
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleSaveWithCheck();
              }} 
              className="flex items-center gap-2 px-4 py-1.5 bg-theme-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-theme-primary/20 hover:bg-theme-primary-dark transition-all"
            >
              <Save size={14} />
              Сохранить
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-rose-500 mb-4">
                <Trash2 size={24} />
                <h4 className="font-bold text-lg">Удалить цель?</h4>
              </div>
              <p className="text-neutral-500 text-sm mb-6">Это действие нельзя отменить.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-500 rounded-xl font-bold text-sm"
                >
                  Отмена
                </button>
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    onDelete(goal.id);
                  }}
                  className="flex-1 px-4 py-2 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-200"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Complete Confirmation Modal */}
        {showCompleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-emerald-500 mb-4">
                <Check size={24} />
                <h4 className="font-bold text-lg">{goal.isCompleted ? "Вернуть в работу?" : "Цель достигнута?"}</h4>
              </div>
              <p className="text-neutral-500 text-sm mb-6">
                {goal.isCompleted 
                  ? "Цель снова станет активной и появится в общем списке." 
                  : "Цель будет отмечена как выполненная."}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-500 rounded-xl font-bold text-sm"
                >
                  Отмена
                </button>
                <button 
                  onClick={() => {
                    setShowCompleteModal(false);
                    onToggleComplete(goal);
                  }}
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200"
                >
                  {goal.isCompleted ? "Вернуть" : "Выполнена!"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-md transition-all relative group",
        isDragging && "shadow-2xl scale-105 z-20",
        goal.isCompleted && "opacity-75 bg-neutral-50"
      )}
      onPointerDown={(e) => {
        const timer = setTimeout(handleLongPress, 500);
        const cleanup = () => clearTimeout(timer);
        e.currentTarget.addEventListener('pointerup', cleanup, { once: true });
        e.currentTarget.addEventListener('pointermove', cleanup, { once: true });
        e.currentTarget.addEventListener('pointercancel', cleanup, { once: true });
      }}
    >
      <div 
        className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </div>

      <div className="p-4 pl-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("font-bold text-sm truncate block", goal.isCompleted ? "text-neutral-400 line-through" : "text-neutral-900")}>
                {goal.name}
              </span>
              {goal.isCompleted && (
                <Check size={12} className="text-emerald-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {goal.deadline ? format(new Date(goal.deadline), 'd MMM yyyy', { locale: ru }) : 'Без срока'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mb-1">Накоплено</p>
            <p className="font-bold text-emerald-600 leading-none">{goal.currentAmount.toLocaleString()} ₽</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mb-1">Цель</p>
            <p className="font-bold text-neutral-900 leading-none">{goal.targetAmount.toLocaleString()} ₽</p>
          </div>
        </div>

        {goal.description && (
          <div className="mb-3 p-2 bg-neutral-50 rounded-xl text-[10px] text-neutral-500 overflow-hidden line-clamp-2 markdown-body">
            <ReactMarkdown>{goal.description}</ReactMarkdown>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className="text-neutral-400">Прогресс</span>
            <span className="text-emerald-600">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-theme-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

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
  onEditTransaction,
}: DashboardProps) {
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [showGoalManager, setShowGoalManager] = useState(!!initialGoalData);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showCompletedGoals, setShowCompletedGoals] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync showGoalManager with initialGoalData (for creation from UserPage)
  useEffect(() => {
    if (initialGoalData) {
      setShowGoalManager(true);
    }
  }, [initialGoalData]);

  const handleCloseGoalManager = () => {
    setShowGoalManager(false);
    if (onCloseGoalManager) onCloseGoalManager();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = displayedGoals.findIndex((g: Goal) => g.id === active.id);
      const newIndex = displayedGoals.findIndex((g: Goal) => g.id === over.id);
      
      const newOrderedGoals = arrayMove(displayedGoals, oldIndex, newIndex);
      
      try {
        const updates = newOrderedGoals.map((goal, index) => {
          return api.put(`/goals/${goal.id}`, { sortOrder: index });
        });
        await Promise.all(updates);
        onRefresh?.();
      } catch (error) {
        console.error('Error updating goal order:', error);
      }
    }
  };

  const handleSaveGoal = async (id: string, data: any) => {
    try {
      await api.put(`/goals/${id}`, data);
      setEditingGoalId(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await api.delete(`/goals/${id}`);
      setEditingGoalId(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleToggleCompleteGoal = async (goal: Goal) => {
    try {
      const completed = !goal.isCompleted;
      await api.put(`/goals/${goal.id}`, { 
        isCompleted: completed,
        completedAt: completed ? new Date().toISOString() : null
      });
      onRefresh?.();
    } catch (error) {
      console.error('Error toggling goal completion:', error);
    }
  };

  const totalBalance = useMemo(() => {
    return accounts
      .filter(a => a.showInTotals && !a.isArchived)
      .reduce((sum, acc) => {
        if (acc.currency === '₽') {
          return sum + acc.balance;
        }
        
        const currency = currencies.find(c => c.symbol === acc.currency);
        const rate = currency ? currency.rate : 1;
        return sum + (acc.balance * rate);
      }, 0);
  }, [accounts, currencies]);
  
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

  const monthlyRollingBalance = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = subMonths(now, 1);
    
    const relevantAccountIds = new Set(accounts.filter(a => a.showInTotals).map(a => a.id));

    return transactions
      .filter(t => {
        const tDate = new Date(t.createdAt);
        return tDate >= oneMonthAgo && tDate <= now && 
               (t.type === 'income' || t.type === 'expense') &&
               relevantAccountIds.has(t.accountId);
      })
      .reduce((sum, t) => {
        const amount = t.type === 'income' ? t.amount : -t.amount;
        
        const acc = accounts.find(a => a.id === t.accountId);
        if (!acc) return sum;
        
        if (acc.currency === '₽') {
          return sum + amount;
        }
        
        const currency = currencies.find(c => c.symbol === acc.currency);
        const rate = currency ? currency.rate : 1;
        return sum + (amount * rate);
      }, 0);
  }, [transactions, accounts, currencies]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [transactions]);

  const displayedGoals = useMemo(() => {
    return [...goals]
      .filter(g => showCompletedGoals ? g.isCompleted : !g.isCompleted)
      .sort((a, b) => {
        // Sort by sortOrder first
        const orderA = a.sortOrder ?? 9999;
        const orderB = b.sortOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        
        // Then by deadline
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [goals, showCompletedGoals]);

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

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    recentTransactions.forEach(t => {
      const dateKey = format(new Date(t.createdAt), 'dd.MM.yyyy', { locale: ru });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0].split('.').reverse().join('-')).getTime() - new Date(a[0].split('.').reverse().join('-')).getTime());
  }, [recentTransactions]);

  const balanceTrend = useMemo(() => {
    // 1. Get history points and sort them by month ascending
    const historyPoints = [...balanceHistory]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(h => ({
        name: format(new Date(h.month + '-01'), 'MMM', { locale: ru }),
        month: h.month,
        balance: h.totalBalance
      }));

    // 2. Add current state as the last point
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const currentPoint = {
      name: format(new Date(), 'MMM', { locale: ru }),
      month: currentMonthKey,
      balance: totalBalance
    };

    // If we already have a history point for this month, override it with current balance
    // otherwise append the current balance
    const existingIndex = historyPoints.findIndex(p => p.month === currentMonthKey);
    if (existingIndex !== -1) {
      historyPoints[existingIndex] = currentPoint;
      return historyPoints;
    } else {
      return [...historyPoints, currentPoint].sort((a, b) => a.month.localeCompare(b.month));
    }
  }, [balanceHistory, totalBalance]);

  return (
    <div className="pt-[10px] pb-[8px] px-1.5 sm:px-2 space-y-6">
      {/* Total Balance Card */}
      <AnimatePresence>
        {showTotalBalance && (
          <motion.div 
            initial={{ height: 0, opacity: 0.3, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 0.7, marginBottom: 24 }}
            exit={{ height: 0, opacity: 0.3, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div 
              onClick={() => onNavigateToAnalytics?.({ 
                filterType: 'period', 
                periodRange: { start: subMonths(new Date(), 1), end: new Date() } 
              })}
              className="bg-theme-primary rounded-2xl p-2 text-white shadow-xl shadow-theme-primary-light cursor-pointer group relative overflow-hidden"
            >
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-1 items-center">
                {/* Left Side: Balance and Stats */}
                <div>
                  <div className="mb-0 grid grid-cols-2 gap-1 px-2">
                    <div className="pt-0 pb-0 pr-0 text-center">
                      <p className="text-theme-primary-light text-[10px] sm:text-xs font-bold uppercase tracking-wider">Общий баланс</p>
                      <h2 className="text-lg sm:text-xl font-bold">{totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₽</h2>
                    </div>
                    <div className="text-center border-l border-white/10 pt-0 pb-0 pl-0">
                      <p className="text-theme-primary-light text-[10px] sm:text-xs font-bold uppercase tracking-wider pb-[2px]">За прошедший месяц</p>
                      <h2 className={cn(
                        "text-lg sm:text-xl font-bold pb-[5px]",
                        monthlyRollingBalance >= 0 ? "text-emerald-300" : "text-rose-300"
                      )}>
                        {monthlyRollingBalance > 0 ? "+" : ""}{monthlyRollingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₽
                      </h2>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pb-0">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTransactionHistory?.({ type: 'income' });
                      }}
                      className="mt-3 pt-[10px] pb-[10px] pl-[10px] bg-white/10 rounded-[12px] flex items-center gap-3 cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      <div className="bg-white/20 p-[6px] rounded-[12px]">
                        <TrendingUp className="mr-0 pr-0 w-4 h-4" />                        
                      </div>
                      <div className="leading-[12px] pb-0">
                        <p className="text-xs pt-0 pb-[6px] px-[6px] rounded-0" style={{ color: '#b9feac' }}>Доход</p>                      
                        <p className="font-semibold pt-[2px] pb-[2px] px-[6px]">{monthlyStats.income.toLocaleString()} ₽</p>
                      </div>
                    </div>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTransactionHistory?.({ type: 'expense' });
                      }}
                      className="mt-[12px] p-[10px] bg-white/10 rounded-[12px] flex items-center gap-3 cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      <div className="bg-white/20 p-[6px] rounded-[12px]">
                        <TrendingDown className="mr-0 pr-0 w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs pt-[2px] pb-[2px]" style={{ color: '#ffa1ad' }}>Расход</p>
                        <p className="font-semibold pt-0 text-neutral-100">{monthlyStats.expense.toLocaleString()} ₽</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Dynamics Chart (Hidden on mobile) */}
                <div className="hidden sm:block h-[100px] w-[100%] items-right">
                  <ResponsiveContainer width="80%" height="80%">
                    <BarChart data={balanceTrend}>
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)', fontWeight: 600 }} 
                      />
                      <YAxis hide />
                      <Bar dataKey="balance" fill="rgba(255,255,255,0.9)" radius={[4, 4, 0, 0]} barSize={12} />
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
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-[1px] mb-6"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg">Счета</h3>
          <button 
            onClick={() => setShowAccountManager(true)}
            className="text-theme-primary-dark text-sm font-medium hover:bg-theme-primary-light px-2 py-2 rounded-lg transition-colors"
          >
            Все
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 mx-0 px-2 no-scrollbar snap-x snap-mandatory">
          <AnimatePresence>
            {dashboardAccounts.map((account, index) => {
              const isNegative = account.balance < 0;
              const Icon = account.type === 'card' ? CreditCard : account.type === 'bank' ? Landmark : account.type === 'cash' ? CoinStack : Wallet;
              const hasColor = account.color && account.color !== '#000000';
              
              return (
                <motion.div 
                  key={account.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    if (onOpenTransactionHistory) onOpenTransactionHistory(account.id);
                  }}
                  className={cn(
                    "min-w-[100px] flex-shrink-0 bg-white p-3 rounded-2xl border transition-all duration-300 snap-start relative cursor-pointer group",
                    isNegative 
                      ? "shadow-soft border-rose-100 hover:shadow-rose-100/50 hover:bg-rose-50/30" 
                      : "shadow-soft border-neutral-100 hover:shadow-theme-primary-light/50 hover:bg-theme-primary-light/10"
                  )}
                >
                  <div className="absolute top-3 right-3 text-[10px] font-bold text-neutral-400 opacity-60">
                    {currencies.find(c => c.iso === account.currency)?.symbol || account.currency}
                  </div>
                  <div 
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110",
                      !hasColor && (isNegative ? "bg-rose-50" : "bg-theme-primary-light")
                    )}
                    style={hasColor ? { backgroundColor: `${account.color}20` } : {}}
                  >
                    <Icon 
                      className={cn("w-5 h-5", !hasColor && (isNegative ? "text-rose-500" : "text-theme-primary"))} 
                      style={hasColor ? { color: account.color } : {}}
                    />
                  </div>
                  <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wide mb-1 truncate group-hover:text-neutral-700">{account.name}</p>
                  <p className={cn("font-bold text-base truncate", isNegative ? "text-rose-600" : "text-neutral-900")}>
                    {account.balance.toLocaleString()}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {dashboardAccounts.length === 0 && (
            <p className="text-neutral-400 text-sm italic">Нет добавленных счетов</p>
          )}
        </div>
      </motion.section>

      {showAccountManager && (
        <AccountManager 
          accounts={accounts} 
          onClose={() => setShowAccountManager(false)} 
          onRefresh={onRefresh}
        />
      )}

      {/* Recent Transactions */}
      <section className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Последние операции</h3>
          <button 
            onClick={() => {
              if (onOpenTransactionHistory) onOpenTransactionHistory();
            }}
            className="text-theme-primary-dark text-sm font-medium hover:bg-theme-primary-light px-2 py-1 rounded-lg transition-colors"
          >
            История
          </button>
        </div>
        <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-soft">
          {groupedTransactions.map(([dateKey, transactions], groupIndex) => (
            <motion.div 
              key={dateKey}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + (groupIndex * 0.05) }}
            >
              <div className="px-4 py-2 bg-neutral-50/50 backdrop-blur-sm text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                {dateKey}
              </div>
              <table className="w-full text-left border-collapse table-fixed">
                <tbody className="divide-y divide-neutral-50">
                  {transactions.map(t => {
                    const category = categories.find(c => c.id === t.categoryId);
                    const parentCategory = category?.parentId ? categories.find(c => c.id === category.parentId) : category;
                    const account = accounts.find(a => a.id === t.accountId);
                    const targetAccount = t.targetAccountId ? accounts.find(a => a.id === t.targetAccountId) : null;
                    
                    return (
                      <tr 
                        key={t.id} 
                        onClick={() => {
                          if (onEditTransaction) onEditTransaction(t);
                        }}
                        className="hover:bg-neutral-50 active:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <td className="pl-4 pr-2 py-1 align-top">
                          <div className="flex items-start gap-2">
                            <span className="text-lg shrink-0">{t.type === 'transfer' ? '🔄' : (category?.icon || parentCategory?.icon || '💰')}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-neutral-900 truncate">{t.description || category?.name || (t.type === 'transfer' ? 'Перевод' : 'Без описания')}</p>
                              <p 
                                className="text-[10px] font-medium truncate"
                                style={{ color: account?.color && account.color !== '#000000' ? account.color : '#737373' }}
                              >
                                {account?.name || 'Счет'}
                                {targetAccount && ` → ${targetAccount.name}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={cn(
                          "px-4 py-3 align-top w-1/2",
                          t.type === 'income' ? "text-left" : 
                          t.type === 'transfer' ? "text-center" : 
                          "text-right"
                        )}>
                          <p className={cn(
                            "text-xs font-bold", 
                            t.type === 'income' ? "text-emerald-600" : 
                            t.type === 'transfer' ? "text-blue-600" : 
                            "text-neutral-900"
                          )}>
                            {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}{t.amount.toLocaleString()} ₽
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-neutral-400 text-sm">Операций пока нет</p>
            </div>
          )}
        </div>
      </section>

      {/* Goals Section */}
      <AnimatePresence>
        {showGoals && (
          <motion.section
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-lg">Цели</h3>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCompletedGoals(!showCompletedGoals);
                    }}
                    className={cn(
                      "w-4 h-4 rounded border transition-all flex items-center justify-center",
                      showCompletedGoals ? "bg-theme-primary border-theme-primary" : "border-neutral-300 group-hover:border-theme-primary"
                    )}
                  >
                    {showCompletedGoals && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">Завершенные</span>
                </label>
              </div>
              <button 
                onClick={() => setShowGoalManager(true)} 
                className="flex items-center gap-1 text-theme-primary-dark text-sm font-medium hover:bg-theme-primary-light px-2 py-1 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Добавить
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayedGoals.map(g => g.id)}
                  strategy={rectSortingStrategy}
                >
                  {displayedGoals.map(goal => (
                    <SortableGoalCard 
                      key={goal.id} 
                      goal={goal}
                      isEditing={editingGoalId === goal.id}
                      onStartEdit={(g) => setEditingGoalId(g.id)}
                      onCancelEdit={() => setEditingGoalId(null)}
                      onSave={handleSaveGoal}
                      onDelete={handleDeleteGoal}
                      onToggleComplete={handleToggleCompleteGoal}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {displayedGoals.length === 0 && (
                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-neutral-200">
                  <p className="text-neutral-400 text-sm italic">
                    {showCompletedGoals ? 'Нет завершенных целей' : 'Нет активных целей'}
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {showGoalManager && (
        <GoalManager 
          goals={goals} 
          userId={userId} 
          onClose={handleCloseGoalManager} 
          initialData={initialGoalData}
          onRefresh={onRefresh}
        />
      )}
      {/* Bottom Bar Spacer */}
      <div className="h-10 lg:hidden shrink-0" />

    </div>
  );
}
