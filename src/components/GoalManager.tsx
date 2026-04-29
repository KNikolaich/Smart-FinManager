import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Goal } from '../types';
import { X, Plus, Trash2, Check, Calendar, Edit2, Target, TrendingUp, Save, GripVertical } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

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

interface SortableGoalItemProps {
  goal: Goal;
  isEditing: boolean;
  loading: boolean;
  showCompleted: boolean;
  onEdit: (goal: Goal) => void;
  onToggleComplete: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onCancelEdit: () => void;
  onSave: (id: string) => void;
  formStates: {
    name: string;
    setName: (v: string) => void;
    description: string;
    setDescription: (v: string) => void;
    targetAmount: string;
    setTargetAmount: (v: string) => void;
    currentAmount: string;
    setCurrentAmount: (v: string) => void;
    deadline: string;
    setDeadline: (v: string) => void;
  };
}

function SortableGoalItem({ 
  goal, 
  isEditing, 
  loading, 
  showCompleted,
  onEdit, 
  onToggleComplete, 
  onDelete,
  onCancelEdit,
  onSave,
  formStates
}: SortableGoalItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.3 : 1
  };

  const { name, setName, description, setDescription, targetAmount, setTargetAmount, currentAmount, setCurrentAmount, deadline, setDeadline } = formStates;
  const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`p-3 sm:p-5 rounded-2xl sm:rounded-3xl transition-all ${goal.isCompleted ? 'bg-neutral-50 opacity-75' : 'bg-white shadow-sm hover:shadow-md'}`}
    >
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

          <div className="flex justify-between items-center pt-1">
             <button 
                onClick={() => {
                  if (confirm('Вы уверены, что хотите удалить эту цель?')) {
                    onDelete(goal.id);
                  }
                }} 
                disabled={loading}
                className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                title="Удалить цель"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            <div className="flex gap-2">
              <button onClick={onCancelEdit} className="p-2 bg-neutral-100 text-neutral-500 rounded-lg hover:bg-neutral-200 transition-all text-xs font-bold px-3">
                Отмена
              </button>
              <button 
                onClick={() => onSave(goal.id)} 
                disabled={loading} 
                className="flex items-center gap-2 p-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary-dark transition-all text-xs font-bold px-3"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-3 sm:mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button 
                className="cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 transition-colors p-1"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0 pr-2">
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
            </div>
            <div className="flex gap-1.5 sm:gap-2 shrink-0">
              <button onClick={() => onToggleComplete(goal)} className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all ${goal.isCompleted ? 'bg-theme-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-theme-primary-light hover:text-theme-primary-dark'}`}>
                <Check className="w-3.5 h-3.5 sm:w-4 h-4" />
              </button>
              <button onClick={() => onEdit(goal)} className="p-1.5 sm:p-2 bg-neutral-100 text-neutral-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg sm:rounded-xl transition-all">
                <Edit2 className="w-3.5 h-3.5 sm:w-4 h-4" />
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
              <div className="markdown-body text-neutral-600 text-[10px] sm:text-xs leading-relaxed">
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
}

export default function GoalManager({ goals, userId, onClose, onRefresh, initialData }: GoalManagerProps) {
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState(initialData?.targetAmount?.toString() || '');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState(initialData?.deadline ? initialData.deadline.split('T')[0] : '');

  const handleCreate = async () => {
    if (!name || !targetAmount) return;
    setLoading(true);
    try {
      const maxSortOrder = goals.length > 0 ? Math.max(...goals.map(g => g.sortOrder ?? 0)) : 0;
      await api.post('/goals', {
        name,
        description,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount),
        deadline: deadline || null,
        isCompleted: false,
        sortOrder: maxSortOrder + 1
      });
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('Error creating goal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-end sm:items-center justify-center p-1 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
        <div className="p-6 flex items-center justify-between shrink-0 border-b border-neutral-100">
          <h2 className="text-xl font-bold">Новая цель</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Что покупаем?</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full bg-neutral-50 rounded-2xl px-4 py-3 text-lg font-bold outline-none focus:ring-2 ring-theme-primary/20" 
              placeholder="Название цели" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Сумма цели (₽)</label>
              <input 
                type="number" 
                value={targetAmount} 
                onChange={(e) => setTargetAmount(e.target.value)} 
                className="w-full bg-neutral-50 rounded-2xl px-4 py-3 font-bold outline-none focus:ring-2 ring-theme-primary/20" 
                placeholder="0" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Дедлайн</label>
              <input 
                type="date" 
                value={deadline} 
                onChange={(e) => setDeadline(e.target.value)} 
                className="w-full bg-neutral-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 ring-theme-primary/20" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Описание</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full bg-neutral-50 rounded-2xl px-4 py-3 min-h-[100px] outline-none focus:ring-2 ring-theme-primary/20 resize-none" 
              placeholder="Детали (Markdown)..." 
            />
          </div>

          <button 
            onClick={handleCreate} 
            disabled={loading || !name || !targetAmount} 
            className="w-full bg-theme-primary text-white p-4 rounded-2xl font-bold shadow-lg shadow-theme-primary/30 hover:bg-theme-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          >
            {loading ? 'Создание...' : 'Создать цель'}
          </button>
        </div>
      </div>
    </div>
  );
}
