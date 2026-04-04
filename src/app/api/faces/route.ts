import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptSubject, decryptSubject } from '@/lib/crypto'
import { requireAdminUser } from '@/lib/auth'
import { decryptOptionalString, encryptOptionalString } from '@/lib/secure-models'

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const subjects = await prisma.subject.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(
    subjects.map(s => {
      const { name, descriptor } = decryptSubject(s.data, s.iv)
      return {
        id: s.id,
        name,
        descriptor: Array.from(descriptor),
        isTroublemaker: s.isTroublemaker,
        notes: decryptOptionalString(s.notesEncrypted, s.notesIv, s.notes),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }
    })
  )
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdminUser(req)
  if (unauthorized) return unauthorized

  const { name, descriptor, isTroublemaker = false, notes = null } = await req.json()
  if (!name || !Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Missing name or descriptor' }, { status: 400 })
  }
  const encrypted = encryptSubject(name, new Float32Array(descriptor))
  const data = new Uint8Array(encrypted.data.byteLength)
  data.set(encrypted.data)
  const iv = new Uint8Array(encrypted.iv.byteLength)
  iv.set(encrypted.iv)
  const subject = await prisma.subject.create({
    data: {
      data,
      iv,
      isTroublemaker: Boolean(isTroublemaker),
      notes: null,
      ...(() => {
        const encryptedNotes = encryptOptionalString(typeof notes === 'string' ? notes : null)
        return {
          notesEncrypted: encryptedNotes.encrypted,
          notesIv: encryptedNotes.iv,
        }
      })(),
    },
  })
  return NextResponse.json({ id: subject.id }, { status: 201 })
}
