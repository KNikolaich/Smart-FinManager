-- AlterTable
ALTER TABLE "currencies" ADD COLUMN     "buyRate" DOUBLE PRECISION,
ADD COLUMN     "rateSource" TEXT,
ADD COLUMN     "rateUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "sellRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "currency_rate_snapshots" (
    "id" TEXT NOT NULL,
    "iso" TEXT NOT NULL,
    "buyRate" DOUBLE PRECISION NOT NULL,
    "sellRate" DOUBLE PRECISION NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "quoteType" TEXT NOT NULL,

    CONSTRAINT "currency_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "currency_rate_snapshots_iso_quotedAt_idx" ON "currency_rate_snapshots"("iso", "quotedAt");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rate_snapshots_iso_quotedAt_source_quoteType_key" ON "currency_rate_snapshots"("iso", "quotedAt", "source", "quoteType");
