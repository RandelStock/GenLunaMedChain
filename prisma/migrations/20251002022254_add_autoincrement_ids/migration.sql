-- AlterTable
CREATE SEQUENCE "public".medicines_medicine_id_seq;
ALTER TABLE "public"."medicines" ALTER COLUMN "medicine_id" SET DEFAULT nextval('"public".medicines_medicine_id_seq');
ALTER SEQUENCE "public".medicines_medicine_id_seq OWNED BY "public"."medicines"."medicine_id";

-- AlterTable
CREATE SEQUENCE "public".stocks_stock_id_seq;
ALTER TABLE "public"."stocks" ALTER COLUMN "stock_id" SET DEFAULT nextval('"public".stocks_stock_id_seq');
ALTER SEQUENCE "public".stocks_stock_id_seq OWNED BY "public"."stocks"."stock_id";
