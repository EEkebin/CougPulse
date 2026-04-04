import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultAdminUser, issueAdminToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const LOGIN_ATTEMPT_LIMIT = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  await ensureDefaultAdminUser();
  const { username, password } = await req.json().catch(() => ({}));
  const rateLimitKey = `${req.headers.get("x-forwarded-for") ?? "local"}:${typeof username === "string" ? username.trim().toLowerCase() : "unknown"}`;
  const current = loginAttempts.get(rateLimitKey);
  const now = Date.now();

  if (current && current.resetAt > now && current.count >= LOGIN_ATTEMPT_LIMIT) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  if (!current || current.resetAt <= now) {
    loginAttempts.set(rateLimitKey, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
  }

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { username: username.trim() },
  });

  if (!adminUser) {
    const attempt = loginAttempts.get(rateLimitKey);
    if (attempt) attempt.count += 1;
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const valid = await verifyPassword(adminUser.passwordHash, password);
  if (!valid) {
    const attempt = loginAttempts.get(rateLimitKey);
    if (attempt) attempt.count += 1;
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  loginAttempts.delete(rateLimitKey);

  const token = issueAdminToken();
  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: { token },
  });

  return NextResponse.json({
    ok: true,
    token,
    user: {
      id: adminUser.id,
      username: adminUser.username,
    },
  });
}
