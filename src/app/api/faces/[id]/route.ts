import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminUser } from '@/lib/auth'
import { decryptOptionalString, encryptOptionalString } from '@/lib/secure-models'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { id } = await params
  const { isTroublemaker, notes } = await req.json()
  const encryptedNotes = typeof notes === 'string' || notes === null ? encryptOptionalString(notes) : null

  const subject = await prisma.subject.update({
    where: { id },
    data: {
      ...(typeof isTroublemaker === 'boolean' ? { isTroublemaker } : {}),
      ...(encryptedNotes ? { notes: null, notesEncrypted: encryptedNotes.encrypted, notesIv: encryptedNotes.iv } : {}),
    },
  })

  return NextResponse.json({
    id: subject.id,
    isTroublemaker: subject.isTroublemaker,
    notes: decryptOptionalString(subject.notesEncrypted, subject.notesIv, subject.notes),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminUser(_req)
  if (unauthorized) return unauthorized

  const { id } = await params
  await prisma.subject.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
