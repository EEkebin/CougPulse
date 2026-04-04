import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ActivityBucket = {
  bucketStart: string;
  avgLevel: number | null;
  sampleCount: number;
};

export async function GET() {
  const now = Date.now();
  const bucketMs = 30 * 1000;
  const windowMs = 10 * 60 * 1000;
  const bucketCount = Math.floor(windowMs / bucketMs);
  const endMs = Math.floor(now / bucketMs) * bucketMs;
  const startMs = endMs - (bucketCount - 1) * bucketMs;
  const cutoff = new Date(startMs);

  const readings = await prisma.roomReading.findMany({
    where: {
      createdAt: { gte: cutoff },
    },
    select: {
      createdAt: true,
      audioLevel: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    bucketStart: new Date(startMs + index * bucketMs).toISOString(),
    avgLevel: null as number | null,
    sampleCount: 0,
    sum: 0,
  }));

  for (const reading of readings) {
    const createdAtMs = reading.createdAt.getTime();
    const bucketIndex = Math.floor((createdAtMs - startMs) / bucketMs);
    if (bucketIndex < 0 || bucketIndex >= bucketCount) continue;

    const bucket = buckets[bucketIndex];
    bucket.sum += reading.audioLevel;
    bucket.sampleCount += 1;
  }

  const points: ActivityBucket[] = buckets.map((bucket) => ({
    bucketStart: bucket.bucketStart,
    avgLevel: bucket.sampleCount > 0 ? Math.round(bucket.sum / bucket.sampleCount) : null,
    sampleCount: bucket.sampleCount,
  }));

  return NextResponse.json({
    points,
    generatedAt: new Date(now).toISOString(),
  });
}
