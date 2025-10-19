// prisma/seed-barangay.js
// Seeds medicines for specific barangays (San Jose, Malaya, Sumilang)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting barangay-specific medicine seeding...');

  // const STAFF_SANJOSE_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  // const STAFF_MALAYA_WALLET = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
  // const STAFF_SUMILANG_WALLET = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

  const STAFF_SANJOSE_WALLET = '0xECa12401FE560Fe0025b2EF8A29f5d85F1660D75';
  const STAFF_MALAYA_WALLET = '0x29386ffB09aBF6E964F0c6D11E31B9373B34a4e8';
  const STAFF_SUMILANG_WALLET = '0x2dBbE0c3b0D3254ACc72CA30EDA0c27ae9a11c84';

  // Get user IDs for added_by tracking
  const sanjoseStaff = await prisma.users.findUnique({
    where: { wallet_address: STAFF_SANJOSE_WALLET.toLowerCase() }
  });
  const malayaStaff = await prisma.users.findUnique({
    where: { wallet_address: STAFF_MALAYA_WALLET.toLowerCase() }
  });
  const sumilangStaff = await prisma.users.findUnique({
    where: { wallet_address: STAFF_SUMILANG_WALLET.toLowerCase() }
  });

  // ============================================
  // SAN JOSE BARANGAY MEDICINES
  // ============================================
  console.log('\n========================================');
  console.log('SEEDING: SAN JOSE BARANGAY');
  console.log('========================================');

  const sanJoseMedicines = [
    {
      medicine_name: 'Paracetamol 500mg Tablet',
      generic_name: 'Paracetamol',
      medicine_type: 'Tablet',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Analgesic / Antipyretic',
      storage_requirements: 'Store in cool, dry place',
      description: 'Common pain reliever and fever reducer for general use.',
      batches: [
        { batch_number: 'PARA500-SJ-001', quantity: 1000, unit_cost: 0.50, supplier_name: 'Local Pharma Supply', expiry_date: new Date('2026-06-30') },
        { batch_number: 'PARA500-SJ-002', quantity: 800, unit_cost: 0.50, supplier_name: 'Local Pharma Supply', expiry_date: new Date('2026-08-31') }
      ]
    },
    {
      medicine_name: 'Amoxicillin 500mg Capsule',
      generic_name: 'Amoxicillin',
      medicine_type: 'Capsule',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic (Beta-lactam)',
      storage_requirements: 'Store in cool, dry place',
      description: 'Antibiotic for bacterial infections.',
      batches: [
        { batch_number: 'AMX500-SJ-001', quantity: 500, unit_cost: 5.00, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2025-12-31') }
      ]
    },
    {
      medicine_name: 'Cetirizine 10mg Tablet',
      generic_name: 'Cetirizine',
      medicine_type: 'Tablet',
      dosage_form: '10mg',
      strength: '10mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antihistamine',
      storage_requirements: 'Store at room temperature',
      description: 'Antihistamine for allergies and allergic reactions.',
      batches: [
        { batch_number: 'CET10-SJ-001', quantity: 600, unit_cost: 1.50, supplier_name: 'Local Pharma Supply', expiry_date: new Date('2026-04-30') }
      ]
    },
    {
      medicine_name: 'Ibuprofen 400mg Tablet',
      generic_name: 'Ibuprofen',
      medicine_type: 'Tablet',
      dosage_form: '400mg',
      strength: '400mg',
      manufacturer: 'Generic Manufacturer',
      category: 'NSAID / Analgesic',
      storage_requirements: 'Store in cool, dry place',
      description: 'Anti-inflammatory and pain reliever.',
      batches: [
        { batch_number: 'IBU400-SJ-001', quantity: 400, unit_cost: 2.00, supplier_name: 'MedSupply Inc.', expiry_date: new Date('2026-03-31') }
      ]
    },
    {
      medicine_name: 'Vitamin C 500mg Tablet',
      generic_name: 'Ascorbic Acid',
      medicine_type: 'Tablet',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Vitamin Supplement',
      storage_requirements: 'Store in cool, dry place',
      description: 'Vitamin C supplement for immune support.',
      batches: [
        { batch_number: 'VITC500-SJ-001', quantity: 800, unit_cost: 0.75, supplier_name: 'Vitamin Plus', expiry_date: new Date('2026-09-30') }
      ]
    },
    {
      medicine_name: 'ORS (Oral Rehydration Salts)',
      generic_name: 'Oral Rehydration Solution',
      medicine_type: 'Powder',
      dosage_form: '1 sachet',
      strength: '27.9g per sachet',
      manufacturer: 'WHO-approved',
      category: 'Rehydration',
      storage_requirements: 'Store in cool, dry place',
      description: 'For rehydration during diarrhea and dehydration.',
      batches: [
        { batch_number: 'ORS-SJ-001', quantity: 1500, unit_cost: 3.00, supplier_name: 'DOH Central Supply', expiry_date: new Date('2026-12-31') }
      ]
    }
  ];

  let sjTotal = await seedBarangayMedicines('SAN_JOSE', sanJoseMedicines, sanjoseStaff?.user_id);
  console.log(`✓ San Jose: ${sjTotal.medicines} medicines, ${sjTotal.batches} batches created`);

  // ============================================
  // MALAYA BARANGAY MEDICINES
  // ============================================
  console.log('\n========================================');
  console.log('SEEDING: MALAYA BARANGAY');
  console.log('========================================');

  const malayaMedicines = [
    {
      medicine_name: 'Paracetamol 500mg Tablet',
      generic_name: 'Paracetamol',
      medicine_type: 'Tablet',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Analgesic / Antipyretic',
      storage_requirements: 'Store in cool, dry place',
      description: 'Common pain reliever and fever reducer.',
      batches: [
        { batch_number: 'PARA500-ML-001', quantity: 900, unit_cost: 0.50, supplier_name: 'Local Pharma Supply', expiry_date: new Date('2026-07-31') }
      ]
    },
    {
      medicine_name: 'Metronidazole 500mg Tablet',
      generic_name: 'Metronidazole',
      medicine_type: 'Tablet',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic / Antiparasitic',
      storage_requirements: 'Store in cool, dry place; protect from light',
      description: 'Treatment for bacterial and parasitic infections.',
      batches: [
        { batch_number: 'MET500-ML-001', quantity: 450, unit_cost: 2.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2026-05-31') }
      ]
    },
    {
      medicine_name: 'Loperamide 2mg Capsule',
      generic_name: 'Loperamide',
      medicine_type: 'Capsule',
      dosage_form: '2mg',
      strength: '2mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Anti-diarrheal',
      storage_requirements: 'Store at room temperature',
      description: 'Treatment for acute and chronic diarrhea.',
      batches: [
        { batch_number: 'LOP2-ML-001', quantity: 300, unit_cost: 3.00, supplier_name: 'MedSupply Inc.', expiry_date: new Date('2026-06-30') }
      ]
    },
    {
      medicine_name: 'Albendazole 400mg Tablet',
      generic_name: 'Albendazole',
      medicine_type: 'Tablet',
      dosage_form: '400mg',
      strength: '400mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Anti-helminthic / Anti-parasitic',
      storage_requirements: 'Store in cool, dry place',
      description: 'Deworming medication for community programs.',
      batches: [
        { batch_number: 'ALB400-ML-001', quantity: 1200, unit_cost: 2.00, supplier_name: 'DOH Central Supply', expiry_date: new Date('2026-08-31') }
      ]
    },
    {
      medicine_name: 'Mebendazole 500mg Tablet',
      generic_name: 'Mebendazole',
      medicine_type: 'Tablet',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Anti-helminthic',
      storage_requirements: 'Store in cool, dry place',
      description: 'Alternative deworming medication.',
      batches: [
        { batch_number: 'MEB500-ML-001', quantity: 600, unit_cost: 2.50, supplier_name: 'DOH Central Supply', expiry_date: new Date('2026-07-31') }
      ]
    },
    {
      medicine_name: 'Zinc Sulfate 20mg Tablet',
      generic_name: 'Zinc Sulfate',
      medicine_type: 'Tablet',
      dosage_form: '20mg',
      strength: '20mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Mineral Supplement',
      storage_requirements: 'Store in cool, dry place',
      description: 'Zinc supplement for diarrhea management and nutrition.',
      batches: [
        { batch_number: 'ZINC20-ML-001', quantity: 500, unit_cost: 1.00, supplier_name: 'Vitamin Plus', expiry_date: new Date('2026-10-31') }
      ]
    },
    {
      medicine_name: 'Cotrimoxazole 480mg Tablet',
      generic_name: 'Sulfamethoxazole + Trimethoprim',
      medicine_type: 'Tablet',
      dosage_form: '480mg',
      strength: '400mg/80mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic (Combination)',
      storage_requirements: 'Store in cool, dry place; protect from light',
      description: 'Combination antibiotic for various infections.',
      batches: [
        { batch_number: 'COTRI480-ML-001', quantity: 400, unit_cost: 1.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2026-04-30') }
      ]
    }
  ];

  let mlTotal = await seedBarangayMedicines('MALAYA', malayaMedicines, malayaStaff?.user_id);
  console.log(`✓ Malaya: ${mlTotal.medicines} medicines, ${mlTotal.batches} batches created`);

  // ============================================
  // SUMILANG BARANGAY MEDICINES
  // ============================================
  console.log('\n========================================');
  console.log('SEEDING: SUMILANG BARANGAY');
  console.log('========================================');

  const sumilangMedicines = [
    {
      medicine_name: 'Paracetamol 500mg Tablet',
      generic_name: 'Paracetamol',
      medicine_type: 'Tablet',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Analgesic / Antipyretic',
      storage_requirements: 'Store in cool, dry place',
      description: 'Pain reliever and fever reducer.',
      batches: [
        { batch_number: 'PARA500-SM-001', quantity: 850, unit_cost: 0.50, supplier_name: 'Local Pharma Supply', expiry_date: new Date('2026-05-31') }
      ]
    },
    {
      medicine_name: 'Amoxicillin 250mg Capsule',
      generic_name: 'Amoxicillin',
      medicine_type: 'Capsule',
      dosage_form: '250mg',
      strength: '250mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic (Beta-lactam)',
      storage_requirements: 'Store in cool, dry place',
      description: 'Lower strength antibiotic for mild infections.',
      batches: [
        { batch_number: 'AMX250-SM-001', quantity: 600, unit_cost: 3.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2026-03-31') }
      ]
    },
    {
      medicine_name: 'Salbutamol 2mg Tablet',
      generic_name: 'Salbutamol',
      medicine_type: 'Tablet',
      dosage_form: '2mg',
      strength: '2mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Bronchodilator',
      storage_requirements: 'Store at room temperature',
      description: 'For asthma and respiratory conditions.',
      batches: [
        { batch_number: 'SALB2-SM-001', quantity: 300, unit_cost: 2.00, supplier_name: 'RespiCare Supplies', expiry_date: new Date('2026-06-30') }
      ]
    },
    {
      medicine_name: 'Amlodipine 5mg Tablet',
      generic_name: 'Amlodipine',
      medicine_type: 'Tablet',
      dosage_form: '5mg',
      strength: '5mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antihypertensive / Cardiovascular',
      storage_requirements: 'Store at controlled room temperature',
      description: 'For high blood pressure management.',
      batches: [
        { batch_number: 'AML5-SM-001', quantity: 500, unit_cost: 1.50, supplier_name: 'CardioMed Supply', expiry_date: new Date('2026-09-30') }
      ]
    },
    {
      medicine_name: 'Losartan 50mg Tablet',
      generic_name: 'Losartan',
      medicine_type: 'Tablet',
      dosage_form: '50mg',
      strength: '50mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antihypertensive',
      storage_requirements: 'Store in cool, dry place',
      description: 'Alternative medication for hypertension.',
      batches: [
        { batch_number: 'LOS50-SM-001', quantity: 400, unit_cost: 2.50, supplier_name: 'CardioMed Supply', expiry_date: new Date('2026-08-31') }
      ]
    },
    {
      medicine_name: 'Ferrous Sulfate 325mg Tablet',
      generic_name: 'Ferrous Sulfate',
      medicine_type: 'Tablet',
      dosage_form: '325mg',
      strength: '325mg (65mg elemental iron)',
      manufacturer: 'Generic Manufacturer',
      category: 'Iron Supplement',
      storage_requirements: 'Store in cool, dry place',
      description: 'Iron supplement for anemia prevention and treatment.',
      batches: [
        { batch_number: 'FE325-SM-001', quantity: 700, unit_cost: 0.80, supplier_name: 'Vitamin Plus', expiry_date: new Date('2026-11-30') }
      ]
    },
    {
      medicine_name: 'Multivitamins Tablet',
      generic_name: 'Multivitamin Complex',
      medicine_type: 'Tablet',
      dosage_form: '1 tablet',
      strength: 'Various',
      manufacturer: 'Generic Manufacturer',
      category: 'Vitamin Supplement',
      storage_requirements: 'Store in cool, dry place',
      description: 'Daily multivitamin for general health.',
      batches: [
        { batch_number: 'MULTI-SM-001', quantity: 600, unit_cost: 1.20, supplier_name: 'Vitamin Plus', expiry_date: new Date('2026-10-31') }
      ]
    },
    {
      medicine_name: 'Lagundi 600mg Tablet',
      generic_name: 'Vitex Negundo',
      medicine_type: 'Tablet',
      dosage_form: '600mg',
      strength: '600mg',
      manufacturer: 'Herbal Manufacturer',
      category: 'Herbal Medicine',
      storage_requirements: 'Store in cool, dry place',
      description: 'Herbal medicine for cough and asthma relief.',
      batches: [
        { batch_number: 'LAG600-SM-001', quantity: 400, unit_cost: 3.00, supplier_name: 'Herbal Remedies PH', expiry_date: new Date('2026-07-31') }
      ]
    }
  ];

  let smTotal = await seedBarangayMedicines('SUMILANG', sumilangMedicines, sumilangStaff?.user_id);
  console.log(`✓ Sumilang: ${smTotal.medicines} medicines, ${smTotal.batches} batches created`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n========================================');
  console.log('Barangay Medicine Seeding Complete!');
  console.log('========================================');
  console.log(`\nSAN JOSE Barangay:`);
  console.log(`  - ${sjTotal.medicines} medicines`);
  console.log(`  - ${sjTotal.batches} stock batches`);
  console.log(`  - Focus: General medicine, pain relief, basic antibiotics`);
  
  console.log(`\nMALAYA Barangay:`);
  console.log(`  - ${mlTotal.medicines} medicines`);
  console.log(`  - ${mlTotal.batches} stock batches`);
  console.log(`  - Focus: Anti-parasitic, deworming programs, GI health`);
  
  console.log(`\nSUMILANG Barangay:`);
  console.log(`  - ${smTotal.medicines} medicines`);
  console.log(`  - ${smTotal.batches} stock batches`);
  console.log(`  - Focus: Cardiovascular, respiratory, vitamins & herbal`);
  
  const grandTotal = {
    medicines: sjTotal.medicines + mlTotal.medicines + smTotal.medicines,
    batches: sjTotal.batches + mlTotal.batches + smTotal.batches
  };
  
  console.log(`\nGRAND TOTAL:`);
  console.log(`  - ${grandTotal.medicines} medicines across 3 barangays`);
  console.log(`  - ${grandTotal.batches} total stock batches`);
  console.log(`\nAll medicines stored at: Rural Health Unit`);
  console.log('Each barangay has its own isolated medicine inventory!\n');
}

// Helper function to seed medicines for a specific barangay
async function seedBarangayMedicines(barangay, medicinesData, staffUserId) {
  let medicinesCreated = 0;
  let batchesCreated = 0;

  for (const medData of medicinesData) {
    const { batches, ...medicineInfo } = medData;
    
    try {
      // Create medicine for the specific barangay
      const medicine = await prisma.medicine_records.create({
        data: {
          ...medicineInfo,
          barangay: barangay,
          is_active: true,
          created_by: staffUserId,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      medicinesCreated++;

      // Create batches for this medicine
      for (const batchData of batches) {
        await prisma.medicine_stocks.create({
          data: {
            medicine_id: medicine.medicine_id,
            batch_number: batchData.batch_number,
            quantity: batchData.quantity,
            remaining_quantity: batchData.quantity,
            unit_cost: batchData.unit_cost,
            total_cost: batchData.unit_cost * batchData.quantity,
            supplier_name: batchData.supplier_name,
            date_received: new Date(),
            expiry_date: batchData.expiry_date,
            storage_location: 'Rural Health Unit',
            is_active: true,
            added_by_user_id: staffUserId,
            created_at: new Date()
          }
        });
        batchesCreated++;
      }

      console.log(`  ✓ ${medicine.medicine_name}`);
    } catch (error) {
      console.error(`  ✗ Error: ${medData.medicine_name} - ${error.message}`);
    }
  }

  return { medicines: medicinesCreated, batches: batchesCreated };
}

main()
  .catch((e) => {
    console.error('Error during barangay seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });