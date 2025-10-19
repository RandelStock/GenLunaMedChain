/*
  Warnings:

  - A unique constraint covering the columns `[tx_hash,action_type,entity_type,entity_id]` on the table `blockchain_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."blockchain_transactions_tx_hash_key";

-- CreateIndex
CREATE INDEX "blockchain_transactions_tx_hash_idx" ON "blockchain_transactions"("tx_hash");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_tx_hash_action_type_entity_type_ent_key" ON "blockchain_transactions"("tx_hash", "action_type", "entity_type", "entity_id");
