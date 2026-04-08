import { useState } from 'react';
import { api } from '../lib/api';
import { Transaction, Account, Category } from '../types';
import { X, Trash2, Check, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import AccountSelect from './AccountSelect';

interface EditTransactionProps {
  transaction: Transaction;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditTransaction({ transaction, accounts, transactions, categories, onClose, onUpdate }: EditTransactionProps) {
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [description, setDescription] = useState(transaction.description);
  const [selectedAccountId, setSelectedAccountId] = useState(transaction.accountId);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState(transaction.targetAccountId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(transaction.categoryId || '');
  
  const initialCategory = categories.find(c => c.id === transaction.categoryId);
  const [activeParentId, setActiveParentId] = useState<string | null>(
    initialCategory?.parentId || transaction.categoryId || null
  );

  const [date, setDate] = useState(format(new Date(transaction.createdAt), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    if (!amount || isNaN(Number(amount))) return;
    setLoading(true);
    setError(null);

    const now = new Date();
    const originalDate = new Date(transaction.createdAt);
    const selectedDate = new Date(date);
    let finalCreatedAt = selectedDate.toISOString();

    // If date string is the same as the original, keep original time
    if (format(originalDate, 'yyyy-MM-dd') === date) {
      finalCreatedAt = originalDate.toISOString();
    } else if (format(now, 'yyyy-MM-dd') === date) {
      // If date was changed to today, use current time
      finalCreatedAt = now.toISOString();
    }

    try {
      await api.put(`/transactions/${transaction.id}`, {
        amount: Number(amount),
        description,
        accountId: selectedAccountId,
        targetAccountId: transaction.type === 'transfer' ? selectedTargetAccountId : null,
        categoryId: transaction.type !== 'transfer' ? selectedCategoryId : null,
        createdAt: finalCreatedAt,
        type: transaction.type
      });
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      setError(err.message || 'Ошибка при обновлении операции');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/transactions/${transaction.id}`);
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      setError(err.message || 'Ошибка при удалении операции');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white overflow-hidden shadow-2xl flex flex-col relative h-full animate-in slide-in-from-bottom duration-300">
        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[70] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Удалить операцию?</h3>
            <p className="text-neutral-500 mb-8 text-sm">Это действие нельзя будет отменить. Баланс счета будет автоматически пересчитан.</p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="w-full bg-rose-600 text-white font-bold py-1 rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "Удаление..." : "Да, удалить"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
                className="w-full bg-neutral-100 text-neutral-600 font-bold py-1 rounded-2xl hover:bg-neutral-200 transition-all active:scale-95"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-neutral-800 capitalize">
            {transaction.type === 'income' ? 'Доход' : transaction.type === 'expense' ? 'Расход' : 'Перевод'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1 space-y-1 no-scrollbar">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}
          {/* Amount Input */}
          <div className="flex items-center justify-center gap-2 py-0">
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-bold text-center w-32 outline-none bg-transparent text-neutral-900 focus:ring-0 transition-all"
                placeholder="0"
                autoFocus
              />
              <span className="absolute -right-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-neutral-400">₽</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            {/* Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Описание</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Комментарий"
                className="w-full bg-neutral-50 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all"
              />
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Дата</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-neutral-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Account Selection - Dropdown */}
          <AccountSelect 
            accounts={accounts.filter(a => !a.isArchived || a.id === transaction.accountId)} 
            selectedAccountId={selectedAccountId} 
            onChange={setSelectedAccountId} 
            label="Счет" 
            transactions={transactions}
            type={transaction.type}
          />

          {/* Category or Target Account Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">
              {transaction.type === 'transfer' ? 'Счет получатель' : 'Категория'}
            </label>
            {transaction.type === 'transfer' ? (
              <AccountSelect 
                accounts={accounts.filter(a => a.id !== selectedAccountId)} 
                selectedAccountId={selectedTargetAccountId} 
                onChange={setSelectedTargetAccountId} 
                label="" 
                transactions={transactions}
                type={transaction.type}
              />
            ) : (
              /* Compact Category Table */
              <div className="h-100 rounded-xl flex overflow-hidden bg-neutral-50/50 border border-neutral-100">
                {/* Parents */}
                <div className="w-1/3 overflow-y-auto bg-neutral-50/50 no-scrollbar border-r border-neutral-100">
                  {categories.filter(c => c.type === transaction.type && !c.parentId).sort((a, b) => {
                    const aOrder = a.sortOrder ?? Infinity;
                    const bOrder = b.sortOrder ?? Infinity;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    return (a.name || '').localeCompare(b.name || '');
                  }).map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveParentId(cat.id);
                        setSelectedCategoryId(cat.id);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-2 text-[11px] font-bold transition-all flex items-center gap-2",
                        activeParentId === cat.id
                          ? "bg-white text-theme-primary shadow-sm"
                          : "text-neutral-600 hover:bg-neutral-100/50"
                      )}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
                {/* Children */}
                <div className="w-2/3 overflow-y-auto no-scrollbar bg-white p-1">
                  <div className="grid grid-cols-2 gap-1">
                    {categories
                      .filter(c => c.type === transaction.type && c.parentId === activeParentId)
                      .sort((a, b) => {
                        const aOrder = a.sortOrder ?? Infinity;
                        const bOrder = b.sortOrder ?? Infinity;
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        return (a.name || '').localeCompare(b.name || '');
                      })
                      .map(sub => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(sub.id)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                            selectedCategoryId === sub.id
                              ? "bg-theme-primary-light border-theme-primary text-theme-primary-dark font-bold"
                              : "text-neutral-600 border-transparent hover:bg-neutral-50"
                          )}
                        >
                          {sub.name}
                        </button>
                      ))}
                  </div>
                  {categories.filter(c => c.type === transaction.type && c.parentId === activeParentId).length === 0 && (
                    <div className="p-4 text-center text-[10px] text-neutral-400 italic">
                      Нет подкатегорий
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 flex gap-2 shrink-0">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors shrink-0"
            title="Удалить"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-theme-primary text-white font-bold py-3 rounded-xl shadow-md shadow-theme-primary-light hover:bg-theme-primary-dark transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-5 h-5" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
