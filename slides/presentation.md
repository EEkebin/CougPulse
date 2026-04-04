---
marp: true
theme: default
paginate: true
size: 16:9
---

# CougPulse

Secure campus awareness and safety intelligence for WSU Everett

---

## The Problem We Heard

- WSU Everett stakeholders (IT + Security) need facial detection support for threat response.
- Existing options failed key standards because sensitive data was not encrypted at rest.
- Students also lacked a simple way to find quiet, ideal study spaces across campus.

---

## Stakeholder Insight

### Security + IT asked for

- Practical threat detection support
- Better controls over sensitive identity/media data
- A system aligned with campus security expectations

### Students asked for

- Fast visibility into which rooms are quiet right now
- A simple campus map experience without admin complexity

---

## Our Solution

- One secure web platform with two tailored experiences:
	- **Student heatmap** for room noise awareness
	- **Security operations console** for device + incident workflows
- Devices send live audio/video-derived data to support both use cases
- Sensitive information is encrypted at rest to meet security requirements

---

## Core Experiences

### 1) Student Experience

- Live campus heatmap of room noise levels
- Room-by-room view of quieter study options
- Near real-time updates from deployed sensing devices

### 2) Security Experience

- Device account management and assignment
- Floor plan upload + room mapping
- Face enrollment, troublemaker flagging, and alert review

---

## How It Works (End-to-End)

1. Security configures floors, rooms, and device accounts.
2. A device signs in and is assigned to a room.
3. Device sends heartbeat data (audio level + preview image).
4. Students see live room noise from those updates.
5. If facial recognition matches a flagged subject, an alert is created.
6. Security reviews and clears alerts in the admin console.

---

## System Architecture

- **Frontend:** Next.js UI for student map, admin console, and device client pages
- **API Layer:** Next.js API routes for auth, devices, floors/rooms, faces, and alerts
- **Database:** PostgreSQL via Prisma
- **Recognition:** `face-api.js` models loaded in-browser for detection descriptors
- **Documentation:** OpenAPI + Scalar at `/api/docs`

---

## Security Design

- Sensitive payloads encrypted at rest with AES-256-GCM
- Admin and device credentials protected with Argon2id hashing
- Separate auth domains for admins and devices
- Token-based protected API routes (`x-admin-token`, `x-device-token`)
- Login attempt throttling to reduce brute-force exposure

---

## Data Protection Focus

Encrypted-at-rest examples:

- Face enrollment payloads
- Alert payload details (including face snapshots)
- Device preview/name sensitive fields
- Security notes tied to identified subjects

Non-sensitive layout metadata stays queryable for map rendering performance.

---

## Student Value

- Find quiet study spaces faster
- Reduce wasted time searching room-to-room
- Improve campus experience with clear live visibility

---

## Security & IT Value

- Operational visibility into connected campus devices
- Faster response to flagged-person detections
- Better alignment with encryption-at-rest requirements
- Unified console for users, devices, layout, and alerts

---

## Demo Walkthrough

1. Log in to `/admin` as security officer
2. Create a floor and draw rooms
3. Create/sign in a device at `/device`
4. Assign device to a room and start heartbeat
5. Open `/` to show live student heatmap updates
6. Trigger recognition and review generated security alert

---

## Impact Summary

- Solves a real stakeholder-validated compliance and safety gap
- Improves student day-to-day study experience
- Bridges security operations and student usefulness in one platform
- Delivers an extensible foundation for broader campus deployment

---

## Roadmap

### Near-term

- Role-based access controls and audit logs
- Alert triage metadata and escalation workflows
- Trend analytics for room utilization/noise over time

### Longer-term

- Multi-campus support
- Policy-driven data retention controls
- Integration with campus incident response tooling

---

## Closing

CougPulse helps WSU Everett move from a blocked security capability
to a secure, practical, and student-beneficial campus intelligence system.

---

## Q&A

Thank you.
