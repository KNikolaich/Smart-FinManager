import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Transaction, Account, Category, TransactionType } from '../types';
import { X, Trash2, Check, Calculator as CalcIcon, Calendar, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import AccountSelect from './AccountSelect';
import CategorySelect from './CategorySelect';
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
    <div className="fixed inset-0 z-[120] flex items-stretch lg:items-center justify-center p-0 lg:p-8 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-theme-surface overflow-hidden shadow-2xl flex flex-col relative h-full lg:h-auto lg:max-h-[90vh] animate-in slide-in-from-bottom duration-300 lg:rounded-2xl">
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

        <div className="px-6 py-3 flex items-center justify-between shrink-0 relative z-10 border-b border-theme-base">
          <h2 className="text-base font-bold text-theme-main">Изменение операции</h2>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-theme-main rounded-full transition-colors relative z-20 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar flex flex-col">
            {error && (
              <div className="p-3 bg-rose-500/10 text-rose-600 text-xs font-bold rounded-xl animate-in fade-in slide-in-from-top-2 duration-200 border border-rose-500/20 shrink-0">
                {error}
              </div>
            )}
            
            {/* Amount and Date */}
            <div className="grid grid-cols-5 gap-3 shrink-0">
               {/* Amount Input */}
               <div className="col-span-3 bg-theme-main rounded-2xl p-3 flex flex-col border border-theme-base min-h-[60px] justify-center">
                <div className="flex items-center gap-1 group w-full justify-between">                
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
                        "font-bold text-right bg-transparent outline-none text-theme-main focus:ring-0 transition-all pr-1 w-full",
                        amount.length > 8 ? "text-lg" : amount.length > 5 ? "text-xl" : "text-2xl"
                      )}
                      placeholder="0"
                      autoFocus
                      inputMode="numeric"
                    />
                    <span className="text-theme-muted shrink-0">₽</span>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      setShowCalculator(true);
                    }}
                    className="ml-2 bg-theme-surface text-theme-muted hover:text-theme-primary transition-all shadow-sm shrink-0"
                    title="Калькулятор"
                    type="button"
                  >
                    <CalcIcon size={18} className="text-theme-primary" />
                  </button>
                </div>
              </div>

              {/* Date Input */}
              <div className="col-span-2 bg-theme-main rounded-2xl flex flex-col justify-center border border-theme-base overflow-hidden relative group cursor-pointer hover:bg-theme-surface/50 transition-colors h-full">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full h-full"
                />
                <div className="text-center group-hover:opacity-80 transition-opacity relative z-10 pointer-events-none p-1">
                  <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest leading-none mb-1">Дата</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-sm font-black text-theme-main">{format(new Date(date), 'dd MMM')}</p>
                    <ChevronDown size={12} className="text-theme-muted" />
                  </div>
                </div>
              </div>
            </div>

            {/* Account Selection */}
            <div className="space-y-3 shrink-0">
              <div className={cn("grid gap-3 transition-all", transaction.type === 'transfer' ? "grid-cols-2" : "grid-cols-1")}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">{transaction.type === 'transfer' ? 'Откуда' : 'Счет'}</label>
                  <AccountSelect 
                    accounts={accounts.filter(a => !a.isArchived || a.id === transaction.accountId)} 
                    selectedAccountId={selectedAccountId} 
                    onChange={setSelectedAccountId} 
                    label="" 
                    transactions={transactions}
                    type={transaction.type}
                  />
                </div>
                {transaction.type === 'transfer' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Куда</label>
                    <AccountSelect 
                      accounts={accounts.filter(a => a.id !== selectedAccountId)} 
                      selectedAccountId={selectedTargetAccountId} 
                      onChange={setSelectedTargetAccountId} 
                      label="" 
                      transactions={transactions}
                      type={transaction.type}
                    />
                  </div>
                )}
              </div>

              {transaction.type !== 'transfer' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Категория</label>
                  <CategorySelect
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onChange={setSelectedCategoryId}
                    type={transaction.type}
                  />
                </div>
              )}
            </div>

            {/* Description - Grows to fill space */}
            <div className="flex-1 flex flex-col min-h-[100px] gap-2">
              <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1 shrink-0">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что изменилось в этой операции?..."
                className="flex-1 w-full bg-theme-main border border-theme-base rounded-2xl px-5 py-4 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main resize-none font-medium placeholder:text-theme-muted/50"
              />
            </div>
          </div>
        </div>

        <div className="p-4 flex gap-3 shrink-0 border-t border-theme-base bg-theme-surface/80 backdrop-blur-md">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading}
            className="w-14 h-14 flex items-center justify-center bg-rose-500/10 text-rose-600 rounded-2xl hover:bg-rose-500/20 transition-colors shrink-0 border border-rose-500/20"
            title="Удалить"
          >
            <Trash2 className="w-6 h-6" />
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading || !amount || (transaction.type !== 'transfer' && !selectedCategoryId)}
            className="flex-1 flex items-center justify-center gap-2 bg-theme-primary text-theme-on-primary font-black uppercase tracking-wider py-4 rounded-2xl shadow-lg shadow-theme-primary/20 hover:bg-theme-primary-dark transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? <div className="w-6 h-6 border-3 border-theme-on-primary/30 border-t-theme-on-primary rounded-full animate-spin" /> : <Check className="w-6 h-6" />}
            Сохранить
          </button>
        </div>
      </div>

      {showCalculator && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowCalculator(false)}>
          <div className="scale-125 lg:scale-150 transform-gpu" onClick={(e) => e.stopPropagation()}>
            <Calculator 
              initialValue={amount}
              onConfirm={(val) => {
                setAmount(val);
                setShowCalculator(false);
              }}
              onCancel={() => setShowCalculator(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

