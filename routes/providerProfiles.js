// backend/routes/providerProfiles.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit, getIpAddress, getUserAgent } from '../utils/auditLogger.js';
import { optionalAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate time slots based on availability
const generateTimeSlots = (startTime, endTime, slotDuration = 30, breakStart = null, breakEnd = null) => {
  const slots = [];
  const start = new Date(`2024-01-01T${startTime}:00`);
  const end = new Date(`2024-01-01T${endTime}:00`);
  const breakStartTime = breakStart ? new Date(`2024-01-01T${breakStart}:00`) : null;
  const breakEndTime = breakEnd ? new Date(`2024-01-01T${breakEnd}:00`) : null;
  
  let current = new Date(start);
  
  while (current < end) {
    const timeString = current.toTimeString().slice(0, 5);
    
    // Skip break time if it exists
    if (breakStartTime && breakEndTime && current >= breakStartTime && current < breakEndTime) {
      current.setMinutes(current.getMinutes() + slotDuration);
      continue;
    }
    
    slots.push(timeString);
    current.setMinutes(current.getMinutes() + slotDuration);
  }
  
  return slots;
};

// Get day name from number
const getDayName = (dayNumber) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber];
};

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/provider-profiles
 * Create a new provider (doctor or nurse)
 */
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      wallet_address,
      full_name,
      email,
      phone,
      role, // 'ADMIN' for doctor, 'MUNICIPAL_STAFF' for nurse
      assigned_barangay,
      specializations // Array of specializations
    } = req.body;
    
    // Validate required fields
    if (!wallet_address || !full_name || !role) {
      return res.status(400).json({
        error: 'Missing required fields: wallet_address, full_name, role'
      });
    }
    
    // Validate role
    if (!['ADMIN', 'MUNICIPAL_STAFF'].includes(role.toUpperCase())) {
      return res.status(400).json({
        error: 'Role must be ADMIN (doctor) or MUNICIPAL_STAFF (nurse)'
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
    
    // Create the user/provider
    const provider = await prisma.users.create({
      data: {
        wallet_address: wallet_address.toLowerCase(),
        full_name,
        email,
        phone,
        role: role.toUpperCase(),
        assigned_barangay,
        is_active: true
      },
      include: {
        provider_specializations: true
      }
    });
    
    // Add specializations if provided
    if (specializations && specializations.length > 0) {
      const specializationData = specializations.map((spec, index) => ({
        provider_id: provider.user_id,
        specialization: spec.specialization,
        description: spec.description,
        years_experience: spec.years_experience ? parseInt(spec.years_experience) : null,
        is_primary: index === 0 // First specialization is primary
      }));
      
      await prisma.provider_specializations.createMany({
        data: specializationData
      });
      
      // Reload provider with specializations
      const updatedProvider = await prisma.users.findUnique({
        where: { user_id: provider.user_id },
        include: {
          provider_specializations: true,
          provider_availability: true
        }
      });
      
      res.status(201).json({
        success: true,
        data: updatedProvider,
        message: `${role === 'ADMIN' ? 'Doctor' : 'Nurse'} profile created successfully`
      });
    } else {
      res.status(201).json({
        success: true,
        data: provider,
        message: `${role === 'ADMIN' ? 'Doctor' : 'Nurse'} profile created successfully`
      });
    }
    
  } catch (error) {
    console.error('Error creating provider:', error);
    next(error);
  }
});

/**
 * GET /api/provider-profiles
 * Get all provider profiles (doctors and nurses)
 */
router.get('/', async (req, res, next) => {
  try {
    const { role, is_active } = req.query;
    
    const where = {
      role: {
        in: ['ADMIN', 'MUNICIPAL_STAFF'] // Doctors are ADMIN, Nurses are MUNICIPAL_STAFF
      }
    };
    
    if (role) {
      where.role = role === 'DOCTOR' ? 'ADMIN' : 'MUNICIPAL_STAFF';
    }
    
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }
    
    const providers = await prisma.users.findMany({
      where,
      include: {
        provider_availability: {
          where: { is_active: true },
          orderBy: { day_of_week: 'asc' }
        },
        provider_specializations: {
          orderBy: { is_primary: 'desc' }
        }
      },
      orderBy: { full_name: 'asc' }
    });
    
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('Error fetching provider profiles:', error);
    next(error);
  }
});

/**
 * GET /api/provider-profiles/:id
 * Get single provider profile
 */
router.get('/:id', async (req, res, next) => {
  try {
    const providerId = parseInt(req.params.id);
    
    if (isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    
    const provider = await prisma.users.findUnique({
      where: { user_id: providerId },
      include: {
        provider_availability: {
          orderBy: { day_of_week: 'asc' }
        },
        provider_specializations: {
          orderBy: { is_primary: 'desc' }
        }
      }
    });
    
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    res.json({
      success: true,
      data: provider
    });
  } catch (error) {
    console.error('Error fetching provider profile:', error);
    next(error);
  }
});

/**
 * PUT /api/provider-profiles/:id
 * Update provider profile information
 */
router.put('/:id', optionalAuth, async (req, res, next) => {
  try {
    const providerId = parseInt(req.params.id);
    const user = req.user;
    
    if (isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    
    // Check if user can update this profile
    if (user && user.user_id !== providerId && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const oldProvider = await prisma.users.findUnique({
      where: { user_id: providerId }
    });
    
    if (!oldProvider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    const {
      full_name,
      email,
      phone,
      assigned_barangay,
      is_active
    } = req.body;
    
    const updateData = {
      updated_at: new Date()
    };
    
    if (full_name) updateData.full_name = full_name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (assigned_barangay) updateData.assigned_barangay = assigned_barangay;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    const provider = await prisma.users.update({
      where: { user_id: providerId },
      data: updateData,
      include: {
        provider_availability: {
          orderBy: { day_of_week: 'asc' }
        },
        provider_specializations: {
          orderBy: { is_primary: 'desc' }
        }
      }
    });
    
    // Log audit
    await logAudit({
      tableName: 'users',
      recordId: providerId,
      action: 'UPDATE',
      oldValues: oldProvider,
      newValues: provider,
      walletAddress: req.headers['x-wallet-address'] || null,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });
    
    res.json({
      success: true,
      data: provider,
      message: 'Provider profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating provider profile:', error);
    next(error);
  }
});

/**
 * POST /api/provider-profiles/:id/availability
 * Add or update provider availability for a day
 */
router.post('/:id/availability', optionalAuth, async (req, res, next) => {
  try {
    const providerId = parseInt(req.params.id);
    const user = req.user;
    
    if (isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    
    // Check permissions
    if (user && user.user_id !== providerId && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const {
      day_of_week,
      start_time,
      end_time,
      break_start_time,
      break_end_time,
      slot_duration,
      max_consultations
    } = req.body;
    
    // Validate required fields
    if (day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Missing required fields: day_of_week, start_time, end_time'
      });
    }
    
    // Validate day_of_week (0-6)
    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({
        error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)'
      });
    }
    
    // Check if provider exists
    const provider = await prisma.users.findUnique({
      where: { user_id: providerId }
    });
    
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    // Upsert availability (update if exists, create if not)
    const availability = await prisma.provider_availability.upsert({
      where: {
        provider_id_day_of_week: {
          provider_id: providerId,
          day_of_week: day_of_week
        }
      },
      update: {
        start_time,
        end_time,
        break_start_time,
        break_end_time,
        slot_duration: slot_duration || 30,
        max_consultations: max_consultations || 10,
        is_active: true, // FIX: Reactivate the record when updating
        updated_at: new Date()
      },
      create: {
        provider_id: providerId,
        day_of_week,
        start_time,
        end_time,
        break_start_time,
        break_end_time,
        slot_duration: slot_duration || 30,
        max_consultations: max_consultations || 10,
        is_active: true // Ensure new records are active
      }
    });
    
    res.json({
      success: true,
      data: availability,
      message: `Availability updated for ${getDayName(day_of_week)}`
    });
  } catch (error) {
    console.error('Error updating provider availability:', error);
    next(error);
  }
});

/**
 * DELETE /api/provider-profiles/:id/availability/:day
 * Remove provider availability for a specific day
 */
router.delete('/:id/availability/:day', optionalAuth, async (req, res, next) => {
  try {
    const providerId = parseInt(req.params.id);
    const dayOfWeek = parseInt(req.params.day);
    const user = req.user;
    
    if (isNaN(providerId) || isNaN(dayOfWeek)) {
      return res.status(400).json({ error: 'Invalid provider ID or day' });
    }
    
    // Check permissions
    if (user && user.user_id !== providerId && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Soft delete by setting is_active to false
    const availability = await prisma.provider_availability.updateMany({
      where: {
        provider_id: providerId,
        day_of_week: dayOfWeek
      },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });
    
    res.json({
      success: true,
      message: `Availability removed for ${getDayName(dayOfWeek)}`
    });
  } catch (error) {
    console.error('Error removing provider availability:', error);
    next(error);
  }
});

/**
 * POST /api/provider-profiles/:id/specializations
 * Add provider specialization
 */
router.post('/:id/specializations', optionalAuth, async (req, res, next) => {
  try {
    const providerId = parseInt(req.params.id);
    const user = req.user;
    
    if (isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    
    // Check permissions
    if (user && user.user_id !== providerId && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const {
      specialization,
      description,
      years_experience,
      is_primary
    } = req.body;
    
    if (!specialization) {
      return res.status(400).json({
        error: 'Specialization is required'
      });
    }
    
    // If setting as primary, unset other primary specializations
    if (is_primary) {
      await prisma.provider_specializations.updateMany({
        where: {
          provider_id: providerId,
          is_primary: true
        },
        data: {
          is_primary: false
        }
      });
    }
    
    const specializationRecord = await prisma.provider_specializations.create({
      data: {
        provider_id: providerId,
        specialization,
        description,
        years_experience: years_experience ? parseInt(years_experience) : null,
        is_primary: is_primary || false
      }
    });
    
    res.json({
      success: true,
      data: specializationRecord,
      message: 'Specialization added successfully'
    });
  } catch (error) {
    console.error('Error adding specialization:', error);
    next(error);
  }
});

/**
 * DELETE /api/provider-profiles/:id/specializations/:specializationId
 * Remove provider specialization
 */
router.delete('/:id/specializations/:specializationId', optionalAuth, async (req, res, next) => {
  try {
    const providerId = parseInt(req.params.id);
    const specializationId = parseInt(req.params.specializationId);
    const user = req.user;
    
    if (isNaN(providerId) || isNaN(specializationId)) {
      return res.status(400).json({ error: 'Invalid provider ID or specialization ID' });
    }
    
    // Check permissions
    if (user && user.user_id !== providerId && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const specialization = await prisma.provider_specializations.delete({
      where: {
        specialization_id: specializationId,
        provider_id: providerId
      }
    });
    
    res.json({
      success: true,
      message: 'Specialization removed successfully'
    });
  } catch (error) {
    console.error('Error removing specialization:', error);
    next(error);
  }
});

/**
 * GET /api/provider-profiles/:id/available-slots
 * Get available time slots for a provider on a specific date
 */
router.get('/:id/available-slots', async (req, res, next) => {
  try {
    const providerId = parseInt(req.params.id);
    const { date } = req.query;
    
    if (isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.getDay();
    
    // Get provider availability for this day
    const availability = await prisma.provider_availability.findFirst({
      where: {
        provider_id: providerId,
        day_of_week: dayOfWeek,
        is_active: true
      }
    });
    
    if (!availability) {
      return res.json({
        success: true,
        data: [],
        message: 'No availability set for this day'
      });
    }
    
    // Get existing consultations for this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingConsultations = await prisma.consultations.findMany({
      where: {
        OR: [
          { assigned_doctor_id: providerId },
          { assigned_nurse_id: providerId }
        ],
        scheduled_date: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          not: 'CANCELLED'
        }
      },
      select: {
        scheduled_time: true
      }
    });
    
    // Generate available time slots
    const allSlots = generateTimeSlots(
      availability.start_time,
      availability.end_time,
      availability.slot_duration,
      availability.break_start_time,
      availability.break_end_time
    );
    
    const bookedTimes = existingConsultations.map(c => c.scheduled_time);
    const availableSlots = allSlots.map(time => ({
      time,
      available: !bookedTimes.includes(time)
    }));
    
    res.json({
      success: true,
      data: availableSlots,
      availability: {
        day: getDayName(dayOfWeek),
        start_time: availability.start_time,
        end_time: availability.end_time,
        break_time: availability.break_start_time && availability.break_end_time 
          ? `${availability.break_start_time} - ${availability.break_end_time}`
          : null,
        slot_duration: availability.slot_duration,
        max_consultations: availability.max_consultations
      }
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    next(error);
  }
});

export default router;  