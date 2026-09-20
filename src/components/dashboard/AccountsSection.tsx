import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Account, Currency } from '../../types';
import { Coins, CreditCard, Edit2, List, Tag, TrendingUp, Wallet, Landmark } from 'lucide-react';
import { CoinStack } from '../CustomIcons';
import AccountManager from '../AccountManager';
import CategoryManager from '../CategoryManager';
import BalanceManager from '../BalanceManager';
import { CurrencyTable } from '../CurrencyTable';
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
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showBalanceManager, setShowBalanceManager] = useState(false);
  const [showCurrencyTable, setShowCurrencyTable] = useState(false);
  const [initialEditingAccountId, setInitialEditingAccountId] = useState<string | null>(null);
  const [accountContextMenu, setAccountContextMenu] = useState<{ x: number, y: number, account: Account } | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-theme-base bg-theme-surface p-4"
      data-testid="dashboard-accounts"
    >
      <header className="flex items-center justify-between gap-2 border-b border-theme-base pb-2">
        <button
          type="button"
          aria-label="Открыть список счетов"
          data-testid="button-dashboard-account-list"
          onClick={() => setShowAccountManager(true)}
          className="min-w-0 inline-flex items-center gap-2 rounded-lg text-theme-muted hover:text-theme-primary active:scale-95 transition-all text-left"
        >
          <span className="text-[15px] uppercase tracking-wider font-bold truncate">Счета</span>
          <List size={16} className="shrink-0" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Открыть список категорий"
            title="Список категорий"
            data-testid="button-dashboard-category-list"
            onClick={() => setShowCategoryManager(true)}
            className="w-8 h-8 rounded-lg text-theme-muted flex items-center justify-center hover:bg-theme-main hover:text-theme-primary active:scale-95 transition-all"
          >
            <Tag size={16} />
          </button>
          <button
            type="button"
            aria-label="Открыть баланс"
            title="Баланс"
            data-testid="button-dashboard-balance"
            onClick={() => setShowBalanceManager(true)}
            className="w-8 h-8 rounded-lg text-theme-muted flex items-center justify-center hover:bg-theme-main hover:text-theme-primary active:scale-95 transition-all"
          >
            <TrendingUp size={16} />
          </button>
          <button
            type="button"
            aria-label="Открыть валюты"
            title="Валюты"
            data-testid="button-dashboard-currencies"
            onClick={() => setShowCurrencyTable(true)}
            className="w-8 h-8 rounded-lg text-theme-muted flex items-center justify-center hover:bg-theme-main hover:text-theme-primary active:scale-95 transition-all"
          >
            <Coins size={16} />
          </button>
        </div>
      </header>
      <div className="mt-3 -mx-2 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto pb-1 px-2 no-scrollbar snap-x snap-mandatory">
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
                  <div className="absolute top-3 right-3 text-[10px] font-bold text-theme-muted opacity-60">
                    {currencies.find(c => c.iso === account.currency)?.symbol || account.currency}
                  </div>

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
      {showCategoryManager && (
        <CategoryManager
          onClose={() => setShowCategoryManager(false)}
          onRefresh={onRefresh}
        />
      )}
      {showBalanceManager && (
        <BalanceManager
          onClose={() => setShowBalanceManager(false)}
          onRefresh={async () => { await onRefresh?.(); }}
        />
      )}
      {showCurrencyTable && (
        <CurrencyTable onClose={() => setShowCurrencyTable(false)} />
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
