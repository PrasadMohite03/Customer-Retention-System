-- CreateEnum: VisitType to distinguish loyalty-qualifying from reward-redemption visits
CREATE TYPE "VisitType" AS ENUM ('QUALIFYING', 'REWARD_REDEMPTION');

-- AlterTable: Add visitType with default QUALIFYING, allow null visitRequestId and visitNumberInCycle for reward redemptions
ALTER TABLE "Visit" ADD COLUMN "visitType" "VisitType" NOT NULL DEFAULT 'QUALIFYING';
ALTER TABLE "Visit" ALTER COLUMN "visitRequestId" DROP NOT NULL;
ALTER TABLE "Visit" ALTER COLUMN "visitNumberInCycle" DROP NOT NULL;

-- CreateIndex: Analytics and query optimization indexes
CREATE INDEX "Visit_branchId_visitType_idx" ON "Visit"("branchId", "visitType");
CREATE INDEX "Visit_createdAt_idx" ON "Visit"("createdAt");
CREATE INDEX "Visit_branchId_createdAt_idx" ON "Visit"("branchId", "createdAt");
CREATE INDEX "Visit_loyaltyCycleId_visitType_idx" ON "Visit"("loyaltyCycleId", "visitType");
