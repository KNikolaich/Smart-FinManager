import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const prisma: Record<string, any> = {
    planGrid: {
      findFirst: vi.fn(async () => null),
    },
    calendarPlan: {
      findMany: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    calendarNote: {
      findMany: vi.fn(),
    },
  };

  prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) =>
    callback({
      calendarPlan: {
        updateMany: prisma.calendarPlan.updateMany,
      },
    }),
  );

  return { prisma };
});

vi.mock("../../server/prisma", () => ({ prisma: fake.prisma }));

import { replaceCalendar } from "../../server/services/calendar.service";

describe("replaceCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms the transaction without an unnecessary full-calendar readback", async () => {
    await expect(replaceCalendar("user-1", [])).resolves.toEqual({ success: true });
    expect(fake.prisma.$transaction).toHaveBeenCalledOnce();
    expect(fake.prisma.calendarPlan.findMany).not.toHaveBeenCalled();
    expect(fake.prisma.calendarNote.findMany).not.toHaveBeenCalled();
  });

  it("stores the dates detached from a recurring plan normalized", async () => {
    const tx = {
      calendarPlan: {
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => ({ id: "plan-1", ...data })),
        updateMany: fake.prisma.calendarPlan.updateMany,
      },
      calendarOccurrence: { upsert: vi.fn() },
    };
    fake.prisma.$transaction.mockImplementationOnce(async (callback: (tx: any) => unknown) => callback(tx));

    await replaceCalendar("user-1", [{
      id: "plan-1",
      title: "Секция",
      amount: 1500,
      date: "2026-09-07",
      recurrence: "weekdays",
      weekdays: [1, 3, 5],
      excludedDates: ["2026-09-16", "2026-09-14", "2026-09-14", "garbage"],
    }]);

    expect(tx.calendarPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ excludedDates: ["2026-09-14", "2026-09-16"] }),
    }));
  });
});
