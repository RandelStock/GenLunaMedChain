// prisma/seed-calendar-events.js
// Seeds calendar events for health centers
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const barangays = [
  'MUNICIPAL', 'SAN_JOSE', 'MALAYA', 'SUMILANG', 'BACONG_IBABA', 
  'BACONG_ILAYA', 'BARANGAY_1_POBLACION', 'SAN_NICOLAS', 'VILLARICA'
];

const eventTemplates = [
  {
    title: 'Vaccination Drive',
    description: 'Free vaccination for children and adults. Bring your vaccination cards.',
    duration: 4, // hours
    color: '#4CAF50'
  },
  {
    title: 'Blood Pressure Screening',
    description: 'Free blood pressure check and consultation for all residents.',
    duration: 3,
    color: '#2196F3'
  },
  {
    title: 'Deworming Program',
    description: 'Mass deworming program for children aged 1-12 years.',
    duration: 3,
    color: '#FF9800'
  },
  {
    title: 'Prenatal Checkup',
    description: 'Monthly prenatal checkup for pregnant mothers. Please bring your prenatal records.',
    duration: 4,
    color: '#E91E63'
  },
  {
    title: 'Family Planning Counseling',
    description: 'Family planning services and consultation. Confidential.',
    duration: 2,
    color: '#9C27B0'
  },
  {
    title: 'Senior Citizen Wellness Program',
    description: 'Health screening and wellness activities for senior citizens.',
    duration: 3,
    color: '#795548'
  },
  {
    title: 'Nutrition Program',
    description: 'Nutrition counseling and feeding program for malnourished children.',
    duration: 3,
    color: '#CDDC39'
  },
  {
    title: 'Diabetes Screening',
    description: 'Free blood sugar testing and diabetes consultation.',
    duration: 3,
    color: '#F44336'
  },
  {
    title: 'Dental Mission',
    description: 'Free dental checkup and tooth extraction. First come, first served.',
    duration: 5,
    color: '#00BCD4'
  },
  {
    title: 'Mental Health Awareness',
    description: 'Mental health consultation and stress management workshop.',
    duration: 2,
    color: '#673AB7'
  }
];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function setTime(date, hours, minutes = 0) {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

async function main() {
  console.log('Starting calendar events seeding...');
  console.log('');

  // Get staff users for created_by
  const staffUsers = await prisma.users.findMany({
    where: { 
      role: { in: ['STAFF', 'ADMIN'] }
    }
  });

  if (staffUsers.length === 0) {
    console.error('No staff users found. Please run seed.js first.');
    process.exit(1);
  }

  console.log(`Found ${staffUsers.length} staff users`);
  console.log('');

  let created = 0;
  let skipped = 0;

  const today = new Date();
  const eventsPerBarangay = 12; // 12 events per barangay

  for (const barangay of barangays) {
    console.log(`Creating events for ${barangay}...`);
    
    for (let i = 0; i < eventsPerBarangay; i++) {
      try {
        const template = randomElement(eventTemplates);
        const staff = randomElement(staffUsers);
        
        // Random date within next 90 days
        const daysOffset = randomInt(1, 90);
        const eventDate = addDays(today, daysOffset);
        
        // Random start time between 8 AM and 2 PM
        const startHour = randomInt(8, 14);
        const startTime = setTime(eventDate, startHour);
        const endTime = new Date(startTime.getTime() + (template.duration * 60 * 60 * 1000));

        await prisma.calendar_events.create({
          data: {
            title: template.title,
            description: template.description,
            start_time: startTime,
            end_time: endTime,
            all_day: false,
            center_type: barangay === 'MUNICIPAL' ? 'RHU' : 'BARANGAY',
            barangay: barangay,
            location: barangay === 'MUNICIPAL' 
              ? 'General Luna Municipal Health Center'
              : `${barangay.replace(/_/g, ' ')} Barangay Health Station`,
            created_by_id: staff.user_id,
            color: template.color,
            is_cancelled: false,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        created++;
      } catch (error) {
        console.error(`  ✗ Error creating event: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`  ✓ Created ${eventsPerBarangay} events`);
  }

  // Get statistics
  const centerTypeStats = await prisma.calendar_events.groupBy({
    by: ['center_type'],
    _count: { event_id: true }
  });

  const upcomingEvents = await prisma.calendar_events.count({
    where: {
      start_time: { gte: new Date() },
      is_cancelled: false
    }
  });

  console.log('');
  console.log('========================================');
  console.log('Calendar events seeding completed!');
  console.log('========================================');
  console.log('');
  console.log(`Total events created: ${created}`);
  console.log(`Total skipped: ${skipped}`);
  console.log(`Upcoming events: ${upcomingEvents}`);
  console.log('');
  console.log('Distribution by Center Type:');
  centerTypeStats.forEach(stat => {
    console.log(`- ${stat.center_type}: ${stat._count.event_id} events`);
  });
  console.log('');
  console.log('Event Types:');
  console.log('- Vaccination drives');
  console.log('- Health screenings');
  console.log('- Maternal care programs');
  console.log('- Senior citizen programs');
  console.log('- Nutrition programs');
  console.log('- Mental health services');
  console.log('');
  console.log('Date Range: Next 90 days');
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