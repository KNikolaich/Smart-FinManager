import { db } from '../firebase';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { Account, Category, Transaction, AccountType } from '../types';
import { subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays } from 'date-fns';

export const generateDemoData = async (userId: string) => {
  console.log('Starting demo data generation for user:', userId);
  
  // 1. Ensure Categories exist
  const categoriesRef = collection(db, 'categories');
  const existingCategoriesSnap = await getDocs(query(categoriesRef, where('userId', '==', userId)));
  const existingCategories = existingCategoriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
  
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
  let catBatch = writeBatch(db);
  let catCount = 0;

  for (const defCat of defaultCategories) {
    if (!existingCategories.some(c => c.name === defCat.name)) {
      const newCatRef = doc(collection(db, 'categories'));
      catBatch.set(newCatRef, { ...defCat, userId });
      categories.push({ id: newCatRef.id, ...defCat, userId } as Category);
      catCount++;
    }
  }
  if (catCount > 0) await catBatch.commit();

  // 2. Ensure Accounts exist
  const accountsRef = collection(db, 'accounts');
  const existingAccountsSnap = await getDocs(query(accountsRef, where('userId', '==', userId)));
  const existingAccounts = existingAccountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
  
  const accountData = [
    { name: 'Наличные', type: 'cash' as AccountType, balance: 250000, currency: '₽' },
    { name: 'Кредитная карта', type: 'card' as AccountType, balance: -45000, currency: '₽' },
    { name: 'Бизнес-счет', type: 'bank' as AccountType, balance: 1200000, currency: '₽' },
  ];

  const accountsToProcess: Account[] = [];
  let accBatch = writeBatch(db);
  let accCount = 0;

  for (const acc of accountData) {
    const existing = existingAccounts.find(a => a.name === acc.name);
    if (!existing) {
      const newAccRef = doc(collection(db, 'accounts'));
      accBatch.set(newAccRef, { ...acc, userId });
      accountsToProcess.push({ id: newAccRef.id, ...acc, userId } as Account);
      accCount++;
    } else {
      accountsToProcess.push(existing);
    }
  }
  if (accCount > 0) await accBatch.commit();

  // 3. Create Transactions for previous 3 months
  const now = new Date();
  const months = [subMonths(now, 2), subMonths(now, 1), now];

  const salaryCat = categories.find(c => c.name === 'Зарплата');
  const freelanceCat = categories.find(c => c.name === 'Фриланс');
  const foodCat = categories.find(c => c.name === 'Продукты');
  const transportCat = categories.find(c => c.name === 'Транспорт');
  const rentCat = categories.find(c => c.name === 'Аренда');
  const shoppingCat = categories.find(c => c.name === 'Покупки');

  let transBatch = writeBatch(db);
  let transCount = 0;

  const commitBatch = async () => {
    if (transCount > 0) {
      await transBatch.commit();
      transBatch = writeBatch(db);
      transCount = 0;
    }
  };

  for (const monthDate of months) {
    const start = startOfMonth(monthDate);
    const end = monthDate === now ? now : endOfMonth(monthDate);
    
    for (const account of accountsToProcess) {
      // Monthly Salary
      if (account.name === 'Дебетовая карта' && salaryCat) {
        const salaryRef = doc(collection(db, 'transactions'));
        transBatch.set(salaryRef, {
          userId,
          accountId: account.id,
          categoryId: salaryCat.id,
          amount: 150000,
          type: 'income',
          description: 'Зарплата за месяц',
          createdAt: addDays(start, 4).toISOString()
        });
        transCount++;
      }

      if (account.name === 'Бизнес-счет' && freelanceCat) {
        const projectRef = doc(collection(db, 'transactions'));
        transBatch.set(projectRef, {
          userId,
          accountId: account.id,
          categoryId: freelanceCat.id,
          amount: 350000,
          type: 'income',
          description: 'Оплата по проекту',
          createdAt: addDays(start, 15).toISOString()
        });
        transCount++;
      }

      // Daily/Weekly Expenses
      const days = eachDayOfInterval({ start, end });
      for (const day of days) {
        if (transCount >= 450) await commitBatch();

        // Food
        if (Math.random() > 0.4 && foodCat) {
          const foodRef = doc(collection(db, 'transactions'));
          transBatch.set(foodRef, {
            userId,
            accountId: account.id,
            categoryId: foodCat.id,
            amount: Math.floor(1500 + Math.random() * 3000),
            type: 'expense',
            description: 'Продукты / Обед',
            createdAt: day.toISOString()
          });
          transCount++;
        }

        // Transport
        if (!isWeekend(day) && Math.random() > 0.2 && transportCat) {
          const transRef = doc(collection(db, 'transactions'));
          transBatch.set(transRef, {
            userId,
            accountId: account.id,
            categoryId: transportCat.id,
            amount: Math.floor(500 + Math.random() * 1000),
            type: 'expense',
            description: 'Транспорт / Такси',
            createdAt: day.toISOString()
          });
          transCount++;
        }

        // Shopping
        if (isWeekend(day) && Math.random() > 0.8 && shoppingCat) {
          const shopRef = doc(collection(db, 'transactions'));
          transBatch.set(shopRef, {
            userId,
            accountId: account.id,
            categoryId: shoppingCat.id,
            amount: Math.floor(5000 + Math.random() * 15000),
            type: 'expense',
            description: 'Покупки в ТЦ',
            createdAt: day.toISOString()
          });
          transCount++;
        }
      }

      // Monthly Rent
      if (account.name === 'Дебетовая карта' && rentCat) {
        const rentRef = doc(collection(db, 'transactions'));
        transBatch.set(rentRef, {
          userId,
          accountId: account.id,
          categoryId: rentCat.id,
          amount: 65000,
          type: 'expense',
          description: 'Аренда квартиры',
          createdAt: addDays(start, 2).toISOString()
        });
        transCount++;
      }
      
      await commitBatch();
    }
  }
  
  console.log('Demo data generation completed.');
};
