import { useEffect, useState } from 'react';
import { api, safeStorage, checkIfNetworkError } from '../lib/api';
import { UserProfile } from '../types';

export function useAuth(addToast: (message: string, type?: 'info' | 'success' | 'error') => void) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = safeStorage.getItem('token');
      if (token) {
        try {
          const userData = await api.get<UserProfile>('/auth/me');
          setUser(userData);
          safeStorage.setItem('last_logged_in_user', JSON.stringify(userData));
        } catch (error: any) {
          console.error('Auth check error:', error);
          const isNetworkError = checkIfNetworkError(error);
          if (isNetworkError) {
            const savedUser = safeStorage.getItem('last_logged_in_user');
            if (savedUser) {
              try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                addToast('Оффлайн-режим: выполнен вход в последний рабочий аккаунт', 'info');
              } catch (e) {
                safeStorage.removeItem('token');
                setUser(null);
              }
            } else {
              safeStorage.removeItem('token');
              setUser(null);
            }
          } else {
            safeStorage.removeItem('token');
            setUser(null);
          }
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [addToast]);

  const handleLogout = () => {
    safeStorage.removeItem('token');
    setUser(null);
  };

  return { user, setUser, loading, handleLogout };
}
