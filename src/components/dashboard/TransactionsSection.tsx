import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Account, Category, Transaction } from '../../types';
import { List, Plus } from 'lucide-react';
import { cn, getTransactionDisplayTitle } from '../../lib/utils';
import { dateFromKey, formatTransactionDateHeading } from '../../lib/dateLabels';
import { api } from '../../lib/api';
import { TransactionContextMenu } from '../ui/TransactionContextMenu';
import { DeleteTransactionDialog } from '../ui/DeleteTransactionDialog';

interface TransactionsSectionProps {
  groupedTransactions: [string, Transaction[]][];
  hasTransactions: boolean;
  categories: Category[];
  accounts: Account[];
  onOpenTransactionHistory?: (filterProps?: any) => void;
  onOpenAddTransaction?: (initialData?: any) => void;
  onEditTransaction?: (t: Transaction) => void;
  onRefresh?: () => void | Promise<void>;
  className?: string;
}

export function TransactionsSection({
  groupedTransactions,
  hasTransactions,
  categories,
  accounts,
  onOpenTransactionHistory,
  onOpenAddTransaction,
  onEditTransaction,
  onRefresh,
  className,
}: TransactionsSectionProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, transaction: Transaction } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleDeleteTransaction = async () => {
    if (!deleteConfirmation) return;

    const transaction = deleteConfirmation;
    setDeletingTransaction(true);
    try {
      await api.delete(`/transactions/${transaction.id}`);
      setDeleteConfirmation(null);
      await onRefresh?.();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setDeletingTransaction(false);
    }
  };

  return (
    <section className={cn("h-full rounded-2xl border border-theme-base bg-theme-surface p-4", className)} data-testid="dashboard-transactions">
      <header className="flex items-center justify-between gap-2 border-b border-theme-base pb-2">
        <button
          type="button"
          onClick={() => onOpenTransactionHistory?.()}
          aria-label="Открыть историю операций"
          data-testid="button-dashboard-transaction-history"
          className="min-w-0 inline-flex items-center gap-2 rounded-lg text-theme-muted hover:text-theme-primary active:scale-95 transition-all text-left"
        >
          <span className="text-[15px] uppercase tracking-wider font-bold truncate">Операции</span>
          <List size={16} className="shrink-0" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenAddTransaction?.()}
            aria-label="Добавить операцию"
            data-testid="button-dashboard-add-transaction"
            className="w-8 h-8 rounded-lg bg-theme-primary-light text-theme-primary flex items-center justify-center hover:bg-theme-primary hover:text-theme-on-primary active:scale-95 transition-all"
            title="Добавить операцию"
          >
            <Plus size={16} />
          </button>
        </div>
      </header>
      <div className="mt-3 -mx-4 -mb-4 overflow-hidden">
        {groupedTransactions.map(([dateKey, txs], groupIndex) => {
          const heading = formatTransactionDateHeading(dateKey);
          return (
          <motion.div
            key={dateKey}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + (groupIndex * 0.05) }}
          >
            <button
              onClick={() => onOpenTransactionHistory?.({
                startDate: dateKey,
                endDate: dateKey,
                selectedMonth: dateFromKey(dateKey),
              })}
              className="w-full px-4 py-2 bg-theme-primary/5 backdrop-blur-md text-left border-y border-neutral-100 hover:bg-theme-primary/10 active:bg-theme-primary/15 transition-colors"
              aria-label={`Открыть операции за ${heading.date}`}
            >
              <span className="text-[10px] font-bold text-theme-primary uppercase tracking-widest">{heading.date}</span>
              <span className="ml-2 text-[10px] font-semibold text-theme-muted normal-case tracking-normal">
                {heading.weekday} · {heading.relative}
              </span>
            </button>
            <table className="w-full text-left border-collapse table-fixed">
              <tbody>
                {txs.map(t => {
                  const category = categories.find(c => c.id === t.categoryId);
                  const parentCategory = category?.parentId ? categories.find(c => c.id === category.parentId) : category;
                  const account = accounts.find(a => a.id === t.accountId);
                  const targetAccount = t.targetAccountId ? accounts.find(a => a.id === t.targetAccountId) : null;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => {
                        if (onEditTransaction) onEditTransaction(t);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, transaction: t });
                      }}
                      onPointerDown={(e) => {
                        const x = e.clientX;
                        const y = e.clientY;
                        longPressTimer.current = setTimeout(() => {
                          setContextMenu({ x, y, transaction: t });
                        }, 600);
                      }}
                      onPointerUp={() => {
                        if (longPressTimer.current) clearTimeout(longPressTimer.current);
                      }}
                      onPointerMove={() => {
                        if (longPressTimer.current) clearTimeout(longPressTimer.current);
                      }}
                      className="hover:bg-theme-primary/5 active:bg-theme-primary/10 transition-colors cursor-pointer select-none"
                    >
                      <td className="pl-4 pr-2 py-1.5 align-top">
                        <div className="flex items-start gap-2">
                          <span className="text-lg shrink-0">{t.type === 'transfer' ? '🔄' : (category?.icon || parentCategory?.icon || '💰')}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-theme-main truncate">{getTransactionDisplayTitle(t.description, category?.name, t.type)}</p>
                            <p
                              className="text-[10px] font-medium truncate"
                              style={{ color: account?.color && account.color !== '#000000' ? account.color : 'var(--text-muted)' }}
                            >
                              {account?.name || 'Счет'}
                              {targetAccount && ` → ${targetAccount.name}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={cn(
                        "px-4 py-1.5 align-top w-1/2",
                        t.type === 'income' ? "text-left" :
                        t.type === 'transfer' ? "text-center" :
                        "text-right"
                      )}>
                        <p className={cn(
                          "text-xs font-bold",
                          t.type === 'income' ? "text-finance-income" :
                          t.type === 'transfer' ? "text-finance-transfer" :
                          "text-theme-main"
                        )}>
                          {t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'}{t.amount.toLocaleString()} ₽
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )})}
        {!hasTransactions && (
          <div className="text-center py-8">
            <p className="text-theme-muted text-sm italic">Операций пока нет</p>
          </div>
        )}
      </div>

      {contextMenu && (
        <TransactionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          transaction={contextMenu.transaction}
          onClose={() => setContextMenu(null)}
          onSimilar={data => onOpenAddTransaction?.(data)}
          onDelete={() => setDeleteConfirmation(contextMenu.transaction)}
        />
      )}

      <DeleteTransactionDialog
        transaction={deleteConfirmation}
        deleting={deletingTransaction}
        onConfirm={handleDeleteTransaction}
        onCancel={() => setDeleteConfirmation(null)}
      />
    </section>
  );
}
