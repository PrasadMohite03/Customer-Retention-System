-- CreateEnum
CREATE TYPE "RewardClaimStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "RewardClaim" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "loyaltyCycleId" TEXT,
    "programId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "expectedVisitNumber" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "RewardClaimStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_tokenHash_key" ON "RewardClaim"("tokenHash");

-- CreateIndex
CREATE INDEX "RewardClaim_customerProfileId_idx" ON "RewardClaim"("customerProfileId");

-- CreateIndex
CREATE INDEX "RewardClaim_branchId_idx" ON "RewardClaim"("branchId");

-- CreateIndex
CREATE INDEX "RewardClaim_branchId_status_idx" ON "RewardClaim"("branchId", "status");

-- CreateIndex
CREATE INDEX "RewardClaim_tokenHash_idx" ON "RewardClaim"("tokenHash");

-- CreateIndex
CREATE INDEX "RewardClaim_expiresAt_idx" ON "RewardClaim"("expiresAt");

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_loyaltyCycleId_fkey" FOREIGN KEY ("loyaltyCycleId") REFERENCES "LoyaltyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_consumedByStaffId_fkey" FOREIGN KEY ("consumedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
