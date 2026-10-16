import { Response } from 'express';
import { db, BatchRecord, CustodyRecord } from '../services/db.service';
import { blockchainService } from '../services/blockchain.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { QrService } from '../services/qr.service';

export function getAllBatches(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { role, owner } = req.query as { role?: string; owner?: string };
  const orgFilter = user.role === 'MANUFACTURER' ? user.organizationId : undefined;
  const batches = db.listBatches(role, owner, orgFilter);
  return res.json({ batches });
}

export function getManufacturerDashboardStats(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const stats = db.getManufacturerStats(user.organizationId);
  return res.json({ success: true, stats, data: stats, timestamp: new Date().toISOString() });
}

export function getBatchById(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const batchId = req.params.batchId;
  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch ${batchId} not found` });
  }

  // Cross-organization boundary isolation for manufacturers
  if (
    user.role === 'MANUFACTURER' &&
    batch.manufacturerOrganizationId &&
    batch.manufacturerOrganizationId !== user.organizationId
  ) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to view batch records belonging to another manufacturer.',
    });
  }

  const history = db.getCustodyHistory(batchId);
  return res.json({ batch, history });
}

export async function createBatch(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  let {
    batchId,
    medicineId,
    drugName,
    genericName,
    dosage,
    strength,
    packaging,
    quantity,
    manufacturingDate,
    expiryDate,
    location,
  } = req.body;

  // 1. Secure Unique Identifier Generation & Collision Check
  if (!batchId || typeof batchId !== 'string' || !batchId.trim()) {
    batchId = db.generateUniqueBatchId();
  } else {
    batchId = batchId.trim().toUpperCase();
  }

  const existing = db.findBatchById(batchId);
  if (existing) {
    return res.status(409).json({ error: `Batch ID ${batchId} already exists and is registered on MediTrace` });
  }

  const txHash = blockchainService.generateTxHash();
  const qrCodeUrl = QrService.buildVerificationUrl(batchId);

  // 2. Cryptographic Digital Signature Creation (Tamper-evident authenticity)
  const digitalSignature = QrService.createBatchSignature({
    batchId,
    drugName,
    manufacturerOrganizationId: user.organizationId,
    manufacturingDate,
    expiryDate,
    quantity: Number(quantity),
  });

  const newBatch: BatchRecord = {
    batchId,
    medicineId: medicineId || undefined,
    manufacturerOrganizationId: user.organizationId,
    drugName,
    genericName: genericName || drugName,
    dosage: dosage || 'Standard Formulation',
    strength: strength || undefined,
    packaging: packaging || undefined,
    quantity: Number(quantity),
    remainingQuantity: Number(quantity),
    manufacturerName: user.organizationName || user.name,
    manufacturerAddress: user.walletAddress,
    manufacturingDate,
    expiryDate,
    currentStatus: 'MANUFACTURED',
    currentOwnerRole: 'MANUFACTURER',
    currentOwnerName: user.organizationName || user.name,
    currentOwnerAddress: user.walletAddress,
    isRecalled: false,
    qrCodeUrl,
    digitalSignature,
    blockchainTxHash: txHash,
    blockNumber: Math.floor(10000 + Math.random() * 5000),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialEvent: CustodyRecord = {
    id: `evt-${Date.now()}`,
    batchId,
    timestamp: new Date().toISOString(),
    action: 'BATCH_REGISTERED',
    status: 'MANUFACTURED',
    actorRole: 'MANUFACTURER',
    actorName: user.organizationName || user.name,
    actorAddress: user.walletAddress,
    location: location || 'Manufacturing Facility - Batch Formulation Unit',
    temperatureCelsius: 20.0,
    notes: 'Batch synthesized, cryptographically signed, and indexed into provenance ledger.',
    txHash,
  };

  // 3. Persist batch in database FIRST
  db.createBatch(newBatch, initialEvent);

  // 4. Generate real scannable ISO/IEC 18004 QR codes ONLY after successful persistence
  const qrSvg = await QrService.generateQrSvg(batchId);
  const qrPngDataUrl = await QrService.generateQrPngDataUrl(batchId);

  return res.status(201).json({
    message: 'Batch successfully created and registered on ledger',
    batch: newBatch,
    data: newBatch,
    qrCodeUrl,
    qrSvg,
    qrPngDataUrl,
    digitalSignature,
    txHash,
  });
}

export function updateBatchStatus(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const batchId = req.params.batchId;
  const { newStatus, targetRecipientAddress, location, temperatureCelsius, notes } = req.body;

  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch ${batchId} not found` });
  }

  if (batch.isRecalled) {
    return res.status(400).json({ error: 'Cannot perform actions on a recalled batch' });
  }

  const txHash = blockchainService.generateTxHash();

  let targetOwnerRole = batch.currentOwnerRole;
  let targetOwnerName = batch.currentOwnerName;
  let targetOwnerAddress = batch.currentOwnerAddress;

  if (targetRecipientAddress) {
    const recipientUser = db.listUsers().find(
      (u) => u.walletAddress.toLowerCase() === targetRecipientAddress.toLowerCase()
    );
    if (recipientUser) {
      targetOwnerRole = recipientUser.role;
      targetOwnerName = recipientUser.organizationName || recipientUser.name;
      targetOwnerAddress = recipientUser.walletAddress;
    }
  }

  const updatedBatch = db.updateBatch(
    batchId,
    {
      currentStatus: newStatus,
      currentOwnerRole: targetOwnerRole,
      currentOwnerName: targetOwnerName,
      currentOwnerAddress: targetOwnerAddress,
      blockchainTxHash: txHash,
    },
    {
      id: `evt-${Date.now()}`,
      batchId,
      timestamp: new Date().toISOString(),
      action: `STATUS_UPDATE_${newStatus}`,
      status: newStatus,
      actorRole: user.role,
      actorName: user.organizationName || user.name,
      actorAddress: user.walletAddress,
      location: location || 'Transit Node / Logistics Center',
      temperatureCelsius: temperatureCelsius !== undefined ? temperatureCelsius : 4.5,
      notes: notes || `Custody handoff / status transition to ${newStatus}`,
      txHash,
    }
  );

  return res.json({
    message: `Batch status updated to ${newStatus}`,
    batch: updatedBatch,
    txHash,
  });
}

export function dispenseBatch(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const batchId = req.params.batchId;
  const { quantityToDispense, patientReference, notes } = req.body;

  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch ${batchId} not found` });
  }

  if (batch.isRecalled) {
    return res.status(400).json({ error: 'Cannot dispense recalled medication' });
  }

  const dispenseCount = parseInt(quantityToDispense, 10);
  if (isNaN(dispenseCount) || dispenseCount <= 0) {
    return res.status(400).json({ error: 'Valid dispense quantity required' });
  }

  if (batch.remainingQuantity < dispenseCount) {
    return res.status(400).json({
      error: `Insufficient stock. Requested: ${dispenseCount}, Available: ${batch.remainingQuantity}`,
    });
  }

  const newRemaining = batch.remainingQuantity - dispenseCount;
  const newStatus = newRemaining === 0 ? 'DISPENSED' : batch.currentStatus;
  const txHash = blockchainService.generateTxHash();

  const updated = db.updateBatch(
    batchId,
    {
      remainingQuantity: newRemaining,
      currentStatus: newStatus,
      blockchainTxHash: txHash,
    },
    {
      id: `evt-${Date.now()}`,
      batchId,
      timestamp: new Date().toISOString(),
      action: 'MEDICINE_DISPENSED',
      status: newStatus,
      actorRole: 'PHARMACY',
      actorName: user.organizationName || user.name,
      actorAddress: user.walletAddress,
      location: `${user.organizationName || user.name} - Dispensary Counter`,
      temperatureCelsius: 21.0,
      notes: `Dispensed ${dispenseCount} units. Patient Ref: ${patientReference || 'Confidential'}. ${notes || ''}`,
      txHash,
    }
  );

  return res.json({
    message: `Successfully dispensed ${dispenseCount} units`,
    batch: updated,
    remainingQuantity: newRemaining,
    txHash,
  });
}

export function recallBatch(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const batchId = req.params.batchId;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string') {
    return res.status(400).json({ error: 'Recall reason is required' });
  }

  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch ${batchId} not found` });
  }

  const txHash = blockchainService.generateTxHash();

  const updated = db.updateBatch(
    batchId,
    {
      isRecalled: true,
      recallReason: reason,
      currentStatus: 'RECALLED',
      blockchainTxHash: txHash,
    },
    {
      id: `evt-${Date.now()}`,
      batchId,
      timestamp: new Date().toISOString(),
      action: 'BATCH_RECALLED_EMERGENCY',
      status: 'RECALLED',
      actorRole: user.role,
      actorName: user.organizationName || user.name,
      actorAddress: user.walletAddress,
      location: 'REGULATORY COMPLIANCE BROADCAST',
      notes: `CRITICAL RECALL ISSUED: ${reason}`,
      txHash,
    }
  );

  return res.json({
    message: `Batch ${batchId} has been successfully recalled. Alert broadcasted across network.`,
    batch: updated,
    txHash,
  });
}

/**
 * Retrieves the packaging QR Code matrix and printable GS1/GMP batch label
 * for authorized pharmaceutical participants (Manufacturer, Custodians, Admin).
 */
export async function getBatchQr(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const batchId = (req.params.batchId || '').trim().toUpperCase();

  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch ${batchId} not found` });
  }

  // Access control: Admin, Manufacturer of origin, current custodian, or authorized supply-chain actor
  const isOrigin = batch.manufacturerOrganizationId === user.organizationId;
  const isOwner = batch.currentOwnerAddress.toLowerCase() === user.walletAddress.toLowerCase();
  const isAdmin = user.role === 'ADMIN';
  const isSupplyActor = ['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'HOSPITAL'].includes(user.role);

  if (!isAdmin && !isOrigin && !isOwner && !isSupplyActor) {
    return res.status(403).json({
      error: 'Unauthorized: You do not have permissions to access the official packaging label for this batch.',
    });
  }

  const verificationUrl = QrService.buildVerificationUrl(batch.batchId);
  const qrSvg = await QrService.generateQrSvg(batch.batchId);
  const qrPngDataUrl = await QrService.generateQrPngDataUrl(batch.batchId, 600);
  const printableLabelHtml = await QrService.generatePrintableLabelHtml({
    batchId: batch.batchId,
    drugName: batch.drugName,
    genericName: batch.genericName,
    dosage: batch.dosage,
    manufacturerName: batch.manufacturerName,
    manufacturingDate: batch.manufacturingDate,
    expiryDate: batch.expiryDate,
    verificationUrl,
    signature: batch.digitalSignature?.signature,
    keyId: batch.digitalSignature?.keyId,
  });

  return res.json({
    batchId: batch.batchId,
    drugName: batch.drugName,
    genericName: batch.genericName,
    dosage: batch.dosage,
    manufacturerName: batch.manufacturerName,
    verificationUrl,
    qrSvg,
    qrPngDataUrl,
    digitalSignature: batch.digitalSignature,
    printableLabelHtml,
  });
}
