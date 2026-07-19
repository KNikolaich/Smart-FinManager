import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Account, Currency } from '../../types';
import { Wallet, ChevronRight, CreditCard, Landmark, Edit2 } from 'lucide-react';
import { CoinStack } from '../CustomIcons';
import AccountManager from '../AccountManager';
import { GenericContextMenu } from '../ui/GenericContextMenu';
import { cn } from '../../lib/utils';

interface AccountsSectionProps {
  accounts: Account[];
  allAccounts: Account[];
  currencies: Currency[];
  onOpenTransactionHistory?: (filterProps?: any) => void;
  onRefresh?: () => void;
}

// Badge shown only when account has a comment.
// Desktop: CSS hover tooltip. Mobile: tap toggles popup.
function CommentBadge({ comment, color, isNegative }: { comment: string; color?: string; isNegative: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasColor = color && color !== '#000000';

  const badgeStyle = hasColor ? { backgroundColor: `${color}DD` } : {};
  const badgeClass = !hasColor ? (isNegative ? 'bg-rose-500' : 'bg-theme-primary') : '';

  return (
    // sits right below the currency symbol — absolute, so takes no space
    <div className="absolute top-[26px] right-2.5 z-10">
      <div className="relative group">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMobileOpen(o => !o); }}
          className={cn(
            'w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm cursor-pointer',
            badgeClass
          )}
          style={badgeStyle}
          aria-label="Комментарий к счёту"
        >
          <span className="text-white font-black leading-none select-none" style={{ fontSize: '8px' }}>!</span>
        </button>

        {/* Desktop tooltip — pure CSS hover, no JS needed */}
        <div className="hidden sm:block absolute right-0 top-5 z-50 pointer-events-none
                        opacity-0 group-hover:opacity-100 transition-opacity duration-150
                        w-max max-w-[160px] bg-theme-surface border border-theme-base
                        rounded-xl px-2.5 py-1.5 shadow-lg text-[11px] text-theme-main leading-snug">
          {comment}
        </div>

        {/* Mobile popup — toggled on tap */}
        {mobileOpen && (
          <div
            className="sm:hidden absolute right-0 top-5 z-50
                       w-max max-w-[160px] bg-theme-surface border border-theme-base
                       rounded-xl px-2.5 py-1.5 shadow-lg text-[11px] text-theme-main leading-snug"
            onClick={(e) => e.stopPropagation()}
          >
            {comment}
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountsSection({ accounts, allAccounts, currencies, onOpenTransactionHistory, onRefresh }: AccountsSectionProps) {
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [initialEditingAccountId, setInitialEditingAccountId] = useState<string | null>(null);
  const [accountContextMenu, setAccountContextMenu] = useState<{ x: number, y: number, account: Account } | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="p-[1px] mb-6"
    >
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setShowAccountManager(true)}
          className="group flex items-center gap-2"
        >
          <h3 className="font-bold text-lg text-theme-main group-hover:text-theme-primary transition-colors" style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)' }}>Счета</h3>
          <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-theme-primary transition-all group-hover:translate-x-1" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4 mx-0 px-2 no-scrollbar snap-x snap-mandatory">
        <AnimatePresence>
          {accounts.map((account, index) => {
            const isNegative = account.balance < 0;
            const Icon = account.type === 'card' ? CreditCard : account.type === 'bank' ? Landmark : account.type === 'cash' ? CoinStack : Wallet;
            const hasColor = account.color && account.color !== '#000000';

            return (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  if (onOpenTransactionHistory) onOpenTransactionHistory(account.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAccountContextMenu({ x: e.clientX, y: e.clientY, account });
                }}
                className={cn(
                  "min-w-[100px] flex-shrink-0 bg-theme-surface p-3 rounded-2xl border transition-all duration-300 snap-start relative cursor-pointer group shadow-sm",
                  isNegative
                    ? "border-rose-500/30 hover:shadow-rose-500/10 hover:bg-rose-500/5"
                    : "border-theme-base hover:shadow-theme-primary/10 hover:bg-theme-primary/5"
                )}
              >
                {/* Currency symbol */}
                <div className="absolute top-3 right-3 text-[10px] font-bold text-theme-muted opacity-60">
                  {currencies.find(c => c.iso === account.currency)?.symbol || account.currency}
                </div>

                {/* Comment badge — sits just below the currency symbol */}
                {account.comment && (
                  <CommentBadge
                    comment={account.comment}
                    color={account.color}
                    isNegative={isNegative}
                  />
                )}

                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110",
                    !hasColor && (isNegative ? "bg-rose-500/10" : "bg-theme-primary/10")
                  )}
                  style={hasColor ? { backgroundColor: `${account.color}20` } : {}}
                >
                  <Icon
                    className={cn("w-5 h-5", !hasColor && (isNegative ? "text-rose-500" : "text-theme-primary"))}
                    style={hasColor ? { color: account.color } : {}}
                  />
                </div>
                <p className="text-theme-muted group-hover:text-theme-main text-[10px] font-bold uppercase tracking-wide mb-1 truncate transition-colors">{account.name}</p>
                <p className={cn("font-bold text-base truncate", isNegative ? "text-rose-500" : "text-theme-main")}>
                  {account.balance.toLocaleString()}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {accounts.length === 0 && (
          <p className="text-theme-muted text-sm italic">Нет добавленных счетов</p>
        )}
      </div>

      {showAccountManager && (
        <AccountManager
          accounts={allAccounts}
          onClose={() => {
            setShowAccountManager(false);
            setInitialEditingAccountId(null);
          }}
          onRefresh={onRefresh}
          initialEditingId={initialEditingAccountId}
        />
      )}

      {accountContextMenu && (
        <GenericContextMenu
          x={accountContextMenu.x}
          y={accountContextMenu.y}
          onClose={() => setAccountContextMenu(null)}
          items={[
            {
              label: 'Изменить счет',
              icon: Edit2,
              onClick: () => {
                setInitialEditingAccountId(accountContextMenu.account.id);
                setShowAccountManager(true);
              }
            }
          ]}
        />
      )}
    </motion.section>
  );
}
