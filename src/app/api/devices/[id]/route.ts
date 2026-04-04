import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser, requireDeviceOrAdmin } from '@/lib/auth'
import { decryptOptionalString, encryptOptionalString } from '@/lib/secure-models'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { unauthorized } = await requireDeviceOrAdmin(_req, id)
  if (unauthorized) return unauthorized

  const device = await prisma.device.findUnique({ where: { id } })

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...device,
    name: decryptOptionalString(device.nameEncrypted, device.nameIv, device.name),
    previewImage: decryptOptionalString(device.previewData, device.previewIv, device.previewImage),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { id } = await params
  const { name, assignedRoomId } = await req.json()
  const encryptedName = typeof name === 'string' && name.trim() ? encryptOptionalString(name) : null

  const device = await prisma.device.update({
    where: { id },
    data: {
      ...(encryptedName ? { name: "Encrypted Device", nameEncrypted: encryptedName.encrypted, nameIv: encryptedName.iv } : {}),
      ...(typeof assignedRoomId === 'string' || assignedRoomId === null ? { assignedRoomId } : {}),
    },
  })

  return NextResponse.json({
    ...device,
    name: decryptOptionalString(device.nameEncrypted, device.nameIv, device.name),
    previewImage: decryptOptionalString(device.previewData, device.previewIv, device.previewImage),
  })
}
