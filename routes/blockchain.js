import express from "express";
import { ethers } from "ethers";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ✅ Load contract ABI from abi/ContractABI.json
let contractABI, contractAddress;

try {
  const abiPath = join(__dirname, "../abi/ContractABI.json");
  if (fs.existsSync(abiPath)) {
    const contractJson = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    contractABI = contractJson.abi || contractJson;
    contractAddress = process.env.CONTRACT_ADDRESS;
    console.log("✅ Loaded ABI from abi/ContractABI.json");
  } else {
    console.error("❌ ContractABI.json not found in /backend/abi");
  }
} catch (err) {
  console.error("❌ Error loading contract ABI:", err.message);
}

// ✅ Setup provider and contract
let provider, contract;

try {
  if (contractABI && contractAddress && (process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL)) {
    const rpcUrl = process.env.RPC_URL || process.env.BLOCKCHAIN_RPC_URL;
    provider = new ethers.JsonRpcProvider(rpcUrl);
    contract = new ethers.Contract(contractAddress, contractABI, provider);
    console.log("✅ Blockchain contract initialized successfully");
    console.log("📡 RPC URL:", rpcUrl);
  } else {
    console.warn("⚠️ Blockchain contract not initialized. Missing ABI, address, or RPC URL.");
  }
} catch (err) {
  console.error("❌ Error initializing blockchain contract:", err.message);
}

// ✅ Helper function to generate hash (for consistency)
function generateHash(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/**
 * ----------------------------------------------------------------
 * GET /blockchain/hashes
 * Fetches all hashes stored in the database instead of directly from blockchain
 * OPTIMIZED: Uses database records to avoid blockchain rate limits
 * ----------------------------------------------------------------
 */
router.get("/hashes", async (req, res, next) => {
  try {
    // Import prisma client
    const { prisma } = await import("../prisma/client.js");
    
    console.log(`📊 Fetching blockchain transactions from database`);
    
    const allHashes = [];
    
    // Fetch medicine transactions from database
    const medicineRecords = await prisma.medicine_records.findMany({
      where: {
        blockchain_hash: { not: null },
        blockchain_tx_hash: { not: null }
      },
      select: {
        medicine_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        added_by_wallet: true,
        created_at: true,
        is_active: true
      }
    });
    
    for (const record of medicineRecords) {
      allHashes.push({
        type: "medicine",
        recordId: record.medicine_id,
        hash: record.blockchain_hash,
        addedBy: record.added_by_wallet,
        timestamp: Math.floor(record.created_at.getTime() / 1000),
        exists: record.is_active,
        txHash: record.blockchain_tx_hash
      });
    }
    
    // Fetch stock transactions from database
    const stockRecords = await prisma.medicine_stocks.findMany({
      where: {
        blockchain_hash: { not: null },
        blockchain_tx_hash: { not: null }
      },
      select: {
        stock_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        added_by_wallet: true,
        created_at: true,
        is_active: true
      }
    });
    
    for (const record of stockRecords) {
      allHashes.push({
        type: "stock",
        recordId: record.stock_id,
        hash: record.blockchain_hash,
        addedBy: record.added_by_wallet,
        timestamp: Math.floor(record.created_at.getTime() / 1000),
        exists: record.is_active,
        txHash: record.blockchain_tx_hash
      });
    }
    
    // Fetch receipt transactions from database (medicine_releases)
    const receiptRecords = await prisma.medicine_releases.findMany({
      where: {
        blockchain_hash: { not: null },
        blockchain_tx_hash: { not: null }
      },
      select: {
        release_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        released_by_wallet: true,
        created_at: true,
        is_active: true
      }
    });
    
    for (const record of receiptRecords) {
      allHashes.push({
        type: "receipt",
        recordId: record.release_id,
        hash: record.blockchain_hash,
        addedBy: record.released_by_wallet,
        timestamp: Math.floor(record.created_at.getTime() / 1000),
        exists: record.is_active,
        txHash: record.blockchain_tx_hash
      });
    }
    
    // Fetch removal transactions from database
    const removalRecords = await prisma.stock_removals.findMany({
      where: {
        blockchain_hash: { not: null },
        blockchain_tx_hash: { not: null }
      },
      select: {
        removal_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        removed_by_wallet: true,
        created_at: true
      }
    });
    
    for (const record of removalRecords) {
      allHashes.push({
        type: "removal",
        recordId: record.removal_id,
        hash: record.blockchain_hash,
        addedBy: record.removed_by_wallet,
        timestamp: Math.floor(record.created_at.getTime() / 1000),
        exists: true, // Removals don't have an is_active field
        txHash: record.blockchain_tx_hash
      });
    }
    
    // Also fetch from blockchain_transactions table for comprehensive history
    const blockchainTxs = await prisma.blockchain_transactions.findMany({
      orderBy: {
        created_at: 'desc'
      },
      take: 1000 // Limit to most recent 1000 transactions
    });
    
    // Add any transactions from blockchain_transactions that aren't already included
    for (const tx of blockchainTxs) {
      // Skip if this transaction is already in allHashes
      if (allHashes.some(h => h.txHash === tx.tx_hash)) {
        continue;
      }
      
      // Add transaction to allHashes
      if (tx.entity_type && tx.entity_id) {
        const type = tx.entity_type.toLowerCase();
        allHashes.push({
          type: type === 'medicine' ? 'medicine' : 
                type === 'stock' ? 'stock' : 
                type === 'receipt' ? 'receipt' : 
                type === 'removal' ? 'removal' : type,
          recordId: tx.entity_id,
          hash: tx.event_data?.dataHash || tx.event_data?.hash || null,
          addedBy: tx.from_address,
          timestamp: Math.floor(tx.created_at.getTime() / 1000),
          exists: tx.status !== 'DELETED',
          txHash: tx.tx_hash
        });
      }
    }
    
    // ✅ Sort newest first
    allHashes.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`✅ Fetched ${allHashes.length} blockchain hashes from database successfully`);
    
    // Get current block if contract is available (for informational purposes only)
    let currentBlock = 0;
    let fromBlock = 0;
    
    if (contract && provider) {
      try {
        currentBlock = await provider.getBlockNumber();
        fromBlock = Math.max(0, currentBlock - 20000); // Just for reference
      } catch (err) {
        console.warn("Could not fetch current block number:", err.message);
      }
    }
    
    res.json({
      success: true,
      hashes: allHashes,
      blockRange: {
        from: fromBlock,
        to: currentBlock,
        blocksScanned: currentBlock - fromBlock
      },
      counts: {
        total: allHashes.length,
        medicines: allHashes.filter((h) => h.type === "medicine").length,
        stocks: allHashes.filter((h) => h.type === "stock").length,
        receipts: allHashes.filter((h) => h.type === "receipt").length,
        removals: allHashes.filter((h) => h.type === "removal").length,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching blockchain hashes:", error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * POST /blockchain/verify
 * Verifies if a hash on blockchain matches the database record
 * ----------------------------------------------------------------
 */
router.post("/verify", async (req, res, next) => {
  try {
    if (!contract) {
      return res.status(503).json({
        success: false,
        error: "Blockchain service not available. Contract not initialized.",
      });
    }

    const { recordId, type, hash } = req.body;
    if (!recordId || !type || !hash) {
      return res.status(400).json({
        success: false,
        error: "recordId, type, and hash are required",
      });
    }

    let blockchainHash, exists;
    switch (type) {
      case "medicine":
        [blockchainHash, , , exists] = await contract.getMedicineHash(recordId);
        break;
      case "stock":
        [blockchainHash, , , exists] = await contract.getStockHash(recordId);
        break;
      case "receipt":
        [blockchainHash, , , exists] = await contract.getReceiptHash(recordId);
        break;
      case "removal":
        [blockchainHash, , , exists] = await contract.getRemovalHash(recordId);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: "Invalid type. Must be: medicine, stock, receipt, or removal",
        });
    }

    if (!exists) {
      return res.json({
        success: true,
        verified: false,
        message: "Record does not exist on blockchain",
      });
    }

    const verified = blockchainHash.toLowerCase() === hash.toLowerCase();
    res.json({
      success: true,
      verified,
      blockchainHash,
      providedHash: hash,
      message: verified
        ? "Hash verification successful - data integrity confirmed"
        : "Hash mismatch - data may have been tampered with",
    });
  } catch (error) {
    console.error("Error verifying hash:", error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * GET /blockchain/record/:type/:id
 * Fetch specific record hash from blockchain
 * ----------------------------------------------------------------
 */
router.get("/record/:type/:id", async (req, res, next) => {
  try {
    if (!contract) {
      return res.status(503).json({
        success: false,
        error: "Blockchain service not available. Contract not initialized.",
      });
    }

    const { type, id } = req.params;
    const recordId = parseInt(id);

    let hash, addedBy, timestamp, exists;
    switch (type) {
      case "medicine":
        [hash, addedBy, timestamp, exists] = await contract.getMedicineHash(recordId);
        break;
      case "stock":
        [hash, addedBy, timestamp, exists] = await contract.getStockHash(recordId);
        break;
      case "receipt":
        [hash, addedBy, timestamp, exists] = await contract.getReceiptHash(recordId);
        break;
      case "removal":
        [hash, addedBy, timestamp, exists] = await contract.getRemovalHash(recordId);
        break;
      default:
        return res.status(400).json({ success: false, error: "Invalid type" });
    }

    if (!exists) {
      return res.status(404).json({ success: false, error: "Record not found on blockchain" });
    }

    res.json({
      success: true,
      data: { type, recordId, hash, addedBy, timestamp: Number(timestamp), exists },
    });
  } catch (error) {
    console.error("Error fetching record hash:", error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * GET /blockchain/stats
 * Get blockchain statistics
 * ----------------------------------------------------------------
 */
router.get("/stats", async (req, res, next) => {
  try {
    if (!contract) {
      return res.status(503).json({
        success: false,
        error: "Blockchain service not available. Contract not initialized.",
      });
    }

    const medicineCount = (typeof contract.getMedicineCount === "function") ? await contract.getMedicineCount() : 0;
    const stockCount = (typeof contract.getStockCount === "function") ? await contract.getStockCount() : 0;
    const receiptCount = (typeof contract.getReceiptCount === "function") ? await contract.getReceiptCount() : 0;
    const removalCount = (typeof contract.getRemovalCount === "function") ? await contract.getRemovalCount() : 0;
    const staffCount = (typeof contract.getStaffCount === "function") ? await contract.getStaffCount() : 0;

    res.json({
      success: true,
      stats: {
        medicineCount: Number(medicineCount),
        stockCount: Number(stockCount),
        receiptCount: Number(receiptCount),
        removalCount: Number(removalCount),
        staffCount: Number(staffCount),
        totalRecords: Number(medicineCount + stockCount + receiptCount + removalCount),
      },
    });
  } catch (error) {
    console.error("Error fetching blockchain stats:", error);
    next(error);
  }
});

export default router;