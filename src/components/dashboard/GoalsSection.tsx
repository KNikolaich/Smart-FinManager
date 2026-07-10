import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Goal } from '../../types';
import { Check, Plus } from 'lucide-react';
import GoalManager from '../GoalManager';
import { SortableGoalCard } from './SortableGoalCard';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
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
  rectSortingStrategy
} from '@dnd-kit/sortable';

interface GoalsSectionProps {
  visible: boolean;
  goals: Goal[];
  userId: string;
  initialGoalData?: {
    name?: string;
    targetAmount?: number;
    deadline?: string;
  };
  onCloseGoalManager?: () => void;
  onRefresh?: () => void;
}

export function GoalsSection({ visible, goals, userId, initialGoalData, onCloseGoalManager, onRefresh }: GoalsSectionProps) {
  const [showGoalManager, setShowGoalManager] = useState(!!initialGoalData);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showCompletedGoals, setShowCompletedGoals] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync showGoalManager with initialGoalData (for creation from UserPage)
  useEffect(() => {
    if (initialGoalData) {
      setShowGoalManager(true);
    }
  }, [initialGoalData]);

  const displayedGoals = useMemo(() => {
    return [...goals]
      .filter(g => showCompletedGoals ? g.isCompleted : !g.isCompleted)
      .sort((a, b) => {
        const orderA = a.sortOrder ?? 9999;
        const orderB = b.sortOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;

        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [goals, showCompletedGoals]);

  const handleCloseGoalManager = () => {
    setShowGoalManager(false);
    if (onCloseGoalManager) onCloseGoalManager();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = displayedGoals.findIndex((g: Goal) => g.id === active.id);
      const newIndex = displayedGoals.findIndex((g: Goal) => g.id === over.id);

      const newOrderedGoals = arrayMove(displayedGoals, oldIndex, newIndex);

      try {
        const updates = newOrderedGoals.map((goal, index) => {
          return api.put(`/goals/${goal.id}`, { sortOrder: index });
        });
        await Promise.all(updates);
        onRefresh?.();
      } catch (error) {
        console.error('Error updating goal order:', error);
      }
    }
  };

  const handleSaveGoal = async (id: string, data: any) => {
    try {
      await api.put(`/goals/${id}`, data);
      setEditingGoalId(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await api.delete(`/goals/${id}`);
      setEditingGoalId(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleToggleCompleteGoal = async (goal: Goal) => {
    try {
      const completed = !goal.isCompleted;
      await api.put(`/goals/${goal.id}`, {
        isCompleted: completed,
        completedAt: completed ? new Date().toISOString() : null
      });
      onRefresh?.();
    } catch (error) {
      console.error('Error toggling goal completion:', error);
    }
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.section
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-theme-main" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)' }}>Цели</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest leading-none">Завершенные</span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCompletedGoals(!showCompletedGoals);
                    }}
                    className={cn(
                      "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center shadow-md",
                      showCompletedGoals
                        ? "bg-theme-primary border-theme-primary text-white ring-2 ring-theme-primary/20"
                        : "border-theme-muted/50 bg-theme-surface group-hover:border-theme-primary"
                    )}
                  >
                    {showCompletedGoals && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                  </div>
                </label>
                <button
                  onClick={() => setShowGoalManager(true)}
                  className="flex items-center justify-center w-8 h-8 bg-theme-primary/10 border-2 border-theme-primary text-theme-primary rounded-full hover:bg-theme-primary hover:text-theme-on-primary shadow-md shadow-theme-primary/20 active:scale-95 transition-all font-bold"
                  title="Добавить цель"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayedGoals.map(g => g.id)}
                  strategy={rectSortingStrategy}
                >
                  {displayedGoals.map(goal => (
                    <SortableGoalCard
                      key={goal.id}
                      goal={goal}
                      isEditing={editingGoalId === goal.id}
                      onStartEdit={(g) => setEditingGoalId(g.id)}
                      onCancelEdit={() => setEditingGoalId(null)}
                      onSave={handleSaveGoal}
                      onDelete={handleDeleteGoal}
                      onToggleComplete={handleToggleCompleteGoal}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {displayedGoals.length === 0 && (
                <div className="text-center py-8 bg-theme-main/10 rounded-2xl border border-dashed border-theme-base">
                  <p className="text-theme-muted text-sm italic">
                    {showCompletedGoals ? 'Нет завершенных целей' : 'Нет активных целей'}
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {showGoalManager && (
        <GoalManager
          goals={goals}
          userId={userId}
          onClose={handleCloseGoalManager}
          initialData={initialGoalData}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
