-- CreateTable
CREATE TABLE "currency_rate_collection_runs" (
    "id" TEXT NOT NULL,
    "runDate" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "currency_rate_collection_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currency_rate_collection_runs_runDate_key" ON "currency_rate_collection_runs"("runDate");

-- CreateIndex
CREATE INDEX "currency_rate_collection_runs_source_status_idx" ON "currency_rate_collection_runs"("source", "status");
