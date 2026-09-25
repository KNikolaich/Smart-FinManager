import { describe, expect, it } from "vitest";
import {
  buildDemoCategorySeed,
  buildDemoDataset,
} from "../../server/services/demoDataBuilder";
import { DEMO_CATEGORY_TEMPLATES } from "../../server/data/demoDataTemplate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const demoNow = new Date("2026-09-25T12:00:00.000Z");

function makeDataset(existingCategories: Array<{
  id: string;
  name: string;
  type: string;
  parentId: string | null;
}> = []) {
  const categorySeed = buildDemoCategorySeed("user-1", existingCategories);
  const dataset = buildDemoDataset(
    "user-1",
    categorySeed.categoryIds,
    { id: "rub-id", iso: "RUB", currency: "рубль", symbol: "₽", rate: 1 },
    { id: "usd-id", iso: "USD", currency: "$", symbol: "$", rate: 83.5 },
    demoNow,
  );
  return { categorySeed, dataset };
}

describe("demo data builder", () => {
  it("creates fresh UUIDs from the archived category templates and keeps their hierarchy", () => {
    const { categorySeed } = makeDataset();
    const newCategories = [...categorySeed.rootRows, ...categorySeed.childRows];
    const newIds = newCategories.map(category => category.id);

    expect(newCategories).toHaveLength(DEMO_CATEGORY_TEMPLATES.length);
    expect(newIds.every(id => UUID.test(id))).toBe(true);
    expect(new Set(newIds).size).toBe(newIds.length);
    expect(categorySeed.rootRows.every(category => category.parentId === null)).toBe(true);
    expect(categorySeed.childRows.every(category =>
      category.parentId && newIds.includes(category.parentId),
    )).toBe(true);
  });

  it("reuses matching user categories instead of duplicating them", () => {
    const { categorySeed } = makeDataset([
      { id: "existing-root", name: "Бытовые", type: "expense", parentId: null },
      { id: "existing-home", name: "техника", type: "expense", parentId: "existing-root" },
    ]);

    expect(categorySeed.categoryIds.get("Бытовые\u0000expense")).toBe("existing-root");
    expect(categorySeed.categoryIds.get("техника\u0000expense")).toBe("existing-home");
    expect(categorySeed.rootRows.some(category => category.name === "Бытовые")).toBe(false);
    expect(categorySeed.childRows.some(category => category.name === "техника")).toBe(false);
  });

  it("builds five completed months with the requested accounts, goals, and balance history", () => {
    const { dataset } = makeDataset();

    expect(dataset.months).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(dataset.accounts.map(account => [account.record.name, account.finalBalance])).toEqual([
      ["ВТБ", 15_000],
      ["Сбер", 12_000],
      ["Кошелёк", 5_000],
      ["Подушка $", 300],
      ["Вклад на Т", 1_500_000],
      ["Альфа кредитка", -60_000],
    ]);
    expect(dataset.accounts.every(account => account.record.balance === 0)).toBe(true);
    expect(dataset.goals.map(goal => [goal.name, goal.currentAmount, goal.targetAmount, goal.currency])).toEqual([
      ["Отдых", 150_000, 450_000, "RUB"],
      ["Дача", 300, 75_000, "USD"],
    ]);
    expect(dataset.balanceHistory.map(entry => entry.totalBalance)).toEqual([
      1_437_050, 1_452_050, 1_467_050, 1_482_050, 1_497_050,
    ]);
  });

  it("keeps monthly spending under income after the savings transfer", () => {
    const { dataset } = makeDataset();

    for (const month of dataset.months) {
      const transactions = dataset.transactions.filter(
        transaction => transaction.createdAt.toISOString().slice(0, 7) === month,
      );
      const income = transactions
        .filter(transaction => transaction.type === "income")
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      const transfers = transactions
        .filter(transaction => transaction.type === "transfer")
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      const expenses = transactions
        .filter(transaction => transaction.type === "expense")
        .reduce((sum, transaction) => sum + transaction.amount, 0);

      expect(income).toBe(250_000);
      expect(transfers).toBe(20_000);
      expect(expenses + transfers).toBeLessThanOrEqual(income - 15_000);
    }
  });

  it("records the currency conversion without applying it to account balances", () => {
    const { dataset } = makeDataset();
    const transfers = dataset.transactions.filter(transaction => transaction.type === "transfer");

    expect(transfers).toHaveLength(5);
    for (const transfer of transfers) {
      expect(transfer.amount).toBe(20_000);
      expect(transfer.targetAmount).toBeCloseTo(239.52, 2);
      expect(transfer.exchangeRate).toBe(83.5);
      expect(transfer.targetAccountId).toBe(dataset.accounts.find(a => a.record.name === "Подушка $")!.record.id);
    }
  });

  it("generates unique UUIDs for every new demo record", () => {
    const { categorySeed, dataset } = makeDataset();
    const ids = [
      ...categorySeed.rootRows.map(row => row.id),
      ...categorySeed.childRows.map(row => row.id),
      ...dataset.accounts.map(account => account.record.id),
      ...dataset.transactions.map(transaction => transaction.id),
      ...dataset.goals.map(goal => goal.id),
      ...dataset.cashback.categories.map(category => category.id),
      ...dataset.balanceHistory.map(row => row.id),
    ];

    expect(ids.every(id => UUID.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(dataset.cashback.categories).toHaveLength(35);
  });
});