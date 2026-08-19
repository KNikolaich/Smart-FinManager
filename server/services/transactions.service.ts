import { prisma } from "../prisma";

export interface TransactionListFilters {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  type?: string;
  accountIds?: string[];
  categoryIds?: string[];
  search?: string;
  searchCategoryIds?: string[];
  searchAccountIds?: string[];
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
// Sentinel used by legacy (unpaginated) callers that need every matching
// row, e.g. AI context building or exports. Not subject to MAX_PAGE_SIZE.
const UNPAGINATED = Symbol("unpaginated");

export async function listTransactions(
  userId: string,
  filters: TransactionListFilters & { unpaginated?: typeof UNPAGINATED } = {}
) {
  const isUnpaginated = filters.pageSize === (UNPAGINATED as any);
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = isUnpaginated
    ? undefined
    : Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));

  const where: any = { userId };

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) {
      // Make the end date inclusive of the whole day rather than just its
      // midnight instant, which previously excluded same-day transactions.
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (filters.type && filters.type !== 'all') {
    where.type = filters.type;
  }

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    where.categoryId = { in: filters.categoryIds };
  }

  if (filters.accountIds && filters.accountIds.length > 0) {
    where.OR = [
      { accountId: { in: filters.accountIds } },
      { targetAccountId: { in: filters.accountIds } },
    ];
  }

  if (filters.search) {
    // Build a subsequence regex: "корр" → "к.*о.*р.*р"
    // This lets PostgreSQL find fuzzy/out-of-order-character matches (typos)
    // in addition to the exact ILIKE substring match.
    const subseqPattern = filters.search
      .toLowerCase()
      .split('')
      .map(c => c.replace(/[-[\]{}()*+?.\\^$|]/g, '\\$&'))
      .join('.*');

    // Fetch IDs of rows whose description matches the subsequence pattern.
    // Table is mapped to "transactions" (@@map); columns keep camelCase names.
    // Wrapped in try/catch so a regex syntax error never breaks the main search.
    let fuzzyIds: string[] = [];
    try {
      const fuzzyRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "transactions"
        WHERE "userId" = ${userId}
          AND description ~* ${subseqPattern}
      `;
      fuzzyIds = fuzzyRows.map(r => r.id);
    } catch {
      // Fuzzy pre-query failed (e.g. invalid regex chars) — fall back to
      // exact ILIKE only, which is handled by the contains condition below.
    }

    const searchOr: any[] = [
      { description: { contains: filters.search, mode: 'insensitive' } },
      ...(fuzzyIds.length > 0 ? [{ id: { in: fuzzyIds } }] : []),
    ];
    if (filters.searchCategoryIds && filters.searchCategoryIds.length > 0) {
      searchOr.push({ categoryId: { in: filters.searchCategoryIds } });
    }
    if (filters.searchAccountIds && filters.searchAccountIds.length > 0) {
      searchOr.push({ targetAccountId: { in: filters.searchAccountIds } });
    }
    // Combine with any existing account OR-filter using AND, since Prisma
    // only allows one `OR` key per object.
    where.AND = [...(where.AND || []), { OR: searchOr }];
  }

  const [transactions, total, incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(isUnpaginated ? {} : { skip: (page - 1) * pageSize!, take: pageSize }),
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({ where: { ...where, type: 'income' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...where, type: 'expense' }, _sum: { amount: true } }),
  ]);

  return {
    transactions,
    total,
    page,
    pageSize: pageSize ?? total,
    totalPages: isUnpaginated ? 1 : Math.max(1, Math.ceil(total / pageSize!)),
    totalIncome: incomeAgg._sum.amount || 0,
    totalExpense: expenseAgg._sum.amount || 0,
  };
}

export const UNPAGINATED_SENTINEL = UNPAGINATED;

async function assertOwnedAccount(userId: string, accountId: string, label = "Счёт") {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) {
    const err: any = new Error(`${label} не найден`);
    err.status = 400;
    throw err;
  }
  return account;
}

async function assertOwnedCategory(userId: string, categoryId: string, label = "Категория") {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    const err: any = new Error(`${label} не найдена`);
    err.status = 400;
    throw err;
  }
  return category;
}

async function validateReferences(userId: string, { accountId, targetAccountId, categoryId, subcategoryId }: any) {
  const account = await assertOwnedAccount(userId, accountId, "Счёт");
  const targetAccount = targetAccountId
    ? await assertOwnedAccount(userId, targetAccountId, "Счёт получателя")
    : null;
  if (categoryId) {
    await assertOwnedCategory(userId, categoryId, "Категория");
  }
  if (subcategoryId) {
    await assertOwnedCategory(userId, subcategoryId, "Подкатегория");
  }
  return { account, targetAccount };
}

// Performs input-only conversion validation. The relationship between rate and
// credited amount is checked with the actual account currencies below.
export function parseConversionFields(type: string, numAmount: number, body: any): { targetAmount: number | null; exchangeRate: number | null } {
  const rawTarget = body.targetAmount;
  const rawRate = body.exchangeRate;
  const hasTarget = rawTarget !== undefined && rawTarget !== null && rawTarget !== '';
  const hasRate = rawRate !== undefined && rawRate !== null && rawRate !== '';

  if (!hasTarget && !hasRate) return { targetAmount: null, exchangeRate: null };

  if (type !== 'transfer') {
    const err: any = new Error("Курс и сумма зачисления допустимы только для переводов");
    err.status = 400;
    throw err;
  }

  // A converted transfer requires a real, distinct target account and a
  // strictly positive debit amount — otherwise the derived rate is undefined
  // or the credit/debit directions become inconsistent.
  if (!body.targetAccountId || body.targetAccountId === body.accountId) {
    const err: any = new Error("Для конверсионного перевода требуется отдельный счёт получателя");
    err.status = 400;
    throw err;
  }
  if (!isFinite(numAmount) || numAmount <= 0) {
    const err: any = new Error("Сумма перевода должна быть положительной");
    err.status = 400;
    throw err;
  }

  const targetAmount = hasTarget ? Number(rawTarget) : null;
  const exchangeRate = hasRate ? Number(rawRate) : null;

  if (targetAmount !== null && (!isFinite(targetAmount) || targetAmount <= 0)) {
    const err: any = new Error("Некорректная сумма зачисления");
    err.status = 400;
    throw err;
  }
  if (exchangeRate !== null && (!isFinite(exchangeRate) || exchangeRate <= 0)) {
    const err: any = new Error("Некорректный курс конвертации");
    err.status = 400;
    throw err;
  }

  return { targetAmount, exchangeRate };
}

function isRubleCurrency(value: string | null | undefined) {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'RUB' || normalized === 'RUR' || normalized === '₽';
}

async function accountRubleRate(account: { currency: string; currencyId: string | null }) {
  // The account UI persists currencyId and leaves the legacy `currency`
  // column at its database default ("RUB"). Match the frontend resolver:
  // currencyId is authoritative, then the legacy code/name/symbol, then RUB.
  let currency = account.currencyId
    ? await prisma.currency.findUnique({ where: { id: account.currencyId } })
    : null;
  if (!currency) {
    currency = await prisma.currency.findFirst({
      where: {
        OR: [
          { iso: { equals: account.currency, mode: 'insensitive' } },
          { currency: { equals: account.currency, mode: 'insensitive' } },
          { symbol: account.currency },
        ],
      },
    });
  }
  if (!currency && isRubleCurrency(account.currency)) return { rate: 1, isRuble: true };
  if (!currency || !Number.isFinite(currency.rate) || currency.rate <= 0) {
    const err: any = new Error(`Не найден корректный рублёвый курс для валюты счёта ${account.currency}`);
    err.status = 400;
    throw err;
  }
  return {
    rate: currency.rate,
    isRuble: isRubleCurrency(currency.iso) || isRubleCurrency(currency.symbol),
  };
}

// exchangeRate is the ruble price of one unit of the exchanged foreign
// currency: both RUB → USD and USD → RUB use 90 for "1 USD = 90 RUB".
// This is the authoritative target-amount calculation for every write path.
export async function resolveConversionFields(
  type: string,
  numAmount: number,
  body: any,
  sourceAccount: { currency: string; currencyId: string | null },
  targetAccount: { currency: string; currencyId: string | null } | null,
  options: { allowLegacyTransfer?: boolean } = {},
): Promise<{ targetAmount: number | null; exchangeRate: number | null }> {
  const parsed = parseConversionFields(type, numAmount, body);
  if (type !== 'transfer' || !targetAccount) {
    if (parsed.targetAmount === null && parsed.exchangeRate === null) return parsed;
    const err: any = new Error("Для конверсионного перевода требуется счёт получателя");
    err.status = 400;
    throw err;
  }

  const [source, target] = await Promise.all([accountRubleRate(sourceAccount), accountRubleRate(targetAccount)]);
  if (source.isRuble && target.isRuble) {
    if (parsed.targetAmount === null && parsed.exchangeRate === null) return parsed;
    const err: any = new Error("Курс конвертации нужен только для разных валют");
    err.status = 400;
    throw err;
  }
  if (parsed.targetAmount === null && parsed.exchangeRate === null && options.allowLegacyTransfer) {
    return parsed;
  }

  // If the target is RUB, the entered rate quotes the source currency.
  // Otherwise it quotes the bought target currency. When no manual quote is
  // supplied, always use the appropriate Currency.rate from the directory;
  // never derive a rate from client-provided targetAmount.
  const exchangeRate = parsed.exchangeRate ?? (target.isRuble ? source.rate : target.rate);
  const sourceRate = target.isRuble ? exchangeRate : source.rate;
  const targetRate = target.isRuble ? 1 : exchangeRate;
  const expectedTargetAmount = Math.round(numAmount * (sourceRate / targetRate) * 100) / 100;

  if (parsed.targetAmount !== null && Math.abs(parsed.targetAmount - expectedTargetAmount) > 0.01) {
    const err: any = new Error("Сумма зачисления не соответствует рублёвому курсу конвертации");
    err.status = 400;
    throw err;
  }
  return { targetAmount: parsed.targetAmount ?? expectedTargetAmount, exchangeRate };
}

// Amount credited to the target account of a transfer. Legacy transfers
// (created before cross-currency support) have no targetAmount and behave 1:1.
function creditedAmount(t: { amount: number; targetAmount?: number | null }): number {
  return t.targetAmount ?? t.amount;
}

export async function createTransaction(userId: string, body: any) {
  const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = body;
  const numAmount = Number(amount);

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    const err: any = new Error("Сумма операции должна быть положительной");
    err.status = 400;
    throw err;
  }

  const { account, targetAccount } = await validateReferences(userId, { accountId, targetAccountId, categoryId, subcategoryId });
  const { targetAmount, exchangeRate } = await resolveConversionFields(type, numAmount, body, account, targetAccount);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId,
        targetAccountId: targetAccountId || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        amount: numAmount,
        targetAmount: type === 'transfer' ? targetAmount : null,
        exchangeRate: type === 'transfer' ? exchangeRate : null,
        type,
        description: description || '',
        createdAt: createdAt ? new Date(createdAt) : new Date()
      },
    });

    if (type === 'expense') {
      await tx.account.updateMany({
        where: { id: accountId, userId },
        data: { balance: { decrement: numAmount } }
      });
    } else if (type === 'income') {
      await tx.account.updateMany({
        where: { id: accountId, userId },
        data: { balance: { increment: numAmount } }
      });
    } else if (type === 'transfer' && targetAccountId) {
      await tx.account.updateMany({
        where: { id: accountId, userId },
        data: { balance: { decrement: numAmount } }
      });
      await tx.account.updateMany({
        where: { id: targetAccountId, userId },
        data: { balance: { increment: targetAmount ?? numAmount } }
      });
    }

    return transaction;
  });
}

export async function deleteTransaction(userId: string, id: string) {
  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) {
    const err: any = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    if (transaction.type === 'expense') {
      await tx.account.updateMany({
        where: { id: transaction.accountId, userId },
        data: { balance: { increment: transaction.amount } }
      });
    } else if (transaction.type === 'income') {
      await tx.account.updateMany({
        where: { id: transaction.accountId, userId },
        data: { balance: { decrement: transaction.amount } }
      });
    } else if (transaction.type === 'transfer' && transaction.targetAccountId) {
      await tx.account.updateMany({
        where: { id: transaction.accountId, userId },
        data: { balance: { increment: transaction.amount } }
      });
      await tx.account.updateMany({
        where: { id: transaction.targetAccountId, userId },
        data: { balance: { decrement: creditedAmount(transaction) } }
      });
    }

    await tx.transaction.deleteMany({ where: { id, userId } });
  });
}

export async function updateTransaction(userId: string, id: string, body: any) {
  const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = body;
  const numAmount = Number(amount);

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    const err: any = new Error("Сумма операции должна быть положительной");
    err.status = 400;
    throw err;
  }

  const oldTransaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!oldTransaction) {
    const err: any = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }

  const { account, targetAccount } = await validateReferences(userId, { accountId, targetAccountId, categoryId, subcategoryId });
  const { targetAmount, exchangeRate } = await resolveConversionFields(type, numAmount, body, account, targetAccount);

  return prisma.$transaction(async (tx) => {
    // 1. Revert old balance changes
    if (oldTransaction.type === 'expense') {
      await tx.account.updateMany({
        where: { id: oldTransaction.accountId, userId },
        data: { balance: { increment: oldTransaction.amount } }
      });
    } else if (oldTransaction.type === 'income') {
      await tx.account.updateMany({
        where: { id: oldTransaction.accountId, userId },
        data: { balance: { decrement: oldTransaction.amount } }
      });
    } else if (oldTransaction.type === 'transfer' && oldTransaction.targetAccountId) {
      await tx.account.updateMany({
        where: { id: oldTransaction.accountId, userId },
        data: { balance: { increment: oldTransaction.amount } }
      });
      await tx.account.updateMany({
        where: { id: oldTransaction.targetAccountId, userId },
        data: { balance: { decrement: creditedAmount(oldTransaction) } }
      });
    }

    // 2. Update transaction
    const updatedTransaction = await tx.transaction.update({
      where: { id },
      data: {
        accountId,
        targetAccountId: targetAccountId || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        amount: numAmount,
        targetAmount: type === 'transfer' ? targetAmount : null,
        exchangeRate: type === 'transfer' ? exchangeRate : null,
        type,
        description: description || '',
        createdAt: createdAt ? new Date(createdAt) : new Date()
      },
    });

    // 3. Apply new balance changes
    if (type === 'expense') {
      await tx.account.updateMany({
        where: { id: accountId, userId },
        data: { balance: { decrement: numAmount } }
      });
    } else if (type === 'income') {
      await tx.account.updateMany({
        where: { id: accountId, userId },
        data: { balance: { increment: numAmount } }
      });
    } else if (type === 'transfer' && targetAccountId) {
      await tx.account.updateMany({
        where: { id: accountId, userId },
        data: { balance: { decrement: numAmount } }
      });
      await tx.account.updateMany({
        where: { id: targetAccountId, userId },
        data: { balance: { increment: targetAmount ?? numAmount } }
      });
    }

    return updatedTransaction;
  });
}
