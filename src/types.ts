export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'card' | 'cash' | 'bank' | 'credit';

export type DashboardWidgetId = 'upcomingTasks' | 'accounts' | 'transactions' | 'balance' | 'goals';
export type DashboardDevice = 'desktop' | 'tablet' | 'mobile';
export type ThemeDeviceClass = 'desktop' | 'tablet' | 'mobile';
export type ThemeId =
  | 'theme-bw'
  | 'theme-nordic'
  | 'theme-light-blue'
  | 'theme-light-orange'
  | 'theme-light-ruby'
  | 'theme-light-violet'
  | 'theme-light-green'
  | 'theme-midnight'
  | 'theme-carbon'
  | 'theme-oled'
  | 'theme-forest-dark'
  | 'theme-nocturnal'
  | 'theme-cyber';
export type ThemePreferences = Record<ThemeDeviceClass, ThemeId>;
export type DashboardColumnSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface DashboardDeviceLayout {
  order: DashboardWidgetId[];
  visibility: Record<DashboardWidgetId, boolean>;
  spans: Record<DashboardWidgetId, DashboardColumnSpan>;
}

export interface DashboardLayoutSettings {
  desktop: DashboardDeviceLayout;
  tablet: DashboardDeviceLayout;
  mobile: DashboardDeviceLayout;
}

export interface UserSettings {
  showTotalBalance: boolean;
  lastNudgeTime?: string;
  dashboard?: DashboardLayoutSettings;
  themeByDevice?: ThemePreferences;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  role?: 'admin' | 'user';
  settings?: UserSettings;
  isLockedOut?: boolean;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  currencyId?: string;
  description?: string;
  showOnDashboard: boolean;
  showInTotals: boolean;
  isArchived?: boolean;
  color?: string;
  aliases?: string;
  comment?: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  parentId?: string;
  subcategories?: Subcategory[];
  sortOrder?: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  targetAccountId?: string;
  categoryId: string;
  subcategoryId?: string;
  calendarOccurrenceId?: string | null;
  amount: number;
  // Cross-currency transfers: amount credited to the target account in its
  // own currency and the fixed RUB price of one unit of the exchanged foreign
  // currency. Absent for ordinary transactions and legacy 1:1 transfers.
  targetAmount?: number | null;
  exchangeRate?: number | null;
  type: TransactionType;
  description: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  currency?: string;
  deadline?: string;
  completedAt?: string;
  isCompleted: boolean;
  sortOrder?: number;
}

export interface Plan {
  id: string;
  userId: string;
  name: string;
  plannedAmount: number;
  accountId: string;
  priority: 'low' | 'medium' | 'high';
  dateOfFinish: string;
  month: string; // e.g., "2026-04"
}

export interface PlanCell {
  value: string;
  color?: string;
  isBold?: boolean;
  fontSize?: number;
  comment?: string;
}

export interface PlanSubject {
  id: string;
  name: string;
  color?: string; // Background color
  textColor?: string;
  isArchived?: boolean;
}

export interface PlanRow {
  id: string;
  label: string;
  type: 'month' | 'min' | 'year' | 'past';
  cells: { [subjectId: string]: PlanCell };
}

export interface PlanConfig {
  targetAmount: number;
  totalColumnColor: string;
  headerColor: string;
  firstColumnColor: string;
  minRowColor: string;
}

export interface CashbackCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface CashbackEntry {
  id: string;
  assetId: string; // Refers to an Account or a custom asset
  categoryId: string;
  percent: number;
  comment?: string;
}

export interface CashbackMonth {
  id: string; // e.g., "2026-04"
  label: string; // e.g., "Апрель"
  entries: CashbackEntry[];
}

export interface CashbackData {
  categories: CashbackCategory[];
  months: CashbackMonth[];
  /** @deprecated use months[].entries */
  entries?: CashbackEntry[];
}

export interface PlanData {
  id: string;
  userId: string;
  subjects: PlanSubject[];
  rows: PlanRow[];
  pastRows?: PlanRow[];
  config: PlanConfig;
  comment: string | PlanNotesPayload;
  updatedAt: string;
  cashback?: CashbackData;
  credit?: {
    amount: number;
    rate: number;
    term: number;
  };
}

export type PlannedPaymentRecurrence = 'none' | 'weekly' | 'biweekly' | 'weekdays' | 'monthly' | 'quarterly' | 'yearly';
export type PlannedPaymentStatus = 'paid' | 'pending';

export interface PlannedPayment {
  id: string;
  title: string;
  amount: number;
  date: string;
  note?: string;
  time?: string;
  recurrence: PlannedPaymentRecurrence;
  weekdays?: number[];
  transactionType?: 'expense' | 'income';
  categoryId?: string;
  categoryName?: string;
  accountId?: string;
  accountName?: string;
  disableFrom?: string | null;
  status: PlannedPaymentStatus;
  paidDates?: string[];
  occurrences?: Array<{
    id: string;
    date: string;
    transactionId?: string | null;
    manuallyCompleted: boolean;
  }>;
  color?: 'plum' | 'blue' | 'orange';
}

export type PlannedPaymentDraft = Partial<Pick<
  PlannedPayment,
  'title' | 'amount' | 'date' | 'note' | 'time' | 'recurrence' | 'weekdays' |
  'transactionType' | 'categoryId' | 'accountId' | 'color'
>>;

export interface CalendarNote {
  id: string;
  date: string;
  text: string;
}

export type CalendarNoteDraft = Pick<CalendarNote, 'date' | 'text'>;

export interface PlanNote {
  id: string;
  title: string;
  content: string;
}

export interface PlanNotesPayload {
  version: 1;
  activeNoteId: string;
  notes: PlanNote[];
}

export interface BalanceHistory {
  id: string;
  userId: string;
  month: string;
  totalBalance: number;
  details?: any;
  createdAt: string;
}

export interface Currency {
  id: string;
  currency: string;
  name: string;
  iso: string;
  rate: number;
  symbol?: string;
  buyRate?: number;
  sellRate?: number;
  rateSource?: string;
  rateUpdatedAt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'action' | 'suggestion';
  actionType?: 'transaction' | 'goal' | 'plan' | 'calendar_plan' | 'calendar_note' | 'compound';
  actionData?: any;
  attachments?: string[];
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}
