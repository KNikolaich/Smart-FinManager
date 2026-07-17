import { useMemo, useState, useRef, useEffect } from 'react';
import { Transaction, Category, Account } from '../types';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Filter, ArrowRightLeft, Plus, Copy, ChevronDown, Search, Loader2, WifiOff, Clock } from 'lucide-react';
import { GenericContextMenu } from './ui/GenericContextMenu';
import { AnimatePresence } from 'motion/react';
import { cn, getTransactionDisplayTitle } from '../lib/utils';
import { api, safeStorage } from '../lib/api';

/** Minimal shape needed to render a queued-but-not-yet-synced transaction row. */
interface PendingTransaction {
  id: string;
  amount: number;
  description: string;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string | null;
  createdAt: string;
  type: 'income' | 'expense' | 'transfer';
}

function getQueuedTransactions(): PendingTransaction[] {
  const raw = safeStorage.getItem('api_offline_queue');
  if (!raw) return [];
  try {
    const queue: unknown[] = JSON.parse(raw);
    const pending: PendingTransaction[] = [];
    for (const item of queue) {
      if (
        typeof item !== 'object' || item === null ||
        (item as any).method !== 'POST' ||
        (item as any).endpoint !== '/transactions' ||
        !(item as any).data
      ) continue;
      const d = (item as any).data;
      if (!d.id || !d.accountId || !d.type || d.amount === undefined) continue;
      pending.push({
        id: String(d.id),
        amount: Number(d.amount),
        description: d.description || '',
        accountId: String(d.accountId),
        targetAccountId: d.targetAccountId ? String(d.targetAccountId) : null,
        categoryId: d.categoryId ? String(d.categoryId) : null,
        createdAt: d.createdAt || new Date((item as any).timestamp || Date.now()).toISOString(),
        type: d.type as 'income' | 'expense' | 'transfer',
      });
    }
    return pending;
  } catch {
    return [];
  }
}

const PAGE_SIZE = 50;

interface TransactionHistoryProps {
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onOpenAddTransaction: (initialData?: any) => void;
  initialAccountId?: string;
  initialCategoryId?: string;
  initialType?: 'all' | 'income' | 'expense';
  initialStartDate?: string;
  initialEndDate?: string;
  initialSelectedMonth?: Date;
  // Bumped by the parent whenever transactions/accounts data changes
  // elsewhere (add/edit/delete, socket sync), so this view refetches
  // its currently visible page instead of relying on a fully-loaded array.
  refreshSignal?: number;
}

export default function TransactionHistory({ 
  categories, 
  accounts, 
  onClose, 
  onEditTransaction, 
  onOpenAddTransaction,
  initialAccountId, 
  initialCategoryId,
  initialType = 'all',
  initialStartDate,
  initialEndDate,
  initialSelectedMonth,
  refreshSignal
}: TransactionHistoryProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialSelectedMonth || new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>(initialType);
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>(initialCategoryId || 'all');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(initialAccountId && initialAccountId !== 'all' ? [initialAccountId] : []);
  const [customStartDate, setCustomStartDate] = useState<string>(initialStartDate || '');
  const [customEndDate, setCustomEndDate] = useState<string>(initialEndDate || '');
  const [isFunnelOpen, setIsFunnelOpen] = useState(false);

  // Online status and queued offline transactions
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedTransactions, setQueuedTransactions] = useState<PendingTransaction[]>(() => getQueuedTransactions());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keep queue state fresh: poll whenever offline OR while items are still pending
  // (sync may drain the queue gradually after reconnection, so we continue
  // polling until the queue is empty regardless of online status).
  useEffect(() => {
    setQueuedTransactions(getQueuedTransactions());
  }, [isOnline, refreshSignal]);

  useEffect(() => {
    // Continue polling as long as there are pending items so rows disappear
    // the moment each item is synced and removed from the queue.
    const id = setInterval(() => {
      const current = getQueuedTransactions();
      setQueuedTransactions(current);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Server-fetched, paginated transaction data for the current filters
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const categorySelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categorySelectRef.current && !categorySelectRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === filterCategoryId);
  }, [categories, filterCategoryId]);

  const parentCategory = useMemo(() => {
    return selectedCategory?.parentId 
      ? categories.find(c => c.id === selectedCategory.parentId) 
      : null;
  }, [categories, selectedCategory]);

  const filteredCategoriesToChoose = useMemo(() => {
    const query = categorySearchQuery.toLowerCase();
    const typedCategories = categories.filter(c => {
      if (filterType === 'all') return true;
      return c.type === filterType;
    });

    const parents = typedCategories.filter(c => !c.parentId);
    const children = typedCategories.filter(c => c.parentId);

    return parents
      .map(parent => {
        const parentMatches = parent.name.toLowerCase().includes(query);
        const matchedChildren = children.filter(child => 
          child.parentId === parent.id && 
          (child.name.toLowerCase().includes(query) || parentMatches)
        );

        return {
          parent,
          children: matchedChildren,
          isVisible: parentMatches || matchedChildren.length > 0
        };
      })
      .filter(group => group.isVisible)
      .sort((a, b) => {
        const aOrder = a.parent.sortOrder ?? Infinity;
        const bOrder = b.parent.sortOrder ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.parent.name.localeCompare(b.parent.name);
      });
  }, [categories, filterType, categorySearchQuery]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, transaction: Transaction } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Date range sent to the server: either the custom range or the selected month
  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    if (customStartDate || customEndDate) {
      return { effectiveStartDate: customStartDate || undefined, effectiveEndDate: customEndDate || undefined };
    }
    return {
      effectiveStartDate: format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
      effectiveEndDate: format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
    };
  }, [selectedMonth, customStartDate, customEndDate]);

  // All category ids matching the selected filter (parent + its subcategories)
  const categoryIdsFilter = useMemo(() => {
    if (filterCategoryId === 'all') return undefined;

    const getSubcategoryIds = (parentId: string): string[] => {
      const children = categories.filter(c => c.parentId === parentId);
      return [parentId, ...children.flatMap(c => getSubcategoryIds(c.id))];
    };

    return getSubcategoryIds(filterCategoryId);
  }, [filterCategoryId, categories]);

  // Original UX also matched the search text against category/account names;
  // resolve those to id lists client-side (cheap, small lookup tables) and
  // let the server combine them with the description search.
  const { searchCategoryIds, searchAccountIds } = useMemo(() => {
    if (!debouncedSearchQuery) return { searchCategoryIds: undefined, searchAccountIds: undefined };
    const q = debouncedSearchQuery.toLowerCase();
    return {
      searchCategoryIds: categories.filter(c => c.name.toLowerCase().includes(q)).map(c => c.id),
      searchAccountIds: accounts.filter(a => a.name.toLowerCase().includes(q)).map(a => a.id),
    };
  }, [debouncedSearchQuery, categories, accounts]);

  const fetchPage = async (targetPage: number, append: boolean) => {
    const seq = ++requestSeq.current;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const result = await api.getTransactionsPage({
        page: targetPage,
        pageSize: PAGE_SIZE,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        type: filterType,
        accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
        categoryIds: categoryIdsFilter,
        search: debouncedSearchQuery || undefined,
        searchCategoryIds,
        searchAccountIds,
      });
      // Ignore stale responses from a previous filter/page request
      if (seq !== requestSeq.current) return;

      setItems(prev => append ? [...prev, ...result.transactions] : result.transactions);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setTotalIncome(result.totalIncome);
      setTotalExpense(result.totalExpense);
      setPage(targetPage);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      if (seq === requestSeq.current) {
        if (append) setLoadingMore(false); else setLoading(false);
      }
    }
  };

  // Refetch page 1 whenever any filter (or the parent's refresh signal) changes
  useEffect(() => {
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStartDate, effectiveEndDate, filterType, categoryIdsFilter, selectedAccountIds, debouncedSearchQuery, refreshSignal]);

  const handleLoadMore = () => {
    if (loadingMore || page >= totalPages) return;
    fetchPage(page + 1, true);
  };

  const stats = useMemo(() => ({
    income: totalIncome,
    expense: totalExpense,
    total: totalIncome - totalExpense,
  }), [totalIncome, totalExpense]);

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
    items.forEach(t => {
      const dateKey = format(new Date(t.createdAt), 'dd.MM.yy', { locale: ru });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0].split('.').reverse().join('-')).getTime() - new Date(a[0].split('.').reverse().join('-')).getTime());
  }, [items]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-0 lg:p-8">
      <div className="w-full h-full lg:h-auto lg:max-h-full max-w-2xl bg-theme-surface shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom duration-300 lg:rounded-2xl">
        <div className="py-4 px-4 border-b border-theme-base flex items-center justify-between shrink-0 relative z-10">
          <h2 className="text-xl font-black uppercase text-theme-main drop-shadow-sm">История</h2>
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
              className="p-2 bg-theme-main/50 border border-theme-base text-theme-main rounded-xl shadow-md hover:bg-theme-main transition-all relative z-20 cursor-pointer flex items-center justify-center active:scale-95"
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
                  isFunnelOpen || selectedAccountIds.length > 0 || customStartDate || customEndDate || filterCategoryId !== 'all'
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

                {/* Category Filter */}
                <div className="relative animate-in fade-in duration-200" ref={categorySelectRef}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted block mb-2">Фильтр по категориям</label>
                  
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    className="w-full bg-theme-main border border-theme-base rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 ring-theme-primary/20 transition-all text-left font-semibold flex items-center justify-between text-theme-main shadow-sm cursor-pointer"
                  >
                    {selectedCategory ? (
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-sm shrink-0">{selectedCategory.icon || (parentCategory?.icon)}</span>
                        <div className="flex flex-row items-baseline gap-1.5 leading-tight overflow-hidden">
                          <span className="truncate">{selectedCategory.name}</span>
                          {parentCategory && (
                            <span className="text-[9px] text-theme-muted truncate whitespace-nowrap">({parentCategory.name})</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-theme-muted">Все категории</span>
                    )}
                    <ChevronDown className={cn("w-3.5 h-3.5 text-theme-muted transition-transform shrink-0 ml-2", isCategoryDropdownOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isCategoryDropdownOpen && (
                      <div
                        className="absolute z-[110] top-full mt-2 left-0 right-0 bg-theme-surface border border-theme-base rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[300px] animate-in fade-in slide-in-from-top-1 duration-150"
                      >
                        {/* Search Input */}
                        <div className="p-2 border-b border-theme-base sticky top-0 bg-theme-surface/85 backdrop-blur-sm z-10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
                            <input
                              type="text"
                              value={categorySearchQuery}
                              onChange={(e) => setCategorySearchQuery(e.target.value)}
                              placeholder="Поиск категории..."
                              className="w-full bg-theme-main border border-theme-base rounded-xl pl-8 pr-8 py-1.5 text-[11px] outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main"
                            />
                            {categorySearchQuery && (
                              <button
                                onClick={() => setCategorySearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-theme-main rounded-full transition-colors cursor-pointer flex items-center justify-center w-5 h-5"
                              >
                                <X className="w-3 h-3 text-theme-muted" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto p-1.5 no-scrollbar max-h-52">
                          <button
                            type="button"
                            onClick={() => {
                              setFilterCategoryId('all');
                              setIsCategoryDropdownOpen(false);
                              setCategorySearchQuery('');
                            }}
                            className={cn(
                              "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all mb-1 cursor-pointer",
                              filterCategoryId === 'all' 
                                ? "bg-theme-primary/10 text-theme-primary font-bold" 
                                : "text-theme-main hover:bg-theme-main"
                            )}
                          >
                            <span>📂</span>
                            <span>Все категории</span>
                          </button>

                          {filteredCategoriesToChoose.length === 0 ? (
                            <div className="py-4 text-center text-theme-muted text-xs italic">
                              Категории не найдены
                            </div>
                          ) : (
                            filteredCategoriesToChoose.map(({ parent, children }) => {
                              const isParentSelected = filterCategoryId === parent.id;
                              return (
                                <div key={parent.id} className="mb-1 last:mb-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFilterCategoryId(parent.id);
                                      setIsCategoryDropdownOpen(false);
                                      setCategorySearchQuery('');
                                    }}
                                    className={cn(
                                      "w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all cursor-pointer",
                                      isParentSelected 
                                        ? "bg-theme-primary/10 text-theme-primary font-bold" 
                                        : "text-theme-main hover:bg-theme-main font-semibold"
                                    )}
                                  >
                                    <span className="text-base shrink-0">{parent.icon}</span>
                                    <span>{parent.name}</span>
                                  </button>
                                  
                                  {children.length > 0 && (
                                    <div className="ml-4 mt-0.5 grid grid-cols-1 gap-0.5 border-l border-theme-base/50 pl-2">
                                      {children.map(child => {
                                        const isChildSelected = filterCategoryId === child.id;
                                        return (
                                          <button
                                            key={child.id}
                                            type="button"
                                            onClick={() => {
                                              setFilterCategoryId(child.id);
                                              setIsCategoryDropdownOpen(false);
                                              setCategorySearchQuery('');
                                            }}
                                            className={cn(
                                              "w-full text-left px-3 py-1 rounded-md text-[11px] flex items-center gap-2 transition-all cursor-pointer",
                                              isChildSelected 
                                                ? "bg-theme-primary/10 text-theme-primary font-bold border-l-2 border-theme-primary" 
                                                : "text-theme-muted hover:bg-theme-main hover:text-theme-main font-medium"
                                            )}
                                          >
                                            <span className="truncate">{child.name}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
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
                {(selectedAccountIds.length > 0 || customStartDate || customEndDate || filterCategoryId !== 'all') && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        setSelectedAccountIds([]);
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setFilterCategoryId('all');
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
          {/* Queued offline transactions shown at the top while waiting to sync.
              Visible as long as items remain in the queue — including after
              reconnection, until sync actually removes each entry. */}
          {queuedTransactions.length > 0 && (
            <div>
              <div className="py-2 bg-amber-500/10 backdrop-blur-md sticky top-0 z-20 border-y border-amber-500/30 flex items-center gap-2 px-4">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Ожидает отправки</span>
              </div>
              <table className="w-full text-left border-collapse table-fixed opacity-70">
                <tbody>
                  {queuedTransactions.map(t => {
                    const category = categories.find(c => c.id === t.categoryId);
                    const parentCategory = category?.parentId ? categories.find(c => c.id === category.parentId) : category;
                    const account = accounts.find(a => a.id === t.accountId);
                    const targetAccount = t.targetAccountId ? accounts.find(a => a.id === t.targetAccountId) : null;
                    return (
                      <tr key={t.id} className="border-b border-theme-base/30 last:border-0">
                        <td className="pl-4 pr-2 py-1.5 align-top">
                          <div className="flex items-start gap-2">
                            <span className="text-lg shrink-0">{t.type === 'transfer' ? '🔄' : (category?.icon || parentCategory?.icon || '💰')}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-theme-main truncate">
                                {getTransactionDisplayTitle(t.description, category?.name, t.type)}
                              </p>
                              <p
                                className="text-[10px] font-medium truncate"
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
          )}

          {groupedTransactions.map(([dateKey, transactions]) => {
            const groupIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const groupExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            return (
              <div key={dateKey}>
                <div className="py-2 bg-theme-primary/5 backdrop-blur-md sticky top-0 z-20 border-y border-theme-base/50 flex items-center">
                  <div className="w-1/2 pl-4 pr-2 text-[10px] font-bold text-theme-primary uppercase tracking-widest">
                    <span>{dateKey}</span>
                  </div>
                  <div className="w-1/2 px-4 flex items-center justify-between text-[11px] font-bold">
                    {groupIncome > 0 ? (
                      <span className="text-emerald-500 font-sans">
                        +{groupIncome.toLocaleString()} ₽
                      </span>
                    ) : (
                      <span />
                    )}
                    {groupExpense > 0 ? (
                      <span className="text-rose-500 font-sans">
                        -{groupExpense.toLocaleString()} ₽
                      </span>
                    ) : (
                      <span />
                    )}
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
                                <p className="text-xs font-bold text-theme-main truncate">
                                  {getTransactionDisplayTitle(t.description, category?.name, t.type)}
                                </p>
                                <p 
                                  className="text-[10px] font-medium truncate"
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
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-theme-muted italic gap-2">
              {!isOnline ? (
                <>
                  <WifiOff className="w-5 h-5 text-amber-400" />
                  <p className="text-sm">Нет подключения — показаны только локальные данные</p>
                </>
              ) : (
                <p className="text-sm">В этом месяце операций не было</p>
              )}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-10 text-theme-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {!loading && items.length > 0 && page < totalPages && (
            <div className="flex items-center justify-center py-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-xl bg-theme-main border border-theme-base text-[11px] font-bold uppercase tracking-widest text-theme-muted hover:text-theme-main transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Показать ещё ({total - items.length})
              </button>
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
