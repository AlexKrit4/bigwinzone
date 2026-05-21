PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Deposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "bonusAmount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'yoomoney',
    "label" TEXT NOT NULL,
    "externalId" TEXT,
    "promoCodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deposit_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deposit" ("id", "userId", "amount", "bonusAmount", "currency", "status", "provider", "label", "externalId", "promoCodeId", "createdAt", "completedAt")
SELECT "id", "userId", "amount", 0, "currency", "status", "provider", "label", "externalId", NULL, "createdAt", "completedAt" FROM "Deposit";
DROP TABLE "Deposit";
ALTER TABLE "new_Deposit" RENAME TO "Deposit";
CREATE UNIQUE INDEX "Deposit_label_key" ON "Deposit"("label");
CREATE UNIQUE INDEX "Deposit_externalId_key" ON "Deposit"("externalId");
CREATE INDEX "Deposit_userId_createdAt_idx" ON "Deposit"("userId", "createdAt");
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

CREATE TABLE "new_PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "depositBonusPercent" REAL NOT NULL DEFAULT 0,
    "wagerMultiplier" REAL NOT NULL DEFAULT 1,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PromoCode" ("id", "code", "depositBonusPercent", "wagerMultiplier", "maxUses", "usedCount", "active", "expiresAt", "createdAt")
SELECT "id", "code", 0, 3, "maxUses", "usedCount", "active", "expiresAt", "createdAt" FROM "PromoCode";
DROP TABLE "PromoCode";
ALTER TABLE "new_PromoCode" RENAME TO "PromoCode";
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

DROP TABLE IF EXISTS "PromoRedemption";

CREATE TABLE "PromoActivation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING_DEPOSIT',
    "depositId" TEXT,
    "depositAmount" REAL NOT NULL DEFAULT 0,
    "bonusAmount" REAL NOT NULL DEFAULT 0,
    "wagerRequired" REAL NOT NULL DEFAULT 0,
    "wagerProgress" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "PromoActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromoActivation_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromoActivation_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PromoActivation_depositId_key" ON "PromoActivation"("depositId");
CREATE UNIQUE INDEX "PromoActivation_promoCodeId_userId_key" ON "PromoActivation"("promoCodeId", "userId");
CREATE INDEX "PromoActivation_userId_status_idx" ON "PromoActivation"("userId", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
