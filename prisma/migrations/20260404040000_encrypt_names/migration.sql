-- Drop old Subject table (schema incompatible: name+descriptor now encrypted together)
DROP TABLE IF EXISTS "Subject";

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);
