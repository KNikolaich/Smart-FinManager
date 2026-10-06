import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory stand-in for the Prisma calls the per-plan calendar service makes.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, any>;
  const state = {
    plans: new Map<string, Row>(),
    occurrences: [] as Row[],
    notes: new Map<string, Row>(),
  };

  const isDbNull = (value: unknown) =>
    Boolean(value && typeof value === "object" && String((value as any).constructor?.name).includes("Null"));
  const clean = (data: Row) => Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, isDbNull(value) ? null : value]),
  );
  const matches = (row: Row, where: Row = {}) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "notIn" in value) return !value.notIn.includes(row[key]);
    return value === null ? row[key] == null : row[key] === value;
  });
  const withRelations = (row: Row) => ({
    ...row,
    account: null,
    category: null,
    occurrences: state.occurrences
      .filter(item => item.calendarPlanId === row.id)
      .map(item => ({ ...item, transaction: item.transactionId ? { id: item.transactionId } : null })),
  });

  let sequence = 0;
  const prisma: Row = {
    planGrid: { findFirst: vi.fn(async () => null) },
    account: { findFirst: vi.fn(async () => ({ id: "account" })) },
    category: { findFirst: vi.fn(async () => ({ id: "category" })) },
    calendarPlan: {
      findMany: vi.fn(async ({ where }: Row) =>
        [...state.plans.values()].filter(item => matches(item, where)).map(withRelations)),
      findFirst: vi.fn(async ({ where, include }: Row) => {
        const row = [...state.plans.values()].find(item => matches(item, where));
        return row ? (include ? withRelations(row) : { ...row }) : null;
      }),
      findUnique: vi.fn(async ({ where }: Row) => state.plans.get(where.id) ?? null),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: data.id ?? `generated-${++sequence}`, createdAt: new Date(), ...clean(data) };
        state.plans.set(row.id, row);
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = { ...state.plans.get(where.id)!, ...clean(data) };
        state.plans.set(where.id, row);
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        let count = 0;
        for (const row of state.plans.values()) {
          if (matches(row, where)) {
            Object.assign(row, clean(data));
            count += 1;
          }
        }
        return { count };
      }),
    },
    calendarOccurrence: {
      upsert: vi.fn(async ({ where, update, create }: Row) => {
        const key = where.calendarPlanId_date;
        let row = state.occurrences.find(item =>
          item.calendarPlanId === key.calendarPlanId && item.date.getTime() === key.date.getTime());
        if (row) Object.assign(row, update);
        else {
          row = { id: `occ-${++sequence}`, ...create };
          state.occurrences.push(row);
        }
        return { ...row, transaction: null };
      }),
    },
    calendarNote: {
      findMany: vi.fn(async ({ where }: Row) => [...state.notes.values()].filter(item => matches(item, where))),
      findFirst: vi.fn(async ({ where }: Row) => [...state.notes.values()].find(item => matches(item, where)) ?? null),
      findUnique: vi.fn(async ({ where }: Row) => state.notes.get(where.id) ?? null),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: data.id ?? `note-${++sequence}`, ...data };
        state.notes.set(row.id, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = { ...state.notes.get(where.id)!, ...data };
        state.notes.set(where.id, row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: Row) => {
        for (const [id, row] of state.notes) if (matches(row, where)) state.notes.delete(id);
        return { count: 1 };
      }),
    },
  };
  prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(prisma));

  return { prisma, state };
});

vi.mock("../../server/prisma", () => ({ prisma: db.prisma }));

import {
  applyPlanEdit,
  archivePlan,
  createNote,
  createPlan,
  deleteNote,
  listCalendar,
  setManualCompletion,
  updateNote,
  updatePlan,
} from "../../server/services/calendar.service";

const utc = (key: string) => new Date(`${key}T00:00:00.000Z`);

// 2026-09-07 and 2026-09-14 are Mondays.
function seedSeries(extra: Record<string, unknown> = {}) {
  db.state.plans.set("mwf", {
    id: "mwf",
    userId: "user-1",
    title: "Секция",
    amount: 1500,
    date: utc("2026-09-07"),
    note: null,
    time: null,
    recurrence: "weekdays",
    weekdays: [1, 3, 5],
    transactionType: "expense",
    accountId: null,
    categoryId: null,
    color: null,
    disableFrom: null,
    excludedDates: null,
    archivedAt: null,
    createdAt: new Date(),
    ...extra,
  });
}

const input = (extra: Record<string, unknown> = {}) => ({
  title: "Секция",
  amount: 1500,
  date: "2026-09-07",
  recurrence: "weekdays",
  weekdays: [1, 3, 5],
  ...extra,
});

async function payments() {
  return (await listCalendar("user-1")).payments;
}

describe("per-plan calendar service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.state.plans.clear();
    db.state.notes.clear();
    db.state.occurrences.length = 0;
  });

  describe("createPlan", () => {
    it("stores a planned transfer with its target account and no category", async () => {
      const created = await createPlan("user-1", input({
        id: "transfer-1",
        recurrence: "monthly",
        weekdays: undefined,
        transactionType: "transfer",
        accountId: "card",
        targetAccountId: "savings",
        categoryId: "category",
      }));

      expect(created).toMatchObject({
        id: "transfer-1",
        transactionType: "transfer",
        accountId: "card",
        targetAccountId: "savings",
        categoryId: undefined,
      });
      expect(db.state.plans.get("transfer-1")).toMatchObject({ targetAccountId: "savings", categoryId: null });
    });

    it("rejects a planned transfer to the same account", async () => {
      await expect(createPlan("user-1", input({
        transactionType: "transfer",
        accountId: "card",
        targetAccountId: "card",
      }))).rejects.toMatchObject({ status: 400 });
      expect(db.state.plans.size).toBe(0);
    });

    it("drops the target account from a non-transfer plan", async () => {
      await createPlan("user-1", input({ id: "expense-1", accountId: "card", targetAccountId: "savings" }));

      expect(db.state.plans.get("expense-1")).toMatchObject({ transactionType: "expense", targetAccountId: null });
    });

    it("creates one plan with the client id", async () => {
      const created = await createPlan("user-1", input({ id: "payment-1" }));

      expect(created).toMatchObject({ id: "payment-1", date: "2026-09-07", weekdays: [1, 3, 5] });
      expect(db.state.plans.size).toBe(1);
    });

    it("is idempotent when the same request is retried", async () => {
      await createPlan("user-1", input({ id: "payment-1" }));
      await createPlan("user-1", input({ id: "payment-1", amount: 1600 }));

      expect(db.state.plans.size).toBe(1);
      expect(db.state.plans.get("payment-1")?.amount).toBe(1600);
    });

    it("rejects a weekday series that starts outside its weekdays", async () => {
      await expect(createPlan("user-1", input({ id: "p", date: "2026-09-15" })))
        .rejects.toMatchObject({ status: 400, message: expect.stringContaining("вторник") });
      expect(db.state.plans.size).toBe(0);
    });

    it("rejects incomplete plans", async () => {
      await expect(createPlan("user-1", input({ title: " " }))).rejects.toMatchObject({ status: 400 });
      await expect(createPlan("user-1", input({ amount: 0 }))).rejects.toMatchObject({ status: 400 });
      await expect(createPlan("user-1", input({ date: "15.09.2026" }))).rejects.toMatchObject({ status: 400 });
    });

    it("does not touch any other plan", async () => {
      seedSeries();
      await createPlan("user-1", input({ id: "other", recurrence: "none", weekdays: undefined }));

      expect(db.state.plans.get("mwf")?.archivedAt).toBeNull();
      expect(db.prisma.calendarPlan.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("updatePlan", () => {
    it("updates the template of an owned plan", async () => {
      seedSeries();

      const updated = await updatePlan("user-1", "mwf", input({ amount: 1800 }));

      expect(updated).toMatchObject({ id: "mwf", amount: 1800 });
    });

    it("answers 404 for a plan of another user", async () => {
      seedSeries({ userId: "user-2" });

      await expect(updatePlan("user-1", "mwf", input())).rejects.toMatchObject({ status: 404 });
    });

    it("validates the series only when its date or pattern changes", async () => {
      // Legacy plan whose start date is not one of its weekdays.
      seedSeries({ date: utc("2026-09-08") });

      await expect(updatePlan("user-1", "mwf", input({ date: "2026-09-08", title: "Новое" })))
        .resolves.toMatchObject({ title: "Новое" });
      await expect(updatePlan("user-1", "mwf", input({ date: "2026-09-15" })))
        .rejects.toMatchObject({ status: 400 });
    });

    it("keeps detached events even if the client sends other excluded dates", async () => {
      seedSeries({ excludedDates: ["2026-09-14"] });

      await updatePlan("user-1", "mwf", input({ excludedDates: [] }));

      expect(db.state.plans.get("mwf")?.excludedDates).toEqual(["2026-09-14"]);
    });
  });

  describe("archivePlan", () => {
    it("archives only the requested plan and can be repeated", async () => {
      seedSeries();
      db.state.plans.set("other", { ...db.state.plans.get("mwf"), id: "other" });

      await archivePlan("user-1", "mwf");
      await archivePlan("user-1", "mwf");

      expect(db.state.plans.get("mwf")?.archivedAt).toBeInstanceOf(Date);
      expect(db.state.plans.get("other")?.archivedAt).toBeNull();
    });
  });

  describe("applyPlanEdit", () => {
    it("detaches only one event of the series", async () => {
      seedSeries();

      const result = await applyPlanEdit("user-1", "mwf", {
        plan: input({ date: "2026-09-15", amount: 2000 }),
        originalDate: "2026-09-14",
        scope: "single",
        newPlanId: "payment-single-1",
      });

      expect(result.payments.map((item: any) => item.id).sort()).toEqual(["mwf", "payment-single-1"]);
      const stored = await payments();
      expect(stored.find((item: any) => item.id === "mwf")).toMatchObject({
        amount: 1500,
        weekdays: [1, 3, 5],
        excludedDates: ["2026-09-14"],
      });
      expect(stored.find((item: any) => item.id === "payment-single-1")).toMatchObject({
        amount: 2000,
        date: "2026-09-15",
        recurrence: "none",
        weekdays: null,
      });
    });

    it("changes the series from the edited event on", async () => {
      seedSeries();

      await applyPlanEdit("user-1", "mwf", {
        plan: input({ date: "2026-09-16", amount: 1800 }),
        originalDate: "2026-09-14",
        scope: "following",
        newPlanId: "payment-version-1",
      });

      const stored = await payments();
      expect(stored.find((item: any) => item.id === "mwf")).toMatchObject({ amount: 1500, disableFrom: "2026-09-13" });
      expect(stored.find((item: any) => item.id === "payment-version-1")).toMatchObject({
        amount: 1800,
        date: "2026-09-16",
        recurrence: "weekdays",
      });
    });

    it("refuses to move all following events to a day outside the weekdays", async () => {
      seedSeries();

      await expect(applyPlanEdit("user-1", "mwf", {
        plan: input({ date: "2026-09-15" }),
        originalDate: "2026-09-14",
        scope: "following",
      })).rejects.toMatchObject({ status: 400, message: expect.stringContaining("не входит в дни повторения") });
      expect(db.state.plans.size).toBe(1);
      expect(db.state.plans.get("mwf")?.disableFrom).toBeNull();
    });

    it("requires a scope for a recurring plan", async () => {
      seedSeries();

      await expect(applyPlanEdit("user-1", "mwf", { plan: input(), originalDate: "2026-09-14" }))
        .rejects.toMatchObject({ status: 400 });
    });

    it("rejects an event date that is not part of the series", async () => {
      seedSeries();

      await expect(applyPlanEdit("user-1", "mwf", {
        plan: input({ date: "2026-09-16" }),
        originalDate: "2026-09-15",
        scope: "single",
      })).rejects.toMatchObject({ status: 400, message: "Такого события нет в серии плана" });
    });

    it("moves a one-time plan in place", async () => {
      seedSeries({ recurrence: "none", weekdays: null, date: utc("2026-09-14") });

      const result = await applyPlanEdit("user-1", "mwf", {
        plan: input({ recurrence: "none", weekdays: undefined, date: "2026-09-16" }),
        originalDate: "2026-09-14",
      });

      expect(result.payments).toHaveLength(1);
      expect(db.state.plans.size).toBe(1);
      expect(db.state.plans.get("mwf")?.date).toEqual(utc("2026-09-16"));
    });

    it("does not reuse a new plan id that already exists", async () => {
      seedSeries();
      db.state.plans.set("taken", { ...db.state.plans.get("mwf"), id: "taken", userId: "user-2" });

      const result = await applyPlanEdit("user-1", "mwf", {
        plan: input({ date: "2026-09-15" }),
        originalDate: "2026-09-14",
        scope: "single",
        newPlanId: "taken",
      });

      const ids = result.payments.map((item: any) => item.id);
      expect(ids).toContain("mwf");
      expect(ids).not.toContain("taken");
      expect(db.state.plans.get("taken")?.userId).toBe("user-2");
    });
  });

  describe("occurrences", () => {
    it("does not complete an event that was detached from the series", async () => {
      seedSeries({ excludedDates: ["2026-09-14"] });

      await expect(setManualCompletion("user-1", "mwf", "2026-09-14", true))
        .rejects.toMatchObject({ status: 400 });
      await expect(setManualCompletion("user-1", "mwf", "2026-09-16", true))
        .resolves.toMatchObject({ date: "2026-09-16", manuallyCompleted: true });
    });
  });

  describe("notes", () => {
    it("creates, updates and deletes one note at a time", async () => {
      const created = await createNote("user-1", { id: "note-1", date: "2026-09-14", text: "Позвонить" });
      expect(created).toEqual({ id: "note-1", date: "2026-09-14", text: "Позвонить" });

      await expect(updateNote("user-1", "note-1", { date: "2026-09-15", text: "Перезвонить" }))
        .resolves.toEqual({ id: "note-1", date: "2026-09-15", text: "Перезвонить" });
      await expect(updateNote("user-2", "note-1", { date: "2026-09-15", text: "x" }))
        .rejects.toMatchObject({ status: 404 });

      await deleteNote("user-1", "note-1");
      expect(db.state.notes.size).toBe(0);
    });
  });
});
