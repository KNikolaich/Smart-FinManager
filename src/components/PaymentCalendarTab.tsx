import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  PlannedPayment,
  PlannedPaymentRecurrence,
  PlannedPaymentStatus,
  Category,
} from '../types';
import CategorySelect from './CategorySelect';

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
}

type Filter = 'all' | 'pending' | 'paid';
type DialogMode = 'create' | 'edit' | null;
type CalendarOccurrence = {
  payment: PlannedPayment;
  date: string;
  status: PlannedPaymentStatus;
};

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

const pad = (value: number) => String(value).padStart(2, '0');
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const todayKey = toDateKey(new Date());

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)} ₽`;
}

function recurrenceLabel(value: PlannedPaymentRecurrence) {
  return RECURRENCES.find(item => item.value === value)?.label || 'Однократно';
}

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

function getOccurrences(payment: PlannedPayment, cursor: Date): string[] {
  const base = parseDateKey(payment.date);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const baseDay = base.getDate();
  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const monthDistance = (year - base.getFullYear()) * 12 + month - base.getMonth();
    const dayDistance = Math.round((date.getTime() - base.getTime()) / 86400000);
    const sameDay = day === baseDay;
    const matches = payment.recurrence === 'none'
      ? toDateKey(date) === payment.date
      : date >= base && payment.recurrence === 'weekly'
        ? dayDistance % 7 === 0
        : date >= base && payment.recurrence === 'biweekly'
          ? dayDistance % 14 === 0
      : payment.recurrence === 'monthly'
          ? date >= base && sameDay
        : payment.recurrence === 'quarterly'
            ? date >= base && sameDay && monthDistance % 3 === 0
            : date >= base && sameDay && date.getMonth() === base.getMonth() && year >= base.getFullYear();
    if (matches) dates.push(toDateKey(date));
  }
  return dates;
}

function occurrenceStatus(payment: PlannedPayment, date: string): PlannedPaymentStatus {
  if (payment.paidDates) return payment.paidDates.includes(date) ? 'paid' : 'pending';
  return payment.status === 'paid' && date === payment.date ? 'paid' : 'pending';
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
}: PaymentCalendarTabProps) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [filter, setFilter] = useState<Filter>('all');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingPayment, setEditingPayment] = useState<PlannedPayment | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const occurrences = useMemo<CalendarOccurrence[]>(
    () => payments.flatMap(payment =>
      getOccurrences(payment, cursor).map(date => ({
        payment,
        date,
        status: occurrenceStatus(payment, date),
      })),
    ),
    [payments, cursor],
  );
  const visibleOccurrences = occurrences.filter(item => filter === 'all' || item.status === filter);
  const byDate = new Map<string, CalendarOccurrence[]>();
  visibleOccurrences.forEach(item => byDate.set(item.date, [...(byDate.get(item.date) || []), item]));
  const selectedOccurrences = byDate.get(selectedDate) || [];
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
    <section className="p-3 sm:p-5 space-y-4 overflow-y-auto no-scrollbar h-full" data-testid="payment-calendar">
      <header className="flex items-start gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-theme-primary-light text-theme-primary flex items-center justify-center shrink-0">
            <CalendarDays size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-theme-muted">Планы / календарь</p>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-theme-muted">Регулярные операции и планы</p>
              <button type="button" data-testid="button-add-payment" onClick={() => openCreate()} className="px-3 py-2 rounded-xl bg-theme-primary text-theme-on-primary text-xs font-bold flex items-center gap-2 hover:bg-theme-primary-dark shrink-0">
                <Plus size={15} /> <span className="hidden sm:inline">Запланировать</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Предыдущий месяц" data-testid="button-previous-month" onClick={() => moveMonth(-1, cursor, setCursor, setSelectedDate)} className="p-2 rounded-lg border border-theme-base bg-theme-surface text-theme-muted"><ArrowLeft size={15} /></button>
          <strong className="min-w-[125px] text-center text-sm capitalize text-theme-main">{MONTHS[cursor.getMonth()]} <span className="text-theme-muted font-normal">{cursor.getFullYear()}</span></strong>
          <button type="button" aria-label="Следующий месяц" data-testid="button-next-month" onClick={() => moveMonth(1, cursor, setCursor, setSelectedDate)} className="p-2 rounded-lg border border-theme-base bg-theme-surface text-theme-muted"><ArrowRight size={15} /></button>
          <button type="button" data-testid="button-today" onClick={() => { setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(todayKey); }} className="px-2.5 py-1.5 rounded-lg border border-theme-base text-[11px] font-bold text-theme-muted">Сегодня</button>
        </div>
        <label className="text-xs text-theme-muted">
          <span className="sr-only">Фильтр записей</span>
          <select data-testid="select-payment-filter" value={filter} onChange={event => setFilter(event.target.value as Filter)} className="rounded-lg border border-theme-base bg-theme-surface px-2 py-1.5 text-xs text-theme-main">
            <option value="all">Все записи</option>
            <option value="pending">Ожидают</option>
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
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3">
          <div className="rounded-2xl border border-theme-base bg-theme-surface overflow-hidden">
            <div className="grid grid-cols-7 border-b border-theme-base">
              {WEEKDAYS.map((day, index) => <div key={day} className={`p-2 text-[10px] font-bold uppercase ${index > 4 ? 'text-theme-primary' : 'text-theme-muted'}`}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {getMonthCells(cursor).map(cell => {
                const dayItems = byDate.get(cell.key) || [];
                return (
                  <button
                    key={cell.key}
                    type="button"
                    data-testid={`calendar-day-${cell.key}`}
                    onClick={() => setSelectedDate(cell.key)}
                    className={`min-h-[72px] sm:min-h-[106px] p-1.5 sm:p-2 text-left border-b border-r border-theme-base ${!cell.currentMonth ? 'bg-theme-main text-theme-muted' : 'bg-theme-surface'} ${selectedDate === cell.key ? 'ring-2 ring-inset ring-theme-primary bg-theme-primary-light' : 'hover:bg-theme-main'}`}
                  >
                    <span className={`inline-flex min-w-6 h-6 items-center justify-center rounded-lg text-xs font-mono ${cell.key === todayKey ? 'bg-theme-primary text-theme-on-primary' : 'text-theme-muted'}`}>{cell.day}</span>
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

          <aside className="rounded-2xl border border-theme-base bg-theme-surface p-4">
            <div className="flex items-start justify-between border-b border-theme-base pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-theme-muted font-bold">Выбранный день</p>
                <h3 className="text-lg font-bold text-theme-main mt-1">{selectedDate ? parseDateKey(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : 'Выберите день'}</h3>
              </div>
              <button type="button" aria-label="Запланировать на выбранный день" data-testid="button-add-payment-selected-day" onClick={() => openCreate()} className="p-2 rounded-lg bg-theme-primary-light text-theme-primary"><Plus size={16} /></button>
            </div>
            <div className="divide-y divide-theme-base">
              {selectedOccurrences.length === 0 ? (
                 <div className="py-12 text-center text-xs text-theme-muted"><CircleDashed size={20} className="mx-auto mb-2" />На этот день записей нет</div>
              ) : selectedOccurrences.map(item => (
                <PaymentRow
                  key={`${item.payment.id}-${item.date}`}
                  item={item}
                  menuOpen={menuFor === `${item.payment.id}-${item.date}`}
                  onMenu={() => setMenuFor(menuFor === `${item.payment.id}-${item.date}` ? null : `${item.payment.id}-${item.date}`)}
                  onEdit={() => { setEditingPayment({ ...item.payment }); setDialogMode('edit'); }}
                  onDelete={() => onPaymentDelete?.(item.payment.id)}
                  onToggleStatus={() => {
                    if (item.status === 'paid') {
                      onStatusChange?.(item.payment.id, item.date, 'pending');
                    } else if (onRequestTransaction) {
                      onRequestTransaction(item.payment, item.date);
                    } else {
                      onStatusChange?.(item.payment.id, item.date, 'paid');
                    }
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between pt-3 text-xs text-theme-muted">
              <span>Всего за день</span>
              <strong className="text-theme-main">{formatMoney(selectedOccurrences.reduce((sum, item) => sum + item.payment.amount, 0))}</strong>
            </div>
          </aside>
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

function occurrenceTone(item: CalendarOccurrence) {
  if (item.status === 'paid') return 'bg-neutral-100 text-neutral-400 opacity-80';
  return item.payment.transactionType === 'income'
    ? 'bg-lime-50 text-lime-700'
    : 'bg-rose-50 text-rose-700';
}

function occurrenceDotTone(item: CalendarOccurrence) {
  if (item.status === 'paid') return 'bg-neutral-300';
  return item.payment.transactionType === 'income' ? 'bg-lime-500' : 'bg-rose-500';
}

function PaymentRow({ item, menuOpen, onMenu, onEdit, onDelete, onToggleStatus }: { item: CalendarOccurrence; menuOpen: boolean; onMenu: () => void; onEdit: () => void; onDelete: () => void; onToggleStatus: () => void }) {
  const key = `${item.payment.id}-${item.date}`;
  return (
    <article className={`flex items-center gap-2 py-2 px-2 rounded-xl ${occurrenceTone(item)}`} data-testid={`payment-row-${key}`}>
       <button type="button" title={item.status === 'paid' ? 'Вернуть в ожидающие' : 'Создать операцию и отметить выполненной'} aria-label={item.status === 'paid' ? 'Отметить как ожидающую' : 'Создать операцию по записи'} data-testid={`button-toggle-payment-${key}`} onClick={onToggleStatus} className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${item.status === 'paid' ? 'bg-neutral-200 border-neutral-300 text-neutral-500' : 'border-neutral-300 bg-white/70'}`}>{item.status === 'paid' && <Check size={13} />}</button>
       <div className="min-w-0 flex-1"><strong className="block text-xs truncate">{item.payment.title}</strong><span className="text-[10px] opacity-75">{item.payment.categoryName || (item.payment.transactionType === 'income' ? 'Доход' : 'Расход')} · {recurrenceLabel(item.payment.recurrence)} · {item.payment.accountName || 'Счёт не выбран'}</span></div>
       <strong className="text-xs whitespace-nowrap">{formatMoney(item.payment.amount)}</strong>
      <div className="relative">
         <button type="button" aria-label={`Действия: ${item.payment.title}`} data-testid={`button-payment-menu-${key}`} onClick={onMenu} className="p-1.5 rounded-lg opacity-60 hover:bg-black/5">•••</button>
         {menuOpen && <div className="absolute right-0 top-8 z-10 w-28 p-1 rounded-lg border border-theme-base bg-theme-surface shadow-lg"><button type="button" onClick={onEdit} className="w-full text-left px-2 py-1.5 text-xs hover:bg-theme-main"><Pencil size={12} className="inline mr-1" />Изменить</button><button type="button" onClick={onDelete} className="w-full text-left px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50"><Trash2 size={12} className="inline mr-1" />Удалить</button></div>}
      </div>
    </article>
  );
}

function PaymentDialog({ mode, payment, accounts, categories, onChange, onClose, onSave, saveError }: { mode: 'create' | 'edit'; payment: PlannedPayment; accounts: Array<{ id: string; name: string }>; categories: Category[]; onChange: (payment: PlannedPayment) => void; onClose: () => void; onSave: () => void; saveError?: string | null }) {
  const set = <K extends keyof PlannedPayment>(field: K, value: PlannedPayment[K]) => onChange({ ...payment, [field]: value });
  const transactionType = payment.transactionType || 'expense';
  return (
    <div className="fixed inset-0 z-40 bg-black/30 p-4 flex items-center justify-center" role="presentation" onMouseDown={onClose}>
      <section className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto no-scrollbar rounded-2xl bg-theme-surface shadow-2xl" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
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