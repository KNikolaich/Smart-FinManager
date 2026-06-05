import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Check, Save, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { BalanceHistory } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface BalanceManagerProps {
  onClose: () => void;
  onRefresh: () => void;
}

export default function BalanceManager({ onClose, onRefresh }: BalanceManagerProps) {
  const [history, setHistory] = useState<BalanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newMonth, setNewMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [newBalance, setNewBalance] = useState('');

  const [editMonth, setEditMonth] = useState('');
  const [editBalance, setEditBalance] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await api.get<BalanceHistory[]>('/balance-history');
      // Sort by month descending
      setHistory(data.sort((a, b) => b.month.localeCompare(a.month)));
    } catch (error) {
      console.error('Failed to fetch balance history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMonth || !newBalance) return;
    try {
      await api.post('/balance-history', {
        month: newMonth,
        totalBalance: parseFloat(newBalance)
      });
      setIsAdding(false);
      setNewBalance('');
      fetchHistory();
      onRefresh();
    } catch (error) {
      console.error('Add failed:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.put(`/balance-history/${id}`, {
        month: editMonth,
        totalBalance: parseFloat(editBalance)
      });
      setEditingId(null);
      fetchHistory();
      onRefresh();
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/balance-history/${id}`);
      setDeleteConfirmId(null);
      setEditingId(null);
      fetchHistory();
      onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Ошибка при удалении: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
    }
  };

  const startEditing = (record: BalanceHistory) => {
    setEditingId(record.id);
    setDeleteConfirmId(null);
    setEditMonth(record.month);
    setEditBalance(record.totalBalance.toString());
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full h-full lg:h-auto lg:max-w-3xl bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-theme-surface/10 backdrop-blur-sm shrink-0">
          <h3 className="text-sm font-black uppercase tracking-widest text-theme-main drop-shadow-sm">История баланса</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAdding(true)}
              className="w-10 h-10 bg-theme-primary text-theme-on-primary rounded-lg flex items-center justify-center shadow-lg shadow-theme-primary/40 hover:scale-105 active:scale-95 transition-all group"
              title="Добавить запись"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" strokeWidth={3} />
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

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-theme-base border-t-theme-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {isAdding && (
                <div className="bg-theme-surface/10 p-5 rounded-xl border border-neutral-100/50 space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest ml-1">Месяц</label>
                      <input 
                        type="month"
                        value={newMonth}
                        onChange={(e) => setNewMonth(e.target.value)}
                        className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-theme-muted uppercase tracking-widest ml-1">Баланс</label>
                      <input 
                        type="number"
                        value={newBalance}
                        onChange={(e) => setNewBalance(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main font-bold italic"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => setIsAdding(false)}
                      className="px-6 py-2.5 text-theme-muted hover:text-theme-main font-bold text-[10px] uppercase tracking-widest transition-colors"
                    >
                      Отмена
                    </button>
                    <button 
                      onClick={() => handleAdd()}
                      className="px-8 py-2.5 bg-theme-primary text-theme-on-primary rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-theme-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-theme-primary/20"
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-hidden bg-theme-surface/10 rounded-lg border border-neutral-100 shadow-sm shadow-black/5">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-theme-surface/50 border-b border-neutral-50 text-[10px] font-black text-theme-muted uppercase tracking-tighter">
                      <th className="px-6 py-3">Период</th>
                      <th className="px-6 py-3 text-right">Общий баланс</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {history.map((record) => (
                      <tr 
                        key={record.id} 
                        onClick={() => !editingId && startEditing(record)}
                        className={cn(
                          "group transition-all duration-200 cursor-pointer",
                          editingId === record.id ? "bg-theme-primary/5 shadow-inner" : "hover:bg-theme-surface/30"
                        )}
                      >
                        <td className="px-6 py-4">
                          {editingId === record.id ? (
                            <input 
                              type="month"
                              value={editMonth}
                              onChange={(e) => setEditMonth(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-theme-main border border-theme-base rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 ring-theme-primary/30 text-theme-main"
                            />
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-theme-surface border border-neutral-50 flex items-center justify-center text-theme-muted group-hover:text-theme-primary transition-colors">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-sm text-theme-main">
                                {format(new Date(record.month + '-01'), 'LLLL yyyy', { locale: ru })}
                              </span>
                            </div>
                          )}
                        </td>
                         <td className="px-6 py-4 text-right">
                          {editingId === record.id ? (
                            <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="number"
                                value={editBalance}
                                onChange={(e) => setEditBalance(e.target.value)}
                                className="w-32 bg-theme-main border border-theme-base rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 ring-theme-primary/30 text-right text-theme-primary font-black italic"
                              />
                              <div className="flex items-center gap-1">
                                {deleteConfirmId === record.id ? (
                                  <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded-lg border border-rose-100 animate-in fade-in zoom-in duration-200">
                                    <button 
                                      onClick={() => handleDelete(record.id)}
                                      className="px-2 py-1 bg-rose-500 text-white rounded font-bold text-[10px] hover:bg-rose-600 transition-colors"
                                    >
                                      ДА
                                    </button>
                                    <button 
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="px-2 py-1 bg-white text-theme-muted border border-neutral-200 rounded font-bold text-[10px] hover:bg-neutral-50 transition-colors"
                                    >
                                      НЕТ
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => handleUpdate(record.id)}
                                      className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-md transition-colors"
                                      title="Сохранить"
                                    >
                                      <Save size={16} />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setEditingId(null);
                                        setDeleteConfirmId(null);
                                      }}
                                      className="p-1.5 text-theme-muted hover:bg-neutral-100/50 rounded-md transition-colors"
                                      title="Отмена"
                                    >
                                      <X size={16} />
                                    </button>
                                    <button 
                                      onClick={() => setDeleteConfirmId(record.id)}
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                      title="Удалить"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
                              <span className="font-black text-sm tabular-nums text-theme-primary italic">
                                {record.totalBalance.toLocaleString()} ₽
                              </span>
                              <Pencil size={12} className="text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
