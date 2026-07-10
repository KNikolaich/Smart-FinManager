import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, safeStorage, syncOfflineQueue } from '../lib/api';
import { Account, Transaction, Goal, Category, Currency, BalanceHistory, Plan, UserProfile } from '../types';

interface UseAppDataParams {
  user: UserProfile | null;
  addToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export function useAppData({ user, addToast }: UseAppDataParams) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistory[]>([]);
  const [plans, setPlans] = useState<Plan[]>(() => {
    const saved = safeStorage.getItem('ai_temporary_plans');
    return saved ? JSON.parse(saved) : [];
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const socketRef = useRef<any>(null);

  const refreshData = useCallback(async () => {
    if (!user || isRefreshingRef.current) return;

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    isRefreshingRef.current = true;
    try {
      const data = await api.get<{
        accounts: Account[];
        transactions: Transaction[];
        goals: Goal[];
        categories: Category[];
        currencies: Currency[];
        balanceHistory: BalanceHistory[];
      }>('/initial-data');

      setAccounts(data.accounts);
      setTransactions(data.transactions);
      setGoals(data.goals);
      setCategories(data.categories);
      setCurrencies(data.currencies);
      setBalanceHistory(data.balanceHistory);
      setDataVersion(v => v + 1);

      const savedPlans = safeStorage.getItem('ai_temporary_plans');
      if (savedPlans) {
        setPlans(JSON.parse(savedPlans));
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error.message.includes('Rate exceeded') || error.status === 429) {
        addToast('Превышен лимит запросов. Пожалуйста, подождите немного.', 'error');
      } else {
        addToast('Ошибка при загрузке данных', 'error');
      }
    } finally {
      setTimeout(() => {
        isRefreshingRef.current = false;
      }, 1000);
    }
  }, [user, addToast]);

  const optimisticAddTransaction = useCallback((transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
  }, []);

  useEffect(() => {
    safeStorage.setItem('ai_temporary_plans', JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  // Auto-sync on startup if online
  useEffect(() => {
    if (user && navigator.onLine) {
      syncOfflineQueue().then((synced) => {
        if (synced) {
          addToast('Синхронизация данных завершена успешно', 'success');
          refreshData();
        }
      });
    }
  }, [user, addToast, refreshData]);

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
        refreshData();
      });

      socketRef.current = socket;

      return () => {
        socket.disconnect();
      };
    }
  }, [user, refreshData]);

  return {
    accounts,
    transactions,
    goals,
    categories,
    currencies,
    balanceHistory,
    dataVersion,
    plans,
    refreshData,
    optimisticAddTransaction
  };
}
