-- Три вида баланса: реальные, бонусный, депозит под промокод
ALTER TABLE "User" ADD COLUMN "balanceCash" REAL NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "balanceBonus" REAL NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "balancePromoDeposit" REAL NOT NULL DEFAULT 0;

UPDATE "User" SET "balanceCash" = "balance";
