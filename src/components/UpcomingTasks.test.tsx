import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const socket = vi.hoisted(() => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const fakeSocket = {
    handlers,
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      handlers[event] = callback;
      return fakeSocket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return fakeSocket;
});

vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }));

import UpcomingTasks from './UpcomingTasks';
import type { CalendarNote, PlannedPayment } from '../types';
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
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens a plan preview and navigates to its date when the plan row is tapped', () => {
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
    expect(screen.getByTestId('dialog-plan-view').textContent).toContain('Задача 2');
  });

  it('reloads the dashboard list when calendar data changes', async () => {
    const getSpy = vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ payments: [], notes: [] })
      .mockResolvedValueOnce({ payments: [makePayment(8)], notes: [] });
    for (const event of Object.keys(socket.handlers)) delete socket.handlers[event];

    const { unmount } = render(<UpcomingTasks userId="user-1" />);
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));

    act(() => socket.handlers.connect?.());
    expect(socket.emit).toHaveBeenCalledWith('join', 'user-1');

    await act(async () => {
      socket.handlers['data:updated']?.({ type: 'plan-grid', planType: 'calendar' });
    });
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Задача 8')).toBeTruthy();

    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('sorts calendar notes among plan rows by date and scheduled time', () => {
    const payments: PlannedPayment[] = [
      { ...makePayment(1), id: 'late-plan', date: '2026-09-22', time: '17:30' },
      { ...makePayment(2), id: 'early-plan', date: '2026-09-22', time: '08:15' },
      { ...makePayment(3), id: 'next-day-plan', date: '2026-09-23', time: '10:00' },
    ];
    const notes: CalendarNote[] = [
      { id: 'note-first-day', date: '2026-09-22', text: 'Записка на первый день' },
      { id: 'note-second-day', date: '2026-09-23', text: 'Записка на второй день' },
    ];
    render(<UpcomingTasks payments={payments} notes={notes} startDate="2026-09-22" />);

    const orderedItems = Array.from(
      screen.getByTestId('upcoming-tasks-list').querySelectorAll<HTMLElement>('[data-calendar-plan-entry]'),
    ).map(item => `${item.dataset.calendarPlanEntry}:${item.dataset.calendarItemKey}`);

    expect(orderedItems).toEqual([
      'note:note-note-first-day-2026-09-22',
      'payment:early-plan-2026-09-22',
      'payment:late-plan-2026-09-22',
      'note:note-note-second-day-2026-09-23',
      'payment:next-day-plan-2026-09-23',
    ]);
  });

  it('offers a separate note button in the plans list header', () => {
    const onAddNote = vi.fn();
    render(<UpcomingTasks payments={[]} onAddNote={onAddNote} />);

    fireEvent.click(screen.getByTestId('button-add-calendar-note-from-list'));

    expect(onAddNote).toHaveBeenCalledTimes(1);
  });

  it('routes view, copy, and delete actions to a selected note without a completion checkbox', () => {
    const note: CalendarNote = {
      id: 'list-note',
      date: '2026-09-20',
      text: 'Позвонить врачу',
    };
    const onNoteClick = vi.fn();
    const onCopyNote = vi.fn();
    const onDeleteNote = vi.fn().mockResolvedValue(undefined);
    const onManualToggleTask = vi.fn();
    render(
      <UpcomingTasks
        payments={[]}
        notes={[note]}
        startDate="2026-09-20"
        focusedDate="2026-09-20"
        onNoteClick={onNoteClick}
        onCopyNote={onCopyNote}
        onDeleteNote={onDeleteNote}
        onManualToggleTask={onManualToggleTask}
      />,
    );

    const row = screen.getByTestId('calendar-note-row-list-note');
    expect(row.className).toContain('bg-amber-50');
    expect(screen.getByTestId('calendar-note-icon-list-note')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.click(row);
    expect(onNoteClick).toHaveBeenCalledWith(note);
    expect((screen.getByTestId('button-upcoming-manual-toggle') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    expect(onNoteClick).toHaveBeenCalledTimes(2);
    expect(onNoteClick).toHaveBeenLastCalledWith(note);

    fireEvent.click(screen.getByTestId('button-upcoming-copy'));
    expect(onCopyNote).toHaveBeenCalledWith(note);

    fireEvent.click(screen.getByTestId('button-upcoming-delete'));
    expect(screen.getByTestId('dialog-plan-cleanup').textContent).toContain('Удалить записку?');
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));
    expect(onDeleteNote).toHaveBeenCalledWith(note);
    expect(onManualToggleTask).not.toHaveBeenCalled();
  });

  it('shows scheduled time and selected weekdays in the dashboard plan card without a month period', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const payment: PlannedPayment = {
      ...makePayment(1),
      id: 'weekday-dashboard',
      title: 'Перевод',
      date: '2026-09-23',
      time: '08:00',
      recurrence: 'weekdays',
      weekdays: [1, 3, 5],
    };
    render(<UpcomingTasks payments={[payment]} variant="carousel" startDate="2026-09-20" />);

    const card = screen.getByTestId('upcoming-banner-weekday-dashboard-2026-09-23');
    expect(card.textContent).toContain('08:00');
    expect(card.textContent).toContain('Пн, Ср, Пт');
    expect(card.textContent).toContain('23 сент');
    expect(card.textContent).not.toContain('23 сент.');
  });

  it('shows the regular date instead of the selected-day label in the calendar plan list', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const payment: PlannedPayment = {
      ...makePayment(1),
      id: 'weekday-calendar',
      title: 'Оплата услуг',
      date: '2026-09-23',
      time: '15:00',
      recurrence: 'weekdays',
      weekdays: [1, 3, 5],
    };
    render(<UpcomingTasks payments={[payment]} startDate="2026-09-23" focusedDate="2026-09-23" />);

    const row = screen.getByTestId('payment-row-weekday-calendar-2026-09-23');
    expect(row.textContent).toContain('23 сент');
    expect(row.textContent).not.toContain('Выбранный день');
    expect(row.textContent).toContain('15:00');
    expect(row.textContent).toContain('Пн, Ср, Пт');
    expect(row.textContent).not.toContain('23 сент.');
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

  it('loads calendar notes into the dashboard carousel in date order with planned payments', async () => {
    const payments: PlannedPayment[] = [
      { ...makePayment(1), id: 'dashboard-plan-first', title: 'Первый план', date: '2026-09-22' },
      { ...makePayment(2), id: 'dashboard-plan-last', title: 'Последний план', date: '2026-09-24' },
    ];
    const notes: CalendarNote[] = [
      { id: 'dashboard-note-first', date: '2026-09-21', text: 'Первая записка' },
      { id: 'dashboard-note-second', date: '2026-09-23', text: 'Вторая записка' },
    ];
    vi.spyOn(api, 'get').mockResolvedValue({ payments, notes });
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({});

    render(
      <UpcomingTasks
        variant="carousel"
        startDate="2026-09-20"
      />,
    );

    await waitFor(() => expect(screen.getByTestId('upcoming-note-card-dashboard-note-first')).toBeTruthy());
    const firstNoteCard = screen.getByTestId('upcoming-note-card-dashboard-note-first');
    expect(firstNoteCard.querySelector('strong')?.textContent).toContain('Первая записка');
    expect(firstNoteCard.textContent).not.toContain('Записка календаря');
    const carousel = screen.getByTestId('upcoming-tasks-carousel');
    const visibleStack = Array.from(carousel.querySelectorAll<HTMLElement>('[data-upcoming-item]'))
      .map(item => `${item.dataset.upcomingDate}:${item.dataset.upcomingItem?.startsWith('note-') ? 'note' : 'payment'}`);

    expect(visibleStack).toEqual([
      '2026-09-21:note',
      '2026-09-22:payment',
      '2026-09-23:note',
    ]);
    expect((screen.getByTestId('button-upcoming-view') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    expect(screen.getByTestId('dialog-calendar-note').textContent).toContain('Первая записка');

    fireEvent.click(screen.getByTestId('button-edit-calendar-note'));
    fireEvent.change(screen.getByTestId('input-calendar-note-text'), {
      target: { value: 'Исправленная первая записка' },
    });
    fireEvent.click(screen.getByTestId('button-save-calendar-note'));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    expect(postSpy).toHaveBeenNthCalledWith(1, '/plan-grid/calendar', expect.objectContaining({
      payments,
      notes: expect.arrayContaining([
        expect.objectContaining({ id: 'dashboard-note-first', text: 'Исправленная первая записка' }),
      ]),
    }));
    expect(screen.queryByTestId('dialog-calendar-note')).toBeNull();

    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    fireEvent.click(screen.getByTestId('button-delete-calendar-note'));
    fireEvent.click(screen.getByTestId('button-confirm-delete-calendar-note'));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2));
    const deleteRequest = postSpy.mock.calls[1][1] as { notes: CalendarNote[] };
    expect(deleteRequest.notes.map(note => note.id)).toEqual(['dashboard-note-second']);
    expect(screen.queryByTestId('dialog-calendar-note')).toBeNull();
  });

  it('keeps stacked carousel cards the same height and clamps banner text', () => {
    const longPlan: PlannedPayment = {
      ...makePayment(0),
      id: 'long-plan',
      title: 'Очень длинное название плана, которое не должно вытолкнуть соседние баннеры вниз',
      categoryName: 'Очень длинное название категории для проверки многоточия',
    };
    const longNote: CalendarNote = {
      id: 'long-note',
      date: '2026-09-20',
      text: 'Длинная записка, которая может занимать несколько строк и должна обрезаться после второй строки.',
    };

    render(
      <UpcomingTasks
        payments={[longPlan, makePayment(1)]}
        notes={[longNote]}
        variant="carousel"
        startDate="2026-09-18"
      />,
    );

    const cards = Array.from(
      screen.getByTestId('upcoming-tasks-carousel').querySelectorAll<HTMLElement>('[data-upcoming-item]'),
    );
    expect(cards).toHaveLength(3);
    expect(cards.every(card => card.className.includes('h-24'))).toBe(true);

    const banner = screen.getByTestId('upcoming-banner-long-plan-2026-09-18');
    const title = banner.querySelector('strong')?.querySelectorAll('span')[2];
    const category = banner.querySelector('strong')?.nextElementSibling;
    expect(title?.className).toContain('truncate');
    expect(category?.className).toContain('truncate');

    const noteCard = screen.getByTestId('upcoming-note-card-long-note');
    expect(noteCard.querySelector('strong')?.className).toContain('line-clamp-2');
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 12));
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

  it('places the current-plan view button before refresh and opens editing from the viewer', () => {
    const onEditTask = vi.fn();
    const payment = { ...makePayment(0), id: 'editable-task', note: 'Оплатить после получения счёта' };
    render(
      <UpcomingTasks
        payments={[payment]}
        variant="carousel"
        startDate="2026-09-18"
        onEditTask={onEditTask}
      />,
    );

    const viewButton = screen.getByTestId('button-upcoming-view');
    const refreshButton = screen.getByTestId('button-upcoming-first');
    expect(viewButton.compareDocumentPosition(refreshButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(viewButton);
    expect(screen.getByTestId('dialog-plan-view').textContent).toContain('Оплатить после получения счёта');
    fireEvent.click(screen.getByTestId('button-plan-view-edit'));
    expect(onEditTask).toHaveBeenCalledWith(expect.objectContaining({
      payment,
    }));
  });

  it('lets the dashboard plan viewer delete and persist a plan', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 24, 12));
    const payment = { ...makePayment(0), id: 'dashboard-delete', date: '2026-09-25' };
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({});
    render(
      <UpcomingTasks
        payments={[payment]}
        variant="carousel"
        startDate="2026-09-24"
        onEditTask={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    fireEvent.click(screen.getByTestId('button-plan-view-delete'));
    expect(screen.getByTestId('dialog-plan-cleanup')).toBeTruthy();
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/plan-grid/calendar', { payments: [] });
    });
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

    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    fireEvent.click(screen.getByTestId('button-plan-view-edit'));
    fireEvent.click(screen.getByTestId('button-upcoming-manual-toggle'));
    fireEvent.click(screen.getByTestId('button-upcoming-delete'));
    expect(onDeleteTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));

    expect(onEditTask).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-18' }));
    expect(onManualToggleTask).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-18' }));
    expect(onDeleteTask).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-09-18' }));
  });

  it('confirms whole-plan removal and shows when the selected occurrence is incomplete', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 12));
    const onDeleteTask = vi.fn();
    const uncompleted = {
      ...makePayment(0),
      id: 'uncompleted-one-time',
      title: 'Невыполненная оплата',
      date: '2026-09-18',
    };
    render(
      <UpcomingTasks
        payments={[uncompleted]}
        startDate="2026-09-18"
        focusedDate="2026-09-18"
        onDeleteTask={onDeleteTask}
      />,
    );

    fireEvent.click(screen.getByTestId('button-upcoming-delete'));

    expect(screen.getByRole('dialog').textContent).toContain('Удалить план целиком?');
    expect(screen.getByRole('dialog').textContent).toContain('НЕ выполнено');
    expect(screen.getByRole('dialog').textContent).toContain('Невыполненная оплата');
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));

    expect(onDeleteTask).toHaveBeenCalledWith(expect.objectContaining({
      payment: uncompleted,
      date: '2026-09-18',
    }));
  });

  it('shows the next scheduled date when clearing history from a recurring plan', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 12));

    const recurring = {
      ...makePayment(0),
      id: 'weekly-plan',
      title: 'Еженедельный план',
      date: '2026-09-04',
      recurrence: 'weekly' as const,
    };

    render(
      <UpcomingTasks
        payments={[recurring]}
        startDate="2026-09-24"
        focusedDate="2026-09-25"
        onDeleteTask={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    fireEvent.click(screen.getByTestId('button-plan-view-delete'));

    const confirmationText = screen.getByTestId('dialog-plan-cleanup').textContent || '';
    expect(confirmationText).toContain('План продолжится со следующего запуска по графику');
    expect(confirmationText).toContain('25 сентября 2026');
    expect(confirmationText).toContain('Отметки до этой даты перестанут отображаться');
    expect(confirmationText).not.toContain('Дата начала станет 24 сентября');
  });

  it('places the eraser immediately before the trash and confirms bulk cleanup candidates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 12));
    const completedOnce = {
      ...makePayment(0),
      id: 'completed-once',
      title: 'Разовый выполненный',
      date: '2026-09-10',
      status: 'paid' as const,
      paidDates: ['2026-09-10'],
    };
    const completedSeries = {
      ...makePayment(1),
      id: 'completed-series',
      title: 'Повторяющийся выполненный',
      date: '2026-09-03',
      recurrence: 'weekly' as const,
      paidDates: ['2026-09-03', '2026-09-10', '2026-09-17'],
    };
    const overdue = {
      ...makePayment(2),
      id: 'overdue-plan',
      title: 'Просроченный',
      date: '2026-09-18',
    };
    const onDeleteTask = vi.fn();
    const onCleanupPastTasks = vi.fn();
    render(
      <UpcomingTasks
        payments={[completedOnce, completedSeries, overdue]}
        startDate="2026-09-24"
        onDeleteTask={onDeleteTask}
        onCleanupPastTasks={onCleanupPastTasks}
      />,
    );

    const eraser = screen.getByTestId('button-upcoming-clean-past');
    const trash = screen.getByTestId('button-upcoming-delete');
    expect(eraser.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(eraser);

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Планов для очистки: 2. Старых записок для удаления: 0.');
    expect(dialog.textContent).toContain('Разовый выполненный');
    expect(dialog.textContent).toContain('Повторяющийся выполненный');
    expect(dialog.textContent).not.toContain('Просроченный');
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));

    expect(onCleanupPastTasks).toHaveBeenCalledWith(['completed-once', 'completed-series']);
    expect(onDeleteTask).not.toHaveBeenCalled();
  });

  it('includes old standalone notes in the bulk cleanup action', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 12));
    const oldNote: CalendarNote = {
      id: 'old-note',
      date: '2026-09-23',
      text: 'Старое напоминание',
    };
    const futureNote: CalendarNote = {
      id: 'future-note',
      date: '2026-09-26',
      text: 'Будущее напоминание',
    };
    const onCleanupPastTasks = vi.fn();
    render(
      <UpcomingTasks
        payments={[]}
        notes={[oldNote, futureNote]}
        startDate="2026-09-24"
        onCleanupPastTasks={onCleanupPastTasks}
      />,
    );

    fireEvent.click(screen.getByTestId('button-upcoming-clean-past'));
    const dialog = screen.getByTestId('dialog-plan-cleanup');
    expect(dialog.textContent).toContain('Старых записок для удаления: 1.');
    expect(dialog.textContent).toContain('Старое напоминание');
    expect(dialog.textContent).not.toContain('Будущее напоминание');
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));

    expect(onCleanupPastTasks).toHaveBeenCalledWith([], ['old-note']);
  });

  it('allows copying a completed focused task', () => {
    const onCopyTask = vi.fn();
    const completed = {
      ...makePayment(0),
      id: 'completed-copy',
      title: 'Выполненный план',
      date: '2026-09-10',
      paidDates: ['2026-09-10'],
    };
    render(<UpcomingTasks payments={[completed]} startDate="2026-09-20" onCopyTask={onCopyTask} />);

    const copyButton = screen.getByTestId('button-upcoming-copy') as HTMLButtonElement;
    expect(copyButton.disabled).toBe(false);
    fireEvent.click(copyButton);

    expect(onCopyTask).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-09-10',
      payment: expect.objectContaining({ id: 'completed-copy' }),
    }));
  });

  it('applies the selected status filter to the list', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const overdue = { ...makePayment(0), id: 'overdue-list', title: 'Просроченная', date: '2026-09-19' };
    const today = { ...makePayment(0), id: 'today-list', title: 'Сегодняшняя', date: '2026-09-20' };
    const pending = { ...makePayment(1), id: 'pending-list', title: 'Предстоящая', date: '2026-09-21' };
    const paid = { ...makePayment(2), id: 'paid-list', title: 'Выполненная', date: '2026-09-22', paidDates: ['2026-09-22'] };
    const { rerender } = render(
      <UpcomingTasks payments={[overdue, today, pending, paid]} startDate="2026-09-20" filter="pending" />,
    );

    expect(screen.getByText('Предстоящая')).toBeTruthy();
    expect(screen.queryByText('Просроченная')).toBeNull();
    expect(screen.queryByText('Сегодняшняя')).toBeNull();
    expect(screen.queryByText('Выполненная')).toBeNull();

    rerender(<UpcomingTasks payments={[overdue, today, pending, paid]} startDate="2026-09-20" filter="overdue" />);
    expect(screen.getByText('Просроченная')).toBeTruthy();
    expect(screen.getByText('Сегодняшняя')).toBeTruthy();
    expect(screen.queryByText('Предстоящая')).toBeNull();

    rerender(<UpcomingTasks payments={[overdue, today, pending, paid]} startDate="2026-09-20" filter="paid" />);
    expect(screen.getByText('Выполненная')).toBeTruthy();
    expect(screen.queryByText('Предстоящая')).toBeNull();
  });

  it('renders completed list tasks in the neutral tone', () => {
    const paid = { ...makePayment(0), id: 'paid-tone', title: 'Серая выполненная', date: '2026-09-20', paidDates: ['2026-09-20'] };
    render(<UpcomingTasks payments={[paid]} startDate="2026-09-20" filter="paid" />);

    expect(screen.getByTestId('payment-row-paid-tone-2026-09-20').className).toContain('bg-theme-main');
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

  it('focuses the first overdue incomplete plan instead of a completed past plan', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const onEditTask = vi.fn();
    const completedPast = {
      ...makePayment(0),
      id: 'completed-past',
      title: 'Уже выполненная',
      date: '2026-09-10',
      paidDates: ['2026-09-10'],
    };
    const overdue = {
      ...makePayment(1),
      id: 'first-overdue',
      title: 'Первая просрочка',
      date: '2026-09-18',
    };
    const future = {
      ...makePayment(2),
      id: 'nearest-future',
      title: 'Ближайший план',
      date: '2026-09-25',
    };

    render(
      <UpcomingTasks
        payments={[completedPast, overdue, future]}
        startDate="2026-09-20"
        onEditTask={onEditTask}
      />,
    );

    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    fireEvent.click(screen.getByTestId('button-plan-view-edit'));

    expect(onEditTask).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-09-18',
      payment: expect.objectContaining({ id: 'first-overdue' }),
    }));
  });

  it('focuses the nearest incomplete future plan when there are no overdue plans', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const onEditTask = vi.fn();
    const completedPast = {
      ...makePayment(0),
      id: 'completed-past',
      title: 'Уже выполненная',
      date: '2026-09-10',
      paidDates: ['2026-09-10'],
    };
    const nearestFuture = {
      ...makePayment(1),
      id: 'nearest-future',
      title: 'Ближайший план',
      date: '2026-09-21',
    };
    const laterFuture = {
      ...makePayment(2),
      id: 'later-future',
      title: 'Более поздний план',
      date: '2026-09-25',
    };

    render(
      <UpcomingTasks
        payments={[completedPast, nearestFuture, laterFuture]}
        startDate="2026-09-20"
        onEditTask={onEditTask}
      />,
    );

    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    fireEvent.click(screen.getByTestId('button-plan-view-edit'));

    expect(onEditTask).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-09-21',
      payment: expect.objectContaining({ id: 'nearest-future' }),
    }));
  });

  it('opens the list at the focused task and keeps earlier tasks above the initial window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 12));
    const completedPast = Array.from({ length: 30 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return {
        ...makePayment(index),
        id: `completed-past-${index}`,
        title: `Прошлый план ${index}`,
        date: `2026-09-${day}`,
        paidDates: [`2026-09-${day}`],
      };
    });
    const focusedOverdue = {
      ...makePayment(30),
      id: 'focused-overdue',
      title: 'Первая просрочка',
      date: '2026-10-01',
    };

    render(
      <UpcomingTasks
        payments={[...completedPast, focusedOverdue]}
        startDate="2026-10-02"
      />,
    );

    const list = screen.getByTestId('upcoming-tasks-list');
    const firstRow = list.querySelector('[data-testid^="payment-row-"]');

    expect(firstRow?.getAttribute('data-testid')).toBe('payment-row-focused-overdue-2026-10-01');
    expect(screen.getByText('Первая просрочка')).toBeTruthy();
    expect(screen.queryByText('Прошлый план 0')).toBeNull();
    expect(screen.getByTestId('button-upcoming-load-previous')).toBeTruthy();
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 12));
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