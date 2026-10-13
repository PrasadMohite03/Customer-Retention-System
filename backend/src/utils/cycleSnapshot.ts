import { RewardType } from '@prisma/client';
import prisma from '../lib/prisma';

export enum RewardChangeMode {
  NEW_CYCLES_ONLY = 'NEW_CYCLES_ONLY',
  EXISTING_AND_NEW = 'EXISTING_AND_NEW',
  STOP_REWARD = 'STOP_REWARD',
}

export interface CycleMilestoneSnapshot {
  id: string;
  visitNumber: number;
  rewardType: RewardType;
  rewardName: string | null;
  rewardDescription: string | null;
  rewardValue: string | null;
  isEnabled: boolean;
}

/**
 * Converts a list of Prisma Milestone records into standard JSON-serializable CycleMilestoneSnapshot items.
 */
export function serializeMilestonesForSnapshot(
  milestones: Array<{
    id: string;
    visitNumber: number;
    rewardType: RewardType;
    rewardName?: string | null;
    rewardDescription?: string | null;
    rewardValue?: any;
    isEnabled?: boolean;
  }>
): CycleMilestoneSnapshot[] {
  return milestones.map((m) => ({
    id: m.id,
    visitNumber: m.visitNumber,
    rewardType: m.rewardType,
    rewardName: m.rewardName ?? null,
    rewardDescription: m.rewardDescription ?? null,
    rewardValue: m.rewardValue != null ? m.rewardValue.toString() : null,
    isEnabled: m.isEnabled !== false,
  }));
}

/**
 * Resolves active/enabled milestone definitions for a cycle.
 * Prefers the cycle's snapshotMilestones if present, otherwise falls back to the program's live milestones.
 * Only returns milestones where isEnabled !== false.
 */
export function getEffectiveCycleMilestones(
  activeCycle: { snapshotMilestones?: any } | null | undefined,
  fallbackMilestones: Array<any>
): CycleMilestoneSnapshot[] {
  if (activeCycle && Array.isArray(activeCycle.snapshotMilestones)) {
    return (activeCycle.snapshotMilestones as unknown as CycleMilestoneSnapshot[]).filter(
      (m) => m.isEnabled !== false
    );
  }
  return fallbackMilestones
    .filter((m) => m.isEnabled !== false)
    .map((m) => ({
      id: m.id,
      visitNumber: m.visitNumber,
      rewardType: m.rewardType,
      rewardName: m.rewardName ?? null,
      rewardDescription: m.rewardDescription ?? null,
      rewardValue: m.rewardValue != null ? m.rewardValue.toString() : null,
      isEnabled: m.isEnabled !== false,
    }));
}

/**
 * Resolves all milestone definitions for a cycle including disabled ones.
 */
export function getAllEffectiveCycleMilestones(
  activeCycle: { snapshotMilestones?: any } | null | undefined,
  fallbackMilestones: Array<any>
): CycleMilestoneSnapshot[] {
  if (activeCycle && Array.isArray(activeCycle.snapshotMilestones)) {
    return activeCycle.snapshotMilestones as unknown as CycleMilestoneSnapshot[];
  }
  return fallbackMilestones.map((m) => ({
    id: m.id,
    visitNumber: m.visitNumber,
    rewardType: m.rewardType,
    rewardName: m.rewardName ?? null,
    rewardDescription: m.rewardDescription ?? null,
    rewardValue: m.rewardValue != null ? m.rewardValue.toString() : null,
    isEnabled: m.isEnabled !== false,
  }));
}

/**
 * Resolves effective cycle length for a cycle.
 * Prefers the cycle's snapshotCycleLength if present, otherwise falls back to program's cycleLength.
 */
export function getEffectiveCycleLength(
  activeCycle: { snapshotCycleLength?: number | null } | null | undefined,
  fallbackCycleLength: number
): number {
  return activeCycle?.snapshotCycleLength ?? fallbackCycleLength;
}

/**
 * Propagates milestone modifications to active loyalty cycles based on the selected RewardChangeMode.
 *
 * Rules:
 * - NEW_CYCLES_ONLY: Active cycles are not modified. Only future cycles will use the new config.
 * - EXISTING_AND_NEW:
 *   - If the customer has NOT reached/earned the reward yet (cycle.visitCount < targetVisitNumber AND no MilestoneReward exists):
 *     Update the milestone configuration in the cycle's snapshotMilestones.
 *   - If the customer has already reached/earned that reward:
 *     Their existing MilestoneReward must remain unchanged.
 *   - Historical/redeemed rewards must never be modified.
 * - STOP_REWARD:
 *   - If the customer has NOT reached/earned the reward yet:
 *     Disable the milestone in their snapshotMilestones so they can no longer earn it.
 *   - If the customer has already earned it:
 *     Their MilestoneReward remains safe and redeemable.
 */
export async function syncMilestoneChangeToActiveCycles(params: {
  programId: string;
  milestoneId: string;
  targetVisitNumber: number;
  mode: RewardChangeMode;
  updatedMilestone?: {
    id: string;
    visitNumber: number;
    rewardType: RewardType;
    rewardName: string | null;
    rewardDescription: string | null;
    rewardValue: string | null;
    isEnabled: boolean;
  };
}) {
  const { programId, milestoneId, targetVisitNumber, mode, updatedMilestone } = params;

  if (mode === 'NEW_CYCLES_ONLY') {
    // New cycles pick up changes from the database table; active cycles are untouched
    return;
  }

  // Find all ACTIVE cycles for this program
  const activeCycles = await prisma.loyaltyCycle.findMany({
    where: {
      programId,
      status: 'ACTIVE',
    },
    include: {
      milestoneRewards: {
        where: {
          milestoneId,
        },
      },
    },
  });

  for (const cycle of activeCycles) {
    const hasReached = cycle.visitCount >= targetVisitNumber;
    const hasEarnedReward = cycle.milestoneRewards.length > 0;
    const hasAlreadyEarnedOrReached = hasReached || hasEarnedReward;

    if (hasAlreadyEarnedOrReached) {
      // Historical/earned rewards remain strictly untouched
      continue;
    }

    // Customer has NOT reached the affected reward milestone yet
    const currentSnapshots = (cycle.snapshotMilestones as unknown as CycleMilestoneSnapshot[]) || [];

    if (mode === 'EXISTING_AND_NEW' && updatedMilestone) {
      let matched = false;
      const updatedSnapshots = currentSnapshots.map((item) => {
        if (item.id === milestoneId || item.visitNumber === targetVisitNumber) {
          matched = true;
          return {
            id: updatedMilestone.id,
            visitNumber: updatedMilestone.visitNumber,
            rewardType: updatedMilestone.rewardType,
            rewardName: updatedMilestone.rewardName,
            rewardDescription: updatedMilestone.rewardDescription,
            rewardValue: updatedMilestone.rewardValue,
            isEnabled: updatedMilestone.isEnabled,
          };
        }
        return item;
      });

      if (!matched) {
        updatedSnapshots.push({
          id: updatedMilestone.id,
          visitNumber: updatedMilestone.visitNumber,
          rewardType: updatedMilestone.rewardType,
          rewardName: updatedMilestone.rewardName,
          rewardDescription: updatedMilestone.rewardDescription,
          rewardValue: updatedMilestone.rewardValue,
          isEnabled: updatedMilestone.isEnabled,
        });
      }

      updatedSnapshots.sort((a, b) => a.visitNumber - b.visitNumber);

      await prisma.loyaltyCycle.update({
        where: { id: cycle.id },
        data: {
          snapshotMilestones: updatedSnapshots as any,
        },
      });
    } else if (mode === 'STOP_REWARD') {
      const updatedSnapshots = currentSnapshots.map((item) => {
        if (item.id === milestoneId || item.visitNumber === targetVisitNumber) {
          return {
            ...item,
            isEnabled: false,
          };
        }
        return item;
      });

      await prisma.loyaltyCycle.update({
        where: { id: cycle.id },
        data: {
          snapshotMilestones: updatedSnapshots as any,
        },
      });
    }
  }
}
