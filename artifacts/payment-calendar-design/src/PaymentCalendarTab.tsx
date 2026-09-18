import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  Clock3,
  Ellipsis,
  Link2,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

export type PaymentStatus = 'paid' | 'pending';
export type PaymentTodoist = 'synced' | 'not-linked' | 'syncing' | 'error';
export type PaymentColor = 'plum' | 'blue' | 'orange';

export interface PlannedPayment {
  id: string;
  title: string;
  amount: number;
  date: string;
  recurrence: string;
  account: string;
  status: PaymentStatus;
  todoist: PaymentTodoist;
  color: PaymentColor;
}

interface PaymentCalendarTabProps {
  payments?: PlannedPayment[];
  loading?: boolean;
  error?: string | null;
  todoistConnected?: boolean;
  onRetry?: () => void;
  onTodoistConnect?: () => void;
  onStatusChange?: (id: string, status: PaymentStatus) => void;
  onPaymentChange?: (payment: PlannedPayment) => void;
  onPaymentDelete?: (id: string) => void;
}

type Filter = 'all' | 'pending' | 'paid';
type DialogMode = 'create' | 'edit' | null;

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];
const RECURRENCES = ['Однократно', 'Ежемесячно', 'Ежеквартально', 'Ежегодно'];
const COLORS: PaymentColor[] = ['plum', 'blue', 'orange'];

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const toKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatMoney = (amount: number) =>
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)} ₽`;

const formatShortDate = (key: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(parseKey(key));

const getMonthDays = (cursor: Date) => {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const cells: Array<{ key: string; day: number; currentMonth: boolean }> = [];

  for (let index = mondayIndex - 1; index >= 0; index -= 1) {
    const day = previousMonthDays - index;
    cells.push({ key: toKey(new Date(year, month - 1, day)), day, currentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: toKey(new Date(year, month, day)), day, currentMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({
      key: toKey(new Date(year, month + 1, nextDay)),
      day: nextDay,
      currentMonth: false,
    });
    nextDay += 1;
  }
  return cells;
};

const todayKey = toKey(new Date());

export default function PaymentCalendarTab({
  payments = [],
  loading = false,
  error = null,
  todoistConnected = false,
  onRetry,
  onTodoistConnect,
  onStatusChange,
  onPaymentChange,
  onPaymentDelete,
}: PaymentCalendarTabProps) {
  const [cursor, setCursor] = useState(new Date(2026, 3, 1));
  const [selectedDate, setSelectedDate] = useState('2026-04-12');
  const [filter, setFilter] = useState<Filter>('all');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingPayment, setEditingPayment] = useState<PlannedPayment | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const monthPrefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
  const monthDays = useMemo(() => getMonthDays(cursor), [cursor]);
  const currentMonthPayments = useMemo(
    () => payments.filter((payment) => payment.date.startsWith(monthPrefix)),
    [payments, monthPrefix],
  );
  const filteredPayments = useMemo(
    () =>
      currentMonthPayments.filter((payment) => filter === 'all' || payment.status === filter),
    [currentMonthPayments, filter],
  );
  const paymentsByDate = useMemo(() => {
    const grouped = new Map<string, PlannedPayment[]>();
    filteredPayments.forEach((payment) => {
      grouped.set(payment.date, [...(grouped.get(payment.date) ?? []), payment]);
    });
    return grouped;
  }, [filteredPayments]);
  const selectedPayments = paymentsByDate.get(selectedDate) ?? [];

  const pendingAmount = currentMonthPayments
    .filter((payment) => payment.status === 'pending')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const paidAmount = currentMonthPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const allEmpty = !loading && !error && currentMonthPayments.length === 0;

  const moveMonth = (offset: number) => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDate(toKey(new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1)));
  };

  const openCreate = (date = selectedDate) => {
    setEditingPayment({
      id: `payment-${Date.now()}`,
      title: '',
      amount: 0,
      date,
      recurrence: 'Однократно',
      account: 'Тинькофф Black',
      status: 'pending',
      todoist: todoistConnected ? 'not-linked' : 'not-linked',
      color: 'plum',
    });
    setDialogMode('create');
  };

  const openEdit = (payment: PlannedPayment) => {
    setEditingPayment({ ...payment });
    setDialogMode('edit');
    setMenuFor(null);
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingPayment(null);
  };

  const savePayment = () => {
    if (!editingPayment?.title.trim() || !editingPayment.amount || !editingPayment.date) return;
    onPaymentChange?.({ ...editingPayment, title: editingPayment.title.trim() });
    setSelectedDate(editingPayment.date);
    setCursor(new Date(`${editingPayment.date}T12:00:00`));
    closeDialog();
  };

  const deletePayment = (id: string) => {
    onPaymentDelete?.(id);
    setMenuFor(null);
    if (selectedPayments.some((payment) => payment.id === id)) setSelectedDate('');
  };

  if (loading) return <CalendarLoadingState />;
  if (error) return <CalendarErrorState message={error} onRetry={onRetry} />;

  return (
    <section className="payment-calendar" data-testid="payment-calendar">
      <header className="calendar-header">
        <div className="calendar-heading">
          <div className="heading-mark">
            <CalendarDays size={21} strokeWidth={1.8} />
          </div>
          <div>
            <div className="eyebrow">План / календарь</div>
            <h1>Плановые оплаты</h1>
            <p>Один взгляд на обязательства месяца</p>
          </div>
        </div>
        <div className="header-actions">
          <TodoistStatus
            connected={todoistConnected}
            onClick={onTodoistConnect}
          />
          <button
            className="button button-primary"
            type="button"
            data-testid="button-add-payment"
            onClick={() => openCreate()}
          >
            <Plus size={16} />
            <span>Добавить оплату</span>
          </button>
        </div>
      </header>

      <div className="summary-strip" aria-label="Итоги месяца">
        <div className="summary-item summary-pending">
          <span className="summary-icon"><Clock3 size={15} /></span>
          <span>
            <strong>{formatMoney(pendingAmount)}</strong>
            <small>ожидает оплаты</small>
          </span>
        </div>
        <div className="summary-item summary-paid">
          <span className="summary-icon"><CheckCircle2 size={15} /></span>
          <span>
            <strong>{formatMoney(paidAmount)}</strong>
            <small>уже оплачено</small>
          </span>
        </div>
        <div className="summary-divider" />
        <span className="summary-caption">
          {currentMonthPayments.length} {pluralize(currentMonthPayments.length, 'платёж', 'платежа', 'платежей')} в {MONTHS[cursor.getMonth()]}
        </span>
      </div>

      <div className="calendar-toolbar">
        <div className="month-control">
          <button
            className="icon-button"
            type="button"
            aria-label="Предыдущий месяц"
            data-testid="button-previous-month"
            onClick={() => moveMonth(-1)}
          >
            <ArrowLeft size={17} />
          </button>
          <div className="month-label">
            <strong>{MONTHS[cursor.getMonth()]}</strong>
            <span>{cursor.getFullYear()}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Следующий месяц"
            data-testid="button-next-month"
            onClick={() => moveMonth(1)}
          >
            <ArrowRight size={17} />
          </button>
          <button
            className="today-button"
            type="button"
            data-testid="button-today"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(todayKey);
            }}
          >
            Сегодня
          </button>
        </div>

        <div className="toolbar-filters">
          <button
            className={cn('filter-toggle', showFilters && 'is-open')}
            type="button"
            data-testid="button-toggle-filters"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((open) => !open)}
          >
            <ListFilter size={15} />
            Фильтр
            {filter !== 'all' && <span className="filter-count">1</span>}
            <ChevronDown size={14} />
          </button>
          {showFilters && (
            <div className="filter-popover" role="menu" data-testid="menu-payment-filters">
              {([
                ['all', 'Все оплаты'],
                ['pending', 'Ожидают'],
                ['paid', 'Оплачены'],
              ] as Array<[Filter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={filter === value}
                  className={cn('filter-option', filter === value && 'is-selected')}
                  data-testid={`filter-${value}`}
                  onClick={() => {
                    setFilter(value);
                    setShowFilters(false);
                  }}
                >
                  <span className={cn('filter-radio', filter === value && 'is-selected')} />
                  {label}
                  {filter === value && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
          <span className="visible-count">
            {filteredPayments.length} из {currentMonthPayments.length}
          </span>
        </div>
      </div>

      {allEmpty ? (
        <CalendarEmptyState onAdd={() => openCreate(toKey(cursor))} />
      ) : (
        <div className="calendar-layout">
          <div className="calendar-card">
            <div className="week-row">
              {WEEKDAYS.map((weekday, index) => (
                <div className={cn('weekday', index > 4 && 'weekend')} key={weekday}>
                  {weekday}
                </div>
              ))}
            </div>
            <div className="calendar-grid" data-testid="calendar-grid">
              {monthDays.map((cell) => {
                const dayPayments = paymentsByDate.get(cell.key) ?? [];
                const isSelected = selectedDate === cell.key;
                const isToday = cell.key === todayKey;
                return (
                  <button
                    className={cn(
                      'day-cell',
                      !cell.currentMonth && 'is-outside',
                      isSelected && 'is-selected',
                      isToday && 'is-today',
                    )}
                    type="button"
                    key={cell.key}
                    data-testid={`calendar-day-${cell.key}`}
                    onClick={() => setSelectedDate(cell.key)}
                  >
                    <span className="day-number">{cell.day}</span>
                    {dayPayments.length > 0 && (
                      <span className="day-payments">
                        {dayPayments.slice(0, 2).map((payment) => (
                          <span
                            key={payment.id}
                            className={cn(
                              'day-payment',
                              `tone-${payment.color}`,
                              payment.status === 'paid' && 'is-paid',
                            )}
                          >
                            <span className="payment-dot" />
                            <span className="payment-name">{payment.title}</span>
                            <span className="payment-amount">{formatMoney(payment.amount)}</span>
                          </span>
                        ))}
                        {dayPayments.length > 2 && (
                          <span className="more-payments">+ ещё {dayPayments.length - 2}</span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="calendar-legend">
              <span><i className="legend-dot dot-pending" />ожидает</span>
              <span><i className="legend-dot dot-paid" />оплачено</span>
              <span><i className="legend-line" />регулярный платёж</span>
            </div>
          </div>

          <aside className="agenda-card" aria-label="Оплаты выбранного дня">
            <div className="agenda-header">
              <div>
                <span className="eyebrow">Выбранный день</span>
                <h2>{selectedDate ? formatShortDate(selectedDate) : 'Выберите день'}</h2>
              </div>
              <button
                className="agenda-add"
                type="button"
                aria-label="Добавить оплату на выбранный день"
                data-testid="button-add-payment-selected-day"
                onClick={() => openCreate(selectedDate || toKey(cursor))}
              >
                <Plus size={17} />
              </button>
            </div>
            {selectedPayments.length === 0 ? (
              <div className="agenda-empty">
                <CircleDashed size={20} />
                <p>На этот день оплат нет</p>
                <button type="button" onClick={() => openCreate(selectedDate || toKey(cursor))}>
                  Добавить оплату
                </button>
              </div>
            ) : (
              <div className="agenda-list">
                {selectedPayments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    menuOpen={menuFor === payment.id}
                    onMenu={() => setMenuFor(menuFor === payment.id ? null : payment.id)}
                    onEdit={() => openEdit(payment)}
                    onDelete={() => deletePayment(payment.id)}
                    onToggleStatus={() =>
                      onStatusChange?.(payment.id, payment.status === 'paid' ? 'pending' : 'paid')
                    }
                  />
                ))}
              </div>
            )}
            <div className="agenda-footer">
              <span>Всего за день</span>
              <strong>{formatMoney(selectedPayments.reduce((sum, item) => sum + item.amount, 0))}</strong>
            </div>
          </aside>
        </div>
      )}

      <div className="mobile-agenda">
        <div className="mobile-agenda-heading">
          <span className="eyebrow">Список месяца</span>
          <span className="visible-count">{filteredPayments.length} оплат</span>
        </div>
        {filteredPayments.length === 0 ? (
          <div className="mobile-filter-empty">
            <CircleDashed size={18} />
            <span>Нет оплат с таким статусом</span>
          </div>
        ) : (
          <div className="mobile-payment-list">
            {filteredPayments.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                compact
                menuOpen={menuFor === payment.id}
                onMenu={() => setMenuFor(menuFor === payment.id ? null : payment.id)}
                onEdit={() => openEdit(payment)}
                onDelete={() => deletePayment(payment.id)}
                onToggleStatus={() =>
                  onStatusChange?.(payment.id, payment.status === 'paid' ? 'pending' : 'paid')
                }
              />
            ))}
          </div>
        )}
      </div>

      {dialogMode && editingPayment && (
        <PaymentDialog
          mode={dialogMode}
          payment={editingPayment}
          todoistConnected={todoistConnected}
          onChange={setEditingPayment}
          onClose={closeDialog}
          onSave={savePayment}
          onConnectTodoist={onTodoistConnect}
        />
      )}
    </section>
  );
}

function TodoistStatus({
  connected,
  onClick,
}: {
  connected: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn('todoist-status', connected && 'is-connected')}
      type="button"
      data-testid="button-todoist-status"
      onClick={onClick}
      title={connected ? 'Открыть настройки связи с Todoist' : 'Подключить Todoist'}
    >
      <span className="todoist-glyph">t</span>
      <span>{connected ? 'Todoist подключён' : 'Подключить Todoist'}</span>
      {connected ? <Check size={13} /> : <Link2 size={13} />}
    </button>
  );
}

function PaymentRow({
  payment,
  compact = false,
  menuOpen,
  onMenu,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  payment: PlannedPayment;
  compact?: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  return (
    <article
      className={cn('payment-row', compact && 'is-compact', payment.status === 'paid' && 'is-paid')}
      data-testid={`payment-row-${payment.id}`}
    >
      <button
        className={cn('status-check', payment.status === 'paid' && 'is-paid')}
        type="button"
        aria-label={payment.status === 'paid' ? 'Отметить как ожидающую' : 'Отметить оплаченной'}
        data-testid={`button-toggle-payment-${payment.id}`}
        onClick={onToggleStatus}
      >
        {payment.status === 'paid' ? <Check size={14} /> : <span />}
      </button>
      <div className={cn('row-color', `tone-${payment.color}`)} />
      <div className="row-main">
        <div className="row-title-line">
          <strong>{payment.title}</strong>
          {payment.todoist === 'synced' && <span className="todoist-mini" title="Связано с Todoist">t</span>}
        </div>
        <span className="row-meta">
          {payment.recurrence}
          <span className="meta-separator">·</span>
          {payment.account}
        </span>
      </div>
      <strong className="row-amount">{formatMoney(payment.amount)}</strong>
      <div className="row-menu-wrap">
        <button
          className="row-menu-button"
          type="button"
          aria-label={`Действия: ${payment.title}`}
          aria-expanded={menuOpen}
          data-testid={`button-payment-menu-${payment.id}`}
          onClick={onMenu}
        >
          <Ellipsis size={16} />
        </button>
        {menuOpen && (
          <div className="row-menu" role="menu">
            <button type="button" role="menuitem" onClick={onEdit}>
              <Pencil size={14} /> Изменить
            </button>
            <button type="button" role="menuitem" onClick={onDelete} className="danger">
              <Trash2 size={14} /> Удалить
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function PaymentDialog({
  mode,
  payment,
  todoistConnected,
  onChange,
  onClose,
  onSave,
  onConnectTodoist,
}: {
  mode: Exclude<DialogMode, null>;
  payment: PlannedPayment;
  todoistConnected: boolean;
  onChange: (payment: PlannedPayment) => void;
  onClose: () => void;
  onSave: () => void;
  onConnectTodoist?: () => void;
}) {
  const canSave = Boolean(payment.title.trim() && payment.amount > 0 && payment.date);
  const setField = <K extends keyof PlannedPayment>(field: K, value: PlannedPayment[K]) =>
    onChange({ ...payment, [field]: value });

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">{mode === 'create' ? 'Новая запись' : 'Плановая оплата'}</span>
            <h2 id="payment-dialog-title">{mode === 'create' ? 'Добавить оплату' : 'Изменить оплату'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Закрыть" data-testid="button-close-payment-dialog" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="dialog-body">
          <label className="field field-wide">
            <span>Название</span>
            <input
              autoFocus
              value={payment.title}
              data-testid="input-payment-title"
              placeholder="Например, аренда квартиры"
              onChange={(event) => setField('title', event.target.value)}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Сумма</span>
              <div className="input-with-suffix">
                <input
                  type="number"
                  min="1"
                  value={payment.amount || ''}
                  data-testid="input-payment-amount"
                  placeholder="0"
                  onChange={(event) => setField('amount', Number(event.target.value))}
                />
                <span>₽</span>
              </div>
            </label>
            <label className="field">
              <span>Дата оплаты</span>
              <input
                type="date"
                value={payment.date}
                data-testid="input-payment-date"
                onChange={(event) => setField('date', event.target.value)}
              />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Повторение</span>
              <div className="select-wrap">
                <select
                  value={payment.recurrence}
                  data-testid="select-payment-recurrence"
                  onChange={(event) => setField('recurrence', event.target.value)}
                >
                  {RECURRENCES.map((recurrence) => <option key={recurrence}>{recurrence}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="field">
              <span>Счёт</span>
              <div className="select-wrap">
                <select
                  value={payment.account}
                  data-testid="select-payment-account"
                  onChange={(event) => setField('account', event.target.value)}
                >
                  <option>Тинькофф Black</option>
                  <option>Сбер — дебетовая</option>
                  <option>Наличные</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
          </div>
          <div className="field">
            <span>Метка</span>
            <div className="color-options">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Выбрать цвет ${color}`}
                  data-testid={`color-${color}`}
                  className={cn('color-option', `tone-${color}`, payment.color === color && 'is-selected')}
                  onClick={() => setField('color', color)}
                />
              ))}
            </div>
          </div>
          <div className="todoist-field">
            <div className="todoist-field-copy">
              <span className="todoist-glyph">t</span>
              <span>
                <strong>Связать с Todoist</strong>
                <small>{todoistConnected ? 'Задача появится в списке оплат' : 'Сначала подключите Todoist'}</small>
              </span>
            </div>
            {todoistConnected ? (
              <button
                type="button"
                className={cn('switch', payment.todoist === 'synced' && 'is-on')}
                aria-label={payment.todoist === 'synced' ? 'Отвязать от Todoist' : 'Связать с Todoist'}
                aria-pressed={payment.todoist === 'synced'}
                data-testid="button-toggle-todoist"
                onClick={() => setField('todoist', payment.todoist === 'synced' ? 'not-linked' : 'synced')}
              >
                <span />
              </button>
            ) : (
              <button className="link-button" type="button" onClick={onConnectTodoist}>
                Подключить
              </button>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          <button className="button button-ghost" type="button" data-testid="button-cancel-payment" onClick={onClose}>Отмена</button>
          <button className="button button-primary" type="button" data-testid="button-save-payment" disabled={!canSave} onClick={onSave}>
            {mode === 'create' ? <Plus size={16} /> : <Check size={16} />}
            {mode === 'create' ? 'Добавить оплату' : 'Сохранить'}
          </button>
        </div>
      </section>
    </div>
  );
}

function CalendarLoadingState() {
  return (
    <section className="payment-calendar" data-testid="payment-calendar-loading" aria-busy="true">
      <div className="calendar-loading-heading">
        <span className="skeleton skeleton-icon" />
        <span className="skeleton skeleton-title" />
      </div>
      <div className="skeleton skeleton-summary" />
      <div className="calendar-layout">
        <div className="calendar-card skeleton-calendar">
          <div className="skeleton skeleton-calendar-head" />
          <div className="skeleton skeleton-calendar-grid" />
        </div>
        <div className="agenda-card skeleton-agenda">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      </div>
    </section>
  );
}

function CalendarErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="state-panel" data-testid="payment-calendar-error">
      <div className="state-icon state-icon-error"><CircleAlert size={22} /></div>
      <h2>Не удалось загрузить календарь</h2>
      <p>{message}</p>
      <button className="button button-primary" type="button" data-testid="button-retry-payment-calendar" onClick={onRetry}>
        <RefreshCw size={15} /> Повторить
      </button>
    </section>
  );
}

function CalendarEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-calendar" data-testid="payment-calendar-empty">
      <div className="empty-calendar-mark"><CalendarDays size={27} /></div>
      <span className="eyebrow">Пока тихо</span>
      <h2>В этом месяце нет плановых оплат</h2>
      <p>Добавьте аренду, подписку или другой регулярный платёж — они появятся на календаре.</p>
      <button className="button button-primary" type="button" data-testid="button-add-first-payment" onClick={onAdd}>
        <Plus size={16} /> Добавить первую оплату
      </button>
    </div>
  );
}

function pluralize(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}