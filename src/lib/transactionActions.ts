import { Transaction, TransactionType } from '../types';

export interface SimilarTransactionData {
  type: TransactionType;
  amount: number;
  targetAmount: number | null;
  exchangeRate: number | null;
  accountId: string;
  targetAccountId: string | null;
  categoryId: string;
  subcategoryId: string | null;
  description: string;
  createdAt: string;
}

export function getSimilarTransactionData(transaction: Transaction): SimilarTransactionData {
  return {
    type: transaction.type,
    amount: transaction.amount,
    targetAmount: transaction.targetAmount ?? null,
    exchangeRate: transaction.exchangeRate ?? null,
    accountId: transaction.accountId,
    targetAccountId: transaction.targetAccountId ?? null,
    categoryId: transaction.categoryId ?? '',
    subcategoryId: transaction.subcategoryId ?? null,
    description: transaction.description,
    createdAt: transaction.createdAt,
  };
}