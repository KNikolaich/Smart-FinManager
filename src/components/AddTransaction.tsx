import { useState } from 'react';
import { db, handleFirestoreError } from '../firebase';
import { collection, addDoc, updateDoc, doc, increment, writeBatch } from 'firebase/firestore';
import { Account, Category, TransactionType, OperationType } from '../types';
import { X, Plus, CreditCard, Wallet as WalletIcon, Landmark, ArrowRightLeft, Tag } from 'lucide-react';

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
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const activeAccounts = accounts.filter(a => !a.isArchived);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Попытка отправки формы:', { type, amount, selectedAccountId, selectedCategoryId });
    
    if (!amount || !selectedAccountId) return;
    if (type !== 'transfer' && !selectedCategoryId) return;
    if (type === 'transfer' && selectedAccountId === selectedTargetAccountId) return;

    setLoading(true);
    try {
      const numAmount = parseFloat(amount);
      
      // Дополнительная проверка типа (DO_TYPE)
      const transactionType = type; // 'income' | 'expense' | 'transfer'
      if (!['income', 'expense', 'transfer'].includes(transactionType)) {
        throw new Error(`Некорректный тип транзакции: ${transactionType}`);
      }
      
      console.log('Создание транзакции:', {
        type: transactionType,
        amount: numAmount,
        categoryId: selectedCategoryId,
        accountId: selectedAccountId
      });

      if (type === 'transfer') {
        const batch = writeBatch(db);
        const sourceRef = doc(db, 'accounts', selectedAccountId);
        const targetRef = doc(db, 'accounts', selectedTargetAccountId);
        
        batch.update(sourceRef, { balance: increment(-numAmount) });
        batch.update(targetRef, { balance: increment(numAmount) });
        
        const sourceAcc = accounts.find(a => a.id === selectedAccountId);
        const targetAcc = accounts.find(a => a.id === selectedTargetAccountId);

        const transactionData = {
          userId: sourceAcc?.userId,
          accountId: selectedAccountId,
          targetAccountId: selectedTargetAccountId,
          amount: numAmount,
          type: 'transfer',
          description: description || `Перевод: ${sourceAcc?.name} -> ${targetAcc?.name}`,
          createdAt: new Date().toISOString()
        };

        const transRef = doc(collection(db, 'transactions'));
        batch.set(transRef, transactionData);

        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'accounts (batch transfer)');
        }
      } else {
        const transactionData = {
          userId: accounts.find(a => a.id === selectedAccountId)?.userId,
          accountId: selectedAccountId,
          categoryId: selectedCategoryId,
          amount: numAmount,
          type,
          description,
          createdAt: new Date().toISOString()
        };

        try {
          await addDoc(collection(db, 'transactions'), transactionData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'transactions');
        }
        
        const accountRef = doc(db, 'accounts', selectedAccountId);
        try {
          await updateDoc(accountRef, {
            balance: increment(type === 'income' ? numAmount : -numAmount)
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `accounts/${selectedAccountId}`);
        }
      }

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
    <div className="p-1.5 sm:p-2 lg:p-4 h-full flex flex-col overflow-hidden">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 px-0.5">
          {/* Type Toggle */}
          <div className="flex bg-neutral-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 py-1.5 rounded-md font-bold text-xs transition-all",
                type === 'expense' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              )}
            >
              Расход
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 py-1.5 rounded-md font-bold text-xs transition-all",
                type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500"
              )}
            >
              Доход
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={cn(
                "flex-1 py-1.5 rounded-md font-bold text-xs transition-all",
                type === 'transfer' ? "bg-white text-blue-600 shadow-sm" : "text-neutral-500"
              )}
            >
              Перевод
            </button>
          </div>

          {/* Amount Input */}
          <div className="flex items-center justify-center gap-2 py-1">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="text-3xl font-bold text-right w-32 bg-transparent outline-none placeholder:text-neutral-200"
              autoFocus
            />
            <span className="text-3xl font-bold text-neutral-400">₽</span>
          </div>

          {/* Account Selection - Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              {type === 'transfer' ? 'Счет списания' : 'Счет'}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full bg-white border border-neutral-100 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 transition-all appearance-none"
            >
              {activeAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.balance.toLocaleString()} ₽)
                </option>
              ))}
            </select>
          </div>

          {type === 'transfer' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Счет зачисления</label>
              <select
                value={selectedTargetAccountId}
                onChange={(e) => setSelectedTargetAccountId(e.target.value)}
                className="w-full bg-white border border-neutral-100 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 transition-all appearance-none"
              >
                {activeAccounts.filter(a => a.id !== selectedAccountId).map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.balance.toLocaleString()} ₽)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* Category Selection - 2 Column Table */
            <div className="space-y-1 flex-1 flex flex-col min-h-0">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Категория</label>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5">
                {filteredCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setDescription(`${cat.name}: `);
                    }}
                    className={cn(
                      "flex items-center gap-2 p-1.5 rounded-md transition-all border text-left",
                      selectedCategoryId === cat.id ? "border-emerald-500 bg-emerald-50" : "border-neutral-50"
                    )}
                  >
                    <span className="text-lg shrink-0">{cat.icon}</span>
                    <span className={cn(
                      "text-sm leading-tight font-medium line-clamp-2",
                      selectedCategoryId === cat.id ? "text-emerald-700 font-bold" : "text-neutral-600"
                    )}>
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1 mt-2">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Описание</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full bg-white border border-neutral-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        <div className="flex gap-3 mt-3 pt-1 pb-1 shrink-0">
          <button
            type="button"
            onClick={onComplete}
            className="flex-1 bg-neutral-100 text-neutral-600 font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
          >
            <X className="w-4 h-4" />
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading || !amount || (type !== 'transfer' && !selectedCategoryId)}
            className={cn(
              "flex-[2] text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none text-sm",
              type === 'expense' ? "bg-rose-500 shadow-rose-100" : type === 'income' ? "bg-emerald-500 shadow-emerald-100" : "bg-blue-500 shadow-blue-100"
            )}
          >
            {loading ? '...' : 'Готово'}
          </button>
        </div>
      </form>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
