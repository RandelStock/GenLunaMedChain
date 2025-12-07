#!/usr/bin/env node
/**
 * Grant STAFF_ROLE to a wallet address on the MedicineInventory contract
 * Usage: node scripts/grant-staff-role.js <staffWalletAddress>
 * 
 * Requires:
 *  - CONTRACT_ADDRESS in .env
 *  - RPC_URL in .env
 *  - PRIVATE_KEY in .env (for the admin wallet)
 */
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI
let contractABI = { abi: [] };
try {
  const abiPath = path.join(__dirname, '../abi/ContractABI.json');
  const abiData = fs.readFileSync(abiPath, 'utf8');
  contractABI = JSON.parse(abiData);
  if (!contractABI.abi) {
    contractABI.abi = contractABI;
  }
} catch (err) {
  console.error('❌ Failed to load contract ABI:', err.message);
  process.exit(1);
}

async function grantRole() {
  try {
    const staffWallet = process.argv[2];
    if (!staffWallet || !staffWallet.startsWith('0x')) {
      console.error('❌ Usage: node scripts/grant-staff-role.js <staffWalletAddress>');
      console.error('   Example: node scripts/grant-staff-role.js 0x7EDe510897C82b9469853a46cF5f431F04F081a9');
      process.exit(1);
    }

    const contractAddress = process.env.CONTRACT_ADDRESS;
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (!contractAddress || !rpcUrl || !privateKey) {
      console.error('❌ Missing env vars: CONTRACT_ADDRESS, RPC_URL, PRIVATE_KEY');
      process.exit(1);
    }

    console.log('🔧 Setting up provider and wallet...');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const adminWallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi || contractABI, adminWallet);

    console.log(`✅ Admin wallet: ${adminWallet.address}`);
    console.log(`✅ Staff wallet to grant role: ${staffWallet}`);
    console.log(`✅ Contract: ${contractAddress}`);
    console.log(`✅ Network RPC: ${rpcUrl}`);

    // Define STAFF_ROLE (keccak256("STAFF_ROLE"))
    const STAFF_ROLE = ethers.id('STAFF_ROLE');
    console.log(`✅ STAFF_ROLE hash: ${STAFF_ROLE}`);

    // Check if already has role
    console.log('\n🔍 Checking current role status...');
    const hasRole = await contract.hasRole(STAFF_ROLE, staffWallet);
    if (hasRole) {
      console.log(`✅ Wallet ${staffWallet} already has STAFF_ROLE`);
      process.exit(0);
    }

    // Grant role
    console.log(`\n📝 Granting STAFF_ROLE to ${staffWallet}...`);
    const tx = await contract.grantRole(STAFF_ROLE, staffWallet);
    console.log(`⏳ Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`✅ Role granted successfully!`);
    console.log(`   Transaction hash: ${receipt.hash}`);
    console.log(`   Block: ${receipt.blockNumber}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

grantRole();
