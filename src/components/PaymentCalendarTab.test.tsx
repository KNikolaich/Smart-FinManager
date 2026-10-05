import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentCalendarTab from './PaymentCalendarTab';
import type { Account, CalendarNote, PlannedPayment } from '../types';

const payment: PlannedPayment = {
  id: 'rent',
  title: 'Аренда',
  amount: 45000,
  date: '2026-09-05',
  recurrence: 'monthly',
  status: 'pending',
  paidDates: [],
  accountName: 'Основная карта',
};

describe('PaymentCalendarTab', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a recurring payment on its occurrence day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    render(<PaymentCalendarTab payments={[payment]} accounts={[]} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));

    expect(screen.getByTestId('payment-row-rent-2026-09-05')).toBeTruthy();
    expect(screen.getAllByText(/Ежемесячно/).length).toBeGreaterThan(0);
    expect(screen.getByText('Календарный план')).toBeTruthy();
  });

  it('opens a fresh create dialog prefilled with an AI calendar-plan draft', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 24, 12));
    const onInitialPaymentCreateHandled = vi.fn();

    render(
      <PaymentCalendarTab
        payments={[]}
        accounts={[]}
        categories={[]}
        initialPaymentToCreate={{
          title: 'Аренда',
          amount: 32000,
          date: '2026-10-01',
          recurrence: 'monthly',
          note: 'Списывать в начале месяца',
        }}
        onInitialPaymentCreateHandled={onInitialPaymentCreateHandled}
      />,
    );

    await waitFor(() => {
      expect((screen.getByTestId('input-payment-title') as HTMLInputElement).value).toBe('Аренда');
      expect((screen.getByTestId('input-payment-amount') as HTMLInputElement).value).toBe('32000');
      expect((screen.getByTestId('input-payment-date') as HTMLInputElement).value).toBe('2026-10-01');
      expect((screen.getByTestId('input-payment-note') as HTMLTextAreaElement).value).toBe('Списывать в начале месяца');
      expect(screen.getByTestId('button-save-payment').textContent).toContain('Запланировать');
    });
    expect(onInitialPaymentCreateHandled).toHaveBeenCalledTimes(1);
  });

  it('opens and saves a calendar note draft without replacing existing notes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 24, 12));
    const existingNote: CalendarNote = {
      id: 'existing-note',
      date: '2026-09-25',
      text: 'Существующая заметка',
    };
    const onNotesChange = vi.fn<(nextNotes: CalendarNote[]) => Promise<void>>().mockResolvedValue(undefined);
    const onInitialNoteCreateHandled = vi.fn();

    render(
      <PaymentCalendarTab
        payments={[]}
        notes={[existingNote]}
        accounts={[]}
        categories={[]}
        onNotesChange={onNotesChange}
        initialNoteToCreate={{
          date: '2026-10-02',
          text: 'вернет. дал в долг Алехе 2000 с карты спб в буфер',
        }}
        onInitialNoteCreateHandled={onInitialNoteCreateHandled}
      />,
    );

    await waitFor(() => {
      expect((screen.getByTestId('input-calendar-note-date') as HTMLInputElement).value).toBe('2026-10-02');
      expect((screen.getByTestId('input-calendar-note-text') as HTMLTextAreaElement).value)
        .toBe('вернет. дал в долг Алехе 2000 с карты спб в буфер');
    });
    expect(onInitialNoteCreateHandled).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('button-save-calendar-note'));
    await waitFor(() => expect(onNotesChange).toHaveBeenCalledTimes(1));

    const savedNotes = onNotesChange.mock.calls[0][0];
    expect(savedNotes).toHaveLength(2);
    expect(savedNotes[0]).toEqual(existingNote);
    expect(savedNotes[1]).toEqual(expect.objectContaining({
      date: '2026-10-02',
      text: 'вернет. дал в долг Алехе 2000 с карты спб в буфер',
    }));
    expect(savedNotes[1].id).not.toBe(existingNote.id);
  });

  it('creates, displays, edits, and deletes a standalone calendar note', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onNotesChange = vi.fn<(nextNotes: CalendarNote[]) => Promise<void>>().mockResolvedValue(undefined);
    const { rerender } = render(
      <PaymentCalendarTab payments={[payment]} notes={[]} accounts={[]} onNotesChange={onNotesChange} />,
    );

    fireEvent.click(screen.getByTestId('button-add-calendar-note'));
    fireEvent.change(screen.getByTestId('input-calendar-note-date'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByTestId('input-calendar-note-text'), { target: { value: 'Позвонить в банк' } });
    fireEvent.click(screen.getByTestId('button-save-calendar-note'));
    await waitFor(() => expect(onNotesChange).toHaveBeenCalledTimes(1));

    const createdNotes = onNotesChange.mock.calls[0][0];
    expect(createdNotes).toEqual([expect.objectContaining({
      date: '2026-09-20',
      text: 'Позвонить в банк',
    })]);

    rerender(
      <PaymentCalendarTab payments={[payment]} notes={createdNotes} accounts={[]} onNotesChange={onNotesChange} />,
    );
    expect(screen.getByTestId(`calendar-note-chip-${createdNotes[0].id}`)).toBeTruthy();
    fireEvent.click(screen.getByTestId(`calendar-note-row-${createdNotes[0].id}`));
    expect(screen.getByTestId('dialog-calendar-note').textContent).toContain('Позвонить в банк');

    fireEvent.click(screen.getByTestId('button-edit-calendar-note'));
    fireEvent.change(screen.getByTestId('input-calendar-note-text'), { target: { value: 'Позвонить в банк утром' } });
    fireEvent.click(screen.getByTestId('button-save-calendar-note'));
    await waitFor(() => expect(onNotesChange).toHaveBeenCalledTimes(2));
    const editedNotes = onNotesChange.mock.calls[1][0];
    expect(editedNotes[0].text).toBe('Позвонить в банк утром');

    rerender(
      <PaymentCalendarTab payments={[payment]} notes={editedNotes} accounts={[]} onNotesChange={onNotesChange} />,
    );
    fireEvent.click(screen.getByTestId(`calendar-note-row-${editedNotes[0].id}`));
    fireEvent.click(screen.getByTestId('button-delete-calendar-note'));
    fireEvent.click(screen.getByTestId('button-confirm-delete-calendar-note'));
    await waitFor(() => expect(onNotesChange).toHaveBeenCalledTimes(3));
    expect(onNotesChange.mock.calls[2][0]).toEqual([]);
  });

  it('creates and copies a standalone note from the plans list', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onNotesChange = vi.fn<(nextNotes: CalendarNote[]) => Promise<void>>().mockResolvedValue(undefined);
    const { rerender } = render(
      <PaymentCalendarTab payments={[]} notes={[]} accounts={[]} onNotesChange={onNotesChange} />,
    );

    fireEvent.click(screen.getByTestId('button-add-calendar-note-from-list'));
    fireEvent.change(screen.getByTestId('input-calendar-note-text'), { target: { value: 'Позвонить в банк' } });
    fireEvent.click(screen.getByTestId('button-save-calendar-note'));
    await waitFor(() => expect(onNotesChange).toHaveBeenCalledTimes(1));

    const originalNotes = onNotesChange.mock.calls[0][0];
    expect(originalNotes[0]).toEqual(expect.objectContaining({
      date: '2026-09-18',
      text: 'Позвонить в банк',
    }));
    rerender(
      <PaymentCalendarTab payments={[]} notes={originalNotes} accounts={[]} onNotesChange={onNotesChange} />,
    );

    fireEvent.click(screen.getByTestId(`calendar-note-row-${originalNotes[0].id}`));
    fireEvent.click(screen.getByLabelText('Закрыть записку'));
    fireEvent.click(screen.getByTestId('button-upcoming-copy'));

    expect((screen.getByTestId('input-calendar-note-date') as HTMLInputElement).value).toBe('2026-09-18');
    expect((screen.getByTestId('input-calendar-note-text') as HTMLTextAreaElement).value).toBe('Позвонить в банк');
    fireEvent.click(screen.getByTestId('button-save-calendar-note'));
    await waitFor(() => expect(onNotesChange).toHaveBeenCalledTimes(2));

    const copiedNotes = onNotesChange.mock.calls[1][0];
    expect(copiedNotes).toHaveLength(2);
    expect(copiedNotes[1]).toEqual(expect.objectContaining({
      date: '2026-09-18',
      text: 'Позвонить в банк',
    }));
    expect(copiedNotes[1].id).not.toBe(originalNotes[0].id);
  });

  it('shows occurrences in the visible spillover days from adjacent months', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const adjacentPayments: PlannedPayment[] = [
      { ...payment, id: 'previous-month', title: 'Конец прошлого месяца', date: '2026-08-31', recurrence: 'none' },
      { ...payment, id: 'next-month', title: 'Начало следующего месяца', date: '2026-10-01', recurrence: 'none' },
    ];
    render(<PaymentCalendarTab payments={adjacentPayments} accounts={[]} />);

    expect(within(screen.getByTestId('calendar-day-2026-08-31')).getByText('Конец прошлого месяца')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-day-2026-10-01')).getByText('Начало следующего месяца')).toBeTruthy();
  });

  it('stops generating recurring occurrences after the inclusive disable date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const disabledPayment = {
      ...payment,
      id: 'disabled-rent',
      date: '2026-09-02',
      recurrence: 'weekly' as const,
      disableFrom: '2026-09-16',
    };
    render(<PaymentCalendarTab payments={[disabledPayment]} accounts={[]} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-16'));
    expect(screen.getByTestId('payment-row-disabled-rent-2026-09-16')).toBeTruthy();

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-23'));
    expect(screen.queryByTestId('payment-row-disabled-rent-2026-09-23')).toBeNull();
  });

  it('toggles the selected occurrence status', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onStatusChange = vi.fn();
    render(<PaymentCalendarTab payments={[payment]} accounts={[]} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));
    fireEvent.click(screen.getByTestId('button-toggle-payment-rent-2026-09-05'));

    expect(onStatusChange).toHaveBeenCalledWith('rent', '2026-09-05', 'paid');
  });

  it('updates the plan immediately when a transaction is created from its checkbox', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onRequestTransaction = vi.fn();
    const onTransactionCreated = vi.fn();
    render(
      <PaymentCalendarTab
        payments={[payment]}
        accounts={[]}
        onRequestTransaction={onRequestTransaction}
        onTransactionCreated={onTransactionCreated}
      />,
    );

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));
    fireEvent.click(screen.getByTestId('button-toggle-payment-rent-2026-09-05'));

    const onCreated = onRequestTransaction.mock.calls[0][2] as (transactionId: string) => void;
    onCreated('transaction-rent');

    expect(onTransactionCreated).toHaveBeenCalledWith('rent', '2026-09-05', 'transaction-rent');
  });

  it('filters the calendar to overdue occurrences', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const futurePayment = { ...payment, id: 'future', title: 'Будущий платёж', date: '2026-09-20' };
    const todayPayment = { ...payment, id: 'today', title: 'Сегодняшний платёж', date: '2026-09-18', recurrence: 'none' as const };
    render(<PaymentCalendarTab payments={[payment, todayPayment, futurePayment]} accounts={[]} />);

    fireEvent.change(screen.getByTestId('select-payment-filter'), { target: { value: 'overdue' } });

    expect(within(screen.getByTestId('calendar-day-2026-09-05')).getByText('Аренда')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-day-2026-09-18')).getByText('Сегодняшний платёж')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-day-2026-09-20')).queryByText('Будущий платёж')).toBeNull();
  });

  it('uses the overdue color for an occurrence scheduled today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const todayPayment = { ...payment, id: 'today-tone', title: 'Сегодня красным', date: '2026-09-18', recurrence: 'none' as const };
    render(<PaymentCalendarTab payments={[todayPayment]} accounts={[]} />);

    const planLabel = within(screen.getByTestId('calendar-day-2026-09-18')).getByText('Сегодня красным');
    expect(planLabel.parentElement?.className).toContain('bg-red-100');
  });

  it('supports weekly and biweekly occurrences and opens a transaction draft', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onRequestTransaction = vi.fn();
    const weekly = { ...payment, id: 'weekly', date: '2026-09-02', recurrence: 'weekly' as const };
    const biweekly = { ...payment, id: 'biweekly', date: '2026-09-04', recurrence: 'biweekly' as const };
    render(
      <PaymentCalendarTab
        payments={[weekly, biweekly]}
        accounts={[]}
        onRequestTransaction={onRequestTransaction}
      />,
    );

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-16'));
    expect(screen.getByTestId('payment-row-weekly-2026-09-16')).toBeTruthy();
    fireEvent.click(screen.getByTestId('button-toggle-payment-weekly-2026-09-16'));
    expect(onRequestTransaction).toHaveBeenCalledWith(weekly, '2026-09-16', expect.any(Function));

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-18'));
    expect(screen.getByTestId('payment-row-biweekly-2026-09-18')).toBeTruthy();
  });

  it('opens the create form and sends a valid payment', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onPaymentChange = vi.fn();
    render(<PaymentCalendarTab payments={[]} accounts={[]} onPaymentChange={onPaymentChange} />);

    fireEvent.click(screen.getByTestId('button-add-payment'));
    expect(screen.getByText('Новая запись')).toBeTruthy();
    expect(screen.getByTestId('button-save-payment').textContent).toContain('Запланировать');
    expect(screen.queryByText(/Todoist/i)).toBeNull();
    fireEvent.change(screen.getByTestId('input-payment-title'), { target: { value: 'Интернет' } });
    fireEvent.change(screen.getByTestId('input-payment-amount'), { target: { value: '900' } });
    fireEvent.click(screen.getByTestId('button-save-payment'));

    expect(onPaymentChange).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Интернет',
      amount: 900,
      recurrence: 'none',
    }), { originalDate: undefined, scope: undefined });
  });

  it('opens the same edit form for a payment requested from the dashboard', () => {
    const onInitialPaymentEditHandled = vi.fn();
    render(
      <PaymentCalendarTab
        payments={[payment]}
        accounts={[]}
        initialPaymentToEdit={payment}
        onInitialPaymentEditHandled={onInitialPaymentEditHandled}
      />,
    );

    expect(screen.getByText('Изменить')).toBeTruthy();
    expect((screen.getByTestId('input-payment-title') as HTMLInputElement).value).toBe('Аренда');
    expect(onInitialPaymentEditHandled).toHaveBeenCalledTimes(1);
  });

  it('uses the focused occurrence date as the starting date in the edit form', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const weeklyPayment = { ...payment, date: '2026-09-02', recurrence: 'weekly' as const };
    render(<PaymentCalendarTab payments={[weeklyPayment]} accounts={[]} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-16'));
    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    fireEvent.click(screen.getByTestId('button-plan-view-edit'));

    expect((screen.getByTestId('input-payment-date') as HTMLInputElement).value).toBe('2026-09-16');
  });

  it('lets a plan repeat on selected weekdays and keeps the account picker grouped', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 21, 12));
    const account: Account = {
      id: 'account-1',
      userId: 'user-1',
      name: 'Основная карта',
      type: 'card',
      balance: 12345,
      currency: 'RUB',
      showOnDashboard: true,
      showInTotals: true,
    };
    render(<PaymentCalendarTab payments={[]} accounts={[account]} />);

    fireEvent.click(screen.getByTestId('button-add-payment'));
    fireEvent.change(screen.getByTestId('input-payment-title'), { target: { value: 'Дорога ребенку' } });
    fireEvent.change(screen.getByTestId('input-payment-amount'), { target: { value: '300' } });
    fireEvent.change(screen.getByTestId('select-payment-recurrence'), { target: { value: 'weekdays' } });

    expect(screen.getByTestId('payment-weekday-picker')).toBeTruthy();
    expect(screen.getByTestId('weekday-1').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('weekday-2'));
    fireEvent.click(screen.getByText('Основная карта'));

    expect(document.body.textContent).toMatch(/12[\s,.\u00a0]?345\s+RUB/);
    expect(screen.getByTestId('weekday-2').getAttribute('aria-pressed')).toBe('true');
  });

  it('places an optional time immediately after the date and saves it with a new plan', async () => {
    const onPaymentChange = vi.fn().mockResolvedValue(undefined);
    render(<PaymentCalendarTab payments={[]} accounts={[]} onPaymentChange={onPaymentChange} />);

    fireEvent.click(screen.getByTestId('button-add-payment'));
    const dateInput = screen.getByTestId('input-payment-date');
    const timeInput = screen.getByTestId('input-payment-time') as HTMLInputElement;
    expect(dateInput.compareDocumentPosition(timeInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(timeInput.value).toBe('');

    fireEvent.change(screen.getByTestId('input-payment-title'), { target: { value: 'Утренний платёж' } });
    fireEvent.change(screen.getByTestId('input-payment-amount'), { target: { value: '1000' } });
    fireEvent.change(timeInput, { target: { value: '08:00' } });
    fireEvent.click(screen.getByTestId('button-save-payment'));

    await waitFor(() => expect(onPaymentChange).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Утренний платёж',
      time: '08:00',
    }), expect.anything()));
  });

  it('keeps an empty calendar grid while showing plans outside the current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const plansOutsideMonth: PlannedPayment[] = [
      { ...payment, id: 'past-plan', title: 'Прошлый план', date: '2026-08-31', recurrence: 'none' },
      { ...payment, id: 'future-plan', title: 'Будущий план', date: '2026-10-01', recurrence: 'none' },
    ];
    render(<PaymentCalendarTab payments={plansOutsideMonth} accounts={[]} />);

    expect(screen.getByTestId('calendar-day-2026-09-01')).toBeTruthy();
    expect(screen.queryByText('В этом месяце нет запланированных записей')).toBeNull();
    expect(screen.queryByText(/Добавьте регулярную операцию/)).toBeNull();
    expect(screen.getByTestId('payment-row-past-plan-2026-08-31')).toBeTruthy();
    expect(screen.getByTestId('payment-row-future-plan-2026-10-01')).toBeTruthy();
  });

  it('opens the focused task viewer and starts editing from there', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    render(<PaymentCalendarTab payments={[payment]} accounts={[]} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));
    expect(screen.getByTestId('calendar-day-2026-09-05').className).toContain('ring-2');
    fireEvent.click(screen.getByTestId('button-upcoming-view'));
    expect(screen.getByTestId('dialog-plan-view')).toBeTruthy();
    fireEvent.click(screen.getByTestId('button-plan-view-edit'));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('Изменить');
  });

  it('opens a completed plan copy as a new record dated today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onPaymentChange = vi.fn();
    const completedPayment: PlannedPayment = {
      ...payment,
      id: 'completed-rent',
      date: '2026-09-05',
      paidDates: ['2026-09-05'],
      status: 'pending',
    };
    render(<PaymentCalendarTab payments={[completedPayment]} accounts={[]} onPaymentChange={onPaymentChange} />);

    fireEvent.click(screen.getByTestId('button-upcoming-copy'));

    expect(screen.getByRole('dialog').textContent).toContain('Новая запись');
    expect((screen.getByTestId('input-payment-date') as HTMLInputElement).value).toBe('2026-09-18');
    fireEvent.click(screen.getByTestId('button-save-payment'));

    expect(onPaymentChange).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.not.stringMatching(/^completed-rent$/),
      title: 'Аренда',
      date: '2026-09-18',
      status: 'pending',
      paidDates: [],
      occurrences: [],
      disableFrom: null,
    }), { originalDate: undefined, scope: undefined });
  });

  it('passes the focused occurrence date when disabling a plan', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onPaymentDelete = vi.fn();
    render(<PaymentCalendarTab payments={[payment]} accounts={[]} onPaymentDelete={onPaymentDelete} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));
    fireEvent.click(screen.getByTestId('button-upcoming-delete'));
    fireEvent.click(screen.getByTestId('button-upcoming-delete-confirm'));

    expect(onPaymentDelete).toHaveBeenCalledWith('rent', '2026-09-05');
  });

  describe('editing an event of a recurring plan', () => {
    // 2026-09-14 is a Monday; the series repeats on Mon, Wed and Fri.
    const mwf: PlannedPayment = {
      id: 'mwf',
      title: 'Секция',
      amount: 1500,
      date: '2026-09-07',
      recurrence: 'weekdays',
      weekdays: [1, 3, 5],
      status: 'pending',
      paidDates: [],
      occurrences: [],
    };

    const openEventEditor = (onPaymentChange = vi.fn().mockResolvedValue(undefined)) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 8, 10, 12));
      render(<PaymentCalendarTab payments={[mwf]} accounts={[]} onPaymentChange={onPaymentChange} />);
      fireEvent.click(screen.getByTestId('calendar-day-2026-09-14'));
      fireEvent.click(screen.getByTestId('button-upcoming-view'));
      fireEvent.click(screen.getByTestId('button-plan-view-edit'));
      return onPaymentChange;
    };

    it('asks whether to change only this event or all following ones', () => {
      const onPaymentChange = openEventEditor();

      expect(screen.getByTestId('payment-recurring-event-hint').textContent).toContain('14.09.2026');
      fireEvent.change(screen.getByTestId('input-payment-date'), { target: { value: '2026-09-15' } });
      fireEvent.click(screen.getByTestId('button-save-payment'));

      expect(screen.getByTestId('dialog-recurring-edit-scope')).toBeTruthy();
      expect(onPaymentChange).not.toHaveBeenCalled();
    });

    it('moves only this event to another day', async () => {
      const onPaymentChange = openEventEditor();

      fireEvent.change(screen.getByTestId('input-payment-date'), { target: { value: '2026-09-15' } });
      fireEvent.click(screen.getByTestId('button-save-payment'));
      fireEvent.click(screen.getByTestId('button-edit-scope-single'));

      await waitFor(() => expect(onPaymentChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mwf', date: '2026-09-15' }),
        { originalDate: '2026-09-14', scope: 'single' },
      ));
      await waitFor(() => expect(screen.queryByTestId('dialog-recurring-edit-scope')).toBeNull());
    });

    it('does not apply a day outside the series weekdays to all following events', () => {
      const onPaymentChange = openEventEditor();

      fireEvent.change(screen.getByTestId('input-payment-date'), { target: { value: '2026-09-15' } });
      fireEvent.click(screen.getByTestId('button-save-payment'));

      const following = screen.getByTestId('button-edit-scope-following') as HTMLButtonElement;
      expect(following.disabled).toBe(true);
      expect(screen.getByTestId('edit-scope-series-warning').textContent).toContain('вторник');
      fireEvent.click(following);
      expect(onPaymentChange).not.toHaveBeenCalled();
    });

    it('applies a day that belongs to the series to all following events', async () => {
      const onPaymentChange = openEventEditor();

      fireEvent.change(screen.getByTestId('input-payment-date'), { target: { value: '2026-09-16' } });
      fireEvent.change(screen.getByTestId('input-payment-amount'), { target: { value: '1800' } });
      fireEvent.click(screen.getByTestId('button-save-payment'));
      fireEvent.click(screen.getByTestId('button-edit-scope-following'));

      await waitFor(() => expect(onPaymentChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mwf', date: '2026-09-16', amount: 1800, weekdays: [1, 3, 5] }),
        { originalDate: '2026-09-14', scope: 'following' },
      ));
    });

    it('keeps the editor open when the scope question is cancelled', () => {
      const onPaymentChange = openEventEditor();

      fireEvent.click(screen.getByTestId('button-save-payment'));
      fireEvent.click(screen.getByTestId('button-edit-scope-cancel'));

      expect(screen.queryByTestId('dialog-recurring-edit-scope')).toBeNull();
      expect(screen.getByTestId('input-payment-title')).toBeTruthy();
      expect(onPaymentChange).not.toHaveBeenCalled();
    });

    it('saves a one-time plan without asking about the series', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 8, 10, 12));
      const onPaymentChange = vi.fn().mockResolvedValue(undefined);
      const oneTime = { ...mwf, id: 'once', recurrence: 'none' as const, weekdays: undefined, date: '2026-09-14' };
      render(<PaymentCalendarTab payments={[oneTime]} accounts={[]} onPaymentChange={onPaymentChange} initialPaymentToEdit={oneTime} />);

      fireEvent.change(screen.getByTestId('input-payment-date'), { target: { value: '2026-09-15' } });
      fireEvent.click(screen.getByTestId('button-save-payment'));

      expect(screen.queryByTestId('dialog-recurring-edit-scope')).toBeNull();
      await waitFor(() => expect(onPaymentChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'once', date: '2026-09-15' }),
        { originalDate: '2026-09-14', scope: undefined },
      ));
    });
  });

  it('refuses to create a weekday series whose date is not one of its weekdays', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 21, 12)); // Monday
    const onPaymentChange = vi.fn();
    render(<PaymentCalendarTab payments={[]} accounts={[]} onPaymentChange={onPaymentChange} />);

    fireEvent.click(screen.getByTestId('button-add-payment'));
    fireEvent.change(screen.getByTestId('input-payment-title'), { target: { value: 'Бассейн' } });
    fireEvent.change(screen.getByTestId('input-payment-amount'), { target: { value: '700' } });
    fireEvent.change(screen.getByTestId('select-payment-recurrence'), { target: { value: 'weekdays' } });
    fireEvent.click(screen.getByTestId('weekday-2'));
    fireEvent.click(screen.getByTestId('weekday-1'));
    fireEvent.click(screen.getByTestId('button-save-payment'));

    expect(onPaymentChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('не входит в дни повторения');

    fireEvent.change(screen.getByTestId('input-payment-date'), { target: { value: '2026-09-22' } });
    fireEvent.click(screen.getByTestId('button-save-payment'));
    expect(onPaymentChange).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-09-22', recurrence: 'weekdays', weekdays: [2] }),
      { originalDate: undefined, scope: undefined },
    );
  });

  describe('day cells', () => {
    // 2026-10-06 is a Tuesday.
    const plansOn = (count: number, date = '2026-10-06'): PlannedPayment[] =>
      Array.from({ length: count }, (_, index) => ({
        id: `day-plan-${index + 1}`,
        title: `План ${index + 1}`,
        amount: 100 * (index + 1),
        date,
        recurrence: 'none' as const,
        status: 'pending' as const,
        paidDates: [],
      }));
    const renderOctober = (payments: PlannedPayment[], notes: CalendarNote[] = []) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 1, 9));
      return render(<PaymentCalendarTab payments={payments} notes={notes} accounts={[]} />);
    };

    it('shows three plans of a day without a "more" row', () => {
      renderOctober(plansOn(3));
      const day = screen.getByTestId('calendar-day-2026-10-06');

      for (const title of ['План 1', 'План 2', 'План 3']) expect(within(day).getByText(title)).toBeTruthy();
      expect(within(day).queryByText(/ещё/)).toBeNull();
      expect(screen.queryByTestId('calendar-day-more-2026-10-06')).toBeNull();
    });

    it('collapses more than three entries into two rows and "+ ещё N"', () => {
      renderOctober(plansOn(2), [
        { id: 'note-a', date: '2026-10-06', text: 'Записка A' },
        { id: 'note-b', date: '2026-10-06', text: 'Записка B' },
      ]);
      const day = screen.getByTestId('calendar-day-2026-10-06');

      expect(within(day).getByText('План 1')).toBeTruthy();
      expect(within(day).getByText('План 2')).toBeTruthy();
      expect(within(day).queryByText('Записка A')).toBeNull();
      expect(screen.getByTestId('calendar-day-more-2026-10-06').textContent).toContain('+ ещё 2');
    });

    it('opens a list of every plan of the day from the triangle and closes it with Escape', () => {
      renderOctober(plansOn(5));
      const more = screen.getByTestId('calendar-day-more-2026-10-06');
      expect(more.textContent).toContain('+ ещё 3');
      expect(more.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(more);

      const list = screen.getByTestId('calendar-day-list-2026-10-06');
      for (const title of ['План 1', 'План 2', 'План 3', 'План 4', 'План 5']) {
        expect(within(list).getByText(title)).toBeTruthy();
      }
      expect(list.textContent).toContain('500 ₽');
      expect(more.getAttribute('aria-expanded')).toBe('true');

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('calendar-day-list-2026-10-06')).toBeNull();
    });

    it('selects the day from the list without selecting it from the triangle click', () => {
      renderOctober(plansOn(5));

      fireEvent.click(screen.getByTestId('calendar-day-more-2026-10-06'));
      expect(screen.getByTestId('calendar-day-2026-10-06').className).not.toContain('ring-2 ring-inset ring-theme-primary bg-theme-primary-light');

      fireEvent.click(within(screen.getByTestId('calendar-day-list-2026-10-06')).getByText('План 4'));
      expect(screen.queryByTestId('calendar-day-list-2026-10-06')).toBeNull();
      expect(screen.getByTestId('calendar-day-2026-10-06').className).toContain('ring-theme-primary');
    });

    it('keeps the date of every cell in the top-left corner', () => {
      renderOctober(plansOn(1));
      for (const key of ['2026-10-05', '2026-10-06']) {
        const day = screen.getByTestId(`calendar-day-${key}`);
        expect(day.className).toContain('flex-col');
        expect(day.className).toContain('justify-start');
        expect(day.className).toContain('text-left');
      }
    });

    it('is selectable with the keyboard', () => {
      renderOctober([]);
      const day = screen.getByTestId('calendar-day-2026-10-08');
      fireEvent.keyDown(day, { key: 'Enter' });
      expect(day.className).toContain('ring-theme-primary');
    });
  });

  describe('overdue plans with a time', () => {
    const todayPlans: PlannedPayment[] = [
      { id: 'at-1230', title: 'В 12:30', amount: 100, date: '2026-10-05', time: '12:30', recurrence: 'none', status: 'pending', paidDates: [] },
      { id: 'no-time', title: 'Без времени', amount: 100, date: '2026-10-05', recurrence: 'none', status: 'pending', paidDates: [] },
    ];
    const chip = (title: string) => within(screen.getByTestId('calendar-day-2026-10-05')).getByText(title).parentElement!;

    it('is not red on its day before its time and turns red once the time comes', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 5, 10, 0, 0));
      render(<PaymentCalendarTab payments={todayPlans} accounts={[]} />);

      expect(chip('В 12:30').className).not.toContain('bg-red-100');
      expect(chip('Без времени').className).toContain('bg-red-100');

      // 12:29 — still not overdue.
      act(() => { vi.advanceTimersByTime((2 * 60 + 29) * 60 * 1000 + 1000); });
      expect(chip('В 12:30').className).not.toContain('bg-red-100');

      // 12:30 — the minute clock re-renders the calendar on its own.
      act(() => { vi.advanceTimersByTime(60 * 1000); });
      expect(chip('В 12:30').className).toContain('bg-red-100');
    });

    it('is not counted as overdue by the filter before its time', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 5, 10, 0, 0));
      render(<PaymentCalendarTab payments={todayPlans} accounts={[]} />);

      fireEvent.change(screen.getByTestId('select-payment-filter'), { target: { value: 'overdue' } });

      const day = screen.getByTestId('calendar-day-2026-10-05');
      expect(within(day).queryByText('В 12:30')).toBeNull();
      expect(within(day).getByText('Без времени')).toBeTruthy();
    });
  });
});
