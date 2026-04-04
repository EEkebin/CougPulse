import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptSubject } from '@/lib/crypto'

function euclideanDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

const THRESHOLD = 0.6

export async function POST(req: NextRequest) {
  const { descriptor } = await req.json()
  if (!Array.isArray(descriptor)) {
    return NextResponse.json({ error: 'Missing descriptor' }, { status: 400 })
  }

  const query = new Float32Array(descriptor)
  const subjects = await prisma.subject.findMany()

  let best: { id: string; name: string; distance: number } | null = null

  for (const s of subjects) {
    const { name, descriptor: stored } = decryptSubject(s.data, s.iv)
    const distance = euclideanDistance(query, stored)
    if (!best || distance < best.distance) {
      best = { id: s.id, name, distance }
    }
  }

  if (!best || best.distance > THRESHOLD) {
    return NextResponse.json({ match: null, label: 'UNKNOWN' })
  }

  return NextResponse.json({ match: best.id, label: best.name, distance: best.distance })
}
