import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarNote, PlannedPayment } from '../types';
import { api } from './api';
import {
  CALENDAR_CACHE_KEY,
  cacheCalendarSnapshot,
  calendarApi,
  diffCalendarNotes,
  diffCalendarPlans,
} from './calendarApi';

const plan = (id: string, extra: Partial<PlannedPayment> = {}): PlannedPayment => ({
  id,
  title: `План ${id}`,
  amount: 100,
  date: '2026-09-14',
  recurrence: 'weekly',
  status: 'pending',
  ...extra,
});

describe('diffCalendarPlans', () => {
  it('finds created, changed and removed plans', () => {
    const previous = [plan('same'), plan('changed'), plan('removed')];
    const next = [plan('same'), plan('changed', { amount: 200 }), plan('created')];

    const changes = diffCalendarPlans(previous, next);

    expect(changes.created.map(item => item.id)).toEqual(['created']);
    expect(changes.updated.map(item => item.id)).toEqual(['changed']);
    expect(changes.removedIds).toEqual(['removed']);
  });

  it('ignores server-owned state such as completions and display names', () => {
    const previous = [plan('a')];
    const next = [plan('a', {
      paidDates: ['2026-09-14'],
      status: 'paid',
      accountName: 'Карта',
      occurrences: [{ id: 'o', date: '2026-09-14', manuallyCompleted: true }],
      note: '',
    })];

    expect(diffCalendarPlans(previous, next)).toEqual({ created: [], updated: [], removedIds: [] });
  });
});

describe('diffCalendarNotes', () => {
  it('finds created, changed and removed notes', () => {
    const previous: CalendarNote[] = [
      { id: 'same', date: '2026-09-14', text: 'a' },
      { id: 'changed', date: '2026-09-14', text: 'b' },
      { id: 'removed', date: '2026-09-14', text: 'c' },
    ];
    const next: CalendarNote[] = [
      previous[0],
      { id: 'changed', date: '2026-09-15', text: 'b' },
      { id: 'created', date: '2026-09-16', text: 'd' },
    ];

    const changes = diffCalendarNotes(previous, next);

    expect(changes.created.map(item => item.id)).toEqual(['created']);
    expect(changes.updated.map(item => item.id)).toEqual(['changed']);
    expect(changes.removedIds).toEqual(['removed']);
  });
});

describe('calendarApi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends only the changed plans, each to its own endpoint', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({});
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    const del = vi.spyOn(api, 'delete').mockResolvedValue({});
    const previous = [plan('keep'), plan('edit'), plan('drop')];
    const next = [plan('keep'), plan('edit', { title: 'Новое' }), plan('new')];

    await calendarApi.syncPlans(previous, next);

    expect(del).toHaveBeenCalledWith('/calendar/plans/drop');
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/calendar/plans/edit', expect.objectContaining({ id: 'edit', title: 'Новое' }));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/calendar/plans', expect.objectContaining({ id: 'new' }));
  });

  it('never sends server-owned fields with a plan', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({});

    await calendarApi.updatePlan(plan('a', {
      paidDates: ['2026-09-14'],
      occurrences: [],
      excludedDates: ['2026-09-21'],
      accountName: 'Карта',
    }));

    const body = put.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('paidDates');
    expect(body).not.toHaveProperty('occurrences');
    expect(body).not.toHaveProperty('excludedDates');
    expect(body).not.toHaveProperty('accountName');
  });

  it('sends an editor save with its scope, event date and new plan id', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ payments: [] });

    await calendarApi.applyEdit('series', plan('series', { date: '2026-09-15' }), {
      originalDate: '2026-09-14',
      scope: 'single',
      newPlanId: 'payment-new',
    });

    expect(post).toHaveBeenCalledWith('/calendar/plans/series/edit', {
      plan: expect.objectContaining({ id: 'series', date: '2026-09-15' }),
      originalDate: '2026-09-14',
      scope: 'single',
      newPlanId: 'payment-new',
    });
  });
});

describe('cacheCalendarSnapshot', () => {
  afterEach(() => localStorage.clear());

  it('replaces cached plans and keeps cached notes when none are given', () => {
    const notes: CalendarNote[] = [{ id: 'n', date: '2026-09-14', text: 'Заметка' }];
    localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ payments: [], notes }));

    cacheCalendarSnapshot([plan('a')]);

    expect(JSON.parse(localStorage.getItem(CALENDAR_CACHE_KEY)!)).toEqual({ payments: [plan('a')], notes });
  });
});
