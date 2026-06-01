import { useMemo, useState, useRef } from 'react';
import { Transaction, Category, Account } from '../types';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Filter, ArrowRightLeft, Plus, Copy } from 'lucide-react';
import { GenericContextMenu } from './ui/GenericContextMenu';
import { AnimatePresence } from 'motion/react';
import { SimpleMarkdown } from './ui/InteractiveMarkdown';
import { cn, getTransactionDisplayTitle } from '../lib/utils';

interface TransactionHistoryProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onOpenAddTransaction: (initialData?: any) => void;
  initialAccountId?: string;
  initialCategoryId?: string;
  initialType?: 'all' | 'income' | 'expense';
}

export default function TransactionHistory({ 
  transactions, 
  categories, 
  accounts, 
  onClose, 
  onEditTransaction, 
  onOpenAddTransaction,
  initialAccountId, 
  initialCategoryId,
  initialType = 'all'
}: TransactionHistoryProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>(initialType);
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>(initialCategoryId || 'all');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(initialAccountId && initialAccountId !== 'all' ? [initialAccountId] : []);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isFunnelOpen, setIsFunnelOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, transaction: Transaction } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const dateFilteredTransactions = useMemo(() => {
    const hasCustomDates = customStartDate || customEndDate;
    if (hasCustomDates) {
      return transactions
        .filter(t => {
          const localString = format(new Date(t.createdAt), 'yyyy-MM-dd');
          if (customStartDate && localString < customStartDate) return false;
          if (customEndDate && localString > customEndDate) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);
      return transactions
        .filter(t => {
          const date = new Date(t.createdAt);
          return date >= start && date <= end;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [transactions, selectedMonth, customStartDate, customEndDate]);

  const allowedCategoryIds = useMemo(() => {
    if (filterCategoryId === 'all') return null;
    
    const getSubcategoryIds = (parentId: string): string[] => {
      const children = categories.filter(c => c.parentId === parentId);
      return [parentId, ...children.flatMap(c => getSubcategoryIds(c.id))];
    };
    
    return new Set(getSubcategoryIds(filterCategoryId));
  }, [filterCategoryId, categories]);

  const filteredTransactions = useMemo(() => {
    return dateFilteredTransactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            accounts.find(a => a.id === t.targetAccountId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesCategory = !allowedCategoryIds || allowedCategoryIds.has(t.categoryId);
      const matchesAccount = selectedAccountIds.length === 0 || 
                             selectedAccountIds.includes(t.accountId) || 
                             (t.targetAccountId && selectedAccountIds.includes(t.targetAccountId));
      return matchesSearch && matchesType && matchesCategory && matchesAccount;
    });
  }, [dateFilteredTransactions, searchQuery, filterType, allowedCategoryIds, selectedAccountIds, categories, accounts]);

  const stats = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, total: income - expense };
  }, [filteredTransactions]);

  const handleAddNewByFilter = () => {
    onOpenAddTransaction?.({
      type: filterType === 'all' ? 'expense' : filterType,
      accountId: selectedAccountIds.length > 0 ? selectedAccountIds[0] : (accounts.length > 0 ? accounts[0].id : ''),
      categoryId: filterCategoryId === 'all' ? '' : filterCategoryId,
      createdAt: new Date().toISOString()
    });
  };

  const handleContextMenuAction = (action: 'create' | 'copy') => {
    if (!contextMenu) return;

    if (action === 'create') {
      handleAddNewByFilter();
    } else if (action === 'copy') {
      const t = contextMenu.transaction;
      onOpenAddTransaction?.({
        type: t.type,
        amount: t.amount,
        accountId: t.accountId,
        categoryId: t.categoryId,
        description: t.description,
        targetAccountId: t.targetAccountId,
        createdAt: new Date().toISOString()
      });
    }
  };

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach(t => {
      const dateKey = format(new Date(t.createdAt), 'dd.MM.yy', { locale: ru });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0].split('.').reverse().join('-')).getTime() - new Date(a[0].split('.').reverse().join('-')).getTime());
  }, [filteredTransactions]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-0 lg:p-8">
      <div className="w-full h-full lg:h-auto lg:max-h-full max-w-2xl bg-theme-surface shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom duration-300 lg:rounded-2xl">
        <div className="py-4 px-4 border-b border-theme-base flex items-center justify-between shrink-0 relative z-10">
          <h2 className="text-xl font-bold text-theme-main">История операций</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleAddNewByFilter}
              className="p-2 bg-sky-500 text-white rounded-xl shadow-lg hover:bg-sky-600 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              aria-label="Добавить новую"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose} 
              className="p-2 border border-orange-400 text-orange-400 bg-white rounded-xl hover:bg-orange-50 transition-colors relative z-20 cursor-pointer flex items-center justify-center"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Month Selector & Filters */}
        <div className="py-3 px-4 bg-theme-main flex flex-col gap-4 shrink-0 border-b border-theme-base/30">
          <div className="flex flex-col min-[550px]:flex-row min-[550px]:items-center gap-4 justify-between">
            {/* Top Row / Left Side: Date and Type Filter */}
            <div className="flex items-center justify-between min-[550px]:justify-start gap-4">
              <div className="flex items-center gap-1 bg-theme-surface p-1 rounded-xl border border-theme-base">
                <button 
                  onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                  className="p-1.5 hover:bg-theme-main rounded-lg transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-theme-muted" />
                </button>
                <div className="text-center min-w-[90px]">
                  <p className="text-[10px] font-bold text-theme-main leading-none">
                    {customStartDate || customEndDate ? (
                      <span className="text-[9px] text-theme-primary">Фильтр дат</span>
                    ) : (
                      <span className="capitalize">{format(selectedMonth, 'LLLL yyyy', { locale: ru })}</span>
                    )}
                  </p>
                  <div className="flex justify-center gap-2 mt-0.5">
                    <span className="text-[8px] font-bold text-emerald-500">+{stats.income.toLocaleString()}</span>
                    <span className="text-[8px] font-bold text-rose-500">-{stats.expense.toLocaleString()}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                  className="p-1.5 hover:bg-theme-main rounded-lg transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-theme-muted" />
                </button>
              </div>

              {/* Type Filter */}
              <div className="flex bg-theme-surface rounded-xl p-1 shrink-0 border border-theme-base">
                {(['all', 'expense', 'income'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      "px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
                      filterType === type ? "bg-theme-main shadow-sm text-theme-main" : "text-theme-muted hover:text-theme-main"
                    )}
                  >
                    {type === 'all' ? 'Все' : type === 'expense' ? 'Расход' : 'Доход'}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Row / Right Side: Search Bar & Funnel Button */}
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 group">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по описанию или категории..."
                  className="w-full pl-3 pr-3 py-2 rounded-xl bg-theme-surface border border-theme-base text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary transition-all text-theme-main placeholder:text-theme-muted/50"
                />
              </div>
              <button
                onClick={() => setIsFunnelOpen(!isFunnelOpen)}
                className={cn(
                  "p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9",
                  isFunnelOpen || selectedAccountIds.length > 0 || customStartDate || customEndDate
                    ? "bg-theme-primary text-theme-on-primary border-theme-primary hover:bg-theme-primary/95" 
                    : "bg-theme-surface text-theme-muted border-theme-base hover:text-theme-main"
                )}
                title="Фильтры"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isFunnelOpen && (
              <div className="bg-theme-surface border border-theme-base rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Accounts Filter */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted block mb-2">Фильтр по счетам</label>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto no-scrollbar py-1">
                    {accounts.map(acc => {
                      const isSelected = selectedAccountIds.includes(acc.id);
                      return (
                        <button
                          key={acc.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAccountIds(selectedAccountIds.filter(id => id !== acc.id));
                            } else {
                              setSelectedAccountIds([...selectedAccountIds, acc.id]);
                            }
                          }}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none",
                            isSelected 
                              ? "bg-theme-primary/10 text-theme-primary border-theme-primary" 
                              : "bg-theme-main border-theme-base text-theme-muted hover:text-theme-main"
                          )}
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color || '#ccc' }} />
                          {acc.name}
                        </button>
                      );
                    })}
                    {accounts.length === 0 && (
                      <span className="text-xs text-theme-muted/50 italic">Нет доступных счетов</span>
                    )}
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="grid grid-cols-2 gap-3 pb-1">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted block mb-1">С даты</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-theme-main border border-theme-base rounded-xl px-3 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted block mb-1">По дату</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-theme-main border border-theme-base rounded-xl px-3 py-2 text-xs text-theme-main focus:outline-none focus:border-theme-primary"
                    />
                  </div>
                </div>

                {/* Reset filters button if any is active */}
                {(selectedAccountIds.length > 0 || customStartDate || customEndDate) && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        setSelectedAccountIds([]);
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }}
                      className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Сбросить фильтры
                    </button>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          {groupedTransactions.map(([dateKey, transactions]) => {
            const groupIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const groupExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            return (
              <div key={dateKey}>
                <div className="px-4 py-2 bg-theme-primary/5 backdrop-blur-md text-[10px] font-bold text-theme-primary uppercase tracking-widest sticky top-0 z-20 border-y border-theme-base/50 flex items-center justify-between">
                  <span>{dateKey}</span>
                  <div className="flex items-center gap-2 font-mono">
                    {groupIncome > 0 && <span className="text-emerald-500">+{groupIncome.toLocaleString()} ₽</span>}
                    {groupExpense > 0 && <span className="text-rose-500">-{groupExpense.toLocaleString()} ₽</span>}
                  </div>
                </div>
                <table className="w-full text-left border-collapse table-fixed">
                  <tbody>
                    {transactions.map(t => {
                      const category = categories.find(c => c.id === t.categoryId);
                      const parentCategory = category?.parentId ? categories.find(c => c.id === category.parentId) : category;
                      const account = accounts.find(a => a.id === t.accountId);
                      const targetAccount = t.targetAccountId ? accounts.find(a => a.id === t.targetAccountId) : null;
                      
                      return (
                        <tr 
                          key={t.id} 
                          onClick={() => onEditTransaction(t)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({ x: e.clientX, y: e.clientY, transaction: t });
                          }}
                          onPointerDown={(e) => {
                            const x = e.clientX;
                            const y = e.clientY;
                            longPressTimer.current = setTimeout(() => {
                              setContextMenu({ x, y, transaction: t });
                            }, 600);
                          }}
                          onPointerUp={() => {
                            if (longPressTimer.current) clearTimeout(longPressTimer.current);
                          }}
                          onPointerMove={() => {
                            if (longPressTimer.current) clearTimeout(longPressTimer.current);
                          }}
                          className="hover:bg-theme-primary/5 active:bg-theme-primary/10 transition-colors cursor-pointer select-none"
                        >
                          <td className="pl-4 pr-2 py-1.5 align-top">
                            <div className="flex items-start gap-2">
                              <span className="text-lg shrink-0">{t.type === 'transfer' ? '🔄' : (category?.icon || parentCategory?.icon || '💰')}</span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-theme-main markdown-body prose-sm">
                                  <SimpleMarkdown 
                                    content={getTransactionDisplayTitle(t.description, category?.name, t.type)} 
                                  />
                                </div>
                                <p 
                                  className="text-[10px] font-medium truncate mt-1"
                                  style={{ color: account?.color && account.color !== '#000000' ? account.color : 'var(--text-muted)' }}
                                >
                                  {account?.name || 'Счет'}
                                  {targetAccount && ` → ${targetAccount.name}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className={cn(
                            "px-4 py-1.5 align-top w-1/2",
                            t.type === 'income' ? "text-left" : 
                            t.type === 'transfer' ? "text-center" : 
                            "text-right"
                          )}>
                            <p className={cn(
                              "text-xs font-bold", 
                              t.type === 'income' ? "text-emerald-500" : 
                              t.type === 'transfer' ? "text-blue-500" : 
                              "text-theme-main"
                            )}>
                              {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}{t.amount.toLocaleString()} ₽
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
          {filteredTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-theme-muted italic">
              <p className="text-sm">В этом месяце операций не было</p>
            </div>
          )}
          
          {contextMenu && (
            <GenericContextMenu 
              x={contextMenu.x} 
              y={contextMenu.y} 
              onClose={() => setContextMenu(null)}
              items={[
                {
                  label: 'Добавить похожую',
                  icon: Plus,
                  onClick: () => handleContextMenuAction('create')
                },
                {
                  label: 'Копировать операцию',
                  icon: Copy,
                  onClick: () => handleContextMenuAction('copy')
                }
              ]}
            />
          )}
        </div>

        {/* Fixed Footer */}
        <div className="py-3 px-6 bg-theme-main border-t border-theme-base flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Итого за период</span>
          <p className={cn("text-lg font-bold", stats.total >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {stats.total >= 0 ? '+' : ''}{stats.total.toLocaleString()} ₽
          </p>
        </div>
      </div>
    </div>
  );
}
