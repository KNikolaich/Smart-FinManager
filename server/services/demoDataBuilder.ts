import { randomUUID } from "node:crypto";
import { DEMO_CATEGORY_TEMPLATES, DEMO_CASHBACK_CATEGORIES } from "../data/demoDataTemplate";

const USD_FALLBACK_RATE = 83.5;
const SAVINGS_TRANSFER_RUB = 20_000;
const MONTHLY_INCOME_RUB = 250_000;

export interface ExistingDemoCategory {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
}

export interface DemoCurrencyRef {
  id: string;
  iso: string;
  currency: string;
  symbol: string | null;
  rate: number;
}

export interface DemoCategoryRecord extends ExistingDemoCategory {
  userId: string;
  icon: string;
  color: string;
  sortOrder: number | null;
}

export interface DemoAccountRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  currencyId: string;
  description: string | null;
  showOnDashboard: boolean;
  showInTotals: boolean;
  isArchived: boolean;
  color: string | null;
}

export interface DemoTransactionRecord {
  id: string;
  userId: string;
  accountId: string;
  targetAccountId?: string;
  categoryId?: string;
  amount: number;
  targetAmount?: number;
  exchangeRate?: number;
  type: "income" | "expense" | "transfer";
  description: string;
  createdAt: Date;
}

export interface DemoAccountSeed {
  record: DemoAccountRecord;
  finalBalance: number;
  iso: string;
}

export interface DemoGoalRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline: Date;
  isCompleted: boolean;
  sortOrder: number;
}

export interface DemoBalanceHistoryRecord {
  id: string;
  userId: string;
  month: string;
  totalBalance: number;
  details: Array<{ accountId: string; name: string; currency: string; balance: number }>;
}

export interface DemoCalendarPlanRecord {
  id: string;
  userId: string;
  title: string;
  amount: number;
  date: Date;
  recurrence: "weekly" | "biweekly" | "monthly";
  transactionType: "income" | "expense";
  accountId: string;
  categoryId: string;
  color: string;
}

export interface DemoCalendarNoteRecord {
  id: string;
  userId: string;
  date: Date;
  text: string;
}

export interface DemoCategorySeed {
  rootRows: DemoCategoryRecord[];
  childRows: DemoCategoryRecord[];
  categoryIds: Map<string, string>;
}

export interface DemoDataset {
  accounts: DemoAccountSeed[];
  transactions: DemoTransactionRecord[];
  goals: DemoGoalRecord[];
  cashback: {
    categories: Array<{ id: string; name: string; color: string }>;
    months: unknown[];
    entries: unknown[];
  };
  balanceHistory: DemoBalanceHistoryRecord[];
  calendarPlans: DemoCalendarPlanRecord[];
  calendarNotes: DemoCalendarNoteRecord[];
  months: string[];
}

function categoryKey(name: string, type: string): string {
  return `${name}\u0000${type}`;
}

export function buildDemoCategorySeed(
  userId: string,
  existingCategories: ExistingDemoCategory[],
): DemoCategorySeed {
  const categoryIds = new Map<string, string>();
  const templateIndexesByName = new Map<string, number>();
  DEMO_CATEGORY_TEMPLATES.forEach((category, index) => {
    if (category.parentName === null) templateIndexesByName.set(category.name, index);
  });

  const rootRows: DemoCategoryRecord[] = [];
  const childRows: DemoCategoryRecord[] = [];
  const roots = DEMO_CATEGORY_TEMPLATES
    .map((template, index) => ({ template, index }))
    .filter(({ template }) => template.parentName === null);
  const children = DEMO_CATEGORY_TEMPLATES
    .map((template, index) => ({ template, index }))
    .filter(({ template }) => template.parentName !== null);

  for (const { template, index } of roots) {
    const existing = existingCategories.find(category =>
      category.name === template.name
      && category.type === template.type
      && category.parentId === null
    );
    const id = existing?.id ?? randomUUID();
    categoryIds.set(categoryKey(template.name, template.type), id);
    if (!existing) {
      rootRows.push({
        id,
        userId,
        name: template.name,
        type: template.type,
        icon: template.icon,
        color: template.color,
        parentId: null,
        sortOrder: template.sortOrder,
      });
    }
  }

  for (const { template } of children) {
    const parentIndex = templateIndexesByName.get(template.parentName!);
    if (parentIndex === undefined) {
      throw new Error(`Missing parent category template: ${template.parentName}`);
    }
    const parentTemplate = DEMO_CATEGORY_TEMPLATES[parentIndex];
    const parentId = categoryIds.get(categoryKey(parentTemplate.name, parentTemplate.type));
    if (!parentId) throw new Error(`Could not resolve parent category: ${template.parentName}`);

    const existing = existingCategories.find(category =>
      category.name === template.name
      && category.type === template.type
      && category.parentId === parentId
    );
    const id = existing?.id ?? randomUUID();
    categoryIds.set(categoryKey(template.name, template.type), id);
    if (!existing) {
      childRows.push({
        id,
        userId,
        name: template.name,
        type: template.type,
        icon: template.icon,
        color: template.color,
        parentId,
        sortOrder: template.sortOrder,
      });
    }
  }

  return { rootRows, childRows, categoryIds };
}

function deterministicAmount(monthIndex: number, day: number, base: number, spread: number): number {
  const variation = ((monthIndex + 3) * 7919 + day * 1049) % spread;
  return Math.round((base + variation) / 100) * 100;
}

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function categoryId(categoryIds: Map<string, string>, name: string, type: string): string {
  const id = categoryIds.get(categoryKey(name, type));
  if (!id) throw new Error(`Demo category is missing: ${name} (${type})`);
  return id;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function nextMonthlyDate(now: Date, day: number): Date {
  const candidate = utcDay(now.getUTCFullYear(), now.getUTCMonth(), day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (candidate.getTime() >= today) return candidate;
  return utcDay(now.getUTCFullYear(), now.getUTCMonth() + 1, day);
}

function nextScheduledDay(now: Date, days: number[]): Date {
  const candidates = days
    .map(day => utcDay(now.getUTCFullYear(), now.getUTCMonth(), day))
    .filter(date => date.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (candidates[0]) return candidates[0];
  return utcDay(now.getUTCFullYear(), now.getUTCMonth() + 1, days[0]);
}

function addUtcMonths(date: Date, months: number, day: number): Date {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth() + months, day);
}

function getCompletedMonths(now: Date): Array<{ year: number; month: number; key: string }> {
  const currentMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(currentMonthStart);
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      key: monthKey(date.getUTCFullYear(), date.getUTCMonth()),
    };
  });
}

function choosePaymentAccount(
  accounts: Map<string, DemoAccountSeed>,
  monthIndex: number,
  day: number,
  categoryName: string,
): string {
  if (categoryName === "авто / бензин" || categoryName === "мойка и др, обслуживающие") {
    return accounts.get("ВТБ")!.record.id;
  }
  if (categoryName === "За продуктами в магаз" || categoryName === "Коммунальные услуги") {
    return accounts.get("Сбер")!.record.id;
  }
  if (categoryName === "кофе/напитки" && day % 4 === 0) {
    return accounts.get("Кошелёк")!.record.id;
  }
  if ((monthIndex + day) % 9 === 0) {
    return accounts.get("Альфа кредитка")!.record.id;
  }
  if ((monthIndex + day) % 3 === 0) {
    return accounts.get("Сбер")!.record.id;
  }
  return accounts.get("ВТБ")!.record.id;
}

export function buildDemoCalendarSeed(
  userId: string,
  categoryIds: Map<string, string>,
  accountIdsByName: ReadonlyMap<string, string>,
  now = new Date(),
): { calendarPlans: DemoCalendarPlanRecord[]; calendarNotes: DemoCalendarNoteRecord[] } {
  const accountId = (name: string) => {
    const id = accountIdsByName.get(name);
    if (!id) throw new Error(`Demo account is missing: ${name}`);
    return id;
  };

  const calendarPlans: DemoCalendarPlanRecord[] = [
    {
      id: randomUUID(),
      userId,
      title: "Зарплата",
      amount: 200_000,
      date: nextMonthlyDate(now, 5),
      recurrence: "monthly",
      transactionType: "income",
      accountId: accountId("ВТБ"),
      categoryId: categoryId(categoryIds, "Зарплата", "income"),
      color: "blue",
    },
    {
      id: randomUUID(),
      userId,
      title: "Аванс",
      amount: 50_000,
      date: nextMonthlyDate(now, 25),
      recurrence: "monthly",
      transactionType: "income",
      accountId: accountId("ВТБ"),
      categoryId: categoryId(categoryIds, "Зарплата", "income"),
      color: "blue",
    },
    {
      id: randomUUID(),
      userId,
      title: "Квартплата / аренда",
      amount: 45_000,
      date: nextMonthlyDate(now, 15),
      recurrence: "monthly",
      transactionType: "expense",
      accountId: accountId("Сбер"),
      categoryId: categoryId(categoryIds, "Аренда", "expense"),
      color: "orange",
    },
    {
      id: randomUUID(),
      userId,
      title: "Коммунальные услуги",
      amount: 25_000,
      date: nextMonthlyDate(now, 8),
      recurrence: "monthly",
      transactionType: "expense",
      accountId: accountId("Сбер"),
      categoryId: categoryId(categoryIds, "Коммунальные услуги", "expense"),
      color: "orange",
    },
    {
      id: randomUUID(),
      userId,
      title: "Связь и интернет",
      amount: 1_200,
      date: nextMonthlyDate(now, 9),
      recurrence: "monthly",
      transactionType: "expense",
      accountId: accountId("Сбер"),
      categoryId: categoryId(categoryIds, "связь и интернет", "expense"),
      color: "orange",
    },
    {
      id: randomUUID(),
      userId,
      title: "Заправка",
      amount: 2_500,
      date: nextScheduledDay(now, [7, 14, 21, 28]),
      recurrence: "weekly",
      transactionType: "expense",
      accountId: accountId("ВТБ"),
      categoryId: categoryId(categoryIds, "авто / бензин", "expense"),
      color: "orange",
    },
    {
      id: randomUUID(),
      userId,
      title: "Маникюр",
      amount: 2_800,
      date: nextScheduledDay(now, [12, 26]),
      recurrence: "biweekly",
      transactionType: "expense",
      accountId: accountId("ВТБ"),
      categoryId: categoryId(categoryIds, "услуги", "expense"),
      color: "orange",
    },
  ];

  const firstSalaryDate = nextMonthlyDate(now, 5);
  const calendarNotes: DemoCalendarNoteRecord[] = Array.from({ length: 5 }, (_, index) => {
    const salaryDate = addUtcMonths(firstSalaryDate, index, 5);
    const monthOrdinal = salaryDate.getUTCFullYear() * 12 + salaryDate.getUTCMonth();
    return {
      id: randomUUID(),
      userId,
      date: utcDay(salaryDate.getUTCFullYear(), salaryDate.getUTCMonth(), 6),
      text: monthOrdinal % 2 === 1
        ? "После зарплаты отложи часть денег на Бали."
        : "После зарплаты пополни подушку безопасности.",
    };
  });

  return { calendarPlans, calendarNotes };
}

export function buildDemoDataset(
  userId: string,
  categoryIds: Map<string, string>,
  rub: DemoCurrencyRef,
  usd: DemoCurrencyRef,
  now = new Date(),
): DemoDataset {
  const accounts: DemoAccountSeed[] = [
    {
      record: {
        id: randomUUID(), userId, name: "ВТБ", type: "card", balance: 0, currency: "₽", currencyId: rub.id,
        description: null, showOnDashboard: true, showInTotals: true, isArchived: false, color: "#2563eb",
      },
      finalBalance: 15_000, iso: "RUB",
    },
    {
      record: {
        id: randomUUID(), userId, name: "Сбер", type: "card", balance: 0, currency: "₽", currencyId: rub.id,
        description: null, showOnDashboard: true, showInTotals: true, isArchived: false, color: "#16a34a",
      },
      finalBalance: 12_000, iso: "RUB",
    },
    {
      record: {
        id: randomUUID(), userId, name: "Кошелёк", type: "cash", balance: 0, currency: "₽", currencyId: rub.id,
        description: null, showOnDashboard: true, showInTotals: true, isArchived: false, color: "#f59e0b",
      },
      finalBalance: 5_000, iso: "RUB",
    },
    {
      record: {
        id: randomUUID(), userId, name: "Подушка $", type: "bank", balance: 0, currency: "$", currencyId: usd.id,
        description: null, showOnDashboard: true, showInTotals: true, isArchived: false, color: "#8b5cf6",
      },
      finalBalance: 300, iso: "USD",
    },
    {
      record: {
        id: randomUUID(), userId, name: "Вклад на Т", type: "bank", balance: 0, currency: "₽", currencyId: rub.id,
        description: null, showOnDashboard: true, showInTotals: true, isArchived: false, color: "#0891b2",
      },
      finalBalance: 1_500_000, iso: "RUB",
    },
    {
      record: {
        id: randomUUID(), userId, name: "Альфа кредитка", type: "credit", balance: 0, currency: "₽", currencyId: rub.id,
        description: null, showOnDashboard: true, showInTotals: true, isArchived: false, color: "#dc2626",
      },
      finalBalance: -60_000, iso: "RUB",
    },
  ];
  const accountByName = new Map(accounts.map(account => [account.record.name, account]));
  const accountsByName = new Map(accounts.map(account => [account.record.name, account]));
  const transactions: DemoTransactionRecord[] = [];
  const months = getCompletedMonths(now);
  const usdRateForTransfer = Number.isFinite(usd.rate) && usd.rate > 1
    ? usd.rate
    : USD_FALLBACK_RATE;

  const addTransaction = (input: Omit<DemoTransactionRecord, "id" | "userId">) => {
    transactions.push({ id: randomUUID(), userId, ...input });
  };

  for (const [monthIndex, month] of months.entries()) {
    const monthLength = daysInUtcMonth(month.year, month.month);
    const salaryCategoryId = categoryId(categoryIds, "Зарплата", "income");
    const salaryAccountId = accountByName.get("ВТБ")!.record.id;
    addTransaction({
      accountId: salaryAccountId,
      categoryId: salaryCategoryId,
      amount: 200_000,
      type: "income",
      description: "Зарплата",
      createdAt: utcDay(month.year, month.month, 5),
    });
    addTransaction({
      accountId: salaryAccountId,
      categoryId: salaryCategoryId,
      amount: 50_000,
      type: "income",
      description: "Аванс",
      createdAt: utcDay(month.year, month.month, 25),
    });

    // A salary-day transfer is recorded for history, but does not mutate either
    // account. Balances are set explicitly after all transactions are inserted.
    addTransaction({
      accountId: salaryAccountId,
      targetAccountId: accountByName.get("Подушка $")!.record.id,
      amount: SAVINGS_TRANSFER_RUB,
      targetAmount: Math.round((SAVINGS_TRANSFER_RUB / usdRateForTransfer) * 100) / 100,
      exchangeRate: usdRateForTransfer,
      type: "transfer",
      description: "Перевод 10% зарплаты в валютную подушку",
      createdAt: utcDay(month.year, month.month, 6),
    });

    addTransaction({
      accountId: accountByName.get("Сбер")!.record.id,
      categoryId: categoryId(categoryIds, "Аренда", "expense"),
      amount: 45_000,
      type: "expense",
      description: "Аренда квартиры",
      createdAt: utcDay(month.year, month.month, 15),
    });
    addTransaction({
      accountId: accountByName.get("Сбер")!.record.id,
      categoryId: categoryId(categoryIds, "Коммунальные услуги", "expense"),
      amount: 25_000,
      type: "expense",
      description: "Коммунальные услуги",
      createdAt: utcDay(month.year, month.month, 8),
    });

    // Daily coffee, with a few second visits each month.
    for (let day = 1; day <= monthLength; day += 1) {
      const cafeCategory = categoryId(categoryIds, "кофе/напитки", "expense");
      const cafeAccountId = choosePaymentAccount(accountsByName, monthIndex, day, "кофе/напитки");
      addTransaction({
        accountId: cafeAccountId,
        categoryId: cafeCategory,
        amount: 300,
        type: "expense",
        description: "Кофе",
        createdAt: utcDay(month.year, month.month, day),
      });
      if ([4, 12, 19, 27, 30].includes(day)) {
        addTransaction({
          accountId: cafeAccountId,
          categoryId: cafeCategory,
          amount: 300,
          type: "expense",
          description: "Кофе",
          createdAt: utcDay(month.year, month.month, day),
        });
      }
    }

    const fixedExpenses: Array<{ day: number; category: string; amount: number; description: string }> = [];
    for (const day of [7, 14, 21, 28]) {
      fixedExpenses.push({ day, category: "авто / бензин", amount: 2_500, description: "Заправка" });
    }
    for (const day of [12, 26]) {
      fixedExpenses.push({ day, category: "услуги", amount: 2_800, description: "Маникюр" });
    }

    for (const expense of fixedExpenses) {
      addTransaction({
        accountId: choosePaymentAccount(accountsByName, monthIndex, expense.day, expense.category),
        categoryId: categoryId(categoryIds, expense.category, "expense"),
        amount: expense.amount,
        type: "expense",
        description: expense.description,
        createdAt: utcDay(month.year, month.month, expense.day),
      });
    }

    const optionalExpenses: Array<{ day: number; category: string; amount: number; description: string }> = [];
    const groceryDays = [2, 8, 14, 20, 26];
    groceryDays.forEach((day, index) => {
      optionalExpenses.push({
        day,
        category: "За продуктами в магаз",
        amount: deterministicAmount(monthIndex, day, 3_800 + index * 150, 1_900),
        description: "Покупки в супермаркете",
      });
    });

    const recurringExtras = [
      { day: 3, category: "Фастфуд / Ресторан", base: 1_100, spread: 1_200, description: "Обед вне дома" },
      { day: 9, category: "связь и интернет", base: 1_200, spread: 400, description: "Связь и интернет" },
      { day: 10, category: "мойка и др, обслуживающие", base: 1_200, spread: 900, description: "Мойка автомобиля" },
      { day: 11, category: "лекарства", base: 1_000, spread: 1_500, description: "Аптека" },
      { day: 13, category: "Фастфуд / Ресторан", base: 1_200, spread: 1_300, description: "Обед вне дома" },
      { day: 16, category: "мебель и уют", base: 2_000, spread: 4_000, description: "Для дома" },
      { day: 18, category: "Одежда", base: 2_500, spread: 5_500, description: "Покупка одежды" },
      { day: 22, category: "кино, театр, цирк", base: 1_000, spread: 2_500, description: "Кино и развлечения" },
      { day: 24, category: "Подарки и праздник", base: 1_000, spread: 3_000, description: "Подарки и мелочи" },
      { day: 29, category: "экскурсии", base: 1_000, spread: 3_000, description: "Выходной и прогулка" },
    ];
    for (const extra of recurringExtras) {
      if (extra.day <= monthLength) {
        optionalExpenses.push({
          day: extra.day,
          category: extra.category,
          amount: deterministicAmount(monthIndex, extra.day, extra.base, extra.spread),
          description: extra.description,
        });
      }
    }

    const variedCategories = [
      "косметика", "Путешествия и кэмпинг", "ремонт", "Книга", "Спорт", "техника",
      "Прачечная", "обувь", "музыка", "йога", "аксессуары", "хобби", "образование",
      "Обследования", "сервисы", "Игры", "растения и садоводство ",
    ];
    for (let index = 0; index < 4; index += 1) {
      const day = [5, 17, 23, 30][index];
      if (day > monthLength) continue;
      const variedCategory = variedCategories[(monthIndex * 3 + index * 4) % variedCategories.length];
      optionalExpenses.push({
        day,
        category: variedCategory,
        amount: deterministicAmount(monthIndex, day, 3_500 + index * 700, 5_500),
        description: variedCategory === "Путешествия и кэмпинг" ? "Покупка для поездки" : "Покупка и повседневные расходы",
      });
    }

    const dailyCoffeeTotal = monthLength * 300 + [4, 12, 19, 27, 30].filter(day => day <= monthLength).length * 300;
    const fixedMonthlyExpenseTotal = 45_000 + 25_000 + dailyCoffeeTotal + 4 * 2_500 + 2 * 2_800;
    const reserve = 15_000;
    const optionalBudget = Math.max(
      0,
      MONTHLY_INCOME_RUB - SAVINGS_TRANSFER_RUB - fixedMonthlyExpenseTotal - reserve,
    );
    const optionalTotal = optionalExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const optionalScale = optionalTotal > optionalBudget && optionalTotal > 0
      ? optionalBudget / optionalTotal
      : 1;

    for (const expense of optionalExpenses) {
      const amount = Math.floor(expense.amount * optionalScale);
      if (amount <= 0) continue;
      addTransaction({
        accountId: choosePaymentAccount(accountsByName, monthIndex, expense.day, expense.category),
        categoryId: categoryId(categoryIds, expense.category, "expense"),
        amount,
        type: "expense",
        description: expense.description,
        createdAt: utcDay(month.year, month.month, expense.day),
      });
    }
  }

  const goals: DemoGoalRecord[] = [
    {
      id: randomUUID(),
      userId,
      name: "Отдых",
      description: null,
      targetAmount: 450_000,
      currentAmount: 150_000,
      currency: "RUB",
      deadline: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 180)),
      isCompleted: false,
      sortOrder: 1,
    },
    {
      id: randomUUID(),
      userId,
      name: "Дача",
      description: null,
      targetAmount: 75_000,
      currentAmount: 300,
      currency: "USD",
      deadline: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 730)),
      isCompleted: false,
      sortOrder: 2,
    },
  ];

  const finalRubleTotal = accounts.reduce((sum, account) => {
    const rate = account.iso === "USD" && Number.isFinite(usd.rate) && usd.rate > 0
      ? usd.rate
      : 1;
    return sum + account.finalBalance * rate;
  }, 0);
  const balanceHistory = months.map((month, index) => {
    const totalBalance = Math.round(finalRubleTotal - (months.length - index - 1) * 15_000);
    const ratio = finalRubleTotal !== 0 ? totalBalance / finalRubleTotal : 1;
    return {
      id: randomUUID(),
      userId,
      month: month.key,
      totalBalance,
      details: accounts.map(account => ({
        accountId: account.record.id,
        name: account.record.name,
        currency: account.record.currency,
        balance: Math.round(account.finalBalance * ratio * 100) / 100,
      })),
    };
  });

  const calendarSeed = buildDemoCalendarSeed(
    userId,
    categoryIds,
    new Map(accounts.map(account => [account.record.name, account.record.id])),
    now,
  );

  return {
    accounts,
    transactions,
    goals,
    cashback: {
      categories: DEMO_CASHBACK_CATEGORIES.map(category => ({
        id: randomUUID(),
        name: category.name,
        color: category.color,
      })),
      months: [],
      entries: [],
    },
    balanceHistory,
    calendarPlans: calendarSeed.calendarPlans,
    calendarNotes: calendarSeed.calendarNotes,
    months: months.map(month => month.key),
  };
}