CREATE TABLE "DeviceAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Device"
ADD COLUMN "accountId" TEXT;

CREATE UNIQUE INDEX "DeviceAccount_username_key" ON "DeviceAccount"("username");
CREATE UNIQUE INDEX "DeviceAccount_token_key" ON "DeviceAccount"("token");
CREATE UNIQUE INDEX "Device_accountId_key" ON "Device"("accountId");

ALTER TABLE "Device"
ADD CONSTRAINT "Device_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "DeviceAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
