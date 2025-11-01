import express from "express";
import { ethers } from "ethers";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import prisma from "../config/prismaClient.js";
import NodeCache from "node-cache";

// Initialize cache with 5 minute TTL
const hashCache = new NodeCache({ stdTTL: 300 });

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
 * Fetches all hashes stored in the database
 * OPTIMIZED: Uses database instead of direct blockchain queries
 * ----------------------------------------------------------------
 */
router.get("/hashes", async (req, res, next) => {
  try {
    // Check if we have cached data
    const cacheKey = "blockchain_hashes";
    const cachedHashes = hashCache.get(cacheKey);
    
    if (cachedHashes) {
      console.log("📊 Returning cached blockchain hashes");
      return res.json({
        success: true,
        data: cachedHashes
      });
    }
    
    console.log("📊 Fetching blockchain hashes from database");
    console.log("🔍 DATABASE_URL contains:", process.env.DATABASE_URL?.includes('neon') ? '✅ NEON' : '❌ NOT NEON');
    
    const allHashes = [];
    
    // Fetch medicine hashes from database
    const medicineHashes = await prisma.medicine_records.findMany({
      select: {
        medicine_id: true,
        blockchain_hash: true,
        created_by: true,
        created_at: true,
        blockchain_tx_hash: true
      }
    });
    
    for (const record of medicineHashes) {
      allHashes.push({
        type: "medicine",
        recordId: record.medicine_id,
        hash: record.blockchain_hash,
        addedBy: record.created_by,
        timestamp: new Date(record.created_at).getTime(),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Fetch stock hashes from database
    const stockHashes = await prisma.medicine_stocks.findMany({
      select: {
        stock_id: true,
        blockchain_hash: true,
        created_by: true,
        created_at: true,
        blockchain_tx_hash: true
      }
    });
    
    for (const record of stockHashes) {
      allHashes.push({
        type: "stock",
        recordId: record.stock_id,
        hash: record.blockchain_hash,
        addedBy: record.created_by,
        timestamp: new Date(record.created_at).getTime(),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Fetch receipt hashes from database
    const receiptHashes = await prisma.medicine_releases.findMany({
      select: {
        release_id: true,
        blockchain_hash: true,
        created_by: true,
        created_at: true,
        blockchain_tx_hash: true
      }
    });
    
    for (const record of receiptHashes) {
      allHashes.push({
        type: "receipt",
        recordId: record.release_id,
        hash: record.blockchain_hash,
        addedBy: record.created_by,
        timestamp: new Date(record.created_at).getTime(),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Fetch removal hashes from database
    const removalHashes = await prisma.stock_removals.findMany({
      select: {
        removal_id: true,
        blockchain_hash: true,
        created_by: true,
        created_at: true,
        blockchain_tx_hash: true
      }
    });
    
    for (const record of removalHashes) {
      allHashes.push({
        type: "removal",
        recordId: record.removal_id,
        hash: record.blockchain_hash,
        addedBy: record.created_by,
        timestamp: new Date(record.created_at).getTime(),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Fetch staff hashes from database
    // Note: staff_records model doesn't exist in the schema, using users model instead
    const staffHashes = await prisma.users.findMany({
      select: {
        user_id: true,
        blockchain_hash: true,
        created_by: true,
        created_at: true,
        blockchain_tx_hash: true
      }
    });
    
    for (const record of staffHashes) {
      allHashes.push({
        type: "staff",
        recordId: record.user_id,
        hash: record.blockchain_hash,
        addedBy: record.created_by,
        timestamp: new Date(record.created_at).getTime(),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Sort by timestamp (newest first)
    allHashes.sort((a, b) => b.timestamp - a.timestamp);
    
    // Cache the results for 5 minutes
    hashCache.set(cacheKey, allHashes);

    console.log(`✅ Fetched ${allHashes.length} blockchain hashes from database`);

    // Return the results
    return res.json({
      success: true,
      data: allHashes,
      counts: {
        total: allHashes.length,
        medicines: allHashes.filter((h) => h.type === "medicine").length,
        stocks: allHashes.filter((h) => h.type === "stock").length,
        receipts: allHashes.filter((h) => h.type === "receipt").length,
        removals: allHashes.filter((h) => h.type === "removal").length,
        staff: allHashes.filter((h) => h.type === "staff").length,
      }
    });
  } catch (error) {
    console.error("❌ Error fetching blockchain hashes from database:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch blockchain data from database",
      message: error.message
    });
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
      case "staff":
        [blockchainHash, , , exists] = await contract.getStaffHash(recordId);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: "Invalid type. Must be: medicine, stock, receipt, removal, or staff",
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
      case "staff":
        [hash, addedBy, timestamp, exists] = await contract.getStaffHash(recordId);
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
        totalRecords: Number(medicineCount + stockCount + receiptCount + removalCount + staffCount),
      },
    });
  } catch (error) {
    console.error("Error fetching blockchain stats:", error);
    next(error);
  }
});

export default router;