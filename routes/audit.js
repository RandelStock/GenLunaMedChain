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

// GET all audit logs with pagination and user info
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

    // Fetch logs first (filtering by date/table/action already applied). We'll apply
    // barangay scoping in-memory since audit_log does not have relations.
    const [rawLogs, rawTotal] = await Promise.all([
      prisma.audit_log.findMany({
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
        orderBy: { changed_at: 'desc' },
        // We'll paginate after barangay filtering
      }),
      prisma.audit_log.count({ where })
    ]);

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
      if (tbl === 'medicines' || tbl === 'medicine') {
        return src.barangay || null;
      }
      if (tbl === 'receipts' || tbl === 'medicine_releases') {
        // may be nested: medicine.barangay
        return (src.medicine && src.medicine.barangay) || src.barangay || null;
      }
      if (tbl === 'stock_removals' || tbl === 'removal' || tbl === 'stocks') {
        return (src.medicine && src.medicine.barangay) || src.barangay || null;
      }
      if (tbl === 'residents') {
        return src.barangay || null;
      }
      return null; // no specific barangay context
    };

    // Attach derived barangay
    const logsWithDerivedBarangay = rawLogs.map((log) => ({
      ...log,
      derivedBarangay: extractBarangay(log) || null
    }));

    // Apply scope filters from query
    let scopedLogs = logsWithDerivedBarangay;
    if (scope && scope !== 'all') {
      if (scope === 'RHU') {
        scopedLogs = scopedLogs.filter((l) => !l.derivedBarangay);
      } else if (scope === 'barangay') {
        scopedLogs = scopedLogs.filter((l) => barangay ? l.derivedBarangay === barangay : !!l.derivedBarangay);
      }
    }

    // Enforce user barangay scoping when not admin/municipal
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF' && user.assigned_barangay) {
      scopedLogs = logsWithDerivedBarangay.filter((log) => {
        const b = log.derivedBarangay;
        return b ? b === user.assigned_barangay : true;
      });
    }

    // Now paginate after filtering
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
            role: true
          }
        }
      },
      orderBy: { changed_at: 'desc' }
    });

    res.json(logs);
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
      month // YYYY-MM
    } = req.query;

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

    // Fetch logs without any barangay filtering
    const [logs, total] = await Promise.all([
      prisma.audit_log.findMany({
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
        orderBy: { changed_at: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.audit_log.count({ where })
    ]);

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
      if (tbl === 'medicines' || tbl === 'medicine') {
        return src.barangay || null;
      }
      if (tbl === 'receipts' || tbl === 'medicine_releases') {
        // may be nested: medicine.barangay
        return (src.medicine && src.medicine.barangay) || src.barangay || null;
      }
      if (tbl === 'stock_removals' || tbl === 'removal' || tbl === 'stocks') {
        return (src.medicine && src.medicine.barangay) || src.barangay || null;
      }
      if (tbl === 'residents') {
        return src.barangay || null;
      }
      return null; // no specific barangay context
    };

    // Attach derived barangay
    const logsWithDerivedBarangay = logs.map((log) => ({
      ...log,
      derivedBarangay: extractBarangay(log) || null
    }));

    res.json({
      logs: logsWithDerivedBarangay,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
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