/**
 * MediTrace — Automated Test Suite for Kavi Phase 3 (Admin Module)
 */

const http = require('http');

const PORT = 5002;
let server;
let app;

// Setup test server
beforeAll = async () => {
  process.env.PORT = String(PORT);
  process.env.NODE_ENV = 'test';
  app = require('../dist/index.js').default;
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[Test Server] Running on port ${PORT}`);
      resolve();
    });
  });
};

afterAll = async () => {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
};

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Kavi Phase 3 Admin Module Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    await beforeAll();

    // 1. Authenticate Admin and Non-Admin
    console.log('\n--- 1. Authentication & Tokens ---');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@meditrace.org',
      password: 'admin123',
    });
    assert(adminLogin.status === 200 && adminLogin.body.token, 'Admin login succeeds and returns JWT token');
    const adminToken = adminLogin.body.token;

    const mfgLogin = await request('POST', '/api/auth/login', {
      email: 'manufacturer@apexpharma.com',
      password: 'mfg123',
    });
    assert(mfgLogin.status === 200 && mfgLogin.body.token, 'Manufacturer login succeeds and returns JWT token');
    const mfgToken = mfgLogin.body.token;

    // 2. Authorization Guards
    console.log('\n--- 2. Authorization & RBAC Guards ---');
    const unauthReq = await request('POST', '/api/organizations', { name: 'Test' });
    assert(unauthReq.status === 401, 'Anonymous request to create organization is blocked (401 Unauthorized)');

    const forbiddenReq = await request('POST', '/api/organizations', { name: 'Test' }, mfgToken);
    assert(forbiddenReq.status === 403, 'Non-admin request to create organization is blocked (403 Forbidden)');

    // 3. Organization Listing and Filtering
    console.log('\n--- 3. Organization Listing & Filtering ---');
    const listOrgs = await request('GET', '/api/organizations', null, adminToken);
    assert(listOrgs.status === 200 && listOrgs.body.data.length >= 4, 'List organizations returns seeded institutions');

    const filterMfg = await request('GET', '/api/organizations?type=MANUFACTURER', null, adminToken);
    assert(
      filterMfg.status === 200 && filterMfg.body.data.every((o) => o.type === 'MANUFACTURER'),
      'Filter organizations by type=MANUFACTURER works'
    );

    // 4. Organization Creation
    console.log('\n--- 4. Organization Creation & Validation ---');
    const testLicense = `TEST-LIC-${Date.now()}`;
    const createOrgRes = await request(
      'POST',
      '/api/organizations',
      {
        name: 'Zenith BioPharm Logistics',
        type: 'DISTRIBUTOR',
        address: '42 Cold Storage Ave',
        contactEmail: 'contact@zenithbiopharm.com',
        licenseNumber: testLicense,
      },
      adminToken
    );
    assert(createOrgRes.status === 201 && createOrgRes.body.data.organizationId, 'Create organization succeeds (201 Created)');
    const createdOrgId = createOrgRes.body.data.organizationId;

    // 5. Duplicate Organization Handling
    console.log('\n--- 5. Duplicate Handling ---');
    const duplicateOrgRes = await request(
      'POST',
      '/api/organizations',
      {
        name: 'Imposter Zenith',
        type: 'DISTRIBUTOR',
        address: 'Unknown',
        contactEmail: 'imposter@zenith.com',
        licenseNumber: testLicense,
      },
      adminToken
    );
    assert(duplicateOrgRes.status === 409, 'Duplicate license registration is rejected (409 Conflict)');

    // 6. Organization Update
    console.log('\n--- 6. Organization Editing ---');
    const updateOrgRes = await request(
      'PUT',
      `/api/organizations/${createdOrgId}`,
      {
        name: 'Zenith BioPharm Global Logistics',
        address: '50 Cold Storage Blvd Suite 100',
        contactEmail: 'compliance@zenithbiopharm.com',
      },
      adminToken
    );
    assert(
      updateOrgRes.status === 200 && updateOrgRes.body.data.name === 'Zenith BioPharm Global Logistics',
      'Edit organization permitted details succeeds'
    );

    // 7. Organization Deactivation & Activation
    console.log('\n--- 7. Organization Activation & Deactivation ---');
    const deactivateOrg = await request(
      'PATCH',
      `/api/organizations/${createdOrgId}/status`,
      { status: 'INACTIVE', reason: 'Routine audit suspension' },
      adminToken
    );
    assert(deactivateOrg.status === 200 && deactivateOrg.body.data.status === 'INACTIVE', 'Deactivate organization succeeds');

    const reactivateOrg = await request(
      'PATCH',
      `/api/organizations/${createdOrgId}/status`,
      { status: 'ACTIVE', reason: 'Audit passed' },
      adminToken
    );
    assert(reactivateOrg.status === 200 && reactivateOrg.body.data.status === 'ACTIVE', 'Reactivate organization succeeds');

    // 8. User Management
    console.log('\n--- 8. User Management ---');
    const testUserEmail = `user.${Date.now()}@zenith.com`;
    const createUserRes = await request(
      'POST',
      '/api/users',
      {
        name: 'Alex Mercer',
        email: testUserEmail,
        password: 'password123',
        role: 'DISTRIBUTOR',
        organizationId: createdOrgId,
      },
      adminToken
    );
    assert(createUserRes.status === 201 && createUserRes.body.data.id, 'Create user account succeeds (201 Created)');
    assert(createUserRes.body.data.passwordHash === undefined, 'User response never exposes passwordHash');
    const createdUserId = createUserRes.body.data.id;

    // 9. Duplicate Email Handling
    console.log('\n--- 9. Duplicate User Email Handling ---');
    const duplicateUserRes = await request(
      'POST',
      '/api/users',
      {
        name: 'Duplicate Alex',
        email: testUserEmail,
        password: 'anotherpassword',
        role: 'DISTRIBUTOR',
        organizationId: createdOrgId,
      },
      adminToken
    );
    assert(duplicateUserRes.status === 409, 'Duplicate user email is rejected (409 Conflict)');

    // 10. User Deactivation and Login Prevention
    console.log('\n--- 10. User Deactivation & Access Prevention ---');
    const userLoginBefore = await request('POST', '/api/auth/login', {
      email: testUserEmail,
      password: 'password123',
    });
    assert(userLoginBefore.status === 200, 'Newly created user can successfully log in');

    const deactivateUser = await request(
      'PATCH',
      `/api/users/${createdUserId}/status`,
      { isActive: false, reason: 'Staff departure' },
      adminToken
    );
    assert(deactivateUser.status === 200 && deactivateUser.body.data.isActive === false, 'Deactivate user succeeds');

    const userLoginAfter = await request('POST', '/api/auth/login', {
      email: testUserEmail,
      password: 'password123',
    });
    assert(userLoginAfter.status === 403, 'Deactivated user is forbidden from logging in (403)');

    // 11. Admin Metrics & Activity Tracking
    console.log('\n--- 11. Activity Tracking & Metrics ---');
    const metricsRes = await request('GET', '/api/admin/metrics', null, adminToken);
    assert(metricsRes.status === 200 && metricsRes.body.data.organizations.total >= 5, 'Admin metrics endpoint returns complete system tallies');

    const activitiesRes = await request('GET', '/api/admin/activities', null, adminToken);
    assert(
      activitiesRes.status === 200 && activitiesRes.body.data.length >= 3,
      'Admin audit activities logs every administrative creation & modification'
    );
    assert(
      activitiesRes.body.data.some((a) => a.action === 'ORGANIZATION_CREATED'),
      'Audit log recorded ORGANIZATION_CREATED'
    );
    assert(
      activitiesRes.body.data.some((a) => a.action === 'USER_CREATED'),
      'Audit log recorded USER_CREATED'
    );
  } catch (err) {
    console.error('Test Execution Error:', err);
    failed++;
  } finally {
    await afterAll();
  }

  console.log('\n====================================================');
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
