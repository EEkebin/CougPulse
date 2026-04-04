import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { id } = await params
  const { audioLevel, previewImage } = await req.json().catch(() => ({}))
  const existing = await prisma.device.findUnique({ where: { id } })

  if (!existing) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  const device = await prisma.device.update({
    where: { id },
    data: {
      lastSeenAt: new Date(),
      ...(typeof audioLevel === 'number' && existing.assignedRoomId ? { lastAudioLevel: audioLevel } : {}),
      ...(typeof previewImage === 'string'
        ? {
            previewImage,
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

  return NextResponse.json({ ok: true, device, reportingEnabled: Boolean(device.assignedRoomId) })
}
