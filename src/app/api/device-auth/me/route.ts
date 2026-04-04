import { NextRequest, NextResponse } from "next/server";
import { requireDeviceAccount } from "@/lib/auth";
import { decryptOptionalString } from "@/lib/secure-models";

export async function GET(req: NextRequest) {
  const { deviceAccount, unauthorized } = await requireDeviceAccount(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    id: deviceAccount.id,
    username: deviceAccount.username,
    createdAt: deviceAccount.createdAt,
    updatedAt: deviceAccount.updatedAt,
    device: deviceAccount.device
      ? {
          ...deviceAccount.device,
          name: decryptOptionalString(deviceAccount.device.nameEncrypted, deviceAccount.device.nameIv, deviceAccount.device.name),
          previewImage: decryptOptionalString(deviceAccount.device.previewData, deviceAccount.device.previewIv, deviceAccount.device.previewImage),
        }
      : null,
  });
}
