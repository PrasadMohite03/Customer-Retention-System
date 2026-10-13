import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import bcrypt from 'bcrypt';
import { UserRole, RewardType } from '@prisma/client';
import { generateAccessToken, generateCustomerAccessToken } from './utils/auth.utils';
import { LoyaltyService } from './services/loyalty.service';
import { RewardChangeMode } from './utils/cycleSnapshot';

const PORT = 5063;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runVerification() {
  console.log('=== STARTING LOYALTY CYCLE SNAPSHOT & CHANGE IMPACT ARCHITECTURE VERIFICATION ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Test server running on ${BASE_URL}\n`);

  try {
    const timestamp = Date.now();
    const passwordHash = await bcrypt.hash('OwnerPassword123!', 10);

    // ==========================================
    // 1. SETUP FIXTURES
    // ==========================================
    console.log('[Setup] Creating Owner, Business, Branch, Staff, and Customers...');

    const ownerUser = await prisma.user.create({
      data: {
        email: `owner_snap_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const business = await prisma.business.create({
      data: {
        name: `Change Impact Test Business ${timestamp}`,
        ownerId: ownerUser.id,
      },
    });

    const ownerToken = generateAccessToken({
      userId: ownerUser.id,
      role: UserRole.OWNER,
      businessId: business.id,
    });

    const branch = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: `Main Branch ${timestamp}`,
        address: '123 Main St',
        qrToken: `qr_snap_${timestamp}`,
        isActive: true,
      },
    });

    const staffUser = await prisma.user.create({
      data: {
        email: `staff_snap_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    const staff = await prisma.staff.create({
      data: {
        userId: staffUser.id,
        branchId: branch.id,
        businessId: business.id,
        isActive: true,
      },
    });

    const staffToken = generateAccessToken({
      userId: staffUser.id,
      role: UserRole.STAFF,
      businessId: business.id,
    });

    // Helper: approve a visit for a customer
    async function recordVisit(customerToken: string, qrToken: string, approverToken: string = ownerToken) {
      // Customer requests visit
      const reqRes = await fetch(`${BASE_URL}/api/customer/visit-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrToken }),
      });
      const reqData = await reqRes.json();
      if (!reqRes.ok) throw new Error(`Visit request failed: ${JSON.stringify(reqData)}`);

      // Approver approves visit
      const appRes = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqData.data.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${approverToken}`,
          'Content-Type': 'application/json',
        },
      });
      const appData = await appRes.json();
      if (!appRes.ok) throw new Error(`Visit approval failed: ${JSON.stringify(appData)}`);
      return appData.data;
    }

    // Helper: get customer loyalty status
    async function getCustomerStatus(customerToken: string, qrToken: string) {
      const res = await fetch(`${BASE_URL}/api/customer/loyalty/${qrToken}`, {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Loyalty status failed: ${JSON.stringify(data)}`);
      return data.data;
    }

    // =========================================================================
    // TEST 1: CORE BUSINESS RULE - Cycle length change does not break active cycle
    // Program has 6 visits. Customer A reaches 4/6.
    // Program cycle length is reduced to 3.
    // Customer A continues 4/6 -> 5/6 -> 6/6 and completes cycle.
    // Customer A's next cycle runs at 0/3 -> 1/3 -> 2/3 -> 3/3.
    // =========================================================================
    console.log('\n--- TEST 1: CORE BUSINESS RULE: Program cycle length change protects active cycle ---');

    // Create 6-visit program with milestone at visit 4 and visit 6
    const program1 = await prisma.loyaltyProgram.create({
      data: {
        branchId: branch.id,
        businessId: business.id,
        name: '6-Visit Program',
        cycleLength: 6,
        isActive: true,
        milestones: {
          create: [
            {
              visitNumber: 4,
              rewardType: RewardType.FIXED_DISCOUNT,
              rewardName: '₹25 Discount',
              rewardValue: 25,
              isEnabled: true,
            },
            {
              visitNumber: 6,
              rewardType: RewardType.FREE_ITEM,
              rewardName: 'Free Head Massage',
              isEnabled: true,
            },
          ],
        },
      },
      include: { milestones: true },
    });

    const custA = await prisma.customer.create({
      data: { name: 'Customer A', phone: `+919811${timestamp.toString().slice(-6)}` },
    });
    const custAToken = generateCustomerAccessToken({
      customerId: custA.id,
      role: 'CUSTOMER',
    });

    // Customer A does 4 visits
    for (let i = 1; i <= 4; i++) {
      await recordVisit(custAToken, branch.qrToken);
    }

    let statusA = await getCustomerStatus(custAToken, branch.qrToken);
    if (statusA.cycle.visitCount !== 4 || statusA.cycle.cycleLength !== 6) {
      throw new Error(`Expected Customer A at 4/6, got ${statusA.cycle.visitCount}/${statusA.cycle.cycleLength}`);
    }
    console.log(`✓ Customer A correctly at 4/6 visits on initial 6-visit program`);

    // Owner changes program to 3 visits, Visit 3 -> Free Coffee
    // First disable conflicting milestones from program so they don't block cycle length reduction:
    await prisma.milestone.updateMany({
      where: { programId: program1.id, visitNumber: { gt: 3 } },
      data: { isEnabled: false },
    });
    const visit3Milestone = await prisma.milestone.create({
      data: {
        programId: program1.id,
        visitNumber: 3,
        rewardType: RewardType.FREE_ITEM,
        rewardName: 'Free Coffee',
        isEnabled: true,
      },
    });

    await LoyaltyService.updateLoyaltyProgram(branch.id, business.id, {
      cycleLength: 3,
    });
    console.log('✓ Owner reduced program cycleLength from 6 to 3');

    // Verify Customer A's active cycle is NOT affected and still shows 4/6
    statusA = await getCustomerStatus(custAToken, branch.qrToken);
    if (statusA.cycle.visitCount !== 4 || statusA.cycle.cycleLength !== 6) {
      throw new Error(`Customer A active cycle was corrupted! Expected 4/6, got ${statusA.cycle.visitCount}/${statusA.cycle.cycleLength}`);
    }
    console.log(`✓ Customer A active cycle preserved at 4/6 (not truncated to 4/3)`);

    // Customer A visits for visit 5
    const visit5 = await recordVisit(custAToken, branch.qrToken);
    if (visit5.visitNumberInCycle !== 5 || visit5.cycleCompleted !== false) {
      throw new Error(`Visit 5 failed: visitNumber=${visit5.visitNumberInCycle}, completed=${visit5.cycleCompleted}`);
    }
    console.log(`✓ Customer A advanced to 5/6 (cycle completed = false)`);

    // Customer A visits for visit 6
    const visit6 = await recordVisit(custAToken, branch.qrToken);
    if (visit6.visitNumberInCycle !== 6 || visit6.cycleCompleted !== true) {
      throw new Error(`Visit 6 failed: visitNumber=${visit6.visitNumberInCycle}, completed=${visit6.cycleCompleted}`);
    }
    console.log(`✓ Customer A completed cycle at 6/6`);

    // Customer A visits again (visit 7 total, which starts Cycle 2)
    const visit7 = await recordVisit(custAToken, branch.qrToken);
    if (visit7.visitNumberInCycle !== 1 || visit7.cycleNumber !== 2) {
      throw new Error(`Cycle 2 visit 1 failed: visitNumber=${visit7.visitNumberInCycle}, cycleNumber=${visit7.cycleNumber}`);
    }

    statusA = await getCustomerStatus(custAToken, branch.qrToken);
    if (statusA.cycle.cycleLength !== 3 || statusA.cycle.visitCount !== 1) {
      throw new Error(`Expected Customer A in cycle 2 at 1/3, got ${statusA.cycle.visitCount}/${statusA.cycle.cycleLength}`);
    }
    console.log(`✓ Customer A smoothly transitioned to Cycle 2 at 1/3 visits (new 3-visit program)`);

    // =========================================================================
    // TEST 2: CLARIFICATION FOR EXISTING_AND_NEW
    // Program: 6 visits. Visit 4 -> 20% Off
    // Customer X -> 3/6
    // Customer Y -> 4/6 and already earned 20% Off
    // Owner changes Visit 4 -> Free Dessert (mode: EXISTING_AND_NEW)
    // Customer X -> receives Free Dessert at Visit 4
    // Customer Y -> keeps their existing 20% Off reward
    // New cycles -> Free Dessert
    // =========================================================================
    console.log('\n--- TEST 2: CLARIFICATION FOR EXISTING_AND_NEW (Exact User Spec) ---');

    // Setup fresh 6-visit program on a new branch
    const branch2 = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: `Branch 2 ${timestamp}`,
        address: '456 Side St',
        qrToken: `qr_b2_${timestamp}`,
        isActive: true,
      },
    });

    const program2 = await prisma.loyaltyProgram.create({
      data: {
        branchId: branch2.id,
        businessId: business.id,
        name: 'Program 2 - 6 Visits',
        cycleLength: 6,
        isActive: true,
        milestones: {
          create: [
            {
              visitNumber: 4,
              rewardType: RewardType.PERCENT_DISCOUNT,
              rewardName: '20% Off',
              rewardValue: 20,
              isEnabled: true,
            },
          ],
        },
      },
      include: { milestones: true },
    });
    const visit4Milestone = program2.milestones[0];

    // Customer X (will be at 3/6)
    const custX = await prisma.customer.create({
      data: { name: 'Customer X', phone: `+919822${timestamp.toString().slice(-6)}` },
    });
    const custXToken = generateCustomerAccessToken({
      customerId: custX.id,
      role: 'CUSTOMER',
    });

    // Customer Y (will be at 4/6 and earn 20% Off)
    const custY = await prisma.customer.create({
      data: { name: 'Customer Y', phone: `+919833${timestamp.toString().slice(-6)}` },
    });
    const custYToken = generateCustomerAccessToken({
      customerId: custY.id,
      role: 'CUSTOMER',
    });

    // Customer X visits 3 times (3/6)
    for (let i = 1; i <= 3; i++) {
      await recordVisit(custXToken, branch2.qrToken);
    }
    const statusXBefore = await getCustomerStatus(custXToken, branch2.qrToken);
    console.log(`✓ Customer X currently at ${statusXBefore.cycle.visitCount}/6`);

    // Customer Y visits 4 times (4/6) - earns 20% Off
    for (let i = 1; i <= 4; i++) {
      await recordVisit(custYToken, branch2.qrToken);
    }
    const statusYBefore = await getCustomerStatus(custYToken, branch2.qrToken);
    const earnedYBefore = statusYBefore.rewards.find((r: any) => r.rewardName === '20% Off');
    if (!earnedYBefore) {
      throw new Error(`Customer Y did not earn 20% Off at Visit 4`);
    }
    console.log(`✓ Customer Y currently at 4/6 and earned: "${earnedYBefore.rewardName}"`);

    // OWNER CHANGES VISIT 4 -> Free Dessert WITH EXISTING_AND_NEW
    await LoyaltyService.applyMilestoneRewardChange(
      visit4Milestone.id,
      business.id,
      RewardChangeMode.EXISTING_AND_NEW,
      {
        rewardType: RewardType.FREE_ITEM,
        rewardName: 'Free Dessert',
        rewardValue: null,
      }
    );
    console.log('✓ Owner changed Visit 4 -> Free Dessert with EXISTING_AND_NEW');

    // Check Customer X's status: should see upcoming Visit 4 reward updated to "Free Dessert"
    const statusXAfterChange = await getCustomerStatus(custXToken, branch2.qrToken);
    const milestone4ForX = statusXAfterChange.milestones.find((m: any) => m.visitNumber === 4);
    if (milestone4ForX?.rewardName !== 'Free Dessert') {
      throw new Error(`Customer X expected upcoming reward Free Dessert, got: ${milestone4ForX?.rewardName}`);
    }
    console.log(`✓ Customer X's unreached milestone updated to: "${milestone4ForX.rewardName}"`);

    // Check Customer Y's status: should KEEP existing 20% Off reward!
    const statusYAfterChange = await getCustomerStatus(custYToken, branch2.qrToken);
    const earnedYAfter = statusYAfterChange.rewards.find((r: any) => r.id === earnedYBefore.id);
    if (!earnedYAfter || earnedYAfter.rewardName !== '20% Off') {
      throw new Error(`Customer Y's earned reward was overwritten! Got: ${earnedYAfter?.rewardName}`);
    }
    console.log(`✓ Customer Y's earned reward unchanged: "${earnedYAfter.rewardName}"`);

    // Now Customer X visits for visit 4: should receive Free Dessert!
    const visit4X = await recordVisit(custXToken, branch2.qrToken);
    if (!visit4X.newRewardUnlocked || visit4X.newRewardUnlocked.rewardName !== 'Free Dessert') {
      throw new Error(`Customer X expected Free Dessert upon reaching visit 4, got: ${JSON.stringify(visit4X.newRewardUnlocked)}`);
    }
    console.log(`✓ Customer X reached visit 4 and unlocked: "${visit4X.newRewardUnlocked.rewardName}"`);

    // Customer Z starts a brand new cycle: should receive Free Dessert at visit 4
    const custZ = await prisma.customer.create({
      data: { name: 'Customer Z', phone: `+919844${timestamp.toString().slice(-6)}` },
    });
    const custZToken = generateCustomerAccessToken({
      customerId: custZ.id,
      role: 'CUSTOMER',
    });
    for (let i = 1; i <= 4; i++) {
      await recordVisit(custZToken, branch2.qrToken);
    }
    const statusZ = await getCustomerStatus(custZToken, branch2.qrToken);
    const earnedZ = statusZ.rewards.find((r: any) => r.rewardName === 'Free Dessert');
    if (!earnedZ) {
      throw new Error(`Customer Z (new cycle) did not earn Free Dessert at visit 4`);
    }
    console.log(`✓ New cycle (Customer Z) earned: "${earnedZ.rewardName}" at visit 4`);

    // =========================================================================
    // TEST 3: NEW_CYCLES_ONLY MODE
    // Owner changes Visit 4 to "Free Appetizer" with NEW_CYCLES_ONLY
    // Customer W at 3/6 keeps "Free Dessert"
    // New cycle Customer V gets "Free Appetizer"
    // =========================================================================
    console.log('\n--- TEST 3: NEW_CYCLES_ONLY MODE ---');

    // Customer W at 3/6
    const custW = await prisma.customer.create({
      data: { name: 'Customer W', phone: `+919855${timestamp.toString().slice(-6)}` },
    });
    const custWToken = generateCustomerAccessToken({
      customerId: custW.id,
      role: 'CUSTOMER',
    });
    for (let i = 1; i <= 3; i++) {
      await recordVisit(custWToken, branch2.qrToken);
    }

    // Owner changes Visit 4 to "Free Appetizer" with NEW_CYCLES_ONLY
    await LoyaltyService.applyMilestoneRewardChange(
      visit4Milestone.id,
      business.id,
      RewardChangeMode.NEW_CYCLES_ONLY,
      {
        rewardType: RewardType.FREE_ITEM,
        rewardName: 'Free Appetizer',
        rewardValue: null,
      }
    );
    console.log('✓ Owner changed Visit 4 -> Free Appetizer with NEW_CYCLES_ONLY');

    // Customer W reaches Visit 4: should get Free Dessert (their active snapshot)
    const visit4W = await recordVisit(custWToken, branch2.qrToken);
    if (visit4W.newRewardUnlocked?.rewardName !== 'Free Dessert') {
      throw new Error(`Customer W expected snapshot reward Free Dessert, got: ${visit4W.newRewardUnlocked?.rewardName}`);
    }
    console.log(`✓ Customer W active cycle kept original reward: "${visit4W.newRewardUnlocked.rewardName}"`);

    // Customer V starts fresh cycle: should get Free Appetizer
    const custV = await prisma.customer.create({
      data: { name: 'Customer V', phone: `+919866${timestamp.toString().slice(-6)}` },
    });
    const custVToken = generateCustomerAccessToken({
      customerId: custV.id,
      role: 'CUSTOMER',
    });
    for (let i = 1; i <= 4; i++) {
      await recordVisit(custVToken, branch2.qrToken);
    }
    const statusV = await getCustomerStatus(custVToken, branch2.qrToken);
    const earnedV = statusV.rewards.find((r: any) => r.rewardName === 'Free Appetizer');
    if (!earnedV) {
      throw new Error(`Customer V (new cycle) expected Free Appetizer, got: ${JSON.stringify(statusV.rewards)}`);
    }
    console.log(`✓ New cycle (Customer V) got updated reward: "${earnedV.rewardName}"`);

    // =========================================================================
    // TEST 4: STOP_REWARD MODE
    // Owner stops/disables Visit 4 reward
    // Unreached customer does not receive reward
    // Already earned reward remains redeemable
    // =========================================================================
    console.log('\n--- TEST 4: STOP_REWARD MODE ---');

    // Customer U is at 3/6
    const custU = await prisma.customer.create({
      data: { name: 'Customer U', phone: `+919877${timestamp.toString().slice(-6)}` },
    });
    const custUToken = generateCustomerAccessToken({
      customerId: custU.id,
      role: 'CUSTOMER',
    });
    for (let i = 1; i <= 3; i++) {
      await recordVisit(custUToken, branch2.qrToken);
    }

    // Owner stops the reward
    await LoyaltyService.applyMilestoneRewardChange(
      visit4Milestone.id,
      business.id,
      RewardChangeMode.STOP_REWARD
    );
    console.log('✓ Owner stopped Visit 4 reward with STOP_REWARD');

    // Customer U visits for visit 4: NO reward should be unlocked
    const visit4U = await recordVisit(custUToken, branch2.qrToken);
    if (visit4U.newRewardUnlocked !== null) {
      throw new Error(`Customer U unlocked a stopped reward: ${JSON.stringify(visit4U.newRewardUnlocked)}`);
    }
    console.log('✓ Customer U reached visit 4 and unlocked NO reward (stopped cleanly)');

    // Customer Y (who earned 20% Off earlier) redeems their reward with owner/staff
    const redemptionRes = await fetch(`${BASE_URL}/api/staff/rewards/redeem-by-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rewardToken: earnedYAfter.redemptionToken,
      }),
    });
    const redemptionData = await redemptionRes.json();
    if (!redemptionRes.ok) {
      throw new Error(`Customer Y failed to redeem their existing reward: ${JSON.stringify(redemptionData)}`);
    }
    console.log(`✓ Customer Y successfully redeemed their pre-existing reward "${earnedYAfter.rewardName}"`);

    console.log('\n=============================================================');
    console.log('ALL TESTS PASSED! LOYALTY CHANGE IMPACT ARCHITECTURE VERIFIED');
    console.log('=============================================================\n');
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
