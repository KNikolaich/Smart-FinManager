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
  it('shows the first page of tasks and navigates from the task text', () => {
    const onTaskClick = vi.fn();
    render(
      <UpcomingTasks
        payments={Array.from({ length: 8 }, (_, index) => makePayment(index))}
        startDate="2026-09-18"
        onTaskClick={onTaskClick}
      />,
    );

    expect(screen.getAllByTestId(/payment-row-task-/)).toHaveLength(8);
    expect(screen.getByText('Задача 7')).toBeTruthy();

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

    fireEvent.click(screen.getByTestId('button-upcoming-first'));

    expect(screen.getByText('Просроченная задача')).toBeTruthy();
  });

  it('renders the calendar title and button in the dashboard carousel header', () => {
    const onTaskClick = vi.fn();
    const onOpenCalendar = vi.fn();
    const payment = { ...makePayment(0), id: 'clickable-task', date: '2026-09-20' };
    render(
      <UpcomingTasks
        payments={[payment]}
        variant="carousel"
        startDate="2026-09-19"
        onTaskClick={onTaskClick}
        onOpenCalendar={onOpenCalendar}
      />,
    );

    fireEvent.click(screen.getByTestId('upcoming-banner-clickable-task-2026-09-20'));
    fireEvent.click(screen.getByTestId('button-upcoming-first'));
    fireEvent.click(screen.getByTestId('button-upcoming-calendar'));

    expect(onTaskClick).not.toHaveBeenCalled();
    expect(screen.getByText('Предстоящие планы')).toBeTruthy();
    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('upcoming-banner-clickable-task-2026-09-20').className).toContain('bg-pink-50');
  });

  it('uses header actions for the focused list task', () => {
    const onEditTask = vi.fn();
    const onManualToggleTask = vi.fn();
    const onDeleteTask = vi.fn();
    render(
      <UpcomingTasks
        payments={[makePayment(0)]}
        startDate="2026-09-18"
        onEditTask={onEditTask}
        onManualToggleTask={onManualToggleTask}
        onDeleteTask={onDeleteTask}
      />,
    );

    fireEvent.click(screen.getByTestId('button-upcoming-edit'));
    fireEvent.click(screen.getByTestId('button-upcoming-manual-toggle'));
    fireEvent.click(screen.getByTestId('button-upcoming-delete'));
    expect(onDeleteTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));

    expect(onEditTask).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-18' }));
    expect(onManualToggleTask).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-18' }));
    expect(onDeleteTask).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-18' }));
  });

  it('applies the selected status filter to the list', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const overdue = { ...makePayment(0), id: 'overdue-list', title: 'Просроченная', date: '2026-09-19' };
    const pending = { ...makePayment(1), id: 'pending-list', title: 'Предстоящая', date: '2026-09-21' };
    const paid = { ...makePayment(2), id: 'paid-list', title: 'Выполненная', date: '2026-09-22', paidDates: ['2026-09-22'] };
    const { rerender } = render(
      <UpcomingTasks payments={[overdue, pending, paid]} startDate="2026-09-20" filter="pending" />,
    );

    expect(screen.getByText('Предстоящая')).toBeTruthy();
    expect(screen.queryByText('Просроченная')).toBeNull();
    expect(screen.queryByText('Выполненная')).toBeNull();

    rerender(<UpcomingTasks payments={[overdue, pending, paid]} startDate="2026-09-20" filter="paid" />);
    expect(screen.getByText('Выполненная')).toBeTruthy();
    expect(screen.queryByText('Предстоящая')).toBeNull();
    vi.useRealTimers();
  });

  it('renders completed list tasks in the neutral tone', () => {
    const paid = { ...makePayment(0), id: 'paid-tone', title: 'Серая выполненная', date: '2026-09-20', paidDates: ['2026-09-20'] };
    render(<UpcomingTasks payments={[paid]} startDate="2026-09-20" filter="paid" />);

    expect(screen.getByTestId('payment-row-paid-tone-2026-09-20').className).toContain('bg-neutral-100');
    expect(screen.getByTestId('payment-row-paid-tone-2026-09-20').className).not.toContain('bg-red-100');
    expect(screen.getByTestId('payment-row-paid-tone-2026-09-20').className).not.toContain('bg-lime-50');
  });

  it('keeps the list touch-scrollable without a visible scrollbar and includes past tasks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const past = { ...makePayment(0), id: 'past-list', title: 'Прошлый план', date: '2026-09-10' };
    const future = { ...makePayment(1), id: 'future-list', title: 'Будущий план', date: '2026-09-25' };
    render(<UpcomingTasks payments={[past, future]} startDate="2026-09-20" />);

    const list = screen.getByTestId('upcoming-tasks-list');
    expect(list.className).toContain('no-scrollbar');
    expect(list.className).toContain('touch-pan-y');
    expect(screen.getByText('Прошлый план')).toBeTruthy();
    expect(screen.getByText('Будущий план')).toBeTruthy();
    vi.useRealTimers();
  });

  it('scrolls the selected list task into view when the calendar date changes', () => {
    const scrollTo = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    try {
      const payments = [
        { ...makePayment(0), id: 'selected-before', date: '2026-09-18' },
        { ...makePayment(1), id: 'selected-after', date: '2026-09-19' },
      ];
      const { rerender } = render(
        <UpcomingTasks
          payments={payments}
          startDate="2026-09-18"
          focusedDate="2026-09-18"
        />,
      );
      const list = screen.getByTestId('upcoming-tasks-list');
      const selectedTask = screen.getByTestId('payment-row-selected-after-2026-09-19');
      Object.defineProperties(list, {
        clientHeight: { configurable: true, value: 100 },
        offsetTop: { configurable: true, value: 0 },
      });
      Object.defineProperties(selectedTask, {
        offsetTop: { configurable: true, value: 200 },
        offsetHeight: { configurable: true, value: 40 },
      });

      rerender(
        <UpcomingTasks
          payments={payments}
          startDate="2026-09-19"
          focusedDate="2026-09-19"
        />,
      );

      expect(scrollTo.mock.calls.some(([options]) => options?.behavior === 'smooth')).toBe(true);
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it('marks transaction-backed tasks and prevents creating a second transaction', () => {
    const onToggleTask = vi.fn();
    const payment = {
      ...makePayment(0),
      id: 'transaction-backed',
      date: '2026-09-18',
      paidDates: ['2026-09-18'],
      occurrences: [{
        id: 'occurrence-transaction-backed',
        date: '2026-09-18',
        transactionId: 'transaction-1',
        manuallyCompleted: false,
      }],
    };
    render(<UpcomingTasks payments={[payment]} startDate="2026-09-18" onToggleTask={onToggleTask} />);

    const checkbox = screen.getByTestId('button-toggle-payment-transaction-backed-2026-09-18');
    expect((checkbox as HTMLButtonElement).disabled).toBe(true);
    expect(checkbox.querySelector('svg')).toBeTruthy();
    fireEvent.click(checkbox);
    expect(onToggleTask).not.toHaveBeenCalled();
  });

  it('allows a manually completed task to be completed through a transaction', () => {
    const onToggleTask = vi.fn();
    const payment = {
      ...makePayment(0),
      id: 'manual-first',
      date: '2026-09-18',
      paidDates: ['2026-09-18'],
      occurrences: [{
        id: 'occurrence-manual-first',
        date: '2026-09-18',
        transactionId: null,
        manuallyCompleted: true,
      }],
    };
    render(<UpcomingTasks payments={[payment]} startDate="2026-09-18" onToggleTask={onToggleTask} />);

    fireEvent.click(screen.getByTestId('button-toggle-payment-manual-first-2026-09-18'));
    expect(onToggleTask).toHaveBeenCalledWith(expect.objectContaining({
      manuallyCompleted: true,
      transactionId: null,
    }));
  });

  it('pulses overdue banners until the user taps them', () => {
    const payment = { ...makePayment(0), id: 'overdue-pulse', date: '2026-09-19' };
    render(<UpcomingTasks payments={[payment]} variant="carousel" startDate="2026-09-19" />);

    const banner = screen.getByTestId('upcoming-banner-overdue-pulse-2026-09-19');
    expect(banner.className).toContain('animate-overdue-pulse');
    expect(banner.className).toContain('bg-red-100');

    fireEvent.click(banner);

    expect(banner.className).not.toContain('animate-overdue-pulse');
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