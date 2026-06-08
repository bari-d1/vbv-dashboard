-- CreateEnum
CREATE TYPE "VbvBriefType" AS ENUM ('timestamp_clip', 'full_edit', 'vedits');

-- CreateEnum
CREATE TYPE "VbvJobStatus" AS ENUM ('open', 'in_progress', 'submitted', 'sent_back_by_lead', 'lead_approved', 'sent_back_by_sm', 'sm_approved', 'assigned');

-- CreateEnum
CREATE TYPE "VbvReviewAction" AS ENUM ('lead_approved', 'sent_back_by_lead');

-- CreateEnum
CREATE TYPE "VbvRole" AS ENUM ('social_media', 'editor', 'lead_editor', 'admin', 'vedits');

-- CreateEnum
CREATE TYPE "VbvSmReviewAction" AS ENUM ('sm_approved', 'sent_back_by_sm');

-- CreateTable
CREATE TABLE "IgAccount" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "username" TEXT NOT NULL DEFAULT '',
    "views" INTEGER NOT NULL DEFAULT 0,
    "baseReach" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgDailyMetric" (
    "date" TEXT NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgDailyMetric_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "IgFollowerSnapshot" (
    "date" TEXT NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgFollowerSnapshot_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "IgPost" (
    "id" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT '',
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "profileVisits" INTEGER NOT NULL DEFAULT 0,
    "follows" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgWatchTime" INTEGER NOT NULL DEFAULT 0,
    "videoDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postedAt" TEXT NOT NULL DEFAULT '',
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "displayName" TEXT,
    "instagramHandle" TEXT,
    "eventName" TEXT,
    "eventDate" TEXT,
    "eventLocation" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "collaborators" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Not Contacted',
    "notes" TEXT NOT NULL DEFAULT '',
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "platform" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "syncedFrom" TIMESTAMP(3),
    "syncedTo" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("platform")
);

-- CreateTable
CREATE TABLE "VbvActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VbvActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvJob" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "briefType" "VbvBriefType" NOT NULL,
    "sourceDriveLink" TEXT NOT NULL,
    "startTimestamp" TEXT,
    "endTimestamp" TEXT,
    "clipNotes" TEXT,
    "editInstructions" TEXT,
    "platformTargets" TEXT[],
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "VbvJobStatus" NOT NULL DEFAULT 'open',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VbvJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvSubmission" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "driveLink" TEXT NOT NULL,
    "editorNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewAction" "VbvReviewAction",
    "smReviewNote" TEXT,
    "smReviewedAt" TIMESTAMP(3),
    "smReviewAction" "VbvSmReviewAction",
    "smReviewedById" TEXT,

    CONSTRAINT "VbvSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvTimelineLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VbvTimelineLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "VbvRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sermonPipelineAccess" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VbvUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvUserCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plainPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VbvUserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VbvUser_email_key" ON "VbvUser"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VbvUserCredential_userId_key" ON "VbvUserCredential"("userId" ASC);

-- AddForeignKey
ALTER TABLE "VbvActivityLog" ADD CONSTRAINT "VbvActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "VbvUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvJob" ADD CONSTRAINT "VbvJob_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "VbvUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvJob" ADD CONSTRAINT "VbvJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "VbvUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvSubmission" ADD CONSTRAINT "VbvSubmission_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "VbvUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvSubmission" ADD CONSTRAINT "VbvSubmission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VbvJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvSubmission" ADD CONSTRAINT "VbvSubmission_smReviewedById_fkey" FOREIGN KEY ("smReviewedById") REFERENCES "VbvUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvTimelineLog" ADD CONSTRAINT "VbvTimelineLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "VbvUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvTimelineLog" ADD CONSTRAINT "VbvTimelineLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "VbvJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VbvUserCredential" ADD CONSTRAINT "VbvUserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "VbvUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

