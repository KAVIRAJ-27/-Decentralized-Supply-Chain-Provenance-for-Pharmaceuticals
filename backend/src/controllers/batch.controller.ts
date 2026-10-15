import { Response } from 'express';
import { db, BatchRecord, CustodyRecord } from '../services/db.service';
import { blockchainService } from '../services/blockchain.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export function getAllBatches(req: AuthenticatedRequest, res: Response) {
  const { role, owner } = req.query as { role?: string; owner?: string };
  const batches = db.listBatches(role, owner);
  return res.json({ batches });
}

export function getBatchById(req: AuthenticatedRequest, res: Response) {
  const batchId = req.params.batchId;
  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ error: `Batch ${batchId} not found` });
  }

  const history = db.getCustodyHistory(batchId);
  return res.json({ batch, history });
}

export function createBatch(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const {
    batchId,
    drugName,
    genericName,
    dosage,
    quantity,
    manufacturingDate,
    expiryDate,
    location,
  } = req.body;

  const existing = db.findBatchById(batchId);
  if (existing) {
    return res.status(409).json({ error: `Batch ID ${batchId} is already registered on MediTrace` });
  }

  const txHash = blockchainService.generateTxHash();

  const newBatch: BatchRecord = {
    batchId,
    drugName,
    genericName: genericName || drugName,
    dosage: dosage || 'Standard Formulation',
    quantity,
    remainingQuantity: quantity,
    manufacturerName: user.organizationName || user.name,
    manufacturerAddress: user.walletAddress,
    manufacturingDate,
    expiryDate,
    currentStatus: 'MANUFACTURED',
    currentOwnerRole: 'MANUFACTURER',
    currentOwnerName: user.organizationName || user.name,
    currentOwnerAddress: user.walletAddress,
    isRecalled: false,
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
    notes: 'Batch synthesized, quality certified, and indexed into blockchain provenance ledger.',
    txHash,
  };

  db.createBatch(newBatch, initialEvent);

  return res.status(201).json({
    message: 'Batch successfully created and registered on ledger',
    batch: newBatch,
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
