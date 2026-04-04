import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { name, floorPlanImage, sortOrder } = await req.json().catch(() => ({}));

  const floor = await prisma.floor.update({
    where: { id },
    data: {
      ...(typeof name === "string" ? { name: name.trim() || "Untitled Floor" } : {}),
      ...(typeof floorPlanImage === "string" || floorPlanImage === null ? { floorPlanImage } : {}),
      ...(typeof sortOrder === "number" ? { sortOrder } : {}),
    },
    include: { rooms: true },
  });

  return NextResponse.json(floor);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(_req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await prisma.floor.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
