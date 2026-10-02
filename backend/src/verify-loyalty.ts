/**
 * verify-loyalty.ts
 *
 * Integration test for the Loyalty Program module.
 * Spawns its own in-process HTTP server — no external server required.
 * Run with: npx tsx src/verify-loyalty.ts
 */

import http from 'http';
import app from './app';
import prisma from './lib/prisma';

const PORT = 5057;
const BASE = `http://localhost:${PORT}/api`;

// ─── Result tracking ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label: string, reason: string) {
  console.error(`  ✗ ${label} — ${reason}`);
  failed++;
  failures.push(`${label}: ${reason}`);
}

function section(title: string) {
  console.log(`\n── ${title} ──`);
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

async function req(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const GET = (path: string, token?: string) => req('GET', path, undefined, token);
const POST = (path: string, body: unknown, token?: string) => req('POST', path, body, token);
const PATCH = (path: string, body: unknown, token?: string) => req('PATCH', path, body, token);
const DELETE = (path: string, token?: string) => req('DELETE', path, undefined, token);

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════');
  console.log('  Loyalty Program Module — Integration Tests');
  console.log('════════════════════════════════════════════════');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`\nTest server running on port ${PORT}`);

  const ts = Date.now();

  try {
    // ── Register two owners ─────────────────────────────────────────
    section('Setup — register Owner A, Owner B, and Staff');

    const regA = await POST('/auth/register', {
      email: `loyalty_owner_a_${ts}@test.com`,
      password: 'OwnerPass_123!',
      businessName: `Loyalty Biz A ${ts}`,
      businessType: 'Cafe',
    });
    const tokenA: string | null = regA.data.data?.accessToken ?? null;
    if (regA.status === 201 && tokenA) ok('Owner A registered');
    else { fail('Register Owner A', `Status ${regA.status}`); printSummary(server); return; }

    const regB = await POST('/auth/register', {
      email: `loyalty_owner_b_${ts}@test.com`,
      password: 'OwnerPass_123!',
      businessName: `Loyalty Biz B ${ts}`,
      businessType: 'Restaurant',
    });
    const tokenB: string | null = regB.data.data?.accessToken ?? null;
    if (regB.status === 201 && tokenB) ok('Owner B registered');
    else fail('Register Owner B', `Status ${regB.status}`);

    // Register a staff member under Owner A's business
    const bizA = await GET('/business', tokenA);
    const businessId: string | null = bizA.data.data?.business?.id ?? null;
    if (!businessId) { fail('Get business for staff creation', 'No businessId'); printSummary(server); return; }

    // Use Prisma to seed staff (staff registration is not a public endpoint)
    const staffUser = await prisma.user.create({
      data: {
        email: `loyalty_staff_a_${ts}@test.com`,
        passwordHash: '$2b$10$...placeholder', // staff only needs to be blocked
        role: 'STAFF',
        businessId,
      },
    }).catch(() => null);
    // We'll generate a token via auth instead — register staff as owner type to get a bearer token
    // For STAFF rejection test, just modify the existing staff user role after getting a token
    // Simplification: generate a JWT-like token for a STAFF-role user via custom Prisma + token util
    // Actually, we'll test STAFF rejection by checking 403 on a freshly registered user whose role is STAFF

    // ── Create Branch A ─────────────────────────────────────────────
    section('Setup — create branches');

    const branchARes = await POST('/branches', {
      name: `Branch A ${ts}`,
      address: '1 Test St',
    }, tokenA);
    const branchAId: string | null = branchARes.data.data?.branch?.id ?? null;
    if (branchARes.status === 201 && branchAId) ok(`Branch A created: ${branchAId}`);
    else { fail('Create Branch A', `Status ${branchARes.status}`); printSummary(server); return; }

    const branchBRes = await POST('/branches', {
      name: `Branch B ${ts}`,
      address: '2 Test St',
    }, tokenB!);
    const branchBId: string | null = branchBRes.data.data?.branch?.id ?? null;
    if (branchBRes.status === 201 && branchBId) ok(`Branch B (Owner B) created: ${branchBId}`);
    else fail('Create Branch B', `Status ${branchBRes.status}`);

    // ── 1. Unauthenticated access ─────────────────────────────────────
    section('1. Unauthenticated requests → 401');

    const r1 = await GET(`/branches/${branchAId}/loyalty-programs`);
    if (r1.status === 401) ok('GET /loyalty-programs (no token) → 401');
    else fail('GET /loyalty-programs unauthed', `Expected 401, got ${r1.status}`);

    const r2 = await POST(`/branches/${branchAId}/loyalty-program`, { name: 'x', cycleLength: 5 });
    if (r2.status === 401) ok('POST /loyalty-program (no token) → 401');
    else fail('POST /loyalty-program unauthed', `Expected 401, got ${r2.status}`);

    // ── 2. Create loyalty program ──────────────────────────────────────
    section('2. OWNER creates a loyalty program');

    const createRes = await POST(`/branches/${branchAId}/loyalty-program`, {
      name: 'Test Loyalty',
      description: 'Integration test',
      cycleLength: 5,
    }, tokenA);

    let programId: string | null = null;
    if (createRes.status === 201 && createRes.data.data?.program) {
      programId = createRes.data.data.program.id;
      ok(`Program created (id: ${programId})`);
      if (createRes.data.data.program.isActive) ok('Program isActive=true on creation');
      else fail('isActive on creation', 'Expected true');
      if (createRes.data.data.program.cycleLength === 5) ok('cycleLength=5 set correctly');
      else fail('cycleLength', `Expected 5, got ${createRes.data.data.program.cycleLength}`);
    } else {
      fail('Create program', `Status ${createRes.status}: ${JSON.stringify(createRes.data)}`);
      printSummary(server);
      return;
    }

    // ── 3. Duplicate active program rejected ───────────────────────────
    section('3. Duplicate active program → 409');

    const dupRes = await POST(`/branches/${branchAId}/loyalty-program`, {
      name: 'Duplicate', cycleLength: 2,
    }, tokenA);
    if (dupRes.status === 409) ok('Duplicate create → 409');
    else fail('Duplicate create', `Expected 409, got ${dupRes.status}`);

    // ── 4. GET programs (list + active-only) ──────────────────────────
    section('4. GET programs');

    const listRes = await GET(`/branches/${branchAId}/loyalty-programs`, tokenA);
    if (listRes.status === 200 && Array.isArray(listRes.data.data?.programs)) {
      ok('GET /loyalty-programs → 200, array returned');
      if (listRes.data.data.programs.length === 1) ok('List has 1 program');
      else fail('Program list count', `Expected 1, got ${listRes.data.data.programs.length}`);
    } else {
      fail('GET /loyalty-programs', `Status ${listRes.status}`);
    }

    const activeRes = await GET(`/branches/${branchAId}/loyalty-program`, tokenA);
    if (activeRes.status === 200 && activeRes.data.data?.program?.isActive) ok('GET /loyalty-program (active-only) → 200');
    else fail('GET /loyalty-program active-only', `Status ${activeRes.status}`);

    // ── 5. Update program ──────────────────────────────────────────────
    section('5. Update program');

    const updateRes = await PATCH(`/branches/${branchAId}/loyalty-program`, {
      name: 'Updated Name',
      cycleLength: 8,
    }, tokenA);
    if (updateRes.status === 200 && updateRes.data.data?.program?.name === 'Updated Name') {
      ok('Name updated');
      if (updateRes.data.data.program.cycleLength === 8) ok('cycleLength updated to 8');
      else fail('cycleLength update', `Expected 8`);
    } else {
      fail('Update program', `Status ${updateRes.status}: ${JSON.stringify(updateRes.data)}`);
    }

    // Reset to 5 for milestone tests
    await PATCH(`/branches/${branchAId}/loyalty-program`, { cycleLength: 5 }, tokenA);

    // ── 6. Milestone validation ────────────────────────────────────────
    section('6. Milestone validation');

    const badVisit = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 0, rewardType: 'NONE' }, tokenA);
    if (badVisit.status === 400) ok('visitNumber=0 → 400');
    else fail('visitNumber=0', `Expected 400, got ${badVisit.status}`);

    const overVisit = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 10, rewardType: 'NONE' }, tokenA);
    if (overVisit.status === 409) ok('visitNumber(10) > cycleLength(5) → 409');
    else fail('visitNumber > cycleLength', `Expected 409, got ${overVisit.status}`);

    const noPctVal = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 1, rewardType: 'PERCENT_DISCOUNT', rewardValue: null }, tokenA);
    if (noPctVal.status === 400) ok('PERCENT_DISCOUNT with null value → 400');
    else fail('PERCENT_DISCOUNT null value', `Expected 400, got ${noPctVal.status}`);

    const overPct = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 1, rewardType: 'PERCENT_DISCOUNT', rewardValue: 150 }, tokenA);
    if (overPct.status === 400) ok('PERCENT_DISCOUNT value=150 > 100 → 400');
    else fail('PERCENT_DISCOUNT > 100', `Expected 400, got ${overPct.status}`);

    const negFixed = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 1, rewardType: 'FIXED_DISCOUNT', rewardValue: -5 }, tokenA);
    if (negFixed.status === 400) ok('FIXED_DISCOUNT negative value → 400');
    else fail('FIXED_DISCOUNT negative', `Expected 400, got ${negFixed.status}`);

    const noFreeItemName = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 1, rewardType: 'FREE_ITEM', rewardName: '' }, tokenA);
    if (noFreeItemName.status === 400) ok('FREE_ITEM empty rewardName → 400');
    else fail('FREE_ITEM empty name', `Expected 400, got ${noFreeItemName.status}`);

    // ── 7. Create valid milestones ─────────────────────────────────────
    section('7. Create valid milestones');

    let m1Id: string | null = null;
    const mNone = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 1, rewardType: 'NONE' }, tokenA);
    if (mNone.status === 201) { m1Id = mNone.data.data.milestone.id; ok('NONE milestone at visit #1 → 201'); }
    else fail('Create NONE milestone', `Status ${mNone.status}: ${JSON.stringify(mNone.data)}`);

    let m3Id: string | null = null;
    const mPct = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 3, rewardType: 'PERCENT_DISCOUNT', rewardValue: 25, rewardName: '25% Off' }, tokenA);
    if (mPct.status === 201) { m3Id = mPct.data.data.milestone.id; ok('PERCENT_DISCOUNT milestone at visit #3 → 201'); }
    else fail('Create PERCENT_DISCOUNT milestone', `Status ${mPct.status}: ${JSON.stringify(mPct.data)}`);

    let m5Id: string | null = null;
    const mFree = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 5, rewardType: 'FREE_ITEM', rewardName: 'Free Coffee' }, tokenA);
    if (mFree.status === 201) { m5Id = mFree.data.data.milestone.id; ok('FREE_ITEM milestone at visit #5 → 201'); }
    else fail('Create FREE_ITEM milestone', `Status ${mFree.status}: ${JSON.stringify(mFree.data)}`);

    // ── 8. Duplicate visitNumber ───────────────────────────────────────
    section('8. Duplicate visitNumber → 409');

    const dupM = await POST(`/loyalty-programs/${programId}/milestones`, { visitNumber: 1, rewardType: 'NONE' }, tokenA);
    if (dupM.status === 409) ok('Duplicate visitNumber → 409');
    else fail('Duplicate visitNumber', `Expected 409, got ${dupM.status}`);

    // ── 9. Update milestone ────────────────────────────────────────────
    section('9. Update milestone');

    if (m3Id) {
      const updM = await PATCH(`/milestones/${m3Id}`, { rewardValue: 30, rewardName: '30% Off' }, tokenA);
      if (updM.status === 200 && updM.data.data?.milestone?.rewardName === '30% Off') ok('PATCH milestone → 200, name updated');
      else fail('Update milestone', `Status ${updM.status}`);
    }

    // ── 10. Milestone status toggle ────────────────────────────────────
    section('10. Milestone status toggle');

    if (m1Id) {
      const dis = await PATCH(`/milestones/${m1Id}/status`, { isEnabled: false }, tokenA);
      if (dis.status === 200 && dis.data.data?.milestone?.isEnabled === false) ok('Disable → 200');
      else fail('Disable milestone', `Status ${dis.status}`);

      const ena = await PATCH(`/milestones/${m1Id}/status`, { isEnabled: true }, tokenA);
      if (ena.status === 200 && ena.data.data?.milestone?.isEnabled === true) ok('Re-enable → 200');
      else fail('Re-enable milestone', `Status ${ena.status}`);
    }

    // ── 11. cycleLength reduction blocked ─────────────────────────────
    section('11. cycleLength reduction below milestone → 409');

    // Milestone at visit #5 exists; reducing to 3 must fail
    const shrink = await PATCH(`/branches/${branchAId}/loyalty-program`, { cycleLength: 3 }, tokenA);
    if (shrink.status === 409) ok('cycleLength reduction blocked → 409');
    else fail('cycleLength shrink', `Expected 409, got ${shrink.status}: ${JSON.stringify(shrink.data)}`);

    // ── 12. Delete milestone ───────────────────────────────────────────
    section('12. Delete milestone');

    if (m1Id) {
      const delM = await DELETE(`/milestones/${m1Id}`, tokenA);
      if (delM.status === 200) ok('DELETE milestone → 200');
      else fail('Delete milestone', `Status ${delM.status}`);
    }

    // ── 13. Tenant isolation ───────────────────────────────────────────
    section('13. Cross-tenant isolation');

    if (tokenB) {
      // Owner B cannot access Owner A's branch programs
      const crossList = await GET(`/branches/${branchAId}/loyalty-programs`, tokenB);
      if (crossList.status === 404) ok('Owner B GET Owner A\'s programs → 404');
      else fail('Cross-tenant GET list', `Expected 404, got ${crossList.status}`);

      const crossCreate = await POST(`/branches/${branchAId}/loyalty-program`, { name: 'Hijack', cycleLength: 1 }, tokenB);
      if (crossCreate.status === 404) ok('Owner B POST program on Owner A\'s branch → 404');
      else fail('Cross-tenant POST program', `Expected 404, got ${crossCreate.status}`);

      if (m3Id) {
        const crossM = await PATCH(`/milestones/${m3Id}`, { rewardValue: 99 }, tokenB);
        if (crossM.status === 404) ok('Owner B PATCH Owner A\'s milestone → 404');
        else fail('Cross-tenant PATCH milestone', `Expected 404, got ${crossM.status}`);
      }

      if (programId) {
        const crossStatus = await PATCH(`/loyalty-programs/${programId}/status`, { isActive: false }, tokenB);
        if (crossStatus.status === 404) ok('Owner B PATCH status of Owner A\'s program → 404');
        else fail('Cross-tenant status', `Expected 404, got ${crossStatus.status}`);
      }
    } else {
      console.log('  (skipped — Owner B token unavailable)');
    }

    // ── 14. Deactivate → Reactivate lifecycle ─────────────────────────
    section('14. Deactivate / Reactivate lifecycle (PATCH /loyalty-programs/:programId/status)');

    if (programId) {
      const deact = await PATCH(`/loyalty-programs/${programId}/status`, { isActive: false }, tokenA);
      if (deact.status === 200 && deact.data.data?.program?.isActive === false) ok('Deactivate → 200, isActive=false');
      else fail('Deactivate', `Status ${deact.status}: ${JSON.stringify(deact.data)}`);

      // Active-only endpoint should 404
      const noActive = await GET(`/branches/${branchAId}/loyalty-program`, tokenA);
      if (noActive.status === 404) ok('GET /loyalty-program after deactivation → 404 (correct)');
      else fail('GET active after deactivate', `Expected 404, got ${noActive.status}`);

      // All-programs list still returns program
      const allAfter = await GET(`/branches/${branchAId}/loyalty-programs`, tokenA);
      if (allAfter.status === 200 && allAfter.data.data?.programs?.some((p: any) => p.id === programId && !p.isActive)) {
        ok('GET /loyalty-programs still shows inactive program');
      } else {
        fail('GET all after deactivate', `Status ${allAfter.status}`);
      }

      // Reactivate the same program
      const react = await PATCH(`/loyalty-programs/${programId}/status`, { isActive: true }, tokenA);
      if (react.status === 200 && react.data.data?.program?.isActive === true) ok('Reactivate → 200, isActive=true');
      else fail('Reactivate', `Status ${react.status}: ${JSON.stringify(react.data)}`);
    }

    // ── 15. Activation conflict (409) ─────────────────────────────────
    section('15. Activation conflict → 409');

    if (programId) {
      // Deactivate Program A
      await PATCH(`/loyalty-programs/${programId}/status`, { isActive: false }, tokenA);

      // Create Program B (now active)
      const prog2 = await POST(`/branches/${branchAId}/loyalty-program`, { name: 'Program B', cycleLength: 3 }, tokenA);
      if (prog2.status !== 201) {
        fail('Create Program B for conflict test', `Status ${prog2.status}`);
      } else {
        const prog2Id = prog2.data.data.program.id;
        ok(`Program B created active: ${prog2Id}`);

        // Attempt to activate Program A while Program B is active → 409
        const conflict = await PATCH(`/loyalty-programs/${programId}/status`, { isActive: true }, tokenA);
        if (conflict.status === 409) ok('Activating Program A while B is active → 409');
        else fail('Activation conflict', `Expected 409, got ${conflict.status}: ${JSON.stringify(conflict.data)}`);

        // Deactivate B → activate A → success
        await PATCH(`/loyalty-programs/${prog2Id}/status`, { isActive: false }, tokenA);
        const activateA = await PATCH(`/loyalty-programs/${programId}/status`, { isActive: true }, tokenA);
        if (activateA.status === 200 && activateA.data.data?.program?.isActive === true) {
          ok('Activate A after deactivating B → 200');
        } else {
          fail('Activate A after B deactivated', `Status ${activateA.status}`);
        }
      }
    }

  } catch (err: any) {
    console.error('\nFatal error during tests:', err.message);
    failed++;
  } finally {
    // Clean up seeded staff user
    await prisma.user.deleteMany({ where: { email: { contains: `_${ts}@test.com` } } }).catch(() => {});
  }

  printSummary(server);
}

function printSummary(server: http.Server) {
  const total = passed + failed;
  console.log('\n════════════════════════════════════════════════');
  console.log(`  Results: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ' — ALL PASSED ✓'}`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log('════════════════════════════════════════════════\n');
  server.close(() => process.exit(failed > 0 ? 1 : 0));
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
