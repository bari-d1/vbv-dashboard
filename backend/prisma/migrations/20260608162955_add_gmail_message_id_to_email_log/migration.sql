-- AlterTable
ALTER TABLE "VbvEmailLog" ADD COLUMN     "gmailMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VbvEmailLog_gmailMessageId_key" ON "VbvEmailLog"("gmailMessageId");

