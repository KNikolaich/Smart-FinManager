import { useState, useMemo, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Account, AccountType, Currency } from '../types';
import { X, Plus, Trash2, Check, Pencil, ChevronDown, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { currencyService } from '../services/currencyService';
import { getAccountIcon } from '../lib/accountUtils';

interface AccountManagerProps {
  accounts: Account[];
  onClose: () => void;
  onRefresh?: () => void;
  initialEditingId?: string | null;
}

interface AccountCardProps {
  account: Account;
  onEdit: (acc: Account) => void;
  currencySymbol: string;
}

function AccountCard({ account, onEdit, currencySymbol }: AccountCardProps) {
  const isNegative = account.balance < 0;
  const hasColor = account.color && account.color !== '#000000';

  return (
    <div 
      onClick={() => onEdit(account)}
      className={cn(
        "bg-theme-surface/75 p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-300 relative cursor-pointer group hover:shadow-md hover:scale-[1.02] flex flex-col justify-between min-h-[76px] sm:min-h-[92px] select-none",
        isNegative 
          ? "border-rose-500/30 hover:shadow-rose-500/10 hover:bg-rose-500/5 hover:-translate-y-0.5" 
          : "border-theme-base hover:shadow-theme-primary/10 hover:bg-theme-primary/5 hover:-translate-y-0.5"
      )}
    >
      {/* Name and color dot */}
      <div className="min-w-0">
        <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
          <div 
            className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 shadow-sm" 
            style={hasColor ? { backgroundColor: account.color } : { backgroundColor: 'var(--color-theme-primary)' }}
          />
          <p className="text-theme-muted group-hover:text-theme-main text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider truncate transition-colors leading-tight">
            {account.name}
          </p>
        </div>
        
        <div className="flex items-baseline gap-1 w-full">
          <p className={cn("font-black text-[16px] sm:text-[18px] italic tracking-tight leading-none", isNegative ? "text-rose-500" : "text-theme-primary")}>
            {account.balance.toLocaleString()}
          </p>
          <span className="ml-auto font-mono text-[10px] sm:text-[12px] font-black text-theme-muted/70 tracking-tight shrink-0">
            {currencySymbol}
          </span>
        </div>
      </div>

      {/* Visibility dots and status at the bottom */}
      <div className="mt-2 flex items-center justify-center gap-1">
        {account.isArchived ? (
          <span className="text-[6.5px] sm:text-[7.5px] font-black uppercase bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-1 py-0.5 rounded tracking-wide shadow-sm">
            архив
          </span>
        ) : (
          <>
            {account.showOnDashboard && (
              <span className="w-1.5 h-1.5 rounded-full bg-theme-primary shadow-sm" title="На главном" />
            )}
            {account.showInTotals && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm" title="В итогах" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AccountManager({ accounts, onClose, onRefresh, initialEditingId }: AccountManagerProps) {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('card');
  const [balance, setBalance] = useState('');
  const [currencyId, setCurrencyId] = useState<string | null>(null);
  const [color, setColor] = useState('#00d4ff');
  const [showOnDashboard, setShowOnDashboard] = useState(true);
  const [showInTotals, setShowInTotals] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [isBalanceEditable, setIsBalanceEditable] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const processedInitialId = useRef<string | null>(null);

  useEffect(() => {
    setLocalAccounts(accounts);
    if (initialEditingId) {
      if (processedInitialId.current !== initialEditingId) {
        const acc = accounts.find(a => a.id === initialEditingId);
        if (acc) {
          startEditing(acc);
          processedInitialId.current = initialEditingId;
        }
      }
    } else {
      processedInitialId.current = null;
    }
  }, [accounts, initialEditingId]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      card: [],
      credit: [],
      cash: [],
      bank: []
    };
    localAccounts.forEach(acc => {
      if (groups[acc.type]) {
        groups[acc.type].push(acc);
      }
    });
    return groups;
  }, [localAccounts]);

  useEffect(() => {
    currencyService.getCurrencies().then(setCurrencies);
  }, []);

  const resetForm = () => {
    setName('');
    setType('card');
    setBalance('');
    setCurrencyId(null);
    setColor('#00d4ff');
    setShowOnDashboard(true);
    setShowInTotals(true);
    setIsArchived(false);
    setIsBalanceEditable(false);
    setConfirmDeleteId(null);
    setShowFormModal(false);
    setEditingId(null);
    onRefresh?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !balance) return;
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/accounts/${editingId}`, {
          name,
          type,
          balance: parseFloat(balance),
          currencyId,
          color,
          showOnDashboard,
          showInTotals,
          isArchived
        });
      } else {
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
      }
      resetForm();
    } catch (error) {
      console.error('Error saving account:', error);
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
      alert('Ошибка при удалении счета: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
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
    setColor(acc.color || '#00d4ff');
    setShowOnDashboard(acc.showOnDashboard ?? true);
    setShowInTotals(acc.showInTotals ?? true);
    setIsArchived(acc.isArchived ?? false);
    setIsBalanceEditable(false);
    setShowFormModal(true);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[120] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-300">
      <div className="bg-theme-main w-full h-full lg:max-h-full lg:max-w-5xl lg:rounded-xl lg:border border-neutral-100 overflow-hidden flex flex-col shadow-2xl relative shadow-black/50">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-theme-surface/10 backdrop-blur-sm">
          <h3 className="text-2xl font-black text-theme-main uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] [text-shadow:_0_2px_10px_rgba(0,0,0,0.12)]">счета</h3>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setEditingId(null);
                setBalance('0');
                setName('');
                setShowFormModal(true);
              }}
              className="p-2 bg-sky-500 text-white rounded-xl shadow-lg shadow-sky-500/10 hover:bg-sky-600 transition-all active:scale-95 cursor-pointer flex items-center justify-center h-10 w-10"
              title="Добавить счет"
            >
              <Plus className="w-5 h-5" />
            </button>

            <button 
              onClick={onClose} 
              className="p-2.5 bg-theme-main/50 border border-theme-base text-theme-main rounded-xl shadow-md hover:bg-theme-main transition-all relative z-20 cursor-pointer flex items-center justify-center active:scale-95 h-10 w-10"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
          <div className="p-4 lg:p-6">
            <div className="space-y-8">
              {(['card', 'cash', 'bank', 'credit'] as AccountType[]).map(groupType => (
                <div key={groupType} className="space-y-4">
                  {/* Group Heading */}
                  <div className="flex items-center gap-2 border-b border-theme-base pb-2 w-full">
                    <div className="w-5 h-5 flex items-center justify-center text-theme-primary/80">
                      {getAccountIcon(groupType, "w-4 h-4")}
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-[0.2em] text-theme-main italic">
                      {groupType === 'card' ? 'Банковские карты' : groupType === 'bank' ? 'Расчетные счета' : groupType === 'cash' ? 'Наличные' : 'Кредиты'}
                    </span>
                  </div>
                  
                  {/* Cards Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1.5 sm:gap-4">
                    {groupedAccounts[groupType].length > 0 ? (
                      groupedAccounts[groupType].map(acc => {
                        const currencySymbol = currencies.find(c => c.id === acc.currencyId)?.symbol || acc.currency;
                        return (
                          <AccountCard 
                            key={acc.id} 
                            account={acc} 
                            onEdit={startEditing}
                            currencySymbol={currencySymbol}
                          />
                        );
                      })
                    ) : (
                      <div className="col-span-full py-8 text-center bg-theme-surface/5 rounded-xl border border-dashed border-theme-base/30 text-[8px] font-black uppercase tracking-[0.3em] text-theme-muted/20 italic">
                        [ пустая категория ]
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Separate Account Form Modal */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-200">
            <div className="bg-theme-main w-full h-full lg:max-h-full lg:max-w-xl lg:rounded-xl lg:border border-neutral-100 overflow-hidden flex flex-col shadow-2xl relative">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-theme-surface/10 backdrop-blur-sm">
                <h3 className="text-sm font-black text-theme-main uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)] [text-shadow:_0_2px_8px_rgba(0,0,0,0.1)]">
                  {editingId ? 'редактировать' : 'новый счет'}
                </h3>
                <button 
                  onClick={resetForm} 
                  type="button"
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-theme-main/50 border border-theme-base text-theme-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all shadow-md active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 lg:p-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-12 gap-4">
                    {/* Row 1: Type + Name */}
                    <div className="col-span-12 space-y-1.5">
                      <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Тип счета и Название</label>
                      <div className="flex items-center gap-2 bg-theme-main border border-theme-base rounded-lg px-3 h-[48px] focus-within:ring-1 ring-theme-primary/20 transition-all">
                        <div className="relative group shrink-0">
                          <div className="flex items-center justify-center w-10 h-8 rounded bg-theme-surface border border-neutral-50 text-theme-primary">
                            {getAccountIcon(type, "w-5 h-5")}
                          </div>
                          <select 
                            value={type}
                            onChange={(e) => setType(e.target.value as AccountType)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          >
                            <option value="card">Карта</option>
                            <option value="bank">Банк</option>
                            <option value="cash">Нал</option>
                            <option value="credit">Кредит</option>
                          </select>
                        </div>
                        <input 
                          type="text" 
                          value={name} 
                          onChange={(e) => setName(e.target.value)} 
                          className="w-full bg-transparent border-none p-0 text-theme-main font-bold outline-none placeholder:text-theme-muted/30" 
                          placeholder="Например: Зарплатная карта" 
                          required 
                        />
                      </div>
                    </div>

                    {/* Row 2: Balance + Currency + Color */}
                    <div className="col-span-12 grid grid-cols-12 gap-3 sm:gap-4">
                      <div className="col-span-12 sm:col-span-8 space-y-1.5">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Текущий остаток</label>
                        <div className="flex items-center bg-theme-main border border-theme-base rounded-lg h-[48px] overflow-hidden focus-within:ring-1 ring-theme-primary/20 transition-all">
                          <input 
                            type="number" 
                            value={balance} 
                            onChange={(e) => setBalance(e.target.value)} 
                            disabled={editingId && !isBalanceEditable}
                            className={cn(
                              "flex-1 min-w-0 px-3 sm:px-4 py-1 bg-transparent border-none font-black text-base sm:text-lg outline-none italic",
                              (editingId && !isBalanceEditable) ? "text-theme-muted opacity-50" : "text-theme-primary"
                            )} 
                            placeholder="0.00" 
                            required 
                          />
                          {editingId && (
                            <button
                              type="button"
                              onClick={() => setIsBalanceEditable(!isBalanceEditable)}
                              className={cn(
                                "w-10 sm:w-12 h-full flex items-center justify-center border-l border-theme-base transition-all shrink-0",
                                isBalanceEditable ? "bg-theme-primary text-white" : "bg-theme-surface text-theme-muted"
                              )}
                            >
                              {isBalanceEditable ? <Save size={16} /> : <Pencil size={16} />}
                            </button>
                          )}
                          <div className="w-px h-8 bg-theme-base shrink-0" />
                          <select 
                            value={currencyId || ''} 
                            onChange={(e) => setCurrencyId(e.target.value)} 
                            className="w-[50px] sm:w-[70px] h-full bg-theme-surface/50 border-none px-1 sm:px-2 text-[10px] sm:text-[11px] font-black outline-none appearance-none text-center cursor-pointer text-theme-muted shrink-0"
                          >
                            <option value="">₽</option>
                            {currencies.map(c => <option key={c.id} value={c.id} className="bg-theme-main">{c.iso}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="col-span-12 sm:col-span-4 space-y-1.5">
                        <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Цвет</label>
                        <label className="block w-full h-[48px] bg-theme-main border border-theme-base rounded-lg p-1.5 cursor-pointer relative overflow-hidden group">
                          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
                          <div className="w-full h-full rounded-md shadow-inner" style={{ backgroundColor: color }} />
                          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Settings / Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-theme-surface/30 rounded-xl border border-neutral-100">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={showOnDashboard} onChange={(e) => setShowOnDashboard(e.target.checked)} className="w-4 h-4 rounded-md bg-theme-main border-theme-base text-theme-primary focus:ring-0" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-theme-main uppercase tracking-tighter">На главном</span>
                        <span className="text-[8px] text-theme-muted uppercase tracking-widest">Виджет</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={showInTotals} onChange={(e) => setShowInTotals(e.target.checked)} className="w-4 h-4 rounded-md bg-theme-main border-theme-base text-theme-primary focus:ring-0" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-theme-main uppercase tracking-tighter">В общий итог</span>
                        <span className="text-[8px] text-theme-muted uppercase tracking-widest">Сумма</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} className="w-4 h-4 rounded-md bg-theme-main border-theme-base text-theme-primary focus:ring-0" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-theme-main uppercase tracking-tighter">В архив</span>
                        <span className="text-[8px] text-theme-muted uppercase tracking-widest">Скрыть</span>
                      </div>
                    </label>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center gap-3 pt-6">
                    {editingId && (
                      <div className="flex shrink-0">
                        {confirmDeleteId === editingId ? (
                          <div className="flex items-center gap-1 bg-rose-500/10 px-2 h-12 rounded-lg border border-rose-500/20 animate-in zoom-in duration-200">
                            <span className="text-[8px] text-rose-500 font-bold uppercase px-1">Удалить?</span>
                            <button 
                              type="button" 
                              onClick={() => handleDelete(editingId)} 
                              className="px-3 py-2 bg-rose-500 text-white rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 shadow-md"
                            >
                              ДА
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setConfirmDeleteId(null)} 
                              className="px-3 py-2 text-theme-muted font-black text-[9px] uppercase tracking-widest hover:text-theme-main"
                            >
                              НЕТ
                            </button>
                          </div>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => setConfirmDeleteId(editingId)} 
                            className="w-12 h-12 flex items-center justify-center rounded-xl bg-rose-50/50 text-rose-500 hover:bg-rose-50 transition-all border border-rose-100 shadow-md active:scale-95"
                            title="Удалить счет"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    )}
                    
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="flex-1 py-3 bg-theme-primary text-theme-on-primary rounded-lg font-black uppercase tracking-widest text-[11px] shadow-lg shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 h-12"
                    >
                      {loading ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
