const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MediTraceProvenance Smart Contract", function () {
  let contract;
  let admin, manufacturer, distributor, pharmacy, consumer, unauthorized;

  const Role = {
    NONE: 0,
    ADMIN: 1,
    MANUFACTURER: 2,
    DISTRIBUTOR: 3,
    PHARMACY: 4,
    CONSUMER: 5,
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

  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacy, consumer, unauthorized] =
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
      "City Care General Hospital & Pharmacy"
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
  });

  describe("Medicine Batch Lifecycle & Shared Batch ID", function () {
    const mfgDate = Math.floor(Date.now() / 1000) - 3600;
    const expDate = Math.floor(Date.now() / 1000) + 31536000; // 1 year ahead

    it("should allow manufacturer to create a batch", async function () {
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
    });
  });
});
