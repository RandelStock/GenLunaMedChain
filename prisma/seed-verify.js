// prisma/verify-residents.js
// This script verifies the resident data in the database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const barangays = [
  'BACONG_IBABA',
  'BACONG_ILAYA',
  'BARANGAY_1_POBLACION',
  'BARANGAY_2_POBLACION',
  'BARANGAY_3_POBLACION',
  'BARANGAY_4_POBLACION',
  'BARANGAY_5_POBLACION',
  'BARANGAY_6_POBLACION',
  'BARANGAY_7_POBLACION',
  'BARANGAY_8_POBLACION',
  'BARANGAY_9_POBLACION',
  'LAVIDES',
  'MAGSAYSAY',
  'MALAYA',
  'NIEVA',
  'RECTO',
  'SAN_IGNACIO_IBABA',
  'SAN_IGNACIO_ILAYA',
  'SAN_ISIDRO_IBABA',
  'SAN_ISIDRO_ILAYA',
  'SAN_JOSE',
  'SAN_NICOLAS',
  'SAN_VICENTE',
  'SANTA_MARIA_IBABA',
  'SANTA_MARIA_ILAYA',
  'SUMILANG',
  'VILLARICA'
];

function formatBarangayName(barangay) {
  return barangay.replace(/_/g, ' ').replace(/POBLACION/g, 'Poblacion').replace(/IBABA/g, 'Ibaba').replace(/ILAYA/g, 'Ilaya');
}

async function main() {
  console.log('Verifying Resident Data in Database');
  console.log('=====================================\n');

  const totalResidents = await prisma.residents.count();
  console.log(`Total Residents in Database: ${totalResidents}\n`);

  console.log('Barangay Breakdown:');
  console.log('-------------------\n');

  let hasIssues = false;
  const results = [];

  for (const barangay of barangays) {
    const count = await prisma.residents.count({
      where: { barangay: barangay }
    });

    const status = count === 50 ? '✓' : '✗';
    const statusColor = count === 50 ? '' : ' ⚠️  ISSUE';
    
    results.push({
      barangay: formatBarangayName(barangay),
      enum: barangay,
      count: count,
      status: status
    });

    console.log(`${status} ${formatBarangayName(barangay).padEnd(30)} : ${count} residents${statusColor}`);
    
    if (count !== 50) {
      hasIssues = true;
    }
  }

  console.log('\n=====================================');
  console.log(`Expected: ${barangays.length * 50} residents (27 barangays × 50)`);
  console.log(`Actual: ${totalResidents} residents`);
  console.log(`Difference: ${(barangays.length * 50) - totalResidents} residents`);

  if (hasIssues) {
    console.log('\n⚠️  ISSUES FOUND!');
    console.log('\nBarangays with incorrect counts:');
    results.filter(r => r.count !== 50).forEach(r => {
      console.log(`  - ${r.barangay}: ${r.count} residents (expected 50)`);
    });

    console.log('\nTo fix:');
    console.log('1. Delete all residents: npx prisma studio (delete from residents table)');
    console.log('2. Or run: npx prisma migrate reset (will reset entire database)');
    console.log('3. Then run: node prisma/seed-resident.js');
  } else {
    console.log('\n✓ All barangays have exactly 50 residents!');
  }

  console.log('\n=====================================');
  console.log('Detailed Statistics:');
  console.log('-------------------\n');

  // Get some sample statistics
  const stats = await prisma.residents.aggregate({
    _count: { resident_id: true },
    _avg: { age: true }
  });

  const fourPsCount = await prisma.residents.count({
    where: { is_4ps_member: true }
  });

  const pregnantCount = await prisma.residents.count({
    where: { is_pregnant: true }
  });

  const seniorCount = await prisma.residents.count({
    where: { is_senior_citizen: true }
  });

  const philhealthCount = await prisma.residents.count({
    where: { is_philhealth_member: true }
  });

  console.log(`Average Age: ${stats._avg.age?.toFixed(1) || 0} years`);
  console.log(`4Ps Members: ${fourPsCount} (${((fourPsCount / totalResidents) * 100).toFixed(1)}%)`);
  console.log(`Pregnant: ${pregnantCount} (${((pregnantCount / totalResidents) * 100).toFixed(1)}%)`);
  console.log(`Senior Citizens: ${seniorCount} (${((seniorCount / totalResidents) * 100).toFixed(1)}%)`);
  console.log(`PhilHealth Members: ${philhealthCount} (${((philhealthCount / totalResidents) * 100).toFixed(1)}%)`);

  console.log('\n=====================================');
}

main()