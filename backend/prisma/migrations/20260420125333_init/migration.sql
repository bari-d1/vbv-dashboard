-- CreateTable
CREATE TABLE "SyncLog" (
    "platform" TEXT NOT NULL PRIMARY KEY,
    "lastSyncedAt" DATETIME NOT NULL,
    "syncedFrom" DATETIME,
    "syncedTo" DATETIME
);

-- CreateTable
CREATE TABLE "IgAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "username" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IgDailyMetric" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IgPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaType" TEXT NOT NULL DEFAULT '',
    "thumbnail" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" REAL NOT NULL DEFAULT 0,
    "postedAt" TEXT NOT NULL DEFAULT '',
    "syncedAt" DATETIME NOT NULL
);
