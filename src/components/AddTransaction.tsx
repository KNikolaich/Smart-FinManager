import { useState } from 'react';
import { api } from '../lib/api';
import { Account, Category, TransactionType } from '../types';
import { X, ArrowRightLeft } from 'lucide-react';

interface AddTransactionProps {
  accounts: Account[];
  categories: Category[];
  onComplete: () => void;
}

export default function AddTransaction({ accounts, categories, onComplete }: AddTransactionProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const activeAccounts = accounts.filter(a => !a.isArchived);

  // Reset active parent when type changes
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setSelectedCategoryId('');
    setActiveParentId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !selectedAccountId) return;
    if (type !== 'transfer' && !selectedCategoryId) return;
    if (type === 'transfer' && selectedAccountId === selectedTargetAccountId) return;

    setLoading(true);
    try {
      const numAmount = parseFloat(amount);
      const now = new Date();
      const selectedDate = new Date(date);
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const transactionData: any = {
        accountId: selectedAccountId,
        amount: numAmount,
        type,
        description: description || (type === 'transfer' ? 'Перевод' : ''),
        createdAt: selectedDate.toISOString()
      };

      if (type === 'transfer') {
        transactionData.targetAccountId = selectedTargetAccountId;
      } else {
        transactionData.categoryId = selectedCategoryId;
      }

      await api.post('/transactions', transactionData);
      onComplete();
    } catch (error) {
      console.error('Error adding transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);
  
  const getPlaceholder = () => {
    switch (type) {
      case 'expense': return 'На что потратили?';
      case 'income': return 'Откуда доход?';
      case 'transfer': return 'Комментарий к переводу';
      default: return 'Описание';
    }
  };

  return (
    <div className="p-2 sm:p-3 lg:p-4 h-full flex flex-col overflow-hidden bg-white">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        {/* Top Section: Type + Amount */}
        <div className="flex items-center gap-3 py-2 shrink-0">
          {/* Type Selector (Left) */}
          <div className="flex flex-col bg-neutral-100 p-0.5 rounded-xl shrink-0 w-20">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={cn(
                "py-1.5 rounded-lg font-bold text-[10px] transition-all",
                type === 'expense' ? "bg-white text-rose-500 shadow-sm" : "text-neutral-500"
              )}
            >
              Расход
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={cn(
                "py-1.5 rounded-lg font-bold text-[10px] transition-all",
                type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500"
              )}
            >
              Доход
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('transfer')}
              className={cn(
                "py-1.5 rounded-lg font-bold text-[10px] transition-all",
                type === 'transfer' ? "bg-white text-blue-600 shadow-sm" : "text-neutral-500"
              )}
            >
              Перевод
            </button>
          </div>

          {/* Amount Input (Right) */}
          <div className="flex-1 flex items-center justify-center relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="text-4xl font-bold text-center w-full bg-transparent outline-none focus:ring-0 transition-all placeholder:text-neutral-200"
              autoFocus
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-neutral-400">₽</span>
          </div>
        </div>

        {/* Account & Date Section */}
        <div className="flex gap-2 py-2 shrink-0">
          <div className="flex-1 space-y-0.5">
            <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider ml-1">
              {type === 'transfer' ? 'Счет списания' : 'Счет'}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-neutral-50 border-none rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 ring-emerald-500/20 transition-all appearance-none"
            >
              {activeAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.balance.toLocaleString()} ₽)
                </option>
              ))}
            </select>
          </div>
          
          <div className="w-32 space-y-0.5">
            <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Дата</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-neutral-50 border-none rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 ring-emerald-500/20 transition-all"
            />
          </div>
        </div>

        {type === 'transfer' && (
          <div className="space-y-0.5 shrink-0 py-1">
            <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Счет зачисления</label>
            <select
              value={selectedTargetAccountId}
              onChange={(e) => setSelectedTargetAccountId(e.target.value)}
              className="w-full bg-neutral-50 border-none rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 ring-blue-500/20 transition-all appearance-none"
            >
              {activeAccounts.filter(a => a.id !== selectedAccountId).map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.balance.toLocaleString()} ₽)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Main Content: Categories (Scrollable) */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 py-2">
          {type !== 'transfer' && (
            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider ml-1 mb-1">Категория</label>
              <div className="flex-1 overflow-hidden rounded-xl flex bg-neutral-50/50">
                {/* Parents */}
                <div className="w-1/2 overflow-y-auto bg-neutral-50/50 no-scrollbar">
                  {categories.filter(c => c.type === type && !c.parentId).map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveParentId(cat.id);
                        setSelectedCategoryId(cat.id);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-2 text-[11px] font-bold transition-all",
                        activeParentId === cat.id
                          ? "bg-white text-emerald-600 shadow-sm"
                          : "text-neutral-600 hover:bg-neutral-100/50"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                {/* Children */}
                <div className="w-1/2 overflow-y-auto no-scrollbar bg-white">
                  {categories
                    .filter(c => c.type === type && c.parentId === activeParentId)
                    .map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(sub.id);
                          setDescription(`${sub.name}: `);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-2 text-[11px] font-medium transition-all",
                          selectedCategoryId === sub.id
                            ? "bg-emerald-50 text-emerald-700 font-bold"
                            : "text-neutral-600 hover:bg-neutral-100/50"
                        )}
                      >
                        {sub.name}
                      </button>
                    ))}
                  {activeParentId && categories.filter(c => c.type === type && c.parentId === activeParentId).length === 0 && (
                    <div className="p-4 text-center text-[9px] text-neutral-400 italic">
                      Нет подкатегорий
                    </div>
                  )}
                  {!activeParentId && (
                    <div className="p-4 text-center text-[9px] text-neutral-400 italic">
                      Выберите категорию
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Section: Description & Buttons (Sticky) */}
        <div className="shrink-0 pt-2 bg-white">
          <div className="space-y-0.5">
            <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider ml-1">Описание</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full bg-neutral-50 border-none rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 ring-emerald-500/20 transition-all"
            />
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onComplete}
              className="flex-1 bg-neutral-100 text-neutral-600 font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs"
            >
              <X className="w-3.5 h-3.5" />
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !amount || (type !== 'transfer' && !selectedCategoryId)}
              className={cn(
                "flex-[2] text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none text-xs",
                type === 'expense' ? "bg-rose-500 shadow-rose-100" : type === 'income' ? "bg-emerald-500 shadow-emerald-100" : "bg-blue-500 shadow-blue-100"
              )}
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Готово'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
