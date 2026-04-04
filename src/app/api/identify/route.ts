import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptSubject } from '@/lib/crypto'
import { requireAdminUser } from '@/lib/auth'

function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

const THRESHOLD = 0.6

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { descriptor, deviceId, faceImage } = await req.json()
  if (!Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Missing descriptor' }, { status: 400 })
  }

  const query = new Float32Array(descriptor)
  const subjects = await prisma.subject.findMany()

  let best: { id: string; name: string; distance: number } | null = null

  for (const s of subjects) {
    const { name, descriptor: stored } = decryptSubject(s.data, s.iv)
    const distance = euclideanDistance(query, stored)
    if (!best || distance < best.distance) {
      best = { id: s.id, name, distance }
    }
  }

  if (!best || best.distance > THRESHOLD) {
    return NextResponse.json({ match: null, label: 'UNKNOWN' })
  }

  const subject = await prisma.subject.findUnique({ where: { id: best.id } })
  const device = typeof deviceId === 'string' && deviceId
    ? await prisma.device.findUnique({ where: { id: deviceId } })
    : null

  if (device && !device.assignedRoomId) {
    return NextResponse.json({
      match: best.id,
      label: best.name,
      distance: best.distance,
      isTroublemaker: false,
      notes: null,
      deviceId: device.id,
      roomId: null,
      alertCreated: false,
      blocked: 'DEVICE_UNASSIGNED',
    })
  }

  let alertCreated = false

  if (subject?.isTroublemaker) {
    const existingAlert = await prisma.securityAlert.findFirst({
      where: {
        subjectId: best.id,
        deviceId: device?.id ?? null,
        roomId: device?.assignedRoomId ?? null,
        clearedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!existingAlert) {
      await prisma.securityAlert.create({
        data: {
          subjectId: best.id,
          subjectName: best.name,
          deviceId: device?.id ?? null,
          deviceName: device?.name ?? null,
          roomId: device?.assignedRoomId ?? null,
          note: subject.notes,
          faceImage: typeof faceImage === 'string' ? faceImage : null,
        },
      })
      alertCreated = true
    }
  }

  return NextResponse.json({
    match: best.id,
    label: best.name,
    distance: best.distance,
    isTroublemaker: subject?.isTroublemaker ?? false,
    notes: subject?.notes ?? null,
    deviceId: device?.id ?? null,
    roomId: device?.assignedRoomId ?? null,
    alertCreated,
  })
}
