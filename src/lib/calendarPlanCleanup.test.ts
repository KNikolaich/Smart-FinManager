import { describe, expect, it } from 'vitest';
import type { PlannedPayment } from '../types';
import {
  applyCalendarPlanTrash,
  applyPastPlanCleanup,
  getCalendarPlanCleanupMode,
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
  it('keeps a recurring plan that will continue, but resets its start and past marks', () => {
    const recurring = payment({
      paidDates: ['2026-09-03', '2026-09-10', '2026-09-17'],
      occurrences: [
        { id: 'old', date: '2026-09-17', manuallyCompleted: true },
        { id: 'today', date: '2026-09-24', manuallyCompleted: true },
      ],
    });

    expect(getCalendarPlanCleanupMode(recurring, today)).toBe('reset-history');
    expect(applyCalendarPlanTrash([recurring], recurring.id, today)).toEqual([{
      ...recurring,
      date: today,
      status: 'paid',
      paidDates: [today],
      occurrences: [expect.objectContaining({ date: today })],
    }]);
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