// prisma/seed-suppliers.js
// Seeds supplier data for medicine inventory
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting suppliers seeding...');
  console.log('');

  const suppliers = [
    {
      supplier_name: 'PharmaCare Suppliers',
      contact_person: 'Roberto Santos',
      phone: '09171234567',
      email: 'roberto@pharmacare.ph',
      address: 'Unit 15, Medical Plaza Bldg., Quezon Avenue, Quezon City',
      is_active: true
    },
    {
      supplier_name: 'MedSupply Inc.',
      contact_person: 'Maria Gonzales',
      phone: '09181234568',
      email: 'maria@medsupply.ph',
      address: '45 Rizal Street, Makati City',
      is_active: true
    },
    {
      supplier_name: 'DOH Central Supply',
      contact_person: 'Juan Dela Cruz',
      phone: '09191234569',
      email: 'juan.delacruz@doh.gov.ph',
      address: 'Department of Health Building, San Lazaro Compound, Manila',
      is_active: true
    },
    {
      supplier_name: 'CardioMed Supply',
      contact_person: 'Antonio Reyes',
      phone: '09201234570',
      email: 'antonio@cardiomed.ph',
      address: '78 Medical Center Drive, Mandaluyong City',
      is_active: true
    },
    {
      supplier_name: 'Vitamin Plus',
      contact_person: 'Elena Torres',
      phone: '09211234571',
      email: 'elena@vitaminplus.ph',
      address: '32 Health Avenue, Pasig City',
      is_active: true
    },
    {
      supplier_name: 'Hospital Pharmaceuticals',
      contact_person: 'Pedro Morales',
      phone: '09221234572',
      email: 'pedro@hospharma.ph',
      address: '101 Hospital Road, Taguig City',
      is_active: true
    },
    {
      supplier_name: 'RespiCare Supplies',
      contact_person: 'Carmen Aquino',
      phone: '09231234573',
      email: 'carmen@respicare.ph',
      address: '56 Lung Center Road, Quezon City',
      is_active: true
    },
    {
      supplier_name: 'Local Pharma Supply',
      contact_person: 'Luis Fernandez',
      phone: '09241234574',
      email: 'luis@localpharma.ph',
      address: '23 Municipal Road, General Luna, Quezon',
      is_active: true
    },
    {
      supplier_name: 'Herbal Remedies PH',
      contact_person: 'Rosa Bautista',
      phone: '09251234575',
      email: 'rosa@herbalremedies.ph',
      address: '89 Natural Health Street, Laguna',
      is_active: true
    },
    {
      supplier_name: 'Generic Meds Distributor',
      contact_person: 'Miguel Ramos',
      phone: '09261234576',
      email: 'miguel@genericmeds.ph',
      address: '12 Affordable Medicine Lane, Caloocan City',
      is_active: false // Inactive supplier for testing
    }
  ];

  let created = 0;
  let skipped = 0;

  for (const supplier of suppliers) {
    try {
      await prisma.suppliers.create({
        data: {
          ...supplier,
          created_at: new Date()
        }
      });
      console.log(`✓ Created: ${supplier.supplier_name}`);
      created++;
    } catch (error) {
      console.error(`✗ Error creating supplier: ${supplier.supplier_name}`);
      console.error(`  ${error.message}`);
      skipped++;
    }
  }

  console.log('');
  console.log('========================================');
  console.log('Suppliers seeding completed!');
  console.log('========================================');
  console.log('');
  console.log(`Total suppliers created: ${created}`);
  console.log(`Total skipped: ${skipped}`);
  console.log('');
  console.log('Supplier Types:');
  console.log('- Pharmaceutical distributors');
  console.log('- Government supply (DOH)');
  console.log('- Specialized suppliers (Cardio, Respiratory, Vitamins)');
  console.log('- Local suppliers');
  console.log('- Herbal medicine suppliers');
  console.log('');
  console.log('Note: 1 supplier is marked inactive for testing purposes');
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