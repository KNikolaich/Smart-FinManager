import { useState, useEffect, useRef } from 'react';
import { Account, Category, Currency } from '../types';
import { accountCurrencySymbol, defaultTransferRate, isCrossCurrency, isRubleAccount, formatAmount, formatAmountInputDisplay, rubleRateFromTransferAmounts, sourceAmountFromTarget, targetAmountFromSource } from '../lib/currencyUtils';
import { X, Trash2, Check, Calculator as CalcIcon, ChevronDown, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import AccountSelect from './AccountSelect';
import CategorySelect from './CategorySelect';
import Calculator from './Calculator';
import { updateOfflineQueueItem, removeOfflineQueueItem } from '../lib/api';

interface PendingTransaction {
  id: string;           // offline transaction id (e.g. "offline_abc123")
  queueItemId: string;  // queue item id used to locate and mutate the queue entry
  amount: number;
  targetAmount?: number | null;
  exchangeRate?: number | null;
  description: string;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string | null;
  createdAt: string;
  type: 'income' | 'expense' | 'transfer';
}

interface EditOfflineTransactionProps {
  transaction: PendingTransaction;
  accounts: Account[];
  categories: Category[];
  currencies: Currency[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditOfflineTransaction({
  transaction,
  accounts,
  categories,
  currencies,
  onClose,
  onUpdate,
}: EditOfflineTransactionProps) {
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [description, setDescription] = useState(transaction.description);
  const [selectedAccountId, setSelectedAccountId] = useState(transaction.accountId);
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState(transaction.targetAccountId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(transaction.categoryId || '');
  const [date, setDate] = useState(format(new Date(transaction.createdAt), 'yyyy-MM-dd'));
  const [showCalculator, setShowCalculator] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Cross-currency transfer state ---
  const sourceAccount = accounts.find(a => a.id === selectedAccountId);
  const targetAccount = accounts.find(a => a.id === selectedTargetAccountId);
  const crossCurrency = transaction.type === 'transfer' && isCrossCurrency(sourceAccount, targetAccount, currencies);
  const sourceSymbol = accountCurrencySymbol(sourceAccount, currencies);
  const targetSymbol = accountCurrencySymbol(targetAccount, currencies);
  const rateCurrencySymbol = isRubleAccount(targetAccount, currencies) ? sourceSymbol : targetSymbol;
  const [entrySide, setEntrySide] = useState<'source' | 'target'>('source');
  const [rate, setRate] = useState<string>(() => {
    const savedRubleRate = rubleRateFromTransferAmounts(transaction.amount, transaction.targetAmount, sourceAccount, targetAccount, currencies);
    return savedRubleRate != null ? String(savedRubleRate) : '';
  });
  const accountPairKey = `${selectedAccountId}|${selectedTargetAccountId}`;
  const prevPairKey = useRef(accountPairKey);
  useEffect(() => {
    if (prevPairKey.current !== accountPairKey) {
      prevPairKey.current = accountPairKey;
      setRate('');
    }
  }, [accountPairKey]);
  const effectiveRate = (() => {
    const manual = Number(String(rate).replace(',', '.'));
    if (rate !== '' && isFinite(manual) && manual > 0) return manual;
    return defaultTransferRate(sourceAccount, targetAccount, currencies);
  })();
  const numEntered = Number(amount);
  const sourceAmountNum = entrySide === 'source'
    ? numEntered
    : sourceAmountFromTarget(numEntered, sourceAccount, targetAccount, currencies, effectiveRate);
  const targetAmountNum = entrySide === 'source'
    ? targetAmountFromSource(numEntered, sourceAccount, targetAccount, currencies, effectiveRate)
    : numEntered;

  const handleSave = () => {
    if (!amount || isNaN(Number(amount))) return;
    setError(null);

    const now = new Date();
    const originalDate = new Date(transaction.createdAt);
    const selectedDate = new Date(date);
    let finalCreatedAt = selectedDate.toISOString();

    if (format(originalDate, 'yyyy-MM-dd') === date) {
      finalCreatedAt = originalDate.toISOString();
    } else if (format(now, 'yyyy-MM-dd') === date) {
      finalCreatedAt = now.toISOString();
    }

    const isConversion = transaction.type === 'transfer' && crossCurrency;
    const newData = {
      amount: isConversion ? sourceAmountNum : Number(amount),
      targetAmount: isConversion ? targetAmountNum : null,
      exchangeRate: isConversion ? effectiveRate : null,
      description,
      accountId: selectedAccountId,
      targetAccountId: transaction.type === 'transfer' ? selectedTargetAccountId : null,
      categoryId: transaction.type !== 'transfer' ? selectedCategoryId : null,
      createdAt: finalCreatedAt,
      type: transaction.type,
    };

    const ok = updateOfflineQueueItem(transaction.queueItemId, newData);
    if (!ok) {
      setError('Не удалось обновить операцию в очереди');
      return;
    }

    onUpdate();
    onClose();
  };

  const handleCancel = () => {
    const ok = removeOfflineQueueItem(transaction.queueItemId);
    if (!ok) {
      setError('Не удалось отменить операцию');
      return;
    }
    onUpdate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-stretch lg:items-center justify-center p-0 lg:p-8 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-theme-surface overflow-hidden shadow-2xl flex flex-col relative h-full lg:h-auto lg:max-h-[90vh] animate-in slide-in-from-bottom duration-300 lg:rounded-2xl">
        {/* Cancel Confirmation Overlay */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-[130] bg-theme-surface/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-theme-main mb-2">Отменить операцию?</h3>
            <p className="text-theme-muted mb-8 text-sm">
              Операция будет удалена из очереди и не будет отправлена на сервер.
              Оптимистичные изменения баланса будут отменены.
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={handleCancel}
                className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-500/20 hover:bg-amber-700 transition-all active:scale-95"
              >
                Да, отменить
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="w-full bg-theme-main text-theme-muted font-bold py-4 rounded-2xl hover:bg-theme-base transition-all active:scale-95"
              >
                Назад
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between shrink-0 relative z-10 border-b border-theme-base">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black uppercase text-theme-main drop-shadow-sm">
              {transaction.type === 'expense' ? 'Расход' : transaction.type === 'income' ? 'Доход' : 'Перевод'}
            </h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
              <WifiOff className="w-2.5 h-2.5 text-amber-500" />
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Офлайн</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 bg-theme-main/50 border border-theme-base text-theme-main rounded-xl shadow-md hover:bg-theme-main transition-all relative z-20 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
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
                      value={formatAmountInputDisplay(amount)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s/g, '').replace(',', '.');
                        if (/^\d*\.?\d*$/.test(val)) {
                          setAmount(val);
                        }
                      }}
                      className={cn(
                        "font-bold text-right bg-transparent outline-none text-theme-main focus:ring-0 transition-all pr-1 w-full",
                        amount.length > 8 ? "text-lg" : amount.length > 5 ? "text-xl" : "text-2xl"
                      )}
                      placeholder="0"
                      autoFocus
                      inputMode="decimal"
                    />
                    <span className="text-theme-muted shrink-0">
                      {transaction.type === 'transfer' ? (entrySide === 'source' ? sourceSymbol : targetSymbol) : sourceSymbol}
                    </span>
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
                  <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">
                    {transaction.type === 'transfer' ? 'Откуда' : 'Счет'}
                  </label>
                  <AccountSelect
                    accounts={accounts.filter(a => !a.isArchived || a.id === transaction.accountId)}
                    selectedAccountId={selectedAccountId}
                    onChange={setSelectedAccountId}
                    label=""
                    transactions={[]}
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
                      transactions={[]}
                      type={transaction.type}
                    />
                  </div>
                )}
              </div>

              {/* Cross-currency conversion panel */}
              {crossCurrency && (
                <div className="bg-theme-main rounded-2xl border border-theme-base p-3 space-y-3">
                  <div className="flex gap-1 bg-theme-surface p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEntrySide('source')}
                      className={cn("flex-1 py-1 px-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all", entrySide === 'source' ? "bg-theme-main shadow-sm text-theme-primary" : "text-theme-muted")}
                    >
                      Списываю ({sourceSymbol})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntrySide('target')}
                      className={cn("flex-1 py-1 px-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all", entrySide === 'target' ? "bg-theme-main shadow-sm text-theme-primary" : "text-theme-muted")}
                    >
                      Получаю ({targetSymbol})
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Курс (1 {rateCurrencySymbol} =)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={rate !== '' ? rate : String(Math.round(effectiveRate * 1e6) / 1e6)}
                          onChange={(e) => {
                            const val = e.target.value.replace(',', '.');
                            if (/^\d*\.?\d*$/.test(val)) setRate(val);
                          }}
                          className="w-full bg-transparent outline-none font-bold text-theme-main text-sm border-b border-theme-base focus:border-theme-primary transition-colors py-0.5"
                        />
                        <span className="text-theme-muted text-xs shrink-0">₽</span>
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">
                        {entrySide === 'source' ? 'Зачислится' : 'Спишется'}
                      </p>
                      <p className="text-sm font-black text-theme-main">
                        {amount && isFinite(numEntered)
                          ? (entrySide === 'source'
                              ? `${formatAmount(targetAmountNum)} ${targetSymbol}`
                              : `${formatAmount(sourceAmountNum)} ${sourceSymbol}`)
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

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

            {/* Description */}
            <div className="flex-1 flex flex-col min-h-[100px] gap-2">
              <div className="flex items-center justify-between ml-1 shrink-0">
                <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Описание</label>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание операции..."
                className="flex-1 w-full bg-theme-main border border-theme-base rounded-2xl px-5 py-4 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main resize-none font-medium placeholder:text-theme-muted/50"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 flex gap-3 shrink-0 border-t border-theme-base bg-theme-surface/80 backdrop-blur-md">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-14 h-14 flex items-center justify-center bg-amber-50/50 text-amber-500 rounded-xl hover:bg-amber-50 transition-all shrink-0 border border-amber-100 shadow-md active:scale-95"
            title="Отменить операцию"
          >
            <Trash2 className="w-6 h-6" />
          </button>
          <button
            onClick={handleSave}
            disabled={!amount || (transaction.type !== 'transfer' && !selectedCategoryId)}
            className="flex-1 flex items-center justify-center gap-2 bg-theme-primary text-theme-on-primary font-black uppercase tracking-wider py-4 rounded-2xl shadow-lg shadow-theme-primary/20 hover:bg-theme-primary-dark transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <Check className="w-6 h-6" />
            Сохранить
          </button>
        </div>

        {showCalculator && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCalculator(false)}
          >
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
    </div>
  );
}
