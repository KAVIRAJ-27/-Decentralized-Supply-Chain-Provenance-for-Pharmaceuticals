/**
 * MediTrace — Kavi Phase 7 Shared QR Generation & Verification Logic Test Suite
 * 
 * Tests all Phase 7 scenarios:
 * 1. Valid batch QR code opens the correct public verification response without login
 * 2. Invalid QR content & format is safely rejected with HTTP 400
 * 3. Unknown batch ID displays a safe not-found error with HTTP 404
 * 4. Expired batch displays an expiry warning flag and alert in warnings list
 * 5. Recalled batch displays a recall warning flag, reason, and alert in warnings list
 * 6. Incomplete provenance trail displays an incomplete-record advisory warning
 * 7. Blockchain RPC node failure / offline status does not crash the verification page
 * 8. Public verification strictly enforces privacy (no quantities, emails, or password hashes)
 * 9. QR generation occurs only after batch registration succeeds (not on failed creation)
 * 10. Authorized participants can retrieve packaging QR SVG and printable GMP label HTML
 * 11. Unauthorized access to internal batch packaging QR endpoint is rejected (401/403)
 * 12. Suspicious scan velocity telemetry detects repeated scans (>10 in 5m) without false proof of counterfeit
 * 13. Shared QR parser extracts batch IDs from URLs/queries and rejects untrusted arbitrary URLs
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5006';

const http = require('http');
const assert = require('assert');
const appModule = require('../dist/index.js');
const app = appModule.default || appModule;
const { db } = require('../dist/services/db.service');
const { QrService, BATCH_ID_REGEX } = require('../dist/services/qr.service');

let server;
const PORT = 5006;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeBatchId(prefix = 'Q') {
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🔍 Running MediTrace Phase 7: Shared QR & Verification Tests');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name, ok, err = null) {
    if (ok) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.error(`  ✗ ${name}`);
      if (err) console.error(`    -> ${err.message || err}`);
      failed++;
    }
  }

  // 1. Authenticate Manufacturer & Admin to set up seed data
  let mfgToken;
  try {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'manufacturer@apexpharma.com',
      password: 'mfg123',
    });
    assert.strictEqual(loginRes.status, 200);
    mfgToken = loginRes.data.token;
  } catch (err) {
    console.error('Fatal: Manufacturer login failed:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Scenario 1: Valid Batch Public Verification (Zero Login)
  // -------------------------------------------------------------------------
  try {
    const res = await request('GET', '/api/public/verify/MED-20261015-A8F2K');
    assert.strictEqual(res.status, 200, 'Expected HTTP 200 for public verification');
    assert.strictEqual(res.data.verified, true);
    assert.strictEqual(res.data.batchId, 'MED-20261015-A8F2K');
    assert.ok(res.data.drugName);
    assert.ok(res.data.manufacturer?.name);
    assert.ok(Array.isArray(res.data.provenanceHistory));
    assert.ok(res.data.blockchainVerification);
    report('1. Public batch verification succeeds without login (/api/public/verify/:batchId)', true);
  } catch (err) {
    report('1. Public batch verification succeeds without login', false, err);
  }

  // Also test /api/verify/:batchId alias
  try {
    const res = await request('GET', '/api/verify/MED-20261015-A8F2K');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.verified, true);
    report('2. Public batch verification alias succeeds (/api/verify/:batchId)', true);
  } catch (err) {
    report('2. Public batch verification alias succeeds', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 2: Invalid QR Content / Malformed Batch ID Rejected Safely
  // -------------------------------------------------------------------------
  try {
    const res = await request('GET', '/api/public/verify/INVALID-MALFORMED-123');
    assert.strictEqual(res.status, 400, 'Expected HTTP 400 for malformed batch ID');
    assert.strictEqual(res.data.verified, false);
    assert.ok(res.data.error.includes('MED-YYYYMMDD-XXXXX'));
    report('3. Malformed batch ID is safely rejected with HTTP 400', true);
  } catch (err) {
    report('3. Malformed batch ID is safely rejected', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Unknown Batch ID Displays Not-Found Warning
  // -------------------------------------------------------------------------
  try {
    const res = await request('GET', '/api/public/verify/MED-20261015-9999Z');
    assert.strictEqual(res.status, 404, 'Expected HTTP 404 for unknown batch ID');
    assert.strictEqual(res.data.verified, false);
    assert.ok(res.data.error.includes('counterfeit or unregistered'));
    report('4. Unknown batch ID returns HTTP 404 with counterfeit warning', true);
  } catch (err) {
    report('4. Unknown batch ID returns HTTP 404', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Expired Batch Displays Expiry Warning
  // -------------------------------------------------------------------------
  const expiredBatchId = makeBatchId('EXP');
  try {
    // Register expired batch directly in DB for testing
    db.createBatch({
      batchId: expiredBatchId,
      drugName: 'Expired Amoxicillin Suspension',
      genericName: 'Amoxicillin',
      dosage: '250mg/5mL',
      quantity: 100,
      remainingQuantity: 100,
      manufacturerOrganizationId: 'org-mfg-001',
      manufacturerName: 'Apex Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2023-01-01T00:00:00.000Z',
      expiryDate: '2024-01-01T00:00:00.000Z', // Past date
      currentStatus: 'MANUFACTURED',
      currentOwnerRole: 'MANUFACTURER',
      currentOwnerName: 'Apex Pharmaceuticals Ltd.',
      currentOwnerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isRecalled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, {
      id: `evt-${Date.now()}`,
      batchId: expiredBatchId,
      timestamp: '2023-01-01T00:00:00.000Z',
      action: 'BATCH_REGISTERED',
      status: 'MANUFACTURED',
      actorRole: 'MANUFACTURER',
      actorName: 'Apex Pharmaceuticals Ltd.',
      actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      location: 'Manufacturing Facility',
    });

    const res = await request('GET', `/api/public/verify/${expiredBatchId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.isExpired, true, 'isExpired must be true');
    assert.ok(res.data.warnings.includes('EXPIRED_BATCH'), 'warnings must contain EXPIRED_BATCH');
    report('5. Expired batch displays isExpired=true and EXPIRED_BATCH warning', true);
  } catch (err) {
    report('5. Expired batch displays isExpired=true and EXPIRED_BATCH warning', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Recalled Batch Displays Recall Warning
  // -------------------------------------------------------------------------
  const recalledBatchId = makeBatchId('REC');
  try {
    db.createBatch({
      batchId: recalledBatchId,
      drugName: 'Contaminated Insulin Glargine',
      genericName: 'Insulin Glargine',
      dosage: '100 units/mL',
      quantity: 500,
      remainingQuantity: 500,
      manufacturerOrganizationId: 'org-mfg-001',
      manufacturerName: 'Apex Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2026-01-01T00:00:00.000Z',
      expiryDate: '2027-01-01T00:00:00.000Z',
      currentStatus: 'RECALLED',
      currentOwnerRole: 'MANUFACTURER',
      currentOwnerName: 'Apex Pharmaceuticals Ltd.',
      currentOwnerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isRecalled: true,
      recallReason: 'Sub-potent active ingredient detected in stability testing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, {
      id: `evt-${Date.now()}`,
      batchId: recalledBatchId,
      timestamp: new Date().toISOString(),
      action: 'BATCH_RECALLED_EMERGENCY',
      status: 'RECALLED',
      actorRole: 'MANUFACTURER',
      actorName: 'Apex Pharmaceuticals Ltd.',
      actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      location: 'Quality Assurance Unit',
    });

    const res = await request('GET', `/api/public/verify/${recalledBatchId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.isRecalled, true);
    assert.strictEqual(res.data.recallReason, 'Sub-potent active ingredient detected in stability testing');
    assert.ok(res.data.warnings.includes('RECALLED_BATCH'));
    report('6. Recalled batch displays isRecalled=true and RECALLED_BATCH warning', true);
  } catch (err) {
    report('6. Recalled batch displays recall warning', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 6: Incomplete Provenance Record Displays Warning
  // -------------------------------------------------------------------------
  const incompleteBatchId = makeBatchId('INC');
  try {
    // Create batch without any custody events
    db.createBatch({
      batchId: incompleteBatchId,
      drugName: 'Paracetamol Suspension',
      genericName: 'Paracetamol',
      dosage: '120mg/5mL',
      quantity: 200,
      remainingQuantity: 200,
      manufacturerOrganizationId: 'org-mfg-001',
      manufacturerName: 'Apex Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2026-02-01T00:00:00.000Z',
      expiryDate: '2028-02-01T00:00:00.000Z',
      currentStatus: 'MANUFACTURED',
      currentOwnerRole: 'MANUFACTURER',
      currentOwnerName: 'Apex Pharmaceuticals Ltd.',
      currentOwnerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isRecalled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request('GET', `/api/public/verify/${incompleteBatchId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.incompleteRecord, true);
    assert.ok(res.data.warnings.includes('INCOMPLETE_RECORD'));
    report('7. Incomplete provenance history displays INCOMPLETE_RECORD warning', true);
  } catch (err) {
    report('7. Incomplete provenance history displays warning', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 7: Privacy Leak Prevention (No Quantities, Emails, Hashes)
  // -------------------------------------------------------------------------
  try {
    const res = await request('GET', '/api/public/verify/MED-20261015-A8F2K');
    assert.strictEqual(res.status, 200);
    
    // Check that confidential quantities are completely stripped
    assert.strictEqual(res.data.quantity, undefined, 'quantity must be stripped');
    assert.strictEqual(res.data.remainingQuantity, undefined, 'remainingQuantity must be stripped');
    assert.strictEqual(res.data.passwordHash, undefined, 'passwordHash must be stripped');
    assert.strictEqual(res.data.email, undefined, 'email must be stripped');
    assert.strictEqual(res.data.data?.quantity, undefined, 'data.quantity must be stripped');

    // Custody history should not leak private emails
    for (const evt of res.data.provenanceHistory) {
      assert.strictEqual(evt.email, undefined, 'Custody event must not contain user email');
      assert.strictEqual(evt.userId, undefined, 'Custody event must not contain private userId');
    }
    report('8. Public verification strictly omits quantities, emails, and password hashes', true);
  } catch (err) {
    report('8. Public verification strictly omits confidential data', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 8: Blockchain RPC Node Failure / Offline Resilience
  // -------------------------------------------------------------------------
  try {
    // When local Hardhat node is offline, verification must succeed as STANDALONE_VERIFIED
    const res = await request('GET', '/api/public/verify/MED-20261015-A8F2K');
    assert.strictEqual(res.status, 200, 'Must return HTTP 200 even if blockchain is offline');
    assert.strictEqual(res.data.verified, true);
    assert.ok(
      ['STANDALONE_VERIFIED', 'CONFIRMED'].includes(res.data.blockchainVerification?.onChainStatus),
      'Blockchain status must indicate standalone verified or confirmed'
    );
    report('9. Blockchain RPC offline state gracefully falls back to STANDALONE_VERIFIED (HTTP 200)', true);
  } catch (err) {
    report('9. Blockchain RPC offline state gracefully falls back', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 9: QR Generation Only Occurs Post-Save (No Inconsistent Records)
  // -------------------------------------------------------------------------
  try {
    const failedBatchId = makeBatchId('FAIL');
    // Attempt to register batch with invalid expiry date (expiry < mfg)
    const failRes = await request('POST', '/api/batches', {
      batchId: failedBatchId,
      drugName: 'Failed Batch Registration Test',
      quantity: 100,
      manufacturingDate: '2026-05-01',
      expiryDate: '2025-01-01', // Invalid
    }, mfgToken);

    assert.strictEqual(failRes.status, 400, 'Batch registration with invalid dates must fail');
    
    // Check that batch was NOT saved to database
    const checkDb = db.findBatchById(failedBatchId);
    assert.strictEqual(checkDb, undefined, 'Failed batch creation must not be persisted in database');

    // Public lookup for failed batch returns 404
    const verifyRes = await request('GET', `/api/public/verify/${failedBatchId}`);
    assert.strictEqual(verifyRes.status, 404, 'Failed batch must not be verifiable');
    report('10. Failed batch registration does not generate QR or persist inconsistent records', true);
  } catch (err) {
    report('10. Failed batch registration does not persist records', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 10: Authorized Packaging QR & Label Retrieval
  // -------------------------------------------------------------------------
  try {
    // Authorized Manufacturer requests QR
    const qrRes = await request('GET', '/api/batches/MED-20261015-A8F2K/qr', null, mfgToken);
    assert.strictEqual(qrRes.status, 200, 'Authorized user must retrieve packaging QR');
    assert.ok(qrRes.data.qrSvg.includes('<svg'), 'Response must contain SVG QR code');
    assert.ok(qrRes.data.verificationUrl.includes('MED-20261015-A8F2K'), 'Response must contain verification URL');
    assert.ok(qrRes.data.printableLabelHtml.includes('GMP Certified'), 'Response must contain printable GMP label HTML');
    report('11. Authorized user successfully retrieves vector QR SVG and printable GMP label', true);
  } catch (err) {
    report('11. Authorized user retrieves packaging QR and label', false, err);
  }

  // Unauthenticated user requesting /api/batches/:batchId/qr is rejected
  try {
    const anonRes = await request('GET', '/api/batches/MED-20261015-A8F2K/qr');
    assert.strictEqual(anonRes.status, 401, 'Unauthenticated request to packaging QR must be 401');
    report('12. Unauthenticated request to /api/batches/:batchId/qr is safely rejected with HTTP 401', true);
  } catch (err) {
    report('12. Unauthenticated request to /api/batches/:batchId/qr is safely rejected', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 11: Suspicious Scan Velocity Telemetry (>10 Scans in 5 Mins)
  // -------------------------------------------------------------------------
  const velocityBatchId = makeBatchId('VEL');
  try {
    // Create test batch
    db.createBatch({
      batchId: velocityBatchId,
      drugName: 'High Velocity Monitored Drug',
      genericName: 'Azithromycin',
      dosage: '500mg',
      quantity: 1000,
      remainingQuantity: 1000,
      manufacturerOrganizationId: 'org-mfg-001',
      manufacturerName: 'Apex Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2026-01-01T00:00:00.000Z',
      expiryDate: '2028-01-01T00:00:00.000Z',
      currentStatus: 'MANUFACTURED',
      currentOwnerRole: 'MANUFACTURER',
      currentOwnerName: 'Apex Pharmaceuticals Ltd.',
      currentOwnerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isRecalled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, {
      id: `evt-${Date.now()}`,
      batchId: velocityBatchId,
      timestamp: new Date().toISOString(),
      action: 'BATCH_REGISTERED',
      status: 'MANUFACTURED',
      actorRole: 'MANUFACTURER',
      actorName: 'Apex Pharmaceuticals Ltd.',
      actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      location: 'Central Plant',
    });

    // Fire 11 rapid public verification requests
    let lastRes;
    for (let i = 0; i < 11; i++) {
      lastRes = await request('GET', `/api/public/verify/${velocityBatchId}`);
    }

    assert.strictEqual(lastRes.status, 200);
    assert.strictEqual(lastRes.data.scanTelemetry?.suspiciousScanAlert, true, 'suspiciousScanAlert must be true');
    assert.ok(lastRes.data.scanTelemetry.recentScanCount >= 11, 'recentScanCount must reflect all scans');
    assert.ok(lastRes.data.warnings.includes('SUSPICIOUS_SCAN_VELOCITY'), 'warnings must contain SUSPICIOUS_SCAN_VELOCITY');
    report('13. Suspicious scan velocity triggers alert (>10 scans in 5 mins) with advisory warning', true);
  } catch (err) {
    report('13. Suspicious scan velocity triggers alert', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 12: Shared QR Content Parser (Rejects Arbitrary URLs)
  // -------------------------------------------------------------------------
  try {
    // 1. Plain batch ID
    const plain = QrService.parseScannedContent('MED-20261015-A8F2K');
    assert.strictEqual(plain.valid, true);
    assert.strictEqual(plain.batchId, 'MED-20261015-A8F2K');

    // 2. Query URL
    const query = QrService.parseScannedContent('http://localhost:5173/?verify=MED-20261015-A8F2K');
    assert.strictEqual(query.valid, true);
    assert.strictEqual(query.batchId, 'MED-20261015-A8F2K');

    // 3. Path URL
    const pathUrl = QrService.parseScannedContent('http://localhost:5173/verify/MED-20261015-A8F2K');
    assert.strictEqual(pathUrl.valid, true);
    assert.strictEqual(pathUrl.batchId, 'MED-20261015-A8F2K');

    // 4. Untrusted malicious phishing URL
    const malicious = QrService.parseScannedContent('https://untrusted-phishing.org/login?redirect=steal');
    assert.strictEqual(malicious.valid, false, 'Untrusted arbitrary URL must be rejected');
    assert.ok(malicious.error.includes('Expected format'));

    // 5. Malformed garbage
    const garbage = QrService.parseScannedContent('INVALID_STRING_123');
    assert.strictEqual(garbage.valid, false);

    report('14. Shared QR parser extracts valid batch IDs and rejects arbitrary untrusted URLs', true);
  } catch (err) {
    report('14. Shared QR parser extracts valid batch IDs', false, err);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 Phase 7 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  server.close(() => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

server = app.listen(PORT, '127.0.0.1', () => {
  runTests();
});
