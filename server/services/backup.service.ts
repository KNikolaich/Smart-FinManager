import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export const BACKUP_FORMAT = "ai-fin-assistant-backup";
export const BACKUP_VERSION = 2;

type Row = Record<string, any>;

export interface BackupArchive {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  scope: "user" | "admin";
  exportedAt: string;
  sourceUserId: string;
  data: {
    profile: {
      displayName: string | null;
      photoURL: string | null;
      settings: unknown;
    };
    accounts: Row[];
    categories: Row[];
    transactions: Row[];
    goals: Row[];
    planGrids: Row[];
    calendarPlans: Row[];
    calendarOccurrences: Row[];
    calendarNotes: Row[];
    balanceHistory: Row[];
    chatMessages: Row[];
    aiLogs: Row[];
  };
  referenceData?: {
    currencies: Row[];
    currencyRateSnapshots: Row[];
    currencyRateCollectionRuns: Row[];
  };
}

export class BackupServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "BackupServiceError";
  }
}

export async function exportBackup(userId: string, includeReferenceData = false): Promise<BackupArchive> {
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, photoURL: true, settings: true },
    });
    if (!user) throw new BackupServiceError("Пользователь не найден", 404);

    const [
      accounts,
      categories,
      transactions,
      goals,
      planGrids,
      calendarPlans,
      calendarNotes,
      balanceHistory,
      chatMessages,
      aiLogs,
    ] = await Promise.all([
      tx.account.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.category.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.transaction.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.goal.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.planGrid.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.calendarPlan.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.calendarNote.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
      tx.balanceHistory.findMany({ where: { userId }, orderBy: [{ month: "asc" }, { id: "asc" }] }),
      tx.chatMessage.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.aiLog.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    ]);

    const calendarOccurrences = calendarPlans.length > 0
      ? await tx.calendarOccurrence.findMany({
        where: { calendarPlanId: { in: calendarPlans.map(plan => plan.id) } },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      })
      : [];

    const archive: BackupArchive = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      scope: includeReferenceData ? "admin" : "user",
      exportedAt: new Date().toISOString(),
      sourceUserId: userId,
      data: {
        profile: {
          displayName: user.displayName,
          photoURL: user.photoURL,
          settings: user.settings,
        },
        accounts,
        categories,
        transactions,
        goals,
        planGrids,
        calendarPlans,
        calendarOccurrences,
        calendarNotes,
        balanceHistory,
        chatMessages,
        aiLogs,
      },
    };

    if (includeReferenceData) {
      const [currencies, currencyRateSnapshots, currencyRateCollectionRuns] = await Promise.all([
        tx.currency.findMany({ orderBy: { currency: "asc" } }),
        tx.currencyRateSnapshot.findMany({ orderBy: [{ iso: "asc" }, { quotedAt: "asc" }, { id: "asc" }] }),
        tx.currencyRateCollectionRun.findMany({ orderBy: [{ runDate: "asc" }, { id: "asc" }] }),
      ]);
      archive.referenceData = { currencies, currencyRateSnapshots, currencyRateCollectionRuns };
    }

    return archive;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 10_000,
    timeout: 120_000,
  });
}

export async function restoreBackup(
  userId: string,
  archive: BackupArchive,
  allowReferenceData = false,
) {
  return restoreBackupInternal(userId, archive, {
    allowAdminArchive: allowReferenceData,
    restoreReferenceData: allowReferenceData,
    allowSourceUserIdMismatch: false,
  });
}

export async function restoreBackupForAdminTarget(userId: string, archive: BackupArchive) {
  return restoreBackupInternal(userId, archive, {
    allowAdminArchive: true,
    restoreReferenceData: false,
    allowSourceUserIdMismatch: true,
  });
}

async function restoreBackupInternal(
  userId: string,
  archive: BackupArchive,
  options: {
    allowAdminArchive: boolean;
    restoreReferenceData: boolean;
    allowSourceUserIdMismatch: boolean;
  },
) {
  if (archive.scope === "admin" && !options.allowAdminArchive) {
    throw new BackupServiceError("Администраторскую копию может восстановить только администратор", 403);
  }
  if (options.restoreReferenceData && (archive.scope !== "admin" || !archive.referenceData)) {
    throw new BackupServiceError("В архиве отсутствуют справочники администратора");
  }

  const { data } = archive;
  assertSnapshotReferences(data);

  const accounts = normalizeRows(data.accounts, [
    "id", "uid", "name", "type", "balance", "currency", "currencyId", "description",
    "showOnDashboard", "showInTotals", "isArchived", "color", "aliases", "comment", "createdAt",
  ], { userId, dates: ["createdAt"] });
  const categories = normalizeRows(data.categories, [
    "id", "name", "type", "icon", "color", "parentId", "sortOrder", "createdAt",
  ], { userId, dates: ["createdAt"] });
  const transactions = normalizeRows(data.transactions, [
    "id", "accountId", "targetAccountId", "categoryId", "subcategoryId", "calendarOccurrenceId",
    "amount", "targetAmount", "exchangeRate", "type", "description", "createdAt",
  ], { userId, dates: ["createdAt"] });
  const goals = normalizeRows(data.goals, [
    "id", "name", "description", "targetAmount", "currentAmount", "currency", "deadline", "completedAt",
    "isCompleted", "createdAt", "sortOrder",
  ], { userId, dates: ["createdAt"], nullableDates: ["deadline", "completedAt"] });
  const planGrids = normalizeRows(data.planGrids, [
    "id", "type", "data", "updatedAt",
  ], { userId, dates: ["updatedAt"], json: ["data"] });
  const calendarPlans = normalizeRows(data.calendarPlans, [
    "id", "title", "amount", "date", "note", "time", "recurrence", "weekdays",
    "transactionType", "accountId", "categoryId", "color", "disableFrom", "archivedAt",
    "createdAt", "updatedAt",
  ], {
    userId,
    dates: ["date", "createdAt", "updatedAt"],
    nullableDates: ["disableFrom", "archivedAt"],
    nullableJson: ["weekdays"],
  });
  const calendarOccurrences = normalizeRows(data.calendarOccurrences, [
    "id", "calendarPlanId", "date", "manuallyCompletedAt", "createdAt", "updatedAt",
  ], {
    dates: ["date", "createdAt", "updatedAt"],
    nullableDates: ["manuallyCompletedAt"],
  });
  const calendarNotes = normalizeRows(data.calendarNotes, [
    "id", "date", "text", "createdAt", "updatedAt",
  ], { userId, dates: ["date", "createdAt", "updatedAt"] });
  const balanceHistory = normalizeRows(data.balanceHistory, [
    "id", "month", "totalBalance", "details", "createdAt",
  ], { userId, dates: ["createdAt"], nullableJson: ["details"] });
  const chatMessages = normalizeRows(data.chatMessages, [
    "id", "role", "content", "type", "actionType", "actionData", "attachments", "createdAt",
  ], { userId, dates: ["createdAt"], nullableJson: ["attachments"] });
  const aiLogs = normalizeRows(data.aiLogs, [
    "id", "request", "response", "provider", "createdAt",
  ], { userId, dates: ["createdAt"], json: ["request", "response"] });
  const referenceData = archive.referenceData;
  const archivedCurrencies = referenceData
    ? normalizeRows(referenceData.currencies, [
      "id", "currency", "name", "iso", "rate", "buyRate", "sellRate", "rateSource", "rateUpdatedAt", "symbol",
    ], { nullableDates: ["rateUpdatedAt"] })
    : [];
  const currencies = options.restoreReferenceData ? archivedCurrencies : [];
  const currencyRateSnapshots = options.restoreReferenceData
    ? normalizeRows(referenceData!.currencyRateSnapshots, [
      "id", "iso", "buyRate", "sellRate", "quotedAt", "source", "quoteType",
    ], { dates: ["quotedAt"] })
    : [];
  const currencyRateCollectionRuns = options.restoreReferenceData
    ? normalizeRows(referenceData!.currencyRateCollectionRuns, [
      "id", "runDate", "source", "status", "startedAt", "completedAt", "error",
    ], { dates: ["runDate", "startedAt"], nullableDates: ["completedAt"] })
    : [];

  return prisma.$transaction(async tx => {
    const targetUser = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!targetUser) throw new BackupServiceError("Пользователь для восстановления не найден", 404);

    if (archive.sourceUserId !== userId && !options.allowSourceUserIdMismatch &&
      !(await isFreshBootstrapTarget(tx, userId))) {
      throw new BackupServiceError("Резервная копия создана для другого аккаунта", 403);
    }
    await assertNoForeignDependents(tx, userId);
    const existingPlans = await tx.calendarPlan.findMany({
      where: { userId },
      select: { id: true },
    });
    await tx.transaction.deleteMany({ where: { userId } });
    if (existingPlans.length > 0) {
      await tx.calendarOccurrence.deleteMany({
        where: { calendarPlanId: { in: existingPlans.map((plan: { id: string }) => plan.id) } },
      });
    }
    await tx.calendarPlan.deleteMany({ where: { userId } });
    await tx.calendarNote.deleteMany({ where: { userId } });
    await tx.balanceHistory.deleteMany({ where: { userId } });
    await tx.chatMessage.deleteMany({ where: { userId } });
    await tx.aiLog.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });
    await tx.planGrid.deleteMany({ where: { userId } });
    await tx.category.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    await assertRestoredIdsAvailable(tx, [
      { delegate: tx.account, rows: accounts, label: "счётов" },
      { delegate: tx.category, rows: categories, label: "категорий" },
      { delegate: tx.transaction, rows: transactions, label: "операций" },
      { delegate: tx.goal, rows: goals, label: "целей" },
      { delegate: tx.planGrid, rows: planGrids, label: "планов" },
      { delegate: tx.calendarPlan, rows: calendarPlans, label: "планов календаря" },
      { delegate: tx.calendarOccurrence, rows: calendarOccurrences, label: "вхождений календаря" },
      { delegate: tx.calendarNote, rows: calendarNotes, label: "заметок" },
      { delegate: tx.balanceHistory, rows: balanceHistory, label: "снимков баланса" },
      { delegate: tx.chatMessage, rows: chatMessages, label: "сообщений чата" },
      { delegate: tx.aiLog, rows: aiLogs, label: "журналов ИИ" },
    ]);

    const restoredCurrencyIds = new Map<string, string>();
    let addedCurrencyCount = 0;
    if (options.restoreReferenceData) {
      await tx.currencyRateSnapshot.deleteMany({});
      await tx.currencyRateCollectionRun.deleteMany({});
      for (const currency of currencies) {
        const { id: archivedId, ...currencyData } = currency;
        const existingByCode = await tx.currency.findUnique({
          where: { currency: currency.currency },
          select: { id: true },
        });
        if (existingByCode) {
          await tx.currency.update({ where: { id: existingByCode.id }, data: currencyData });
          restoredCurrencyIds.set(archivedId, existingByCode.id);
          continue;
        }

        const existingById = await tx.currency.findUnique({
          where: { id: archivedId },
          select: { id: true, currency: true },
        });
        if (existingById?.currency === currency.currency) {
          restoredCurrencyIds.set(archivedId, existingById.id);
          continue;
        }
        const saved = await tx.currency.create({
          data: (existingById ? currencyData : currency) as any,
          select: { id: true },
        });
        restoredCurrencyIds.set(archivedId, saved.id);
      }
      await createManyIfAny(tx.currencyRateSnapshot, currencyRateSnapshots);
      await createManyIfAny(tx.currencyRateCollectionRun, currencyRateCollectionRuns);
    } else {
      for (const currency of archivedCurrencies) {
        if (!accounts.some(account => account.currencyId === currency.id)) continue;
        const existingByCode = await tx.currency.findUnique({
          where: { currency: currency.currency },
          select: { id: true },
        });
        if (existingByCode) {
          restoredCurrencyIds.set(currency.id, existingByCode.id);
          continue;
        }

        const existingById = await tx.currency.findUnique({
          where: { id: currency.id },
          select: { id: true, currency: true },
        });
        if (existingById?.currency === currency.currency) {
          restoredCurrencyIds.set(currency.id, existingById.id);
          continue;
        }

        const { id: archivedId, ...currencyData } = currency;
        const saved = await tx.currency.create({
          data: (existingById ? currencyData : currency) as any,
          select: { id: true },
        });
        restoredCurrencyIds.set(archivedId, saved.id);
        addedCurrencyCount += 1;
      }
    }

    const accountsToRestore = await Promise.all(accounts.map(async account => {
      let restoredId = account.currencyId && restoredCurrencyIds.get(account.currencyId);
      if (!restoredId && account.currencyId) {
        const existingCurrency = await tx.currency.findUnique({
          where: { id: account.currencyId },
          select: { id: true },
        });
        restoredId = existingCurrency?.id;
      }
      if (!restoredId && typeof account.currency === "string" && account.currency.length > 0) {
        const matchingCurrencies = await tx.currency.findMany({
          where: {
            OR: [
              { currency: account.currency },
              { iso: account.currency },
              { symbol: account.currency },
              { name: account.currency },
            ],
          },
          select: { id: true },
          take: 1,
        });
        restoredId = matchingCurrencies[0]?.id;
      }
      return restoredId ? { ...account, currencyId: restoredId } : account;
    }));
    await createManyIfAny(tx.account, accountsToRestore);
    await createCategoriesInParentOrder(tx, categories);
    await createManyIfAny(tx.goal, goals);
    await createManyIfAny(tx.planGrid, planGrids);
    await createManyIfAny(tx.calendarPlan, calendarPlans);
    await createManyIfAny(tx.calendarOccurrence, calendarOccurrences);
    await createManyIfAny(tx.transaction, transactions);
    await createManyIfAny(tx.calendarNote, calendarNotes);
    await createManyIfAny(tx.balanceHistory, balanceHistory);
    await createManyIfAny(tx.chatMessage, chatMessages);
    await createManyIfAny(tx.aiLog, aiLogs);
    await tx.user.update({
      where: { id: userId },
      data: {
        displayName: data.profile.displayName,
        photoURL: data.profile.photoURL,
        settings: nullableJsonValue(data.profile.settings) as any,
      },
    });

    return {
      restoredCounts: {
        accounts: accounts.length,
        categories: categories.length,
        transactions: transactions.length,
        goals: goals.length,
        planGrids: planGrids.length,
        calendarPlans: calendarPlans.length,
        calendarOccurrences: calendarOccurrences.length,
        calendarNotes: calendarNotes.length,
        balanceHistory: balanceHistory.length,
        chatMessages: chatMessages.length,
        aiLogs: aiLogs.length,
        currencies: options.restoreReferenceData ? currencies.length : addedCurrencyCount,
        currencyRateSnapshots: currencyRateSnapshots.length,
        currencyRateCollectionRuns: currencyRateCollectionRuns.length,
      },
    };
  }, { maxWait: 10_000, timeout: 120_000 });
}

async function isFreshBootstrapTarget(tx: any, userId: string) {
  const [userCount, user, dataCounts] = await Promise.all([
    tx.user.count(),
    tx.user.findUnique({ where: { id: userId }, select: { role: true } }),
    Promise.all([
      tx.account.count(),
      tx.category.count(),
      tx.transaction.count(),
      tx.goal.count(),
      tx.planGrid.count(),
      tx.calendarPlan.count(),
      tx.calendarOccurrence.count(),
      tx.calendarNote.count(),
      tx.balanceHistory.count(),
      tx.chatMessage.count(),
      tx.aiLog.count(),
    ]),
  ]);

  return userCount === 1 && user?.role === "admin" && dataCounts.every((count: number) => count === 0);
}

function normalizeRows(
  rows: Row[],
  fields: string[],
  options: {
    userId?: string;
    dates?: string[];
    nullableDates?: string[];
    json?: string[];
    nullableJson?: string[];
  } = {},
) {
  if (!Array.isArray(rows)) throw new BackupServiceError("В архиве отсутствует массив данных");
  return rows.map((source, index) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new BackupServiceError(`Некорректная запись архива: ${index + 1}`);
    }
    const row: Row = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(source, field)) row[field] = source[field];
    }
    if (fields.includes("id") && (typeof row.id !== "string" || row.id.length === 0)) {
      throw new BackupServiceError(`В записи архива ${index + 1} отсутствует идентификатор`);
    }
    if (options.userId) row.userId = options.userId;
    for (const field of options.dates || []) row[field] = dateValue(source[field], field);
    for (const field of options.nullableDates || []) {
      row[field] = source[field] == null ? null : dateValue(source[field], field);
    }
    for (const field of options.json || []) row[field] = jsonValue(source[field], false, field);
    for (const field of options.nullableJson || []) row[field] = jsonValue(source[field], true, field);
    return row;
  });
}

function dateValue(value: unknown, field: string) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BackupServiceError(`Некорректная дата в поле ${field}`);
  return date;
}

function jsonValue(value: unknown, nullable: boolean, field: string) {
  if (value === undefined) {
    if (nullable) return Prisma.DbNull;
    throw new BackupServiceError(`В архиве отсутствует JSON-поле ${field}`);
  }
  if (value === null) return nullable ? Prisma.DbNull : Prisma.JsonNull;
  return value;
}

function nullableJsonValue(value: unknown) {
  return value === null || value === undefined ? Prisma.DbNull : value;
}

async function createManyIfAny(delegate: any, rows: Row[]) {
  if (rows.length > 0) await delegate.createMany({ data: rows });
}

async function assertRestoredIdsAvailable(
  tx: any,
  collections: Array<{ delegate: any; rows: Row[]; label: string }>,
) {
  for (const { delegate, rows, label } of collections) {
    if (rows.length === 0) continue;
    const collision = await delegate.findMany({
      where: { id: { in: rows.map(row => row.id) } },
      select: { id: true },
      take: 1,
    });
    if (collision.length > 0) {
      throw new BackupServiceError(
        `Идентификаторы архива для ${label} уже используются другими данными. Удалите исходный профиль или выберите свободную учётную запись`,
        409,
      );
    }
  }
}

async function createCategoriesInParentOrder(tx: any, categories: Row[]) {
  const pending = new Map(categories.map(category => [category.id, category]));
  const created = new Set<string>();
  while (pending.size > 0) {
    const ready = [...pending.values()].filter(category => !category.parentId || created.has(category.parentId));
    if (ready.length === 0) {
      throw new BackupServiceError("В архиве обнаружена циклическая или отсутствующая связь категорий");
    }
    await tx.category.createMany({ data: ready });
    ready.forEach(category => {
      created.add(category.id);
      pending.delete(category.id);
    });
  }
}

function assertSnapshotReferences(data: BackupArchive["data"]) {
  const accountIds = new Set(data.accounts.map(row => row.id));
  const categoryIds = new Set(data.categories.map(row => row.id));
  const planIds = new Set(data.calendarPlans.map(row => row.id));
  const occurrenceIds = new Set(data.calendarOccurrences.map(row => row.id));

  assertUniqueIds(data.accounts, "счётов");
  assertUniqueIds(data.categories, "категорий");
  assertUniqueIds(data.transactions, "операций");
  assertUniqueIds(data.goals, "целей");
  assertUniqueIds(data.planGrids, "настроек планов");
  assertUniqueIds(data.calendarPlans, "планов календаря");
  assertUniqueIds(data.calendarOccurrences, "вхождений планов");
  assertUniqueIds(data.calendarNotes, "заметок");
  assertUniqueIds(data.balanceHistory, "истории баланса");
  assertUniqueIds(data.chatMessages, "сообщений чата");
  assertUniqueIds(data.aiLogs, "журналов ИИ");

  for (const category of data.categories) {
    if (category.parentId && !categoryIds.has(category.parentId)) {
      throw new BackupServiceError("Категория ссылается на отсутствующую родительскую категорию");
    }
  }
  for (const plan of data.calendarPlans) {
    if (plan.accountId && !accountIds.has(plan.accountId)) {
      throw new BackupServiceError("План календаря ссылается на отсутствующий счёт");
    }
    if (plan.categoryId && !categoryIds.has(plan.categoryId)) {
      throw new BackupServiceError("План календаря ссылается на отсутствующую категорию");
    }
  }
  for (const occurrence of data.calendarOccurrences) {
    if (!planIds.has(occurrence.calendarPlanId)) {
      throw new BackupServiceError("Вхождение ссылается на отсутствующий план календаря");
    }
  }
  for (const transaction of data.transactions) {
    if (!accountIds.has(transaction.accountId)) {
      throw new BackupServiceError("Операция ссылается на отсутствующий счёт");
    }
    if (transaction.targetAccountId && !accountIds.has(transaction.targetAccountId)) {
      throw new BackupServiceError("Перевод ссылается на отсутствующий целевой счёт");
    }
    if (transaction.categoryId && !categoryIds.has(transaction.categoryId)) {
      throw new BackupServiceError("Операция ссылается на отсутствующую категорию");
    }
    if (transaction.subcategoryId && !categoryIds.has(transaction.subcategoryId)) {
      throw new BackupServiceError("Операция ссылается на отсутствующую подкатегорию");
    }
    if (transaction.calendarOccurrenceId && !occurrenceIds.has(transaction.calendarOccurrenceId)) {
      throw new BackupServiceError("Операция ссылается на отсутствующее вхождение плана");
    }
  }
}

function assertUniqueIds(rows: Row[], label: string) {
  const ids = rows.map(row => row.id);
  if (ids.some(id => typeof id !== "string" || id.length === 0) || new Set(ids).size !== ids.length) {
    throw new BackupServiceError(`В архиве есть пустые или повторяющиеся идентификаторы ${label}`);
  }
}

async function assertNoForeignDependents(tx: any, userId: string) {
  const [accounts, categories, plans] = await Promise.all([
    tx.account.findMany({ where: { userId }, select: { id: true } }),
    tx.category.findMany({ where: { userId }, select: { id: true } }),
    tx.calendarPlan.findMany({ where: { userId }, select: { id: true } }),
  ]);
  const accountIds = accounts.map((row: { id: string }) => row.id);
  const categoryIds = categories.map((row: { id: string }) => row.id);
  const planIds = plans.map((row: { id: string }) => row.id);
  const occurrences = planIds.length > 0
    ? await tx.calendarOccurrence.findMany({
      where: { calendarPlanId: { in: planIds } },
      select: { id: true },
    })
    : [];
  const occurrenceIds = occurrences.map((row: { id: string }) => row.id);
  const transactionReferences = [
    ...(accountIds.length > 0
      ? [
        { accountId: { in: accountIds } },
        { targetAccountId: { in: accountIds } },
      ]
      : []),
    ...(categoryIds.length > 0
      ? [
        { categoryId: { in: categoryIds } },
        { subcategoryId: { in: categoryIds } },
      ]
      : []),
    ...(occurrenceIds.length > 0
      ? [{ calendarOccurrenceId: { in: occurrenceIds } }]
      : []),
  ];
  const [foreignTransactions, foreignChildCategories] = await Promise.all([
    transactionReferences.length > 0
      ? tx.transaction.findMany({
        where: {
          userId: { not: userId },
          OR: transactionReferences,
        },
        select: { id: true },
        take: 1,
      })
      : [],
    categoryIds.length > 0
      ? tx.category.findMany({
        where: {
          userId: { not: userId },
          parentId: { in: categoryIds },
        },
        select: { id: true },
        take: 1,
      })
      : [],
  ]);

  if (foreignTransactions.length > 0 || foreignChildCategories.length > 0) {
    throw new BackupServiceError(
      "В данных есть связи с записями других пользователей; восстановление остановлено, чтобы не изменить их данные",
      409,
    );
  }
}