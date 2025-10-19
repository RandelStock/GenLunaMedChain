// backend/middleware/barangayAccess.js
// Middleware to enforce barangay-level access control for GenLunaMedChain

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get barangay filter based on user's role and assigned barangay
 * @param {Object} user - User object from authentication middleware
 * @returns {Object} Prisma where clause for barangay filtering
 */
export function getBarangayFilter(user) {
  // Admin and Municipal Staff can see all barangays
  if (!user || user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
    return {}; // No filter - see everything
  }

  // Staff and Pharmacists only see their assigned barangay
  if (user.assigned_barangay) {
    return { barangay: user.assigned_barangay };
  }

  // Safety: If user has no barangay assigned, return impossible condition
  return { barangay: null };
}

/**
 * Middleware to check if user can access resources
 * Attaches barangayFilter to request object
 */
export async function checkBarangayAccess(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Admin and Municipal Staff have access to all barangays
    if (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
      req.barangayFilter = {}; // No restrictions
      req.userBarangay = null; // Can access all
      req.canAccessAllBarangays = true;
      return next();
    }

    // Check if user has assigned barangay
    if (!user.assigned_barangay) {
      return res.status(403).json({ 
        error: 'No barangay assigned',
        message: 'No barangay assigned to your account. Please contact administrator.',
        role: user.role
      });
    }

    // Attach barangay filter to request
    req.barangayFilter = { barangay: user.assigned_barangay };
    req.userBarangay = user.assigned_barangay;
    req.canAccessAllBarangays = false;

    next();
  } catch (error) {
    console.error('Barangay access check error:', error);
    res.status(500).json({ 
      error: 'Server error checking barangay access' 
    });
  }
}

/**
 * Middleware to validate if requested barangay matches user's access
 * Checks barangay from body, query, or params
 */
export function validateBarangayParam(req, res, next) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const requestedBarangay = req.body.barangay || req.query.barangay || req.params.barangay;

  // Admin and Municipal Staff can access any barangay
  if (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
    return next();
  }

  // If barangay is specified in request, it must match user's assigned barangay
  if (requestedBarangay && requestedBarangay !== user.assigned_barangay) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'You do not have access to this barangay',
      yourBarangay: user.assigned_barangay,
      requestedBarangay: requestedBarangay
    });
  }

  next();
}

/**
 * Get user's accessible barangays list
 * @param {Object} user - User object
 * @returns {Array} - Array of accessible barangay objects
 */
export async function getUserBarangays(user) {
  if (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
    // Return all barangays
    const centers = await prisma.barangay_health_centers.findMany({
      where: { is_active: true },
      orderBy: { center_name: 'asc' }
    });
    return centers.map(c => ({
      barangay: c.barangay,
      name: c.center_name,
      canModify: true
    }));
  }

  // Return only assigned barangay
  if (user.assigned_barangay) {
    const center = await prisma.barangay_health_centers.findUnique({
      where: { barangay: user.assigned_barangay }
    });
    return [{
      barangay: user.assigned_barangay,
      name: center?.center_name || user.assigned_barangay,
      canModify: true
    }];
  }

  return [];
}

/**
 * Check if user can modify a specific record
 * @param {Object} user - User object
 * @param {string} recordBarangay - Barangay of the record being modified
 * @returns {boolean} - True if user can modify
 */
export function canModifyRecord(user, recordBarangay) {
  if (!user) return false;
  
  if (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
    return true;
  }

  return user.assigned_barangay === recordBarangay;
}

/**
 * Check if user can view a specific record
 * Similar to canModifyRecord but more permissive
 * @param {Object} user - User object
 * @param {string} recordBarangay - Barangay of the record
 * @returns {boolean} - True if user can view
 */
export function canViewRecord(user, recordBarangay) {
  if (!user) return false;
  
  if (user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
    return true;
  }

  return user.assigned_barangay === recordBarangay;
}

/**
 * Enhance Prisma query with barangay filter
 * @param {Object} baseQuery - Base Prisma query object
 * @param {Object} user - User object
 * @returns {Object} - Enhanced query with barangay filter
 */
export function addBarangayFilter(baseQuery, user) {
  if (!user || user.role === 'ADMIN' || user.role === 'MUNICIPAL_STAFF') {
    return baseQuery; // No modification needed
  }

  if (!user.assigned_barangay) {
    // Return impossible condition if no barangay assigned
    return {
      ...baseQuery,
      where: {
        ...(baseQuery.where || {}),
        barangay: null
      }
    };
  }

  // Add barangay filter to where clause
  return {
    ...baseQuery,
    where: {
      ...(baseQuery.where || {}),
      barangay: user.assigned_barangay
    }
  };
}

/**
 * Middleware to log barangay access attempts
 */
export function logBarangayAccess(req, res, next) {
  if (req.user) {
    const barangay = req.user.assigned_barangay || 'ALL';
    console.log(`[BARANGAY ACCESS] ${req.method} ${req.path} - User: ${req.user.full_name} - Barangay: ${barangay}`);
  }
  next();
}

/**
 * Validate that barangay exists in the system
 * @param {string} barangay - Barangay code to validate
 * @returns {Promise<boolean>} - True if barangay exists
 */
export async function isValidBarangay(barangay) {
  if (!barangay) return false;

  const center = await prisma.barangay_health_centers.findUnique({
    where: { barangay: barangay }
  });

  return !!center;
}

/**
 * Middleware to ensure barangay parameter is valid
 */
export async function validateBarangayExists(req, res, next) {
  const barangay = req.body.barangay || req.query.barangay || req.params.barangay;

  if (!barangay) {
    return next(); // Optional barangay
  }

  const exists = await isValidBarangay(barangay);

  if (!exists) {
    return res.status(400).json({
      error: 'Invalid barangay',
      message: `Barangay '${barangay}' does not exist in the system`
    });
  }

  next();
}

/**
 * Get barangay statistics for user
 * @param {Object} user - User object
 * @returns {Object} - Statistics object
 */
export async function getBarangayStats(user) {
  const barangayFilter = getBarangayFilter(user);

  const [
    medicineCount,
    stockCount,
    residentCount,
    releaseCount
  ] = await Promise.all([
    prisma.medicine_records.count({ 
      where: { ...barangayFilter, is_active: true } 
    }),
    prisma.medicine_stocks.count({ 
      where: { 
        medicine: barangayFilter,
        is_active: true 
      } 
    }),
    prisma.residents.count({ 
      where: { ...barangayFilter, is_active: true } 
    }),
    prisma.medicine_releases.count({ 
      where: { 
        medicine: barangayFilter
      } 
    })
  ]);

  return {
    barangay: user.assigned_barangay || 'ALL',
    medicineCount,
    stockCount,
    residentCount,
    releaseCount
  };
}

/**
 * Middleware to attach barangay stats to request
 */
export async function attachBarangayStats(req, res, next) {
  if (req.user) {
    try {
      req.barangayStats = await getBarangayStats(req.user);
    } catch (error) {
      console.error('Error fetching barangay stats:', error);
      req.barangayStats = null;
    }
  }
  next();
}

// Export all functions
export default {
  getBarangayFilter,
  checkBarangayAccess,
  validateBarangayParam,
  getUserBarangays,
  canModifyRecord,
  canViewRecord,
  addBarangayFilter,
  logBarangayAccess,
  isValidBarangay,
  validateBarangayExists,
  getBarangayStats,
  attachBarangayStats
};