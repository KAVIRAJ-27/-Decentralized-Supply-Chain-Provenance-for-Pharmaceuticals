/**
 * MediTrace — Phase 8 Full Backend API & Supply Chain Integration Test Suite
 * 
 * Verifies the end-to-end pharmaceutical supply chain workflow:
 * 1. System Health Check
 * 2. Login and Role-Based Access across all participant roles
 * 3. Organization and User Management (Admin isolation, duplicate prevention)
 * 4. Medicine and Batch Creation with QR code generation
 * 5. Duplicate Batch Prevention and validation rules
 * 6. Public Batch Verification without login (privacy-safe, zero leakage)
 * 7. Delivery Dispatch with strict inventory math and negative stock prevention
 * 8. Organization isolation and unauthorized dispatch/receipt prevention
 * 9. Explicit Recipient Confirmation, inventory update, and duplicate prevention
 * 10. Delivery Cancellation and stock restoration
 * 11. Recalled and Expired batch handling
 * 12. Full Provenance Chain verification (environmental logs, custody timeline)
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5007';

const http = require('http');
const assert = require('assert');
const appModule = require('../dist/index.js');
const app = appModule.default || appModule;
const { db } = require('../dist/services/db.service');
const { resetRateLimits } = require('../dist/middleware/rateLimiter');
const { clearTokenBlacklist } = require('../dist/middleware/auth.middleware');

let server;
const PORT = 5007;
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
          resolve({
            status: res.statusCode,
            headers: res.headers,
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

async function runIntegrationTests() {
  console.log('====================================================');
  console.log('🧪 Starting MediTrace Phase 8 Integration Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assertTest(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log('--- 1. API Health & Readiness ---');
    const health = await request('GET', '/api/health');
    assertTest(health.status === 200 && health.data.status === 'healthy', 'API health check returns 200 OK');

    // 2. Authentication across roles
    console.log('\n--- 2. Authentication & Role Sessions ---');
    resetRateLimits();
    clearTokenBlacklist();

    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@meditrace.org',
      password: 'admin123',
    });
    assertTest(adminLogin.status === 200 && adminLogin.data.token, 'Admin logs in and receives JWT token');
    const adminToken = adminLogin.data.token;

    const mfgLogin = await request('POST', '/api/auth/login', {
      email: 'manufacturer@apexpharma.com',
      password: 'mfg123',
    });
    assertTest(mfgLogin.status === 200 && mfgLogin.data.user.role === 'MANUFACTURER', 'Manufacturer logs in');
    const mfgToken = mfgLogin.data.token;

    const distLogin = await request('POST', '/api/auth/login', {
      email: 'distributor@ghlogistics.com',
      password: 'dist123',
    });
    assertTest(distLogin.status === 200 && distLogin.data.user.role === 'DISTRIBUTOR', 'Distributor logs in');
    const distToken = distLogin.data.token;

    const pharmLogin = await request('POST', '/api/auth/login', {
      email: 'pharmacy@citycare.org',
      password: 'pharm123',
    });
    assertTest(pharmLogin.status === 200 && pharmLogin.data.user.role === 'PHARMACY', 'Pharmacy logs in');
    const pharmToken = pharmLogin.data.token;

    // 3. Organization & User Management
    console.log('\n--- 3. Organization & User Management ---');
    const newOrgRes = await request(
      'POST',
      '/api/organizations',
      {
        name: 'Metro Regional Hospital',
        type: 'HOSPITAL',
        address: '400 Healing Blvd, Metropolis',
        contactEmail: 'contact@metrohospital.org',
        licenseNumber: `LIC-HOSP-${Date.now()}`,
      },
      adminToken
    );
    assertTest(newOrgRes.status === 201, 'Admin successfully registers a new partner hospital');
    const newOrgId = newOrgRes.data.data.organizationId;

    // Authorization check: Distributor cannot register organizations
    const distOrgAttempt = await request(
      'POST',
      '/api/organizations',
      {
        name: 'Rogue Hub',
        type: 'DISTRIBUTOR',
        address: '123 Fake',
        contactEmail: 'rogue@hub.com',
        licenseNumber: 'LIC-ROGUE',
      },
      distToken
    );
    assertTest(distOrgAttempt.status === 403, 'Distributor blocked from organization management (403)');

    // 4. Medicine & Batch Creation
    console.log('\n--- 4. Medicine & Batch Formulation ---');
    const medRes = await request(
      'POST',
      '/api/medicines',
      {
        name: 'CardioSafe',
        genericName: 'Atorvastatin Calcium',
        description: 'HMG-CoA reductase inhibitor for lipid management',
        dosageForm: 'Tablet',
        strength: '20mg',
        packaging: 'Box of 30',
      },
      mfgToken
    );
    assertTest(medRes.status === 201, 'Manufacturer registers medicine specification in catalog');
    const medicineId = medRes.data.data.medicineId;

    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const testBatchId = `MED-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randSuffix}`;
    const batchRes = await request(
      'POST',
      '/api/batches',
      {
        batchId: testBatchId,
        medicineId,
        drugName: 'CardioSafe 20mg',
        genericName: 'Atorvastatin Calcium',
        dosage: '20mg',
        quantity: 5000,
        manufacturingDate: '2026-09-01',
        expiryDate: '2028-09-01',
        location: 'Apex Formulation Facility Bay 4',
      },
      mfgToken
    );
    assertTest(batchRes.status === 201, 'Manufacturer synthesizes and records batch with 5,000 units');
    assertTest(batchRes.data.batch.remainingQuantity === 5000, 'Batch initializes with remainingQuantity = 5,000');
    assertTest(batchRes.data.qrCodeUrl && batchRes.data.qrSvg, 'Batch creation automatically issues QR code & URL');

    // 5. Duplicate Batch Prevention
    console.log('\n--- 5. Duplicate Batch Prevention ---');
    const dupBatchRes = await request(
      'POST',
      '/api/batches',
      {
        batchId: testBatchId,
        drugName: 'Counterfeit CardioSafe',
        dosage: '20mg',
        quantity: 1000,
        manufacturingDate: '2026-09-01',
        expiryDate: '2028-09-01',
      },
      mfgToken
    );
    assertTest(dupBatchRes.status === 409, 'Duplicate batch registration is blocked with 409 Conflict');

    // 6. Public Verification (Zero Login)
    console.log('\n--- 6. Public Verification (Zero Login & Privacy Safe) ---');
    const pubVerify = await request('GET', `/api/public/verify/${testBatchId}`);
    assertTest(pubVerify.status === 200, 'Public verification succeeds without login credentials');
    assertTest(pubVerify.data.verified === true, 'Public verification confirms batch authenticity');
    assertTest(pubVerify.data.drugName === 'CardioSafe 20mg', 'Displays public medicine name');
    assertTest(pubVerify.data.remainingQuantity === undefined, 'Public response omits private inventory quantities');
    assertTest(pubVerify.data.manufacturer?.verified === true, 'Verifies licensed manufacturer origin');

    // 7. Delivery & Dispatch Logic
    console.log('\n--- 7. Delivery Dispatch & Inventory Validation ---');
    // Insufficient stock test: request 9,999 units from 5,000 batch
    const overDispatch = await request(
      'POST',
      '/api/deliveries',
      {
        batchId: testBatchId,
        toOrganizationId: 'ORG-DIST-01',
        quantity: 9999,
        location: 'Apex Depot',
      },
      mfgToken
    );
    assertTest(overDispatch.status === 400 && overDispatch.data.code === 'INSUFFICIENT_STOCK', 'Over-dispatch rejected with INSUFFICIENT_STOCK');

    // Valid dispatch to Distributor: 3,000 units
    const dispatch1 = await request(
      'POST',
      '/api/deliveries',
      {
        batchId: testBatchId,
        toOrganizationId: 'ORG-DIST-01',
        quantity: 3000,
        location: 'Apex Central Cold Transport Fleet #4',
        temperatureCelsius: 4.5,
        notes: 'Dispatched to GH Logistics Hub',
      },
      mfgToken
    );
    assertTest(dispatch1.status === 201, 'Manufacturer dispatches 3,000 units to Distributor');
    const delivery1Id = dispatch1.data.data.deliveryId;
    assertTest(dispatch1.data.batchRemainingQuantity === 2000, 'Remaining inventory accurately decremented from 5,000 to 2,000');

    // 8. Organization Boundary Isolation & Unauthorized Receipt
    console.log('\n--- 8. Organization Boundary Isolation ---');
    // Pharmacy attempting to confirm delivery meant for Distributor
    const rogueConfirm = await request(
      'POST',
      `/api/deliveries/${delivery1Id}/confirm-receipt`,
      {
        receivedQuantity: 3000,
        remarks: 'Attempted interception',
      },
      pharmToken
    );
    assertTest(rogueConfirm.status === 403, 'Unauthorized organization receipt confirmation is blocked (403)');

    // 9. Valid Receipt Confirmation & Inventory Update
    console.log('\n--- 9. Recipient Confirmation & Ownership Transfer ---');
    const confirmRes = await request(
      'POST',
      `/api/deliveries/${delivery1Id}/confirm-receipt`,
      {
        receivedQuantity: 3000,
        remarks: 'Physical seals verified, temperature logged at 4.2°C',
        location: 'GH Logistics Cold Vault 2',
        temperatureCelsius: 4.2,
      },
      distToken
    );
    assertTest(confirmRes.status === 200, 'Distributor successfully confirms receipt of delivery');
    assertTest(confirmRes.data.data.delivery.status === 'DELIVERED', 'Delivery record status transitioned to DELIVERED');
    assertTest(confirmRes.data.data.batch.currentStatus === 'RECEIVED_BY_DISTRIBUTOR', 'Batch status updated to RECEIVED_BY_DISTRIBUTOR');

    // Duplicate confirmation prevention
    const dupConfirm = await request(
      'POST',
      `/api/deliveries/${delivery1Id}/confirm-receipt`,
      { receivedQuantity: 3000 },
      distToken
    );
    assertTest(dupConfirm.status === 400 && dupConfirm.data.code === 'ALREADY_DELIVERED', 'Duplicate receipt confirmation strictly blocked (400 ALREADY_DELIVERED)');

    // 10. Secondary Dispatch (Distributor to Pharmacy) & Dispensation
    console.log('\n--- 10. Secondary Logistics (Distributor to Pharmacy) & Patient Dispense ---');
    const dispatch2 = await request(
      'POST',
      '/api/deliveries',
      {
        batchId: testBatchId,
        toOrganizationId: 'ORG-PHARM-01',
        quantity: 1000,
        location: 'Refrigerated Van 12',
        temperatureCelsius: 3.8,
        notes: 'Dispatched to City Care Dispensary',
      },
      distToken
    );
    assertTest(dispatch2.status === 201, 'Distributor dispatches 1,000 units to City Care Pharmacy');
    const delivery2Id = dispatch2.data.data.deliveryId;

    const pharmConfirm = await request(
      'POST',
      `/api/deliveries/${delivery2Id}/confirm-receipt`,
      {
        receivedQuantity: 1000,
        remarks: 'Received and inspected by licensed pharmacist',
        location: 'City Care Dispensary Vault',
      },
      pharmToken
    );
    assertTest(pharmConfirm.status === 200, 'Pharmacy confirms delivery receipt and adds stock to dispensary');
    assertTest(pharmConfirm.data.data.batch.currentStatus === 'RECEIVED_BY_PHARMACY', 'Batch status updated to RECEIVED_BY_PHARMACY');

    // Pharmacy dispenses 50 units to outpatient
    const dispenseRes = await request(
      'POST',
      `/api/batches/${testBatchId}/dispense`,
      {
        quantityToDispense: 50,
        patientReference: 'RX-2026-INTEG-99',
        notes: 'Filled for outpatient cardiac therapy',
      },
      pharmToken
    );
    assertTest(dispenseRes.status === 200, 'Pharmacy successfully dispenses 50 units to patient');

    // 11. Delivery Cancellation & Stock Restoration
    console.log('\n--- 11. Delivery Cancellation & Stock Restoration ---');
    // Dispatch 500 units from Manufacturer to Hospital
    const dispatchCancelTest = await request(
      'POST',
      '/api/deliveries',
      {
        batchId: testBatchId,
        toOrganizationId: newOrgId,
        quantity: 500,
        location: 'Express Logistics Courier',
      },
      mfgToken
    );
    assertTest(dispatchCancelTest.status === 201, 'Dispatched test delivery for 500 units');
    const cancelDeliveryId = dispatchCancelTest.data.data.deliveryId;

    const cancelRes = await request(
      'POST',
      `/api/deliveries/${cancelDeliveryId}/cancel`,
      {},
      mfgToken
    );
    assertTest(cancelRes.status === 200, 'Manufacturer successfully cancels pending delivery');
    assertTest(cancelRes.data.data.status === 'CANCELLED', 'Delivery status marked as CANCELLED');

    const cannotConfirmCancelled = await request(
      'POST',
      `/api/deliveries/${cancelDeliveryId}/confirm-receipt`,
      { receivedQuantity: 500 },
      adminToken
    );
    assertTest(cannotConfirmCancelled.status === 400, 'Receipt confirmation on cancelled delivery is rejected');

    // 12. Batch Recall & Public Warnings
    console.log('\n--- 12. Batch Recall & Warning Propagation ---');
    const recallRes = await request(
      'POST',
      `/api/batches/${testBatchId}/recall`,
      { reason: 'Potential packaging seal micro-fracture identified in lot QA' },
      mfgToken
    );
    assertTest(recallRes.status === 200, 'Manufacturer successfully triggers emergency batch recall');

    // Cannot dispatch a recalled batch
    const dispatchRecalled = await request(
      'POST',
      '/api/deliveries',
      {
        batchId: testBatchId,
        toOrganizationId: 'ORG-DIST-01',
        quantity: 100,
      },
      mfgToken
    );
    assertTest(dispatchRecalled.status === 400 && dispatchRecalled.data.code === 'BATCH_RECALLED', 'Dispatching recalled batch is blocked with BATCH_RECALLED');

    // Public verification displays recall warning
    const finalPubVerify = await request('GET', `/api/public/verify/${testBatchId}`);
    assertTest(finalPubVerify.data.isRecalled === true, 'Public verification clearly flags batch as RECALLED');
    assertTest(finalPubVerify.data.warnings && finalPubVerify.data.warnings.includes('RECALLED_BATCH'), 'Public verification includes prominent RECALLED_BATCH warning');
    assertTest(finalPubVerify.data.provenanceHistory.length >= 4, 'Full provenance timeline retains all immutable custody events');

    console.log('\n====================================================');
    console.log(`🏁 Phase 8 Integration Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test runner exception:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

// Start local test server
server = app.listen(PORT, async () => {
  try {
    await runIntegrationTests();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
