// prisma/seed-consultations.js
// Seeds telemedicine consultation records
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const consultationTypes = ['GENERAL', 'FOLLOW_UP', 'EMERGENCY', 'PREVENTIVE', 'SPECIALIST'];
const consultationStatuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const chiefComplaints = [
  'Persistent cough and fever for 3 days',
  'High blood pressure - need medication adjustment',
  'Severe headache and dizziness',
  'Abdominal pain and nausea',
  'Skin rash and itching',
  'Difficulty breathing and chest tightness',
  'Lower back pain for 2 weeks',
  'Recurring UTI symptoms',
  'Diabetes management consultation',
  'Prenatal checkup - 24 weeks pregnant',
  'Child immunization inquiry',
  'Annual senior citizen checkup',
  'Anxiety and stress management',
  'Follow-up for hypertension',
  'Wound care and dressing change',
  'Allergic reaction to medication',
  'Stomach ulcer symptoms',
  'Arthritis pain management',
  'Vision problems and eye strain',
  'Chronic fatigue and weakness'
];

const symptoms = [
  'Fever, chills, body aches',
  'Cough, sore throat, runny nose',
  'Headache, nausea, vomiting',
  'Diarrhea, stomach cramps',
  'Difficulty breathing, wheezing',
  'Chest pain, palpitations',
  'Dizziness, fainting spells',
  'Rash, itching, swelling',
  'Joint pain, stiffness',
  'Fatigue, weakness, loss of appetite'
];

const diagnoses = [
  'Upper respiratory tract infection',
  'Acute gastroenteritis',
  'Hypertension - stage 1',
  'Type 2 Diabetes Mellitus',
  'Allergic rhinitis',
  'Urinary tract infection',
  'Acute bronchitis',
  'Contact dermatitis',
  'Osteoarthritis',
  'Gastroesophageal reflux disease (GERD)',
  'Migraine',
  'Anxiety disorder',
  'Asthma - controlled',
  'Lower back pain - musculoskeletal',
  'Conjunctivitis'
];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(probability = 0.5) {
  return Math.random() < probability;
}

function generateTimeSlot() {
  const hours = randomInt(8, 16); // 8 AM to 4 PM
  const minutes = randomElement(['00', '30']);
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function main() {
  console.log('Starting consultations seeding...');
  console.log('');

  // Get residents
  const residents = await prisma.residents.findMany({
    where: { is_active: true },
    take: 100
  });

  if (residents.length === 0) {
    console.error('No residents found. Please run seed-resident.js first.');
    process.exit(1);
  }

  // Get doctors and nurses (staff users)
  const doctors = await prisma.users.findMany({
    where: { 
      role: { in: ['ADMIN', 'STAFF'] }
    },
    take: 5
  });

  const nurses = await prisma.users.findMany({
    where: { 
      role: { in: ['STAFF'] }
    },
    take: 3
  });

  console.log(`Found ${residents.length} residents`);
  console.log(`Found ${doctors.length} doctors`);
  console.log(`Found ${nurses.length} nurses`);
  console.log('');

  let created = 0;
  let skipped = 0;
  const consultationsToCreate = 80;

  const today = new Date();
  
  for (let i = 0; i < consultationsToCreate; i++) {
    try {
      const resident = randomElement(residents);
      const consultationType = randomElement(consultationTypes);
      
      // Determine status based on date
      const daysOffset = randomInt(-30, 30); // Past 30 days to future 30 days
      const scheduledDate = addDays(today, daysOffset);
      
      let status;
      if (daysOffset < -2) {
        // Past consultations
        status = randomElement(['COMPLETED', 'COMPLETED', 'COMPLETED', 'NO_SHOW', 'CANCELLED']);
      } else if (daysOffset < 0) {
        // Recent past
        status = randomElement(['COMPLETED', 'IN_PROGRESS']);
      } else if (daysOffset === 0) {
        // Today
        status = randomElement(['CONFIRMED', 'IN_PROGRESS', 'SCHEDULED']);
      } else {
        // Future
        status = randomElement(['SCHEDULED', 'CONFIRMED', 'CONFIRMED']);
      }

      const doctor = doctors.length > 0 ? randomElement(doctors) : null;
      const nurse = nurses.length > 0 && randomBoolean(0.6) ? randomElement(nurses) : null;

      const consultationData = {
        resident_id: resident.resident_id,
        patient_name: resident.full_name || `${resident.first_name} ${resident.last_name}`,
        patient_email: resident.phone ? `${resident.first_name.toLowerCase()}@email.com` : null,
        patient_phone: resident.phone || '09171234567',
        patient_age: resident.age,
        patient_gender: resident.gender,
        patient_barangay: resident.barangay,
        patient_address: resident.address,
        chief_complaint: randomElement(chiefComplaints),
        symptoms: randomElement(symptoms),
        medical_history: resident.medical_conditions || 'No significant medical history',
        current_medications: randomBoolean(0.4) ? 'Amlodipine 5mg once daily, Metformin 500mg twice daily' : null,
        allergies: resident.allergies || 'No known allergies',
        consultation_type: consultationType,
        scheduled_date: scheduledDate,
        scheduled_time: generateTimeSlot(),
        duration_minutes: randomElement([30, 45, 60]),
        status: status,
        assigned_doctor_id: doctor?.user_id,
        assigned_nurse_id: nurse?.user_id,
        meeting_link: status !== 'CANCELLED' && status !== 'NO_SHOW' ? `https://meet.genlunahealth.ph/${randomInt(100000, 999999)}` : null,
        meeting_id: status !== 'CANCELLED' && status !== 'NO_SHOW' ? `GLMH-${randomInt(10000, 99999)}` : null,
        meeting_password: status !== 'CANCELLED' && status !== 'NO_SHOW' ? String(randomInt(1000, 9999)) : null,
        created_at: addDays(scheduledDate, -randomInt(1, 7))
      };

      // Add consultation notes and diagnosis for completed consultations
      if (status === 'COMPLETED') {
        consultationData.consultation_notes = 'Patient examined via telemedicine. Vital signs discussed. Treatment plan explained.';
        consultationData.diagnosis = randomElement(diagnoses);
        consultationData.prescription = `${randomElement(['Amoxicillin 500mg', 'Paracetamol 500mg', 'Cetirizine 10mg'])} - ${randomElement(['1 tablet', '2 tablets'])} ${randomElement(['twice', 'three times'])} daily for ${randomInt(3, 7)} days`;
        consultationData.follow_up_required = randomBoolean(0.3);
        if (consultationData.follow_up_required) {
          consultationData.follow_up_date = addDays(scheduledDate, randomInt(7, 30));
        }
        consultationData.completed_at = scheduledDate;
      }

      await prisma.consultations.create({
        data: consultationData
      });

      if ((i + 1) % 10 === 0) {
        console.log(`Progress: ${i + 1}/${consultationsToCreate} consultations created`);
      }

      created++;
    } catch (error) {
      console.error(`✗ Error creating consultation ${i + 1}: ${error.message}`);
      skipped++;
    }
  }

  // Get statistics
  const statusStats = await prisma.consultations.groupBy({
    by: ['status'],
    _count: { consultation_id: true }
  });

  const typeStats = await prisma.consultations.groupBy({
    by: ['consultation_type'],
    _count: { consultation_id: true }
  });

  console.log('');
  console.log('========================================');
  console.log('Consultations seeding completed!');
  console.log('========================================');
  console.log('');
  console.log(`Total consultations created: ${created}`);
  console.log(`Total skipped: ${skipped}`);
  console.log('');
  console.log('Status Distribution:');
  statusStats.forEach(stat => {
    console.log(`- ${stat.status}: ${stat._count.consultation_id}`);
  });
  console.log('');
  console.log('Type Distribution:');
  typeStats.forEach(stat => {
    console.log(`- ${stat.consultation_type}: ${stat._count.consultation_id}`);
  });
  console.log('');
  console.log('Date Range: Past 30 days to Future 30 days');
  console.log('All consultations linked to residents');
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