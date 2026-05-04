import { useState } from 'react';
import { api } from '../lib/api';
import { Transaction, Account, Category } from '../types';
import { X, Trash2, Check, Calculator as CalcIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import AccountSelect from './AccountSelect';
import Calculator from './Calculator';

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
  const [showCalculator, setShowCalculator] = useState(false);
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
    <div className="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-theme-surface overflow-hidden shadow-2xl flex flex-col relative h-full animate-in slide-in-from-bottom duration-300">
        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[130] bg-theme-surface/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-theme-main mb-2">Удалить операцию?</h3>
            <p className="text-theme-muted mb-8 text-sm">Это действие нельзя будет отменить. Баланс счета будет автоматически пересчитан.</p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={handleDelete}
                disabled={loading}
                className="w-full bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? "Удаление..." : "Да, удалить"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
                className="w-full bg-theme-main text-theme-muted font-bold py-4 rounded-2xl hover:bg-theme-base transition-all active:scale-95"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-1 flex items-center justify-between shrink-0 relative z-10 border-b border-theme-base">
          <h2 className="text-base font-bold text-theme-main capitalize">
            {transaction.type === 'income' ? 'Доход' : transaction.type === 'expense' ? 'Расход' : 'Перевод'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-theme-main rounded-full transition-colors relative z-20 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1 space-y-1 no-scrollbar">
          {error && (
            <div className="mx-4 mt-2 p-3 bg-rose-500/10 text-rose-600 text-xs font-bold rounded-xl animate-in fade-in slide-in-from-top-2 duration-200 border border-rose-500/20">
              {error}
            </div>
          )}
          
          {/* Row 1: Amount and Date */}
          <div className="grid grid-cols-2 gap-2 p-1">
            {/* Amount Input */}
            <div className="bg-theme-main rounded-xl p-1 flex items-center justify-center border border-theme-base min-h-[60px]">
              <div className="relative flex items-center gap-1 group w-full justify-between">
                <div className="flex-1 flex items-center justify-end gap-1 overflow-hidden">
                  <input
                    type="text"
                    value={amount === '' ? '' : Number(amount.replace(/\s/g, '')).toLocaleString('ru-RU').replace(',', '.').split('.')[0]}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\s/g, '');
                      if (/^\d*$/.test(val)) {
                        setAmount(val);
                      }
                    }}
                    className={cn(
                      "font-bold text-right outline-none bg-transparent text-theme-main focus:ring-0 transition-all pr-1 w-full",
                      amount.length > 7 ? "text-lg" : amount.length > 5 ? "text-xl" : "text-2xl"
                    )}
                    placeholder="0"
                    autoFocus
                    inputMode="numeric"
                  />
                  <span className="text-xl font-bold text-theme-muted shrink-0">₽</span>
                </div>

                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    setShowCalculator(true);
                  }}
                  className="p-1.5 bg-theme-surface text-theme-muted rounded-lg hover:text-theme-primary transition-all border border-theme-base shadow-sm shrink-0"
                  title="Калькулятор"
                  type="button"
                >
                  <CalcIcon size={14} />
                </button>

                {showCalculator && (
                  <div className="absolute top-full right-0 mt-4 z-[150]">
                    <Calculator 
                      initialValue={amount}
                      onConfirm={(val) => {
                        setAmount(val);
                        setShowCalculator(false);
                      }}
                      onCancel={() => setShowCalculator(false)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Date Input */}
            <div className="bg-theme-main rounded-xl p-1 flex flex-col justify-center border border-theme-base min-h-[60px]">
              <label className="text-[9px] font-bold text-theme-muted uppercase tracking-widest mb-1 ml-1 text-center">Дата</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-theme-surface border-none rounded-xl px-2 py-2 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main font-bold text-center"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Description and Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
            {/* Description */}
            <div className="">
              <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Описание</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Комментарий"
                className="w-full bg-theme-main border border-theme-base rounded-xl px-4 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main"
              />
            </div>

            {/* Account */}
            <div className="">
              <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Счет</label>
              <AccountSelect 
                accounts={accounts.filter(a => !a.isArchived || a.id === transaction.accountId)} 
                selectedAccountId={selectedAccountId} 
                onChange={setSelectedAccountId} 
                label="" 
                transactions={transactions}
                type={transaction.type}
              />
            </div>
          </div>

          <div className="p-1">
            <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">
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
              <div className="h-100 rounded-xl flex overflow-hidden bg-theme-main border border-theme-base">
                <div className="w-1/3 overflow-y-auto no-scrollbar border-r border-theme-base">
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
                        "w-full text-left px-2 py-1.5 text-[11px] font-bold transition-all flex items-center gap-2",
                        activeParentId === cat.id
                          ? "bg-theme-surface text-theme-primary shadow-sm"
                          : "text-theme-muted hover:bg-theme-primary/5"
                      )}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
                <div className="w-2/3 overflow-y-auto no-scrollbar bg-theme-surface p-1">
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
                            "w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border border-transparent border-b-theme-base/20",
                            selectedCategoryId === sub.id
                              ? "bg-theme-primary/10 border-theme-primary text-theme-primary font-bold"
                              : "text-theme-muted hover:bg-theme-main"
                          )}
                        >
                          {sub.name}
                        </button>
                      ))}
                  </div>
                  {categories.filter(c => c.type === transaction.type && c.parentId === activeParentId).length === 0 && (
                    <div className="p-4 text-center text-[10px] text-theme-muted italic">
                      Нет подкатегорий
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 flex gap-2 shrink-0 border-t border-theme-base">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="w-12 h-12 flex items-center justify-center bg-rose-500/10 text-rose-600 rounded-xl hover:bg-rose-500/20 transition-colors shrink-0"
            title="Удалить"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading}
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
