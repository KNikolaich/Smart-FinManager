import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { DEMO_DASHBOARD_SETTINGS, DEMO_USD_CURRENCY } from "../data/demoDataTemplate";
import { ensureCalendarDataReady } from "./calendar.service";
import {
  buildDemoCategorySeed,
  buildDemoDataset,
  DemoCurrencyRef,
} from "./demoDataBuilder";

export class DemoDataServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "DemoDataServiceError";
  }
}

function currencyByIso(currencies: DemoCurrencyRef[], iso: string): DemoCurrencyRef | undefined {
  return currencies.find(currency => currency.iso.trim().toUpperCase() === iso);
}

export async function generateDemoData(userId: string) {
  // Migrate any legacy calendar grid first. Its note migration replaces the
  // dedicated notes table, so demo entries must be inserted afterwards.
  await ensureCalendarDataReady(userId);

  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, settings: true },
    });
    if (!user) throw new DemoDataServiceError("Пользователь не найден", 404);

    const currencies = await tx.currency.findMany({
      select: { id: true, iso: true, currency: true, symbol: true, rate: true },
    });
    const isAdmin = user.role.toLowerCase() === "admin";
    let rub = currencyByIso(currencies, "RUB");
    let usd = currencyByIso(currencies, "USD");

    // Shared dictionary rows are created only for administrators. Regular
    // users rely on the application-wide currency catalog already being set up.
    if (!rub) {
      if (!isAdmin) throw new DemoDataServiceError("В справочнике валют нет RUB", 409);
      rub = await tx.currency.create({
        data: {
          id: randomUUID(),
          currency: "рубль",
          name: "RUB - Russia (руб)",
          iso: "RUB",
          rate: 1,
          symbol: "₽",
        },
        select: { id: true, iso: true, currency: true, symbol: true, rate: true },
      });
      currencies.push(rub);
    }
    if (!usd) {
      if (!isAdmin) throw new DemoDataServiceError("В справочнике валют нет USD", 409);
      usd = await tx.currency.create({
        data: {
          id: randomUUID(),
          ...DEMO_USD_CURRENCY,
        },
        select: { id: true, iso: true, currency: true, symbol: true, rate: true },
      });
      currencies.push(usd);
    }

    const existingCategories = await tx.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, parentId: true },
    });
    const categorySeed = buildDemoCategorySeed(userId, existingCategories);
    if (categorySeed.rootRows.length > 0) {
      await tx.category.createMany({ data: categorySeed.rootRows });
    }
    if (categorySeed.childRows.length > 0) {
      await tx.category.createMany({ data: categorySeed.childRows });
    }

    const dataset = buildDemoDataset(userId, categorySeed.categoryIds, rub, usd);
    await tx.account.createMany({ data: dataset.accounts.map(account => account.record) });
    await tx.calendarPlan.createMany({ data: dataset.calendarPlans });
    await tx.calendarNote.createMany({ data: dataset.calendarNotes });

    // Bulk insert bypasses transaction-service balance effects. Account
    // balances stay at zero until the final explicit balance assignment.
    await tx.transaction.createMany({ data: dataset.transactions });
    await tx.goal.createMany({ data: dataset.goals });

    const cashbackGrid = await tx.planGrid.findUnique({
      where: { userId_type: { userId, type: "cashback" } },
      select: { id: true },
    });
    if (!cashbackGrid) {
      await tx.planGrid.create({
        data: {
          id: randomUUID(),
          userId,
          type: "cashback",
          data: dataset.cashback as Prisma.InputJsonValue,
        },
      });
    }

    const currentSettings = user.settings
      && typeof user.settings === "object"
      && !Array.isArray(user.settings)
      ? user.settings as Record<string, unknown>
      : {};
    const nextSettings: Record<string, unknown> = { ...currentSettings };
    let settingsChanged = false;
    if (!Object.prototype.hasOwnProperty.call(currentSettings, "dashboard")) {
      nextSettings.dashboard = DEMO_DASHBOARD_SETTINGS;
      settingsChanged = true;
    }
    if (typeof currentSettings.showTotalBalance !== "boolean") {
      nextSettings.showTotalBalance = true;
      settingsChanged = true;
    }
    if (settingsChanged) {
      await tx.user.update({
        where: { id: userId },
        data: { settings: nextSettings as Prisma.InputJsonValue },
      });
    }

    await tx.balanceHistory.createMany({
      data: dataset.balanceHistory.map(entry => ({
        ...entry,
        details: entry.details as unknown as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });

    // The only balance writes in the generator happen after all historical
    // transactions have been inserted; they set the requested demo snapshot.
    for (const account of dataset.accounts) {
      await tx.account.update({
        where: { id: account.record.id },
        data: { balance: account.finalBalance },
      });
    }

    return {
      categoriesAdded: categorySeed.rootRows.length + categorySeed.childRows.length,
      accountsAdded: dataset.accounts.length,
      transactionsAdded: dataset.transactions.length,
      goalsAdded: dataset.goals.length,
      cashbackCategoriesAdded: cashbackGrid ? 0 : dataset.cashback.categories.length,
      calendarPlansAdded: dataset.calendarPlans.length,
      calendarNotesAdded: dataset.calendarNotes.length,
      months: dataset.months,
    };
  });
}