import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'
import { decryptAlertPayload } from '@/lib/secure-models'

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const includeCleared = req.nextUrl.searchParams.get('includeCleared') === 'true'
  const alerts = await prisma.securityAlert.findMany({
    where: includeCleared ? undefined : { clearedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(alerts.map((alert) => {
    const decrypted = decryptAlertPayload(alert.data, alert.iv, {
      subjectName: alert.subjectName,
      deviceName: alert.deviceName,
      note: alert.note,
      faceImage: alert.faceImage,
    })

    return {
      ...alert,
      subjectName: decrypted.subjectName,
      deviceName: decrypted.deviceName,
      note: decrypted.note,
      faceImage: decrypted.faceImage,
    }
  }))
}

export async function PATCH(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const result = await prisma.securityAlert.updateMany({
    where: { clearedAt: null },
    data: { clearedAt: new Date() },
  })

  return NextResponse.json({ ok: true, cleared: result.count })
}
