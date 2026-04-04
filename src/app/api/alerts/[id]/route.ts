import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { clear = false } = await req.json().catch(() => ({}))

  const alert = await prisma.securityAlert.update({
    where: { id },
    data: clear ? { clearedAt: new Date() } : {},
  })

  return NextResponse.json(alert)
}
