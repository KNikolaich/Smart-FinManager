import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Server data changes via user actions + socket.io push, not by polling.
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryKeys = {
  me: ['auth', 'me'] as const,
  // Scoped by user id so switching accounts (or a fresh login after logout)
  // can never serve a previous user's cached server data.
  initialData: (userId: string | undefined) => ['initial-data', userId] as const,
};
