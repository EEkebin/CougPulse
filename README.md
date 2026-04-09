## Check out the "CPTS427_EA2_Submission" for EA-2 Assignment

# CougPulse

CougPulse is a campus monitoring platform with two connected experiences:

- **Student heatmap**: a live map showing room noise levels.
- **Security operations**: officer/admin tools for device management, face enrollment, alerting, and layout planning.

## What’s In This Repo

- Next.js App Router frontend + API routes (`src/app`)
- Prisma + PostgreSQL persistence (`prisma/schema.prisma`)
- Face recognition model assets in `public/models`
- Scalar-powered API docs at `/api/docs`
- Marp presentation source in `slides/presentation.md`

## Current App Routes

- `/` or `/map` — student heatmap
- `/login` — admin/security officer login
- `/admin` — security console (faces, alerts, devices, users, device accounts)
- `/admin/layout` — floor-plan and room editor
- `/device` — device client login + camera/mic reporting
- `/api/docs` — Scalar API reference
- `/api/openapi.json` — OpenAPI document

## Core Features

- Live noise heatmap sourced from room-level device readings
- Device heartbeat endpoint with audio level + preview image updates
- Face enrollment and matching (`/api/identify`) using `face-api.js` descriptors
- Troublemaker flag workflow with persistent security alerts
- Floor/room authoring with polygon room geometry
- Separate admin and device authentication flows
- Encrypted-at-rest sensitive fields and Argon2 password hashing

## Tech Stack

- Next.js `16` + React `19`
- TypeScript
- Prisma `7` with PostgreSQL (`@prisma/adapter-pg` + `pg`)
- Tailwind CSS `4`
- `face-api.js`
- Scalar (`@scalar/nextjs-api-reference`)
- Marp CLI (slides)

## Prerequisites

- Node.js `20+`
- npm `10+`
- PostgreSQL `15+` (local or containerized)

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Start PostgreSQL (Docker option)

```bash
docker compose up -d
```

The included `compose.yaml` provisions:

- database: `cougpulse`
- user: `cougpulse`
- password: `cougpulse`
- port: `5432`

### 3) Create `.env`

Create `.env` at the repo root:

```env
DATABASE_URL="postgresql://cougpulse:cougpulse@localhost:5432/cougpulse"
ENCRYPTION_KEY="<64-hex-char-key>"
```

Generate a key (PowerShell):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4) Apply migrations

```bash
npx prisma migrate dev
```

### 5) Run the app

```bash
npm run dev
```

The dev server runs on `https://0.0.0.0:3000` (see `package.json`, `--experimental-https`).

## Default Bootstrap Admin

On an empty database, the first admin login attempt auto-creates:

- username: `admin`
- password: `password`

You should change this immediately from the admin user tools.

## Authentication Model

- **Admin token header**: `x-admin-token`
- **Device token header**: `x-device-token`
- Admin token local storage key: `cougpulse_admin_token`
- Device token local storage key: `cougpulse_device_auth_token`

## API Surface (High Level)

- **Admin auth**: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- **Device auth**: `/api/device-auth/login`, `/api/device-auth/me`, `/api/device-auth/logout`
- **Layout & heatmap**: `/api/floors`, `/api/floors/[id]`, `/api/rooms`, `/api/rooms/[id]`, `/api/layout/rooms`
- **Faces & identify**: `/api/faces`, `/api/faces/[id]`, `/api/identify`
- **Devices**: `/api/devices`, `/api/devices/[id]`, `/api/devices/[id]/heartbeat`
- **Accounts & officers**: `/api/device-accounts`, `/api/device-accounts/[id]`, `/api/admin/users`, `/api/admin/users/[id]`
- **Alerts**: `/api/alerts`, `/api/alerts/[id]`

Interactive docs are available at `/api/docs`.

## Security Notes

- Admin and device passwords are hashed with Argon2id.
- Subject identity payloads are encrypted with AES-256-GCM.
- Sensitive fields (alert payloads, device preview/name, and secure notes) are stored encrypted.
- Login endpoints include in-memory attempt throttling per user/IP key.

## Database & Reset Workflows

Normal iterative workflow:

```bash
npx prisma migrate dev
```

Cross-platform hard reset (drops data, reapplies migrations):

```bash
npx prisma migrate reset --force
```

Bash-only helper script is available at `scripts/reset-db.sh`.

## Operational Flow

1. Log in at `/login` (admin/security officer).
2. Create device accounts from `/admin`.
3. Sign devices in at `/device`.
4. Assign each paired device to a room.
5. Build floors/rooms in `/admin/layout`.
6. Student view (`/`) reflects live room noise.
7. Enroll faces and flag troublemakers; alerts appear when matched.

## Development Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Slides

Slides live in `slides/presentation.md`.

```bash
npm run slides:dev
npm run slides:html
npm run slides:pdf
```

`slides:pdf` requires a local browser (Chrome/Edge/Firefox).

## Troubleshooting

- **Camera/mic blocked**: use the HTTPS dev URL and allow browser permissions.
- **Face models not loading**: confirm files exist under `public/models`.
- **Database connection errors**: verify `DATABASE_URL` and that PostgreSQL is running.
- **Encryption errors**: ensure `ENCRYPTION_KEY` is a valid 64-character hex string.
