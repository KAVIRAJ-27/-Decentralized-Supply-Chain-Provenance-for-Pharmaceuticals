import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface OrganizationRecord {
  organizationId: string;
  name: string;
  type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'HOSPITAL';
  address: string;
  contactEmail: string;
  licenseNumber: string;
  walletAddress?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string; // Maps to userId
  organizationId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'HOSPITAL' | 'CONSUMER';
  organizationName: string;
  licenseNumber: string;
  walletAddress: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminActivityRecord {
  id: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: 'ORGANIZATION' | 'USER' | 'SYSTEM';
  targetId: string;
  targetName: string;
  details?: string;
  timestamp: string;
}

export interface CustodyRecord {
  id: string;
  batchId: string;
  timestamp: string;
  action: string;
  status: string;
  actorRole: string;
  actorName: string;
  actorAddress: string;
  location: string;
  temperatureCelsius?: number;
  notes?: string;
  txHash?: string;
}

export interface MedicineRecord {
  medicineId: string;
  name: string;
  genericName: string;
  description: string;
  manufacturerOrganizationId: string;
  dosageForm: string; // e.g. "Tablet", "Capsule", "Injection", "Vial", "Syrup"
  strength: string;   // e.g. "625mg", "1000mg/100mL"
  packaging?: string; // e.g. "Box of 100", "Vial 100mL"
  createdAt: string;
  updatedAt?: string;
}

export interface BatchRecord {
  batchId: string;
  medicineId?: string;
  manufacturerOrganizationId?: string;
  drugName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  remainingQuantity: number;
  manufacturerName: string;
  manufacturerAddress: string;
  manufacturingDate: string;
  expiryDate: string;
  packaging?: string;
  strength?: string;
  currentStatus: string;
  currentOwnerRole: string;
  currentOwnerName: string;
  currentOwnerAddress: string;
  isRecalled: boolean;
  recallReason?: string;
  qrCodeUrl?: string;
  blockchainTxHash?: string;
  blockNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScanLogRecord {
  id: string;
  batchId: string;
  timestamp: string;
  ipHash: string;
  userAgent?: string;
}

export interface DeliveryRecord {
  deliveryId: string;
  batchId: string;
  drugName: string;
  fromOrganizationId: string;
  fromOrganizationName: string;
  toOrganizationId: string;
  toOrganizationName: string;
  quantity: number;
  dispatchDate: string;
  expectedDeliveryDate?: string;
  status: 'PENDING' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  location: string;
  temperatureCelsius?: number;
  notes?: string;
  blockchainTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptConfirmationRecord {
  confirmationId: string;
  deliveryId: string;
  batchId: string;
  receivedByUserId: string;
  receivedByUserName: string;
  receivedByOrganizationId: string;
  receivedQuantity: number;
  receivedDate: string;
  remarks?: string;
  location?: string;
  temperatureCelsius?: number;
  blockchainTxHash?: string;
  createdAt: string;
}

interface DatabaseSchema {
  organizations: OrganizationRecord[];
  users: UserRecord[];
  medicines: MedicineRecord[];
  batches: BatchRecord[];
  custodyEvents: CustodyRecord[];
  adminActivities: AdminActivityRecord[];
  scanLogs: ScanLogRecord[];
  deliveries: DeliveryRecord[];
  receiptConfirmations: ReceiptConfirmationRecord[];
}

export function hashPassword(plainText: string, salt = 'meditrace_salt_2026'): string {
  return crypto.pbkdf2Sync(plainText, salt, 10000, 32, 'sha512').toString('hex');
}

export function verifyPassword(plainText: string, hashed: string, salt = 'meditrace_salt_2026'): boolean {
  if (!plainText || !hashed) return false;
  return hashPassword(plainText, salt) === hashed;
}

class DatabaseService {
  private filePath: string;
  private data: DatabaseSchema;

  constructor() {
    this.filePath = path.resolve(process.cwd(), './data/meditrace_db.json');
    this.data = {
      organizations: [],
      users: [],
      medicines: [],
      batches: [],
      custodyEvents: [],
      adminActivities: [],
      scanLogs: [],
      deliveries: [],
      receiptConfirmations: [],
    };
    this.init();
  }

  private init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.batches) {
          this.data = {
            organizations: parsed.organizations || [],
            users: parsed.users || [],
            medicines: parsed.medicines || [],
            batches: parsed.batches || [],
            custodyEvents: parsed.custodyEvents || [],
            adminActivities: parsed.adminActivities || [],
            scanLogs: parsed.scanLogs || [],
            deliveries: parsed.deliveries || [],
            receiptConfirmations: parsed.receiptConfirmations || [],
          };
          let modified = false;
          if (this.data.organizations.length === 0) {
            this.seedOrganizations();
            modified = true;
          }
          if (this.data.medicines.length === 0) {
            this.seedMedicines();
            modified = true;
          }

          // Security check: Automatically migrate legacy plain-text passwords to strong PBKDF2 hashes
          for (const u of this.data.users) {
            if (u.passwordHash && u.passwordHash.length < 64) {
              u.passwordHash = hashPassword(u.passwordHash);
              modified = true;
            }
          }
          if (modified) {
            this.save();
          }
          return;
        }
      } catch (e) {
        console.warn('Could not read existing database file, re-seeding default data.');
      }
    }

    this.seedDefaults();
    this.save();
  }

  private save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private seedOrganizations() {
    this.data.organizations = [
      {
        organizationId: 'ORG-REG-01',
        name: 'National Drug Regulatory Authority',
        type: 'HOSPITAL', // Regulatory authority oversight
        address: '100 Federal Health Boulevard, Capital District',
        contactEmail: 'admin@meditrace.org',
        licenseNumber: 'REG-FDA-9921',
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        status: 'ACTIVE',
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
      {
        organizationId: 'ORG-MFG-01',
        name: 'Apex Biotech Pharmaceuticals Ltd.',
        type: 'MANUFACTURER',
        address: 'Apex Science Park, Formulation Bay 4, Industrial Zone',
        contactEmail: 'compliance@apexpharma.com',
        licenseNumber: 'MFG-IND-8832-GMP',
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        status: 'ACTIVE',
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
      {
        organizationId: 'ORG-DIST-01',
        name: 'Global Health Logistics & Cold Chain Inc.',
        type: 'DISTRIBUTOR',
        address: 'Vault 3, Logistics Corridor West, Central Hub',
        contactEmail: 'operations@ghlogistics.com',
        licenseNumber: 'DST-LOG-4412',
        walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        status: 'ACTIVE',
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
      {
        organizationId: 'ORG-PHARM-01',
        name: 'City Care Hospital & Central Pharmacy',
        type: 'PHARMACY',
        address: '450 Healthcare Way, Metro District',
        contactEmail: 'pharmacy@citycare.org',
        licenseNumber: 'PHM-HOSP-7719',
        walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        status: 'ACTIVE',
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
      {
        organizationId: 'ORG-HOSP-01',
        name: 'St. Jude University Medical Center',
        type: 'HOSPITAL',
        address: '880 Medical Campus Drive, North Wing',
        contactEmail: 'inpatient@stjudehospital.org',
        licenseNumber: 'HSP-METRO-5521',
        walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
        status: 'ACTIVE',
        createdAt: '2026-10-02T08:00:00.000Z',
        updatedAt: '2026-10-02T08:00:00.000Z',
      },
    ];
  }

  private seedMedicines() {
    this.data.medicines = [
      {
        medicineId: 'MED-DRUG-01',
        name: 'Amoxicillin Clavulanate',
        genericName: 'Amoxicillin / Clavulanic Acid',
        description: 'Broad-spectrum penicillin antibiotic combined with beta-lactamase inhibitor for bacterial infections.',
        manufacturerOrganizationId: 'ORG-MFG-01',
        dosageForm: 'Tablet',
        strength: '625mg',
        packaging: 'Strip of 10 Tablets (Box of 100)',
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
      {
        medicineId: 'MED-DRUG-02',
        name: 'Paracetamol IV Infusion',
        genericName: 'Paracetamol / Acetaminophen',
        description: 'Sterile intravenous antipyretic and analgesic infusion solution for critical pain and fever control.',
        manufacturerOrganizationId: 'ORG-MFG-01',
        dosageForm: 'Injection',
        strength: '1000mg/100mL',
        packaging: '100mL Clear Glass Infusion Bottle',
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
      {
        medicineId: 'MED-DRUG-03',
        name: 'Azithromycin USP Capsules',
        genericName: 'Azithromycin Monohydrate',
        description: 'Macrolide antibiotic indicated for acute respiratory tract, ENT, and dermatological bacterial infections.',
        manufacturerOrganizationId: 'ORG-MFG-01',
        dosageForm: 'Capsule',
        strength: '500mg',
        packaging: 'Blister Pack of 6 Capsules',
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-01T08:00:00.000Z',
      },
    ];
  }

  private seedDefaults() {
    this.seedOrganizations();
    this.seedMedicines();

    this.data.users = [
      {
        id: 'usr-admin-01',
        organizationId: 'ORG-REG-01',
        name: 'Dr. Evelyn Vance (Chief Regulator)',
        email: 'admin@meditrace.org',
        role: 'ADMIN',
        organizationName: 'National Drug Regulatory Authority',
        licenseNumber: 'REG-FDA-9921',
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        passwordHash: hashPassword('admin123'),
        isActive: true,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'usr-mfg-01',
        organizationId: 'ORG-MFG-01',
        name: 'Apex Biotech Pharma (Mfg Facility 1)',
        email: 'manufacturer@apexpharma.com',
        role: 'MANUFACTURER',
        organizationName: 'Apex Biotech Pharmaceuticals Ltd.',
        licenseNumber: 'MFG-IND-8832-GMP',
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        passwordHash: hashPassword('mfg123'),
        isActive: true,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'usr-dist-01',
        organizationId: 'ORG-DIST-01',
        name: 'Global Health Logistics Depot',
        email: 'distributor@ghlogistics.com',
        role: 'DISTRIBUTOR',
        organizationName: 'Global Health Logistics & Cold Chain Inc.',
        licenseNumber: 'DST-LOG-4412',
        walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        passwordHash: hashPassword('dist123'),
        isActive: true,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'usr-pharm-01',
        organizationId: 'ORG-PHARM-01',
        name: 'City Care Hospital & Central Pharmacy',
        email: 'pharmacy@citycare.org',
        role: 'PHARMACY',
        organizationName: 'City Care Medical Center',
        licenseNumber: 'PHM-HOSP-7719',
        walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        passwordHash: hashPassword('pharm123'),
        isActive: true,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: 'usr-hosp-01',
        organizationId: 'ORG-HOSP-01',
        name: 'Dr. Marcus Vance (Chief Pharmacist)',
        email: 'hospital@stjude.org',
        role: 'HOSPITAL',
        organizationName: 'St. Jude University Medical Center',
        licenseNumber: 'HSP-METRO-5521',
        walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
        passwordHash: hashPassword('hosp123'),
        isActive: true,
        createdAt: '2026-10-02T08:00:00.000Z',
      },
    ];

    const sampleBatch: BatchRecord = {
      batchId: 'MED-20261015-A8F2K',
      medicineId: 'MED-DRUG-01',
      manufacturerOrganizationId: 'ORG-MFG-01',
      drugName: 'Amoxicillin Clavulanate',
      genericName: 'Amoxicillin / Clavulanic Acid',
      dosage: '625mg USP Tablets',
      strength: '625mg',
      packaging: 'Strip of 10 Tablets (Box of 100)',
      quantity: 5000,
      remainingQuantity: 4200,
      manufacturerName: 'Apex Biotech Pharmaceuticals Ltd.',
      manufacturerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      manufacturingDate: '2026-10-01T08:00:00.000Z',
      expiryDate: '2028-10-01T08:00:00.000Z',
      currentStatus: 'RECEIVED_BY_PHARMACY',
      currentOwnerRole: 'PHARMACY',
      currentOwnerName: 'City Care Hospital & Central Pharmacy',
      currentOwnerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      isRecalled: false,
      blockchainTxHash: '0x94f1c7d23a10e82937e20b33c1d982ab91c890123f9901adbc389021a88190c1',
      blockNumber: 12401,
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };

    this.data.batches = [sampleBatch];

    this.data.custodyEvents = [
      {
        id: 'evt-01',
        batchId: 'MED-20261015-A8F2K',
        timestamp: '2026-10-01T08:30:00.000Z',
        action: 'BATCH_REGISTERED',
        status: 'MANUFACTURED',
        actorRole: 'MANUFACTURER',
        actorName: 'Apex Biotech Pharmaceuticals Ltd.',
        actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        location: 'Apex Plant A, Sterile Formulation Suite 4',
        temperatureCelsius: 20.5,
        notes: 'Formulation approved. Electronic certificate of analysis verified.',
        txHash: '0x94f1c7d23a10e82937e20b33c1d982ab91c890123f9901adbc389021a88190c1',
      },
      {
        id: 'evt-02',
        batchId: 'MED-20261015-A8F2K',
        timestamp: '2026-10-04T11:15:00.000Z',
        action: 'DISPATCHED_TO_DISTRIBUTOR',
        status: 'IN_TRANSIT_TO_DISTRIBUTOR',
        actorRole: 'MANUFACTURER',
        actorName: 'Apex Biotech Pharmaceuticals Ltd.',
        actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        location: 'Apex Dispatch Bay 2',
        temperatureCelsius: 4.5,
        notes: 'Loaded into insulated reefer container with active IoT temp monitoring.',
        txHash: '0x32a8901bce4710a90182bc8102931a89012bf991a03912a781039bcdae991201',
      },
      {
        id: 'evt-03',
        batchId: 'MED-20261015-A8F2K',
        timestamp: '2026-10-06T14:40:00.000Z',
        action: 'RECEIVED_AT_DISTRIBUTOR',
        status: 'RECEIVED_BY_DISTRIBUTOR',
        actorRole: 'DISTRIBUTOR',
        actorName: 'Global Health Logistics & Cold Chain Inc.',
        actorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        location: 'Global Logistics Hub West Vault 3',
        temperatureCelsius: 4.2,
        notes: 'Tamper seals intact. Cold chain logs within 2°C - 8°C tolerance.',
        txHash: '0x55bc10293810ae8829103cba00129bcfe1092301823901a89012738910a88102',
      },
      {
        id: 'evt-04',
        batchId: 'MED-20261015-A8F2K',
        timestamp: '2026-10-10T09:00:00.000Z',
        action: 'DISPATCHED_TO_PHARMACY',
        status: 'IN_TRANSIT_TO_PHARMACY',
        actorRole: 'DISTRIBUTOR',
        actorName: 'Global Health Logistics & Cold Chain Inc.',
        actorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        location: 'City Metro Delivery Fleet Truck #14',
        temperatureCelsius: 4.8,
        notes: 'Scheduled delivery for City Care Medical Center.',
        txHash: '0x77ab890123890abce10928301928301298301928301298301928301928301928',
      },
      {
        id: 'evt-05',
        batchId: 'MED-20261015-A8F2K',
        timestamp: '2026-10-10T16:20:00.000Z',
        action: 'RECEIVED_BY_PHARMACY',
        status: 'RECEIVED_BY_PHARMACY',
        actorRole: 'PHARMACY',
        actorName: 'City Care Hospital & Central Pharmacy',
        actorAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        location: 'City Care Pharmacy Inpatient Dispensary',
        temperatureCelsius: 21.0,
        notes: 'Barcodes verified on chain. Stored in climate-controlled dispensary.',
        txHash: '0x88cd901823901823901823901823901823901823901823901823901823901823',
      },
    ];

    this.data.adminActivities = [
      {
        id: 'act-01',
        actorUserId: 'usr-admin-01',
        actorName: 'Dr. Evelyn Vance (Chief Regulator)',
        actorRole: 'ADMIN',
        action: 'ORGANIZATION_ACCREDITED',
        targetType: 'ORGANIZATION',
        targetId: 'ORG-MFG-01',
        targetName: 'Apex Biotech Pharmaceuticals Ltd.',
        details: 'Accredited with Good Manufacturing Practice (GMP) license MFG-IND-8832-GMP',
        timestamp: '2026-10-01T08:05:00.000Z',
      },
      {
        id: 'act-02',
        actorUserId: 'usr-admin-01',
        actorName: 'Dr. Evelyn Vance (Chief Regulator)',
        actorRole: 'ADMIN',
        action: 'ORGANIZATION_ACCREDITED',
        targetType: 'ORGANIZATION',
        targetId: 'ORG-DIST-01',
        targetName: 'Global Health Logistics & Cold Chain Inc.',
        details: 'Approved cold-chain distribution license DST-LOG-4412',
        timestamp: '2026-10-01T08:10:00.000Z',
      },
      {
        id: 'act-03',
        actorUserId: 'usr-admin-01',
        actorName: 'Dr. Evelyn Vance (Chief Regulator)',
        actorRole: 'ADMIN',
        action: 'ORGANIZATION_ACCREDITED',
        targetType: 'ORGANIZATION',
        targetId: 'ORG-HOSP-01',
        targetName: 'St. Jude University Medical Center',
        details: 'Onboarded healthcare institution with license HSP-METRO-5521',
        timestamp: '2026-10-02T08:15:00.000Z',
      },
    ];

    this.data.deliveries = [
      {
        deliveryId: 'DEL-20261010-001',
        batchId: 'MED-20261015-A8F2K',
        drugName: 'Amoxicillin Clavulanate',
        fromOrganizationId: 'ORG-DIST-01',
        fromOrganizationName: 'Global Health Logistics & Cold Chain Inc.',
        toOrganizationId: 'ORG-PHARM-01',
        toOrganizationName: 'City Care Hospital & Central Pharmacy',
        quantity: 250,
        dispatchDate: '2026-10-10T09:00:00.000Z',
        expectedDeliveryDate: '2026-10-10T18:00:00.000Z',
        status: 'DELIVERED',
        location: 'City Care Pharmacy Inpatient Dispensary',
        temperatureCelsius: 4.8,
        notes: 'Cold chain verified. Received by lead dispensary pharmacist.',
        blockchainTxHash: '0x88cd901823901823901823901823901823901823901823901823901823901823',
        createdAt: '2026-10-10T09:00:00.000Z',
        updatedAt: '2026-10-10T16:20:00.000Z',
      },
    ];

    this.data.receiptConfirmations = [
      {
        confirmationId: 'CONF-20261010-001',
        deliveryId: 'DEL-20261010-001',
        batchId: 'MED-20261015-A8F2K',
        receivedByUserId: 'usr-pharm-01',
        receivedByUserName: 'City Care Hospital & Central Pharmacy',
        receivedByOrganizationId: 'ORG-PHARM-01',
        receivedQuantity: 250,
        receivedDate: '2026-10-10T16:20:00.000Z',
        remarks: 'Confirmed intake into pharmacy inventory',
        location: 'City Care Pharmacy Inpatient Dispensary',
        temperatureCelsius: 21.0,
        blockchainTxHash: '0x88cd901823901823901823901823901823901823901823901823901823901823',
        createdAt: '2026-10-10T16:20:00.000Z',
      },
    ];
  }

  // ==========================================================================
  // Organization Operations
  // ==========================================================================

  listOrganizations(filterType?: string, filterStatus?: string, search?: string): OrganizationRecord[] {
    let list = [...this.data.organizations];
    if (filterType) {
      list = list.filter((o) => o.type.toUpperCase() === filterType.toUpperCase());
    }
    if (filterStatus) {
      list = list.filter((o) => o.status.toUpperCase() === filterStatus.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.licenseNumber.toLowerCase().includes(q) ||
          o.contactEmail.toLowerCase().includes(q) ||
          o.organizationId.toLowerCase().includes(q)
      );
    }
    return list;
  }

  findOrganizationById(id: string): OrganizationRecord | undefined {
    return this.data.organizations.find(
      (o) => o.organizationId.toUpperCase() === id.toUpperCase()
    );
  }

  findOrganizationByLicense(license: string): OrganizationRecord | undefined {
    return this.data.organizations.find(
      (o) => o.licenseNumber.toUpperCase() === license.trim().toUpperCase()
    );
  }

  createOrganization(org: OrganizationRecord): OrganizationRecord {
    const existingLicense = this.findOrganizationByLicense(org.licenseNumber);
    if (existingLicense) {
      throw new Error(`Organization with license number ${org.licenseNumber} already exists.`);
    }

    const existingId = this.findOrganizationById(org.organizationId);
    if (existingId) {
      throw new Error(`Organization ID ${org.organizationId} already exists.`);
    }

    this.data.organizations.unshift(org);
    this.save();
    return org;
  }

  updateOrganization(id: string, updates: Partial<OrganizationRecord>): OrganizationRecord {
    const index = this.data.organizations.findIndex(
      (o) => o.organizationId.toUpperCase() === id.toUpperCase()
    );
    if (index === -1) {
      throw new Error(`Organization ${id} not found.`);
    }

    // If license number changed, ensure uniqueness
    if (updates.licenseNumber && updates.licenseNumber !== this.data.organizations[index].licenseNumber) {
      const conflict = this.findOrganizationByLicense(updates.licenseNumber);
      if (conflict && conflict.organizationId !== id) {
        throw new Error(`License number ${updates.licenseNumber} is already registered.`);
      }
    }

    this.data.organizations[index] = {
      ...this.data.organizations[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.organizations[index];
  }

  setOrganizationStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): OrganizationRecord {
    return this.updateOrganization(id, { status });
  }

  // ==========================================================================
  // User Operations
  // ==========================================================================

  listUsers(filterOrg?: string, filterRole?: string, filterActive?: boolean, search?: string): UserRecord[] {
    let list = [...this.data.users];
    if (filterOrg) {
      list = list.filter((u) => u.organizationId.toUpperCase() === filterOrg.toUpperCase());
    }
    if (filterRole) {
      list = list.filter((u) => u.role.toUpperCase() === filterRole.toUpperCase());
    }
    if (filterActive !== undefined) {
      list = list.filter((u) => u.isActive === filterActive);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.organizationName.toLowerCase().includes(q)
      );
    }
    return list;
  }

  findUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  findUserByEmail(email: string): UserRecord | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  createUser(user: UserRecord): UserRecord {
    const existing = this.findUserByEmail(user.email);
    if (existing) {
      throw new Error(`User with email ${user.email} already exists.`);
    }

    this.data.users.unshift(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<UserRecord>): UserRecord {
    const index = this.data.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`User ${id} not found.`);
    }

    if (updates.email && updates.email.toLowerCase() !== this.data.users[index].email.toLowerCase()) {
      const conflict = this.findUserByEmail(updates.email);
      if (conflict && conflict.id !== id) {
        throw new Error(`Email ${updates.email} is already in use.`);
      }
    }

    this.data.users[index] = {
      ...this.data.users[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.users[index];
  }

  setUserActive(id: string, isActive: boolean): UserRecord {
    return this.updateUser(id, { isActive });
  }

  updateUserPassword(id: string, newPlainText: string): UserRecord {
    const user = this.findUserById(id);
    if (!user) {
      throw new Error(`User ${id} not found.`);
    }
    return this.updateUser(id, { passwordHash: hashPassword(newPlainText) });
  }

  // ==========================================================================
  // Admin Activity Operations
  // ==========================================================================

  recordAdminActivity(activity: AdminActivityRecord): void {
    this.data.adminActivities.unshift(activity);
    // Keep reasonable log depth in memory
    if (this.data.adminActivities.length > 500) {
      this.data.adminActivities = this.data.adminActivities.slice(0, 500);
    }
    this.save();
  }

  listAdminActivities(limit = 50): AdminActivityRecord[] {
    return this.data.adminActivities.slice(0, limit);
  }

  // ==========================================================================
  // Medicine Operations (Manufacturer Catalog)
  // ==========================================================================

  findMedicineById(medicineId: string): MedicineRecord | undefined {
    return this.data.medicines.find((m) => m.medicineId.toUpperCase() === medicineId.toUpperCase());
  }

  listMedicines(manufacturerOrgId?: string, search?: string): MedicineRecord[] {
    let list = [...this.data.medicines];
    if (manufacturerOrgId) {
      list = list.filter((m) => m.manufacturerOrganizationId.toUpperCase() === manufacturerOrgId.toUpperCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.genericName.toLowerCase().includes(q) ||
          m.medicineId.toLowerCase().includes(q) ||
          m.dosageForm.toLowerCase().includes(q) ||
          m.strength.toLowerCase().includes(q)
      );
    }
    return list;
  }

  createMedicine(med: MedicineRecord): MedicineRecord {
    const existing = this.findMedicineById(med.medicineId);
    if (existing) {
      throw new Error(`Medicine with ID '${med.medicineId}' already exists.`);
    }
    this.data.medicines.unshift(med);
    this.save();
    return med;
  }

  updateMedicine(medicineId: string, updates: Partial<MedicineRecord>): MedicineRecord {
    const index = this.data.medicines.findIndex((m) => m.medicineId.toUpperCase() === medicineId.toUpperCase());
    if (index === -1) {
      throw new Error(`Medicine '${medicineId}' not found.`);
    }
    this.data.medicines[index] = {
      ...this.data.medicines[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.medicines[index];
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  findBatchById(batchId: string): BatchRecord | undefined {
    return this.data.batches.find((b) => b.batchId.toUpperCase() === batchId.toUpperCase());
  }

  listBatches(filterRole?: string, filterOwner?: string, organizationId?: string): BatchRecord[] {
    let list = [...this.data.batches];
    if (filterRole) {
      list = list.filter((b) => b.currentOwnerRole === filterRole);
    }
    if (filterOwner) {
      list = list.filter((b) => b.currentOwnerAddress.toLowerCase() === filterOwner.toLowerCase());
    }
    if (organizationId) {
      list = list.filter(
        (b) =>
          b.manufacturerOrganizationId === organizationId ||
          (!b.manufacturerOrganizationId && organizationId === 'ORG-MFG-01')
      );
    }
    return list;
  }

  createBatch(batch: BatchRecord, event?: CustodyRecord): void {
    this.data.batches.unshift(batch);
    if (event) {
      this.data.custodyEvents.push(event);
    }
    this.save();
  }

  updateBatch(batchId: string, updates: Partial<BatchRecord>, newEvent?: CustodyRecord): BatchRecord {
    const index = this.data.batches.findIndex((b) => b.batchId.toUpperCase() === batchId.toUpperCase());
    if (index === -1) {
      throw new Error(`Batch ${batchId} not found`);
    }

    this.data.batches[index] = {
      ...this.data.batches[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (newEvent) {
      this.data.custodyEvents.push(newEvent);
    }

    this.save();
    return this.data.batches[index];
  }

  getCustodyHistory(batchId: string): CustodyRecord[] {
    return this.data.custodyEvents
      .filter((e) => e && e.batchId && e.batchId.toUpperCase() === batchId.toUpperCase())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // ==========================================================================
  // Public Verification Scan Logging & Telemetry
  // ==========================================================================

  logScan(batchId: string, ip?: string, userAgent?: string): ScanLogRecord {
    const rawIp = ip || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex').substring(0, 16);
    const log: ScanLogRecord = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      batchId: batchId.trim().toUpperCase(),
      timestamp: new Date().toISOString(),
      ipHash,
      userAgent: userAgent ? userAgent.substring(0, 120) : undefined,
    };
    if (!this.data.scanLogs) {
      this.data.scanLogs = [];
    }
    this.data.scanLogs.push(log);
    this.save();
    return log;
  }

  getRecentScanCount(batchId: string, windowMinutes: number = 5): number {
    if (!this.data.scanLogs) return 0;
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return this.data.scanLogs.filter(
      (s) => s.batchId.toUpperCase() === batchId.trim().toUpperCase() && new Date(s.timestamp).getTime() >= cutoff
    ).length;
  }

  getTotalScanCount(batchId: string): number {
    if (!this.data.scanLogs) return 0;
    return this.data.scanLogs.filter(
      (s) => s.batchId.toUpperCase() === batchId.trim().toUpperCase()
    ).length;
  }

  getScanLogs(batchId?: string): ScanLogRecord[] {
    if (!this.data.scanLogs) return [];
    if (!batchId) return [...this.data.scanLogs];
    return this.data.scanLogs.filter((s) => s.batchId.toUpperCase() === batchId.trim().toUpperCase());
  }

  // ==========================================================================
  // Delivery & Supply Chain Logistics Operations
  // ==========================================================================

  createDelivery(delivery: DeliveryRecord, custodyEvent?: CustodyRecord): DeliveryRecord {
    if (!this.data.deliveries) this.data.deliveries = [];
    this.data.deliveries.unshift(delivery);
    if (custodyEvent) {
      if (!this.data.custodyEvents) this.data.custodyEvents = [];
      this.data.custodyEvents.push(custodyEvent);
    }
    this.save();
    return delivery;
  }

  findDeliveryById(deliveryId: string): DeliveryRecord | undefined {
    if (!this.data.deliveries) return undefined;
    return this.data.deliveries.find((d) => d.deliveryId.toUpperCase() === deliveryId.trim().toUpperCase());
  }

  listDeliveries(filters?: {
    fromOrganizationId?: string;
    toOrganizationId?: string;
    batchId?: string;
    status?: string;
  }): DeliveryRecord[] {
    if (!this.data.deliveries) return [];
    let list = [...this.data.deliveries];
    if (filters?.fromOrganizationId) {
      list = list.filter((d) => d.fromOrganizationId === filters.fromOrganizationId);
    }
    if (filters?.toOrganizationId) {
      list = list.filter((d) => d.toOrganizationId === filters.toOrganizationId);
    }
    if (filters?.batchId) {
      list = list.filter((d) => d.batchId.toUpperCase() === filters.batchId!.trim().toUpperCase());
    }
    if (filters?.status) {
      list = list.filter((d) => d.status.toUpperCase() === filters.status!.trim().toUpperCase());
    }
    return list;
  }

  confirmDeliveryReceipt(
    deliveryId: string,
    confirmation: ReceiptConfirmationRecord,
    custodyEvent?: CustodyRecord
  ): { delivery: DeliveryRecord; confirmation: ReceiptConfirmationRecord; batch: BatchRecord } {
    const delivery = this.findDeliveryById(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    if (delivery.status === 'DELIVERED') {
      throw new Error(`Delivery ${deliveryId} has already been confirmed as delivered`);
    }

    if (delivery.status === 'CANCELLED') {
      throw new Error(`Cannot confirm receipt for cancelled delivery ${deliveryId}`);
    }

    const batch = this.findBatchById(delivery.batchId);
    if (!batch) {
      throw new Error(`Batch ${delivery.batchId} associated with delivery not found`);
    }

    delivery.status = 'DELIVERED';
    delivery.updatedAt = new Date().toISOString();

    if (!this.data.receiptConfirmations) this.data.receiptConfirmations = [];
    this.data.receiptConfirmations.unshift(confirmation);

    // Update batch ownership & status to receiving organization
    const recipientOrg = this.findOrganizationById(delivery.toOrganizationId);
    const newOwnerRole = recipientOrg?.type || (batch.currentStatus.includes('DISTRIBUTOR') ? 'DISTRIBUTOR' : 'PHARMACY');
    const newBatchStatus = newOwnerRole === 'DISTRIBUTOR' ? 'RECEIVED_BY_DISTRIBUTOR' : 'RECEIVED_BY_PHARMACY';

    batch.currentOwnerRole = newOwnerRole;
    batch.currentOwnerName = delivery.toOrganizationName;
    if (recipientOrg?.walletAddress) {
      batch.currentOwnerAddress = recipientOrg.walletAddress;
    }
    batch.currentStatus = newBatchStatus;
    batch.updatedAt = new Date().toISOString();

    if (custodyEvent) {
      if (!this.data.custodyEvents) this.data.custodyEvents = [];
      this.data.custodyEvents.push(custodyEvent);
    }

    this.save();
    return { delivery, confirmation, batch };
  }

  cancelDelivery(deliveryId: string, custodyEvent?: CustodyRecord): DeliveryRecord {
    const delivery = this.findDeliveryById(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    if (delivery.status === 'DELIVERED') {
      throw new Error(`Cannot cancel a delivery that has already been delivered`);
    }

    delivery.status = 'CANCELLED';
    delivery.updatedAt = new Date().toISOString();

    // Restore batch remaining quantity
    const batch = this.findBatchById(delivery.batchId);
    if (batch) {
      batch.remainingQuantity += delivery.quantity;
      batch.updatedAt = new Date().toISOString();
    }

    if (custodyEvent) {
      if (!this.data.custodyEvents) this.data.custodyEvents = [];
      this.data.custodyEvents.push(custodyEvent);
    }

    this.save();
    return delivery;
  }

  findReceiptConfirmation(deliveryId: string): ReceiptConfirmationRecord | undefined {
    if (!this.data.receiptConfirmations) return undefined;
    return this.data.receiptConfirmations.find((c) => c.deliveryId.toUpperCase() === deliveryId.trim().toUpperCase());
  }

  // ==========================================================================
  // Metrics & Stats
  // ==========================================================================

  getStats() {
    const totalBatches = this.data.batches.length;
    const recalledBatches = this.data.batches.filter((b) => b.isRecalled).length;
    const activeInTransit = this.data.batches.filter((b) =>
      b.currentStatus.includes('IN_TRANSIT')
    ).length;
    const dispensedBatches = this.data.batches.filter(
      (b) => b.currentStatus === 'DISPENSED'
    ).length;

    return {
      totalBatches,
      recalledBatches,
      activeInTransit,
      dispensedBatches,
      totalParticipants: this.data.users.length,
      totalCustodyEvents: this.data.custodyEvents.length,
    };
  }

  getManufacturerStats(organizationId: string) {
    const orgBatches = this.listBatches(undefined, undefined, organizationId);
    const orgMedicines = this.listMedicines(organizationId);
    const now = Date.now();

    const activeBatches = orgBatches.filter((b) => !b.isRecalled && b.currentStatus !== 'DISPENSED').length;
    const recalledBatches = orgBatches.filter((b) => b.isRecalled).length;
    const expiredBatches = orgBatches.filter((b) => new Date(b.expiryDate).getTime() < now).length;
    const inTransitBatches = orgBatches.filter((b) => b.currentStatus.includes('IN_TRANSIT')).length;
    const totalUnitsProduced = orgBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
    const totalUnitsRemaining = orgBatches.reduce((acc, b) => acc + (b.remainingQuantity || 0), 0);

    return {
      totalMedicines: orgMedicines.length,
      totalBatches: orgBatches.length,
      activeBatches,
      recalledBatches,
      expiredBatches,
      inTransitBatches,
      totalUnitsProduced,
      totalUnitsRemaining,
    };
  }

  getAdminMetrics() {
    const totalOrgs = this.data.organizations.length;
    const activeOrgs = this.data.organizations.filter((o) => o.status === 'ACTIVE').length;
    const inactiveOrgs = this.data.organizations.filter((o) => o.status !== 'ACTIVE').length;

    const orgsByType = {
      MANUFACTURER: this.data.organizations.filter((o) => o.type === 'MANUFACTURER').length,
      DISTRIBUTOR: this.data.organizations.filter((o) => o.type === 'DISTRIBUTOR').length,
      PHARMACY: this.data.organizations.filter((o) => o.type === 'PHARMACY').length,
      HOSPITAL: this.data.organizations.filter((o) => o.type === 'HOSPITAL').length,
    };

    const totalUsers = this.data.users.length;
    const activeUsers = this.data.users.filter((u) => u.isActive).length;
    const inactiveUsers = this.data.users.filter((u) => !u.isActive).length;

    const usersByRole = {
      ADMIN: this.data.users.filter((u) => u.role === 'ADMIN').length,
      MANUFACTURER: this.data.users.filter((u) => u.role === 'MANUFACTURER').length,
      DISTRIBUTOR: this.data.users.filter((u) => u.role === 'DISTRIBUTOR').length,
      PHARMACY: this.data.users.filter((u) => u.role === 'PHARMACY').length,
      HOSPITAL: this.data.users.filter((u) => u.role === 'HOSPITAL').length,
    };

    return {
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        inactive: inactiveOrgs,
        byType: orgsByType,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        byRole: usersByRole,
      },
      activitiesCount: this.data.adminActivities.length,
      batchesCount: this.data.batches.length,
    };
  }
}

export const db = new DatabaseService();
