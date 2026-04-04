import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'
import { decryptOptionalString, encryptOptionalString } from '@/lib/secure-models'

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const devices = await prisma.device.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json(devices.map((device) => ({
    ...device,
    name: decryptOptionalString(device.nameEncrypted, device.nameIv, device.name),
    previewImage: decryptOptionalString(device.previewData, device.previewIv, device.previewImage),
  })))
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { name } = await req.json().catch(() => ({}))
  const trimmedName = typeof name === 'string' && name.trim() ? name.trim() : 'Unassigned Device'
  const encryptedName = encryptOptionalString(trimmedName)

  const device = await prisma.device.create({
    data: {
      clientKey: crypto.randomUUID(),
      name: "Encrypted Device",
      nameEncrypted: encryptedName.encrypted,
      nameIv: encryptedName.iv,
      lastSeenAt: new Date(),
    },
  })

  return NextResponse.json({
    ...device,
    name: decryptOptionalString(device.nameEncrypted, device.nameIv, device.name),
    previewImage: decryptOptionalString(device.previewData, device.previewIv, device.previewImage),
  }, { status: 201 })
}
