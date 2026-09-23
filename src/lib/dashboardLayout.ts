import {
  DashboardDevice,
  DashboardDeviceLayout,
  DashboardColumnSpan,
  DashboardLayoutSettings,
  DashboardWidgetId,
  UserSettings,
} from '../types';

export const DASHBOARD_WIDGETS: ReadonlyArray<{
  id: DashboardWidgetId;
  label: string;
  description: string;
}> = [
  { id: 'upcomingTasks', label: 'Предстоящие планы', description: 'Ближайшие запланированные платежи и задачи' },
  { id: 'accounts', label: 'Счета', description: 'Баланс и список ваших счетов' },
  { id: 'transactions', label: 'Операции', description: 'Последние доходы, расходы и переводы' },
  { id: 'balance', label: 'Баланс', description: 'Общий баланс и динамика за период' },
  { id: 'goals', label: 'Цели', description: 'Прогресс по финансовым целям' },
];

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  'accounts',
  'upcomingTasks',
  'transactions',
  'goals',
  'balance',
];

const DEFAULT_WIDGET_VISIBILITY: Record<DashboardWidgetId, boolean> = {
  upcomingTasks: true,
  accounts: true,
  transactions: true,
  balance: true,
  goals: true,
};

const DEFAULT_WIDGET_SPANS: Record<DashboardDevice, Record<DashboardWidgetId, DashboardColumnSpan>> = {
  desktop: {
    accounts: 8,
    upcomingTasks: 4,
    transactions: 12,
    goals: 4,
    balance: 8,
  },
  tablet: {
    upcomingTasks: 12,
    accounts: 12,
    transactions: 12,
    balance: 12,
    goals: 12,
  },
  mobile: {
    upcomingTasks: 12,
    accounts: 12,
    transactions: 12,
    balance: 12,
    goals: 12,
  },
};

function isDashboardColumnSpan(value: unknown): value is DashboardColumnSpan {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12;
}

function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return DASHBOARD_WIDGETS.some(widget => widget.id === value);
}

function normalizeDeviceLayout(value: unknown, device: DashboardDevice): DashboardDeviceLayout {
  const candidate = value && typeof value === 'object' ? value as Partial<DashboardDeviceLayout> : {};
  const sourceOrder = Array.isArray(candidate.order) ? candidate.order : [];
  const order = Array.from(new Set(sourceOrder.filter(isDashboardWidgetId)));

  for (const widgetId of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!order.includes(widgetId)) order.push(widgetId);
  }

  const rawVisibility = candidate.visibility && typeof candidate.visibility === 'object'
    ? candidate.visibility as Partial<Record<DashboardWidgetId, unknown>>
    : {};
  const visibility = { ...DEFAULT_WIDGET_VISIBILITY };

  for (const widget of DASHBOARD_WIDGETS) {
    if (typeof rawVisibility[widget.id] === 'boolean') {
      visibility[widget.id] = rawVisibility[widget.id] as boolean;
    }
  }

  const rawSpans = candidate.spans && typeof candidate.spans === 'object'
    ? candidate.spans as Partial<Record<DashboardWidgetId, unknown>>
    : {};
  const spans = { ...DEFAULT_WIDGET_SPANS[device] };

  for (const widget of DASHBOARD_WIDGETS) {
    if (isDashboardColumnSpan(rawSpans[widget.id])) {
      spans[widget.id] = rawSpans[widget.id] as DashboardColumnSpan;
    }
  }

  return { order, visibility, spans };
}

export function getDefaultDashboardLayoutSettings(): DashboardLayoutSettings {
  return {
    desktop: normalizeDeviceLayout(undefined, 'desktop'),
    tablet: normalizeDeviceLayout(undefined, 'tablet'),
    mobile: normalizeDeviceLayout(undefined, 'mobile'),
  };
}

export function normalizeDashboardLayoutSettings(
  value?: Partial<Record<DashboardDevice, Partial<DashboardDeviceLayout>>> | null,
): DashboardLayoutSettings {
  return {
    desktop: normalizeDeviceLayout(value?.desktop, 'desktop'),
    tablet: normalizeDeviceLayout(value?.tablet, 'tablet'),
    mobile: normalizeDeviceLayout(value?.mobile, 'mobile'),
  };
}

export function getDashboardLayout(
  settings: UserSettings | undefined,
  device: DashboardDevice,
): DashboardDeviceLayout {
  return normalizeDashboardLayoutSettings(settings?.dashboard)[device];
}