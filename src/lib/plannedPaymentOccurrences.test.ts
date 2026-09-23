import { describe, expect, it } from 'vitest';
import type { PlannedPayment } from '../types';
import { getPaymentOccurrencesInRange } from './plannedPaymentOccurrences';

describe('planned payment weekday recurrence', () => {
  it('generates only the selected weekdays', () => {
    const payment: PlannedPayment = {
      id: 'weekday-plan',
      title: 'Дорога ребенку',
      amount: 300,
      date: '2026-09-21',
      recurrence: 'weekdays',
      weekdays: [1, 2, 4, 5],
      status: 'pending',
    };

    const occurrences = getPaymentOccurrencesInRange(payment, '2026-09-21', '2026-09-27');

    expect(occurrences.map(item => item.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-24',
      '2026-09-25',
    ]);
  });

  it('keeps a stored completed date after the weekday selection changes', () => {
    const payment: PlannedPayment = {
      id: 'weekday-plan',
      title: 'Дорога ребенку',
      amount: 300,
      date: '2026-09-21',
      recurrence: 'weekdays',
      weekdays: [1, 2, 4, 5],
      status: 'pending',
      occurrences: [{
        id: 'old-occurrence',
        date: '2026-09-23',
        transactionId: 'transaction-1',
        manuallyCompleted: false,
      }],
    };

    const occurrences = getPaymentOccurrencesInRange(payment, '2026-09-21', '2026-09-27');

    expect(occurrences.map(item => item.date)).toContain('2026-09-23');
    expect(occurrences.find(item => item.date === '2026-09-23')?.status).toBe('pending');
    expect(occurrences.find(item => item.date === '2026-09-23')?.transactionId).toBe('transaction-1');
  });
});