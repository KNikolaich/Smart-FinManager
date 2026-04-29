import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Check, ArrowDown, ArrowUp } from 'lucide-react';
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

  const handleAdd = async () => {
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
      alert('Ошибка при добавлении: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      alert('Ошибка при обновлении: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту запись?')) return;
    try {
      await api.delete(`/balance-history/${id}`);
      fetchHistory();
      onRefresh();
    } catch (error) {
      alert('Ошибка при удалении: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const startEditing = (record: BalanceHistory) => {
    setEditingId(record.id);
    setEditMonth(record.month);
    setEditBalance(record.totalBalance.toString());
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <h3 className="font-bold">История баланса</h3>
            <button 
              onClick={() => setIsAdding(true)}
              className="p-1.5 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer relative z-20"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {isAdding && (
                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-3 animate-in fade-in zoom-in duration-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase ml-2">Месяц</label>
                      <input 
                        type="month"
                        value={newMonth}
                        onChange={(e) => setNewMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm focus:ring-0 focus:border-neutral-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase ml-2">Баланс</label>
                      <input 
                        type="number"
                        value={newBalance}
                        onChange={(e) => setNewBalance(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm focus:ring-0 focus:border-neutral-900"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleAdd}
                      className="flex-1 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors"
                    >
                      Добавить
                    </button>
                    <button 
                      onClick={() => setIsAdding(false)}
                      className="px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left">Месяц</th>
                      <th className="px-4 py-2 text-right">Баланс</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {history.map((record) => (
                      <tr 
                        key={record.id} 
                        onClick={() => editingId !== record.id && startEditing(record)}
                        className={cn(
                          "transition-colors",
                          editingId === record.id ? "bg-neutral-50" : "hover:bg-neutral-50/50 cursor-pointer"
                        )}
                      >
                        <td className="px-4 py-3">
                          {editingId === record.id ? (
                            <input 
                              type="month"
                              value={editMonth}
                              onChange={(e) => setEditMonth(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                              <span className="font-medium">
                                {format(new Date(record.month + '-01'), 'LLLL yyyy', { locale: ru })}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingId === record.id ? (
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="number"
                                value={editBalance}
                                onChange={(e) => setEditBalance(e.target.value)}
                                className="w-20 px-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs text-right"
                              />
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => handleUpdate(record.id)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                  title="Сохранить"
                                >
                                  <Check size={14} />
                                </button>
                                <button 
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 text-neutral-400 hover:bg-neutral-100 rounded-lg transition-colors"
                                  title="Отмена"
                                >
                                  <X size={14} />
                                </button>
                                <div className="w-px h-4 bg-neutral-100 mx-1" />
                                <button 
                                  onClick={() => handleDelete(record.id)}
                                  className="p-1.5 text-rose-400 hover:bg-rose-100 rounded-lg transition-colors"
                                  title="Удалить"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="font-bold tabular-nums">
                              {record.totalBalance.toLocaleString()} ₽
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && !isAdding && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-neutral-400 italic">
                          История пуста
                        </td>
                      </tr>
                    )}
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
