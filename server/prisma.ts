import { PrismaClient } from "@prisma/client";

// Single shared Prisma client instance used across the whole server.
export const prisma = new PrismaClient();
