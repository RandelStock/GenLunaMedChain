// prisma/reset-neon.js
// Script to safely reset Neon database data
import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function deleteAllData() {
  console.log('Starting database cleanup...\n');

  const tables = [
    'blockchain_transactions',
    'stock_transactions',
    'medicine_releases',
    'stock_removals',
    'consultations',
    'calendar_events',
    'provider_availability',
    'provider_specializations',
    'audit_logs',
    'residents',
    'medicine_stocks',
    'medicines',
    'suppliers',
    'users',
    'barangay_health_centers',
    'sync_status'
  ];

  let deleted = 0;
  
  for (const table of tables) {
    try {
      const result = await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`✓ Cleared: ${table}`);
      deleted++;
    } catch (error) {
      console.error(`✗ Error clearing ${table}: ${error.message}`);
    }
  }

  console.log(`\n${deleted}/${tables.length} tables cleared successfully.\n`);
}

async function resetSequences() {
  console.log('Resetting ID sequences...\n');

  const sequences = [
    { table: 'users', column: 'user_id' },
    { table: 'medicines', column: 'medicine_id' },
    { table: 'stocks', column: 'stock_id' },
    { table: 'suppliers', column: 'supplier_id' },
    { table: 'residents', column: 'resident_id' },
    { table: 'receipts', column: 'release_id' },
    { table: 'stock_removals', column: 'removal_id' },
    { table: 'consultations', column: 'consultation_id' },
    { table: 'calendar_events', column: 'event_id' },
    { table: 'blockchain_transactions', column: 'transaction_id' },
    { table: 'audit_logs', column: 'audit_id' }
  ];

  for (const seq of sequences) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER SEQUENCE "${seq.table}_${seq.column}_seq" RESTART WITH 1;`
      );
      console.log(`✓ Reset sequence: ${seq.table}_${seq.column}_seq`);
    } catch (error) {
      // Sequence might not exist, that's okay
      console.log(`  Skipped: ${seq.table}_${seq.column}_seq`);
    }
  }

  console.log('\nSequences reset complete.\n');
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          NEON DATABASE RESET UTILITY                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('⚠️  WARNING: This will DELETE ALL DATA from your database!');
  console.log('   - All tables will be cleared');
  console.log('   - ID sequences will be reset');
  console.log('   - This action CANNOT be undone');
  console.log('');
  console.log(`Database: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
  console.log('');

  const answer = await question('Are you ABSOLUTELY sure you want to continue? (type "YES" to confirm): ');

  if (answer !== 'YES') {
    console.log('\n✗ Reset cancelled. No changes were made.\n');
    rl.close();
    process.exit(0);
  }

  console.log('\n🗑️  Proceeding with database reset...\n');

  try {
    // Delete all data
    await deleteAllData();

    // Reset sequences
    await resetSequences();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          DATABASE RESET COMPLETED SUCCESSFULLY!            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('Next steps:');
    console.log('  1. Run: npm run seed:all');
    console.log('  2. Or run individual seeds as needed\n');

  } catch (error) {
    console.error('\n✗ Error during reset:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();