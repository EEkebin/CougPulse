import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { adminUser } = await requireAdminUser(req);

  if (adminUser) {
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { token: null },
    });
  }

  return NextResponse.json({
    ok: true,
  });
}
