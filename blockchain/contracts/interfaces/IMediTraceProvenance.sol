// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMediTraceProvenance
 * @dev Interface for MediTrace Pharmaceutical Provenance Ledger
 */
interface IMediTraceProvenance {
    enum Role {
        NONE,
        ADMIN,
        MANUFACTURER,
        DISTRIBUTOR,
        PHARMACY,
        CONSUMER,
        HOSPITAL
    }

    enum BatchStatus {
        MANUFACTURED,
        IN_TRANSIT_TO_DISTRIBUTOR,
        RECEIVED_BY_DISTRIBUTOR,
        IN_TRANSIT_TO_PHARMACY,
        RECEIVED_BY_PHARMACY,
        DISPENSED,
        RECALLED
    }

    struct ProvenanceRecord {
        uint256 timestamp;
        BatchStatus status;
        address actor;
        Role actorRole;
        string location;
        int256 temperatureCelsius; // scaled by 10 (e.g., 45 = 4.5°C)
        string notes;
    }

    struct MedicineBatch {
        string batchId;
        string drugName;
        string genericName;
        string dosage;
        uint256 quantity;
        uint256 manufacturingDate;
        uint256 expiryDate;
        address manufacturer;
        address currentOwner;
        Role currentOwnerRole;
        BatchStatus status;
        bool isRecalled;
        string recallReason;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // Events
    event RoleGranted(address indexed account, Role role, string entityName);
    event RoleRevoked(address indexed account, Role role);

    event BatchCreated(
        string indexed batchId,
        string drugName,
        address indexed manufacturer,
        uint256 quantity,
        uint256 expiryDate
    );

    event BatchStatusUpdated(
        string indexed batchId,
        BatchStatus status,
        address indexed actor,
        Role actorRole,
        string location
    );

    event BatchRecalled(
        string indexed batchId,
        address indexed recalledBy,
        string reason
    );

    event MedicineDispensed(
        string indexed batchId,
        address indexed pharmacy,
        uint256 dispensedQuantity
    );
}
