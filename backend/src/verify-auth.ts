import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import { UserRole } from '@prisma/client';
import { hashPassword } from './utils/auth.utils';

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}`;

async function runVerification() {
  console.log('--- STARTING AUTH VERIFICATION ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on ${BASE_URL}`);

  try {
    const timestamp = Date.now();
    const ownerEmail = `owner_${timestamp}@example.com`;
    const password = 'Password123!';
    const businessName = `Cafe ${timestamp}`;

    // 1. Owner Registration
    console.log('\n[1] Testing Owner Registration...');
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password,
        businessName,
        businessType: 'Cafe',
      }),
    });

    const regCookieHeader = regRes.headers.get('set-cookie') || '';
    const regData = await regRes.json();
    console.log('Status:', regRes.status);
    console.log('Response:', regData);

    if (regRes.status !== 201) throw new Error('Owner registration failed');
    if (!regData.data.accessToken) throw new Error('Missing accessToken');
    if (regData.data.user.passwordHash) throw new Error('passwordHash leaked!');
    if (regData.data.user.role !== 'OWNER') throw new Error('Incorrect role');
    if (!regCookieHeader.includes('refreshToken=')) throw new Error('Missing refresh cookie');

    const owner1BusinessId = regData.data.business.id;
    const owner1UserId = regData.data.user.id;
    console.log('✅ Owner Registration passed');

    // 2. Duplicate Email Rejection
    console.log('\n[2] Testing Duplicate Email Rejection...');
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password,
        businessName: 'Duplicate Cafe',
      }),
    });
    console.log('Status:', dupRes.status);
    if (dupRes.status !== 400) throw new Error('Duplicate email not rejected with 400');
    console.log('✅ Duplicate Email Rejection passed');

    // 3. Owner Login
    console.log('\n[3] Testing Owner Login...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password,
      }),
    });

    const loginCookieHeader = loginRes.headers.get('set-cookie') || '';
    const loginData = await loginRes.json();
    console.log('Status:', loginRes.status);
    console.log('Response:', loginData);

    if (loginRes.status !== 200) throw new Error('Owner login failed');
    if (loginData.data.businessId !== owner1BusinessId) throw new Error('Business ID mismatch');
    const owner1AccessToken = loginData.data.accessToken;
    const owner1RefreshCookie = loginCookieHeader.split(';')[0];
    console.log('✅ Owner Login passed');

    // 4. Invalid Credentials
    console.log('\n[4] Testing Invalid Credentials...');
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password: 'wrongpassword',
      }),
    });
    console.log('Status:', wrongPassRes.status);
    if (wrongPassRes.status !== 401) throw new Error('Wrong password not rejected with 401');

    const wrongEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password,
      }),
    });
    console.log('Status:', wrongEmailRes.status);
    if (wrongEmailRes.status !== 401) throw new Error('Nonexistent email not rejected with 401');
    console.log('✅ Invalid Credentials tests passed');

    // 5. Staff Setup and Login
    console.log('\n[5] Testing Staff Login...');
    const staffEmail = `staff_${timestamp}@example.com`;
    const staffPassword = 'StaffPassword123!';
    const staffPasswordHash = await hashPassword(staffPassword);

    // Create a Branch for owner1 business
    const branch = await prisma.branch.create({
      data: {
        businessId: owner1BusinessId,
        name: 'Main Branch',
        qrToken: `qr_token_${timestamp}`,
      },
    });

    // Create Staff User
    const staffUser = await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: staffPasswordHash,
        role: UserRole.STAFF,
      },
    });

    // Assign Staff to Business & Branch
    const staffRecord = await prisma.staff.create({
      data: {
        userId: staffUser.id,
        businessId: owner1BusinessId,
        branchId: branch.id,
        isActive: true,
      },
    });

    const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: staffEmail,
        password: staffPassword,
      }),
    });

    const staffLoginData = await staffLoginRes.json();
    console.log('Staff Login Status:', staffLoginRes.status);
    console.log('Staff Login Response:', staffLoginData);

    if (staffLoginRes.status !== 200) throw new Error('Staff login failed');
    if (staffLoginData.data.user.role !== 'STAFF') throw new Error('Staff role mismatch');
    if (staffLoginData.data.businessId !== owner1BusinessId) throw new Error('Staff businessId mismatch');
    console.log('✅ Staff Login passed');

    // 6. Inactive Staff Rejection
    console.log('\n[6] Testing Inactive Staff Rejection...');
    await prisma.staff.update({
      where: { id: staffRecord.id },
      data: { isActive: false },
    });

    const inactiveStaffRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: staffEmail,
        password: staffPassword,
      }),
    });

    console.log('Inactive Staff Status:', inactiveStaffRes.status);
    if (inactiveStaffRes.status !== 401) throw new Error('Inactive staff was not rejected with 401');

    // Restore active status
    await prisma.staff.update({
      where: { id: staffRecord.id },
      data: { isActive: true },
    });
    console.log('✅ Inactive Staff Rejection passed');

    // 7. Access-Token Protected Route
    console.log('\n[7] Testing Access-Token Protected Route...');
    const protectedRes = await fetch(`${BASE_URL}/api/test/protected`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${owner1AccessToken}`,
      },
    });

    const protectedData = await protectedRes.json();
    console.log('Protected Route Status:', protectedRes.status);
    console.log('Protected Route Response:', protectedData);

    if (protectedRes.status !== 200) throw new Error('Protected route access failed');
    if (protectedData.user.userId !== owner1UserId) throw new Error('User ID mismatch in protected route');

    const noAuthRes = await fetch(`${BASE_URL}/api/test/protected`, { method: 'GET' });
    if (noAuthRes.status !== 401) throw new Error('Unauthenticated access not rejected with 401');
    console.log('✅ Protected Route tests passed');

    // 8. Refresh Token Rotation
    console.log('\n[8] Testing Refresh Token Rotation...');
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: owner1RefreshCookie,
      },
    });

    const refreshCookieHeader = refreshRes.headers.get('set-cookie') || '';
    const refreshData = await refreshRes.json();
    console.log('Refresh Status:', refreshRes.status);
    console.log('Refresh Response:', refreshData);

    if (refreshRes.status !== 200) throw new Error('Token refresh failed');
    if (!refreshData.data.accessToken) throw new Error('Missing rotated access token');
    if (!refreshCookieHeader.includes('refreshToken=')) throw new Error('Missing rotated refresh cookie');

    const rotatedRefreshCookie = refreshCookieHeader.split(';')[0];
    console.log('✅ Refresh Token Rotation passed');

    // 9. Old Refresh-Token Reuse Detection
    console.log('\n[9] Testing Old Refresh-Token Reuse Detection...');
    const reuseRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: owner1RefreshCookie, // Old cookie before rotation!
      },
    });

    console.log('Reuse Attempt Status:', reuseRes.status);
    if (reuseRes.status !== 401) throw new Error('Reusing old token was not rejected with 401');

    // Verify session was revoked in DB
    const sessionId = owner1RefreshCookie.split('=')[1].split('%3A')[0].split(':')[0];
    const sessionInDb = await prisma.refreshSession.findUnique({ where: { id: sessionId } });
    if (!sessionInDb || !sessionInDb.isRevoked) {
      throw new Error('RefreshSession was not marked isRevoked = true on reuse!');
    }

    // Rotated cookie should also now fail because the whole session is revoked
    const rotatedAfterRevokeRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: rotatedRefreshCookie,
      },
    });
    console.log('Rotated Cookie Status after Revocation:', rotatedAfterRevokeRes.status);
    if (rotatedAfterRevokeRes.status !== 401) throw new Error('Session should remain revoked');
    console.log('✅ Old Refresh-Token Reuse Detection passed');

    // 10. Logout / Revocation
    console.log('\n[10] Testing Logout / Revocation...');
    // Re-login to get a fresh active session
    const reloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    });

    const logoutTargetCookie = (reloginRes.headers.get('set-cookie') || '').split(';')[0];
    const logoutSessionId = logoutTargetCookie.split('=')[1].split('%3A')[0].split(':')[0];

    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: logoutTargetCookie,
      },
    });

    console.log('Logout Status:', logoutRes.status);
    if (logoutRes.status !== 200) throw new Error('Logout failed');

    const logoutSessionInDb = await prisma.refreshSession.findUnique({ where: { id: logoutSessionId } });
    if (!logoutSessionInDb || !logoutSessionInDb.isRevoked) {
      throw new Error('Logout did not set isRevoked = true on RefreshSession');
    }

    // Try refreshing with logged out cookie
    const postLogoutRefresh = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: logoutTargetCookie },
    });
    if (postLogoutRefresh.status !== 401) throw new Error('Refresh after logout did not fail with 401');
    console.log('✅ Logout / Revocation passed');

    // 11. Tenant / BusinessId Isolation
    console.log('\n[11] Testing Tenant / BusinessId Isolation...');
    const owner2Email = `owner2_${timestamp}@example.com`;
    const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: owner2Email,
        password,
        businessName: `Owner 2 Business ${timestamp}`,
      }),
    });
    const reg2Data = await reg2Res.json();
    const owner2BusinessId = reg2Data.data.business.id;

    if (owner1BusinessId === owner2BusinessId) throw new Error('Tenant isolation breach: Same businessId');

    const token1Payload = JSON.parse(Buffer.from(owner1AccessToken.split('.')[1], 'base64').toString());
    const token2Payload = JSON.parse(Buffer.from(reg2Data.data.accessToken.split('.')[1], 'base64').toString());

    if (token1Payload.businessId !== owner1BusinessId) throw new Error('Owner 1 token businessId mismatch');
    if (token2Payload.businessId !== owner2BusinessId) throw new Error('Owner 2 token businessId mismatch');
    console.log('✅ Tenant / BusinessId Isolation passed');

    console.log('\n=========================================');
    console.log('🎉 ALL 11 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=========================================\n');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runVerification();
