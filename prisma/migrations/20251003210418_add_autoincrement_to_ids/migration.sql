-- AlterTable
CREATE SEQUENCE receipts_release_id_seq;
ALTER TABLE "receipts" ALTER COLUMN "release_id" SET DEFAULT nextval('receipts_release_id_seq');
ALTER SEQUENCE receipts_release_id_seq OWNED BY "receipts"."release_id";

-- AlterTable
CREATE SEQUENCE stock_removals_removal_id_seq;
ALTER TABLE "stock_removals" ALTER COLUMN "removal_id" SET DEFAULT nextval('stock_removals_removal_id_seq');
ALTER SEQUENCE stock_removals_removal_id_seq OWNED BY "stock_removals"."removal_id";
