---
name: Transactions endpoint pagination
description: How GET /api/transactions pagination is structured and the date-range/legacy-mode pitfalls to avoid when touching it again.
---

`GET /api/transactions` supports two modes, dispatched in the controller by presence of `page`/`pageSize` query params:

- **Paged mode** (page/pageSize given): returns `{ transactions, total, page, pageSize, totalPages, totalIncome, totalExpense }`. Supports filters: `startDate`, `endDate`, `type`, `accountIds`, `categoryIds`, `search`, `searchCategoryIds`, `searchAccountIds` (comma-separated id lists). `totalIncome`/`totalExpense` are aggregated server-side over the *whole* filtered set, not just the current page — needed so period totals stay correct while paginating.
- **Legacy unpaged mode** (no page/pageSize): returns a plain array of *all* matching rows, for callers that need the full list (AI context building, exports). This path must bypass the paged mode's `MAX_PAGE_SIZE` cap entirely (via an internal sentinel), not just pass a very large `pageSize` — a large-but-capped `pageSize` silently truncates legacy callers.

**Why:** these two call shapes were conflated once and a "large pageSize" hack still got capped, silently returning partial data to legacy consumers.

**How to apply:** if adding new filters or callers, decide up front whether they want a page or the full set, and route through the matching mode. Also remember `endDate` must be normalized to end-of-day (`23:59:59.999`) before use in `lte`, otherwise same-day/month-end transactions are excluded.

Frontend: `TransactionHistory.tsx` fetches its own paginated data via `api.getTransactionsPage()` (no longer takes a `transactions` prop). It refetches page 1 when filters change or when the parent's `refreshSignal` prop (an incrementing counter bumped after every data refresh in `App.tsx`) changes, so edits/deletes made elsewhere in the app are reflected.
