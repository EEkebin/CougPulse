import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { floorId, name, shape = "polygon", points } = await req.json().catch(() => ({}));

  if (typeof floorId !== "string" || !Array.isArray(points) || points.length < 3) {
    return NextResponse.json({ error: "Missing floorId or valid points" }, { status: 400 });
  }

  const room = await prisma.room.create({
    data: {
      floorId,
      name: typeof name === "string" && name.trim() ? name.trim() : "Untitled Room",
      shape,
      points,
    },
  });

  return NextResponse.json(room, { status: 201 });
}
