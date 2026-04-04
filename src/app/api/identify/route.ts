import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

const MATCH_THRESHOLD = 0.55;

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

export async function POST(req: NextRequest) {
  const { descriptor } = await req.json();

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json(
      { error: "descriptor must be a 128-element array" },
      { status: 400 }
    );
  }

  const rows = await prisma.face.findMany();

  let bestMatch: { name: string; distance: number } | null = null;

  for (const row of rows) {
    const stored = JSON.parse(decrypt(row.descriptorEncrypted)) as number[];
    const distance = euclideanDistance(descriptor, stored);
    if (distance < MATCH_THRESHOLD && (!bestMatch || distance < bestMatch.distance)) {
      bestMatch = { name: row.name, distance };
    }
  }

  return NextResponse.json(
    bestMatch ? { name: bestMatch.name } : { name: null }
  );
}
