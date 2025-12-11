// backend/routes/releases.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { logAuditFromRequest } from '../utils/auditLogger.js';
import { getBarangayFilter, canModifyRecord } from '../middleware/baranggayAccess.js';
// import { authenticateUser } from '../middleware/auth.js';

// // Uncomment these:
// router.use(authenticateUser);
// router.use(checkBarangayAccess);

const router = express.Router();
const prisma = new PrismaClient();

// // ============================================
// // BARANGAY HELPER FUNCTIONS
// // ============================================

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
 * GET /api/releases/stats
 * Get release statistics for user's barangay
 */
router.get("/stats", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);

    const [
      totalReleases,
      todayReleases,
      thisMonthReleases,
      totalQuantityReleased
    ] = await Promise.all([
      prisma.medicine_releases.count({
        where: {
          medicine: barangayFilter
        }
      }),
      prisma.medicine_releases.count({
        where: {
          medicine: barangayFilter,
          date_released: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.medicine_releases.count({
        where: {
          medicine: barangayFilter,
          date_released: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.medicine_releases.aggregate({
        where: {
          medicine: barangayFilter
        },
        _sum: {
          quantity_released: true
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalReleases,
        todayReleases,
        thisMonthReleases,
        totalQuantityReleased: totalQuantityReleased._sum.quantity_released || 0
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (err) {
    console.error('Error fetching release stats:', err);
    next(err);
  }
});

/**
 * GET all medicine releases with barangay filtering
 */
router.get("/", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    // Optional filters
    const { barangay, resident_id, start_date, end_date, page = 1, limit = 50 } = req.query;
    
    const where = {
      medicine: barangayFilter
    };
    
    // Admin can filter by specific barangay
    if (barangay && user && (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF')) {
      where.medicine = { barangay };
    }
    
    if (resident_id) {
      where.resident_id = parseInt(resident_id);
    }
    
    if (start_date || end_date) {
      where.date_released = {};
      if (start_date) where.date_released.gte = new Date(start_date);
      if (end_date) where.date_released.lte = new Date(end_date);
    }

    const [releases, total] = await Promise.all([
      prisma.medicine_releases.findMany({
        where,
        include: {
          medicine: {
            select: {
              medicine_id: true,
              medicine_name: true,
              generic_name: true,
              barangay: true
            }
          },
          stock: {
            select: {
              stock_id: true,
              batch_number: true,
              expiry_date: true
            }
          },
          resident: {
            select: {
              resident_id: true,
              full_name: true,
              barangay: true,
              age: true
            }
          },
          released_by_user: {
            select: {
              full_name: true,
              wallet_address: true
            }
          }
        },
        orderBy: { date_released: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.medicine_releases.count({ where })
    ]);

    res.json({
      success: true,
      data: releases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (err) {
    console.error('Error fetching releases:', err);
    next(err);
  }
});

/**
 * GET release by ID with barangay access check
 */
router.get("/:id", async (req, res, next) => {
  try {
    const user = req.user || null;
    
    const release = await prisma.medicine_releases.findUnique({
      where: { release_id: Number(req.params.id) },
      include: {
        medicine: {
          select: {
            medicine_id: true,
            medicine_name: true,
            generic_name: true,
            barangay: true,
            dosage_form: true,
            strength: true
          }
        },
        stock: {
          select: {
            stock_id: true,
            batch_number: true,
            expiry_date: true,
            remaining_quantity: true
          }
        },
        resident: true,
        released_by_user: {
          select: {
            full_name: true,
            wallet_address: true
          }
        }
      }
    });
    
    if (!release) {
      return res.status(404).json({ error: "Release not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, release.medicine.barangay)) {
      return res.status(403).json({ 
        error: 'Access denied to this barangay',
        releaseBarangay: release.medicine.barangay,
        yourBarangay: user.assigned_barangay
      });
    }
    
    res.json({ success: true, data: release });
  } catch (err) {
    console.error('Error fetching release:', err);
    next(err);
  }
});

/**
 * POST new release with barangay validation
 */
router.post("/", async (req, res, next) => {
  try {
    console.log('Received release data:', req.body);
    const walletAddress = req.headers['x-wallet-address'];
    const user = req.user || null;
    
    const { medicine_id, stock_id } = req.body;

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
        error: 'Cannot create release for medicine from different barangay',
        medicineBarangay: medicine.barangay,
        yourBarangay: user.assigned_barangay
      });
    }

    // Verify stock exists
    const stock = await prisma.medicine_stocks.findUnique({
      where: { stock_id: parseInt(stock_id) }
    });

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    // Check if enough quantity available
    if (stock.remaining_quantity < req.body.quantity_released) {
      return res.status(400).json({
        error: 'Insufficient stock quantity',
        available: stock.remaining_quantity,
        requested: req.body.quantity_released
      });
    }

    // Create release
    const release = await prisma.medicine_releases.create({ 
      data: {
        ...req.body,
        released_by_user_id: user?.user_id || null,
        released_by_wallet: walletAddress || null
      },
      include: {
        medicine: {
          select: {
            medicine_name: true,
            barangay: true
          }
        }
      }
    });

    // Update stock quantity
    await prisma.medicine_stocks.update({
      where: { stock_id: parseInt(stock_id) },
      data: {
        remaining_quantity: {
          decrement: req.body.quantity_released
        }
      }
    });
    
    // Log audit entry
    await logAuditFromRequest({
      req,
      tableName: '...',
      recordId: '...',
      action: '...',
      oldValues: '...',
      newValues: '...',
    }).catch(err => console.error('Audit log failed:', err));
    
    res.status(201).json({
      success: true,
      data: release,
      message: `Release created for ${medicine.barangay}`
    });
  } catch (err) {
    console.error('Error creating release:', err);
    res.status(500).json({ 
      error: 'Failed to create release',
      details: err.message 
    });
  }
});

/**
 * PATCH - Update release with blockchain info
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    const { blockchain_hash, blockchain_tx_hash } = req.body;
    const walletAddress = req.headers['x-wallet-address'];
    const user = req.user || null;

    // Check if release exists and get medicine barangay
    const existingRelease = await prisma.medicine_releases.findUnique({
      where: { release_id: releaseId },
      include: {
        medicine: {
          select: { barangay: true }
        }
      }
    });

    if (!existingRelease) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, existingRelease.medicine.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const release = await prisma.medicine_releases.update({
      where: { release_id: releaseId },
      data: {
        blockchain_hash,
        blockchain_tx_hash,
        last_synced_at: new Date()
      }
    });

    // Log audit entry for blockchain update
    await logAuditFromRequest({
      req,
      tableName: '...',
      recordId: '...',
      action: '...',
      oldValues: '...',
      newValues: '...',
    }).catch(err => console.error('Audit log failed:', err));

    res.json({ success: true, data: release });
  } catch (err) {
    console.error('Error updating release:', err);
    next(err);
  }
});

/**
 * PUT update release with barangay access check
 */
router.put("/:id", async (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    const walletAddress = req.headers['x-wallet-address'];
    const user = req.user || null;
    
    // Get old values before update
    const oldRelease = await prisma.medicine_releases.findUnique({
      where: { release_id: releaseId },
      include: {
        medicine: {
          select: { barangay: true }
        }
      }
    });
    
    if (!oldRelease) {
      return res.status(404).json({ error: "Release not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, oldRelease.medicine.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const release = await prisma.medicine_releases.update({
      where: { release_id: releaseId },
      data: req.body
    });
    
    // Log audit entry
    await logAuditFromRequest({
      req,
      tableName: '...',
      recordId: '...',
      action: '...',
      oldValues: '...',
      newValues: '...',
    }).catch(err => console.error('Audit log failed:', err));
    
    res.json({ success: true, data: release });
  } catch (err) {
    console.error('Error updating release:', err);
    if (err.code === "P2025") {
      res.status(404).json({ error: "Release not found" });
    } else {
      next(err);
    }
  }
});

/**
 * DELETE release with barangay access check
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const releaseId = Number(req.params.id);
    const walletAddress = req.headers['x-wallet-address'];
    const user = req.user || null;
    
    // Get old values before deletion (including blockchain info)
    const oldRelease = await prisma.medicine_releases.findUnique({
      where: { release_id: releaseId },
      include: {
        medicine: {
          select: { barangay: true }
        }
      }
    });
    
    if (!oldRelease) {
      return res.status(404).json({ error: "Release not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, oldRelease.medicine.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Restore stock quantity before deleting
    await prisma.medicine_stocks.update({
      where: { stock_id: oldRelease.stock_id },
      data: {
        remaining_quantity: {
          increment: oldRelease.quantity_released
        }
      }
    });
    
    await prisma.medicine_releases.delete({
      where: { release_id: releaseId }
    });
    
    // Log audit entry with blockchain info
    await logAuditFromRequest({
      req,
      tableName: '...',
      recordId: '...',
      action: '...',
      oldValues: '...',
      newValues: '...',
    }).catch(err => console.error('Audit log failed:', err));
    
    res.json({ 
      success: true,
      message: "Release deleted successfully and stock restored" 
    });
  } catch (err) {
    console.error('Error deleting release:', err);
    if (err.code === "P2025") {
      res.status(404).json({ error: "Release not found" });
    } else {
      next(err);
    }
  }
});

/**
 * GET /api/releases/barangay/:barangay
 * Get releases for specific barangay (admin only)
 */
router.get("/barangay/:barangay", async (req, res, next) => {
  try {
    const user = req.user || null;

    // Only admin/municipal staff can view specific barangays
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const barangay = req.params.barangay;

    const releases = await prisma.medicine_releases.findMany({
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
        resident: {
          select: {
            full_name: true,
            age: true
          }
        }
      },
      orderBy: { date_released: 'desc' }
    });

    res.json({ 
      success: true, 
      data: releases,
      barangay: barangay,
      total: releases.length
    });
  } catch (err) {
    console.error('Get barangay releases error:', err);
    next(err);
  }
});

export default router;