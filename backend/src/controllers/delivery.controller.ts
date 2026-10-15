import { Response } from 'express';
import { db, DeliveryRecord, ReceiptConfirmationRecord, CustodyRecord } from '../services/db.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { blockchainService } from '../services/blockchain.service';

/**
 * List deliveries
 * - ADMIN can view all or filter by sender/receiver organization
 * - Other roles see inbound and outbound deliveries for their organization
 */
export function getAllDeliveries(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { status, batchId, direction } = req.query as {
    status?: string;
    batchId?: string;
    direction?: 'inbound' | 'outbound';
  };

  let deliveries: DeliveryRecord[] = [];

  if (user.role === 'ADMIN') {
    deliveries = db.listDeliveries({
      status,
      batchId,
    });
  } else {
    // Non-admin roles strictly see their organization's deliveries
    if (direction === 'inbound') {
      deliveries = db.listDeliveries({
        toOrganizationId: user.organizationId,
        status,
        batchId,
      });
    } else if (direction === 'outbound') {
      deliveries = db.listDeliveries({
        fromOrganizationId: user.organizationId,
        status,
        batchId,
      });
    } else {
      // Inbound or Outbound for their organization
      const all = db.listDeliveries({ status, batchId });
      deliveries = all.filter(
        (d) => d.fromOrganizationId === user.organizationId || d.toOrganizationId === user.organizationId
      );
    }
  }

  return res.json({
    success: true,
    data: deliveries,
    count: deliveries.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get delivery details by ID with receipt confirmation (if completed)
 */
export function getDeliveryById(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { deliveryId } = req.params;

  const delivery = db.findDeliveryById(deliveryId);
  if (!delivery) {
    return res.status(404).json({
      success: false,
      error: `Delivery with ID '${deliveryId}' not found.`,
      code: 'NOT_FOUND',
    });
  }

  // Cross-organization boundary isolation
  if (
    user.role !== 'ADMIN' &&
    delivery.fromOrganizationId !== user.organizationId &&
    delivery.toOrganizationId !== user.organizationId
  ) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have permission to view this delivery record.',
      code: 'FORBIDDEN',
    });
  }

  const confirmation = db.findReceiptConfirmation(deliveryId);

  return res.json({
    success: true,
    data: {
      ...delivery,
      confirmation: confirmation || null,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Dispatch Stock / Create Delivery
 * - Authorized roles: MANUFACTURER, DISTRIBUTOR, ADMIN
 * - Deducts from batch remainingQuantity
 * - Validates recipient organization exists and is ACTIVE
 * - Emits custody event & non-blocking blockchain event
 */
export async function createDelivery(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const {
    batchId,
    toOrganizationId,
    quantity,
    expectedDeliveryDate,
    location,
    temperatureCelsius,
    notes,
  } = req.body;

  // 1. Validate inputs
  if (!batchId || typeof batchId !== 'string') {
    return res.status(400).json({ success: false, error: 'batchId is required' });
  }

  const parsedQty = parseInt(quantity, 10);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    return res.status(400).json({ success: false, error: 'quantity must be a positive integer greater than 0' });
  }

  if (!toOrganizationId || typeof toOrganizationId !== 'string') {
    return res.status(400).json({ success: false, error: 'toOrganizationId is required' });
  }

  // 2. Validate batch
  const batch = db.findBatchById(batchId);
  if (!batch) {
    return res.status(404).json({ success: false, error: `Batch '${batchId}' not found` });
  }

  if (batch.isRecalled) {
    return res.status(400).json({
      success: false,
      error: `Cannot dispatch batch '${batchId}' because it has been RECALLED.`,
      code: 'BATCH_RECALLED',
    });
  }

  if (new Date(batch.expiryDate).getTime() < Date.now()) {
    return res.status(400).json({
      success: false,
      error: `Cannot dispatch batch '${batchId}' because it expired on ${batch.expiryDate}.`,
      code: 'BATCH_EXPIRED',
    });
  }

  // 3. Inventory constraint: prevent negative inventory
  if (batch.remainingQuantity < parsedQty) {
    return res.status(400).json({
      success: false,
      error: `Insufficient stock in batch '${batchId}'. Available: ${batch.remainingQuantity}, requested: ${parsedQty}.`,
      code: 'INSUFFICIENT_STOCK',
      availableQuantity: batch.remainingQuantity,
    });
  }

  // 4. Validate sender authority
  if (user.role !== 'ADMIN') {
    const isOwnerOrg =
      batch.manufacturerOrganizationId === user.organizationId ||
      batch.currentOwnerName === user.organizationName;
    if (!isOwnerOrg && batch.currentOwnerRole !== user.role) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Your organization does not hold custody of batch '${batchId}'.`,
        code: 'FORBIDDEN',
      });
    }
  }

  // 5. Validate recipient organization
  const recipientOrg = db.findOrganizationById(toOrganizationId);
  if (!recipientOrg) {
    return res.status(404).json({
      success: false,
      error: `Recipient organization '${toOrganizationId}' not found.`,
      code: 'ORG_NOT_FOUND',
    });
  }

  if (recipientOrg.status !== 'ACTIVE') {
    return res.status(400).json({
      success: false,
      error: `Recipient organization '${recipientOrg.name}' is ${recipientOrg.status}. Only ACTIVE organizations can receive shipments.`,
      code: 'ORG_INACTIVE',
    });
  }

  if (recipientOrg.organizationId === user.organizationId) {
    return res.status(400).json({
      success: false,
      error: 'Sender and recipient organization cannot be identical.',
      code: 'INVALID_RECIPIENT',
    });
  }

  // 6. Deduct inventory and update batch status
  batch.remainingQuantity -= parsedQty;

  let newBatchStatus = 'IN_TRANSIT';
  if (recipientOrg.type === 'DISTRIBUTOR') {
    newBatchStatus = 'IN_TRANSIT_TO_DISTRIBUTOR';
  } else if (recipientOrg.type === 'PHARMACY' || recipientOrg.type === 'HOSPITAL') {
    newBatchStatus = 'IN_TRANSIT_TO_PHARMACY';
  }
  batch.currentStatus = newBatchStatus;
  batch.updatedAt = new Date().toISOString();

  // 7. Generate Delivery Record
  const deliveryId = `DEL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const senderOrg = db.findOrganizationById(user.organizationId) || {
    organizationId: user.organizationId,
    name: user.organizationName || user.name,
    address: 'Regional Depot',
  };

  const txHash = blockchainService.generateTxHash();

  const newDelivery: DeliveryRecord = {
    deliveryId,
    batchId: batch.batchId,
    drugName: batch.drugName,
    fromOrganizationId: user.organizationId,
    fromOrganizationName: senderOrg.name,
    toOrganizationId: recipientOrg.organizationId,
    toOrganizationName: recipientOrg.name,
    quantity: parsedQty,
    dispatchDate: new Date().toISOString(),
    expectedDeliveryDate: expectedDeliveryDate || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    status: 'IN_TRANSIT',
    location: location || senderOrg.address || 'Distribution Logistics Hub',
    temperatureCelsius: temperatureCelsius !== undefined ? Number(temperatureCelsius) : 20.0,
    notes: notes || `Dispatched ${parsedQty} units to ${recipientOrg.name}`,
    blockchainTxHash: txHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 8. Log custody history
  const custodyEvent: CustodyRecord = {
    id: `evt-${Date.now()}`,
    batchId: batch.batchId,
    timestamp: new Date().toISOString(),
    action: 'DELIVERY_DISPATCHED',
    status: newBatchStatus,
    actorRole: user.role,
    actorName: user.organizationName || user.name,
    actorAddress: user.walletAddress,
    location: location || senderOrg.address || 'Logistics Depot',
    temperatureCelsius: temperatureCelsius !== undefined ? Number(temperatureCelsius) : 20.0,
    notes: `Dispatched delivery ${deliveryId} (${parsedQty} units) destined for ${recipientOrg.name}`,
    txHash,
  };

  db.createDelivery(newDelivery, custodyEvent);

  // 9. Non-blocking blockchain custody record
  blockchainService
    .recordCustodyEventOnChain({
      batchId: batch.batchId,
      status: newBatchStatus,
      location: custodyEvent.location,
      temperatureCelsius: custodyEvent.temperatureCelsius,
      notes: custodyEvent.notes,
    })
    .catch((err) => {
      // Graceful fallback: blockchain node offline or contract not configured
      console.warn(`[Blockchain Service] Non-blocking delivery dispatch log skipped: ${err.message}`);
    });

  return res.status(201).json({
    success: true,
    message: `Delivery ${deliveryId} created successfully. ${parsedQty} units dispatched to ${recipientOrg.name}.`,
    data: newDelivery,
    batchRemainingQuantity: batch.remainingQuantity,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Confirm Delivery Receipt
 * - Authorized roles: DISTRIBUTOR, PHARMACY, HOSPITAL, ADMIN
 * - Strictly prevents duplicate confirmations
 * - Must be confirmed by recipient organization
 * - Updates inventory, batch ownership and status
 */
export async function confirmDeliveryReceipt(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { deliveryId } = req.params;
  const { receivedQuantity, remarks, location, temperatureCelsius } = req.body;

  // 1. Lookup delivery
  const delivery = db.findDeliveryById(deliveryId);
  if (!delivery) {
    return res.status(404).json({
      success: false,
      error: `Delivery '${deliveryId}' not found`,
      code: 'NOT_FOUND',
    });
  }

  // 2. Strict status check: Prevent duplicate confirmation
  if (delivery.status === 'DELIVERED') {
    return res.status(400).json({
      success: false,
      error: `Delivery '${deliveryId}' has already been confirmed as delivered. Duplicate confirmations are rejected.`,
      code: 'ALREADY_DELIVERED',
    });
  }

  if (delivery.status === 'CANCELLED') {
    return res.status(400).json({
      success: false,
      error: `Cannot confirm receipt for cancelled delivery '${deliveryId}'.`,
      code: 'DELIVERY_CANCELLED',
    });
  }

  // 3. Organization authorization: only recipient organization or ADMIN
  if (user.role !== 'ADMIN' && delivery.toOrganizationId !== user.organizationId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Only the intended recipient organization (${delivery.toOrganizationName}) can confirm receipt of this delivery.`,
      code: 'FORBIDDEN_RECIPIENT_MISMATCH',
    });
  }

  // 4. Validate quantity
  const qty = receivedQuantity !== undefined ? parseInt(receivedQuantity, 10) : delivery.quantity;
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({
      success: false,
      error: 'receivedQuantity must be a positive integer greater than 0',
      code: 'INVALID_QUANTITY',
    });
  }

  if (qty > delivery.quantity) {
    return res.status(400).json({
      success: false,
      error: `Received quantity (${qty}) cannot exceed dispatched quantity (${delivery.quantity})`,
      code: 'EXCESS_QUANTITY',
    });
  }

  const txHash = blockchainService.generateTxHash();
  const confirmationId = `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const confirmation: ReceiptConfirmationRecord = {
    confirmationId,
    deliveryId: delivery.deliveryId,
    batchId: delivery.batchId,
    receivedByUserId: user.id,
    receivedByUserName: user.name,
    receivedByOrganizationId: user.organizationId,
    receivedQuantity: qty,
    receivedDate: new Date().toISOString(),
    remarks: remarks || `Receipt confirmed by ${user.name} (${user.organizationName || user.role})`,
    location: location || 'Receiving Facility Inspection Bay',
    temperatureCelsius: temperatureCelsius !== undefined ? Number(temperatureCelsius) : 20.0,
    blockchainTxHash: txHash,
    createdAt: new Date().toISOString(),
  };

  // Determine new batch status based on recipient role
  const recipientOrg = db.findOrganizationById(delivery.toOrganizationId);
  const orgType = recipientOrg?.type || (user.role === 'DISTRIBUTOR' ? 'DISTRIBUTOR' : 'PHARMACY');
  const targetBatchStatus =
    orgType === 'DISTRIBUTOR'
      ? 'RECEIVED_BY_DISTRIBUTOR'
      : orgType === 'HOSPITAL'
      ? 'RECEIVED_BY_HOSPITAL'
      : 'RECEIVED_BY_PHARMACY';

  const custodyEvent: CustodyRecord = {
    id: `evt-${Date.now()}`,
    batchId: delivery.batchId,
    timestamp: new Date().toISOString(),
    action: 'DELIVERY_RECEIVED',
    status: targetBatchStatus,
    actorRole: user.role,
    actorName: user.organizationName || user.name,
    actorAddress: user.walletAddress,
    location: location || recipientOrg?.address || 'Receiving Quarantine & Stock Intake',
    temperatureCelsius: temperatureCelsius !== undefined ? Number(temperatureCelsius) : 20.0,
    notes: `Confirmed delivery receipt of ${qty} units. Remarks: ${remarks || 'Package verified intact'}`,
    txHash,
  };

  try {
    const result = db.confirmDeliveryReceipt(deliveryId, confirmation, custodyEvent);

    // Non-blocking blockchain custody record
    blockchainService
      .recordCustodyEventOnChain({
        batchId: delivery.batchId,
        status: targetBatchStatus,
        location: custodyEvent.location,
        temperatureCelsius: custodyEvent.temperatureCelsius,
        notes: custodyEvent.notes,
      })
      .catch((err) => {
        console.warn(`[Blockchain Service] Non-blocking delivery receipt log skipped: ${err.message}`);
      });

    return res.json({
      success: true,
      message: `Delivery ${deliveryId} successfully confirmed. Stock received into active inventory.`,
      data: {
        delivery: result.delivery,
        confirmation: result.confirmation,
        batch: {
          batchId: result.batch.batchId,
          drugName: result.batch.drugName,
          currentStatus: result.batch.currentStatus,
          currentOwnerRole: result.batch.currentOwnerRole,
          currentOwnerName: result.batch.currentOwnerName,
          remainingQuantity: result.batch.remainingQuantity,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
}

/**
 * Cancel Delivery
 * - Authorized roles: MANUFACTURER, DISTRIBUTOR, ADMIN
 * - Restores reserved batch remaining quantity
 */
export function cancelDelivery(req: AuthenticatedRequest, res: Response) {
  const user = req.user!;
  const { deliveryId } = req.params;

  const delivery = db.findDeliveryById(deliveryId);
  if (!delivery) {
    return res.status(404).json({
      success: false,
      error: `Delivery '${deliveryId}' not found`,
      code: 'NOT_FOUND',
    });
  }

  // Cross-organization boundary isolation: Only sender organization or ADMIN can cancel
  if (user.role !== 'ADMIN' && delivery.fromOrganizationId !== user.organizationId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only the dispatching organization or Admin can cancel a delivery.',
      code: 'FORBIDDEN',
    });
  }

  if (delivery.status === 'DELIVERED') {
    return res.status(400).json({
      success: false,
      error: 'Cannot cancel a delivery that has already been confirmed as delivered.',
      code: 'ALREADY_DELIVERED',
    });
  }

  const custodyEvent: CustodyRecord = {
    id: `evt-${Date.now()}`,
    batchId: delivery.batchId,
    timestamp: new Date().toISOString(),
    action: 'DELIVERY_CANCELLED',
    status: 'IN_TRANSIT',
    actorRole: user.role,
    actorName: user.organizationName || user.name,
    actorAddress: user.walletAddress,
    location: delivery.location,
    notes: `Delivery ${deliveryId} cancelled by ${user.name}. ${delivery.quantity} units returned to inventory.`,
  };

  try {
    const updated = db.cancelDelivery(deliveryId, custodyEvent);
    return res.json({
      success: true,
      message: `Delivery ${deliveryId} has been cancelled. Quantity restored to batch inventory.`,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
}
