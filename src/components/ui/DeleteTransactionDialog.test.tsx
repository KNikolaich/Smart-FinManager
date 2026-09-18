import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Transaction } from '../../types';
import { DeleteTransactionDialog } from './DeleteTransactionDialog';

describe('DeleteTransactionDialog', () => {
  const transaction: Transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    accountId: 'account-1',
    categoryId: 'category-1',
    amount: 100,
    type: 'expense',
    description: 'Покупка',
    createdAt: '2026-09-18T12:30:00.000Z',
  };

  it('requires confirmation before completing deletion', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DeleteTransactionDialog
        transaction={transaction}
        deleting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Да, удалить' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});