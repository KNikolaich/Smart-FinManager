import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Category, Transaction } from '../../types';

interface TransactionCalendarProps {
  initialDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  transactions?: Transaction[];
  categories?: Category[];
  transactionsLoading?: boolean;
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function TransactionCalendar({
  initialDate,
  onSelect,
  onClose,
  transactions = [],
  categories = [],
  transactionsLoading = false,
}: TransactionCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(initialDate));
  const today = new Date();

  const categoryById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  );

  const iconsByDate = useMemo(() => {
    const result = new Map<string, Category[]>();

    transactions.forEach(transaction => {
      const category = (
        (transaction.subcategoryId && categoryById.get(transaction.subcategoryId)) ||
        (transaction.categoryId && categoryById.get(transaction.categoryId))
      );
      if (!category) return;

      const dateKey = format(new Date(transaction.createdAt), 'yyyy-MM-dd');
      const categoriesForDate = result.get(dateKey) || [];
      if (!categoriesForDate.some(existing => existing.id === category.id)) {
        categoriesForDate.push(category);
        result.set(dateKey, categoriesForDate);
      }
    });

    return result;
  }, [categoryById, transactions]);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }),
  }), [visibleMonth]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Переход к дате операций"
        className="w-full max-w-[min(760px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-3xl bg-theme-surface border border-theme-base shadow-2xl p-4 sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-theme-primary/10 text-theme-primary flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-bold text-theme-muted">Перейти к дате</p>
              <p className="font-black text-theme-main capitalize truncate">
                {format(visibleMonth, 'LLLL yyyy', { locale: ru })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть календарь"
            className="w-9 h-9 rounded-xl bg-theme-main text-theme-muted flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}
            aria-label="Предыдущий месяц"
            className="w-10 h-10 rounded-xl border border-theme-base text-theme-main flex items-center justify-center hover:bg-theme-main"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setVisibleMonth(startOfMonth(today))}
            className="px-4 h-10 rounded-xl text-xs font-bold text-theme-primary bg-theme-primary/10"
          >
            Сегодня
          </button>
          <button
            onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
            aria-label="Следующий месяц"
            className="w-10 h-10 rounded-xl border border-theme-base text-theme-main flex items-center justify-center hover:bg-theme-main"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map(day => (
            <span key={day} className="h-7 flex items-center justify-center text-[10px] font-bold text-theme-muted">
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const selected = isSameDay(day, initialDate);
            const currentDay = isSameDay(day, today);
            const dayCategories = iconsByDate.get(format(day, 'yyyy-MM-dd')) || [];
            const isFutureDay = day > today && !isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                onClick={() => onSelect(day)}
                aria-label={format(day, 'd MMMM yyyy', { locale: ru })}
                className={cn(
                  'min-h-[76px] rounded-xl text-xs font-bold flex flex-col items-center justify-start gap-1 py-2 transition-all',
                  !isSameMonth(day, visibleMonth) && 'text-theme-muted/35',
                  isSameMonth(day, visibleMonth) && 'text-theme-main hover:bg-theme-primary/10',
                  currentDay && 'ring-1 ring-theme-primary text-theme-primary',
                  selected && 'bg-theme-primary text-theme-on-primary hover:bg-theme-primary'
                )}
              >
                <span>{format(day, 'd')}</span>
                <span className="flex min-h-5 max-w-full items-center justify-center gap-0.5 overflow-hidden">
                  {dayCategories.slice(0, 4).map(category => (
                    <span
                      key={category.id}
                      title={category.name}
                      aria-label={category.name}
                      className={cn(
                        'text-sm leading-none transition-opacity',
                        isFutureDay && 'opacity-40 grayscale',
                        !isSameMonth(day, visibleMonth) && 'opacity-25',
                      )}
                      style={{ color: category.color }}
                    >
                      {category.icon}
                    </span>
                  ))}
                  {dayCategories.length > 4 && (
                    <span className="text-[9px] font-bold text-theme-muted">
                      +{dayCategories.length - 4}
                    </span>
                  )}
                </span>
                {transactionsLoading && isSameMonth(day, visibleMonth) && (
                  <span className="h-1 w-1 rounded-full bg-theme-muted/40 animate-pulse" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}