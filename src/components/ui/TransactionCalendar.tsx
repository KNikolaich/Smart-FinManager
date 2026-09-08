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

interface TransactionCalendarProps {
  initialDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function TransactionCalendar({
  initialDate,
  onSelect,
  onClose,
}: TransactionCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(initialDate));
  const today = new Date();

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
        className="w-full max-w-[360px] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-3xl bg-theme-surface border border-theme-base shadow-2xl p-4"
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
            return (
              <button
                key={day.toISOString()}
                onClick={() => onSelect(day)}
                aria-label={format(day, 'd MMMM yyyy', { locale: ru })}
                className={cn(
                  'aspect-square min-h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all',
                  !isSameMonth(day, visibleMonth) && 'text-theme-muted/35',
                  isSameMonth(day, visibleMonth) && 'text-theme-main hover:bg-theme-primary/10',
                  currentDay && 'ring-1 ring-theme-primary text-theme-primary',
                  selected && 'bg-theme-primary text-theme-on-primary hover:bg-theme-primary'
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}