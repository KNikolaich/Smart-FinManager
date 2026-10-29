import { Copy, Repeat, Trash2 } from 'lucide-react';
import { Transaction } from '../../types';
import { getSimilarTransactionData, SimilarTransactionData } from '../../lib/transactionActions';
import { GenericContextMenu } from './GenericContextMenu';

interface TransactionContextMenuProps {
  x: number;
  y: number;
  transaction: Transaction;
  onClose: () => void;
  onSimilar: (data: SimilarTransactionData) => void;
  /** Opens the new-plan form prefilled from this operation; hidden when absent. */
  onMakeRecurring?: (transaction: Transaction) => void;
  onDelete: () => void;
}

export function TransactionContextMenu({
  x,
  y,
  transaction,
  onClose,
  onSimilar,
  onMakeRecurring,
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
        ...(onMakeRecurring ? [{
          label: 'Сделать регулярной',
          icon: Repeat,
          onClick: () => onMakeRecurring(transaction),
        }] : []),
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