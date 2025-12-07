#!/usr/bin/env node
/**
 * Grant STAFF_ROLE to ADMIN_WALLET and all STAFF_* env vars.
 * Usage: node scripts/grant-all-roles.js
 * Requires: CONTRACT_ADDRESS, RPC_URL, PRIVATE_KEY (admin/deployer key) in environment
 */
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.BLOCKCHAIN_CONTRACT_ADDRESS;
  const rpcUrl = process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY;

  if (!contractAddress || !rpcUrl || !privateKey) {
    console.error('Missing CONTRACT_ADDRESS, RPC_URL, or PRIVATE_KEY in environment');
    process.exit(1);
  }

  // Collect targets
  const targets = [];
  if (process.env.ADMIN_WALLET) targets.push(process.env.ADMIN_WALLET);
  Object.keys(process.env).forEach(k => {
    if (k.startsWith('STAFF_') && process.env[k]) targets.push(process.env[k]);
  });

  if (targets.length === 0) {
    console.log('No ADMIN_WALLET or STAFF_* env vars found — nothing to grant');
    process.exit(0);
  }

  // Load ABI
  const abiPath = path.join(process.cwd(), 'abi', 'ContractABI.json');
  if (!fs.existsSync(abiPath)) {
    console.error('Contract ABI not found at', abiPath);
    process.exit(1);
  }
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, abi.abi || abi, wallet);

  const STAFF_ROLE = ethers.id('STAFF_ROLE');

  console.log(`Granting STAFF_ROLE on ${contractAddress} via ${wallet.address}`);

  for (const addr of targets) {
    try {
      console.log(`-> Granting to ${addr} ...`);
      const tx = await contract.grantStaffRole(addr);
      console.log(`   tx: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   granted in block ${receipt.blockNumber}`);
    } catch (err) {
      console.error(`   failed to grant to ${addr}:`, err?.message || err);
    }
  }

  console.log('Done');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
