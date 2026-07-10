import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Account, Category, Transaction } from '../../types';
import { ChevronRight, Plus, Copy } from 'lucide-react';
import { GenericContextMenu } from '../ui/GenericContextMenu';
import { cn, getTransactionDisplayTitle } from '../../lib/utils';

interface TransactionsSectionProps {
  groupedTransactions: [string, Transaction[]][];
  hasTransactions: boolean;
  categories: Category[];
  accounts: Account[];
  onOpenTransactionHistory?: (filterProps?: any) => void;
  onOpenAddTransaction?: (initialData?: any) => void;
  onEditTransaction?: (t: Transaction) => void;
}

export function TransactionsSection({
  groupedTransactions,
  hasTransactions,
  categories,
  accounts,
  onOpenTransactionHistory,
  onOpenAddTransaction,
  onEditTransaction
}: TransactionsSectionProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, transaction: Transaction } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleContextMenuAction = (action: 'create' | 'copy') => {
    if (!contextMenu) return;

    if (action === 'create') {
      onOpenAddTransaction?.({
        createdAt: new Date().toISOString()
      });
    } else if (action === 'copy') {
      const t = contextMenu.transaction;
      onOpenAddTransaction?.({
        type: t.type,
        amount: t.amount,
        accountId: t.accountId,
        categoryId: t.categoryId,
        description: t.description,
        targetAccountId: t.targetAccountId,
        createdAt: new Date().toISOString()
      });
    }
  };

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            if (onOpenTransactionHistory) onOpenTransactionHistory();
          }}
          className="group flex items-center gap-2"
        >
          <h3 className="font-bold text-lg text-theme-main group-hover:text-theme-primary transition-colors" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)' }}>Операции</h3>
          <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-theme-primary transition-all group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => {
            if (onOpenAddTransaction) onOpenAddTransaction();
          }}
          className="flex items-center justify-center w-8 h-8 bg-theme-primary/10 border-2 border-theme-primary text-theme-primary rounded-full hover:bg-theme-primary hover:text-theme-on-primary shadow-md shadow-theme-primary/20 active:scale-95 transition-all font-bold"
          title="Добавить операцию"
        >
          <Plus size={18} strokeWidth={3} />
        </button>
      </div>
      <div className="bg-theme-surface rounded-3xl border border-theme-base overflow-hidden shadow-soft">
        {groupedTransactions.map(([dateKey, txs], groupIndex) => (
          <motion.div
            key={dateKey}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + (groupIndex * 0.05) }}
          >
            <div className="px-4 py-2 bg-theme-primary/5 backdrop-blur-md text-[10px] font-bold text-theme-primary uppercase tracking-widest border-y border-neutral-100">
              {dateKey}
            </div>
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
                          t.type === 'income' ? "text-emerald-500" :
                          t.type === 'transfer' ? "text-blue-500" :
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
        ))}
        {!hasTransactions && (
          <div className="text-center py-8">
            <p className="text-theme-muted text-sm italic">Операций пока нет</p>
          </div>
        )}
      </div>

      {contextMenu && (
        <GenericContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Добавить похожую',
              icon: Plus,
              onClick: () => handleContextMenuAction('create')
            },
            {
              label: 'Копировать операцию',
              icon: Copy,
              onClick: () => handleContextMenuAction('copy')
            }
          ]}
        />
      )}
    </section>
  );
}
