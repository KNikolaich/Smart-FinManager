import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  setDoc,
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  increment,
  writeBatch
} from 'firebase/firestore';
import { Account, AccountType, Category, TransactionType } from '../types';

export interface ImportResult {
  success: boolean;
  count: number;
  errors: string[];
}

export const importFinancialData = async (
  file: File, 
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void,
  signal?: AbortSignal
): Promise<ImportResult> => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');

  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'mmbak') {
    return importFromMMBAK(file, userId, onProgress, onLog, signal);
  } else if (extension === 'json') {
    return importFromJSON(file, userId, onProgress, onLog, signal);
  } else {
    return importFromExcel(file, userId, onProgress, onLog, signal);
  }
};

const importFromJSON = async (
  file: File,
  userId: string,
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void,
  signal?: AbortSignal
): Promise<ImportResult> => {
  try {
    if (signal?.aborted) throw new Error('Import cancelled');
    if (onLog) onLog('Чтение JSON файла...');
    const text = await file.text();
    const data = JSON.parse(text);

    let importedCount = 0;
    const errors: string[] = [];
    const accountMap: Record<string, string> = {};
    // Карта для хранения соответствия UID категории из импортируемого файла
    // и ID категории в Firestore, а также её типа (доход/расход).
    const categoryMap: Record<string, { id: string; type: TransactionType }> = {};

    // Pre-populate maps with existing data to allow linking to existing accounts/categories
    if (onLog) onLog('Загрузка существующих счетов и категорий...');
    const [existingAccounts, existingCategories] = await Promise.all([
      getDocs(query(collection(db, 'accounts'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'categories'), where('userId', '==', userId)))
    ]);

    existingAccounts.docs.forEach(d => {
      accountMap[d.id] = d.id;
    });
    existingCategories.docs.forEach(d => {
      categoryMap[d.id] = { id: d.id, type: d.data().type as TransactionType };
    });

    // Fetch currencies for mapping
    if (onLog) onLog('Загрузка справочника валют...');
    const currenciesSnapshot = await getDocs(collection(db, 'currencies'));
    const currencyMapByUid: Record<string, string> = {};
    currenciesSnapshot.docs.forEach(d => {
      const data = d.data();
      currencyMapByUid[data.curUid] = d.id;
    });

    // 1. Import Assets -> Accounts
    const assets = data.ASSETS || data.Assets || data.assets || [];
    if (assets.length > 0) {
      if (onLog) onLog('Импорт счетов из JSON...');
      let accBatch = writeBatch(db);
      let accBatchSize = 0;
      for (const asset of assets) {
        try {
          const uid = asset.uid || asset.UID || asset.ID;
          const name = asset.NIC_NAME || asset.name || asset.Name;
          const description = asset.ZDATA1 || asset.description || asset.ZDATA;
          const currencyUid = asset.CurrencyUid || asset.currencyUid;

          if (!uid) {
            if (onLog) onLog(`⚠️ Пропущен счет без UID: ${name || 'без названия'}`);
            continue;
          }

          let type: AccountType = 'card';
          const lowerName = (name || '').toLowerCase();
          if (lowerName.includes('kk') || lowerName.includes('кк') || lowerName.includes('кред')) {
            type = 'credit';
          } else if (lowerName.includes('cash') || lowerName.includes('cach') || lowerName.includes('кэш') || lowerName.includes('нал')) {
            type = 'cash';
          } else if (lowerName.includes('инвест') || lowerName.includes('дело') || lowerName.includes('вклад') || lowerName.includes('копил')) {
            type = 'bank';
          }

          let currencyCode = 'RUB';
          if (currencyUid && currencyUid.includes('_')) {
            currencyCode = currencyUid.split('_')[1];
          }

          const accountId = uid.toString();
          const accountRef = doc(db, 'accounts', accountId);

          accBatch.set(accountRef, {
            userId,
            name: name || 'Unnamed Account',
            type,
            balance: 0,
            currency: currencyCode,
            currencyId: currencyMapByUid[currencyCode] || null,
            description: description || '',
            showOnDashboard: true,
            showInTotals: true
          });

          accountMap[uid] = accountId;
          accBatchSize++;
          if (accBatchSize >= 400) {
            await accBatch.commit();
            accBatch = writeBatch(db);
            accBatchSize = 0;
          }
        } catch (err) {
          if (onLog) onLog(`❌ Ошибка импорта счета: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (accBatchSize > 0) await accBatch.commit();
      if (onLog) onLog(`Импортировано счетов: ${Object.keys(accountMap).length}`);
    }

    // 2. Import ZCATEGORY -> Categories
    // Логика импорта категорий из JSON.
    const categories = data.ZCATEGORY || data.zcategory || data.categories || [];
    if (categories.length > 0) {
      if (onLog) onLog('Импорт категорий из JSON...');
      let catBatch = writeBatch(db);
      let catBatchSize = 0;
      for (const cat of categories) {
        try {
          const uid = cat.uid || cat.UID || cat.ID;
          const name = cat.NAME || cat.Name || cat.name;
          const pUid = cat.pUid || cat.PUid;
          const typeVal = cat.TYPE !== undefined ? cat.TYPE : cat.type;
          
          const categoryId = uid.toString();
          const categoryRef = doc(db, 'categories', categoryId);
          
          const type: TransactionType = typeVal === 0 ? 'income' : 'expense';

          catBatch.set(categoryRef, {
            userId,
            name: name || 'Unnamed Category',
            type,
            icon: type === 'income' ? 'TrendingUp' : 'Tag',
            color: type === 'income' ? '#10b981' : '#6366f1',
            parentId: pUid ? pUid.toString() : null
          });

          // Сохраняем категорию в карту для последующего использования при импорте транзакций.
          categoryMap[uid] = { id: categoryId, type };
          catBatchSize++;
          if (catBatchSize >= 400) {
            await catBatch.commit();
            catBatch = writeBatch(db);
            catBatchSize = 0;
          }
        } catch (err) {
          if (onLog) onLog(`❌ Ошибка импорта категории: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (catBatchSize > 0) await catBatch.commit();
      if (onLog) onLog(`Импортировано категорий: ${Object.keys(categoryMap).length}`);
    }

    // 3. Import INOUTCOME -> Transactions
    const transactions = data.INOUTCOME || data.inoutcome || data.transactions || [];
    if (transactions.length > 0) {
      if (onLog) onLog(`Импорт операций из JSON (${transactions.length})...`);
      let batch = writeBatch(db);
      let batchSize = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;
      const accountBalanceChanges: Record<string, number> = {};

      for (let i = 0; i < transactions.length; i++) {
        if (signal?.aborted) throw new Error('Import cancelled');
        try {
          const trans = transactions[i];
          const zmoney = trans.IN_ZMONEY || trans.zmoney || trans.amount || 0;
          const assetUid = trans.assetUid || trans.AssetUid;
          const ctgUid = trans.ctgUid || trans.CtgUid;
          const doType = trans.DO_TYPE !== undefined ? trans.DO_TYPE : trans.type;
          const toAssetUid = trans.toAssetUid || trans.ToAssetUid;
          const uid = trans.uid || trans.UID || i.toString();
          const dateVal = trans.ZDATE || trans.date || trans.createdAt;
          
          if (doType == '4') continue;

          const category = ctgUid ? categoryMap[ctgUid] : null;
          const categoryId = category ? category.id : null;
          
          let type: TransactionType;
          if (category) {
            type = category.type;
          } else {
            if (doType === '3' || doType === '4') {
              type = 'transfer';
            } else {
              type = doType === '1' ? 'expense' : 'income';
            }
          }
          
          const accountId = accountMap[assetUid];
          const targetAccountId = toAssetUid ? accountMap[toAssetUid] : null;

          if (!accountId) {
            if (onLog) onLog(`⚠️ Пропущена операция ${uid}: счет не найден (${assetUid})`);
            continue;
          }

          const transId = uid.toString();
          const transRef = doc(db, 'transactions', transId);
          const amount = Math.abs(zmoney);

          if (amount === 0) {
            if (onLog) onLog(`⚠️ Пропущена операция ${uid}: сумма равна 0`);
            continue;
          }

          let transactionDate = new Date();
          if (dateVal) {
            const numDate = parseFloat(dateVal);
            if (numDate > 1000000000) {
              transactionDate = new Date(numDate);
            } else if (numDate > 0) {
              transactionDate = new Date(2001, 0, 1);
              transactionDate.setSeconds(transactionDate.getSeconds() + numDate);
            } else {
              transactionDate = new Date(dateVal);
            }
          }
          if (!minDate || transactionDate < minDate) minDate = transactionDate;
          if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;

          batch.set(transRef, {
            userId,
            accountId,
            categoryId: type !== 'transfer' ? categoryId : null,
            targetAccountId: type === 'transfer' ? targetAccountId : null,
            amount,
            type,
            description: trans.description || trans.ZNOTES || trans.notes || '',
            createdAt: transactionDate.toISOString()
          });

          // Track balance changes
          const change = type === 'income' ? amount : -amount;
          accountBalanceChanges[accountId] = (accountBalanceChanges[accountId] || 0) + change;

          if (type === 'transfer' && targetAccountId) {
            accountBalanceChanges[targetAccountId] = (accountBalanceChanges[targetAccountId] || 0) + amount;
          }

          batchSize++;
          if (batchSize >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchSize = 0;
          }

          importedCount++;
          if (onProgress) onProgress(Math.round(((i + 1) / transactions.length) * 100));
          if (onLog && (i + 1) % 50 === 0) onLog(`Импортировано ${i + 1} операций...`);
        } catch (err) {
          if (onLog) onLog(`❌ Ошибка импорта операции: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (batchSize > 0) await batch.commit();

      // Apply aggregated balance changes
      if (onLog) onLog('Обновление балансов счетов...');
      let balanceBatch = writeBatch(db);
      let balanceBatchSize = 0;
      for (const [accId, change] of Object.entries(accountBalanceChanges)) {
        if (change === 0) continue;
        const accRef = doc(db, 'accounts', accId);
        balanceBatch.update(accRef, { balance: increment(change) });
        balanceBatchSize++;
        if (balanceBatchSize >= 450) {
          await balanceBatch.commit();
          balanceBatch = writeBatch(db);
          balanceBatchSize = 0;
        }
      }
      if (balanceBatchSize > 0) await balanceBatch.commit();

      if (onLog && minDate && maxDate) {
        onLog(`✅ Импорт завершен. Период операций: ${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`);
      }
    }

    if (onLog) onLog('Импорт из JSON успешно завершен!');
    return { success: true, count: importedCount, errors };
  } catch (err: any) {
    console.error('JSON Import error:', err);
    return { success: false, count: 0, errors: [err.message] };
  }
};

const importFromExcel = async (
  file: File, 
  userId: string,
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void,
  signal?: AbortSignal
): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (signal?.aborted) throw new Error('Import cancelled');
        if (onLog) onLog('Чтение Excel файла...');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (rows.length < 2) {
          resolve({ success: false, count: 0, errors: ['File is empty or missing data'] });
          return;
        }

        const dataRows = rows.slice(1);
        let importedCount = 0;
        let minDate: Date | null = null;
        let maxDate: Date | null = null;
        const errors: string[] = [];
        const totalRows = dataRows.length;
        if (onLog) onLog(`Найдено строк для импорта: ${totalRows}`);

        const accountCache: Record<string, string> = {};
        const categoryCache: Record<string, string> = {};

        // Pre-fetch all accounts and categories to minimize lookups
        if (onLog) onLog('Загрузка существующих данных...');
        const [existingAccounts, existingCategories] = await Promise.all([
          getDocs(query(collection(db, 'accounts'), where('userId', '==', userId))),
          getDocs(query(collection(db, 'categories'), where('userId', '==', userId)))
        ]);

        existingAccounts.docs.forEach(d => accountCache[d.data().name] = d.id);
        existingCategories.docs.forEach(d => {
          const data = d.data();
          categoryCache[`${data.name}_${data.type}`] = d.id;
        });

        let batch = writeBatch(db);
        let batchSize = 0;

        const getOrCreateAccount = async (name: string) => {
          let id = accountCache[name];
          if (!id) {
            const accountsRef = collection(db, 'accounts');
            let type: AccountType = 'card';
            const lowerName = name.toLowerCase();
            if (lowerName.includes('cach') || lowerName.includes('нал') || lowerName.includes('лавэ') || lowerName.includes('копилк')) {
              type = 'cash';
            } else if (lowerName.includes('кк') || lowerName.includes('кред') || lowerName.includes('kk')) {
              type = 'credit';
            } else if (lowerName.includes('вклад') || lowerName.includes('счет')) {
              type = 'bank';
            }

            const newAccRef = doc(accountsRef);
            batch.set(newAccRef, {
              userId,
              name: name,
              type,
              balance: 0,
              currency: 'RUB',
              showOnDashboard: true,
              showInTotals: true
            });
            id = newAccRef.id;
            accountCache[name] = id;
            batchSize++;
          }
          return id;
        };

        const getOrCreateCategory = async (name: string, type: TransactionType) => {
          const key = `${name}_${type}`;
          let id = categoryCache[key];
          if (!id) {
            const categoriesRef = collection(db, 'categories');
            const newCatRef = doc(categoriesRef);
            batch.set(newCatRef, {
              userId,
              name: name,
              type,
              icon: type === 'income' ? 'TrendingUp' : 'ShoppingBag',
              color: type === 'income' ? '#10b981' : '#ef4444'
            });
            id = newCatRef.id;
            categoryCache[key] = id;
            batchSize++;
          }
          return id;
        };

        const accountBalanceChanges: Record<string, number> = {};

        for (let i = 0; i < dataRows.length; i++) {
          if (signal?.aborted) {
            reject(new Error('Import cancelled'));
            return;
          }
          const row = dataRows[i];
          try {
            const dateStr = row[0];
            const accountName = row[1];
            const categoryOrTargetAccount = row[2];
            const subcategoryName = row[3] || '';
            const notes = row[4] || '';
            const amount = parseFloat(row[5]);
            const typeStr = row[6]?.toString().trim();

            if (!dateStr || !accountName || isNaN(amount)) continue;

            const isTransfer = typeStr === 'Снятие' || typeStr === 'Transfer';
            const description = [subcategoryName, notes].filter(Boolean).join(' - ');

            let transactionDate = new Date();
            if (dateStr) {
              const parts = dateStr.toString().split(/[ /:]/);
              if (parts.length >= 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);
                const hour = parseInt(parts[3]) || 0;
                const min = parseInt(parts[4]) || 0;
                const sec = parseInt(parts[5]) || 0;
                transactionDate = new Date(year, month, day, hour, min, sec);
              }
            }

            if (!minDate || transactionDate < minDate) minDate = transactionDate;
            if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;

            if (isTransfer) {
              const sourceId = await getOrCreateAccount(accountName);
              const destId = await getOrCreateAccount(categoryOrTargetAccount);
              
              const transRef = doc(collection(db, 'transactions'));
              batch.set(transRef, {
                userId,
                accountId: sourceId,
                targetAccountId: destId,
                amount,
                type: 'transfer',
                description: description || `Перевод: ${accountName} -> ${categoryOrTargetAccount}`,
                createdAt: transactionDate.toISOString()
              });

              accountBalanceChanges[sourceId] = (accountBalanceChanges[sourceId] || 0) - amount;
              accountBalanceChanges[destId] = (accountBalanceChanges[destId] || 0) + amount;
            } else {
              const type: TransactionType = (typeStr?.toLowerCase().includes('доход') || typeStr?.toLowerCase().includes('income')) 
                ? 'income' 
                : 'expense';

              const accountId = await getOrCreateAccount(accountName);
              const categoryId = categoryOrTargetAccount ? await getOrCreateCategory(categoryOrTargetAccount, type) : null;

              const transRef = doc(collection(db, 'transactions'));
              batch.set(transRef, {
                userId,
                accountId,
                categoryId,
                amount,
                type,
                description: description || categoryOrTargetAccount || '',
                createdAt: transactionDate.toISOString()
              });

              const change = type === 'income' ? amount : -amount;
              accountBalanceChanges[accountId] = (accountBalanceChanges[accountId] || 0) + change;
            }

            batchSize++;
            if (batchSize >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              batchSize = 0;
            }

            importedCount++;
            if (onProgress) onProgress(Math.round(((i + 1) / totalRows) * 100));
            if (onLog && (i + 1) % 50 === 0) onLog(`Обработано ${i + 1} из ${totalRows} строк...`);
          } catch (err: any) {
            errors.push(`Row error: ${err.message}`);
          }
        }

        if (batchSize > 0) await batch.commit();

        // Apply aggregated balance changes
        if (onLog) onLog('Обновление балансов счетов...');
        let balanceBatch = writeBatch(db);
        let balanceBatchSize = 0;
        for (const [accId, change] of Object.entries(accountBalanceChanges)) {
          if (change === 0) continue;
          const accRef = doc(db, 'accounts', accId);
          balanceBatch.update(accRef, { balance: increment(change) });
          balanceBatchSize++;
          if (balanceBatchSize >= 450) {
            await balanceBatch.commit();
            balanceBatch = writeBatch(db);
            balanceBatchSize = 0;
          }
        }
        if (balanceBatchSize > 0) await balanceBatch.commit();

        if (onLog && minDate && maxDate) {
          onLog(`✅ Импорт завершен. Период операций: ${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`);
        }

        resolve({ success: true, count: importedCount, errors });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

const importFromMMBAK = async (
  file: File, 
  userId: string,
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void,
  signal?: AbortSignal
): Promise<ImportResult> => {
  try {
    if (signal?.aborted) throw new Error('Import cancelled');
    if (onLog) onLog('Загрузка SQL.js WASM...');
    const wasmUrls = [
      `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.wasm`,
      `https://unpkg.com/sql.js@1.12.0/dist/sql-wasm.wasm`,
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm`,
      `https://sql.js.org/dist/sql-wasm.wasm`
    ];

    let wasmBinary: ArrayBuffer | null = null;
    let lastError: string = '';

    for (const url of wasmUrls) {
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (response.ok) {
          wasmBinary = await response.arrayBuffer();
          break;
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (!wasmBinary) {
      throw new Error(`Could not load SQL.js WASM. Last error: ${lastError}`);
    }

    if (onLog) onLog('Инициализация базы данных...');
    const SQL = await initSqlJs({ wasmBinary });
    const buffer = await file.arrayBuffer();
    const dbSql = new SQL.Database(new Uint8Array(buffer));

    if (onLog) onLog('Проверка таблиц...');
    const tables = dbSql.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values.map(v => v[0] as string) || [];

    if (!tableNames.includes('Assets') || !tableNames.includes('ZCATEGORY') || !tableNames.includes('INOUTCOME')) {
      return { success: false, count: 0, errors: ['Invalid SQLite file: Required tables (Assets, ZCATEGORY, INOUTCOME) not found'] };
    }

    let importedCount = 0;
    const errors: string[] = [];
    const accountMap: Record<string, string> = {};
    const categoryMap: Record<string, { id: string; type: TransactionType }> = {};

    // Pre-populate maps with existing data to allow linking to existing accounts/categories
    if (onLog) onLog('Загрузка существующих счетов и категорий...');
    const [existingAccounts, existingCategories] = await Promise.all([
      getDocs(query(collection(db, 'accounts'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'categories'), where('userId', '==', userId)))
    ]);

    existingAccounts.docs.forEach(d => {
      accountMap[d.id] = d.id;
    });
    existingCategories.docs.forEach(d => {
      categoryMap[d.id] = { id: d.id, type: d.data().type as TransactionType };
    });

    // Fetch currencies for mapping
    if (onLog) onLog('Загрузка справочника валют...');
    const currenciesSnapshot = await getDocs(collection(db, 'currencies'));
    const currencyMapByUid: Record<string, string> = {};
    currenciesSnapshot.docs.forEach(d => {
      const data = d.data();
      currencyMapByUid[data.curUid] = d.id;
    });

    // 1. Import Assets -> Accounts
    if (onLog) onLog('Импорт счетов...');
    const assetsRes = dbSql.exec("SELECT uid, NIC_NAME, ZDATA1, CurrencyUid FROM Assets");
    if (assetsRes.length > 0) {
      const assets = assetsRes[0].values;
      if (onLog) onLog(`Найдено счетов: ${assets.length}`);
      for (const asset of assets) {
        try {
          const [uid, name, description, currencyUid] = asset as [string, string, string, string];
          
          if (!uid) {
            if (onLog) onLog(`⚠️ Пропущен счет без UID: ${name || 'без названия'}`);
            continue;
          }

          let type: AccountType = 'card';
          const lowerName = (name || '').toLowerCase();
          if (lowerName.includes('kk') || lowerName.includes('кк') || lowerName.includes('кред')) {
            type = 'credit';
          } else if (lowerName.includes('cash') || lowerName.includes('cach') || lowerName.includes('кэш') || lowerName.includes('нал')) {
            type = 'cash';
          } else if (lowerName.includes('инвест') || lowerName.includes('дело') || lowerName.includes('вклад') || lowerName.includes('копил')) {
            type = 'bank';
          }

          let currencyCode = 'RUB';
          if (currencyUid && currencyUid.includes('_')) {
            currencyCode = currencyUid.split('_')[1];
          }

          // Use uid as document ID
          const accountId = uid.toString();
          const accountRef = doc(db, 'accounts', accountId);
          
          await setDoc(accountRef, {
            userId,
            name: name || 'Unnamed Account',
            type,
            balance: 0, // Balance will be updated by transactions
            currency: currencyCode,
            currencyId: currencyMapByUid[currencyCode] || null,
            description: description || '',
            showOnDashboard: true,
            showInTotals: true
          });
          
          accountMap[uid] = accountId;
        } catch (err) {
          if (onLog) onLog(`❌ Ошибка импорта счета: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // 2. Import ZCATEGORY -> Categories
    if (onLog) onLog('Импорт категорий...');
    const categoriesRes = dbSql.exec("SELECT uid, Name, PUid, TYPE FROM ZCATEGORY");
    if (categoriesRes.length > 0) {
      const categories = categoriesRes[0].values;
      if (onLog) onLog(`Найдено категорий: ${categories.length}`);
      for (const cat of categories) {
        try {
          const [uid, name, pUid, typeVal] = cat as [string, string, string, number];
          
          const categoryId = uid.toString();
          const categoryRef = doc(db, 'categories', categoryId);
          
          // Type: 0 = income, 1 = expense
          const type: TransactionType = typeVal === 0 ? 'income' : 'expense';

          await setDoc(categoryRef, {
            userId,
            name: name || 'Unnamed Category',
            type,
            icon: type === 'income' ? 'TrendingUp' : 'Tag',
            color: type === 'income' ? '#10b981' : '#6366f1',
            parentId: pUid && pUid !== '0' ? pUid.toString() : null
          });
          
          categoryMap[uid] = { id: categoryId, type };
        } catch (err) {
          if (onLog) onLog(`❌ Ошибка импорта категории: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // 3. Import INOUTCOME -> Transactions
    if (onLog) onLog('Импорт операций...');
    const columnsRes = dbSql.exec("PRAGMA table_info(INOUTCOME)");
    const columns = columnsRes[0].values.map(v => v[1] as string);
    const dateField = columns.includes('ZDATE') ? 'ZDATE' : columns.includes('date') ? 'date' : 'uid';
    const notesField = columns.includes('ZNOTES') ? 'ZNOTES' : columns.includes('notes') ? 'notes' : null;

    const sqlQuery = `SELECT zmoney, currencyUid, assetUid, ctgUid, DO_TYPE, toAssetUid, ${dateField}, uid${notesField ? `, ${notesField}` : ''} FROM INOUTCOME ORDER BY uid DESC`;
    const transRes = dbSql.exec(sqlQuery);
    
    if (transRes.length > 0) {
      const transactions = transRes[0].values;
      let batch = writeBatch(db);
      let batchSize = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;
      const accountBalanceChanges: Record<string, number> = {};

      for (let i = 0; i < transactions.length; i++) {
        if (signal?.aborted) throw new Error('Import cancelled');
        try {
          const row = transactions[i] as any[];
          const [zmoney, currencyUid, assetUid, ctgUid, doType, toAssetUid, dateVal, uid] = row;
          const notes = notesField ? row[8] : '';
          
          if (doType == "4") continue;

          const category = ctgUid ? categoryMap[ctgUid] : null;
          const categoryId = category ? category.id : null;
          
          let type: TransactionType;
          if (category) {
            type = category.type;
          } else {
            if (doType == '3' || doType == '4') {
              type = 'transfer';
            } else {
              type = doType == '0' ? 'income' : 'expense';
            }
          }
          const accountId = accountMap[assetUid];
          const targetAccountId = toAssetUid ? accountMap[toAssetUid] : null;

          if (!accountId) {
            if (onLog) onLog(`⚠️ Пропущена операция ${uid}: счет не найден (${assetUid})`);
            continue;
          }

          const transId = uid.toString();
          const transRef = doc(db, 'transactions', transId);
          const amount = Math.abs(zmoney);
          
          let transactionDate = new Date();
          if (dateVal) {
            const numDate = parseFloat(dateVal);
            if (numDate > 1000000000) {
              transactionDate = new Date(numDate);
            } else if (numDate > 0) {
              transactionDate = new Date(2001, 0, 1);
              transactionDate.setSeconds(transactionDate.getSeconds() + numDate);
            } else {
              transactionDate = new Date(dateVal);
            }
          }

          if (!minDate || transactionDate < minDate) minDate = transactionDate;
          if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;

          batch.set(transRef, {
            userId,
            accountId,
            categoryId: type !== 'transfer' ? categoryId : null,
            targetAccountId: type === 'transfer' ? targetAccountId : null,
            amount,
            type,
            description: notes || '',
            createdAt: transactionDate.toISOString()
          });

          // Track balance changes
          const change = type === 'income' ? amount : -amount;
          accountBalanceChanges[accountId] = (accountBalanceChanges[accountId] || 0) + change;

          if (type === 'transfer' && targetAccountId) {
            accountBalanceChanges[targetAccountId] = (accountBalanceChanges[targetAccountId] || 0) + amount;
          }

          batchSize++;
          if (batchSize >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchSize = 0;
          }

          importedCount++;
          if (onProgress) onProgress(Math.round(((i + 1) / transactions.length) * 100));
          if (onLog && (i + 1) % 50 === 0) onLog(`Импортировано ${i + 1} операций...`);
        } catch (err) {
          if (onLog) onLog(`❌ Ошибка импорта операции: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (batchSize > 0) await batch.commit();

      // Apply aggregated balance changes
      if (onLog) onLog('Обновление балансов счетов...');
      let balanceBatch = writeBatch(db);
      let balanceBatchSize = 0;
      for (const [accId, change] of Object.entries(accountBalanceChanges)) {
        if (change === 0) continue;
        const accRef = doc(db, 'accounts', accId);
        balanceBatch.update(accRef, { balance: increment(change) });
        balanceBatchSize++;
        if (balanceBatchSize >= 450) {
          await balanceBatch.commit();
          balanceBatch = writeBatch(db);
          balanceBatchSize = 0;
        }
      }
      if (balanceBatchSize > 0) await balanceBatch.commit();

      if (onLog && minDate && maxDate) {
        onLog(`✅ Импорт завершен. Период операций: ${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`);
      }
    }

    if (onLog) onLog('Импорт успешно завершен!');
    return { success: true, count: importedCount, errors };
  } catch (err: any) {
    console.error('SQLite Import error:', err);
    return { success: false, count: 0, errors: [err.message] };
  }
};
