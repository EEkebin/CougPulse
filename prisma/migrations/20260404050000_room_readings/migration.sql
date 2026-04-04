CREATE TABLE "RoomReading" (
    "id"         TEXT             NOT NULL,
    "audioLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt"  TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "RoomReading_pkey" PRIMARY KEY ("id")
);
