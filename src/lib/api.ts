const API_URL = '/api';

/**
 * Returns a short human-readable label for a queued offline operation, used in
 * eviction / failure toasts so the user can tell which action was dropped.
 *
 * Examples:
 *   { method:'POST', endpoint:'/transactions' }         → "добавление транзакции"
 *   { method:'DELETE', endpoint:'/accounts/123' }       → "удаление счёта"
 *   { method:'PUT', endpoint:'/plan-grid/monthly' }     → "изменение плана"
 */
export function describeQueueItem(item: { method?: string; endpoint?: string }): string {
  const method = (item.method || '').toUpperCase();
  const endpoint = item.endpoint || '';

  const verbMap: Record<string, string> = {
    POST:   'добавление',
    PUT:    'изменение',
    DELETE: 'удаление',
  };
  const verb = verbMap[method] || method;

  let noun = 'операции';
  if (endpoint.startsWith('/transactions'))  noun = 'транзакции';
  else if (endpoint.startsWith('/accounts')) noun = 'счёта';
  else if (endpoint.startsWith('/categories')) noun = 'категории';
  else if (endpoint.startsWith('/goals'))    noun = 'цели';
  else if (endpoint.startsWith('/balance-history')) noun = 'записи истории баланса';
  else if (endpoint.startsWith('/plan-grid')) noun = 'плана';
  else if (endpoint.startsWith('/budget'))   noun = 'бюджета';

  return `${verb} ${noun}`;
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage getItem failed:', e);
      return null;
    }
  },
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      const isQuota =
        e instanceof DOMException &&
        (e.name === 'QuotaExceededError' ||
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e.code === 22 ||
          e.code === 1014);

      if (isQuota) {
        window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
      }

      console.warn('localStorage setItem failed:', e);
      return false;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage removeItem failed:', e);
    }
  }
};

/**
 * Hard cap on the number of non-plan-grid items that may sit in the offline
 * queue at one time.  Plan-grid items are full overwrites so they deduplicate
 * by endpoint and are exempt from this limit.
 */
export const MAX_QUEUE_SIZE = 50;

/**
 * Appends a new item to the offline queue, handling plan-grid deduplication
 * and storage-pressure recovery in one place.
 *
 * When localStorage is full the helper attempts to evict the *oldest*
 * non-plan-grid item from the in-memory queue before retrying.  If an item
 * is evicted the `storage-quota-exceeded` event is **always** dispatched so
 * the caller can surface the data-loss to the user via the existing toast
 * listener in useAppData.  The eviction policy intentionally protects
 * plan-grid entries because those are the most expensive to recreate.
 *
 * If pushing a non-plan-grid item would exceed MAX_QUEUE_SIZE the
 * `offline-queue-full` CustomEvent is dispatched and the function returns
 * `false` without modifying the queue.
 *
 * Returns `true` if the queue was saved successfully, `false` otherwise.
 */
export function pushToOfflineQueue(item: any): boolean {
  const queueKey = 'api_offline_queue';

  // Read current queue
  let queue: any[] = [];
  try {
    queue = JSON.parse(safeStorage.getItem(queueKey) || '[]');
  } catch (_) {
    queue = [];
  }

  // Plan-grid saves are full overwrites — keep only the latest for each page
  if (item.endpoint?.startsWith('/plan-grid/')) {
    queue = queue.filter(
      (q: any) => !(q.method === item.method && q.endpoint === item.endpoint)
    );
  } else {
    // Enforce the hard cap on non-plan-grid items
    const nonPlanGridCount = queue.filter(
      (q: any) => !q.endpoint?.startsWith('/plan-grid/')
    ).length;
    if (nonPlanGridCount >= MAX_QUEUE_SIZE) {
      window.dispatchEvent(new CustomEvent('offline-queue-full'));
      return false;
    }
  }

  queue.push(item);

  // Use raw localStorage so we fully control when storage-quota-exceeded fires.
  // safeStorage.setItem also dispatches that event on quota, which would produce
  // a duplicate notification before we get a chance to evict-and-retry.
  function tryWrite(q: any[]): boolean {
    try {
      localStorage.setItem(queueKey, JSON.stringify(q));
      return true;
    } catch (_) {
      return false;
    }
  }

  if (tryWrite(queue)) return true;

  // Write failed — try to free space by evicting the oldest non-plan-grid item
  const idx = queue.findIndex(
    (q: any) => !q.endpoint?.startsWith('/plan-grid/')
  );

  if (idx !== -1) {
    const evicted = queue.splice(idx, 1)[0];
    // Emit a rich event so the app layer can name the dropped operation in the toast.
    // storage-quota-exceeded is intentionally NOT dispatched here to avoid showing
    // the generic quota toast on top of the specific eviction toast.
    window.dispatchEvent(
      new CustomEvent('offline-queue-item-evicted', { detail: { item: evicted } })
    );
    return tryWrite(queue);
  }

  // No evictable item — still notify so the caller can surface the error
  window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
  return false;
}

export const checkIfNetworkError = (error: any): boolean => {
  if (!navigator.onLine) return true;
  if (!error) return false;
  
  const msg = (error.message || '').toLowerCase();
  
  // Standard network failure terms across Safari (e.g. Load failed), Chrome, Firefox
  if (
    msg === 'failed to fetch' ||
    msg === 'load failed' ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    msg.includes('aborted')
  ) {
    return true;
  }
  
  if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
    return true;
  }
  
  // Any fetch TypeError is generally a network/CORS boundary issue
  if (error instanceof TypeError || error.name === 'TypeError') {
    return true;
  }
  
  return false;
};

const getHeaders = () => {
  const token = safeStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const handleAuthError = async (res: Response, endpoint: string) => {
  if (res.status === 401 || res.status === 403) {
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) {
      const text = await res.text();
      try {
        const error = JSON.parse(text);
        if (error && typeof error.error === 'string') {
          throw new Error(error.error);
        }
        if (error && typeof error.message === 'string') {
          throw new Error(error.message);
        }
        throw new Error(JSON.stringify(error));
      } catch {
        throw new Error(text || `Error ${res.status}: ${res.statusText}`);
      }
    }
    
    if (res.status === 401) {
      safeStorage.removeItem('token');
      throw new Error('Session expired. Please log in again.');
    }
  }
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const text = await res.text();
    try {
      const error = JSON.parse(text);
      if (error && typeof error.error === 'string') {
        throw new Error(error.error);
      }
      if (error && typeof error.message === 'string') {
        throw new Error(error.message);
      }
      throw new Error(JSON.stringify(error));
    } catch {
      throw new Error(text || `Error ${res.status}: ${res.statusText}`);
    }
  }
  
  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  return text as any;
};

// Modifies local caches when offline to keep the UI immediately up-to-date
function applyMutationToCache(method: string, endpoint: string, data: any) {
  try {
    if (endpoint.startsWith('/plan-grid/')) {
      const type = endpoint.replace('/plan-grid/', '');
      safeStorage.setItem(`api_cache_/plan-grid/${type}`, JSON.stringify(data));
      return;
    }

    const cacheKey = 'api_cache_/initial-data';
    const rawCache = safeStorage.getItem(cacheKey);
    if (!rawCache) return;

    let cache: any = null;
    try {
      cache = JSON.parse(rawCache);
    } catch (e) {
      console.error('Failed to parse cache /initial-data:', e);
      return;
    }

    if (endpoint === '/transactions') {
      if (method === 'POST') {
        const tr = {
          id: data.id || 'offline_tr_' + Math.random().toString(36).substring(2, 9),
          amount: Number(data.amount),
          description: data.description || '',
          accountId: data.accountId,
          targetAccountId: data.targetAccountId || null,
          categoryId: data.categoryId || null,
          createdAt: data.createdAt || new Date().toISOString(),
          type: data.type,
        };
        if (!cache.transactions) cache.transactions = [];
        cache.transactions.unshift(tr);

        // Adjust balance
        if (cache.accounts) {
          const amount = Number(data.amount);
          if (data.type === 'income') {
            const acc = cache.accounts.find((a: any) => a.id === data.accountId);
            if (acc) acc.balance = Number(acc.balance) + amount;
          } else if (data.type === 'expense') {
            const acc = cache.accounts.find((a: any) => a.id === data.accountId);
            if (acc) acc.balance = Number(acc.balance) - amount;
          } else if (data.type === 'transfer') {
            const srcAcc = cache.accounts.find((a: any) => a.id === data.accountId);
            if (srcAcc) srcAcc.balance = Number(srcAcc.balance) - amount;
            const dstAcc = cache.accounts.find((a: any) => a.id === data.targetAccountId);
            if (dstAcc) dstAcc.balance = Number(dstAcc.balance) + amount;
          }
        }
      }
    } else if (endpoint.startsWith('/transactions/')) {
      const id = endpoint.split('/').pop();
      if (method === 'PUT') {
        const index = cache.transactions?.findIndex((t: any) => t.id === id);
        if (index !== -1 && index !== undefined) {
          const oldTr = cache.transactions[index];
          const newTr = { ...oldTr, ...data };
          cache.transactions[index] = newTr;

          if (cache.accounts) {
            // Revert old transaction balances
            const oldAmount = Number(oldTr.amount);
            if (oldTr.type === 'income') {
              const acc = cache.accounts.find((a: any) => a.id === oldTr.accountId);
              if (acc) acc.balance = Number(acc.balance) - oldAmount;
            } else if (oldTr.type === 'expense') {
              const acc = cache.accounts.find((a: any) => a.id === oldTr.accountId);
              if (acc) acc.balance = Number(acc.balance) + oldAmount;
            } else if (oldTr.type === 'transfer') {
              const srcAcc = cache.accounts.find((a: any) => a.id === oldTr.accountId);
              if (srcAcc) srcAcc.balance = Number(srcAcc.balance) + oldAmount;
              const dstAcc = cache.accounts.find((a: any) => a.id === oldTr.targetAccountId);
              if (dstAcc) dstAcc.balance = Number(dstAcc.balance) - oldAmount;
            }

            // Apply new transaction balances
            const newAmount = Number(newTr.amount);
            if (newTr.type === 'income') {
              const acc = cache.accounts.find((a: any) => a.id === newTr.accountId);
              if (acc) acc.balance = Number(acc.balance) + newAmount;
            } else if (newTr.type === 'expense') {
              const acc = cache.accounts.find((a: any) => a.id === newTr.accountId);
              if (acc) acc.balance = Number(acc.balance) - newAmount;
            } else if (newTr.type === 'transfer') {
              const srcAcc = cache.accounts.find((a: any) => a.id === newTr.accountId);
              if (srcAcc) srcAcc.balance = Number(srcAcc.balance) - newAmount;
              const dstAcc = cache.accounts.find((a: any) => a.id === newTr.targetAccountId);
              if (dstAcc) dstAcc.balance = Number(dstAcc.balance) + newAmount;
            }
          }
        }
      } else if (method === 'DELETE') {
        const index = cache.transactions?.findIndex((t: any) => t.id === id);
        if (index !== -1 && index !== undefined) {
          const oldTr = cache.transactions[index];
          cache.transactions.splice(index, 1);

          if (cache.accounts) {
            const oldAmount = Number(oldTr.amount);
            if (oldTr.type === 'income') {
              const acc = cache.accounts.find((a: any) => a.id === oldTr.accountId);
              if (acc) acc.balance = Number(acc.balance) - oldAmount;
            } else if (oldTr.type === 'expense') {
              const acc = cache.accounts.find((a: any) => a.id === oldTr.accountId);
              if (acc) acc.balance = Number(acc.balance) + oldAmount;
            } else if (oldTr.type === 'transfer') {
              const srcAcc = cache.accounts.find((a: any) => a.id === oldTr.accountId);
              if (srcAcc) srcAcc.balance = Number(srcAcc.balance) + oldAmount;
              const dstAcc = cache.accounts.find((a: any) => a.id === oldTr.targetAccountId);
              if (dstAcc) dstAcc.balance = Number(dstAcc.balance) - oldAmount;
            }
          }
        }
      }
    } else if (endpoint === '/accounts') {
      if (method === 'POST') {
        const acc = {
          id: data.id || 'offline_acc_' + Math.random().toString(36).substring(2, 9),
          name: data.name,
          balance: Number(data.balance || 0),
          currencyId: data.currencyId,
          color: data.color || '#3b82f6',
          icon: data.icon || 'Wallet',
          isActive: data.isActive !== undefined ? data.isActive : true,
        };
        if (!cache.accounts) cache.accounts = [];
        cache.accounts.push(acc);
      }
    } else if (endpoint.startsWith('/accounts/')) {
      const id = endpoint.split('/').pop();
      if (method === 'PUT') {
        const acc = cache.accounts?.find((a: any) => a.id === id);
        if (acc) Object.assign(acc, data);
      } else if (method === 'DELETE') {
        cache.accounts = cache.accounts?.filter((a: any) => a.id !== id);
      }
    } else if (endpoint === '/categories') {
      if (method === 'POST') {
        const cat = {
          id: data.id || 'offline_cat_' + Math.random().toString(36).substring(2, 9),
          name: data.name,
          type: data.type,
          color: data.color,
          icon: data.icon,
          parentId: data.parentId || null,
          limit: data.limit !== undefined ? Number(data.limit) : null,
        };
        if (!cache.categories) cache.categories = [];
        cache.categories.push(cat);
      }
    } else if (endpoint.startsWith('/categories/')) {
      const id = endpoint.split('/').pop();
      if (method === 'PUT') {
        const cat = cache.categories?.find((c: any) => c.id === id);
        if (cat) Object.assign(cat, data);
      } else if (method === 'DELETE') {
        cache.categories = cache.categories?.filter((c: any) => c.id !== id);
      }
    } else if (endpoint === '/goals') {
      if (method === 'POST') {
        const goal = {
          id: data.id || 'offline_goal_' + Math.random().toString(36).substring(2, 9),
          name: data.name,
          targetAmount: Number(data.targetAmount),
          currentAmount: Number(data.currentAmount || 0),
          deadline: data.deadline || null,
          color: data.color || '#3b82f6',
          icon: data.icon || 'Target',
          sortOrder: data.sortOrder || 0,
        };
        if (!cache.goals) cache.goals = [];
        cache.goals.push(goal);
      }
    } else if (endpoint.startsWith('/goals/')) {
      const id = endpoint.split('/').pop();
      if (method === 'PUT') {
        const goal = cache.goals?.find((g: any) => g.id === id);
        if (goal) Object.assign(goal, data);
      } else if (method === 'DELETE') {
        cache.goals = cache.goals?.filter((g: any) => g.id !== id);
      }
    } else if (endpoint === '/balance-history') {
      if (method === 'POST') {
        const bh = {
          id: data.id || 'offline_bh_' + Math.random().toString(36).substring(2, 9),
          ...data,
        };
        if (!cache.balanceHistory) cache.balanceHistory = [];
        cache.balanceHistory.push(bh);
      }
    } else if (endpoint.startsWith('/balance-history/')) {
      const id = endpoint.split('/').pop();
      if (method === 'PUT') {
        const bh = cache.balanceHistory?.find((b: any) => b.id === id);
        if (bh) Object.assign(bh, data);
      } else if (method === 'DELETE') {
        cache.balanceHistory = cache.balanceHistory?.filter((b: any) => b.id !== id);
      }
    }

    safeStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to apply mutation locally to cache:', error);
  }
}

// Undoes the optimistic local cache change made by applyMutationToCache when the
// server ultimately rejects a queued offline mutation. Best-effort: for creations
// (POST) we can reliably delete the locally-created record; for edits/deletes we
// have no prior snapshot to restore, so we leave those to the post-sync refetch.
function revertMutationFromCache(method: string, endpoint: string, data: any) {
  try {
    if (method !== 'POST') return;

    if (endpoint.startsWith('/plan-grid/')) return;

    if (endpoint === '/transactions' || endpoint === '/accounts' || endpoint === '/categories' || endpoint === '/goals' || endpoint === '/balance-history') {
      if (!data || !data.id) return;
      applyMutationToCache('DELETE', `${endpoint}/${data.id}`, null);
    }
  } catch (error) {
    console.error('Failed to revert mutation from cache:', error);
  }
}

export const api = {
  // Direct, unintercepted methods used exclusively for synchronization logic
  async postDirect<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    await handleAuthError(res, endpoint);
    return handleResponse(res);
  },
  
  async putDirect<T>(endpoint: string, data: any): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    await handleAuthError(res, endpoint);
    return handleResponse(res);
  },

  async deleteDirect<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleAuthError(res, endpoint);
    return handleResponse(res);
  },

  async get<T>(endpoint: string): Promise<T> {
    // If we're strictly offline, immediately return any local cached copy
    if (!navigator.onLine) {
      const cached = safeStorage.getItem(`api_cache_${endpoint}`);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch (e) {
          console.error(`Failed to parse cache for ${endpoint}:`, e);
        }
      }
      throw new Error('OFFLINE_NO_CACHE');
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
      await handleAuthError(res, endpoint);
      const data = await handleResponse(res);
      
      // Cache response for future offline accesses
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register') && !endpoint.includes('/auth/verify-password')) {
        safeStorage.setItem(`api_cache_${endpoint}`, JSON.stringify(data));
        safeStorage.setItem(`api_cache_timestamp_${endpoint}`, String(Date.now()));
      }
      return data;
    } catch (error: any) {
      console.error(`Fetch GET failed for ${endpoint}:`, error);
      // Fallback to local storage in case of any network/server failure
      const cached = safeStorage.getItem(`api_cache_${endpoint}`);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch (e) {}
      }
      throw error;
    }
  },

  // Fetches a single page of transactions from the server with filters
  // applied server-side (date range, type, accounts, categories, search).
  // Not cached for offline use since pages/filters are too numerous to
  // usefully cache; falls back to an empty page when offline.
  async getTransactionsPage(params: {
    page: number;
    pageSize: number;
    startDate?: string;
    endDate?: string;
    type?: string;
    accountIds?: string[];
    categoryIds?: string[];
    search?: string;
    searchCategoryIds?: string[];
    searchAccountIds?: string[];
  }): Promise<{ transactions: any[]; total: number; page: number; pageSize: number; totalPages: number; totalIncome: number; totalExpense: number }> {
    if (!navigator.onLine) {
      return { transactions: [], total: 0, page: 1, pageSize: params.pageSize, totalPages: 1, totalIncome: 0, totalExpense: 0 };
    }

    const qs = new URLSearchParams();
    qs.set('page', String(params.page));
    qs.set('pageSize', String(params.pageSize));
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    if (params.type) qs.set('type', params.type);
    if (params.accountIds?.length) qs.set('accountIds', params.accountIds.join(','));
    if (params.categoryIds?.length) qs.set('categoryIds', params.categoryIds.join(','));
    if (params.search) qs.set('search', params.search);
    if (params.searchCategoryIds?.length) qs.set('searchCategoryIds', params.searchCategoryIds.join(','));
    if (params.searchAccountIds?.length) qs.set('searchAccountIds', params.searchAccountIds.join(','));

    const res = await fetch(`${API_URL}/transactions?${qs.toString()}`, { headers: getHeaders() });
    await handleAuthError(res, '/transactions');
    return handleResponse(res);
  },

  async post<T>(endpoint: string, data: any): Promise<T> {
    const isOffline = !navigator.onLine;

    if (isOffline) {
      if (endpoint === '/auth/login') {
        const savedUserRaw = safeStorage.getItem('last_logged_in_user');
        if (savedUserRaw) {
          try {
            const savedUser = JSON.parse(savedUserRaw);
            if (data && data.email && savedUser.email && typeof data.email === 'string' && data.email.toLowerCase().trim() === savedUser.email.toLowerCase().trim()) {
              return {
                token: safeStorage.getItem('token') || 'offline-token-placeholder',
                user: savedUser
              } as any as T;
            } else {
              throw new Error(`В оффлайн-режиме можно войти только в последний активный аккаунт: ${savedUser.email}`);
            }
          } catch (e: any) {
            if (e.message && e.message.includes('последний активный аккаунт')) {
              throw e;
            }
            throw new Error('Данный пользователь не был авторизован ранее на этом устройстве.');
          }
        } else {
          throw new Error('Оффлайн-режим. На устройстве нет сохраненного аккаунта. Пожалуйста, подключитесь к сети.');
        }
      }

      if (endpoint === '/auth/register') {
        throw new Error('Регистрация нового аккаунта недоступна в оффлайн-режиме. Пожалуйста, подключитесь к сети.');
      }

      if (endpoint === '/auth/forgot-password') {
        throw new Error('Восстановление пароля недоступно в оффлайн-режиме. Пожалуйста, подключитесь к сети.');
      }

      if (endpoint === '/auth/verify-password') {
        throw new Error('Подтверждение пароля недоступно в оффлайн-режиме.');
      }
    }

    const isAuth = endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/verify-password') || endpoint.includes('/auth/forgot-password');

    if (isOffline && !isAuth) {
      // Assign the id up front so the queue item, the optimistic cache entry, and the
      // returned mock response all refer to the same record (needed to revert the
      // cache entry precisely if the server later rejects this item on sync).
      const dataWithId = data && data.id ? data : { ...data, id: 'offline_' + Math.random().toString(36).substring(2, 9) };
      const queueItem = {
        id: Math.random().toString(36).substring(2, 9),
        method: 'POST',
        endpoint,
        data: dataWithId,
        timestamp: Date.now()
      };
      const saved = pushToOfflineQueue(queueItem);
      if (!saved) {
        throw new Error('Локальное хранилище заполнено — подключитесь к сети для сохранения данных');
      }

      applyMutationToCache('POST', endpoint, dataWithId);

      return dataWithId as T;
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      await handleAuthError(res, endpoint);
      const result = await handleResponse(res);
      return result;
    } catch (error: any) {
      const isNetworkError = checkIfNetworkError(error);
      if (isNetworkError) {
        if (endpoint === '/auth/login') {
          const savedUserRaw = safeStorage.getItem('last_logged_in_user');
          if (savedUserRaw) {
            try {
              const savedUser = JSON.parse(savedUserRaw);
              if (data && data.email && savedUser.email && typeof data.email === 'string' && data.email.toLowerCase().trim() === savedUser.email.toLowerCase().trim()) {
                return {
                  token: safeStorage.getItem('token') || 'offline-token-placeholder',
                  user: savedUser
                } as any as T;
              } else {
                throw new Error(`В оффлайн-режиме можно войти только в последний активный аккаунт: ${savedUser.email}`);
              }
            } catch (e: any) {
              if (e.message && e.message.includes('последний активный аккаунт')) {
                throw e;
              }
              throw new Error('Данный пользователь не был авторизован ранее на этом устройстве.');
            }
          } else {
            throw new Error('Оффлайн-режим. На устройстве нет сохраненного аккаунта. Пожалуйста, подключитесь к сети.');
          }
        }

        if (endpoint === '/auth/register') {
          throw new Error('Регистрация нового аккаунта недоступна в оффлайн-режиме. Пожалуйста, подключитесь к сети.');
        }

        if (endpoint === '/auth/forgot-password') {
          throw new Error('Восстановление пароля недоступно в оффлайн-режиме. Пожалуйста, подключитесь к сети.');
        }

        if (endpoint === '/auth/verify-password') {
          throw new Error('Подтверждение пароля недоступно в оффлайн-режиме.');
        }

        if (!isAuth) {
          const dataWithId = data && data.id ? data : { ...data, id: 'offline_' + Math.random().toString(36).substring(2, 9) };
          const queueItem = {
            id: Math.random().toString(36).substring(2, 9),
            method: 'POST',
            endpoint,
            data: dataWithId,
            timestamp: Date.now()
          };
          const saved = pushToOfflineQueue(queueItem);
          if (!saved) {
            throw new Error('Локальное хранилище заполнено — подключитесь к сети для сохранения данных');
          }

          applyMutationToCache('POST', endpoint, dataWithId);
          return dataWithId as T;
        }
      }
      throw error;
    }
  },

  async put<T>(endpoint: string, data: any): Promise<T> {
    const isOffline = !navigator.onLine;
    if (isOffline) {
      const queueItem = {
        id: Math.random().toString(36).substring(2, 9),
        method: 'PUT',
        endpoint,
        data,
        timestamp: Date.now()
      };
      const saved = pushToOfflineQueue(queueItem);
      if (!saved) {
        throw new Error('Локальное хранилище заполнено — подключитесь к сети для сохранения данных');
      }

      applyMutationToCache('PUT', endpoint, data);

      const mockResponse: any = { success: true, ...data };
      return mockResponse as T;
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      await handleAuthError(res, endpoint);
      return handleResponse(res);
    } catch (error: any) {
      const isNetworkError = checkIfNetworkError(error);
      if (isNetworkError) {
        const queueItem = {
          id: Math.random().toString(36).substring(2, 9),
          method: 'PUT',
          endpoint,
          data,
          timestamp: Date.now()
        };
        const saved = pushToOfflineQueue(queueItem);
        if (!saved) {
          throw new Error('Локальное хранилище заполнено — подключитесь к сети для сохранения данных');
        }

        applyMutationToCache('PUT', endpoint, data);
        const mockResponse: any = { success: true, ...data };
        return mockResponse as T;
      }
      throw error;
    }
  },

  async delete<T>(endpoint: string): Promise<T> {
    const isOffline = !navigator.onLine;
    if (isOffline) {
      const queueItem = {
        id: Math.random().toString(36).substring(2, 9),
        method: 'DELETE',
        endpoint,
        data: null,
        timestamp: Date.now()
      };
      const saved = pushToOfflineQueue(queueItem);
      if (!saved) {
        throw new Error('Локальное хранилище заполнено — подключитесь к сети для сохранения данных');
      }

      applyMutationToCache('DELETE', endpoint, null);

      const mockResponse: any = { success: true };
      return mockResponse as T;
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      await handleAuthError(res, endpoint);
      return handleResponse(res);
    } catch (error: any) {
      const isNetworkError = checkIfNetworkError(error);
      if (isNetworkError) {
        const queueItem = {
          id: Math.random().toString(36).substring(2, 9),
          method: 'DELETE',
          endpoint,
          data: null,
          timestamp: Date.now()
        };
        const saved = pushToOfflineQueue(queueItem);
        if (!saved) {
          throw new Error('Локальное хранилище заполнено — подключитесь к сети для сохранения данных');
        }

        applyMutationToCache('DELETE', endpoint, null);
        const mockResponse: any = { success: true };
        return mockResponse as T;
      }
      throw error;
    }
  },
};

// Sequentially uploads offline cached actions when network is restored.
// `onItemFailed` is invoked for each queued item the server ultimately rejects
// (a real error, not a transient network issue) so the caller can notify the
// user instead of the item being silently dropped.
export async function syncOfflineQueue(onItemFailed?: (message: string, item: any) => void): Promise<boolean> {
  const queueKey = 'api_offline_queue';
  const rawQueue = safeStorage.getItem(queueKey);
  if (!rawQueue) return false;
  
  let queue: any[] = [];
  try {
    queue = JSON.parse(rawQueue);
  } catch (e) {
    console.error('Failed to parse offline queue:', e);
    return false;
  }
  
  if (queue.length === 0) return false;
  
  console.log('Syncing offline queue of size:', queue.length);
  
  const remaining: any[] = [...queue];
  
  for (const item of queue) {
    try {
      if (item.method === 'POST') {
        if (item.endpoint.startsWith('/plan-grid/')) {
          // Special case for plan pages being overwrites
          await api.postDirect(item.endpoint, item.data);
        } else {
          await api.postDirect(item.endpoint, item.data);
        }
      } else if (item.method === 'PUT') {
        await api.putDirect(item.endpoint, item.data);
      } else if (item.method === 'DELETE') {
        await api.deleteDirect(item.endpoint);
      }
      
      // Successfully synced, remove from queue
      remaining.shift();
      safeStorage.setItem(queueKey, JSON.stringify(remaining));
    } catch (err: any) {
      console.error('Failed to sync queue item:', item, err);
      // Check if it's a network issue (retry later)
      const isNetworkError = checkIfNetworkError(err);
      if (isNetworkError) {
        return false;
      }
      
      // If indeed some client error (e.g., duplicated entry, bad request, already deleted, 400 bad request),
      // we discard this specific item so the sync queue doesn't lock forever, but we
      // must roll back the optimistic cache change and tell the user it wasn't saved.
      remaining.shift();
      safeStorage.setItem(queueKey, JSON.stringify(remaining));

      revertMutationFromCache(item.method, item.endpoint, item.data);
      const message = err?.message || 'Не удалось синхронизировать одну из операций.';
      onItemFailed?.(message, item);
    }
  }
  
  safeStorage.removeItem(queueKey);
  return true;
}

/**
 * Updates the data payload of a queued offline POST /transactions item and
 * patches the optimistic cache entry for the same record.
 * Only supports POST /transactions items (the only kind shown in the pending UI).
 */
export function updateOfflineQueueItem(itemId: string, newData: any): boolean {
  const queueKey = 'api_offline_queue';
  let queue: any[] = [];
  try {
    queue = JSON.parse(safeStorage.getItem(queueKey) || '[]');
  } catch {
    return false;
  }

  const item = queue.find((q: any) => q.id === itemId);
  if (!item) return false;

  const oldId = item.data?.id;
  item.data = { ...item.data, ...newData, id: oldId }; // preserve the offline id

  safeStorage.setItem(queueKey, JSON.stringify(queue));

  // Patch the optimistic cache using PUT semantics on the existing offline record id
  if (item.endpoint === '/transactions' && item.method === 'POST' && oldId) {
    applyMutationToCache('PUT', `/transactions/${oldId}`, item.data);
  }

  return true;
}

/**
 * Removes a queued offline item by its queue item id and reverts its
 * optimistic cache change.
 */
export function removeOfflineQueueItem(itemId: string): boolean {
  const queueKey = 'api_offline_queue';
  let queue: any[] = [];
  try {
    queue = JSON.parse(safeStorage.getItem(queueKey) || '[]');
  } catch {
    return false;
  }

  const idx = queue.findIndex((q: any) => q.id === itemId);
  if (idx === -1) return false;

  const item = queue[idx];
  queue.splice(idx, 1);
  safeStorage.setItem(queueKey, JSON.stringify(queue));

  // Revert the optimistic cache change: delete the locally-added record
  if (item.method === 'POST' && item.data?.id) {
    applyMutationToCache('DELETE', `${item.endpoint}/${item.data.id}`, null);
  }

  return true;
}

/**
 * Returns the Unix timestamp (ms) when the given endpoint's cache was last
 * written, or null if the endpoint has never been cached.
 */
export function getCacheTimestamp(endpoint: string): number | null {
  const raw = safeStorage.getItem(`api_cache_timestamp_${endpoint}`);
  if (!raw) return null;
  const ts = Number(raw);
  return isNaN(ts) ? null : ts;
}
