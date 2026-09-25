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
});