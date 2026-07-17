-- The original 20260704100000_availability_exceptions migration was a
-- placeholder (the table was created by hand in the original dev database
-- and the migration marked "applied" without real SQL). On a fresh database
-- that leaves this table missing. This migration creates it for real.

-- CreateTable
CREATE TABLE IF NOT EXISTS "availability_exceptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "mentor_id" TEXT,
    "role" "Role" NOT NULL,
    "week_start" DATE NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "availability_exceptions_user_week_slot_key" ON "availability_exceptions"("user_id", "week_start", "day_of_week", "hour");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "availability_exceptions_mentor_week_slot_key" ON "availability_exceptions"("mentor_id", "week_start", "day_of_week", "hour");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;