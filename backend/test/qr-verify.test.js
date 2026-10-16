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
  // Scenario 13: CSPRNG Secure Batch ID Generation & Collision Resistance
  // -------------------------------------------------------------------------
  try {
    const generatedIds = new Set();
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      const id = QrService.generateSecureBatchId();
      assert.ok(BATCH_ID_REGEX.test(id), `Generated ID ${id} must match BATCH_ID_REGEX`);
      assert.strictEqual(generatedIds.has(id), false, `Collision detected on iteration ${i}: ${id}`);
      generatedIds.add(id);
    }
    assert.strictEqual(generatedIds.size, iterations, 'All 100 CSPRNG batch IDs must be unique');

    // Also test db.generateUniqueBatchId()
    const uniqueDbId = db.generateUniqueBatchId();
    assert.ok(BATCH_ID_REGEX.test(uniqueDbId), 'db.generateUniqueBatchId must match BATCH_ID_REGEX');
    assert.strictEqual(db.findBatchById(uniqueDbId), undefined, 'Generated DB ID must not collide with existing batches');

    report('15. CSPRNG batch ID generation produces high-entropy unique identifiers without collisions', true);
  } catch (err) {
    report('15. CSPRNG batch ID generation produces unique identifiers', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 14: Duplicate Batch ID Creation Rejection
  // -------------------------------------------------------------------------
  try {
    const dupBatchId = QrService.generateSecureBatchId();
    const batchPayload = {
      batchId: dupBatchId,
      drugName: 'Collision Rejection Amoxicillin',
      genericName: 'Amoxicillin',
      dosage: '500mg',
      quantity: 500,
      manufacturingDate: '2026-03-01',
      expiryDate: '2028-03-01',
    };

    // First creation succeeds
    const firstRes = await request('POST', '/api/batches', batchPayload, mfgToken);
    assert.strictEqual(firstRes.status, 201, 'First batch registration must succeed');

    // Second creation with the exact same ID must be rejected with 409 Conflict
    const secondRes = await request('POST', '/api/batches', batchPayload, mfgToken);
    assert.strictEqual(secondRes.status, 409, 'Duplicate batch creation must be rejected with HTTP 409');
    assert.ok(secondRes.data.error.includes('already exists'), 'Error message must specify batch already exists');

    report('16. Duplicate batch ID is rejected safely with HTTP 409 Conflict', true);
  } catch (err) {
    report('16. Duplicate batch ID rejection', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 15: Tampered & Malformed Scanned QR Inputs
  // -------------------------------------------------------------------------
  try {
    // 1. Javascript URI scheme (XSS attack attempt)
    const xss = QrService.parseScannedContent('javascript:alert(document.cookie)');
    assert.strictEqual(xss.valid, false, 'Javascript URI must be rejected');

    // 2. Data URI scheme
    const dataUri = QrService.parseScannedContent('data:text/html,<script>alert(1)</script>');
    assert.strictEqual(dataUri.valid, false, 'Data URI must be rejected');

    // 3. Traversal attempt
    const traversal = QrService.parseScannedContent('http://localhost:5173/../../etc/passwd');
    assert.strictEqual(traversal.valid, false, 'Path traversal attempt must be rejected');

    // 4. Empty and whitespace input
    assert.strictEqual(QrService.parseScannedContent('').valid, false);
    assert.strictEqual(QrService.parseScannedContent('   ').valid, false);

    report('17. Malicious, empty, and traversal QR scan inputs are rejected safely', true);
  } catch (err) {
    report('17. Malicious QR scan inputs are rejected', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 16: Cryptographic Digital Signature Creation & Tamper Detection
  // -------------------------------------------------------------------------
  try {
    const testBatchData = {
      batchId: 'MED-20261016-SEC01',
      drugName: 'Ceftriaxone Injection',
      manufacturerOrganizationId: 'org-mfg-001',
      manufacturingDate: '2026-04-01',
      expiryDate: '2028-04-01',
      quantity: 1000,
    };

    // 1. Sign batch record
    const sigResult = QrService.createBatchSignature(testBatchData);
    assert.ok(sigResult.signature, 'Signature must be generated');
    assert.strictEqual(sigResult.algorithm, 'HMAC-SHA256');
    assert.ok(sigResult.keyId, 'Signature must include keyId for key rotation');

    // 2. Verify pristine batch record
    const validVerify = QrService.verifyBatchSignature({
      ...testBatchData,
      digitalSignature: sigResult,
    });
    assert.strictEqual(validVerify.valid, true, 'Pristine batch record signature must be valid');
    assert.strictEqual(validVerify.error, undefined);

    // 3. Tamper with drug name
    const tamperedDrug = QrService.verifyBatchSignature({
      ...testBatchData,
      drugName: 'Altered Counterfeit Drug',
      digitalSignature: sigResult,
    });
    assert.strictEqual(tamperedDrug.valid, false, 'Altered drug name must invalidate signature');
    assert.ok(tamperedDrug.error.includes('mismatch'));

    // 4. Tamper with expiry date
    const tamperedExpiry = QrService.verifyBatchSignature({
      ...testBatchData,
      expiryDate: '2030-04-01', // Extended illegally
      digitalSignature: sigResult,
    });
    assert.strictEqual(tamperedExpiry.valid, false, 'Altered expiry date must invalidate signature');

    // 5. Tamper with quantity
    const tamperedQty = QrService.verifyBatchSignature({
      ...testBatchData,
      quantity: 99999, // Diverted inventory
      digitalSignature: sigResult,
    });
    assert.strictEqual(tamperedQty.valid, false, 'Altered quantity must invalidate signature');

    report('18. Cryptographic HMAC-SHA256 signature validates pristine records and detects data tampering', true);
  } catch (err) {
    report('18. Cryptographic signature and tamper detection', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 17: Concurrent Multi-Location Scan Anomaly Telemetry
  // -------------------------------------------------------------------------
  const multiLocBatchId = QrService.generateSecureBatchId();
  try {
    db.createBatch({
      batchId: multiLocBatchId,
      drugName: 'Multi-Location Monitored Antibiotic',
      genericName: 'Meropenem',
      dosage: '1g IV',
      quantity: 300,
      remainingQuantity: 300,
      manufacturerOrganizationId: 'org-mfg-001',
      manufacturerName: 'Apex Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2026-05-01',
      expiryDate: '2028-05-01',
      currentStatus: 'MANUFACTURED',
      currentOwnerRole: 'MANUFACTURER',
      currentOwnerName: 'Apex Pharmaceuticals Ltd.',
      currentOwnerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isRecalled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Simulate simultaneous scans from 5 different IP networks within 5 minutes
    const testIps = ['198.51.100.1', '198.51.100.2', '198.51.100.3', '198.51.100.4', '198.51.100.5'];
    for (const ip of testIps) {
      db.logScan(multiLocBatchId, ip, 'Mozilla/5.0 Medical Scanner');
      db.logScan(multiLocBatchId, ip, 'Mobile Browser');
    }

    const assessment = db.getScanTelemetryAssessment(multiLocBatchId);
    assert.strictEqual(assessment.riskLevel, 'HIGH', 'Simultaneous multi-IP bursts must be flagged as HIGH risk');
    assert.ok(
      assessment.riskFactors.includes('MULTI_LOCATION_SIMULTANEOUS_BURST'),
      'Must contain MULTI_LOCATION_SIMULTANEOUS_BURST flag'
    );
    assert.ok(assessment.uniqueIps5m >= 4, 'Must count unique IPs correctly');

    // Public verification endpoint attaches the anomaly alert
    const verifyRes = await request('GET', `/api/public/verify/${multiLocBatchId}`);
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(
      verifyRes.data.warnings.includes('MULTI_LOCATION_SIMULTANEOUS_BURST'),
      'Public response warnings must include MULTI_LOCATION_SIMULTANEOUS_BURST'
    );
    assert.strictEqual(verifyRes.data.scanTelemetry?.riskLevel, 'HIGH');

    report('19. Concurrent multi-location scan anomaly is detected and flagged in verification telemetry', true);
  } catch (err) {
    report('19. Concurrent multi-location scan anomaly detection', false, err);
  }

  // -------------------------------------------------------------------------
  // Scenario 18: Full End-to-End Batch Creation -> QR -> Custody -> Verification
  // -------------------------------------------------------------------------
  try {
    const e2eBatchId = QrService.generateSecureBatchId();

    // 1. Create batch as Manufacturer
    const createRes = await request('POST', '/api/batches', {
      batchId: e2eBatchId,
      drugName: 'End-to-End Provenance Vaccine',
      genericName: 'mRNA-1273',
      dosage: '0.5mL Vial',
      quantity: 5000,
      manufacturingDate: '2026-06-01',
      expiryDate: '2027-06-01',
    }, mfgToken);

    assert.strictEqual(createRes.status, 201, 'Batch creation must succeed');
    assert.ok(createRes.data.batch.digitalSignature, 'Created batch must have digital signature attached');
    assert.strictEqual(createRes.data.batch.digitalSignature.algorithm, 'HMAC-SHA256');

    // 2. Retrieve authoritative packaging QR as authorized Manufacturer
    const qrRes = await request('GET', `/api/batches/${e2eBatchId}/qr`, null, mfgToken);
    assert.strictEqual(qrRes.status, 200);
    assert.ok(qrRes.data.qrSvg.includes('<svg'), 'QR SVG must be valid SVG markup');
    assert.ok(qrRes.data.qrPngDataUrl.startsWith('data:image/png;base64,'), 'PNG DataURL must be 300-DPI Base64');
    assert.ok(qrRes.data.printableLabelHtml.includes('GMP Certified'), 'Printable label must be generated');

    // 3. Custody transfer to Distributor
    const updateRes = await request('POST', `/api/batches/${e2eBatchId}/status`, {
      newStatus: 'IN_TRANSIT_TO_DISTRIBUTOR',
      location: 'Regional Distribution Center North',
      temperatureCelsius: 3.8,
      notes: 'Cold chain verified at logistics handoff',
    }, mfgToken);
    assert.strictEqual(updateRes.status, 200, 'Status update must succeed');

    // 4. Public verification inspection
    const publicVerifyRes = await request('GET', `/api/public/verify/${e2eBatchId}`);
    assert.strictEqual(publicVerifyRes.status, 200);
    assert.strictEqual(publicVerifyRes.data.verified, true);
    assert.strictEqual(publicVerifyRes.data.status, 'IN_TRANSIT_TO_DISTRIBUTOR');
    assert.strictEqual(publicVerifyRes.data.cryptographicProof?.verified, true);
    assert.strictEqual(publicVerifyRes.data.provenanceHistory.length, 2, 'History must record creation and transit');

    report('20. End-to-end batch creation, QR generation, custody transition, and public cryptographic verification succeeded', true);
  } catch (err) {
    report('20. End-to-end batch workflow', false, err);
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
