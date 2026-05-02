import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Account, AccountType, Transaction, TransactionType } from '../types';
import { getAccountIcon } from '../lib/accountUtils';
import { cn } from '../lib/utils';

interface AccountSelectProps {
  accounts: Account[];
  selectedAccountId: string;
  onChange: (id: string) => void;
  label: string;
  transactions?: Transaction[];
  type?: TransactionType;
}

const typeLabels: Record<AccountType, string> = {
  card: 'Карты',
  credit: 'Кредиты',
  cash: 'Наличные',
  bank: 'Банки'
};

const sortOrder: AccountType[] = ['card', 'credit', 'cash', 'bank'];

export default function AccountSelect({ accounts, selectedAccountId, onChange, label, transactions = [], type }: AccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpward, setIsUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      setIsUpward(rect.top > ((viewportHeight * 2) / 3));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedAccounts = useMemo(() => {
    if (!type || transactions.length === 0) return accounts;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const frequency: Record<string, number> = {};
    transactions
      .filter(t => t.type === type && new Date(t.createdAt) > oneMonthAgo)
      .forEach(t => {
        if (t.accountId) frequency[t.accountId] = (frequency[t.accountId] || 0) + 1;
        if (t.targetAccountId) frequency[t.targetAccountId] = (frequency[t.targetAccountId] || 0) + 1;
      });

    return [...accounts].sort((a, b) => (frequency[b.id] || 0) - (frequency[a.id] || 0));
  }, [accounts, transactions, type]);

  const groupedAccounts = useMemo(() => {
    const groups: Partial<Record<AccountType, Account[]>> = {};
    sortOrder.forEach(type => groups[type] = []);
    
    sortedAccounts.filter(a => !a.isArchived).forEach(acc => {
      if (groups[acc.type]) {
        groups[acc.type]!.push(acc);
      }
    });
    return groups;
  }, [sortedAccounts]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-[10px] font-bold text-theme-muted uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-theme-main border border-theme-base rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 ring-theme-primary/20 transition-all text-left font-semibold flex items-center justify-between text-theme-main"
        >
          {selectedAccount ? (
            <div className="flex items-center gap-2">
              <div style={{ color: selectedAccount.color }}>{getAccountIcon(selectedAccount.type, "w-4 h-4")}</div>
              {selectedAccount.name}
            </div>
          ) : (
            <span className="text-theme-muted">Выберите счет</span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-theme-muted transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className={cn(
            "absolute z-50 w-full bg-theme-surface border border-theme-base rounded-xl shadow-xl max-h-60 overflow-y-auto no-scrollbar",
            isUpward ? "bottom-full mb-1" : "top-full mt-1"
          )}>
            {sortOrder.map(type => {
              const accs = groupedAccounts[type];
              if (!accs || accs.length === 0) return null;
              return (
                <div key={type}>
                  <div className="px-4 py-1 text-[9px] font-bold text-theme-muted uppercase tracking-wider bg-theme-main">
                    {typeLabels[type]}
                  </div>
                  {accs.map(acc => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        onChange(acc.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-theme-main transition-colors",
                        selectedAccountId === acc.id && "bg-theme-primary/10"
                      )}
                    >
                      <div style={{ color: acc.color }}>{getAccountIcon(acc.type, "w-4 h-4")}</div>
                      <span className="font-semibold text-theme-main">{acc.name}</span>
                      <span className="ml-auto text-theme-muted text-xs">{acc.balance.toLocaleString()} {acc.currency}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
