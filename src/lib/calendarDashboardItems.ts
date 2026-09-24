import type { CalendarNote } from '../types';
import type { PlannedPaymentOccurrence } from './plannedPaymentOccurrences';

export type CalendarDashboardItem =
  | {
      kind: 'payment';
      key: string;
      date: string;
      occurrence: PlannedPaymentOccurrence;
    }
  | {
      kind: 'note';
      key: string;
      date: string;
      note: CalendarNote;
    };

export function mergeCalendarPlanItems(
  occurrences: PlannedPaymentOccurrence[],
  notes: CalendarNote[],
): CalendarDashboardItem[] {
  const items: CalendarDashboardItem[] = [
    ...occurrences.map(occurrence => ({
      kind: 'payment' as const,
      key: `${occurrence.payment.id}-${occurrence.date}`,
      date: occurrence.date,
      occurrence,
    })),
    ...notes.map(note => ({
      kind: 'note' as const,
      key: `note-${note.id}-${note.date}`,
      date: note.date,
      note,
    })),
  ];

  return items.sort((left, right) =>
    left.date.localeCompare(right.date) ||
    getItemTime(left).localeCompare(getItemTime(right)) ||
    (left.kind === right.kind ? left.key.localeCompare(right.key) : left.kind === 'payment' ? -1 : 1),
  );
}

export function mergeCalendarDashboardItems(
  occurrences: PlannedPaymentOccurrence[],
  notes: CalendarNote[],
  startDate: string,
  limit: number,
): CalendarDashboardItem[] {
  return mergeCalendarPlanItems(
    occurrences,
    notes.filter(note => note.date >= startDate),
  )
    .slice(0, Math.max(0, limit));
}

function getItemTime(item: CalendarDashboardItem) {
  return item.kind === 'payment' ? item.occurrence.payment.time || '' : '';
}