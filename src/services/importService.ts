import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';
import { api } from '../lib/api';
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
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'mmbak') {
    return importFromMMBAK(file, onProgress, onLog, signal);
  } else if (extension === 'json') {
    return importFromJSON(file, onProgress, onLog, signal);
  } else {
    return importFromExcel(file, onProgress, onLog, signal);
  }
};

const importFromJSON = async (
  file: File,
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
    
    const accountsToImport: any[] = [];
    const categoriesToImport: any[] = [];
    const transactionsToImport: any[] = [];

    // 1. Import Assets -> Accounts
    const assets = data.ASSETS || data.Assets || data.assets || [];
    if (assets.length > 0) {
      if (onLog) onLog('Подготовка счетов из JSON...');
      for (const asset of assets) {
        const uid = asset.uid || asset.UID || asset.ID;
        const name = asset.NIC_NAME || asset.name || asset.Name;
        const description = asset.ZDATA1 || asset.description || asset.ZDATA;
        const currencyUid = asset.CurrencyUid || asset.currencyUid;

        if (!uid) continue;

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

        accountsToImport.push({
          id: uid.toString(),
          name: name || 'Unnamed Account',
          type,
          balance: 0,
          currency: currencyCode,
          description: description || '',
          showOnDashboard: true,
          showInTotals: true
        });
      }
    }

    // 2. Import ZCATEGORY -> Categories
    const categories = data.ZCATEGORY || data.zcategory || data.categories || [];
    if (categories.length > 0) {
      if (onLog) onLog('Подготовка категорий из JSON...');
      for (const cat of categories) {
        const uid = cat.uid || cat.UID || cat.ID;
        const name = cat.NAME || cat.Name || cat.name;
        const pUid = cat.pUid || cat.PUid;
        const typeVal = cat.TYPE !== undefined ? cat.TYPE : cat.type;
        
        const type: TransactionType = typeVal === 0 ? 'income' : 'expense';

        categoriesToImport.push({
          id: uid.toString(),
          name: name || 'Unnamed Category',
          type,
          icon: type === 'income' ? 'TrendingUp' : 'Tag',
          color: type === 'income' ? '#10b981' : '#6366f1',
          parentId: pUid ? pUid.toString() : null
        });
      }
    }

    // 3. Import INOUTCOME -> Transactions
    const transactions = data.INOUTCOME || data.inoutcome || data.transactions || [];
    if (transactions.length > 0) {
      if (onLog) onLog(`Подготовка операций из JSON (${transactions.length})...`);
      for (let i = 0; i < transactions.length; i++) {
        if (signal?.aborted) throw new Error('Import cancelled');
        const trans = transactions[i];
        const zmoney = trans.IN_ZMONEY || trans.zmoney || trans.amount || 0;
        const assetUid = trans.assetUid || trans.AssetUid;
        const ctgUid = trans.ctgUid || trans.CtgUid;
        const doType = trans.DO_TYPE !== undefined ? trans.DO_TYPE : trans.type;
        const toAssetUid = trans.toAssetUid || trans.ToAssetUid;
        const dateVal = trans.ZDATE || trans.date || trans.createdAt;
        
        if (doType == '4') continue;

        let type: TransactionType;
        if (doType === '3' || doType === '4') {
          type = 'transfer';
        } else {
          type = doType === '1' ? 'expense' : 'income';
        }
        
        const amount = Math.abs(zmoney);
        if (amount === 0) continue;

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

        transactionsToImport.push({
          accountId: assetUid.toString(),
          categoryId: type !== 'transfer' && ctgUid ? ctgUid.toString() : null,
          targetAccountId: type === 'transfer' && toAssetUid ? toAssetUid.toString() : null,
          amount,
          type,
          description: trans.description || trans.ZNOTES || trans.notes || '',
          createdAt: transactionDate.toISOString()
        });

        if (onProgress) onProgress(Math.round(((i + 1) / transactions.length) * 50));
      }
    }

    // 4. Send to API in chunks
    if (onLog) onLog('Отправка данных на сервер...');
    
    // Batch accounts and categories first
    await api.post('/import/batch', {
      accounts: accountsToImport,
      categories: categoriesToImport,
      transactions: []
    });

    // Batch transactions in chunks of 100 to avoid payload limits
    const chunkSize = 100;
    for (let i = 0; i < transactionsToImport.length; i += chunkSize) {
      if (signal?.aborted) throw new Error('Import cancelled');
      const chunk = transactionsToImport.slice(i, i + chunkSize);
      await api.post('/import/batch', {
        accounts: [],
        categories: [],
        transactions: chunk
      });
      importedCount += chunk.length;
      if (onProgress) onProgress(50 + Math.round(((i + chunk.length) / transactionsToImport.length) * 50));
      if (onLog) onLog(`Импортировано ${importedCount} операций...`);
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
        const totalRows = dataRows.length;
        if (onLog) onLog(`Найдено строк для импорта: ${totalRows}`);

        const transactionsToImport: any[] = [];
        const accountsToCreate: Set<string> = new Set();
        const categoriesToCreate: Set<string> = new Set();

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const dateStr = row[0];
          const accountName = row[1];
          const categoryOrTargetAccount = row[2];
          const subcategoryName = row[3] || '';
          const notes = row[4] || '';
          const amount = parseFloat(row[5]);
          const typeStr = row[6]?.toString().trim();

          if (!dateStr || !accountName || isNaN(amount)) continue;

          accountsToCreate.add(accountName);
          const isTransfer = typeStr === 'Снятие' || typeStr === 'Transfer';
          if (isTransfer) {
            accountsToCreate.add(categoryOrTargetAccount);
          } else if (categoryOrTargetAccount) {
            categoriesToCreate.add(`${categoryOrTargetAccount}_${(typeStr?.toLowerCase().includes('доход') || typeStr?.toLowerCase().includes('income')) ? 'income' : 'expense'}`);
          }

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

          transactionsToImport.push({
            accountName,
            categoryName: !isTransfer ? categoryOrTargetAccount : null,
            targetAccountName: isTransfer ? categoryOrTargetAccount : null,
            amount,
            type: isTransfer ? 'transfer' : (typeStr?.toLowerCase().includes('доход') || typeStr?.toLowerCase().includes('income')) ? 'income' : 'expense',
            description: [subcategoryName, notes].filter(Boolean).join(' - '),
            createdAt: transactionDate.toISOString()
          });
        }

        if (onLog) onLog('Синхронизация счетов и категорий...');
        
        // Fetch existing to avoid duplicates
        const [existingAccounts, existingCategories] = await Promise.all([
          api.get<Account[]>('/accounts'),
          api.get<Category[]>('/categories')
        ]);

        const accountsToImport = Array.from(accountsToCreate)
          .filter(name => !existingAccounts.some(a => a.name === name))
          .map(name => ({
            name,
            type: 'card',
            balance: 0,
            currency: 'RUB',
            showOnDashboard: true,
            showInTotals: true
          }));

        const categoriesToImport = Array.from(categoriesToCreate)
          .filter(key => {
            const [name, type] = key.split('_');
            return !existingCategories.some(c => c.name === name && c.type === type);
          })
          .map(key => {
            const [name, type] = key.split('_');
            return {
              name,
              type,
              icon: type === 'income' ? 'TrendingUp' : 'Tag',
              color: type === 'income' ? '#10b981' : '#6366f1'
            };
          });

        await api.post('/import/batch', {
          accounts: accountsToImport,
          categories: categoriesToImport,
          transactions: []
        });

        // Re-fetch to get IDs
        const [finalAccounts, finalCategories] = await Promise.all([
          api.get<Account[]>('/accounts'),
          api.get<Category[]>('/categories')
        ]);

        const mappedTransactions = transactionsToImport.map(t => {
          const account = finalAccounts.find(a => a.name === t.accountName);
          const category = t.categoryName ? finalCategories.find(c => c.name === t.categoryName && c.type === t.type) : null;
          const targetAccount = t.targetAccountName ? finalAccounts.find(a => a.name === t.targetAccountName) : null;

          return {
            accountId: account?.id,
            categoryId: category?.id,
            targetAccountId: targetAccount?.id,
            amount: t.amount,
            type: t.type,
            description: t.description,
            createdAt: t.createdAt
          };
        });

        if (onLog) onLog('Импорт операций...');
        const chunkSize = 100;
        for (let i = 0; i < mappedTransactions.length; i += chunkSize) {
          if (signal?.aborted) throw new Error('Import cancelled');
          const chunk = mappedTransactions.slice(i, i + chunkSize);
          await api.post('/import/batch', {
            accounts: [],
            categories: [],
            transactions: chunk
          });
          importedCount += chunk.length;
          if (onProgress) onProgress(Math.round(((i + chunk.length) / mappedTransactions.length) * 100));
        }

        if (onLog) onLog('Импорт из Excel успешно завершен!');
        resolve({ success: true, count: importedCount, errors: [] });
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

    const accountsToImport: any[] = [];
    const categoriesToImport: any[] = [];
    const transactionsToImport: any[] = [];

    // 1. Import Assets -> Accounts
    if (onLog) onLog('Чтение счетов...');
    const assetsRes = dbSql.exec("SELECT uid, NIC_NAME, ZDATA1, CurrencyUid FROM Assets");
    if (assetsRes.length > 0) {
      const assets = assetsRes[0].values;
      for (const asset of assets) {
        const [uid, name, description, currencyUid] = asset as [string, string, string, string];
        if (!uid) continue;

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

        accountsToImport.push({
          id: uid.toString(),
          name: name || 'Unnamed Account',
          type,
          balance: 0,
          currency: currencyCode,
          description: description || '',
          showOnDashboard: true,
          showInTotals: true
        });
      }
    }

    // 2. Import ZCATEGORY -> Categories
    if (onLog) onLog('Чтение категорий...');
    const categoriesRes = dbSql.exec("SELECT uid, Name, PUid, TYPE FROM ZCATEGORY");
    if (categoriesRes.length > 0) {
      const categories = categoriesRes[0].values;
      for (const cat of categories) {
        const [uid, name, pUid, typeVal] = cat as [string, string, string, number];
        const type: TransactionType = typeVal === 0 ? 'income' : 'expense';

        categoriesToImport.push({
          id: uid.toString(),
          name: name || 'Unnamed Category',
          type,
          icon: type === 'income' ? 'TrendingUp' : 'Tag',
          color: type === 'income' ? '#10b981' : '#6366f1',
          parentId: pUid && pUid !== '0' ? pUid.toString() : null
        });
      }
    }

    // 3. Import INOUTCOME -> Transactions
    if (onLog) onLog('Чтение операций...');
    const columnsRes = dbSql.exec("PRAGMA table_info(INOUTCOME)");
    const columns = columnsRes[0].values.map(v => v[1] as string);
    const dateField = columns.includes('ZDATE') ? 'ZDATE' : columns.includes('date') ? 'date' : 'uid';
    const notesField = columns.includes('ZNOTES') ? 'ZNOTES' : columns.includes('notes') ? 'notes' : null;

    const sqlQuery = `SELECT zmoney, currencyUid, assetUid, ctgUid, DO_TYPE, toAssetUid, ${dateField}, uid${notesField ? `, ${notesField}` : ''} FROM INOUTCOME ORDER BY uid DESC`;
    const transRes = dbSql.exec(sqlQuery);
    
    if (transRes.length > 0) {
      const transactions = transRes[0].values;
      for (let i = 0; i < transactions.length; i++) {
        if (signal?.aborted) throw new Error('Import cancelled');
        const row = transactions[i] as any[];
        const [zmoney, currencyUid, assetUid, ctgUid, doType, toAssetUid, dateVal, uid] = row;
        const notes = notesField ? row[8] : '';
        
        if (doType == "4") continue;

        let type: TransactionType;
        if (doType == '3' || doType == '4') {
          type = 'transfer';
        } else {
          type = doType == '0' ? 'income' : 'expense';
        }
        
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

        transactionsToImport.push({
          accountId: assetUid.toString(),
          categoryId: type !== 'transfer' && ctgUid ? ctgUid.toString() : null,
          targetAccountId: type === 'transfer' && toAssetUid ? toAssetUid.toString() : null,
          amount,
          type,
          description: notes || '',
          createdAt: transactionDate.toISOString()
        });
        if (onProgress) onProgress(Math.round(((i + 1) / transactions.length) * 50));
      }
    }

    if (onLog) onLog('Отправка данных на сервер...');
    await api.post('/import/batch', {
      accounts: accountsToImport,
      categories: categoriesToImport,
      transactions: []
    });

    let importedCount = 0;
    const chunkSize = 100;
    for (let i = 0; i < transactionsToImport.length; i += chunkSize) {
      if (signal?.aborted) throw new Error('Import cancelled');
      const chunk = transactionsToImport.slice(i, i + chunkSize);
      await api.post('/import/batch', {
        accounts: [],
        categories: [],
        transactions: chunk
      });
      importedCount += chunk.length;
      if (onProgress) onProgress(50 + Math.round(((i + chunk.length) / transactionsToImport.length) * 50));
      if (onLog) onLog(`Импортировано ${importedCount} операций...`);
    }

    if (onLog) onLog('Импорт из MMBAK успешно завершен!');
    return { success: true, count: importedCount, errors: [] };
  } catch (err: any) {
    console.error('MMBAK Import error:', err);
    return { success: false, count: 0, errors: [err.message] };
  }
};
