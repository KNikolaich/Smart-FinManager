import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  PlannedPayment,
  PlannedPaymentRecurrence,
  PlannedPaymentStatus,
  Category,
} from '../types';
import CategorySelect from './CategorySelect';
import UpcomingTasks from './UpcomingTasks';
import {
  getPaymentOccurrencesInRange,
  getTodayKey,
  parseDateKey,
  PlannedPaymentOccurrence,
  toDateKey,
} from '../lib/plannedPaymentOccurrences';

interface PaymentCalendarTabProps {
  payments: PlannedPayment[];
  accounts: Array<{ id: string; name: string }>;
  categories?: Category[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onStatusChange?: (id: string, date: string, status: PlannedPaymentStatus) => void;
  onRequestTransaction?: (payment: PlannedPayment, date: string) => void;
  onPaymentChange?: (payment: PlannedPayment) => void | Promise<void>;
  onPaymentDelete?: (id: string) => void | Promise<void>;
  focusDate?: string;
  onFocusDateHandled?: () => void;
}

type Filter = 'all' | 'pending' | 'overdue' | 'paid';
type DialogMode = 'create' | 'edit' | null;

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
const RECURRENCES: Array<{ value: PlannedPaymentRecurrence; label: string }> = [
  { value: 'none', label: 'Однократно' },
  { value: 'weekly', label: 'Еженедельно' },
  { value: 'biweekly', label: 'Раз в 2 недели' },
  { value: 'monthly', label: 'Ежемесячно' },
  { value: 'quarterly', label: 'Ежеквартально' },
  { value: 'yearly', label: 'Ежегодно' },
];

function getMonthCells(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Array<{ key: string; day: number; currentMonth: boolean }> = [];

  for (let index = mondayIndex - 1; index >= 0; index -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), -index);
    cells.push({ key: toDateKey(date), day: date.getDate(), currentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    cells.push({ key: toDateKey(date), day, currentMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() + 1, nextDay);
    cells.push({ key: toDateKey(date), day: nextDay, currentMonth: false });
    nextDay += 1;
  }
  return cells;
}

export default function PaymentCalendarTab({
  payments,
  accounts,
  categories = [],
  loading = false,
  error = null,
  onRetry,
  onStatusChange,
  onRequestTransaction,
  onPaymentChange,
  onPaymentDelete,
  focusDate,
  onFocusDateHandled,
}: PaymentCalendarTabProps) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [filter, setFilter] = useState<Filter>('all');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingPayment, setEditingPayment] = useState<PlannedPayment | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusDate) return;
    const nextDate = parseDateKey(focusDate);
    if (Number.isNaN(nextDate.getTime())) return;
    setCursor(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setSelectedDate(focusDate);
    onFocusDateHandled?.();
  }, [focusDate, onFocusDateHandled]);

  const occurrences = useMemo<PlannedPaymentOccurrence[]>(
    () => {
      const monthStart = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
      const monthEnd = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
      return payments.flatMap(payment => getPaymentOccurrencesInRange(payment, monthStart, monthEnd));
    },
    [payments, cursor],
  );
  const visibleOccurrences = occurrences.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return item.status !== 'paid' && item.date < getTodayKey();
    return item.status === filter;
  });
  const byDate = new Map<string, PlannedPaymentOccurrence[]>();
  visibleOccurrences.forEach(item => byDate.set(item.date, [...(byDate.get(item.date) || []), item]));
  const openCreate = (date = selectedDate) => {
    const account = accounts[0];
    const category = categories.find(item => item.type === 'expense');
    setEditingPayment({
      id: `payment-${Date.now()}`,
      title: '',
      amount: 0,
      date: date || toDateKey(cursor),
      recurrence: 'none',
      transactionType: 'expense',
      categoryId: category?.id,
      categoryName: category?.name,
      accountId: account?.id,
      accountName: account?.name || '',
      status: 'pending',
      paidDates: [],
      color: 'plum',
    });
    setDialogMode('create');
  };

  const savePayment = async () => {
    if (!editingPayment?.title.trim() || editingPayment.amount <= 0 || !editingPayment.date) return;
    try {
      setSaveError(null);
      await onPaymentChange?.({ ...editingPayment, title: editingPayment.title.trim() });
      setCursor(new Date(`${editingPayment.date}T12:00:00`));
      setSelectedDate(editingPayment.date);
      setDialogMode(null);
      setEditingPayment(null);
    } catch (error) {
      console.error('Payment save error:', error);
       setSaveError('Не удалось сохранить запись. Проверьте подключение и попробуйте ещё раз.');
    }
  };

  if (loading) return <CalendarState title="Загружаем календарь..." />;
  if (error) {
    return (
      <CalendarState
        title="Не удалось загрузить календарь"
        description={error}
        action={onRetry}
        actionLabel="Повторить"
        error
      />
    );
  }

  return (
    <section className="w-full min-w-0 p-2.5 sm:p-5 space-y-3 sm:space-y-4 overflow-x-hidden overflow-y-auto no-scrollbar h-full" data-testid="payment-calendar">
      <header className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-theme-primary-light text-theme-primary flex items-center justify-center shrink-0">
            <CalendarDays size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-theme-muted truncate">Календарный план</p>
        </div>
        <button
          type="button"
          aria-label="Запланировать операцию"
          title="Запланировать операцию"
          data-testid="button-add-payment"
          onClick={() => openCreate()}
          className="w-10 h-10 rounded-xl bg-theme-primary text-theme-on-primary flex items-center justify-center hover:bg-theme-primary-dark shrink-0"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="flex min-w-0 w-full flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" aria-label="Предыдущий месяц" data-testid="button-previous-month" onClick={() => moveMonth(-1, cursor, setCursor, setSelectedDate)} className="w-8 h-8 rounded-lg border border-theme-base bg-theme-surface text-theme-muted flex items-center justify-center shrink-0"><ArrowLeft size={15} /></button>
          <strong className="min-w-[88px] text-center text-xs sm:text-sm capitalize text-theme-main truncate">{MONTHS[cursor.getMonth()]} <span className="text-theme-muted font-normal">{cursor.getFullYear()}</span></strong>
          <button type="button" aria-label="Следующий месяц" data-testid="button-next-month" onClick={() => moveMonth(1, cursor, setCursor, setSelectedDate)} className="w-8 h-8 rounded-lg border border-theme-base bg-theme-surface text-theme-muted flex items-center justify-center shrink-0"><ArrowRight size={15} /></button>
        </div>
        <div className="flex-1 min-w-3" aria-hidden="true" />
        <button type="button" aria-label="Сегодня" title="Сегодня" data-testid="button-today" onClick={() => { setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(getTodayKey()); }} className="w-8 h-8 rounded-lg border border-theme-base text-theme-muted flex items-center justify-center shrink-0"><CalendarCheck size={15} /></button>
        <label className="shrink-0 text-xs text-theme-muted">
          <span className="sr-only">Фильтр записей</span>
          <select data-testid="select-payment-filter" value={filter} onChange={event => setFilter(event.target.value as Filter)} className="w-[90px] rounded-lg border border-theme-base bg-theme-surface px-1.5 py-1.5 text-[10px] sm:w-auto sm:px-2 sm:text-xs text-theme-main">
            <option value="all">Все записи</option>
            <option value="pending">Ожидают</option>
            <option value="overdue">Просрочены</option>
            <option value="paid">Выполнены</option>
          </select>
        </label>
      </div>

      {occurrences.length === 0 ? (
        <div className="min-h-[340px] border border-dashed border-theme-base rounded-2xl bg-theme-surface flex flex-col items-center justify-center text-center px-5">
          <CalendarDays className="text-theme-primary mb-3" size={30} />
          <h3 className="text-lg font-bold text-theme-main">В этом месяце нет запланированных записей</h3>
          <p className="text-xs text-theme-muted max-w-sm mt-2 mb-4">Добавьте регулярную операцию или другой план — он появится в календаре.</p>
           <button type="button" data-testid="button-add-first-payment" onClick={() => openCreate(toDateKey(cursor))} className="px-3 py-2 rounded-xl bg-theme-primary text-theme-on-primary text-xs font-bold"><Plus size={14} className="inline mr-1" />Запланировать первую запись</button>
        </div>
      ) : (
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_300px] gap-3">
          <div className="min-w-0 rounded-2xl border border-theme-base bg-theme-surface overflow-hidden">
            <div className="grid min-w-0 grid-cols-7 border-b border-theme-base">
              {WEEKDAYS.map((day, index) => <div key={day} className={`min-w-0 p-1 sm:p-2 text-center text-[9px] sm:text-[10px] font-bold uppercase truncate ${index > 4 ? 'text-theme-primary' : 'text-theme-muted'}`}>{day}</div>)}
            </div>
            <div className="grid min-w-0 grid-cols-7">
              {getMonthCells(cursor).map(cell => {
                const dayItems = byDate.get(cell.key) || [];
                return (
                  <button
                    key={cell.key}
                    type="button"
                    data-testid={`calendar-day-${cell.key}`}
                    onClick={() => setSelectedDate(cell.key)}
                    className={`min-w-0 min-h-[60px] sm:min-h-[106px] p-1 sm:p-2 text-left border-b border-r border-theme-base ${!cell.currentMonth ? 'bg-theme-main text-theme-muted' : 'bg-theme-surface'} ${selectedDate === cell.key ? 'ring-2 ring-inset ring-theme-primary bg-theme-primary-light' : 'hover:bg-theme-main'}`}
                  >
                    <span className={`inline-flex min-w-6 h-6 items-center justify-center rounded-lg text-xs font-mono ${cell.key === getTodayKey() ? 'bg-theme-primary text-theme-on-primary' : 'text-theme-muted'}`}>{cell.day}</span>
                    <span className="block mt-1 space-y-1">
                      {dayItems.slice(0, 2).map(item => (
                        <span key={`${item.payment.id}-${item.date}`} className={`hidden sm:flex items-center gap-1 rounded px-1 py-1 text-[10px] truncate ${occurrenceTone(item)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />{item.payment.title}
                        </span>
                      ))}
                      {dayItems.length > 2 && <span className="text-[9px] text-theme-muted">+ ещё {dayItems.length - 2}</span>}
                      {dayItems.length > 0 && <span className="sm:hidden flex gap-0.5">{dayItems.slice(0, 3).map(item => <span key={`${item.payment.id}-${item.date}-dot`} className={`w-1.5 h-1.5 rounded-full ${occurrenceDotTone(item)}`} />)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
          <UpcomingTasks
            payments={payments}
            startDate={selectedDate}
            onAdd={() => openCreate()}
            onTaskClick={date => {
              const nextDate = parseDateKey(date);
              setCursor(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
              setSelectedDate(date);
            }}
            onToggleTask={item => {
              if (onRequestTransaction) {
                onRequestTransaction(item.payment, item.date);
              } else {
                onStatusChange?.(item.payment.id, item.date, 'paid');
              }
            }}
            onManualToggleTask={item => {
              if (!onStatusChange) return;
              void onStatusChange(item.payment.id, item.date, item.manuallyCompleted ? 'pending' : 'paid');
            }}
            onEditTask={item => {
              setEditingPayment({ ...item.payment });
              setDialogMode('edit');
            }}
            onDeleteTask={item => onPaymentDelete?.(item.payment.id)}
          />
          </div>
        </div>
      )}

      {dialogMode && editingPayment && (
        <PaymentDialog
          mode={dialogMode}
          payment={editingPayment}
          accounts={accounts}
          categories={categories}
          onChange={setEditingPayment}
          onClose={() => { setDialogMode(null); setEditingPayment(null); }}
          onSave={savePayment}
          saveError={saveError}
        />
      )}
    </section>
  );
}

function moveMonth(offset: number, cursor: Date, setCursor: (date: Date) => void, setSelectedDate: (key: string) => void) {
  const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
  setCursor(next);
  setSelectedDate(toDateKey(next));
}

function occurrenceTone(item: PlannedPaymentOccurrence) {
  if (item.status === 'paid') return 'bg-neutral-100 text-neutral-400 opacity-80';
  return item.payment.transactionType === 'income'
    ? 'bg-lime-50 text-lime-700'
    : 'bg-pink-50 text-pink-700';
}

function occurrenceDotTone(item: PlannedPaymentOccurrence) {
  if (item.status === 'paid') return 'bg-neutral-300';
  return item.payment.transactionType === 'income' ? 'bg-lime-500' : 'bg-pink-300';
}

function PaymentDialog({ mode, payment, accounts, categories, onChange, onClose, onSave, saveError }: { mode: 'create' | 'edit'; payment: PlannedPayment; accounts: Array<{ id: string; name: string }>; categories: Category[]; onChange: (payment: PlannedPayment) => void; onClose: () => void; onSave: () => void; saveError?: string | null }) {
  const set = <K extends keyof PlannedPayment>(field: K, value: PlannedPayment[K]) => onChange({ ...payment, [field]: value });
  const transactionType = payment.transactionType || 'expense';
  return (
    <div className="fixed inset-0 z-40 bg-black/30 p-0 sm:p-4 flex items-center justify-center" role="presentation" onMouseDown={onClose}>
      <section className="w-full max-w-lg h-full max-h-full sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto no-scrollbar rounded-none sm:rounded-2xl bg-theme-surface shadow-2xl" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-theme-base"><h3 className="text-lg font-bold text-theme-main">{mode === 'create' ? 'Новая запись' : 'Изменить'}</h3><button type="button" aria-label="Закрыть" data-testid="button-close-payment-dialog" onClick={onClose} className="p-2 rounded-lg hover:bg-theme-main"><X size={16} /></button></header>
        <div className="p-4 space-y-3">
          <label className="block text-xs font-bold text-theme-muted">Название<input data-testid="input-payment-title" value={payment.title} onChange={event => set('title', event.target.value)} placeholder="Аренда квартиры" className="mt-1 w-full rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-sm font-normal text-theme-main" autoFocus /></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-theme-muted">Сумма<input data-testid="input-payment-amount" type="number" min="1" value={payment.amount || ''} onChange={event => set('amount', Number(event.target.value))} className="mt-1 w-full rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-sm font-normal text-theme-main" /></label>
            <label className="block text-xs font-bold text-theme-muted">Дата<input data-testid="input-payment-date" type="date" value={payment.date} onChange={event => set('date', event.target.value)} className="mt-1 w-full rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-sm font-normal text-theme-main" /></label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-theme-muted">Повторение<select data-testid="select-payment-recurrence" value={payment.recurrence} onChange={event => set('recurrence', event.target.value as PlannedPaymentRecurrence)} className="mt-1 w-full rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-sm font-normal text-theme-main">{RECURRENCES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="block text-xs font-bold text-theme-muted">Счёт<select data-testid="select-payment-account" value={payment.accountId || ''} onChange={event => { const account = accounts.find(item => item.id === event.target.value); onChange({ ...payment, accountId: account?.id, accountName: account?.name || '' }); }} className="mt-1 w-full rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-sm font-normal text-theme-main"><option value="">Не выбран</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-theme-muted">Тип операции<select data-testid="select-payment-type" value={transactionType} onChange={event => { const nextType = event.target.value as 'expense' | 'income'; const category = categories.find(item => item.type === nextType); onChange({ ...payment, transactionType: nextType, categoryId: category?.id, categoryName: category?.name }); }} className="mt-1 w-full rounded-xl border border-theme-base bg-theme-main px-3 py-2 text-sm font-normal text-theme-main"><option value="expense">Расход</option><option value="income">Доход</option></select></label>
            <CategorySelect
              categories={categories}
              selectedCategoryId={payment.categoryId || ''}
              onChange={categoryId => {
                const category = categories.find(item => item.id === categoryId);
                onChange({ ...payment, categoryId: category?.id, categoryName: category?.name });
              }}
              type={transactionType}
              label="Категория"
            />
          </div>
        </div>
        {saveError && <p className="px-4 pb-3 text-xs text-rose-600">{saveError}</p>}
        <footer className="flex justify-end gap-2 p-4 border-t border-theme-base"><button type="button" data-testid="button-cancel-payment" onClick={onClose} className="px-3 py-2 rounded-xl bg-theme-main text-theme-muted text-xs font-bold">Отмена</button><button type="button" data-testid="button-save-payment" disabled={!payment.title.trim() || payment.amount <= 0} onClick={onSave} className="px-3 py-2 rounded-xl bg-theme-primary text-theme-on-primary text-xs font-bold disabled:opacity-40">{mode === 'create' ? <Plus size={14} className="inline mr-1" /> : <Check size={14} className="inline mr-1" />}{mode === 'create' ? 'Запланировать' : 'Сохранить'}</button></footer>
      </section>
    </div>
  );
}

function CalendarState({ title, description, action, actionLabel, error = false }: { title: string; description?: string; action?: () => void; actionLabel?: string; error?: boolean }) {
  return <div className="min-h-[340px] m-3 sm:m-5 rounded-2xl border border-dashed border-theme-base bg-theme-surface flex flex-col items-center justify-center text-center px-5">{error ? <CircleAlert className="text-rose-400 mb-3" size={30} /> : <CalendarDays className="text-theme-primary mb-3" size={30} />}<h3 className="text-lg font-bold text-theme-main">{title}</h3>{description && <p className="text-xs text-theme-muted max-w-sm mt-2 mb-4">{description}</p>}{action && <button type="button" data-testid="button-calendar-state-action" onClick={action} className="px-3 py-2 rounded-xl bg-theme-primary text-theme-on-primary text-xs font-bold"><RefreshCw size={14} className="inline mr-1" />{actionLabel}</button>}</div>;
}