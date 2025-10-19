-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('GENERAL', 'FOLLOW_UP', 'EMERGENCY', 'PREVENTIVE', 'SPECIALIST');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "consultations" (
    "consultation_id" SERIAL NOT NULL,
    "patient_name" VARCHAR(255) NOT NULL,
    "patient_email" VARCHAR(255),
    "patient_phone" VARCHAR(50) NOT NULL,
    "patient_age" INTEGER,
    "patient_gender" "Gender",
    "patient_barangay" "Barangay" NOT NULL,
    "patient_address" TEXT,
    "chief_complaint" TEXT NOT NULL,
    "symptoms" TEXT,
    "medical_history" TEXT,
    "current_medications" TEXT,
    "allergies" TEXT,
    "consultation_type" "ConsultationType" NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "scheduled_time" VARCHAR(10) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "assigned_doctor_id" INTEGER,
    "assigned_nurse_id" INTEGER,
    "consultation_notes" TEXT,
    "diagnosis" TEXT,
    "prescription" TEXT,
    "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_date" TIMESTAMP(3),
    "meeting_link" VARCHAR(500),
    "meeting_id" VARCHAR(100),
    "meeting_password" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "blockchain_hash" VARCHAR(66),
    "blockchain_tx_hash" VARCHAR(66),

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("consultation_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultations_blockchain_hash_key" ON "consultations"("blockchain_hash");

-- CreateIndex
CREATE INDEX "consultations_patient_barangay_idx" ON "consultations"("patient_barangay");

-- CreateIndex
CREATE INDEX "consultations_scheduled_date_idx" ON "consultations"("scheduled_date");

-- CreateIndex
CREATE INDEX "consultations_status_idx" ON "consultations"("status");

-- CreateIndex
CREATE INDEX "consultations_assigned_doctor_id_idx" ON "consultations"("assigned_doctor_id");

-- CreateIndex
CREATE INDEX "consultations_assigned_nurse_id_idx" ON "consultations"("assigned_nurse_id");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_assigned_nurse_id_fkey" FOREIGN KEY ("assigned_nurse_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
