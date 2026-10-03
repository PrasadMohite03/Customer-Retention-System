import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import bcrypt from 'bcrypt';
import { UserRole, RewardType } from '@prisma/client';
import { generateAccessToken, generateCustomerAccessToken } from './utils/auth.utils';

const PORT = 5059;
const BASE_URL = `http://localhost:${PORT}`;

async function runVerification() {
  console.log('=== STARTING OWNER STAFF MANAGEMENT + OWNER VISIT REQUEST VERIFICATION ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on ${BASE_URL}\n`);

  try {
    const timestamp = Date.now();
    const defaultPassword = 'StaffPassword123!';
    const passwordHash = await bcrypt.hash('OwnerPassword123!', 10);

    // ==========================================
    // SETUP TEST FIXTURES
    // ==========================================
    console.log('[Setup] Creating Business A and Business B fixtures...');

    // 1. Owner & Business A
    const ownerUserA = await prisma.user.create({
      data: {
        email: `owner_a_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const businessA = await prisma.business.create({
      data: {
        name: `Acme Retail ${timestamp}`,
        ownerId: ownerUserA.id,
      },
    });

    const ownerTokenA = generateAccessToken({
      userId: ownerUserA.id,
      role: UserRole.OWNER,
      businessId: businessA.id,
    });

    // Business A - Branch 1 & Branch 2
    const branchA1 = await prisma.branch.create({
      data: {
        businessId: businessA.id,
        name: `Branch A1 Downtown ${timestamp}`,
        address: '100 Market St',
        qrToken: `qr_a1_${timestamp}`,
        isActive: true,
      },
    });

    const branchA2 = await prisma.branch.create({
      data: {
        businessId: businessA.id,
        name: `Branch A2 Uptown ${timestamp}`,
        address: '200 High St',
        qrToken: `qr_a2_${timestamp}`,
        isActive: true,
      },
    });

    // Program for Branch A1
    const programA1 = await prisma.loyaltyProgram.create({
      data: {
        businessId: businessA.id,
        branchId: branchA1.id,
        name: 'Downtown Loyalty Program',
        cycleLength: 3,
        isActive: true,
      },
    });

    await prisma.milestone.create({
      data: {
        programId: programA1.id,
        visitNumber: 2,
        rewardType: RewardType.PERCENT_DISCOUNT,
        rewardValue: 20,
        rewardName: 'Free Pastry',
        isEnabled: true,
      },
    });

    // 2. Owner & Business B (Cross-Tenant)
    const ownerUserB = await prisma.user.create({
      data: {
        email: `owner_b_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const businessB = await prisma.business.create({
      data: {
        name: `Other Corp ${timestamp}`,
        ownerId: ownerUserB.id,
      },
    });

    const ownerTokenB = generateAccessToken({
      userId: ownerUserB.id,
      role: UserRole.OWNER,
      businessId: businessB.id,
    });

    const branchB1 = await prisma.branch.create({
      data: {
        businessId: businessB.id,
        name: `Branch B1 ${timestamp}`,
        address: '500 Foreign St',
        qrToken: `qr_b1_${timestamp}`,
        isActive: true,
      },
    });

    // Customer setup for visits
    const customer = await prisma.customer.create({
      data: {
        name: 'Prasad Customer',
        phone: `+9198${timestamp.toString().slice(-8)}`,
      },
    });

    const customerToken = generateCustomerAccessToken({
      customerId: customer.id,
      role: 'CUSTOMER',
    });

    // Customer Profile for Business A
    const customerProfileA = await prisma.customerProfile.create({
      data: {
        customerId: customer.id,
        businessId: businessA.id,
      },
    });

    // ==========================================
    // TEST 1: Owner creates staff successfully
    // ==========================================
    console.log('--- TEST 1: Owner creates staff successfully (POST /api/staff) ---');
    const staffEmail = `staff_a1_${timestamp}@test.com`;
    const resCreateStaff = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerTokenA}`,
      },
      body: JSON.stringify({
        email: staffEmail,
        password: defaultPassword,
        branchId: branchA1.id,
      }),
    });

    const bodyCreateStaff = await resCreateStaff.json();
    if (resCreateStaff.status !== 201 || !bodyCreateStaff.data?.id) {
      throw new Error(`TEST 1 FAILED: Expected 201 created staff, got ${resCreateStaff.status}: ${JSON.stringify(bodyCreateStaff)}`);
    }
    const createdStaffId = bodyCreateStaff.data.id;
    console.log('✓ TEST 1 PASSED: Owner created staff successfully, id:', createdStaffId);

    // ==========================================
    // TEST 2: Staff can log in with created credentials
    // ==========================================
    console.log('\n--- TEST 2: Staff can log in with created credentials (POST /api/auth/login) ---');
    const resLoginStaff = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: staffEmail,
        password: defaultPassword,
      }),
    });

    const bodyLoginStaff = await resLoginStaff.json();
    const staffToken = bodyLoginStaff.data?.accessToken || bodyLoginStaff.data?.tokens?.accessToken;
    if (resLoginStaff.status !== 200 || !staffToken) {
      throw new Error(`TEST 2 FAILED: Expected 200 login for staff, got ${resLoginStaff.status}: ${JSON.stringify(bodyLoginStaff)}`);
    }
    console.log('✓ TEST 2 PASSED: Staff logged in successfully with JWT received');

    // ==========================================
    // TEST 3: Staff is assigned to the selected branch
    // ==========================================
    console.log('\n--- TEST 3: Staff is assigned to the selected branch ---');
    const resGetStaff = await fetch(`${BASE_URL}/api/staff/${createdStaffId}`, {
      headers: { Authorization: `Bearer ${ownerTokenA}` },
    });
    const bodyGetStaff = await resGetStaff.json();
    if (resGetStaff.status !== 200 || bodyGetStaff.data?.branchId !== branchA1.id) {
      throw new Error(`TEST 3 FAILED: Expected branchId ${branchA1.id}, got: ${bodyGetStaff.data?.branchId}`);
    }
    console.log(`✓ TEST 3 PASSED: Staff assigned strictly to branch ${bodyGetStaff.data.branchName}`);

    // ==========================================
    // TEST 4: Owner cannot assign staff to another business's branch
    // ==========================================
    console.log('\n--- TEST 4: Owner cannot assign staff to another business branch ---');
    const resCrossBranch = await fetch(`${BASE_URL}/api/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerTokenA}`,
      },
      body: JSON.stringify({
        email: `illegal_staff_${timestamp}@test.com`,
        password: defaultPassword,
        branchId: branchB1.id, // belongs to Business B!
      }),
    });
    if (resCrossBranch.status !== 404 && resCrossBranch.status !== 403) {
      throw new Error(`TEST 4 FAILED: Expected 404/403 for cross-business branch assignment, got ${resCrossBranch.status}`);
    }
    console.log(`✓ TEST 4 PASSED: Cross-business branch assignment rejected (${resCrossBranch.status})`);

    // ==========================================
    // TEST 5 & 6: Owner sees all branches requests vs Staff sees only assigned branch
    // ==========================================
    console.log('\n--- TEST 5 & 6: Owner sees all branch requests vs Staff sees assigned branch ---');
    // Create visit request at Branch A1
    const reqBranch1 = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfileA.id,
        branchId: branchA1.id,
        status: 'PENDING',
      },
    });

    // Create visit request at Branch A2
    const reqBranch2 = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfileA.id,
        branchId: branchA2.id,
        status: 'PENDING',
      },
    });

    // Owner checks queue (no branch filter -> should see both Branch A1 and Branch A2)
    const resOwnerAll = await fetch(`${BASE_URL}/api/staff/visit-requests`, {
      headers: { Authorization: `Bearer ${ownerTokenA}` },
    });
    const bodyOwnerAll = await resOwnerAll.json();
    const ownerReqIds = bodyOwnerAll.data.map((r: any) => r.id);
    if (!ownerReqIds.includes(reqBranch1.id) || !ownerReqIds.includes(reqBranch2.id)) {
      throw new Error(`TEST 5 FAILED: Owner did not see requests across both branches. Found: ${JSON.stringify(ownerReqIds)}`);
    }
    console.log(`✓ TEST 5 PASSED: Owner sees requests from all branches (found ${ownerReqIds.length} requests)`);

    // Owner checks queue filtered by branch A1
    const resOwnerFiltered = await fetch(`${BASE_URL}/api/staff/visit-requests?branchId=${branchA1.id}`, {
      headers: { Authorization: `Bearer ${ownerTokenA}` },
    });
    const bodyOwnerFiltered = await resOwnerFiltered.json();
    const filteredReqIds = bodyOwnerFiltered.data.map((r: any) => r.id);
    if (!filteredReqIds.includes(reqBranch1.id) || filteredReqIds.includes(reqBranch2.id)) {
      throw new Error(`TEST 5b FAILED: Owner branch filter failed. Expected branch A1 only.`);
    }
    console.log(`✓ TEST 5b PASSED: Owner branch filter correctly filters to Branch A1`);

    // Staff A1 checks queue (should ONLY see Branch A1 request, NEVER Branch A2)
    const resStaffQueue = await fetch(`${BASE_URL}/api/staff/visit-requests`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const bodyStaffQueue = await resStaffQueue.json();
    const staffReqIds = bodyStaffQueue.data.map((r: any) => r.id);
    if (!staffReqIds.includes(reqBranch1.id) || staffReqIds.includes(reqBranch2.id)) {
      throw new Error(`TEST 6 FAILED: Staff saw Branch A2 or missed Branch A1. Found: ${JSON.stringify(staffReqIds)}`);
    }
    console.log(`✓ TEST 6 PASSED: Staff sees only assigned branch requests (saw A1, did not see A2)`);

    // ==========================================
    // TEST 7: Owner can approve a pending request
    // ==========================================
    console.log('\n--- TEST 7: Owner can approve a pending request ---');
    const resOwnerApprove = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqBranch1.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerTokenA}` },
    });
    const bodyOwnerApprove = await resOwnerApprove.json();
    if (resOwnerApprove.status !== 200 || !bodyOwnerApprove.data?.visitId) {
      throw new Error(`TEST 7 FAILED: Owner approve failed with status ${resOwnerApprove.status}: ${JSON.stringify(bodyOwnerApprove)}`);
    }
    console.log(`✓ TEST 7 PASSED: Owner approved request ${reqBranch1.id}, visit created: ${bodyOwnerApprove.data.visitId}`);

    // Verify DB status
    const dbReq1 = await prisma.visitRequest.findUnique({ where: { id: reqBranch1.id } });
    if (dbReq1?.status !== 'APPROVED') {
      throw new Error(`TEST 7 DB check failed: Expected APPROVED, got ${dbReq1?.status}`);
    }

    // ==========================================
    // TEST 8: Owner can reject a pending request
    // ==========================================
    console.log('\n--- TEST 8: Owner can reject a pending request ---');
    const resOwnerReject = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqBranch2.id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerTokenA}` },
    });
    if (resOwnerReject.status !== 200) {
      const err = await resOwnerReject.json();
      throw new Error(`TEST 8 FAILED: Owner reject failed with status ${resOwnerReject.status}: ${JSON.stringify(err)}`);
    }
    const dbReq2 = await prisma.visitRequest.findUnique({ where: { id: reqBranch2.id } });
    if (dbReq2?.status !== 'REJECTED') {
      throw new Error(`TEST 8 DB check failed: Expected REJECTED, got ${dbReq2?.status}`);
    }
    console.log(`✓ TEST 8 PASSED: Owner rejected request ${reqBranch2.id} successfully`);

    // ==========================================
    // TEST 9: Staff can still approve/reject normally within assigned branch
    // ==========================================
    console.log('\n--- TEST 9: Staff can still approve/reject normally within assigned branch ---');
    const reqBranch1ForStaff = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfileA.id,
        branchId: branchA1.id,
        status: 'PENDING',
      },
    });

    const resStaffApprove = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqBranch1ForStaff.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const bodyStaffApprove = await resStaffApprove.json();
    if (resStaffApprove.status !== 200 || !bodyStaffApprove.data?.visitId) {
      throw new Error(`TEST 9 FAILED: Staff approve failed: ${JSON.stringify(bodyStaffApprove)}`);
    }
    console.log(`✓ TEST 9 PASSED: Staff approved request in assigned branch, visitId: ${bodyStaffApprove.data.visitId}`);

    // Verify staff cannot approve another branch
    const reqBranch2ForStaffTest = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfileA.id,
        branchId: branchA2.id,
        status: 'PENDING',
      },
    });
    const resStaffIllegalApprove = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqBranch2ForStaffTest.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    if (resStaffIllegalApprove.status !== 403) {
      throw new Error(`TEST 9b FAILED: Expected 403 when staff approves unassigned branch, got ${resStaffIllegalApprove.status}`);
    }
    console.log('✓ TEST 9b PASSED: Staff cannot approve visit for unassigned branch (403)');

    // ==========================================
    // TEST 10: Cross-tenant access is rejected
    // ==========================================
    console.log('\n--- TEST 10: Cross-tenant access is rejected ---');
    // Owner B tries to view/approve Business A's request
    const resOwnerBCross = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqBranch2ForStaffTest.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerTokenB}` },
    });
    if (resOwnerBCross.status !== 403 && resOwnerBCross.status !== 404) {
      throw new Error(`TEST 10a FAILED: Cross-tenant approval allowed! status ${resOwnerBCross.status}`);
    }

    // Owner B tries to update Owner A's staff member
    const resOwnerBStaff = await fetch(`${BASE_URL}/api/staff/${createdStaffId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerTokenB}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    if (resOwnerBStaff.status !== 404 && resOwnerBStaff.status !== 403) {
      throw new Error(`TEST 10b FAILED: Cross-tenant staff edit allowed! status ${resOwnerBStaff.status}`);
    }
    console.log('✓ TEST 10 PASSED: Cross-tenant visit approval and staff modification strictly rejected');

    // ==========================================
    // TEST 11: Existing concurrent approval protection still works
    // ==========================================
    console.log('\n--- TEST 11: Concurrent approval protection ---');
    const reqConcurrent = await prisma.visitRequest.create({
      data: {
        customerProfileId: customerProfileA.id,
        branchId: branchA1.id,
        status: 'PENDING',
      },
    });

    const [raceRes1, raceRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/staff/visit-requests/${reqConcurrent.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerTokenA}` },
      }),
      fetch(`${BASE_URL}/api/staff/visit-requests/${reqConcurrent.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerTokenA}` },
      }),
    ]);

    const statuses = [raceRes1.status, raceRes2.status];
    const successes = statuses.filter((s) => s === 200).length;
    const conflicts = statuses.filter((s) => s === 409).length;

    if (successes !== 1 || conflicts !== 1) {
      throw new Error(`TEST 11 FAILED: Expected exactly one 200 and one 409, got statuses: ${JSON.stringify(statuses)}`);
    }
    console.log('✓ TEST 11 PASSED: Concurrency check passed: exactly 1 succeeded (200) and 1 failed with conflict (409)');

    // ==========================================
    // TEST 12: Existing customer loyalty flow remains unaffected
    // ==========================================
    console.log('\n--- TEST 12: Customer loyalty flow unaffected ---');
    // We already approved visits 1, 2, and concurrent visit on programA1 (cycleLength: 3, milestone at 2)
    // Check if milestone reward was unlocked for customer on visit 2
    const rewards = await prisma.milestoneReward.findMany({
      where: {
        loyaltyCycle: {
          customerProfileId: customerProfileA.id,
        },
      },
    });
    if (rewards.length === 0) {
      throw new Error('TEST 12 FAILED: Expected milestone reward to be unlocked during visits');
    }
    console.log(`✓ TEST 12 PASSED: Customer loyalty cycle updated and milestone reward unlocked (${rewards.length} rewards found)`);

    console.log('\n======================================================');
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err: any) {
    console.error('\n❌ VERIFICATION FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    server.close();
  }
}

runVerification();
