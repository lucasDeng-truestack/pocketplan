-- CreateEnum
CREATE TYPE "RecurringCadence" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "correctsId" TEXT,
ADD COLUMN     "recurringId" TEXT;

-- CreateTable
CREATE TABLE "RecurringItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TransactionType" NOT NULL,
    "amountSen" INTEGER NOT NULL,
    "envelopeId" TEXT,
    "merchant" TEXT,
    "note" TEXT,
    "cadence" "RecurringCadence" NOT NULL,
    "startOn" DATE NOT NULL,
    "handledCount" INTEGER NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preference" (
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'modern',
    "mode" TEXT NOT NULL DEFAULT 'system',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "RecurringItem_userId_idx" ON "RecurringItem"("userId");

-- CreateIndex
CREATE INDEX "Transaction_correctsId_idx" ON "Transaction"("correctsId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_correctsId_fkey" FOREIGN KEY ("correctsId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
