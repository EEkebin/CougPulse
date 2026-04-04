import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'
import { hashToken } from '@/lib/crypto'
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
  const { name, clientKey } = await req.json().catch(() => ({}))
  const trimmedName = typeof name === 'string' && name.trim() ? name.trim() : 'Unassigned Device'
  const trimmedClientKey = typeof clientKey === 'string' && clientKey.trim() ? clientKey.trim() : null

  if (!trimmedClientKey) {
    return NextResponse.json({ error: 'Missing clientKey' }, { status: 400 })
  }

  const encryptedName = encryptOptionalString(trimmedName)
  const clientKeyHash = hashToken(trimmedClientKey)

  const existing = await prisma.device.findFirst({
    where: {
      OR: [
        { clientKey: clientKeyHash },
        { clientKey: trimmedClientKey },
      ],
    },
  })

  const device = existing
    ? await prisma.device.update({
        where: { id: existing.id },
        data: {
          clientKey: clientKeyHash,
          lastSeenAt: new Date(),
        },
      })
    : await prisma.device.create({
        data: {
          clientKey: clientKeyHash,
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
