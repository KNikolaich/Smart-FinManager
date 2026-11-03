import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentCalendarTab from './PaymentCalendarTab';
import type { Category, PlannedPayment } from '../types';

const categories: Category[] = [
  { id: 'tutor', userId: 'u', name: 'Репетитор', type: 'expense', icon: '📚', color: '#000' },
];

const basePlan: PlannedPayment = {
  id: 'tutor-plan',
  title: 'Репетитор',
  amount: 2500,
  date: '2026-09-21',
  recurrence: 'none',
  status: 'pending',
  paidDates: [],
  transactionType: 'expense',
  categoryId: 'tutor',
};

describe('PaymentCalendarTab plan colours', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the category icon on the plan colour instead of the dot', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    render(<PaymentCalendarTab payments={[{ ...basePlan, color: '#2563eb' }]} accounts={[]} categories={categories} />);

    const day = screen.getByTestId('calendar-day-2026-09-21');
    const markers = within(day).getAllByTestId('plan-marker-icon');
    expect(markers.length).toBeGreaterThan(0);
    expect(markers[0].getAttribute('data-plan-color')).toBe('#2563eb');
    expect(markers[0].textContent).toBe('📚');
    expect(within(day).queryByTestId('plan-marker-dot')).toBeNull();
  });

  it('keeps the default dot when the plan has no colour (including old named values)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    render(<PaymentCalendarTab payments={[{ ...basePlan, color: 'plum' }]} accounts={[]} categories={categories} />);

    const day = screen.getByTestId('calendar-day-2026-09-21');
    expect(within(day).getAllByTestId('plan-marker-dot').length).toBeGreaterThan(0);
    expect(within(day).queryByTestId('plan-marker-icon')).toBeNull();
  });

  it('saves the colour picked in the plan form', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 18, 12));
    const onPaymentChange = vi.fn();
    render(<PaymentCalendarTab payments={[]} accounts={[]} categories={categories} onPaymentChange={onPaymentChange} />);

    fireEvent.click(screen.getByTestId('button-add-payment'));
    expect(screen.getByTestId('payment-color-default').getAttribute('aria-checked')).toBe('true');
    fireEvent.change(screen.getByTestId('input-payment-title'), { target: { value: 'Дорожные' } });
    fireEvent.change(screen.getByTestId('input-payment-amount'), { target: { value: '300' } });
    fireEvent.click(screen.getByTestId('payment-color-16a34a'));
    expect(screen.getByTestId('payment-color-16a34a').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('button-save-payment'));

    expect(onPaymentChange).toHaveBeenLastCalledWith(expect.objectContaining({ color: '#16a34a' }), expect.anything());
  });
});
