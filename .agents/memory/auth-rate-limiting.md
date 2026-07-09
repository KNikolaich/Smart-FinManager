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
