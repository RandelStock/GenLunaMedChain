/*
  Warnings:

  - You are about to drop the `audit_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `medicine_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `medicine_releases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `medicine_stocks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."audit_log" DROP CONSTRAINT "audit_log_changed_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_records" DROP CONSTRAINT "medicine_records_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_releases" DROP CONSTRAINT "medicine_releases_medicine_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_releases" DROP CONSTRAINT "medicine_releases_released_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_releases" DROP CONSTRAINT "medicine_releases_resident_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_releases" DROP CONSTRAINT "medicine_releases_stock_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_stocks" DROP CONSTRAINT "medicine_stocks_added_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_stocks" DROP CONSTRAINT "medicine_stocks_medicine_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."medicine_stocks" DROP CONSTRAINT "medicine_stocks_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_removals" DROP CONSTRAINT "stock_removals_medicine_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."stock_removals" DROP CONSTRAINT "stock_removals_stock_id_fkey";

-- AlterTable
ALTER TABLE "public"."stock_removals" ADD COLUMN     "blockchain_hash" VARCHAR(66);

-- DropTable
DROP TABLE "public"."audit_log";

-- DropTable
DROP TABLE "public"."medicine_records";

-- DropTable
DROP TABLE "public"."medicine_releases";

-- DropTable
DROP TABLE "public"."medicine_stocks";

-- CreateTable
CREATE TABLE "public"."medicines" (
    "medicine_id" INTEGER NOT NULL,
    "medicine_name" VARCHAR(255) NOT NULL,
    "medicine_type" VARCHAR(100),
    "description" TEXT,
    "generic_name" VARCHAR(255),
    "dosage_form" VARCHAR(100),
    "strength" VARCHAR(100),
    "manufacturer" VARCHAR(255),
    "category" VARCHAR(100),
    "storage_requirements" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "blockchain_hash" VARCHAR(66),
    "blockchain_tx_hash" VARCHAR(66),
    "transaction_hash" VARCHAR(66),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("medicine_id")
);

-- CreateTable
CREATE TABLE "public"."stocks" (
    "stock_id" INTEGER NOT NULL,
    "medicine_id" INTEGER NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remaining_quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "total_cost" DECIMAL(12,2),
    "supplier_id" INTEGER,
    "supplier_name" VARCHAR(255),
    "date_received" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "storage_location" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "blockchain_hash" VARCHAR(66),
    "blockchain_tx_hash" VARCHAR(66),
    "added_by_wallet" VARCHAR(42),
    "added_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("stock_id")
);

-- CreateTable
CREATE TABLE "public"."receipts" (
    "release_id" INTEGER NOT NULL,
    "medicine_id" INTEGER NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "resident_id" INTEGER,
    "resident_name" VARCHAR(255) NOT NULL,
    "resident_age" INTEGER,
    "concern" TEXT,
    "quantity_released" INTEGER NOT NULL,
    "notes" TEXT,
    "date_released" TIMESTAMP(3) NOT NULL,
    "prescription_number" VARCHAR(100),
    "prescribing_doctor" VARCHAR(255),
    "dosage_instructions" TEXT,
    "blockchain_hash" VARCHAR(66),
    "blockchain_tx_hash" VARCHAR(66),
    "released_by_wallet" VARCHAR(42),
    "released_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("release_id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "audit_id" SERIAL NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "changed_by" INTEGER,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "medicine_id" INTEGER,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medicines_blockchain_hash_key" ON "public"."medicines"("blockchain_hash");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_medicine_id_batch_number_key" ON "public"."stocks"("medicine_id", "batch_number");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_idx" ON "public"."audit_logs"("table_name");

-- CreateIndex
CREATE INDEX "audit_logs_medicine_id_idx" ON "public"."audit_logs"("medicine_id");

-- AddForeignKey
ALTER TABLE "public"."medicines" ADD CONSTRAINT "medicines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocks" ADD CONSTRAINT "stocks_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("medicine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocks" ADD CONSTRAINT "stocks_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("supplier_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stocks" ADD CONSTRAINT "stocks_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("medicine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("stock_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("resident_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."receipts" ADD CONSTRAINT "receipts_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_removals" ADD CONSTRAINT "stock_removals_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("stock_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_removals" ADD CONSTRAINT "stock_removals_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("medicine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("medicine_id") ON DELETE SET NULL ON UPDATE CASCADE;
