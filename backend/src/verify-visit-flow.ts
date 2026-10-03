import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import bcrypt from 'bcrypt';
import { UserRole, RewardType } from '@prisma/client';
import { generateAccessToken, generateCustomerAccessToken } from './utils/auth.utils';

const PORT = 5057;
const BASE_URL = `http://localhost:${PORT}`;

async function runVerification() {
  console.log('=== STARTING CUSTOMER LOYALTY + QR VISIT FLOW VERIFICATION ===');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Verification test server running on ${BASE_URL}\n`);

  try {
    const timestamp = Date.now();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // --- SETUP TEST DATA ---
    console.log('[Setup] Creating test Owner, Business, Branches, Programs, Milestones, Staff...');

    // 1. Owner & Business A
    const ownerUserA = await prisma.user.create({
      data: {
        email: `ownerA_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const businessA = await prisma.business.create({
      data: {
        name: `Apex Coffee Roasters ${timestamp}`,
        ownerId: ownerUserA.id,
      },
    });

    const ownerTokenA = generateAccessToken({
      userId: ownerUserA.id,
      role: UserRole.OWNER,
      businessId: businessA.id,
    });

    // 2. Branch 1 (Active, with Active Program)
    const qrTokenBranch1 = `qr_br1_${timestamp}`;
    const branch1 = await prisma.branch.create({
      data: {
        businessId: businessA.id,
        name: 'Branch One (Downtown)',
        address: '123 Main St',
        qrToken: qrTokenBranch1,
        isActive: true,
      },
    });

    // Active Program for Branch 1 (cycleLength: 3)
    const program1 = await prisma.loyaltyProgram.create({
      data: {
        businessId: businessA.id,
        branchId: branch1.id,
        name: 'Branch 1 Rewards Club',
        cycleLength: 3,
        isActive: true,
      },
    });

    // Milestone 1: visitNumber 1 -> NONE
    const milestone1 = await prisma.milestone.create({
      data: {
        programId: program1.id,
        visitNumber: 1,
        rewardType: RewardType.NONE,
        isEnabled: true,
      },
    });

    // Milestone 2: visitNumber 2 -> PERCENT_DISCOUNT (20% off)
    const milestone2 = await prisma.milestone.create({
      data: {
        programId: program1.id,
        visitNumber: 2,
        rewardType: RewardType.PERCENT_DISCOUNT,
        rewardValue: 20,
        rewardName: '20% Off Pastry',
        rewardDescription: 'Enjoy 20% off any freshly baked pastry',
        isEnabled: true,
      },
    });

    // Milestone 3: visitNumber 3 (Cycle end) -> FREE_ITEM
    const milestone3 = await prisma.milestone.create({
      data: {
        programId: program1.id,
        visitNumber: 3,
        rewardType: RewardType.FREE_ITEM,
        rewardName: 'Free Specialty Coffee',
        isEnabled: true,
      },
    });

    // 3. Branch 2 (Active, but NO active program)
    const qrTokenBranch2 = `qr_br2_${timestamp}`;
    const branch2 = await prisma.branch.create({
      data: {
        businessId: businessA.id,
        name: 'Branch Two (Uptown - No Program)',
        qrToken: qrTokenBranch2,
        isActive: true,
      },
    });

    // 4. Branch 3 (Inactive Branch)
    const qrTokenBranch3 = `qr_br3_${timestamp}`;
    const branch3 = await prisma.branch.create({
      data: {
        businessId: businessA.id,
        name: 'Branch Three (Closed)',
        qrToken: qrTokenBranch3,
        isActive: false,
      },
    });

    // 5. Staff 1 (Assigned to Branch 1, Active)
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
        businessId: businessA.id,
        branchId: branch1.id,
        isActive: true,
      },
    });

    const staffToken1 = generateAccessToken({
      userId: staffUser1.id,
      role: UserRole.STAFF,
      businessId: businessA.id,
    });

    // 6. Staff 2 (Assigned to Branch 2, Active)
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
        businessId: businessA.id,
        branchId: branch2.id,
        isActive: true,
      },
    });

    const staffToken2 = generateAccessToken({
      userId: staffUser2.id,
      role: UserRole.STAFF,
      businessId: businessA.id,
    });

    // 7. Staff Inactive (Assigned to Branch 1, isActive: false)
    const staffUserInactive = await prisma.user.create({
      data: {
        email: `staff_inactive_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    const staffInactive = await prisma.staff.create({
      data: {
        userId: staffUserInactive.id,
        businessId: businessA.id,
        branchId: branch1.id,
        isActive: false,
      },
    });

    const staffInactiveToken = generateAccessToken({
      userId: staffUserInactive.id,
      role: UserRole.STAFF,
      businessId: businessA.id,
    });

    // 8. Business B (Competitor tenant)
    const ownerUserB = await prisma.user.create({
      data: {
        email: `ownerB_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const businessB = await prisma.business.create({
      data: {
        name: `Competitor Salon ${timestamp}`,
        ownerId: ownerUserB.id,
      },
    });

    const staffUserB = await prisma.user.create({
      data: {
        email: `staffB_${timestamp}@test.com`,
        passwordHash,
        role: UserRole.STAFF,
      },
    });

    const branchB = await prisma.branch.create({
      data: {
        businessId: businessB.id,
        name: 'Competitor Branch',
        qrToken: `qr_competitor_${timestamp}`,
        isActive: true,
      },
    });

    const staffB = await prisma.staff.create({
      data: {
        userId: staffUserB.id,
        businessId: businessB.id,
        branchId: branchB.id,
        isActive: true,
      },
    });

    const staffTokenB = generateAccessToken({
      userId: staffUserB.id,
      role: UserRole.STAFF,
      businessId: businessB.id,
    });

    // 9. Customer (Global)
    const customer = await prisma.customer.create({
      data: {
        name: 'Test Customer Prasad',
        phone: `+9198${timestamp.toString().slice(-8)}`,
      },
    });

    const customerToken = generateCustomerAccessToken({
      customerId: customer.id,
      role: 'CUSTOMER',
    });

    console.log('✅ Test setup completed.\n');

    // ─── TEST SUITE ──────────────────────────────────────────────────────────

    // 1. QR RESOLUTION
    console.log('[Test 1.1] Public QR Resolution with Valid QR...');
    const qrRes = await fetch(`${BASE_URL}/api/public/qr/${qrTokenBranch1}`);
    const qrData = await qrRes.json();
    if (qrRes.status !== 200) throw new Error(`Expected 200, got ${qrRes.status}`);
    if (qrData.data.business.name !== businessA.name) throw new Error('Business name mismatch');
    if (qrData.data.branch.name !== branch1.name) throw new Error('Branch name mismatch');
    if (qrData.data.program.cycleLength !== 3) throw new Error('CycleLength mismatch');
    if (qrData.data.program.milestones.length !== 3) throw new Error('Milestones length mismatch');
    // Ensure no internal UUID leakage
    if (qrData.data.business.id || qrData.data.branch.id || qrData.data.program.id) {
      throw new Error('LEAK: Internal UUIDs exposed in public QR response!');
    }
    console.log('✅ Valid QR resolution passed (no internal UUIDs leaked)');

    console.log('[Test 1.2] Public QR Resolution with Invalid QR...');
    const invalidQrRes = await fetch(`${BASE_URL}/api/public/qr/non_existent_qr_token`);
    if (invalidQrRes.status !== 404) throw new Error(`Expected 404 for invalid QR, got ${invalidQrRes.status}`);
    console.log('✅ Invalid QR 404 passed');

    console.log('[Test 1.3] Public QR Resolution on Inactive Branch...');
    const inactiveBranchRes = await fetch(`${BASE_URL}/api/public/qr/${qrTokenBranch3}`);
    if (inactiveBranchRes.status !== 400) throw new Error(`Expected 400 for inactive branch, got ${inactiveBranchRes.status}`);
    console.log('✅ Inactive branch 400 passed');

    console.log('[Test 1.4] Public QR Resolution on Branch with No Active Program...');
    const noProgramRes = await fetch(`${BASE_URL}/api/public/qr/${qrTokenBranch2}`);
    if (noProgramRes.status !== 422) throw new Error(`Expected 422 for no active program, got ${noProgramRes.status}`);
    console.log('✅ No active program 422 passed');

    // 2. CUSTOMER LOYALTY STATUS (Read-Only)
    console.log('\n[Test 2.1] Authenticated Customer Loyalty Status Read-Only...');
    const statusRes1 = await fetch(`${BASE_URL}/api/customer/loyalty/${qrTokenBranch1}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const statusData1 = await statusRes1.json();
    if (statusRes1.status !== 200) throw new Error(`Expected 200, got ${statusRes1.status}`);
    if (statusData1.data.cycle.hasStarted !== false) throw new Error('Cycle should not have started yet');
    if (statusData1.data.cycle.visitCount !== 0) throw new Error('visitCount should be 0');

    // Verify CustomerProfile was created idempotently
    const profileInDb = await prisma.customerProfile.findUnique({
      where: {
        customerId_businessId: { customerId: customer.id, businessId: businessA.id },
      },
    });
    if (!profileInDb) throw new Error('CustomerProfile was not created for Business A');

    // Verify NO LoyaltyCycle was created simply by viewing loyalty status!
    const cycleCountBeforeVisit = await prisma.loyaltyCycle.count({
      where: { customerProfileId: profileInDb.id },
    });
    if (cycleCountBeforeVisit !== 0) {
      throw new Error(`CRITICAL: Empty LoyaltyCycle was created on view! count=${cycleCountBeforeVisit}`);
    }
    console.log('✅ Read-only loyalty status passed (CustomerProfile created, ZERO empty cycles created)');

    // 3. VISIT REQUEST CREATION
    console.log('\n[Test 3.1] Customer Submits Visit Request...');
    const reqRes1 = await fetch(`${BASE_URL}/api/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: qrTokenBranch1 }),
    });
    const reqData1 = await reqRes1.json();
    if (reqRes1.status !== 201) throw new Error(`Expected 201, got ${reqRes1.status}`);
    if (reqData1.data.status !== 'PENDING') throw new Error('Request status should be PENDING');
    const visitRequestId1 = reqData1.data.id;
    console.log('✅ Visit request created successfully (status: PENDING)');

    console.log('[Test 3.2] Customer Submits Duplicate Pending Request (Same Branch)...');
    const duplicateReqRes = await fetch(`${BASE_URL}/api/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: qrTokenBranch1 }),
    });
    if (duplicateReqRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate pending request, got ${duplicateReqRes.status}`);
    }
    console.log('✅ Duplicate pending request blocked with 409 Conflict');

    // 4. STAFF QUEUE & BRANCH ISOLATION
    console.log('\n[Test 4.1] Staff 1 (Branch 1) sees the Pending Request...');
    const staffQueueRes1 = await fetch(`${BASE_URL}/api/staff/visit-requests`, {
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    const staffQueueData1 = await staffQueueRes1.json();
    if (staffQueueRes1.status !== 200) throw new Error(`Expected 200, got ${staffQueueRes1.status}`);
    const foundInQueue1 = staffQueueData1.data.find((r: any) => r.id === visitRequestId1);
    if (!foundInQueue1) throw new Error('Visit request not found in Branch 1 staff queue');
    if (!foundInQueue1.customer.maskedPhone.includes('•')) throw new Error('Customer phone was not masked');
    console.log('✅ Staff 1 sees masked customer request in queue');

    console.log('[Test 4.2] Staff 2 (Branch 2) does NOT see Branch 1 Request...');
    const staffQueueRes2 = await fetch(`${BASE_URL}/api/staff/visit-requests`, {
      headers: { Authorization: `Bearer ${staffToken2}` },
    });
    const staffQueueData2 = await staffQueueRes2.json();
    const foundInQueue2 = staffQueueData2.data.find((r: any) => r.id === visitRequestId1);
    if (foundInQueue2) throw new Error('Staff 2 from Branch 2 saw request from Branch 1! Isolation failure');
    console.log('✅ Staff branch isolation verified in queue');

    console.log('[Test 4.3] Inactive Staff is Rejected...');
    const inactiveStaffRes = await fetch(`${BASE_URL}/api/staff/visit-requests`, {
      headers: { Authorization: `Bearer ${staffInactiveToken}` },
    });
    if (inactiveStaffRes.status !== 403) throw new Error(`Expected 403 for inactive staff, got ${inactiveStaffRes.status}`);
    console.log('✅ Inactive staff blocked with 403 Forbidden');

    console.log('[Test 4.4] Staff 2 Cannot Approve Branch 1 Request...');
    const crossBranchApproveRes = await fetch(`${BASE_URL}/api/staff/visit-requests/${visitRequestId1}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken2}` },
    });
    if (crossBranchApproveRes.status !== 403) {
      throw new Error(`Expected 403 for cross-branch approval attempt, got ${crossBranchApproveRes.status}`);
    }
    console.log('✅ Cross-branch approval blocked with 403');

    // 5. REJECTION & RE-REQUEST
    console.log('\n[Test 5.1] Staff 1 Rejects Visit Request...');
    const rejectRes = await fetch(`${BASE_URL}/api/staff/visit-requests/${visitRequestId1}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (rejectRes.status !== 200) throw new Error(`Expected 200, got ${rejectRes.status}`);
    
    // Verify in DB
    const rejectedReqDb = await prisma.visitRequest.findUnique({ where: { id: visitRequestId1 } });
    if (rejectedReqDb?.status !== 'REJECTED') throw new Error('Request was not marked REJECTED');

    // Verify NO visit was created
    const visitCheck1 = await prisma.visit.findUnique({ where: { visitRequestId: visitRequestId1 } });
    if (visitCheck1) throw new Error('Visit record was created on rejection!');
    console.log('✅ Request marked REJECTED, no visit created');

    console.log('[Test 5.2] Customer Can Re-Request After Rejection...');
    const reReqRes = await fetch(`${BASE_URL}/api/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: qrTokenBranch1 }),
    });
    const reReqData = await reReqRes.json();
    if (reReqRes.status !== 201) throw new Error(`Expected 201 for re-request, got ${reReqRes.status}`);
    const visitRequestId2 = reReqData.data.id;
    console.log('✅ Customer successfully created new request after previous was rejected');

    // 6. APPROVAL: VISIT #1 (NONE Milestone) & LAZY CYCLE CREATION
    console.log('\n[Test 6.1] Staff 1 Approves Visit #1 (First Approved Visit)...');
    const approveRes1 = await fetch(`${BASE_URL}/api/staff/visit-requests/${visitRequestId2}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    const approveData1 = await approveRes1.json();
    if (approveRes1.status !== 200) throw new Error(`Expected 200, got ${approveRes1.status}`);
    if (approveData1.data.visitNumberInCycle !== 1) throw new Error('visitNumberInCycle should be 1');
    if (approveData1.data.cycleNumber !== 1) throw new Error('cycleNumber should be 1');
    if (approveData1.data.cycleCompleted !== false) throw new Error('Cycle should not be completed at visit 1');
    if (approveData1.data.newRewardUnlocked !== null) throw new Error('NONE milestone unlocked a reward!');

    // Check DB: Cycle 1 now exists with visitCount = 1
    const activeCycleDb1 = await prisma.loyaltyCycle.findFirst({
      where: { customerProfileId: profileInDb.id, programId: program1.id, status: 'ACTIVE' },
    });
    if (!activeCycleDb1) throw new Error('LoyaltyCycle was not created lazily on first approval');
    if (activeCycleDb1.visitCount !== 1) throw new Error(`Expected cycle visitCount=1, got ${activeCycleDb1.visitCount}`);

    // Check DB: Visit record exists
    const visitDb1 = await prisma.visit.findUnique({ where: { visitRequestId: visitRequestId2 } });
    if (!visitDb1) throw new Error('Visit record was not created');
    console.log('✅ Visit #1 approved: Lazy Cycle 1 created (visitCount=1), Visit record created, NONE milestone handled');

    // 7. CONCURRENCY: SIMULTANEOUS DOUBLE APPROVAL TEST
    console.log('\n[Test 7.1] Testing Concurrency: Simultaneous Approvals of the Same Request...');
    // Create new request
    const concurrentReqRes = await fetch(`${BASE_URL}/api/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: qrTokenBranch1 }),
    });
    const concurrentReqData = await concurrentReqRes.json();
    const concurrentReqId = concurrentReqData.data.id;

    // Fire two simultaneous approvals
    const [compRes1, compRes2] = await Promise.all([
      fetch(`${BASE_URL}/api/staff/visit-requests/${concurrentReqId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken1}` },
      }),
      fetch(`${BASE_URL}/api/staff/visit-requests/${concurrentReqId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken1}` },
      }),
    ]);

    const statuses = [compRes1.status, compRes2.status].sort();
    console.log(`Concurrent Approval Statuses: ${statuses[0]} & ${statuses[1]}`);
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      throw new Error(`Expected exactly one 200 and one 409, got [${statuses[0]}, ${statuses[1]}]`);
    }

    // Verify only ONE Visit was created for this request
    const visitCountForReq = await prisma.visit.count({ where: { visitRequestId: concurrentReqId } });
    if (visitCountForReq !== 1) throw new Error(`Expected 1 Visit for concurrent request, got ${visitCountForReq}`);
    console.log('✅ Concurrency test passed: Exactly one 200, exactly one 409, exactly one Visit created');

    // Visit count is now 2 (Visit #2 reached milestone 2: 20% DISCOUNT)
    // Check if MilestoneReward was unlocked!
    const activeCycleDb2 = await prisma.loyaltyCycle.findFirst({
      where: { customerProfileId: profileInDb.id, programId: program1.id, status: 'ACTIVE' },
      include: { milestoneRewards: true },
    });
    if (activeCycleDb2?.visitCount !== 2) throw new Error(`Expected visitCount=2, got ${activeCycleDb2?.visitCount}`);
    if (activeCycleDb2?.milestoneRewards.length !== 1) {
      throw new Error(`Expected 1 MilestoneReward unlocked at visit 2, got ${activeCycleDb2?.milestoneRewards.length}`);
    }
    const unlockedReward = activeCycleDb2.milestoneRewards[0];
    if (unlockedReward.snapshotRewardType !== RewardType.PERCENT_DISCOUNT) {
      throw new Error('Reward type snapshot mismatch');
    }
    if (Number(unlockedReward.snapshotRewardValue) !== 20) {
      throw new Error('Reward value snapshot mismatch');
    }
    if (unlockedReward.status !== 'UNLOCKED') {
      throw new Error('Reward status should be UNLOCKED');
    }
    console.log('✅ Milestone Reward snapshot created & verified at Visit #2');

    // 8. REWARD REDEMPTION
    console.log('\n[Test 8.1] Staff 1 Redeems the Unlocked Reward...');
    const redeemRes1 = await fetch(`${BASE_URL}/api/staff/rewards/${unlockedReward.id}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    const redeemData1 = await redeemRes1.json();
    if (redeemRes1.status !== 200) throw new Error(`Expected 200, got ${redeemRes1.status}`);
    if (redeemData1.data.status !== 'REDEEMED') throw new Error('Reward status not REDEEMED');

    console.log('[Test 8.2] Attempting to Redeem the Same Reward Again (Duplicate)...');
    const duplicateRedeemRes = await fetch(`${BASE_URL}/api/staff/rewards/${unlockedReward.id}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    if (duplicateRedeemRes.status !== 409) {
      throw new Error(`Expected 409 for already-redeemed reward, got ${duplicateRedeemRes.status}`);
    }
    console.log('✅ Double redemption blocked with 409 Conflict');

    console.log('[Test 8.3] Competitor Staff Cannot Redeem Business A Reward...');
    const competitorRedeemRes = await fetch(`${BASE_URL}/api/staff/rewards/${unlockedReward.id}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffTokenB}` },
    });
    if (competitorRedeemRes.status !== 403) {
      throw new Error(`Expected 403 for competitor redemption, got ${competitorRedeemRes.status}`);
    }
    console.log('✅ Cross-tenant reward redemption blocked with 403');

    // 9. CYCLE COMPLETION & LAZY NEXT CYCLE
    console.log('\n[Test 9.1] Approving Visit #3 (Reaches cycleLength=3)...');
    const reqRes3 = await fetch(`${BASE_URL}/api/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: qrTokenBranch1 }),
    });
    const reqData3 = await reqRes3.json();

    const approveRes3 = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqData3.data.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    const approveData3 = await approveRes3.json();
    if (approveRes3.status !== 200) throw new Error(`Expected 200, got ${approveRes3.status}`);
    if (approveData3.data.cycleCompleted !== true) throw new Error('Cycle should be marked completed at visit 3');

    // Verify Cycle 1 is COMPLETED in DB
    const cycle1Db = await prisma.loyaltyCycle.findUnique({ where: { id: activeCycleDb1.id } });
    if (cycle1Db?.status !== 'COMPLETED') throw new Error('Cycle 1 status is not COMPLETED in DB');
    if (!cycle1Db?.completedAt) throw new Error('completedAt timestamp missing on Cycle 1');

    // CRITICAL: Verify NO empty Cycle 2 was created immediately!
    const activeCycleCheckAfterCompletion = await prisma.loyaltyCycle.findFirst({
      where: { customerProfileId: profileInDb.id, programId: program1.id, status: 'ACTIVE' },
    });
    if (activeCycleCheckAfterCompletion !== null) {
      throw new Error('CRITICAL: Empty Cycle 2 was immediately created on cycle completion! Expected null');
    }
    console.log('✅ Cycle 1 COMPLETED. Zero empty cycles created immediately after completion!');

    console.log('[Test 9.2] Customer Submits Visit Request for Cycle 2...');
    const reqRes4 = await fetch(`${BASE_URL}/api/customer/visit-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrToken: qrTokenBranch1 }),
    });
    const reqData4 = await reqRes4.json();

    const approveRes4 = await fetch(`${BASE_URL}/api/staff/visit-requests/${reqData4.data.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken1}` },
    });
    const approveData4 = await approveRes4.json();
    if (approveRes4.status !== 200) throw new Error(`Expected 200, got ${approveRes4.status}`);
    if (approveData4.data.cycleNumber !== 2) throw new Error(`Expected cycleNumber=2, got ${approveData4.data.cycleNumber}`);
    if (approveData4.data.visitNumberInCycle !== 1) {
      throw new Error(`Expected visitNumberInCycle=1 in new cycle, got ${approveData4.data.visitNumberInCycle}`);
    }

    // Verify Cycle 2 exists in DB with visitCount = 1
    const cycle2Db = await prisma.loyaltyCycle.findFirst({
      where: { customerProfileId: profileInDb.id, programId: program1.id, status: 'ACTIVE' },
    });
    if (!cycle2Db || cycle2Db.cycleNumber !== 2 || cycle2Db.visitCount !== 1) {
      throw new Error('Cycle 2 lazy creation failed on next visit approval');
    }
    console.log('✅ Next Cycle 2 lazily created on next approved visit with cycleNumber=2 & visitCount=1');

    // 10. CUSTOMER HISTORY ENDPOINT
    console.log('\n[Test 10.1] Customer History Endpoint Verification...');
    const historyRes = await fetch(`${BASE_URL}/api/customer/history`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const historyData = await historyRes.json();
    if (historyRes.status !== 200) throw new Error(`Expected 200, got ${historyRes.status}`);
    const bizHistory = historyData.data.find((b: any) => b.business.id === businessA.id);
    if (!bizHistory) throw new Error('Business A history missing');
    if (bizHistory.cycles.length !== 2) throw new Error(`Expected 2 cycles in history, got ${bizHistory.cycles.length}`);
    console.log('✅ Customer history verified (contains completed Cycle 1 and active Cycle 2)');

    console.log('\n=============================================================');
    console.log('🎉 ALL INTEGRATION & VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================================\n');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runVerification();
