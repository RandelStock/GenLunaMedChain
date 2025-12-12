// backend/routes/removals.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { logAuditFromRequest } from '../utils/auditLogger.js';
import { getBarangayFilter, canModifyRecord } from '../middleware/baranggayAccess.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// BARANGAY HELPER FUNCTIONS
// ============================================
// Uncomment when ready to enforce auth:
// router.use(authenticateUser);
// router.use(checkBarangayAccess);

// const getBarangayFilter = (user) => {
//   if (!user) return {}; // No user auth yet
//   if (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
//     return {}; // See all barangays
//   }
//   if (user.assigned_barangay) {
//     return { barangay: user.assigned_barangay };
//   }
//   return {};
// };

// const canModifyRecord = (user, recordBarangay) => {
//   if (!user) return true; // No auth yet
//   if (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
//     return true;
//   }
//   return user.assigned_barangay === recordBarangay;
// };

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/removals/stats
 * Get removal statistics for user's barangay
 */
router.get("/stats", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);

    const [
      totalRemovals,
      todayRemovals,
      thisMonthRemovals,
      removalsByReason
    ] = await Promise.all([
      prisma.stock_removals.count({
        where: {
          medicine: barangayFilter
        }
      }),
      prisma.stock_removals.count({
        where: {
          medicine: barangayFilter,
          date_removed: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.stock_removals.count({
        where: {
          medicine: barangayFilter,
          date_removed: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.stock_removals.groupBy({
        by: ['reason'],
        where: {
          medicine: barangayFilter
        },
        _count: true,
        _sum: {
          quantity_removed: true
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalRemovals,
        todayRemovals,
        thisMonthRemovals,
        removalsByReason: removalsByReason.reduce((acc, item) => {
          acc[item.reason] = {
            count: item._count,
            quantity: item._sum.quantity_removed
          };
          return acc;
        }, {})
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (err) {
    console.error('Error fetching removal stats:', err);
    next(err);
  }
});

/**
 * GET all stock removals with barangay filtering
 */
router.get("/", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const { medicine_id, stock_id, reason, start_date, end_date, barangay, page = 1, limit = 50 } = req.query;
    
    const where = {
      medicine: barangayFilter
    };

    // Admin can filter by specific barangay
    if (barangay && user && (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF')) {
      where.medicine = { barangay };
    }

    if (medicine_id) where.medicine_id = parseInt(medicine_id);
    if (stock_id) where.stock_id = parseInt(stock_id);
    if (reason) where.reason = reason;
    if (start_date || end_date) {
      where.date_removed = {};
      if (start_date) where.date_removed.gte = new Date(start_date);
      if (end_date) where.date_removed.lte = new Date(end_date);
    }

    const [removals, total] = await Promise.all([
      prisma.stock_removals.findMany({
        where,
        include: {
          medicine: {
            select: {
              medicine_id: true,
              medicine_name: true,
              generic_name: true,
              dosage_form: true,
              strength: true,
              barangay: true
            }
          },
          stock: {
            select: {
              stock_id: true,
              batch_number: true,
              expiry_date: true,
              remaining_quantity: true,
              storage_location: true
            }
          },
          removed_by_user: {
            select: {
              user_id: true,
              full_name: true,
              wallet_address: true
            }
          }
        },
        orderBy: { date_removed: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.stock_removals.count({ where })
    ]);
    
    res.json({
      success: true,
      data: removals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (err) {
    console.error('Error fetching removals:', err);
    next(err);
  }
});

/**
 * GET single removal by ID with barangay access check
 */
// ✅ CORRECT - With removal_id
router.get('/:id', async (req, res) => {
  try {
    const removalId = parseInt(req.params.id); // Parse the ID from URL
    
    if (!removalId || isNaN(removalId)) {
      return res.status(400).json({ error: 'Invalid removal ID' });
    }

    const removal = await prisma.stock_removals.findUnique({
      where: {
        removal_id: removalId  // ✅ Add this line
      },
      include: {
        medicine: {
          select: {
            medicine_id: true,
            medicine_name: true,
            barangay: true
          }
        },
        stock: true,
        removed_by_user: true
      }
    });

    if (!removal) {
      return res.status(404).json({ error: 'Removal not found' });
    }

    res.json(removal);
  } catch (error) {
    console.error('Error fetching removal:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST new removal with barangay validation
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      medicine_id,
      stock_id,
      quantity_removed,
      reason,
      notes,
      date_removed,
      removed_by_user_id,
      removed_by_wallet
    } = req.body;

    const user = req.user || null;

    // Validate required fields
    if (!medicine_id || !stock_id || !quantity_removed || !reason || !date_removed) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["medicine_id", "stock_id", "quantity_removed", "reason", "date_removed"]
      });
    }

    // Verify medicine exists and user has access to its barangay
    const medicine = await prisma.medicine_records.findUnique({
      where: { medicine_id: parseInt(medicine_id) }
    });

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, medicine.barangay)) {
      return res.status(403).json({ 
        error: 'Cannot create removal for medicine from different barangay',
        medicineBarangay: medicine.barangay,
        yourBarangay: user.assigned_barangay
      });
    }

    // Validate wallet address if provided
    if (removed_by_wallet && !/^0x[a-fA-F0-9]{40}$/.test(removed_by_wallet)) {
      return res.status(400).json({
        error: "Invalid wallet address format"
      });
    }

    // Check stock availability
    const stock = await prisma.medicine_stocks.findUnique({
      where: { stock_id: parseInt(stock_id) }
    });

    if (!stock) {
      return res.status(404).json({ error: "Stock not found" });
    }

    if (stock.remaining_quantity < quantity_removed) {
      return res.status(400).json({
        error: "Insufficient stock quantity",
        available: stock.remaining_quantity,
        requested: quantity_removed
      });
    }

    // Find user_id from wallet address if provided
    let userId = removed_by_user_id ? parseInt(removed_by_user_id) : null;
    
    if (removed_by_wallet && !userId) {
      const userRecord = await prisma.users.findUnique({
        where: { wallet_address: removed_by_wallet.toLowerCase() }
      });
      if (userRecord) {
        userId = userRecord.user_id;
      }
    }

    // Use authenticated user if available
    if (user && !userId) {
      userId = user.user_id;
    }

    // Generate new removal_id
    const lastRemoval = await prisma.stock_removals.findFirst({
      orderBy: { removal_id: "desc" }
    });
    const newRemovalId = lastRemoval ? lastRemoval.removal_id + 1 : 1;

    // Create removal record
    const removal = await prisma.stock_removals.create({
      data: {
        removal_id: newRemovalId,
        medicine_id: parseInt(medicine_id),
        stock_id: parseInt(stock_id),
        quantity_removed: parseInt(quantity_removed),
        reason,
        notes: notes || null,
        date_removed: new Date(date_removed),
        removed_by_user_id: userId,
        removed_by_wallet: removed_by_wallet ? removed_by_wallet.toLowerCase() : null
      },
      include: {
        medicine: {
          select: {
            medicine_name: true,
            barangay: true
          }
        },
        stock: true,
        removed_by_user: true
      }
    });

    // Update stock remaining quantity
    await prisma.medicine_stocks.update({
      where: { stock_id: parseInt(stock_id) },
      data: {
        remaining_quantity: {
          decrement: parseInt(quantity_removed)
        }
      }
    });

    // PATCH /api/removals/:id/blockchain - Update blockchain info
    await logAuditFromRequest({
      req,
      tableName: 'stock_removals',
      recordId: removalId,
      action: 'PATCH',
      oldValues: oldRemoval,
      newValues: updated,
    }).catch(err => console.error('Audit log failed:', err));

    res.status(201).json({
      success: true,
      data: removal,
      message: `Stock removal created for ${medicine.barangay}`
    });
  } catch (err) {
    console.error('Error creating removal:', err);
    next(err);
  }
});

/**
 * PATCH - Update blockchain info after frontend syncs
 */
router.patch("/:id/blockchain", async (req, res, next) => {
  try {
    const removalId = parseInt(req.params.id);
    const { blockchain_hash, blockchain_tx_hash, removed_by_wallet } = req.body;
    const user = req.user || null;

    if (!blockchain_hash || !blockchain_tx_hash) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["blockchain_hash", "blockchain_tx_hash"]
      });
    }

    const oldRemoval = await prisma.stock_removals.findUnique({
      where: { removal_id: removalId },
      include: {
        medicine: {
          select: { barangay: true }
        }
      }
    });

    if (!oldRemoval) {
      return res.status(404).json({ error: "Removal not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, oldRemoval.medicine.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update with blockchain info
    const updated = await prisma.stock_removals.update({
      where: { removal_id: removalId },
      data: {
        blockchain_hash,
        blockchain_tx_hash,
        removed_by_wallet: removed_by_wallet?.toLowerCase() || oldRemoval.removed_by_wallet,
        last_synced_at: new Date()
      },
      include: {
        medicine: true,
        stock: true,
        removed_by_user: true
      }
    });

    // PATCH /api/removals/:id/blockchain - Update blockchain info
    await logAuditFromRequest({
      req,
      tableName: 'stock_removals',
      recordId: removalId,
      action: 'PATCH',
      oldValues: oldRemoval,
      newValues: updated,
    }).catch(err => console.error('Audit log failed:', err));

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating removal blockchain info:', err);
    next(err);
  }
});

/**
 * DELETE removal (restore stock on delete) with barangay access check
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const removalId = parseInt(req.params.id);
    const user = req.user || null;

    // Fetch removal details
    const removal = await prisma.stock_removals.findUnique({
      where: { removal_id: removalId },
      include: {
        medicine: {
          select: { barangay: true }
        }
      }
    });

    if (!removal) {
      return res.status(404).json({ error: "Removal not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, removal.medicine.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Restore quantity back to stock
    await prisma.medicine_stocks.update({
      where: { stock_id: removal.stock_id },
      data: {
        remaining_quantity: {
          increment: removal.quantity_removed
        }
      }
    });

    // Delete removal record
    await prisma.stock_removals.delete({
      where: { removal_id: removalId }
    });

    // DELETE /api/removals/:id - Delete removal
    await logAuditFromRequest({
      req,
      tableName: 'stock_removals',
      recordId: removalId,
      action: 'DELETE',
      oldValues: removal,
      newValues: null,
    }).catch(err => console.error('Audit log failed:', err));

    res.json({
      success: true,
      message: "Removal deleted and stock restored",
      removed_removal_id: removalId,
      restored_quantity: removal.quantity_removed
    });
  } catch (err) {
    console.error('Error deleting removal:', err);
    next(err);
  }
});

/**
 * GET removal statistics summary with barangay filtering
 */
router.get("/stats/summary", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const { start_date, end_date } = req.query;
    
    const where = {
      medicine: barangayFilter
    };

    if (start_date || end_date) {
      where.date_removed = {};
      if (start_date) where.date_removed.gte = new Date(start_date);
      if (end_date) where.date_removed.lte = new Date(end_date);
    }

    const stats = await prisma.stock_removals.groupBy({
      by: ["reason"],
      where,
      _sum: {
        quantity_removed: true
      },
      _count: {
        removal_id: true
      }
    });

    res.json({
      success: true,
      data: stats,
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (err) {
    console.error('Error fetching removal summary:', err);
    next(err);
  }
});

/**
 * GET /api/removals/barangay/:barangay
 * Get removals for specific barangay (admin only)
 */
router.get("/barangay/:barangay", async (req, res, next) => {
  try {
    const user = req.user || null;

    // Only admin/municipal staff can view specific barangays
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const barangay = req.params.barangay;

    const removals = await prisma.stock_removals.findMany({
      where: { 
        medicine: {
          barangay: barangay
        }
      },
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
      },
      orderBy: { date_removed: 'desc' }
    });

    res.json({ 
      success: true, 
      data: removals,
      barangay: barangay,
      total: removals.length
    });
  } catch (err) {
    console.error('Get barangay removals error:', err);
    next(err);
  }
});

export default router;