export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'card' | 'cash' | 'bank' | 'credit';

export interface UserSettings {
  showTotalBalance: boolean;
  lastNudgeTime?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  role?: 'admin' | 'user';
  settings?: UserSettings;
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
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  targetAccountId?: string;
  categoryId: string;
  subcategoryId?: string;
  amount: number;
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
  deadline?: string;
  completedAt?: string;
  isCompleted: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'weekly';
  spent: number;
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

export interface Currency {
  id: string;
  curUid: string;
  name: string;
  iso: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'action' | 'suggestion';
  actionType?: 'transaction' | 'goal' | 'plan';
  actionData?: any;
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
