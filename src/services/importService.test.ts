import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { importFinancialData } from "./importService";

const userArchive = {
  format: "ai-fin-assistant-backup",
  version: 2,
  scope: "user",
  exportedAt: "2026-09-24T10:00:00.000Z",
  sourceUserId: "user-1",
  data: {
    profile: { displayName: "Анна", photoURL: null, settings: { theme: "dark" } },
    accounts: [],
    categories: [],
    transactions: [{ id: "transaction-1" }],
    goals: [],
    planGrids: [],
    calendarPlans: [],
    calendarOccurrences: [],
    calendarNotes: [],
    balanceHistory: [],
    chatMessages: [],
    aiLogs: [],
  },
};

const makeFile = (archive: unknown) =>
  new File([JSON.stringify(archive)], "backup.json", { type: "application/json" });
const confirmMock = vi.fn();

describe("full backup import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockReturnValue(true);
    Object.defineProperty(window, "confirm", { configurable: true, value: confirmMock });
    vi.mocked(api.post).mockResolvedValue({
      restoredCounts: { accounts: 1, transactions: 1, balanceHistory: 1 },
    } as any);
  });

  it("confirms before replacing data and calls the user restore endpoint", async () => {
    const progress = vi.fn();
    const log = vi.fn();

    const result = await importFinancialData(makeFile(userArchive), progress, log, undefined, { isAdmin: false });

    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining("заменит текущие данные"));
    expect(api.post).toHaveBeenCalledWith("/backup/restore", userArchive);
    expect(result).toEqual({ success: true, count: 1, errors: [] });
    expect(progress).toHaveBeenCalledWith(100);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Полный архив восстановлен"));
  });

  it("uses the administrator restore endpoint for currency-inclusive archives", async () => {
    const adminArchive = {
      ...userArchive,
      scope: "admin",
      referenceData: { currencies: [], currencyRateSnapshots: [], currencyRateCollectionRuns: [] },
    };

    const result = await importFinancialData(makeFile(adminArchive), undefined, undefined, undefined, { isAdmin: true });

    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining("историю курсов"));
    expect(api.post).toHaveBeenCalledWith("/admin/backup/restore", adminArchive);
    expect(result.success).toBe(true);
  });

  it("refuses administrator archives for non-admin users and leaves the API untouched", async () => {
    const adminArchive = {
      ...userArchive,
      scope: "admin",
      referenceData: { currencies: [], currencyRateSnapshots: [], currencyRateCollectionRuns: [] },
    };

    const result = await importFinancialData(makeFile(adminArchive), undefined, undefined, undefined, { isAdmin: false });

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Администраторскую копию может восстановить только администратор");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("does not send the archive if the user cancels the replacement confirmation", async () => {
    confirmMock.mockReturnValue(false);

    const result = await importFinancialData(makeFile(userArchive));

    expect(api.post).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Import cancelled");
  });
});