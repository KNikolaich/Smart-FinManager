import { useMemo, useState } from 'react';
import { Transaction, Category, Account } from '../types';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Filter, ArrowRightLeft } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onEditTransaction: (transaction: Transaction) => void;
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
  initialAccountId, 
  initialCategoryId,
  initialType = 'all'
}: TransactionHistoryProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>(initialType);
  const [filterCategoryId, setFilterCategoryId] = useState<string | 'all'>(initialCategoryId || 'all');
  const [filterAccountId, setFilterAccountId] = useState<string | 'all'>(initialAccountId || 'all');
  const [showFilter, setShowFilter] = useState(false);
  const [showAccountFilter, setShowAccountFilter] = useState(false);

  const monthTransactions = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return transactions
      .filter(t => {
        const date = new Date(t.createdAt);
        return date >= start && date <= end;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, selectedMonth]);

  const allowedCategoryIds = useMemo(() => {
    if (filterCategoryId === 'all') return null;
    
    const getSubcategoryIds = (parentId: string): string[] => {
      const children = categories.filter(c => c.parentId === parentId);
      return [parentId, ...children.flatMap(c => getSubcategoryIds(c.id))];
    };
    
    return new Set(getSubcategoryIds(filterCategoryId));
  }, [filterCategoryId, categories]);

  const filteredTransactions = useMemo(() => {
    return monthTransactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            accounts.find(a => a.id === t.targetAccountId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesCategory = !allowedCategoryIds || allowedCategoryIds.has(t.categoryId);
      const matchesAccount = filterAccountId === 'all' || t.accountId === filterAccountId || t.targetAccountId === filterAccountId;
      return matchesSearch && matchesType && matchesCategory && matchesAccount;
    });
  }, [monthTransactions, searchQuery, filterType, allowedCategoryIds, filterAccountId, categories, accounts]);

  const stats = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, total: income - expense };
  }, [filteredTransactions]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach(t => {
      const dateKey = format(new Date(t.createdAt), 'dd.MM.yyyy', { locale: ru });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0].split('.').reverse().join('-')).getTime() - new Date(a[0].split('.').reverse().join('-')).getTime());
  }, [filteredTransactions]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-1 sm:p-0">
      <div className="w-full h-full max-w-2xl bg-white shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="py-4 px-4 border-b border-neutral-100 flex items-center justify-between shrink-0 relative z-10">
          <h2 className="text-xl font-bold">История операций</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors relative z-20 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        {/* Month Selector */}
        <div className="py-2 px-4 bg-neutral-50 flex flex-col gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="p-1.5 hover:bg-white rounded-xl transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-neutral-600" />
              </button>
              <div className="text-center min-w-[100px]">
                <p className="text-xs font-bold capitalize">{format(selectedMonth, 'LLLL yyyy', { locale: ru })}</p>
                <div className="flex justify-center gap-3 mt-0.5">
                  <span className="text-[9px] font-bold text-emerald-600">+{stats.income.toLocaleString()} ₽</span>
                  <span className="text-[9px] font-bold text-rose-500">-{stats.expense.toLocaleString()} ₽</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                className="p-1.5 hover:bg-white rounded-xl transition-all"
              >
                <ChevronRight className="w-4 h-4 text-neutral-600" />
              </button>
            </div>

            {/* Search and Type Filter */}
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                className="flex-1 p-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex bg-neutral-100 rounded-xl p-0.5 shrink-0">
                {(['all', 'expense', 'income'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all",
                      filterType === type ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"
                    )}
                  >
                    {type === 'all' ? 'Все' : type === 'expense' ? 'Расход' : 'Доход'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          {groupedTransactions.map(([dateKey, transactions]) => (
            <div key={dateKey}>
              <div className="px-4 py-1 bg-neutral-50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider sticky top-0 z-20">
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
                        onClick={() => onEditTransaction(t)}
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
                          "px-4 py-1 align-top w-1/2",
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
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
              <p className="text-sm">В этом месяце операций не было</p>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="py-3 px-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Итого за период</span>
          <p className={cn("text-lg font-bold", stats.total >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {stats.total >= 0 ? '+' : ''}{stats.total.toLocaleString()} ₽
          </p>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
