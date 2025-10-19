// backend/middleware/auth.js
// Authentication middleware for GenLunaMedChain
// Handles wallet-based authentication

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

/**
 * Verify Ethereum signature
 * @param {string} message - Original message that was signed
 * @param {string} signature - Signature from wallet
 * @param {string} expectedAddress - Expected wallet address
 * @returns {boolean} - True if signature is valid
 */
// Support both ethers v5 and v6 APIs
const isAddressCompat = (address) => {
  try {
    const fn = ethers?.utils?.isAddress || ethers?.isAddress;
    return fn ? fn(address) : false;
  } catch (_) {
    return false;
  }
};

const verifyMessageCompat = (message, signature) => {
  try {
    const fn = ethers?.utils?.verifyMessage || ethers?.verifyMessage;
    return fn ? fn(message, signature) : null;
  } catch (_) {
    return null;
  }
};

function verifySignature(message, signature, expectedAddress) {
  try {
    const recoveredAddress = verifyMessageCompat(message, signature);
    if (!recoveredAddress) return false;
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Main authentication middleware
 * Authenticates user via wallet address from headers
 */
export async function authenticateUser(req, res, next) {
  try {
    // Get wallet address from headers
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No wallet address provided'
      });
    }

    // Validate wallet address format
    if (!isAddressCompat(walletAddress)) {
      return res.status(400).json({ 
        error: 'Invalid wallet address format' 
      });
    }

    // Find user in database
    const user = await prisma.users.findUnique({
      where: { 
        wallet_address: walletAddress.toLowerCase() 
      },
      select: {
        user_id: true,
        wallet_address: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        assigned_barangay: true,
        is_active: true,
        created_at: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Wallet address not registered in the system'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact administrator.'
      });
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
}

/**
 * Authentication middleware with signature verification
 * Use this for sensitive operations
 */
export async function authenticateWithSignature(req, res, next) {
  try {
    const walletAddress = req.headers['x-wallet-address'];
    const signature = req.headers['x-signature'];
    const message = req.headers['x-message'];
    const timestamp = req.headers['x-timestamp'];

    if (!walletAddress || !signature || !message || !timestamp) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Missing authentication credentials'
      });
    }

    // Check timestamp to prevent replay attacks (5 minutes validity)
    const now = Date.now();
    const signatureTime = parseInt(timestamp);
    const fiveMinutes = 5 * 60 * 1000;

    if (now - signatureTime > fiveMinutes) {
      return res.status(401).json({ 
        error: 'Signature expired',
        message: 'Please sign a new message'
      });
    }

    // Verify signature
    if (!verifySignature(message, signature, walletAddress)) {
      return res.status(401).json({ 
        error: 'Invalid signature',
        message: 'Signature verification failed'
      });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { 
        wallet_address: walletAddress.toLowerCase() 
      },
      select: {
        user_id: true,
        wallet_address: true,
        full_name: true,
        email: true,
        role: true,
        assigned_barangay: true,
        is_active: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Wallet address not registered'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account deactivated'
      });
    }

    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed'
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if authenticated, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  try {
    const walletAddress = req.headers['x-wallet-address'];

    if (!walletAddress) {
      req.user = null;
      return next();
    }

    if (!isAddressCompat(walletAddress)) {
      req.user = null;
      return next();
    }

    const user = await prisma.users.findUnique({
      where: { 
        wallet_address: walletAddress.toLowerCase() 
      },
      select: {
        user_id: true,
        wallet_address: true,
        full_name: true,
        role: true,
        assigned_barangay: true,
        is_active: true
      }
    });

    req.user = (user && user.is_active) ? user : null;
    next();

  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
}

/**
 * Role-based authorization middleware
 * @param {Array<string>} allowedRoles - Array of allowed roles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        yourRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Admin-only middleware
 */
export function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      error: 'Admin access required',
      yourRole: req.user.role
    });
  }

  next();
}

/**
 * Admin or Municipal Staff middleware
 */
export function adminOrMunicipalStaff(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'MUNICIPAL_STAFF') {
    return res.status(403).json({ 
      error: 'Administrative access required',
      message: 'This action requires ADMIN or MUNICIPAL_STAFF role',
      yourRole: req.user.role
    });
  }

  next();
}

/**
 * Check if user belongs to a specific barangay
 * @param {string} barangay - Barangay to check
 */
export function requireBarangay(barangay) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }

    // Admin and Municipal Staff can access any barangay
    if (req.user.role === 'ADMIN' || req.user.role === 'MUNICIPAL_STAFF') {
      return next();
    }

    // Check if user's barangay matches
    if (req.user.assigned_barangay !== barangay) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `You do not have access to ${barangay}`,
        yourBarangay: req.user.assigned_barangay
      });
    }

    next();
  };
}

/**
 * Generate authentication message for signing
 * @param {string} walletAddress - Wallet address
 * @returns {object} - Message and timestamp
 */
export function generateAuthMessage(walletAddress) {
  const timestamp = Date.now();
  const message = `GenLunaMedChain Authentication\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\n\nSign this message to authenticate your access to GenLunaMedChain system.`;
  
  return {
    message,
    timestamp
  };
}

/**
 * Middleware to log authenticated requests
 */
export function logAuthenticatedRequest(req, res, next) {
  if (req.user) {
    console.log(`[AUTH] ${req.method} ${req.path} - User: ${req.user.full_name} (${req.user.wallet_address}) - Role: ${req.user.role} - Barangay: ${req.user.assigned_barangay || 'N/A'}`);
  }
  next();
}

// Export all functions
export default {
  authenticateUser,
  authenticateWithSignature,
  optionalAuth,
  requireRole,
  adminOnly,
  adminOrMunicipalStaff,
  requireBarangay,
  generateAuthMessage,
  logAuthenticatedRequest,
  verifySignature
};