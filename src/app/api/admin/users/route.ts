import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAdminUser, hashPassword, requireAdminUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  await ensureDefaultAdminUser();

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || password.length < 4) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  try {
    const user = await prisma.adminUser.create({
      data: {
        username: username.trim(),
        passwordHash: await hashPassword(password),
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That username is already in use" }, { status: 409 });
  }
}
