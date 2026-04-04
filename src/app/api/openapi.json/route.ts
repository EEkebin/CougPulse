import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    openapi: "3.0.0",
    info: {
      title: "CougPulse API",
      version: "1.0.0",
      description: "Simple API for CougPulse",
    },
    paths: {
      "/api/hello": {
        get: {
          responses: {
            "200": {
              description: "Returns a hello message",
            },
          },
        },
      },
    },
  });
}
