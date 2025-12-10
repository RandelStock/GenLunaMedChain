// prisma/seed-provider-data.js
// Seeds provider availability and specializations
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const specializations = [
  { name: 'Internal Medicine', experience: 10 },
  { name: 'Pediatrics', experience: 8 },
  { name: 'Obstetrics and Gynecology', experience: 12 },
  { name: 'Family Medicine', experience: 15 },
  { name: 'Cardiology', experience: 7 },
  { name: 'Endocrinology', experience: 9 },
  { name: 'Pulmonology', experience: 6 },
  { name: 'Dermatology', experience: 5 },
  { name: 'General Surgery', experience: 11 },
  { name: 'Orthopedics', experience: 8 }
];

// Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
const weekdaySchedules = [
  { day: 1, start: '08:00', end: '17:00', break_start: '12:00', break_end: '13:00' }, // Monday
  { day: 2, start: '08:00', end: '17:00', break_start: '12:00', break_end: '13:00' }, // Tuesday
  { day: 3, start: '08:00', end: '17:00', break_start: '12:00', break_end: '13:00' }, // Wednesday
  { day: 4, start: '08:00', end: '17:00', break_start: '12:00', break_end: '13:00' }, // Thursday
  { day: 5, start: '08:00', end: '17:00', break_start: '12:00', break_end: '13:00' }, // Friday
];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Starting provider data seeding...');
  console.log('');

  // Get all ADMIN and STAFF users (they are the healthcare providers)
  const providers = await prisma.users.findMany({
    where: { 
      role: { in: ['ADMIN', 'STAFF'] },
      is_active: true
    }
  });

  if (providers.length === 0) {
    console.error('No provider users found. Please run seed.js first.');
    process.exit(1);
  }

  console.log(`Found ${providers.length} provider users`);
  console.log('');

  let availabilityCreated = 0;
  let specializationsCreated = 0;
  let skipped = 0;

  for (const provider of providers) {
    console.log(`Setting up provider: ${provider.full_name}`);
    
    try {
      // Create availability for weekdays
      for (const schedule of weekdaySchedules) {
        await prisma.provider_availability.create({
          data: {
            provider_id: provider.user_id,
            day_of_week: schedule.day,
            start_time: schedule.start,
            end_time: schedule.end,
            break_start_time: schedule.break_start,
            break_end_time: schedule.break_end,
            slot_duration: 30, // 30-minute consultation slots
            max_consultations: 16, // Max 16 patients per day (8 hours, 30-min slots)
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        availabilityCreated++;
      }
      console.log(`  ✓ Created ${weekdaySchedules.length} availability schedules`);

      // Assign 1-3 specializations to each provider
      const numSpecializations = randomInt(1, 3);
      const assignedSpecs = [];
      
      for (let i = 0; i < numSpecializations; i++) {
        let spec = randomElement(specializations);
        // Avoid duplicates
        while (assignedSpecs.some(s => s.name === spec.name)) {
          spec = randomElement(specializations);
        }
        assignedSpecs.push(spec);

        await prisma.provider_specializations.create({
          data: {
            provider_id: provider.user_id,
            specialization: spec.name,
            description: `Board-certified ${spec.name} specialist with extensive experience in patient care.`,
            years_experience: spec.experience,
            is_primary: i === 0, // First specialization is primary
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        specializationsCreated++;
      }
      
      console.log(`  ✓ Added ${numSpecializations} specializations: ${assignedSpecs.map(s => s.name).join(', ')}`);
      console.log('');
    } catch (error) {
      console.error(`  ✗ Error setting up provider: ${error.message}`);
      skipped++;
    }
  }

  // Get statistics
  const availabilityCount = await prisma.provider_availability.count();
  const specializationCount = await prisma.provider_specializations.count();
  
  const specializationStats = await prisma.provider_specializations.groupBy({
    by: ['specialization'],
    _count: { specialization_id: true }
  });

  console.log('========================================');
  console.log('Provider data seeding completed!');
  console.log('========================================');
  console.log('');
  console.log(`Providers configured: ${providers.length}`);
  console.log(`Availability schedules created: ${availabilityCreated}`);
  console.log(`Specializations assigned: ${specializationsCreated}`);
  console.log('');
  console.log('Schedule Details:');
  console.log('- Working days: Monday to Friday');
  console.log('- Working hours: 8:00 AM - 5:00 PM');
  console.log('- Lunch break: 12:00 PM - 1:00 PM');
  console.log('- Consultation slots: 30 minutes');
  console.log('- Max consultations per day: 16 patients');
  console.log('');
  console.log('Specialization Distribution:');
  specializationStats.sort((a, b) => b._count.specialization_id - a._count.specialization_id);
  specializationStats.forEach(stat => {
    console.log(`- ${stat.specialization}: ${stat._count.specialization_id} providers`);
  });
}

main()
  .catch((e) => {
    console.error('Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });