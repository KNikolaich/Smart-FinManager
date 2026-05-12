import { api } from '../lib/api';
import { Account, Category, AccountType, PlanData } from '../types';
import { subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addDays, format, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';

export const generateDemoData = async (
  userId: string, 
  onProgress: (message: string) => void
) => {
  onProgress('Начинаем генерацию данных...');
  
  // 1. Ensure Categories exist (expanded list based on screenshot)
  onProgress('Создаем структуру категорий...');
  
  const rootCategoriesData = [
    { name: 'Income', type: 'income', icon: '💰', color: '#10b981', id: 'root_income' },
    { name: 'Food', type: 'expense', icon: '🍱', color: '#ff4d4d', id: 'root_food' },
    { name: 'Transport', type: 'expense', icon: '🚗', color: '#ffc21a', id: 'root_transport' },
    { name: 'Home', type: 'expense', icon: '🏠', color: '#898abd', id: 'root_home' },
    { name: 'Leisure', type: 'expense', icon: '🎭', color: '#2bb577', id: 'root_leisure' },
    { name: 'Health', type: 'expense', icon: '🛡️', color: '#5fe8aa', id: 'root_health' },
    { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#d60ac5', id: 'root_shopping' },
    { name: 'Education', type: 'expense', icon: '🎓', color: '#6366f1', id: 'root_education' },
    { name: 'Utilities', type: 'expense', icon: '⚡', color: '#f97316', id: 'root_utilities' },
  ];

  const categoryMap: Record<string, string> = {};

  for (const root of rootCategoriesData) {
    const created = await api.post<Category>('/categories', {
      name: root.name,
      type: root.type,
      icon: root.icon,
      color: root.color
    });
    categoryMap[root.id] = created.id;
  }

  const subCategoriesData = [
    { name: 'Зарплата', type: 'income', icon: '💵', color: '#10b981', parent: 'root_income' },
    { name: 'Фриланс', type: 'income', icon: '💻', color: '#3b82f6', parent: 'root_income' },
    { name: 'Бонус', type: 'income', icon: '🎁', color: '#f59e0b', parent: 'root_income' },
    
    { name: 'Продукты', type: 'expense', icon: '🛒', color: '#ff4d4d', parent: 'root_food' },
    { name: 'Кафе и рестораны', type: 'expense', icon: '🍽️', color: '#ff4d4d', parent: 'root_food' },
    { name: 'Фастфуд', type: 'expense', icon: '🌯', color: '#ff4d4d', parent: 'root_food' },
    
    { name: 'Такси', type: 'expense', icon: '🚕', color: '#ffc21a', parent: 'root_transport' },
    { name: 'Общественный транспорт', type: 'expense', icon: '🚌', color: '#ffc21a', parent: 'root_transport' },
    { name: 'Бензин', type: 'expense', icon: '⛽', color: '#ffc21a', parent: 'root_transport' },
    
    { name: 'Аренда', type: 'expense', icon: '🏠', color: '#898abd', parent: 'root_home' },
    { name: 'Ремонт', type: 'expense', icon: '🛠️', color: '#898abd', parent: 'root_home' },
    { name: 'Инструменты', type: 'expense', icon: '⚒️', color: '#898abd', parent: 'root_home' },
    
    { name: 'Кино и театры', type: 'expense', icon: '🎬', color: '#2bb577', parent: 'root_leisure' },
    { name: 'Путешествия', type: 'expense', icon: '🏔️', color: '#2bb577', parent: 'root_leisure' },
    { name: 'Хобби', type: 'expense', icon: '🎨', color: '#2bb577', parent: 'root_leisure' },
    
    { name: 'Аптека', type: 'expense', icon: '💊', color: '#5fe8aa', parent: 'root_health' },
    { name: 'Врачи', type: 'expense', icon: '👨‍⚕️', color: '#5fe8aa', parent: 'root_health' },
    { name: 'Спорт', type: 'expense', icon: '⚽', color: '#5fe8aa', parent: 'root_health' },
    
    { name: 'Одежда', type: 'expense', icon: '👕', color: '#d60ac5', parent: 'root_shopping' },
    { name: 'Обувь', type: 'expense', icon: '👟', color: '#d60ac5', parent: 'root_shopping' },
    { name: 'Электроника', type: 'expense', icon: '📱', color: '#d60ac5', parent: 'root_shopping' },
    
    { name: 'Книги', type: 'expense', icon: '📚', color: '#6366f1', parent: 'root_education' },
    { name: 'Курсы', type: 'expense', icon: '🎓', color: '#6366f1', parent: 'root_education' },
    
    { name: 'Электричество', type: 'expense', icon: '⚡', color: '#f97316', parent: 'root_utilities' },
    { name: 'Вода', type: 'expense', icon: '💧', color: '#f97316', parent: 'root_utilities' },
    { name: 'Интернет', type: 'expense', icon: '🌐', color: '#f97316', parent: 'root_utilities' },
  ];

  const categories: Category[] = [];
  for (const sub of subCategoriesData) {
    const created = await api.post<Category>('/categories', {
      name: sub.name,
      type: sub.type,
      icon: sub.icon,
      color: sub.color,
      parentId: categoryMap[sub.parent]
    });
    categories.push(created);
  }

  // 2. Ensure Accounts exist
  onProgress('Добавляем счета...');
  const accountData = [
    { name: 'Наличные', type: 'cash' as AccountType, balance: 25000, currency: '₽' },
    { name: 'МИР', type: 'card' as AccountType, balance: 185000, currency: '₽' },
    { name: 'airbag', type: 'bank' as AccountType, balance: 1450000, currency: '₽' },
  ];

  const accounts: Account[] = [];
  for (const acc of accountData) {
    const created = await api.post<Account>('/accounts', acc);
    accounts.push(created);
  }

  // 3. Create Transactions for previous 3 months
  const now = new Date();
  const months = [subMonths(now, 2), subMonths(now, 1), now];

  const salaryCat = categories.find(c => c.name === 'Зарплата');
  const bonusCat = categories.find(c => c.name === 'Бонус');
  const freelanceCat = categories.find(c => c.name === 'Фриланс');
  
  const foodCat = categories.find(c => c.name === 'Продукты');
  const cafeCat = categories.find(c => c.name === 'Кафе и рестораны');
  const transportCat = categories.find(c => c.name === 'Общественный транспорт');
  const taxiCat = categories.find(c => c.name === 'Такси');
  const rentCat = categories.find(c => c.name === 'Аренда');
  const shoppingCat = categories.find(c => c.name === 'Одежда');
  const techCat = categories.find(c => c.name === 'Электроника');

  for (const monthDate of months) {
    const monthName = format(monthDate, 'LLLL', { locale: ru });
    const start = startOfMonth(monthDate);
    const end = monthDate.getMonth() === now.getMonth() ? now : endOfMonth(monthDate);
    const days = eachDayOfInterval({ start, end });

    for (const day of days) {
      const dayStr = format(day, 'dd.MM.yyyy');
      onProgress(`Генерируем транзакции: ${dayStr}...`);
      
      // Incomes
      if (day.getDate() === 5 && salaryCat) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: salaryCat.id,
          amount: 120000,
          type: 'income',
          description: 'Зарплата',
          createdAt: day.toISOString()
        });
      }

      if (day.getDate() === 20 && salaryCat) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: salaryCat.id,
          amount: 80000,
          type: 'income',
          description: 'Аванс',
          createdAt: day.toISOString()
        });
      }

      if (day.getDate() === 15 && freelanceCat && Math.random() > 0.3) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'airbag')?.id,
          categoryId: freelanceCat.id,
          amount: Math.floor(50000 + Math.random() * 100000),
          type: 'income',
          description: 'Оплата проекта',
          createdAt: day.toISOString()
        });
      }

      // Daily Expenses
      if (foodCat && Math.random() > 0.3) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: foodCat.id,
          amount: Math.floor(800 + Math.random() * 2500),
          type: 'expense',
          description: 'Супермаркет',
          createdAt: day.toISOString()
        });
      }

      if (cafeCat && Math.random() > 0.7) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: cafeCat.id,
          amount: Math.floor(1500 + Math.random() * 4000),
          type: 'expense',
          description: 'Ужин',
          createdAt: day.toISOString()
        });
      }

      if (transportCat && !isWeekend(day) && Math.random() > 0.2) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: transportCat.id,
          amount: Math.floor(100 + Math.random() * 300),
          type: 'expense',
          description: 'Метро/Автобус',
          createdAt: day.toISOString()
        });
      }

      if (taxiCat && Math.random() > 0.8) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: taxiCat.id,
          amount: Math.floor(600 + Math.random() * 1500),
          type: 'expense',
          description: 'Такси',
          createdAt: day.toISOString()
        });
      }

      // Occasional Expenses
      if (shoppingCat && isWeekend(day) && Math.random() > 0.85) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: shoppingCat.id,
          amount: Math.floor(5000 + Math.random() * 15000),
          type: 'expense',
          description: 'Покупки',
          createdAt: day.toISOString()
        });
      }

      // Rent
      if (day.getDate() === 2 && rentCat) {
        await api.post('/transactions', {
          accountId: accounts.find(a => a.name === 'МИР')?.id,
          categoryId: rentCat.id,
          amount: 65000,
          type: 'expense',
          description: 'Аренда квартиры',
          createdAt: day.toISOString()
        });
      }
    }
  }

  // 4. Create Goals
  onProgress('Устанавливаем цели...');
  const goals = [
    { name: 'Новый iPhone 17', targetAmount: 180000, currentAmount: 45000, deadline: addDays(now, 120), sortOrder: 1 },
    { name: 'Отпуск на Бали', targetAmount: 350000, currentAmount: 120000, deadline: addDays(now, 200), sortOrder: 2 },
    { name: 'Подушка безопасности', targetAmount: 1000000, currentAmount: 450000, deadline: addDays(now, 365), sortOrder: 3 },
  ];
  for (const goal of goals) {
    await api.post('/goals', goal);
  }

  // 5. Generate Plan
  onProgress('Формируем финансовый план...');
  
  const cashbackCategories = [
    { id: "1", name: "Все покупки", color: "#ff0000" },
    { id: "2", name: "📶💳Оплата NFC или по", color: "#cccccc" },
    { id: "3", name: "🚗Автоуслуги", color: "#add8e6" },
    { id: "4", name: "⛽АЗС", color: "#add8e6" },
    { id: "5", name: "🩻Мед услуги", color: "#008000" },
    { id: "6", name: "💊Аптеки", color: "#008000" },
    { id: "7", name: "🛖Дом, ремонт", color: "#8b4513" },
    { id: "8", name: "😸Животные🐕", color: "#ffcc99" },
    { id: "9", name: "🧺Маркетплейсы", color: "#ffcccc" },
    { id: "10", name: "🍱🥢Кафе, бары, рестораны", color: "#ff0000" },
    { id: "11", name: "🌯Фастфуд", color: "#ff0000" },
    { id: "12", name: "Я маркет до", color: "#ffcc99" },
    { id: "13", name: "🛒Супермаркеты", color: "#ffcc99" },
    { id: "14", name: "🚕Такси", color: "#ffff99" },
    { id: "15", name: "🚌Транспорт общественный", color: "#ffff99" },
    { id: "16", name: "🚆ЖД транспорт", color: "#ffff99" },
    { id: "17", name: "🌹Цветы", color: "#ccff99" },
    { id: "18", name: "👟Одежда и обувь", color: "#d8bfd8" },
    { id: "19", name: "Спорттовары", color: "#d8bfd8" },
    { id: "20", name: "🤸‍♂️Активный отдых", color: "#cccccc" },
    { id: "21", name: "Развлечения", color: "#cccccc" },
    { id: "22", name: "Фитнес", color: "#cccccc" },
    { id: "23", name: "🚰Комунальные услуги", color: "#ffcccc" },
    { id: "24", name: "Все для НГ", color: "#ff0000" },
    { id: "25", name: "Строительные инст", color: "#ff0000" },
    { id: "26", name: "Мебель", color: "#ff0000" },
    { id: "27", name: "🎧Наушники и колонки", color: "#ff0000" },
    { id: "28", name: "Театры, кино", color: "#0000ff" },
    { id: "29", name: "📚Книги и концтовары", color: "#ccff99" },
    { id: "30", name: "Образование", color: "#add8e6" },
    { id: "31", name: "Электроника", color: "#8b4513" },
    { id: "32", name: "Цифровые товары", color: "#8b4513" },
    { id: "33", name: "Музыка", color: "#0000ff" },
    { id: "34", name: "Ювелирка", color: "#4b0082" },
    { id: "35", name: "Красота", color: "#4b0082" }
  ];

  const planData: Partial<PlanData> = {
    subjects: [
      { id: '1', name: 'Зарплата', color: '#d9ead3', textColor: '#000000', isArchived: false },
      { id: '2', name: 'Фриланс', color: '#d9ead3', textColor: '#000000', isArchived: false },
      { id: '3', name: 'Аренда', color: '#fff2cc', textColor: '#000000', isArchived: false },
      { id: '4', name: 'Продукты', color: '#fff2cc', textColor: '#000000', isArchived: false },
    ],
    rows: [
      { id: '2026-05', label: 'Май 26', type: 'month', cells: { '1': { value: '200' }, '2': { value: '150' }, '3': { value: '65' }, '4': { value: '45' } } },
      { id: '2026-06', label: 'Июн 26', type: 'month', cells: { '1': { value: '200' }, '2': { value: '180' }, '3': { value: '65' }, '4': { value: '45' } } },
      { id: '2026-07', label: 'Июл 26', type: 'month', cells: { '1': { value: '200' }, '2': { value: '160' }, '3': { value: '65' }, '4': { value: '50' } } },
    ],
    config: { targetAmount: 1500, totalColumnColor: '#f3f3f3', headerColor: '#f3f3f3', firstColumnColor: '#f3f3f3', minRowColor: '#fff2cc' },
    cashback: {
      categories: cashbackCategories,
      months: [],
      entries: []
    },
    comment: 'План на лето 2026.',
  };
  
  await api.post('/plan-grid', planData);

  onProgress('Готово!');
};

