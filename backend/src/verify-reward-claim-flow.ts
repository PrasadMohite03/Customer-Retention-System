import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import bcrypt from 'bcrypt';
import { UserRole, RewardType, VisitType } from '@prisma/client';
import { generateAccessToken, generateCustomerAccessToken } from './utils/auth.utils';

async function runVerification() {
  console.log('=== STARTING AAO CLAIM REWARD VISIT FLOW VERIFICATION ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const BASE_URL = `http://127.0.0.1:${port}/api`;
  console.log(`Test server running on ${BASE_URL}\n`);

  try {
    const timestamp = Date.now();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Setup Business A, Branch 1, Branch 2 (Other Branch), Staff 1, Staff 2
    console.log('[Setup] Creating Business, 2 Branches, Staff, and 4-visit Program...');
    const owner = await prisma.user.create({
      data: {
        email: `claim_owner_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const business = await prisma.business.create({
      data: {
        name: `Apex Salon ${timestamp}`,
        ownerId: owner.id,
      },
    });

    const ownerToken = generateAccessToken({
      userId: owner.id,
      role: UserRole.OWNER,
      businessId: business.id,
    });

    const branch1 = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: 'Downtown Apex',
        address: '101 Main St',
        qrToken: `apex_b1_${timestamp}`,
        isActive: true,
      },
    });

    const branch2 = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: 'Uptown Apex',
        address: '202 High St',
        qrToken: `apex_b2_${timestamp}`,
        isActive: true,
      },
    });

    const staffUser1 = await prisma.user.create({
      data: {
        email: `staff1_${timestamp}@test.com`,
        passwordHash,
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

    const staffUser2 = await prisma.user.create({
      data: {
        email: `staff2_${timestamp}@test.com`,
        passwordHash,
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

    // 4-visit program with:
    // Visit 1: NONE
    // Visit 2: 20% Off Pastry (intermediate reward)
    // Visit 3: NONE
    // Visit 4: Head Massage (final reward)
    const program = await prisma.loyaltyProgram.create({
      data: {
        businessId: business.id,
        branchId: branch1.id,
        name: 'Apex Salon Rewards',
        cycleLength: 4,
        isActive: true,
        milestones: {
          create: [
            {
              visitNumber: 1,
              rewardType: RewardType.NONE,
            },
            {
              visitNumber: 2,
              rewardType: RewardType.PERCENT_DISCOUNT,
              rewardName: '20% Off Pastry',
              rewardValue: 20,
            },
            {
              visitNumber: 3,
              rewardType: RewardType.NONE,
            },
            {
              visitNumber: 4,
              rewardType: RewardType.FREE_ITEM,
              rewardName: 'Head Massage',
              rewardDescription: 'Free soothing 15-min head massage',
            },
          ],
        },
      },
      include: {
        milestones: true,
      },
    });

    // Customer
    const customer = await prisma.customer.create({
      data: {
        phone: `+9198765${String(timestamp).slice(-5)}`,
        name: 'Jane Doe',
      },
    });

    const customerToken = generateCustomerAccessToken({
      customerId: customer.id,
      role: 'CUSTOMER',
    });

    const customerProfile = await prisma.customerProfile.create({
      data: {
        customerId: customer.id,
        businessId: business.id,
      },
    });

    console.log('✓ Setup complete.\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Normal visit #1 uses: Request Stamp -> VisitRequest -> Staff Approval
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 9: Normal Visit #1 (Request Stamp -> VisitRequest -> Approval) ---');
    const req1Res = await fetch(`${BASE_URL}/customer/visit-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ qrToken: branch1.qrToken }),
    });
    const req1Data = await req1Res.json();
    if (req1Res.status !== 201) throw new Error(`Visit 1 request failed: ${JSON.stringify(req1Data)}`);
    console.log('✓ VisitRequest #1 created');

    const approve1Res = await fetch(`${BASE_URL}/staff/visit-requests/${req1Data.data.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staff1Token}`,
      },
    });
    const approve1Data = await approve1Res.json();
    if (approve1Res.status !== 200) throw new Error(`Approve 1 failed: ${JSON.stringify(approve1Data)}`);
    if (approve1Data.data.visitNumberInCycle !== 1) throw new Error('Expected visitNumberInCycle = 1');
    console.log('✓ Staff approved Visit 1. Customer is now 1 of 4 visits.\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Intermediate reward milestone at Visit 2 (20% Off Pastry)
    // Customer at 1/4 -> Next visit #2 is reward milestone -> Claim Reward Visit
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 8: Intermediate Reward Milestone (Visit 2: 20% Off Pastry) ---');
    const claimRes1 = await fetch(`${BASE_URL}/customer/reward-claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ qrToken: branch1.qrToken }),
    });
    const claimData1 = await claimRes1.json();
    if (claimRes1.status !== 201) throw new Error(`Claim creation failed: ${JSON.stringify(claimData1)}`);
    if (claimData1.data.expectedVisitNumber !== 2) throw new Error(`Expected expectedVisitNumber = 2, got ${claimData1.data.expectedVisitNumber}`);
    if (claimData1.data.reward.name !== '20% Off Pastry') throw new Error(`Expected '20% Off Pastry', got ${claimData1.data.reward.name}`);
    console.log(`✓ Customer created RewardClaim for Visit 2 (token: ${claimData1.data.claimToken})`);

    // Staff validates claim token
    const validateRes1 = await fetch(`${BASE_URL}/staff/reward-claims/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ claimToken: claimData1.data.claimToken }),
    });
    const validateData1 = await validateRes1.json();
    if (validateRes1.status !== 200) throw new Error(`Validation failed: ${JSON.stringify(validateData1)}`);
    if (validateData1.data.expectedVisitNumber !== 2) throw new Error('Validation mismatch on visit');
    console.log('✓ Staff validated Claim token for Visit 2');

    // Staff confirms claim
    const confirmRes1 = await fetch(`${BASE_URL}/staff/reward-claims/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ claimToken: claimData1.data.claimToken }),
    });
    const confirmData1 = await confirmRes1.json();
    if (confirmRes1.status !== 200) throw new Error(`Confirm failed: ${JSON.stringify(confirmData1)}`);
    if (confirmData1.data.visitNumberInCycle !== 2) throw new Error('Expected visitNumberInCycle = 2');
    if (confirmData1.data.reward.status !== 'REDEEMED') throw new Error('Expected reward status = REDEEMED');
    console.log('✓ Intermediate reward visit confirmed and immediately REDEEMED!');

    // Verify DB state for Visit 2
    const cycleAfter2 = await prisma.loyaltyCycle.findFirst({
      where: { customerProfileId: customerProfile.id, status: 'ACTIVE' },
    });
    if (cycleAfter2?.visitCount !== 2) throw new Error(`Expected cycle visitCount = 2, got ${cycleAfter2?.visitCount}`);
    console.log('✓ Customer is now exactly 2 of 4 visits.\n');

    // ─────────────────────────────────────────────────────────────
    // Normal Visit #3: Request a Stamp
    // ─────────────────────────────────────────────────────────────
    console.log('--- Normal Visit #3 (NONE milestone) ---');
    const req3Res = await fetch(`${BASE_URL}/customer/visit-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ qrToken: branch1.qrToken }),
    });
    const req3Data = await req3Res.json();
    if (req3Res.status !== 201) throw new Error(`Visit 3 request failed: ${JSON.stringify(req3Data)}`);

    const approve3Res = await fetch(`${BASE_URL}/staff/visit-requests/${req3Data.data.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staff1Token}`,
      },
    });
    const approve3Data = await approve3Res.json();
    if (approve3Res.status !== 200) throw new Error(`Approve 3 failed: ${JSON.stringify(approve3Data)}`);
    if (approve3Data.data.visitNumberInCycle !== 3) throw new Error('Expected visitNumberInCycle = 3');
    console.log('✓ Visit 3 approved. Customer is now 3 of 4 visits.\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 1, 2, 3, 4, 5, 11: Final Visit #4 Reward Claim Flow
    // 3/4 -> Next visit #4 has reward (Head Massage)
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 1 to 5 & 11: Final Visit #4 Reward Claim Flow ---');
    const visitRequestsBefore = await prisma.visitRequest.count();

    const claimRes4 = await fetch(`${BASE_URL}/customer/reward-claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ qrToken: branch1.qrToken }),
    });
    const claimData4 = await claimRes4.json();
    if (claimRes4.status !== 201) throw new Error(`Claim 4 creation failed: ${JSON.stringify(claimData4)}`);
    const claimToken4 = claimData4.data.claimToken;
    console.log(`✓ Customer generated Claim QR for Visit 4 (token: ${claimToken4})`);

    // TEST 2: Verify NO VisitRequest was created
    const visitRequestsAfterClaim = await prisma.visitRequest.count();
    if (visitRequestsAfterClaim !== visitRequestsBefore) {
      throw new Error(`TEST 2 FAILED: VisitRequest was created during Claim Reward Visit flow!`);
    }
    console.log('✓ TEST 2 PASSED: Verified NO VisitRequest was created for reward visit.');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Verify wrong branch staff is rejected
    // Staff 2 is at Branch 2; Claim was made for Branch 1
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 7: Wrong branch rejection ---');
    const wrongBranchValidateRes = await fetch(`${BASE_URL}/staff/reward-claims/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff2Token}`,
      },
      body: JSON.stringify({ claimToken: claimToken4 }),
    });
    if (wrongBranchValidateRes.status !== 403) {
      throw new Error(`TEST 7 FAILED: Expected 403 Forbidden for wrong branch, got ${wrongBranchValidateRes.status}`);
    }

    const wrongBranchConfirmRes = await fetch(`${BASE_URL}/staff/reward-claims/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff2Token}`,
      },
      body: JSON.stringify({ claimToken: claimToken4 }),
    });
    if (wrongBranchConfirmRes.status !== 403) {
      throw new Error(`TEST 7 FAILED: Expected 403 Forbidden on confirm for wrong branch, got ${wrongBranchConfirmRes.status}`);
    }
    console.log('✓ TEST 7 PASSED: Wrong branch staff correctly rejected with 403.\n');

    // ─────────────────────────────────────────────────────────────
    // Staff 1 validates and confirms Visit 4 Claim
    // ─────────────────────────────────────────────────────────────
    const validateRes4 = await fetch(`${BASE_URL}/staff/reward-claims/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ claimToken: claimToken4 }),
    });
    const validateData4 = await validateRes4.json();
    if (validateRes4.status !== 200) throw new Error(`Validation 4 failed: ${JSON.stringify(validateData4)}`);
    if (validateData4.data.customerName !== 'Jane Doe') throw new Error('Customer name mismatch');
    if (validateData4.data.expectedVisitNumber !== 4) throw new Error('Expected visit number mismatch');
    if (validateData4.data.rewardName !== 'Head Massage') throw new Error('Reward name mismatch');
    console.log('✓ Staff validated Claim: "Complete Reward Visit? Customer: Jane Doe, Visit: 4 of 4, Reward: Head Massage"');

    const visitsBeforeConfirm = await prisma.visit.findMany({
      where: { loyaltyCycleId: cycleAfter2!.id },
    });

    const confirmRes4 = await fetch(`${BASE_URL}/staff/reward-claims/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ claimToken: claimToken4 }),
    });
    const confirmData4 = await confirmRes4.json();
    if (confirmRes4.status !== 200) throw new Error(`Confirm 4 failed: ${JSON.stringify(confirmData4)}`);
    console.log('✓ Staff confirmed Claim #4!');

    // TEST 1 & 11: Verify cycle state in DB: 4 of 4, status COMPLETED, NEVER 5/5
    const cycleFinal = await prisma.loyaltyCycle.findUnique({
      where: { id: cycleAfter2!.id },
      include: {
        milestoneRewards: true,
        visits: true,
      },
    });

    if (cycleFinal?.visitCount !== 4) {
      throw new Error(`TEST 1/5/11 FAILED: Expected visitCount = 4, got ${cycleFinal?.visitCount}`);
    }
    if (cycleFinal?.status !== 'COMPLETED') {
      throw new Error(`TEST 1 FAILED: Expected cycle status = COMPLETED, got ${cycleFinal?.status}`);
    }
    console.log('✓ TEST 1 & 11 PASSED: Cycle is exactly 4 of 4 visits, COMPLETED, never 5/4 or 5/5.');

    // TEST 3: Verify exactly ONE QUALIFYING visit was created by this claim
    const newQualifyingVisits = cycleFinal.visits.filter(
      (v) => v.visitType === VisitType.QUALIFYING && !visitsBeforeConfirm.some((oldV) => oldV.id === v.id)
    );
    if (newQualifyingVisits.length !== 1) {
      throw new Error(`TEST 3 FAILED: Expected exactly 1 new QUALIFYING visit, got ${newQualifyingVisits.length}`);
    }
    if (newQualifyingVisits[0].visitNumberInCycle !== 4) {
      throw new Error(`TEST 3 FAILED: Expected visitNumberInCycle = 4, got ${newQualifyingVisits[0].visitNumberInCycle}`);
    }
    console.log('✓ TEST 3 PASSED: Exactly one QUALIFYING Visit created with visitNumberInCycle = 4.');

    // TEST 4: Verify exactly ONE REWARD_REDEMPTION visit was created by this claim
    const newRedemptionVisits = cycleFinal.visits.filter(
      (v) => v.visitType === VisitType.REWARD_REDEMPTION && !visitsBeforeConfirm.some((oldV) => oldV.id === v.id)
    );
    if (newRedemptionVisits.length !== 1) {
      throw new Error(`TEST 4 FAILED: Expected exactly 1 new REWARD_REDEMPTION visit, got ${newRedemptionVisits.length}`);
    }
    if (newRedemptionVisits[0].visitNumberInCycle !== null) {
      throw new Error(`TEST 4 FAILED: Expected REWARD_REDEMPTION visitNumberInCycle = null, got ${newRedemptionVisits[0].visitNumberInCycle}`);
    }
    console.log('✓ TEST 4 PASSED: Exactly one REWARD_REDEMPTION Visit created for analytics.');

    // TEST 5: Verify visitCount incremented only once (from 3 to 4)
    console.log('✓ TEST 5 PASSED: visitCount incremented exactly once (from 3 to 4).');

    // Verify MilestoneReward was created and marked REDEEMED
    const headMassageReward = cycleFinal.milestoneRewards.find(
      (r) => r.snapshotRewardName === 'Head Massage'
    );
    if (!headMassageReward || headMassageReward.status !== 'REDEEMED') {
      throw new Error('Expected Head Massage milestone reward to exist with status REDEEMED');
    }
    if (!headMassageReward.redeemedAt || !headMassageReward.redeemedByStaffId) {
      throw new Error('Expected redeemedAt and redeemedByStaffId to be set');
    }
    console.log('✓ MilestoneReward created and immediately marked REDEEMED.');

    // Verify RewardClaim status is CONSUMED
    const claimRecord = await prisma.rewardClaim.findFirst({
      where: { id: claimData4.data.claimId },
    });
    if (claimRecord?.status !== 'CONSUMED' || !claimRecord.consumedAt || !claimRecord.consumedByStaffId) {
      throw new Error('Expected RewardClaim to be marked CONSUMED with consumedAt & consumedByStaffId');
    }
    console.log('✓ RewardClaim marked CONSUMED.\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Second use of Claim QR returns 409
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 6: Reusing consumed Claim QR returns 409 ---');
    const reuseValidateRes = await fetch(`${BASE_URL}/staff/reward-claims/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ claimToken: claimToken4 }),
    });
    if (reuseValidateRes.status !== 409) {
      throw new Error(`TEST 6 FAILED: Expected 409 on validate reuse, got ${reuseValidateRes.status}`);
    }

    const reuseConfirmRes = await fetch(`${BASE_URL}/staff/reward-claims/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ claimToken: claimToken4 }),
    });
    if (reuseConfirmRes.status !== 409) {
      throw new Error(`TEST 6 FAILED: Expected 409 on confirm reuse, got ${reuseConfirmRes.status}`);
    }
    console.log('✓ TEST 6 PASSED: Reusing consumed Claim QR returns 409 Conflict.\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: Existing UNLOCKED reward QR redemption still works
    // Verify standard unlocked reward QR redemption (RP- token)
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 10: Existing UNLOCKED reward QR redemption works ---');
    const customer2 = await prisma.customer.create({
      data: {
        phone: `+9198764${String(timestamp).slice(-5)}`,
        name: 'John Doe',
      },
    });

    const profile2 = await prisma.customerProfile.create({
      data: {
        customerId: customer2.id,
        businessId: business.id,
      },
    });

    const cycle2 = await prisma.loyaltyCycle.create({
      data: {
        customerProfileId: profile2.id,
        programId: program.id,
        cycleNumber: 1,
        visitCount: 2,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // Create an unlocked reward with standard RP- token hash
    const rewardId = `test_rwd_${timestamp}`;
    const rawRwdToken = `RP-${String(timestamp).slice(-8)}-A1B2C3D4-E5F6A7B8`;
    const rwdTokenHash = require('crypto').createHash('sha256').update(rawRwdToken).digest('hex');

    const unlockedReward = await prisma.milestoneReward.create({
      data: {
        id: rewardId,
        loyaltyCycleId: cycle2.id,
        milestoneId: program.milestones[1].id,
        snapshotRewardType: RewardType.PERCENT_DISCOUNT,
        snapshotRewardName: '20% Off Pastry',
        status: 'UNLOCKED',
        unlockedAt: new Date(),
        redemptionTokenHash: rwdTokenHash,
      },
    });

    // Staff validates UNLOCKED reward token (existing endpoint)
    const validateRewardRes = await fetch(`${BASE_URL}/staff/rewards/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ rewardToken: rawRwdToken }),
    });
    const validateRewardData = await validateRewardRes.json();
    if (validateRewardRes.status !== 200) {
      throw new Error(`TEST 10 FAILED: validateReward failed: ${JSON.stringify(validateRewardData)}`);
    }

    // Staff redeems UNLOCKED reward token (existing endpoint)
    const redeemRewardRes = await fetch(`${BASE_URL}/staff/rewards/redeem-by-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ rewardToken: rawRwdToken }),
    });
    const redeemRewardData = await redeemRewardRes.json();
    if (redeemRewardRes.status !== 200) {
      throw new Error(`TEST 10 FAILED: redeem-by-token failed: ${JSON.stringify(redeemRewardData)}`);
    }

    const checkReward = await prisma.milestoneReward.findUnique({ where: { id: rewardId } });
    if (checkReward?.status !== 'REDEEMED') throw new Error('Expected status = REDEEMED');
    console.log('✓ TEST 10 PASSED: Existing UNLOCKED reward redemption flow remains 100% operational.\n');

    console.log('========================================================');
    console.log('🎉 ALL 11 BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================');
  } finally {
    server.close();
  }
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  });
