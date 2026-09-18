import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Transaction } from '../../types';
import { TransactionContextMenu } from './TransactionContextMenu';

describe('TransactionContextMenu', () => {
  const transaction: Transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    accountId: 'account-1',
    targetAccountId: 'account-2',
    categoryId: 'category-1',
    subcategoryId: 'subcategory-1',
    amount: 1250,
    targetAmount: 1375,
    exchangeRate: 1.1,
    type: 'transfer',
    description: 'Обед',
    createdAt: '2026-09-18T12:30:00.000Z',
  };

  it('shows only similar and delete actions', () => {
    render(
      <TransactionContextMenu
        x={100}
        y={100}
        transaction={transaction}
        onClose={vi.fn()}
        onSimilar={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Добавить похожую' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy();
    expect(screen.queryByText('Добавить по текущему фильтру')).toBeNull();
    expect(screen.queryByText('Сделать похожую')).toBeNull();
    expect(screen.queryByText('Копировать операцию')).toBeNull();
  });

  it('passes the complete transaction data to the similar action', () => {
    const onSimilar = vi.fn();

    render(
      <TransactionContextMenu
        x={100}
        y={100}
        transaction={transaction}
        onClose={vi.fn()}
        onSimilar={onSimilar}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Добавить похожую' }));

    expect(onSimilar).toHaveBeenCalledWith({
      type: 'transfer',
      amount: 1250,
      targetAmount: 1375,
      exchangeRate: 1.1,
      accountId: 'account-1',
      targetAccountId: 'account-2',
      categoryId: 'category-1',
      subcategoryId: 'subcategory-1',
      description: 'Обед',
      createdAt: '2026-09-18T12:30:00.000Z',
    });
  });

  it('forwards delete to the shared confirmation flow', () => {
    const onDelete = vi.fn();

    render(
      <TransactionContextMenu
        x={100}
        y={100}
        transaction={transaction}
        onClose={vi.fn()}
        onSimilar={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});