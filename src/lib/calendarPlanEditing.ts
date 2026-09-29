import type { PlannedPayment } from '../types';
import { createEditedCalendarPlanVersion } from './calendarPlanVersions';
import { matchesPlanRecurrence, parseDateKey } from './plannedPaymentOccurrences';

/** How an edit of one event of a recurring plan is applied. */
export type CalendarPlanEditScope = 'single' | 'following';

export interface CalendarPlanEditOptions {
  /** Date of the event that was opened for editing (before the user moved it). */
  originalDate?: string;
  /** Required for recurring plans; ignored for one-time plans. */
  scope?: CalendarPlanEditScope;
  /**
   * Id for a plan the edit creates (a detached event or a new series
   * version). The client passes the same id to the server so both sides end
   * up with identical plans.
   */
  newPlanId?: string;
}

const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const WEEKDAY_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

let planIdSequence = 0;

/** A plan id that is not used by any of `payments`. */
export function createCalendarPlanId(payments: Array<Pick<PlannedPayment, 'id'>> = [], prefix = 'payment') {
  const existingIds = new Set(payments.map(payment => payment.id));
  let id: string;
  do {
    planIdSequence += 1;
    const unique = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${planIdSequence}-${Math.random().toString(36).slice(2, 8)}`;
    id = `${prefix}-${unique}`;
  } while (existingIds.has(id));
  return id;
}

export function isRecurringPlan(payment: Pick<PlannedPayment, 'recurrence'> | null | undefined) {
  return Boolean(payment && payment.recurrence !== 'none');
}

/**
 * Checks that the plan's start date is itself an event of its series. For
 * "по дням недели" the chosen day must be one of the selected weekdays; for the
 * other recurrences the start date defines the pattern, so it always matches.
 * Returns a user-facing error or null.
 */
export function getSeriesDateError(
  payment: Pick<PlannedPayment, 'date' | 'recurrence' | 'weekdays'>,
): string | null {
  if (!isRecurringPlan(payment) || !payment.date) return null;

  if (payment.recurrence === 'weekdays' && !(payment.weekdays && payment.weekdays.length > 0)) {
    return 'Выберите хотя бы один день недели для повторения.';
  }
  if (matchesPlanRecurrence(payment, payment.date)) return null;

  const day = parseDateKey(payment.date).getDay() || 7;
  const [year, month, dayOfMonth] = payment.date.split('-');
  const selected = (payment.weekdays || []).map(item => WEEKDAY_SHORT[item - 1]).join(', ');
  return `Дата ${dayOfMonth}.${month}.${year} (${WEEKDAY_LONG[day - 1]}) не входит в дни повторения серии: ${selected}. `
    + 'Выберите дату из этих дней, измените дни недели или примените изменение только к этому событию.';
}

/**
 * Returns the next calendar state after the plan editor was saved.
 *
 * - new plan: appended;
 * - one-time plan: updated in place (its date may move freely);
 * - recurring plan, scope "following": the series template changes from the
 *   edited event on (the old version is closed the day before it);
 * - recurring plan, scope "single": the event is detached — its date is
 *   excluded from the series and a one-time plan with the edited fields is
 *   created, the rest of the series stays untouched.
 */
export function applyCalendarPlanEdit(
  payments: PlannedPayment[],
  editedPayment: PlannedPayment,
  options: CalendarPlanEditOptions = {},
): PlannedPayment[] {
  const existing = payments.find(payment => payment.id === editedPayment.id);
  const originalDate = options.originalDate || editedPayment.date;

  if (existing && isRecurringPlan(existing) && options.scope === 'single') {
    return detachCalendarOccurrence(payments, existing, editedPayment, originalDate, options.newPlanId);
  }

  // Everything below saves a series template (new, converted or edited), so
  // its start date must be an event of that series.
  const seriesError = getSeriesDateError(editedPayment);
  if (seriesError) throw new CalendarPlanEditError(seriesError);

  if (!existing) return [...payments, editedPayment];
  if (!isRecurringPlan(existing)) {
    return createEditedCalendarPlanVersion(payments, editedPayment, existing.date, options.newPlanId);
  }
  return createEditedCalendarPlanVersion(payments, editedPayment, originalDate, options.newPlanId);
}

export class CalendarPlanEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarPlanEditError';
  }
}

function detachCalendarOccurrence(
  payments: PlannedPayment[],
  series: PlannedPayment,
  editedPayment: PlannedPayment,
  originalDate: string,
  newPlanId?: string,
) {
  const id = newPlanId || createCalendarPlanId(payments, 'payment-single');

  const excludedDates = Array.from(new Set([...(series.excludedDates || []), originalDate])).sort();
  const detached: PlannedPayment = {
    ...editedPayment,
    id,
    recurrence: 'none',
    weekdays: undefined,
    disableFrom: null,
    excludedDates: undefined,
    status: 'pending',
    paidDates: [],
    occurrences: [],
  };

  return payments
    .map(payment => payment.id === series.id ? { ...series, excludedDates } : payment)
    .concat(detached);
}
