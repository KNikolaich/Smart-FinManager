import { useState, useMemo } from 'react';
import { db, handleFirestoreError } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Account, AccountType, OperationType } from '../types';
import { X, Plus, Trash2, Check, CreditCard, Wallet as WalletIcon, Landmark, Coins } from 'lucide-react';

interface AccountManagerProps {
  accounts: Account[];
  userId: string;
  onClose: () => void;
}

export default function AccountManager({ accounts, userId, onClose }: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('card');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('₽');
  const [showOnDashboard, setShowOnDashboard] = useState(true);
  const [showInTotals, setShowInTotals] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      card: [],
      credit: [],
      cash: [],
      bank: []
    };
    accounts.forEach(acc => groups[acc.type].push(acc));
    return groups;
  }, [accounts]);

  const resetForm = () => {
    setName('');
    setType('card');
    setBalance('');
    setCurrency('₽');
    setShowOnDashboard(true);
    setShowInTotals(true);
    setIsArchived(false);
    setConfirmDeleteId(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'accounts'), {
        userId,
        name,
        type,
        balance: parseFloat(balance),
        currency,
        showOnDashboard,
        showInTotals,
        isArchived
      });
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!name || !balance) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'accounts', id), {
        name,
        type,
        balance: parseFloat(balance),
        currency,
        showOnDashboard,
        showInTotals,
        isArchived
      });
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `accounts/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'accounts', id));
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `accounts/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance.toString());
    setCurrency(acc.currency);
    setShowOnDashboard(acc.showOnDashboard ?? true);
    setShowInTotals(acc.showInTotals ?? true);
    setIsArchived(acc.isArchived ?? false);
    setIsAdding(false);
  };

  const getIcon = (type: AccountType) => {
    switch (type) {
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'credit': return <WalletIcon className="w-4 h-4" />;
      case 'bank': return <Landmark className="w-4 h-4" />;
      case 'cash': return <Coins className="w-4 h-4" />;
    }
  };

  const getTypeName = (type: AccountType) => {
    switch (type) {
      case 'card': return 'Карта';
      case 'bank': return 'Банк';
      case 'cash': return 'Наличные';
      case 'credit': return 'Кредит';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold">Управление счетами</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <p className="text-neutral-500 text-sm">Всего счетов: {accounts.length}</p>
            {!isAdding && !editingId && (
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-600 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            )}
          </div>

          {isAdding && (
            <form onSubmit={handleAdd} className="bg-neutral-50 p-6 rounded-2xl mb-6 space-y-4">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" placeholder="Название счета" required />
              <select value={type} onChange={(e) => setType(e.target.value as AccountType)} className="w-full border rounded-lg p-2 text-sm">
                <option value="card">Карта</option>
                <option value="credit">Кредит</option>
                <option value="cash">Наличные</option>
                <option value="bank">Банк</option>
              </select>
              <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full border rounded-lg p-2 text-sm" placeholder="Начальный баланс" required />
              <div className="flex items-center gap-6 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={showOnDashboard} onChange={(e) => setShowOnDashboard(e.target.checked)} /> На главном</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={showInTotals} onChange={(e) => setShowInTotals(e.target.checked)} /> В суммах</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} /> Архив</label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-neutral-200 text-neutral-600 rounded-lg text-sm">Отмена</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold">
                  {loading ? '...' : 'Сохранить'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-6">
            {(['card', 'credit', 'cash', 'bank'] as AccountType[]).map(type => (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-500 pb-2 border-b border-neutral-100">
                  {getIcon(type)}
                  <span className="text-xs font-bold uppercase tracking-wider">{getTypeName(type)}</span>
                </div>
                
                {groupedAccounts[type].map(acc => (
                  <div key={acc.id} onClick={() => startEditing(acc)} className="p-4 hover:bg-neutral-50 rounded-2xl cursor-pointer transition-colors">
                    {editingId === acc.id ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono uppercase tracking-wider">
                          <span className="bg-neutral-100 px-1.5 py-0.5 rounded">ID: {acc.id}</span>
                          <span className="bg-neutral-100 px-1.5 py-0.5 rounded">TYPE: {acc.type}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="border rounded-lg p-2 text-sm" placeholder="Название" />
                          <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} className="border rounded-lg p-2 text-sm" placeholder="Баланс" />
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={showOnDashboard} onChange={(e) => setShowOnDashboard(e.target.checked)} /> На главном</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={showInTotals} onChange={(e) => setShowInTotals(e.target.checked)} /> В суммах</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} /> Архив</label>
                        </div>
                        <div className="flex justify-end gap-2">
                          {confirmDeleteId === acc.id ? (
                            <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-lg border border-rose-100">
                              <span className="text-[10px] text-rose-600 font-bold uppercase">Удалить?</span>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }} className="p-1 bg-rose-500 text-white rounded hover:bg-rose-600"><Check className="w-3 h-3" /></button>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="p-1 bg-neutral-200 text-neutral-600 rounded hover:bg-neutral-300"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleUpdate(acc.id); }} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(acc.id); }} className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); resetForm(); }} className="p-2 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300 transition-colors"><X className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">{acc.name}</span>
                        <span className="font-bold text-sm">{acc.balance.toLocaleString()} {acc.currency}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
