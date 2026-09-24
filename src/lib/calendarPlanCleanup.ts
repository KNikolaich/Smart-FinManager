import type { PlannedPayment } from '../types';
import {
  getPaymentOccurrencesInRange,
  parseDateKey,
  PlannedPaymentOccurrence,
  toDateKey,
} from './plannedPaymentOccurrences';

export type CalendarPlanCleanupMode = 'delete' | 'reset-history';

export function getCalendarPlanCleanupMode(
  payment: PlannedPayment,
  today: string,
): CalendarPlanCleanupMode {
  if (payment.recurrence === 'none' || payment.date > today) return 'delete';

  const tomorrow = shiftDate(today, 1);
  const fiveYearsFromToday = parseDateKey(today);
  fiveYearsFromToday.setFullYear(fiveYearsFromToday.getFullYear() + 5);
  const end = payment.disableFrom && payment.disableFrom < toDateKey(fiveYearsFromToday)
    ? payment.disableFrom
    : toDateKey(fiveYearsFromToday);

  if (end < tomorrow) return 'delete';

  const hasFutureOccurrence = getPaymentOccurrencesInRange(payment, tomorrow, end).length > 0;
  return hasFutureOccurrence ? 'reset-history' : 'delete';
}

export function getPastPlanCleanupCandidates(
  payments: PlannedPayment[],
  today: string,
): PlannedPayment[] {
  const yesterday = shiftDate(today, -1);

  return payments.filter(payment => {
    if (payment.date >= today) return false;

    const pastOccurrences = getPaymentOccurrencesInRange(payment, payment.date, yesterday);
    return pastOccurrences.length > 0 && pastOccurrences.every(isCompletedOccurrence);
  });
}

export function applyCalendarPlanTrash(
  payments: PlannedPayment[],
  paymentId: string,
  today: string,
): PlannedPayment[] {
  return payments.flatMap(payment => {
    if (payment.id !== paymentId) return [payment];
    if (getCalendarPlanCleanupMode(payment, today) === 'delete') return [];
    return [resetPlanHistory(payment, today)];
  });
}

export function applyPastPlanCleanup(
  payments: PlannedPayment[],
  paymentIds: string[],
  today: string,
): PlannedPayment[] {
  const requestedIds = new Set(paymentIds);
  const eligibleIds = new Set(
    getPastPlanCleanupCandidates(payments, today)
      .filter(payment => requestedIds.has(payment.id))
      .map(payment => payment.id),
  );

  return payments.flatMap(payment => {
    if (!eligibleIds.has(payment.id)) return [payment];
    if (getCalendarPlanCleanupMode(payment, today) === 'delete') return [];
    return [resetPlanHistory(payment, today)];
  });
}

export function isCompletedOccurrence(item: PlannedPaymentOccurrence) {
  return Boolean(item.status === 'paid' || item.manuallyCompleted || item.transactionId);
}

function resetPlanHistory(payment: PlannedPayment, today: string): PlannedPayment {
  const paidDates = new Set((payment.paidDates || []).filter(date => date >= today));
  payment.occurrences?.forEach(occurrence => {
    if (
      occurrence.date >= today
      && (occurrence.manuallyCompleted || occurrence.transactionId)
    ) {
      paidDates.add(occurrence.date);
    }
  });

  return {
    ...payment,
    date: today,
    status: paidDates.has(today) ? 'paid' : 'pending',
    paidDates: Array.from(paidDates),
    occurrences: (payment.occurrences || []).filter(occurrence => occurrence.date >= today),
  };
}

function shiftDate(dateKey: string, offset: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}