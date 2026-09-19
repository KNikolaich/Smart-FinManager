import { useEffect, useMemo, useState } from 'react';
import { CircleDashed, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { PlannedPayment, PlannedPaymentRecurrence } from '../types';
import {
  getTodayKey,
  getUpcomingPaymentOccurrences,
  PlannedPaymentOccurrence,
} from '../lib/plannedPaymentOccurrences';

interface UpcomingTasksProps {
  payments?: PlannedPayment[];
  startDate?: string;
  limit?: number;
  onTaskClick?: (date: string) => void;
  onAdd?: () => void;
  onToggleTask?: (item: PlannedPaymentOccurrence) => void;
  onEditTask?: (item: PlannedPaymentOccurrence) => void;
  onDeleteTask?: (item: PlannedPaymentOccurrence) => void | Promise<void>;
}

export default function UpcomingTasks({
  payments,
  startDate = getTodayKey(),
  limit = 7,
  onTaskClick,
  onAdd,
  onToggleTask,
  onEditTask,
  onDeleteTask,
}: UpcomingTasksProps) {
  const [loadedPayments, setLoadedPayments] = useState<PlannedPayment[]>([]);
  const [loading, setLoading] = useState(payments === undefined);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

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

  const sourcePayments = payments ?? loadedPayments;
  const occurrences = useMemo(
    () => getUpcomingPaymentOccurrences(sourcePayments, startDate, limit),
    [sourcePayments, startDate, limit],
  );

  return (
    <section className="rounded-2xl border border-theme-base bg-theme-surface p-4" data-testid="upcoming-tasks">
      <header className="flex items-start justify-between gap-3 border-b border-theme-base pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-theme-muted font-bold">Планы</p>
          <h3 className="text-lg font-bold text-theme-main mt-1">Предстоящие задачи</h3>
        </div>
        {onAdd && (
          <button type="button" aria-label="Запланировать задачу" onClick={onAdd} className="p-2 rounded-lg bg-theme-primary-light text-theme-primary">
            <Plus size={16} />
          </button>
        )}
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
                    onClick={() => onToggleTask?.(item)}
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
                {(onEditTask || onDeleteTask) && (
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
  return item.payment.transactionType === 'income'
    ? 'bg-lime-50 text-lime-700'
    : 'bg-rose-50 text-rose-700';
}

function formatTaskDate(date: string, startDate: string) {
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