import { api } from '../lib/api';
import { Account, Category, AccountType, PlanData, Goal } from '../types';
import { subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays, format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const generateDemoData = async (
  userId: string, 
  onProgress: (message: string) => void
) => {
  onProgress('Начинаем генерацию данных...');
  
  // 1. Ensure Categories exist
  onProgress('Проверка категорий...');
  const existingCategories: Category[] = await api.get<Category[]>('/categories');
  
  const defaultCategories = [
    { name: 'Зарплата', type: 'income', icon: '💰', color: '#10b981' },
    { name: 'Фриланс', type: 'income', icon: '💻', color: '#3b82f6' },
    { name: 'Продукты', type: 'expense', icon: '🍔', color: '#f59e0b' },
    { name: 'Транспорт', type: 'expense', icon: '🚗', color: '#6366f1' },
    { name: 'Аренда', type: 'expense', icon: '🏠', color: '#ef4444' },
    { name: 'Развлечения', type: 'expense', icon: '🎮', color: '#8b5cf6' },
    { name: 'Покупки', type: 'expense', icon: '🛍️', color: '#ec4899' },
    { name: 'Коммунальные услуги', type: 'expense', icon: '⚡', color: '#f97316' },
  ];

  const categories: Category[] = [...existingCategories];

  for (const defCat of defaultCategories) {
    if (!existingCategories.some(c => c.name === defCat.name)) {
      const created = await api.post<Category>('/categories', defCat);
      categories.push(created);
    }
  }

  // 2. Ensure Accounts exist
  onProgress('Проверка счетов...');
  const existingAccounts: Account[] = await api.get<Account[]>('/accounts');
  
  const accountData = [
    { name: 'Наличные', type: 'cash' as AccountType, balance: 250000, currency: '₽' },
    { name: 'Дебетовая карта', type: 'card' as AccountType, balance: 150000, currency: '₽' },
    { name: 'Бизнес-счет', type: 'bank' as AccountType, balance: 1200000, currency: '₽' },
  ];

  const accountsToProcess: Account[] = [];

  for (const acc of accountData) {
    const existing = existingAccounts.find(a => a.name === acc.name);
    if (!existing) {
      const created = await api.post<Account>('/accounts', acc);
      accountsToProcess.push(created);
    } else {
      accountsToProcess.push(existing);
    }
  }

  // 3. Create Transactions for previous 3 months
  const now = new Date();
  const months = [subMonths(now, 2), subMonths(now, 1), now];

  const salaryCat = categories.find(c => c.name === 'Зарплата');
  const freelanceCat = categories.find(c => c.name === 'Фриланс');
  const foodCat = categories.find(c => c.name === 'Продукты');
  const transportCat = categories.find(c => c.name === 'Транспорт');
  const rentCat = categories.find(c => c.name === 'Аренда');
  const shoppingCat = categories.find(c => c.name === 'Покупки');

  for (const monthDate of months) {
    const monthName = format(monthDate, 'LLLL', { locale: ru });
    onProgress(`Генерация транзакций за ${monthName}...`);
    
    const start = startOfMonth(monthDate);
    const end = monthDate === now ? now : endOfMonth(monthDate);
    
    for (const account of accountsToProcess) {
      // Monthly Salary
      if (account.name === 'Дебетовая карта' && salaryCat) {
        await api.post('/transactions', {
          accountId: account.id,
          categoryId: salaryCat.id,
          amount: 150000,
          type: 'income',
          description: 'Зарплата за месяц',
          createdAt: addDays(start, 4).toISOString()
        });
      }

      if (account.name === 'Бизнес-счет' && freelanceCat) {
        await api.post('/transactions', {
          accountId: account.id,
          categoryId: freelanceCat.id,
          amount: 350000,
          type: 'income',
          description: 'Оплата по проекту',
          createdAt: addDays(start, 15).toISOString()
        });
      }

      // Daily/Weekly Expenses
      const days = eachDayOfInterval({ start, end });
      for (const day of days) {
        // Food
        if (Math.random() > 0.4 && foodCat) {
          await api.post('/transactions', {
            accountId: account.id,
            categoryId: foodCat.id,
            amount: Math.floor(1500 + Math.random() * 3000),
            type: 'expense',
            description: 'Продукты / Обед',
            createdAt: day.toISOString()
          });
        }

        // Transport
        if (!isWeekend(day) && Math.random() > 0.2 && transportCat) {
          await api.post('/transactions', {
            accountId: account.id,
            categoryId: transportCat.id,
            amount: Math.floor(500 + Math.random() * 1000),
            type: 'expense',
            description: 'Транспорт / Такси',
            createdAt: day.toISOString()
          });
        }

        // Shopping
        if (isWeekend(day) && Math.random() > 0.8 && shoppingCat) {
          await api.post('/transactions', {
            accountId: account.id,
            categoryId: shoppingCat.id,
            amount: Math.floor(5000 + Math.random() * 15000),
            type: 'expense',
            description: 'Покупки в ТЦ',
            createdAt: day.toISOString()
          });
        }
      }

      // Monthly Rent
      if (account.name === 'Дебетовая карта' && rentCat) {
        await api.post('/transactions', {
          accountId: account.id,
          categoryId: rentCat.id,
          amount: 65000,
          type: 'expense',
          description: 'Аренда квартиры',
          createdAt: addDays(start, 2).toISOString()
        });
      }
    }
  }

  // 4. Create Goals
  onProgress('Генерация целей...');
  const goals = [
    { name: 'Новый ноутбук', targetAmount: 150000, currentAmount: 45000, deadline: addDays(now, 90) },
    { name: 'Отпуск на море', targetAmount: 200000, currentAmount: 100000, deadline: addDays(now, 180) },
    { name: 'Подушка безопасности', targetAmount: 500000, currentAmount: 250000, deadline: addDays(now, 365) },
  ];
  for (const goal of goals) {
    await api.post('/goals', goal);
  }

  // 5. Generate Plan
  onProgress('Генерация финансового плана...');
  const planData: PlanData = {
    id: 'default',
    userId,
    subjects: [
      { id: '1', name: 'Зарплата', color: '#d9ead3', textColor: '#000000', isArchived: false },
      { id: '2', name: 'Фриланс', color: '#d9ead3', textColor: '#000000', isArchived: false },
      { id: '3', name: 'Расходы', color: '#fff2cc', textColor: '#000000', isArchived: false },
    ],
    rows: [
      { id: '2026-04', label: 'Апр 26', type: 'month', cells: { '1': { value: '150' }, '2': { value: '350' }, '3': { value: '200' } } },
      { id: '2026-05', label: 'Май 26', type: 'month', cells: { '1': { value: '150' }, '2': { value: '300' }, '3': { value: '180' } } },
      { id: '2026-06', label: 'Июн 26', type: 'month', cells: { '1': { value: '150' }, '2': { value: '400' }, '3': { value: '220' } } },
    ],
    config: { targetAmount: 500, totalColumnColor: '#f3f3f3', headerColor: '#f3f3f3', firstColumnColor: '#f3f3f3', minRowColor: '#fff2cc' },
    cashback: {
      categories: [
        { id: '1', name: 'Супермаркеты', color: '#ffcc99' },
        { id: '2', name: 'Такси', color: '#ffff99' },
      ],
      months: [],
      entries: []
    },
    comment: 'План на ближайшие месяцы.',
    updatedAt: now.toISOString()
  };
  await api.post('/plan-grid', planData);

  onProgress('Готово!');
};
