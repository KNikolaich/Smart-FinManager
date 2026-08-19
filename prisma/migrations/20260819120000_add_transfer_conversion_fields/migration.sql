-- Cross-currency transfers: amount credited to the target account in its own
-- currency, and the exchange rate fixed at the moment of the operation.
ALTER TABLE "transactions" ADD COLUMN "targetAmount" DOUBLE PRECISION;
ALTER TABLE "transactions" ADD COLUMN "exchangeRate" DOUBLE PRECISION;
