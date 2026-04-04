---
marp: true
theme: crimson-gray
paginate: true
size: 16:9
---

# CougPulse

Smart campus safety and study support for WSU Everett

---

## Theme Fit: Smart Campus

CougPulse is built around a live, interactive campus map — admins create the building layout by tracing floors and rooms over a map overlay. That same map powers two experiences:

- **Students** see live noise levels for each room to find a quiet study spot
- **Security** sees device feeds, facial recognition results, and alerts by room

Cameras and microphones in each room feed audio and video data into the system. Facial recognition identifies students, faculty, staff, unknown visitors, and known troublemakers — all tied to a specific room on the map.

This is the Smart Campus theme in action: a real building, mapped digitally, with live sensing and automated response.

---

## Problem

**Security & IT**
- The IT Director of WSU Everett said facial recognition was off the table — no solution could protect sensitive identity data with encryption at rest
- We built that encryption, making facial recognition viable for the first time on this campus

**Students**
- No quick way to know which rooms are quiet right now
- No simple tool to find a better study spot

---

## Solution

Two views, one platform:

- **Student Heatmap** — live room noise levels on the campus map
- **Security Console** — devices, facial recognition results, and alerts by room

Cameras and mics send audio and video data in near real time. Sensitive identity data is encrypted at rest.

---

## Technical Complexity

- Combines auth, mapping, telemetry, and facial recognition
- Logic is testable — not just UI polish
- Security is baked in from the start

Key details:
- Separate tokens for admin and device auth
- Face matching with distance checks, room checks, and alert de-duplication
- Prisma schema linking rooms, devices, readings, subjects, and alerts
- Login throttling and encrypted sensitive fields

---

## Functionality

The core workflow works end to end — features are live, not mocked.

**Demo steps:**
1. Admin creates floors, rooms, and device accounts
2. Device logs in and starts sending heartbeats
3. Student map updates with live noise
4. Admin enrolls faces and flags subjects
5. A flagged match creates an alert
6. Security reviews and clears the alert

---

## Scalability

- The campus map is fully customizable — not hardcoded to WSU Everett
- Any building works: upload a map overlay, then admins trace and draw rooms on top
- Floor and room model can grow to more buildings or campuses
- Room reading history supports trend analytics
- OpenAPI docs make onboarding easier

---

## Security Design

- AES-256-GCM encryption for sensitive data at rest
- Argon2id hashing for admin and device passwords
- Separate auth tokens for admin and device routes
- Login throttling to block brute-force attempts

**Encrypted fields include:**
- Face enrollment payloads
- Alert details and face snapshots
- Device previews and sensitive name fields
- Security notes on flagged subjects

---

## Documentation

- README covers routes, setup, features, and workflows
- Interactive API docs at `/api/docs` (OpenAPI + Scalar)
- Clear folder structure for routes, components, and shared libs

---

## Impact

- Directly addresses a barrier the WSU Everett IT Director identified
- Makes facial recognition viable on campus through encryption at rest
- Helps students find quiet study spaces fast
- One system connects security operations and student experience

---

## Demo

# Demo Time 🎉

---

## Q&A

Thank you.
