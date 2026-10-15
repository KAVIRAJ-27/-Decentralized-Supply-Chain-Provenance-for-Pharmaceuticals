import { config } from '../config';

export interface BlockchainStatus {
  connected: boolean;
  rpcUrl: string;
  contractAddress: string;
  network: string;
  latestBlock?: number;
  message: string;
}

class BlockchainService {
  private rpcUrl: string;
  private contractAddress: string;

  constructor() {
    this.rpcUrl = config.blockchainRpcUrl;
    this.contractAddress = config.contractAddress;
  }

  async checkStatus(): Promise<BlockchainStatus> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`RPC returned HTTP ${response.status}`);
      }

      const json = await response.json() as { result?: string };
      const blockHex = json.result;
      const latestBlock = blockHex ? parseInt(blockHex, 16) : 0;

      return {
        connected: true,
        rpcUrl: this.rpcUrl,
        contractAddress: this.contractAddress,
        network: 'Hardhat Local / Ethereum Compatible',
        latestBlock,
        message: 'Connected to local blockchain node',
      };
    } catch (err: any) {
      return {
        connected: false,
        rpcUrl: this.rpcUrl,
        contractAddress: this.contractAddress,
        network: 'Offline / Standalone Mode',
        message: `Local node not currently reachable (${err.message}). Running with verified DB ledger mirror.`,
      };
    }
  }

  generateTxHash(): string {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
}

export const blockchainService = new BlockchainService();
