import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEVICE_ONLINE_MS } from '@/lib/devices'
import { ROOM_MAP } from '@/lib/rooms'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!ROOM_MAP.has(id)) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  const cutoff = new Date(Date.now() - DEVICE_ONLINE_MS)
  const devices = await prisma.device.findMany({
    where: {
      assignedRoomId: id,
      lastSeenAt: { gte: cutoff },
      lastAudioLevel: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const average = devices.length
    ? devices.reduce((sum, device) => sum + (device.lastAudioLevel ?? 0), 0) / devices.length
    : null

  return NextResponse.json({
    id,
    room: ROOM_MAP.get(id),
    audioLevel: average,
    activeDeviceCount: devices.length,
    updatedAt: devices[0]?.lastSeenAt ?? null,
  })
}
