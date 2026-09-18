import { Copy, Trash2 } from 'lucide-react';
import { Transaction } from '../../types';
import { getSimilarTransactionData, SimilarTransactionData } from '../../lib/transactionActions';
import { GenericContextMenu } from './GenericContextMenu';

interface TransactionContextMenuProps {
  x: number;
  y: number;
  transaction: Transaction;
  onClose: () => void;
  onSimilar: (data: SimilarTransactionData) => void;
  onDelete: () => void;
}

export function TransactionContextMenu({
  x,
  y,
  transaction,
  onClose,
  onSimilar,
  onDelete,
}: TransactionContextMenuProps) {
  return (
    <GenericContextMenu
      x={x}
      y={y}
      onClose={onClose}
      items={[
        {
          label: 'Добавить похожую',
          icon: Copy,
          onClick: () => onSimilar(getSimilarTransactionData(transaction)),
        },
        {
          label: 'Удалить',
          icon: Trash2,
          variant: 'danger',
          divider: true,
          onClick: onDelete,
        },
      ]}
    />
  );
}