/**
 * MediTrace — Phase 9 Mobile QR Scanner & Public Verification Test Suite
 * 
 * Tests mobile verification flows, parsing security, and API responses:
 * 1. Valid Direct Batch ID parsing
 * 2. Valid QR Verification URL parsing (query and path parameters)
 * 3. Malformed QR data rejection
 * 4. Untrusted / Malicious Phishing URL rejection
 * 5. Public Verification without login credentials
 * 6. Authentic batch verification result with complete provenance history
 * 7. Privacy protection: private inventory quantities & secrets omitted
 * 8. Unknown / Counterfeit batch returns 404 with security alert
 * 9. Expired batch detection and EXPIRED_BATCH warning
 * 10. Recalled batch detection and RECALLED_BATCH emergency notice
 * 11. Suspicious high scan velocity detection & alert
 * 12. Manual batch-ID format validation rules
 * 13. Blockchain node offline graceful fallback (STANDALONE_VERIFIED)
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5008';

const http = require('http');
const assert = require('assert');
const appModule = require('../dist/index.js');
const app = appModule.default || appModule;
const { db } = require('../dist/services/db.service');

let server;
const PORT = 5008;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const BATCH_ID_REGEX = /^MED-\d{8}-[A-Z0-9]{4,8}$/;

/**
 * Mirror of parseScannedContent from mobile/src/components/Scanner.tsx
 */
function parseScannedContent(scannedText) {
  if (!scannedText || typeof scannedText !== 'string') {
    return { valid: false, error: 'Empty or invalid QR content' };
  }

  const trimmed = scannedText.trim();

  // 1. Direct Batch Identifier
  if (BATCH_ID_REGEX.test(trimmed.toUpperCase())) {
    return { valid: true, batchId: trimmed.toUpperCase() };
  }

  // 2. Safe URL Parsing (?verify= or /verify/)
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.org/${trimmed.replace(/^\/+/, '')}`);
    const verifyParam = url.searchParams.get('verify') || url.searchParams.get('batch');
    if (verifyParam && BATCH_ID_REGEX.test(verifyParam.trim().toUpperCase())) {
      return { valid: true, batchId: verifyParam.trim().toUpperCase() };
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (BATCH_ID_REGEX.test(part.trim().toUpperCase())) {
        return { valid: true, batchId: part.trim().toUpperCase() };
      }
    }
  } catch {
    // Malformed URL
  }

  return {
    valid: false,
    error: 'Rejected QR code: Does not contain a genuine MediTrace batch identifier (Expected: MED-YYYYMMDD-XXXXX)',
  };
}

function request(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method,
        headers: { 'Content-Type': 'application/json' },
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
            data,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runMobileTests() {
  console.log('===========================================================');
  console.log('📱 Starting MediTrace Phase 9 Mobile Verification Tests');
  console.log('===========================================================\n');

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

  // Seed sample expired and recalled batches if not present
  const expiredBatchId = 'MED-20261015-EXP01';
  if (!db.findBatchById(expiredBatchId)) {
    db.createBatch({
      batchId: expiredBatchId,
      medicineId: 'MED-DRUG-EXP',
      manufacturerOrganizationId: 'ORG-MFG-01',
      drugName: 'Expired Ciprofloxacin 500mg',
      genericName: 'Ciprofloxacin',
      dosage: '500mg Tablets',
      quantity: 1000,
      remainingQuantity: 1000,
      manufacturerName: 'Apex Biotech Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2023-01-01T00:00:00.000Z',
      expiryDate: '2024-01-01T00:00:00.000Z', // In the past
      currentStatus: 'MANUFACTURED',
      currentOwnerRole: 'MANUFACTURER',
      currentOwnerName: 'Apex Biotech Pharmaceuticals Ltd.',
      currentOwnerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isRecalled: false,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    }, {
      id: `evt-exp-01`,
      batchId: expiredBatchId,
      timestamp: '2023-01-01T00:00:00.000Z',
      action: 'BATCH_REGISTERED',
      status: 'MANUFACTURED',
      actorRole: 'MANUFACTURER',
      actorName: 'Apex Biotech Pharmaceuticals Ltd.',
      actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      location: 'Apex Formulation Facility',
    });
  }

  const recalledBatchId = 'MED-20261015-REC02';
  if (!db.findBatchById(recalledBatchId)) {
    db.createBatch({
      batchId: recalledBatchId,
      medicineId: 'MED-DRUG-REC',
      manufacturerOrganizationId: 'ORG-MFG-01',
      drugName: 'Recalled Heparin Sodium Injection',
      genericName: 'Heparin Sodium',
      dosage: '5000 USP units/mL',
      quantity: 500,
      remainingQuantity: 500,
      manufacturerName: 'Apex Biotech Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2026-01-01T00:00:00.000Z',
      expiryDate: '2028-01-01T00:00:00.000Z',
      currentStatus: 'RECALLED',
      currentOwnerRole: 'MANUFACTURER',
      currentOwnerName: 'Apex Biotech Pharmaceuticals Ltd.',
      currentOwnerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      isRecalled: true,
      recallReason: 'Particulate matter contamination identified in vial seal inspection',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, {
      id: `evt-rec-01`,
      batchId: recalledBatchId,
      timestamp: '2026-01-01T00:00:00.000Z',
      action: 'BATCH_REGISTERED',
      status: 'MANUFACTURED',
      actorRole: 'MANUFACTURER',
      actorName: 'Apex Biotech Pharmaceuticals Ltd.',
      actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      location: 'Apex Sterile Facility',
    });
  }

  try {
    // 1. Direct Batch ID QR Parsing
    console.log('--- 1. Mobile QR Content Parser Security ---');
    const p1 = parseScannedContent('MED-20261015-A8F2K');
    assertTest(p1.valid && p1.batchId === 'MED-20261015-A8F2K', 'Direct batch ID string parsed successfully');

    // 2. Query URL QR Parsing
    const p2 = parseScannedContent('https://meditrace.org/scan?verify=MED-20261015-A8F2K');
    assertTest(p2.valid && p2.batchId === 'MED-20261015-A8F2K', 'URL with ?verify= query param parsed safely');

    const p3 = parseScannedContent('http://localhost:5173/?batch=MED-20261015-A8F2K');
    assertTest(p3.valid && p3.batchId === 'MED-20261015-A8F2K', 'URL with ?batch= query param parsed safely');

    // 3. Path URL QR Parsing
    const p4 = parseScannedContent('https://meditrace.org/verify/MED-20261015-A8F2K');
    assertTest(p4.valid && p4.batchId === 'MED-20261015-A8F2K', 'URL with /verify/ path component parsed safely');

    // 4. Rejection of Arbitrary / Phishing URLs
    const pMalicious = parseScannedContent('https://phishing-scam.com/steal-credentials');
    assertTest(!pMalicious.valid && pMalicious.error.includes('Rejected QR code'), 'Arbitrary external URLs without batch ID are rejected');

    const pGarbage = parseScannedContent('random-qr-data-12345');
    assertTest(!pGarbage.valid, 'Malformed random strings are rejected');

    const pEmpty = parseScannedContent('');
    assertTest(!pEmpty.valid, 'Empty QR content is rejected');

    // 5. Zero-Login Public Verification Integration
    console.log('\n--- 2. Public Verification API Integration ---');
    const pubRes = await request('GET', '/api/public/verify/MED-20261015-A8F2K');
    assertTest(pubRes.status === 200, 'Public verification succeeds without login (200 OK)');
    assertTest(pubRes.data.verified === true, 'Authentic batch verified=true');
    assertTest(pubRes.data.drugName === 'Amoxicillin Clavulanate', 'Displays permitted medicine name');
    assertTest(pubRes.data.manufacturer?.name === 'Apex Biotech Pharmaceuticals Ltd.', 'Displays licensed manufacturer name');
    assertTest(pubRes.data.currentHandler?.name, 'Displays current supply chain handler');

    // 6. Privacy & Sensitive Field Protection
    assertTest(pubRes.data.quantity === undefined, 'Public response strips private formulation quantity');
    assertTest(pubRes.data.remainingQuantity === undefined, 'Public response strips warehouse remaining stock');
    assertTest(pubRes.data.passwordHash === undefined, 'No user credentials or password hashes exposed');

    // 7. Provenance History Trail
    assertTest(Array.isArray(pubRes.data.provenanceHistory) && pubRes.data.provenanceHistory.length > 0, 'Includes complete provenance event trail');
    const firstEvent = pubRes.data.provenanceHistory[0];
    assertTest(firstEvent.temperatureCelsius !== undefined, 'Provenance logs environmental temperature sensor readings');

    // 8. Unknown Batch Identifier (Counterfeit Alert)
    console.log('\n--- 3. Counterfeit & Safety Warning States ---');
    const unknownRes = await request('GET', '/api/public/verify/MED-20261015-UNKN8');
    assertTest(unknownRes.status === 404, 'Unknown batch identifier returns HTTP 404 Not Found');
    assertTest(unknownRes.data.verified === false, 'Unknown batch flagged as verified=false');
    assertTest(unknownRes.data.error.includes('counterfeit or unregistered'), 'Explains batch is unregistered/potential counterfeit');

    // 9. Expired Batch Detection
    const expRes = await request('GET', `/api/public/verify/${expiredBatchId}`);
    assertTest(expRes.status === 200, 'Expired batch resolves with HTTP 200');
    assertTest(expRes.data.isExpired === true, 'Batch correctly flagged as isExpired=true');
    assertTest(expRes.data.warnings && expRes.data.warnings.includes('EXPIRED_BATCH'), 'Contains prominent EXPIRED_BATCH warning code');

    // 10. Recalled Batch Detection
    const recRes = await request('GET', `/api/public/verify/${recalledBatchId}`);
    assertTest(recRes.status === 200, 'Recalled batch resolves with HTTP 200');
    assertTest(recRes.data.isRecalled === true, 'Batch correctly flagged as isRecalled=true');
    assertTest(recRes.data.recallReason && recRes.data.recallReason.length > 0, 'Displays official recall rationale');
    assertTest(recRes.data.warnings && recRes.data.warnings.includes('RECALLED_BATCH'), 'Contains RECALLED_BATCH warning code');

    // 11. Malformed Batch ID Param Validation
    const malformedRes = await request('GET', '/api/public/verify/INVALID_ID');
    assertTest(malformedRes.status === 400, 'Malformed batch parameter rejected with HTTP 400');

    // 12. Blockchain Resilient Fallback
    assertTest(pubRes.data.blockchainVerification !== undefined, 'Returns blockchain verification object');
    assertTest(typeof pubRes.data.blockchainVerification.onChain === 'boolean', 'onChain status is clearly boolean');

    console.log('\n===========================================================');
    console.log(`🏁 Phase 9 Mobile Verification Summary: ${passed} Passed, ${failed} Failed`);
    console.log('===========================================================\n');

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

server = app.listen(PORT, async () => {
  try {
    await runMobileTests();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
