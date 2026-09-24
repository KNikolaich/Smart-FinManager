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

export function mergeCalendarDashboardItems(
  occurrences: PlannedPaymentOccurrence[],
  notes: CalendarNote[],
  startDate: string,
  limit: number,
): CalendarDashboardItem[] {
  const items: CalendarDashboardItem[] = [
    ...occurrences.map(occurrence => ({
      kind: 'payment' as const,
      key: `${occurrence.payment.id}-${occurrence.date}`,
      date: occurrence.date,
      occurrence,
    })),
    ...notes
      .filter(note => note.date >= startDate)
      .map(note => ({
        kind: 'note' as const,
        key: `note-${note.id}-${note.date}`,
        date: note.date,
        note,
      })),
  ];

  return items
    .sort((left, right) =>
      left.date.localeCompare(right.date) ||
      (left.kind === right.kind ? left.key.localeCompare(right.key) : left.kind === 'payment' ? -1 : 1),
    )
    .slice(0, Math.max(0, limit));
}