import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdminUser, verifyPassword } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { adminUser, unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { username, currentPassword, newPassword } = await req.json().catch(() => ({}));

  if (typeof username !== "string" && typeof newPassword !== "string") {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  if (typeof newPassword === "string" && newPassword.length > 0 && newPassword.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }

  if (typeof newPassword === "string") {
    if (id !== adminUser.id) {
      return NextResponse.json({ error: "Only the current signed-in officer can change their password here" }, { status: 403 });
    }

    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    const self = await prisma.adminUser.findUnique({ where: { id } });
    if (!self) {
      return NextResponse.json({ error: "Security officer not found" }, { status: 404 });
    }

    const valid = await verifyPassword(self.passwordHash, currentPassword);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  try {
    const user = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(typeof username === "string" ? { username: username.trim() || "admin" } : {}),
        ...(typeof newPassword === "string" && newPassword.length >= 4 ? { token: null } : {}),
        ...(typeof newPassword === "string" && newPassword.length >= 4 ? { passwordHash: await hashPassword(newPassword) } : {}),
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
