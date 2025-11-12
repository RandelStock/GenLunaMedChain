// prisma/seed-resident.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Filipino first names
const filipinoFirstNames = {
  male: [
    'Juan', 'Jose', 'Pedro', 'Antonio', 'Manuel', 'Francisco', 'Miguel', 'Roberto',
    'Carlos', 'Ramon', 'Luis', 'Fernando', 'Rafael', 'Ricardo', 'Eduardo', 'Alejandro',
    'Jorge', 'Alberto', 'Ernesto', 'Mario', 'Sergio', 'Diego', 'Rodrigo', 'Javier',
    'Gabriel', 'Daniel', 'David', 'Marco', 'Angelo', 'Paolo', 'Vincent', 'Christian',
    'Joshua', 'Nathan', 'Samuel', 'Elijah', 'James', 'John', 'Mark', 'Matthew',
    'Ryan', 'Kevin', 'Jason', 'Michael', 'Anthony', 'Joseph', 'Kenneth', 'Dennis',
    'Ronald', 'Arnold', 'Frederick', 'Gilbert', 'Henry', 'Isaac', 'Jerome', 'Lawrence'
  ],
  female: [
    'Maria', 'Ana', 'Rosa', 'Carmen', 'Elena', 'Isabel', 'Teresa', 'Lucia',
    'Sofia', 'Victoria', 'Patricia', 'Laura', 'Monica', 'Sandra', 'Angela',
    'Diana', 'Beatriz', 'Cristina', 'Julia', 'Marina', 'Gloria', 'Eva',
    'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia',
    'Grace', 'Faith', 'Hope', 'Joy', 'Angel', 'Princess', 'Queen', 'Precious',
    'Love', 'Heart', 'Rose', 'Jasmine', 'Lily', 'Daisy', 'Iris', 'Violet',
    'Ruby', 'Pearl', 'Crystal', 'Diamond', 'Jade', 'Amber', 'Emerald', 'Sapphire'
  ]
};

// Filipino middle names (often mother's maiden name)
const filipinoMiddleNames = [
  'Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Gonzales', 'Ramos', 'Flores',
  'Mendoza', 'Torres', 'Rivera', 'Castro', 'Fernandez', 'Lopez', 'Morales',
  'Aquino', 'Bautista', 'Villanueva', 'Santiago', 'Cruz', 'Martinez',
  'Hernandez', 'Navarro', 'Pascual', 'Salazar', 'Aguilar', 'Domingo',
  'Perez', 'Valdez', 'Miranda', 'Castillo', 'Mercado', 'Guerrero'
];

// Filipino last names
const filipinoLastNames = [
  'Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Gonzales', 'Ramos', 'Flores',
  'Mendoza', 'Torres', 'Rivera', 'Castro', 'Fernandez', 'Lopez', 'Morales',
  'Aquino', 'Bautista', 'Villanueva', 'Santiago', 'Cruz', 'Martinez',
  'Hernandez', 'Navarro', 'Pascual', 'Salazar', 'Aguilar', 'Domingo',
  'Perez', 'Valdez', 'Miranda', 'Castillo', 'Mercado', 'Guerrero',
  'Evangelista', 'Diaz', 'Gutierrez', 'Rojas', 'Sandoval', 'Zamora',
  'Ortiz', 'Manalo', 'Chavez', 'Ocampo', 'Lim', 'Tan', 'Go', 'Sy',
  'Chua', 'Ong', 'Lee', 'Chan', 'Wong', 'Yang', 'Yap', 'Velasco'
];

// All 27 barangays
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

// Medical conditions pool
const medicalConditions = [
  'Hypertension',
  'Type 2 Diabetes',
  'Asthma',
  'Arthritis',
  'GERD (Acid Reflux)',
  'Hypothyroidism',
  'Migraine',
  'Anemia',
  'High Cholesterol',
  'Heart Disease',
  'Chronic Kidney Disease',
  'COPD',
  'Depression',
  'Anxiety Disorder',
  'Osteoporosis',
  'Gout',
  'Allergic Rhinitis'
];

// Allergies pool
const allergies = [
  'Penicillin',
  'Amoxicillin',
  'Sulfa drugs',
  'Aspirin',
  'Ibuprofen',
  'Shellfish',
  'Peanuts',
  'Pollen',
  'Dust mites',
  'Pet dander',
  'Latex',
  'Eggs',
  'Milk',
  'Soy',
  'Wheat'
];

// Other programs
const otherPrograms = [
  'Senior Citizen ID Holder',
  'PWD (Person with Disability)',
  'Solo Parent ID Holder',
  'Indigenous People (IP)',
  'TB-DOTS Program',
  'Expanded Program on Immunization (EPI)',
  'Family Planning Program',
  'Nutrition Program',
  'Maternal Care Program',
  'Child Development Program'
];

// Helper functions
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(probability = 0.5) {
  return Math.random() < probability;
}

function generatePhoneNumber() {
  const prefixes = ['0917', '0918', '0919', '0920', '0921', '0922', '0923', '0924', '0925', '0926', '0927', '0928', '0929', '0930', '0933', '0934', '0935', '0936', '0937', '0938', '0939'];
  const prefix = randomElement(prefixes);
  const suffix = String(randomInt(1000000, 9999999));
  return prefix + suffix;
}

function generateDateOfBirth(minAge, maxAge) {
  const today = new Date();
  const age = randomInt(minAge, maxAge);
  const birthYear = today.getFullYear() - age;
  const birthMonth = randomInt(0, 11);
  const birthDay = randomInt(1, 28); // Safe day for all months
  return new Date(birthYear, birthMonth, birthDay);
}

function calculateAge(dateOfBirth) {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

function getAgeCategory(age) {
  if (age < 2) return 'ZERO_TO_23_MONTHS';
  if (age < 5) return 'TWENTY_FOUR_TO_59_MONTHS';
  if (age < 6) return 'SIXTY_TO_71_MONTHS';
  return 'ABOVE_71_MONTHS';
}

function generatePhilHealthNumber() {
  // Format: 12-345678901-2 (14 digits with dashes)
  const part1 = String(randomInt(10, 99));
  const part2 = String(randomInt(100000000, 999999999));
  const part3 = String(randomInt(0, 9));
  return `${part1}-${part2}-${part3}`;
}

function generateBirthCertificateNo() {
  // Format: 2024-XXXX-XXXXX
  const year = randomInt(1960, 2024);
  const part1 = String(randomInt(1000, 9999));
  const part2 = String(randomInt(10000, 99999));
  return `${year}-${part1}-${part2}`;
}

function generateAddress(barangay, zone, householdNo) {
  const streets = ['Main St.', 'Rizal Ave.', 'Bonifacio St.', 'Luna St.', 'Del Pilar St.', 'Mabini St.', 'Quezon Ave.', 'Roxas Blvd.'];
  const street = randomElement(streets);
  return `Zone ${zone}, Household ${householdNo}, ${street}, ${formatBarangayName(barangay)}, General Luna, Quezon`;
}

function formatBarangayName(barangay) {
  return barangay.replace(/_/g, ' ').replace(/POBLACION/g, 'Poblacion').replace(/IBABA/g, 'Ibaba').replace(/ILAYA/g, 'Ilaya');
}

function generateResident(barangay, index) {
  const gender = randomElement(['MALE', 'FEMALE']);
  const firstName = randomElement(gender === 'MALE' ? filipinoFirstNames.male : filipinoFirstNames.female);
  const middleName = randomBoolean(0.9) ? randomElement(filipinoMiddleNames) : null;
  const lastName = randomElement(filipinoLastNames);
  const fullName = middleName 
    ? `${firstName} ${middleName} ${lastName}`
    : `${firstName} ${lastName}`;

  // Age distribution: More working age adults, fewer children and elderly
  let minAge, maxAge;
  const ageDistribution = Math.random();
  if (ageDistribution < 0.2) {
    // 20% children (0-17)
    minAge = 0;
    maxAge = 17;
  } else if (ageDistribution < 0.65) {
    // 45% working age adults (18-59)
    minAge = 18;
    maxAge = 59;
  } else {
    // 35% senior citizens (60+)
    minAge = 60;
    maxAge = 85;
  }

  const dateOfBirth = generateDateOfBirth(minAge, maxAge);
  const age = calculateAge(dateOfBirth);
  const ageCategory = getAgeCategory(age);
  const isSeniorCitizen = age >= 60;

  // Zone and household distribution
  const zone = String(randomInt(1, 8));
  const householdNo = `${index + 1}`.padStart(4, '0');
  const familyNo = `FAM-${randomInt(1, 500)}`.padStart(10, '0');

  // Profile completion (80% complete, 20% incomplete)
  const isProfileComplete = randomBoolean(0.8);

  // Program memberships
  const is4psMember = randomBoolean(0.25); // 25% are 4Ps members
  const isPhilhealthMember = randomBoolean(0.65); // 65% have PhilHealth
  const philhealthNumber = isPhilhealthMember ? generatePhilHealthNumber() : null;

  // Pregnancy status (only for women aged 18-45)
  const isPregnant = gender === 'FEMALE' && age >= 18 && age <= 45 && randomBoolean(0.08);
  let pregnancyDueDate = null;
  let pregnancyNotes = null;
  
  if (isPregnant) {
    const weeksPregnant = randomInt(8, 36);
    const weeksUntilDue = 40 - weeksPregnant;
    pregnancyDueDate = new Date();
    pregnancyDueDate.setDate(pregnancyDueDate.getDate() + (weeksUntilDue * 7));
    pregnancyNotes = `${weeksPregnant} weeks pregnant. Regular prenatal checkups.`;
  }

  // Birth registration (95% of children are registered)
  const isBirthRegistered = age < 18 ? randomBoolean(0.95) : randomBoolean(0.98);
  const birthRegistryDate = isBirthRegistered ? new Date(dateOfBirth.getTime() + (randomInt(30, 365) * 24 * 60 * 60 * 1000)) : null;
  const birthCertificateNo = isBirthRegistered ? generateBirthCertificateNo() : null;

  // Other programs (30% chance)
  const otherProgram = randomBoolean(0.3) ? randomElement(otherPrograms) : null;

  // Contact information
  const phone = randomBoolean(0.85) ? generatePhoneNumber() : null;
  const address = generateAddress(barangay, zone, householdNo);

  // Emergency contact
  const emergencyContactNames = gender === 'MALE' ? filipinoFirstNames.female : filipinoFirstNames.male;
  const emergencyContact = `${randomElement(emergencyContactNames)} ${lastName}`;
  const emergencyPhone = generatePhoneNumber();

  // Medical conditions (30% have at least one condition, higher for seniors)
  let medicalConditionsList = [];
  const hasMedicalCondition = isSeniorCitizen ? randomBoolean(0.7) : randomBoolean(0.3);
  if (hasMedicalCondition) {
    const numConditions = randomInt(1, isSeniorCitizen ? 3 : 2);
    for (let i = 0; i < numConditions; i++) {
      const condition = randomElement(medicalConditions);
      if (!medicalConditionsList.includes(condition)) {
        medicalConditionsList.push(condition);
      }
    }
  }
  const medicalConditionsStr = medicalConditionsList.length > 0 ? medicalConditionsList.join(', ') : null;

  // Allergies (15% have allergies)
  let allergiesList = [];
  if (randomBoolean(0.15)) {
    const numAllergies = randomInt(1, 2);
    for (let i = 0; i < numAllergies; i++) {
      const allergy = randomElement(allergies);
      if (!allergiesList.includes(allergy)) {
        allergiesList.push(allergy);
      }
    }
  }
  const allergiesStr = allergiesList.length > 0 ? allergiesList.join(', ') : null;

  return {
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    full_name: fullName,
    date_of_birth: dateOfBirth,
    age: age,
    age_category: ageCategory,
    gender: gender,
    barangay: barangay,
    zone: zone,
    household_no: householdNo,
    family_no: familyNo,
    is_profile_complete: isProfileComplete,
    is_4ps_member: is4psMember,
    is_philhealth_member: isPhilhealthMember,
    philhealth_number: philhealthNumber,
    is_pregnant: isPregnant,
    is_senior_citizen: isSeniorCitizen,
    is_birth_registered: isBirthRegistered,
    other_program: otherProgram,
    pregnancy_due_date: pregnancyDueDate,
    pregnancy_notes: pregnancyNotes,
    birth_registry_date: birthRegistryDate,
    birth_certificate_no: birthCertificateNo,
    address: address,
    phone: phone,
    emergency_contact: emergencyContact,
    emergency_phone: emergencyPhone,
    medical_conditions: medicalConditionsStr,
    allergies: allergiesStr,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };
}

async function main() {
  console.log('Starting resident data seeding...');
  console.log('');
  
  const RESIDENTS_PER_BARANGAY = 50;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const barangay of barangays) {
    console.log(`Processing ${formatBarangayName(barangay)}...`);
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < RESIDENTS_PER_BARANGAY; i++) {
      try {
        const residentData = generateResident(barangay, i);
        await prisma.residents.create({
          data: residentData
        });
        created++;
      } catch (error) {
        console.error(`  ✗ Error creating resident ${i + 1}:`, error.message);
        skipped++;
      }
    }

    console.log(`  ✓ Created ${created} residents (${skipped} skipped)`);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log('');
  console.log('========================================');
  console.log('Resident seeding completed!');
  console.log('========================================');
  console.log('');
  console.log('Summary:');
  console.log(`- Total barangays: ${barangays.length}`);
  console.log(`- Residents per barangay: ${RESIDENTS_PER_BARANGAY}`);
  console.log(`- Total residents created: ${totalCreated}`);
  console.log(`- Total skipped: ${totalSkipped}`);
  console.log('');
  console.log('Distribution:');
  console.log('- ~20% Children (0-17 years)');
  console.log('- ~45% Adults (18-59 years)');
  console.log('- ~35% Senior Citizens (60+ years)');
  console.log('');
  console.log('Program Coverage:');
  console.log('- 25% are 4Ps members');
  console.log('- 65% have PhilHealth');
  console.log('- ~8% of women aged 18-45 are pregnant');
  console.log('- 95%+ birth registration rate');
  console.log('- 30% enrolled in other programs');
  console.log('');
  console.log('Health Data:');
  console.log('- 30% have medical conditions (70% for seniors)');
  console.log('- 15% have allergies');
  console.log('- 85% have phone numbers');
  console.log('- 80% have complete profiles');
  console.log('');
  console.log('Ready to use the system!');
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