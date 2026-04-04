import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    openapi: "3.0.0",
    info: {
      title: "CougPulse API",
      version: "2.0.0",
      description: "APIs for campus noise heatmaps, devices, face enrollment, and security alerts.",
    },
    paths: {
      "/api/rooms": {
        get: {
          summary: "Get live room heatmap data",
        },
      },
      "/api/rooms/{id}": {
        get: {
          summary: "Get a single room summary",
        },
      },
      "/api/faces": {
        get: {
          summary: "List enrolled faces",
        },
        post: {
          summary: "Enroll a face sample",
        },
      },
      "/api/faces/{id}": {
        patch: {
          summary: "Update troublemaker flag or notes",
        },
        delete: {
          summary: "Delete an enrolled face sample",
        },
      },
      "/api/identify": {
        post: {
          summary: "Match a detected face and raise alerts for flagged people",
        },
      },
      "/api/devices": {
        get: {
          summary: "List connected devices",
        },
        post: {
          summary: "Create a new device client",
        },
      },
      "/api/devices/{id}": {
        get: {
          summary: "Get a device",
        },
        patch: {
          summary: "Rename or assign a device to a room",
        },
      },
      "/api/devices/{id}/heartbeat": {
        post: {
          summary: "Send device heartbeat and audio level",
        },
      },
      "/api/alerts": {
        get: {
          summary: "List active security alerts",
        },
      },
      "/api/alerts/{id}": {
        patch: {
          summary: "Clear an alert",
        },
      },
    },
  });
}
