import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';
import { api } from '../lib/api';
import { Account, AccountType, Category, TransactionType, Currency } from '../types';

export interface ImportResult {
  success: boolean;
  count: number;
  errors: string[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const importFinancialData = async (
  file: File, 
  onProgress?: (progress: number) => void,
  onLog?: (message: string) => void,
  signal?: AbortSignal
): Promise<ImportResult> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'json') {
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
    const currencies = await api.get<Currency[]>('/currencies');

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
        if (currencyUid) {
          const foundCurrency = currencies.find(c => c.currency === currencyUid);
          if (foundCurrency) {
            currencyCode = foundCurrency.currency;
          } else if (currencyUid.includes('_')) {
            currencyCode = currencyUid.split('_')[1];
          } else {
            currencyCode = currencyUid;
          }
        }

        accountsToImport.push({
          id: uid.toString(),
          uid: uid.toString(),
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
          icon: '',
          color: type === 'income' ? '#10b981' : '#6366f1',
          parentId: pUid ? pUid.toString() : null
        });
      }
      // Sort categories: parents first (parentId is null)
      categoriesToImport.sort((a, b) => {
        if (a.parentId === null && b.parentId !== null) return -1;
        if (a.parentId !== null && b.parentId === null) return 1;
        return 0;
      });
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
      await delay(500); // Add delay to avoid rate limits
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
        
        const collections = ['accounts', 'categories', 'transactions', 'goals', 'budgets'];
        const importData: Record<string, any[]> = {};

        // 1. Читаем все листы
        for (const sheetName of workbook.SheetNames) {
          if (collections.includes(sheetName)) {
            const worksheet = workbook.Sheets[sheetName];
            importData[sheetName] = XLSX.utils.sheet_to_json(worksheet);
          }
        }
        
        // Sort categories: parents first
        if (importData.categories) {
           importData.categories.sort((a: any, b: any) => {
             const aParent = a.parentId || a.pUid || null;
             const bParent = b.parentId || b.pUid || null;
             if (aParent === null && bParent !== null) return -1;
             if (aParent !== null && bParent === null) return 1;
             return 0;
           });
        }

        if (onLog) onLog('Синхронизация данных...');

        // 2. Отправляем данные на сервер
        // Важно: отправляем в том же порядке, чтобы зависимости (счета/категории) создались первыми
        await api.post('/import/batch', {
          accounts: importData.accounts || [],
          categories: importData.categories || [],
          goals: importData.goals || [],
          transactions: []
        });

        if (importData.transactions && importData.transactions.length > 0) {
          const chunkSize = 100;
          for (let i = 0; i < importData.transactions.length; i += chunkSize) {
            if (signal?.aborted) throw new Error('Import cancelled');
            const chunk = importData.transactions.slice(i, i + chunkSize);
            await api.post('/import/batch', {
              accounts: [],
              categories: [],
              transactions: chunk
            });
            await delay(500); // Add delay to avoid rate limits
            if (onLog) onLog(`Импортировано ${i + chunk.length} операций...`);
          }
        }

        // Остальные данные (goals, budgets) можно импортировать аналогично, если нужно
        
        if (onLog) onLog('Импорт из Excel успешно завершен!');
        resolve({ success: true, count: (importData.transactions?.length || 0), errors: [] });
      } catch (err: any) {
        console.error('Excel Import error:', err);
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};