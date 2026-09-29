import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { PlannedPayment } from "../../src/types";
import {
  applyCalendarPlanEdit,
  CalendarPlanEditError,
  createCalendarPlanId,
  getSeriesDateError,
  isRecurringPlan,
} from "../../src/lib/calendarPlanEditing";
import { getPaymentOccurrencesInRange } from "../../src/lib/plannedPaymentOccurrences";

const VALID_RECURRENCES = new Set([
  "none",
  "weekly",
  "biweekly",
  "weekdays",
  "monthly",
  "quarterly",
  "yearly",
]);

type LegacyPayment = {
  id?: string;
  title?: string;
  amount?: number;
  date?: string;
  note?: string | null;
  time?: string | null;
  recurrence?: string;
  weekdays?: number[];
  transactionType?: string;
  accountId?: string;
  categoryId?: string;
  color?: string;
  disableFrom?: string | null;
  excludedDates?: string[] | null;
  status?: string;
  paidDates?: string[];
};

type LegacyCalendarNote = {
  id?: string;
  date?: string;
  text?: string;
};

function dateOnly(value: unknown) {
  const raw = String(value || "").slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Некорректная дата календаря");
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function paymentTime(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return value;
  }

  const error: any = new Error("Некорректное время календаря");
  error.status = 400;
  throw error;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function recurrence(value: unknown) {
  return VALID_RECURRENCES.has(String(value)) ? String(value) : "none";
}

function weekdays(value: unknown) {
  if (!Array.isArray(value)) return null;
  const normalized = Array.from(new Set(
    value
      .map(Number)
      .filter(day => Number.isInteger(day) && day >= 1 && day <= 7),
  )).sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : null;
}

function excludedDates(value: unknown) {
  if (!Array.isArray(value)) return null;
  const normalized = Array.from(new Set(
    value
      .map(item => String(item || "").slice(0, 10))
      .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item) && !Number.isNaN(Date.parse(`${item}T00:00:00Z`))),
  )).sort();
  return normalized.length > 0 ? normalized : null;
}

function transactionType(value: unknown) {
  return value === "income" ? "income" : "expense";
}

async function migrateLegacyCalendar(userId: string) {
  const legacy = await prisma.planGrid.findFirst({
    where: { userId, type: "calendar" },
  });
  if (!legacy) return;

  const payload = legacy.data as { payments?: LegacyPayment[]; notes?: LegacyCalendarNote[] } | null;
  if (!Array.isArray(payload?.payments)) {
    await prisma.planGrid.delete({ where: { id: legacy.id } });
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const payment of payload.payments) {
      await upsertPlan(tx, userId, payment);
    }
    if (Array.isArray(payload.notes)) {
      await replaceCalendarNotes(tx, userId, payload.notes);
    }
    await tx.planGrid.delete({ where: { id: legacy.id } });
  });
}

export async function ensureCalendarDataReady(userId: string) {
  await migrateLegacyCalendar(userId);
}

function calendarText(value: unknown, maxLength: number, message: string) {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > maxLength) {
    const error: any = new Error(message);
    error.status = 400;
    throw error;
  }
  return value.trim() || null;
}

async function upsertPlan(
  tx: any,
  userId: string,
  payment: LegacyPayment,
  strictReferences = false,
  { migratePaidDates = true }: { migratePaidDates?: boolean } = {},
) {
  const amount = Number(payment.amount);
  if (!payment.title?.trim() || !Number.isFinite(amount) || amount <= 0 || !payment.date) {
    return null;
  }

  const requestedId = typeof payment.id === "string" && payment.id.trim()
    ? payment.id.trim()
    : undefined;
  const owned = requestedId
    ? await tx.calendarPlan.findFirst({ where: { id: requestedId, userId } })
    : null;
  const occupiedByAnotherUser = requestedId && !owned
    ? await tx.calendarPlan.findUnique({ where: { id: requestedId }, select: { id: true } })
    : null;

  let accountId = payment.accountId || null;
  let categoryId = payment.categoryId || null;
  if (accountId) {
    const account = await tx.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      if (strictReferences) {
        const error: any = new Error("Счёт календаря не найден");
        error.status = 400;
        throw error;
      }
      accountId = null;
    }
  }
  if (categoryId) {
    const category = await tx.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      if (strictReferences) {
        const error: any = new Error("Категория календаря не найдена");
        error.status = 400;
        throw error;
      }
      categoryId = null;
    }
  }

  const data = {
    title: payment.title.trim(),
    amount,
    date: dateOnly(payment.date),
    note: calendarText(payment.note, 4000, "Комментарий к плану слишком длинный"),
    time: paymentTime(payment.time),
    recurrence: recurrence(payment.recurrence),
    weekdays: weekdays(payment.weekdays),
    transactionType: transactionType(payment.transactionType),
    accountId,
    categoryId,
    color: payment.color || null,
    disableFrom: payment.disableFrom ? dateOnly(payment.disableFrom) : null,
    excludedDates: excludedDates(payment.excludedDates) ?? Prisma.DbNull,
    archivedAt: null,
  };

  const plan = owned
    ? await tx.calendarPlan.update({ where: { id: owned.id }, data })
    : await tx.calendarPlan.create({
      data: {
        ...data,
        ...(requestedId && !occupiedByAnotherUser ? { id: requestedId } : {}),
        userId,
      },
    });

  // Existing paidDates are migrated as explicit manual completions. New
  // operation-backed completions are represented by the transaction relation.
  // Per-plan endpoints manage completions through occurrence requests only.
  if (!migratePaidDates) return plan;

  const paidDates = Array.isArray(payment.paidDates) ? payment.paidDates : [];
  if (payment.status === "paid" && paidDates.length === 0) {
    paidDates.push(payment.date);
  }
  for (const paidDate of paidDates) {
    try {
      await tx.calendarOccurrence.upsert({
        where: {
          calendarPlanId_date: {
            calendarPlanId: plan.id,
            date: dateOnly(paidDate),
          },
        },
        update: {},
        create: {
          calendarPlanId: plan.id,
          date: dateOnly(paidDate),
          manuallyCompletedAt: new Date(),
        },
      });
    } catch {
      // Ignore malformed legacy dates; the rest of the calendar is still
      // migrated and the user can recreate that occurrence from the UI.
    }
  }

  return plan;
}

async function upsertCalendarNote(tx: any, userId: string, note: LegacyCalendarNote) {
  if (!note.date) {
    const error: any = new Error("У заметки календаря должна быть дата");
    error.status = 400;
    throw error;
  }
  const text = calendarText(note.text, 2000, "Текст заметки слишком длинный");
  if (!text) {
    const error: any = new Error("Текст заметки не может быть пустым");
    error.status = 400;
    throw error;
  }

  const requestedId = typeof note.id === "string" && note.id.trim()
    ? note.id.trim()
    : undefined;
  const owned = requestedId
    ? await tx.calendarNote.findFirst({ where: { id: requestedId, userId } })
    : null;
  const occupiedByAnotherUser = requestedId && !owned
    ? await tx.calendarNote.findUnique({ where: { id: requestedId }, select: { id: true } })
    : null;
  const data = { date: dateOnly(note.date), text };

  return owned
    ? tx.calendarNote.update({ where: { id: owned.id }, data })
    : tx.calendarNote.create({
      data: {
        ...data,
        ...(requestedId && !occupiedByAnotherUser ? { id: requestedId } : {}),
        userId,
      },
    });
}

async function replaceCalendarNotes(tx: any, userId: string, notes: LegacyCalendarNote[]) {
  const retainedIds: string[] = [];
  for (const note of notes) {
    const saved = await upsertCalendarNote(tx, userId, note);
    retainedIds.push(saved.id);
  }
  await tx.calendarNote.deleteMany({
    where: {
      userId,
      ...(retainedIds.length > 0 ? { id: { notIn: retainedIds } } : {}),
    },
  });
}

const PLAN_INCLUDE = {
  account: { select: { name: true } },
  category: { select: { name: true } },
  occurrences: {
    include: { transaction: { select: { id: true } } },
    orderBy: { date: "asc" as const },
  },
};

async function loadPlans(userId: string) {
  return prisma.calendarPlan.findMany({
    where: { userId, archivedAt: null },
    include: PLAN_INCLUDE,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

function serializePlan(plan: any) {
  const occurrences = (plan.occurrences || []).map((item: any) => ({
    id: item.id,
    date: dateKey(item.date),
    transactionId: item.transaction?.id || null,
    manuallyCompleted: Boolean(item.manuallyCompletedAt),
  }));
  const paidDates = occurrences
    .filter((item: any) => item.transactionId || item.manuallyCompleted)
    .map((item: any) => item.date);

  return {
    id: plan.id,
    title: plan.title,
    amount: plan.amount,
    date: dateKey(plan.date),
    time: plan.time || undefined,
    recurrence: plan.recurrence,
    weekdays: weekdays(plan.weekdays),
    transactionType: plan.transactionType,
    accountId: plan.accountId || undefined,
    accountName: plan.account?.name,
    categoryId: plan.categoryId || undefined,
    categoryName: plan.category?.name,
    note: plan.note || undefined,
    status: paidDates.includes(dateKey(plan.date)) ? "paid" : "pending",
    paidDates,
    disableFrom: plan.disableFrom ? dateKey(plan.disableFrom) : null,
    excludedDates: excludedDates(plan.excludedDates) ?? [],
    color: plan.color || undefined,
    occurrences,
  };
}

export async function listCalendar(userId: string) {
  await ensureCalendarDataReady(userId);
  const [plans, notes] = await Promise.all([
    loadPlans(userId),
    prisma.calendarNote.findMany({
      where: { userId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return {
    payments: plans.map(serializePlan),
    notes: notes.map((note: any) => ({
      id: note.id,
      date: dateKey(note.date),
      text: note.text,
    })),
  };
}

export async function replaceCalendar(
  userId: string,
  payments: LegacyPayment[],
  notes?: LegacyCalendarNote[],
) {
  await migrateLegacyCalendar(userId);

  await prisma.$transaction(async (tx) => {
    const retainedIds: string[] = [];
    for (const payment of payments) {
      const plan = await upsertPlan(tx, userId, payment, true);
      if (plan) retainedIds.push(plan.id);
    }
    if (Array.isArray(notes)) {
      await replaceCalendarNotes(tx, userId, notes);
    }

    await tx.calendarPlan.updateMany({
      where: {
        userId,
        archivedAt: null,
        ...(retainedIds.length > 0 ? { id: { notIn: retainedIds } } : {}),
      },
      data: { archivedAt: new Date() },
    });
  });

  // The caller already holds the updated calendar state, and the controller
  // broadcasts an invalidation for other sessions. Avoid re-reading every
  // plan and occurrence after the transaction: a failed readback could report
  // a committed save as failed and adds latency to every calendar edit.
  return { success: true };
}

export async function setManualCompletion(
  userId: string,
  planId: string,
  date: string,
  completed: boolean,
) {
  const plan = await prisma.calendarPlan.findFirst({
    where: { id: planId, userId, archivedAt: null },
  });
  if (!plan) {
    const error: any = new Error("Запись календаря не найдена");
    error.status = 404;
    throw error;
  }

  const occurrenceDate = dateOnly(date);
  if (plan.disableFrom && occurrenceDate > plan.disableFrom) {
    const error: any = new Error("План отключён с этой даты");
    error.status = 400;
    throw error;
  }
  if (completed && (excludedDates(plan.excludedDates) || []).includes(dateKey(occurrenceDate))) {
    const error: any = new Error("Это событие перенесено отдельным планом");
    error.status = 400;
    throw error;
  }

  const occurrence = await prisma.calendarOccurrence.upsert({
    where: {
      calendarPlanId_date: {
        calendarPlanId: plan.id,
        date: occurrenceDate,
      },
    },
    update: { manuallyCompletedAt: completed ? new Date() : null },
    create: {
      calendarPlanId: plan.id,
      date: occurrenceDate,
      manuallyCompletedAt: completed ? new Date() : null,
    },
    include: { transaction: { select: { id: true } } },
  });

  return {
    id: occurrence.id,
    date: dateKey(occurrence.date),
    transactionId: occurrence.transaction?.id || null,
    manuallyCompleted: Boolean(occurrence.manuallyCompletedAt),
  };
}

export async function assertOccurrenceOwned(
  userId: string,
  occurrenceId: string,
  expectedDate?: string,
) {
  const occurrence = await prisma.calendarOccurrence.findFirst({
    where: {
      id: occurrenceId,
      calendarPlan: { userId, archivedAt: null },
    },
    include: { calendarPlan: true },
  });
  if (!occurrence) {
    const error: any = new Error("Вхождение календаря не найдено");
    error.status = 400;
    throw error;
  }
  if (expectedDate && dateKey(occurrence.date) !== expectedDate.slice(0, 10)) {
    const error: any = new Error("Дата операции не совпадает с датой календаря");
    error.status = 400;
    throw error;
  }
  return occurrence;
}

export async function ensureOccurrenceOwned(
  userId: string,
  planId: string,
  date: string,
) {
  const plan = await prisma.calendarPlan.findFirst({
    where: { id: planId, userId, archivedAt: null },
  });
  if (!plan) {
    const error: any = new Error("Запись календаря не найдена");
    error.status = 400;
    throw error;
  }

  const occurrenceDate = dateOnly(date);
  if (plan.disableFrom && occurrenceDate > plan.disableFrom) {
    const error: any = new Error("План отключён с этой даты");
    error.status = 400;
    throw error;
  }

  return prisma.calendarOccurrence.upsert({
    where: {
      calendarPlanId_date: {
        calendarPlanId: plan.id,
        date: occurrenceDate,
      },
    },
    update: {},
    create: {
      calendarPlanId: plan.id,
      date: occurrenceDate,
    },
  });
}

// ---------------------------------------------------------------------------
// Per-plan and per-note operations. Each request changes exactly one plan (or
// the plans produced by one editor save), so a problem with some other plan
// can never block it and concurrent devices do not overwrite each other.
// ---------------------------------------------------------------------------

type CalendarPlanInput = LegacyPayment & Record<string, unknown>;

export interface CalendarPlanEditRequest {
  plan?: CalendarPlanInput;
  originalDate?: string;
  scope?: string;
  newPlanId?: string;
}

const TEMPLATE_FIELDS = [
  "title", "amount", "date", "note", "time", "recurrence", "weekdays",
  "transactionType", "accountId", "categoryId", "color", "disableFrom",
] as const;

function httpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function requirePlanInput(payment: unknown): CalendarPlanInput {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
    throw httpError(400, "Некорректные данные плана");
  }
  const input = payment as CalendarPlanInput;
  const amount = Number(input.amount);
  if (typeof input.title !== "string" || !input.title.trim()) {
    throw httpError(400, "Укажите название плана");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw httpError(400, "Сумма плана должна быть больше нуля");
  }
  if (!isDateKey(String(input.date || "").slice(0, 10))) {
    throw httpError(400, "Некорректная дата плана");
  }
  if (input.disableFrom != null && input.disableFrom !== "" && !isDateKey(String(input.disableFrom).slice(0, 10))) {
    throw httpError(400, "Некорректная дата отключения плана");
  }
  return input;
}

function seriesShape(payment: LegacyPayment) {
  return {
    date: String(payment.date || "").slice(0, 10),
    recurrence: recurrence(payment.recurrence) as PlannedPayment["recurrence"],
    weekdays: weekdays(payment.weekdays) ?? undefined,
  };
}

function assertSeriesDate(payment: LegacyPayment) {
  const error = getSeriesDateError(seriesShape(payment));
  if (error) throw httpError(400, error);
}

/** Only the editable template fields; server-owned state is never taken from the client. */
function pickTemplate(payment: CalendarPlanInput) {
  const template: Record<string, unknown> = {};
  for (const field of TEMPLATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payment, field)) template[field] = payment[field];
  }
  return template as Partial<PlannedPayment>;
}

async function findOwnedPlan(db: any, userId: string, planId: string) {
  const plan = await db.calendarPlan.findFirst({
    where: { id: planId, userId, archivedAt: null },
    include: PLAN_INCLUDE,
  });
  if (!plan) throw httpError(404, "План календаря не найден");
  return plan;
}

async function readSerializedPlan(userId: string, planId: string) {
  return serializePlan(await findOwnedPlan(prisma, userId, planId));
}

function toPlannedPayment(plan: any): PlannedPayment {
  const serialized = serializePlan(plan);
  return { ...serialized, weekdays: serialized.weekdays ?? undefined } as PlannedPayment;
}

export async function createPlan(userId: string, payment: unknown) {
  const input = requirePlanInput(payment);
  assertSeriesDate(input);

  // A retried request (offline queue) reuses the same id and simply updates
  // the plan it already created.
  const plan = await prisma.$transaction((tx) =>
    upsertPlan(tx, userId, input, true, { migratePaidDates: false }),
  );
  return readSerializedPlan(userId, plan.id);
}

export async function updatePlan(userId: string, planId: string, payment: unknown) {
  const input = requirePlanInput(payment);
  const existing = await findOwnedPlan(prisma, userId, planId);

  // Only check the series when its shape changes: older plans may have been
  // saved before this rule existed and must stay editable otherwise.
  const before = seriesShape(toPlannedPayment(existing));
  const after = seriesShape(input);
  if (JSON.stringify(before) !== JSON.stringify(after)) assertSeriesDate(input);

  // Detached events are managed by the edit endpoint, not by a plain update.
  const kept = { ...input, id: planId, excludedDates: toPlannedPayment(existing).excludedDates };
  await prisma.$transaction((tx) =>
    upsertPlan(tx, userId, kept, true, { migratePaidDates: false }),
  );
  return readSerializedPlan(userId, planId);
}

export async function archivePlan(userId: string, planId: string) {
  // Idempotent: repeating the request (offline queue) is not an error.
  await prisma.calendarPlan.updateMany({
    where: { id: planId, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return { success: true };
}

/**
 * Applies a save from the plan editor. For an event of a recurring plan the
 * `scope` decides between detaching that one event ("single") and changing the
 * series from that event on ("following"); both are done in one transaction.
 */
export async function applyPlanEdit(userId: string, planId: string, request: CalendarPlanEditRequest) {
  const input = requirePlanInput(request?.plan);
  const existing = await findOwnedPlan(prisma, userId, planId);
  const current = toPlannedPayment(existing);
  const recurring = isRecurringPlan(current);

  const scope = request.scope;
  if (scope !== undefined && scope !== "single" && scope !== "following") {
    throw httpError(400, "Некорректная область изменения плана");
  }
  if (recurring && !scope) {
    throw httpError(400, "Укажите, изменить только это событие или все последующие");
  }

  const originalDate = request.originalDate ?? current.date;
  if (!isDateKey(originalDate)) throw httpError(400, "Некорректная дата события");
  if (recurring && getPaymentOccurrencesInRange(current, originalDate, originalDate).length === 0) {
    throw httpError(400, "Такого события нет в серии плана");
  }

  let newPlanId = typeof request.newPlanId === "string" && request.newPlanId.trim()
    ? request.newPlanId.trim()
    : undefined;
  if (newPlanId) {
    const taken = await prisma.calendarPlan.findUnique({ where: { id: newPlanId }, select: { id: true } });
    if (taken) newPlanId = undefined;
  }
  newPlanId ??= createCalendarPlanId([current]);

  const edited: PlannedPayment = { ...current, ...pickTemplate(input), id: planId };
  let result: PlannedPayment[];
  try {
    result = applyCalendarPlanEdit([current], edited, {
      originalDate,
      scope: scope as "single" | "following" | undefined,
      newPlanId,
    });
  } catch (error) {
    if (error instanceof CalendarPlanEditError) throw httpError(400, error.message);
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    for (const plan of result) {
      await upsertPlan(tx, userId, plan as LegacyPayment, true, { migratePaidDates: false });
    }
  });

  const payments = [];
  for (const plan of result) payments.push(await readSerializedPlan(userId, plan.id));
  return { payments };
}

export async function createNote(userId: string, note: unknown) {
  if (!note || typeof note !== "object") throw httpError(400, "Некорректная заметка календаря");
  const saved = await upsertCalendarNote(prisma, userId, note as LegacyCalendarNote);
  return { id: saved.id, date: dateKey(saved.date), text: saved.text };
}

export async function updateNote(userId: string, noteId: string, note: unknown) {
  if (!note || typeof note !== "object") throw httpError(400, "Некорректная заметка календаря");
  const existing = await prisma.calendarNote.findFirst({ where: { id: noteId, userId } });
  if (!existing) throw httpError(404, "Заметка календаря не найдена");
  const saved = await upsertCalendarNote(prisma, userId, { ...(note as LegacyCalendarNote), id: noteId });
  return { id: saved.id, date: dateKey(saved.date), text: saved.text };
}

export async function deleteNote(userId: string, noteId: string) {
  await prisma.calendarNote.deleteMany({ where: { id: noteId, userId } });
  return { success: true };
}
