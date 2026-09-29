import { describe, expect, it } from 'vitest';
import type { PlannedPayment } from '../types';
import {
  applyCalendarPlanEdit,
  CalendarPlanEditError,
  getSeriesDateError,
} from './calendarPlanEditing';
import { getPaymentOccurrencesInRange } from './plannedPaymentOccurrences';

// 2026-09-07 and 2026-09-14 are Mondays.
const series: PlannedPayment = {
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

const datesOf = (plan: PlannedPayment | undefined, start = '2026-09-07', end = '2026-09-27') =>
  getPaymentOccurrencesInRange(plan!, start, end).map(item => item.date);

describe('getSeriesDateError', () => {
  it('rejects a day that is not one of the selected weekdays', () => {
    const error = getSeriesDateError({ ...series, date: '2026-09-15' });
    expect(error).toContain('15.09.2026');
    expect(error).toContain('вторник');
    expect(error).toContain('пн, ср, пт');
  });

  it('accepts a day that is one of the selected weekdays', () => {
    expect(getSeriesDateError({ ...series, date: '2026-09-16' })).toBeNull();
    expect(getSeriesDateError({ ...series, date: '2026-09-18' })).toBeNull();
  });

  it('requires at least one weekday for a weekday series', () => {
    expect(getSeriesDateError({ ...series, weekdays: [] })).toMatch(/хотя бы один день/);
  });

  it('accepts any start date for series whose pattern is defined by the start date', () => {
    for (const recurrence of ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'none'] as const) {
      expect(getSeriesDateError({ ...series, recurrence, weekdays: undefined, date: '2026-09-15' })).toBeNull();
    }
  });
});

describe('applyCalendarPlanEdit — only this event', () => {
  it('detaches the event into a one-time plan and leaves the rest of the series untouched', () => {
    const edited = { ...series, date: '2026-09-15', amount: 2000 };

    const next = applyCalendarPlanEdit([series], edited, { originalDate: '2026-09-14', scope: 'single' });
    const updatedSeries = next.find(plan => plan.id === 'mwf');
    const detached = next.find(plan => plan.id !== 'mwf');

    expect(next).toHaveLength(2);
    expect(updatedSeries).toMatchObject({
      date: '2026-09-07',
      amount: 1500,
      weekdays: [1, 3, 5],
      excludedDates: ['2026-09-14'],
    });
    expect(detached).toMatchObject({
      title: 'Секция',
      amount: 2000,
      date: '2026-09-15',
      recurrence: 'none',
      weekdays: undefined,
      disableFrom: null,
      status: 'pending',
      paidDates: [],
      occurrences: [],
    });
    expect(datesOf(updatedSeries, '2026-09-14', '2026-09-20')).toEqual(['2026-09-16', '2026-09-18']);
    expect(datesOf(detached, '2026-09-14', '2026-09-20')).toEqual(['2026-09-15']);
  });

  it('does not validate the weekday because the detached event no longer repeats', () => {
    // Tuesday is not a series day, but "only this" is still allowed.
    expect(() => applyCalendarPlanEdit(
      [series],
      { ...series, date: '2026-09-15' },
      { originalDate: '2026-09-14', scope: 'single' },
    )).not.toThrow();
  });

  it('accumulates detached dates of the same series', () => {
    const first = applyCalendarPlanEdit([series], { ...series, date: '2026-09-15' }, { originalDate: '2026-09-14', scope: 'single' });
    const seriesAfterFirst = first.find(plan => plan.id === 'mwf')!;
    const second = applyCalendarPlanEdit(first, { ...seriesAfterFirst, date: '2026-09-17' }, { originalDate: '2026-09-16', scope: 'single' });

    expect(second.find(plan => plan.id === 'mwf')?.excludedDates).toEqual(['2026-09-14', '2026-09-16']);
    expect(second).toHaveLength(3);
  });
});

describe('applyCalendarPlanEdit — this and all following events', () => {
  it('rejects moving the series to a day outside its weekdays', () => {
    expect(() => applyCalendarPlanEdit(
      [series],
      { ...series, date: '2026-09-15' },
      { originalDate: '2026-09-14', scope: 'following' },
    )).toThrow(CalendarPlanEditError);
  });

  it('accepts a new day when the weekdays were changed to include it', () => {
    const edited = { ...series, date: '2026-09-15', weekdays: [2, 4] };

    const next = applyCalendarPlanEdit([series], edited, { originalDate: '2026-09-14', scope: 'following' });
    const oldVersion = next.find(plan => plan.id === 'mwf');
    const newVersion = next.find(plan => plan.id !== 'mwf');

    expect(oldVersion?.disableFrom).toBe('2026-09-13');
    expect(datesOf(oldVersion)).toEqual(['2026-09-07', '2026-09-09', '2026-09-11']);
    expect(datesOf(newVersion, '2026-09-14', '2026-09-20')).toEqual(['2026-09-15', '2026-09-17']);
  });

  it('closes the old version before the edited event, not before the new date', () => {
    // Monday 14th moved to Wednesday 16th: Monday 14th must not stay in the old version.
    const edited = { ...series, date: '2026-09-16', amount: 1800 };

    const next = applyCalendarPlanEdit([series], edited, { originalDate: '2026-09-14', scope: 'following' });
    const oldVersion = next.find(plan => plan.id === 'mwf');
    const newVersion = next.find(plan => plan.id !== 'mwf');

    expect(oldVersion?.disableFrom).toBe('2026-09-13');
    expect(datesOf(oldVersion, '2026-09-14', '2026-09-20')).toEqual([]);
    expect(newVersion).toMatchObject({ amount: 1800, date: '2026-09-16', recurrence: 'weekdays' });
    expect(datesOf(newVersion, '2026-09-14', '2026-09-20')).toEqual(['2026-09-16', '2026-09-18']);
  });

  it('updates the template in place when the first event is edited', () => {
    const edited = { ...series, date: '2026-09-07', amount: 1700 };

    const next = applyCalendarPlanEdit([series], edited, { originalDate: '2026-09-07', scope: 'following' });

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'mwf', amount: 1700, date: '2026-09-07' });
  });

  it('keeps previously detached future events detached in the new version', () => {
    const withDetached = { ...series, excludedDates: ['2026-09-09', '2026-09-23'] };
    const edited = { ...withDetached, date: '2026-09-14', amount: 1600 };

    const next = applyCalendarPlanEdit([withDetached], edited, { originalDate: '2026-09-14', scope: 'following' });
    const newVersion = next.find(plan => plan.id !== 'mwf');

    expect(newVersion?.excludedDates).toEqual(['2026-09-23']);
    expect(datesOf(newVersion, '2026-09-21', '2026-09-27')).toEqual(['2026-09-21', '2026-09-25']);
  });
});

describe('applyCalendarPlanEdit — one-time and new plans', () => {
  it('moves a one-time plan to another day in place', () => {
    const oneTime: PlannedPayment = { ...series, id: 'once', recurrence: 'none', weekdays: undefined, date: '2026-09-14' };

    const next = applyCalendarPlanEdit([oneTime], { ...oneTime, date: '2026-09-16' }, { originalDate: '2026-09-14' });

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'once', date: '2026-09-16' });
    expect(datesOf(next[0])).toEqual(['2026-09-16']);
  });

  it('adds a new valid series', () => {
    const created = { ...series, id: 'new', date: '2026-09-16' };
    expect(applyCalendarPlanEdit([series], created)).toEqual([series, created]);
  });

  it('rejects a new weekday series that starts outside its weekdays', () => {
    const created = { ...series, id: 'new', date: '2026-09-15' };
    expect(() => applyCalendarPlanEdit([], created)).toThrow(CalendarPlanEditError);
  });
});
