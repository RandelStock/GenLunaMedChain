// backend/routes/verification.js
import express from "express";
import blockchainService from "../utils/blockchainUtils.js";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// ==================== MEDICINE VERIFICATION ====================

/**
 * Verify single medicine hash
 * GET /api/verify/medicine/:id
 */
router.get("/medicine/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await blockchainService.verifyMedicineHash(parseInt(id));

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      success: false,
      error: "Verification failed",
      details: error.message,
    });
  }
});

/**
 * Verify medicine by blockchain hash
 * GET /api/verify/hash/:hash
 */
router.get("/hash/:hash", async (req, res) => {
  try {
    const { hash } = req.params;

    const medicine = await prisma.medicine_records.findFirst({
      where: {
        blockchain_hash: hash,
      },
      include: {
        medicine_stocks: true,
      },
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: "No medicine found with this hash",
      });
    }

    const verification = await blockchainService.verifyMedicineHash(
      medicine.medicine_id
    );

    res.json({
      success: true,
      medicine,
      verification,
    });
  } catch (error) {
    console.error("Hash lookup error:", error);
    res.status(500).json({
      success: false,
      error: "Hash lookup failed",
      details: error.message,
    });
  }
});

/**
 * Batch verify multiple medicines
 * POST /api/verify/batch
 * Body: { medicineIds: [1, 2, 3] }
 */
router.post("/batch", async (req, res) => {
  try {
    const { medicineIds } = req.body;

    if (!Array.isArray(medicineIds)) {
      return res.status(400).json({
        success: false,
        error: "medicineIds must be an array",
      });
    }

    const result = await blockchainService.batchVerify(medicineIds);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Batch verification error:", error);
    res.status(500).json({
      success: false,
      error: "Batch verification failed",
      details: error.message,
    });
  }
});

/**
 * Get audit trail for a medicine
 * GET /api/verify/audit/:id
 */
router.get("/audit/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const auditLogs = await prisma.audit_log.findMany({
      where: {
        medicine_id: parseInt(id),
      },
      orderBy: {
        changed_at: "desc",
      },
    });

    const medicine = await prisma.medicine_records.findUnique({
      where: { medicine_id: parseInt(id) },
      include: { medicine_stocks: true },
    });

    res.json({
      success: true,
      medicine,
      auditTrail: auditLogs,
      totalEntries: auditLogs.length,
    });
  } catch (error) {
    console.error("Audit trail error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit trail",
      details: error.message,
    });
  }
});

/**
 * Get blockchain sync status
 * GET /api/verify/sync-status
 */
router.get("/sync-status", async (req, res) => {
  try {
    const latestSync = await prisma.sync_status.findFirst({
      orderBy: {
        last_successful_sync: "desc",
      },
    });

    const syncCount = await prisma.sync_status.count();

    const medicinesWithHash = await prisma.medicine_records.count({
      where: {
        blockchain_hash: {
          not: null,
        },
      },
    });

    const totalMedicines = await prisma.medicine_records.count();

    res.json({
      success: true,
      latestSync,
      totalSyncs: syncCount,
      medicinesWithHash,
      totalMedicines,
      syncPercentage:
        totalMedicines > 0
          ? ((medicinesWithHash / totalMedicines) * 100).toFixed(2)
          : 0,
    });
  } catch (error) {
    console.error("Sync status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sync status",
      details: error.message,
    });
  }
});

/**
 * Compare database with blockchain
 * GET /api/verify/integrity/:id
 */
router.get("/integrity/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await blockchainService.verifyDataIntegrity(parseInt(id));

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Integrity check error:", error);
    res.status(500).json({
      success: false,
      error: "Integrity check failed",
      details: error.message,
    });
  }
});

// ==================== REMOVAL VERIFICATION ====================

/**
 * Verify single removal hash on blockchain
 * GET /api/verify/removal/:id
 */
router.get("/removal/:id", async (req, res) => {
  try {
    const removalId = parseInt(req.params.id);

    // Get removal from database
    const removal = await prisma.stock_removals.findUnique({
      where: { removal_id: removalId },
      include: {
        medicine: {
          select: {
            medicine_name: true,
            generic_name: true
          }
        },
        stock: {
          select: {
            batch_number: true
          }
        }
      }
    });

    if (!removal) {
      return res.status(404).json({ 
        success: false,
        error: "Removal not found" 
      });
    }

    // Generate hash from current database data
    const currentHash = blockchainService.generateRemovalHash(removal);

    // Get hash from blockchain
    try {
      const [blockchainHash, removedBy, timestamp, exists] = 
        await blockchainService.contract.getRemovalHash(removalId);

      if (!exists) {
        return res.json({
          success: true,
          removal_id: removalId,
          verified: false,
          status: "NOT_ON_BLOCKCHAIN",
          message: "Removal exists in database but not on blockchain",
          database_hash: removal.blockchain_hash,
          current_hash: currentHash
        });
      }

      // Compare hashes
      const hashMatch = currentHash === blockchainHash;
      const storedHashMatch = removal.blockchain_hash === blockchainHash;

      res.json({
        success: true,
        removal_id: removalId,
        verified: hashMatch && storedHashMatch,
        status: hashMatch && storedHashMatch ? "VERIFIED" : "HASH_MISMATCH",
        blockchain: {
          hash: blockchainHash,
          removed_by: removedBy,
          timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          exists: exists
        },
        database: {
          stored_hash: removal.blockchain_hash,
          current_hash: currentHash,
          tx_hash: removal.blockchain_tx_hash,
          last_synced: removal.last_synced_at
        },
        removal_details: {
          medicine: removal.medicine.medicine_name,
          batch: removal.stock.batch_number,
          quantity: removal.quantity_removed,
          reason: removal.reason,
          date: removal.date_removed
        },
        hash_comparison: {
          current_matches_blockchain: hashMatch,
          stored_matches_blockchain: storedHashMatch,
          data_integrity: hashMatch ? "INTACT" : "MODIFIED"
        }
      });
    } catch (blockchainError) {
      console.error("Blockchain verification error:", blockchainError);
      res.status(500).json({
        success: false,
        error: "Blockchain verification failed",
        message: blockchainError.message,
        removal_id: removalId,
        database_hash: removal.blockchain_hash
      });
    }
  } catch (err) {
    console.error("Removal verification error:", err);
    res.status(500).json({
      success: false,
      error: "Verification failed",
      details: err.message
    });
  }
});

/**
 * Batch verify multiple removals
 * POST /api/verify/removals/batch
 * Body: { removal_ids: [1, 2, 3] }
 */
router.post("/removals/batch", async (req, res) => {
  try {
    const { removal_ids } = req.body;

    if (!Array.isArray(removal_ids) || removal_ids.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "removal_ids array is required" 
      });
    }

    const results = [];

    for (const removalId of removal_ids) {
      try {
        const removal = await prisma.stock_removals.findUnique({
          where: { removal_id: parseInt(removalId) }
        });

        if (!removal) {
          results.push({
            removal_id: removalId,
            verified: false,
            status: "NOT_FOUND"
          });
          continue;
        }

        const currentHash = blockchainService.generateRemovalHash(removal);
        const [blockchainHash, , , exists] = 
          await blockchainService.contract.getRemovalHash(parseInt(removalId));

        results.push({
          removal_id: removalId,
          verified: exists && currentHash === blockchainHash,
          status: !exists ? "NOT_ON_BLOCKCHAIN" : 
                  currentHash === blockchainHash ? "VERIFIED" : "HASH_MISMATCH",
          blockchain_hash: blockchainHash,
          database_hash: removal.blockchain_hash
        });
      } catch (err) {
        results.push({
          removal_id: removalId,
          verified: false,
          status: "ERROR",
          error: err.message
        });
      }
    }

    const summary = {
      total: results.length,
      verified: results.filter(r => r.verified).length,
      failed: results.filter(r => !r.verified).length
    };

    res.json({ 
      success: true,
      summary, 
      results 
    });
  } catch (err) {
    console.error("Batch removal verification error:", err);
    res.status(500).json({
      success: false,
      error: "Batch verification failed",
      details: err.message
    });
  }
});

/**
 * Get all removals with blockchain status
 * GET /api/verify/removals/status
 */
router.get("/removals/status", async (req, res) => {
  try {
    const removals = await prisma.stock_removals.findMany({
      select: {
        removal_id: true,
        medicine_id: true,
        quantity_removed: true,
        reason: true,
        blockchain_hash: true,
        blockchain_tx_hash: true,
        last_synced_at: true,
        created_at: true,
        medicine: {
          select: {
            medicine_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const statusList = removals.map(removal => ({
      removal_id: removal.removal_id,
      medicine: removal.medicine.medicine_name,
      quantity: removal.quantity_removed,
      reason: removal.reason,
      blockchain_status: {
        synced: !!removal.blockchain_hash,
        tx_hash: removal.blockchain_tx_hash,
        last_sync: removal.last_synced_at
      },
      created_at: removal.created_at
    }));

    const summary = {
      total: statusList.length,
      synced: statusList.filter(r => r.blockchain_status.synced).length,
      not_synced: statusList.filter(r => !r.blockchain_status.synced).length
    };

    res.json({ 
      success: true,
      summary, 
      removals: statusList 
    });
  } catch (err) {
    console.error("Removal status error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch removal status",
      details: err.message
    });
  }
});

export default router;