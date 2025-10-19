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
    contractABI = contractJson.abi || contractJson; // handles both full JSON and ABI-only
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
  if (contractABI && contractAddress && process.env.RPC_URL) {
    provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    contract = new ethers.Contract(contractAddress, contractABI, provider);
    console.log("✅ Blockchain contract initialized successfully");
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
 * Fetches all hashes stored on the blockchain
 * ----------------------------------------------------------------
 */
router.get("/hashes", async (req, res, next) => {
  try {
    if (!contract) {
      return res.status(503).json({
        success: false,
        error: "Blockchain service not available. Contract not initialized.",
      });
    }

    const allHashes = [];

    // Helper: get unique ids from events for a given event set and map to latest tx
    async function getIdsAndLatestTx(eventNames) {
      const idsToLatestTx = new Map();
      for (const { name, filterFactory } of eventNames) {
        if (!contract.filters[name]) continue;
        // Query all events of this type from block 0
        const filter = filterFactory ? filterFactory() : contract.filters[name]();
        const events = await contract.queryFilter(filter, 0, "latest");
        for (const ev of events) {
          const id = Number(ev.args?.[0]);
          if (!Number.isFinite(id)) continue;
          // Keep the txHash of the most recent occurrence we see while scanning forward
          idsToLatestTx.set(id, ev.transactionHash);
        }
      }
      return idsToLatestTx;
    }

    // MEDICINE: derive ids from Stored/Updated/Deleted events
    const medicineIds = await getIdsAndLatestTx([
      { name: "MedicineHashStored", filterFactory: () => contract.filters.MedicineHashStored(null) },
      { name: "MedicineHashUpdated", filterFactory: () => contract.filters.MedicineHashUpdated(null) },
      { name: "MedicineHashDeleted", filterFactory: () => contract.filters.MedicineHashDeleted(null) },
    ]);
    for (const [id, latestTxHash] of medicineIds) {
      try {
        const [hash, addedBy, timestamp, exists] = await contract.getMedicineHash(id);
        allHashes.push({
          type: "medicine",
          recordId: id,
          hash,
          addedBy,
          timestamp: Number(timestamp),
          exists,
          txHash: latestTxHash,
        });
      } catch (err) {
        console.error(`Error fetching medicine hash ${id}:`, err);
      }
    }

    // STOCK
    const stockIds = await getIdsAndLatestTx([
      { name: "StockHashStored", filterFactory: () => contract.filters.StockHashStored(null) },
      { name: "StockHashUpdated", filterFactory: () => contract.filters.StockHashUpdated(null) },
      { name: "StockHashDeleted", filterFactory: () => contract.filters.StockHashDeleted(null) },
    ]);
    for (const [id, latestTxHash] of stockIds) {
      try {
        const [hash, addedBy, timestamp, exists] = await contract.getStockHash(id);
        allHashes.push({
          type: "stock",
          recordId: id,
          hash,
          addedBy,
          timestamp: Number(timestamp),
          exists,
          txHash: latestTxHash,
        });
      } catch (err) {
        console.error(`Error fetching stock hash ${id}:`, err);
      }
    }

    // RECEIPT - include each event (store/update/delete) as its own history row
    try {
      const storedEvents = await contract.queryFilter(contract.filters.ReceiptHashStored(null), 0, "latest");
      for (const ev of storedEvents) {
        const id = Number(ev.args?.[0]);
        const dataHash = ev.args?.[1];
        const addedBy = ev.args?.[2];
        const ts = Number(ev.args?.[3]);
        allHashes.push({
          type: "receipt",
          recordId: id,
          hash: dataHash,
          addedBy,
          timestamp: ts,
          exists: true,
          txHash: ev.transactionHash,
        });
      }

      const updatedEvents = await contract.queryFilter(contract.filters.ReceiptHashUpdated(null), 0, "latest");
      for (const ev of updatedEvents) {
        const id = Number(ev.args?.[0]);
        const newHash = ev.args?.[2];
        const updatedBy = ev.args?.[3];
        const ts = Number(ev.args?.[4]);
        allHashes.push({
          type: "receipt",
          recordId: id,
          hash: newHash,
          addedBy: updatedBy,
          timestamp: ts,
          exists: true,
          txHash: ev.transactionHash,
        });
      }

      const deletedEvents = await contract.queryFilter(contract.filters.ReceiptHashDeleted(null), 0, "latest");
      // Helper to find the most recent hash BEFORE deletion
      async function getLastReceiptHashBefore(id, blockNumber) {
        const updates = await contract.queryFilter(contract.filters.ReceiptHashUpdated(id), 0, blockNumber);
        const stores = await contract.queryFilter(contract.filters.ReceiptHashStored(id), 0, blockNumber);
        const candidates = [];
        for (const e of updates) candidates.push({ blockNumber: e.blockNumber, logIndex: e.index, hash: e.args?.[2] });
        for (const e of stores) candidates.push({ blockNumber: e.blockNumber, logIndex: e.index, hash: e.args?.[1] });
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => a.blockNumber !== b.blockNumber ? a.blockNumber - b.blockNumber : a.logIndex - b.logIndex);
        return candidates[candidates.length - 1].hash || null;
      }

      for (const ev of deletedEvents) {
        const id = Number(ev.args?.[0]);
        const removedBy = ev.args?.[1];
        const ts = Number(ev.args?.[2]);
        let priorHash = null;
        try {
          priorHash = await getLastReceiptHashBefore(id, ev.blockNumber);
        } catch (e) {
          // swallow
        }
        allHashes.push({
          type: "receipt",
          recordId: id,
          hash: priorHash,
          addedBy: removedBy,
          timestamp: ts,
          exists: false,
          txHash: ev.transactionHash,
        });
      }
    } catch (err) {
      console.error("Error fetching receipt events:", err);
    }

    // REMOVAL
    const removalIds = await getIdsAndLatestTx([
      { name: "RemovalHashStored", filterFactory: () => contract.filters.RemovalHashStored(null) },
      { name: "RemovalHashUpdated", filterFactory: () => contract.filters.RemovalHashUpdated(null) },
      { name: "RemovalHashDeleted", filterFactory: () => contract.filters.RemovalHashDeleted(null) },
    ]);
    for (const [id, latestTxHash] of removalIds) {
      try {
        const [hash, removedBy, timestamp, exists] = await contract.getRemovalHash(id);
        allHashes.push({
          type: "removal",
          recordId: id,
          hash,
          addedBy: removedBy,
          timestamp: Number(timestamp),
          exists,
          txHash: latestTxHash,
        });
      } catch (err) {
        console.error(`Error fetching removal hash ${id}:`, err);
      }
    }

    // ✅ Sort newest first
    allHashes.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      hashes: allHashes,
      counts: {
        total: allHashes.length,
        medicines: allHashes.filter((h) => h.type === "medicine").length,
        stocks: allHashes.filter((h) => h.type === "stock").length,
        receipts: allHashes.filter((h) => h.type === "receipt").length,
        removals: allHashes.filter((h) => h.type === "removal").length,
      },
    });
  } catch (error) {
    console.error("Error fetching blockchain hashes:", error);
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
