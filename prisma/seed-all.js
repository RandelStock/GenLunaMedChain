// prisma/seed-all.js
// Master seed file that runs all seed scripts in the correct order
import { execSync } from 'child_process';

const seeds = [
  {
    name: 'Main Setup (Users, Medicines, Health Centers)',
    file: 'seed.js',
    required: true
  },
  {
    name: 'Suppliers',
    file: 'seed-suppliers.js',
    required: false
  },
  {
    name: 'Barangay-Specific Medicines',
    file: 'seed-barangay.js',
    required: false
  },
  {
    name: 'Residents',
    file: 'seed-resident.js',
    required: true
  },
  {
    name: 'Medicine Releases',
    file: 'seed-medicine-releases.js',
    required: false
  },
  {
    name: 'Stock Removals',
    file: 'seed-stock-removals.js',
    required: false
  },
  {
    name: 'Consultations',
    file: 'seed-consultations.js',
    required: false
  },
  {
    name: 'Calendar Events',
    file: 'seed-calendar-events.js',
    required: false
  },
  {
    name: 'Provider Data',
    file: 'seed-provider-data.js',
    required: false
  }
];

function runSeed(seed) {
  console.log('\n' + '='.repeat(80));
  console.log(`RUNNING: ${seed.name}`);
  console.log('='.repeat(80) + '\n');
  
  try {
    execSync(`node prisma/${seed.file}`, { stdio: 'inherit' });
    console.log(`\n✓ SUCCESS: ${seed.name}`);
    return true;
  } catch (error) {
    console.error(`\n✗ FAILED: ${seed.name}`);
    if (seed.required) {
      console.error('This is a required seed. Stopping execution.');
      process.exit(1);
    } else {
      console.error('This seed failed but is optional. Continuing...');
      return false;
    }
  }
}

async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'GENERAL LUNA MEDCHAIN DATABASE SEEDING' + ' '.repeat(19) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('\n');
  console.log('This will seed your database with comprehensive mock data.');
  console.log('');
  console.log('Seeds to run:');
  seeds.forEach((seed, index) => {
    const required = seed.required ? '[REQUIRED]' : '[OPTIONAL]';
    console.log(`  ${index + 1}. ${seed.name} ${required}`);
  });
  console.log('');
  console.log('Press Ctrl+C to cancel, or the script will start in 3 seconds...');
  console.log('');

  // Wait 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));

  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    console.log(`\n[${i + 1}/${seeds.length}] Starting: ${seed.name}...`);
    const success = runSeed(seed);
    results.push({ name: seed.name, success });
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Final summary
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(28) + 'SEEDING COMPLETE!' + ' '.repeat(33) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('');
  console.log(`Total time: ${duration} seconds`);
  console.log('');
  console.log('Results:');
  results.forEach((result, index) => {
    const status = result.success ? '✓ SUCCESS' : '✗ FAILED';
    console.log(`  ${index + 1}. ${status}: ${result.name}`);
  });
  console.log('');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`Summary: ${successCount} successful, ${failCount} failed`);
  console.log('');
  console.log('Your database is now populated with mock data!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify data: node prisma/verify-residents.js');
  console.log('  2. Start your application');
  console.log('  3. Login with one of the seeded wallet addresses');
  console.log('');
}

main()
  .catch((e) => {
    console.error('\n\nFATAL ERROR during seeding:');
    console.error(e);
    process.exit(1);
  });