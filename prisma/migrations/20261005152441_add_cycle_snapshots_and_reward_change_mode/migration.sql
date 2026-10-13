-- CreateEnum
CREATE TYPE "RewardChangeMode" AS ENUM ('NEW_CYCLES_ONLY', 'EXISTING_AND_NEW', 'STOP_REWARD');

-- AlterTable
ALTER TABLE "LoyaltyCycle" ADD COLUMN     "snapshotCycleLength" INTEGER,
ADD COLUMN     "snapshotMilestones" JSONB;

-- Backfill snapshotCycleLength from linked LoyaltyProgram
UPDATE "LoyaltyCycle" lc
SET "snapshotCycleLength" = lp."cycleLength"
FROM "LoyaltyProgram" lp
WHERE lc."programId" = lp."id" AND lc."snapshotCycleLength" IS NULL;

-- Backfill snapshotMilestones from linked Milestones
UPDATE "LoyaltyCycle" lc
SET "snapshotMilestones" = COALESCE(
  (
    SELECT json_agg(
      json_build_object(
        'id', m."id",
        'visitNumber', m."visitNumber",
        'rewardType', m."rewardType",
        'rewardName', m."rewardName",
        'rewardDescription', m."rewardDescription",
        'rewardValue', m."rewardValue",
        'isEnabled', m."isEnabled"
      ) ORDER BY m."visitNumber" ASC
    )
    FROM "Milestone" m
    WHERE m."programId" = lc."programId"
  ),
  '[]'::json
)
WHERE lc."snapshotMilestones" IS NULL;
