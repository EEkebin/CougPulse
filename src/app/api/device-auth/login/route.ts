import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { issueDeviceToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptOptionalString, encryptOptionalString } from "@/lib/secure-models";

const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const LOGIN_ATTEMPT_LIMIT = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  const normalizedUsername = typeof username === "string" ? username.trim() : "";
  const rateLimitKey = `${req.headers.get("x-forwarded-for") ?? "local"}:${normalizedUsername.toLowerCase() || "unknown"}`;
  const current = loginAttempts.get(rateLimitKey);
  const now = Date.now();

  if (current && current.resetAt > now && current.count >= LOGIN_ATTEMPT_LIMIT) {
    return NextResponse.json({ error: "Too many device login attempts. Try again later." }, { status: 429 });
  }

  if (!current || current.resetAt <= now) {
    loginAttempts.set(rateLimitKey, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
  }

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const deviceAccount = await prisma.deviceAccount.findUnique({
    where: { username: normalizedUsername },
    include: { device: true },
  });

  if (!deviceAccount) {
    const attempt = loginAttempts.get(rateLimitKey);
    if (attempt) attempt.count += 1;
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const valid = await verifyPassword(deviceAccount.passwordHash, password);
  if (!valid) {
    const attempt = loginAttempts.get(rateLimitKey);
    if (attempt) attempt.count += 1;
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  loginAttempts.delete(rateLimitKey);

  const token = issueDeviceToken();
  const existingDevice = deviceAccount.device;
  const encryptedName = encryptOptionalString(existingDevice?.name ? decryptOptionalString(existingDevice.nameEncrypted, existingDevice.nameIv, existingDevice.name) : deviceAccount.username);

  const [, pairedDevice] = await prisma.$transaction([
    prisma.deviceAccount.update({
      where: { id: deviceAccount.id },
      data: { token },
    }),
    existingDevice
      ? prisma.device.update({
          where: { id: existingDevice.id },
          data: {
            accountId: deviceAccount.id,
            lastSeenAt: new Date(),
          },
        })
      : prisma.device.create({
          data: {
            clientKey: `account-${randomUUID()}`,
            accountId: deviceAccount.id,
            name: "Encrypted Device",
            nameEncrypted: encryptedName.encrypted,
            nameIv: encryptedName.iv,
            lastSeenAt: new Date(),
          },
        }),
  ]);

  return NextResponse.json({
    ok: true,
    token,
    account: {
      id: deviceAccount.id,
      username: deviceAccount.username,
    },
    device: {
      ...pairedDevice,
      name: decryptOptionalString(pairedDevice.nameEncrypted, pairedDevice.nameIv, pairedDevice.name),
      previewImage: decryptOptionalString(pairedDevice.previewData, pairedDevice.previewIv, pairedDevice.previewImage),
    },
  });
}
