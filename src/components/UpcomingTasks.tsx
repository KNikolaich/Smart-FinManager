import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, CalendarClock, CalendarDays, Check, CircleDashed, Copy, Eraser, Eye, Hand, Pencil, Plus, ScrollText, StickyNote, Trash2, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from '../lib/api';
import { cacheCalendarSnapshot, calendarApi } from '../lib/calendarApi';
import { useMinuteClock } from '../hooks/useMinuteClock';
import { CalendarNote, PlannedPayment, PlannedPaymentRecurrence } from '../types';
import CalendarNoteDialog from './CalendarNoteDialog';
import { CalendarDashboardItem, mergeCalendarDashboardItems, mergeCalendarPlanItems } from '../lib/calendarDashboardItems';
import {
  getTodayKey,
  getOutstandingPaymentOccurrences,
  getPaymentOccurrencesForFilter,
  isOccurrenceOverdue,
  isPlanOccurrenceOverdue,
  PlannedPaymentFilter,
  PlannedPaymentOccurrence,
} from '../lib/plannedPaymentOccurrences';
import {
  getCalendarPlanCleanupMode,
  getNextCalendarPlanDate,
  getPastPlanCleanupCandidates,
  isCompletedOccurrence,
  applyCalendarPlanTrash,
  type CalendarPlanCleanupMode,
} from '../lib/calendarPlanCleanup';

interface UpcomingTasksProps {
  userId?: string;
  payments?: PlannedPayment[];
  notes?: CalendarNote[];
  startDate?: string;
  filter?: PlannedPaymentFilter;
  focusedDate?: string;
  limit?: number;
  variant?: 'list' | 'carousel';
  onTaskClick?: (date: string) => void;
  onOpenCalendar?: () => void;
  onAdd?: () => void;
  onAddNote?: () => void;
  onToggleTask?: (item: PlannedPaymentOccurrence) => void;
  onManualToggleTask?: (item: PlannedPaymentOccurrence) => void | Promise<void>;
  onRequestTransaction?: (
    item: PlannedPaymentOccurrence,
    onCompleted: () => void | Promise<void>,
  ) => void;
  onEditTask?: (item: PlannedPaymentOccurrence) => void;
  onCopyTask?: (item: PlannedPaymentOccurrence) => void;
  onDeleteTask?: (item: PlannedPaymentOccurrence) => void | Promise<void>;
  onCleanupPastTasks?: (paymentIds: string[], noteIds?: string[]) => void | Promise<void>;
  onCopyNote?: (note: CalendarNote) => void;
  onDeleteNote?: (note: CalendarNote) => void | Promise<void>;
  onNoteClick?: (note: CalendarNote) => void;
  className?: string;
}

export default function UpcomingTasks({
  userId,
  payments,
  notes,
  startDate = getTodayKey(),
  filter = 'all',
  focusedDate,
  limit = 7,
  variant = 'list',
  onTaskClick,
  onOpenCalendar,
  onAdd,
  onAddNote,
  onToggleTask,
  onManualToggleTask,
  onRequestTransaction,
  onEditTask,
  onCopyTask,
  onDeleteTask,
  onCleanupPastTasks,
  onCopyNote,
  onDeleteNote,
  onNoteClick,
  className,
}: UpcomingTasksProps) {
  const [loadedPayments, setLoadedPayments] = useState<PlannedPayment[]>([]);
  const [loadedNotes, setLoadedNotes] = useState<CalendarNote[]>([]);
  const [localPayments, setLocalPayments] = useState<PlannedPayment[] | null>(null);
  const [localNotes, setLocalNotes] = useState<CalendarNote[] | null>(null);
  const [loading, setLoading] = useState(payments === undefined);
  const [error, setError] = useState<string | null>(null);
  const [carouselLimit, setCarouselLimit] = useState(limit);
  const [listWindow, setListWindow] = useState({ start: 0, end: 50 });
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<PlannedPaymentOccurrence | null>(null);
  const [noteDialogMode, setNoteDialogMode] = useState<'view' | 'edit' | null>(null);
  const [editingNote, setEditingNote] = useState<CalendarNote | null>(null);
  const [noteDialogError, setNoteDialogError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState<
    | { type: 'single'; item: PlannedPaymentOccurrence }
    | { type: 'note'; note: CalendarNote }
    | { type: 'bulk'; paymentIds: string[]; noteIds: string[] }
    | null
  >(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [quietOverdue, setQuietOverdue] = useState<Set<string>>(new Set());
  const [todayPreviewOpen, setTodayPreviewOpen] = useState(false);
  const previousStartDate = useRef(startDate);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previousListHeight = useRef<number | null>(null);

  useEffect(() => {
    if (payments !== undefined) {
      setLoading(false);
      return;
    }

    let active = true;
    let requestId = 0;
    const loadCalendar = () => {
      const currentRequest = ++requestId;
      setLoading(true);
      api.get<{ payments?: PlannedPayment[]; notes?: CalendarNote[] }>('/plan-grid/calendar')
        .then(data => {
          if (!active || currentRequest !== requestId) return;
          setLoadedPayments(Array.isArray(data?.payments) ? data.payments : []);
          setLoadedNotes(Array.isArray(data?.notes) ? data.notes : []);
          setError(null);
        })
        .catch(() => {
          if (active && currentRequest === requestId) {
            setError('Не удалось загрузить предстоящие задачи.');
          }
        })
        .finally(() => {
          if (active && currentRequest === requestId) setLoading(false);
        });
    };

    loadCalendar();
    const socket = userId ? io(window.location.origin) : null;
    socket?.on('connect', () => socket.emit('join', userId));
    socket?.on('data:updated', (data: any) => {
      if (data?.type === 'plan-grid' && data.planType === 'calendar') loadCalendar();
    });

    return () => {
      active = false;
      requestId += 1;
      socket?.disconnect();
    };
  }, [payments, userId]);

  useEffect(() => {
    if (payments !== undefined) setLocalPayments(null);
  }, [payments]);

  useEffect(() => {
    if (notes !== undefined) setLocalNotes(null);
  }, [notes]);

  const sourcePayments = localPayments ?? payments ?? loadedPayments;
  const sourceNotes = localNotes ?? notes ?? loadedNotes;
  // Re-render every minute: a plan for 12:30 turns overdue at 12:30, not at midnight.
  const now = useMinuteClock();
  const todayKey = getTodayKey();
  const pastCleanupCandidates = useMemo(
    () => getPastPlanCleanupCandidates(sourcePayments, todayKey),
    [sourcePayments, todayKey],
  );
  const sortedCalendarNotes = useMemo(
    () => [...sourceNotes].sort((left, right) => left.date.localeCompare(right.date)),
    [sourceNotes],
  );
  const pastNoteCleanupCandidates = useMemo(
    () => sortedCalendarNotes.filter(note => note.date < todayKey),
    [sortedCalendarNotes, todayKey],
  );
  const upcomingCalendarNotes = useMemo(
    () => sortedCalendarNotes.filter(note => note.date >= startDate),
    [sortedCalendarNotes, startDate],
  );

  const pageSize = 50;
  const carouselPaymentOccurrenceLimit = carouselLimit + upcomingCalendarNotes.length;
  const loadedOccurrences = useMemo(
    () => variant === 'carousel'
      ? getOutstandingPaymentOccurrences(sourcePayments, startDate, carouselPaymentOccurrenceLimit)
      : getPaymentOccurrencesForFilter(sourcePayments, startDate, filter, Number.MAX_SAFE_INTEGER),
    [sourcePayments, startDate, filter, carouselPaymentOccurrenceLimit, variant],
  );
  const carouselItems = useMemo(
    () => variant === 'carousel'
      ? mergeCalendarDashboardItems(loadedOccurrences, upcomingCalendarNotes, startDate, carouselLimit)
      : [],
    [loadedOccurrences, upcomingCalendarNotes, startDate, carouselLimit, variant],
  );
  const hasPrevious = variant === 'list' && listWindow.start > 0;
  const hasMore = variant === 'list' && listWindow.end < loadedOccurrences.length;
  const occurrences = variant === 'list'
    ? loadedOccurrences.slice(listWindow.start, listWindow.end)
    : loadedOccurrences;
  const calendarListItems = useMemo(
    () => variant === 'list' ? mergeCalendarPlanItems(occurrences, sortedCalendarNotes) : [],
    [occurrences, sortedCalendarNotes, variant],
  );
  // Today's preview: everything still open for today plus the overdue tail.
  const todayItems = useMemo(
    () => variant === 'carousel'
      ? mergeCalendarPlanItems(
        getOutstandingPaymentOccurrences(sourcePayments, todayKey, Number.MAX_SAFE_INTEGER)
          .filter(item => item.date <= todayKey),
        sortedCalendarNotes.filter(note => note.date === todayKey),
      )
      : [],
    [sourcePayments, sortedCalendarNotes, todayKey, variant],
  );
  const focusedOccurrence = useMemo(
    () => variant === 'carousel'
      ? undefined
      : occurrences.find(item => occurrenceKey(item) === focusedKey)
        || (focusedDate && focusedDate !== getTodayKey()
          ? occurrences.find(item => item.date === focusedDate)
          : undefined)
        || getDefaultFocusOccurrence(occurrences, startDate)
        || occurrences[0],
    [occurrences, focusedDate, focusedKey, startDate, variant],
  );
  const focusedCalendarNote = useMemo(
    () => variant === 'carousel'
      ? undefined
      : sortedCalendarNotes.find(note => note.id === focusedNoteId
        && (!focusedDate || note.date === focusedDate)),
    [variant, sortedCalendarNotes, focusedNoteId, focusedDate],
  );
  const focusedIsCompleted = Boolean(
    focusedOccurrence
    && (focusedOccurrence.status === 'paid'
      || focusedOccurrence.manuallyCompleted
      || focusedOccurrence.transactionId),
  );
  useEffect(() => {
    const startDateChanged = previousStartDate.current !== startDate;
    if (startDateChanged) {
      previousStartDate.current = startDate;
    }
    if (variant === 'list' && startDateChanged) {
      const next = occurrences.find(item => item.date === startDate) || occurrences[0];
      setFocusedKey(next ? occurrenceKey(next) : null);
      return;
    }
    if (variant === 'carousel') return;
    if (!occurrences.some(item => occurrenceKey(item) === focusedKey)) {
      const next = getDefaultFocusOccurrence(occurrences, startDate);
      setFocusedKey(next ? occurrenceKey(next) : null);
    }
  }, [occurrences, startDate, variant, focusedKey]);

  useEffect(() => {
    if (variant !== 'list') return;
    const initialFocus = loadedOccurrences.length > 0
      ? getDefaultFocusOccurrence(loadedOccurrences, startDate)
      : undefined;
    setListWindow(getInitialListWindow(
      loadedOccurrences,
      initialFocus,
      startDate,
      pageSize,
    ));
    previousListHeight.current = null;
    listRef.current?.scrollTo?.({ top: 0 });
  }, [filter, startDate, variant, sourcePayments.length]);

  useLayoutEffect(() => {
    if (previousListHeight.current === null || !listRef.current) return;
    const element = listRef.current;
    element.scrollTop += element.scrollHeight - previousListHeight.current;
    previousListHeight.current = null;
  }, [listWindow.start, listWindow.end]);

  useLayoutEffect(() => {
    if (variant !== 'list' || !focusedKey || !listRef.current) return;
    const element = listRef.current;
    const target = Array.from(element.querySelectorAll<HTMLElement>('[data-upcoming-task]'))
      .find(item => item.dataset.upcomingTask === focusedKey);
    if (!target) return;

    const targetTop = target.offsetTop - element.offsetTop;
    const targetCenter = targetTop + target.offsetHeight / 2;
    const nextTop = Math.max(0, targetCenter - element.clientHeight / 2);
    if (Math.abs(element.scrollTop - nextTop) < 4) return;

    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: nextTop, behavior: 'smooth' });
    } else {
      element.scrollTop = nextTop;
    }
  }, [focusedKey, listWindow.start, listWindow.end, occurrences.length, variant]);

  const toggleLocally = async (item: PlannedPaymentOccurrence) => {
    if (item.transactionId) return;
    if (onToggleTask) {
      await onToggleTask(item);
      return;
    }
    const previousPayments = sourcePayments;
    const nextPayments = updatePaymentStatus(previousPayments, item);
    if (payments !== undefined) setLocalPayments(nextPayments);
    else setLoadedPayments(nextPayments);
    try {
      await calendarApi.setOccurrenceCompleted(item.payment.id, item.date, true);
      cacheCalendarSnapshot(nextPayments);
    } catch {
      if (payments !== undefined) setLocalPayments(previousPayments);
      else setLoadedPayments(previousPayments);
      setError('Не удалось отметить задачу. Попробуйте ещё раз.');
    }
  };

  // The strip grows lazily: when the user scrolls close to its right edge,
  // the next page of plans is merged in.
  const handleCarouselScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (carouselItems.length < carouselLimit) return;
    if (element.scrollWidth - element.scrollLeft - element.clientWidth < 240) {
      setCarouselLimit(current => current + limit);
    }
  };

  const loadMore = () => {
    if (hasMore) {
      setListWindow(current => ({
        ...current,
        end: Math.min(loadedOccurrences.length, current.end + pageSize),
      }));
    }
  };

  const loadPrevious = () => {
    if (!hasPrevious || !listRef.current || previousListHeight.current !== null) return;
    previousListHeight.current = listRef.current.scrollHeight;
    setListWindow(current => ({
      ...current,
      start: Math.max(0, current.start - pageSize),
    }));
  };

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollTop < 120) loadPrevious();
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 120) loadMore();
  };

  const requestDelete = (item = focusedOccurrence) => {
    if (item) {
      setCleanupError(null);
      setViewItem(null);
      setCleanupConfirmation({ type: 'single', item });
    }
  };

  const requestNoteDelete = (note = focusedCalendarNote) => {
    if (!note) return;
    setCleanupError(null);
    setViewItem(null);
    setCleanupConfirmation({ type: 'note', note });
  };

  const openNoteDialog = (note: CalendarNote) => {
    setEditingNote({ ...note });
    setNoteDialogError(null);
    setConfirmDeleteNote(false);
    setNoteDialogMode('view');
  };

  const closeNoteDialog = () => {
    if (isSavingNote) return;
    setNoteDialogMode(null);
    setEditingNote(null);
    setNoteDialogError(null);
    setConfirmDeleteNote(false);
  };

  const persistNotes = async (nextNotes: CalendarNote[]) => {
    const previousLocalNotes = localNotes;
    const previousNotes = sourceNotes;
    setLocalNotes(nextNotes);
    try {
      await calendarApi.syncNotes(previousNotes, nextNotes);
      cacheCalendarSnapshot(sourcePayments, nextNotes);
    } catch (error) {
      setLocalNotes(previousLocalNotes);
      throw error;
    }
  };

  const saveEditingNote = async () => {
    if (!editingNote || !editingNote.date || !editingNote.text.trim()) return;
    const nextNote = { ...editingNote, text: editingNote.text.trim() };
    const nextNotes = [
      ...sourceNotes.filter(note => note.id !== nextNote.id),
      nextNote,
    ].sort((left, right) => left.date.localeCompare(right.date));

    setIsSavingNote(true);
    setNoteDialogError(null);
    try {
      await persistNotes(nextNotes);
      setNoteDialogMode(null);
      setEditingNote(null);
      setConfirmDeleteNote(false);
    } catch (error) {
      console.error('Calendar note save error:', error);
      setNoteDialogError('Не удалось сохранить записку. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const deleteEditingNote = async () => {
    if (!editingNote) return;
    const nextNotes = sourceNotes.filter(note => note.id !== editingNote.id);

    setIsSavingNote(true);
    setNoteDialogError(null);
    try {
      if (onDeleteNote) {
        await onDeleteNote(editingNote);
        setLocalNotes(nextNotes);
      } else {
        await persistNotes(nextNotes);
      }
      setNoteDialogMode(null);
      setEditingNote(null);
      setConfirmDeleteNote(false);
    } catch (error) {
      console.error('Calendar note delete error:', error);
      setNoteDialogError('Не удалось удалить записку. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const requestPastCleanup = () => {
    const paymentIds = pastCleanupCandidates.map(payment => payment.id);
    const noteIds = pastNoteCleanupCandidates.map(note => note.id);
    if (paymentIds.length === 0 && noteIds.length === 0) return;
    setCleanupError(null);
    setCleanupConfirmation({
      type: 'bulk',
      paymentIds,
      noteIds,
    });
  };

  const confirmCleanup = async () => {
    if (!cleanupConfirmation) return;
    setIsCleaningUp(true);
    setCleanupError(null);
    try {
      if (cleanupConfirmation.type === 'single') {
        if (onDeleteTask) {
          await onDeleteTask(cleanupConfirmation.item);
        } else {
          const previousPayments = sourcePayments;
          const nextPayments = applyCalendarPlanTrash(
            sourcePayments,
            cleanupConfirmation.item.payment.id,
            todayKey,
          );
          if (payments !== undefined) setLocalPayments(nextPayments);
          else setLoadedPayments(nextPayments);
          try {
            await calendarApi.syncPlans(previousPayments, nextPayments);
            cacheCalendarSnapshot(nextPayments);
          } catch (error) {
            if (payments !== undefined) setLocalPayments(previousPayments);
            else setLoadedPayments(previousPayments);
            throw error;
          }
        }
      } else if (cleanupConfirmation.type === 'note') {
        const noteId = cleanupConfirmation.note.id;
        if (onDeleteNote) await onDeleteNote(cleanupConfirmation.note);
        else await persistNotes(sourceNotes.filter(note => note.id !== noteId));
      } else if (cleanupConfirmation.noteIds.length > 0) {
        await onCleanupPastTasks?.(cleanupConfirmation.paymentIds, cleanupConfirmation.noteIds);
      } else {
        await onCleanupPastTasks?.(cleanupConfirmation.paymentIds);
      }
      setCleanupConfirmation(null);
    } catch (error) {
      console.error('Calendar plan cleanup error:', error);
      setCleanupError('Не удалось выполнить очистку. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleCarouselCheckbox = (item: PlannedPaymentOccurrence) => {
    if (item.transactionId) return;
    if (onRequestTransaction) {
      // The created operation is linked to this occurrence on the server
      // (calendarPlanId + calendarDate), so only the local copy is updated
      // here; the socket refresh brings the stored link.
      onRequestTransaction(item, () => {
        const nextPayments = updatePaymentStatus(sourcePayments, item);
        if (payments !== undefined) setLocalPayments(nextPayments);
        else setLoadedPayments(nextPayments);
      });
      return;
    }
    void toggleLocally(item);
  };

  const quietOverdueOccurrence = (item: PlannedPaymentOccurrence) => {
    if (!isOccurrenceOverdue(item, now)) return;
    const key = occurrenceKey(item);
    setQuietOverdue(current => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const executeOccurrence = (item: PlannedPaymentOccurrence) => {
    quietOverdueOccurrence(item);
    handleCarouselCheckbox(item);
  };

  const renderPlanCard = (item: CalendarDashboardItem, layout: 'strip' | 'stack' = 'strip') => {
    const occurrence = item.kind === 'payment' ? item.occurrence : undefined;
    const overdue = Boolean(occurrence && isOccurrenceOverdue(occurrence, now));
    return (
      <PlanCard
        key={item.key}
        item={item}
        layout={layout}
        overdue={overdue}
        pulsing={overdue && !quietOverdue.has(item.key)}
        onSelect={() => occurrence && quietOverdueOccurrence(occurrence)}
        onView={() => {
          if (item.kind === 'note') openNoteDialog(item.note);
          else {
            quietOverdueOccurrence(item.occurrence);
            setViewItem(item.occurrence);
          }
        }}
        onExecute={occurrence ? () => executeOccurrence(occurrence) : undefined}
        onDelete={() => item.kind === 'note' ? requestNoteDelete(item.note) : requestDelete(item.occurrence)}
      />
    );
  };

  return (
    <section className={`h-full w-full rounded-2xl border border-theme-base bg-theme-surface p-4 ${className || ''}`} data-testid="upcoming-tasks">
      <header className="flex items-center justify-between gap-2">
        {variant === 'carousel' && (
          onOpenCalendar ? (
            <button
              type="button"
              aria-label="Открыть календарь предстоящих планов"
              data-testid="button-upcoming-calendar"
              onClick={onOpenCalendar}
              className="min-w-0 inline-flex items-center gap-2 rounded-lg text-theme-muted hover:text-theme-primary active:scale-95 transition-all text-left"
            >
              <span className="text-[15px] uppercase tracking-wider font-bold truncate">Предстоящие планы</span>
              <CalendarDays size={16} className="shrink-0" aria-hidden="true" />
            </button>
          ) : (
            <div className="min-w-0 inline-flex items-center gap-2 text-theme-muted">
              <span className="text-[15px] uppercase tracking-wider font-bold truncate">Предстоящие планы</span>
              <CalendarDays size={16} className="shrink-0" aria-hidden="true" />
            </div>
          )
        )}
        <div className="ml-auto flex items-center gap-1">
          {variant === 'carousel' && (
            <button
              type="button"
              aria-label="Показать планы на сегодня и просроченные"
              title="Сегодня и просрочка"
              data-testid="button-upcoming-today"
              onClick={() => setTodayPreviewOpen(true)}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:bg-theme-main hover:text-theme-primary active:scale-95 transition-all"
            >
              <CalendarClock size={16} />
              {todayItems.length > 0 && (
                <span
                  data-testid="upcoming-today-count"
                  className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full px-1 text-[9px] font-bold leading-4 text-white ${todayItems.some(item => item.kind === 'payment' && isOccurrenceOverdue(item.occurrence, now)) ? 'bg-red-500' : 'bg-theme-primary'}`}
                >
                  {todayItems.length}
                </span>
              )}
            </button>
          )}
          {onAdd && (
            <button type="button" aria-label="Запланировать задачу" title="Запланировать задачу" onClick={onAdd} className="p-2 rounded-lg bg-theme-primary-light text-theme-primary">
              <Plus size={16} />
            </button>
          )}
          {onAddNote && variant !== 'carousel' && (
            <button
              type="button"
              aria-label="Добавить отдельную записку"
              title="Добавить записку на дату"
              data-testid="button-add-calendar-note-from-list"
              onClick={onAddNote}
              className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 hover:bg-amber-100"
            >
              <ScrollText size={16} aria-hidden="true" />
            </button>
          )}
          {variant !== 'carousel' && (
            <button
              type="button"
              aria-label={focusedCalendarNote ? 'Посмотреть выбранную записку' : 'Посмотреть сфокусированный план'}
              title="Посмотреть план, записку и действия"
              data-testid="button-upcoming-view"
              disabled={(!focusedCalendarNote && !focusedOccurrence) || (Boolean(focusedCalendarNote) && !onNoteClick)}
              onClick={() => {
                if (focusedCalendarNote) onNoteClick?.(focusedCalendarNote);
                else if (focusedOccurrence) setViewItem(focusedOccurrence);
              }}
              className="p-2 rounded-lg text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none"
            >
              <Eye size={15} />
            </button>
          )}
          {(onCopyTask || onCopyNote) && (
            <button
              type="button"
              aria-label={focusedCalendarNote ? 'Скопировать выбранную записку' : 'Скопировать сфокусированный план'}
              title={focusedCalendarNote ? 'Скопировать записку' : 'Скопировать план'}
              data-testid="button-upcoming-copy"
              disabled={focusedCalendarNote ? !onCopyNote : !focusedOccurrence || !onCopyTask}
              onClick={() => {
                if (focusedCalendarNote) onCopyNote?.(focusedCalendarNote);
                else if (focusedOccurrence) onCopyTask?.(focusedOccurrence);
              }}
              className="p-2 rounded-lg text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none"
            >
              <Copy size={15} />
            </button>
          )}
          {onManualToggleTask && (
            <button type="button" aria-label={focusedOccurrence?.manuallyCompleted ? 'Снять ручную отметку' : 'Отметить вручную'} title={focusedCalendarNote ? 'Записку нельзя отметить выполненной' : focusedIsCompleted ? 'Выполненный план нельзя менять вручную' : focusedOccurrence?.manuallyCompleted ? 'Снять ручную отметку' : 'Отметить вручную'} data-testid="button-upcoming-manual-toggle" disabled={Boolean(focusedCalendarNote) || !focusedOccurrence || focusedIsCompleted} onClick={() => focusedOccurrence && !focusedCalendarNote && !focusedIsCompleted && void onManualToggleTask(focusedOccurrence)} className="p-2 rounded-lg text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none">
              <Hand size={15} />
            </button>
          )}
          {variant !== 'carousel' && onCleanupPastTasks && (
            <button
              type="button"
              aria-label="Очистить завершённые планы и старые записки"
              title={pastCleanupCandidates.length + pastNoteCleanupCandidates.length > 0
                ? `Очистить планы и записки (${pastCleanupCandidates.length + pastNoteCleanupCandidates.length})`
                : 'Нет завершённых планов и старых записок для очистки'}
              data-testid="button-upcoming-clean-past"
              disabled={pastCleanupCandidates.length === 0 && pastNoteCleanupCandidates.length === 0}
              onClick={requestPastCleanup}
              className="p-2 rounded-lg text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none"
            >
              <Eraser size={15} />
            </button>
          )}
          {(onDeleteTask || onDeleteNote) && (
            <button
              type="button"
              aria-label={focusedCalendarNote ? 'Удалить выбранную записку' : 'Удалить или очистить сфокусированный план'}
              title={focusedCalendarNote
                ? 'Удалить записку из календаря'
                : focusedOccurrence
                  ? getCalendarPlanCleanupMode(focusedOccurrence.payment, todayKey) === 'reset-history'
                    ? 'Скрыть прошлые отметки, план продолжится со следующего запуска по графику'
                    : 'Удалить план целиком из календаря'
                  : 'Выберите план'}
              data-testid="button-upcoming-delete"
              disabled={focusedCalendarNote ? !onDeleteNote : !focusedOccurrence || !onDeleteTask}
              onClick={() => focusedCalendarNote ? requestNoteDelete() : requestDelete()}
              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="py-10 text-center text-xs text-theme-muted">Загружаем задачи...</div>
      ) : error ? (
        <div className="py-10 text-center text-xs text-rose-600">{error}</div>
      ) : (variant === 'carousel'
        ? carouselItems.length === 0
        : occurrences.length === 0 && sortedCalendarNotes.length === 0) ? (
        <div className="py-10 text-center text-xs text-theme-muted">
          <CircleDashed size={20} className="mx-auto mb-2" />
          Предстоящих задач нет
        </div>
      ) : variant === 'carousel' ? (
        <div className="mt-3 -mx-2 overflow-hidden">
          <div
            className="flex items-stretch gap-3 overflow-x-auto px-2 pb-1 no-scrollbar snap-x snap-mandatory overscroll-x-contain"
            data-testid="upcoming-tasks-carousel"
            onScroll={handleCarouselScroll}
          >
            {carouselItems.map(item => renderPlanCard(item))}
          </div>
        </div>
      ) : (
          <div ref={listRef} className="max-h-[min(65vh,620px)] overflow-y-auto no-scrollbar overscroll-contain touch-pan-y space-y-2 pt-3 pr-1" onScroll={handleListScroll} data-testid="upcoming-tasks-list">
          {hasPrevious && (
            <button type="button" data-testid="button-upcoming-load-previous" onClick={loadPrevious} className="w-full rounded-xl border border-dashed border-theme-base px-3 py-2 text-xs text-theme-muted hover:bg-theme-main">
              Показать более ранние
            </button>
          )}
          {calendarListItems.map(entry => {
            if (entry.kind === 'note') {
              const note = entry.note;
              return (
                <button
                  key={entry.key}
                  type="button"
                  data-testid={`calendar-note-row-${note.id}`}
                  data-calendar-plan-entry="note"
                  data-calendar-item-key={entry.key}
                  data-upcoming-date={entry.date}
                  onClick={() => {
                    setFocusedNoteId(note.id);
                    onTaskClick?.(note.date);
                    onNoteClick?.(note);
                  }}
                  disabled={!onNoteClick}
                  className={`flex w-full items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-amber-950 disabled:cursor-default ${focusedCalendarNote?.id === note.id ? 'ring-2 ring-inset ring-amber-300' : ''}`}
                >
                  <ScrollText size={15} data-testid={`calendar-note-icon-${note.id}`} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold text-amber-800">
                      {formatLongTaskDate(note.date)}
                    </span>
                    <span className="block whitespace-pre-wrap break-words text-xs">{note.text}</span>
                  </span>
                </button>
              );
            }

            const item = entry.occurrence;
            const key = entry.key;
            const canToggle = Boolean(onToggleTask);
            const isFocused = Boolean(
              focusedOccurrence && occurrenceKey(item) === occurrenceKey(focusedOccurrence),
            );
            const focusedBorder = isFocused
              ? `border-dashed ${isCompletedOccurrence(item) ? 'border-theme-base' : 'border-theme-primary'}`
              : 'border-transparent';
            return (
              <article
                key={entry.key}
                className={`flex items-center gap-2 rounded-xl px-2 py-2 border ${focusedBorder} ${occurrenceTone(item, now)}`}
                data-testid={`payment-row-${key}`}
                data-upcoming-task={key}
                data-calendar-plan-entry="payment"
                data-calendar-item-key={entry.key}
                data-upcoming-date={entry.date}
              >
                {canToggle && (
                  <button
                    type="button"
                    aria-label={item.transactionId ? `Операция уже создана: ${item.payment.title}` : `Отметить задачу: ${item.payment.title}`}
                    title={item.transactionId ? 'Операция уже создана' : 'Создать операцию'}
                    disabled={Boolean(item.transactionId)}
                    onClick={() => void toggleLocally(item)}
                    data-testid={`button-toggle-payment-${key}`}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 disabled:cursor-not-allowed ${item.transactionId ? 'border-theme-base bg-theme-main text-theme-muted' : 'border-theme-base bg-theme-surface/70'}`}
                  >
                    {item.transactionId && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFocusedNoteId(null);
                    setFocusedKey(key);
                    onTaskClick?.(item.date);
                    setViewItem(item);
                  }}
                  className="min-w-0 flex-1 text-left"
                  data-testid={`upcoming-task-link-${key}`}
                >
                  <strong className="flex items-center gap-1 text-xs leading-tight break-words">
                    <span>{formatMoney(item.payment.amount)}</span>{' '}
                    <span aria-hidden="true">·</span>{' '}
                    <span className="min-w-0">{item.payment.title}</span>
                    {item.payment.note?.trim() && (
                      <StickyNote size={12} className="shrink-0 text-amber-700" aria-label="У плана есть записка" />
                    )}
                  </strong>
                  <span className="block text-[10px] opacity-75 leading-snug break-words">
                    {formatTaskDate(item.date)}
                    {item.payment.time && <> · <time>{item.payment.time}</time></>}
                    {' · '}{item.payment.categoryName || 'Без категории'} · {recurrenceLabel(item.payment)}
                  </span>
                </button>
              </article>
            );
          })}
          {hasMore && (
            <button type="button" data-testid="button-upcoming-load-more" onClick={loadMore} className="w-full rounded-xl border border-dashed border-theme-base px-3 py-2 text-xs text-theme-muted hover:bg-theme-main">
              Загрузить ещё
            </button>
          )}
        </div>
      )}
      {todayPreviewOpen && (
        <TodayPlansDialog
          todayKey={todayKey}
          items={todayItems}
          renderItem={item => renderPlanCard(item, 'stack')}
          onClose={() => setTodayPreviewOpen(false)}
        />
      )}
      {noteDialogMode && editingNote && (
        <CalendarNoteDialog
          mode={noteDialogMode}
          note={editingNote}
          error={noteDialogError}
          saving={isSavingNote}
          canEdit
          confirmDelete={confirmDeleteNote}
          onChange={setEditingNote}
          onClose={closeNoteDialog}
          onEdit={() => {
            setNoteDialogError(null);
            setConfirmDeleteNote(false);
            setNoteDialogMode('edit');
          }}
          onRequestDelete={() => setConfirmDeleteNote(true)}
          onCancelDelete={() => setConfirmDeleteNote(false)}
          onConfirmDelete={() => void deleteEditingNote()}
          onSave={() => void saveEditingNote()}
        />
      )}
      {viewItem && (
        <PlanViewDialog
          item={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={onEditTask ? () => {
            const item = viewItem;
            setViewItem(null);
            onEditTask(item);
          } : undefined}
          onDelete={onDeleteTask || variant === 'carousel' ? () => requestDelete(viewItem) : undefined}
          onExecute={variant === 'carousel' || onToggleTask ? () => {
            const item = viewItem;
            setViewItem(null);
            if (variant === 'carousel') executeOccurrence(item);
            else void toggleLocally(item);
          } : undefined}
        />
      )}
      {cleanupConfirmation && (
        <PlanCleanupDialog
          confirmation={cleanupConfirmation}
          today={todayKey}
          candidates={pastCleanupCandidates}
          notes={sortedCalendarNotes}
          error={cleanupError}
          pending={isCleaningUp}
          onClose={() => {
            if (isCleaningUp) return;
            setCleanupConfirmation(null);
            setCleanupError(null);
          }}
          onConfirm={() => void confirmCleanup()}
        />
      )}
    </section>
  );
}

type PlanKind = 'expense' | 'income' | 'transfer' | 'note';

function planKind(item: CalendarDashboardItem): PlanKind {
  if (item.kind === 'note') return 'note';
  const type = item.occurrence.payment.transactionType;
  return type === 'income' || type === 'transfer' ? type : 'expense';
}

const PLAN_KIND_TILE: Record<PlanKind, string> = {
  expense: 'bg-pink-100 text-pink-800',
  income: 'bg-lime-100 text-lime-800',
  transfer: 'bg-sky-100 text-blue-600',
  note: 'bg-amber-100 text-amber-800',
};

const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  expense: 'Расход',
  income: 'Доход',
  transfer: 'Перевод',
  note: 'Записка',
};

/**
 * One dashboard plan card: a coloured tile on the left (amount of the plan,
 * or a scroll for a standalone note) and the title, date and actions on the
 * right. In the strip the card is only as wide as its text, so the next card
 * peeks out on the right.
 */
function PlanCard({
  item,
  layout,
  overdue,
  pulsing,
  onSelect,
  onView,
  onExecute,
  onDelete,
}: {
  item: CalendarDashboardItem;
  layout: 'strip' | 'stack';
  overdue: boolean;
  pulsing: boolean;
  onSelect: () => void;
  onView: () => void;
  onExecute?: () => void;
  onDelete: () => void;
}) {
  const kind = planKind(item);
  const occurrence = item.kind === 'payment' ? item.occurrence : undefined;
  const payment = occurrence?.payment;
  const title = item.kind === 'note' ? item.note.text : item.occurrence.payment.title;
  const completed = Boolean(occurrence && isCompletedOccurrence(occurrence));
  const executed = Boolean(occurrence?.transactionId);
  const dateLine = item.kind === 'note'
    ? formatTaskDate(item.note.date)
    : [
      overdue ? `Просрочено · ${formatTaskDate(item.occurrence.date)}` : formatTaskDate(item.occurrence.date),
      item.occurrence.payment.time,
      item.occurrence.payment.recurrence !== 'none' ? recurrenceLabel(item.occurrence.payment) : undefined,
    ].filter(Boolean).join(' · ');
  const stopPointer = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <article
      className={`flex gap-3 rounded-2xl border p-2.5 pr-3 transition-colors ${layout === 'strip'
        ? 'w-max min-w-[220px] max-w-[min(85%,360px)] shrink-0 snap-start'
        : 'w-full'} ${overdue
        ? `border-red-300 bg-theme-primary-pastel${pulsing ? ' animate-overdue-pulse' : ''}`
        : 'border-transparent bg-theme-primary-pastel'} ${completed ? 'opacity-70' : ''}`}
      data-testid={item.kind === 'note'
        ? `upcoming-note-card-${item.note.id}`
        : `upcoming-banner-${item.occurrence.payment.id}-${item.occurrence.date}`}
      data-upcoming-item={item.key}
      data-upcoming-date={item.date}
      data-plan-kind={kind}
      onClick={onSelect}
    >
      <div
        className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center ${PLAN_KIND_TILE[kind]}`}
        data-testid="upcoming-card-tile"
        title={PLAN_KIND_LABEL[kind]}
      >
        {item.kind === 'note' ? (
          <ScrollText size={28} aria-label="Записка" />
        ) : (
          <>
            {kind === 'transfer' && <ArrowLeftRight size={13} aria-hidden="true" />}
            <span className={`max-w-full rounded-full bg-white/70 py-0.5 font-bold leading-tight tabular-nums whitespace-nowrap ${formatTileAmount(payment!.amount).length > 8 ? 'px-1 text-[11px]' : 'px-1.5 text-[13px]'}`}>
              {formatTileAmount(payment!.amount)}
            </span>
            <span className="sr-only">{PLAN_KIND_LABEL[kind]}</span>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <strong
          className="block overflow-hidden whitespace-pre-wrap break-words text-sm font-semibold leading-snug text-theme-main line-clamp-2"
          title={title}
        >
          {title}
          {payment?.note?.trim() && (
            <StickyNote size={12} className="ml-1 inline-block align-[-1px] text-amber-700" aria-label="У плана есть записка" />
          )}
        </strong>
        <span
          className={`mt-0.5 block truncate text-xs ${overdue ? 'font-semibold text-red-600' : 'text-theme-muted'}`}
          data-testid="upcoming-card-date"
        >
          {dateLine}
          {kind === 'transfer' && payment?.accountName && payment.targetAccountName
            ? ` · ${payment.accountName} → ${payment.targetAccountName}`
            : ''}
        </span>
        <div className="mt-auto flex items-center gap-1 pt-2" onPointerDown={stopPointer}>
          <button
            type="button"
            aria-label={item.kind === 'note' ? 'Посмотреть записку' : `Посмотреть план: ${title}`}
            title="Посмотреть"
            data-testid={`button-upcoming-card-view-${item.key}`}
            onClick={event => {
              event.stopPropagation();
              onView();
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-theme-surface text-theme-muted hover:text-theme-primary active:scale-95"
          >
            <Eye size={15} />
          </button>
          {occurrence && onExecute && (
            <button
              type="button"
              aria-label={executed ? `Операция уже создана: ${title}` : `Исполнить план: ${title}`}
              title={executed ? 'Операция уже создана' : 'Создать операцию по плану'}
              disabled={executed}
              data-testid={`button-toggle-payment-${occurrence.payment.id}-${occurrence.date}`}
              onClick={event => {
                event.stopPropagation();
                onExecute();
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-theme-surface px-3 text-xs font-bold text-theme-main hover:text-theme-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {executed && <Check size={13} strokeWidth={3} aria-hidden="true" />}
              {executed ? 'Исполнено' : 'Исполнить'}
            </button>
          )}
          <button
            type="button"
            aria-label={item.kind === 'note' ? 'Удалить записку' : `Удалить план: ${title}`}
            title="Удалить"
            data-testid={`button-upcoming-card-delete-${item.key}`}
            onClick={event => {
              event.stopPropagation();
              onDelete();
            }}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 active:scale-95"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function TodayPlansDialog({
  todayKey,
  items,
  renderItem,
  onClose,
}: {
  todayKey: string;
  items: CalendarDashboardItem[];
  renderItem: (item: CalendarDashboardItem) => React.ReactNode;
  onClose: () => void;
}) {
  const overdueItems = items.filter(item => item.date < todayKey);
  const todaysItems = items.filter(item => item.date === todayKey);
  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/45 p-3 sm:p-5"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex w-full max-w-md max-h-[min(88dvh,760px)] flex-col rounded-2xl border border-theme-base bg-theme-surface p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-plans-title"
        data-testid="dialog-upcoming-today"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="today-plans-title" className="text-base font-bold text-theme-main">Сегодня</h2>
            <p className="text-xs text-theme-muted first-letter:uppercase">{formatLongTaskDate(todayKey)}</p>
          </div>
          <button type="button" aria-label="Закрыть просмотр на сегодня" onClick={onClose} className="rounded-lg p-1 text-theme-muted hover:bg-theme-main">
            <X size={18} />
          </button>
        </header>
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto no-scrollbar">
          {items.length === 0 && (
            <p className="py-8 text-center text-xs text-theme-muted">
              <CircleDashed size={20} className="mx-auto mb-2" />
              На сегодня планов нет, просрочки тоже нет
            </p>
          )}
          {overdueItems.length > 0 && (
            <div className="space-y-2" data-testid="upcoming-today-overdue">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-600">Просрочено · {overdueItems.length}</h3>
              {overdueItems.map(item => renderItem(item))}
            </div>
          )}
          {todaysItems.length > 0 && (
            <div className="space-y-2" data-testid="upcoming-today-current">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">На сегодня · {todaysItems.length}</h3>
              {todaysItems.map(item => renderItem(item))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type PlanCleanupConfirmation =
  | { type: 'single'; item: PlannedPaymentOccurrence }
  | { type: 'note'; note: CalendarNote }
  | { type: 'bulk'; paymentIds: string[]; noteIds: string[] };

function PlanViewDialog({
  item,
  onClose,
  onEdit,
  onDelete,
  onExecute,
}: {
  item: PlannedPaymentOccurrence;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onExecute?: () => void;
}) {
  const payment = item.payment;
  const executed = Boolean(item.transactionId);
  return (
    <div
      className="fixed inset-0 z-[118] flex items-center justify-center bg-black/45 p-3 sm:p-5"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="w-full max-w-md rounded-2xl border border-theme-base bg-theme-surface p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-view-title"
        data-testid="dialog-plan-view"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-theme-muted">{formatLongTaskDate(item.date)}</p>
            <h2 id="plan-view-title" className="mt-1 break-words text-lg font-bold text-theme-main">
              {payment.title}
            </h2>
          </div>
          <button type="button" aria-label="Закрыть просмотр плана" onClick={onClose} className="rounded-lg p-1 text-theme-muted hover:bg-theme-main">
            <X size={18} />
          </button>
        </header>
        <div className="mt-4 space-y-2 text-sm text-theme-main">
          <p className="font-semibold">{formatMoney(payment.amount)}</p>
          <p className="text-xs text-theme-muted">
            {transactionTypeLabel(payment)}
            {payment.time ? ` · ${payment.time}` : ''}
            {` · ${recurrenceLabel(payment)}`}
          </p>
          <p className="text-xs text-theme-muted">
            {payment.transactionType === 'transfer'
              ? accountsLabel(payment)
              : <>{payment.categoryName || 'Без категории'}{payment.accountName ? ` · ${payment.accountName}` : ''}</>}
          </p>
          {payment.note?.trim() && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
              <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                <StickyNote size={13} aria-hidden="true" />
                Записка к плану
              </span>
              <p className="whitespace-pre-wrap break-words text-sm">{payment.note}</p>
            </div>
          )}
        </div>
        <footer className="mt-5 flex items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {onExecute && (
              <button
                type="button"
                role="checkbox"
                aria-checked={executed}
                disabled={executed}
                data-testid="button-plan-view-execute"
                title={executed ? 'Операция уже создана' : 'Создать операцию по плану'}
                onClick={onExecute}
                className="inline-flex items-center gap-2 rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-xs font-bold text-theme-main hover:border-theme-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${executed ? 'border-theme-primary bg-theme-primary text-white' : 'border-theme-base bg-theme-surface'}`}>
                  {executed && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                </span>
                {executed ? 'Исполнено' : 'Исполнить'}
              </button>
            )}
            {onEdit && (
              <button type="button" data-testid="button-plan-view-edit" onClick={onEdit} className="inline-flex items-center gap-1 rounded-xl bg-theme-primary px-3 py-2 text-xs font-bold text-white">
                <Pencil size={13} />
                Редактировать
              </button>
            )}
          </div>
          {onDelete && (
            <div className="ml-auto flex items-center border-l border-theme-base pl-2">
              <button
                type="button"
                aria-label="Удалить план"
                title="Удалить план"
                data-testid="button-plan-view-delete"
                onClick={onDelete}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
}

function PlanCleanupDialog({
  confirmation,
  today,
  candidates,
  notes,
  error,
  pending,
  onClose,
  onConfirm,
}: {
  confirmation: PlanCleanupConfirmation;
  today: string;
  candidates: PlannedPayment[];
  notes: CalendarNote[];
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const bulkCandidates = confirmation.type === 'bulk'
    ? candidates.filter(payment => confirmation.paymentIds.includes(payment.id))
    : [];
  const bulkNotes = confirmation.type === 'bulk'
    ? notes.filter(note => confirmation.noteIds.includes(note.id))
    : [];
  const bulkDeletes = bulkCandidates.filter(payment => (
    getCalendarPlanCleanupMode(payment, today) === 'delete'
  ));
  const bulkResets = bulkCandidates.filter(payment => (
    getCalendarPlanCleanupMode(payment, today) === 'reset-history'
  ));
  const singleMode = confirmation.type === 'single'
    ? getCalendarPlanCleanupMode(confirmation.item.payment, today)
    : null;
  const isSingleNote = confirmation.type === 'note';
  const canConfirm = confirmation.type === 'single'
    || isSingleNote
    || bulkCandidates.length + bulkNotes.length > 0;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3 sm:p-5"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="w-full max-w-md max-h-[min(88dvh,760px)] overflow-y-auto rounded-2xl border border-theme-base bg-theme-surface p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-cleanup-title"
        data-testid="dialog-plan-cleanup"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="plan-cleanup-title" className="text-base font-bold text-theme-main">
              {confirmation.type === 'bulk'
                ? 'Очистить прошлые планы и записки?'
                : isSingleNote
                  ? 'Удалить записку?'
                : singleMode === 'reset-history'
                  ? 'Скрыть старые отметки и продолжить план?'
                  : 'Удалить план целиком?'}
            </h2>
            <p className="mt-1 text-xs text-theme-muted">
              {confirmation.type === 'bulk'
                ? `Планов для очистки: ${bulkCandidates.length}. Старых записок для удаления: ${bulkNotes.length}.`
                : isSingleNote
                  ? `Записка на ${formatLongTaskDate(confirmation.note.date)} будет удалена из календаря.`
                  : 'Проверьте, какой план и какие отметки будут затронуты.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Закрыть подтверждение"
            data-testid="button-close-plan-cleanup"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-2 text-theme-muted hover:bg-theme-main disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </header>

        {confirmation.type === 'single' ? (
          <SinglePlanCleanupDetails
            item={confirmation.item}
            mode={singleMode || 'delete'}
            today={today}
          />
        ) : isSingleNote ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <ScrollText size={16} className="mb-2 text-amber-700" aria-hidden="true" />
            <p className="whitespace-pre-wrap break-words">{confirmation.note.text}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-theme-base bg-theme-main p-3 text-xs text-theme-main">
              <p>Из календаря удалится планов: <strong>{bulkDeletes.length}</strong>.</p>
              {bulkResets.length > 0 && (
                <p className="mt-1">С продолжением со следующего запуска по графику останется планов: <strong>{bulkResets.length}</strong>.</p>
              )}
              {bulkNotes.length > 0 && (
                <p className="mt-1">Старых записок будет удалено: <strong>{bulkNotes.length}</strong>.</p>
              )}
              <p className="mt-2 text-theme-muted">
                Планы с невыполненными просроченными вхождениями не затрагиваются.
                Связанные операции в истории не удаляются.
              </p>
            </div>
            {bulkCandidates.length + bulkNotes.length > 0 ? (
              <ul className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-theme-base p-3">
                {bulkCandidates.slice(0, 20).map(payment => (
                  <li key={payment.id} className="text-xs text-theme-main">
                    <strong className="block break-words">{payment.title}</strong>
                    <span className="text-theme-muted">
                      {formatMoney(payment.amount)} · {recurrenceLabel(payment)} · {payment.categoryName || 'Без категории'}
                      {' · '}
                      {getCalendarPlanCleanupMode(payment, today) === 'delete'
                        ? 'будет удалён из календаря'
                        : 'продолжится со следующего запуска по графику'}
                    </span>
                  </li>
                ))}
                {bulkCandidates.length > 20 && (
                  <li className="text-xs text-theme-muted">
                    И ещё {bulkCandidates.length - 20} планов.
                  </li>
                )}
                {bulkNotes.map(note => (
                  <li key={note.id} className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">
                    <ScrollText size={14} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                    <span className="min-w-0">
                      <strong className="block">{formatLongTaskDate(note.date)}</strong>
                      <span className="block whitespace-pre-wrap break-words">{note.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-theme-main p-3 text-xs text-theme-muted">
                Пока открывалось окно, подходящие планы и записки изменились. Закройте его и повторите очистку.
              </p>
            )}
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p>}

        <footer className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="button-upcoming-delete-cancel"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl bg-theme-main px-3 py-2 text-xs font-bold text-theme-muted disabled:opacity-40"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="button-upcoming-delete-confirm"
            onClick={onConfirm}
            disabled={pending || !canConfirm}
            className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40"
          >
            {pending
              ? 'Обработка…'
              : confirmation.type === 'bulk'
                ? 'Очистить прошлые'
                : isSingleNote
                  ? 'Удалить записку'
                : singleMode === 'reset-history'
                  ? 'Скрыть старые отметки'
                  : 'Удалить план'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function SinglePlanCleanupDetails({
  item,
  mode,
  today,
}: {
  item: PlannedPaymentOccurrence;
  mode: CalendarPlanCleanupMode;
  today: string;
}) {
  const completed = isCompletedOccurrence(item);
  const payment = item.payment;
  const nextPlanDate = mode === 'reset-history'
    ? getNextCalendarPlanDate(payment, today)
    : null;
  const dateLabel = new Date(`${item.date}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-theme-base bg-theme-main p-3">
        <strong className="block break-words text-sm text-theme-main">{payment.title}</strong>
        <p className="mt-1 text-xs text-theme-muted">
          {formatMoney(payment.amount)} · {dateLabel}{payment.time ? ` · ${payment.time}` : ''}
        </p>
        <p className="mt-1 text-xs text-theme-muted">
          {transactionTypeLabel(payment)} · {recurrenceLabel(payment)}
          {payment.transactionType !== 'transfer' && ` · ${payment.categoryName || 'Без категории'}`}
        </p>
        {accountsLabel(payment) && <p className="mt-1 text-xs text-theme-muted">Счёт: {accountsLabel(payment)}</p>}
        <p className={`mt-2 text-xs font-bold ${completed ? 'text-emerald-700' : 'text-rose-700'}`}>
          Выбранное вхождение: {completed ? 'выполнено' : 'НЕ выполнено'}
        </p>
      </div>
      {mode === 'reset-history' ? (
        <p className="text-xs leading-relaxed text-theme-muted">
          План продолжится со следующего запуска по графику{nextPlanDate ? ` — ${formatLongDate(nextPlanDate)}` : ''}.
          Отметки до этой даты перестанут отображаться в календаре. Связанные операции в истории не удаляются.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-theme-muted">
          План будет удалён из календаря целиком.
          {!completed && <strong className="text-rose-700"> Выбранное вхождение не выполнено.</strong>}
          {' '}Связанные операции в истории не удаляются.
        </p>
      )}
    </div>
  );
}

function formatLongDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function occurrenceTone(item: PlannedPaymentOccurrence, now = new Date()) {
  if (isCompletedOccurrence(item)) return 'bg-theme-main text-theme-muted opacity-80';
  if (isOccurrenceOverdue(item, now)) return 'bg-red-100 text-red-800';
  if (item.payment.transactionType === 'transfer') return 'bg-sky-50 text-blue-600';
  return item.payment.transactionType === 'income'
    ? 'bg-lime-50 text-lime-700'
    : 'bg-pink-50 text-pink-700';
}

function transactionTypeLabel(payment: PlannedPayment) {
  if (payment.transactionType === 'transfer') return 'Перевод';
  return payment.transactionType === 'income' ? 'Доход' : 'Расход';
}

function accountsLabel(payment: PlannedPayment) {
  if (payment.transactionType === 'transfer') {
    return `${payment.accountName || 'Счёт не выбран'} → ${payment.targetAccountName || 'Счёт не выбран'}`;
  }
  return payment.accountName || '';
}

function occurrenceKey(item: PlannedPaymentOccurrence) {
  return `${item.payment.id}-${item.date}`;
}

function getDefaultFocusOccurrence(
  occurrences: PlannedPaymentOccurrence[],
  anchorDate: string,
) {
  const incomplete = occurrences.filter(item => !isCompletedOccurrence(item));
  const firstOverdue = incomplete.find(item => isOccurrenceOverdue(item));
  if (firstOverdue) return firstOverdue;

  const todayKey = getTodayKey();
  return incomplete.find(item => item.date >= todayKey)
    || incomplete.find(item => item.date >= anchorDate)
    || incomplete[0]
    || occurrences[0];
}

function formatTaskDate(date: string) {
  if (date === getTodayKey()) return 'Сегодня';
  const taskDate = new Date(`${date}T12:00:00`);
  const today = new Date(`${getTodayKey()}T12:00:00`);
  const difference = Math.round((taskDate.getTime() - today.getTime()) / 86400000);
  if (difference === 0) return 'Сегодня';
  if (difference === 1) return 'Завтра';
  return taskDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace(/\.$/, '');
}

function formatLongTaskDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)} ₽`;
}

function formatTileAmount(amount: number) {
  if (Math.abs(amount) >= 1_000_000) {
    return `${new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)} ₽`;
  }
  return formatMoney(amount);
}

function updatePaymentStatus(payments: PlannedPayment[], item: PlannedPaymentOccurrence) {
  return payments.map(payment => {
    if (payment.id !== item.payment.id) return payment;
    const paidDates = new Set(payment.paidDates || []);
    paidDates.add(item.date);
    return {
      ...payment,
      paidDates: Array.from(paidDates),
      status: item.date === payment.date ? 'paid' as const : payment.status,
    };
  });
}

function recurrenceLabel(payment: PlannedPayment) {
  const labels: Record<Exclude<PlannedPaymentRecurrence, 'weekdays'>, string> = {
    none: 'Однократно',
    weekly: 'Еженедельно',
    biweekly: 'Раз в 2 недели',
    monthly: 'Ежемесячно',
    quarterly: 'Ежеквартально',
    yearly: 'Ежегодно',
  };
  if (payment.recurrence !== 'weekdays') return labels[payment.recurrence];

  const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const selectedDays = (payment.weekdays || [])
    .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
    .map(day => weekdayLabels[day - 1]);
  return selectedDays.length > 0 ? selectedDays.join(', ') : 'По дням недели';
}

function getInitialListWindow(
  occurrences: PlannedPaymentOccurrence[],
  focusOccurrence: PlannedPaymentOccurrence | undefined,
  anchorDate: string,
  pageSize: number,
) {
  if (occurrences.length === 0) return { start: 0, end: 0 };

  const focusIndex = focusOccurrence
    ? occurrences.findIndex(item => occurrenceKey(item) === occurrenceKey(focusOccurrence))
    : -1;
  const firstOccurrenceAtOrAfterAnchor = occurrences.findIndex(item => item.date >= anchorDate);
  const anchorIndex = focusIndex >= 0
    ? focusIndex
    : firstOccurrenceAtOrAfterAnchor >= 0
      ? firstOccurrenceAtOrAfterAnchor
    : occurrences.length - 1;
  const start = Math.max(0, Math.min(anchorIndex, occurrences.length - 1));

  return {
    start,
    end: Math.min(occurrences.length, start + pageSize),
  };
}