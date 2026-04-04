import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const device = await prisma.device.findUnique({ where: { id } })

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  return NextResponse.json(device)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, assignedRoomId } = await req.json()

  const device = await prisma.device.update({
    where: { id },
    data: {
      ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
      ...(typeof assignedRoomId === 'string' || assignedRoomId === null ? { assignedRoomId } : {}),
    },
  })

  return NextResponse.json(device)
}
