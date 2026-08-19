import { describe, expect, it } from 'vitest';
import { splitCompoundAlterTable } from '../../server/controllers/admin.controller';

describe('Prisma database diff parsing', () => {
  it('keeps SQL statements that follow Prisma section comments', () => {
    expect(splitCompoundAlterTable(`
-- AlterTable
ALTER TABLE "Account" ADD COLUMN "currencyId" TEXT;

-- CreateIndex
CREATE INDEX "Account_currencyId_idx" ON "Account"("currencyId");
`)).toEqual([
      'ALTER TABLE "Account" ADD COLUMN "currencyId" TEXT;',
      'CREATE INDEX "Account_currencyId_idx" ON "Account"("currencyId");',
    ]);
  });

  it('still separates an incompatible compound ALTER TABLE statement', () => {
    expect(splitCompoundAlterTable(`
-- AlterTable
ALTER TABLE "Account" RENAME CONSTRAINT "old_pkey" TO "Account_pkey",
  ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
`)).toEqual([
      'ALTER TABLE "Account" RENAME CONSTRAINT "old_pkey" TO "Account_pkey";',
      'ALTER TABLE "Account" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;',
    ]);
  });
});