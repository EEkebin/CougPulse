ALTER TABLE "Device"
ADD COLUMN "clientKey" TEXT;

UPDATE "Device"
SET "clientKey" = 'legacy-' || "id"
WHERE "clientKey" IS NULL;

ALTER TABLE "Device"
ALTER COLUMN "clientKey" SET NOT NULL;

CREATE UNIQUE INDEX "Device_clientKey_key" ON "Device"("clientKey");
