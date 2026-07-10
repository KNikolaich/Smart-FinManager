---
name: App.tsx / Dashboard.tsx component structure
description: How the top-level App shell and Dashboard were decomposed after they grew past ~800-1000 lines; where to add new logic.
---

`App.tsx` (shell/orchestrator only) delegates to:
- `hooks/useAuth.ts` — user/loading state, `/auth/me` check with offline fallback, logout.
- `hooks/useAppData.ts` — accounts/transactions/goals/categories/currencies/balanceHistory/plans state, `refreshData`, socket.io real-time refresh, startup offline-queue sync, optimistic transaction add.
- `hooks/useGlobalInputContextMenu.ts` — the global right-click copy/cut/paste/select-all menu for text inputs.
- `components/app/AppHeader.tsx`, `components/app/BottomNav.tsx` — header and bottom tab bar, receive tab state as props.
- `components/app/AppModals.tsx` — bundles all overlay modals (TransactionHistory, AddTransaction, EditTransaction, UserPage, AILogs, global context menu) behind one component to keep `App.tsx` free of JSX modal clutter.

`Dashboard.tsx` (orchestrator only) delegates to:
- `hooks/useDashboardMetrics.ts` — all derived/memoized figures (totalBalance, dashboardAccounts, monthlyStats, monthlyRollingBalance, recentTransactions, groupedTransactions, balanceTrend).
- `components/dashboard/TotalBalanceCard.tsx`, `AccountsSection.tsx`, `TransactionsSection.tsx`, `GoalsSection.tsx`, `SortableGoalCard.tsx` — each section owns its own local UI state (e.g. AccountManager modal, goal drag-and-drop, context menus) rather than lifting it to Dashboard, to avoid prop-drilling.

**Why:** both files had grown to 800-1000+ lines mixing data-fetching, effects, and large JSX trees, making changes risky and hard to review.

**How to apply:** new dashboard sections or app-level modals should get their own file under `components/dashboard/` or `components/app/`; new cross-cutting data/state concerns belong in a `hooks/use*.ts` file, not inlined into the orchestrator component. Watch for pre-existing dead code (e.g. an unused voice-quick-add flow was found and removed during this split) — verify with `grep` that a handler is actually wired to JSX before assuming a refactor broke it.
