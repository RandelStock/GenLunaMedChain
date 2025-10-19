// prisma/seed.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // ============================================
  // STEP 1: Add MUNICIPAL enum value if not exists
  // ============================================
  console.log('Adding MUNICIPAL to Barangay enum...');
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'MUNICIPAL' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Barangay')
        ) THEN
          ALTER TYPE "Barangay" ADD VALUE 'MUNICIPAL';
          RAISE NOTICE 'Added MUNICIPAL to Barangay enum';
        ELSE
          RAISE NOTICE 'MUNICIPAL already exists in Barangay enum';
        END IF;
      END $$;
    `);
    console.log('Barangay enum updated successfully');
  } catch (error) {
    console.error('Error updating enum (may already exist):', error.message);
  }

  // ============================================
  // STEP 2: Create Barangay Health Centers
  // ============================================
  console.log('Creating barangay health centers...');
  
  const barangays = [
    { barangay: 'MUNICIPAL', center_name: 'General Luna Municipal Health Center' },
    { barangay: 'BACONG_IBABA', center_name: 'Bacong Ibaba Barangay Health Station' },
    { barangay: 'BACONG_ILAYA', center_name: 'Bacong Ilaya Barangay Health Station' },
    { barangay: 'BARANGAY_1_POBLACION', center_name: 'Barangay 1 Poblacion Health Station' },
    { barangay: 'BARANGAY_2_POBLACION', center_name: 'Barangay 2 Poblacion Health Station' },
    { barangay: 'BARANGAY_3_POBLACION', center_name: 'Barangay 3 Poblacion Health Station' },
    { barangay: 'BARANGAY_4_POBLACION', center_name: 'Barangay 4 Poblacion Health Station' },
    { barangay: 'BARANGAY_5_POBLACION', center_name: 'Barangay 5 Poblacion Health Station' },
    { barangay: 'BARANGAY_6_POBLACION', center_name: 'Barangay 6 Poblacion Health Station' },
    { barangay: 'BARANGAY_7_POBLACION', center_name: 'Barangay 7 Poblacion Health Station' },
    { barangay: 'BARANGAY_8_POBLACION', center_name: 'Barangay 8 Poblacion Health Station' },
    { barangay: 'BARANGAY_9_POBLACION', center_name: 'Barangay 9 Poblacion Health Station' },
    { barangay: 'LAVIDES', center_name: 'Lavides Barangay Health Station' },
    { barangay: 'MAGSAYSAY', center_name: 'Magsaysay Barangay Health Station' },
    { barangay: 'MALAYA', center_name: 'Malaya Barangay Health Station' },
    { barangay: 'NIEVA', center_name: 'Nieva Barangay Health Station' },
    { barangay: 'RECTO', center_name: 'Recto Barangay Health Station' },
    { barangay: 'SAN_IGNACIO_IBABA', center_name: 'San Ignacio Ibaba Barangay Health Station' },
    { barangay: 'SAN_IGNACIO_ILAYA', center_name: 'San Ignacio Ilaya Barangay Health Station' },
    { barangay: 'SAN_ISIDRO_IBABA', center_name: 'San Isidro Ibaba Barangay Health Station' },
    { barangay: 'SAN_ISIDRO_ILAYA', center_name: 'San Isidro Ilaya Barangay Health Station' },
    { barangay: 'SAN_JOSE', center_name: 'San Jose Barangay Health Station' },
    { barangay: 'SAN_NICOLAS', center_name: 'San Nicolas Barangay Health Station' },
    { barangay: 'SAN_VICENTE', center_name: 'San Vicente Barangay Health Station' },
    { barangay: 'SANTA_MARIA_IBABA', center_name: 'Santa Maria Ibaba Barangay Health Station' },
    { barangay: 'SANTA_MARIA_ILAYA', center_name: 'Santa Maria Ilaya Barangay Health Station' },
    { barangay: 'SUMILANG', center_name: 'Sumilang Barangay Health Station' },
    { barangay: 'VILLARICA', center_name: 'Villarica Barangay Health Station' }
  ];

  for (const bg of barangays) {
    await prisma.barangay_health_centers.upsert({
      where: { barangay: bg.barangay },
      update: {},
      create: {
        barangay: bg.barangay,
        center_name: bg.center_name,
        is_active: true
      }
    });
  }
  console.log(`Created ${barangays.length} barangay health centers`);

  // ============================================
  // STEP 3: Update existing medicines to have barangay
  // ============================================
  console.log('Updating existing medicines with barangay...');
  try {
    const updatedMedicines = await prisma.$executeRaw`
      UPDATE medicines 
      SET barangay = 'MUNICIPAL'::\"Barangay\"
      WHERE barangay IS NULL
    `;
    console.log(`Updated ${updatedMedicines} medicines to MUNICIPAL barangay`);
  } catch (error) {
    console.log('No existing medicines to update or column already set');
  }

  // ============================================
  // STEP 4: Seed users with real wallet addresses
  // ============================================
  console.log('Creating users from wallet addresses...');
  
  const ADMIN_WALLET = process.env.ADMIN_WALLET;
  const STAFF_SANJOSE_WALLET = process.env.STAFF_SANJOSE_WALLET;
  const STAFF_MALAYA_WALLET = process.env.STAFF_MALAYA_WALLET;
  const STAFF_SUMILANG_WALLET = process.env.STAFF_SUMILANG_WALLET;

  if (!ADMIN_WALLET || !STAFF_SANJOSE_WALLET || !STAFF_MALAYA_WALLET || !STAFF_SUMILANG_WALLET) {
    console.error('ERROR: Wallet addresses not found in .env file');
    console.error('Please set ADMIN_WALLET and STAFF wallets in your .env');
    process.exit(1);
  }

  // Create Municipal Admin
  const admin = await prisma.users.upsert({
    where: { wallet_address: ADMIN_WALLET.toLowerCase() },
    update: {},
    create: {
      wallet_address: ADMIN_WALLET.toLowerCase(),
      full_name: 'Municipal Administrator',
      email: 'admin@genlunamedchain.local',
      phone: '09171234567',
      role: 'ADMIN',
      assigned_barangay: null,
      is_active: true
    }
  });
  console.log(`Created ADMIN: ${admin.full_name} (${admin.wallet_address}) - Access: ALL BARANGAYS`);

  // Create San Jose Staff
  const staffSanJose = await prisma.users.upsert({
    where: { wallet_address: STAFF_SANJOSE_WALLET.toLowerCase() },
    update: {},
    create: {
      wallet_address: STAFF_SANJOSE_WALLET.toLowerCase(),
      full_name: 'Juan Dela Cruz',
      email: 'juan.sanjose@genlunamedchain.local',
      phone: '09171234568',
      role: 'STAFF',
      assigned_barangay: 'SAN_JOSE',
      is_active: true
    }
  });
  console.log(`Created STAFF: ${staffSanJose.full_name} (${staffSanJose.wallet_address}) - Barangay: ${staffSanJose.assigned_barangay}`);

  // Create Malaya Staff
  const staffMalaya = await prisma.users.upsert({
    where: { wallet_address: STAFF_MALAYA_WALLET.toLowerCase() },
    update: {},
    create: {
      wallet_address: STAFF_MALAYA_WALLET.toLowerCase(),
      full_name: 'Maria Santos',
      email: 'maria.malaya@genlunamedchain.local',
      phone: '09171234569',
      role: 'STAFF',
      assigned_barangay: 'MALAYA',
      is_active: true
    }
  });
  console.log(`Created STAFF: ${staffMalaya.full_name} (${staffMalaya.wallet_address}) - Barangay: ${staffMalaya.assigned_barangay}`);

  // Create Sumilang Staff
  const staffSumilang = await prisma.users.upsert({
    where: { wallet_address: STAFF_SUMILANG_WALLET.toLowerCase() },
    update: {},
    create: {
      wallet_address: STAFF_SUMILANG_WALLET.toLowerCase(),
      full_name: 'Pedro Reyes',
      email: 'pedro.sumilang@genlunamedchain.local',
      phone: '09171234570',
      role: 'STAFF',
      assigned_barangay: 'SUMILANG',
      is_active: true
    }
  });
  console.log(`Created STAFF: ${staffSumilang.full_name} (${staffSumilang.wallet_address}) - Barangay: ${staffSumilang.assigned_barangay}`);

  // ============================================
  // STEP 5: Seed Medicines with Batches
  // ============================================
  console.log('Creating medicines with stock batches...');

  const medicinesData = [
    {
      medicine_name: 'Amoxicillin 250mg Capsule',
      generic_name: 'Amoxicillin',
      medicine_type: 'Capsule',
      dosage_form: '250mg',
      strength: '250mg',
      manufacturer: 'Deemag and Chest Clinic',
      category: 'Antibiotic (Beta-lactam)',
      storage_requirements: 'Store in cool, dry place',
      description: 'Antibiotic used to treat bacterial infections. Generic amoxicillin capsule supplied by various manufacturers in the Philippines.',
      batches: [
        { batch_number: 'AMX250-2024-001', quantity: 500, unit_cost: 3.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2025-12-31') },
        { batch_number: 'AMX250-2024-002', quantity: 300, unit_cost: 3.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2026-03-31') }
      ]
    },
    {
      medicine_name: 'Amoxicillin 500mg Capsule',
      generic_name: 'Amoxicillin',
      medicine_type: 'Capsule',
      dosage_form: '500mg',
      strength: '500mg',
      manufacturer: 'Deemag and Chest Clinic',
      category: 'Antibiotic (Beta-lactam)',
      storage_requirements: 'Store in cool, dry place',
      description: 'Higher strength antibiotic capsule for treating moderate to severe bacterial infections.',
      batches: [
        { batch_number: 'AMX500-2024-001', quantity: 400, unit_cost: 5.00, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2025-11-30') }
      ]
    },
    {
      medicine_name: 'Amoxicillin 125mg/5mL Oral Suspension',
      generic_name: 'Amoxicillin',
      medicine_type: 'Syrup',
      dosage_form: '125mg/5mL',
      strength: '125mg/5mL',
      manufacturer: 'Deemag and Chest Clinic',
      category: 'Antibiotic (Beta-lactam)',
      storage_requirements: 'Store in cool place; refrigerate after reconstitution',
      description: 'Liquid antibiotic suspension for children and patients who have difficulty swallowing capsules.',
      batches: [
        { batch_number: 'AMXSYR-2024-001', quantity: 150, unit_cost: 45.00, supplier_name: 'MedSupply Inc.', expiry_date: new Date('2025-10-31') }
      ]
    },
    {
      medicine_name: 'Amoxicillin + Clavulanic Acid 500mg + 125mg Tablet',
      generic_name: 'Amoxicillin + Clavulanic Acid',
      medicine_type: 'Tablet',
      dosage_form: '500mg + 125mg',
      strength: '500mg/125mg',
      manufacturer: 'Deemag and Chest Clinic',
      category: 'Antibiotic (Combination)',
      storage_requirements: 'Store in cool, dry place; protect from moisture',
      description: 'Combination antibiotic with beta-lactamase inhibitor for resistant bacterial infections.',
      batches: [
        { batch_number: 'AMXCLAV-2024-001', quantity: 250, unit_cost: 12.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2026-01-31') }
      ]
    },
    {
      medicine_name: 'Amoxicillin + Clavulanic Acid 125mg + 31.25mg/5mL Dry Syrup',
      generic_name: 'Amoxicillin + Clavulanic Acid',
      medicine_type: 'Syrup',
      dosage_form: '125mg + 31.25mg/5mL',
      strength: '125mg/31.25mg per 5mL',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic (Combination)',
      storage_requirements: 'Store below 25°C; refrigerate after reconstitution',
      description: 'Pediatric combination antibiotic suspension for children with resistant infections.',
      batches: [
        { batch_number: 'AMXCLAVSYR-2024-001', quantity: 100, unit_cost: 85.00, supplier_name: 'MedSupply Inc.', expiry_date: new Date('2025-09-30') }
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
      storage_requirements: 'Store in cool, dry place at room temperature',
      description: 'Anti-parasitic medication used for mass deworming programs and treating intestinal worm infections.',
      batches: [
        { batch_number: 'ALB400-2024-001', quantity: 1000, unit_cost: 2.00, supplier_name: 'DOH Central Supply', expiry_date: new Date('2026-06-30') },
        { batch_number: 'ALB400-2024-002', quantity: 800, unit_cost: 2.00, supplier_name: 'DOH Central Supply', expiry_date: new Date('2026-08-31') }
      ]
    },
    {
      medicine_name: 'Albendazole 400mg Chewable Tablet',
      generic_name: 'Albendazole',
      medicine_type: 'Tablet',
      dosage_form: '400mg Chewable',
      strength: '400mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Anti-helminthic / Anti-parasitic',
      storage_requirements: 'Store in cool, dry place at room temperature',
      description: 'Chewable formulation for easier administration, especially for children in deworming programs.',
      batches: [
        { batch_number: 'ALBCHEW-2024-001', quantity: 500, unit_cost: 2.50, supplier_name: 'DOH Central Supply', expiry_date: new Date('2026-05-31') }
      ]
    },
    {
      medicine_name: 'Albendazole 200mg/5mL Oral Suspension',
      generic_name: 'Albendazole',
      medicine_type: 'Syrup',
      dosage_form: '200mg/5mL',
      strength: '200mg/5mL',
      manufacturer: 'Generic Manufacturer',
      category: 'Anti-helminthic / Anti-parasitic',
      storage_requirements: 'Store as per label; usually room temperature',
      description: 'Liquid suspension for pediatric deworming and patients unable to swallow tablets.',
      batches: [
        { batch_number: 'ALBSYR-2024-001', quantity: 200, unit_cost: 35.00, supplier_name: 'MedSupply Inc.', expiry_date: new Date('2025-12-31') }
      ]
    },
    {
      medicine_name: 'Benzathine Benzylpenicillin 600,000 Units Injection',
      generic_name: 'Benzathine Benzylpenicillin',
      medicine_type: 'Injection',
      dosage_form: 'Powder for Injection',
      strength: '600,000 Units',
      manufacturer: 'DOH-approved supplier',
      category: 'Antibiotic',
      storage_requirements: 'Store under recommended temperature; protect from moisture and heat; requires sterile conditions',
      description: 'Long-acting penicillin injection used for treating certain bacterial infections and rheumatic fever prophylaxis.',
      batches: [
        { batch_number: 'BENZ600K-2024-001', quantity: 100, unit_cost: 25.00, supplier_name: 'Hospital Pharmaceuticals', expiry_date: new Date('2026-04-30') }
      ]
    },
    {
      medicine_name: 'Benzathine Benzylpenicillin 1.2 Million Units Injection',
      generic_name: 'Benzathine Benzylpenicillin',
      medicine_type: 'Injection',
      dosage_form: 'Powder for Injection',
      strength: '1,200,000 Units',
      manufacturer: 'DOH-approved supplier',
      category: 'Antibiotic',
      storage_requirements: 'Store under recommended temperature; protect from moisture and heat; requires sterile conditions',
      description: 'Higher strength long-acting penicillin for adults and severe infections.',
      batches: [
        { batch_number: 'BENZ1.2M-2024-001', quantity: 80, unit_cost: 45.00, supplier_name: 'Hospital Pharmaceuticals', expiry_date: new Date('2026-03-31') }
      ]
    },
    {
      medicine_name: 'Benzathine Benzylpenicillin 2.4 Million Units Injection',
      generic_name: 'Benzathine Benzylpenicillin',
      medicine_type: 'Injection',
      dosage_form: 'Powder for Injection',
      strength: '2,400,000 Units',
      manufacturer: 'DOH-approved supplier',
      category: 'Antibiotic',
      storage_requirements: 'Store under recommended temperature; protect from moisture and heat; requires sterile conditions',
      description: 'Highest strength for treating syphilis and other serious bacterial infections.',
      batches: [
        { batch_number: 'BENZ2.4M-2024-001', quantity: 50, unit_cost: 75.00, supplier_name: 'Hospital Pharmaceuticals', expiry_date: new Date('2026-02-28') }
      ]
    },
    {
      medicine_name: 'Metronidazole 200mg Tablet',
      generic_name: 'Metronidazole',
      medicine_type: 'Tablet',
      dosage_form: '200mg',
      strength: '200mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic / Antiparasitic',
      storage_requirements: 'Store in cool, dry place; protect from light and moisture',
      description: 'Antibiotic and antiprotozoal medication for bacterial and parasitic infections.',
      batches: [
        { batch_number: 'MET200-2024-001', quantity: 600, unit_cost: 1.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2026-07-31') }
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
      storage_requirements: 'Store in cool, dry place; protect from light and moisture',
      description: 'Higher strength for treating severe anaerobic bacterial and protozoal infections.',
      batches: [
        { batch_number: 'MET500-2024-001', quantity: 400, unit_cost: 2.50, supplier_name: 'PharmaCare Suppliers', expiry_date: new Date('2026-06-30') }
      ]
    },
    {
      medicine_name: 'Metronidazole 200mg/5mL Oral Suspension',
      generic_name: 'Metronidazole',
      medicine_type: 'Syrup',
      dosage_form: '200mg/5mL',
      strength: '200mg/5mL',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic / Antiparasitic',
      storage_requirements: 'Store in cool, dry place; protect from light',
      description: 'Liquid formulation for pediatric use and patients with swallowing difficulties.',
      batches: [
        { batch_number: 'METSYR-2024-001', quantity: 150, unit_cost: 55.00, supplier_name: 'MedSupply Inc.', expiry_date: new Date('2025-11-30') }
      ]
    },
    {
      medicine_name: 'Metronidazole 500mg Injection',
      generic_name: 'Metronidazole',
      medicine_type: 'Injection',
      dosage_form: 'IV Solution',
      strength: '500mg/100mL',
      manufacturer: 'Generic Manufacturer',
      category: 'Antibiotic / Antiparasitic',
      storage_requirements: 'Store at controlled temperature; protect from light',
      description: 'Injectable form for severe infections requiring intravenous administration.',
      batches: [
        { batch_number: 'METINJ-2024-001', quantity: 100, unit_cost: 35.00, supplier_name: 'Hospital Pharmaceuticals', expiry_date: new Date('2026-01-31') }
      ]
    },
    {
      medicine_name: 'Amlodipine 2.5mg Tablet',
      generic_name: 'Amlodipine',
      medicine_type: 'Tablet',
      dosage_form: '2.5mg',
      strength: '2.5mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antihypertensive / Cardiovascular',
      storage_requirements: 'Store at controlled room temperature; avoid high temperatures',
      description: 'Calcium channel blocker used for treating high blood pressure and angina. Lowest strength for initial therapy.',
      batches: [
        { batch_number: 'AML2.5-2024-001', quantity: 500, unit_cost: 1.00, supplier_name: 'CardioMed Supply', expiry_date: new Date('2026-09-30') }
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
      storage_requirements: 'Store at controlled room temperature; avoid high temperatures',
      description: 'Standard maintenance dose for hypertension management. Most commonly prescribed strength.',
      batches: [
        { batch_number: 'AML5-2024-001', quantity: 800, unit_cost: 1.50, supplier_name: 'CardioMed Supply', expiry_date: new Date('2026-10-31') },
        { batch_number: 'AML5-2024-002', quantity: 600, unit_cost: 1.50, supplier_name: 'CardioMed Supply', expiry_date: new Date('2026-12-31') }
      ]
    },
    {
      medicine_name: 'Amlodipine 10mg Tablet',
      generic_name: 'Amlodipine',
      medicine_type: 'Tablet',
      dosage_form: '10mg',
      strength: '10mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Antihypertensive / Cardiovascular',
      storage_requirements: 'Store at controlled room temperature; avoid high temperatures',
      description: 'Maximum strength for patients requiring higher doses for blood pressure control.',
      batches: [
        { batch_number: 'AML10-2024-001', quantity: 400, unit_cost: 2.00, supplier_name: 'CardioMed Supply', expiry_date: new Date('2026-08-31') }
      ]
    },
    {
      medicine_name: 'Warfarin Sodium 1mg Tablet',
      generic_name: 'Warfarin Sodium',
      medicine_type: 'Tablet',
      dosage_form: '1mg',
      strength: '1mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Anticoagulant',
      storage_requirements: 'Store in cool, dry place; keep packaging tight',
      description: 'Blood thinner used to prevent blood clots. Lowest strength for precise dosing adjustment.',
      batches: [
        { batch_number: 'WAR1-2024-001', quantity: 300, unit_cost: 3.00, supplier_name: 'Hospital Pharmaceuticals', expiry_date: new Date('2026-05-31') }
      ]
    },
    {
      medicine_name: 'Warfarin Sodium 2.5mg Tablet',
      generic_name: 'Warfarin Sodium',
      medicine_type: 'Tablet',
      dosage_form: '2.5mg',
      strength: '2.5mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Anticoagulant',
      storage_requirements: 'Store in cool, dry place; keep packaging tight',
      description: 'Mid-range strength for maintenance anticoagulation therapy.',
      batches: [
        { batch_number: 'WAR2.5-2024-001', quantity: 250, unit_cost: 3.50, supplier_name: 'Hospital Pharmaceuticals', expiry_date: new Date('2026-04-30') }
      ]
    },
    {
      medicine_name: 'Warfarin Sodium 5mg Tablet',
      generic_name: 'Warfarin Sodium',
      medicine_type: 'Tablet',
      dosage_form: '5mg',
      strength: '5mg',
      manufacturer: 'Generic Manufacturer',
      category: 'Anticoagulant',
      storage_requirements: 'Store in cool, dry place; keep packaging tight',
      description: 'Common maintenance dose for patients on long-term anticoagulation therapy.',
      batches: [
        { batch_number: 'WAR5-2024-001', quantity: 300, unit_cost: 4.00, supplier_name: 'Hospital Pharmaceuticals', expiry_date: new Date('2026-03-31') }
      ]
    }
  ];

  let totalMedicines = 0;
  let totalBatches = 0;


  for (const medData of medicinesData) {
    const { batches, ...medicineInfo } = medData;
    
    try {
      // Create medicine using correct table name from schema
      const medicine = await prisma.medicine_records.create({
        data: {
          ...medicineInfo,
          barangay: 'MUNICIPAL',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      totalMedicines++;

      // Create batches for this medicine using correct table name
      for (const batchData of batches) {
        await prisma.medicine_stocks.create({
          data: {
            medicine_id: medicine.medicine_id,
            batch_number: batchData.batch_number,
            quantity: batchData.quantity,
            remaining_quantity: batchData.quantity, // Initially, remaining = total
            unit_cost: batchData.unit_cost,
            total_cost: batchData.unit_cost * batchData.quantity,
            supplier_name: batchData.supplier_name,
            date_received: new Date(),
            expiry_date: batchData.expiry_date,
            storage_location: 'Rural Health Unit',
            is_active: true,
            created_at: new Date()
          }
        });
        totalBatches++;
      }

      console.log(`✓ Created: ${medicine.medicine_name} (${batches.length} batches)`);
    } catch (error) {
      console.error(`✗ Error creating medicine: ${medData.medicine_name}`);
      console.error(error.message);
    }
  }

  console.log(`\nCreated ${totalMedicines} medicines with ${totalBatches} total batches`);

  console.log('');
  console.log('========================================');
  console.log('Database seeding completed successfully!');
  console.log('========================================');
  console.log('');
  console.log('Summary:');
  console.log('- MUNICIPAL enum value added');
  console.log(`- ${barangays.length} barangay health centers created`);
  console.log('- Existing medicines updated');
  console.log(`- ${totalMedicines} new medicines created`);
  console.log(`- ${totalBatches} stock batches created`);
  console.log('- 4 users created:');
  console.log('');
  console.log('  1. ADMIN - Municipal Administrator');
  console.log(`     ${ADMIN_WALLET}`);
  console.log('     Can access: ALL 27 BARANGAYS');
  console.log('');
  console.log('  2. STAFF - Juan Dela Cruz (San Jose)');
  console.log(`     ${STAFF_SANJOSE_WALLET}`);
  console.log('     Can access: SAN_JOSE only');
  console.log('');
  console.log('  3. STAFF - Maria Santos (Malaya)');
  console.log(`     ${STAFF_MALAYA_WALLET}`);
  console.log('     Can access: MALAYA only');
  console.log('');
  console.log('  4. STAFF - Pedro Reyes (Sumilang)');
  console.log(`     ${STAFF_SUMILANG_WALLET}`);
  console.log('     Can access: SUMILANG only');
  console.log('');
  console.log('========================================');
  console.log('Medicine Inventory Summary:');
  console.log('========================================');
  console.log('Antibiotics:');
  console.log('  - Amoxicillin (multiple strengths & forms)');
  console.log('  - Amoxicillin + Clavulanic Acid (combination)');
  console.log('  - Benzathine Benzylpenicillin (injectable)');
  console.log('  - Metronidazole (multiple forms)');
  console.log('');
  console.log('Anti-parasitic:');
  console.log('  - Albendazole (for deworming programs)');
  console.log('');
  console.log('Cardiovascular:');
  console.log('  - Amlodipine (antihypertensive)');
  console.log('  - Warfarin (anticoagulant)');
  console.log('');
  console.log('All medicines stored at: Rural Health Unit');
  console.log('All medicines assigned to: MUNICIPAL barangay');
  console.log('');
  console.log('Ready to test the system!');
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