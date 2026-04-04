import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { name, shape, points } = await req.json().catch(() => ({}));

  const room = await prisma.room.update({
    where: { id },
    data: {
      ...(typeof name === "string" ? { name: name.trim() || "Untitled Room" } : {}),
      ...(typeof shape === "string" ? { shape } : {}),
      ...(Array.isArray(points) ? { points } : {}),
    },
  });

  return NextResponse.json(room);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(_req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await prisma.room.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
