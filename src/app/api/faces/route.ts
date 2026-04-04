import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const faces = await prisma.face.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });
  return NextResponse.json(faces);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, descriptor } = body;

  if (!name || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json(
      { error: "name and a 128-element descriptor array are required" },
      { status: 400 }
    );
  }

  const descriptorEncrypted = encrypt(JSON.stringify(descriptor));
  const face = await prisma.face.create({
    data: { name, descriptorEncrypted },
    select: { id: true, name: true, createdAt: true },
  });
  return NextResponse.json(face, { status: 201 });
}
