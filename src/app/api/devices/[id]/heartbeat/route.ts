import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDeviceOrAdmin } from '@/lib/auth'
import { decryptOptionalString, encryptOptionalString } from '@/lib/secure-models'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { unauthorized } = await requireDeviceOrAdmin(req, id)
  if (unauthorized) return unauthorized

  const { audioLevel, previewImage } = await req.json().catch(() => ({}))
  const existing = await prisma.device.findUnique({ where: { id } })

  if (!existing) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  const encryptedPreview = typeof previewImage === 'string' ? encryptOptionalString(previewImage) : null

  const device = await prisma.device.update({
    where: { id },
    data: {
      lastSeenAt: new Date(),
      ...(typeof audioLevel === 'number' && existing.assignedRoomId ? { lastAudioLevel: audioLevel } : {}),
      ...(encryptedPreview
        ? {
            previewImage: null,
            previewData: encryptedPreview.encrypted,
            previewIv: encryptedPreview.iv,
            previewTakenAt: new Date(),
          }
        : {}),
    },
  })

  if (typeof audioLevel === 'number' && device.assignedRoomId) {
    await prisma.roomReading.create({
      data: {
        roomId: device.assignedRoomId,
        deviceId: device.id,
        audioLevel,
      },
    })
  }

  return NextResponse.json({
    ok: true,
    device: {
      ...device,
      name: decryptOptionalString(device.nameEncrypted, device.nameIv, device.name),
      previewImage: decryptOptionalString(device.previewData, device.previewIv, device.previewImage),
    },
    reportingEnabled: Boolean(device.assignedRoomId),
  })
}
