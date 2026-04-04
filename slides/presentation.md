---
marp: true
theme: crimson-gray
paginate: true
size: 16:9
---

# CougPulse

Smart Campus safety and study support for WSU Everett

---

## Theme Fit: Smart Campus

Why this should score high:

- CougPulse is a full Smart Campus loop: sense, analyze, decide, act.
- One system helps both students and security.
- It uses live room data, not static reports.

How we prove it:

- Devices send heartbeat updates from real rooms.
- Students see live noise levels on the map.
- Security gets alerts from the same device network.

---

## Problem + Stakeholders

### Security + IT needed

- Faster response when a flagged person is detected
- Better protection for sensitive identity and media data
- A system they can keep using after the hackathon

### Students needed

- Fast visibility into which rooms are quiet right now
- A simple map to find better study spaces quickly

---

## Solution Summary

- One platform with two focused experiences:
  - **Student Heatmap:** live room noise
  - **Security Console:** devices, faces, and alerts
- Devices send audio level and face-match events in near real time
- Sensitive data is encrypted at rest

---

## Technical Complexity & Ambition

Why this should score high:

- The project combines auth, mapping, telemetry, and face recognition.
- The logic is clear and testable, not just UI polish.
- Security is part of the design from the start.

How we prove it:

- Separate admin and device auth with different tokens
- Face matching with distance checks, room checks, and alert de-duplication
- Prisma schema linking rooms, devices, readings, subjects, and alerts
- Login throttling and encrypted sensitive fields in API and storage

---

## Functionality & Execution

Why this should score high:

- The core workflow works end to end.
- Features are live, not mocked.
- It handles edge cases like unassigned devices.

How we prove it in demo:

1. Admin creates floors, rooms, and device accounts.
2. Device logs in and starts heartbeat updates.
3. Student map updates with live room noise.
4. Admin enrolls faces and flags subjects.
5. A flagged match creates an alert.
6. Security reviews and clears the alert.

---

## Scalability & Feasibility

Why this should score high:

- The system can grow without a full rewrite.
- The structure is easy to maintain.
- The stack is practical for real deployment.

How we prove it:

- API routes are split by feature area
- Floor and room model can scale to more buildings and campuses
- RoomReading history supports trend analytics
- OpenAPI docs support onboarding and future integrations

---

## Cool Factor / Creativity & Innovation

Why this should score high:

- One device network gives two benefits: student support and safety response.
- The experience feels like a live digital campus twin.
- It is innovative while still privacy-aware.

How we show the wow factor:

- Judges can watch room heat levels update live.
- The same pipeline can create security alerts with context.
- The demo shows sensing to action in one flow.

---

## Security Design Highlights

- Sensitive payloads encrypted at rest with AES-256-GCM
- Admin and device passwords protected with Argon2id hashing
- Separate admin and device auth tokens in protected API routes
- Login throttling to reduce brute-force attempts

Encrypted-at-rest examples:

- Face enrollment payloads
- Alert payload details and face snapshots
- Device preview and sensitive name fields
- Security notes tied to identified subjects

---

## Documentation

Why this should score high:

- Docs clearly explain purpose, setup, architecture, and security.
- API docs are interactive and easy to verify.
- The codebase is organized for quick review.

How we prove it:

- README covers routes, setup, features, and workflows
- OpenAPI + Scalar docs at `/api/docs`
- Clear folder split for routes, components, and shared libs

---

## Demo Walkthrough

1. Log in to `/admin`
2. Create a floor and draw rooms
3. Log in a device at `/device`
4. Assign device to a room and start heartbeat
5. Open `/` to show live heatmap updates
6. Trigger recognition and review the alert

---

## Impact Summary

- Solves a real campus safety and compliance gap
- Helps students find better study spaces faster
- Connects security operations and student value in one tool
- Creates a strong base for broader campus rollout

---

## Roadmap

### Near-term

- Role-based access control and audit logs
- Better alert triage and escalation
- Noise and room-use trends over time

### Longer-term

- Multi-campus support
- Policy-based data retention
- Integration with campus incident response systems

---

## Closing

CougPulse helps WSU Everett move from a blocked idea
to a practical Smart Campus system that helps both safety and students.

---

## Q&A

Thank you.
