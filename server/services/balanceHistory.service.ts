import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  addMonths,
  isLegacyAutoSnapshot,
  monthEndFromCurrent,
  monthEndFromLegacy,
  moscowMonthKey,
  moscowMonthStart,
} from "./balanceSnapshot";

export async function listBalanceHistory(userId: string) {
  await refreshMonthEndSnapshots(userId);
  return prisma.balanceHistory.findMany({
    where: { userId },
    orderBy: { month: 'desc' }
  });
}

export function upsertBalanceHistory(userId: string, month: string, totalBalance: any) {
  return prisma.balanceHistory.upsert({
    where: { userId_month: { userId, month } },
    update: { totalBalance: Number(totalBalance) },
    create: { userId, month, totalBalance: Number(totalBalance) }
  });
}

export function updateBalanceHistory(userId: string, id: string, month: string, totalBalance: any) {
  return prisma.balanceHistory.update({
    where: { id, userId },
    data: { month, totalBalance: Number(totalBalance) }
  });
}

export function deleteBalanceHistory(userId: string, id: string) {
  return prisma.balanceHistory.delete({
    where: { id, userId }
  });
}

/** How many missing months back a fresh fill reaches, so a long absence stays cheap. */
const MAX_FILL_MONTHS = 24;

/**
 * Brings the stored balance history to month-end values (see balanceSnapshot.ts):
 * - legacy start-of-month snapshots become the month-end of the month before;
 * - every finished month since the last stored one gets its month-end value.
 * The current month is never stored: the chart shows it live.
 * Manual and demo rows are left as they are and win over computed ones.
 */
export async function ensureMonthEndSnapshots(userId: string, now: Date = new Date()) {
  const currentMonth = moscowMonthKey(now);
  const lastFinished = addMonths(currentMonth, -1);
  const records = await prisma.balanceHistory.findMany({ where: { userId } });

  const legacy = records.filter(isLegacyAutoSnapshot);
  const kept = records.filter(record => !legacy.includes(record));
  const keptMonths = new Set(kept.map(record => record.month));
  const latestKept = kept.map(record => record.month).filter(month => month < currentMonth).sort().at(-1);
  const legacyMonths = legacy.map(record => addMonths(moscowMonthKey(new Date(record.createdAt)), -1));
  const latestStored = [latestKept, ...legacyMonths].filter(Boolean).sort().at(-1) as string | undefined;

  // Months to compute from today's balances: those after the last stored one.
  const fillMonths: string[] = [];
  const fillFrom = latestStored ? addMonths(latestStored, 1) : lastFinished;
  for (let month = lastFinished; month >= fillFrom && fillMonths.length < MAX_FILL_MONTHS; month = addMonths(month, -1)) {
    if (!keptMonths.has(month) && !legacyMonths.includes(month)) fillMonths.push(month);
  }
  if (legacy.length === 0 && fillMonths.length === 0) return;

  const earliest = [
    ...legacy.map(record => moscowMonthStart(moscowMonthKey(new Date(record.createdAt)))),
    ...fillMonths.map(month => moscowMonthStart(addMonths(month, 1))),
  ].sort((a, b) => a.getTime() - b.getTime())[0];

  const [accounts, currencies, transactions] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.currency.findMany(),
    prisma.transaction.findMany({
      where: { userId, createdAt: { gte: earliest } },
      select: { accountId: true, targetAccountId: true, amount: true, targetAmount: true, type: true, createdAt: true },
    }),
  ]);

  // Several legacy rows can land on one month (UTC vs Moscow labels); keep the
  // one taken closest to the month boundary, it needs the least rolling back.
  const fromLegacy = new Map<string, ReturnType<typeof monthEndFromLegacy>>();
  for (const record of legacy) {
    const snapshot = monthEndFromLegacy(record, accounts, currencies, transactions);
    const existing = fromLegacy.get(snapshot.month);
    if (!existing || snapshot.gapMs < existing.gapMs) fromLegacy.set(snapshot.month, snapshot);
  }

  const toCreate = [
    ...[...fromLegacy.values()].filter(snapshot => !keptMonths.has(snapshot.month)),
    ...fillMonths.map(month => monthEndFromCurrent(month, accounts, currencies, transactions)),
  ];

  await prisma.$transaction([
    prisma.balanceHistory.deleteMany({ where: { userId, id: { in: legacy.map(record => record.id) } } }),
    prisma.balanceHistory.createMany({
      data: toCreate.map(snapshot => ({
        userId,
        month: snapshot.month,
        totalBalance: snapshot.totalBalance,
        details: snapshot.details as unknown as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    }),
  ]);
}

/** {@link ensureMonthEndSnapshots} that never fails the request it runs in. */
export async function refreshMonthEndSnapshots(userId: string) {
  try {
    await ensureMonthEndSnapshots(userId);
  } catch (error) {
    console.error("Failed to update month-end balance snapshots:", error);
  }
}
