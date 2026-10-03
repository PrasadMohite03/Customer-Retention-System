import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables before any application services are used
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import prisma from '../lib/prisma';
import {
  deriveRedemptionTokenForReward,
  hashRedemptionToken,
} from '../utils/redemptionToken';

/**
 * Idempotent backfill script for UNLOCKED MilestoneReward records.
 *
 * Rules:
 * - Only process UNLOCKED rewards.
 * - If reward already has the correct canonical token hash, skip it (idempotent).
 * - If reward has NULL or a mismatched/fallback token hash, assign the canonical token hash.
 * - Never process REDEEMED rewards.
 * - Ensure token uniqueness with database retry if collision occurs.
 * - Running multiple times does not alter valid canonical tokens.
 */
export async function backfillRedemptionTokens(): Promise<{
  processed: number;
  skipped: number;
}> {
  console.log('[Backfill] Starting redemption token backfill...');

  const unlockedRewards = await prisma.milestoneReward.findMany({
    where: {
      status: 'UNLOCKED',
    },
    select: {
      id: true,
      status: true,
      snapshotRewardName: true,
      redemptionTokenHash: true,
    },
  });

  console.log(`[Backfill] Found ${unlockedRewards.length} UNLOCKED rewards in database.`);

  let processed = 0;
  let skipped = 0;

  for (const reward of unlockedRewards) {
    // Check if reward already has a valid canonical hash
    const canonicalToken = deriveRedemptionTokenForReward(reward.id, 0);
    const canonicalHash = hashRedemptionToken(canonicalToken);

    if (reward.redemptionTokenHash === canonicalHash) {
      skipped++;
      continue;
    }

    let success = false;
    let attempt = 0;

    while (!success && attempt < 5) {
      try {
        const rawToken = deriveRedemptionTokenForReward(reward.id, attempt);
        const tokenHash = hashRedemptionToken(rawToken);

        const result = await prisma.milestoneReward.updateMany({
          where: {
            id: reward.id,
            status: 'UNLOCKED',
          },
          data: {
            redemptionTokenHash: tokenHash,
            redemptionTokenCreatedAt: new Date(),
          },
        });

        if (result.count > 0) {
          processed++;
          console.log(`[Backfill] Assigned canonical token hash for reward ${reward.id} (${reward.snapshotRewardName}).`);
        }
        success = true;
      } catch (err: any) {
        if (err.code === 'P2002') {
          // Unique constraint collision on redemptionTokenHash
          console.warn(`[Backfill] Hash collision for reward ${reward.id}, retrying with attempt ${attempt + 1}...`);
          attempt++;
        } else {
          console.error(`[Backfill] Failed to update reward ${reward.id}:`, err);
          throw err;
        }
      }
    }

    if (!success) {
      throw new Error(`[Backfill] Could not assign unique token to reward ${reward.id} after 5 attempts.`);
    }
  }

  console.log(`[Backfill] Completed. Successfully backfilled ${processed} rewards, skipped ${skipped} already-canonical rewards.`);
  return { processed, skipped };
}

// If executed directly via CLI
if (require.main === module) {
  backfillRedemptionTokens()
    .then((res) => {
      console.log('[Backfill] Done:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Backfill] Fatal error:', err);
      process.exit(1);
    });
}
