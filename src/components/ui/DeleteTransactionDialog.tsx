import { AlertTriangle } from 'lucide-react';
import { Transaction } from '../../types';

interface DeleteTransactionDialogProps {
  transaction: Transaction | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteTransactionDialog({
  transaction,
  deleting,
  onConfirm,
  onCancel,
}: DeleteTransactionDialogProps) {
  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => !deleting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-transaction-title"
        className="w-full max-w-sm rounded-3xl border border-theme-base bg-theme-surface p-6 text-center shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
          <AlertTriangle className="h-7 w-7 text-rose-500" />
        </div>
        <h3 id="delete-transaction-title" className="mt-4 text-lg font-black text-theme-main">
          Удалить операцию?
        </h3>
        <p className="mt-2 text-sm text-theme-muted">
          Это действие нельзя будет отменить. Баланс счёта будет пересчитан автоматически.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full rounded-2xl bg-rose-600 py-3.5 font-bold text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? 'Удаление...' : 'Да, удалить'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="w-full rounded-2xl bg-theme-main py-3.5 font-bold text-theme-muted transition-all hover:bg-theme-base disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}