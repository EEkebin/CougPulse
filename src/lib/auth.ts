import "server-only";

import argon2 from "argon2";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_SESSION_COOKIE,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  getAdminSessionSecret,
} from "@/lib/auth-shared";

function signValue(value: string) {
  return createHmac("sha256", getAdminSessionSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function createSessionToken(adminUserId: string) {
  return `${adminUserId}.${signValue(adminUserId)}`;
}

export function verifySessionToken(token: string | undefined | null) {
  if (!token) return null;
  const [adminUserId, signature] = token.split(".");
  if (!adminUserId || !signature) return null;
  const expectedSignature = signValue(adminUserId);
  return safeEqual(signature, expectedSignature) ? adminUserId : null;
}

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(passwordHash: string, password: string) {
  return argon2.verify(passwordHash, password);
}

export async function ensureDefaultAdminUser() {
  const count = await prisma.adminUser.count();
  if (count > 0) return;

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  await prisma.adminUser.create({
    data: {
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
    },
  });
}

export async function getAuthenticatedAdminUser(req: NextRequest) {
  const adminUserId = verifySessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!adminUserId) return null;

  return prisma.adminUser.findUnique({
    where: { id: adminUserId },
  });
}

export async function requireAdminUser(req: NextRequest) {
  const adminUser = await getAuthenticatedAdminUser(req);
  if (!adminUser) {
    return {
      adminUser: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    adminUser,
    unauthorized: null,
  };
}
