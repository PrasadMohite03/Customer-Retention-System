import { PrismaClient, UserRole } from '@prisma/client';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from './app';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function generateToken(payload: { userId: string; role: UserRole; businessId: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runVerification() {
  console.log('--- STARTING DASHBOARD POLLING OPTIMIZATION VERIFICATION ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const timestamp = Date.now();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // 1. Setup Owner & Business A with 2 branches
    const ownerUser = await prisma.user.create({
      data: {
        email: `owner_polling_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const businessA = await prisma.business.create({
      data: {
        name: `Biz Polling Test ${timestamp}`,
        type: 'SALON',
        ownerId: ownerUser.id,
      },
    });

    const ownerToken = generateToken({
      userId: ownerUser.id,
      role: UserRole.OWNER,
      businessId: businessA.id,
    });

    const branchA1 = await prisma.branch.create({
      data: {
        name: `Downtown ${timestamp}`,
        address: '123 Main St',
        qrToken: `qr_dash_a1_${timestamp}`,
        businessId: businessA.id,
        isActive: true,
      },
    });

    const branchA2 = await prisma.branch.create({
      data: {
        name: `Uptown ${timestamp}`,
        address: '456 High St',
        qrToken: `qr_dash_a2_${timestamp}`,
        businessId: businessA.id,
        isActive: true,
      },
    });

    // Setup Loyalty Program on Branch A1
    const programA1 = await prisma.loyaltyProgram.create({
      data: {
        name: 'Downtown Rewards',
        branchId: branchA1.id,
        businessId: businessA.id,
        cycleLength: 3,
        isActive: true,
        milestones: {
          create: [
            {
              visitNumber: 3,
              rewardType: 'FREE_ITEM',
              rewardName: 'Coffee',
              rewardDescription: 'Free fresh coffee',
              isEnabled: true,
            },
          ],
        },
      },
    });

    // Setup Staff User for Branch A1
    const staffUser1 = await prisma.user.create({
      data: {
        email: `staff_polling_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });
    await prisma.staff.create({
      data: {
        userId: staffUser1.id,
        branchId: branchA1.id,
        businessId: businessA.id,
        isActive: true,
      },
    });
    const staffToken1 = generateToken({
      userId: staffUser1.id,
      role: UserRole.STAFF,
      businessId: businessA.id,
    });

    // Setup Business B (Another Tenant)
    const ownerB = await prisma.user.create({
      data: {
        email: `owner_b_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });
    const businessB = await prisma.business.create({
      data: {
        name: `Tenant B ${timestamp}`,
        type: 'CAFE',
        ownerId: ownerB.id,
      },
    });
    const branchB = await prisma.branch.create({
      data: {
        name: `Tenant B Branch ${timestamp}`,
        qrToken: `qr_dash_b_${timestamp}`,
        businessId: businessB.id,
        isActive: true,
      },
    });

    // Setup Customer and 1 CustomerProfile
    const customer = await prisma.customer.create({
      data: {
        phone: `+9188880${timestamp.toString().slice(-5)}`,
        name: 'Charlie Customer',
      },
    });
    const customerProfile = await prisma.customerProfile.create({
      data: {
        customerId: customer.id,
        businessId: businessA.id,
      },
    });

    // Create a pending visit request on Branch A1
    const visitRequest1 = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfile.id,
        branchId: branchA1.id,
        status: 'PENDING',
      },
    });

    // Create an unlocked milestone reward on Branch A1
    const cycle1 = await prisma.loyaltyCycle.create({
      data: {
        customerProfileId: customerProfile.id,
        programId: programA1.id,
        cycleNumber: 1,
        visitCount: 3,
        status: 'COMPLETED',
        startedAt: new Date(),
      },
    });

    const milestoneReward1 = await prisma.milestoneReward.create({
      data: {
        loyaltyCycleId: cycle1.id,
        milestoneId: (await prisma.milestone.findFirst({ where: { programId: programA1.id } }))!.id,
        status: 'UNLOCKED',
        snapshotRewardType: 'FREE_ITEM',
        snapshotRewardName: 'Coffee',
        snapshotRewardDescription: 'Free fresh coffee',
      },
    });

    // ─── CHECK 1: OWNER Dashboard (All Branches) ───────────────────────────
    console.log('Check 1: OWNER dashboard fetches both pending requests and available rewards...');
    const ownerRes = await fetch(`${baseUrl}/staff/dashboard`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (ownerRes.status !== 200) {
      throw new Error(`Owner dashboard expected 200, got ${ownerRes.status}`);
    }
    const ownerData = (await ownerRes.json()).data;
    if (ownerData.pendingRequests.length !== 1 || ownerData.pendingRequests[0].id !== visitRequest1.id) {
      throw new Error(`Owner pendingRequests mismatch: ${JSON.stringify(ownerData.pendingRequests)}`);
    }
    if (ownerData.availableRewards.length !== 1 || ownerData.availableRewards[0].id !== milestoneReward1.id) {
      throw new Error(`Owner availableRewards mismatch: ${JSON.stringify(ownerData.availableRewards)}`);
    }
    if (ownerData.stats.pendingRequests !== 1 || ownerData.stats.activeRewards !== 1) {
      throw new Error(`Owner stats mismatch: ${JSON.stringify(ownerData.stats)}`);
    }
    console.log('✓ Check 1 Passed: OWNER dashboard returns consolidated data and stats.');

    // ─── CHECK 2: STAFF Dashboard (Assigned Branch A1) ──────────────────────
    console.log('Check 2: STAFF dashboard fetches assigned branch data...');
    const staffRes = await fetch(`${baseUrl}/staff/dashboard`, {
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (staffRes.status !== 200) {
      throw new Error(`Staff dashboard expected 200, got ${staffRes.status}`);
    }
    const staffData = (await staffRes.json()).data;
    if (staffData.pendingRequests.length !== 1 || staffData.availableRewards.length !== 1) {
      throw new Error(`Staff dashboard data mismatch`);
    }
    console.log('✓ Check 2 Passed: STAFF dashboard successfully scoped to assigned branch.');

    // ─── CHECK 3: OWNER Branch Filtering ────────────────────────────────────
    console.log('Check 3: OWNER branch filter works...');
    // Filter to Branch A2 (which has 0 pending requests and 0 rewards)
    const ownerFilteredRes = await fetch(`${baseUrl}/staff/dashboard?branchId=${branchA2.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerFilteredData = (await ownerFilteredRes.json()).data;
    if (ownerFilteredData.pendingRequests.length !== 0 || ownerFilteredData.availableRewards.length !== 0) {
      throw new Error(`Owner filtered dashboard should be empty for branch A2`);
    }
    if (ownerFilteredData.stats.pendingRequests !== 0 || ownerFilteredData.stats.activeRewards !== 0) {
      throw new Error(`Owner filtered stats should be 0`);
    }
    console.log('✓ Check 3 Passed: OWNER branch filter works accurately.');

    // ─── CHECK 4: STAFF Branch Isolation ────────────────────────────────────
    console.log('Check 4: STAFF cannot query other branches...');
    const staffCrossBranchRes = await fetch(`${baseUrl}/staff/dashboard?branchId=${branchA2.id}`, {
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (staffCrossBranchRes.status !== 403) {
      throw new Error(`Staff requesting other branch should get 403, got ${staffCrossBranchRes.status}`);
    }
    console.log('✓ Check 4 Passed: STAFF rejected with 403 when specifying mismatched branchId.');

    // ─── CHECK 5: Cross-Tenant Isolation ────────────────────────────────────
    console.log('Check 5: Cross-tenant isolation prevents accessing other business branches...');
    const ownerCrossTenantRes = await fetch(`${baseUrl}/staff/dashboard?branchId=${branchB.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (ownerCrossTenantRes.status !== 404) {
      throw new Error(`Owner requesting foreign branch should get 404, got ${ownerCrossTenantRes.status}`);
    }
    console.log('✓ Check 5 Passed: Cross-tenant branch access rejected with 404.');

    // ─── CHECK 6: Approval action updates state ─────────────────────────────
    console.log('Check 6: Approving visit request updates dashboard state...');
    const approveRes = await fetch(`${baseUrl}/staff/visit-requests/${visitRequest1.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (approveRes.status !== 200) {
      throw new Error(`Approval expected 200, got ${approveRes.status}`);
    }

    const staffPostApprove = await (await fetch(`${baseUrl}/staff/dashboard`, {
      headers: { Authorization: `Bearer ${staffToken1}` },
    })).json();
    if (staffPostApprove.data.pendingRequests.length !== 0) {
      throw new Error(`Pending requests should be 0 after approval`);
    }
    if (staffPostApprove.data.stats.pendingRequests !== 0) {
      throw new Error(`Pending stats should be 0 after approval`);
    }
    console.log('✓ Check 6 Passed: Pending request cleared and dashboard reflects updated state.');

    // ─── CHECK 7: Reward Redemption updates state ───────────────────────────
    console.log('Check 7: Redeeming reward updates available rewards in dashboard...');
    const redeemRes = await fetch(`${baseUrl}/staff/rewards/${milestoneReward1.id}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (redeemRes.status !== 200) {
      throw new Error(`Redeem expected 200, got ${redeemRes.status}`);
    }

    const staffPostRedeem = await (await fetch(`${baseUrl}/staff/dashboard`, {
      headers: { Authorization: `Bearer ${staffToken1}` },
    })).json();
    if (staffPostRedeem.data.availableRewards.length !== 0) {
      throw new Error(`Available rewards should be 0 after redemption`);
    }
    if (staffPostRedeem.data.stats.activeRewards !== 0) {
      throw new Error(`Active rewards stats should be 0 after redemption`);
    }
    console.log('✓ Check 7 Passed: Reward redeemed and removed from dashboard available rewards.');

    // ─── CHECK 8: Backwards compatibility of individual endpoints ───────────
    console.log('Check 8: Existing /visit-requests and /rewards/unlocked remain available...');
    const oldVR = await fetch(`${baseUrl}/staff/visit-requests`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (oldVR.status !== 200) {
      throw new Error(`GET /staff/visit-requests expected 200, got ${oldVR.status}`);
    }
    const oldRW = await fetch(`${baseUrl}/staff/rewards/unlocked`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (oldRW.status !== 200) {
      throw new Error(`GET /staff/rewards/unlocked expected 200, got ${oldRW.status}`);
    }
    console.log('✓ Check 8 Passed: Backwards compatibility endpoints operational.');

    console.log('\n🎉 ALL DASHBOARD POLLING OPTIMIZATION CHECKS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
