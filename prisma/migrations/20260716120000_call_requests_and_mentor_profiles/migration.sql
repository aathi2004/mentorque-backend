-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('RESUME_REVAMP', 'JOB_MARKET_GUIDANCE', 'MOCK_INTERVIEW');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'RECOMMENDED', 'BOOKED');

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domain" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "description_embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "call_type" "CallType" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domain" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "description_embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "meeting_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_user_id_key" ON "mentor_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_requests_meeting_id_key" ON "call_requests"("meeting_id");

-- CreateIndex
CREATE INDEX "call_requests_status_idx" ON "call_requests"("status");

-- CreateIndex
CREATE INDEX "call_requests_user_id_idx" ON "call_requests"("user_id");

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
