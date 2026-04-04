export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "CougPulse API",
    version: "1.0.0",
    description: "API for face-to-name mapping and audio level tracking.",
  },
  paths: {
    "/api/faces": {
      get: {
        summary: "List all faces",
        tags: ["Faces"],
        responses: {
          "200": {
            description: "Array of stored faces with descriptors",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Face" },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Add a new face",
        tags: ["Faces"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateFace" },
            },
          },
        },
        responses: {
          "201": {
            description: "Face created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Face" },
              },
            },
          },
          "400": { description: "Missing name or descriptor" },
        },
      },
    },
    "/api/identify": {
      post: {
        summary: "Identify a face by descriptor (server-side matching)",
        tags: ["Faces"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["descriptor"],
                properties: {
                  descriptor: {
                    type: "array",
                    items: { type: "number" },
                    description: "128-dimensional face embedding",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Best match name, or null if no match",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/faces/{id}": {
      delete: {
        summary: "Delete a face",
        tags: ["Faces"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": { description: "Deleted" },
          "404": { description: "Not found" },
        },
      },
    },
  },
  components: {
    schemas: {
      Face: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          descriptor: {
            type: "array",
            items: { type: "number" },
            description: "128-dimensional face embedding",
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateFace: {
        type: "object",
        required: ["name", "descriptor"],
        properties: {
          name: { type: "string" },
          descriptor: {
            type: "array",
            items: { type: "number" },
            description: "128-dimensional face embedding from face-api.js",
          },
        },
      },
    },
  },
};
