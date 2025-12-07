// backend/routes/stocks.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit, getIpAddress, getUserAgent } from '../utils/auditLogger.js';
import { getBarangayFilter } from '../middleware/baranggayAccess.js';

const router = express.Router();
const prisma = new PrismaClient();

/* ===========================================================
   📦 GET all stocks (with optional filters)
   =========================================================== */
router.get('/', async (req, res) => {
  try {
    const { medicine_id, is_active } = req.query;
    const barangayFilter = getBarangayFilter(req.user || null);
    const where = { medicine: barangayFilter };

    if (medicine_id) where.medicine_id = parseInt(medicine_id);
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    } else {
      where.is_active = true;
    }

    const stocks = await prisma.medicine_stocks.findMany({
      where,
      include: { medicine: true },
      orderBy: { created_at: 'desc' }
    });

    res.json({ success: true, data: stocks });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   📦 GET single stock by ID
   =========================================================== */
router.get('/:id', async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);

    const stock = await prisma.medicine_stocks.findUnique({
      where: { stock_id: stockId },
      include: { medicine: true }
    });

    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    res.json(stock);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   📦 GET stocks by medicine ID
   =========================================================== */
router.get('/medicine/:medicineId', async (req, res) => {
  try {
    const medicineId = parseInt(req.params.medicineId);

    const barangayFilter = getBarangayFilter(req.user || null);

    const stocks = await prisma.medicine_stocks.findMany({
      where: { medicine_id: medicineId, is_active: true, medicine: barangayFilter },
      orderBy: { expiry_date: 'asc' }
    });

    res.json(stocks);
  } catch (error) {
    console.error('Error fetching stocks by medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   ➕ POST - Create new stock
   =========================================================== */
router.post('/', async (req, res) => {
  try {
    const {
      medicine_id,
      batch_number,
      quantity,
      unit_cost,
      supplier_name,
      date_received,
      expiry_date,
      storage_location,
      added_by_wallet
    } = req.body;

    if (!medicine_id || !batch_number || !quantity || !expiry_date) {
      return res.status(400).json({
        error: 'Missing required fields: medicine_id, batch_number, quantity, expiry_date'
      });
    }

    const medicine = await prisma.medicine_records.findUnique({
      where: { medicine_id: parseInt(medicine_id) }
    });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

    const existingStock = await prisma.medicine_stocks.findFirst({
      where: { medicine_id: parseInt(medicine_id), batch_number, is_active: true }
    });
    if (existingStock)
      return res.status(400).json({ error: 'Batch number already exists for this medicine' });

    const stock_id = Date.now();

    const stock = await prisma.medicine_stocks.create({
      data: {
        stock_id,
        medicine_id: parseInt(medicine_id),
        batch_number,
        quantity: parseInt(quantity),
        remaining_quantity: parseInt(quantity),
        unit_cost: parseFloat(unit_cost) || 0,
        total_cost: (parseFloat(unit_cost) || 0) * parseInt(quantity),
        supplier_name,
        date_received: new Date(date_received || Date.now()),
        expiry_date: new Date(expiry_date),
        storage_location: storage_location || 'Main Storage',
        is_active: true,
        added_by_wallet,
        blockchain_status: 'PENDING',
        created_at: new Date()
      }
    });

    // 🔁 Recalculate total quantity for this medicine
    const total = await prisma.medicine_stocks.aggregate({
      where: { medicine_id: parseInt(medicine_id), is_active: true },
      _sum: { remaining_quantity: true }
    });

    await prisma.medicine_records.update({
      where: { medicine_id: parseInt(medicine_id) },
      data: { total_quantity: total._sum.remaining_quantity || 0 }
    });

    await logAudit({
      tableName: 'medicine_stocks',
      recordId: stock.stock_id,
      action: 'CREATE',
      newValues: stock,
      walletAddress: added_by_wallet || req.headers['x-wallet-address'],
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    res.status(201).json({ success: true, stock });
  } catch (error) {
    console.error('Error creating stock:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   ✏️ PUT - Update stock (full update)
   =========================================================== */
router.put('/:id', async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);
    const {
      batch_number,
      quantity,
      remaining_quantity,
      unit_cost,
      supplier_name,
      expiry_date,
      storage_location
    } = req.body;

    const oldStock = await prisma.medicine_stocks.findUnique({ where: { stock_id: stockId } });
    if (!oldStock) return res.status(404).json({ error: 'Stock not found' });

    const stock = await prisma.medicine_stocks.update({
      where: { stock_id: stockId },
      data: {
        batch_number,
        quantity: parseInt(quantity),
        remaining_quantity: parseInt(remaining_quantity),
        unit_cost: parseFloat(unit_cost),
        total_cost: parseFloat(unit_cost) * parseInt(quantity),
        supplier_name,
        expiry_date: new Date(expiry_date),
        storage_location
      }
    });

    // 🔁 Recalculate total quantity
    const total = await prisma.medicine_stocks.aggregate({
      where: { medicine_id: oldStock.medicine_id, is_active: true },
      _sum: { remaining_quantity: true }
    });

    await prisma.medicine_records.update({
      where: { medicine_id: oldStock.medicine_id },
      data: { total_quantity: total._sum.remaining_quantity || 0 }
    });

    await logAudit({
      tableName: 'medicine_stocks',
      recordId: stockId,
      action: 'UPDATE',
      oldValues: oldStock,
      newValues: stock,
      walletAddress: req.body.wallet_address || req.headers['x-wallet-address'],
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    res.json({ success: true, stock });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   ✏️ PATCH - Partially update stock (quantity/remaining only)
   =========================================================== */
router.patch('/:id', async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);
    const { quantity, remaining_quantity } = req.body;

    const oldStock = await prisma.medicine_stocks.findUnique({
      where: { stock_id: stockId }
    });
    if (!oldStock) return res.status(404).json({ error: 'Stock not found' });

    const updatedStock = await prisma.medicine_stocks.update({
      where: { stock_id: stockId },
      data: {
        quantity: quantity !== undefined ? parseInt(quantity) : oldStock.quantity,
        remaining_quantity: remaining_quantity !== undefined ? parseInt(remaining_quantity) : oldStock.remaining_quantity
      }
    });

    // 🔁 Recalculate total quantity for the linked medicine
    const total = await prisma.medicine_stocks.aggregate({
      where: { medicine_id: oldStock.medicine_id, is_active: true },
      _sum: { remaining_quantity: true }
    });

    await prisma.medicine_records.update({
      where: { medicine_id: oldStock.medicine_id },
      data: { total_quantity: total._sum.remaining_quantity || 0 }
    });

    await logAudit({
      tableName: 'medicine_stocks',
      recordId: stockId,
      action: 'PATCH',
      oldValues: oldStock,
      newValues: updatedStock,
      walletAddress: req.body.wallet_address || req.headers['x-wallet-address'],
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    res.json({ success: true, stock: updatedStock });
  } catch (error) {
    console.error('Error patching stock:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   🗑️ DELETE (soft delete)
   =========================================================== */
router.delete('/:id', async (req, res) => {
  try {
    const stockId = parseInt(req.params.id);
    const stock = await prisma.medicine_stocks.findUnique({ where: { stock_id: stockId } });

    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    await prisma.medicine_stocks.update({
      where: { stock_id: stockId },
      data: { is_active: false }
    });

    // 🔁 Recalculate total quantity
    const total = await prisma.medicine_stocks.aggregate({
      where: { medicine_id: stock.medicine_id, is_active: true },
      _sum: { remaining_quantity: true }
    });

    await prisma.medicine_records.update({
      where: { medicine_id: stock.medicine_id },
      data: { total_quantity: total._sum.remaining_quantity || 0 }
    });

    await logAudit({
      tableName: 'medicine_stocks',
      recordId: stockId,
      action: 'DELETE',
      oldValues: stock,
      walletAddress: req.headers['x-wallet-address'],
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });

    res.json({ success: true, message: 'Stock deleted (soft delete)' });
  } catch (error) {
    console.error('Error deleting stock:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   ⚠️ GET expired stocks
   =========================================================== */
router.get('/status/expired', async (req, res) => {
  try {
    const expiredStocks = await prisma.medicine_stocks.findMany({
      where: {
        is_active: true,
        expiry_date: { lt: new Date() }
      },
      include: { medicine: true },
      orderBy: { expiry_date: 'desc' }
    });

    res.json(expiredStocks);
  } catch (error) {
    console.error('Error fetching expired stocks:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ===========================================================
   ⚠️ GET low stock items
   =========================================================== */
router.get('/status/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const lowStocks = await prisma.medicine_stocks.findMany({
      where: {
        is_active: true,
        remaining_quantity: { lte: threshold }
      },
      include: { medicine: true },
      orderBy: { remaining_quantity: 'asc' }
    });

    res.json(lowStocks);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
