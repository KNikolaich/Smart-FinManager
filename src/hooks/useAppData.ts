import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { api, safeStorage, syncOfflineQueue } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
import { Account, Transaction, Goal, Category, Currency, BalanceHistory, Plan, UserProfile } from '../types';

interface UseAppDataParams {
  user: UserProfile | null;
  addToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

interface InitialData {
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  categories: Category[];
  currencies: Currency[];
  balanceHistory: BalanceHistory[];
}

const emptyData: InitialData = {
  accounts: [],
  transactions: [],
  goals: [],
  categories: [],
  currencies: [],
  balanceHistory: [],
};

export function useAppData({ user, addToast }: UseAppDataParams) {
  const queryClient = useQueryClient();
  const initialDataKey = queryKeys.initialData(user?.id);

  const {
    data = emptyData,
    dataUpdatedAt,
    refetch,
  } = useQuery<InitialData>({
    queryKey: initialDataKey,
    enabled: !!user,
    queryFn: async () => {
      try {
        return await api.get<InitialData>('/initial-data');
      } catch (error: any) {
        console.error('Error fetching data:', error);
        if (error.message?.includes('Rate exceeded') || error.status === 429) {
          addToast('Превышен лимит запросов. Пожалуйста, подождите немного.', 'error');
        } else {
          addToast('Ошибка при загрузке данных', 'error');
        }
        throw error;
      }
    },
  });

  // `dataVersion` preserves the previous "bump a counter on every refresh" contract
  // that some child components use to force-remount lists (e.g. TransactionHistory).
  const dataVersion = dataUpdatedAt ?? 0;

  const refreshData = useCallback(async () => {
    if (!user) return;
    await refetch();
  }, [user, refetch]);

  const optimisticAddTransaction = useCallback((transaction: Transaction) => {
    queryClient.setQueryData<InitialData>(initialDataKey, (prev) =>
      prev ? { ...prev, transactions: [transaction, ...prev.transactions] } : prev
    );
  }, [queryClient, initialDataKey]);

  // AI-drafted plans are ephemeral client-side state (not server data), so they still
  // live in localStorage rather than the query cache.
  const plans: Plan[] = (() => {
    const saved = safeStorage.getItem('ai_temporary_plans');
    return saved ? JSON.parse(saved) : [];
  })();

  useEffect(() => {
    const handleQuotaExceeded = () => {
      addToast('Локальное хранилище заполнено — подключитесь к сети для сохранения данных', 'error');
    };
    window.addEventListener('storage-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('storage-quota-exceeded', handleQuotaExceeded);
    };
  }, [addToast]);

  // Track whether we've already shown the stale-cache warning in this session
  // so we don't repeat it on every re-render or re-trigger.
  const staleWarnShownRef = useRef(false);

  // Staleness is now surfaced via the persistent OfflineBanner component;
  // this callback only resets the ref so the banner re-appears after reconnect.
  const checkAndWarnStaleness = useCallback(() => {
    if (navigator.onLine) {
      staleWarnShownRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Check immediately (handles app-load-while-offline scenario)
    checkAndWarnStaleness();

    // Also react to the user losing connectivity mid-session
    const handleOffline = () => checkAndWarnStaleness();
    const handleOnline = () => checkAndWarnStaleness();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, checkAndWarnStaleness]);

  useEffect(() => {
    // Auto-sync on startup if online
    if (user && navigator.onLine) {
      syncOfflineQueue((message) => {
        addToast(`Не удалось сохранить операцию: ${message}`, 'error');
      }).then((synced) => {
        if (synced) {
          addToast('Синхронизация данных завершена успешно', 'success');
          refetch();
        }
      });
    }
  }, [user, addToast, refetch]);

  useEffect(() => {
    if (user) {
      const socket = io(window.location.origin, {
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 20
      });

      socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('join', user.id);
      });

      socket.on('data:updated', (data: any) => {
        console.log('Real-time update received:', data);
        queryClient.invalidateQueries({ queryKey: initialDataKey });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user, queryClient, initialDataKey]);

  return {
    accounts: data.accounts,
    transactions: data.transactions,
    goals: data.goals,
    categories: data.categories,
    currencies: data.currencies,
    balanceHistory: data.balanceHistory,
    dataVersion,
    plans,
    refreshData,
    optimisticAddTransaction
  };
}
