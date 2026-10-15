import { ethers } from 'ethers';
import { config } from '../config';
import { MEDITRACE_ABI, CONTRACT_ROLES, CONTRACT_BATCH_STATUS } from './contractAbi';

// Custom Error Hierarchy for Distinguishable Blockchain Errors
export class BlockchainError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'BLOCKCHAIN_ERROR') {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
  }
}

export class BlockchainConnectionError extends BlockchainError {
  constructor(message: string, public readonly rpcUrl: string) {
    super(`Blockchain Connection Failure at ${rpcUrl}: ${message}`, 'RPC_CONNECTION_FAILED');
    this.name = 'BlockchainConnectionError';
  }
}

export class BlockchainExecutionError extends BlockchainError {
  constructor(message: string, public readonly reason?: string, public readonly txHash?: string) {
    super(`Smart Contract Execution Reverted: ${message}`, 'CONTRACT_EXECUTION_REVERTED');
    this.name = 'BlockchainExecutionError';
  }
}

export class BlockchainReceiptError extends BlockchainError {
  constructor(message: string, public readonly txHash: string, public readonly status: number) {
    super(`Transaction mined but receipt indicated failure (status ${status}) on tx ${txHash}: ${message}`, 'TRANSACTION_RECEIPT_FAILED');
    this.name = 'BlockchainReceiptError';
  }
}

export interface BlockchainStatus {
  connected: boolean;
  rpcUrl: string;
  contractAddress: string;
  network: string;
  chainId?: number;
  latestBlock?: number;
  contractDeployed?: boolean;
  message: string;
}

export interface CreateBatchOnChainParams {
  batchId: string;
  drugName: string;
  genericName?: string;
  dosage?: string;
  quantity: number;
  manufacturingDate: string | Date;
  expiryDate: string | Date;
  location?: string;
}

export interface RecordCustodyOnChainParams {
  batchId: string;
  status: string;
  location: string;
  temperatureCelsius?: number;
  notes?: string;
}

export interface BlockchainTxResult {
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  contractAddress: string;
  confirmed: boolean;
  timestamp: string;
}

export interface OnChainProvenanceRecord {
  timestamp: number;
  status: number;
  statusName: string;
  actor: string;
  actorRole: number;
  roleName: string;
  location: string;
  temperatureCelsius: number;
  notes: string;
}

export interface OnChainVerificationResult {
  verified: boolean;
  batchId: string;
  drugName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  manufacturingDate: number;
  expiryDate: number;
  manufacturer: string;
  manufacturerName: string;
  currentOwner: string;
  currentOwnerRole: number;
  status: number;
  statusName: string;
  isRecalled: boolean;
  recallReason: string;
  historyCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface BlockchainTransactionInfo {
  hash: string;
  blockNumber: number | null;
  from: string;
  to: string | null;
  value: string;
  gasLimit: string;
  gasPrice?: string;
  status?: number | null;
  confirmations?: number;
}

export class BlockchainService {
  private rpcUrl: string;
  private contractAddress: string;
  private defaultPrivateKey: string;
  private provider: ethers.JsonRpcProvider | null = null;
  private readContract: ethers.Contract | null = null;

  constructor() {
    this.rpcUrl = config.blockchainRpcUrl;
    this.contractAddress = config.contractAddress;
    // Default local Hardhat development account #1 (Manufacturer) or #0 (Admin)
    this.defaultPrivateKey =
      process.env.BLOCKCHAIN_SIGNER_KEY ||
      process.env.BLOCKCHAIN_ADMIN_KEY ||
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  }

  /**
   * Initializes or gets the cached ethers JsonRpcProvider.
   */
  public getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      const staticNet = ethers.Network.from({ name: 'hardhat', chainId: 31337 });
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl, staticNet, {
        staticNetwork: staticNet,
      });
    }
    return this.provider;
  }

  /**
   * Returns a read-only instance of the deployed MediTrace smart contract.
   */
  public getContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
    const target = signerOrProvider || this.getProvider();
    return new ethers.Contract(this.contractAddress, MEDITRACE_ABI, target);
  }

  /**
   * Obtains an authorized signer using either an explicitly provided private key
   * or the configured development account.
   */
  public getSigner(privateKey?: string): ethers.Wallet {
    const key = privateKey || this.defaultPrivateKey;
    return new ethers.Wallet(key, this.getProvider());
  }

  /**
   * Inspects and returns current node connectivity and contract deployment status.
   */
  public async checkStatus(): Promise<BlockchainStatus> {
    try {
      const provider = this.getProvider();
      const [network, blockNumber, code] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
        provider.getCode(this.contractAddress).catch(() => '0x'),
      ]);

      const contractDeployed = code !== '0x' && code.length > 2;

      return {
        connected: true,
        rpcUrl: this.rpcUrl,
        contractAddress: this.contractAddress,
        network: `Ethereum Compatible (${network.name || 'local'})`,
        chainId: Number(network.chainId),
        latestBlock: blockNumber,
        contractDeployed,
        message: contractDeployed
          ? `Connected to blockchain node. MediTrace contract active at ${this.contractAddress}.`
          : `Connected to blockchain node. Contract not detected at address ${this.contractAddress}.`,
      };
    } catch (err: any) {
      return {
        connected: false,
        rpcUrl: this.rpcUrl,
        contractAddress: this.contractAddress,
        network: 'Offline / Standalone Node',
        contractDeployed: false,
        message: `Local blockchain node unreachable (${err.message}). Database ledger running in standalone mode.`,
      };
    }
  }

  /**
   * Registers a newly formulated pharmaceutical batch on the decentralized smart contract.
   * Ensures receipt verification before confirming on-chain success.
   */
  public async registerBatchOnChain(
    params: CreateBatchOnChainParams,
    signerKey?: string
  ): Promise<BlockchainTxResult> {
    try {
      const signer = this.getSigner(signerKey);
      const contract = this.getContract(signer);

      const mfgTimestamp = Math.floor(new Date(params.manufacturingDate).getTime() / 1000);
      const expTimestamp = Math.floor(new Date(params.expiryDate).getTime() / 1000);

      // Invoke createBatch on smart contract
      const tx = await contract.createBatch(
        params.batchId,
        params.drugName,
        params.genericName || params.drugName,
        params.dosage || 'Standard Formulation',
        BigInt(params.quantity),
        BigInt(mfgTimestamp),
        BigInt(expTimestamp),
        params.location || 'GMP Manufacturing Facility'
      );

      // Wait for actual mined transaction receipt
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new BlockchainReceiptError(
          'createBatch transaction mined with reverted status',
          tx.hash,
          receipt ? receipt.status : 0
        );
      }

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        contractAddress: this.contractAddress,
        confirmed: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof BlockchainError) throw err;
      if (err.code === 'ECONNREFUSED' || err.message?.includes('could not detect network')) {
        throw new BlockchainConnectionError(err.message, this.rpcUrl);
      }
      throw new BlockchainExecutionError(err.message, err.reason, err.transactionHash);
    }
  }

  /**
   * Records a verified custody or temperature provenance update on-chain.
   */
  public async recordCustodyEventOnChain(
    params: RecordCustodyOnChainParams,
    signerKey?: string
  ): Promise<BlockchainTxResult> {
    try {
      const signer = this.getSigner(signerKey);
      const contract = this.getContract(signer);

      const statusEnum = CONTRACT_BATCH_STATUS[params.status] ?? 0;
      const scaledTemp = params.temperatureCelsius !== undefined
        ? Math.round(params.temperatureCelsius * 10)
        : 200; // default 20.0°C ambient

      const tx = await contract.recordCustodyEvent(
        params.batchId,
        statusEnum,
        params.location,
        scaledTemp,
        params.notes || 'Custody event logged'
      );

      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new BlockchainReceiptError(
          'recordCustodyEvent transaction failed',
          tx.hash,
          receipt ? receipt.status : 0
        );
      }

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        contractAddress: this.contractAddress,
        confirmed: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof BlockchainError) throw err;
      if (err.code === 'ECONNREFUSED' || err.message?.includes('could not detect network')) {
        throw new BlockchainConnectionError(err.message, this.rpcUrl);
      }
      throw new BlockchainExecutionError(err.message, err.reason, err.transactionHash);
    }
  }

  /**
   * Issues an emergency recall on the smart contract for a compromised or defective batch.
   */
  public async recallBatchOnChain(
    batchId: string,
    reason: string,
    signerKey?: string
  ): Promise<BlockchainTxResult> {
    try {
      const signer = this.getSigner(signerKey);
      const contract = this.getContract(signer);

      const tx = await contract.recallBatch(batchId, reason);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new BlockchainReceiptError('recallBatch transaction failed', tx.hash, receipt ? receipt.status : 0);
      }

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        contractAddress: this.contractAddress,
        confirmed: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err instanceof BlockchainError) throw err;
      if (err.code === 'ECONNREFUSED' || err.message?.includes('could not detect network')) {
        throw new BlockchainConnectionError(err.message, this.rpcUrl);
      }
      throw new BlockchainExecutionError(err.message, err.reason, err.transactionHash);
    }
  }

  /**
   * Queries the smart contract directly to verify a batch's immutable provenance state.
   */
  public async verifyBatchOnChain(batchId: string): Promise<OnChainVerificationResult> {
    try {
      const contract = this.getContract();
      const [batch, manufacturerName, historyCount] = await contract.verifyBatch(batchId);

      const statusMap = Object.entries(CONTRACT_BATCH_STATUS).reduce(
        (acc, [k, v]) => ({ ...acc, [v]: k }),
        {} as Record<number, string>
      );

      return {
        verified: true,
        batchId: batch.batchId,
        drugName: batch.drugName,
        genericName: batch.genericName,
        dosage: batch.dosage,
        quantity: Number(batch.quantity),
        manufacturingDate: Number(batch.manufacturingDate),
        expiryDate: Number(batch.expiryDate),
        manufacturer: batch.manufacturer,
        manufacturerName,
        currentOwner: batch.currentOwner,
        currentOwnerRole: Number(batch.currentOwnerRole),
        status: Number(batch.status),
        statusName: statusMap[Number(batch.status)] || 'UNKNOWN',
        isRecalled: batch.isRecalled,
        recallReason: batch.recallReason,
        historyCount: Number(historyCount),
        createdAt: Number(batch.createdAt),
        updatedAt: Number(batch.updatedAt),
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('could not detect network')) {
        throw new BlockchainConnectionError(err.message, this.rpcUrl);
      }
      throw new BlockchainExecutionError(err.message, err.reason);
    }
  }

  /**
   * Retrieves the full immutable custody history array from the smart contract.
   */
  public async getProvenanceHistoryOnChain(batchId: string): Promise<OnChainProvenanceRecord[]> {
    try {
      const contract = this.getContract();
      const historyRaw = await contract.getProvenanceHistory(batchId);

      const statusMap = Object.entries(CONTRACT_BATCH_STATUS).reduce(
        (acc, [k, v]) => ({ ...acc, [v]: k }),
        {} as Record<number, string>
      );

      const roleMap = Object.entries(CONTRACT_ROLES).reduce(
        (acc, [k, v]) => ({ ...acc, [v]: k }),
        {} as Record<number, string>
      );

      return historyRaw.map((record: any) => ({
        timestamp: Number(record.timestamp),
        status: Number(record.status),
        statusName: statusMap[Number(record.status)] || 'UNKNOWN',
        actor: record.actor,
        actorRole: Number(record.actorRole),
        roleName: roleMap[Number(record.actorRole)] || 'UNKNOWN',
        location: record.location,
        temperatureCelsius: Number(record.temperatureCelsius) / 10,
        notes: record.notes,
      }));
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('could not detect network')) {
        throw new BlockchainConnectionError(err.message, this.rpcUrl);
      }
      throw new BlockchainExecutionError(err.message, err.reason);
    }
  }

  /**
   * Retrieves transaction metadata and receipt details by transaction hash.
   */
  public async getTransactionInfo(txHash: string): Promise<BlockchainTransactionInfo | null> {
    try {
      const provider = this.getProvider();
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash).catch(() => null),
      ]);

      if (!tx) return null;

      return {
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice ? tx.gasPrice.toString() : undefined,
        status: receipt ? receipt.status : null,
      };
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED') {
        throw new BlockchainConnectionError(err.message, this.rpcUrl);
      }
      return null;
    }
  }

  /**
   * Generates a 256-bit cryptographically formatted transaction hash.
   */
  public generateTxHash(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }
}

export const blockchainService = new BlockchainService();
