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
