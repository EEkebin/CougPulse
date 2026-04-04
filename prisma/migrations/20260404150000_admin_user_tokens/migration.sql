ALTER TABLE "AdminUser"
ADD COLUMN "token" TEXT;

CREATE UNIQUE INDEX "AdminUser_token_key" ON "AdminUser"("token");
