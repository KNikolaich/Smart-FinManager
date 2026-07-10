import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, safeStorage, checkIfNetworkError } from '../lib/api';
import { queryKeys } from '../lib/queryClient';
import { UserProfile } from '../types';

export function useAuth(addToast: (message: string, type?: 'info' | 'success' | 'error') => void) {
  const queryClient = useQueryClient();
  const token = safeStorage.getItem('token');

  const { data: user = null, isLoading, isFetched } = useQuery<UserProfile | null>({
    queryKey: queryKeys.me,
    enabled: !!token,
    // React Query's own retry/caching layer replaces the manual useState fetch;
    // the offline fallback below still relies on a locally cached last-known user.
    queryFn: async () => {
      try {
        const userData = await api.get<UserProfile>('/auth/me');
        safeStorage.setItem('last_logged_in_user', JSON.stringify(userData));
        return userData;
      } catch (error: any) {
        console.error('Auth check error:', error);
        if (checkIfNetworkError(error)) {
          const savedUser = safeStorage.getItem('last_logged_in_user');
          if (savedUser) {
            try {
              const parsedUser = JSON.parse(savedUser);
              addToast('Оффлайн-режим: выполнен вход в последний рабочий аккаунт', 'info');
              return parsedUser;
            } catch {
              // fall through to logout below
            }
          }
        }
        safeStorage.removeItem('token');
        throw error;
      }
    },
  });

  useEffect(() => {
    if (!token) {
      queryClient.setQueryData(queryKeys.me, null);
    }
  }, [token, queryClient]);

  const setUser = (updatedUser: UserProfile | null) => {
    queryClient.setQueryData(queryKeys.me, updatedUser);
    if (updatedUser) {
      safeStorage.setItem('last_logged_in_user', JSON.stringify(updatedUser));
    }
  };

  const handleLogout = () => {
    safeStorage.removeItem('token');
    queryClient.setQueryData(queryKeys.me, null);
    // Drop all per-user server-data caches (keyed by user id) so a different
    // account logging in next can never see this user's cached data.
    queryClient.removeQueries({ queryKey: ['initial-data'] });
  };

  // loading is "true" only while a token exists but we haven't resolved the query yet.
  const loading = !!token && isLoading && !isFetched;

  return { user, setUser, loading, handleLogout };
}
