import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const includeCleared = req.nextUrl.searchParams.get('includeCleared') === 'true'
  const alerts = await prisma.securityAlert.findMany({
    where: includeCleared ? undefined : { clearedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(alerts)
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
