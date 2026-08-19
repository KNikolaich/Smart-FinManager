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

// Currency.rate is the price of one currency unit in rubles. Accounts created
// before `currencyId` was introduced may only have the currency code/symbol.
export function accountCurrencyRate(account: Account | undefined, currencies: Currency[]): number {
  const rate = findAccountCurrency(account, currencies)?.rate;
  return Number.isFinite(rate) && rate! > 0 ? rate! : 1;
}

export function isRubleAccount(account: Account | undefined, currencies: Currency[]): boolean {
  const currency = findAccountCurrency(account, currencies);
  const values = [currency?.iso, currency?.symbol, account?.currency]
    .filter(Boolean)
    .map(value => String(value).trim().toUpperCase());
  return values.includes('RUB') || values.includes('RUR') || values.includes('₽');
}

// The exchange rate entered for a transfer is always the ruble price of one
// unit of the foreign currency. For RUB → USD this is USD.rate (for example
// 90), rather than the inverse 0.011. When a transfer ends in rubles, the
// source is that foreign currency; otherwise the target is the bought
// currency. This also gives a useful quote for foreign → foreign transfers.
export function defaultTransferRate(source: Account | undefined, target: Account | undefined, currencies: Currency[]): number {
  if (!isCrossCurrency(source, target, currencies)) return 1;
  return isRubleAccount(target, currencies)
    ? accountCurrencyRate(source, currencies)
    : accountCurrencyRate(target, currencies);
}

// Multiplier from an amount on the source account to an amount on the target
// account. `rubleRate` is the editable quote returned by defaultTransferRate.
export function transferAmountMultiplier(
  source: Account | undefined,
  target: Account | undefined,
  currencies: Currency[],
  rubleRate: number
): number {
  const sourceRubleRate = isRubleAccount(target, currencies)
    ? rubleRate
    : accountCurrencyRate(source, currencies);
  const targetRubleRate = isRubleAccount(target, currencies)
    ? 1
    : rubleRate;
  return sourceRubleRate / targetRubleRate;
}

export function targetAmountFromSource(
  sourceAmount: number,
  source: Account | undefined,
  target: Account | undefined,
  currencies: Currency[],
  rubleRate: number
): number {
  return Math.round(sourceAmount * transferAmountMultiplier(source, target, currencies, rubleRate) * 100) / 100;
}

export function sourceAmountFromTarget(
  targetAmount: number,
  source: Account | undefined,
  target: Account | undefined,
  currencies: Currency[],
  rubleRate: number
): number {
  return Math.round((targetAmount / transferAmountMultiplier(source, target, currencies, rubleRate)) * 1e8) / 1e8;
}

// Converts a saved pair of amounts to the current quote convention. This
// keeps older transfers editable after the app switched away from an inverse
// target-per-source rate.
export function rubleRateFromTransferAmounts(
  sourceAmount: number,
  targetAmount: number | null | undefined,
  source: Account | undefined,
  target: Account | undefined,
  currencies: Currency[]
): number | null {
  if (!Number.isFinite(sourceAmount) || sourceAmount <= 0 || !Number.isFinite(targetAmount) || !targetAmount || targetAmount <= 0) {
    return null;
  }
  if (isRubleAccount(target, currencies)) return targetAmount / sourceAmount;
  return accountCurrencyRate(source, currencies) * sourceAmount / targetAmount;
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
