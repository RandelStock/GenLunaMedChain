/*
  Warnings:

  - You are about to drop the column `blockchain_status` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `blockchain_status` on the `stocks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "medicines" DROP COLUMN "blockchain_status";

-- AlterTable
ALTER TABLE "stock_transactions" ADD COLUMN     "blockchain_hash" TEXT;

-- AlterTable
ALTER TABLE "stocks" DROP COLUMN "blockchain_status";

-- CreateIndex
CREATE INDEX "stock_transactions_blockchain_tx_hash_idx" ON "stock_transactions"("blockchain_tx_hash");

-- CreateIndex
CREATE INDEX "stock_transactions_blockchain_hash_idx" ON "stock_transactions"("blockchain_hash");
