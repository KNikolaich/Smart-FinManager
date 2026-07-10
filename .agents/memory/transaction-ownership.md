---
name: Transaction account/category ownership validation
description: Why transaction create/update/delete must check row ownership server-side, not just id shape.
---

Zod schemas only validate id *shape*, not that the referenced account/category
row exists and belongs to the current user. Without an explicit ownership
check, a stale/foreign id (e.g. from AI assistant reference data) hits Prisma
as a raw foreign-key violation (P2003) and surfaces as an opaque 500.

**Why:** The AI assistant's account/category reference list can go stale,
and nothing else validates cross-user references before they reach the DB.

**How to apply:** Any endpoint that writes a Transaction (or similar row with
FK references editable by the client) must: (1) look up
accountId/targetAccountId/categoryId/subcategoryId scoped to `userId` and
throw a 400 with a human-readable message if missing, (2) scope every
transaction lookup/update/delete and every account balance mutation to
`userId` (via `findFirst`/`updateMany` with `userId` in the where clause,
not `findUnique`/`update` by id alone) so a foreign id can't touch another
user's data — return 404 when not owned.
