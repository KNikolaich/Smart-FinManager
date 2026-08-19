import { Account, Currency } from '../types';

// Accounts historically store their currency loosely: `currencyId` (preferred),
// or `currency` holding an ISO code ("USD"), a symbol ("₽") or a free-form
// name. Resolve to the Currency record when possible.
export function findAccountCurrency(account: Account | undefined, currencies: Currency[]): Currency | undefined {
  if (!account) return undefined;
  if (account.currencyId) {
    const byId = currencies.find(c => c.id === account.currencyId);
    if (byId) return byId;
  }
  const raw = (account.currency || '').trim();
  if (!raw) return undefined;
  return currencies.find(c => c.iso === raw)
    || currencies.find(c => c.symbol === raw)
    || currencies.find(c => c.currency === raw);
}

// Display symbol for an account's currency; falls back to the raw account
// currency string, then to the ruble sign.
export function accountCurrencySymbol(account: Account | undefined, currencies: Currency[]): string {
  const cur = findAccountCurrency(account, currencies);
  return cur?.symbol || cur?.iso || account?.currency || '₽';
}

// True when a transfer between the two accounts crosses currencies.
export function isCrossCurrency(source: Account | undefined, target: Account | undefined, currencies: Currency[]): boolean {
  const s = accountCurrencySymbol(source, currencies);
  const t = accountCurrencySymbol(target, currencies);
  return s !== t;
}

// Default exchange rate for source → target (target units per 1 source unit),
// derived from the currency directory where Currency.rate is RUB per unit.
// Returns 1 when either side is unknown or the currencies match.
export function defaultTransferRate(source: Account | undefined, target: Account | undefined, currencies: Currency[]): number {
  if (!isCrossCurrency(source, target, currencies)) return 1;
  const sCur = findAccountCurrency(source, currencies);
  const tCur = findAccountCurrency(target, currencies);
  // Unresolved side is treated as RUB (rate 1), matching the app-wide default.
  const sRate = sCur?.rate && sCur.rate > 0 ? sCur.rate : 1;
  const tRate = tCur?.rate && tCur.rate > 0 ? tCur.rate : 1;
  return sRate / tRate;
}

// Display formatting for the raw amount-input string: groups the integer part
// with spaces (ru-RU) while preserving the typed decimal part.
export function formatAmountInputDisplay(raw: string): string {
  if (!raw) return '';
  const [intPart, fracPart] = raw.split('.');
  const grouped = intPart ? Number(intPart).toLocaleString('ru-RU') : '';
  return fracPart !== undefined ? `${grouped},${fracPart}` : grouped;
}

// Compact number formatting for amounts shown next to currency symbols.
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}
