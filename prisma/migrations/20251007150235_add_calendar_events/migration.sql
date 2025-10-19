-- CreateEnum
CREATE TYPE "CenterType" AS ENUM ('RHU', 'BARANGAY');

-- CreateTable
CREATE TABLE "calendar_events" (
    "event_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "center_type" "CenterType" NOT NULL,
    "barangay" "Barangay" NOT NULL,
    "location" VARCHAR(255),
    "created_by_id" INTEGER,
    "color" VARCHAR(20),
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "calendar_events_barangay_idx" ON "calendar_events"("barangay");

-- CreateIndex
CREATE INDEX "calendar_events_center_type_idx" ON "calendar_events"("center_type");

-- CreateIndex
CREATE INDEX "calendar_events_start_time_end_time_idx" ON "calendar_events"("start_time", "end_time");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
