import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const devices = await prisma.device.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json(devices)
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { name, clientKey } = await req.json().catch(() => ({}))
  const trimmedName = typeof name === 'string' && name.trim() ? name.trim() : 'Unassigned Device'
  const trimmedClientKey = typeof clientKey === 'string' && clientKey.trim() ? clientKey.trim() : null

  if (!trimmedClientKey) {
    return NextResponse.json({ error: 'Missing clientKey' }, { status: 400 })
  }

  const device = await prisma.device.upsert({
    where: { clientKey: trimmedClientKey },
    update: {
      lastSeenAt: new Date(),
    },
    create: {
      clientKey: trimmedClientKey,
      name: trimmedName,
      lastSeenAt: new Date(),
    },
  })

  return NextResponse.json(device, { status: 201 })
}
