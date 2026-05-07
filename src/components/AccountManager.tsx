import { useState, useMemo, useEffect } from 'react';
import { api } from '../lib/api';
import { Account, AccountType, Currency } from '../types';
import { X, Plus, Trash2, Check, Pencil, ChevronDown, GripVertical, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { currencyService } from '../services/currencyService';
import { getAccountIcon } from '../lib/accountUtils';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AccountManagerProps {
  accounts: Account[];
  onClose: () => void;
  onRefresh?: () => void;
}

interface SortableAccountRowProps {
  account: Account;
  onEdit: (acc: Account) => void;
  currencies: Currency[];
}

function SortableAccountRow({ account, onEdit, currencies }: SortableAccountRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 0,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      onClick={() => onEdit(account)}
      className="group transition-all border-b border-neutral-50 hover:bg-theme-surface/40 cursor-pointer min-h-[32px]"
    >
      <td className="py-1 px-3">
        <div className="flex items-center gap-2 py-0.5">
          <button 
            className="cursor-grab active:cursor-grabbing text-theme-muted/20 hover:text-theme-primary transition-colors h-5 w-3 flex items-center justify-center rounded"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3" />
          </button>
          <div 
            className="w-2 h-2 rounded-full shrink-0" 
            style={{ backgroundColor: account.color || '#ccc' }}
          />
          <span className="font-bold text-[13px] text-theme-main leading-tight break-words max-w-[200px]">
            {account.name}
          </span>
        </div>
      </td>
      <td className="py-1 px-3 hidden sm:table-cell">
        <div className="flex items-center gap-1 text-theme-muted/60 uppercase text-[8px] font-black tracking-tighter">
          {account.type === 'card' ? 'Карта' : account.type === 'bank' ? 'Банк' : account.type === 'cash' ? 'Нал' : 'Кредит'}
        </div>
      </td>
      <td className="py-1 px-3 text-center hidden sm:table-cell">
        <div className="flex items-center justify-center gap-1.5 font-mono text-[8px] font-black uppercase text-theme-muted/40">
          {account.showOnDashboard && <div className="w-1 h-1 rounded-full bg-theme-primary" title="На главном" />}
          {account.showInTotals && <div className="w-1 h-1 rounded-full bg-green-500" title="В итогах" />}
        </div>
      </td>
      <td className="py-1 px-3 text-center">
        {account.isArchived && <span className="text-[7px] font-black bg-theme-muted/10 text-theme-muted px-1 rounded uppercase tracking-tighter">Архив</span>}
        {!account.isArchived && <span className="text-[7px] font-black text-theme-primary/40 uppercase tracking-tighter">Активен</span>}
      </td>
      <td className="py-1 px-3 text-right">
        <span className="font-mono text-sm font-black text-theme-primary italic">
          {account.balance.toLocaleString()} {currencies.find(c => c.id === account.currencyId)?.symbol || account.currency}
        </span>
      </td>
    </tr>
  );
}

export default function AccountManager({ accounts, onClose, onRefresh }: AccountManagerProps) {
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

  useEffect(() => {
    setLocalAccounts(accounts);
  }, [accounts]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overContainerId = over.data.current?.sortable?.containerId || over.id;

    const activeAccount = localAccounts.find(a => a.id === activeId);
    if (!activeAccount) return;

    let targetType: AccountType = activeAccount.type;
    if (['card', 'credit', 'cash', 'bank'].includes(overContainerId)) {
      targetType = overContainerId as AccountType;
    }

    if (activeAccount.type !== targetType) {
      const updatedAccount = { ...activeAccount, type: targetType };
      
      setLocalAccounts(prev => prev.map(a => a.id === activeId ? updatedAccount : a));

      try {
        await api.put(`/accounts/${activeId}`, {
          ...activeAccount,
          type: targetType
        });
        onRefresh?.();
      } catch (error) {
        console.error('Error updating account type via DND:', error);
        onRefresh?.();
      }
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
          <h3 className="text-sm font-black text-theme-main lowercase">счета</h3>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setEditingId(null);
                setBalance('0');
                setName('');
                setShowFormModal(true);
              }}
              className="p-2 bg-sky-500 text-white rounded-xl shadow-lg hover:bg-sky-600 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
              title="Добавить счет"
            >
              <Plus className="w-5 h-5" />
            </button>

            <button 
              onClick={onClose} 
              className="p-2 border border-orange-400 text-orange-400 bg-white rounded-xl hover:bg-orange-50 transition-colors relative z-20 cursor-pointer flex items-center justify-center"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
          <div className="p-3 lg:p-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="space-y-4">
                {(['card', 'cash', 'bank', 'credit'] as AccountType[]).map(groupType => (
                  <div key={groupType} className="overflow-hidden bg-theme-surface/10 rounded-lg border border-neutral-100 shadow-sm shadow-black/5">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead>
                        <tr className="bg-theme-surface/50 border-b border-neutral-50">
                          <th className="py-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-theme-primary italic w-[40%]">
                            <div className="flex items-center gap-2">
                              {getAccountIcon(groupType, "w-3 h-3")}
                              {groupType === 'card' ? 'Банковские карты' : groupType === 'bank' ? 'Расчетные счета' : groupType === 'cash' ? 'Наличные' : 'Кредиты'}
                            </div>
                          </th>
                          <th className="py-2 px-3 text-[8px] font-black uppercase tracking-[0.2em] text-theme-muted hidden sm:table-cell w-[15%] text-center">Тип</th>
                          <th className="py-2 px-3 text-[8px] font-black uppercase tracking-[0.2em] text-theme-muted text-center hidden sm:table-cell w-[10%]">Экран</th>
                          <th className="py-2 px-3 text-[8px] font-black uppercase tracking-[0.2em] text-theme-muted text-center w-[10%]">Статус</th>
                          <th className="py-2 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-theme-muted text-right w-[25%] pr-4 italic">Остаток</th>
                        </tr>
                      </thead>
                      <SortableContext 
                        items={groupedAccounts[groupType].map(a => a.id)}
                        strategy={verticalListSortingStrategy}
                        id={groupType}
                      >
                        <tbody>
                          {groupedAccounts[groupType].length > 0 ? (
                            groupedAccounts[groupType].map(acc => (
                              <SortableAccountRow 
                                key={acc.id} 
                                account={acc} 
                                onEdit={startEditing}
                                currencies={currencies}
                              />
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-[8px] font-black uppercase tracking-[0.3em] text-theme-muted/20 italic">
                                [ empty_sector ]
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </SortableContext>
                    </table>
                  </div>
                ))}
              </div>
            </DndContext>
          </div>
        </div>

        {/* Separate Account Form Modal */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-200">
            <div className="bg-theme-main w-full h-full lg:max-h-full lg:max-w-xl lg:rounded-xl lg:border border-neutral-100 overflow-hidden flex flex-col shadow-2xl relative">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-theme-surface/10 backdrop-blur-sm">
                <h3 className="text-sm font-black text-theme-main lowercase">{editingId ? 'редактировать' : 'новый счет'}</h3>
                <button 
                  onClick={resetForm} 
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-theme-surface text-theme-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-theme-base/50"
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
                              className="px-3 py-2 bg-rose-500 text-white rounded font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 shadow-lg shadow-rose-500/20"
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
                            className="w-12 h-12 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-100"
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
