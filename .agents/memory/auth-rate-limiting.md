---
name: Auth rate limiting setup
description: How auth endpoint rate limiting and trust proxy are configured in this app
---

Auth endpoints (login, register, forgot-password) use `express-rate-limit`. Login and
forgot-password share a strict limiter (10 requests / 15 min); register uses a looser
one (20 requests / 15 min). Both return a generic 429 JSON message.

`app.set("trust proxy", 1)` is set narrowly (trust only the first hop) so
`express-rate-limit` keys on the real client IP from `X-Forwarded-For` behind
Replit's proxy, without trusting the whole forwarded chain (which would allow IP
spoofing via arbitrary client-supplied headers).

**Why:** Auth endpoints had no throttling, exposing them to brute-force/credential
stuffing. Blanket `trust proxy: true` would let a malicious client spoof `X-Forwarded-For`
to bypass IP-based limits.

**How to apply:** When adding new unauthenticated, abuse-prone routes, reuse the shared
limiter configs rather than inventing new ones, and keep `trust proxy` scoped to 1 hop.

## Shared store for autoscale deployments

The deployment target is `autoscale` (multiple server instances can run concurrently).
`express-rate-limit`'s default `MemoryStore` counts per-process, so with N instances an
attacker effectively gets `limit * N` attempts by fanning requests across instances.

Fix: a custom `Store` (`server/rateLimitStore.ts`, `PrismaRateLimitStore`) persists hit
counters in Postgres via the existing Prisma connection (`rate_limit_hits` table), using
an atomic `INSERT ... ON CONFLICT` upsert so concurrent instances don't race. Both auth
limiters pass `store: new PrismaRateLimitStore(prisma)`.

**Why:** No new infra (Redis, etc.) was needed since Postgres was already the shared
resource available to every instance; an atomic upsert avoids the read-then-write race
a naive get/set store would have under concurrent instances.

**How to apply:** Any new rate limiter added to this app must use the same
`PrismaRateLimitStore` (or an equivalent shared store) rather than the default in-memory
store, or it will silently lose effectiveness once multiple instances are running.
