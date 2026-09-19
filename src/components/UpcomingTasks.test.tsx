import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UpcomingTasks from './UpcomingTasks';
import type { PlannedPayment } from '../types';

const makePayment = (index: number): PlannedPayment => ({
  id: `task-${index}`,
  title: `Задача ${index}`,
  amount: index * 100,
  date: `2026-09-${String(18 + index).padStart(2, '0')}`,
  recurrence: 'none',
  transactionType: 'expense',
  status: 'pending',
});

describe('UpcomingTasks', () => {
  it('shows up to seven tasks and navigates from the task text', () => {
    const onTaskClick = vi.fn();
    render(
      <UpcomingTasks
        payments={Array.from({ length: 8 }, (_, index) => makePayment(index))}
        startDate="2026-09-18"
        onTaskClick={onTaskClick}
      />,
    );

    expect(screen.getAllByTestId(/payment-row-task-/)).toHaveLength(7);
    expect(screen.queryByText('Задача 7')).toBeNull();

    fireEvent.click(screen.getByTestId('upcoming-task-link-task-2-2026-09-20'));
    expect(onTaskClick).toHaveBeenCalledWith('2026-09-20');
  });
});