import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/auth";

export async function GET() {
  const floors = await prisma.floor.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      rooms: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json(floors);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { name } = await req.json().catch(() => ({}));
  const sortOrder = await prisma.floor.count();

  const floor = await prisma.floor.create({
    data: {
      name: typeof name === "string" && name.trim() ? name.trim() : `Floor ${sortOrder + 1}`,
      sortOrder: sortOrder + 1,
    },
    include: { rooms: true },
  });

  return NextResponse.json(floor, { status: 201 });
}
