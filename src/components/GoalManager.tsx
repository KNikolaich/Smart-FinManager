import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Goal } from '../types';
import { X, Plus, Trash2, Check, Calendar, Edit2, Target, TrendingUp, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface GoalManagerProps {
  goals: Goal[];
  userId: string;
  onClose: () => void;
  onRefresh?: () => void;
  initialData?: {
    name?: string;
    targetAmount?: number;
    deadline?: string;
  };
}

export default function GoalManager({ goals, userId, onClose, onRefresh, initialData }: GoalManagerProps) {
  const [isAdding, setIsAdding] = useState(!!initialData);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Form states for adding/editing
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState(initialData?.targetAmount?.toString() || '');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState(initialData?.deadline ? initialData.deadline.split('T')[0] : '');

  // Sync with initialData
  useEffect(() => {
    if (initialData) {
      setIsAdding(true);
      setName(initialData.name || '');
      setTargetAmount(initialData.targetAmount?.toString() || '');
      setDeadline(initialData.deadline ? initialData.deadline.split('T')[0] : '');
    }
  }, [initialData]);

  const filteredGoals = goals.filter(g => showCompleted ? g.isCompleted : !g.isCompleted);

  const resetForm = () => {
    setName('');
    setDescription('');
    setTargetAmount('');
    setCurrentAmount('');
    setDeadline('');
    setIsAdding(false);
    setEditingGoalId(null);
  };

  const startEditing = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setName(goal.name);
    setDescription(goal.description || '');
    setTargetAmount(goal.targetAmount.toString());
    setCurrentAmount(goal.currentAmount.toString());
    setDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
    setIsAdding(false);
  };

  const handleSave = async (id?: string) => {
    if (!name || !targetAmount) return;
    setLoading(true);
    try {
      const data = {
        name,
        description,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount || '0'),
        deadline,
      };

      if (id) {
        await api.put(`/goals/${id}`, data);
      } else {
        await api.post('/goals', { ...data, isCompleted: false });
      }
      resetForm();
      onRefresh?.();
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (goal: Goal) => {
    setLoading(true);
    try {
      const completed = !goal.isCompleted;
      await api.put(`/goals/${goal.id}`, {
        isCompleted: completed,
        completedAt: completed ? new Date().toISOString() : null
      });
      onRefresh?.();
    } catch (error) {
      console.error('Error updating goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await api.delete(`/goals/${id}`);
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting goal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-end sm:items-center justify-center p-1 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
        <div className="p-4 sm:p-2 flex items-center justify-between shrink-0 relative z-10 border-b border-neutral-100">
          <h2 className="text-lg sm:text-xl font-bold">Управление целями</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors relative z-20 cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 sm:w-6 h-6 text-neutral-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 no-scrollbar">
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <p className="text-neutral-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest shrink-0">Всего: {goals.length}</p>
            
            <div className="flex items-center gap-4 flex-1 justify-center">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div 
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                    showCompleted ? "bg-theme-primary border-theme-primary" : "border-neutral-300 group-hover:border-theme-primary"
                  }`}
                >
                  {showCompleted && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-neutral-500 uppercase tracking-widest">Завершенные</span>
              </label>
            </div>

            {!isAdding && (
              <button 
                onClick={() => { resetForm(); setIsAdding(true); }}
                className="flex items-center gap-1.5 bg-theme-primary text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:bg-theme-primary-dark transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 h-4" />
                Добавить
              </button>
            )}
          </div>

          {isAdding && (
            <div className="bg-neutral-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl mb-6 space-y-3">
              <div className="space-y-3">
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all" 
                  placeholder="Название цели" 
                />
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all min-h-[80px]" 
                  placeholder="Описание (Markdown)" 
                />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all" placeholder="Сумма цели" />
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-theme-primary-light transition-all" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={resetForm} className="px-4 py-2 bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold">Отмена</button>
                <button onClick={() => handleSave()} disabled={loading} className="px-4 py-2 bg-theme-primary text-white rounded-xl text-xs font-bold shadow-sm">Создать</button>
              </div>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            {filteredGoals.map(goal => {
              const isEditing = editingGoalId === goal.id;
              const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
              
              return (
                <div key={goal.id} className={`p-3 sm:p-5 rounded-2xl sm:rounded-3xl transition-all ${goal.isCompleted ? 'bg-neutral-50 opacity-75' : 'bg-white shadow-sm hover:shadow-md'}`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <input 
                          type="text" 
                          value={name} 
                          onChange={(e) => setName(e.target.value)} 
                          className="flex-1 bg-neutral-50 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 ring-emerald-500/20" 
                          placeholder="Название"
                        />
                        <input 
                          type="date" 
                          value={deadline} 
                          onChange={(e) => setDeadline(e.target.value)} 
                          className="w-32 bg-neutral-50 rounded-lg px-2 py-1 text-[10px] outline-none focus:ring-2 ring-emerald-500/20"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-neutral-400 uppercase">Накоплено</label>
                          <input 
                            type="number" 
                            value={currentAmount} 
                            onChange={(e) => setCurrentAmount(e.target.value)} 
                            className="w-full bg-neutral-50 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 outline-none focus:ring-2 ring-emerald-500/20"
                          />
                        </div>
                        <div className="space-y-1 text-right">
                          <label className="text-[9px] font-bold text-neutral-400 uppercase">Цель</label>
                          <input 
                            type="number" 
                            value={targetAmount} 
                            onChange={(e) => setTargetAmount(e.target.value)} 
                            className="w-full bg-neutral-50 rounded-lg px-2 py-1 text-xs font-bold text-right outline-none focus:ring-2 ring-emerald-500/20"
                          />
                        </div>
                      </div>

                      <textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        className="w-full bg-neutral-50 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 ring-emerald-500/20 min-h-[60px]" 
                        placeholder="Описание (Markdown)"
                      />

                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setEditingGoalId(null)} className="p-2 bg-neutral-100 text-neutral-500 rounded-lg hover:bg-neutral-200 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleSave(goal.id)} disabled={loading} className="p-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary-dark transition-all">
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-3 sm:mb-4">
                        <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                          <h3 className={`font-bold text-sm sm:text-lg truncate ${goal.isCompleted ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>{goal.name}</h3>
                          <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1">
                            <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 sm:w-3 h-3" />
                              {goal.deadline ? format(new Date(goal.deadline), 'd MMM yyyy', { locale: ru }) : 'Без срока'}
                            </span>
                            {goal.isCompleted && (
                              <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                <Check className="w-2.5 h-2.5 sm:w-3 h-3" />
                                Завершено
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 shrink-0">
                          <button onClick={() => handleToggleComplete(goal)} className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all ${goal.isCompleted ? 'bg-theme-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-theme-primary-light hover:text-theme-primary-dark'}`}>
                            <Check className="w-3.5 h-3.5 sm:w-4 h-4" />
                          </button>
                          <button onClick={() => startEditing(goal)} className="p-1.5 sm:p-2 bg-neutral-100 text-neutral-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg sm:rounded-xl transition-all">
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(goal.id)} className="p-1.5 sm:p-2 bg-neutral-100 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg sm:rounded-xl transition-all">
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
                        <div className="bg-neutral-50 rounded-xl sm:rounded-2xl p-2 sm:p-3">
                          <p className="text-[8px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5 sm:mb-1 flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5 sm:w-3 h-3" /> Накоплено
                          </p>
                          <p className="text-xs sm:text-base font-bold text-emerald-600">{goal.currentAmount.toLocaleString()} ₽</p>
                        </div>
                        <div className="bg-neutral-50 rounded-xl sm:rounded-2xl p-2 sm:p-3">
                          <p className="text-[8px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5 sm:mb-1 flex items-center gap-1">
                            <Target className="w-2.5 h-2.5 sm:w-3 h-3" /> Цель
                          </p>
                          <p className="text-xs sm:text-base font-bold text-neutral-900">{goal.targetAmount.toLocaleString()} ₽</p>
                        </div>
                      </div>

                      {goal.description && (
                        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-neutral-50 rounded-xl sm:rounded-2xl">
                          <div className="prose prose-sm max-w-none text-neutral-600 text-[10px] sm:text-xs leading-relaxed">
                            <ReactMarkdown>{goal.description}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex justify-between items-center text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-neutral-400">Прогресс</span>
                          <span className="text-emerald-600">{progress.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 sm:h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-theme-primary transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
