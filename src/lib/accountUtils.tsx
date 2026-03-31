import { CreditCard, Wallet, Landmark, Coins } from 'lucide-react';
import { AccountType } from '../types';

export const getAccountIcon = (type: AccountType, className?: string) => {
  switch (type) {
    case 'card': return <CreditCard className={className} />;
    case 'credit': return <Wallet className={className} />;
    case 'bank': return <Landmark className={className} />;
    case 'cash': return <Coins className={className} />;
    default: return <Wallet className={className} />;
  }
};

export const getAccountTypeColor = (type: AccountType) => {
  switch (type) {
    case 'card': return 'text-blue-500';
    case 'credit': return 'text-rose-500';
    case 'bank': return 'text-emerald-500';
    case 'cash': return 'text-amber-500';
    default: return 'text-neutral-500';
  }
};
