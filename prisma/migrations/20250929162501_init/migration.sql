-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'PHARMACIST', 'STAFF');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RemovalReason" AS ENUM ('EXPIRED', 'ENTRY_ERROR', 'DAMAGED', 'LOST', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."users" (
    "user_id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(42) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "role" "public"."Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."medicine_records" (
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
    "blockchain_tx_hash" VARCHAR(66),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "medicine_records_pkey" PRIMARY KEY ("medicine_id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "supplier_id" SERIAL NOT NULL,
    "supplier_name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "public"."medicine_stocks" (
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
    "blockchain_tx_hash" VARCHAR(66),
    "added_by_wallet" VARCHAR(42),
    "added_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "medicine_stocks_pkey" PRIMARY KEY ("stock_id")
);

-- CreateTable
CREATE TABLE "public"."residents" (
    "resident_id" SERIAL NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "middle_name" VARCHAR(100),
    "last_name" VARCHAR(100) NOT NULL,
    "full_name" VARCHAR(255),
    "date_of_birth" TIMESTAMP(3),
    "age" INTEGER,
    "gender" "public"."Gender",
    "address" TEXT,
    "phone" VARCHAR(50),
    "emergency_contact" VARCHAR(255),
    "emergency_phone" VARCHAR(50),
    "medical_conditions" TEXT,
    "allergies" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("resident_id")
);

-- CreateTable
CREATE TABLE "public"."medicine_releases" (
    "release_id" INTEGER NOT NULL,
    "medicine_id" INTEGER NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "resident_id" INTEGER,
    "resident_name" VARCHAR(255) NOT NULL,
    "resident_age" INTEGER,
    "concern" TEXT,
    "quantity_released" INTEGER NOT NULL,
    "date_released" TIMESTAMP(3) NOT NULL,
    "prescription_number" VARCHAR(100),
    "prescribing_doctor" VARCHAR(255),
    "dosage_instructions" TEXT,
    "blockchain_tx_hash" VARCHAR(66),
    "released_by_wallet" VARCHAR(42),
    "released_by_user_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "medicine_releases_pkey" PRIMARY KEY ("release_id")
);

-- CreateTable
CREATE TABLE "public"."stock_removals" (
    "removal_id" INTEGER NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "medicine_id" INTEGER NOT NULL,
    "quantity_removed" INTEGER NOT NULL,
    "reason" "public"."RemovalReason" NOT NULL,
    "date_removed" TIMESTAMP(3) NOT NULL,
    "blockchain_tx_hash" VARCHAR(66),
    "removed_by_wallet" VARCHAR(42),
    "removed_by_user_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "stock_removals_pkey" PRIMARY KEY ("removal_id")
);

-- CreateTable
CREATE TABLE "public"."blockchain_transactions" (
    "transaction_id" SERIAL NOT NULL,
    "tx_hash" VARCHAR(66) NOT NULL,
    "block_number" BIGINT,
    "contract_address" VARCHAR(42),
    "action_type" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "from_address" VARCHAR(42),
    "gas_used" BIGINT,
    "gas_price" BIGINT,
    "event_data" JSONB,
    "status" "public"."TxStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "public"."sync_status" (
    "sync_id" SERIAL NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "blockchain_id" INTEGER NOT NULL,
    "is_synced" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_attempt" TIMESTAMP(3),
    "last_successful_sync" TIMESTAMP(3),
    "sync_error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sync_status_pkey" PRIMARY KEY ("sync_id")
);

-- CreateTable
CREATE TABLE "public"."audit_log" (
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

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "public"."users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_tx_hash_key" ON "public"."blockchain_transactions"("tx_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sync_status_entity_type_entity_id_key" ON "public"."sync_status"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_table_name_idx" ON "public"."audit_log"("table_name");

-- AddForeignKey
ALTER TABLE "public"."medicine_records" ADD CONSTRAINT "medicine_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medicine_stocks" ADD CONSTRAINT "medicine_stocks_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicine_records"("medicine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medicine_stocks" ADD CONSTRAINT "medicine_stocks_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("supplier_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medicine_stocks" ADD CONSTRAINT "medicine_stocks_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medicine_releases" ADD CONSTRAINT "medicine_releases_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicine_records"("medicine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medicine_releases" ADD CONSTRAINT "medicine_releases_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "public"."medicine_stocks"("stock_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medicine_releases" ADD CONSTRAINT "medicine_releases_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "public"."residents"("resident_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medicine_releases" ADD CONSTRAINT "medicine_releases_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_removals" ADD CONSTRAINT "stock_removals_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "public"."medicine_stocks"("stock_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_removals" ADD CONSTRAINT "stock_removals_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicine_records"("medicine_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_removals" ADD CONSTRAINT "stock_removals_removed_by_user_id_fkey" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
