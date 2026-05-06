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
    type: AccountType;
    setType: (v: AccountType) => void;
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

function SortableAccountRow({ account, editingId, onEdit, currencies, editorProps }: SortableAccountItemProps) {
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
    <>
      <tr 
        ref={setNodeRef}
        style={style}
        onClick={() => !editingId && onEdit(account)}
        className={cn(
          "group transition-all border-b border-neutral-50 hover:bg-theme-surface/40 cursor-pointer min-h-[32px]",
          isEditing && "bg-theme-surface/50"
        )}
      >
        <td className="py-1 px-3">
          <div className="flex items-center gap-2 py-0.5">
            {!editingId && (
              <button 
                className="cursor-grab active:cursor-grabbing text-theme-muted/20 hover:text-theme-primary transition-colors h-5 w-3 flex items-center justify-center rounded"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-3 h-3" />
              </button>
            )}
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
          {!account.isArchived && <span className="text-[7px] font-black text-theme-primary/40 uppercase tracking-tighter">Live</span>}
        </td>
        <td className="py-1 px-3 text-right">
          <span className="font-mono text-sm font-black text-theme-primary italic">
            {account.balance.toLocaleString()} {currencies.find(c => c.id === account.currencyId)?.symbol || account.currency}
          </span>
        </td>
      </tr>

      {isEditing && (
        <tr className="bg-theme-surface/90 border-b border-theme-primary/20">
          <td colSpan={5} className="p-3" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-12 gap-3">
                {/* Type + Name */}
                <div className="col-span-12 sm:col-span-7 space-y-1">
                  <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest ml-1">Актив</label>
                  <div className="flex items-center gap-2 bg-theme-main border border-theme-base rounded-lg px-2 h-[38px] focus-within:ring-1 ring-theme-primary/30 transition-all">
                    <div className="relative group shrink-0">
                      <div className="flex items-center justify-center w-8 h-6 rounded bg-theme-surface border border-neutral-50 text-theme-primary">
                        {getAccountIcon(editorProps.type, "w-4 h-4")}
                      </div>
                      <select 
                        value={editorProps.type}
                        onChange={(e) => editorProps.setType(e.target.value as AccountType)}
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
                      value={editorProps.name} 
                      onChange={(e) => editorProps.setName(e.target.value)} 
                      placeholder="Название"
                      className="w-full bg-transparent border-none px-1 py-1 text-sm font-bold outline-none text-theme-main placeholder:text-theme-muted/30" 
                    />
                  </div>
                </div>

                {/* Balance + ISO */}
                <div className="col-span-12 sm:col-span-5 space-y-1">
                  <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest ml-1">Баланс & ISO</label>
                  <div className="flex items-center bg-theme-main border border-theme-base rounded-lg h-[38px] overflow-hidden focus-within:ring-1 ring-theme-primary/30 transition-all">
                    <input 
                      type="number" 
                      value={editorProps.balance} 
                      onChange={(e) => editorProps.setBalance(e.target.value)} 
                      disabled={!editorProps.isBalanceEditable}
                      className={cn(
                        "flex-1 px-3 py-1 font-black text-sm outline-none bg-transparent italic",
                        editorProps.isBalanceEditable ? "text-theme-primary" : "text-theme-muted cursor-not-allowed"
                      )}
                    />
                    <div className="w-px h-6 bg-theme-base" />
                    <select 
                      value={editorProps.currencyId || ''} 
                      onChange={(e) => editorProps.setCurrencyId(e.target.value)} 
                      className="w-[60px] h-full bg-theme-surface/50 border-none px-1 text-[10px] font-black outline-none appearance-none text-center text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
                    >
                      {currencies.map(c => <option key={c.id} value={c.id} className="bg-theme-main">{c.iso}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => editorProps.setIsBalanceEditable(!editorProps.isBalanceEditable)}
                      className={cn(
                        "w-10 h-full flex items-center justify-center transition-colors border-l border-theme-base",
                        editorProps.isBalanceEditable ? "text-theme-on-primary bg-theme-primary" : "text-theme-muted/40 hover:text-theme-primary"
                      )}
                    >
                      {editorProps.isBalanceEditable ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                <div className="flex gap-3">
                  <div className="space-y-1">
                    <label className="block w-10 h-7 rounded-md cursor-pointer border border-theme-base overflow-hidden relative group" style={{ backgroundColor: editorProps.color }}>
                      <input type="color" value={editorProps.color} onChange={(e) => editorProps.setColor(e.target.value)} className="sr-only" />
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-theme-main px-3 rounded-lg border border-neutral-50 h-[28px]">
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input type="checkbox" checked={editorProps.showOnDashboard} onChange={(e) => editorProps.setShowOnDashboard(e.target.checked)} className="w-3.5 h-3.5 rounded border-theme-base text-theme-primary focus:ring-0 bg-theme-surface" />
                      <span className="text-[9px] font-black uppercase tracking-tighter text-theme-muted group-hover:text-theme-main transition-colors">Home</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input type="checkbox" checked={editorProps.showInTotals} onChange={(e) => editorProps.setShowInTotals(e.target.checked)} className="w-3.5 h-3.5 rounded border-theme-base text-theme-primary focus:ring-0 bg-theme-surface" />
                      <span className="text-[9px] font-black uppercase tracking-tighter text-theme-muted group-hover:text-theme-main transition-colors">Sum</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input type="checkbox" checked={editorProps.isArchived} onChange={(e) => editorProps.setIsArchived(e.target.checked)} className="w-3.5 h-3.5 rounded border-theme-base text-theme-primary focus:ring-0 bg-theme-surface" />
                      <span className="text-[9px] font-black uppercase tracking-tighter text-theme-muted group-hover:text-rose-500 transition-colors">Arch</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {editorProps.confirmDeleteId === account.id ? (
                    <div className="flex items-center gap-1.5 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                      <span className="text-[8px] text-rose-500 font-bold uppercase">Удалить?</span>
                      <button 
                        type="button"
                        onClick={() => editorProps.handleDelete(account.id)} 
                        className="p-1 px-2 bg-rose-500 text-white rounded font-bold text-[8px] cursor-pointer hover:bg-rose-600 transition-colors"
                      >
                        ДА
                      </button>
                      <button 
                        type="button"
                        onClick={() => editorProps.setConfirmDeleteId(null)} 
                        className="p-1 px-2 bg-theme-surface text-theme-muted rounded font-bold text-[8px] cursor-pointer hover:bg-neutral-100 transition-colors"
                      >
                        НЕТ
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => editorProps.setConfirmDeleteId(account.id)} 
                      className="p-2 text-rose-500/40 hover:text-rose-500 transition-all"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="w-px h-4 bg-neutral-50 mx-1" />
                  <button onClick={editorProps.resetForm} className="px-3 py-1.5 text-theme-muted hover:text-theme-main font-bold text-[10px] uppercase tracking-widest transition-colors">Cancel</button>
                  <button 
                    onClick={() => editorProps.handleUpdate(account.id)} 
                    disabled={editorProps.loading}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-theme-primary text-theme-on-primary rounded-lg hover:brightness-110 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    <Save className="w-3 h-3" />
                    {editorProps.loading ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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
    setIsAdding(false);
    setIsBalanceEditable(false);
  };

  const editorProps = {
    type, setType,
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[120] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-300">
      <div className="bg-theme-main w-full h-full lg:h-auto lg:max-w-5xl lg:rounded-xl lg:border border-neutral-100 overflow-hidden flex flex-col shadow-2xl relative shadow-black/50">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-theme-surface/10 backdrop-blur-sm">
          <h3 className="text-sm font-black text-theme-main lowercase">счета</h3>
          
          <div className="flex items-center gap-2">
            {!isAdding && !editingId && (
              <button 
                onClick={() => setIsAdding(true)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-theme-primary text-theme-on-primary shadow-lg shadow-theme-primary/40 hover:scale-105 active:scale-95 transition-all group"
                title="Добавить счет"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" strokeWidth={3} />
              </button>
            )}

            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-theme-surface text-theme-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-theme-base/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
          <div className="p-3 lg:p-6">
            {isAdding && (
              <div className="mb-6 bg-theme-surface border border-neutral-100 rounded-lg p-5 lg:p-6 animate-in slide-in-from-bottom-2 duration-300">
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Adding Row 1: Type + Name */}
                    <div className="col-span-12 md:col-span-7 space-y-1">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest ml-1">Актив</label>
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
                          placeholder="Название актива" 
                          required 
                        />
                      </div>
                    </div>

                    {/* Adding Row 2: Balance + Currency + Color */}
                    <div className="col-span-12 md:col-span-5 grid grid-cols-12 gap-3">
                      <div className="col-span-9 space-y-1">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest ml-1 block text-center">Баланс & ISO</label>
                        <div className="flex items-center bg-theme-main border border-theme-base rounded-lg h-[48px] overflow-hidden focus-within:ring-1 ring-theme-primary/20 transition-all">
                          <input 
                            type="number" 
                            value={balance} 
                            onChange={(e) => setBalance(e.target.value)} 
                            className="flex-1 px-3 py-1 bg-transparent border-none text-theme-primary font-black text-center outline-none italic" 
                            placeholder="0" 
                            required 
                          />
                          <div className="w-px h-8 bg-theme-base" />
                          <select 
                            value={currencyId || ''} 
                            onChange={(e) => setCurrencyId(e.target.value)} 
                            className="w-[60px] h-full bg-theme-surface/50 border-none px-1 text-[10px] font-black outline-none appearance-none text-center cursor-pointer"
                          >
                            <option value="">₽</option>
                            {currencies.map(c => <option key={c.id} value={c.id} className="bg-theme-main">{c.iso}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="col-span-3 space-y-1 text-center">
                        <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest block">Color</label>
                        <label className="block w-full h-[48px] bg-theme-main border border-theme-base rounded-lg p-1.5 cursor-pointer relative overflow-hidden">
                          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
                          <div className="w-full h-full rounded-md" style={{ backgroundColor: color }} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-neutral-50">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={showOnDashboard} onChange={(e) => setShowOnDashboard(e.target.checked)} className="w-4 h-4 rounded-md bg-theme-main border-theme-base text-theme-primary focus:ring-0" />
                        <span className="text-[9px] font-black text-theme-muted uppercase tracking-tighter group-hover:text-theme-main transition-colors">Home</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" checked={showInTotals} onChange={(e) => setShowInTotals(e.target.checked)} className="w-4 h-4 rounded-md bg-theme-main border-theme-base text-theme-primary focus:ring-0" />
                        <span className="text-[9px] font-black text-theme-muted uppercase tracking-tighter group-hover:text-theme-main transition-colors">Total</span>
                      </label>
                    </div>
                    
                    <div className="flex gap-2">
                      <button type="button" onClick={resetForm} className="px-6 py-2 text-theme-muted hover:text-theme-main font-black uppercase tracking-widest text-[10px] transition-colors">Cancel</button>
                      <button type="submit" disabled={loading} className="px-8 py-2 bg-theme-primary text-theme-on-primary rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg shadow-theme-primary/10 hover:brightness-110 active:scale-95 transition-all">
                        {loading ? '...' : 'Create Asset'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

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
                          <th className="py-2 px-3 text-[8px] font-black uppercase tracking-[0.2em] text-theme-muted hidden sm:table-cell w-[15%]">Тип</th>
                          <th className="py-2 px-3 text-[8px] font-black uppercase tracking-[0.2em] text-theme-muted text-center hidden sm:table-cell w-[10%]">View</th>
                          <th className="py-2 px-3 text-[8px] font-black uppercase tracking-[0.2em] text-theme-muted text-center w-[10%]">Status</th>
                          <th className="py-2 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-theme-muted text-right w-[25%] pr-4 italic">Balance</th>
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
                                editingId={editingId}
                                onEdit={startEditing}
                                currencies={currencies}
                                editorProps={editorProps}
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
      </div>
    </div>
  );
}
