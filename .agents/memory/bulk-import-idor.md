---
name: Bulk import ownership checks
description: Any bulk/batch import endpoint that upserts-by-client-supplied-id needs per-record AND per-foreign-key ownership checks, not just shape validation.
---

Bulk import endpoints (accepting arrays of records with client-supplied ids to upsert) have two independent classes of risk that both need fixing, not just one:

1. **Shape/type validation** — obvious, catches malformed payloads (zod schema with `.passthrough()` if legacy payloads carry extra fields the service already strips).
2. **Ownership on every id used as a write target AND every id used as a foreign-key reference.** A record's own `id` (upsert target) is the obvious one; it's easy to miss that a record's *foreign keys* (e.g. a transaction's `categoryId`/`accountId`) also need ownership checks before being trusted, or a user can link/probe another user's rows via the import payload even without directly upserting them.

**Why:** the first pass fixed direct upsert-by-id IDOR (account/category/goal/transaction upserts) but missed that transactions also carry categoryId/subcategoryId foreign refs pointing at another user's rows — a code review caught it as a residual gap.

**How to apply:** when adding ownership checks to a bulk import/upsert path, enumerate every id field on every entity — both the entity's own id and any id it references — and verify each against a per-user "valid ids" set (existing + newly created this batch) before writing. Drop/null out non-owned foreign refs rather than erroring the whole batch.
