import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;
  const { dbLevel, occupants } = await req.json();

  if (typeof dbLevel !== "number" || !Array.isArray(occupants)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const reading = await prisma.roomReading.upsert({
    where: { roomNumber: number },
    create: { roomNumber: number, dbLevel, occupants },
    update: { dbLevel, occupants },
  });

  return NextResponse.json(reading);
}
