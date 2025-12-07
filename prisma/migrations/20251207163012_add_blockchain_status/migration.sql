-- AlterTable
ALTER TABLE "medicines" ADD COLUMN     "blockchain_status" "TxStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "stocks" ADD COLUMN     "blockchain_status" "TxStatus" NOT NULL DEFAULT 'PENDING';
