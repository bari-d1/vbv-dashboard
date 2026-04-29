-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IgAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "username" TEXT NOT NULL DEFAULT '',
    "views" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_IgAccount" ("followers", "id", "updatedAt", "username") SELECT "followers", "id", "updatedAt", "username" FROM "IgAccount";
DROP TABLE "IgAccount";
ALTER TABLE "new_IgAccount" RENAME TO "IgAccount";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
