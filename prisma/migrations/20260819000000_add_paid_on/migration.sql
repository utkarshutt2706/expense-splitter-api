-- Add paid dates without losing the historical creation date.
ALTER TABLE "expenses" ADD COLUMN "paidOn" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "paidOn" TIMESTAMP(3);

UPDATE "expenses" SET "paidOn" = "createdAt" WHERE "paidOn" IS NULL;
UPDATE "payments" SET "paidOn" = "createdAt" WHERE "paidOn" IS NULL;

ALTER TABLE "expenses" ALTER COLUMN "paidOn" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "expenses" ALTER COLUMN "paidOn" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "paidOn" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ALTER COLUMN "paidOn" SET NOT NULL;
