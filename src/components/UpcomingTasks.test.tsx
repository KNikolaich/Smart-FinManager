import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UpcomingTasks from './UpcomingTasks';
import type { PlannedPayment } from '../types';
import { api } from '../lib/api';

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

  it('prioritizes overdue tasks and replaces a completed banner', async () => {
    const payments: PlannedPayment[] = [
      { ...makePayment(0), id: 'overdue', title: 'Просроченная задача', date: '2026-09-17' },
      { ...makePayment(1), id: 'today', title: 'Сегодняшняя задача', date: '2026-09-19' },
      { ...makePayment(2), id: 'future', title: 'Будущая задача', date: '2026-09-20' },
    ];
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ payments });
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({});

    render(<UpcomingTasks variant="carousel" startDate="2026-09-19" />);

    await waitFor(() => expect(screen.getByText('Просроченная задача')).toBeTruthy());
    expect(screen.queryByTestId('upcoming-tasks-position')).toBeNull();

    fireEvent.click(screen.getByTestId('button-toggle-payment-overdue-2026-09-17'));

    await waitFor(() => expect(screen.queryByText('Просроченная задача')).toBeNull());
    expect(screen.getByText('Сегодняшняя задача')).toBeTruthy();
    expect(postSpy).toHaveBeenCalledWith('/plan-grid/calendar', expect.objectContaining({
      payments: expect.arrayContaining([
        expect.objectContaining({ id: 'overdue', status: 'paid' }),
      ]),
    }));

    getSpy.mockRestore();
    postSpy.mockRestore();
  });

  it('moves to the next stacked banner with a horizontal swipe', () => {
    const payments: PlannedPayment[] = [
      { ...makePayment(0), id: 'overdue', title: 'Просроченная задача', date: '2026-09-17' },
      { ...makePayment(1), id: 'today', title: 'Сегодняшняя задача', date: '2026-09-19' },
    ];
    render(<UpcomingTasks payments={payments} variant="carousel" startDate="2026-09-19" />);

    const carousel = screen.getByTestId('upcoming-tasks-carousel');
    fireEvent.pointerDown(carousel, { clientX: 220, pointerId: 1 });
    fireEvent.pointerMove(carousel, { clientX: 120, pointerId: 1 });
    fireEvent.pointerUp(carousel, { clientX: 120, pointerId: 1 });

    expect(screen.getByText('Сегодняшняя задача')).toBeTruthy();
  });

  it('navigates to the task date when the active banner is clicked', () => {
    const onTaskClick = vi.fn();
    const payment = { ...makePayment(0), id: 'clickable-task', date: '2026-09-20' };
    render(
      <UpcomingTasks
        payments={[payment]}
        variant="carousel"
        startDate="2026-09-19"
        onTaskClick={onTaskClick}
      />,
    );

    fireEvent.click(screen.getByTestId('upcoming-banner-clickable-task-2026-09-20'));

    expect(onTaskClick).toHaveBeenCalledWith('2026-09-20');
    expect(screen.getByTestId('upcoming-banner-clickable-task-2026-09-20').className).toContain('bg-orange-50');
  });

  it('opens the transaction flow from the carousel checkbox', () => {
    const onRequestTransaction = vi.fn();
    const payment = { ...makePayment(0), id: 'task-to-complete', date: '2026-09-19' };
    render(
      <UpcomingTasks
        payments={[payment]}
        variant="carousel"
        startDate="2026-09-19"
        onRequestTransaction={onRequestTransaction}
      />,
    );

    fireEvent.click(screen.getByTestId('button-toggle-payment-task-to-complete-2026-09-19'));

    expect(onRequestTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ payment: expect.objectContaining({ id: 'task-to-complete' }) }),
      expect.any(Function),
    );
  });
});