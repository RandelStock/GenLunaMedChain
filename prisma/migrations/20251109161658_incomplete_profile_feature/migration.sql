-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "resident_id" INTEGER;

-- AlterTable
ALTER TABLE "residents" ADD COLUMN     "is_philhealth_member" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "other_program" VARCHAR(255),
ADD COLUMN     "philhealth_number" VARCHAR(50);

-- CreateIndex
CREATE INDEX "consultations_resident_id_idx" ON "consultations"("resident_id");

-- CreateIndex
CREATE INDEX "residents_is_philhealth_member_idx" ON "residents"("is_philhealth_member");

-- CreateIndex
CREATE INDEX "residents_is_profile_complete_idx" ON "residents"("is_profile_complete");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("resident_id") ON DELETE SET NULL ON UPDATE CASCADE;
