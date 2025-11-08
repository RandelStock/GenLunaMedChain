// backend/routes/residents.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { logAudit, getIpAddress, getUserAgent } from "../utils/auditLogger.js";
import { getBarangayFilter, canModifyRecord } from '../middleware/baranggayAccess.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateAgeCategory(age) {
  if (age === null || age === undefined) return null;
  if (age <= 1.99) return 'ZERO_TO_23_MONTHS';
  if (age <= 4.99) return 'TWENTY_FOUR_TO_59_MONTHS';
  if (age <= 5.99) return 'SIXTY_TO_71_MONTHS';
  return 'ABOVE_71_MONTHS';
}

function isSeniorCitizen(age) {
  return age !== null && age >= 60;
}

// ============================================
// NEW: CHECK FOR DUPLICATE RESIDENTS
// ============================================

/**
 * POST /api/residents/check-duplicate
 * Check if a resident with similar details already exists
 */
router.post("/check-duplicate", async (req, res, next) => {
  try {
    const { first_name, last_name, date_of_birth, middle_name } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ 
        error: 'First name and last name are required' 
      });
    }

    // Build search conditions
    const searchConditions = {
      first_name: { equals: first_name.trim(), mode: 'insensitive' },
      last_name: { equals: last_name.trim(), mode: 'insensitive' },
      is_active: true
    };

    // Add middle name if provided
    if (middle_name && middle_name.trim()) {
      searchConditions.middle_name = { 
        equals: middle_name.trim(), 
        mode: 'insensitive' 
      };
    }

    // Add date of birth if provided
    if (date_of_birth) {
      searchConditions.date_of_birth = new Date(date_of_birth).toISOString();
    }

    // Search for potential duplicates
    const potentialDuplicates = await prisma.residents.findMany({
      where: searchConditions,
      select: {
        resident_id: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        full_name: true,
        date_of_birth: true,
        age: true,
        gender: true,
        barangay: true,
        address: true,
        phone: true,
        is_4ps_member: true,
        is_pregnant: true,
        is_senior_citizen: true
      }
    });

    if (potentialDuplicates.length > 0) {
      return res.json({
        success: true,
        duplicateFound: true,
        count: potentialDuplicates.length,
        duplicates: potentialDuplicates,
        message: `Found ${potentialDuplicates.length} potential duplicate(s)`
      });
    }

    res.json({
      success: true,
      duplicateFound: false,
      message: 'No duplicates found'
    });
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    next(error);
  }
});

// ============================================
// EXISTING ROUTES
// ============================================

/**
 * GET statistics for dashboard widgets with barangay filtering
 */
router.get("/statistics", async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const { barangay } = req.query;
    
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
 * GET resident by ID with medical records and medicine releases
 */
router.get("/:id", async (req, res, next) => {
  try {
    const user = req.user || null;

    const resident = await prisma.residents.findUnique({
      where: { resident_id: Number(req.params.id) },
      include: {
        // Include medicine releases if the table exists
        medicine_releases: {
          orderBy: { date_released: 'desc' },
          take: 10,
          include: {
            medicine: {
              select: {
                medicine_name: true,
                dosage_form: true,
                strength: true
              }
            }
          }
        }
      }
    });

    if (!resident) {
      return res.status(404).json({ error: "Resident not found" });
    }

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
 * POST new resident with duplicate check
 */
router.post("/", async (req, res, next) => {
  try {
    const user = req.user || null;
    const { resident_id, barangay, skip_duplicate_check, ...data } = req.body;

    // Determine barangay assignment
    let assignedBarangay = barangay;

    if (user && user.role !== 'ADMIN' && user.role !== 'MUNICIPAL_STAFF') {
      assignedBarangay = user.assigned_barangay;
    }

    if (!assignedBarangay) {
      return res.status(400).json({ 
        error: 'Barangay is required for resident registration' 
      });
    }

    // Check for duplicates unless explicitly skipped
    if (!skip_duplicate_check) {
      const searchConditions = {
        first_name: { equals: data.first_name.trim(), mode: 'insensitive' },
        last_name: { equals: data.last_name.trim(), mode: 'insensitive' },
        is_active: true
      };

      if (data.date_of_birth) {
        searchConditions.date_of_birth = new Date(data.date_of_birth).toISOString();
      }

      const existingResident = await prisma.residents.findFirst({
        where: searchConditions
      });

      if (existingResident) {
        return res.status(409).json({
          error: 'Potential duplicate resident found',
          duplicateFound: true,
          duplicate: {
            resident_id: existingResident.resident_id,
            full_name: existingResident.full_name,
            date_of_birth: existingResident.date_of_birth,
            age: existingResident.age,
            barangay: existingResident.barangay,
            address: existingResident.address
          },
          message: 'A resident with similar details already exists. Please review or add skip_duplicate_check=true to proceed anyway.'
        });
      }
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

    if (user && !canModifyRecord(user, oldResident.barangay)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
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
 * GET /api/residents/compare/barangays
 * Compare resident demographics across barangays (admin only)
 */
router.get("/compare/barangays", async (req, res, next) => {
  try {
    const user = req.user || null;

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