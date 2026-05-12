import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Transaction, Account, Category, TransactionType } from '../types';
import { X, Check, Calculator as CalcIcon, Calendar, ChevronDown, Eye, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import AccountSelect from './AccountSelect';
import CategorySelect from './CategorySelect';
import Calculator from './Calculator';
import InteractiveMarkdown from './ui/InteractiveMarkdown';

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
  const [amount, setAmount] = useState(() => {
    if (initialData?.amount === undefined || initialData?.amount === null) return '';
    return String(initialData.amount);
  });
  const [selectedAccountId, setSelectedAccountId] = useState(initialData?.accountId || accounts.find(a => !a.isArchived)?.id || accounts[0]?.id || '');
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState(initialData?.targetAccountId || accounts.find(a => !a.isArchived && a.id !== initialData?.accountId)?.id || accounts[1]?.id || accounts[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.categoryId || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(initialData?.createdAt ? format(new Date(initialData.createdAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showPreview, setShowPreview] = useState(!!initialData?.description);
  const activeAccounts = accounts.filter(a => !a.isArchived);

  const prevType = useRef<TransactionType>(type);

  // Reset category when switching between income/expense
  useEffect(() => {
    // Only reset category if type actually changed from the previous state
    // and it's not the initial mount
    if (prevType.current !== type) {
      setSelectedCategoryId('');
      prevType.current = type;
    }
  }, [type]);

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
    <div className="fixed inset-0 z-[120] flex items-stretch lg:items-center justify-center p-0 lg:p-8 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-theme-surface overflow-hidden shadow-2xl flex flex-col relative h-full lg:h-auto lg:max-h-[90vh] animate-in slide-in-from-bottom duration-300 lg:rounded-2xl">
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

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 shrink-0 bg-theme-surface p-1.5 border-b border-theme-base">
            <div className="flex gap-1 bg-theme-main p-1 rounded-xl">
              <button type="button" onClick={() => setType('expense')} className={cn("flex-1 py-1 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all", type === 'expense' ? "bg-theme-surface shadow-sm text-theme-primary" : "text-theme-muted")}>Расход</button>
              <button type="button" onClick={() => setType('income')} className={cn("flex-1 py-1 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all", type === 'income' ? "bg-theme-surface shadow-sm text-theme-primary" : "text-theme-muted")}>Доход</button>
              <button type="button" onClick={() => setType('transfer')} className={cn("flex-1 py-1 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all", type === 'transfer' ? "bg-theme-surface shadow-sm text-theme-primary" : "text-theme-muted")}>Перевод</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar flex flex-col">
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
              <div className={cn("grid gap-3 transition-all", type === 'transfer' ? "grid-cols-2" : "grid-cols-1")}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">{type === 'transfer' ? 'Откуда' : 'Счет'}</label>
                  <AccountSelect 
                    accounts={activeAccounts} 
                    selectedAccountId={selectedAccountId} 
                    onChange={setSelectedAccountId} 
                    label="" 
                    transactions={transactions}
                    type={type}
                  />
                </div>
                {type === 'transfer' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Куда</label>
                    <AccountSelect 
                      accounts={activeAccounts.filter(a => a.id !== selectedAccountId)} 
                      selectedAccountId={selectedTargetAccountId} 
                      onChange={setSelectedTargetAccountId} 
                      label="" 
                      transactions={transactions}
                      type={type}
                    />
                  </div>
                )}
              </div>

              {type !== 'transfer' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">Категория</label>
                  <CategorySelect
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onChange={setSelectedCategoryId}
                    type={type}
                  />
                </div>
              )}
            </div>

            {/* Description - Grows to fill space */}
            <div className="flex-1 flex flex-col min-h-[100px] gap-2">
              <div className="flex items-center justify-between ml-1 shrink-0">
                <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Описание</label>
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1 text-[10px] font-bold text-theme-primary uppercase tracking-widest hover:opacity-80 transition-opacity"
                >
                  {showPreview ? <Edit2 size={10} /> : <Eye size={10} />}
                  {showPreview ? 'Редактировать' : 'Предпросмотр'}
                </button>
              </div>
              
              {showPreview ? (
                <div className="flex-1 w-full bg-theme-main border border-theme-base rounded-2xl px-5 py-4 text-sm text-theme-main overflow-y-auto markdown-body prose-sm">
                  <InteractiveMarkdown content={description} onUpdate={setDescription} />
                </div>
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Что купили или за что оплатили?..."
                  className="flex-1 w-full bg-theme-main border border-theme-base rounded-2xl px-5 py-4 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main resize-none font-medium placeholder:text-theme-muted/50"
                />
              )}
            </div>
          </div>
        </div>

        <div className="p-4 flex gap-3 shrink-0 border-t border-theme-base bg-theme-surface/80 backdrop-blur-md">
          <button onClick={onComplete} className="w-14 h-14 flex items-center justify-center bg-theme-main text-theme-muted rounded-2xl hover:bg-theme-base transition-colors shrink-0 border border-theme-base">
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !amount || (type !== 'transfer' && !selectedCategoryId)}
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

