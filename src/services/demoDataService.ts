import { api } from '../lib/api';
import { Account, Category, AccountType } from '../types';
import { subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays } from 'date-fns';

export const generateDemoData = async (userId: string) => {
  
  // 1. Ensure Categories exist
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
  const existingAccounts: Account[] = await api.get<Account[]>('/accounts');
  
  const accountData = [
    { name: 'Наличные', type: 'cash' as AccountType, balance: 250000, currency: '₽' },
    { name: 'Кредитная карта', type: 'card' as AccountType, balance: -45000, currency: '₽' },
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
  
};
