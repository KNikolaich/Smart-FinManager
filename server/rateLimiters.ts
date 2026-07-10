import rateLimit from "express-rate-limit";
import { prisma } from "./prisma";
import { PrismaRateLimitStore } from "./rateLimitStore";

// Rate limiting for auth endpoints to mitigate brute-force / credential
// stuffing / account enumeration attempts.
const authLimiterMessage = {
  error: "Too many attempts. Please try again later.",
};

// Rate-limit counters are backed by Postgres (via Prisma) rather than the
// default in-memory store: the deployment target is "autoscale", which can
// run multiple server instances concurrently, and in-memory counters are
// per-process — attackers could get `limit x instanceCount` attempts by
// hitting different instances. A shared store keeps the limit accurate
// regardless of instance count.
// Stricter limiter for login and forgot-password: 10 attempts per 15 minutes.
export const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: authLimiterMessage,
  store: new PrismaRateLimitStore(prisma),
});

// Slightly looser limiter for registration: 20 attempts per 15 minutes.
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: authLimiterMessage,
  store: new PrismaRateLimitStore(prisma),
});
