import { prisma } from "../prisma";

const iconMap: Record<string, string> = {
  'железяки': '🛠️', 'кухня': '🛠️', 'мебель и уют': '🛠️', 'мелочной товар': '🛠️', 'ремонт': '🛠️', 'техника': '🛠️', 'туалетные принадлежности': '🛠️',
  'друг и другое на работе': '🎁',
  'Другая': '✏️',
  'Аксесуары, линзы': '🏥', 'зубы': '🏥', 'йога': '🏥', 'лекарства': '🏥', 'медицина': '🏥', 'прием врача': '🏥', 'суставы и глаза': '🏥',
  'аксессуары': '✨', 'косметика': '✨', 'макияж': '✨', 'услуги': '✨',
  'Кино': '🎭', 'Книга': '🎭', 'Музыка': '🎭', 'приложение': '🎭', 'театр': '🎭', 'цирк': '🎭', 'экскурсии': '🎭',
  'мода': '👕', 'обувь': '👕', 'Одежда': '👕', 'Прачечная': '👕', 'Украшения и девайсы': '👕',
  'госпоборы': '💰', 'интернет и сервисы': '💰', 'кв плата': '💰', 'проценты': '💰', 'связь и и-нет и сервисы': '💰', 'страховки': '💰',
  'в школе': '🛒', 'животным': '🛒', 'кофе/напитки': '🛒', 'обеды/ужины': '🛒', 'поход в магазин': '🛒', 'Рестораны/ кафе/напитки': '🛒',
  'братство': '🎮', 'кино, театр, цирк': '🎮', 'Отдых и аксесуары': '🎮', 'Подарки и праздник': '🎮', 'Пробухано': '🎮',
  'Игры': '🎓', 'музыка': '🎓', 'образование': '🎓', 'Спорт': '🎓', 'финансы': '🎓', 'хобби': '🎓',
  'авто / бензин': '✈️', 'Автобус, жд': '✈️', 'Вело': '✈️', 'запчасти и ремонт': '✈️', 'Метро': '✈️', 'мойка и др, обслуживающие': '✈️', 'страховка или штрафы': '✈️', 'Tакси': '✈️',
  'дачные ништяки': '🛠️', 'материалы для ремонтов': '🛠️', 'материалы и работы': '🛠️', 'растения и садоводство': '🛠️', 'техника и инструменты': '🛠️',
  'академия': '📚', 'обучение': '📚', 'поборы': '📚', 'учебники': '📚', 'Школьные принадлежности': '📚',
  'халтура': '🔨',
  'Бонус': '💳',
  'Др.': '💡',
  'Зарплата': '💰',
  'Карманные деньги': '🍿',
  'Такси': '🚕',
  'Халтура': '💻'
};

export async function importBatch(userId: string, body: any) {
  const { accounts, categories, transactions, goals, plan_grids, profile } = body;

  const createdAccounts: Record<string, string> = {};
  const createdCategories: Record<string, string> = {};
  const createdGoals: Record<string, string> = {};

  // Fetch existing accounts for validation
  const existingAccounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
  const validAccountIds = new Set(existingAccounts.map(a => a.id));

  // 1. Import Accounts
  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      // Remove relations like user, transactions, etc.
      const { id, uid, currencyUid, user, transactions: _t, ...accountData } = acc;

      // Handle currency
      let currencyCode = 'RUB';
      if (currencyUid === 'RUB_RUB') currencyCode = 'RUB';
      else if (currencyUid === 'RUB_USD') currencyCode = 'USD';
      else if (acc.currency) currencyCode = acc.currency;

      // Ensure currency exists
      await prisma.currency.upsert({
        where: { currency: currencyCode },
        update: {},
        create: { currency: currencyCode, name: currencyCode === 'RUB' ? 'Рубль' : 'Доллар', iso: currencyCode }
      });

      // Ensure account exists or update it
      const created = await prisma.account.upsert({
        where: { id: id },
        update: { ...accountData, uid: String(uid || id), userId, currency: currencyCode },
        create: { ...accountData, id: id, uid: String(uid || id), userId, currency: currencyCode }
      });
      if (id) createdAccounts[String(id)] = created.id;
      validAccountIds.add(created.id);
    }
  }

  // 2. Import Categories
  if (categories && categories.length > 0) {
    for (const cat of categories) {
      // Remove relations from data like children, user, etc.
      const { id, parentId, children, user, ...catData } = cat;

      // Apply icon if not already set
      if (!catData.icon) {
        const icon = iconMap[catData.name];
        if (icon) {
          catData.icon = icon;
        }
      }

      const created = await prisma.category.upsert({
        where: { id: id },
        update: {
          ...catData,
          userId,
          parentId: parentId && createdCategories[parentId] ? createdCategories[parentId] : null
        },
        create: {
          ...catData,
          id: id,
          userId,
          parentId: parentId && createdCategories[parentId] ? createdCategories[parentId] : null
        }
      });
      if (id) createdCategories[id] = created.id;
    }
  }

  // 3. Import Goals
  if (goals && goals.length > 0) {
    for (const goal of goals) {
      const { id, deadline, user, ...goalData } = goal;
      const created = await prisma.goal.upsert({
        where: { id: id },
        update: {
          ...goalData,
          deadline: deadline ? new Date(deadline) : null,
          userId
        },
        create: {
          ...goalData,
          id: id,
          deadline: deadline ? new Date(deadline) : null,
          userId
        }
      });
      if (id) createdGoals[id] = created.id;
    }
  }

  // 4. Import Transactions
  if (transactions && transactions.length > 0) {
    for (const trans of transactions) {
      const {
        accountId, targetAccountId, categoryId, subcategoryId, amount, createdAt,
        account, targetAccount, category, subcategory, user,
        ...transData
      } = trans;

      // Map IDs if they were provided in the import
      let mappedAccountId = createdAccounts[accountId] || accountId;
      let mappedTargetAccountId = targetAccountId ? (createdAccounts[targetAccountId] || targetAccountId) : null;
      const mappedCategoryId = categoryId ? (createdCategories[categoryId] || categoryId) : null;
      const mappedSubcategoryId = subcategoryId ? (createdCategories[subcategoryId] || subcategoryId) : null;

      // Validate account IDs, try to find by name if not found
      if (!validAccountIds.has(mappedAccountId)) {
        const accountFromImport = accounts.find((a: any) => a.id === accountId);
        if (accountFromImport) {
          const existingAccount = await prisma.account.findFirst({ where: { userId, name: accountFromImport.name } });
          if (existingAccount) {
            mappedAccountId = existingAccount.id;
            validAccountIds.add(mappedAccountId); // Add to valid set
          }
        }
      }
      if (mappedTargetAccountId && !validAccountIds.has(mappedTargetAccountId)) {
        const accountFromImport = accounts.find((a: any) => a.id === targetAccountId);
        if (accountFromImport) {
          const existingAccount = await prisma.account.findFirst({ where: { userId, name: accountFromImport.name } });
          if (existingAccount) {
            mappedTargetAccountId = existingAccount.id;
            validAccountIds.add(mappedTargetAccountId); // Add to valid set
          }
        }
      }

      if (!validAccountIds.has(mappedAccountId)) {
        console.error(`Account ID ${mappedAccountId} not found. Skipping transaction.`);
        continue;
      }
      if (mappedTargetAccountId && !validAccountIds.has(mappedTargetAccountId)) {
        console.error(`Target Account ID ${mappedTargetAccountId} not found. Skipping transaction.`);
        continue;
      }

      const { id, ...transactionData } = {
        ...transData,
        userId,
        accountId: mappedAccountId,
        targetAccountId: mappedTargetAccountId,
        categoryId: mappedCategoryId,
        subcategoryId: mappedSubcategoryId,
        amount: Number(amount),
        createdAt: createdAt ? new Date(createdAt) : new Date()
      };

      if (id) {
        await prisma.transaction.upsert({
          where: { id: id },
          update: transactionData,
          create: { id: id, ...transactionData }
        });
      } else {
        await prisma.transaction.create({
          data: transactionData
        });
      }

      // Update balances
      if (transData.type === 'expense') {
        await prisma.account.update({
          where: { id: mappedAccountId },
          data: { balance: { decrement: Number(amount) } }
        });
      } else if (transData.type === 'income') {
        await prisma.account.update({
          where: { id: mappedAccountId },
          data: { balance: { increment: Number(amount) } }
        });
      } else if (transData.type === 'transfer' && mappedTargetAccountId) {
        await prisma.account.update({
          where: { id: mappedAccountId },
          data: { balance: { decrement: Number(amount) } }
        });
        await prisma.account.update({
          where: { id: mappedTargetAccountId },
          data: { balance: { increment: Number(amount) } }
        });
      }
    }
  }

  // 5. Import Plan Grids
  if (plan_grids && plan_grids.length > 0) {
    for (const plan of plan_grids) {
      const { id, userId: planUserId, ...data } = plan;
      await prisma.planGrid.upsert({
        where: { userId_type: { userId, type: data.type } },
        update: { data: data.data || {} },
        create: { userId, type: data.type, data: data.data || {} }
      });
    }
  }

  // 6. Import Profile (Settings)
  if (profile && profile.length > 0) {
    const userProfile = profile[0];
    if (userProfile.settings) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          settings: userProfile.settings,
          displayName: userProfile.displayName || undefined,
          photoURL: userProfile.photoURL || undefined
        }
      });
    }
  }
}
