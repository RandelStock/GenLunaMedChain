// backend/scripts/seedProviders.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleProviders = [
  {
    wallet_address: '0x1234567890123456789012345678901234567890',
    full_name: 'Dr. Maria Santos',
    email: 'maria.santos@genluna.gov.ph',
    phone: '+63 912 345 6789',
    role: 'ADMIN',
    assigned_barangay: 'BARANGAY_1_POBLACION',
    specializations: [
      {
        specialization: 'General Medicine',
        description: 'Primary care physician with expertise in general medicine',
        years_experience: 8,
        is_primary: true
      },
      {
        specialization: 'Emergency Medicine',
        description: 'Emergency care and urgent medical situations',
        years_experience: 5,
        is_primary: false
      }
    ]
  },
  {
    wallet_address: '0x2345678901234567890123456789012345678901',
    full_name: 'Dr. Juan Dela Cruz',
    email: 'juan.delacruz@genluna.gov.ph',
    phone: '+63 923 456 7890',
    role: 'ADMIN',
    assigned_barangay: 'BACONG_IBABA',
    specializations: [
      {
        specialization: 'Pediatrics',
        description: 'Specialized in child healthcare and development',
        years_experience: 12,
        is_primary: true
      }
    ]
  },
  {
    wallet_address: '0x3456789012345678901234567890123456789012',
    full_name: 'Nurse Ana Rodriguez',
    email: 'ana.rodriguez@genluna.gov.ph',
    phone: '+63 934 567 8901',
    role: 'MUNICIPAL_STAFF',
    assigned_barangay: 'SAN_IGNACIO_IBABA',
    specializations: [
      {
        specialization: 'Community Health Nursing',
        description: 'Community health and preventive care',
        years_experience: 6,
        is_primary: true
      },
      {
        specialization: 'Emergency Nursing',
        description: 'Emergency and critical care nursing',
        years_experience: 4,
        is_primary: false
      }
    ]
  },
  {
    wallet_address: '0x4567890123456789012345678901234567890123',
    full_name: 'Dr. Roberto Garcia',
    email: 'roberto.garcia@genluna.gov.ph',
    phone: '+63 945 678 9012',
    role: 'ADMIN',
    assigned_barangay: 'LAVIDES',
    specializations: [
      {
        specialization: 'Internal Medicine',
        description: 'Specialized in internal medicine and chronic diseases',
        years_experience: 15,
        is_primary: true
      },
      {
        specialization: 'Geriatrics',
        description: 'Specialized care for elderly patients',
        years_experience: 8,
        is_primary: false
      }
    ]
  },
  {
    wallet_address: '0x5678901234567890123456789012345678901234',
    full_name: 'Nurse Carmen Lopez',
    email: 'carmen.lopez@genluna.gov.ph',
    phone: '+63 956 789 0123',
    role: 'MUNICIPAL_STAFF',
    assigned_barangay: 'MAGSAYSAY',
    specializations: [
      {
        specialization: 'Medical-Surgical Nursing',
        description: 'Medical and surgical patient care',
        years_experience: 10,
        is_primary: true
      }
    ]
  }
];

const sampleAvailability = [
  // Dr. Maria Santos - Monday to Friday, 8 AM to 5 PM
  { day_of_week: 1, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 15 },
  { day_of_week: 2, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 15 },
  { day_of_week: 3, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 15 },
  { day_of_week: 4, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 15 },
  { day_of_week: 5, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 15 },

  // Dr. Juan Dela Cruz - Monday to Saturday, 9 AM to 6 PM
  { day_of_week: 1, start_time: '09:00', end_time: '18:00', break_start_time: '12:30', break_end_time: '13:30', slot_duration: 45, max_consultations: 12 },
  { day_of_week: 2, start_time: '09:00', end_time: '18:00', break_start_time: '12:30', break_end_time: '13:30', slot_duration: 45, max_consultations: 12 },
  { day_of_week: 3, start_time: '09:00', end_time: '18:00', break_start_time: '12:30', break_end_time: '13:30', slot_duration: 45, max_consultations: 12 },
  { day_of_week: 4, start_time: '09:00', end_time: '18:00', break_start_time: '12:30', break_end_time: '13:30', slot_duration: 45, max_consultations: 12 },
  { day_of_week: 5, start_time: '09:00', end_time: '18:00', break_start_time: '12:30', break_end_time: '13:30', slot_duration: 45, max_consultations: 12 },
  { day_of_week: 6, start_time: '09:00', end_time: '18:00', break_start_time: '12:30', break_end_time: '13:30', slot_duration: 45, max_consultations: 12 },

  // Nurse Ana Rodriguez - Monday to Friday, 7 AM to 4 PM
  { day_of_week: 1, start_time: '07:00', end_time: '16:00', break_start_time: '11:30', break_end_time: '12:30', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 2, start_time: '07:00', end_time: '16:00', break_start_time: '11:30', break_end_time: '12:30', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 3, start_time: '07:00', end_time: '16:00', break_start_time: '11:30', break_end_time: '12:30', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 4, start_time: '07:00', end_time: '16:00', break_start_time: '11:30', break_end_time: '12:30', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 5, start_time: '07:00', end_time: '16:00', break_start_time: '11:30', break_end_time: '12:30', slot_duration: 30, max_consultations: 18 },

  // Dr. Roberto Garcia - Tuesday to Saturday, 8:30 AM to 5:30 PM
  { day_of_week: 2, start_time: '08:30', end_time: '17:30', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 3, start_time: '08:30', end_time: '17:30', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 4, start_time: '08:30', end_time: '17:30', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 5, start_time: '08:30', end_time: '17:30', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 6, start_time: '08:30', end_time: '17:30', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },

  // Nurse Carmen Lopez - Monday to Friday, 8 AM to 5 PM
  { day_of_week: 1, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 2, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 3, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 4, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 },
  { day_of_week: 5, start_time: '08:00', end_time: '17:00', break_start_time: '12:00', break_end_time: '13:00', slot_duration: 30, max_consultations: 18 }
];

async function seedProviders() {
  try {
    console.log('🌱 Starting provider seeding...');

    // Clear existing providers (optional - remove if you want to keep existing data)
    // await prisma.provider_specializations.deleteMany();
    // await prisma.provider_availability.deleteMany();
    // await prisma.users.deleteMany({
    //   where: {
    //     role: {
    //       in: ['ADMIN', 'MUNICIPAL_STAFF']
    //     }
    //   }
    // });

    for (let i = 0; i < sampleProviders.length; i++) {
      const providerData = sampleProviders[i];
      
      // Check if provider already exists
      const existingProvider = await prisma.users.findUnique({
        where: { wallet_address: providerData.wallet_address }
      });

      if (existingProvider) {
        console.log(`⚠️  Provider ${providerData.full_name} already exists, skipping...`);
        continue;
      }

      // Create provider
      const provider = await prisma.users.create({
        data: {
          wallet_address: providerData.wallet_address,
          full_name: providerData.full_name,
          email: providerData.email,
          phone: providerData.phone,
          role: providerData.role,
          assigned_barangay: providerData.assigned_barangay,
          is_active: true
        }
      });

      console.log(`✅ Created provider: ${provider.full_name}`);

      // Add specializations
      for (const spec of providerData.specializations) {
        await prisma.provider_specializations.create({
          data: {
            provider_id: provider.user_id,
            specialization: spec.specialization,
            description: spec.description,
            years_experience: spec.years_experience,
            is_primary: spec.is_primary
          }
        });
      }

      console.log(`✅ Added ${providerData.specializations.length} specializations for ${provider.full_name}`);

      // Add availability (use the same availability pattern for each provider)
      const availabilityPattern = sampleAvailability.slice(i * 5, (i + 1) * 5);
      for (const avail of availabilityPattern) {
        await prisma.provider_availability.create({
          data: {
            provider_id: provider.user_id,
            day_of_week: avail.day_of_week,
            start_time: avail.start_time,
            end_time: avail.end_time,
            break_start_time: avail.break_start_time,
            break_end_time: avail.break_end_time,
            slot_duration: avail.slot_duration,
            max_consultations: avail.max_consultations,
            is_active: true
          }
        });
      }

      console.log(`✅ Added availability schedule for ${provider.full_name}`);
    }

    console.log('🎉 Provider seeding completed successfully!');
    console.log('\n📋 Created Providers:');
    console.log('   👨‍⚕️  Dr. Maria Santos - General Medicine, Emergency Medicine');
    console.log('   👨‍⚕️  Dr. Juan Dela Cruz - Pediatrics');
    console.log('   👩‍⚕️  Nurse Ana Rodriguez - Community Health, Emergency Nursing');
    console.log('   👨‍⚕️  Dr. Roberto Garcia - Internal Medicine, Geriatrics');
    console.log('   👩‍⚕️  Nurse Carmen Lopez - Medical-Surgical Nursing');
    console.log('\n💡 You can now:');
    console.log('   1. Navigate to Provider Management in the sidebar');
    console.log('   2. Edit provider profiles and availability');
    console.log('   3. Use the consultation booking system');

  } catch (error) {
    console.error('❌ Error seeding providers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedProviders();
