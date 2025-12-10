// prisma/seed-stock-removals.js
// Seeds stock removal records
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const removalReasons = ['EXPIRED', 'ENTRY_ERROR', 'DAMAGED', 'LOST', 'OTHER'];

const removalNotes = {
  EXPIRED: [
    'Medicine expired, removed from inventory',
    'Batch expired as of expiry date',
    'Expired medication disposed following protocol',
    'Removed expired stock for proper disposal'
  ],
  ENTRY_ERROR: [
    'Incorrect quantity entry, adjusting records',
    'Data entry mistake corrected',
    'Wrong batch number entered initially',
    'Duplicate entry removed'
  ],
  DAMAGED: [
    'Damaged during storage - water exposure',
    'Packaging compromised, contents damaged',
    'Medicine bottles broken during handling',
    'Tablets crushed/broken, unusable'
  ],
  LOST: [
    'Missing from inventory count',
    'Could not locate during audit',
    'Unaccounted for after stocktaking',
    'Lost during facility relocation'
  ],
  OTHER: [
    'Quality control issue detected',
    'Recall by manufacturer',
    'Changed to different supplier',
    'Returned to supplier - quality issue'
  ]
};

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
  console.log('Starting stock removals seeding...');
  console.log('');

  // Get all stocks
  const stocks = await prisma.medicine_stocks.findMany({
    where: { is_active: true },
    include: { medicine: true }
  });

  if (stocks.length === 0) {
    console.error('No stocks found. Please run seed.js or seed-barangay.js first.');
    process.exit(1);
  }

  // Get staff users
  const staffUsers = await prisma.users.findMany({
    where: { 
      role: { in: ['STAFF', 'ADMIN'] }
    }
  });

  if (staffUsers.length === 0) {
    console.error('No staff users found. Please run seed.js first.');
    process.exit(1);
  }

  console.log(`Found ${stocks.length} stocks`);
  console.log(`Found ${staffUsers.length} staff users`);
  console.log('');

  let created = 0;
  let skipped = 0;
  const removalsToCreate = 30; // Create 30 removal records

  // Date range: last 6 months
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  for (let i = 0; i < removalsToCreate; i++) {
    try {
      const stock = randomElement(stocks);
      const staff = randomElement(staffUsers);
      const reason = randomElement(removalReasons);
      
      // Remove small quantities (1-20 units)
      const maxRemoval = Math.min(20, Math.floor(stock.remaining_quantity * 0.1));
      if (maxRemoval <= 0) continue;
      
      const quantity = randomInt(1, maxRemoval);
      const removalDate = randomDate(startDate, endDate);
      const notes = randomElement(removalNotes[reason]);

      await prisma.stock_removals.create({
        data: {
          stock_id: stock.stock_id,
          medicine_id: stock.medicine_id,
          quantity_removed: quantity,
          reason: reason,
          notes: notes,
          date_removed: removalDate,
          removed_by_wallet: staff.wallet_address,
          removed_by_user_id: staff.user_id,
          created_at: removalDate
        }
      });

      // Update stock remaining quantity
      await prisma.medicine_stocks.update({
        where: { stock_id: stock.stock_id },
        data: {
          remaining_quantity: { decrement: quantity }
        }
      });

      console.log(`✓ Created removal: ${stock.medicine.medicine_name} - ${reason} (${quantity} units)`);
      created++;
    } catch (error) {
      console.error(`✗ Error creating removal ${i + 1}: ${error.message}`);
      skipped++;
    }
  }

  // Get removal statistics
  const removalStats = await prisma.stock_removals.groupBy({
    by: ['reason'],
    _count: { removal_id: true },
    _sum: { quantity_removed: true }
  });

  console.log('');
  console.log('========================================');
  console.log('Stock removals seeding completed!');
  console.log('========================================');
  console.log('');
  console.log(`Total removals created: ${created}`);
  console.log(`Total skipped: ${skipped}`);
  console.log('');
  console.log('Removal Statistics by Reason:');
  removalStats.forEach(stat => {
    console.log(`- ${stat.reason}: ${stat._count.removal_id} removals, ${stat._sum.quantity_removed} units total`);
  });
  console.log('');
  console.log('Note: Stock quantities have been adjusted accordingly');
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