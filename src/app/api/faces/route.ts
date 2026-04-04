import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptSubject, decryptSubject } from '@/lib/crypto'

export async function GET() {
  const subjects = await prisma.subject.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(
    subjects.map(s => {
      const { name, descriptor } = decryptSubject(s.data, s.iv)
      return { id: s.id, name, descriptor: Array.from(descriptor) }
    })
  )
}

export async function POST(req: NextRequest) {
  const { name, descriptor } = await req.json()
  if (!name || !Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Missing name or descriptor' }, { status: 400 })
  }
  const encrypted = encryptSubject(name, new Float32Array(descriptor))
  const subject = await prisma.subject.create({
    data: { data: encrypted.data, iv: encrypted.iv },
  })
  return NextResponse.json({ id: subject.id }, { status: 201 })
}
