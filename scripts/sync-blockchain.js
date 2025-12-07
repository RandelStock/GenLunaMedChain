#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import blockchainListener from '../services/blockchainListener.js';

async function run() {
  try {
    const fromBlock = process.argv[2] ? parseInt(process.argv[2]) : 0;

    if (!process.env.RPC_URL || !process.env.CONTRACT_ADDRESS) {
      console.error('RPC_URL and CONTRACT_ADDRESS must be set in environment');
      process.exit(1);
    }

    console.log(`Initializing listener with RPC=${process.env.RPC_URL} CONTRACT=${process.env.CONTRACT_ADDRESS}`);
    const ok = await blockchainListener.initialize(process.env.RPC_URL, process.env.CONTRACT_ADDRESS);
    if (!ok) {
      console.error('Listener failed to initialize');
      process.exit(1);
    }

    console.log(`Syncing past events from block ${fromBlock}...`);
    await blockchainListener.syncPastEvents(fromBlock);
    console.log('Sync complete');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

run();
