import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, CircleDashed, Copy, Hand, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PlannedPayment, PlannedPaymentRecurrence } from '../types';
import {
  getTodayKey,
  getOutstandingPaymentOccurrences,
  getPaymentOccurrencesForFilter,
  isPaymentOccurrenceOverdue,
  PlannedPaymentFilter,
  PlannedPaymentOccurrence,
} from '../lib/plannedPaymentOccurrences';

interface UpcomingTasksProps {
  payments?: PlannedPayment[];
  startDate?: string;
  filter?: PlannedPaymentFilter;
  focusedDate?: string;
  limit?: number;
  variant?: 'list' | 'carousel';
  onTaskClick?: (date: string) => void;
  onOpenCalendar?: () => void;
  onAdd?: () => void;
  onToggleTask?: (item: PlannedPaymentOccurrence) => void;
  onManualToggleTask?: (item: PlannedPaymentOccurrence) => void | Promise<void>;
  onRequestTransaction?: (
    item: PlannedPaymentOccurrence,
    onCompleted: () => void | Promise<void>,
  ) => void;
  onEditTask?: (item: PlannedPaymentOccurrence) => void;
  onCopyTask?: (item: PlannedPaymentOccurrence) => void;
  onDeleteTask?: (item: PlannedPaymentOccurrence) => void | Promise<void>;
  className?: string;
}

export default function UpcomingTasks({
  payments,
  startDate = getTodayKey(),
  filter = 'all',
  focusedDate,
  limit = 7,
  variant = 'list',
  onTaskClick,
  onOpenCalendar,
  onAdd,
  onToggleTask,
  onManualToggleTask,
  onRequestTransaction,
  onEditTask,
  onCopyTask,
  onDeleteTask,
  className,
}: UpcomingTasksProps) {
  const [loadedPayments, setLoadedPayments] = useState<PlannedPayment[]>([]);
  const [localPayments, setLocalPayments] = useState<PlannedPayment[] | null>(null);
  const [loading, setLoading] = useState(payments === undefined);
  const [error, setError] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselLimit, setCarouselLimit] = useState(limit);
  const [listWindow, setListWindow] = useState({ start: 0, end: 50 });
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
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
    api.get<{ payments?: PlannedPayment[] }>('/plan-grid/calendar')
      .then(data => {
        if (!active) return;
        setLoadedPayments(Array.isArray(data?.payments) ? data.payments : []);
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

  const pageSize = 50;
  const loadedOccurrences = useMemo(
    () => variant === 'carousel'
      ? getOutstandingPaymentOccurrences(sourcePayments, startDate, carouselLimit)
      : getPaymentOccurrencesForFilter(sourcePayments, startDate, filter, Number.MAX_SAFE_INTEGER),
    [sourcePayments, startDate, filter, carouselLimit, variant],
  );
  const hasPrevious = variant === 'list' && listWindow.start > 0;
  const hasMore = variant === 'list' && listWindow.end < loadedOccurrences.length;
  const occurrences = variant === 'list'
    ? loadedOccurrences.slice(listWindow.start, listWindow.end)
    : loadedOccurrences;
  const activeCarouselIndex = occurrences.length === 0 ? 0 : Math.min(carouselIndex, occurrences.length - 1);
  const focusedOccurrence = useMemo(
    () => occurrences.find(item => occurrenceKey(item) === focusedKey)
      || (focusedDate && focusedDate !== getTodayKey()
        ? occurrences.find(item => item.date === focusedDate)
        : undefined)
      || getDefaultFocusOccurrence(occurrences, startDate)
      || occurrences[0],
    [occurrences, focusedDate, focusedKey, startDate],
  );
  const focusedIsCompleted = Boolean(
    focusedOccurrence
    && (focusedOccurrence.status === 'paid'
      || focusedOccurrence.manuallyCompleted
      || focusedOccurrence.transactionId),
  );
  const isDeleteConfirmationOpen = Boolean(
    focusedOccurrence && deleteConfirmKey === occurrenceKey(focusedOccurrence),
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
      const active = occurrences[activeCarouselIndex];
      if (active) setFocusedKey(occurrenceKey(active));
      return;
    }
    if (!occurrences.some(item => occurrenceKey(item) === focusedKey)) {
      const next = getDefaultFocusOccurrence(occurrences, startDate);
      setFocusedKey(next ? occurrenceKey(next) : null);
    }
  }, [activeCarouselIndex, occurrences, startDate, variant, focusedKey]);

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

  useEffect(() => {
    setDeleteConfirmKey(null);
  }, [focusedKey]);

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
    if (carouselIndex >= occurrences.length && occurrences.length > 0) {
      setCarouselIndex(occurrences.length - 1);
    }
  }, [carouselIndex, occurrences.length]);

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
      if (occurrences.length < 2) return index;
      const nextIndex = Math.max(0, Math.min(index + direction, occurrences.length - 1));
      if (direction === 1 && nextIndex >= occurrences.length - 2) {
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

  const requestDelete = () => {
    if (focusedOccurrence) setDeleteConfirmKey(occurrenceKey(focusedOccurrence));
  };

  const confirmDelete = async () => {
    if (!focusedOccurrence || !onDeleteTask) return;
    await onDeleteTask(focusedOccurrence);
    setDeleteConfirmKey(null);
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
        <div className="flex items-center gap-1">
          {variant === 'carousel' && onEditTask && (
            <button
              type="button"
              aria-label="Редактировать текущий план"
              title={focusedIsCompleted ? 'Выполненный план нельзя редактировать' : 'Редактировать текущий план'}
              data-testid="button-upcoming-edit"
              disabled={!focusedOccurrence || focusedIsCompleted}
              onClick={() => focusedOccurrence && !focusedIsCompleted && onEditTask(focusedOccurrence)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none"
            >
              <Pencil size={15} />
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
            <button type="button" aria-label="Запланировать задачу" onClick={onAdd} className="p-2 rounded-lg bg-theme-primary-light text-theme-primary">
              <Plus size={16} />
            </button>
          )}
          {variant !== 'carousel' && onEditTask && (
            <button type="button" aria-label="Редактировать сфокусированную задачу" title={focusedIsCompleted ? 'Выполненный план нельзя редактировать' : 'Редактировать'} data-testid="button-upcoming-edit" disabled={!focusedOccurrence || focusedIsCompleted} onClick={() => focusedOccurrence && !focusedIsCompleted && onEditTask(focusedOccurrence)} className="p-2 rounded-lg text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none">
              <Pencil size={15} />
            </button>
          )}
          {onCopyTask && (
            <button type="button" aria-label="Скопировать сфокусированный план" title="Скопировать план" data-testid="button-upcoming-copy" disabled={!focusedOccurrence} onClick={() => focusedOccurrence && onCopyTask(focusedOccurrence)} className="p-2 rounded-lg text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none">
              <Copy size={15} />
            </button>
          )}
          {onManualToggleTask && (
            <button type="button" aria-label={focusedOccurrence?.manuallyCompleted ? 'Снять ручную отметку' : 'Отметить вручную'} title={focusedIsCompleted ? 'Выполненный план нельзя менять вручную' : focusedOccurrence?.manuallyCompleted ? 'Снять ручную отметку' : 'Отметить вручную'} data-testid="button-upcoming-manual-toggle" disabled={!focusedOccurrence || focusedIsCompleted} onClick={() => focusedOccurrence && !focusedIsCompleted && void onManualToggleTask(focusedOccurrence)} className="p-2 rounded-lg text-theme-muted hover:bg-theme-main disabled:opacity-30 disabled:pointer-events-none">
              <Hand size={15} />
            </button>
          )}
          {onDeleteTask && (
            isDeleteConfirmationOpen ? (
              <div className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-1 py-1 text-[10px] text-rose-700">
                <span className="px-1">Отключить с этой даты?</span>
                <button type="button" data-testid="button-upcoming-delete-confirm" onClick={() => void confirmDelete()} className="rounded-md bg-rose-600 px-2 py-1 font-bold text-white hover:bg-rose-700">Да</button>
                <button type="button" data-testid="button-upcoming-delete-cancel" onClick={() => setDeleteConfirmKey(null)} className="rounded-md px-2 py-1 font-bold hover:bg-rose-100">Нет</button>
              </div>
            ) : (
              <button type="button" aria-label="Отключить план с даты сфокусированной задачи" title="Отключить план с этой даты" data-testid="button-upcoming-delete" disabled={!focusedOccurrence} onClick={requestDelete} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none">
                <Trash2 size={15} />
              </button>
            )
          )}
        </div>
      </header>

      {loading ? (
        <div className="py-10 text-center text-xs text-theme-muted">Загружаем задачи...</div>
      ) : error ? (
        <div className="py-10 text-center text-xs text-rose-600">{error}</div>
      ) : occurrences.length === 0 ? (
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
                    <strong className="mt-1 block text-sm sm:text-base leading-tight break-words">
                      <span>{formatMoney(occurrence.payment.amount)}</span>{' '}
                      <span aria-hidden="true">·</span>{' '}
                      <span>{occurrence.payment.title}</span>
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
                    onClick={() => { setFocusedKey(key); onTaskClick?.(item.date); }}
                  className="min-w-0 flex-1 text-left"
                  data-testid={`upcoming-task-link-${key}`}
                >
                    <strong className="block text-xs leading-tight break-words">
                    <span>{formatMoney(item.payment.amount)}</span>{' '}
                    <span aria-hidden="true">·</span>{' '}
                    <span>{item.payment.title}</span>
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
    </section>
  );
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

function isCompletedOccurrence(item: PlannedPaymentOccurrence) {
  return Boolean(
    item.status === 'paid'
      || item.manuallyCompleted
      || item.transactionId,
  );
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