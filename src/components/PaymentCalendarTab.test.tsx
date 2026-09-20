import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentCalendarTab from './PaymentCalendarTab';
import type { PlannedPayment } from '../types';

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
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    render(<PaymentCalendarTab payments={[payment]} accounts={[]} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));

    expect(screen.getByTestId('payment-row-rent-2026-09-05')).toBeTruthy();
    expect(screen.getAllByText(/Ежемесячно/).length).toBeGreaterThan(0);
    expect(screen.getByText('Календарный план')).toBeTruthy();
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

  it('toggles the selected occurrence status', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onStatusChange = vi.fn();
    render(<PaymentCalendarTab payments={[payment]} accounts={[]} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));
    fireEvent.click(screen.getByTestId('button-toggle-payment-rent-2026-09-05'));

    expect(onStatusChange).toHaveBeenCalledWith('rent', '2026-09-05', 'paid');
  });

  it('filters the calendar to overdue occurrences', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const futurePayment = { ...payment, id: 'future', title: 'Будущий платёж', date: '2026-09-20' };
    render(<PaymentCalendarTab payments={[payment, futurePayment]} accounts={[]} />);

    fireEvent.change(screen.getByTestId('select-payment-filter'), { target: { value: 'overdue' } });

    expect(within(screen.getByTestId('calendar-day-2026-09-05')).getByText('Аренда')).toBeTruthy();
    expect(within(screen.getByTestId('calendar-day-2026-09-20')).queryByText('Будущий платёж')).toBeNull();
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
    expect(onRequestTransaction).toHaveBeenCalledWith(weekly, '2026-09-16');

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-18'));
    expect(screen.getByTestId('payment-row-biweekly-2026-09-18')).toBeTruthy();
  });

  it('opens the create form and sends a valid payment', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onPaymentChange = vi.fn();
    render(<PaymentCalendarTab payments={[]} accounts={[]} onPaymentChange={onPaymentChange} />);

    fireEvent.click(screen.getByTestId('button-add-first-payment'));
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
    }));
  });

  it('opens the focused task in the edit form from the header', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    render(<PaymentCalendarTab payments={[payment]} accounts={[]} />);

    fireEvent.click(screen.getByTestId('calendar-day-2026-09-05'));
    expect(screen.getByTestId('calendar-day-2026-09-05').className).toContain('border-dashed');
    fireEvent.click(screen.getByTestId('button-upcoming-edit'));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('Изменить');
  });
});