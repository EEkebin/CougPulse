import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { id } = await params
  const { clear = false } = await req.json().catch(() => ({}))

  const alert = await prisma.securityAlert.update({
    where: { id },
    data: clear ? { clearedAt: new Date() } : {},
  })

  return NextResponse.json(alert)
}
