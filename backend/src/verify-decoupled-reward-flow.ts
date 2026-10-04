import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, UserRole, RewardType } from '@prisma/client';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from './app';
import { generateCustomerAccessToken } from './utils/auth.utils';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function generateUserToken(payload: { userId: string; role: UserRole; businessId: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runDecoupledRewardFlowVerification() {
  console.log('=== RUNNING DECOUPLED REWARD FLOW E2E VERIFICATION ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const timestamp = Date.now();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Setup Business, Branches, Staff
    console.log('1. Setting up Business, 2 Branches, Staff...');
    const owner = await prisma.user.create({
      data: {
        email: `decoupled_owner_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const business = await prisma.business.create({
      data: {
        name: `Decoupled Cafe ${timestamp}`,
        type: 'CAFE',
        ownerId: owner.id,
      },
    });

    const branch1 = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: `Downtown Branch ${timestamp}`,
        address: '100 Main St',
        qrToken: `qr_decoupled_b1_${timestamp}`,
      },
    });

    const branch2 = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: `Uptown Branch ${timestamp}`,
        address: '200 High St',
        qrToken: `qr_decoupled_b2_${timestamp}`,
      },
    });

    const staff1User = await prisma.user.create({
      data: {
        email: `decoupled_staff1_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    const staff1 = await prisma.staff.create({
      data: {
        userId: staff1User.id,
        businessId: business.id,
        branchId: branch1.id,
        isActive: true,
      },
    });

    const staff2User = await prisma.user.create({
      data: {
        email: `decoupled_staff2_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    const staff2 = await prisma.staff.create({
      data: {
        userId: staff2User.id,
        businessId: business.id,
        branchId: branch2.id,
        isActive: true,
      },
    });

    const ownerToken = generateUserToken({ userId: owner.id, role: UserRole.OWNER, businessId: business.id });
    const staff1Token = generateUserToken({ userId: staff1User.id, role: UserRole.STAFF, businessId: business.id });
    const staff2Token = generateUserToken({ userId: staff2User.id, role: UserRole.STAFF, businessId: business.id });

    // 2. Create Loyalty Program with cycleLength = 4
    console.log('2. Creating Loyalty Program (cycleLength = 4) with milestones...');
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: business.id,
        branchId: branch1.id,
        name: 'Coffee Club 4',
        cycleLength: 4,
        isActive: true,
      },
    });

    // Milestone 1: NONE
    await prisma.milestone.create({
      data: {
        programId: program.id,
        visitNumber: 1,
        rewardType: RewardType.NONE,
        rewardName: null,
      },
    });

    // Milestone 4: FREE_ITEM ("Free Coffee")
    const milestone4 = await prisma.milestone.create({
      data: {
        programId: program.id,
        visitNumber: 4,
        rewardType: RewardType.FREE_ITEM,
        rewardName: 'Free Coffee',
        rewardDescription: 'One complimentary artisanal brew',
      },
    });

    // 3. Create Customer
    const customer = await prisma.customer.create({
      data: {
        phone: `+9199999${String(timestamp).slice(-5)}`,
        name: 'Jane Doe',
      },
    });
    const customerToken = generateCustomerAccessToken({ customerId: customer.id, role: 'CUSTOMER' });

    // 4. Test Visits 1, 2, 3
    console.log('3. Submitting and approving Visits 1, 2, 3...');
    for (let v = 1; v <= 3; v++) {
      const reqRes = await fetch(`${baseUrl}/customer/visit-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ qrToken: branch1.qrToken }),
      });
      const reqData: any = await reqRes.json();
      if (!reqRes.ok) throw new Error(`Visit ${v} request failed: ${JSON.stringify(reqData)}`);

      const appRes = await fetch(`${baseUrl}/staff/visit-requests/${reqData.data.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staff1Token}` },
      });
      const appData: any = await appRes.json();
      if (!appRes.ok) throw new Error(`Visit ${v} approval failed: ${JSON.stringify(appData)}`);

      if (appData.data.visitNumberInCycle !== v) {
        throw new Error(`Expected visitNumberInCycle = ${v}, got ${appData.data.visitNumberInCycle}`);
      }
      if (appData.data.newRewardUnlocked !== null) {
        throw new Error(`Expected no reward on visit ${v}`);
      }
    }

    // Verify after visit 3: no MilestoneReward exists
    const rewardsAfter3 = await prisma.milestoneReward.findMany({
      where: { milestone: { programId: program.id } },
    });
    if (rewardsAfter3.length !== 0) {
      throw new Error(`Expected 0 milestone rewards after visit 3, found ${rewardsAfter3.length}`);
    }
    console.log('   ✓ Visits 1, 2, 3 tracked cleanly. NONE milestone created no reward.');

    // 5. Submit and approve Visit 4 (Milestone Reached!)
    console.log('4. Submitting and approving Visit 4 (Milestone Reached)...');
    const req4Res = await fetch(`${baseUrl}/customer/visit-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ qrToken: branch1.qrToken }),
    });
    const req4Data: any = await req4Res.json();
    const app4Res = await fetch(`${baseUrl}/staff/visit-requests/${req4Data.data.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const app4Data: any = await app4Res.json();
    if (!app4Res.ok) throw new Error(`Visit 4 approval failed: ${JSON.stringify(app4Data)}`);

    if (!app4Data.data.cycleCompleted) {
      throw new Error('Expected cycleCompleted = true on visit 4');
    }
    if (!app4Data.data.newRewardUnlocked) {
      throw new Error('Expected newRewardUnlocked to be present on visit 4');
    }
    console.log('   ✓ Visit 4 completed cycle and unlocked reward in approval response.');

    // 6. Inspect customer status immediately after Visit 4
    console.log('5. Fetching customer loyalty status immediately after Visit 4...');
    const statusRes = await fetch(`${baseUrl}/customer/loyalty/${branch1.qrToken}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusData: any = await statusRes.json();
    if (!statusRes.ok) throw new Error(`Loyalty status failed: ${JSON.stringify(statusData)}`);

    const loyaltyCycle = statusData.data.cycle;
    console.log('   Loyalty cycle:', loyaltyCycle);
    if (loyaltyCycle.visitCount !== 4) {
      throw new Error(`Expected cycle.visitCount = 4, got ${loyaltyCycle.visitCount}`);
    }
    if (loyaltyCycle.status !== 'COMPLETED') {
      throw new Error(`Expected cycle.status = 'COMPLETED', got ${loyaltyCycle.status}`);
    }
    if (statusData.data.unlockedRewards.length !== 1) {
      throw new Error(`Expected 1 unlockedReward, got ${statusData.data.unlockedRewards.length}`);
    }

    const unlockedReward = statusData.data.unlockedRewards[0];
    const rawToken = unlockedReward.redemptionToken;
    console.log('   Unlocked reward raw token:', rawToken);
    if (!rawToken || !rawToken.startsWith('RP-')) {
      throw new Error(`Expected valid redemption token starting with RP-, got ${rawToken}`);
    }
    if (statusData.data.pendingRequest !== null) {
      throw new Error('Expected pendingRequest = null (no extra visit request required)');
    }
    console.log('   ✓ Customer immediately sees 4/4 stamps and UNLOCKED reward with valid redemption token.');

    // 7. Verify Wrong-Branch Staff attempts validation & redemption (Branch isolation)
    console.log('6. Verifying wrong-branch staff authorization rejection (validate + redeem)...');
    const wrongBranchRes = await fetch(`${baseUrl}/staff/rewards/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff2Token}`, // staff at Branch 2
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    if (wrongBranchRes.status !== 403) {
      throw new Error(`Expected 403 for staff from different branch on validate, got ${wrongBranchRes.status}`);
    }

    const wrongBranchRedeemRes = await fetch(`${baseUrl}/staff/rewards/redeem-by-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff2Token}`, // staff at Branch 2
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    if (wrongBranchRedeemRes.status !== 403) {
      throw new Error(`Expected 403 for staff from different branch on redeem, got ${wrongBranchRedeemRes.status}`);
    }
    console.log('   ✓ Wrong-branch staff rejected with 403 Forbidden for both validate and redeem.');

    // Verify 4 visits exist before redemption, all QUALIFYING
    const visitsBeforeRedemption = await prisma.visit.findMany({
      where: { loyaltyCycle: { customerProfile: { customerId: customer.id } } },
      orderBy: { createdAt: 'asc' },
    });
    if (visitsBeforeRedemption.length !== 4) {
      throw new Error(`Expected 4 visits before redemption, got ${visitsBeforeRedemption.length}`);
    }
    for (let i = 0; i < visitsBeforeRedemption.length; i++) {
      const v = visitsBeforeRedemption[i];
      if (v.visitType !== 'QUALIFYING') {
        throw new Error(`Expected visitType = QUALIFYING, got ${v.visitType}`);
      }
      if (!v.visitRequestId) {
        throw new Error(`Expected visitRequestId to be non-null for qualifying visit`);
      }
      if (v.visitNumberInCycle !== i + 1) {
        throw new Error(`Expected visitNumberInCycle = ${i + 1}, got ${v.visitNumberInCycle}`);
      }
    }
    console.log('   ✓ Pre-redemption visits verified: 4 visits, all QUALIFYING with visitNumberInCycle 1..4.');

    // 8. Staff 1 validates token
    console.log('7. Validating reward token with correct branch staff...');
    const validateRes = await fetch(`${baseUrl}/staff/rewards/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    const validateData: any = await validateRes.json();
    if (!validateRes.ok) throw new Error(`Token validation failed: ${JSON.stringify(validateData)}`);
    if (validateData.data.rewardName !== 'Free Coffee') {
      throw new Error(`Expected rewardName = 'Free Coffee', got ${validateData.data.rewardName}`);
    }
    if (validateData.data.status !== 'UNLOCKED') {
      throw new Error(`Expected status = 'UNLOCKED', got ${validateData.data.status}`);
    }
    console.log('   ✓ Token validated successfully. Status is UNLOCKED.');

    // 9. Staff 1 redeems token
    console.log('8. Staff confirming redemption via redeem-by-token...');
    const redeemRes = await fetch(`${baseUrl}/staff/rewards/redeem-by-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    const redeemData: any = await redeemRes.json();
    if (!redeemRes.ok) throw new Error(`Redemption failed: ${JSON.stringify(redeemData)}`);
    if (redeemData.data.status !== 'REDEEMED') {
      throw new Error(`Expected status = 'REDEEMED', got ${redeemData.data.status}`);
    }
    if (!redeemData.data.visitId) {
      throw new Error(`Expected redemption response to include visitId`);
    }
    console.log('   ✓ Reward successfully redeemed. Visit ID:', redeemData.data.visitId);

    // 10. Verify exactly ONE REWARD_REDEMPTION visit was created atomically
    const visitsAfterRedemption = await prisma.visit.findMany({
      where: { loyaltyCycle: { customerProfile: { customerId: customer.id } } },
      orderBy: { createdAt: 'asc' },
    });
    if (visitsAfterRedemption.length !== 5) {
      throw new Error(`Expected exactly 5 visits after redemption, got ${visitsAfterRedemption.length}`);
    }

    const qualifyingVisits = visitsAfterRedemption.filter((v) => v.visitType === 'QUALIFYING');
    const redemptionVisits = visitsAfterRedemption.filter((v) => v.visitType === 'REWARD_REDEMPTION');

    if (qualifyingVisits.length !== 4) {
      throw new Error(`Expected 4 QUALIFYING visits, got ${qualifyingVisits.length}`);
    }
    if (redemptionVisits.length !== 1) {
      throw new Error(`Expected 1 REWARD_REDEMPTION visit, got ${redemptionVisits.length}`);
    }

    const redVisit = redemptionVisits[0];
    if (redVisit.id !== redeemData.data.visitId) {
      throw new Error(`Expected redemption visit ID ${redeemData.data.visitId}, got ${redVisit.id}`);
    }
    if (redVisit.visitRequestId !== null) {
      throw new Error(`Expected visitRequestId = null for REWARD_REDEMPTION, got ${redVisit.visitRequestId}`);
    }
    if (redVisit.visitNumberInCycle !== null) {
      throw new Error(`Expected visitNumberInCycle = null for REWARD_REDEMPTION, got ${redVisit.visitNumberInCycle}`);
    }
    if (redVisit.branchId !== branch1.id) {
      throw new Error(`Expected branchId = ${branch1.id}, got ${redVisit.branchId}`);
    }

    // Verify LoyaltyCycle.visitCount remains 4!
    const cycleAfterRedeem = await prisma.loyaltyCycle.findUnique({
      where: { id: loyaltyCycle.id },
    });
    if (cycleAfterRedeem?.visitCount !== 4) {
      throw new Error(`LoyaltyCycle.visitCount must NOT increment on reward redemption! Got ${cycleAfterRedeem?.visitCount}`);
    }
    if (cycleAfterRedeem?.status !== 'COMPLETED') {
      throw new Error(`LoyaltyCycle.status must remain COMPLETED! Got ${cycleAfterRedeem?.status}`);
    }
    console.log('   ✓ Invariant confirmed: Exactly 1 REWARD_REDEMPTION Visit created (visitRequestId=null, visitNumberInCycle=null), and LoyaltyCycle.visitCount remained 4.');

    // 11. Test duplicate redemption rejection (409 Conflict) and NO second visit created
    console.log('9. Testing duplicate redemption rejection (409 Conflict)...');
    const dupRedeemRes = await fetch(`${baseUrl}/staff/rewards/redeem-by-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    if (dupRedeemRes.status !== 409) {
      throw new Error(`Expected 409 for duplicate redemption, got ${dupRedeemRes.status}`);
    }

    const visitsAfterDup = await prisma.visit.count({
      where: { loyaltyCycle: { customerProfile: { customerId: customer.id } } },
    });
    if (visitsAfterDup !== 5) {
      throw new Error(`Duplicate redemption must NOT create another visit! Expected 5, got ${visitsAfterDup}`);
    }
    console.log('   ✓ Duplicate redemption rejected with 409 Conflict and no extra visit created.');

    // 12. Check customer status after redemption
    console.log('10. Checking customer loyalty status after redemption...');
    const statusPostRes = await fetch(`${baseUrl}/customer/loyalty/${branch1.qrToken}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusPostData: any = await statusPostRes.json();
    if (statusPostData.data.unlockedRewards.length !== 0) {
      throw new Error(`Expected 0 unlocked rewards after redemption, got ${statusPostData.data.unlockedRewards.length}`);
    }
    if (statusPostData.data.redeemedRewards.length !== 1) {
      throw new Error(`Expected 1 redeemed reward, got ${statusPostData.data.redeemedRewards.length}`);
    }
    const redeemedReward = statusPostData.data.redeemedRewards[0];
    if (redeemedReward.redemptionToken) {
      throw new Error('Raw redemption token must NOT be returned for REDEEMED rewards');
    }
    console.log('   ✓ Customer status reflects REDEEMED reward and hides raw token.');

    // 13. Customer makes another visit (Visit 5 overall physical visit, Visit 1 of Cycle 2)
    console.log('11. Customer makes next qualifying visit to start Cycle 2...');
    const req5Res = await fetch(`${baseUrl}/customer/visit-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ qrToken: branch1.qrToken }),
    });
    const req5Data: any = await req5Res.json();
    const app5Res = await fetch(`${baseUrl}/staff/visit-requests/${req5Data.data.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const app5Data: any = await app5Res.json();
    if (!app5Res.ok) throw new Error(`Visit 5 approval failed: ${JSON.stringify(app5Data)}`);

    if (app5Data.data.cycleNumber !== 2) {
      throw new Error(`Expected cycleNumber = 2, got ${app5Data.data.cycleNumber}`);
    }
    if (app5Data.data.visitNumberInCycle !== 1) {
      throw new Error(`Expected visitNumberInCycle = 1, got ${app5Data.data.visitNumberInCycle}`);
    }

    // 14. Verify final analytics distribution across cycles
    const allCustomerVisits = await prisma.visit.findMany({
      where: {
        loyaltyCycle: {
          customerProfile: { customerId: customer.id },
        },
      },
    });
    const totalAllVisits = allCustomerVisits.length;
    const totalQualifying = allCustomerVisits.filter((v) => v.visitType === 'QUALIFYING').length;
    const totalRewardRedemption = allCustomerVisits.filter((v) => v.visitType === 'REWARD_REDEMPTION').length;

    console.log('\n12. Verifying Analytics Foundation:');
    console.log(`    Total store visits: ${totalAllVisits} (Expected: 6)`);
    console.log(`    Qualifying visits: ${totalQualifying} (Expected: 5)`);
    console.log(`    Reward redemption visits: ${totalRewardRedemption} (Expected: 1)`);

    if (totalAllVisits !== 6) {
      throw new Error(`Expected total store visits = 6, got ${totalAllVisits}`);
    }
    if (totalQualifying !== 5) {
      throw new Error(`Expected qualifying visits = 5, got ${totalQualifying}`);
    }
    if (totalRewardRedemption !== 1) {
      throw new Error(`Expected reward redemption visits = 1, got ${totalRewardRedemption}`);
    }
    console.log('   ✓ Analytics counts perfectly distinguish total physical store visits from qualifying stamp visits.');

    // Clean up
    console.log('\nCleaning up test records...');
    await prisma.milestoneReward.deleteMany({ where: { milestone: { programId: program.id } } });
    await prisma.visit.deleteMany({ where: { branchId: branch1.id } });
    await prisma.visitRequest.deleteMany({ where: { branchId: branch1.id } });
    await prisma.loyaltyCycle.deleteMany({ where: { programId: program.id } });
    await prisma.milestone.deleteMany({ where: { programId: program.id } });
    await prisma.loyaltyProgram.deleteMany({ where: { id: program.id } });
    await prisma.customerProfile.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.deleteMany({ where: { id: customer.id } });
    await prisma.staff.deleteMany({ where: { businessId: business.id } });
    await prisma.branch.deleteMany({ where: { businessId: business.id } });
    await prisma.business.deleteMany({ where: { id: business.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, staff1User.id, staff2User.id] } } });

    console.log('\n🎉 ALL DECOUPLED REWARD FLOW TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runDecoupledRewardFlowVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err);
  process.exit(1);
});
