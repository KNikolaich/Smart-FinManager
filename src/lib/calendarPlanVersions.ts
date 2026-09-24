import type { PlannedPayment } from '../types';
import { parseDateKey, toDateKey } from './plannedPaymentOccurrences';

let versionIdSequence = 0;

export function createEditedCalendarPlanVersion(
  payments: PlannedPayment[],
  editedPayment: PlannedPayment,
): PlannedPayment[] {
  const existingPayment = payments.find(payment => payment.id === editedPayment.id);
  if (!existingPayment) return [...payments, editedPayment];

  const lastOldPlanDate = parseDateKey(editedPayment.date);
  lastOldPlanDate.setDate(lastOldPlanDate.getDate() - 1);
  const cutoffDate = toDateKey(lastOldPlanDate);
  const previousCutoff = existingPayment.disableFrom;
  const oldPlan = {
    ...existingPayment,
    disableFrom: previousCutoff && previousCutoff < cutoffDate
      ? previousCutoff
      : cutoffDate,
  };

  const existingIds = new Set(payments.map(payment => payment.id));
  let newId: string;
  do {
    versionIdSequence += 1;
    newId = `payment-version-${Date.now()}-${versionIdSequence}`;
  } while (existingIds.has(newId));

  const newPlan: PlannedPayment = {
    ...editedPayment,
    id: newId,
    status: 'pending',
    paidDates: [],
    occurrences: [],
    disableFrom: null,
  };

  return payments
    .map(payment => payment.id === existingPayment.id ? oldPlan : payment)
    .concat(newPlan);
}