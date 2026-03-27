import { useMemo, useState } from 'react';
import { Transaction, Category, Account } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar, ArrowRightLeft } from 'lucide-react';

interface TransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onRefresh?: () => void;
}

export default function Transactions({ transactions, categories, accounts, onRefresh }: TransactionsProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || 
                             categories.find(c => c.id === t.categoryId)?.name.toLowerCase().includes(search.toLowerCase()) ||
                             accounts.find(a => a.id === t.targetAccountId)?.name.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, search, filterType, categories, accounts]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach(t => {
      const date = format(new Date(t.createdAt), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return groups;
  }, [filteredTransactions]);

  return (
    <div className="p-1.5 sm:p-2 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Операции</h2>
        <div className="flex gap-2">
          <button className="p-2 bg-white rounded-xl shadow-sm">
            <Calendar className="w-5 h-5 text-neutral-500" />
          </button>
          <button className="p-2 bg-white rounded-xl shadow-sm">
            <Filter className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по описанию или категории..."
            className="w-full bg-white rounded-2xl pl-12 pr-4 py-3 outline-none focus:ring-2 ring-emerald-500/20 transition-all shadow-sm"
          />
        </div>
        
        <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
          {(['all', 'expense', 'income'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all",
                filterType === type ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              )}
            >
              {type === 'all' ? 'Все' : type === 'expense' ? 'Расход' : 'Доход'}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-8">
        {Object.entries(groupedTransactions).map(([date, items]) => (
          <div key={date} className="space-y-3">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1">
              {format(new Date(date), 'd MMMM yyyy', { locale: ru })}
            </h4>
            <div className="space-y-3">
              {items.map(t => {
                const category = categories.find(c => c.id === t.categoryId);
                // Ищем родительскую категорию, если текущая - подкатегория
                const parentCategory = category?.parentId ? categories.find(c => c.id === category.parentId) : category;
                const account = accounts.find(a => a.id === t.accountId);
                const targetAccount = t.targetAccountId ? accounts.find(a => a.id === t.targetAccountId) : null;
                
                return (
                  <div key={t.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: (parentCategory?.color || '#3b82f6') + '20' }}>
                        {t.type === 'transfer' ? '🔄' : (category?.icon || parentCategory?.icon || '💰')}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.description || category?.name || (t.type === 'transfer' ? 'Перевод' : 'Без описания')}</p>
                        <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider flex items-center gap-1">
                          <span 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: account?.color && account.color !== '#000000' ? account.color : '#d4d4d4' }}
                          />
                          {account?.name || 'Счет не указан'}
                          {targetAccount && (
                            <>
                              <span className="text-neutral-300">→</span>
                              <span 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: targetAccount?.color && targetAccount.color !== '#000000' ? targetAccount.color : '#d4d4d4' }}
                              />
                              {targetAccount.name}
                            </>
                          )}
                          {!category && t.type !== 'transfer' && <span className="text-rose-500 ml-1"> (catId: {t.categoryId})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-bold text-sm", 
                        t.type === 'income' ? "text-emerald-600" : 
                        t.type === 'transfer' ? "text-blue-600" : 
                        "text-neutral-900"
                      )}>
                        {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}{t.amount.toLocaleString()} ₽
                      </p>
                      <div className="flex items-center justify-end gap-1">
                        {t.type === 'income' ? (
                          <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                        ) : t.type === 'transfer' ? (
                          <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-neutral-300" />
                        )}
                        <span className="text-[10px] text-neutral-400">{format(new Date(t.createdAt), 'HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-20">
            <p className="text-neutral-400 text-sm">Ничего не найдено</p>
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
