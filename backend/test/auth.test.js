/**
 * MediTrace — Kavi Phase 4 Authentication & Role-Based Access Control Test Suite
 * 
 * Verifies all security requirements:
 * 1. Valid login across roles
 * 2. Invalid password (generic 401)
 * 3. Unknown account (generic 401, no enumeration)
 * 4. Inactive user rejection (403)
 * 5. Inactive organization rejection (403)
 * 6. Logout token revocation & session termination (401)
 * 7. Unauthenticated access prevention (401)
 * 8. Distributor attempting Admin operation (403)
 * 9. Manufacturer attempting Pharmacy-only operation (403)
 * 10. User attempting to modify own role (403)
 * 11. Public access to batch verification (200, zero login)
 * 12. Attempts to access private endpoints without auth (401)
 * 13. Rate limiting on repeated invalid login attempts (429)
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5003';

const http = require('http');
const assert = require('assert');
const appModule = require('../dist/index.js');
const app = appModule.default || appModule;
const { db } = require('../dist/services/db.service');
const { resetRateLimits } = require('../dist/middleware/rateLimiter');
const { clearTokenBlacklist } = require('../dist/middleware/auth.middleware');

let server;
const PORT = 5003;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Kavi Phase 4 Authentication & RBAC Tests');
  console.log('====================================================\n');

  server = app.listen(PORT, () => {
    console.log(`[Test Server] Running on port ${PORT}\n`);
  });

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    return fn()
      .then(() => {
        console.log(`  ✓ PASS: ${description}`);
        passed++;
      })
      .catch((err) => {
        console.error(`  ✗ FAIL: ${description}`);
        console.error(`    -> ${err.message}`);
        failed++;
      });
  }

  try {
    resetRateLimits();
    clearTokenBlacklist();

    let adminToken;
    let mfgToken;
    let distToken;
    let pharmToken;

    // --- 1. Valid Login Across Roles ---
    console.log('--- 1. Valid Login Across Roles ---');
    await test('Admin login returns 200, JWT token, and sanitized profile without passwordHash', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'admin@meditrace.org',
        password: 'admin123',
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.token, 'Token must be returned');
      assert.strictEqual(res.data.user.role, 'ADMIN');
      assert.strictEqual(res.data.user.passwordHash, undefined, 'passwordHash must never be exposed');
      adminToken = res.data.token;
    });

    await test('Manufacturer login returns 200 and valid session', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'manufacturer@apexpharma.com',
        password: 'mfg123',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.role, 'MANUFACTURER');
      mfgToken = res.data.token;
    });

    await test('Distributor login returns 200 and valid session', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'distributor@ghlogistics.com',
        password: 'dist123',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.role, 'DISTRIBUTOR');
      distToken = res.data.token;
    });

    await test('Pharmacy login returns 200 and valid session', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'pharmacy@citycare.org',
        password: 'pharm123',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.user.role, 'PHARMACY');
      pharmToken = res.data.token;
    });

    // --- 2. Invalid Password Handling ---
    console.log('\n--- 2. Invalid Password Handling ---');
    await test('Login with incorrect password returns generic 401 error', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'admin@meditrace.org',
        password: 'WRONG_PASSWORD_XYZ',
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error, 'Invalid email or credentials');
    });

    // --- 3. Unknown Account Handling (No Enumeration) ---
    console.log('\n--- 3. Unknown Account Handling ---');
    await test('Login with non-existent account returns generic 401 without enumeration', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'nonexistent.hacker@evil.org',
        password: 'password123',
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.error, 'Invalid email or credentials');
    });

    // --- 4. Inactive User Access Prevention ---
    console.log('\n--- 4. Inactive User Access Prevention ---');
    let testInactiveUserId;
    const inactiveEmail = `inactive.user.${Date.now()}@test.org`;
    await test('Create user and verify deactivation blocks login (403)', async () => {
      // 1. Create a user
      const userRes = await request(
        'POST',
        '/api/users',
        {
          name: 'Deactivated Worker',
          email: inactiveEmail,
          password: 'password123',
          role: 'DISTRIBUTOR',
          organizationId: 'ORG-DIST-01',
        },
        adminToken
      );
      assert.strictEqual(userRes.status, 201);
      testInactiveUserId = userRes.data.data.id;

      // 2. Deactivate the user
      const deactRes = await request(
        'PATCH',
        `/api/users/${testInactiveUserId}/status`,
        { isActive: false, reason: 'Security suspension' },
        adminToken
      );
      assert.strictEqual(deactRes.status, 200);

      // 3. Attempt login with deactivated user
      const loginRes = await request('POST', '/api/auth/login', {
        email: inactiveEmail,
        password: 'password123',
      });
      assert.strictEqual(loginRes.status, 403);
      assert.ok(loginRes.data.error.includes('deactivated'), 'Must state account deactivated');
    });

    // --- 5. Inactive Organization Access Prevention ---
    console.log('\n--- 5. Inactive Organization Access Prevention ---');
    const suspOrgLicense = `SUSP-PHM-${Date.now().toString(36).toUpperCase()}`;
    const suspOrgEmail = `worker.${Date.now()}@suspendedpharm.com`;
    await test('User belonging to inactive organization is blocked from login (403)', async () => {
      // 1. Create a new organization
      const orgRes = await request(
        'POST',
        '/api/organizations',
        {
          name: 'Suspended Pharmacy Inc',
          type: 'PHARMACY',
          address: '77 Quarantine Way',
          contactEmail: `contact.${Date.now()}@suspendedpharm.com`,
          licenseNumber: suspOrgLicense,
        },
        adminToken
      );
      assert.strictEqual(orgRes.status, 201);
      const orgId = orgRes.data.data.organizationId;

      // 2. Create user linked to this org
      const userRes = await request(
        'POST',
        '/api/users',
        {
          name: 'Suspended Org User',
          email: suspOrgEmail,
          password: 'password123',
          role: 'PHARMACY',
          organizationId: orgId,
        },
        adminToken
      );
      assert.strictEqual(userRes.status, 201);

      // 3. Deactivate the organization
      const statusRes = await request(
        'PATCH',
        `/api/organizations/${orgId}/status`,
        { status: 'INACTIVE', reason: 'License revoked' },
        adminToken
      );
      assert.strictEqual(statusRes.status, 200);

      // 4. Attempt login with that user
      const loginRes = await request('POST', '/api/auth/login', {
        email: suspOrgEmail,
        password: 'password123',
      });
      assert.strictEqual(loginRes.status, 403);
      assert.ok(loginRes.data.error.toLowerCase().includes('organization'));
    });

    // --- 6. Logout and Token Revocation ---
    console.log('\n--- 6. Logout and Token Revocation ---');
    const logoutUserEmail = `logout.tester.${Date.now()}@test.org`;
    await test('Logout revokes JWT token and subsequent request with that token fails (401)', async () => {
      // 1. Provision a dedicated user to test logout
      const provRes = await request(
        'POST',
        '/api/users',
        {
          name: 'Logout Test User',
          email: logoutUserEmail,
          password: 'logoutPass123',
          role: 'DISTRIBUTOR',
          organizationId: 'ORG-DIST-01',
        },
        adminToken
      );
      assert.strictEqual(provRes.status, 201);

      // 2. Log in with this dedicated user to get token
      const loginRes = await request('POST', '/api/auth/login', {
        email: logoutUserEmail,
        password: 'logoutPass123',
      });
      assert.strictEqual(loginRes.status, 200);
      const tempToken = loginRes.data.token;

      // 3. Verify token works
      const meResBefore = await request('GET', '/api/auth/me', null, tempToken);
      assert.strictEqual(meResBefore.status, 200);

      // 4. Logout
      const logoutRes = await request('POST', '/api/auth/logout', null, tempToken);
      assert.strictEqual(logoutRes.status, 200);
      assert.ok(logoutRes.data.message.includes('revoked'));

      // 5. Subsequent request with revoked token must be rejected
      const meResAfter = await request('GET', '/api/auth/me', null, tempToken);
      assert.strictEqual(meResAfter.status, 401);
      assert.ok(meResAfter.data.error.includes('logged out') || meResAfter.data.error.includes('terminated'));
    });

    // --- 7. Unauthenticated Access Prevention ---
    console.log('\n--- 7. Unauthenticated Access Prevention ---');
    await test('Accessing protected route without authentication header returns 401', async () => {
      const res = await request('GET', '/api/batches');
      assert.strictEqual(res.status, 401);
    });

    await test('Accessing protected route with invalid token returns 401', async () => {
      const res = await request('GET', '/api/batches', null, 'INVALID.TOKEN.SIGNATURE');
      assert.strictEqual(res.status, 401);
    });

    // --- 8. Distributor Attempting Admin Operation ---
    console.log('\n--- 8. Distributor Attempting Admin Operation ---');
    await test('Distributor attempting to create an organization is blocked (403 Forbidden)', async () => {
      const res = await request(
        'POST',
        '/api/organizations',
        {
          name: 'Rogue Distributor Org',
          type: 'DISTRIBUTOR',
          address: '123 Fake St',
          contactEmail: 'fake@dist.com',
          licenseNumber: 'ROGUE-001',
        },
        distToken
      );
      assert.strictEqual(res.status, 403);
      assert.ok(res.data.error.includes('Forbidden'));
    });

    await test('Distributor attempting to query admin metrics is blocked (403 Forbidden)', async () => {
      const res = await request('GET', '/api/admin/metrics', null, distToken);
      assert.strictEqual(res.status, 403);
    });

    // --- 9. Manufacturer Attempting Pharmacy Operation ---
    console.log('\n--- 9. Manufacturer Attempting Pharmacy Operation ---');
    await test('Manufacturer attempting to dispense medication is blocked (403 Forbidden)', async () => {
      const res = await request(
        'POST',
        '/api/batches/MED-20261015-A8F2K/dispense',
        {
          quantityToDispense: 5,
          patientReference: 'PAT-991',
        },
        mfgToken
      );
      assert.strictEqual(res.status, 403);
      assert.ok(res.data.error.includes('Forbidden'));
      assert.ok(res.data.error.includes('PHARMACY') || res.data.error.includes('HOSPITAL'));
    });

    // --- 10. User Attempting to Modify Own Role ---
    console.log('\n--- 10. User Attempting to Modify Own Role ---');
    await test('Ordinary user attempting to elevate role to ADMIN via role endpoint is blocked (403)', async () => {
      const res = await request(
        'PATCH',
        `/api/users/usr-dist-01/role`,
        { role: 'ADMIN' },
        distToken
      );
      assert.strictEqual(res.status, 403);
    });

    await test('Ordinary user attempting to update profile with role escalation is rejected (403)', async () => {
      const res = await request(
        'PATCH',
        `/api/users/usr-dist-01`,
        { role: 'ADMIN' },
        distToken
      );
      assert.strictEqual(res.status, 403);
      assert.ok(res.data.error.includes('Ordinary users cannot alter their own role'));
    });

    // --- 11. Public Access to Permitted Batch Verification ---
    console.log('\n--- 11. Public Access to Permitted Batch Verification ---');
    await test('Public batch verification succeeds without login (200 OK)', async () => {
      const res = await request('GET', '/api/public/verify/MED-20261015-A8F2K');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.verified, true);
      assert.strictEqual(res.data.batchId, 'MED-20261015-A8F2K');
      assert.strictEqual(res.data.drugName, 'Amoxicillin Clavulanate');
      assert.ok(res.data.blockchainVerification, 'Blockchain verification metadata present');
      assert.strictEqual(res.data.passwordHash, undefined, 'No passwords or internal hashes leaked');
    });

    // --- 12. Attempts to Access Private Inventory Through Public Endpoints ---
    console.log('\n--- 12. Attempts to Access Private Inventory Through Public Endpoints ---');
    await test('Attempting to query private batch list without authentication returns 401', async () => {
      const res = await request('GET', '/api/batches');
      assert.strictEqual(res.status, 401);
    });

    await test('Attempting to query audit logs without authentication returns 401', async () => {
      const res = await request('GET', '/api/admin/activities');
      assert.strictEqual(res.status, 401);
    });

    // --- 13. Rate Limiting on Brute Force Login Attempts ---
    console.log('\n--- 13. Rate Limiting on Brute Force Login Attempts ---');
    await test('Exceeding 5 failed login attempts triggers 429 Too Many Requests', async () => {
      resetRateLimits();
      const bruteEmail = 'target.victim@test.org';

      // Send 5 invalid login requests
      for (let i = 0; i < 5; i++) {
        const attempt = await request('POST', '/api/auth/login', {
          email: bruteEmail,
          password: 'WRONG_GUESS',
        });
        assert.strictEqual(attempt.status, 401);
      }

      // 6th attempt should be blocked by rate limiter with 429
      const blockedAttempt = await request('POST', '/api/auth/login', {
        email: bruteEmail,
        password: 'WRONG_GUESS',
      });
      assert.strictEqual(blockedAttempt.status, 429);
      assert.ok(blockedAttempt.data.error.includes('Too many failed login attempts'));
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
