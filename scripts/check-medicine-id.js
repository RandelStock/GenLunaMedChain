import dotenv from 'dotenv';
import { createRequire } from 'module';
import { ethers } from 'ethers';

// Load env
dotenv.config();
const require = createRequire(import.meta.url);

// Load ABI
let contractJson;
try {
  contractJson = require('../abi/ContractABI.json');
} catch (err) {
  console.error('Failed to load ContractABI.json:', err.message);
  process.exit(2);
}
const contractABI = contractJson.abi || contractJson;

async function main() {
  const arg = process.argv[2];
  const idArg = arg && !arg.startsWith('0x') ? arg : process.argv[2];
  const id = idArg ? Number(idArg) : NaN;
  if (isNaN(id)) {
    console.error('Usage: node check-medicine-id.js <id> [contractAddress]');
    process.exit(1);
  }

  const contractAddress = process.argv[3] || process.env.CONTRACT_ADDRESS;
  const rpcUrl = process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL;

  if (!contractAddress) {
    console.error('CONTRACT_ADDRESS not provided as arg or in env');
    process.exit(2);
  }
  if (!rpcUrl) {
    console.error('RPC_URL or BLOCKCHAIN_RPC_URL not set in environment');
    process.exit(2);
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    console.log(`Querying contract ${contractAddress} for medicine ID ${id}...`);
    const result = await contract.getMedicineHash(id);
    // result is [bytes32, address, uint256, bool]
    const dataHash = result[0];
    const addedBy = result[1];
    const timestamp = result[2]?.toString ? result[2].toString() : result[2];
    const exists = !!result[3];

    console.log('exists:', exists);
    console.log('dataHash:', dataHash);
    console.log('addedBy:', addedBy);
    if (timestamp && timestamp !== '0') {
      const ts = Number(timestamp);
      if (!isNaN(ts)) {
        console.log('timestamp:', ts, '=>', new Date(ts * 1000).toISOString());
      } else {
        console.log('timestamp (raw):', timestamp);
      }
    }

    if (!exists) {
      console.log(`Medicine ID ${id} does NOT exist on contract ${contractAddress}.`);
    } else {
      console.log(`Medicine ID ${id} exists on contract ${contractAddress}.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error querying contract:', err);
    process.exit(3);
  }
}

main();
