import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import { UserRole } from '@prisma/client';
import { generateAccessToken } from './utils/auth.utils';

const PORT = 5056;
const BASE_URL = `http://localhost:${PORT}`;

async function runVerification() {
  console.log('--- STARTING BUSINESS & BRANCH VERIFICATION ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on ${BASE_URL}`);

  try {
    const timestamp = Date.now();

    // 1. Create two separate businesses for tenant isolation testing
    console.log('\n[1] Creating Owner A and Business A...');
    const regResA = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `owner_a_${timestamp}@test.com`,
        password: 'Password123!',
        businessName: 'Business A Corp',
        businessType: 'Restaurant',
      }),
    });
    const regDataA = await regResA.json();
    if (regResA.status !== 201) throw new Error('Registration A failed: ' + JSON.stringify(regDataA));
    const tokenA = regDataA.data.accessToken;
    const businessAId = regDataA.data.business.id;

    console.log('\n[2] Creating Owner B and Business B (Isolation Partner)...');
    const regResB = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `owner_b_${timestamp}@test.com`,
        password: 'Password123!',
        businessName: 'Business B Corp',
        businessType: 'Salon',
      }),
    });
    const regDataB = await regResB.json();
    if (regResB.status !== 201) throw new Error('Registration B failed: ' + JSON.stringify(regDataB));
    const tokenB = regDataB.data.accessToken;
    const businessBId = regDataB.data.business.id;

    console.log(`Business A: ${businessAId}, Business B: ${businessBId}`);

    // 2. Test GET /api/business
    console.log('\n[3] Testing GET /api/business for Owner A...');
    const getBizRes = await fetch(`${BASE_URL}/api/business`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const getBizData = await getBizRes.json();
    console.log('Status:', getBizRes.status);
    console.log('Business A:', getBizData);
    if (getBizRes.status !== 200) throw new Error('GET /api/business failed');
    if (getBizData.data.business.id !== businessAId) throw new Error('Mismatched business ID');
    if (getBizData.data.business.name !== 'Business A Corp') throw new Error('Mismatched business name');
    if (getBizData.data.business.branchCount !== 0) throw new Error('Expected 0 branches initially');
    console.log('✅ GET /api/business passed');

    // 3. Test Unauthenticated & Staff Access to /api/business
    console.log('\n[4] Testing Authorization Guards on /api/business...');
    const noAuthBizRes = await fetch(`${BASE_URL}/api/business`);
    if (noAuthBizRes.status !== 401) throw new Error('Expected 401 for missing token');

    const fakeStaffToken = generateAccessToken({
      userId: 'fake-staff-id',
      role: UserRole.STAFF,
      businessId: businessAId,
    });
    const staffBizRes = await fetch(`${BASE_URL}/api/business`, {
      headers: { Authorization: `Bearer ${fakeStaffToken}` },
    });
    if (staffBizRes.status !== 403) throw new Error('Expected 403 for STAFF attempting OWNER route');
    console.log('✅ Authorization guards on /api/business passed');

    // 4. Test PATCH /api/business
    console.log('\n[5] Testing PATCH /api/business...');
    const patchBizRes = await fetch(`${BASE_URL}/api/business`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Business A Updated',
        type: 'Fine Dining Cafe',
      }),
    });
    const patchBizData = await patchBizRes.json();
    console.log('PATCH Status:', patchBizRes.status);
    if (patchBizRes.status !== 200) throw new Error('PATCH /api/business failed: ' + JSON.stringify(patchBizData));
    if (patchBizData.data.business.name !== 'Business A Updated') throw new Error('Business name was not updated');
    if (patchBizData.data.business.type !== 'Fine Dining Cafe') throw new Error('Business type was not updated');
    console.log('✅ PATCH /api/business passed');

    // Test Zod validation rejection on empty update
    const emptyPatchBizRes = await fetch(`${BASE_URL}/api/business`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({}),
    });
    if (emptyPatchBizRes.status !== 400) throw new Error('Expected 400 for empty PATCH payload');
    console.log('✅ Zod validation on empty PATCH /api/business passed');

    // 5. Test POST /api/branches (Create Branch 1 for Business A)
    console.log('\n[6] Testing POST /api/branches (Branch 1 for Business A)...');
    const createBranch1Res = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Downtown Main Branch',
        address: '100 Main Street, Suite 4',
      }),
    });
    const createBranch1Data = await createBranch1Res.json();
    console.log('Create Branch 1 Status:', createBranch1Res.status);
    if (createBranch1Res.status !== 201) throw new Error('POST /api/branches failed: ' + JSON.stringify(createBranch1Data));
    const branch1 = createBranch1Data.data.branch;
    if (!branch1.id) throw new Error('Missing branch id');
    if (branch1.businessId !== businessAId) throw new Error('Branch not scoped to Business A');
    if (!branch1.qrToken || typeof branch1.qrToken !== 'string') throw new Error('Missing or invalid qrToken');
    if (branch1.isActive !== true) throw new Error('New branch must be active by default');
    console.log('✅ Branch 1 created with qrToken:', branch1.qrToken);

    // Create Branch 2 for Business A
    console.log('\n[7] Testing POST /api/branches (Branch 2 for Business A)...');
    const createBranch2Res = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Westside Mall Branch',
        address: '250 West Mall Rd',
      }),
    });
    const createBranch2Data = await createBranch2Res.json();
    const branch2 = createBranch2Data.data.branch;
    if (branch1.qrToken === branch2.qrToken) throw new Error('qrToken must be globally unique across branches!');
    console.log('✅ Branch 2 created with unique qrToken:', branch2.qrToken);

    // Create Branch 3 for Business B
    console.log('\n[8] Testing POST /api/branches (Branch for Business B)...');
    const createBranchBRes = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        name: 'Salon B Uptown',
        address: '88 Fashion Ave',
      }),
    });
    const createBranchBData = await createBranchBRes.json();
    const branchB = createBranchBData.data.branch;
    if (branchB.businessId !== businessBId) throw new Error('Branch B not scoped to Business B');
    console.log('✅ Branch for Business B created');

    // 6. Test GET /api/branches
    console.log('\n[9] Testing GET /api/branches for Owner A...');
    const listBranchesARes = await fetch(`${BASE_URL}/api/branches`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listBranchesAData = await listBranchesARes.json();
    console.log('List Branches A count:', listBranchesAData.data.branches.length);
    if (listBranchesAData.data.branches.length !== 2) throw new Error('Owner A should see exactly 2 branches');
    const hasBranchBInA = listBranchesAData.data.branches.some((b: any) => b.id === branchB.id);
    if (hasBranchBInA) throw new Error('TENANT ISOLATION FAILURE: Business B branch appeared in Business A list!');
    console.log('✅ GET /api/branches tenant isolation passed');

    // 7. Test GET /api/branches/:id
    console.log('\n[10] Testing GET /api/branches/:id...');
    const getB1Res = await fetch(`${BASE_URL}/api/branches/${branch1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const getB1Data = await getB1Res.json();
    if (getB1Res.status !== 200 || getB1Data.data.branch.id !== branch1.id) throw new Error('GET /api/branches/:id failed');
    console.log('✅ GET /api/branches/:id passed for owner');

    // Cross-tenant access attempt: Owner B tries to GET Branch 1 (which belongs to A)
    console.log('\n[11] Testing Cross-Tenant Access: Owner B requests Branch 1...');
    const crossGetRes = await fetch(`${BASE_URL}/api/branches/${branch1.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (crossGetRes.status !== 404) throw new Error(`TENANT ISOLATION FAILURE: Cross-tenant GET returned status ${crossGetRes.status}, expected 404`);
    console.log('✅ Cross-tenant GET successfully blocked with 404');

    // 8. Test PATCH /api/branches/:id
    console.log('\n[12] Testing PATCH /api/branches/:id...');
    const patchB1Res = await fetch(`${BASE_URL}/api/branches/${branch1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Downtown Flagship Branch',
        address: '100 Main Street, Ground Floor',
      }),
    });
    const patchB1Data = await patchB1Res.json();
    if (patchB1Res.status !== 200) throw new Error('PATCH /api/branches/:id failed');
    if (patchB1Data.data.branch.name !== 'Downtown Flagship Branch') throw new Error('Branch name not updated');
    console.log('✅ PATCH /api/branches/:id passed');

    // Cross-tenant patch attempt: Owner B tries to PATCH Branch 1
    console.log('\n[13] Testing Cross-Tenant PATCH: Owner B attempts to edit Branch 1...');
    const crossPatchRes = await fetch(`${BASE_URL}/api/branches/${branch1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        name: 'Hacked Branch Name',
      }),
    });
    if (crossPatchRes.status !== 404) throw new Error(`TENANT ISOLATION FAILURE: Cross-tenant PATCH returned ${crossPatchRes.status}, expected 404`);
    console.log('✅ Cross-tenant PATCH successfully blocked with 404');

    // 9. Test PATCH /api/branches/:id/status (Soft Deactivate and Reactivate)
    console.log('\n[14] Testing PATCH /api/branches/:id/status (Deactivation)...');
    const deactivateRes = await fetch(`${BASE_URL}/api/branches/${branch1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        isActive: false,
      }),
    });
    const deactivateData = await deactivateRes.json();
    if (deactivateRes.status !== 200) throw new Error('Deactivate branch failed');
    if (deactivateData.data.branch.isActive !== false) throw new Error('Branch isActive was not set to false');
    console.log('✅ Branch soft deactivated (isActive: false)');

    // Verify branch still exists in DB and list (not hard deleted!)
    const verifyListRes = await fetch(`${BASE_URL}/api/branches/${branch1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const verifyListData = await verifyListRes.json();
    if (verifyListData.data.branch.isActive !== false) throw new Error('Branch should remain in database with isActive: false');
    console.log('✅ Verified branch was preserved in DB (no hard delete)');

    // Reactivate branch
    console.log('\n[15] Testing PATCH /api/branches/:id/status (Reactivation)...');
    const reactivateRes = await fetch(`${BASE_URL}/api/branches/${branch1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        isActive: true,
      }),
    });
    const reactivateData = await reactivateRes.json();
    if (reactivateRes.status !== 200 || reactivateData.data.branch.isActive !== true) throw new Error('Reactivate branch failed');
    console.log('✅ Branch reactivated (isActive: true)');

    // Cross-tenant status toggle attempt: Owner B tries to deactivate Branch 1
    console.log('\n[16] Testing Cross-Tenant Status Toggle: Owner B attempts to deactivate Branch 1...');
    const crossStatusRes = await fetch(`${BASE_URL}/api/branches/${branch1.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        isActive: false,
      }),
    });
    if (crossStatusRes.status !== 404) throw new Error(`TENANT ISOLATION FAILURE: Cross-tenant status toggle returned ${crossStatusRes.status}, expected 404`);
    console.log('✅ Cross-tenant status toggle successfully blocked with 404');

    console.log('\n=========================================');
    console.log('🎉 ALL BACKEND BUSINESS & BRANCH TESTS PASSED!');
    console.log('=========================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runVerification().catch((err) => {
  console.error('❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
