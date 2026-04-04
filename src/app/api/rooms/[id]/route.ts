import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { level } = await req.json()
  if (typeof level !== 'number') {
    return NextResponse.json({ error: 'Missing level' }, { status: 400 })
  }
  await prisma.roomReading.upsert({
    where: { id },
    create: { id, audioLevel: level, updatedAt: new Date() },
    update: { audioLevel: level, updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
