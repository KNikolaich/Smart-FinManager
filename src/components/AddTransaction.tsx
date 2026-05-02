import { useState } from 'react';
import { api } from '../lib/api';
import { Transaction, Account, Category, TransactionType } from '../types';
import { X, Check, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import AccountSelect from './AccountSelect';

interface AddTransactionProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  onComplete: () => void;
  onAdd: () => void;
  onOptimisticAdd: (transaction: Transaction) => void;
  userId: string;
  initialData?: any;
}

export default function AddTransaction({ accounts, transactions, categories, onComplete, onAdd, onOptimisticAdd, userId, initialData }: AddTransactionProps) {
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [selectedAccountId, setSelectedAccountId] = useState(initialData?.accountId || accounts[0]?.id || '');
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState(initialData?.targetAccountId || accounts[1]?.id || accounts[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.categoryId || '');
  const [activeParentId, setActiveParentId] = useState<string | null>(initialData?.categoryId ? categories.find(c => c.id === initialData.categoryId)?.parentId || null : null);
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const activeAccounts = accounts.filter(a => !a.isArchived);

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount))) return;
    setLoading(true);
    
    const now = new Date();
    const selectedDate = new Date(date);
    let finalCreatedAt = selectedDate.toISOString();

    // If selected date is today, use current time
    if (format(now, 'yyyy-MM-dd') === date) {
      finalCreatedAt = now.toISOString();
    }

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substring(2, 9),
      userId,
      amount: Number(amount),
      description,
      accountId: selectedAccountId,
      targetAccountId: type === 'transfer' ? selectedTargetAccountId : undefined,
      categoryId: type !== 'transfer' ? selectedCategoryId : '',
      createdAt: finalCreatedAt,
      type
    };

    onOptimisticAdd(newTransaction);
    onComplete();

    try {
      await api.post('/transactions', {
        amount: Number(amount),
        description,
        accountId: selectedAccountId,
        targetAccountId: type === 'transfer' ? selectedTargetAccountId : null,
        categoryId: type !== 'transfer' ? selectedCategoryId : null,
        createdAt: finalCreatedAt,
        type
      });
      onAdd();
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      // In a real app, we would revert the optimistic update here
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-theme-surface overflow-hidden shadow-2xl flex flex-col relative h-full animate-in slide-in-from-bottom duration-300">
        <div className="px-6 py-3 flex items-center justify-between shrink-0 relative z-10 border-b border-theme-base">
          <h2 className="text-base font-bold text-theme-main">Новая операция</h2>
          <button 
            onClick={onComplete} 
            className="p-1.5 hover:bg-theme-main rounded-full transition-colors relative z-20 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1 space-y-0 no-scrollbar">
          {/* Amount Input with Type Selector */}
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="flex flex-col bg-theme-main p-0.5 rounded-xl shrink-0 w-18 border border-theme-base">
              <button type="button" onClick={() => setType('expense')} className={cn("py-0.5 rounded-lg font-bold text-[10px] transition-all", type === 'expense' ? "bg-theme-surface text-theme-primary shadow-sm" : "text-theme-muted")}>Расход</button>
              <button type="button" onClick={() => setType('income')} className={cn("py-0.5 rounded-lg font-bold text-[10px] transition-all", type === 'income' ? "bg-theme-surface text-theme-primary shadow-sm" : "text-theme-muted")}>Доход</button>
              <button type="button" onClick={() => setType('transfer')} className={cn("py-0.5 rounded-lg font-bold text-[10px] transition-all", type === 'transfer' ? "bg-theme-surface text-theme-primary shadow-sm" : "text-theme-muted")}>Перевод</button>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-bold text-center w-32 outline-none bg-transparent text-theme-main focus:ring-0 transition-all"
                placeholder="0"
                autoFocus
              />
              <span className="absolute -right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-theme-muted">₽</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Описание</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Комментарий"
                className="w-full bg-theme-main border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Дата</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-theme-main border-none rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main"
                />
              </div>
            </div>
          </div>

          <AccountSelect 
            accounts={activeAccounts} 
            selectedAccountId={selectedAccountId} 
            onChange={setSelectedAccountId} 
            label="Счет" 
            transactions={transactions}
            type={type}
          />

          <div className="space-y-1 p-2">
            <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">
              {type === 'transfer' ? 'Счет получатель' : 'Категория'}
            </label>
            {type === 'transfer' ? (
              <AccountSelect 
                accounts={activeAccounts.filter(a => a.id !== selectedAccountId)} 
                selectedAccountId={selectedTargetAccountId} 
                onChange={setSelectedTargetAccountId} 
                label="" 
                transactions={transactions}
                type={type}
              />
            ) : (
              <div className="h-100 rounded-xl flex overflow-hidden bg-theme-main border border-theme-base">
                <div className="w-1/3 overflow-y-auto no-scrollbar border-r border-theme-base">
                  {categories.filter(c => c.type === type && !c.parentId).sort((a, b) => {
                    const aOrder = a.sortOrder ?? Infinity;
                    const bOrder = b.sortOrder ?? Infinity;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    return (a.name || '').localeCompare(b.name || '');
                  }).map(cat => (
                    <button key={cat.id} type="button" onClick={() => { setActiveParentId(cat.id); setSelectedCategoryId(cat.id); }} className={cn("w-full text-left px-2 py-2 text-[11px] font-bold transition-all flex items-center gap-2", activeParentId === cat.id ? "bg-theme-surface text-theme-primary shadow-sm" : "text-theme-muted hover:bg-theme-primary/5")}>
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
                <div className="w-2/3 overflow-y-auto no-scrollbar bg-theme-surface p-1">
                  <div className="grid grid-cols-2 gap-1">
                    {categories.filter(c => c.type === type && c.parentId === activeParentId).sort((a, b) => {
                      const aOrder = a.sortOrder ?? Infinity;
                      const bOrder = b.sortOrder ?? Infinity;
                      if (aOrder !== bOrder) return aOrder - bOrder;
                      return (a.name || '').localeCompare(b.name || '');
                    }).map(sub => (
                      <button key={sub.id} type="button" onClick={() => setSelectedCategoryId(sub.id)} className={cn("w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border", selectedCategoryId === sub.id ? "bg-theme-primary/10 border-theme-primary text-theme-primary font-bold" : "text-theme-muted border-transparent hover:bg-theme-main")}>{sub.name}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 flex gap-2 shrink-0 border-t border-theme-base">
          <button onClick={onComplete} className="w-12 h-12 flex items-center justify-center bg-theme-main text-theme-muted rounded-xl hover:bg-theme-base transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !amount || (type !== 'transfer' && !selectedCategoryId)}
            className="flex-1 flex items-center justify-center gap-2 bg-theme-primary text-theme-on-primary font-bold py-3 rounded-xl shadow-md shadow-theme-primary/20 hover:bg-theme-primary-dark transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <div className="w-5 h-5 border-2 border-theme-on-primary/30 border-t-theme-on-primary rounded-full animate-spin" /> : <Check className="w-5 h-5" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
