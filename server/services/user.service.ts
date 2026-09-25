import { prisma } from "../prisma";

export function getProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      photoURL: true,
      role: true,
      settings: true,
      createdAt: true
    }
  });
}

export function deleteAccount(userId: string) {
  // With onDelete: Cascade set up in the schema, deleting the user
  // will automatically wipe all associated data in other tables.
  return prisma.user.delete({ where: { id: userId } });
}

export function clearTransactions(userId: string) {
  return prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.account.updateMany({
      where: { userId },
      data: { balance: 0 }
    }),
    prisma.aiLog.deleteMany({ where: { userId } }),
    prisma.balanceHistory.deleteMany({ where: { userId } }),
    prisma.chatMessage.deleteMany({ where: { userId } }),
  ]);
}

function getCashbackCategories(data: any): any[] | null {
  return data && typeof data === "object" && Array.isArray(data.categories)
    ? data.categories
    : null;
}

export async function clearAllUserData(userId: string) {
  return prisma.$transaction(async tx => {
    const planGrids = await tx.planGrid.findMany({
      where: { userId },
      select: { type: true, data: true },
    });

    // Cashback categories are reference data for this user. Keep them while
    // removing all month-specific entries and every other personal plan grid.
    const currentCashback = planGrids.find(grid => grid.type === "cashback");
    const legacyCashback = planGrids.find(grid => grid.type === "cashbacks");
    const legacyAll = planGrids.find(grid => grid.type === "all");
    const legacyAllData = legacyAll?.data as any;
    const cashbackCategories =
      getCashbackCategories(currentCashback?.data)
      ?? getCashbackCategories(legacyCashback?.data)
      ?? getCashbackCategories(legacyAllData?.cashback)
      ?? getCashbackCategories(legacyAllData?.cashbacks);

    const deleted = {
      transactions: await tx.transaction.deleteMany({ where: { userId } }),
      calendarPlans: await tx.calendarPlan.deleteMany({ where: { userId } }),
      calendarNotes: await tx.calendarNote.deleteMany({ where: { userId } }),
      goals: await tx.goal.deleteMany({ where: { userId } }),
      accounts: await tx.account.deleteMany({ where: { userId } }),
      balanceHistory: await tx.balanceHistory.deleteMany({ where: { userId } }),
      aiLogs: await tx.aiLog.deleteMany({ where: { userId } }),
      chatMessages: await tx.chatMessage.deleteMany({ where: { userId } }),
    };

    await tx.planGrid.deleteMany({ where: { userId } });
    if (cashbackCategories !== null) {
      await tx.planGrid.create({
        data: {
          userId,
          type: "cashback",
          data: {
            categories: cashbackCategories,
            months: [],
            entries: [],
          },
        },
      });
    }

    return Object.fromEntries(
      Object.entries(deleted).map(([key, result]) => [key, result.count]),
    );
  });
}
