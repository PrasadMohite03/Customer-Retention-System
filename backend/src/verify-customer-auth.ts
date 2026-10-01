import http from 'http';
import app from './app';
import prisma from './lib/prisma';
import { hashOpaqueToken } from './utils/auth.utils';
import { normalizePhone } from './utils/phone.utils';

const PORT = 5056;
const BASE_URL = `http://localhost:${PORT}`;

async function runCustomerAuthVerification() {
  console.log('--- STARTING CUSTOMER AUTH VERIFICATION ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on ${BASE_URL}`);

  try {
    const timestamp = Date.now();
    const rawPhone = `+91 98${timestamp.toString().slice(-8)}`;
    const normalizedPhone = normalizePhone(rawPhone);

    // 1. Send OTP
    console.log('\n[1] Testing Send OTP...');
    const sendRes = await fetch(`${BASE_URL}/api/auth/customer/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone }),
    });

    const sendData = await sendRes.json();
    console.log('Send OTP Status:', sendRes.status);
    console.log('Send OTP Response:', sendData);

    if (sendRes.status !== 200) throw new Error('Send OTP failed');
    if ((sendData as any).otp) throw new Error('OTP returned in response! Security violation');
    console.log('✅ Send OTP passed');

    // 2. OTP is not stored in plaintext
    console.log('\n[2] Testing OTP Persistence Security (Hashed)...');
    const otpRecord = await prisma.customerOtp.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) throw new Error('No CustomerOtp record created in DB');
    if (otpRecord.otpHash.length !== 64) throw new Error('otpHash does not appear to be a SHA-256 hash');
    if (/^\d{6}$/.test(otpRecord.otpHash)) throw new Error('Plaintext 6-digit OTP stored in database!');
    console.log('✅ OTP Hashed in DB passed');

    // Fetch the generated OTP from DB for testing verification (by matching hash if needed, or creating a test record)
    // For test convenience, let's create a known test OTP hash
    const testOtpCode = '123456';
    const testOtpHash = hashOpaqueToken(testOtpCode);

    // Invalidate earlier OTPs and insert known test OTP record
    await prisma.customerOtp.updateMany({
      where: { phone: normalizedPhone },
      data: { usedAt: new Date() },
    });

    const knownOtpRecord = await prisma.customerOtp.create({
      data: {
        phone: normalizedPhone,
        otpHash: testOtpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        failedAttempts: 0,
        usedAt: null,
      },
    });

    // 3. Expired OTP Rejection
    console.log('\n[3 & 7] Testing Expired OTP Rejection...');
    const expiredPhone = `+91 97${timestamp.toString().slice(-8)}`;
    const expiredNormalized = normalizePhone(expiredPhone);
    await prisma.customerOtp.create({
      data: {
        phone: expiredNormalized,
        otpHash: testOtpHash,
        expiresAt: new Date(Date.now() - 10000), // Already expired
        failedAttempts: 0,
        usedAt: null,
      },
    });

    const expiredRes = await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: expiredPhone, otp: testOtpCode }),
    });

    console.log('Expired OTP Status:', expiredRes.status);
    if (expiredRes.status !== 401) throw new Error('Expired OTP was not rejected with 401');
    console.log('✅ Expired OTP Rejection passed');

    // 5. Incorrect OTP Increments Attempts
    console.log('\n[5] Testing Incorrect OTP Attempts...');
    const wrongOtpRes = await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: '000000' }),
    });

    console.log('Wrong OTP Status:', wrongOtpRes.status);
    if (wrongOtpRes.status !== 401) throw new Error('Wrong OTP was not rejected with 401');

    const updatedOtpAfterWrong = await prisma.customerOtp.findUnique({
      where: { id: knownOtpRecord.id },
    });

    if (updatedOtpAfterWrong?.failedAttempts !== 1) {
      throw new Error(`Expected failedAttempts=1, got ${updatedOtpAfterWrong?.failedAttempts}`);
    }
    console.log('✅ Incorrect OTP Increment passed');

    // 6. Third Incorrect Attempt Invalidates OTP
    console.log('\n[6] Testing 3rd Failed Attempt Invalidation...');
    // Attempt 2 wrong
    await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: '000000' }),
    });

    // Attempt 3 wrong
    await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: '000000' }),
    });

    const after3rdWrong = await prisma.customerOtp.findUnique({
      where: { id: knownOtpRecord.id },
    });
    if (after3rdWrong?.failedAttempts !== 3) {
      throw new Error(`Expected failedAttempts=3, got ${after3rdWrong?.failedAttempts}`);
    }

    // Attempting even with correct OTP now should fail because failedAttempts >= 3
    const correctAfter3WrongRes = await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: testOtpCode }),
    });
    if (correctAfter3WrongRes.status !== 401) {
      throw new Error('OTP with 3 failed attempts was not rejected!');
    }
    console.log('✅ 3rd Failed Attempt Invalidation passed');

    // 4 & 10. Correct OTP Verification & New Customer Creation
    console.log('\n[4 & 10] Testing Correct OTP Verification & New Customer Creation...');
    const validOtpRecord = await prisma.customerOtp.create({
      data: {
        phone: normalizedPhone,
        otpHash: testOtpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        failedAttempts: 0,
        usedAt: null,
      },
    });

    const verifyRes = await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: testOtpCode }),
    });

    const verifyCookieHeader = verifyRes.headers.get('set-cookie') || '';
    const verifyData = await verifyRes.json();
    console.log('Verify Status:', verifyRes.status);
    console.log('Verify Response:', verifyData);

    if (verifyRes.status !== 200) throw new Error('OTP verification failed');
    if (!verifyData.data.accessToken) throw new Error('Missing accessToken');
    if (!verifyData.data.customer.id) throw new Error('Missing customer ID');
    if (verifyData.data.customer.phone !== normalizedPhone) throw new Error('Phone mismatch');

    const customerId1 = verifyData.data.customer.id;
    const customer1AccessToken = verifyData.data.accessToken;
    const customer1RefreshCookie = verifyCookieHeader.split(';')[0];

    // Check that NO User record was created for customer
    const userCheck = await prisma.user.findFirst({ where: { email: normalizedPhone } });
    if (userCheck) throw new Error('User record was created for Customer! Identity model leak');

    console.log('✅ Correct OTP & New Customer Creation passed');

    // 8. Used OTP Cannot be Reused
    console.log('\n[8] Testing Used OTP Reuse Rejection...');
    const reuseOtpRes = await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: testOtpCode }),
    });
    if (reuseOtpRes.status !== 401) throw new Error('Reusing used OTP was not rejected with 401');
    console.log('✅ Used OTP Reuse Rejection passed');

    // 9. Existing Customer Login
    console.log('\n[9] Testing Existing Customer Login...');
    const existingOtpRecord = await prisma.customerOtp.create({
      data: {
        phone: normalizedPhone,
        otpHash: testOtpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        failedAttempts: 0,
        usedAt: null,
      },
    });

    const existingLoginRes = await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: testOtpCode }),
    });
    const existingLoginData = await existingLoginRes.json();

    if (existingLoginRes.status !== 200) throw new Error('Existing customer login failed');
    if (existingLoginData.data.customer.id !== customerId1) throw new Error('Returned different customer ID for same phone');
    console.log('✅ Existing Customer Login passed');

    // 11 & 12. Customer JWT & RefreshSession Verification
    console.log('\n[11 & 12] Testing Customer JWT & RefreshSession linkage...');
    const tokenPayload = JSON.parse(Buffer.from(customer1AccessToken.split('.')[1], 'base64').toString());
    if (tokenPayload.customerId !== customerId1) throw new Error('customerId in JWT mismatch');
    if (tokenPayload.role !== 'CUSTOMER') throw new Error('Role in JWT is not CUSTOMER');
    if (tokenPayload.userId) throw new Error('userId present in Customer JWT!');

    const sessionId = customer1RefreshCookie.split('=')[1].split('%3A')[0].split(':')[0];
    const sessionInDb = await prisma.refreshSession.findUnique({ where: { id: sessionId } });

    if (!sessionInDb) throw new Error('RefreshSession not found in DB');
    if (sessionInDb.customerId !== customerId1) throw new Error('RefreshSession customerId mismatch');
    if (sessionInDb.userId !== null) throw new Error('RefreshSession userId is not null for Customer!');
    console.log('✅ Customer JWT & RefreshSession passed');

    // 13. Refresh Token Rotation
    console.log('\n[13] Testing Customer Refresh Token Rotation...');
    const refreshRes = await fetch(`${BASE_URL}/api/auth/customer/refresh`, {
      method: 'POST',
      headers: { Cookie: customer1RefreshCookie },
    });

    const refreshCookieHeader = refreshRes.headers.get('set-cookie') || '';
    const refreshData = await refreshRes.json();
    console.log('Customer Refresh Status:', refreshRes.status);
    console.log('Customer Refresh Response:', refreshData);

    if (refreshRes.status !== 200) throw new Error('Customer refresh failed');
    if (!refreshData.data.accessToken) throw new Error('Missing rotated access token');

    const rotatedRefreshCookie = refreshCookieHeader.split(';')[0];
    console.log('✅ Customer Refresh Token Rotation passed');

    // 14. Old Refresh Token Reuse Detection
    console.log('\n[14] Testing Old Refresh Token Reuse Detection...');
    const oldReuseRes = await fetch(`${BASE_URL}/api/auth/customer/refresh`, {
      method: 'POST',
      headers: { Cookie: customer1RefreshCookie }, // Pre-rotation cookie
    });

    console.log('Old Token Reuse Status:', oldReuseRes.status);
    if (oldReuseRes.status !== 401) throw new Error('Reusing old refresh token was not rejected with 401');

    const sessionAfterReuse = await prisma.refreshSession.findUnique({ where: { id: sessionId } });
    if (!sessionAfterReuse?.isRevoked) throw new Error('Session was not revoked after reuse detection');
    console.log('✅ Old Refresh Token Reuse Detection passed');

    // 15. Customer Logout
    console.log('\n[15] Testing Customer Logout...');
    // Create new login session for logout test
    await prisma.customerOtp.create({
      data: {
        phone: normalizedPhone,
        otpHash: testOtpHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        failedAttempts: 0,
        usedAt: null,
      },
    });

    const freshLoginRes = await fetch(`${BASE_URL}/api/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone, otp: testOtpCode }),
    });

    const freshCookie = (freshLoginRes.headers.get('set-cookie') || '').split(';')[0];
    const freshSessionId = freshCookie.split('=')[1].split('%3A')[0].split(':')[0];

    const logoutRes = await fetch(`${BASE_URL}/api/auth/customer/logout`, {
      method: 'POST',
      headers: { Cookie: freshCookie },
    });

    console.log('Logout Status:', logoutRes.status);
    if (logoutRes.status !== 200) throw new Error('Logout failed');

    const freshSessionInDb = await prisma.refreshSession.findUnique({ where: { id: freshSessionId } });
    if (!freshSessionInDb?.isRevoked) throw new Error('Logout did not revoke Customer RefreshSession');
    console.log('✅ Customer Logout passed');

    // 16. Customer Middleware Identity Isolation
    console.log('\n[16] Testing Customer Middleware Identity Isolation...');
    const protectedRes = await fetch(`${BASE_URL}/api/test/customer-protected`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${customer1AccessToken}`,
      },
    });

    const protectedData = await protectedRes.json();
    console.log('Protected Route Status:', protectedRes.status);
    console.log('Protected Route Response:', protectedData);

    if (protectedRes.status !== 200) throw new Error('Protected customer route access failed');
    if (protectedData.customer.customerId !== customerId1) throw new Error('customerId mismatch in middleware');
    if (protectedData.customer.role !== 'CUSTOMER') throw new Error('Role mismatch in middleware');
    console.log('✅ Customer Middleware Identity Isolation passed');

    console.log('\n=====================================================');
    console.log('🎉 ALL 16 CUSTOMER AUTH VERIFICATION TESTS PASSED! 🎉');
    console.log('=====================================================\n');
  } catch (error) {
    console.error('❌ Customer Auth Verification failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runCustomerAuthVerification();
