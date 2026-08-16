ALTER TABLE "expenses" ADD COLUMN "createdByUserId" TEXT;

-- Existing rows predate creator tracking. The payer is the closest available
-- attribution and preserves a valid group member for historical expenses.
UPDATE "expenses" SET "createdByUserId" = "paidByUserId";

ALTER TABLE "expenses" ALTER COLUMN "createdByUserId" SET NOT NULL;

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
