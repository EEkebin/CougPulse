import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { adminUser, unauthorized } = await requireAdminUser(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    id: adminUser.id,
    username: adminUser.username,
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
  });
}
