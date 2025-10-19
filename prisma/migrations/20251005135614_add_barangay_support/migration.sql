/*
  Warnings:

  - Added the required column `barangay` to the `medicines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `barangay` to the `residents` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Barangay" AS ENUM ('BACONG_IBABA', 'BACONG_ILAYA', 'BARANGAY_1_POBLACION', 'BARANGAY_2_POBLACION', 'BARANGAY_3_POBLACION', 'BARANGAY_4_POBLACION', 'BARANGAY_5_POBLACION', 'BARANGAY_6_POBLACION', 'BARANGAY_7_POBLACION', 'BARANGAY_8_POBLACION', 'BARANGAY_9_POBLACION', 'LAVIDES', 'MAGSAYSAY', 'MALAYA', 'NIEVA', 'RECTO', 'SAN_IGNACIO_IBABA', 'SAN_IGNACIO_ILAYA', 'SAN_ISIDRO_IBABA', 'SAN_ISIDRO_ILAYA', 'SAN_JOSE', 'SAN_NICOLAS', 'SAN_VICENTE', 'SANTA_MARIA_IBABA', 'SANTA_MARIA_ILAYA', 'SUMILANG', 'VILLARICA', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "AgeCategory" AS ENUM ('ZERO_TO_23_MONTHS', 'TWENTY_FOUR_TO_59_MONTHS', 'SIXTY_TO_71_MONTHS', 'ABOVE_71_MONTHS');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MUNICIPAL_STAFF';

-- AlterTable
ALTER TABLE "blockchain_transactions" ADD COLUMN     "barangay" "Barangay";

-- AlterTable
ALTER TABLE "medicines" ADD COLUMN     "barangay" "Barangay" NOT NULL;

-- AlterTable
ALTER TABLE "residents" ADD COLUMN     "age_category" "AgeCategory",
ADD COLUMN     "barangay" "Barangay" NOT NULL,
ADD COLUMN     "birth_certificate_no" VARCHAR(100),
ADD COLUMN     "birth_registry_date" TIMESTAMP(3),
ADD COLUMN     "family_no" VARCHAR(50),
ADD COLUMN     "household_no" VARCHAR(50),
ADD COLUMN     "is_4ps_member" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_birth_registered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_pregnant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_senior_citizen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pregnancy_due_date" TIMESTAMP(3),
ADD COLUMN     "pregnancy_notes" TEXT,
ADD COLUMN     "zone" VARCHAR(50);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assigned_barangay" "Barangay";

-- CreateTable
CREATE TABLE "barangay_health_centers" (
    "id" SERIAL NOT NULL,
    "barangay" "Barangay" NOT NULL,
    "center_name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "operating_hours" TEXT,
    "bed_capacity" INTEGER,
    "staff_count" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barangay_health_centers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barangay_health_centers_barangay_key" ON "barangay_health_centers"("barangay");

-- CreateIndex
CREATE INDEX "blockchain_transactions_barangay_idx" ON "blockchain_transactions"("barangay");

-- CreateIndex
CREATE INDEX "medicines_barangay_idx" ON "medicines"("barangay");

-- CreateIndex
CREATE INDEX "medicines_barangay_is_active_idx" ON "medicines"("barangay", "is_active");

-- CreateIndex
CREATE INDEX "residents_barangay_idx" ON "residents"("barangay");

-- CreateIndex
CREATE INDEX "residents_barangay_is_active_idx" ON "residents"("barangay", "is_active");

-- CreateIndex
CREATE INDEX "residents_age_category_idx" ON "residents"("age_category");

-- CreateIndex
CREATE INDEX "residents_is_4ps_member_idx" ON "residents"("is_4ps_member");

-- CreateIndex
CREATE INDEX "residents_is_pregnant_idx" ON "residents"("is_pregnant");

-- CreateIndex
CREATE INDEX "residents_is_senior_citizen_idx" ON "residents"("is_senior_citizen");

-- CreateIndex
CREATE INDEX "users_assigned_barangay_idx" ON "users"("assigned_barangay");
