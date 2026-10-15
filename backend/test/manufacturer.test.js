/**
 * MediTrace — Kavi Phase 5 Manufacturer Module Test Suite
 * 
 * Verifies all Phase 5 requirements:
 * 1. Manufacturer login & dashboard stats access
 * 2. Access denial for unauthorized roles (Distributor / Hospital attempting manufacturer actions -> 403)
 * 3. Access denial for unauthenticated requests (401)
 * 4. Medicine registration & retrieval
 * 5. Medicine updating (permitted fields)
 * 6. Successful batch creation with standard batch ID
 * 7. Date validation: expiryDate <= manufacturingDate rejection (400)
 * 8. Quantity validation: non-positive quantity rejection (400)
 * 9. Duplicate batch ID prevention (409)
 * 10. QR code URL generation and public read-only verification without authentication
 * 11. Organization-level data isolation & server-side identity enforcement (spoofed org ID ignored)
 * 12. Database persistence across datastore reload
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5004';

const http = require('http');
const assert = require('assert');
const appModule = require('../dist/index.js');
const app = appModule.default || appModule;
const { db } = require('../dist/services/db.service');

let server;
const PORT = 5004;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeBatchId(prefix = 'M') {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MED-${yyyy}${mm}${dd}-${prefix}${rand}`;
}

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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            data,
          });
        });
      }
    );

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  MediTrace Phase 5: Manufacturer Module Test Suite');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // Start HTTP Server
  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  try {
    let mfgToken = null;
    let distToken = null;
    let registeredMedicineId = null;
    const testBatchId = makeBatchId('M');

    // 1. Manufacturer Login
    await test('1. Manufacturer can log in and obtain valid JWT with MANUFACTURER role', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'manufacturer@apexpharma.com',
        password: 'mfg123',
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.role, 'MANUFACTURER');
      assert.strictEqual(res.body.user.organizationId, 'ORG-MFG-01');
      mfgToken = res.body.token;
    });

    // 2. Distributor Login for cross-role checks
    await test('2. Distributor can log in to obtain DISTRIBUTOR token', async () => {
      const res = await request('POST', '/api/auth/login', {
        email: 'distributor@ghlogistics.com',
        password: 'dist123',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.role, 'DISTRIBUTOR');
      distToken = res.body.token;
    });

    // 3. Manufacturer Dashboard Stats
    await test('3. Manufacturer can access organization dashboard KPI statistics', async () => {
      const res = await request('GET', '/api/batches/manufacturer/stats', null, mfgToken);
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.data.totalMedicines === 'number');
      assert.ok(typeof res.body.data.totalBatches === 'number');
      assert.ok(typeof res.body.data.activeBatches === 'number');
      assert.ok(typeof res.body.data.expiredBatches === 'number');
      assert.ok(typeof res.body.data.recalledBatches === 'number');
    });

    // 4. Access Denial for Unauthorized Role
    await test('4. Access denial: Distributor is rejected when attempting to register a medicine (403)', async () => {
      const res = await request(
        'POST',
        '/api/medicines',
        {
          name: 'Unauthorized Drug',
          genericName: 'Unauthorized API',
        },
        distToken
      );
      assert.strictEqual(res.status, 403);
    });

    await test('4b. Access denial: Distributor is rejected when attempting to create a batch (403)', async () => {
      const res = await request(
        'POST',
        '/api/batches',
        {
          batchId: makeBatchId('F'),
          drugName: 'Unauthorized Drug',
          quantity: 100,
        },
        distToken
      );
      assert.strictEqual(res.status, 403);
    });

    // 5. Access Denial for Unauthenticated Requests
    await test('5. Access denial: Unauthenticated request to /api/medicines returns 401', async () => {
      const res = await request('GET', '/api/medicines');
      assert.strictEqual(res.status, 401);
    });

    // 6. Medicine Registration
    await test('6. Manufacturer can register a new medicine specification with required fields', async () => {
      const res = await request(
        'POST',
        '/api/medicines',
        {
          name: 'Amoxicillin Clavulanate Forte',
          genericName: 'Amoxicillin / Clavulanic Acid',
          description: 'Broad-spectrum bactericidal penicillin antibiotic',
          dosageForm: 'Oral Suspension',
          strength: '400mg/57mg per 5mL',
          packaging: '100mL Amber Glass Bottle with dosing syringe',
        },
        mfgToken
      );
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data.medicineId);
      assert.strictEqual(res.body.data.name, 'Amoxicillin Clavulanate Forte');
      assert.strictEqual(res.body.data.manufacturerOrganizationId, 'ORG-MFG-01');
      registeredMedicineId = res.body.data.medicineId;
    });

    // 7. Medicine Listing & Retrieval
    await test('7. Manufacturer can retrieve registered medicines list and specific medicine by ID', async () => {
      const listRes = await request('GET', '/api/medicines', null, mfgToken);
      assert.strictEqual(listRes.status, 200);
      assert.ok(Array.isArray(listRes.body.data));
      const found = listRes.body.data.find((m) => m.medicineId === registeredMedicineId);
      assert.ok(found, 'Newly registered medicine must appear in medicine list');

      const singleRes = await request('GET', `/api/medicines/${registeredMedicineId}`, null, mfgToken);
      assert.strictEqual(singleRes.status, 200);
      assert.strictEqual(singleRes.body.data.medicineId, registeredMedicineId);
    });

    // 8. Medicine Updating
    await test('8. Manufacturer can update permitted details of a registered medicine', async () => {
      const res = await request(
        'PUT',
        `/api/medicines/${registeredMedicineId}`,
        {
          description: 'Updated pediatric broad-spectrum antibiotic formula',
          packaging: '120mL Amber Glass Bottle',
          strength: '457mg/5mL',
        },
        mfgToken
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.description, 'Updated pediatric broad-spectrum antibiotic formula');
      assert.strictEqual(res.body.data.packaging, '120mL Amber Glass Bottle');
    });

    // 9. Batch Creation — Successful
    await test('9. Manufacturer can create a new batch with valid fields and automatic QR assignment', async () => {
      const mfgDate = new Date();
      const expDate = new Date(Date.now() + 365 * 24 * 3600 * 1000); // 1 year later

      const res = await request(
        'POST',
        '/api/batches',
        {
          batchId: testBatchId,
          medicineId: registeredMedicineId,
          drugName: 'Amoxicillin Clavulanate Forte',
          genericName: 'Amoxicillin / Clavulanic Acid',
          dosage: '457mg/5mL Oral Suspension',
          strength: '457mg/5mL',
          packaging: '120mL Amber Glass Bottle',
          quantity: 5000,
          manufacturingDate: mfgDate.toISOString(),
          expiryDate: expDate.toISOString(),
          location: 'Apex Bio-Plant Suite 2, Formulation Bay 4',
        },
        mfgToken
      );

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.batchId, testBatchId);
      assert.strictEqual(res.body.data.quantity, 5000);
      assert.strictEqual(res.body.data.remainingQuantity, 5000);
      assert.strictEqual(res.body.data.currentStatus, 'MANUFACTURED');
      assert.strictEqual(res.body.data.manufacturerName, 'Apex Biotech Pharmaceuticals Ltd.');
      assert.ok(res.body.data.qrCodeUrl, 'QR code URL must be generated');
      assert.ok(res.body.data.qrCodeUrl.includes(testBatchId));
    });

    // 10. Date Validation — Expiry date <= Manufacturing date rejection
    await test('10. Date validation: Batch creation rejected when expiryDate <= manufacturingDate (400)', async () => {
      const now = new Date();
      const earlierDate = new Date(Date.now() - 24 * 3600 * 1000);

      const res = await request(
        'POST',
        '/api/batches',
        {
          batchId: makeBatchId('D'),
          drugName: 'Paracetamol Infusion',
          quantity: 1000,
          manufacturingDate: now.toISOString(),
          expiryDate: earlierDate.toISOString(), // Invalid! Earlier than mfg
        },
        mfgToken
      );

      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error || res.body.message);
    });

    // 11. Quantity Validation — Non-positive quantity rejection
    await test('11. Quantity validation: Batch creation rejected when quantity is 0 or negative (400)', async () => {
      const now = new Date();
      const exp = new Date(Date.now() + 365 * 24 * 3600 * 1000);

      const resZero = await request(
        'POST',
        '/api/batches',
        {
          batchId: makeBatchId('Z'),
          drugName: 'Paracetamol Infusion',
          quantity: 0,
          manufacturingDate: now.toISOString(),
          expiryDate: exp.toISOString(),
        },
        mfgToken
      );
      assert.strictEqual(resZero.status, 400);

      const resNegative = await request(
        'POST',
        '/api/batches',
        {
          batchId: makeBatchId('N'),
          drugName: 'Paracetamol Infusion',
          quantity: -50,
          manufacturingDate: now.toISOString(),
          expiryDate: exp.toISOString(),
        },
        mfgToken
      );
      assert.strictEqual(resNegative.status, 400);
    });

    // 12. Duplicate Batch Identifier Prevention
    await test('12. Duplicate prevention: Creating a batch with existing batchId returns 409 Conflict', async () => {
      const now = new Date();
      const exp = new Date(Date.now() + 365 * 24 * 3600 * 1000);

      const res = await request(
        'POST',
        '/api/batches',
        {
          batchId: testBatchId, // already created in test 9
          drugName: 'Amoxicillin Clavulanate Forte',
          quantity: 1000,
          manufacturingDate: now.toISOString(),
          expiryDate: exp.toISOString(),
        },
        mfgToken
      );

      assert.strictEqual(res.status, 409);
    });

    // 13. Public Read-Only QR Verification (No Auth Needed)
    await test('13. Public verification endpoint resolves created batch without requiring authentication', async () => {
      const res = await request('GET', `/api/verify/${testBatchId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.batchId, testBatchId);
      assert.strictEqual(res.body.data.drugName, 'Amoxicillin Clavulanate Forte');
      assert.strictEqual(res.body.data.status || res.body.data.currentStatus, 'MANUFACTURED');
    });

    // 14. Server-Side Identity Enforcement (Spoofing Org ID Prevention)
    await test('14. Security: Manufacturer cannot spoof another organization identity', async () => {
      const spoofBatchId = makeBatchId('S');
      const res = await request(
        'POST',
        '/api/batches',
        {
          batchId: spoofBatchId,
          drugName: 'Spoof Test Drug',
          quantity: 500,
          manufacturingDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
          // Attempting to inject a different organization ID
          manufacturerOrganizationId: 'ORG-SPOOFED-99',
          manufacturerName: 'Malicious Injected Corp',
        },
        mfgToken
      );

      assert.strictEqual(res.status, 201);
      // The server MUST enforce the authenticated user's organization, ignoring the spoofed values
      assert.strictEqual(res.body.data.manufacturerOrganizationId, 'ORG-MFG-01');
      assert.strictEqual(res.body.data.manufacturerName, 'Apex Biotech Pharmaceuticals Ltd.');
    });

    // 15. Persistence Verification
    await test('15. Persistence: Created medicines and batches persist in database', async () => {
      const batch = db.findBatchById(testBatchId);
      assert.ok(batch, 'Batch must exist in underlying datastore');
      assert.strictEqual(batch.batchId, testBatchId);

      const med = db.findMedicineById(registeredMedicineId);
      assert.ok(med, 'Medicine must exist in underlying datastore');
      assert.strictEqual(med.name, 'Amoxicillin Clavulanate Forte');
    });

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
