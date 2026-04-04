# CougPulse

CougPulse is a campus monitoring platform with two separate experiences:

- Student heatmap: a live classroom noise map that shows which rooms are currently quietest.
- Security operations: device management, face enrollment, troublemaker alerts, and floor-plan administration.

## Table Of Contents

- [Current Routes](#current-routes)
- [Core Features](#core-features)
- [Auth Model](#auth-model)
- [Admin / Security Officers](#admin--security-officers)
- [Device Clients](#device-clients)
- [Data Security](#data-security)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Notes](#environment-notes)
- [Typical Flow](#typical-flow)
- [API Docs](#api-docs)

## Current Routes

- `/` or `/map`: student heatmap
- `/login`: admin/security officer login
- `/admin`: security console
- `/admin/layout`: floor and room layout planner
- `/device`: device login and live camera/microphone client
- `/api/docs`: Scalar API reference backed by the generated OpenAPI document

## Core Features

- Live room-noise heatmap driven by assigned devices
- Separate admin and device authentication flows
- Device accounts that stay paired independently of officer password changes
- Face enrollment with troublemaker flags and notes
- Persistent security alerts with face snapshots
- Floor creation, floor-plan upload, and room drawing in the layout planner
- Encrypted-at-rest sensitive operational data, plus Argon2 password hashing

## Auth Model

### Admin / Security Officers

- Log in at `/login`
- Auth token is stored in browser `localStorage`
- Protected admin requests use the `x-admin-token` header
- Default bootstrap credentials on a fresh database:
  - username: `admin`
  - password: `password`

### Device Clients

- Log in at `/device`
- Devices use their own device-account credentials created from `/admin`
- Device requests use the `x-device-token` header
- Device sessions are intentionally persistent until explicitly revoked or logged out

## Data Security

- Admin and device passwords are hashed with Argon2
- Face enrollment payloads are encrypted at rest
- Alert payloads, device previews, device names, and sensitive notes are encrypted at rest
- Room/floor metadata and floor-plan layout data are not encrypted, because the app needs to query and render them directly

## Tech Stack

- Next.js App Router
- Prisma + PostgreSQL
- Scalar for API documentation
- Tailwind CSS
- face-api.js for browser-side facial recognition

## Local Development

Install dependencies:

```bash
npm install
```

Apply the schema and start the app:

```bash
npx prisma migrate dev
npm run dev
```

If you want a full local reset instead:

```bash
./scripts/reset-db.sh
npm run dev
```

## Environment Notes

The app expects a working PostgreSQL connection and an encryption key in `.env`.

Important variables include:

- `DATABASE_URL`
- `ENCRYPTION_KEY`

`ENCRYPTION_KEY` should be a 32-byte hex string for AES-256-GCM.

## Typical Flow

1. Log into `/admin` as a security officer.
2. Create device accounts in the security console.
3. Open `/device` on phones/laptops and sign in with those device accounts.
4. Assign each connected device to a room from `/admin`.
5. Build floors and rooms in `/admin/layout`.
6. Open `/` to view the live student heatmap.
7. Enroll faces in `/admin`, flag troublemakers, and review alerts as devices report detections.

## API Docs

Scalar documentation is available at:

- `/api/docs`

Raw OpenAPI JSON is available at:

- `/api/openapi.json`
