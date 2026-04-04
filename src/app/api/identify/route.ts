import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptSubject } from '@/lib/crypto'
import { requireDeviceOrAdmin } from '@/lib/auth'
import { decryptOptionalString, encryptAlertPayload } from '@/lib/secure-models'

function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

const THRESHOLD = 0.6

export async function POST(req: NextRequest) {
  const { descriptor, deviceId, faceImage } = await req.json()
  if (!Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Missing descriptor' }, { status: 400 })
  }
  if (typeof deviceId !== 'string' || !deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  }

  const { unauthorized } = await requireDeviceOrAdmin(req, deviceId)
  if (unauthorized) return unauthorized

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
  const device = await prisma.device.findUnique({ where: { id: deviceId } })

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
          subjectName: '[encrypted]',
          deviceId: device?.id ?? null,
          deviceName: null,
          roomId: device?.assignedRoomId ?? null,
          note: null,
          faceImage: null,
          ...(() => {
            const encryptedAlert = encryptAlertPayload({
              subjectName: best.name,
              deviceName: decryptOptionalString(device?.nameEncrypted, device?.nameIv, device?.name ?? null),
              note: decryptOptionalString(subject?.notesEncrypted, subject?.notesIv, subject?.notes ?? null),
              faceImage: typeof faceImage === 'string' ? faceImage : null,
            })
            return {
              data: encryptedAlert.data,
              iv: encryptedAlert.iv,
            }
          })(),
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
    notes: decryptOptionalString(subject?.notesEncrypted, subject?.notesIv, subject?.notes ?? null),
    deviceId: device?.id ?? null,
    roomId: device?.assignedRoomId ?? null,
    alertCreated,
  })
}
