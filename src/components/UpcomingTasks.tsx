import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpToLine, CalendarDays, CircleDashed, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PlannedPayment, PlannedPaymentRecurrence } from '../types';
import {
  getTodayKey,
  getOutstandingPaymentOccurrences,
  getUpcomingPaymentOccurrences,
  PlannedPaymentOccurrence,
} from '../lib/plannedPaymentOccurrences';

interface UpcomingTasksProps {
  payments?: PlannedPayment[];
  startDate?: string;
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
  onDeleteTask?: (item: PlannedPaymentOccurrence) => void | Promise<void>;
}

export default function UpcomingTasks({
  payments,
  startDate = getTodayKey(),
  limit = 7,
  variant = 'list',
  onTaskClick,
  onOpenCalendar,
  onAdd,
  onToggleTask,
  onManualToggleTask,
  onRequestTransaction,
  onEditTask,
  onDeleteTask,
}: UpcomingTasksProps) {
  const [loadedPayments, setLoadedPayments] = useState<PlannedPayment[]>([]);
  const [localPayments, setLocalPayments] = useState<PlannedPayment[] | null>(null);
  const [loading, setLoading] = useState(payments === undefined);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselLimit, setCarouselLimit] = useState(limit);
  const [dragOffset, setDragOffset] = useState(0);
  const pointerStartX = useRef<number | null>(null);

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
  const occurrences = useMemo(
    () => variant === 'carousel'
      ? getOutstandingPaymentOccurrences(sourcePayments, startDate, carouselLimit)
      : getUpcomingPaymentOccurrences(sourcePayments, startDate, limit),
    [sourcePayments, startDate, limit, carouselLimit, variant],
  );
  const activeCarouselIndex = occurrences.length === 0 ? 0 : Math.min(carouselIndex, occurrences.length - 1);
  useEffect(() => {
    if (carouselIndex >= occurrences.length && occurrences.length > 0) {
      setCarouselIndex(occurrences.length - 1);
    }
  }, [carouselIndex, occurrences.length]);

  const toggleLocally = async (item: PlannedPaymentOccurrence) => {
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

  const goToStart = (event: React.MouseEvent<HTMLButtonElement>) => {
    const scrollContainer = event.currentTarget.closest('.overflow-y-auto');
    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const resetCarousel = () => {
    setCarouselIndex(0);
    setCarouselLimit(limit);
  };

  const handleCarouselPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartX.current = event.clientX;
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
    }
    pointerStartX.current = null;
    setDragOffset(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleCarouselCheckbox = (item: PlannedPaymentOccurrence) => {
    if (onRequestTransaction) {
      onRequestTransaction(item, () => toggleLocally(item));
      return;
    }
    void toggleLocally(item);
  };

  return (
    <section className="rounded-2xl border border-theme-base bg-theme-surface p-4" data-testid="upcoming-tasks">
      <header className="flex items-center justify-between gap-2 border-b border-theme-base pb-2">
        <div className="min-w-0">
          <p className="text-[15px] uppercase tracking-wider text-theme-muted font-bold truncate">Предстоящие планы</p>
        </div>
        <div className="flex items-center gap-1">
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
          {variant === 'carousel' && (
            <button
              type="button"
              aria-label="В начало"
              title="В начало"
              data-testid="button-upcoming-start"
              onClick={goToStart}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:bg-theme-main"
            >
              <ArrowUpToLine size={16} />
            </button>
          )}
          {onOpenCalendar && (
            <button
              type="button"
              aria-label="Открыть календарь"
              title="Открыть календарь"
              data-testid="button-upcoming-calendar"
              onClick={onOpenCalendar}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-muted hover:bg-theme-main"
            >
              <CalendarDays size={16} />
            </button>
          )}
          {onAdd && (
            <button type="button" aria-label="Запланировать задачу" onClick={onAdd} className="p-2 rounded-lg bg-theme-primary-light text-theme-primary">
              <Plus size={16} />
            </button>
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
          className="relative min-h-[142px] pt-3 touch-pan-y select-none"
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
            const stackStyle = isActive
              ? { transform: `translateX(${dragOffset}px)`, zIndex: 30 }
              : { transform: `translateY(${stackIndex * 8}px) scale(${1 - stackIndex * 0.04})`, zIndex: 30 - stackIndex };
            return (
              <article
                key={`${occurrence.payment.id}-${occurrence.date}-${stackIndex}`}
                className={`absolute inset-x-0 top-3 overflow-hidden rounded-2xl border p-4 transition-transform ${isActive ? carouselTone(occurrence) : 'border-theme-base bg-theme-main text-theme-muted'}`}
                style={stackStyle}
                data-testid={isActive ? `upcoming-banner-${occurrence.payment.id}-${occurrence.date}` : undefined}
                aria-hidden={!isActive}
              >
                <div className="flex items-start gap-3">
                  {isActive && (
                    <button
                      type="button"
                      aria-label={`Отметить задачу: ${occurrence.payment.title}`}
                      onPointerDown={event => event.stopPropagation()}
                      onPointerUp={event => event.stopPropagation()}
                      onClick={event => {
                        event.stopPropagation();
                        handleCarouselCheckbox(occurrence);
                      }}
                      data-testid={`button-toggle-payment-${occurrence.payment.id}-${occurrence.date}`}
                      className="mt-0.5 w-6 h-6 rounded-lg border border-current/30 bg-white/70 flex items-center justify-center shrink-0"
                    />
                  )}
                  <div
                    tabIndex={isActive ? 0 : -1}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-[10px] uppercase tracking-wider font-bold opacity-70">
                      {carouselDateLabel(occurrence.date, startDate)}
                    </span>
                    <strong className="mt-1 block text-base truncate">{occurrence.payment.title}</strong>
                    <span className="mt-1 block text-xs opacity-75 truncate">
                      {occurrence.payment.transactionType === 'income' ? 'Доход' : 'Расход'} · {occurrence.payment.categoryName || 'Без категории'} · {recurrenceLabel(occurrence.payment.recurrence)} · {formatMoney(occurrence.payment.amount)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2 pt-3">
          {occurrences.map(item => {
            const key = `${item.payment.id}-${item.date}`;
            const canToggle = Boolean(onToggleTask);
            return (
              <article
                key={key}
                className={`flex items-center gap-2 rounded-xl px-2 py-2 ${occurrenceTone(item)}`}
                data-testid={`payment-row-${key}`}
                data-upcoming-task={key}
              >
                {canToggle && (
                  <button
                    type="button"
                    aria-label={`Отметить задачу: ${item.payment.title}`}
                    onClick={() => void toggleLocally(item)}
                    data-testid={`button-toggle-payment-${key}`}
                    className="w-5 h-5 rounded-md border border-neutral-300 bg-white/70 flex items-center justify-center shrink-0"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onTaskClick?.(item.date)}
                  className="min-w-0 flex-1 text-left"
                  data-testid={`upcoming-task-link-${key}`}
                >
                  <strong className="block text-xs truncate">{item.payment.title}</strong>
                  <span className="block text-[10px] opacity-75 truncate">
                    {formatTaskDate(item.date, startDate)} · {item.payment.transactionType === 'income' ? 'Доход' : 'Расход'} · {item.payment.categoryName || 'Без категории'} · {recurrenceLabel(item.payment.recurrence)} · {formatMoney(item.payment.amount)}
                  </span>
                </button>
                {(onEditTask || onDeleteTask || onManualToggleTask) && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-label={`Действия: ${item.payment.title}`}
                      onClick={() => setMenuFor(menuFor === key ? null : key)}
                      data-testid={`button-payment-menu-${key}`}
                      className="p-1.5 rounded-lg opacity-60 hover:bg-black/5"
                    >
                      •••
                    </button>
                    {menuFor === key && (
                      <div className="absolute right-0 top-8 z-10 w-28 p-1 rounded-lg border border-theme-base bg-theme-surface shadow-lg">
                        {onEditTask && (
                          <button type="button" onClick={() => { setMenuFor(null); onEditTask(item); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-theme-main">
                            <Pencil size={12} className="inline mr-1" />Изменить
                          </button>
                        )}
                        {onManualToggleTask && !item.transactionId && (
                          <button type="button" onClick={() => { setMenuFor(null); void onManualToggleTask(item); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-theme-main">
                            {item.manuallyCompleted ? 'Снять ручную отметку' : 'Отметить вручную'}
                          </button>
                        )}
                        {onDeleteTask && (
                          <button type="button" onClick={() => { setMenuFor(null); void onDeleteTask(item); }} className="w-full text-left px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50">
                            <Trash2 size={12} className="inline mr-1" />Удалить
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function occurrenceTone(item: PlannedPaymentOccurrence) {
  if (item.date < getTodayKey()) return 'bg-rose-50 text-rose-700';
  return item.payment.transactionType === 'income'
    ? 'bg-lime-50 text-lime-700'
    : 'bg-orange-50 text-orange-700';
}

function carouselTone(item: PlannedPaymentOccurrence) {
  if (item.date < getTodayKey()) return 'border-rose-200 bg-rose-50 text-rose-900';
  if (item.date === getTodayKey()) return 'border-theme-primary/30 bg-theme-primary-light text-theme-main';
  return item.payment.transactionType === 'income'
    ? 'border-lime-200 bg-lime-50 text-lime-900'
    : 'border-orange-200 bg-orange-50 text-orange-900';
}

function formatTaskDate(date: string, startDate: string) {
  if (date === getTodayKey()) return 'Сегодня';
  if (date === startDate) return 'Выбранный день';
  const taskDate = new Date(`${date}T12:00:00`);
  const today = new Date(`${getTodayKey()}T12:00:00`);
  const difference = Math.round((taskDate.getTime() - today.getTime()) / 86400000);
  if (difference === 0) return 'Сегодня';
  if (difference === 1) return 'Завтра';
  return taskDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)} ₽`;
}

function carouselDateLabel(date: string, anchorDate: string) {
  if (date < anchorDate) return `Просрочено · ${formatTaskDate(date, anchorDate)}`;
  return formatTaskDate(date, anchorDate);
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

function recurrenceLabel(value: PlannedPaymentRecurrence) {
  const labels: Record<PlannedPaymentRecurrence, string> = {
    none: 'Однократно',
    weekly: 'Еженедельно',
    biweekly: 'Раз в 2 недели',
    monthly: 'Ежемесячно',
    quarterly: 'Ежеквартально',
    yearly: 'Ежегодно',
  };
  return labels[value];
}