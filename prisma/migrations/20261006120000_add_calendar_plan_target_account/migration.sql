-- Planned transfers: destination account of a calendar plan.
ALTER TABLE "calendar_plans" ADD COLUMN IF NOT EXISTS "targetAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "calendar_plans_targetAccountId_idx" ON "calendar_plans"("targetAccountId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_plans_targetAccountId_fkey') THEN
    ALTER TABLE "calendar_plans" ADD CONSTRAINT "calendar_plans_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
