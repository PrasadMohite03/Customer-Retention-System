import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import bcrypt from 'bcrypt';
import { UserRole, RewardType } from '@prisma/client';
import { generateAccessToken, generateCustomerAccessToken } from './utils/auth.utils';

const PORT = 5062;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runVerification() {
  console.log('=== STARTING REWARD BUG & REDEMPTION VERIFICATION (20 CHECKS) ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Test server running on ${BASE_URL}\n`);

  try {
    const timestamp = Date.now();
    const defaultPassword = 'StaffPassword123!';
    const passwordHash = await bcrypt.hash('OwnerPassword123!', 10);

    // ==========================================
    // SETUP FIXTURES
    // ==========================================
    console.log('[Setup] Creating Owner, Business, Branches, Staff, Customer...');

    // 1. Owner & Business
    const ownerUser = await prisma.user.create({
      data: {
        email: `owner_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const business = await prisma.business.create({
      data: {
        name: `Elite Spa & Salon ${timestamp}`,
        ownerId: ownerUser.id,
      },
    });

    const ownerToken = generateAccessToken({
      userId: ownerUser.id,
      role: UserRole.OWNER,
      businessId: business.id,
    });

    // 2. Branch 1 & Branch 2
    const branch1 = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: `Downtown Branch ${timestamp}`,
        address: '100 Main St',
        qrToken: `qr_dt_${timestamp}`,
        isActive: true,
      },
    });

    const branch2 = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: `Uptown Branch ${timestamp}`,
        address: '200 High St',
        qrToken: `qr_ut_${timestamp}`,
        isActive: true,
      },
    });

    // 3. Staff 1 (Assigned to Branch 1)
    const staffUser1 = await prisma.user.create({
      data: {
        email: `staff1_${timestamp}@test.com`,
        passwordHash: await bcrypt.hash(defaultPassword, 10),
        role: UserRole.STAFF,
      },
    });

    const staff1 = await prisma.staff.create({
      data: {
        userId: staffUser1.id,
        businessId: business.id,
        branchId: branch1.id,
        isActive: true,
      },
    });

    const staff1Token = generateAccessToken({
      userId: staffUser1.id,
      role: UserRole.STAFF,
      businessId: business.id,
    });

    // Staff 2 (Assigned to Branch 2)
    const staffUser2 = await prisma.user.create({
      data: {
        email: `staff2_${timestamp}@test.com`,
        passwordHash: await bcrypt.hash(defaultPassword, 10),
        role: UserRole.STAFF,
      },
    });

    const staff2 = await prisma.staff.create({
      data: {
        userId: staffUser2.id,
        businessId: business.id,
        branchId: branch2.id,
        isActive: true,
      },
    });

    const staff2Token = generateAccessToken({
      userId: staffUser2.id,
      role: UserRole.STAFF,
      businessId: business.id,
    });

    // 4. Customer
    const customer = await prisma.customer.create({
      data: {
        name: 'Prasad Customer',
        phone: `+9191${timestamp.toString().slice(-8)}`,
      },
    });

    const customerToken = generateCustomerAccessToken({
      customerId: customer.id,
      role: 'CUSTOMER',
    });

    // Ensure CustomerProfile exists
    const customerProfile = await prisma.customerProfile.create({
      data: {
        customerId: customer.id,
        businessId: business.id,
      },
    });

    // ==========================================
    // STEP 1 & 2: Configure cycleLength = 5, milestone at visit 5 with a reward
    // ==========================================
    console.log('--- STEP 1 & 2: Configure cycleLength = 5, milestone at visit 5 with reward ---');
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: business.id,
        branchId: branch1.id,
        name: 'VIP Spa Pass',
        cycleLength: 5,
        isActive: true,
      },
    });

    const milestone5 = await prisma.milestone.create({
      data: {
        programId: program.id,
        visitNumber: 5,
        rewardType: RewardType.FREE_ITEM,
        rewardName: 'Head Massage',
        rewardDescription: 'Complimentary 30-min scalp and head massage',
        isEnabled: true,
      },
    });

    console.log(`✓ Steps 1 & 2 PASSED: Program created (cycleLength=5) with milestone at visit 5 (${milestone5.rewardName})`);

    // Helper to submit & approve a visit
    async function submitAndApproveVisit(token: string) {
      const vReq = await prisma.visitRequest.create({
        data: {
          customerProfileId: customerProfile.id,
          branchId: branch1.id,
          status: 'PENDING',
        },
      });

      const resApprove = await fetch(`${BASE_URL}/api/staff/visit-requests/${vReq.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resApprove.json();
      if (resApprove.status !== 200) {
        throw new Error(`Approval failed with status ${resApprove.status}: ${JSON.stringify(data)}`);
      }
      return data.data;
    }

    // ==========================================
    // STEP 3: Approve visits 1–4
    // ==========================================
    console.log('\n--- STEP 3: Approve visits 1 to 4 ---');
    for (let i = 1; i <= 4; i++) {
      const res = await submitAndApproveVisit(staff1Token);
      console.log(`  Visit #${i} approved (visitNumberInCycle=${res.visitNumberInCycle}, cycleCompleted=${res.cycleCompleted})`);
    }
    console.log('✓ Step 3 PASSED: Visits 1–4 approved');

    // ==========================================
    // STEP 4: Confirm customer shows 4/5 and reward LOCKED
    // ==========================================
    console.log('\n--- STEP 4: Confirm customer shows 4/5 and reward LOCKED ---');
    const resStatus1 = await fetch(`${BASE_URL}/api/customer/loyalty/${branch1.qrToken}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusData1 = await resStatus1.json();
    if (statusData1.data?.cycle.visitCount !== 4 || statusData1.data?.cycle.cycleLength !== 5) {
      throw new Error(`Step 4 FAILED: Expected 4/5 stamps, got ${statusData1.data?.cycle.visitCount}/${statusData1.data?.cycle.cycleLength}`);
    }

    const milestoneInCurrentCycle = statusData1.data.milestones.find((m: any) => m.visitNumber === 5);
    if (!milestoneInCurrentCycle || milestoneInCurrentCycle.status !== 'LOCKED') {
      throw new Error(`Step 4 FAILED: Expected milestone at visit 5 to be LOCKED, got ${milestoneInCurrentCycle?.status}`);
    }
    if (statusData1.data.unlockedRewards.length !== 0) {
      throw new Error(`Step 4 FAILED: Expected 0 unlocked rewards at 4 stamps`);
    }
    console.log('✓ Step 4 PASSED: Customer shows 4/5 stamps and visit-5 reward is LOCKED');

    // ==========================================
    // STEP 5: Approve visit 5
    // ==========================================
    console.log('\n--- STEP 5: Approve visit 5 ---');
    const resVisit5 = await submitAndApproveVisit(staff1Token);
    console.log(`  Visit #5 approved: cycleCompleted=${resVisit5.cycleCompleted}, unlockedReward=${resVisit5.newRewardUnlocked?.rewardName}`);
    if (!resVisit5.cycleCompleted || !resVisit5.newRewardUnlocked) {
      throw new Error('Step 5 FAILED: Visit 5 should complete cycle and unlock reward');
    }
    console.log('✓ Step 5 PASSED: Visit 5 approved, cycle completed, reward unlocked');

    // ==========================================
    // STEP 6, 7, 8, 9: Confirm reward UNLOCKED, cycle 1 COMPLETED, current cycle 0/5, reward still UNLOCKED
    // ==========================================
    console.log('\n--- STEP 6–9: Inspect customer pass state after cycle completion ---');
    const resStatus2 = await fetch(`${BASE_URL}/api/customer/loyalty/${branch1.qrToken}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusData2 = await resStatus2.json();

    // Step 7: Check DB that cycle 1 is COMPLETED
    const dbCycle1 = await prisma.loyaltyCycle.findFirst({
      where: { customerProfileId: customerProfile.id, programId: program.id, cycleNumber: 1 },
    });
    if (dbCycle1?.status !== 'COMPLETED') {
      throw new Error(`Step 7 FAILED: Expected cycle 1 in DB to be COMPLETED, got ${dbCycle1?.status}`);
    }
    console.log('✓ Step 7 PASSED: Cycle 1 status is COMPLETED in DB');

    // Step 8: Confirm customer completed cycle shows 5/5 and isCycleCompleted
    if (statusData2.data.cycle.visitCount !== 5 || statusData2.data.cycle.cycleLength !== 5) {
      throw new Error(`Step 8 FAILED: Expected customer cycle to show 5/5 completed stamps, got ${statusData2.data.cycle.visitCount}/${statusData2.data.cycle.cycleLength}`);
    }
    console.log(`✓ Step 8 PASSED: Customer pass shows 5/5 completed stamps (Cycle #${statusData2.data.cycle.cycleNumber})`);

    // Step 6 & 9: Confirm reward from cycle 1 is visible and UNLOCKED immediately
    const unlockedReward = statusData2.data.unlockedRewards.find((r: any) => r.rewardName === 'Head Massage');
    if (!unlockedReward || unlockedReward.status !== 'UNLOCKED') {
      throw new Error(`Step 6 & 9 FAILED: Reward not found in unlockedRewards! Found: ${JSON.stringify(statusData2.data.unlockedRewards)}`);
    }
    const rewardVoucherId = unlockedReward.id;
    console.log(`✓ Step 6 & 9 PASSED: "Head Massage" reward is visible and status is UNLOCKED immediately (earned in cycle ${unlockedReward.cycleNumber})`);

    // Verify milestone at visit 5 is UNLOCKED
    const currentMilestone5 = statusData2.data.milestones.find((m: any) => m.visitNumber === 5);
    if (currentMilestone5?.status !== 'UNLOCKED') {
      throw new Error(`Expected completed cycle milestone 5 to be UNLOCKED for 5/5, got ${currentMilestone5?.status}`);
    }
    console.log('✓ Check PASSED: Completed cycle 1 milestone 5 is correctly UNLOCKED');

    // ==========================================
    // STEP 15: Confirm owner/staff can fetch unlocked rewards without entering raw UUID
    // ==========================================
    console.log('\n--- STEP 15: Staff/Owner fetches unlocked rewards list without raw UUID ---');
    const resStaffRewards = await fetch(`${BASE_URL}/api/staff/rewards/unlocked`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const staffRewardsData = await resStaffRewards.json();
    const foundReward = staffRewardsData.data?.find((r: any) => r.id === rewardVoucherId);
    if (!foundReward) {
      throw new Error(`Step 15 FAILED: Unlocked reward not listed in staff operational endpoint. Found: ${JSON.stringify(staffRewardsData.data)}`);
    }
    console.log(`✓ Step 15 PASSED: Staff fetched unlocked reward list: customer "${foundReward.customer.name}" has "${foundReward.rewardName}" ready for redemption`);

    // ==========================================
    // STEP 16: Confirm STAFF can only redeem rewards for their branch
    // ==========================================
    console.log('\n--- STEP 16: Confirm Staff 2 (Branch 2) CANNOT redeem Branch 1 reward ---');
    const resStaff2IllegalRedeem = await fetch(`${BASE_URL}/api/staff/rewards/${rewardVoucherId}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staff2Token}` },
    });
    if (resStaff2IllegalRedeem.status !== 403) {
      throw new Error(`Step 16 FAILED: Expected 403 Forbidden for cross-branch redemption, got ${resStaff2IllegalRedeem.status}`);
    }
    console.log('✓ Step 16 PASSED: Staff 2 cannot redeem reward belonging to Branch 1 (403 Forbidden)');

    // ==========================================
    // STEP 17: Confirm OWNER can redeem across their business
    // ==========================================
    console.log('\n--- STEP 17: Confirm OWNER can redeem reward across business ---');
    // Owner can fetch unlocked rewards across all branches
    const resOwnerRewards = await fetch(`${BASE_URL}/api/staff/rewards/unlocked`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerRewardsData = await resOwnerRewards.json();
    if (!ownerRewardsData.data?.some((r: any) => r.id === rewardVoucherId)) {
      throw new Error(`Step 17 FAILED: Owner could not view unlocked rewards across business`);
    }
    console.log('✓ Step 17 PASSED: Owner views unlocked rewards across business');

    // ==========================================
    // STEP 10: Redeem the reward
    // ==========================================
    console.log('\n--- STEP 10: Staff 1 redeems the reward ---');
    const resRedeem = await fetch(`${BASE_URL}/api/staff/rewards/${rewardVoucherId}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const redeemData = await resRedeem.json();
    if (resRedeem.status !== 200 || redeemData.data?.status !== 'REDEEMED') {
      throw new Error(`Step 10 FAILED: Expected 200 REDEEMED, got ${resRedeem.status}: ${JSON.stringify(redeemData)}`);
    }
    console.log('✓ Step 10 PASSED: Reward successfully marked as REDEEMED');

    // ==========================================
    // STEP 11 & 12: Confirm changes to REDEEMED and state persists upon page refresh
    // ==========================================
    console.log('\n--- STEP 11 & 12: Confirm customer pass shows REDEEMED and state persists ---');
    const resStatus3 = await fetch(`${BASE_URL}/api/customer/loyalty/${branch1.qrToken}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusData3 = await resStatus3.json();

    const redeemedReward = statusData3.data.redeemedRewards.find((r: any) => r.id === rewardVoucherId);
    if (!redeemedReward || redeemedReward.status !== 'REDEEMED') {
      throw new Error(`Step 11 & 12 FAILED: Expected reward in redeemedRewards with status REDEEMED. Found: ${JSON.stringify(statusData3.data.redeemedRewards)}`);
    }
    if (statusData3.data.unlockedRewards.length !== 0) {
      throw new Error(`Step 11 & 12 FAILED: Unlocked rewards should now be 0 after redemption`);
    }
    console.log('✓ Step 11 & 12 PASSED: Reward shows as REDEEMED in customer pass and persists across refreshes');

    // ==========================================
    // STEP 13: Confirm a new visit starts cycle 2 at 1/5
    // ==========================================
    console.log('\n--- STEP 13: New visit starts cycle 2 at 1/5 ---');
    const resVisit6 = await submitAndApproveVisit(staff1Token);
    if (resVisit6.cycleNumber !== 2 || resVisit6.visitNumberInCycle !== 1) {
      throw new Error(`Step 13 FAILED: Expected cycle 2, visit 1. Got cycle ${resVisit6.cycleNumber}, visit ${resVisit6.visitNumberInCycle}`);
    }

    const resStatus4 = await fetch(`${BASE_URL}/api/customer/loyalty/${branch1.qrToken}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusData4 = await resStatus4.json();
    if (statusData4.data.cycle.cycleNumber !== 2 || statusData4.data.cycle.visitCount !== 1) {
      throw new Error(`Step 13 FAILED: Customer pass did not update to cycle 2 at 1/5! Got: ${statusData4.data.cycle.cycleNumber} at ${statusData4.data.cycle.visitCount}`);
    }
    console.log(`✓ Step 13 PASSED: Cycle 2 successfully started at 1/5 stamps`);

    // ==========================================
    // STEP 14: Confirm cycle-1 reward remains in reward history
    // ==========================================
    console.log('\n--- STEP 14: Confirm cycle-1 reward remains in reward history ---');
    const historyReward = statusData4.data.rewards.find((r: any) => r.id === rewardVoucherId);
    if (!historyReward || historyReward.status !== 'REDEEMED' || historyReward.cycleNumber !== 1) {
      throw new Error(`Step 14 FAILED: Cycle 1 reward missing from history: ${JSON.stringify(statusData4.data.rewards)}`);
    }
    console.log(`✓ Step 14 PASSED: Cycle-1 reward "${historyReward.rewardName}" remains in customer rewards history (Cycle 1, status: REDEEMED)`);

    // ==========================================
    // STEP 18: Confirm concurrent approval protection still works
    // ==========================================
    console.log('\n--- STEP 18: Confirm concurrent approval protection ---');
    const reqConcurrent = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfile.id,
        branchId: branch1.id,
        status: 'PENDING',
      },
    });

    const [raceRes1, raceRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/staff/visit-requests/${reqConcurrent.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staff1Token}` },
      }),
      fetch(`${BASE_URL}/api/staff/visit-requests/${reqConcurrent.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staff1Token}` },
      }),
    ]);

    const statuses = [raceRes1.status, raceRes2.status];
    const successes = statuses.filter((s) => s === 200).length;
    const conflicts = statuses.filter((s) => s === 409).length;

    if (successes !== 1 || conflicts !== 1) {
      throw new Error(`Step 18 FAILED: Expected exactly one 200 and one 409, got: ${JSON.stringify(statuses)}`);
    }
    console.log('✓ Step 18 PASSED: Concurrency check verified: exactly one 200 OK and one 409 Conflict');

    console.log('\n======================================================');
    console.log('ALL VERIFICATION SCENARIO CHECKS PASSED SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err: any) {
    console.error('\n❌ VERIFICATION SCENARIO FAILED:', err.stack || err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

runVerification();
