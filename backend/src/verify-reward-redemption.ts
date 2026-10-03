import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, UserRole, RewardType } from '@prisma/client';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import app from './app';
import { generateCustomerAccessToken } from './utils/auth.utils';
import { hashRedemptionToken } from './utils/redemptionToken';
import { backfillRedemptionTokens } from './scripts/backfillRedemptionTokens';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function generateUserToken(payload: { userId: string; role: UserRole; businessId: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runRewardVerification() {
  console.log('=== STARTING REWARD QR/CODE REDEMPTION E2E VERIFICATION ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const timestamp = Date.now();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. SETUP: Business A, Branches, Staff, and Loyalty Program
    // ──────────────────────────────────────────────────────────────────────────
    console.log('1. Setting up Business A (Owner, 2 Branches, 1 Staff)...');
    const ownerUserA = await prisma.user.create({
      data: {
        email: `owner_reward_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const businessA = await prisma.business.create({
      data: {
        name: `Reward Cafe ${timestamp}`,
        type: 'CAFE',
        ownerId: ownerUserA.id,
      },
    });

    const branchA1 = await prisma.branch.create({
      data: {
        businessId: businessA.id,
        name: `Branch Downtown ${timestamp}`,
        address: '100 Main St',
        qrToken: `qr_reward_a1_${timestamp}`,
      },
    });

    const branchA2 = await prisma.branch.create({
      data: {
        businessId: businessA.id,
        name: `Branch Uptown ${timestamp}`,
        address: '200 High St',
        qrToken: `qr_reward_a2_${timestamp}`,
      },
    });

    const staffUser1 = await prisma.user.create({
      data: {
        email: `staff1_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    const staffRecord1 = await prisma.staff.create({
      data: {
        userId: staffUser1.id,
        businessId: businessA.id,
        branchId: branchA1.id,
        isActive: true,
      },
    });

    // Staff on Branch 2 (to test branch isolation)
    const staffUser2 = await prisma.user.create({
      data: {
        email: `staff2_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    await prisma.staff.create({
      data: {
        userId: staffUser2.id,
        businessId: businessA.id,
        branchId: branchA2.id,
        isActive: true,
      },
    });

    // Business B (for cross-tenant test)
    const ownerUserB = await prisma.user.create({
      data: {
        email: `owner_b_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const businessB = await prisma.business.create({
      data: {
        name: `Competitor Cafe ${timestamp}`,
        type: 'CAFE',
        ownerId: ownerUserB.id,
      },
    });

    const ownerTokenA = generateUserToken({
      userId: ownerUserA.id,
      role: UserRole.OWNER,
      businessId: businessA.id,
    });

    const staffToken1 = generateUserToken({
      userId: staffUser1.id,
      role: UserRole.STAFF,
      businessId: businessA.id,
    });

    const staffToken2 = generateUserToken({
      userId: staffUser2.id,
      role: UserRole.STAFF,
      businessId: businessA.id,
    });

    const ownerTokenB = generateUserToken({
      userId: ownerUserB.id,
      role: UserRole.OWNER,
      businessId: businessB.id,
    });

    // Create Loyalty Program on Branch 1 (2 visits cycle, milestone at visit 2)
    const programA = await prisma.loyaltyProgram.create({
      data: {
        businessId: businessA.id,
        branchId: branchA1.id,
        name: 'VIP Coffee Club',
        cycleLength: 2,
        isActive: true,
        milestones: {
          create: [
            {
              visitNumber: 2,
              rewardType: RewardType.PERCENT_DISCOUNT,
              rewardValue: 20.0,
              rewardName: '20% Off Bill',
              rewardDescription: 'Enjoy 20% off your entire meal',
            },
          ],
        },
      },
      include: { milestones: true },
    });

    // Setup Customer
    const customer = await prisma.customer.create({
      data: {
        phone: `+1999${String(timestamp).slice(-7)}`,
        name: 'Alice Wonderland',
      },
    });

    const customerToken = generateCustomerAccessToken({
      customerId: customer.id,
      role: 'CUSTOMER',
    });

    console.log('✓ Business, branches, staff, program, and customer created.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // 2. VISIT FLOW: Complete 2 visits to unlock MilestoneReward atomically
    // ──────────────────────────────────────────────────────────────────────────
    console.log('2. Customer requests and staff approves visits 1 and 2...');
    // Visit 1
    const reqRes1 = await fetch(`${baseUrl}/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: branchA1.qrToken }),
    });
    if (!reqRes1.ok) throw new Error(`Visit request 1 failed: ${reqRes1.status}`);
    const reqData1 = await reqRes1.json();
    const req1Id = reqData1.data.id;

    const approve1Res = await fetch(`${baseUrl}/staff/visit-requests/${req1Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (!approve1Res.ok) throw new Error(`Visit 1 approval failed: ${approve1Res.status}`);

    // Visit 2 (Unlocks MilestoneReward)
    const reqRes2 = await fetch(`${baseUrl}/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: branchA1.qrToken }),
    });
    if (!reqRes2.ok) throw new Error(`Visit request 2 failed: ${reqRes2.status}`);
    const reqData2 = await reqRes2.json();
    const req2Id = reqData2.data.id;

    const approve2Res = await fetch(`${baseUrl}/staff/visit-requests/${req2Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (!approve2Res.ok) throw new Error(`Visit 2 approval failed: ${approve2Res.status}`);
    const approve2Data = await approve2Res.json();
    console.log('✓ Visit 2 approved. Reward unlocked:', approve2Data.data.newRewardUnlocked?.rewardName);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. DATABASE VERIFICATION: Verify token hash is stored, raw token is NOT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n3. Verifying database persistence security...');
    const rewardInDb = await prisma.milestoneReward.findFirst({
      where: {
        loyaltyCycle: {
          customerProfile: { customerId: customer.id },
          programId: programA.id,
        },
      },
    });

    if (!rewardInDb) throw new Error('Reward not found in DB!');
    if (!rewardInDb.redemptionTokenHash) {
      throw new Error('FAIL: redemptionTokenHash is NULL in DB!');
    }
    if (!rewardInDb.redemptionTokenCreatedAt) {
      throw new Error('FAIL: redemptionTokenCreatedAt is NULL in DB!');
    }

    // Verify raw token is NOT in DB (schema has only hash)
    const dbFields = Object.keys(rewardInDb);
    if (dbFields.includes('redemptionToken')) {
      throw new Error('FAIL: Raw redemptionToken field found in DB schema!');
    }
    console.log('✓ Raw token is NEVER stored in database.');
    console.log(`✓ Only SHA-256 hash is persisted: ${rewardInDb.redemptionTokenHash}`);
    console.log(`✓ Token created at: ${rewardInDb.redemptionTokenCreatedAt.toISOString()}`);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. CUSTOMER LOYALTY API: Returns raw token ONLY for UNLOCKED rewards
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n4. Verifying Customer Loyalty API response...');
    const custLoyaltyRes = await fetch(`${baseUrl}/customer/loyalty/${branchA1.qrToken}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (!custLoyaltyRes.ok) throw new Error(`Customer loyalty GET failed: ${custLoyaltyRes.status}`);
    const custLoyaltyData = await custLoyaltyRes.json();

    const unlockedReward = custLoyaltyData.data.unlockedRewards.find((r: any) => r.id === rewardInDb.id);
    if (!unlockedReward) throw new Error('Reward not in unlockedRewards list!');

    if (!unlockedReward.redemptionToken) {
      throw new Error('FAIL: Raw redemptionToken missing from customer response!');
    }
    if (unlockedReward.redemptionTokenHash) {
      throw new Error('FAIL: redemptionTokenHash leaked in customer API response!');
    }
    if (unlockedReward.branchId || unlockedReward.businessId) {
      throw new Error('FAIL: Sensitive IDs leaked in customer reward payload!');
    }

    const rawToken = unlockedReward.redemptionToken;
    console.log(`✓ Customer received raw redemption token: ${rawToken}`);
    if (!rawToken.startsWith('RP-')) {
      throw new Error(`FAIL: Raw token does not start with RP-: ${rawToken}`);
    }

    // Verify hash of raw token matches DB hash
    const computedHash = hashRedemptionToken(rawToken);
    if (computedHash !== rewardInDb.redemptionTokenHash) {
      throw new Error(`FAIL: Hash mismatch! Computed: ${computedHash}, DB: ${rewardInDb.redemptionTokenHash}`);
    }
    console.log('✓ Hash of customer token perfectly matches DB redemptionTokenHash.');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. VALIDATION API: POST /api/staff/rewards/validate
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n5. Verifying POST /api/staff/rewards/validate...');

    // 5.1 Invalid token format / not found
    const invalidValRes = await fetch(`${baseUrl}/staff/rewards/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardToken: 'RP-00000000-00000000-00000000' }),
    });
    if (invalidValRes.status !== 404) {
      throw new Error(`Expected 404 for non-existent token, got ${invalidValRes.status}`);
    }
    console.log('✓ Non-existent token correctly returns 404 Not Found.');

    // 5.2 Cross-Tenant Validation Block
    const crossTenantValRes = await fetch(`${baseUrl}/staff/rewards/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerTokenB}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    if (crossTenantValRes.status !== 403) {
      throw new Error(`Expected 403 for cross-tenant validation, got ${crossTenantValRes.status}`);
    }
    console.log('✓ Cross-tenant validation blocked with 403 Forbidden.');

    // 5.3 Staff Wrong Branch Validation Block
    const wrongBranchValRes = await fetch(`${baseUrl}/staff/rewards/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken2}`, // Assigned to Branch 2
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    if (wrongBranchValRes.status !== 403) {
      throw new Error(`Expected 403 for wrong staff branch validation, got ${wrongBranchValRes.status}`);
    }
    console.log('✓ Staff from another branch blocked with 403 Forbidden.');

    // 5.4 Successful Validation (Staff 1 on Branch 1)
    const validValRes = await fetch(`${baseUrl}/staff/rewards/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    if (!validValRes.ok) throw new Error(`Validation failed: ${validValRes.status}`);
    const validValData = await validValRes.json();
    console.log('✓ Staff validation succeeded:');
    console.log(`  Customer: ${validValData.data.customerName}, Phone: ${validValData.data.customerPhone}`);
    console.log(`  Reward: ${validValData.data.rewardName}, Value: ${validValData.data.rewardValue}%`);

    // Verify validation did NOT redeem the reward
    const checkAfterVal = await prisma.milestoneReward.findUnique({
      where: { id: rewardInDb.id },
    });
    if (checkAfterVal?.status !== 'UNLOCKED') {
      throw new Error('FAIL: Validation endpoint redeemed the reward!');
    }
    console.log('✓ Validation is strictly read-only: reward status remains UNLOCKED.');

    // ──────────────────────────────────────────────────────────────────────────
    // 6. CONCURRENCY TEST: Race condition on POST /api/staff/rewards/redeem-by-token
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n6. Testing concurrent redemption race conditions...');
    // Launch two simultaneous redemption requests with the exact same token
    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/staff/rewards/redeem-by-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${staffToken1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rewardToken: rawToken }),
      }),
      fetch(`${baseUrl}/staff/rewards/redeem-by-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${staffToken1}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rewardToken: rawToken }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      throw new Error(`Expected exactly one 200 and one 409, got ${resA.status} and ${resB.status}`);
    }
    console.log(`✓ Concurrency verified: Request 1 returned 200, Request 2 returned 409 Conflict.`);

    // 6.1 Subsequent redemption attempt
    const resC = await fetch(`${baseUrl}/staff/rewards/redeem-by-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffToken1}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardToken: rawToken }),
    });
    if (resC.status !== 409) {
      throw new Error(`Expected 409 for already redeemed reward, got ${resC.status}`);
    }
    console.log('✓ Subsequent redemption attempt returned 409 Conflict.');

    // ──────────────────────────────────────────────────────────────────────────
    // 7. CUSTOMER RESPONSE AFTER REDEMPTION: Raw token omitted
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n7. Verifying Customer Loyalty API after redemption...');
    const custLoyaltyAfterRes = await fetch(`${baseUrl}/customer/loyalty/${branchA1.qrToken}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const custLoyaltyAfterData = await custLoyaltyAfterRes.json();
    const redeemedInCustView = custLoyaltyAfterData.data.redeemedRewards.find(
      (r: any) => r.id === rewardInDb.id
    );
    if (!redeemedInCustView) {
      throw new Error('Reward missing from customer redeemedRewards!');
    }
    if (redeemedInCustView.redemptionToken) {
      throw new Error('FAIL: Raw redemptionToken still returned for REDEEMED reward!');
    }
    console.log('✓ Customer sees status REDEEMED and redemptionToken is omitted.');

    // ──────────────────────────────────────────────────────────────────────────
    // 8. OWNER REDEMPTION RECORDING: resolveStaffRecord() attribution
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n8. Testing OWNER redemption recording with operational Staff resolution...');
    // Create a 2nd customer and cycle to unlock a reward
    const customer2 = await prisma.customer.create({
      data: {
        phone: `+1888${String(timestamp).slice(-7)}`,
        name: 'Bob Builder',
      },
    });
    const customerToken2 = generateCustomerAccessToken({
      customerId: customer2.id,
      role: 'CUSTOMER',
    });

    // Complete 2 visits to unlock reward 2
    for (let i = 1; i <= 2; i++) {
      const vReqRes = await fetch(`${baseUrl}/customer/visit-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${customerToken2}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrToken: branchA1.qrToken }),
      });
      if (!vReqRes.ok) throw new Error(`Customer 2 visit request ${i} failed: ${vReqRes.status}`);
      const vReqData = await vReqRes.json();
      await fetch(`${baseUrl}/staff/visit-requests/${vReqData.data.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken1}` },
      });
    }

    // Get customer 2 token
    const c2LoyaltyRes = await fetch(`${baseUrl}/customer/loyalty/${branchA1.qrToken}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${customerToken2}` },
    });
    const c2LoyaltyData = await c2LoyaltyRes.json();
    const c2RawToken = c2LoyaltyData.data.unlockedRewards[0].redemptionToken;

    // OWNER redeems the reward directly
    const ownerRedeemRes = await fetch(`${baseUrl}/staff/rewards/redeem-by-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerTokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardToken: c2RawToken }),
    });

    if (!ownerRedeemRes.ok) {
      throw new Error(`Owner redemption failed: ${ownerRedeemRes.status}`);
    }
    console.log('✓ Owner redemption succeeded (200 OK).');

    // Inspect DB record: redeemedByStaffId must be resolved to an operational Staff record
    const c2RewardDb = await prisma.milestoneReward.findFirst({
      where: {
        loyaltyCycle: {
          customerProfile: { customerId: customer2.id },
        },
      },
      include: {
        redeemedByStaff: true,
      },
    });

    if (!c2RewardDb?.redeemedByStaffId) {
      throw new Error('FAIL: redeemedByStaffId is NULL after owner redemption!');
    }
    if (c2RewardDb.redeemedByStaff?.userId !== ownerUserA.id) {
      throw new Error(`FAIL: redeemedByStaff record does not belong to owner user! Expected ${ownerUserA.id}, got ${c2RewardDb.redeemedByStaff?.userId}`);
    }
    console.log(`✓ Owner redemption recorded operational Staff record ID: ${c2RewardDb.redeemedByStaffId} (linked to Owner User ${ownerUserA.id})`);

    // ──────────────────────────────────────────────────────────────────────────
    // 9. IDEMPOTENT BACKFILL SCRIPT VERIFICATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n9. Testing Idempotent Backfill Script...');
    // Create a 3rd customer and cycle to simulate legacy record
    const customer3 = await prisma.customer.create({
      data: {
        phone: `+1777${String(timestamp).slice(-7)}`,
        name: 'Charlie Legacy',
      },
    });
    const c3Profile = await prisma.customerProfile.create({
      data: {
        customerId: customer3.id,
        businessId: businessA.id,
      },
    });
    const c3Cycle = await prisma.loyaltyCycle.create({
      data: {
        customerProfileId: c3Profile.id,
        programId: programA.id,
        cycleNumber: 1,
        visitCount: 2,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });
    const legacyReward = await prisma.milestoneReward.create({
      data: {
        loyaltyCycleId: c3Cycle.id,
        milestoneId: programA.milestones[0].id,
        snapshotRewardType: RewardType.FREE_ITEM,
        snapshotRewardName: 'Free Coffee',
        status: 'UNLOCKED',
        redemptionTokenHash: null,
        redemptionTokenCreatedAt: null,
      },
    });

    const backfill1 = await backfillRedemptionTokens();
    if (backfill1.processed < 1) {
      throw new Error('Backfill failed to process legacy reward!');
    }
    console.log(`✓ Backfill processed ${backfill1.processed} legacy records.`);

    const legacyRewardAfter = await prisma.milestoneReward.findUnique({
      where: { id: legacyReward.id },
    });
    if (!legacyRewardAfter?.redemptionTokenHash) {
      throw new Error('FAIL: Legacy reward did not receive redemptionTokenHash!');
    }
    console.log(`✓ Legacy reward received unique hash: ${legacyRewardAfter.redemptionTokenHash}`);

    // Re-run backfill to verify idempotency
    const backfill2 = await backfillRedemptionTokens();
    if (backfill2.processed !== 0) {
      throw new Error(`Expected 0 records on second backfill run, got ${backfill2.processed}`);
    }
    console.log('✓ Re-running backfill processed 0 records (idempotent safety verified).');

    // Clean up temporary legacy reward and customer3
    await prisma.milestoneReward.delete({ where: { id: legacyReward.id } });
    await prisma.loyaltyCycle.delete({ where: { id: c3Cycle.id } });
    await prisma.customerProfile.delete({ where: { id: c3Profile.id } });
    await prisma.customer.delete({ where: { id: customer3.id } });

    console.log('\n===============================================================');
    console.log('🎉 ALL REWARD QR/CODE REDEMPTION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('===============================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runRewardVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
