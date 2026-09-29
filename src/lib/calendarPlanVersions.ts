import type { PlannedPayment } from '../types';
import { parseDateKey, toDateKey } from './plannedPaymentOccurrences';

let versionIdSequence = 0;

/**
 * Applies an edit as "this and all following events": the old series is closed
 * the day before the edited occurrence (`fromDate`, defaults to the new date),
 * and a clean series starts on the edited date.
 */
export function createEditedCalendarPlanVersion(
  payments: PlannedPayment[],
  editedPayment: PlannedPayment,
  fromDate: string = editedPayment.date,
  newPlanId?: string,
): PlannedPayment[] {
  const existingPayment = payments.find(payment => payment.id === editedPayment.id);
  if (!existingPayment) return [...payments, editedPayment];

  const splitDate = fromDate < editedPayment.date ? fromDate : editedPayment.date;
  const lastOldPlanDate = parseDateKey(splitDate);
  lastOldPlanDate.setDate(lastOldPlanDate.getDate() - 1);
  const cutoffDate = toDateKey(lastOldPlanDate);

  // Editing from the very first event: nothing of the old series remains
  // before the split, so the plan is updated in place and keeps its id and
  // stored completions instead of leaving an empty "ghost" version behind.
  if (cutoffDate < existingPayment.date) {
    return payments.map(payment => payment.id === existingPayment.id
      ? {
        ...editedPayment,
        paidDates: existingPayment.paidDates,
        occurrences: existingPayment.occurrences,
        excludedDates: keepExcludedFrom(existingPayment.excludedDates, editedPayment.date),
      }
      : payment);
  }

  const previousCutoff = existingPayment.disableFrom;
  const oldPlan = {
    ...existingPayment,
    disableFrom: previousCutoff && previousCutoff < cutoffDate
      ? previousCutoff
      : cutoffDate,
  };

  let newId = newPlanId;
  if (!newId) {
    const existingIds = new Set(payments.map(payment => payment.id));
    do {
      versionIdSequence += 1;
      newId = `payment-version-${Date.now()}-${versionIdSequence}`;
    } while (existingIds.has(newId));
  }

  const newPlan: PlannedPayment = {
    ...editedPayment,
    id: newId!,
    status: 'pending',
    paidDates: [],
    occurrences: [],
    disableFrom: null,
    // Events already detached from the series stay detached in the new version.
    excludedDates: keepExcludedFrom(existingPayment.excludedDates, editedPayment.date),
  };

  return payments
    .map(payment => payment.id === existingPayment.id ? oldPlan : payment)
    .concat(newPlan);
}

function keepExcludedFrom(dates: string[] | undefined, fromDate: string) {
  const kept = (dates || []).filter(date => date >= fromDate);
  return kept.length > 0 ? kept : undefined;
}
