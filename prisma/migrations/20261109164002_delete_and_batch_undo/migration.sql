-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "DeletedEnvelope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT,
    "icon" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedEnvelope_userId_idx" ON "DeletedEnvelope"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_batchId_idx" ON "Transaction"("userId", "batchId");

-- AddForeignKey
ALTER TABLE "DeletedEnvelope" ADD CONSTRAINT "DeletedEnvelope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
