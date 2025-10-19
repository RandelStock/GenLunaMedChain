// backend/routes/residents.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { logAudit, getIpAddress, getUserAgent } from "../utils/auditLogger.js";
import { getBarangayFilter, canModifyRecord } from '../middleware/baranggayAccess.js';
// import { authenticateUser } from '../middleware/auth.js';

// // Uncomment these:
// router.use(authenticateUser);
// router.use(checkBarangayAccess);

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// BARANGAY HELPER FUNCTIONS
// ============================================

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
// HELPER FUNCTIONS
// ============================================

// Helper function to calculate age category
function calculateAgeCategory(age) {
  if (age === null || age === undefined) return null;
  if (age <= 1.99) return 'ZERO_TO_23_MONTHS'; // 0-23 months
  if (age <= 4.99) return 'TWENTY_FOUR_TO_59_MONTHS'; // 24-59 months
  if (age <= 5.99) return 'SIXTY_TO_71_MONTHS'; // 60-71 months
  return 'ABOVE_71_MONTHS';
}

// Helper function to check if senior citizen (60+ years)
function isSeniorCitizen(age) {
  return age !== null && age >= 60;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET statistics for dashboard widgets with barangay filtering
 */
router.get("/statistics", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const { barangay } = req.query;
    
    // If admin queries specific barangay
    let where = { ...barangayFilter, is_active: true };
    if (barangay && user && (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF')) {
      where = { barangay, is_active: true };
    }
    
    const [
      totalResidents,
      fourPsMembers,
      pregnantResidents,
      seniorCitizens,
      birthRegistered,
      ageCategories,
      barangayStats
    ] = await Promise.all([
      // Total residents
      prisma.residents.count({ where }),
      
      // 4Ps members
      prisma.residents.count({ where: { ...where, is_4ps_member: true } }),
      
      // Pregnant residents
      prisma.residents.count({ where: { ...where, is_pregnant: true } }),
      
      // Senior citizens
      prisma.residents.count({ where: { ...where, is_senior_citizen: true } }),
      
      // Birth registered
      prisma.residents.count({ where: { ...where, is_birth_registered: true } }),
      
      // Age category breakdown
      prisma.residents.groupBy({
        by: ['age_category'],
        where,
        _count: true
      }),
      
      // Barangay breakdown (only if admin and no specific barangay filter)
      (!barangay && user && (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF')) 
        ? prisma.residents.groupBy({
            by: ['barangay'],
            where: { is_active: true },
            _count: true
          }) 
        : null
    ]);
    
    res.json({
      success: true,
      stats: {
        totalResidents,
        fourPsMembers,
        pregnantResidents,
        seniorCitizens,
        birthRegistered,
        ageCategories: ageCategories.reduce((acc, cat) => {
          acc[cat.age_category || 'UNKNOWN'] = cat._count;
          return acc;
        }, {}),
        barangayStats: barangayStats ? barangayStats.reduce((acc, stat) => {
          acc[stat.barangay || 'UNKNOWN'] = stat._count;
          return acc;
        }, {}) : null
      },
      barangay: user?.assigned_barangay || barangay || 'ALL'
    });
  } catch (error) {
    console.error('Error fetching resident statistics:', error);
    next(error);
  }
});

/**
 * GET barangay-specific statistics
 */
router.get("/statistics/barangay/:barangay", async (req, res, next) => {
  try {
    const user = req.user || null;
    const { barangay } = req.params;

    // Check if user has access to this barangay
    if (user && !canModifyRecord(user, barangay)) {
      return res.status(403).json({ 
        error: 'Access denied to this barangay',
        requestedBarangay: barangay,
        yourBarangay: user.assigned_barangay
      });
    }
    
    const where = { barangay, is_active: true };
    
    const [
      totalResidents,
      fourPsMembers,
      pregnantResidents,
      seniorCitizens,
      birthRegistered,
      ageCategories,
      genderBreakdown
    ] = await Promise.all([
      prisma.residents.count({ where }),
      prisma.residents.count({ where: { ...where, is_4ps_member: true } }),
      prisma.residents.count({ where: { ...where, is_pregnant: true } }),
      prisma.residents.count({ where: { ...where, is_senior_citizen: true } }),
      prisma.residents.count({ where: { ...where, is_birth_registered: true } }),
      prisma.residents.groupBy({
        by: ['age_category'],
        where,
        _count: true
      }),
      prisma.residents.groupBy({
        by: ['gender'],
        where,
        _count: true
      })
    ]);
    
    res.json({
      success: true,
      barangay,
      stats: {
        totalResidents,
        fourPsMembers,
        pregnantResidents,
        seniorCitizens,
        birthRegistered,
        ageCategories: ageCategories.reduce((acc, cat) => {
          acc[cat.age_category || 'UNKNOWN'] = cat._count;
          return acc;
        }, {}),
        genderBreakdown: genderBreakdown.reduce((acc, g) => {
          acc[g.gender || 'UNKNOWN'] = g._count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching barangay statistics:', error);
    next(error);
  }
});

/**
 * GET all residents with filters and barangay access control
 */
router.get("/", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const { 
      barangay, 
      age_category, 
      is_4ps_member, 
      is_pregnant, 
      is_senior_citizen,
      is_birth_registered,
      search,
      page = 1,
      limit = 50
    } = req.query;
    
    let where = { ...barangayFilter, is_active: true };
    
    // Admin can filter by specific barangay
    if (barangay && user && (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF')) {
      where.barangay = barangay;
    }

    if (age_category) where.age_category = age_category;
    if (is_4ps_member !== undefined) where.is_4ps_member = is_4ps_member === 'true';
    if (is_pregnant !== undefined) where.is_pregnant = is_pregnant === 'true';
    if (is_senior_citizen !== undefined) where.is_senior_citizen = is_senior_citizen === 'true';
    if (is_birth_registered !== undefined) where.is_birth_registered = is_birth_registered === 'true';
    
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { full_name: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const [residents, total] = await Promise.all([
      prisma.residents.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.residents.count({ where })
    ]);
    
    res.json({
      success: true,
      data: residents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      barangay: user?.assigned_barangay || 'ALL'
    });
  } catch (error) {
    console.error('Error fetching residents:', error);
    next(error);
  }
});

/**
 * GET resident by ID with barangay access check
 */
router.get("/:id", async (req, res, next) => {
  try {
    const user = req.user || null;

    const resident = await prisma.residents.findUnique({
      where: { resident_id: Number(req.params.id) },
    });

    if (!resident) {
      return res.status(404).json({ error: "Resident not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, resident.barangay)) {
      return res.status(403).json({ 
        error: 'Access denied to this barangay',
        residentBarangay: resident.barangay,
        yourBarangay: user.assigned_barangay
      });
    }

    res.json({ success: true, data: resident });
  } catch (error) {
    console.error('Error fetching resident:', error);
    next(error);
  }
});

/**
 * POST new resident with barangay assignment
 */
router.post("/", async (req, res, next) => {
  try {
    const user = req.user || null;
    const { resident_id, barangay, ...data } = req.body;

    // Determine barangay assignment
    let assignedBarangay = barangay;

    // If user is not admin, force their assigned barangay
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      assignedBarangay = user.assigned_barangay;
    }

    // Barangay is required
    if (!assignedBarangay) {
      return res.status(400).json({ 
        error: 'Barangay is required for resident registration' 
      });
    }

    // Process dates
    if (data.date_of_birth) {
      data.date_of_birth = new Date(data.date_of_birth).toISOString();
    }
    
    if (data.pregnancy_due_date) {
      data.pregnancy_due_date = new Date(data.pregnancy_due_date).toISOString();
    }
    
    if (data.birth_registry_date) {
      data.birth_registry_date = new Date(data.birth_registry_date).toISOString();
    }
    
    // Calculate age category from age
    if (data.age !== null && data.age !== undefined) {
      data.age_category = calculateAgeCategory(data.age);
      data.is_senior_citizen = isSeniorCitizen(data.age);
    }

    // Add barangay to data
    data.barangay = assignedBarangay;
    
    const resident = await prisma.residents.create({ 
      data: data 
    });
    
    await logAudit({
      tableName: 'residents',
      recordId: resident.resident_id,
      action: 'INSERT',
      newValues: resident,
      walletAddress: (req.body && req.body.wallet_address) || req.headers['x-wallet-address'] || null,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });
    
    res.status(201).json({
      success: true,
      data: resident,
      message: `Resident registered for ${assignedBarangay}`
    });
  } catch (error) {
    console.error('Error creating resident:', error);
    next(error);
  }
});

/**
 * PUT update resident with barangay access check
 */
router.put("/:id", async (req, res, next) => {
  try {
    const residentId = Number(req.params.id);
    const user = req.user || null;
    const { resident_id, barangay, ...data } = req.body;
    
    const oldResident = await prisma.residents.findUnique({
      where: { resident_id: residentId }
    });
    
    if (!oldResident) {
      return res.status(404).json({ error: "Resident not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, oldResident.barangay)) {
      return res.status(403).json({ 
        error: 'You do not have permission to modify this resident',
        residentBarangay: oldResident.barangay,
        yourBarangay: user.assigned_barangay
      });
    }
    
    // Process dates
    if (data.date_of_birth) {
      data.date_of_birth = new Date(data.date_of_birth).toISOString();
    }
    
    if (data.pregnancy_due_date) {
      data.pregnancy_due_date = new Date(data.pregnancy_due_date).toISOString();
    }
    
    if (data.birth_registry_date) {
      data.birth_registry_date = new Date(data.birth_registry_date).toISOString();
    }
    
    // Calculate age category from age
    if (data.age !== null && data.age !== undefined) {
      data.age_category = calculateAgeCategory(data.age);
      data.is_senior_citizen = isSeniorCitizen(data.age);
    }

    // Only admin can change barangay assignment
    if (barangay && user && (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF')) {
      data.barangay = barangay;
    }
    
    const resident = await prisma.residents.update({
      where: { resident_id: residentId },
      data: data,
    });
    
    await logAudit({
      tableName: 'residents',
      recordId: residentId,
      action: 'UPDATE',
      oldValues: oldResident,
      newValues: resident,
      walletAddress: (req.body && req.body.wallet_address) || req.headers['x-wallet-address'] || null,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });
    
    res.json({ success: true, data: resident });
  } catch (err) {
    console.error('Error updating resident:', err);
    if (err.code === "P2025") {
      res.status(404).json({ error: "Resident not found" });
    } else {
      next(err);
    }
  }
});

/**
 * DELETE resident with barangay access check
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const residentId = Number(req.params.id);
    const user = req.user || null;
    
    const oldResident = await prisma.residents.findUnique({
      where: { resident_id: residentId }
    });
    
    if (!oldResident) {
      return res.status(404).json({ error: "Resident not found" });
    }

    // Check barangay access
    if (user && !canModifyRecord(user, oldResident.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Soft delete instead of hard delete
    await prisma.residents.update({
      where: { resident_id: residentId },
      data: { is_active: false }
    });
    
    await logAudit({
      tableName: 'residents',
      recordId: residentId,
      action: 'DELETE',
      oldValues: oldResident,
      walletAddress: req.headers['x-wallet-address'] || null,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });
    
    res.json({ 
      success: true,
      message: "Resident deactivated successfully" 
    });
  } catch (err) {
    console.error('Error deleting resident:', err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Resident not found" });
    }
    next(err);
  }
});

/**
 * GET /api/residents/barangay/:barangay/compare
 * Compare resident demographics across barangays (admin only)
 */
router.get("/compare/barangays", async (req, res, next) => {
  try {
    const user = req.user || null;

    // Only admin/municipal staff can compare barangays
    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comparison = await prisma.residents.groupBy({
      by: ['barangay'],
      where: { is_active: true },
      _count: {
        resident_id: true
      }
    });

    // Get detailed stats per barangay
    const detailedStats = await Promise.all(
      comparison.map(async (item) => {
        const [fourPs, pregnant, senior, birthReg] = await Promise.all([
          prisma.residents.count({ 
            where: { barangay: item.barangay, is_4ps_member: true, is_active: true } 
          }),
          prisma.residents.count({ 
            where: { barangay: item.barangay, is_pregnant: true, is_active: true } 
          }),
          prisma.residents.count({ 
            where: { barangay: item.barangay, is_senior_citizen: true, is_active: true } 
          }),
          prisma.residents.count({ 
            where: { barangay: item.barangay, is_birth_registered: true, is_active: true } 
          })
        ]);

        return {
          barangay: item.barangay,
          total: item._count.resident_id,
          fourPsMembers: fourPs,
          pregnant: pregnant,
          seniorCitizens: senior,
          birthRegistered: birthReg
        };
      })
    );

    res.json({ 
      success: true, 
      data: detailedStats 
    });
  } catch (err) {
    console.error('Compare barangays error:', err);
    next(err);
  }
});

export default router;