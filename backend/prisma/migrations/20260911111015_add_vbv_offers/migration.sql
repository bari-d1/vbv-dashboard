-- CreateEnum
CREATE TYPE "VbvOfferAccessType" AS ENUM ('VIEW', 'UNLOCK_SUCCESS', 'UNLOCK_FAIL');

-- CreateTable
CREATE TABLE "VbvOffer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "churchName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "offerHtml" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VbvOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VbvOfferAccessLog" (
    "id" TEXT NOT NULL,
    "offerId" TEXT,
    "slug" TEXT NOT NULL,
    "type" "VbvOfferAccessType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VbvOfferAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VbvOffer_slug_key" ON "VbvOffer"("slug");

-- AddForeignKey
ALTER TABLE "VbvOfferAccessLog" ADD CONSTRAINT "VbvOfferAccessLog_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "VbvOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

