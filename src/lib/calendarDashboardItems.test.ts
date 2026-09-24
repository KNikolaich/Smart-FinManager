import { describe, expect, it } from 'vitest';
import type { CalendarNote, PlannedPayment } from '../types';
import { getPaymentOccurrencesInRange } from './plannedPaymentOccurrences';
import { mergeCalendarDashboardItems } from './calendarDashboardItems';

const payment = (id: string, title: string, date: string): PlannedPayment => ({
  id,
  title,
  amount: 100,
  date,
  recurrence: 'none',
  status: 'pending',
});

describe('mergeCalendarDashboardItems', () => {
  it('merges notes and planned payments into one date-sorted queue', () => {
    const payments = [
      payment('payment-later', 'Оплата', '2026-10-06'),
      payment('payment-first', 'Перевод', '2026-10-03'),
    ];
    const notes: CalendarNote[] = [
      { id: 'note-later', date: '2026-10-05', text: 'Позвонить' },
      { id: 'note-first', date: '2026-10-02', text: 'Вернуть деньги' },
    ];
    const occurrences = getPaymentOccurrencesInRange(payments, '2026-10-01', '2026-10-10');

    const items = mergeCalendarDashboardItems(occurrences, notes, '2026-10-01', 7);

    expect(items.map(item => `${item.date}:${item.kind}`)).toEqual([
      '2026-10-02:note',
      '2026-10-03:payment',
      '2026-10-05:note',
      '2026-10-06:payment',
    ]);
  });

  it('keeps notes out of the dashboard queue when they are before the start date', () => {
    const note: CalendarNote = {
      id: 'past-note',
      date: '2026-09-30',
      text: 'Прошедшее напоминание',
    };

    expect(mergeCalendarDashboardItems([], [note], '2026-10-01', 7)).toEqual([]);
  });

  it('places planned payments before notes when their dates are equal', () => {
    const paymentOccurrence = getPaymentOccurrencesInRange(
      [payment('same-day', 'Оплата', '2026-10-05')],
      '2026-10-05',
      '2026-10-05',
    );
    const note: CalendarNote = {
      id: 'same-day-note',
      date: '2026-10-05',
      text: 'Напоминание',
    };

    expect(mergeCalendarDashboardItems(paymentOccurrence, [note], '2026-10-01', 7).map(item => item.kind))
      .toEqual(['payment', 'note']);
  });
});