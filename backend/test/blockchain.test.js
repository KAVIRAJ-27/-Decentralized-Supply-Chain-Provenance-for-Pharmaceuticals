/**
 * MediTrace — Kavi Phase 6 Blockchain Service Test Suite
 * 
 * Verifies backend blockchain service functionality:
 * 1. Provider and contract instantiation
 * 2. Status inspection and connectivity reporting
 * 3. Contract ABI and interface method mapping
 * 4. Signer derivation and wallet management
 * 5. Cryptographic transaction hash generation
 * 6. Distinguishable error classification (BlockchainConnectionError, BlockchainExecutionError, BlockchainReceiptError)
 * 7. Transaction query handling
 */

process.env.NODE_ENV = 'test';

const assert = require('assert');
const { ethers } = require('ethers');
const {
  blockchainService,
  BlockchainError,
  BlockchainConnectionError,
  BlockchainExecutionError,
  BlockchainReceiptError,
} = require('../dist/services/blockchain.service');
const {
  MEDITRACE_ABI,
  CONTRACT_ROLES,
  CONTRACT_BATCH_STATUS,
} = require('../dist/services/contractAbi');

async function runTests() {
  console.log('\n======================================================');
  console.log('  MediTrace Phase 6: Blockchain Service Test Suite');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Service Provider Initialization
  await test('1. blockchainService initializes JsonRpcProvider with configured RPC URL', async () => {
    const provider = blockchainService.getProvider();
    assert.ok(provider, 'Provider must be defined');
    assert.ok(provider instanceof ethers.JsonRpcProvider, 'Must be an instance of ethers.JsonRpcProvider');
  });

  // 2. Contract Instantiation
  await test('2. blockchainService instantiates contract with deployed address and MEDITRACE_ABI', async () => {
    const contract = blockchainService.getContract();
    assert.ok(contract, 'Contract must be instantiated');
    assert.ok(contract.target, 'Contract target address must exist');
    assert.strictEqual(typeof contract.createBatch, 'function', 'createBatch method must exist on contract interface');
    assert.strictEqual(typeof contract.verifyBatch, 'function', 'verifyBatch method must exist on contract interface');
    assert.strictEqual(typeof contract.recordCustodyEvent, 'function', 'recordCustodyEvent method must exist on contract interface');
    assert.strictEqual(typeof contract.recallBatch, 'function', 'recallBatch method must exist on contract interface');
    assert.strictEqual(typeof contract.isBatchRecalled, 'function', 'isBatchRecalled method must exist on contract interface');
    assert.strictEqual(typeof contract.getProvenanceHistory, 'function', 'getProvenanceHistory method must exist on contract interface');
  });

  // 3. Signer Resolution
  await test('3. blockchainService resolves authorized signer wallet', async () => {
    const signer = blockchainService.getSigner();
    assert.ok(signer, 'Signer wallet must be defined');
    assert.ok(signer.address, 'Signer must have a valid Ethereum address');
    assert.strictEqual(ethers.isAddress(signer.address), true, 'Signer address must be valid checksum/format');
  });

  // 4. Cryptographic Tx Hash Generation
  await test('4. generateTxHash produces cryptographically formatted 256-bit hexadecimal hashes', async () => {
    const hash1 = blockchainService.generateTxHash();
    const hash2 = blockchainService.generateTxHash();

    assert.strictEqual(hash1.startsWith('0x'), true, 'Must start with 0x prefix');
    assert.strictEqual(hash1.length, 66, 'Must be 66 characters long (32 bytes hex + 0x)');
    assert.strictEqual(/^0x[0-9a-fA-F]{64}$/.test(hash1), true, 'Must be valid hex string');
    assert.notStrictEqual(hash1, hash2, 'Subsequent hashes must be distinct random entropy');
  });

  // 5. Status Reporting
  await test('5. checkStatus returns structured node connectivity and contract state', async () => {
    const status = await blockchainService.checkStatus();
    assert.ok(typeof status.connected === 'boolean', 'connected must be boolean');
    assert.ok(status.rpcUrl, 'rpcUrl must be present');
    assert.ok(status.contractAddress, 'contractAddress must be present');
    assert.ok(status.network, 'network description must be present');
    assert.ok(status.message, 'diagnostic message must be present');
  });

  // 6. Error Classification
  await test('6. Error classification distinguishes connection, execution, and receipt errors', async () => {
    const connErr = new BlockchainConnectionError('Connection refused', 'http://127.0.0.1:8545');
    assert.ok(connErr instanceof BlockchainError);
    assert.strictEqual(connErr.code, 'RPC_CONNECTION_FAILED');
    assert.strictEqual(connErr.rpcUrl, 'http://127.0.0.1:8545');

    const execErr = new BlockchainExecutionError('MediTrace: Unauthorized role', 'Unauthorized role');
    assert.ok(execErr instanceof BlockchainError);
    assert.strictEqual(execErr.code, 'CONTRACT_EXECUTION_REVERTED');
    assert.strictEqual(execErr.reason, 'Unauthorized role');

    const receiptErr = new BlockchainReceiptError('Mined with status 0', '0x123', 0);
    assert.ok(receiptErr instanceof BlockchainError);
    assert.strictEqual(receiptErr.code, 'TRANSACTION_RECEIPT_FAILED');
    assert.strictEqual(receiptErr.status, 0);
  });

  // 7. Role & Status Constants Integrity
  await test('7. Contract roles and status enum maps align with Solidity contract', async () => {
    assert.strictEqual(CONTRACT_ROLES.ADMIN, 1);
    assert.strictEqual(CONTRACT_ROLES.MANUFACTURER, 2);
    assert.strictEqual(CONTRACT_ROLES.DISTRIBUTOR, 3);
    assert.strictEqual(CONTRACT_ROLES.PHARMACY, 4);
    assert.strictEqual(CONTRACT_ROLES.CONSUMER, 5);
    assert.strictEqual(CONTRACT_ROLES.HOSPITAL, 6);

    assert.strictEqual(CONTRACT_BATCH_STATUS.MANUFACTURED, 0);
    assert.strictEqual(CONTRACT_BATCH_STATUS.IN_TRANSIT_TO_DISTRIBUTOR, 1);
    assert.strictEqual(CONTRACT_BATCH_STATUS.RECEIVED_BY_DISTRIBUTOR, 2);
    assert.strictEqual(CONTRACT_BATCH_STATUS.IN_TRANSIT_TO_PHARMACY, 3);
    assert.strictEqual(CONTRACT_BATCH_STATUS.RECEIVED_BY_PHARMACY, 4);
    assert.strictEqual(CONTRACT_BATCH_STATUS.DISPENSED, 5);
    assert.strictEqual(CONTRACT_BATCH_STATUS.RECALLED, 6);
  });

  console.log('\n------------------------------------------------------');
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
