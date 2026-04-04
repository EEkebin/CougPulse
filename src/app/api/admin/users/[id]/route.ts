import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdminUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { username, password } = await req.json().catch(() => ({}));

  if (typeof username !== "string" && typeof password !== "string") {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  try {
    const user = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(typeof username === "string" ? { username: username.trim() || "admin" } : {}),
        ...(typeof password === "string" && password.length >= 4 ? { passwordHash: await hashPassword(password) } : {}),
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Could not update that security officer" }, { status: 400 });
  }
}
