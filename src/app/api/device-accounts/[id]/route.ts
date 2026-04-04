import { NextRequest, NextResponse } from "next/server";
import { hashPassword, requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { username, newPassword, revokeToken } = await req.json().catch(() => ({}));

  if (typeof username !== "string" && typeof newPassword !== "string" && revokeToken !== true) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  if (typeof newPassword === "string" && newPassword.length > 0 && newPassword.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }

  try {
    const account = await prisma.deviceAccount.update({
      where: { id },
      data: {
        ...(typeof username === "string" ? { username: username.trim() || "device" } : {}),
        ...(typeof newPassword === "string" && newPassword.length >= 4 ? { passwordHash: await hashPassword(newPassword), token: null } : {}),
        ...(revokeToken === true ? { token: null } : {}),
      },
      include: { device: true },
    });

    return NextResponse.json({
      id: account.id,
      username: account.username,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deviceId: account.device?.id ?? null,
      assignedRoomId: account.device?.assignedRoomId ?? null,
      activeSession: Boolean(account.token),
    });
  } catch {
    return NextResponse.json({ error: "Could not update that device account" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  try {
    await prisma.deviceAccount.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete that device account" }, { status: 400 });
  }
}
