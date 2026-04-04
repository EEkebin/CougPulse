import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    openapi: "3.0.0",
    info: {
      title: "CougPulse API",
      version: "3.0.0",
      description:
        "API surface for the CougPulse student heatmap, security console, layout planner, admin authentication, and device authentication.",
    },
    servers: [
      {
        url: "/",
        description: "Current app origin",
      },
    ],
    tags: [
      { name: "Public", description: "Student-facing and unauthenticated read APIs." },
      { name: "Admin Auth", description: "Security officer login and profile endpoints." },
      { name: "Device Auth", description: "Device account login and pairing endpoints." },
      { name: "Admin", description: "Protected security console and layout management endpoints." },
      { name: "Device", description: "Protected device reporting endpoints." },
    ],
    components: {
      securitySchemes: {
        AdminToken: {
          type: "apiKey",
          in: "header",
          name: "x-admin-token",
          description: "Security officer token stored client-side and sent with protected admin requests.",
        },
        DeviceToken: {
          type: "apiKey",
          in: "header",
          name: "x-device-token",
          description: "Device account token stored client-side and sent with protected device requests.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        Floor: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            sortOrder: { type: "integer" },
            floorPlanImage: { type: "string", nullable: true },
            rooms: {
              type: "array",
              items: { $ref: "#/components/schemas/Room" },
            },
          },
        },
        Room: {
          type: "object",
          properties: {
            id: { type: "string" },
            floorId: { type: "string" },
            name: { type: "string" },
            shape: { type: "string" },
            points: { type: "array", items: { type: "object" } },
          },
        },
        RoomReading: {
          type: "object",
          properties: {
            id: { type: "string" },
            floor: { type: "integer" },
            name: { type: "string" },
            audioLevel: { type: "number", nullable: true },
            activeDeviceCount: { type: "integer" },
            updatedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Device: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            assignedRoomId: { type: "string", nullable: true },
            lastSeenAt: { type: "string", format: "date-time", nullable: true },
            lastAudioLevel: { type: "number", nullable: true },
            previewImage: { type: "string", nullable: true },
            previewTakenAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        SecurityAlert: {
          type: "object",
          properties: {
            id: { type: "string" },
            subjectId: { type: "string" },
            subjectName: { type: "string" },
            deviceId: { type: "string", nullable: true },
            deviceName: { type: "string", nullable: true },
            roomId: { type: "string", nullable: true },
            note: { type: "string", nullable: true },
            faceImage: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            clearedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Subject: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            descriptor: {
              type: "array",
              items: { type: "number" },
            },
            isTroublemaker: { type: "boolean" },
            notes: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AdminUser: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        DeviceAccount: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            deviceId: { type: "string", nullable: true },
            assignedRoomId: { type: "string", nullable: true },
            activeSession: { type: "boolean" },
          },
        },
      },
    },
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Admin Auth"],
          summary: "Log in as a security officer",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username", "password"],
                  properties: {
                    username: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Admin Auth"],
          summary: "Get the current security officer",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Admin Auth"],
          summary: "Log out the current security officer",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/device-auth/login": {
        post: {
          tags: ["Device Auth"],
          summary: "Log in as a device account and pair to its device record",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["username", "password"],
                  properties: {
                    username: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/device-auth/me": {
        get: {
          tags: ["Device Auth"],
          summary: "Get the current device account and paired device",
          security: [{ DeviceToken: [] }],
        },
      },
      "/api/device-auth/logout": {
        post: {
          tags: ["Device Auth"],
          summary: "Log out the current device account",
          security: [{ DeviceToken: [] }],
        },
      },
      "/api/rooms": {
        get: {
          tags: ["Public"],
          summary: "Get live room heatmap data",
          responses: {
            "200": {
              description: "Room noise summary",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/RoomReading" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/rooms/{id}": {
        get: {
          tags: ["Public"],
          summary: "Get a single room summary",
        },
      },
      "/api/floors": {
        get: {
          tags: ["Public"],
          summary: "List floors and rooms for the heatmap and planner",
          responses: {
            "200": {
              description: "Floor list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Floor" },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Admin"],
          summary: "Create a floor",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/floors/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Rename, reorder, or upload a floor plan image",
          security: [{ AdminToken: [] }],
        },
        delete: {
          tags: ["Admin"],
          summary: "Delete a floor",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/layout/rooms": {
        post: {
          tags: ["Admin"],
          summary: "Create a room shape on a floor",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/layout/rooms/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Rename or update a room shape",
          security: [{ AdminToken: [] }],
        },
        delete: {
          tags: ["Admin"],
          summary: "Delete a room",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/faces": {
        get: {
          tags: ["Admin"],
          summary: "List enrolled faces",
          security: [{ AdminToken: [] }],
        },
        post: {
          tags: ["Admin"],
          summary: "Enroll a face sample",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/faces/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Update troublemaker flag or notes",
          security: [{ AdminToken: [] }],
        },
        delete: {
          tags: ["Admin"],
          summary: "Delete an enrolled face sample",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/identify": {
        post: {
          tags: ["Device"],
          summary: "Match a detected face and raise alerts for flagged people",
          security: [{ DeviceToken: [] }, { AdminToken: [] }],
        },
      },
      "/api/devices": {
        get: {
          tags: ["Admin"],
          summary: "List connected devices",
          security: [{ AdminToken: [] }],
        },
        post: {
          tags: ["Admin"],
          summary: "Create a device record manually from the security console",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/devices/{id}": {
        get: {
          tags: ["Device"],
          summary: "Get a device by id",
          security: [{ DeviceToken: [] }, { AdminToken: [] }],
        },
        patch: {
          tags: ["Admin"],
          summary: "Rename or assign a device to a room",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/devices/{id}/heartbeat": {
        post: {
          tags: ["Device"],
          summary: "Send device heartbeat and audio level",
          security: [{ DeviceToken: [] }, { AdminToken: [] }],
        },
      },
      "/api/device-accounts": {
        get: {
          tags: ["Admin"],
          summary: "List device accounts",
          security: [{ AdminToken: [] }],
        },
        post: {
          tags: ["Admin"],
          summary: "Create a device account",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/device-accounts/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Rename a device account, reset its password, or revoke its active session",
          security: [{ AdminToken: [] }],
        },
        delete: {
          tags: ["Admin"],
          summary: "Delete a device account",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/admin/users": {
        get: {
          tags: ["Admin"],
          summary: "List security officers",
          security: [{ AdminToken: [] }],
        },
        post: {
          tags: ["Admin"],
          summary: "Create a security officer",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/admin/users/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Rename a security officer or change the current officer password",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/alerts": {
        get: {
          tags: ["Admin"],
          summary: "List active security alerts",
          security: [{ AdminToken: [] }],
        },
        patch: {
          tags: ["Admin"],
          summary: "Clear all active alerts",
          security: [{ AdminToken: [] }],
        },
      },
      "/api/alerts/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Clear an alert",
          security: [{ AdminToken: [] }],
        },
      },
    },
  });
}
