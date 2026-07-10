const API_URL = '/api';

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage getItem failed:', e);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage setItem failed:', e);
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
      throw new Error('Оффлайн режим. Данные отсутствуют в кэше.');
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
      await handleAuthError(res, endpoint);
      const data = await handleResponse(res);
      
      // Cache response for future offline accesses
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register') && !endpoint.includes('/auth/verify-password')) {
        safeStorage.setItem(`api_cache_${endpoint}`, JSON.stringify(data));
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
      const queueItem = {
        id: Math.random().toString(36).substring(2, 9),
        method: 'POST',
        endpoint,
        data,
        timestamp: Date.now()
      };
      const queue = JSON.parse(safeStorage.getItem('api_offline_queue') || '[]');
      queue.push(queueItem);
      safeStorage.setItem('api_offline_queue', JSON.stringify(queue));

      applyMutationToCache('POST', endpoint, data);

      const mockResponse: any = { id: 'offline_' + Math.random().toString(36).substring(2, 9), ...data };
      return mockResponse as T;
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
          const queueItem = {
            id: Math.random().toString(36).substring(2, 9),
            method: 'POST',
            endpoint,
            data,
            timestamp: Date.now()
          };
          const queue = JSON.parse(safeStorage.getItem('api_offline_queue') || '[]');
          queue.push(queueItem);
          safeStorage.setItem('api_offline_queue', JSON.stringify(queue));

          applyMutationToCache('POST', endpoint, data);
          const mockResponse: any = { id: 'offline_' + Math.random().toString(36).substring(2, 9), ...data };
          return mockResponse as T;
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
      const queue = JSON.parse(safeStorage.getItem('api_offline_queue') || '[]');
      queue.push(queueItem);
      safeStorage.setItem('api_offline_queue', JSON.stringify(queue));

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
        const queue = JSON.parse(safeStorage.getItem('api_offline_queue') || '[]');
        queue.push(queueItem);
        safeStorage.setItem('api_offline_queue', JSON.stringify(queue));

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
      const queue = JSON.parse(safeStorage.getItem('api_offline_queue') || '[]');
      queue.push(queueItem);
      safeStorage.setItem('api_offline_queue', JSON.stringify(queue));

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
        const queue = JSON.parse(safeStorage.getItem('api_offline_queue') || '[]');
        queue.push(queueItem);
        safeStorage.setItem('api_offline_queue', JSON.stringify(queue));

        applyMutationToCache('DELETE', endpoint, null);
        const mockResponse: any = { success: true };
        return mockResponse as T;
      }
      throw error;
    }
  },
};

// Sequentially uploads offline cached actions when network is restored
export async function syncOfflineQueue(): Promise<boolean> {
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
      // we discard this specific item so the sync queue doesn't lock forever.
      remaining.shift();
      safeStorage.setItem(queueKey, JSON.stringify(remaining));
    }
  }
  
  safeStorage.removeItem(queueKey);
  return true;
}
