import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEVICE_ONLINE_MS } from '@/lib/devices'
import { ROOM_OPTIONS } from '@/lib/rooms'

export async function GET() {
  const cutoff = new Date(Date.now() - DEVICE_ONLINE_MS)
  const devices = await prisma.device.findMany({
    where: {
      assignedRoomId: { not: null },
      lastSeenAt: { gte: cutoff },
      lastAudioLevel: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const roomMap = new Map(
    ROOM_OPTIONS.map((room) => [
      room.id,
      { id: room.id, floor: room.floor, name: room.name, audioLevel: null as number | null, activeDeviceCount: 0, updatedAt: null as Date | null },
    ])
  )

  for (const device of devices) {
    if (!device.assignedRoomId || device.lastAudioLevel == null) continue
    const room = roomMap.get(device.assignedRoomId)
    if (!room) continue

    room.audioLevel = room.audioLevel == null
      ? device.lastAudioLevel
      : (room.audioLevel * room.activeDeviceCount + device.lastAudioLevel) / (room.activeDeviceCount + 1)
    room.activeDeviceCount += 1
    room.updatedAt = room.updatedAt && device.lastSeenAt && room.updatedAt > device.lastSeenAt ? room.updatedAt : device.lastSeenAt
  }

  return NextResponse.json(Array.from(roomMap.values()))
}
