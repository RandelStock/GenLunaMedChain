-- CreateTable
CREATE TABLE "stock_transactions" (
    "transaction_id" SERIAL NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "quantity_changed" INTEGER NOT NULL,
    "quantity_before" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "performed_by_wallet" TEXT,
    "blockchain_tx_hash" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE INDEX "stock_transactions_stock_id_idx" ON "stock_transactions"("stock_id");

-- CreateIndex
CREATE INDEX "stock_transactions_transaction_date_idx" ON "stock_transactions"("transaction_date");

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("stock_id") ON DELETE RESTRICT ON UPDATE CASCADE;
