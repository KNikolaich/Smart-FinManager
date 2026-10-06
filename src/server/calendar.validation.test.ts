import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlannedPayment } from "../types";
import { api } from "../lib/api";
import { calendarApi } from "../lib/calendarApi";
import {
  calendarNoteSchema,
  calendarOccurrenceSchema,
  calendarPlanEditSchema,
  calendarPlanSchema,
} from "../../validation";

// The real request bodies built by the client must pass the route schemas —
// including the `id` a new plan/note carries and the one the offline queue adds.

const plan: PlannedPayment = {
  id: "payment-1",
  title: "Секция",
  amount: 1500,
  date: "2026-10-05",
  recurrence: "weekdays",
  weekdays: [1, 3, 5],
  transactionType: "expense",
  disableFrom: null,
  status: "pending",
  paidDates: ["2026-10-05"],
  occurrences: [],
  accountName: "Карта",
};

function captured(method: "post" | "put") {
  return vi.spyOn(api, method).mockResolvedValue({} as never);
}

describe("calendar route schemas accept the client's requests", () => {
  afterEach(() => vi.restoreAllMocks());

  it("create and update plan", async () => {
    const post = captured("post");
    const put = captured("put");
    await calendarApi.createPlan(plan);
    await calendarApi.updatePlan(plan);

    expect(calendarPlanSchema.safeParse(post.mock.calls[0][1]).success).toBe(true);
    expect(calendarPlanSchema.safeParse(put.mock.calls[0][1]).success).toBe(true);
  });

  it("planned transfer keeps its type and target account", async () => {
    const post = captured("post");
    await calendarApi.createPlan({
      ...plan,
      recurrence: "none",
      weekdays: undefined,
      transactionType: "transfer",
      accountId: "card",
      targetAccountId: "savings",
    });

    const parsed = calendarPlanSchema.safeParse(post.mock.calls[0][1]);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ transactionType: "transfer", accountId: "card", targetAccountId: "savings" });
  });

  it("editor save", async () => {
    const post = captured("post");
    await calendarApi.applyEdit("payment-1", plan, { originalDate: "2026-10-12", scope: "single", newPlanId: "p-2" });

    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect(calendarPlanEditSchema.safeParse(body).success).toBe(true);
    // As replayed from the offline queue, with an injected id.
    expect(calendarPlanEditSchema.safeParse({ ...body, id: "offline_abc" }).success).toBe(true);
  });

  it("occurrence and notes", async () => {
    const post = captured("post");
    const put = captured("put");
    await calendarApi.setOccurrenceCompleted("payment-1", "2026-10-05", true);
    await calendarApi.createNote({ id: "note-1", date: "2026-10-05", text: "Заметка" });
    await calendarApi.updateNote({ id: "note-1", date: "2026-10-06", text: "Заметка 2" });

    expect(calendarOccurrenceSchema.safeParse({ ...(post.mock.calls[0][1] as object), id: "offline_x" }).success).toBe(true);
    expect(calendarNoteSchema.safeParse(post.mock.calls[1][1]).success).toBe(true);
    expect(calendarNoteSchema.safeParse(put.mock.calls[0][1]).success).toBe(true);
  });

  it("strips server-owned keys", () => {
    const parsed = calendarPlanSchema.parse({ ...plan, userId: "someone-else", createdAt: "x" });
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed).not.toHaveProperty("paidDates");
  });

  it("rejects malformed values", () => {
    expect(calendarPlanSchema.safeParse({ ...plan, date: "05.10.2026" }).success).toBe(false);
    expect(calendarPlanSchema.safeParse({ ...plan, recurrence: "daily" }).success).toBe(false);
    expect(calendarPlanEditSchema.safeParse({ plan, scope: "all" }).success).toBe(false);
    expect(calendarOccurrenceSchema.safeParse({ completed: "yes" }).success).toBe(false);
  });
});
