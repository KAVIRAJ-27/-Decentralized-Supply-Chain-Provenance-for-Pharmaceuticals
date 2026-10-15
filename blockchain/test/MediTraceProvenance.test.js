const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MediTraceProvenance Smart Contract", function () {
  let contract;
  let admin, manufacturer, distributor, pharmacy, hospital, consumer, unauthorized;

  const Role = {
    NONE: 0,
    ADMIN: 1,
    MANUFACTURER: 2,
    DISTRIBUTOR: 3,
    PHARMACY: 4,
    CONSUMER: 5,
    HOSPITAL: 6,
  };

  const BatchStatus = {
    MANUFACTURED: 0,
    IN_TRANSIT_TO_DISTRIBUTOR: 1,
    RECEIVED_BY_DISTRIBUTOR: 2,
    IN_TRANSIT_TO_PHARMACY: 3,
    RECEIVED_BY_PHARMACY: 4,
    DISPENSED: 5,
    RECALLED: 6,
  };

  const sampleBatchId = "MED-20261015-A8F2K";
  const mfgDate = Math.floor(Date.now() / 1000) - 3600;
  const expDate = Math.floor(Date.now() / 1000) + 31536000; // 1 year ahead

  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacy, hospital, consumer, unauthorized] =
      await ethers.getSigners();

    const MediTraceProvenance = await ethers.getContractFactory("MediTraceProvenance");
    contract = await MediTraceProvenance.deploy();
    await contract.waitForDeployment();

    // Setup network roles
    await contract.connect(admin).registerParticipant(
      manufacturer.address,
      Role.MANUFACTURER,
      "Apex Biotech Pharma"
    );

    await contract.connect(admin).registerParticipant(
      distributor.address,
      Role.DISTRIBUTOR,
      "Global Health Logistics"
    );

    await contract.connect(admin).registerParticipant(
      pharmacy.address,
      Role.PHARMACY,
      "City Care General Pharmacy"
    );

    await contract.connect(admin).registerParticipant(
      hospital.address,
      Role.HOSPITAL,
      "St. Jude Regional Inpatient Hospital"
    );
  });

  describe("Role Verification & RBAC", function () {
    it("should set deployer as super admin", async function () {
      expect(await contract.admin()).to.equal(admin.address);
      expect(await contract.roles(admin.address)).to.equal(Role.ADMIN);
    });

    it("should allow admin to register participants and prevent duplicates/zero address", async function () {
      expect(await contract.roles(manufacturer.address)).to.equal(Role.MANUFACTURER);
      expect(await contract.roles(distributor.address)).to.equal(Role.DISTRIBUTOR);
      expect(await contract.roles(pharmacy.address)).to.equal(Role.PHARMACY);
      expect(await contract.roles(hospital.address)).to.equal(Role.HOSPITAL);

      await expect(
        contract.connect(admin).registerParticipant(
          ethers.ZeroAddress,
          Role.MANUFACTURER,
          "Zero Corp"
        )
      ).to.be.revertedWith("MediTrace: Zero address not allowed");

      await expect(
        contract.connect(admin).registerParticipant(
          manufacturer.address,
          Role.NONE,
          "None Corp"
        )
      ).to.be.revertedWith("MediTrace: Cannot assign NONE role");
    });

    it("should reject non-admin registering participants", async function () {
      await expect(
        contract.connect(unauthorized).registerParticipant(
          unauthorized.address,
          Role.MANUFACTURER,
          "Fraudulent Lab"
        )
      ).to.be.revertedWith("MediTrace: Caller is not admin");
    });

    it("should allow admin to revoke roles", async function () {
      await contract.connect(admin).revokeRole(distributor.address);
      expect(await contract.roles(distributor.address)).to.equal(Role.NONE);

      await expect(
        contract.connect(admin).revokeRole(admin.address)
      ).to.be.revertedWith("MediTrace: Cannot revoke super admin");
    });
  });

  describe("Medicine Batch Lifecycle & Shared Batch ID", function () {
    it("should allow manufacturer to create a batch with valid fields", async function () {
      await expect(
        contract.connect(manufacturer).createBatch(
          sampleBatchId,
          "Amoxicillin Clavulanate",
          "Amoxicillin / Clavulanic Acid",
          "625mg Tablets",
          10000,
          mfgDate,
          expDate,
          "Plant A - Sterile Unit 4"
        )
      )
        .to.emit(contract, "BatchCreated")
        .withArgs(sampleBatchId, "Amoxicillin Clavulanate", manufacturer.address, 10000, expDate);

      const [batch, mfgName, historyCount] = await contract.verifyBatch(sampleBatchId);
      expect(batch.drugName).to.equal("Amoxicillin Clavulanate");
      expect(batch.currentOwner).to.equal(manufacturer.address);
      expect(batch.status).to.equal(BatchStatus.MANUFACTURED);
      expect(mfgName).to.equal("Apex Biotech Pharma");
      expect(historyCount).to.equal(1);
    });

    it("should reject duplicate batch registration with existing batchId", async function () {
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Amoxicillin Clavulanate",
        "Amoxicillin / Clavulanic Acid",
        "625mg Tablets",
        5000,
        mfgDate,
        expDate,
        "Plant A"
      );

      await expect(
        contract.connect(manufacturer).createBatch(
          sampleBatchId,
          "Amoxicillin Duplicate",
          "Amoxicillin",
          "625mg",
          2000,
          mfgDate,
          expDate,
          "Plant A"
        )
      ).to.be.revertedWith("MediTrace: Batch ID already registered");
    });

    it("should reject batch creation with empty batchId", async function () {
      await expect(
        contract.connect(manufacturer).createBatch(
          "",
          "Drug",
          "Generic",
          "100mg",
          1000,
          mfgDate,
          expDate,
          "Plant A"
        )
      ).to.be.revertedWith("MediTrace: Batch ID cannot be empty");
    });

    it("should reject batch creation when expiryDate <= manufacturingDate", async function () {
      await expect(
        contract.connect(manufacturer).createBatch(
          sampleBatchId,
          "Drug",
          "Generic",
          "100mg",
          1000,
          expDate, // mfg date is later than exp date
          mfgDate,
          "Plant A"
        )
      ).to.be.revertedWith("MediTrace: Expiry must be after manufacturing date");
    });

    it("should reject batch creation with zero or negative quantity", async function () {
      await expect(
        contract.connect(manufacturer).createBatch(
          sampleBatchId,
          "Drug",
          "Generic",
          "100mg",
          0,
          mfgDate,
          expDate,
          "Plant A"
        )
      ).to.be.revertedWith("MediTrace: Quantity must be > 0");
    });

    it("should prevent unauthorized entities from creating a batch", async function () {
      await expect(
        contract.connect(unauthorized).createBatch(
          sampleBatchId,
          "Counterfeit Drug",
          "Fake",
          "500mg",
          500,
          mfgDate,
          expDate,
          "Unknown"
        )
      ).to.be.revertedWith("MediTrace: Unauthorized role");
    });

    it("should trace the complete supply chain from factory to patient", async function () {
      // 1. Manufacture
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Amoxicillin Clavulanate",
        "Amoxicillin / Clavulanic Acid",
        "625mg Tablets",
        5000,
        mfgDate,
        expDate,
        "Plant A - Sterile Unit 4"
      );

      // 2. Transfer to Distributor
      await contract.connect(manufacturer).transferToDistributor(
        sampleBatchId,
        distributor.address,
        "Cold Chain Depot Central",
        45, // 4.5°C
        "Inspected and sealed container"
      );

      let [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.status).to.equal(BatchStatus.IN_TRANSIT_TO_DISTRIBUTOR);

      // 3. Receive by Distributor
      await contract.connect(distributor).receiveByDistributor(
        sampleBatchId,
        "Regional Cold Storage Vault B",
        42, // 4.2°C
        "Temperature logs validated within range"
      );

      [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.status).to.equal(BatchStatus.RECEIVED_BY_DISTRIBUTOR);

      // 4. Transfer to Pharmacy
      await contract.connect(distributor).transferToPharmacy(
        sampleBatchId,
        pharmacy.address,
        "Metro Hospital Route",
        48,
        "Dispatched via refrigerated fleet #12"
      );

      [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.status).to.equal(BatchStatus.IN_TRANSIT_TO_PHARMACY);

      // 5. Receive by Pharmacy
      await contract.connect(pharmacy).receiveByPharmacy(
        sampleBatchId,
        "Inpatient Dispensary Stockroom",
        50,
        "Stock counted and safety hologram verified"
      );

      [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.status).to.equal(BatchStatus.RECEIVED_BY_PHARMACY);

      // 6. Dispense to Patient
      await contract.connect(pharmacy).dispenseMedicine(
        sampleBatchId,
        500,
        "Dispensed for prescription RX-99214"
      );

      [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.quantity).to.equal(4500);

      // 7. Check full provenance history
      const history = await contract.getProvenanceHistory(sampleBatchId);
      expect(history.length).to.equal(6);
    });

    it("should allow hospital role to receive and dispense medication", async function () {
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Ceftriaxone IV Infusion",
        "Ceftriaxone",
        "1g Vial",
        1000,
        mfgDate,
        expDate,
        "Plant C"
      );

      await contract.connect(manufacturer).transferToDistributor(
        sampleBatchId,
        distributor.address,
        "Depot 1",
        40,
        "Cold dispatch"
      );

      await contract.connect(distributor).receiveByDistributor(
        sampleBatchId,
        "Vault A",
        41,
        "Received"
      );

      // Transfer directly to Hospital
      await contract.connect(distributor).transferToPharmacy(
        sampleBatchId,
        hospital.address,
        "Hospital Transit Route",
        45,
        "To St. Jude Hospital"
      );

      let [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.status).to.equal(BatchStatus.IN_TRANSIT_TO_PHARMACY);

      // Hospital receives batch
      await contract.connect(hospital).receiveByPharmacy(
        sampleBatchId,
        "ICU Pharmacy Unit",
        42,
        "Received by Hospital Pharmacist"
      );

      [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.status).to.equal(BatchStatus.RECEIVED_BY_PHARMACY);

      // Hospital dispenses medicine
      await contract.connect(hospital).dispenseMedicine(
        sampleBatchId,
        100,
        "Dispensed to ICU Ward Bed 12"
      );

      [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.quantity).to.equal(900);
    });

    it("should allow current custodian to record intermediate provenance events", async function () {
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Paracetamol",
        "Paracetamol",
        "500mg",
        1000,
        mfgDate,
        expDate,
        "Plant A"
      );

      // Record intermediary custody inspection
      await expect(
        contract.connect(manufacturer).recordCustodyEvent(
          sampleBatchId,
          BatchStatus.MANUFACTURED,
          "Analytical Testing Lab 3",
          205,
          "Quality HPLC assay passed: 99.8% purity"
        )
      )
        .to.emit(contract, "BatchStatusUpdated")
        .withArgs(
          sampleBatchId,
          BatchStatus.MANUFACTURED,
          manufacturer.address,
          Role.MANUFACTURER,
          "Analytical Testing Lab 3"
        );

      const history = await contract.getProvenanceHistory(sampleBatchId);
      expect(history.length).to.equal(2);
      expect(history[1].location).to.equal("Analytical Testing Lab 3");
      expect(history[1].notes).to.equal("Quality HPLC assay passed: 99.8% purity");
    });

    it("should reject unauthorized account attempting to record custody events", async function () {
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Paracetamol",
        "Paracetamol",
        "500mg",
        1000,
        mfgDate,
        expDate,
        "Plant A"
      );

      await expect(
        contract.connect(unauthorized).recordCustodyEvent(
          sampleBatchId,
          BatchStatus.MANUFACTURED,
          "Unauthorized Location",
          200,
          "Unauthorized log"
        )
      ).to.be.revertedWith("MediTrace: Caller must be admin or current batch owner");
    });

    it("should allow public consumer to verify medicine without login or roles", async function () {
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Amoxicillin Clavulanate",
        "Amoxicillin / Clavulanic Acid",
        "625mg Tablets",
        2000,
        mfgDate,
        expDate,
        "Plant A"
      );

      // Consumer account with no special role queries the ledger
      const [batch, mfgName] = await contract.connect(consumer).verifyBatch(sampleBatchId);
      expect(batch.drugName).to.equal("Amoxicillin Clavulanate");
      expect(mfgName).to.equal("Apex Biotech Pharma");
      expect(batch.isRecalled).to.be.false;
    });

    it("should allow recall by manufacturer or admin and block further transfers", async function () {
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Defective Batch",
        "Active Ingredient X",
        "100mg",
        1000,
        mfgDate,
        expDate,
        "Plant B"
      );

      await contract.connect(admin).recallBatch(
        sampleBatchId,
        "Class I Recall: Foreign particulate matter detected"
      );

      const [batch] = await contract.verifyBatch(sampleBatchId);
      expect(batch.isRecalled).to.be.true;
      expect(batch.status).to.equal(BatchStatus.RECALLED);

      // Verify recall status helper
      const [isRecalled, recallReason] = await contract.isBatchRecalled(sampleBatchId);
      expect(isRecalled).to.be.true;
      expect(recallReason).to.equal("Class I Recall: Foreign particulate matter detected");

      // Attempting transfer after recall should fail
      await expect(
        contract.connect(manufacturer).transferToDistributor(
          sampleBatchId,
          distributor.address,
          "Transit",
          200,
          "Attempted transfer"
        )
      ).to.be.revertedWith("MediTrace: Recalled batch cannot be transferred");

      // Attempting second recall should fail
      await expect(
        contract.connect(admin).recallBatch(sampleBatchId, "Second recall")
      ).to.be.revertedWith("MediTrace: Batch already recalled");
    });

    it("should reject recall by unauthorized account", async function () {
      await contract.connect(manufacturer).createBatch(
        sampleBatchId,
        "Good Batch",
        "Active Ingredient Y",
        "50mg",
        1000,
        mfgDate,
        expDate,
        "Plant B"
      );

      await expect(
        contract.connect(unauthorized).recallBatch(sampleBatchId, "Malicious recall")
      ).to.be.revertedWith("MediTrace: Only admin or producing manufacturer can recall batch");
    });

    it("should reject operations on non-existent batchId", async function () {
      await expect(
        contract.verifyBatch("MED-NONEXISTENT")
      ).to.be.revertedWith("MediTrace: Batch does not exist");

      await expect(
        contract.getProvenanceHistory("MED-NONEXISTENT")
      ).to.be.revertedWith("MediTrace: Batch does not exist");

      await expect(
        contract.isBatchRecalled("MED-NONEXISTENT")
      ).to.be.revertedWith("MediTrace: Batch does not exist");
    });

    it("should return batch count and list of batch IDs", async function () {
      expect(await contract.getTotalBatchesCount()).to.equal(0);

      await contract.connect(manufacturer).createBatch(
        "MED-20261015-00001",
        "Drug 1",
        "Gen 1",
        "10mg",
        100,
        mfgDate,
        expDate,
        "P1"
      );

      await contract.connect(manufacturer).createBatch(
        "MED-20261015-00002",
        "Drug 2",
        "Gen 2",
        "20mg",
        200,
        mfgDate,
        expDate,
        "P2"
      );

      expect(await contract.getTotalBatchesCount()).to.equal(2);
      const allIds = await contract.getAllBatchIds();
      expect(allIds).to.deep.equal(["MED-20261015-00001", "MED-20261015-00002"]);
    });
  });
});
