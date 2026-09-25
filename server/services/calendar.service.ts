import { prisma } from "../prisma";

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

async function upsertPlan(tx: any, userId: string, payment: LegacyPayment, strictReferences = false) {
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

async function loadPlans(userId: string) {
  return prisma.calendarPlan.findMany({
    where: { userId, archivedAt: null },
    include: {
      account: { select: { name: true } },
      category: { select: { name: true } },
      occurrences: {
        include: { transaction: { select: { id: true } } },
        orderBy: { date: "asc" },
      },
    },
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

  return listCalendar(userId);
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