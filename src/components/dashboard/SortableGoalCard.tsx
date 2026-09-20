import { useEffect, useState } from 'react';
import { Goal } from '../../types';
import { Trash2, Check, Save, Calendar, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import InteractiveMarkdown from '../ui/InteractiveMarkdown';
import { cn } from '../../lib/utils';
import { createPortal } from 'react-dom';

interface SortableGoalCardProps {
  goal: Goal;
  isEditing: boolean;
  fillHeight?: boolean;
  onStartEdit: (goal: Goal) => void;
  onCancelEdit: () => void;
  onSave: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (goal: Goal) => void;
}

export function SortableGoalCard({
  goal,
  isEditing,
  fillHeight = false,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleComplete
}: SortableGoalCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const [editName, setEditName] = useState(goal.name);
  const [editTarget, setEditTarget] = useState(goal.targetAmount.toString());
  const [editCurrent, setEditCurrent] = useState(goal.currentAmount.toString());
  const [editDeadline, setEditDeadline] = useState(goal.deadline ? goal.deadline.split('T')[0] : '');
  const [editDescription, setEditDescription] = useState(goal.description || '');

  const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);

  useEffect(() => {
    if (!isEditing) return;
    setEditName(goal.name);
    setEditTarget(goal.targetAmount.toString());
    setEditCurrent(goal.currentAmount.toString());
    setEditDeadline(goal.deadline ? goal.deadline.split('T')[0] : '');
    setEditDescription(goal.description || '');
  }, [goal, isEditing]);

  const handleSaveWithCheck = () => {
    onSave(goal.id, {
      name: editName,
      targetAmount: parseFloat(editTarget),
      currentAmount: parseFloat(editCurrent),
      deadline: editDeadline || null,
      description: editDescription
    });
  };

  if (isEditing) {
    return (
      <div
        className={cn(
          "bg-theme-surface rounded-2xl border-2 border-theme-primary p-4 shadow-xl flex flex-col min-h-0",
          fillHeight && "h-full"
        )}
      >
        <div className="flex justify-between items-center gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 bg-theme-main rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 ring-theme-primary/20 text-theme-main"
            placeholder="Название"
          />
          <input
            type="date"
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
            className="w-32 bg-theme-main rounded-lg px-2 py-1 text-[10px] outline-none focus:ring-2 ring-theme-primary/20 text-theme-main"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-theme-muted uppercase tracking-widest">Накоплено</label>
            <input
              type="number"
              value={editCurrent}
              onChange={(e) => setEditCurrent(e.target.value)}
              className="w-full bg-theme-main rounded-lg px-2 py-1 text-xs font-bold text-emerald-500 outline-none focus:ring-2 ring-theme-primary/20"
            />
          </div>
          <div className="space-y-1 text-right">
            <label className="text-[9px] font-bold text-theme-muted uppercase tracking-widest">Цель</label>
            <input
              type="number"
              value={editTarget}
              onChange={(e) => setEditTarget(e.target.value)}
              className="w-full bg-theme-main rounded-lg px-2 py-1 text-xs font-bold text-right outline-none focus:ring-2 ring-theme-primary/20 text-theme-main"
            />
          </div>
        </div>

        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          className="w-full flex-1 min-h-[80px] bg-theme-main rounded-lg px-4 py-2 text-xs outline-none focus:ring-2 ring-theme-primary/20 resize-none text-theme-main"
          placeholder="Описание (Markdown)"
        />

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteModal(true);
            }}
            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer relative z-30"
            title="Удалить цель"
          >
            <Trash2 size={16} />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onCancelEdit();
              }}
              className="px-3 py-1.5 bg-theme-main text-theme-muted rounded-lg text-xs font-bold hover:bg-theme-base transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowCompleteModal(true);
              }}
              className={cn(
                "p-2 rounded-lg border transition-all flex items-center justify-center font-bold",
                goal.isCompleted
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-theme-main border-theme-base text-theme-muted hover:border-emerald-500 hover:text-emerald-500"
              )}
              title={goal.isCompleted ? "Снять отметку о выполнении" : "Отметить как выполненную"}
              aria-label={goal.isCompleted ? "Вернуть цель в работу" : "Отметить цель как выполненную"}
              aria-pressed={goal.isCompleted}
            >
              <Check size={14} />
              <span className="ml-1.5 text-[10px] uppercase tracking-wide">Выполнено</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleSaveWithCheck();
              }}
              className="w-9 h-9 flex items-center justify-center bg-theme-primary text-theme-on-primary rounded-lg shadow-lg shadow-theme-primary/20 hover:bg-theme-primary-dark transition-all"
              aria-label="Сохранить цель"
              title="Сохранить"
            >
              <Save size={16} />
            </button>
          </div>
        </div>

        {showDeleteModal && createPortal(
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-goal-title-${goal.id}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-theme-surface rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200 border border-theme-base">
              <div className="flex items-center gap-3 text-rose-500 mb-4">
                <Trash2 size={24} />
                <h4 id={`delete-goal-title-${goal.id}`} className="font-bold text-lg">Удалить цель?</h4>
              </div>
              <p className="text-theme-muted text-sm mb-6">Это действие нельзя отменить.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-theme-main text-theme-muted rounded-xl font-bold text-sm"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    onDelete(goal.id);
                  }}
                  className="flex-1 px-4 py-2 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-200"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showCompleteModal && createPortal(
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`complete-goal-title-${goal.id}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-theme-surface rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200 border border-theme-base">
              <div className="flex items-center gap-3 text-emerald-500 mb-4">
                <Check size={24} />
                <h4 id={`complete-goal-title-${goal.id}`} className="font-bold text-lg text-theme-main">{goal.isCompleted ? "Вернуть в работу?" : "Цель достигнута?"}</h4>
              </div>
              <p className="text-theme-muted text-sm mb-6">
                {goal.isCompleted
                  ? "Цель снова станет активной и появится в общем списке."
                  : "Цель будет отмечена как выполненная."}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 px-4 py-2 bg-theme-main text-theme-muted rounded-xl font-bold text-sm"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCompleteModal(false);
                    onToggleComplete(goal);
                  }}
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200"
                >
                  {goal.isCompleted ? "Вернуть" : "Выполнена!"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-theme-surface rounded-2xl border border-theme-base overflow-hidden shadow-sm hover:shadow-md transition-all relative group flex flex-col",
        goal.isCompleted && "opacity-75 bg-theme-main",
        fillHeight && "h-full"
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("font-bold text-sm truncate block", goal.isCompleted ? "text-theme-muted line-through" : "text-theme-main")}>
                {goal.name}
              </span>
              {goal.isCompleted && (
                <Check size={12} className="text-emerald-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {goal.deadline ? format(new Date(goal.deadline), 'dd MMMM yyyy', { locale: ru }) : 'Без срока'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStartEdit(goal)}
            className="shrink-0 p-2 rounded-lg text-theme-muted hover:bg-theme-primary-light hover:text-theme-primary active:scale-95 transition-all"
            aria-label={`Редактировать цель: ${goal.name}`}
            title="Редактировать цель"
            data-testid={`button-edit-goal-${goal.id}`}
          >
            <Pencil size={16} />
          </button>
        </div>

        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest leading-none mb-1">Накоплено</p>
            <p className="font-bold text-emerald-500 leading-none">{goal.currentAmount.toLocaleString()} ₽</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest leading-none mb-1">Цель</p>
            <p className="font-bold text-theme-main leading-none">{goal.targetAmount.toLocaleString()} ₽</p>
          </div>
        </div>

        {goal.description && (
          <div className="flex-1 min-h-0 mb-3 p-2 bg-theme-main rounded-xl text-[10px] text-theme-muted overflow-y-auto markdown-body">
            <InteractiveMarkdown
              content={goal.description}
              onUpdate={(newDesc) => onSave(goal.id, { description: newDesc })}
            />
          </div>
        )}

        <div className="mt-auto space-y-1.5">
          <div className="flex justify-end text-[10px] font-bold uppercase tracking-widest">
            <span className="text-emerald-500">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-theme-base rounded-full overflow-hidden">
            <div
              className="h-full bg-theme-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
