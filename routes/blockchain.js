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
        hashes: cachedHashes,
        counts: calculateCounts(cachedHashes)
      });
    }
    
    console.log("📊 Fetching blockchain hashes from database");
    
    const allHashes = [];
    
    // Fetch medicine hashes from database
    const medicineHashes = await prisma.medicine_records.findMany({
      where: {
        blockchain_hash: {
          not: null
        }
      },
      select: {
        medicine_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        created_at: true,
        created_by: true,
        created_by_user: {
          select: {
            wallet_address: true,
            full_name: true
          }
        }
      }
    });
    
    for (const record of medicineHashes) {
      allHashes.push({
        type: "medicine",
        recordId: record.medicine_id,
        hash: record.blockchain_hash,
        addedBy: record.created_by_user?.wallet_address || "Unknown",
        addedByName: record.created_by_user?.full_name || "Unknown",
        timestamp: Math.floor(new Date(record.created_at).getTime() / 1000),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Fetch stock hashes from database
    const stockHashes = await prisma.medicine_stocks.findMany({
      where: {
        blockchain_hash: {
          not: null
        }
      },
      select: {
        stock_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        created_at: true,
        added_by_user_id: true,
        added_by_user: {
          select: {
            wallet_address: true,
            full_name: true
          }
        }
      }
    });
    
    for (const record of stockHashes) {
      allHashes.push({
        type: "stock",
        recordId: record.stock_id,
        hash: record.blockchain_hash,
        addedBy: record.added_by_user?.wallet_address || "Unknown",
        addedByName: record.added_by_user?.full_name || "Unknown",
        timestamp: Math.floor(new Date(record.created_at).getTime() / 1000),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Fetch receipt hashes from database
    const receiptHashes = await prisma.medicine_releases.findMany({
      where: {
        blockchain_hash: {
          not: null
        }
      },
      select: {
        release_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        created_at: true,
        released_by_user_id: true,
        released_by_user: {
          select: {
            wallet_address: true,
            full_name: true
          }
        }
      }
    });
    
    for (const record of receiptHashes) {
      allHashes.push({
        type: "receipt",
        recordId: record.release_id,
        hash: record.blockchain_hash,
        addedBy: record.released_by_user?.wallet_address || "Unknown",
        addedByName: record.released_by_user?.full_name || "Unknown",
        timestamp: Math.floor(new Date(record.created_at).getTime() / 1000),
        exists: true,
        txHash: record.blockchain_tx_hash || ""
      });
    }
    
    // Fetch removal hashes from database
    const removalHashes = await prisma.stock_removals.findMany({
      where: {
        blockchain_hash: {
          not: null
        }
      },
      select: {
        removal_id: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        created_at: true,
        removed_by_user_id: true,
        removed_by_user: {
          select: {
            wallet_address: true,
            full_name: true
          }
        }
      }
    });
    
    for (const record of removalHashes) {
      allHashes.push({
        type: "removal",
        recordId: record.removal_id,
        hash: record.blockchain_hash,
        addedBy: record.removed_by_user?.wallet_address || "Unknown",
        addedByName: record.removed_by_user?.full_name || "Unknown",
        timestamp: Math.floor(new Date(record.created_at).getTime() / 1000),
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
      hashes: allHashes,
      counts: calculateCounts(allHashes)
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

// Helper function to calculate counts
function calculateCounts(hashes) {
  return {
    total: hashes.length,
    medicines: hashes.filter((h) => h.type === "medicine").length,
    stocks: hashes.filter((h) => h.type === "stock").length,
    receipts: hashes.filter((h) => h.type === "receipt").length,
    removals: hashes.filter((h) => h.type === "removal").length
  };
}

/**
 * ----------------------------------------------------------------
 * POST /blockchain/verify
 * Verifies if a hash matches the one stored in database
 * (Can optionally verify against blockchain if needed)
 * ----------------------------------------------------------------
 */
router.post("/verify", async (req, res, next) => {
  try {
    const { recordId, type, hash } = req.body;
    if (!recordId || !type || !hash) {
      return res.status(400).json({
        success: false,
        error: "recordId, type, and hash are required",
      });
    }

    let dbHash = null;
    let exists = false;

    // Fetch from database based on type
    switch (type) {
      case "medicine":
        const medicine = await prisma.medicine_records.findUnique({
          where: { medicine_id: parseInt(recordId) },
          select: { blockchain_hash: true, is_active: true }
        });
        dbHash = medicine?.blockchain_hash;
        exists = medicine?.is_active || false;
        break;
      
      case "stock":
        const stock = await prisma.medicine_stocks.findUnique({
          where: { stock_id: parseInt(recordId) },
          select: { blockchain_hash: true, is_active: true }
        });
        dbHash = stock?.blockchain_hash;
        exists = stock?.is_active || false;
        break;
      
      case "receipt":
        const receipt = await prisma.medicine_releases.findUnique({
          where: { release_id: parseInt(recordId) },
          select: { blockchain_hash: true }
        });
        dbHash = receipt?.blockchain_hash;
        exists = !!receipt;
        break;
      
      case "removal":
        const removal = await prisma.stock_removals.findUnique({
          where: { removal_id: parseInt(recordId) },
          select: { blockchain_hash: true }
        });
        dbHash = removal?.blockchain_hash;
        exists = !!removal;
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
        message: "Record does not exist in database",
      });
    }

    if (!dbHash) {
      return res.json({
        success: true,
        verified: false,
        message: "No blockchain hash found for this record",
      });
    }

    const verified = dbHash.toLowerCase() === hash.toLowerCase();
    
    res.json({
      success: true,
      verified,
      databaseHash: dbHash,
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
 * Fetch specific record hash from database
 * ----------------------------------------------------------------
 */
router.get("/record/:type/:id", async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const recordId = parseInt(id);

    let record = null;
    let hash, addedBy, timestamp, exists;

    switch (type) {
      case "medicine":
        record = await prisma.medicine_records.findUnique({
          where: { medicine_id: recordId },
          select: {
            blockchain_hash: true,
            blockchain_tx_hash: true,
            created_at: true,
            is_active: true,
            created_by_user: {
              select: {
                wallet_address: true,
                full_name: true
              }
            }
          }
        });
        break;
      
      case "stock":
        record = await prisma.medicine_stocks.findUnique({
          where: { stock_id: recordId },
          select: {
            blockchain_hash: true,
            blockchain_tx_hash: true,
            created_at: true,
            is_active: true,
            added_by_user: {
              select: {
                wallet_address: true,
                full_name: true
              }
            }
          }
        });
        break;
      
      case "receipt":
        record = await prisma.medicine_releases.findUnique({
          where: { release_id: recordId },
          select: {
            blockchain_hash: true,
            blockchain_tx_hash: true,
            created_at: true,
            released_by_user: {
              select: {
                wallet_address: true,
                full_name: true
              }
            }
          }
        });
        break;
      
      case "removal":
        record = await prisma.stock_removals.findUnique({
          where: { removal_id: recordId },
          select: {
            blockchain_hash: true,
            blockchain_tx_hash: true,
            created_at: true,
            removed_by_user: {
              select: {
                wallet_address: true,
                full_name: true
              }
            }
          }
        });
        break;
      
      default:
        return res.status(400).json({ success: false, error: "Invalid type" });
    }

    if (!record) {
      return res.status(404).json({ 
        success: false, 
        error: "Record not found in database" 
      });
    }

    hash = record.blockchain_hash;
    addedBy = record.created_by_user?.wallet_address || 
              record.added_by_user?.wallet_address || 
              record.released_by_user?.wallet_address || 
              record.removed_by_user?.wallet_address || 
              "Unknown";
    timestamp = Math.floor(new Date(record.created_at).getTime() / 1000);
    exists = record.is_active !== undefined ? record.is_active : true;

    res.json({
      success: true,
      data: { 
        type, 
        recordId, 
        hash, 
        addedBy, 
        timestamp, 
        exists,
        txHash: record.blockchain_tx_hash || ""
      },
    });
  } catch (error) {
    console.error("Error fetching record hash:", error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * GET /blockchain/stats
 * Get blockchain statistics from database
 * ----------------------------------------------------------------
 */
router.get("/stats", async (req, res, next) => {
  try {
    const medicineCount = await prisma.medicine_records.count({
      where: { blockchain_hash: { not: null } }
    });
    
    const stockCount = await prisma.medicine_stocks.count({
      where: { blockchain_hash: { not: null } }
    });
    
    const receiptCount = await prisma.medicine_releases.count({
      where: { blockchain_hash: { not: null } }
    });
    
    const removalCount = await prisma.stock_removals.count({
      where: { blockchain_hash: { not: null } }
    });

    const totalRecords = medicineCount + stockCount + receiptCount + removalCount;

    res.json({
      success: true,
      stats: {
        medicineCount,
        stockCount,
        receiptCount,
        removalCount,
        totalRecords
      },
    });
  } catch (error) {
    console.error("Error fetching blockchain stats:", error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * POST /blockchain/invalidate-cache
 * Manually invalidate the cache (useful after adding new records)
 * ----------------------------------------------------------------
 */
router.post("/invalidate-cache", async (req, res) => {
  try {
    hashCache.del("blockchain_hashes");
    console.log("✅ Cache invalidated");
    res.json({
      success: true,
      message: "Cache invalidated successfully"
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    res.status(500).json({
      success: false,
      error: "Failed to invalidate cache"
    });
  }
});

export default router;