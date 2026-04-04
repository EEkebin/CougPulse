import { NextRequest, NextResponse } from "next/server";
import { hashPassword, requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const accounts = await prisma.deviceAccount.findMany({
    orderBy: { createdAt: "asc" },
    include: { device: true },
  });

  return NextResponse.json(
    accounts.map((account) => ({
      id: account.id,
      username: account.username,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deviceId: account.device?.id ?? null,
      assignedRoomId: account.device?.assignedRoomId ?? null,
      activeSession: Boolean(account.token),
    }))
  );
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || password.length < 4) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  try {
    const account = await prisma.deviceAccount.create({
      data: {
        username: username.trim(),
        passwordHash: await hashPassword(password),
      },
      include: { device: true },
    });

    return NextResponse.json(
      {
        id: account.id,
        username: account.username,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        deviceId: account.device?.id ?? null,
        assignedRoomId: account.device?.assignedRoomId ?? null,
        activeSession: Boolean(account.token),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "That device username is already in use" }, { status: 409 });
  }
}
