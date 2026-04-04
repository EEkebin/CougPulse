import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  configuration: {
    spec: {
      url: "/api/openapi.json",
    },
  },
});
