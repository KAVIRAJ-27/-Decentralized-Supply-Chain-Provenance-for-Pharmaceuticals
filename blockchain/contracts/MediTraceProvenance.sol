// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IMediTraceProvenance.sol";

/**
 * @title MediTraceProvenance
 * @notice Production-grade decentralized provenance ledger for pharmaceutical batch verification
 * @dev Manages roles, batch tracking from manufacture to dispensing, custody changes, and recall
 */
contract MediTraceProvenance is IMediTraceProvenance {
    address public admin;

    // Role mapping: address => Role
    mapping(address => Role) public roles;
    mapping(address => string) public entityNames;

    // Batch mapping: batchId => MedicineBatch
    mapping(string => MedicineBatch) private batches;
    mapping(string => bool) private batchExists;
    string[] private allBatchIds;

    // Custody history: batchId => array of ProvenanceRecord
    mapping(string => ProvenanceRecord[]) private batchHistory;

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "MediTrace: Caller is not admin");
        _;
    }

    modifier onlyRole(Role requiredRole) {
        require(roles[msg.sender] == requiredRole, "MediTrace: Unauthorized role");
        _;
    }

    modifier onlyPharmacyOrHospital() {
        require(
            roles[msg.sender] == Role.PHARMACY || roles[msg.sender] == Role.HOSPITAL,
            "MediTrace: Caller must be pharmacy or hospital"
        );
        _;
    }

    modifier batchMustExist(string memory _batchId) {
        require(batchExists[_batchId], "MediTrace: Batch does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
        roles[msg.sender] = Role.ADMIN;
        entityNames[msg.sender] = "MediTrace Super Admin";
        emit RoleGranted(msg.sender, Role.ADMIN, "MediTrace Super Admin");
    }

    // ========================================================================
    // Participant Role Administration
    // ========================================================================

    function registerParticipant(
        address _account,
        Role _role,
        string memory _name
    ) external onlyAdmin {
        require(_account != address(0), "MediTrace: Zero address not allowed");
        require(_role != Role.NONE, "MediTrace: Cannot assign NONE role");
        
        roles[_account] = _role;
        entityNames[_account] = _name;
        emit RoleGranted(_account, _role, _name);
    }

    function revokeRole(address _account) external onlyAdmin {
        require(_account != admin, "MediTrace: Cannot revoke super admin");
        Role previousRole = roles[_account];
        roles[_account] = Role.NONE;
        emit RoleRevoked(_account, previousRole);
    }

    // ========================================================================
    // Manufacturer Operations
    // ========================================================================

    function createBatch(
        string memory _batchId,
        string memory _drugName,
        string memory _genericName,
        string memory _dosage,
        uint256 _quantity,
        uint256 _manufacturingDate,
        uint256 _expiryDate,
        string memory _location
    ) external onlyRole(Role.MANUFACTURER) {
        require(bytes(_batchId).length > 0, "MediTrace: Batch ID cannot be empty");
        require(!batchExists[_batchId], "MediTrace: Batch ID already registered");
        require(_quantity > 0, "MediTrace: Quantity must be > 0");
        require(_expiryDate > _manufacturingDate, "MediTrace: Expiry must be after manufacturing date");

        MedicineBatch memory newBatch = MedicineBatch({
            batchId: _batchId,
            drugName: _drugName,
            genericName: _genericName,
            dosage: _dosage,
            quantity: _quantity,
            manufacturingDate: _manufacturingDate,
            expiryDate: _expiryDate,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            currentOwnerRole: Role.MANUFACTURER,
            status: BatchStatus.MANUFACTURED,
            isRecalled: false,
            recallReason: "",
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        batches[_batchId] = newBatch;
        batchExists[_batchId] = true;
        allBatchIds.push(_batchId);

        // Record initial custody
        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: BatchStatus.MANUFACTURED,
            actor: msg.sender,
            actorRole: Role.MANUFACTURER,
            location: _location,
            temperatureCelsius: 200, // Default ambient 20.0°C (scaled x10)
            notes: "Batch successfully formulated and registered on ledger"
        }));

        emit BatchCreated(_batchId, _drugName, msg.sender, _quantity, _expiryDate);
        emit BatchStatusUpdated(_batchId, BatchStatus.MANUFACTURED, msg.sender, Role.MANUFACTURER, _location);
    }

    function transferToDistributor(
        string memory _batchId,
        address _distributor,
        string memory _dispatchLocation,
        int256 _tempReading,
        string memory _notes
    ) external onlyRole(Role.MANUFACTURER) batchMustExist(_batchId) {
        MedicineBatch storage batch = batches[_batchId];
        require(batch.currentOwner == msg.sender, "MediTrace: Not current batch owner");
        require(!batch.isRecalled, "MediTrace: Recalled batch cannot be transferred");
        require(batch.status == BatchStatus.MANUFACTURED, "MediTrace: Invalid status transition");
        require(roles[_distributor] == Role.DISTRIBUTOR, "MediTrace: Target is not a verified distributor");

        batch.status = BatchStatus.IN_TRANSIT_TO_DISTRIBUTOR;
        batch.currentOwner = _distributor;
        batch.currentOwnerRole = Role.DISTRIBUTOR;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: BatchStatus.IN_TRANSIT_TO_DISTRIBUTOR,
            actor: msg.sender,
            actorRole: Role.MANUFACTURER,
            location: _dispatchLocation,
            temperatureCelsius: _tempReading,
            notes: _notes
        }));

        emit BatchStatusUpdated(_batchId, BatchStatus.IN_TRANSIT_TO_DISTRIBUTOR, msg.sender, Role.MANUFACTURER, _dispatchLocation);
    }

    // ========================================================================
    // Distributor Operations
    // ========================================================================

    function receiveByDistributor(
        string memory _batchId,
        string memory _warehouseLocation,
        int256 _tempReading,
        string memory _notes
    ) external onlyRole(Role.DISTRIBUTOR) batchMustExist(_batchId) {
        MedicineBatch storage batch = batches[_batchId];
        require(batch.currentOwner == msg.sender, "MediTrace: Batch not assigned to this distributor");
        require(batch.status == BatchStatus.IN_TRANSIT_TO_DISTRIBUTOR, "MediTrace: Batch not in transit to distributor");

        batch.status = BatchStatus.RECEIVED_BY_DISTRIBUTOR;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: BatchStatus.RECEIVED_BY_DISTRIBUTOR,
            actor: msg.sender,
            actorRole: Role.DISTRIBUTOR,
            location: _warehouseLocation,
            temperatureCelsius: _tempReading,
            notes: _notes
        }));

        emit BatchStatusUpdated(_batchId, BatchStatus.RECEIVED_BY_DISTRIBUTOR, msg.sender, Role.DISTRIBUTOR, _warehouseLocation);
    }

    function transferToPharmacy(
        string memory _batchId,
        address _pharmacy,
        string memory _dispatchLocation,
        int256 _tempReading,
        string memory _notes
    ) external onlyRole(Role.DISTRIBUTOR) batchMustExist(_batchId) {
        MedicineBatch storage batch = batches[_batchId];
        require(batch.currentOwner == msg.sender, "MediTrace: Not current batch owner");
        require(!batch.isRecalled, "MediTrace: Recalled batch cannot be transferred");
        require(batch.status == BatchStatus.RECEIVED_BY_DISTRIBUTOR, "MediTrace: Batch not in distributor inventory");
        require(
            roles[_pharmacy] == Role.PHARMACY || roles[_pharmacy] == Role.HOSPITAL,
            "MediTrace: Target is not a verified pharmacy or hospital"
        );

        Role recipientRole = roles[_pharmacy];
        batch.status = BatchStatus.IN_TRANSIT_TO_PHARMACY;
        batch.currentOwner = _pharmacy;
        batch.currentOwnerRole = recipientRole;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: BatchStatus.IN_TRANSIT_TO_PHARMACY,
            actor: msg.sender,
            actorRole: Role.DISTRIBUTOR,
            location: _dispatchLocation,
            temperatureCelsius: _tempReading,
            notes: _notes
        }));

        emit BatchStatusUpdated(_batchId, BatchStatus.IN_TRANSIT_TO_PHARMACY, msg.sender, Role.DISTRIBUTOR, _dispatchLocation);
    }

    // ========================================================================
    // Pharmacy / Hospital Operations
    // ========================================================================

    function receiveByPharmacy(
        string memory _batchId,
        string memory _hospitalLocation,
        int256 _tempReading,
        string memory _notes
    ) external onlyPharmacyOrHospital batchMustExist(_batchId) {
        MedicineBatch storage batch = batches[_batchId];
        require(batch.currentOwner == msg.sender, "MediTrace: Batch not assigned to this pharmacy");
        require(batch.status == BatchStatus.IN_TRANSIT_TO_PHARMACY, "MediTrace: Batch not in transit to pharmacy");

        batch.status = BatchStatus.RECEIVED_BY_PHARMACY;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: BatchStatus.RECEIVED_BY_PHARMACY,
            actor: msg.sender,
            actorRole: roles[msg.sender],
            location: _hospitalLocation,
            temperatureCelsius: _tempReading,
            notes: _notes
        }));

        emit BatchStatusUpdated(_batchId, BatchStatus.RECEIVED_BY_PHARMACY, msg.sender, roles[msg.sender], _hospitalLocation);
    }

    function dispenseMedicine(
        string memory _batchId,
        uint256 _dispenseQty,
        string memory _notes
    ) external onlyPharmacyOrHospital batchMustExist(_batchId) {
        MedicineBatch storage batch = batches[_batchId];
        require(batch.currentOwner == msg.sender, "MediTrace: Only holding pharmacy can dispense");
        require(!batch.isRecalled, "MediTrace: Cannot dispense recalled batch");
        require(batch.status == BatchStatus.RECEIVED_BY_PHARMACY || batch.status == BatchStatus.DISPENSED, "MediTrace: Not in pharmacy stock");
        require(block.timestamp < batch.expiryDate, "MediTrace: Batch has expired");
        require(batch.quantity >= _dispenseQty, "MediTrace: Insufficient quantity");

        batch.quantity -= _dispenseQty;
        if (batch.quantity == 0) {
            batch.status = BatchStatus.DISPENSED;
        }
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: BatchStatus.DISPENSED,
            actor: msg.sender,
            actorRole: roles[msg.sender],
            location: entityNames[msg.sender],
            temperatureCelsius: 210,
            notes: _notes
        }));

        emit MedicineDispensed(_batchId, msg.sender, _dispenseQty);
        emit BatchStatusUpdated(_batchId, batch.status, msg.sender, roles[msg.sender], entityNames[msg.sender]);
    }

    // ========================================================================
    // General Provenance / Custody Event Recording
    // ========================================================================

    function recordCustodyEvent(
        string memory _batchId,
        BatchStatus _newStatus,
        string memory _location,
        int256 _tempReading,
        string memory _notes
    ) external batchMustExist(_batchId) {
        MedicineBatch storage batch = batches[_batchId];
        require(
            msg.sender == admin || msg.sender == batch.currentOwner,
            "MediTrace: Caller must be admin or current batch owner"
        );
        require(!batch.isRecalled, "MediTrace: Cannot record events on recalled batch");

        batch.status = _newStatus;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: _newStatus,
            actor: msg.sender,
            actorRole: roles[msg.sender],
            location: _location,
            temperatureCelsius: _tempReading,
            notes: _notes
        }));

        emit BatchStatusUpdated(_batchId, _newStatus, msg.sender, roles[msg.sender], _location);
    }

    // ========================================================================
    // Recall Governance
    // ========================================================================

    function recallBatch(
        string memory _batchId,
        string memory _reason
    ) external batchMustExist(_batchId) {
        MedicineBatch storage batch = batches[_batchId];
        require(
            msg.sender == admin || msg.sender == batch.manufacturer,
            "MediTrace: Only admin or producing manufacturer can recall batch"
        );
        require(!batch.isRecalled, "MediTrace: Batch already recalled");

        batch.isRecalled = true;
        batch.recallReason = _reason;
        batch.status = BatchStatus.RECALLED;
        batch.updatedAt = block.timestamp;

        batchHistory[_batchId].push(ProvenanceRecord({
            timestamp: block.timestamp,
            status: BatchStatus.RECALLED,
            actor: msg.sender,
            actorRole: roles[msg.sender],
            location: "RECALL NOTICE ISSUED",
            temperatureCelsius: 0,
            notes: _reason
        }));

        emit BatchRecalled(_batchId, msg.sender, _reason);
        emit BatchStatusUpdated(_batchId, BatchStatus.RECALLED, msg.sender, roles[msg.sender], "RECALL NOTICE");
    }

    // ========================================================================
    // Public Verification (No Login / Authentication Required)
    // ========================================================================

    function verifyBatch(string memory _batchId)
        external
        view
        batchMustExist(_batchId)
        returns (
            MedicineBatch memory batch,
            string memory manufacturerName,
            uint256 historyCount
        )
    {
        batch = batches[_batchId];
        manufacturerName = entityNames[batch.manufacturer];
        historyCount = batchHistory[_batchId].length;
    }

    function isBatchRecalled(string memory _batchId)
        external
        view
        batchMustExist(_batchId)
        returns (bool isRecalled, string memory recallReason)
    {
        MedicineBatch storage batch = batches[_batchId];
        return (batch.isRecalled, batch.recallReason);
    }

    function getProvenanceHistory(string memory _batchId)
        external
        view
        batchMustExist(_batchId)
        returns (ProvenanceRecord[] memory)
    {
        return batchHistory[_batchId];
    }

    function getTotalBatchesCount() external view returns (uint256) {
        return allBatchIds.length;
    }

    function getAllBatchIds() external view returns (string[] memory) {
        return allBatchIds;
    }
}
