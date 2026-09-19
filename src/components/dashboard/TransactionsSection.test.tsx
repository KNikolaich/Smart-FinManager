import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionsSection } from './TransactionsSection';
import type { Account, Transaction } from '../../types';

const account: Account = {
  id: 'account-1',
  userId: 'user-1',
  name: 'Основной счёт',
  type: 'card',
  balance: 1000,
  currency: 'RUB',
  showOnDashboard: true,
  showInTotals: true,
};

const transaction: Transaction = {
  id: 'transaction-1',
  userId: 'user-1',
  accountId: account.id,
  categoryId: '',
  amount: 500,
  type: 'expense',
  description: 'Покупка',
  createdAt: '2026-09-19T12:00:00.000Z',
};

describe('TransactionsSection', () => {
  it('keeps add and history actions in the compact header', () => {
    const onOpenAddTransaction = vi.fn();
    const onOpenTransactionHistory = vi.fn();

    render(
      <TransactionsSection
        groupedTransactions={[]}
        hasTransactions={false}
        categories={[]}
        accounts={[]}
        onOpenAddTransaction={onOpenAddTransaction}
        onOpenTransactionHistory={onOpenTransactionHistory}
      />,
    );

    fireEvent.click(screen.getByTestId('button-dashboard-add-transaction'));
    fireEvent.click(screen.getByTestId('button-dashboard-transaction-history'));

    expect(onOpenAddTransaction).toHaveBeenCalledTimes(1);
    expect(onOpenTransactionHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Операции')).toBeTruthy();
  });

  it('preserves grouped transaction rows and date navigation', () => {
    const onOpenTransactionHistory = vi.fn();

    render(
      <TransactionsSection
        groupedTransactions={[['2026-09-19', [transaction]]]}
        hasTransactions
        categories={[]}
        accounts={[account]}
        onOpenTransactionHistory={onOpenTransactionHistory}
      />,
    );

    expect(screen.getByText('Покупка')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Открыть операции за/ }));

    expect(onOpenTransactionHistory).toHaveBeenCalledWith(expect.objectContaining({
      startDate: '2026-09-19',
      endDate: '2026-09-19',
    }));
  });
});