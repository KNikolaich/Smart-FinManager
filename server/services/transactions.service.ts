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
    const searchOr: any[] = [
      { description: { contains: filters.search, mode: 'insensitive' } },
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

export async function createTransaction(userId: string, body: any) {
  const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = body;
  const numAmount = Number(amount);

  if (isNaN(numAmount)) {
    const err: any = new Error("Invalid amount");
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId,
        targetAccountId: targetAccountId || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        amount: numAmount,
        type,
        description: description || '',
        createdAt: createdAt ? new Date(createdAt) : new Date()
      },
    });

    if (type === 'expense') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
    } else if (type === 'income') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: numAmount } }
      });
    } else if (type === 'transfer' && targetAccountId) {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
      await tx.account.update({
        where: { id: targetAccountId },
        data: { balance: { increment: numAmount } }
      });
    }

    return transaction;
  });
}

export async function deleteTransaction(id: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction) {
    const err: any = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    if (transaction.type === 'expense') {
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: transaction.amount } }
      });
    } else if (transaction.type === 'income') {
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { decrement: transaction.amount } }
      });
    } else if (transaction.type === 'transfer' && transaction.targetAccountId) {
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: transaction.amount } }
      });
      await tx.account.update({
        where: { id: transaction.targetAccountId },
        data: { balance: { decrement: transaction.amount } }
      });
    }

    await tx.transaction.delete({ where: { id } });
  });
}

export async function updateTransaction(id: string, body: any) {
  const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = body;
  const numAmount = Number(amount);

  if (isNaN(numAmount)) {
    const err: any = new Error("Invalid amount");
    err.status = 400;
    throw err;
  }

  const oldTransaction = await prisma.transaction.findUnique({ where: { id } });
  if (!oldTransaction) {
    const err: any = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    // 1. Revert old balance changes
    if (oldTransaction.type === 'expense') {
      await tx.account.update({
        where: { id: oldTransaction.accountId },
        data: { balance: { increment: oldTransaction.amount } }
      });
    } else if (oldTransaction.type === 'income') {
      await tx.account.update({
        where: { id: oldTransaction.accountId },
        data: { balance: { decrement: oldTransaction.amount } }
      });
    } else if (oldTransaction.type === 'transfer' && oldTransaction.targetAccountId) {
      await tx.account.update({
        where: { id: oldTransaction.accountId },
        data: { balance: { increment: oldTransaction.amount } }
      });
      await tx.account.update({
        where: { id: oldTransaction.targetAccountId },
        data: { balance: { decrement: oldTransaction.amount } }
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
        type,
        description: description || '',
        createdAt: createdAt ? new Date(createdAt) : new Date()
      },
    });

    // 3. Apply new balance changes
    if (type === 'expense') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
    } else if (type === 'income') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: numAmount } }
      });
    } else if (type === 'transfer' && targetAccountId) {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
      await tx.account.update({
        where: { id: targetAccountId },
        data: { balance: { increment: numAmount } }
      });
    }

    return updatedTransaction;
  });
}
