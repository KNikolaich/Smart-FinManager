-- Dates detached from a recurring plan ("edit only this event").
ALTER TABLE "calendar_plans" ADD COLUMN IF NOT EXISTS "excludedDates" JSONB;
