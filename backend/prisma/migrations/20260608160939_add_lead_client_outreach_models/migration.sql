-- CreateEnum
CREATE TYPE "VbvLeadStatus" AS ENUM ('CONTACTED', 'REPLIED', 'BOOKED_CALL', 'CONVERTED', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "VbvEmailDirection" AS ENUM ('SENT', 'RECEIVED');

-- CreateEnum
CREATE TYPE "VbvClientTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "VbvClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CHURNED');

-- CreateTable
CREATE TABLE "VbvLead" (
    "id" TEXT NOT NULL,
    "churchName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "driveLink" TEXT,
    "status" "VbvLeadStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VbvLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvEmailLog" (
    "id" TEXT NOT NULL,
    "direction" "VbvEmailDirection" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VbvEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VbvTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvClient" (
    "id" TEXT NOT NULL,
    "churchName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" "VbvClientTier" NOT NULL,
    "startDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" "VbvClientStatus" NOT NULL,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VbvClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VbvLead_email_key" ON "VbvLead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VbvClient_email_key" ON "VbvClient"("email");

-- AddForeignKey
ALTER TABLE "VbvEmailLog" ADD CONSTRAINT "VbvEmailLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "VbvLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvEmailLog" ADD CONSTRAINT "VbvEmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "VbvClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

