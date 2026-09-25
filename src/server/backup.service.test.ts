import { beforeEach, describe, expect, it, vi } from "vitest";
import { backupRestoreSchema } from "../../validation";

const fake = vi.hoisted(() => {
  const names = [
    "account", "category", "transaction", "goal", "planGrid", "calendarPlan",
    "calendarOccurrence", "calendarNote", "balanceHistory", "chatMessage", "aiLog",
    "currency", "currencyRateSnapshot", "currencyRateCollectionRun",
  ];
  const tables: Record<string, any[]> = Object.fromEntries(names.map(name => [name, []]));
  const userRecord: Record<string, any> = {};

  const makeDelegate = (name: string) => ({
    findUnique: vi.fn(async ({ where }: any) => {
      const row = tables[name].find(candidate =>
        Object.entries(where).every(([field, value]) => candidate[field] === value));
      return row ? structuredClone(row) : null;
    }),
    findMany: vi.fn(async (args: any = {}) => {
      let rows = tables[name];
      if (typeof args.where?.userId === "string") {
        rows = rows.filter(row => row.userId === args.where.userId);
      } else if (args.where?.userId?.not !== undefined) {
        rows = rows.filter(row => row.userId !== args.where.userId.not);
      }
      if (args.where?.calendarPlanId?.in) {
        const ids = new Set(args.where.calendarPlanId.in);
        rows = rows.filter(row => ids.has(row.calendarPlanId));
      }
      if (args.where?.parentId?.in) {
        rows = rows.filter(row => args.where.parentId.in.includes(row.parentId));
      }
      if (args.where?.OR) {
        rows = rows.filter(row => args.where.OR.some((condition: any) =>
          Object.entries(condition).some(([field, filter]: [string, any]) =>
            filter?.in ? filter.in.includes(row[field]) : row[field] === filter)));
      }
      if (args.take !== undefined) rows = rows.slice(0, args.take);
      return structuredClone(rows);
    }),
    count: vi.fn(async () => tables[name].length),
    deleteMany: vi.fn(async (args: any = {}) => {
      const rows = tables[name];
      const keep = args.where?.userId !== undefined
        ? rows.filter(row => row.userId !== args.where.userId)
        : args.where?.calendarPlanId?.in
          ? rows.filter(row => !args.where.calendarPlanId.in.includes(row.calendarPlanId))
          : [];
      const count = rows.length - keep.length;
      tables[name] = keep;
      return { count };
    }),
    createMany: vi.fn(async ({ data }: { data: any[] }) => {
      tables[name].push(...structuredClone(data));
      return { count: data.length };
    }),
    create: vi.fn(async ({ data }: any) => {
      const saved = { id: data.id || `generated-${name}-${tables[name].length + 1}`, ...structuredClone(data) };
      tables[name].push(saved);
      return structuredClone(saved);
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = tables[name].find(candidate =>
        Object.entries(where).every(([field, value]) => candidate[field] === value));
      if (!row) throw new Error(`Missing ${name} record`);
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    }),
  });

  const db: Record<string, any> = {};
  for (const name of names) db[name] = makeDelegate(name);
  db.user = {
    count: vi.fn(async () => userRecord.id ? 1 : 0),
    findUnique: vi.fn(async ({ where }: any) =>
      where.id === userRecord.id ? structuredClone(userRecord) : null),
    update: vi.fn(async ({ data }: any) => {
      Object.assign(userRecord, structuredClone(data));
      return structuredClone(userRecord);
    }),
  };
  db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));

  return { db, tables, userRecord };
});

vi.mock("../../server/prisma", () => ({ prisma: fake.db }));

import { exportBackup, restoreBackup } from "../../server/services/backup.service";

const date = (value: string) => new Date(value);
const accountFixture = () => ({
  id: "account-1",
  uid: "legacy-account-1",
  userId: "user-1",
  name: "Накопительный",
  type: "bank",
  balance: 17342.61,
  currency: "RUB",
  currencyId: "currency-rub",
  description: "Основной счёт",
  showOnDashboard: true,
  showInTotals: true,
  isArchived: false,
  color: "#1b9aaa",
  aliases: "копилка",
  comment: "не менять",
  createdAt: date("2025-01-10T10:00:00.000Z"),
});

function seedDatabase() {
  for (const rows of Object.values(fake.tables)) rows.splice(0, rows.length);
  Object.assign(fake.userRecord, {
    id: "user-1",
    role: "admin",
    displayName: "Анна",
    photoURL: null,
    settings: { showTotalBalance: false, theme: "dark" },
    email: "not-exported@example.test",
    password: "not-exported",
  });

  fake.tables.account.push(accountFixture());
  fake.tables.category.push({
    id: "category-1", userId: "user-1", name: "Дом", type: "expense",
    icon: "home", color: "#4a5568", parentId: null, sortOrder: 3,
    createdAt: date("2025-02-10T10:00:00.000Z"),
  });
  fake.tables.category.push({
    id: "category-2", userId: "user-1", name: "Продукты", type: "expense",
    icon: "basket", color: "#4a5568", parentId: "category-1", sortOrder: 1,
    createdAt: date("2025-02-11T10:00:00.000Z"),
  });
  fake.tables.transaction.push({
    id: "transaction-1", userId: "user-1", accountId: "account-1",
    targetAccountId: null, categoryId: "category-1", subcategoryId: "category-2",
    calendarOccurrenceId: "occurrence-1", amount: 250.5, targetAmount: null,
    exchangeRate: null, type: "expense", description: "Покупка",
    createdAt: date("2025-03-10T10:00:00.000Z"),
  });
  fake.tables.goal.push({
    id: "goal-1", userId: "user-1", name: "Отпуск", description: "Летом",
    targetAmount: 90000, currentAmount: 12000, deadline: date("2026-06-01T00:00:00.000Z"),
    completedAt: null, isCompleted: false, createdAt: date("2025-01-01T00:00:00.000Z"),
    sortOrder: 1,
  });
  fake.tables.planGrid.push({
    id: "grid-1", userId: "user-1", type: "config",
    data: { months: ["2026-01"], color: "violet" }, updatedAt: date("2026-01-01T00:00:00.000Z"),
  });
  fake.tables.planGrid.push({
    id: "grid-calendar-legacy", userId: "user-1", type: "calendar",
    data: [{ id: "legacy-plan-1", title: "Старый формат календаря" }],
    updatedAt: date("2026-01-02T00:00:00.000Z"),
  });
  fake.tables.calendarPlan.push({
    id: "plan-1", userId: "user-1", title: "Оплата интернета", amount: 900,
    date: date("2026-04-01T00:00:00.000Z"), note: "До 5 числа", time: "09:30",
    recurrence: "monthly", weekdays: [1], transactionType: "expense",
    accountId: "account-1", categoryId: "category-1", color: "#7c3aed",
    disableFrom: null, archivedAt: null, createdAt: date("2025-12-01T00:00:00.000Z"),
    updatedAt: date("2026-01-01T00:00:00.000Z"),
  });
  fake.tables.calendarOccurrence.push({
    id: "occurrence-1", calendarPlanId: "plan-1", date: date("2026-04-01T00:00:00.000Z"),
    manuallyCompletedAt: date("2026-04-01T08:00:00.000Z"),
    createdAt: date("2026-01-01T00:00:00.000Z"), updatedAt: date("2026-04-01T08:00:00.000Z"),
  });
  fake.tables.calendarNote.push({
    id: "note-1", userId: "user-1", date: date("2026-04-01T00:00:00.000Z"),
    text: "Проверить регулярные платежи", createdAt: date("2026-03-01T00:00:00.000Z"),
    updatedAt: date("2026-03-02T00:00:00.000Z"),
  });
  fake.tables.balanceHistory.push({
    id: "history-1", userId: "user-1", month: "2026-03", totalBalance: 17342.61,
    details: [{ accountId: "account-1", balance: 17342.61 }],
    createdAt: date("2026-03-31T21:00:00.000Z"),
  });
  fake.tables.chatMessage.push({
    id: "chat-1", userId: "user-1", role: "assistant", content: "Готово",
    type: "text", actionType: null, actionData: null, attachments: [{ name: "receipt.jpg" }],
    createdAt: date("2026-03-10T12:00:00.000Z"),
  });
  fake.tables.aiLog.push({
    id: "ai-1", userId: "user-1", request: { prompt: "summary" },
    response: { text: "Ответ" }, provider: "deepseek", createdAt: date("2026-03-10T12:01:00.000Z"),
  });
  fake.tables.currency.push({
    id: "currency-rub", currency: "RUB", name: "Рубль", iso: "RUB",
    rate: 1, buyRate: null, sellRate: null, rateSource: "manual",
    rateUpdatedAt: null, symbol: "₽",
  });
  fake.tables.currencyRateSnapshot.push({
    id: "rate-1", iso: "USD", buyRate: 90.1, sellRate: 91.2,
    quotedAt: date("2026-03-10T09:00:00.000Z"), source: "bank", quoteType: "cash",
  });
  fake.tables.currencyRateCollectionRun.push({
    id: "run-1", runDate: date("2026-03-10T00:00:00.000Z"), source: "bank",
    status: "success", startedAt: date("2026-03-10T09:00:00.000Z"),
    completedAt: date("2026-03-10T09:01:00.000Z"), error: null,
  });
}

describe("full backup round trip", () => {
  beforeEach(() => {
    seedDatabase();
    vi.clearAllMocks();
  });

  it("restores every user collection and archived currency history without dropping newer shared currencies", async () => {
    const exported = await exportBackup("user-1", true);
    const archive = JSON.parse(JSON.stringify(exported));

    expect(backupRestoreSchema.safeParse(archive).success).toBe(true);
    expect(archive.data.profile).not.toHaveProperty("password");
    expect(archive.data.accounts[0].balance).toBe(17342.61);
    expect(archive.referenceData).toMatchObject({
      currencies: [{ currency: "RUB" }],
      currencyRateSnapshots: [{ iso: "USD", buyRate: 90.1 }],
      currencyRateCollectionRuns: [{ source: "bank", status: "success" }],
    });

    fake.tables.account.push({ ...accountFixture(), id: "stale-account", name: "Удалённый после восстановления" });
    fake.tables.calendarNote.push({
      id: "stale-note", userId: "user-1", date: date("2020-01-01T00:00:00.000Z"),
      text: "Старая заметка", createdAt: date("2020-01-01T00:00:00.000Z"),
      updatedAt: date("2020-01-01T00:00:00.000Z"),
    });
    fake.tables.currency.push({
      id: "currency-extra", currency: "XXX", name: "Временная", iso: "XXX",
      rate: 1, buyRate: null, sellRate: null, rateSource: null, rateUpdatedAt: null, symbol: null,
    });

    const result = await restoreBackup("user-1", archive, true);
    const restored = await exportBackup("user-1", true);

    expect(result.restoredCounts).toEqual({
      accounts: 1,
      categories: 2,
      transactions: 1,
      goals: 1,
      planGrids: 2,
      calendarPlans: 1,
      calendarOccurrences: 1,
      calendarNotes: 1,
      balanceHistory: 1,
      chatMessages: 1,
      aiLogs: 1,
      currencies: 1,
      currencyRateSnapshots: 1,
      currencyRateCollectionRuns: 1,
    });
    expect(JSON.parse(JSON.stringify(restored.data))).toEqual(archive.data);
    expect(restored.referenceData?.currencies).toEqual(
      expect.arrayContaining(archive.referenceData.currencies),
    );
    expect(restored.referenceData?.currencies).toHaveLength(2);
    expect(restored.referenceData?.currencies.some((currency: any) => currency.currency === "XXX")).toBe(true);
    expect(JSON.parse(JSON.stringify(restored.referenceData?.currencyRateSnapshots)))
      .toEqual(archive.referenceData.currencyRateSnapshots);
    expect(JSON.parse(JSON.stringify(restored.referenceData?.currencyRateCollectionRuns)))
      .toEqual(archive.referenceData.currencyRateCollectionRuns);
    expect(fake.userRecord.password).toBe("not-exported");
  });

  it("creates personal backups without shared currency tables", async () => {
    const archive = await exportBackup("user-1");
    expect(archive.scope).toBe("user");
    expect(archive).not.toHaveProperty("referenceData");
    expect(archive.data.balanceHistory).toHaveLength(1);
    expect(archive.data.calendarNotes).toHaveLength(1);
  });

  it("rejects a backup belonging to another user before deleting current data", async () => {
    const archive = await exportBackup("user-1", true);
    archive.sourceUserId = "another-user";
    const accountCountBefore = fake.tables.account.length;

    await expect(restoreBackup("user-1", archive, true)).rejects.toThrow("другого аккаунта");
    expect(fake.tables.account).toHaveLength(accountCountBefore);
    expect(fake.db.account.deleteMany).not.toHaveBeenCalled();
  });

  it("restores an old admin archive into a fresh single-admin database with a new user ID", async () => {
    const archive = JSON.parse(JSON.stringify(await exportBackup("user-1", true)));
    for (const rows of Object.values(fake.tables)) rows.splice(0, rows.length);
    Object.assign(fake.userRecord, {
      id: "new-user",
      role: "admin",
      displayName: null,
      photoURL: null,
      settings: {},
      email: "fresh-account@example.test",
      password: "fresh-password-hash",
    });

    const result = await restoreBackup("new-user", archive, true);

    expect(result.restoredCounts.accounts).toBe(1);
    expect(fake.tables.account[0]).toMatchObject({
      id: "account-1",
      userId: "new-user",
      balance: 17342.61,
    });
    expect(fake.tables.transaction[0].userId).toBe("new-user");
    expect(fake.tables.chatMessage[0].userId).toBe("new-user");
    expect(fake.userRecord).toMatchObject({
      id: "new-user",
      role: "admin",
      displayName: "Анна",
      password: "fresh-password-hash",
    });
  });

  it("refuses to cascade-delete another user's transaction through a shared account id", async () => {
    const archive = await exportBackup("user-1");
    fake.tables.transaction.push({
      ...fake.tables.transaction[0],
      id: "foreign-transaction",
      userId: "user-2",
    });

    await expect(restoreBackup("user-1", archive, false)).rejects.toThrow("других пользователей");
    expect(fake.tables.account).toHaveLength(1);
    expect(fake.tables.transaction).toHaveLength(2);
    expect(fake.db.account.deleteMany).not.toHaveBeenCalled();
  });

  it("requires an administrator path for global currency and rate data", async () => {
    const archive = await exportBackup("user-1", true);
    await expect(restoreBackup("user-1", archive, false)).rejects.toThrow("только администратор");
    expect(fake.db.currency.deleteMany).not.toHaveBeenCalled();
  });

  it("maps account currency IDs to the retained shared currency row", async () => {
    const archive = JSON.parse(JSON.stringify(await exportBackup("user-1", true)));
    fake.tables.currency[0].id = "currency-rub-current";

    await restoreBackup("user-1", archive, true);

    expect(fake.tables.account[0].currencyId).toBe("currency-rub-current");
    expect(fake.tables.currency.filter(row => row.currency === "RUB")).toHaveLength(1);
  });
});