-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('DOCTOR', 'NURSE', 'SPECIALIST', 'EMERGENCY');

-- CreateTable
CREATE TABLE "provider_availability" (
    "availability_id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "break_start_time" VARCHAR(5),
    "break_end_time" VARCHAR(5),
    "slot_duration" INTEGER NOT NULL DEFAULT 30,
    "max_consultations" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_availability_pkey" PRIMARY KEY ("availability_id")
);

-- CreateTable
CREATE TABLE "provider_specializations" (
    "specialization_id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "specialization" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "years_experience" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_specializations_pkey" PRIMARY KEY ("specialization_id")
);

-- CreateIndex
CREATE INDEX "provider_availability_provider_id_idx" ON "provider_availability"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_availability_provider_id_day_of_week_key" ON "provider_availability"("provider_id", "day_of_week");

-- CreateIndex
CREATE INDEX "provider_specializations_provider_id_idx" ON "provider_specializations"("provider_id");

-- AddForeignKey
ALTER TABLE "provider_availability" ADD CONSTRAINT "provider_availability_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_specializations" ADD CONSTRAINT "provider_specializations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
