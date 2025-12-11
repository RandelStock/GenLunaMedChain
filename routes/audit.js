// backend/routes/audit.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { getBarangayFilter } from "../middleware/baranggayAccess.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get("/test", (req, res) => {
  console.log("✅ Test route hit!");
  res.json({ message: "Audit route is working!" });
});

// Helper to extract barangay from audit row
const extractBarangay = (log) => {
  const parseObj = (obj) => {
    if (!obj) return null;
    try { return typeof obj === 'string' ? JSON.parse(obj) : obj; } catch { return null; }
  };
  const newVals = parseObj(log.new_values);
  const oldVals = parseObj(log.old_values);
  const src = newVals || oldVals || {};
  const tbl = log.table_name;
  
  if (tbl === 'medicines' || tbl === 'medicine' || tbl === 'medicine_records' || tbl === 'stock_transactions') {
    const brgy = src.barangay;
    if (!brgy || brgy.toUpperCase() === 'RHU' || brgy.toUpperCase() === 'MUNICIPAL') {
      return 'RHU';
    }
    return brgy;
  }
  if (tbl === 'receipts' || tbl === 'medicine_releases') {
    const brgy = (src.medicine && src.medicine.barangay) || src.barangay;
    if (!brgy || brgy.toUpperCase() === 'RHU' || brgy.toUpperCase() === 'MUNICIPAL') {
      return 'RHU';
    }
    return brgy;
  }
  if (tbl === 'stock_removals' || tbl === 'removal' || tbl === 'stocks' || tbl === 'medicine_stocks') {
    const brgy = (src.medicine && src.medicine.barangay) || src.barangay;
    if (!brgy || brgy.toUpperCase() === 'RHU' || brgy.toUpperCase() === 'MUNICIPAL') {
      return 'RHU';
    }
    return brgy;
  }
  if (tbl === 'residents') {
    const brgy = src.barangay;
    if (!brgy || brgy.toUpperCase() === 'RHU' || brgy.toUpperCase() === 'MUNICIPAL') {
      return 'RHU';
    }
    return brgy;
  }
  
  return 'RHU'; // Default to RHU for no specific barangay context
};

// Helper function to enrich logs with user info
const enrichLogsWithUserInfo = async (logs) => {
  // Get unique wallet addresses that don't have user info
  const walletAddresses = [...new Set(
    logs
      .filter(log => log.changed_by_wallet && !log.changed_by_user)
      .map(log => log.changed_by_wallet.toLowerCase())
  )];

  // Batch fetch user info for all wallet addresses
  const usersMap = new Map();
  if (walletAddresses.length > 0) {
    const users = await prisma.users.findMany({
      where: {
        wallet_address: {
          in: walletAddresses,
          mode: 'insensitive'
        }
      },
      select: {
        user_id: true,
        full_name: true,
        wallet_address: true,
        role: true,
        assigned_barangay: true
      }
    });

    users.forEach(user => {
      usersMap.set(user.wallet_address.toLowerCase(), user);
    });
  }

  // Enrich logs with user info and derived barangay
  return logs.map((log) => {
    let userInfo = log.changed_by_user;
    
    // If no user relation but we have wallet, look it up from our map
    if (!userInfo && log.changed_by_wallet) {
      userInfo = usersMap.get(log.changed_by_wallet.toLowerCase()) || null;
    }

    const derivedBarangay = extractBarangay(log);
    
    // If still no barangay context, use user's assigned barangay
    const finalBarangay = derivedBarangay === 'RHU' && userInfo?.assigned_barangay 
      ? userInfo.assigned_barangay 
      : derivedBarangay;

    return {
      ...log,
      changed_by_user: userInfo,
      derivedBarangay: finalBarangay
    };
  });
};

// GET all audit logs with pagination and user info (with barangay scoping)
router.get("/", async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      table, 
      action, 
      dateFrom, 
      dateTo,
      scope, // 'all' | 'RHU' | 'barangay'
      barangay,
      month // YYYY-MM
    } = req.query;

    const user = req.user || null;
    const where = {};

    // Apply filters
    if (table && table !== 'all') {
      where.table_name = table;
    }

    if (action && action !== 'all') {
      where.action = action;
    }

    // Month shortcut
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map((v) => parseInt(v, 10));
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
      where.changed_at = { gte: start, lte: end };
    } else if (dateFrom || dateTo) {
      where.changed_at = {};
      if (dateFrom) {
        where.changed_at.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.changed_at.lte = new Date(dateTo + 'T23:59:59');
      }
    }

    // Fetch logs
    const rawLogs = await prisma.audit_log.findMany({
      where,
      include: {
        changed_by_user: {
          select: {
            user_id: true,
            full_name: true,
            wallet_address: true,
            role: true,
            assigned_barangay: true
          }
        }
      },
      orderBy: { changed_at: 'desc' }
    });

    // Enrich logs with user info
    const enrichedLogs = await enrichLogsWithUserInfo(rawLogs);

    // Apply scope filters from query
    let scopedLogs = enrichedLogs;
    if (scope && scope !== 'all') {
      if (scope === 'RHU') {
        scopedLogs = scopedLogs.filter((l) => l.derivedBarangay === 'RHU');
      } else if (scope === 'barangay') {
        scopedLogs = scopedLogs.filter((l) => barangay ? l.derivedBarangay === barangay : l.derivedBarangay !== 'RHU');
      }
    }

    // Enforce user barangay scoping when not admin/municipal
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF' && user.assigned_barangay) {
      scopedLogs = scopedLogs.filter((log) => {
        const b = log.derivedBarangay;
        return b === user.assigned_barangay || b === 'RHU';
      });
    }

    // Paginate after filtering
    const pageNum = parseInt(page);
    const lim = parseInt(limit);
    const start = (pageNum - 1) * lim;
    const pagedLogs = scopedLogs.slice(start, start + lim);

    res.json({
      logs: pagedLogs,
      total: scopedLogs.length,
      page: pageNum,
      totalPages: Math.ceil(scopedLogs.length / lim)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    next(error);
  }
});

// GET audit logs for specific record
router.get("/record/:table/:id", async (req, res, next) => {
  try {
    const { table, id } = req.params;

    const logs = await prisma.audit_log.findMany({
      where: {
        table_name: table,
        record_id: parseInt(id)
      },
      include: {
        changed_by_user: {
          select: {
            user_id: true,
            full_name: true,
            wallet_address: true,
            role: true,
            assigned_barangay: true
          }
        }
      },
      orderBy: { changed_at: 'desc' }
    });

    // Enrich logs with user info
    const enrichedLogs = await enrichLogsWithUserInfo(logs);

    res.json(enrichedLogs);
  } catch (error) {
    console.error('Error fetching record audit logs:', error);
    next(error);
  }
});

// GET all audit logs without data isolation (for admin/staff only)
router.get("/all", async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      table, 
      action, 
      dateFrom, 
      dateTo,
      month
    } = req.query;

    const where = {};

    if (table && table !== 'all') {
      where.table_name = table;
    }

    if (action && action !== 'all') {
      where.action = action;
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map((v) => parseInt(v, 10));
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
      where.changed_at = { gte: start, lte: end };
    } else if (dateFrom || dateTo) {
      where.changed_at = {};
      if (dateFrom) {
        where.changed_at.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.changed_at.lte = new Date(dateTo + 'T23:59:59');
      }
    }

    // Fetch ALL logs first (without pagination)
    const allLogs = await prisma.audit_log.findMany({
      where,
      include: {
        changed_by_user: {
          select: {
            user_id: true,
            full_name: true,
            wallet_address: true,
            role: true,
            assigned_barangay: true
          }
        }
      },
      orderBy: { changed_at: 'desc' }
    });

    // Enrich logs with user info
    const enrichedLogs = await enrichLogsWithUserInfo(allLogs);

    // Apply pagination after enrichment
    const pageNum = parseInt(page);
    const lim = parseInt(limit);
    const start = (pageNum - 1) * lim;
    const paginatedLogs = enrichedLogs.slice(start, start + lim);

    res.json({
      logs: paginatedLogs,
      total: enrichedLogs.length,
      page: pageNum,
      totalPages: Math.ceil(enrichedLogs.length / lim)
    });
  } catch (error) {
    console.error('Error fetching all audit logs:', error);
    next(error);
  }
});

// GET statistics
router.get("/stats", async (req, res, next) => {
  try {
    const [
      total,
      byAction,
      byTable,
      recent
    ] = await Promise.all([
      prisma.audit_log.count(),
      prisma.audit_log.groupBy({
        by: ['action'],
        _count: true
      }),
      prisma.audit_log.groupBy({
        by: ['table_name'],
        _count: true
      }),
      prisma.audit_log.findMany({
        take: 10,
        orderBy: { changed_at: 'desc' },
        include: {
          changed_by_user: {
            select: {
              full_name: true
            }
          }
        }
      })
    ]);

    res.json({
      total,
      byAction: byAction.reduce((acc, item) => {
        acc[item.action] = item._count;
        return acc;
      }, {}),
      byTable: byTable.reduce((acc, item) => {
        acc[item.table_name] = item._count;
        return acc;
      }, {}),
      recent
    });
  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    next(error);
  }
});

export default router;