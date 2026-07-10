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

// Guards against a cross-user IDOR: if the client-supplied `id` for an
// upsert already belongs to a *different* user's record, we must not let
// this import overwrite it (or re-parent it via `userId`). In that case we
// treat the item as brand-new by dropping the id, so it gets a fresh one.
async function safeIdFor(
  finder: (id: string) => Promise<{ userId: string } | null>,
  rawId: unknown,
  userId: string
): Promise<string | undefined> {
  if (rawId === undefined || rawId === null || rawId === '') return undefined;
  const id = String(rawId);
  const existing = await finder(id);
  if (existing && existing.userId !== userId) return undefined;
  return id;
}

export async function importBatch(userId: string, body: any) {
  const { accounts, categories, transactions, goals, plan_grids, profile } = body;

  const createdAccounts: Record<string, string> = {};
  const createdCategories: Record<string, string> = {};
  const createdGoals: Record<string, string> = {};

  // Fetch existing accounts/categories for validation
  const existingAccounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
  const validAccountIds = new Set(existingAccounts.map(a => a.id));
  const existingCategories = await prisma.category.findMany({ where: { userId }, select: { id: true } });
  const validCategoryIds = new Set(existingCategories.map(c => c.id));

  // 1. Import Accounts
  if (accounts && accounts.length > 0) {
    for (const acc of accounts) {
      // Remove relations like user, transactions, etc.
      const { id: rawId, uid, currencyUid, user, transactions: _t, ...accountData } = acc;
      const id = await safeIdFor(
        (existingId) => prisma.account.findUnique({ where: { id: existingId }, select: { userId: true } }),
        rawId,
        userId
      );

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

      // Ensure account exists or update it. If `id` was dropped by
      // safeIdFor (because it belonged to another user), this creates a
      // brand-new record with a freshly generated id instead.
      const created = id
        ? await prisma.account.upsert({
            where: { id },
            update: { ...accountData, uid: String(uid || id), userId, currency: currencyCode },
            create: { ...accountData, id, uid: String(uid || id), userId, currency: currencyCode }
          })
        : await prisma.account.create({
            data: { ...accountData, uid: String(uid || rawId || ''), userId, currency: currencyCode }
          });
      if (rawId) createdAccounts[String(rawId)] = created.id;
      validAccountIds.add(created.id);
    }
  }

  // 2. Import Categories
  if (categories && categories.length > 0) {
    for (const cat of categories) {
      // Remove relations from data like children, user, etc.
      const { id: rawId, parentId, children, user, ...catData } = cat;
      const id = await safeIdFor(
        (existingId) => prisma.category.findUnique({ where: { id: existingId }, select: { userId: true } }),
        rawId,
        userId
      );

      // Apply icon if not already set
      if (!catData.icon) {
        const icon = iconMap[catData.name];
        if (icon) {
          catData.icon = icon;
        }
      }

      const resolvedParentId = parentId && createdCategories[parentId] ? createdCategories[parentId] : null;
      const created = id
        ? await prisma.category.upsert({
            where: { id },
            update: { ...catData, userId, parentId: resolvedParentId },
            create: { ...catData, id, userId, parentId: resolvedParentId }
          })
        : await prisma.category.create({
            data: { ...catData, userId, parentId: resolvedParentId }
          });
      if (rawId) createdCategories[rawId] = created.id;
      validCategoryIds.add(created.id);
    }
  }

  // 3. Import Goals
  if (goals && goals.length > 0) {
    for (const goal of goals) {
      const { id: rawId, deadline, user, ...goalData } = goal;
      const id = await safeIdFor(
        (existingId) => prisma.goal.findUnique({ where: { id: existingId }, select: { userId: true } }),
        rawId,
        userId
      );

      const created = id
        ? await prisma.goal.upsert({
            where: { id },
            update: { ...goalData, deadline: deadline ? new Date(deadline) : null, userId },
            create: { ...goalData, id, deadline: deadline ? new Date(deadline) : null, userId }
          })
        : await prisma.goal.create({
            data: { ...goalData, deadline: deadline ? new Date(deadline) : null, userId }
          });
      if (rawId) createdGoals[rawId] = created.id;
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
      let mappedCategoryId = categoryId ? (createdCategories[categoryId] || categoryId) : null;
      let mappedSubcategoryId = subcategoryId ? (createdCategories[subcategoryId] || subcategoryId) : null;

      // Never let a transaction reference a category the current user
      // doesn't own (mirrors the account ownership check below) — otherwise
      // an attacker could probe/target another user's category ids.
      if (mappedCategoryId && !validCategoryIds.has(mappedCategoryId)) {
        console.error(`Category ID ${mappedCategoryId} not owned by user. Dropping category on import.`);
        mappedCategoryId = null;
      }
      if (mappedSubcategoryId && !validCategoryIds.has(mappedSubcategoryId)) {
        console.error(`Subcategory ID ${mappedSubcategoryId} not owned by user. Dropping subcategory on import.`);
        mappedSubcategoryId = null;
      }

      // Validate account IDs, try to find by name if not found
      if (!validAccountIds.has(mappedAccountId)) {
        const accountFromImport = accounts?.find((a: any) => a.id === accountId);
        if (accountFromImport) {
          const existingAccount = await prisma.account.findFirst({ where: { userId, name: accountFromImport.name } });
          if (existingAccount) {
            mappedAccountId = existingAccount.id;
            validAccountIds.add(mappedAccountId); // Add to valid set
          }
        }
      }
      if (mappedTargetAccountId && !validAccountIds.has(mappedTargetAccountId)) {
        const accountFromImport = accounts?.find((a: any) => a.id === targetAccountId);
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

      const { id: rawTransId, ...transactionData } = {
        ...transData,
        userId,
        accountId: mappedAccountId,
        targetAccountId: mappedTargetAccountId,
        categoryId: mappedCategoryId,
        subcategoryId: mappedSubcategoryId,
        amount: Number(amount),
        createdAt: createdAt ? new Date(createdAt) : new Date()
      };
      const id = await safeIdFor(
        (existingId) => prisma.transaction.findUnique({ where: { id: existingId }, select: { userId: true } }),
        rawTransId,
        userId
      );

      if (id) {
        await prisma.transaction.upsert({
          where: { id },
          update: transactionData,
          create: { id, ...transactionData }
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
