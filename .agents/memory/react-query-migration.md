---
name: React Query server-state migration
description: How server-fetched data (auth session, initial-data bundle) is managed via @tanstack/react-query instead of manual useState/useEffect.
---

`src/lib/queryClient.ts` holds the shared `QueryClient` (wrapped around `<App/>` in `main.tsx` via `QueryClientProvider`) and a `queryKeys` helper:
- `queryKeys.me` — the `/auth/me` session query (`hooks/useAuth.ts`).
- `queryKeys.initialData(userId)` — the `/initial-data` bundle (accounts/transactions/goals/categories/currencies/balanceHistory), scoped per-user.

Key decisions:
- **Query keys must be scoped by user id**, not just a flat string like `['initial-data']`. A flat key let a second account's session serve the first account's cached data if login/logout happened without a full reload. **Why:** caught in code review after the migration — cache is keyed and persisted independent of which user is "current" unless the key encodes identity. **How to apply:** any new per-user query needs the user id (or equivalent) baked into its key, and `handleLogout` must `removeQueries` for that key prefix.
- socket.io's `data:updated` event calls `queryClient.invalidateQueries` instead of a manual `refreshData()` state update — real-time push now drives cache invalidation directly.
- Optimistic transaction inserts use `queryClient.setQueryData` to prepend the new transaction into the cached `initial-data` bundle (in `useAppData.ts`), not local component state.
- Plans (AI-drafted, ephemeral) intentionally stay in localStorage, not react-query — they aren't server data.
- The offline-fallback pattern (return last-known-cached user/data on network error) is implemented inside the `queryFn` itself, not via `onError`, since react-query v5 dropped query-level `onError`/`onSuccess` callbacks.
