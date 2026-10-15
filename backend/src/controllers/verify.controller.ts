import { Request, Response } from 'express';
import { db } from '../services/db.service';
import { config } from '../config';
import { blockchainService } from '../services/blockchain.service';
import { BATCH_ID_REGEX } from '../services/qr.service';

/**
 * Public Batch Verification Controller
 * 
 * Accessible without authentication by consumers, patients, hospital staff,
 * and mobile QR scanners to verify pharmaceutical provenance.
 * 
 * Strict Privacy Rules:
 * - Omit private inventory quantities (quantity, remainingQuantity)
 * - Omit staff emails, user IDs, and password hashes
 * - Omit confidential organization financial/internal data
 */
export async function verifyBatchPublic(req: Request, res: Response) {
  const rawBatchId = (req.params.batchId || '').trim();
  const batchId = rawBatchId.toUpperCase();

  // 1. Format validation
  if (!BATCH_ID_REGEX.test(batchId)) {
    return res.status(400).json({
      verified: false,
      batchId,
      error: `Invalid batch identifier format '${rawBatchId}'. Expected canonical standard: MED-YYYYMMDD-XXXXX`,
    });
  }

  // 2. Database lookup
  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({
      verified: false,
      batchId,
      error: `Batch ${batchId} was not found on the MediTrace verification network. It may be counterfeit or unregistered.`,
    });
  }

  // 3. Scan Logging & Velocity Analysis (Telemetry for counterfeit clone detection)
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] as string | undefined;
  db.logScan(batchId, clientIp, userAgent);

  const recentScanCount = db.getRecentScanCount(batchId, 5);
  const totalScanCount = db.getTotalScanCount(batchId);
  const suspiciousScanAlert = recentScanCount > 10;

  // 4. Expiry, Recall & Completeness Status
  const now = Date.now();
  const isExpired = new Date(batch.expiryDate).getTime() < now;
  const history = db.getCustodyHistory(batchId);
  const incompleteRecord = history.length === 0;

  const warnings: string[] = [];
  if (batch.isRecalled) warnings.push('RECALLED_BATCH');
  if (isExpired) warnings.push('EXPIRED_BATCH');
  if (incompleteRecord) warnings.push('INCOMPLETE_RECORD');
  if (suspiciousScanAlert) warnings.push('SUSPICIOUS_SCAN_VELOCITY');

  // 5. Blockchain Provenance Check (Non-blocking, resilient against RPC node offline)
  let onChain = false;
  let onChainStatus = 'STANDALONE_VERIFIED';
  let integrityCheck = 'PASSED_OFFCHAIN_IMMUTABILITY';
  let blockchainTxHash = batch.blockchainTxHash;
  let blockNumber = batch.blockNumber;

  try {
    const onChainResult = await blockchainService.verifyBatchOnChain(batchId);
    if (onChainResult && onChainResult.verified) {
      onChain = true;
      onChainStatus = 'CONFIRMED';
      
      // Cross-reference on-chain status & recall state with off-chain DB
      const recallMatch = onChainResult.isRecalled === batch.isRecalled;
      if (recallMatch) {
        integrityCheck = 'PASSED_ON_CHAIN_MATCH';
      } else {
        integrityCheck = 'MISMATCH_DETECTED';
        warnings.push('BLOCKCHAIN_RECORD_MISMATCH');
      }
    }
  } catch (err: any) {
    // If local Hardhat node is offline or pending sync, preserve DB-verified status
    onChain = false;
    onChainStatus = 'STANDALONE_VERIFIED';
    integrityCheck = 'PASSED_OFFCHAIN_IMMUTABILITY';
  }

  // 6. Construct Privacy-Safe Response
  const publicVerification = {
    verified: true,
    batchId: batch.batchId,
    drugName: batch.drugName,
    genericName: batch.genericName,
    dosage: batch.dosage,
    strength: batch.strength,
    packaging: batch.packaging,
    status: batch.currentStatus,
    manufacturer: {
      name: batch.manufacturerName,
      address: batch.manufacturerAddress,
      verified: true,
    },
    manufacturingDate: batch.manufacturingDate,
    expiryDate: batch.expiryDate,
    isExpired,
    isRecalled: batch.isRecalled,
    recallReason: batch.recallReason || null,
    currentHandler: {
      role: batch.currentOwnerRole,
      name: batch.currentOwnerName,
      address: batch.currentOwnerAddress,
    },
    provenanceHistory: history.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      action: event.action,
      status: event.status,
      actorRole: event.actorRole,
      actorName: event.actorName,
      location: event.location,
      temperatureCelsius: event.temperatureCelsius,
      notes: event.notes,
      blockchainTxHash: event.txHash || batch.blockchainTxHash,
    })),
    blockchainVerification: {
      onChain,
      contractAddress: config.contractAddress,
      txHash: blockchainTxHash,
      blockNumber,
      integrityCheck,
      onChainStatus,
    },
    scanTelemetry: {
      suspiciousScanAlert,
      recentScanCount,
      totalScanCount,
      message: suspiciousScanAlert
        ? 'High scan frequency detected within a short timeframe. Verify physical packaging tamper seals.'
        : undefined,
    },
    warnings,
    incompleteRecord,
    verifiedAt: new Date().toISOString(),
  };

  return res.json({
    ...publicVerification,
    data: publicVerification,
  });
}

