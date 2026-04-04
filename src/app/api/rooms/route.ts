import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const readings = await prisma.roomReading.findMany()
  return NextResponse.json(readings)
}
