// backend/routes/medicines.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { getBarangayFilter, canModifyRecord } from '../middleware/baranggayAccess.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper function to generate hash (same as frontend)
const generateMedicineHash = (medicineData) => {
  const dataString = JSON.stringify({
    name: medicineData.name,
    batchNumber: medicineData.batchNumber,
    quantity: medicineData.quantity,
    expirationDate: medicineData.expirationDate,
    location: medicineData.location,
    timestamp: medicineData.timestamp || Date.now(),
  });

  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(dataString));
};

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/medicines
 * Get all medicines with optional barangay filtering
 */
router.get('/', async (req, res) => {
  try {
    // Get user from request (if auth is implemented)
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);

    // Optional filters from query params
    const { search, category, is_active, page = 1, limit = 50 } = req.query;

    const where = {
      ...barangayFilter,
      ...(search && {
        OR: [
          { medicine_name: { contains: search, mode: 'insensitive' } },
          { generic_name: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(category && { category }),
      is_active: is_active !== undefined ? is_active === 'true' : true
    };

    const [medicines, total] = await Promise.all([
      prisma.medicine_records.findMany({
        where,
        include: {
          created_by_user: {
            select: { full_name: true, wallet_address: true }
          },
          medicine_stocks: {
            where: { is_active: true },
            select: {
              stock_id: true,
              batch_number: true,
              quantity: true,
              remaining_quantity: true,
              expiry_date: true,
              storage_location: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.medicine_records.count({ where })
    ]);

    // Calculate total stock for each medicine
    const medicinesWithStats = medicines.map(med => ({
      ...med,
      total_stock: med.medicine_stocks.reduce((sum, stock) => sum + stock.remaining_quantity, 0),
      active_batches: med.medicine_stocks.length,
      expired_batches: med.medicine_stocks.filter(s => new Date(s.expiry_date) < new Date()).length
    }));

    res.json({
      success: true,
      data: medicinesWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      barangay: user?.assigned_barangay || 'ALL',
      userRole: user?.role || 'GUEST'
    });
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medicines/stats
 * Get medicine statistics for user's barangay
 */
router.get('/stats', async (req, res) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);

    const [
      totalMedicines,
      activeMedicines,
      totalStocks,
      lowStockMedicines,
      expiredStocks
    ] = await Promise.all([
      prisma.medicine_records.count({ where: barangayFilter }),
      prisma.medicine_records.count({ where: { ...barangayFilter, is_active: true } }),
      prisma.medicine_stocks.count({
        where: {
          medicine: barangayFilter,
          is_active: true
        }
      }),
      prisma.medicine_stocks.count({
        where: {
          medicine: barangayFilter,
          is_active: true,
          remaining_quantity: { lte: 10 }
        }
      }),
      prisma.medicine_stocks.count({
        where: {
          medicine: barangayFilter,
          is_active: true,
          expiry_date: { lt: new Date() }
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalMedicines,
        activeMedicines,
        totalStocks,
        lowStockMedicines,
        expiredStocks
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (error) {
    console.error('Get medicine stats error:', error);
    res.status(500).json({ error: 'Failed to fetch medicine statistics' });
  }
});

/**
 * GET /api/medicines/:id
 * Get single medicine by ID with barangay access check
 */
router.get('/:id', async (req, res) => {
  try {
    const medicineId = parseInt(req.params.id);

    // Validate that medicineId is a valid number
    if (isNaN(medicineId)) {
      return res.status(400).json({ error: 'Invalid medicine ID' });
    }

    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);

    const medicine = await prisma.medicine_records.findFirst({
      where: {
        medicine_id: medicineId,
        ...barangayFilter
      },
      include: {
        created_by_user: {
          select: { full_name: true, wallet_address: true }
        },
        medicine_stocks: {
          where: { is_active: true },
          include: {
            supplier: true,
            added_by_user: {
              select: { full_name: true }
            }
          },
          orderBy: { expiry_date: 'asc' }
        },
        medicine_releases: {
          take: 10,
          orderBy: { date_released: 'desc' },
          include: {
            resident: {
              select: { full_name: true, barangay: true }
            }
          }
        }
      }
    });

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found or access denied' });
    }

    res.json({ success: true, data: medicine });
  } catch (error) {
    console.error('Error fetching medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/medicines
 * Create new medicine and stock with barangay assignment
 */
router.post('/', async (req, res) => {
  try {
    const {
      medicine_name,
      medicine_type,
      description,
      generic_name,
      dosage_form,
      strength,
      manufacturer,
      category,
      storage_requirements,
      batch_number,
      quantity,
      unit_cost,
      supplier_name,
      date_received,
      expiry_date,
      storage_location,
      wallet_address,
      barangay // NEW: Barangay assignment
    } = req.body;

    // Validate required fields
    if (!medicine_name || !batch_number || !quantity || !expiry_date) {
      return res.status(400).json({ 
        error: 'Missing required fields: medicine_name, batch_number, quantity, expiry_date' 
      });
    }

    // Validate quantity is a valid number
    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    // Validate expiry date
    const expiryDateObj = new Date(expiry_date);
    if (isNaN(expiryDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid expiry date' });
    }

    // Determine barangay assignment
    const user = req.user || null;
    let assignedBarangay = barangay;

    // If user is not admin, force their assigned barangay
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      assignedBarangay = user.assigned_barangay;
    }

    // Default to MUNICIPAL if no barangay specified
    if (!assignedBarangay) {
      assignedBarangay = 'MUNICIPAL';
    }

    // Check if batch number already exists for this medicine
    const existingMedicine = await prisma.medicine_records.findFirst({
      where: {
        medicine_name,
        medicine_stocks: {
          some: {
            batch_number,
            is_active: true
          }
        }
      }
    });

    if (existingMedicine) {
      return res.status(400).json({ 
        error: 'Batch number already exists for this medicine' 
      });
    }

    // Create medicine record
    const medicine = await prisma.medicine_records.create({
      data: {
        medicine_name,
        medicine_type: medicine_type || 'General',
        description,
        generic_name,
        dosage_form,
        strength,
        manufacturer,
        category,
        storage_requirements,
        barangay: assignedBarangay, // NEW: Assign barangay
        created_by: user?.user_id || null,
        is_active: true,
        created_at: new Date()
      }
    });

    // Create stock record
    const stock = await prisma.medicine_stocks.create({
      data: {
        medicine_id: medicine.medicine_id,
        batch_number,
        quantity: parsedQuantity,
        remaining_quantity: parsedQuantity,
        unit_cost: parseFloat(unit_cost) || 0,
        total_cost: (parseFloat(unit_cost) || 0) * parsedQuantity,
        supplier_name,
        date_received: new Date(date_received || Date.now()),
        expiry_date: expiryDateObj,
        storage_location: storage_location || 'Main Storage',
        is_active: true,
        added_by_wallet: wallet_address,
        added_by_user_id: user?.user_id || null,
        created_at: new Date()
      }
    });

    res.status(201).json({
      success: true,
      medicine,
      stock,
      message: `Medicine created for ${assignedBarangay}`
    });

  } catch (error) {
    console.error('Error creating medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/medicines/:id
 * Update medicine with blockchain info
 */
router.patch('/:id', async (req, res) => {
  try {
    const medicineId = parseInt(req.params.id);

    // Validate that medicineId is a valid number
    if (isNaN(medicineId)) {
      return res.status(400).json({ error: 'Invalid medicine ID' });
    }

    const {
      blockchain_hash,
      blockchain_tx_hash,
      transaction_hash
    } = req.body;

    // Check if medicine exists
    const existingMedicine = await prisma.medicine_records.findUnique({
      where: { medicine_id: medicineId }
    });

    if (!existingMedicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // Check barangay access
    const user = req.user || null;
    if (user && !canModifyRecord(user, existingMedicine.barangay)) {
      return res.status(403).json({ error: 'Access denied to this barangay' });
    }

    const medicine = await prisma.medicine_records.update({
      where: { medicine_id: medicineId },
      data: {
        blockchain_hash,
        blockchain_tx_hash,
        transaction_hash,
        last_synced_at: new Date(),
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      medicine
    });

  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/medicines/:id
 * Update full medicine data with barangay access check
 */
router.put('/:id', async (req, res) => {
  try {
    const medicineId = parseInt(req.params.id);

    if (isNaN(medicineId)) {
      return res.status(400).json({ error: 'Invalid medicine ID' });
    }

    const {
      medicine_name,
      medicine_type,
      description,
      generic_name,
      dosage_form,
      strength,
      manufacturer,
      category,
      storage_requirements,
      barangay
    } = req.body;

    // Check if medicine exists and get old values
    const existingMedicine = await prisma.medicine_records.findUnique({
      where: { medicine_id: medicineId }
    });

    if (!existingMedicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // Check barangay access
    const user = req.user || null;
    if (user && !canModifyRecord(user, existingMedicine.barangay)) {
      return res.status(403).json({ 
        error: 'You do not have permission to modify this medicine',
        medicineBarangay: existingMedicine.barangay,
        yourBarangay: user.assigned_barangay
      });
    }

    const updateData = {
      medicine_name,
      medicine_type,
      description,
      generic_name,
      dosage_form,
      strength,
      manufacturer,
      category,
      storage_requirements,
      updated_at: new Date()
    };

    // Only admin can change barangay assignment
    if (user && (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') && barangay) {
      updateData.barangay = barangay;
    }

    const medicine = await prisma.medicine_records.update({
      where: { medicine_id: medicineId },
      data: updateData,
      include: {
        created_by_user: {
          select: { full_name: true }
        }
      }
    });

    // ===== ADD AUDIT LOG =====
    await prisma.audit_log.create({
      data: {
        table_name: 'medicine',
        action: 'UPDATE',
        record_id: medicineId,
        old_values: existingMedicine, // Store old values
        new_values: medicine, // Store new values
        changed_by_wallet: req.body.wallet_address || req.headers['x-wallet-address'] || null,
        changed_by: user?.user_id || null,
        changed_at: new Date(),
        medicine_id: medicineId
      }
    });
    // ===== END AUDIT LOG =====

    res.json({
      success: true,
      medicine
    });

  } catch (error) {
    console.error('Error updating medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/medicines/:id
 * Soft delete medicine with barangay access check
 */
router.delete('/:id', async (req, res) => {
  try {
    const medicineId = parseInt(req.params.id);

    if (isNaN(medicineId)) {
      return res.status(400).json({ error: 'Invalid medicine ID' });
    }

    // Check if medicine exists and get its data before deleting
    const existingMedicine = await prisma.medicine_records.findUnique({
      where: { medicine_id: medicineId },
      include: {
        medicine_stocks: true,
        created_by_user: {
          select: { full_name: true }
        }
      }
    });

    if (!existingMedicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    // Check barangay access
    const user = req.user || null;
    if (user && !canModifyRecord(user, existingMedicine.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Soft delete medicine
    await prisma.medicine_records.update({
      where: { medicine_id: medicineId },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });

    // Also soft delete associated stocks
    await prisma.medicine_stocks.updateMany({
      where: { medicine_id: medicineId },
      data: {
        is_active: false
      }
    });

    // ===== ADD AUDIT LOG =====
    await prisma.audit_log.create({
      data: {
        table_name: 'medicine',
        action: 'DELETE',
        record_id: medicineId,
        old_values: existingMedicine, // Store the deleted record
        new_values: null, // No new values for delete
        changed_by_wallet: req.headers['x-wallet-address'] || null,
        changed_by: user?.user_id || null,
        changed_at: new Date(),
        medicine_id: medicineId
      }
    });
    // ===== END AUDIT LOG =====

    res.json({
      success: true,
      message: 'Medicine deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/medicines/:id/verify
 * Verify medicine integrity
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const medicineId = parseInt(req.params.id);

    // Validate that medicineId is a valid number
    if (isNaN(medicineId)) {
      return res.status(400).json({ error: 'Invalid medicine ID' });
    }

    const medicine = await prisma.medicine_records.findUnique({
      where: { medicine_id: medicineId },
      include: {
        medicine_stocks: {
          where: { is_active: true }
        }
      }
    });

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    if (!medicine.blockchain_hash) {
      return res.status(400).json({ 
        error: 'No blockchain hash found for this medicine' 
      });
    }

    const stock = medicine.medicine_stocks[0];
    if (!stock) {
      return res.status(400).json({ error: 'No stock data found' });
    }

    // Reconstruct hash from current data
    const reconstructedData = {
      name: medicine.medicine_name,
      batchNumber: stock.batch_number,
      quantity: stock.quantity,
      expirationDate: Math.floor(new Date(stock.expiry_date).getTime() / 1000),
      location: stock.storage_location,
      timestamp: Math.floor(new Date(medicine.created_at).getTime()),
    };

    const reconstructedHash = generateMedicineHash(reconstructedData);

    const verified = reconstructedHash === medicine.blockchain_hash;

    res.json({
      verified,
      storedHash: medicine.blockchain_hash,
      reconstructedHash,
      data: reconstructedData,
      barangay: medicine.barangay, // NEW: Include barangay in response
      message: verified 
        ? 'Data integrity verified - medicine data has not been tampered with' 
        : 'Data integrity check failed - medicine data may have been modified'
    });

  } catch (error) {
    console.error('Error verifying medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/medicines/barangay/:barangay
 * Get medicines for specific barangay (admin/municipal staff only)
 */
router.get('/barangay/:barangay', async (req, res) => {
  try {
    const user = req.user || null;

    // Only admin/municipal staff can view specific barangays
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const barangay = req.params.barangay;

    const medicines = await prisma.medicine_records.findMany({
      where: { 
        barangay: barangay,
        is_active: true
      },
      include: {
        medicine_stocks: {
          where: { is_active: true },
          select: {
            stock_id: true,
            remaining_quantity: true,
            expiry_date: true
          }
        }
      },
      orderBy: { medicine_name: 'asc' }
    });

    const centerInfo = await prisma.barangay_health_centers.findUnique({
      where: { barangay: barangay }
    });

    res.json({ 
      success: true, 
      data: medicines,
      barangay: barangay,
      centerInfo
    });
  } catch (error) {
    console.error('Get barangay medicines error:', error);
    res.status(500).json({ error: 'Failed to fetch barangay medicines' });
  }
});

/**
 * GET /api/medicines/compare/barangays
 * Compare medicine inventory across barangays (admin only)
 */
router.get('/compare/barangays', async (req, res) => {
  try {
    const user = req.user || null;

    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comparison = await prisma.$queryRaw`
      SELECT 
        m.barangay,
        bhc.center_name,
        COUNT(DISTINCT m.medicine_id)::int as total_medicines,
        COUNT(DISTINCT s.stock_id)::int as total_batches,
        COALESCE(SUM(s.remaining_quantity), 0)::int as total_quantity,
        COUNT(DISTINCT CASE WHEN s.expiry_date < CURRENT_DATE THEN s.stock_id END)::int as expired_batches
      FROM medicines m
      LEFT JOIN barangay_health_centers bhc ON bhc.barangay = m.barangay::text
      LEFT JOIN stocks s ON s.medicine_id = m.medicine_id AND s.is_active = true
      WHERE m.is_active = true
      GROUP BY m.barangay, bhc.center_name
      ORDER BY bhc.center_name
    `;

    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error('Compare barangays error:', error);
    res.status(500).json({ error: 'Failed to compare barangays' });
  }
});

export default router;