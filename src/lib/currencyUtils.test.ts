import { describe, expect, it } from 'vitest';
import type { Account, Currency } from '../types';
import {
  defaultTransferRate,
  rubleRateFromTransferAmounts,
  sourceAmountFromTarget,
  targetAmountFromSource,
} from './currencyUtils';

const currencies: Currency[] = [
  { id: 'rub', currency: 'рубль', name: 'Рубль', iso: 'RUB', rate: 1, symbol: '₽' },
  { id: 'usd', currency: 'доллар', name: 'Доллар', iso: 'USD', rate: 90, symbol: '$' },
  { id: 'eur', currency: 'евро', name: 'Евро', iso: 'EUR', rate: 100, symbol: '€' },
];

function account(id: string, currencyId: string, currency: string): Account {
  return {
    id,
    userId: 'user',
    name: id,
    type: 'card',
    balance: 0,
    currencyId,
    currency,
    showOnDashboard: true,
    showInTotals: true,
  };
}

const rub = account('rub-account', 'rub', 'RUB');
const usd = account('usd-account', 'usd', 'USD');
const eur = account('eur-account', 'eur', 'EUR');

describe('ruble-denominated transfer quote', () => {
  it('uses the currency catalogue quote rather than its inverse for RUB → USD', () => {
    expect(defaultTransferRate(rub, usd, currencies)).toBe(90);
    expect(targetAmountFromSource(9_000, rub, usd, currencies, 90)).toBe(100);
    expect(sourceAmountFromTarget(100, rub, usd, currencies, 90)).toBe(9_000);
  });

  it('uses the same USD quote for USD → RUB', () => {
    expect(defaultTransferRate(usd, rub, currencies)).toBe(90);
    expect(targetAmountFromSource(100, usd, rub, currencies, 90)).toBe(9_000);
    expect(sourceAmountFromTarget(9_000, usd, rub, currencies, 90)).toBe(100);
  });

  it('applies a manually edited quote in both transfer directions', () => {
    expect(targetAmountFromSource(9_200, rub, usd, currencies, 92)).toBe(100);
    expect(targetAmountFromSource(100, usd, rub, currencies, 92)).toBe(9_200);
  });

  it('converts between two non-ruble currencies through their ruble prices', () => {
    // 100 USD × 90 RUB / 100 RUB per EUR = 90 EUR.
    expect(defaultTransferRate(usd, eur, currencies)).toBe(100);
    expect(targetAmountFromSource(100, usd, eur, currencies, 100)).toBe(90);
    expect(sourceAmountFromTarget(90, usd, eur, currencies, 100)).toBe(100);
  });

  it('normalizes older inverse RUB → USD records when opened for editing', () => {
    // A previously stored target-per-source value was 1/90. The saved amounts
    // still let us show the user the new, human-readable quote of 90 RUB/USD.
    expect(rubleRateFromTransferAmounts(9_000, 100, rub, usd, currencies)).toBe(90);
  });
});