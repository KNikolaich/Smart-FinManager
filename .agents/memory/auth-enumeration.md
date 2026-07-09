---
name: Auth enumeration responses
description: Rule for avoiding user enumeration in auth endpoints (forgot-password, etc.)
---

Auth endpoints that reveal account existence (e.g. forgot-password) must return an identical generic success response for all outcomes: unknown email, no recoverable password, decryption failure, or mail delivery failure. Only genuine input validation errors (e.g. missing email field) may return a different status.

**Why:** Distinct 404/400 responses or error text let an attacker probe which emails have accounts (enumeration vulnerability).

**How to apply:** When adding/editing any auth flow that looks up a user by identifier (password reset, account recovery, invite checks), route all "not found" / "can't process" branches into the same neutral response used for success, and log the real reason server-side only.
