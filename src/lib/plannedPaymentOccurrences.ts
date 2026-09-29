import { PlannedPayment, PlannedPaymentStatus } from '../types';

export interface PlannedPaymentOccurrence {
  payment: PlannedPayment;
  date: string;
  status: PlannedPaymentStatus;
  occurrenceId?: string;
  transactionId?: string | null;
  manuallyCompleted?: boolean;
}

export type PlannedPaymentFilter = 'all' | 'pending' | 'overdue' | 'paid';

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayKey() {
  return toDateKey(new Date());
}

export function isPaymentOccurrenceOverdue(dateKey: string, todayKey = getTodayKey()) {
  return dateKey <= todayKey;
}

export function getPaymentOccurrencesInRange(
  payment: PlannedPayment,
  startKey: string,
  endKey: string,
): PlannedPaymentOccurrence[] {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const dates: PlannedPaymentOccurrence[] = [];
  const addedDates = new Set<string>();

  const addOccurrence = (dateKey: string) => {
    if (addedDates.has(dateKey)) return;
    const storedOccurrence = payment.occurrences?.find(item => item.date === dateKey);
    dates.push({
      payment,
      date: dateKey,
      status: getOccurrenceStatus(payment, dateKey),
      occurrenceId: storedOccurrence?.id,
      transactionId: storedOccurrence?.transactionId,
      manuallyCompleted: storedOccurrence?.manuallyCompleted,
    });
    addedDates.add(dateKey);
  };

  const excludedDates = new Set(payment.excludedDates || []);

  for (const date = new Date(start.getFullYear(), start.getMonth(), start.getDate()); date <= end; date.setDate(date.getDate() + 1)) {
    const dateKey = toDateKey(date);
    if (dateKey < payment.date) continue;
    if (payment.disableFrom && dateKey > payment.disableFrom) continue;
    if (excludedDates.has(dateKey)) continue;

    if (matchesPlanRecurrence(payment, dateKey)) addOccurrence(dateKey);
  }

  // Keep completed historical dates even when the plan's recurrence was later
  // changed to a different set of weekdays.
  payment.occurrences?.forEach(occurrence => {
    if (occurrence.date < startKey || occurrence.date > endKey) return;
    if (occurrence.date < payment.date) return;
    if (payment.disableFrom && occurrence.date > payment.disableFrom) return;
    // A date detached from the series ("only this event") is hidden unless it
    // was already completed: completed history must never disappear.
    if (excludedDates.has(occurrence.date) && !occurrence.manuallyCompleted && !occurrence.transactionId) return;
    addOccurrence(occurrence.date);
  });

  return dates.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Whether `dateKey` is produced by the plan's recurrence rule, counting from
 * `payment.date` as the series start. Ignores `disableFrom`, excluded dates and
 * stored occurrences — it answers only "does the pattern hit this day".
 */
export function matchesPlanRecurrence(payment: Pick<PlannedPayment, 'date' | 'recurrence' | 'weekdays'>, dateKey: string) {
  if (dateKey < payment.date) return false;
  const base = parseDateKey(payment.date);
  const date = parseDateKey(dateKey);
  const monthDistance = (date.getFullYear() - base.getFullYear()) * 12 + date.getMonth() - base.getMonth();
  const dayDistance = Math.round((date.getTime() - base.getTime()) / 86400000);

  switch (payment.recurrence) {
    case 'none':
      return dateKey === payment.date;
    case 'weekly':
      return dayDistance % 7 === 0;
    case 'biweekly':
      return dayDistance % 14 === 0;
    case 'weekdays':
      return (payment.weekdays || []).includes(date.getDay() || 7);
    case 'monthly':
      return date.getDate() === base.getDate();
    case 'quarterly':
      return date.getDate() === base.getDate() && monthDistance % 3 === 0;
    default:
      return date.getDate() === base.getDate() && date.getMonth() === base.getMonth();
  }
}

export function getUpcomingPaymentOccurrences(
  payments: PlannedPayment[],
  startKey = getTodayKey(),
  limit = 7,
) {
  const start = parseDateKey(startKey);
  const end = new Date(start.getFullYear() + 5, start.getMonth(), start.getDate());

  return payments
    .flatMap(payment => getPaymentOccurrencesInRange(payment, startKey, toDateKey(end)))
    .filter(item => item.status !== 'paid')
    .sort((a, b) => a.date.localeCompare(b.date) || a.payment.title.localeCompare(b.payment.title))
    .slice(0, limit);
}

export function getOutstandingPaymentOccurrences(
  payments: PlannedPayment[],
  anchorKey = getTodayKey(),
  limit = 7,
) {
  const anchor = parseDateKey(anchorKey);
  const start = new Date(anchor.getFullYear() - 5, anchor.getMonth(), anchor.getDate());
  const end = new Date(anchor.getFullYear() + 5, anchor.getMonth(), anchor.getDate());

  return payments
    .flatMap(payment => getPaymentOccurrencesInRange(payment, toDateKey(start), toDateKey(end)))
    .filter(item => item.status !== 'paid')
    .sort((a, b) => a.date.localeCompare(b.date) || a.payment.title.localeCompare(b.payment.title))
    .slice(0, limit);
}

export function getPaymentOccurrencesForFilter(
  payments: PlannedPayment[],
  anchorKey = getTodayKey(),
  filter: PlannedPaymentFilter = 'all',
  limit = 50,
  offset = 0,
) {
  const anchor = parseDateKey(anchorKey);
  const todayKey = getTodayKey();
  const today = parseDateKey(todayKey);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const end = new Date(anchor.getFullYear() + 5, anchor.getMonth(), anchor.getDate());

  if (filter === 'all' || filter === 'paid') {
    start.setFullYear(start.getFullYear() - 5);
  } else if (filter === 'pending') {
    const pendingStart = anchor > today ? anchor : new Date(today);
    if (pendingStart <= today) pendingStart.setDate(pendingStart.getDate() + 1);
    start.setTime(pendingStart.getTime());
  } else if (filter === 'overdue') {
    start.setFullYear(start.getFullYear() - 5);
    const overdueEnd = anchor < today ? anchor : today;
    end.setTime(overdueEnd.getTime());
  }

  return payments
    .flatMap(payment => getPaymentOccurrencesInRange(payment, toDateKey(start), toDateKey(end)))
    .filter(item => {
      if (filter === 'all') return true;
      if (filter === 'overdue') return item.status === 'pending' && isPaymentOccurrenceOverdue(item.date, todayKey);
      if (filter === 'pending') return item.status === 'pending' && item.date > todayKey;
      return item.status === 'paid';
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.payment.title.localeCompare(b.payment.title))
    .slice(offset, offset + limit);
}

export function getOccurrenceStatus(payment: PlannedPayment, date: string): PlannedPaymentStatus {
  if (payment.paidDates) return payment.paidDates.includes(date) ? 'paid' : 'pending';
  return payment.status === 'paid' && date === payment.date ? 'paid' : 'pending';
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}