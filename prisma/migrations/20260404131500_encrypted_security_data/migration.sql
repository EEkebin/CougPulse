ALTER TABLE "Subject"
ADD COLUMN "notesEncrypted" BYTEA,
ADD COLUMN "notesIv" BYTEA;

ALTER TABLE "Device"
ADD COLUMN "nameEncrypted" BYTEA,
ADD COLUMN "nameIv" BYTEA,
ADD COLUMN "previewData" BYTEA,
ADD COLUMN "previewIv" BYTEA;

ALTER TABLE "SecurityAlert"
ADD COLUMN "data" BYTEA,
ADD COLUMN "iv" BYTEA;
