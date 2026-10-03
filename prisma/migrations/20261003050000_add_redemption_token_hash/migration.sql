-- AlterTable: Add redemption token hash and creation timestamp to MilestoneReward
ALTER TABLE "MilestoneReward" ADD COLUMN "redemptionTokenHash" TEXT;
ALTER TABLE "MilestoneReward" ADD COLUMN "redemptionTokenCreatedAt" TIMESTAMP(3);

-- CreateIndex: Unique index on redemptionTokenHash for fast exact-match lookup
CREATE UNIQUE INDEX "MilestoneReward_redemptionTokenHash_key" ON "MilestoneReward"("redemptionTokenHash");
