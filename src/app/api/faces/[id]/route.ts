import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { id } = await params
  const { isTroublemaker, notes } = await req.json()

  const subject = await prisma.subject.update({
    where: { id },
    data: {
      ...(typeof isTroublemaker === 'boolean' ? { isTroublemaker } : {}),
      ...(typeof notes === 'string' || notes === null ? { notes: notes?.trim() || null } : {}),
    },
  })

  return NextResponse.json({
    id: subject.id,
    isTroublemaker: subject.isTroublemaker,
    notes: subject.notes,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(_req)
  if (unauthorized) return unauthorized

  const { id } = await params
  await prisma.subject.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
