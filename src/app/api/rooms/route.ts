import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FLOOR_ROOMS } from "@/lib/rooms";

export async function GET() {
  const readings = await prisma.roomReading.findMany();
  const map = Object.fromEntries(readings.map((r) => [r.roomNumber, r]));

  const rooms = FLOOR_ROOMS.map((room) => ({
    ...room,
    reading: map[room.number] ?? null,
  }));

  return NextResponse.json(rooms);
}
