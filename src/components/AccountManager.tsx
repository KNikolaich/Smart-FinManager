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

interface SortableAccountItemProps {
  account: Account;
  editingId: string | null;
  onEdit: (acc: Account) => void;
  currencies: Currency[];
  // Editor props
  editorProps: {
    name: string;
    setName: (v: string) => void;
    balance: string;
    setBalance: (v: string) => void;
    currencyId: string | null;
    setCurrencyId: (v: string | null) => void;
    color: string;
    setColor: (v: string) => void;
    showOnDashboard: boolean;
    setShowOnDashboard: (v: boolean) => void;
    showInTotals: boolean;
    setShowInTotals: (v: boolean) => void;
    isArchived: boolean;
    setIsArchived: (v: boolean) => void;
    isBalanceEditable: boolean;
    setIsBalanceEditable: (v: boolean) => void;
    confirmDeleteId: string | null;
    setConfirmDeleteId: (v: string | null) => void;
    handleUpdate: (id: string) => void;
    handleDelete: (id: string) => void;
    resetForm: () => void;
    loading: boolean;
  };
}

function SortableAccountItem({ account, editingId, onEdit, currencies, editorProps }: SortableAccountItemProps) {
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

  const isEditing = editingId === account.id;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      onClick={() => !editingId && onEdit(account)} 
      className={cn(
        "py-1 px-2 transition-all border border-transparent group relative",
        isEditing ? "bg-neutral-50 border-neutral-200 shadow-inner col-span-full" : "bg-white border-neutral-100 hover:border-neutral-200 cursor-pointer shadow-sm"
      )}
    >
      <div className="flex justify-between items-center leading-none">
        <div className="flex items-center gap-3">
          {!editingId && (
            <button 
              className="cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-50 transition-colors h-4 w-6 flex items-center justify-center rounded-lg hover:bg-neutral-50"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <span 
            className="font-bold text-xs truncate max-w-[120px]" 
            style={{ color: account.color && account.color !== '#000000' ? account.color : '#171717' }}
          >
            {account.name}
          </span>
        </div>
        <span className="font-bold text-xs text-neutral-900 leading-none">{account.balance.toLocaleString()} {currencies.find(c => c.id === account.currencyId)?.symbol || account.currency}</span>
      </div>

      {isEditing ? (
        <div className="space-y-1 mt-4 pt-4 border-t border-neutral-200" onClick={(e) => e.stopPropagation()}>
          {/* Row 1: Name, Balance */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8 space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Название</label>
              <input 
                type="text" 
                value={editorProps.name} 
                onChange={(e) => editorProps.setName(e.target.value)} 
                className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 ring-theme-primary-light transition-all" 
                placeholder="Название" 
              />
            </div>
            <div className="col-span-4 space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Баланс</label>
              <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-2 py-1.5">
                <input 
                  type="number" 
                  value={editorProps.balance} 
                  onChange={(e) => editorProps.setBalance(e.target.value)} 
                  disabled={!editorProps.isBalanceEditable}
                  className={cn(
                    "w-full text-left font-bold text-sm outline-none transition-all",
                    editorProps.isBalanceEditable ? "text-theme-primary-dark" : "text-neutral-400 bg-transparent"
                  )}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); editorProps.setIsBalanceEditable(!editorProps.isBalanceEditable); }}
                  className={cn(
                    "p-0.5 rounded-md transition-colors",
                    editorProps.isBalanceEditable ? "text-theme-primary-dark bg-theme-primary-light" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Color, Currency, Checkboxes */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-1 space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Цвет</label>
              <label className="block w-full h-8 rounded-lg cursor-pointer border border-neutral-200 overflow-hidden" style={{ backgroundColor: editorProps.color }}>
                <input 
                  type="color" 
                  value={editorProps.color} 
                  onChange={(e) => editorProps.setColor(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="col-span-3 space-y-1 relative">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Валюта</label>
              <select 
                value={editorProps.currencyId || ''} 
                onChange={(e) => editorProps.setCurrencyId(e.target.value)} 
                className="w-full h-8 bg-white border border-neutral-200 rounded-lg px-1 py-1 text-xs font-bold outline-none focus:ring-1 ring-theme-primary-light transition-all appearance-none text-center"
              >
                {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
              </select>
            </div>
            <div className="col-span-8 flex items-center justify-end gap-3 text-[10px] font-bold text-neutral-600 px-1 pb-2">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={editorProps.showOnDashboard} onChange={(e) => editorProps.setShowOnDashboard(e.target.checked)} className="rounded text-theme-primary" /> Главный</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={editorProps.showInTotals} onChange={(e) => editorProps.setShowInTotals(e.target.checked)} className="rounded text-theme-primary" /> Суммы</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={editorProps.isArchived} onChange={(e) => editorProps.setIsArchived(e.target.checked)} className="rounded text-theme-primary" /> Архив</label>
            </div>
          </div>

          <div className="flex items-center pt-4">
            <div className="flex-none">
              {editorProps.confirmDeleteId === account.id ? (
                <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-xl inline-flex">
                  <span className="text-[10px] text-rose-600 font-bold uppercase">Удалить?</span>
                  <button onClick={(e) => { e.stopPropagation(); editorProps.handleDelete(account.id); }} className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"><Check className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); editorProps.setConfirmDeleteId(null); }} className="p-1.5 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300 transition-colors"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); editorProps.setConfirmDeleteId(account.id); }} 
                  className="p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all active:scale-95"
                  title="Удалить счет"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex-grow"></div>
            <div className="flex gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); editorProps.resetForm(); }} 
                className="px-6 py-3 bg-neutral-100 text-neutral-500 rounded-2xl hover:bg-neutral-200 transition-all font-bold text-sm active:scale-95"
              >
                Отмена
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); editorProps.handleUpdate(account.id); }} 
                disabled={editorProps.loading}
                className="flex items-center gap-2 px-6 py-3 bg-theme-primary text-white rounded-2xl hover:bg-theme-primary-dark transition-all shadow-lg shadow-theme-primary/20 font-bold text-sm active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {editorProps.loading ? '...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AccountManager({ accounts, onClose, onRefresh }: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([]);

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
        delay: 300,
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
      
      // Local update
      setLocalAccounts(prev => {
        return prev.map(a => a.id === activeId ? updatedAccount : a);
      });

      // API update
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

  const editorProps = {
    name, setName,
    balance, setBalance,
    currencyId, setCurrencyId,
    color, setColor,
    showOnDashboard, setShowOnDashboard,
    showInTotals, setShowInTotals,
    isArchived, setIsArchived,
    isBalanceEditable, setIsBalanceEditable,
    confirmDeleteId, setConfirmDeleteId,
    handleUpdate, handleDelete,
    resetForm, loading
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 sm:p-1 lg:p-3">
      <div className="bg-white w-full max-w-xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative border border-white/10">
        <div className="p-1 flex items-center justify-between gap-4 shrink-0 relative z-10 border-b border-neutral-100">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-black text-neutral-900">Счета</h2>
            <p className="text-neutral-400 font-medium text-sm">Всего: {accounts.length}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {!isAdding && !editingId && (
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 bg-theme-primary text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-theme-primary/20 hover:scale-105 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            )}

            <button 
              onClick={onClose} 
              className="p-2 hover:bg-neutral-100 rounded-2xl transition-all cursor-pointer text-neutral-400 hover:text-neutral-600"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">


          {isAdding && (
            <form onSubmit={handleAdd} className="bg-neutral-100/50 p-6 rounded-2xl mb-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Название</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full bg-white rounded-xl p-3 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all" 
                  placeholder="Напр., Карта МИР" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Баланс</label>
                  <input 
                    type="number" 
                    value={balance} 
                    onChange={(e) => setBalance(e.target.value)} 
                    className="w-full bg-white rounded-xl p-3 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all font-bold" 
                    placeholder="0" 
                    required 
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-16 space-y-1 relative">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Валюта</label>
                    <select 
                      value={currencyId || ''} 
                      onChange={(e) => setCurrencyId(e.target.value)} 
                      className="w-full bg-white rounded-xl p-3 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all appearance-none text-center"
                    >
                      <option value="">₽</option>
                      {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Цвет</label>
                    <div className="bg-white rounded-xl p-3">
                      <input 
                        type="color" 
                        value={color === '#000000' ? '#e5e5e5' : color} 
                        onChange={(e) => setColor(e.target.value)}
                        className="w-6 h-6 rounded-lg cursor-pointer border-none bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showOnDashboard} onChange={(e) => setShowOnDashboard(e.target.checked)} className="rounded text-theme-primary" /> На главном</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showInTotals} onChange={(e) => setShowInTotals(e.target.checked)} className="rounded text-theme-primary" /> В суммах</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isArchived} onChange={(e) => setIsArchived(e.target.checked)} className="rounded text-theme-primary" /> Архив</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForm} className="px-6 py-3 bg-neutral-200 text-neutral-600 rounded-2xl text-sm font-bold active:scale-95 transition-all">Отмена</button>
                <button type="submit" disabled={loading} className="px-6 py-3 bg-theme-primary text-white rounded-2xl text-sm font-bold shadow-lg shadow-theme-primary/20 hover:bg-theme-primary-dark active:scale-95 transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {loading ? '...' : 'Сохранить'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2 pb-12">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {(['card', 'cash', 'bank', 'credit'] as AccountType[]).map(groupType => (
                <div key={groupType}>
                  <div className="flex items-center gap-2 text-neutral-400 px-2 py-1 mb-1">
                    {getAccountIcon(groupType, "w-4 h-4")}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{getTypeName(groupType)}</span>
                  </div>
                  
                  <SortableContext 
                    items={groupedAccounts[groupType].map(a => a.id)}
                    strategy={verticalListSortingStrategy}
                    id={groupType}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 min-h-[60px] bg-neutral-50/50 p-1.5 rounded-xl border-2 border-dashed border-neutral-100">
                      {groupedAccounts[groupType].length > 0 ? (
                        groupedAccounts[groupType].map(acc => (
                          <SortableAccountItem 
                            key={acc.id} 
                            account={acc} 
                            editingId={editingId}
                            onEdit={startEditing}
                            currencies={currencies}
                            editorProps={editorProps}
                          />
                        ))
                      ) : (
                        <div className="col-span-full h-12 flex items-center justify-center text-[10px] font-bold text-neutral-300 uppercase tracking-widest">
                          Перетащите сюда
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              ))}
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}
