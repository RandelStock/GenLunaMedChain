// backend/routes/users.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET current authenticated user (via x-wallet-address)
router.get('/me', authenticateUser, async (req, res) => {
  try {
    // req.user set by authenticateUser
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('Error returning current user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ NEW: Get user role by wallet address (for frontend RoleProvider)
router.get('/role/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    console.log('🔍 Looking up role for wallet:', walletAddress);
    
    // Hardcoded admin wallet addresses
    const adminWallets = [
      "0x7EDe510897C82b9469853a46cF5f431F04F081a9"
    ];
    
    // Check if this is a hardcoded admin wallet
    if (adminWallets.some(addr => addr.toLowerCase() === walletAddress.toLowerCase())) {
      console.log('✅ Hardcoded admin wallet detected:', walletAddress);
      return res.json({
        role: "ADMIN",
        wallet_address: walletAddress,
        is_hardcoded: true
      });
    }
    
    // Find user by wallet address (case-insensitive)
    const user = await prisma.users.findFirst({
      where: {
        wallet_address: {
          equals: walletAddress,
          mode: 'insensitive'
        }
      },
      select: {
        user_id: true,
        full_name: true,
        role: true,
        wallet_address: true,
        assigned_barangay: true,
        is_active: true
      }
    });

    if (!user) {
      console.log('❌ User not found for wallet:', walletAddress);
      return res.status(404).json({
        error: "User not found",
        role: "Patient" // Default role for non-registered users
      });
    }

    // Check if user is active
    if (!user.is_active) {
      console.log('⚠️ User is inactive:', walletAddress);
      return res.status(403).json({
        error: "User account is inactive",
        role: "Patient"
      });
    }

    console.log('✅ Found user:', user.full_name, 'Role:', user.role);

    res.json({
      success: true,
      role: user.role,
      user: {
        id: user.user_id,
        name: user.full_name,
        barangay: user.assigned_barangay,
        walletAddress: user.wallet_address
      }
    });

  } catch (error) {
    console.error("❌ Error fetching user role:", error);
    res.status(500).json({
      error: "Failed to fetch user role",
      details: error.message
    });
  }
});

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET user by wallet address (define BEFORE ':id' to avoid route shadowing)
router.get('/wallet/:address', async (req, res) => {
  try {
    const walletAddress = req.params.address?.toLowerCase();
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const user = await prisma.users.findUnique({
      where: { wallet_address: walletAddress }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET user by ID (after wallet route)
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Check if wallet address is admin
router.get('/check-admin/:address', async (req, res) => {
  try {
    const walletAddress = req.params.address.toLowerCase();

    const user = await prisma.users.findUnique({
      where: { wallet_address: walletAddress }
    });

    if (!user) {
      return res.json({ 
        isAdmin: false, 
        message: 'User not found in database' 
      });
    }

    const isAdmin = user.role === 'ADMIN' && user.is_active;

    res.json({
      isAdmin,
      role: user.role,
      fullName: user.full_name,
      email: user.email
    });

  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create new user
router.post('/', async (req, res) => {
  try {
    const {
      wallet_address,
      full_name,
      email,
      phone,
      role,
      assigned_barangay
    } = req.body;

    // Validate required fields
    if (!wallet_address || !full_name || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: wallet_address, full_name, role' 
      });
    }

    // Check if wallet already exists
    const existingUser = await prisma.users.findUnique({
      where: { wallet_address: wallet_address.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Wallet address already registered' 
      });
    }

    const user = await prisma.users.create({
      data: {
        wallet_address: wallet_address.toLowerCase(),
        full_name,
        email,
        phone,
        role: role.toUpperCase(),
        barangay,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    res.status(201).json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update user
router.put('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const {
      full_name,
      email,
      phone,
      role,
      barangay,
      is_active
    } = req.body;

    const user = await prisma.users.update({
      where: { user_id: userId },
      data: {
        full_name,
        email,
        phone,
        role: role?.toUpperCase(),
        barangay,
        is_active,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH - Update user role
router.patch('/:id/role', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    if (!['ADMIN', 'STAFF'].includes(role.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be ADMIN or STAFF' 
      });
    }

    const user = await prisma.users.update({
      where: { user_id: userId },
      data: {
        role: role.toUpperCase(),
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Soft delete user
router.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    await prisma.users.update({
      where: { user_id: userId },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET users by role
router.get('/by-role/:role', async (req, res) => {
  try {
    const role = req.params.role.toUpperCase();

    if (!['ADMIN', 'STAFF'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be ADMIN or STAFF' 
      });
    }

    const users = await prisma.users.findMany({
      where: {
        role,
        is_active: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;