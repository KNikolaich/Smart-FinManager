import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Goal } from '../../types';
import { Check, Plus } from 'lucide-react';
import GoalManager from '../GoalManager';
import { SortableGoalCard } from './SortableGoalCard';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface GoalsSectionProps {
  goals: Goal[];
  userId: string;
  initialGoalData?: {
    name?: string;
    targetAmount?: number;
    deadline?: string;
  };
  onCloseGoalManager?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function GoalsSection({ goals, userId, initialGoalData, onCloseGoalManager, onRefresh, className }: GoalsSectionProps) {
  const [showGoalManager, setShowGoalManager] = useState(!!initialGoalData);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showCompletedGoals, setShowCompletedGoals] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  // Sync showGoalManager with initialGoalData (for creation from UserPage)
  useEffect(() => {
    if (initialGoalData) {
      setShowGoalManager(true);
    }
  }, [initialGoalData]);

  const displayedGoals = useMemo(() => {
    return [...goals]
      .filter(g => showCompletedGoals || !g.isCompleted)
      .sort((a, b) => {
        const orderA = a.sortOrder ?? 9999;
        const orderB = b.sortOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;

        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [goals, showCompletedGoals]);

  const activeCarouselIndex = displayedGoals.length === 0
    ? 0
    : Math.min(carouselIndex, displayedGoals.length - 1);

  useEffect(() => {
    if (carouselIndex >= displayedGoals.length && displayedGoals.length > 0) {
      setCarouselIndex(displayedGoals.length - 1);
    }
  }, [carouselIndex, displayedGoals.length]);

  const moveCarousel = (direction: -1 | 1) => {
    setCarouselIndex(index => {
      if (displayedGoals.length < 2) return index;
      return Math.max(0, Math.min(index + direction, displayedGoals.length - 1));
    });
  };

  const handleCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartX.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleCarouselPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    setDragOffset(event.clientX - pointerStartX.current);
  };

  const handleCarouselPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    const offset = event.clientX - pointerStartX.current;
    if (Math.abs(offset) >= 50) {
      moveCarousel(offset < 0 ? 1 : -1);
    }
    pointerStartX.current = null;
    setDragOffset(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCloseGoalManager = () => {
    setShowGoalManager(false);
    if (onCloseGoalManager) onCloseGoalManager();
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
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={cn("h-full rounded-2xl border border-theme-base bg-theme-surface p-4", className)}
        data-testid="dashboard-goals"
      >
            <header className="flex items-center justify-between gap-2 border-b border-theme-base pb-2">
              <div className="min-w-0">
                <p className="text-[15px] uppercase tracking-wider text-theme-muted font-bold truncate">Цели</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[10px] uppercase tracking-wider text-theme-muted font-bold leading-none">Завершенные</span>
                  <input
                    type="checkbox"
                    checked={showCompletedGoals}
                    onChange={(event) => {
                      setShowCompletedGoals(event.target.checked);
                      setCarouselIndex(0);
                    }}
                    aria-label="Показывать завершенные цели"
                    data-testid="checkbox-dashboard-completed-goals"
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center shadow-sm",
                      showCompletedGoals
                        ? "bg-theme-primary border-theme-primary text-theme-on-primary ring-2 ring-theme-primary/20"
                        : "border-theme-muted/50 bg-theme-surface"
                    )}
                  >
                    {showCompletedGoals && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowGoalManager(true)}
                  aria-label="Добавить цель"
                  title="Добавить цель"
                  data-testid="button-dashboard-add-goal"
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-theme-primary-light text-theme-primary hover:bg-theme-primary hover:text-theme-on-primary active:scale-95 transition-all"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>
            </header>

            {displayedGoals.length === 0 ? (
              <div className="mt-3 py-10 text-center text-xs text-theme-muted">
                <p>{showCompletedGoals ? 'Целей пока нет' : 'Нет активных целей'}</p>
              </div>
            ) : (
              <div
                className="relative h-[352px] pt-3 touch-pan-y select-none"
                data-testid="dashboard-goals-carousel"
                onPointerDown={handleCarouselPointerDown}
                onPointerMove={handleCarouselPointerMove}
                onPointerUp={handleCarouselPointerUp}
                onPointerCancel={handleCarouselPointerUp}
              >
                {[0, 1, 2].map(stackIndex => {
                  if (displayedGoals.length <= stackIndex) return null;
                  const goal = displayedGoals[activeCarouselIndex + stackIndex];
                  if (!goal) return null;
                  const isActive = stackIndex === 0;
                  const stackStyle = isActive
                    ? { transform: `translateX(${dragOffset}px)`, zIndex: 30 }
                    : { transform: `translateY(${stackIndex * 8}px)`, zIndex: 30 - stackIndex };

                  return (
                    <div
                      key={`${goal.id}-${stackIndex}`}
                      className="absolute inset-x-0 top-3 h-[320px]"
                      style={stackStyle}
                      data-testid={isActive ? `goal-banner-${goal.id}` : undefined}
                      aria-hidden={!isActive}
                    >
                      <SortableGoalCard
                        goal={goal}
                        isEditing={editingGoalId === goal.id}
                        fillHeight
                        onStartEdit={(selectedGoal) => setEditingGoalId(selectedGoal.id)}
                        onCancelEdit={() => setEditingGoalId(null)}
                        onSave={handleSaveGoal}
                        onDelete={handleDeleteGoal}
                        onToggleComplete={handleToggleCompleteGoal}
                      />
                    </div>
                  );
                })}
              </div>
            )}
      </motion.section>

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
