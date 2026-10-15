/**
 * MediTraceProvenance Contract ABI Definition for Ethers.js v6
 * 
 * Defines all interface methods, struct tuples, and emitted events for
 * the MediTrace decentralized provenance ledger.
 */
export const MEDITRACE_ABI = [
  // Role Administration
  'function admin() view returns (address)',
  'function roles(address) view returns (uint8)',
  'function entityNames(address) view returns (string)',
  'function registerParticipant(address _account, uint8 _role, string memory _name)',
  'function revokeRole(address _account)',

  // Batch Lifecycle Operations
  'function createBatch(string _batchId, string _drugName, string _genericName, string _dosage, uint256 _quantity, uint256 _manufacturingDate, uint256 _expiryDate, string _location)',
  'function transferToDistributor(string _batchId, address _distributor, string _dispatchLocation, int256 _tempReading, string _notes)',
  'function receiveByDistributor(string _batchId, string _warehouseLocation, int256 _tempReading, string _notes)',
  'function transferToPharmacy(string _batchId, address _pharmacy, string _dispatchLocation, int256 _tempReading, string _notes)',
  'function receiveByPharmacy(string _batchId, string _hospitalLocation, int256 _tempReading, string _notes)',
  'function dispenseMedicine(string _batchId, uint256 _dispenseQty, string _notes)',

  // Custody & Recall Governance
  'function recordCustodyEvent(string _batchId, uint8 _newStatus, string _location, int256 _tempReading, string _notes)',
  'function recallBatch(string _batchId, string _reason)',

  // Verification & Views
  'function verifyBatch(string _batchId) view returns (tuple(string batchId, string drugName, string genericName, string dosage, uint256 quantity, uint256 manufacturingDate, uint256 expiryDate, address manufacturer, address currentOwner, uint8 currentOwnerRole, uint8 status, bool isRecalled, string recallReason, uint256 createdAt, uint256 updatedAt) batch, string manufacturerName, uint256 historyCount)',
  'function isBatchRecalled(string _batchId) view returns (bool isRecalled, string recallReason)',
  'function getProvenanceHistory(string _batchId) view returns (tuple(uint256 timestamp, uint8 status, address actor, uint8 actorRole, string location, int256 temperatureCelsius, string notes)[])',
  'function getTotalBatchesCount() view returns (uint256)',
  'function getAllBatchIds() view returns (string[])',

  // Emitted Events
  'event RoleGranted(address indexed account, uint8 role, string entityName)',
  'event RoleRevoked(address indexed account, uint8 role)',
  'event BatchCreated(string indexed batchId, string drugName, address indexed manufacturer, uint256 quantity, uint256 expiryDate)',
  'event BatchStatusUpdated(string indexed batchId, uint8 status, address indexed actor, uint8 actorRole, string location)',
  'event BatchRecalled(string indexed batchId, address indexed recalledBy, string reason)',
  'event MedicineDispensed(string indexed batchId, address indexed pharmacy, uint256 dispensedQuantity)',
];

export const CONTRACT_ROLES: Record<string, number> = {
  NONE: 0,
  ADMIN: 1,
  MANUFACTURER: 2,
  DISTRIBUTOR: 3,
  PHARMACY: 4,
  CONSUMER: 5,
  HOSPITAL: 6,
};

export const CONTRACT_BATCH_STATUS: Record<string, number> = {
  MANUFACTURED: 0,
  IN_TRANSIT_TO_DISTRIBUTOR: 1,
  RECEIVED_BY_DISTRIBUTOR: 2,
  IN_TRANSIT_TO_PHARMACY: 3,
  RECEIVED_BY_PHARMACY: 4,
  DISPENSED: 5,
  RECALLED: 6,
};
