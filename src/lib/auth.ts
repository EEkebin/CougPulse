import "server-only";

import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_TOKEN_HEADER,
  DEVICE_TOKEN_HEADER,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
} from "@/lib/auth-shared";

export function issueAdminToken() {
  return randomUUID();
}

export function issueDeviceToken() {
  return randomUUID();
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
      token: null,
    },
  });
}

export async function getAuthenticatedAdminUser(req: NextRequest) {
  const token = req.headers.get(ADMIN_TOKEN_HEADER);
  if (!token) return null;

  return prisma.adminUser.findUnique({
    where: { token },
  });
}

export async function getAuthenticatedDeviceAccount(req: NextRequest) {
  const token = req.headers.get(DEVICE_TOKEN_HEADER);
  if (!token) return null;

  return prisma.deviceAccount.findUnique({
    where: { token },
    include: {
      device: true,
    },
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

export async function requireDeviceAccount(req: NextRequest) {
  const deviceAccount = await getAuthenticatedDeviceAccount(req);
  if (!deviceAccount) {
    return {
      deviceAccount: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    deviceAccount,
    unauthorized: null,
  };
}

export async function requireDeviceOrAdmin(req: NextRequest, deviceId: string) {
  const adminUser = await getAuthenticatedAdminUser(req);
  if (adminUser) {
    return {
      adminUser,
      device: null,
      unauthorized: null,
    };
  }

  const deviceAccount = await getAuthenticatedDeviceAccount(req);
  if (!deviceAccount || deviceAccount.device?.id !== deviceId) {
    return {
      adminUser: null,
      device: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    adminUser: null,
    device: deviceAccount.device,
    unauthorized: null,
  };
}
