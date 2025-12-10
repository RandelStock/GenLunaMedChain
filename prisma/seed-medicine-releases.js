// prisma/seed-medicine-releases.js
// Seeds medicine release records (receipts)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Common concerns/symptoms
const concerns = [
  'Fever and body pain',
  'Cough and cold',
  'Headache',
  'Stomach ache',
  'High blood pressure maintenance',
  'Diabetes maintenance',
  'Allergic reaction',
  'Skin infection',
  'Respiratory infection',
  'Urinary tract infection',
  'Bacterial infection',
  'Wound care',
  'Hypertension control',
  'Asthma management',
  'Deworming program',
  'General checkup',
  'Follow-up consultation',
  'Prenatal care',
  'Pediatric consultation',
  'Senior citizen maintenance'
];

// Doctor names
const doctors = [
  'Dr. Maria Santos',
  'Dr. Juan Dela Cruz',
  'Dr. Pedro Reyes',
  'Dr. Carmen Garcia',
  'Dr. Antonio Lopez',
  'Dr. Elena Fernandez',
  'Dr. Roberto Morales',
  'Dr. Rosa Aquino',
  'Dr. Luis Torres',
  'Dr. Sofia Ramos'
];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log('Starting medicine releases seeding...');
  console.log('');

  // Get all active stocks with their medicines
  const stocks = await prisma.medicine_stocks.findMany({
    where: {
      is_active: true,
      remaining_quantity: { gt: 0 }
    },
    include: {
      medicine: true
    }
  });

  if (stocks.length === 0) {
    console.error('No active stocks found. Please run seed.js or seed-barangay.js first.');
    process.exit(1);
  }

  // Get some residents
  const residents = await prisma.residents.findMany({
    where: { is_active: true },
    take: 200 // Use subset of residents
  });

  if (residents.length === 0) {
    console.error('No residents found. Please run seed-resident.js first.');
    process.exit(1);
  }

  // Get staff users for released_by
  const staffUsers = await prisma.users.findMany({
    where: { 
      role: { in: ['STAFF', 'ADMIN'] }
    }
  });

  console.log(`Found ${stocks.length} stocks with available quantity`);
  console.log(`Found ${residents.length} residents`);
  console.log(`Found ${staffUsers.length} staff users`);
  console.log('');

  let created = 0;
  let skipped = 0;
  const releasesToCreate = 150; // Create 150 medicine releases

  // Date range: last 6 months
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  for (let i = 0; i < releasesToCreate; i++) {
    try {
      const stock = randomElement(stocks);
      const resident = randomElement(residents);
      const staff = randomElement(staffUsers);
      
      // Random quantity between 1-10 (or max available)
      const maxRelease = Math.min(10, stock.remaining_quantity);
      if (maxRelease <= 0) continue;
      
      const quantity = randomInt(1, maxRelease);
      const releaseDate = randomDate(startDate, endDate);

      await prisma.medicine_releases.create({
        data: {
          medicine_id: stock.medicine_id,
          stock_id: stock.stock_id,
          resident_id: resident.resident_id,
          resident_name: resident.full_name || `${resident.first_name} ${resident.last_name}`,
          resident_age: resident.age,
          concern: randomElement(concerns),
          quantity_released: quantity,
          notes: `Released to ${resident.full_name || resident.first_name} for treatment`,
          date_released: releaseDate,
          prescription_number: `RX-${new Date().getFullYear()}-${String(i + 1).padStart(6, '0')}`,
          prescribing_doctor: randomElement(doctors),
          dosage_instructions: `Take ${randomElement(['1', '2', '1-2'])} ${randomElement(['tablet(s)', 'capsule(s)', 'dose(s)'])} ${randomElement(['once', 'twice', 'three times'])} daily ${randomElement(['after meals', 'before meals', 'as needed'])}`,
          released_by_wallet: staff.wallet_address,
          released_by_user_id: staff.user_id,
          created_at: releaseDate
        }
      });

      // Update stock remaining quantity
      await prisma.medicine_stocks.update({
        where: { stock_id: stock.stock_id },
        data: {
          remaining_quantity: { decrement: quantity }
        }
      });

      // Update stock object for next iteration
      stock.remaining_quantity -= quantity;

      if ((i + 1) % 20 === 0) {
        console.log(`Progress: ${i + 1}/${releasesToCreate} releases created`);
      }

      created++;
    } catch (error) {
      console.error(`✗ Error creating release ${i + 1}: ${error.message}`);
      skipped++;
    }
  }

  console.log('');
  console.log('========================================');
  console.log('Medicine releases seeding completed!');
  console.log('========================================');
  console.log('');
  console.log(`Total releases created: ${created}`);
  console.log(`Total skipped: ${skipped}`);
  console.log('');
  console.log('Release Details:');
  console.log(`- Date range: Last 6 months`);
  console.log(`- Quantities: 1-10 units per release`);
  console.log(`- All releases linked to residents`);
  console.log(`- Prescription numbers generated`);
  console.log(`- Stock quantities updated`);
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