import { useState, useMemo, useEffect } from 'react';
import { api } from '../lib/api';
import { Account, AccountType, Currency } from '../types';
import { X, Plus, Trash2, Check, Pencil, ChevronDown } from 'lucide-react';
import { CoinStack } from './CustomIcons';
import { cn } from '../lib/utils';
import { currencyService } from '../services/currencyService';
import { getAccountIcon, getAccountTypeColor } from '../lib/accountUtils';

interface AccountManagerProps {
  accounts: Account[];
  userId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function AccountManager({ accounts, userId, onClose, onRefresh }: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('card');
  const [balance, setBalance] = useState('');
  const [currencyId, setCurrencyId] = useState<string | null>(null);
  const [color, setColor] = useState('#000000');
  const [showOnDashboard, setShowOnDashboard] = useState(true);
  const [showInTotals, setShowInTotals] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [isBalanceEditable, setIsBalanceEditable] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

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

  useEffect(() => {
    currencyService.getCurrencies().then(setCurrencies);
  }, []);

  const resetForm = () => {
    setName('');
    setType('card');
    setBalance('');
    setCurrencyId(null);
    setColor('#000000');
    setShowOnDashboard(true);
    setShowInTotals(true);
    setIsArchived(false);
    setConfirmDeleteId(null);
    setIsAdding(false);
    setEditingId(null);
    onRefresh?.();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    setLoading(true);
    try {
      await api.post('/accounts', {
        name,
        type,
        balance: parseFloat(balance),
        currencyId: currencyId || currencies.find(c => c.iso === 'RUB')?.id,
        color,
        showOnDashboard,
        showInTotals,
        isArchived
      });
      resetForm();
    } catch (error) {
      console.error('Error adding account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!name || !balance) return;
    setLoading(true);
    try {
      await api.put(`/accounts/${id}`, {
        name,
        type,
        balance: parseFloat(balance),
        currencyId,
        color,
        showOnDashboard,
        showInTotals,
        isArchived
      });
      resetForm();
    } catch (error) {
      console.error('Error updating account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/accounts/${id}`);
      resetForm();
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance.toString());
    setCurrencyId(acc.currencyId || null);
    setColor(acc.color || '#000000');
    setShowOnDashboard(acc.showOnDashboard ?? true);
    setShowInTotals(acc.showInTotals ?? true);
    setIsArchived(acc.isArchived ?? false);
    setIsAdding(false);
    setIsBalanceEditable(false);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-1 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="p-4 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold">Управление счетами</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
          <div className="flex justify-between items-center mb-6">
            <p className="text-neutral-500 text-sm">Всего счетов: {accounts.length}</p>
            {!isAdding && !editingId && (
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 bg-theme-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-theme-primary-dark transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            )}
          </div>

          {isAdding && (
            <form onSubmit={handleAdd} className="bg-neutral-100/50 p-6 rounded-2xl mb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value as AccountType)} 
                    className="w-full bg-white rounded-xl p-3 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all appearance-none"
                  >
                    <option value="card">Карта</option>
                    <option value="credit">Кредит</option>
                    <option value="cash">Наличные</option>
                    <option value="bank">Банк</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                </div>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="bg-white rounded-xl p-3 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all" 
                  placeholder="Название счета" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" 
                  value={balance} 
                  onChange={(e) => setBalance(e.target.value)} 
                  className="bg-white rounded-xl p-3 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all" 
                  placeholder="Начальный баланс" 
                  required 
                />
                <div className="flex gap-2 relative">
                  <select 
                    value={currencyId || ''} 
                    onChange={(e) => setCurrencyId(e.target.value)} 
                    className="flex-1 bg-white rounded-xl p-3 text-sm outline-none focus:ring-2 ring-emerald-500/20 transition-all appearance-none"
                  >
                    <option value="">Выберите валюту</option>
                    {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
                  </select>
                  <ChevronDown className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                  <div className="relative flex items-center gap-2 bg-white rounded-xl px-3">
                    <input 
                      type="color" 
                      value={color === '#000000' ? '#e5e5e5' : color} 
                      onChange={(e) => setColor(e.target.value)}
                      className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={showOnDashboard} onChange={(e) => setShowOnDashboard(e.target.checked)} /> На главном</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={showInTotals} onChange={(e) => setShowInTotals(e.target.checked)} /> В суммах</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} /> Архив</label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-neutral-200 text-neutral-600 rounded-lg text-sm">Отмена</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-theme-primary text-white rounded-lg text-sm font-bold">
                  {loading ? '...' : 'Сохранить'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {(['card', 'credit', 'cash', 'bank'] as AccountType[]).map(groupType => (
              <div key={groupType} className="space-y-1">
                <div className="flex items-center gap-2 text-neutral-400 px-2 py-1">
                  {getAccountIcon(groupType, "w-4 h-4")}
                  <span className="text-[10px] font-bold uppercase tracking-widest">{getTypeName(groupType)}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupedAccounts[groupType].map(acc => (
                    <div key={acc.id} onClick={() => !editingId && startEditing(acc)} className={cn(
                      "p-3 rounded-2xl transition-all border border-transparent",
                      editingId === acc.id ? "bg-neutral-50 border-neutral-200 shadow-inner col-span-full" : "bg-white border-neutral-100 hover:border-neutral-200 cursor-pointer shadow-sm"
                    )}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-600 shrink-0"
                            style={{ backgroundColor: acc.color && acc.color !== '#000000' ? `${acc.color}20` : '#f5f5f5' }}
                          >
                            <div style={{ color: acc.color && acc.color !== '#000000' ? acc.color : 'inherit' }}>
                              {getAccountIcon(acc.type, "w-4 h-4")}
                            </div>
                          </div>
                          <span className="font-bold text-xs text-neutral-900 truncate max-w-[120px]">{acc.name}</span>
                        </div>
                        <span className="font-bold text-xs text-neutral-900">{acc.balance.toLocaleString()} {currencies.find(c => c.id === acc.currencyId)?.symbol || acc.currency}</span>
                      </div>

                      {editingId === acc.id ? (
                        <div className="space-y-2 mt-4 pt-4 border-t border-neutral-200">
                          {/* Row 1: Type, Name, Balance */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-2 space-y-1 relative">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Тип</label>
                              <select 
                                value={type} 
                                onChange={(e) => setType(e.target.value as AccountType)} 
                                className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 ring-theme-primary-light transition-all appearance-none"
                              >
                                <option value="card">Карта</option>
                                <option value="credit">Кредит</option>
                                <option value="cash">Наличные</option>
                                <option value="bank">Банк</option>
                              </select>
                              <ChevronDown className="absolute right-2 top-7 w-3 h-3 text-neutral-400 pointer-events-none" />
                            </div>
                            <div className="col-span-6 space-y-1">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Название</label>
                              <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 ring-theme-primary-light transition-all" 
                                placeholder="Название" 
                              />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Баланс</label>
                              <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-2 py-1.5">
                                <input 
                                  type="number" 
                                  value={balance} 
                                  onChange={(e) => setBalance(e.target.value)} 
                                  disabled={!isBalanceEditable}
                                  className={cn(
                                    "w-full text-left font-bold text-sm outline-none transition-all",
                                    isBalanceEditable ? "text-theme-primary-dark" : "text-neutral-400 bg-transparent"
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setIsBalanceEditable(!isBalanceEditable); }}
                                  className={cn(
                                    "p-0.5 rounded-md transition-colors",
                                    isBalanceEditable ? "text-theme-primary-dark bg-theme-primary-light" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                                  )}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Currency, Color, Checkboxes */}
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-3 space-y-1 relative">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Валюта</label>
                              <select 
                                value={currencyId || ''} 
                                onChange={(e) => setCurrencyId(e.target.value)} 
                                className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 ring-theme-primary-light transition-all appearance-none"
                              >
                                <option value="">Валюта</option>
                                {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
                              </select>
                              <ChevronDown className="absolute right-2 top-7 w-3 h-3 text-neutral-400 pointer-events-none" />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Цвет</label>
                              <label className="block w-full h-8 rounded-lg cursor-pointer border border-neutral-200" style={{ backgroundColor: color }}>
                                <input 
                                  type="color" 
                                  value={color} 
                                  onChange={(e) => setColor(e.target.value)}
                                  className="sr-only"
                                />
                              </label>
                            </div>
                            <div className="col-span-7 flex items-center justify-end gap-3 text-[10px] font-bold text-neutral-600 px-1">
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showOnDashboard} onChange={(e) => setShowOnDashboard(e.target.checked)} className="rounded text-theme-primary" /> Главный</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showInTotals} onChange={(e) => setShowInTotals(e.target.checked)} className="rounded text-theme-primary" /> Суммы</label>
                              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} className="rounded text-theme-primary" /> Архив</label>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            {confirmDeleteId === acc.id ? (
                              <div className="flex items-center gap-2 bg-rose-50 px-3 py-2 rounded-xl">
                                <span className="text-[10px] text-rose-600 font-bold uppercase">Удалить?</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(acc.id); }} className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"><Check className="w-4 h-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="p-1.5 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300 transition-colors"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); handleUpdate(acc.id); }} className="p-3 bg-theme-primary text-white rounded-2xl hover:bg-theme-primary-dark transition-all shadow-lg shadow-theme-primary-light active:scale-95"><Check className="w-5 h-5" /></button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(acc.id); }} className="p-3 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 active:scale-95"><Trash2 className="w-5 h-5" /></button>
                                <button onClick={(e) => { e.stopPropagation(); resetForm(); }} className="p-3 bg-neutral-200 text-neutral-600 rounded-2xl hover:bg-neutral-300 transition-all active:scale-95"><X className="w-5 h-5" /></button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
