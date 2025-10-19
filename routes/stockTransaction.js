// backend/routes/stockTransaction.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getBarangayFilter } from '../middleware/baranggayAccess.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET all transactions
router.get('/', async (req, res, next) => {
  try {
    const barangayFilter = getBarangayFilter(req.user || null);
    const transactions = await prisma.stock_transactions.findMany({
      where: {
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
      orderBy: { created_at: 'desc' }
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching stock transactions:', error);
    next(error);
  }
});

// POST - Create new transaction (THIS WAS MISSING!)
router.post('/', async (req, res, next) => {
  try {
    console.log('Creating transaction with data:', req.body);
    
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

    const transaction = await prisma.stock_transactions.create({
      data: {
        stock_id: parseInt(stock_id),
        transaction_type,
        quantity_changed: parseInt(quantity_changed),
        quantity_before: parseInt(quantity_before),
        quantity_after: parseInt(quantity_after),
        transaction_date: transaction_date ? new Date(transaction_date) : new Date(),
        performed_by_wallet: performed_by_wallet?.toLowerCase(),
        blockchain_tx_hash,
        notes
      }
    });

    console.log('Transaction created:', transaction);
    res.status(201).json({ data: transaction });
  } catch (error) {
    console.error('Error creating stock transaction:', error);
    res.status(500).json({ 
      error: 'Failed to create transaction',
      details: error.message 
    });
  }
});

export default router;