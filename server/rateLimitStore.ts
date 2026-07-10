import type { PrismaClient } from "@prisma/client";
import type { Store, Options, ClientRateLimitInfo } from "express-rate-limit";

/**
 * A Postgres-backed express-rate-limit store using the existing Prisma
 * connection. Needed because the deployment target is "autoscale" (multiple
 * server instances can run concurrently) — the default in-memory store keeps
 * counters per-process, so limits are effectively multiplied by the number
 * of running instances. Backing the counters with the shared Postgres
 * database keeps the limit consistent no matter how many instances are up.
 */
export class PrismaRateLimitStore implements Store {
  localKeys = false;
  private prisma: PrismaClient;
  private windowMs = 60 * 1000;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private prefixedKey(key: string) {
    return `rl:${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const id = this.prefixedKey(key);
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + this.windowMs);

    // Atomic upsert via raw SQL: if the existing window has expired, reset
    // the counter to 1 with a fresh expiry; otherwise increment in place.
    // This avoids read-then-write races across concurrent instances.
    const rows = await this.prisma.$queryRaw<{ points: number; expires_at: Date }[]>`
      INSERT INTO rate_limit_hits (key, points, "expiresAt")
      VALUES (${id}, 1, ${newExpiresAt})
      ON CONFLICT (key) DO UPDATE SET
        points = CASE
          WHEN rate_limit_hits."expiresAt" <= ${now} THEN 1
          ELSE rate_limit_hits.points + 1
        END,
        "expiresAt" = CASE
          WHEN rate_limit_hits."expiresAt" <= ${now} THEN ${newExpiresAt}
          ELSE rate_limit_hits."expiresAt"
        END
      RETURNING points, "expiresAt" as expires_at
    `;

    const row = rows[0];
    return {
      totalHits: row.points,
      resetTime: row.expires_at,
    };
  }

  async decrement(key: string): Promise<void> {
    const id = this.prefixedKey(key);
    await this.prisma.$executeRaw`
      UPDATE rate_limit_hits SET points = GREATEST(points - 1, 0)
      WHERE key = ${id}
    `;
  }

  async resetKey(key: string): Promise<void> {
    const id = this.prefixedKey(key);
    await this.prisma.$executeRaw`
      DELETE FROM rate_limit_hits WHERE key = ${id}
    `;
  }
}

/**
 * Per-account failed-login tracking, independent of the IP-based
 * express-rate-limit middleware above. The IP limiter alone can be bypassed
 * by an attacker rotating source IPs (botnets/proxies) — each new IP gets a
 * fresh bucket. This tracks failures keyed by the *account* (normalized
 * email) instead, so repeated attempts against the same account are throttled
 * no matter how many different IPs they come from. Backed by the same shared
 * Postgres table used for the IP limiter, so it holds up under autoscale too.
 */
const ACCOUNT_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_LOCKOUT_MAX_ATTEMPTS = 10;

function accountFailureKey(normalizedEmail: string) {
  return `acct-fail:${normalizedEmail}`;
}

/**
 * Returns true if the account is currently locked out due to too many
 * recent failed login attempts (across any IP).
 */
export async function isAccountLockedOut(prisma: PrismaClient, normalizedEmail: string): Promise<boolean> {
  const key = accountFailureKey(normalizedEmail);
  const now = new Date();
  const row = await prisma.rateLimitHit.findUnique({ where: { key } });
  if (!row) return false;
  if (row.expiresAt <= now) return false;
  return row.points >= ACCOUNT_LOCKOUT_MAX_ATTEMPTS;
}

/**
 * Records a failed login attempt for the given account. Call this whenever
 * a login fails (unknown user or bad password) for a given email, regardless
 * of the requester's IP.
 */
export async function recordAccountLoginFailure(prisma: PrismaClient, normalizedEmail: string): Promise<void> {
  const key = accountFailureKey(normalizedEmail);
  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + ACCOUNT_LOCKOUT_WINDOW_MS);

  await prisma.$executeRaw`
    INSERT INTO rate_limit_hits (key, points, "expiresAt")
    VALUES (${key}, 1, ${newExpiresAt})
    ON CONFLICT (key) DO UPDATE SET
      points = CASE
        WHEN rate_limit_hits."expiresAt" <= ${now} THEN 1
        ELSE rate_limit_hits.points + 1
      END,
      "expiresAt" = CASE
        WHEN rate_limit_hits."expiresAt" <= ${now} THEN ${newExpiresAt}
        ELSE rate_limit_hits."expiresAt"
      END
  `;
}

/**
 * Clears the failed-attempt counter for an account, e.g. after a successful
 * login.
 */
export async function resetAccountLoginFailures(prisma: PrismaClient, normalizedEmail: string): Promise<void> {
  const key = accountFailureKey(normalizedEmail);
  await prisma.$executeRaw`
    DELETE FROM rate_limit_hits WHERE key = ${key}
  `;
}
