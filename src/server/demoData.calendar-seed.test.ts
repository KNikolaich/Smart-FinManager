import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const data = {
    accounts: [
      { id: "account-vtb", name: "ВТБ", userId: "user-1" },
      { id: "account-sber", name: "Сбер", userId: "user-1" },
    ],
    categories: [] as any[],
    plans: [] as any[],
    notes: [] as any[],
  };
  const db: Record<string, any> = {};

  db.user = {
    findUnique: vi.fn(async () => ({ id: "user-1" })),
  };
  db.account = {
    findMany: vi.fn(async () => structuredClone(data.accounts)),
  };
  db.category = {
    findMany: vi.fn(async () => structuredClone(data.categories)),
    createMany: vi.fn(async ({ data: rows }: { data: any[] }) => {
      data.categories.push(...structuredClone(rows));
      return { count: rows.length };
    }),
  };
  db.calendarPlan = {
    findMany: vi.fn(async () => data.plans.map(plan => ({
      ...structuredClone(plan),
      account: { name: data.accounts.find(account => account.id === plan.accountId)?.name },
      category: { name: data.categories.find(category => category.id === plan.categoryId)?.name },
    }))),
    createMany: vi.fn(async ({ data: rows }: { data: any[] }) => {
      data.plans.push(...structuredClone(rows));
      return { count: rows.length };
    }),
  };
  db.calendarNote = {
    findMany: vi.fn(async () => structuredClone(data.notes)),
    createMany: vi.fn(async ({ data: rows }: { data: any[] }) => {
      data.notes.push(...structuredClone(rows));
      return { count: rows.length };
    }),
  };
  db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));

  return { db, data, ensureCalendarDataReady: vi.fn(async () => undefined) };
});

vi.mock("../../server/prisma", () => ({ prisma: fake.db }));
vi.mock("../../server/services/calendar.service", () => ({
  ensureCalendarDataReady: fake.ensureCalendarDataReady,
}));

import { generateDemoCalendarData } from "../../server/services/demoData.service";

describe("demo calendar repair", () => {
  beforeEach(() => {
    fake.data.accounts.splice(
      0,
      fake.data.accounts.length,
      { id: "account-vtb", name: "ВТБ", userId: "user-1" },
      { id: "account-sber", name: "Сбер", userId: "user-1" },
    );
    fake.data.categories.length = 0;
    fake.data.plans.length = 0;
    fake.data.notes.length = 0;
    vi.clearAllMocks();
  });

  it("adds only missing calendar records and remains safe to repeat", async () => {
    const firstResult = await generateDemoCalendarData("user-1");

    expect(firstResult).toEqual({
      categoriesAdded: expect.any(Number),
      calendarPlansAdded: 7,
      calendarNotesAdded: 5,
    });
    expect(fake.data.plans).toHaveLength(7);
    expect(fake.data.notes).toHaveLength(5);
    expect(fake.ensureCalendarDataReady).toHaveBeenCalledWith("user-1");
    expect(fake.ensureCalendarDataReady.mock.invocationCallOrder[0])
      .toBeLessThan(fake.db.$transaction.mock.invocationCallOrder[0]);

    const categoryInsertCalls = fake.db.category.createMany.mock.calls.length;
    const secondResult = await generateDemoCalendarData("user-1");

    expect(secondResult).toEqual({
      categoriesAdded: 0,
      calendarPlansAdded: 0,
      calendarNotesAdded: 0,
    });
    expect(fake.data.plans).toHaveLength(7);
    expect(fake.data.notes).toHaveLength(5);
    expect(fake.db.category.createMany).toHaveBeenCalledTimes(categoryInsertCalls);
    expect(fake.db.calendarPlan.createMany).toHaveBeenCalledTimes(1);
    expect(fake.db.calendarNote.createMany).toHaveBeenCalledTimes(1);
  });

  it("explains that the main demo accounts are required", async () => {
    fake.data.accounts.length = 0;

    await expect(generateDemoCalendarData("user-1"))
      .rejects.toThrow("Сначала создайте основные демо-данные");
    expect(fake.db.calendarPlan.createMany).not.toHaveBeenCalled();
    expect(fake.db.calendarNote.createMany).not.toHaveBeenCalled();
  });
});