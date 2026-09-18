import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByText(/Ежемесячно/)).toBeTruthy();
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

  it('opens the create form and sends a valid payment', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onPaymentChange = vi.fn();
    render(<PaymentCalendarTab payments={[]} accounts={[]} onPaymentChange={onPaymentChange} />);

    fireEvent.click(screen.getByTestId('button-add-first-payment'));
    fireEvent.change(screen.getByTestId('input-payment-title'), { target: { value: 'Интернет' } });
    fireEvent.change(screen.getByTestId('input-payment-amount'), { target: { value: '900' } });
    fireEvent.click(screen.getByTestId('button-save-payment'));

    expect(onPaymentChange).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Интернет',
      amount: 900,
      recurrence: 'none',
    }));
  });
});