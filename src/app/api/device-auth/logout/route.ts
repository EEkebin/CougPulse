import { NextRequest, NextResponse } from "next/server";
import { requireDeviceAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { deviceAccount } = await requireDeviceAccount(req);

  if (deviceAccount) {
    await prisma.deviceAccount.update({
      where: { id: deviceAccount.id },
      data: { token: null },
    });
  }

  return NextResponse.json({ ok: true });
}
