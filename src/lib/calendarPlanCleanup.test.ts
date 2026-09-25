import { describe, expect, it } from 'vitest';
import type { PlannedPayment } from '../types';
import {
  applyCalendarPlanTrash,
  applyPastPlanCleanup,
  getCalendarPlanCleanupMode,
  getNextCalendarPlanDate,
  getPastPlanCleanupCandidates,
} from './calendarPlanCleanup';

const today = '2026-09-24';

function payment(overrides: Partial<PlannedPayment> = {}): PlannedPayment {
  return {
    id: 'plan',
    title: 'Интернет',
    amount: 1200,
    date: '2026-09-03',
    recurrence: 'weekly',
    status: 'pending',
    paidDates: [],
    occurrences: [],
    disableFrom: null,
    ...overrides,
  };
}

describe('calendar plan cleanup', () => {
  it('starts a weekly plan on its next scheduled date instead of shifting it to today', () => {
    const recurring = payment({
      date: '2026-09-04',
      paidDates: ['2026-09-04', '2026-09-11', '2026-09-18'],
      occurrences: [
        { id: 'old', date: '2026-09-17', manuallyCompleted: true },
      ],
    });

    expect(getCalendarPlanCleanupMode(recurring, today)).toBe('reset-history');
    expect(getNextCalendarPlanDate(recurring, today)).toBe('2026-09-25');
    expect(applyCalendarPlanTrash([recurring], recurring.id, today)).toEqual([{
      ...recurring,
      date: '2026-09-25',
      status: 'pending',
      paidDates: [],
      occurrences: [],
    }]);
  });

  it('preserves the selected weekdays and monthly schedule when choosing the next date', () => {
    const weekdays = payment({
      date: '2026-09-01',
      recurrence: 'weekdays',
      weekdays: [1, 4],
    });
    const monthly = payment({
      date: '2026-08-15',
      recurrence: 'monthly',
    });

    expect(getNextCalendarPlanDate(weekdays, today)).toBe('2026-09-28');
    expect(getNextCalendarPlanDate(monthly, today)).toBe('2026-10-15');
  });

  it('deletes a completed one-time plan and an unstarted future recurring plan', () => {
    const completed = payment({
      id: 'completed',
      date: '2026-09-17',
      recurrence: 'none',
      status: 'paid',
      paidDates: ['2026-09-17'],
    });
    const future = payment({
      id: 'future',
      date: '2026-10-01',
    });

    expect(getCalendarPlanCleanupMode(completed, today)).toBe('delete');
    expect(getCalendarPlanCleanupMode(future, today)).toBe('delete');
    expect(applyCalendarPlanTrash([completed, future], 'completed', today)).toEqual([future]);
  });

  it('lists only fully completed past plans for bulk cleanup', () => {
    const completedOneTime = payment({
      id: 'completed-once',
      date: '2026-09-10',
      recurrence: 'none',
      status: 'paid',
      paidDates: ['2026-09-10'],
    });
    const completedSeries = payment({
      id: 'completed-series',
      paidDates: ['2026-09-03', '2026-09-10', '2026-09-17'],
    });
    const overdueSeries = payment({
      id: 'overdue-series',
      paidDates: ['2026-09-03'],
    });

    expect(getPastPlanCleanupCandidates(
      [completedOneTime, completedSeries, overdueSeries],
      today,
    ).map(item => item.id)).toEqual(['completed-once', 'completed-series']);

    expect(applyPastPlanCleanup(
      [completedOneTime, completedSeries, overdueSeries],
      ['completed-once', 'completed-series', 'overdue-series'],
      today,
    )).toEqual([
      {
        ...completedSeries,
        date: today,
        status: 'pending',
        paidDates: [],
        occurrences: [],
      },
      overdueSeries,
    ]);
  });
});