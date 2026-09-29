import type { CalendarNote, PlannedPayment } from '../types';
import { api, safeStorage } from './api';
import type { CalendarPlanEditOptions } from './calendarPlanEditing';

/**
 * Client for the per-plan calendar API. Every call changes one plan or note,
 * so a save never resends (or archives) the rest of the calendar.
 *
 * Reads still go through GET /plan-grid/calendar; after a successful change
 * the caller stores the new state in that request's offline cache with
 * {@link cacheCalendarSnapshot}, so the calendar stays current offline.
 */

export const CALENDAR_CACHE_KEY = 'api_cache_/plan-grid/calendar';

/** Fields of a plan the user edits; everything else is owned by the server. */
const TEMPLATE_FIELDS = [
  'title', 'amount', 'date', 'note', 'time', 'recurrence', 'weekdays',
  'transactionType', 'accountId', 'categoryId', 'color', 'disableFrom',
] as const;

export type CalendarPlanTemplate = Pick<PlannedPayment, 'id'> & Partial<Pick<PlannedPayment, typeof TEMPLATE_FIELDS[number]>>;

export function toPlanTemplate(payment: PlannedPayment): CalendarPlanTemplate {
  const template: Record<string, unknown> = { id: payment.id };
  for (const field of TEMPLATE_FIELDS) {
    const value = payment[field];
    if (value !== undefined) template[field] = value;
  }
  return template as CalendarPlanTemplate;
}

function comparableTemplate(payment: PlannedPayment) {
  const template: Record<string, unknown> = {};
  for (const field of TEMPLATE_FIELDS) {
    const value = payment[field];
    template[field] = value === undefined || value === '' ? null : value;
  }
  if (Array.isArray(template.weekdays) && template.weekdays.length === 0) template.weekdays = null;
  return JSON.stringify(template);
}

export interface CalendarPlanChanges {
  created: PlannedPayment[];
  updated: PlannedPayment[];
  removedIds: string[];
}

/** What has to be sent to turn `previous` into `next`. */
export function diffCalendarPlans(previous: PlannedPayment[], next: PlannedPayment[]): CalendarPlanChanges {
  const previousById = new Map(previous.map(payment => [payment.id, payment]));
  const nextIds = new Set(next.map(payment => payment.id));
  const created: PlannedPayment[] = [];
  const updated: PlannedPayment[] = [];

  for (const payment of next) {
    const before = previousById.get(payment.id);
    if (!before) created.push(payment);
    else if (comparableTemplate(before) !== comparableTemplate(payment)) updated.push(payment);
  }

  return {
    created,
    updated,
    removedIds: previous.filter(payment => !nextIds.has(payment.id)).map(payment => payment.id),
  };
}

export interface CalendarNoteChanges {
  created: CalendarNote[];
  updated: CalendarNote[];
  removedIds: string[];
}

export function diffCalendarNotes(previous: CalendarNote[], next: CalendarNote[]): CalendarNoteChanges {
  const previousById = new Map(previous.map(note => [note.id, note]));
  const nextIds = new Set(next.map(note => note.id));
  const created: CalendarNote[] = [];
  const updated: CalendarNote[] = [];

  for (const note of next) {
    const before = previousById.get(note.id);
    if (!before) created.push(note);
    else if (before.date !== note.date || before.text !== note.text) updated.push(note);
  }

  return {
    created,
    updated,
    removedIds: previous.filter(note => !nextIds.has(note.id)).map(note => note.id),
  };
}

const planPath = (id: string) => `/calendar/plans/${encodeURIComponent(id)}`;
const notePath = (id: string) => `/calendar/notes/${encodeURIComponent(id)}`;

export const calendarApi = {
  createPlan(payment: PlannedPayment) {
    return api.post<PlannedPayment>('/calendar/plans', toPlanTemplate(payment));
  },

  updatePlan(payment: PlannedPayment) {
    return api.put<PlannedPayment>(planPath(payment.id), toPlanTemplate(payment));
  },

  archivePlan(id: string) {
    return api.delete<{ success: boolean }>(planPath(id));
  },

  /** Saves the plan editor; the server splits or detaches the series itself. */
  applyEdit(planId: string, payment: PlannedPayment, options: CalendarPlanEditOptions) {
    return api.post<{ payments: PlannedPayment[] }>(`${planPath(planId)}/edit`, {
      plan: toPlanTemplate(payment),
      originalDate: options.originalDate,
      scope: options.scope,
      newPlanId: options.newPlanId,
    });
  },

  setOccurrenceCompleted(planId: string, date: string, completed: boolean) {
    return api.post(`${planPath(planId)}/occurrences/${encodeURIComponent(date)}`, { completed });
  },

  createNote(note: CalendarNote) {
    return api.post<CalendarNote>('/calendar/notes', note);
  },

  updateNote(note: CalendarNote) {
    return api.put<CalendarNote>(notePath(note.id), { date: note.date, text: note.text });
  },

  deleteNote(id: string) {
    return api.delete<{ success: boolean }>(notePath(id));
  },

  /** Sends only the plans that differ between the two states. */
  async syncPlans(previous: PlannedPayment[], next: PlannedPayment[]) {
    const changes = diffCalendarPlans(previous, next);
    for (const id of changes.removedIds) await calendarApi.archivePlan(id);
    for (const payment of changes.updated) await calendarApi.updatePlan(payment);
    for (const payment of changes.created) await calendarApi.createPlan(payment);
    return changes;
  },

  /** Sends only the notes that differ between the two states. */
  async syncNotes(previous: CalendarNote[], next: CalendarNote[]) {
    const changes = diffCalendarNotes(previous, next);
    for (const id of changes.removedIds) await calendarApi.deleteNote(id);
    for (const note of changes.updated) await calendarApi.updateNote(note);
    for (const note of changes.created) await calendarApi.createNote(note);
    return changes;
  },
};

/** Keeps the offline copy of GET /plan-grid/calendar in line with local changes. */
export function cacheCalendarSnapshot(payments: PlannedPayment[], notes?: CalendarNote[]) {
  let cachedNotes = notes;
  if (!cachedNotes) {
    try {
      const cached = JSON.parse(safeStorage.getItem(CALENDAR_CACHE_KEY) || 'null');
      cachedNotes = Array.isArray(cached?.notes) ? cached.notes : [];
    } catch {
      cachedNotes = [];
    }
  }
  safeStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ payments, notes: cachedNotes }));
}
