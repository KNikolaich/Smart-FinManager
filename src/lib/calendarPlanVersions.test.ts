import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlannedPayment } from '../types';
import { getPaymentOccurrencesInRange } from './plannedPaymentOccurrences';
import { createEditedCalendarPlanVersion } from './calendarPlanVersions';

const existingPlan: PlannedPayment = {
  id: 'weekly-plan',
  title: 'Старое название',
  amount: 500,
  date: '2026-09-17',
  recurrence: 'weekly',
  status: 'paid',
  paidDates: ['2026-09-17'],
  occurrences: [{
    id: 'paid-occurrence',
    date: '2026-09-17',
    manuallyCompleted: true,
  }],
};

describe('createEditedCalendarPlanVersion', () => {
  afterEach(() => vi.useRealTimers());

  it('closes the old plan before the editor date and starts a clean version on that date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 12));
    const editedPlan: PlannedPayment = {
      ...existingPlan,
      title: 'Новое название',
      amount: 750,
      date: '2026-09-24',
      time: '15:00',
    };

    const versions = createEditedCalendarPlanVersion([existingPlan], editedPlan);
    const oldVersion = versions.find(plan => plan.id === existingPlan.id);
    const newVersion = versions.find(plan => plan.id !== existingPlan.id);

    expect(oldVersion).toMatchObject({
      date: '2026-09-17',
      disableFrom: '2026-09-23',
      occurrences: existingPlan.occurrences,
    });
    expect(newVersion).toMatchObject({
      title: 'Новое название',
      amount: 750,
      date: '2026-09-24',
      time: '15:00',
      status: 'pending',
      paidDates: [],
      occurrences: [],
      disableFrom: null,
    });
    expect(newVersion?.id).not.toBe(existingPlan.id);
    expect(getPaymentOccurrencesInRange(oldVersion!, '2026-09-17', '2026-09-30').map(item => item.date))
      .toEqual(['2026-09-17']);
    expect(getPaymentOccurrencesInRange(newVersion!, '2026-09-17', '2026-09-30').map(item => item.date))
      .toEqual(['2026-09-24']);
  });

  it('adds a newly created plan without splitting an existing version', () => {
    const newPlan = { ...existingPlan, id: 'new-plan', title: 'Новый план' };

    expect(createEditedCalendarPlanVersion([existingPlan], newPlan)).toEqual([existingPlan, newPlan]);
  });
});