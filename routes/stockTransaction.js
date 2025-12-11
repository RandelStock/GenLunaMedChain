// backend/routes/stockTransaction.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getBarangayFilter, canModifyRecord } from '../middleware/baranggayAccess.js';
import { logAuditFromRequest } from '../utils/auditLogger.js';
import NodeCache from 'node-cache';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize cache
const hashCache = new NodeCache({ stdTTL: 300 });

/**
 * ----------------------------------------------------------------
 * GET /stock-transactions/stats/summary
 * Get transaction statistics
 * ⚠️ IMPORTANT: This must be BEFORE the /:id route
 * ----------------------------------------------------------------
 */
router.get('/stats/summary', async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const { start_date, end_date } = req.query;
    
    const where = {
      stock: {
        medicine: barangayFilter
      }
    };

    if (start_date || end_date) {
      where.transaction_date = {};
      if (start_date) where.transaction_date.gte = new Date(start_date);
      if (end_date) where.transaction_date.lte = new Date(end_date);
    }

    const [additionStats, removalStats, onChainCount] = await Promise.all([
      prisma.stock_transactions.aggregate({
        where: {
          ...where,
          transaction_type: 'ADDITION'
        },
        _sum: {
          quantity_changed: true
        },
        _count: true
      }),
      prisma.stock_transactions.aggregate({
        where: {
          ...where,
          transaction_type: 'REMOVAL'
        },
        _sum: {
          quantity_changed: true
        },
        _count: true
      }),
      prisma.stock_transactions.count({
        where: {
          ...where,
          blockchain_tx_hash: {
            not: null
          }
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        additions: {
          count: additionStats._count,
          totalQuantity: additionStats._sum.quantity_changed || 0
        },
        removals: {
          count: removalStats._count,
          totalQuantity: removalStats._sum.quantity_changed || 0
        },
        onChainCount,
        totalTransactions: additionStats._count + removalStats._count
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * GET /stock-transactions/stock/:stock_id
 * Get all transactions for a specific stock
 * ⚠️ IMPORTANT: This must be BEFORE the /:id route
 * ----------------------------------------------------------------
 */
router.get('/stock/:stock_id', async (req, res, next) => {
  try {
    const stockId = parseInt(req.params.stock_id);
    const user = req.user || null;

    if (!stockId || isNaN(stockId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stock ID'
      });
    }

    const barangayFilter = getBarangayFilter(user);

    const transactions = await prisma.stock_transactions.findMany({
      where: {
        stock_id: stockId,
        stock: {
          medicine: barangayFilter
        }
      },
      include: {
        stock: {
          include: {
            medicine: true
          }
        }
      },
      orderBy: { transaction_date: 'desc' }
    });

    res.json({
      success: true,
      data: transactions,
      total: transactions.length
    });
  } catch (error) {
    console.error('Error fetching stock transactions:', error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * GET /stock-transactions
 * Get all stock transactions with barangay filtering
 * ----------------------------------------------------------------
 */
router.get('/', async (req, res, next) => {
  try {
    console.log('📥 Fetching stock transactions...');
    
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const { transaction_type, start_date, end_date, stock_id, page = 1, limit = 100 } = req.query;
    
    const where = {
      stock: {
        medicine: barangayFilter
      }
    };

    // Apply filters
    if (transaction_type) {
      where.transaction_type = transaction_type;
    }
    
    if (stock_id) {
      where.stock_id = parseInt(stock_id);
    }
    
    if (start_date || end_date) {
      where.transaction_date = {};
      if (start_date) where.transaction_date.gte = new Date(start_date);
      if (end_date) where.transaction_date.lte = new Date(end_date);
    }

    const [transactions, total] = await Promise.all([
      prisma.stock_transactions.findMany({
        where,
        include: {
          stock: {
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
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.stock_transactions.count({ where })
    ]);

    console.log(`✅ Found ${transactions.length} transactions (total: ${total})`);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (error) {
    console.error('❌ Error fetching stock transactions:', error);
    next(error);
  }
});

/**
 * ----------------------------------------------------------------
 * GET /stock-transactions/:id
 * Get single transaction by ID
 * ----------------------------------------------------------------
 */
router.get('/:id', async (req, res, next) => {
  try {
    const transactionId = parseInt(req.params.id);
    const user = req.user || null;
    
    if (!transactionId || isNaN(transactionId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid transaction ID' 
      });
    }

    const transaction = await prisma.stock_transactions.findUnique({
      where: { transaction_id: transactionId },
      include: {
        stock: {
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
            }
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, transaction.stock.medicine.barangay)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied' 
      });
    }

    res.json({ 
      success: true,
      data: transaction 
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch transaction',
      details: error.message 
    });
  }
});

/**
 * ----------------------------------------------------------------
 * POST /stock-transactions
 * Create new stock transaction
 * ----------------------------------------------------------------
 */
router.post('/', async (req, res, next) => {
  try {
    console.log('📝 Creating stock transaction with data:', req.body);
    
    const {
      stock_id,
      transaction_type,
      quantity_changed,
      quantity_before,
      quantity_after,
      transaction_date,
      performed_by_wallet,
      blockchain_tx_hash,
      notes
    } = req.body;

    const user = req.user || null;

    // Validate required fields
    if (!stock_id || !transaction_type || !quantity_changed || 
        quantity_before === undefined || quantity_after === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['stock_id', 'transaction_type', 'quantity_changed', 'quantity_before', 'quantity_after']
      });
    }

    // Validate transaction type
    if (!['ADDITION', 'REMOVAL'].includes(transaction_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction_type. Must be ADDITION or REMOVAL'
      });
    }

    // Validate wallet address if provided
    if (performed_by_wallet && !/^0x[a-fA-F0-9]{40}$/.test(performed_by_wallet)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    // Get stock to verify it exists and check barangay access
    const stock = await prisma.medicine_stocks.findUnique({
      where: { stock_id: parseInt(stock_id) },
      include: {
        medicine: {
          select: {
            barangay: true,
            medicine_name: true
          }
        }
      }
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found'
      });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, stock.medicine.barangay)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot create transaction for stock from different barangay',
        stockBarangay: stock.medicine.barangay,
        yourBarangay: user.assigned_barangay
      });
    }

    // Create the transaction
    const transaction = await prisma.stock_transactions.create({
      data: {
        stock_id: parseInt(stock_id),
        transaction_type,
        quantity_changed: parseInt(quantity_changed),
        quantity_before: parseInt(quantity_before),
        quantity_after: parseInt(quantity_after),
        transaction_date: transaction_date ? new Date(transaction_date) : new Date(),
        performed_by_wallet: performed_by_wallet?.toLowerCase() || null,
        blockchain_tx_hash: blockchain_tx_hash || null,
        notes: notes || null
      },
      include: {
        stock: {
          include: {
            medicine: true
          }
        }
      }
    });

    console.log('✅ Transaction created:', transaction.transaction_id);

    // Log audit entry
    await logAuditFromRequest({
              req,
              tableName: '...',
              recordId: '...',
              action: '...',
              oldValues: '...',
              newValues: '...',
    }).catch(err => console.error('Audit log failed:', err));

    // Invalidate cache if blockchain info is already present
    if (blockchain_tx_hash) {
      hashCache.del('blockchain_hashes');
      console.log('🔄 Cache invalidated due to blockchain transaction');
    }

    res.status(201).json({ 
      success: true,
      data: transaction,
      message: `${transaction_type} transaction created successfully`
    });
  } catch (error) {
    console.error('❌ Error creating stock transaction:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create transaction',
      details: error.message 
    });
  }
});

/**
 * ----------------------------------------------------------------
 * PATCH /stock-transactions/:id/blockchain
 * Update blockchain info after MetaMask confirms
 * ----------------------------------------------------------------
 */
router.patch('/:id/blockchain', async (req, res, next) => {
  try {
    const transactionId = parseInt(req.params.id);
    const { blockchain_tx_hash } = req.body;
    const user = req.user || null;

    console.log(`📝 Updating blockchain info for transaction ${transactionId}`);

    if (!blockchain_tx_hash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: blockchain_tx_hash'
      });
    }

    // Get the transaction to check barangay access
    const existingTransaction = await prisma.stock_transactions.findUnique({
      where: { transaction_id: transactionId },
      include: {
        stock: {
          include: {
            medicine: {
              select: { barangay: true }
            }
          }
        }
      }
    });

    if (!existingTransaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, existingTransaction.stock.medicine.barangay)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update with blockchain info
    const updated = await prisma.stock_transactions.update({
      where: { transaction_id: transactionId },
      data: {
        blockchain_tx_hash
      },
      include: {
        stock: {
          include: {
            medicine: true
          }
        }
      }
    });

    console.log('✅ Blockchain info updated for transaction:', transactionId);

    // Log audit entry
    await logAuditFromRequest({
              req,
              tableName: '...',
              recordId: '...',
              action: '...',
              oldValues: '...',
              newValues: '...',
    }).catch(err => console.error('Audit log failed:', err));

    // Invalidate cache so blockchain history refreshes
    hashCache.del('blockchain_hashes');
    console.log('🔄 Cache invalidated - blockchain history will refresh');

    res.json({ 
      success: true, 
      data: updated,
      message: 'Blockchain info updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating blockchain info:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update blockchain info',
      details: error.message 
    });
  }
});

/**
 * ----------------------------------------------------------------
 * DELETE /stock-transactions/:id
 * Delete a transaction (admin only, use with caution)
 * ----------------------------------------------------------------
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const transactionId = parseInt(req.params.id);
    const user = req.user || null;

    // Only admin can delete transactions
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete transactions'
      });
    }

    const transaction = await prisma.stock_transactions.findUnique({
      where: { transaction_id: transactionId },
      include: {
        stock: {
          include: {
            medicine: {
              select: { barangay: true }
            }
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, transaction.stock.medicine.barangay)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await prisma.stock_transactions.delete({
      where: { transaction_id: transactionId }
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

    // Invalidate cache
    hashCache.del('blockchain_hashes');

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      deleted_transaction_id: transactionId
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    next(error);
  }
});

export default router;