import fs from 'fs';
import path from 'path';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'CONSUMER';
  organizationName: string;
  licenseNumber: string;
  walletAddress: string;
  passwordHash: string; // In production use bcrypt
  createdAt: string;
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

export interface BatchRecord {
  batchId: string;
  drugName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  remainingQuantity: number;
  manufacturerName: string;
  manufacturerAddress: string;
  manufacturingDate: string;
  expiryDate: string;
  currentStatus: string;
  currentOwnerRole: string;
  currentOwnerName: string;
  currentOwnerAddress: string;
  isRecalled: boolean;
  recallReason?: string;
  blockchainTxHash?: string;
  blockNumber?: number;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  batches: BatchRecord[];
  custodyEvents: CustodyRecord[];
}

class DatabaseService {
  private filePath: string;
  private data: DatabaseSchema;

  constructor() {
    this.filePath = path.resolve(process.cwd(), './data/meditrace_db.json');
    this.data = { users: [], batches: [], custodyEvents: [] };
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
        this.data = JSON.parse(raw);
        return;
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

  private seedDefaults() {
    this.data.users = [
      {
        id: 'usr-admin-01',
        name: 'Dr. Evelyn Vance (Chief Regulator)',
        email: 'admin@meditrace.org',
        role: 'ADMIN',
        organizationName: 'National Drug Regulatory Authority',
        licenseNumber: 'REG-FDA-9921',
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        passwordHash: 'admin123',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-mfg-01',
        name: 'Apex Biotech Pharma (Mfg Facility 1)',
        email: 'manufacturer@apexpharma.com',
        role: 'MANUFACTURER',
        organizationName: 'Apex Biotech Pharmaceuticals Ltd.',
        licenseNumber: 'MFG-IND-8832-GMP',
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        passwordHash: 'mfg123',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-dist-01',
        name: 'Global Health Logistics Depot',
        email: 'distributor@ghlogistics.com',
        role: 'DISTRIBUTOR',
        organizationName: 'Global Health Logistics & Cold Chain Inc.',
        licenseNumber: 'DST-LOG-4412',
        walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        passwordHash: 'dist123',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-pharm-01',
        name: 'City Care Hospital & Central Pharmacy',
        email: 'pharmacy@citycare.org',
        role: 'PHARMACY',
        organizationName: 'City Care Medical Center',
        licenseNumber: 'PHM-HOSP-7719',
        walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        passwordHash: 'pharm123',
        createdAt: new Date().toISOString(),
      },
    ];

    const sampleBatch: BatchRecord = {
      batchId: 'MED-20261015-A8F2K',
      drugName: 'Amoxicillin Clavulanate',
      genericName: 'Amoxicillin / Clavulanic Acid',
      dosage: '625mg USP Tablets',
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
  }

  // --- User Operations ---
  findUserByEmail(email: string): UserRecord | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  listUsers(): UserRecord[] {
    return this.data.users;
  }

  // --- Batch Operations ---
  findBatchById(batchId: string): BatchRecord | undefined {
    return this.data.batches.find((b) => b.batchId.toUpperCase() === batchId.toUpperCase());
  }

  listBatches(filterRole?: string, filterOwner?: string): BatchRecord[] {
    let list = [...this.data.batches];
    if (filterRole) {
      list = list.filter((b) => b.currentOwnerRole === filterRole);
    }
    if (filterOwner) {
      list = list.filter((b) => b.currentOwnerAddress.toLowerCase() === filterOwner.toLowerCase());
    }
    return list;
  }

  createBatch(batch: BatchRecord, event: CustodyRecord): void {
    this.data.batches.unshift(batch);
    this.data.custodyEvents.push(event);
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
      .filter((e) => e.batchId.toUpperCase() === batchId.toUpperCase())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

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
}

export const db = new DatabaseService();
