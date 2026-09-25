import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const planGrids: any[] = [];
  const db: Record<string, any> = {};
  for (const name of [
    "transaction",
    "calendarPlan",
    "calendarNote",
    "goal",
    "account",
    "balanceHistory",
    "aiLog",
    "chatMessage",
  ]) {
    db[name] = {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    };
  }

  db.planGrid = {
    findMany: vi.fn(async () => structuredClone(planGrids)),
    deleteMany: vi.fn(async () => {
      const count = planGrids.length;
      planGrids.length = 0;
      return { count };
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      planGrids.push(structuredClone(data));
      return data;
    }),
  };
  db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));

  return { db, planGrids };
});

vi.mock("../../server/prisma", () => ({ prisma: fake.db }));

import { clearAllUserData } from "../../server/services/user.service";

describe("clear all user data", () => {
  beforeEach(() => {
    fake.planGrids.splice(
      0,
      fake.planGrids.length,
      {
        type: "cashback",
        data: {
          categories: [{ id: "food", name: "Еда" }],
          months: [{ id: "2026-09", entries: [{ id: "entry-1" }] }],
          entries: [{ id: "legacy-entry" }],
        },
      },
      { type: "config", data: { rows: ["personal plan"] } },
      { type: "comment", data: { comment: "personal note" } },
    );
    vi.clearAllMocks();
  });

  it("removes personal data and preserves cashback categories only", async () => {
    const deleted = await clearAllUserData("user-1");

    expect(deleted).toEqual({
      transactions: 0,
      calendarPlans: 0,
      calendarNotes: 0,
      goals: 0,
      accounts: 0,
      balanceHistory: 0,
      aiLogs: 0,
      chatMessages: 0,
    });
    for (const model of [
      "transaction",
      "calendarPlan",
      "calendarNote",
      "goal",
      "account",
      "balanceHistory",
      "aiLog",
      "chatMessage",
    ]) {
      expect(fake.db[model].deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    }

    expect(fake.planGrids).toEqual([
      {
        userId: "user-1",
        type: "cashback",
        data: {
          categories: [{ id: "food", name: "Еда" }],
          months: [],
          entries: [],
        },
      },
    ]);
    expect(fake.db.category).toBeUndefined();
    expect(fake.db.currency).toBeUndefined();
    expect(fake.db.currencyRateSnapshot).toBeUndefined();
  });

  it("preserves cashback categories stored in the legacy all-in-one grid", async () => {
    fake.planGrids.splice(0, fake.planGrids.length, {
      type: "all",
      data: {
        cashback: {
          categories: [{ id: "travel", name: "Путешествия" }],
          months: [{ id: "2026-09", entries: [{ id: "entry-2" }] }],
        },
        config: { rows: ["old plan"] },
      },
    });

    await clearAllUserData("user-1");

    expect(fake.planGrids).toEqual([
      {
        userId: "user-1",
        type: "cashback",
        data: {
          categories: [{ id: "travel", name: "Путешествия" }],
          months: [],
          entries: [],
        },
      },
    ]);
  });
});