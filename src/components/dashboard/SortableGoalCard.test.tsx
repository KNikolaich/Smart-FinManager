import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SortableGoalCard } from './SortableGoalCard';
import type { Goal } from '../../types';

const goal: Goal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Новый ноутбук',
  description: 'Описание цели',
  targetAmount: 100000,
  currentAmount: 25000,
  deadline: '2026-12-31T00:00:00.000Z',
  isCompleted: false,
};

const renderCard = (overrides: Partial<React.ComponentProps<typeof SortableGoalCard>> = {}) => {
  const props = {
    goal,
    isEditing: true,
    fillHeight: true,
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onToggleComplete: vi.fn(),
    ...overrides,
  };
  return { ...render(<SortableGoalCard {...props} />), props };
};

describe('SortableGoalCard', () => {
  it('opens editing from the pencil button', () => {
    const { props } = renderCard({ isEditing: false });

    fireEvent.click(screen.getByTestId('button-edit-goal-goal-1'));

    expect(props.onStartEdit).toHaveBeenCalledWith(goal);
  });

  it('saves from the top-right action while editing', () => {
    const { props } = renderCard();

    fireEvent.click(screen.getByTestId('button-save-goal-goal-1'));

    expect(props.onSave).toHaveBeenCalledWith(goal.id, expect.objectContaining({
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
    }));
  });

  it('confirms completing a goal from the modal', () => {
    const { props } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Отметить цель как выполненную' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Выполнена!' }));

    expect(props.onToggleComplete).toHaveBeenCalledWith(goal);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirms deleting a goal from the modal', () => {
    const { props } = renderCard();

    fireEvent.click(screen.getByTitle('Удалить цель'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(props.onDelete).toHaveBeenCalledWith(goal.id);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});