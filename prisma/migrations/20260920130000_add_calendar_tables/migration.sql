-- Objects that were added to schema.prisma via `prisma db push` without a
-- migration. Written idempotently so databases that already have them
-- (created by db push) apply this migration as a no-op.
-- "calendar_plans"."disableFrom" is added by the next migration.

-- AlterTable
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'RUB';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "calendarOccurrenceId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "calendar_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "time" VARCHAR(5),
    "recurrence" TEXT NOT NULL DEFAULT 'none',
    "weekdays" JSONB,
    "transactionType" TEXT NOT NULL DEFAULT 'expense',
    "accountId" TEXT,
    "categoryId" TEXT,
    "color" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "calendar_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "calendar_occurrences" (
    "id" TEXT NOT NULL,
    "calendarPlanId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "manuallyCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calendar_plans_userId_archivedAt_idx" ON "calendar_plans"("userId", "archivedAt");
CREATE INDEX IF NOT EXISTS "calendar_plans_accountId_idx" ON "calendar_plans"("accountId");
CREATE INDEX IF NOT EXISTS "calendar_plans_categoryId_idx" ON "calendar_plans"("categoryId");
CREATE INDEX IF NOT EXISTS "calendar_notes_userId_date_idx" ON "calendar_notes"("userId", "date");
CREATE INDEX IF NOT EXISTS "calendar_occurrences_date_idx" ON "calendar_occurrences"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_occurrences_calendarPlanId_date_key" ON "calendar_occurrences"("calendarPlanId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_calendarOccurrenceId_key" ON "transactions"("calendarOccurrenceId");

-- AddForeignKey (PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_calendarOccurrenceId_fkey') THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_calendarOccurrenceId_fkey" FOREIGN KEY ("calendarOccurrenceId") REFERENCES "calendar_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_plans_userId_fkey') THEN
    ALTER TABLE "calendar_plans" ADD CONSTRAINT "calendar_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_plans_accountId_fkey') THEN
    ALTER TABLE "calendar_plans" ADD CONSTRAINT "calendar_plans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_plans_categoryId_fkey') THEN
    ALTER TABLE "calendar_plans" ADD CONSTRAINT "calendar_plans_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_notes_userId_fkey') THEN
    ALTER TABLE "calendar_notes" ADD CONSTRAINT "calendar_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_occurrences_calendarPlanId_fkey') THEN
    ALTER TABLE "calendar_occurrences" ADD CONSTRAINT "calendar_occurrences_calendarPlanId_fkey" FOREIGN KEY ("calendarPlanId") REFERENCES "calendar_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
