import { describe, expect, it } from 'vitest';
import type { PlannedPayment } from '../types';
import {
  getPaymentOccurrencesForFilter,
  getPaymentOccurrencesInRange,
  isPlanOccurrenceOverdue,
  matchesPlanRecurrence,
} from './plannedPaymentOccurrences';
import { afterEach, vi } from 'vitest';

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
describe('planned payment excluded dates', () => {
  const weekly: PlannedPayment = {
    id: 'weekly-plan',
    title: 'Уборка',
    amount: 2000,
    date: '2026-09-07',
    recurrence: 'weekly',
    status: 'pending',
    excludedDates: ['2026-09-14'],
  };

  it('skips a date detached from the series', () => {
    expect(getPaymentOccurrencesInRange(weekly, '2026-09-07', '2026-09-21').map(item => item.date))
      .toEqual(['2026-09-07', '2026-09-21']);
  });

  it('still shows a detached date that was already completed', () => {
    const completed: PlannedPayment = {
      ...weekly,
      occurrences: [{ id: 'occ', date: '2026-09-14', transactionId: 'tx-1', manuallyCompleted: false }],
    };
    expect(getPaymentOccurrencesInRange(completed, '2026-09-07', '2026-09-21').map(item => item.date))
      .toEqual(['2026-09-07', '2026-09-14', '2026-09-21']);
  });

  it('hides a detached date whose stored occurrence is not completed', () => {
    const stored: PlannedPayment = {
      ...weekly,
      occurrences: [{ id: 'occ', date: '2026-09-14', transactionId: null, manuallyCompleted: false }],
    };
    expect(getPaymentOccurrencesInRange(stored, '2026-09-07', '2026-09-21').map(item => item.date))
      .toEqual(['2026-09-07', '2026-09-21']);
  });
});

describe('matchesPlanRecurrence', () => {
  it('matches weekday series only on the selected weekdays', () => {
    const plan = { date: '2026-09-07', recurrence: 'weekdays' as const, weekdays: [1, 3, 5] };
    expect(matchesPlanRecurrence(plan, '2026-09-14')).toBe(true);
    expect(matchesPlanRecurrence(plan, '2026-09-15')).toBe(false);
    expect(matchesPlanRecurrence(plan, '2026-09-16')).toBe(true);
  });

  it('never matches before the series start', () => {
    expect(matchesPlanRecurrence({ date: '2026-09-07', recurrence: 'weekly' }, '2026-08-31')).toBe(false);
  });
});

describe('isPlanOccurrenceOverdue', () => {
  const at = (hours: number, minutes = 0) => new Date(2026, 9, 5, hours, minutes);

  it('treats past days as overdue and future days as not', () => {
    expect(isPlanOccurrenceOverdue('2026-10-04', '23:00', at(0, 1))).toBe(true);
    expect(isPlanOccurrenceOverdue('2026-10-06', undefined, at(23, 59))).toBe(false);
  });

  it('treats a plan for today without a time as overdue all day', () => {
    expect(isPlanOccurrenceOverdue('2026-10-05', undefined, at(0, 0))).toBe(true);
    expect(isPlanOccurrenceOverdue('2026-10-05', '', at(0, 0))).toBe(true);
  });

  it('waits for the time of a plan for today', () => {
    expect(isPlanOccurrenceOverdue('2026-10-05', '12:30', at(12, 29))).toBe(false);
    expect(isPlanOccurrenceOverdue('2026-10-05', '12:30', at(12, 30))).toBe(true);
    expect(isPlanOccurrenceOverdue('2026-10-05', '12:30', at(18, 0))).toBe(true);
  });
});

describe('pending and overdue filters with a time', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps a plan later today pending until its time', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
    const plans: PlannedPayment[] = [
      { id: 'later', title: 'Позже', amount: 1, date: '2026-10-05', time: '12:30', recurrence: 'none', status: 'pending' },
      { id: 'all-day', title: 'Весь день', amount: 1, date: '2026-10-05', recurrence: 'none', status: 'pending' },
      { id: 'tomorrow', title: 'Завтра', amount: 1, date: '2026-10-06', recurrence: 'none', status: 'pending' },
    ];

    const ids = (filter: 'pending' | 'overdue') =>
      getPaymentOccurrencesForFilter(plans, '2026-10-05', filter).map(item => item.payment.id);

    expect(ids('pending')).toEqual(['later', 'tomorrow']);
    expect(ids('overdue')).toEqual(['all-day']);

    vi.setSystemTime(new Date(2026, 9, 5, 13, 0));
    expect(ids('pending')).toEqual(['tomorrow']);
    expect(ids('overdue').sort()).toEqual(['all-day', 'later']);
  });
});
