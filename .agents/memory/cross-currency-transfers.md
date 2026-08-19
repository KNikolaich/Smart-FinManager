---
name: Cross-currency transfers
description: Durable invariants for transfers between accounts in different currencies
---

Transfers store the debited amount (source-account currency), the credited amount (target-account currency) and the exchange rate (target units per 1 source unit) fixed at the moment of the operation. Records created before this feature have null conversion fields and behave 1:1.

**Why:** balances corrupt if any code path credits the source-currency amount to a target account in a different currency, or trusts client-side arithmetic.

**How to apply:**
- The server re-validates conversion data on every write path (including bulk import): positive amounts, a distinct target account, and consistency between the two amounts and the rate within money-precision tolerance only.
- Every balance mutation — server writes, import, and the client's offline/local-cache mirror — must debit the source amount and credit the target amount, falling back 1:1 for legacy records.
- The rate is fixed at operation time; never recompute it from the currency directory when editing or deleting.
- Account currency is stored loosely (id reference, ISO code, or symbol); always resolve it through the shared frontend helper rather than ad-hoc matching.
- Schema changes now ship as Prisma migrations; production runs migrate deploy with a baseline fallback for databases created before migrations existed (pre-existing schema matches the 0_init migration).
