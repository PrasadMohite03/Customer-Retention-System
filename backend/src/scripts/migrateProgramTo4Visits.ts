import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, MilestoneRewardStatus } from '@prisma/client';
import { deriveRedemptionTokenForReward, hashRedemptionToken } from '../utils/redemptionToken';

const prisma = new PrismaClient();

/**
 * Migration script: Updates "Apex Salon Loyalty Program" to the 4-qualifying-visit model:
 * 1. Sets cycleLength = 4 on LoyaltyProgram.
 * 2. Updates milestone "Head Massage" to visitNumber = 4.
 * 3. Transitions existing cycles with visitCount >= 4 to COMPLETED and provisions the UNLOCKED MilestoneReward.
 */
async function migrateProgramTo4Visits() {
  console.log('=== STARTING LOYALTY PROGRAM 4-VISIT MIGRATION ===\n');

  const program = await prisma.loyaltyProgram.findFirst({
    where: {
      name: { contains: 'Apex Salon', mode: 'insensitive' },
    },
    include: {
      milestones: true,
      loyaltyCycles: {
        where: { status: 'ACTIVE', visitCount: { gte: 4 } },
        include: {
          customerProfile: { include: { customer: true } },
          milestoneRewards: true,
        },
      },
    },
  });

  if (!program) {
    console.log('No "Apex Salon" program found. Checking other programs...');
    return;
  }

  console.log(`Found Program: "${program.name}" (ID: ${program.id})`);
  console.log(`  Current cycleLength: ${program.cycleLength}`);

  // 1. Update cycleLength to 4
  const updatedProgram = await prisma.loyaltyProgram.update({
    where: { id: program.id },
    data: { cycleLength: 4 },
  });
  console.log(`  ✓ Updated cycleLength to ${updatedProgram.cycleLength}`);

  // 2. Update milestone visitNumber from 5 to 4
  const milestone = program.milestones.find((m) => m.visitNumber === 5 || m.rewardName === 'Head Massage');
  if (milestone) {
    console.log(`  Found Milestone: "${milestone.rewardName}" at visitNumber ${milestone.visitNumber}`);
    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        visitNumber: 4,
        rewardDescription: 'After 4 qualifying visits Head Massage Free',
      },
    });
    console.log(`  ✓ Updated Milestone to visitNumber = ${updatedMilestone.visitNumber}`);
  }

  // 3. Complete active cycles that reached 4 visits and unlock reward
  for (const cycle of program.loyaltyCycles) {
    console.log(`\n  Processing Cycle #${cycle.cycleNumber} (ID: ${cycle.id}) for Customer ${cycle.customerProfile.customer.name} (${cycle.customerProfile.customer.phone})...`);
    console.log(`    Current visits: ${cycle.visitCount}/4, Status: ${cycle.status}`);

    const updatedCycle = await prisma.loyaltyCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    console.log(`    ✓ Cycle status transitioned to: ${updatedCycle.status}`);

    // Check if reward already exists
    const existingReward = cycle.milestoneRewards.find(
      (r) => r.snapshotRewardName === 'Head Massage' || r.milestoneId === milestone?.id
    );

    if (!existingReward && milestone) {
      // Create new UNLOCKED MilestoneReward with cryptographic token hash
      const newReward = await prisma.milestoneReward.create({
        data: {
          loyaltyCycleId: cycle.id,
          milestoneId: milestone.id,
          snapshotRewardType: milestone.rewardType,
          snapshotRewardValue: milestone.rewardValue,
          snapshotRewardName: milestone.rewardName,
          snapshotRewardDescription: 'After 4 qualifying visits Head Massage Free',
          status: MilestoneRewardStatus.UNLOCKED,
          unlockedAt: new Date(),
        },
      });

      const rawToken = deriveRedemptionTokenForReward(newReward.id);
      const tokenHash = hashRedemptionToken(rawToken);

      await prisma.milestoneReward.update({
        where: { id: newReward.id },
        data: {
          redemptionTokenHash: tokenHash,
          redemptionTokenCreatedAt: new Date(),
        },
      });

      console.log(`    ✓ Created UNLOCKED MilestoneReward: "${newReward.snapshotRewardName}"`);
      console.log(`    ✓ Generated canonical redemption token hash (raw token available to customer in app)`);
    } else {
      console.log(`    • Milestone reward already exists for this cycle.`);
    }
  }

  console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===');
}

migrateProgramTo4Visits()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
