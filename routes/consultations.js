// backend/routes/consultations.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit, getIpAddress, getUserAgent } from '../utils/auditLogger.js';
import { getBarangayFilter, canModifyRecord } from '../middleware/baranggayAccess.js';
import { optionalAuth } from '../middleware/auth.js';
import { sendBookingConfirmation, sendConsultationConfirmed, sendConsultationCancelled } from '../utils/emailService.js';

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate meeting link and credentials
const generateMeetingDetails = () => {
  const meetingId = Math.random().toString(36).substring(2, 15);
  const meetingPassword = Math.random().toString(36).substring(2, 8);
  const meetingLink = `https://meet.genlunamedchain.com/${meetingId}`;
  
  return {
    meeting_link: meetingLink,
    meeting_id: meetingId,
    meeting_password: meetingPassword
  };
};

// Convert 24-hour time to 12-hour format
const formatTo12Hour = (time24) => {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minutes} ${ampm}`;
};

// Get available time slots for a given date using provider availability
const getAvailableTimeSlots = async (date, doctorId = null, nurseId = null) => {
  const appointmentDate = new Date(date);
  const dayOfWeek = appointmentDate.getDay();
  const providerId = doctorId || nurseId;
  
  if (!providerId) {
    return [];
  }
  
  // Get provider availability for this day
  const availability = await prisma.provider_availability.findFirst({
    where: {
      provider_id: parseInt(providerId),
      day_of_week: dayOfWeek,
      is_active: true
    }
  });
  
  if (!availability) {
    return [];
  }
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Get existing consultations for the date
  const existingConsultations = await prisma.consultations.findMany({
    where: {
      OR: [
        { assigned_doctor_id: parseInt(providerId) },
        { assigned_nurse_id: parseInt(providerId) }
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
  
  // Generate time slots based on provider availability
  const timeSlots = [];
  const start = new Date(`2024-01-01T${availability.start_time}:00`);
  const end = new Date(`2024-01-01T${availability.end_time}:00`);
  const breakStart = availability.break_start_time ? new Date(`2024-01-01T${availability.break_start_time}:00`) : null;
  const breakEnd = availability.break_end_time ? new Date(`2024-01-01T${availability.break_end_time}:00`) : null;
  
  // Check if the selected date is today
  const today = new Date();
  const isToday = appointmentDate.toDateString() === today.toDateString();
  const currentTime = new Date();
  
  let current = new Date(start);
  
  while (current < end) {
    const timeString = current.toTimeString().slice(0, 5);
    
    // Skip break time if it exists
    if (breakStart && breakEnd && current >= breakStart && current < breakEnd) {
      current.setMinutes(current.getMinutes() + availability.slot_duration);
      continue;
    }
    
    const isBooked = existingConsultations.some(c => c.scheduled_time === timeString);
    
    // Check if time slot has passed for today
    let isAvailable = !isBooked;
    if (isToday) {
      const slotDateTime = new Date(appointmentDate);
      slotDateTime.setHours(current.getHours(), current.getMinutes(), 0, 0);
      
      // If the time slot has passed, mark as unavailable
      if (slotDateTime <= currentTime) {
        isAvailable = false;
      }
    }
    
    timeSlots.push({
      time: formatTo12Hour(timeString),
      available: isAvailable
    });
    
    current.setMinutes(current.getMinutes() + availability.slot_duration);
  }
  
  return timeSlots;
};

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/consultations/available-doctors
 * Get available doctors for consultation with their specializations
 */
router.get('/available-doctors', async (req, res, next) => {
  try {
    const doctors = await prisma.users.findMany({
      where: {
        role: 'ADMIN', // Assuming ADMIN role includes doctors
        is_active: true
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone: true,
        assigned_barangay: true,
        provider_specializations: {
          where: { is_primary: true },
          select: {
            specialization: true,
            years_experience: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    console.error('Error fetching available doctors:', error);
    next(error);
  }
});

/**
 * GET /api/consultations/available-nurses
 * Get available nurses for consultation with their specializations
 */
router.get('/available-nurses', async (req, res, next) => {
  try {
    const nurses = await prisma.users.findMany({
      where: {
        role: 'MUNICIPAL_STAFF', // Assuming MUNICIPAL_STAFF includes nurses
        is_active: true
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone: true,
        assigned_barangay: true,
        provider_specializations: {
          where: { is_primary: true },
          select: {
            specialization: true,
            years_experience: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: nurses
    });
  } catch (error) {
    console.error('Error fetching available nurses:', error);
    next(error);
  }
});

/**
 * GET /api/consultations/available-slots
 * Get available time slots for a specific date and provider
 */
router.get('/available-slots', async (req, res, next) => {
  try {
    const { date, doctor_id, nurse_id } = req.query;
    
    if (!date) {
      return res.status(400).json({
        error: 'Date is required'
      });
    }
    
    const availableSlots = await getAvailableTimeSlots(date, doctor_id, nurse_id);
    
    res.json({
      success: true,
      data: availableSlots,
      date: date
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    next(error);
  }
});

/**
 * POST /api/consultations
 * Create a new consultation appointment
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      patient_name,
      patient_email,
      patient_phone,
      patient_age,
      patient_gender,
      patient_barangay,
      patient_address,
      chief_complaint,
      symptoms,
      medical_history,
      current_medications,
      allergies,
      consultation_type,
      scheduled_date,
      scheduled_time,
      assigned_doctor_id,
      assigned_nurse_id
    } = req.body;
    
    // Validate required fields
    if (!patient_name || !patient_phone || !chief_complaint || !scheduled_date || !scheduled_time) {
      return res.status(400).json({
        error: 'Missing required fields: patient_name, patient_phone, chief_complaint, scheduled_date, scheduled_time'
      });
    }
    
    // Convert 12-hour format back to 24-hour for validation
    const convertTo24Hour = (time12) => {
      const [time, ampm] = time12.split(' ');
      const [hours, minutes] = time.split(':');
      let hour24 = parseInt(hours);
      
      if (ampm === 'PM' && hour24 !== 12) {
        hour24 += 12;
      } else if (ampm === 'AM' && hour24 === 12) {
        hour24 = 0;
      }
      
      return `${hour24.toString().padStart(2, '0')}:${minutes}`;
    };
    
    const scheduledTime24 = convertTo24Hour(scheduled_time);
    
    // Validate scheduled date is not in the past
    const scheduledDateTime = new Date(`${scheduled_date}T${scheduledTime24}:00`);
    const now = new Date();
    
    // Allow some buffer time (5 minutes) to account for timezone differences
    const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
    
    if (scheduledDateTime < bufferTime) {
      return res.status(400).json({
        error: 'Cannot schedule consultation in the past'
      });
    }
    
    // Check if the time slot is still available
    const availableSlots = await getAvailableTimeSlots(scheduled_date, assigned_doctor_id, assigned_nurse_id);
    const selectedSlot = availableSlots.find(slot => slot.time === scheduled_time);
    
    if (!selectedSlot || !selectedSlot.available) {
      return res.status(400).json({
        error: 'Selected time slot is no longer available'
      });
    }
    
    // Generate meeting details
    const meetingDetails = generateMeetingDetails();
    
    // Auto-create or find resident based on consultation data
    let residentId = null;
    
    try {
      // First, try to find existing resident with matching phone number
      const existingResident = await prisma.residents.findFirst({
        where: {
          phone: patient_phone,
          is_active: true
        }
      });
      
      if (existingResident) {
        // Link to existing resident
        residentId = existingResident.resident_id;
        console.log(`Found existing resident ${residentId} with phone ${patient_phone}`);
      } else {
        // Create new resident with basic info from consultation
        const newResident = await prisma.residents.create({
          data: {
            first_name: patient_name.split(' ')[0] || '',
            last_name: patient_name.split(' ').slice(1).join(' ') || patient_name,
            full_name: patient_name,
            phone: patient_phone,
            barangay: patient_barangay,
            address: patient_address || '',
            gender: patient_gender || null,
            age: patient_age ? parseInt(patient_age) : null,
            is_profile_complete: false, // Mark as incomplete profile
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        
        residentId = newResident.resident_id;
        console.log(`Created new resident ${residentId} from consultation`);
      }
    } catch (residentError) {
      console.error('Error creating/finding resident:', residentError);
      // Continue with consultation creation even if resident creation fails
      // This ensures the consultation still gets created
    }
    
    // Create consultation
    const consultation = await prisma.consultations.create({
      data: {
        patient_name,
        patient_email,
        patient_phone,
        patient_age: patient_age ? parseInt(patient_age) : null,
        patient_gender,
        patient_barangay,
        patient_address,
        chief_complaint,
        symptoms,
        medical_history,
        current_medications,
        allergies,
        consultation_type: consultation_type || 'GENERAL',
        scheduled_date: scheduledDateTime,
        scheduled_time: scheduledTime24,
        assigned_doctor_id: assigned_doctor_id ? parseInt(assigned_doctor_id) : null,
        assigned_nurse_id: assigned_nurse_id ? parseInt(assigned_nurse_id) : null,
        resident_id: residentId, // Link to resident (if created/found)
        ...meetingDetails
      }
    });
    
    // Get provider details for email
    const providerId = assigned_doctor_id || assigned_nurse_id;
    let providerEmail = null;
    let providerName = 'Healthcare Provider';
    
    if (providerId) {
      const provider = await prisma.users.findUnique({
        where: { user_id: parseInt(providerId) },
        select: { email: true, full_name: true }
      });
      
      if (provider) {
        providerEmail = provider.email;
        providerName = assigned_doctor_id ? `Dr. ${provider.full_name}` : `Nurse ${provider.full_name}`;
      }
    }
    
    // Send email notifications (async - don't wait for it)
    sendBookingConfirmation(
      { ...consultation, scheduled_time: scheduled_time }, // Use 12-hour format for email
      providerEmail,
      providerName
    ).catch(err => console.error('Error sending booking confirmation emails:', err));
    
    // Log audit
    await logAudit({
      tableName: 'consultations',
      recordId: consultation.consultation_id,
      action: 'INSERT',
      newValues: consultation,
      walletAddress: req.headers['x-wallet-address'] || null,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });
    
    res.status(201).json({
      success: true,
      data: consultation,
      message: 'Consultation scheduled successfully. Confirmation emails have been sent.'
    });
  } catch (error) {
    console.error('Error creating consultation:', error);
    next(error);
  }
});

/**
 * GET /api/consultations
 * Get all consultations with optional filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const {
      status,
      patient_barangay,
      assigned_doctor_id,
      assigned_nurse_id,
      date_from,
      date_to,
      page = 1,
      limit = 20
    } = req.query;
    
    let where = { ...barangayFilter };
    
    // Apply filters
    if (status) where.status = status;
    if (patient_barangay) where.patient_barangay = patient_barangay;
    if (assigned_doctor_id) where.assigned_doctor_id = parseInt(assigned_doctor_id);
    if (assigned_nurse_id) where.assigned_nurse_id = parseInt(assigned_nurse_id);
    
    if (date_from && date_to) {
      const start = new Date(date_from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date_to);
      end.setHours(23, 59, 59, 999);
      where.scheduled_date = { gte: start, lte: end };
    } else if (date_from) {
      const start = new Date(date_from);
      start.setHours(0, 0, 0, 0);
      where.scheduled_date = { gte: start };
    } else if (date_to) {
      const end = new Date(date_to);
      end.setHours(23, 59, 59, 999);
      where.scheduled_date = { lte: end };
    }
    
    const [consultations, total] = await Promise.all([
      prisma.consultations.findMany({
        where,
        include: {
          assigned_doctor: {
            select: { full_name: true, email: true }
          },
          assigned_nurse: {
            select: { full_name: true, email: true }
          },
          resident: {
            select: { resident_id: true, full_name: true, is_profile_complete: true }
          }
        },
        orderBy: { scheduled_date: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.consultations.count({ where })
    ]);
    
    res.json({
      success: true,
      data: consultations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching consultations:', error);
    next(error);
  }
});

/**
 * GET /api/consultations/:id
 * Get single consultation by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const consultationId = parseInt(req.params.id);
    
    if (isNaN(consultationId)) {
      return res.status(400).json({ error: 'Invalid consultation ID' });
    }
    
    const consultation = await prisma.consultations.findUnique({
      where: { consultation_id: consultationId },
      include: {
        assigned_doctor: {
          select: { full_name: true, email: true, phone: true }
        },
        assigned_nurse: {
          select: { full_name: true, email: true, phone: true }
        },
        resident: {
          select: { resident_id: true, full_name: true, is_profile_complete: true }
        }
      }
    });
    
    if (!consultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    res.json({
      success: true,
      data: consultation
    });
  } catch (error) {
    console.error('Error fetching consultation:', error);
    next(error);
  }
});

/**
 * GET /api/consultations/stats/summary
 * Get consultation statistics summary
 */
router.get('/stats/summary', async (req, res, next) => {
  try {
    const user = req.user || null;
    const barangayFilter = getBarangayFilter(user);
    
    const [
      totalConsultations,
      scheduledConsultations,
      completedConsultations,
      cancelledConsultations,
      todayConsultations,
      upcomingConsultations
    ] = await Promise.all([
      prisma.consultations.count({ where: barangayFilter }),
      prisma.consultations.count({ where: { ...barangayFilter, status: 'SCHEDULED' } }),
      prisma.consultations.count({ where: { ...barangayFilter, status: 'COMPLETED' } }),
      prisma.consultations.count({ where: { ...barangayFilter, status: 'CANCELLED' } }),
      prisma.consultations.count({
        where: {
          ...barangayFilter,
          scheduled_date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      prisma.consultations.count({
        where: {
          ...barangayFilter,
          scheduled_date: { gt: new Date() },
          status: { in: ['SCHEDULED', 'CONFIRMED'] }
        }
      })
    ]);
    
    res.json({
      success: true,
      stats: {
        totalConsultations,
        scheduledConsultations,
        completedConsultations,
        cancelledConsultations,
        todayConsultations,
        upcomingConsultations
      }
    });
  } catch (error) {
    console.error('Error fetching consultation stats:', error);
    next(error);
  }
});

/**
 * PUT /api/consultations/:id
 * Update consultation status or details
 */
router.put('/:id', async (req, res, next) => {
  try {
    const consultationId = parseInt(req.params.id);
    const user = req.user || null;
    
    if (isNaN(consultationId)) {
      return res.status(400).json({ error: 'Invalid consultation ID' });
    }
    
    const oldConsultation = await prisma.consultations.findUnique({
      where: { consultation_id: consultationId }
    });
    
    if (!oldConsultation) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    const {
      status,
      consultation_notes,
      diagnosis,
      prescription,
      follow_up_required,
      follow_up_date
    } = req.body;
    
    const updateData = {};
    
    if (status) updateData.status = status;
    if (consultation_notes) updateData.consultation_notes = consultation_notes;
    if (diagnosis) updateData.diagnosis = diagnosis;
    if (prescription) updateData.prescription = prescription;
    if (follow_up_required !== undefined) updateData.follow_up_required = follow_up_required;
    if (follow_up_date) updateData.follow_up_date = new Date(follow_up_date);
    
    // Set completed_at if status is COMPLETED
    if (status === 'COMPLETED') {
      updateData.completed_at = new Date();
    }
    
    updateData.updated_at = new Date();
    
    const consultation = await prisma.consultations.update({
      where: { consultation_id: consultationId },
      data: updateData,
      include: {
        assigned_doctor: {
          select: { full_name: true, email: true }
        },
        assigned_nurse: {
          select: { full_name: true, email: true }
        }
      }
    });
    
    // Get provider name for email
    let providerName = 'Healthcare Provider';
    if (consultation.assigned_doctor) {
      providerName = `Dr. ${consultation.assigned_doctor.full_name}`;
    } else if (consultation.assigned_nurse) {
      providerName = `Nurse ${consultation.assigned_nurse.full_name}`;
    }
    
    // Send email notifications based on status change (async)
    if (status && status !== oldConsultation.status) {
      const consultationWithFormattedTime = {
        ...consultation,
        scheduled_time: formatTo12Hour(consultation.scheduled_time)
      };
      
      if (status === 'CONFIRMED') {
        sendConsultationConfirmed(consultationWithFormattedTime, providerName)
          .catch(err => console.error('Error sending confirmation email:', err));
      } else if (status === 'CANCELLED') {
        sendConsultationCancelled(consultationWithFormattedTime, providerName)
          .catch(err => console.error('Error sending cancellation email:', err));
      }
    }
    
    // Log audit
    await logAudit({
      tableName: 'consultations',
      recordId: consultationId,
      action: 'UPDATE',
      oldValues: oldConsultation,
      newValues: consultation,
      walletAddress: req.headers['x-wallet-address'] || null,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req)
    });
    
    res.json({
      success: true,
      data: consultation,
      message: 'Consultation updated successfully'
    });
  } catch (error) {
    console.error('Error updating consultation:', error);
    next(error);
  }
});



export default router;