import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, CircleDashed, Copy, Eraser, Eye, Hand, Pencil, Plus, RefreshCw, ScrollText, StickyNote, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { CalendarNote, PlannedPayment, PlannedPaymentRecurrence } from '../types';
import { mergeCalendarDashboardItems } from '../lib/calendarDashboardItems';
import {
  getTodayKey,
  getOutstandingPaymentOccurrences,
  getPaymentOccurrencesForFilter,
  isPaymentOccurrenceOverdue,
  PlannedPaymentFilter,
  PlannedPaymentOccurrence,
} from '../lib/plannedPaymentOccurrences';
import {
  getCalendarPlanCleanupMode,
  getPastPlanCleanupCandidates,
  isCompletedOccurrence,
  applyCalendarPlanTrash,
  type CalendarPlanCleanupMode,
} from '../lib/calendarPlanCleanup';

interface UpcomingTasksProps {
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
  const [loading, setLoading] = useState(payments === undefined);
  const [error, setError] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselLimit, setCarouselLimit] = useState(limit);
  const [listWindow, setListWindow] = useState({ start: 0, end: 50 });
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<PlannedPaymentOccurrence | null>(null);
  const [cleanupConfirmation, setCleanupConfirmation] = useState<
    | { type: 'single'; item: PlannedPaymentOccurrence }
    | { type: 'note'; note: CalendarNote }
    | { type: 'bulk'; paymentIds: string[]; noteIds: string[] }
    | null
  >(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [quietOverdue, setQuietOverdue] = useState<Set<string>>(new Set());
  const pointerStartX = useRef<number | null>(null);
  const suppressCarouselClick = useRef(false);
  const previousStartDate = useRef(startDate);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previousListHeight = useRef<number | null>(null);

  useEffect(() => {
    if (payments !== undefined) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    api.get<{ payments?: PlannedPayment[]; notes?: CalendarNote[] }>('/plan-grid/calendar')
      .then(data => {
        if (!active) return;
        setLoadedPayments(Array.isArray(data?.payments) ? data.payments : []);
        setLoadedNotes(Array.isArray(data?.notes) ? data.notes : []);
        setError(null);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить предстоящие задачи.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [payments]);

  useEffect(() => {
    if (payments !== undefined) setLocalPayments(null);
  }, [payments]);

  const sourcePayments = localPayments ?? payments ?? loadedPayments;
  const sourceNotes = notes ?? loadedNotes;
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
  const activeCarouselIndex = carouselItems.length === 0 ? 0 : Math.min(carouselIndex, carouselItems.length - 1);
  const activeCarouselItem = carouselItems[activeCarouselIndex];
  const focusedOccurrence = useMemo(
    () => variant === 'carousel'
      ? activeCarouselItem?.kind === 'payment' ? activeCarouselItem.occurrence : undefined
      : occurrences.find(item => occurrenceKey(item) === focusedKey)
        || (focusedDate && focusedDate !== getTodayKey()
          ? occurrences.find(item => item.date === focusedDate)
          : undefined)
        || getDefaultFocusOccurrence(occurrences, startDate)
        || occurrences[0],
    [activeCarouselItem, occurrences, focusedDate, focusedKey, startDate, variant],
  );
  const focusedCalendarNote = useMemo(
    () => variant === 'carousel'
      ? activeCarouselItem?.kind === 'note' ? activeCarouselItem.note : undefined
      : sortedCalendarNotes.find(note => note.id === focusedNoteId
        && (!focusedDate || note.date === focusedDate)),
    [activeCarouselItem, variant, sortedCalendarNotes, focusedNoteId, focusedDate],
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
    if (variant === 'carousel') {
      if (activeCarouselItem?.kind === 'payment') {
        setFocusedNoteId(null);
        setFocusedKey(occurrenceKey(activeCarouselItem.occurrence));
      } else if (activeCarouselItem?.kind === 'note') {
        setFocusedNoteId(activeCarouselItem.note.id);
        setFocusedKey(activeCarouselItem.key);
      } else {
        setFocusedNoteId(null);
        setFocusedKey(null);
      }
      return;
    }
    if (!occurrences.some(item => occurrenceKey(item) === focusedKey)) {
      const next = getDefaultFocusOccurrence(occurrences, startDate);
      setFocusedKey(next ? occurrenceKey(next) : null);
    }
  }, [activeCarouselIndex, activeCarouselItem, occurrences, startDate, variant, focusedKey]);

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

  useEffect(() => {
    if (carouselIndex >= carouselItems.length && carouselItems.length > 0) {
      setCarouselIndex(carouselItems.length - 1);
    }
  }, [carouselIndex, carouselItems.length]);

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
      await api.post('/plan-grid/calendar', { payments: nextPayments });
    } catch {
      if (payments !== undefined) setLocalPayments(previousPayments);
      else setLoadedPayments(previousPayments);
      setError('Не удалось отметить задачу. Попробуйте ещё раз.');
    }
  };

  const moveCarousel = (direction: -1 | 1) => {
    setCarouselIndex(index => {
      if (carouselItems.length < 2) return index;
      const nextIndex = Math.max(0, Math.min(index + direction, carouselItems.length - 1));
      if (direction === 1 && nextIndex >= carouselItems.length - 2) {
        setCarouselLimit(current => current + limit);
      }
      return nextIndex;
    });
  };

  const resetCarousel = () => {
    setCarouselIndex(0);
    setCarouselLimit(limit);
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
            await api.post('/plan-grid/calendar', { payments: nextPayments });
          } catch (error) {
            if (payments !== undefined) setLocalPayments(previousPayments);
            else setLoadedPayments(previousPayments);
            throw error;
          }
        }
      } else if (cleanupConfirmation.type === 'note') {
        if (!onDeleteNote) throw new Error('Calendar note deletion is unavailable');
        await onDeleteNote(cleanupConfirmation.note);
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

  const handleCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartX.current = event.clientX;
    suppressCarouselClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleCarouselPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    const offset = event.clientX - pointerStartX.current;
    setDragOffset(offset);
  };

  const handleCarouselPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    const offset = event.clientX - pointerStartX.current;
    if (Math.abs(offset) >= 50) {
      moveCarousel(offset < 0 ? 1 : -1);
      suppressCarouselClick.current = true;
    }
    pointerStartX.current = null;
    setDragOffset(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCarouselCheckbox = (item: PlannedPaymentOccurrence) => {
    if (item.transactionId) return;
    if (onRequestTransaction) {
      onRequestTransaction(item, () => toggleLocally(item));
      return;
    }
    void toggleLocally(item);
  };

  const quietOverdueOccurrence = (item: PlannedPaymentOccurrence) => {
    if (!isPaymentOccurrenceOverdue(item.date)) return;
    const key = occurrenceKey(item);
    setQuietOverdue(current => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  return (
    <section className={`h-full w-full ${variant === 'carousel' ? 'max-w-md' : ''} rounded-2xl border border-theme-base bg-theme-surface p-4 ${className || ''}`} data-testid="upcoming-tasks">
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
              aria-label="Посмотреть текущий план"
              title="Посмотреть план, записку и действия"
              data-testid="button-upcoming-view"
              disabled={!focusedOccurrence}
              onClick={() => focusedOccurrence && setViewItem(focusedOccurrence)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none"
            >
              <Eye size={15} />
            </button>
          )}
          {variant === 'carousel' && (
            <button
              type="button"
              aria-label="Показать первую операцию"
              title="Показать первую операцию"
              data-testid="button-upcoming-first"
              onClick={resetCarousel}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:bg-theme-main"
            >
              <RefreshCw size={15} />
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
                    ? 'Скрыть прошлые отметки, план продолжится с сегодня'
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
      ) : occurrences.length === 0 && (variant === 'carousel' || sortedCalendarNotes.length === 0) ? (
        <div className="py-10 text-center text-xs text-theme-muted">
          <CircleDashed size={20} className="mx-auto mb-2" />
          Предстоящих задач нет
        </div>
      ) : variant === 'carousel' ? (
        <div
          className="relative min-h-[142px] max-md:min-h-[116px] pt-3 touch-pan-y select-none"
          data-testid="upcoming-tasks-carousel"
          onPointerDown={handleCarouselPointerDown}
          onPointerMove={handleCarouselPointerMove}
          onPointerUp={handleCarouselPointerUp}
          onPointerCancel={handleCarouselPointerUp}
        >
          {[0, 1, 2].map(stackIndex => {
            if (occurrences.length <= stackIndex) return null;
            const occurrence = occurrences[activeCarouselIndex + stackIndex];
            if (!occurrence) return null;
            const isActive = stackIndex === 0;
             const key = occurrenceKey(occurrence);
             const isPulsing = isActive && isPaymentOccurrenceOverdue(occurrence.date) && !quietOverdue.has(key);
            const stackStyle = isActive
              ? { transform: `translateX(${dragOffset}px)`, zIndex: 30 }
              : { transform: `translateY(${stackIndex * 8}px) scale(${1 - stackIndex * 0.04})`, zIndex: 30 - stackIndex };
            return (
              <article
                key={`${occurrence.payment.id}-${occurrence.date}-${stackIndex}`}
                className={`absolute inset-x-0 top-3 overflow-hidden rounded-2xl border p-4 transition-transform ${isActive ? carouselTone(occurrence, isPulsing) : 'border-theme-base bg-theme-main text-theme-muted'}`}
                style={stackStyle}
                data-testid={isActive ? `upcoming-banner-${occurrence.payment.id}-${occurrence.date}` : undefined}
                aria-hidden={!isActive}
                onClick={() => {
                  if (suppressCarouselClick.current) {
                    suppressCarouselClick.current = false;
                    return;
                  }
                  if (isActive) quietOverdueOccurrence(occurrence);
                  if (isActive) setFocusedKey(key);
                }}
              >
                <div className="flex items-start gap-3">
                  {isActive && (
                    <button
                      type="button"
                      aria-label={occurrence.transactionId ? `Операция уже создана: ${occurrence.payment.title}` : `Отметить задачу: ${occurrence.payment.title}`}
                      title={occurrence.transactionId ? 'Операция уже создана' : 'Создать операцию'}
                      disabled={Boolean(occurrence.transactionId)}
                      onPointerDown={event => event.stopPropagation()}
                      onPointerUp={event => event.stopPropagation()}
                      onClick={event => {
                        event.stopPropagation();
                        quietOverdueOccurrence(occurrence);
                        handleCarouselCheckbox(occurrence);
                      }}
                      data-testid={`button-toggle-payment-${occurrence.payment.id}-${occurrence.date}`}
                      className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 disabled:cursor-not-allowed ${occurrence.transactionId ? 'border-neutral-300 bg-neutral-100 text-neutral-400' : 'border-current/30 bg-white/70'}`}
                    >
                      {occurrence.transactionId && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                    </button>
                  )}
                  <div
                    tabIndex={isActive ? 0 : -1}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-[10px] uppercase tracking-wider font-bold opacity-70">
                      {carouselDateLabel(occurrence.date)}
                      {occurrence.payment.time && <> · <time>{occurrence.payment.time}</time></>}
                    </span>
                    <strong className="mt-1 flex items-center gap-1 text-sm sm:text-base leading-tight break-words">
                      <span>{formatMoney(occurrence.payment.amount)}</span>{' '}
                      <span aria-hidden="true">·</span>{' '}
                      <span className="min-w-0">{occurrence.payment.title}</span>
                      {occurrence.payment.note?.trim() && (
                        <StickyNote size={13} className="shrink-0 text-amber-700" aria-label="У плана есть записка" />
                      )}
                    </strong>
                    <span className="mt-1 block text-xs opacity-75 leading-snug break-words">
                      {occurrence.payment.categoryName || 'Без категории'} · {recurrenceLabel(occurrence.payment)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
          <div ref={listRef} className="max-h-[min(65vh,620px)] overflow-y-auto no-scrollbar overscroll-contain touch-pan-y space-y-2 pt-3 pr-1" onScroll={handleListScroll} data-testid="upcoming-tasks-list">
          {sortedCalendarNotes.length > 0 && (
            <section className="space-y-2" aria-label="Записки календаря" data-testid="calendar-notes-list">
              {sortedCalendarNotes.map(note => (
                <button
                  key={note.id}
                  type="button"
                  data-testid={`calendar-note-row-${note.id}`}
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
              ))}
            </section>
          )}
          {hasPrevious && (
            <button type="button" data-testid="button-upcoming-load-previous" onClick={loadPrevious} className="w-full rounded-xl border border-dashed border-theme-base px-3 py-2 text-xs text-theme-muted hover:bg-theme-main">
              Показать более ранние
            </button>
          )}
          {occurrences.map(item => {
            const key = `${item.payment.id}-${item.date}`;
            const canToggle = Boolean(onToggleTask);
              const isFocused = item.date === focusedOccurrence?.date;
            return (
              <article
                key={key}
                  className={`flex items-center gap-2 rounded-xl px-2 py-2 border ${isFocused ? 'border-dashed border-theme-primary' : 'border-transparent'} ${occurrenceTone(item)}`}
                data-testid={`payment-row-${key}`}
                data-upcoming-task={key}
              >
                {canToggle && (
                  <button
                    type="button"
                    aria-label={item.transactionId ? `Операция уже создана: ${item.payment.title}` : `Отметить задачу: ${item.payment.title}`}
                    title={item.transactionId ? 'Операция уже создана' : 'Создать операцию'}
                    disabled={Boolean(item.transactionId)}
                    onClick={() => void toggleLocally(item)}
                    data-testid={`button-toggle-payment-${key}`}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 disabled:cursor-not-allowed ${item.transactionId ? 'border-neutral-300 bg-neutral-100 text-neutral-400' : 'border-neutral-300 bg-white/70'}`}
                  >
                    {item.transactionId && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                  </button>
                )}
                <button
                  type="button"
                    onClick={() => { setFocusedNoteId(null); setFocusedKey(key); onTaskClick?.(item.date); }}
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

type PlanCleanupConfirmation =
  | { type: 'single'; item: PlannedPaymentOccurrence }
  | { type: 'note'; note: CalendarNote }
  | { type: 'bulk'; paymentIds: string[]; noteIds: string[] };

function PlanViewDialog({
  item,
  onClose,
  onEdit,
  onDelete,
}: {
  item: PlannedPaymentOccurrence;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const payment = item.payment;
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
            {payment.transactionType === 'income' ? 'Доход' : 'Расход'}
            {payment.time ? ` · ${payment.time}` : ''}
            {` · ${recurrenceLabel(payment)}`}
          </p>
          <p className="text-xs text-theme-muted">
            {payment.categoryName || 'Без категории'}
            {payment.accountName ? ` · ${payment.accountName}` : ''}
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
        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-theme-main px-3 py-2 text-xs font-bold text-theme-muted">
            Закрыть
          </button>
          {onEdit && (
            <button type="button" data-testid="button-plan-view-edit" onClick={onEdit} className="inline-flex items-center gap-1 rounded-xl bg-theme-primary px-3 py-2 text-xs font-bold text-white">
              <Pencil size={13} />
              Редактировать
            </button>
          )}
          {onDelete && (
            <button type="button" data-testid="button-plan-view-delete" onClick={onDelete} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">
              <Trash2 size={13} />
              Удалить
            </button>
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
                <p className="mt-1">С продолжением с сегодняшней даты останется планов: <strong>{bulkResets.length}</strong>.</p>
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
                        : 'продолжится с сегодня'}
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
          {payment.transactionType === 'income' ? 'Доход' : 'Расход'} · {recurrenceLabel(payment)} · {payment.categoryName || 'Без категории'}
        </p>
        {payment.accountName && <p className="mt-1 text-xs text-theme-muted">Счёт: {payment.accountName}</p>}
        <p className={`mt-2 text-xs font-bold ${completed ? 'text-emerald-700' : 'text-rose-700'}`}>
          Выбранное вхождение: {completed ? 'выполнено' : 'НЕ выполнено'}
        </p>
      </div>
      {mode === 'reset-history' ? (
        <p className="text-xs leading-relaxed text-theme-muted">
          План продолжится. Дата начала станет {formatLongDate(today)}, а вхождения до этой даты, включая выбранное,
          перестанут отображаться в календаре. Связанные операции в истории не удаляются.
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

function occurrenceTone(item: PlannedPaymentOccurrence) {
  if (item.status === 'paid') return 'bg-neutral-100 text-neutral-400 opacity-80';
  if (isPaymentOccurrenceOverdue(item.date)) return 'bg-red-100 text-red-800';
  return item.payment.transactionType === 'income'
    ? 'bg-lime-50 text-lime-700'
    : 'bg-pink-50 text-pink-700';
}

function carouselTone(item: PlannedPaymentOccurrence, isPulsing = false) {
  if (isPaymentOccurrenceOverdue(item.date)) {
    return `border-red-300 bg-red-100 text-red-900${isPulsing ? ' animate-overdue-pulse' : ''}`;
  }
  return item.payment.transactionType === 'income'
    ? 'border-lime-200 bg-lime-50 text-lime-900'
    : 'border-pink-200 bg-pink-50 text-pink-800';
}

function occurrenceKey(item: PlannedPaymentOccurrence) {
  return `${item.payment.id}-${item.date}`;
}

function getDefaultFocusOccurrence(
  occurrences: PlannedPaymentOccurrence[],
  anchorDate: string,
) {
  const incomplete = occurrences.filter(item => !isCompletedOccurrence(item));
  const firstOverdue = incomplete.find(item => isPaymentOccurrenceOverdue(item.date));
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

function carouselDateLabel(date: string) {
  if (isPaymentOccurrenceOverdue(date)) return `Просрочено · ${formatTaskDate(date)}`;
  return formatTaskDate(date);
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